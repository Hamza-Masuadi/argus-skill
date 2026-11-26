/*
 * The habit rules: a small label over most section headings (eyebrow, once per page), an
 * auto-numbered grid of equal cards (numbered-grid) and a page where nothing moves
 * (motionless-page), run through the shipped shot.js in a real browser on a page with all three
 * and a clean page. Skipped when no Chrome-family browser is installed.
 */
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findBrowser } from '../scripts/shot';
import { RULES } from '../scripts/rules';

const root = path.join(__dirname, '..', '..');
const shot = path.join(root, 'skills', 'argus', 'scripts', 'shot.js');
const fixture = (name: string): string => path.join(root, 'src', 'test', 'fixtures', name);
const skip = findBrowser() ? false : 'no Chrome-family browser installed';

const run = (file: string): string => spawnSync(process.execPath, [shot, file, '--check', '--no-shots', '--widths', '1440'], { encoding: 'utf8', timeout: 120000 }).stdout;
const lines = (out: string, id: string): string[] => out.split('\n').filter((l) => l.endsWith('[' + id + ']'));
const habit = (out: string): string[] => lines(out, 'eyebrow').filter((l) => /^\s*P3/.test(l));

function withPage(html: string, fn: (file: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-habits-'));
  try {
    fs.writeFileSync(path.join(dir, 'page.html'), html);
    fn(path.join(dir, 'page.html'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the habit rules are advisory, in the catalogue, and point at faults.md or motion.md', () => {
  const r = (id: string) => RULES.find((x) => x.tool === 'check' && x.id === id);
  assert.equal(r('eyebrow')?.severity, 'P3');
  assert.equal(r('numbered-grid')?.severity, 'P3');
  assert.equal(r('motionless-page')?.severity, 'P2');
  for (const id of ['eyebrow', 'numbered-grid', 'motionless-page']) assert.equal(r(id)?.tier, 'advisory', id);
  const faults = fs.readFileSync(path.join(root, 'skills', 'argus', 'references', 'faults.md'), 'utf8');
  assert.match(faults, /The habitual set/);
});

test('each habit rule reports on the page that has it, once, saying what to do', { skip }, () => {
  const out = run(fixture('habits-faults.html'));
  assert.equal(habit(out).length, 1, out);
  assert.match(habit(out)[0]!, /4 of 4 section headings have a small label directly above them.*Drop them unless/);
  assert.equal(lines(out, 'numbered-grid').length, 1, out);
  assert.match(lines(out, 'numbered-grid')[0]!, /4 equal cards numbered 01, 02, 03, 04/);
  assert.equal(lines(out, 'motionless-page').length, 1, out);
  assert.match(lines(out, 'motionless-page')[0]!, /data-argus-motion="still"/);
});

test('no habit rule reports on the clean page', { skip }, () => {
  const out = run(fixture('habits-good.html'));
  assert.match(out, /Check at 1440px/);
  assert.deepEqual(habit(out), []);
  assert.deepEqual(lines(out, 'numbered-grid'), []);
  assert.deepEqual(lines(out, 'motionless-page'), []);
});

test('motionless-page: the owner\'s "still" is exempt; motion only under reduced motion, or a colour change alone, still counts as none', { skip }, () => {
  const base = fs.readFileSync(fixture('habits-faults.html'), 'utf8');
  withPage(base.replace('<html lang="en">', '<html lang="en" data-argus-motion="still">'), (file) => {
    assert.deepEqual(lines(run(file), 'motionless-page'), []);
  });
  const reducedOnly = base.replace('</style>', '@media (prefers-reduced-motion: reduce) { .button { transition: opacity .2s; } }</style>');
  withPage(reducedOnly, (file) => assert.equal(lines(run(file), 'motionless-page').length, 1));
  // A reveal written as a transition on transform counts as motion.
  withPage(base.replace('</style>', '.card { transition: transform .3s ease-out; } .card:hover { transform: translateY(-4px); }</style>'), (file) => {
    assert.deepEqual(lines(run(file), 'motionless-page'), []);
  });
});

test('numbered-grid: steps stacked in one column, or cards whose numbers are not a count from 1, are not reported', { skip }, () => {
  const base = fs.readFileSync(fixture('habits-faults.html'), 'utf8');
  withPage(base.replace('grid-template-columns: repeat(4, 1fr)', 'grid-template-columns: 1fr'), (file) => {
    assert.deepEqual(lines(run(file), 'numbered-grid'), []);
  });
  withPage(base.replace('>01<', '>12<').replace('>02<', '>40<').replace('>03<', '>7<').replace('>04<', '>3<'), (file) => {
    assert.deepEqual(lines(run(file), 'numbered-grid'), []);
  });
});
