/*
 * The design rules (faults of finish: sizes and radii from no system, small running text, twin
 * faces, a crowded first screen), run through the shipped shot.js in a real browser on two
 * fixtures: a page with those faults, where every rule must report, and a finished page, where
 * none may. Skipped when no Chrome-family browser is installed.
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
const fixture = (name: string): string => path.join(root, 'src', 'test', 'fixtures', name);
const skip = findBrowser() ? false : 'no Chrome-family browser installed';

const DESIGN = ['type-untokened-sizes', 'type-small-body', 'type-twin-faces', 'radius-sprawl', 'hero-crowded'];
/** Rules removed because they punished a legitimate style (a calm page, a split hero, a soft card, an off-white ground). */
const REMOVED = [
  'type-timid-display', 'type-loose-display', 'type-default-face', 'flat-tonal-range', 'house-ground', 'card-shadow-everywhere',
  'gradient-as-material', 'hero-boxed-photo', 'no-overlap', 'boxed-everything', 'callout-left-border', 'hover-lift-default',
  'hover-scale-default', 'hover-one-note', 'reveal-one-note', 'still-page', 'warm-default-ground',
];

function run(...args: string[]): string {
  const r = spawnSync(process.execPath, [shot, ...args], { encoding: 'utf8', timeout: 120000 });
  return r.stdout;
}
const lines = (out: string, ruleId: string): string[] => out.split('\n').filter((l) => l.endsWith('[' + ruleId + ']'));

/** Write a page next to copies of the fixture picture and font, run fn on it, and clean up. */
function withPage(html: string, fn: (file: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-design-'));
  try {
    for (const name of ['app-banner.png', 'face.woff2']) fs.copyFileSync(fixture(name), path.join(dir, name));
    fs.writeFileSync(path.join(dir, 'page.html'), html);
    fn(path.join(dir, 'page.html'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the design rules are in the catalogue with an Argus basis naming their reference, at P3; the style rules are gone', () => {
  for (const id of DESIGN) {
    const rule = RULES.find((r) => r.tool === 'check' && r.id === id);
    assert.ok(rule, id);
    assert.match(rule.basis, /^Argus (type|colour|heroes|first-screen|layout|motion)\.md$/, id);
    assert.equal(rule.severity, 'P3', id);
  }
  for (const id of REMOVED) assert.equal(RULES.find((r) => r.id === id), undefined, id);
  // The old count of sizes is replaced by type-untokened-sizes.
  assert.equal(RULES.find((r) => r.id === 'many-type-sizes'), undefined);
});

test('every design rule reports on a page with faults of finish, with what it measured', { skip }, () => {
  const out = run(fixture('design-faults.html'), '--check', '--no-shots', '--widths', '1440');
  for (const id of DESIGN) assert.ok(lines(out, id).length >= 1, id + ' did not report:\n' + out);
  const one = (id: string): string => lines(out, id)[0] ?? '';
  assert.match(one('type-untokened-sizes'), /Headings come in 5 mid sizes \(28, 32, 40, 48, 56-60px\)/);
  assert.match(one('type-small-body'), /100% of the running text is under 16px \(14px\)/);
  assert.match(one('type-twin-faces'), /These two faces look alike: inter \(display\) and body sans \(body\) are both sans faces/);
  assert.equal(lines(out, 'radius-sprawl').length, 1);
  assert.match(one('radius-sprawl'), /4 different corner radii are in repeated use \(4px, 8px, 12px, 20px/);
  assert.match(one('hero-crowded'), /holds about (\d{2}|[7-9]) separate groups/);
  // The page's off-white ground, soft card shadows, boxed photograph beside the headline, lifting
  // buttons and one reveal are a style, not faults: nothing reports them.
  for (const id of REMOVED) assert.deepEqual(lines(out, id), [], id);
  // All prompts: the page still has no broken or likely problems from them.
  assert.match(out, /Check at 1440px: 0 broken \(P0\), 0 likely problems \(P1\)/);
});

test('no design rule reports on a finished page', { skip }, () => {
  const out = run(fixture('design-good.html'), '--check', '--no-shots', '--widths', '1440');
  assert.match(out, /Check at 1440px/);
  for (const id of DESIGN) assert.deepEqual(lines(out, id), [], id);
});

test('the design rules run at 1024px and wider only, and not with --app', { skip }, () => {
  const narrow = run(fixture('design-faults.html'), '--check', '--no-shots', '--widths', '390');
  const app = run(fixture('design-faults.html'), '--check', '--no-shots', '--widths', '1440', '--app');
  for (const id of DESIGN) {
    assert.deepEqual(lines(narrow, id), [], id + ' at 390');
    assert.deepEqual(lines(app, id), [], id + ' with --app');
  }
});

test('hero-crowded counts a booking form, or the card holding it, as one group', { skip }, () => {
  const field = (label: string, type = 'text'): string => `<label>${label} <input name="${label.toLowerCase().replace(/\W+/g, '-')}" type="${type}"></label>`;
  const form = `<form class="card" action="#"><h2>Book a service</h2>${field('Your name')}${field('Your email', 'email')}${field('Phone', 'tel')}${field('Bike make')}${field('Preferred day', 'date')}` +
    `<label>Service <select name="service"><option>Full service</option><option>Safety check</option></select></label><button type="submit">Book</button></form>`;
  const page = (inner: string): string => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Booking</title><link rel="icon" href="data:,">
<style>body{margin:0;font:18px/1.5 Georgia,serif;color:#1c1b1a;background:#fff}header{padding:18px 64px}main{display:grid;grid-template-columns:1fr 1fr 420px;gap:48px;padding:24px 64px;min-height:820px;align-items:start}
h1{font-size:56px;line-height:1.05;margin:0 0 20px}h2{font-size:22px;margin:0}.card{display:grid;gap:20px;padding:28px;background:#f1efe9;border-radius:6px}
label{display:grid;gap:4px;font-size:16px}input,select{height:40px;font:inherit}button{height:44px;font:inherit}img{width:100%;height:560px;object-fit:cover}</style></head>
<body><header><strong>Spoke and Chain</strong></header><main><div><h1>Your bike back in five days.</h1><p>A full service at the canal workshop, price agreed first.</p></div>
<img src="app-banner.png" width="600" height="60" alt="A bike on a stand">${inner}</main>
<section style="padding:64px;min-height:900px"><h2>How a service works</h2><p>Drop the bike off, we call with a fixed price, you collect it within five working days.</p></section></body></html>`;
  withPage(page(form), (file) => {
    const out = run(file, '--check', '--no-shots', '--widths', '1440');
    assert.match(out, /Check at 1440px/);
    assert.deepEqual(lines(out, 'hero-crowded'), [], out);
  });
  // The same fields loose on the page, with no form or card around them, are still counted one by one.
  withPage(page(form.replace('<form class="card" action="#">', '<div>').replace('</form>', '</div>').replace(/<label>/g, '<label style="margin-bottom:24px">')), (file) => {
    const out = run(file, '--check', '--no-shots', '--widths', '1440');
    assert.equal(lines(out, 'hero-crowded').length, 1, out);
  });
});

test('each design rule falls silent when its one fault is fixed', { skip }, () => {
  const base = fs.readFileSync(fixture('design-faults.html'), 'utf8');
  const fixes: Record<string, (html: string) => string> = {
    'type-small-body': (h) => h.replace('.story p { font-size: 14px;', '.story p { font-size: 18px;'),
    // One family for both roles.
    'type-twin-faces': (h) => h.replace('font: 18px/1.5 "Body Sans", sans-serif', 'font: 18px/1.5 "Inter", sans-serif'),
  };
  withPage(Object.values(fixes).reduce((h, fix) => fix(h), base), (file) => {
    const out = run(file, '--check', '--no-shots', '--widths', '1440');
    assert.match(out, /Check at 1440px/);
    for (const id of Object.keys(fixes)) assert.deepEqual(lines(out, id), [], id);
  });
});

test('hero-video: a looping video that plays by itself reports sound, playsinline, poster and pause; a finished one reports nothing', { skip }, () => {
  const bad = lines(run(fixture('video-hero.html'), '--check', '--no-shots', '--widths', '1440'), 'hero-video');
  assert.ok(bad.some((l) => /^P1 .*with sound on/.test(l.trim())), bad.join('\n'));
  assert.ok(bad.some((l) => /^P1 .*no pause control/.test(l.trim())), bad.join('\n'));
  assert.ok(bad.some((l) => /^P2 .*no playsinline .* and no poster/.test(l.trim())), bad.join('\n'));
  const good = lines(run(fixture('video-hero-good.html'), '--check', '--no-shots', '--widths', '1440'), 'hero-video');
  assert.deepEqual(good, []);
});

test('hero-wordy: a first screen of paragraphs reports at P3; a statement, a line and the action, or one large type-led statement, do not', { skip }, () => {
  const rule = RULES.find((r) => r.tool === 'check' && r.id === 'hero-wordy');
  assert.ok(rule && rule.severity === 'P3' && /composure\.md/.test(rule.basis));
  const para = 'The workshop on the canal takes bikes of every make and age, and every service starts with a call to agree the price before any work begins, so nothing on the bill is a surprise when you collect.';
  const page = (hero: string): string => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Workshop</title><link rel="icon" href="data:,">
<style>body{margin:0;font:18px/1.5 Georgia,serif;color:#1c1b1a;background:#fff}header{padding:18px 64px}main{padding:48px 64px;min-height:820px;max-width:1100px}h1{font-size:56px;line-height:1.05;margin:0 0 20px}.big{font-size:120px;line-height:1}</style></head>
<body><header><strong>Spoke and Chain</strong> <a href="#book">Book</a></header><main>${hero}</main><section style="padding:64px;min-height:900px"><h2>How a service works</h2><p>${para}</p></section></body></html>`;
  withPage(page(`<h1>Your bike back in five days.</h1><p>${para}</p><p>${para}</p><p>${para}</p><p>${para}</p><a id="book" href="#">Book a service</a>`), (file) => {
    const out = run(file, '--check', '--no-shots', '--widths', '1440');
    assert.equal(lines(out, 'hero-wordy').length, 1, out);
    assert.match(lines(out, 'hero-wordy')[0] ?? '', /carries about \d+ words/);
  });
  withPage(page(`<h1>Your bike back in five days.</h1><p>A full service at the canal workshop, price agreed first.</p><a id="book" href="#">Book a service</a>`), (file) => {
    assert.deepEqual(lines(run(file, '--check', '--no-shots', '--widths', '1440'), 'hero-wordy'), []);
  });
  withPage(page(`<p class="big">Ride on Monday. Fixed by Friday.</p><a id="book" href="#">Book a service</a>`), (file) => {
    assert.deepEqual(lines(run(file, '--check', '--no-shots', '--widths', '1440'), 'hero-wordy'), []);
  });
  // Labels inside an SVG drawing, and a price list that is itself the hero, are not paragraphs to cut.
  const labels = Array.from({ length: 60 }, (_, i) => `<text x="${(i % 10) * 90}" y="${20 + Math.floor(i / 10) * 40}">gear ${i} ratio</text>`).join('');
  withPage(page(`<h1>Your bike back in five days.</h1><svg width="900" height="260" role="img" aria-label="Drivetrain diagram">${labels}</svg><a id="book" href="#">Book a service</a>`), (file) => {
    assert.deepEqual(lines(run(file, '--check', '--no-shots', '--widths', '1440'), 'hero-wordy'), []);
  });
  const rows = Array.from({ length: 12 }, (_, i) => `<li style="display:flex;justify-content:space-between;border-top:1px solid #ccc;padding:10px 0"><span>Service number ${i} with brakes, gears and a wash</span><span>£${40 + i * 5}</span></li>`).join('');
  withPage(page(`<h1>Prices.</h1><ul style="list-style:none;padding:0;margin:0;width:900px">${rows}</ul><a id="book" href="#">Book a service</a>`), (file) => {
    assert.deepEqual(lines(run(file, '--check', '--no-shots', '--widths', '1440'), 'hero-wordy'), []);
  });
});
