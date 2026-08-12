import { useEffect } from 'react';

import { useSpeechRecognition } from './speaking/useSpeechRecognition';
import { Icon } from './ui/Icon';

import './speaking/speaking.css';

/** Japanese browser transcription used by speech questions in course lessons. */
export function SpeechQuiz({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const speech = useSpeechRecognition(onSubmit);
  const listening = speech.listening;
  const stop = speech.stop;

  useEffect(() => {
    if (disabled && listening) stop();
  }, [disabled, listening, stop]);

  if (!speech.supported) {
    return <div className="speech-quiz-unsupported speaking-recorder-unavailable"><Icon name="mic" size={22} /><div><strong>Your browser does not support Japanese speech recognition.</strong><p>Chrome, Edge, and Safari generally expose this browser service.</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => onSubmit('skipped')} disabled={disabled}>Skip question</button></div></div>;
  }

  return <div className="speech-quiz speaking-transcription"><div className={`transcript-box speaking-transcript-box${speech.listening ? ' is-listening' : ''}`} aria-live="polite"><Icon name="mic" size={20} /><div><small>{speech.listening ? 'LISTENING…' : speech.transcript ? 'YOUR BROWSER HEARD' : 'SPEECH QUESTION'}</small><p className={speech.transcript ? 'ja' : ''} lang={speech.transcript ? 'ja' : undefined}>{speech.transcript || 'Start the microphone and speak Japanese.'}</p></div></div><div className="speaking-control-actions"><button type="button" className={`btn ${speech.listening ? 'btn-secondary' : 'btn-primary'}`} onClick={speech.listening ? speech.stop : speech.start} disabled={disabled}><Icon name={speech.listening ? 'square' : 'mic'} size={15} /> {speech.listening ? 'Stop listening' : speech.transcript ? 'Try again' : 'Tap to speak'}</button>{speech.transcript ? <button type="button" className="btn btn-secondary" onClick={speech.clear} disabled={disabled}><Icon name="refresh-cw" size={15} /> Clear</button> : null}</div>{speech.error ? <p className="speaking-control-error" role="alert">{speech.error}</p> : <p className="speaking-privacy-note">The app receives the transcript returned by your browser&rsquo;s speech service.</p>}</div>;
}
