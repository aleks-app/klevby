# PR-11 — Header Integration Contracts

## Goal

Bind the shared `.kg-screen` contract and the visible Header into the same measured AppShell frame that already uses the TouchBar as its bottom boundary.

This PR does not rewrite Header markup, does not change Header navigation logic, does not touch Supabase, and does not remove the Home solver safety path.

## Scope

Allowed runtime owners:

- `assets/js/app/app-shell-viewport-owner.js`
- `assets/js/app/app-home-screen-owner.js`
- `assets/js/core/viewport/viewport-kernel.js`

Allowed CSS owners:

- `assets/css/base/global.css`
- `assets/css/core/screen-contract.css`
- `assets/css/layout/header.css`
- `assets/css/main.css`

## What changed

### Viewport Kernel now publishes measured Header frame diagnostics

The Kernel now exposes measured Header geometry:

- `headerTop`
- `headerBottom`
- `headerHeight`
- `headerTopOffset`

And publishes read-only CSS diagnostics:

- `--kg-header-top`
- `--kg-header-bottom`
- `--kg-header-height-measured`
- `--kg-header-top-offset-measured`

These values come from the rendered Header. They do not restyle the Header layout.

### CSS token bridge now includes Header aliases

`assets/css/base/global.css` now mirrors the top chrome boundary into `--kg-*` aliases:

- `--kg-header-top`
- `--kg-header-bottom`
- `--kg-header-height`
- `--kg-header-top-offset`
- `--kg-header-frame-total`
- `--kg-screen-top-frame-offset`

Legacy `--klevby-app-*` shell tokens remain in place.

### `.kg-screen` top boundary is framed by Header bottom

`assets/css/core/screen-contract.css` now uses:

```css
 top: var(--kg-screen-top-frame-offset, var(--kg-shell-top, var(--klevby-app-available-top, 0px)));
```

The effective value still comes from the Kernel's `availableTop`, which is derived from the visible Header bottom edge.

### Header CSS consumes kg aliases safely

`assets/css/layout/header.css` now declares Header-local aliases:

- `--kg-header-safe-top`
- `--kg-header-frame-bottom`

The Home Header safe-area padding now reads `--kg-header-safe-top` with the same `env(safe-area-inset-top)` fallback as before.

### Home diagnostics now verify screen-to-Header binding

`assets/js/app/app-home-screen-owner.js` now reports:

- `homeHeaderFrameMode`
- `homeHeaderFramePass`
- `homeHeaderFrameReason`
- `homeHeaderFrameEdgeDeltaPx`
- `homeHeaderFrameShellDeltaPx`
- `homeHeaderFrameKernelBottomDeltaPx`
- `homeHeaderFrameKernelHeightDeltaPx`
- `homeHeaderTop`
- `homeHeaderBottom`
- `homeHeaderHeight`

This verifies that `#homeSection.kg-screen` top lands on the same Header bottom that the Kernel used as the shell boundary.

## What did not change

- `index.html` is unchanged.
- Header markup is unchanged.
- Header navigation/back/menu logic is unchanged.
- Supabase is unchanged.
- TouchBar navigation JS is unchanged.
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
    headerTokens: {
      cssHeaderBottom: s.getPropertyValue("--kg-header-bottom").trim(),
      measuredHeaderHeight: s.getPropertyValue("--kg-header-height-measured").trim(),
      screenTopFrameOffset: s.getPropertyValue("--kg-screen-top-frame-offset").trim()
    },
    diagnostics: {
      homeScreenContractPass: contract?.homeScreenContractPass,
      homeHeaderFramePass: contract?.homeHeaderFramePass,
      homeHeaderFrameReason: contract?.homeHeaderFrameReason,
      homeHeaderFrameEdgeDeltaPx: contract?.homeHeaderFrameEdgeDeltaPx,
      homeHeaderFrameShellDeltaPx: contract?.homeHeaderFrameShellDeltaPx,
      homeHeaderFrameKernelBottomDeltaPx: contract?.homeHeaderFrameKernelBottomDeltaPx,
      homeTouchBarFramePass: contract?.homeTouchBarFramePass,
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
- `homeHeaderFramePass: true`
- `homeHeaderFrameReason: "bound"`
- `homeHeaderFrameEdgeDeltaPx <= 2`
- `homeTouchBarFramePass: true`
- `solverMode: "retired-read-only"` or guarded `safety-fill`

## Required checks

```bash
node --test tests/app-shell-viewport-owner.test.js tests/screen-contract-css.test.js tests/header-screen-contract.test.js tests/touchbar-screen-contract.test.js tests/home-screen-contract-clean-integration.test.js tests/home-solver-retirement.test.js
node --test tests/*.test.js
npm run build:web
npm run prepare:android
npm run validate:android-assets
```
