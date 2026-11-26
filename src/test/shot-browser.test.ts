/*
 * Runs the shipped shot.js in a real browser on the fixture pages in src/test/fixtures.
 * Skipped when no Chrome-family browser is installed.
 *
 * The files in fixtures/expected were written by shot.js as it was before --height,
 * --scheme and --app existed (`--check --no-shots --widths 390,1440`, no other flags),
 * so the first test proves that without the new flags the output is unchanged. They were updated
 * once since, only to add the motionless-page finding (a new rule) and its count, and to drop a
 * contrast finding that only a computer in dark mode produced (shot.js now emulates light and
 * no-preference unless --scheme or --reduced-motion is given, so the output no longer depends on it).
 */
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { findBrowser, decodePng } from '../scripts/shot';

const root = path.join(__dirname, '..', '..');
const shot = path.join(root, 'skills', 'argus', 'scripts', 'shot.js');
const fixture = (name: string): string => path.join(root, 'src', 'test', 'fixtures', name);
const skip = findBrowser() ? false : 'no Chrome-family browser installed';

function run(...args: string[]): { out: string; code: number | null } {
  const r = spawnSync(process.execPath, [shot, ...args], { encoding: 'utf8', timeout: 120000 });
  return { out: r.stdout, code: r.status };
}

/** The findings printed for one rule id, as lines. */
const lines = (out: string, ruleId: string): string[] => out.split('\n').filter((l) => l.endsWith('[' + ruleId + ']'));

for (const name of ['web-page', 'app-screen', 'app-list']) {
  test(`without the new flags, the check of ${name}.html prints exactly what it printed before`, { skip }, () => {
    const expected = fs.readFileSync(fixture(path.join('expected', name + '.txt')), 'utf8');
    const { out } = run(fixture(name + '.html'), '--check', '--no-shots', '--widths', '390,1440');
    assert.equal(out, expected);
  });
}

test('--app on an app screen: hash routes, the open sheet and its scrim, and 11px tab labels pass; 10px elsewhere is still flagged', { skip }, () => {
  const url = pathToFileURL(fixture('app-screen.html')).href + '#order';
  const { out } = run(url, '--check', '--no-shots', '--widths', '390,1440', '--height', '844', '--scheme', 'light', '--app');
  const first = out.split('\n')[0] ?? '';
  assert.match(first, /^App mode \(--app\): relaxed missing-anchor .*fixed-cover .*page-basics .*first-screen-no-action .*small-text .*focus-obscured/);
  assert.equal(out.split('\n').filter((l) => l.startsWith('App mode')).length, 1, 'the line is printed once');
  assert.deepEqual(lines(out, 'missing-anchor'), []);
  assert.deepEqual(lines(out, 'fixed-cover'), []);
  assert.deepEqual(lines(out, 'page-basics'), []);
  for (const id of ['timid-headline', 'first-screen-no-action', 'first-screen-nothing-large']) assert.deepEqual(lines(out, id), [], id);
  const small = lines(out, 'small-text');
  assert.equal(small.length, 2, 'the 10px label, once per width');
  for (const l of small) assert.match(l, /span\.meta "Ready in 5 min"  Text is 10px/);
});

test('--app keeps fixed-cover for a real bar and small text under 10px inside a tab bar', { skip }, () => {
  // The same page without its dialog: the scrim alone is a fixed layer over the screen, not a sheet's backdrop.
  const html = fs.readFileSync(fixture('app-screen.html'), 'utf8')
    .replace(/<div class="sheet"[\s\S]*?<\/div>\n/, '')
    .replace('.tabbar a {', '.tabbar a { font-size: 9px !important;');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-app-'));
  try {
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, html);
    const { out } = run(file, '--check', '--no-shots', '--widths', '390', '--app');
    assert.equal(lines(out, 'fixed-cover').length, 1);
    assert.equal(lines(out, 'small-text').filter((l) => /Text is 9px/.test(l) && /^\s+P2\s+a "/.test(l)).length, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--app scrolls a control into view before focus-obscured: a row passing under the tab bar is not reported, one stuck under it is', { skip }, () => {
  const before = fs.readFileSync(fixture('expected/app-list.txt'), 'utf8');
  // At 390x844 the old check (no scrolling) reports the row that happens to sit under the tab bar, and misses the last row.
  const at390 = before.split('Check at 1440px')[0] ?? '';
  assert.deepEqual(lines(at390, 'focus-obscured').map((l) => /a\.row "([^"]+)"/.exec(l)?.[1]), ['Affogato']);
  const { out } = run(fixture('app-list.html'), '--check', '--no-shots', '--widths', '390', '--app');
  const obscured = lines(out, 'focus-obscured');
  assert.equal(obscured.length, 1);
  assert.match(obscured[0] ?? '', /"Last row, always under the tab bar"  When focused, this control is hidden behind nav\.tabbar/);
});

test('--scheme sets prefers-color-scheme for the page', { skip }, () => {
  const ground = (scheme: string): string => {
    const { out } = run(fixture('web-page.html'), '--inventory', '--no-shots', '--widths', '390', '--scheme', scheme);
    return /page background\s+(.+)/.exec(out)?.[1]?.trim() ?? '';
  };
  assert.equal(ground('dark'), 'rgb(17, 17, 17)');
  assert.equal(ground('light'), 'rgb(250, 250, 250)');
});

test('--height sets the viewport height of the capture', { skip }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-height-'));
  try {
    const { code } = run(fixture('web-page.html'), '--widths', '390', '--height', '600', '--out', dir);
    assert.equal(code, 0);
    const png = fs.readFileSync(path.join(dir, 'shot-390.png'));
    assert.equal(png.readUInt32BE(16), 390);
    assert.equal(png.readUInt32BE(20), 600);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a bad --scheme or --height stops before any browser starts, with a clear message', () => {
  const { out, code } = run(fixture('web-page.html'), '--scheme', 'sepia');
  assert.equal(code, 1);
  assert.match(out, /--scheme takes light or dark \(got "sepia"\)\./);
  const h = run(fixture('web-page.html'), '--height', 'tall');
  assert.equal(h.code, 1);
  assert.match(h.out, /--height takes a whole number of CSS pixels from 200 to 4000 \(got "tall"\)\./);
});

// app-sheet.html: a drawn status bar and home indicator (aria-hidden), a floating translucent tab bar with
// 10px labels, a field whose focus ring is drawn on the row around its label, a long list of like cards,
// a 600px picture shown at 200px, and a sheet opened by a click over one scrim shared by the page.
const RELAXED_IN_APP = ['small-text', 'contrast-uncertain', 'target-size', 'fixed-cover', 'section-length', 'image-oversized', 'focus-removed'];

test('without --app, app-sheet.html shows every web-page finding that --app relaxes', { skip }, () => {
  const { out } = run(fixture('app-sheet.html'), '--check', '--no-shots', '--widths', '390', '--height', '844');
  assert.deepEqual(lines(out, 'small-text').map((l) => /^\s+P2\s+(\S+ "[^"]+")/.exec(l)?.[1]), ['span "9:41"', 'span "100%"', 'a "Cabins"', 'a "Trips"', 'a "Saved"']);
  assert.equal(lines(out, 'contrast-uncertain').length, 2);
  assert.match(lines(out, 'target-size')[0] ?? '', /span\.sig "Signal"/);
  assert.match(lines(out, 'fixed-cover')[0] ?? '', /div\.status "9:41 100%"  Fixed and sticky bars cover 27%/);
  assert.match(lines(out, 'section-length')[0] ?? '', /ul\.cards/);
  assert.match(lines(out, 'image-oversized')[0] ?? '', /600px wide but shown at 200px \(1x screen\)/);
  assert.match(lines(out, 'focus-removed')[0] ?? '', /^\s+P1\s+input\s/);
  assert.doesNotMatch(out, /Tapped/);
});

test('--app relaxes them: decorative aria-hidden parts, the floating tab bar, 10px tab labels, a list of cards, a 2x picture, a focus ring on the row', { skip }, () => {
  const { out } = run(fixture('app-sheet.html'), '--check', '--no-shots', '--widths', '390', '--height', '844', '--app');
  for (const id of RELAXED_IN_APP) assert.deepEqual(lines(out, id), [], id);
  assert.match(out.split('\n')[0] ?? '', /small-text \(11px allowed anywhere, 10px inside nav and tab bars\), pure-black-white .*section-length.*focus-removed.*image-oversized \(judged for a 2x phone screen\).*target-size \(the hit area includes ::before and ::after/);
});

test('--tap opens the sheet with a real pointer press, by text and by selector, before the check', { skip }, () => {
  const web = run(fixture('app-sheet.html'), '--check', '--no-shots', '--widths', '390', '--height', '844', '--tap', 'text=add to TRIP', '--tap', '#confirm');
  assert.match(web.out, /^Tapped at 390px: text=add to TRIP, #confirm$/m);
  // The click handler ran after a pointerdown: the tap arrived as a real press.
  assert.match(web.out, /p#pressed "Pressed with a pointer"/);
  // Without --app, the open sheet's scrim is a fixed layer over the whole screen.
  assert.match(lines(web.out, 'fixed-cover')[0] ?? '', /div#scrim  Fixed and sticky bars cover 100%/);
  // With --app, the shared scrim (not beside the sheet) is recognised as the sheet's backdrop.
  const app = run(fixture('app-sheet.html'), '--check', '--no-shots', '--widths', '390', '--height', '844', '--app', '--tap', 'text=Add', '--tap', 'text=confirm');
  assert.match(app.out, /p#pressed "Pressed with a pointer"/);
  assert.deepEqual(lines(app.out, 'fixed-cover'), []);
});

test('--tap with a target that is not there stops with an error that names it', { skip }, () => {
  const r = run(fixture('app-sheet.html'), '--check', '--no-shots', '--widths', '390', '--tap', 'text=Add to trip', '--tap', 'text=Cancel booking');
  assert.equal(r.code, 2);
  assert.match(r.out, /^Could not tap: nothing to tap for --tap "text=Cancel booking" at 390px: no visible button, link or tab has the text or label "Cancel booking" \(quotes, dashes and spaces already made plain\); nearest on the page: "[^\n]*\(after tapping "text=Add to trip"\)\.$/m);
  assert.doesNotMatch(r.out, /Check at/);
  const hidden = run(fixture('app-sheet.html'), '--no-shots', '--check', '--widths', '390', '--tap', '#confirm');
  assert.equal(hidden.code, 2);
  assert.match(hidden.out, /--tap "#confirm" at 390px: it matches only hidden elements/);
  const bad = run(fixture('app-sheet.html'), '--no-shots', '--check', '--widths', '390', '--tap', 'button[');
  assert.match(bad.out, /--tap "button\[" at 390px: not a valid CSS selector/);
});

test('--app still reports a long section that is not a list of like items, and a focus ring three levels up', { skip }, () => {
  const html = fs.readFileSync(fixture('app-sheet.html'), 'utf8')
    .replace(/<ul class="cards">[\s\S]*?<\/ul>/, '<section class="story"><h2>About</h2><p style="height:2400px">One long story.</p></section>')
    .replace('<div class="field"><label>', '<div class="field"><div><label>').replace('</label></div>', '</label></div></div>');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-app-'));
  try {
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, html);
    fs.copyFileSync(fixture('app-banner.png'), path.join(dir, 'app-banner.png'));
    const { out } = run(file, '--check', '--no-shots', '--widths', '390', '--height', '844', '--app');
    assert.match(lines(out, 'section-length')[0] ?? '', /section\.story/);
    assert.match(lines(out, 'focus-removed')[0] ?? '', /^\s+P1\s+input\s/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A phone screen in pure black on pure white, with 11px and 10px text outside any bar, and three 36px pills:
// one whose ::before extends it by 4px above and below, one whose ::before is a 44px square centred by a
// transform (found by probing), and one with nothing around it.
const HIT_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Hits</title>
<style>
  body { margin: 0; background: #fff; color: #000; font: 17px/1.3 system-ui, sans-serif; }
  main { padding: 60px 16px; }
  p { margin: 0 0 16px; }
  .eleven { font-size: 11px; } .ten { font-size: 10px; }
  button { display: block; position: relative; width: 140px; height: 36px; margin: 0 0 40px; border: 0; border-radius: 18px; background: #E5E5EA; color: #000; font: 15px system-ui, sans-serif; }
  .inset::before { content: ""; position: absolute; inset: -4px 0; }
  .centred::before { content: ""; position: absolute; top: 50%; left: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); }
</style></head><body><main><h1>Pills</h1>
<p>Ordinary body text, long enough to be the main text of the screen, in pure black on a pure white ground.</p>
<p><span class="eleven">Eleven pixel caption</span></p><p><span class="ten">Ten pixel caption</span></p>
<button class="inset">Inset layer</button><button class="centred">Centred layer</button><button class="bare">Bare pill</button>
</main></body></html>`;

test('--app: 11px text passes outside bars, pure black on white is not raised, and a 36px pill with a 44px ::before hit area passes', { skip }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hit-'));
  try {
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, HIT_PAGE);
    const pill = (out: string): string[] => lines(out, 'target-size').map((l) => /button\.(\w+)/.exec(l)?.[1] ?? l);
    const web = run(file, '--check', '--no-shots', '--widths', '390', '--height', '844').out;
    assert.deepEqual(lines(web, 'small-text').map((l) => /Text is (\d+)px/.exec(l)?.[1]), ['11', '10']);
    assert.equal(lines(web, 'pure-black-white').length, 1);
    assert.deepEqual(pill(web), ['inset', 'centred', 'bare']);
    const app = run(file, '--check', '--no-shots', '--widths', '390', '--height', '844', '--app').out;
    assert.deepEqual(lines(app, 'small-text').map((l) => /Text is (\d+)px/.exec(l)?.[1]), ['10']);
    assert.deepEqual(lines(app, 'pure-black-white'), []);
    assert.deepEqual(pill(app), ['bare']);
    assert.match(lines(app, 'target-size')[0] ?? '', /Target is 140x36px/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// A booking form: a labelled field, a field named only by its placeholder, a select, and a send button
// that writes what was submitted into a 9px line, so the small-text finding prints it back.
const FORM_PAGE = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Form</title>
<style>body { margin: 0; font: 17px/1.4 system-ui, sans-serif; } main { padding: 24px 16px; } .gap { height: 1400px; }
label, input, select, button { display: block; font-size: 16px; min-height: 44px; margin: 8px 0; } #done { font-size: 9px; }</style>
</head><body><main><h1>Book a service</h1><div class="gap"></div>
<form id="f"><label for="name">Your name</label><input id="name" name="name" value="old text">
<input id="phone" name="phone" placeholder="Phone number"><label for="day">Day</label>
<select id="day"><option value="">Choose</option><option value="sat">Saturday</option></select>
<button type="submit">Send booking</button></form><p id="done">Nothing sent</p></main>
<script>let changed = 0; document.getElementById('name').addEventListener('change', () => { changed++; });
document.getElementById('f').addEventListener('submit', (e) => { e.preventDefault(); const v = (id) => document.getElementById(id).value;
document.getElementById('done').textContent = 'Sent ' + v('name') + '|' + v('phone') + '|' + v('day') + '|' + changed; });</script></body></html>`;

test('--type fills fields by label, placeholder and selector, replacing what was there, then --tap submits, in order', { skip }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-type-'));
  try {
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, FORM_PAGE);
    const { out } = run(file, '--check', '--no-shots', '--widths', '390', '--type', 'text=your name=Ana Silva', '--type', 'text=Phone=0770 900', '--type', 'select#day=Saturday', '--tap', 'text=Send booking');
    assert.match(out, /^Tapped and typed at 390px: type "Ana Silva" into text=your name, type "0770 900" into text=Phone, type "Saturday" into select#day, tap text=Send booking$/m);
    assert.match(out, /p#done "Sent Ana Silva\|0770 900\|sat\|1"/);
    // Tapping first submits the form before it is filled: the order on the command line is the order run.
    const early = run(file, '--check', '--no-shots', '--widths', '390', '--tap', 'text=Send booking', '--type', 'text=your name=Ana');
    assert.match(early.out, /p#done "Sent old text\|\|\|0"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--type with a field that is not there stops with an error that names it', { skip }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-type-'));
  try {
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, FORM_PAGE);
    const r = run(file, '--check', '--no-shots', '--widths', '390', '--type', 'text=Name=Ana', '--type', 'text=Email=a@b.c');
    assert.equal(r.code, 2);
    assert.match(r.out, /^Could not type: nothing to type into for --type "text=Email" at 390px: no visible field has the label, placeholder or name "Email" \(quotes, dashes and spaces already made plain\); nearest on the page: "[^\n]*\(after typing into "text=Name"\)\.$/m);
    const opt = run(file, '--check', '--no-shots', '--widths', '390', '--type', '#day=Sunday');
    assert.match(opt.out, /the select has no option "Sunday"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const QUOTES_PAGE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Quotes</title>
<style>body { font: 16px/1.5 system-ui; margin: 2rem; } a { display: inline-block; padding: 12px; } a:hover { background: #ffd; } #hovered { font-size: 9px; }</style>
<main><h1>Plans</h1>
<a href="#talk" id="talk">Let\u2019s\u00a0talk \u201cnow\u201d</a> <a href="#price" id="price">See   pricing</a> <button type="button" id="later">Maybe later</button>
<p id="hovered">Not hovered</p></main>
<script>document.getElementById('talk').addEventListener('pointerenter', () => { document.getElementById('hovered').textContent = 'Hovered talk'; });</script>
</html>`;

test('--hover text= matches curly quotes and no-break spaces typed straight; a text not on the page fails, naming it and the nearest texts', { skip }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-quotes-'));
  try {
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, QUOTES_PAGE);
    const ok = run(file, '--check', '--no-shots', '--widths', '1440', '--hover', 'text=Let\'s talk "now"');
    assert.equal(ok.code === 0 || ok.code === 4, true, ok.out);
    assert.match(ok.out, /^Hovered at 1440px: text=Let's talk "now"$/m);
    assert.match(ok.out, /p#hovered "Hovered talk"/);
    const miss = run(file, '--no-shots', '--widths', '1440', '--out', path.join(dir, 'shots'), '--hover', 'text=Lets talk later');
    assert.equal(miss.code, 2);
    assert.match(miss.out, /^Could not hover: nothing to hover for --hover "text=Lets talk later" at 1440px: no visible button, link or tab has the text or label "Lets talk later" \(quotes, dashes and spaces already made plain\); nearest on the page: "Let's talk \\"now\\"", "Maybe later", "See pricing"\.$/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--tap text= prefers whole words and exact text over a contained letter, so text=M finds the size button, not the Menu link', { skip }, () => {
  const r = run(fixture('tap-exact.html'), '--check', '--no-shots', '--widths', '1440', '--tap', 'text=M');
  assert.match(r.out, /^Tapped at 1440px: text=M$/m);
  assert.match(r.out, /p#pressed "Pressed size M"/);
  const s = run(fixture('tap-exact.html'), '--check', '--no-shots', '--widths', '1440', '--tap', 'text=menu');
  assert.match(s.out, /p#pressed "Pressed menu-link"/);
});

test('contrast skips text under a blend mode, noting it as not measurable, and still reports plain faint text', { skip }, () => {
  const { out } = run(fixture('blend-headline.html'), '--check', '--no-shots', '--widths', '1440');
  assert.deepEqual(lines(out, 'contrast').filter((l) => l.includes('h1#flip')), []);
  assert.match(lines(out, 'contrast').join('\n'), /p#pale/);
  assert.match(out, /note: 1 text element uses a blend mode \(mix-blend-mode\), so contrast cannot be measured/);
});

test('--full shows a scroll-driven reveal finished, and writes the slices joined as one PNG', { skip }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-full-'));
  try {
    const file = path.join(dir, 'page.html');
    // A red block far below the fold that unclips on a view() timeline, as scroll-clip-reveal does.
    fs.writeFileSync(file, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reveal</title><link rel="icon" href="data:,">
<style>body{margin:0;background:#fff}.gap{height:2600px}.pic{height:400px;background:rgb(220,0,0)}
@supports (animation-timeline: view()) { @media (prefers-reduced-motion: no-preference) {
.pic{animation: wipe linear both; animation-timeline: view(); animation-range: entry 10% cover 45%;}
@keyframes wipe { from { clip-path: inset(100% 0 0 0); } to { clip-path: inset(0); } } } }</style></head>
<body><h1>Top</h1><div class="gap"></div><div class="pic" id="pic"></div><div class="gap"></div></body></html>`);
    const out = path.join(dir, 'shots');
    const r = run(file, '--full', '--widths', '800', '--out', out);
    const whole = path.join(out, 'shot-800-full.png');
    assert.ok(fs.existsSync(whole), r.out);
    assert.ok(fs.existsSync(path.join(out, 'shot-800-full-01.png')), r.out);
    const png = decodePng(fs.readFileSync(whole))!;
    assert.equal(png.width, 800);
    assert.ok(png.height >= 5600, String(png.height));
    // The middle of the red block (h1 plus 2600px down, then 200px into it) is red, not blank.
    let red = 0;
    for (let y = 2700; y < 2900; y += 20) {
      const i = (y * png.width + 400) * png.channels;
      if (png.data[i]! > 180 && png.data[i + 1]! < 60 && png.data[i + 2]! < 60) red++;
    }
    assert.ok(red >= 8, `the revealed block is drawn in the full capture (${red} of 10 samples red)`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
