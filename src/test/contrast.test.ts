import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseHex, contrastRatio } from '../scripts/contrast';

test('parses six-digit hex with or without a hash', () => {
  assert.deepEqual(parseHex('#FFFFFF'), [255, 255, 255]);
  assert.deepEqual(parseHex('14233b'), [20, 35, 59]);
});

test('rejects anything that is not six-digit hex', () => {
  assert.equal(parseHex('#fff'), null);
  assert.equal(parseHex('red'), null);
  assert.equal(parseHex(''), null);
});

test('black on white is the maximum ratio, 21 to 1', () => {
  assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255])), 21);
});

test('the ratio does not depend on which colour is the text', () => {
  const a: [number, number, number] = [91, 104, 98];
  const b: [number, number, number] = [255, 255, 255];
  assert.equal(contrastRatio(a, b), contrastRatio(b, a));
});

test('a mid grey on white fails body text', () => {
  assert.ok(contrastRatio([153, 153, 153], [255, 255, 255]) < 4.5);
});
