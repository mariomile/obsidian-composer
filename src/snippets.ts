export interface Snippet {
  lines: string[];
  cursor: { line: number; ch: number };
}

interface SnippetDef {
  id: string;
  label: string;
  icon: string;
  keywords: string[];
  make: () => Snippet;
}

export const BASIC_SNIPPETS: SnippetDef[] = [
  {
    id: 'table', label: 'Table', icon: 'table', keywords: ['table', 'grid'],
    make: () => ({
      lines: ['|     |     |     |', '| --- | --- | --- |', '|     |     |     |'],
      cursor: { line: 0, ch: 2 },
    }),
  },
  {
    id: 'accordion', label: 'Accordion', icon: 'chevrons-down-up', keywords: ['accordion', 'toggle', 'callout', 'fold'],
    make: () => ({ lines: ['> [!note]- Title', '> '], cursor: { line: 0, ch: 11 } }),
  },
  {
    id: 'code', label: 'Code block', icon: 'code', keywords: ['code', 'fence', 'snippet'],
    make: () => ({ lines: ['```', '', '```'], cursor: { line: 1, ch: 0 } }),
  },
  {
    id: 'quote', label: 'Quote', icon: 'quote', keywords: ['quote', 'blockquote'],
    make: () => ({ lines: ['> '], cursor: { line: 0, ch: 2 } }),
  },
  {
    id: 'h1', label: 'Heading 1', icon: 'heading-1', keywords: ['heading', 'title', 'h1'],
    make: () => ({ lines: ['# '], cursor: { line: 0, ch: 2 } }),
  },
  {
    id: 'h2', label: 'Heading 2', icon: 'heading-2', keywords: ['heading', 'h2'],
    make: () => ({ lines: ['## '], cursor: { line: 0, ch: 3 } }),
  },
  {
    id: 'h3', label: 'Heading 3', icon: 'heading-3', keywords: ['heading', 'h3'],
    make: () => ({ lines: ['### '], cursor: { line: 0, ch: 4 } }),
  },
  {
    id: 'todo', label: 'To-do list', icon: 'square-check', keywords: ['todo', 'task', 'checkbox'],
    make: () => ({ lines: ['- [ ] '], cursor: { line: 0, ch: 6 } }),
  },
  {
    id: 'separator', label: 'Separator', icon: 'minus', keywords: ['divider', 'hr', 'rule'],
    make: () => ({ lines: ['---'], cursor: { line: 0, ch: 3 } }),
  },
];
