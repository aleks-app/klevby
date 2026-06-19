# PR-5 — Home CSS Grid Foundation

## Goal

Prepare the Home screen for the future CSS Grid layout while keeping the current Home JS solver active as a safety net.

## Scope

This PR adds an opt-in Home Grid CSS contract:

- `assets/css/modules/home/home-grid-foundation.css`
- import in `assets/css/main.css`
- CSS contract tests in `tests/home-grid-foundation-css.test.js`

## Critical safety decision

The new grid is not activated in current markup.

Live Home does **not** receive:

```html
<section id="homeSection" data-home-layout="grid">
```

That switch is reserved for a later PR after visual comparison and phone testing.

## Runtime safety

The legacy Home owner remains untouched:

- `assets/js/app/app-home-screen-owner.js`

The legacy lower rhythm token remains supported:

- `--klevby-home-lower-fill-y`

The grid foundation maps it to:

- `--kg-home-grid-lower-fill-y`

## Kernel token usage

The grid foundation reads the PR-2/PR-3 shell bridge:

- `--kg-shell-height`
- fallback: `--klevby-app-available-height`

## Density compatibility

The file preserves the existing density tiers:

- `standard`
- `compact`
- `tight`

No device-model media queries are introduced.

## Hard rule

Do not remove the Home solver in this PR.  
Do not change Home markup in this PR.  
Do not change Home visual spacing in this PR.

## Later PR

The later activation PR may add `data-home-layout="grid"` to `#homeSection`, then compare diagnostics:

- feed/ad card to weather gap
- weather to TouchBar gap
- bottom rhythm delta
- overflow
- Android and iOS visual smoke
