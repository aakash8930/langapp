import { API_BASE } from '../../api';

function GoogleLogo() {
  return (
    <svg
      className="signup-oauth-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.75 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 24c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.34v2.85C4.15 21.05 7.78 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.34C1.48 8.66 1 10.55 1 12.5s.48 3.84 1.34 5.43l3.5-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.78 0 4.15 2.95 2.34 6.57l3.5 2.84c.87-2.6 3.3-4.66 6.16-4.66z"
      />
    </svg>
  );
}

function GitHubLogo() {
  return (
    <svg
      className="signup-oauth-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12.5c0 5.08 3.29 9.38 7.86 10.92.57.11.79-.25.79-.55 0-.28-.01-1.16-.02-2.21-3.34.72-4.03-1.61-4.03-1.61-.55-1.38-1.34-1.75-1.34-1.75-1.09-.74.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.77.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.25.47-2.38 1.24-3.02-.14-.3-.54-1.52.11-2.75 0 0 1-.32 3.29 1.23.95-.26 1.97-.39 2.98-.39 1.02 0 2.04.14 2.99.39 2.28-1.55 3.29-1.23 3.29-1.23.64 1.43.24 2.46.12 2.75.78.84 1.24 1.91 1.24 3.02 0 4.61-3.44 5.62-5.77 5.91.43.36.82 1.1.82 2.22 0 1.66-.02 2.9-.02 3.29 0 .32.21.69.83.57C20.57 22.58 24 18.08 24 12.5 24 5.73 18.73.5 12 .5z" />
    </svg>
  );
}

/**
 * OAuth provider buttons.
 *
 * Each button redirects the browser to the backend's OAuth initiation route.
 * The redirect is the standard OAuth handshake: the provider returns here after
 * authorisation and the backend issues the session. If the backend hasn't yet
 * configured a given provider, the endpoint will 404; the frontend code itself
 * is the real, production-quality redirect pattern.
 */
export function OAuthButtons() {
  function redirect(url: string) {
    window.location.href = url;
  }

  return (
    <div className="signup-oauth" data-signup-reveal>
      <div className="signup-divider">
        <span>or continue with</span>
      </div>
      <div className="signup-oauth-row">
        <button
          type="button"
          className="signup-oauth-btn"
          onClick={() => redirect(`${API_BASE}/auth/google`)}
        >
          <GoogleLogo />
          <span>Google</span>
        </button>
        <button
          type="button"
          className="signup-oauth-btn"
          onClick={() => redirect(`${API_BASE}/auth/github`)}
        >
          <GitHubLogo />
          <span>GitHub</span>
        </button>
      </div>
    </div>
  );
}
