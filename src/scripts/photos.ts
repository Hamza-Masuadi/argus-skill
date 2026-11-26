#!/usr/bin/env node
/*
 * Argus photos. Finds free-licence photographs for a page, downloads candidates with a credits file
 * recording where each came from, and prepares the chosen ones for the page.
 *
 * This is the one Argus tool that uses the network, and only when you run it, and only for search,
 * add and series. It sends only the search words (or the addresses it is given). The keyless sources
 * are Openverse (api.openverse.org) and Wikimedia Commons; with --source it also asks open archives
 * (Europeana, Cleveland Museum of Art, The Met, NASA, Smithsonian). With PEXELS_API_KEY or
 * PIXABAY_API_KEY in the environment it also asks Pexels or Pixabay; a key is sent only to its own
 * service and is never printed or written anywhere. A source that fails is reported in one line and
 * the others are used. sheet, sharp, palette, grade, deliver and cutout work on local files only: they render in the
 * installed Chrome-family browser that shot.js uses (headless, a throwaway profile, a server on
 * 127.0.0.1 that only this run can reach), or call ImageMagick, sips, avifenc or rembg when present.
 *
 * Commands (each takes --help):
 *   photos.js "<search words>" [--count N] [--source LIST] [--creator NAME] [--page N] [--best] ...
 *   photos.js add <photo-page-url>... [--out DIR] [--width N]
 *   photos.js series <unsplash-or-pexels-url | openverse-image-url> [--limit N] --out DIR
 *   photos.js series --creator "<name>" [--source PROVIDER] [--limit N] --out DIR
 *   photos.js sheet <dir> [--out sheet.jpg] [--columns N]
 *   photos.js sharp <file|dir> [--width N]
 *   photos.js palette <file> [--json]
 *   photos.js grade <dir> --look mono|duotone|warm|cool [--ink #hex --paper #hex] [--out DIR]
 *   photos.js deliver <dir> [--widths 640,1024,1600,2400] [--sizes "..."] [--hero FILE] [--out DIR]
 *   photos.js cutout <file> [--out file.png] [--tolerance N] [--feather N] [--method auto|rembg|canvas]
 *
 * Search keeps only pictures whose licence allows commercial use and changes (CC0, public domain,
 * CC BY, CC BY-SA, and the Pexels and Pixabay licences), skips anything under about 1200px on the
 * long side, and writes credits.json beside the files: title, author, source page, licence and
 * licence address for each. search, add and series write entries of exactly the same shape.
 * Every candidate must still be looked at before it is used.
 *
 * Exit codes: 0 when the command did its work, 1 for a usage error, 2 when nothing could be
 * downloaded or made (no results, no network, no browser). Needs Node 22 or later.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import * as net from 'node:net';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { findBrowser, localJson, stopBrowser } from './shot';

export type Orientation = 'landscape' | 'portrait' | 'square';
export type Source = 'openverse' | 'wikimedia' | 'pexels' | 'unsplash' | 'pixabay' | 'europeana' | 'cleveland' | 'met' | 'nasa' | 'smithsonian';
export type Command = 'search' | 'add' | 'series' | 'sheet' | 'sharp' | 'palette' | 'grade' | 'deliver' | 'cutout';
export type Look = 'mono' | 'duotone' | 'warm' | 'cool';

export interface Options {
  command: Command;
  query: string | null;
  count: number;
  out: string;
  /** Whether --out was given (each command has its own default). */
  outGiven: boolean;
  orientation: Orientation | null;
  /** Leave out pictures narrower than this many pixels; null keeps every width. */
  minWidth: number | null;
  /** Commons: quality and featured pictures first; Pixabay: editors' choice. */
  best: boolean;
  json: boolean;
  help: boolean;
  bad: string[];
  /** add: photo page addresses to take, in place of a search. */
  add: string[] | null;
  /** add and series: the width to download at. */
  width: number;
  /** --source: source and Openverse provider names; null means the defaults. */
  sources: string[] | null;
  /** --creator: one photographer's name, for Openverse. */
  creator: string | null;
  /** --page: which page of results to start from. */
  page: number;
  /** series: the address; sheet, grade, deliver: the folder; cutout: the file. */
  target: string | null;
  /** series: how many to download. */
  limit: number;
  look: Look | null;
  ink: string | null;
  paper: string | null;
  widths: number[];
  sizes: string;
  hero: string | null;
  /** deliver: re-encode, then step down in size, until every file is under this many kB; null keeps the defaults. */
  maxKb: number | null;
  tolerance: number;
  feather: number;
  method: 'auto' | 'rembg' | 'canvas';
  engine: 'auto' | 'browser' | 'magick';
  columns: number;
}

export interface Candidate {
  source: Source;
  title: string;
  author: string;
  /** The page that describes the picture and its licence. */
  pageUrl: string;
  /** The image file to download. */
  imageUrl: string;
  licence: string;
  licenceUrl: string;
  /** The size of the file that will be downloaded, when known. */
  width: number | null;
  height: number | null;
  /** Commons only: the original file's pixel count, for --best. */
  pixels?: number | null;
  /** Commons only: 3 featured, 2 quality, 1 valued image, 0 none. */
  quality?: number;
  /** Openverse only: the provider it indexes (stocksnap, rawpixel, wikimedia...). */
  provider?: string;
  /** Set when only a preview can be downloaded: why, and the full size to fetch by hand. */
  byHand?: { reason: string; width: number | null; height: number | null };
}

export interface Parsed {
  candidates: Candidate[];
  /** One line per result left out, with the reason. */
  skipped: string[];
  /** Openverse: how many pages of results there are. */
  pageCount?: number;
  /** How many results the source says it has. */
  total?: number;
}

export interface Credit {
  file: string;
  title: string;
  author: string;
  source: Source;
  sourcePage: string;
  licence: string;
  licenceUrl: string;
  width: number | null;
  height: number | null;
  search: string;
}

export const MIN_LONG_SIDE = 1200;
export const MAX_COUNT = 20;
export const MAX_LIMIT = 30;
const MAX_BYTES = 30 * 1024 * 1024;
const SEARCH_TIMEOUT_MS = 30000;
const DOWNLOAD_TIMEOUT_MS = 45000;
const USER_AGENT = 'argus-skill-photos (free-licence image search for a design skill; https://www.npmjs.com/package/argus-skill)';
/** The longest side asked of Pexels, which scales its files on request. */
const PEXELS_WIDTH = 1920;
export const PEXELS_LICENCE = 'Pexels licence';
export const PEXELS_LICENCE_URL = 'https://www.pexels.com/license/';
export const PIXABAY_LICENCE = 'Pixabay Content Licence';
export const PIXABAY_LICENCE_URL = 'https://pixabay.com/service/license-summary/';
const CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';
const SOURCE_NAMES: Record<Source, string> = {
  openverse: 'Openverse', wikimedia: 'Wikimedia Commons', pexels: 'Pexels', unsplash: 'Unsplash', pixabay: 'Pixabay',
  europeana: 'Europeana', cleveland: 'Cleveland Museum of Art', met: 'The Met', nasa: 'NASA', smithsonian: 'Smithsonian',
};
/** The licence names and addresses recorded for photographs taken with add and series. */
export const SITE_LICENCES: Record<'unsplash' | 'pexels', { licence: string; licenceUrl: string }> = {
  unsplash: { licence: 'Unsplash Licence', licenceUrl: 'https://unsplash.com/license' },
  pexels: { licence: 'Pexels Licence', licenceUrl: 'https://www.pexels.com/license/' },
};
export const ADD_WIDTH = 2000;
const MAX_ADD_WIDTH = 6000;
const PAGE_TIMEOUT_MS = 20000;
const MAX_PAGE_BYTES = 5 * 1024 * 1024;
/** Pause between requests to one photographer's pages, to be polite. */
export const SERIES_PAUSE_MS = 1000;
/** Openverse lets an anonymous caller page through at most 240 results. */
const OPENVERSE_DEPTH = 240;
const OPENVERSE_PAGE_SIZE = 20;
/** Openverse providers whose linked file is a small preview, with the size of that preview. */
const PREVIEW_ONLY: Record<string, { name: string; long: number; why: string }> = {
  stocksnap: { name: 'StockSnap', long: 960, why: 'StockSnap: Openverse links only a 960px preview, and stocksnap.io turns away automated downloads' },
  // Checked 24 Nov 2026: the image_1300 copy of the same file carries a rawpixel watermark.
  rawpixel: { name: 'rawpixel', long: 1024, why: 'rawpixel: Openverse links a 1024px copy, larger copies carry a watermark, and the full file needs a free rawpixel account' },
};
/** Openverse providers that can be named in --source (the sources it indexes; checked 24 Nov 2026). */
export const OPENVERSE_PROVIDERS = [
  'stocksnap', 'rawpixel', 'nappy', 'wordpress', 'flickr', 'geographorguk', 'clevelandmuseum', 'brooklynmuseum',
  'rijksmuseum', 'smk', 'sciencemuseum', 'museumsvictoria', 'digitaltmuseum', 'finnish_heritage_agency', 'wellcome_collection', 'nypl',
  'smithsonian_american_art_museum', 'smithsonian_national_museum_of_natural_history', 'smithsonian_american_history_museum', 'spacex',
  'justtakeitfree', 'woc_tech', 'inaturalist', 'svgsilh', 'animaldiversity',
];
/** The sources --source can name besides Openverse providers. wikimedia (or commons) is the Commons search. */
export const SEARCH_SOURCES = ['openverse', 'wikimedia', 'commons', 'pexels', 'pixabay', 'europeana', 'cleveland', 'met', 'nasa', 'smithsonian'] as const;
export const ARCHIVES = ['europeana', 'cleveland', 'met', 'nasa', 'smithsonian'] as const;
type Archive = (typeof ARCHIVES)[number];

const COMMANDS: Command[] = ['add', 'series', 'sheet', 'sharp', 'palette', 'grade', 'deliver', 'cutout'];
export const DEFAULT_WIDTHS = [640, 1024, 1600, 2400];
const DEFAULT_LOOK_COLOURS: Record<Look, { ink: string; paper: string }> = {
  mono: { ink: '#1b1a18', paper: '#f4f2ee' },
  duotone: { ink: '#1f2a44', paper: '#f1e6d2' },
  warm: { ink: '', paper: '' },
  cool: { ink: '', paper: '' },
};
/**
 * photos.js sharp: the width a picture is measured at by default (about a half-screen picture on a
 * laptop), and the levels under which it is flagged. Warnings for a person to look at, never gates:
 * a plain subject (a sky, a studio ground, a misty field) also measures low, and a low-key photograph
 * is dark on purpose.
 */
export const SHARP_WIDTH = 1024;
export const SOFT_BELOW = 100;
export const DARK_BELOW = 70;

/** The plain-words verdict for one measured picture. */
export function sharpVerdict(m: { sharpness: number; brightness: number }): string[] {
  const out: string[] = [];
  if (m.sharpness < SOFT_BELOW) out.push('likely soft');
  if (m.brightness < DARK_BELOW) out.push('likely dark');
  return out;
}

/** Byte budgets from the research: a hero picture and every other picture, at the widths served. */
export const BUDGETS = { hero: 250 * 1024, other: 120 * 1024 };

// ---- arguments ------------------------------------------------------------------------------

/** Which flags each command takes. A flag given to a command that does not take it is not understood. */
const FLAGS: Record<Command, string[]> = {
  search: ['--count', '-n', '--out', '--orientation', '--min-width', '--best', '--json', '--source', '--creator', '--page'],
  add: ['--out', '--width', '--json'],
  series: ['--out', '--limit', '--width', '--json', '--source', '--creator', '--page'],
  sheet: ['--out', '--columns', '--json'],
  sharp: ['--width', '--json'],
  palette: ['--json'],
  grade: ['--out', '--look', '--ink', '--paper', '--engine', '--json'],
  deliver: ['--out', '--widths', '--sizes', '--hero', '--max-kb', '--json'],
  cutout: ['--out', '--tolerance', '--feather', '--method', '--json'],
};
const SEARCH_ONLY = ['--count', '-n', '--orientation', '--min-width', '--best'];

const hexColour = (v: string): string | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = (m[1] ?? '').toLowerCase();
  return '#' + (h.length === 3 ? h.split('').map((c) => c + c).join('') : h);
};
const intIn = (v: string, lo: number, hi: number): number | null => (/^\d+$/.test(v.trim()) && Number(v) >= lo && Number(v) <= hi ? Number(v) : null);

export function parseArgs(argv: string[]): Options {
  const command: Command = (COMMANDS as string[]).includes(argv[0] ?? '') ? (argv[0] as Command) : 'search';
  const o: Options = {
    command, query: null, count: 8, out: 'photos-candidates', outGiven: false, orientation: null, minWidth: null, best: false, json: false, help: false, bad: [],
    add: null, width: ADD_WIDTH, sources: null, creator: null, page: 1, target: null, limit: 12, look: null, ink: null, paper: null,
    widths: [...DEFAULT_WIDTHS], sizes: '100vw', hero: null, maxKb: null, tolerance: 12, feather: 2, method: 'auto', engine: 'auto', columns: 4,
  };
  const words: string[] = [];
  let widthGiven = false;
  const allowed = new Set([...FLAGS[command], '--help', '-h']);
  const adding = command === 'add';
  let searchOptionsInAdd = false;
  // `photos.js search <words>` is the same as `photos.js <words>`.
  for (let i = command === 'search' && argv[0] !== 'search' ? 0 : 1; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--help' || a === '-h') {
      o.help = true;
      continue;
    }
    if (a.startsWith('-') && !allowed.has(a)) {
      // add has always taken the search options and said why they do not apply.
      if (adding && SEARCH_ONLY.includes(a)) {
        searchOptionsInAdd = true;
        if (a !== '--best') i++;
        continue;
      }
      o.bad.push(a);
      continue;
    }
    if (a === '--count' || a === '-n') {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n >= 1) o.count = Math.min(MAX_COUNT, Math.floor(n));
      else o.bad.push('--count ' + String(argv[i] ?? ''));
    } else if (a === '--out') {
      const dir = argv[++i];
      if (dir) {
        o.out = dir;
        o.outGiven = true;
      } else o.bad.push('--out');
    } else if (a === '--orientation') {
      const v = String(argv[++i] ?? '').toLowerCase();
      if (v === 'landscape' || v === 'portrait' || v === 'square') o.orientation = v;
      else o.bad.push('--orientation ' + v);
    } else if (a === '--min-width') {
      const v = String(argv[++i] ?? '');
      if (/^\d+$/.test(v.trim()) && Number(v) >= 1) o.minWidth = Number(v);
      else o.bad.push('--min-width ' + v);
    } else if (a === '--width') {
      const v = String(argv[++i] ?? '');
      const n = intIn(v, 200, MAX_ADD_WIDTH);
      widthGiven = true;
      if (n) o.width = n;
      else o.bad.push('--width ' + v + ' (200 to ' + MAX_ADD_WIDTH + ')');
    } else if (a === '--limit') {
      const v = String(argv[++i] ?? '');
      const n = intIn(v, 1, MAX_LIMIT);
      if (n) o.limit = n;
      else o.bad.push('--limit ' + v + ' (1 to ' + MAX_LIMIT + ')');
    } else if (a === '--page') {
      const v = String(argv[++i] ?? '');
      const n = intIn(v, 1, OPENVERSE_DEPTH / OPENVERSE_PAGE_SIZE);
      if (n) o.page = n;
      else o.bad.push('--page ' + v + ' (1 to ' + OPENVERSE_DEPTH / OPENVERSE_PAGE_SIZE + ')');
    } else if (a === '--source') {
      const v = String(argv[++i] ?? '');
      const names = v.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
      const unknown = names.filter((n) => !(SEARCH_SOURCES as readonly string[]).includes(n) && !OPENVERSE_PROVIDERS.includes(n));
      if (!names.length) o.bad.push('--source (give a list such as stocksnap,rawpixel,wikimedia)');
      else if (names.includes('unsplash')) o.bad.push('--source unsplash (Unsplash has no search here: choose on unsplash.com and use add or series)');
      else if (unknown.length) o.bad.push('--source ' + unknown.join(',') + ' (not a source; known: ' + SEARCH_SOURCES.filter((s) => s !== 'commons').join(', ') + ', or an Openverse provider such as stocksnap, rawpixel, nappy, wordpress)');
      else o.sources = [...new Set(names.map((n) => (n === 'commons' ? 'wikimedia' : n)))];
    } else if (a === '--creator') {
      const v = String(argv[++i] ?? '').trim();
      if (v && !v.startsWith('--')) o.creator = v;
      else o.bad.push('--creator (give a name)');
    } else if (a === '--look') {
      const v = String(argv[++i] ?? '').toLowerCase();
      if (v === 'mono' || v === 'duotone' || v === 'warm' || v === 'cool') o.look = v;
      else o.bad.push('--look ' + v + ' (mono, duotone, warm or cool)');
    } else if (a === '--ink' || a === '--paper') {
      const v = String(argv[++i] ?? '');
      const h = hexColour(v);
      if (h) o[a === '--ink' ? 'ink' : 'paper'] = h;
      else o.bad.push(a + ' ' + v + ' (a hex colour such as #1f2a44)');
    } else if (a === '--widths') {
      const v = String(argv[++i] ?? '');
      const list = v.split(',').map((s) => intIn(s, 100, 6000));
      if (list.length && list.every((n) => n !== null)) o.widths = [...new Set(list as number[])].sort((x, y) => x - y);
      else o.bad.push('--widths ' + v + ' (a list such as 640,1024,1600,2400, each 100 to 6000)');
    } else if (a === '--sizes') {
      const v = String(argv[++i] ?? '').trim();
      if (v) o.sizes = v;
      else o.bad.push('--sizes');
    } else if (a === '--hero') {
      const v = String(argv[++i] ?? '').trim();
      if (v) o.hero = path.basename(v);
      else o.bad.push('--hero (give a file name)');
    } else if (a === '--max-kb') {
      const v = String(argv[++i] ?? '');
      const n = intIn(v, 10, 5000);
      if (n) o.maxKb = n;
      else o.bad.push('--max-kb ' + v + ' (10 to 5000)');
    } else if (a === '--tolerance') {
      const v = String(argv[++i] ?? '');
      const n = intIn(v, 1, 60);
      if (n) o.tolerance = n;
      else o.bad.push('--tolerance ' + v + ' (1 to 60)');
    } else if (a === '--feather') {
      const v = String(argv[++i] ?? '');
      const n = intIn(v, 0, 20);
      if (n !== null) o.feather = n;
      else o.bad.push('--feather ' + v + ' (0 to 20)');
    } else if (a === '--method') {
      const v = String(argv[++i] ?? '').toLowerCase();
      if (v === 'auto' || v === 'rembg' || v === 'canvas') o.method = v;
      else o.bad.push('--method ' + v + ' (auto, rembg or canvas)');
    } else if (a === '--engine') {
      const v = String(argv[++i] ?? '').toLowerCase();
      if (v === 'auto' || v === 'browser' || v === 'magick') o.engine = v;
      else o.bad.push('--engine ' + v + ' (auto, browser or magick)');
    } else if (a === '--columns') {
      const v = String(argv[++i] ?? '');
      const n = intIn(v, 2, 8);
      if (n) o.columns = n;
      else o.bad.push('--columns ' + v + ' (2 to 8)');
    } else if (a === '--best') o.best = true;
    else if (a === '--json') o.json = true;
    else words.push(a);
  }
  if (command === 'add') {
    o.add = words;
    // Search options mean nothing to add.
    if (searchOptionsInAdd) o.bad.push('--count, --orientation, --min-width and --best are for a search, not add');
    return o;
  }
  if (command === 'search') {
    const q = words.join(' ').replace(/\s+/g, ' ').trim();
    o.query = q || null;
    return o;
  }
  if (command === 'sharp' && !widthGiven) o.width = SHARP_WIDTH;
  if (words.length > 1) o.bad.push('one ' + (command === 'series' ? 'address' : command === 'cutout' || command === 'palette' ? 'file' : command === 'sharp' ? 'file or folder' : 'folder') + ' only (also given: ' + words.slice(1).join(' ') + ')');
  o.target = words[0] ?? null;
  if (command === 'grade' && !o.look && !o.help) o.bad.push('--look (mono, duotone, warm or cool) is needed');
  if (command === 'grade' && (o.look === 'warm' || o.look === 'cool') && (o.ink || o.paper)) o.bad.push('--ink and --paper are for mono and duotone');
  return o;
}

// ---- where to search ------------------------------------------------------------------------

export interface SearchPlan {
  /** Openverse, with the providers to keep (null for all of them). */
  openverse: { providers: string[] | null } | null;
  commons: boolean;
  pexels: boolean;
  pixabay: boolean;
  archives: Archive[];
  /** Plain-words notes about sources asked for but not used. */
  notes: string[];
}

/**
 * Which sources a search asks. With no --source: Openverse (every provider), Wikimedia Commons, and
 * Pexels or Pixabay when their key is set. --source names sources and Openverse providers; the
 * archives are asked only when named. --creator applies to Openverse only.
 */
export function planSources(sources: string[] | null, keys: { pexels: boolean; pixabay: boolean }, creator: string | null = null): SearchPlan {
  const plan: SearchPlan = { openverse: null, commons: false, pexels: false, pixabay: false, archives: [], notes: [] };
  const names = sources ?? ['openverse', 'wikimedia', ...(keys.pexels ? ['pexels'] : []), ...(keys.pixabay ? ['pixabay'] : [])];
  const providers = names.filter((n) => OPENVERSE_PROVIDERS.includes(n));
  if (names.includes('openverse')) plan.openverse = { providers: null };
  else if (providers.length) plan.openverse = { providers };
  plan.commons = names.includes('wikimedia');
  for (const [name, has] of [['pexels', keys.pexels], ['pixabay', keys.pixabay]] as const) {
    if (!names.includes(name)) continue;
    if (has) plan[name] = true;
    else plan.notes.push(`${SOURCE_NAMES[name]} needs ${name.toUpperCase()}_API_KEY in the environment; not searched`);
  }
  plan.archives = ARCHIVES.filter((a) => names.includes(a));
  if (creator) {
    const others = [plan.commons && 'Wikimedia Commons', plan.pexels && 'Pexels', plan.pixabay && 'Pixabay', ...plan.archives.map((a) => SOURCE_NAMES[a])].filter(Boolean);
    if (others.length && sources) plan.notes.push('--creator applies to Openverse only; ' + others.join(', ') + ' not searched');
    plan.openverse = plan.openverse ?? { providers: null };
    plan.commons = plan.pexels = plan.pixabay = false;
    plan.archives = [];
  }
  return plan;
}

// ---- address builders -----------------------------------------------------------------------

export interface OpenverseQuery {
  providers?: string[] | null;
  /** Providers to leave out (Openverse's excluded_source). */
  exclude?: string[] | null;
  creator?: string | null;
  page?: number;
  /** Ask for photographs only (default true). Commons and WordPress files carry no category, so a wider search turns this off. */
  photograph?: boolean;
  /** Ask for large files only (default true). */
  large?: boolean;
}

/** Openverse search, limited to licences that allow commercial use and changes, and by default to large photographs. */
export function openverseUrl(query: string, orientation: Orientation | null, q: OpenverseQuery = {}): string {
  const p = new URLSearchParams();
  if (query) p.set('q', query);
  p.set('license_type', 'commercial,modification');
  p.set('page_size', String(OPENVERSE_PAGE_SIZE));
  p.set('mature', 'false');
  if (q.photograph !== false) p.set('category', 'photograph');
  if (q.large !== false) p.set('size', 'large');
  if (q.providers?.length) p.set('source', q.providers.join(','));
  else if (q.exclude?.length) p.set('excluded_source', q.exclude.join(','));
  if (q.creator) p.set('creator', q.creator);
  if (q.page && q.page > 1) p.set('page', String(q.page));
  const aspect = orientation === 'landscape' ? 'wide' : orientation === 'portrait' ? 'tall' : orientation === 'square' ? 'square' : null;
  if (aspect) p.set('aspect_ratio', aspect);
  return 'https://api.openverse.org/v1/images/?' + p.toString();
}

/** The categories --best limits Commons to: files that passed its quality or featured-picture review. */
export const COMMONS_RATED = 'incategory:Quality_images|Featured_pictures_on_Wikimedia_Commons';

/**
 * Wikimedia Commons search over the File namespace, bitmaps only, with licence and author metadata
 * (and, for --best, assessments). `rated` limits it to quality and featured pictures.
 */
export function commonsUrl(query: string, best = false, opts: { rated?: boolean; page?: number } = {}): string {
  const p = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: query + ' filetype:bitmap' + (opts.rated ? ' ' + COMMONS_RATED : ''),
    gsrnamespace: '6',
    gsrlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    // A scaled copy about 1920px wide: enough for a full-width picture, far lighter than most originals.
    iiurlwidth: '1920',
    iiextmetadatafilter: 'ObjectName|Artist|Credit|LicenseShortName|License|LicenseUrl|UsageTerms' + (best ? '|Categories|Assessments' : ''),
    origin: '*',
  });
  if (opts.page && opts.page > 1) p.set('gsroffset', String((opts.page - 1) * 30));
  return 'https://commons.wikimedia.org/w/api.php?' + p.toString();
}

/** Pexels search (only with PEXELS_API_KEY). The key goes in a header, never in the address. */
export function pexelsUrl(query: string, orientation: Orientation | null, page = 1, perPage = 20): string {
  const p = new URLSearchParams({ query, per_page: String(perPage) });
  if (orientation) p.set('orientation', orientation);
  if (page > 1) p.set('page', String(page));
  return 'https://api.pexels.com/v1/search?' + p.toString();
}
export const pexelsPhotoUrl = (id: string): string => 'https://api.pexels.com/v1/photos/' + encodeURIComponent(id);
export const pexelsCollectionUrl = (id: string, page = 1): string =>
  'https://api.pexels.com/v1/collections/' + encodeURIComponent(id) + '?type=photos&per_page=80' + (page > 1 ? '&page=' + page : '');

/**
 * Pixabay search (only with PIXABAY_API_KEY). Pixabay takes the key in the address, so this address
 * is never printed. --best asks for editors' choice only; --min-width becomes min_width.
 */
export function pixabayUrl(query: string, key: string, o: Pick<Options, 'orientation' | 'minWidth' | 'best' | 'page'>): string {
  const p = new URLSearchParams({ key, q: query, image_type: 'photo', safesearch: 'true', per_page: '20' });
  if (o.orientation === 'landscape') p.set('orientation', 'horizontal');
  if (o.orientation === 'portrait') p.set('orientation', 'vertical');
  if (o.minWidth) p.set('min_width', String(o.minWidth));
  if (o.best) p.set('editors_choice', 'true');
  if (o.page > 1) p.set('page', String(o.page));
  return 'https://pixabay.com/api/?' + p.toString();
}

/** Europeana: openly reusable images only. The public demonstration key unless EUROPEANA_API_KEY is set. */
export function europeanaUrl(query: string, page = 1, key = 'api2demo'): string {
  const p = new URLSearchParams({ wskey: key, query, reusability: 'open', media: 'true', qf: 'TYPE:IMAGE', rows: '20', profile: 'rich' });
  if (page > 1) p.set('start', String((page - 1) * 20 + 1));
  return 'https://api.europeana.eu/record/v2/search.json?' + p.toString();
}

/** Cleveland Museum of Art open access: CC0 works with images only. */
export function clevelandUrl(query: string, page = 1): string {
  const p = new URLSearchParams({ q: query, cc0: '1', has_image: '1', limit: '20' });
  if (page > 1) p.set('skip', String((page - 1) * 20));
  return 'https://openaccess-api.clevelandart.org/api/artworks/?' + p.toString();
}

/** The Met: v1.1 search (v1 was retired on 1 Oct 2026), then each object; only public-domain ones are kept. */
export function metSearchUrl(query: string, page = 1): string {
  const p = new URLSearchParams({ q: query, hasImages: 'true', limit: '20' });
  if (page > 1) p.set('offset', String((page - 1) * 20));
  return 'https://collectionapi.metmuseum.org/public/collection/v1.1/search?' + p.toString();
}
export const metObjectUrl = (id: number | string): string => 'https://collectionapi.metmuseum.org/public/collection/v1/objects/' + encodeURIComponent(String(id));

/** NASA Image and Video Library: images only. */
export function nasaUrl(query: string, page = 1): string {
  const p = new URLSearchParams({ q: query, media_type: 'image', page_size: '20' });
  if (page > 1) p.set('page', String(page));
  return 'https://images-api.nasa.gov/search?' + p.toString();
}

/** Smithsonian Open Access: CC0 images only. The demonstration key unless SMITHSONIAN_API_KEY is set. */
export function smithsonianUrl(query: string, page = 1, key = 'DEMO_KEY'): string {
  const p = new URLSearchParams({ q: `${query} AND online_media_type:Images AND media_usage:CC0`, rows: '20', api_key: key });
  if (page > 1) p.set('start', String((page - 1) * 20));
  return 'https://api.si.edu/openaccess/api/v1.0/search?' + p.toString();
}

// ---- licences and parsing -------------------------------------------------------------------

/**
 * Whether a licence clearly allows commercial use and changes. Accepts CC0,
 * public domain and CC BY / CC BY-SA in any version; refuses NC, ND, anything
 * unknown and anything missing.
 */
export function licenceAllowed(raw: string | null | undefined): boolean {
  const s = String(raw ?? '').toLowerCase().replace(/[_\s]+/g, '-').trim();
  if (!s) return false;
  if (/(^|-)n[cd](-|$)/.test(s) || s.includes('noncommercial') || s.includes('noderiv')) return false;
  if (/^(cc0|cc-zero|cc-0)(-|$)/.test(s)) return true;
  if (/^(pd|pdm|public-domain|publicdomain)(-|$)/.test(s)) return true;
  if (/^(cc-)?by(-sa)?(-\d(\.\d)?)?(-[a-z]{2})?$/.test(s)) return true;
  return false;
}

/** A licence name and a code licenceAllowed understands, from a Creative Commons address; null for anything else. */
export function licenceFromUrl(raw: string): { name: string; code: string; url: string } | null {
  const u = String(raw ?? '').trim().replace(/^http:/, 'https:');
  if (/creativecommons\.org\/publicdomain\/zero\/1\.0/i.test(u)) return { name: 'CC0 1.0', code: 'cc0', url: u };
  if (/creativecommons\.org\/publicdomain\/mark\/1\.0/i.test(u)) return { name: 'Public Domain Mark 1.0', code: 'pdm', url: u };
  const m = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)/i.exec(u);
  if (m) {
    const code = (m[1] ?? '').toLowerCase();
    return { name: 'CC ' + code.toUpperCase() + ' ' + m[2], code, url: u };
  }
  return null;
}

/** A readable licence name from an Openverse code and version. */
export function openverseLicenceName(code: string, version: string | null | undefined): string {
  const c = code.toLowerCase();
  const v = version ? ' ' + version : '';
  if (c === 'cc0') return 'CC0' + v;
  if (c === 'pdm') return 'Public Domain Mark' + v;
  return 'CC ' + c.toUpperCase() + v;
}

/** Strip HTML tags and entities from Commons metadata, which is HTML. */
export function plainText(html: string | null | undefined): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const LICENCE_REFUSED = 'licence is missing or not clearly reusable';

/**
 * The file Argus can actually fetch for an Openverse result, and its size. StockSnap and rawpixel
 * give only a small preview (the size Openverse reports is the original's), so those are listed to
 * fetch by hand. Commons originals are asked for as a 1920px copy.
 */
export function openverseFile(provider: string, url: string, width: number | null, height: number | null): Pick<Candidate, 'imageUrl' | 'width' | 'height' | 'byHand'> {
  const scaled = (long: number): { width: number | null; height: number | null } => {
    if (!width || !height) return { width: null, height: null };
    const k = Math.min(1, long / Math.max(width, height));
    return { width: Math.round(width * k), height: Math.round(height * k) };
  };
  const preview = PREVIEW_ONLY[provider];
  if (preview) return { imageUrl: url, ...scaled(preview.long), byHand: { reason: preview.why, width, height } };
  const commons = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+\.(?:jpe?g|png))$/i.exec(url);
  if (commons && width && width > 1920) {
    const [, base, a, b, name] = commons;
    return { imageUrl: `${base}/thumb/${a}/${b}/${name}/1920px-${name}`, ...scaled(width >= (height ?? 0) ? 1920 : Math.round(((height ?? 0) * 1920) / width)) };
  }
  return { imageUrl: url, width, height };
}

/** Turn an Openverse search response into candidates. Never throws on a bad result: it is skipped with a reason. */
export function parseOpenverse(body: unknown): Parsed {
  const out: Parsed = { candidates: [], skipped: [] };
  const results = isObject(body) && Array.isArray(body['results']) ? body['results'] : null;
  if (!results) {
    out.skipped.push('openverse: the response had no results list');
    return out;
  }
  if (isObject(body)) {
    out.pageCount = num(body['page_count']) ?? undefined;
    out.total = num(body['result_count']) ?? 0;
  }
  for (const r of results) {
    if (!isObject(r)) {
      out.skipped.push('openverse: a result that was not an object');
      continue;
    }
    const title = plainText(str(r['title'])) || 'Untitled';
    const code = str(r['license']);
    const imageUrl = str(r['url']);
    const pageUrl = str(r['foreign_landing_url']) || str(r['detail_url']);
    if (!imageUrl || !/^https:\/\//.test(imageUrl)) {
      out.skipped.push(`openverse: "${title}" has no image address`);
      continue;
    }
    if (!licenceAllowed(code)) {
      out.skipped.push(`openverse: "${title}" ${LICENCE_REFUSED} (${code || 'none'})`);
      continue;
    }
    if (!pageUrl) {
      out.skipped.push(`openverse: "${title}" has no source page to credit`);
      continue;
    }
    const provider = str(r['source']).toLowerCase();
    const file = provider ? openverseFile(provider, imageUrl, num(r['width']), num(r['height'])) : { imageUrl, width: num(r['width']), height: num(r['height']) };
    out.candidates.push({
      source: 'openverse',
      title,
      author: plainText(str(r['creator'])) || 'Unknown',
      pageUrl,
      licence: openverseLicenceName(code, str(r['license_version']) || null),
      licenceUrl: str(r['license_url']),
      ...file,
      ...(provider ? { provider } : {}),
    });
  }
  return out;
}

/** Turn a Wikimedia Commons query response into candidates, in search order. */
export function parseCommons(body: unknown): Parsed {
  const out: Parsed = { candidates: [], skipped: [] };
  const query = isObject(body) ? body['query'] : null;
  const pages = isObject(query) ? query['pages'] : null;
  if (!isObject(pages)) {
    // An answer with no pages is how the API says "no matches"; anything else is a bad response.
    if (!isObject(body) || 'error' in body) out.skipped.push('wikimedia: the response had no pages');
    return out;
  }
  const list = Object.values(pages)
    .filter(isObject)
    .sort((a, b) => (num(a['index']) ?? 0) - (num(b['index']) ?? 0));
  for (const page of list) {
    const fileTitle = str(page['title']);
    const info = Array.isArray(page['imageinfo']) ? page['imageinfo'][0] : null;
    if (!isObject(info)) {
      out.skipped.push(`wikimedia: "${fileTitle}" has no image information`);
      continue;
    }
    const meta = isObject(info['extmetadata']) ? info['extmetadata'] : {};
    const field = (name: string): string => {
      const f = meta[name];
      return isObject(f) ? str(f['value']) : '';
    };
    const title = plainText(field('ObjectName')) || fileTitle.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '') || 'Untitled';
    const mime = str(info['mime']);
    if (mime && !/^image\/(jpeg|png|webp)$/.test(mime)) {
      out.skipped.push(`wikimedia: "${title}" is ${mime}, not a photograph format`);
      continue;
    }
    const code = field('License') || field('LicenseShortName');
    if (!licenceAllowed(code) && !licenceAllowed(field('LicenseShortName'))) {
      out.skipped.push(`wikimedia: "${title}" ${LICENCE_REFUSED} (${plainText(field('LicenseShortName')) || code || 'none'})`);
      continue;
    }
    const imageUrl = str(info['thumburl']) || str(info['url']);
    const pageUrl = str(info['descriptionurl']);
    if (!imageUrl || !pageUrl) {
      out.skipped.push(`wikimedia: "${title}" has no image or source page address`);
      continue;
    }
    // The size of the file that will be downloaded: the scaled copy when there is one.
    const thumbW = num(info['thumbwidth']);
    const thumbH = num(info['thumbheight']);
    const hasThumb = !!str(info['thumburl']) && thumbW && thumbH;
    out.candidates.push({
      source: 'wikimedia',
      title,
      author: plainText(field('Artist')) || plainText(field('Credit')) || 'Unknown',
      pageUrl,
      imageUrl,
      licence: plainText(field('LicenseShortName')) || code,
      licenceUrl: field('LicenseUrl'),
      width: hasThumb ? thumbW : num(info['width']),
      height: hasThumb ? thumbH : num(info['height']),
      pixels: (num(info['width']) ?? 0) * (num(info['height']) ?? 0) || null,
      quality: assessment(field('Assessments') + '|' + field('Categories')),
    });
  }
  return out;
}

/** How Commons rates a file, from its assessments and categories: 3 featured, 2 quality, 1 valued, 0 none. */
export function assessment(text: string): number {
  const t = text.toLowerCase();
  const is = (word: string, category: string): boolean => new RegExp('(^|\\|)\\s*' + word + '\\s*(\\||$)').test(t) || t.includes(category);
  if (is('featured', 'featured pictures')) return 3;
  if (is('quality', 'quality images')) return 2;
  if (is('valued', 'valued images')) return 1;
  return 0;
}

/** --best: Commons candidates ordered featured, quality and valued images first, then by the original's size. Stable. */
export function rankCommons(list: Candidate[]): Candidate[] {
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.quality ?? 0) - (a.c.quality ?? 0) || (b.c.pixels ?? 0) - (a.c.pixels ?? 0) || a.i - b.i)
    .map((x) => x.c);
}

/** Turn a Pexels search, collection or photo response into candidates. Every Pexels photo is under the Pexels licence. */
export function parsePexels(body: unknown): Parsed {
  const out: Parsed = { candidates: [], skipped: [] };
  // A collection lists "media" (photos and videos); a search lists "photos".
  const media = isObject(body) && Array.isArray(body['media']) ? (body['media'] as unknown[]).filter((m) => !isObject(m) || str(m['type']).toLowerCase() !== 'video') : null;
  const photos = isObject(body) && Array.isArray(body['photos']) ? body['photos'] : media;
  if (!photos) {
    out.skipped.push('pexels: the response had no photos list');
    return out;
  }
  if (isObject(body)) out.total = num(body['total_results']) ?? undefined;
  for (const p of photos) {
    if (!isObject(p)) {
      out.skipped.push('pexels: a result that was not an object');
      continue;
    }
    const src = isObject(p['src']) ? p['src'] : {};
    const original = str(src['original']);
    const pageUrl = str(p['url']);
    const title = plainText(str(p['alt'])) || 'Pexels photo ' + String(p['id'] ?? '');
    if (!original || !/^https:\/\//.test(original) || !pageUrl) {
      out.skipped.push(`pexels: "${title}" has no image or source page address`);
      continue;
    }
    const w = num(p['width']);
    const h = num(p['height']);
    // Ask Pexels for a copy about 1920px wide when the original is larger.
    const scale = w && w > PEXELS_WIDTH ? PEXELS_WIDTH / w : 1;
    const imageUrl = scale < 1 ? original + (original.includes('?') ? '&' : '?') + 'auto=compress&cs=tinysrgb&w=' + PEXELS_WIDTH : original;
    out.candidates.push({
      source: 'pexels',
      title,
      author: plainText(str(p['photographer'])) || 'Unknown',
      pageUrl,
      imageUrl,
      licence: PEXELS_LICENCE,
      licenceUrl: PEXELS_LICENCE_URL,
      width: w ? Math.round(w * scale) : null,
      height: h ? Math.round(h * scale) : null,
    });
  }
  return out;
}

/** Turn a Pixabay response into candidates. largeImageURL is at most 1280px on the long side; that is what is downloaded. */
export function parsePixabay(body: unknown): Parsed {
  const out: Parsed = { candidates: [], skipped: [] };
  const hits = isObject(body) && Array.isArray(body['hits']) ? body['hits'] : null;
  if (!hits) {
    out.skipped.push('pixabay: the response had no hits list');
    return out;
  }
  for (const h of hits) {
    if (!isObject(h)) continue;
    const imageUrl = str(h['largeImageURL']);
    const pageUrl = str(h['pageURL']);
    const title = plainText(str(h['tags'])) || 'Pixabay photo ' + String(h['id'] ?? '');
    if (!/^https:\/\//.test(imageUrl) || !pageUrl) {
      out.skipped.push(`pixabay: "${title}" has no image or source page address`);
      continue;
    }
    const w = num(h['imageWidth']);
    const ht = num(h['imageHeight']);
    const k = w && ht ? Math.min(1, 1280 / Math.max(w, ht)) : 1;
    out.candidates.push({
      source: 'pixabay', title, author: plainText(str(h['user'])) || 'Unknown', pageUrl, imageUrl, licence: PIXABAY_LICENCE, licenceUrl: PIXABAY_LICENCE_URL,
      width: w ? Math.round(w * k) : null, height: ht ? Math.round(ht * k) : null,
    });
  }
  return out;
}

/** Turn a Europeana response into candidates: openly licensed items with a file address. Sizes are learned on download. */
export function parseEuropeana(body: unknown): Parsed {
  const out: Parsed = { candidates: [], skipped: [] };
  const items = isObject(body) && Array.isArray(body['items']) ? body['items'] : null;
  if (!items) {
    out.skipped.push('europeana: the response had no items list');
    return out;
  }
  for (const it of items) {
    if (!isObject(it)) continue;
    const title = plainText(str(first(it['title']))) || 'Untitled';
    const rights = str(first(it['rights']));
    const lic = licenceFromUrl(rights);
    if (!lic || !licenceAllowed(lic.code)) {
      out.skipped.push(`europeana: "${title}" ${LICENCE_REFUSED} (${rights || 'none'})`);
      continue;
    }
    const imageUrl = str(first(it['edmIsShownBy']));
    const pageUrl = str(it['guid']).replace(/\?.*$/, '');
    if (!/^https?:\/\//.test(imageUrl) || !pageUrl) {
      out.skipped.push(`europeana: "${title}" has no image or source page address`);
      continue;
    }
    out.candidates.push({
      source: 'europeana', title, author: plainText(str(first(it['dcCreator'])) || str(first(it['dataProvider']))) || 'Unknown', pageUrl, imageUrl,
      licence: lic.name, licenceUrl: lic.url, width: null, height: null,
    });
  }
  return out;
}

/** Turn a Cleveland Museum of Art response into candidates: CC0 works, the print-size JPEG (about 3400px). */
export function parseCleveland(body: unknown): Parsed {
  const out: Parsed = { candidates: [], skipped: [] };
  const data = isObject(body) && Array.isArray(body['data']) ? body['data'] : null;
  if (!data) {
    out.skipped.push('cleveland: the response had no data list');
    return out;
  }
  for (const a of data) {
    if (!isObject(a)) continue;
    const title = plainText(str(a['title'])) || 'Untitled';
    if (str(a['share_license_status']).toUpperCase() !== 'CC0') {
      out.skipped.push(`cleveland: "${title}" ${LICENCE_REFUSED} (${str(a['share_license_status']) || 'none'})`);
      continue;
    }
    const images = isObject(a['images']) ? a['images'] : {};
    const pick = [images['print'], images['web']].find((x) => isObject(x) && /^https:\/\//.test(str(x['url']))) as Record<string, unknown> | undefined;
    const pageUrl = str(a['url']);
    if (!pick || !pageUrl) {
      out.skipped.push(`cleveland: "${title}" has no image or source page address`);
      continue;
    }
    const creators = Array.isArray(a['creators']) ? a['creators'] : [];
    const author = plainText(isObject(creators[0]) ? str(creators[0]['description']) : '') || plainText(str(first(a['culture']))) || 'Cleveland Museum of Art';
    out.candidates.push({
      source: 'cleveland', title, author, pageUrl, imageUrl: str(pick['url']), licence: 'CC0 1.0', licenceUrl: CC0_URL,
      width: num(Number(pick['width'])), height: num(Number(pick['height'])),
    });
  }
  return out;
}

/** Turn one Met object into a candidate, or a reason to leave it out. Only public-domain objects with an image. */
export function parseMetObject(o: unknown): Candidate | string {
  if (!isObject(o)) return 'met: an object that was not an object';
  const title = plainText(str(o['title'])) || 'Untitled';
  if (o['isPublicDomain'] !== true) return `met: "${title}" ${LICENCE_REFUSED} (not public domain)`;
  const imageUrl = str(o['primaryImage']);
  const pageUrl = str(o['objectURL']);
  if (!/^https:\/\//.test(imageUrl) || !pageUrl) return `met: "${title}" has no image or source page address`;
  const author = plainText(str(o['artistDisplayName'])) || plainText(str(o['culture'])) || 'The Metropolitan Museum of Art';
  return { source: 'met', title, author, pageUrl, imageUrl, licence: 'CC0 1.0', licenceUrl: CC0_URL, width: null, height: null };
}

/** Turn a NASA Image Library response into candidates. NASA's own media is not under copyright; credit the centre or photographer. */
export function parseNasa(body: unknown): Parsed {
  const out: Parsed = { candidates: [], skipped: [] };
  const coll = isObject(body) && isObject(body['collection']) ? body['collection'] : null;
  const items = coll && Array.isArray(coll['items']) ? coll['items'] : null;
  if (!items) {
    out.skipped.push('nasa: the response had no items list');
    return out;
  }
  for (const it of items) {
    if (!isObject(it)) continue;
    const d = Array.isArray(it['data']) && isObject(it['data'][0]) ? (it['data'][0] as Record<string, unknown>) : {};
    const link = Array.isArray(it['links']) && isObject(it['links'][0]) ? str((it['links'][0] as Record<string, unknown>)['href']) : '';
    const id = str(d['nasa_id']);
    const title = plainText(str(d['title'])) || id || 'Untitled';
    if (!id || !/\.jpe?g$/i.test(link)) {
      out.skipped.push(`nasa: "${title}" has no JPEG to download`);
      continue;
    }
    out.candidates.push({
      source: 'nasa', title,
      author: plainText(str(d['photographer']) || str(d['secondary_creator']) || (str(d['center']) ? 'NASA ' + str(d['center']) : '')) || 'NASA',
      pageUrl: 'https://images.nasa.gov/details/' + encodeURIComponent(id),
      imageUrl: link.replace(/^http:/, 'https:').replace(/~(thumb|small|medium|large)\.jpe?g$/i, '~orig.jpg'),
      licence: 'Public domain (NASA media guidelines)', licenceUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
      width: null, height: null,
    });
  }
  return out;
}

/** Turn a Smithsonian Open Access response into candidates: CC0 images, the high-resolution JPEG when there is one. */
export function parseSmithsonian(body: unknown): Parsed {
  const out: Parsed = { candidates: [], skipped: [] };
  const resp = isObject(body) && isObject(body['response']) ? body['response'] : null;
  const rows = resp && Array.isArray(resp['rows']) ? resp['rows'] : null;
  if (!rows) {
    out.skipped.push('smithsonian: the response had no rows list');
    return out;
  }
  for (const r of rows) {
    if (!isObject(r)) continue;
    const title = plainText(str(r['title'])) || 'Untitled';
    const content = isObject(r['content']) ? r['content'] : {};
    const dnr = isObject(content['descriptiveNonRepeating']) ? content['descriptiveNonRepeating'] : {};
    const om = isObject(dnr['online_media']) ? dnr['online_media'] : {};
    const media = (Array.isArray(om['media']) ? om['media'] : []).filter(isObject);
    const m = media.find((x) => str(x['type']) === 'Images' && isObject(x['usage']) && str(x['usage']['access']) === 'CC0');
    if (!m) {
      out.skipped.push(`smithsonian: "${title}" has no CC0 image`);
      continue;
    }
    const resources = (Array.isArray(m['resources']) ? m['resources'] : []).filter(isObject);
    const hi = resources.find((x) => /high-resolution jpeg/i.test(str(x['label'])));
    const imageUrl = hi ? str(hi['url']) : str(m['content']) ? str(m['content']) + '&max=2400' : '';
    const pageUrl = str(dnr['record_link']) || str(dnr['guid']);
    if (!/^https:\/\//.test(imageUrl) || !pageUrl) {
      out.skipped.push(`smithsonian: "${title}" has no image or source page address`);
      continue;
    }
    const freetext = isObject(content['freetext']) ? content['freetext'] : {};
    const names = Array.isArray(freetext['name']) ? freetext['name'] : [];
    const author = plainText(isObject(names[0]) ? str(names[0]['content']) : '') || plainText(str(dnr['data_source'])) || 'Smithsonian Institution';
    out.candidates.push({ source: 'smithsonian', title, author, pageUrl, imageUrl, licence: 'CC0 1.0', licenceUrl: CC0_URL, width: hi ? num(Number(hi['width'])) : null, height: hi ? num(Number(hi['height'])) : null });
  }
  return out;
}

export function orientationOf(width: number, height: number): Orientation {
  const r = width / height;
  if (r > 1.1) return 'landscape';
  if (r < 0.9) return 'portrait';
  return 'square';
}

/** Why a candidate should be left out, or null to keep it. Size and shape count only when known. */
export function rejectReason(c: Pick<Candidate, 'width' | 'height'>, orientation: Orientation | null, minWidth: number | null = null): string | null {
  if (c.width && c.height) {
    const long = Math.max(c.width, c.height);
    if (long < MIN_LONG_SIDE) return `too small (${c.width}x${c.height}, under ${MIN_LONG_SIDE}px on the long side)`;
    if (minWidth && c.width < minWidth) return `too narrow (${c.width}x${c.height}, under --min-width ${minWidth}px)`;
    if (orientation && orientationOf(c.width, c.height) !== orientation) return `${orientationOf(c.width, c.height)}, not ${orientation}`;
  }
  return null;
}

/** What makes two candidates the same picture: a Commons file by its name, anything else by its address. */
export function sameKey(c: Pick<Candidate, 'imageUrl'>): string {
  const commons = /upload\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i.exec(c.imageUrl);
  if (commons) return 'commons:' + decodeURIComponent(commons[1] ?? '').toLowerCase();
  return c.imageUrl.split('?')[0] ?? c.imageUrl;
}

/** Take candidates from each source in turn, so one source does not crowd out the other, and drop repeats. */
export function interleave(...lists: Candidate[][]): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const c = list[i];
      if (!c) continue;
      const key = sameKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

export function slug(s: string, max = 40): string {
  const out = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return out || 'photo';
}

/** File extension from an address or a content type; null for formats that are not photographs. */
export function extensionFor(url: string, contentType?: string | null): string | null {
  const type = String(contentType ?? '').toLowerCase();
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type && type.startsWith('image/')) return null;
  const m = /\.([a-z0-9]{3,4})(?:$|[?#])/i.exec(url);
  const ext = m?.[1]?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'png' || ext === 'webp') return ext;
  return type ? null : 'jpg';
}

/** A stable, readable file name: the search, the title and a short hash of the address. */
export function fileNameFor(c: Pick<Candidate, 'title' | 'imageUrl'>, query: string, ext: string): string {
  const hash = createHash('sha1').update(c.imageUrl).digest('hex').slice(0, 6);
  return `${slug(query, 24)}-${slug(c.title, 40)}-${hash}.${ext}`;
}

/** Width and height read from the start of a JPEG, PNG or WebP file, or null. */
export function imageSize(buf: Uint8Array): { width: number; height: number } | null {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 8 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1] ?? 0;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
        i += marker === 0xff ? 1 : 2;
        continue;
      }
      const len = b.readUInt16BE(i + 2);
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

/**
 * A credit's stable id: the one it carries, else its source and source page (which name the photograph
 * whatever the file is called). Null for an entry with neither (the owner's own photograph).
 */
export function creditId(c: Record<string, unknown> | { file: string }): string | null {
  const e = c as Record<string, unknown>;
  if (typeof e['id'] === 'string' && e['id']) return e['id'];
  return typeof e['sourcePage'] === 'string' && e['sourcePage'] ? String(e['source'] ?? 'page') + ':' + e['sourcePage'] : null;
}

/** Merge new credits into an existing list, replacing entries for the same file or the same stable id. */
export function mergeCredits<T extends { file: string }>(existing: unknown, added: T[]): T[] {
  const old = Array.isArray(existing) ? (existing.filter((e) => isObject(e) && typeof e['file'] === 'string') as unknown as T[]) : [];
  const names = new Set(added.map((c) => c.file));
  const ids = new Set(added.map((c) => creditId(c)).filter((x): x is string => !!x));
  return [...old.filter((c) => !names.has(c.file) && !ids.has(creditId(c) ?? '')), ...added];
}

/** The SHA-256 of a file's bytes, or null when it cannot be read. Kept in credits.json so a renamed file finds its credit. */
export function fileHash(file: string): string | null {
  try {
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Credits follow their pictures through renames: an entry whose file is gone is matched, by the hash of
 * its bytes, to a picture in the folder that has no entry, and takes its new name; its id stays. Writes
 * credits.json only when something changed. Returns the renames and the entries still without a file.
 */
export function reconcileCredits(dir: string, files: string[] = listImages(dir)): { renamed: Array<[string, string]>; missing: string[] } {
  const credits = readCredits(dir);
  const out = { renamed: [] as Array<[string, string]>, missing: [] as string[] };
  if (!credits.length) return out;
  const named = new Set(credits.map((c) => str(c['file'])));
  const loose = new Map<string, string>();
  for (const f of files) if (!named.has(f)) { const h = fileHash(path.join(dir, f)); if (h && !loose.has(h)) loose.set(h, f); }
  let changed = false;
  for (const c of credits) {
    const file = str(c['file']);
    if (fs.existsSync(path.join(dir, file))) continue;
    const now = typeof c['sha256'] === 'string' ? loose.get(c['sha256']) : undefined;
    if (now) {
      out.renamed.push([file, now]);
      loose.delete(c['sha256'] as string);
      c['file'] = now;
      c['id'] ??= creditId(c) ?? undefined;
      changed = true;
    } else out.missing.push(file);
  }
  if (changed) fs.writeFileSync(path.join(dir, 'credits.json'), JSON.stringify(credits, null, 2) + '\n');
  return out;
}

export function readCredits(dir: string): Array<Record<string, unknown>> {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, 'credits.json'), 'utf8')) as unknown;
    return Array.isArray(v) ? v.filter(isObject) : [];
  } catch {
    return [];
  }
}

/**
 * Add entries to DIR/credits.json, replacing any for the same file or stable id. Each entry gets its
 * stable id (id) and its picture's hash (sha256) when it has none, so renaming the file later keeps the
 * credit (deliver matches it back). Returns the file's path.
 */
export function writeCredits<T extends { file: string }>(dir: string, given: T[]): string {
  const added = given.map((c) => {
    const e = { ...c } as T & { id?: string; sha256?: string };
    const id = creditId(e);
    if (id && !e.id) e.id = id;
    if (!e.sha256) { const h = fileHash(path.join(dir, c.file)); if (h) e.sha256 = h; }
    return e;
  });
  const file = path.join(dir, 'credits.json');
  let existing: unknown = [];
  try {
    existing = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* none yet, or unreadable: start a new one */
  }
  fs.writeFileSync(file, JSON.stringify(mergeCredits(existing, added), null, 2) + '\n');
  return file;
}

/** The plain-words explanation for a failed request. */
export function describeError(err: unknown): string {
  const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } } | null;
  const code = e?.cause?.code ?? '';
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'it took too long to answer';
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|UND_ERR_CONNECT/.test(code)) return 'it could not be reached (' + code + ')';
  return e?.cause?.message ?? e?.message ?? String(err);
}

function isNetworkFailure(reason: string): boolean {
  return /could not be reached|took too long|fetch failed/.test(reason);
}

/** Every key in the environment, so none is ever printed, even inside an error message. */
function hideKeys(s: string): string {
  let out = s;
  for (const k of ['PEXELS_API_KEY', 'PIXABAY_API_KEY', 'EUROPEANA_API_KEY', 'SMITHSONIAN_API_KEY']) {
    const v = (process.env[k] ?? '').trim();
    if (v.length >= 4) out = out.split(v).join('<' + k + '>');
  }
  return out;
}

async function getJson(url: string, extraHeaders: Record<string, string> = {}): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...extraHeaders }, signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
    if (res.ok) return res.json();
    if (res.status === 429) throw new Error('it answered 429 (too many requests: wait a minute and try again)');
    // A busy server (5xx) gets one more try after a short pause; anything else is final.
    if (res.status < 500 || attempt >= 2) throw new Error('it answered ' + res.status + ' ' + res.statusText);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

interface Saved {
  credit: Credit;
  bytes: number;
}

async function download(c: Candidate, label: string, dir: string, orientation: Orientation | null, minWidth: number | null, judge = true, search = label): Promise<Saved | string> {
  const res = await fetch(c.imageUrl, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) return `the file answered ${res.status}`;
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) return `the file is too large (${Math.round(declared / 1048576)} MB)`;
  const ext = extensionFor(c.imageUrl, res.headers.get('content-type'));
  if (!ext) return `not a JPEG, PNG or WebP file (${res.headers.get('content-type') ?? 'unknown type'})`;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return `the file is too large (${Math.round(buf.byteLength / 1048576)} MB)`;
  const size = imageSize(buf);
  if (!size) return 'the file could not be read as an image';
  const reason = judge ? rejectReason(size, orientation, minWidth) : null;
  if (reason) return reason;
  const file = fileNameFor(c, label, ext);
  fs.writeFileSync(path.join(dir, file), buf);
  return { bytes: buf.byteLength, credit: creditFor(c, file, size, search) };
}

/** The one shape every credits.json entry has, whichever command wrote it. */
export function creditFor(c: Pick<Candidate, 'title' | 'author' | 'source' | 'pageUrl' | 'licence' | 'licenceUrl'>, file: string, size: { width: number; height: number } | null, search: string): Credit {
  return {
    file,
    title: c.title,
    author: c.author,
    source: c.source,
    sourcePage: c.pageUrl,
    licence: c.licence,
    licenceUrl: c.licenceUrl,
    width: size ? size.width : null,
    height: size ? size.height : null,
    search,
  };
}

// ---- add: photographs chosen on Unsplash or Pexels ------------------------------------------

/** Which site a photo page belongs to, from its address, or null when it is not an Unsplash or Pexels photo page. */
export function photoPageSite(raw: string): 'unsplash' | 'pexels' | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if ((host === 'unsplash.com' || host === 'www.unsplash.com') && /^\/photos\/[^/]+\/?$/.test(u.pathname)) return 'unsplash';
  if ((host === 'pexels.com' || host === 'www.pexels.com') && /^\/(?:[a-z]{2}-[a-z]{2}\/)?(?:photo|foto)\/[^/]+\/?$/.test(u.pathname)) return 'pexels';
  return null;
}

/** The Pexels photo number at the end of a page address, or null. */
export function pexelsId(pageUrl: string): string | null {
  return /\/(?:photo|foto)\/(?:[^/]*-)?(\d+)\/?$/.exec(new URL(pageUrl).pathname)?.[1] ?? null;
}

const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_m, e: string) => {
    const k = e.toLowerCase();
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' } as Record<string, string>)[k] ?? _m;
  });

/** What add reads from a photo page. */
export interface PagePhoto {
  site: 'unsplash' | 'pexels';
  title: string;
  author: string;
  pageUrl: string;
  imageUrl: string;
}

const UNSPLASH_PLUS = /^https?:\/\/plus\.unsplash\.com\//i;

/**
 * Read a photo page's public metadata: the JSON-LD ImageObject or Photograph (author or creator,
 * contentUrl, name, licence), then Open Graph and Twitter tags (og:image, og:url, og:title).
 * The photographer comes from JSON-LD, else from a title such as "Photo by Ana B on Unsplash".
 * Unsplash photo pages carry JSON-LD with "license" (checked with curl on 24 Nov 2026): the free
 * ones say https://unsplash.com/license, Unsplash+ ones https://unsplash.com/plus/license and serve
 * the file from plus.unsplash.com. Either sign refuses the picture.
 * Returns the photo, or a reason it cannot be used.
 */
export function parsePhotoPage(html: string, given: string, site: 'unsplash' | 'pexels'): PagePhoto | string {
  const meta = new Map<string, string>();
  for (const m of html.matchAll(/<meta\s[^>]*>/gi)) {
    const tag = m[0];
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    const value = content ? decodeEntities(content[1] ?? content[2] ?? '').trim() : '';
    if (key && value && !meta.has(key)) meta.set(key, value);
  }
  const objects: Array<Record<string, unknown>> = [];
  const collect = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(collect);
    else if (isObject(v)) {
      objects.push(v);
      if (Array.isArray(v['@graph'])) collect(v['@graph']);
    }
  };
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      collect(JSON.parse(m[1] ?? ''));
    } catch {
      /* a block that is not JSON: leave it */
    }
  }
  const isPhoto = (o: Record<string, unknown>): boolean => [o['@type']].flat().some((t) => t === 'ImageObject' || t === 'Photograph');
  const ld = objects.find(isPhoto) ?? {};
  const nameOf = (v: unknown): string => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return nameOf(v[0]);
    return isObject(v) ? str(v['name']) : '';
  };
  const licence = str(ld['license']);
  if (site === 'unsplash' && licence && !/^https?:\/\/(www\.)?unsplash\.com\/license\/?$/i.test(licence)) {
    return 'it is not under the Unsplash Licence (' + licence + '): an Unsplash+ photograph needs a subscription';
  }
  const imageUrl = str(ld['contentUrl']) || meta.get('og:image') || meta.get('twitter:image') || '';
  if (site === 'unsplash' && UNSPLASH_PLUS.test(imageUrl)) {
    return 'it is an Unsplash+ photograph (served from plus.unsplash.com), which needs a subscription';
  }
  const titled = meta.get('og:title') ?? meta.get('twitter:title') ?? '';
  const byLine = /photo by (.+?) (?:on|from) (?:unsplash|pexels)/i.exec(titled)?.[1] ?? /photo by (.+?) (?:on|from) (?:unsplash|pexels)/i.exec(meta.get('og:description') ?? '')?.[1] ?? '';
  const author = plainText(nameOf(ld['author']) || nameOf(ld['creator']) || str(ld['creditText']) || byLine || meta.get('author') || '');
  if (!author) return 'the page does not name the photographer, so the picture cannot be credited';
  if (!/^https:\/\//.test(imageUrl)) return 'the page gives no image address';
  const pageUrl = meta.get('og:url') && photoPageSite(meta.get('og:url') ?? '') === site ? meta.get('og:url') ?? given : given;
  const title = plainText(str(ld['name']) || str(ld['caption']) || str(ld['description']) || titled.replace(/\s*[·|–-]\s*(free stock photo|pexels|unsplash).*$/i, '')) || site + ' photo';
  return { site, title, author, pageUrl, imageUrl };
}

/**
 * The image address asked for at `width` pixels wide. Both sites scale on request: Unsplash
 * (imgix) takes w, fm and q; Pexels takes w with auto=compress. Any crop, watermark or fixed
 * height on a social-card image is dropped, so the whole photograph comes back.
 */
export function sizedImageUrl(site: 'unsplash' | 'pexels', raw: string, width: number): string {
  const u = new URL(raw);
  if (site === 'unsplash') {
    for (const k of Array.from(u.searchParams.keys())) if (k !== 'ixid' && k !== 'ixlib') u.searchParams.delete(k);
    u.searchParams.set('fm', 'jpg');
    u.searchParams.set('q', '80');
    u.searchParams.set('fit', 'max');
    u.searchParams.set('w', String(width));
  } else {
    for (const k of Array.from(u.searchParams.keys())) u.searchParams.delete(k);
    u.searchParams.set('auto', 'compress');
    u.searchParams.set('cs', 'tinysrgb');
    u.searchParams.set('w', String(width));
  }
  return u.toString();
}

/** What a refused page means, in plain words. */
export function refusedReason(site: 'unsplash' | 'pexels', status: number, statusText = ''): string {
  const name = SOURCE_NAMES[site];
  const answered = 'it answered ' + status + (statusText ? ' ' + statusText : '');
  if (status === 403 || status === 429 || status === 503) {
    return name + ' refused the page (' + answered + ', a check for automated visitors or a rate limit). Open it in a browser and save the picture by hand, crediting the photographer' +
      (site === 'pexels' ? ', or set PEXELS_API_KEY and run add again to read it from the Pexels API' : '');
  }
  if (status === 404) return 'no such page on ' + name + ' (' + answered + '); check the address';
  return name + ' did not give the page (' + answered + ')';
}

async function getPage(url: string): Promise<{ status: number; statusText: string; html: string; url: string }> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' }, redirect: 'follow', signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) });
  if (!res.ok) return { status: res.status, statusText: res.statusText, html: '', url: res.url || url };
  const text = await res.text();
  return { status: res.status, statusText: res.statusText, html: text.length > MAX_PAGE_BYTES ? text.slice(0, MAX_PAGE_BYTES) : text, url: res.url || url };
}

/** A Pexels photo read from the Pexels API by its number (only with PEXELS_API_KEY). */
async function pexelsFromApi(pageUrl: string, key: string): Promise<PagePhoto | string> {
  const id = pexelsId(pageUrl);
  if (!id) return 'the address has no Pexels photo number';
  try {
    const body = await getJson(pexelsPhotoUrl(id), { Authorization: key });
    const parsed = parsePexels({ photos: [body] });
    const c = parsed.candidates[0];
    if (!c) return 'the Pexels API gave no usable photo';
    const original = isObject(body) && isObject(body['src']) ? str(body['src']['original']) : '';
    return { site: 'pexels', title: c.title, author: c.author, pageUrl: c.pageUrl, imageUrl: original || c.imageUrl };
  } catch (err) {
    return 'the Pexels API did not give it either (' + describeError(err) + ')';
  }
}

/** Read one Unsplash or Pexels photo page and download its picture. */
async function takePage(url: string, site: 'unsplash' | 'pexels', o: Options, label: string, search: string, check?: (p: PagePhoto) => string | null): Promise<{ credit?: Credit; bytes?: number; error?: string }> {
  const pexelsKey = (process.env['PEXELS_API_KEY'] ?? '').trim();
  let photo: PagePhoto | string;
  // Pexels' terms ask automated use to go through its API: with a key, read the photo there first.
  if (site === 'pexels' && pexelsKey) {
    const fromApi = await pexelsFromApi(url, pexelsKey);
    if (typeof fromApi !== 'string') return takePhoto(fromApi, site, o, label, search, check);
  }
  try {
    const page = await getPage(url);
    if (page.status >= 400) {
      photo = refusedReason(site, page.status, page.statusText);
    } else photo = parsePhotoPage(page.html, url, site);
  } catch (err) {
    photo = SOURCE_NAMES[site] + ' could not be read (' + describeError(err) + ')';
  }
  if (typeof photo === 'string') return { error: photo };
  return takePhoto(photo, site, o, label, search, check);
}

/** Download one photo already read from its page or the API, and credit it. */
async function takePhoto(photo: PagePhoto, site: 'unsplash' | 'pexels', o: Options, label: string, search: string, check?: (p: PagePhoto) => string | null): Promise<{ credit?: Credit; bytes?: number; error?: string }> {
  const refused = check ? check(photo) : null;
  if (refused) return { error: refused };
  const { licence, licenceUrl } = SITE_LICENCES[site];
  const c: Candidate = { source: site, title: photo.title, author: photo.author, pageUrl: photo.pageUrl, imageUrl: sizedImageUrl(site, photo.imageUrl, o.width), licence, licenceUrl, width: null, height: null };
  try {
    fs.mkdirSync(o.out, { recursive: true });
    const got = await download(c, label, o.out, null, null, false, search);
    if (typeof got === 'string') return { error: 'the picture could not be saved: ' + got };
    return { credit: got.credit, bytes: got.bytes };
  } catch (err) {
    return { error: 'the picture could not be downloaded (' + describeError(err) + ')' };
  }
}

async function addPhotos(o: Options): Promise<number> {
  const urls = o.add ?? [];
  const results: Array<{ url: string; credit?: Credit; bytes?: number; error?: string }> = [];
  for (const url of urls) {
    const site = photoPageSite(url);
    if (!site) {
      results.push({ url, error: 'not an Unsplash or Pexels photo page (https://unsplash.com/photos/... or https://www.pexels.com/photo/...)' });
      continue;
    }
    results.push({ url, ...(await takePage(url, site, o, site, '')) });
  }
  const saved = results.filter((r): r is { url: string; credit: Credit; bytes: number } => !!r.credit);
  const creditsFile = saved.length ? writeCredits(o.out, saved.map((r) => r.credit)) : null;
  if (o.json) {
    console.log(JSON.stringify({ dir: path.resolve(o.out), saved: saved.map((r) => ({ ...r.credit, bytes: r.bytes })), failed: results.filter((r) => r.error).map((r) => ({ url: r.url, reason: r.error })) }, null, 2));
  } else {
    if (saved.length) printSavedTable(saved.map((r) => ({ credit: r.credit, bytes: r.bytes })), 18);
    for (const r of results) if (r.error) console.log('Could not add ' + r.url + ': ' + r.error + '.');
    if (saved.length) {
      console.log(`\nAdded ${saved.length} of ${urls.length} in ${path.resolve(o.out)}; credits in ${creditsFile}.`);
      console.log('Credit each photographer where the page lists its pictures; both licences ask for no more, and welcome it.');
    }
  }
  return saved.length ? 0 : 2;
}

function printSavedTable(saved: Saved[], licenceColumn = 16): void {
  console.log('  ' + clip('file', 56) + clip('size', 11) + clip('licence', licenceColumn) + 'author');
  for (const s of saved) {
    const c = s.credit;
    const mb = s.bytes > 4 * 1048576 ? `  (${(s.bytes / 1048576).toFixed(1)} MB, resize before use)` : '';
    console.log('  ' + clip(c.file, 56) + clip(`${c.width}x${c.height}`, 11) + clip(c.licence, licenceColumn) + clip(c.author, 28).trimEnd() + mb);
  }
}

// ---- series: one photographer's set ---------------------------------------------------------

export type SeriesTarget =
  | { kind: 'unsplash-user'; user: string }
  | { kind: 'unsplash-photo'; url: string }
  | { kind: 'pexels-photo'; url: string; id: string }
  | { kind: 'pexels-user'; url: string }
  | { kind: 'pexels-collection'; url: string; id: string }
  | { kind: 'openverse-image'; id: string };

/** What a series address points at, or null when it is none of the kinds series knows. */
export function seriesTarget(raw: string): SeriesTarget | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'unsplash.com') {
    const user = /^\/@([A-Za-z0-9_.-]+)\/?(?:likes|collections|photos)?\/?$/.exec(u.pathname)?.[1];
    if (user) return { kind: 'unsplash-user', user };
    if (photoPageSite(raw) === 'unsplash') return { kind: 'unsplash-photo', url: raw };
  }
  if (host === 'pexels.com') {
    if (photoPageSite(raw) === 'pexels') return { kind: 'pexels-photo', url: raw, id: pexelsId(raw) ?? '' };
    const coll = /^\/(?:[a-z]{2}-[a-z]{2}\/)?collections\/(?:[^/]*-)?([A-Za-z0-9]+)\/?$/.exec(u.pathname)?.[1];
    if (coll) return { kind: 'pexels-collection', url: raw, id: coll };
    if (/^\/(?:[a-z]{2}-[a-z]{2}\/)?@[^/]+\/?$/.test(u.pathname)) return { kind: 'pexels-user', url: raw };
  }
  if (host === 'openverse.org') {
    const id = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?image\/([0-9a-f-]{36})\/?$/i.exec(u.pathname)?.[1];
    if (id) return { kind: 'openverse-image', id };
  }
  return null;
}

/** The Unsplash username a photo page links to as its photographer's profile, or null. */
export function unsplashUserFromPhotoPage(html: string): string | null {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/href="\/@([A-Za-z0-9_.-]+)"/g)) {
    const u = m[1] ?? '';
    if (u && u.toLowerCase() !== 'unsplash') counts.set(u, (counts.get(u) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [u, n] of counts) if (!best || n > (counts.get(best) ?? 0)) best = u;
  return best;
}

export interface ListedPhoto {
  /** The photo page address on unsplash.com. */
  pageUrl: string;
  id: string;
}

/**
 * The photographs an Unsplash profile page lists (about 20; more need a browser or the API, which
 * Argus does not use), in order, with the photographer's name from the page title. A listing whose
 * picture comes from plus.unsplash.com (Unsplash+) or that is marked sponsored or promoted is left
 * out with its reason.
 */
export function parseUnsplashUserPage(html: string, user: string): { name: string | null; photos: ListedPhoto[]; refused: Array<{ pageUrl: string; reason: string }> } {
  const title = /<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i.exec(html)?.[1] ?? /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '';
  const name = decodeEntities(title).replace(/\s*\(@[^)]*\).*$/, '').replace(/\s*\|\s*Unsplash.*$/i, '').trim() || null;
  const photos: ListedPhoto[] = [];
  const refused: Array<{ pageUrl: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href="\/photos\/([^"?#/]+)"[^>]*>/g)) {
    const slugPart = m[1] ?? '';
    const id = slugPart.length > 11 ? slugPart.slice(-11) : slugPart;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const pageUrl = 'https://unsplash.com/photos/' + slugPart;
    const at = m.index ?? 0;
    const after = html.slice(at, at + 1500);
    const img = /<img\b[^>]*?(?:srcSet|src)="([^" ]+)/i.exec(after)?.[1] ?? '';
    // The listing's own figure (Unsplash wraps each listing in one), so a label on a neighbour is not counted.
    const start = html.lastIndexOf('<figure', at);
    const end = html.indexOf('</figure>', at);
    const around = html.slice(start >= 0 && at - start < 6000 ? start : Math.max(0, at - 1500), end >= 0 && end - at < 6000 ? end : at + 1500);
    if (UNSPLASH_PLUS.test(decodeEntities(img))) refused.push({ pageUrl, reason: 'an Unsplash+ photograph (plus.unsplash.com)' });
    else if (/>\s*(Sponsored|Promoted)\s*</i.test(around) || /sponsoredLabelLink|data-test="sponsored/i.test(around)) refused.push({ pageUrl, reason: 'a sponsored or promoted listing' });
    else photos.push({ pageUrl, id });
  }
  void user;
  return { name, photos, refused };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const sameName = (a: string, b: string): boolean => a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

interface SeriesResult {
  from: string;
  saved: Saved[];
  failed: Array<{ url: string; reason: string }>;
  byHand: Candidate[];
  notes: string[];
}

async function seriesUnsplash(target: Extract<SeriesTarget, { kind: 'unsplash-user' | 'unsplash-photo' }>, o: Options, r: SeriesResult): Promise<void> {
  let user = target.kind === 'unsplash-user' ? target.user : null;
  const firstPhoto = target.kind === 'unsplash-photo' ? target.url : null;
  if (!user && firstPhoto) {
    const page = await getPage(firstPhoto);
    if (page.status >= 400) {
      r.notes.push(refusedReason('unsplash', page.status, page.statusText));
      return;
    }
    user = unsplashUserFromPhotoPage(page.html);
    if (!user) {
      r.notes.push('the photo page does not link to its photographer\'s profile; pass https://unsplash.com/@username instead');
      return;
    }
    await sleep(SERIES_PAUSE_MS);
  }
  const profile = 'https://unsplash.com/@' + user;
  r.from = profile;
  const page = await getPage(profile);
  if (page.status >= 400) {
    r.notes.push(refusedReason('unsplash', page.status, page.statusText));
    return;
  }
  const listed = parseUnsplashUserPage(page.html, user ?? '');
  for (const x of listed.refused) r.failed.push({ url: x.pageUrl, reason: 'left out: ' + x.reason });
  // The photo given first, then the profile's listing in order.
  const order = [...(firstPhoto ? [firstPhoto] : []), ...listed.photos.map((p) => p.pageUrl)];
  const ids = new Set<string>();
  const queue = order.filter((u) => {
    const id = (u.replace(/\/$/, '').split('/').pop() ?? '').slice(-11);
    if (ids.has(id)) return false;
    ids.add(id);
    return true;
  });
  if (!listed.photos.length) r.notes.push('the profile page listed no photographs that can be taken');
  for (const url of queue) {
    if (r.saved.length >= o.limit) break;
    await sleep(SERIES_PAUSE_MS);
    const got = await takePage(url, 'unsplash', o, user ?? 'unsplash', 'series ' + profile, (p) =>
      listed.name && !sameName(p.author, listed.name) ? `by ${p.author}, not ${listed.name} (a promoted or shared listing)` : null);
    if (got.credit && got.bytes !== undefined) r.saved.push({ credit: got.credit, bytes: got.bytes });
    else r.failed.push({ url, reason: got.error ?? 'unknown' });
  }
  if (listed.photos.length >= 18 && r.saved.length < o.limit) {
    r.notes.push('Unsplash shows about 20 photographs on a profile page without a browser; open ' + profile + ' to see the rest and pass chosen pages to add');
  }
}

async function seriesPexels(target: Extract<SeriesTarget, { kind: 'pexels-photo' | 'pexels-user' | 'pexels-collection' }>, o: Options, r: SeriesResult): Promise<void> {
  const key = (process.env['PEXELS_API_KEY'] ?? '').trim();
  const headers = { Authorization: key };
  r.from = target.url;
  if (!key) {
    // No key: the public page, which Pexels usually puts behind a check for automated visitors.
    const page = await getPage(target.url);
    if (page.status >= 400 || /<title>\s*Just a moment/i.test(page.html)) {
      r.notes.push(`Pexels put a check for automated visitors in front of ${target.url} (it answered ${page.status}${page.statusText ? ' ' + page.statusText : ''}). ` +
        'Argus does not get round such checks. Set PEXELS_API_KEY (free at pexels.com/api) and run series again, or open the page in a browser and pass the photo pages you choose to add');
      return;
    }
    if (target.kind === 'pexels-photo') {
      const got = await takePage(target.url, 'pexels', o, 'pexels', 'series ' + target.url);
      if (got.credit && got.bytes !== undefined) r.saved.push({ credit: got.credit, bytes: got.bytes });
      else r.failed.push({ url: target.url, reason: got.error ?? 'unknown' });
      r.notes.push('without PEXELS_API_KEY only the photo given can be taken; set the key to find more by the same photographer');
      return;
    }
    const links = [...new Set([...page.html.matchAll(/href="(\/(?:[a-z]{2}-[a-z]{2}\/)?photo\/[^"?#]+)"/g)].map((m) => 'https://www.pexels.com' + (m[1] ?? '')))];
    for (const url of links) {
      if (r.saved.length >= o.limit) break;
      await sleep(SERIES_PAUSE_MS);
      const got = await takePage(url, 'pexels', o, 'pexels', 'series ' + target.url);
      if (got.credit && got.bytes !== undefined) r.saved.push({ credit: got.credit, bytes: got.bytes });
      else r.failed.push({ url, reason: got.error ?? 'unknown' });
    }
    return;
  }
  let pool: Candidate[] = [];
  let label = 'pexels';
  if (target.kind === 'pexels-collection') {
    for (let page = 1; page <= 2 && pool.length < o.limit; page++) {
      const parsed = parsePexels(await getJson(pexelsCollectionUrl(target.id, page), headers));
      pool.push(...parsed.candidates);
      if (parsed.candidates.length < 80) break;
    }
    label = 'pexels-collection-' + target.id;
  } else if (target.kind === 'pexels-photo') {
    const body = await getJson(pexelsPhotoUrl(target.id), headers);
    const self = parsePexels({ photos: [body] }).candidates;
    const who = isObject(body) ? body['photographer_id'] : null;
    const name = isObject(body) ? str(body['photographer']) : '';
    const alt = isObject(body) ? plainText(str(body['alt'])) : '';
    pool.push(...self);
    // The Pexels API has no list of one photographer's work: look for theirs among results for the photo's own words.
    const words = alt.split(/\s+/).filter((w) => w.length > 3).slice(0, 4).join(' ') || alt;
    if (who && words) {
      for (let page = 1; page <= 3 && pool.length < o.limit; page++) {
        const res = await getJson(pexelsUrl(words, null, page, 80), headers);
        const photos = isObject(res) && Array.isArray(res['photos']) ? res['photos'].filter((p) => isObject(p) && p['photographer_id'] === who) : [];
        pool.push(...parsePexels({ photos }).candidates);
      }
    }
    pool = interleave(pool);
    label = slug(name || 'pexels', 24);
    r.notes.push(`the Pexels API has no list of one photographer's work: found ${pool.length} by ${name || 'them'} among results for "${words}". Their profile shows the rest in a browser`);
  } else {
    r.notes.push('the Pexels API cannot list a photographer from their profile address; pass one of their photo pages (https://www.pexels.com/photo/...) or a collection instead');
    return;
  }
  for (const c of pool) {
    if (r.saved.length >= o.limit) break;
    try {
      const got = await download(c, label, o.out, null, null, true, 'series ' + target.url);
      if (typeof got === 'string') r.failed.push({ url: c.pageUrl, reason: got });
      else r.saved.push(got);
    } catch (err) {
      r.failed.push({ url: c.pageUrl, reason: describeError(err) });
    }
  }
}

async function seriesOpenverse(creator: string, providers: string[] | null, o: Options, r: SeriesResult): Promise<void> {
  r.from = 'Openverse creator "' + creator + '"' + (providers ? ' on ' + providers.join(', ') : '');
  const seen: Candidate[] = [];
  for (let page = o.page; page < o.page + 3 && page * OPENVERSE_PAGE_SIZE <= OPENVERSE_DEPTH; page++) {
    const parsed = parseOpenverse(await getJson(openverseUrl('', null, { creator, providers, page, photograph: false, large: false })));
    for (const s of parsed.skipped) r.failed.push({ url: '', reason: s });
    // Openverse matches the creator field loosely; keep only exact names.
    seen.push(...parsed.candidates.filter((c) => sameName(c.author, creator)));
    const usable = seen.filter((c) => !c.byHand && !rejectReason(c, null)).length;
    if (usable >= o.limit || !parsed.pageCount || page >= parsed.pageCount) break;
  }
  for (const c of interleave(seen)) {
    if (r.saved.length >= o.limit) break;
    if (c.byHand) {
      r.byHand.push(c);
      continue;
    }
    const reason = rejectReason(c, null);
    if (reason) {
      r.failed.push({ url: c.pageUrl, reason });
      continue;
    }
    try {
      const got = await download(c, creator, o.out, null, null, true, 'series ' + creator);
      if (typeof got === 'string') r.failed.push({ url: c.pageUrl, reason: got });
      else r.saved.push(got);
    } catch (err) {
      r.failed.push({ url: c.pageUrl, reason: describeError(err) });
    }
  }
}

async function series(o: Options): Promise<number> {
  const r: SeriesResult = { from: '', saved: [], failed: [], byHand: [], notes: [] };
  const target = o.target ? seriesTarget(o.target) : null;
  if (o.target && !target) {
    console.log('Not a series address: ' + o.target + '. Give an Unsplash profile or photo page, a Pexels photo, profile or collection page, an openverse.org image page, or --creator "<name>".');
    return 1;
  }
  fs.mkdirSync(o.out, { recursive: true });
  try {
    if (!target) await seriesOpenverse(o.creator ?? '', o.sources?.filter((s) => OPENVERSE_PROVIDERS.includes(s)) ?? null, o, r);
    else if (target.kind === 'unsplash-user' || target.kind === 'unsplash-photo') await seriesUnsplash(target, o, r);
    else if (target.kind === 'openverse-image') {
      const body = await getJson('https://api.openverse.org/v1/images/' + encodeURIComponent(target.id) + '/');
      const creator = isObject(body) ? plainText(str(body['creator'])) : '';
      const provider = isObject(body) ? str(body['source']).toLowerCase() : '';
      if (!creator) r.notes.push('Openverse names no creator for that image');
      else await seriesOpenverse(creator, provider ? [provider] : null, o, r);
    } else await seriesPexels(target, o, r);
  } catch (err) {
    const why = hideKeys(describeError(err));
    r.notes.push('the series could not be read (' + why + ')' + (!target && /50[234]|too long/.test(why) ? '. Openverse is slow on creator searches at times: try again in a minute, or name the provider with --source (for example --source stocksnap)' : ''));
  }
  const creditsFile = r.saved.length ? writeCredits(o.out, r.saved.map((s) => s.credit)) : null;
  if (o.json) {
    console.log(JSON.stringify({ from: r.from, dir: path.resolve(o.out), saved: r.saved.map((s) => ({ ...s.credit, bytes: s.bytes })), failed: r.failed, byHand: r.byHand.map(byHandEntry), notes: r.notes }, null, 2));
  } else {
    console.log(`Series from ${r.from || o.target || o.creator}: saved ${r.saved.length} of ${o.limit} asked for.`);
    if (r.saved.length) {
      console.log('');
      printSavedTable(r.saved, 18);
    }
    printByHand(r.byHand);
    const failed = r.failed.filter((f) => f.url);
    if (failed.length) {
      console.log(`\nLeft out ${failed.length}:`);
      for (const f of failed.slice(0, 12)) console.log('  ' + f.url + ': ' + f.reason);
      if (failed.length > 12) console.log(`  ...and ${failed.length - 12} more (--json lists them all)`);
    }
    for (const n of r.notes) console.log('Note: ' + hideKeys(n) + '.');
    if (creditsFile) console.log(`\nCredits in ${creditsFile}. Next: node photos.js sheet ${o.out} to judge them in one look.`);
  }
  return r.saved.length ? 0 : 2;
}

const byHandEntry = (c: Candidate): Record<string, unknown> => ({ title: c.title, author: c.author, sourcePage: c.pageUrl, licence: c.licence, width: c.byHand?.width ?? null, height: c.byHand?.height ?? null, reason: c.byHand?.reason ?? '' });

/** Previews grouped by photographer, the largest group first, so one photographer's set shows as a run. */
export function groupByAuthor<T extends { author: string }>(list: T[]): T[] {
  const n = new Map<string, number>();
  for (const c of list) n.set(c.author, (n.get(c.author) ?? 0) + 1);
  return list.map((c, i) => ({ c, i })).sort((a, b) => (n.get(b.c.author) ?? 0) - (n.get(a.c.author) ?? 0) || a.c.author.localeCompare(b.c.author) || a.i - b.i).map((x) => x.c);
}

function printByHand(all: Candidate[]): void {
  if (!all.length) return;
  const list = groupByAuthor(all);
  const why = [...new Set(list.map((c) => c.byHand?.reason ?? 'only a preview can be downloaded'))];
  console.log(`\nFull size by hand (${why.join('; ')}). Open the page, download the file yourself, and credit it as listed:`);
  for (const c of list.slice(0, 10)) console.log('  ' + clip(`${c.byHand?.width ?? '?'}x${c.byHand?.height ?? '?'}`, 11) + clip(c.licence, 10) + clip(c.author, 22) + c.pageUrl);
  if (list.length > 10) console.log(`  ...and ${list.length - 10} more (--json lists them all)`);
}

// ---- search ---------------------------------------------------------------------------------

interface Found {
  name: Source;
  candidates: Candidate[];
  skipped: string[];
  info: string[];
}

/**
 * Openverse, large photographs first. If that leaves fewer than `need` usable pictures it reads the
 * next pages (up to three in all), then widens to large images of any category, which brings in
 * Commons and WordPress photographs that carry no category.
 */
async function searchOpenverse(query: string, o: Options, providers: string[] | null, need: number): Promise<Found> {
  const f: Found = { name: 'openverse', candidates: [], skipped: [], info: [] };
  const usable = (): number => interleave(f.candidates).filter((c) => !c.byHand && !rejectReason(c, o.orientation, o.minWidth)).length;
  const base = { providers, creator: o.creator };
  let total = 0;
  for (let page = o.page; page < o.page + 3 && page * OPENVERSE_PAGE_SIZE <= OPENVERSE_DEPTH; page++) {
    const parsed = parseOpenverse(await getJson(openverseUrl(query, o.orientation, { ...base, page })));
    f.candidates.push(...parsed.candidates);
    f.skipped.push(...parsed.skipped);
    total = parsed.total ?? total;
    if (usable() >= need || !parsed.pageCount || page >= parsed.pageCount) break;
  }
  if (usable() < need && !o.creator) {
    const before = f.candidates.length;
    // Any kind of large image, leaving out the providers that give only previews (unless asked for by name).
    const parsed = parseOpenverse(await getJson(openverseUrl(query, o.orientation, { ...base, page: o.page, photograph: false, exclude: providers ? null : Object.keys(PREVIEW_ONLY) })));
    const known = new Set(f.candidates.map(sameKey));
    f.candidates.push(...parsed.candidates.filter((c) => !known.has(sameKey(c))));
    f.skipped.push(...parsed.skipped);
    f.info.push(`Openverse had ${total} large photographs for "${query}"; widened to large images of any kind that can be downloaded at full size, for ${f.candidates.length - before} more`);
  }
  return f;
}

async function searchCommons(query: string, o: Options): Promise<Found> {
  const f: Found = { name: 'wikimedia', candidates: [], skipped: [], info: [] };
  if (o.best) {
    // Quality and featured pictures first, then the rest of the search, best first.
    const rated = parseCommons(await getJson(commonsUrl(query, true, { rated: true, page: o.page })));
    const all = parseCommons(await getJson(commonsUrl(query, true, { page: o.page })));
    f.candidates = interleave(rankCommons(rated.candidates).concat(rankCommons(all.candidates)));
    f.skipped.push(...rated.skipped, ...all.skipped);
  } else {
    const parsed = parseCommons(await getJson(commonsUrl(query, false, { page: o.page })));
    f.candidates = parsed.candidates;
    f.skipped = parsed.skipped;
  }
  return f;
}

async function searchMet(query: string, o: Options, need: number): Promise<Found> {
  const f: Found = { name: 'met', candidates: [], skipped: [], info: [] };
  const body = await getJson(metSearchUrl(query, o.page));
  const ids = isObject(body) && Array.isArray(body['objectIDs']) ? (body['objectIDs'] as unknown[]).slice(0, Math.min(20, Math.max(8, need * 2))) : [];
  // One object at a time: The Met asks callers to keep to about 80 requests a second, and this stays far below.
  for (const id of ids) {
    try {
      const c = parseMetObject(await getJson(metObjectUrl(String(id))));
      if (typeof c === 'string') f.skipped.push(c);
      else f.candidates.push(c);
    } catch (err) {
      f.skipped.push(`met: object ${String(id)} could not be read (${describeError(err)})`);
    }
  }
  return f;
}

async function searchSimple(name: Source, url: string, parse: (b: unknown) => Parsed, headers: Record<string, string> = {}): Promise<Found> {
  const parsed = parse(await getJson(url, headers));
  return { name, candidates: parsed.candidates, skipped: parsed.skipped, info: [] };
}

/** How many results each filter dropped, for the summary line. */
export interface LeftOut {
  narrow: number;
  small: number;
  shape: number;
  licence?: number;
  preview?: number;
  format?: number;
  failed?: number;
}

/** Which filter a reason belongs to. */
export function filterOf(reason: string): keyof LeftOut | null {
  if (reason.startsWith('too narrow')) return 'narrow';
  if (reason.startsWith('too small')) return 'small';
  if (/, not (landscape|portrait|square)$/.test(reason)) return 'shape';
  if (reason.includes(LICENCE_REFUSED) || reason.includes('not public domain') || reason.includes('has no CC0 image')) return 'licence';
  if (reason.includes('not a photograph format') || reason.includes('has no JPEG') || reason.startsWith('not a JPEG, PNG or WebP')) return 'format';
  return null;
}

async function searchPhotos(o: Options): Promise<number> {
  const query = o.query ?? '';
  const notes: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  const unreachable: string[] = [];
  const pexelsKey = (process.env['PEXELS_API_KEY'] ?? '').trim();
  const pixabayKey = (process.env['PIXABAY_API_KEY'] ?? '').trim();
  const plan = planSources(o.sources, { pexels: !!pexelsKey, pixabay: !!pixabayKey }, o.creator);
  for (const n of plan.notes) warnings.push(n + '.');
  const need = o.count;
  const jobs: Array<[Source, () => Promise<Found>]> = [];
  if (plan.openverse) {
    const providers = plan.openverse.providers;
    jobs.push(['openverse', () => searchOpenverse(query, o, providers, need)]);
  }
  if (plan.commons) jobs.push(['wikimedia', () => searchCommons(query, o)]);
  // Pexels and Pixabay need a key of the user's own; without one they are not asked at all.
  if (plan.pexels) jobs.push(['pexels', () => searchSimple('pexels', pexelsUrl(query, o.orientation, o.page), parsePexels, { Authorization: pexelsKey })]);
  if (plan.pixabay) jobs.push(['pixabay', () => searchSimple('pixabay', pixabayUrl(query, pixabayKey, o), parsePixabay)]);
  for (const a of plan.archives) {
    if (a === 'europeana') jobs.push(['europeana', () => searchSimple('europeana', europeanaUrl(query, o.page, (process.env['EUROPEANA_API_KEY'] ?? '').trim() || 'api2demo'), parseEuropeana)]);
    if (a === 'cleveland') jobs.push(['cleveland', () => searchSimple('cleveland', clevelandUrl(query, o.page), parseCleveland)]);
    if (a === 'met') jobs.push(['met', () => searchMet(query, o, need)]);
    if (a === 'nasa') jobs.push(['nasa', () => searchSimple('nasa', nasaUrl(query, o.page), parseNasa)]);
    if (a === 'smithsonian') jobs.push(['smithsonian', () => searchSimple('smithsonian', smithsonianUrl(query, o.page, (process.env['SMITHSONIAN_API_KEY'] ?? '').trim() || 'DEMO_KEY'), parseSmithsonian)]);
  }
  if (!jobs.length) {
    for (const w of warnings) console.log('Warning: ' + w);
    console.log('No source left to search. Set the key named above, or choose other sources with --source.');
    return 2;
  }
  const found = await Promise.all(
    jobs.map(async ([name, run]) => {
      try {
        const f = await run();
        notes.push(...f.skipped);
        info.push(...f.info);
        return f;
      } catch (err) {
        const reason = hideKeys(describeError(err));
        // One failing source does not stop the others: say so in one line and carry on.
        warnings.push(`${SOURCE_NAMES[name]} search failed (${reason}); carrying on with the other sources.`);
        if (isNetworkFailure(reason)) unreachable.push(name);
        return { name, candidates: [], skipped: [], info: [] } as Found;
      }
    }),
  );

  if (unreachable.length === jobs.length) {
    const names = jobs.map((s) => SOURCE_NAMES[s[0]]);
    console.log('Could not reach ' + (names.length > 2 ? names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1] : names.join(' or ')) + '. The network seems to be unavailable here.');
    console.log('Nothing was downloaded. Ask the user to supply photographs, or use the next rung of the ladder in pictures.md.');
    return 2;
  }

  // Why results were left out, by filter, for the summary line: so a short list explains itself.
  const leftOut: Required<LeftOut> = { narrow: 0, small: 0, shape: 0, licence: 0, preview: 0, format: 0, failed: 0 };
  const tally = (reason: string): void => {
    const k = filterOf(reason);
    if (k) leftOut[k]++;
  };
  for (const n of notes) tally(n);
  const pool: Candidate[] = [];
  const byHand: Candidate[] = [];
  // Previews go last, so they do not take a source's turn from a picture that can be downloaded.
  for (const c of [...interleave(...found.map((f) => f.candidates.filter((x) => !x.byHand))), ...interleave(...found.map((f) => f.candidates.filter((x) => x.byHand)))]) {
    const reason = rejectReason(c.byHand ? { width: c.byHand.width, height: c.byHand.height } : c, o.orientation, o.minWidth);
    if (reason) {
      notes.push(`${c.source}: "${c.title}" skipped, ${reason}`);
      tally(reason);
    } else if (c.byHand) {
      byHand.push(c);
      leftOut.preview++;
    } else pool.push(c);
  }

  fs.mkdirSync(o.out, { recursive: true });
  const saved: Saved[] = [];
  for (const c of pool) {
    if (saved.length >= o.count) break;
    try {
      const result = await download(c, query || o.creator || 'photo', o.out, o.orientation, o.minWidth, true, query);
      if (typeof result === 'string') {
        notes.push(`${c.source}: "${c.title}" skipped, ${result}`);
        if (filterOf(result)) tally(result);
        else leftOut.failed++;
      } else saved.push(result);
    } catch (err) {
      notes.push(`${c.source}: "${c.title}" skipped, ${describeError(err)}`);
      leftOut.failed++;
    }
  }

  const creditsFile = saved.length ? writeCredits(o.out, saved.map((s) => s.credit)) : null;
  const commonsFound = found.find((f) => f.name === 'wikimedia')?.candidates ?? [];

  if (o.json) {
    const result: Record<string, unknown> = { search: query, dir: path.resolve(o.out), sources: Object.fromEntries(found.map((f) => [f.name, f.candidates.length])), saved: saved.map((s) => ({ ...s.credit, bytes: s.bytes })), skipped: notes };
    if (byHand.length) result['byHand'] = byHand.map(byHandEntry);
    if (o.creator) result['creator'] = o.creator;
    if (info.length) result['info'] = info;
    if (warnings.length) result['warnings'] = warnings;
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const w of warnings) console.log('Warning: ' + w);
    console.log(`Search: "${query}"${o.creator ? ' by ' + o.creator : ''}  ` + found.map((f) => `${f.candidates.length} from ${SOURCE_NAMES[f.name]}${f.name === 'openverse' ? providerBreakdown(f.candidates) : ''}`).join(', ') +
      ' with a reusable licence' + whyFew(o, leftOut, commonsFound, saved.length));
    for (const i of info) console.log('  (' + i + ')');
    if (saved.length) {
      console.log('');
      printSavedTable(saved);
    }
    printByHand(byHand);
    if (notes.length) {
      console.log(`\nLeft out ${notes.length}:`);
      for (const n of notes.slice(0, 12)) console.log('  ' + (n.length > 150 ? n.slice(0, 147) + '...' : n));
      if (notes.length > 12) console.log(`  ...and ${notes.length - 12} more (--json lists them all)`);
    }
    if (saved.length) {
      console.log(`\nSaved ${saved.length} of ${o.count} asked for in ${path.resolve(o.out)}; credits in ${creditsFile}.`);
      console.log('Open and look at every one (node photos.js sheet ' + o.out + ' shows them all in one picture). Keep only those that fit the subject and the direction, and credit them as their licence requires.');
    }
  }
  if (!saved.length) {
    console.log('Nothing could be downloaded for this search. Try other words (the thing itself, not a mood), fewer words, or a different orientation.');
  }
  if (!o.json && saved.length < o.count) {
    console.log('For an everyday subject (a shop, a practice, people at work), choose photographs on unsplash.com or pexels.com and take them with: node photos.js add <photo-page-url> --out ' + o.out);
    console.log('or take one photographer\'s set with: node photos.js series <unsplash-profile-or-photo-url> --out ' + o.out);
  }
  return saved.length ? 0 : 2;
}

/** "(12 rawpixel, 3 wordpress)" for the Openverse count, or nothing. */
export function providerBreakdown(list: Candidate[]): string {
  const counts = new Map<string, number>();
  for (const c of list) if (c.provider) counts.set(c.provider, (counts.get(c.provider) ?? 0) + 1);
  if (!counts.size) return '';
  return ' (' + [...counts].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${n} ${p}`).join(', ') + ')';
}

/**
 * The end of the summary line: how many results each filter left out (licence, preview only, size,
 * width, shape, failed downloads), and what --best found among the Commons results, so a short list
 * says why it is short. Empty when nothing was left out and --best was not given.
 */
export function whyFew(o: Pick<Options, 'minWidth' | 'best' | 'orientation' | 'count'>, leftOut: LeftOut, commons: Candidate[], saved: number): string {
  const parts: string[] = [];
  if (leftOut.licence) parts.push(`${leftOut.licence} refused for their licence`);
  if (leftOut.preview) parts.push(`${leftOut.preview} only as a small preview (full size by hand, listed below)`);
  if (leftOut.narrow) parts.push(`${leftOut.narrow} narrower than --min-width ${o.minWidth}px`);
  if (leftOut.small) parts.push(`${leftOut.small} under ${MIN_LONG_SIDE}px on the long side`);
  if (leftOut.shape) parts.push(`${leftOut.shape} not ${o.orientation}`);
  if (leftOut.format) parts.push(`${leftOut.format} not in a photograph format`);
  if (leftOut.failed) parts.push(`${leftOut.failed} that would not download`);
  let out = parts.length ? `; left out ${parts.join(', ')}, so ${saved} of ${o.count} asked for remain` : '';
  if (o.best) {
    const rated = commons.filter((c) => (c.quality ?? 0) > 0).length;
    out += `; --best: ${rated} of ${commons.length} Commons results are featured, quality or valued images` + (rated ? ', listed first' : '');
  }
  return out;
}

/** Fit text to a column of n characters, always leaving a space before the next column. */
const clip = (s: string, n: number): string => (s.length > n - 1 ? s.slice(0, n - 2) + '~' : s).padEnd(n);

// ---- local files: sheet, grade, deliver, cutout ---------------------------------------------

const IMAGE_FILE = /\.(jpe?g|png|webp)$/i;
const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', html: 'text/html; charset=utf-8', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg' };

/** The photographs in a folder, by name, leaving out a contact sheet and cut-outs made here. */
export function listImages(dir: string, also: RegExp | null = null): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.') && (IMAGE_FILE.test(e.name) || (also?.test(e.name) ?? false)) && !/^sheet\.(jpe?g|png)$/i.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/** An executable on PATH, or null. */
export function findTool(name: string): string | null {
  for (const dir of (process.env['PATH'] ?? '').split(path.delimiter)) {
    if (!dir) continue;
    const p = path.join(dir, name + (process.platform === 'win32' ? '.exe' : ''));
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A minimal client for the browser's debugging protocol: commands only, no events. */
class Cdp {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }>();
  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (ev: MessageEvent) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: Record<string, unknown>; error?: { message: string } };
      if (msg.id === undefined) return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result ?? {});
    });
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) p.reject(new Error('the browser closed the connection'));
      this.pending.clear();
    });
  }
  static open(address: string): Promise<Cdp> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(address);
      const timer = setTimeout(() => {
        try { ws.close(); } catch { /* not open */ }
        reject(new Error('could not connect to the browser in time'));
      }, 10000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(new Cdp(ws)); });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('could not connect to the browser')); });
    });
  }
  /** Every command is answered within `timeoutMs` or rejected: a stuck browser never holds the process open. */
  send(method: string, params: Record<string, unknown> = {}, sessionId?: string, timeoutMs = 30000): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    const message: Record<string, unknown> = { id, method, params };
    if (sessionId) message['sessionId'] = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`the browser did not answer ${method} in time`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      try {
        this.ws.send(JSON.stringify(message));
      } catch (e) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }
  close(): void {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

export interface Lab {
  /** Evaluate in the page and return the value; a thrown error becomes a rejection with its message. */
  run<T>(expression: string, timeoutMs?: number): Promise<T>;
  /** Show this HTML and capture the whole of it as a JPEG, `width` pixels wide. */
  shoot(html: string, width: number): Promise<Buffer>;
  close(): Promise<void>;
}

/**
 * The headless browser shot.js uses (the same findBrowser), opened on a page served from 127.0.0.1
 * by this process. The page can read the folder's pictures at /f/<name> and send results to
 * /out/<name>, which are written into `outDir`, never over a file in `root`.
 */
export async function openLab(root: string, files: string[], outDir: string | null): Promise<Lab> {
  const browser = findBrowser();
  if (!browser) throw new Error('no Chrome-family browser was found (looked for Chrome, Chromium, Brave, Edge, Vivaldi; set ARGUS_BROWSER to one)');
  if (typeof WebSocket === 'undefined') throw new Error('this needs Node 22 or later');
  const served = new Set(files);
  const originals = new Set(listImages(root, /\.avif$/i).map((f) => path.resolve(root, f)));
  let pageHtml = '<!doctype html><meta charset="utf-8"><title>argus photos</title><body></body>';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const name = decodeURIComponent(url.pathname.slice(url.pathname.indexOf('/', 1) + 1));
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/page')) {
      res.writeHead(200, { 'content-type': MIME['html'] ?? 'text/html', 'cache-control': 'no-store' });
      res.end(pageHtml);
    } else if (req.method === 'GET' && url.pathname.startsWith('/f/') && served.has(name)) {
      res.writeHead(200, { 'content-type': MIME[path.extname(name).slice(1).toLowerCase()] ?? 'application/octet-stream' });
      fs.createReadStream(path.join(root, name)).pipe(res);
    } else if (req.method === 'GET' && url.pathname.startsWith('/o/') && outDir && /^[\w.\- ()]+$/.test(name) && !name.startsWith('.') && fs.existsSync(path.join(outDir, name))) {
      // A file this run wrote, read back so the browser can prove it decodes.
      res.writeHead(200, { 'content-type': MIME[path.extname(name).slice(1).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(path.join(outDir, name)).pipe(res);
    } else if (req.method === 'POST' && url.pathname.startsWith('/out/') && outDir && /^[\w.\- ()]+$/.test(name) && !name.startsWith('.')) {
      const dest = path.resolve(outDir, name);
      if (originals.has(dest)) {
        res.writeHead(409);
        res.end('refused: that would overwrite an original');
        return;
      }
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        fs.writeFileSync(dest, Buffer.concat(chunks));
        res.writeHead(200);
        res.end('ok');
      });
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  const base = 'http://127.0.0.1:' + (typeof addr === 'object' && addr ? addr.port : 0);
  const port = await new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const a = srv.address();
      const p = typeof a === 'object' && a ? a.port : 0;
      srv.close(() => resolve(p));
    });
  });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-photos-'));
  const child = spawn(browser, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-sync', '--disable-background-networking', '--disable-component-update', '--use-mock-keychain', '--password-store=basic', '--hide-scrollbars', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' });
  // The browser first (it holds keep-alive connections to the server), then every connection, then the
  // server: server.close alone waits for open connections and can hold the process open.
  const shutdown = async (conn: Cdp | null): Promise<void> => {
    conn?.close();
    await stopBrowser(child, profile);
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  };
  let conn: Cdp | null = null;
  try {
    let address = '';
    for (const started = Date.now(); !address && Date.now() - started < 20000; ) {
      if (child.exitCode !== null) throw new Error('the browser exited before it was ready');
      try {
        const info = await localJson<{ webSocketDebuggerUrl?: string }>(port, '/json/version');
        address = info.webSocketDebuggerUrl ?? '';
      } catch {
        await sleep(150);
      }
    }
    if (!address) throw new Error('the browser did not become ready in time');
    conn = await Cdp.open(address);
    const live = conn;
    const target = await live.send('Target.createTarget', { url: 'about:blank' });
    const session = String((await live.send('Target.attachToTarget', { targetId: target['targetId'], flatten: true }))['sessionId']);
    await live.send('Runtime.enable', {}, session);
    await live.send('Page.enable', {}, session);
    const run = async <T>(expression: string, timeoutMs = 180000): Promise<T> => {
      // The timer is cleared once the page answers: left running, it would hold this process open for minutes.
      let timer: NodeJS.Timeout | undefined;
      const res = await Promise.race([
        live.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session, timeoutMs + 1000),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('the browser took too long')), timeoutMs);
        }),
      ]).finally(() => clearTimeout(timer));
      const ex = res['exceptionDetails'] as { exception?: { description?: string }; text?: string } | undefined;
      if (ex) throw new Error((ex.exception?.description ?? ex.text ?? 'an error in the page').split('\n')[0]);
      return (res['result'] as { value?: T } | undefined)?.value as T;
    };
    const go = async (): Promise<void> => {
      await live.send('Page.navigate', { url: base + '/page' }, session, 15000);
      for (let i = 0; i < 100; i++) {
        const state = await run<string>('document.readyState').catch(() => '');
        if (state === 'complete') return;
        await sleep(100);
      }
    };
    await go();
    await run(PAGE_TOOLS);
    return {
      run,
      async shoot(html: string, width: number): Promise<Buffer> {
        pageHtml = html;
        await live.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false }, session);
        await go();
        const height = await run<number>(`Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))).then(() => new Promise((r) => { const done = () => r(Math.ceil(document.documentElement.scrollHeight)); requestAnimationFrame(done); setTimeout(done, 200); }))`, 60000);
        await live.send('Emulation.setDeviceMetricsOverride', { width, height: Math.min(16000, height), deviceScaleFactor: 1, mobile: false }, session);
        const shot = await live.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, captureBeyondViewport: true }, session, 60000);
        return Buffer.from(String(shot['data'] ?? ''), 'base64');
      },
      close: () => shutdown(live),
    };
  } catch (err) {
    await shutdown(conn);
    throw err;
  }
}

/**
 * The in-page tools, defined once on window.__a. Everything is canvas work on pictures the page loads
 * from /f/; results are posted to /out/. Kept as one string so it runs in the page, not in Node.
 */
const PAGE_TOOLS = String.raw`(() => {
  const A = {};
  A.load = (name) => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('could not decode ' + name)); img.src = '/f/' + encodeURIComponent(name); });
  A.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  A.blob = (c, type, q) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('could not encode ' + type))), type, q));
  A.post = async (name, blob) => { const r = await fetch('/out/' + encodeURIComponent(name), { method: 'POST', body: blob }); if (!r.ok) throw new Error(await r.text()); return blob.size; };
  A.rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  A.hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  A.typeOf = (name) => /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg';
  A.dominant = (img) => {
    const c = A.canvas(64, 64); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data; const buckets = new Map();
    for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4); const b = buckets.get(k) || [0, 0, 0, 0]; b[0] += d[i]; b[1] += d[i + 1]; b[2] += d[i + 2]; b[3]++; buckets.set(k, b); }
    let best = null; for (const b of buckets.values()) if (!best || b[3] > best[3]) best = b;
    return A.hex(best[0] / best[3], best[1] / best[3], best[2] / best[3]);
  };
  A.grade = async (name, out, look, ink, paper) => {
    const img = await A.load(name); const w = img.naturalWidth, h = img.naturalHeight;
    const c = A.canvas(w, h); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, w, h); const d = id.data;
    if (look === 'mono' || look === 'duotone') {
      const k = look === 'mono' ? 3 : 2; const s = (v) => 1 / (1 + Math.exp(k * (0.5 - v))); const s0 = s(0), s1 = s(1);
      const a = A.rgb(ink), b = A.rgb(paper); const lut = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
      for (let i = 0; i < 256; i++) { const t = (s(i / 255) - s0) / (s1 - s0); for (let ch = 0; ch < 3; ch++) lut[ch][i] = a[ch] + (b[ch] - a[ch]) * t; }
      for (let i = 0; i < d.length; i += 4) { const l = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); d[i] = lut[0][l]; d[i + 1] = lut[1][l]; d[i + 2] = lut[2][l]; }
    } else {
      const m = look === 'warm' ? [1.05, 1, 0.92] : [0.94, 1, 1.05];
      for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; for (let ch = 0; ch < 3; ch++) d[i + ch] = (l + (d[i + ch] - l) * 0.85) * m[ch]; }
    }
    x.putImageData(id, 0, 0);
    const type = A.typeOf(out); const bytes = await A.post(out, await A.blob(c, type, 0.9));
    return { width: w, height: h, bytes };
  };
  // maxBytes (--max-kb): each file is re-encoded at lower quality (to a floor) until it fits; a width that
  // still does not fit is drawn smaller, step by step, and listed at the width it was written.
  A.variants = async (name, stem, widths, avif, maxBytes) => {
    const img = await A.load(name); const W = img.naturalWidth, H = img.naturalHeight;
    const list = widths.filter((w) => w <= W); if (list.length < widths.length && !list.includes(W)) list.push(W);
    const out = [];
    const draw = async (w) => {
      const h = Math.round(H * w / W);
      const bmp = await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
      const c = A.canvas(w, h); c.getContext('2d').drawImage(bmp, 0, 0); bmp.close();
      return c;
    };
    const formats = [['webp', 'image/webp', 0.78, 0.4], ['jpg', 'image/jpeg', 0.8, 0.45]];
    if (avif) formats.unshift(['avif', 'image/avif', 0.5, 0.25]);
    for (const w0 of list) {
      for (const [ext, type, q0, floor] of formats) {
        let w = w0; let c = await draw(w); let q = q0;
        let b = await A.blob(c, type, q);
        if (b.type !== type) continue;
        while (maxBytes && b.size > maxBytes) {
          if (q - 0.08 >= floor) q -= 0.08;
          else if (w > 160) { w = Math.max(160, Math.round(w * 0.85)); c = await draw(w); q = q0; }
          else break;
          b = await A.blob(c, type, q);
        }
        if (maxBytes && w !== w0 && out.some((v) => v.format === ext && v.width === w)) continue;
        const h = Math.round(H * w / W);
        const file = stem + '-' + w + '.' + ext; out.push({ file, format: ext, width: w, height: h, bytes: await A.post(file, b) });
      }
    }
    return { width: W, height: H, colour: A.dominant(img), variants: out };
  };
  // Sharpness: the variance of a 4-neighbour Laplacian on a greyscale copy at the width it will be shown,
  // per tile of a 4x4 grid; the sharpest tile is the measure, so a sharp subject on a soft background
  // passes. Brightness: mean luma, 0-255.
  A.sharp = async (name, width) => {
    const img = await A.load(name); const W = img.naturalWidth, H = img.naturalHeight;
    const w = Math.max(32, Math.min(width, W)); const h = Math.max(32, Math.round(H * w / W));
    const bmp = await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    const c = A.canvas(w, h); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0); bmp.close();
    const d = x.getImageData(0, 0, w, h).data; const g = new Float32Array(w * h); let sum = 0;
    for (let p = 0, i = 0; p < w * h; p++, i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; g[p] = l; sum += l; }
    const T = 4; const tiles = []; let n = 0, m = 0, m2 = 0;
    for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
      const x0 = Math.max(1, Math.floor(tx * w / T)), x1 = Math.min(w - 1, Math.floor((tx + 1) * w / T));
      const y0 = Math.max(1, Math.floor(ty * h / T)), y1 = Math.min(h - 1, Math.floor((ty + 1) * h / T));
      let tn = 0, tm = 0, tm2 = 0;
      for (let y = y0; y < y1; y++) for (let x2 = x0; x2 < x1; x2++) { const p = y * w + x2; const v = g[p - 1] + g[p + 1] + g[p - w] + g[p + w] - 4 * g[p]; tn++; tm += v; tm2 += v * v; }
      if (tn) tiles.push(tm2 / tn - (tm / tn) * (tm / tn));
      n += tn; m += tm; m2 += tm2;
    }
    tiles.sort((a, b) => b - a);
    return { width: W, height: H, at: w, sharpness: Math.round(tiles[0] || 0), overall: Math.round(n ? m2 / n - (m / n) * (m / n) : 0), brightness: Math.round(sum / (w * h)) };
  };
  // One frame of a video as a JPEG: read whole as a blob (so seeking works without range requests), seek, draw.
  A.poster = async (name, out, at) => {
    const b = await (await fetch('/f/' + encodeURIComponent(name))).blob();
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
    const url = URL.createObjectURL(b); v.src = url;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('the browser could not decode ' + name)); });
    const t = Math.max(0, Math.min(at, (isFinite(v.duration) ? v.duration : at) - 0.05));
    if (Math.abs(v.currentTime - t) > 0.01) await new Promise((res) => { v.onseeked = res; v.currentTime = t; });
    const c = A.canvas(v.videoWidth, v.videoHeight); c.getContext('2d').drawImage(v, 0, 0);
    URL.revokeObjectURL(url);
    return { width: v.videoWidth, height: v.videoHeight, bytes: await A.post(out, await A.blob(c, 'image/jpeg', 0.88)) };
  };
  // Pixels for the palette: the picture scaled to at most size pixels on its long side, as r,g,b triples.
  A.pixels = async (name, size) => {
    const img = await A.load(name); const W = img.naturalWidth, H = img.naturalHeight; const k = Math.min(1, size / Math.max(W, H));
    const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    const bmp = await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    const c = A.canvas(w, h); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0); bmp.close();
    const d = x.getImageData(0, 0, w, h).data; const out = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) out.push(d[i], d[i + 1], d[i + 2]);
    return { width: W, height: H, pixels: out };
  };
  A.canAvif = async () => { const b = await A.blob(A.canvas(8, 8), 'image/avif', 0.5).catch(() => null); return !!b && b.type === 'image/avif'; };
  // Does a file this run wrote decode here, at the size expected, with something visible in it?
  // A <picture> does not fall back to the next source when the chosen one fails to decode: it shows nothing.
  A.decodes = (name, w, h) => new Promise((res) => {
    const img = new Image();
    img.onerror = () => res(false);
    img.onload = () => {
      if (img.naturalWidth !== w || img.naturalHeight !== h) return res(false);
      const c = A.canvas(16, 16); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 16, 16);
      const d = x.getImageData(0, 0, 16, 16).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i];
      res(a > 0);
    };
    img.src = '/o/' + encodeURIComponent(name) + '?' + Date.now();
  });
  A.cutout = async (name, out, tolerance, feather) => {
    const img = await A.load(name); const w = img.naturalWidth, h = img.naturalHeight;
    const c = A.canvas(w, h); const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, w, h); const d = id.data;
    const patch = (px, py) => { let r = 0, g = 0, b = 0, n = 0; const s = Math.max(2, Math.round(Math.min(w, h) / 100));
      for (let y = py; y < py + s; y++) for (let x2 = px; x2 < px + s; x2++) { const i = (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x2))) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      return [r / n, g / n, b / n]; };
    const s = Math.max(2, Math.round(Math.min(w, h) / 100));
    const corners = [patch(0, 0), patch(w - s, 0), patch(0, h - s), patch(w - s, h - s)];
    const bg = [0, 1, 2].map((ch) => corners.reduce((t, k) => t + k[ch], 0) / 4);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const spread = Math.max(...corners.map((k) => dist(k, bg)));
    const limit = tolerance / 100 * 441.7;
    const isBg = new Uint8Array(w * h); const stack = new Int32Array(w * h); let top = 0;
    const near = (p) => { const i = p * 4; const dr = d[i] - bg[0], dg = d[i + 1] - bg[1], db = d[i + 2] - bg[2]; return Math.sqrt(dr * dr + dg * dg + db * db) <= limit; };
    const seed = (p) => { if (!isBg[p] && near(p)) { isBg[p] = 1; stack[top++] = p; } };
    for (let x2 = 0; x2 < w; x2++) { seed(x2); seed((h - 1) * w + x2); }
    for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (top) { const p = stack[--top]; const px = p % w; if (px > 0) seed(p - 1); if (px < w - 1) seed(p + 1); if (p >= w) seed(p - w); if (p < w * (h - 1)) seed(p + w); }
    // Feather: blur the mask, then soften only the subject's own edge, so no background halo is kept.
    let alpha = new Float32Array(w * h); for (let p = 0; p < w * h; p++) alpha[p] = isBg[p] ? 0 : 1;
    if (feather > 0) {
      const blur = (src, horizontal) => { const dst = new Float32Array(w * h); const r = feather;
        for (let a = 0; a < (horizontal ? h : w); a++) { let sum = 0; const len = horizontal ? w : h; const at = (b) => horizontal ? a * w + b : b * w + a;
          for (let b = -r; b <= r; b++) sum += src[at(Math.min(len - 1, Math.max(0, b)))];
          for (let b = 0; b < len; b++) { dst[at(b)] = sum / (2 * r + 1); sum += src[at(Math.min(len - 1, b + r + 1))] - src[at(Math.max(0, b - r))]; } }
        return dst; };
      const soft = blur(blur(alpha, true), false);
      for (let p = 0; p < w * h; p++) if (!isBg[p]) alpha[p] = Math.min(1, Math.max(0, soft[p] * 2 - 1 + 0.0001) || 0) ;
    }
    let removed = 0;
    for (let p = 0; p < w * h; p++) { const a = alpha[p]; const i = p * 4; if (isBg[p]) removed++;
      if (a > 0 && a < 1) for (let ch = 0; ch < 3; ch++) d[i + ch] = (d[i + ch] - bg[ch] * (1 - a)) / a;
      d[i + 3] = Math.round(a * 255); }
    x.putImageData(id, 0, 0);
    const bytes = await A.post(out, await A.blob(c, 'image/png'));
    return { width: w, height: h, bytes, removed: removed / (w * h), background: A.hex(bg[0], bg[1], bg[2]), spread: Math.round(spread) };
  };
  window.__a = A; return true;
})()`;

/** The contact sheet page: every picture with its file name and pixel size under it (and its author when credits.json knows). */
export function sheetHtml(files: Array<{ name: string; src: string; width: number | null; height: number | null; author?: string }>, columns: number, title: string): string {
  const tiles = files
    .map((f) => `<figure><div class="frame"><img src="${escapeHtml(f.src)}" alt="" loading="eager" data-name="${escapeHtml(f.name)}"></div>` +
      `<figcaption><b>${escapeHtml(f.name)}</b><span class="size">${f.width && f.height ? f.width + '×' + f.height : ''}</span>${f.author ? `<span>${escapeHtml(f.author)}</span>` : ''}</figcaption></figure>`)
    .join('\n');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{margin:0;padding:16px;background:#f2f1ee;color:#1c1b1a;font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;width:${columns * 376 - 16}px}
  h1{font:600 14px/1.2 system-ui,sans-serif;margin:0 0 12px}
  .grid{display:grid;grid-template-columns:repeat(${columns},360px);gap:16px}
  figure{margin:0}
  .frame{width:360px;height:270px;background:#dcdad5;display:flex;align-items:center;justify-content:center}
  .frame img{max-width:100%;max-height:100%;display:block}
  figcaption{padding-top:6px;display:flex;flex-direction:column;gap:2px;overflow-wrap:anywhere}
  figcaption span{color:#57534e}
</style>
<h1>${escapeHtml(title)}</h1>
<div class="grid">
${tiles}
</div>
<script>for (const i of document.images) i.addEventListener('load', () => { const s = i.closest('figure').querySelector('.size'); if (s && !s.textContent) s.textContent = i.naturalWidth + '×' + i.naturalHeight; });</script>
</html>
`;
}

function sizeOfFile(file: string): { width: number; height: number } | null {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(256 * 1024);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return imageSize(buf.subarray(0, n));
  } catch {
    return null;
  }
}

function needDir(target: string | null, command: string): string | string[] {
  if (!target) return [command + ' needs a folder of photographs.'];
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) return ['Not a folder: ' + path.resolve(target)];
  return target;
}

async function sheet(o: Options): Promise<number> {
  const dir = needDir(o.target, 'sheet');
  if (typeof dir !== 'string') return fail(dir, 1);
  const files = listImages(dir, /\.avif$/i);
  if (!files.length) return fail(['No photographs (JPEG, PNG, WebP or AVIF) in ' + path.resolve(dir) + '.'], 2);
  const credits = new Map(readCredits(dir).map((c) => [str(c['file']), str(c['author'])]));
  const out = o.outGiven ? o.out : path.join(dir, 'sheet.jpg');
  const info = files.map((name) => ({ name, ...(sizeOfFile(path.join(dir, name)) ?? { width: null, height: null }), author: credits.get(name) || undefined }));
  const title = `${files.length} photographs in ${path.basename(path.resolve(dir))}`;
  // The page beside the pictures, so it also works opened in any browser.
  const htmlFile = out.replace(/\.(jpe?g|png)$/i, '') + '.html';
  const relative = path.relative(path.dirname(path.resolve(htmlFile)), path.resolve(dir));
  fs.writeFileSync(htmlFile, sheetHtml(info.map((f) => ({ ...f, src: (relative ? relative.split(path.sep).join('/') + '/' : '') + encodeURIComponent(f.name) })), o.columns, title));
  let method = 'browser';
  let error = '';
  try {
    const lab = await openLab(dir, files, null);
    try {
      const jpeg = await lab.shoot(sheetHtml(info.map((f) => ({ ...f, src: '/f/' + encodeURIComponent(f.name) })), o.columns, title), o.columns * 376 + 16);
      fs.writeFileSync(out, jpeg);
    } finally {
      await lab.close();
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    const magick = findTool('magick');
    if (magick) {
      const r = spawnSync(magick, ['montage', '-label', '%f\\n%wx%h', ...files.map((f) => path.join(dir, f)), '-tile', o.columns + 'x', '-geometry', '360x270+8+8', '-pointsize', '12', out], { stdio: 'ignore' });
      method = r.status === 0 ? 'ImageMagick' : '';
    } else method = '';
  }
  if (o.json) console.log(JSON.stringify({ sheet: method ? path.resolve(out) : null, html: path.resolve(htmlFile), method: method || 'html only', files: info, ...(error ? { browser: error } : {}) }, null, 2));
  else if (method) console.log(`Contact sheet of ${files.length} in ${path.resolve(out)} (made with the ${method}); the same as a page in ${path.resolve(htmlFile)}.`);
  else console.log(`Could not render the sheet (${error}); open ${path.resolve(htmlFile)} in a browser instead. It shows all ${files.length} with their names and sizes.`);
  return 0;
}

interface SharpResult { file: string; width: number; height: number; at: number; sharpness: number; overall: number; brightness: number; flags: string[]; error?: string }

async function sharp(o: Options): Promise<number> {
  let target = o.target ?? '';
  if (!fs.existsSync(target)) return fail(['Not a file or folder: ' + path.resolve(target)], 1);
  // A video: measure its poster frame (one second in), as the page will first show it.
  if (/\.(mp4|m4v|webm|mov|ogv)$/i.test(target) && fs.statSync(target).isFile()) {
    try {
      const frame = await (require('./video') as typeof import('./video')).posterForMeasuring(target, 1);
      if (!o.json) console.log(`${path.basename(target)}: measuring its frame at 1s (${frame}); pass a poster you made with photos.js poster to measure that one.`);
      target = frame;
      process.once('exit', () => fs.rmSync(path.dirname(frame), { recursive: true, force: true }));
    } catch (err) {
      return fail(['Could not take a frame of ' + target + ' to measure (' + (err instanceof Error ? err.message : String(err)) + '). Make a poster with photos.js poster and measure that.'], 2);
    }
  }
  const isDir = fs.statSync(target).isDirectory();
  const dir = isDir ? target : path.dirname(target);
  const files = isDir ? listImages(dir) : [path.basename(target)];
  if (!files.length) return fail(['No photographs (JPEG, PNG or WebP) in ' + path.resolve(dir) + '.'], 2);
  const results: SharpResult[] = [];
  try {
    const lab = await openLab(dir, files, null);
    try {
      for (const f of files) {
        try {
          const r = await lab.run<Omit<SharpResult, 'file' | 'flags'>>(`window.__a.sharp(${JSON.stringify(f)}, ${o.width})`);
          results.push({ file: f, ...r, flags: sharpVerdict(r) });
        } catch (err) {
          results.push({ file: f, width: 0, height: 0, at: 0, sharpness: 0, overall: 0, brightness: 0, flags: [], error: err instanceof Error ? err.message : String(err) });
        }
      }
    } finally {
      await lab.close();
    }
  } catch (err) {
    return fail(['Could not open the browser to measure the pictures (' + (err instanceof Error ? err.message : String(err)) + '). Look at each at the size it will be shown instead.'], 2);
  }
  if (o.json) console.log(JSON.stringify({ width: o.width, softBelow: SOFT_BELOW, darkBelow: DARK_BELOW, images: results }, null, 2));
  else {
    console.log(`Sharpness (sharpest area, Laplacian variance) and brightness (mean, 0-255) at ${o.width}px wide. Flags are warnings: soft under ${SOFT_BELOW}, dark under ${DARK_BELOW}.`);
    const pad = Math.min(40, Math.max(...results.map((r) => r.file.length)));
    for (const r of results) {
      if (r.error) console.log(`${r.file.padEnd(pad)}  could not be measured (${r.error})`);
      else console.log(`${r.file.padEnd(pad)}  sharpness ${String(r.sharpness).padStart(5)}  brightness ${String(r.brightness).padStart(3)}  ${r.width}x${r.height}${r.flags.length ? '  ' + r.flags.join(', ').toUpperCase() : ''}`);
    }
    const flagged = results.filter((r) => r.flags.length).length;
    console.log(flagged
      ? `${flagged} flagged. Open each at the size it will be shown: replace a soft or dark one, or keep it and say why (a plain sky or studio ground measures low; a night scene is dark on purpose).`
      : 'None flagged. Still open each at the size it will be shown: a number does not see a cut-off subject or a wrong place.');
  }
  return results.some((r) => !r.error) ? 0 : 2;
}

function fail(lines: string[], code: number): number {
  for (const l of lines) console.log(l);
  return code;
}

/** What a grade does, in a line, for credits.json and the report. */
export function gradeNote(look: Look, ink: string | null, paper: string | null): { look: Look; ink?: string; paper?: string } {
  if (look === 'warm' || look === 'cool') return { look };
  const d = DEFAULT_LOOK_COLOURS[look];
  return { look, ink: ink ?? d.ink, paper: paper ?? d.paper };
}

/** The ImageMagick arguments for one grade (the optional faster path). */
export function magickGradeArgs(input: string, output: string, g: { look: Look; ink?: string; paper?: string }): string[] {
  if (g.look === 'warm' || g.look === 'cool') {
    const m = g.look === 'warm' ? '1.05 0 0 0 1 0 0 0 0.92' : '0.94 0 0 0 1 0 0 0 1.05';
    return [input, '-modulate', '100,85,100', '-color-matrix', m, '-quality', '90', output];
  }
  const contrast = g.look === 'mono' ? '3x50%' : '2x50%';
  return [input, '-colorspace', 'Gray', '-sigmoidal-contrast', contrast, '-colorspace', 'sRGB', '(', '-size', '1x256', `gradient:${g.ink}-${g.paper}`, ')', '-clut', '-quality', '90', output];
}

// ---- palette: the page's colours sampled from its main picture ----------------------------------

export interface Oklch { l: number; c: number; h: number }
export interface Swatch { hex: string; oklch: Oklch; share: number }
export interface Role { hex: string; oklch: Oklch; css: string; from: string; contrast?: number; note?: string }
export interface PaletteResult { colours: Swatch[]; ground: Role; ink: Role; accent: Role | null; notes: string[] }

const toLinear = (v: number): number => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const fromLinear = (x: number): number => 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

/** sRGB 0-255 to OKLab. */
export function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s2 = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2];
}

/** OKLab to linear sRGB (unclamped). */
function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s2 = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2];
}

export const labToOklch = (L: number, a: number, b: number): Oklch => ({ l: L, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 });

/** OKLCH to a hex colour, lowering chroma until it is inside sRGB. */
export function oklchToHex(c: Oklch): string {
  for (let chroma = c.c; chroma >= 0; chroma -= 0.002) {
    const rad = (c.h * Math.PI) / 180;
    const lin = oklabToLinear(c.l, chroma * Math.cos(rad), chroma * Math.sin(rad));
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005) || chroma < 0.002) {
      return '#' + lin.map((v) => Math.max(0, Math.min(255, Math.round(fromLinear(Math.max(0, Math.min(1, v)))))).toString(16).padStart(2, '0')).join('');
    }
  }
  return '#000000';
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG 2 contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => { const [r, g, bl] = hexToRgb(hex).map(toLinear) as [number, number, number]; return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

export const oklchCss = (c: Oklch): string => `oklch(${(c.l * 100).toFixed(1)}% ${c.c.toFixed(3)} ${Math.round(c.h)})`;

/**
 * The dominant colours of a picture: k-means in OKLab over its pixels (r,g,b triples), seeded
 * deterministically by spreading the seeds across lightness, merging near twins, dropping specks.
 * Returns 5 to 8 colours, largest share first (fewer when the picture has fewer).
 */
export function dominantColours(pixels: readonly number[], k = 8): Swatch[] {
  const n = Math.floor(pixels.length / 3);
  if (!n) return [];
  const lab: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) lab.push(rgbToOklab(pixels[3 * i]!, pixels[3 * i + 1]!, pixels[3 * i + 2]!));
  // Seeds: points spread through the picture sorted by lightness, plus the most colourful pixel.
  const byL = [...lab].sort((p, q) => p[0] - q[0]);
  const seeds: Array<[number, number, number]> = [];
  for (let j = 0; j < k - 1; j++) seeds.push([...byL[Math.min(n - 1, Math.floor(((j + 0.5) * n) / (k - 1)))]!]);
  seeds.push([...lab.reduce((best, p) => (Math.hypot(p[1], p[2]) > Math.hypot(best[1], best[2]) ? p : best))]);
  let centres = seeds;
  let assign = new Int32Array(n);
  for (let iter = 0; iter < 12; iter++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      const p = lab[i]!;
      let best = 0, bd = Infinity;
      for (let j = 0; j < centres.length; j++) {
        const c = centres[j]!;
        // Chroma counts double, so a small bright accent is not swallowed by a big neutral.
        const d = (p[0] - c[0]) ** 2 + 2 * ((p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2);
        if (d < bd) { bd = d; best = j; }
      }
      assign[i] = best;
      const sm = sums[best]!;
      sm[0]! += p[0]; sm[1]! += p[1]; sm[2]! += p[2]; sm[3]! += 1;
    }
    centres = centres.map((c, j) => { const sm = sums[j]!; return sm[3]! ? [sm[0]! / sm[3]!, sm[1]! / sm[3]!, sm[2]! / sm[3]!] as [number, number, number] : c; });
  }
  const counts = centres.map(() => 0);
  for (let i = 0; i < n; i++) counts[assign[i]!]!++;
  let list = centres.map((c, j) => ({ lab: c, count: counts[j]! })).filter((x) => x.count > 0);
  // Merge colours closer than a just-visible step.
  list.sort((p, q) => q.count - p.count);
  const merged: typeof list = [];
  for (const x of list) {
    const twin = merged.find((m) => Math.hypot(m.lab[0] - x.lab[0], m.lab[1] - x.lab[1], m.lab[2] - x.lab[2]) < 0.035);
    if (twin) {
      const t = twin.count + x.count;
      twin.lab = [0, 1, 2].map((i) => (twin.lab[i]! * twin.count + x.lab[i]! * x.count) / t) as [number, number, number];
      twin.count = t;
    } else merged.push({ ...x });
  }
  list = merged.sort((p, q) => q.count - p.count);
  const kept = list.filter((x, i) => i < 5 || x.count / n >= 0.01).slice(0, 8);
  return kept.map((x) => {
    const o = labToOklch(x.lab[0], x.lab[1], x.lab[2]);
    return { hex: oklchToHex(o), oklch: { l: +o.l.toFixed(4), c: +o.c.toFixed(4), h: +o.h.toFixed(1) }, share: +(x.count / n).toFixed(4) };
  });
}

/**
 * Suggested roles from the dominant colours: a ground in the picture's own light (lightened or
 * darkened, chroma kept low), an ink in the hue of its shadows, and one accent from its most
 * colourful real area, its lightness moved until it reads on the ground (4.5:1 where it can).
 */
export function paletteRoles(colours: readonly Swatch[]): PaletteResult {
  const notes: string[] = [];
  const total = colours.reduce((t, c) => t + c.share, 0) || 1;
  const meanL = colours.reduce((t, c) => t + c.oklch.l * c.share, 0) / total;
  const light = meanL >= 0.45;
  const pct = (x: number): string => Math.round(x * 100) + '%';
  const make = (o: Oklch, from: string): Role => ({ hex: oklchToHex(o), oklch: { l: +o.l.toFixed(3), c: +o.c.toFixed(3), h: Math.round(o.h) }, css: oklchCss(o), from });
  const side = colours.filter((c) => (light ? c.oklch.l >= 0.6 : c.oklch.l <= 0.4));
  const base = (side.length ? side : [...colours]).sort((p, q) => q.share - p.share)[0]!;
  const gl = light ? Math.min(0.975, Math.max(0.93, base.oklch.l)) : Math.min(0.24, Math.max(0.15, base.oklch.l));
  const gc = Math.min(base.oklch.c, light ? 0.02 : 0.03);
  const moved = [Math.abs(gl - base.oklch.l) > 0.005 ? (gl > base.oklch.l ? 'lightened' : 'darkened') : '', gc < base.oklch.c - 0.001 ? 'chroma lowered' : ''].filter(Boolean);
  const ground = make({ l: gl, c: gc, h: base.oklch.h }, `the ${base.hex} that covers ${pct(base.share)}${moved.length ? ', ' + moved.join(', ') : ''}`);
  const far = colours.filter((c) => (light ? c.oklch.l <= 0.5 : c.oklch.l >= 0.7) && c.share >= 0.01);
  const tint = (far.length ? far : [base]).sort((p, q) => q.share - p.share)[0]!;
  const ink = make({ l: light ? 0.22 : 0.94, c: Math.min(tint.oklch.c, light ? 0.035 : 0.02), h: tint.oklch.h }, `${light ? 'the shadows' : 'the highlights'} (${tint.hex}), for the tint`);
  ink.contrast = contrastRatio(ink.hex, ground.hex);
  const candidates = colours.filter((c) => c.oklch.c >= 0.045 && c.share >= 0.005);
  let accent: Role | null = null;
  if (candidates.length) {
    const pick = [...candidates].sort((p, q) => q.oklch.c * Math.sqrt(q.share) - p.oklch.c * Math.sqrt(p.share))[0]!;
    let l = pick.oklch.l;
    const step = light ? -0.01 : 0.01;
    let hex = oklchToHex({ ...pick.oklch, l });
    while (contrastRatio(hex, ground.hex) < 4.5 && l > 0.25 && l < 0.92) { l += step; hex = oklchToHex({ ...pick.oklch, l }); }
    accent = make({ l, c: pick.oklch.c, h: pick.oklch.h }, `the ${pick.hex} that covers ${pct(pick.share)}${Math.abs(l - pick.oklch.l) > 0.005 ? `, ${light ? 'darkened' : 'lightened'} to read on the ground` : ''}`);
    accent.contrast = contrastRatio(accent.hex, ground.hex);
    const onWhite = contrastRatio(accent.hex, '#ffffff');
    const onInk = contrastRatio(accent.hex, ink.hex);
    accent.note = `as a button fill: ${onWhite >= onInk ? 'white' : 'ink'} text on it ${Math.max(onWhite, onInk)}:1`;
    if (accent.contrast < 4.5) notes.push(`The accent reaches only ${accent.contrast}:1 on the ground: use it for fills and marks, not for text.`);
  } else notes.push('The picture has no colourful area to take an accent from: take one from the direction\'s world line, or keep the page to ground and ink.');
  if (ink.contrast < 7) notes.push(`Ink on ground is ${ink.contrast}:1; body text wants at least 4.5:1, and more is calmer to read.`);
  return { colours: [...colours], ground, ink, accent, notes };
}

async function palette(o: Options): Promise<number> {
  const target = o.target ?? '';
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return fail(['Not a file: ' + path.resolve(target)], 1);
  const dir = path.dirname(target);
  const name = path.basename(target);
  let measured: { width: number; height: number; pixels: number[] };
  try {
    const lab = await openLab(dir, [name], null);
    try {
      measured = await lab.run<{ width: number; height: number; pixels: number[] }>(`window.__a.pixels(${JSON.stringify(name)}, 120)`);
    } finally {
      await lab.close();
    }
  } catch (err) {
    return fail(['Could not read the picture in the browser (' + (err instanceof Error ? err.message : String(err)) + '). Sample the ground, ink and accent by eye from the picture instead.'], 2);
  }
  const result = paletteRoles(dominantColours(measured.pixels));
  if (o.json) {
    console.log(JSON.stringify({ file: path.resolve(target), width: measured.width, height: measured.height, ...result }, null, 2));
    return 0;
  }
  console.log(`Palette of ${name} (${measured.width}x${measured.height}), largest share first:`);
  for (const c of result.colours) console.log(`  ${c.hex}  ${oklchCss(c.oklch).padEnd(24)} ${String(Math.round(c.share * 100)).padStart(3)}%`);
  console.log('Suggested roles (a start; judge them on the page beside the picture):');
  const row = (label: string, r: Role, extra: string): void => console.log(`  ${label.padEnd(7)}${r.hex}  ${r.css.padEnd(24)} from ${r.from}${extra}`);
  row('ground', result.ground, '');
  row('ink', result.ink, `; on the ground ${result.ink.contrast}:1`);
  if (result.accent) row('accent', result.accent, `; on the ground ${result.accent.contrast}:1; ${result.accent.note}`);
  for (const n of result.notes) console.log('Note: ' + n);
  console.log(`CSS: --c-ground: ${result.ground.css}; --c-ink: ${result.ink.css};${result.accent ? ` --c-accent: ${result.accent.css};` : ''} (hex fallbacks above; colour.md, C8)`);
  return 0;
}

async function grade(o: Options): Promise<number> {
  const dir = needDir(o.target, 'grade');
  if (typeof dir !== 'string') return fail(dir, 1);
  const look = o.look as Look;
  const files = listImages(dir);
  if (!files.length) return fail(['No photographs (JPEG, PNG or WebP) in ' + path.resolve(dir) + '.'], 2);
  const out = o.outGiven ? o.out : path.join(dir, look);
  if (path.resolve(out) === path.resolve(dir)) return fail(['--out must be another folder: grade never writes over the originals.'], 1);
  fs.mkdirSync(out, { recursive: true });
  const g = gradeNote(look, o.ink, o.paper);
  // A file already in --out is replaced only when an earlier grade made it.
  const previous = new Map(readCredits(out).map((c) => [str(c['file']), c]));
  const todo = files.filter((f) => !fs.existsSync(path.join(out, f)) || isObject(previous.get(f)?.['grade']));
  const skipped = files.filter((f) => !todo.includes(f));
  const magick = o.engine !== 'browser' ? findTool('magick') : null;
  if (o.engine === 'magick' && !magick) return fail(['--engine magick: ImageMagick (magick) is not installed here. Leave out --engine to grade in the browser.'], 2);
  const done: Array<{ file: string; bytes: number }> = [];
  const failed: Array<{ file: string; reason: string }> = [];
  let method = magick ? 'ImageMagick' : 'browser canvas';
  if (magick) {
    for (const f of todo) {
      const r = spawnSync(magick, magickGradeArgs(path.join(dir, f), path.join(out, f), g), { encoding: 'utf8' });
      if (r.status === 0) done.push({ file: f, bytes: fs.statSync(path.join(out, f)).size });
      else failed.push({ file: f, reason: (r.stderr || 'magick failed').trim().split('\n')[0] ?? 'magick failed' });
    }
  } else {
    try {
      const lab = await openLab(dir, todo, out);
      try {
        for (const f of todo) {
          try {
            const r = await lab.run<{ bytes: number }>(`window.__a.grade(${JSON.stringify(f)}, ${JSON.stringify(f)}, ${JSON.stringify(look)}, ${JSON.stringify(g.ink ?? '')}, ${JSON.stringify(g.paper ?? '')})`);
            done.push({ file: f, bytes: r.bytes });
          } catch (err) {
            failed.push({ file: f, reason: err instanceof Error ? err.message : String(err) });
          }
        }
      } finally {
        await lab.close();
      }
    } catch (err) {
      method = '';
      failed.push({ file: '*', reason: (err instanceof Error ? err.message : String(err)) + '. Install Chrome or ImageMagick, or grade in CSS (pictures.md)' });
    }
  }
  const source = new Map(readCredits(dir).map((c) => [str(c['file']), c]));
  const rel = path.relative(path.resolve(out), path.resolve(dir)).split(path.sep).join('/');
  if (done.length) {
    writeCredits(out, done.map((d) => ({ ...(source.get(d.file) ?? {}), file: d.file, grade: g, gradedFrom: (rel ? rel + '/' : '') + d.file })));
  }
  if (o.json) console.log(JSON.stringify({ look: g, method, out: path.resolve(out), graded: done, failed, kept: skipped }, null, 2));
  else {
    console.log(`Graded ${done.length} of ${files.length} as ${look}${g.ink ? ` (ink ${g.ink}, paper ${g.paper})` : ''} with the ${method || 'nothing'} into ${path.resolve(out)}; the originals are untouched.`);
    for (const f of failed) console.log('  Could not grade ' + f.file + ': ' + f.reason + '.');
    for (const f of skipped) console.log('  Kept ' + f + ': a file of that name in ' + out + ' was not made by grade.');
    if (done.length) console.log(`The grade is noted for each file in ${path.join(out, 'credits.json')}, with its credit. Look at them together: node photos.js sheet ${out}`);
  }
  return done.length ? 0 : 2;
}

/** Which tool can write AVIF here, if any: ImageMagick, avifenc, or sips on macOS. */
export function avifTool(): { name: 'magick' | 'avifenc' | 'sips'; path: string } | null {
  for (const name of ['magick', 'avifenc'] as const) {
    const p = findTool(name);
    if (p) return { name, path: p };
  }
  if (process.platform === 'darwin') {
    const p = findTool('sips');
    if (p) return { name: 'sips', path: p };
  }
  return null;
}

/** The ISO-BMFF boxes in buf from start to end: type, and where the body starts and ends. */
function bmffBoxes(buf: Buffer, start: number, end: number): Array<{ type: string; body: number; end: number }> {
  const list: Array<{ type: string; body: number; end: number }> = [];
  for (let o = start; o + 8 <= end; ) {
    let size = buf.readUInt32BE(o);
    const type = buf.toString('latin1', o + 4, o + 8);
    let body = o + 8;
    if (size === 1) {
      if (o + 16 > end) break;
      size = Number(buf.readBigUInt64BE(o + 8));
      body = o + 16;
    } else if (size === 0) size = end - o;
    if (size < body - o || o + size > end) break;
    list.push({ type, body, end: o + size });
    o += size;
  }
  return list;
}

/**
 * Why this AVIF would not show in Chrome, or null when its structure is sound: empty or truncated, no avif brand,
 * no meta/ispe/pixi/av1C/mdat, or an ICC profile for another colour model than the pixels have. The last is what
 * sips wrote from a greyscale or CMYK original: a GRAY or CMYK profile on a three-channel picture, which Chrome
 * refuses to decode, and a <picture> whose AVIF source fails shows nothing at all rather than falling back.
 */
export function avifProblem(buf: Buffer): string | null {
  if (buf.length < 32) return 'empty or truncated';
  const top = bmffBoxes(buf, 0, buf.length);
  const ftyp = top[0]?.type === 'ftyp' ? top[0] : undefined;
  if (!ftyp) return 'no ftyp box first';
  const brands: string[] = [];
  for (let o = ftyp.body; o + 4 <= ftyp.end; o += 4) if (o !== ftyp.body + 4) brands.push(buf.toString('latin1', o, o + 4));
  if (!brands.includes('avif')) return `not branded avif (${brands.join(', ')})`;
  const meta = top.find((b) => b.type === 'meta');
  if (!meta) return 'no meta box';
  const mdat = top.find((b) => b.type === 'mdat');
  if (!mdat || mdat.end <= mdat.body) return 'no image data (mdat)';
  const iprp = bmffBoxes(buf, meta.body + 4, meta.end).find((b) => b.type === 'iprp');
  const ipco = iprp ? bmffBoxes(buf, iprp.body, iprp.end).find((b) => b.type === 'ipco') : undefined;
  if (!ipco) return 'no item properties (iprp/ipco)';
  const props = bmffBoxes(buf, ipco.body, ipco.end);
  for (const need of ['ispe', 'av1C', 'pixi']) if (!props.some((b) => b.type === need)) return `no ${need} property`;
  const pixi = props.find((b) => b.type === 'pixi');
  const channels = pixi ? buf.readUInt8(pixi.body + 4) : 3;
  for (const colr of props.filter((b) => b.type === 'colr')) {
    if (buf.toString('latin1', colr.body, colr.body + 4) !== 'prof') continue;
    const space = buf.toString('latin1', colr.body + 4 + 16, colr.body + 4 + 20).trim();
    if (channels >= 3 && space !== 'RGB') return `a ${space} colour profile on a ${channels}-channel picture`;
    if (channels === 1 && space !== 'GRAY') return `a ${space} colour profile on a greyscale picture`;
  }
  return null;
}

// Every tool encodes from the JPEG the browser just made at this width: already resized, turned upright,
// and plain sRGB with three channels. Encoding from the original carried its colour profile across, and a
// greyscale or CMYK original became an AVIF that Chrome will not decode.
function makeAvif(tool: { name: 'magick' | 'avifenc' | 'sips'; path: string }, jpegAtWidth: string, out: string): boolean {
  const args = tool.name === 'magick' ? [jpegAtWidth, '-colorspace', 'sRGB', '-type', 'TrueColor', '-quality', '50', out]
    : tool.name === 'avifenc' ? ['-q', '55', '-s', '6', jpegAtWidth, out]
    : ['-s', 'format', 'avif', '-s', 'formatOptions', '50', jpegAtWidth, '--out', out];
  const r = spawnSync(tool.path, args, { stdio: 'ignore' });
  if (r.status !== 0 || !fs.existsSync(out)) return false;
  if (avifProblem(fs.readFileSync(out))) {
    fs.rmSync(out, { force: true });
    return false;
  }
  return true;
}

interface Variant { file: string; format: string; width: number; height: number; bytes: number }

/** Ready-to-paste markup for one delivered picture: AVIF, then WebP, then JPEG, with real sizes and the placeholder colour. */
export function pictureMarkup(prefix: string, variants: Variant[], colour: string, sizes: string, hero: boolean): string {
  const by = (fmt: string): Variant[] => variants.filter((v) => v.format === fmt).sort((a, b) => a.width - b.width);
  const set = (list: Variant[]): string => list.map((v) => `${prefix}${v.file} ${v.width}w`).join(', ');
  const jpg = by('jpg');
  const fallback = jpg.find((v) => v.width >= 1024) ?? jpg[jpg.length - 1];
  const biggest = jpg[jpg.length - 1] ?? variants[variants.length - 1];
  const lines = ['<picture>'];
  for (const [fmt, type] of [['avif', 'image/avif'], ['webp', 'image/webp']] as const) if (by(fmt).length) lines.push(`  <source type="${type}" srcset="${set(by(fmt))}" sizes="${sizes}">`);
  lines.push(`  <img src="${prefix}${fallback?.file ?? ''}" srcset="${set(jpg)}" sizes="${sizes}" width="${biggest?.width ?? ''}" height="${biggest?.height ?? ''}" alt=""` +
    (hero ? ' fetchpriority="high"' : ' loading="lazy"') + ` decoding="async" style="background-color:${colour}">`);
  lines.push('</picture>');
  return lines.join('\n');
}

/** Against the research's budgets: the widest width whose best file fits, and the first that does not. */
export function budgetLine(variants: Variant[], hero: boolean): string {
  const budget = hero ? BUDGETS.hero : BUDGETS.other;
  const best = new Map<number, Variant>();
  for (const v of variants) {
    const cur = best.get(v.width);
    if (!cur || v.bytes < cur.bytes) best.set(v.width, v);
  }
  const list = [...best.values()].sort((a, b) => a.width - b.width);
  const kb = (n: number): string => Math.round(n / 1024) + ' KB';
  const parts = list.map((v) => `${v.width}w ${kb(v.bytes)} ${v.format}`);
  const over = list.find((v) => v.bytes > budget);
  const label = (hero ? 'hero budget ' : 'budget ') + kb(budget);
  if (!over) return parts.join(', ') + ` - all within the ${label}`;
  const fits = list.filter((v) => v.bytes <= budget);
  return parts.join(', ') + ` - over the ${label} from ${over.width}w` + (fits.length ? `; serve at most ${fits[fits.length - 1]?.width}w at this size, or crop` : '; crop it smaller or choose a quieter picture');
}

async function deliver(o: Options): Promise<number> {
  const dir = needDir(o.target, 'deliver');
  if (typeof dir !== 'string') return fail(dir, 1);
  const files = listImages(dir);
  if (!files.length) return fail(['No photographs (JPEG, PNG or WebP) in ' + path.resolve(dir) + '.'], 2);
  if (o.hero && !files.includes(o.hero)) return fail(['--hero ' + o.hero + ' is not one of the photographs in ' + path.resolve(dir) + '.'], 1);
  const out = o.outGiven ? o.out : path.join(dir, 'web');
  if (path.resolve(out) === path.resolve(dir)) return fail(['--out must be another folder, so the originals are kept apart from the copies for the page.'], 1);
  fs.mkdirSync(out, { recursive: true });
  // A picture renamed since its credit was written finds it again by its bytes; the id is kept.
  const moved = reconcileCredits(dir, files);
  const results: Array<{ file: string; width: number; height: number; colour: string; variants: Variant[]; error?: string }> = [];
  let avifNote = '';
  let avifDropped = 0;
  try {
    const lab = await openLab(dir, files, out);
    try {
      const browserAvif = await lab.run<boolean>('window.__a.canAvif()');
      const tool = browserAvif ? null : avifTool();
      avifNote = browserAvif ? 'AVIF from the browser' : tool ? `AVIF made with ${tool.name}` : 'no AVIF: this browser cannot encode it and no ImageMagick, avifenc or sips was found; WebP and JPEG only';
      for (const f of files) {
        const stem = slug(f.replace(/\.[a-z0-9]+$/i, ''), 60);
        try {
          const r = await lab.run<{ width: number; height: number; colour: string; variants: Variant[] }>(`window.__a.variants(${JSON.stringify(f)}, ${JSON.stringify(stem)}, ${JSON.stringify(o.widths)}, ${browserAvif}, ${o.maxKb ? o.maxKb * 1024 : 0})`);
          if (tool) {
            for (const v of r.variants.filter((x) => x.format === 'jpg')) {
              const file = `${stem}-${v.width}.avif`;
              if (makeAvif(tool, path.join(out, v.file), path.join(out, file))) {
                const bytes = fs.statSync(path.join(out, file)).size;
                if (o.maxKb && bytes > o.maxKb * 1024) fs.rmSync(path.join(out, file), { force: true });
                else r.variants.push({ file, format: 'avif', width: v.width, height: v.height, bytes });
              }
            }
          }
          // Keep an AVIF only if it is sound and this browser decodes it: a broken AVIF source makes the whole <picture> blank.
          for (const v of r.variants.filter((x) => x.format === 'avif')) {
            const where = path.join(out, v.file);
            const sound = fs.existsSync(where) && !avifProblem(fs.readFileSync(where)) && await lab.run<boolean>(`window.__a.decodes(${JSON.stringify(v.file)}, ${v.width}, ${v.height})`, 30000).catch(() => false);
            if (!sound) {
              fs.rmSync(where, { force: true });
              r.variants = r.variants.filter((x) => x !== v);
              avifDropped++;
            }
          }
          results.push({ file: f, ...r });
        } catch (err) {
          results.push({ file: f, width: 0, height: 0, colour: '', variants: [], error: err instanceof Error ? err.message : String(err) });
        }
      }
      if (avifDropped) avifNote += ` (${avifDropped} AVIF file${avifDropped === 1 ? '' : 's'} left out because the browser could not decode ${avifDropped === 1 ? 'it' : 'them'}; WebP and JPEG serve ${avifDropped === 1 ? 'that width' : 'those widths'})`;
    } finally {
      await lab.close();
    }
  } catch (err) {
    return fail(['Could not open the browser to resize the pictures (' + (err instanceof Error ? err.message : String(err)) + ').',
      'Without one, resize by hand: sips -Z 1600 in.jpg --out out.jpg (macOS), cwebp -q 75 -resize 1600 0 in.jpg -o out.webp, or magick in.jpg -resize 1600x -quality 50 out.avif.'], 2);
  }
  // Record each picture's colour and size in the folder's credits.json, keeping everything else in its entry.
  const credits = new Map(readCredits(dir).map((c) => [str(c['file']), c]));
  const relOut = path.relative(path.resolve(dir), path.resolve(out)).split(path.sep).join('/');
  const updated = results.filter((r) => !r.error).map((r) => ({ ...(credits.get(r.file) ?? { file: r.file }), file: r.file, width: r.width, height: r.height, colour: r.colour, variants: r.variants.map((v) => (relOut ? relOut + '/' : '') + v.file) }));
  if (updated.length) writeCredits(dir, updated);
  const prefix = path.relative(process.cwd(), path.resolve(out)).split(path.sep).join('/') + '/';
  if (o.json) {
    console.log(JSON.stringify({ out: path.resolve(out), avif: avifNote, renamed: moved.renamed, missingFiles: moved.missing, images: results.map((r) => ({ ...r, hero: r.file === o.hero, budget: r.variants.length ? budgetLine(r.variants, r.file === o.hero) : null, markup: r.variants.length ? pictureMarkup(prefix, r.variants, r.colour, o.sizes, r.file === o.hero) : null })) }, null, 2));
  } else {
    console.log(`Delivered ${updated.length} of ${files.length} into ${path.resolve(out)} at ${o.widths.join(', ')}px wide (never wider than the original); ${avifNote}.`);
    console.log(`Colour and size recorded in ${path.join(dir, 'credits.json')}. Budgets: ${o.maxKb ? `every file under ${o.maxKb} KB (--max-kb)` : `hero ${BUDGETS.hero / 1024} KB, others ${BUDGETS.other / 1024} KB`}.`);
    for (const [from, to] of moved.renamed) console.log(`Credit for ${from} kept: the file is now ${to} (matched by its bytes).`);
    for (const m of moved.missing) console.log(`Credit for ${m} has no file in the folder (renamed and edited, or removed): fix its "file" in credits.json or remove the entry.`);
    for (const r of results) {
      console.log('');
      if (r.error) {
        console.log(`${r.file}: could not be delivered (${r.error}).`);
        continue;
      }
      const hero = r.file === o.hero;
      console.log(`${r.file}${hero ? ' (hero)' : ''}  ${r.width}x${r.height}  ${r.colour}  ${budgetLine(r.variants, hero)}`);
      if (!credits.has(r.file)) console.log('  No credit recorded for this file (fine for the owner\'s own photograph; a found one needs its source and licence in credits.json).');
      console.log(pictureMarkup(prefix, r.variants, r.colour, o.sizes, hero));
    }
    if (!o.hero && results.length) console.log('\nThe first picture on the page gets fetchpriority="high" and no loading="lazy"; run again with --hero <file> to have that written for you.');
    console.log('Set sizes to the width each picture really takes in the layout (--sizes "(min-width: 64rem) 50vw, 100vw"), and write the alt text.');
  }
  return updated.length ? 0 : 2;
}

async function cutout(o: Options): Promise<number> {
  const file = o.target;
  if (!file) return fail(['cutout needs a photograph.'], 1);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || !IMAGE_FILE.test(file)) return fail(['Not a JPEG, PNG or WebP file: ' + path.resolve(file)], 1);
  const out = o.outGiven ? o.out : file.replace(/\.[a-z0-9]+$/i, '') + '-cutout.png';
  if (path.resolve(out) === path.resolve(file)) return fail(['--out must be a new file: cutout never writes over the original.'], 1);
  const rembg = o.method !== 'canvas' ? findTool('rembg') : null;
  if (o.method === 'rembg' && !rembg) return fail(['--method rembg: rembg is not installed. Install it with pip install "rembg[cpu,cli]", or leave out --method for the canvas cut.'], 2);
  if (rembg) {
    // Never the default model, whose weights may not allow commercial use.
    const r = spawnSync(rembg, ['i', '-m', 'birefnet-general', file, out], { encoding: 'utf8' });
    if (r.status === 0 && fs.existsSync(out)) {
      if (o.json) console.log(JSON.stringify({ out: path.resolve(out), method: 'rembg birefnet-general' }, null, 2));
      else console.log(`Cut out with rembg (model birefnet-general) into ${path.resolve(out)}. Look at the edge against the page's own ground before using it.`);
      return 0;
    }
    if (o.method === 'rembg') return fail(['rembg failed: ' + ((r.stderr || '').trim().split('\n').pop() ?? 'no message')], 2);
    console.log('rembg failed (' + ((r.stderr || '').trim().split('\n').pop() ?? 'no message') + '); using the canvas cut instead.');
  }
  const dir = path.dirname(path.resolve(file));
  const name = path.basename(file);
  try {
    const lab = await openLab(dir, [name], path.dirname(path.resolve(out)));
    try {
      const r = await lab.run<{ width: number; height: number; removed: number; background: string; spread: number }>(
        `window.__a.cutout(${JSON.stringify(name)}, ${JSON.stringify(path.basename(out))}, ${o.tolerance}, ${o.feather})`);
      const plain = r.spread <= 24;
      if (o.json) console.log(JSON.stringify({ out: path.resolve(out), method: 'canvas flood fill', background: r.background, removed: Math.round(r.removed * 1000) / 10, cornersAgree: plain, tolerance: o.tolerance, feather: o.feather }, null, 2));
      else {
        console.log(`Cut out with the canvas flood fill (no rembg here) into ${path.resolve(out)}: removed ${Math.round(r.removed * 100)}% of the picture, the background colour ${r.background} reached from the edges, within --tolerance ${o.tolerance}, edge feathered ${o.feather}px.`);
        console.log(plain ? 'The corners agree, so the background looks plain. Check the edge, and any enclosed background (inside a handle or loop), which this method keeps.'
          : 'The corners do not agree, so the background is not plain: this method suits studio shots on one colour only.');
        console.log('For a photograph with a real background, install rembg (pip install "rembg[cpu,cli]") and run cutout again: it will use the birefnet-general model.');
        if (r.removed < 0.05) console.log('Almost nothing was removed: raise --tolerance, or the background touches no edge.');
      }
      return 0;
    } finally {
      await lab.close();
    }
  } catch (err) {
    return fail(['Could not cut out the picture (' + (err instanceof Error ? err.message : String(err)) + '). Install rembg (pip install "rembg[cpu,cli]") or a Chrome-family browser.'], 2);
  }
}

// ---- help -----------------------------------------------------------------------------------

export const USAGES: Record<Command, string[]> = {
  search: [
    'Usage: node photos.js "<search words>" [--count N] [--out DIR] [--orientation landscape|portrait|square]',
    '                      [--min-width N] [--best] [--source LIST] [--creator NAME] [--page N] [--json]',
    '       node photos.js search "<search words>" ...   (the same)',
    '',
    'Searches for free-licence photographs (CC0, public domain, CC BY, CC BY-SA), downloads up to N',
    'candidates (default 8, at most 20) into DIR (default ./photos-candidates) and writes credits.json.',
    'By default it asks Openverse for large photographs (category=photograph, size=large; when that',
    'gives too few it reads further pages, then widens to large images of any kind) and Wikimedia',
    'Commons. Openverse links only a 960px preview of StockSnap pictures; those are listed with their',
    'page, to download by hand, rather than saved.',
    '',
    '  --source LIST   which sources: openverse, wikimedia, pexels, pixabay, europeana, cleveland, met,',
    '                  nasa, smithsonian, or Openverse providers (stocksnap, rawpixel, nappy, wordpress,',
    '                  flickr...). Example: --source stocksnap,rawpixel,nappy,wikimedia. The archives',
    '                  are asked only when named.',
    '  --creator NAME  one photographer on Openverse (search words may then be left out)',
    '  --page N        start from page N of the results (1 to 12)',
    '  --min-width N   leave out pictures narrower than N pixels',
    '  --best          Commons: quality and featured pictures first (incategory:Quality_images or',
    '                  Featured pictures), then the rest, largest first. Pixabay: editors\' choice only.',
    '',
    'With PEXELS_API_KEY or PIXABAY_API_KEY set it also searches Pexels or Pixabay. A key is sent only',
    'to its own service and never printed. The summary line says how many came from each source and',
    'how many each filter left out. Look at every picture before using any of them.',
  ],
  add: [
    'Usage: node photos.js add <photo-page-url> [more urls] [--out DIR] [--width N] [--json]',
    '',
    'Takes photographs you chose on unsplash.com or pexels.com: for each photo PAGE address it makes',
    'one request for the page, reads its public metadata (photographer, page and image address),',
    'downloads the image at --width pixels wide (default 2000, 200 to 6000) into DIR and adds it to',
    'credits.json under the Unsplash Licence or the Pexels Licence. Unsplash+ photographs are refused.',
    'A page that refuses (Pexels often asks for a browser check) is reported in one line. With',
    'PEXELS_API_KEY set, Pexels photos are read from the Pexels API instead of the page, as its',
    'terms ask. Use add only for photographs you picked by hand; check each site\'s terms.',
  ],
  series: [
    'Usage: node photos.js series <url> [--limit N] [--width N] --out DIR [--json]',
    '       node photos.js series --creator "<name>" [--source PROVIDER] [--limit N] --out DIR',
    '',
    'Downloads one photographer\'s photographs, so a page can use one shoot. <url> is one of:',
    '  https://unsplash.com/@user or an Unsplash photo page: reads the public profile page (about 20',
    '    photographs) and each photo page, one request at a time with a pause between; refuses',
    '    Unsplash+ pictures and promoted or sponsored listings, and any picture by someone else.',
    '  a Pexels photo page or collection page: with PEXELS_API_KEY, from the Pexels API (a photo',
    '    page finds more by the same photographer among results for its own words); without the',
    '    key, the public page, which Pexels usually puts behind a check for automated visitors.',
  '  an openverse.org image page: that picture\'s creator on the same provider.',
    '--creator "<name>" asks Openverse for that creator directly. --limit N: how many (default 12, at',
    'most 30). Credits are written exactly as search writes them.',
  ],
  sharp: [
    'Usage: node photos.js sharp <file|dir|video> [--width N] [--json]',
    '',
    'A video file is measured by its frame at one second; a poster frame (photos.js poster) is a',
    'photograph like any other.',
    'Measures each photograph as it will be shown: scaled to --width pixels wide (default 1024; pass the',
    'width it takes on the page), it reports the sharpness of its sharpest area (variance of the Laplacian',
    'on a greyscale copy, over a 4x4 grid, so a sharp subject on a soft background passes) and its mean',
    'brightness (0-255), and flags likely soft (under ' + SOFT_BELOW + ') and likely dark (under ' + DARK_BELOW + '). Flags are warnings',
    'to look again, not a verdict: a plain subject measures low and a low-key photograph is dark on',
    'purpose. Renders in the headless browser shot.js uses; local files only.',
  ],
  palette: [
    'Usage: node photos.js palette <file> [--json]',
    '',
    'Reads the picture (scaled to 120px on its long side, in the headless browser shot.js uses) and',
    'prints its 5 to 8 dominant colours, as hex and OKLCH with the share of the picture each covers,',
    'then suggested roles: a ground in the picture\'s own light (lightened or darkened, chroma kept low),',
    'an ink tinted with its shadows, and one accent from its most colourful area, darkened or',
    'lightened until it reads on the ground, each with its contrast ratio. A start to judge by eye,',
    'never a verdict: run it on the main picture and check the roles beside it (colour.md, C2).',
  ],
  sheet: [
    'Usage: node photos.js sheet <dir> [--out sheet.jpg] [--columns N] [--json]',
    '',
    'Makes a contact sheet of every photograph in the folder, with its file name, pixel size and',
    'author (from credits.json) under each, so twenty candidates can be judged in one look. Renders',
    'in the headless browser shot.js uses; also writes the same sheet as a page (sheet.html) that',
    'opens in any browser, which is all you get when no browser can be started. --columns 2 to 8',
    '(default 4).',
  ],
  grade: [
    'Usage: node photos.js grade <dir> --look mono|duotone|warm|cool [--ink #hex --paper #hex] [--out DIR] [--json]',
    '',
    'Applies one grade to every photograph in the folder so mixed stock reads as one shoot, writing',
    'new files into --out (default <dir>/<look>) and noting the grade, with each credit, in that',
    'folder\'s credits.json. The originals are never overwritten.',
    '  mono      grey with a gentle S-curve, mapped from --ink to --paper (default a warm near-black',
    '            to an off-white): one colour story across the set, colour kept in type and grounds',
    '  duotone   the same ramp with stronger colours (defaults #1f2a44 to #f1e6d2)',
    '  warm/cool saturation down to 85% and a slight warm or cool cast',
    'Uses ImageMagick when magick is installed (--engine magick|browser to choose), else the browser.',
    'Never grade photographs of the product being sold.',
  ],
  deliver: [
    'Usage: node photos.js deliver <dir> [--widths 640,1024,1600,2400] [--sizes "100vw"] [--hero FILE] [--max-kb N] [--out DIR] [--json]',
    '',
    'Writes resized copies for the page into --out (default <dir>/web): WebP and JPEG from the browser\'s',
    'canvas, and AVIF when the browser or an installed tool (ImageMagick, avifenc, or sips on macOS) can',
    'make one the browser then decodes, else skipped with a note. Never wider than the original. Records each picture\'s dominant',
    'colour and size in credits.json, prints ready-to-paste <picture> markup (srcset, sizes, width and',
    'height, the colour as a placeholder background) and each picture\'s bytes against the budgets:',
    'hero 250 KB, others 120 KB. --hero FILE marks the first-screen picture (fetchpriority="high").',
    'The folder needs no credits.json: deliver starts one if there is none, and names each picture that',
    'has no credit yet (the owner\'s own photographs need none; found ones need their source and licence).',
    'Credits are kept by a stable id (source and photo page) and the picture\'s hash: rename a file and',
    'deliver finds its credit again and writes the new name. --max-kb N (10 to 5000): every file written',
    'is re-encoded at lower quality, then drawn smaller, until it is under N kB.',
  ],
  cutout: [
    'Usage: node photos.js cutout <file> [--out file.png] [--tolerance N] [--feather N] [--method auto|rembg|canvas] [--json]',
    '',
    'Removes the background. With rembg installed it runs rembg i -m birefnet-general (never the',
    'default model, whose weights may not allow commercial use). Otherwise it cuts in the browser:',
    'a flood fill from the edges over colours within --tolerance (1 to 60, default 12) of the corners,',
    'with the edge feathered --feather pixels (default 2). That suits a product on a plain studio',
    'background only; a real background needs rembg (pip install "rembg[cpu,cli]"). It says which',
    'method it used. Output: a PNG, by default <file>-cutout.png beside the original.',
  ],
};

function usage(command: Command = 'search', all = command === 'search'): void {
  const lines = [...USAGES[command]];
  if (all) {
    lines.push('', 'Other commands (each takes --help):',
      '  node photos.js add <photo-page-url>...                take photographs chosen on Unsplash or Pexels',
      '  node photos.js series <profile-or-photo-url> --out D   one photographer\'s set',
      '  node photos.js sheet <dir>                             a contact sheet of a folder',
      '  node photos.js sharp <file|dir> [--width N]            flag likely soft or dark photographs',
      '  node photos.js palette <file>                          5-8 dominant colours; ground, ink and accent from them',
      '  node photos.js grade <dir> --look mono|duotone|warm|cool   one grade for the whole set',
      '  node photos.js deliver <dir>                           AVIF/WebP/JPEG at page widths, with <picture> markup',
      '  node photos.js cutout <file>                           remove a plain background',
      '  node photos.js video "<words>"                         free-licence stock video for an opening (video --help)',
      '  node photos.js video get <clip-page-url>               download one clip with its credit',
      '  node photos.js poster <video> [--at S]                 a poster frame as a JPEG',
      '  node photos.js loop <video> --seconds N                web renditions with ffmpeg: 1080 MP4 and WebM, 720 MP4',
      '',
      'search, add, series, video and video get are the only Argus tools that use the network, and only when you run them.');
  }
  console.log(lines.join('\n'));
}

export async function main(argv: string[]): Promise<number> {
  // The video commands live in video.ts (loaded only when used): video, video get, poster, loop.
  if (['video', 'poster', 'loop'].includes(argv[0] ?? '')) return (require('./video') as typeof import('./video')).main(argv);
  const o = parseArgs(argv);
  // add with clip pages (Mixkit, Commons, Pexels or Pixabay videos) is video get.
  if (o.command === 'add' && o.add?.length && !o.help) {
    const v = require('./video') as typeof import('./video');
    if (o.add.every((u) => { const p = v.videoPageOf(u); return !!p && p.kind !== 'file'; })) {
      let code = 0;
      for (const u of o.add) code = Math.max(code, await v.main(['video', 'get', u, ...(o.outGiven ? ['--out', o.out] : []), ...(o.json ? ['--json'] : [])]));
      return code;
    }
  }
  if (o.help) {
    usage(o.command);
    return 0;
  }
  const missing =
    o.command === 'search' ? !o.query && !o.creator
    : o.command === 'add' ? !o.add?.length
    : o.command === 'series' ? !o.target && !o.creator
    : !o.target;
  if (o.bad.length || missing) {
    if (o.bad.length) console.log('Not understood: ' + o.bad.join(' ') + '\n');
    else if (o.command === 'add') console.log('add needs at least one photo page address.\n');
    else if (o.command === 'series') console.log('series needs an address or --creator "<name>".\n');
    else if (o.command !== 'search') console.log(o.command + ' needs a ' + (o.command === 'cutout' || o.command === 'palette' ? 'file' : o.command === 'sharp' ? 'file or folder' : 'folder') + '.\n');
    usage(o.command);
    return 1;
  }
  if (typeof fetch !== 'function') {
    console.log('This needs Node 22 or later (you have ' + process.version + ').');
    return 2;
  }
  if (o.command === 'add') return addPhotos(o);
  if (o.command === 'series') return series(o);
  if (o.command === 'sheet') return sheet(o);
  if (o.command === 'sharp') return sharp(o);
  if (o.command === 'palette') return palette(o);
  if (o.command === 'grade') return grade(o);
  if (o.command === 'deliver') return deliver(o);
  if (o.command === 'cutout') return cutout(o);
  return searchPhotos(o);
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.log('Unexpected error: ' + hideKeys(err instanceof Error ? err.message : String(err)));
      process.exit(2);
    },
  );
}
