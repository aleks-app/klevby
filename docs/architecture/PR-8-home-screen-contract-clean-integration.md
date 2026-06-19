# PR-8 — Home Screen Contract Clean Integration

## Goal

Start clean Home integration with the shared `.kg-screen` screen contract.

This PR removes the temporary verification-marker behavior from PR-7 and lets `.kg-screen` own the Home shell geometry while the legacy Home lower-rhythm solver remains active as read-only/safety-fill.

## Scope

Allowed runtime owner:

- `assets/js/app/app-home-screen-owner.js`

Allowed CSS owners:

- `assets/css/core/screen-contract.css`
- `assets/css/screens/home-mobile.css`
- `assets/css/modules/home/home-grid-foundation.css`
- `assets/css/main.css`

Allowed tests:

- `tests/home-screen-contract-clean-integration.test.js`
- `tests/home-grid-foundation-css.test.js`
- `tests/screen-contract-css.test.js`

## What changed

### Home owner

The Home owner now applies only the clean contract class while Home is active:

- `.kg-screen`
- `data-home-layout="grid"`

It no longer publishes the temporary PR-7 verification markers:

- `data-home-screen-contract="verification"`
- `data-home-screen-contract-pass="pending|true|false"`

Old verification attributes are removed defensively if they exist from a stale session.

### CSS ownership

`assets/css/core/screen-contract.css` owns shell placement for `.kg-screen`:

- top
- bottom
- height
- overflow
- z-index

`assets/css/screens/home-mobile.css` keeps the old legacy `#homeSection` shell-fit rule only for Home without `.kg-screen`:

```css
#homeSection:not(.kg-screen) { ... }
```

This prevents the old `!important` shell geometry from fighting the shared screen contract.

`assets/css/modules/home/home-grid-foundation.css` now requires both:

- `.kg-screen`
- `data-home-layout="grid"`

and no longer writes shell height with `!important`.

## What did not change

- `index.html` markup is unchanged.
- `app-shell-viewport-owner.js` is unchanged.
- TouchBar CSS is unchanged.
- Header CSS is unchanged.
- Supabase is unchanged.
- Routing is unchanged.
- Legacy lower-fill safety token remains active: `--klevby-home-lower-fill-y`.

## Solver status

The legacy Home solver remains active as a safety owner:

- `read-only` when Grid + `.kg-screen` geometry is clean.
- `safety-fill` when Grid needs lower-rhythm protection.

The solver is not removed in this PR.

## Console smoke-check

```js
(() => {
  const home = document.getElementById("homeSection");
  const root = document.documentElement;
  const contract = window.KlevbyHomeScreenOwner?.getHomeFitContract?.();

  return {
    homeHasKgScreen: home?.classList.contains("kg-screen"),
    homeLayout: home?.getAttribute("data-home-layout"),
    homeScreenContractAttr: home?.getAttribute("data-home-screen-contract"),
    rootScreenContractAttr: root.getAttribute("data-home-screen-contract"),
    rootScreenContractPassAttr: root.getAttribute("data-home-screen-contract-pass"),
    solverMode: root.getAttribute("data-home-solver-mode"),
    gridFallback: root.getAttribute("data-home-grid-fallback"),
    lowerFill: getComputedStyle(root).getPropertyValue("--klevby-home-lower-fill-y").trim(),
    diagnostics: {
      homeScreenContractMode: contract?.homeScreenContractMode,
      homeScreenContractPass: contract?.homeScreenContractPass,
      homeScreenContractReason: contract?.homeScreenContractReason,
      topDelta: contract?.homeScreenContractTopDeltaPx,
      bottomDelta: contract?.homeScreenContractBottomDeltaPx,
      heightDelta: contract?.homeScreenContractHeightDeltaPx,
      solverMode: contract?.solverMode,
      solverFallbackActive: contract?.solverFallbackActive,
      bottomRhythmDelta: contract?.bottomRhythmDelta,
      weatherOverflowPx: contract?.weatherOverflowPx
    }
  };
})();
```

Expected:

- `homeHasKgScreen: true`
- `homeLayout: "grid"`
- `homeScreenContractAttr: null`
- `rootScreenContractAttr: null`
- `rootScreenContractPassAttr: null`
- `homeScreenContractMode: "clean-integration"`
- `homeScreenContractPass: true` on a clean shell fit
- `solverMode: "read-only"` or `"safety-fill"`

`safety-fill` is allowed. It means the old safety solver protected the lower rhythm.

## Required checks

```bash
node --test tests/home-screen-contract-clean-integration.test.js tests/home-grid-foundation-css.test.js tests/screen-contract-css.test.js tests/home-grid-contract.test.js tests/home-lower-fill-solver.test.js tests/app-shell-viewport-owner.test.js
node --test tests/*.test.js
npm run build:web
npm run prepare:android
npm run validate:android-assets
```
