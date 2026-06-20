# Home row coupling diagnostics and fix after quick visual nudge

Date: 2026-06-20
Scope: diagnostics plus the follow-up layout-contract fix.

## Root cause

The feed card did not shrink because of the reverted `--klevby-home-quick-row-nudge-y` transform-style nudge. It shrank in the follow-up grid-budget change (`affd840`) that converted the feed row from a stretchable `minmax(..., 1fr)` row to an `auto` row and pinned the feed card subtree to `--klevby-home-feed-card-target-h: 224px`.

Before that change, the grid's third row could absorb remaining height (`minmax(var(--kg-home-grid-feed-row-min-h), 1fr)`), and the feed preview/card used `height: 100%`, so the visible card could grow to roughly 234px on the reported shell. After `affd840`, the feed preview became `height: auto`, and the card/rotator/viewport/slide were explicitly `height: var(--kg-home-grid-feed-card-target-h)`. In standard density that target is 224px.

## Fix applied

The fix restores the feed row as the lower-rhythm absorber and removes the hidden weather auto-margin compensator:

1. The Home grid root uses `minmax(var(--kg-home-grid-feed-row-min-h), 1fr)` for the feed row again.
2. The feed preview stretches inside that row with `height: 100%`, `align-self: stretch`, and `grid-template-rows: auto minmax(0, 1fr)`.
3. The active feed card subtree uses `height: 100%` and `max-height: 100%` instead of a fixed 224px target height.
4. The weather card uses `margin-top: 0`, so leftover vertical space is no longer parked above weather by `margin-top: auto`.
5. `--klevby-home-weather-clearance-y: 12px` remains the bottom anchor; shell/header/TouchBar measurement code was not changed.
6. Quick actions remain on the current grid row with the existing quick-to-feed spacing contract; no negative margins or device-specific media queries were added.

## Files and lines involved

- `assets/css/modules/home/home-grid-foundation.css`
  - Grid root rows are `hero / quick / stretch feed / weather`.
  - Quick actions still use the grid spacing token for quick-to-feed separation; the fix does not introduce a quick layout nudge.
  - Feed preview stretches and lets the card absorb the available row height.
  - Weather no longer uses `margin-top: auto`; bottom clearance is still owned by root padding.
- `assets/css/screens/home-mobile.css`
  - Standard tokens still provide `--klevby-home-hero-row-max-h: 213px`, `--klevby-home-quick-to-feed-gap: 22px`, `--klevby-home-feed-card-target-h: 224px`, `--klevby-home-feed-card-max-h: 230px`, `--klevby-home-feed-row-min-h: calc(var(--klevby-home-feed-card-visual-min-h) + var(--klevby-home-feed-header-h))`, and `--klevby-home-weather-clearance-y: 12px`.
  - The target/max tokens remain available as diagnostics/fallback budget tokens, but the visible feed card is no longer pinned to the target in grid mode when safe row space exists.
- `assets/js/app/app-home-screen-owner.js`
  - `getCssPixelValue()` still uses `parseFloat()` on the computed custom property string. A custom property that remains a `calc(...)` expression can still show `null`; this is a diagnostic parsing limitation, not proof that the token is absent.
  - Bottom rhythm still compares active feed card bottom to weather top, then weather bottom to TouchBar top.

## Why the feed card should recover

The reported 224px feed card exactly matched the standard-density `--klevby-home-feed-card-target-h: 224px`. The fix removes that target as the visible grid-mode height and restores the feed row/card stretch chain. On the reported shell, the same residual space that previously resolved as weather `margin-top:auto` should now be absorbed by the feed row/card, moving the feed card bottom back toward ~750px and the card height back toward ~230–235px.

## Why the feed-to-weather gap should recover

With weather `margin-top:auto` removed, the weather row no longer receives leftover free space above it. The feed row is the only flexible row again, so the feed card grows downward until the gap to weather is governed by the grid gap/slot rhythm while weather remains anchored by the 12px root bottom clearance.

## Feed row token diagnostic note

`--klevby-home-feed-row-min-h` is present in CSS as a `calc(...)` custom property. Diagnostics can show it as `null` in `computedBudgetTokens` because `getCssPixelValue()` reads the custom property string and passes it to `Number.parseFloat()`. If the browser returns unresolved custom property text (`calc(var(...) + var(...))`), `parseFloat()` returns `NaN`, so the helper returns `null`.

## Follow-up verification target

Phone diagnostics should confirm:

- quick actions remain near the accepted visual top;
- feed card height is around 230–235px;
- feed card to weather gap is 12–14px;
- weather to TouchBar gap is 10–14px, ideally 12px;
- `bottomRhythmPass`, `fitPass`, `weatherFitPass`, and `homeVisualBudgetPass` are true;
- `homeOv` and `weatherOv` remain 0.
