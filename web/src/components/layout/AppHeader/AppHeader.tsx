import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '../../../useSession';
import { CommandPalette } from '../CommandPalette';
import { Icon } from '../../ui/Icon';
import { fetchUnreadCount, type UnreadCountResponse } from '../../../api';
import { queryKeys } from '../../../queryKeys';

import './AppHeader.css';

/**
 * The browser clock is deliberate: the greeting describes where the learner
 * is sitting, while server-counted streaks and goals use the account timezone.
 */
function greeting(hour: number): string {
  if (hour < 11) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** First letters of the display name, for the avatar. Two at most. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => [...part][0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * The top bar: who you are and where you're going.
 *
 * Two things from the design are missing, both for the same reason. There is no
 * **notification bell** — nothing on the API produces notifications, so the
 * badge would be decoration with a number on it. There is no **Upgrade to
 * Premium** button — there are no plans, no entitlements and no billing; a
 * button that opens nothing is worse than a header with one fewer control.
 *
 * The search field is real, and is why `CommandPalette` exists: it searches the
 * lesson catalog the dashboard has already cached, plus every navigable
 * destination. It was that or a decorative input, and a decorative input in the
 * most inviting spot on the page is a small betrayal.
 *
 * **The greeting is only on the dashboard.** It belongs to `/` in the design,
 * and the shell renders on every screen — so left unconditional it greeted the
 * learner again above the Courses page's own title, and again above the review
 * session. The empty `div` stays either way: it is the flex spacer that keeps
 * the tools on the right, and dropping it moves them to the left edge on every
 * other route.
 */
export function Header() {
  const { session, signOut } = useSession();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const router = useRouter();

  const { data: unreadData } = useQuery<UnreadCountResponse>({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
    enabled: session.state === 'signedIn',
  });

  const name = session.state === 'signedIn' ? session.user.profile.displayName : null;
  const hello = greeting(new Date().getHours());

  const onDashboard = useRouterState({ select: (state) => state.location.pathname === '/' });

  const unreadCount = unreadData?.count ?? 0;

  return (
    <header className="app-header">
      <div className="app-header-greeting">
        {!onDashboard ? null : name ? (
          <>
            <h1 className="app-header-hello">
              <span>{hello}, </span>
              <span className="app-header-name">{name}!</span>{' '}
              <span aria-hidden="true">👋</span>
            </h1>
            <p className="app-header-sub">
              <span className="app-header-proverb-ja ja">小さな一歩が、大きな未来をつくる。</span>
              <span>Small steps every day lead to big results.</span>
            </p>
          </>
        ) : (
          <>
            <h1 className="app-header-hello">Welcome to GENKŌ</h1>
            <p className="app-header-sub">Sign in to pick up where you left off.</p>
          </>
        )}
      </div>

      <div className="app-header-tools">
        {/*
          A button, not an input. It opens a dialog that owns the real field —
          two focusable text boxes for one search is the thing that makes
          command palettes feel broken, and the shortcut hint belongs on the
          trigger rather than inside the box it opens.
        */}
        <button
          type="button"
          className="app-search"
          onClick={() => setPaletteOpen(true)}
          aria-haspopup="dialog"
          // Named explicitly because the visible label is `display: none` on a
          // narrow screen, which takes it out of the accessibility tree as well
          // as off the screen — leaving a button whose only content is an
          // `aria-hidden` icon.
          aria-label="Search"
        >
          <Icon name="search" size={16} />
          <span className="app-search-label">Search</span>
          <kbd className="app-search-kbd">⌘K</kbd>
        </button>

        {session.state === 'signedIn' && session.progress ? (
          <span className="app-header-streak tabular" title="Current learning streak">
            <Icon name="flame" size={18} />
            {session.progress.streakDays}
          </span>
        ) : null}

        {session.state === 'signedIn' && (
          <button
            type="button"
            className="notif-btn"
            onClick={() => router.navigate({ to: '/notifications' })}
            aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ''}`}
          >
            <Icon name="bell" size={20} />
            {unreadCount > 0 && (
              <span className="notif-badge" aria-hidden="true">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {session.state === 'signedIn' ? (
          <details className="app-user-menu">
            <summary className="app-user-menu-trigger" aria-label="Open account menu">
              <span className="app-avatar" aria-hidden="true">
                {initials(session.user.profile.displayName)}
              </span>
              <Icon name="chevron-down" size={15} />
            </summary>
            <div className="app-user-menu-popover">
              <p>
                <strong>{session.user.profile.displayName}</strong>
                <span>{session.user.email}</span>
              </p>
              <Link to="/profile">Profile</Link>
              <Link to="/settings">Settings</Link>
              <button type="button" onClick={signOut}>Sign out</button>
            </div>
          </details>
        ) : (
          // Signed out, `/` *is* the sign-in screen — so this is a real
          // destination rather than a modal that has to be built.
          <Link className="btn btn-primary btn-sm" to="/">
            Sign in
          </Link>
        )}
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}
