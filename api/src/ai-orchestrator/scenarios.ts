/**
 * §7: "agents" are prompt variants, not services. A scenario is a setting, a
 * scripted opening line, and 5–10 target words to inject into the prompt.
 *
 * The target words are static here rather than retrieved from the
 * KnowledgeGraph (§7 step 2) because the seed contains no vocabulary yet —
 * graph retrieval would return nothing. When a vocab pack lands, replace
 * `targetWords` with a graph lookup and delete this comment.
 */

export interface TargetWord {
  lemma: string;
  reading: string;
  gloss: string;
}

export interface ChatScenario {
  id: string;
  title: string;
  titleJa: string;
  /** One sentence the client can show on the scenario picker. */
  description: string;
  /**
   * Scripted assistant opener, persisted as the session's first message.
   * Costs zero tokens and gives the learner something concrete to answer.
   */
  opening: string;
  /** The scene the model is told to stay inside. */
  setting: string;
  targetWords: TargetWord[];
}

export const DEFAULT_SCENARIO_ID = 'first-meeting';

const SCENARIOS: readonly ChatScenario[] = [
  {
    id: 'first-meeting',
    title: 'First meeting',
    titleJa: 'はじめまして',
    description: 'Introduce yourself at a Tokyo language exchange — names, where you are from, one thing you like.',
    opening:
      'こんにちは！はじめまして。わたしは ゆき です。おなまえは なんですか？ ' +
      '(Konnichiwa! Hajimemashite. Watashi wa Yuki desu. O-namae wa nan desu ka? — ' +
      "Hello! Nice to meet you. I'm Yuki. What's your name?)",
    setting:
      'You are Yuki, a friendly Japanese speaker meeting the learner for the first ' +
      'time at a language exchange in Tokyo. You are introducing yourselves to each ' +
      'other: names, where you are from, and one thing you each like.',
    targetWords: [
      { lemma: 'こんにちは', reading: 'konnichiwa', gloss: 'hello' },
      { lemma: 'はじめまして', reading: 'hajimemashite', gloss: 'nice to meet you' },
      { lemma: 'わたし', reading: 'watashi', gloss: 'I / me' },
      { lemma: 'なまえ', reading: 'namae', gloss: 'name' },
      { lemma: 'です', reading: 'desu', gloss: 'polite "is/am"' },
      { lemma: 'から きました', reading: 'kara kimashita', gloss: 'I come from …' },
      { lemma: 'すき', reading: 'suki', gloss: 'liked / favourite' },
      { lemma: 'よろしく おねがいします', reading: 'yoroshiku onegaishimasu', gloss: 'pleased to meet you' },
    ],
  },
];

export function findScenario(id: string): ChatScenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}

export function listScenarios(): readonly ChatScenario[] {
  return SCENARIOS;
}
