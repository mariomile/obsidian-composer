import { Component, setIcon } from 'obsidian';

export interface GutterDeps {
  onPlus: (altKey: boolean) => void;
  onGrip: () => void;
}

export class GutterHandle extends Component {
  private el: HTMLElement;
  private gripEl: HTMLElement;
  private visible = false;

  constructor(deps: GutterDeps) {
    super();
    this.el = document.body.createDiv({ cls: 'composer-handle' });
    this.el.hide();
    this.makeBtn('plus', 'Insert block', (e) => deps.onPlus(e.altKey));
    this.gripEl = this.makeBtn('grip-vertical', 'Block actions', () => deps.onGrip());
  }

  private makeBtn(icon: string, label: string, onClick: (e: MouseEvent) => void): HTMLElement {
    const btn = this.el.createDiv({
      cls: 'composer-handle-btn',
      attr: { 'aria-label': label, role: 'button' },
    });
    setIcon(btn, icon);
    this.registerDomEvent(btn, 'mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    this.registerDomEvent(btn, 'click', (e) => { e.preventDefault(); onClick(e); });
    return btn;
  }

  /** `showGrip: false` renders only ＋ (blank lines: nothing to act on yet). */
  showAt(left: number, top: number, showGrip = true): void {
    this.gripEl.toggle(showGrip);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.show();
    this.el.addClass('is-visible');
    this.visible = true;
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.el.removeClass('is-visible');
    this.el.hide();
  }

  isVisible(): boolean {
    return this.visible;
  }

  containsTarget(t: Node): boolean {
    return this.el.contains(t);
  }

  anchorRect(): DOMRect | null {
    return this.visible ? this.el.getBoundingClientRect() : null;
  }

  onunload(): void {
    this.el.remove();
  }
}
