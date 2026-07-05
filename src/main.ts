import { MarkdownView, Plugin, type Editor } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { blockAtLine, type Block } from './block-model.ts';
import { GutterHandle } from './gutter.ts';
import { ComposerMenu } from './menu.ts';
import { insertItems, actionItems, type ItemDeps } from './items.ts';
import type { ComposerItem } from './menu-core.ts';
import { DEFAULT_SETTINGS, ComposerSettingTab, type ComposerSettings } from './settings.ts';

const HANDLE_WIDTH = 46;

interface EditorContext {
  view: MarkdownView;
  editor: Editor;
  cm: EditorView;
}

export default class ComposerPlugin extends Plugin {
  settings!: ComposerSettings;
  private handle!: GutterHandle;
  private menu!: ComposerMenu;
  private current: { ctx: EditorContext; block: Block; anchorTop: number | null } | null = null;
  private lastLine: number | null = null;
  private showTimer = 0;

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
    });
    this.addChild(this.handle);
    this.menu = new ComposerMenu();
    this.addChild(this.menu);
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
    if (this.menu.isVisible()) return;
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

    const lines = ctx.editor.getValue().split('\n');
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
    const coords = cm.coordsAtPos(from);
    const top = coords?.top ?? anchorTop;
    if (top == null) {
      this.hideHandle();
      return;
    }
    const contentRect = cm.contentDOM.getBoundingClientRect();
    const left = Math.max(8, contentRect.left - HANDLE_WIDTH - 6);
    this.handle.showAt(left, top - 1, block.type !== 'blank');
  }

  private openMenu(
    where: 'above' | 'below', build: (deps: ItemDeps) => ComposerItem[],
  ): void {
    const cur = this.current;
    const rect = this.handle.anchorRect();
    if (!cur || !rect) return;
    const deps: ItemDeps = {
      app: this.app,
      editor: cur.ctx.editor,
      view: cur.ctx.view,
      blockLine: cur.block.startLine,
      where,
      settings: this.settings,
    };
    this.menu.open({ getBoundingClientRect: () => rect }, build(deps), () => this.hideHandle());
  }

  private openInsertMenu(altKey: boolean): void {
    const base = this.settings.insertPosition;
    this.openMenu(altKey ? (base === 'below' ? 'above' : 'below') : base, insertItems);
  }

  private openActionsMenu(): void {
    this.openMenu('below', actionItems);
  }

  onunload(): void {
    window.clearTimeout(this.showTimer);
  }
}
