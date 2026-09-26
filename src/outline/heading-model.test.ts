import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CachedMetadata } from 'obsidian';
import { normalizeHeadings, tickGeometry } from './heading-model.ts';

describe('normalizeHeadings', () => {
  it('maps cache headings to {text, level, line}', () => {
    const cache = {
      headings: [
        { heading: 'Intro', level: 1, position: { start: { line: 0 } } },
        { heading: 'Details', level: 2, position: { start: { line: 5 } } },
      ],
    } as unknown as CachedMetadata;
    assert.deepEqual(normalizeHeadings(cache), [
      { text: 'Intro', level: 1, line: 0 },
      { text: 'Details', level: 2, line: 5 },
    ]);
  });

  it('returns [] when cache is null or has no headings', () => {
    assert.deepEqual(normalizeHeadings(null), []);
    assert.deepEqual(normalizeHeadings({} as CachedMetadata), []);
  });
});

describe('tickGeometry', () => {
  it('makes deeper headings shorter and dimmer, clamped at level 6', () => {
    const h1 = tickGeometry(1);
    const h3 = tickGeometry(3);
    assert.ok(h1.width > h3.width);
    assert.ok(h1.opacity > h3.opacity);
    assert.ok(tickGeometry(6).width > 0);
    assert.equal(tickGeometry(99).width, tickGeometry(6).width);
    assert.ok(tickGeometry(1).opacity <= 1);
  });
});
