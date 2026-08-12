import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { sidebarGroups } from '../../../constants/navigation';
import type { SidebarItem, SidebarProps } from '../../../types/layout';
import { useSession } from '../../../useSession';
import { Icon } from '../../ui/Icon';

import './Sidebar.css';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * The primary navigation.
 *
 * ## The badge is the due count, and it is the only live number here
 *
 * `progress.cardsDueNow` is a real figure the API sends, and it belongs on the
 * Review row for the same reason the due callout out-shouts everything else on
 * the old home page: SRS only works if due cards get cleared before new
 * material is added. It is the one counter in the design the server can answer.
 *
 * The notification bell's "3" from the design has no endpoint behind it — there
 * is no notifications API — so there is no bell. A badge that invents a number
 * is worse than an absent one, and this project has already written that rule
 * down twice (see the reward layer in CLAUDE.md).
 *
 * ## Planned rows are inert, and say why
 *
 * Fifteen of the twenty-four rows lead nowhere yet. They render as `<span>`
 * rather than `<Link>` — not a disabled anchor, which is still focusable and
 * still announced as a link — carry a lock glyph, and get `aria-disabled` for
 * anything reading the tree. The type in `types/layout/sidebar.ts` is what
 * guarantees one cannot quietly acquire an `href`.
 */
export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { session } = useSession();

  const progress = session.state === 'signedIn' ? session.progress : null;
  const isAdmin = session.state === 'signedIn' && session.user.isAdmin === true;
  const due = progress?.cardsDueNow ?? 0;
  const [openGroups, setOpenGroups] = useState(
    () => new Set(sidebarGroups.filter((group) => group.title).map((group) => group.id)),
  );

  return (
    <aside className={`app-sidebar${collapsed ? ' app-sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <Link className="sidebar-mark" to="/" aria-label="GENKŌ — dashboard">
          <span className="sidebar-mark-glyph" aria-hidden="true">✿</span>
          <span className="sidebar-mark-copy">
            <span className="sidebar-mark-word">GENKŌ</span>
            <small>Learn. Practice. Master.</small>
          </span>
        </Link>

        {/*
          The toggle is an icon alone, so it carries a label — `Icon` only sets
          `aria-hidden` when there isn't one. `aria-expanded` describes the
          sidebar rather than the button, which is what a screen reader user
          needs to know before deciding to press it.
        */}
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <Icon name="menu" size={18} />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        {sidebarGroups.map((group) => {
          const items = group.items.filter(
            (item) => !(item.kind === 'link' && item.adminOnly === true && !isAdmin),
          );
          if (items.length === 0) return null;

          const list = (
            <ul className="sidebar-list" aria-label={group.title}>
              {items.map((item) => (
                <li key={item.id}>
                  <Row item={item} due={due} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          );

          if (!group.title || collapsed) {
            return <div className="sidebar-group" key={group.id}>{list}</div>;
          }

          return (
            <details
              className="sidebar-group sidebar-dropdown"
              key={group.id}
              open={openGroups.has(group.id)}
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setOpenGroups((current) => {
                  if (current.has(group.id) === isOpen) return current;
                  const next = new Set(current);
                  if (isOpen) next.add(group.id);
                  else next.delete(group.id);
                  return next;
                });
              }}
            >
              <summary className="sidebar-group-title">
                <span>{group.title}</span>
                <Icon name="chevron-down" size={13} className="sidebar-group-chevron" />
              </summary>
              {list}
            </details>
          );
        })}
      </nav>

      {session.state === 'signedIn' ? (
        <Link className="sidebar-profile" to="/profile">
          <span className="sidebar-profile-avatar" aria-hidden="true">
            {initials(session.user.profile.displayName)}
          </span>
          {collapsed ? null : (
            <span className="sidebar-profile-copy">
              <strong>{session.user.profile.displayName}</strong>
              <small>Level {progress?.level ?? 1}</small>
            </span>
          )}
          {collapsed ? null : <Icon name="chevron-right" size={15} />}
        </Link>
      ) : null}
    </aside>
  );
}

/**
 * One row. Split out because the link and non-link branches share their whole
 * inside and none of their outside — the shape that argues for a component
 * rather than a ternary in the middle of the list.
 */
function Row({ item, due, collapsed }: { item: SidebarItem; due: number; collapsed: boolean }) {
  const glyph = item.glyph ? (
    <span className="sidebar-icon sidebar-icon-ja ja" aria-hidden="true">
      {item.glyph}
    </span>
  ) : (
    <span className="sidebar-icon" aria-hidden="true">
      {item.icon ? <Icon name={item.icon} size={18} /> : null}
    </span>
  );

  // Collapsed, the label leaves the view but must stay in the accessibility
  // tree — `title` alone is not a name a screen reader reliably announces.
  const label = collapsed ? (
    <span className="visually-hidden">{item.label}</span>
  ) : (
    <span className="sidebar-label">{item.label}</span>
  );

  if (item.kind === 'planned') {
    return (
      <span
        className="sidebar-item sidebar-item-planned"
        aria-disabled="true"
        title={`${item.label} — not built yet`}
      >
        {glyph}
        {label}
        {collapsed ? null : <Icon name="lock" size={13} className="sidebar-lock" />}
      </span>
    );
  }

  return (
    <Link
      className="sidebar-item"
      to={item.to}
      // Without `exact`, `/` matches every path and the Dashboard row stays lit
      // on every screen in the app.
      activeOptions={item.to === '/' ? { exact: true } : undefined}
      activeProps={{ className: 'sidebar-item sidebar-item-active' }}
      title={collapsed ? item.label : undefined}
    >
      {glyph}
      {label}
      {item.badge === 'due' && due > 0 ? (
        <span className="sidebar-badge tabular">
          {due}
          <span className="visually-hidden"> cards due</span>
        </span>
      ) : null}
    </Link>
  );
}
