import { Link } from '@tanstack/react-router';

import { Icon } from '../ui/Icon';

/**
 * Course completion certificate — shown when every lesson is done.
 *
 * No backend endpoint is needed: the flag is `percent === 100` on the
 * CoursePage, and all the numbers (lesson count, unit count, XP) come
 * from the same `Progress` the page already has.
 */
export function CourseCertificate({
  doneCount,
  totalLessons,
  unitCount,
  xp,
  level,
  displayName,
}: {
  doneCount: number;
  totalLessons: number;
  unitCount: number;
  xp: number;
  level: number;
  displayName: string;
}) {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <section
      className="card course-certificate"
      aria-labelledby="cert-heading"
      style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 8%, transparent), color-mix(in srgb, var(--brand-secondary) 8%, transparent))',
        border: '1px solid color-mix(in srgb, var(--brand-primary) 20%, transparent)',
        textAlign: 'center',
        padding: 'var(--s-3xl) var(--s-2xl)',
      }}
    >
      <span style={{ fontSize: '3rem', lineHeight: 1, display: 'block', marginBottom: 'var(--s-md)' }} aria-hidden="true">
        🎓
      </span>

      <h2
        id="cert-heading"
        style={{
          margin: '0 0 var(--s-sm)',
          fontSize: 'var(--text-heading)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
        }}
      >
        Course Completed!
      </h2>

      <p style={{ margin: '0 0 var(--s-xl)', color: 'var(--ink-soft)', fontSize: 'var(--text-body)' }}>
        Congratulations, {displayName}! You&rsquo;ve finished every lesson in the JLPT N5 syllabus.
      </p>

      {/* The certificate */}
      <div
        style={{
          background: 'var(--surface)',
          border: '2px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--s-2xl)',
          marginBottom: 'var(--s-xl)',
        }}
      >
        <p
          className="ja"
          style={{
            margin: '0 0 var(--s-xs)',
            fontSize: 'var(--text-title)',
            color: 'var(--brand-primary)',
            fontWeight: 700,
          }}
        >
          修了証書
        </p>

        <p style={{ margin: '0 0 var(--s-xs)', fontSize: 'var(--text-caption)', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          Certificate of Completion
        </p>

        <p style={{ margin: '0 0 var(--s-2xl)', fontSize: 'var(--text-title)', fontWeight: 700 }}>
          {displayName}
        </p>

        <p style={{ margin: '0 0 var(--s-sm)', fontSize: 'var(--text-body)', color: 'var(--ink-soft)' }}>
          has successfully completed
        </p>

        <p
          className="ja"
          style={{
            margin: '0 0 var(--s-2xl)',
            fontSize: 'var(--text-title)',
            fontWeight: 700,
          }}
        >
          JLPT N5 — Japanese
        </p>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--s-2xl)',
            flexWrap: 'wrap',
            marginBottom: 'var(--s-xl)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <span
              className="tabular"
              style={{ display: 'block', fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--brand-primary)' }}
            >
              {doneCount}
            </span>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>
              {totalLessons === 1 ? 'Lesson' : 'Lessons'}
            </span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span
              className="tabular"
              style={{ display: 'block', fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--brand-primary)' }}
            >
              {unitCount}
            </span>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>
              {unitCount === 1 ? 'Module' : 'Modules'}
            </span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <span
              className="tabular"
              style={{ display: 'block', fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--brand-primary)' }}
            >
              {xp.toLocaleString()} XP
            </span>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>Level {level}</span>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 'var(--text-caption)', color: 'var(--ink-soft)' }}>
          Completed on {today}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--s-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to="/review-session">
          <Icon name="refresh-cw" size={18} />
          Keep reviewing
        </Link>
        <Link className="btn btn-secondary" to="/achievements">
          <Icon name="award" size={18} />
          View achievements
        </Link>
      </div>
    </section>
  );
}
