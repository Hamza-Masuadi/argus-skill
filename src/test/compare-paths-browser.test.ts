/*
 * The choosing page never shows a folder listing in a preview: a direction given as a.html,
 * a/index.html, a/ or a opens the rough, and one that cannot be loaded shows a message naming the
 * paths tried. Run from file:// and from a static server that lists folders without an index.html
 * (as python3 -m http.server does). Skipped when no Chrome-family browser is installed.
 */
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { findBrowser, stopBrowser } from '../scripts/shot';

const root = path.join(__dirname, '..', '..');
const page = fs.readFileSync(path.join(root, 'skills', 'argus', 'assets', 'compare.html'), 'utf8');
const browser = findBrowser();
const skip = browser ? false : 'no Chrome-family browser installed';

const ENTRIES = ['a.html', 'a/index.html', 'a/', 'a', 'missing.html', 'b/'];
const ROUGH = '<!doctype html><title>Rough A</title><p>Rough A</p>';

/** A project's .argus/roughs/ folder: the choosing page with the list written in, a.html, a/index.html and an empty folder b/. */
function roughs(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-roughs-'));
  const list = ENTRIES.map((file, i) => ({ file, name: 'D' + i }));
  const slot = /\/\* argus:directions \*\/[\s\S]*?\/\* \/argus:directions \*\//;
  fs.writeFileSync(path.join(dir, 'index.html'), page.replace(slot, '/* argus:directions */ ' + JSON.stringify(list) + ' /* /argus:directions */'));
  fs.writeFileSync(path.join(dir, 'a.html'), ROUGH);
  fs.mkdirSync(path.join(dir, 'a'));
  fs.writeFileSync(path.join(dir, 'a', 'index.html'), ROUGH);
  fs.mkdirSync(path.join(dir, 'b'));
  return dir;
}

/** A static server like python3 -m http.server: index.html for a folder when there is one, else a listing; a folder without its slash is redirected. */
function serve(dir: string): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    const file = path.join(dir, url);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.endsWith('/')) {
        res.writeHead(301, { location: url + '/' });
        return res.end();
      }
      if (fs.existsSync(path.join(file, 'index.html'))) {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(fs.readFileSync(path.join(file, 'index.html')));
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(`<!doctype html><title>Directory listing for ${url}</title><h1>Directory listing for ${url}</h1><ul></ul>`);
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/html' });
      return res.end('<title>Error response</title>not found');
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(fs.readFileSync(file));
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

interface Card { src: string | null; missing: string; title: string | null }
interface Seen { cards: Card[]; frames: Array<{ url: string; failed: boolean }> }

/** Open the address in the browser; wait until every card has a preview or a message; return them and the loaded frames. */
async function look(address: string): Promise<Seen> {
  const debugPort = await new Promise<number>((r) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => r(p));
    });
  });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-compare-paths-'));
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
    await send('Page.enable');
    await send('Page.navigate', { url: address });
    const read = `(() => Array.from(document.querySelectorAll('.card')).map((c) => {
      const f = c.querySelector('iframe'); let title = null;
      try { title = f && f.contentDocument ? f.contentDocument.title : null; } catch (e) { title = null; }
      const m = c.querySelector('.missing');
      return { src: f && f.getAttribute('src'), missing: m ? m.textContent : '', title };
    }))()`;
    let cards: Card[] = [];
    for (let i = 0; i < 60; i++) {
      const r = await send('Runtime.evaluate', { expression: read, returnByValue: true });
      cards = ((r['result'] as { value?: Card[] } | undefined)?.value) ?? [];
      if (cards.length === ENTRIES.length && cards.every((c) => c.missing || c.src)) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    await new Promise((r) => setTimeout(r, 500));
    cards = ((await send('Runtime.evaluate', { expression: read, returnByValue: true }))['result'] as { value?: Card[] }).value ?? cards;
    type Tree = { frame: { url: string; unreachableUrl?: string }; childFrames?: Tree[] };
    // A slow machine (Windows CI) may still be loading a preview: wait, for 5s at most, until every
    // card with a preview has a frame that has left about:blank, then read the frames.
    const wanted = cards.filter((c) => c.src).length;
    let frames: Array<{ url: string; failed: boolean }> = [];
    for (let i = 0; i < 50; i++) {
      const tree = (await send('Page.getFrameTree'))['frameTree'] as Tree;
      frames = (tree.childFrames ?? []).map((t) => ({ url: t.frame.unreachableUrl ?? t.frame.url, failed: !!t.frame.unreachableUrl }));
      if (frames.filter((f) => f.url && f.url !== 'about:blank').length >= wanted) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    // The title shown on a card comes from the loaded preview: on a slow machine read the cards again
    // until every card with a preview has one, for 10s at most.
    for (let i = 0; i < 100; i++) {
      cards = ((await send('Runtime.evaluate', { expression: read, returnByValue: true }))['result'] as { value?: Card[] }).value ?? cards;
      if (cards.filter((c) => c.src && !c.missing).every((c) => c.title)) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    ws.close();
    return { cards, frames };
  } finally {
    await stopBrowser(child, profile);
  }
}

function judge(seen: Seen): void {
  const [aHtml, aIndex, aSlash, aBare, gone, empty] = seen.cards;
  assert.equal(seen.cards.length, ENTRIES.length, JSON.stringify(seen));
  assert.equal(aHtml?.src, 'a.html');
  assert.equal(aIndex?.src, 'a/index.html');
  assert.equal(aSlash?.src, 'a/index.html');
  assert.equal(aBare?.src, 'a/index.html');
  for (const c of [aHtml, aIndex, aSlash, aBare]) assert.equal(c?.missing, '', JSON.stringify(c));
  assert.match(gone?.missing ?? '', /could not be loaded\. Tried: missing\.html/);
  assert.match(empty?.missing ?? '', /could not be loaded\. Tried: b\/index\.html/);
  // No preview loads a folder, and none failed to load.
  for (const f of seen.frames) {
    assert.doesNotMatch(f.url, /\/$/, f.url);
    assert.equal(f.failed, false, f.url);
  }
  assert.equal(seen.frames.filter((f) => /\/a(\/index)?\.html$/.test(f.url)).length, 4, JSON.stringify(seen.frames));
}

test('compare.html opened as a file: a.html, a/index.html, a/ and a all show the rough; a missing one shows a message', { skip }, async () => {
  const dir = roughs();
  try {
    judge(await look(pathToFileURL(path.join(dir, 'index.html')).href));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('compare.html served by a folder-listing static server: never a listing in a preview', { skip }, async () => {
  const dir = roughs();
  const server = await serve(dir);
  try {
    const seen = await look(`http://127.0.0.1:${(server.address() as { port: number }).port}/index.html`);
    judge(seen);
    for (const c of seen.cards.slice(0, 4)) assert.equal(c.title, 'Rough A', JSON.stringify(c));
  } finally {
    server.closeAllConnections();
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the choosing page and the roughs live together in .argus/roughs/ and directions.md says to write .html files and look at the page first', () => {
  const directions = fs.readFileSync(path.join(root, 'skills', 'argus', 'references', 'directions.md'), 'utf8');
  assert.match(directions, /"file": "a\.html"/);
  assert.match(directions, /shot\.js \.argus\/roughs\/index\.html/);
  assert.match(page, /a server for the site's own folder cannot reach \.argus\//);
});
