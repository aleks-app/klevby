# Migration Map

This is the safe migration map from the current archive structure to the target architecture.

PR-1 does not move runtime files. This map defines where files should go in later isolated PRs.

## Migration principles

1. One PR changes one owner only.
2. Runtime file moves require adapter/bridge PRs.
3. `index.html` script order must remain stable until bootstrap ownership is migrated.
4. Legacy globals stay until every caller is migrated.
5. Home visual stability has priority over architectural cleanliness.
6. Supabase code must move behind repositories before UI modules are cleaned.

## Core / AppShell / Viewport

| Current file | Future zone | Priority | Move only when |
|---|---|---:|---|
| `assets/js/app/app-shell-viewport-owner.js` | `assets/js/core/viewport/viewport-kernel.js` | High | PR-3 added adapter and official Kernel aliases; physical runtime switch remains blocked until script bootstrap migration |
| `assets/js/app/app-viewport-debug.js` | `assets/js/core/viewport/viewport-diagnostics.js` | Medium | After viewport kernel exposes stable read-only diagnostics |
| `assets/js/app/app-surface-gate.js` | `assets/js/core/shell/app-surface-gate.js` | Medium | After AppShell contract exists |
| `assets/js/app/app-resume-manager.js` | `assets/js/core/shell/app-resume-manager.js` | Medium | After shell lifecycle events exist |
| `assets/js/app/app-navigation.js` | `assets/js/core/router/app-router.js` | High | After route registry/compatibility bridge exists |
| `assets/js/ui/ui-shell.js` | `assets/js/core/shell/app-shell-controller.js` | Medium | After router/chrome contract is stable |
| `assets/js/ui/ui-tabbar.js` | `assets/js/core/shell/app-tabbar-controller.js` | High | After TouchBar DOM contract is documented |
| `assets/css/layout/header.css` | `assets/css/core/app-shell.css` or `assets/css/layout/header.css` retained | High | PR-11 added Header frame tokens; move only after Header visual baseline and chrome-controller split |
| `assets/css/mobile/mobile-tabbar.css` | `assets/css/core/app-shell.css` or retained layout file | High | Only after TouchBar visual tests |

## Bootstrap / global runtime

| Current file | Future zone | Priority | Move only when |
|---|---|---:|---|
| `assets/js/app.js` | split into `assets/js/core/bootstrap/*` and feature modules | Very High | Never as one PR; first extract small non-behavioral helpers |
| `assets/js/config.js` | `assets/js/core/config/app-config.js` | Medium | After global config consumers are mapped |
| `assets/js/app/app-window-exports.js` | `assets/js/core/bootstrap/compat-window-exports.js` | High | Keep compatibility stable until final cleanup |
| `assets/js/app/app-global-events.js` | `assets/js/core/events/app-event-bus.js` | Medium | After event names are documented |
| `assets/js/app/app-ui-helpers.js` | `assets/js/core/ui/app-ui-helpers.js` or components | Low/Medium | After callers are listed |

## Supabase / data layer

| Current file | Future zone | Priority | Move only when |
|---|---|---:|---|
| `assets/js/supabase/supabase-core.js` | `assets/js/core/supabase/supabase-client-provider.js` | Very High | PR-8 with no feature rewrites |
| `assets/js/supabase/supabase-auth-service.js` | `assets/js/core/supabase/supabase-auth-service.js` | High | After client provider is stable |
| `assets/js/supabase/supabase-realtime-manager.js` | `assets/js/core/supabase/supabase-realtime-owner.js` | High | After channel inventory and lifecycle tests |
| `assets/js/supabase/supabase-compat-globals.js` | `assets/js/core/supabase/supabase-compat-globals.js` | High | Keep as bridge until all callers migrate |
| `assets/js/supabase/water-depth-sources.js` | `assets/js/core/repositories/map.repository.js` | Medium | After depth/map repository contract exists |

## Home

| Current file | Future zone | Priority | Move only when |
|---|---|---:|---|
| `assets/js/app/app-home-screen-owner.js` | `assets/js/modules/home/home.diagnostics.js` then retire solver | Very High | After Home CSS Grid Foundation and read-only solver PR |
| `assets/js/app/app-home-feed-preview-rotator.js` | `assets/js/modules/home/home.rotator.js` | Medium | After Home module entry exists |
| `assets/css/screens/home-mobile.css` | `assets/css/modules/home/home.css` | Very High | Do not move until CSS contract PR and Home visual tests |
| `assets/css/screens/home.css` | `assets/css/modules/home/home.css` | Medium | With Home CSS consolidation PR |

## Feed / posts

| Current file | Future zone | Priority | Move only when |
|---|---|---:|---|
| `assets/js/feed/supabase/*` | `assets/js/core/repositories/feed.repository.js` | High | PR-9, after repository return contract exists |
| `assets/js/feed/feed-api.js` | `assets/js/modules/feed/feed.api-adapter.js` | Medium | After repository exists |
| `assets/js/feed/feed-main.js` | `assets/js/modules/feed/feed.controller.js` | Medium | After data layer migration |
| `assets/js/feed/feed-state.js` | `assets/js/modules/feed/feed.state.js` | Medium | After controller is stable |
| `assets/js/feed/feed-render.js` + `assets/js/feed/render/*` | `assets/js/modules/feed/feed.render.js` | Medium | After render/data boundaries are confirmed |
| `assets/js/feed/feed-actions.js` + `assets/js/feed/actions/*` | `assets/js/modules/feed/feed.actions.js` | High | After repository mutation contract exists |
| `assets/js/feed/modals/*` | `assets/js/modules/feed/modals/*` | Medium | After modal ownership is separated from data access |
| `assets/js/posts/*` | `assets/js/modules/feed/posts/*` or repository | Medium | After posts/feed boundary is decided |
| `assets/css/components/feed-cards.css` | `assets/css/modules/feed/feed-cards.css` or shared cards | Medium | After shared card tokens exist |

## Map / depths / ponds

| Current file | Future zone | Priority | Move only when |
|---|---|---:|---|
| `assets/js/map-logic.js` | split into `assets/js/modules/map/map.controller.js` and services | Very High | Never as one PR; extract one responsibility at a time |
| `assets/js/map/depth-maps-registry.js` | `assets/js/modules/map/depth/depth-registry.js` | Medium | After import/compatibility bridge exists |
| `assets/js/map/water-depth-map-layer.js` | `assets/js/modules/map/depth/depth-layer.js` | Medium | After map controller can own lifecycle |
| `assets/js/map/water-depth-contours-layer.js` | `assets/js/modules/map/depth/depth-contours-layer.js` | Medium | After depth layer tests |
| `assets/js/map/water-depth-preview-sheet.js` | `assets/js/modules/map/depth/depth-preview.js` | Medium | After preview sheet contract exists |
| `assets/js/map/water-body-detail.js` | `assets/js/modules/map/water-body-detail.js` | Medium | After detail UI/data split |
| `assets/js/map/map-user-location.js` | `assets/js/modules/map/location/map-user-location.js` | Medium | After GPS lifecycle contract exists |
| `assets/js/ponds.js` | `assets/js/core/repositories/ponds.repository.js` + module adapter | High | After repository empty/error contract exists |
| `assets/css/screens/map-water-depth.css` | `assets/css/modules/map/map-depth.css` | Medium | After map module shell contract |
| `assets/css/screens/water-body-detail.css` | `assets/css/modules/map/water-body-detail.css` | Medium | After detail module migration |

## Trips

| Current file | Future zone | Priority | Move only when |
|---|---|---:|---|
| `assets/js/trips/trips-screen-owner.js` | `assets/js/modules/trips/trips.controller.js` | High | After fullscreen chrome contract is fixed |
| `assets/js/trips/trips-lifecycle.js` | `assets/js/modules/trips/trips.lifecycle.js` | Medium | With Trips controller PR |
| `assets/js/trips/trips-list-owner.js` | `assets/js/modules/trips/trips.list.js` | Medium | After empty/list contract documented |
| `assets/js/trips/trips-render.js` | `assets/js/modules/trips/trips.render.js` | Medium | After state contract |
| `assets/js/trips/trips-filters.js` | `assets/js/modules/trips/trips.filters.js` | Medium | After filter state contract |
| `assets/js/trips/trips-state.js` | `assets/js/modules/trips/trips.state.js` | Medium | With controller PR |
| `assets/css/screens/trips-fullscreen.css` | `assets/css/modules/trips/trips.css` | Medium | After Trips visual baseline screenshot |

## Chat

| Current file | Future zone | Priority | Move only when |
|---|---|---:|---|
| `assets/js/chat.js` | `assets/js/modules/chat/chat.controller.js` | High | After chat repository and realtime owner exist |
| `assets/js/chat-private.js` | `assets/js/modules/chat/private/chat-private.controller.js` | High | After private chat data contract exists |
| `assets/js/chat-public.js` | `assets/js/modules/chat/public/chat-public.controller.js` | High | After public chat data contract exists |
| `assets/js/chat-realtime.js` | `assets/js/core/supabase/supabase-realtime-owner.js` adapter | Very High | After realtime owner enforcement PR |
| `assets/js/chat-lifecycle.js` | `assets/js/modules/chat/chat.lifecycle.js` | High | After subscription lifecycle is tested |
| `assets/js/chat-private/*` | `assets/js/modules/chat/private/*` | Medium | After controller/data split |
| `assets/css/chat/*` | `assets/css/modules/chat/*` | Medium | After chat shell visual baseline |
| `assets/css/chat-style.css` | `assets/css/modules/chat/chat.css` or legacy | Medium | After CSS ownership split |

## Market

| Current file | Future zone | Priority | Move only when |
|---|---|---:|---|
| `assets/js/market-logic.js` | split into `assets/js/modules/market/*` | Very High | Never as one PR; first move data calls behind repository |
| `assets/js/market/market-upload.js` | `assets/js/modules/market/market.upload.js` | High | After storage repository/service exists |
| `assets/js/market/market-ui-state.js` | `assets/js/modules/market/market.state.js` | Medium | After controller split |
| `assets/js/market/market-styles.js` | `assets/css/modules/market/market.css` | Medium/High | After replacing JS-injected styles safely |
| `assets/js/market/market-contacts.js` | `assets/js/modules/market/market.contacts.js` | Medium | After contact/data boundaries |
| `assets/js/market/market-utils.js` | `assets/js/modules/market/market.utils.js` | Low | After caller map |
| `assets/css/mobile/mobile-market.css` | `assets/css/modules/market/market.css` | Medium | After visual baseline |

## Profile / Auth

| Current file | Future zone | Priority | Move only when |
|---|---|---:|---|
| `assets/js/auth.js` | `assets/js/modules/auth/auth.controller.js` | Very High | After auth service/client provider is stable |
| `assets/js/auth-profile.js` | `assets/js/modules/auth/auth-profile.adapter.js` | High | After profile repository exists |
| `assets/js/profile.js` | `assets/js/modules/profile/profile.controller.js` | High | After profile repository exists |
| `assets/js/profile/profile-core.js` | `assets/js/modules/profile/profile.controller.js` + repository | Very High | After data/UI split |
| `assets/js/profile/profile-avatar.js` | `assets/js/modules/profile/profile.avatar.js` | Medium | After storage service contract |
| `assets/js/profile/profile-photos.js` | `assets/js/modules/profile/profile.photos.js` | Medium | After storage service contract |
| `assets/js/profile/profile-settings.js` | `assets/js/modules/profile/profile.settings.js` | Medium | After auth/profile state contract |
| `assets/js/profile/public/*` | `assets/js/modules/profile/public/*` | Medium | After public profile repository methods |
| `assets/css/screens/profile.css` | `assets/css/modules/profile/profile.css` | Medium | After visual baseline |
| `assets/css/screens/profile-public.css` | `assets/css/modules/profile/profile-public.css` | Medium | After visual baseline |
| `assets/css/screens/auth-welcome.css` | `assets/css/modules/auth/auth-welcome.css` | Medium | After auth screen baseline |

## Legacy shelf

Future `assets/js/legacy/` and `assets/css/legacy/` are only for files that are intentionally kept as compatibility wrappers while new modules take ownership.

Do not move broken/unknown code into legacy just to hide it.

A file can enter legacy only when:

1. A new owner exists.
2. The legacy file is only a wrapper/bridge.
3. It has a deletion plan.
4. Phone smoke-check passed after the wrapper was introduced.

## Completed architecture sequence through PR-12

1. PR-2: Core token bridge, no visual changes.
2. PR-3: Viewport kernel adapter, no Home solver removal.
3. PR-4: Shared screen contract CSS.
4. PR-5: Home CSS Grid foundation.
5. PR-6: Home solver read-only/safety-fill mode.
6. PR-7: Home Screen Contract verification.
7. PR-8: Home Screen Contract clean integration.
8. PR-9: Home Solver retirement.
9. PR-10: TouchBar & Screen Integration contracts.
10. PR-11: Header Integration contracts.
11. PR-12: Architecture Finalization.

Next migration track should be Supabase Repository foundation, not more Home geometry work.

## PR-4 Additions

| Current file | Future zone | Priority | Migration condition |
| --- | --- | --- | --- |
| `assets/css/core/screen-contract.css` | `assets/css/core/screen-contract.css` | High | Contract added in PR-4, consumers migrate later one screen per PR. |
| Existing screen wrappers in `index.html` | `.kg-screen` / `.kg-screen__content` contract | High | Do not migrate in PR-4. Start after screen-by-screen adapter plan. |

## PR-5 Home CSS Grid Foundation

| Current area | Prepared target | Status | Activation rule |
| --- | --- | --- | --- |
| `assets/css/screens/home-mobile.css` | `assets/css/modules/home/home-grid-foundation.css` | Foundation added | Do not activate until dedicated Home visual PR |
| `assets/js/app/app-home-screen-owner.js` | future diagnostics-only Home owner | Unchanged | Solver remains safety net through PR-5 |



## PR-6 Home Solver Read-Only Mode

| Current area | Prepared target | Status | Next gate |
| --- | --- | --- | --- |
| `assets/js/app/app-home-screen-owner.js` | future `assets/js/modules/home/home.diagnostics.js` | Grid contract enabled, legacy solver retained as safety fill | Phone diagnostics must show no overflow and acceptable rhythm before PR-7 |
| `assets/css/modules/home/home-grid-foundation.css` | future live Home grid contract | Active only through `data-home-layout="grid"` set by Home owner | Keep old lower-fill token until PR-7 is approved |
| `--klevby-home-lower-fill-y` | no content JS solver token | Still active as safety output | Remove only after read-only diagnostics pass on PWA and Android |


## PR-7 — Home Screen Contract Verification

| Current file | Future zone | Status | Notes |
| --- | --- | --- | --- |
| `assets/js/app/app-home-screen-owner.js` | `assets/js/modules/home/home.diagnostics.js` | verification bridge | Applies `.kg-screen` at runtime and reports contract diagnostics; solver safety remains. |
| `assets/css/core/screen-contract.css` | `assets/css/core/screen-contract.css` | active contract | Home now verifies against this shared screen contract, but visual migration is not complete. |

## PR-8 — Home Screen Contract Clean Integration

| Current file | Future zone | Status | Notes |
| --- | --- | --- | --- |
| `assets/js/app/app-home-screen-owner.js` | `assets/js/modules/home/home.diagnostics.js` | clean integration owner | Applies `.kg-screen` and Grid runtime state; solver safety remains. |
| `assets/css/core/screen-contract.css` | `assets/css/core/screen-contract.css` | active shell contract | Owns Home top/bottom/height when `.kg-screen` is active. |
| `assets/css/screens/home-mobile.css` | `assets/css/legacy/home-mobile.legacy.css` later | partially legacy | Legacy shell fit now applies only when `.kg-screen` is absent. |
| `assets/css/modules/home/home-grid-foundation.css` | `assets/css/modules/home/home.css` later | active grid foundation | Requires `.kg-screen[data-home-layout="grid"]` and does not override shell height. |
| `--klevby-home-lower-fill-y` | remove after diagnostics pass | safety token retained | Remove only after PWA + Android phone diagnostics prove Grid can hold rhythm alone. |

## PR-9 — Home Solver Retirement

| Current file/token | Future zone | Status | Notes |
| --- | --- | --- | --- |
| `assets/js/app/app-home-screen-owner.js` | `assets/js/modules/home/home.diagnostics.js` then split | retirement owner | Active lower-fill solver loop retired; file still owns Home lock/density/Grid/diagnostics. |
| `resolveHomeLowerFill()` | legacy diagnostic helper | archived calculation | Kept for tests and `legacySolverSuggestedLowerFillY`; no default active content write. |
| `--klevby-home-lower-fill-y` | remove in later cleanup | forced to `0px` in normal retired mode | Keep until phone smoke-checks prove no stale sessions need it. |
| `data-home-solver-retirement` | diagnostic root attribute | active | `true` means the lower-fill solver is retired by default. |
| `data-home-grid-contract` | final root attribute | active | `integrated` means Home Grid is no longer a temporary test-drive marker. |

## PR-10 — TouchBar & Screen Integration Contracts

| Current file/token | Future zone | Status | Notes |
| --- | --- | --- | --- |
| `assets/js/app/app-shell-viewport-owner.js` | `assets/js/core/viewport/viewport-kernel.js` | expanded Kernel contract | Publishes measured TouchBar frame diagnostics while keeping legacy AppShell API. |
| `--klevby-touchbar-*` | `--kg-touchbar-*` aliases | bridged | Legacy tokens remain source-compatible; kg aliases are the future contract language. |
| `assets/css/core/screen-contract.css` | `assets/css/core/screen-contract.css` | active frame contract | `.kg-screen` bottom uses the shared TouchBar frame offset, not a Home-specific calculation. |
| `assets/css/mobile/mobile-tabbar.css` | `assets/css/layout/touchbar.css` later | kg-compatible | Reads kg aliases with fallbacks; no navigation behavior change. |
| Home TouchBar diagnostics | `assets/js/modules/home/home.diagnostics.js` later | active verification | Reports `homeTouchBarFramePass` without removing `safety-fill`. |

## PR-12 — Architecture Finalization

| Area | Status | Notes |
| --- | --- | --- |
| Core Viewport Kernel | finalized as runtime owner | physical file move remains a later bootstrap migration |
| `.kg-screen` | active shared contract | framed by Header and TouchBar Kernel tokens |
| Home Grid | finalized as `data-home-grid-contract="integrated"` | old `data-home-grid-test-drive` marker removed |
| Home Solver | retired by default | emergency `safety-fill` kept until PWA + Android phone checks pass |
| Header / TouchBar | integrated through tokens | markup and navigation logic unchanged |
| Supabase | unchanged | repository migration is the next architecture track |
