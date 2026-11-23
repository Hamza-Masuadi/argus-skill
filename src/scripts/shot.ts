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
 *   node shot.js <url-or-html-file> [--out DIR] [--widths 320,390,1440,1920] [--wait MS] [--full] [--check] [--no-shots]
 *
 *   --out DIR       where to write PNGs (default: ./shots)
 *   --widths LIST   comma-separated widths in CSS pixels (default: 320,390,1440,1920)
 *   --wait MS       extra time to wait before capturing, after the page has settled (default: 0).
 *                   It always waits first until the page has stopped changing for half a second
 *                   (no DOM changes, no finite animation, no short timer still due), six seconds
 *                   at most, so a first-screen sequence driven by script timers is captured
 *                   finished.
 *   --full          also capture the whole page, top to bottom, as a series of slices at each width.
 *                   It first scrolls through the page a screen at a time, so content that
 *                   appears on scroll and lazy-loaded images are there, then returns to the top.
 *   --check         run the Argus checker in the page at each width and print what it finds
 *                   (after the same scroll-through, so content revealed on scroll is measured)
 *   --inventory     print the design system the page actually uses: fonts, sizes, colours, radii, control heights
 *   --against URL   compare the page's design system with another page's and print only what is new in this one
 *   --no-shots      with --check or --inventory: write no images
 *   --help, -h      print this help
 *
 * Set ARGUS_BROWSER to a browser executable to choose one explicitly.
 * Needs Node 22 or later. Prints the path of each PNG written.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';

export interface Options {
  target: string | null;
  out: string;
  widths: number[];
  /** Extra milliseconds to wait after the page has settled, before capturing. */
  wait: number;
  full: boolean;
  check: boolean;
  inventory: boolean;
  against: string | null;
  shots: boolean;
  help: boolean;
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

// Before capturing, wait until the page has been still for QUIET_MS, at least MIN_SETTLE_MS
// after load and at most SETTLE_CAP_MS. --wait adds time after that, up to MAX_WAIT_MS.
const QUIET_MS = 500;
const MIN_SETTLE_MS = 900;
const SETTLE_CAP_MS = 6000;
const MAX_WAIT_MS = 60000;

export function parseArgs(argv: string[]): Options {
  const opts: Options = { target: null, out: 'shots', widths: [320, 390, 1440, 1920], wait: 0, full: false, check: false, inventory: false, against: null, shots: true, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--out') opts.out = argv[++i] ?? 'shots';
    else if (a === '--widths') {
      opts.widths = String(argv[++i] ?? '').split(',').map(Number).filter((n) => n >= 200 && n <= 4000);
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
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (!opts.target) opts.target = a;
  }
  return opts;
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
 * Evaluated in the page after load and web fonts: resolves once the page has been
 * visually still for `quietMs` (no DOM mutation of any kind, no finite animation or
 * transition running, and no pending one-off timer of the page's own, as counted by
 * timerTrackerSource), but not before `minMs` and never later than `capMs`. A first
 * screen assembled by script timers (classes added one by one, text typed in, styles
 * stepped) keeps the page changing, so the capture waits for it to finish. Endless
 * animations are ignored; a page that never stops changing is captured at the cap.
 * Resolves to { ms, settled }.
 */
export function stableExpression(quietMs = QUIET_MS, minMs = MIN_SETTLE_MS, capMs = SETTLE_CAP_MS): string {
  const quiet = Math.max(0, Math.round(quietMs));
  const min = Math.max(0, Math.round(minMs));
  const cap = Math.max(min, Math.round(capMs));
  return `new Promise((resolve) => {
  const started = Date.now();
  let last = started;
  let observer = null;
  try {
    observer = new MutationObserver(() => { last = Date.now(); });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  } catch (e) { /* no observer: rely on animations and the clock */ }
  const animating = () => {
    if (typeof document.getAnimations !== 'function') return false;
    return document.getAnimations().some((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().endTime !== Infinity);
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
 * mid-change. Endless animations are ignored. Resolves to how many it waited for.
 */
export function settleExpression(capMs = 2000): string {
  return `(() => {
  if (typeof document.getAnimations !== 'function') return Promise.resolve(0);
  const finite = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().endTime !== Infinity);
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
    const finite = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().endTime !== Infinity);
    if (!finite.length) return Promise.resolve();
    return Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => null))), sleep(ms)]);
  };
  const images = (ms) => {
    const pending = Array.from(document.images).filter((i) => !i.complete);
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

/** Wait for the browser to answer on its debugging port and return its connection address. */
async function debuggerAddress(port: number, child: ChildProcess, timeoutMs: number): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error('the browser exited before it was ready');
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const info = (await res.json()) as { webSocketDebuggerUrl?: string };
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

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    const message: Record<string, unknown> = { id, method, params };
    if (sessionId) message['sessionId'] = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(message));
    });
  }

  /** Resolves when the named event arrives, or after the timeout either way. */
  waitFor(method: string, sessionId: string | undefined, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      this.waiters.push({
        method,
        sessionId,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
      });
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

function printCheck(width: number, result: CheckResult): boolean {
  const s = result.summary;
  const p0 = s['P0'] ?? 0;
  const p1 = s['P1'] ?? 0;
  console.log(`\nCheck at ${width}px: ${p0} broken (P0), ${p1} likely problems (P1), ${s['P2'] ?? 0} rough (P2), ${s['P3'] ?? 0} minor or to confirm (P3), ${s['tell'] ?? 0} tells`);
  for (const f of result.findings) console.log(`  ${f.severity.padEnd(4)} ${f.where}  ${f.message}  [${f.rule}]`);
  for (const n of result.notes) console.log(`  note: ${n}`);
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

export const USAGE = [
  'Usage: node shot.js <url-or-html-file> [--out DIR] [--widths 320,390,1440,1920] [--wait MS] [--full] [--check] [--inventory] [--against URL] [--no-shots]',
  '',
  'Screenshots a page in an installed Chrome-family browser (headless, throwaway profile).',
  '',
  '  --out DIR       where to write PNGs (default: ./shots)',
  '  --widths LIST   comma-separated widths in CSS pixels (default: 320,390,1440,1920)',
  '  --wait MS       extra milliseconds to wait before capturing (default: 0). Before',
  '                  that it always waits until the page has stopped changing for half a',
  '                  second (no DOM change, no finite animation, no short timer still due),',
  '                  six seconds at most, so a sequence run by script timers finishes',
  '  --full          also capture the whole page as slices; scrolls through it first so',
  '                  content that appears on scroll and lazy images are there',
  '  --check         run the Argus checker at each width and print what it finds; it also',
  '                  scrolls through first, so content revealed on scroll is measured',
  '  --inventory     print the design system the page actually uses',
  '  --against URL   with --inventory: print only what is new compared with another page',
  '  --no-shots      with --check or --inventory: write no images',
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

  const checkerSource = opts.check ? fs.readFileSync(path.join(__dirname, 'check.js'), 'utf8') : '';
  const inventorySource = opts.inventory ? fs.readFileSync(path.join(__dirname, 'inventory.js'), 'utf8') : '';
  if (opts.shots) fs.mkdirSync(opts.out, { recursive: true });
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
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let conn: Connection | null = null;
  let problems = false;
  let failed = false;
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

    // After a load, wait as for a capture: web fonts, then until the page has stopped changing, then any --wait.
    const live = conn;
    const waitUntilStill = async (where: string): Promise<void> => {
      // Let web fonts and entrance animations settle before looking.
      await live
        .send('Runtime.evaluate', { expression: 'document.fonts ? document.fonts.ready.then(() => true) : true', awaitPromise: true }, session)
        .catch(() => undefined);
      // Wait until the page has stopped changing, so a first screen assembled by script timers is captured finished.
      const stable = await live
        .send('Runtime.evaluate', { expression: stableExpression(), awaitPromise: true, returnByValue: true }, session)
        .catch(() => null);
      const stableValue = (stable?.['result'] as { value?: { ms?: number; settled?: boolean } } | undefined)?.value;
      if (!stableValue) await sleep(MIN_SETTLE_MS);
      else if (stableValue.settled === false) {
        console.log(`  (${where} the page was still changing after ${SETTLE_CAP_MS / 1000}s; captured anyway. If a first-screen sequence was mid-way, add --wait)`);
      }
      if (opts.wait > 0) await sleep(opts.wait);
    };

    // With --against, measure the reference page first, at the first width.
    let reference: Record<string, unknown> | null = null;
    if (opts.against) {
      const refUrl = toUrl(opts.against);
      if (!refUrl) throw new Error('the page to compare against was not found: ' + opts.against);
      const w = opts.widths[0] ?? 1440;
      await conn.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, screenWidth: w, screenHeight: 900, deviceScaleFactor: 1, mobile: w < 600 }, session);
      const refLoaded = conn.waitFor('Page.loadEventFired', session, 25000);
      await conn.send('Page.navigate', { url: refUrl }, session);
      await refLoaded;
      await waitUntilStill(`on the page compared against, at ${w}px,`);
      const measured = await conn.send('Runtime.evaluate', { expression: inventorySource, returnByValue: true }, session);
      reference = (measured['result'] as { value?: Record<string, unknown> } | undefined)?.value ?? null;
      if (!reference) throw new Error('the inventory could not run in the page to compare against');
    }

    for (const width of opts.widths) {
      // Phones: 844 tall at 390; at 320 a 700px screen, the height the length limit is measured with (craft.md).
      const height = width <= 340 ? 700 : width < 600 ? 844 : width >= 1900 ? 1080 : 900;
      await conn.send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: width < 600 }, session);
      const loaded = conn.waitFor('Page.loadEventFired', session, 25000);
      await conn.send('Page.navigate', { url }, session);
      await loaded;
      await waitUntilStill(`at ${width}px`);

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

        if (opts.full) {
          // Scroll through first so content that arrives on scroll is there, then capture from the top.
          await scrollThrough();
          const metrics = await conn.send('Page.getLayoutMetrics', {}, session);
          const size = (metrics['cssContentSize'] ?? metrics['contentSize']) as { width: number; height: number } | undefined;
          const pageHeight = Math.ceil(size?.height ?? height);
          const slices = Math.min(Math.ceil(pageHeight / SLICE_HEIGHT), MAX_SLICES);
          for (let i = 0; i < slices; i++) {
            const y = i * SLICE_HEIGHT;
            const part = await conn.send(
              'Page.captureScreenshot',
              { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: Math.min(SLICE_HEIGHT, pageHeight - y), scale: 1 } },
              session,
            );
            const partFile = path.resolve(opts.out, `shot-${width}-full-${String(i + 1).padStart(2, '0')}.png`);
            fs.writeFileSync(partFile, Buffer.from(String(part['data']), 'base64'));
            console.log(partFile);
          }
          if (pageHeight > slices * SLICE_HEIGHT) console.log(`  (page is ${pageHeight}px tall; captured the first ${slices * SLICE_HEIGHT}px)`);
        }
      }

      if (opts.inventory) {
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
        const evaluated = await conn.send('Runtime.evaluate', { expression: checkerSource, returnByValue: true }, session);
        const value = (evaluated['result'] as { value?: CheckResult } | undefined)?.value;
        if (value && Array.isArray(value.findings)) {
          problems = printCheck(width, value) || problems;
        } else {
          const details = evaluated['exceptionDetails'] as { exception?: { description?: string }; text?: string } | undefined;
          throw new Error('the checker could not run in the page' + (details ? ' (' + (details.exception?.description ?? details.text ?? 'unknown error').split('\n')[0] + ')' : ''));
        }
      }
    }
    await conn.send('Browser.close').catch(() => undefined);
  } catch (err) {
    failed = true;
    console.log('Could not capture the page: ' + (err instanceof Error ? err.message : String(err)) + '.');
    console.log('Use another way to capture the page, or report the work as not rendered.');
  } finally {
    conn?.close();
    if (child.exitCode === null) child.kill();
    await sleep(200);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* the OS will clean the temp folder */
    }
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
