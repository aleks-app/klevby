# PR-9 — Home Solver Retirement

## Goal

Retire the active Home lower-rhythm JS solver after the Grid + `.kg-screen` integration.

This PR keeps the Home owner alive, but it no longer uses the old double-RAF lower-fill scheduler to actively move Home content on every sync.

## Scope

Allowed runtime owner:

- `assets/js/app/app-home-screen-owner.js`

Allowed tests:

- `tests/home-solver-retirement.test.js`
- `tests/home-grid-contract.test.js`
- existing Home/viewport tests

## What changed

### Active solver retired

The old active lower-fill path is retired:

- no `scheduleHomeBottomRhythmSolver()` loop;
- no `solverFrame` / `solverMeasureFrame` owner state;
- no second `requestAnimationFrame` measurement pass for Home lower rhythm;
- no double-RAF active solver loop.

The Home owner still publishes `--klevby-home-lower-fill-y`. In the clean `retired-read-only` path the value is `0px`. If Grid is not clean yet, `safety-fill` can still apply the old lower-fill value as a guarded fallback.

### Diagnostic-only legacy suggestion

The old calculation is kept as a diagnostic helper:

- `legacySolverSuggestedLowerFillY`
- `legacySolverWouldApply`
- `lowerFillReason`
- `bottomRhythmDelta`
- `weatherOverflowPx`

This tells us what the old solver would have done without letting it move content by default.

### Retirement modes

Root attribute:

```text
<html data-home-solver-retirement="true|false">
```

Solver modes:

- `retired-read-only` — Grid is clean; old solver is archived.
- `retired-watch` — Grid is not diagnostic-clean, but no useful lower-fill value exists.
- `safety-fill` — Grid is not clean yet and the old lower-fill value is still applied as guarded fallback.
- `legacy-active` — only when Home is outside Grid test-drive mode.

### Emergency override

For rollback testing, the emergency marker can still be used to label a safety-fill run as emergency-driven. Enable by either:

```js
document.documentElement.setAttribute("data-home-legacy-solver-emergency", "true");
```

or:

```js
localStorage.setItem("klevgo:home:legacy-solver-emergency", "true");
```

This is not a normal production path. It exists only as an emergency rope during phone testing. Normal guarded safety-fill can still run when Grid is not clean.

## What did not change

- `index.html` is unchanged.
- `.kg-screen` remains the Home shell contract.
- `data-home-layout="grid"` remains runtime-owned by the Home owner.
- Home lock / density / screen contract diagnostics remain in `app-home-screen-owner.js`.
- Supabase is unchanged.
- TouchBar and Header CSS are unchanged.

## Why the file is not deleted yet

`assets/js/app/app-home-screen-owner.js` still owns more than the old solver:

- Home active detection.
- Home lock state.
- Home density attribute.
- `.kg-screen` attachment.
- `data-home-layout="grid"` runtime activation.
- Home fit diagnostics.

Deleting the file in PR-9 would break those responsibilities.

## Console smoke-check

```js
(() => {
  const root = document.documentElement;
  const home = document.getElementById("homeSection");
  const contract = window.KlevbyHomeScreenOwner?.getHomeFitContract?.();

  return {
    homeHasKgScreen: home?.classList.contains("kg-screen"),
    homeLayout: home?.getAttribute("data-home-layout"),
    solverMode: root.getAttribute("data-home-solver-mode"),
    solverRetirement: root.getAttribute("data-home-solver-retirement"),
    gridFallback: root.getAttribute("data-home-grid-fallback"),
    lowerFill: getComputedStyle(root).getPropertyValue("--klevby-home-lower-fill-y").trim(),
    diagnostics: {
      solverMode: contract?.solverMode,
      solverRetired: contract?.solverRetired,
      solverFallbackActive: contract?.solverFallbackActive,
      solverEmergencyEnabled: contract?.solverEmergencyEnabled,
      homeSolverRetirementReason: contract?.homeSolverRetirementReason,
      lowerFillY: contract?.lowerFillY,
      legacySolverSuggestedLowerFillY: contract?.legacySolverSuggestedLowerFillY,
      legacySolverWouldApply: contract?.legacySolverWouldApply,
      bottomRhythmDelta: contract?.bottomRhythmDelta,
      weatherOverflowPx: contract?.weatherOverflowPx
    }
  };
})();
```

Expected clean case:

- `homeHasKgScreen: true`
- `homeLayout: "grid"`
- `solverMode: "retired-read-only"`
- `solverRetirement: "true"`
- `lowerFill: "0px"`
- `solverRetired: true`
- `solverFallbackActive: false`
- `lowerFillY: 0`

If `solverMode` is `safety-fill`, the PR is still safe: the old lower-fill is protecting Home without the old double-RAF loop. More legacy deletion is allowed only after phone diagnostics show `retired-read-only`.

## Required checks

```bash
node --test tests/home-solver-retirement.test.js tests/home-screen-contract-clean-integration.test.js tests/home-grid-contract.test.js tests/home-lower-fill-solver.test.js tests/home-grid-foundation-css.test.js tests/screen-contract-css.test.js tests/app-shell-viewport-owner.test.js
node --test tests/*.test.js
npm run build:web
npm run prepare:android
npm run validate:android-assets
```
