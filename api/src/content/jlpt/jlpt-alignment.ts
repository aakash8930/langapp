/**
 * Official JLPT test structure, timing and scoring, sourced directly from
 * jlpt.jp (Japan Foundation / Japan Educational Exchanges and Services) and
 * cross-checked field by field rather than copied from a secondary list.
 *
 * This is reference metadata, not app content: nothing here is a question,
 * an answer or a script. It exists so learner-facing surfaces (JLPT
 * dashboards, mock-test timers, section labels) can be built against the
 * real exam shape instead of guessed numbers — see OPEN-ITEMS on the
 * JLPT dashboard/mock-test/results surfaces having shipped as static
 * fixtures with no source citation.
 *
 * REVIEW STATUS: sourced 2026-08-13 via automated page fetches of the pages
 * listed in `sources` below. `timing`, `scoring` and the sample-question
 * file paths are high-confidence — each number appears in a dedicated table
 * on jlpt.jp and was cross-read against the FAQ page independently.
 * `competency` text is a paraphrase of jlpt.jp/e/about/levelsummary.html,
 * not a verbatim capture, and should get one human read against that page
 * before being shown to a learner as a quotation. The fine-grained item-type
 * taxonomy per section (e.g. "kanji reading", "paraphrase", "text grammar")
 * is deliberately NOT included here: the site's own N1–N5 sample-question
 * pages are JS-driven pop-ups that couldn't be captured by an automated
 * fetch, and this file will not repeat that taxonomy from memory or a
 * secondary source per the standing rule to not import unsourced JLPT data.
 * Fill `itemTypes` in from the official PDF booklets in `sampleQuestions`
 * below (open each PDF, read the section headers, cite the page) rather
 * than from a web search.
 *
 * Copyright note: only structural facts (timing, scoring, level
 * descriptions) and *links* to the official PDFs are stored here. No
 * question text, passage, or audio content is reproduced — the PDFs and
 * MP3s stay on jlpt.jp and are linked, not mirrored.
 */

import { JlptLevel } from '../schemas/vocab-item.schema';

/** A block of the exam as it is actually administered and timed. */
export interface JlptTimedSection {
  /** Name as printed on the official timing table. */
  name: string;
  minutes: number;
}

/**
 * A block as it is *scored*. This does not always match `timing` 1:1 — N3
 * times "Vocabulary" and "Grammar & Reading" as two separate blocks but
 * N4/N5 additionally *score* Language Knowledge and Reading as one combined
 * scaled score. Keeping timing and scoring as separate lists is intentional;
 * collapsing them was the mistake generic summaries of the JLPT make.
 */
export interface JlptScoredSection {
  name: string;
  sectionalPassMark: number;
}

export interface JlptSampleQuestionSet {
  /** Test items (the question booklet itself), PDF. */
  testItems: string;
  /** Blank answer sheet, PDF. */
  answerSheet: string;
  /** Listening script transcript, PDF. N/A is omitted. */
  listeningScript?: string;
  /** Answer key, PDF. */
  answerKey: string;
  /** Listening sample audio, MP3. */
  listeningAudio: string;
}

export interface JlptLevelAlignment {
  level: JlptLevel;

  /** Paraphrased from jlpt.jp/e/about/levelsummary.html — see file header. */
  competency: {
    reading: string;
    listening: string;
  };

  /** Administered/timed blocks, in order, from jlpt.jp/e/guideline/testsections.html. */
  timing: JlptTimedSection[];
  totalMinutes: number;

  scoring: {
    /** Every level scores 0–180 total regardless of section count. */
    totalScoreRange: [number, number];
    overallPassMark: number;
    sections: JlptScoredSection[];
  };

  /** 2009 "New JLPT" official sample question set — jlpt.jp/e/samples/sample09.html. */
  sampleQuestions: JlptSampleQuestionSet;

  /**
   * Per-section item types (e.g. "kanji reading", "paraphrase", "text
   * grammar", "information retrieval"). Intentionally empty — see file
   * header. Populate by reading `sampleQuestions.testItems` for this level
   * and citing the page/section, not from a generic list.
   */
  itemTypes: Record<string, string[]>;
}

const SAMPLE_09_BASE = 'https://www.jlpt.jp/e/samples';
const sample09 = (level: JlptLevel): JlptSampleQuestionSet => ({
  testItems: `${SAMPLE_09_BASE}/pdf/${level}-mondai.pdf`,
  answerSheet: `${SAMPLE_09_BASE}/pdf/${level}-kaitou.pdf`,
  listeningScript: `${SAMPLE_09_BASE}/pdf/${level}-script.pdf`,
  answerKey: `${SAMPLE_09_BASE}/pdf/${level}-seikai.pdf`,
  listeningAudio: `${SAMPLE_09_BASE}/mp3/${level}Sample.mp3`,
});

export const JLPT_ALIGNMENT: Record<JlptLevel, JlptLevelAlignment> = {
  N1: {
    level: 'N1',
    competency: {
      reading: 'Can read logically complex and abstract writing on a range of topics, such as editorials and critiques, understand both the structure and the content, and comprehend the writer’s intent.',
      listening: 'Can comprehend orally, at natural speed, coherent conversations, news reports and lectures, and follow their ideas, logical structure and essential points.',
    },
    timing: [
      { name: 'Language Knowledge (Vocabulary/Grammar) / Reading', minutes: 110 },
      { name: 'Listening', minutes: 55 },
    ],
    totalMinutes: 165,
    scoring: {
      totalScoreRange: [0, 180],
      overallPassMark: 100,
      sections: [
        { name: 'Language Knowledge (Vocabulary/Grammar)', sectionalPassMark: 19 },
        { name: 'Reading', sectionalPassMark: 19 },
        { name: 'Listening', sectionalPassMark: 19 },
      ],
    },
    sampleQuestions: sample09('N1'),
    itemTypes: {},
  },
  N2: {
    level: 'N2',
    competency: {
      reading: 'Can read clearly written material on a range of topics, such as newspaper articles and simple critiques, and understand narrative content and the writer’s intent on general subjects.',
      listening: 'Can comprehend, at near-natural speed, coherent conversations and news reports in everyday settings and a range of other situations, and follow their ideas and relationships among speakers.',
    },
    timing: [
      { name: 'Language Knowledge (Vocabulary/Grammar) / Reading', minutes: 105 },
      { name: 'Listening', minutes: 50 },
    ],
    totalMinutes: 155,
    scoring: {
      totalScoreRange: [0, 180],
      overallPassMark: 90,
      sections: [
        { name: 'Language Knowledge (Vocabulary/Grammar)', sectionalPassMark: 19 },
        { name: 'Reading', sectionalPassMark: 19 },
        { name: 'Listening', sectionalPassMark: 19 },
      ],
    },
    sampleQuestions: sample09('N2'),
    itemTypes: {},
  },
  N3: {
    level: 'N3',
    competency: {
      reading: 'Can read and understand everyday material with specific content, grasp summary information such as headlines, and follow slightly difficult writing when an alternative phrasing is provided.',
      listening: 'Can listen to and comprehend, at near-natural speed, coherent conversations in everyday situations, and generally follow their content and the relationships among the people speaking.',
    },
    timing: [
      { name: 'Language Knowledge (Vocabulary)', minutes: 30 },
      { name: 'Language Knowledge (Grammar) / Reading', minutes: 70 },
      { name: 'Listening', minutes: 40 },
    ],
    totalMinutes: 140,
    scoring: {
      totalScoreRange: [0, 180],
      overallPassMark: 95,
      sections: [
        { name: 'Language Knowledge (Vocabulary/Grammar)', sectionalPassMark: 19 },
        { name: 'Reading', sectionalPassMark: 19 },
        { name: 'Listening', sectionalPassMark: 19 },
      ],
    },
    sampleQuestions: sample09('N3'),
    itemTypes: {},
  },
  N4: {
    level: 'N4',
    competency: {
      reading: 'Can read and understand passages on familiar daily topics written in basic vocabulary and kanji.',
      listening: 'Can comprehend conversations encountered in daily life, when spoken slowly, and generally follow their content.',
    },
    timing: [
      { name: 'Language Knowledge (Vocabulary)', minutes: 25 },
      { name: 'Language Knowledge (Grammar) / Reading', minutes: 55 },
      { name: 'Listening', minutes: 35 },
    ],
    totalMinutes: 115,
    scoring: {
      totalScoreRange: [0, 180],
      overallPassMark: 90,
      sections: [
        { name: 'Language Knowledge (Vocabulary/Grammar) / Reading', sectionalPassMark: 38 },
        { name: 'Listening', sectionalPassMark: 19 },
      ],
    },
    sampleQuestions: sample09('N4'),
    itemTypes: {},
  },
  N5: {
    level: 'N5',
    competency: {
      reading: 'Can read and understand typical expressions and sentences written in hiragana, katakana and basic kanji.',
      listening: 'Can listen and pick up necessary information from short conversations spoken slowly, about familiar daily and classroom topics.',
    },
    timing: [
      { name: 'Language Knowledge (Vocabulary)', minutes: 20 },
      { name: 'Language Knowledge (Grammar) / Reading', minutes: 40 },
      { name: 'Listening', minutes: 30 },
    ],
    totalMinutes: 90,
    scoring: {
      totalScoreRange: [0, 180],
      overallPassMark: 80,
      sections: [
        { name: 'Language Knowledge (Vocabulary/Grammar) / Reading', sectionalPassMark: 38 },
        { name: 'Listening', sectionalPassMark: 19 },
      ],
    },
    sampleQuestions: sample09('N5'),
    itemTypes: {},
  },
};

/**
 * A test passes only when the total score clears `overallPassMark` AND every
 * scored section individually clears its own `sectionalPassMark` — scoring
 * high overall cannot offset a weak section. Source: jlpt.jp/e/faq/.
 */
export function isJlptPassing(
  level: JlptLevel,
  totalScore: number,
  sectionScores: Record<string, number>,
): boolean {
  const alignment = JLPT_ALIGNMENT[level];
  if (totalScore < alignment.scoring.overallPassMark) return false;
  return alignment.scoring.sections.every(
    (section) => (sectionScores[section.name] ?? 0) >= section.sectionalPassMark,
  );
}

/**
 * Sources fetched directly for this file — re-check these, not a search
 * result, if a number here is ever in doubt:
 * - https://www.jlpt.jp/e/about/levelsummary.html (competency text)
 * - https://www.jlpt.jp/e/guideline/testsections.html (timing)
 * - https://www.jlpt.jp/e/faq/ (scoring, pass marks)
 * - https://www.jlpt.jp/e/samples/forlearners.html (sample question index)
 * - https://www.jlpt.jp/e/samples/sample09.html (sample PDF/MP3 links)
 */
export const JLPT_ALIGNMENT_SOURCES = [
  'https://www.jlpt.jp/e/about/levelsummary.html',
  'https://www.jlpt.jp/e/guideline/testsections.html',
  'https://www.jlpt.jp/e/faq/',
  'https://www.jlpt.jp/e/samples/forlearners.html',
  'https://www.jlpt.jp/e/samples/sample09.html',
] as const;

export const JLPT_ALIGNMENT_VERIFIED_AT = '2026-08-13';
