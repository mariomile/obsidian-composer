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

---

# §6 — wave 2026-07 dinamica

Audit of `styles.css` (136 lines, unchanged by this wave — see verdict
below) + `src/gutter.ts`/`src/menu.ts`/`src/main.ts` against
`obsidian-cosmos-theme/docs/mv-kit.md` §6 ("Elevation & motion depth",
landed cosmos-theme commit `10f5ddc`), both desktop and phone columns.
Scope: the four §6 sub-rules only (elevation hierarchy, hover richness,
drag polish, panel/tab transitions) — coherence-only, no layout redesign,
no new components, matching the model waves' non-goals
(obsidian-portal `389d564`, obsidian-tabx `cc65cd4`).

**Structural note carried through every row below:** `manifest.json` sets
`"isDesktopOnly": true` — Composer never loads on phone at all (confirmed,
not assumed: `cat manifest.json`). Every "Phone" column in this section is
therefore N/A by construction, not by per-surface judgement — recorded once
here rather than repeated seven times in the tables.

## Elevation hierarchy

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| `.composer-menu` (insert/actions menu) `box-shadow` | `var(--cosmos-pop-shadow, var(--shadow-s))` (landed wave 10) | N/A — desktop-only plugin | **pass, already compliant** — this is exactly the kit's Pop tier definition (menu/popover/dropdown, closes on outside-click); `src/menu.ts`'s `close()` is wired to a document-level outside-click listener, confirming the dismiss behaviour matches the tier. Re-verified this wave, not re-fixed — wave 10 already landed this token correctly. |
| `.composer-handle` (the floating +/⋮⋮ gutter button pair) | no `box-shadow` at all — flat, borderless, icon-only buttons on a transparent flex wrapper | N/A | **pass, correctly Flat tier** — the handle is inline chrome that appears next to the cursor's line, not a floating/dismissable surface in §6's sense (it disappears on `mousemove` leaving the gutter zone, not on outside-click); no shadow is the correct answer, matching the kit's Flat-tier row verbatim. |
| Two tiers stacked on one element (Pop shadow **and** glass blur) | not present | not present | **pass, not applicable** — `grep -n "blur\|glass" styles.css`: zero hits. Nothing to stack. |
| Island / Glass tier surfaces of Composer's own | none exist | none exist | **waived, nothing to tokenize** — Composer renders no persistent sidebar/panel and no glass-blur command-bar-style surface; its only floating chrome is the one Pop-tier menu above. |

## Hover richness

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| `.composer-handle-btn:hover` | colour wash only (`color` + `background`), ungated by `@media (hover: hover)` | N/A — `isDesktopOnly: true`, and independently the handle itself never renders on touch: its only show trigger is `document.addEventListener('mousemove', …)` in `src/main.ts` (`registerDomEvent(document, 'mousemove', …)`), with no `touchstart`/`pointerdown`/click-to-reveal path anywhere in `gutter.ts` or `main.ts` — confirmed via `grep -n "touchstart\|pointerdown\|showAt" src/main.ts src/gutter.ts`, the only call site of `showAt()` is inside the mousemove handler | **pass, correctly colour-only; hover-gate MUST does not apply** — the kit's ungated-hover MUST NOT is scoped to "phone-reachable elements" specifically (its own wording: "plugins must not fight it with custom `:hover` outside that media query on phone-reachable elements"). `.composer-handle-btn` fails that precondition twice over (desktop-only manifest, and a mouse-only reveal mechanism even hypothetically on a touch build), so there is no stuck-hover failure mode to gate against. Left ungated deliberately, not overlooked — gating it would be adding a no-op media query, not fixing anything. Richness itself (wash, no lift) is correct: this is a small icon-button row action, the kit's own `.row:hover` case, not a `.card:hover` case. |
| `.composer-menu-item.is-active` (keyboard/mouse selection highlight inside the menu) | colour wash (`background`), driven by a `.is-active` class toggle in `src/menu-core.ts`, not a `:hover` pseudo-class | N/A | **pass, not a hover surface** — selection state is applied via class toggle (keyboard arrow-navigation and mouse-move both call the same `setActive` path), so it was never a candidate for the hover-gate MUST in the first place; correctly colour-only richness for a list row. |
| `--mv-wash` vs `--mv-lift` used correctly | `--composer-wash` (the file's one shared transition custom property, defined `:root`-scoped but itself namespaced `--composer-*`, not `--mv-*`/`--cosmos-*`) resolves to `var(--cosmos-t-fast, 120ms) var(--mv-wash, cubic-bezier(0.25, 1, 0.5, 1))` — pure colour-wash easing | same | **pass, verified not assumed** — `grep -n "mv-lift\|mv-wash" styles.css`: zero `--mv-lift` occurrences anywhere in the file (Composer has no lift/transform hover in it to mis-tag), one `--mv-wash` consumption site, used correctly on the only two colour-transition sites (`.composer-handle-btn`, `.composer-menu-item`). No mixing to fix. |

## Drag polish

| Surface | Desktop | Phone | Verdict |
|---|---|---|---|
| Any Composer-owned drag interaction (`.is-dragging`/`.is-dropped` or equivalent) | **does not exist** | N/A | **waived, nothing to audit.** Verified, not assumed: `grep -n "draggable\|dragstart\|dragover\|\bdrop\b" src/*.ts` (excluding test files) returns zero hits. The two `.style.left`/`.style.top` writes in the codebase (`gutter.ts:35-36`, `menu.ts:61-62`) are one-shot *positioning* on open (placing the handle/menu next to the cursor), not drag-frame updates — neither element is ever draggable, and neither writes `left`/`top` on a pointer-move loop the way a real drag would. No conflict with native drag to verify either, since Composer has no draggable element for native drag to conflict with. |

## Panel & tab transitions

| Motion | Desktop | Phone | Verdict |
|---|---|---|---|
| Panel/sidebar open-close | Composer owns no persistent panel/sidebar | N/A | **waived, not applicable** — Composer's only chrome is the transient handle (Flat, mousemove-driven) and the transient menu (Pop, click-to-open/outside-click-to-close); neither is a persistent layout panel in §6's sense. |
| Tab-content swap (crossfade vs. slide) | Composer renders no tab-content swap of its own | N/A | **waived, not applicable** — no tab surface exists anywhere in the plugin; `grep -n "@keyframes\|slide" styles.css`: zero hits. |
| `.composer-menu` open/close | uses Obsidian's `.show()`/`.hide()` display toggle (`src/menu.ts`), no transition at all on open | N/A | **pre-existing gap, re-confirmed not re-litigated this wave** — already flagged as a genuine, deliberately-deferred §3 finding in wave 10's audit (the `cosmos-pop-in` entrance recipe), not a §6 duration/easing-tier defect: there's no transition to put on the wrong tier because there's no transition at all yet. Re-reading it under §6 doesn't change the verdict or reopen the deferral; flagged once, in wave 10, stays flagged there. Not duplicated as a new §6 finding to avoid the audit trail double-counting the same gap under two section headers. |

## Style contract — no new assertions

No §6 violation was found to fix this wave, so per the brief's own
instruction ("If the audit found full compliance, leave the test file
untouched"), `src/style-contract.test.ts` is untouched — zero speculative
assertions added. The existing 4 assertions (raw-value scan, comment-
integrity guards, `!important` ceiling) continue to pass unmodified.

## Not touched (explicit non-goals, confirmed out of scope)

- No CSS changes anywhere — `styles.css` is byte-identical before and
  after this wave (`git diff --stat` for this wave shows no hunk against
  the file; verified via `shasum` before starting and again before
  committing this doc).
- `.composer-handle-btn:hover`'s hover-gate was evaluated and deliberately
  left ungated — see the Hover richness row above for the two independent
  reasons (desktop-only manifest, mouse-only reveal mechanism) that make
  the kit's stuck-hover MUST NOT inapplicable here, not overlooked.
- `.composer-menu`'s missing open-transition (`cosmos-pop-in`) stays
  flagged under wave 10's §3 finding, not re-opened or re-fixed here — it
  is a "no transition exists yet" gap (§3's entrance-animation MUST),
  distinct from this wave's §6 scope (which governs the *tier* of an
  existing transition, and whether hover/drag/panel motion already present
  uses the right easing/duration).

## Verification

- `pnpm release:check` (test + typecheck + build) — **exit 0**. Real
  numbers from this wave's run: **58 tests / 17 suites, 58 pass / 0 fail**
  (54 pre-existing + the 4 `style-contract.test.ts` assertions landed in
  wave 10, both counted together now that the glob picks the file up;
  no new test added this wave, per the brief — full compliance means the
  test file stays untouched). `tsc --noEmit` — 0 errors. `esbuild.config.mjs
  production` — build succeeded.
- No lint script exists in this repo (`package.json` has no `lint` entry)
  — reported honestly, same as wave 10, not invented for this wave.
- `!important` count: 0 (unchanged — no CSS edited).
- Desktop/phone screenshot verification: **pending**, same standing
  constraint as wave 10 — not performed this wave; Composer's
  `isDesktopOnly: true` manifest and the mouse-only reveal path for its one
  hover surface are verified by reading `manifest.json` and `src/*.ts`
  against the kit's phone column, not by rendering on a device (and
  `EmulateMobile` was not used, per the hard constraint against it killing
  Node-dependent plugins).
