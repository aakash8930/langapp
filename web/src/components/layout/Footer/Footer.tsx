import './Footer.css';

/**
 * The shell's footer.
 *
 * There is no version number here any more. `v0.1` was hard-coded, nothing
 * updated it, and a build number that never moves is worse than no build
 * number — it is a claim about which code is running, and it was wrong from
 * the second deploy onward.
 */
export function Footer() {
  return (
    <footer className="app-footer">
      <span className="app-footer-mark ja" aria-hidden="true">
        日本語
      </span>
      <span>GENKŌ — learn Japanese with spaced repetition.</span>
    </footer>
  );
}
