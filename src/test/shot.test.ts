import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { toUrl } from '../scripts/shot';

test('a bare localhost address becomes a URL', () => {
  assert.equal(toUrl('localhost:3000'), 'http://localhost:3000');
  assert.equal(toUrl('127.0.0.1:8080/page'), 'http://127.0.0.1:8080/page');
});

test('a full URL is left alone', () => {
  assert.equal(toUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
});

test('an existing file becomes a file URL', () => {
  const url = toUrl(__filename);
  assert.ok(url && url.startsWith('file:///'));
  assert.ok(url.endsWith(path.basename(__filename)));
});

test('a missing file is reported, not guessed', () => {
  assert.equal(toUrl('definitely-not-here-12345.html'), null);
});
