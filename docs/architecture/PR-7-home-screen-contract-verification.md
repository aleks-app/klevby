# PR-7 — Home Screen Contract Verification

## Goal

Verify that the Home Grid test-drive can coexist with the shared `.kg-screen` CSS contract without removing the legacy Home lower-rhythm solver.

## Scope

This PR is diagnostic and safety-focused.

It does not remove:

- `app-home-screen-owner.js`
- `--klevby-home-lower-fill-y`
- legacy Home rhythm solver
- Home Grid safety fallback

## Runtime behavior

When Home is active, the Home owner now applies the shared screen-contract marker to `#homeSection`:

- class: `.kg-screen`
- attribute: `data-home-screen-contract="verification"`

The root receives:

- `data-home-screen-contract="verification"`
- `data-home-screen-contract-pass="pending|true|false"`

This is a verification marker, not a visual migration. Existing `#homeSection` mobile rules and solver safety remain in control.

## Diagnostics

`window.KlevbyHomeScreenOwner.getHomeFitContract()` now reports:

- `homeScreenContractMode`
- `homeScreenContractActive`
- `homeScreenContractClassActive`
- `homeScreenContractTokenBridgePass`
- `homeScreenContractRectPass`
- `homeScreenContractPass`
- `homeScreenContractReason`
- `homeScreenContractTopDeltaPx`
- `homeScreenContractBottomDeltaPx`
- `homeScreenContractHeightDeltaPx`
- `homeScreenContractTokenTopDeltaPx`
- `homeScreenContractTokenHeightDeltaPx`
- `homeScreenContractTokenBottomOffsetDeltaPx`

## Safety rules

This PR must not:

- change `index.html`
- change `assets/css/screens/home-mobile.css`
- disable the Home solver
- remove `--klevby-home-lower-fill-y`
- change TouchBar/Header CSS
- change Supabase or routing

## Manual console check

Run on preview/mobile:

```js
(() => {
  const home = document.getElementById("homeSection");
  const root = document.documentElement;
  const contract = window.KlevbyHomeScreenOwner?.getHomeFitContract?.();

  return {
    homeHasKgScreen: home?.classList.contains("kg-screen"),
    homeLayout: home?.getAttribute("data-home-layout"),
    homeScreenContract: home?.getAttribute("data-home-screen-contract"),
    rootScreenContract: root.getAttribute("data-home-screen-contract"),
    rootScreenContractPass: root.getAttribute("data-home-screen-contract-pass"),
    solverMode: root.getAttribute("data-home-solver-mode"),
    gridFallback: root.getAttribute("data-home-grid-fallback"),
    lowerFill: getComputedStyle(root).getPropertyValue("--klevby-home-lower-fill-y").trim(),
    diagnostics: {
      homeScreenContractPass: contract?.homeScreenContractPass,
      homeScreenContractReason: contract?.homeScreenContractReason,
      homeScreenContractTopDeltaPx: contract?.homeScreenContractTopDeltaPx,
      homeScreenContractBottomDeltaPx: contract?.homeScreenContractBottomDeltaPx,
      homeScreenContractHeightDeltaPx: contract?.homeScreenContractHeightDeltaPx,
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
- `homeScreenContract: "verification"`
- `rootScreenContractPass: "true"` on clean geometry
- `solverMode: "read-only"` or `"safety-fill"`

If `solverMode` is `"safety-fill"`, this is not a failure. It means the legacy lower-fill safety layer protected Home rhythm.
