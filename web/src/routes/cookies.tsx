import { createFileRoute } from '@tanstack/react-router';
import { InfoPage } from '../components/landing/InfoPage';

export const Route = createFileRoute('/cookies')({ component: CookiePolicy });

function CookiePolicy() {
  return (
    <InfoPage title="Cookie Policy" backTo="/" backLabel="Home">
      <p><strong>Effective date: August 16, 2026</strong></p>
      <h2>What GENKŌ stores</h2>
      <p>
        GENKŌ uses strictly necessary cookies to keep signed-in browser sessions secure. The access and refresh
        credentials are HttpOnly cookies, which means page JavaScript cannot read them. A separate CSRF cookie is
        compared with the request header before an account-changing browser request is accepted.
      </p>
      <h2>Purpose and lifetime</h2>
      <ul>
        <li>Access-session cookie: authorises short-lived requests.</li>
        <li>Refresh-session cookie: rotates when the browser renews a session and expires after the configured session period.</li>
        <li>CSRF cookie: protects signed-in changes from requests made by another site.</li>
      </ul>
      <p>These cookies are not used for advertising, cross-site tracking, or sale of personal data.</p>
      <h2>Local browser storage</h2>
      <p>
        Theme and interface preferences, bookmarks, custom vocabulary lists, local flashcard decks and activity,
        reading history, and writing drafts or corrections may be stored on this device. Those local records are not
        cookies and are not account-synchronised. Clearing site data removes them from this browser.
      </p>
      <h2>Your choices</h2>
      <p>
        Blocking necessary cookies prevents browser sign-in from working. You can sign out to clear the active
        browser session and use your browser controls to clear local site data. Contact support through the Contact
        page with privacy questions.
      </p>
    </InfoPage>
  );
}
