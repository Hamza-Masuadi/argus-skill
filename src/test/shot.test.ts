import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { checkOptionsExpression, holdVideosExpression, emulatedFeatures, scrollToExpression, decodePng, encodePng, stitchPngs, finishViewRevealsExpression, restoreViewRevealsExpression } from '../scripts/shot';
import * as zlib from 'node:zlib';
import { APP_MODE_EXPRESSION, MINOR_MUTATION, normaliseText, WAITABLE_ANIMATION, snapshotModeExpression, viewPositions, appModeLine, pageSlug, parseArgs, parseHeight, parseTypeStep, parseWait, scrollThroughExpression, settleExpression, stableExpression, stepsLine, tapTargetExpression, typeTargetExpression, timerTrackerSource, toUrl, USAGE, viewportHeight } from '../scripts/shot';

test('a bare localhost address becomes a URL', () => {
  assert.equal(toUrl('localhost:3000'), 'http://localhost:3000');
  assert.equal(toUrl('127.0.0.1:8080/page'), 'http://127.0.0.1:8080/page');
});

test('a full URL is left alone', () => {
  assert.equal(toUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
});

test('an existing file becomes a file URL', () => {
  const url = toUrl(__filename);
  assert.ok(url && url.startsWith('file:///'));
  assert.ok(url.endsWith(path.basename(__filename)));
});

test('a missing file is reported, not guessed', () => {
  assert.equal(toUrl('definitely-not-here-12345.html'), null);
});

test('the default widths are two phones, a laptop and a desktop monitor, plus a tablet, an awkward width and a small laptop as first screens', () => {
  assert.deepEqual(parseArgs(['page.html']).widths, [320, 390, 1440, 1920]);
  assert.deepEqual(parseArgs(['page.html']).between, [768, 820, 1024]);
  assert.deepEqual(parseArgs(['page.html', '--widths', '390,1440']).widths, [390, 1440]);
  assert.deepEqual(parseArgs(['page.html', '--widths', '390,1440']).between, []);
  assert.deepEqual(parseArgs(['page.html', '--widths', '390,1440', '--between']).between, [768, 820, 1024]);
  assert.deepEqual(parseArgs(['page.html', '--between', '--widths', '390,1024']).between, [768, 820]);
  assert.match(USAGE, /--between\s+also capture 768, 820 and 1024/);
});

test('without --out, captures go to a folder named for the page, so pages never overwrite each other', () => {
  assert.equal(pageSlug('roughs/a.html'), 'roughs-a');
  assert.equal(pageSlug('.argus/roughs/b.html'), 'roughs-b');
  assert.equal(pageSlug('index.html'), 'index');
  assert.equal(pageSlug('http://localhost:5173/pricing'), 'pricing');
  assert.equal(pageSlug('http://localhost:5173/'), 'index');
  assert.equal(pageSlug('http://localhost:8080/work/flux.html'), 'work-flux');
  assert.equal(parseArgs(['roughs/a.html']).out, path.join('shots', 'roughs-a'));
  assert.equal(parseArgs(['roughs/a.html', '--out', 'pics']).out, 'pics');
  assert.equal(parseArgs(['roughs/a.html', '--out', 'pics']).outGiven, true);
});

test('the settle step is one valid expression with a capped wait', () => {
  const expr = settleExpression(2000);
  assert.doesNotThrow(() => new Function('return ' + expr));
  assert.match(expr, /setTimeout\(r, 2000\)/);
  assert.match(expr, /endTime !== Infinity/);
});

test('--help and -h ask for help and are never taken as the page to capture', () => {
  for (const flag of ['--help', '-h']) {
    const o = parseArgs([flag]);
    assert.equal(o.help, true);
    assert.equal(o.target, null);
  }
  const o = parseArgs(['page.html', '--full', '--help']);
  assert.equal(o.help, true);
  assert.equal(o.target, 'page.html');
  assert.equal(parseArgs(['page.html']).help, false);
});

test('the scroll-through before a full capture is one valid expression that scrolls, waits and returns to the top', () => {
  const expr = scrollThroughExpression(250, 20000);
  assert.doesNotThrow(() => new Function('return ' + expr));
  assert.match(expr, /innerHeight/);
  assert.match(expr, /sleep\(250\)/);
  assert.match(expr, /20000/);
  assert.match(expr, /document\.images/);
  assert.match(expr, /getAnimations/);
  assert.match(expr, /go\(0\);\s*await frame\(\);\s*await sleep\(250\)/);
});

test('the scroll-through does not depend on animation frames alone, which stall in a hidden tab', () => {
  assert.match(scrollThroughExpression(), /Promise\.race\(\[new Promise\(\(r\) => requestAnimationFrame/);
});

test('--wait takes milliseconds, defaults to 0, and is never taken as the page to capture', () => {
  assert.equal(parseArgs(['page.html']).wait, 0);
  const o = parseArgs(['--wait', '1500', 'page.html', '--full']);
  assert.equal(o.wait, 1500);
  assert.equal(o.target, 'page.html');
  assert.equal(o.full, true);
  assert.equal(parseArgs(['page.html', '--wait', '0']).wait, 0);
});

test('a --wait value that is not a whole number of milliseconds is 0, and a huge one is capped', () => {
  assert.equal(parseWait(undefined), 0);
  assert.equal(parseWait('abc'), 0);
  assert.equal(parseWait('-200'), 0);
  assert.equal(parseWait('1.5'), 0);
  assert.equal(parseWait(' 800 '), 800);
  assert.equal(parseWait('9999999'), 60000);
  // A missing value after --wait leaves the target alone.
  const o = parseArgs(['page.html', '--wait']);
  assert.equal(o.wait, 0);
  assert.equal(o.target, 'page.html');
  // A flag after --wait is still a flag, not its value.
  const f = parseArgs(['--wait', '--full', 'page.html']);
  assert.equal(f.wait, 0);
  assert.equal(f.full, true);
  assert.equal(f.target, 'page.html');
});

test('the stability wait is one valid expression that watches the DOM and animations, with a floor and a cap', () => {
  const expr = stableExpression(500, 900, 6000);
  assert.doesNotThrow(() => new Function('return ' + expr));
  assert.match(expr, /MutationObserver/);
  assert.match(expr, /subtree: true, childList: true, attributes: true, characterData: true/);
  assert.match(expr, /endTime !== Infinity/);
  assert.match(expr, />= 900 && now - last >= 500/);
  assert.match(expr, />= 6000\)/);
  assert.match(expr, /setTimeout\(tick, 100\)/);
  assert.match(expr, /__argusTimers/);
  // The defaults are half a second of quiet, at most six seconds.
  assert.equal(stableExpression(), expr);
});

test('the timer tracker counts only short one-off timers and keeps setTimeout working', () => {
  const src = timerTrackerSource(6000);
  assert.doesNotThrow(() => new Function(src));
  assert.match(src, /> 6000\) return set\.call/);
  assert.equal(timerTrackerSource(), src);
  // Run it against a stand-in window and check it counts, clears and fires as setTimeout would.
  const fired: number[] = [];
  const queue = new Map<number, () => void>();
  let next = 1;
  const win: Record<string, unknown> = {
    setTimeout: (fn: () => void) => { const id = next++; queue.set(id, fn); return id; },
    clearTimeout: (id: number) => { queue.delete(id); },
  };
  new Function('window', src)(win);
  const pending = win['__argusTimers'] as Set<number>;
  const st = win['setTimeout'] as (fn: () => void, ms?: number) => number;
  const a = st(() => fired.push(1), 100);
  const b = st(() => fired.push(2), 200);
  st(() => fired.push(3), 60000); // too far ahead to count
  assert.equal(pending.size, 2);
  (win['clearTimeout'] as (id: number) => void)(b);
  assert.equal(pending.size, 1);
  queue.get(a)?.();
  assert.equal(pending.size, 0);
  assert.deepEqual(fired, [1]);
});

test('--help documents --wait', () => {
  assert.match(USAGE, /--wait MS/);
  assert.match(USAGE, /stopped changing/);
});

test('without the new flags, the options are as before: no height, no scheme, no app mode, no errors', () => {
  const o = parseArgs(['page.html', '--check', '--no-shots', '--widths', '390,1440']);
  assert.equal(o.height, null);
  assert.equal(o.scheme, null);
  assert.equal(o.app, false);
  assert.deepEqual(o.errors, []);
});

test('without --height, the viewport height per width is the one used before', () => {
  const old = (width: number): number => (width <= 340 ? 700 : width < 600 ? 844 : width >= 1900 ? 1080 : 900);
  for (const w of [200, 320, 340, 341, 390, 599, 600, 1024, 1440, 1899, 1900, 1920, 4000]) assert.equal(viewportHeight(w), old(w), String(w));
  assert.equal(viewportHeight(1440, null), 900);
});

test('--height sets the viewport height at every width, and a bad value is an error, never the target', () => {
  const o = parseArgs(['page.html', '--height', '844', '--widths', '390,1440']);
  assert.equal(o.height, 844);
  assert.equal(o.target, 'page.html');
  assert.deepEqual(o.errors, []);
  assert.equal(viewportHeight(390, o.height), 844);
  assert.equal(viewportHeight(1920, o.height), 844);
  for (const bad of ['abc', '50', '5000', '844.5', '-844']) {
    const b = parseArgs(['page.html', '--height', bad]);
    assert.equal(b.height, null, bad);
    assert.equal(b.target, 'page.html', bad);
    assert.equal(b.errors.length, 1, bad);
    assert.match(b.errors[0] ?? '', /--height takes a whole number of CSS pixels from 200 to 4000/);
  }
  assert.equal(parseArgs(['page.html', '--height']).errors.length, 1);
  assert.equal(parseHeight('200'), 200);
  assert.equal(parseHeight('4000'), 4000);
  assert.equal(parseHeight(' 700 '), 700);
  assert.equal(parseHeight('199'), null);
});

test('--scheme takes light or dark and rejects anything else with a clear message', () => {
  assert.equal(parseArgs(['page.html', '--scheme', 'light']).scheme, 'light');
  assert.equal(parseArgs(['page.html', '--scheme', 'DARK']).scheme, 'dark');
  for (const bad of ['blue', 'auto', '']) {
    const o = parseArgs(['page.html', '--scheme', bad]);
    assert.equal(o.scheme, null, bad);
    assert.equal(o.target, 'page.html');
    assert.match(o.errors[0] ?? '', /--scheme takes light or dark/);
  }
  assert.match(parseArgs(['page.html', '--scheme']).errors[0] ?? '', /--scheme takes light or dark\.$/);
});

test('--app turns on app mode for the checker, and the line printed in app mode names what was relaxed', () => {
  const o = parseArgs(['page.html#order', '--check', '--app']);
  assert.equal(o.app, true);
  assert.equal(o.check, true);
  assert.equal(o.target, 'page.html#order');
  assert.doesNotThrow(() => new Function('window', APP_MODE_EXPRESSION));
  const win: Record<string, unknown> = {};
  new Function('window', APP_MODE_EXPRESSION)(win);
  assert.deepEqual(win['__argusCheckOptions'], { app: true });
  assert.match(appModeLine('missing-anchor (x)'), /^App mode \(--app\): relaxed missing-anchor \(x\)\.$/);
  assert.equal(appModeLine('a').split('\n').length, 1);
});

test('--help documents --height, --scheme and --app', () => {
  assert.match(USAGE, /--height N/);
  assert.match(USAGE, /--scheme S\s+light or dark/);
  assert.match(USAGE, /--app\s+with --check: the page is an app prototype/);
});

test('--tap is repeatable, keeps its order, and a missing value is an error that leaves the next flag alone', () => {
  const o = parseArgs(['page.html#menu', '--tap', 'text=Add to order', '--check', '--tap', '#pay']);
  assert.deepEqual(o.taps, ['text=Add to order', '#pay']);
  assert.equal(o.check, true);
  assert.equal(o.target, 'page.html#menu');
  assert.deepEqual(o.errors, []);
  assert.deepEqual(parseArgs(['page.html']).taps, []);
  const missing = parseArgs(['page.html', '--tap']);
  assert.match(missing.errors[0] ?? '', /^--tap takes a CSS selector or text=Label\.$/);
  const flag = parseArgs(['page.html', '--tap', '--check']);
  assert.match(flag.errors[0] ?? '', /--tap takes a CSS selector or text=Label \(got "--check"\)/);
  assert.equal(flag.check, true);
  assert.equal(parseArgs(['page.html', '--tap', '  ']).errors.length, 1);
});

test('the tap finder is one valid expression for a selector and for text=, with the label quoted safely', () => {
  for (const t of ['#pay', 'button.primary', 'text=Add to order', 'text=Say "hi" \\ there', 'text=']) {
    const expr = tapTargetExpression(t);
    assert.doesNotThrow(() => new Function('return ' + expr), t);
  }
  assert.match(tapTargetExpression('text=Add  to   order'), /const want = "Add to order"/);
  assert.match(tapTargetExpression('#pay'), /const want = null/);
  assert.match(tapTargetExpression('#pay'), /const selector = "#pay"/);
  assert.match(tapTargetExpression('text=x'), /\[role="tab"\]/);
});

test('text= matching normalises both sides: curly quotes, no-break spaces, dashes, invisible characters and whitespace runs', () => {
  assert.equal(normaliseText('Let\u2019s\u00a0talk'), "Let's talk");
  assert.equal(normaliseText('\u2018a\u2019 \u201cb\u201d \u201ec\u201f'), `'a' "b" "c"`);
  assert.equal(normaliseText('  Sign\u2003in \n\t now  '), 'Sign in now');
  assert.equal(normaliseText('2020\u20132024 \u2014 now'), '2020-2024 - now');
  assert.equal(normaliseText('Co\u00adop\u200b\ufeff'), 'Coop');
  assert.equal(normaliseText('\ufb01nd \uff21\u2026'), 'find A...');
  assert.equal(normaliseText(null), '');
  assert.equal(normaliseText('Keep Case'), 'Keep Case');
  // The label typed straight is what the page compares, and the page normalises its own text with the same function.
  assert.match(tapTargetExpression('text=Let\u2019s  go'), /const want = "Let's go"/);
  assert.match(typeTargetExpression('text=Your\u00a0name', 'Ana'), /const want = "Your name"/);
  for (const expr of [tapTargetExpression('text=a'), typeTargetExpression('text=a', 'b')]) {
    assert.match(expr, /const normaliseText = function normaliseText\(s\)/);
    assert.match(expr, /nearest on the page: /);
    assert.doesNotThrow(() => new Function('return ' + expr));
  }
  // The in-page copy behaves as the Node one.
  const inPage = new Function('return ' + normaliseText.toString())() as (s: unknown) => string;
  assert.equal(inPage('It\u2019s\u00a0\u201cfine\u201d'), normaliseText('It\u2019s\u00a0\u201cfine\u201d'));
});

test('the scroll-through does not wait for lazy images the browser has not started loading', () => {
  assert.match(scrollThroughExpression(), /!i\.complete && !\(i\.loading === 'lazy' && !i\.currentSrc\)/);
});

test('--help documents --tap and what --app relaxes', () => {
  assert.match(USAGE, /\[--tap TARGET\]\.\.\./);
  assert.match(USAGE, /--tap TARGET\s+after the page settles, tap TARGET/);
  assert.match(USAGE, /text=Label/);
  assert.match(USAGE, /allows 11px text anywhere and 10px in nav/);
  assert.match(USAGE, /::before and ::after layers in a control's hit area/);
  assert.match(USAGE, /decorative aria-hidden/);
});

test('--type splits TARGET=TEXT at the right "=", for text=Label and for selectors with brackets', () => {
  assert.deepEqual(parseTypeStep('text=Email=ana@example.com'), { kind: 'type', target: 'text=Email', text: 'ana@example.com' });
  assert.deepEqual(parseTypeStep('#email=a=b'), { kind: 'type', target: '#email', text: 'a=b' });
  assert.deepEqual(parseTypeStep('input[name=email]=ana@example.com'), { kind: 'type', target: 'input[name=email]', text: 'ana@example.com' });
  assert.deepEqual(parseTypeStep('input[name="a=b"]=x'), { kind: 'type', target: 'input[name="a=b"]', text: 'x' });
  assert.deepEqual(parseTypeStep('#note='), { kind: 'type', target: '#note', text: '' });
  for (const bad of ['no-equals', '=text', 'text==x', 'text=Email']) assert.equal(parseTypeStep(bad), null, bad);
});

test('--tap and --type run together in command-line order; a bad --type is an error that leaves the next flag alone', () => {
  const o = parseArgs(['page.html', '--tap', 'text=Book', '--type', 'text=Name=Ana', '--type', '#when=Saturday', '--tap', 'text=Send']);
  assert.deepEqual(o.steps, [
    { kind: 'tap', target: 'text=Book' },
    { kind: 'type', target: 'text=Name', text: 'Ana' },
    { kind: 'type', target: '#when', text: 'Saturday' },
    { kind: 'tap', target: 'text=Send' },
  ]);
  assert.deepEqual(o.taps, ['text=Book', 'text=Send']);
  assert.deepEqual(o.errors, []);
  const flag = parseArgs(['page.html', '--type', '--check']);
  assert.match(flag.errors[0] ?? '', /^--type takes a field and its text as TARGET=TEXT.*\(got "--check"\)\.$/);
  assert.equal(flag.check, true);
  assert.equal(parseArgs(['page.html', '--type', 'email']).errors.length, 1);
  assert.equal(stepsLine(390, o.steps), 'Tapped and typed at 390px: tap text=Book, type "Ana" into text=Name, type "Saturday" into #when, tap text=Send');
  assert.equal(stepsLine(390, o.steps.filter((s) => s.kind === 'tap')), 'Tapped at 390px: text=Book, text=Send');
});

test('the field finder is one valid expression, with the label and the text quoted safely', () => {
  for (const [t, x] of [['#email', 'a@b.c'], ['text=Your "name"', 'Ana \\ "Bo"'], ['text=', ''], ['select#when', 'Saturday']]) {
    assert.doesNotThrow(() => new Function('return ' + typeTargetExpression(t ?? '', x ?? '')), t);
  }
  assert.match(typeTargetExpression('text=Your  name', 'Ana'), /const want = "Your name"/);
  assert.match(typeTargetExpression('#email', 'a'), /const selector = "#email"/);
  assert.match(typeTargetExpression('#email', 'a'), /scrollIntoView/);
  // --type, like --tap and --hover, gives a field revealed on scroll up to 2s to show.
  assert.match(typeTargetExpression('#email', 'a'), /^\(async \(\) =>/);
  assert.match(typeTargetExpression('#email', 'a'), /it is still hidden 2s after being scrolled into view/);
  assert.match(typeTargetExpression('#email', 'a', 500), /Date\.now\(\) - started < 500\)/);
});

test('--help documents --type and that targets are scrolled into view', () => {
  assert.match(USAGE, /\[--type TARGET=TEXT\]\.\.\./);
  assert.match(USAGE, /--type T=TEXT\s+after the page settles, type TEXT into the field T/);
  assert.match(USAGE, /--tap and --type run in the order given/);
  assert.match(USAGE, /scrolled into view first/);
});

test('--hover, --reduced-motion, --frames, --every and --scroll-frames are read, in order with --tap and --type', () => {
  const o = parseArgs(['page.html', '--hover', 'text=Menu', '--tap', '#open', '--type', '#q=bikes', '--hover', '.card', '--reduced-motion', '--frames', '8', '--every', '200', '--scroll-frames', '6']);
  assert.deepEqual(o.steps, [
    { kind: 'hover', target: 'text=Menu' },
    { kind: 'tap', target: '#open' },
    { kind: 'type', target: '#q', text: 'bikes' },
    { kind: 'hover', target: '.card' },
  ]);
  assert.deepEqual(o.taps, ['#open']);
  assert.equal(o.reducedMotion, true);
  assert.equal(o.frames, 8);
  assert.equal(o.every, 200);
  assert.equal(o.scrollFrames, 6);
  assert.deepEqual(o.errors, []);
  const d = parseArgs(['page.html']);
  assert.equal(d.reducedMotion, false);
  assert.equal(d.frames, 0);
  assert.equal(d.every, 150);
  assert.equal(d.scrollFrames, 0);
  assert.equal(stepsLine(1440, [{ kind: 'hover', target: '.card' }]), 'Hovered at 1440px: .card');
  assert.equal(stepsLine(1440, o.steps), 'Ran at 1440px: hover text=Menu, tap #open, type "bikes" into #q, hover .card');
});

test('bad --frames, --every, --scroll-frames and --hover values are errors, and a following flag is still read', () => {
  const o = parseArgs(['page.html', '--frames', '0', '--every', '10', '--scroll-frames', '41', '--hover', '--check']);
  assert.equal(o.errors.length, 4);
  assert.equal(o.check, true);
  assert.match(o.errors[0] ?? '', /^--frames takes a whole number from 1 to 60 \(got "0"\)\.$/);
  assert.match(o.errors[1] ?? '', /^--every takes milliseconds from 30 to 10000 \(got "10"\)\.$/);
  assert.match(o.errors[2] ?? '', /^--scroll-frames takes a whole number from 1 to 40 \(got "41"\)\.$/);
  assert.match(o.errors[3] ?? '', /^--hover takes a CSS selector or text=Label \(got "--check"\)\.$/);
});

test('the emulated media features, the checker inputs and the scroll step are well formed', () => {
  // Without the flags, light and no-preference are set anyway, so the computer's own settings do not leak in.
  assert.deepEqual(emulatedFeatures({ scheme: null, reducedMotion: false }), [
    { name: 'prefers-color-scheme', value: 'light' },
    { name: 'prefers-reduced-motion', value: 'no-preference' },
  ]);
  assert.deepEqual(emulatedFeatures({ scheme: 'dark', reducedMotion: true }), [
    { name: 'prefers-color-scheme', value: 'dark' },
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  const expr = checkOptionsExpression({ sheets: [{ href: 'file:///a.css', text: 'a{}' }] });
  const win: Record<string, unknown> = { __argusCheckOptions: { app: true } };
  new Function('window', expr)(win);
  assert.deepEqual(win['__argusCheckOptions'], { app: true, sheets: [{ href: 'file:///a.css', text: 'a{}' }] });
  assert.doesNotThrow(() => new Function('return ' + scrollToExpression(1200)));
  assert.match(scrollToExpression(-5), /top: 0,/);
  assert.match(tapTargetExpression('#late'), /it is still hidden 2s after being scrolled into view/);
});

test('the usage text describes the capture options', () => {
  assert.match(USAGE, /\[--reduced-motion\]/);
  assert.match(USAGE, /\[--hover TARGET\]\.\.\./);
  assert.match(USAGE, /\[--frames N \[--every MS\]\] \[--scroll-frames N\]/);
  assert.match(USAGE, /--reduced-motion\s+emulate prefers-reduced-motion: reduce/);
  assert.match(USAGE, /--hover TARGET\s+after the page settles, move the real mouse onto TARGET/);
  assert.match(USAGE, /frame-<width>-01\.png/);
  assert.match(USAGE, /scroll-<width>-01\.png/);
  assert.match(USAGE, /it is given 2s to show/);
  assert.match(USAGE, /blank-band,\s+lopsided-section and repeated-layout/);
});

test('the flow check steps down the page a third of a screen at a time, the bottom included', () => {
  assert.deepEqual(viewPositions(900, 900), [0]);
  assert.deepEqual(viewPositions(2000, 900), [0, 300, 600, 900, 1100]);
  assert.deepEqual(viewPositions(1800, 900), [0, 300, 600, 900]);
  // A very long page is stepped more coarsely, half a screen apart at most, and never past the cap.
  const long = viewPositions(200000, 900, 90);
  assert.equal(long.length, 90);
  assert.equal(long[long.length - 1], 199100);
  assert.ok(long.every((y, i) => i === 0 || y - (long[i - 1] ?? 0) > 0));
  assert.match(snapshotModeExpression(true), /snapshot: true/);
  assert.match(snapshotModeExpression(false), /delete window\.__argusCheckOptions\.snapshot/);
});

test('settling ignores scroll-driven, endless and over-long animations, sub-pixel style rewrites and aria-hidden style moves', () => {
  // The document's clock, and a scroll timeline that is not it.
  class DocumentTimeline {}
  class ScrollTimeline {}
  const waitable = new Function('DocumentTimeline', 'return ' + WAITABLE_ANIMATION)(DocumentTimeline) as (a: unknown, within: number) => boolean;
  const anim = (end: number, local: number, timeline: unknown = new DocumentTimeline()) => ({ playState: 'running', timeline, effect: { getComputedTiming: () => ({ endTime: end, localTime: local }) } });
  assert.equal(waitable(anim(1000, 200), 6000), true);
  assert.equal(waitable(anim(Infinity, 200), 6000), false);
  assert.equal(waitable(anim(16000, 0), 6000), false);
  assert.equal(waitable(anim(1000, 200, new ScrollTimeline()), 6000), false, 'a scroll or view timeline');
  assert.equal(waitable({ playState: 'finished', effect: {} }, 6000), false);
  const minor = new Function('return ' + MINOR_MUTATION)() as (m: unknown) => boolean;
  const style = (was: string, now: string, hidden = false) => ({ type: 'attributes', attributeName: 'style', oldValue: was, target: { closest: () => (hidden ? {} : null), getAttribute: () => now } });
  assert.equal(minor(style('transform: translate(0.4px, 0px)', 'transform: translate(0.368px, 0px)')), true);
  assert.equal(minor(style('transform: translate(10px, 0px)', 'transform: translate(14px, 0px)')), false);
  assert.equal(minor(style('transform: scale(1)', 'transform: scale(1.2)')), false);
  assert.equal(minor(style('opacity: 0', 'opacity: 1; transform: none')), false);
  assert.equal(minor(style('transform: translateX(-2px)', 'transform: translateX(-40px)', true)), true);
  assert.equal(minor({ type: 'childList', target: {} }), false);
  assert.match(stableExpression(), /attributeOldValue: true/);
});

test('a tap is aimed at the part of the target on the screen, in screen coordinates', () => {
  const expr = tapTargetExpression('#go');
  assert.doesNotThrow(() => new Function('return ' + expr));
  assert.match(expr, /window\.visualViewport/);
  assert.match(expr, /x: \(cx - ox\) \* scale, y: \(cy - oy\) \* scale/);
});

// ---- full captures: finished reveals and one joined picture ----------------------------------

test('the reveal freeze and restore around a full capture are valid expressions that touch only view() timelines', () => {
  const freeze = finishViewRevealsExpression();
  const restore = restoreViewRevealsExpression();
  assert.doesNotThrow(() => new Function('return ' + freeze));
  assert.doesNotThrow(() => new Function('return ' + restore));
  assert.match(freeze, /instanceof ViewTimeline/);
  assert.match(freeze, /a\.timeline = document\.timeline; a\.finish\(\)/);
  assert.match(restore, /a\.timeline = t; a\.play\(\)/);
});

/** A PNG whose rows use every filter type in turn, as a browser's encoder may. */
function filteredPng(width: number, height: number, channels: number, data: Buffer): Buffer {
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    const f = y % 5;
    raw[y * (stride + 1)] = f;
    for (let x = 0; x < stride; x++) {
      const v = data[y * stride + x]!;
      const a = x >= channels ? data[y * stride + x - channels]! : 0;
      const b = y > 0 ? data[(y - 1) * stride + x]! : 0;
      const c = y > 0 && x >= channels ? data[(y - 1) * stride + x - channels]! : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      raw[y * (stride + 1) + 1 + x] = (v - pred) & 0xff;
    }
  }
  const png = encodePng({ width, height, channels, data: Buffer.alloc(height * stride) });
  // Swap the IDAT of a plain encoding for the filtered one; IHDR stays the same.
  const ihdrEnd = 8 + 12 + 13;
  const idat = zlib.deflateSync(raw);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(idat.length, 0);
  head.write('IDAT', 4, 'ascii');
  return Buffer.concat([png.subarray(0, ihdrEnd), head, idat, Buffer.alloc(4), Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])]);
}

test('PNG slices decode through every row filter and join top to bottom into one PNG', () => {
  const w = 7;
  const make = (h: number, seed: number, channels: number): Buffer => {
    const d = Buffer.alloc(w * h * channels);
    for (let i = 0; i < d.length; i++) d[i] = (i * 37 + seed * 101 + ((i * i) % 13)) & 0xff;
    return d;
  };
  for (const channels of [3, 4]) {
    const a = make(5, 1, channels);
    const b = make(4, 2, channels);
    const decoded = decodePng(filteredPng(w, 5, channels, a))!;
    assert.deepEqual([decoded.width, decoded.height, decoded.channels], [w, 5, channels]);
    assert.ok(decoded.data.equals(a), 'every filter undone');
    const joined = decodePng(stitchPngs([filteredPng(w, 5, channels, a), encodePng({ width: w, height: 4, channels, data: b })])!)!;
    assert.deepEqual([joined.width, joined.height], [w, 9]);
    assert.ok(joined.data.equals(Buffer.concat([a, b])));
  }
  // Slices of different widths, or not PNGs, are not joined.
  assert.equal(stitchPngs([encodePng({ width: 2, height: 1, channels: 3, data: Buffer.alloc(6) }), encodePng({ width: 3, height: 1, channels: 3, data: Buffer.alloc(9) })]), null);
  assert.equal(decodePng(Buffer.from('not a png')), null);
});

test('the video hold is one awaitable expression that marks, pauses and rewinds every video, bounded in time', () => {
  const src = holdVideosExpression(900);
  assert.doesNotThrow(() => new Function('return ' + src));
  assert.match(src, /argusPlaying = '1'/);
  assert.match(src, /v\.pause\(\)/);
  assert.match(src, /currentTime = 0/);
  assert.match(src, /\+ 900/);
});
