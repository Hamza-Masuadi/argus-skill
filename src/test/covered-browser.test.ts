/*
 * covered-content (something laid over a form, a price or text on the first screen) and two
 * false alarms fixed with it: collapsed-column on a short display label, and lopsided-section on a
 * row of figures whose odometer reels hang below the row, hidden by overflow. Run through the
 * shipped shot.js in a real browser. Skipped when no Chrome-family browser is installed.
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

function run(...args: string[]): string {
  return spawnSync(process.execPath, [shot, ...args], { encoding: 'utf8', timeout: 120000 }).stdout;
}
const lines = (out: string, ruleId: string): string[] => out.split('\n').filter((l) => l.endsWith('[' + ruleId + ']'));

function withPages(files: Record<string, string>, fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-covered-'));
  try {
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
    fs.copyFileSync(path.join(root, 'src', 'test', 'fixtures', 'app-banner.png'), path.join(dir, 'app-banner.png'));
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page</title>
<style>body { margin: 0; font: 18px/1.5 system-ui, sans-serif; color: #1d1d1b; background: #fff; } main { display: block; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;

// A price band that crawls across the booking form and the price beside it.
const MARQUEE = `${HEAD}
.hero { position: relative; min-height: 100vh; padding: 120px 48px 48px; }
form { display: grid; gap: 12px; max-width: 420px; } label { display: grid; gap: 4px; } input { font: inherit; padding: 10px; }
.price { font-size: 28px; }
.band { position: absolute; left: 0; right: 0; top: 230px; z-index: 5; background: #1d1d1b; color: #fff; font: 700 64px/1.1 system-ui, sans-serif; white-space: nowrap; overflow: hidden; }
.band span { display: inline-block; animation: crawl 20s linear infinite; }
@keyframes crawl { to { transform: translateX(-50%); } }
.tail { min-height: 900px; padding: 48px; }
</style></head><body><main>
<section class="hero"><h1>Bike servicing</h1>
<form action="#"><label>Your email <input id="email" type="email" autocomplete="email"></label><button type="submit">Book a service</button></form>
<p class="price">From £45</p>
<div class="band" aria-hidden="true"><span>Tune-up £45 · Full service £85 · Tune-up £45 · Full service £85</span></div>
<button type="button">Pause</button></section>
<section class="tail"><h2>More</h2><p>Text further down the page, so the page is longer than one screen.</p></section>
</main></body></html>`;

// Things that sit over or near content and must not be reported.
const CLEAN = `${HEAD}
header { position: fixed; top: 0; left: 0; right: 0; height: 64px; background: #fff; z-index: 10; display: flex; align-items: center; padding: 0 24px; }
.hero { position: relative; min-height: 100vh; padding: 96px 48px 48px; }
.hero h1 { font-size: 72px; margin: 0; position: relative; }
.cut { position: absolute; left: 40px; top: 110px; width: 260px; height: 70px; object-fit: cover; pointer-events: none; z-index: 2; }
.lead { position: relative; z-index: 1; max-width: 32ch; }
.behind { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; opacity: .25; }
.photo { position: relative; height: 320px; }
.photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.photo .over { position: absolute; left: 24px; bottom: 24px; background: #fff; padding: 12px; }
.bar { position: fixed; left: 0; right: 0; bottom: 0; height: 64px; background: #1d1d1b; color: #fff; display: flex; align-items: center; padding: 0 16px; z-index: 10; }
.tail { min-height: 900px; padding: 48px; }
</style></head><body>
<header><a href="#more">Halden</a></header>
<main><section class="hero">
<img class="behind" src="app-banner.png" alt="" width="1440" height="640">
<h1>Back on it in five days.</h1>
<img class="cut" src="app-banner.png" alt="" width="1440" height="640">
<p class="lead">Bike servicing in Hebden Bridge since 2011, booked in two minutes and back in five working days.</p>
<div class="photo"><img src="app-banner.png" alt="A workshop bench" width="1440" height="640"><div class="over"><p>Prices agreed before any work starts, from £45.</p></div></div>
<p>More text at the foot of the first screen that the phone bar passes over as the page scrolls.</p>
</section>
<section class="tail" id="more"><h2>More</h2><p>Text further down the page, so the page is longer than one screen.</p></section></main>
<div class="bar"><a href="#more" style="color:#fff">Book a service</a></div>
</body></html>`;

test('covered-content is in the catalogue as a P1 from first-screen.md', () => {
  const rule = RULES.find((r) => r.tool === 'check' && r.id === 'covered-content');
  assert.equal(rule?.severity, 'P1');
  assert.equal(rule?.basis, 'Argus first-screen.md');
});

test('covered-content reports a moving band across a booking form and a price, and nothing on a clean first screen', { skip }, () => {
  withPages({ 'marquee.html': MARQUEE, 'clean.html': CLEAN }, (dir) => {
    const bad = run(path.join(dir, 'marquee.html'), '--check', '--no-shots', '--widths', '1440,390');
    const found = lines(bad, 'covered-content');
    assert.equal(found.length, 2, bad);
    assert.match(found[0] ?? '', /^\s+P1 .*\(a moving band\) crosses (input#email|button|label|'From £45')/);
    assert.match(found[0] ?? '', /Nothing may cover, cut across or collide with a form, a price or text/);
    const good = run(path.join(dir, 'clean.html'), '--check', '--no-shots', '--widths', '1440,390');
    assert.match(good, /Check at 1440px[\s\S]*Check at 390px/);
    assert.deepEqual(lines(good, 'covered-content'), [], good);
    // Not an app check.
    assert.deepEqual(lines(run(path.join(dir, 'marquee.html'), '--check', '--no-shots', '--widths', '390', '--app'), 'covered-content'), []);
  });
});

// A narrow price row: a two-word name at display size over a small line, and a column that has
// really lost its width.
const COLUMNS = `${HEAD}
.row { display: grid; grid-template-columns: 108px 1fr; gap: 16px; padding: 24px; }
.n { font: 300 26px/1.1 system-ui, sans-serif; } .n small { display: block; font-size: 14px; line-height: 1.4; margin-top: 4px; }
.broken { display: grid; grid-template-columns: 36px 1fr; gap: 16px; padding: 24px; }
</style></head><body><main><h1>Prices</h1>
<div class="row"><div class="n">White filling<small>From; agreed with you before we start</small></div><p>£140</p></div>
<div class="broken" id="broken"><p>Every booking comes with a fixed price agreed before the work starts.</p><p>Side</p></div>
</main></body></html>`;

test('collapsed-column reports a column that lost its width, not a short display label over a small line', { skip }, () => {
  withPages({ 'columns.html': COLUMNS }, (dir) => {
    const out = run(path.join(dir, 'columns.html'), '--check', '--no-shots', '--widths', '390');
    const found = lines(out, 'collapsed-column');
    assert.equal(found.length, 1, out);
    assert.match(found[0] ?? '', /p "Every booking comes with a fixed price.*about a word per line \(\d+ words on \d+ lines\)/);
  });
});

// A row of four figures under a heading, one with an odometer: its reel of digits is stacked in a
// column and clipped by its box, so most of the reel is never seen.
const FIGURES = `${HEAD}
.hero { min-height: 100vh; padding: 48px; background: #234; color: #fff; }
section { padding: 96px 64px; }
.figures { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 32px; margin-top: 48px; border-top: 2px solid #1d1d1b; }
.figures div { padding-top: 16px; } .figures b { display: block; font-size: 96px; line-height: .9; }
.figures span.l { display: block; font-size: 15px; margin-top: 8px; }
.reel { display: inline-block; height: 1em; overflow: clip; vertical-align: top; } .strip { display: flex; flex-direction: column; } .strip span { height: 1em; line-height: 1; }
.tail { min-height: 900px; }
</style></head><body><main>
<section class="hero"><h1>Dentist</h1><p>Calm appointments, forty minutes each, prices agreed first.</p><a href="#t" style="color:#fff">Book</a></section>
<section><h2>Four dentists and two hygienists.</h2><p>Every dentist is registered with the GDC, and the practice is inspected by the CQC.</p>
<div class="figures">
<div><b>2009</b><span class="l">open on Orchard Street since</span></div>
<div><b><span class="reel"><span class="strip"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></span></span>,200</b><span class="l">registered patients, about</span></div>
<div><b>4.9</b><span class="l">on Google, from 487 reviews</span></div>
<div><b>GDC</b><span class="l">every dentist registered</span></div>
</div></section>
<section class="tail" id="t"><h2>Book</h2><p>Some text here so the page continues below the figures.</p></section>
</main></body></html>`;

test('lopsided-section leaves a row of four figures alone when an odometer reel hangs below it, clipped', { skip }, () => {
  withPages({ 'figures.html': FIGURES }, (dir) => {
    const out = run(path.join(dir, 'figures.html'), '--check', '--no-shots', '--widths', '1440,1920');
    assert.match(out, /Check at 1440px[\s\S]*Check at 1920px/);
    assert.deepEqual(lines(out, 'lopsided-section'), [], out);
  });
});
