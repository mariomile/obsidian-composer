export interface FileLike {
  path: string;
  name: string;
  extension: string;
}

export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

export function isCanvasLike(f: FileLike): boolean {
  return f.extension === 'canvas' || f.name.endsWith('.excalidraw.md');
}

export function inFolder(path: string, folder: string): boolean {
  const prefix = folder.endsWith('/') ? folder : `${folder}/`;
  return path.startsWith(prefix);
}

export function embedTextFor(f: FileLike): string {
  return f.extension === 'md' && !f.name.endsWith('.excalidraw.md')
    ? `![[${f.name.slice(0, -3)}]]`
    : `![[${f.name}]]`;
}
