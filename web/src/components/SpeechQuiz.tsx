import { useState, useRef, useEffect } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function SpeechQuiz({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUnsupported(true);
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.lang = 'ja-JP';
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event: any) => {
      let currentTranscript = '';
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentTranscript += event.results[i][0].transcript;
          isFinal = true;
        } else {
          currentTranscript += event.results[i][0].transcript;
        }
      }
      
      setTranscript(currentTranscript);

      if (isFinal) {
        setListening(false);
        // Wait briefly so the user can see what they said before it vanishes/grades
        setTimeout(() => {
          onSubmit(currentTranscript);
        }, 500);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setListening(false);
    };

    recognitionRef.current.onend = () => {
      setListening(false);
    };
  }, [onSubmit]);

  const handleToggle = () => {
    if (disabled || unsupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setListening(true);
      } catch (err) {
        // Handle case where it might already be started
        console.error('Could not start recognition', err);
      }
    }
  };

  if (unsupported) {
    return (
      <div className="speech-quiz-unsupported" style={{ textAlign: 'center', padding: '16px' }}>
        <p>Your browser does not support the Web Speech API.</p>
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>Please use Chrome, Edge, or Safari.</p>
        <button 
          className="btn btn-primary"
          onClick={() => onSubmit('skipped')}
          disabled={disabled}
        >
          Skip Question
        </button>
      </div>
    );
  }

  return (
    <div className="speech-quiz" style={{ textAlign: 'center', margin: '20px 0' }}>
      <div 
        className="transcript-box" 
        style={{ 
          minHeight: '60px', 
          border: '2px dashed var(--hairline)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          backgroundColor: listening ? 'var(--surface)' : 'transparent',
          transition: 'background-color 0.2s'
        }}
      >
        {transcript || <span style={{ color: 'var(--ink-soft)' }}>{listening ? 'Listening...' : 'Tap the microphone and speak Japanese.'}</span>}
      </div>
      <button 
        type="button" 
        className={`btn btn-primary ${listening ? 'listening' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        style={{
          backgroundColor: listening ? 'var(--danger)' : 'var(--brand-primary)',
          transition: 'background-color 0.2s'
        }}
      >
        {listening ? '⏹ Stop' : '🎤 Tap to Speak'}
      </button>
    </div>
  );
}
