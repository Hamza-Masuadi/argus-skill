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
 *   node shot.js <url-or-html-file> [--out DIR] [--widths 320,390,1440] [--full] [--check] [--no-shots]
 *
 *   --out DIR       where to write PNGs (default: ./shots)
 *   --widths LIST   comma-separated widths in CSS pixels (default: 320,390,1440)
 *   --full          also capture the whole page, top to bottom, as a series of slices at each width
 *   --check         run the Argus checker in the page at each width and print what it finds
 *   --inventory     print the design system the page actually uses: fonts, sizes, colours, radii, control heights
 *   --against URL   compare the page's design system with another page's and print only what is new in this one
 *   --no-shots      with --check or --inventory: write no images
 *
 * Set ARGUS_BROWSER to a browser executable to choose one explicitly.
 * Needs Node 22 or later. Prints the path of each PNG written.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';

interface Options {
  target: string | null;
  out: string;
  widths: number[];
  full: boolean;
  check: boolean;
  inventory: boolean;
  against: string | null;
  shots: boolean;
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

function parseArgs(argv: string[]): Options {
  const opts: Options = { target: null, out: 'shots', widths: [320, 390, 1440], full: false, check: false, inventory: false, against: null, shots: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--out') opts.out = argv[++i] ?? 'shots';
    else if (a === '--widths') {
      opts.widths = String(argv[++i] ?? '').split(',').map(Number).filter((n) => n >= 200 && n <= 4000);
    } else if (a === '--full' || a === '--tall') opts.full = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--inventory') opts.inventory = true;
    else if (a === '--against') {
      opts.against = argv[++i] ?? null;
      opts.inventory = true;
    }
    else if (a === '--no-shots') opts.shots = false;
    else if (!opts.target) opts.target = a;
  }
  return opts;
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
  console.log(`\nCheck at ${width}px: ${p0} broken (P0), ${p1} likely problems (P1), ${s['P2'] ?? 0} rough (P2), ${s['tell'] ?? 0} tells`);
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

async function main(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.target || !opts.widths.length) {
    console.log('Usage: node shot.js <url-or-html-file> [--out DIR] [--widths 320,390,1440] [--full] [--check] [--inventory] [--no-shots]');
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
      await sleep(900);
      const measured = await conn.send('Runtime.evaluate', { expression: inventorySource, returnByValue: true }, session);
      reference = (measured['result'] as { value?: Record<string, unknown> } | undefined)?.value ?? null;
      if (!reference) throw new Error('the inventory could not run in the page to compare against');
    }

    for (const width of opts.widths) {
      const height = width < 600 ? 844 : 900;
      await conn.send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: width < 600 }, session);
      const loaded = conn.waitFor('Page.loadEventFired', session, 25000);
      await conn.send('Page.navigate', { url }, session);
      await loaded;
      // Let web fonts and entrance animations settle before looking.
      await conn
        .send('Runtime.evaluate', { expression: 'document.fonts ? document.fonts.ready.then(() => true) : true', awaitPromise: true }, session)
        .catch(() => undefined);
      await sleep(900);

      if (opts.shots) {
        const shot = await conn.send('Page.captureScreenshot', { format: 'png' }, session);
        const file = path.resolve(opts.out, `shot-${width}.png`);
        fs.writeFileSync(file, Buffer.from(String(shot['data']), 'base64'));
        console.log(file);

        if (opts.full) {
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
