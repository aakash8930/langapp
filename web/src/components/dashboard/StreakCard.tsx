import type { Progress } from '../../api';
import { Icon } from '../ui/Icon';
import { localDay, studiedDays, weekOf } from './days';

/** Monday-first, matching `weekdayIndex`. Initials only — the strip is narrow. */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The full names, for the label a screen reader gets instead of "T". */
const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * The streak, and the week it sits in.
 *
 * ## The week strip is derived, not fetched
 *
 * There is no study-history endpoint. What there *is*: `streakDays` and
 * `lastStudyDate`, and the server's own definition of a streak (`nextStreak`)
 * makes those two facts equivalent to "these N consecutive days had study on
 * them". So the ticks are derived from the streak, and they are exactly as true
 * as the streak is.
 *
 * That derivation is also its limit, and the limit shows: a day studied *before*
 * a break is not marked, because the streak no longer covers it and nothing on
 * the wire remembers it. This is the honest version of the design's row of
 * seven ticks — which was drawn as seven filled circles regardless.
 *
 * Days later in the week than today render as neither done nor missed. "Not yet"
 * and "you skipped it" are different states and a learner reading a cross
 * against Saturday on a Wednesday would reasonably be annoyed.
 */
export function StreakCard({ progress, tz }: { progress: Progress; tz: string }) {
  const today = localDay(new Date(), tz);
  const studied = studiedDays(progress.lastStudyDate, progress.streakDays);
  const week = weekOf(today);

  const todayDone = studied.has(today);

  return (
    <section className="card streak-card glass" aria-labelledby="streak-heading">
      <h2 className="card-title streak-title" id="streak-heading">
        <span className="streak-flame" aria-hidden="true"><Icon name="flame" size={20} /></span>
        Learning streak
      </h2>

      <div className="streak-summary">
        <div>
          <p className="streak-count tabular">{progress.streakDays} <span>days</span></p>
          <p className="card-note">
            {progress.streakDays === 0
              ? 'Study today to start your streak.'
              : todayDone
                ? 'Keep it up! Today is counted.'
                : 'One lesson or practice session keeps your streak alive.'}
          </p>
        </div>
        <span className="streak-emblem ja" aria-hidden="true">門</span>
      </div>

      <ul className="streak-week">
        {week.map((day, index) => {
          const done = studied.has(day);
          const future = day > today;
          const state = done ? 'done' : future ? 'ahead' : 'missed';

          return (
            <li className={`streak-day streak-day-${state}`} key={day}>
              <span className="streak-day-letter" aria-hidden="true">
                {WEEKDAYS[index]}
              </span>
              <span className="streak-day-dot" aria-hidden="true">
                {done ? <Icon name="check" size={13} /> : null}
              </span>
              <span className="visually-hidden">
                {WEEKDAY_NAMES[index]}:{' '}
                {done ? 'studied' : future ? 'still to come' : 'not studied'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
