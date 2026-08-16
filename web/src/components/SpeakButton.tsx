import { useEffect, useRef, useState } from 'react';

import { audioUrlForKana, audioUrlForVocab } from '../audio';

function canSpeak(text?: string): boolean {
  return Boolean(text)
    && typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && 'SpeechSynthesisUtterance' in window;
}

/** Plays immutable course audio with an explicit Japanese browser-voice fallback. */
export function SpeakButton({
  vocabId,
  kanaId,
  text,
  label = 'Play',
  speed = 1,
}: {
  vocabId?: string;
  kanaId?: string;
  /** Japanese reading used only when the stored course recording cannot load. */
  text?: string;
  label?: string;
  speed?: number;
}) {
  const src = vocabId ? audioUrlForVocab(vocabId) : kanaId ? audioUrlForKana(kanaId) : null;
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [recordingFailed, setRecordingFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const unavailable = (!src || recordingFailed) && !canSpeak(text);

  useEffect(() => {
    if (!src) {
      setRecordingFailed(true);
      return;
    }

    const element = new Audio(src);
    element.preload = 'none';
    elementRef.current = element;
    setRecordingFailed(false);
    setPlaying(false);

    const onEnded = () => setPlaying(false);
    const onError = () => {
      setRecordingFailed(true);
      setPlaying(false);
    };
    element.addEventListener('ended', onEnded);
    element.addEventListener('error', onError);

    return () => {
      element.removeEventListener('ended', onEnded);
      element.removeEventListener('error', onError);
      element.pause();
      elementRef.current = null;
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      window.speechSynthesis?.cancel();
      utteranceRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    if (elementRef.current) elementRef.current.playbackRate = speed;
    if (utteranceRef.current) utteranceRef.current.rate = speed;
  }, [speed, src]);

  function browserVoice() {
    if (!text || !canSpeak(text)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = speed;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    utteranceRef.current = utterance;
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  }

  function play() {
    if (unavailable) return;
    if (recordingFailed || !elementRef.current) {
      browserVoice();
      return;
    }

    const element = elementRef.current;
    element.currentTime = 0;
    setPlaying(true);
    void element.play().catch(() => {
      setRecordingFailed(true);
      setPlaying(false);
      browserVoice();
    });
  }

  return (
    <button
      type="button"
      className={`speak${playing ? ' speak-playing' : ''}`}
      onClick={play}
      disabled={unavailable}
      aria-label={unavailable ? 'No audio for this' : 'Play Japanese pronunciation'}
      title={unavailable ? 'No Japanese audio is available on this device' : recordingFailed ? 'Using browser Japanese voice' : 'Course recording'}
    >
      <span aria-hidden="true">{unavailable ? '×' : '▶'}</span>
      <span>{unavailable ? 'No audio' : label}</span>
    </button>
  );
}
