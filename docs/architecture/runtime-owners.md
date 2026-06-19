# Runtime Owners Inventory

This document records current runtime ownership. PR-1 does not change any owner.

## App bootstrap and global runtime

Current files:

- `assets/js/app.js`
- `assets/js/config.js`
- `assets/js/ui.js`
- `assets/js/pwa.js`
- `assets/js/pwa-manifest.js`
- `sw.js`

Current risk:

- `assets/js/app.js` is still a central/global runtime file.
- Many modules communicate through `window.*` compatibility exports.
- Bootstrap order is controlled by `index.html` script order.

Future owner:

- `assets/js/core/bootstrap/app-bootstrap.js`
- `assets/js/core/config/app-config.js`
- `assets/js/core/events/app-event-bus.js`

Migration rule:

- Do not move bootstrap code until a compatibility bridge is introduced and script order is protected by tests.

## Viewport / AppShell

PR-12 final status:

- `assets/js/app/app-shell-viewport-owner.js` is the official Core Viewport Kernel runtime entrypoint.
- `assets/js/core/viewport/viewport-kernel.js` is the adapter target for future migration.
- The legacy runtime instance `window.KlevbyAppShellViewportOwner` remains active for compatibility.
- The new public kernel API is exposed as `window.KlevGoViewportKernel`.
- The Kernel publishes one top frame from Header bottom and one bottom frame from TouchBar top.
- `.kg-screen` is framed by Header + TouchBar tokens, not by per-screen hardcoded offsets.

Current files:

- `assets/js/app/app-shell-viewport-owner.js`
- `assets/js/app/app-viewport-debug.js`
- `assets/js/app/app-surface-gate.js`
- `assets/js/app/app-resume-manager.js`
- `assets/css/components/app-surface-gate.css`

Current responsibility:

- Measures app shell geometry.
- Publishes viewport/shell CSS variables.
- Handles diagnostics/resume related to viewport.

Current risk:

- Shell geometry and Home content geometry are not fully separated yet.
- Viewport diagnostics and runtime behavior are close together.

Future owner:

- `assets/js/core/viewport/viewport-kernel.js`
- `assets/js/core/viewport/viewport-diagnostics.js`
- `assets/js/core/shell/app-shell-controller.js`

Migration rule:

- Existing shell owner stays active until token bridge and screen contract are in place.

## Home layout

Current files:

- `assets/js/app/app-home-screen-owner.js`
- `assets/js/app/app-home-feed-preview-rotator.js`
- `assets/css/screens/home-mobile.css`
- `assets/css/screens/home.css`

Current responsibility:

- Home active-state lock.
- Runtime attachment of `.kg-screen`.
- Runtime `data-home-layout="grid"` activation.
- Final `data-home-grid-contract="integrated"` state.
- Home density diagnostics.
- Retired lower-rhythm diagnostics.
- Header/TouchBar frame diagnostics.
- Feed/ad preview rotator.
- Home first-screen layout.

Current risk:

- Home owner still performs diagnostic content measurements, but the active lower-fill solver is retired by default.
- Emergency `safety-fill` remains available for rollback/safety during phone validation.
- `home-mobile.css` is a large mixed file containing visual styling, density, layout, PWA constraints, and rhythm rules.

Future owner:

- `assets/js/modules/home/home.controller.js`
- `assets/js/modules/home/home.rotator.js`
- `assets/js/modules/home/home.diagnostics.js`
- `assets/css/modules/home/home.css`

Migration rule:

- Do not delete the Home owner until Home lock, density, `.kg-screen`, Grid activation, and diagnostics have new owners.

## Header / top chrome

PR-12 final status:

- Header markup and navigation behavior remain unchanged through PR-12.
- `assets/css/layout/header.css` now exposes safe Header-local aliases for AppShell frame diagnostics.
- The top edge of `.kg-screen` is tied to `--kg-screen-top-frame-offset`, which mirrors the Kernel's measured Header bottom.
- Home diagnostics verify Header-to-screen binding through `homeHeaderFramePass`.

Current files:

- `assets/css/layout/header.css`
- `assets/js/app/app-shell-viewport-owner.js`
- `assets/js/app/app-home-screen-owner.js`

Migration rule:

- Header geometry belongs to the Core Viewport Kernel. Feature screens must not patch their own top offsets.

## Navigation / TouchBar

PR-12 final status:

- TouchBar navigation behavior remains unchanged through PR-12.
- The bottom edge of `.kg-screen` is tied to `--kg-screen-bottom-frame-offset`, which mirrors the Kernel's measured TouchBar top.
- Home diagnostics verify TouchBar-to-screen binding through `homeTouchBarFramePass`.

Current files:

- `assets/js/app/app-navigation.js`
- `assets/js/ui/ui-shell.js`
- `assets/js/ui/ui-tabbar.js`
- `assets/css/mobile/mobile-tabbar.css`
- `assets/css/layout/bottom-nav.css`
- `assets/css/layout/header.css`

Current responsibility:

- Main mobile tabs.
- Screen activation.
- Header/back/chrome behavior.

Current risk:

- Navigation is mixed between app-level and UI-level files.
- Header/TouchBar geometry affects all screens and must not be patched per-screen.

Future owner:

- `assets/js/core/router/app-router.js`
- `assets/js/core/router/route-registry.js`
- `assets/js/core/shell/app-chrome-controller.js`
- `assets/css/core/app-shell.css`

Migration rule:

- No screen may own Header or TouchBar geometry.

## Supabase core

Current files:

- `assets/js/supabase/supabase-core.js`
- `assets/js/supabase/supabase-auth-service.js`
- `assets/js/supabase/supabase-realtime-manager.js`
- `assets/js/supabase/supabase-compat-globals.js`
- `assets/js/supabase/water-depth-sources.js`

Current responsibility:

- Supabase client and compatibility exports.
- Auth helper service.
- Realtime manager.
- Water/depth data access.

Current risk:

- Some modules still access Supabase directly instead of through repositories.
- Compatibility globals must remain stable during migration.

Future owner:

- `assets/js/core/supabase/supabase-client-provider.js`
- `assets/js/core/supabase/supabase-auth-service.js`
- `assets/js/core/supabase/supabase-realtime-owner.js`
- `assets/js/core/repositories/*`

Migration rule:

- Do not remove compatibility globals until every module has migrated.

## Feed

Current files:

- `assets/js/feed.js`
- `assets/js/feed-supabase.js`
- `assets/js/feed/feed-main.js`
- `assets/js/feed/feed-api.js`
- `assets/js/feed/feed-state.js`
- `assets/js/feed/feed-render.js`
- `assets/js/feed/feed-events.js`
- `assets/js/feed/feed-actions.js`
- `assets/js/feed/actions/actions-core.js`
- `assets/js/feed/supabase/*`
- `assets/js/feed/modals/*`
- `assets/js/feed/render/*`
- `assets/css/components/feed-cards.css`

Current risk:

- Feed has its own Supabase sublayer but it is not yet a global repository contract.
- Feed has many actions and globals that must be migrated carefully.

Future owner:

- `assets/js/modules/feed/*`
- `assets/js/core/repositories/feed.repository.js`

## Map and depths

Current files:

- `assets/js/map-logic.js`
- `assets/js/map/depth-maps-registry.js`
- `assets/js/map/water-depth-contours-layer.js`
- `assets/js/map/water-depth-map-layer.js`
- `assets/js/map/water-depth-map-sources.js`
- `assets/js/map/water-depth-preview-sheet.js`
- `assets/js/map/water-body-detail.js`
- `assets/js/map/map-user-location.js`
- `assets/css/screens/map-water-depth.css`
- `assets/css/screens/water-body-detail.css`

Current risk:

- `map-logic.js` is large and owns multiple responsibilities.
- Depth map registry/layers are already partially modular and should be preserved.

Future owner:

- `assets/js/modules/map/map.controller.js`
- `assets/js/modules/map/depth/*`
- `assets/js/core/repositories/map.repository.js`
- `assets/js/core/repositories/ponds.repository.js`

## Trips

Current files:

- `assets/js/trips/trips-screen-owner.js`
- `assets/js/trips/trips-lifecycle.js`
- `assets/js/trips/trips-list-owner.js`
- `assets/js/trips/trips-render.js`
- `assets/js/trips/trips-filters.js`
- `assets/js/trips/trips-state.js`
- `assets/css/screens/trips-fullscreen.css`

Current risk:

- Trips fullscreen chrome is newer and must not be mixed back into legacy UI.

Future owner:

- `assets/js/modules/trips/*`
- `assets/css/modules/trips/trips.css`
- `assets/js/core/repositories/trips.repository.js`

## Chat

Current files:

- `assets/js/chat.js`
- `assets/js/chat-private.js`
- `assets/js/chat-public.js`
- `assets/js/chat-realtime.js`
- `assets/js/chat-lifecycle.js`
- `assets/js/chat-events.js`
- `assets/js/chat-state.js`
- `assets/js/chat-render.js`
- `assets/js/chat-private/*`
- `assets/css/chat/*`
- `assets/css/chat-style.css`

Current risk:

- Chat has realtime and private-message flows that must be moved behind a repository/realtime owner carefully.

Future owner:

- `assets/js/modules/chat/*`
- `assets/js/core/repositories/chat.repository.js`

## Market

Current files:

- `assets/js/market-logic.js`
- `assets/js/market/*`
- `assets/css/mobile/mobile-market.css`

Current risk:

- `market-logic.js` is a large feature owner and includes direct data access/UI work.

Future owner:

- `assets/js/modules/market/*`
- `assets/js/core/repositories/market.repository.js`

## Profile / Auth

Current files:

- `assets/js/auth.js`
- `assets/js/auth-profile.js`
- `assets/js/profile.js`
- `assets/js/profile/*`
- `assets/js/profile/public/*`
- `assets/css/screens/profile.css`
- `assets/css/screens/profile-public.css`
- `assets/css/screens/auth-welcome.css`

Current risk:

- Auth/Profile have many Supabase and `window.*` touchpoints.
- Profile must not be migrated before auth compatibility is stable.

Future owner:

- `assets/js/modules/auth/*`
- `assets/js/modules/profile/*`
- `assets/js/core/repositories/profile.repository.js`
- `assets/js/core/supabase/supabase-auth-service.js`

## PR-4 Screen Contract CSS

Shared screen contract owner:

- `assets/css/core/screen-contract.css`

Status: contract-only. No live screen markup consumes `.kg-screen` yet. Existing Home layout and `app-home-screen-owner.js` remain unchanged.

## PR-5 Home Grid Foundation

Prepared owner:

- `assets/css/modules/home/home-grid-foundation.css` — opt-in future Home CSS Grid contract.

Runtime owner remains unchanged:

- `assets/js/app/app-home-screen-owner.js` — legacy Home solver remains active and untouched.

Activation is intentionally deferred. Current markup must not include `data-home-layout="grid"`.



## PR-6 Home Grid Test-Drive / Solver Read-Only Mode

Runtime owner remains:

- `assets/js/app/app-home-screen-owner.js`

Status:

- Home Grid can now be activated at runtime with `data-home-layout="grid"`.
- The activation is controlled by the Home owner, not static `index.html` markup.
- The legacy lower-fill solver is not removed. It first runs as read-only diagnostics and applies safety fill only when Grid rhythm is not clean.
- `--klevby-home-lower-fill-y` remains the safety output token.

New diagnostics:

- `homeLayoutMode`
- `homeGridContractActive`
- `homeGridReadOnlyPass`
- `homeGridSafetyPass`
- `homeGridReason`
- `solverMode`
- `solverFallbackActive`
- `legacySolverSuggestedLowerFillY`
- `legacySolverWouldApply`


## PR-7 Home Screen Contract Verification

- `assets/js/app/app-home-screen-owner.js` remains the Home runtime owner.
- It now applies `.kg-screen` to `#homeSection` only as a verification marker while Home is active.
- The legacy lower-rhythm solver and safety-fill mode remain active.
- `assets/css/core/screen-contract.css` remains the shared contract definition.

## PR-8 Home Screen Contract Clean Integration

- `assets/js/app/app-home-screen-owner.js` remains the Home runtime owner.
- It now applies `.kg-screen` as the clean Home screen contract class while Home is active.
- PR-7 verification attributes are no longer published.
- `assets/css/core/screen-contract.css` owns Home shell geometry through `.kg-screen`.
- `assets/css/screens/home-mobile.css` keeps the legacy `#homeSection` shell-fit rule only for `#homeSection:not(.kg-screen)`.
- `assets/css/modules/home/home-grid-foundation.css` requires `.kg-screen[data-home-layout="grid"]` and does not write shell height with `!important`.
- The legacy Home lower-fill solver remains read-only/safety-fill and must not be deleted yet.

## PR-9 Home Solver Retirement

- `assets/js/app/app-home-screen-owner.js` remains the Home runtime owner.
- Active lower-fill writing is retired by default.
- The old lower-fill calculation remains only as diagnostics: `legacySolverSuggestedLowerFillY` and `legacySolverWouldApply`.
- The old double-RAF solver loop is removed.
- Emergency `safety-fill` can be enabled only through explicit debug override during phone testing.

## PR-10 TouchBar & Screen Integration Contracts

- `assets/js/app/app-shell-viewport-owner.js` remains the single Kernel owner for Header + TouchBar shell measurement.
- The Kernel now publishes measured TouchBar diagnostics through `--kg-touchbar-top`, `--kg-touchbar-bottom`, `--kg-touchbar-height-measured`, and `--kg-touchbar-bottom-offset-measured`.
- `assets/css/core/screen-contract.css` frames `.kg-screen` bottom through `--kg-screen-bottom-frame-offset`, which resolves to the Kernel shell bottom offset.
- `assets/css/mobile/mobile-tabbar.css` reads `--kg-*` aliases with legacy fallbacks; TouchBar navigation behavior is unchanged.
- `assets/js/app/app-home-screen-owner.js` only verifies Home-to-TouchBar frame alignment and keeps solver retirement/safety-fill modes intact.

## PR-12 Architecture Finalization

Final architecture documents:

- `docs/architecture/PR-12-architecture-finalization.md`
- `docs/architecture/ARCHITECTURE-FINALIZATION.md`

Final runtime rule:

- the old `data-home-grid-test-drive` marker is retired;
- the final grid runtime marker is `data-home-grid-contract="integrated"`;
- Home solver remains retired by default with emergency `safety-fill`;
- no Supabase, Header markup, TouchBar navigation, or `index.html` behavior is changed in PR-12.
