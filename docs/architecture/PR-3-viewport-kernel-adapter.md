# PR-3 — Viewport Kernel Adapter

## Goal

Officially fix `assets/js/app/app-shell-viewport-owner.js` as the single Core Viewport Kernel entrypoint while preserving the current runtime behavior.

## Scope

This PR is an adapter/role PR only.

It does not move the active runtime file and does not change screen layout behavior.

## Active runtime entrypoint

The active file remains:

- `assets/js/app/app-shell-viewport-owner.js`

Reason: it is already connected from `index.html` and is consumed by Home diagnostics and Android diagnostics through the existing `window.KlevbyAppShellViewportOwner` instance.

## New official kernel API names

The existing API remains available, and the following official aliases are added:

- `VIEWPORT_KERNEL_ROLE`
- `VIEWPORT_KERNEL_ENTRYPOINT`
- `calculateViewportKernel`
- `createViewportKernel`
- `window.KlevGoViewportKernel`

## Compatibility rule

The legacy runtime owner stays active:

- `window.KlevbyAppShellViewportOwner`

This is required so current Home solver and diagnostics keep working without changes.

## Adapter file

A new adapter file is added:

- `assets/js/core/viewport/viewport-kernel.js`

This file does not become the runtime script in PR-3. It is a safe target path for future migration and Node tests.

## Hard restrictions

This PR must not change:

- `index.html`
- `assets/js/app/app-home-screen-owner.js`
- `assets/css/screens/home-mobile.css`
- feature CSS
- routing
- TouchBar
- Supabase flow

## Expected behavior

The app should look and behave exactly as before PR-3.

The only runtime-visible addition is a read-only API object:

- `window.KlevGoViewportKernel`

The existing owner instance remains:

- `window.KlevbyAppShellViewportOwner`
