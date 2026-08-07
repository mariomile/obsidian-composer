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
    if (next.trim() === '') break;
    // A more-indented list marker is a genuine nested child — absorb it (and
    // its own descendants, recursively via this same loop). Only a sibling
    // or shallower marker (nextIndent <= indent) ends the block.
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

export function headingLevel(line: string): number {
  const m = line.match(/^(#{1,6})\s/);
  return m ? m[1]!.length : 0;
}

function fenceGuard(lines: string[]): (i: number) => boolean {
  const fences = fenceRanges(lines);
  return (i) => fences.some(([s, e]) => i >= s && i <= e);
}

/** A heading plus everything beneath it, up to the next heading of the same
 *  or shallower level — what reordering a heading should carry with it.
 *  Non-heading blocks are returned unchanged. Deliberately used only by the
 *  REORDER paths (drag, move up/down): Delete/Duplicate/Turn into stay on the
 *  heading line, where swallowing a whole section would be a footgun rather
 *  than a convenience. */
export function sectionBlock(lines: string[], block: Block): Block {
  if (block.type !== 'heading') return block;
  const level = headingLevel(lines[block.startLine]!);
  const inFence = fenceGuard(lines);
  let end = block.startLine;
  for (let i = block.startLine + 1; i < lines.length; i++) {
    // A '#' line inside a code fence is content, not a heading.
    if (!inFence(i)) {
      const l = headingLevel(lines[i]!);
      if (l > 0 && l <= level) break;
    }
    end = i;
  }
  while (end > block.startLine && lines[end]!.trim() === '') end--;
  return { ...block, endLine: end };
}

/** Nearest heading line above `before`, ignoring fenced content. */
function precedingHeading(lines: string[], before: number): number | null {
  const inFence = fenceGuard(lines);
  for (let i = before - 1; i >= 0; i--) {
    if (!inFence(i) && headingLevel(lines[i]!) > 0) return i;
  }
  return null;
}

/** The section a heading should swap with, or null when the swap would take
 *  it out of its parent (its neighbour is a shallower heading). */
function siblingSection(lines: string[], self: Block, dir: 'up' | 'down'): Block | null {
  const level = headingLevel(lines[self.startLine]!);
  if (dir === 'up') {
    const h = precedingHeading(lines, self.startLine);
    if (h === null) return adjacentBlock(lines, self, 'up'); // content before any heading
    if (headingLevel(lines[h]!) !== level) return null;
    return sectionBlock(lines, blockAtLine(lines, h)!);
  }
  const next = adjacentBlock(lines, self, 'down');
  if (!next) return null;
  if (next.type !== 'heading') return next;
  // sectionBlock already absorbed any deeper heading, so this one is <= level.
  return headingLevel(lines[next.startLine]!) < level ? null : sectionBlock(lines, next);
}

export function moveBlock(
  lines: string[], block: Block, dir: 'up' | 'down',
): { edit: LineEdit; cursorLine: number } | null {
  const self = sectionBlock(lines, block);
  const other = self.type === 'heading'
    ? siblingSection(lines, self, dir)
    : adjacentBlock(lines, self, dir);
  if (!other) return null;
  const [first, second] = dir === 'up' ? [other, self] : [self, other];
  const a = lines.slice(first.startLine, first.endLine + 1);
  const b = lines.slice(second.startLine, second.endLine + 1);
  const gap = lines.slice(first.endLine + 1, second.startLine);
  return {
    edit: { fromLine: first.startLine, toLine: second.endLine, insert: [...b, ...gap, ...a] },
    cursorLine: dir === 'up' ? first.startLine : first.startLine + b.length + gap.length,
  };
}

/** Nearest preceding list-item at exactly `indentLen` — a sibling to indent
 *  under. A blank line or a shallower marker ends the search (no sibling). */
function findPrecedingSibling(lines: string[], fromLine: number, indentLen: number): number | null {
  for (let i = fromLine - 1; i >= 0; i--) {
    const t = lines[i]!;
    if (t.trim() === '') return null;
    const m = t.match(LIST_RE);
    if (!m) continue;
    const len = m[1]!.length;
    if (len === indentLen) return i;
    if (len < indentLen) return null;
  }
  return null;
}

/** Nearest preceding list-item strictly shallower than `indentLen` — the
 *  enclosing parent to outdent to. A blank line ends the search. */
function findAncestor(lines: string[], fromLine: number, indentLen: number): number | null {
  for (let i = fromLine - 1; i >= 0; i--) {
    const t = lines[i]!;
    if (t.trim() === '') return null;
    const m = t.match(LIST_RE);
    if (!m) continue;
    if (m[1]!.length < indentLen) return i;
  }
  return null;
}

/** Indent string of `itemLine`'s first child, if it has one nested directly
 *  beneath it — reused so a new sibling lines up with existing children. */
function childIndentOf(lines: string[], itemLine: number): string | null {
  const next = lines[itemLine + 1];
  if (next === undefined) return null;
  const parentIndent = lines[itemLine]!.match(LIST_RE)![1]!.length;
  const m = next.match(LIST_RE);
  return m && m[1]!.length > parentIndent ? m[1]! : null;
}

/** Replace every line's first `oldIndentLen` characters with `newIndent`,
 *  keeping marker + content untouched — shifts a block and its subtree by
 *  one uniform delta regardless of what those characters actually were. */
function reindentBlockLines(lines: string[], block: Block, oldIndentLen: number, newIndent: string): string[] {
  return lines.slice(block.startLine, block.endLine + 1).map((t) => newIndent + t.slice(oldIndentLen));
}

/** Indent (`'in'`) or outdent (`'out'`) a list-item block one level. `null`
 *  when the move is invalid: outdent at level 0, or indent with no
 *  preceding sibling at the same level to attach under. `fallbackUnit` is
 *  used only when the target sibling has no existing child to align with —
 *  callers should source it from the vault's own indent config. */
export function indentBlock(
  lines: string[], block: Block, dir: 'in' | 'out', fallbackUnit: string,
): LineEdit | null {
  if (block.type !== 'list-item') return null;
  const m = lines[block.startLine]!.match(LIST_RE);
  if (!m) return null;
  const indentLen = m[1]!.length;

  if (dir === 'out') {
    const ancestor = findAncestor(lines, block.startLine, indentLen);
    if (ancestor === null) return null;
    const newIndent = lines[ancestor]!.match(LIST_RE)![1]!;
    return { fromLine: block.startLine, toLine: block.endLine, insert: reindentBlockLines(lines, block, indentLen, newIndent) };
  }

  const sibling = findPrecedingSibling(lines, block.startLine, indentLen);
  if (sibling === null) return null;
  const newIndent = childIndentOf(lines, sibling) ?? lines[sibling]!.match(LIST_RE)![1]! + fallbackUnit;
  return { fromLine: block.startLine, toLine: block.endLine, insert: reindentBlockLines(lines, block, indentLen, newIndent) };
}

/** Every line a block may be dropped in front of, in document order, plus
 *  end-of-document. Descends INTO list subtrees: a nested child's siblings
 *  are drop points too, otherwise a child could only ever be moved out of
 *  its parent and never reordered against its siblings. */
function gapLines(lines: string[]): number[] {
  const gaps: number[] = [];
  const fm = frontmatterRange(lines);
  let i = fm ? fm[1] + 1 : 0;
  while (i < lines.length) {
    const b = blockAtLine(lines, i);
    if (!b) { i++; continue; }
    if (b.type === 'blank') { i++; continue; }
    gaps.push(b.startLine);
    if (b.type === 'list-item') {
      for (let j = b.startLine + 1; j <= b.endLine; j++) {
        if (LIST_RE.test(lines[j]!)) gaps.push(j);
      }
    }
    i = b.endLine + 1;
  }
  gaps.push(lines.length);
  return gaps;
}

function isListLine(t: string | undefined): boolean {
  return t !== undefined && LIST_RE.test(t);
}

/** Narrow a whole-document rewrite down to the lines that actually differ,
 *  so untouched regions are never re-written (and never silently
 *  re-formatted). `null` when the two are identical. */
function minimalEdit(before: string[], after: string[]): LineEdit | null {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endB = before.length - 1;
  let endA = after.length - 1;
  while (endB >= start && endA >= start && before[endB] === after[endA]) { endB--; endA--; }
  if (start > endB && start > endA) return null;
  return { fromLine: start, toLine: endB, insert: after.slice(start, endA + 1) };
}

export interface DropTarget {
  /** Insert immediately before this line (original document numbering). */
  line: number;
  /** Indent a dropped list-item takes here by default — the level of the
   *  siblings it lands among, so a plain vertical drag keeps depth instead of
   *  flattening the item to top level. */
  baseIndent: string;
  /** Deepest indent a dropped list-item may use here (one level in from
   *  `baseIndent`); null = top-level only (nothing above to nest under). */
  maxIndent: string | null;
}

/** Indent of the sibling context at `gapLine`: the list line landing there,
 *  or the nearest list line above it within the same run. */
function baseIndentAt(lines: string[], gapLine: number): string {
  const here = lines[gapLine];
  if (isListLine(here)) return here!.match(LIST_RE)![1]!;
  for (let i = gapLine - 1; i >= 0; i--) {
    const t = lines[i]!;
    if (t.trim() === '') break;
    if (isListLine(t)) return t.match(LIST_RE)![1]!;
  }
  return '';
}

function maxIndentAt(lines: string[], gapLine: number, fallbackUnit: string): string | null {
  let i = gapLine - 1;
  while (i >= 0 && lines[i]!.trim() === '') i--;
  if (i < 0) return null;
  // blockAtLine on a line that's itself a list marker always resolves to that
  // single line (see blockAtLine's early LIST_RE branch), so this is the
  // deepest marker preceding the gap. One level past it is the ceiling.
  const prev = blockAtLine(lines, i);
  if (!prev || prev.type !== 'list-item') return null;
  return lines[prev.startLine]!.match(LIST_RE)![1]! + fallbackUnit;
}

/** Valid drop gaps for dragging `dragged` — every block boundary (including
 *  positions between nested list siblings) plus end-of-document.
 *  `dragged`'s OWN position is deliberately included: without it the nearest
 *  gap is always somewhere else, so starting a drag commits you to a move
 *  with no way to put the block back down where it was. It resolves to a
 *  no-op in `moveBlockTo` (which returns null), except when the drag also
 *  changes indent — dragging sideways in place is a valid indent gesture. */
export function dropTargets(lines: string[], dragged: Block, fallbackUnit: string): DropTarget[] {
  return gapLines(lines).map((line) => ({
    line,
    baseIndent: baseIndentAt(lines, line),
    maxIndent: maxIndentAt(lines, line, fallbackUnit),
  }));
}

/** Relocate `block` (with its subtree) to just before `targetLine`, optionally
 *  re-indenting it to `newIndent`. Splices the block out and back in, then
 *  narrows the result to the lines that actually changed — everything outside
 *  that span is left byte-for-byte alone. An earlier version rebuilt the whole
 *  document body from its top-level blocks with canonical separators, which
 *  silently rewrote blank-line spacing across the ENTIRE note as a side effect
 *  of moving one block. `null` when the move is a no-op. */
export function moveBlockTo(
  lines: string[], block: Block, targetLine: number, newIndent: string | null,
): { edit: LineEdit; cursorLine: number } | null {
  const oldIndentLen = block.type === 'list-item'
    ? lines[block.startLine]!.match(LIST_RE)![1]!.length
    : 0;
  const raw = lines.slice(block.startLine, block.endLine + 1);
  const moved = newIndent === null ? raw : raw.map((t) => newIndent + t.slice(oldIndentLen));

  // Take the blank line that separated the block with it, so removing it
  // doesn't leave a double gap behind.
  const after = [...lines];
  let cutFrom = block.startLine;
  let cutCount = block.endLine - block.startLine + 1;
  if (lines[block.endLine + 1]?.trim() === '') {
    cutCount++;
  } else if (block.startLine > 0 && lines[block.startLine - 1]?.trim() === '') {
    cutFrom--;
    cutCount++;
  }
  after.splice(cutFrom, cutCount);

  // Re-base the target onto the post-cut array. A target INSIDE the cut range
  // (the gap immediately below the block, i.e. "leave it where it is") must
  // clamp to cutFrom: subtracting the full cutCount there would land the block
  // one slot too high and quietly move it instead of leaving it alone.
  const at = Math.max(0, Math.min(
    targetLine <= cutFrom ? targetLine : Math.max(cutFrom, targetLine - cutCount),
    after.length,
  ));
  // A list-item landing among list lines joins them tight; anything else
  // needs a blank line to stay a separate block.
  const tight = block.type === 'list-item' && (isListLine(after[at]) || isListLine(after[at - 1]));
  const atEnd = at >= after.length;
  const payload = tight ? moved
    : atEnd ? (after.length ? ['', ...moved] : moved)
      : [...moved, ''];
  after.splice(at, 0, ...payload);

  const edit = minimalEdit(lines, after);
  if (!edit) return null;
  return { edit, cursorLine: at + (payload.length > moved.length && !tight && atEnd ? 1 : 0) };
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
