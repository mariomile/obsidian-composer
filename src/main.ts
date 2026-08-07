import { MarkdownView, Plugin, type Editor } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import type { Text } from '@codemirror/state';
import { blockAtLine, type Block } from './block-model.ts';
import { GutterHandle } from './gutter.ts';
import { ComposerMenu } from './menu.ts';
import { insertItems, actionItems, type ItemDeps } from './items.ts';
import { vaultIndentUnit } from './actions.ts';
import { DragController, type DragDeps } from './drag.ts';
import type { ComposerItem } from './menu-core.ts';
import { DEFAULT_SETTINGS, ComposerSettingTab, type ComposerSettings } from './settings.ts';

const HANDLE_WIDTH = 46;
/** Assumed height of an embed widget's first "row", for centering the handle
 *  near its top rather than against the whole (possibly huge) widget. */
const NOMINAL_ROW_H = 24;

interface EditorContext {
  view: MarkdownView;
  editor: Editor;
  cm: EditorView;
}

export default class ComposerPlugin extends Plugin {
  settings!: ComposerSettings;
  private handle!: GutterHandle;
  private menu!: ComposerMenu;
  private drag!: DragController;
  private current: { ctx: EditorContext; block: Block; anchorTop: number | null } | null = null;
  /** True from grip mousedown until the gesture resolves (click or drag
   *  start) — freezes `current` so onMouseMove can't reassign it mid-gesture. */
  private pendingDrag = false;
  private lastLine: number | null = null;
  private showTimer = 0;
  private lineCache: { doc: Text; lines: string[] } | null = null;

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async onload(): Promise<void> {
    await this.loadSettings();
    this.handle = new GutterHandle({
      onPlus: (altKey) => this.openInsertMenu(altKey),
      onGrip: () => this.openActionsMenu(),
      onDragStart: (origin, current) => this.startDrag(origin, current),
      onGripDown: () => { this.pendingDrag = true; },
    });
    this.addChild(this.handle);
    this.menu = new ComposerMenu();
    this.addChild(this.menu);
    this.drag = new DragController();
    this.addChild(this.drag);
    this.addSettingTab(new ComposerSettingTab(this.app, this));

    this.registerDomEvent(document, 'mousemove', (e) => this.onMouseMove(e));
    // Scrolling the editor dismisses the handle/menu — but scrolling INSIDE
    // the menu (its list has overflow-y) must not close it.
    this.registerDomEvent(document, 'wheel', (e) => {
      if (this.menu.containsTarget(e.target as Node)) return;
      this.dismiss();
    }, { capture: true, passive: true });
    this.registerDomEvent(document, 'keydown', (e) => {
      if (this.menu.isVisible()) return; // menu handles its own keys
      if (e.key === 'Escape') { this.dismiss(); return; }
      if (e.key === 'Alt' || e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta') return;
      this.hideHandle(); // typing hides the handle
    });
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.dismiss()));
  }

  private dismiss(): void {
    this.menu.close();
    this.hideHandle();
  }

  private hideHandle(): void {
    window.clearTimeout(this.showTimer);
    this.handle.hide();
    this.lastLine = null;
    this.current = null; // current is only meaningful while the handle shows
  }

  private activeContext(): EditorContext | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.getMode() === 'preview') return null;
    const cm = (view.editor as unknown as { cm?: EditorView }).cm;
    if (!cm) return null;
    return { view, editor: view.editor, cm };
  }

  /** Line under the pointer. Embed-block widgets (callouts, tables) swallow
   *  posAtCoords, so hit-test the DOM first and map the widget back to a doc
   *  position with posAtDOM. Returns the 0-based line plus an optional anchor
   *  top (widget rect) for positioning when coordsAtPos can't resolve. */
  private lineAtEvent(cm: EditorView, e: MouseEvent): { line: number; anchorTop: number | null } {
    const target = e.target as HTMLElement;
    const widget = target.closest<HTMLElement>('.cm-embed-block');
    if (widget && cm.contentDOM.contains(widget)) {
      const pos = cm.posAtDOM(widget);
      return {
        line: cm.state.doc.lineAt(pos).number - 1,
        anchorTop: widget.getBoundingClientRect().top,
      };
    }
    const pos = cm.posAtCoords({ x: e.clientX, y: e.clientY }, false);
    return { line: cm.state.doc.lineAt(pos).number - 1, anchorTop: null };
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.menu.isVisible() || this.drag.isActive() || this.pendingDrag) return;
    if (this.handle.containsTarget(e.target as Node)) return;

    const ctx = this.activeContext();
    if (!ctx || !ctx.cm.dom.contains(e.target as Node)) {
      this.hideHandle();
      return;
    }
    if (ctx.editor.somethingSelected()) {
      this.hideHandle();
      return;
    }

    const { line, anchorTop } = this.lineAtEvent(ctx.cm, e);
    // Same line → handle already visible or the show-timer is pending; either
    // way there is nothing to recompute or reschedule.
    if (line === this.lastLine) return;

    const lines = this.documentLines(ctx.cm);
    const block = blockAtLine(lines, line);
    if (!block) {
      this.hideHandle();
      return;
    }
    this.lastLine = line;
    this.current = { ctx, block, anchorTop };

    if (this.handle.isVisible()) {
      this.positionHandle(ctx.cm, block, anchorTop);
    } else {
      window.clearTimeout(this.showTimer);
      this.showTimer = window.setTimeout(
        () => this.positionHandle(ctx.cm, block, anchorTop),
        this.settings.hoverDelayMs,
      );
    }
  }

  private positionHandle(cm: EditorView, block: Block, anchorTop: number | null): void {
    // The block was derived when the timer was scheduled; the doc may have
    // changed since. Re-validate before touching cm.state.doc.line().
    if (block.startLine + 1 > cm.state.doc.lines) {
      this.hideHandle();
      return;
    }
    const from = cm.state.doc.line(block.startLine + 1).from;
    const contentRect = cm.contentDOM.getBoundingClientRect();
    // coordsAtPos matches the actual glyph position — verified live via the
    // Range API against rendered text (ground truth, not inference): for a
    // heading, the text's own bounding rect starts exactly at
    // coordsAtPos.top, ~16px BELOW lineBlockAt/domRect.top (the heading's
    // own padding-top — breathing room above it, not part of the text).
    // A prior version of this code anchored to that padded box top instead
    // and left the handle floating in the whitespace above the heading,
    // disconnected from it. lineBlockAt is now only a fallback for the rare
    // case coordsAtPos can't resolve a position; anchorTop (embed-widget DOM
    // rect) still takes priority over both when set.
    const coords = cm.coordsAtPos(from);
    const fallbackTop = cm.lineBlockAt(from).top + contentRect.top;
    // Embed widgets (anchorTop) are arbitrarily tall — centering against the
    // whole widget would strand the handle in the middle of a large image, so
    // they keep a nominal one-row span at the top instead of a real text box.
    const textTop = anchorTop ?? coords?.top ?? fallbackTop;
    const textBottom = anchorTop === null ? coords?.bottom ?? fallbackTop : textTop + NOMINAL_ROW_H;
    // Foldable lines (headings, parent list items) render a collapse chevron
    // that hangs left of the text into the same strip the handle uses —
    // measured live: the chevron spans 517..532 while the handle ended at 523,
    // a 6px overlap that read as the handle being wedged apart from the title.
    // Anchoring to whatever the handle actually meets on its right (chevron
    // when present, text otherwise) keeps the same 9px gap in both cases.
    const left = Math.max(8, this.rightBoundary(cm, from, contentRect) - HANDLE_WIDTH - 6);
    this.handle.showAt(left, textTop, textBottom, block.type !== 'blank');
  }

  /** Viewport X the handle must stay clear of: a foldable line's collapse
   *  chevron if it has one, otherwise the text edge. The chevron element is
   *  in the DOM whether or not it's currently faded in, so this doesn't make
   *  the handle jump as the chevron appears on hover. */
  private rightBoundary(cm: EditorView, from: number, contentRect: DOMRect): number {
    const dom = cm.domAtPos(from).node;
    const lineEl = (dom.nodeType === Node.TEXT_NODE ? dom.parentElement : dom as HTMLElement)
      ?.closest<HTMLElement>('.cm-line');
    const chevron = lineEl?.querySelector<HTMLElement>('.cm-fold-indicator .collapse-indicator');
    const rect = chevron?.getBoundingClientRect();
    return rect && rect.width > 0 ? rect.left : contentRect.left;
  }

  private openMenu(
    where: 'above' | 'below', build: (deps: ItemDeps) => ComposerItem[],
  ): void {
    const cur = this.current;
    const rect = this.handle.anchorRect();
    if (!cur || !rect) return;
    const lines = this.documentLines(cur.ctx.cm);
    const liveBlock = blockAtLine(lines, cur.block.startLine);
    if (!liveBlock) return;
    const deps: ItemDeps = {
      app: this.app,
      editor: cur.ctx.editor,
      view: cur.ctx.view,
      blockLine: liveBlock.startLine,
      blockSnapshot: lines.slice(liveBlock.startLine, liveBlock.endLine + 1),
      where,
      settings: this.settings,
      indentUnit: vaultIndentUnit(this.app),
    };
    this.menu.open({ getBoundingClientRect: () => rect }, build(deps), () => this.hideHandle());
  }

  private openInsertMenu(altKey: boolean): void {
    const base = this.settings.insertPosition;
    this.openMenu(altKey ? (base === 'below' ? 'above' : 'below') : base, insertItems);
  }

  private openActionsMenu(): void {
    this.pendingDrag = false;
    this.openMenu('below', actionItems);
  }

  private startDrag(origin: MouseEvent, current: MouseEvent): void {
    this.pendingDrag = false;
    const cur = this.current;
    if (!cur) return;
    const lines = this.documentLines(cur.ctx.cm);
    const liveBlock = blockAtLine(lines, cur.block.startLine);
    if (!liveBlock) return;

    const cm = cur.ctx.cm;
    const doc = cm.state.doc;
    const contentRect = cm.contentDOM.getBoundingClientRect();
    const sourceEls: HTMLElement[] = [];
    for (let ln = liveBlock.startLine; ln <= liveBlock.endLine && ln < doc.lines; ln++) {
      const dom = cm.domAtPos(doc.line(ln + 1).from).node;
      const el = (dom.nodeType === Node.TEXT_NODE ? dom.parentElement : dom as HTMLElement)
        ?.closest<HTMLElement>('.cm-line');
      if (el && !sourceEls.includes(el)) sourceEls.push(el);
    }
    const deps: DragDeps = {
      editor: cur.ctx.editor,
      lines,
      sourceEls,
      block: liveBlock,
      fallbackUnit: vaultIndentUnit(this.app),
      left: contentRect.left,
      // Unlike positionHandle (anchors to a block's own text), this is a GAP
      // boundary — "insert immediately before this line" — so the full
      // lineBlockAt box top (including e.g. a heading's own padding-top) is
      // the right anchor: it's where new content lands, before that
      // padding applies on top of it. line === doc.lines is the
      // "append at end" target, past the last real line.
      lineTop: (line) => {
        if (line >= doc.lines) {
          const end = cm.lineBlockAt(doc.length);
          return end.top + end.height + contentRect.top;
        }
        return cm.lineBlockAt(doc.line(line + 1).from).top + contentRect.top;
      },
      onDone: () => this.hideHandle(),
    };
    this.drag.start(deps, origin, current);
  }

  private documentLines(cm: EditorView): string[] {
    const doc = cm.state.doc;
    if (this.lineCache?.doc === doc) return this.lineCache.lines;
    const lines = doc.toString().split('\n');
    this.lineCache = { doc, lines };
    return lines;
  }

  onunload(): void {
    window.clearTimeout(this.showTimer);
  }
}
