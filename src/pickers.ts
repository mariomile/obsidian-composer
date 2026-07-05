import { FuzzySuggestModal, type App, type TFile } from 'obsidian';

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

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

export function mdNotes(app: App): TFile[] {
  return app.vault.getMarkdownFiles();
}

export function imageFiles(app: App): TFile[] {
  return app.vault.getFiles().filter((f) => IMAGE_EXTS.has(f.extension.toLowerCase()));
}

export function canvasFiles(app: App): TFile[] {
  return app.vault.getFiles().filter(
    (f) => f.extension === 'canvas' || f.name.endsWith('.excalidraw.md'),
  );
}

export function baseFiles(app: App): TFile[] {
  return app.vault.getFiles().filter((f) => f.extension === 'base');
}

export function filesInFolder(app: App, folder: string, ext?: string): TFile[] {
  const prefix = folder.endsWith('/') ? folder : `${folder}/`;
  return app.vault.getFiles().filter(
    (f) => f.path.startsWith(prefix) && (!ext || f.extension === ext),
  );
}

export function embedTextFor(f: TFile): string {
  return f.extension === 'md' && !f.name.endsWith('.excalidraw.md')
    ? `![[${f.basename}]]`
    : `![[${f.name}]]`;
}
