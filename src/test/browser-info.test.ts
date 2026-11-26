/*
 * Names the browser every *-browser test runs in (its path and the version it reports), once, in the
 * test output, so a failure on another machine or on CI can be traced to the browser behind it.
 * Skipped when no Chrome-family browser is installed, as the browser tests are.
 */
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { findBrowser, stopBrowser } from '../scripts/shot';

const browser = findBrowser();
const skip = browser ? false : 'no Chrome-family browser installed';

test('the browser the browser tests use starts headless and reports its version', { skip }, async (t) => {
  const port = await new Promise<number>((r) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => r(p));
    });
  });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-info-'));
  const child = spawn(browser ?? '', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let info: { Browser?: string; 'User-Agent'?: string } = {};
    for (let i = 0; i < 100 && !info.Browser; i++) {
      try {
        info = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as typeof info;
      } catch {
        if (child.exitCode !== null) break;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    const line = `browser: ${browser} (${info.Browser ?? 'did not report a version'})` + (process.env['ARGUS_BROWSER'] ? ', chosen by ARGUS_BROWSER' : '');
    t.diagnostic(line);
    console.log('# ' + line);
    assert.ok(info.Browser, 'the browser started headless and answered on its debugging port');
  } finally {
    await stopBrowser(child, profile);
  }
});
