import {
  Award,
  Bell,
  Bot,
  BookMarked,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  GraduationCap,
  Grid2x2,
  Headphones,
  Home,
  Languages,
  Layers,
  Library,
  Lock,
  Medal,
  Menu,
  Mic,
  PenSquare,
  PenTool,
  Play,
  Repeat,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Users,
  UsersRound,
  Wand2,
  Zap,
  type LucideProps,
} from 'lucide-react';

/**
 * The icon registry.
 *
 * Icons are referenced by a **name string**, not by importing the component at
 * the call site, and that indirection is the point: the navigation model in
 * `constants/navigation/` is plain data, and plain data cannot hold a React
 * component without dragging JSX into a constants file.
 *
 * The trade is that a name is a string, and a string is exactly the kind of
 * thing this project has already been bitten by (see the `href="#/…"` note in
 * CLAUDE.md — `tsc` validates none of it). So the registry is a `const` object
 * and `IconName` is derived from its keys: a nav item naming an icon that does
 * not exist here is a **compile error**, not a blank square at runtime.
 *
 * Add an icon by adding a line. Do not reach for `lucide-react` directly in a
 * component — a second import path is how two sizes and two stroke widths get
 * into the same row.
 */
const icons = {
  award: Award,
  bell: Bell,
  bot: Bot,
  'book-marked': BookMarked,
  'book-open': BookOpen,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  crown: Crown,
  flame: Flame,
  'graduation-cap': GraduationCap,
  grid: Grid2x2,
  headphones: Headphones,
  home: Home,
  languages: Languages,
  layers: Layers,
  library: Library,
  lock: Lock,
  medal: Medal,
  menu: Menu,
  mic: Mic,
  'pen-square': PenSquare,
  'pen-tool': PenTool,
  play: Play,
  repeat: Repeat,
  'refresh-cw': RefreshCw,
  search: Search,
  settings: Settings,
  sparkles: Sparkles,
  star: Star,
  'trending-up': TrendingUp,
  trophy: Trophy,
  users: Users,
  'users-round': UsersRound,
  'wand-2': Wand2,
  zap: Zap,
} as const;

export type IconName = keyof typeof icons;

export type IconProps = Omit<LucideProps, 'ref'> & {
  name: IconName;
  /** Pixel box. 18 is the sidebar/inline size; 20 the header's. */
  size?: number;
};

/**
 * An icon is decoration by default.
 *
 * `aria-hidden` is on unless the caller passes a label, because nearly every
 * icon here sits beside the text it illustrates — announcing "home, Dashboard"
 * is noise. A caller that renders an icon *alone* (the collapse toggle, the
 * notification bell) passes `aria-label` and gets `role="img"` with it.
 *
 * `strokeWidth` is 1.75 rather than lucide's 2: at 18px the default reads heavy
 * next to Inter at 14px, which is the pairing on every sidebar row.
 */
export function Icon({ name, size = 18, strokeWidth = 1.75, ...props }: IconProps) {
  const Glyph = icons[name];
  const labelled = props['aria-label'] !== undefined;

  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={labelled ? undefined : true}
      role={labelled ? 'img' : undefined}
      focusable="false"
      {...props}
    />
  );
}
