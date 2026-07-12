import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyLineEdit, blockMatchesSnapshot } from './actions.ts';
import type { Editor } from 'obsidian';

/** Minimal fake Editor over an array of lines — only what applyLineEdit touches. */
function fakeEditor(lines: string[]) {
  const state = { lines: [...lines] };
  const posToIndex = (pos: { line: number; ch: number }) => {
    let idx = 0;
    for (let l = 0; l < pos.line; l++) idx += state.lines[l]!.length + 1;
    return idx + pos.ch;
  };
  const ed = {
    lastLine: () => state.lines.length - 1,
    getLine: (l: number) => state.lines[l] ?? '',
    replaceRange: (text: string, from: { line: number; ch: number }, to?: { line: number; ch: number }) => {
      const doc = state.lines.join('\n');
      const a = posToIndex(from);
      const b = to ? posToIndex(to) : a;
      state.lines = (doc.slice(0, a) + text + doc.slice(b)).split('\n');
    },
  };
  return { editor: ed as unknown as Editor, state };
}

describe('applyLineEdit', () => {
  it('pure insertion mid-doc', () => {
    const { editor, state } = fakeEditor(['a', 'b']);
    applyLineEdit(editor, { fromLine: 1, toLine: 0, insert: ['', 'x'] });
    assert.deepEqual(state.lines, ['a', '', 'x', 'b']);
  });
  it('pure insertion at EOF', () => {
    const { editor, state } = fakeEditor(['a']);
    applyLineEdit(editor, { fromLine: 1, toLine: 0, insert: ['', 'x'] });
    assert.deepEqual(state.lines, ['a', '', 'x']);
  });
  it('replacement of a line range', () => {
    const { editor, state } = fakeEditor(['a', 'b', 'c']);
    applyLineEdit(editor, { fromLine: 1, toLine: 2, insert: ['B'] });
    assert.deepEqual(state.lines, ['a', 'B']);
  });
  it('deletion mid-doc removes trailing newline', () => {
    const { editor, state } = fakeEditor(['a', 'b', 'c']);
    applyLineEdit(editor, { fromLine: 1, toLine: 1, insert: [] });
    assert.deepEqual(state.lines, ['a', 'c']);
  });
  it('deletion of first block', () => {
    const { editor, state } = fakeEditor(['a', 'b']);
    applyLineEdit(editor, { fromLine: 0, toLine: 0, insert: [] });
    assert.deepEqual(state.lines, ['b']);
  });
  it('deletion reaching the last line consumes the leading newline', () => {
    const { editor, state } = fakeEditor(['a', 'b', 'c']);
    applyLineEdit(editor, { fromLine: 1, toLine: 2, insert: [] });
    assert.deepEqual(state.lines, ['a']);
  });
  it('deletion of the whole doc leaves an empty doc', () => {
    const { editor, state } = fakeEditor(['a', 'b']);
    applyLineEdit(editor, { fromLine: 0, toLine: 1, insert: [] });
    assert.deepEqual(state.lines, ['']);
  });
});

describe('blockMatchesSnapshot', () => {
  it('accepts the unchanged target block', () => {
    assert.equal(
      blockMatchesSnapshot(['before', 'target', 'after'], { startLine: 1, endLine: 1, type: 'paragraph' }, ['target']),
      true,
    );
  });

  it('rejects a different block shifted into the original line', () => {
    assert.equal(
      blockMatchesSnapshot(['inserted', 'before', 'target'], { startLine: 1, endLine: 1, type: 'paragraph' }, ['target']),
      false,
    );
  });
});
