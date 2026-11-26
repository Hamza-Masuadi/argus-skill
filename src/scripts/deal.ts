#!/usr/bin/env node
/*
 * Argus dealer. No dependencies, no network.
 *
 * Deals design directions from the skill's data files (assets/data/fonts.json,
 * heroes.json, sections.json). By default the three directions differ in kind:
 * one minimal, one picture-led, one expressive. Each is dealt a hero composition
 * and its structure class, a type pairing, a ground, a shape and candidate
 * sections; no two directions share a hero, a structure class, a face or a ground
 * family while choices remain. Motion is not dealt: the builder chooses it from
 * motion.md and the snippet gallery for the page's one or two moments.
 *
 * The owner's words come first: --no, --taste, --tone and --trade are filters.
 * Two habits are never dealt unless asked: a side-by-side first screen (text beside a
 * picture, device or drawing; --allow side-by-side, or --needs form-in-hero) and a
 * monospace face (--allow mono, or --needs code for code or technical data on the page).
 * The project's history (.argus/history.json) is only a soft, decaying preference
 * for variety. A cross-project history is read and written only when enabled
 * (--global-history, or ARGUS_GLOBAL_HISTORY). Deterministic for a given --seed
 * and histories; without a seed it seeds from the clock and prints the seed.
 *
 *   node deal.js directions --n 3 --tone calm --trade bakery [--history .argus/history.json]
 *   node deal.js directions --keep <ids> --n 2 ...   re-deal the others away from a kept direction
 *   node deal.js list <fonts|pairings|heroes|sections|nav|footers|grounds|shapes> [--tag X]
 *   node deal.js show <id>
 *   node deal.js record --history .argus/history.json <ids...>
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ---- data shapes ---------------------------------------------------------------

export interface Face {
  id: string;
  name: string;
  source: string;
  licence: string;
  load: { css?: string; variable?: string; files?: string };
  classification: string;
  axes?: Record<string, [number, number]>;
  roles: string[];
  character: string;
  suits: string[];
  lettering: string[];
  era: string;
  weightExtremes: { light: number; heavy: number };
  overused: boolean;
  /** The licence forbids redistributing the files: referenced by name and official URL only, dealt only with --self-host. */
  selfHostOnly?: boolean;
}
export interface Pairing {
  id: string;
  display: string;
  text: string;
  accent?: string;
  why: string;
  suits: string[];
  setting: { displayWeight: number; displayStretch?: string; displayTracking: string; displayLeading: number; bodySize: number; labelTracking: string };
}
export interface Hero {
  id: string;
  name: string;
  family: string;
  /** The shape of the first screen (side-by-side, full-bleed, type-first...): directions never share one. */
  structure?: string;
  modes: string[];
  reach: string;
  layout: string;
  arrival: string;
  pointer: string;
  firstScroll: string;
  build: string;
  needs: string[];
  suits: string[];
  fails: string;
  pictureFree: boolean;
  examples: string[];
  /** The direction kinds this composition suits. */
  kinds?: string[];
  /** Kinds of business it fails for: never dealt to them. */
  avoid?: string[];
  /** Draws attention to itself: never dealt with --tone calm. */
  loud?: boolean;
}
export interface Section {
  id: string;
  name: string;
  family: string;
  /** The shape of the section (ruled-list, sticky-steps, gallery...). */
  structure?: string;
  layout: string;
  generic: string;
  designed: string;
  fits: string[];
  density: string;
  phone: string;
  /** Kinds of business it is wrong for: never dealt to them. */
  avoid?: string[];
  /** Never dealt with --tone calm. */
  loud?: boolean;
}
export interface Pattern {
  id: string;
  name: string;
  /** Navigation only: main (the header), phone (goes with any main one) or addition (an extra bar). */
  role?: string;
  layout: string;
  fits: string[];
  phone?: string;
}
export interface Choice {
  id: string;
  name: string;
  does: string;
  /** Grounds only: light, mid, dark or colour. Directions are dealt different families while they can be. */
  family?: 'light' | 'mid' | 'dark' | 'colour';
  /** Never dealt with --tone calm. */
  loud?: boolean;
}

export interface Library {
  faces: Face[];
  pairings: Pairing[];
  heroes: Hero[];
  heroRules: Record<string, unknown>;
  sections: Section[];
  nav: Pattern[];
  footers: Pattern[];
  notes: string[];
}

/** Shape systems. One per direction. */
export const SHAPES: readonly Choice[] = [
  { id: 'square', name: 'Square throughout', does: 'Every radius 0: surfaces, controls, pictures and inputs. Lines carry the structure. --radius-control:0; --radius-surface:0.' },
  { id: 'square-pill', name: 'Square surfaces, pill controls', does: 'Surfaces and pictures square, buttons and chips fully round (999px). --radius-control:999px; --radius-surface:0.' },
  { id: 'softened', name: 'Softened 2-4px throughout', does: 'One small radius on everything, for example 3px; no second value. --radius-control:3px; --radius-surface:3px.' },
  { id: 'rounded', name: 'Rounded', does: 'One friendly radius of about 8-16px on surfaces and pictures, controls matching it or fully round; a soft card with one quiet shadow is fine here. --radius-control:10px; --radius-surface:14px.' },
  { id: 'subject-frame', name: 'Subject-derived frame', does: 'A square or 2px base plus one frame taken from the subject (an arch, a bottle, a ticket notch, a clip-path from the mark), used on the hero picture and repeated once. At most three radius values.' },
];

/** Ground strategies. One per direction. */
export const GROUNDS: readonly Choice[] = [
  { id: 'plain-white', family: 'light', name: 'White or a neutral near-white', does: 'A plain white or neutral near-white ground; the photographs, the type and one accent carry the colour. Separate sections with space, a rule or a picture.' },
  { id: 'tinted-near-white', family: 'light', name: 'Near-white tinted from the subject', does: 'A light ground with chroma .008-.02 in the subject\'s hue, or sampled from the white of the main photograph, so picture and page share one plane.' },
  { id: 'pale-tint', family: 'light', name: 'A pale tint from the subject', does: 'A pale, muted tint taken from a named thing in the subject (a wall, linen, stone), never a bright pastel; body text checked at 4.5:1 on it.' },
  { id: 'mid-tone', family: 'mid', name: 'A mid-value ground from the subject', does: 'A ground of middle lightness (oklch about 55-72% L, chroma .01-.05) taken from a named material in the subject (stone, concrete, slate, sage, steel), with near-black or white text checked at 4.5:1; lighter and darker bands of the same hue separate sections.' },
  { id: 'ink-ground', family: 'dark', name: 'Ink ground', does: 'The page sits on a tinted near-black (oklch about 18-22% L, chroma .01-.02 in the subject\'s hue); the accent is lifted for the dark ground (oklch(from var(--accent) calc(l + .15) c h)); color-scheme: dark. Say why dark fits: dark photographs, or the thing is used at night or in the dark.' },
  { id: 'committed-colour', family: 'colour', name: 'A committed colour ground', does: 'One deep or muted colour taken from a named object in the subject covers the ground of the first screen and returns in one later band; ink and one light tone do the rest. Check text contrast on it.' },
  { id: 'two-colour-split', family: 'colour', loud: true, name: 'Two-colour split', does: 'Two flat hues from the subject meet at a seam (vertical or diagonal) in the hero and return in a later band; the picture or headline crosses the seam, every word still readable.' },
];

const TONE_CLASS: Record<string, Record<string, number>> = {
  bold: { condensed: 2, wide: 2, 'quirky-display': 2, 'warm-grotesque': 1, 'display-serif': 1, 'neutral-grotesque': 1 },
  calm: { 'contemporary-serif': 1, 'old-style-serif': 1, 'humanist-sans': 1.5, 'neutral-grotesque': 1.5, geometric: 1, slab: 0.5 },
  lively: { 'warm-grotesque': 2, geometric: 2, rounded: 2, 'quirky-display': 1, wide: 1, 'humanist-sans': 1 },
};
const TONE_GROUND: Record<string, Record<string, number>> = {
  calm: { 'tinted-near-white': 1, 'plain-white': 1, 'pale-tint': 1, 'mid-tone': 1, 'committed-colour': 0.5 },
  lively: { 'committed-colour': 1, 'two-colour-split': 1, 'pale-tint': 1 },
  bold: { 'committed-colour': 2, 'two-colour-split': 2, 'ink-ground': 1 },
};
/** Display classes that count as serif, for the rule that at most one direction pairs a light ground with a serif display. */
export const SERIF_CLASSES = ['contemporary-serif', 'old-style-serif', 'display-serif', 'slab'];
/** A pairing that shouts: never dealt with --tone calm. */
export const loudPairing = (p: Pairing, display: Face): boolean => ['condensed', 'wide', 'quirky-display'].includes(display.classification) || p.setting.displayWeight >= 800;

/** The kinds of direction. A default set of three has one of each, so the owner sees three different kinds of page. */
export const KINDS = ['minimal', 'picture-led', 'expressive'] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_SAYS: Record<Kind, string> = {
  minimal: 'few elements, one accent, little motion; the room it leaves is filled by one strong thing',
  'picture-led': 'one or more excellent photographs carry the page; type steps back',
  expressive: 'a bolder idea from the subject: type-led, illustrated or interactive',
};
/**
 * The grounds each kind is dealt from, before the owner's taste filters them. The minimal kind
 * first draws a family (light, mid, dark or colour) at random, so it is not always a pale page.
 */
export const KIND_GROUNDS: Record<Kind, readonly string[]> = {
  minimal: ['plain-white', 'tinted-near-white', 'pale-tint', 'mid-tone', 'ink-ground', 'committed-colour'],
  'picture-led': ['plain-white', 'tinted-near-white', 'ink-ground', 'committed-colour'],
  expressive: ['committed-colour', 'two-colour-split', 'ink-ground', 'pale-tint', 'tinted-near-white'],
};
const KIND_SHAPE: Record<Kind, Record<string, number>> = {
  minimal: { softened: 1.5, rounded: 1.5, square: 1 },
  'picture-led': { square: 1, softened: 1, rounded: 0.5 },
  expressive: { 'subject-frame': 1, 'square-pill': 1, square: 0.5 },
};
/** The restrained type setting printed for minimal and picture-led directions instead of the pairing's display extremes. */
export const RESTRAINED_SETTING = 'at the face\'s regular to semibold, about 2.5-4 times the body, tracking near 0, leading 1.05-1.15';
/** Builds back in history that the dealer leans away from. Grounds and shapes have few choices each, so only the last build counts for them. */
export const HISTORY_WINDOW = 5;
const SMALL_WINDOW = 1;
/** How much a recent use lowers an item's score: a preference for variety, never a ban. */
export const HISTORY_PENALTY = 1.5;
/** Each build further back counts this much less: the last build 1, the one before .6, then .36... */
export const HISTORY_DECAY = 0.6;
/** Repeated recent use adds up, to at most this many times the penalty. */
export const HISTORY_CAP = 1.8;
/** Most directions one deal makes. */
export const MAX_DIRECTIONS = 6;

/** Needs every hero may use whatever --needs says: type and things drawn in the page. */
const FREE_NEEDS = ['type-only', 'live-data', 'map'];

/**
 * Trades where being there is the offer: a full-bleed photograph or a muted loop can carry the
 * first screen (heroes.md, "Full-bleed openings"; pictures.md, "Video"). The picture-led direction
 * leans to a full-bleed opening for these, and a video hero may be dealt without being asked for.
 */
export const BEING_THERE = ['hotel', 'hospitality', 'travel', 'tour', 'place', 'resort', 'restaurant', 'food', 'cafe', 'bar', 'pub', 'wine', 'brewery', 'outdoor',
  'kayak', 'surf', 'surfing', 'ski', 'skiing', 'climb', 'climbing', 'hike', 'hiking', 'sail', 'sailing', 'dive', 'diving', 'camp', 'camping', 'fitness', 'gym', 'yoga', 'spa', 'fashion', 'event', 'festival', 'venue', 'wedding', 'music', 'adventure', 'retreat', 'cabin', 'boat'];
/** Software and services where footage adds nothing: never dealt a video hero unless --picture video or --needs video asks. */
export const NO_FOOTAGE = ['saas', 'software', 'app', 'devtool', 'developer', 'api', 'fintech', 'finance', 'bank', 'legal', 'law', 'accountant', 'accounting', 'tax',
  'insurance', 'consultancy', 'consulting', 'b2b', 'agency', 'crm', 'analytics', 'platform', 'tool'];
/** Whether a word of the trade is one of the list's words (a plural, or a longer word starting with one of five letters or more, counts: hotels, kayaking). */
const hasWord = (trade: readonly string[], list: readonly string[]): boolean =>
  trade.flatMap((t) => t.toLowerCase().split(/[^a-z]+/)).filter(Boolean).some((x) => list.some((w) => x === w || norm(x) === w || (w.length >= 5 && x.startsWith(w))));
/** Trades whose visitors browse and for whom the impression is the product: their default motion level is showpiece (showpiece.md). */
export const SHOWPIECE_TRADES = ['studio', 'portfolio', 'agency', 'fashion', 'launch', 'culture'];
export type MotionLevel = 'still' | 'moment' | 'showpiece';
/** The motion level for a deal: as asked, else showpiece for a showpiece trade, else moment. */
export const motionFor = (trade: readonly string[], asked?: MotionLevel | null): MotionLevel => asked ?? (hasWord(trade, SHOWPIECE_TRADES) ? 'showpiece' : 'moment');
/** Does the trade sell being there (a place, a table, a class, an outing)? */
export const beingThere = (trade: readonly string[]): boolean => hasWord(trade, BEING_THERE) && !hasWord(trade, NO_FOOTAGE);
/** A hero whose opening is a video loop. */
export const isVideoHero = (h: Hero): boolean => h.needs.includes('video');

// ---- random --------------------------------------------------------------------

/** A seeded generator (mulberry32 over an xmur3 hash of the seed text). */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick the item with the best score plus seeded noise; null for an empty list. */
function pick<T>(items: readonly T[], score: (t: T) => number, r: () => number, noise = 1.5): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const it of items) {
    const s = score(it) + r() * noise;
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  return best;
}

/** Singular, lower-case form of a word, so "bakery" meets "bakeries". */
const norm = (w: string): string => {
  const x = w.toLowerCase().trim();
  if (x.endsWith('ies') && x.length > 4) return x.slice(0, -3) + 'y';
  if (x.endsWith('s') && !x.endsWith('ss') && x.length > 3) return x.slice(0, -1);
  return x;
};
/** How many of `a` meet one of the words in `b` (either containing the other). */
const overlap = (a: readonly string[] | undefined, b: readonly string[]): number => {
  if (!a || !b.length) return 0;
  const words = b.map(norm);
  return a.filter((raw) => {
    const x = norm(raw);
    return words.some((w) => x.includes(w) || w.includes(x));
  }).length;
};
/** Exact word match after singularising: for hard filters, where "bar" must not catch "barber". */
const meets = (a: readonly string[] | undefined, b: readonly string[]): boolean => {
  if (!a || !b.length) return false;
  const words = new Set(b.flatMap((t) => t.toLowerCase().split(/[^a-z]+/)).filter(Boolean).map(norm));
  return a.some((x) => words.has(norm(x)));
};

/** Narrow to items not avoided; if that leaves fewer than `min`, put back the avoided ones. */
function prefer<T>(items: T[], avoid: (t: T) => boolean, min = 1): T[] {
  const kept = items.filter((t) => !avoid(t));
  return kept.length >= min ? kept : items;
}

// ---- loading -------------------------------------------------------------------

/** The skill's data folder: next to the compiled script in the skill, or the source tree when run from build/. */
export function dataDir(): string {
  const candidates = [path.join(__dirname, '..', 'assets', 'data'), path.join(__dirname, '..', '..', 'skills', 'argus', 'assets', 'data')];
  return candidates.find((c) => fs.existsSync(path.join(c, 'fonts.json'))) ?? candidates[0]!;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadLibrary(dir: string = dataDir()): Library {
  const fonts = readJson(path.join(dir, 'fonts.json')) as { faces: Face[]; pairings: Pairing[] };
  const heroes = readJson(path.join(dir, 'heroes.json')) as { heroes: Hero[]; rules: Record<string, unknown> };
  const sections = readJson(path.join(dir, 'sections.json')) as { sections: Section[]; navigation: Pattern[]; footers: Pattern[] };
  return {
    faces: fonts.faces,
    pairings: fonts.pairings,
    heroes: heroes.heroes,
    heroRules: heroes.rules,
    sections: sections.sections,
    nav: sections.navigation,
    footers: sections.footers,
    notes: [],
  };
}

// ---- history -------------------------------------------------------------------

export interface HistoryEntry {
  id: string;
  date: string;
  build: number;
}
/** structures holds pattern classes as hero/<class> and section/<class>. */
export const HISTORY_KINDS = ['faces', 'pairings', 'heroes', 'grounds', 'shapes', 'sections', 'structures'] as const;
export type HistoryKind = (typeof HISTORY_KINDS)[number];
export type History = Record<HistoryKind, HistoryEntry[]>;

export const emptyHistory = (): History => ({ faces: [], pairings: [], heroes: [], grounds: [], shapes: [], sections: [], structures: [] });

/** The pattern class of a hero or section. */
export const heroClass = (h: Hero): string => h.structure ?? h.family;
export const sectionClass = (x: Section): string => x.structure ?? x.family;

/**
 * The cross-project history file, or null when it is not enabled. Nothing is read from or
 * written to the home folder unless the user asks: --global-history (the default file
 * ~/.argus/history.json, or --global-history=FILE) or ARGUS_GLOBAL_HISTORY (a file path,
 * or 1 for the default file).
 */
export function globalHistoryFile(flag: string | boolean | undefined, env: string | undefined = process.env.ARGUS_GLOBAL_HISTORY): string | null {
  const home = (): string | null => {
    try {
      const h = os.homedir();
      return h ? path.join(h, '.argus', 'history.json') : null;
    } catch {
      return null;
    }
  };
  if (typeof flag === 'string' && flag) return flag;
  if (flag === true) return env && !/^(1|true|yes|on)$/i.test(env) ? env : home();
  if (env && !/^(0|false|no|off)$/i.test(env)) return /^(1|true|yes|on)$/i.test(env) ? home() : env;
  return null;
}

/** Write a file safely: create its folder, write a temporary file beside it, then rename it into place. */
export function writeFileSafely(file: string, text: string): void {
  const abs = path.resolve(file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, abs);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* nothing to clean */ }
    throw err;
  }
}

/** Read a history file; a missing file is an empty history. Throws on a file that is not JSON. Kinds it no longer keeps (effects) are ignored. */
export function readHistory(file: string | undefined | null): History {
  const h = emptyHistory();
  if (!file || !fs.existsSync(file)) return h;
  const raw = readJson(file) as Partial<Record<HistoryKind, unknown>>;
  for (const k of HISTORY_KINDS) {
    const list = raw[k];
    if (!Array.isArray(list)) continue;
    for (const e of list) {
      if (typeof e === 'string') h[k].push({ id: e, date: '', build: 0 });
      else if (e && typeof e === 'object' && typeof (e as HistoryEntry).id === 'string') {
        const x = e as Partial<HistoryEntry>;
        h[k].push({ id: x.id!, date: typeof x.date === 'string' ? x.date : '', build: typeof x.build === 'number' ? x.build : 0 });
      }
    }
  }
  return h;
}

const lastBuild = (h: History): number => Math.max(0, ...HISTORY_KINDS.flatMap((k) => h[k].map((e) => e.build)));

/**
 * How recently and how often each id of one kind was used, over one or more histories:
 * each use in the last `window` builds counts HISTORY_DECAY^(builds ago), uses add up to
 * HISTORY_CAP, and across histories the larger weight counts.
 */
export function recency(hs: readonly History[], kind: HistoryKind, window: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const h of hs) {
    const last = lastBuild(h);
    const mine = new Map<string, number>();
    for (const e of h[kind]) {
      const ago = last - e.build;
      if (ago < 0 || ago >= window) continue;
      mine.set(e.id, Math.min(HISTORY_CAP, (mine.get(e.id) ?? 0) + HISTORY_DECAY ** ago));
    }
    for (const [id, w] of mine) out.set(id, Math.max(out.get(id) ?? 0, w));
  }
  return out;
}

/**
 * Work out which kind each id is. A pairing also records its faces; a hero or section its class.
 * An id with a kind prefix (section:my-own-panel) is taken as given; an id that is neither in the
 * library nor prefixed is unknown, most likely a typo, and is never recorded.
 */
export function classify(ids: string[], lib: Library): { add: Partial<Record<HistoryKind, string[]>>; known: Partial<Record<HistoryKind, string[]>>; unknown: string[] } {
  const add: Partial<Record<HistoryKind, string[]>> = {};
  const known: Partial<Record<HistoryKind, string[]>> = {};
  const unknown: string[] = [];
  const push = (k: HistoryKind, id: string, inLibrary: boolean): void => {
    for (const target of inLibrary ? [add, known] : [add]) {
      const list = (target[k] ??= []);
      if (!list.includes(id)) list.push(id);
    }
  };
  const prefixes: Record<string, HistoryKind> = { face: 'faces', pairing: 'pairings', hero: 'heroes', ground: 'grounds', shape: 'shapes', section: 'sections', structure: 'structures' };
  for (const raw of ids) {
    const m = /^(face|pairing|hero|ground|shape|section|structure):(.+)$/.exec(raw);
    const id = m?.[2] ?? raw;
    const p = lib.pairings.find((x) => x.id === id);
    const h = lib.heroes.find((x) => x.id === id);
    const sec = lib.sections.find((x) => x.id === id);
    if (p) {
      push('pairings', p.id, true);
      for (const f of [p.display, p.text, p.accent]) if (f) push('faces', f, true);
    } else if (lib.faces.some((x) => x.id === id)) push('faces', id, true);
    else if (h) {
      push('heroes', id, true);
      push('structures', 'hero/' + heroClass(h), true);
    } else if (sec) {
      push('sections', id, true);
      push('structures', 'section/' + sectionClass(sec), true);
    } else if (GROUNDS.some((x) => x.id === id)) push('grounds', id, true);
    else if (SHAPES.some((x) => x.id === id)) push('shapes', id, true);
    else if (m && m[1]) push(prefixes[m[1]]!, id, false);
    else unknown.push(raw);
  }
  return { add, known, unknown };
}

/** Add one build to a history. */
export function addBuild(h: History, add: Partial<Record<HistoryKind, string[]>>, date: string): History {
  const build = lastBuild(h) + 1;
  const out = emptyHistory();
  for (const k of HISTORY_KINDS) out[k] = [...h[k], ...(add[k] ?? []).map((id) => ({ id, date, build }))];
  return out;
}

/** Today's date where the user is, as YYYY-MM-DD. */
export const localDate = (now: Date): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// ---- dealing -------------------------------------------------------------------

export interface DealOptions {
  n: number;
  tone: 'calm' | 'lively' | 'bold';
  taste: 'light' | 'dark' | 'any';
  /** video: photographs, with a muted loop wanted for the picture-led opening. */
  picture: 'photographs' | 'product' | 'type' | 'video' | null;
  /** The trade or kind of business (bakery, clinic, saas): weights fit, and filters what the data says to avoid. */
  trade: string[];
  /** The direction kinds, in order; null for the default (one of each, or by tone for one direction). */
  kinds?: Kind[] | null;
  needs: string[] | null;
  /** Things the owner said would be wrong: ids, words of ids, classes, families, needs, face classifications. Filtered out, never just weighted. */
  no: string[];
  seed: string;
  /** Deal faces that have no stylesheet URL or whose licence forbids redistribution (you supply the files). */
  selfHost?: boolean;
  /** The ids of a direction already chosen (its record line): the new directions are dealt away from it. */
  keep?: string[];
  /** Habits dealt only when asked: side-by-side (a first screen with text beside a picture) and mono (a monospace face). */
  allow?: string[];
  /** The motion level (showpiece.md); null or absent: chosen from the trade. It only labels the deal, except that a showpiece lets its picture-led and expressive directions lean to louder heroes. */
  motion?: MotionLevel | null;
}

export interface Direction {
  label: string;
  kind: Kind;
  hero: Hero;
  pairing: Pairing;
  faces: { display: Face; text: Face; accent?: Face };
  /** The display setting to use: the pairing's own for expressive, a restrained one otherwise. */
  typeSetting: string;
  shape: Choice;
  ground: Choice;
  sections: Section[];
  nav: Pattern;
  footer: Pattern;
  record: string[];
}

export interface Deal {
  seed: string;
  options: DealOptions;
  directions: Direction[];
  /** The first-screen craft rules from heroes.json, as sentences. */
  rules: string[];
  notes: string[];
  /** The pattern classes and ids the histories lean away from, most recent first. */
  recent: string[];
  /** The motion level the deal is labelled with. */
  motion: MotionLevel;
}

/** Sections that are variants of one thing share a topic (faq-split, faq-index). */
const topic = (id: string): string => (id.startsWith('faq-') ? 'faq' : id);

/** The kinds for a deal: as asked, else one of each in order, or for one direction the kind the tone suggests. */
export function kindsFor(o: Pick<DealOptions, 'n' | 'tone' | 'kinds'>, n: number): Kind[] {
  if (o.kinds && o.kinds.length) return Array.from({ length: n }, (_, i) => o.kinds![i % o.kinds!.length]!);
  if (n === 1) return [o.tone === 'calm' ? 'minimal' : o.tone === 'bold' ? 'expressive' : 'picture-led'];
  return Array.from({ length: n }, (_, i) => KINDS[i % KINDS.length]!);
}

/**
 * Common spellings of what an owner rules out, mapped to the classes and families the data uses.
 * Each term also stays itself.
 */
export const NO_ALIASES: Record<string, string[]> = {
  'stacked-cards': ['stacked-cards', 'stacking-cards', 'stack-cards', 'card-stack', 'cards-stack'],
  'sticky-steps': ['sticky-steps', 'sticky-step', 'sticky', 'sticky-scroll', 'sticky-scene', 'pinned-steps', 'scrollytelling'],
  timeline: ['timeline', 'timelines', 'time-line'],
  'side-by-side': ['side-by-side', 'split', 'splits', 'split-screen', 'two-column', 'two-columns', '50-50'],
  split: ['split', 'splits', 'split-screen', 'side-by-side'],
  'ink-ground': ['dark', 'dark-ground', 'black', 'night'],
  serif: ['serif', 'serifs'],
  'cut-out': ['cut-out', 'cutout', 'cutouts', 'cut-outs'],
  marquee: ['marquee', 'ticker', 'marquees'],
};

/** The owner's --no terms with their common spellings added: lower case, spaces and underscores as hyphens. */
export function expandNo(no: readonly string[]): string[] {
  const out = new Set<string>();
  for (const raw of no) {
    const t = raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (!t) continue;
    out.add(t);
    for (const [canon, spellings] of Object.entries(NO_ALIASES)) if (spellings.includes(t)) out.add(canon);
  }
  return [...out];
}

/** Does one of the owner's --no terms name this item (its id, a word of its id, or one of its tags)? */
export function ruledOut(id: string, tags: readonly (string | undefined)[], no: readonly string[]): boolean {
  if (!no.length) return false;
  const words = new Set([id, ...id.split('-'), ...tags.filter((t): t is string => !!t).map((t) => t.toLowerCase())]);
  return no.some((t) => words.has(t) || (t.includes('-') && id.includes(t)));
}

/** Structure classes dealt to at most one direction in a set: the side-by-side hero and sticky-step sections, today's habits. */
export const ONCE_PER_SET: readonly string[] = ['side-by-side', 'sticky-steps'];
/**
 * Hero structure classes never dealt unless asked: text beside a picture, device or drawing is the
 * arrangement every generated page falls into, and the owner's standing preference is not to get it
 * by default. Asked for with --allow side-by-side, or --needs form-in-hero (a form or tool must sit
 * beside the headline); then to one direction at most.
 */
export const OPT_IN_CLASSES: readonly string[] = ['side-by-side'];
/** Is a side-by-side first screen asked for? */
export const splitAsked = (o: Pick<DealOptions, 'allow' | 'needs'>): boolean => expandNo(o.allow ?? []).includes('side-by-side') || !!o.needs?.includes('form-in-hero');
/** Is a monospace face asked for (code or technical data the page really has)? */
export const monoAsked = (o: Pick<DealOptions, 'allow' | 'needs'>): boolean => (o.allow ?? []).map((x) => x.toLowerCase()).some((x) => x === 'mono' || x === 'monospace') || !!o.needs?.includes('code');

export function deal(lib: Library, given: DealOptions, history: History = emptyHistory(), global: History = emptyHistory()): Deal {
  const o: DealOptions = { ...given, no: expandNo(given.no) };
  const r = rng(o.seed);
  const notes = [...lib.notes];
  const n = Math.max(1, Math.min(MAX_DIRECTIONS, Math.floor(o.n)));
  const trade = o.trade ?? [];
  const faceById = new Map(lib.faces.map((f) => [f.id, f]));
  const calm = o.tone === 'calm';
  const showpiece = motionFor(trade, o.motion) === 'showpiece';

  const hs = [history, global];
  const usedFacesHist = recency(hs, 'faces', HISTORY_WINDOW);
  const usedPairHist = recency(hs, 'pairings', HISTORY_WINDOW);
  const usedHeroHist = recency(hs, 'heroes', HISTORY_WINDOW);
  const usedGroundHist = recency(hs, 'grounds', SMALL_WINDOW);
  const usedShapeHist = recency(hs, 'shapes', SMALL_WINDOW);
  const usedSectionHist = recency(hs, 'sections', HISTORY_WINDOW);
  const usedClassHist = recency(hs, 'structures', HISTORY_WINDOW);
  /** The soft history: an item used recently scores lower, by how recently and how often, never out. */
  const hist = (m: Map<string, number>, ...ids: Array<string | undefined>): number => -HISTORY_PENALTY * Math.max(0, ...ids.map((id) => (id ? m.get(id) ?? 0 : 0)));
  const byWeight = (m: Map<string, number>): string[] => [...m].filter(([, w]) => w >= HISTORY_DECAY - 0.01).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const recentList = [...byWeight(usedClassHist), ...byWeight(usedHeroHist)].slice(0, 10);
  if ([usedFacesHist, usedPairHist, usedHeroHist, usedGroundHist, usedShapeHist, usedClassHist].some((x) => x.size)) {
    notes.push(`Leaned away from items and pattern classes used in the last ${HISTORY_WINDOW} builds (grounds and shapes: the last build). The history only lowers a score; the brief's --no, --taste and --tone are filters and come first.`);
  }

  // The kinds, in order. A picture-led slot with no pictures becomes expressive (type-led).
  let kinds = kindsFor(o, n);
  if (o.picture === 'type' && kinds.includes('picture-led')) {
    kinds = kinds.map((k) => (k === 'picture-led' ? 'expressive' : k));
    notes.push('--picture type: the picture-led slot is dealt as expressive (type-led).');
  }
  if (o.picture === 'product' && kinds.includes('picture-led')) notes.push('--picture product: in the picture-led direction the product\'s own interface, large and in real states, carries the page.');

  // Heroes allowed by the picture mode, the assets, the owner's --no, the trade and the tone.
  let heroes = lib.heroes.filter((h) => h.reach !== 'out');
  const modes: string[] = o.picture === 'video' ? ['photographs', 'video'] : o.picture ? [o.picture] : [];
  if (modes.length) heroes = heroes.filter((h) => h.modes.some((m) => modes.includes(m)));
  const videoAsked = o.picture === 'video' || !!o.needs?.includes('video');
  const videoOffered = videoAsked || (beingThere(trade) && o.picture !== 'product' && o.picture !== 'type');
  if (!videoOffered) heroes = heroes.filter((h) => !isVideoHero(h));
  if (videoAsked && hasWord(trade, NO_FOOTAGE)) notes.push(`--picture video for --trade ${trade.join(',')}: a video opening was asked for; make sure footage adds something a still or the product cannot.`);
  heroes = heroes.filter((h) => !ruledOut(h.id, [h.family, heroClass(h), ...h.needs], o.no));
  if (o.needs) {
    const have = [...o.needs, ...FREE_NEEDS, ...(o.picture === 'video' ? ['video'] : [])];
    heroes = heroes.filter((h) => h.needs.every((x) => have.includes(x)));
  } else heroes = heroes.filter((h) => h.reach !== 'commission');
  const hasProduct = o.picture === 'product' || !!o.needs?.includes('product-ui');
  heroes = prefer(heroes, (h) => h.needs.includes('product-ui') && !hasProduct && overlap(h.suits, trade) === 0, n);
  // Trade fit is a hard filter: a hero whose data names this kind of business as one it fails for is
  // never dealt to it (a video opening asked for by name is the owner's call).
  const avoided = heroes.filter((h) => meets(h.avoid, trade) && !(videoAsked && isVideoHero(h)));
  if (avoided.length) {
    heroes = heroes.filter((h) => !avoided.includes(h));
    notes.push(`Never dealt to --trade ${trade.join(',')}: ${avoided.map((h) => h.id).join(', ')} (see deal.js show <id>, "fails").`);
  }
  if (calm) heroes = heroes.filter((h) => !h.loud);
  const splitOk = splitAsked(o);
  if (!splitOk) heroes = heroes.filter((h) => !OPT_IN_CLASSES.includes(heroClass(h)));
  if (!heroes.length) {
    notes.push('No hero fits these constraints; falling back to the quiet type-only heroes.');
    heroes = lib.heroes.filter((h) => h.needs.every((x) => x === 'type-only') && !h.loud);
  }

  // Pairings: never an overused face; only faces a page can load from a stylesheet URL and may
  // redistribute, unless --self-host; never a loud one for a calm tone; never what --no names.
  const blocked = new Set(lib.faces.filter((f) => f.overused || (!o.selfHost && (!f.load.css || f.selfHostOnly)) || ruledOut(f.id, [f.classification, SERIF_CLASSES.includes(f.classification) ? 'serif' : 'sans'], o.no)).map((f) => f.id));
  let safePairings = lib.pairings.filter((p) => ![p.display, p.text, p.accent].some((f) => f && blocked.has(f)) && !ruledOut(p.id, [], o.no));
  if (calm) safePairings = safePairings.filter((p) => !loudPairing(p, faceById.get(p.display)!));
  // Monospace only for code or technical data the page has: never a mono text face, and a mono third face is left out.
  const monoOk = monoAsked(o);
  const isMono = (id: string | undefined): boolean => !!id && faceById.get(id)?.classification === 'mono';
  if (!monoOk) safePairings = prefer(safePairings, (p) => isMono(p.display) || isMono(p.text));
  if (!safePairings.length) {
    notes.push('No pairing fits these constraints; dealt from every pairing that can load.');
    safePairings = lib.pairings.filter((p) => ![p.display, p.text, p.accent].some((f) => f && faceById.get(f)?.overused));
  }

  // Sections: the trade's avoid list and the tone are filters; --no too. The finale always stays.
  const sectionsOk = lib.sections.filter((x) => x.id === 'cta-finale' || !(ruledOut(x.id, [sectionClass(x), x.family], o.no) || meets(x.avoid, trade) || (calm && x.loud)));

  const dirs: Direction[] = [];
  const used = { heroes: new Set<string>(), families: new Set<string>(), heroClasses: new Set<string>(), sectionClasses: new Map<string, number>(), displayClasses: new Set<string>(), textClasses: new Set<string>(), faces: new Set<string>(), grounds: new Set<string>(), groundFamilies: new Set<string>(), shapes: new Set<string>(), sections: new Map<string, number>(), nav: new Set<string>(), footers: new Set<string>(), lightSerif: 0 };

  // A kept direction (the owner's pick) counts as already dealt: the others are dealt away from it.
  if (o.keep?.length) {
    const k = classify(o.keep, lib).known;
    for (const id of k.heroes ?? []) {
      const h = lib.heroes.find((x) => x.id === id);
      if (h) {
        used.heroes.add(h.id);
        used.families.add(h.family);
        used.heroClasses.add(heroClass(h));
      }
    }
    for (const id of k.faces ?? []) {
      used.faces.add(id);
      const f = faceById.get(id);
      if (f) used.displayClasses.add(f.classification);
    }
    let keptLight = false;
    for (const id of k.grounds ?? []) {
      const g = GROUNDS.find((x) => x.id === id);
      if (g) {
        used.grounds.add(g.id);
        if (g.family) used.groundFamilies.add(g.family);
        keptLight ||= g.family === 'light';
      }
    }
    if (keptLight && (k.pairings ?? []).some((pid) => SERIF_CLASSES.includes(faceById.get(lib.pairings.find((p) => p.id === pid)?.display ?? '')?.classification ?? ''))) used.lightSerif++;
    for (const id of k.shapes ?? []) used.shapes.add(id);
    for (const id of k.sections ?? []) {
      const sec = lib.sections.find((x) => x.id === id);
      if (sec) used.sectionClasses.set(sectionClass(sec), (used.sectionClasses.get(sectionClass(sec)) ?? 0) + 1);
    }
    notes.push(`Kept: ${o.keep.join(' ')}. The directions below are dealt away from it.`);
  }
  const noise = 1.5;

  for (let i = 0; i < n; i++) {
    const kind = kinds[i]!;
    const label = String.fromCharCode(65 + i);

    // Hero: one of its kind; never the hero or structure class of another direction while any is left.
    let ofKind = heroes.filter((h) => (h.kinds ?? KINDS).includes(kind));
    if (!ofKind.length) {
      notes.push(`No hero of kind ${kind} fits these constraints; dealt from all that fit.`);
      ofKind = heroes;
    }
    const fresh = (list: Hero[]): Hero[] => list.filter((h) => !used.heroes.has(h.id) && !used.heroClasses.has(heroClass(h)));
    let pool = fresh(ofKind);
    // A form or tool beside the headline is the one need a side-by-side opening answers best.
    const formFit = (h: Hero): number => (o.needs?.includes('form-in-hero') && heroClass(h) === 'side-by-side' ? 1.5 : 0);
    if (!pool.length) {
      pool = fresh(heroes);
      if (pool.length) notes.push(`Direction ${label} (${kind}): no hero of its kind with an unused structure fits, so it is dealt one of another kind rather than share one.`);
    }
    // The side-by-side split is today's most familiar opening: never dealt to two directions in one set.
    const notSecondSplit = (h: Hero): boolean => !(ONCE_PER_SET.includes(heroClass(h)) && used.heroClasses.has(heroClass(h)));
    if (!pool.length) {
      pool = heroes.filter((h) => !used.heroes.has(h.id) && notSecondSplit(h));
      if (pool.length) notes.push(`Direction ${label} (${kind}): every structure class that fits is taken, so it shares one; change one hero by hand.`);
      else pool = ofKind.filter(notSecondSplit).length ? ofKind.filter(notSecondSplit) : ofKind;
    }
    pool = prefer(pool, (h) => used.families.has(h.family));
    const toneFit = (h: Hero): number => (calm && (h.kinds ?? []).includes('minimal') ? 1 : o.tone === 'bold' && (h.kinds ?? []).includes('expressive') ? 0.5 : 0);
    // A showpiece site may take a louder first screen in its picture-led and expressive directions, even
    // under the neutral tone (a calm tone has already filtered loud heroes out).
    const showFit = (h: Hero): number => (showpiece && kind !== 'minimal' && h.loud ? 1.5 : 0);
    if (kind !== 'picture-led') pool = prefer(pool, isVideoHero);
    else if (o.picture === 'video') pool = prefer(pool, (h) => !isVideoHero(h));
    const opening = (h: Hero): number => (kind === 'picture-led' && beingThere(trade) && o.picture !== 'product' && (heroClass(h) === 'full-bleed' || isVideoHero(h)) ? 3 : 0);
    const hero = pick(pool, (h) => 2 * overlap(h.suits, trade) + formFit(h) + toneFit(h) + showFit(h) + opening(h) + (o.picture === 'type' && h.pictureFree ? 2 : 0) + (o.picture === 'product' && h.needs.includes('product-ui') ? 1.5 : 0) + (h.reach === 'stock' ? 0.5 : 0) + hist(usedHeroHist, h.id) + hist(usedClassHist, 'hero/' + heroClass(h)), r, noise)!;
    used.heroes.add(hero.id);
    used.families.add(hero.family);
    used.heroClasses.add(heroClass(hero));

    // Ground: of its kind, within the taste, the tone and --no; a family no other direction has while any is left.
    const byTaste = (g: Choice): boolean => (o.taste === 'light' ? g.family === 'light' : o.taste === 'dark' ? g.family === 'dark' || g.family === 'colour' : true);
    const groundOk = (g: Choice): boolean => byTaste(g) && !(calm && g.loud) && !ruledOut(g.id, [g.family], o.no);
    let grounds = GROUNDS.filter((g) => KIND_GROUNDS[kind].includes(g.id) && groundOk(g));
    if (!grounds.length) {
      grounds = GROUNDS.filter(groundOk);
      if (!grounds.length) grounds = GROUNDS.filter(byTaste);
      if (!grounds.length) grounds = [...GROUNDS];
      notes.push(`Direction ${label} (${kind}): none of its usual grounds fits the taste, tone and --no; dealt from those that do.`);
    }
    grounds = prefer(grounds, (g) => used.groundFamilies.has(g.family ?? ''));
    grounds = prefer(grounds, (g) => used.grounds.has(g.id));
    if (kind === 'minimal' && o.taste === 'any') {
      // Light, mid, dark or colour with equal chance: the minimal page is not always pale.
      const families = [...new Set(grounds.map((g) => g.family ?? ''))];
      const fam = families[Math.floor(r() * families.length)]!;
      grounds = grounds.filter((g) => (g.family ?? '') === fam);
    }
    const toneGround = TONE_GROUND[o.tone] ?? {};
    const ground = pick(grounds, (g) => (toneGround[g.id] ?? 0) + hist(usedGroundHist, g.id), r, noise)!;
    used.grounds.add(ground.id);
    if (ground.family) used.groundFamilies.add(ground.family);

    // Pairing: display classification differs across directions, faces never shared; at most one
    // direction pairs a light ground with a serif display (the editorial default).
    let pp = safePairings.filter((p) => ![p.display, p.text, p.accent].some((f) => f && used.faces.has(f)));
    if (!pp.length) pp = safePairings.filter((p) => ![p.display, p.text].some((f) => used.faces.has(f)));
    if (!pp.length) pp = safePairings;
    const serifDisplay = (p: Pairing): boolean => SERIF_CLASSES.includes(faceById.get(p.display)!.classification);
    if (ground.family === 'light' && used.lightSerif >= 1) pp = prefer(pp, serifDisplay);
    pp = prefer(pp, (p) => used.displayClasses.has(faceById.get(p.display)!.classification));
    pp = prefer(pp, (p) => used.textClasses.has(faceById.get(p.text)!.classification));
    const tone = TONE_CLASS[o.tone] ?? {};
    const pairing = pick(pp, (p) => 2 * overlap(p.suits, trade) + (tone[faceById.get(p.display)!.classification] ?? 0) + overlap(faceById.get(p.display)!.suits, trade) * 0.5 + hist(usedPairHist, p.id) + hist(usedFacesHist, p.display, p.text, p.accent), r, noise)!;
    const display = faceById.get(pairing.display)!;
    const text = faceById.get(pairing.text)!;
    const accent = pairing.accent && (monoOk || !isMono(pairing.accent)) ? faceById.get(pairing.accent) : undefined;
    if (pairing.accent && !accent) notes.push(`Direction ${label}: the pairing's monospace third face (${pairing.accent}) is left out; mono is for code or technical data the page really has (--needs code or --allow mono), never for labels.`);
    used.displayClasses.add(display.classification);
    used.textClasses.add(text.classification);
    for (const f of [display, text, accent]) if (f) used.faces.add(f.id);
    if (ground.family === 'light' && serifDisplay(pairing)) used.lightSerif++;
    const s = pairing.setting;
    const typeSetting = kind === 'expressive'
      ? `at ${s.displayWeight}${s.displayStretch ? ', stretch ' + s.displayStretch : ''}, tracking ${s.displayTracking}, leading ${s.displayLeading}`
      : RESTRAINED_SETTING;

    // Shape: different in every direction while choices remain.
    let shapes = SHAPES.filter((x) => !used.shapes.has(x.id) && !ruledOut(x.id, [], o.no));
    if (!shapes.length) shapes = SHAPES.filter((x) => !ruledOut(x.id, [], o.no));
    if (!shapes.length) shapes = [...SHAPES];
    const shape = pick(shapes, (x) => (KIND_SHAPE[kind][x.id] ?? 0) + (hero.family === 'cutout' && x.id === 'subject-frame' ? 1 : 0) + hist(usedShapeHist, x.id), r, noise)!;
    used.shapes.add(shape.id);

    // Sections: six to eight candidates, no two of one layout family next to each other, varied across directions.
    const count = 6 + Math.floor(r() * 3);
    const body = sectionsOk.filter((x) => x.id !== 'mega-footer' && x.id !== 'cta-finale');
    const scored = body
      .map((x) => ({ s: x, k: 2 * overlap(x.fits, trade) + (x.fits.includes('any') ? 0.5 : 0) - 1.5 * (used.sections.get(x.id) ?? 0) - (used.sectionClasses.get(sectionClass(x)) ?? 0) + hist(usedSectionHist, x.id) + 0.7 * hist(usedClassHist, 'section/' + sectionClass(x)) + r() * noise * 1.5 }))
      .sort((a, b) => b.k - a.k);
    const chosen: Section[] = [];
    const rest = scored.map((x) => x.s);
    const last = lib.sections.find((x) => x.id === 'cta-finale');
    const target = last ? count - 1 : count;
    while (chosen.length < target && rest.length) {
      const prev = chosen[chosen.length - 1];
      const idx = rest.findIndex((x) => !prev || x.family !== prev.family);
      if (idx < 0) break;
      const next = rest.splice(idx, 1)[0]!;
      if (chosen.some((c) => topic(c.id) === topic(next.id) || sectionClass(c) === sectionClass(next))) continue;
      // Sticky steps are a familiar default: at most one direction in a set is dealt them.
      if (ONCE_PER_SET.includes(sectionClass(next)) && (used.sectionClasses.get(sectionClass(next)) ?? 0) > 0) continue;
      chosen.push(next);
    }
    if (last) {
      const prev = chosen[chosen.length - 1];
      if (prev && prev.family === last.family) {
        const idx = rest.findIndex((x) => x.family !== last.family && x.family !== chosen[chosen.length - 2]?.family && !chosen.slice(0, -1).some((c) => sectionClass(c) === sectionClass(x) || topic(c.id) === topic(x.id)));
        if (idx >= 0) chosen[chosen.length - 1] = rest.splice(idx, 1)[0]!;
        else chosen.pop();
      }
      chosen.push(last);
    }
    for (const x of chosen) {
      used.sections.set(x.id, (used.sections.get(x.id) ?? 0) + 1);
      if (x.id !== 'cta-finale') used.sectionClasses.set(sectionClass(x), (used.sectionClasses.get(sectionClass(x)) ?? 0) + 1);
    }

    // A main nav pattern; one that suits only some trades (the command palette) is dealt only to those.
    const mains = lib.nav.filter((x) => (x.role ?? 'main') === 'main' && !ruledOut(x.id, [], o.no) && (x.id !== 'command-palette' || overlap(x.fits, trade) > 0 || o.picture === 'product'));
    const nav = pick(prefer(mains.length ? mains : lib.nav, (x) => used.nav.has(x.id)), (x) => overlap(x.fits, trade), r, noise)!;
    used.nav.add(nav.id);
    const footer = pick(prefer(lib.footers, (x) => used.footers.has(x.id)), (x) => overlap(x.fits, trade), r, noise)!;
    used.footers.add(footer.id);

    const record = [pairing.id, hero.id, ground.id, shape.id, ...chosen.filter((x) => x.id !== 'cta-finale').map((x) => x.id)];
    dirs.push({ label, kind, hero, pairing, faces: accent ? { display, text, accent } : { display, text }, typeSetting, shape, ground, sections: chosen, nav, footer, record });
  }
  if (!splitOk) notes.push('No side-by-side first screen was dealt (text beside a picture, device or drawing): the owner\'s standing preference. Only --allow side-by-side or --needs form-in-hero deals one, to one direction at most.');
  const rules = Object.values(lib.heroRules ?? {}).filter((v): v is string => typeof v === 'string');
  return { seed: o.seed, options: { ...o, n, trade, kinds }, directions: dirs, rules, notes, recent: recentList, motion: motionFor(trade, o.motion) };
}

// ---- printing ------------------------------------------------------------------

/** Whether to print the opening line: a video hero, or a full-bleed photo hero for a trade that sells being there. */
function videoOpening(x: Direction, o: DealOptions): boolean {
  if (isVideoHero(x.hero)) return true;
  return x.kind === 'picture-led' && heroClass(x.hero) === 'full-bleed' && o.picture !== 'product' && o.picture !== 'type' && beingThere(o.trade);
}

function faceLine(f: Face): string {
  const axes = f.axes ? Object.entries(f.axes).map(([k, v]) => `${k} ${v[0]}-${v[1]}`).join(', ') : `${f.weightExtremes.light}-${f.weightExtremes.heavy}`;
  return `${f.name} (${f.classification}; ${axes})`;
}

/** How a recency id reads: hero/side-by-side as "side-by-side first screens", an id as itself. */
const recentLabel = (id: string): string => {
  const m = /^(hero|section)\/(.+)$/.exec(id);
  if (!m) return id;
  return m[1] === 'hero' ? `${m[2]} first screens` : `${m[2]} sections`;
};

export function printDeal(d: Deal, history?: string): string {
  const out: string[] = [];
  const o = d.options;
  out.push(`Dealt ${d.directions.length} direction(s). Seed ${d.seed} (repeat with --seed ${d.seed}).`);
  out.push(`Tone ${o.tone}, taste ${o.taste}${o.picture ? ', picture ' + o.picture : ''}${o.trade.length ? ', trade ' + o.trade.join(',') : ''}${o.no.length ? ', no ' + o.no.join(',') : ''}`);
  out.push('Each direction is a real contender, finished to the same standard; the owner\'s taste binds all of them. Swap any item for a reason and note it.');
  if (d.recent?.length) out.push(`Recently used, leaning away from: ${d.recent.map(recentLabel).join(', ')}.`);
  if (d.rules.length) {
    out.push('First-screen rules for every direction (first-screen.md):');
    for (const rule of d.rules) out.push('  - ' + rule);
  }
  for (const x of d.directions) {
    const s = x.pairing.setting;
    out.push('');
    out.push(`Direction ${x.label}  ${x.kind}: ${KIND_SAYS[x.kind]}`);
    out.push(`  Hero      ${x.hero.id}: ${x.hero.name}  [structure ${heroClass(x.hero)}; needs ${x.hero.needs.join(', ')}]`);
    out.push(`            ${x.hero.layout}`);
    if (o.picture === 'product' && !x.hero.needs.every((nd) => ['product-ui', 'type-only', 'live-data'].includes(nd))) out.push('            (the product\'s own interface stands in for the pictures this hero names)');
    out.push(`            fails when: ${x.hero.fails}`);
    out.push(`  Type      ${x.pairing.id}: ${x.pairing.why}`);
    out.push(`            display ${faceLine(x.faces.display)} ${x.typeSetting}`);
    out.push(`            text    ${faceLine(x.faces.text)} at ${s.bodySize}px`);
    if (x.faces.accent) out.push(`            accent  ${faceLine(x.faces.accent)}`);
    const loads = new Map<string, Face>();
    for (const f of [x.faces.display, x.faces.text, x.faces.accent]) if (f) loads.set(f.id, f);
    for (const f of loads.values()) out.push(`            load    ${f.load.css ?? 'self-host from ' + f.load.files}${f.selfHostOnly ? '  (licence forbids redistribution: load from this URL or the owner\'s own copy; never commit the files)' : ''}`);
    out.push(`  Ground    ${x.ground.id} (${x.ground.family}): ${x.ground.does}`);
    out.push(`  Shape     ${x.shape.id}: ${x.shape.does}`);
    out.push(`  Sections  ${x.sections.map((sec) => `${sec.id} (${sectionClass(sec)})`).join(' > ')}`);
    out.push(`  Nav       ${x.nav.id}; footer ${x.footer.id}`);
    if (videoOpening(x, o)) out.push(`  Opening   ${isVideoHero(x.hero) ? 'a muted loop' : 'a full-bleed photograph, or a muted loop instead'}: pictures.md, "Video"; text on the calm area, a pause button, the poster under reduced motion`);
    out.push(`  Record    deal.js record --history ${history ?? '.argus/history.json'} ${x.record.join(' ')}`);
  }
  out.push('');
  out.push(d.motion === 'still'
    ? 'Motion level: still (the owner\'s choice). Hover, focus and press states only; set data-argus-motion="still" on <html> (showpiece.md, "Pick the level").'
    : d.motion === 'showpiece'
    ? `Motion level: showpiece${o.motion ? '' : ' (from the trade)'}. Plan its scenes, transitions, WebGL layer, toy and a preloader only if something real must load, from showpiece.md; nothing motion is dealt.`
    : `Motion level: moment${o.motion ? '' : ' (from the trade)'}. The baseline (an arrival, sections that enter, controls that respond) and one choreographed moment (showpiece.md, "Pick the level"; motion.md, M0); nothing motion is dealt.`);
  out.push('After the build, record what was BUILT, not what was dealt (build.md, "The record").');
  if (d.notes.length) {
    out.push('');
    out.push('Notes:');
    for (const n of d.notes) out.push('  ' + n);
  }
  return out.join('\n');
}

// ---- list and show -------------------------------------------------------------

type Row = { id: string; line: string; tags: string[]; entry: unknown };

function rows(lib: Library, what: string): Row[] | null {
  const face = (id: string): string => lib.faces.find((f) => f.id === id)?.name ?? id;
  switch (what) {
    case 'fonts':
    case 'faces':
      return lib.faces.map((f) => ({ id: f.id, line: `${f.name} | ${f.classification} | ${f.source} | ${f.roles.join('/')}${f.overused ? ' | OVERUSED, never dealt' : ''}${!f.load.css ? ' | no stylesheet URL, dealt only with --self-host' : ''}${f.selfHostOnly ? ' | no redistribution: dealt only with --self-host, never commit the files' : ''} | ${f.character}`, tags: [f.classification, f.source, ...f.roles, ...f.suits, ...f.lettering, f.overused ? 'overused' : 'fresh', ...(f.selfHostOnly ? ['self-host-only'] : [])], entry: f }));
    case 'pairings':
      return lib.pairings.map((p) => ({ id: p.id, line: `${face(p.display)} + ${face(p.text)}${p.accent ? ' + ' + face(p.accent) : ''} | ${p.suits.join(', ')}`, tags: [...p.suits, p.display, p.text, ...(p.accent ? [p.accent] : [])], entry: p }));
    case 'heroes':
      return lib.heroes.map((h) => ({ id: h.id, line: `${h.name} | ${(h.kinds ?? []).join('/')} | ${heroClass(h)} | ${h.family} | needs ${h.needs.join(', ')} | ${h.reach}${h.pictureFree ? ' | picture-free' : ''}${h.loud ? ' | loud' : ''}`, tags: [...(h.kinds ?? []), heroClass(h), h.family, h.reach, ...h.needs, ...h.modes, ...h.suits, h.pictureFree ? 'picture-free' : 'picture', h.loud ? 'loud' : 'quiet'], entry: h }));
    case 'sections':
      return lib.sections.map((s) => ({ id: s.id, line: `${s.name} | ${sectionClass(s)} | ${s.family} | ${s.density} | ${s.fits.join(', ')}${s.avoid ? ' | not for ' + s.avoid.join(', ') : ''}`, tags: [sectionClass(s), s.family, s.density, ...s.fits], entry: s }));
    case 'nav':
    case 'navigation':
      return lib.nav.map((x) => ({ id: x.id, line: `${x.name} | ${x.fits.join(', ')}`, tags: x.fits, entry: x }));
    case 'footers':
      return lib.footers.map((x) => ({ id: x.id, line: `${x.name} | ${x.fits.join(', ')}`, tags: x.fits, entry: x }));
    case 'grounds':
      return GROUNDS.map((g) => ({ id: g.id, line: `${g.name} | ${g.family}${g.loud ? ' | loud' : ''} | ${g.does}`, tags: [g.family ?? ''], entry: g }));
    case 'shapes':
      return SHAPES.map((g) => ({ id: g.id, line: `${g.name} | ${g.does}`, tags: [], entry: g }));
    default:
      return null;
  }
}
const LISTS = ['fonts', 'pairings', 'heroes', 'sections', 'nav', 'footers', 'grounds', 'shapes'];

/** Find an id in every library. */
export function find(lib: Library, id: string): { kind: string; entry: unknown } | null {
  for (const kind of LISTS) {
    const hit = rows(lib, kind)!.find((r) => r.id === id);
    if (hit) return { kind, entry: hit.entry };
  }
  return null;
}

function showText(entry: unknown): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
    const val = Array.isArray(v) ? v.join(', ') : v && typeof v === 'object' ? JSON.stringify(v) : String(v);
    out.push(`${(k + ':').padEnd(16)}${val}`);
  }
  return out.join('\n');
}

// ---- command line --------------------------------------------------------------

export const USAGE = [
  'Usage: node deal.js <command> [options]',
  '',
  'Deals design directions from the skill\'s data files, so directions differ from each',
  'other and from earlier builds by mechanism. No network. Same --seed, same deal.',
  '',
  'Commands:',
  '  directions [--n 3] [--kinds k1,k2] [--tone calm|lively|bold] [--trade w1,w2] [--history FILE]',
  `      Deal N directions (1-${MAX_DIRECTIONS}) that differ in kind: by default one minimal, one`,
  '      picture-led and one expressive. Each gets a hero composition and its structure class,',
  '      a type pairing, a ground, a shape, six to eight candidate sections and a nav and',
  '      footer pattern. No two share a hero, a structure class, a face or (while any is left)',
  '      a ground family, and at most one pairs a light ground with a serif display. Motion is',
  '      not dealt. One direction alone takes its kind from the tone.',
  '      --kinds k1,k2      minimal, picture-led or expressive, in order (repeats to fill --n)',
  '      --tone T           calm, lively or bold (default lively). Calm never deals a loud',
  '                         hero, pairing, ground or section',
  '      --taste T          light, dark or any (default any): which grounds may be dealt',
  '      --picture P        photographs, product (the product\'s own interface), type (no',
  '                         pictures) or video (the picture-led direction opens on a muted loop)',
  '      --video            the same as --picture video',
  '      --trade w1,w2      the trade or kind of business (bakery, clinic, saas...): weights fit,',
  '                         and never deals a hero or section whose data says to avoid it',
  '      --needs a,b        assets you can supply (cut-out, full-bleed-photo, photo-set,',
  '                         product-ui, video, 3d, illustration, footage-sequence); only heroes',
  '                         needing nothing else are dealt',
  '      --no a,b           what would be wrong: never deal a hero, section, pairing, face,',
  '                         ground or shape with this id, word, class, family or need',
  '                         (--no dark,serif,sticky-steps,cut-out); common spellings match',
  '      --allow a,b        habits never dealt unless asked: side-by-side (text beside a',
  '                         picture; to one direction at most) and mono (a monospace face)',
  '      --keep ids         the record ids of a direction already chosen: deal the others',
  '                         away from it (re-roll the rest, keep the pick)',
  '      --self-host        also deal faces with no stylesheet URL, or whose licence forbids',
  '                         redistribution (you supply the files; never commit them publicly)',
  '      --history FILE     the project history: lean away from what the last 5 builds used',
  '                         (grounds and shapes: the last build). Never a ban',
  '      --global-history[=FILE]  also read a cross-project history (default',
  '                         ~/.argus/history.json). Off unless given, or ARGUS_GLOBAL_HISTORY',
  '                         is set (a file, or 1 for the default)',
  '      --motion M         still, moment or showpiece (showpiece.md): labels the deal; default',
  `                         showpiece for a ${SHOWPIECE_TRADES.join('/')} trade, else moment.`,
  '                         A showpiece lets picture-led and expressive directions lean louder',
  '      --seed S           repeat a deal; without it the seed comes from the clock',
  '      --json             print the deal as JSON',
  `  list <${LISTS.join('|')}> [--tag X] [--json]`,
  '      One line per entry; --tag keeps entries with a matching class, family, need or fit.',
  '  show <id> [--json]',
  '      Print one entry from any library.',
  '  record --history FILE [--global-history[=FILE]] <ids...>',
  '      Add one build, as BUILT, to the project history: pairing, face, hero, section, ground',
  '      and shape ids (a pairing also records its faces; a hero or section its class). An id',
  '      that is not in the library is reported and never recorded; record a section made for',
  '      this page with a prefix (section:my-panel), which goes into the project history only.',
  '      With --global-history (or ARGUS_GLOBAL_HISTORY) library ids also go into the',
  '      cross-project history.',
].join('\n');

interface Parsed {
  cmd: string;
  rest: string[];
  flags: Record<string, string>;
  bools: Set<string>;
}

const VALUE_FLAGS = ['allow', 'motion', 'n', 'tone', 'taste', 'picture', 'kinds', 'trade', 'kind', 'needs', 'no', 'history', 'seed', 'tag', 'data', 'keep'];
const BOOL_FLAGS = ['json', 'help', 'no-cutout', 'no-global-history', 'self-host', 'video', 'global-history'];

function parseArgs(argv: string[]): Parsed | string {
  const p: Parsed = { cmd: '', rest: [], flags: {}, bools: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (name === 'global-history' && eq > 0) p.flags['global-history'] = a.slice(eq + 1);
      else if (VALUE_FLAGS.includes(name)) {
        const v = eq > 0 ? a.slice(eq + 1) : argv[++i];
        if (v === undefined) return `--${name} needs a value`;
        p.flags[name] = v;
      } else if (name === 'verbs') {
        // Kept so older run files still work: verbs once chose a dealt effect, and effects are no longer dealt.
        if (eq < 0) i++;
      } else if (BOOL_FLAGS.includes(name)) p.bools.add(name);
      else return `unknown option ${a}`;
    } else if (a === '-h') p.bools.add('help');
    else if (!p.cmd) p.cmd = a;
    else p.rest.push(a);
  }
  return p;
}

const csv = (s: string | undefined): string[] => (s ? s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) : []);

/** The cross-project history for this command line, or null when not enabled. */
function globalFor(p: Parsed): string | null {
  if (p.bools.has('no-global-history')) return null;
  return globalHistoryFile(p.flags['global-history'] ?? (p.bools.has('global-history') ? true : undefined));
}

export function main(argv: string[], now: Date = new Date()): number {
  const p = parseArgs(argv);
  if (typeof p === 'string') {
    console.log(p + '\n\n' + USAGE);
    return 1;
  }
  if (p.bools.has('help') || !p.cmd) {
    console.log(USAGE);
    return p.cmd || p.bools.has('help') ? 0 : 1;
  }
  let lib: Library;
  try {
    lib = loadLibrary(p.flags.data ?? dataDir());
  } catch (err) {
    console.log('Cannot read the data files: ' + (err instanceof Error ? err.message : String(err)));
    return 1;
  }
  const json = p.bools.has('json');

  if (p.cmd === 'directions') {
    const tone = (p.flags.tone ?? 'lively') as DealOptions['tone'];
    const taste = (p.flags.taste ?? 'any') as DealOptions['taste'];
    const picture = (p.flags.picture ?? (p.bools.has('video') ? 'video' : null)) as DealOptions['picture'];
    if (!['calm', 'lively', 'bold'].includes(tone)) return fail('--tone is calm, lively or bold');
    if (!['light', 'dark', 'any'].includes(taste)) return fail('--taste is light, dark or any');
    if (picture && !['photographs', 'product', 'type', 'video'].includes(picture)) return fail('--picture is photographs, product, type or video');
    const motion = (p.flags.motion ?? null) as MotionLevel | null;
    if (motion && !['still', 'moment', 'showpiece'].includes(motion)) return fail('--motion is still, moment or showpiece');
    const n = p.flags.n ? Number(p.flags.n) : 3;
    if (!Number.isInteger(n) || n < 1 || n > MAX_DIRECTIONS) return fail(`--n is a whole number from 1 to ${MAX_DIRECTIONS}`);
    const kinds = csv(p.flags.kinds);
    const badKind = kinds.find((k) => !(KINDS as readonly string[]).includes(k));
    if (badKind) return fail(`--kinds takes ${KINDS.join(', ')}; not ${badKind}`);
    let history = emptyHistory();
    try {
      history = readHistory(p.flags.history);
    } catch (err) {
      return fail(`Cannot read the history file ${p.flags.history}: ${err instanceof Error ? err.message : String(err)}`);
    }
    const globalFile = globalFor(p);
    let global = emptyHistory();
    let globalNote = '';
    if (globalFile && path.resolve(globalFile) !== (p.flags.history ? path.resolve(p.flags.history) : '')) {
      try {
        global = readHistory(globalFile);
      } catch (err) {
        globalNote = `The cross-project history ${globalFile} could not be read (${err instanceof Error ? err.message : String(err)}); dealt without it.`;
      }
    }
    const no = csv(p.flags.no);
    if (p.bools.has('no-cutout') && !no.includes('cut-out')) no.push('cut-out');
    const keep = (p.flags.keep ?? '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    const opts: DealOptions = {
      n,
      tone,
      taste,
      picture,
      trade: csv(p.flags.trade ?? p.flags.kind),
      kinds: kinds.length ? (kinds as Kind[]) : null,
      needs: p.flags.needs ? csv(p.flags.needs) : null,
      no,
      seed: p.flags.seed ?? String(now.getTime() % 1000000007),
      selfHost: p.bools.has('self-host'),
      keep,
      motion,
      allow: csv(p.flags.allow),
    };
    const d = deal(lib, opts, history, global);
    if (globalNote) d.notes.push(globalNote);
    if (keep.length) {
      const bad = classify(keep, lib).unknown;
      if (bad.length) d.notes.push(`--keep: not in the library, ignored: ${bad.join(' ')}.`);
    }
    console.log(json ? JSON.stringify(d, null, 2) : printDeal(d, p.flags.history));
    return 0;
  }

  if (p.cmd === 'list') {
    const what = p.rest[0] ?? '';
    const list = rows(lib, what);
    if (!list) return fail(`list what? One of: ${LISTS.join(', ')}${what === 'effects' ? '. Effects are no longer dealt: open assets/snippets/index.html.' : ''}`);
    const tag = p.flags.tag?.toLowerCase();
    const kept = tag ? list.filter((r) => r.id.includes(tag) || r.tags.some((t) => t.toLowerCase().includes(tag))) : list;
    if (json) console.log(JSON.stringify(kept.map((r) => r.entry), null, 2));
    else {
      for (const r of kept) console.log(`${r.id.padEnd(30)} ${r.line}`);
      if (!kept.length) console.log('Nothing matches.');
    }
    return 0;
  }

  if (p.cmd === 'show') {
    const id = p.rest[0];
    if (!id) return fail('show which id?');
    const hit = find(lib, id);
    if (!hit) return fail(`No entry with id ${id}. Try: node deal.js list <${LISTS.join('|')}>`);
    console.log(json ? JSON.stringify(hit.entry, null, 2) : `[${hit.kind}]\n` + showText(hit.entry));
    return 0;
  }

  if (p.cmd === 'record') {
    const file = p.flags.history;
    const globalFile = globalFor(p);
    if (!file && !globalFile) return fail('record needs --history FILE');
    if (!p.rest.length) return fail('record needs at least one id');
    const { add, known, unknown } = classify(p.rest, lib);
    if (unknown.length) console.log(`Not in the library, not recorded: ${unknown.join(' ')}. Check the spelling (deal.js list ...), or record a section made for this page with a prefix: section:${unknown[0]}.`);
    const counts = HISTORY_KINDS.filter((k) => add[k]?.length).map((k) => `${add[k]!.length} ${k}`);
    if (!counts.length) return fail('Nothing to record.');
    const date = localDate(now);
    if (file) {
      let history: History;
      try {
        history = readHistory(file);
      } catch (err) {
        return fail(`Cannot read the history file ${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
      const next = addBuild(history, add, date);
      try {
        writeFileSafely(file, JSON.stringify(next, null, 2) + '\n');
      } catch (err) {
        return fail(`Cannot write the history file ${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
      console.log(`Recorded build ${lastBuild(next)} in ${file}: ${counts.join(', ')}.`);
    }
    // The cross-project history, only when enabled, holds library ids and dates only. Any failure is reported, never fatal.
    if (globalFile && (!file || path.resolve(globalFile) !== path.resolve(file)) && HISTORY_KINDS.some((k) => known[k]?.length)) {
      try {
        let g = emptyHistory();
        try {
          g = readHistory(globalFile);
        } catch {
          console.log(`The cross-project history ${globalFile} was not readable JSON; starting it afresh.`);
        }
        const next = addBuild(g, known, date);
        writeFileSafely(globalFile, JSON.stringify(next, null, 2) + '\n');
        console.log(`Recorded build ${lastBuild(next)} in the cross-project history ${globalFile}.`);
      } catch (err) {
        console.log(`The cross-project history ${globalFile} could not be written (${err instanceof Error ? err.message : String(err)}); skipped.`);
      }
    }
    return 0;
  }

  return fail(`Unknown command ${p.cmd}.\n\n${USAGE}`);
}

function fail(msg: string): number {
  console.log(msg);
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
