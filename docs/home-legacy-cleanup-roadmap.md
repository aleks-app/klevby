# Home legacy cleanup roadmap

This roadmap is a planning/audit artifact only. It does not authorize deleting old Home in one pass, and it must not be used to justify UI, geometry, TouchBar, weather, feed/ad, route, background, or header movement changes inside cleanup PRs.

## 1. Current proven facts

These facts are proven by the latest installed PWA diagnostics and do **not** need full re-diagnosis before every cleanup PR:

- The new Figma Home redesign is visually active in the installed PWA.
- The no-console Home diagnostics overlay works on the Figma Home through the 7-tap flow and Copy JSON.
- The measured viewport was `440 x 956`.
- The feed/ad shell measured `top=505`, `bottom=748`, `height=243`.
- The weather shell measured `top=760`, `bottom=835`, `height=75`.
- The TouchBar measured `top=847`, `bottom=917`, `height=70`.
- The feed/ad-to-weather gap was `12px`.
- The weather-to-TouchBar gap was `12px`.
- Lower rhythm was therefore within the required `<= 2px` tolerance.
- `horizontalOverflowPx` was `0`.
- `verticalOverflowPx` was `0`.
- `weatherOverlapsTouchBar` was `false`.
- `weatherBridge.source` was `"state"`.
- `weatherBridge.hasState` was `true`.
- Weather bridge temperature, wind, pressure, and bite fields were populated.
- The old `#forecastPanel`, `.home-weather-card`, and `.home-feed-preview` still exist but are hidden under the active Figma Home.

### What this means for future PRs

Future PRs only need **targeted regression proof** against the fields listed in this roadmap. They do not need to re-prove the whole Figma Home layout from scratch unless a STOP condition appears.

## 2. Remaining blockers to old Home deletion

Old Home cannot be deleted yet because these dependencies may still be active or used as fallbacks:

1. `assets/js/weather.js` writes to old weather DOM IDs and must publish `KlevGoWeatherState` even when those nodes are absent.
2. The Figma weather bridge may still read old weather DOM as a fallback.
3. `assets/js/app/app-home-screen-owner.js` still references old Home slots such as `.home-quick-actions`, `.home-feed-preview`, `.home-weather-card`, and feed-preview cards.
4. The old feed preview rotator script and DOM still exist.
5. Figma header behavior delegates to old burger/profile/menu nodes: `#mobileMenu`, `#burgerBtn`, `.mobile-menu-wrap`, `#mobileProfileBtn`, and `#mobileProfileAvatarIcon`.
6. Home CSS tokens still come from the current Home mobile/grid/shell system, so CSS cleanup must wait until geometry owner proof exists.
7. TouchBar and fixed Figma shells depend on Home geometry variables, so any cleanup touching shell variables is high risk.

## 3. Exact 5-step PR roadmap

### PR 1 — Make weather state independent from old weather DOM

**Goal:** `weather.js` must publish complete `KlevGoWeatherState` data even if old weather elements are missing.

**Allowed to touch:**

- `assets/js/weather.js`
- Weather-state diagnostics only if they already exist in a weather diagnostics owner.
- Documentation/checklist updates directly related to this proof.

**Must NOT touch:**

- `index.html` old weather DOM deletion.
- Figma weather UI markup or styling.
- Home geometry owners.
- TouchBar, header, routes, feed/ad shell, or Home background.

**Checks/tests after PR:**

```bash
node --check assets/js/weather.js
git diff --check
rg -n "KlevGoWeatherState|forecastPanel|weatherStatus|weatherTemp|weatherWind|weatherPressure|weatherMoon|biteForecast|homeWeatherModeIcon|homeWeatherTempChip|homeWeatherWindChip|homeWeatherPressure|homeWeatherBiteChip|homeWeatherCondition" assets/js/weather.js assets/js/app index.html
```

**PWA diagnostics JSON fields user must send:**

- `weatherBridge.source`
- `weatherBridge.hasState`
- `weatherBridge.tempText`
- `weatherBridge.windText`
- `weatherBridge.pressureText`
- `weatherBridge.biteText` or equivalent bite field
- `visibleBlocks.weatherShell`
- `overflow.weatherOverlapsTouchBar`

**PASS means:**

- `weatherBridge.hasState === true`.
- `weatherBridge.source === "state"`.
- Temperature, wind, pressure, and bite fields are populated.
- Weather shell remains visible.
- `weatherOverlapsTouchBar === false`.
- Static review shows state publication is not inside branches that require old DOM nodes.

**STOP / rollback means:**

- `hasState` becomes false.
- Source falls back to old DOM unexpectedly.
- Any weather field becomes blank/placeholder when data should be available.
- Weather shell disappears or overlaps TouchBar.

**Can be deleted only after this proof:**

- Nothing visual yet.
- Only optional old DOM write paths inside `weather.js` may become removable candidates for PR 5; do not delete old DOM in PR 1.

---

### PR 2 — Decouple Figma weather bridge from old weather DOM fallback

**Goal:** Figma weather must render from state-only data, with diagnostics proving old DOM is not the active source.

**Allowed to touch:**

- `assets/js/app/app-home-figma-weather-bridge.js`
- Figma weather diagnostics fields.
- Minimal docs for diagnostics expectations.

**Must NOT touch:**

- Weather shell visuals or CSS.
- `#forecastPanel` / `.home-weather-card` deletion.
- Home geometry owner.
- TouchBar, header, routes, feed/ad shell, or background.

**Checks/tests after PR:**

```bash
node --check assets/js/app/app-home-figma-weather-bridge.js
git diff --check
rg -n "homeWeatherModeIcon|homeWeatherTempChip|homeWeatherWindChip|homeWeatherPressure|homeWeatherBiteChip|homeWeatherCondition|biteForecast|forecastPanel|home-weather-card" assets/js/app/app-home-figma-weather-bridge.js assets/js/weather.js index.html
```

**PWA diagnostics JSON fields user must send:**

- `weatherBridge.source`
- `weatherBridge.hasState`
- `weatherBridge.tempText`
- `weatherBridge.windText`
- `weatherBridge.pressureText`
- `weatherBridge.biteText` or equivalent bite field
- `visibleBlocks.weatherShell`
- `gaps.weatherToTouchBar`
- `overflow.weatherOverlapsTouchBar`

**PASS means:**

- `weatherBridge.source === "state"`.
- `weatherBridge.hasState === true`.
- All Figma weather fields are populated without depending on old DOM reads.
- Weather-to-TouchBar gap remains within current proven rhythm tolerance.

**STOP / rollback means:**

- Figma weather source becomes `dom`, `fallback`, `missing`, or equivalent non-state source.
- Weather text/icons regress to placeholders.
- Weather shell moves, disappears, or overlaps TouchBar.

**Can be deleted only after this proof:**

- Old weather DOM may become eligible for deletion **only after PR 4**, not immediately after PR 2, because geometry and CSS may still reference `.home-weather-card` / `#forecastPanel`.

---

### PR 3 — Decouple Home geometry owner from old visual slot measurements

**Goal:** Home geometry owner should rely on shell, TouchBar, Figma content, and published tokens, not hidden old slots.

**Allowed to touch:**

- `assets/js/app/app-home-screen-owner.js`
- `assets/js/app/app-home-figma-box-diagnostics.js` only for candidate/source reporting.
- Minimal diagnostic docs.

**Must NOT touch:**

- CSS layout values unless a diagnostic field name needs support and no visual value changes.
- TouchBar CSS/JS.
- Figma shell positioning.
- Old DOM deletion.
- Weather bridge behavior from PR 2.

**Checks/tests after PR:**

```bash
node --check assets/js/app/app-home-screen-owner.js
node --check assets/js/app/app-home-figma-box-diagnostics.js
git diff --check
rg -n "home-quick-actions|home-feed-preview|home-weather-card|forecastPanel|hero-copy|\\.hero" assets/js/app/app-home-screen-owner.js assets/js/app/app-home-figma-box-diagnostics.js assets/css/screens/home-mobile.css assets/css/modules/home/home-grid-foundation.css index.html
```

**PWA diagnostics JSON fields user must send:**

- `visibleBlocks.feedAdShell`
- `visibleBlocks.weatherShell`
- `visibleBlocks.touchBar`
- `gaps.feedAdToWeather`
- `gaps.weatherToTouchBar`
- `overflow.horizontalOverflowPx`
- `overflow.verticalOverflowPx`
- `overflow.weatherOverlapsTouchBar`
- `candidates.feedShell.selectedVisibleCandidate`
- `candidates.weatherShell.selectedVisibleCandidate`
- `fixedValueHints`

**PASS means:**

- Selected visible feed candidate is the Figma feed/ad shell, not `.home-feed-preview`.
- Selected visible weather candidate is the Figma weather shell, not `.home-weather-card` or `#forecastPanel`.
- Feed/ad-to-weather and weather-to-TouchBar gaps still match within `<= 2px`.
- Horizontal and vertical overflow remain `0`.
- No fixed-value hints indicate new hardcoded geometry.

**STOP / rollback means:**

- Geometry candidate selection reverts to old hidden slots.
- Gap delta is greater than `2px`.
- Any overflow becomes positive.
- `weatherOverlapsTouchBar === true`.
- Fixed-value hints expose a new magic height/padding/viewport patch.

**Can be deleted only after this proof:**

- Old visual Home DOM can be removed in PR 4 in small chunks.
- Old CSS selectors tied only to removed visual DOM become candidates for PR 5 after search proof.

---

### PR 4 — Remove old hidden visual Home DOM in small chunks

**Goal:** Delete old hidden Home markup only after weather and geometry are proven independent.

**Allowed to touch:**

- `index.html` old hidden Home DOM chunks:
  - Old hero copy/chips if not used by active Figma header/home.
  - Old quick action cards.
  - Old feed preview internals.
  - Old `#forecastPanel` and `.home-weather-card` only after PR 1, PR 2, and PR 3 proofs are all passing.
- Script tags for scripts that become unreachable only if the owning DOM is removed and static searches prove no other route uses them.

**Must NOT touch:**

- Active Figma Home shell markup.
- Header/logo positioning.
- TouchBar.
- Routes/navigation behavior.
- Home CSS tokens or geometry variables.
- Weather UI appearance.

**Checks/tests after PR:**

```bash
git diff --check
rg -n "forecastPanel|weatherStatus|weatherTemp|weatherWind|weatherPressure|weatherMoon|biteForecast|homeWeatherModeIcon|homeWeatherTempChip|homeWeatherWindChip|homeWeatherPressure|homeWeatherBiteChip|homeWeatherCondition|homeFeedPreviewRotator|home-feed-preview|home-weather-card|home-quick-actions" index.html assets/js assets/css
rg -n "app-home-feed-preview-rotator" index.html assets/js
```

If any JS file is touched:

```bash
node --check <changed-js-file>
```

**PWA diagnostics JSON fields user must send:**

- `weatherBridge.source`
- `weatherBridge.hasState`
- `weatherBridge.tempText`
- `weatherBridge.windText`
- `weatherBridge.pressureText`
- `visibleBlocks.feedAdShell`
- `visibleBlocks.weatherShell`
- `visibleBlocks.touchBar`
- `gaps.feedAdToWeather`
- `gaps.weatherToTouchBar`
- `overflow.horizontalOverflowPx`
- `overflow.verticalOverflowPx`
- `overflow.weatherOverlapsTouchBar`
- `candidates.feedShell.selectedVisibleCandidate`
- `candidates.weatherShell.selectedVisibleCandidate`

**PASS means:**

- No active diagnostics candidate points to removed old DOM.
- Weather remains state-sourced and populated.
- Figma feed/ad shell, weather shell, and TouchBar remain visible.
- Gaps remain matched within `<= 2px`.
- Overflow remains `0`.

**STOP / rollback means:**

- Home diagnostics overlay cannot open/copy JSON.
- Figma Home loses feed/ad, weather, TouchBar, burger/profile/action cards, or background.
- Weather data disappears or falls back unexpectedly.
- Search finds required runtime code still querying a removed DOM node without null-safe behavior.

**Can be deleted only after this proof:**

- DOM-specific CSS and JS remnants become final cleanup candidates for PR 5.

---

### PR 5 — Remove old CSS/JS remnants after search proof

**Goal:** Remove legacy Home visual CSS rules, old feed rotator JS, old DOM-specific weather writes, and cleanup diagnostics only after removed DOM is proven unused.

**Allowed to touch:**

- `assets/css/screens/home-mobile.css` old visual Home rules.
- `assets/css/modules/home/home-grid-foundation.css` old visual grid rules that no longer match active DOM.
- `assets/js/app/app-home-feed-preview-rotator.js` and its script tag only if PR 4 removed `#homeFeedPreviewRotator`.
- Old DOM write/read branches in `assets/js/weather.js` only if PR 1/2 proved state-only rendering.
- Diagnostic candidate lists only to remove deleted old selectors.

**Must NOT touch:**

- Active Figma Home CSS.
- TouchBar CSS/JS.
- Header/menu/profile behavior.
- Route names or navigation.
- Weather visual design.
- Geometry tokens such as `--klevby-home-lower-fill-y` unless the change is purely deleting unused references proven dead.

**Checks/tests after PR:**

```bash
node --check assets/js/weather.js
node --check assets/js/app/app-home-figma-box-diagnostics.js
node --check assets/js/app/app-home-screen-owner.js
git diff --check
rg -n "forecastPanel|weatherStatus|weatherTemp|weatherWind|weatherPressure|weatherMoon|biteForecast|homeWeatherModeIcon|homeWeatherTempChip|homeWeatherWindChip|homeWeatherPressure|homeWeatherBiteChip|homeWeatherCondition|homeFeedPreviewRotator|home-feed-preview|home-weather-card|home-quick-actions" index.html assets/js assets/css
rg -n "height -|633px|iPhone|Samsung|Pixel|deviceName|userAgent.*Home|--klevby-home-lower-fill-y" assets/js assets/css
```

**PWA diagnostics JSON fields user must send:**

- `weatherBridge.source`
- `weatherBridge.hasState`
- `weatherBridge.tempText`
- `weatherBridge.windText`
- `weatherBridge.pressureText`
- `visibleBlocks.feedAdShell`
- `visibleBlocks.weatherShell`
- `visibleBlocks.touchBar`
- `gaps.feedAdToWeather`
- `gaps.weatherToTouchBar`
- `overflow.horizontalOverflowPx`
- `overflow.verticalOverflowPx`
- `overflow.weatherOverlapsTouchBar`
- `candidates.feedShell.selectedVisibleCandidate`
- `candidates.weatherShell.selectedVisibleCandidate`
- `fixedValueHints`

**PASS means:**

- Old selector search returns no runtime dependencies, or only documented compatibility comments slated for later deletion.
- State-only weather remains active and populated.
- Figma shells remain selected and visible.
- Gaps remain matched within `<= 2px`.
- Overflow remains `0`.
- No device hardcodes or magic viewport formulas are introduced.

**STOP / rollback means:**

- Any active UI regresses.
- Diagnostics source/candidates are missing or stale because cleanup removed needed diagnostics.
- Old selectors remain in runtime code and are not explicitly justified.
- Any new hardcoded device/height formula appears.

## 4. Per-PR acceptance criteria summary

| PR | Minimum PASS |
| --- | --- |
| PR 1 | Weather state publishes fully without requiring old weather nodes. |
| PR 2 | Figma weather renders from `weatherBridge.source === "state"` only. |
| PR 3 | Geometry candidates select Figma shells, not old hidden Home slots. |
| PR 4 | Old hidden DOM chunks removed with no visible or diagnostic regression. |
| PR 5 | Old CSS/JS remnants removed with search proof and no geometry regression. |

## 5. Per-PR rollback triggers summary

Rollback or stop immediately if any of these appear after any PR:

- Diagnostics overlay cannot be opened by 7 taps or Copy JSON fails.
- `weatherBridge.hasState` becomes false.
- `weatherBridge.source` is not `"state"` after PR 2.
- Feed/ad shell, weather shell, or TouchBar is not visible.
- `Math.abs(gaps.feedAdToWeather - gaps.weatherToTouchBar) > 2`.
- `overflow.horizontalOverflowPx > 0` or `overflow.verticalOverflowPx > 0`.
- `overflow.weatherOverlapsTouchBar === true`.
- Selected visible candidates point to deleted or hidden old Home DOM after PR 3.
- Static search finds non-null-safe runtime dependency on a deleted old ID/class.
- Any phone model, device name, one-off media query, or magic viewport formula is introduced.

## 6. Files likely touched per PR

| PR | Likely files |
| --- | --- |
| PR 1 | `assets/js/weather.js` |
| PR 2 | `assets/js/app/app-home-figma-weather-bridge.js`, maybe `assets/js/app/app-home-figma-box-diagnostics.js` |
| PR 3 | `assets/js/app/app-home-screen-owner.js`, `assets/js/app/app-home-figma-box-diagnostics.js` |
| PR 4 | `index.html`; possibly `assets/js/app/app-home-feed-preview-rotator.js` script tag removal only after proof |
| PR 5 | `assets/css/screens/home-mobile.css`, `assets/css/modules/home/home-grid-foundation.css`, `assets/js/weather.js`, `assets/js/app/app-home-screen-owner.js`, `assets/js/app/app-home-figma-box-diagnostics.js`, deletion of `assets/js/app/app-home-feed-preview-rotator.js` if unused |

## 7. Files that must not be touched until final cleanup proof

### Do not touch until final

- TouchBar owners and styling unless a separate TouchBar bug is proven:
  - `assets/css/mobile/mobile-tabbar.css`
  - `assets/css/layout/bottom-nav.css`
  - TouchBar navigation/runtime files
- Header/logo/menu/profile movement or redesign:
  - `assets/css/layout/header.css`
  - `assets/js/app/app-home-figma-header.js` except for a separate, scoped header-delegation PR
- Routes/navigation names and screen switching.
- Active Figma Home shell markup and CSS.
- Home background assets/styles.
- Geometry tokens and lower rhythm token distribution unless PR 3 diagnostics prove a cleanup is safe.

### Can migrate now

- Weather data publication can migrate to state-first/null-safe logic.
- Figma weather bridge can migrate to state-only render logic.
- Diagnostics can identify whether selected candidates are Figma shells or legacy slots.

### Can delete after PR 1

- No visible DOM.
- Only unreachable or redundant old weather write helpers inside `weather.js` may become candidates, but deletion should wait for PR 5 unless they are provably internal and no-op.

### Can delete after PR 3

- Old hidden visual Home DOM can be deleted in PR 4 chunks if diagnostics prove Figma shell candidates are selected.
- Old feed preview internals can be deleted if the Figma ad shell no longer uses the rotator.
- Old weather panel/card DOM can be deleted if PR 1/2 weather state proof also passes.

### Final cleanup candidates

- Old Home visual CSS rules for `.home-quick-actions`, `.home-feed-preview`, `.home-weather-card`, and `#forecastPanel`.
- Old feed preview rotator JS and script tag.
- Old DOM-specific weather reads/writes.
- Diagnostic fallback selectors for removed old nodes.
- Skeleton/grid compatibility CSS that targets only removed legacy Home DOM.

## 8. Search proof commands

Run these before deletion PRs and include the output in the PR notes:

```bash
rg -n "forecastPanel|weatherStatus|weatherTemp|weatherWind|weatherPressure|weatherMoon|biteForecast|homeWeatherModeIcon|homeWeatherTempChip|homeWeatherWindChip|homeWeatherPressure|homeWeatherBiteChip|homeWeatherCondition" index.html assets/js assets/css
rg -n "homeFeedPreviewRotator|home-feed-preview|home-weather-card|home-quick-actions|hero-copy|home-quick-action-card" index.html assets/js assets/css
rg -n "mobileMenu|burgerBtn|mobile-menu-wrap|mobileProfileBtn|mobileProfileAvatarIcon" index.html assets/js assets/css
rg -n "height -|633px|iPhone|Samsung|Pixel|deviceName|userAgent.*Home" assets/js assets/css
```

Run these after each PR:

```bash
git diff --check
node --check <each changed .js file>
```

## 9. PWA no-console verification checklist

After each PR is installed in the PWA build:

1. Open the installed PWA.
2. Navigate to Home.
3. Open Home diagnostics with 7 taps.
4. Press **Copy JSON**.
5. Send the copied JSON and one Home screenshot.
6. Do not use the browser console as acceptance proof.

Required fields to monitor every time:

- `weatherBridge.source`
- `weatherBridge.hasState`
- `weatherBridge.tempText`
- `weatherBridge.windText`
- `weatherBridge.pressureText`
- Bite field from `weatherBridge`
- `visibleBlocks.feedAdShell`
- `visibleBlocks.weatherShell`
- `visibleBlocks.touchBar`
- `gaps.feedAdToWeather`
- `gaps.weatherToTouchBar`
- `overflow.horizontalOverflowPx`
- `overflow.verticalOverflowPx`
- `overflow.weatherOverlapsTouchBar`
- `candidates.feedShell.selectedVisibleCandidate`
- `candidates.weatherShell.selectedVisibleCandidate`
- `fixedValueHints`

Universal PASS:

- Weather source is state-backed and populated.
- Feed/ad shell, weather shell, and TouchBar are visible.
- Gap delta is `<= 2px`.
- Horizontal and vertical overflow are `0`.
- Weather does not overlap TouchBar.
- Candidate selectors point to active Figma shells after PR 3.
- No fixed-value hints identify a new hardcoded layout patch.

Universal STOP:

- Diagnostics missing or uncopiable.
- Any required shell disappears.
- Any old hidden selector becomes the selected visible candidate after PR 3.
- Weather state is missing.
- Gap delta exceeds `2px`.
- Any overflow appears.
- Any device-specific or magic-height cleanup is introduced.

## 10. Final recommendation: exact next PR to implement first

Implement **PR 1: Make `weather.js` independent from old weather DOM nodes** first.

Recommended next PR prompt:

> Diagnose `assets/js/weather.js` and make weather state publication independent from old Home weather DOM. Do not delete old DOM, do not change visible UI, do not change Figma weather UI, Home geometry, TouchBar, routes, header, feed/ad shell, or background. The smallest safe fix is to ensure `KlevGoWeatherState` publishes complete temp/wind/pressure/bite/condition data even if `#forecastPanel`, `#weatherStatus`, `#weatherTemp`, `#weatherWind`, `#weatherPressure`, `#weatherMoon`, `#biteForecast`, `#homeWeatherModeIcon`, `#homeWeatherTempChip`, `#homeWeatherWindChip`, `#homeWeatherPressure`, `#homeWeatherBiteChip`, and `#homeWeatherCondition` are missing. Keep old DOM writes optional/null-safe for now. Add or preserve diagnostics proving `weatherBridge.source === "state"` and `weatherBridge.hasState === true`. Run `node --check assets/js/weather.js`, `git diff --check`, and search proof for old weather IDs. No visible UI changes and no deletion.

