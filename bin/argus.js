#!/usr/bin/env node
// Generated from src/bin/argus.ts by `npm run build`. Edit the TypeScript, not this file.
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOLS = void 0;
exports.parse = parse;
exports.chooseTools = chooseTools;
exports.destFor = destFor;
exports.safeToRemove = safeToRemove;
exports.main = main;
/*
 * Argus command. Installs the skill and runs its helper tools.
 *
 * Installing only copies the skill folder into the place each AI coding tool
 * reads skills from: no downloads, no network calls, no hooks, no settings
 * changes, no prompts. The tools make no network calls either, except
 * `photos`, which searches free-licence image sources, and only when it is run.
 *
 *   npx argus-skill install            install into this project
 *   npx argus-skill install --global   install for your user account
 *   npx argus-skill install --tools=claude,cursor
 *   npx argus-skill update             replace an existing install
 *   npx argus-skill uninstall
 *   npx argus-skill list               show supported tools and where each reads skills
 *
 * Tools: shot, check, inventory, lint, contrast, compare, rules, photos.
 */
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
const SKILL = 'argus';
const exists = (p) => {
    try {
        fs.accessSync(p);
        return true;
    }
    catch {
        return false;
    }
};
/** The skill folder that ships next to this command, wherever the command is run from. */
function findSource() {
    let dir = __dirname;
    for (let i = 0; i < 4; i++) {
        const candidate = path.join(dir, 'skills', SKILL);
        if (exists(path.join(candidate, 'SKILL.md')))
            return candidate;
        dir = path.dirname(dir);
    }
    return path.join(__dirname, '..', 'skills', SKILL);
}
const SOURCE = findSource();
exports.TOOLS = [
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
const ALIASES = { codex: 'agents', amp: 'agents', vscode: 'copilot', github: 'copilot', windsurf: 'devin', 'claude-code': 'claude' };
const DEFAULTS = ['claude', 'agents'];
/** Helper scripts that run through this command. */
const HELPERS = { lint: 'lint.js', contrast: 'contrast.js', shot: 'shot.js', compare: 'compare.js', photos: 'photos.js' };
function parse(argv) {
    const o = { cmd: null, global: false, tools: null, all: false, force: false, dry: false, bad: [] };
    for (const a of argv) {
        if (a === '--global' || a === '-g')
            o.global = true;
        else if (a === '--project')
            o.global = false;
        else if (a === '--all')
            o.all = true;
        else if (a === '--force' || a === '-f')
            o.force = true;
        else if (a === '--dry-run')
            o.dry = true;
        else if (a === '--help' || a === '-h')
            o.cmd = 'help';
        else if (a.startsWith('--tools='))
            o.tools = a.slice(8).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
        else if (a.startsWith('-'))
            o.bad.push(a);
        else if (!o.cmd)
            o.cmd = a;
        else
            o.bad.push(a);
    }
    return o;
}
/** Decide which tools to act on. Returns the names it did not recognise instead of a list when any are unknown. */
function chooseTools(o, root) {
    if (o.all)
        return { tools: [...exports.TOOLS], unknown: [] };
    if (o.tools) {
        const picked = [];
        const unknown = [];
        for (const raw of o.tools) {
            const id = ALIASES[raw] ?? raw;
            const tool = exports.TOOLS.find((t) => t.id === id);
            if (!tool)
                unknown.push(raw);
            else if (!picked.includes(tool))
                picked.push(tool);
        }
        return { tools: picked, unknown };
    }
    const found = exports.TOOLS.filter((t) => t.marks.some((m) => exists(path.join(root, m))));
    return { tools: found.length ? found : exports.TOOLS.filter((t) => DEFAULTS.includes(t.id)), unknown: [] };
}
function destFor(tool, global, root) {
    return path.join(root, global ? tool.global : tool.project, SKILL);
}
/** Only ever delete a folder that is exactly <something>/skills/argus. */
function safeToRemove(dir) {
    return path.basename(dir) === SKILL && path.basename(path.dirname(dir)) === 'skills';
}
function copyDir(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        if (entry.name === '.DS_Store')
            continue;
        const a = path.join(from, entry.name);
        const b = path.join(to, entry.name);
        if (entry.isDirectory())
            copyDir(a, b);
        else if (entry.isFile())
            fs.copyFileSync(a, b);
    }
}
function help() {
    console.log([
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
        '  npx argus-skill inventory <url-or-file>        measure the design system a page actually uses',
        '  npx argus-skill inventory <new> --against <old>  list what a new page uses that an existing page does not',
        '  npx argus-skill lint <file-or-folder>          scan source for common design slips',
        '  npx argus-skill contrast "#text/#background"   check colour contrast',
        '  npx argus-skill compare <before> <after>       build a before-and-after page from two screenshots',
        '  npx argus-skill rules [--json]                 list every rule check and lint apply',
        '  npx argus-skill photos "<words>" [--count N]   find and download free-licence photographs, with credits',
        '',
        'The installer and these tools make no network calls, except photos, which searches',
        'Openverse and Wikimedia Commons, and only when you run it.',
        '',
        'Install options:',
        '  --global           install for your user account instead of this project',
        '  --tools=a,b        choose tools: ' + exports.TOOLS.map((t) => t.id).join(', '),
        '  --all              every supported tool',
        '  --force            replace an existing copy',
        '  --dry-run          show what would happen and change nothing',
        '',
        'With no --tools, it installs for the tools it finds in the project (or your home',
        'folder with --global). If it finds none, it installs for Claude Code and the shared',
        '.agents folder, which between them cover most tools.',
    ].join('\n'));
}
function runHelper(script, args) {
    const run = (0, node_child_process_1.spawnSync)(process.execPath, [path.join(SOURCE, 'scripts', script), ...args], { stdio: 'inherit' });
    return run.status ?? 1;
}
/** Print the rule catalogue, grouped by tool. It ships as a script in the skill folder. */
function printRules(args) {
    const file = path.join(SOURCE, 'scripts', 'rules.js');
    if (!exists(file)) {
        console.log('Cannot find the rule catalogue next to this command (' + file + ').');
        return 1;
    }
    return require(file).main(args, 'npx argus-skill rules');
}
/**
 * Run the command. `home` and `cwd` are parameters so tests can point them at
 * temporary folders.
 */
function main(raw, home = os.homedir(), cwd = process.cwd()) {
    const first = raw[0] ?? '';
    const helper = HELPERS[first];
    if (helper)
        return runHelper(helper, raw.slice(1));
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
    if (first === 'rules')
        return printRules(raw.slice(1));
    if (first === 'check') {
        if (wantsHelp) {
            console.log('Usage: npx argus-skill check [<url-or-file> [--widths LIST]]');
            console.log('With a page: runs the checker in a real browser at each width and prints the findings.');
            console.log('With none: prints the checker script, to evaluate in a browser tool or the devtools console.');
            return 0;
        }
        // With a page to check, run the checker in a real browser. With none, print
        // it so it can be pasted into a browser console or evaluated by a browser tool.
        if (raw.length > 1)
            return runHelper('shot.js', [...raw.slice(1), '--check', '--no-shots']);
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
    const cmd = o.cmd;
    if (cmd === 'list') {
        console.log('Tool'.padEnd(64) + 'In a project'.padEnd(20) + 'With --global');
        for (const t of exports.TOOLS)
            console.log(`${t.id}  (${t.name})`.padEnd(64) + t.project.padEnd(20) + '~/' + t.global);
        return 0;
    }
    if (cmd === 'update')
        o.force = true;
    if (cmd !== 'uninstall' && !exists(path.join(SOURCE, 'SKILL.md'))) {
        console.log('Cannot find the skill files next to this command (' + SOURCE + ').');
        return 1;
    }
    // Run from the home folder, there is no project: the right place is the
    // account-wide folders, which differ from the project ones for some tools.
    const fromHome = !o.global && path.resolve(cwd) === path.resolve(home);
    if (fromHome)
        o.global = true;
    const root = o.global ? home : cwd;
    const { tools, unknown } = chooseTools(o, root);
    if (unknown.length) {
        console.log('Unknown tool: ' + unknown.join(', ') + '. Run "npx argus-skill list" to see the names.');
        return 1;
    }
    const where = o.global ? 'your user account' : `this project (${root})`;
    let failed = false;
    let changed = 0;
    if (fromHome)
        console.log('You are in your home folder, so this applies to your user account (the same as --global).');
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
                if (!o.dry)
                    fs.rmSync(dest, { recursive: true, force: true });
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
                if (!o.dry)
                    fs.rmSync(dest, { recursive: true, force: true });
            }
            if (!o.dry)
                copyDir(SOURCE, dest);
            console.log(`  ${label}${o.force ? 'updated' : 'installed'}  ${shown}`);
            changed++;
        }
        catch (err) {
            console.log(`  ${label}failed  ${shown}  (${err instanceof Error ? err.message : String(err)})`);
            failed = true;
        }
    }
    if (cmd !== 'uninstall' && changed && !o.dry) {
        console.log('\nDone. Start a new session in your tool, then ask for design work or type /argus.');
        if (!o.global)
            console.log('These folders are part of your project; commit them to share the skill with your team.');
    }
    if (o.dry)
        console.log('\nNothing was changed.');
    return failed ? 2 : 0;
}
if (require.main === module)
    process.exit(main(process.argv.slice(2)));
