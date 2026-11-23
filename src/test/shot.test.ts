import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { parseArgs, parseWait, scrollThroughExpression, settleExpression, stableExpression, timerTrackerSource, toUrl, USAGE } from '../scripts/shot';

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

test('the default widths are two phones, a laptop and a desktop monitor', () => {
  assert.deepEqual(parseArgs(['page.html']).widths, [320, 390, 1440, 1920]);
  assert.deepEqual(parseArgs(['page.html', '--widths', '390,1440']).widths, [390, 1440]);
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
