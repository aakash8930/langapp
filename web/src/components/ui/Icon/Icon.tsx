import {
  ArrowRight,
  AudioLines,
  Award,
  Bell,
  Bot,
  Brain,
  BookMarked,
  BookOpen,
  CalendarDays,
  Captions,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  ChevronRight,
  Crown,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  Flame,
  GraduationCap,
  Info,
  Grid2x2,
  Headphones,
  History,
  Home,
  Languages,
  Layers,
  Library,
  Lock,
  Medal,
  Menu,
  MessageCircle,
  Mic,
  Newspaper,
  PanelsTopLeft,
  Pause,
  PenSquare,
  PenTool,
  Play,
  Radio,
  Repeat,
  RefreshCw,
  ScrollText,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  TrendingUp,
  Trash2,
  Trophy,
  Users,
  UsersRound,
  Volume2,
  Wand2,
  WifiOff,
  X,
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
  'arrow-right': ArrowRight,
  'audio-lines': AudioLines,
  award: Award,
  bell: Bell,
  bot: Bot,
  brain: Brain,
  'book-marked': BookMarked,
  'book-open': BookOpen,
  calendar: CalendarDays,
  captions: Captions,
  check: Check,
  'check-circle-2': CheckCircle2,
  'chevron-down': ChevronDown,
  'circle-alert': CircleAlert,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  crown: Crown,
  download: Download,
  ellipsis: Ellipsis,
  eye: Eye,
  'eye-off': EyeOff,
  flame: Flame,
  'graduation-cap': GraduationCap,
  grid: Grid2x2,
  info: Info,
  headphones: Headphones,
  history: History,
  home: Home,
  languages: Languages,
  layers: Layers,
  library: Library,
  lock: Lock,
  medal: Medal,
  menu: Menu,
  'message-circle': MessageCircle,
  mic: Mic,
  newspaper: Newspaper,
  'panels-top-left': PanelsTopLeft,
  pause: Pause,
  'pen-square': PenSquare,
  'pen-tool': PenTool,
  play: Play,
  radio: Radio,
  repeat: Repeat,
  'refresh-cw': RefreshCw,
  'scroll-text': ScrollText,
  search: Search,
  send: Send,
  settings: Settings,
  shield: Shield,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  square: Square,
  star: Star,
  'trending-up': TrendingUp,
  trash: Trash2,
  trophy: Trophy,
  users: Users,
  'users-round': UsersRound,
  'volume-2': Volume2,
  'wand-2': Wand2,
  'wifi-off': WifiOff,
  x: X,
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
