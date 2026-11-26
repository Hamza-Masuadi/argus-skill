/*
 * Runs the shipped shot.js's motion flags in a real browser on fixture pages and on the showpiece
 * starters that work offline (no CDN): contact sheets are written, the metrics tell a still page
 * from a moving one, and the fallback captures are taken. Skipped when no Chrome-family browser is
 * installed. The GSAP starters are not run here: they load GSAP from a CDN.
 */
import { test, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { findBrowser, NO_WEBGL_SOURCE } from '../scripts/shot';

const root = path.join(__dirname, '..', '..');
const shot = path.join(root, 'skills', 'argus', 'scripts', 'shot.js');
const fixture = (name: string): string => path.join(root, 'src', 'test', 'fixtures', 'motion', name);
const starter = (name: string): string => path.join(root, 'skills', 'argus', 'assets', 'showpiece', name);
const skip = findBrowser() ? false : 'no Chrome-family browser installed';

function run(...args: string[]): { out: string; code: number | null } {
  const r = spawnSync(process.execPath, [shot, ...args], { encoding: 'utf8', timeout: 180000 });
  return { out: r.stdout, code: r.status };
}

/** As run, but without blocking this process (for a page served from this process). */
function runAsync(env: NodeJS.ProcessEnv, ...args: string[]): Promise<{ out: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [shot, ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    // Never outlive the test: a run that stops answering is killed, and its output says how far it got.
    const timer = setTimeout(() => child.kill('SIGKILL'), 90000);
    let out = '';
    child.stdout.on('data', (d) => { out += String(d); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ out, code }); });
  });
}

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'argus-motion-'));
}

interface Metrics { sequences: Array<{ name: string; kind: string; frames: number; changes: number[]; flags: Array<{ flag: string }> }> }
const readMetrics = (dir: string): Metrics => JSON.parse(fs.readFileSync(path.join(dir, 'motion-metrics.json'), 'utf8')) as Metrics;
const flagsOf = (m: Metrics, name: RegExp): string[] => (m.sequences.find((s) => name.test(s.name))?.flags ?? []).map((f) => f.flag);
const pngSize = (file: string): [number, number] => { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('--arrival on a still page: frames, one contact sheet, and a dead flag', { skip }, () => {
  const dir = tmp();
  try {
    const { out, code } = run(fixture('still.html'), '--widths', '1440', '--arrival', '--ms', '800', '--every', '200', '--motion-metrics', '--no-shots', '--out', dir);
    assert.equal(code, 0, out);
    const sheet = path.join(dir, 'arrival-1440-sheet.png');
    assert.ok(fs.existsSync(sheet), out);
    const [w, h] = pngSize(sheet);
    assert.ok(w <= 1600 && w > 400 && h > 200, `sheet is ${w}x${h}`);
    assert.ok(fs.readdirSync(dir).filter((f) => /^arrival-1440-\d\d\.png$/.test(f)).length >= 3);
    assert.deepEqual(flagsOf(readMetrics(dir), /^arrival/), ['dead']);
    assert.match(out, /Motion metrics \(advisory/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a moving page: the arrival and a registered timeline change, and a blank canvas is flagged', { skip }, () => {
  const dir = tmp();
  try {
    const { out, code } = run(fixture('moving.html'), '--widths', '1440', '--arrival', '--ms', '1200', '--every', '200', '--timeline', 'slide', '--timeline', 'nope', '--points', '5', '--motion-metrics', '--no-shots', '--out', dir);
    assert.equal(code, 0, out);
    const m = readMetrics(dir);
    const arrival = m.sequences.find((s) => /^arrival/.test(s.name));
    assert.ok(arrival && Math.max(...arrival.changes) > 0.01, JSON.stringify(arrival));
    assert.ok(!flagsOf(m, /^arrival/).includes('dead'));
    const slide = m.sequences.find((s) => /^timeline "slide"/.test(s.name));
    assert.ok(slide, out);
    assert.equal(slide.frames, 5);
    assert.ok(!flagsOf(m, /^timeline "slide"/).includes('dead'));
    assert.ok(flagsOf(m, /^timeline "slide"/).includes('blank-canvas'), JSON.stringify(slide.flags));
    assert.ok(fs.existsSync(path.join(dir, 'timeline-1440-slide-sheet.png')));
    // A timeline the page does not have is reported, not fatal (the run above exited 0).
    assert.match(out, /--timeline "nope" at 1440px: no timeline "nope" on window\.__argus\.timelines \(it has: slide\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--scenes on the kinetic-type starter finds its registered scene and sees it change', { skip }, () => {
  const dir = tmp();
  try {
    const { out, code } = run(starter('kinetic-type.html'), '--widths', '1440', '--scenes', '--points', '4', '--motion-metrics', '--no-shots', '--out', dir);
    assert.equal(code, 0, out);
    assert.match(out, /Scenes at 1440px: "kinetic" \d+-\d+px \(window\.__argus\.scenes\)/);
    assert.ok(fs.existsSync(path.join(dir, 'scene-1440-1-kinetic-sheet.png')));
    const m = readMetrics(dir);
    const scene = m.sequences.find((s) => /^scene "kinetic"/.test(s.name));
    assert.ok(scene && scene.frames === 4 && Math.max(...scene.changes) > 0.02, JSON.stringify(scene));
    assert.deepEqual(scene.flags, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--timeline on the shader starter draws (no blank canvas) where this browser has WebGL', { skip }, () => {
  const dir = tmp();
  try {
    const { out, code } = run(starter('shader-background.html'), '--widths', '1440', '--timeline', 'field', '--points', '3', '--motion-metrics', '--no-shots', '--out', dir);
    assert.equal(code, 0, out);
    const m = readMetrics(dir);
    if (/WebGL is not available/.test(out)) return; // nothing to judge on this machine; the note was printed
    assert.deepEqual(flagsOf(m, /^timeline "field"/), []);
    const field = m.sequences.find((s) => /^timeline "field"/.test(s.name));
    assert.ok(field && Math.max(...field.changes) > 0.02, JSON.stringify(field));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--fallbacks captures reduced motion, script off, WebGL off and touch, and the WebGL starter shows its pictures in each', { skip }, () => {
  const dir = tmp();
  try {
    const { out, code } = run(starter('webgl-image.html'), '--widths', '1440', '--fallbacks', '--no-shots', '--out', dir);
    assert.equal(code, 0, out);
    for (const kind of ['reduced-1440', 'nojs-1440', 'nowebgl-1440', 'touch-390']) {
      assert.ok(fs.existsSync(path.join(dir, `fallback-${kind}-sheet.png`)), kind + '\n' + out);
      assert.ok(fs.existsSync(path.join(dir, `fallback-${kind}-01.png`)), kind);
    }
    assert.doesNotMatch(out, /empty-screen/);
    // Script off shows a page whose content a start state hides: the screen is reported empty.
    const hidden = path.join(dir, 'hidden.html');
    fs.writeFileSync(hidden, '<!doctype html><html><head><style>body{margin:0;background:#eee;font:20px system-ui} main{opacity:0;padding:2rem}.js main{opacity:1}</style><script>document.documentElement.className="js"</script></head><body><main><h1>Hello</h1><p>Shown only when script runs.</p></main></body></html>');
    const h = run(hidden, '--widths', '1440', '--fallbacks', '--no-shots', '--out', dir);
    assert.match(h.out, /script off at 1440px: empty-screen: screen 1/);
    assert.doesNotMatch(h.out, /reduced motion at 1440px: empty-screen/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The showpiece starters served over http (a cross-document view transition needs one origin), for the
// whole file, and closed with every connection at the end so the file exits at once.
const base = path.join(root, 'skills', 'argus', 'assets', 'showpiece');
const server = http.createServer((req, res) => {
  const file = path.join(base, path.normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/')).replace(/^([/\\])+/, ''));
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
let origin = '';
before(async () => {
  if (skip) return;
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  origin = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

test('--transition records a cross-document view transition between the two starter pages', { skip }, async () => {
  const dir = tmp();
  try {
    const { out, code } = await runAsync({}, `${origin}/transition.html`, '--widths', '1440', '--transition', 'text=Saltmarsh House', '--ms', '900', '--every', '100', '--motion-metrics', '--no-shots', '--out', dir);
    assert.equal(code, 0, out);
    assert.ok(fs.existsSync(path.join(dir, 'transition-1440-sheet.png')), out);
    const m = readMetrics(dir);
    const t = m.sequences.find((s) => /^transition/.test(s.name));
    assert.ok(t, out);
    // A browser that sends no screencast frames (a Mac with no display) gets timed screenshots, which
    // start after a short transition has finished: the tool says so, and there is nothing to measure.
    // The same holds on a slow machine whose first frame arrives after the transition: the tool flags
    // the sequence dead and says the motion ran before the capture.
    const late = (t.flags as Array<{ flag: string; message?: string }>).some((f) => f.flag === 'dead' && /ran before the capture/.test(f.message ?? ''));
    if (!/sent no screencast frames/.test(out) && !late) {
      assert.ok(Math.max(...t.changes) > 0.05, JSON.stringify(t));
      assert.ok(!flagsOf(m, /^transition/).includes('dead'));
      assert.ok(!flagsOf(m, /^transition/).includes('flash'), JSON.stringify(t?.flags));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('with no screencast frames, --arrival and --transition fall back to timed screenshots on the live page', { skip }, async () => {
  const dir = tmp();
  try {
    // As a browser that sends no screencast frames (seen headless on macOS): both flags in one run.
    const { out, code } = await runAsync({ ARGUS_NO_SCREENCAST: '1' }, `${origin}/transition.html`, '--widths', '1024', '--arrival', '--transition', 'text=Saltmarsh House', '--ms', '600', '--every', '150', '--no-shots', '--out', dir);
    assert.equal(code, 0, out);
    assert.match(out, /browser sent no screencast frames; took timed screenshots instead/);
    assert.match(out, /browser sent no screencast frames for --transition; ran it again under timed screenshots/);
    assert.doesNotMatch(out, /Could not capture|Not attached/, out);
    for (const kind of ['arrival', 'transition']) {
      assert.ok(fs.readdirSync(dir).filter((f) => new RegExp(`^${kind}-1024-\\d\\d\\.png$`).test(f)).length >= 2, kind + '\n' + out);
      assert.ok(fs.existsSync(path.join(dir, `${kind}-1024-sheet.png`)), kind + '\n' + out);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a bad ARGUS_BROWSER prints one clear line and exits 3, with no stack trace', () => {
  const r = spawnSync(process.execPath, [shot, fixture('still.html'), '--no-shots', '--check'], { encoding: 'utf8', env: { ...process.env, ARGUS_BROWSER: '/no/such/browser' } });
  assert.equal(r.status, 3);
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines.length, 1, r.stdout);
  assert.match(lines[0] ?? '', /^ARGUS_BROWSER is set to "\/no\/such\/browser", but there is no file there\./);
  assert.doesNotMatch(r.stdout + r.stderr, /\n\s+at /);
});

/**
 * The WebGL starter, copied with its vendored OGL into a folder with a probe: after the page settles
 * the probe scrolls to the first picture, waits, and adds a button "probe-ok" only when no picture is
 * hidden unless its own plane has been drawn on screen. shot.js --tap "#probe-ok" then succeeds only
 * when that holds. `head` is put first in <head>, `css` after the starter's styles.
 */
function webglProbe(dir: string, head: string, css: string): string {
  const src = fs.readFileSync(starter('webgl-image.html'), 'utf8');
  fs.mkdirSync(path.join(dir, 'vendor'), { recursive: true });
  fs.copyFileSync(starter('vendor/ogl-1.0.11.global.js'), path.join(dir, 'vendor', 'ogl-1.0.11.global.js'));
  const probe = `<script>
addEventListener('load', () => setTimeout(async () => {
  const pics = Array.from(document.querySelectorAll('img[data-gl]'));
  pics[0].scrollIntoView({ block: 'center', behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 1200));
  const onScreen = (img) => { const r = img.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  // A hidden picture must be on screen (its plane proven there); one never shown must stay visible.
  const ok = pics.every((img) => getComputedStyle(img).opacity === '1' || onScreen(img));
  const b = document.createElement('button');
  b.id = ok ? 'probe-ok' : 'probe-bad';
  b.textContent = b.id + ' ' + pics.map((p) => getComputedStyle(p).opacity).join(',');
  document.querySelector('main').prepend(b);
}, 300));
</script>`;
  const html = src
    .replace('<head>', '<head>' + head)
    .replace('</style>', css + '\n</style>')
    .replace('</body>', probe + '</body>');
  const file = path.join(dir, 'probe.html');
  fs.writeFileSync(file, html);
  return file;
}

test('the WebGL starter with no WebGL: every picture stays visible, nothing is a blank box', { skip }, () => {
  const dir = tmp();
  try {
    const file = webglProbe(dir, `<script>${NO_WEBGL_SOURCE}</script>`, '');
    const r = run(file, '--widths', '1024', '--tap', '#probe-ok', '--check', '--no-shots', '--out', path.join(dir, 'shots'));
    assert.match(r.out, /Tapped at 1024px: #probe-ok/, r.out);
    assert.doesNotMatch(r.out, /Could not tap/, r.out);
    assert.doesNotMatch(r.out, /\[blank-canvas\]/, r.out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the WebGL starter with every picture off screen at load: only pictures whose plane was drawn on screen are hidden, and --check finds no blank canvas', { skip }, () => {
  const dir = tmp();
  try {
    const file = webglProbe(dir, '', '.grid { padding-top: 120vh; } .grid figure:nth-child(n) { grid-column: 1 / -1; margin-top: 160vh; }');
    const r = run(file, '--widths', '1024', '--tap', '#probe-ok', '--check', '--out', path.join(dir, 'shots'));
    assert.match(r.out, /Tapped at 1024px: #probe-ok/, r.out);
    assert.doesNotMatch(r.out, /\[blank-canvas\]/, r.out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
