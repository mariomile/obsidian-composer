import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blockAtLine, fenceRanges, frontmatterRange } from './block-model.ts';
import {
  turnInto, duplicateBlock, deleteBlock, moveBlock,
  ensureBlockId, insertionEdit, stripLine,
} from './block-model.ts';

const doc = (s: string) => s.split('\n');

describe('frontmatterRange', () => {
  it('detects closed frontmatter', () => {
    assert.deepEqual(frontmatterRange(doc('---\ntags: []\n---\nhello')), [0, 2]);
  });
  it('null when absent', () => {
    assert.equal(frontmatterRange(doc('hello\n---')), null);
  });
});

describe('fenceRanges', () => {
  it('finds fence spans inclusive of fences', () => {
    assert.deepEqual(fenceRanges(doc('a\n```js\nx\n```\nb')), [[1, 3]]);
  });
  it('unclosed fence runs to EOF', () => {
    assert.deepEqual(fenceRanges(doc('```\nx')), [[0, 1]]);
  });
});

describe('blockAtLine', () => {
  it('blank line is a blank block, frontmatter is null', () => {
    assert.deepEqual(blockAtLine(doc('a\n\nb'), 1), { startLine: 1, endLine: 1, type: 'blank' });
    assert.deepEqual(blockAtLine(doc(''), 0), { startLine: 0, endLine: 0, type: 'blank' });
    assert.equal(blockAtLine(doc('---\ntitle: x\n---\nbody'), 1), null);
  });
  it('heading is a single-line block', () => {
    assert.deepEqual(blockAtLine(doc('# Title\ntext'), 0), { startLine: 0, endLine: 0, type: 'heading' });
  });
  it('multi-line paragraph groups contiguous plain lines', () => {
    assert.deepEqual(blockAtLine(doc('one\ntwo\n\nthree'), 1), { startLine: 0, endLine: 1, type: 'paragraph' });
  });
  it('code fence is atomic from any inner line', () => {
    assert.deepEqual(blockAtLine(doc('a\n```\ncode\n```\nb'), 2), { startLine: 1, endLine: 3, type: 'code-fence' });
  });
  it('table groups contiguous pipe lines', () => {
    assert.deepEqual(blockAtLine(doc('| a |\n| - |\n| 1 |\n\nx'), 2), { startLine: 0, endLine: 2, type: 'table' });
  });
  it('quote vs callout', () => {
    assert.equal(blockAtLine(doc('> plain\n> more'), 1)?.type, 'quote');
    assert.deepEqual(blockAtLine(doc('> [!note] Hi\n> body'), 1), { startLine: 0, endLine: 1, type: 'callout' });
  });
  it('list item with deeper continuation line', () => {
    assert.deepEqual(blockAtLine(doc('- item\n  cont\n- next'), 0), { startLine: 0, endLine: 1, type: 'list-item' });
    assert.deepEqual(blockAtLine(doc('- item\n  cont\n- next'), 1), { startLine: 0, endLine: 1, type: 'list-item' });
    assert.deepEqual(blockAtLine(doc('- item\n  cont\n- next'), 2), { startLine: 2, endLine: 2, type: 'list-item' });
  });
  it('embed and hr are single-line blocks', () => {
    assert.equal(blockAtLine(doc('![[Note]]'), 0)?.type, 'embed');
    assert.equal(blockAtLine(doc('text\n\n---\n\ntext'), 2)?.type, 'hr');
  });
  it('continuation binds to the nearest preceding item in multi-item lists', () => {
    assert.deepEqual(blockAtLine(doc('- a\n- b\n  cont'), 2), { startLine: 1, endLine: 2, type: 'list-item' });
    assert.deepEqual(blockAtLine(doc('- a\n- b\n  cont'), 1), { startLine: 1, endLine: 2, type: 'list-item' });
  });
});

describe('stripLine', () => {
  it('strips heading, quote, list, todo markers', () => {
    assert.equal(stripLine('## Title'), 'Title');
    assert.equal(stripLine('> > nested'), 'nested');
    assert.equal(stripLine('- [ ] task'), 'task');
    assert.equal(stripLine('3. item'), 'item');
    assert.equal(stripLine('> [!note]- Folded'), 'Folded');
  });
});

describe('turnInto', () => {
  const lines = doc('before\n\nalpha\nbeta\n\nafter');
  const block = { startLine: 2, endLine: 3, type: 'paragraph' as const };
  it('h2 per line', () => {
    assert.deepEqual(turnInto(lines, block, 'h2'),
      { fromLine: 2, toLine: 3, insert: ['## alpha', '## beta'] });
  });
  it('callout wraps with header on first line', () => {
    assert.deepEqual(turnInto(lines, block, 'callout').insert,
      ['> [!note] alpha', '> beta']);
  });
  it('paragraph strips existing markers', () => {
    const l = doc('- one\n- two');
    const b = { startLine: 0, endLine: 0, type: 'list-item' as const };
    assert.deepEqual(turnInto(l, b, 'paragraph').insert, ['one']);
  });
});

describe('duplicateBlock / deleteBlock', () => {
  it('duplicate paragraph adds blank separator', () => {
    const l = doc('aaa\n\nbbb');
    assert.deepEqual(duplicateBlock(l, { startLine: 0, endLine: 0, type: 'paragraph' }),
      { fromLine: 1, toLine: 0, insert: ['', 'aaa'] });
  });
  it('duplicate list item has no separator', () => {
    const l = doc('- a\n- b');
    assert.deepEqual(duplicateBlock(l, { startLine: 0, endLine: 0, type: 'list-item' }),
      { fromLine: 1, toLine: 0, insert: ['- a'] });
  });
  it('delete swallows one trailing blank line', () => {
    const l = doc('aaa\n\nbbb');
    assert.deepEqual(deleteBlock(l, { startLine: 0, endLine: 0, type: 'paragraph' }),
      { fromLine: 0, toLine: 1, insert: [] });
  });
});

describe('moveBlock', () => {
  const l = doc('one\n\ntwo\n\nthree');
  it('moves down past the gap', () => {
    const r = moveBlock(l, { startLine: 0, endLine: 0, type: 'paragraph' }, 'down')!;
    assert.deepEqual(r.edit, { fromLine: 0, toLine: 2, insert: ['two', '', 'one'] });
    assert.equal(r.cursorLine, 2);
  });
  it('moves up', () => {
    const r = moveBlock(l, { startLine: 2, endLine: 2, type: 'paragraph' }, 'up')!;
    assert.deepEqual(r.edit, { fromLine: 0, toLine: 2, insert: ['two', '', 'one'] });
    assert.equal(r.cursorLine, 0);
  });
  it('null at document edge', () => {
    assert.equal(moveBlock(l, { startLine: 0, endLine: 0, type: 'paragraph' }, 'up'), null);
  });
});

describe('ensureBlockId', () => {
  it('reuses an existing id without an edit', () => {
    const l = doc('some text ^abc123');
    const r = ensureBlockId(l, { startLine: 0, endLine: 0, type: 'paragraph' }, () => 'zzz');
    assert.equal(r.id, 'abc123');
    assert.equal(r.edit, null);
  });
  it('appends id inline for paragraphs', () => {
    const l = doc('some text');
    const r = ensureBlockId(l, { startLine: 0, endLine: 0, type: 'paragraph' }, () => 'newid1');
    assert.deepEqual(r.edit, { fromLine: 0, toLine: 0, insert: ['some text ^newid1'] });
  });
  it('puts id on its own line after tables', () => {
    const l = doc('| a |\n| - |');
    const r = ensureBlockId(l, { startLine: 0, endLine: 1, type: 'table' }, () => 'tbl1');
    assert.deepEqual(r.edit, { fromLine: 2, toLine: 1, insert: ['', '^tbl1'] });
  });
  it('reuses an existing id line after tables and code fences', () => {
    const l = doc('| a |\n| - |\n\n^tbl1');
    const r = ensureBlockId(l, { startLine: 0, endLine: 1, type: 'table' }, () => 'zzz');
    assert.equal(r.id, 'tbl1');
    assert.equal(r.edit, null);
  });
  it('puts id on its own line after hr and embed blocks', () => {
    const l = doc('---');
    const r = ensureBlockId(l, { startLine: 0, endLine: 0, type: 'hr' }, () => 'sep1');
    assert.deepEqual(r.edit, { fromLine: 1, toLine: 0, insert: ['', '^sep1'] });
  });
});

describe('insertionEdit', () => {
  const block = { startLine: 2, endLine: 3, type: 'paragraph' as const };
  it('below adds separating blank line', () => {
    assert.deepEqual(insertionEdit(block, ['---'], 'below'),
      { edit: { fromLine: 4, toLine: 3, insert: ['', '---'] }, firstInsertedLine: 5 });
  });
  it('above inserts before the block', () => {
    assert.deepEqual(insertionEdit(block, ['---'], 'above'),
      { edit: { fromLine: 2, toLine: 1, insert: ['---', ''] }, firstInsertedLine: 2 });
  });
  it('blank block is replaced in place, no separators', () => {
    const blank = { startLine: 3, endLine: 3, type: 'blank' as const };
    assert.deepEqual(insertionEdit(blank, ['# ', 'x'], 'below'),
      { edit: { fromLine: 3, toLine: 3, insert: ['# ', 'x'] }, firstInsertedLine: 3 });
    assert.deepEqual(insertionEdit(blank, ['---'], 'above'),
      { edit: { fromLine: 3, toLine: 3, insert: ['---'] }, firstInsertedLine: 3 });
  });
});
