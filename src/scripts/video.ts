/*
 * Argus video: the video commands of photos.js. Finds free-licence stock video for a page opening,
 * downloads one with its credit, takes a poster frame and cuts the web renditions.
 *
 *   photos.js video "<words>" [--count N] [--max-seconds N] [--min-width N] [--orientation landscape|portrait] [--source LIST] [--json]
 *   photos.js video get <video-page-url | file-url> [--out DIR] [--height 720|1080|2160] [--json]
 *   photos.js poster <video> [--at SECONDS] [--out FILE] [--json]
 *   photos.js loop <video> --seconds N [--from S] [--width N] [--fps N] [--out DIR] [--json]
 *
 * Keyless sources: Mixkit (only items under its Free licence: commercial use, no attribution; items
 * under its Restricted licence are personal use only and are refused) and Wikimedia Commons (free
 * licences, often needing a visible credit). With PEXELS_API_KEY or PIXABAY_API_KEY set, Pexels and
 * Pixabay too; a key is sent only to its own service and never printed. Searching sends only the
 * words. poster uses ffmpeg when installed, else the headless browser shot.js uses; loop needs ffmpeg.
 *
 * Exit codes as photos.js: 0 done, 1 usage, 2 nothing found, downloaded or made.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describeError, findTool, imageSize, licenceAllowed, openLab, plainText, slug, writeCredits } from './photos';

export type VideoSource = 'mixkit' | 'wikimedia' | 'pexels' | 'pixabay';
export const VIDEO_SOURCES: readonly VideoSource[] = ['mixkit', 'wikimedia', 'pexels', 'pixabay'];
export const VIDEO_FILE = /\.(mp4|m4v|webm|mov|ogv)$/i;

export interface VideoCandidate {
  /** direct: a file address given to video get, with no page to read a licence from. */
  source: VideoSource | 'direct';
  title: string;
  author: string;
  /** The page that describes the clip and its licence. */
  pageUrl: string;
  /** The file to download (the rendition closest to 1080 high, when there is a choice). */
  fileUrl: string;
  licence: string;
  licenceUrl: string;
  /** Whether the licence asks for a visible credit. */
  credit: boolean;
  width: number | null;
  height: number | null;
  seconds: number | null;
  bytes: number | null;
  fps: number | null;
  /** Every file the library offers for this clip, smallest first; fileUrl is the one chosen (chooseRendition). */
  renditions?: Rendition[];
}

/** One file of a clip at one size. bytes is null when the library does not say. */
export interface Rendition {
  url: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
}

/** The short side of a rendition: 720 for 1280x720 and for 720x1280. */
export const shortSide = (r: Pick<Rendition, 'width' | 'height'>): number => Math.min(r.width ?? r.height ?? 0, r.height ?? r.width ?? 0) || 0;

/** A source file used as it is (no ffmpeg to cut it) should come in under this. */
export const SOURCE_BUDGET = 4 * 1024 * 1024;

/**
 * The rendition to download: with --height, the nearest to it; otherwise the smallest at least 720 on
 * its short side that is under the budget, else the smallest at least 720, else the largest there is.
 */
export function chooseRendition(list: Rendition[], height: number | null = null, budget = SOURCE_BUDGET): Rendition | null {
  const all = list.filter((r) => r.url);
  if (!all.length) return null;
  const sorted = [...all].sort((a, b) => shortSide(a) - shortSide(b) || (a.bytes ?? Infinity) - (b.bytes ?? Infinity));
  if (height) return [...sorted].sort((a, b) => Math.abs(shortSide(a) - height) - Math.abs(shortSide(b) - height) || shortSide(a) - shortSide(b))[0]!;
  const hd = sorted.filter((r) => shortSide(r) >= 720);
  return hd.find((r) => r.bytes !== null && r.bytes <= budget) ?? hd[0] ?? sorted[sorted.length - 1]!;
}

/** Point the candidate at the chosen rendition. */
export function applyRendition(c: VideoCandidate, height: number | null = null): VideoCandidate {
  const pick = c.renditions?.length ? chooseRendition(c.renditions, height) : null;
  if (pick) {
    c.fileUrl = pick.url;
    c.width = pick.width ?? c.width;
    c.height = pick.height ?? c.height;
    c.bytes = pick.bytes;
  }
  return c;
}

/** "360p 1.1 MB, 720p 3.2 MB, 1080p ?" with the chosen one marked. */
export function renditionLine(c: Pick<VideoCandidate, 'renditions' | 'fileUrl'>): string {
  return (c.renditions ?? []).map((r) => `${shortSide(r) || '?'}p ${mb(r.bytes)}${r.url === c.fileUrl ? ' (default)' : ''}`).join(', ');
}

export interface VideoOptions {
  command: 'video' | 'get' | 'poster' | 'loop';
  query: string | null;
  target: string | null;
  count: number;
  maxSeconds: number | null;
  minWidth: number | null;
  orientation: 'landscape' | 'portrait' | null;
  sources: VideoSource[] | null;
  out: string | null;
  /** get: the rendition height asked for; null chooses (chooseRendition). */
  height: number | null;
  at: number;
  seconds: number | null;
  from: number;
  width: number;
  fps: number;
  json: boolean;
  help: boolean;
  bad: string[];
}

const UA = 'argus-skill-photos (free-licence video search for a design skill; https://www.npmjs.com/package/argus-skill)';
const TIMEOUT_MS = 30000;
const DOWNLOAD_TIMEOUT_MS = 180000;
/** No stock clip for a page opening should need more than this. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
/** Web renditions: the 1080 file and the phone file should come in under these (pictures.md). */
export const VIDEO_BUDGETS = { large: 4 * 1024 * 1024, small: 1.5 * 1024 * 1024 };
export const MIXKIT_LICENCE = 'Mixkit Stock Video Free License';
export const MIXKIT_LICENCE_URL = 'https://mixkit.co/license/#videoFree';
const PEXELS_LICENCE = { licence: 'Pexels licence', licenceUrl: 'https://www.pexels.com/license/' };
const PIXABAY_LICENCE = { licence: 'Pixabay Content Licence', licenceUrl: 'https://pixabay.com/service/license-summary/' };

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const mb = (bytes: number | null): string => (bytes === null ? '?' : (bytes / 1048576).toFixed(1) + ' MB');

// ---- arguments ------------------------------------------------------------------------------

export function parseVideoArgs(argv: string[]): VideoOptions {
  const first = argv[0] ?? '';
  const command: VideoOptions['command'] = first === 'poster' ? 'poster' : first === 'loop' ? 'loop' : argv[1] === 'get' ? 'get' : 'video';
  const o: VideoOptions = {
    command, query: null, target: null, count: 8, maxSeconds: null, minWidth: null, orientation: null, sources: null, out: null,
    height: null, at: 1, seconds: null, from: 0, width: 1920, fps: 25, json: false, help: false, bad: [],
  };
  const allowed: Record<VideoOptions['command'], string[]> = {
    video: ['--count', '-n', '--max-seconds', '--min-width', '--orientation', '--source', '--json'],
    get: ['--out', '--height', '--json'],
    poster: ['--at', '--out', '--json'],
    loop: ['--seconds', '--from', '--width', '--fps', '--out', '--json'],
  };
  const words: string[] = [];
  const numberIn = (v: string | undefined, lo: number, hi: number): number | null => {
    const n = Number(v);
    return v !== undefined && v.trim() !== '' && Number.isFinite(n) && n >= lo && n <= hi ? n : null;
  };
  for (let i = command === 'get' ? 2 : 1; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--help' || a === '-h') {
      o.help = true;
      continue;
    }
    if (a.startsWith('-') && !allowed[command].includes(a)) {
      o.bad.push(a);
      continue;
    }
    const v = (): string | undefined => argv[++i];
    if (a === '--count' || a === '-n') {
      const n = numberIn(v(), 1, 20);
      if (n) o.count = Math.floor(n);
      else o.bad.push('--count (1 to 20)');
    } else if (a === '--max-seconds') {
      const n = numberIn(v(), 1, 600);
      if (n) o.maxSeconds = n;
      else o.bad.push('--max-seconds (1 to 600)');
    } else if (a === '--min-width') {
      const n = numberIn(v(), 1, 8000);
      if (n) o.minWidth = Math.floor(n);
      else o.bad.push('--min-width');
    } else if (a === '--orientation') {
      const x = String(v() ?? '').toLowerCase();
      if (x === 'landscape' || x === 'portrait') o.orientation = x;
      else o.bad.push('--orientation (landscape or portrait)');
    } else if (a === '--source') {
      const names = String(v() ?? '').toLowerCase().split(',').map((s) => (s.trim() === 'commons' ? 'wikimedia' : s.trim())).filter(Boolean);
      const unknown = names.filter((n) => !(VIDEO_SOURCES as readonly string[]).includes(n));
      if (!names.length || unknown.length) o.bad.push('--source ' + (unknown.join(',') || '') + ' (mixkit, wikimedia, pexels, pixabay)');
      else o.sources = [...new Set(names)] as VideoSource[];
    } else if (a === '--out') {
      const x = v();
      if (x) o.out = x;
      else o.bad.push('--out');
    } else if (a === '--height') {
      const n = numberIn(v(), 240, 2160);
      if (n) o.height = Math.floor(n);
      else o.bad.push('--height (720, 1080 or 2160)');
    } else if (a === '--at') {
      const n = numberIn(v(), 0, 3600);
      if (n !== null) o.at = n;
      else o.bad.push('--at (seconds)');
    } else if (a === '--seconds') {
      const n = numberIn(v(), 1, 60);
      if (n) o.seconds = n;
      else o.bad.push('--seconds (1 to 60)');
    } else if (a === '--from') {
      const n = numberIn(v(), 0, 3600);
      if (n !== null) o.from = n;
      else o.bad.push('--from (seconds)');
    } else if (a === '--width') {
      const n = numberIn(v(), 320, 3840);
      if (n) o.width = Math.floor(n);
      else o.bad.push('--width (320 to 3840)');
    } else if (a === '--fps') {
      const n = numberIn(v(), 12, 60);
      if (n) o.fps = Math.floor(n);
      else o.bad.push('--fps (12 to 60)');
    } else if (a === '--json') o.json = true;
    else words.push(a);
  }
  if (command === 'video') o.query = words.join(' ').replace(/\s+/g, ' ').trim() || null;
  else {
    if (words.length > 1) o.bad.push('one ' + (command === 'get' ? 'address' : 'video file') + ' only (also given: ' + words.slice(1).join(' ') + ')');
    o.target = words[0] ?? null;
  }
  if (command === 'loop' && !o.seconds && !o.help) o.bad.push('--seconds N (how long the loop runs, 6 to 15 is usual)');
  return o;
}

// ---- parsing the sources --------------------------------------------------------------------

/** ISO 8601 duration (PT0M14S, PT1M2.5S) to seconds. */
export function isoSeconds(s: string): number | null {
  const m = /^P(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)$/i.exec(s.trim());
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** The clip pages a Mixkit search page links to, in order, without repeats. */
export function parseMixkitSearch(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href="(\/free-stock-video\/[a-z0-9-]+-\d+\/)"/g)) {
    const url = 'https://mixkit.co' + m[1];
    if (!out.includes(url)) out.push(url);
  }
  return out;
}

/**
 * One Mixkit clip page: its VideoObject (name, licence notice, duration, file), the author from the
 * description, and the frame rate and file size from the attributes. Returns a reason when the
 * clip is not under the Free licence: Restricted items are for personal use only.
 */
export function parseMixkitItem(html: string, pageUrl: string): VideoCandidate | string {
  let video: Record<string, unknown> | null = null;
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1] ?? '') as unknown;
      const graph = isObject(data) && Array.isArray(data['@graph']) ? data['@graph'] : [data];
      for (const g of graph) if (isObject(g) && g['@type'] === 'VideoObject') video = g;
    } catch {
      /* another block */
    }
  }
  if (!video) return 'no clip details on the page';
  const notice = str(video['copyrightNotice']);
  const restricted = /restricted/i.test(notice) || /Personal Use only/i.test(html);
  if (restricted || !/^free$/i.test(notice.trim())) return `licence is ${notice || 'not stated'} (personal use only), not the Mixkit Free licence`;
  const content = str(video['contentUrl']);
  if (!/^https:\/\/assets\.mixkit\.co\/videos\/\d+\/\d+-\d+\.mp4$/.test(content)) return 'no file address on the page';
  const text = plainText(html);
  const fps = num(/Frame Rate\s*([\d.]+)\s*fps/i.exec(text)?.[1]);
  const author = /created by ([^ ]+?) that you can use/i.exec(str(video['description']))?.[1] ?? 'Mixkit';
  return {
    source: 'mixkit', title: str(video['name']) || 'Mixkit clip', author: author.replace(/_/g, ' '), pageUrl,
    fileUrl: content.replace(/-\d+\.mp4$/, '-720.mp4'), licence: MIXKIT_LICENCE, licenceUrl: MIXKIT_LICENCE_URL, credit: false,
    width: null, height: null, seconds: isoSeconds(str(video['duration'])), bytes: null, fps,
    renditions: MIXKIT_HEIGHTS.map((h) => ({ url: mixkitAt(content, h), width: null, height: h, bytes: null })),
  };
}

/** The heights Mixkit serves each clip at. */
export const MIXKIT_HEIGHTS = [360, 720, 1080, 2160];

/** A Mixkit file at another height: 360, 720, 1080 or 2160. */
export const mixkitAt = (fileUrl: string, height: number): string => {
  const h = height >= 2160 ? 2160 : height >= 1080 ? 1080 : height >= 720 ? 720 : 360;
  return fileUrl.replace(/-\d+\.mp4$/, `-${h}.mp4`);
};

export function commonsVideoUrl(query: string, limit = 20): string {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  const p: Record<string, string> = {
    action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrnamespace: '6', gsrsearch: 'filetype:video ' + query, gsrlimit: String(limit),
    prop: 'videoinfo', viprop: 'url|size|mime|extmetadata|derivatives', viextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|AttributionRequired|ObjectName',
  };
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  return u.toString();
}

/** Commons search results: clips with a reusable licence; the original, or a 1080p (or nearest) WebM when the original is large. */
export function parseCommonsVideo(body: unknown): { candidates: VideoCandidate[]; skipped: string[] } {
  const candidates: VideoCandidate[] = [];
  const skipped: string[] = [];
  const pages = isObject(body) && isObject(body['query']) && Array.isArray(body['query']['pages']) ? body['query']['pages'] : [];
  for (const p of pages) {
    if (!isObject(p) || !Array.isArray(p['videoinfo'])) continue;
    const v = p['videoinfo'][0];
    if (!isObject(v)) continue;
    const meta = isObject(v['extmetadata']) ? v['extmetadata'] : {};
    const field = (k: string): string => (isObject(meta[k]) ? str((meta[k] as Record<string, unknown>)['value']) : '');
    const title = str(p['title']).replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '');
    const licence = field('LicenseShortName');
    if (!licenceAllowed(licence)) {
      skipped.push(`${title}: licence ${licence || 'unstated'} is not clearly reusable`);
      continue;
    }
    if (!/^video\//.test(str(v['mime']))) continue;
    const width = num(v['width']);
    const height = num(v['height']);
    const fileUrl = str(v['url']);
    const bytes = num(v['size']);
    const derivs = Array.isArray(v['derivatives']) ? v['derivatives'].filter(isObject) : [];
    // The original, and the WebM transcodes Commons makes at smaller sizes (their bytes are not given).
    const renditions: Rendition[] = [{ url: fileUrl, width, height, bytes }];
    for (const d of derivs) {
      const h = num(d['height']);
      if (/webm/.test(str(d['type'])) && h && (!height || h <= height) && str(d['src']) !== fileUrl && str(d['src'])) renditions.push({ url: str(d['src']), width: num(d['width']), height: h, bytes: null });
    }
    // A large original (over 60 MB) gives way to the largest transcode up to 1080 when it is the only file at least 720.
    const big = bytes !== null && bytes > 60 * 1024 * 1024;
    candidates.push({
      source: 'wikimedia', title, author: plainText(field('Artist')) || 'unknown', pageUrl: str(v['descriptionurl']) || 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(str(p['title'])),
      fileUrl, licence, licenceUrl: field('LicenseUrl'), credit: field('AttributionRequired') !== 'false' && !/^(cc0|public domain|pd)/i.test(licence),
      width, height, seconds: num(v['duration']), bytes, fps: null,
      renditions: big ? renditions.filter((r) => r.url !== fileUrl) : renditions,
    });
    applyRendition(candidates[candidates.length - 1]!);
  }
  return { candidates, skipped };
}

export function pexelsVideoUrl(query: string, perPage: number, orientation: string | null): string {
  const u = new URL('https://api.pexels.com/videos/search');
  u.searchParams.set('query', query);
  u.searchParams.set('per_page', String(perPage));
  if (orientation) u.searchParams.set('orientation', orientation);
  return u.toString();
}

/** One Pexels video object: the MP4 rendition closest to 1920 wide without going over. */
export function pexelsVideo(v: unknown): VideoCandidate | null {
  if (!isObject(v)) return null;
  const files = (Array.isArray(v['video_files']) ? v['video_files'] : []).filter(isObject).filter((f) => /mp4/.test(str(f['file_type'])) && num(f['width']));
  if (!files.length) return null;
  const user = isObject(v['user']) ? v['user'] : {};
  const page = str(v['url']);
  const renditions: Rendition[] = files.map((f) => ({ url: str(f['link']), width: num(f['width']), height: num(f['height']), bytes: num(f['size']) }));
  return applyRendition({
    source: 'pexels', title: (page.match(/\/video\/([a-z0-9-]+?)-\d+\/?$/)?.[1] ?? 'pexels-video').replace(/-/g, ' '), author: str(user['name']) || 'unknown', pageUrl: page,
    fileUrl: '', ...PEXELS_LICENCE, credit: false, width: null, height: null, seconds: num(v['duration']), bytes: null, fps: num(files[0]!['fps']),
    renditions,
  });
}

export function parsePexelsVideos(body: unknown): VideoCandidate[] {
  const list = isObject(body) && Array.isArray(body['videos']) ? body['videos'] : [];
  return list.map(pexelsVideo).filter((c): c is VideoCandidate => !!c);
}

export function pixabayVideoUrl(query: string, key: string, perPage: number): string {
  const u = new URL('https://pixabay.com/api/videos/');
  u.searchParams.set('key', key);
  u.searchParams.set('q', query);
  u.searchParams.set('per_page', String(Math.max(3, perPage)));
  u.searchParams.set('safesearch', 'true');
  return u.toString();
}

export function pixabayVideo(h: unknown): VideoCandidate | null {
  if (!isObject(h) || !isObject(h['videos'])) return null;
  const vids = h['videos'];
  const renditions: Rendition[] = ['large', 'medium', 'small', 'tiny'].map((k) => vids[k]).filter((x): x is Record<string, unknown> => isObject(x) && !!str(x['url']))
    .map((x) => ({ url: str(x['url']), width: num(x['width']) || null, height: num(x['height']) || null, bytes: num(x['size']) }));
  if (!renditions.length) return null;
  return applyRendition({
    source: 'pixabay', title: str(h['tags']) || 'pixabay video', author: str(h['user']) || 'unknown', pageUrl: str(h['pageURL']), fileUrl: '', ...PIXABAY_LICENCE, credit: false,
    width: null, height: null, seconds: num(h['duration']), bytes: null, fps: null, renditions,
  });
}

export function parsePixabayVideos(body: unknown): VideoCandidate[] {
  const list = isObject(body) && Array.isArray(body['hits']) ? body['hits'] : [];
  return list.map(pixabayVideo).filter((c): c is VideoCandidate => !!c);
}

/** Why a clip is left out by the filters, or null. Unknown sizes and lengths pass. */
export function videoRejectReason(c: Pick<VideoCandidate, 'width' | 'height' | 'seconds'>, o: Pick<VideoOptions, 'maxSeconds' | 'minWidth' | 'orientation'>): string | null {
  if (o.maxSeconds && c.seconds !== null && c.seconds > o.maxSeconds) return `longer than --max-seconds ${o.maxSeconds} (${Math.round(c.seconds)}s)`;
  if (o.minWidth && c.width !== null && c.width < o.minWidth) return `narrower than --min-width ${o.minWidth} (${c.width}px)`;
  if (o.orientation && c.width !== null && c.height !== null) {
    const landscape = c.width >= c.height;
    if (landscape !== (o.orientation === 'landscape')) return `not ${o.orientation}`;
  }
  return null;
}

// ---- network --------------------------------------------------------------------------------

async function getText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error('it answered ' + res.status + ' ' + res.statusText);
  return res.text();
}
async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  return JSON.parse(await getText(url, { Accept: 'application/json', ...headers })) as unknown;
}
/** The size of a file from a HEAD request, or null. */
async function headSize(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? num(res.headers.get('content-length')) : null;
  } catch {
    return null;
  }
}
/** The pixel size of a picture from its first 64 KB. */
async function thumbSize(url: string): Promise<{ width: number; height: number } | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Range: 'bytes=0-65535' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return imageSize(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}
const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const keyOf = (name: string): string => (process.env[name] ?? '').trim();
const hide = (s: string): string => {
  let out = s;
  for (const k of ['PEXELS_API_KEY', 'PIXABAY_API_KEY']) if (keyOf(k).length >= 4) out = out.split(keyOf(k)).join('<' + k + '>');
  return out;
};

/** Fill in a Mixkit clip's size, shape and file size: the thumbnail gives the shape, a HEAD request the bytes. */
async function completeMixkit(c: VideoCandidate, html: string, height: number | null = null): Promise<void> {
  const thumb = /"thumbnailUrl":"(https:\/\/assets\.mixkit\.co\/videos\/[^"]+\.jpg)"/.exec(html)?.[1];
  const size = thumb ? await thumbSize(thumb) : null;
  // Each size Mixkit serves, with its bytes from a HEAD request; one that does not answer is not offered.
  const list: Rendition[] = [];
  for (const r of c.renditions ?? []) {
    if (shortSide(r) > 1080) continue;
    const bytes = await headSize(r.url);
    if (bytes === null) continue;
    const short = shortSide(r);
    let width: number | null = null;
    let tall: number | null = short;
    if (size) {
      const long = Math.round((short * Math.max(size.width, size.height)) / Math.min(size.width, size.height));
      width = size.width >= size.height ? long : short;
      tall = size.width >= size.height ? short : long;
    }
    list.push({ url: r.url, width, height: tall, bytes });
  }
  if (list.length) c.renditions = list;
  applyRendition(c, height);
}

async function searchMixkit(query: string, want: number, o: VideoOptions, skipped: string[]): Promise<VideoCandidate[]> {
  const html = await getText(`https://mixkit.co/free-stock-video/discover/${encodeURIComponent(slug(query, 60))}/`);
  const pages = parseMixkitSearch(html).slice(0, Math.max(want * 3, 12));
  const out: VideoCandidate[] = [];
  for (const page of pages) {
    if (out.length >= want) break;
    try {
      const item = await getText(page);
      const c = parseMixkitItem(item, page);
      if (typeof c === 'string') {
        skipped.push(`${page}: ${c}`);
        continue;
      }
      await completeMixkit(c, item);
      const why = videoRejectReason(c, o);
      if (why) skipped.push(`${page}: ${why}`);
      else out.push(c);
    } catch (err) {
      skipped.push(`${page}: ${describeError(err)}`);
    }
    await pause(300);
  }
  return out;
}

export interface VideoSearch {
  candidates: VideoCandidate[];
  skipped: string[];
  failed: string[];
  asked: VideoSource[];
}

export async function searchVideos(o: VideoOptions): Promise<VideoSearch> {
  const q = o.query ?? '';
  const keys = { pexels: keyOf('PEXELS_API_KEY'), pixabay: keyOf('PIXABAY_API_KEY') };
  const asked = (o.sources ?? VIDEO_SOURCES.filter((s) => (s === 'pexels' ? !!keys.pexels : s === 'pixabay' ? !!keys.pixabay : true))).filter((s) => s !== 'pexels' || !!keys.pexels).filter((s) => s !== 'pixabay' || !!keys.pixabay);
  const r: VideoSearch = { candidates: [], skipped: [], failed: [], asked };
  if (o.sources?.includes('pexels') && !keys.pexels) r.failed.push('Pexels: set PEXELS_API_KEY to search it');
  if (o.sources?.includes('pixabay') && !keys.pixabay) r.failed.push('Pixabay: set PIXABAY_API_KEY to search it');
  const filter = (list: VideoCandidate[], name: string): VideoCandidate[] => list.filter((c) => {
    const why = videoRejectReason(c, o);
    if (why) r.skipped.push(`${name} "${c.title}": ${why}`);
    return !why;
  });
  for (const s of asked) {
    try {
      if (s === 'mixkit') r.candidates.push(...(await searchMixkit(q, o.count, o, r.skipped)));
      else if (s === 'wikimedia') {
        const parsed = parseCommonsVideo(await getJson(commonsVideoUrl(q, 30)));
        r.skipped.push(...parsed.skipped.map((x) => 'Commons ' + x));
        r.candidates.push(...filter(parsed.candidates, 'Commons').slice(0, o.count));
      } else if (s === 'pexels') r.candidates.push(...filter(parsePexelsVideos(await getJson(pexelsVideoUrl(q, 30, o.orientation), { Authorization: keys.pexels })), 'Pexels').slice(0, o.count));
      else if (s === 'pixabay') r.candidates.push(...filter(parsePixabayVideos(await getJson(pixabayVideoUrl(q, keys.pixabay, 30))), 'Pixabay').slice(0, o.count));
    } catch (err) {
      r.failed.push(`${s}: ${hide(describeError(err))}`);
    }
  }
  // Keyless first in the list, but no more than --count overall, alternating sources.
  const bySource = asked.map((s) => r.candidates.filter((c) => c.source === s));
  const mixed: VideoCandidate[] = [];
  for (let i = 0; mixed.length < o.count && bySource.some((l) => l[i]); i++) for (const l of bySource) if (l[i] && mixed.length < o.count) mixed.push(l[i]!);
  r.candidates = mixed;
  return r;
}

// ---- get: one clip, downloaded with its credit -----------------------------------------------

export type VideoPage = { kind: 'mixkit'; url: string } | { kind: 'commons'; title: string; url: string } | { kind: 'pexels'; id: string; url: string } | { kind: 'pixabay'; id: string; url: string } | { kind: 'file'; url: string };

/** What a video address is: a clip page on a known library, or a direct file. Null for anything else. */
export function videoPageOf(raw: string): VideoPage | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'mixkit.co' && /^\/free-stock-video\/[a-z0-9-]+-\d+\/?$/.test(u.pathname)) return { kind: 'mixkit', url: 'https://mixkit.co' + u.pathname.replace(/\/?$/, '/') };
  if (host === 'commons.wikimedia.org' && /^\/wiki\/File:.+\.(webm|ogv|mp4|mpg|mpeg)$/i.test(decodeURIComponent(u.pathname))) return { kind: 'commons', title: decodeURIComponent(u.pathname.slice('/wiki/'.length)), url: raw };
  const px = /^\/(?:[a-z]{2}-[a-z]{2}\/)?video\/(?:[^/]*-)?(\d+)\/?$/.exec(u.pathname);
  if (host === 'pexels.com' && px) return { kind: 'pexels', id: px[1]!, url: raw };
  const pb = /^\/videos\/(?:[^/]*-)?(\d+)\/?$/.exec(u.pathname);
  if (host === 'pixabay.com' && pb) return { kind: 'pixabay', id: pb[1]!, url: raw };
  if (VIDEO_FILE.test(u.pathname)) return { kind: 'file', url: raw };
  return null;
}

async function resolvePage(p: VideoPage, height: number | null): Promise<VideoCandidate | string> {
  if (p.kind === 'mixkit') {
    const html = await getText(p.url);
    const c = parseMixkitItem(html, p.url);
    if (typeof c === 'string') return c;
    await completeMixkit(c, html, height);
    return c;
  }
  if (p.kind === 'commons') {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    for (const [k, v] of Object.entries({ action: 'query', format: 'json', formatversion: '2', titles: p.title, prop: 'videoinfo', viprop: 'url|size|mime|extmetadata|derivatives', viextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|AttributionRequired' })) u.searchParams.set(k, v);
    const parsed = parseCommonsVideo(await getJson(u.toString()));
    const c = parsed.candidates[0];
    return c ? applyRendition(c, height) : parsed.skipped[0] ?? 'Commons has no video at that address';
  }
  if (p.kind === 'pexels') {
    const key = keyOf('PEXELS_API_KEY');
    if (!key) return 'Pexels pages ask for a browser check: set PEXELS_API_KEY, or download the file by hand and write its credit';
    const c = pexelsVideo(await getJson('https://api.pexels.com/videos/videos/' + encodeURIComponent(p.id), { Authorization: key }));
    return c ? applyRendition(c, height) : 'Pexels returned no MP4 file';
  }
  if (p.kind === 'pixabay') {
    const key = keyOf('PIXABAY_API_KEY');
    if (!key) return 'Pixabay pages ask for a browser check: set PIXABAY_API_KEY, or download the file by hand and write its credit';
    const u = new URL('https://pixabay.com/api/videos/');
    u.searchParams.set('key', key);
    u.searchParams.set('id', p.id);
    const c = parsePixabayVideos(await getJson(u.toString()))[0];
    return c ? applyRendition(c, height) : 'Pixabay returned no file';
  }
  return {
    source: 'direct', title: path.basename(new URL(p.url).pathname).replace(VIDEO_FILE, ''), author: 'unknown: write it in', pageUrl: p.url, fileUrl: p.url,
    licence: 'unknown: write the licence in before use', licenceUrl: '', credit: true, width: null, height: null, seconds: null, bytes: null, fps: null,
  };
}

/** Download a file to disk in pieces, refusing anything over MAX_VIDEO_BYTES. */
async function downloadTo(url: string, dest: string): Promise<number> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok || !res.body) throw new Error('the file answered ' + res.status);
  const declared = num(res.headers.get('content-length'));
  if (declared && declared > MAX_VIDEO_BYTES) throw new Error(`the file is too large (${mb(declared)})`);
  const type = res.headers.get('content-type') ?? '';
  if (type && !/^video\/|octet-stream|application\/ogg/.test(type)) throw new Error('not a video file (' + type + ')');
  const fd = fs.openSync(dest + '.part', 'w');
  let total = 0;
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > MAX_VIDEO_BYTES) throw new Error(`the file is too large (over ${mb(MAX_VIDEO_BYTES)})`);
      fs.writeSync(fd, chunk);
    }
  } catch (err) {
    fs.closeSync(fd);
    fs.rmSync(dest + '.part', { force: true });
    throw err;
  }
  fs.closeSync(fd);
  fs.renameSync(dest + '.part', dest);
  return total;
}

const extOf = (url: string): string => (/\.(mp4|m4v|webm|mov|ogv)(?:$|[?#])/i.exec(url)?.[1] ?? 'mp4').toLowerCase();

export interface VideoCredit {
  file: string;
  title: string;
  author: string;
  source: string;
  sourcePage: string;
  licence: string;
  licenceUrl: string;
  width: number | null;
  height: number | null;
  search: string;
  kind: 'video';
  seconds: number | null;
  creditRequired: boolean;
}

export function videoCredit(c: VideoCandidate, file: string): VideoCredit {
  return {
    file, title: c.title, author: c.author, source: c.source, sourcePage: c.pageUrl, licence: c.licence, licenceUrl: c.licenceUrl,
    width: c.width, height: c.height, search: 'video get', kind: 'video', seconds: c.seconds, creditRequired: c.credit,
  };
}

async function getVideo(o: VideoOptions): Promise<number> {
  const page = videoPageOf(o.target ?? '');
  if (!page) return say(o, ['Not a clip page or video file address: ' + o.target, 'Give a Mixkit clip page (https://mixkit.co/free-stock-video/...-1234/), a Commons File: page, a Pexels or Pixabay video page (with its API key), or a direct https address of an .mp4 or .webm file.'], 1);
  let c: VideoCandidate | string;
  try {
    c = await resolvePage(page, o.height);
  } catch (err) {
    return say(o, ['Could not read ' + page.url + ': ' + hide(describeError(err))], 2);
  }
  if (typeof c === 'string') return say(o, ['Not taken: ' + c + ' (' + page.url + ')'], 2);
  const dir = o.out ?? 'media';
  fs.mkdirSync(dir, { recursive: true });
  const file = `${slug(c.title, 40)}-${c.source}${c.height ? '-' + Math.min(c.width ?? c.height, c.height) : ''}.${extOf(c.fileUrl)}`;
  let bytes: number;
  try {
    bytes = await downloadTo(c.fileUrl, path.join(dir, file));
  } catch (err) {
    return say(o, ['Could not download ' + c.fileUrl + ': ' + hide(describeError(err))], 2);
  }
  c.bytes = bytes;
  const credits = writeCredits(dir, [videoCredit(c, file)]);
  if (o.json) console.log(JSON.stringify({ file: path.resolve(dir, file), bytes, candidate: c, credits: path.resolve(credits) }, null, 2));
  else {
    console.log(`Saved ${path.resolve(dir, file)} (${mb(bytes)}${c.seconds ? ', ' + Math.round(c.seconds) + 's' : ''}${c.width ? ', ' + c.width + 'x' + c.height : ''}).`);
    console.log(`Licence: ${c.licence}${c.credit ? ' (needs a visible credit)' : ''}; credit written to ${path.resolve(credits)}.`);
    if (c.renditions && c.renditions.length > 1) console.log(`Sizes offered: ${renditionLine(c)}. Another with --height 360|720|1080.`);
    if (page.kind === 'file') console.log('A direct file: write its author, source page and licence into credits.json before using it.');
    for (const line of nextAfterGet(path.join(dir, file), bytes, !!findTool('ffmpeg'))) console.log(line);
  }
  return 0;
}

/** What to do after video get: the loop only when ffmpeg is there to make it. */
export function nextAfterGet(file: string, bytes: number, ffmpeg: boolean): string[] {
  if (ffmpeg) return [`Next: watch the whole clip, then photos.js poster "${file}" --at 1 and photos.js loop "${file}" --seconds 10 (pictures.md).`];
  return [
    `Next: watch the whole clip, then photos.js poster "${file}" --at 1 (works without ffmpeg).`,
    bytes > SOURCE_BUDGET
      ? `It is ${mb(bytes)}, over the ${mb(SOURCE_BUDGET)} a page loop should weigh, and cutting it needs ffmpeg (not installed). ${FFMPEG_INSTALL} Or use the poster as a still: a still is always a good answer.`
      : `It is ${mb(bytes)}, within the ${mb(SOURCE_BUDGET)} budget, so it can be used as it is; ffmpeg (not installed) would make the WebM and phone files.`,
  ];
}

// ---- poster and loop --------------------------------------------------------------------------

export const FFMPEG_INSTALL = 'Install ffmpeg: macOS "brew install ffmpeg"; Debian or Ubuntu "sudo apt install ffmpeg"; Windows "winget install Gyan.FFmpeg".';

/** The ffmpeg argument lists for the web renditions and the poster of one clip (pictures.md). */
export function loopCommands(input: string, outDir: string, o: Pick<VideoOptions, 'seconds' | 'from' | 'width' | 'fps'>): Array<{ file: string; args: string[] }> {
  // a-clip-mixkit-720.mp4 becomes a-clip-mixkit-1080.mp4 and so on, not a-clip-mixkit-720-1080.mp4.
  const stem = path.join(outDir, slug(path.basename(input).replace(VIDEO_FILE, ''), 40).replace(/-\d{3,4}$/, ''));
  const seconds = String(o.seconds ?? 10);
  const cut = ['-y', '-ss', String(o.from), '-t', seconds, '-i', input, '-an', '-sn', '-dn', '-map_metadata', '-1'];
  const scale = (w: number): string => `scale='min(${w},iw)':-2,fps=${Math.min(o.fps, 30)}`;
  const small = Math.min(1280, o.width);
  return [
    { file: `${stem}-1080.mp4`, args: [...cut, '-vf', scale(o.width), '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-maxrate', '2500k', '-bufsize', '5000k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${stem}-1080.mp4`] },
    { file: `${stem}-1080.webm`, args: [...cut, '-vf', scale(o.width), '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '2000k', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', `${stem}-1080.webm`] },
    { file: `${stem}-720.mp4`, args: [...cut, '-vf', scale(small), '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-maxrate', '1000k', '-bufsize', '2000k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${stem}-720.mp4`] },
    { file: `${stem}-poster.jpg`, args: ['-y', '-ss', String(o.from + Math.min(1, (o.seconds ?? 10) / 2)), '-i', input, '-frames:v', '1', '-vf', `scale='min(${o.width},iw)':-2`, '-q:v', '3', `${stem}-poster.jpg`] },
  ];
}

/**
 * One argument of a command printed for the user to run in their own shell. POSIX shells take a
 * backslash escape inside double quotes; cmd and PowerShell on Windows do not (a Windows path would
 * come out with every backslash doubled), so there only a double quote is escaped, by doubling it.
 */
export function quote(a: string, platform: NodeJS.Platform = process.platform): string {
  if (/^[\w./:=+,-]+$/.test(a)) return a;
  if (platform === 'win32') return `"${a.replace(/"/g, '""')}"`;
  return `"${a.replace(/(["\\$`])/g, '\\$1')}"`;
}

async function loop(o: VideoOptions): Promise<number> {
  const input = o.target ?? '';
  if (!fs.existsSync(input) || !fs.statSync(input).isFile()) return say(o, ['Not a file: ' + path.resolve(input)], 1);
  const outDir = o.out ?? path.dirname(input);
  const jobs = loopCommands(input, outDir, o);
  const ffmpeg = findTool('ffmpeg');
  if (!ffmpeg) {
    return say(o, ['loop needs ffmpeg, which is not installed. ' + FFMPEG_INSTALL, 'Then run this again, or run these yourself:', ...jobs.map((j) => '  ffmpeg ' + j.args.map((a) => quote(a)).join(' '))], 2);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const made: Array<{ file: string; bytes: number; over: boolean }> = [];
  for (const j of jobs) {
    const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...j.args], { encoding: 'utf8' });
    if (r.status !== 0 || !fs.existsSync(j.file)) {
      const why = (r.stderr || '').trim().split('\n').slice(-2).join(' ');
      return say(o, [`ffmpeg could not make ${j.file}: ${why || 'it failed'}`, /libvpx|libx264|Unknown encoder/i.test(why) ? 'This ffmpeg lacks that encoder; a full build (brew install ffmpeg) has it.' : ''].filter(Boolean), 2);
    }
    const bytes = fs.statSync(j.file).size;
    const budget = /-720\.mp4$/.test(j.file) ? VIDEO_BUDGETS.small : /\.jpg$/.test(j.file) ? 250 * 1024 : VIDEO_BUDGETS.large;
    made.push({ file: j.file, bytes, over: bytes > budget });
  }
  if (o.json) console.log(JSON.stringify({ made, budgets: VIDEO_BUDGETS }, null, 2));
  else {
    console.log(`Made ${made.length} files from ${input} (${o.seconds}s from ${o.from}s, no sound, at most ${Math.min(o.fps, 30)} fps):`);
    for (const m of made) console.log(`  ${m.file}  ${mb(m.bytes)}${m.over ? '  OVER BUDGET: cut it shorter, or lower the width or the quality (raise -crf)' : ''}`);
    console.log('Check the poster with photos.js sharp, then use the markup in pictures.md (pause button, reduced motion, saved data).');
  }
  return 0;
}

/** Take one frame of a video as a JPEG: with ffmpeg when installed, else in the headless browser. Returns how. */
export async function posterFrame(input: string, out: string, at: number): Promise<'ffmpeg' | 'browser'> {
  const ffmpeg = findTool('ffmpeg');
  if (ffmpeg) {
    const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(at), '-i', input, '-frames:v', '1', '-q:v', '3', out], { encoding: 'utf8' });
    if (r.status === 0 && fs.existsSync(out)) return 'ffmpeg';
  }
  const dir = path.dirname(path.resolve(input));
  const name = path.basename(input);
  const outDir = path.dirname(path.resolve(out));
  fs.mkdirSync(outDir, { recursive: true });
  const lab = await openLab(dir, [name], outDir);
  try {
    await lab.run(`window.__a.poster(${JSON.stringify(name)}, ${JSON.stringify(path.basename(out))}, ${at})`, 60000);
  } finally {
    await lab.close();
  }
  if (!fs.existsSync(out)) throw new Error('the browser made no file');
  return 'browser';
}

async function poster(o: VideoOptions): Promise<number> {
  const input = o.target ?? '';
  if (!fs.existsSync(input) || !fs.statSync(input).isFile()) return say(o, ['Not a file: ' + path.resolve(input)], 1);
  const out = o.out ?? input.replace(VIDEO_FILE, '') + '-poster.jpg';
  let how: string;
  try {
    how = await posterFrame(input, out, o.at);
  } catch (err) {
    return say(o, [`Could not take a frame (${err instanceof Error ? err.message : String(err)}). ${FFMPEG_INSTALL} The browser route needs a Chrome-family browser that decodes the file (H.264 needs Google Chrome; WebM decodes everywhere).`], 2);
  }
  const size = imageSize(fs.readFileSync(out).subarray(0, 256 * 1024));
  if (o.json) console.log(JSON.stringify({ poster: path.resolve(out), at: o.at, method: how, width: size?.width ?? null, height: size?.height ?? null, bytes: fs.statSync(out).size }, null, 2));
  else console.log(`Poster frame at ${o.at}s: ${path.resolve(out)} (${size ? size.width + 'x' + size.height + ', ' : ''}${mb(fs.statSync(out).size)}, made with ${how === 'ffmpeg' ? 'ffmpeg' : 'the browser'}). Check it with photos.js sharp and deliver it like a photograph.`);
  return 0;
}

// ---- output ---------------------------------------------------------------------------------

function say(o: Pick<VideoOptions, 'json'>, lines: string[], code: number): number {
  if (o.json) console.log(JSON.stringify({ error: lines.join(' ') }, null, 2));
  else console.log(lines.join('\n'));
  return code;
}

export function videoTable(list: VideoCandidate[]): string[] {
  return list.map((c, i) => [
    `${String(i + 1).padStart(2)}. ${c.title}  [${c.source}]`,
    `    ${c.seconds !== null ? Math.round(c.seconds) + 's' : '?s'}, ${c.width && c.height ? c.width + 'x' + c.height : 'size ?'}${c.fps ? ', ' + c.fps + ' fps' : ''}, ${mb(c.bytes)}; by ${c.author}; ${c.licence}${c.credit ? ' (credit required)' : ' (no credit required)'}`,
    ...(c.renditions && c.renditions.length > 1 ? [`    sizes ${renditionLine(c)}`] : []),
    `    page ${c.pageUrl}`,
    `    file ${c.fileUrl}`,
  ].join('\n'));
}

async function search(o: VideoOptions): Promise<number> {
  const r = await searchVideos(o);
  if (o.json) {
    console.log(JSON.stringify({ query: o.query, sources: r.asked, candidates: r.candidates, skipped: r.skipped, failed: r.failed }, null, 2));
    return r.candidates.length ? 0 : 2;
  }
  console.log(`Video search: "${o.query}" in ${r.asked.join(', ') || 'no source'}; ${r.candidates.length} candidate${r.candidates.length === 1 ? '' : 's'}${r.skipped.length ? `, ${r.skipped.length} left out (licence, length, width or shape)` : ''}. Nothing is downloaded yet.`);
  for (const line of videoTable(r.candidates)) console.log(line);
  for (const f of r.failed) console.log('Not searched: ' + f);
  const refused = r.skipped.filter((s) => /personal use only/.test(s)).length;
  if (refused) console.log(`${refused} Mixkit clip${refused === 1 ? ' was' : 's were'} refused: under its Restricted licence, for personal use only.`);
  if (!keyOf('PEXELS_API_KEY') && !keyOf('PIXABAY_API_KEY')) console.log('Pexels and Pixabay need PEXELS_API_KEY or PIXABAY_API_KEY to be searched.');
  if (r.candidates.length) console.log('Watch a clip on its page, then: photos.js video get <page-url> --out media/');
  else console.log('Nothing found. Try other words (the place, the act, the material), or a still photograph: a still is always a good answer.');
  return r.candidates.length ? 0 : 2;
}

export const VIDEO_USAGE = [
  'Usage: node photos.js video "<words>" [--count N] [--max-seconds N] [--min-width N] [--orientation landscape|portrait] [--source LIST] [--json]',
  '       node photos.js video get <clip-page-or-file-url> [--out DIR] [--height 360|720|1080|2160] [--json]',
  '       node photos.js poster <video> [--at SECONDS] [--out FILE] [--json]',
  '       node photos.js loop <video> --seconds N [--from S] [--width 1920] [--fps 25] [--out DIR] [--json]',
  '',
  'video lists free-licence clips for a page opening, with length, size, frame rate, file size, licence,',
  'page and file address; nothing is downloaded. Sources (--source mixkit,wikimedia,pexels,pixabay):',
  '  mixkit     keyless; only clips under the Mixkit Free licence (commercial use, no credit needed).',
  '             Clips under its Restricted licence (personal use only) are refused.',
  '  wikimedia  keyless; Commons clips under a reusable licence (CC0, public domain, CC BY, CC BY-SA);',
  '             most need a visible credit.',
  '  pexels, pixabay  with PEXELS_API_KEY or PIXABAY_API_KEY set; never printed.',
  'Each clip lists the sizes its library offers, with their bytes where known. video get downloads',
  'one into DIR (default ./media): by default the smallest at least 720 high (on its short side) under',
  'the 4 MB budget, else the smallest at least 720; --height picks the nearest to it. It',
  'writes its credit to credits.json, as photographs do. photos.js add <clip-page> does the same.',
  'poster takes one frame as a JPEG (ffmpeg, else the headless browser). loop needs ffmpeg: it cuts',
  '--seconds from --from, drops the sound, caps the frame rate at 30, and writes <name>-1080.mp4 (H.264),',
  '<name>-1080.webm (VP9), <name>-720.mp4 for phones and <name>-poster.jpg, with sizes against the budgets',
  '(about 4 MB and 1.5 MB). See references/pictures.md for markup, pause control and reduced motion.',
];

export async function main(argv: string[]): Promise<number> {
  const o = parseVideoArgs(argv);
  if (o.help) {
    console.log(VIDEO_USAGE.join('\n'));
    return 0;
  }
  const missing = o.command === 'video' ? !o.query : !o.target;
  if (o.bad.length || missing) {
    console.log((o.bad.length ? 'Not understood: ' + o.bad.join(' ') : o.command === 'video' ? 'video needs search words.' : o.command + ' needs a ' + (o.command === 'get' ? 'clip page or file address.' : 'video file.')) + '\n');
    console.log(VIDEO_USAGE.join('\n'));
    return 1;
  }
  if (o.command === 'poster') return poster(o);
  if (o.command === 'loop') return loop(o);
  if (typeof fetch !== 'function') return say(o, ['This needs Node 22 or later (you have ' + process.version + ').'], 2);
  if (o.command === 'get') return getVideo(o);
  return search(o);
}

/** For photos.js sharp on a video: its poster frame in a temporary folder. */
export async function posterForMeasuring(input: string, at = 1): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-poster-'));
  const out = path.join(dir, path.basename(input).replace(VIDEO_FILE, '') + '-poster.jpg');
  await posterFrame(input, out, at);
  return out;
}

// Run directly (node video.js), this file is a helper of photos.js: print how to reach its commands.
if (require.main === module) {
  console.log('video.js is part of photos.js. Run its commands through photos.js:\n');
  console.log(VIDEO_USAGE.join('\n'));
  process.exitCode = process.argv.length > 2 && !process.argv.slice(2).some((a) => a === '--help' || a === '-h') ? 1 : 0;
}
