import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { lint } from '../scripts/lint';

const page = (head: string, body: string): string =>
  `<html lang="en"><head><meta name="viewport" content="width=device-width">${head}</head><body><h1>Title</h1>${body}</body></html>`;
const rules = (text: string, file = 'index.html'): string[] => lint([{ path: file, text }]).findings.map((f) => f.rule);

test('a clean page reports nothing', () => {
  assert.deepEqual(rules(page('', '<p>Hello there.</p>')), []);
});

test('removing the focus outline with no replacement is flagged', () => {
  assert.ok(rules(page('<style>a:focus{outline:none}</style>', '')).includes('focus-removed'));
});

test('removing the outline is fine when a visible replacement exists', () => {
  const css = '<style>a:focus{outline:none} a:focus-visible{outline:2px solid blue}</style>';
  assert.ok(!rules(page(css, '')).includes('focus-removed'));
});

test('a hover transition alone does not need a reduced-motion rule', () => {
  assert.ok(!rules(page('<style>a{transition:color .2s}</style>', '')).includes('reduced-motion'));
});

test('a keyframe animation with no reduced-motion rule is flagged', () => {
  const css = '<style>@keyframes spin{to{transform:rotate(1turn)}} .x{animation:spin 1s}</style>';
  assert.ok(rules(page(css, '')).includes('reduced-motion'));
});

test('a keyframe animation with a reduced-motion rule passes', () => {
  const css = '<style>@keyframes spin{to{transform:rotate(1turn)}} .x{animation:spin 1s} @media (prefers-reduced-motion: reduce){.x{animation:none}}</style>';
  assert.ok(!rules(page(css, '')).includes('reduced-motion'));
});

test('a field wrapped in its label is not flagged', () => {
  assert.ok(!rules(page('', '<label>Email <input placeholder="you@example.com"></label>')).includes('placeholder-label'));
});

test('a field with only a placeholder is flagged', () => {
  assert.ok(rules(page('', '<input placeholder="Email">')).includes('placeholder-label'));
});

test('a field named by a label elsewhere on the page is not flagged', () => {
  assert.ok(!rules(page('', '<label for="e">Email</label><input id="e" placeholder="you@example.com">')).includes('placeholder-label'));
});

test('a form that opens an email client is flagged', () => {
  assert.ok(rules(page('', '<form action="mailto:hi@example.com"></form>')).includes('form-mailto'));
});

test('text under 12px is flagged, in px and in rem', () => {
  assert.ok(rules(page('<style>.a{font-size:10px}</style>', '')).includes('small-text'));
  assert.ok(rules(page('<style>.a{font-size:.6rem}</style>', '')).includes('small-text'));
  assert.ok(!rules(page('<style>.a{font-size:14px}</style>', '')).includes('small-text'));
});

test('100vh is fine as a fallback before 100dvh', () => {
  assert.ok(!rules(page('<style>.a{min-height:100vh;min-height:100dvh}</style>', '')).includes('vh-units'));
  assert.ok(rules(page('<style>.a{min-height:100vh}</style>', '')).includes('vh-units'));
});

test('blocking zoom is flagged, allowing some zoom is not', () => {
  const blocked = '<html lang="en"><head><meta name="viewport" content="width=device-width, maximum-scale=1"></head><body><h1>x</h1></body></html>';
  const allowed = blocked.replace('maximum-scale=1', 'maximum-scale=1.5');
  assert.ok(rules(blocked).includes('zoom-blocked'));
  assert.ok(!rules(allowed).includes('zoom-blocked'));
});

test('a missing viewport tag and a missing lang are flagged', () => {
  const found = rules('<html><head></head><body><h1>x</h1></body></html>');
  assert.ok(found.includes('viewport-meta'));
  assert.ok(found.includes('lang'));
});

test('an image without alt is flagged in HTML but not guessed at in components', () => {
  assert.ok(rules(page('', '<img src="a.png">')).includes('img-alt'));
  assert.ok(!rules('<img src={a} onLoad={() => go()} alt="x" />', 'Card.tsx').includes('img-alt'));
});

test('findings are ordered most serious first', () => {
  const css = '<style>.a{font-size:10px} a:focus{outline:none}</style>';
  const sevs = lint([{ path: 'index.html', text: page(css, '') }]).findings.map((f) => f.sev);
  assert.deepEqual(sevs, [...sevs].sort((a, b) => ['P1', 'P2', 'tell'].indexOf(a) - ['P1', 'P2', 'tell'].indexOf(b)));
});

test('many colours written out by hand are flagged, tokens are not', () => {
  const hexes = Array.from({ length: 14 }, (_, i) => `.c${i}{color:#${(0x101010 + i * 0x0f0f0f).toString(16).padStart(6, '0')}}`).join('');
  assert.ok(rules(page(`<style>${hexes}</style>`, '')).includes('raw-colours'));
  const tokens = ':root{\n' + Array.from({ length: 14 }, (_, i) => `  --c${i}: #${(0x101010 + i * 0x0f0f0f).toString(16).padStart(6, '0')};`).join('\n') + '\n}';
  assert.ok(!rules(page(`<style>${tokens}</style>`, '')).includes('raw-colours'));
});

test('all-caps text without letter-spacing is flagged', () => {
  assert.ok(rules(page('<style>.k{text-transform:uppercase}</style>', '')).includes('caps-tracking'));
  assert.ok(!rules(page('<style>.k{text-transform:uppercase;letter-spacing:.08em}</style>', '')).includes('caps-tracking'));
  assert.ok(!rules(page('<style>.k{letter-spacing:.08em;text-transform:uppercase}</style>', '')).includes('caps-tracking'));
});
