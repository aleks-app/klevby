# PR-6 — Home Solver Read-Only Mode / Grid Test-Drive

## Goal

Enable the prepared Home CSS Grid foundation in a controlled diagnostic mode and compare it against the existing Home lower-rhythm solver.

## Safety rule

This PR does not remove the legacy Home solver.

The Home owner first measures Grid with `--klevby-home-lower-fill-y: 0px`. If Grid is clean, the solver stays read-only. If Grid is not clean, the legacy lower-fill solver applies the safety fill exactly through the existing token.

## Runtime owner

Still owned by:

- `assets/js/app/app-home-screen-owner.js`

Grid CSS foundation remains owned by:

- `assets/css/modules/home/home-grid-foundation.css`

## Activation

The activation is runtime-only.

`index.html` is not changed.

When Home is active on a mobile surface, the Home owner adds:

```html
<section id="homeSection" data-home-layout="grid">
```

When Home is not active, the attribute is removed.

## Diagnostic attributes

The root element may publish:

- `data-home-grid-test-drive="true"`
- `data-home-solver-mode="diagnostic-pending" | "read-only" | "safety-fill" | "legacy-active"`
- `data-home-grid-fallback="true" | "false"`

## Diagnostic contract fields

`window.KlevbyHomeScreenOwner.getHomeFitContract()` now includes:

- `homeLayoutMode`
- `homeGridTestDriveActive`
- `homeGridReadOnlyPass`
- `homeGridSafetyPass`
- `homeGridReason`
- `solverMode`
- `solverFallbackActive`
- `legacySolverSuggestedLowerFillY`
- `legacySolverWouldApply`

## Expected behavior

- If Grid rhythm delta is `<= 2px` and weather does not overflow, solver mode becomes `read-only`.
- If Grid rhythm is not clean, solver mode becomes `safety-fill` and the old lower-fill token remains active.
- The old token `--klevby-home-lower-fill-y` is not removed.

## Hard restrictions

This PR must not touch:

- `index.html`
- `assets/css/screens/home-mobile.css`
- TouchBar CSS
- Header CSS
- Supabase files
- routing files

## Smoke console snippet

```js
(() => {
  const home = document.getElementById("homeSection");
  const root = document.documentElement;
  const contract = window.KlevbyHomeScreenOwner?.getHomeFitContract?.();
  return {
    homeLayout: home?.getAttribute("data-home-layout"),
    gridTestDrive: root.getAttribute("data-home-grid-test-drive"),
    solverMode: root.getAttribute("data-home-solver-mode"),
    gridFallback: root.getAttribute("data-home-grid-fallback"),
    lowerFill: getComputedStyle(root).getPropertyValue("--klevby-home-lower-fill-y").trim(),
    contract
  };
})();
```
