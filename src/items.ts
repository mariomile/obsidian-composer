import type { App, Editor, MarkdownView, TFile } from 'obsidian';
import { Notice, normalizePath } from 'obsidian';
import {
  insertionEdit, type Block,
  turnInto, duplicateBlock, deleteBlock, moveBlock, ensureBlockId,
  type TurnTarget,
} from './block-model.ts';
import type { ComposerItem } from './menu-core.ts';
import { BASIC_SNIPPETS } from './snippets.ts';
import { insertSnippet, applyLineEdit } from './actions.ts';
import {
  FilePicker, mdNotes, imageFiles, canvasFiles, filesInFolder, embedTextFor, baseFiles,
} from './pickers.ts';
import type { ComposerSettings } from './settings.ts';

export interface ItemDeps {
  app: App;
  editor: Editor;
  view: MarkdownView;
  block: Block;
  lines: string[];
  where: 'above' | 'below';
  settings: ComposerSettings;
}

interface CommandRegistry {
  findCommand(id: string): unknown;
  executeCommandById(id: string): boolean;
}

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
  items.push(
    {
      id: 'base-new', label: 'New Base', icon: 'database', section: 'Base',
      keywords: ['base', 'database', 'table', 'view'],
      run: async () => {
        const folder = deps.settings.baseFolder || (deps.view.file?.parent?.path ?? '/');
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
      run: () => pickAndEmbed(deps, filesInFolder(deps.app, deps.settings.artifactFolder, 'html'), 'Embed artifact…'),
    },
    {
      id: 'template', label: 'Template', icon: 'file-plus', section: 'Template',
      keywords: ['template', 'boilerplate'],
      run: () => {
        const files = filesInFolder(deps.app, deps.settings.templateFolder, 'md');
        if (!files.length) { new Notice(`No templates in ${deps.settings.templateFolder}`); return; }
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

  const commands = (deps.app as unknown as { commands: CommandRegistry }).commands;
  if (deps.settings.aiEnabled && commands.findCommand(deps.settings.exoCommandId)) {
    items.push({
      id: 'ask-exo', label: 'Ask Exo', icon: 'sparkles', section: 'AI',
      keywords: ['ai', 'exo', 'assistant'],
      run: () => {
        // Land the cursor on a fresh line at the insert position, then hand off to Exo.
        const { edit, firstInsertedLine } = insertionEdit(deps.block, [''], deps.where);
        applyLineEdit(deps.editor, edit);
        deps.editor.setCursor({ line: firstInsertedLine, ch: 0 });
        deps.editor.focus();
        commands.executeCommandById(deps.settings.exoCommandId);
      },
    });
  }

  return items;
}

const TURN_TARGETS: Array<{ target: TurnTarget; label: string; icon: string }> = [
  { target: 'paragraph', label: 'Paragraph', icon: 'pilcrow' },
  { target: 'h1', label: 'Heading 1', icon: 'heading-1' },
  { target: 'h2', label: 'Heading 2', icon: 'heading-2' },
  { target: 'h3', label: 'Heading 3', icon: 'heading-3' },
  { target: 'bullet', label: 'Bullet list', icon: 'list' },
  { target: 'todo', label: 'To-do list', icon: 'square-check' },
  { target: 'quote', label: 'Quote', icon: 'quote' },
  { target: 'callout', label: 'Callout', icon: 'megaphone' },
];

function randomBlockId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function actionItems(deps: ItemDeps): ComposerItem[] {
  const items: ComposerItem[] = [];

  for (const t of TURN_TARGETS) {
    items.push({
      id: `turn-${t.target}`, label: t.label, icon: t.icon, section: 'Turn into',
      keywords: ['turn', 'convert', t.target],
      run: () => {
        applyLineEdit(deps.editor, turnInto(deps.lines, deps.block, t.target));
        deps.editor.setCursor({ line: deps.block.startLine, ch: 0 });
        deps.editor.focus();
      },
    });
  }

  items.push(
    {
      id: 'move-up', label: 'Move up', icon: 'arrow-up', section: 'Actions',
      keywords: ['move', 'reorder', 'up'],
      run: () => {
        const r = moveBlock(deps.lines, deps.block, 'up');
        if (!r) return;
        applyLineEdit(deps.editor, r.edit);
        deps.editor.setCursor({ line: r.cursorLine, ch: 0 });
        deps.editor.focus();
      },
    },
    {
      id: 'move-down', label: 'Move down', icon: 'arrow-down', section: 'Actions',
      keywords: ['move', 'reorder', 'down'],
      run: () => {
        const r = moveBlock(deps.lines, deps.block, 'down');
        if (!r) return;
        applyLineEdit(deps.editor, r.edit);
        deps.editor.setCursor({ line: r.cursorLine, ch: 0 });
        deps.editor.focus();
      },
    },
    {
      id: 'duplicate', label: 'Duplicate', icon: 'copy', section: 'Actions',
      keywords: ['duplicate', 'copy'],
      run: () => {
        applyLineEdit(deps.editor, duplicateBlock(deps.lines, deps.block));
        deps.editor.focus();
      },
    },
    {
      id: 'copy-link', label: 'Copy block link', icon: 'link', section: 'Actions',
      keywords: ['link', 'block', 'reference'],
      run: async () => {
        const { edit, id } = ensureBlockId(deps.lines, deps.block, randomBlockId);
        if (edit) applyLineEdit(deps.editor, edit);
        const basename = deps.view.file?.basename ?? '';
        await navigator.clipboard.writeText(`[[${basename}#^${id}]]`);
        new Notice('Block link copied');
      },
    },
    {
      id: 'delete', label: 'Delete', icon: 'trash-2', section: 'Actions',
      keywords: ['delete', 'remove'],
      run: () => {
        applyLineEdit(deps.editor, deleteBlock(deps.lines, deps.block));
        deps.editor.focus();
      },
    },
  );

  return items;
}
