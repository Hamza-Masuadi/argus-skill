import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { h1Screens, lint, main, USAGE } from '../scripts/lint';

const page = (head: string, body: string): string =>
  `<html lang="en"><head><meta name="viewport" content="width=device-width">${head}</head><body><h1>Title</h1>${body}</body></html>`;
const rules = (text: string, file = 'index.html'): string[] => lint([{ path: file, text }]).findings.map((f) => f.rule);

test('a clean page reports nothing', () => {
  assert.deepEqual(rules(page('', '<p>Hello there.</p>')), []);
});

test('removing the focus outline with no replacement is flagged', () => {
  assert.ok(rules(page('<style>a:focus{outline:none}</style>', '')).includes('focus-removed'));
});

test('removing the outline is fine when a visible replacement exists', () => {
  const css = '<style>a:focus{outline:none} a:focus-visible{outline:2px solid blue}</style>';
  assert.ok(!rules(page(css, '')).includes('focus-removed'));
});

test('a hover transition alone does not need a reduced-motion rule', () => {
  assert.ok(!rules(page('<style>a{transition:color .2s}</style>', '')).includes('reduced-motion'));
});

test('a keyframe animation with no reduced-motion rule is flagged', () => {
  const css = '<style>@keyframes spin{to{transform:rotate(1turn)}} .x{animation:spin 1s}</style>';
  assert.ok(rules(page(css, '')).includes('reduced-motion'));
});

test('a keyframe animation with a reduced-motion rule passes', () => {
  const css = '<style>@keyframes spin{to{transform:rotate(1turn)}} .x{animation:spin 1s} @media (prefers-reduced-motion: reduce){.x{animation:none}}</style>';
  assert.ok(!rules(page(css, '')).includes('reduced-motion'));
});

test('a field wrapped in its label is not flagged', () => {
  assert.ok(!rules(page('', '<label>Email <input placeholder="you@example.com"></label>')).includes('placeholder-label'));
});

test('a field with only a placeholder is flagged', () => {
  assert.ok(rules(page('', '<input placeholder="Email">')).includes('placeholder-label'));
});

test('a field named by a label elsewhere on the page is not flagged', () => {
  assert.ok(!rules(page('', '<label for="e">Email</label><input id="e" placeholder="you@example.com">')).includes('placeholder-label'));
});

test('a form that opens an email client is flagged', () => {
  assert.ok(rules(page('', '<form action="mailto:hi@example.com"></form>')).includes('form-mailto'));
});

test('text under 12px is flagged, in px and in rem', () => {
  assert.ok(rules(page('<style>.a{font-size:10px}</style>', '')).includes('small-text'));
  assert.ok(rules(page('<style>.a{font-size:.6rem}</style>', '')).includes('small-text'));
  assert.ok(!rules(page('<style>.a{font-size:14px}</style>', '')).includes('small-text'));
});

test('100vh is fine as a fallback before 100dvh', () => {
  assert.ok(!rules(page('<style>.a{min-height:100vh;min-height:100dvh}</style>', '')).includes('vh-units'));
  assert.ok(rules(page('<style>.a{min-height:100vh}</style>', '')).includes('vh-units'));
  assert.ok(!rules(page('<style>.a{height:100vh} @supports (height:100svh){.a{height:100svh}}</style>', '')).includes('vh-units'));
});

test('blocking zoom is flagged, allowing some zoom is not', () => {
  const blocked = '<html lang="en"><head><meta name="viewport" content="width=device-width, maximum-scale=1"></head><body><h1>x</h1></body></html>';
  const allowed = blocked.replace('maximum-scale=1', 'maximum-scale=2');
  assert.ok(rules(blocked).includes('zoom-blocked'));
  assert.ok(!rules(allowed).includes('zoom-blocked'));
  // Zoom has to reach 200%, so a cap of 1.5 still blocks it.
  assert.ok(rules(blocked.replace('maximum-scale=1', 'maximum-scale=1.5')).includes('zoom-blocked'));
  assert.ok(rules(blocked.replace('maximum-scale=1', 'user-scalable=no')).includes('zoom-blocked'));
});

test('a missing viewport tag and a missing lang are flagged', () => {
  const found = rules('<html><head></head><body><h1>x</h1></body></html>');
  assert.ok(found.includes('viewport-meta'));
  assert.ok(found.includes('lang'));
});

test('an image without alt is flagged in HTML but not guessed at in components', () => {
  assert.ok(rules(page('', '<img src="a.png">')).includes('img-alt'));
  assert.ok(!rules('<img src={a} onLoad={() => go()} alt="x" />', 'Card.tsx').includes('img-alt'));
});

test('findings are ordered most serious first', () => {
  const css = '<style>.a{font-size:10px} a:focus{outline:none}</style>';
  const sevs = lint([{ path: 'index.html', text: page(css, '') }]).findings.map((f) => f.sev);
  assert.deepEqual(sevs, [...sevs].sort((a, b) => ['P1', 'P2', 'tell'].indexOf(a) - ['P1', 'P2', 'tell'].indexOf(b)));
});

test('many colours written out by hand are flagged, tokens are not', () => {
  const hexes = Array.from({ length: 14 }, (_, i) => `.c${i}{color:#${(0x101010 + i * 0x0f0f0f).toString(16).padStart(6, '0')}}`).join('');
  assert.ok(rules(page(`<style>${hexes}</style>`, '')).includes('raw-colours'));
  const tokens = ':root{\n' + Array.from({ length: 14 }, (_, i) => `  --c${i}: #${(0x101010 + i * 0x0f0f0f).toString(16).padStart(6, '0')};`).join('\n') + '\n}';
  assert.ok(!rules(page(`<style>${tokens}</style>`, '')).includes('raw-colours'));
});

test('all-caps text without letter-spacing is flagged', () => {
  assert.ok(rules(page('<style>.k{text-transform:uppercase}</style>', '')).includes('caps-tracking'));
  assert.ok(!rules(page('<style>.k{text-transform:uppercase;letter-spacing:.08em}</style>', '')).includes('caps-tracking'));
  assert.ok(!rules(page('<style>.k{letter-spacing:.08em;text-transform:uppercase}</style>', '')).includes('caps-tracking'));
});

test('an outline removed in a rule that draws a replacement is not flagged', () => {
  assert.ok(!rules(page('<style>a:focus{outline:none;box-shadow:0 0 0 3px #1a5}</style>', '')).includes('focus-removed'));
  assert.ok(rules(page('<style>button{outline:0}</style>', '')).includes('focus-removed'));
});

test('transition: all is flagged, named properties are not', () => {
  assert.ok(rules(page('<style>a{transition:all .2s}</style>', '')).includes('transition-all'));
  assert.ok(!rules(page('<style>a{transition:color .2s}</style>', '')).includes('transition-all'));
});

test('an image with no width and height is flagged in HTML, not when sized', () => {
  assert.ok(rules(page('', '<img src="a.png" alt="A harbour at dusk">')).includes('image-no-size'));
  assert.ok(!rules(page('', '<img src="a.png" alt="A harbour at dusk" width="800" height="600">')).includes('image-no-size'));
  assert.ok(!rules('<img src={a} alt="x" className="w-12 h-12" />', 'Card.tsx').includes('image-no-size'));
});

test('a clickable div or span with no role is flagged', () => {
  assert.ok(rules('<div className="card" onClick={open}>Open</div>', 'Card.tsx').includes('clickable-div'));
  assert.ok(rules(page('', '<span onclick="go()">Go</span>')).includes('clickable-div'));
  assert.ok(!rules('<div role="button" tabIndex={0} onClick={open}>Open</div>', 'Card.tsx').includes('clickable-div'));
  assert.ok(!rules('<button onClick={open}>Open</button>', 'Card.tsx').includes('clickable-div'));
});

test('blocking paste is flagged, reading a paste is not', () => {
  assert.ok(rules('<input onPaste={(e) => e.preventDefault()} />', 'Login.tsx').includes('paste-blocked'));
  assert.ok(rules(page('', '<input onpaste="return false">')).includes('paste-blocked'));
  assert.ok(!rules('<input onPaste={(e) => track(e)} />', 'Login.tsx').includes('paste-blocked'));
});

test('@font-face without font-display is flagged', () => {
  assert.ok(rules('@font-face{font-family:X;src:url(x.woff2)}', 'fonts.css').includes('font-display-missing'));
  assert.ok(!rules('@font-face{font-family:X;src:url(x.woff2);font-display:swap}', 'fonts.css').includes('font-display-missing'));
});

test('a positive tabindex is flagged, 0 and -1 are not', () => {
  assert.ok(rules(page('', '<div tabindex="3">x</div>')).includes('tabindex-positive'));
  assert.ok(rules('<div tabIndex={2}>x</div>', 'A.tsx').includes('tabindex-positive'));
  assert.ok(!rules(page('', '<div tabindex="0">x</div><div tabindex="-1">y</div>')).includes('tabindex-positive'));
});

test('viewport-fit=cover needs safe-area insets somewhere in the files', () => {
  const html = '<html lang="en"><head><meta name="viewport" content="width=device-width, viewport-fit=cover"></head><body><h1>x</h1></body></html>';
  assert.ok(rules(html).includes('safe-area-missing'));
  const withCss = lint([
    { path: 'index.html', text: html },
    { path: 'app.css', text: 'body{padding-bottom:env(safe-area-inset-bottom)}' },
  ]).findings.map((f) => f.rule);
  assert.ok(!withCss.includes('safe-area-missing'));
});

test('TODO and placeholder text in visible content are flagged, code comments are not', () => {
  assert.ok(rules(page('', '<p>TODO: write this section</p>')).includes('placeholder-text'));
  assert.ok(rules(page('', '<p>Placeholder text for the hero.</p>')).includes('placeholder-text'));
  assert.ok(rules('export const A = () => <p>TODO</p>;', 'A.tsx').includes('placeholder-text'));
  assert.ok(!rules(page('<!-- TODO: tidy -->', '<p>Ready.</p>')).includes('placeholder-text'));
  assert.ok(!rules('// TODO: refactor\nexport const A = () => <p>Ready</p>;', 'A.tsx').includes('placeholder-text'));
  assert.ok(!rules('/* TODO */ a{color:red}', 'a.css').includes('placeholder-text'));
});

test('a control inside a heading is flagged unless it has its own accessible name', () => {
  assert.ok(rules(page('', '<h2>Pick <select><option>Rye</option></select></h2>')).includes('control-in-heading'));
  assert.ok(!rules(page('', '<h2>Bake me <select aria-label="Choose a loaf"><option>Rye</option></select> by seven</h2>')).includes('control-in-heading'));
});

test('--help prints usage and succeeds instead of looking for a file called --help', () => {
  const log = console.log;
  const lines: string[] = [];
  console.log = (...a: unknown[]) => { lines.push(a.join(' ')); };
  try {
    assert.equal(main(['--help']), 0);
  } finally {
    console.log = log;
  }
  assert.ok(lines.some((l) => l.startsWith('Usage:')));
  assert.ok(!lines.some((l) => l.startsWith('Not found')));
});

const shell = (body: string): string => `<html lang="en"><head><meta name="viewport" content="width=device-width"></head><body>${body}</body></html>`;
const appRules = (text: string): string[] => lint([{ path: 'index.html', text }], { app: true }).findings.map((f) => f.rule);

test('--app: several h1s pass when each is in its own hash-routed screen; without --app they are still flagged', () => {
  const screens = shell(
    '<main class="screen" id="s-kitty"><h1>Kitty</h1></main>' +
      '<main class="screen pushed" id="s-bills" hidden><div class="head"><h1>Bills</h1></div></main>' +
      '<section data-screen="added" hidden><h1>Added</h1><img src="a.png" alt="x" width="1" height="1"></section>' +
      '<section id="view-statement"><h1>Statement</h1></section>',
  );
  assert.ok(rules(screens).includes('h1-count'));
  assert.ok(!appRules(screens).includes('h1-count'));
  assert.deepEqual(h1Screens(screens), { count: 4, separate: true });
  // Hidden sections count as screens too, and so do tab panels and templates.
  assert.ok(!appRules(shell('<section hidden><h1>A</h1></section><section hidden><h1>B</h1></section>')).includes('h1-count'));
  assert.ok(!appRules(shell('<div role="tabpanel"><h1>A</h1></div><template><h1>B</h1></template>')).includes('h1-count'));
});

test('--app still flags two h1s in one screen, or an h1 outside any screen', () => {
  assert.ok(appRules(shell('<main class="screen"><h1>A</h1><h1>B</h1></main>')).includes('h1-count'));
  assert.ok(appRules(shell('<h1>Brand</h1><main class="screen"><h1>A</h1></main>')).includes('h1-count'));
  assert.ok(appRules(shell('<div class="wrap"><h1>A</h1></div><div class="wrap"><h1>B</h1></div>')).includes('h1-count'));
  // aria-hidden is not the hidden attribute.
  assert.ok(appRules(shell('<div aria-hidden="true"><h1>A</h1></div><div aria-hidden="true"><h1>B</h1></div>')).includes('h1-count'));
  // A page with headings but no h1 is still reported.
  assert.ok(appRules(shell('<main class="screen"><h2>A</h2></main>')).includes('h1-count'));
});

test('--app: h1s written in a script are screens drawn one at a time', () => {
  const page = shell('<div id="view"></div><script>const a = `<h1>${name}</h1>`; const b = "<h1>Basket</h1>";</script>');
  assert.ok(rules(page).includes('h1-count'));
  assert.ok(!appRules(page).includes('h1-count'));
  assert.ok(appRules(shell('<h1>One</h1><h1>Two</h1><script>x = "<h1>Three</h1>"</script>')).includes('h1-count'));
});

test('lint.js --app is read as the flag, not as a file, and --help documents it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-lint-'));
  const logs: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => void logs.push(a.join(' '));
  try {
    const file = path.join(dir, 'index.html');
    fs.writeFileSync(file, shell('<main class="screen"><h1>A</h1></main><main class="screen" hidden><h1>B</h1></main>'));
    assert.equal(main([file, '--app']), 0);
    assert.ok(!logs.some((l) => /Not found|h1-count/.test(l)), logs.join('\n'));
    logs.length = 0;
    main([file]);
    assert.ok(logs.some((l) => /\[h1-count\]/.test(l)));
  } finally {
    console.log = log;
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.match(USAGE, /\[--app\]/);
  assert.match(USAGE, /--app\s+the files are an app prototype/);
});

test('--app: 11px text is the platform minimum and passes; 10px is still flagged, and without --app 11px is flagged', () => {
  const eleven = shell('<style>.a{font-size:11px}</style><main class="screen"><h1>A</h1></main>');
  assert.ok(!appRules(eleven).includes('small-text'));
  assert.ok(rules(eleven).includes('small-text'));
  assert.ok(appRules(shell('<style>.a{font-size:10px}</style><main class="screen"><h1>A</h1></main>')).includes('small-text'));
});

test('tight-tracking allows -0.05em on display type at 96px and above, and nothing tighter than -0.04em below it', () => {
  const css = (rule: string): string => '<style>' + rule + '</style>';
  const tight = (rule: string): boolean => rules(css(rule), 'a.html').includes('tight-tracking');
  assert.equal(tight('h1{font-size:120px;letter-spacing:-0.05em}'), false);
  assert.equal(tight('h1{font-size:clamp(48px,7.6vw,128px);letter-spacing:-.045em}'), false);
  assert.equal(tight('h1{font:800 110px/.9 Archivo,sans-serif;letter-spacing:-0.05em}'), false);
  assert.equal(tight('h1{font-size:120px;letter-spacing:-0.06em}'), true);
  assert.equal(tight('h2{font-size:64px;letter-spacing:-0.05em}'), true);
  assert.equal(tight('h2{font-size:64px;letter-spacing:-0.04em}'), false);
  assert.equal(tight('p{letter-spacing:-0.1em}'), true);
});

test('an autoplaying video: muted, playsinline, a poster and a pause control are asked for; a finished one passes', () => {
  const bad = lint([{ path: 'index.html', text: page('', '<video autoplay loop src="sea.mp4"></video>') }]).findings.filter((f) => f.rule === 'hero-video');
  assert.deepEqual(bad.map((f) => f.sev).sort(), ['P1', 'P2', 'P2']);
  assert.ok(bad.some((f) => /has no playsinline and no poster/.test(f.msg)));
  const good = page('', '<video autoplay muted loop playsinline poster="sea.jpg" aria-hidden="true"><source src="sea.mp4" type="video/mp4"></video><button type="button" class="video-toggle">Pause</button>');
  assert.ok(!rules(good).includes('hero-video'));
  // JSX spelling, and a video that does not play by itself, are fine.
  assert.ok(!rules('<video autoPlay muted loop playsInline poster="/p.jpg" /><button aria-label="Pause the film">||</button>', 'Hero.tsx').includes('hero-video'));
  assert.ok(!rules(page('', '<video controls src="talk.mp4"></video>')).includes('hero-video'));
});

test('a local video file over 4 MB is flagged as heavy; a small one and a remote one are not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-lint-video-'));
  try {
    fs.writeFileSync(path.join(dir, 'big.mp4'), Buffer.alloc(4 * 1024 * 1024 + 10));
    fs.writeFileSync(path.join(dir, 'small.webm'), Buffer.alloc(1000));
    const text = page('', '<video muted playsinline poster="p.jpg"><source src="big.mp4" type="video/mp4"><source src="small.webm"><source src="https://cdn.example.com/x.mp4"></video>');
    const heavy = lint([{ path: path.join(dir, 'index.html'), text }]).findings.filter((f) => f.rule === 'video-heavy');
    assert.equal(heavy.length, 1);
    assert.match(heavy[0]!.msg, /big\.mp4 is 4\.0 MB/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
