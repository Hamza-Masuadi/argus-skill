import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseVideoArgs, isoSeconds, parseMixkitSearch, parseMixkitItem, mixkitAt, parseCommonsVideo, commonsVideoUrl, parsePexelsVideos, parsePixabayVideos,
  videoRejectReason, videoPageOf, loopCommands, videoCredit, MIXKIT_LICENCE, FFMPEG_INSTALL, chooseRendition, nextAfterGet, renditionLine, quote,
} from '../scripts/video';

const photos = path.join(__dirname, '..', 'scripts', 'photos.js');
const run = (args: string[], env: NodeJS.ProcessEnv = process.env): { code: number | null; out: string } => {
  const r = spawnSync(process.execPath, [photos, ...args], { encoding: 'utf8', env, timeout: 60000 });
  return { code: r.status, out: r.stdout + r.stderr };
};

// A clip page as Mixkit serves it: a JSON-LD graph with the VideoObject, the attributes, and the download box.
const mixkitPage = (notice: string, personal = false): string => `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"Kayak"},{"@type":"VideoObject","name":"A man in a kayak on the sea",
"description":"This is a free stock video of A man in a kayak on the sea created by Kristian_Kettner that you can use in your commercial and non-commercial projects worry-free.",
"copyrightNotice":"${notice}","license":"https://mixkit.co/license/#videoFree","duration":"PT0M11S","thumbnailUrl":"https://assets.mixkit.co/videos/1903/1903-thumb-720-0.jpg",
"contentUrl":"https://assets.mixkit.co/videos/1903/1903-720.mp4"}]}</script></head><body>
${personal ? '<span>Free Download - 720p Version for Personal Use only</span>' : ''}
<div>Attributes</div><div>Frame Rate</div><div>24 fps</div></body></html>`;

test('video arguments: search words and filters, get, poster and loop', () => {
  const s = parseVideoArgs(['video', 'sea', 'kayak', '--max-seconds', '20', '--min-width', '1920', '--orientation', 'landscape', '--source', 'mixkit,commons', '--count', '3']);
  assert.equal(s.command, 'video');
  assert.equal(s.query, 'sea kayak');
  assert.deepEqual([s.maxSeconds, s.minWidth, s.orientation, s.count], [20, 1920, 'landscape', 3]);
  assert.deepEqual(s.sources, ['mixkit', 'wikimedia']);
  const g = parseVideoArgs(['video', 'get', 'https://mixkit.co/free-stock-video/a-1903/', '--height', '720', '--out', 'media']);
  assert.deepEqual([g.command, g.target, g.height, g.out], ['get', 'https://mixkit.co/free-stock-video/a-1903/', 720, 'media']);
  const p = parseVideoArgs(['poster', 'clip.mp4', '--at', '2.5']);
  assert.deepEqual([p.command, p.target, p.at], ['poster', 'clip.mp4', 2.5]);
  assert.ok(parseVideoArgs(['loop', 'clip.mp4']).bad.some((b) => /--seconds/.test(b)), 'loop needs --seconds');
  assert.deepEqual(parseVideoArgs(['video', 'x', '--source', 'youtube']).bad.length, 1);
  assert.ok(parseVideoArgs(['poster', 'clip.mp4', '--count', '3']).bad.includes('--count'), 'a flag of another command is not understood');
});

test('Mixkit: search links, Free-licence items kept, Restricted items refused as personal use only', () => {
  const search = '<a href="/free-stock-video/a-man-in-a-kayak-on-the-sea-1903/">x</a><a href="/free-stock-video/a-man-in-a-kayak-on-the-sea-1903/">again</a><a href="/free-stock-video/kayak-out-at-sea-7899/">y</a><a href="/free-stock-video/">all</a>';
  assert.deepEqual(parseMixkitSearch(search), ['https://mixkit.co/free-stock-video/a-man-in-a-kayak-on-the-sea-1903/', 'https://mixkit.co/free-stock-video/kayak-out-at-sea-7899/']);
  const free = parseMixkitItem(mixkitPage('Free'), 'https://mixkit.co/free-stock-video/a-man-in-a-kayak-on-the-sea-1903/');
  assert.ok(typeof free !== 'string');
  assert.equal(free.licence, MIXKIT_LICENCE);
  assert.equal(free.credit, false);
  assert.equal(free.seconds, 11);
  assert.equal(free.fps, 24);
  assert.equal(free.author, 'Kristian Kettner');
  // Every size Mixkit serves is listed; the default is the 720 file, not the 1080.
  assert.equal(free.fileUrl, 'https://assets.mixkit.co/videos/1903/1903-720.mp4');
  assert.deepEqual(free.renditions!.map((r) => r.height), [360, 720, 1080, 2160]);
  assert.equal(mixkitAt(free.fileUrl, 1080), 'https://assets.mixkit.co/videos/1903/1903-1080.mp4');
  // The JSON-LD licence link says "videoFree" on Restricted items too: the notice and the download box decide.
  assert.match(String(parseMixkitItem(mixkitPage('Mixkit Restricted License', true), 'u')), /personal use only/);
  assert.match(String(parseMixkitItem(mixkitPage('Free', true), 'u')), /personal use only/);
  assert.match(String(parseMixkitItem('<html></html>', 'u')), /no clip details/);
  assert.equal(isoSeconds('PT1M2.5S'), 62.5);
  assert.equal(isoSeconds('PT0M14S'), 14);
  assert.equal(isoSeconds('soon'), null);
});

test('Commons: reusable licences kept with their credit rule, others skipped; the search asks for video files only', () => {
  assert.equal(new URL(commonsVideoUrl('kayak')).searchParams.get('gsrsearch'), 'filetype:video kayak');
  const v = (title: string, licence: string, attribution: string, size = 3_000_000): unknown => ({
    title: 'File:' + title + '.webm',
    videoinfo: [{ url: 'https://upload.wikimedia.org/x/' + title + '.webm', descriptionurl: 'https://commons.wikimedia.org/wiki/File:' + title + '.webm', width: 1920, height: 1080, duration: 13.5, size, mime: 'video/webm',
      extmetadata: { LicenseShortName: { value: licence }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0' }, Artist: { value: '<a href="#">Nesnad</a>' }, AttributionRequired: { value: attribution } },
      derivatives: [{ type: 'video/webm; codecs="vp9, opus"', height: 1080, width: 1920, src: 'https://upload.wikimedia.org/t/' + title + '.1080p.vp9.webm' }] }],
  });
  const r = parseCommonsVideo({ query: { pages: [v('River', 'CC BY 4.0', 'true'), v('Lake', 'CC0', 'false'), v('Shop', 'All rights reserved', 'true'), v('Big', 'CC BY-SA 4.0', 'true', 90_000_000)] } });
  assert.deepEqual(r.candidates.map((c) => [c.title, c.credit]), [['River', true], ['Lake', false], ['Big', true]]);
  assert.equal(r.candidates[0]!.author, 'Nesnad');
  assert.equal(r.candidates[0]!.seconds, 13.5);
  assert.match(r.candidates[2]!.fileUrl, /1080p\.vp9\.webm$/, 'a large original gives way to the 1080p WebM');
  assert.equal(r.skipped.length, 1);
});

test('Pexels and Pixabay (with keys): the MP4 nearest 1920 wide, the licence, the length', () => {
  const px = parsePexelsVideos({ videos: [{ url: 'https://www.pexels.com/video/waves-on-a-beach-123/', duration: 12, user: { name: 'Ana' },
    video_files: [{ file_type: 'video/mp4', width: 3840, height: 2160, fps: 25, link: 'https://v/4k.mp4' }, { file_type: 'video/mp4', width: 1920, height: 1080, fps: 25, link: 'https://v/hd.mp4' }, { file_type: 'video/mp4', width: 640, height: 360, link: 'https://v/sd.mp4' }] }] });
  assert.deepEqual([px[0]!.fileUrl, px[0]!.width, px[0]!.seconds, px[0]!.author, px[0]!.title], ['https://v/hd.mp4', 1920, 12, 'Ana', 'waves on a beach']);
  assert.equal(px[0]!.renditions!.length, 3, 'every MP4 is listed');
  const pb = parsePixabayVideos({ hits: [{ pageURL: 'https://pixabay.com/videos/sea-1/', tags: 'sea, waves', duration: 9, user: 'Bo', videos: { large: { url: '', width: 0 }, medium: { url: 'https://p/m.mp4', width: 1920, height: 1080, size: 4_000_000 } } }] });
  assert.deepEqual([pb[0]!.fileUrl, pb[0]!.bytes, pb[0]!.licence], ['https://p/m.mp4', 4_000_000, 'Pixabay Content Licence']);
});

test('filters: length, width and shape; unknown values pass', () => {
  const o = { maxSeconds: 15, minWidth: 1920, orientation: 'landscape' as const };
  assert.match(videoRejectReason({ width: 1920, height: 1080, seconds: 40 }, o) ?? '', /longer than --max-seconds 15/);
  assert.match(videoRejectReason({ width: 1280, height: 720, seconds: 10 }, o) ?? '', /narrower/);
  assert.match(videoRejectReason({ width: 1080, height: 1920, seconds: 10 }, { ...o, minWidth: null }) ?? '', /not landscape/);
  assert.equal(videoRejectReason({ width: null, height: null, seconds: null }, o), null);
});

test('clip addresses: Mixkit, Commons, Pexels and Pixabay pages, direct files; anything else is refused', () => {
  assert.equal(videoPageOf('https://mixkit.co/free-stock-video/a-man-in-a-kayak-on-the-sea-1903')?.kind, 'mixkit');
  assert.equal(videoPageOf('https://commons.wikimedia.org/wiki/File:Kayak_Hand_roll.webm')?.kind, 'commons');
  assert.deepEqual(videoPageOf('https://www.pexels.com/video/waves-on-a-beach-1093662/'), { kind: 'pexels', id: '1093662', url: 'https://www.pexels.com/video/waves-on-a-beach-1093662/' });
  assert.equal(videoPageOf('https://pixabay.com/videos/sea-waves-12345/')?.kind, 'pixabay');
  assert.equal(videoPageOf('https://example.org/clips/loop.webm')?.kind, 'file');
  assert.equal(videoPageOf('http://mixkit.co/free-stock-video/a-1903/'), null, 'https only');
  assert.equal(videoPageOf('https://unsplash.com/photos/abc'), null);
});

test('loop: H.264 with faststart, VP9 WebM, a phone file and a poster; no sound, at most 30 fps, bitrate capped', () => {
  const jobs = loopCommands('media/sea-mixkit-720.mp4', 'media', { seconds: 10, from: 2, width: 1920, fps: 60 });
  assert.deepEqual(jobs.map((j) => path.basename(j.file)), ['sea-mixkit-1080.mp4', 'sea-mixkit-1080.webm', 'sea-mixkit-720.mp4', 'sea-mixkit-poster.jpg']);
  for (const j of jobs.slice(0, 3)) {
    assert.ok(j.args.includes('-an'), 'no audio');
    assert.ok(j.args.some((a) => /fps=30/.test(a)), 'frame rate capped at 30');
    assert.ok(j.args.includes('-t') && j.args.includes('10') && j.args.includes('-ss') && j.args.includes('2'));
  }
  assert.ok(jobs[0]!.args.includes('+faststart') && jobs[0]!.args.includes('-maxrate'));
  assert.ok(jobs[1]!.args.includes('libvpx-vp9') && jobs[1]!.args.includes('-b:v'));
  assert.ok(jobs[2]!.args.some((a) => /min\(1280,iw\)/.test(a)));
});

test('credits for a clip have the photographs\' fields plus kind, length and whether a credit is required', () => {
  const c = videoCredit({ source: 'wikimedia', title: 'River', author: 'Nesnad', pageUrl: 'https://c/p', fileUrl: 'https://c/f.webm', licence: 'CC BY 4.0', licenceUrl: 'https://cc/by', credit: true, width: 1280, height: 720, seconds: 13.6, bytes: 3, fps: null }, 'river.webm');
  for (const k of ['file', 'title', 'author', 'source', 'sourcePage', 'licence', 'licenceUrl', 'width', 'height', 'search']) assert.ok(k in c, k);
  assert.deepEqual([c.kind, c.seconds, c.creditRequired], ['video', 13.6, true]);
});

test('photos.js routes the video commands; loop without ffmpeg says how to install it and prints the commands', () => {
  const help = run(['video', '--help']);
  assert.equal(help.code, 0);
  assert.match(help.out, /Mixkit Free licence/);
  assert.match(run(['--help']).out, /photos\.js video "<words>"/);
  assert.equal(run(['video']).code, 1);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-loop-'));
  const clip = path.join(dir, 'sea.mp4');
  fs.writeFileSync(clip, 'not really a video');
  // An empty PATH hides any ffmpeg.
  const r = run(['loop', clip, '--seconds', '8'], { ...process.env, PATH: '' });
  assert.equal(r.code, 2);
  assert.ok(r.out.includes(FFMPEG_INSTALL));
  // The path is quoted where the temporary folder needs it (on Windows it does), so the quote is optional.
  assert.match(r.out, /ffmpeg -y -ss 0 -t 8 -i .*sea\.mp4"? -an/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('renditions: the smallest at least 720 under the budget by default, --height the nearest, and the sizes listed', () => {
  const MB = 1024 * 1024;
  const list = [
    { url: '1080', width: 1920, height: 1080, bytes: 14 * MB },
    { url: '360', width: 640, height: 360, bytes: 1 * MB },
    { url: '720', width: 1280, height: 720, bytes: 3 * MB },
  ];
  assert.equal(chooseRendition(list)!.url, '720');
  assert.equal(chooseRendition(list, 1080)!.url, '1080');
  assert.equal(chooseRendition(list.map((r) => ({ ...r, bytes: r.url === '360' ? r.bytes : 20 * MB })))!.url, '720', 'over budget: still the smallest at least 720');
  assert.equal(chooseRendition([{ url: 'p720', width: 720, height: 1280, bytes: null }, { url: 'p1080', width: 1080, height: 1920, bytes: null }])!.url, 'p720', 'portrait clips by their short side');
  assert.equal(chooseRendition([{ url: 'small', width: 640, height: 360, bytes: 1 }])!.url, 'small', 'nothing at 720: the largest there is');
  assert.match(renditionLine({ renditions: list, fileUrl: '720' }), /720p 3\.0 MB \(default\)/);
  const pb = parsePixabayVideos({ hits: [{ pageURL: 'https://pixabay.com/videos/sea-1/', tags: 'sea', duration: 9, user: 'Bo', videos: {
    large: { url: 'https://p/l.mp4', width: 3840, height: 2160, size: 40 * MB }, medium: { url: 'https://p/m.mp4', width: 1920, height: 1080, size: 9 * MB },
    small: { url: 'https://p/s.mp4', width: 1280, height: 720, size: 3 * MB }, tiny: { url: 'https://p/t.mp4', width: 960, height: 540, size: 1 * MB } } }] });
  assert.equal(pb[0]!.fileUrl, 'https://p/s.mp4');
  assert.equal(pb[0]!.renditions!.length, 4);
});

test('commands printed to run by hand are quoted for the shell of the platform: no doubled backslashes on Windows', () => {
  assert.equal(quote('-an'), '-an');
  assert.equal(quote('C:\\Users\\RUNNER~1\\sea.mp4', 'win32'), '"C:\\Users\\RUNNER~1\\sea.mp4"');
  assert.equal(quote('say "hi"', 'win32'), '"say ""hi"""');
  assert.equal(quote('/tmp/a b/$x.mp4', 'linux'), '"/tmp/a b/\\$x.mp4"');
  assert.equal(quote("scale='min(1920,iw)':-2", 'darwin'), `"scale='min(1920,iw)':-2"`);
});

test('after video get: loop only when ffmpeg is there', () => {
  assert.match(nextAfterGet('media/a.mp4', 3 * 1024 * 1024, true).join(' '), /photos\.js loop/);
  const without = nextAfterGet('media/a.mp4', 9 * 1024 * 1024, false).join(' ');
  assert.doesNotMatch(without, /photos\.js loop/);
  assert.match(without, /poster/);
  assert.ok(without.includes(FFMPEG_INSTALL));
});

test('video.js run on its own prints how to use it and exits 0, instead of printing nothing', () => {
  const file = path.join(__dirname, '..', '..', 'skills', 'argus', 'scripts', 'video.js');
  for (const args of [[], ['--help']]) {
    const r = spawnSync(process.execPath, [file, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /part of photos\.js/);
    assert.match(r.stdout, /node photos\.js video "<words>"/);
  }
});
