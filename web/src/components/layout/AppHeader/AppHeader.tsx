import { Link, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';

import { useSession } from '../../../useSession';
import { CommandPalette } from '../CommandPalette';
import { Icon } from '../../ui/Icon';

import './AppHeader.css';

/**
 * Time-of-day greeting, in Japanese, because the product is.
 *
 * The boundaries are the conventional ones — おはようございます until 11,
 * こんにちは until 18, こんばんは after — and they read off the *browser's*
 * clock rather than `settings.tz`. That is deliberate: the greeting describes
 * where the learner is sitting right now, and a traveller whose account still
 * says Asia/Kolkata should still be told good evening when it is evening.
 *
 * Anything the *server* counts as "today" — the streak, the daily goal — uses
 * the account timezone instead, and that split is why this is a local helper
 * rather than something shared.
 */
function greeting(hour: number): { ja: string; romaji: string } {
  if (hour < 11) return { ja: 'おはようございます', romaji: 'Ohayō gozaimasu' };
  if (hour < 18) return { ja: 'こんにちは', romaji: "Kon'nichiwa" };
  return { ja: 'こんばんは', romaji: 'Konbanwa' };
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

  const name = session.state === 'signedIn' ? session.user.profile.displayName : null;
  const hello = greeting(new Date().getHours());

  const onDashboard = useRouterState({ select: (state) => state.location.pathname === '/' });

  return (
    <header className="app-header">
      <div className="app-header-greeting">
        {!onDashboard ? null : name ? (
          <>
            <h1 className="app-header-hello">
              <span className="ja">{hello.ja}</span>
              <span className="app-header-name">, {name}!</span>{' '}
              <span aria-hidden="true">👋</span>
              {/* The romaji is for the learner who cannot read the greeting
                  yet, which on day one is every learner. */}
              <span className="visually-hidden"> ({hello.romaji})</span>
            </h1>
            <p className="app-header-sub">Let&rsquo;s continue your Japanese learning journey.</p>
          </>
        ) : (
          <>
            <h1 className="app-header-hello">
              <span className="ja">{hello.ja}</span>
            </h1>
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

        {session.state === 'signedIn' ? (
          <div className="app-header-user">
            <span className="app-avatar" aria-hidden="true">
              {initials(session.user.profile.displayName)}
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={signOut}>
              Sign out
            </button>
          </div>
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
