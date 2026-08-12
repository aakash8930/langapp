import { useEffect, useRef, useState } from 'react';

import { Icon } from '../ui/Icon';

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEventLike = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => RecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export function ShadowingRecorder({ target }: { target: string }) {
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [failed, setFailed] = useState(false);
  const supported = recognitionConstructor() !== undefined;

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      // The browser may already have ended a single-utterance recognition run.
    }
    recognitionRef.current = null;
  }, []);

  function start() {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    recognitionRef.current?.stop();
    const recognition = new Constructor();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let heard = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        heard += event.results[index]?.[0]?.transcript ?? '';
      }
      setTranscript(heard);
    };
    recognition.onerror = () => {
      setFailed(true);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setTranscript('');
    setFailed(false);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setFailed(true);
      setListening(false);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return <div className="shadowing-recorder"><div className="shadowing-target"><small>SHADOW THIS READING</small><p className="ja" lang="ja">{target}</p></div>{supported ? <><div className={`shadowing-transcript${listening ? ' is-listening' : ''}`} aria-live="polite"><Icon name="mic" size={20} /><div><small>{listening ? 'LISTENING…' : transcript ? 'YOUR BROWSER HEARD' : 'YOUR ATTEMPT'}</small><p className={transcript ? 'ja' : ''} lang={transcript ? 'ja' : undefined}>{transcript || 'Tap Start shadowing, then repeat the reading aloud.'}</p></div></div><div className="shadowing-actions"><button type="button" className={`btn ${listening ? 'btn-secondary' : 'btn-primary'}`} onClick={listening ? stop : start}><Icon name="mic" size={16} /> {listening ? 'Stop listening' : transcript ? 'Try again' : 'Start shadowing'}</button>{transcript ? <button type="button" className="btn btn-secondary" onClick={() => setTranscript('')}><Icon name="refresh-cw" size={15} /> Clear attempt</button> : null}</div>{failed ? <p className="shadowing-note is-error" role="status">Speech recognition could not start. Check microphone permission and try again.</p> : <p className="shadowing-note">Browser transcription helps you compare what was heard with the course reading. It is not a pronunciation score.</p>}</> : <div className="shadowing-unsupported"><strong>Speech recognition is unavailable in this browser.</strong><p>Play the model, repeat it aloud, and compare yourself with the visible course reading. Chrome, Edge, and Safari generally support microphone transcription.</p></div>}</div>;
}
