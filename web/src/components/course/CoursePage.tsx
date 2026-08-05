import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { nextUnlearnedLesson, type LessonSummary, type Progress, type Unit } from '../../api';
import { log, logError } from '../../debug';
import { Icon, type IconName } from '../ui/Icon';
import { LessonRow } from './LessonRow';
import { lessonStateReader, type LessonState } from './lessonState';

import './course.css';

/**
 * The shape the route loader returns. Lives here because `CoursePage` is the
 * only consumer; the route file imports it.
 */
export type Load =
  | { state: 'loading' }
  | { state: 'ready'; units: Unit[] }
  | { state: 'error'; message: string };

/**
 * Mirrors `CHECKPOINT_QUESTION_COUNT` on the server, and is a *label* only —
 * the real count comes back on the set. Shown before the test starts because
 * "how long is this" is the first thing anyone wants to know, and the only way
 * to answer it before the request is to know the cap.
 */
const CHECKPOINT_MAX_QUESTIONS = 20;

/**
 * The course page.
 *
 * ## There is one course, so this *is* `/courses`
 *
 * The design has a course detail screen with "← Back to Courses" above it. This
 * product has exactly one course — the JLPT N5 syllabus — so a list containing
 * one card, with a back link to it, would be two clicks of ceremony around a
 * single destination. `/courses` is the course. If a second track is ever added
 * (the API already models `profile.activeTrack`), the list becomes worth
 * building and this becomes `/courses/$track`.
 *
 * ## What the design shows that this API cannot answer
 *
 * Kept in the same spirit as the dashboard: dropped rather than invented.
 *
 *   - **Rating (4.9, 2.4K reviews)**, **Reviews and Q&A tabs** — there is no
 *     reviews API, no ratings, no questions.
 *   - **Total length (25h 30m) and per-lesson durations (18 min)** — nothing
 *     records or estimates how long a lesson takes. `itemCount` takes the slot,
 *     which is the real measure of how much a lesson holds.
 *   - **Instructor ("Hiroshi-sensei", AI Powered Guidance)** — there is no
 *     instructor model. The AI tutor is a real screen and is linked from the
 *     strip at the bottom rather than given a face and a name it does not have.
 *   - **Course statistics (24,531 students enrolled, 78,432 hours learned)** —
 *     no aggregate endpoint exists. The panel shows *your* figures instead,
 *     which the API does answer, and is titled accordingly.
 *   - **Certificate of completion, lifetime access, Go Premium** — no
 *     entitlements, no billing.
 *   - **Bookmark course** — nothing to persist it to.
 *   - **Related courses (JLPT N4, N3)** — they do not exist. Every levelled
 *     item in the corpus is N5.
 *   - **Resources tab** — no attachments of any kind.
 *
 * With Reviews, Q&A and Resources gone, the tab bar would be Overview and
 * Curriculum — where "Overview" is the page you are already on and
 * "Curriculum" is the section below it. That is chrome pretending to be
 * navigation, so the tabs went too and the sections simply stack.
 *
 * ## Modules are units
 *
 * The design shows eight; there are eleven. They come from `groupByUnit`, in
 * teaching order, with their labels and blurbs from `UNIT_LABELS`. The
 * percentage on each is completed lessons over total lessons, counted here from
 * `completedLessonIds` — the same arithmetic the dashboard's path card does,
 * over the same source.
 */
export function CoursePage({
  load,
  progress,
  signedIn,
  learnId,
}: {
  load: Load;
  progress: Progress | null;
  signedIn: boolean;
  learnId: string | null;
}) {
  const units = load.state === 'ready' ? load.units : [];
  const completedLessonIds = progress?.completedLessonIds ?? null;

  const allLessons = units.flatMap((unit) => unit.lessons);
  const titleById = new Map(allLessons.map((lesson) => [lesson.id, lesson.title]));
  const stateOf = lessonStateReader(signedIn ? (completedLessonIds ?? []) : null, titleById);

  const doneCount = allLessons.filter((lesson) => stateOf(lesson).completed).length;
  const percent = allLessons.length > 0 ? (doneCount / allLessons.length) * 100 : 0;

  const next = progress ? nextUnlearnedLesson(units, progress.completedLessonIds) : null;
  const unitOf = (lessonId: string): Unit | undefined =>
    units.find((unit) => unit.lessons.some((lesson) => lesson.id === lessonId));

  /*
   * Which modules start open.
   *
   * One, and it is the one you are being sent to: the module holding `?learn=`
   * if there is one, otherwise the module holding your next unlearned lesson,
   * otherwise the first. Opening all eleven would bury the module list under
   * ninety lesson rows; opening none makes the first thing a learner sees a
   * wall of closed drawers.
   *
   * This matters beyond taste: a `?learn=` lesson row scrolls itself into view
   * on mount, and an element inside a closed `<details>` cannot be scrolled to.
   * The module has to be open before that row's effect runs, which is why this
   * is computed in the initialiser rather than in an effect.
   */
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(() => {
    const target =
      (learnId ? unitOf(learnId) : null) ??
      (next ? unitOf(next.id) : null) ??
      units[0];
    return new Set(target ? [target.slug] : []);
  });

  /*
   * A later `?learn=` — arriving from the Continue button on this same route —
   * changes the param without remounting, so the initialiser above does not run
   * again. Without this the row would be asked to scroll inside a closed module.
   *
   * The dependency is the resolved *slug*, not `units`. `units` is rebuilt on
   * every render (`load.state === 'ready' ? load.units : []`), so depending on
   * it re-ran this effect — and its `setOpenSlugs` — on every single render.
   * Two strings are stable, so the effect now runs when the answer changes and
   * not before.
   */
  const learnUnitSlug = learnId
    ? (units.find((candidate) => candidate.lessons.some((lesson) => lesson.id === learnId))?.slug ??
      null)
    : null;

  useEffect(() => {
    if (!learnId) return;

    if (!learnUnitSlug) {
      logError('ui', `course: ?learn=${learnId} matches no lesson — no module will open`, {
        learnId,
        hint: 'A stale lesson id in the URL, or an id from a different environment’s database.',
      });
      return;
    }

    log('ui', `course: opening module ${learnUnitSlug} for ${learnId}`);
    setOpenSlugs((current) =>
      current.has(learnUnitSlug) ? current : new Set(current).add(learnUnitSlug),
    );
  }, [learnId, learnUnitSlug]);

  const allOpen = units.length > 0 && openSlugs.size === units.length;

  if (load.state === 'error') {
    return (
      <div className="page">
        <p className="note note-error" role="alert">
          <strong>The course could not be loaded.</strong>
          <span>{load.message} The API may be asleep.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="page course">
      <CourseHero
        units={units}
        lessons={allLessons.length}
        loading={load.state === 'loading'}
        doneCount={doneCount}
        percent={percent}
        next={next}
        signedIn={signedIn}
      />

      <div className="course-body">
        <section className="course-main" aria-labelledby="curriculum-heading">
          <div className="card glass">
            <div className="card-head">
              <h2 className="card-title" id="curriculum-heading">
                Course curriculum
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setOpenSlugs(allOpen ? new Set() : new Set(units.map((unit) => unit.slug)))
                }
                disabled={units.length === 0}
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>
            </div>

            {load.state === 'loading' ? (
              <p className="card-note">Loading the curriculum…</p>
            ) : units.length === 0 ? (
              <p className="card-note">
                The server returned no lessons. That is a content problem rather than a display
                one.
              </p>
            ) : (
              <ol className="module-list">
                {units.map((unit, index) => (
                  <ModuleRow
                    key={unit.slug}
                    unit={unit}
                    index={index}
                    open={openSlugs.has(unit.slug)}
                    onToggle={(next_) =>
                      setOpenSlugs((current) => {
                        const copy = new Set(current);
                        if (next_) copy.add(unit.slug);
                        else copy.delete(unit.slug);
                        return copy;
                      })
                    }
                    stateOf={stateOf}
                    learnId={learnId}
                  />
                ))}
              </ol>
            )}
          </div>

          <FeatureStrip />
        </section>

        <aside className="course-rail">
          <AboutCard units={units} lessons={allLessons.length} />
          <LearnCard units={units} />
          {progress ? <YourStatsCard progress={progress} doneCount={doneCount} /> : null}
        </aside>
      </div>
    </div>
  );
}

/**
 * The banner.
 *
 * The design's is a photograph of a pagoda under Mount Fuji with the text laid
 * over it. There is no artwork on the wire and no asset pipeline here, and
 * CLAUDE.md is explicit that nothing behind a glass panel may become a
 * photograph — the contrast guarantee the whole glass layer depends on assumes
 * a flat ground. So the banner is a flat wash with the same shape.
 */
function CourseHero({
  units,
  lessons,
  loading,
  doneCount,
  percent,
  next,
  signedIn,
}: {
  units: Unit[];
  lessons: number;
  loading: boolean;
  doneCount: number;
  percent: number;
  next: LessonSummary | null;
  signedIn: boolean;
}) {
  return (
    <section className="course-hero glass">
      <div className="course-hero-body">
        <p className="course-badge">JLPT N5</p>

        <h1 className="course-title">
          Japanese from zero to <em>JLPT N5</em>
        </h1>

        <p className="course-lede">
          Hiragana, katakana, the first hundred kanji, core grammar and the vocabulary the N5 is
          built on — taught in order, then kept with spaced repetition.
        </p>

        <ul className="course-meta">
          <MetaChip icon="graduation-cap" label="Beginner" note="Level" />
          <MetaChip
            icon="layers"
            label={loading ? '—' : String(units.length)}
            note={units.length === 1 ? 'Module' : 'Modules'}
          />
          <MetaChip
            icon="book-open"
            label={loading ? '—' : String(lessons)}
            note={lessons === 1 ? 'Lesson' : 'Lessons'}
          />
          <MetaChip icon="repeat" label="FSRS" note="Spaced repetition" />
        </ul>
      </div>

      {/*
        The progress card. Signed out it is an invitation rather than a ring at
        zero — a 0% dial shown to someone with no account describes the account
        they do not have.
      */}
      <div className="course-progress">
        {signedIn ? (
          <>
            <ProgressRing percent={percent} />
            <p className="course-progress-count tabular">
              {doneCount} / {lessons} lessons completed
            </p>

            {next ? (
              <Link
                className="btn btn-primary course-cta"
                to="/courses"
                search={{ learn: next.id }}
                onClick={() => log('nav', 'course: continue clicked', { lessonId: next.id })}
              >
                {doneCount === 0 ? 'Start the course' : 'Continue learning'}
                <Icon name="chevron-right" size={18} />
              </Link>
            ) : lessons > 0 ? (
              <Link className="btn btn-primary course-cta" to="/review">
                Every lesson done — review
              </Link>
            ) : null}
          </>
        ) : (
          <>
            <p className="course-progress-note">
              Browsing is open to everyone. An account is what tracks which lessons you have
              finished and schedules the reviews.
            </p>
            <Link className="btn btn-primary course-cta" to="/">
              Sign in
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

/** Same construction as the dashboard's ring — an SVG, so the cap can be round. */
function ProgressRing({ percent }: { percent: number }) {
  const filled = Math.max(0, Math.min(percent, 100));

  return (
    <div className="course-dial">
      <svg className="course-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="course-ring-track" cx="50" cy="50" r="42" pathLength={100} />
        <circle
          className="course-ring-fill"
          cx="50"
          cy="50"
          r="42"
          pathLength={100}
          strokeDasharray={`${filled} ${100 - filled}`}
        />
      </svg>
      <p className="course-dial-figure tabular">
        {Math.round(filled)}%<span>Course progress</span>
      </p>
    </div>
  );
}

function MetaChip({ icon, label, note }: { icon: IconName; label: string; note: string }) {
  return (
    <li className="meta-chip">
      <span className="meta-chip-icon" aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>
      <span className="meta-chip-text">
        <strong>{label}</strong>
        <span>{note}</span>
      </span>
    </li>
  );
}

/**
 * One module: a unit, its progress, and its lessons.
 *
 * Controlled rather than an uncontrolled `<details>`, because "Expand all" has
 * to be able to drive it. `onToggle` syncs the DOM's truth back, so a learner
 * clicking the summary and the button pressing it stay in agreement.
 */
function ModuleRow({
  unit,
  index,
  open,
  onToggle,
  stateOf,
  learnId,
}: {
  unit: Unit;
  index: number;
  open: boolean;
  onToggle: (open: boolean) => void;
  stateOf: (lesson: LessonSummary) => LessonState;
  learnId: string | null;
}) {
  const done = unit.lessons.filter((lesson) => stateOf(lesson).completed).length;
  const total = unit.lessons.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  // Signed out, `stateOf` reports nothing completed, so this is false and the
  // checkpoint row never appears for a visitor — which is right, since taking
  // one needs an account.
  const allDone = total > 0 && done === total;

  // A module reads as locked when its own first lesson is: the prerequisite
  // chain runs through the syllabus in teaching order, so that is the same
  // question as "can this be started at all".
  const locked = unit.lessons.length > 0 && (stateOf(unit.lessons[0]!).locked ?? false);

  return (
    <li>
      <details
        className={`module${allDone ? ' module-done' : ''}`}
        open={open}
        onToggle={(event) => onToggle(event.currentTarget.open)}
      >
        <summary className="module-summary">
          <span className={`module-index tabular${allDone ? ' module-index-done' : ''}`} aria-hidden="true">
            {allDone ? <Icon name="check" size={16} /> : index + 1}
          </span>

          <span className="module-titles">
            <span className="module-name">
              {unit.label} <span className="module-ja ja">{unit.ja}</span>
            </span>
            <span className="module-blurb">{unit.blurb}</span>
          </span>

          <span className="module-figures">
            <span className="module-percent tabular">{percent}%</span>
            <span className="module-count tabular">
              {done} / {total}
            </span>
          </span>

          {locked ? (
            <span className="module-lock" aria-hidden="true">
              <Icon name="lock" size={13} />
            </span>
          ) : null}

          <span className="visually-hidden">
            {done} of {total} lessons complete{locked ? ', locked' : ''}
          </span>
        </summary>

        {/* Only once there is progress to show. An empty bar on every module of
            an untouched course is eleven rows of nothing, and it makes the
            syllabus look like a list of things not done. */}
        {done > 0 ? (
          <span className="module-bar" aria-hidden="true">
            <span className="module-bar-fill" style={{ width: `${percent}%` }} />
          </span>
        ) : null}

        <ol className="lesson-list">
          {unit.lessons.map((lesson, lessonIndex) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              index={lessonIndex}
              state={stateOf(lesson)}
              highlight={lesson.id === learnId}
            />
          ))}
        </ol>

        {/*
          The checkpoint, offered once every lesson in the module is done.

          Not offered earlier, and not gated on it either — the API will happily
          run a checkpoint on a unit that has barely been started, which is right
          for a placement-style probe but wrong as the default affordance: a test
          offered before the material is taught reads as a trick.
        */}
        {allDone ? (
          <Link
            className="btn btn-primary module-checkpoint"
            to="/checkpoint/$unit"
            params={{ unit: unit.slug }}
          >
            Test yourself on {unit.label}
            <span className="module-checkpoint-sub">
              {Math.min(CHECKPOINT_MAX_QUESTIONS, unit.itemCount)} questions, one shot each
            </span>
          </Link>
        ) : null}
      </details>
    </li>
  );
}

/** Facts about the course, all of them counted rather than declared. */
function AboutCard({ units, lessons }: { units: Unit[]; lessons: number }) {
  // Summed from the unit totals, which are summed from lesson item counts. It
  // is "item slots across lessons" rather than distinct items — a character
  // taught in two lessons counts twice — so the label says "taught", not
  // "unique".
  const taught = units.reduce((total, unit) => total + unit.itemCount, 0);

  return (
    <section className="card glass" aria-labelledby="about-heading">
      <h2 className="card-title" id="about-heading">
        About this course
      </h2>

      <ul className="about-list">
        <AboutRow icon="book-open" label={`${lessons} lessons`} />
        <AboutRow icon="layers" label={`${units.length} modules`} />
        <AboutRow icon="library" label={`${taught} items taught`} />
        <AboutRow icon="graduation-cap" label="JLPT N5 throughout" />
        <AboutRow icon="repeat" label="Reviews scheduled by FSRS" />
        <AboutRow icon="check" label="Free, and no account needed to browse" />
      </ul>
    </section>
  );
}

function AboutRow({ icon, label }: { icon: IconName; label: string }) {
  return (
    <li className="about-row">
      <span className="about-icon" aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>
      <span>{label}</span>
    </li>
  );
}

/**
 * "What you'll learn", straight off the units.
 *
 * The design has six hand-written bullets. These are the real module blurbs
 * from `UNIT_LABELS`, which is authored content that already describes exactly
 * this — so the list cannot drift out of step with the syllabus the way six
 * fixed strings would.
 */
function LearnCard({ units }: { units: Unit[] }) {
  const points = units.filter((unit) => unit.blurb).slice(0, 8);
  if (points.length === 0) return null;

  return (
    <section className="card glass" aria-labelledby="learn-heading">
      <h2 className="card-title" id="learn-heading">
        What you&rsquo;ll learn
      </h2>

      <ul className="learn-list">
        {points.map((unit) => (
          <li className="learn-row" key={unit.slug}>
            <span className="learn-tick" aria-hidden="true">
              <Icon name="check" size={13} />
            </span>
            <span>{unit.blurb}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The design's "Course Statistics" panel, rebuilt around the only figures that
 * exist: yours. There is no aggregate endpoint — no enrolment count, no total
 * hours — and the honest move is to change the question rather than invent an
 * answer to this one.
 */
function YourStatsCard({ progress, doneCount }: { progress: Progress; doneCount: number }) {
  return (
    <section className="card glass" aria-labelledby="stats-heading">
      <h2 className="card-title" id="stats-heading">
        Your progress
      </h2>

      <dl className="stat-rows">
        <StatRow label="Lessons completed" value={String(doneCount)} />
        <StatRow label="Total XP" value={progress.xp.toLocaleString()} />
        <StatRow label="Level" value={String(progress.level)} />
        <StatRow label="Day streak" value={String(progress.streakDays)} />
        <StatRow label="Cards due now" value={String(progress.cardsDueNow)} />
      </dl>
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-row">
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

/**
 * The four claims along the bottom.
 *
 * Static copy, and every one of them is true of this product rather than
 * marketing: the scheduler really is FSRS, the tutor really is a chat screen,
 * XP and levels really are awarded server-side. Each links to the screen that
 * makes the claim good, which is the difference between a feature strip and a
 * row of adjectives.
 */
function FeatureStrip() {
  const features: { id: string; icon: IconName; title: string; note: string; to: '/review' | '/practice' | '/leagues' | '/courses' }[] = [
    {
      id: 'pace',
      icon: 'book-open',
      title: 'Learn at your pace',
      note: 'Nothing expires; the syllabus waits.',
      to: '/courses',
    },
    {
      id: 'tutor',
      icon: 'bot',
      title: 'AI tutor',
      note: 'Practise conversation and get corrections.',
      to: '/practice',
    },
    {
      id: 'srs',
      icon: 'repeat',
      title: 'Spaced repetition',
      note: 'FSRS schedules each card just before you would forget it.',
      to: '/review',
    },
    {
      id: 'xp',
      icon: 'zap',
      title: 'XP and levels',
      note: 'Awarded by the server for lessons and reviews.',
      to: '/leagues',
    },
  ];

  return (
    <ul className="feature-strip">
      {features.map((feature) => (
        <li key={feature.id}>
          <Link className="feature-tile glass" to={feature.to}>
            <span className="feature-icon" aria-hidden="true">
              <Icon name={feature.icon} size={18} />
            </span>
            <span className="feature-text">
              <strong>{feature.title}</strong>
              <span>{feature.note}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
