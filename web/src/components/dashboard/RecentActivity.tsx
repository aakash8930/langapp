import { Icon } from '../ui/Icon';

/**
 * Recent activity — placeholder.
 *
 * ## Why an empty list
 *
 * There is no per-event timeline endpoint, and the data the dashboard does
 * have (streak days, today's ring, completed lessons) is already drawn
 * elsewhere. Showing "1 day ago you finished Hiragana Basics" without the
 * server backing it would mean fabricating timestamps, which is the same
 * failure `CalendarCard` rules out for study history.
 */
export function RecentActivity() {
  return (
    <section className="card recent-card glass" aria-labelledby="recent-heading">
      <div className="placeholder-head">
        <h2 className="card-title" id="recent-heading">
          <span className="card-title-icon" aria-hidden="true">
            <Icon name="trending-up" size={18} />
          </span>
          Recent activity
        </h2>
        <span className="placeholder-pill">Coming soon</span>
      </div>
      <p className="placeholder-note">
        There is no per-event timeline on the API yet. The streak and
        today&rsquo;s ring cover what&rsquo;s known.
      </p>
    </section>
  );
}