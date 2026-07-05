import { MarkdownView, Plugin, type Editor } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { blockAtLine, type Block } from './block-model.ts';
import { GutterHandle } from './gutter.ts';
import { ComposerMenu } from './menu.ts';

const HANDLE_WIDTH = 46;
const HOVER_DELAY_MS = 150; // becomes a setting in Task 11

interface EditorContext {
  view: MarkdownView;
  editor: Editor;
  cm: EditorView;
}

export default class ComposerPlugin extends Plugin {
  private handle!: GutterHandle;
  private menu!: ComposerMenu;
  private current: { ctx: EditorContext; block: Block } | null = null;
  private lastLine: number | null = null;
  private showTimer = 0;

  async onload(): Promise<void> {
    this.handle = new GutterHandle({
      onPlus: (altKey) => this.openInsertMenu(altKey),
      onGrip: () => this.openActionsMenu(),
    });
    this.addChild(this.handle);
    this.menu = new ComposerMenu();
    this.addChild(this.menu);

    this.registerDomEvent(document, 'mousemove', (e) => this.onMouseMove(e));
    this.registerDomEvent(document, 'wheel', () => this.dismiss(), { capture: true, passive: true });
    this.registerDomEvent(document, 'keydown', (e) => {
      if (this.menu.isVisible()) return; // menu handles its own keys
      if (e.key === 'Escape') this.dismiss();
      else this.hideHandle(); // typing hides the handle
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
  }

  private activeContext(): EditorContext | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.getMode() === 'preview') return null;
    const cm = (view.editor as unknown as { cm?: EditorView }).cm;
    if (!cm) return null;
    return { view, editor: view.editor, cm };
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

    const pos = ctx.cm.posAtCoords({ x: e.clientX, y: e.clientY }, false);
    const line = ctx.cm.state.doc.lineAt(pos).number - 1; // 0-based
    if (line === this.lastLine && this.handle.isVisible()) return;

    const lines = ctx.editor.getValue().split('\n');
    const block = blockAtLine(lines, line);
    if (!block) {
      this.hideHandle();
      return;
    }
    this.lastLine = line;
    this.current = { ctx, block };

    if (this.handle.isVisible()) {
      this.positionHandle(ctx.cm, block);
    } else {
      window.clearTimeout(this.showTimer);
      this.showTimer = window.setTimeout(() => this.positionHandle(ctx.cm, block), HOVER_DELAY_MS);
    }
  }

  private positionHandle(cm: EditorView, block: Block): void {
    const from = cm.state.doc.line(block.startLine + 1).from;
    const coords = cm.coordsAtPos(from);
    if (!coords) {
      this.hideHandle();
      return;
    }
    const contentRect = cm.contentDOM.getBoundingClientRect();
    const left = Math.max(8, contentRect.left - HANDLE_WIDTH - 6);
    this.handle.showAt(left, coords.top - 1);
  }

  // Filled in Task 7.
  private openInsertMenu(_altKey: boolean): void {}

  // Filled in Task 10.
  private openActionsMenu(): void {}
}
