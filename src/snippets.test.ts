import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BASIC_SNIPPETS } from './snippets.ts';

const byId = (id: string) => BASIC_SNIPPETS.find((s) => s.id === id)!;

describe('BASIC_SNIPPETS', () => {
  it('has the 9 v1 snippets', () => {
    assert.deepEqual(BASIC_SNIPPETS.map((s) => s.id),
      ['table', 'accordion', 'code', 'quote', 'h1', 'h2', 'h3', 'todo', 'separator']);
  });
  it('table is a 2x3 skeleton with cursor in first cell', () => {
    const s = byId('table').make();
    assert.equal(s.lines.length, 3);
    assert.match(s.lines[1]!, /^\| --- /);
    assert.deepEqual(s.cursor, { line: 0, ch: 2 });
  });
  it('accordion is a foldable callout with cursor on the title', () => {
    const s = byId('accordion').make();
    assert.equal(s.lines[0], '> [!note]- Title');
    assert.deepEqual(s.cursor, { line: 0, ch: 11 });
  });
  it('code puts cursor inside the fence', () => {
    const s = byId('code').make();
    assert.deepEqual(s.lines, ['```', '', '```']);
    assert.deepEqual(s.cursor, { line: 1, ch: 0 });
  });
  it('every snippet has icon and keywords', () => {
    for (const s of BASIC_SNIPPETS) {
      assert.ok(s.icon.length > 0, s.id);
      assert.ok(s.keywords.length > 0, s.id);
    }
  });
});
