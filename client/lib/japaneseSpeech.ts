import * as Speech from 'expo-speech';

/** Keep the Japanese portion of bilingual tutor replies and discard translations. */
export function japaneseForSpeech(text: string): string {
  return text
    .replace(/[（(][^）)]*[）)]/g, ' ')
    .split('')
    .filter((character) => /[\u3040-\u30ff\u3400-\u9fff々ー。、！？\s]/u.test(character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Device TTS fallback for missing static course audio and spoken tutor replies. */
export function speakJapanese(
  text: string,
  options: { speed?: number; onDone?: () => void; onError?: () => void } = {},
): boolean {
  const japanese = japaneseForSpeech(text);
  if (!japanese) return false;

  void Speech.stop();
  Speech.speak(japanese, {
    language: 'ja-JP',
    rate: Math.min(2, Math.max(0.5, options.speed ?? 1)),
    onDone: options.onDone,
    onStopped: options.onDone,
    onError: options.onError,
  });
  return true;
}

export function stopJapaneseSpeech(): Promise<void> {
  return Speech.stop();
}
