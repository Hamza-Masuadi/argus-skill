/*
 * Unit tests for the motion parts of shot.ts: frame metrics on synthetic frames, contact-sheet
 * layout, the timing of recorded frames, the perf summary, the new flags, and the browser-path check.
 */
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  browserProblem, brightness, changedFraction, heldFrames, isFlat, metricsSummary, motionMetrics, MOTION_LIMITS, parseArgs,
  sampleRaster, scenesExpression, seekScrollExpression, seekTimelineExpression, sheetLayout, slug, spreadIndices, summarisePerf,
  type FrameSample, type MotionSequence, USAGE, decodePng, encodePng, CANVAS_RECTS, PERF_START, PERF_STOP, SHEET_SCRIPT, NO_WEBGL_SOURCE, WEBGL_PROBE,
} from '../scripts/shot';

const W = 80;
const H = 60;

/** A flat frame of one colour. */
function flat(r: number, g = r, b = r): FrameSample {
  const rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b; }
  return { width: W, height: H, step: 1, rgb };
}

/** A grey frame with a dark square of side `size` whose left edge is at x. */
function withSquare(x: number, size = 8): FrameSample {
  const f = flat(200);
  for (let y = 10; y < 10 + size; y++) {
    for (let i = x; i < x + size && i < W; i++) {
      const o = (y * W + i) * 3;
      f.rgb[o] = f.rgb[o + 1] = f.rgb[o + 2] = 30;
    }
  }
  return f;
}

/** Half the frame changed: the left half dark. */
function halfDark(): FrameSample {
  const f = flat(200);
  for (let y = 0; y < H; y++) for (let x = 0; x < W / 2; x++) { const o = (y * W + x) * 3; f.rgb[o] = f.rgb[o + 1] = f.rgb[o + 2] = 20; }
  return f;
}

const seq = (kind: MotionSequence['kind'], frames: FrameSample[], extra: Partial<MotionSequence> = {}): MotionSequence =>
  ({ name: 'test', kind, labels: frames.map((_, i) => 'f' + (i + 1)), frames, ...extra });
const flags = (s: MotionSequence): string[] => motionMetrics(s).flags.map((f) => f.flag);

test('changedFraction: identical frames 0, different sizes 1, half the pixels 0.5', () => {
  assert.equal(changedFraction(flat(100), flat(100)), 0);
  assert.equal(changedFraction(flat(100), { ...flat(100), width: W - 1 }), 1);
  assert.equal(changedFraction(flat(200), halfDark()), 0.5);
  // A change below CHANGE_DELTA is not counted (anti-aliasing, dithering).
  assert.equal(changedFraction(flat(100), flat(100 + MOTION_LIMITS.CHANGE_DELTA)), 0);
});

test('a still sequence is dead; a moving one is not', () => {
  assert.deepEqual(flags(seq('time', [flat(200), flat(200), flat(200), flat(200)])), ['dead']);
  const moving = [0, 4, 8, 12, 16].map((x) => withSquare(x));
  assert.deepEqual(flags(seq('scroll', moving)), []);
  // Two frames are too few to call dead.
  assert.deepEqual(flags(seq('time', [flat(200), flat(200)])), []);
  // Blank frames before the page drew anything are the load, not motion: still dead, and no pop.
  assert.deepEqual(flags(seq('time', [flat(255), withSquare(5), withSquare(5), withSquare(5)])), ['dead']);
  assert.deepEqual(flags(seq('time', [flat(0), flat(200), withSquare(5), withSquare(5), withSquare(5)])).filter((x) => x !== 'flash'), ['dead']);
});

test('a pop: one step changes a lot while the steps either side are still', () => {
  const frames = [flat(200), flat(200), halfDark(), halfDark(), halfDark()];
  const m = motionMetrics(seq('progress', frames));
  assert.deepEqual(m.flags.map((f) => f.flag), ['pop']);
  assert.equal(m.flags[0]!.frame, 2);
  // The same jump inside steady movement is not a pop.
  const steady = [withSquare(0, 20), withSquare(10, 20), halfDark(), withSquare(5, 20), withSquare(15, 20)];
  assert.ok(!flags(seq('progress', steady)).includes('pop'));
});

test('a flash: a near-white frame between darker ones; a white page staying white is not', () => {
  const dark = flat(40);
  const frames = [dark, dark, flat(255), dark, dark];
  const m = motionMetrics(seq('time', frames));
  assert.ok(m.flags.some((f) => f.flag === 'flash' && f.frame === 2), JSON.stringify(m.flags));
  assert.ok(!flags(seq('time', [flat(255), flat(255), flat(250)])).includes('flash'));
  // A near-white first frame before a dark page (a white first paint) is a flash too.
  assert.ok(flags(seq('time', [flat(255), dark, dark])).includes('flash'));
});

test('not-settled: only for timed sequences still changing at the end', () => {
  const frames = [withSquare(0), withSquare(10), withSquare(20)];
  assert.ok(flags(seq('time', frames)).includes('not-settled'));
  assert.ok(!flags(seq('scroll', frames)).includes('not-settled'));
  const settled = motionMetrics(seq('time', [withSquare(0), withSquare(10), withSquare(10), withSquare(10)]));
  assert.ok(!settled.flags.some((f) => f.flag === 'not-settled'));
  assert.equal(settled.settledAt, 'f2');
});

test('blank-canvas: a canvas rectangle that is one flat colour on the last frame with canvases', () => {
  const frames = [withSquare(0), withSquare(10), withSquare(20)];
  const blank = { x: 40, y: 0, w: 40, h: 60 }; // right of where the square ever goes: flat grey
  const drawn = { x: 0, y: 0, w: 40, h: 40 };
  assert.ok(flags(seq('scroll', frames, { canvases: [[], [], [blank]] })).includes('blank-canvas'));
  assert.ok(!flags(seq('scroll', frames, { canvases: [[], [], [drawn]] })).includes('blank-canvas'));
  // Too small to judge.
  assert.ok(!flags(seq('scroll', frames, { canvases: [[], [], [{ x: 50, y: 0, w: 10, h: 10 }]] })).includes('blank-canvas'));
});

test('empty-screen: a fallback screen that is one flat colour', () => {
  const m = motionMetrics(seq('screens', [withSquare(5), flat(240)]));
  assert.deepEqual(m.flags.map((f) => [f.flag, f.frame]), [['empty-screen', 1]]);
  // Fallback screens are never called dead.
  assert.ok(!flags(seq('screens', [withSquare(5), withSquare(5), withSquare(5)])).includes('dead'));
});

test('isFlat tolerates a little noise and finds a mostly uniform region', () => {
  const f = flat(120);
  f.rgb[0] = 124; // one pixel slightly off
  assert.equal(isFlat(f), true);
  assert.equal(isFlat(withSquare(5)), false);
  assert.equal(isFlat(withSquare(5), { x: 20, y: 0, w: 20, h: 8 }), true);
  // A screen with only a small mark on it is not empty.
  const mark = flat(240);
  for (let i = 0; i < 6; i++) { mark.rgb[(30 * W + 30 + i) * 3] = 20; mark.rgb[(30 * W + 30 + i) * 3 + 1] = 20; mark.rgb[(30 * W + 30 + i) * 3 + 2] = 20; }
  assert.equal(isFlat(mark), false);
});

test('brightness reads white, black and mid grey', () => {
  assert.ok(brightness(flat(255)).white > 0.99);
  assert.ok(brightness(flat(0)).black > 0.99);
  const g = brightness(flat(128));
  assert.ok(g.luma > 0.45 && g.luma < 0.55 && g.white === 0 && g.black === 0);
});

test('sampleRaster takes every n-th pixel of a decoded PNG', () => {
  const data = Buffer.alloc(6 * 4 * 4);
  for (let i = 0; i < 24; i++) { data[i * 4] = i; data[i * 4 + 3] = 255; }
  const png = encodePng({ width: 6, height: 4, channels: 4, data });
  const r = decodePng(png);
  assert.ok(r);
  const s = sampleRaster(r!, 2);
  assert.deepEqual([s.width, s.height, s.step], [3, 2, 2]);
  assert.deepEqual(Array.from(s.rgb.filter((_, i) => i % 3 === 0)), [0, 2, 4, 12, 14, 16]);
});

test('metricsSummary: one line per sequence and one per flag', () => {
  const lines = metricsSummary([motionMetrics(seq('time', [flat(200), flat(200), flat(200)]))]);
  assert.equal(lines.length, 2);
  assert.match(lines[0]!, /^test: 3 frames, largest step 0%, no change at all$/);
  assert.match(lines[1]!, /^ {2}dead: nothing changes/);
});

test('sheetLayout: landscape frames in up to five columns, phone frames side by side, never wider than asked or than the frames', () => {
  const l9 = sheetLayout(9, 1440, 900);
  assert.deepEqual([l9.cols, l9.rows], [3, 3]);
  assert.ok(l9.width <= 1600 && l9.tileW <= 1440);
  assert.equal(l9.tileH, Math.round((l9.tileW * 900) / 1440));
  const p6 = sheetLayout(6, 390, 844);
  assert.deepEqual([p6.cols, p6.rows], [6, 1]);
  const p12 = sheetLayout(12, 390, 844);
  assert.deepEqual([p12.cols, p12.rows], [6, 2]);
  assert.deepEqual([sheetLayout(1, 1440, 900).cols, sheetLayout(2, 1440, 900).cols, sheetLayout(40, 1440, 900).cols], [1, 2, 5]);
  assert.equal(sheetLayout(2, 300, 200).tileW, 300, 'tiles are not enlarged past the frame');
});

test('heldFrames: the frame on screen at each tick, nothing before the first frame arrived', () => {
  // Frames arrived at 120, 130 and 400 ms.
  assert.deepEqual(heldFrames([120, 130, 400], 500, 100), [[200, 1], [300, 1], [400, 2], [500, 2]]);
  assert.deepEqual(heldFrames([], 500, 100), []);
  assert.deepEqual(heldFrames([0], 200, 100), [[0, 0], [100, 0], [200, 0]]);
});

test('spreadIndices keeps the first and last and spreads the rest', () => {
  assert.deepEqual(spreadIndices(5, 10), [0, 1, 2, 3, 4]);
  assert.deepEqual(spreadIndices(100, 5), [0, 25, 50, 74, 99]);
});

test('summarisePerf: shares, percentiles, and advice only past the limits', () => {
  const calm = summarisePerf({ gaps: Array(100).fill(16.7), loaf: [], tasks: [], shift: 0, shifts: 0, hasLoaf: true });
  assert.equal(calm.longFrameShare, 0);
  assert.equal(calm.p95Ms, 16.7);
  assert.deepEqual(calm.advice, []);
  const rough = summarisePerf({ gaps: [...Array(90).fill(16.7), ...Array(10).fill(40)], loaf: [{ duration: 120, blocking: 80 }], tasks: [70], shift: 0.2, shifts: 3, hasLoaf: true });
  assert.equal(rough.longFrameShare, 0.1);
  assert.equal(rough.blockingFrames, 1);
  assert.equal(rough.advice.length, 3);
});

test('the new flags parse, keep their defaults, and refuse bad values before any browser starts', () => {
  const d = parseArgs(['p.html']);
  assert.deepEqual([d.scenes, d.points, d.arrival, d.ms, d.transition, d.timelines, d.motionMetrics, d.perfScroll, d.fallbacks, d.everyGiven],
    [false, 9, false, null, null, [], false, false, false, false]);
  const o = parseArgs(['p.html', '--scenes', '--points', '5', '--arrival', '--ms', '2000', '--transition', 'text=Next', '--timeline', 'hero', '--timeline', 'beats', '--motion-metrics', '--perf-scroll', '--fallbacks', '--every', '80']);
  assert.deepEqual([o.scenes, o.points, o.arrival, o.ms, o.transition, o.timelines, o.motionMetrics, o.perfScroll, o.fallbacks, o.every, o.everyGiven, o.errors],
    [true, 5, true, 2000, 'text=Next', ['hero', 'beats'], true, true, true, 80, true, []]);
  assert.match(parseArgs(['p.html', '--points', '40']).errors[0] ?? '', /--points takes a whole number from 2 to 16 \(got "40"\)/);
  assert.match(parseArgs(['p.html', '--ms', '50']).errors[0] ?? '', /--ms takes milliseconds from 200 to 15000/);
  const missing = parseArgs(['p.html', '--transition', '--scenes']);
  assert.match(missing.errors[0] ?? '', /--transition takes a link/);
  assert.equal(missing.scenes, true, 'the next flag is still read');
  assert.match(parseArgs(['p.html', '--timeline']).errors[0] ?? '', /--timeline takes the name/);
  // The old flags are untouched.
  assert.deepEqual([o.frames, o.scrollFrames, o.widths], [0, 0, [320, 390, 1440, 1920]]);
});

test('USAGE documents every motion flag', () => {
  for (const f of ['--scenes', '--timeline NAME', '--points N', '--arrival', '--transition T', '--ms MS', '--motion-metrics', '--perf-scroll', '--fallbacks', 'window.__argus']) {
    assert.ok(USAGE.includes(f), f);
  }
});

test('the in-page sources are valid JavaScript', () => {
  for (const src of [scenesExpression(), seekScrollExpression(500), seekTimelineExpression('hero', 0.5), seekTimelineExpression('hero', null), CANVAS_RECTS, PERF_START, PERF_STOP, WEBGL_PROBE]) {
    assert.doesNotThrow(() => new Function('return ' + src), src.slice(0, 60));
  }
  for (const src of [SHEET_SCRIPT, NO_WEBGL_SOURCE]) assert.doesNotThrow(() => new Function(src));
});

test('slug makes short file-safe names', () => {
  assert.equal(slug('Three beats: Kiln & Fire!'), 'three-beats-kiln-fire');
  assert.equal(slug('***'), 'x');
});

test('browserProblem: a missing path, a folder and a plain file are each one clear line; a program is fine', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-browser-'));
  try {
    const missing = browserProblem(path.join(dir, 'nope'));
    assert.match(missing ?? '', /there is no file there/);
    assert.equal((missing ?? '').includes('\n'), false);
    const app = path.join(dir, 'Fake Browser.app');
    fs.mkdirSync(app);
    assert.match(browserProblem(app) ?? '', /that is a folder \(on a Mac, use the program inside it: .*Contents.*MacOS.*Fake Browser\)/);
    if (process.platform !== 'win32') {
      const plain = path.join(dir, 'plain');
      fs.writeFileSync(plain, 'x');
      assert.match(browserProblem(plain) ?? '', /not executable/);
      fs.chmodSync(plain, 0o755);
      assert.equal(browserProblem(plain), null);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
