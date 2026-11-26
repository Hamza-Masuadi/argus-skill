/*
 * Faults found by hand in real builds, between and around the widths the skill used to capture:
 * text running into text or a drawn line (text-collision), a canvas over a picture that shows
 * nothing (blank-canvas), and the capture options that hid them or misled the reviewer (--wait with
 * --frames, one folder per page, --tap preferring the form's button, pinned bands in --full, CSS
 * scroll-driven scenes). Plus three checker false alarms: focus drawn inside an SVG link, a timeline
 * counted as many groups, and the price-figures message. Run through the shipped shot.js in a real
 * browser; skipped when no Chrome-family browser is installed.
 */
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findBrowser, decodePng } from '../scripts/shot';

const root = path.join(__dirname, '..', '..');
const shot = path.join(root, 'skills', 'argus', 'scripts', 'shot.js');
const skip = findBrowser() ? false : 'no Chrome-family browser installed';

function run(cwd: string, ...args: string[]): { out: string; code: number | null } {
  const r = spawnSync(process.execPath, [shot, ...args], { encoding: 'utf8', timeout: 150000, cwd });
  return { out: r.stdout, code: r.status };
}
const lines = (out: string, ruleId: string): string[] => out.split('\n').filter((l) => l.endsWith('[' + ruleId + ']'));

function withPages(files: Record<string, string>, fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-collide-'));
  try {
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
    fs.copyFileSync(path.join(root, 'src', 'test', 'fixtures', 'app-banner.png'), path.join(dir, 'app-banner.png'));
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
/** The colour of one pixel of a PNG file, as [r, g, b]. */
function pixel(file: string, x: number, y: number): number[] {
  const r = decodePng(fs.readFileSync(file));
  assert.ok(r, 'a PNG');
  const i = (y * r.width + x) * r.channels;
  return [r.data[i]!, r.data[i + 1]!, r.data[i + 2]!];
}

const HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page</title>
<meta name="description" content="A test page."><link rel="icon" href="data:,">
<style>body { margin: 0; font: 18px/1.5 system-ui, sans-serif; color: #1d1d1b; background: #fff; } .tail { min-height: 1200px; padding: 48px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`;

// A headline that runs into the paragraph under it, and a caption sitting on a drawn curve.
const COLLIDING = `${HEAD}
.hero { position: relative; min-height: 100vh; padding: 80px 48px; }
h1 { font-size: 72px; line-height: 1; margin: 0; max-width: 8ch; }
.sub { position: absolute; top: 150px; left: 48px; max-width: 40ch; margin: 0; }
.curve { position: absolute; left: 0; top: 380px; width: 800px; height: 200px; }
.cap { position: absolute; left: 40px; top: 470px; margin: 0; font-size: 18px; }
</style></head><body><main>
<section class="hero"><h1>Designed and built in the same room.</h1>
<p class="sub">A motion and brand studio in Lisbon and London, making identities and launch films.</p>
<svg class="curve" viewBox="0 0 800 200" role="group" aria-label="Projects on a curve"><path d="M0 100 L800 100" fill="none" stroke="#1d1d1b" stroke-width="4"/></svg>
<p class="cap">Week one, in four days</p>
<a href="#more">Start a project</a></section>
<section class="tail" id="more"><h2>More</h2><p>Text further down.</p></section></main></body></html>`;

// Things that sit close to or over text by design, and must not be reported.
const CLEAN = `${HEAD}
.hero { position: relative; min-height: 100vh; padding: 80px 48px; }
h1 { font-size: 72px; line-height: .82; margin: 0; } h1 .line { display: block; }
.mark { position: relative; } .mark svg { position: absolute; left: 0; right: 0; bottom: -6px; width: 100%; height: 14px; }
.rot { position: relative; display: inline-block; height: 1.5em; overflow: hidden; vertical-align: bottom; }
.rot span { display: block; } .rot span + span { position: absolute; top: 0; left: 0; transform: translateY(110%); }
.ghost { position: absolute; left: 30px; top: 60px; font-size: 160px; font-weight: 800; color: rgb(0 0 0 / .06); margin: 0; z-index: -1; }
.chart { width: 420px; height: 160px; display: block; margin-top: 24px; }
.dash { position: absolute; left: 0; top: 330px; width: 800px; height: 40px; }
.over { position: absolute; left: 60px; top: 335px; margin: 0; }
</style></head><body><main>
<section class="hero"><p class="ghost" aria-hidden="true">STUDIO</p>
<h1><span class="line">Designed and</span><span class="line">built in one room.</span></h1>
<p>Every project opens with a <span class="mark">one-week sprint<svg viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 7 Q50 0 100 7" fill="none" stroke="#e8613c" stroke-width="5"/></svg></span>, and you leave it with
<span class="rot"><span>something playable</span><span>a working site</span></span>.</p>
<svg class="chart" viewBox="0 0 420 160" role="img" aria-label="Projects per year"><line x1="0" y1="140" x2="420" y2="140" stroke="#1d1d1b" stroke-width="2"/><text x="10" y="156" font-size="12">2023</text><text x="380" y="156" font-size="12">2026</text></svg>
<svg class="dash" viewBox="0 0 800 40" aria-hidden="true"><path d="M0 20 L800 20" pathLength="1" fill="none" stroke="#1d1d1b" stroke-width="4" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
<p class="over">Text over a line not drawn yet.</p>
<a href="#more">Start a project</a></section>
<section class="tail" id="more"><h2>More</h2><p>Text further down.</p></section></main></body></html>`;

test('text-collision: text running into text, and text on a drawn line, are floor findings; designed overlaps are not', { skip }, () => {
  withPages({ 'collide.html': COLLIDING, 'clean.html': CLEAN }, (dir) => {
    const bad = run(dir, path.join(dir, 'collide.html'), '--widths', '820', '--check', '--no-shots');
    const found = lines(bad.out, 'text-collision');
    assert.equal(found.length, 1, bad.out);
    assert.match(found[0]!, /P1 .*h1 "Designed and built in the same room\." runs into p/);
    assert.match(found[0]!, /p "Week one, in four days" sits on a drawn line \(path in svg/);
    assert.equal(bad.code, 4);
    const good = run(dir, path.join(dir, 'clean.html'), '--widths', '820,1440', '--check', '--no-shots');
    assert.deepEqual(lines(good.out, 'text-collision'), [], good.out);
  });
});

// A picture whose canvas layer never draws, with the picture hidden under it: an empty box.
const BLANK = `${HEAD}
.pic { position: relative; width: 600px; height: 400px; margin: 40px; } .pic img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; }
.pic canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
</style></head><body><main><h1>Work</h1><a href="#more">Start a project</a>
<div class="pic"><img src="app-banner.png" alt="A poster" width="1440" height="640"><canvas width="600" height="400" aria-hidden="true"></canvas></div>
<section class="tail" id="more"><h2>More</h2><p>Text further down.</p></section></main></body></html>`;
// The same, but the canvas draws the picture.
const DRAWN = BLANK.replace('</main></body>', `</main><script>
const c = document.querySelector('canvas'); const g = c.getContext('2d'); const img = document.querySelector('img');
img.decode().then(() => g.drawImage(img, 0, 0, 600, 400));</script></body>`);

test('blank-canvas: --check flags a canvas that shows one flat colour where its picture should be, not one that draws it', { skip }, () => {
  withPages({ 'blank.html': BLANK, 'drawn.html': DRAWN }, (dir) => {
    const bad = run(dir, path.join(dir, 'blank.html'), '--widths', '1024', '--check', '--no-shots');
    const found = lines(bad.out, 'blank-canvas');
    assert.equal(found.length, 1, bad.out);
    assert.match(found[0]!, /P1 .*canvas over img app-banner\.png/);
    const good = run(dir, path.join(dir, 'drawn.html'), '--widths', '1024', '--check', '--no-shots');
    assert.deepEqual(lines(good.out, 'blank-canvas'), [], good.out);
  });
});

// The page turns black 900ms after load and never changes again.
const LATE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Late</title>
<style>body { margin: 0; height: 1200px; background: rgb(255, 255, 255); }</style></head><body><h1>Late</h1>
<script>setTimeout(() => { document.body.style.background = 'rgb(0, 0, 0)'; }, 900);</script></body></html>`;

test('--wait delays --frames, and without --out each page gets its own folder, printed first', { skip }, () => {
  withPages({ 'late.html': LATE, 'other.html': LATE }, (dir) => {
    const r = run(dir, 'late.html', '--widths', '800', '--frames', '1', '--wait', '1500', '--no-shots');
    assert.equal(r.code, 0, r.out);
    const folder = path.join(dir, 'shots', 'late');
    assert.match(r.out, /^Writing to .*shots[/\\]late \(this page's own folder; --out to choose\)/m);
    assert.deepEqual(pixel(path.join(folder, 'frame-800-01.png'), 400, 600), [0, 0, 0]);
    const o = run(dir, 'other.html', '--widths', '800', '--no-shots', '--frames', '1');
    assert.equal(o.code, 0, o.out);
    assert.ok(fs.existsSync(path.join(dir, 'shots', 'other', 'frame-800-01.png')));
    assert.ok(fs.existsSync(path.join(folder, 'frame-800-01.png')), 'the first page\'s capture is still there');
  });
});

// A header link and a form button both say "Book"; a radio card whose input is hidden says "Large".
const TAPS = `${HEAD}
header { display: flex; gap: 16px; padding: 16px; } .size input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.size { display: inline-block; padding: 12px 20px; border: 2px solid #1d1d1b; margin: 600px 16px 16px; }
</style></head><body><header><a href="#top">Home</a><a href="#book">Book</a></header><main>
<label class="size"><input type="radio" name="size" value="l"> Large</label>
<form id="book" onsubmit="event.preventDefault(); document.body.style.background = 'rgb(0, 0, 0)';"><button type="submit">Book</button></form>
<script>document.querySelector('.size input').addEventListener('change', () => { document.body.style.background = 'rgb(200, 0, 0)'; });</script>
</main></body></html>`;

test('--tap "text=…" presses the form\'s button over a header link with the same words, and a label holding a hidden input', { skip }, () => {
  withPages({ 'taps.html': TAPS }, (dir) => {
    const out = path.join(dir, 'out');
    const book = run(dir, 'taps.html', '--widths', '800', '--tap', 'text=Book', '--out', out);
    assert.equal(book.code, 0, book.out);
    assert.deepEqual(pixel(path.join(out, 'shot-800.png'), 790, 5), [0, 0, 0]);
    const large = run(dir, 'taps.html', '--widths', '800', '--tap', 'text=Large', '--out', out);
    assert.equal(large.code, 0, large.out);
    assert.deepEqual(pixel(path.join(out, 'shot-800.png'), 790, 5), [200, 0, 0]);
  });
});

// A pinned (sticky) scene and a CSS scroll-driven animation.
const SCENES = `${HEAD}
.pin { height: 2400px; } .pin .stage { position: sticky; top: 0; height: 100vh; display: grid; place-items: center; }
.grow { height: 300px; margin: 600px 48px; background: #1d1d1b; animation: grow linear both; animation-timeline: view(); }
@keyframes grow { from { transform: scaleX(.2); } to { transform: scaleX(1); } }
</style></head><body><main><h1>Scenes</h1><section class="pin" id="week"><div class="stage"><p>Monday to Friday</p></div></section>
<div class="grow" id="bar"></div><section class="tail"><p>End.</p></section></main></body></html>`;

test('--full lists the pinned scenes it captured at their start; --scenes also finds CSS scroll-driven animations', { skip }, () => {
  withPages({ 'scenes.html': SCENES }, (dir) => {
    const out = path.join(dir, 'out');
    const full = run(dir, 'scenes.html', '--widths', '1024', '--full', '--out', out);
    assert.equal(full.code, 0, full.out);
    assert.match(full.out, /Pinned or scrubbed scenes in this full capture at 1024px, shown at their start/);
    assert.match(full.out, /"#week" page y \d+-\d+px \(sticky\)/);
    assert.doesNotMatch(full.out, /"#bar" page y/);
    // Sticky stages are found first; the scroll-driven bar is a scene of its own on a page with no pin.
    const noPin = SCENES.replace('<section class="pin" id="week"><div class="stage"><p>Monday to Friday</p></div></section>', '');
    fs.writeFileSync(path.join(dir, 'driven.html'), noPin);
    const sc = run(dir, 'driven.html', '--widths', '1024', '--scenes', '--points', '3', '--no-shots', '--out', out);
    assert.equal(sc.code, 0, sc.out);
    assert.match(sc.out, /Scenes at 1024px: "#bar" \d+-\d+px \(animation-timeline\)/);
  });
});

// An SVG link whose focus style is drawn on its own shape; a five-stop timeline in the first screen.
const FALSE_ALARMS = `${HEAD}
.hero { min-height: 100vh; padding: 60px 48px; } h1 { font-size: 80px; margin: 0 0 24px; }
.kf circle { fill: #fff; stroke: #1d1d1b; stroke-width: 2; } .kf:focus { outline: none; } .kf:focus-visible circle { stroke: #c2410c; stroke-width: 5; }
ol.stops { display: flex; gap: 120px; list-style: none; padding: 0; margin: 40px 0; } ol.stops li span { display: block; margin-top: 24px; }
.price { font: 600 28px/1.2 system-ui, sans-serif; }
</style></head><body><main><section class="hero"><h1>The night line</h1><p>Order by six, collect at half seven.</p><a href="#more">Order for tomorrow</a>
<svg width="200" height="80" viewBox="0 0 200 80" role="group" aria-label="Keyframes"><a class="kf" href="#more"><circle cx="40" cy="40" r="16"/></a></svg>
<ol class="stops"><li><b>6pm</b><span>Order</span></li><li><b>9pm</b><span>Mix</span></li><li><b>2am</b><span>Oven</span></li><li><b>6am</b><span>Shelf</span></li><li><b>7:30</b><span>Collect</span></li></ol>
</section><section class="tail" id="more"><h2>More</h2><p>Text further down.</p></section></main></body></html>`;

test('no false alarms: focus drawn inside an SVG link counts, and a timeline is one group on the first screen', { skip }, () => {
  withPages({ 'alarms.html': FALSE_ALARMS }, (dir) => {
    const r = run(dir, 'alarms.html', '--widths', '1440', '--check', '--no-shots');
    assert.deepEqual(lines(r.out, 'focus-removed'), [], r.out);
    assert.deepEqual(lines(r.out, 'hero-crowded'), [], r.out);
  });
});

test('the price-figures message says the font shorthand resets font-variant-numeric', () => {
  const text = fs.readFileSync(path.join(root, 'src', 'scripts', 'check.ts'), 'utf8');
  assert.match(text.slice(text.indexOf("rule('price-figures'")), /A font: shorthand resets it to normal/);
});
