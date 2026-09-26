import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(new URL('./outline-controller.ts', import.meta.url), 'utf8');
const outlineModule = readFileSync(new URL('./outline-module.ts', import.meta.url), 'utf8');
const settings = readFileSync(new URL('./outline-settings.ts', import.meta.url), 'utf8');
const settingsTab = readFileSync(new URL('../settings.ts', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'));

describe('mobile tap does not skip the panel', () => {
  it('gates direct tick navigation behind hover support or an already-expanded panel', () => {
    // A tap on a tick must not call scrollToHeading unconditionally: on a
    // touch device (no hover) the strip is entirely tiled with ticks, so an
    // ungated tap would jump immediately and the titled panel would never
    // become visible.
    assert.match(
      controller,
      /const canNavigate = this\.supportsHover \|\| this\.root\.hasClass\("is-expanded"\);/,
    );
    const onStripClick = controller.slice(controller.indexOf('onStripClick'));
    assert.match(onStripClick, /if \(isValidTick && canNavigate\)/);
  });
});

describe('disable on mobile setting', () => {
  it('declares a disableOnMobile flag defaulting to false', () => {
    assert.ok(settings.includes('disableOnMobile: boolean'));
    assert.ok(settings.includes('disableOnMobile: false'));
  });

  it('exposes a settings toggle for it', () => {
    assert.ok(settingsTab.includes('Disable on mobile'));
  });

  it('gates outline visibility on Platform.isMobile', () => {
    assert.match(outlineModule, /if \(settings\.disableOnMobile && Platform\.isMobile\) return false;/);
  });
});

describe('Composer runs on mobile', () => {
  it('is not desktop-only', () => {
    assert.equal(manifest.isDesktopOnly, false);
  });

  it('loads the hover block handle only off mobile', () => {
    assert.match(main, /if \(!Platform\.isMobile\) this\.loadBlockHandle\(\);/);
  });

  it('never pulls in Node or Electron modules', () => {
    const offenders = [main, controller, outlineModule].filter((src) =>
      /from ['"](node:|electron|fs|path)|require\(/.test(src),
    );
    assert.deepEqual(offenders, []);
  });
});
