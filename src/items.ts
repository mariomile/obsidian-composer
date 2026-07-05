import type { App, Editor, MarkdownView, TFile } from 'obsidian';
import { Notice } from 'obsidian';
import { insertionEdit, type Block } from './block-model.ts';
import type { ComposerItem } from './menu-core.ts';
import { BASIC_SNIPPETS } from './snippets.ts';
import { insertSnippet, applyLineEdit } from './actions.ts';
import {
  FilePicker, mdNotes, imageFiles, canvasFiles, filesInFolder, embedTextFor,
} from './pickers.ts';

export interface ItemDeps {
  app: App;
  editor: Editor;
  view: MarkdownView;
  block: Block;
  lines: string[];
  where: 'above' | 'below';
}

// Templates folder is hard-coded until settings land in Task 11.
const TEMPLATE_FOLDER = 'Resources/Templates';

function insertEmbed(deps: ItemDeps, text: string): void {
  const { edit, firstInsertedLine } = insertionEdit(deps.block, [text], deps.where);
  applyLineEdit(deps.editor, edit);
  deps.editor.setCursor({ line: firstInsertedLine, ch: text.length });
  deps.editor.focus();
}

function pickAndEmbed(deps: ItemDeps, files: TFile[], placeholder: string): void {
  new FilePicker(deps.app, files, placeholder, (f) => insertEmbed(deps, embedTextFor(f))).open();
}

export function insertItems(deps: ItemDeps): ComposerItem[] {
  const items: ComposerItem[] = [];
  for (const s of BASIC_SNIPPETS) {
    items.push({
      id: s.id,
      label: s.label,
      icon: s.icon,
      section: 'Basic',
      keywords: s.keywords,
      run: () => insertSnippet(deps.editor, deps.block, s.make(), deps.where),
    });
  }
  // Base / AI sections appended in Tasks 9, 11.
  items.push(
    {
      id: 'embed-note', label: 'Note', icon: 'file-text', section: 'Embed',
      keywords: ['embed', 'wikilink', 'transclude'],
      run: () => pickAndEmbed(deps, mdNotes(deps.app), 'Embed note…'),
    },
    {
      id: 'embed-image', label: 'Image', icon: 'image', section: 'Embed',
      keywords: ['image', 'picture', 'attachment'],
      run: () => pickAndEmbed(deps, imageFiles(deps.app), 'Embed image…'),
    },
    {
      id: 'embed-canvas', label: 'Canvas / Excalidraw', icon: 'layout-dashboard', section: 'Embed',
      keywords: ['canvas', 'excalidraw', 'drawing'],
      run: () => pickAndEmbed(deps, canvasFiles(deps.app), 'Embed canvas…'),
    },
    {
      id: 'embed-artifact', label: 'HTML artifact', icon: 'app-window', section: 'Embed',
      keywords: ['html', 'artifact'],
      run: () => pickAndEmbed(deps, filesInFolder(deps.app, 'Resources/_artifacts', 'html'), 'Embed artifact…'),
    },
    {
      id: 'template', label: 'Template', icon: 'file-plus', section: 'Template',
      keywords: ['template', 'boilerplate'],
      run: () => {
        const files = filesInFolder(deps.app, TEMPLATE_FOLDER, 'md');
        if (!files.length) { new Notice(`No templates in ${TEMPLATE_FOLDER}`); return; }
        new FilePicker(deps.app, files, 'Insert template…', (f) => {
          void deps.app.vault.read(f).then((content) => {
            const lines = content.replace(/\n$/, '').split('\n');
            const { edit, firstInsertedLine } = insertionEdit(deps.block, lines, deps.where);
            applyLineEdit(deps.editor, edit);
            deps.editor.setCursor({ line: firstInsertedLine, ch: 0 });
            deps.editor.focus();
          }).catch(() => {
            new Notice(`Could not read template: ${f.path}`);
          });
        }).open();
      },
    },
  );
  return items;
}
