import type { Progress } from '../../api';
import { dayOfMonth, localDay, monthGrid, monthLabel, studiedDays } from './days';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The study calendar.
 *
 * ## Current month only, and no month arrows
 *
 * The design has ‹ › either side of "May 2025". They are not here, and that is
 * the honest version rather than a missing feature.
 *
 * The only study history on the wire is `streakDays` + `lastStudyDate`, which
 * together prove exactly one unbroken run of days. Anything before the current
 * streak is unknown — not "no study", *unknown*. Paging back to April would
 * render a grid of empty squares, and an empty square in a calendar is read as
 * "nothing happened that day". That is a false claim about the learner's own
 * history, and it is the kind this project has twice written down a rule
 * against.
 *
 * A real calendar needs a study-history endpoint. Until there is one, this
 * shows the month you are in, says what the marks mean, and stops.
 */
export function CalendarCard({ progress, tz }: { progress: Progress; tz: string }) {
  const today = localDay(new Date(), tz);
  const studied = studiedDays(progress.lastStudyDate, progress.streakDays);
  const cells = monthGrid(today);

  return (
    <section className="card calendar-card glass" aria-labelledby="calendar-heading">
      <div className="card-head">
        <h2 className="card-title" id="calendar-heading">
          Study calendar
        </h2>
        <span className="calendar-month">{monthLabel(today)}</span>
      </div>

      <div className="calendar-grid" role="presentation">
        {WEEKDAYS.map((name) => (
          <span className="calendar-weekday" key={name} aria-hidden="true">
            {name.slice(0, 1)}
          </span>
        ))}

        {cells.map((cell) => {
          const isToday = cell.key === today;
          const done = studied.has(cell.key);

          return (
            <span
              className={[
                'calendar-day',
                cell.inMonth ? '' : 'calendar-day-outside',
                done ? 'calendar-day-studied' : '',
                isToday ? 'calendar-day-today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={cell.key}
            >
              <span aria-hidden="true">{dayOfMonth(cell.key)}</span>
              {/* The visual state is colour and weight, neither of which is
                  available to a screen reader. Only the days that carry meaning
                  say anything, so the grid does not become 42 announcements. */}
              {done || isToday ? (
                <span className="visually-hidden">
                  {cell.key}
                  {done ? ' — studied' : ''}
                  {isToday ? ' — today' : ''}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      <p className="card-note">
        {progress.streakDays > 0
          ? `Marked days are your current ${progress.streakDays}-day streak.`
          : 'Days are marked once a streak is running.'}
      </p>
    </section>
  );
}
