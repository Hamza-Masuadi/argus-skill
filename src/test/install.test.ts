import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { main, chooseTools, safeToRemove, parse } from '../bin/argus';

/** A throwaway home folder with a project inside it. */
function sandbox(): { home: string; project: string } {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-test-'));
  const project = path.join(home, 'project');
  fs.mkdirSync(project);
  return { home, project };
}
const has = (...parts: string[]): boolean => fs.existsSync(path.join(...parts, 'SKILL.md'));
const quiet = <T>(fn: () => T): T => {
  const log = console.log;
  console.log = () => undefined;
  try {
    return fn();
  } finally {
    console.log = log;
  }
};

test('in a project with no tools set up, it installs for Claude Code and the shared folder', () => {
  const { home, project } = sandbox();
  assert.equal(quiet(() => main(['install'], home, project)), 0);
  assert.ok(has(project, '.claude', 'skills', 'argus'));
  assert.ok(has(project, '.agents', 'skills', 'argus'));
});

test('it installs only for the tools it finds in the project', () => {
  const { home, project } = sandbox();
  fs.mkdirSync(path.join(project, '.cursor'));
  quiet(() => main(['install'], home, project));
  assert.ok(has(project, '.cursor', 'skills', 'argus'));
  assert.ok(!has(project, '.claude', 'skills', 'argus'));
});

test('the installed copy has the scripts and references', () => {
  const { home, project } = sandbox();
  quiet(() => main(['install', '--tools=claude'], home, project));
  const base = path.join(project, '.claude', 'skills', 'argus');
  for (const f of ['scripts/check.js', 'scripts/shot.js', 'references/brief.md', 'assets/compare.html']) {
    assert.ok(fs.existsSync(path.join(base, f)), f + ' should be installed');
  }
});

test('run from the home folder, it installs account-wide and puts Copilot in the right place', () => {
  const { home } = sandbox();
  fs.mkdirSync(path.join(home, '.copilot'));
  assert.equal(quiet(() => main(['install'], home, home)), 0);
  assert.ok(has(home, '.copilot', 'skills', 'argus'));
  assert.ok(!fs.existsSync(path.join(home, '.github')), 'must not create ~/.github');
});

test('--global uses the account-wide folder for tools where it differs', () => {
  const { home, project } = sandbox();
  quiet(() => main(['install', '--global', '--tools=opencode,devin'], home, project));
  assert.ok(has(home, '.config', 'opencode', 'skills', 'argus'));
  assert.ok(has(home, '.config', 'devin', 'skills', 'argus'));
});

test('install leaves an existing copy alone; update replaces it', () => {
  const { home, project } = sandbox();
  quiet(() => main(['install', '--tools=claude'], home, project));
  const marker = path.join(project, '.claude', 'skills', 'argus', 'mine.txt');
  fs.writeFileSync(marker, 'local note');
  quiet(() => main(['install', '--tools=claude'], home, project));
  assert.ok(fs.existsSync(marker), 'install must not overwrite');
  quiet(() => main(['update', '--tools=claude'], home, project));
  assert.ok(!fs.existsSync(marker), 'update replaces the folder');
  assert.ok(has(project, '.claude', 'skills', 'argus'));
});

test('uninstall removes it, and only it', () => {
  const { home, project } = sandbox();
  quiet(() => main(['install', '--tools=claude'], home, project));
  const other = path.join(project, '.claude', 'skills', 'other');
  fs.mkdirSync(other);
  assert.equal(quiet(() => main(['uninstall', '--tools=claude'], home, project)), 0);
  assert.ok(!fs.existsSync(path.join(project, '.claude', 'skills', 'argus')));
  assert.ok(fs.existsSync(other), 'a neighbouring skill must survive');
});

test('--dry-run changes nothing', () => {
  const { home, project } = sandbox();
  assert.equal(quiet(() => main(['install', '--dry-run'], home, project)), 0);
  assert.deepEqual(fs.readdirSync(project), []);
});

test('an unknown tool or command is an error and changes nothing', () => {
  const { home, project } = sandbox();
  assert.equal(quiet(() => main(['install', '--tools=emacs'], home, project)), 1);
  assert.equal(quiet(() => main(['frobnicate'], home, project)), 1);
  assert.deepEqual(fs.readdirSync(project), []);
});

test('tool aliases resolve', () => {
  const picked = chooseTools({ all: false, tools: ['codex', 'windsurf', 'vscode'] }, os.tmpdir());
  assert.deepEqual(picked.tools.map((t) => t.id), ['agents', 'devin', 'copilot']);
  assert.deepEqual(picked.unknown, []);
});

test('it will only ever delete a folder that is exactly skills/argus', () => {
  assert.ok(safeToRemove(path.join('x', '.claude', 'skills', 'argus')));
  assert.ok(!safeToRemove(path.join('x', '.claude', 'skills')));
  assert.ok(!safeToRemove(path.join('x', 'argus')));
  assert.ok(!safeToRemove(path.join('x', 'skills', 'other')));
});

test('options are parsed', () => {
  const o = parse(['install', '--global', '--tools=Claude, cursor', '--force']);
  assert.equal(o.cmd, 'install');
  assert.ok(o.global && o.force);
  assert.deepEqual(o.tools, ['claude', 'cursor']);
  assert.deepEqual(parse(['install', '--nope']).bad, ['--nope']);
});
