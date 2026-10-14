import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const outlineModule = readFileSync(new URL('./outline-module.ts', import.meta.url), 'utf8');

describe('metadata refresh is debounced per view', () => {
  it('creates one debouncer per controller, not one shared by all views', () => {
    // A shared debounce keeps only the last call, so with the same note open
    // in two panes only the last pane's outline would refresh.
    assert.match(outlineModule, /refreshers = new Map<MarkdownView, Debouncer<\[\], void>>\(\)/);
    assert.match(outlineModule, /this\.refreshers\.set\(view, debounce\(\(\) => this\.refreshView\(view\), 150, true\)\)/);
    assert.equal(outlineModule.match(/debounce\(/g)?.length, 1);
  });

  it('fires every matching view debouncer on a metadata change', () => {
    const onMeta = outlineModule.slice(outlineModule.indexOf('private onMetaChanged'));
    assert.match(onMeta, /for \(const \[view, refresh\] of this\.refreshers\)/);
  });

  it('cancels a view debouncer when its controller is destroyed', () => {
    const sync = outlineModule.slice(outlineModule.indexOf('private syncControllers'));
    assert.match(sync, /this\.refreshers\.get\(view\)\?\.cancel\(\);\s*this\.refreshers\.delete\(view\);\s*ctrl\.destroy\(\);/);
    const unload = outlineModule.slice(outlineModule.indexOf('onunload()'));
    assert.match(unload, /for \(const r of this\.refreshers\.values\(\)\) r\.cancel\(\);/);
  });
});
