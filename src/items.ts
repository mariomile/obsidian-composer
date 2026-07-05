import type { App, Editor, MarkdownView } from 'obsidian';
import type { Block } from './block-model.ts';
import type { ComposerItem } from './menu-core.ts';
import { BASIC_SNIPPETS } from './snippets.ts';
import { insertSnippet } from './actions.ts';

export interface ItemDeps {
  app: App;
  editor: Editor;
  view: MarkdownView;
  block: Block;
  lines: string[];
  where: 'above' | 'below';
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
  // Base / Embed / Template / AI sections appended in Tasks 8, 9, 11.
  return items;
}
