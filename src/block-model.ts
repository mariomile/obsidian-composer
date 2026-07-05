export type BlockType =
  | 'paragraph' | 'heading' | 'list-item' | 'quote' | 'callout'
  | 'code-fence' | 'table' | 'embed' | 'hr';

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
  if (text.trim() === '') return null;
  if (HEADING_RE.test(text)) return { startLine: line, endLine: line, type: 'heading' };
  if (HR_RE.test(text)) return { startLine: line, endLine: line, type: 'hr' };

  if (QUOTE_RE.test(text)) {
    let s = line, e = line;
    while (s > 0 && QUOTE_RE.test(lines[s - 1]!)) s--;
    while (e < lines.length - 1 && QUOTE_RE.test(lines[e + 1]!)) e++;
    return { startLine: s, endLine: e, type: CALLOUT_RE.test(lines[s]!) ? 'callout' : 'quote' };
  }

  if (TABLE_RE.test(text)) {
    let s = line, e = line;
    while (s > 0 && TABLE_RE.test(lines[s - 1]!)) s--;
    while (e < lines.length - 1 && TABLE_RE.test(lines[e + 1]!)) e++;
    return { startLine: s, endLine: e, type: 'table' };
  }

  if (LIST_RE.test(text)) return listItemBlock(lines, line);
  if (EMBED_RE.test(text)) return { startLine: line, endLine: line, type: 'embed' };

  // Continuation line of a list item above? Walk to the top of the non-blank run.
  let up = line;
  while (up > 0 && lines[up - 1]!.trim() !== '') up--;
  if (up !== line && LIST_RE.test(lines[up]!)) {
    const b = listItemBlock(lines, up);
    if (b.endLine >= line) return b;
  }

  let s = line, e = line;
  while (s > 0 && isPlain(lines[s - 1]!)) s--;
  while (e < lines.length - 1 && isPlain(lines[e + 1]!)) e++;
  return { startLine: s, endLine: e, type: 'paragraph' };
}
