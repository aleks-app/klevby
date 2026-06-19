# PR-4 — Screen Contract CSS

## Goal

Introduce the shared `.kg-screen` CSS contract for future screens without migrating any live screen markup yet.

## Scope

This PR adds the contract layer only:

- `assets/css/core/screen-contract.css`
- import from `assets/css/main.css`
- CSS contract tests

## Runtime source

The contract reads the Viewport Kernel bridge tokens from PR-2/PR-3:

- `--kg-shell-top`
- `--kg-shell-bottom-offset`
- `--kg-shell-height`
- `--kg-screen-inline`
- `--kg-safe-top`
- `--kg-safe-bottom`

Fallbacks point to the existing `--klevby-app-*` tokens so the contract stays safe during migration.

## Hard rule

No existing screen consumes `.kg-screen` in this PR.

The following remain untouched:

- `index.html` markup
- Home layout
- `assets/js/app/app-home-screen-owner.js`
- Home lower rhythm solver
- TouchBar layout
- Header layout
- Supabase flow

## Future use

Feature screens can migrate to this contract only in later PRs, one screen at a time:

```html
<section class="kg-screen kg-screen--scroll">
  <div class="kg-screen__content">
    ...screen content...
  </div>
</section>
```

## Validation

Run:

```bash
node --test tests/screen-contract-css.test.js
node --test tests/app-shell-viewport-owner.test.js
npm run build:web
npm run prepare:android
npm run validate:android-assets
```
