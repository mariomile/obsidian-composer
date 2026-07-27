import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./gutter.ts', import.meta.url), 'utf8');

test('gutter controls expose keyboard button semantics', () => {
  assert.match(source, /role: 'button', tabindex: '0'/);
  assert.match(source, /'keydown'/);
  assert.match(source, /btn\.click\(\)/);
});
