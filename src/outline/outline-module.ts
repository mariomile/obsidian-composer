import { Component, MarkdownView, Platform, debounce, type App, type TFile } from "obsidian";
import { OutlineController } from "./outline-controller.ts";
import { normalizeHeadings } from "./heading-model.ts";
import type { OutlineSettings } from "./outline-settings.ts";

/**
 * The right-edge document outline (formerly the standalone Notion Outline
 * plugin). One OutlineController per open markdown view; the plugin adds this
 * component as a child when the outline is enabled and removes it when not.
 */
export class OutlineModule extends Component {
  private controllers = new Map<MarkdownView, OutlineController>();

  constructor(
    private app: App,
    private getSettings: () => OutlineSettings,
  ) {
    super();
  }

  onload(): void {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.syncControllers()),
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.syncControllers()),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () => this.refreshActive()),
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => this.onMetaChanged(file)),
    );
    this.registerEvent(
      this.app.workspace.on("resize", () => this.remeasureAll()),
    );

    this.app.workspace.onLayoutReady(() => this.syncControllers());
  }

  onunload(): void {
    for (const c of this.controllers.values()) c.destroy();
    this.controllers.clear();
  }

  private debouncedRefresh = debounce(
    (view: MarkdownView) => this.refreshView(view),
    150,
    true,
  );

  /** Ensure every visible markdown view has a controller; drop stale ones. */
  private syncControllers(): void {
    const live = new Set<MarkdownView>();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        live.add(view);
        if (!this.controllers.has(view)) {
          this.controllers.set(view, new OutlineController(view));
        }
        this.refreshView(view);
      }
    }
    for (const [view, ctrl] of this.controllers) {
      if (!live.has(view)) {
        ctrl.destroy();
        this.controllers.delete(view);
      }
    }
  }

  /** Re-render every outline, e.g. after a settings change. */
  refreshAll(): void {
    for (const view of this.controllers.keys()) this.refreshView(view);
  }

  private refreshActive(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) this.refreshView(view);
  }

  private remeasureAll(): void {
    for (const ctrl of this.controllers.values()) ctrl.remeasure();
  }

  private onMetaChanged(file: TFile): void {
    for (const [view] of this.controllers) {
      if (view.file?.path === file.path) this.debouncedRefresh(view);
    }
  }

  private refreshView(view: MarkdownView): void {
    const ctrl = this.controllers.get(view);
    if (!ctrl) return;
    const file = view.file;
    const headings = file
      ? normalizeHeadings(this.app.metadataCache.getFileCache(file))
      : [];
    ctrl.setHeadings(headings, this.getSettings().minHeadings, this.isVisible(view));
  }

  private isVisible(view: MarkdownView): boolean {
    const settings = this.getSettings();
    if (settings.disableOnMobile && Platform.isMobile) return false;
    if (view.getMode() === "preview") return settings.showInReadingView;
    return true;
  }
}
