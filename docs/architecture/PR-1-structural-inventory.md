# PR-1 — Structural Inventory / Architecture Baseline

## Verdict

ОПАСНО, ТРЕБУЕТ СТРУКТУРНОЙ ДОРАБОТКИ if runtime files are moved in this PR.

PR-1 is intentionally non-functional: it creates the future architecture folders and documents the current owners, risks, and migration path. It must not change application behavior.

## Scope

Allowed in PR-1:

- Add `docs/architecture/*` inventory documents.
- Add future folder skeleton under `assets/js/core`, `assets/js/modules`, `assets/js/legacy`, `assets/css/core`, `assets/css/modules`, `assets/css/legacy`.
- Add `.gitkeep` files so Git preserves the empty target folders.

Forbidden in PR-1:

- Do not edit `index.html`.
- Do not move or edit runtime JS files.
- Do not move or edit runtime CSS files.
- Do not change script/link order.
- Do not change Home layout, TouchBar, Header, Supabase, router, map, chat, trips, market, auth, or feed behavior.

## Current codebase snapshot from this archive

- JS runtime files under `assets/js`: 138
- CSS runtime files under `assets/css`: 33
- `index.html` script tags: 132
- `index.html` stylesheet links: 8
- JS lines under `assets/js`: 56,135
- CSS lines under `assets/css`: 11,488
- Supabase/direct data access matches: 413
- Layout-risk matches: 780

These numbers are used only as inventory. They are not pass/fail metrics for this PR.

## Created target folder skeleton

```text
assets/js/core/bootstrap/
assets/js/core/config/
assets/js/core/events/
assets/js/core/shell/
assets/js/core/viewport/
assets/js/core/router/
assets/js/core/supabase/
assets/js/core/repositories/
assets/js/core/storage/
assets/js/core/diagnostics/

assets/js/modules/home/
assets/js/modules/feed/
assets/js/modules/trips/
assets/js/modules/map/
assets/js/modules/chat/
assets/js/modules/market/
assets/js/modules/profile/
assets/js/modules/auth/

assets/js/legacy/

assets/css/core/
assets/css/modules/home/
assets/css/modules/feed/
assets/css/modules/trips/
assets/css/modules/map/
assets/css/modules/chat/
assets/css/modules/market/
assets/css/modules/profile/
assets/css/modules/auth/

assets/css/legacy/
```

Each folder contains `.gitkeep` only. No runtime imports point to these folders yet.

## Documents added

- `docs/architecture/runtime-owners.md`
- `docs/architecture/supabase-inventory.md`
- `docs/architecture/css-layout-inventory.md`
- `docs/architecture/migration-map.md`
- `docs/architecture/PR-1-check-results.md`
- `docs/architecture/PR-1-structural-inventory.md`

## Required checks

Run from repository root:

```bash
npm install
npm run test:e2e
npm run build:web
npm run validate:android-assets
npm run prepare:android
```

Then verify no runtime file changed:

```bash
git diff -- index.html
git diff -- assets/js ':!assets/js/core/**' ':!assets/js/modules/**' ':!assets/js/legacy/**'
git diff -- assets/css ':!assets/css/core/**' ':!assets/css/modules/**' ':!assets/css/legacy/**'
```

Expected result:

- `index.html` has no diff.
- Existing runtime JS/CSS files have no diff.
- Only architecture docs and `.gitkeep` files are new.

## Smoke-check checklist

Manual browser/PWA preview:

1. App starts.
2. Splash/Auth opens.
3. Home opens.
4. Header and TouchBar are visible.
5. Navigation works: Feed / Map / Trips / Chat.
6. Home visual layout is unchanged.
7. Browser console has no new `404` for JS/CSS.
8. Browser console has no new `module/file not found` errors.

## PR-1 acceptance criteria

PR-1 is accepted only when:

- Folder skeleton exists.
- Inventory docs exist.
- Existing runtime JS/CSS files are untouched.
- `index.html` is untouched.
- Tests/build checks complete or failures are documented as pre-existing/environmental.
- Smoke-check has no new runtime errors.
