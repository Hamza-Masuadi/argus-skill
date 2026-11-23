#!/usr/bin/env node
/*
 * Argus before-and-after. Builds one self-contained HTML page from two
 * screenshots so a change can be judged by looking: side by side, a slider
 * that wipes between them, and a view that marks every pixel that changed,
 * with the share of the image that differs.
 *
 * No dependencies and no network calls. The images are embedded in the page,
 * and the difference is worked out by the browser when the page is opened.
 *
 * Usage: node compare.js <before-image> <after-image> [--out compare.html]
 * Images may be PNG, JPEG, WebP or GIF.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const args = process.argv.slice(2);
const USAGE = [
  'Usage: node compare.js <before-image> <after-image> [--out compare.html]',
  '',
  'Builds one self-contained HTML page from two screenshots: side by side, a slider that',
  'wipes between them, and a view marking every changed pixel. PNG, JPEG, WebP or GIF.',
].join('\n');
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
let out = 'compare.html';
const files: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i] ?? '';
  if (a === '--out') out = args[++i] ?? '';
  else files.push(a);
}
const [fileA, fileB] = files;
if (files.length !== 2 || !fileA || !fileB || !out) {
  console.log(USAGE);
  process.exit(1);
}

const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
function embed(file: string): string {
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) { console.log('Not a supported image type: ' + file); process.exit(1); }
  let data: Buffer;
  try {
    data = fs.readFileSync(file);
  } catch {
    console.log('Cannot read ' + file);
    process.exit(1);
  }
  return 'data:' + type + ';base64,' + data.toString('base64');
}
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ENTITIES[c] ?? c);
}

const before = embed(fileA);
const after = embed(fileB);
const nameA = esc(path.basename(fileA));
const nameB = esc(path.basename(fileB));

const html = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Before and after</title>',
  '<style>',
  '  * { box-sizing: border-box; }',
  '  body { margin: 0; font: 14px/1.4 system-ui, sans-serif; background: #1c1d1f; color: #e8e8e6; }',
  '  header { padding: 12px 20px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid #34363a; }',
  '  h1 { font-size: 16px; margin: 0; font-weight: 650; }',
  '  #stat { color: #a3a5a8; }',
  '  .modes { margin-left: auto; display: flex; gap: 8px; }',
  '  button { font: inherit; color: inherit; background: #2a2c30; border: 1px solid #44474c; border-radius: 6px; padding: 6px 12px; cursor: pointer; min-height: 32px; }',
  '  button[aria-pressed="true"] { background: #e8e8e6; color: #1c1d1f; border-color: #e8e8e6; }',
  '  button:focus-visible, input:focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }',
  '  main { padding: 16px 20px; }',
  '  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }',
  '  figure { margin: 0; }',
  '  figcaption { padding-bottom: 6px; color: #a3a5a8; }',
  '  img, canvas { display: block; max-width: 100%; height: auto; background: #fff; border-radius: 6px; }',
  '  .wipe { position: relative; display: inline-block; max-width: 100%; }',
  '  .wipe .top { position: absolute; inset: 0 auto 0 0; overflow: hidden; border-right: 2px solid #ff3ea5; }',
  '  .wipe .top img { max-width: none; border-radius: 6px 0 0 6px; }',
  '  .range { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }',
  '  .range input { width: min(480px, 60vw); }',
  '  [hidden] { display: none !important; }',
  '  @media (max-width: 700px) { .pair { grid-template-columns: 1fr; } }',
  '</style>',
  '</head>',
  '<body>',
  '<header>',
  '  <h1>Before and after</h1>',
  '  <span id="stat" role="status">Measuring the difference...</span>',
  '  <div class="modes" role="group" aria-label="View">',
  '    <button data-mode="side" aria-pressed="true">Side by side</button>',
  '    <button data-mode="wipe" aria-pressed="false">Slider</button>',
  '    <button data-mode="diff" aria-pressed="false">Differences</button>',
  '  </div>',
  '</header>',
  '<main>',
  '  <section id="side" class="pair">',
  '    <figure><figcaption>Before: ' + nameA + '</figcaption><img id="a" alt="Before" src="' + before + '"></figure>',
  '    <figure><figcaption>After: ' + nameB + '</figcaption><img id="b" alt="After" src="' + after + '"></figure>',
  '  </section>',
  '  <section id="wipe" hidden>',
  '    <div class="range"><label for="pos">Before</label><input id="pos" type="range" min="0" max="100" value="50" aria-label="How much of the before image to show"><span>After</span></div>',
  '    <div class="wipe"><img id="wb" alt="After" src="' + after + '"><div class="top" id="top"><img id="wa" alt="Before" src="' + before + '"></div></div>',
  '  </section>',
  '  <section id="diff" hidden>',
  '    <p>Pixels that changed are marked in pink over a faded copy of the after image.</p>',
  '    <canvas id="c" aria-label="Difference between the two images"></canvas>',
  '  </section>',
  '</main>',
  '<script>',
  '  var a = document.getElementById("a"), b = document.getElementById("b");',
  '  var stat = document.getElementById("stat");',
  '  function ready(img) { return new Promise(function (ok) { if (img.complete && img.naturalWidth) ok(); else { img.onload = ok; img.onerror = ok; } }); }',
  '  function pixels(img, w, h) {',
  '    var cv = document.createElement("canvas"); cv.width = w; cv.height = h;',
  '    var cx = cv.getContext("2d"); cx.drawImage(img, 0, 0); return cx.getImageData(0, 0, w, h);',
  '  }',
  '  Promise.all([ready(a), ready(b)]).then(function () {',
  '    if (!a.naturalWidth || !b.naturalWidth) { stat.textContent = "One of the images could not be read."; return; }',
  '    var w = Math.min(a.naturalWidth, b.naturalWidth), h = Math.min(a.naturalHeight, b.naturalHeight);',
  '    var pa = pixels(a, w, h), pb = pixels(b, w, h);',
  '    var c = document.getElementById("c"); c.width = w; c.height = h;',
  '    var cx = c.getContext("2d"); var outp = cx.createImageData(w, h);',
  '    var changed = 0, top = h, left = w, bottom = -1, right = -1;',
  '    for (var i = 0, p = 0; i < pa.data.length; i += 4, p++) {',
  '      var d = Math.abs(pa.data[i] - pb.data[i]) + Math.abs(pa.data[i + 1] - pb.data[i + 1]) + Math.abs(pa.data[i + 2] - pb.data[i + 2]);',
  '      if (d > 48) {',
  '        changed++; outp.data[i] = 255; outp.data[i + 1] = 62; outp.data[i + 2] = 165; outp.data[i + 3] = 255;',
  '        var x = p % w, y = (p - x) / w; if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y;',
  '      } else {',
  '        var g = (pb.data[i] + pb.data[i + 1] + pb.data[i + 2]) / 3; g = 255 - (255 - g) * 0.25;',
  '        outp.data[i] = outp.data[i + 1] = outp.data[i + 2] = g; outp.data[i + 3] = 255;',
  '      }',
  '    }',
  '    cx.putImageData(outp, 0, 0);',
  '    var pct = changed / (w * h) * 100;',
  '    var msg = changed === 0 ? "No visible difference." : pct.toFixed(pct < 1 ? 2 : 1) + "% of the image changed, within the area from (" + left + ", " + top + ") to (" + right + ", " + bottom + ").";',
  '    if (a.naturalWidth !== b.naturalWidth || a.naturalHeight !== b.naturalHeight) {',
  '      msg += " The images are different sizes (" + a.naturalWidth + "x" + a.naturalHeight + " and " + b.naturalWidth + "x" + b.naturalHeight + "); only the area they share was compared.";',
  '    }',
  '    stat.textContent = msg; document.title = "Before and after: " + (changed === 0 ? "no change" : pct.toFixed(1) + "% changed");',
  '    document.body.setAttribute("data-changed", pct.toFixed(3));',
  '  });',
  '  var pos = document.getElementById("pos"), topEl = document.getElementById("top"), wa = document.getElementById("wa"), wb = document.getElementById("wb");',
  '  // Show both images at the same scale, so a size difference between them is not hidden by stretching.',
  '  function wipe() {',
  '    var scale = wb.clientWidth / (b.naturalWidth || wb.clientWidth || 1);',
  '    wa.style.width = Math.round((a.naturalWidth || b.naturalWidth) * scale) + "px";',
  '    topEl.style.width = pos.value + "%";',
  '  }',
  '  pos.addEventListener("input", wipe); window.addEventListener("resize", wipe);',
  '  document.querySelectorAll("button[data-mode]").forEach(function (btn) {',
  '    btn.addEventListener("click", function () {',
  '      document.querySelectorAll("button[data-mode]").forEach(function (o) { o.setAttribute("aria-pressed", String(o === btn)); });',
  '      ["side", "wipe", "diff"].forEach(function (id) { document.getElementById(id).hidden = id !== btn.dataset.mode; });',
  '      if (btn.dataset.mode === "wipe") wipe();',
  '    });',
  '  });',
  '</script>',
  '</body>',
  '</html>',
  ''
].join('\n');

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, html);
console.log(path.resolve(out));
console.log('Open it in a browser. It shows the two images side by side, a slider between them, and what changed.');
