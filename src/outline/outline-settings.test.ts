import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { legacyOutlineDataPath, parseLegacyOutlineSettings } from './outline-settings.ts';

describe('legacy Notion Outline settings import', () => {
  it('points at the old plugin data file inside the config dir', () => {
    assert.equal(legacyOutlineDataPath('.obsidian'), '.obsidian/plugins/notion-outline/data.json');
  });

  it('imports every known key with the right type', () => {
    const raw = JSON.stringify({ minHeadings: 3, showInReadingView: false, disableOnMobile: true });
    assert.deepEqual(parseLegacyOutlineSettings(raw), {
      minHeadings: 3,
      showInReadingView: false,
      disableOnMobile: true,
    });
  });

  it('drops unknown keys and wrongly typed values', () => {
    const raw = JSON.stringify({ minHeadings: '4', showInReadingView: 1, extra: true, disableOnMobile: false });
    assert.deepEqual(parseLegacyOutlineSettings(raw), { disableOnMobile: false });
  });

  it('rejects a non-positive heading threshold', () => {
    assert.deepEqual(parseLegacyOutlineSettings(JSON.stringify({ minHeadings: 0 })), {});
  });

  it('returns {} for a missing file, bad JSON, or a non-object', () => {
    assert.deepEqual(parseLegacyOutlineSettings(null), {});
    assert.deepEqual(parseLegacyOutlineSettings('{not json'), {});
    assert.deepEqual(parseLegacyOutlineSettings('42'), {});
  });
});
