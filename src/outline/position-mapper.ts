import type { MarkdownView } from "obsidian";
import { EditorView } from "@codemirror/view";
import type { Heading } from "./heading-model.ts";

/** The CM6 EditorView behind a MarkdownView, or null in reading mode. */
function getEditorView(view: MarkdownView): EditorView | null {
  const cm = (view.editor as unknown as { cm?: EditorView } | undefined)?.cm;
  return cm instanceof EditorView ? cm : null;
}

function isReadingMode(view: MarkdownView): boolean {
  return view.getMode() === "preview";
}

/** The scrollable element for the current mode. */
export function getScroller(view: MarkdownView): HTMLElement | null {
  if (isReadingMode(view)) {
    return view.contentEl.querySelector<HTMLElement>(
      ".markdown-reading-view .markdown-preview-view",
    );
  }
  const cm = getEditorView(view);
  return (cm?.scrollDOM as HTMLElement) ?? null;
}

/**
 * Pixel top of each heading relative to the scroll content. Index-aligned with
 * `headings`. Missing measurements fall back to the previous value (monotonic).
 */
export function getHeadingTops(view: MarkdownView, headings: Heading[]): number[] {
  if (isReadingMode(view)) return readingTops(view, headings);
  return editingTops(view, headings);
}

function editingTops(view: MarkdownView, headings: Heading[]): number[] {
  const cm = getEditorView(view);
  if (!cm) return headings.map(() => 0);
  const doc = cm.state.doc;
  let last = 0;
  return headings.map((h) => {
    const lineNo = Math.min(h.line + 1, doc.lines); // CM lines are 1-based
    const pos = doc.line(lineNo).from;
    try {
      last = cm.lineBlockAt(pos).top;
    } catch {
      /* keep previous */
    }
    return last;
  });
}

/**
 * Obsidian's reading view virtualizes: not every heading is in the DOM. Align
 * the rendered <h*> elements (DOM order) to the metadata headings (doc order)
 * with a two-pointer match on (level, text). Returns, per metadata heading, the
 * matched element or null. Robust whether or not virtualization is active.
 */
function alignReadingEls(
  headings: Heading[],
  els: HTMLElement[],
): (HTMLElement | null)[] {
  const result: (HTMLElement | null)[] = new Array<HTMLElement | null>(headings.length).fill(null);
  let ei = 0;
  for (let hi = 0; hi < headings.length && ei < els.length; hi++) {
    const el = els[ei];
    const heading = headings[hi];
    if (!el || !heading) break;
    const elLevel = Number(el.tagName.charAt(1)); // "H2" -> 2
    const elText = (el.textContent ?? "").trim();
    if (elLevel === heading.level && elText === heading.text.trim()) {
      result[hi] = el;
      ei++;
    }
  }
  return result;
}

function readingTops(view: MarkdownView, headings: Heading[]): number[] {
  const scroller = getScroller(view);
  if (!scroller) return headings.map(() => 0);
  const els = Array.from(
    scroller.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
  );
  const aligned = alignReadingEls(headings, els);
  let last = 0;
  return headings.map((_, i) => {
    const el = aligned[i];
    if (el) last = el.offsetTop;
    return last;
  });
}

/** Scroll the view so the heading at `index` is near the top. */
export function scrollToHeading(
  view: MarkdownView,
  headings: Heading[],
  index: number,
): void {
  const h = headings[index];
  if (!h) return;
  if (isReadingMode(view)) {
    // Robust against preview virtualization: scroll by document line, not by a
    // rendered element that may not exist in the DOM.
    view.currentMode.applyScroll(h.line);
    return;
  }
  const cm = getEditorView(view);
  if (!cm) return;
  const lineNo = Math.min(h.line + 1, cm.state.doc.lines);
  const pos = cm.state.doc.line(lineNo).from;
  cm.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "start" }) });
}
