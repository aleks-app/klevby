# PR-12 — Architecture Finalization

## Goal

Finalize the accumulated KlevGo AppShell / Screen Contract architecture after PR-1 through PR-11.

This PR does not rewrite Header, TouchBar, Supabase, routing, or Home visual content. It only removes runtime construction wording from the Home Grid integration state, locks the final documentation, and preserves the emergency safety path for Home diagnostics.

## Final architecture status

### Core Viewport Kernel

Runtime owner remains:

- `assets/js/app/app-shell-viewport-owner.js`

Adapter target remains:

- `assets/js/core/viewport/viewport-kernel.js`

The Kernel publishes:

- legacy `--klevby-app-*` tokens for compatibility;
- new `--kg-*` tokens for the future architecture;
- Header frame tokens;
- TouchBar frame tokens.

### Screen Contract

Shared screen frame owner:

- `assets/css/core/screen-contract.css`

Final frame contract:

- top edge comes from `--kg-screen-top-frame-offset`;
- bottom edge comes from `--kg-screen-bottom-frame-offset`;
- height comes from `--kg-shell-height`.

### Home

Runtime owner remains:

- `assets/js/app/app-home-screen-owner.js`

The Home owner now:

- applies `.kg-screen` at runtime when Home is active;
- applies `data-home-layout="grid"` when Home is active;
- publishes final grid contract state through `data-home-grid-contract="integrated"`;
- keeps lower-fill solver retired by default;
- keeps emergency `safety-fill` diagnostics for rollback/safety.

Removed finalization target:

- runtime `data-home-grid-test-drive` marker is removed;
- `homeGridTestDriveActive` diagnostic naming is replaced by `homeGridContractActive`.

### Header

Header markup and behavior are unchanged. Header is integrated through Kernel frame tokens and verified by Home diagnostics:

- `homeHeaderFramePass`
- `homeHeaderFrameReason`
- `homeHeaderFrameEdgeDeltaPx`

### TouchBar

TouchBar navigation behavior is unchanged. TouchBar is integrated through Kernel frame tokens and verified by Home diagnostics:

- `homeTouchBarFramePass`
- `homeTouchBarFrameReason`
- `homeTouchBarFrameEdgeDeltaPx`

### Supabase

Supabase is intentionally unchanged in this architecture sequence. Data layer repository migration remains a separate future track.

## Final runtime contract markers

Allowed runtime markers after PR-12:

- `#homeSection.kg-screen`
- `#homeSection[data-home-layout="grid"]`
- `html[data-home-grid-contract="integrated"]`
- `html[data-home-solver-mode="retired-read-only" | "retired-watch" | "safety-fill"]`
- `html[data-home-solver-retirement="true" | "false"]`
- `html[data-home-grid-fallback="true" | "false"]`

Temporary construction marker removed:

- `html[data-home-grid-test-drive="true"]`

## Safety rule

Do not delete `assets/js/app/app-home-screen-owner.js` yet.

It still owns:

- Home active-state lock;
- Home runtime attachment of `.kg-screen`;
- Home Grid activation;
- Home density diagnostics;
- Header/TouchBar frame diagnostics;
- emergency safety-fill fallback.

A later cleanup can split it into `assets/js/modules/home/home.controller.js` and `assets/js/modules/home/home.diagnostics.js` only after phone smoke-checks pass on PWA and Android.

## Smoke-check

Browser console expected state:

```js
(() => {
  const root = document.documentElement;
  const home = document.getElementById("homeSection");
  const contract = window.KlevbyHomeScreenOwner?.getHomeFitContract?.();

  return {
    homeHasKgScreen: home?.classList.contains("kg-screen"),
    homeLayout: home?.getAttribute("data-home-layout"),
    homeGridContract: root.getAttribute("data-home-grid-contract"),
    oldGridTestDriveMarker: root.getAttribute("data-home-grid-test-drive"),
    solverMode: root.getAttribute("data-home-solver-mode"),
    solverRetirement: root.getAttribute("data-home-solver-retirement"),
    diagnostics: {
      homeGridContractActive: contract?.homeGridContractActive,
      homeScreenContractPass: contract?.homeScreenContractPass,
      homeHeaderFramePass: contract?.homeHeaderFramePass,
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

Expected:

- `homeHasKgScreen: true`
- `homeLayout: "grid"`
- `homeGridContract: "integrated"`
- `oldGridTestDriveMarker: null`
- `homeScreenContractPass: true`
- `homeHeaderFramePass: true`
- `homeTouchBarFramePass: true`
- `solverMode: "retired-read-only"` or safe `"safety-fill"`

## Merge criterion

PR-12 is merge-ready only if:

- `index.html` remains unchanged;
- Header/TouchBar markup remains unchanged;
- Supabase remains unchanged;
- unit tests pass;
- `npm run build:web` passes;
- Android sync/assets validation passes on a machine with valid Capacitor dependencies;
- phone smoke-check confirms no Home jump, no weather overflow, and no new console 404s.
