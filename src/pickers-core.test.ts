import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { embedTextFor, inFolder, isCanvasLike } from './pickers-core.ts';

describe('embedTextFor', () => {
  it('plain md embeds by basename', () => {
    assert.equal(embedTextFor({ path: 'A/Note.md', name: 'Note.md', extension: 'md' }), '![[Note]]');
  });
  it('excalidraw.md keeps full name', () => {
    assert.equal(embedTextFor({ path: 'D/x.excalidraw.md', name: 'x.excalidraw.md', extension: 'md' }), '![[x.excalidraw.md]]');
  });
  it('non-md keeps extension', () => {
    assert.equal(embedTextFor({ path: 'i.png', name: 'i.png', extension: 'png' }), '![[i.png]]');
    assert.equal(embedTextFor({ path: 'b.base', name: 'b.base', extension: 'base' }), '![[b.base]]');
  });
});

describe('inFolder', () => {
  it('matches files under the folder including subfolders', () => {
    assert.equal(inFolder('Resources/Templates/a.md', 'Resources/Templates'), true);
    assert.equal(inFolder('Resources/Templates/sub/b.md', 'Resources/Templates'), true);
  });
  it('rejects sibling folders sharing the prefix', () => {
    assert.equal(inFolder('Resources/TemplatesOld/a.md', 'Resources/Templates'), false);
  });
});

describe('isCanvasLike', () => {
  it('canvas ext and excalidraw.md are canvas-like, plain md is not', () => {
    assert.equal(isCanvasLike({ path: 'c.canvas', name: 'c.canvas', extension: 'canvas' }), true);
    assert.equal(isCanvasLike({ path: 'x.excalidraw.md', name: 'x.excalidraw.md', extension: 'md' }), true);
    assert.equal(isCanvasLike({ path: 'n.md', name: 'n.md', extension: 'md' }), false);
  });
});
