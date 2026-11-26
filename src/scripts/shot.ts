#!/usr/bin/env node
/*
 * Argus screenshots and checks. Gives an agent eyes when it has no browser tool.
 *
 * It starts a Chrome-family browser that is already installed (Chrome, Chromium,
 * Brave, Edge, Vivaldi) in headless mode with a throwaway profile, and drives it
 * over the browser's own debugging connection. It installs and downloads
 * nothing, makes no network calls of its own, and deletes the profile afterwards.
 *
 * Usage:
 *   node shot.js <url-or-html-file> [--out DIR] [--widths 320,390,1440,1920] [--between] [--height N] [--scheme light|dark] [--reduced-motion] [--wait MS] [--tap TARGET]... [--hover TARGET]... [--type TARGET=TEXT]... [--frames N [--every MS]] [--scroll-frames N] [--full] [--check [--app]] [--no-shots]
 *
 *   --out DIR       where to write PNGs (default: ./shots)
 *   --widths LIST   comma-separated widths in CSS pixels (default: 320,390,1440,1920)
 *   --height N      viewport height in CSS pixels, 200 to 4000, at every width (default: 700 at 320,
 *                   844 on other phones, 900 on laptops, 1080 at 1900 and wider)
 *   --scheme S      light or dark: emulate prefers-color-scheme for captures, --check and --inventory
 *                   (default: light, whatever this computer is set to, so results do not
 *                   depend on the machine that runs the check)
 *   --wait MS       extra time to wait before capturing, after the page has settled (default: 0).
 *                   It always waits first until the page has stopped changing for half a second
 *                   (no DOM changes, no finite animation, no short timer still due), six seconds
 *                   at most, so a first-screen sequence driven by script timers is captured
 *                   finished.
 *   --tap TARGET    before capturing, tap TARGET with real mouse events, then wait for the page to
 *                   settle as above; repeat it to tap several in order. TARGET is a CSS selector, or
 *                   text=Label for a button, link or tab whose visible text, then aria-label, is Label,
 *                   then one with Label as a whole word, then one containing it (any case; on screen
 *                   first). A target not found stops the run.
 *                   The target is scrolled into view (to the middle of its scroll area) first.
 *   --type T=TEXT   before capturing, type TEXT into the field T: a CSS selector, or text=Label for
 *                   the first visible field whose label, aria-label, placeholder or name is Label.
 *                   The field is scrolled into view (given 2 seconds to show if a scroll reveal
 *                   hides it), focused and cleared, then TEXT is typed; a
 *                   select takes the option whose text or value is TEXT. Repeatable; --tap and
 *                   --type steps run together in the order given on the command line.
 *   --reduced-motion  emulate prefers-reduced-motion: reduce (with --check too). Without it,
 *                   no-preference is emulated even where this computer has motion turned off
 *   --hover TARGET  move the real mouse onto TARGET (same syntax as --tap) in a few steps, then
 *                   wait for the page to settle; runs in order with --tap and --type. A --tap,
 *                   --hover or --type target hidden until it scrolls into view is given 2 seconds to show.
 *   --frames N      after load and any steps, N viewport screenshots --every MS apart (default 150),
 *                   without waiting for the page to settle: frame-<width>-01.png and on
 *   --scroll-frames N  N viewport screenshots at evenly spaced scroll positions, each after a short
 *                   settle: scroll-<width>-01.png and on
 *   --full          also capture the whole page, top to bottom, as a series of slices at each width,
 *                   and the same joined into one tall PNG (shot-<width>-full.png).
 *                   It first scrolls through the page a screen at a time, so content that
 *                   appears on scroll and lazy-loaded images are there, then returns to the top,
 *                   and shows scroll-driven reveals (view() timelines) in their finished state.
 *   --check         run the Argus checker in the page at each width and print what it finds
 *                   (after the same scroll-through, so content revealed on scroll is measured)
 *   --app           with --check: the page is an app prototype (phone screens switched by URL hash,
 *                   modal sheets); relaxes the web-page rules that misfire there, and says which
 *   --inventory     print the design system the page actually uses: fonts, sizes, colours, radii, control heights
 *   --against URL   compare the page's design system with another page's and print only what is new in this one
 *   --no-shots      with --check or --inventory: write no images
 *
 * Motion (see USAGE for details): --scenes, --timeline NAME, --points N, --arrival, --transition T,
 * --ms MS, --motion-metrics, --perf-scroll, --fallbacks. Each sequence is also written as one
 * labelled contact sheet (<prefix>-sheet.png), drawn in the browser, so a sequence can be read in
 * one image. Pages can register what moves on window.__argus = { timelines: {...}, scenes: [...],
 * lenis } so these flags can seek it exactly.
 *   --help, -h      print this help
 *
 * Set ARGUS_BROWSER to a browser executable to choose one explicitly.
 * Needs Node 22 or later. Prints the path of each PNG written.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as net from 'node:net';
import * as http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as zlib from 'node:zlib';

export interface Options {
  target: string | null;
  out: string;
  /** --out was given; otherwise files go to shots/<page>/ so captures of different pages never overwrite each other. */
  outGiven: boolean;
  widths: number[];
  /** In-between widths (tablet, an awkward one, a small laptop): the first screen and the checker only. */
  between: number[];
  /** Extra milliseconds to wait after the page has settled, before capturing. */
  wait: number;
  full: boolean;
  check: boolean;
  inventory: boolean;
  against: string | null;
  shots: boolean;
  help: boolean;
  /** Viewport height in CSS pixels for every width; null keeps the height chosen per width. */
  height: number | null;
  /** Emulated prefers-color-scheme; null leaves it to the machine. */
  scheme: 'light' | 'dark' | null;
  /** Tell the checker the page is an app prototype. */
  app: boolean;
  /** Targets to tap, in order, after each load and before capturing: CSS selectors or text=Label. */
  taps: string[];
  /** Every --tap, --hover and --type step, in command-line order; taps above lists the tap targets alone. */
  steps: Step[];
  /** Emulate prefers-reduced-motion: reduce. */
  reducedMotion: boolean;
  /** Viewport screenshots to take one after another, without waiting for the page to settle (--frames). */
  frames: number;
  /** Milliseconds between --frames screenshots. */
  every: number;
  /** Viewport screenshots to take at evenly spaced scroll positions down the page (--scroll-frames). */
  scrollFrames: number;
  /** --every was given (so --arrival and --transition use it instead of their own spacing). */
  everyGiven: boolean;
  /** --scenes: capture --points frames across each scroll scene. */
  scenes: boolean;
  /** Frames per scene or timeline (--points). */
  points: number;
  /** --arrival: capture the load sequence from first paint. */
  arrival: boolean;
  /** --ms: how long --arrival or --transition records; null for their defaults. */
  ms: number | null;
  /** --transition: a link selector, text=Label, or a URL to navigate to while recording. */
  transition: string | null;
  /** --timeline: names of timelines registered on window.__argus.timelines to seek through. */
  timelines: string[];
  /** --motion-metrics: frame-difference flags for every sequence captured. */
  motionMetrics: boolean;
  /** --perf-scroll: a wheel scroll through the page under 4x CPU slowdown, with frame and shift stats. */
  perfScroll: boolean;
  /** --fallbacks: captures with reduced motion, script off, WebGL off and 390px touch. */
  fallbacks: boolean;
  /** Arguments that could not be used, each as a message for the user. */
  errors: string[];
}

/** One step run before capturing: a tap on a target, the pointer moved onto one, or text typed into a field. */
export interface Step {
  kind: 'tap' | 'hover' | 'type';
  target: string;
  /** For a type step, the text to type. */
  text?: string;
}

interface Finding {
  rule: string;
  severity: string;
  where: string;
  message: string;
}

interface CheckResult {
  viewport: string;
  summary: Record<string, number>;
  countsByRule: Record<string, number>;
  findings: Finding[];
  notes: string[];
  /** Present only in app mode: the rule families the checker relaxed. */
  relaxed?: string;
}

interface CdpMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string };
  sessionId?: string;
}

// A whole tall page in one image can exhaust the browser's memory, and is too
// small to read once scaled down. Capture it as a series of slices instead.
const SLICE_HEIGHT = 1600;
const MAX_SLICES = 12;

// The widths captured by default: two phones, a laptop and a desktop monitor, each in full; then the
// in-between widths (a tablet, an awkward width between tablet and laptop, a small laptop), where
// layouts split into columns and collide, captured as the first screen with the checker only.
export const DEFAULT_WIDTHS = [320, 390, 1440, 1920] as const;
export const BETWEEN_WIDTHS = [768, 820, 1024] as const;

// Before capturing, wait until the page has been still for QUIET_MS, at least MIN_SETTLE_MS
// after load and at most SETTLE_CAP_MS. --wait adds time after that, up to MAX_WAIT_MS.
const QUIET_MS = 500;
const MIN_SETTLE_MS = 900;
const SETTLE_CAP_MS = 6000;
// Web fonts are waited for this long at most: a font that never settles (seen headless on macOS) does not hold the run.
const FONTS_WAIT_MS = 5000;
const MAX_WAIT_MS = 60000;
// --tap, --hover and --type wait this long for a target revealed on scroll to show.
const REVEAL_MS = 2000;
// --frames: at most this many, at least MIN_EVERY_MS apart. --scroll-frames: at most MAX_SCROLL_FRAMES.
const MAX_FRAMES = 60;
const MIN_EVERY_MS = 30;
const MAX_EVERY_MS = 10000;
const MAX_SCROLL_FRAMES = 40;
// --scenes and --timeline: frames per scene or timeline (--points). --arrival and --transition:
// how long they record (--ms) and how far apart the frames on their sheet are, unless --every is given.
const DEFAULT_POINTS = 9;
const MAX_POINTS = 16;
const MAX_SCENES = 8;
const MIN_MOTION_MS = 200;
const MAX_MOTION_MS = 15000;
const ARRIVAL_MS = 3000;
const ARRIVAL_EVERY_MS = 250;
const TRANSITION_MS = 1500;
const TRANSITION_EVERY_MS = 100;
// A contact sheet holds at most this many frames; a longer sequence is spaced out to fit.
const MAX_SHEET_FRAMES = 40;
// Every browser command is answered within this, or the run says so and stops: never a hang.
const SEND_TIMEOUT_MS = 45000;
// A screenshot, an input event or a recording command gets far less: they answer at once when they work.
const QUICK_TIMEOUT_MS = 10000;
// Each motion flag at each width (and the contact sheets) finishes within this, or the run stops there.
const MOTION_STEP_MS = 60000;
// The whole run, past which it prints why and exits 2: setup, then this much per width and per flag.
const RUN_BASE_MS = 60000;
const RUN_PER_STEP_MS = 60000;
// --fallbacks: at most this many screens per fallback capture.
const MAX_FALLBACK_SCREENS = 8;

export function parseArgs(argv: string[]): Options {
  const opts: Options = {
    target: null, out: 'shots', outGiven: false, widths: [...DEFAULT_WIDTHS], between: [...BETWEEN_WIDTHS], wait: 0, full: false, check: false, inventory: false, against: null, shots: true, help: false,
    height: null, scheme: null, app: false, taps: [], steps: [], errors: [],
    reducedMotion: false, frames: 0, every: 150, scrollFrames: 0,
    everyGiven: false, scenes: false, points: DEFAULT_POINTS, arrival: false, ms: null, transition: null, timelines: [],
    motionMetrics: false, perfScroll: false, fallbacks: false,
  };
  // A count flag: a whole number from 1 to max, or an error. A missing value or the next flag is an error.
  const count = (flag: string, max: number, value: string | undefined): number | null => {
    if (value !== undefined && /^\d+$/.test(value.trim())) {
      const n = parseInt(value.trim(), 10);
      if (n >= 1 && n <= max) return n;
    }
    opts.errors.push(flag + ' takes a whole number from 1 to ' + max + (value === undefined ? '' : ' (got "' + value + '")') + '.');
    return null;
  };
  let betweenAsked = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--out') {
      opts.out = argv[++i] ?? 'shots';
      opts.outGiven = true;
    } else if (a === '--widths') {
      opts.widths = String(argv[++i] ?? '').split(',').map(Number).filter((n) => n >= 200 && n <= 4000);
      // Given widths are exactly what is captured, unless --between asks for the in-between ones too.
      if (!betweenAsked) opts.between = [];
    } else if (a === '--between') {
      betweenAsked = true;
      opts.between = [...BETWEEN_WIDTHS];
    } else if (a === '--wait') {
      // Take the next word only when it looks like a number, so "--wait --full" keeps --full.
      if (/^\s*-?\d/.test(argv[i + 1] ?? '')) opts.wait = parseWait(argv[++i]);
    } else if (a === '--full' || a === '--tall') opts.full = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--inventory') opts.inventory = true;
    else if (a === '--against') {
      opts.against = argv[++i] ?? null;
      opts.inventory = true;
    }
    else if (a === '--no-shots') opts.shots = false;
    else if (a === '--height') {
      const value = argv[++i];
      const n = parseHeight(value);
      if (n === null) opts.errors.push('--height takes a whole number of CSS pixels from ' + MIN_HEIGHT + ' to ' + MAX_HEIGHT + (value === undefined ? '' : ' (got "' + value + '")') + '.');
      else opts.height = n;
    } else if (a === '--scheme') {
      const value = argv[++i];
      const v = (value ?? '').trim().toLowerCase();
      if (v === 'light' || v === 'dark') opts.scheme = v;
      else opts.errors.push('--scheme takes light or dark' + (value === undefined ? '' : ' (got "' + value + '")') + '.');
    } else if (a === '--app') opts.app = true;
    else if (a === '--reduced-motion') opts.reducedMotion = true;
    else if (a === '--frames') {
      const value = argv[++i];
      if (value !== undefined && value.startsWith('--')) i--;
      opts.frames = count('--frames', MAX_FRAMES, value) ?? 0;
    } else if (a === '--scroll-frames') {
      const value = argv[++i];
      if (value !== undefined && value.startsWith('--')) i--;
      opts.scrollFrames = count('--scroll-frames', MAX_SCROLL_FRAMES, value) ?? 0;
    } else if (a === '--every') {
      const value = argv[++i];
      const n = value !== undefined && /^\d+$/.test(value.trim()) ? parseInt(value.trim(), 10) : NaN;
      if (n >= MIN_EVERY_MS && n <= MAX_EVERY_MS) {
        opts.every = n;
        opts.everyGiven = true;
      } else {
        opts.errors.push('--every takes milliseconds from ' + MIN_EVERY_MS + ' to ' + MAX_EVERY_MS + (value === undefined ? '' : ' (got "' + value + '")') + '.');
        if (value !== undefined && value.startsWith('--')) i--;
      }
    }
    else if (a === '--tap' || a === '--hover') {
      const value = argv[++i];
      // A missing value, or the next flag, is an error; the flag is then read as itself.
      if (value === undefined || !value.trim() || value.startsWith('--')) {
        opts.errors.push(a + ' takes a CSS selector or text=Label' + (value === undefined ? '' : ' (got "' + value + '")') + '.');
        if (value !== undefined && value.startsWith('--')) i--;
      } else if (a === '--tap') {
        opts.taps.push(value.trim());
        opts.steps.push({ kind: 'tap', target: value.trim() });
      } else opts.steps.push({ kind: 'hover', target: value.trim() });
    } else if (a === '--type') {
      const value = argv[++i];
      const step = value === undefined || value.startsWith('--') ? null : parseTypeStep(value);
      if (!step) {
        opts.errors.push('--type takes a field and its text as TARGET=TEXT, where TARGET is a CSS selector or text=Label' +
          (value === undefined ? '' : ' (got "' + value + '")') + '.');
        if (value !== undefined && value.startsWith('--')) i--;
      } else opts.steps.push(step);
    }
    else if (a === '--scenes') opts.scenes = true;
    else if (a === '--arrival') opts.arrival = true;
    else if (a === '--motion-metrics') opts.motionMetrics = true;
    else if (a === '--perf-scroll') opts.perfScroll = true;
    else if (a === '--fallbacks') opts.fallbacks = true;
    else if (a === '--points') {
      const value = argv[++i];
      if (value !== undefined && value.startsWith('--')) i--;
      const n = value !== undefined && /^\d+$/.test(value.trim()) ? parseInt(value.trim(), 10) : NaN;
      if (n >= 2 && n <= MAX_POINTS) opts.points = n;
      else opts.errors.push('--points takes a whole number from 2 to ' + MAX_POINTS + (value === undefined ? '' : ' (got "' + value + '")') + '.');
    } else if (a === '--ms') {
      const value = argv[++i];
      if (value !== undefined && value.startsWith('--')) i--;
      const n = value !== undefined && /^\d+$/.test(value.trim()) ? parseInt(value.trim(), 10) : NaN;
      if (n >= MIN_MOTION_MS && n <= MAX_MOTION_MS) opts.ms = n;
      else opts.errors.push('--ms takes milliseconds from ' + MIN_MOTION_MS + ' to ' + MAX_MOTION_MS + (value === undefined ? '' : ' (got "' + value + '")') + '.');
    } else if (a === '--transition' || a === '--timeline') {
      const value = argv[++i];
      if (value === undefined || !value.trim() || value.startsWith('--')) {
        opts.errors.push(a === '--transition'
          ? '--transition takes a link to follow (a CSS selector or text=Label) or a URL to go to' + (value === undefined ? '' : ' (got "' + value + '")') + '.'
          : '--timeline takes the name of a timeline registered on window.__argus.timelines' + (value === undefined ? '' : ' (got "' + value + '")') + '.');
        if (value !== undefined && value.startsWith('--')) i--;
      } else if (a === '--transition') opts.transition = value.trim();
      else opts.timelines.push(value.trim());
    }
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (!opts.target) opts.target = a;
  }
  opts.between = opts.between.filter((w) => !opts.widths.includes(w));
  if (!opts.outGiven && opts.target) opts.out = path.join('shots', pageSlug(opts.target));
  return opts;
}

/**
 * The page's short name for its capture folder: the file or URL path without its extension, folders
 * joined by dashes, last two parts only (roughs/a.html -> roughs-a; http://localhost:5173/pricing -> pricing; a site root -> index).
 */
export function pageSlug(target: string): string {
  let p = target;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) {
    try { p = new URL(target).pathname; } catch { p = target; }
  } else p = path.relative(process.cwd(), path.resolve(target)) || path.basename(target);
  p = p.replace(/\\/g, '/').replace(/\/(index)?(\.html?)?$/i, '').replace(/\.[a-z0-9]+$/i, '');
  // The last two parts name it well enough (roughs/a, work/flux) and keep the name short.
  const name = slug(p.split('/').filter((x) => x && x !== '..' && x !== '.').slice(-2).join('-'));
  return name === 'x' ? 'index' : name;
}

/**
 * Read a --type value, TARGET=TEXT. TARGET is text=Label (the label runs to the next "=") or a
 * CSS selector (split at the first "=" outside brackets and quotes, so input[name=email]=a works).
 * TEXT may be empty, to clear a field. Returns null when there is no target or no "=".
 */
export function parseTypeStep(value: string): Step | null {
  let split = -1;
  if (/^text=/i.test(value)) split = value.indexOf('=', 5);
  else {
    let depth = 0;
    let quote = '';
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (quote) { if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") quote = c;
      else if (c === '[' || c === '(') depth++;
      else if (c === ']' || c === ')') depth = Math.max(0, depth - 1);
      else if (c === '=' && depth === 0) { split = i; break; }
    }
  }
  if (split < 0) return null;
  const target = value.slice(0, split).trim();
  if (!target || /^text=\s*$/i.test(target)) return null;
  return { kind: 'type', target, text: value.slice(split + 1) };
}

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 4000;

/** Read a --height value: a whole number of CSS pixels from 200 to 4000, else null. */
export function parseHeight(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value.trim())) return null;
  const n = parseInt(value.trim(), 10);
  return n >= MIN_HEIGHT && n <= MAX_HEIGHT ? n : null;
}

/** The viewport height at a width: --height when given, otherwise the height chosen for that kind of screen. */
export function viewportHeight(width: number, height: number | null = null): number {
  if (height !== null) return height;
  // Phones: 844 tall at 390; at 320 a 700px screen, the height the length limit is measured with (craft.md).
  return width <= 340 ? 700 : width < 600 ? 844 : width >= 1900 ? 1080 : 900;
}

/** Read a --wait value in milliseconds: a whole number from 0 to 60000; anything else is 0. */
export function parseWait(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value.trim())) return 0;
  return Math.min(MAX_WAIT_MS, parseInt(value.trim(), 10));
}

/**
 * Added to every document before its own scripts run: keeps count of the page's pending
 * one-off timers that are due within `capMs`, so the stability wait can tell that a
 * first-screen sequence still has steps to come even when the page is quiet between
 * them. Longer timers and string timers are passed through untouched; repeating
 * intervals are not counted (they never end). Changes nothing else the page sees.
 */
export function timerTrackerSource(capMs = SETTLE_CAP_MS): string {
  const cap = Math.max(0, Math.round(capMs));
  return `(() => {
  try {
    if (window.__argusTimers) return;
    const pending = new Set();
    const set = window.setTimeout;
    const clear = window.clearTimeout;
    window.__argusTimers = pending;
    window.setTimeout = function (fn, ms, ...args) {
      if (typeof fn !== 'function' || (Number(ms) || 0) > ${cap}) return set.call(window, fn, ms, ...args);
      const id = set.call(window, function (...a) { pending.delete(id); return fn.apply(this, a); }, ms, ...args);
      pending.add(id);
      return id;
    };
    window.clearTimeout = function (id) { pending.delete(id); return clear.call(window, id); };
  } catch (e) { /* leave the page's timers alone */ }
})();`;
}

/**
 * In-page source of a function that says whether a running animation is one to wait for: finite,
 * on the document's clock, and due to end within `withinMs`. Endless animations (a marquee, a
 * pulse) never end; an animation tied to scroll (animation-timeline: scroll() or view()) stands
 * still until the page scrolls, however long one waits; and one that will not end before the wait
 * is over (a slow sixteen-second drift) cannot be waited out. None of these is waited for.
 */
export const WAITABLE_ANIMATION = `(a, withinMs) => {
  if (a.playState !== 'running' || !a.effect) return false;
  if (a.timeline && typeof DocumentTimeline === 'function' && !(a.timeline instanceof DocumentTimeline)) return false;
  const t = a.effect.getComputedTiming();
  const left = Number(t.endTime) - Number(t.localTime || 0);
  return t.endTime !== Infinity && !(Number.isFinite(left) && left > withinMs);
}`;

/**
 * In-page source of a function that says whether a DOM change is too small to wait for: a style
 * attribute rewritten with every number in it within half a pixel (px values) or 0.01 (other
 * numbers) of what it was, as an idle easing loop does on every frame, or a style rewritten inside
 * an aria-hidden part (a decorative marquee track moved by script).
 */
export const MINOR_MUTATION = `(m) => {
  if (m.type !== 'attributes' || m.attributeName !== 'style') return false;
  const el = m.target;
  if (el.closest && el.closest('[aria-hidden="true"]')) return true;
  const was = String(m.oldValue || '');
  const now = String(el.getAttribute('style') || '');
  const nums = /-?(?:\\d+\\.?\\d*|\\.\\d+)(?:e-?\\d+)?(px)?/g;
  if (was.replace(nums, '#') !== now.replace(nums, '#')) return false;
  const a = Array.from(was.matchAll(nums));
  const b = Array.from(now.matchAll(nums));
  return a.length === b.length && a.every((x, i) => Math.abs(parseFloat(x[0]) - parseFloat(b[i][0])) < (x[1] ? 0.5 : 0.01));
}`;

/**
 * Evaluated in the page after load and web fonts: resolves once the page has been
 * visually still for `quietMs` (no DOM mutation of any kind, no finite animation or
 * transition running, and no pending one-off timer of the page's own, as counted by
 * timerTrackerSource), but not before `minMs` and never later than `capMs`. A first
 * screen assembled by script timers (classes added one by one, text typed in, styles
 * stepped) keeps the page changing, so the capture waits for it to finish. Ambient motion
 * is ignored: endless animations, animations tied to scroll, animations too long to end
 * before the cap, sub-pixel style rewrites from an idle easing loop, and styles rewritten
 * inside aria-hidden parts (MINOR_MUTATION). A page that never stops changing is captured
 * at the cap. Resolves to { ms, settled }.
 */
export function stableExpression(quietMs = QUIET_MS, minMs = MIN_SETTLE_MS, capMs = SETTLE_CAP_MS): string {
  const quiet = Math.max(0, Math.round(quietMs));
  const min = Math.max(0, Math.round(minMs));
  const cap = Math.max(min, Math.round(capMs));
  return `new Promise((resolve) => {
  const started = Date.now();
  let last = started;
  let observer = null;
  const minor = ${MINOR_MUTATION};
  const waitable = ${WAITABLE_ANIMATION};
  try {
    observer = new MutationObserver((list) => { if (list.some((m) => !minor(m))) last = Date.now(); });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true, attributeOldValue: true });
  } catch (e) { /* no observer: rely on animations and the clock */ }
  const animating = () => {
    if (typeof document.getAnimations !== 'function') return false;
    const left = ${cap} - (Date.now() - started);
    return document.getAnimations().some((a) => waitable(a, left));
  };
  const timers = () => (window.__argusTimers ? window.__argusTimers.size : 0) > 0;
  const tick = () => {
    const now = Date.now();
    if (animating() || timers()) last = now;
    const settled = now - started >= ${min} && now - last >= ${quiet};
    if (settled || now - started >= ${cap}) {
      if (observer) observer.disconnect();
      resolve({ ms: now - started, settled });
      return;
    }
    setTimeout(tick, 100);
  };
  setTimeout(tick, 100);
})`;
}

export function findBrowser(): string | null {
  const chosen = process.env['ARGUS_BROWSER'];
  if (chosen) return chosen;
  const candidates: string[] = [];
  if (process.platform === 'darwin') {
    for (const name of ['Google Chrome', 'Chromium', 'Brave Browser', 'Microsoft Edge', 'Google Chrome Canary', 'Vivaldi']) {
      candidates.push(`/Applications/${name}.app/Contents/MacOS/${name}`);
      candidates.push(path.join(os.homedir(), 'Applications', `${name}.app`, 'Contents', 'MacOS', name));
    }
  } else if (process.platform === 'win32') {
    const roots = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env['LOCALAPPDATA']];
    for (const root of roots) {
      if (!root) continue;
      candidates.push(path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
      candidates.push(path.join(root, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'));
      candidates.push(path.join(root, 'Chromium', 'Application', 'chrome.exe'));
    }
  } else {
    const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'brave-browser', 'microsoft-edge'];
    for (const dir of (process.env['PATH'] ?? '').split(path.delimiter)) {
      for (const n of names) candidates.push(path.join(dir, n));
    }
  }
  for (const c of candidates) {
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return c;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/**
 * Stop a browser started on a throwaway profile, then remove the profile. Waits for the process to
 * exit (asking again, harder, after `waitMs`), because a browser still running keeps writing to its
 * profile (a folder that will not empty on macOS and Linux) and holds its files locked (EBUSY on
 * Windows), and its helper processes can hold them a little longer: the removal is retried for a few
 * seconds. Never throws; a profile that still cannot be removed is left for the OS to clean.
 */
export async function stopBrowser(child: ChildProcess, profile: string, waitMs = 5000): Promise<void> {
  // A browser that never started (no pid) has nothing to wait for.
  const exited = (): boolean => child.pid === undefined || child.exitCode !== null || child.signalCode !== null;
  const exit = (ms: number): Promise<void> =>
    exited() ? Promise.resolve() : new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  if (!exited()) {
    child.kill();
    await exit(waitMs);
    if (!exited()) {
      child.kill('SIGKILL');
      await exit(2000);
    }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      return;
    } catch {
      await sleep(1000);
    }
  }
}

/**
 * Why a browser path cannot be started, as one line for the user, or null when it looks usable.
 * Only an ARGUS_BROWSER path can be wrong this way; the ones found by looking were checked already.
 */
export function browserProblem(file: string): string | null {
  const from = process.env['ARGUS_BROWSER'] === file ? 'ARGUS_BROWSER is set to ' + JSON.stringify(file) + ', but ' : JSON.stringify(file) + ': ';
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return from + 'there is no file there. Point it at a Chrome-family browser executable, or unset it to find one.';
  }
  if (stat.isDirectory()) {
    return from + 'that is a folder' + (file.endsWith('.app') ? ' (on a Mac, use the program inside it: ' + path.join(file, 'Contents', 'MacOS', path.basename(file, '.app')) + ')' : '') + '. Point it at the browser executable.';
  }
  if (process.platform !== 'win32') {
    try {
      fs.accessSync(file, fs.constants.X_OK);
    } catch {
      return from + 'that file is not executable. Point it at a Chrome-family browser executable.';
    }
  }
  return null;
}

/** Turn what the user typed into a URL the browser can open. */
export function toUrl(target: string): string | null {
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(target)) return 'http://' + target;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) return target;
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) return null;
  const parts = abs.split(path.sep).map(encodeURIComponent).join('/');
  return 'file://' + (parts.startsWith('/') ? '' : '/') + parts.replace(/^([A-Za-z])%3A/, '$1:');
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Evaluated in the page before the checker: waits for running animations and
 * transitions that will end, up to `capMs`, so the checker does not measure a page
 * mid-change. Endless animations and animations tied to scroll are ignored. Resolves to how
 * many it waited for.
 */
export function settleExpression(capMs = 2000): string {
  return `(() => {
  if (typeof document.getAnimations !== 'function') return Promise.resolve(0);
  const waitable = ${WAITABLE_ANIMATION};
  const finite = document.getAnimations().filter((a) => waitable(a, Infinity));
  if (!finite.length) return Promise.resolve(0);
  const done = Promise.all(finite.map((a) => a.finished.catch(() => null)));
  return Promise.race([done, new Promise((r) => setTimeout(r, ${Math.max(0, Math.round(capMs))}))]).then(() => finite.length);
})()`;
}

/**
 * Evaluated in the page before a full capture. Content that arrives on scroll
 * (an IntersectionObserver or a scroll listener) and lazy-loaded images only
 * appear once their part of the page has been on screen, and a capture beyond
 * the viewport does not scroll. So: scroll from top to bottom a screen at a
 * time with a short wait at each step, wait for pictures to load and for
 * animations and transitions to finish, then go back to the top and let that
 * settle too. Bounded by `capMs` in all. Resolves to the number of steps taken.
 */
export function scrollThroughExpression(stepWaitMs = 250, capMs = 20000): string {
  const wait = Math.max(0, Math.round(stepWaitMs));
  const cap = Math.max(1000, Math.round(capMs));
  return `(async () => {
  const started = Date.now();
  const left = () => Math.max(0, ${cap} - (Date.now() - started));
  const sleep = (ms) => new Promise((r) => setTimeout(r, Math.min(ms, left())));
  const go = (y) => { try { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); } };
  const frame = () => Promise.race([new Promise((r) => requestAnimationFrame(() => r())), sleep(100)]);
  const settle = (ms) => {
    if (typeof document.getAnimations !== 'function') return Promise.resolve();
    const waitable = ${WAITABLE_ANIMATION};
    const finite = document.getAnimations().filter((a) => waitable(a, Infinity));
    if (!finite.length) return Promise.resolve();
    return Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => null))), sleep(ms)]);
  };
  const images = (ms) => {
    // A lazy image the browser has not started (no source chosen yet) will not load while the page
    // stands still, so waiting for it only spends the whole timeout.
    const pending = Array.from(document.images).filter((i) => !i.complete && !(i.loading === 'lazy' && !i.currentSrc));
    if (!pending.length) return Promise.resolve();
    return Promise.race([Promise.all(pending.map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))), sleep(ms)]);
  };
  const root = document.scrollingElement || document.documentElement;
  const height = () => Math.max(root.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const step = Math.max(200, Math.floor(window.innerHeight * 0.85));
  let y = 0;
  let steps = 0;
  go(0);
  await frame();
  while (left() > 0 && steps < 200) {
    const bottom = height() - window.innerHeight;
    if (y >= bottom) break;
    y = Math.min(y + step, bottom);
    go(y);
    steps++;
    await frame();
    await sleep(${wait});
  }
  await images(4000);
  await settle(3000);
  go(0);
  await frame();
  await sleep(${wait});
  await images(2000);
  await settle(3000);
  return steps;
})()`;
}

/**
 * Evaluated in the page just before a full capture. A capture beyond the viewport does not
 * scroll, so a reveal driven by a view() timeline (a picture that unclips as it comes up the
 * screen) is drawn below the fold in its start state, often blank. This moves each animation on
 * a view timeline to the document timeline and finishes it, so it shows its end state; the
 * originals are kept on window.__argusFrozen for the restore. Animations on a scroll() timeline
 * (a progress bar, a header that shrinks) follow the page's position, which is the top, and are
 * left alone. Returns how many were finished.
 */
export function finishViewRevealsExpression(): string {
  return `(() => {
  if (typeof document.getAnimations !== 'function' || typeof ViewTimeline === 'undefined') return 0;
  const frozen = (window.__argusFrozen = window.__argusFrozen || []);
  let n = 0;
  for (const a of document.getAnimations()) {
    const t = a.timeline;
    if (!t || !(t instanceof ViewTimeline)) continue;
    frozen.push([a, t]);
    try { a.timeline = document.timeline; a.finish(); } catch (e) { try { a.cancel(); } catch (e2) {} }
    n++;
  }
  return n;
})()`;
}

/** Evaluated after a full capture: puts the view-timeline animations back on their timelines. */
export function restoreViewRevealsExpression(): string {
  return `(() => {
  const frozen = window.__argusFrozen || [];
  for (const [a, t] of frozen) { try { a.timeline = t; a.play(); } catch (e) {} }
  window.__argusFrozen = [];
  return frozen.length;
})()`;
}

// ---- PNG: just enough to join the slices of a full capture, with no dependency -------------------

/** A decoded 8-bit PNG: RGB or RGBA rows, unfiltered. */
export interface Raster {
  width: number;
  height: number;
  /** 3 for RGB, 4 for RGBA. */
  channels: number;
  data: Buffer;
}

/** Decode an 8-bit, non-interlaced RGB or RGBA PNG (what the browser's screenshots are); null for anything else. */
export function decodePng(buf: Buffer): Raster | null {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const colour = body[9];
      const interlace = body[12];
      if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) return null;
      channels = colour === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    at += 12 + len;
  }
  if (!width || !height || !channels || !idat.length) return null;
  let raw: Buffer;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) return null;
  const data = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = y * stride;
    const prior = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? data[row + x - channels]! : 0;
      const b = y > 0 ? data[prior + x]! : 0;
      const c = y > 0 && x >= channels ? data[prior + x - channels]! : 0;
      const v = line[x]!;
      let out: number;
      if (filter === 0) out = v;
      else if (filter === 1) out = v + a;
      else if (filter === 2) out = v + b;
      else if (filter === 3) out = v + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else return null;
      data[row + x] = out & 0xff;
    }
  }
  return { width, height, channels, data };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** Encode an 8-bit RGB or RGBA raster as a PNG (filter 0 on every row). */
export function encodePng(r: Raster): Buffer {
  const stride = r.width * r.channels;
  const raw = Buffer.alloc(r.height * (stride + 1));
  for (let y = 0; y < r.height; y++) r.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(r.width, 0);
  ihdr.writeUInt32BE(r.height, 4);
  ihdr[8] = 8;
  ihdr[9] = r.channels === 4 ? 6 : 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Join PNG slices of one width top to bottom into one PNG; null when they cannot be joined (another format or width). */
export function stitchPngs(slices: Buffer[]): Buffer | null {
  const rasters = slices.map(decodePng);
  const first = rasters[0];
  if (!first || rasters.some((x) => !x || x.width !== first.width || x.channels !== first.channels)) return null;
  const height = rasters.reduce((h, x) => h + x!.height, 0);
  const data = Buffer.concat(rasters.map((x) => x!.data));
  return encodePng({ width: first.width, height, channels: first.channels, data });
}

// ---- Motion: frame metrics, contact sheets, and the in-page parts of the motion flags ------------

/**
 * Thresholds for --motion-metrics. Conservative on purpose: the flags are advice for a person or a
 * model looking at the contact sheet, never a gate. Fractions are shares of the sampled pixels.
 */
export const MOTION_LIMITS = {
  /** A pixel counts as changed when one of its channels moved by more than this (0-255). */
  CHANGE_DELTA: 24,
  /** dead: no step in the sequence changes more than this share of the frame. */
  DEAD: 0.002,
  /** pop: one step changes more than this share... */
  POP: 0.25,
  /** ...while its neighbouring steps change less than this (they are still). */
  STILL: 0.01,
  /** flash: a frame almost all near-white or near-black (this share)... */
  FLASH_UNIFORM: 0.9,
  /** ...whose mean brightness differs from its neighbours by more than this (0-1). */
  FLASH_LUMA: 0.35,
  /** not-settled: the last step of a timed sequence still changes more than this share. */
  SETTLED: 0.005,
  /** blank-canvas / empty-screen: this share of a region within FLAT_TOLERANCE of one colour (a line of small text on an empty screen is still content). */
  FLAT: 0.9995,
  FLAT_TOLERANCE: 6,
  /** Canvases smaller than this (CSS px, either side) are not checked. */
  MIN_CANVAS: 24,
} as const;

/** A frame reduced for comparison: every `step`-th pixel in each direction, RGB. */
export interface FrameSample {
  width: number;
  height: number;
  /** The sampling step, so rectangles in page pixels can be mapped onto the sample. */
  step: number;
  rgb: Uint8Array;
}

/** A rectangle in CSS pixels of the captured frame. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sample a decoded frame: every `step`-th pixel in each direction, as RGB. */
export function sampleRaster(r: Raster, step = 2): FrameSample {
  const s = Math.max(1, Math.round(step));
  const width = Math.ceil(r.width / s);
  const height = Math.ceil(r.height / s);
  const rgb = new Uint8Array(width * height * 3);
  let o = 0;
  for (let y = 0; y < r.height; y += s) {
    for (let x = 0; x < r.width; x += s) {
      const i = (y * r.width + x) * r.channels;
      rgb[o++] = r.data[i]!;
      rgb[o++] = r.data[i + 1]!;
      rgb[o++] = r.data[i + 2]!;
    }
  }
  return { width, height, step: s, rgb };
}

/** Share of sampled pixels that changed between two frames (1 when their sizes differ). */
export function changedFraction(a: FrameSample, b: FrameSample, delta: number = MOTION_LIMITS.CHANGE_DELTA): number {
  if (a.width !== b.width || a.height !== b.height) return 1;
  const n = a.width * a.height;
  if (!n) return 0;
  let changed = 0;
  for (let i = 0; i < n * 3; i += 3) {
    if (Math.abs(a.rgb[i]! - b.rgb[i]!) > delta || Math.abs(a.rgb[i + 1]! - b.rgb[i + 1]!) > delta || Math.abs(a.rgb[i + 2]! - b.rgb[i + 2]!) > delta) changed++;
  }
  return changed / n;
}

/** Mean brightness of a frame, 0 (black) to 1 (white), and the shares of near-white and near-black pixels. */
export function brightness(a: FrameSample): { luma: number; white: number; black: number } {
  const n = a.width * a.height;
  if (!n) return { luma: 0, white: 0, black: 0 };
  let sum = 0;
  let white = 0;
  let black = 0;
  for (let i = 0; i < n * 3; i += 3) {
    const l = (0.2126 * a.rgb[i]! + 0.7152 * a.rgb[i + 1]! + 0.0722 * a.rgb[i + 2]!) / 255;
    sum += l;
    if (l > 0.94) white++;
    else if (l < 0.06) black++;
  }
  return { luma: sum / n, white: white / n, black: black / n };
}

/**
 * Whether a region of a frame (CSS pixels; the whole frame when omitted) is one flat colour: at
 * least FLAT of its sampled pixels within FLAT_TOLERANCE of its most common colour. A region too
 * small to judge is not flat.
 */
export function isFlat(a: FrameSample, rect?: Rect): boolean {
  const x0 = Math.max(0, Math.floor((rect ? rect.x : 0) / a.step));
  const y0 = Math.max(0, Math.floor((rect ? rect.y : 0) / a.step));
  const x1 = Math.min(a.width, Math.ceil((rect ? rect.x + rect.w : a.width * a.step) / a.step));
  const y1 = Math.min(a.height, Math.ceil((rect ? rect.y + rect.h : a.height * a.step) / a.step));
  const n = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  if (n < 16) return false;
  const counts = new Map<number, number>();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * a.width + x) * 3;
      // Bucket by 8 levels per channel to find the common colour cheaply.
      const key = ((a.rgb[i]! >> 3) << 10) | ((a.rgb[i + 1]! >> 3) << 5) | (a.rgb[i + 2]! >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let mode = 0;
  let best = -1;
  for (const [k, c] of counts) if (c > best) { best = c; mode = k; }
  const mr = ((mode >> 10) & 31) * 8 + 4;
  const mg = ((mode >> 5) & 31) * 8 + 4;
  const mb = (mode & 31) * 8 + 4;
  const tol = MOTION_LIMITS.FLAT_TOLERANCE + 4;
  let near = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * a.width + x) * 3;
      if (Math.abs(a.rgb[i]! - mr) <= tol && Math.abs(a.rgb[i + 1]! - mg) <= tol && Math.abs(a.rgb[i + 2]! - mb) <= tol) near++;
    }
  }
  return near / n >= MOTION_LIMITS.FLAT;
}

export type MotionFlagKind = 'dead' | 'pop' | 'flash' | 'not-settled' | 'blank-canvas' | 'empty-screen';

export interface MotionFlag {
  flag: MotionFlagKind;
  /** The frame index (0-based) the flag points at, where it points at one. */
  frame?: number;
  message: string;
}

/** A captured sequence as the metrics see it. */
export interface MotionSequence {
  name: string;
  /** time: frames over time (arrival, transition, --frames); scroll: scroll positions; progress: a seeked timeline; screens: a fallback capture. */
  kind: 'time' | 'scroll' | 'progress' | 'screens';
  labels: string[];
  frames: FrameSample[];
  /** On-screen canvas rectangles per frame, where known. */
  canvases?: Rect[][];
}

export interface SequenceMetrics {
  name: string;
  kind: MotionSequence['kind'];
  frames: number;
  /** Share of pixels changed at each step (frame i to i+1), rounded to 4 places. */
  changes: number[];
  /** Label of the last frame that still changed (time sequences), null when nothing changed. */
  settledAt: string | null;
  flags: MotionFlag[];
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;
const pct = (n: number): string => (n * 100 >= 10 ? Math.round(n * 100) : Math.round(n * 1000) / 10) + '%';

/** Frame-difference metrics and advisory flags for one sequence. */
export function motionMetrics(seq: MotionSequence): SequenceMetrics {
  const L = MOTION_LIMITS;
  const f = seq.frames;
  const label = (i: number): string => seq.labels[i] ?? 'frame ' + (i + 1);
  const changes: number[] = [];
  for (let i = 0; i + 1 < f.length; i++) changes.push(changedFraction(f[i]!, f[i + 1]!));
  const flags: MotionFlag[] = [];
  const moving = seq.kind !== 'screens';
  // A recording over time can open on frames painted before the page drew anything (the bare ground
  // after navigation; how many depends on how busy the machine is). Drawing the page is not motion:
  // dead and pop are judged from the first frame with content on it. A flash still sees those frames.
  let lead = 0;
  if (seq.kind === 'time') {
    while (lead < f.length && isFlat(f[lead]!)) lead++;
    if (lead === f.length) lead = 0;
  }
  if (moving && f.length - lead >= 3 && changes.slice(lead).every((c) => c < L.DEAD)) {
    flags.push({ flag: 'dead', message: `nothing changes across ${f.length - lead} frames (${label(lead)} to ${label(f.length - 1)}): the motion did not run, or ran before the capture` });
  }
  if (moving) {
    changes.forEach((c, i) => {
      if (c <= L.POP || i < lead) return;
      const before = i > 0 ? changes[i - 1] : undefined;
      const after = i + 1 < changes.length ? changes[i + 1] : undefined;
      if (before === undefined && after === undefined) return;
      if ((before === undefined || before < L.STILL) && (after === undefined || after < L.STILL)) {
        flags.push({ flag: 'pop', frame: i + 1, message: `${pct(c)} of the frame changes at once between ${label(i)} and ${label(i + 1)} while the steps either side are still: a jump, not a movement` });
      }
    });
    const b = f.map(brightness);
    b.forEach((x, i) => {
      if (Math.max(x.white, x.black) < L.FLASH_UNIFORM) return;
      const prev = i > 0 ? b[i - 1] : undefined;
      const next = i + 1 < b.length ? b[i + 1] : undefined;
      if (!prev && !next) return;
      const far = (o: typeof x | undefined): boolean => o === undefined || Math.abs(o.luma - x.luma) > L.FLASH_LUMA;
      // In the middle both neighbours must differ (a spike); at either end, the one neighbour.
      if (far(prev) && far(next)) {
        flags.push({ flag: 'flash', frame: i, message: `${label(i)} is almost all ${x.white >= x.black ? 'white' : 'black'} while ${prev ? 'the frames around it are' : 'the next frame is'} not: a flash` });
      }
    });
  }
  let settledAt: string | null = null;
  if (seq.kind === 'time') {
    let last = -1;
    changes.forEach((c, i) => { if (c > L.SETTLED) last = i + 1; });
    settledAt = last >= 0 ? label(last) : null;
    const end = changes[changes.length - 1];
    if (end !== undefined && end > L.SETTLED && f.length >= 3) {
      flags.push({ flag: 'not-settled', frame: f.length - 1, message: `still changing at the end (${pct(end)} between the last two frames, ${label(f.length - 1)}): record longer (--ms); if it is an endless ambient loop, that is expected, otherwise it never comes to rest` });
    }
  }
  if (seq.canvases) {
    // Judged on the last frame that has canvases on screen: a canvas still one flat colour there drew nothing.
    for (let i = f.length - 1; i >= 0; i--) {
      const rects = (seq.canvases[i] ?? []).filter((r) => r.w >= L.MIN_CANVAS && r.h >= L.MIN_CANVAS);
      if (!rects.length) continue;
      const flat = rects.filter((r) => isFlat(f[i]!, r));
      if (flat.length) {
        const r = flat[0]!;
        flags.push({ flag: 'blank-canvas', frame: i, message: `${flat.length === 1 ? 'a canvas' : flat.length + ' canvases'} (${Math.round(r.w)}x${Math.round(r.h)} at ${Math.round(r.x)},${Math.round(r.y)}) ${flat.length === 1 ? 'is' : 'are'} one flat colour at ${label(i)}: nothing drawn, a lost context, a tainted texture, or no WebGL here` });
      }
      break;
    }
  }
  if (seq.kind === 'screens') {
    f.forEach((x, i) => {
      if (isFlat(x)) flags.push({ flag: 'empty-screen', frame: i, message: `${label(i)} is one flat colour: nothing shows there (content hidden by a start state set in CSS or a reveal that never ran, or an empty stretch)` });
    });
  }
  return { name: seq.name, kind: seq.kind, frames: f.length, changes: changes.map(round4), settledAt, flags };
}

/** A few plain lines summing up the metrics of every sequence. */
export function metricsSummary(list: SequenceMetrics[]): string[] {
  const out: string[] = [];
  for (const m of list) {
    const peak = m.changes.length ? Math.max(...m.changes) : 0;
    const head = `${m.name}: ${m.frames} frames` + (m.kind === 'screens' ? '' : `, largest step ${pct(peak)}`) + (m.kind === 'time' ? (m.settledAt ? `, last change at ${m.settledAt}` : ', no change at all') : '');
    out.push(head + (m.flags.length ? '' : ', no flags'));
    for (const f of m.flags) out.push(`  ${f.flag}: ${f.message}`);
  }
  return out;
}

/** Layout of a contact sheet: a grid of tiles with a label strip under each and a title strip on top. */
export interface SheetLayout {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  gap: number;
  labelH: number;
  headH: number;
  width: number;
  height: number;
}

/** Lay out a sheet of n frames of frameW x frameH, at most maxWidth wide; tiles never larger than the frames. */
export function sheetLayout(n: number, frameW: number, frameH: number, maxWidth = 1600): SheetLayout {
  const count = Math.max(1, n);
  const portrait = frameH > frameW * 1.1;
  const cols = portrait
    ? Math.min(count, count <= 6 ? count : count <= 12 ? 6 : 8)
    : Math.min(count, count <= 2 ? count : count <= 4 ? 2 : count <= 9 ? 3 : count <= 16 ? 4 : 5);
  const rows = Math.ceil(count / cols);
  const gap = 8;
  const labelH = 24;
  const headH = 36;
  const tileW = Math.max(60, Math.min(frameW, Math.floor((maxWidth - gap * (cols + 1)) / cols)));
  const tileH = Math.max(40, Math.round((tileW * frameH) / Math.max(1, frameW)));
  return { cols, rows, tileW, tileH, gap, labelH, headH, width: gap + cols * (tileW + gap), height: headH + rows * (tileH + labelH + gap) + gap };
}

/** Indices of at most `max` frames spread evenly over n, first and last kept. */
export function spreadIndices(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < max; k++) out.push(Math.round((k * (n - 1)) / (max - 1)));
  return Array.from(new Set(out));
}

/**
 * For a recording (screencast frames at the times they arrived, in ms from the start), the frame on
 * screen at each multiple of `every` from 0 to `ms`: the last one that had arrived by then. Times
 * before the first frame arrived are left out. Returns [time, index] pairs.
 */
export function heldFrames(times: number[], ms: number, every: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (!times.length) return out;
  for (let t = 0; t <= ms + 0.5; t += every) {
    let idx = -1;
    for (let i = 0; i < times.length; i++) if (times[i]! <= t) idx = i;
    if (idx >= 0) out.push([Math.round(t), idx]);
  }
  return out;
}

/** In-page script for the contact-sheet tab: draws frames into one canvas and hands it back as a PNG. */
export const SHEET_SCRIPT = `window.__sheet = {
  init(L, title) {
    const c = document.createElement('canvas');
    c.width = L.width; c.height = L.height;
    const g = c.getContext('2d');
    g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#f2f2f2'; g.font = '600 15px Menlo, Consolas, monospace'; g.textBaseline = 'middle';
    g.fillText(title, L.gap, L.headH / 2);
    this.c = c; this.g = g; this.L = L;
    return true;
  },
  async add(i, src, label) {
    const L = this.L, g = this.g;
    const img = await createImageBitmap(await (await fetch(src)).blob());
    const col = i % L.cols, row = Math.floor(i / L.cols);
    const x = L.gap + col * (L.tileW + L.gap);
    const y = L.headH + row * (L.tileH + L.labelH + L.gap);
    g.drawImage(img, x, y, L.tileW, L.tileH);
    g.strokeStyle = '#555'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, L.tileW - 1, L.tileH - 1);
    g.fillStyle = '#f2f2f2'; g.font = '500 13px Menlo, Consolas, monospace'; g.textBaseline = 'middle';
    let text = label;
    while (text.length > 4 && g.measureText(text).width > L.tileW) text = text.slice(0, -2);
    g.fillText(text, x, y + L.tileH + L.labelH / 2);
    return true;
  },
  done() { return this.c.toDataURL('image/png').split(',')[1]; },
}; true`;

/** In-page: the on-screen rectangles of the page's canvases (clipped to the viewport). */
export const CANVAS_RECTS = `Array.from(document.querySelectorAll('canvas')).map((c) => {
  const r = c.getBoundingClientRect();
  const cs = getComputedStyle(c);
  if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return null;
  const x = Math.max(0, r.left), y = Math.max(0, r.top);
  const w = Math.min(innerWidth, r.right) - x, h = Math.min(innerHeight, r.bottom) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}).filter(Boolean)`;

/** In-page: whether this browser can make a WebGL context at all. */
export const WEBGL_PROBE = `(() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })()`;

/**
 * In-page, for --check: pictures with a canvas laid over at least half of them (a WebGL or 2D layer
 * that redraws the picture). Each is scrolled to the middle of the screen in turn by
 * canvasOverPictureAtExpression, so a canvas that draws only when its picture is on screen is judged
 * there. Resolves to [{ canvas, img, where }]: indexes into document's canvases and images.
 */
export const CANVAS_OVER_PICTURES = `(() => {
  const canvases = Array.from(document.querySelectorAll('canvas'));
  const imgs = Array.from(document.images);
  const out = [];
  const page = (r) => ({ l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY });
  canvases.forEach((c, ci) => {
    const cs = getComputedStyle(c);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const fixed = cs.position === 'fixed';
    const cr = c.getBoundingClientRect();
    if (cr.width < 40 || cr.height < 40) return;
    imgs.forEach((img, ii) => {
      const ir = img.getBoundingClientRect();
      if (ir.width < 40 || ir.height < 40 || out.length >= 8) return;
      // A fixed canvas covers whatever is under it once scrolled there; otherwise compare page boxes.
      const a = fixed ? { l: cr.left, t: 0, r: cr.right, b: Infinity } : page(cr);
      const b = fixed ? { l: ir.left, t: 0, r: ir.right, b: 1 } : page(ir);
      const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
      const h = fixed ? (cr.height >= innerHeight * 0.9 ? ir.height : 0) : Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (w * h < ir.width * ir.height * 0.5) return;
      const url = img.currentSrc || img.src || '';
      const src = url.startsWith('data:') ? '' : url.split('/').pop().split('?')[0].slice(0, 60);
      const alt = (img.getAttribute('alt') || '').slice(0, 40);
      out.push({ canvas: ci, img: ii, where: 'canvas over img' + (src ? ' ' + src : alt ? ' "' + alt + '"' : ' ' + (ii + 1)) });
    });
  });
  return out;
})()`;

/** In-page: scroll picture i to the middle of the screen, wait for frames to draw, return its box on screen. */
export function pictureOnScreenExpression(i: number): string {
  return `(async () => {
  const img = document.images[${Math.max(0, Math.round(i))}];
  if (!img) return null;
  img.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  // A frame, or 100ms where the browser draws no frames (headless with no display): never a hang.
  for (let k = 0; k < 4; k++) await Promise.race([new Promise((r) => requestAnimationFrame(() => r())), new Promise((r) => setTimeout(r, 100))]);
  await new Promise((r) => setTimeout(r, 400));
  const r = img.getBoundingClientRect();
  const x = Math.max(0, r.left), y = Math.max(0, r.top);
  const w = Math.min(innerWidth, r.right) - x, h = Math.min(innerHeight, r.bottom) - y;
  return w >= 24 && h >= 24 ? { x: Math.round(x), y: Math.round(y), w: Math.floor(w), h: Math.floor(h) } : null;
})()`;
}

/** Added before a page's scripts for the WebGL-off fallback: every WebGL context request returns null. */
export const NO_WEBGL_SOURCE = `(() => {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    if (/webgl|webgpu/i.test(String(kind))) return null;
    return get.call(this, kind, ...rest);
  };
  if (typeof OffscreenCanvas !== 'undefined') {
    const off = OffscreenCanvas.prototype.getContext;
    OffscreenCanvas.prototype.getContext = function (kind, ...rest) { return /webgl|webgpu/i.test(String(kind)) ? null : off.call(this, kind, ...rest); };
  }
  try { Object.defineProperty(navigator, 'gpu', { value: undefined }); } catch (e) {}
})();`;

/**
 * In-page: the page's scroll scenes as [{ name, start, end, source }] in scroll pixels, from the first
 * source that has any: window.__argus.scenes (each a ScrollTrigger-like { start, end }, an object with
 * scrollTrigger, a trigger selector or element, or a selector string), then ScrollTrigger.getAll(),
 * then sticky elements inside a taller parent and CSS scroll-driven animations (animation-timeline:
 * view() across the element's pass through the screen, scroll() across the page), then the whole
 * page (unless wholePage is false). At most MAX_SCENES.
 */
export function scenesExpression(max = MAX_SCENES, wholePage = true): string {
  return `(() => {
  const vh = innerHeight;
  const root = document.scrollingElement || document.documentElement;
  const bottom = Math.max(0, root.scrollHeight - vh);
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  const describe = (el) => !el || !el.tagName ? '' : el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/)[0] : '');
  const out = [];
  try { if (window.ScrollTrigger && ScrollTrigger.refresh) ScrollTrigger.refresh(); } catch (e) {}
  const reg = window.__argus;
  if (reg && Array.isArray(reg.scenes)) reg.scenes.forEach((s, i) => {
    try {
      const name = String((s && typeof s === 'object' && (s.name || s.id)) || (typeof s === 'string' ? s : 'scene-' + (i + 1)));
      const st = s && typeof s === 'object' ? (s.scrollTrigger || (typeof s.start === 'number' && typeof s.end === 'number' ? s : null)) : null;
      if (st && typeof st.start === 'number' && typeof st.end === 'number') { out.push({ name, start: st.start, end: st.end, source: 'window.__argus.scenes' }); return; }
      const t = typeof s === 'string' ? s : s && s.trigger;
      const el = typeof t === 'string' ? document.querySelector(t) : t instanceof Element ? t : null;
      if (el) { const y = top(el); out.push({ name, start: y, end: y + el.offsetHeight - vh, source: 'window.__argus.scenes' }); }
    } catch (e) {}
  });
  if (!out.length && window.ScrollTrigger && typeof ScrollTrigger.getAll === 'function') {
    ScrollTrigger.getAll().forEach((st, i) => {
      // Scenes are pinned or scrubbed; a once-only reveal trigger is not one.
      if (st.end > st.start + 10 && (st.pin || (st.vars && st.vars.scrub))) out.push({ name: (st.vars && st.vars.id) || describe(st.pin || st.trigger) || 'trigger-' + (i + 1), start: st.start, end: st.end, source: 'ScrollTrigger' });
    });
  }
  if (!out.length) {
    const seen = new Set();
    const all = document.body ? document.body.querySelectorAll('*') : [];
    for (let i = 0; i < all.length && i < 6000; i++) {
      const el = all[i];
      if (getComputedStyle(el).position !== 'sticky') continue;
      const p = el.parentElement;
      if (!p || seen.has(p) || p.offsetHeight < vh * 1.3) continue;
      seen.add(p);
      const y = top(p);
      out.push({ name: describe(p) || 'sticky-' + seen.size, start: y, end: y + p.offsetHeight - vh, source: 'sticky' });
    }
    // CSS scroll-driven animations: one scene per outermost animated element.
    const driven = [];
    for (let i = 0; i < all.length && i < 6000; i++) {
      const el = all[i];
      const tl = getComputedStyle(el).animationTimeline || '';
      if (!tl || /^(auto|none)(,\\s*(auto|none))*$/.test(tl) || driven.some((d) => d.contains(el))) continue;
      driven.push(el);
      const y = top(el);
      const whole = /scroll\\(/.test(tl) && !/view\\(/.test(tl);
      out.push({ name: describe(el) || 'scroll-driven-' + driven.length, start: whole ? 0 : y - vh, end: whole ? bottom : y + el.offsetHeight, source: 'animation-timeline' });
    }
  }
  if (!out.length && ${wholePage ? 'true' : 'false'}) out.push({ name: 'page', start: 0, end: bottom, source: 'whole page' });
  return out
    .map((s) => ({ name: String(s.name).slice(0, 60), start: Math.max(0, Math.min(bottom, Math.round(s.start))), end: Math.max(0, Math.min(bottom, Math.round(s.end))), source: s.source }))
    .filter((s) => s.end > s.start)
    .slice(0, ${Math.max(1, Math.round(max))});
})()`;
}

/**
 * In-page, for --scenes: go to scroll position y through the page's smooth-scroll library when it has
 * one (window.__argus.lenis or window.lenis, jumped there at once), update ScrollTrigger and finish
 * any scrub lag, so the frame shows the scene at that position rather than catching up to it.
 */
export function seekScrollExpression(y: number, pauseMs = 250): string {
  const top = Math.max(0, Math.round(y));
  return `(async () => {
  const reg = window.__argus || {};
  const lenis = reg.lenis || window.lenis;
  if (lenis && typeof lenis.scrollTo === 'function') { try { lenis.scrollTo(${top}, { immediate: true, force: true }); } catch (e) {} }
  try { window.scrollTo({ top: ${top}, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, ${top}); }
  const catchUp = () => {
    if (!window.ScrollTrigger) return;
    try {
      ScrollTrigger.update();
      ScrollTrigger.getAll().forEach((st) => { const t = st.getTween && st.getTween(); if (t) t.progress(1); });
    } catch (e) {}
  };
  const frame = () => Promise.race([new Promise((r) => requestAnimationFrame(() => r())), new Promise((r) => setTimeout(r, 100))]);
  catchUp();
  await frame();
  catchUp();
  await frame();
  await new Promise((r) => setTimeout(r, ${Math.max(0, Math.round(pauseMs))}));
  catchUp();
  await frame();
  return Math.round(window.scrollY);
})()`;
}

/**
 * In-page, for --timeline: pause the timeline registered as window.__argus.timelines[name] and seek it
 * to progress p (0 to 1), then wait two frames. With p null, put it back as it was (progress and
 * paused state remembered on the first seek). Resolves to { ok, progress } or { ok: false, error }.
 */
export function seekTimelineExpression(name: string, p: number | null): string {
  return `(async () => {
  const reg = window.__argus;
  const all = reg && reg.timelines ? reg.timelines : null;
  const tl = all ? all[${JSON.stringify(name)}] : null;
  if (!tl || typeof tl.progress !== 'function') {
    return { ok: false, error: all ? 'no timeline "' + ${JSON.stringify(name)} + '" on window.__argus.timelines (it has: ' + (Object.keys(all).join(', ') || 'none') + ')' : 'the page registers no timelines (window.__argus.timelines is missing)' };
  }
  const saved = (window.__argusSeek = window.__argusSeek || {});
  const key = ${JSON.stringify(name)};
  const frame = () => Promise.race([new Promise((r) => requestAnimationFrame(() => r())), new Promise((r) => setTimeout(r, 100))]);
  if (!saved[key]) {
    saved[key] = { progress: tl.progress(), paused: typeof tl.paused === 'function' ? tl.paused() : false, y: window.scrollY };
    // Bring what the timeline moves on screen first: a scroll-bound timeline at its start position
    // (its pinned scene then fills the screen), any other at its first target.
    const st = tl.scrollTrigger;
    if (st && typeof st.start === 'number') {
      const lenis = (reg && reg.lenis) || window.lenis;
      if (lenis && typeof lenis.scrollTo === 'function') { try { lenis.scrollTo(st.start, { immediate: true, force: true }); } catch (e) {} }
      try { window.scrollTo({ top: st.start, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, st.start); }
      try { ScrollTrigger.update(); } catch (e) {}
      await frame();
    } else {
      try {
        const kids = typeof tl.getChildren === 'function' ? tl.getChildren(true, true, false) : [];
        const el = kids.length && kids[0].targets ? kids[0].targets()[0] : null;
        if (el instanceof Element) {
          const r = el.getBoundingClientRect();
          if (r.bottom < 0 || r.top > innerHeight) el.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
      } catch (e) {}
    }
    await frame();
  }
  // A scrub tween left running would pull the timeline back to the scroll position: finish it first.
  try { const t = tl.scrollTrigger && tl.scrollTrigger.getTween && tl.scrollTrigger.getTween(); if (t) t.progress(1); } catch (e) {}
  const p = ${p === null ? 'null' : Math.max(0, Math.min(1, p))};
  if (p === null) {
    tl.progress(saved[key].progress);
    if (typeof tl.paused === 'function') tl.paused(saved[key].paused);
    try { window.scrollTo({ top: saved[key].y, left: 0, behavior: 'instant' }); } catch (e) {}
    delete saved[key];
  } else {
    if (typeof tl.pause === 'function') tl.pause();
    tl.progress(p);
  }
  await frame();
  await frame();
  return { ok: true, progress: tl.progress() };
})()`;
}

/**
 * Limits for --perf-scroll, advisory. A frame is long when the gap between animation frames is over
 * LONG_FRAME_MS; a long animation frame (Chrome's long-animation-frame entries) counts when it blocks
 * for over BLOCKING_MS; layout shift is summed without the input exclusion window.
 */
export const PERF_LIMITS = {
  LONG_FRAME_MS: 20,
  LONG_FRAME_SHARE: 0.05,
  BLOCKING_MS: 50,
  CLS: 0.05,
  CPU_SLOWDOWN: 4,
  WHEEL_DELTA: 100,
  WHEEL_EVERY_MS: 40,
  MAX_SCROLL_MS: 12000,
} as const;

/** In-page: start recording frame gaps, long animation frames, long tasks and layout shifts. */
export const PERF_START = `(() => {
  const rec = (window.__argusPerf = { gaps: [], loaf: [], tasks: [], shift: 0, shifts: 0, running: true, observers: [] });
  let last = performance.now();
  const loop = (t) => { if (!rec.running) return; rec.gaps.push(t - last); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop); });
  const watch = (type, fn) => { try { const o = new PerformanceObserver((l) => l.getEntries().forEach(fn)); o.observe({ type, buffered: false }); rec.observers.push(o); return true; } catch (e) { return false; } };
  rec.hasLoaf = watch('long-animation-frame', (e) => rec.loaf.push({ duration: e.duration, blocking: e.blockingDuration || 0 }));
  watch('longtask', (e) => rec.tasks.push(e.duration));
  watch('layout-shift', (e) => { rec.shift += e.value; rec.shifts++; });
  return true;
})()`;

/** In-page: stop recording and return the raw numbers. */
export const PERF_STOP = `(() => {
  const rec = window.__argusPerf;
  if (!rec) return null;
  rec.running = false;
  rec.observers.forEach((o) => { try { o.disconnect(); } catch (e) {} });
  return { gaps: rec.gaps.slice(1), loaf: rec.loaf, tasks: rec.tasks, shift: rec.shift, shifts: rec.shifts, hasLoaf: rec.hasLoaf };
})()`;

export interface PerfRaw {
  gaps: number[];
  loaf: Array<{ duration: number; blocking: number }>;
  tasks: number[];
  shift: number;
  shifts: number;
  hasLoaf: boolean;
}

export interface PerfSummary {
  frames: number;
  longFrameShare: number;
  p95Ms: number;
  worstMs: number;
  blockingFrames: number;
  worstBlockingMs: number;
  longTasks: number;
  cls: number;
  hasLoaf: boolean;
  advice: string[];
}

/** Sum up a --perf-scroll recording, with advice where it passes a limit. */
export function summarisePerf(raw: PerfRaw): PerfSummary {
  const L = PERF_LIMITS;
  const gaps = raw.gaps.filter((g) => g > 0 && g < 5000);
  const sorted = [...gaps].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]! : 0;
  const longShare = gaps.length ? gaps.filter((g) => g > L.LONG_FRAME_MS).length / gaps.length : 0;
  const blocking = raw.loaf.filter((l) => l.blocking > L.BLOCKING_MS);
  const worstBlocking = raw.loaf.reduce((m, l) => Math.max(m, l.blocking), 0);
  const advice: string[] = [];
  if (longShare > L.LONG_FRAME_SHARE) advice.push(`${pct(longShare)} of frames took over ${L.LONG_FRAME_MS}ms (aim under ${pct(L.LONG_FRAME_SHARE)}): lighten what runs on scroll, or lower the canvas resolution`);
  if (blocking.length) advice.push(`${blocking.length} animation frame${blocking.length === 1 ? '' : 's'} blocked the main thread for over ${L.BLOCKING_MS}ms (worst ${Math.round(worstBlocking)}ms): split the work or move it off scroll`);
  if (raw.shift > L.CLS) advice.push(`layout shifted by ${raw.shift.toFixed(3)} during the scroll (aim under ${L.CLS}): reserve space for what loads or pins`);
  return {
    frames: gaps.length, longFrameShare: round4(longShare), p95Ms: Math.round(p95 * 10) / 10, worstMs: Math.round((sorted[sorted.length - 1] ?? 0) * 10) / 10,
    blockingFrames: blocking.length, worstBlockingMs: Math.round(worstBlocking), longTasks: raw.tasks.length, cls: Math.round(raw.shift * 10000) / 10000, hasLoaf: raw.hasLoaf, advice,
  };
}

/** A short name for a file: lower case letters, digits and dashes. */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
}

/**
 * In-page helpers shared by --tap, --hover and --type. visible: laid out and not hidden or
 * transparent by checkVisibility. rendered: laid out, though perhaps not shown yet (content that
 * fades, slides or unclips in once scrolled into view). shown: visible, not mostly transparent and
 * not clipped away, on the element or any ancestor.
 */
const SHOWN_HELPERS = `  const visible = (el) => {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Laid out but perhaps not shown yet: content that fades, slides or unclips in once scrolled into view.
  const rendered = (el) => {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Shown: visible, not mostly transparent, and not clipped away, on the element or any ancestor.
  const shown = (el) => {
    if (!visible(el)) return false;
    let opacity = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      opacity *= parseFloat(cs.opacity) || 0;
      if (cs.visibility === 'hidden') return false;
      if (/inset\\(\\s*(50|100)%|circle\\(\\s*0|polygon\\(\\s*0(px|%)?\\s+0(px|%)?\\s*\\)/.test(cs.clipPath || '')) return false;
      if (/rect\\(\\s*0(px)?[ ,]+0(px)?[ ,]+0(px)?[ ,]+0(px)?\\s*\\)/.test(cs.clip || '')) return false;
    }
    return opacity >= 0.1;
  };`;

/** In-page: scroll el into view, then give content revealed on scroll up to revealMs to show. */
function revealExpression(revealMs: number): string {
  return `  try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); } catch (e) { el.scrollIntoView(); }
  // Content revealed on scroll arrives after it comes into view: wait for it to show, up to a limit.
  const started = Date.now();
  while (!shown(el) && Date.now() - started < ${Math.max(0, Math.round(revealMs))}) await new Promise((r) => setTimeout(r, 100));
  if (!shown(el)) return { ok: false, error: 'it is still hidden ${Math.round(revealMs / 100) / 10}s after being scrolled into view (transparent, invisible or clipped)' };`;
}

/**
 * Text as a person reads it, for matching a typed text=Label against the page: compatibility forms
 * folded (NFKC: no-break and other wide spaces, ligatures, full-width letters, the ellipsis), curly
 * and other look-alike quotes made straight, dashes made hyphens, invisible characters (zero-width
 * spaces and joiners, soft hyphens) dropped, and runs of whitespace made one space. Case is kept.
 * Runs in Node and, as its own source, in the page, so both sides are normalised the same way.
 */
export function normaliseText(s: unknown): string {
  return String(s == null ? '' : s)
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u02BC\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * In-page: up to five visible texts nearest to the wanted one, for the message when nothing matches.
 * Ranked by how many of the wanted words each holds, then by being on screen; each cut to 60 characters.
 */
const NEAREST_HELPER = `  const nearest = (list, want, textOf) => {
    const words = want.toLowerCase().split(/[^\\p{L}\\p{N}']+/u).filter((w) => w.length > 1);
    const seen = new Set();
    const scored = [];
    list.forEach((c, i) => {
      const t = textOf(c);
      if (!t || seen.has(t.toLowerCase())) return;
      seen.add(t.toLowerCase());
      const low = t.toLowerCase();
      const r = c.getBoundingClientRect ? c.getBoundingClientRect() : { top: 0, bottom: 1 };
      const onScreen = r.bottom > 0 && r.top < window.innerHeight ? 1 : 0;
      scored.push({ t: t.length > 60 ? t.slice(0, 57) + '...' : t, score: words.filter((w) => low.includes(w)).length, onScreen, i });
    });
    scored.sort((a, b) => b.score - a.score || b.onScreen - a.onScreen || a.i - b.i);
    return scored.slice(0, 5).map((x) => JSON.stringify(x.t)).join(', ');
  };`;

/**
 * Evaluated in the page for --tap: finds the target, scrolls it to the middle of its
 * scroll area, and returns where to press, or why it cannot be tapped.
 * A target is a CSS selector, or text=Label: a button, link, role=button, tab or a label holding
 * a control, whose trimmed visible text equals Label, then one whose aria-label or value equals
 * it, then one with Label as a whole word, and only then one that contains it, ignoring case. At
 * each step a button or submit beats a label, which beats a link, which beats a header or nav
 * link; then an element on screen beats one scrolled away, which beats one laid out but not yet
 * shown. So text=M finds the size button "M", not a "Menu" link above it.
 * Resolves to { ok, x, y, covered } or { ok: false, error }; x and y are on the
 * screen (the visual viewport), which is where Input.dispatchMouseEvent presses.
 */
export function tapTargetExpression(target: string, revealMs = REVEAL_MS): string {
  const text = /^text=/i.test(target) ? normaliseText(target.slice(5)) : null;
  // Label as a whole word: not inside a longer word (letters and digits of any script).
  const word = text ? '(^|[^\\p{L}\\p{N}])' + text.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\p{L}\\p{N}])' : '';
  return `(async () => {
  const want = ${JSON.stringify(text)};
  const wordRe = ${JSON.stringify(word)};
  const selector = ${JSON.stringify(text === null ? target : '')};
${SHOWN_HELPERS}
${NEAREST_HELPER}
  const normaliseText = ${normaliseText.toString()};
  let el = null;
  if (want === null) {
    let list;
    try { list = Array.from(document.querySelectorAll(selector)); } catch (e) { return { ok: false, error: 'not a valid CSS selector' }; }
    el = list.find(visible) || list.find(rendered) || null;
    if (!el) return { ok: false, error: list.length ? 'it matches only hidden elements' : 'nothing matches it' };
  } else {
    if (!want) return { ok: false, error: 'text= needs a label' };
    // Both sides normalised alike: curly quotes, no-break spaces and dashes match what was typed.
    const norm = (s) => normaliseText(s).toLowerCase();
    const label = want.toLowerCase();
    const all = Array.from(document.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="link"], input[type="button"], input[type="submit"], label'))
      // A label counts only when it holds or names a control (a radio card whose input is hidden).
      .filter((c) => c.tagName !== 'LABEL' || !!(c.control || c.querySelector('input, select, textarea')));
    // When two match equally, a button or submit beats a label, which beats a link in the page, which
    // beats a link in the header or navigation: "text=Book" means the form's button, not the menu link.
    const kindRank = (c) => {
      if (c.matches('button, [role="button"], input[type="button"], input[type="submit"], [role="tab"]')) return 0;
      if (c.tagName === 'LABEL') return 1;
      return c.closest('header, nav, [role="banner"], [role="navigation"]') ? 3 : 2;
    };
    const best = (list, t) => {
      let found = null;
      for (const c of list) if (t(c) && (!found || kindRank(c) < kindRank(found))) found = c;
      return found;
    };
    const shownText = (c) => norm(c.innerText || c.textContent);
    const names = (c) => [shownText(c), norm(c.getAttribute('aria-label')), norm(c.value)].filter(Boolean);
    const whole = new RegExp(wordRe, 'u');
    const tests = [
      (c) => shownText(c) === label,
      (c) => names(c).some((n) => n === label),
      (c) => names(c).some((n) => whole.test(n)),
      (c) => names(c).some((n) => n.includes(label)),
    ];
    const inView = (c) => {
      const r = c.getBoundingClientRect();
      return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
    };
    const vis = all.filter(visible);
    const tiers = [vis.filter(inView), vis, all.filter(rendered)];
    for (const t of tests) {
      // Among visible matches the kind decides first, then being on screen; hidden-but-laid-out last.
      const shown = best(tiers[0], t);
      const any = best(tiers[1], t);
      el = (any && (!shown || kindRank(any) < kindRank(shown)) ? any : shown) || best(tiers[2], t);
      if (el) break;
    }
    if (!el) {
      const near = nearest(vis.length ? vis : all.filter(rendered), want, (c) => normaliseText(c.innerText || c.textContent) || normaliseText(c.getAttribute('aria-label')));
      return { ok: false, error: 'no visible button, link or tab has the text or label "' + want + '" (quotes, dashes and spaces already made plain)' + (near ? '; nearest on the page: ' + near : '; the page has no visible buttons, links or tabs') };
    }
  }
${revealExpression(revealMs)}
  const r = el.getBoundingClientRect();
  // What is on screen is the visual viewport. On a phone whose page is wider than the screen (it
  // overflows sideways) the layout viewport grows past it, and the screen sits offset inside it:
  // aim at the middle of the part of the target on the screen, and press in screen coordinates.
  const vv = window.visualViewport;
  const ox = vv ? vv.offsetLeft : 0;
  const oy = vv ? vv.offsetTop : 0;
  const sw = vv ? vv.width : window.innerWidth;
  const sh = vv ? vv.height : window.innerHeight;
  const scale = vv && vv.scale > 0 ? vv.scale : 1;
  const l = Math.max(r.left, ox), rr = Math.min(r.right, ox + sw), t = Math.max(r.top, oy), b = Math.min(r.bottom, oy + sh);
  const cx = Math.min(Math.max(rr > l ? (l + rr) / 2 : r.left + r.width / 2, ox + 1), ox + sw - 1);
  const cy = Math.min(Math.max(b > t ? (t + b) / 2 : r.top + r.height / 2, oy + 1), oy + sh - 1);
  const hit = document.elementFromPoint(cx, cy);
  let covered = null;
  if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
    covered = hit.tagName.toLowerCase() + (hit.id ? '#' + hit.id : typeof hit.className === 'string' && hit.className.trim() ? '.' + hit.className.trim().split(/\\s+/)[0] : '');
  }
  return { ok: true, x: (cx - ox) * scale, y: (cy - oy) * scale, covered };
})()`;
}

/**
 * Evaluated in the page for --type: finds the field, scrolls it to the middle of its scroll
 * area, focuses it and selects what it holds, so typed text replaces it. A select is set here
 * instead, to the option whose text or value is the text, with input and change events.
 * A target is a CSS selector (a label, or an element holding one field, leads to that field),
 * or text=Label: the first visible field whose label, aria-label, placeholder or name equals
 * Label, else the first that contains it, ignoring case. Resolves to { ok, kind } or { ok: false, error }.
 */
export function typeTargetExpression(target: string, text: string, revealMs = REVEAL_MS): string {
  const label = /^text=/i.test(target) ? normaliseText(target.slice(5)) : null;
  return `(async () => {
  const want = ${JSON.stringify(label)};
  const selector = ${JSON.stringify(label === null ? target : '')};
  const text = ${JSON.stringify(text)};
  const FIELDS = 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="image"]):not([type="file"]), textarea, select, [contenteditable=""], [contenteditable="true"]';
${SHOWN_HELPERS}
${NEAREST_HELPER}
  const normaliseText = ${normaliseText.toString()};
  const norm = (s) => normaliseText(s).toLowerCase();
  let el = null;
  if (want === null) {
    let list;
    try { list = Array.from(document.querySelectorAll(selector)); } catch (e) { return { ok: false, error: 'not a valid CSS selector' }; }
    // Visible ones first; then ones laid out but still hidden by a scroll reveal, which are waited for below.
    const toField = (c) => c.matches(FIELDS) ? c : c.tagName === 'LABEL' && c.control ? c.control : c.querySelector(FIELDS);
    const usable = (c) => { const f = toField(c); return f && !f.disabled ? f : null; };
    const candidates = list.filter(visible).length ? list.filter(visible) : list.filter(rendered);
    if (!candidates.length) return { ok: false, error: list.length ? 'it matches only hidden elements' : 'nothing matches it' };
    el = candidates.map(usable).find(Boolean) || null;
    if (!el) return { ok: false, error: 'it is not a field that takes text, and holds none' };
  } else {
    if (!want) return { ok: false, error: 'text= needs a label' };
    const all = Array.from(document.querySelectorAll(FIELDS)).filter((f) => !f.disabled);
    const names = (f) => {
      const parts = Array.from(f.labels || []).map((l) => l.innerText || l.textContent);
      parts.push(f.getAttribute('aria-label'), f.getAttribute('placeholder'), f.getAttribute('name'));
      const by = f.getAttribute('aria-labelledby');
      if (by) for (const id of by.split(/\\s+/)) { const n = document.getElementById(id); if (n) parts.push(n.textContent); }
      return parts.map(norm).filter(Boolean);
    };
    const l = want.toLowerCase();
    const pick = (fields) => fields.find((f) => names(f).some((n) => n === l)) || fields.find((f) => names(f).some((n) => n.includes(l))) || null;
    el = pick(all.filter(visible)) || pick(all.filter(rendered));
    if (!el) {
      const near = nearest(all.filter(visible), want, (f) => names(f)[0] || '');
      return { ok: false, error: 'no visible field has the label, placeholder or name "' + want + '" (quotes, dashes and spaces already made plain)' + (near ? '; nearest on the page: ' + near : '; the page has no visible fields') };
    }
  }
${revealExpression(revealMs)}
  if (el.tagName === 'SELECT') {
    const t = norm(text);
    const opt = Array.from(el.options).find((o) => norm(o.textContent) === t || norm(o.value) === t) ||
      Array.from(el.options).find((o) => norm(o.textContent).includes(t));
    if (!opt) return { ok: false, error: 'the select has no option "' + text + '"' };
    el.focus();
    el.value = opt.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, kind: 'select' };
  }
  el.focus();
  if (typeof el.select === 'function') el.select();
  else { const range = document.createRange(); range.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); }
  return { ok: true, kind: 'text' };
})()`;
}

/**
 * GET a JSON document from the browser's debugging port on this machine. node:http, not fetch: fetch
 * may go through HTTP_PROXY (NODE_USE_ENV_PROXY), which cannot reach 127.0.0.1. Bounded by timeoutMs.
 */
export function localJson<T>(port: number, pathname: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, agent: false, timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d: string) => { body += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(body) as T); } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); }
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('the browser did not answer in time')));
    req.on('error', reject);
  });
}

/** Wait for the browser to answer on its debugging port and return its connection address. */
async function debuggerAddress(port: number, child: ChildProcess, timeoutMs: number): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error('the browser exited before it was ready');
    try {
      const info = await localJson<{ webSocketDebuggerUrl?: string }>(port, '/json/version');
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error('the browser did not become ready in time');
}

/** A minimal client for the browser's debugging protocol. */
class Connection {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }>();
  private readonly waiters: Array<{ method: string; sessionId: string | undefined; resolve: () => void }> = [];
  private readonly listeners: Array<{ method: string; handler: (params: Record<string, unknown>) => void }> = [];

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (ev: MessageEvent) => {
      const msg = JSON.parse(String(ev.data)) as CdpMessage;
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result ?? {});
        return;
      }
      for (const l of this.listeners) if (l.method === msg.method) l.handler(msg.params ?? {});
      for (let i = this.waiters.length - 1; i >= 0; i--) {
        const w = this.waiters[i];
        if (w && w.method === msg.method && w.sessionId === msg.sessionId) {
          this.waiters.splice(i, 1);
          w.resolve();
        }
      }
    });
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) p.reject(new Error('the browser closed the connection'));
      this.pending.clear();
    });
  }

  static open(address: string): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(address);
      ws.addEventListener('open', () => resolve(new Connection(ws)));
      ws.addEventListener('error', () => reject(new Error('could not connect to the browser')));
    });
  }

  /**
   * Sends a command and resolves with its result. A browser that never answers (a renderer stuck in
   * a navigation, a screenshot waiting for a frame that never comes) rejects after `timeoutMs`
   * instead of hanging the run.
   */
  send(method: string, params: Record<string, unknown> = {}, sessionId?: string, timeoutMs = SEND_TIMEOUT_MS): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    const message: Record<string, unknown> = { id, method, params };
    if (sessionId) message['sessionId'] = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        reject(new Error(`the browser did not answer ${method} within ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      try {
        this.ws.send(JSON.stringify(message));
      } catch (e) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  /** Calls the handler with the parameters of every event of this name. */
  on(method: string, handler: (params: Record<string, unknown>) => void): () => void {
    const entry = { method, handler };
    this.listeners.push(entry);
    return () => {
      const i = this.listeners.indexOf(entry);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  /** Resolves when the named event arrives (true), or after the timeout either way (false). */
  waitFor(method: string, sessionId: string | undefined, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const entry = {
        method,
        sessionId,
        resolve: () => {
          clearTimeout(timer);
          resolve(true);
        },
      };
      const timer = setTimeout(() => {
        const i = this.waiters.indexOf(entry);
        if (i >= 0) this.waiters.splice(i, 1);
        resolve(false);
      }, timeoutMs);
      this.waiters.push(entry);
    });
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

function printCheck(width: number, result: CheckResult, narrowInRun = false): boolean {
  const s = result.summary;
  const p0 = s['P0'] ?? 0;
  const p1 = s['P1'] ?? 0;
  console.log(`\nCheck at ${width}px: ${p0} broken (P0), ${p1} likely problems (P1), ${s['P2'] ?? 0} rough (P2), ${s['P3'] ?? 0} minor or to confirm (P3), ${s['tell'] ?? 0} tells`);
  for (const f of result.findings) console.log(`  ${f.severity.padEnd(4)} ${f.where}  ${f.message}  [${f.rule}]`);
  // The "run again at 320" note says nothing when this run measures a narrow width too.
  for (const n of result.notes) if (!(narrowInRun && /^Sideways overflow is only measured at the current width/.test(n))) console.log(`  note: ${n}`);
  return p0 + p1 > 0;
}

function printInventory(width: number, inv: Record<string, unknown>): void {
  console.log(`\nDesign system in use at ${width}px (most used first):`);
  console.log(`  page background    ${String(inv['pageBackground'])}`);
  for (const [label, key] of INVENTORY_GROUPS) {
    const list = (inv[key] as Array<{ value: string; count: number }> | undefined) ?? [];
    console.log(`  ${label.padEnd(18)} ${list.length ? list.map((c) => c.value).join('  |  ') : 'none'}`);
  }
  console.log(`  uppercase text     ${inv['usesUppercase'] ? 'used' : 'not used'}`);
}

const INVENTORY_GROUPS: Array<[string, string]> = [
  ['font families', 'fontFamilies'], ['text sizes', 'fontSizes'], ['font weights', 'fontWeights'], ['text colours', 'textColours'],
  ['surface colours', 'surfaceColours'], ['border colours', 'borderColours'], ['border widths', 'borderWidths'], ['corner radii', 'radii'],
  ['shadows', 'shadows'], ['control heights', 'controlHeights'], ['table row heights', 'tableRowHeights'],
];

/** Print what this page uses that the reference page does not. */
function printDepartures(width: number, inv: Record<string, unknown>, ref: Record<string, unknown>): void {
  const values = (source: Record<string, unknown>, key: string): string[] =>
    ((source[key] as Array<{ value: string }> | undefined) ?? []).map((c) => c.value);
  console.log(`\nNew at ${width}px, not used by the page it was compared against:`);
  let any = false;
  for (const [label, key] of INVENTORY_GROUPS) {
    const known = new Set(values(ref, key));
    const added = values(inv, key).filter((v) => !known.has(v));
    if (added.length) {
      any = true;
      console.log(`  ${label.padEnd(18)} ${added.join('  |  ')}`);
    }
  }
  if (!any) console.log('  nothing: every font, size, colour, radius, shadow and control height is already in use there.');
  console.log('  (Compares rendered values only. A new kind of component, such as a dialog, will not show here.)');
}

/** A --tap or --type target that could not be used; the run stops with its message. */
class TapError extends Error {
  constructor(message: string, readonly verb: 'tap' | 'hover' | 'type' = 'tap') {
    super(message);
  }
}

/** The line printed once the steps have run at one width. */
export function stepsLine(width: number, steps: Step[]): string {
  if (steps.every((s) => s.kind === 'tap')) return `Tapped at ${width}px: ${steps.map((s) => s.target).join(', ')}`;
  if (steps.every((s) => s.kind === 'hover')) return `Hovered at ${width}px: ${steps.map((s) => s.target).join(', ')}`;
  const each = steps.map((s) => (s.kind === 'type' ? 'type ' + JSON.stringify(s.text ?? '') + ' into ' + s.target : s.kind + ' ' + s.target)).join(', ');
  if (steps.some((s) => s.kind === 'hover')) return `Ran at ${width}px: ` + each;
  return `Tapped and typed at ${width}px: ` + each;
}

/** Evaluated in the page before the checker when --app is given. */
export const APP_MODE_EXPRESSION = 'window.__argusCheckOptions = { app: true }; true';

/**
 * The media features to emulate: --scheme and --reduced-motion, or light and no-preference when
 * they are not given. Both are always set, so a computer in dark mode or with motion turned off
 * (as CI machines often are) sees the same page as any other, and motion captures see motion.
 */
export function emulatedFeatures(opts: Pick<Options, 'scheme' | 'reducedMotion'>): Array<{ name: string; value: string }> {
  return [
    { name: 'prefers-color-scheme', value: opts.scheme ?? 'light' },
    { name: 'prefers-reduced-motion', value: opts.reducedMotion ? 'reduce' : 'no-preference' },
  ];
}

/** Evaluated in the page for --scroll-frames: jump to `y`, then wait two frames and a short pause for scroll-linked work. */
export function scrollToExpression(y: number, pauseMs = 300): string {
  return `(async () => {
  try { window.scrollTo({ top: ${Math.max(0, Math.round(y))}, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, ${Math.max(0, Math.round(y))}); }
  const frame = () => Promise.race([new Promise((r) => requestAnimationFrame(() => r())), new Promise((r) => setTimeout(r, 100))]);
  await frame();
  await frame();
  await new Promise((r) => setTimeout(r, ${Math.max(0, Math.round(pauseMs))}));
  return window.scrollY;
})()`;
}

/** What shot.js tells the checker beyond app mode: stylesheet text the page cannot read. */
export interface CheckInputs {
  sheets: Array<{ href: string; text: string }>;
  /** Canvases laid over a picture that captured as one flat colour there: [canvas index, what]. */
  blankCanvases?: Array<[number, string]>;
  /** What was on screen at stepped scroll positions (the checker's snapshot mode), for blank-band. */
  views?: unknown[];
}

/** Most screens stepped through for the flow check, so a very long page stays quick. */
const MAX_VIEWS = 90;

/**
 * The scroll positions the flow check looks at: every third of a screen from the top to the
 * bottom, the bottom included, so any stretch half a screen tall is seen whole on some screen.
 * A very long page is stepped more coarsely (at most MAX_VIEWS screens, half a screen apart at most).
 */
export function viewPositions(pageHeight: number, viewportHeight: number, max = MAX_VIEWS): number[] {
  const bottom = Math.max(0, Math.ceil(pageHeight - viewportHeight));
  if (viewportHeight <= 0) return [0];
  const step = Math.max(Math.round(viewportHeight / 3), Math.min(Math.round(viewportHeight / 2), Math.ceil(bottom / Math.max(1, max - 1))));
  const out: number[] = [];
  for (let y = 0; y < bottom && out.length < max - 1; y += step) out.push(y);
  out.push(bottom);
  return out;
}

/** Evaluated in the page around the snapshots: turn the checker's snapshot mode on, or off again. */
/**
 * In-page source that holds every video still for capture, so captures repeat: each one playing is
 * marked data-argus-playing="1" (the checker's hero-video reads it), paused, and set back to its start
 * (the first frame; a video with no data yet shows its poster). Bounded at about 1.5s in all.
 * Resolves to the number of videos held.
 */
export function holdVideosExpression(capMs = 1500): string {
  return `(async () => {
  const vids = Array.from(document.querySelectorAll('video'));
  const until = Date.now() + ${capMs};
  await Promise.all(vids.map((v) => new Promise((done) => {
    try {
      if (!v.paused || v.autoplay) v.dataset.argusPlaying = '1';
      v.autoplay = false;
      v.pause();
      if (v.readyState < 1 || v.currentTime === 0) return done();
      const left = Math.max(0, until - Date.now());
      const timer = setTimeout(done, left);
      v.addEventListener('seeked', () => { clearTimeout(timer); done(); }, { once: true });
      v.currentTime = 0;
    } catch (e) { done(); }
  })));
  return vids.length;
})()`;
}

export function snapshotModeExpression(on: boolean): string {
  return on
    ? 'window.__argusCheckOptions = Object.assign(window.__argusCheckOptions || {}, { snapshot: true }); true'
    : 'if (window.__argusCheckOptions) delete window.__argusCheckOptions.snapshot; true';
}

/** Evaluated in the page before the checker: adds the inputs to window.__argusCheckOptions, keeping what is there (app mode). */
export function checkOptionsExpression(inputs: CheckInputs): string {
  return `window.__argusCheckOptions = Object.assign(window.__argusCheckOptions || {}, ${JSON.stringify(inputs)}); true`;
}

/** Lists the stylesheets whose rules the page itself cannot read (another origin, or a file:// sheet). */
const UNREADABLE_SHEETS = `Array.from(document.styleSheets).filter((s) => { try { s.cssRules; return false; } catch (e) { return !!s.href; } }).map((s) => s.href)`;

/**
 * The text of each stylesheet the page cannot read: through the browser (CSS.getStyleSheetText), or
 * for a file:// sheet the browser did not report, from the file itself. Sheets that cannot be read
 * either way are left out, as before.
 */
async function unreadableSheets(conn: Connection, session: string, ids: Map<string, string>): Promise<CheckInputs['sheets']> {
  const res = await conn.send('Runtime.evaluate', { expression: UNREADABLE_SHEETS, returnByValue: true }, session).catch(() => null);
  const hrefs = ((res?.['result'] as { value?: unknown } | undefined)?.value as string[] | undefined) ?? [];
  const out: CheckInputs['sheets'] = [];
  for (const href of hrefs.slice(0, 40)) {
    let text: string | null = null;
    const id = ids.get(href);
    if (id) {
      const got = await conn.send('CSS.getStyleSheetText', { styleSheetId: id }, session).catch(() => null);
      if (typeof got?.['text'] === 'string') text = got['text'];
    }
    if (text === null && href.startsWith('file:')) {
      try {
        text = fs.readFileSync(fileURLToPath(href), 'utf8');
      } catch {
        /* not readable: leave it out */
      }
    }
    if (text !== null) out.push({ href, text });
  }
  return out;
}

/** The one line printed at the top of check output in app mode. */
export function appModeLine(relaxed: string | undefined): string {
  return 'App mode (--app): relaxed ' + (relaxed ?? 'nothing (this check.js predates app mode)') + '.';
}

export const USAGE = [
  'Usage: node shot.js <url-or-html-file> [--out DIR] [--widths 320,390,1440,1920] [--between] [--height N] [--scheme light|dark] [--reduced-motion] [--wait MS] [--tap TARGET]... [--hover TARGET]... [--type TARGET=TEXT]... [--frames N [--every MS]] [--scroll-frames N] [--full] [--check [--app]] [--inventory] [--against URL] [--no-shots] [--scenes] [--timeline NAME]... [--points N] [--arrival] [--transition T] [--ms MS] [--motion-metrics] [--perf-scroll] [--fallbacks]',
  '',
  'Screenshots a page in an installed Chrome-family browser (headless, throwaway profile).',
  '',
  '  --out DIR       where to write PNGs (default: shots/<page>/, the page\'s file or path, so',
  '                  captures of different pages never overwrite each other). The folder is',
  '                  printed first',
  '  --widths LIST   comma-separated widths in CSS pixels (default: 320,390,1440,1920, plus the',
  '                  in-between widths below)',
  '  --between       also capture 768, 820 and 1024 (a tablet, an awkward width and a small',
  '                  laptop), where columns split and things collide: the first screen and the',
  '                  checker only, never --full, frames or motion. On by default when --widths',
  '                  is not given',
  '  --height N      viewport height in CSS pixels at every width, 200 to 4000 (default:',
  '                  700 at 320, 844 on other phones, 900 on laptops, 1080 at 1900 and up)',
  '  --scheme S      light or dark: emulate prefers-color-scheme for captures, --check and',
  '                  --inventory (default: light, whatever this computer is set to)',
  '  --reduced-motion  emulate prefers-reduced-motion: reduce for captures, frames, --check',
  '                  and --inventory, to see the page as people who turn motion off see it',
  '                  (default: no-preference, even where this computer has motion off)',
  '  --wait MS       extra milliseconds to wait before capturing (default: 0). Before',
  '                  that it always waits until the page has stopped changing for half a',
  '                  second (no DOM change, no finite animation, no short timer still due),',
  '                  six seconds at most, so a sequence run by script timers finishes.',
  '                  Videos are then paused at their first frame (or poster) before the',
  '                  capture and the check, so captures repeat; --frames sees them move.',
  '                  Ambient motion is not waited for: endless animations, animations tied',
  '                  to scroll, ones too long to end in time, sub-pixel style rewrites from',
  '                  an idle easing loop, and styles moved inside aria-hidden parts (a',
  '                  marquee track). A "still changing" note means something else kept moving',
  '  --tap TARGET    after the page settles, tap TARGET (real mouse press and release, so',
  '                  :active and click handlers run), then wait for it to settle again.',
  '                  Repeat to tap several in order, at every width, before capturing or',
  '                  checking. TARGET is a CSS selector, or text=Label: a button, link, tab',
  '                  or a label holding a control (a radio card with a hidden input) whose',
  '                  visible text is Label, then whose aria-label is, then one with Label as',
  '                  a whole word, then one containing it (any case); at each step a button',
  '                  or submit before a label, a label before a link, a header or nav link',
  '                  last, then one on screen first. The target is scrolled into view first;',
  '                  if it is hidden until it scrolls in (transparent, invisible or',
  '                  clipped), it is given 2s to show. A target not found stops with an error.',
  '                  The press lands on the part of the target that is on screen, on a',
  '                  phone too (where a page wider than the screen shifts the screen)',
  '  --hover TARGET  after the page settles, move the real mouse onto TARGET (same syntax',
  '                  as --tap) in a few steps, so :hover styles, pointermove handlers and',
  '                  cursor followers run, then wait for it to settle. Repeatable; runs in',
  '                  order with --tap and --type',
  '  --type T=TEXT   after the page settles, type TEXT into the field T: a CSS selector,',
  '                  or text=Label for the first visible field whose label, aria-label,',
  '                  placeholder or name is Label. The field is scrolled into view (and,',
  '                  if a scroll reveal hides it, given 2s to show), focused and cleared',
  '                  first; a select takes the option named TEXT.',
  '                  Repeatable; --tap and --type run in the order given, so',
  '                  --type "text=Email=ana@example.com" --tap "text=Send" fills a form',
  '                  and submits it',
  '  --frames N      after load (and after any --tap, --hover or --type), take N viewport',
  '                  screenshots MS apart (--every, default 150, 30 to 10000) without',
  '                  waiting for the page to settle, as frame-<width>-01.png and on, to see',
  '                  arrivals and loops. N is 1 to 60. --wait delays the first frame.',
  '                  Written even with --no-shots',
  '  --scroll-frames N  take N viewport screenshots at evenly spaced scroll positions from',
  '                  top to bottom, each after a short settle, as scroll-<width>-01.png and',
  '                  on, to see scroll-linked motion and how the page flows. N is 1 to 40',
  '  --full          also capture the whole page as slices (shot-<width>-full-01.png and on)',
  '                  and joined as one tall PNG (shot-<width>-full.png); scrolls through it',
  '                  first so content that appears on scroll and lazy images are there, and',
  '                  shows scroll-driven reveals finished; a page with <meta name="argus-capture"',
  '                  content="tall"> (the choosing page) is captured in one tall viewport, so',
  '                  previews in iframes below the fold are painted. Pinned or scrubbed',
  '                  scenes are captured at their start (often a blank band): their page',
  '                  positions are listed after the capture; see them with --scenes',
  '  --check         run the Argus checker at each width and print what it finds; it also',
  '                  scrolls through first, so content revealed on scroll is measured.',
  '                  At 1024px and wider it also reads the page\'s flow: blank-band,',
  '                  lopsided-section and repeated-layout (skipped with --app).',
  '                  For blank-band it steps down the page a third of a screen at a time',
  '                  and notes what is on each screen, so sticky and pinned content counts',
  '                  where it is stuck and a sideways gallery where it has slid to',
  '  --app           with --check: the page is an app prototype (phone screens switched by',
  '                  URL hash, modal sheets). Skips hash-route missing anchors, open dialogs',
  '                  and their scrim (wherever it sits) as fixed bars, a translucent or',
  '                  floating bottom tab bar, meta description and icon, the three',
  '                  first-screen rules, long lists of repeated items, and pure black on',
  '                  white; allows 11px text anywhere and 10px in nav and tab bars; counts',
  '                  ::before and ::after layers in a control\'s hit area; ignores',
  '                  decorative aria-hidden status bars and home indicators; counts a',
  '                  focus style drawn on the parent or grandparent;',
  '                  judges image size for a 2x screen; scrolls each control into view',
  '                  before focus-obscured. Prints what it relaxed',
  '  --inventory     print the design system the page actually uses',
  '  --against URL   with --inventory: print only what is new compared with another page',
  '  --no-shots      with --check or --inventory: write no images',
  '',
  'Motion. Every sequence below is written frame by frame and as one labelled contact sheet',
  '(<prefix>-sheet.png, a grid drawn in the browser) to read the whole sequence in one image.',
  'A page may register what moves: window.__argus = { timelines: { name: gsapTimeline },',
  'scenes: [{ name, scrollTrigger } or { name, trigger: selector } or { name, start, end }],',
  'lenis }. The showpiece starters in assets/showpiece/ do.',
  '  --scenes        find the scroll scenes (window.__argus.scenes, else pinned or scrubbed',
  '                  ScrollTriggers, else sticky stages and CSS scroll-driven animations',
  '                  (animation-timeline), else the whole page) and capture',
  '                  --points frames across each (scene-<width>-<n>-<name>-NN.png). Each frame',
  '                  jumps there (through Lenis when present) and finishes any scrub lag',
  '  --timeline NAME pause window.__argus.timelines[NAME] and seek it to --points evenly',
  '                  spaced progress values from 0 to 1 (timeline-<width>-<name>-NN.png);',
  '                  a scroll-bound one is first scrolled to its start. Repeatable',
  '  --points N      frames per scene or timeline, 2 to 16 (default 9)',
  '  --arrival       record the load from a blank tab with the browser\'s screencast and keep',
  '                  the frame on screen every --every ms (default 250) for --ms (default',
  '                  3000): arrival-<width>-NN.png, labelled with ms from navigation',
  '  --transition T  record a page transition: T is a link to press (CSS selector or',
  '                  text=Label) or a URL or path to go to from the page; --ms (default 1500),',
  '                  --every (default 100). Cross-document view transitions need http(s)',
  '  --ms MS         how long --arrival or --transition records, 200 to 15000',
  '  --motion-metrics  compare consecutive frames of every sequence (including --frames and',
  '                  --scroll-frames) and flag: dead (nothing changes), pop (one step jumps',
  '                  while its neighbours are still), flash (a near-white or near-black frame',
  '                  between others), not-settled (still changing at the end), blank-canvas',
  '                  (a canvas one flat colour). Advisory; writes motion-metrics.json',
  '  --perf-scroll   scroll the page with real wheel input under a 4x CPU slowdown and report',
  '                  long frames, long animation frames, long tasks and layout shift, with',
  '                  advice past conservative limits (perf-scroll-<width>.json)',
  '  --fallbacks     capture the page screen by screen with reduced motion, with script off,',
  '                  and with WebGL off, at each width, and with touch (no hover) at 390px:',
  '                  fallback-<kind>-<width>-NN.png and a sheet each; screens that are one',
  '                  flat colour are reported (content hidden by a start state)',
  '  The browser starts with software WebGL allowed; if WebGL is still missing, a note says so.',
  '',
  '  --help, -h      print this help',
  '',
  'Set ARGUS_BROWSER to choose a browser executable. Needs Node 22 or later.',
].join('\n');

async function main(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (opts.errors.length) {
    for (const e of opts.errors) console.log(e);
    console.log('Run with --help for usage.');
    return 1;
  }
  if (!opts.target || !opts.widths.length) {
    console.log(USAGE);
    return 1;
  }
  if (typeof WebSocket === 'undefined') {
    console.log('This needs Node 22 or later (you have ' + process.version + '). Use another way to capture the page.');
    return 3;
  }
  const url = toUrl(opts.target);
  if (!url) {
    console.log('File not found: ' + path.resolve(opts.target));
    return 1;
  }
  const browser = findBrowser();
  if (!browser) {
    console.log('No Chrome-family browser found (looked for Chrome, Chromium, Brave, Edge, Vivaldi).');
    console.log('Set ARGUS_BROWSER to a browser executable, or use another way to capture the page.');
    return 3;
  }
  const unusable = browserProblem(browser);
  if (unusable) {
    console.log(unusable);
    return 3;
  }
  const motionWanted = opts.scenes || opts.arrival || opts.transition !== null || opts.timelines.length > 0 || opts.fallbacks || opts.perfScroll || opts.motionMetrics;

  const checkerSource = opts.check ? fs.readFileSync(path.join(__dirname, 'check.js'), 'utf8') : '';
  const inventorySource = opts.inventory ? fs.readFileSync(path.join(__dirname, 'inventory.js'), 'utf8') : '';
  if (opts.shots || opts.frames > 0 || opts.scrollFrames > 0 || motionWanted) {
    fs.mkdirSync(opts.out, { recursive: true });
    console.log('Writing to ' + path.resolve(opts.out) + (opts.outGiven ? '' : ' (this page\'s own folder; --out to choose)'));
  }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-shot-'));
  const port = await freePort();
  const child = spawn(
    browser,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
      '--disable-background-networking',
      '--disable-component-update',
      '--use-mock-keychain',
      '--password-store=basic',
      '--hide-scrollbars',
      '--mute-audio',
      // Chrome 139 and later no longer fall back to software WebGL on their own; without this a
      // machine with no usable GPU (most CI, some sandboxes) captures every WebGL canvas blank.
      '--enable-unsafe-swiftshader',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  // A browser that cannot be started at all (removed, or not a program) reports here, not as a crash.
  let spawnError: string | null = null;
  child.on('error', (e) => { spawnError = e.message; });

  let conn: Connection | null = null;
  let problems = false;
  let failed = false;
  // A hard ceiling on the whole run: whatever stops answering, the run says why and exits 2.
  const flagCount = (opts.arrival ? 1 : 0) + (opts.transition !== null ? 1 : 0) + (opts.scenes ? 1 : 0) + opts.timelines.length;
  const ceilingMs = RUN_BASE_MS + RUN_PER_STEP_MS * (opts.widths.length * (1 + flagCount) + opts.between.length + (opts.fallbacks ? opts.widths.length + 1 : 0) + (opts.perfScroll ? 1 : 0) + (motionWanted ? 1 : 0));
  const watchdog = setTimeout(() => {
    console.log(`Could not capture the page: the run did not finish within ${Math.round(ceilingMs / 1000)}s, its limit for these widths and flags; stopped.`);
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* left behind */ }
    process.exit(2);
  }, ceilingMs);
  watchdog.unref();
  // One motion flag at one width, bounded: past MOTION_STEP_MS it stops the run with one clear line.
  const bounded = async <T>(what: string, work: () => Promise<T>, ms = MOTION_STEP_MS): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} did not finish within ${Math.round(ms / 1000)}s (the browser stopped answering); stopped there`)), ms);
    });
    try {
      return await Promise.race([work(), limit]);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    const address = await debuggerAddress(port, child, 20000);
    conn = await Connection.open(address);
    const target = await conn.send('Target.createTarget', { url: 'about:blank' });
    const attached = await conn.send('Target.attachToTarget', { targetId: target['targetId'], flatten: true });
    const session = String(attached['sessionId']);
    await conn.send('Page.enable', {}, session);
    await conn.send('Runtime.enable', {}, session);
    // Count the page's pending short timers, so a sequence with quiet gaps between its steps is waited for.
    await conn.send('Page.addScriptToEvaluateOnNewDocument', { source: timerTrackerSource() }, session).catch(() => undefined);
    // --scheme and --reduced-motion (light and no-preference without them): emulated for every page
    // loaded in this session, so this computer's own settings never change what is measured.
    const features = emulatedFeatures(opts);
    await conn.send('Emulation.setEmulatedMedia', { features }, session);
    // Stylesheets as the browser sees them, so a sheet the page may not read (file:// or another origin) can be read here.
    const sheetIds = new Map<string, string>();
    conn.on('CSS.styleSheetAdded', (p) => {
      const h = p['header'] as { styleSheetId?: string; sourceURL?: string } | undefined;
      if (h?.styleSheetId && h.sourceURL) sheetIds.set(h.sourceURL, h.styleSheetId);
    });

    // After a load, wait as for a capture: web fonts, then until the page has stopped changing, then any --wait.
    const live = conn;
    const waitUntilStill = async (where: string, extra = true): Promise<void> => {
      // Let web fonts and entrance animations settle before looking.
      const fonts = await live
        .send('Runtime.evaluate', { expression: `document.fonts ? Promise.race([document.fonts.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), ${FONTS_WAIT_MS}))]) : true`, awaitPromise: true, returnByValue: true }, session)
        .catch(() => null);
      if ((fonts?.['result'] as { value?: unknown } | undefined)?.value === false) console.log(`  (${where} web fonts had not loaded after ${FONTS_WAIT_MS / 1000}s; captured with what had)`);
      // Wait until the page has stopped changing, so a first screen assembled by script timers is captured finished.
      const stable = await live
        .send('Runtime.evaluate', { expression: stableExpression(), awaitPromise: true, returnByValue: true }, session)
        .catch(() => null);
      const stableValue = (stable?.['result'] as { value?: { ms?: number; settled?: boolean } } | undefined)?.value;
      if (!stableValue) await sleep(MIN_SETTLE_MS);
      else if (stableValue.settled === false) {
        console.log(`  (${where} the page was still changing after ${SETTLE_CAP_MS / 1000}s; captured anyway. If a first-screen sequence was mid-way, add --wait)`);
      }
      if (extra && opts.wait > 0) await sleep(opts.wait);
    };

    // --tap, --hover and --type, in command-line order: press and release the mouse on a target, move
    // the mouse onto one, or type into a field, waiting for the page to settle after each. With
    // --frames, the last step is not waited for, so what it sets moving is captured as it moves.
    const steps = opts.steps;
    let mouse = { x: 0, y: 0 };
    const doing: Record<Step['kind'], string> = { tap: 'tapping "', hover: 'hovering over "', type: 'typing into "' };
    const tapAll = async (width: number, framesNext = opts.frames > 0): Promise<void> => {
      mouse = { x: 0, y: 0 };
      for (let t = 0; t < steps.length; t++) {
        const step = steps[t] ?? { kind: 'tap', target: '' };
        const target = step.target;
        const after = t > 0 ? ` (after ${steps.slice(0, t).map((x) => doing[x.kind] + x.target + '"').join(', ')})` : '';
        const last = t === steps.length - 1;
        const settle = async (where: string): Promise<void> => {
          if (last && framesNext) return;
          await waitUntilStill(where, last);
        };
        if (step.kind === 'type') {
          const text = step.text ?? '';
          const res = await live.send('Runtime.evaluate', { expression: typeTargetExpression(target, text), awaitPromise: true, returnByValue: true }, session).catch(() => null);
          const got = (res?.['result'] as { value?: { ok?: boolean; kind?: string; error?: string } } | undefined)?.value;
          if (!got?.ok) {
            throw new TapError(`nothing to type into for --type "${target}" at ${width}px: ${got?.error ?? 'the page could not be searched'}` + after, 'type');
          }
          if (got.kind !== 'select') {
            // insertText reaches the focused field as typing does (beforeinput and input events). The field
            // keeps focus, as it would under a person's hands; change fires when the next step moves focus.
            if (text) await live.send('Input.insertText', { text }, session);
            else await live.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }, session)
              .then(() => live.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }, session));
          }
          await settle(`after --type "${target}" at ${width}px`);
          continue;
        }
        const verb = step.kind;
        // The target is scrolled into view; content revealed on scroll is given up to two seconds to show.
        const found = await live.send('Runtime.evaluate', { expression: tapTargetExpression(target), awaitPromise: true, returnByValue: true }, session).catch(() => null);
        const spot = (found?.['result'] as { value?: { ok?: boolean; x?: number; y?: number; covered?: string | null; error?: string } } | undefined)?.value;
        if (!spot?.ok || typeof spot.x !== 'number' || typeof spot.y !== 'number') {
          throw new TapError(`nothing to ${verb} for --${verb} "${target}" at ${width}px: ${spot?.error ?? 'the page could not be searched'}` + after, verb);
        }
        if (spot.covered) console.log(`  (at ${width}px, --${verb} "${target}" lies under ${spot.covered}; ${verb === 'tap' ? 'tapped that point anyway, as a finger would' : 'moved there anyway, as a mouse would'})`);
        const at = { x: spot.x, y: spot.y, pointerType: 'mouse' };
        if (verb === 'hover') {
          // Glide there in a few moves, so pointermove handlers and followers that ease towards the pointer run.
          const from = mouse;
          for (const f of [0.25, 0.5, 0.75, 0.9, 1]) {
            await live.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + (at.x - from.x) * f, y: from.y + (at.y - from.y) * f, pointerType: 'mouse', button: 'none', buttons: 0 }, session);
            await sleep(40);
          }
          mouse = { x: at.x, y: at.y };
          await settle(`after --hover "${target}" at ${width}px`);
          continue;
        }
        await live.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at, button: 'none', buttons: 0 }, session);
        await live.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at, button: 'left', buttons: 1, clickCount: 1 }, session);
        await sleep(60);
        await live.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at, button: 'left', buttons: 0, clickCount: 1 }, session);
        mouse = { x: at.x, y: at.y };
        await settle(`after --tap "${target}" at ${width}px`);
      }
      if (steps.length) console.log(stepsLine(width, steps));
    };

    // ---- The motion flags: sequences of frames, their contact sheets and metrics ----
    const evaluate = async <T>(expression: string, where: string = session): Promise<T | undefined> => {
      const r = await live.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, where).catch(() => null);
      return (r?.['result'] as { value?: T } | undefined)?.value;
    };
    // A screenshot taken while a navigation swaps the page's renderer fails for a moment ("Not attached
    // to an active page"): the session stays the same, so wait for the new page and try again.
    const capture = async (tryForMs = 5000): Promise<Buffer> => {
      const until = Date.now() + tryForMs;
      for (;;) {
        try {
          return Buffer.from(String((await live.send('Page.captureScreenshot', { format: 'png' }, session, QUICK_TIMEOUT_MS))['data']), 'base64');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (Date.now() >= until || !/not attached|no target|target closed|cannot find context|navigat/i.test(msg)) throw e;
          await sleep(100);
        }
      }
    };
    const canvasRects = async (): Promise<Rect[]> => (await evaluate<Rect[]>(CANVAS_RECTS)) ?? [];
    const pad = (n: number): string => String(n).padStart(2, '0');
    const setMetrics = async (w: number, h: number): Promise<void> => {
      await live.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, screenWidth: w, screenHeight: h, deviceScaleFactor: 1, mobile: w < 600 }, session);
      await live.send('Emulation.setScrollbarsHidden', { hidden: true }, session).catch(() => undefined);
    };
    const load = async (u: string, timeoutMs = 25000): Promise<boolean> => {
      const done = live.waitFor('Page.loadEventFired', session, timeoutMs);
      await live.send('Page.navigate', { url: u }, session, timeoutMs);
      return done;
    };
    interface Captured { buf: Buffer; label: string; canvases?: Rect[] }
    interface Pending { prefix: string; title: string; kind: MotionSequence['kind']; frames: Captured[]; writeFrames: boolean }
    // Sequences are written as they are taken; their sheets and metrics are made at the end, in a
    // second tab, so making them never hides the page being captured.
    const pending: Pending[] = [];
    const queue = (prefix: string, title: string, kind: MotionSequence['kind'], frames: Captured[], writeFrames = true): void => {
      if (!frames.length) {
        console.log(`  (${title}: no frames captured)`);
        return;
      }
      if (writeFrames) {
        frames.forEach((f, i) => {
          const file = path.resolve(opts.out, `${prefix}-${pad(i + 1)}.png`);
          fs.writeFileSync(file, f.buf);
          console.log(file + `  (${f.label})`);
        });
      }
      pending.push({ prefix, title, kind, frames, writeFrames });
    };
    const metricsOut: SequenceMetrics[] = [];
    let sheetSession: string | null = null;
    const finishAll = async (): Promise<void> => {
      if (!pending.length) return;
      if (!sheetSession) {
        const t = await live.send('Target.createTarget', { url: 'about:blank' });
        const a = await live.send('Target.attachToTarget', { targetId: t['targetId'], flatten: true });
        sheetSession = String(a['sessionId']);
        await live.send('Runtime.evaluate', { expression: SHEET_SCRIPT }, sheetSession);
      }
      const where = sheetSession;
      for (const p of pending) {
        const w = p.frames[0]!.buf.readUInt32BE(16);
        const h = p.frames[0]!.buf.readUInt32BE(20);
        const L = sheetLayout(p.frames.length, w, h);
        await evaluate(`__sheet.init(${JSON.stringify(L)}, ${JSON.stringify(p.title + ' · ' + p.frames.length + ' frames')})`, where);
        for (let i = 0; i < p.frames.length; i++) {
          const f = p.frames[i]!;
          await evaluate(`__sheet.add(${i}, "data:image/png;base64,${f.buf.toString('base64')}", ${JSON.stringify(f.label)})`, where);
        }
        const png = await evaluate<string>('__sheet.done()', where);
        if (png) {
          const file = path.resolve(opts.out, `${p.prefix}-sheet.png`);
          fs.writeFileSync(file, Buffer.from(png, 'base64'));
          console.log(file + `  (contact sheet: ${p.title}, ${p.frames.length} frames)`);
        } else console.log(`  (could not make the contact sheet for ${p.title}; its frames are written separately)`);
        if (opts.motionMetrics || p.kind === 'screens') {
          const samples: FrameSample[] = [];
          const labels: string[] = [];
          const rects: Rect[][] = [];
          for (const f of p.frames) {
            const r = decodePng(f.buf);
            if (!r) continue;
            samples.push(sampleRaster(r, 2));
            labels.push(f.label);
            rects.push(f.canvases ?? []);
          }
          const m = motionMetrics({ name: p.title, kind: p.kind, labels, frames: samples, canvases: rects });
          if (opts.motionMetrics) metricsOut.push(m);
          else for (const fl of m.flags) console.log(`  ${p.title}: ${fl.flag}: ${fl.message}`);
        }
      }
      pending.length = 0;
    };

    // Record the screen while `start` runs and for `ms` after: screencast frames arrive whenever the
    // picture changes, each with the time it arrived (ms after `start` was called).
    const record = async (start: () => Promise<unknown>, ms: number, skipUntilCommit: boolean): Promise<Array<{ t: number; buf: Buffer }>> => {
      const got: Array<{ t: number; buf: Buffer }> = [];
      let t0 = 0;
      let committed = !skipUntilCommit;
      const offNav = live.on('Page.frameNavigated', (p) => {
        const frame = p['frame'] as { parentId?: string; url?: string } | undefined;
        if (frame && !frame.parentId && frame.url !== 'about:blank') committed = true;
      });
      const offFrame = live.on('Page.screencastFrame', (p) => {
        live.send('Page.screencastFrameAck', { sessionId: p['sessionId'] }, session).catch(() => undefined);
        if (t0 && committed) got.push({ t: Date.now() - t0, buf: Buffer.from(String(p['data']), 'base64') });
      });
      try {
        // ARGUS_NO_SCREENCAST=1 (tests) behaves as a browser that sends no screencast frames.
        if (!process.env['ARGUS_NO_SCREENCAST']) {
          await live.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 }, session, QUICK_TIMEOUT_MS)
            .catch((e: unknown) => console.log(`  (the screencast did not start: ${e instanceof Error ? e.message : String(e)})`));
        }
        t0 = Date.now();
        await startBounded(start);
        const left = ms - (Date.now() - t0);
        if (left > 0) await sleep(left);
      } finally {
        if (!process.env['ARGUS_NO_SCREENCAST']) await live.send('Page.stopScreencast', {}, session, QUICK_TIMEOUT_MS).catch(() => undefined);
        offFrame();
        offNav();
      }
      return got;
    };
    // What starts a recording (a navigation, a mouse press) gets QUICK_TIMEOUT_MS to be accepted.
    const startBounded = async (start: () => Promise<unknown>): Promise<void> => {
      let timer: NodeJS.Timeout | undefined;
      const late = new Promise<'late'>((r) => { timer = setTimeout(() => r('late'), QUICK_TIMEOUT_MS); });
      try {
        const got = await Promise.race([start().then(() => 'ok' as const, (e: unknown) => {
          console.log(`  (starting the recording failed: ${e instanceof Error ? e.message : String(e)})`);
          return 'ok' as const;
        }), late]);
        if (got === 'late') console.log(`  (the browser took over ${QUICK_TIMEOUT_MS / 1000}s to start the recording; went on without waiting)`);
      } finally {
        clearTimeout(timer);
      }
    };
    // Wait for the main frame to commit a page other than about:blank, at most `ms`; false if it did not.
    const committed = (ms: number): Promise<boolean> => new Promise((resolve) => {
      const off = live.on('Page.frameNavigated', (p) => {
        const frame = p['frame'] as { parentId?: string; url?: string } | undefined;
        if (frame && !frame.parentId && frame.url !== 'about:blank') done(true);
      });
      const timer = setTimeout(() => done(false), ms);
      function done(v: boolean): void {
        clearTimeout(timer);
        off();
        resolve(v);
      }
    });
    // Turn a recording into evenly timed frames: the frame on screen at every `every` ms.
    const timed = (rec: Array<{ t: number; buf: Buffer }>, ms: number, every: number): Captured[] => {
      const held = heldFrames(rec.map((r) => r.t), ms, every);
      return spreadIndices(held.length, MAX_SHEET_FRAMES).map((k) => {
        const [t, idx] = held[k]!;
        return { buf: rec[idx]!.buf, label: `t=${t}ms` };
      });
    };
    // When the screencast sends nothing (some builds), take screenshots on a timer instead.
    // A frame that cannot be taken (the page mid-swap) is skipped; the shots stop at the time limit.
    const timedShots = async (ms: number, every: number): Promise<Captured[]> => {
      const out: Captured[] = [];
      const t0 = Date.now();
      const stopAt = t0 + ms + QUICK_TIMEOUT_MS;
      let missed = 0;
      // A slow machine takes fewer shots in the same time: keep going until there are at least three.
      for (let t = 0; (t <= ms || out.length < 3) && out.length < MAX_SHEET_FRAMES && Date.now() < stopAt; t += every) {
        const due = t0 + t;
        if (Date.now() < due) await sleep(due - Date.now());
        const buf = await capture(Math.min(2000, Math.max(0, stopAt - Date.now()))).catch(() => null);
        if (buf) out.push({ buf, label: `t=${Date.now() - t0}ms` });
        else missed++;
      }
      if (missed) console.log(`  (${missed} timed screenshot${missed === 1 ? '' : 's'} could not be taken and ${missed === 1 ? 'was' : 'were'} skipped)`);
      return out;
    };

    // --arrival: load the page while recording, from a blank tab, and keep what was on screen every MS.
    const arrive = async (width: number): Promise<void> => {
      const ms = opts.ms ?? ARRIVAL_MS;
      const every = opts.everyGiven ? opts.every : ARRIVAL_EVERY_MS;
      // A preloader shown once per session would be skipped at the second width: forget the session first.
      await evaluate('(() => { try { sessionStorage.clear(); } catch (e) {} return true; })()');
      await load('about:blank', 3000);
      const loaded = live.waitFor('Page.loadEventFired', session, 25000);
      const rec = await record(() => live.send('Page.navigate', { url }, session, 25000), ms, true);
      if (!(await loaded)) console.log(`  (at ${width}px the page did not finish loading within 25s; went on with what was on screen)`);
      let frames = timed(rec, ms, every);
      if (frames.length < 2) {
        console.log(`  (at ${width}px the browser sent no screencast frames; took timed screenshots instead, which start after the first paint)`);
        await load('about:blank', 3000);
        // Start the shots once the page has committed: before that there is no page to capture.
        const commit = committed(QUICK_TIMEOUT_MS);
        const again = live.waitFor('Page.loadEventFired', session, 25000);
        await live.send('Page.navigate', { url }, session, 25000);
        if (!(await commit)) console.log(`  (at ${width}px the page had not committed after ${QUICK_TIMEOUT_MS / 1000}s; took the screenshots anyway)`);
        frames = await timedShots(ms, every);
        if (!(await again)) console.log(`  (at ${width}px the page did not finish loading within 25s; went on with what was on screen)`);
      }
      const last = frames[frames.length - 1];
      if (last) last.canvases = await canvasRects();
      queue(`arrival-${width}`, `arrival at ${width}px, ${ms}ms from navigation`, 'time', frames);
    };

    // --scenes: --points frames across each scroll scene, each after jumping there and finishing scrub lag.
    const scenes = async (width: number): Promise<void> => {
      const list = (await evaluate<Array<{ name: string; start: number; end: number; source: string }>>(scenesExpression())) ?? [];
      if (!list.length) {
        console.log(`  (at ${width}px the page does not scroll: no scenes to capture)`);
        return;
      }
      console.log(`Scenes at ${width}px: ` + list.map((s) => `"${s.name}" ${s.start}-${s.end}px (${s.source})`).join('; '));
      for (let k = 0; k < list.length; k++) {
        const s = list[k]!;
        const frames: Captured[] = [];
        for (let i = 0; i < opts.points; i++) {
          const y = Math.round(s.start + ((s.end - s.start) * i) / (opts.points - 1));
          const at = await evaluate<number>(seekScrollExpression(y));
          frames.push({ buf: await capture(), label: `${pad(i + 1)} y=${at ?? y}px`, canvases: await canvasRects() });
        }
        queue(`scene-${width}-${k + 1}-${slug(s.name)}`, `scene "${s.name}" at ${width}px, scroll ${s.start}-${s.end}px`, 'scroll', frames);
      }
      await evaluate(seekScrollExpression(0, 100));
    };

    // --timeline: pause a registered timeline and seek it to --points evenly spaced progress values.
    const timelines = async (width: number): Promise<void> => {
      for (const name of opts.timelines) {
        const frames: Captured[] = [];
        let failed: string | null = null;
        for (let i = 0; i < opts.points; i++) {
          const p = i / (opts.points - 1);
          const got = await evaluate<{ ok: boolean; progress?: number; error?: string }>(seekTimelineExpression(name, p));
          if (!got?.ok) {
            failed = got?.error ?? 'the page could not be reached';
            break;
          }
          frames.push({ buf: await capture(), label: `${pad(i + 1)} p=${p.toFixed(2)}`, canvases: await canvasRects() });
        }
        await evaluate(seekTimelineExpression(name, null));
        if (failed) console.log(`  (--timeline "${name}" at ${width}px: ${failed})`);
        else queue(`timeline-${width}-${slug(name)}`, `timeline "${name}" at ${width}px`, 'progress', frames);
      }
    };

    // --transition: follow a link (real mouse press) or go to a URL from the page, recording the change.
    const transition = async (width: number): Promise<void> => {
      const t = opts.transition ?? '';
      const ms = opts.ms ?? TRANSITION_MS;
      const every = opts.everyGiven ? opts.every : TRANSITION_EVERY_MS;
      const isUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) || (!/^text=/i.test(t) && /^(\.{0,2}\/|[\w.-]+\.html?([?#].*)?$)/i.test(t));
      // What starts the transition, ready to run; null (and a note) when the target is not on the page.
      const prepare = async (): Promise<(() => Promise<unknown>) | null> => {
        if (isUrl) {
          // From the page itself, so the browser treats it as a same-origin navigation (view transitions run).
          return () => live.send('Runtime.evaluate', { expression: `setTimeout(() => { location.href = new URL(${JSON.stringify(t)}, location.href).href; }, 0); true` }, session, QUICK_TIMEOUT_MS).catch(() => undefined);
        }
        const found = await evaluate<{ ok?: boolean; x?: number; y?: number; error?: string }>(tapTargetExpression(t));
        if (!found?.ok || typeof found.x !== 'number' || typeof found.y !== 'number') {
          console.log(`  (--transition "${t}" at ${width}px: ${found?.error ?? 'the page could not be searched'})`);
          return null;
        }
        const at = { x: found.x, y: found.y, pointerType: 'mouse' };
        await live.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at, button: 'none', buttons: 0 }, session, QUICK_TIMEOUT_MS);
        await sleep(120);
        return async () => {
          await live.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at, button: 'left', buttons: 1, clickCount: 1 }, session, QUICK_TIMEOUT_MS);
          await live.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at, button: 'left', buttons: 0, clickCount: 1 }, session, QUICK_TIMEOUT_MS);
        };
      };
      const start = await prepare();
      if (!start) return;
      const rec = await record(start, ms, false);
      let frames = timed(rec, ms, every);
      if (frames.length < 2) {
        // The page has left: go back to it and run the transition again under timed screenshots.
        console.log(`  (at ${width}px the browser sent no screencast frames for --transition; ran it again under timed screenshots)`);
        if (!(await load(url))) console.log(`  (at ${width}px the page did not finish loading within 25s; went on with what was on screen)`);
        await waitUntilStill(`before --transition again at ${width}px`, false);
        const again = await prepare();
        if (!again) return;
        const shots = timedShots(ms, every);
        await startBounded(again);
        frames = await shots;
      }
      const last = frames[frames.length - 1];
      if (last) last.canvases = await canvasRects();
      queue(`transition-${width}`, `transition "${t}" at ${width}px`, 'time', frames);
      // Bounded: a page that never settles after the transition is captured as it stands.
      const settled = await Promise.race([waitUntilStill(`after --transition at ${width}px`, false).then(() => true), sleep(QUICK_TIMEOUT_MS).then(() => false)]);
      if (!settled) console.log(`  (after --transition at ${width}px the page had not settled within ${QUICK_TIMEOUT_MS / 1000}s; went on)`);
    };

    // --fallbacks: the page screen by screen, top to bottom; scrolled to each screen when script runs,
    // else captured beyond the viewport (with script off nothing scrolls the page).
    const screens = async (width: number, height: number, scripts: boolean): Promise<Captured[]> => {
      const metrics = await live.send('Page.getLayoutMetrics', {}, session);
      const size = (metrics['cssContentSize'] ?? metrics['contentSize']) as { width: number; height: number } | undefined;
      const pageHeight = Math.ceil(size?.height ?? height);
      const bottom = Math.max(0, pageHeight - height);
      const n = bottom === 0 ? 1 : Math.min(MAX_FALLBACK_SCREENS, Math.ceil(pageHeight / height));
      const out: Captured[] = [];
      for (let i = 0; i < n; i++) {
        const y = n === 1 ? 0 : Math.round((bottom * i) / (n - 1));
        if (scripts) {
          await evaluate(scrollToExpression(y, 400));
          await evaluate(settleExpression(1500));
          out.push({ buf: await capture(), label: `screen ${i + 1} y=${y}px`, canvases: await canvasRects() });
        } else {
          const shot = await live.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: Math.min(height, pageHeight - y), scale: 1 } }, session);
          out.push({ buf: Buffer.from(String(shot['data']), 'base64'), label: `screen ${i + 1} y=${y}px` });
        }
      }
      return out;
    };
    const fallbacks = async (): Promise<void> => {
      const base = emulatedFeatures(opts);
      for (const width of opts.widths) {
        const height = viewportHeight(width, opts.height);
        await setMetrics(width, height);
        // Reduced motion: every end state should show, nothing travelling.
        await live.send('Emulation.setEmulatedMedia', { features: [...base.filter((f) => f.name !== 'prefers-reduced-motion'), { name: 'prefers-reduced-motion', value: 'reduce' }] }, session);
        await load(url);
        await waitUntilStill(`with reduced motion at ${width}px`, false);
        queue(`fallback-reduced-${width}`, `reduced motion at ${width}px`, 'screens', await screens(width, height, true));
        await live.send('Emulation.setEmulatedMedia', { features: base }, session);
        // Script off: content hidden by a start state in CSS shows up here as an empty screen.
        await live.send('Emulation.setScriptExecutionDisabled', { value: true }, session);
        try {
          await load(url);
          await sleep(800);
          queue(`fallback-nojs-${width}`, `script off at ${width}px`, 'screens', await screens(width, height, false));
        } finally {
          await live.send('Emulation.setScriptExecutionDisabled', { value: false }, session);
        }
        // WebGL off: every WebGL context request fails, as on a machine without it; the fallback should show.
        const added = await live.send('Page.addScriptToEvaluateOnNewDocument', { source: NO_WEBGL_SOURCE }, session);
        try {
          await load(url);
          await waitUntilStill(`with WebGL off at ${width}px`, false);
          queue(`fallback-nowebgl-${width}`, `WebGL off at ${width}px`, 'screens', await screens(width, height, true));
        } finally {
          await live.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: added['identifier'] }, session).catch(() => undefined);
        }
      }
      // Touch at 390: a phone with no hover and a coarse pointer.
      const th = viewportHeight(390, opts.height);
      await setMetrics(390, th);
      await live.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, session);
      const touchMedia = [...base, { name: 'hover', value: 'none' }, { name: 'any-hover', value: 'none' }, { name: 'pointer', value: 'coarse' }, { name: 'any-pointer', value: 'coarse' }];
      const mediaSet = await live.send('Emulation.setEmulatedMedia', { features: touchMedia }, session).then(() => true, () => false);
      try {
        await load(url);
        await waitUntilStill('with touch at 390px', false);
        const hover = await evaluate<boolean>(`matchMedia('(hover: hover)').matches`);
        if (hover) console.log(`  (touch at 390px: this browser still reports (hover: hover)${mediaSet ? '' : ', and would not emulate it'}; hover-gated effects may show in that capture)`);
        queue('fallback-touch-390', 'touch at 390px', 'screens', await screens(390, th, true));
      } finally {
        await live.send('Emulation.setTouchEmulationEnabled', { enabled: false }, session).catch(() => undefined);
        await live.send('Emulation.setEmulatedMedia', { features: base }, session).catch(() => undefined);
      }
    };

    // --perf-scroll: scroll the page with the wheel, as a visitor would, under a 4x CPU slowdown.
    const perfScroll = async (): Promise<void> => {
      const width = opts.widths.find((w) => w >= 1024) ?? opts.widths[0] ?? 1440;
      const height = viewportHeight(width, opts.height);
      await setMetrics(width, height);
      await load(url);
      await waitUntilStill(`before --perf-scroll at ${width}px`, false);
      const L = PERF_LIMITS;
      await live.send('Emulation.setCPUThrottlingRate', { rate: L.CPU_SLOWDOWN }, session);
      const started = Date.now();
      let from = 0;
      let to = 0;
      let raw: PerfRaw | undefined;
      try {
        from = (await evaluate<number>('Math.round(scrollY)')) ?? 0;
        await evaluate(PERF_START);
        const x = Math.round(width / 2);
        const y = Math.round(height / 2);
        await live.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 }, session);
        let stuck = 0;
        let lastY = -1;
        for (let i = 0; Date.now() - started < L.MAX_SCROLL_MS; i++) {
          await live.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: L.WHEEL_DELTA }, session);
          await sleep(L.WHEEL_EVERY_MS);
          if (i % 8 === 7) {
            const now = (await evaluate<number>('Math.round(scrollY)')) ?? 0;
            stuck = now <= lastY + 1 ? stuck + 1 : 0;
            lastY = now;
            if (stuck >= 3) break;
          }
        }
        await sleep(800);
        to = (await evaluate<number>('Math.round(scrollY)')) ?? 0;
        raw = await evaluate<PerfRaw>(PERF_STOP);
      } finally {
        await live.send('Emulation.setCPUThrottlingRate', { rate: 1 }, session).catch(() => undefined);
      }
      if (!raw) {
        console.log(`  (--perf-scroll at ${width}px: the page could not be measured)`);
        return;
      }
      const s = summarisePerf(raw);
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`\nScroll performance at ${width}px, CPU slowed ${L.CPU_SLOWDOWN}x, wheel scroll ${from} to ${to}px in ${secs}s (advisory):`);
      console.log(`  frames ${s.frames}, over ${L.LONG_FRAME_MS}ms ${pct(s.longFrameShare)}, 95th percentile ${s.p95Ms}ms, worst ${s.worstMs}ms`);
      console.log(s.hasLoaf ? `  long animation frames blocking over ${L.BLOCKING_MS}ms: ${s.blockingFrames} (worst blocking ${s.worstBlockingMs}ms)` : '  long animation frames: not reported by this browser');
      console.log(`  long tasks ${s.longTasks}, layout shift during the scroll ${s.cls.toFixed(3)}`);
      if (to - from < height / 2) console.log('  (the page barely moved: it may not scroll, or something stops wheel scrolling)');
      for (const a of s.advice) console.log('  advice: ' + a);
      if (!s.advice.length) console.log('  within the advisory limits');
      const file = path.resolve(opts.out, `perf-scroll-${width}.json`);
      fs.writeFileSync(file, JSON.stringify({ width, cpuSlowdown: L.CPU_SLOWDOWN, from, to, ...s }, null, 2) + '\n');
      console.log(file);
    };
    let webglNoted = false;

    if (opts.check) {
      // Stylesheets are reported as they load from here on (CSS.styleSheetAdded), for unreadableSheets.
      await conn.send('DOM.enable', {}, session).catch(() => undefined);
      await conn.send('CSS.enable', {}, session).catch(() => undefined);
    }

    // With --against, measure the reference page first, at the first width.
    let reference: Record<string, unknown> | null = null;
    if (opts.against) {
      const refUrl = toUrl(opts.against);
      if (!refUrl) throw new Error('the page to compare against was not found: ' + opts.against);
      const w = opts.widths[0] ?? 1440;
      const h = opts.height ?? 900;
      await conn.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, screenWidth: w, screenHeight: h, deviceScaleFactor: 1, mobile: w < 600 }, session);
      await conn.send('Emulation.setScrollbarsHidden', { hidden: true }, session).catch(() => undefined);
      const refLoaded = conn.waitFor('Page.loadEventFired', session, 25000);
      await conn.send('Page.navigate', { url: refUrl }, session);
      await refLoaded;
      await waitUntilStill(`on the page compared against, at ${w}px,`);
      const measured = await conn.send('Runtime.evaluate', { expression: inventorySource, returnByValue: true }, session);
      reference = (measured['result'] as { value?: Record<string, unknown> } | undefined)?.value ?? null;
      if (!reference) throw new Error('the inventory could not run in the page to compare against');
    }

    let relaxedShown = false;
    const allWidths = [...opts.widths, ...opts.between];
    if (opts.between.length) console.log(`In-between widths ${opts.between.join(', ')}: the first screen${opts.check ? ' and the checker' : ''} only.`);
    for (const width of allWidths) {
      // An in-between width gets the first screen and the checker only: cheap, and where columns collide.
      const between = !opts.widths.includes(width);
      const height = viewportHeight(width, opts.height);
      await conn.send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: width < 600 }, session);
      // No scrollbar in the capture or in the layout, at phone widths too (where --hide-scrollbars does not reach the overlay bar).
      await conn.send('Emulation.setScrollbarsHidden', { hidden: true }, session).catch(() => undefined);
      if (opts.arrival && !between) await bounded(`--arrival at ${width}px`, () => arrive(width));
      else {
        const loaded = conn.waitFor('Page.loadEventFired', session, 25000);
        await conn.send('Page.navigate', { url }, session);
        await loaded;
      }
      if (motionWanted && !webglNoted) {
        webglNoted = true;
        if (!(await evaluate<boolean>(WEBGL_PROBE))) {
          console.log('  note: WebGL is not available in this headless browser, even with software rendering allowed; WebGL canvases will capture blank and blank-canvas flags say nothing about the page.');
        }
      }
      // --frames with no steps captures the arrival itself, so it does not wait for the page to settle first.
      const framesHere = opts.frames > 0 && !between;
      if (!(framesHere && !steps.length)) await waitUntilStill(`at ${width}px`, !framesHere);
      await tapAll(width, framesHere);

      // --frames: viewport screenshots in quick succession, without waiting for anything to settle
      // (only for --wait, which delays the first frame as it delays a capture).
      if (framesHere) {
        if (opts.wait > 0) await sleep(opts.wait);
        const started = Date.now();
        const taken: Captured[] = [];
        for (let f = 0; f < opts.frames; f++) {
          const due = started + f * opts.every;
          if (Date.now() < due) await sleep(due - Date.now());
          const frame = await conn.send('Page.captureScreenshot', { format: 'png' }, session);
          const file = path.resolve(opts.out, `frame-${width}-${String(f + 1).padStart(2, '0')}.png`);
          const bytes = Buffer.from(String(frame['data']), 'base64');
          fs.writeFileSync(file, bytes);
          console.log(file);
          if (opts.motionMetrics) taken.push({ buf: bytes, label: `t=${Date.now() - started}ms` });
        }
        // With --motion-metrics, the frames also get a contact sheet and metrics.
        if (opts.motionMetrics) queue(`frame-${width}`, `frames at ${width}px`, 'time', taken, false);
        console.log(`  (${opts.frames} frames at ${width}px, ${opts.every}ms apart, taken in ${((Date.now() - started) / 1000).toFixed(1)}s)`);
        // Then capture and check the page as usual, once it has settled.
        await waitUntilStill(`after the frames at ${width}px`);
      }

      // Videos held at their start (or poster) and paused, so the capture repeats and nothing moves under the checker.
      await conn.send('Runtime.evaluate', { expression: holdVideosExpression(), awaitPromise: true, returnByValue: true }, session).catch(() => undefined);

      let scrolled = false;
      const scrollThrough = async (): Promise<void> => {
        if (scrolled || !conn) return;
        scrolled = true;
        await conn
          .send('Runtime.evaluate', { expression: scrollThroughExpression(250, 20000), awaitPromise: true, returnByValue: true }, session)
          .catch(() => undefined);
      };

      if (opts.shots) {
        const shot = await conn.send('Page.captureScreenshot', { format: 'png' }, session);
        const file = path.resolve(opts.out, `shot-${width}.png`);
        fs.writeFileSync(file, Buffer.from(String(shot['data']), 'base64'));
        console.log(file);

        if (opts.full && !between) {
          // Scroll through first so content that arrives on scroll is there, then capture from the top,
          // with scroll-driven reveals shown finished (a capture beyond the viewport does not scroll them).
          await scrollThrough();
          await conn.send('Runtime.evaluate', { expression: finishViewRevealsExpression(), returnByValue: true }, session).catch(() => undefined);
          const metrics = await conn.send('Page.getLayoutMetrics', {}, session);
          const size = (metrics['cssContentSize'] ?? metrics['contentSize']) as { width: number; height: number } | undefined;
          const pageHeight = Math.ceil(size?.height ?? height);
          const slices = Math.min(Math.ceil(pageHeight / SLICE_HEIGHT), MAX_SLICES);
          // A page that holds previews in iframes (the choosing page) asks for a tall viewport with
          // <meta name="argus-capture" content="tall">: the browser stops painting iframes outside the
          // viewport, so they come out blank beyond it. Only such pages: a tall viewport changes vh units.
          const tall = await conn
            .send('Runtime.evaluate', { expression: `document.querySelector('meta[name="argus-capture"][content="tall"]') !== null`, returnByValue: true }, session)
            .then((r) => (r['result'] as { value?: boolean } | undefined)?.value === true)
            .catch(() => false);
          if (tall) {
            await conn.send('Emulation.setDeviceMetricsOverride', { width, height: Math.min(pageHeight, SLICE_HEIGHT * MAX_SLICES), screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: width < 600 }, session);
            await conn.send('Runtime.evaluate', { expression: 'new Promise((r) => setTimeout(r, 1200))', awaitPromise: true }, session).catch(() => undefined);
          }
          const parts: Buffer[] = [];
          for (let i = 0; i < slices; i++) {
            const y = i * SLICE_HEIGHT;
            const part = await conn.send(
              'Page.captureScreenshot',
              { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: Math.min(SLICE_HEIGHT, pageHeight - y), scale: 1 } },
              session,
            );
            const partFile = path.resolve(opts.out, `shot-${width}-full-${String(i + 1).padStart(2, '0')}.png`);
            const bytes = Buffer.from(String(part['data']), 'base64');
            parts.push(bytes);
            fs.writeFileSync(partFile, bytes);
            console.log(partFile);
          }
          if (tall) await conn.send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: width < 600 }, session);
          await conn.send('Runtime.evaluate', { expression: restoreViewRevealsExpression(), returnByValue: true }, session).catch(() => undefined);
          if (pageHeight > slices * SLICE_HEIGHT) console.log(`  (page is ${pageHeight}px tall; captured the first ${slices * SLICE_HEIGHT}px)`);
          // A pinned or scrubbed scene is captured as it stands at the top of the page: often its first
          // state or a blank band. Say where they are, so the reviewer does not read them as empty.
          const bands = ((await evaluate<Array<{ name: string; start: number; end: number; source: string }>>(scenesExpression(MAX_SCENES, false))) ?? [])
            .filter((b) => b.source !== 'animation-timeline');
          if (bands.length) {
            console.log(`  Pinned or scrubbed scenes in this full capture at ${width}px, shown at their start (may look blank; see them with --scenes):`);
            for (const b of bands) console.log(`    "${b.name}" page y ${b.start}-${b.end + height}px (${b.source})`);
          }
          // The slices joined into one tall picture, to see the whole page's rhythm at once.
          const whole = parts.length > 1 ? stitchPngs(parts) : parts[0] ?? null;
          if (whole) {
            const wholeFile = path.resolve(opts.out, `shot-${width}-full.png`);
            fs.writeFileSync(wholeFile, whole);
            console.log(wholeFile);
          } else console.log('  (could not join the slices into one picture; they are written separately)');
        }
      }

      // --scroll-frames: viewport screenshots at evenly spaced scroll positions, top to bottom, each after a short settle.
      if (opts.scrollFrames > 0 && !between) {
        await scrollThrough();
        const metrics = await conn.send('Page.getLayoutMetrics', {}, session);
        const size = (metrics['cssContentSize'] ?? metrics['contentSize']) as { width: number; height: number } | undefined;
        const bottom = Math.max(0, Math.ceil(size?.height ?? height) - height);
        const taken: Captured[] = [];
        for (let f = 0; f < opts.scrollFrames; f++) {
          const y = opts.scrollFrames === 1 ? 0 : Math.round((bottom * f) / (opts.scrollFrames - 1));
          await conn.send('Runtime.evaluate', { expression: scrollToExpression(y), awaitPromise: true }, session).catch(() => undefined);
          await conn.send('Runtime.evaluate', { expression: settleExpression(1000), awaitPromise: true, returnByValue: true }, session).catch(() => undefined);
          const frame = await conn.send('Page.captureScreenshot', { format: 'png' }, session);
          const file = path.resolve(opts.out, `scroll-${width}-${String(f + 1).padStart(2, '0')}.png`);
          const bytes = Buffer.from(String(frame['data']), 'base64');
          fs.writeFileSync(file, bytes);
          console.log(file + `  (scrolled to ${y}px)`);
          if (opts.motionMetrics) taken.push({ buf: bytes, label: `y=${y}px`, canvases: await canvasRects() });
        }
        if (opts.motionMetrics) queue(`scroll-${width}`, `scroll frames at ${width}px`, 'scroll', taken, false);
        await conn.send('Runtime.evaluate', { expression: scrollToExpression(0), awaitPromise: true }, session).catch(() => undefined);
      }

      // --scenes and --timeline: seek through scroll scenes and registered timelines, a frame at each point.
      if (opts.scenes && !between) await bounded(`--scenes at ${width}px`, () => scenes(width));
      if (opts.timelines.length && !between) await bounded(`--timeline at ${width}px`, () => timelines(width), MOTION_STEP_MS * opts.timelines.length);

      if (opts.inventory && !between) {
        const measured = await conn.send('Runtime.evaluate', { expression: inventorySource, returnByValue: true }, session);
        const value = (measured['result'] as { value?: Record<string, unknown> } | undefined)?.value;
        if (!value) throw new Error('the inventory could not run in the page');
        if (reference) printDepartures(width, value, reference);
        else printInventory(width, value);
      }

      if (opts.check) {
        // Measure the whole page as a visitor who scrolled would see it: content revealed on scroll included.
        await scrollThrough();
        // Let finite animations and transitions finish (two seconds at most) so nothing is measured mid-change.
        await conn.send('Runtime.evaluate', { expression: settleExpression(2000), awaitPromise: true, returnByValue: true }, session).catch(() => undefined);
        // --app: tell the checker, which reads this before it runs. Without --app, nothing is set.
        if (opts.app) await conn.send('Runtime.evaluate', { expression: APP_MODE_EXPRESSION }, session);
        // The flow check (1024px and wider, not --app) judges empty stretches as a visitor sees them:
        // step down the page and note what is on each screen, sticky and pinned content included.
        const views: unknown[] = [];
        if (!opts.app && width >= 1024 && !between) {
          const metrics = await conn.send('Page.getLayoutMetrics', {}, session);
          const size = (metrics['cssContentSize'] ?? metrics['contentSize']) as { width: number; height: number } | undefined;
          const pageHeight = Math.ceil(size?.height ?? height);
          if (pageHeight >= height * 1.5) {
            await conn.send('Runtime.evaluate', { expression: snapshotModeExpression(true) }, session);
            for (const y of viewPositions(pageHeight, height)) {
              await conn.send('Runtime.evaluate', { expression: scrollToExpression(y, 150), awaitPromise: true }, session).catch(() => undefined);
              const snap = await conn.send('Runtime.evaluate', { expression: checkerSource, returnByValue: true }, session).catch(() => null);
              const view = (snap?.['result'] as { value?: { boxes?: unknown } } | undefined)?.value;
              if (view && Array.isArray(view.boxes)) views.push(view);
            }
            await conn.send('Runtime.evaluate', { expression: snapshotModeExpression(false) }, session);
            await conn.send('Runtime.evaluate', { expression: scrollToExpression(0), awaitPromise: true }, session).catch(() => undefined);
            await conn.send('Runtime.evaluate', { expression: settleExpression(2000), awaitPromise: true, returnByValue: true }, session).catch(() => undefined);
          }
        }
        if (process.env['ARGUS_DEBUG_VIEWS']) fs.writeFileSync(process.env['ARGUS_DEBUG_VIEWS'] + '-' + width + '.json', JSON.stringify(views));
        // A canvas over a picture (a WebGL layer redrawing it) that captures as one flat colour where the
        // picture is: an empty box where a picture should be. Judged on real pixels, picture by picture.
        const blankCanvases: Array<[number, string]> = [];
        const over = (await evaluate<Array<{ canvas: number; img: number; where: string }>>(CANVAS_OVER_PICTURES)) ?? [];
        for (const c of over) {
          if (blankCanvases.some(([ci]) => ci === c.canvas)) continue;
          const box = await evaluate<{ x: number; y: number; w: number; h: number } | null>(pictureOnScreenExpression(c.img));
          if (!box) continue;
          // The whole screen, then the picture's box in it: a clipped capture can read a WebGL canvas's
          // cleared buffer instead of what is on screen.
          const png = await conn.send('Page.captureScreenshot', { format: 'png' }, session).catch(() => null);
          const raster = png ? decodePng(Buffer.from(String(png['data']), 'base64')) : null;
          if (raster && isFlat(sampleRaster(raster, 2), box)) blankCanvases.push([c.canvas, c.where]);
        }
        if (over.length) await conn.send('Runtime.evaluate', { expression: scrollToExpression(0), awaitPromise: true }, session).catch(() => undefined);
        // Give the checker what the page cannot see itself: the text of stylesheets it may not read
        // (an external file opened from file://, or another origin), and the screens above.
        await conn.send('Runtime.evaluate', { expression: checkOptionsExpression({ sheets: await unreadableSheets(conn, session, sheetIds), views, blankCanvases }) }, session);
        const evaluated = await conn.send('Runtime.evaluate', { expression: checkerSource, returnByValue: true }, session);
        const value = (evaluated['result'] as { value?: CheckResult } | undefined)?.value;
        if (value && Array.isArray(value.findings)) {
          if (opts.app && !relaxedShown) {
            relaxedShown = true;
            console.log(appModeLine(value.relaxed));
          }
          problems = printCheck(width, value, allWidths.some((w) => w <= 330)) || problems;
        } else {
          const details = evaluated['exceptionDetails'] as { exception?: { description?: string }; text?: string } | undefined;
          throw new Error('the checker could not run in the page' + (details ? ' (' + (details.exception?.description ?? details.text ?? 'unknown error').split('\n')[0] + ')' : ''));
        }
      }
      // --transition last at each width: it leaves the page.
      if (opts.transition !== null && !between) await bounded(`--transition at ${width}px`, () => transition(width));
    }
    if (opts.fallbacks) await bounded('--fallbacks', () => fallbacks(), MOTION_STEP_MS * (opts.widths.length + 1));
    if (opts.perfScroll) await bounded('--perf-scroll', () => perfScroll());
    // Contact sheets for every sequence, then the metrics.
    await bounded('making the contact sheets', () => finishAll());
    if (opts.motionMetrics) {
      if (metricsOut.length) {
        const file = path.resolve(opts.out, 'motion-metrics.json');
        fs.writeFileSync(file, JSON.stringify({ limits: MOTION_LIMITS, sequences: metricsOut }, null, 2) + '\n');
        console.log('\nMotion metrics (advisory; look at the contact sheets before acting on a flag):');
        for (const line of metricsSummary(metricsOut)) console.log('  ' + line);
        console.log(file);
      } else console.log('\nMotion metrics: no sequences were captured; add --scenes, --arrival, --timeline, --transition, --frames or --scroll-frames.');
    }
    await conn.send('Browser.close', {}, undefined, 5000).catch(() => undefined);
  } catch (err) {
    failed = true;
    if (err instanceof TapError) {
      console.log('Could not ' + err.verb + ': ' + err.message + '.');
      console.log('Check the selector or label against the page, or tap something that opens it first.');
    } else {
      const why = spawnError ? 'the browser could not be started (' + String(spawnError) + ')' : err instanceof Error ? err.message : String(err);
      console.log('Could not capture the page: ' + why + '.');
      console.log('Use another way to capture the page, or report the work as not rendered.');
    }
  } finally {
    clearTimeout(watchdog);
    conn?.close();
    // Browser.close above lets the browser exit by itself; stopBrowser waits for that before removing the profile.
    await stopBrowser(child, profile);
  }
  if (failed) return 2;
  return problems ? 4 : 0;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.log('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
      process.exit(2);
    },
  );
}
