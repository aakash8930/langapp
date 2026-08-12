export type WritingLevel = 'N5' | 'N4' | 'N3';
export type WritingPromptKind = 'practice' | 'essay';

export type WritingPrompt = {
  id: string;
  kind: WritingPromptKind;
  level: WritingLevel;
  topic: string;
  title: string;
  japanese: string;
  guidance: string;
  suggestedLemmas: string[];
  grammarForms: string[];
  recommendedCharacters?: { min: number; max: number };
};

/**
 * Authored prompts supplied in the Writing product brief. Vocabulary and
 * grammar suggestions are resolved against the live course corpus rather than
 * copied into these records as pretend course content.
 */
export const WRITING_PROMPTS: WritingPrompt[] = [
  {
    id: 'family-n5',
    kind: 'practice',
    level: 'N5',
    topic: 'Family',
    title: 'Introduce your family',
    japanese: 'あなたの家族について書いてください。',
    guidance: 'Write a few simple sentences about the people in your family.',
    suggestedLemmas: ['家族', 'かぞく', '父', 'ちち', '母', 'はは', '兄', '姉', '弟', '妹'],
    grammarForms: ['は', 'です', 'の', 'も'],
  },
  {
    id: 'yesterday-n4',
    kind: 'practice',
    level: 'N4',
    topic: 'Daily life',
    title: 'What did you do yesterday?',
    japanese: '昨日何をしましたか。',
    guidance: 'Describe one or more things you did yesterday.',
    suggestedLemmas: ['昨日', 'きのう', '何', 'なに', '見る', 'みる', '食べる', 'たべる', '行く', 'いく'],
    grammarForms: ['ました', 'を', 'で', 'に'],
  },
  {
    id: 'japan-place-n3',
    kind: 'practice',
    level: 'N3',
    topic: 'Places',
    title: 'A place to live in Japan',
    japanese: '日本で住みたい場所について書いてください。',
    guidance: 'Name the place and explain why you would like to live there.',
    suggestedLemmas: ['日本', 'にほん', '場所', 'ばしょ', '住む', 'すむ', '好き', 'すき', '東京', 'とうきょう'],
    grammarForms: ['は', 'で', 'に', 'の'],
  },
  {
    id: 'family-essay-n5',
    kind: 'essay',
    level: 'N5',
    topic: 'Family',
    title: 'My family',
    japanese: 'あなたの家族について書いてください。',
    guidance: 'Develop a longer introduction to your family using simple connected sentences.',
    suggestedLemmas: ['家族', 'かぞく', '父', 'ちち', '母', 'はは', '兄', '姉', '弟', '妹'],
    grammarForms: ['は', 'です', 'の', 'も'],
  },
  {
    id: 'yesterday-essay-n4',
    kind: 'essay',
    level: 'N4',
    topic: 'Daily life',
    title: 'Yesterday',
    japanese: '昨日何をしましたか。',
    guidance: 'Write a connected account of what you did and where those actions happened.',
    suggestedLemmas: ['昨日', 'きのう', '何', 'なに', '見る', 'みる', '食べる', 'たべる', '行く', 'いく'],
    grammarForms: ['ました', 'を', 'で', 'に'],
  },
  {
    id: 'japan-place-essay-n3',
    kind: 'essay',
    level: 'N3',
    topic: 'Places',
    title: 'Where I would live in Japan',
    japanese: '日本で住みたい場所について書いてください。',
    guidance: 'Explain your choice, what attracts you to the place, and what daily life might be like.',
    suggestedLemmas: ['日本', 'にほん', '場所', 'ばしょ', '住む', 'すむ', '好き', 'すき', '東京', 'とうきょう'],
    grammarForms: ['は', 'で', 'に', 'の'],
  },
  {
    id: 'favorite-place-essay-n4',
    kind: 'essay',
    level: 'N4',
    topic: 'Places',
    title: 'My favorite place',
    japanese: '私の好きな場所',
    guidance: 'Describe the place, what you do there, and why it matters to you.',
    suggestedLemmas: ['私', 'わたし', '好き', 'すき', '場所', 'ばしょ', '行く', 'いく'],
    grammarForms: ['は', 'です', 'で', 'に', 'の'],
    recommendedCharacters: { min: 150, max: 250 },
  },
];

export function promptById(id: string | undefined): WritingPrompt | undefined {
  return id ? WRITING_PROMPTS.find((prompt) => prompt.id === id) : undefined;
}
