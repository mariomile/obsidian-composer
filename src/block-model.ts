export type BlockType =
  | 'paragraph' | 'heading' | 'list-item' | 'quote' | 'callout'
  | 'code-fence' | 'table' | 'embed' | 'hr' | 'blank';

export interface Block {
  /** 0-based, inclusive */
  startLine: number;
  /** 0-based, inclusive */
  endLine: number;
  type: BlockType;
}

const FENCE_RE = /^\s*(```|~~~)/;
const HEADING_RE = /^#{1,6}\s/;
const HR_RE = /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE_RE = /^\s*>/;
const CALLOUT_RE = /^\s*>\s*\[!/;
const TABLE_RE = /^\s*\|/;
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s/;
const EMBED_RE = /^!\[\[[^\]]+\]\]\s*$/;

export function frontmatterRange(lines: string[]): [number, number] | null {
  if (lines[0] !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---' || lines[i] === '...') return [0, i];
  }
  return null;
}

export function fenceRanges(lines: string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let open: number | null = null;
  let marker = '';
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(FENCE_RE);
    if (!m) continue;
    if (open === null) {
      open = i;
      marker = m[1]!;
    } else if (m[1] === marker) {
      ranges.push([open, i]);
      open = null;
    }
  }
  if (open !== null) ranges.push([open, lines.length - 1]);
  return ranges;
}

function isPlain(t: string): boolean {
  return (
    t.trim() !== '' && !HEADING_RE.test(t) && !HR_RE.test(t) && !QUOTE_RE.test(t) &&
    !TABLE_RE.test(t) && !LIST_RE.test(t) && !EMBED_RE.test(t) && !FENCE_RE.test(t)
  );
}

/** Widest run of contiguous lines around `line` that all satisfy `pred`. */
function contiguousSpan(
  lines: string[], line: number, pred: (t: string) => boolean,
): [number, number] {
  let s = line, e = line;
  while (s > 0 && pred(lines[s - 1]!)) s--;
  while (e < lines.length - 1 && pred(lines[e + 1]!)) e++;
  return [s, e];
}

function listItemBlock(lines: string[], line: number): Block {
  const indent = lines[line]!.match(LIST_RE)![1]!.length;
  let e = line;
  while (e < lines.length - 1) {
    const next = lines[e + 1]!;
    if (next.trim() === '' || LIST_RE.test(next)) break;
    const nextIndent = next.match(/^\s*/)![0]!.length;
    if (nextIndent <= indent) break;
    e++;
  }
  return { startLine: line, endLine: e, type: 'list-item' };
}

export function blockAtLine(lines: string[], line: number): Block | null {
  if (line < 0 || line >= lines.length) return null;
  const fm = frontmatterRange(lines);
  if (fm && line <= fm[1]) return null;

  for (const [s, e] of fenceRanges(lines)) {
    if (line >= s && line <= e) return { startLine: s, endLine: e, type: 'code-fence' };
  }

  const text = lines[line]!;
  // A blank line is an insert target of its own (the handle shows ＋ there;
  // inserting replaces the line in place instead of adding separators).
  if (text.trim() === '') return { startLine: line, endLine: line, type: 'blank' };
  if (HEADING_RE.test(text)) return { startLine: line, endLine: line, type: 'heading' };
  if (HR_RE.test(text)) return { startLine: line, endLine: line, type: 'hr' };

  if (QUOTE_RE.test(text)) {
    const [s, e] = contiguousSpan(lines, line, (t) => QUOTE_RE.test(t));
    return { startLine: s, endLine: e, type: CALLOUT_RE.test(lines[s]!) ? 'callout' : 'quote' };
  }

  if (TABLE_RE.test(text)) {
    const [s, e] = contiguousSpan(lines, line, (t) => TABLE_RE.test(t));
    return { startLine: s, endLine: e, type: 'table' };
  }

  if (LIST_RE.test(text)) return listItemBlock(lines, line);
  if (EMBED_RE.test(text)) return { startLine: line, endLine: line, type: 'embed' };

  // Continuation of a list item above? Walk up the non-blank run to the
  // nearest preceding list-marker line.
  let up = line;
  while (up > 0 && lines[up - 1]!.trim() !== '') {
    up--;
    if (LIST_RE.test(lines[up]!)) {
      const b = listItemBlock(lines, up);
      if (b.endLine >= line) return b;
      break; // nearest item doesn't reach us → not a continuation
    }
  }

  const [s, e] = contiguousSpan(lines, line, isPlain);
  return { startLine: s, endLine: e, type: 'paragraph' };
}

export interface LineEdit {
  fromLine: number;
  toLine: number; // toLine === fromLine - 1 → pure insertion before fromLine
  insert: string[];
}

export type TurnTarget =
  | 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'callout' | 'bullet' | 'todo';

export function stripLine(t: string): string {
  let s = t.replace(/^\s+/, '');
  s = s.replace(/^(?:>\s*)+/, '');
  s = s.replace(/^\[![^\]]*\][+-]?\s*/, '');
  s = s.replace(/^#{1,6}\s+/, '');
  s = s.replace(/^(?:[-*+]|\d+[.)])\s+/, '');
  s = s.replace(/^\[[ xX]\]\s+/, '');
  return s;
}

export function turnInto(lines: string[], block: Block, target: TurnTarget): LineEdit {
  const src = lines.slice(block.startLine, block.endLine + 1).map(stripLine);
  let out: string[];
  switch (target) {
    case 'paragraph': out = src; break;
    case 'h1': out = src.map((t) => `# ${t}`); break;
    case 'h2': out = src.map((t) => `## ${t}`); break;
    case 'h3': out = src.map((t) => `### ${t}`); break;
    case 'bullet': out = src.map((t) => `- ${t}`); break;
    case 'todo': out = src.map((t) => `- [ ] ${t}`); break;
    case 'quote': out = src.map((t) => `> ${t}`); break;
    case 'callout':
      out = [`> [!note] ${src[0] ?? ''}`, ...src.slice(1).map((t) => `> ${t}`)];
      break;
  }
  return { fromLine: block.startLine, toLine: block.endLine, insert: out.map((l) => l.trimEnd()) };
}

export function duplicateBlock(lines: string[], block: Block): LineEdit {
  const copy = lines.slice(block.startLine, block.endLine + 1);
  const gap = block.type === 'list-item' ? [] : [''];
  return { fromLine: block.endLine + 1, toLine: block.endLine, insert: [...gap, ...copy] };
}

export function deleteBlock(lines: string[], block: Block): LineEdit {
  let end = block.endLine;
  if (end + 1 < lines.length && lines[end + 1]!.trim() === '') end++;
  return { fromLine: block.startLine, toLine: end, insert: [] };
}

function adjacentBlock(lines: string[], block: Block, dir: 'up' | 'down'): Block | null {
  let probe = dir === 'up' ? block.startLine - 1 : block.endLine + 1;
  while (probe >= 0 && probe < lines.length && lines[probe]!.trim() === '') {
    probe += dir === 'up' ? -1 : 1;
  }
  if (probe < 0 || probe >= lines.length) return null;
  return blockAtLine(lines, probe);
}

export function moveBlock(
  lines: string[], block: Block, dir: 'up' | 'down',
): { edit: LineEdit; cursorLine: number } | null {
  const other = adjacentBlock(lines, block, dir);
  if (!other) return null;
  const [first, second] = dir === 'up' ? [other, block] : [block, other];
  const a = lines.slice(first.startLine, first.endLine + 1);
  const b = lines.slice(second.startLine, second.endLine + 1);
  const gap = lines.slice(first.endLine + 1, second.startLine);
  return {
    edit: { fromLine: first.startLine, toLine: second.endLine, insert: [...b, ...gap, ...a] },
    cursorLine: dir === 'up' ? first.startLine : first.startLine + b.length + gap.length,
  };
}

const BLOCK_ID_RE = /\s\^([A-Za-z0-9-]+)\s*$/;

export function ensureBlockId(
  lines: string[], block: Block, genId: () => string,
): { edit: LineEdit | null; id: string } {
  const last = lines[block.endLine]!;
  const m = last.match(BLOCK_ID_RE);
  if (m) return { edit: null, id: m[1]! };
  const id = genId();
  if (block.type === 'table' || block.type === 'code-fence' || block.type === 'hr' || block.type === 'embed') {
    if (lines[block.endLine + 1]?.trim() === '') {
      const standalone = lines[block.endLine + 2]?.match(/^\^([A-Za-z0-9-]+)\s*$/);
      if (standalone) return { edit: null, id: standalone[1]! };
    }
    return { edit: { fromLine: block.endLine + 1, toLine: block.endLine, insert: ['', `^${id}`] }, id };
  }
  return { edit: { fromLine: block.endLine, toLine: block.endLine, insert: [`${last} ^${id}`] }, id };
}

export function insertionEdit(
  block: Block, snippet: string[], where: 'above' | 'below',
): { edit: LineEdit; firstInsertedLine: number } {
  if (block.type === 'blank') {
    // Replace the blank line itself — no separators either side.
    return {
      edit: { fromLine: block.startLine, toLine: block.startLine, insert: snippet },
      firstInsertedLine: block.startLine,
    };
  }
  if (where === 'below') {
    const at = block.endLine + 1;
    return {
      edit: { fromLine: at, toLine: at - 1, insert: ['', ...snippet] },
      firstInsertedLine: at + 1,
    };
  }
  const at = block.startLine;
  return {
    edit: { fromLine: at, toLine: at - 1, insert: [...snippet, ''] },
    firstInsertedLine: at,
  };
}
