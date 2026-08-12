import { useEffect, useRef, useState } from 'react';

import { audioUrlForVocab } from '../../audio';
import { Icon } from '../ui/Icon';

import './listening.css';

type AudioSource = 'checking' | 'recorded' | 'browser' | 'unavailable';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function canUseBrowserVoice(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function ListeningAudioPlayer({
  itemId,
  text,
  speed,
  onSpeedChange,
  compact = false,
  revealText = true,
}: {
  itemId: string;
  /** The real corpus reading to speak if recorded bytes are unavailable. */
  text: string;
  speed: number;
  onSpeedChange: (speed: number) => void;
  compact?: boolean;
  /** Keep the transcript hidden during recall questions. */
  revealText?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [source, setSource] = useState<AudioSource>('checking');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const src = audioUrlForVocab(itemId);

  useEffect(() => {
    const audio = audioRef.current;
    audio?.pause();
    setSource('checking');
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    return () => {
      audio?.pause();
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      window.speechSynthesis?.cancel();
      utteranceRef.current = null;
    };
  }, [itemId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    audio.volume = volume;
    if (utteranceRef.current) {
      utteranceRef.current.rate = speed;
      utteranceRef.current.volume = volume;
    }
  }, [speed, volume, itemId]);

  function speakWithBrowserVoice() {
    if (!canUseBrowserVoice()) {
      setSource('unavailable');
      setPlaying(false);
      return;
    }
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = speed;
    utterance.volume = volume;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => {
      setPlaying(false);
      setSource('unavailable');
    };
    utteranceRef.current = utterance;
    setSource('browser');
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  }

  async function play() {
    if (playing) {
      if (source === 'browser') {
        if (utteranceRef.current) {
          utteranceRef.current.onend = null;
          utteranceRef.current.onerror = null;
        }
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
      } else {
        audioRef.current?.pause();
      }
      setPlaying(false);
      return;
    }
    if (source === 'browser') {
      speakWithBrowserVoice();
      return;
    }
    if (source === 'unavailable') return;

    const audio = audioRef.current;
    if (!audio) {
      speakWithBrowserVoice();
      return;
    }
    audio.playbackRate = speed;
    audio.volume = volume;
    try {
      await audio.play();
      setSource('recorded');
      setPlaying(true);
    } catch {
      speakWithBrowserVoice();
    }
  }

  function replay() {
    if (source === 'browser') {
      speakWithBrowserVoice();
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.playbackRate = speed;
    audio.volume = volume;
    setCurrentTime(0);
    void audio.play().then(() => {
      setSource('recorded');
      setPlaying(true);
    }).catch(() => speakWithBrowserVoice());
  }

  function seek(next: number) {
    const audio = audioRef.current;
    if (!audio || source === 'browser') return;
    audio.currentTime = next;
    setCurrentTime(next);
  }

  return <div className={`listening-player${compact ? ' listening-player-compact' : ''}`}>
    <audio
      ref={audioRef}
      src={src}
      preload="metadata"
      onCanPlay={() => setSource('recorded')}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => { setPlaying(false); setCurrentTime(0); }}
      onError={() => { setPlaying(false); setSource(canUseBrowserVoice() ? 'browser' : 'unavailable'); }}
    />
    <div className="listening-player-main"><button type="button" className="listening-player-play" onClick={() => void play()} disabled={source === 'unavailable'} aria-label={playing ? (source === 'browser' ? 'Stop audio' : 'Pause audio') : 'Play audio'}><Icon name={playing ? 'pause' : 'play'} size={compact ? 20 : 25} fill={playing ? 'currentColor' : 'none'} /></button><div className="listening-player-track"><div className="listening-player-heading"><span><Icon name="audio-lines" size={15} /> {source === 'recorded' ? 'Course recording' : source === 'browser' ? 'Browser Japanese voice' : source === 'unavailable' ? 'Audio unavailable' : 'Checking course audio…'}</span><strong className={revealText ? 'ja' : ''} lang={revealText ? 'ja' : undefined}>{revealText ? text : 'Listening prompt'}</strong></div><label><span className="visually-hidden">Audio position</span><input type="range" min={0} max={Math.max(duration, 1)} step={0.01} value={Math.min(currentTime, Math.max(duration, 1))} onChange={(event) => seek(Number(event.target.value))} disabled={source !== 'recorded' || duration <= 0} /></label><div className="listening-player-time"><span className="tabular">{formatTime(currentTime)}</span><span className="tabular">{source === 'recorded' ? formatTime(duration) : '—'}</span></div></div><button type="button" className="listening-player-replay" onClick={replay} disabled={source === 'unavailable'} aria-label="Replay audio"><Icon name="repeat" size={18} /></button></div>
    {!compact ? <div className="listening-player-controls"><div className="listening-speed-control"><span>Speed control</span><div>{SPEEDS.map((value) => <button type="button" key={value} className={speed === value ? 'is-active' : ''} onClick={() => onSpeedChange(value)} aria-pressed={speed === value}>{value}×</button>)}</div></div><label className="listening-volume"><Icon name="volume-2" size={17} /><span className="visually-hidden">Volume</span><input type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label></div> : null}
    {source === 'browser' ? <p className="listening-source-note" role="status">The stored recording is unavailable, so playback is using this browser&rsquo;s Japanese voice and the real course reading.</p> : source === 'unavailable' ? <p className="listening-source-note is-error" role="status">Neither a course recording nor a Japanese browser voice is available for this item.</p> : null}
  </div>;
}
