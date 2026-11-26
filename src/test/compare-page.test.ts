/*
 * Opens the shipped assets/compare.html in a real headless browser, served over http with a
 * directions.json beside it, and reads what the page shows over the browser's debugging connection.
 * Skipped when no Chrome-family browser is installed.
 */
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { findBrowser, stopBrowser } from '../scripts/shot';

const root = path.join(__dirname, '..', '..');
const page = path.join(root, 'skills', 'argus', 'assets', 'compare.html');
const browser = findBrowser();
const skip = browser ? false : 'no Chrome-family browser installed';

/** Serve compare.html (or the given html in its place), a.html and the given directions.json (none when null); open it in the browser and return what the page shows. */
async function open(directions: unknown, hash = '', html?: string): Promise<{ names: string[]; phone: string | null; desktop: string | null; help: string }> {
  const files: Record<string, string> = {
    '/compare.html': html ?? fs.readFileSync(page, 'utf8'),
    '/a.html': '<!doctype html><title>A</title><p>A</p>',
  };
  if (directions !== null) files['/directions.json'] = JSON.stringify(directions);
  const server = http.createServer((req, res) => {
    const body = files[(req.url ?? '').split('?')[0] ?? ''];
    res.writeHead(body === undefined ? 404 : 200, { 'content-type': (req.url ?? '').endsWith('.json') ? 'application/json' : 'text/html' });
    res.end(body ?? 'not found');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as { port: number }).port;
  const debugPort = await new Promise<number>((r) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => r(p));
    });
  });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-compare-'));
  const child = spawn(browser ?? '', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debugPort}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let wsUrl = '';
    for (let i = 0; i < 100 && !wsUrl; i++) {
      try {
        const list = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()) as Array<{ type: string; webSocketDebuggerUrl?: string }>;
        wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? '';
      } catch {
        /* not up yet */
      }
      if (!wsUrl) await new Promise((r) => setTimeout(r, 150));
    }
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    let id = 0;
    const send = (method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> =>
      new Promise((resolve) => {
        const n = ++id;
        const onMessage = (ev: MessageEvent): void => {
          const msg = JSON.parse(String(ev.data)) as { id?: number; result?: Record<string, unknown> };
          if (msg.id !== n) return;
          ws.removeEventListener('message', onMessage);
          resolve(msg.result ?? {});
        };
        ws.addEventListener('message', onMessage);
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/compare.html${hash}` });
    // Wait until the cards are drawn from directions.json.
    const read = `(() => {
      const b = (v) => document.querySelector('button[data-view="' + v + '"]');
      return { names: Array.from(document.querySelectorAll('.card h2')).map((h) => h.textContent), phone: b('phone') && b('phone').getAttribute('aria-pressed'),
        desktop: b('desktop') && b('desktop').getAttribute('aria-pressed'), help: document.querySelector('header .help').textContent };
    })()`;
    let value = { names: [] as string[], phone: null as string | null, desktop: null as string | null, help: '' };
    for (let i = 0; i < 50; i++) {
      const r = await send('Runtime.evaluate', { expression: read, returnByValue: true });
      value = ((r['result'] as { value?: typeof value } | undefined)?.value) ?? value;
      if (value.names.length) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    ws.close();
    return value;
  } finally {
    server.closeAllConnections();
    server.close();
    await stopBrowser(child, profile);
  }
}

const one = [{ file: 'a.html', name: 'Alpha' }];

test('compare.html: a plain list in directions.json opens in the desktop view with the first-screen wording, as before', { skip }, async () => {
  const v = await open(one);
  assert.deepEqual(v.names, ['Alpha']);
  assert.equal(v.desktop, 'true');
  assert.equal(v.phone, 'false');
  assert.match(v.help, /its first screen, or for a tool or app its main working screen/);
});

test('compare.html: "surface": "app" opens in the phone view and speaks of the main screen', { skip }, async () => {
  const v = await open({ surface: 'app', directions: one });
  assert.deepEqual(v.names, ['Alpha']);
  assert.equal(v.phone, 'true');
  assert.equal(v.desktop, 'false');
  assert.match(v.help, /its main screen\./);
  assert.doesNotMatch(v.help, /first screen/);
  // The object form without "surface" lists the directions and changes nothing else.
  const plain = await open({ directions: one });
  assert.deepEqual(plain.names, ['Alpha']);
  assert.equal(plain.desktop, 'true');
  assert.match(plain.help, /first screen/);
  // #desktop in the address still wins.
  assert.equal((await open({ surface: 'app', directions: one }, '#desktop')).desktop, 'true');
});

test('compare.html: the inline list accepts the app object form as well as a plain list', { skip }, async () => {
  const html = fs.readFileSync(page, 'utf8');
  const slot = /\/\* argus:directions \*\/[\s\S]*?\/\* \/argus:directions \*\//;
  assert.equal(html.split('/* argus:directions */').length, 2, 'the inline list is where builders paste it, between its markers');
  assert.match(html, slot);
  const inline = (value: unknown): string => html.replace(slot, '/* argus:directions */ ' + JSON.stringify(value) + ' /* /argus:directions */');
  // No directions.json is served, as when the page is opened as a file.
  const app = await open(null, '', inline({ surface: 'app', directions: one }));
  assert.deepEqual(app.names, ['Alpha']);
  assert.equal(app.phone, 'true');
  assert.match(app.help, /its main screen\./);
  const plain = await open(null, '', inline(one));
  assert.deepEqual(plain.names, ['Alpha']);
  assert.equal(plain.desktop, 'true');
  assert.match(plain.help, /first screen/);
});

test('the choosing page loads every preview eagerly and asks shot.js --full for a tall viewport, so no card is blank in a full capture', () => {
  const html = fs.readFileSync(page, 'utf8');
  assert.match(html, /<meta name="argus-capture" content="tall">/);
  assert.match(html, /frame\.loading = "eager"/);
  assert.doesNotMatch(html, /loading\s*=\s*["']lazy/);
});

test('roughs and the choosing page live in .argus/roughs/, never among the site\'s own pages', () => {
  const html = fs.readFileSync(page, 'utf8');
  const directions = fs.readFileSync(path.join(root, 'skills', 'argus', 'references', 'directions.md'), 'utf8');
  assert.match(html, /\.argus\/roughs\/index\.html/);
  assert.match(directions, /Copy `assets\/compare\.html` to `\.argus\/roughs\/index\.html`/);
  assert.match(directions, /shot\.js \.argus\/roughs\/a\.html/);
  assert.doesNotMatch(directions, /`(work|roughs)\/[a-c]\.html/);
  // Roughs are built in one thread by default; subagents are optional.
  assert.match(directions, /in this thread, one after another/);
});
