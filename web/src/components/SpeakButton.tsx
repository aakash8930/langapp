import { useEffect, useRef, useState } from 'react';

import { audioUrlForVocab } from '../audio';

/**
 * Plays a word aloud.
 *
 * ## Failure is silence, not an error
 *
 * A word whose audio has not been generated yet 404s, and the API being asleep
 * fails the same way. Neither is worth an error banner in the middle of a quiz:
 * the button supplements a written word that is already on screen, so a dead
 * press costs the learner nothing. The button marks itself unavailable and
 * stops offering — quieter than a message, and it stops a second press
 * producing the same nothing.
 *
 * ## One element per button, created once
 *
 * `new Audio(url)` rather than a rendered `<audio>` tag: nothing here needs
 * controls, and a hidden media element in the markup is a thing screen readers
 * and browser media sessions can find. The element is reused so a rapid second
 * press replays from the start rather than layering a second voice over the
 * first.
 */
export function SpeakButton({
  vocabId,
  label = 'Play',
  speed = 1,
}: {
  vocabId: string;
  label?: string;
  /** The learner's `settings.audioSpeed`, 0.5–2.0. */
  speed?: number;
}) {
  const elementRef = useRef<HTMLAudioElement | null>(null);
  const [dead, setDead] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Rebuild when the word changes — the same button instance is reused as the
  // quiz moves from question to question.
  useEffect(() => {
    const element = new Audio(audioUrlForVocab(vocabId));
    element.preload = 'none';
    elementRef.current = element;
    setDead(false);
    setPlaying(false);

    const onEnded = () => setPlaying(false);
    const onError = () => {
      setDead(true);
      setPlaying(false);
    };
    element.addEventListener('ended', onEnded);
    element.addEventListener('error', onError);

    return () => {
      element.removeEventListener('ended', onEnded);
      element.removeEventListener('error', onError);
      element.pause();
      elementRef.current = null;
    };
  }, [vocabId]);

  useEffect(() => {
    if (elementRef.current) elementRef.current.playbackRate = speed;
  }, [speed, vocabId]);

  function play() {
    const element = elementRef.current;
    if (!element || dead) return;

    // Rewind first: pressing twice should replay from the start, not resume
    // from wherever the previous play ended.
    element.currentTime = 0;
    setPlaying(true);
    void element.play().catch(() => {
      // Autoplay policy or a missing file — both are silence, not an error.
      setDead(true);
      setPlaying(false);
    });
  }

  return (
    <button
      type="button"
      className={`speak${playing ? ' speak-playing' : ''}`}
      onClick={play}
      disabled={dead}
      aria-label={dead ? 'No audio for this word' : 'Play this word'}
      title={dead ? 'No audio for this word' : undefined}
    >
      {/* A text glyph rather than an icon font — one less dependency, and it
          takes the palette colour, which an emoji speaker would not. */}
      <span aria-hidden="true">{dead ? '×' : '▶'}</span>
      <span>{dead ? 'No audio' : label}</span>
    </button>
  );
}
