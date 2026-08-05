import { Link } from '@tanstack/react-router';

import { sidebarGroups } from '../../../constants/navigation';
import type { SidebarItem, SidebarProps } from '../../../types/layout';
import { useSession } from '../../../useSession';
import { Icon } from '../../ui/Icon';

import './Sidebar.css';

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

  return (
    <aside className={`app-sidebar${collapsed ? ' app-sidebar-collapsed' : ''}`}>
      <div className="sidebar-brand">
        <Link className="sidebar-mark" to="/" aria-label="GENKŌ — dashboard">
          <span className="sidebar-mark-glyph" aria-hidden="true">
            ✿
          </span>
          <span className="sidebar-mark-word">GENKŌ</span>
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

          return (
            <div className="sidebar-group" key={group.id}>
              {group.title ? (
                <p className="sidebar-group-title" id={`nav-${group.id}`}>
                  {group.title}
                </p>
              ) : null}

              <ul
                className="sidebar-list"
                {...(group.title ? { 'aria-labelledby': `nav-${group.id}` } : {})}
              >
                {items.map((item) => (
                  <li key={item.id}>
                    <Row item={item} due={due} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/*
        The design puts an upgrade card here. There is no billing in this
        product — no plans, no entitlements, nothing on the wire to upgrade to —
        so the slot holds the thing a learner actually needs at a glance
        instead: today's goal, straight off `progress.daily`.
      */}
      {progress ? (
        <div className="sidebar-goal glass">
          <p className="sidebar-goal-title">Today&rsquo;s goal</p>
          <p className="sidebar-goal-figure tabular">
            {progress.daily.xpToday} <span>/ {progress.daily.goalXp} XP</span>
          </p>
          <span className="sidebar-goal-bar" aria-hidden="true">
            <span
              className="sidebar-goal-fill"
              style={{ width: `${Math.min(progress.daily.percentOfGoal, 100)}%` }}
            />
          </span>
          <p className="sidebar-goal-note">
            {progress.daily.goalMet ? 'Done for today. Anything more is a bonus.' : 'Keep going.'}
          </p>
        </div>
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
