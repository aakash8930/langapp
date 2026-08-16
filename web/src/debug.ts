/**
 * Console tracing for the flows that fail silently.
 *
 * This exists because of a real bug: the home page's "Begin" button pointed at
 * `#/learn/<id>`, a path left over from the hand-rolled hash router that no
 * TanStack route matches. The router answered with its
 * `defaultNotFoundComponent` — literally `<p>Not Found</p>` — and **wrote
 * nothing to the console**, because a route miss is not an error. Two words on a
 * blank page and no way to tell whether the click, the navigation, the fetch or
 * the render was at fault.
 *
 * So the rule this module enforces:
 *
 * > Anything that can end a user's journey without throwing has to say so.
 *
 * Route misses, fetches that resolve non-2xx, navigations that land somewhere
 * other than where a click aimed, and effects that decide to do nothing. None of
 * those raise, and all of them look identical from the outside — a screen that
 * did not change.
 *
 * ## Turning it on
 *
 * On automatically under `npm run dev`. In a production build it is **off by
 * default and switchable at runtime**, which is the part that matters: the bug
 * above was reported against the deployed site, where a dev-only logger would
 * have been useless.
 *
 *   localStorage.setItem('langapp:debug', '1'); location.reload();
 *   // or append #debug to the URL, or:
 *   __langapp.debug.on()
 *
 * `#debug` is checked as a substring of the whole URL rather than parsed,
 * because the app is hash-routed — the hash is the route, so there is no spare
 * hash to put a flag in. `#/?learn=x&debug` and `#debug` both work.
 *
 * ## Cost when off
 *
 * `enabled` is read once at module load into a `let`, so a disabled call is one
 * boolean test and a return. Data arguments are still *evaluated* by the caller,
 * so pass values you already have — never a computation done for the log's sake.
 * Where a payload is expensive, pass a thunk; `log` calls it only if enabled.
 */

/** The areas traced. Prefixed onto every line so the console filter box works. */
export type Channel =
  | 'nav' // navigation: what the router matched, and what it did not
  | 'api' // requests: method, path, status, duration
  | 'auth' // session state machine, token refresh
  | 'route' // route loaders: start, resolve, throw
  | 'ui' // component decisions that produce no visible change
  | 'quiz'; // lesson/checkpoint progression

const STORAGE_KEY = 'langapp:debug';

function readFlag(): boolean {
  // Dev server: always on. Nothing to opt into while working on the thing.
  if (import.meta.env.DEV) return true;

  try {
    if (window.localStorage.getItem(STORAGE_KEY) === '1') return true;
  } catch {
    // Private mode / storage disabled. Fall through to the URL flag, which
    // needs no storage at all — that is the point of having both.
  }

  return window.location.href.includes('debug');
}

let enabled = readFlag();

/** A colour per channel, so a busy console is still skimmable. */
const COLOURS: Record<Channel, string> = {
  nav: '#c8102e', // vermilion — the channel that found this bug
  api: '#1b3a6b', // indigo
  auth: '#6b4c9a',
  route: '#0f7b6c',
  ui: '#8a6d3b',
  quiz: '#a3543c',
};

/** Milliseconds since the module loaded. Cheaper to read than a wall clock. */
function since(): string {
  return `+${Math.round(performance.now())}ms`;
}

/**
 * Trace a step. `data` is spread into the console call, so objects stay
 * inspectable rather than being flattened into a string.
 *
 * Pass a function for `data` when building it costs something — it is only
 * called when tracing is on.
 */
export function log(channel: Channel, message: string, data?: unknown | (() => unknown)): void {
  if (!enabled) return;

  const payload = typeof data === 'function' ? (data as () => unknown)() : data;
  const head = [
    `%c${channel}%c ${message} %c${since()}`,
    `background:${COLOURS[channel]};color:#fff;padding:1px 5px;border-radius:3px;font-weight:600`,
    'color:inherit',
    'color:#888',
  ];

  if (payload === undefined) console.log(...head);
  else console.log(...head, payload);
}

/**
 * Trace something that is wrong, whether or not it threw.
 *
 * **Not gated.** A dead end must be visible in the console the reporter already
 * has open, without them first knowing a flag exists — that is the whole
 * failure this module was written for. Use it only where the app has genuinely
 * gone wrong; a missing optional value is a `log`, not this.
 */
export function logError(channel: Channel, message: string, data?: unknown): void {
  const head = [`%c${channel}%c ${message}`, `color:${COLOURS[channel]};font-weight:600`, ''];
  if (data === undefined) console.error(...head);
  else console.error(...head, data);
}

/** Wall-clock a promise and trace both outcomes. Returns the same promise's value. */
export async function timed<T>(
  channel: Channel,
  message: string,
  work: () => Promise<T>,
): Promise<T> {
  if (!enabled) return work();

  const started = performance.now();
  log(channel, `${message} …`);
  try {
    const result = await work();
    log(channel, `${message} ✓`, { ms: Math.round(performance.now() - started) });
    return result;
  } catch (error) {
    // Rethrown — this observes, it never swallows.
    logError(channel, `${message} ✗`, { ms: Math.round(performance.now() - started), error });
    throw error;
  }
}

/**
 * Runtime switch, on `window.__langapp.debug`.
 *
 * A namespaced object rather than three bare globals, and typed via
 * `globalThis` augmentation below so this file needs no `as any`.
 */
const controls = {
  on(): void {
    enabled = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Not persistable here; on for this page is still better than nothing.
    }
    console.info('GENKŌ debug tracing ON');
  },
  off(): void {
    enabled = false;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // As above.
    }
    console.info('GENKŌ debug tracing OFF');
  },
  get enabled(): boolean {
    return enabled;
  },
};

declare global {
  interface Window {
    __langapp?: { debug: typeof controls; [key: string]: unknown };
  }
}

window.__langapp = { ...window.__langapp, debug: controls };

if (enabled) {
  console.info(
    `%clangapp%c debug tracing is on. __langapp.debug.off() to silence it.`,
    'background:#1b3a6b;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600',
    'color:#888',
  );
}
