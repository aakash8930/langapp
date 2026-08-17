/**
 * Palette — cool paper, not warm cream.
 *
 * Dark mode is a first-class ground, not a dimmed copy of light. Vermilion and
 * indigo are re-mixed for the ink ground rather than reused: the light-mode
 * values glow against #141310.
 */

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
};

export const lightPalette: Palette = {
  paper: '#F2F1EC',
  surface: '#FFFFFF',
  ink: '#1A1917',
  inkSoft: '#56534B',
  hairline: '#DEDCD3',
  // Darkened from #C8452C on 2026-07-19. The original scored 4.28 against
  // `paper` — under WCAG AA's 4.5 for body text, which this is: "Correct" in
  // the lesson feedback, the XP figure in a summary, and prominent callouts
  // set `shu` on paper or `paper` on shu. This value clears 4.5
  // on both grounds while staying the same vermilion.
  shu: '#BC3E28',
  ai: '#35566B',
  danger: '#8C2F1C',
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
};
