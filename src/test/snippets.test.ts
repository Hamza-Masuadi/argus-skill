import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.join(__dirname, '..', '..');
const dir = path.join(root, 'skills', 'argus', 'assets', 'snippets');
const snippets = fs.readdirSync(dir).filter((x) => x.endsWith('.html') && x !== 'index.html');
const read = (f: string): string => fs.readFileSync(path.join(dir, f), 'utf8');
// The showpiece starters use the same copy markers, so the marker tests cover them too.
const showDir = path.join(root, 'skills', 'argus', 'assets', 'showpiece');
const starters = fs.readdirSync(showDir).filter((x) => x.endsWith('.html') && x !== 'index.html');
const marked = [...snippets.map((f) => path.join(dir, f)), ...starters.map((f) => path.join(showDir, f))];
const stripComments = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

test('the kit is the trimmed set: no cursor effects, no show-pieces, every group the docs name', () => {
  assert.ok(snippets.length >= 40 && snippets.length <= 55, String(snippets.length));
  assert.deepEqual(snippets.filter((f) => f.startsWith('cursor-')), []);
  for (const gone of ['text-blur-sharp', 'scene-physics-toy', 'card-tilt-glare', 'text-typewriter', 'scroll-velocity-skew']) assert.ok(!snippets.includes(gone + '.html'), gone);
  for (const kept of ['svg-annotated-picture', 'scroll-clip-reveal', 'scroll-sticky-steps', 'link-highlighter', 'list-follower-direction', 'arrival-headline-wipe', 'scene-dial', 'text-highlight-draw']) assert.ok(snippets.includes(kept + '.html'), kept);
});

test('copy markers (snippets and showpiece starters): argus:copy-start and argus:copy-end, balanced, never inside each other, never in the header', () => {
  assert.ok(starters.length >= 9, String(starters.length));
  for (const file of marked) {
    const f = path.basename(file);
    const text = fs.readFileSync(file, 'utf8');
    const starts = (text.match(/argus:copy-start/g) ?? []).length;
    const ends = (text.match(/argus:copy-end/g) ?? []).length;
    assert.ok(starts >= 1, `${f}: no copy block`);
    assert.equal(starts, ends, `${f}: ${starts} starts, ${ends} ends`);
    // No bare or old-style marker is left, and the header comment does not name the markers.
    assert.doesNotMatch(text, /argus:copy(?!-start|-end)/, f);
    assert.doesNotMatch(text, /\/argus:copy/, f);
    const header = /^<!doctype html>\s*<!--([\s\S]*?)-->/i.exec(text)?.[1] ?? '';
    assert.doesNotMatch(header, /argus:copy/, `${f}: the header names a marker`);
    // Starts and ends alternate, each pair holding real code.
    const marks = [...text.matchAll(/argus:copy-(start|end)/g)].map((m) => m[1]);
    marks.forEach((m, i) => assert.equal(m, i % 2 === 0 ? 'start' : 'end', `${f}: marker ${i + 1} out of order`));
  }
});

test('a naive sed range extracts a non-empty block from every snippet and starter', { skip: process.platform === 'win32' ? 'no sed' : false }, () => {
  for (const file of marked) {
    const f = path.basename(file);
    const r = spawnSync('sed', ['-n', '/argus:copy-start/,/argus:copy-end/p', file], { encoding: 'utf8' });
    assert.equal(r.status, 0, f);
    const code = r.stdout.split('\n').filter((l) => !/argus:copy-(start|end)/.test(l)).join('').replace(/\s+/g, '');
    assert.ok(code.length >= 40, `${f}: sed extracted ${code.length} characters`);
  }
});

test('no snippet puts vector-effect: non-scaling-stroke and pathLength dashes in one file (it breaks the dash drawing)', () => {
  for (const f of snippets) {
    const code = stripComments(read(f));
    assert.ok(!(/non-scaling-stroke/.test(code) && /pathLength|path-length/i.test(code)), f);
  }
  assert.match(fs.readFileSync(path.join(root, 'skills', 'argus', 'references', 'bespoke.md'), 'utf8'), /Never put `vector-effect: non-scaling-stroke` on a path drawn with `pathLength`/);
});

test('every snippet stands alone: a reduced-motion version, no external files, and the token values of motion-tokens.css', () => {
  const norm = (v: string): string => v.replace(/\s+/g, '').replace(/\b0\./g, '.');
  const allowed = new Map<string, Set<string>>();
  for (const m of stripComments(read('motion-tokens.css'.replace('.css', '.css'))).matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) {
    if (!allowed.has(m[1]!)) allowed.set(m[1]!, new Set());
    allowed.get(m[1]!)!.add(norm(m[2]!));
  }
  assert.ok(allowed.has('--spring') && allowed.has('--t-fast'));
  for (const f of snippets) {
    const text = read(f);
    assert.match(text, /prefers-reduced-motion/, f);
    assert.doesNotMatch(text, /<script[^>]+src=["']?https?:|<link[^>]+href=["']?https?:[^>]+stylesheet|@import/, f);
    for (const m of stripComments(text).matchAll(/(--[a-z-]+)\s*:\s*([^;}]+)[;}]/g)) {
      const ok = allowed.get(m[1]!);
      if (ok) assert.ok(ok.has(norm(m[2]!)), `${f}: ${m[1]} is ${m[2]!.trim().slice(0, 40)}, not the motion-tokens.css value`);
    }
  }
});

test('the gallery lists every snippet once, needs no data files, and is plain', () => {
  const index = read('index.html');
  for (const f of snippets) assert.equal((index.match(new RegExp(`href="${f.replace('.', '\\.')}"`, 'g')) ?? []).length, 1, f);
  assert.doesNotMatch(index, /effects\.(pointer|scroll)\.json|fetch\(/);
  assert.match(index, /system-ui/);
  assert.match(index, new RegExp(`${snippets.length} tested effects`));
});
