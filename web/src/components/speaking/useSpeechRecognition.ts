import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEventLike = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorLike = { error?: string };
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => RecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

function getRecognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function stopRecognition(recognition: RecognitionLike | null) {
  if (!recognition) return;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  try {
    recognition.stop();
  } catch {
    // A single-utterance recognition run may already have ended.
  }
}

function recognitionErrorMessage(error?: string): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Microphone access was blocked. Allow microphone permission and try again.';
  }
  if (error === 'no-speech') return 'No speech was detected. Move closer to the microphone and try again.';
  if (error === 'audio-capture') return 'No working microphone was found.';
  if (error === 'network') return 'The browser speech service could not be reached.';
  return 'Speech recognition stopped before it could return a transcript.';
}

export function useSpeechRecognition(onFinal?: (transcript: string) => void) {
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const finalCallbackRef = useRef(onFinal);
  const submittedRef = useRef(false);
  const transcriptRef = useRef('');
  const failedRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supported = getRecognitionConstructor() !== undefined;

  useEffect(() => {
    finalCallbackRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => () => {
    stopRecognition(recognitionRef.current);
    recognitionRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      // Keep callbacks attached: browsers often emit the final transcript after stop().
      recognition.stop();
    } catch {
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const clear = useCallback(() => {
    transcriptRef.current = '';
    failedRef.current = false;
    setTranscript('');
    setError(null);
  }, []);

  const start = useCallback(() => {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) return;

    stopRecognition(recognitionRef.current);
    const recognition = new Constructor();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = true;
    submittedRef.current = false;
    transcriptRef.current = '';
    failedRef.current = false;
    setTranscript('');
    setError(null);

    recognition.onresult = (event) => {
      let heard = '';
      let hasFinal = false;
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        heard += result?.[0]?.transcript ?? '';
        if (index >= event.resultIndex && result?.isFinal) hasFinal = true;
      }
      const next = heard.trim();
      transcriptRef.current = next;
      setTranscript(next);
      if (hasFinal && next && !submittedRef.current) {
        submittedRef.current = true;
        finalCallbackRef.current?.(next);
      }
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      failedRef.current = true;
      setError(recognitionErrorMessage(event.error));
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      const finalTranscript = transcriptRef.current;
      if (finalTranscript && !submittedRef.current) {
        submittedRef.current = true;
        finalCallbackRef.current?.(finalTranscript);
      } else if (!finalTranscript && !failedRef.current) {
        setError('No speech was detected. Move closer to the microphone and try again.');
      }
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError('Speech recognition is already busy. Wait a moment and try again.');
    }
  }, []);

  return { supported, listening, transcript, error, start, stop, clear };
}
