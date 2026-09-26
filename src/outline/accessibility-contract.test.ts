import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('./outline-controller.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const outlineCss = styles.slice(styles.indexOf('.notion-outline {'));

describe('outline accessibility contract', () => {
  it('uses native buttons for the strip and heading rows', () => {
    assert.ok(controller.includes('createEl("button"'));
    assert.ok(controller.includes('"aria-expanded": "false"'));
    assert.ok(controller.includes('"aria-current", "location"'));
  });

  it('supports focus entry and Escape dismissal', () => {
    assert.ok(controller.includes('addEventListener("focusin"'));
    assert.ok(controller.includes('event.key !== "Escape"'));
  });

  it('does not animate layout width', () => {
    assert.doesNotMatch(outlineCss, /transition\s*:[^;]*\bwidth\b/);
  });

  it('isolates native button layout from host theme button styles', () => {
    assert.ok(styles.includes('.notion-outline > button.notion-outline__strip {'));
    assert.ok(styles.includes('.notion-outline__panel > button.notion-outline__row {'));
  });

  it('respects reduced motion', () => {
    assert.ok(outlineCss.includes('@media (prefers-reduced-motion: reduce)'));
  });
});
