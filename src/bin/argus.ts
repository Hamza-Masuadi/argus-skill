#!/usr/bin/env node
/*
 * Argus command. Installs the skill and runs its helper tools.
 *
 * Installing only copies the skill folder into the place each AI coding tool
 * reads skills from: no downloads, no network calls, no hooks, no settings
 * changes, no prompts. The tools make no network calls either, except
 * `photos`, which searches free-licence image sources (or, with `photos add`,
 * reads the Unsplash or Pexels photo pages it is given), and only when it is run.
 *
 *   npx argus-skill install            install into this project
 *   npx argus-skill install --global   install for your user account
 *   npx argus-skill install --tools=claude,cursor
 *   npx argus-skill update             replace an existing install
 *   npx argus-skill uninstall
 *   npx argus-skill list               show supported tools and where each reads skills
 *
 * Tools: shot, check, inventory, lint, rules, photos, deal.
 * shot and check take --tap and --hover to reach a sheet, a later screen or a hover state before
 * capturing or checking, and --reduced-motion; shot takes --frames and --scroll-frames;
 * check and lint take --app for app prototypes.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const SKILL = 'argus';

const exists = (p: string): boolean => {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
};

/** The skill folder that ships next to this command, wherever the command is run from. */
function findSource(): string {
  let dir = __dirname;
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(dir, 'skills', SKILL);
    if (exists(path.join(candidate, 'SKILL.md'))) return candidate;
    dir = path.dirname(dir);
  }
  return path.join(__dirname, '..', 'skills', SKILL);
}
const SOURCE = findSource();

export interface Tool {
  id: string;
  name: string;
  /** Folder, relative to a project, that the tool reads skills from. */
  project: string;
  /** Folder, relative to the home folder, for an account-wide install. */
  global: string;
  /** Folders whose presence suggests the tool is in use. */
  marks: string[];
}

export const TOOLS: readonly Tool[] = [
  { id: 'claude', name: 'Claude Code', project: '.claude/skills', global: '.claude/skills', marks: ['.claude'] },
  { id: 'agents', name: 'Codex, Amp and the shared .agents convention', project: '.agents/skills', global: '.agents/skills', marks: ['.agents', '.codex'] },
  { id: 'cursor', name: 'Cursor', project: '.cursor/skills', global: '.cursor/skills', marks: ['.cursor'] },
  { id: 'gemini', name: 'Gemini CLI', project: '.gemini/skills', global: '.gemini/skills', marks: ['.gemini'] },
  { id: 'copilot', name: 'GitHub Copilot / VS Code', project: '.github/skills', global: '.copilot/skills', marks: ['.copilot'] },
  { id: 'kiro', name: 'Kiro', project: '.kiro/skills', global: '.kiro/skills', marks: ['.kiro'] },
  { id: 'opencode', name: 'OpenCode', project: '.opencode/skills', global: '.config/opencode/skills', marks: ['.opencode', '.config/opencode'] },
  { id: 'grok', name: 'Grok', project: '.grok/skills', global: '.grok/skills', marks: ['.grok'] },
  { id: 'devin', name: 'Devin / Windsurf', project: '.devin/skills', global: '.config/devin/skills', marks: ['.devin', '.windsurf', '.config/devin'] },
];

const ALIASES: Record<string, string> = { codex: 'agents', amp: 'agents', vscode: 'copilot', github: 'copilot', windsurf: 'devin', 'claude-code': 'claude' };
const DEFAULTS = ['claude', 'agents'];
/** Helper scripts that run through this command. */
const HELPERS: Record<string, string> = { lint: 'lint.js', shot: 'shot.js', photos: 'photos.js', deal: 'deal.js' };

type Command = 'install' | 'update' | 'uninstall' | 'list' | 'help';

export interface Options {
  cmd: string | null;
  global: boolean;
  tools: string[] | null;
  all: boolean;
  force: boolean;
  dry: boolean;
  bad: string[];
}

export function parse(argv: string[]): Options {
  const o: Options = { cmd: null, global: false, tools: null, all: false, force: false, dry: false, bad: [] };
  for (const a of argv) {
    if (a === '--global' || a === '-g') o.global = true;
    else if (a === '--project') o.global = false;
    else if (a === '--all') o.all = true;
    else if (a === '--force' || a === '-f') o.force = true;
    else if (a === '--dry-run') o.dry = true;
    else if (a === '--help' || a === '-h') o.cmd = 'help';
    else if (a.startsWith('--tools=')) o.tools = a.slice(8).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    else if (a.startsWith('-')) o.bad.push(a);
    else if (!o.cmd) o.cmd = a;
    else o.bad.push(a);
  }
  return o;
}

/** Decide which tools to act on. Returns the names it did not recognise instead of a list when any are unknown. */
export function chooseTools(o: Pick<Options, 'all' | 'tools'>, root: string): { tools: Tool[]; unknown: string[] } {
  if (o.all) return { tools: [...TOOLS], unknown: [] };
  if (o.tools) {
    const picked: Tool[] = [];
    const unknown: string[] = [];
    for (const raw of o.tools) {
      const id = ALIASES[raw] ?? raw;
      const tool = TOOLS.find((t) => t.id === id);
      if (!tool) unknown.push(raw);
      else if (!picked.includes(tool)) picked.push(tool);
    }
    return { tools: picked, unknown };
  }
  const found = TOOLS.filter((t) => t.marks.some((m) => exists(path.join(root, m))));
  return { tools: found.length ? found : TOOLS.filter((t) => DEFAULTS.includes(t.id)), unknown: [] };
}

export function destFor(tool: Tool, global: boolean, root: string): string {
  return path.join(root, global ? tool.global : tool.project, SKILL);
}

/** Only ever delete a folder that is exactly <something>/skills/argus. */
export function safeToRemove(dir: string): boolean {
  return path.basename(dir) === SKILL && path.basename(path.dirname(dir)) === 'skills';
}

function copyDir(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else if (entry.isFile()) fs.copyFileSync(a, b);
  }
}

function help(): void {
  console.log(
    [
      'Argus: a design skill for AI coding agents. This command installs it and runs its tools.',
      '',
      'Install:',
      '  npx argus-skill install [options]   install (keeps an existing copy unless --force)',
      '  npx argus-skill update [options]    replace an existing install with this version',
      '  npx argus-skill uninstall [options] remove it',
      '  npx argus-skill list                show supported tools and their folders',
      '',
      'Tools (the same scripts the skill uses):',
      '  npx argus-skill shot <url-or-file> [--full] [--wait MS]  screenshots at phone and desktop widths',
      '  npx argus-skill check <url-or-file>            run the checker in a real browser at each width',
      '      shot and check also take --height N, --scheme light|dark, --reduced-motion, --tap TARGET',
      '      and --hover TARGET (repeatable: tap, or move the mouse onto, a CSS selector or text=Label',
      '      first, to reach a sheet or later screen or a hover state) and (check) --app for app',
      '      prototypes. shot also takes --frames N [--every MS] (screenshots in quick succession,',
      '      to see arrivals and loops) and --scroll-frames N (screenshots down the page)',
      '  npx argus-skill inventory <url-or-file>        measure the design system a page actually uses',
      '  npx argus-skill inventory <new> --against <old>  list what a new page uses that an existing page does not',
      '  npx argus-skill lint <file-or-folder> [--app]  scan source for common design slips (--app: an',
      '      app prototype, where one h1 per hash-routed screen is fine)',
      '  npx argus-skill rules [--json]                 list every rule check and lint apply',
      '  npx argus-skill deal directions --n 3 --tone calm|lively|bold [--trade W] [--history FILE]',
      '      deal design directions (hero, type pairing, ground, shape, sections) that differ',
      '      from each other and from the history; also deal list <library> [--tag X], deal show <id>,',
      '      deal record --history FILE <ids...>; deal --help for every option',
      '  npx argus-skill photos "<words>" [--count N]   find and download free-licence photographs, with credits',
      '      also --orientation, --min-width N, --best, --source LIST (stocksnap, rawpixel, wikimedia,',
      '      europeana, cleveland, met, nasa, smithsonian...), --creator NAME, --page N; set',
      '      PEXELS_API_KEY or PIXABAY_API_KEY to search Pexels or Pixabay as well',
      '  npx argus-skill photos add <photo-page-url>... [--out DIR] [--width N]',
      '      take photographs you chose on unsplash.com or pexels.com: reads each page\'s',
      '      photographer and image, downloads it N pixels wide (default 2000), adds credits',
      '  npx argus-skill photos series <unsplash-or-pexels-url> --out DIR   one photographer\'s set',
      '  npx argus-skill photos sheet|grade|deliver|cutout ...   contact sheet, one grade for the set,',
      '      page-ready AVIF/WebP/JPEG with <picture> markup, background removal (photos <cmd> --help)',
      '',
      'The installer and these tools make no network calls, except photos, which searches',
      'Openverse and Wikimedia Commons (and Pexels when PEXELS_API_KEY is set), or reads the',
      'Unsplash and Pexels pages given to photos add or series, and only when you run it.',
      '',
      'Install options:',
      '  --global           install for your user account instead of this project',
      '  --tools=a,b        choose tools: ' + TOOLS.map((t) => t.id).join(', '),
      '  --all              every supported tool',
      '  --force            replace an existing copy',
      '  --dry-run          show what would happen and change nothing',
      '',
      'With no --tools, it installs for the tools it finds in the project (or your home',
      'folder with --global). If it finds none, it installs for Claude Code and the shared',
      '.agents folder, which between them cover most tools.',
    ].join('\n'),
  );
}

function runHelper(script: string, args: string[]): number {
  const run = spawnSync(process.execPath, [path.join(SOURCE, 'scripts', script), ...args], { stdio: 'inherit' });
  return run.status ?? 1;
}

/** Print the rule catalogue, grouped by tool. It ships as a script in the skill folder. */
function printRules(args: string[]): number {
  const file = path.join(SOURCE, 'scripts', 'rules.js');
  if (!exists(file)) {
    console.log('Cannot find the rule catalogue next to this command (' + file + ').');
    return 1;
  }
  return (require(file) as typeof import('../scripts/rules')).main(args, 'npx argus-skill rules');
}

/**
 * Run the command. `home` and `cwd` are parameters so tests can point them at
 * temporary folders.
 */
export function main(raw: string[], home: string = os.homedir(), cwd: string = process.cwd()): number {
  const first = raw[0] ?? '';
  const helper = HELPERS[first];
  if (helper) return runHelper(helper, raw.slice(1));
  const wantsHelp = raw.slice(1).some((a) => a === '--help' || a === '-h');
  if (first === 'inventory') {
    if (raw.length < 2 || wantsHelp) {
      console.log('Usage: npx argus-skill inventory <url-or-file> [--against <existing-page>]');
      console.log('Measures the fonts, sizes, colours, radii and control heights a rendered page uses.');
      console.log('With --against, prints only what the first page uses that the second does not.');
      return wantsHelp ? 0 : 1;
    }
    return runHelper('shot.js', [...raw.slice(1), '--inventory', '--no-shots', '--widths', '1440']);
  }
  if (first === 'rules') return printRules(raw.slice(1));
  if (first === 'check') {
    if (wantsHelp) {
      console.log('Usage: npx argus-skill check [<url-or-file> [--widths LIST] [--height N] [--scheme light|dark] [--reduced-motion] [--tap TARGET]... [--hover TARGET]... [--app]]');
      console.log('With a page: runs the checker in a real browser at each width and prints the findings.');
      console.log('With none: prints the checker script, to evaluate in a browser tool or the devtools console.');
      console.log('  --height N      viewport height in CSS pixels at every width');
      console.log('  --scheme S      light or dark: emulate prefers-color-scheme (default: follow this computer)');
      console.log('  --tap TARGET    tap a CSS selector, or text=Label (a visible button, link or tab), before');
      console.log('                  checking, with real mouse events; repeat to tap several in order. A target');
      console.log('                  that is not found stops with an error naming it; one hidden until it scrolls');
      console.log('                  into view is given 2s to show');
      console.log('  --hover TARGET  move the real mouse onto TARGET (same syntax as --tap) before checking;');
      console.log('                  runs in order with --tap');
      console.log('  --reduced-motion  emulate prefers-reduced-motion: reduce');
      console.log('At 1024px and wider the check also reads the page\'s flow: blank-band, lopsided-section and');
      console.log('repeated-layout.');
      console.log('  --app           the page is an app prototype (hash-routed screens, modal sheets): relaxes');
      console.log('                  the web-page rules that misfire there (open sheets and their scrim, drawn');
      console.log('                  status bars, floating tab bars, 10px tab labels, lists of cards, focus rings');
      console.log('                  on a row, pictures for a 2x screen) and prints which. For the printed');
      console.log('                  script, set window.__argusCheckOptions = { app: true } before evaluating it.');
      return 0;
    }
    // With a page to check, run the checker in a real browser. With none, print
    // it so it can be pasted into a browser console or evaluated by a browser tool.
    if (raw.length > 1) return runHelper('shot.js', [...raw.slice(1), '--check', '--no-shots']);
    process.stdout.write(fs.readFileSync(path.join(SOURCE, 'scripts', 'check.js'), 'utf8'));
    return 0;
  }

  const o = parse(raw);
  if (o.bad.length) {
    console.log('Not understood: ' + o.bad.join(' ') + '\n');
    help();
    return 1;
  }
  if (!o.cmd || o.cmd === 'help') {
    help();
    return o.cmd ? 0 : 1;
  }
  if (!['install', 'update', 'uninstall', 'list'].includes(o.cmd)) {
    console.log('Unknown command: ' + o.cmd + '\n');
    help();
    return 1;
  }
  const cmd = o.cmd as Command;

  if (cmd === 'list') {
    console.log('Tool'.padEnd(64) + 'In a project'.padEnd(20) + 'With --global');
    for (const t of TOOLS) console.log(`${t.id}  (${t.name})`.padEnd(64) + t.project.padEnd(20) + '~/' + t.global);
    return 0;
  }
  if (cmd === 'update') o.force = true;

  if (cmd !== 'uninstall' && !exists(path.join(SOURCE, 'SKILL.md'))) {
    console.log('Cannot find the skill files next to this command (' + SOURCE + ').');
    return 1;
  }

  // Run from the home folder, there is no project: the right place is the
  // account-wide folders, which differ from the project ones for some tools.
  const fromHome = !o.global && path.resolve(cwd) === path.resolve(home);
  if (fromHome) o.global = true;
  const root = o.global ? home : cwd;
  const { tools, unknown } = chooseTools(o, root);
  if (unknown.length) {
    console.log('Unknown tool: ' + unknown.join(', ') + '. Run "npx argus-skill list" to see the names.');
    return 1;
  }

  const where = o.global ? 'your user account' : `this project (${root})`;
  let failed = false;
  let changed = 0;
  if (fromHome) console.log('You are in your home folder, so this applies to your user account (the same as --global).');
  console.log((o.dry ? 'Dry run. ' : '') + (cmd === 'uninstall' ? 'Removing Argus from ' : 'Installing Argus into ') + where + '\n');

  for (const tool of tools) {
    const dest = destFor(tool, o.global, root);
    const shown = (o.global ? '~/' + path.relative(home, dest) : path.relative(root, dest)) || dest;
    const label = (tool.id + ':').padEnd(10);
    try {
      if (cmd === 'uninstall') {
        if (!exists(dest)) {
          console.log(`  ${label}not installed  ${shown}`);
          continue;
        }
        if (!safeToRemove(dest)) {
          console.log(`  ${label}refused, unexpected path  ${shown}`);
          failed = true;
          continue;
        }
        if (!o.dry) fs.rmSync(dest, { recursive: true, force: true });
        console.log(`  ${label}removed  ${shown}`);
        changed++;
        continue;
      }
      if (exists(dest)) {
        if (!o.force) {
          console.log(`  ${label}already there, left as is  ${shown}  (use "update" to replace)`);
          continue;
        }
        if (!safeToRemove(dest)) {
          console.log(`  ${label}refused, unexpected path  ${shown}`);
          failed = true;
          continue;
        }
        if (!o.dry) fs.rmSync(dest, { recursive: true, force: true });
      }
      if (!o.dry) copyDir(SOURCE, dest);
      console.log(`  ${label}${o.force ? 'updated' : 'installed'}  ${shown}`);
      changed++;
    } catch (err) {
      console.log(`  ${label}failed  ${shown}  (${err instanceof Error ? err.message : String(err)})`);
      failed = true;
    }
  }

  if (cmd !== 'uninstall' && changed && !o.dry) {
    console.log('\nDone. Start a new session in your tool, then ask for design work or type /argus.');
    if (!o.global) console.log('These folders are part of your project; commit them to share the skill with your team.');
  }
  if (o.dry) console.log('\nNothing was changed.');
  return failed ? 2 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
