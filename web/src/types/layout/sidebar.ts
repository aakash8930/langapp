import type { IconName } from '../../components/ui/Icon';
import type { FileRouteTypes } from '../../routeTree.gen';

/**
 * Every path the router can actually reach, straight from the generated tree.
 *
 * This is the typed half of the rule in CLAUDE.md — "`<Link to>` for every
 * route, never a hand-written `href`". A nav item pointing somewhere that does
 * not exist is a compile error listing the valid paths, which is exactly the
 * check that was missing when the home page's Begin button shipped pointing at
 * `#/learn/<id>`.
 *
 * `routeTree.gen.ts` is generated and gitignored; this is a *type-only* import,
 * so it costs nothing at runtime, and the build already orders `vite build`
 * before `tsc` so the file exists by the time types are checked.
 */
export type RoutePath = FileRouteTypes['to'];

/**
 * A sidebar row. A row either navigates or it does not, and those are two
 * shapes rather than one shape with an optional field.
 *
 * The mock's sidebar has 24 rows; the app has nine routes. Most of that list is
 * a roadmap drawn as a menu — a legitimate thing for a sidebar to be, but only
 * if the rows leading nowhere *say so* rather than silently doing nothing when
 * clicked. So `planned` rows render as disabled text with a lock, leave the tab
 * order, and cannot carry a `to`: the union makes "disabled but navigable"
 * unrepresentable.
 */
export type SidebarItem =
  | {
      kind: 'link';
      id: string;
      label: string;
      /** One of two glyph forms — a lucide name, or a kana/kanji character. */
      icon?: IconName;
      glyph?: string;
      to: RoutePath;
      /** Rows only shown to admins. Everything else renders for everyone. */
      adminOnly?: boolean;
    }
  | {
      kind: 'planned';
      id: string;
      label: string;
      icon?: IconName;
      glyph?: string;
    };

/** A titled run of rows. An untitled group is the ungrouped block up top. */
export interface SidebarGroup {
  id: string;
  /** Rendered as the small-caps heading. Omitted for the first block. */
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}
