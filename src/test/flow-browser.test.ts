/*
 * The flow rules (blank-band, lopsided-section, repeated-layout) and the capture
 * options added with them (--reduced-motion, --hover, --frames, --scroll-frames, waiting for a
 * target revealed on scroll, and stylesheets opened from file://), run through the shipped
 * shot.js in a real browser. Skipped when no Chrome-family browser is installed.
 */
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findBrowser } from '../scripts/shot';

const root = path.join(__dirname, '..', '..');
const shot = path.join(root, 'skills', 'argus', 'scripts', 'shot.js');
const fixture = (name: string): string => path.join(root, 'src', 'test', 'fixtures', name);
const skip = findBrowser() ? false : 'no Chrome-family browser installed';
const FLOW = ['blank-band', 'lopsided-section', 'repeated-layout'];

function run(...args: string[]): { out: string; code: number | null } {
  const r = spawnSync(process.execPath, [shot, ...args], { encoding: 'utf8', timeout: 120000 });
  return { out: r.stdout, code: r.status };
}
const lines = (out: string, ruleId: string): string[] => out.split('\n').filter((l) => l.endsWith('[' + ruleId + ']'));

/** Write files into a fresh temporary folder (with the fixture picture and font), run fn on it, and clean up. */
function withPage(files: Record<string, string>, fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-flow-'));
  try {
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
    for (const name of ['app-banner.png', 'face.woff2']) fs.copyFileSync(fixture(name), path.join(dir, name));
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('flow rules leave a dense, varied page alone: a bento grid, a full-bleed picture, an oversized type line', { skip }, () => {
  const { out } = run(fixture('flow-good.html'), '--check', '--no-shots', '--widths', '1024,1440,1920');
  for (const id of FLOW) assert.deepEqual(lines(out, id), [], id);
});

test('blank-band leaves a tall band alone when it holds a full-bleed picture or an oversized type line', { skip }, () => {
  const html = fs.readFileSync(fixture('flow-good.html'), 'utf8')
    .replace('.statement { padding: 56px 0; }', '.statement { padding: 56px 0; min-height: 110vh; }')
    .replace('height: 640px; object-fit: cover;', 'height: 120vh; object-fit: cover;');
  withPage({ 'page.html': html }, (dir) => {
    const { out } = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '1440');
    assert.deepEqual(lines(out, 'blank-band'), []);
  });
});

test('flow rules find the faults: a near-empty band, a lopsided list, three sections on one template', { skip }, () => {
  const { out } = run(fixture('flow-faults.html'), '--check', '--no-shots', '--widths', '1440');
  const band = lines(out, 'blank-band').filter((l) => /^\s+P3 /.test(l) && !/empty gaps of 240px/.test(l));
  assert.equal(band.length, 1);
  assert.match(band[0] ?? '', /h2 "Ring from 8\."  From \d+ to \d+px down the page \([\d.]+ screens\), content covers almost none of the column .*near the heading "Ring from 8\."/);
  // The bands alternate plain and tint with 136px padding: the gaps between blocks are reported once, as a prompt.
  assert.match(lines(out, 'blank-band').find((l) => /^\s+P3 .*empty gaps/.test(l)) ?? '', /empty gaps of 240px or more/);
  const lop = lines(out, 'lopsided-section');
  assert.equal(lop.length, 1);
  assert.match(lop[0] ?? '', /^\s+P3\s+section "Three names\..*heading "Three names\.", the right side has nothing in it for \d+% /);
  const rep = lines(out, 'repeated-layout');
  assert.match(rep[0] ?? '', /^\s+P3 .*3 sections in a row share one layout, 2 columns \(50% \/ 50%\), heading on the left, no picture beside it: "What happens in the five days\.", "Three services, one price each\.", "Bikes that leave here ready\."/);
  // All of them are prompts to look (P3), and the run still counts as no likely problems.
  assert.match(lop[0] ?? '', /Look at it: fine when/);
  assert.match(out, /Check at 1440px: 0 broken \(P0\), 0 likely problems \(P1\)/);
});

test('flow rules read sticky and pinned sections as a visitor scrolls them: a sticky stage, a pinned sideways gallery, questions beside a sticky column, a capped section at 1920', { skip }, () => {
  const { out } = run(fixture('flow-sticky.html'), '--check', '--no-shots', '--widths', '1440,1920');
  assert.match(out, /Check at 1440px[\s\S]*Check at 1920px/);
  for (const id of FLOW) assert.deepEqual(lines(out, id), [], id);
});

test('blank-band still finds the empty end of a sticky scene, and a short sticky block with its column bare under it', { skip }, () => {
  const base = fs.readFileSync(fixture('flow-sticky.html'), 'utf8');
  // The stage holds a short card in a tall box, and the last step keeps to the top of a tall step:
  // when the scene ends, a stretch of nothing follows it on screen. The card is short enough that the
  // stretch is well over the 240px the rule needs at any of the scroll positions it is seen from
  // (a card of 560px left it at exactly 240px, found or not depending on how the text wrapped).
  const ending = base
    .replace('.stage img { height: 100%; }', '.stage img { height: 400px; }')
    .replace('<li class="last">', '<li class="last" style="min-height: 90vh; justify-content: flex-start">');
  // The side column holds only its heading: stuck at the top, its column is bare under it.
  const short = base.replace('<div class="side"><h2>Questions before you start.</h2><img src="app-banner.png" alt="A desk with a laptop" width="1440" height="640"></div>',
    '<div class="side"><h2>Questions before you start.</h2></div>');
  withPage({ 'ending.html': ending, 'short.html': short }, (dir) => {
    // (The tall stage with its short card is sparse near its top too, and may be reported as a band of its own.)
    const end = lines(run(path.join(dir, 'ending.html'), '--check', '--no-shots', '--widths', '1440').out, 'blank-band').filter((l) => /sticky scene beside it ends/.test(l));
    assert.equal(end.length, 1, end.join('\n'));
    assert.match(end[0] ?? '', /^\s+P3\s+h2 "How it gets paid"  From \d+ to \d+px down the page \(0\.\d screens\), nothing at all is on screen where the sticky scene beside it ends/);
    // (The questions list on its own is sparse too, and is reported as a band of its own.)
    const bare = lines(run(path.join(dir, 'short.html'), '--check', '--no-shots', '--widths', '1440').out, 'blank-band').filter((l) => /sticky block/.test(l));
    assert.equal(bare.length, 1, bare.join('\n'));
    assert.match(bare[0] ?? '', /^\s+P3\s+div\.side "Questions before you start\."  This sticky block stays on screen for \d+px of scrolling but fills only the top \d+px of the screen: under it, its column is empty for the rest of the screen \(\d+px, \d+%\) the whole way/);
  });
});

test('blank-band leaves alone the gaps between steps set well apart beside a stuck sticky picture; hide the picture and they are reported', { skip }, () => {
  const { out } = run(fixture('flow-sticky-steps.html'), '--check', '--no-shots', '--widths', '1440');
  assert.match(out, /Check at 1440px/);
  assert.deepEqual(lines(out, 'blank-band'), []);
  const bare = fs.readFileSync(fixture('flow-sticky-steps.html'), 'utf8').replace('.media img {', '.media img { visibility: hidden;');
  withPage({ 'bare.html': bare }, (dir) => {
    const band = lines(run(path.join(dir, 'bare.html'), '--check', '--no-shots', '--widths', '1440').out, 'blank-band').filter((l) => /^\s+P3 /.test(l) && !/empty gaps of 240px/.test(l));
    assert.ok(band.length >= 1, 'the empty gaps beside an empty sticky column are still reported');
    assert.match(band[0] ?? '', /near the heading "How it gets paid"/);
  });
});

test('blank-band leaves alone a hero whose photograph is out of flow (a ::before layer, a fixed picture clipped to the hero); with no photograph it is reported', { skip }, () => {
  const { out } = run(fixture('flow-hero-layer.html'), '--check', '--no-shots', '--widths', '1440');
  assert.match(out, /Check at 1440px/);
  assert.deepEqual(lines(out, 'blank-band'), []);
  const base = fs.readFileSync(fixture('flow-hero-layer.html'), 'utf8');
  const layer = '.hero::before { content: ""; position: absolute; inset: 0; z-index: -1; background: url(app-banner.png) center / cover; }';
  assert.ok(base.includes(layer));
  const fixed = base.replace(layer, '.hero { clip-path: inset(0); } .hero picture, .hero picture img { position: fixed; }')
    .replace('<section class="hero">', '<section class="hero">\n    <picture><img src="app-banner.png" alt="A workshop at dusk" width="1440" height="640"></picture>');
  const empty = base.replace(layer, '');
  withPage({ 'fixed.html': fixed, 'empty.html': empty }, (dir) => {
    assert.deepEqual(lines(run(path.join(dir, 'fixed.html'), '--check', '--no-shots', '--widths', '1440').out, 'blank-band'), []);
    const band = lines(run(path.join(dir, 'empty.html'), '--check', '--no-shots', '--widths', '1440').out, 'blank-band');
    assert.equal(band.length, 1, band.join('\n'));
    assert.match(band[0] ?? '', /^\s+P3\s+h1 "Bikes that leave here ready\."  From 0 to \d+px down the page/);
  });
});

test('flow rules run at 1024px and wider only, and not with --app', { skip }, () => {
  const narrow = run(fixture('flow-faults.html'), '--check', '--no-shots', '--widths', '390,1000');
  for (const id of FLOW) assert.deepEqual(lines(narrow.out, id), [], id);
  const app = run(fixture('flow-faults.html'), '--check', '--no-shots', '--widths', '1440', '--app');
  for (const id of FLOW) assert.deepEqual(lines(app.out, id), [], id);
});

// ---- capture options --------------------------------------------------------------------

const MOTION_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Motion</title>
<style>body { margin: 0; background: rgb(250, 250, 250); font: 17px/1.5 system-ui, sans-serif; }
@media (prefers-reduced-motion: reduce) { body { background: rgb(17, 34, 51); } }</style></head>
<body><main><h1>Motion</h1><p>A page whose ground changes when motion is reduced.</p></main></body></html>`;

test('--reduced-motion emulates prefers-reduced-motion: reduce, alone and with --scheme', { skip }, () => {
  withPage({ 'page.html': MOTION_PAGE }, (dir) => {
    const ground = (...extra: string[]): string => /page background\s+(.+)/.exec(run(path.join(dir, 'page.html'), '--inventory', '--no-shots', '--widths', '1440', ...extra).out)?.[1]?.trim() ?? '';
    assert.equal(ground(), 'rgb(250, 250, 250)');
    assert.equal(ground('--reduced-motion'), 'rgb(17, 34, 51)');
    assert.equal(ground('--reduced-motion', '--scheme', 'dark'), 'rgb(17, 34, 51)');
  });
});

// A card that follows the pointer: pointermove writes how many moves arrived and whether it is
// hovered into a 9px line, so the small-text finding prints the state back.
const HOVER_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Hover</title>
<style>body { margin: 0; font: 17px/1.5 system-ui, sans-serif; } main { padding: 24px; } .gap { height: 1800px; }
.card { width: 300px; height: 200px; background: #eee; } #state { font-size: 9px; }
.late { opacity: 0; transition: opacity .4s; } .late.in { opacity: 1; }
.never { opacity: 0; }</style></head>
<body><main><h1>Hover</h1><p id="state">Not moved</p><div class="gap"></div>
<div class="card" id="card">Card</div>
<button class="late" id="late" type="button">Revealed on scroll</button>
<button class="never" id="never" type="button">Never shown</button></main>
<script>
let moves = 0;
document.getElementById('card').addEventListener('pointermove', () => { moves++; });
document.addEventListener('pointermove', () => {
  document.getElementById('state').textContent = 'Moved ' + (moves > 1 ? 'several' : String(moves)) + ' hover ' + document.getElementById('card').matches(':hover');
});
document.getElementById('late').addEventListener('click', () => { document.getElementById('state').textContent = 'Late tapped'; });
new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setTimeout(() => e.target.classList.add('in'), 300); })).observe(document.getElementById('late'));
</script></body></html>`;

test('--hover moves the real mouse onto a target in several steps, so pointermove handlers and :hover run', { skip }, () => {
  withPage({ 'page.html': HOVER_PAGE }, (dir) => {
    const { out } = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '1440', '--hover', '#card');
    assert.match(out, /^Hovered at 1440px: #card$/m);
    assert.match(out, /p#state "Moved several hover true"/);
    const mixed = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '1440', '--hover', '#card', '--tap', 'text=Revealed on scroll');
    assert.match(mixed.out, /^Ran at 1440px: hover #card, tap text=Revealed on scroll$/m);
    assert.match(mixed.out, /p#state "Late tapped"/);
  });
});

test('--tap and --hover wait for a target revealed on scroll, and fail only when it never shows', { skip }, () => {
  withPage({ 'page.html': HOVER_PAGE }, (dir) => {
    const late = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '1440', '--tap', '#late');
    assert.equal(late.code === 0 || late.code === 4, true, late.out);
    assert.match(late.out, /p#state "Late tapped"/);
    const never = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '1440', '--hover', '#never');
    assert.equal(never.code, 2);
    assert.match(never.out, /^Could not hover: nothing to hover for --hover "#never" at 1440px: it is still hidden 2s after being scrolled into view \(transparent, invisible or clipped\)\.$/m);
  });
});

// The ground steps through colours every 100ms for a second: the frames see it change, the settled shot does not.
const STEPS_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Frames</title>
<style>body { margin: 0; height: 3000px; background: rgb(0, 0, 0); } h1 { margin: 0; }</style></head><body><main><h1>Frames</h1></main>
<script>let i = 0; const step = () => { i++; document.body.style.background = 'rgb(' + (i * 25) + ', 0, 0)'; if (i < 10) setTimeout(step, 100); }; setTimeout(step, 100);</script></body></html>`;

test('--frames takes N viewport shots at --every MS without waiting for the page to settle', { skip }, () => {
  withPage({ 'page.html': STEPS_PAGE }, (dir) => {
    const out = path.join(dir, 'shots');
    const r = run(path.join(dir, 'page.html'), '--widths', '800', '--frames', '4', '--every', '120', '--out', out);
    assert.equal(r.code, 0, r.out);
    const files = fs.readdirSync(out).sort();
    assert.deepEqual(files, ['frame-800-01.png', 'frame-800-02.png', 'frame-800-03.png', 'frame-800-04.png', 'shot-800.png']);
    assert.match(r.out, /4 frames at 800px, 120ms apart/);
    const bytes = files.filter((f) => f.startsWith('frame')).map((f) => fs.readFileSync(path.join(out, f)).toString('base64'));
    assert.ok(new Set(bytes).size > 1, 'the frames show the page changing');
  });
});

test('--scroll-frames takes N viewport shots at evenly spaced scroll positions, top to bottom', { skip }, () => {
  withPage({ 'page.html': STEPS_PAGE }, (dir) => {
    const out = path.join(dir, 'shots');
    const r = run(path.join(dir, 'page.html'), '--widths', '800', '--height', '600', '--scroll-frames', '3', '--no-shots', '--out', out);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(fs.readdirSync(out).sort(), ['scroll-800-01.png', 'scroll-800-02.png', 'scroll-800-03.png']);
    assert.match(r.out, /scroll-800-01\.png  \(scrolled to 0px\)/);
    assert.match(r.out, /scroll-800-02\.png  \(scrolled to 1200px\)/);
    assert.match(r.out, /scroll-800-03\.png  \(scrolled to 2400px\)/);
  });
});

test('a bad --frames, --every or --scroll-frames stops before any browser starts', () => {
  for (const [args, message] of [
    [['--frames', '0'], /--frames takes a whole number from 1 to 60 \(got "0"\)\./],
    [['--frames', '--check'], /--frames takes a whole number from 1 to 60 \(got "--check"\)\./],
    [['--every', '5'], /--every takes milliseconds from 30 to 10000 \(got "5"\)\./],
    [['--scroll-frames', 'many'], /--scroll-frames takes a whole number from 1 to 40 \(got "many"\)\./],
    [['--hover'], /--hover takes a CSS selector or text=Label\./],
  ] as Array<[string[], RegExp]>) {
    const r = run(fixture('web-page.html'), ...args);
    assert.equal(r.code, 1, args.join(' '));
    assert.match(r.out, message);
  }
});

// An animated page whose stylesheet is an external file: opened from file://, the page cannot read its rules.
// The animation runs while the check runs, so the page is known to animate either way.
const SHEET_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Sheet</title>
<link rel="stylesheet" href="site.css"></head><body><main><h1>Spinner</h1><p>A page whose motion lives in an external stylesheet.</p><div class="spin"></div><button type="button">Pause</button></main></body></html>`;
const SHEET = `body { margin: 0; font: 17px/1.5 system-ui, sans-serif; } .spin { width: 20px; height: 20px; background: #333; animation: turn 2s linear infinite; }
@keyframes turn { from { transform: rotate(0); } to { transform: rotate(90deg); } }`;

test('reduced-motion reads an external stylesheet opened from file://: a rule there counts, and its absence is still reported', { skip }, () => {
  withPage({ 'page.html': SHEET_PAGE, 'site.css': SHEET + '\n@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }' }, (dir) => {
    const { out } = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '390');
    assert.deepEqual(lines(out, 'reduced-motion'), []);
  });
  withPage({ 'page.html': SHEET_PAGE, 'site.css': SHEET }, (dir) => {
    const { out } = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '390');
    assert.equal(lines(out, 'reduced-motion').length, 1);
  });
});

// A page 430px wide in a 390px phone screen: the browser widens the layout past the screen and
// shifts the screen inside it, so a press aimed by layout position alone lands below the button.
const WIDE_PHONE_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tap</title>
<style>body { margin: 0; font: 17px/1.5 system-ui, sans-serif; } .wide { width: 430px; height: 40px; background: #eee; } .gap { height: 1600px; }
#go { display: block; height: 28px; padding: 0 12px; } #state { font-size: 9px; } .after { height: 1200px; }</style></head>
<body><main><h1>Tap</h1><p id="state">Not tapped</p><div class="wide"></div><div class="gap"></div>
<button id="go" type="button">Go</button><div class="after"></div></main>
<script>document.getElementById('go').addEventListener('click', () => { document.getElementById('state').textContent = 'Tapped'; });</script></body></html>`;

test('--tap at a phone width lands on the target when the page is wider than the screen', { skip }, () => {
  withPage({ 'page.html': WIDE_PHONE_PAGE }, (dir) => {
    const r = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '390', '--tap', '#go');
    assert.match(r.out, /^Tapped at 390px: #go$/m);
    assert.match(r.out, /p#state "Tapped"/);
    // The page really is too wide: that is still reported.
    assert.match(r.out, /Page is 430px wide in a 390px viewport/);
  });
});

// A field revealed on scroll (it fades in 300ms after it comes into view), and one that never shows.
const REVEAL_FORM_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Reveal</title>
<style>body { margin: 0; font: 17px/1.5 system-ui, sans-serif; } main { padding: 24px; } .gap { height: 1800px; } #state { font-size: 9px; }
.late { opacity: 0; transition: opacity .4s; } .late.in { opacity: 1; } .never { opacity: 0; }</style></head>
<body><main><h1>Reveal</h1><p id="state">Empty</p><div class="gap"></div>
<label class="late" id="wrap">Your email <input id="email" type="email"></label>
<label class="never">Hidden <input id="hidden" type="text"></label></main>
<script>
document.getElementById('email').addEventListener('input', (e) => { document.getElementById('state').textContent = 'Typed ' + e.target.value; });
new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setTimeout(() => e.target.classList.add('in'), 300); })).observe(document.getElementById('wrap'));
</script></body></html>`;

test('--type waits for a field revealed on scroll, by selector and by label, and fails only when it never shows', { skip }, () => {
  withPage({ 'page.html': REVEAL_FORM_PAGE }, (dir) => {
    const bySelector = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '1440', '--type', '#email=ana@example.com');
    assert.match(bySelector.out, /p#state "Typed ana@example\.com"/, bySelector.out);
    const byLabel = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '1440', '--type', 'text=Your email=bo@example.com');
    assert.match(byLabel.out, /p#state "Typed bo@example\.com"/, byLabel.out);
    const never = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '1440', '--type', '#hidden=x');
    assert.equal(never.code, 2);
    assert.match(never.out, /^Could not type: nothing to type into for --type "#hidden" at 1440px: it is still hidden 2s after being scrolled into view \(transparent, invisible or clipped\)\.$/m);
  });
});

// A band 14px wider than a 390px phone, on a page whose screen.width reports the window's width
// (as Brave does) rather than the emulated screen's: the overflow is still measured at 390.
const SCREEN_LIES_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Overflow</title>
<script>for (const k of ['width', 'availWidth']) Object.defineProperty(Screen.prototype, k, { get: () => window.innerWidth });</script>
<style>body { margin: 0; font: 17px/1.5 system-ui, sans-serif; } main { padding: 16px; } .wide { width: 404px; height: 40px; background: #036; }</style></head>
<body><main><h1>Overflow</h1><p>A band 14px wider than the phone.</p></main><div class="wide"></div></body></html>`;

test('page-overflow at 390 is measured from the layout viewport, not screen.width, so a 14px overflow is reported', { skip }, () => {
  withPage({ 'page.html': SCREEN_LIES_PAGE }, (dir) => {
    const r = run(path.join(dir, 'page.html'), '--check', '--no-shots', '--widths', '390');
    assert.match(r.out, /P0 {3}page {2}Page is 40[45]px wide in a 390px viewport; it scrolls sideways\.\s+\[page-overflow\]/, r.out);
    assert.match(r.out, /div\.wide {2}Extends to 404px, past the 390px viewport\./);
  });
});

// Ambient motion: a scroll-driven animation, an endless one, an idle easing loop that rewrites a
// transform by fractions of a pixel every frame, and a marquee track moved by script inside an
// aria-hidden part. None of it is a sequence to wait for.
const AMBIENT_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Ambient</title>
<style>body { margin: 0; font: 17px/1.5 system-ui, sans-serif; } .tall { height: 3000px; }
@keyframes grow { from { transform: scaleX(0.2); } to { transform: scaleX(1); } } .bar { height: 20px; background: #345; animation: grow linear both; animation-timeline: view(); }
@keyframes pulse { 50% { opacity: .5; } } .dot { width: 20px; height: 20px; background: #a33; animation: pulse 2s infinite; }
.track { white-space: nowrap; }</style></head>
<body><main><h1>Ambient</h1><div class="dot"></div><div id="follow">Follows</div><div aria-hidden="true"><div class="track" id="track">Free check · Fixed price · Free check · Fixed price</div></div>
<div class="tall"></div><div class="bar"></div><div class="tall"></div></main>
<script>
let x = 0.4; let m = 0;
const loop = () => { x += (0 - x) * 0.08; document.getElementById('follow').style.transform = 'translate(' + x.toFixed(3) + 'px, 0px)';
  m -= 2; document.getElementById('track').style.transform = 'translateX(' + (m % 400) + 'px)'; requestAnimationFrame(loop); };
requestAnimationFrame(loop);
</script></body></html>`;
// Real instability: the words change every quarter second, for ever.
const RESTLESS_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Restless</title></head>
<body><main><h1>Restless</h1><p id="n">0</p></main><script>let n = 0; setInterval(() => { document.getElementById('n').textContent = String(++n); }, 250);</script></body></html>`;

test('the settle wait ignores ambient motion and still warns about a page that keeps changing', { skip }, () => {
  withPage({ 'ambient.html': AMBIENT_PAGE, 'restless.html': RESTLESS_PAGE }, (dir) => {
    const calm = run(path.join(dir, 'ambient.html'), '--widths', '800', '--out', path.join(dir, 'shots'));
    assert.equal(calm.code, 0, calm.out);
    assert.doesNotMatch(calm.out, /still changing/);
    const restless = run(path.join(dir, 'restless.html'), '--widths', '800', '--out', path.join(dir, 'shots'));
    assert.match(restless.out, /\(at 800px the page was still changing after 6s; captured anyway/);
  });
});
