import { useState } from 'react';

import type { AppShellProps } from '../../../types/layout';

import { Header } from '../AppHeader';
import { Sidebar } from '../Sidebar';
import { Main } from '../Main';
import { Footer } from '../Footer';

import './AppShell.css';

/**
 * The persistent frame: a full-height sidebar, and a column holding the header,
 * the routed screen and the footer.
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
 * **The sidebar never disappears entirely.** A fully off-canvas sidebar has to
 * put its own toggle somewhere else — usually the header — and then there are
 * two controls for one thing. The rail keeps the toggle in the same place at
 * every width, which is why this is a rail rather than a drawer.
 */
export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches,
  );

  return (
    <div className={`app-shell${collapsed ? ' app-shell-railed' : ''}`}>
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

      <div className="app-shell-column">
        <Header />

        <Main>{children}</Main>

        <Footer />
      </div>
    </div>
  );
}
