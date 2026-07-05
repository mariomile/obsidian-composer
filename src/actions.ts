import type { Editor } from 'obsidian';
import { insertionEdit, type Block, type LineEdit } from './block-model.ts';
import type { Snippet } from './snippets.ts';

/** Apply a LineEdit as ONE replaceRange (single undo step). */
export function applyLineEdit(editor: Editor, edit: LineEdit): void {
  const lastLine = editor.lastLine();
  const text = edit.insert.join('\n');

  if (edit.toLine < edit.fromLine) {
    // Pure insertion before fromLine.
    if (edit.fromLine > lastLine) {
      const end = { line: lastLine, ch: editor.getLine(lastLine).length };
      editor.replaceRange(`\n${text}`, end);
    } else {
      editor.replaceRange(`${text}\n`, { line: edit.fromLine, ch: 0 });
    }
    return;
  }

  if (edit.insert.length === 0) {
    // Deletion: consume the trailing newline too (or the leading one at EOF).
    const from = edit.fromLine > 0 && edit.toLine >= lastLine
      ? { line: edit.fromLine - 1, ch: editor.getLine(edit.fromLine - 1).length }
      : { line: edit.fromLine, ch: 0 };
    const to = edit.toLine >= lastLine
      ? { line: lastLine, ch: editor.getLine(lastLine).length }
      : { line: edit.toLine + 1, ch: 0 };
    editor.replaceRange('', from, to);
    return;
  }

  editor.replaceRange(text,
    { line: edit.fromLine, ch: 0 },
    { line: edit.toLine, ch: editor.getLine(edit.toLine).length });
}

export function insertSnippet(
  editor: Editor, block: Block, snippet: Snippet, where: 'above' | 'below',
): void {
  const { edit, firstInsertedLine } = insertionEdit(block, snippet.lines, where);
  applyLineEdit(editor, edit);
  editor.setCursor({
    line: firstInsertedLine + snippet.cursor.line,
    ch: snippet.cursor.ch,
  });
  editor.focus();
}
