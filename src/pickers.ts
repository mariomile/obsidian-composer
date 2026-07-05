import { FuzzySuggestModal, type App, type TFile } from 'obsidian';
import { IMAGE_EXTS, inFolder, isCanvasLike } from './pickers-core.ts';

export class FilePicker extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private files: TFile[],
    placeholder: string,
    private onPick: (f: TFile) => void,
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(f: TFile): string {
    return f.path;
  }

  onChooseItem(f: TFile): void {
    this.onPick(f);
  }
}

export function mdNotes(app: App): TFile[] {
  return app.vault.getMarkdownFiles();
}

export function imageFiles(app: App): TFile[] {
  return app.vault.getFiles().filter((f) => IMAGE_EXTS.has(f.extension.toLowerCase()));
}

export function canvasFiles(app: App): TFile[] {
  return app.vault.getFiles().filter((f) => isCanvasLike(f));
}

export function baseFiles(app: App): TFile[] {
  return app.vault.getFiles().filter((f) => f.extension === 'base');
}

export function filesInFolder(app: App, folder: string, ext?: string): TFile[] {
  return app.vault.getFiles().filter(
    (f) => inFolder(f.path, folder) && (!ext || f.extension === ext),
  );
}

export { embedTextFor } from './pickers-core.ts';
