import { Component, setIcon } from 'obsidian';

/** Movement past this many px turns a grip mousedown into a drag instead of
 *  the click that opens the ⠿ menu. */
const DRAG_THRESHOLD_PX = 4;

export interface GutterDeps {
  onPlus: (altKey: boolean) => void;
  onGrip: () => void;
  /** Called once, when a mousedown-then-move on the grip crosses the drag
   *  threshold — gutter.ts stops tracking the pointer at that point; the
   *  caller takes over for the rest of the gesture. `origin` is the
   *  mousedown event (the true gesture start, e.g. for measuring horizontal
   *  drag distance from); `current` is the mousemove that crossed the
   *  threshold (for positioning ghost/indicator immediately). */
  onDragStart: (origin: MouseEvent, current: MouseEvent) => void;
  /** Fired the instant the grip receives mousedown, before any movement —
   *  the caller's own hover tracking runs on the same 'mousemove' events
   *  this component measures for the drag threshold, and it registered its
   *  listener first (at plugin load), so it would otherwise see those events
   *  before this component decides click vs. drag and could reassign the
   *  hovered block out from under an in-flight gesture. Freeze it here. */
  onGripDown: () => void;
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
    this.gripEl = this.makeGripBtn(deps);
  }

  private makeBtn(icon: string, label: string, onClick: (e: MouseEvent) => void): HTMLElement {
    const btn = this.el.createDiv({
      cls: 'composer-handle-btn',
      attr: { 'aria-label': label, role: 'button', tabindex: '0' },
    });
    setIcon(btn, icon);
    this.registerDomEvent(btn, 'mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    this.registerDomEvent(btn, 'click', (e) => { e.preventDefault(); onClick(e); });
    this.registerDomEvent(btn, 'keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      btn.click();
    });
    return btn;
  }

  /** Same click/keyboard contract as makeBtn, plus a mousedown-driven
   *  drag-vs-click disambiguator: below DRAG_THRESHOLD_PX of movement before
   *  mouseup, it's a click (opens the ⠿ menu, unchanged from today);
   *  past it, onDragStart takes over and the pending click is suppressed. */
  private makeGripBtn(deps: GutterDeps): HTMLElement {
    const btn = this.el.createDiv({
      cls: 'composer-handle-btn',
      attr: { 'aria-label': 'Block actions', role: 'button', tabindex: '0' },
    });
    setIcon(btn, 'grip-vertical');
    let suppressClick = false;

    this.registerDomEvent(btn, 'mousedown', (start) => {
      start.preventDefault();
      start.stopPropagation();
      deps.onGripDown();
      const { clientX, clientY } = start;
      const onMove = (ev: MouseEvent): void => {
        if (Math.hypot(ev.clientX - clientX, ev.clientY - clientY) <= DRAG_THRESHOLD_PX) return;
        suppressClick = true;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        deps.onDragStart(start, ev);
      };
      const onUp = (): void => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    this.registerDomEvent(btn, 'click', (e) => {
      e.preventDefault();
      if (suppressClick) { suppressClick = false; return; }
      deps.onGrip();
    });
    this.registerDomEvent(btn, 'keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      btn.click();
    });
    return btn;
  }

  /** Centers the handle vertically against the block's first text line
   *  (`textTop`..`textBottom`, glyph metrics — not the padded .cm-line box).
   *  Centering rather than top-aligning is what keeps it correct across font
   *  sizes: an H1's text line is ~30px tall against a 22px handle, so
   *  top-aligning left the handle visibly riding above the title, while on
   *  ~19px body text the two are near enough that it looked fine — which is
   *  why this only ever showed up on headings.
   *  `showGrip: false` renders only ＋ (blank lines: nothing to act on yet). */
  showAt(left: number, textTop: number, textBottom: number, showGrip = true): void {
    this.gripEl.toggle(showGrip);
    this.el.style.left = `${left}px`;
    // Show before measuring: offsetHeight is 0 while display:none.
    this.el.show();
    this.el.style.top = `${(textTop + textBottom) / 2 - this.el.offsetHeight / 2}px`;
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
