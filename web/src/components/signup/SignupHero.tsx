import { cn } from '../../lib';

function SakuraPetal({ className }: { className?: string }) {
  return (
    <svg
      className={cn('signup-deco', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2c2 4 8 8 8 14 0 3-4 6-8 6s-8-3-8-6c0-6 6-10 8-14z"
        fill="currentColor"
      />
    </svg>
  );
}

function Torii() {
  return (
    <svg
      className="signup-deco signup-deco--torii"
      viewBox="0 0 120 160"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 30c0-4 4-8 8-8h100c4 0 8 4 8 8v12H2V30z"
        fill="currentColor"
      />
      <path
        d="M20 42v98h18V42zM82 42v98h18V42z"
        fill="currentColor"
      />
      <path d="M10 82h100v6H10z" fill="currentColor" />
    </svg>
  );
}

function Lantern() {
  return (
    <svg
      className="signup-deco signup-deco--lantern"
      viewBox="0 0 80 120"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M40 10L30 30h40L40 10z"
        fill="currentColor"
        opacity="0.9"
      />
      <rect
        x="20"
        y="30"
        width="40"
        height="60"
        rx="8"
        fill="currentColor"
      />
      <path
        d="M20 44h40M20 84h40"
        stroke="#1a1c23"
        strokeWidth="3"
      />
    </svg>
  );
}

function BrushStroke({ className }: { className?: string }) {
  return (
    <svg
      className={cn('signup-deco', className)}
      viewBox="0 0 160 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 28c30-8 90-12 140-2"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The right-side Japanese Ink illustration.
 *
 * Sits on top of the existing background artwork with a dark overlay. The
 * decorative SVG elements (torii, lantern, sakura petals, brush strokes) are
 * absolutely positioned and animated with very gentle CSS floats — subtle
 * enough that they never compete with the form on the left.
 */
export function SignupHero() {
  return (
    <aside className="signup-hero" aria-hidden="true">
      <div className="signup-hero-overlay" />
      <div className="signup-hero-content">
        <Torii />
        <Lantern />
        <BrushStroke className="signup-deco--brush-1" />
        <BrushStroke className="signup-deco--brush-2" />
        {Array.from({ length: 8 }).map((_, i) => (
          <SakuraPetal
            key={i}
            className={`signup-deco--petal-${i + 1}`}
          />
        ))}
      </div>
    </aside>
  );
}
