import { Component, Notice, setIcon } from 'obsidian';
import { computePosition, offset, flip, shift, type VirtualElement } from '@floating-ui/dom';
import { filterItems, type ComposerItem } from './menu-core.ts';

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
    // Don't let clicks inside the menu blur the search input — but allow
    // clicks IN the input itself to reposition the caret.
    this.registerDomEvent(this.el, 'mousedown', (e) => {
      if (this.searchEl.contains(e.target as Node)) return;
      e.preventDefault();
    });
    this.registerDomEvent(document, 'mousedown', (e) => {
      if (this.visible && !this.el.contains(e.target as Node)) this.close();
    });
    this.registerDomEvent(this.listEl, 'click', (e) => {
      const i = this.indexFromEvent(e);
      if (i === null) return;
      const entry = this.rendered[i];
      if (entry) this.pick(entry.item);
    });
    this.registerDomEvent(this.listEl, 'mousemove', (e) => {
      const i = this.indexFromEvent(e);
      if (i !== null && i !== this.activeIndex) this.setActive(i);
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
      if (!this.visible) return;
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

  containsTarget(t: Node): boolean {
    return this.el.contains(t);
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
    Promise.resolve(item.run()).catch((e: unknown) => {
      console.error('[composer] item failed:', item.id, e);
      new Notice(`${item.label} failed`);
    });
  }

  private indexFromEvent(e: MouseEvent): number | null {
    const itemEl = (e.target as HTMLElement).closest<HTMLElement>('.composer-menu-item');
    if (!itemEl || !this.listEl.contains(itemEl)) return null;
    const i = Number(itemEl.dataset.composerIndex);
    return Number.isInteger(i) ? i : null;
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
      el.dataset.composerIndex = String(this.rendered.length);
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
