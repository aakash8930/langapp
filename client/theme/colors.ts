/**
 * Palette — cool paper, not warm cream.
 *
 * Dark mode is a first-class ground, not a dimmed copy of light. Vermilion and
 * indigo are re-mixed for the ink ground rather than reused: the light-mode
 * values glow against #141310.
 */

/**
 * The four FSRS grades rendered as a single ramp of ink density rather than
 * four separate hues. Visual weight maps to how hard the card was: `again` is
 * heavy saturated vermilion-black, `easy` is a pale wash.
 *
 * This is the one place the design is allowed to be bold. Tokens live here so
 * the review screen renders the ramp instead of inventing its own colours.
 */
export type GradeStep = {
  /** Cell fill. */
  bg: string;
  /** Label colour that stays legible on `bg`. */
  fg: string;
};

export type GradeScale = {
  again: GradeStep;
  hard: GradeStep;
  good: GradeStep;
  easy: GradeStep;
};

export type Palette = {
  /** App background. */
  paper: string;
  /** Cards and raised regions. */
  surface: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  inkSoft: string;
  /** 1px borders. The only permitted separation device — no shadows. */
  hairline: string;
  /** Vermilion: genkouyoushi grid cells, active state, streak. */
  shu: string;
  /** Indigo: secondary actions, info. */
  ai: string;
  /** Errors. A deeper, browner red so it is not mistaken for `shu`. */
  danger: string;
  gradeScale: GradeScale;
};

export const lightPalette: Palette = {
  paper: '#F2F1EC',
  surface: '#FFFFFF',
  ink: '#1A1917',
  inkSoft: '#56534B',
  hairline: '#DEDCD3',
  // Darkened from #C8452C on 2026-07-19. The original scored 4.28 against
  // `paper` — under WCAG AA's 4.5 for body text, which this is: "Correct" in
  // the lesson feedback, the XP figure in a summary, and the review callout's
  // 22pt title all set `shu` on paper or `paper` on shu. This value clears 4.5
  // on both grounds while staying the same vermilion.
  shu: '#BC3E28',
  ai: '#35566B',
  danger: '#8C2F1C',
  gradeScale: {
    again: { bg: '#7B2114', fg: '#F7EFEA' },
    hard: { bg: '#B03B25', fg: '#F7EFEA' },
    good: { bg: '#DD9384', fg: '#3A1009' },
    easy: { bg: '#F0D2CA', fg: '#3A1009' },
  },
};

export const darkPalette: Palette = {
  paper: '#141310',
  surface: '#1D1C18',
  ink: '#EDEAE0',
  inkSoft: '#A8A296',
  hairline: '#2E2C26',
  // Pulled off full saturation so they sit in the page rather than glowing.
  shu: '#D0614A',
  ai: '#6D91A6',
  danger: '#D2705A',
  // On an ink ground the ramp runs the other way: `again` is the brightest,
  // `easy` recedes almost to the surface colour. Density still maps to effort.
  gradeScale: {
    again: { bg: '#C0442B', fg: '#F7EFEA' },
    hard: { bg: '#8E3623', fg: '#F7EFEA' },
    good: { bg: '#5A2519', fg: '#E8C4B8' },
    easy: { bg: '#38201A', fg: '#E8C4B8' },
  },
};
