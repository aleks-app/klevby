# PR-10 — TouchBar & Screen Integration Contracts

## Goal

Bind the shared `.kg-screen` contract and the fixed bottom TouchBar into one measured AppShell frame.

This PR does not rewrite TouchBar navigation, does not touch Supabase, and does not remove the Home solver safety path.

## Scope

Allowed runtime owners:

- `assets/js/app/app-shell-viewport-owner.js`
- `assets/js/app/app-home-screen-owner.js`

Allowed CSS owners:

- `assets/css/base/global.css`
- `assets/css/core/screen-contract.css`
- `assets/css/mobile/mobile-tabbar.css`
- `assets/css/main.css`

## What changed

### Viewport Kernel now publishes measured TouchBar frame diagnostics

The Kernel now exposes measured TouchBar geometry:

- `touchbarTop`
- `touchbarBottom`
- `touchbarHeight`
- `touchbarBottomOffset`

And publishes read-only CSS diagnostics:

- `--kg-touchbar-top`
- `--kg-touchbar-bottom`
- `--kg-touchbar-height-measured`
- `--kg-touchbar-bottom-offset-measured`

These values are diagnostics from the rendered TouchBar. They are not used to restyle the TouchBar height.

### CSS token bridge now includes TouchBar aliases

`assets/css/base/global.css` now mirrors legacy bottom chrome tokens into `--kg-*` aliases:

- `--kg-touchbar-height`
- `--kg-touchbar-bottom-gap`
- `--kg-touchbar-bottom-offset`
- `--kg-touchbar-frame-total`
- `--kg-screen-touchbar-clearance`
- `--kg-screen-bottom-frame-offset`

Legacy tokens remain in place.

### `.kg-screen` bottom boundary is framed by TouchBar top

`assets/css/core/screen-contract.css` now uses:

```css
bottom: var(--kg-screen-bottom-frame-offset, var(--kg-shell-bottom-offset, var(--klevby-app-available-bottom-offset, 0px)));
```

The effective value still comes from the Kernel's `availableBottomOffset`, which is derived from the visible TouchBar top edge.

### TouchBar CSS consumes kg aliases with legacy fallbacks

`assets/css/mobile/mobile-tabbar.css` now reads:

- `--kg-screen-inline` with `--klevby-app-inline-inset` fallback
- `--kg-touchbar-bottom-offset` with `--klevby-touchbar-bottom-offset` fallback
- `--kg-touchbar-height` with `--klevby-touchbar-height` fallback

This keeps the old visual values while letting the AppShell frame speak the same token language.

### Home diagnostics now verify screen-to-TouchBar binding

`assets/js/app/app-home-screen-owner.js` now reports:

- `homeTouchBarFrameMode`
- `homeTouchBarFramePass`
- `homeTouchBarFrameReason`
- `homeTouchBarFrameEdgeDeltaPx`
- `homeTouchBarFrameShellDeltaPx`
- `homeTouchBarFrameKernelTopDeltaPx`
- `homeTouchBarFrameKernelHeightDeltaPx`
- `homeTouchBarTop`
- `homeTouchBarBottom`
- `homeTouchBarHeight`

This verifies that `#homeSection.kg-screen` bottom lands on the same TouchBar top that the Kernel used as the shell boundary.

## What did not change

- `index.html` is unchanged.
- TouchBar navigation JS is unchanged.
- Supabase is unchanged.
- Home Grid remains runtime-owned.
- Home solver retirement remains guarded by `retired-read-only`, `retired-watch`, and `safety-fill` modes.
- No device-specific media queries were added.

## Console smoke-check

```js
(() => {
  const root = document.documentElement;
  const home = document.getElementById("homeSection");
  const contract = window.KlevbyHomeScreenOwner?.getHomeFitContract?.();
  const s = getComputedStyle(root);

  return {
    homeHasKgScreen: home?.classList.contains("kg-screen"),
    homeLayout: home?.getAttribute("data-home-layout"),
    solverMode: root.getAttribute("data-home-solver-mode"),
    solverRetirement: root.getAttribute("data-home-solver-retirement"),
    touchbarTokens: {
      cssHeight: s.getPropertyValue("--kg-touchbar-height").trim(),
      measuredHeight: s.getPropertyValue("--kg-touchbar-height-measured").trim(),
      cssBottomOffset: s.getPropertyValue("--kg-touchbar-bottom-offset").trim(),
      measuredBottomOffset: s.getPropertyValue("--kg-touchbar-bottom-offset-measured").trim(),
      screenBottomFrameOffset: s.getPropertyValue("--kg-screen-bottom-frame-offset").trim()
    },
    diagnostics: {
      homeScreenContractPass: contract?.homeScreenContractPass,
      homeTouchBarFramePass: contract?.homeTouchBarFramePass,
      homeTouchBarFrameReason: contract?.homeTouchBarFrameReason,
      homeTouchBarFrameEdgeDeltaPx: contract?.homeTouchBarFrameEdgeDeltaPx,
      homeTouchBarFrameShellDeltaPx: contract?.homeTouchBarFrameShellDeltaPx,
      homeTouchBarFrameKernelTopDeltaPx: contract?.homeTouchBarFrameKernelTopDeltaPx,
      solverMode: contract?.solverMode,
      solverRetired: contract?.solverRetired,
      solverFallbackActive: contract?.solverFallbackActive,
      bottomRhythmDelta: contract?.bottomRhythmDelta,
      weatherOverflowPx: contract?.weatherOverflowPx
    }
  };
})();
```

Expected clean case:

- `homeHasKgScreen: true`
- `homeLayout: "grid"`
- `homeTouchBarFramePass: true`
- `homeTouchBarFrameReason: "bound"`
- `homeTouchBarFrameEdgeDeltaPx <= 2`
- `solverMode: "retired-read-only"` or guarded `safety-fill`

## Required checks

```bash
node --test tests/app-shell-viewport-owner.test.js tests/screen-contract-css.test.js tests/touchbar-screen-contract.test.js tests/home-screen-contract-clean-integration.test.js tests/home-solver-retirement.test.js
node --test tests/*.test.js
npm run build:web
npm run prepare:android
npm run validate:android-assets
```
