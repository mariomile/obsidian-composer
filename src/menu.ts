import { Component, setIcon } from 'obsidian';
import { computePosition, offset, flip, shift, type VirtualElement } from '@floating-ui/dom';
import { filterItems, type ComposerItem } from './menu-core.ts';

export type { ComposerItem } from './menu-core.ts';
export { filterItems } from './menu-core.ts';

export class ComposerMenu extends Component {
  private el: HTMLElement;
  private searchEl: HTMLInputElement;
  private listEl: HTMLElement;
  private items: ComposerItem[] = [];
  private rendered: Array<{ item: ComposerItem; el: HTMLElement }> = [];
  private activeIndex = 0;
  private visible = false;
  private onCloseCb: (() => void) | null = null;

  constructor() {
    super();
    this.el = document.body.createDiv({ cls: 'composer-menu' });
    this.el.hide();
    this.searchEl = this.el.createEl('input', {
      cls: 'composer-menu-search',
      attr: { type: 'text', placeholder: 'Filter…', spellcheck: 'false' },
    });
    this.listEl = this.el.createDiv({ cls: 'composer-menu-list' });

    this.registerDomEvent(this.searchEl, 'input', () => this.render(this.searchEl.value));
    this.registerDomEvent(this.searchEl, 'keydown', (e: KeyboardEvent) => this.onKey(e));
    // Keep editor focus semantics: don't let clicks inside blur the input.
    this.registerDomEvent(this.el, 'mousedown', (e) => e.preventDefault());
    this.registerDomEvent(document, 'mousedown', (e) => {
      if (this.visible && !this.el.contains(e.target as Node)) this.close();
    });
  }

  open(anchor: VirtualElement, items: ComposerItem[], onClose?: () => void): void {
    this.items = items;
    this.onCloseCb = onClose ?? null;
    this.searchEl.value = '';
    this.activeIndex = 0;
    this.render('');
    this.el.show();
    this.visible = true;
    computePosition(anchor, this.el, {
      placement: 'right-start',
      middleware: [offset(6), flip({ fallbackPlacements: ['left-start', 'bottom-start'] }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      this.el.style.left = `${x}px`;
      this.el.style.top = `${y}px`;
      this.searchEl.focus();
    });
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.el.hide();
    const cb = this.onCloseCb;
    this.onCloseCb = null;
    cb?.();
  }

  isVisible(): boolean {
    return this.visible;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); this.setActive(this.activeIndex + 1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.setActive(this.activeIndex - 1); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const entry = this.rendered[this.activeIndex];
      if (entry) this.pick(entry.item);
    }
  }

  private pick(item: ComposerItem): void {
    this.close();
    void item.run();
  }

  private setActive(i: number): void {
    if (!this.rendered.length) return;
    const n = this.rendered.length;
    this.activeIndex = ((i % n) + n) % n;
    this.rendered.forEach((r, idx) => r.el.toggleClass('is-active', idx === this.activeIndex));
    this.rendered[this.activeIndex]!.el.scrollIntoView({ block: 'nearest' });
  }

  private render(query: string): void {
    this.listEl.empty();
    this.rendered = [];
    const visible = filterItems(this.items, query);
    let section = '';
    for (const item of visible) {
      if (item.section !== section) {
        section = item.section;
        this.listEl.createDiv({ cls: 'composer-menu-section', text: section });
      }
      const el = this.listEl.createDiv({ cls: 'composer-menu-item' });
      const iconEl = el.createSpan({ cls: 'composer-menu-item-icon' });
      setIcon(iconEl, item.icon);
      el.createSpan({ text: item.label });
      const index = this.rendered.length;
      this.registerDomEvent(el, 'mousemove', () => this.setActive(index));
      this.registerDomEvent(el, 'click', () => this.pick(item));
      this.rendered.push({ item, el });
    }
    this.activeIndex = 0;
    this.setActive(0);
    if (!visible.length) this.listEl.createDiv({ cls: 'composer-menu-empty', text: 'No match' });
  }

  onunload(): void {
    this.el.remove();
  }
}
