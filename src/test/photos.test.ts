import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import {
  main,
  parseArgs,
  pexelsUrl,
  parsePexels,
  assessment,
  rankCommons,
  openverseUrl,
  commonsUrl,
  licenceAllowed,
  parseOpenverse,
  parseCommons,
  rejectReason,
  interleave,
  fileNameFor,
  extensionFor,
  imageSize,
  mergeCredits,
  reconcileCredits,
  writeCredits,
  creditId,
  plainText,
  describeError,
  photoPageSite,
  pexelsId,
  parsePhotoPage,
  sizedImageUrl,
  refusedReason,
  whyFew,
  type Candidate,
} from '../scripts/photos';
import {
  planSources, openverseFile, pexelsCollectionUrl, pexelsPhotoUrl, pixabayUrl, parsePixabay, europeanaUrl, parseEuropeana, clevelandUrl, parseCleveland,
  metSearchUrl, metObjectUrl, parseMetObject, nasaUrl, parseNasa, smithsonianUrl, parseSmithsonian, licenceFromUrl, filterOf, sameKey, providerBreakdown,
  seriesTarget, parseUnsplashUserPage, unsplashUserFromPhotoPage, groupByAuthor, pictureMarkup, budgetLine, gradeNote, magickGradeArgs, sheetHtml, listImages,
  creditFor, COMMONS_RATED, USAGES, sharpVerdict, SHARP_WIDTH, SOFT_BELOW, DARK_BELOW, avifProblem,
  dominantColours, paletteRoles, contrastRatio, rgbToOklab, labToOklch, oklchToHex,
} from '../scripts/photos';
import { encodePng, findBrowser } from '../scripts/shot';

test('arguments: the search words, a capped count, the folder and the orientation', () => {
  const o = parseArgs(['hands', 'on', 'clay', '--count', '50', '--out', 'pics', '--orientation', 'Landscape', '--json']);
  assert.equal(o.query, 'hands on clay');
  assert.equal(o.count, 20);
  assert.equal(o.out, 'pics');
  assert.equal(o.orientation, 'landscape');
  assert.equal(o.json, true);
  assert.deepEqual(o.bad, []);
  const d = parseArgs(['"pottery wheel"']);
  assert.equal(d.count, 8);
  assert.equal(d.out, 'photos-candidates');
  assert.equal(d.orientation, null);
  assert.deepEqual(parseArgs(['x', '--orientation', 'diagonal', '--count', 'lots', '--wat']).bad, ['--orientation diagonal', '--count lots', '--wat']);
  assert.equal(parseArgs([]).query, null);
  // The docs say `photos.js search <words>`; the word search names the command, it is not searched for.
  assert.equal(parseArgs(['search', 'hands on clay']).query, 'hands on clay');
  assert.equal(parseArgs(['search', 'hands on clay']).command, 'search');
});

test('the Openverse search asks only for licences that allow commercial use and changes', () => {
  const u = new URL(openverseUrl('pottery wheel', 'portrait'));
  assert.equal(u.hostname, 'api.openverse.org');
  assert.equal(u.searchParams.get('q'), 'pottery wheel');
  assert.equal(u.searchParams.get('license_type'), 'commercial,modification');
  assert.equal(u.searchParams.get('aspect_ratio'), 'tall');
  assert.equal(new URL(openverseUrl('x', null)).searchParams.get('aspect_ratio'), null);
});

test('the Commons search covers files only, bitmaps only, and asks for licence metadata', () => {
  const u = new URL(commonsUrl('ferry ramp'));
  assert.equal(u.hostname, 'commons.wikimedia.org');
  assert.equal(u.searchParams.get('gsrnamespace'), '6');
  assert.equal(u.searchParams.get('gsrsearch'), 'ferry ramp filetype:bitmap');
  assert.match(u.searchParams.get('iiprop') ?? '', /extmetadata/);
  assert.match(u.searchParams.get('iiextmetadatafilter') ?? '', /LicenseShortName/);
});

test('licences: CC0, public domain, CC BY and CC BY-SA pass; NC, ND, unknown and missing do not', () => {
  for (const ok of ['cc0', 'CC0', 'pdm', 'pd', 'Public domain', 'by', 'by-sa', 'CC BY 2.0', 'CC BY-SA 4.0', 'cc-by-sa-3.0', 'cc-by-sa-3.0-de', 'CC-BY-4.0']) {
    assert.equal(licenceAllowed(ok), true, ok);
  }
  for (const no of ['', null, undefined, 'by-nc', 'CC BY-NC-SA 2.0', 'by-nd', 'CC BY-ND 4.0', 'GFDL', 'All rights reserved', 'Fair use', 'copyrighted']) {
    assert.equal(licenceAllowed(no), false, String(no));
  }
});

test('Openverse results become candidates, and bad ones are skipped with a reason', () => {
  const parsed = parseOpenverse({
    results: [
      {
        title: '<div class="fn">Hands on the wheel</div>',
        url: 'https://live.example.org/a_b.jpg',
        foreign_landing_url: 'https://photos.example.org/a',
        creator: 'Ruth',
        license: 'by',
        license_version: '2.0',
        license_url: 'https://creativecommons.org/licenses/by/2.0/',
        width: 2048,
        height: 1365,
      },
      { title: 'No licence', url: 'https://x.example.org/b.jpg', foreign_landing_url: 'https://x.example.org/b', license: '' },
      { title: 'Non-commercial', url: 'https://x.example.org/c.jpg', foreign_landing_url: 'https://x.example.org/c', license: 'by-nc' },
      { title: 'No file', foreign_landing_url: 'https://x.example.org/d', license: 'cc0' },
      'not an object',
    ],
  });
  assert.equal(parsed.candidates.length, 1);
  const c = parsed.candidates[0];
  assert.ok(c);
  assert.equal(c.licence, 'CC BY 2.0');
  assert.equal(c.title, 'Hands on the wheel');
  assert.equal(c.author, 'Ruth');
  assert.equal(c.width, 2048);
  assert.equal(parsed.skipped.length, 4);
  assert.deepEqual(parseOpenverse({ error: 'rate limited' }).candidates, []);
  assert.equal(parseOpenverse(null).skipped.length, 1);
});

test('Commons pages become candidates in search order, with HTML stripped from the author', () => {
  const page = (index: number, title: string, licence: string, extra: Record<string, unknown> = {}) => ({
    index,
    title: 'File:' + title + '.jpg',
    imageinfo: [
      {
        mime: 'image/jpeg',
        width: 5472,
        height: 3648,
        url: 'https://upload.example.org/' + index + '.jpg',
        thumburl: 'https://upload.example.org/thumb/' + index + '.jpg',
        thumbwidth: 2400,
        thumbheight: 1600,
        descriptionurl: 'https://commons.example.org/wiki/File:' + index,
        extmetadata: {
          ObjectName: { value: title },
          Artist: { value: '<a href="//x">Kritz&amp;olina</a>' },
          LicenseShortName: { value: licence },
          LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
        },
        ...extra,
      },
    ],
  });
  const parsed = parseCommons({
    query: {
      pages: {
        '9': page(2, 'Second', 'CC BY-SA 4.0'),
        '3': page(1, 'First', 'Public domain'),
        '4': page(3, 'Restricted', 'CC BY-NC 2.0'),
        '5': page(4, 'A drawing', 'CC0', { mime: 'image/svg+xml' }),
        '6': { index: 5, title: 'File:Broken.jpg' },
      },
    },
  });
  assert.deepEqual(parsed.candidates.map((c) => c.title), ['First', 'Second']);
  const first = parsed.candidates[0];
  assert.ok(first);
  assert.equal(first.author, 'Kritz&olina');
  assert.equal(first.imageUrl, 'https://upload.example.org/thumb/1.jpg');
  assert.equal(first.width, 2400);
  assert.equal(parsed.skipped.length, 3);
  assert.deepEqual(parseCommons({ batchcomplete: '' }), { candidates: [], skipped: [] });
  assert.equal(parseCommons({ error: { code: 'x' } }).skipped.length, 1);
});

test('small pictures and the wrong shape are rejected only when the size is known', () => {
  assert.match(rejectReason({ width: 1024, height: 768 }, null) ?? '', /too small/);
  assert.equal(rejectReason({ width: 1600, height: 1000 }, 'landscape'), null);
  assert.match(rejectReason({ width: 1000, height: 1600 }, 'landscape') ?? '', /portrait/);
  assert.equal(rejectReason({ width: 1300, height: 1250 }, 'square'), null);
  assert.equal(rejectReason({ width: null, height: null }, 'portrait'), null);
});

test('candidates alternate between sources and repeats are dropped', () => {
  const c = (source: Candidate['source'], url: string): Candidate => ({ source, title: url, author: '', pageUrl: '', imageUrl: url, licence: '', licenceUrl: '', width: null, height: null });
  const out = interleave([c('openverse', 'https://a/1.jpg'), c('openverse', 'https://a/2.jpg'), c('openverse', 'https://a/3.jpg')], [c('wikimedia', 'https://b/1.jpg'), c('wikimedia', 'https://a/2.jpg?x=1')]);
  assert.deepEqual(out.map((x) => x.imageUrl), ['https://a/1.jpg', 'https://b/1.jpg', 'https://a/2.jpg', 'https://a/3.jpg']);
});

test('file names are readable, safe and stable', () => {
  const name = fileNameFor({ title: 'Potter’s hands — wet clay, 2019!', imageUrl: 'https://a/1.jpg' }, 'Hands on clay', 'jpg');
  assert.match(name, /^hands-on-clay-potter-s-hands-wet-clay-2019-[0-9a-f]{6}\.jpg$/);
  assert.equal(name, fileNameFor({ title: 'Potter’s hands — wet clay, 2019!', imageUrl: 'https://a/1.jpg' }, 'Hands on clay', 'jpg'));
  assert.notEqual(name, fileNameFor({ title: 'Potter’s hands — wet clay, 2019!', imageUrl: 'https://a/2.jpg' }, 'Hands on clay', 'jpg'));
  assert.match(fileNameFor({ title: '***', imageUrl: 'u' }, '', 'png'), /^photo-photo-[0-9a-f]{6}\.png$/);
});

test('extensions come from the content type first, then the address', () => {
  assert.equal(extensionFor('https://a/x', 'image/jpeg'), 'jpg');
  assert.equal(extensionFor('https://a/x.png?w=1', null), 'png');
  assert.equal(extensionFor('https://a/x.tif', 'image/tiff'), null);
  assert.equal(extensionFor('https://a/x.JPEG', ''), 'jpg');
});

test('image size is read from PNG, JPEG and WebP headers', () => {
  const png = Buffer.alloc(24);
  png.writeUInt32BE(0x89504e47, 0);
  png.writeUInt32BE(1600, 16);
  png.writeUInt32BE(900, 20);
  assert.deepEqual(imageSize(png), { width: 1600, height: 900 });

  // SOI, an APP0 segment of 16 bytes, then a baseline frame header.
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new Array<number>(14).fill(0), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x05, 0xdc, 0x07, 0xd0, 0x03]);
  assert.deepEqual(imageSize(jpeg), { width: 2000, height: 1500 });

  const webp = Buffer.alloc(30);
  webp.write('RIFF', 0, 'ascii');
  webp.write('WEBP', 8, 'ascii');
  webp.write('VP8X', 12, 'ascii');
  webp.writeUIntLE(2399, 24, 3);
  webp.writeUIntLE(1599, 27, 3);
  assert.deepEqual(imageSize(webp), { width: 2400, height: 1600 });

  assert.equal(imageSize(Buffer.from('<html>not an image</html>')), null);
});

test('credits merge by file name, keeping earlier searches', () => {
  const credit = (file: string, search: string) => ({ file, title: '', author: '', source: 'openverse' as const, sourcePage: '', licence: '', licenceUrl: '', width: 1, height: 1, search });
  const merged = mergeCredits([credit('a.jpg', 'one'), credit('b.jpg', 'one'), { junk: true }], [credit('b.jpg', 'two'), credit('c.jpg', 'two')]);
  assert.deepEqual(merged.map((c) => c.file + ':' + c.search), ['a.jpg:one', 'b.jpg:two', 'c.jpg:two']);
  assert.equal(mergeCredits('not a list', [credit('a.jpg', 'x')]).length, 1);
});

test('text and errors are put in plain words', () => {
  assert.equal(plainText('<span>Photo by <b>Ana</b></span>&nbsp;&quot;x&quot;'), 'Photo by Ana "x"');
  const offline = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  assert.match(describeError(offline), /could not be reached/);
  assert.match(describeError(Object.assign(new Error('x'), { name: 'TimeoutError' })), /too long/);
});

test('--help and -h ask for help rather than being reported as not understood', () => {
  for (const flag of ['--help', '-h']) {
    const o = parseArgs([flag]);
    assert.equal(o.help, true);
    assert.deepEqual(o.bad, []);
    assert.equal(o.query, null);
  }
});

test('--min-width and --best are read; without them nothing changes', () => {
  const o = parseArgs(['cabin', '--min-width', '1800', '--best']);
  assert.equal(o.minWidth, 1800);
  assert.equal(o.best, true);
  assert.deepEqual(o.bad, []);
  const d = parseArgs(['cabin']);
  assert.equal(d.minWidth, null);
  assert.equal(d.best, false);
  assert.deepEqual(parseArgs(['x', '--min-width', 'wide']).bad, ['--min-width wide']);
  assert.deepEqual(parseArgs(['x', '--min-width', '0']).bad, ['--min-width 0']);
});

test('--min-width drops pictures narrower than asked, only when the width is known', () => {
  assert.match(rejectReason({ width: 1600, height: 1200 }, null, 1800) ?? '', /too narrow \(1600x1200, under --min-width 1800px\)/);
  assert.equal(rejectReason({ width: 2000, height: 1200 }, null, 1800), null);
  assert.equal(rejectReason({ width: 1600, height: 1200 }, null), null);
  assert.equal(rejectReason({ width: null, height: null }, null, 1800), null);
});

test('--best asks Commons for assessments and ranks featured, quality and valued images first, then the largest original', () => {
  assert.doesNotMatch(new URL(commonsUrl('x')).searchParams.get('iiextmetadatafilter') ?? '', /Categories|Assessments/);
  assert.match(new URL(commonsUrl('x', true)).searchParams.get('iiextmetadatafilter') ?? '', /\|Categories\|Assessments$/);
  assert.equal(assessment('poty|featured'), 3);
  assert.equal(assessment('Cabins in Canada|Quality images of Ontario'), 2);
  assert.equal(assessment('quality'), 2);
  assert.equal(assessment('Valued images sorted by promoted scope'), 1);
  assert.equal(assessment('Air quality|Snow'), 0);
  const page = (index: number, title: string, width: number, extra: Record<string, { value: string }> = {}) => ({
    index,
    title: 'File:' + title + '.jpg',
    imageinfo: [{ mime: 'image/jpeg', width, height: Math.round(width * 0.66), url: 'https://u.example.org/' + index + '.jpg', descriptionurl: 'https://c.example.org/' + index,
      extmetadata: { LicenseShortName: { value: 'CC0' }, ...extra } }],
  });
  const parsed = parseCommons({ query: { pages: {
    a: page(1, 'Small', 2000),
    b: page(2, 'Huge', 8000),
    c: page(3, 'Quality', 3000, { Categories: { value: 'Cabins|Quality images' } }),
    d: page(4, 'Featured', 2500, { Assessments: { value: 'featured' } }),
    e: page(5, 'Large', 5000),
  } } });
  // Default order is the search's own.
  assert.deepEqual(parsed.candidates.map((c) => c.title), ['Small', 'Huge', 'Quality', 'Featured', 'Large']);
  assert.deepEqual(rankCommons(parsed.candidates).map((c) => c.title), ['Featured', 'Quality', 'Huge', 'Large', 'Small']);
});

test('Pexels results become candidates under the Pexels licence, asked for at about 1920px wide', () => {
  const u = new URL(pexelsUrl('cabin in snow', 'portrait'));
  assert.equal(u.origin + u.pathname, 'https://api.pexels.com/v1/search');
  assert.equal(u.searchParams.get('query'), 'cabin in snow');
  assert.equal(u.searchParams.get('orientation'), 'portrait');
  assert.equal(u.searchParams.get('per_page'), '20');
  assert.equal(new URL(pexelsUrl('x', null)).searchParams.get('orientation'), null);
  const parsed = parsePexels({ photos: [
    { id: 1, width: 4000, height: 3000, url: 'https://www.pexels.com/photo/1/', photographer: 'Ana B', alt: 'A cabin under snow', src: { original: 'https://images.pexels.com/photos/1/p.jpeg' } },
    { id: 2, width: 1600, height: 1200, url: 'https://www.pexels.com/photo/2/', photographer: 'Cy', alt: '', src: { original: 'https://images.pexels.com/photos/2/p.jpeg' } },
    { id: 3, url: 'https://www.pexels.com/photo/3/', src: {} },
    'junk',
  ] });
  assert.equal(parsed.candidates.length, 2);
  const [a, b] = parsed.candidates;
  assert.ok(a && b);
  assert.equal(a.source, 'pexels');
  assert.equal(a.licence, 'Pexels licence');
  assert.equal(a.licenceUrl, 'https://www.pexels.com/license/');
  assert.equal(a.author, 'Ana B');
  assert.equal(a.imageUrl, 'https://images.pexels.com/photos/1/p.jpeg?auto=compress&cs=tinysrgb&w=1920');
  assert.deepEqual([a.width, a.height], [1920, 1440]);
  assert.equal(b.imageUrl, 'https://images.pexels.com/photos/2/p.jpeg');
  assert.equal(b.title, 'Pexels photo 2');
  assert.equal(parsed.skipped.length, 2);
  assert.equal(parsePexels({ error: 'x' }).skipped.length, 1);
});

/** A PNG header of the given size: enough for imageSize to read it. */
function png(width: number, height: number): ArrayBuffer {
  const out = new ArrayBuffer(64);
  const b = Buffer.from(out);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return out;
}

/** Run photos.js main() with fetch mocked: no network. Returns what it printed, the requests made and the out folder. */
async function runMocked(argv: string[], respond: (url: string, init: RequestInit | undefined) => Response, env: Record<string, string | undefined> = {}, outDir?: string) {
  const dir = outDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'argus-photos-'));
  const requests: Array<{ url: string; headers: Record<string, string> }> = [];
  const printed: string[] = [];
  const realFetch = globalThis.fetch;
  const realLog = console.log;
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    requests.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    return respond(url, init);
  }) as typeof fetch;
  console.log = (...a: unknown[]) => void printed.push(a.join(' '));
  try {
    const code = await main([...argv, '--out', dir]);
    return { code, out: printed.join('\n'), requests, dir };
  } finally {
    globalThis.fetch = realFetch;
    console.log = realLog;
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const commonsBody = (files: Array<[string, number, number]>) => ({ query: { pages: Object.fromEntries(files.map(([name, w, h], i) => [String(i), {
  index: i + 1, title: 'File:' + name + '.jpg',
  imageinfo: [{ mime: 'image/png', width: w, height: h, url: 'https://upload.example.org/' + name + '.png', descriptionurl: 'https://commons.example.org/wiki/File:' + name,
    extmetadata: { Artist: { value: 'Commons author' }, LicenseShortName: { value: 'CC BY 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0' } } }],
}])) } });

test('a source that fails is one warning line, and the run carries on with the others', async () => {
  const r = await runMocked(['cabin', '--count', '2'], (url) => {
    if (url.includes('openverse')) return new Response('busy', { status: 503, statusText: 'Service Unavailable' });
    if (url.includes('commons.wikimedia.org')) return json(commonsBody([['Cabin one', 2400, 1600], ['Cabin two', 2000, 1500]]));
    const name = /upload\.example\.org\/(.+)\.png/.exec(url)?.[1] ?? '';
    return new Response(png(name.includes('one') ? 2400 : 2000, name.includes('one') ? 1600 : 1500), { headers: { 'content-type': 'image/png' } });
  }, { PEXELS_API_KEY: undefined });
  try {
    assert.equal(r.code, 0);
    const warnings = r.out.split('\n').filter((l) => l.startsWith('Warning:'));
    assert.deepEqual(warnings, ['Warning: Openverse search failed (it answered 503 Service Unavailable); carrying on with the other sources.']);
    assert.match(r.out, /Search: "cabin"  0 from Openverse, 2 from Wikimedia Commons with a reusable licence/);
    assert.doesNotMatch(r.out, /Left out/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(r.dir, 'credits.json'), 'utf8')).length, 2);
    // No Pexels request without a key.
    assert.ok(!r.requests.some((q) => q.url.includes('pexels')));
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('with PEXELS_API_KEY, Pexels is searched with the key in a header, credited under its licence, and the key is never printed', async () => {
  const key = 'test-key-not-real-123';
  const r = await runMocked(['cabin', '--count', '3', '--orientation', 'landscape', '--json'], (url) => {
    if (url.includes('openverse')) return json({ results: [] });
    if (url.includes('commons.wikimedia.org')) return json({ batchcomplete: '' });
    if (url.startsWith('https://api.pexels.com/')) {
      return json({ photos: [{ id: 7, width: 3840, height: 2560, url: 'https://www.pexels.com/photo/7/', photographer: 'Ana B', alt: 'A cabin', src: { original: 'https://images.pexels.com/photos/7/p.jpeg' } }] });
    }
    return new Response(png(1920, 1280), { headers: { 'content-type': 'image/png' } });
  }, { PEXELS_API_KEY: key });
  try {
    assert.equal(r.code, 0);
    const search = r.requests.find((q) => q.url.startsWith('https://api.pexels.com/v1/search'));
    assert.ok(search);
    assert.equal(search.headers['authorization'], key);
    assert.equal(new URL(search.url).searchParams.get('orientation'), 'landscape');
    assert.ok(!search.url.includes(key), 'the key is not in the address');
    // Only the Pexels search carries the key.
    assert.equal(r.requests.filter((q) => q.headers['authorization']).length, 1);
    assert.ok(!r.out.includes(key), 'the key is not printed');
    const credits = JSON.parse(fs.readFileSync(path.join(r.dir, 'credits.json'), 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(credits.length, 1);
    assert.equal(credits[0]?.['source'], 'pexels');
    assert.equal(credits[0]?.['author'], 'Ana B');
    assert.equal(credits[0]?.['licence'], 'Pexels licence');
    assert.equal(credits[0]?.['sourcePage'], 'https://www.pexels.com/photo/7/');
    assert.ok(!fs.readFileSync(path.join(r.dir, 'credits.json'), 'utf8').includes(key));
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('--min-width leaves out pictures that turn out narrower once downloaded', async () => {
  const r = await runMocked(['cabin', '--count', '5', '--min-width', '2200', '--json'], (url) => {
    if (url.includes('openverse')) return json({ results: [] });
    // Sizes unknown in the search, so the check happens on the downloaded file.
    if (url.includes('commons.wikimedia.org')) return json(commonsBody([['Wide', 0, 0], ['Narrow', 0, 0]]));
    return new Response(png(url.includes('Wide') ? 2400 : 2000, 1500), { headers: { 'content-type': 'image/png' } });
  }, { PEXELS_API_KEY: undefined });
  try {
    const result = JSON.parse(r.out) as { saved: Array<{ title: string }>; skipped: string[] };
    assert.deepEqual(result.saved.map((s) => s.title), ['Wide']);
    assert.ok(result.skipped.some((s) => /"Narrow" skipped, too narrow \(2000x1500, under --min-width 2200px\)/.test(s)));
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

// ---- add: photographs chosen on Unsplash or Pexels ------------------------------------------

const UNSPLASH_PAGE = 'https://unsplash.com/photos/a-mechanic-truing-a-wheel-AbC123xYz';
const unsplashHtml = (licence = 'https://unsplash.com/license'): string => `<!doctype html><html><head>
<meta property="og:title" content="Photo by Ana Ruiz on Unsplash"/>
<meta property="og:url" content="${UNSPLASH_PAGE}"/>
<meta property="og:image" content="https://images.unsplash.com/photo-1?mark=https%3A%2F%2Fimages.unsplash.com%2Fopengraph%2Flogo.png&amp;h=630&amp;w=1200&amp;crop=faces%2Cedges&amp;ixid=abc"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ImageObject","author":{"@type":"Person","name":"Ana Ruiz"},"license":"${licence}",
"contentUrl":"https://images.unsplash.com/photo-1?auto=format&fit=crop&q=60&crop=entropy&fm=jpg&ixid=abc&ixlib=rb-4.1.0","name":"a mechanic truing a wheel"}</script>
</head><body></body></html>`;
const PEXELS_PAGE = 'https://www.pexels.com/photo/dentist-talking-to-a-patient-5355863/';
const pexelsHtml = `<html><head><meta property="og:title" content="Dentist talking to a patient · Free Stock Photo">
<meta property="og:description" content="Photo by Cedric Fauntleroy from Pexels">
<meta property="og:image" content="https://images.pexels.com/photos/5355863/pexels-photo-5355863.jpeg?auto=compress&amp;cs=tinysrgb&amp;h=627&amp;fit=crop&amp;w=1200"></head></html>`;

test('add knows Unsplash and Pexels photo pages by their address, and nothing else', () => {
  assert.equal(photoPageSite(UNSPLASH_PAGE), 'unsplash');
  assert.equal(photoPageSite(PEXELS_PAGE), 'pexels');
  assert.equal(photoPageSite('https://www.pexels.com/de-de/foto/zahnarzt-5355863/'), 'pexels');
  assert.equal(pexelsId(PEXELS_PAGE), '5355863');
  assert.equal(pexelsId('https://www.pexels.com/photo/4098368/'), '4098368');
  for (const bad of ['https://unsplash.com/s/photos/bike', 'http://unsplash.com/photos/x', 'https://www.pexels.com/search/bike/', 'https://example.com/photos/x', 'not a url']) {
    assert.equal(photoPageSite(bad), null, bad);
  }
});

test('add reads the photographer, page and image from JSON-LD and Open Graph, and asks for the size it wants', () => {
  const u = parsePhotoPage(unsplashHtml(), UNSPLASH_PAGE, 'unsplash');
  assert.deepEqual(u, { site: 'unsplash', title: 'a mechanic truing a wheel', author: 'Ana Ruiz', pageUrl: UNSPLASH_PAGE, imageUrl: 'https://images.unsplash.com/photo-1?auto=format&fit=crop&q=60&crop=entropy&fm=jpg&ixid=abc&ixlib=rb-4.1.0' });
  assert.equal(sizedImageUrl('unsplash', typeof u === 'string' ? '' : u.imageUrl, 2000), 'https://images.unsplash.com/photo-1?ixid=abc&ixlib=rb-4.1.0&fm=jpg&q=80&fit=max&w=2000');
  // Open Graph alone: the photographer from the by-line, the social-card crop dropped.
  const p = parsePhotoPage(pexelsHtml, PEXELS_PAGE, 'pexels');
  assert.equal(typeof p === 'string' ? p : p.author, 'Cedric Fauntleroy');
  assert.equal(typeof p === 'string' ? p : p.title, 'Dentist talking to a patient');
  assert.equal(sizedImageUrl('pexels', typeof p === 'string' ? '' : p.imageUrl, 1600), 'https://images.pexels.com/photos/5355863/pexels-photo-5355863.jpeg?auto=compress&cs=tinysrgb&w=1600');
  // An Unsplash+ photograph, and a page that names nobody, cannot be credited under the free licence.
  assert.match(String(parsePhotoPage(unsplashHtml('https://unsplash.com/plus/license'), UNSPLASH_PAGE, 'unsplash')), /not under the Unsplash Licence .*Unsplash\+/);
  assert.match(String(parsePhotoPage('<meta property="og:image" content="https://images.pexels.com/photos/1/a.jpeg">', PEXELS_PAGE, 'pexels')), /does not name the photographer/);
  assert.match(refusedReason('pexels', 403, 'Forbidden'), /^Pexels refused the page \(it answered 403 Forbidden, a check for automated visitors or a rate limit\)\. Open it in a browser .*PEXELS_API_KEY/);
});

test('add <page urls>: one request per page plus the image, a generic User-Agent, credits under the site licence, and a refused page in one line', async () => {
  const r = await runMocked(['add', UNSPLASH_PAGE, 'https://www.pexels.com/photo/4098368/', '--width', '1600'], (url) => {
    if (url === UNSPLASH_PAGE) return new Response(unsplashHtml(), { headers: { 'content-type': 'text/html' } });
    if (url.startsWith('https://www.pexels.com/')) return new Response('<title>Just a moment...</title>', { status: 403, statusText: 'Forbidden' });
    if (url.startsWith('https://images.unsplash.com/')) return new Response(png(1600, 1067), { headers: { 'content-type': 'image/png' } });
    return new Response('unexpected', { status: 500 });
  }, { PEXELS_API_KEY: undefined });
  try {
    assert.equal(r.code, 0);
    assert.deepEqual(r.requests.map((q) => q.url), [UNSPLASH_PAGE, 'https://images.unsplash.com/photo-1?ixid=abc&ixlib=rb-4.1.0&fm=jpg&q=80&fit=max&w=1600', 'https://www.pexels.com/photo/4098368/']);
    for (const q of r.requests) assert.match(q.headers['user-agent'] ?? '', /^argus-skill-photos \(/);
    assert.match(r.out, /^Could not add https:\/\/www\.pexels\.com\/photo\/4098368\/: Pexels refused the page \(it answered 403 Forbidden/m);
    assert.match(r.out, /Added 1 of 2 in /);
    const credits = JSON.parse(fs.readFileSync(path.join(r.dir, 'credits.json'), 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(credits.length, 1);
    const c = credits[0] ?? {};
    assert.match(String(c['file']), /^unsplash-a-mechanic-truing-a-wheel-[0-9a-f]{6}\.png$/);
    assert.deepEqual({ ...c, file: '', sha256: '' }, { file: '', title: 'a mechanic truing a wheel', author: 'Ana Ruiz', source: 'unsplash', sourcePage: UNSPLASH_PAGE,
      licence: 'Unsplash Licence', licenceUrl: 'https://unsplash.com/license', width: 1600, height: 1067, search: '', id: 'unsplash:' + UNSPLASH_PAGE, sha256: '' });
    assert.match(String(c['sha256']), /^[0-9a-f]{64}$/);
    assert.ok(fs.existsSync(path.join(r.dir, String(c['file']))));
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('add writes credits.json entries in the shape search writes, and appends to a search\'s file without disturbing it', async () => {
  const searched = await runMocked(['cabin', '--count', '1'], (url) => {
    if (url.includes('openverse')) return json({ results: [] });
    if (url.includes('commons.wikimedia.org')) return json(commonsBody([['Cabin one', 2400, 1600]]));
    return new Response(png(2400, 1600), { headers: { 'content-type': 'image/png' } });
  }, { PEXELS_API_KEY: undefined });
  const dir = searched.dir;
  try {
    const file = path.join(dir, 'credits.json');
    const before = fs.readFileSync(file, 'utf8');
    const fromSearch = (JSON.parse(before) as Array<Record<string, unknown>>)[0] ?? {};
    const added = await runMocked(['add', UNSPLASH_PAGE], (url) => {
      if (url === UNSPLASH_PAGE) return new Response(unsplashHtml(), { headers: { 'content-type': 'text/html' } });
      return new Response(png(2000, 1333), { headers: { 'content-type': 'image/png' } });
    }, { PEXELS_API_KEY: undefined }, dir);
    assert.equal(added.code, 0, added.out);
    const credits = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(credits.length, 2);
    // The search's entry is kept as it was, first.
    assert.deepEqual(credits[0], fromSearch);
    const fromAdd = credits[1] ?? {};
    // Same keys, in the same order, with the same types.
    assert.deepEqual(Object.keys(fromAdd), Object.keys(fromSearch));
    for (const k of Object.keys(fromSearch)) assert.equal(typeof fromAdd[k], typeof fromSearch[k], k);
    // Same path convention: a bare file name, relative to the folder credits.json is in.
    for (const c of [fromSearch, fromAdd]) {
      assert.equal(path.basename(String(c['file'])), c['file']);
      assert.ok(fs.existsSync(path.join(dir, String(c['file']))));
    }
    assert.equal(fromAdd['sourcePage'], UNSPLASH_PAGE);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('add: with PEXELS_API_KEY, a Pexels photo is read from the API first, never the page, the key only in its header', async () => {
  const key = 'test-key-not-real-456';
  const r = await runMocked(['add', PEXELS_PAGE, '--json'], (url) => {
    if (url === PEXELS_PAGE) return new Response('', { status: 403, statusText: 'Forbidden' });
    if (url === 'https://api.pexels.com/v1/photos/5355863') {
      return json({ id: 5355863, width: 4000, height: 6000, url: PEXELS_PAGE, photographer: 'Cedric Fauntleroy', alt: 'Dentist talking to a patient', src: { original: 'https://images.pexels.com/photos/5355863/pexels-photo-5355863.jpeg' } });
    }
    return new Response(png(2000, 3000), { headers: { 'content-type': 'image/png' } });
  }, { PEXELS_API_KEY: key });
  try {
    assert.equal(r.code, 0);
    assert.deepEqual(r.requests.map((q) => q.url), ['https://api.pexels.com/v1/photos/5355863', 'https://images.pexels.com/photos/5355863/pexels-photo-5355863.jpeg?auto=compress&cs=tinysrgb&w=2000']);
    assert.deepEqual(r.requests.map((q) => q.headers['authorization'] ?? ''), [key, '']);
    assert.ok(!r.out.includes(key));
    const result = JSON.parse(r.out) as { saved: Array<Record<string, unknown>> };
    assert.equal(result.saved[0]?.['licence'], 'Pexels Licence');
    assert.equal(result.saved[0]?.['author'], 'Cedric Fauntleroy');
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('add: a usage error for no address, a bad --width, or search options', () => {
  assert.deepEqual(parseArgs(['add', UNSPLASH_PAGE]).add, [UNSPLASH_PAGE]);
  assert.equal(parseArgs(['add', UNSPLASH_PAGE]).width, 2000);
  assert.equal(parseArgs(['add', UNSPLASH_PAGE, '--width', '1200']).width, 1200);
  assert.deepEqual(parseArgs(['add', UNSPLASH_PAGE, '--width', '9']).bad, ['--width 9 (200 to 6000)']);
  assert.equal(parseArgs(['add', UNSPLASH_PAGE, '--best']).bad.length, 1);
  assert.deepEqual(parseArgs(['add']).add, []);
  // --width is not a search option, and a search is not taken for add.
  assert.deepEqual(parseArgs(['cabin', '--width', '1200']).bad, ['--width']);
  assert.equal(parseArgs(['cabin']).add, null);
});

test('the summary line says why few results remain after --min-width and --best', async () => {
  assert.equal(whyFew({ minWidth: null, best: false, orientation: null, count: 8 }, { narrow: 0, small: 0, shape: 0 }, [], 8), '');
  const r = await runMocked(['cabin', '--count', '5', '--min-width', '2200', '--best'], (url) => {
    if (url.includes('openverse')) return json({ results: [] });
    if (url.includes('commons.wikimedia.org')) return json(commonsBody([['Wide', 2400, 1600], ['Narrow', 2000, 1500], ['Tiny', 900, 600]]));
    return new Response(png(2400, 1600), { headers: { 'content-type': 'image/png' } });
  }, { PEXELS_API_KEY: undefined });
  try {
    assert.match(r.out, /^Search: "cabin"  0 from Openverse, 3 from Wikimedia Commons with a reusable licence; left out 1 narrower than --min-width 2200px, 1 under 1200px on the long side, so 1 of 5 asked for remain; --best: 0 of 3 Commons results are featured, quality or valued images$/m);
    assert.match(r.out, /node photos\.js add <photo-page-url> --out /);
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

// ---- the reworked search: Openverse defaults, sources, filters ------------------------------

test('Openverse asks for large photographs by default, and takes providers, an exclusion, a creator and a page', () => {
  const u = new URL(openverseUrl('dentist', null));
  assert.equal(u.searchParams.get('category'), 'photograph');
  assert.equal(u.searchParams.get('size'), 'large');
  assert.equal(u.searchParams.get('source'), null);
  assert.equal(u.searchParams.get('page'), null);
  const v = new URL(openverseUrl('dentist', 'landscape', { providers: ['stocksnap', 'nappy'], creator: 'Daniel Frank', page: 3, photograph: false, large: false }));
  assert.equal(v.searchParams.get('source'), 'stocksnap,nappy');
  assert.equal(v.searchParams.get('creator'), 'Daniel Frank');
  assert.equal(v.searchParams.get('page'), '3');
  assert.equal(v.searchParams.get('category'), null);
  assert.equal(v.searchParams.get('size'), null);
  assert.equal(v.searchParams.get('aspect_ratio'), 'wide');
  assert.equal(new URL(openverseUrl('x', null, { exclude: ['stocksnap', 'rawpixel'] })).searchParams.get('excluded_source'), 'stocksnap,rawpixel');
  // A named provider list wins over the exclusion; a creator-only search sends no q.
  assert.equal(new URL(openverseUrl('x', null, { providers: ['wordpress'], exclude: ['stocksnap'] })).searchParams.get('excluded_source'), null);
  assert.equal(new URL(openverseUrl('', null, { creator: 'A' })).searchParams.has('q'), false);
});

test('StockSnap and rawpixel results are previews to fetch by hand; Commons originals are asked for at 1920px', () => {
  const s = openverseFile('stocksnap', 'https://cdn.stocksnap.io/img-thumbs/960w/X.jpg', 3888, 2592);
  assert.deepEqual([s.width, s.height], [960, 640]);
  assert.deepEqual(s.byHand && [s.byHand.width, s.byHand.height], [3888, 2592]);
  assert.match(s.byHand?.reason ?? '', /StockSnap/);
  const r = openverseFile('rawpixel', 'https://images.rawpixel.com/editor_1024/abc.jpg', 2800, 3500);
  assert.equal(r.imageUrl, 'https://images.rawpixel.com/editor_1024/abc.jpg', 'never the watermarked image_1300 copy');
  assert.match(r.byHand?.reason ?? '', /watermark/);
  const c = openverseFile('wikimedia', 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Coffee_Flowers.JPG', 4000, 3000);
  assert.equal(c.imageUrl, 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Coffee_Flowers.JPG/1920px-Coffee_Flowers.JPG');
  assert.deepEqual([c.width, c.height, c.byHand], [1920, 1440, undefined]);
  assert.deepEqual(openverseFile('wordpress', 'https://pd.w.org/a-2048x1365.jpg', 2048, 1365), { imageUrl: 'https://pd.w.org/a-2048x1365.jpg', width: 2048, height: 1365 });
  // The same Commons file reached through Openverse and through Commons is one picture.
  assert.equal(sameKey({ imageUrl: c.imageUrl }), sameKey({ imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Coffee_Flowers.JPG/1280px-Coffee_Flowers.JPG' }));
  const parsed = parseOpenverse({ result_count: 70, page_count: 4, results: [
    { title: 'Chair Dentist', url: 'https://cdn.stocksnap.io/img-thumbs/960w/X.jpg', foreign_landing_url: 'https://stocksnap.io/photo/x', creator: 'Daniel Frank', license: 'cc0', license_version: '1.0', width: 3888, height: 2592, source: 'stocksnap' },
  ] });
  assert.equal(parsed.pageCount, 4);
  assert.equal(parsed.total, 70);
  assert.equal(parsed.candidates[0]?.provider, 'stocksnap');
  assert.equal(providerBreakdown([...parsed.candidates, ...parsed.candidates, { ...parsed.candidates[0]!, provider: 'wordpress' }]), ' (2 stocksnap, 1 wordpress)');
});

test('--source chooses sources and Openverse providers; archives only when named; keys only when set', () => {
  assert.deepEqual(planSources(null, { pexels: false, pixabay: false }), { openverse: { providers: null }, commons: true, pexels: false, pixabay: false, archives: [], notes: [] });
  const keyed = planSources(null, { pexels: true, pixabay: true });
  assert.equal(keyed.pexels && keyed.pixabay, true);
  const p = planSources(['stocksnap', 'rawpixel', 'nappy', 'wikimedia'], { pexels: false, pixabay: false });
  assert.deepEqual(p.openverse, { providers: ['stocksnap', 'rawpixel', 'nappy'] });
  assert.equal(p.commons, true);
  const a = planSources(['europeana', 'met', 'pexels'], { pexels: false, pixabay: false });
  assert.equal(a.openverse, null);
  assert.deepEqual(a.archives, ['europeana', 'met']);
  assert.equal(a.pexels, false);
  assert.match(a.notes[0] ?? '', /PEXELS_API_KEY/);
  const c = planSources(['wikimedia', 'cleveland'], { pexels: false, pixabay: false }, 'Ana');
  assert.deepEqual([c.openverse, c.commons, c.archives], [{ providers: null }, false, []]);
  assert.match(c.notes[0] ?? '', /--creator applies to Openverse only/);
  // Parsing: names are checked, commons is wikimedia, unsplash is explained.
  assert.deepEqual(parseArgs(['x', '--source', 'StockSnap,commons']).sources, ['stocksnap', 'wikimedia']);
  assert.match(parseArgs(['x', '--source', 'gettyimages']).bad[0] ?? '', /^--source gettyimages \(not a source/);
  assert.match(parseArgs(['x', '--source', 'unsplash']).bad[0] ?? '', /use add or series/);
  const o = parseArgs(['--creator', 'Daniel Frank', '--page', '2']);
  assert.deepEqual([o.query, o.creator, o.page, o.bad], [null, 'Daniel Frank', 2, []]);
  assert.match(parseArgs(['x', '--page', '13']).bad[0] ?? '', /--page 13/);
});

test('the summary line counts what each filter left out', () => {
  assert.equal(filterOf('openverse: "a" licence is missing or not clearly reusable (by-nc)'), 'licence');
  assert.equal(filterOf('met: "a" licence is missing or not clearly reusable (not public domain)'), 'licence');
  assert.equal(filterOf('wikimedia: "a" is image/tiff, not a photograph format'), 'format');
  assert.equal(filterOf('too small (900x600, under 1200px on the long side)'), 'small');
  assert.equal(filterOf('the file answered 403'), null);
  assert.equal(whyFew({ minWidth: null, best: false, orientation: 'landscape', count: 8 }, { narrow: 0, small: 2, shape: 1, licence: 3, preview: 6, format: 1, failed: 1 }, [], 4),
    '; left out 3 refused for their licence, 6 only as a small preview (full size by hand, listed below), 2 under 1200px on the long side, 1 not landscape, 1 not in a photograph format, 1 that would not download, so 4 of 8 asked for remain');
});

test('a search lists previews by hand, widens Openverse when short, and counts per source and per filter', async () => {
  const r = await runMocked(['dentist', '--count', '2'], (url) => {
    const u = new URL(url);
    if (u.hostname === 'api.openverse.org' && u.searchParams.get('category') === 'photograph') {
      return json({ result_count: 2, page_count: 1, results: [
        { title: 'Chair Dentist', url: 'https://cdn.stocksnap.io/img-thumbs/960w/X.jpg', foreign_landing_url: 'https://stocksnap.io/photo/x', creator: 'Daniel Frank', license: 'cc0', width: 3888, height: 2592, source: 'stocksnap' },
        { title: 'Drill', url: 'https://x.example.org/d.jpg', foreign_landing_url: 'https://x.example.org/d', creator: 'Z', license: 'by-nc', width: 3000, height: 2000, source: 'flickr' },
      ] });
    }
    if (u.hostname === 'api.openverse.org') {
      assert.equal(u.searchParams.get('excluded_source'), 'stocksnap,rawpixel');
      return json({ result_count: 1, page_count: 1, results: [{ title: 'Dental room', url: 'https://pd.w.org/room-2048x1365.png', foreign_landing_url: 'https://wordpress.org/photos/photo/1/', creator: 'W', license: 'cc0', width: 2048, height: 1365, source: 'wordpress' }] });
    }
    if (u.hostname === 'commons.wikimedia.org') return json(commonsBody([['Clinic', 2400, 1600]]));
    return new Response(png(2048, 1365), { headers: { 'content-type': 'image/png' } });
  }, { PEXELS_API_KEY: undefined, PIXABAY_API_KEY: undefined });
  try {
    assert.equal(r.code, 0);
    assert.match(r.out, /^Search: "dentist"  2 from Openverse \(1 stocksnap, 1 wordpress\), 1 from Wikimedia Commons with a reusable licence; left out 1 refused for their licence, 1 only as a small preview \(full size by hand, listed below\), so 2 of 2 asked for remain$/m);
    assert.match(r.out, /Openverse had 2 large photographs for "dentist"; widened/);
    assert.match(r.out, /Full size by hand \(StockSnap: .*\n  3888x2592 +CC0 +Daniel Frank +https:\/\/stocksnap\.io\/photo\/x/);
    assert.ok(!r.requests.some((q) => q.url.includes('cdn.stocksnap.io')), 'previews are not downloaded');
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('--best adds a Commons search limited to quality and featured pictures', () => {
  const u = new URL(commonsUrl('cabin', true, { rated: true, page: 2 }));
  assert.equal(u.searchParams.get('gsrsearch'), 'cabin filetype:bitmap ' + COMMONS_RATED);
  assert.equal(u.searchParams.get('gsroffset'), '30');
  assert.equal(COMMONS_RATED, 'incategory:Quality_images|Featured_pictures_on_Wikimedia_Commons');
});

test('Pexels collection and photo addresses, and Pixabay with editors\' choice and min_width', () => {
  assert.equal(pexelsCollectionUrl('abc123', 2), 'https://api.pexels.com/v1/collections/abc123?type=photos&per_page=80&page=2');
  assert.equal(pexelsPhotoUrl('42'), 'https://api.pexels.com/v1/photos/42');
  assert.equal(new URL(pexelsUrl('x', null, 3, 80)).searchParams.get('page'), '3');
  const coll = parsePexels({ media: [{ type: 'Video', id: 1 }, { type: 'Photo', id: 2, width: 3000, height: 2000, url: 'https://www.pexels.com/photo/2/', photographer: 'Ana', src: { original: 'https://images.pexels.com/photos/2/p.jpeg' } }] });
  assert.deepEqual(coll.candidates.map((c) => c.author), ['Ana']);
  const u = new URL(pixabayUrl('chillies', 'k', { orientation: 'landscape', minWidth: 1800, best: true, page: 2 }));
  assert.deepEqual([u.searchParams.get('editors_choice'), u.searchParams.get('min_width'), u.searchParams.get('orientation'), u.searchParams.get('image_type'), u.searchParams.get('page')], ['true', '1800', 'horizontal', 'photo', '2']);
  assert.equal(new URL(pixabayUrl('x', 'k', { orientation: null, minWidth: null, best: false, page: 1 })).searchParams.get('editors_choice'), null);
  const p = parsePixabay({ hits: [{ id: 1, pageURL: 'https://pixabay.com/photos/x-1/', tags: 'chilli, red', largeImageURL: 'https://pixabay.com/get/x_1280.jpg', imageWidth: 6000, imageHeight: 4000, user: 'Bo' }, { id: 2 }] });
  assert.deepEqual(p.candidates.map((c) => [c.licence, c.author, c.width, c.height]), [['Pixabay Content Licence', 'Bo', 1280, 853]]);
  assert.equal(p.skipped.length, 1);
});

test('with PIXABAY_API_KEY, Pixabay is searched and the key, which Pixabay takes in the address, is never printed', async () => {
  const key = 'pixabay-test-key-789';
  const r = await runMocked(['chilli', '--count', '1', '--source', 'pixabay'], (url) => {
    if (url.startsWith('https://pixabay.com/api/')) return new Response('nope ' + url, { status: 400, statusText: 'Bad Request ' + url });
    return new Response('x', { status: 500 });
  }, { PIXABAY_API_KEY: key });
  try {
    assert.ok(r.requests.some((q) => q.url.includes('key=' + key)));
    assert.match(r.out, /Pixabay search failed/);
    assert.ok(!r.out.includes(key), 'the key is not printed');
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('open archives: addresses and parsing keep only openly licensed images', () => {
  const e = new URL(europeanaUrl('bicycle', 2));
  assert.deepEqual([e.searchParams.get('reusability'), e.searchParams.get('wskey'), e.searchParams.get('start'), e.searchParams.get('qf')], ['open', 'api2demo', '21', 'TYPE:IMAGE']);
  const c = new URL(clevelandUrl('teapot'));
  assert.deepEqual([c.searchParams.get('cc0'), c.searchParams.get('has_image')], ['1', '1']);
  assert.equal(new URL(metSearchUrl('teapot', 2)).pathname, '/public/collection/v1.1/search');
  assert.equal(new URL(metSearchUrl('teapot', 2)).searchParams.get('offset'), '20');
  assert.equal(metObjectUrl(8356), 'https://collectionapi.metmuseum.org/public/collection/v1/objects/8356');
  assert.equal(new URL(nasaUrl('moon')).searchParams.get('media_type'), 'image');
  assert.match(new URL(smithsonianUrl('bicycle')).searchParams.get('q') ?? '', /^bicycle AND online_media_type:Images AND media_usage:CC0$/);

  assert.deepEqual(licenceFromUrl('http://creativecommons.org/publicdomain/zero/1.0/')?.code, 'cc0');
  assert.deepEqual(licenceFromUrl('http://creativecommons.org/licenses/by-sa/4.0/')?.name, 'CC BY-SA 4.0');
  assert.equal(licenceFromUrl('http://rightsstatements.org/vocab/InC/1.0/'), null);
  const eu = parseEuropeana({ items: [
    { title: ['Bicycle'], rights: ['http://creativecommons.org/publicdomain/zero/1.0/'], edmIsShownBy: ['https://m.example.org/a.jpg'], guid: 'https://www.europeana.eu/item/1/a?utm_source=api', dataProvider: ['A museum'] },
    { title: ['Shut'], rights: ['http://creativecommons.org/licenses/by-nc/4.0/'], edmIsShownBy: ['https://m.example.org/b.jpg'], guid: 'https://www.europeana.eu/item/1/b' },
  ] });
  assert.deepEqual(eu.candidates.map((x) => [x.title, x.author, x.pageUrl, x.licence]), [['Bicycle', 'A museum', 'https://www.europeana.eu/item/1/a', 'CC0 1.0']]);
  assert.equal(filterOf(eu.skipped[0] ?? ''), 'licence');
  const cl = parseCleveland({ data: [
    { title: 'Teapot', share_license_status: 'CC0', url: 'https://clevelandart.org/art/1', creators: [{ description: 'Nathaniel Hurd' }], images: { print: { url: 'https://openaccess-cdn.clevelandart.org/1_print.jpg', width: '3400', height: '2248' } } },
    { title: 'Kept', share_license_status: 'Copyrighted', url: 'https://clevelandart.org/art/2', images: {} },
  ] });
  assert.deepEqual(cl.candidates.map((x) => [x.author, x.width, x.imageUrl]), [['Nathaniel Hurd', 3400, 'https://openaccess-cdn.clevelandart.org/1_print.jpg']]);
  const met = parseMetObject({ isPublicDomain: true, primaryImage: 'https://images.metmuseum.org/a.jpg', objectURL: 'https://www.metmuseum.org/art/collection/search/1', title: 'Teapot', artistDisplayName: '' , culture: 'American' });
  assert.equal(typeof met === 'string' ? met : met.author, 'American');
  assert.match(String(parseMetObject({ isPublicDomain: false, title: 'Lent' })), /not public domain/);
  const nasa = parseNasa({ collection: { items: [{ data: [{ nasa_id: 'PIA1', title: 'Moon', center: 'JPL' }], links: [{ href: 'http://images-assets.nasa.gov/image/PIA1/PIA1~medium.jpg' }] }, { data: [{ nasa_id: 'X' }], links: [{ href: 'https://x/a.tif' }] }] } });
  assert.deepEqual(nasa.candidates.map((x) => [x.imageUrl, x.author, x.pageUrl]), [['https://images-assets.nasa.gov/image/PIA1/PIA1~orig.jpg', 'NASA JPL', 'https://images.nasa.gov/details/PIA1']]);
  const si = parseSmithsonian({ response: { rows: [
    { title: 'Woman on Bicycle', content: { descriptiveNonRepeating: { record_link: 'https://americanart.si.edu/x', data_source: 'SAAM', online_media: { media: [{ type: 'Images', usage: { access: 'CC0' }, content: 'https://ids.si.edu/ids/deliveryService?id=A',
      resources: [{ label: 'High-resolution JPEG', url: 'https://ids.si.edu/ids/download?id=A.jpg', width: 3000, height: 2000 }] }] } } } },
    { title: 'No media', content: { descriptiveNonRepeating: {} } },
  ] } });
  assert.deepEqual(si.candidates.map((x) => [x.imageUrl, x.author, x.width]), [['https://ids.si.edu/ids/download?id=A.jpg', 'SAAM', 3000]]);
  assert.equal(si.skipped.length, 1);
});

// ---- series ---------------------------------------------------------------------------------

test('series knows Unsplash profiles and photos, Pexels photos, profiles and collections, and Openverse images', () => {
  assert.deepEqual(seriesTarget('https://unsplash.com/@tonchik'), { kind: 'unsplash-user', user: 'tonchik' });
  assert.deepEqual(seriesTarget(UNSPLASH_PAGE), { kind: 'unsplash-photo', url: UNSPLASH_PAGE });
  assert.deepEqual(seriesTarget(PEXELS_PAGE), { kind: 'pexels-photo', url: PEXELS_PAGE, id: '5355863' });
  assert.deepEqual(seriesTarget('https://www.pexels.com/@cedric-fauntleroy/'), { kind: 'pexels-user', url: 'https://www.pexels.com/@cedric-fauntleroy/' });
  assert.deepEqual(seriesTarget('https://www.pexels.com/collections/dental-ab12cd/'), { kind: 'pexels-collection', url: 'https://www.pexels.com/collections/dental-ab12cd/', id: 'ab12cd' });
  assert.deepEqual(seriesTarget('https://openverse.org/image/29308dd1-59c4-4e30-973d-9a0b2e772e60'), { kind: 'openverse-image', id: '29308dd1-59c4-4e30-973d-9a0b2e772e60' });
  for (const bad of ['http://unsplash.com/@x', 'https://example.com/@x', 'https://unsplash.com/s/photos/bike', 'nope']) assert.equal(seriesTarget(bad), null, bad);
  const o = parseArgs(['series', 'https://unsplash.com/@tonchik', '--limit', '6', '--out', 'set']);
  assert.deepEqual([o.command, o.target, o.limit, o.out, o.bad], ['series', 'https://unsplash.com/@tonchik', 6, 'set', []]);
  assert.match(parseArgs(['series', 'x', '--limit', '99']).bad[0] ?? '', /--limit 99/);
  assert.deepEqual(parseArgs(['series', 'x', '--best']).bad, ['--best']);
});

test('an Unsplash profile page lists its photographs once each, leaving out Unsplash+ and sponsored listings', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'photos', 'unsplash-user.html'), 'utf8');
  const listed = parseUnsplashUserPage(html, 'anaruiz');
  assert.equal(listed.name, 'Ana Ruiz');
  assert.deepEqual(listed.photos.map((p) => p.pageUrl), ['https://unsplash.com/photos/AAAAAAAAAAA', 'https://unsplash.com/photos/a-wheel-being-trued-BBBBBBBBBBB']);
  assert.deepEqual(listed.refused.map((p) => p.reason), ['an Unsplash+ photograph (plus.unsplash.com)', 'a sponsored or promoted listing']);
  assert.equal(unsplashUserFromPhotoPage(html), 'anaruiz');
  assert.equal(unsplashUserFromPhotoPage('<a href="/@unsplash">x</a>'), null);
  // A photo page whose file comes from plus.unsplash.com is refused even without a licence field.
  const plus = unsplashHtml().replace(/"license":"[^"]*",/, '').replace(/https:\/\/images\.unsplash\.com\/photo-1\?auto/, 'https://plus.unsplash.com/premium_photo-1?auto');
  assert.match(String(parsePhotoPage(plus, UNSPLASH_PAGE, 'unsplash')), /Unsplash\+ .*plus\.unsplash\.com/);
});

test('series from an Unsplash profile: one request at a time, only that photographer, credits in the same shape as search and add', async () => {
  const profile = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'photos', 'unsplash-user.html'), 'utf8');
  const photoPage = (author: string) => unsplashHtml().replace(/Ana Ruiz/g, author);
  let inFlight = 0;
  let most = 0;
  const answer = (url: string): Response => {
    if (url === 'https://unsplash.com/@anaruiz') return new Response(profile, { headers: { 'content-type': 'text/html' } });
    if (url === 'https://unsplash.com/photos/AAAAAAAAAAA') return new Response(photoPage('Someone Else'), { headers: { 'content-type': 'text/html' } });
    if (url.startsWith('https://unsplash.com/photos/')) return new Response(photoPage('Ana Ruiz'), { headers: { 'content-type': 'text/html' } });
    return new Response(png(2000, 1333), { headers: { 'content-type': 'image/png' } });
  };
  // Each answer takes 20ms; a second request while one is open would show as two in flight.
  const r = await runMocked(['series', 'https://unsplash.com/@anaruiz', '--limit', '2'], ((url: string) => {
    inFlight++;
    most = Math.max(most, inFlight);
    return new Promise<Response>((resolve) => setTimeout(() => {
      inFlight--;
      resolve(answer(url));
    }, 20));
  }) as unknown as (url: string) => Response, { PEXELS_API_KEY: undefined });
  try {
    assert.equal(r.code, 0, r.out);
    assert.equal(most, 1, 'never two requests at once');
    for (const q of r.requests) assert.match(q.headers['user-agent'] ?? '', /^argus-skill-photos \(/);
    assert.ok(!r.requests.some((q) => q.url.includes('plus.unsplash.com') || q.url.includes('CCCCCCCCCCC') || q.url.includes('DDDDDDDDDDD') || q.url.includes('/napi/')));
    assert.match(r.out, /AAAAAAAAAAA: by Someone Else, not Ana Ruiz/);
    const credits = JSON.parse(fs.readFileSync(path.join(r.dir, 'credits.json'), 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(credits.length, 1);
    const shape = Object.keys(creditFor({ title: '', author: '', source: 'openverse', pageUrl: '', licence: '', licenceUrl: '' }, 'f', null, ''));
    assert.deepEqual(Object.keys(credits[0] ?? {}), [...shape, 'id', 'sha256']);
    assert.equal(credits[0]?.['licence'], 'Unsplash Licence');
    assert.equal(credits[0]?.['search'], 'series https://unsplash.com/@anaruiz');
    assert.match(String(credits[0]?.['file']), /^anaruiz-/);
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('series from Pexels without a key says plainly that a bot check blocked it; with a key it uses the API', async () => {
  const blocked = await runMocked(['series', 'https://www.pexels.com/@cedric-fauntleroy/'], () => new Response('<title>Just a moment...</title>', { status: 403, statusText: 'Forbidden' }), { PEXELS_API_KEY: undefined });
  try {
    assert.equal(blocked.code, 2);
    assert.match(blocked.out, /Pexels put a check for automated visitors in front of .* Argus does not get round such checks\. Set PEXELS_API_KEY/);
  } finally {
    fs.rmSync(blocked.dir, { recursive: true, force: true });
  }
  const key = 'pexels-series-key-321';
  const photo = (id: number, who: number, name: string) => ({ id, width: 3000, height: 2000, url: `https://www.pexels.com/photo/${id}/`, photographer: name, photographer_id: who, alt: 'Dentist talking to a patient', src: { original: `https://images.pexels.com/photos/${id}/p.jpeg` } });
  const r = await runMocked(['series', PEXELS_PAGE, '--limit', '3', '--json'], (url) => {
    if (url === 'https://api.pexels.com/v1/photos/5355863') return json(photo(5355863, 7, 'Cedric Fauntleroy'));
    if (url.startsWith('https://api.pexels.com/v1/search')) return json({ photos: [photo(1, 7, 'Cedric Fauntleroy'), photo(2, 9, 'Other'), photo(3, 7, 'Cedric Fauntleroy')] });
    return new Response(png(1920, 1280), { headers: { 'content-type': 'image/png' } });
  }, { PEXELS_API_KEY: key });
  try {
    assert.equal(r.code, 0, r.out);
    const result = JSON.parse(r.out) as { saved: Array<Record<string, unknown>>; notes: string[] };
    assert.deepEqual(result.saved.map((s) => s['sourcePage']), ['https://www.pexels.com/photo/5355863/', 'https://www.pexels.com/photo/1/', 'https://www.pexels.com/photo/3/']);
    assert.ok(result.saved.every((s) => s['author'] === 'Cedric Fauntleroy' && s['licence'] === 'Pexels licence'));
    assert.ok(!r.requests.some((q) => q.url.startsWith('https://www.pexels.com/')), 'no page requests with a key');
    assert.ok(r.requests.filter((q) => q.headers['authorization']).every((q) => q.url.startsWith('https://api.pexels.com/')));
    assert.ok(!r.out.includes(key));
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

test('series --creator asks Openverse for that creator, keeps exact names only, and writes the same credit shape as search', async () => {
  const r = await runMocked(['series', '--creator', 'Ana Ruiz', '--limit', '2'], (url) => {
    if (url.startsWith('https://api.openverse.org/')) {
      const u = new URL(url);
      assert.equal(u.searchParams.get('creator'), 'Ana Ruiz');
      assert.equal(u.searchParams.has('q'), false);
      return json({ result_count: 3, page_count: 1, results: [
        { title: 'One', url: 'https://pd.w.org/1.png', foreign_landing_url: 'https://wordpress.org/photos/photo/1/', creator: 'Ana Ruiz', license: 'cc0', width: 2048, height: 1365, source: 'wordpress' },
        { title: 'Two', url: 'https://pd.w.org/2.png', foreign_landing_url: 'https://wordpress.org/photos/photo/2/', creator: 'Ana Ruizova', license: 'cc0', width: 2048, height: 1365, source: 'wordpress' },
        { title: 'Three', url: 'https://cdn.stocksnap.io/img-thumbs/960w/T.jpg', foreign_landing_url: 'https://stocksnap.io/photo/t', creator: 'Ana Ruiz', license: 'cc0', width: 4000, height: 3000, source: 'stocksnap' },
      ] });
    }
    return new Response(png(2048, 1365), { headers: { 'content-type': 'image/png' } });
  }, { PEXELS_API_KEY: undefined });
  try {
    assert.equal(r.code, 0, r.out);
    const credits = JSON.parse(fs.readFileSync(path.join(r.dir, 'credits.json'), 'utf8')) as Array<Record<string, unknown>>;
    assert.deepEqual(credits.map((c) => c['title']), ['One']);
    assert.deepEqual(Object.keys(credits[0] ?? {}), ['file', 'title', 'author', 'source', 'sourcePage', 'licence', 'licenceUrl', 'width', 'height', 'search', 'id', 'sha256']);
    assert.match(r.out, /Full size by hand .*\n.*https:\/\/stocksnap\.io\/photo\/t/);
  } finally {
    fs.rmSync(r.dir, { recursive: true, force: true });
  }
});

// ---- sheet, grade, deliver, cutout ----------------------------------------------------------

test('the local commands read their arguments, and each has its own help', () => {
  const g = parseArgs(['grade', 'pics', '--look', 'duotone', '--ink', '1F2A44', '--paper', '#fed']);
  assert.deepEqual([g.command, g.target, g.look, g.ink, g.paper, g.bad], ['grade', 'pics', 'duotone', '#1f2a44', '#ffeedd', []]);
  assert.match(parseArgs(['grade', 'pics']).bad[0] ?? '', /--look .* is needed/);
  assert.match(parseArgs(['grade', 'pics', '--look', 'sepia']).bad[0] ?? '', /--look sepia/);
  assert.match(parseArgs(['grade', 'pics', '--look', 'warm', '--ink', '#000']).bad.join(), /--ink and --paper are for mono and duotone/);
  const d = parseArgs(['deliver', 'pics', '--widths', '1600,640,640', '--sizes', '50vw', '--hero', 'x/a.jpg']);
  assert.deepEqual([d.widths, d.sizes, d.hero, d.outGiven], [[640, 1600], '50vw', 'a.jpg', false]);
  assert.match(parseArgs(['deliver', 'pics', '--widths', '640,huge']).bad[0] ?? '', /--widths 640,huge/);
  const c = parseArgs(['cutout', 'a.jpg', '--tolerance', '20', '--feather', '0', '--method', 'canvas']);
  assert.deepEqual([c.target, c.tolerance, c.feather, c.method], ['a.jpg', 20, 0, 'canvas']);
  assert.deepEqual(parseArgs(['sheet', 'a', 'b']).bad, ['one folder only (also given: b)']);
  assert.deepEqual(parseArgs(['sheet', 'a', '--look', 'mono']).bad, ['--look', 'one folder only (also given: mono)']);
  assert.equal(parseArgs(['sheet', '--help']).help, true);
  for (const k of Object.keys(USAGES) as Array<keyof typeof USAGES>) assert.match(USAGES[k][0] ?? '', /^Usage: node photos\.js/);
});

test('--help for every command prints that command\'s usage and exits 0', async () => {
  for (const cmd of ['add', 'series', 'sheet', 'sharp', 'grade', 'deliver', 'cutout']) {
    const printed: string[] = [];
    const real = console.log;
    console.log = (...a: unknown[]) => void printed.push(a.join(' '));
    try {
      assert.equal(await main([cmd, '--help']), 0);
    } finally {
      console.log = real;
    }
    assert.match(printed.join('\n'), new RegExp('^Usage: node photos\\.js ' + cmd));
  }
});

test('grade, deliver and cutout refuse to write over the originals, and need what they work on', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-photos-local-'));
  const real = console.log;
  const printed: string[] = [];
  console.log = (...a: unknown[]) => void printed.push(a.join(' '));
  try {
    fs.writeFileSync(path.join(dir, 'a.png'), Buffer.from(png(1600, 1000)));
    assert.equal(await main(['grade', dir, '--look', 'mono', '--out', dir]), 1);
    assert.equal(await main(['deliver', dir, '--out', dir]), 1);
    assert.equal(await main(['cutout', path.join(dir, 'a.png'), '--out', path.join(dir, 'a.png')]), 1);
    assert.equal(await main(['sheet', path.join(dir, 'missing')]), 1);
    assert.equal(await main(['deliver', dir, '--hero', 'b.jpg']), 1);
    assert.match(printed.join('\n'), /never writes over the originals[\s\S]*another folder[\s\S]*never writes over the original\.[\s\S]*Not a folder[\s\S]*--hero b\.jpg is not one of/);
    // The folder listing leaves out a contact sheet and files that are not photographs.
    fs.writeFileSync(path.join(dir, 'sheet.jpg'), 'x');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
    fs.writeFileSync(path.join(dir, 'b.avif'), 'x');
    assert.deepEqual(listImages(dir), ['a.png']);
    assert.deepEqual(listImages(dir, /\.avif$/i), ['a.png', 'b.avif']);
  } finally {
    console.log = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('grades: the colours recorded, and the ImageMagick arguments for the faster path', () => {
  assert.deepEqual(gradeNote('mono', null, null), { look: 'mono', ink: '#1b1a18', paper: '#f4f2ee' });
  assert.deepEqual(gradeNote('duotone', '#000000', null), { look: 'duotone', ink: '#000000', paper: '#f1e6d2' });
  assert.deepEqual(gradeNote('warm', '#000000', '#ffffff'), { look: 'warm' });
  assert.deepEqual(magickGradeArgs('in.jpg', 'out.jpg', { look: 'warm' }), ['in.jpg', '-modulate', '100,85,100', '-color-matrix', '1.05 0 0 0 1 0 0 0 0.92', '-quality', '90', 'out.jpg']);
  const mono = magickGradeArgs('in.jpg', 'out.jpg', gradeNote('mono', null, null));
  assert.ok(mono.includes('gradient:#1b1a18-#f4f2ee') && mono.includes('-clut') && mono.includes('3x50%'));
});

test('deliver writes <picture> markup with AVIF, WebP and JPEG, real sizes and the placeholder colour, and checks the budgets', () => {
  const v = (w: number, format: string, kb: number) => ({ file: `a-${w}.${format}`, format, width: w, height: Math.round(w * 0.75), bytes: kb * 1024 });
  const variants = [v(640, 'avif', 30), v(640, 'webp', 40), v(640, 'jpg', 60), v(1600, 'avif', 110), v(1600, 'webp', 150), v(1600, 'jpg', 260), v(2400, 'avif', 200), v(2400, 'webp', 280), v(2400, 'jpg', 400)];
  const html = pictureMarkup('img/', variants, '#8a7f70', '(min-width: 64rem) 50vw, 100vw', false);
  assert.equal(html, [
    '<picture>',
    '  <source type="image/avif" srcset="img/a-640.avif 640w, img/a-1600.avif 1600w, img/a-2400.avif 2400w" sizes="(min-width: 64rem) 50vw, 100vw">',
    '  <source type="image/webp" srcset="img/a-640.webp 640w, img/a-1600.webp 1600w, img/a-2400.webp 2400w" sizes="(min-width: 64rem) 50vw, 100vw">',
    '  <img src="img/a-1600.jpg" srcset="img/a-640.jpg 640w, img/a-1600.jpg 1600w, img/a-2400.jpg 2400w" sizes="(min-width: 64rem) 50vw, 100vw" width="2400" height="1800" alt="" loading="lazy" decoding="async" style="background-color:#8a7f70">',
    '</picture>',
  ].join('\n'));
  assert.match(pictureMarkup('', variants, '#000', '100vw', true), /fetchpriority="high" decoding/);
  assert.doesNotMatch(pictureMarkup('', variants, '#000', '100vw', true), /loading="lazy"/);
  assert.equal(budgetLine(variants, false), '640w 30 KB avif, 1600w 110 KB avif, 2400w 200 KB avif - over the budget 120 KB from 2400w; serve at most 1600w at this size, or crop');
  assert.equal(budgetLine(variants, true), '640w 30 KB avif, 1600w 110 KB avif, 2400w 200 KB avif - all within the hero budget 250 KB');
});

// A minimal AVIF box structure: ftyp, meta (hdlr, iprp/ipco with the given properties), mdat.
function box(type: string, ...body: Buffer[]): Buffer {
  const b = Buffer.concat(body);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + b.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, b]);
}
function fakeAvif(o: { brand?: string; channels?: number; icc?: string | null; skip?: string } = {}): Buffer {
  const full = (...b: Buffer[]) => Buffer.concat([Buffer.alloc(4), ...b]);
  const ftyp = box('ftyp', Buffer.from((o.brand ?? 'avif') + '\0\0\0\0' + 'mif1miaf' + (o.brand ?? 'avif'), 'latin1'));
  const ispe = box('ispe', full(Buffer.from([0, 0, 2, 128, 0, 0, 1, 104])));
  const ch = o.channels ?? 3;
  const pixi = box('pixi', full(Buffer.from([ch, ...Array(ch).fill(8)])));
  const av1C = box('av1C', Buffer.from([0x81, 1, 12, 0]));
  const icc = Buffer.alloc(128);
  icc.write((o.icc ?? 'RGB ').padEnd(4), 16, 'latin1');
  const colr = o.icc === null ? box('colr', Buffer.from('nclx', 'latin1'), Buffer.from([0, 1, 0, 13, 0, 1, 0x80])) : box('colr', Buffer.from('prof', 'latin1'), icc);
  const props = [colr, ispe, pixi, av1C].filter((b) => b.toString('latin1', 4, 8) !== o.skip);
  const meta = box('meta', full(box('hdlr', full(Buffer.alloc(4), Buffer.from('pict', 'latin1'), Buffer.alloc(13))), box('iprp', box('ipco', ...props))));
  return Buffer.concat([ftyp, meta, box('mdat', Buffer.alloc(200, 7))]);
}

test('an AVIF is kept only when its structure is sound: brand, properties, data, and a colour profile that fits the pixels', () => {
  assert.equal(avifProblem(fakeAvif()), null);
  assert.equal(avifProblem(fakeAvif({ icc: null })), null);
  assert.equal(avifProblem(fakeAvif({ channels: 1, icc: 'GRAY' })), null);
  // What sips wrote from a greyscale or CMYK original: Chrome refuses it and the <picture> shows nothing.
  assert.equal(avifProblem(fakeAvif({ icc: 'GRAY' })), 'a GRAY colour profile on a 3-channel picture');
  assert.equal(avifProblem(fakeAvif({ icc: 'CMYK' })), 'a CMYK colour profile on a 3-channel picture');
  assert.match(avifProblem(fakeAvif({ brand: 'heic' })) ?? '', /not branded avif/);
  assert.equal(avifProblem(fakeAvif({ skip: 'av1C' })), 'no av1C property');
  assert.equal(avifProblem(fakeAvif({ skip: 'ispe' })), 'no ispe property');
  assert.equal(avifProblem(Buffer.alloc(0)), 'empty or truncated');
  assert.equal(avifProblem(fakeAvif().subarray(0, 60)), 'no meta box');
});

test('the contact sheet shows every file with its name, size and author', () => {
  const html = sheetHtml([{ name: 'a&b.jpg', src: 'a%26b.jpg', width: 4000, height: 3000, author: 'Ana <Ruiz>' }, { name: 'c.avif', src: 'c.avif', width: null, height: null }], 4, 'Two');
  assert.match(html, /<b>a&amp;b\.jpg<\/b><span class="size">4000×3000<\/span><span>Ana &lt;Ruiz&gt;<\/span>/);
  assert.match(html, /grid-template-columns:repeat\(4,360px\)/);
  assert.match(html, /naturalWidth/, 'sizes it could not read are filled in by the page');
  assert.deepEqual(groupByAuthor([{ author: 'B' }, { author: 'A' }, { author: 'B' }]).map((x) => x.author), ['B', 'B', 'A']);
});

// ---- sharp ----------------------------------------------------------------------------------

test('sharp takes a file or a folder and a display width; its flags are warnings with stated levels', () => {
  const o = parseArgs(['sharp', 'pics']);
  assert.deepEqual([o.command, o.target, o.width, o.bad], ['sharp', 'pics', SHARP_WIDTH, []]);
  assert.equal(parseArgs(['sharp', 'a.jpg', '--width', '640']).width, 640);
  assert.deepEqual(parseArgs(['sharp', 'a', 'b']).bad, ['one file or folder only (also given: b)']);
  assert.deepEqual(sharpVerdict({ sharpness: SOFT_BELOW - 1, brightness: DARK_BELOW - 1 }), ['likely soft', 'likely dark']);
  assert.deepEqual(sharpVerdict({ sharpness: SOFT_BELOW, brightness: DARK_BELOW }), []);
  assert.match(USAGES.sharp.join(' '), /warnings/);
});

const browserSkip = findBrowser() ? false : 'no Chrome-family browser installed';

test('sharp flags a flat, dark picture and passes a detailed, well-lit one; deliver needs no credits.json', { skip: browserSkip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-sharp-'));
  const printed: string[] = [];
  const real = console.log;
  try {
    const w = 800;
    const h = 600;
    const detailed = Buffer.alloc(w * h * 3);
    const flat = Buffer.alloc(w * h * 3);
    let seed = 7;
    for (let i = 0; i < w * h; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const v = 90 + ((seed >>> 16) % 140);
      detailed.fill(v, i * 3, i * 3 + 3);
      flat.fill(30 + Math.round((i % w) / w * 10), i * 3, i * 3 + 3);
    }
    fs.writeFileSync(path.join(dir, 'detailed.png'), encodePng({ width: w, height: h, channels: 3, data: detailed }));
    fs.writeFileSync(path.join(dir, 'flat.png'), encodePng({ width: w, height: h, channels: 3, data: flat }));
    console.log = (...a: unknown[]) => void printed.push(a.join(' '));
    assert.equal(await main(['sharp', dir, '--json']), 0);
    const r = JSON.parse(printed.join('\n')) as { images: Array<{ file: string; flags: string[]; sharpness: number; brightness: number }> };
    const by = (f: string) => r.images.find((x) => x.file === f)!;
    assert.deepEqual(by('detailed.png').flags, [], JSON.stringify(by('detailed.png')));
    assert.deepEqual(by('flat.png').flags, ['likely soft', 'likely dark'], JSON.stringify(by('flat.png')));
    printed.length = 0;
    assert.equal(await main(['sharp', path.join(dir, 'flat.png')]), 0);
    assert.match(printed.join('\n'), /flat\.png .*LIKELY SOFT, LIKELY DARK[\s\S]*Open each at the size it will be shown/);
    // deliver on a folder with no credits.json: works, starts one, and names the uncredited files.
    printed.length = 0;
    assert.ok(!fs.existsSync(path.join(dir, 'credits.json')));
    // A greyscale original too: sips used to carry its grey profile into a colour AVIF that Chrome will not decode.
    const gw = 640;
    const gh = 480;
    const raw = Buffer.alloc(gh * (gw + 1));
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) raw[y * (gw + 1) + 1 + x] = (x * 3 + y) % 256;
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(gw, 0);
    ihdr.writeUInt32BE(gh, 4);
    ihdr[8] = 8;
    const chunk = (t: string, d: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(d.length);
      const td = Buffer.concat([Buffer.from(t, 'latin1'), d]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(zlib.crc32(td));
      return Buffer.concat([len, td, crc]);
    };
    fs.writeFileSync(path.join(dir, 'grey.png'), Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
    assert.equal(await main(['deliver', dir, '--widths', '640']), 0);
    assert.ok(fs.existsSync(path.join(dir, 'credits.json')));
    // Every AVIF written is non-empty, branded avif, and sound; WebP and JPEG are always there.
    const web = fs.readdirSync(path.join(dir, 'web'));
    for (const f of web.filter((x) => x.endsWith('.avif'))) assert.equal(avifProblem(fs.readFileSync(path.join(dir, 'web', f))), null, f);
    for (const stem of ['detailed', 'flat', 'grey']) for (const ext of ['webp', 'jpg']) assert.ok(web.includes(`${stem}-640.${ext}`), `${stem}-640.${ext} in ${web.join(', ')}`);
    assert.match(printed.join('\n'), /No credit recorded for this file \(fine for the owner's own photograph/);
  } finally {
    console.log = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** A synthetic picture's pixels: a share of each colour, as r,g,b triples. */
const pixelsOf = (parts: Array<[[number, number, number], number]>): number[] => parts.flatMap(([rgb, n]) => Array.from({ length: n }, () => rgb).flat());

test('palette: OKLCH round-trips, contrast is WCAG 2, and the dominant colours come out largest first', () => {
  const o = labToOklch(...rgbToOklab(179, 49, 30));
  assert.equal(oklchToHex(o), '#b3311e');
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#777777', '#ffffff'), 4.48);
  // A pale sand ground, deep sea shadows and a small bright teal: the teal is kept, not swallowed.
  const px = pixelsOf([[[236, 230, 214], 600], [[205, 196, 176], 200], [[22, 52, 58], 150], [[0, 150, 140], 40], [[120, 110, 100], 10]]);
  const colours = dominantColours(px);
  assert.ok(colours.length >= 4 && colours.length <= 8, String(colours.length));
  assert.ok(colours[0]!.share >= colours[1]!.share);
  assert.ok(colours.some((c) => c.oklch.c > 0.08 && c.oklch.h > 160 && c.oklch.h < 210), JSON.stringify(colours));
  const roles = paletteRoles(colours);
  assert.ok(roles.ground.oklch.l >= 0.93 && roles.ground.oklch.c <= 0.02, JSON.stringify(roles.ground));
  assert.ok(roles.ink.oklch.l < 0.3 && roles.ink.contrast! >= 7, JSON.stringify(roles.ink));
  assert.ok(roles.accent && roles.accent.oklch.h > 160 && roles.accent.oklch.h < 210, JSON.stringify(roles.accent));
  assert.ok(roles.accent!.contrast! >= 4.5, 'the accent is darkened until it reads on the ground');
  // A dark picture gets a dark ground and a light ink; a grey one has no accent and says so.
  const night = paletteRoles(dominantColours(pixelsOf([[[18, 22, 34], 700], [[40, 46, 70], 200], [[230, 190, 120], 60]])));
  assert.ok(night.ground.oklch.l <= 0.24 && night.ink.oklch.l > 0.9);
  const grey = paletteRoles(dominantColours(pixelsOf([[[240, 240, 240], 500], [[90, 90, 90], 300], [[160, 160, 160], 200]])));
  assert.equal(grey.accent, null);
  assert.ok(grey.notes.some((n) => /world line/.test(n)));
  assert.deepEqual(parseArgs(['palette', 'hero.jpg', '--json']).bad, []);
  assert.equal(parseArgs(['palette', 'hero.jpg']).command, 'palette');
  assert.match(USAGES.palette.join(' '), /ground/);
});

test('palette reads a picture in the browser and prints roles with contrast ratios', { skip: browserSkip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-palette-'));
  const printed: string[] = [];
  const real = console.log;
  try {
    const w = 200, h = 100;
    const data = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      const x = i % w;
      const rgb = x < 140 ? [238, 233, 220] : x < 185 ? [24, 48, 52] : [196, 84, 40];
      data[i * 3] = rgb[0]!; data[i * 3 + 1] = rgb[1]!; data[i * 3 + 2] = rgb[2]!;
    }
    const file = path.join(dir, 'shore.png');
    fs.writeFileSync(file, encodePng({ width: w, height: h, channels: 3, data }));
    console.log = (...a: unknown[]) => void printed.push(a.join(' '));
    assert.equal(await main(['palette', file, '--json']), 0);
    const r = JSON.parse(printed.join('\n')) as { colours: unknown[]; ground: { oklch: { l: number } }; ink: { contrast: number }; accent: { oklch: { h: number } } | null };
    assert.ok(r.colours.length >= 3);
    assert.ok(r.ground.oklch.l > 0.9);
    assert.ok(r.ink.contrast > 7);
    assert.ok(r.accent && r.accent.oklch.h > 20 && r.accent.oklch.h < 70, JSON.stringify(r.accent));
    printed.length = 0;
    assert.equal(await main(['palette', file]), 0);
    assert.match(printed.join('\n'), /--c-ground: oklch\(/);
  } finally {
    console.log = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('deliver --max-kb parses as a budget in kB; out of range is an error', () => {
  assert.equal(parseArgs(['deliver', 'pics', '--max-kb', '120']).maxKb, 120);
  assert.equal(parseArgs(['deliver', 'pics']).maxKb, null);
  assert.match(parseArgs(['deliver', 'pics', '--max-kb', '3']).bad[0] ?? '', /--max-kb 3 \(10 to 5000\)/);
  assert.match(parseArgs(['deliver', 'pics', '--max-kb', 'big']).bad[0] ?? '', /--max-kb big/);
});

test('credits keep a stable id and follow a renamed picture by its bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-credits-'));
  try {
    fs.writeFileSync(path.join(dir, 'unsplash-loaf-1a2b.jpg'), Buffer.from('loaf bytes'));
    fs.writeFileSync(path.join(dir, 'own.jpg'), Buffer.from('owner photo'));
    const page = 'https://unsplash.com/photos/a-loaf-abc123';
    writeCredits(dir, [{ file: 'unsplash-loaf-1a2b.jpg', title: 'A loaf', author: 'A Baker', source: 'unsplash', sourcePage: page, licence: 'Unsplash Licence', licenceUrl: 'https://unsplash.com/license', width: 10, height: 10, search: '' }]);
    const written = JSON.parse(fs.readFileSync(path.join(dir, 'credits.json'), 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(written[0]?.['id'], 'unsplash:' + page);
    assert.match(String(written[0]?.['sha256']), /^[0-9a-f]{64}$/);
    assert.equal(creditId({ file: 'x.jpg' }), null);
    // Renamed by hand: the credit finds the file by its bytes and keeps its id.
    fs.renameSync(path.join(dir, 'unsplash-loaf-1a2b.jpg'), path.join(dir, 'hero-loaf.jpg'));
    const r = reconcileCredits(dir, ['hero-loaf.jpg', 'own.jpg']);
    assert.deepEqual(r.renamed, [['unsplash-loaf-1a2b.jpg', 'hero-loaf.jpg']]);
    assert.deepEqual(r.missing, []);
    const after = JSON.parse(fs.readFileSync(path.join(dir, 'credits.json'), 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(after.length, 1);
    assert.equal(after[0]?.['file'], 'hero-loaf.jpg');
    assert.equal(after[0]?.['author'], 'A Baker');
    assert.equal(after[0]?.['id'], 'unsplash:' + page);
    // Writing the same photograph again under its new name replaces the entry (same id), never duplicates it.
    writeCredits(dir, [{ ...(after[0] as { file: string }), file: 'hero-loaf.jpg' }]);
    assert.equal((JSON.parse(fs.readFileSync(path.join(dir, 'credits.json'), 'utf8')) as unknown[]).length, 1);
    // A file that is gone and matches nothing is reported, not dropped.
    fs.rmSync(path.join(dir, 'hero-loaf.jpg'));
    assert.deepEqual(reconcileCredits(dir, ['own.jpg']).missing, ['hero-loaf.jpg']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('deliver --max-kb writes every file under the budget and keeps the credit of a renamed picture', { skip: browserSkip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-maxkb-'));
  const printed: string[] = [];
  const real = console.log;
  try {
    // Noise compresses badly: at the default quality the 1600px copies are far over 60 kB.
    const w = 1600;
    const h = 1200;
    const data = Buffer.alloc(w * h * 3);
    let seed = 11;
    for (let i = 0; i < data.length; i++) { seed = (seed * 1103515245 + 12345) >>> 0; data[i] = (seed >>> 16) & 255; }
    fs.writeFileSync(path.join(dir, 'noise.png'), encodePng({ width: w, height: h, channels: 3, data }));
    writeCredits(dir, [{ file: 'noise.png', title: 'Noise', author: 'Someone', source: 'openverse', sourcePage: 'https://example.org/noise', licence: 'CC0 1.0', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', width: w, height: h, search: 'noise' }]);
    fs.renameSync(path.join(dir, 'noise.png'), path.join(dir, 'renamed.png'));
    console.log = (...a: unknown[]) => void printed.push(a.join(' '));
    assert.equal(await main(['deliver', dir, '--widths', '640,1600', '--max-kb', '60']), 0);
    const web = path.join(dir, 'web');
    const files = fs.readdirSync(web);
    assert.ok(files.length >= 4, files.join(', '));
    for (const f of files) assert.ok(fs.statSync(path.join(web, f)).size <= 60 * 1024, f + ' is ' + fs.statSync(path.join(web, f)).size + ' bytes');
    assert.match(printed.join('\n'), /every file under 60 KB/);
    assert.match(printed.join('\n'), /Credit for noise\.png kept: the file is now renamed\.png/);
    const credits = JSON.parse(fs.readFileSync(path.join(dir, 'credits.json'), 'utf8')) as Array<Record<string, unknown>>;
    assert.equal(credits.length, 1);
    assert.equal(credits[0]?.['file'], 'renamed.png');
    assert.equal(credits[0]?.['author'], 'Someone');
  } finally {
    console.log = real;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
