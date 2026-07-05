import type { App, Editor, MarkdownView, TFile } from 'obsidian';
import { Notice, normalizePath } from 'obsidian';
import { insertionEdit, type Block } from './block-model.ts';
import type { ComposerItem } from './menu-core.ts';
import { BASIC_SNIPPETS } from './snippets.ts';
import { insertSnippet, applyLineEdit } from './actions.ts';
import {
  FilePicker, mdNotes, imageFiles, canvasFiles, filesInFolder, embedTextFor, baseFiles,
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

const BASE_TEMPLATE = `views:
  - type: table
    name: Table
`;

async function createBaseFile(app: App, folderPath: string, baseName: string): Promise<TFile> {
  let name = baseName;
  let i = 1;
  while (app.vault.getAbstractFileByPath(normalizePath(`${folderPath}/${name}.base`))) {
    name = `${baseName} ${++i}`;
  }
  return app.vault.create(normalizePath(`${folderPath}/${name}.base`), BASE_TEMPLATE);
}

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
  // AI section appended in Task 11.
  items.push(
    {
      id: 'base-new', label: 'New Base', icon: 'database', section: 'Base',
      keywords: ['base', 'database', 'table', 'view'],
      run: async () => {
        const folder = deps.view.file?.parent?.path ?? '/';
        const noteName = deps.view.file?.basename ?? 'Untitled';
        try {
          const f = await createBaseFile(deps.app, folder, `${noteName} Base`);
          insertEmbed(deps, `![[${f.name}]]`);
          new Notice(`Created ${f.path}`);
        } catch {
          new Notice('Could not create base file');
        }
      },
    },
    {
      id: 'base-link', label: 'Link existing Base', icon: 'database-zap', section: 'Base',
      keywords: ['base', 'database', 'existing'],
      run: () => {
        const files = baseFiles(deps.app);
        if (!files.length) { new Notice('No .base files in vault'); return; }
        new FilePicker(deps.app, files, 'Embed base…', (f) => insertEmbed(deps, embedTextFor(f))).open();
      },
    },
  );
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
