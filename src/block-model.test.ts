import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blockAtLine, fenceRanges, frontmatterRange } from './block-model.ts';
import {
  turnInto, duplicateBlock, deleteBlock, moveBlock,
  ensureBlockId, insertionEdit, stripLine,
  indentBlock, dropTargets, moveBlockTo,
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
  it('list item absorbs a genuinely nested child bullet, stops at the next sibling', () => {
    assert.deepEqual(blockAtLine(doc('- a\n  - a-child\n- b'), 0), { startLine: 0, endLine: 1, type: 'list-item' });
    assert.deepEqual(blockAtLine(doc('- a\n  - a-child\n- b'), 1), { startLine: 1, endLine: 1, type: 'list-item' });
    assert.deepEqual(blockAtLine(doc('- a\n  - a-child\n- b'), 2), { startLine: 2, endLine: 2, type: 'list-item' });
  });
  it('list item absorbs a multi-level nested subtree', () => {
    const l = doc('- a\n  - a-child\n    - a-grandchild\n- b');
    assert.deepEqual(blockAtLine(l, 0), { startLine: 0, endLine: 2, type: 'list-item' });
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

describe('indentBlock', () => {
  it('outdents to the enclosing parent\'s indent', () => {
    const l = doc('- parent\n  - child');
    const block = { startLine: 1, endLine: 1, type: 'list-item' as const };
    assert.deepEqual(indentBlock(l, block, 'out', '  '),
      { fromLine: 1, toLine: 1, insert: ['- child'] });
  });
  it('outdent at level 0 is invalid', () => {
    const l = doc('- item');
    const block = { startLine: 0, endLine: 0, type: 'list-item' as const };
    assert.equal(indentBlock(l, block, 'out', '  '), null);
  });
  it('indents under the preceding sibling, reusing an existing child indent', () => {
    const l = doc('- a\n  - a-child\n- b');
    const block = { startLine: 2, endLine: 2, type: 'list-item' as const };
    assert.deepEqual(indentBlock(l, block, 'in', '  '),
      { fromLine: 2, toLine: 2, insert: ['  - b'] });
  });
  it('indents under a childless sibling using the fallback unit', () => {
    const l = doc('- a\n- b');
    const block = { startLine: 1, endLine: 1, type: 'list-item' as const };
    assert.deepEqual(indentBlock(l, block, 'in', '  '),
      { fromLine: 1, toLine: 1, insert: ['  - b'] });
  });
  it('indent with no preceding sibling at the same level is invalid', () => {
    const l = doc('- only');
    const block = { startLine: 0, endLine: 0, type: 'list-item' as const };
    assert.equal(indentBlock(l, block, 'in', '  '), null);
  });
  it('moves the whole subtree together', () => {
    const l = doc('- a\n- b\n  - b-child');
    const block = { startLine: 1, endLine: 2, type: 'list-item' as const };
    assert.deepEqual(indentBlock(l, block, 'in', '  '),
      { fromLine: 1, toLine: 2, insert: ['  - b', '    - b-child'] });
  });
  it('non-list-item blocks are not indentable', () => {
    const l = doc('plain text');
    const block = { startLine: 0, endLine: 0, type: 'paragraph' as const };
    assert.equal(indentBlock(l, block, 'in', '  '), null);
  });
  it('a blank line breaks the sibling/ancestor search', () => {
    const l = doc('- a\n\n- b');
    const block = { startLine: 2, endLine: 2, type: 'list-item' as const };
    assert.equal(indentBlock(l, block, 'in', '  '), null);
  });
});

describe('dropTargets', () => {
  it('offers a gap before every block plus end-of-doc, INCLUDING the dragged block\'s own slot', () => {
    // The own slot (line 2 here) is what makes a drag abandonable: without it
    // the nearest gap is always elsewhere, so picking a block up forced a move.
    const l = doc('one\n\ntwo\n\nthree');
    const dragged = { startLine: 2, endLine: 2, type: 'paragraph' as const };
    const targets = dropTargets(l, dragged, '  ');
    assert.deepEqual(targets.map((t) => t.line), [0, 2, 4, 5]);
  });
  it('maxIndent is null next to non-list blocks', () => {
    const l = doc('one\n\ntwo');
    const dragged = { startLine: 2, endLine: 2, type: 'paragraph' as const };
    const targets = dropTargets(l, dragged, '  ');
    assert.equal(targets.find((t) => t.line === 0)!.maxIndent, null);
  });
  it('maxIndent is one level past the deepest line of a nested preceding subtree', () => {
    const l = doc('- a\n  - a-child\n- b\n- c');
    const dragged = { startLine: 3, endLine: 3, type: 'list-item' as const };
    const targets = dropTargets(l, dragged, '  ');
    assert.equal(targets.find((t) => t.line === 2)!.maxIndent, '    ');
  });
  it('maxIndent is one level past a flat (unnested) preceding item', () => {
    const l = doc('- a\n- b\n- c');
    const dragged = { startLine: 2, endLine: 2, type: 'list-item' as const };
    const targets = dropTargets(l, dragged, '\t');
    assert.equal(targets.find((t) => t.line === 1)!.maxIndent, '\t');
  });
  it('baseIndent matches the sibling context, so a plain drop keeps depth', () => {
    // Dropping a child between two other children must keep it a child; the
    // first version forced '' here and flattened every dragged item.
    const l = doc('- one\n\t- a\n\t- b\n- two');
    const dragged = { startLine: 3, endLine: 3, type: 'list-item' as const };
    const targets = dropTargets(l, dragged, '\t');
    assert.equal(targets.find((t) => t.line === 2)!.baseIndent, '\t');
    assert.equal(targets.find((t) => t.line === 0)!.baseIndent, '');
  });
  it('exposes gaps BETWEEN nested siblings, not just top-level blocks', () => {
    // Without this, a child can only ever leave its parent — it can never be
    // reordered against its own siblings, which is most of what outline-style
    // dragging is for.
    const l = doc('- a\n\t- a1\n\t- a2\n- b');
    const dragged = { startLine: 2, endLine: 2, type: 'list-item' as const };
    const targets = dropTargets(l, dragged, '\t');
    assert.deepEqual(targets.map((t) => t.line), [0, 1, 2, 3, 4]);
  });
  it('dropping a block back on its own slot changes nothing', () => {
    const l = doc('one\n\ntwo\n\nthree');
    const block = { startLine: 2, endLine: 2, type: 'paragraph' as const };
    assert.equal(moveBlockTo(l, block, 2, null), null);
    assert.equal(moveBlockTo(l, block, 3, null), null);
  });
});

describe('moveBlockTo', () => {
  it('moves a paragraph to the end, adding a canonical blank separator', () => {
    const l = doc('one\n\ntwo\n\nthree');
    const block = { startLine: 0, endLine: 0, type: 'paragraph' as const };
    const r = moveBlockTo(l, block, 5, null)!;
    assert.deepEqual(r.edit, { fromLine: 0, toLine: 4, insert: ['two', '', 'three', '', 'one'] });
    assert.equal(r.cursorLine, 4);
  });
  it('reorders flat list items with no blank separators', () => {
    const l = doc('- a\n- b\n- c');
    const block = { startLine: 0, endLine: 0, type: 'list-item' as const };
    const r = moveBlockTo(l, block, 2, null)!;
    // Edit is narrowed to the lines that actually changed — '- c' is untouched.
    assert.deepEqual(r.edit, { fromLine: 0, toLine: 1, insert: ['- b', '- a'] });
    assert.equal(r.cursorLine, 1);
  });
  it('re-indents the moved subtree when newIndent is given', () => {
    const l = doc('- a\n- b\n  - b-child');
    const block = { startLine: 0, endLine: 0, type: 'list-item' as const };
    const r = moveBlockTo(l, block, 3, '  ')!;
    assert.deepEqual(r.edit, { fromLine: 0, toLine: 2, insert: ['- b', '  - b-child', '  - a'] });
  });
  it('leaves unrelated blank-line spacing untouched', () => {
    // The whole-document rebuild this replaced silently collapsed every
    // multi-blank gap in the note as a side effect of moving one block.
    const l = doc('alpha\n\n\nbeta\n\n\ngamma');
    const block = { startLine: 6, endLine: 6, type: 'paragraph' as const };
    const r = moveBlockTo(l, block, 0, null)!;
    const after = [...l];
    after.splice(r.edit.fromLine, r.edit.toLine - r.edit.fromLine + 1, ...r.edit.insert);
    assert.deepEqual(after.slice(0, 6), ['gamma', '', 'alpha', '', '', 'beta']);
  });
  it('reorders siblings inside a nested list', () => {
    const l = doc('- a\n\t- a1\n\t- a2\n- b');
    const block = { startLine: 2, endLine: 2, type: 'list-item' as const };
    const r = moveBlockTo(l, block, 1, null)!;
    const after = [...l];
    after.splice(r.edit.fromLine, r.edit.toLine - r.edit.fromLine + 1, ...r.edit.insert);
    assert.deepEqual(after, ['- a', '\t- a2', '\t- a1', '- b']);
  });
  it('null when the move would not change anything', () => {
    const l = doc('- a\n- b');
    const block = { startLine: 0, endLine: 0, type: 'list-item' as const };
    assert.equal(moveBlockTo(l, block, 0, null), null);
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
