import { useEffect, useRef, useState } from 'react';

import { Icon } from '../ui/Icon';

/** Removes the romaji/English parentheticals that the conversation API returns. */
function japaneseForSpeech(text: string): string {
  return text
    .replace(/[（(][^）)]*[）)]/g, ' ')
    .split('')
    .filter((character) => /[\u3040-\u30ff\u3400-\u9fff々ー。、！？\s]/u.test(character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function BrowserVoiceButton({ text, speed = 1 }: { text: string; speed?: number }) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const speechText = japaneseForSpeech(text);
  const supported = typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && 'SpeechSynthesisUtterance' in window
    && speechText.length > 0;

  useEffect(() => () => {
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
  }, []);

  function toggle() {
    if (!supported || failed) return;
    if (playing) {
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
      }
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'ja-JP';
    utterance.rate = speed;
    utterance.onend = () => {
      utteranceRef.current = null;
      setPlaying(false);
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      setPlaying(false);
      setFailed(true);
    };
    utteranceRef.current = utterance;
    setPlaying(true);
    window.speechSynthesis.speak(utterance);
  }

  return <button type="button" className="speaking-voice-button" onClick={toggle} disabled={!supported || failed} aria-label={playing ? 'Stop browser voice' : 'Read Japanese reply aloud'} title={!supported ? 'Japanese browser voice unavailable' : undefined}><Icon name={playing ? 'square' : 'volume-2'} size={14} /> {playing ? 'Stop' : failed ? 'Voice unavailable' : 'Hear reply'}</button>;
}
