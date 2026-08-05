import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { fetchLessons } from '../../../api';
import { sidebarGroups } from '../../../constants/navigation';
import { log } from '../../../debug';
import { queryKeys } from '../../../queryKeys';
import type { RoutePath } from '../../../types/layout';
import { Icon, type IconName } from '../../ui/Icon';

import './CommandPalette.css';

type Result =
  | { kind: 'route'; id: string; label: string; hint: string; icon: IconName; to: RoutePath }
  | { kind: 'lesson'; id: string; label: string; hint: string };

/**
 * The search behind the header's field.
 *
 * ## Why it exists at all
 *
 * The design has a prominent search box. The honest options were to build
 * something real or to leave the box out; a decorative input in the most
 * inviting spot on the page is the kind of thing that teaches people not to
 * trust the rest of the screen.
 *
 * ## It searches what is already loaded
 *
 * Two sources, both free: the navigation model (a constant) and the lesson
 * catalog, which the dashboard and `/courses` have already put in the query
 * cache under `queryKeys.lessons.all`. There is no search endpoint and this
 * does not add one — `useQuery` here is a cache read that only becomes a fetch
 * if the palette is the first thing touched in a session.
 *
 * Matching is a case-folded substring over title and unit. Not fuzzy: with a
 * few dozen lessons, fuzzy matching mostly buys false positives, and a learner
 * typing "kana" wants the kana lessons rather than everything containing k, a
 * and n in order.
 *
 * ## The dialog is native
 *
 * `<dialog showModal>` brings the focus trap, the backdrop, inertness of the
 * page behind it and Escape-to-close with no code. The project's rule is to
 * prefer native elements and this is the case that pays best — a hand-rolled
 * modal is where keyboard support goes to die.
 *
 * The one wrinkle: `showModal()` must be called imperatively, and calling it on
 * an already-open dialog throws. Hence the `open` check inside the effect.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  // Enabled only while open: a palette nobody has opened should not be the
  // reason the catalog is fetched.
  const lessons = useQuery({
    queryKey: queryKeys.lessons.all,
    queryFn: fetchLessons,
    enabled: open,
  });

  const routes: Result[] = useMemo(
    () =>
      sidebarGroups.flatMap((group) =>
        group.items.flatMap((item): Result[] =>
          item.kind === 'link'
            ? [
                {
                  kind: 'route',
                  id: item.id,
                  label: item.label,
                  hint: group.title ?? 'Go to',
                  icon: item.icon ?? 'chevron-right',
                  to: item.to,
                },
              ]
            : [],
        ),
      ),
    [],
  );

  const results = useMemo((): Result[] => {
    const needle = query.trim().toLowerCase();

    const lessonResults: Result[] = (lessons.data ?? []).map((lesson) => ({
      kind: 'lesson',
      id: lesson.id,
      label: lesson.title,
      hint: lesson.unit,
    }));

    const all = [...routes, ...lessonResults];
    if (!needle) return all.slice(0, 8);

    return all
      .filter(
        (result) =>
          result.label.toLowerCase().includes(needle) ||
          result.hint.toLowerCase().includes(needle),
      )
      .slice(0, 12);
  }, [query, routes, lessons.data]);

  // Open and close the native dialog to match the prop. Guarded both ways —
  // `showModal()` on an open dialog throws, and `close()` on a closed one fires
  // a spurious `close` event that would bounce straight back through `onClose`.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      setQuery('');
      setCursor(0);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The cursor indexes `results`, and `results` shrinks as you type. Without
  // this, typing past the last match leaves the highlight pointing at nothing
  // and Enter does nothing at all — which reads as a broken palette.
  useEffect(() => {
    setCursor((current) => (current < results.length ? current : 0));
  }, [results.length]);

  function goTo(result: Result): void {
    log('nav', `palette: ${result.kind} → ${result.label}`, { id: result.id });
    onClose();

    if (result.kind === 'route') void navigate({ to: result.to });
    else void navigate({ to: '/courses', search: { learn: result.id } });
  }

  return (
    <dialog
      ref={dialogRef}
      className="palette"
      aria-label="Search"
      // Escape and the backdrop both fire `close` natively; this is the single
      // place that syncs the native state back to React's.
      onClose={onClose}
      onClick={(event) => {
        // A click that lands on the dialog element itself is a click on the
        // backdrop — the content is in a child, so it never bubbles as this.
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="palette-body">
        <div className="palette-field">
          <Icon name="search" size={18} />
          <input
            className="palette-input"
            type="search"
            // The dialog moves focus to its first focusable child on open, and
            // that is this input.
            autoFocus
            placeholder="Search lessons and screens…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setCursor((current) => (results.length ? (current + 1) % results.length : 0));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setCursor((current) =>
                  results.length ? (current - 1 + results.length) % results.length : 0,
                );
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const chosen = results[cursor];
                if (chosen) goTo(chosen);
              }
            }}
          />
        </div>

        {/* Loading, empty and error — the project's rule for every list, and a
            palette is the list most likely to be opened before its data. */}
        {lessons.isPending && open ? (
          <p className="palette-note">Loading the catalog…</p>
        ) : lessons.isError ? (
          <p className="palette-note">
            Lessons could not be loaded, so only screens are searchable. The API may be asleep.
          </p>
        ) : null}

        {results.length === 0 ? (
          <p className="palette-note">Nothing matches “{query}”.</p>
        ) : (
          <ul className="palette-results">
            {results.map((result, index) => (
              <li key={`${result.kind}-${result.id}`}>
                <button
                  type="button"
                  className={`palette-result${index === cursor ? ' palette-result-active' : ''}`}
                  onClick={() => goTo(result)}
                  onMouseEnter={() => setCursor(index)}
                >
                  <span className="palette-result-icon" aria-hidden="true">
                    {result.kind === 'route' ? (
                      <Icon name={result.icon} size={16} />
                    ) : (
                      <Icon name="book-open" size={16} />
                    )}
                  </span>
                  <span className="palette-result-label">{result.label}</span>
                  <span className="palette-result-hint">{result.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
