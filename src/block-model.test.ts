import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blockAtLine, fenceRanges, frontmatterRange } from './block-model.ts';

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
  it('null on blank line and inside frontmatter', () => {
    assert.equal(blockAtLine(doc('a\n\nb'), 1), null);
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
