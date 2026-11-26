import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expandNo, deal, loadLibrary, dataDir, readHistory, classify, addBuild, emptyHistory, main, printDeal, kindsFor, heroClass, sectionClass, globalHistoryFile, localDate, GROUNDS, SHAPES, KINDS, SERIF_CLASSES, HISTORY_KINDS, loudPairing, motionFor, type DealOptions } from '../scripts/deal';

// The cross-project history is off unless enabled: make sure nothing in the environment enables it.
delete process.env.ARGUS_GLOBAL_HISTORY;

const DATA = dataDir();
const lib = loadLibrary(DATA);
const opts = (o: Partial<DealOptions> = {}): DealOptions => ({ n: 3, tone: 'lively', taste: 'any', picture: null, trade: [], kinds: null, needs: null, no: [], seed: '1', ...o });
const faceById = new Map(lib.faces.map((f) => [f.id, f]));
const seeds = (n: number, prefix = 's'): string[] => Array.from({ length: n }, (_, i) => prefix + i);

/** Run the command line, capturing what it prints. */
function cli(args: string[], now?: Date): { code: number; out: string } {
  const log = console.log;
  let out = '';
  console.log = (...a: unknown[]) => { out += a.join(' ') + '\n'; };
  try {
    return { code: main(args, now), out };
  } finally {
    console.log = log;
  }
}
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'argus-deal-'));

// ---- the data files ------------------------------------------------------------

test('the three data files are valid JSON with the expected counts, and no effects files remain', () => {
  assert.ok(lib.faces.length >= 60, 'faces');
  assert.ok(lib.pairings.length >= 30, 'pairings');
  assert.ok(lib.heroes.length >= 30, 'heroes');
  assert.ok(lib.sections.length >= 30, 'sections');
  assert.ok(!fs.existsSync(path.join(DATA, 'effects.pointer.json')));
  assert.ok(!fs.existsSync(path.join(DATA, 'effects.scroll.json')));
});

test('every id is unique within its file and across the libraries', () => {
  const all = [...lib.faces, ...lib.pairings, ...lib.heroes, ...lib.sections, ...lib.nav, ...lib.footers, ...GROUNDS, ...SHAPES].map((x) => x.id);
  const dup = all.filter((id, i) => all.indexOf(id) !== i);
  // A face and its one-family pairing may not share an id; nothing else repeats either.
  assert.deepEqual(dup, []);
});

test('every pairing references existing faces and never joins two faces of one classification', () => {
  for (const p of lib.pairings) {
    const d = faceById.get(p.display);
    const t = faceById.get(p.text);
    assert.ok(d && t, p.id);
    if (p.display !== p.text) assert.notEqual(d.classification, t.classification, p.id);
  }
});

test('faces carry a load route and a licence; faces that may not be redistributed are marked selfHostOnly with an official URL', () => {
  for (const f of lib.faces) {
    assert.ok(f.load.css || f.load.files, f.id);
    assert.ok(f.licence, f.id);
    if (/no redistribution/i.test(f.licence)) {
      assert.equal(f.selfHostOnly, true, f.id);
      assert.match(f.load.css ?? '', /^https:\/\/api\.fontshare\.com\//, f.id);
    } else assert.ok(!f.selfHostOnly, f.id);
  }
  assert.ok(lib.faces.filter((f) => f.selfHostOnly).length >= 10);
});

test('pairing blurbs describe the type only, never a trade', () => {
  const trades = /\b(patient|menu|menus|bakery|bakeries|cafe|diner|job names|bill|racing|firm|food-truck|arcade|council|order tickets|shopfront)\b/i;
  for (const p of lib.pairings) assert.doesNotMatch(p.why, trades, p.id);
});

test('heroes and sections carry the fields the dealer reads; avoid and loud are well formed', () => {
  for (const h of lib.heroes) {
    assert.ok(h.kinds?.length && h.needs.length && h.layout && h.fails, h.id);
    assert.ok(heroClass(h), h.id);
    if (h.avoid) assert.ok(Array.isArray(h.avoid), h.id);
  }
  for (const s of lib.sections) {
    assert.ok(s.fits.length && sectionClass(s), s.id);
    if (s.avoid) assert.ok(s.avoid.length, s.id);
  }
  assert.ok(lib.heroes.some((h) => h.loud) && lib.sections.some((s) => s.loud));
});

// ---- dealing -------------------------------------------------------------------

test('the same seed deals the same directions; another seed deals others', () => {
  const a = deal(lib, opts({ seed: 'x' }));
  const b = deal(lib, opts({ seed: 'x' }));
  assert.deepEqual(a.directions.map((d) => d.record), b.directions.map((d) => d.record));
  const others = seeds(10).map((s) => deal(lib, opts({ seed: s })).directions.map((d) => d.record.join(' ')).join('|'));
  assert.ok(new Set(others).size > 5);
});

test('three directions: one of each kind, never sharing a hero, a structure class, a face or a shape', () => {
  for (const seed of seeds(60)) {
    const d = deal(lib, opts({ seed }));
    assert.deepEqual(d.directions.map((x) => x.kind), [...KINDS]);
    const heroes = d.directions.map((x) => x.hero.id);
    const classes = d.directions.map((x) => heroClass(x.hero));
    assert.equal(new Set(heroes).size, 3, seed);
    assert.equal(new Set(classes).size, 3, `${seed}: ${classes.join(',')}`);
    const faces = d.directions.flatMap((x) => [...new Set([x.faces.display.id, x.faces.text.id, x.faces.accent?.id].filter(Boolean))]);
    assert.equal(new Set(faces).size, faces.length, seed);
    assert.equal(new Set(d.directions.map((x) => x.shape.id)).size, 3, seed);
  }
});

test('ground families differ across three directions, and at most one pairs a light ground with a serif display', () => {
  for (const tone of ['calm', 'lively', 'bold'] as const) {
    for (const seed of seeds(80, tone)) {
      const d = deal(lib, opts({ seed, tone }));
      const families = d.directions.map((x) => x.ground.family);
      assert.ok(new Set(families).size >= 2, `${tone} ${seed}: ${families.join(',')}`);
      const lightSerif = d.directions.filter((x) => x.ground.family === 'light' && SERIF_CLASSES.includes(x.faces.display.classification));
      assert.ok(lightSerif.length <= 1, `${tone} ${seed}: ${lightSerif.map((x) => x.pairing.id).join(',')}`);
    }
  }
  // An owner whose taste is light still gets only one light ground with a serif display.
  for (const seed of seeds(40, 'light')) {
    const d = deal(lib, opts({ seed, taste: 'light' }));
    assert.ok(d.directions.every((x) => x.ground.family === 'light'));
    assert.ok(d.directions.filter((x) => SERIF_CLASSES.includes(x.faces.display.classification)).length <= 1, seed);
  }
});

test('overused faces, faces with no stylesheet and selfHostOnly faces are never dealt by default; --self-host allows the last two', () => {
  const blocked = new Set(lib.faces.filter((f) => f.overused || !f.load.css || f.selfHostOnly).map((f) => f.id));
  let selfHostSeen = false;
  for (const seed of seeds(80)) {
    for (const x of deal(lib, opts({ seed })).directions) for (const f of [x.faces.display, x.faces.text, x.faces.accent]) if (f) assert.ok(!blocked.has(f.id), f.id);
    for (const x of deal(lib, opts({ seed, selfHost: true })).directions) {
      for (const f of [x.faces.display, x.faces.text, x.faces.accent]) {
        if (f) assert.ok(!f.overused, f.id);
        if (f?.selfHostOnly) selfHostSeen = true;
      }
    }
  }
  assert.ok(selfHostSeen, 'with --self-host a selfHostOnly face can be dealt');
});

test('a calm tone never deals a loud hero, pairing, ground or section', () => {
  for (const seed of seeds(80)) {
    for (const x of deal(lib, opts({ seed, tone: 'calm' })).directions) {
      assert.ok(!x.hero.loud, x.hero.id);
      assert.ok(!loudPairing(x.pairing, x.faces.display), x.pairing.id);
      assert.ok(!x.ground.loud, x.ground.id);
      for (const s of x.sections) assert.ok(!s.loud, s.id);
    }
  }
});

test('trade fit is a hard filter: a bakery never gets a comparison table, a spec sheet or the editorial cover; a clinic never a configurator', () => {
  for (const seed of seeds(80)) {
    for (const x of deal(lib, opts({ seed, trade: ['bakery'] })).directions) {
      const ids = x.sections.map((s) => s.id);
      assert.ok(!ids.includes('comparison-table') && !ids.includes('spec-sheet') && !ids.includes('calculator'), ids.join(','));
      assert.notEqual(x.hero.id, 'editorial-cover');
      for (const s of x.sections) assert.ok(!(s.avoid ?? []).includes('bakery'), s.id);
    }
    for (const x of deal(lib, opts({ seed, trade: ['clinic'] })).directions) {
      assert.ok(!x.sections.some((s) => s.id === 'configurator' || s.id === 'marquee'));
      assert.ok(!(x.hero.avoid ?? []).includes('clinic'), x.hero.id);
    }
  }
});

test('--no filters heroes, sections, pairings, grounds and shapes by id, word, class or family', () => {
  for (const seed of seeds(40)) {
    const d = deal(lib, opts({ seed, no: ['dark', 'serif', 'sticky-steps', 'cut-out', 'square', 'marquee'] }));
    for (const x of d.directions) {
      assert.notEqual(x.ground.family, 'dark');
      assert.ok(!SERIF_CLASSES.includes(x.faces.display.classification) && !SERIF_CLASSES.includes(x.faces.text.classification), x.pairing.id);
      assert.ok(!x.hero.needs.includes('cut-out'), x.hero.id);
      assert.notEqual(x.shape.id, 'square');
      for (const s of x.sections) assert.ok(sectionClass(s) !== 'sticky-steps' && s.id !== 'marquee', s.id);
    }
  }
});

test('--no matches common spellings: stacking-cards, sticky, split', () => {
  assert.ok(expandNo(['Stacking cards']).includes('stacked-cards'));
  assert.ok(expandNo(['sticky']).includes('sticky-steps'));
  assert.ok(expandNo(['split']).includes('side-by-side'));
  for (const seed of seeds(40)) {
    for (const x of deal(lib, opts({ seed, tone: 'bold', no: ['stacking-cards', 'sticky', 'split'] })).directions) {
      assert.notEqual(x.hero.id, 'stacked-cards');
      assert.notEqual(heroClass(x.hero), 'side-by-side', x.hero.id);
      for (const s of x.sections) assert.ok(sectionClass(s) !== 'sticky-steps' && s.family !== 'split', s.id);
    }
  }
});

test('constraints: --picture product deals no photo hero, --taste light deals only light grounds, --taste dark none', () => {
  for (const seed of seeds(30)) {
    for (const x of deal(lib, opts({ seed, picture: 'product' })).directions) assert.ok(x.hero.modes.includes('product'), x.hero.id);
    for (const x of deal(lib, opts({ seed, taste: 'light' })).directions) assert.equal(x.ground.family, 'light');
    for (const x of deal(lib, opts({ seed, taste: 'dark' })).directions) assert.notEqual(x.ground.family, 'light');
  }
});

test('three directions are minimal, picture-led and expressive in order; --kinds and the tone choose otherwise', () => {
  assert.deepEqual(kindsFor({ n: 3, tone: 'lively', kinds: null }, 3), ['minimal', 'picture-led', 'expressive']);
  assert.deepEqual(kindsFor({ n: 1, tone: 'calm', kinds: null }, 1), ['minimal']);
  assert.deepEqual(kindsFor({ n: 1, tone: 'bold', kinds: null }, 1), ['expressive']);
  assert.deepEqual(kindsFor({ n: 2, tone: 'lively', kinds: ['expressive'] }, 2), ['expressive', 'expressive']);
  assert.deepEqual(deal(lib, opts({ picture: 'type' })).directions.map((x) => x.kind), ['minimal', 'expressive', 'expressive']);
});

test('a trade that sells being there: the picture-led direction opens full-bleed and the print says so; software is never dealt video unless asked', () => {
  let fullBleed = 0;
  for (const seed of seeds(30)) {
    const d = deal(lib, opts({ seed, trade: ['hotel'] }));
    const pic = d.directions.find((x) => x.kind === 'picture-led')!;
    if (heroClass(pic.hero) === 'full-bleed') fullBleed++;
    for (const x of deal(lib, opts({ seed, trade: ['saas'] })).directions) assert.ok(!x.hero.needs.includes('video'), x.hero.id);
  }
  assert.ok(fullBleed >= 25, `${fullBleed}`);
  assert.match(printDeal(deal(lib, opts({ seed: '3', trade: ['hotel'] }))), /Opening/);
});

test('--keep deals the others away from a kept direction: never its hero, structure class, faces or ground family', () => {
  for (const seed of seeds(40)) {
    const first = deal(lib, opts({ seed })).directions[0]!;
    const again = deal(lib, opts({ seed: seed + 'r', n: 2, kinds: ['picture-led', 'expressive'], keep: first.record }));
    for (const x of again.directions) {
      assert.notEqual(x.hero.id, first.hero.id);
      assert.notEqual(heroClass(x.hero), heroClass(first.hero));
      for (const f of [x.faces.display, x.faces.text]) assert.ok(![first.faces.display.id, first.faces.text.id].includes(f.id));
    }
    assert.match(again.notes.join(' '), /Kept:/);
  }
});

test('the printed first-screen rules agree with first-screen.md: about five groups, the checker prompts above seven, proof only when given', () => {
  const rules = deal(lib, opts()).rules.join(' ');
  assert.match(rules, /About five groups/);
  assert.match(rules, /hero-crowded prompts above seven/);
  assert.match(rules, /when the owner gave proof/);
  const card = fs.readFileSync(path.join(DATA, '..', '..', 'references', 'first-screen.md'), 'utf8');
  assert.match(card, /About five groups/);
  assert.match(card, /prompts above seven/);
  // No printed rule forces a size, a crop or an overlap.
  assert.doesNotMatch(rules, /must overlap|crop to|at \d+px tall/i);
});

test('the deal prints no effects, no absolute install path, and a record line that record accepts as printed', () => {
  const d = deal(lib, opts({ seed: '7' }));
  const text = printDeal(d, '.argus/history.json');
  assert.doesNotMatch(text, /signature|hover on|reveals|centrepiece|effects\.pointer/i);
  assert.doesNotMatch(text, new RegExp(__dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const line = /Record +deal\.js record --history \S+ (.+)/.exec(text)?.[1] ?? '';
  const { add, unknown } = classify(line.split(' '), lib);
  assert.deepEqual(unknown, []);
  assert.ok(add.pairings?.length && add.heroes?.length && add.grounds?.length && add.shapes?.length && add.sections?.length);
});

// ---- history -------------------------------------------------------------------

test('the history is a soft preference: recent items are dealt less often, never ruled out', () => {
  let h = emptyHistory();
  const used = deal(lib, opts({ seed: 'h' })).directions[0]!;
  h = addBuild(h, classify(used.record, lib).add, '2026-11-01');
  let same = 0;
  let sameWithout = 0;
  for (const seed of seeds(120, 'h')) {
    if (deal(lib, opts({ seed }), h).directions[0]!.hero.id === used.hero.id) same++;
    if (deal(lib, opts({ seed })).directions[0]!.hero.id === used.hero.id) sameWithout++;
  }
  assert.ok(same < sameWithout, `${same} vs ${sameWithout}`);
});

test('record and directions --history round-trip through a file; the date is the local date', () => {
  const dir = tmp();
  try {
    const file = path.join(dir, 'history.json');
    const now = new Date(2026, 10, 26, 0, 30);
    const r = cli(['record', '--history', file, 'quiet-statement', 'plain-white', 'softened', 'index-strip'], now);
    assert.equal(r.code, 0, r.out);
    const h = readHistory(file);
    assert.equal(h.heroes[0]?.id, 'quiet-statement');
    assert.equal(h.heroes[0]?.date, '2026-11-26');
    assert.equal(localDate(now), '2026-11-26');
    assert.ok(h.structures.some((e) => e.id.startsWith('hero/')));
    assert.equal(cli(['directions', '--history', file, '--seed', '1']).code, 0);
    for (const k of HISTORY_KINDS) assert.ok(Array.isArray(h[k]));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('record rejects ids that are not in the library and writes nothing for them; a prefixed section made for the page goes to the project only', () => {
  const dir = tmp();
  const globalFile = path.join(dir, 'global.json');
  try {
    const file = path.join(dir, 'history.json');
    const bad = cli(['record', '--history', file, 'quiet-statment', 'plain-wite']);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /Not in the library, not recorded: quiet-statment plain-wite/);
    assert.ok(!fs.existsSync(file));
    const mixed = cli(['record', '--history', file, `--global-history=${globalFile}`, 'quiet-statement', 'typo-here', 'section:my-own-panel']);
    assert.equal(mixed.code, 0, mixed.out);
    const h = readHistory(file);
    assert.deepEqual(h.sections.map((e) => e.id), ['my-own-panel']);
    assert.ok(!JSON.stringify(h).includes('typo-here'));
    const g = readHistory(globalFile);
    assert.deepEqual(g.heroes.map((e) => e.id), ['quiet-statement']);
    assert.ok(!JSON.stringify(g).includes('my-own-panel') && !JSON.stringify(g).includes('typo-here'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the cross-project history is opt-in: nothing is read or written outside the project unless enabled', () => {
  const home = tmp();
  const dir = tmp();
  const oldHome = process.env.HOME;
  const oldProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    assert.equal(globalHistoryFile(undefined, undefined), null);
    assert.equal(globalHistoryFile(undefined, ''), null);
    assert.equal(globalHistoryFile(undefined, '0'), null);
    assert.equal(globalHistoryFile('/x/h.json', undefined), '/x/h.json');
    assert.equal(globalHistoryFile(true, undefined), path.join(os.homedir(), '.argus', 'history.json'));
    assert.equal(globalHistoryFile(undefined, '/y/h.json'), '/y/h.json');
    assert.equal(globalHistoryFile(undefined, '1'), path.join(os.homedir(), '.argus', 'history.json'));
    const file = path.join(dir, 'history.json');
    assert.equal(cli(['record', '--history', file, 'quiet-statement']).code, 0);
    assert.ok(!fs.existsSync(path.join(home, '.argus')), 'nothing written to the home folder');
    assert.equal(cli(['record', '--history', file, '--global-history', 'letter']).code, 0);
    assert.equal(os.homedir(), home);
    assert.ok(fs.existsSync(path.join(home, '.argus', 'history.json')), 'written when enabled');
  } finally {
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = oldProfile;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an old history with effects entries still reads; the effects are ignored', () => {
  const dir = tmp();
  try {
    const file = path.join(dir, 'h.json');
    fs.writeFileSync(file, JSON.stringify({ heroes: [{ id: 'letter', date: '2026-11-01', build: 1 }], effects: [{ id: 'cursor-torch', date: '2026-11-01', build: 1 }] }));
    const h = readHistory(file);
    assert.equal(h.heroes.length, 1);
    assert.ok(!('effects' in h));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the command line ----------------------------------------------------------

test('the command line: --help, list, show, --json, and --n outside 1-6 is an error', () => {
  assert.match(cli(['--help']).out, /Usage: node deal\.js/);
  assert.match(cli(['list', 'heroes', '--tag', 'minimal']).out, /quiet-statement/);
  assert.match(cli(['list', 'fonts', '--tag', 'self-host-only']).out, /no redistribution/);
  const effects = cli(['list', 'effects']);
  assert.equal(effects.code, 1);
  assert.match(effects.out, /no longer dealt/);
  assert.match(cli(['show', 'switzer']).out, /selfHostOnly/);
  const json = cli(['directions', '--json', '--seed', '2']);
  assert.equal((JSON.parse(json.out) as { directions: unknown[] }).directions.length, 3);
  for (const n of ['9', '0', '2.5', 'x']) {
    const r = cli(['directions', '--n', n]);
    assert.equal(r.code, 1, n);
    assert.match(r.out, /--n is a whole number from 1 to 6/);
  }
  assert.equal(cli(['directions', '--trad', 'x']).code, 1);
  // Older run files may still pass --verbs; it is accepted and ignored.
  assert.equal(cli(['directions', '--verbs', 'pour', '--seed', '1']).code, 0);
});

// ---- the motion level ------------------------------------------------------------

test('--motion: the level comes from the trade unless asked, labels the deal, and prints one line pointing to showpiece.md', () => {
  assert.equal(motionFor(['studio']), 'showpiece');
  assert.equal(motionFor(['fashion', 'retail']), 'showpiece');
  assert.equal(motionFor(['portfolios']), 'showpiece');
  assert.equal(motionFor(['clinic']), 'moment');
  assert.equal(motionFor([]), 'moment');
  assert.equal(motionFor(['clinic'], 'showpiece'), 'showpiece');
  assert.equal(motionFor(['studio'], 'moment'), 'moment');
  assert.equal(deal(lib, opts({ trade: ['agency'] })).motion, 'showpiece');
  assert.equal(deal(lib, opts({ trade: ['bakery'] })).motion, 'moment');
  const show = cli(['directions', '--trade', 'studio', '--seed', '1']);
  assert.equal(show.code, 0);
  assert.equal(show.out.split('\n').filter((l) => /showpiece\.md/.test(l)).length, 1);
  assert.match(show.out, /Motion level: showpiece \(from the trade\)/);
  assert.match(cli(['directions', '--trade', 'bakery', '--seed', '1']).out, /Motion level: moment \(from the trade\)/);
  assert.match(cli(['directions', '--trade', 'bakery', '--motion', 'showpiece', '--seed', '1']).out, /Motion level: showpiece\. /);
  const bad = cli(['directions', '--motion', 'loud']);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /--motion is still, moment or showpiece/);
});

test('--motion showpiece leans picture-led and expressive directions to louder heroes; minimal and calm are untouched', () => {
  const loudHeroes = (motion: 'moment' | 'showpiece', tone: DealOptions['tone'] = 'lively'): { other: number; minimal: number } => {
    let other = 0;
    let minimal = 0;
    for (const seed of seeds(60, 'm')) {
      for (const x of deal(lib, opts({ seed, motion, tone, trade: ['studio'] })).directions) {
        if (!x.hero.loud) continue;
        if (x.kind === 'minimal') minimal++;
        else other++;
      }
    }
    return { other, minimal };
  };
  const moment = loudHeroes('moment');
  const show = loudHeroes('showpiece');
  assert.ok(show.other > moment.other, `${show.other} loud heroes under showpiece, ${moment.other} under moment`);
  assert.equal(show.minimal, moment.minimal);
  assert.deepEqual(loudHeroes('showpiece', 'calm'), { other: 0, minimal: 0 });
});

test('a set never deals the side-by-side hero or sticky-step sections to more than one direction', () => {
  for (const trade of [[], ['bakery'], ['clinic', 'dentist'], ['studio'], ['saas'], ['hotel']]) {
    for (const tone of ['calm', 'lively', 'bold'] as const) {
      for (const seed of seeds(25, trade.join('-') + tone)) {
        const d = deal(lib, opts({ seed, tone, trade }));
        const splits = d.directions.filter((x) => heroClass(x.hero) === 'side-by-side').length;
        const sticky = d.directions.filter((x) => x.sections.some((s) => sectionClass(s) === 'sticky-steps')).length;
        assert.ok(splits <= 1, `${seed}: ${splits} side-by-side heroes`);
        assert.ok(sticky <= 1, `${seed}: ${sticky} directions with sticky steps`);
      }
    }
  }
  // --keep with a sticky-step section: the re-dealt others get none.
  const sticky = lib.sections.find((s) => sectionClass(s) === 'sticky-steps')!;
  for (const seed of seeds(15, 'keep')) {
    const d = deal(lib, opts({ seed, n: 2, keep: ['calm-split', sticky.id] }));
    for (const x of d.directions) {
      assert.notEqual(heroClass(x.hero), 'side-by-side', seed);
      assert.ok(!x.sections.some((s) => sectionClass(s) === 'sticky-steps'), seed);
    }
  }
});

test('every hero the dealer can deal has build guidance: deal.js show <id> gives its layout, build and failure, and first-screen.md says where to look', () => {
  for (const h of lib.heroes) {
    const r = cli(['show', h.id]);
    assert.equal(r.code, 0, h.id);
    for (const field of ['layout:', 'build:', 'fails:']) assert.match(r.out, new RegExp('^' + field, 'm'), `${h.id} has no ${field}`);
  }
  const card = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'argus', 'references', 'first-screen.md'), 'utf8');
  assert.match(card, /deal\.js show <hero id>/);
  const heroesMd = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'argus', 'references', 'heroes.md'), 'utf8');
  for (const section of ['Picture and type', 'Full-bleed openings', 'Cut-outs', 'Type-led heroes']) {
    assert.ok(card.includes(section), `first-screen.md names heroes.md "${section}"`);
    assert.ok(heroesMd.includes('## ' + section), section);
  }
});

// ---- habits dealt only when asked ------------------------------------------------

const TRADES = [[], ['bakery'], ['clinic', 'dentist'], ['studio'], ['saas'], ['hotel'], ['defence', 'technology', 'engineering'], ['legal'], ['plumber'], ['restaurant'], ['menus']];
const PICTURES = [null, 'photographs', 'product', 'type', 'video'] as const;

test('no side-by-side first screen is dealt to any direction unless asked, across trades, tones, pictures and seeds', () => {
  const splits = lib.heroes.filter((h) => heroClass(h) === 'side-by-side').map((h) => h.id).sort();
  assert.deepEqual(splits, ['calm-split', 'split-colour-fields', 'split-device-straddle', 'stacked-cards', 'sticky-index']);
  for (const trade of TRADES) for (const tone of ['calm', 'lively', 'bold'] as const) for (const picture of PICTURES) {
    for (const seed of seeds(8, trade.join('-') + tone + picture)) {
      for (const n of [1, 3, 5]) {
        const d = deal(lib, opts({ seed, tone, trade, picture, n }));
        for (const x of d.directions) assert.notEqual(heroClass(x.hero), 'side-by-side', `${seed} ${x.hero.id}`);
      }
      const asked = deal(lib, opts({ seed, tone, trade, picture, needs: ['full-bleed-photo', 'photo-set', 'cut-out'] }));
      for (const x of asked.directions) assert.notEqual(heroClass(x.hero), 'side-by-side', `needs alone: ${seed} ${x.hero.id}`);
    }
  }
});

test('--allow side-by-side or --needs form-in-hero deals a side-by-side first screen to one direction at most, and sometimes to one', () => {
  let dealt = 0;
  for (const trade of TRADES) for (const tone of ['calm', 'lively', 'bold'] as const) {
    for (const seed of seeds(10, 'allow' + trade.join('-') + tone)) {
      for (const o of [{ allow: ['side-by-side'] }, { allow: ['split'] }, { needs: ['form-in-hero', 'full-bleed-photo'] }]) {
        const d = deal(lib, opts({ seed, tone, trade, n: 5, ...o }));
        const n = d.directions.filter((x) => heroClass(x.hero) === 'side-by-side').length;
        assert.ok(n <= 1, `${seed}: ${n}`);
        dealt += n;
      }
    }
  }
  assert.ok(dealt > 50, `side-by-side dealt ${dealt} times when asked`);
  const r = cli(['directions', '--allow', 'side-by-side', '--seed', '3']);
  assert.equal(r.code, 0);
  assert.doesNotMatch(r.out, /No side-by-side first screen was dealt/);
  assert.match(cli(['directions', '--seed', '3']).out, /No side-by-side first screen was dealt/);
});

test('the minimal kind never runs dry of heroes without the split, for every common trade and picture mode', () => {
  for (const trade of TRADES) for (const picture of PICTURES) for (const tone of ['calm', 'lively', 'bold'] as const) {
    for (const seed of seeds(6, 'dry' + trade.join('-') + picture + tone)) {
      const d = deal(lib, opts({ seed, tone, trade, picture, kinds: ['minimal'], n: 1 }));
      const x = d.directions[0]!;
      assert.ok((x.hero.kinds ?? []).includes('minimal'), `${trade} ${picture} ${tone}: ${x.hero.id}`);
      assert.ok(!d.notes.some((nt) => /No hero (of kind|fits)/.test(nt)), d.notes.join(' | '));
    }
  }
  for (const id of ['quiet-field', 'centred-frame']) assert.ok(lib.heroes.find((h) => h.id === id)?.kinds?.includes('minimal'), id);
});

test('a monospace face is never dealt by default: no mono text face, and a pairing\'s mono third face is left out unless asked', () => {
  const mono = (id?: string): boolean => !!id && faceById.get(id)?.classification === 'mono';
  let leftOut = 0;
  for (const trade of TRADES) for (const tone of ['calm', 'lively', 'bold'] as const) {
    for (const seed of seeds(10, 'mono' + trade.join('-') + tone)) {
      const d = deal(lib, opts({ seed, tone, trade, n: 5 }));
      for (const x of d.directions) {
        assert.ok(![x.faces.display.id, x.faces.text.id, x.faces.accent?.id].some(mono), `${seed}: ${x.pairing.id}`);
        if (x.pairing.accent && mono(x.pairing.accent)) leftOut++;
      }
    }
  }
  assert.ok(leftOut > 0, 'pairings with a mono third face are still dealt, without it');
  let kept = 0;
  for (const seed of seeds(40, 'code')) for (const x of deal(lib, opts({ seed, n: 5, needs: ['code', 'full-bleed-photo'] })).directions) if (mono(x.faces.accent?.id)) kept++;
  assert.ok(kept > 0, '--needs code keeps the mono third face');
});

test('the minimal direction\'s ground varies across light, mid, dark and colour families unless --taste says otherwise', () => {
  const families = new Map<string, number>();
  for (const seed of seeds(200, 'ground')) {
    const x = deal(lib, opts({ seed, tone: 'calm' })).directions.find((dir) => dir.kind === 'minimal')!;
    families.set(x.ground.family ?? '', (families.get(x.ground.family ?? '') ?? 0) + 1);
  }
  for (const f of ['light', 'mid', 'dark', 'colour']) assert.ok((families.get(f) ?? 0) >= 20, `${f}: ${families.get(f) ?? 0} of 200`);
  for (const seed of seeds(30, 'light')) {
    const x = deal(lib, opts({ seed, taste: 'light' })).directions.find((dir) => dir.kind === 'minimal')!;
    assert.equal(x.ground.family, 'light', seed);
  }
});
