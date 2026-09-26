import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { activeHeadingIndex } from './outline-tracking.ts';

describe('activeHeadingIndex', () => {
  const tops = [0, 100, 250, 400];

  it('returns 0 when scrolled to the very top', () => {
    assert.equal(activeHeadingIndex(tops, 0, 20), 0);
  });

  it('returns the last heading at or above scrollTop + offset', () => {
    assert.equal(activeHeadingIndex(tops, 90, 20), 1);
    assert.equal(activeHeadingIndex(tops, 230, 20), 2);
  });

  it('returns the last index when scrolled past everything', () => {
    assert.equal(activeHeadingIndex(tops, 9999, 20), 3);
  });

  it('returns -1 for an empty list', () => {
    assert.equal(activeHeadingIndex([], 0, 20), -1);
  });
});
