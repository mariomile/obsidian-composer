import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterItems } from './menu-core.ts';

const items = [
  { label: 'Table', section: 'Basic', keywords: ['grid'] },
  { label: 'New Base', section: 'Base', keywords: ['database'] },
  { label: 'Note embed', section: 'Embed', keywords: ['wikilink'] },
];

describe('filterItems', () => {
  it('empty query returns all', () => {
    assert.equal(filterItems(items, '  ').length, 3);
  });
  it('matches label case-insensitively', () => {
    assert.deepEqual(filterItems(items, 'tab').map((i) => i.label), ['Table']);
  });
  it('matches keywords and section', () => {
    assert.deepEqual(filterItems(items, 'database').map((i) => i.label), ['New Base']);
    assert.deepEqual(filterItems(items, 'embed').map((i) => i.label), ['Note embed']);
  });
});
