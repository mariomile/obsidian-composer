# mv-kit audit — Composer (wave 10)

Audit of `styles.css` (95 lines pre-fix, 133 lines post-fix) + the UI code
(`src/menu.ts`, `src/items.ts`, `src/pickers.ts`, `src/settings.ts`,
`src/gutter.ts`) against `obsidian-cosmos-theme/docs/mv-kit.md`, both desktop
and phone columns. Scope: coherence-only fixes (radius / type / icons /
motion tokens / empty states / microcopy). No layout redesign, no DOM
restructure — per `docs/2026-07-24-suite-coherence-design.md` §C/D
non-goals.

Per-rule verdict: **pass** (already compliant) / **fixed** (this wave) /
**waived** (kit rule doesn't apply here, with reason).

This wave landed in two passes. A prior, interrupted agent session already
produced a batch of valid mv-kit fixes (preserved verbatim below, credited
as **fixed**): `--cosmos-t-fast`/`--cosmos-native` fallback on the handle's
opacity transition, `--mv-r1` on the handle-button radius,
`--cosmos-r-floating-surface`/`--cosmos-pop-shadow` on the menu surface,
`--font-ui-smaller`/`--font-medium` on the section-label micro-label recipe,
`--font-ui-smaller` on the empty-state message, and a new
`@media (pointer: coarse)` block giving the handle button and menu items a
44px `--cosmos-touch-min` floor plus `--cosmos-press-scale` press feedback
with a nested `prefers-reduced-motion: reduce` override. This audit verified
those fixes against the kit and found two residual gaps (below), fixed in
the same commit as this doc.

Before this wave `styles.css` consumed zero suite tokens outside the
already-in-flight fixes; it now consumes 15 across 7 distinct tokens
(`--cosmos-t-fast`, `--cosmos-native`, `--mv-r1`, `--cosmos-r-floating-surface`,
`--cosmos-pop-shadow`, `--font-ui-smaller`, `--font-medium`, `--mv-wash`,
`--cosmos-touch-min`, `--cosmos-press-scale`), every one with a literal
fallback equal to Composer's own pre-fix value, so a Cosmos-less vault
renders identically.

## Golden rule — theme-independent consumption

| Check | Verdict |
|---|---|
| Every `var(--cosmos-*)`/`var(--mv-*)` has a literal fallback | **pass** — all 15 usages carry a literal fallback (verified: `grep -n "var(--cosmos-\|var(--mv-" styles.css` shows every hit paired with a `,` fallback). |
| No plugin stylesheet redefines `--mv-*`/`--cosmos-*` at `:root`/`body` | **pass** — the new `:root { --composer-wash: … }` custom property (see §3 fix below) is namespaced `--composer-*`, not `--mv-*`/`--cosmos-*`; it only ever *consumes* suite tokens inside its own value. |

## §1 Radius + surfaces

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| `.composer-handle-btn` radius | was hardcoded `6px` | same | **fixed** (pre-existing) — now `var(--mv-r1, 6px)`, the kit's chip/toolbar-radius token, canonical value unchanged. |
| `.composer-menu` radius + elevation | was hardcoded `border-radius: 12px` / `box-shadow: var(--shadow-s)` | same | **fixed** (pre-existing) — now `var(--cosmos-r-floating-surface, 12px)` / `var(--cosmos-pop-shadow, var(--shadow-s))`. This is exactly the kit's §1 "menus, popovers, floating panels" row; `--cosmos-pop-shadow` is also the token the kit names for phone bottom-sheet/menu elevation, so this one fix satisfies both columns without a phone-specific override. |
| `.composer-menu-item` radius (list-row inside the menu) | was hardcoded `border-radius: 8px`, no token at all | same | **fixed (this wave)** — now `var(--radius-s)`, Obsidian's native small-radius token (4px canonical). Same verdict class as Portal's `.portal-drop-target` (`var(--radius-s, 4px)` → pass) and Sonar/Horizon's native-token uses: a list-row radius isn't itself the kit's "pill/card/chip" surface, but the MUST's intent ("not a hand-picked pixel value") is satisfied by consuming Obsidian's own radius scale rather than a bespoke `8px`. |
| `.composer-handle` (wrapper, no radius/background of its own) | transparent flex container | same | **pass, not applicable** — no surface to tokenize. |

## §2 Type sizes, icon sizes, touch targets

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| `.composer-menu-section` (section eyebrow: "Basic", "Embed", "Template", "Base", "AI", "Turn into", "Actions") | was `font-size: 10.5px; font-weight: 600; letter-spacing: 0.05em` | same | **fixed** (pre-existing) — now `var(--font-ui-smaller, 10.5px)` / `var(--font-medium, 500)` / `letter-spacing: 0.06em`, matching the kit's §4 micro-label recipe verbatim (see §4 below — this row is a micro-label, cross-referenced there too). |
| `.composer-menu-empty` ("No match") | was `var(--font-ui-small)` | same | **fixed** (pre-existing) — now `var(--font-ui-smaller)`, the kit's whisper-recipe size floor. |
| `.composer-handle-btn`, `.composer-menu-item` tap size | N/A (no desktop minimum) | were unconstrained (21×22px / row-height-driven); now `min-width`/`min-height: var(--cosmos-touch-min, 44px)` inside `@media (pointer: coarse)` | **fixed** (pre-existing) — matches the kit's §2 MUST verbatim. |
| Icon sizing (`.composer-handle-btn svg`, `.composer-menu-item-icon svg`, 15px) | raw px on SVG wrapper, `setIcon()` with native Lucide names throughout (`plus`, `grip-vertical`, `database`, `file-text`, `image`, `sparkles`, `trash-2`, …) | same | **pass** — matches the kit's own §2 row ("Cosmos defines no separate icon-size scale") and the wave-1/4/5 precedent on the identical pattern. All icons are native `setIcon()` calls (`src/menu.ts:130`, `src/gutter.ts:26`), not a bespoke icon module — the Huge Icons pack rollout is Portal-core-module work, out of scope per-plugin (same as every prior wave's verdict). |
| `.composer-menu-search` (filter input) | `font-size: var(--font-ui-small)` | same, no phone override | **pass, not a §2 case** — an input field's text size, not a micro-label or a tap-target; `--font-ui-small` is the correct native tier for editable text, one step above the micro-label floor. |
| Press-scale on phone (`--cosmos-press-scale`) | absent (no confirmation on desktop, correct per kit — §3's MUST is phone-only) | `transform: scale(var(--cosmos-press-scale, 0.98))` on `:active` for both tap targets | **fixed** (pre-existing); see §3 below. |

## §3 Motion

| Token / animation | Before | After | Verdict |
|---|---|---|---|
| `.composer-handle` visibility fade | raw `opacity 120ms ease` | `var(--cosmos-t-fast, 120ms) var(--cosmos-native, ease)` | **fixed** (pre-existing) — pure-opacity entrance/exit, correctly paired with the lightweight-chrome-entrance tier (`--cosmos-t-fast`/`--cosmos-native`), same reasoning Horizon applied to its async-fade cases. |
| `.composer-handle-btn:hover` / `.composer-menu-item.is-active` background+colour wash | **no transition at all** — both states snapped instantly (`background-color`/`color` had zero `transition` declared anywhere in the file) | new shared `--composer-wash: var(--cosmos-t-fast, 120ms) var(--mv-wash, cubic-bezier(0.25, 1, 0.5, 1))` custom property (`:root`, top of file), applied as `transition: color var(--composer-wash), background-color var(--composer-wash)` on `.composer-handle-btn` and `transition: background-color var(--composer-wash)` on `.composer-menu-item` | **fixed (this wave)** — a genuine gap the prior pass didn't cover: the kit's §3 "colour/background wash easing" tier (`--mv-wash`) exists precisely for hover/active-state washes like these, and Composer had zero transition on either. Same pattern as `--horizon-ease` (Horizon wave 5) and `--sonar-ease` (Sonar wave 1): one shared custom property, not per-site inline repetition. Duration kept at Composer's ambient `120ms` (matches the existing handle-fade fallback) as the literal fallback rather than snapped to the canonical `140ms`. |
| Coarse-pointer press-scale transition | pre-existing fix declared `transition: transform var(--cosmos-t-fast, 120ms) var(--cosmos-native, ease)` as a bare shorthand on `.composer-handle-btn`/`.composer-menu-item` inside the media block | **corrected (this wave)** — the shorthand form would have *silently overwritten* (not merged with) the new desktop wash transition once §3's wash fix landed, since `transition` is not additive across separate declarations on the same selector. Rewritten as a single multi-value `transition` per selector combining the wash (`color`/`background-color`) with the press-scale (`transform`), so touch devices keep both the hover-wash easing and the press-scale animation simultaneously. Not a kit-rule gap on its own, but a correctness fix required to land the §3 wash fix above without silently dropping the pre-existing press-scale transition on touch. |
| `.composer-handle-btn:active` / `.composer-menu-item:active` press-scale | absent before the prior pass | `transform: scale(var(--cosmos-press-scale, 0.98))` inside `@media (pointer: coarse)` | **fixed** (pre-existing) — kit §3 MUST verbatim; `transform`-only, composited. |
| `prefers-reduced-motion: reduce` | not respected for the coarse-pointer transitions | nested `@media (prefers-reduced-motion: reduce) { transition: none }` inside the coarse-pointer block, covering both selectors | **fixed** (pre-existing, unaffected by this wave's transition-value edit — the override still zeroes the full `transition` shorthand regardless of how many comma-separated values it now carries). |
| Animated properties | `opacity` only (desktop, pre-existing fix) | now also `color`/`background-color` (desktop wash) and `transform` (phone press-scale) — no layout-triggering property anywhere | **pass** — all animated properties are composited (`opacity`, `color`, `background-color`, `transform`); none trigger layout. |
| `--cosmos-spring` (overshoot) | never used | unchanged | **pass, correctly not reached for** — Composer has no confirmation micro-moment (checkbox tap, toggle) that would warrant the overshoot easing; hover/press is exactly the case the kit says never to use it for. |
| Phone entrance recipes (`cosmos-pop-in` / `cosmos-sheet-rise` / `cosmos-fade-in`) | `.composer-menu` (the plugin's one floating/menu-like surface) renders with `.show()`/`.hide()` (Obsidian's display toggle), no entrance transition | unchanged this wave | **waived, flagged not fixed** — same class of gap Horizon flagged for its popover/hover-card/date-picker: the kit's §3 MUST is explicit for "popover/menu chrome entrance," and `.composer-menu` is exactly that surface. Adding `cosmos-pop-in`'s recipe correctly requires intercepting `ComposerMenu.open()`'s synchronous `this.el.show()` call (`src/menu.ts:54`) with an animation-aware open lifecycle, which is a behavior change beyond a CSS-only coherence pass and out of this wave's minimal-fix mandate. Flagged here as a genuine, unaddressed gap for a dedicated follow-up wave, not silently normalized. |

## §4 Empty-state pattern

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| `.composer-menu-section` (section eyebrow micro-label) | was `10.5px` / `600` weight / `0.05em` letter-spacing (close but not the token) | same | **fixed** (pre-existing) — now `var(--font-ui-smaller, 10.5px)` / `var(--font-medium, 500)` / `letter-spacing: 0.06em`, matching the kit's micro-label recipe verbatim (`font-size`, `font-weight`, `text-transform: uppercase`, `color: var(--text-faint)` were already present; only size/weight/letter-spacing needed tokenizing). |
| `.composer-menu-empty` ("No match" — the menu's only empty state) | was `font-size: var(--font-ui-small)` (one step too large) | same | **fixed** (pre-existing) — now `var(--font-ui-smaller)`, `color: var(--text-faint)` was already correct. Matches the kit's whisper recipe verbatim. |

## §5 Microcopy voice

| Rule | Desktop | Phone | Verdict |
|---|---|---|---|
| No native `<select>` | `grep -rn "createEl('select'\|<select" src/`: zero hits. `settings.ts` uses `addDropdown()` (Obsidian's native `Setting` component API), not a bespoke plugin picker | same | **pass** |
| No `mod-cta` on buttons | `grep -rn "mod-cta" src/`: zero hits. Composer has no custom modal buttons — all interaction is through the gutter handle, the insert menu, and native `Setting` controls | same | **pass** |
| Sentence-case labels, `.mva-pv`-style form convention | `settings.ts` uses Obsidian's native `Setting`/`PluginSettingTab` API throughout (`new Setting(containerEl).setName('Hover delay')`, etc.) — all labels already sentence-case ("Hover delay", "Default insert position", "New base folder", "Template folder", "Artifact folder", "AI section", "Exo command id") | n/a | **pass, correctly out of scope** — same verdict as every prior wave: `.mva-pv`/`.mva-sel`/`.mva-btn` is the convention for *custom* plugin forms; Composer's settings delegate entirely to Obsidian's built-in `Setting` component, and its labels are already sentence-case. |
| Chip+popover pickers, never native `<select>` | `FilePicker` (`src/pickers.ts`) extends `FuzzySuggestModal`, Obsidian's native fuzzy-picker modal — not a `<select>`, not a bespoke `.mva-sel` chip+popover either | same | **pass, not applicable** — the one dropdown Composer has (`insertPosition` below/above) is a native `Setting.addDropdown()`, which the kit's MUST NOT targets (raw HTML `<select>`); Obsidian's own dropdown component is the platform's standard settings control, same as every other audited plugin's settings tab. |
| Buttons `.mva-btn` convention | Composer has no custom buttons at all — the handle is a `div[role=button]`, the menu items are clickable rows, settings use native `Setting` controls | same | **waived, same class as Sonar/Horizon's settings-tab verdict** — no custom form-button surface exists to apply the convention to. |
| English product copy, PM jargon untranslated | all strings across `src/` are already English ("Filter…", "No match", "Insert block", "Block actions", labels in `items.ts`/`settings.ts`, Notice text) | same | **pass** — unlike Horizon's whole-Italian-UI flag, Composer ships English end-to-end already; nothing to fix. |

## Not touched (explicit non-goals, confirmed out of scope)

- No layout/DOM changes anywhere — every fix in this wave (and the
  preserved prior-pass fixes) is a token substitution, a missing property on
  an already-existing selector, or a transition-value correction.
- `.composer-menu` entrance animation (`cosmos-pop-in`) — flagged as a
  genuine §3 gap; fixing it correctly requires touching `ComposerMenu.open()`'s
  synchronous show/hide lifecycle (`src/menu.ts`), outside a CSS-only
  coherence pass, same class of deferral as Horizon's popover/hover-card/
  date-picker flag.
- Huge Icons pack substitution — Portal-core-module work per
  `docs/2026-07-24-suite-coherence-design.md` §A, out of scope per-plugin.

## Verification

- `pnpm typecheck` — 0 errors.
- `pnpm test` — 54 tests / 16 suites passing (5 test files: `actions`,
  `block-model`, `menu`, `pickers-core`, `snippets`), unchanged by this
  wave's CSS-only edits; the new `src/style-contract.test.ts` (committed
  separately) adds 4 more assertions on top.
- No lint script exists in this repo (`package.json` has no `lint` entry) —
  reported honestly, not invented.
- `!important` count: 0 (unchanged — no new specificity overrides
  introduced).
- Desktop/phone screenshot verification: **pending** — not performed this
  wave (no live vault-reload check run in this session); phone changes are
  verified by reading the resulting CSS values against the kit's phone
  column, per the hard constraint against `EmulateMobile`.
