import { Component } from 'obsidian';
import type { Editor } from 'obsidian';
import { dropTargets, moveBlockTo, type Block, type DropTarget } from './block-model.ts';
import { performEdit } from './actions.ts';

/** Horizontal drag distance (px) past which a list-item drop nests under the
 *  item preceding the target gap instead of staying flat. A single
 *  threshold rather than continuous per-unit snapping — robust against
 *  documents that mix tabs and spaces, where a precise "pixels ÷ unit
 *  width" mapping would drift. Multi-level/precise re-nesting stays
 *  available via the ⠿ Indent/Outdent items, which share indentBlock()
 *  with this module — dragging covers the common one-step case, not every
 *  case. */
const NEST_THRESHOLD_PX = 24;

export interface DragDeps {
  editor: Editor;
  /** Document snapshot at drag-start — nothing else mutates the document
   *  mid-drag (typing hides the handle before a drag can even start). */
  lines: string[];
  block: Block;
  fallbackUnit: string;
  /** Absolute viewport Y for the top of a gap's target line, or doc-end. */
  lineTop: (line: number) => number;
  /** Absolute viewport X for the indicator/ghost's flat (un-nested) edge. */
  left: number;
  /** The rendered .cm-line elements of the dragged block, dimmed for the
   *  duration so the ghost reads as the block having been lifted out. */
  sourceEls: HTMLElement[];
  onDone: () => void;
}

interface ActiveDrag {
  deps: DragDeps;
  targets: DropTarget[];
  startX: number;
  target: DropTarget;
  nested: boolean;
}

export class DragController extends Component {
  private ghostEl: HTMLElement;
  private indicatorEl: HTMLElement;
  private active: ActiveDrag | null = null;

  constructor() {
    super();
    this.ghostEl = document.body.createDiv({ cls: 'composer-drag-ghost' });
    this.ghostEl.hide();
    this.indicatorEl = document.body.createDiv({ cls: 'composer-drop-indicator' });
    this.indicatorEl.hide();
  }

  /** Begins a drag — no-op if the dragged block has nowhere valid to go
   *  (e.g. it's the only top-level block in the document). `origin` is the
   *  true gesture-start event (mousedown) — the horizontal nest threshold
   *  measures from there, NOT from `current` (the mousemove that crossed
   *  gutter.ts's own drag-start threshold), which can already carry an
   *  arbitrary X offset of its own and would silently swallow it. */
  start(deps: DragDeps, origin: MouseEvent, current: MouseEvent): void {
    const targets = dropTargets(deps.lines, deps.block, deps.fallbackUnit);
    if (!targets.length) return;

    const label = deps.lines[deps.block.startLine]!.trim().slice(0, 60) || '(empty block)';
    this.ghostEl.setText(label);
    this.ghostEl.show();
    document.body.addClass('composer-dragging');
    for (const el of deps.sourceEls) el.addClass('composer-drag-source');

    this.active = { deps, targets, startX: origin.clientX, target: targets[0]!, nested: false };
    document.addEventListener('mousemove', this.onMove);
    document.addEventListener('mouseup', this.onUp);
    document.addEventListener('keydown', this.onKeydown);
    this.onMove(current);
  }

  isActive(): boolean {
    return this.active !== null;
  }

  private onMove = (e: MouseEvent): void => {
    const a = this.active;
    if (!a) return;
    this.ghostEl.style.left = `${e.clientX + 12}px`;
    this.ghostEl.style.top = `${e.clientY + 12}px`;

    let best = a.targets[0]!;
    let bestDist = Infinity;
    for (const t of a.targets) {
      const d = Math.abs(a.deps.lineTop(t.line) - e.clientY);
      if (d < bestDist) { bestDist = d; best = t; }
    }
    a.target = best;
    a.nested = best.maxIndent !== null && e.clientX - a.startX > NEST_THRESHOLD_PX;

    const indentPx = a.nested ? NEST_THRESHOLD_PX : 0;
    this.indicatorEl.style.left = `${a.deps.left + indentPx}px`;
    this.indicatorEl.style.top = `${a.deps.lineTop(a.target.line)}px`;
    // Releasing over the block's own slot puts it back unchanged. Mute the
    // indicator there so "nothing will happen" is visible before letting go,
    // rather than something the user only discovers afterwards.
    this.indicatorEl.toggleClass('is-noop', this.isNoop(a));
    this.indicatorEl.show();
  };

  /** True when committing right now would leave the document unchanged. */
  private isNoop(a: ActiveDrag): boolean {
    const { block } = a.deps;
    if (a.target.line < block.startLine || a.target.line > block.endLine + 1) return false;
    if (block.type !== 'list-item') return true;
    const current = a.deps.lines[block.startLine]!.match(/^\s*/)![0];
    return (a.nested ? a.target.maxIndent : a.target.baseIndent) === current;
  }

  private onUp = (): void => {
    const a = this.active;
    this.teardown();
    if (!a) return;
    // Plain vertical drop adopts the depth of its new siblings (baseIndent);
    // only an explicit horizontal drag nests one level deeper. Forcing '' here
    // flattened every dragged child to top level.
    const newIndent = a.deps.block.type === 'list-item'
      ? (a.nested ? a.target.maxIndent : a.target.baseIndent)
      : null;
    const r = moveBlockTo(a.deps.lines, a.deps.block, a.target.line, newIndent);
    // null = the drop resolves to where the block already is; leave the
    // document (and the undo stack) untouched rather than writing a no-op.
    if (r) performEdit(a.deps.editor, r.edit, { line: r.cursorLine, ch: 0 });
    a.deps.onDone();
  };

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    const a = this.active;
    this.teardown();
    a?.deps.onDone();
  };

  private teardown(): void {
    document.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('mouseup', this.onUp);
    document.removeEventListener('keydown', this.onKeydown);
    document.body.removeClass('composer-dragging');
    for (const el of this.active?.deps.sourceEls ?? []) el.removeClass('composer-drag-source');
    this.ghostEl.hide();
    this.indicatorEl.hide();
    this.active = null;
  }

  onunload(): void {
    this.teardown();
    this.ghostEl.remove();
    this.indicatorEl.remove();
  }
}
