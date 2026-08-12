import { useLocation } from '@tanstack/react-router';
import { useState } from 'react';

import type { AppShellProps } from '../../../types/layout';

import { Header } from '../AppHeader';
import { Sidebar } from '../Sidebar';
import { Main } from '../Main';
import { Footer } from '../Footer';

import { useSession } from '../../../useSession';
import './AppShell.css';

/**
 * The persistent frame: a header, the routed screen and the footer, with a
 * sidebar that only appears for signed-in users.
 *
 * ## One boolean drives two behaviours, on purpose
 *
 * `collapsed` means "narrow" on a desktop — a 76px icon rail — and "out of the
 * way" on a phone, where the expanded sidebar becomes an overlay instead of
 * taking most of the screen. Both are the same intent ("make the nav smaller /
 * bigger"), and splitting them into two pieces of state means keeping them in
 * sync, which is a bug waiting to be written.
 *
 * The initial value is read from the viewport once, so a phone opens with the
 * rail and a laptop opens with the full menu. It is deliberately *not* kept in
 * sync with resizes: after the first interaction the value is the learner's
 * choice, and a window resize silently overwriting it is worse than a stale
 * default.
 *
 * **The sidebar is gated on login.** Signed-out visitors are on the shop window
 * — the hero and sign-in form on `/` — and have no need of a full navigation
 * rail. The sidebar renders only during `loading` (the brief window while `/me`
 * resolves for a returning user) and `signedIn`, so a returning learner never
 * sees it flicker out and back in. `Header` and `Footer` stay on every route
 * regardless: the header carries the sign-in button, and the footer is the
 * product tag.
 */
export function AppShell({ children }: AppShellProps) {
  const { session } = useSession();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches,
  );

  const showSidebar = session.state !== 'signedOut';

  return (
    <div
      className={`app-shell${!showSidebar ? ' app-shell-no-sidebar' : ''}${showSidebar && collapsed ? ' app-shell-railed' : ''}`}
    >
      {showSidebar ? (
        <>
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} />

          {/*
            The scrim is always in the tree and hidden by CSS above 860px, rather
            than rendered conditionally off a matchMedia result. A media query the
            browser already evaluates does not need a JS listener duplicating it,
            and the duplicate is the copy that goes stale.

            It leaves the tab order while the sidebar is railed, because a
            zero-sized button that closes something already closed is a tab stop
            that does nothing.
          */}
          <button
            type="button"
            className="app-scrim"
            tabIndex={collapsed ? -1 : undefined}
            aria-label="Close navigation"
            onClick={() => setCollapsed(true)}
          />
        </>
      ) : null}

      <div className="app-shell-column">
        <Header />

        <Main>{children}</Main>

        {location.pathname === '/' ? null : <Footer />}
      </div>
    </div>
  );
}
