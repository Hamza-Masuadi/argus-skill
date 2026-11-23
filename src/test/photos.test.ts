import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  parseArgs,
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
  plainText,
  describeError,
  type Candidate,
} from '../scripts/photos';

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
