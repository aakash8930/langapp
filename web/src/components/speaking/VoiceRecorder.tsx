import { useEffect, useRef, useState } from 'react';

import { Icon } from '../ui/Icon';

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4']
    .find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionFor(type: string): string {
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('mp4')) return 'm4a';
  return 'webm';
}

export function VoiceRecorder({
  onReady,
  downloadName = 'japanese-speaking-attempt',
}: {
  onReady?: () => void;
  downloadName?: string;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlRef = useRef<string | null>(null);
  const callbackRef = useRef(onReady);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== 'undefined';

  useEffect(() => {
    callbackRef.current = onReady;
  }, [onReady]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  function clearClip() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setClip(null);
  }

  async function startRecording() {
    if (!supported || recording) return;
    setError(null);
    clearClip();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const startedAt = Date.now();

      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);

        if (chunks.length === 0) {
          setError('The browser stopped recording before it captured audio.');
          return;
        }
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setClip({ url, type });
        callbackRef.current?.();
      };

      recorder.start(250);
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      }, 250);
    } catch (cause) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      const name = cause instanceof DOMException ? cause.name : '';
      setError(name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow microphone permission and try again.'
        : 'The microphone could not be opened. Check that another app is not using it.');
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
  }

  if (!supported) {
    return <div className="speaking-recorder-unavailable"><Icon name="mic" size={22} /><div><strong>Voice recording is unavailable in this browser.</strong><p>You can still play the model and practise aloud without saving a clip.</p></div></div>;
  }

  return <div className={`speaking-recorder${recording ? ' is-recording' : ''}`}>
    <div className="speaking-recorder-status" aria-live="polite"><span><Icon name={recording ? 'square' : 'mic'} size={18} /></span><div><small>{recording ? 'RECORDING FROM THIS MICROPHONE' : clip ? 'LOCAL RECORDING READY' : 'VOICE RECORDING'}</small><strong>{recording ? formatElapsed(elapsed) : clip ? 'Play back and compare your attempt' : 'Record your own voice'}</strong></div></div>
    {clip ? <audio className="speaking-recording-playback" controls src={clip.url}>Your browser cannot play this local recording.</audio> : null}
    <div className="speaking-recorder-actions">{recording ? <button type="button" className="btn btn-secondary" onClick={stopRecording}><Icon name="square" size={15} fill="currentColor" /> Stop recording</button> : <button type="button" className="btn btn-primary" onClick={() => void startRecording()}><Icon name="mic" size={16} /> {clip ? 'Record again' : 'Start recording'}</button>}{clip ? <><a className="btn btn-secondary" href={clip.url} download={`${downloadName}.${extensionFor(clip.type)}`}><Icon name="download" size={15} /> Download clip</a><button type="button" className="btn btn-secondary" onClick={clearClip}><Icon name="trash" size={15} /> Delete</button></> : null}</div>
    {error ? <p className="speaking-control-error" role="alert">{error}</p> : <p className="speaking-privacy-note">This recording stays in this browser tab unless you download it. It is not uploaded or added to conversation history.</p>}
  </div>;
}
