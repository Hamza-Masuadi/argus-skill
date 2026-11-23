/*
 * Build step. Copies the compiled JavaScript to where it is used: the command
 * into bin/, and the helper scripts into the skill folder, because a skill has
 * to work the moment it is installed, with no build on the user's machine.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(__dirname, '..', '..');
const banner = (source: string): string => `// Generated from ${source} by \`npm run build\`. Edit the TypeScript, not this file.\n`;

function place(from: string, to: string, source: string, executable: boolean): void {
  let code = fs.readFileSync(path.join(root, from), 'utf8');
  if (code.startsWith('#!')) {
    const end = code.indexOf('\n') + 1;
    code = code.slice(0, end) + banner(source) + code.slice(end);
  } else {
    code = banner(source) + code;
  }
  const dest = path.join(root, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, code);
  if (executable) fs.chmodSync(dest, 0o755);
}

place('build/bin/argus.js', 'bin/argus.js', 'src/bin/argus.ts', true);
// rules.js is the rule catalogue; the command reads it from the skill folder for `argus-skill rules`.
for (const name of ['check', 'inventory', 'lint', 'contrast', 'compare', 'shot', 'rules', 'photos']) {
  place(`build/scripts/${name}.js`, `skills/argus/scripts/${name}.js`, `src/scripts/${name}.ts`, false);
}
console.log('Synced bin/argus.js and skills/argus/scripts/*.js');
