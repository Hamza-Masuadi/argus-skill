import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { RULES } from '../scripts/rules';
import { main } from '../bin/argus';

const source = (name: string): string => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'scripts', name), 'utf8');

/** Rule ids used in a tool's reporting calls. */
function idsIn(text: string, pattern: RegExp): Set<string> {
  const ids = new Set<string>();
  for (const m of text.matchAll(pattern)) if (m[1]) ids.add(m[1]);
  return ids;
}
const used = {
  // check.ts: add('rule-id', severity, element, message)
  check: idsIn(source('check.ts'), /\badd\(\s*'([^']+)'/g),
  // lint.ts: add('P1', 'rule-id', file, line, message)
  lint: idsIn(source('lint.ts'), /\badd\(\s*'(?:P[0-3]|tell)'\s*,\s*'([^']+)'/g),
};

for (const tool of ['check', 'lint'] as const) {
  test(`every rule ${tool} reports is in the catalogue, and nothing else is`, () => {
    const listed = new Set(RULES.filter((r) => r.tool === tool).map((r) => r.id));
    assert.ok(used[tool].size > 0, 'no rule ids found in the source');
    assert.deepEqual([...used[tool]].filter((id) => !listed.has(id)).sort(), [], 'used in source but missing from the catalogue');
    assert.deepEqual([...listed].filter((id) => !used[tool].has(id)).sort(), [], 'in the catalogue but not used in source');
  });
}

test('rule ids are kebab-case and unique within each tool', () => {
  for (const r of RULES) assert.match(r.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, r.id);
  const keys = RULES.map((r) => r.tool + ':' + r.id);
  assert.equal(new Set(keys).size, keys.length);
});

test('every rule has a one-sentence summary and a basis', () => {
  for (const r of RULES) {
    assert.ok(r.summary.trim().endsWith('.'), r.id);
    assert.ok(r.basis.trim().length > 0, r.id);
  }
});

test('the rules command prints the catalogue as JSON', () => {
  const log = console.log;
  let out = '';
  console.log = (s: string) => {
    out += s;
  };
  try {
    assert.equal(main(['rules', '--json']), 0);
  } finally {
    console.log = log;
  }
  assert.equal((JSON.parse(out) as unknown[]).length, RULES.length);
});

test('the length rules match craft.md: 14 screens at 390, 16 at 320, one section at most about 2.5', () => {
  const text = source('check.ts');
  const length = text.slice(text.indexOf("rule('page-length'"), text.indexOf("rule('clipped-text'"));
  assert.match(length, /const limit = narrow \? 16 : 14;/);
  assert.match(length, /narrow \? 700 : vh/);
  assert.match(length, /rule\('section-length'[\s\S]*const limit = 2\.5 \* vh;/);
  const summary = (id: string): string => RULES.find((r) => r.tool === 'check' && r.id === id)?.summary ?? '';
  assert.match(summary('page-length'), /fourteen screens tall at 390.*sixteen 700px screens at 320/);
  assert.match(summary('section-length'), /2\.5 screens/);
  const craft = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'argus', 'references', 'craft.md'), 'utf8');
  assert.match(craft, /over 14 screens/);
  assert.match(craft, /over 16/);
  assert.match(craft, /2\.5 screens/);
});

test('the type, button and picture rules match craft.md and imagery.md', () => {
  const text = source('check.ts');
  const between = (from: string, to: string): string => text.slice(text.indexOf(from), text.indexOf(to));
  assert.match(between("rule('font-families'", "rule('thin-body-text'"), /used\.length > 2\)/);
  const buttons = between("rule('button-styles'", "rule('mixed-pictures'");
  assert.match(buttons, /hi - lo > 8/);
  assert.match(buttons, /median < 32 \|\| median > 64/);
  assert.match(buttons, /40-48px/);
  // Prompts only: none of these may report above P3.
  for (const id of ['font-families', 'button-styles', 'primary-button-height', 'mixed-pictures']) {
    assert.equal(RULES.find((r) => r.tool === 'check' && r.id === id)?.severity, 'P3', id);
    for (const m of text.matchAll(new RegExp("add\\('" + id + "',\\s*'([^']+)'", 'g'))) assert.equal(m[1], 'P3', id);
  }
  const ref = (name: string): string => fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'argus', 'references', name), 'utf8');
  assert.match(ref('craft.md'), /at most two type families/);
  assert.match(ref('craft.md'), /40-48px tall on desktop/);
  assert.match(ref('imagery.md'), /mixed-pictures/);
});

test('check.ts stays one expression with no imports or exports', () => {
  const text = source('check.ts');
  assert.doesNotMatch(text, /^\s*(import|export)\s/m);
  const compiled = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'check.js'), 'utf8');
  assert.doesNotThrow(() => new Function('return ' + compiled.replace(/^"use strict";\s*/, '')));
});

test('rules, inventory and check answer --help with usage and success', () => {
  const log = console.log;
  const lines: string[] = [];
  console.log = (...a: unknown[]) => { lines.push(a.join(' ')); };
  try {
    assert.equal(main(['rules', '--help']), 0);
    assert.equal(main(['inventory', '-h']), 0);
    assert.equal(main(['check', '--help']), 0);
  } finally {
    console.log = log;
  }
  assert.equal(lines.filter((l) => l.startsWith('Usage:')).length, 3);
});

test('the reveal tell reads computed delays, animated properties and stagger custom properties per element', () => {
  const text = source('check.ts');
  const block = text.slice(text.indexOf('// Scroll reveals are part of the motion layer'), text.indexOf("rule('raw-values'"));
  for (const prop of ['transitionDelay', 'animationDelay', 'transitionProperty', 'transitionDuration', 'animationName', "'--i'"]) {
    assert.ok(block.includes(prop), prop);
  }
  assert.match(block, /kinds\.size === 1 && delays\.size === 1 && stagger\.size === 1/);
});

test('competing actions skip skip links and hidden links, and count app-store badges once', () => {
  const text = source('check.ts');
  const block = text.slice(text.indexOf("rule('competing-actions'"), text.indexOf("rule('first-screen-no-action'"));
  assert.match(block, /isSkipLink\(el\) \|\| visuallyHidden\(el\)/);
  assert.match(block, /onFirstScreen\(r\)/);
  assert.ok(block.includes('apps\\.apple\\.com'));
  assert.ok(block.includes('play\\.google\\.com'));
});

test('missing-anchor reports same-page links with no target and skips the likely false alarms', () => {
  const text = source('check.ts');
  const block = text.slice(text.indexOf("rule('missing-anchor'"), text.indexOf('// ---- headings'));
  assert.match(block, /a\[href\^="#"\]/);
  assert.match(block, /getElementById\(id\)/);
  assert.match(block, /\^top\$/); // "#top" scrolls to the top by standard
  assert.match(block, /\^\[\/!\]/); // script routes
  assert.match(block, /aria-controls/);
  assert.match(block, /isVisible\(el\)/);
  const rule = RULES.find((r) => r.tool === 'check' && r.id === 'missing-anchor');
  // A link that goes nowhere: the same severity as dead-link.
  assert.equal(rule?.severity, RULES.find((r) => r.tool === 'check' && r.id === 'dead-link')?.severity);
  for (const m of block.matchAll(/add\('missing-anchor',\s*'([^']+)'/g)) assert.equal(m[1], rule?.severity);
});

test('many-type-sizes leaves out text inside product mock-ups, and the skill tells builders to mark them', () => {
  const text = source('check.ts');
  const block = text.slice(text.indexOf("rule('many-type-sizes'"), text.indexOf("rule('font-families'"));
  assert.ok(block.includes('[data-mock]'));
  assert.ok(block.includes('[role="img"]'));
  assert.ok(block.includes('[aria-hidden="true"]'));
  assert.match(block, /sizes\.size > 12/);
  const ref = (name: string): string => fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'argus', 'references', name), 'utf8');
  for (const name of ['web.md', 'imagery.md', 'verify.md']) assert.match(ref(name), /data-mock/, name);
});

test('the rule counts stated in verify.md and the README match the catalogue', () => {
  const checks = RULES.filter((r) => r.tool === 'check').length;
  const lints = RULES.filter((r) => r.tool === 'lint').length;
  const verify = fs.readFileSync(path.join(__dirname, '..', '..', 'skills', 'argus', 'references', 'verify.md'), 'utf8');
  assert.ok(verify.includes(`It applies ${checks} rules`), 'verify.md check count');
  assert.ok(verify.includes(`with lint's ${lints}, ${RULES.length} in all`), 'verify.md totals');
  const readme = fs.readFileSync(path.join(__dirname, '..', '..', 'README.md'), 'utf8');
  assert.ok(readme.includes(`Lists all ${RULES.length} rules`), 'README total');
});

const shipped = (name: string): string => path.join(__dirname, '..', '..', 'skills', 'argus', 'scripts', name);
const run = (args: string[]): { status: number | null; out: string } => {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
};

test('rules.js run directly prints the catalogue, as JSON with --json, and usage with --help', () => {
  const text = run([shipped('rules.js')]);
  assert.equal(text.status, 0);
  assert.match(text.out, /^check: measured in the rendered page/);
  assert.ok(text.out.trim().endsWith('not failures.'));
  assert.ok(text.out.includes(`${RULES.length} rules in all`));
  const json = run([shipped('rules.js'), '--json']);
  assert.equal(json.status, 0);
  assert.equal((JSON.parse(json.out) as unknown[]).length, RULES.length);
  const help = run([shipped('rules.js'), '--help']);
  assert.equal(help.status, 0);
  assert.match(help.out, /^Usage: node rules\.js \[--json\]/);
  assert.equal(run([shipped('rules.js'), '--nonsense']).status, 1);
});

test('rules.js prints nothing when imported', () => {
  const r = run(['-e', `const m = require(${JSON.stringify(shipped('rules.js'))}); if (!m.RULES.length) process.exit(3);`]);
  assert.equal(r.status, 0);
  assert.equal(r.out, '');
});

for (const name of ['check.js', 'inventory.js']) {
  test(`${name} run directly under Node prints a one-line usage and exits 0`, () => {
    for (const args of [[], ['--help']]) {
      const r = run([shipped(name), ...args]);
      assert.equal(r.status, 0, r.out);
      assert.equal(r.out.trim().split('\n').length, 1, r.out);
      assert.match(r.out, new RegExp('^' + name.replace('.', '\\.') + ' runs inside a rendered page'));
    }
  });
}

test('inventory.ts stays one expression with no imports or exports', () => {
  assert.doesNotMatch(source('inventory.ts'), /^\s*(import|export)\s/m);
  const compiled = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'inventory.js'), 'utf8');
  assert.doesNotThrow(() => new Function('return ' + compiled.replace(/^"use strict";\s*/, '')));
});
