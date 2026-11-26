/*
 * The finishing-pass rules (finish.md): advisory prompts for left-over text, typewriter marks,
 * proportional prices, heading widows, default easing, border sprawl and a missing og:image.
 * Run through the shipped shot.js on two pages written here: one with each fault, where every
 * rule reports once, and a finished one with the near misses (code, inputs, a steady marquee,
 * scroll-tied motion), where none may. Skipped when no Chrome-family browser is installed.
 */
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findBrowser } from '../scripts/shot';
import { RULES } from '../scripts/rules';

const root = path.join(__dirname, '..', '..');
const shot = path.join(root, 'skills', 'argus', 'scripts', 'shot.js');
const skip = findBrowser() ? false : 'no Chrome-family browser installed';
const FINISH = ['leftover-text', 'straight-quotes', 'price-figures', 'heading-widow', 'bare-easing', 'border-sprawl'];

const lines = (out: string, ruleId: string): string[] => out.split('\n').filter((l) => l.endsWith('[' + ruleId + ']'));
function check(html: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-finish-'));
  try {
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, html);
    return spawnSync(process.execPath, [shot, file, '--check', '--no-shots', '--widths', '1440'], { encoding: 'utf8', timeout: 120000 }).stdout;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const page = (head: string, css: string, body: string): string => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${head}
<style>
body { margin: 0; font: 18px/1.6 Georgia, serif; color: #1a1a1a; background: #fff; }
main { max-width: 60rem; margin: 0 auto; padding: 4rem 2rem; min-height: 2400px; }
h1 { font-size: 64px; line-height: 1.05; margin: 0 0 1rem; }
h2 { font-size: 40px; line-height: 1.1; }
.box { padding: 1rem; margin: 1rem 0; }
${css}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style></head><body><main>${body}</main></body></html>`;

test('the finishing rules are advisory (P3) rules in the catalogue, based on finish.md', () => {
  for (const id of FINISH) {
    const rule = RULES.find((r) => r.tool === 'check' && r.id === id);
    assert.ok(rule, id);
    assert.equal(rule.severity, 'P3', id);
    assert.equal(rule.tier, 'advisory', id);
    assert.equal(rule.basis, 'Argus finish.md', id);
  }
  const finish = fs.readFileSync(path.join(root, 'skills', 'argus', 'references', 'finish.md'), 'utf8');
  for (const id of FINISH) assert.match(finish, new RegExp('`' + id + '`'), `finish.md names ${id}`);
});

test('each finishing rule reports once on a page with its fault', { skip }, () => {
  const out = check(page('<title>Bakery</title><meta name="description" content="Bread."><link rel="icon" href="data:,">', `
a { color: #1a1a1a; transition: color .2s; }
.price { font-size: 32px; }
.b1 { border: 1px solid #333; } .b2 { border: 2px solid #333; } .b3 { border: 3px solid #333; } .b4 { border: 4px solid #333; }`, `
<h1>Fresh bread baked every<br>day</h1>
<p>Our sourdough is "proper" bread - slow and sour. TODO: add the opening hours.</p>
<p><a href="/menu">See the menu</a></p>
<p class="price">$49</p>
<div class="box b1">One</div><div class="box b1">One</div>
<div class="box b2">Two</div><div class="box b2">Two</div>
<div class="box b3">Three</div><div class="box b3">Three</div>
<div class="box b4">Four</div><div class="box b4">Four</div>`));
  for (const id of FINISH) assert.equal(lines(out, id).length, 1, `${id}:\n${out}`);
  assert.match(lines(out, 'leftover-text')[0]!, /TODO, TBD, \[placeholder\] or example\.com/);
  assert.match(lines(out, 'straight-quotes')[0]!, /straight quotes and a hyphen for a dash/);
  assert.match(lines(out, 'price-figures')[0]!, /p\.price "\$49"/);
  assert.match(lines(out, 'heading-widow')[0]!, /h1 "Fresh bread/);
  assert.match(lines(out, 'bare-easing')[0]!, /default ease or linear curve/);
  assert.match(lines(out, 'border-sprawl')[0]!, /4 different border widths are in repeated use \(1px, 2px, 3px, 4px\)/);
  assert.equal(lines(out, 'page-basics').filter((l) => /og:image/.test(l)).length, 1);
});

test('a finished page, with code, inputs, a steady marquee and scroll-tied motion, gets none of them', { skip }, () => {
  const out = check(page('<title>Bakery</title><meta name="description" content="Bread."><link rel="icon" href="data:,"><meta property="og:image" content="https://bakery.test/card.png">', `
h1 { text-wrap: balance; }
a { color: #1a1a1a; transition: color .2s cubic-bezier(.22,1,.36,1); }
.price { font-size: 32px; font-variant-numeric: tabular-nums; }
.rule { border-top: 1px solid #333; }
.marquee { animation: slide 30s linear infinite; }
@keyframes slide { to { transform: translateX(-50%); } }
@supports (animation-timeline: view()) { .grow { animation: grow linear both; animation-timeline: view(); } }
@keyframes grow { from { transform: scale(.96); } }`, `
<h1>Fresh bread, baked every morning</h1>
<p>Our sourdough is “proper” bread – slow and sour, open 7–11.</p>
<p><a href="/menu">See the menu</a></p>
<p class="price">$49</p>
<pre><code>const x = "a" - 1; // TODO</code></pre>
<label>Note <input value='"half" -- please'></label>
<div class="box rule">One</div><div class="box rule">Two</div>
<div class="marquee" aria-hidden="true">Rye · Spelt · Wholemeal</div>
<div class="grow box">Our ovens</div>`));
  for (const id of FINISH) assert.deepEqual(lines(out, id), [], id);
  assert.deepEqual(lines(out, 'page-basics').filter((l) => /og:image/.test(l)), []);
});
