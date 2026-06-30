# Weak-network startup audit — PWA / Android APK

Date: 2026-06-30

Scope: audit/report only. No runtime behavior, splash lifecycle, service worker, cache version, Home geometry, TouchBar, App Shell measurement, Trips, Map, Chat, Profile, or Create Flow changes are included in this PR.

## Executive summary

The current launch path is **not shell-first**. On `DOMContentLoaded`, `initKlevbyApp()` starts the app, initializes Supabase, starts weather fetch in the background, then **awaits auth restore**, and `initAuth()` then **awaits posts/trips loading** before `initKlevbyApp()` reaches `finally` and calls `finalizeColdHomeBootPresentation()`.

On weak internet, the first usable Home render can therefore be delayed by:

1. Supabase auth `getSession()` and possibly `getUser()` with no explicit local timeout.
2. Posts/trips REST-first query plus SDK fallback, bounded by app-level timeouts but still awaited during boot.
3. Third-party Supabase JavaScript CDN loading before deferred local scripts can execute.
4. Splash hiding is time-based (`load` or 5.2s), so the splash can disappear while boot is still waiting on auth/posts, or boot can finalize only after long network waits.

The safest next direction is not offline cache work. It is to separate **visual Home shell readiness** from **network data readiness**, one reversible PR at a time, while leaving splash, service worker, Home geometry, TouchBar, and screen modules untouched unless a specific owner is proven by diagnostics.

## Startup inventory

### HTML and external dependency chain

- `index.html` loads Supabase JS from `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` synchronously in the document head, with a `document.write()` fallback to unpkg if `window.supabase` is absent immediately after the first script tag.
- `index.html` preconnects to Supabase and DNS-prefetches OpenWeather, then loads many app modules with `defer`.
- Startup-critical deferred modules include `assets/js/config.js`, `assets/js/weather.js`, `assets/js/auth.js`, posts/trips/feed modules, app navigation/splash modules, Supabase core/compat/auth/realtime modules, map modules, and finally `assets/js/app.js`.

Weak-network risk:

- The parser-blocking external Supabase CDN script can delay HTML parsing and all deferred local app scripts. If jsDelivr is slow or unreachable, the fallback itself is another external network request. This is an early launch risk before app code can render or diagnose anything.

Owner files/functions:

- `index.html`: Supabase CDN script and fallback.
- `assets/js/supabase/supabase-core.js`: `KlevbySupabaseCore.initClient()` creates the client once the library exists.
- `assets/js/app.js`: `initSupabase()` refuses to continue if Supabase config or library is unavailable.

### App boot path

Owner: `assets/js/app.js`

Path:

1. `document.addEventListener("DOMContentLoaded", startKlevbyAppWhenAllowed)`.
2. `startKlevbyAppWhenAllowed()` either goes through `KlevbyAppSurface.runWhenAllowed()` or calls `initKlevbyApp()` directly.
3. `initKlevbyApp()`:
   - patches profile shortcuts/lifecycle hooks;
   - calls `initSupabase()`;
   - initializes local form/default weather UI helpers;
   - starts `fetchWeather()` without awaiting it;
   - registers install prompt and service worker if available;
   - **awaits `initAuth()`**;
   - then renders profile feed/floating button;
   - in `finally`, marks boot completed and calls `finalizeColdHomeBootPresentation()`.
4. `finalizeColdHomeBootPresentation()` only calls `showSection("home")` if Home owner reports active.

Blocking points:

- `initSupabase()` is a hard gate. If `window.supabase` is missing, boot returns before auth/posts/finalization.
- `await window.initAuth()` blocks the final Home presentation path.
- If `initAuth()` hangs on auth or posts, `finally` in `initKlevbyApp()` is not reached until those awaits settle.

Weak-network failure modes:

- Slow CDN Supabase library means `initSupabase()` cannot run or local scripts are delayed.
- Slow Supabase auth request means `initAuth()` cannot progress.
- Slow posts/trips load means `initAuth()` remains pending even after auth state is known.
- Splash force-hide can remove splash at 5.2s while Home finalization is still waiting, creating an apparent blank/hung app.

### Splash lifecycle

Owner: `assets/js/app/app-splash.js`, with safety fallback in `assets/js/app.js`.

Current behavior:

- `app-splash.js` hides splash on `window.load` and has a force-hide timer at 5.2s.
- `app.js` has `ensureAppSplashSafety()` fallback with the same broad behavior if the splash module is unavailable.
- Splash is **not** currently coupled to Supabase, auth, posts, service worker, diagnostics, or cache success.

Audit conclusion:

- Current splash lifecycle is intentionally simple and should not be changed in the first weak-network follow-ups.
- The perceived hang is more likely because boot/Home finalization waits on network work while splash is time-based.

### Auth startup path

Owners: `assets/js/auth.js`, `assets/js/app.js`, `assets/js/supabase/supabase-auth-service.js`

Path:

1. `initKlevbyApp()` awaits `initAuth()`.
2. `initAuth()` awaits `restoreAuthState("init", false)`.
3. `restoreAuthState()` awaits `supabaseClient.auth.getSession()`.
4. If no session user is found, it awaits `supabaseClient.auth.getUser()`.
5. It sets `authReady = true`, syncs global auth state, updates UI, then either renders posts or reloads posts when needed.
6. `initAuth()` then sets auth mode, may show the auth section for guests, and **awaits `loadPosts()`**.

Blocking points:

- `supabaseClient.auth.getSession()` has no explicit app timeout in `restoreAuthState()`.
- `supabaseClient.auth.getUser()` has no explicit app timeout in `restoreAuthState()`.
- `initAuth()` serializes auth restore before its own posts load.
- `initKlevbyApp()` serializes boot completion behind `initAuth()`.

Existing fallback mechanisms:

- Auth catches errors, marks `authReady = true`, syncs global auth state, and leaves the app in its previous/current user state.
- Auth has a recent logout guard that can bypass auth restore and refresh guest state.
- Feed Supabase auth helpers already define soft auth timeouts for some feed actions, but `restoreAuthState()` does not reuse them.

Weak-network failure modes:

- A request that remains pending at the browser/Supabase SDK layer can keep boot pending with no app-level deadline.
- `getSession()` may read local state but can also trigger SDK internals; `getUser()` is network-backed and is especially risky on weak internet.
- Guest users can still be routed to auth after restore, but that decision is delayed by the auth network path.

### Posts / Trips startup path

Owners: `assets/js/posts/posts-api.js`, `assets/js/posts/posts-render.js`, `assets/js/trips/*`, `assets/js/auth.js`

Path:

1. `initAuth()` always calls `await loadPosts()` at the end.
2. `loadPosts()` sets initial-load flags and can write loading skeletons into `#tripsFullscreenPostsSection`.
3. It uses REST-first (`queryPostsRestSafe()`), then SDK fallback (`queryPostsSdkSafe()`), inside `withPostsTimeout(..., POSTS_LOAD_TIMEOUT_MS)`.
4. Timeout/retry errors schedule a delayed reload and return.
5. Success updates global posts state and renders Trips/list views through posts/trips render owners.

Blocking points:

- Even though posts have a timeout/retry wrapper, the initial call is awaited by `initAuth()`, which is awaited by boot.
- REST-first plus SDK fallback can consume most or all of the 9s timeout budget before Home finalization.
- Reusing the same active posts load promise means later forced loads can wait behind an already pending startup load.

Existing fallback mechanisms:

- Posts have `POSTS_LOAD_TIMEOUT_MS`, max retries, retry delay, active-load de-duplication, loading/error messages, and scheduled retry.
- Trips render owner can render empty/list states once data state changes.

Weak-network failure modes:

- Installed app opens to splash/blank while posts load is pending, even though Home could be visible without Trips data.
- If retry scheduling starts but Home finalization was delayed until the first timeout, user sees a long startup stall.
- Trips screen can display skeletons or info states during load; those are appropriate inside Trips but should not be boot blockers for Home.

### Feed startup path

Owners: `assets/js/feed/feed-main.js`, `assets/js/feed/feed-render.js`, `assets/js/feed/supabase/*`, `assets/js/feed/feed-actions.js`

Path:

1. Feed main starts on `DOMContentLoaded` or `KlevbyAppSurface.runWhenAllowed()`.
2. `initKlevbyFeed()` exposes legacy globals, warms modules, binds hooks, starts polling/DOM watcher, schedules initial renders, and starts realtime later at 1.5s and 6s.
3. Feed Supabase posts use REST-first with SDK fallback and explicit REST/SDK timeout helpers.
4. Feed rendering has memory/cache render fallbacks for in-process or existing render cache state.

Blocking points:

- Feed module boot is largely parallel and is not directly awaited by `initKlevbyApp()`.
- Feed action/auth helpers can call `restoreAuthState()` for actions; that can inherit auth restore timeout risk, but not during first Home visual boot unless triggered.
- Initial realtime startup adds network work shortly after boot, but it is delayed and not awaited by app boot.

Existing fallback mechanisms:

- Feed Supabase core has `withTimeout()` and `rejectTimeout()`.
- Feed render has memory/cache render fallback paths.
- Feed realtime is delayed and guarded through feed events/main.

Weak-network failure modes:

- Feed list can remain empty or stale if the REST/SDK load fails and there is no prior in-memory/cache content.
- Realtime connection attempts add network noise shortly after launch, but should not block Home.

### Weather startup path

Owner: `assets/js/weather.js`, bridge owner `assets/js/app/app-home-figma-weather-bridge.js`

Path:

1. `initKlevbyApp()` calls `window.fetchWeather()` without awaiting it.
2. `fetchWeather()` performs `fetch()` to OpenWeather for Minsk.
3. On success it publishes `KlevGoWeatherState` and dispatches `klevgo:weather-updated`.
4. On error it publishes a static fallback weather state.

Blocking points:

- Weather does not block boot because it is not awaited.
- However, `fetchWeather()` uses plain `fetch(url)` without `AbortController` or timeout, so the promise can remain pending for a long time.

Existing fallback mechanisms:

- Weather catch block publishes a static fallback if the request rejects.
- Home weather bridge can consume `KlevGoWeatherState` events.

Weak-network failure modes:

- On weak internet, the weather promise can stay pending and never reach catch, so fallback weather state may not publish until browser/network timeout.
- If initial static UI is insufficient or bridge waits for the event, the Home weather card can show placeholder/skeleton longer than needed.

### Ponds startup path

Owner: `assets/js/ponds.js`, `reloadPondsIfReady()` bridge in `assets/js/app.js`

Path:

1. `ponds.js` binds events and schedules `loadPonds()` on `DOMContentLoaded` after 900ms.
2. Auth changes schedule another ponds load after 900ms.
3. `reloadPondsIfReady()` in app.js delays/reduces duplicate reloads and calls the ponds bridge when available.

Blocking points:

- Ponds load is not awaited by app boot.
- It does add background Supabase work during early startup.

Weak-network failure modes:

- Ponds section can remain skeleton/loading if Supabase is slow.
- Background ponds load may compete with auth/posts/weather on a weak connection.

### Map startup path

Owners: `assets/js/map-logic.js`, `assets/js/map/*`, `assets/js/supabase/water-depth-sources.js`

Path:

1. Map logic is loaded at startup but map initialization is lazy through `ensureMapInitialized()` / `initMapLogic()`.
2. `initMapLogic()` prepares the container, waits for Supabase client if missing, initializes MapLibre or Yandex provider, then reloads map data.
3. Water-depth sources query Supabase when their feature path is invoked.

Blocking points:

- Map initialization is not part of first Home visual boot unless the user navigates to Map or an action opens a map/depth feature.
- `waitForMainSupabaseClient()` and provider API loading are likely weak-network risks for the Map screen, but should remain Map-owned.

Weak-network failure modes:

- Map screen can show loading while waiting for Supabase client, MapTiler/Yandex assets, style loading, or fishing spot data.
- Map provider initialization can fail or hang independently of Home.

## Screens/components that can show blank, skeleton, or loading for too long

- App shell/Home: can appear blank after splash if `initKlevbyApp()` has not reached `finalizeColdHomeBootPresentation()` due to auth/posts awaits.
- Auth screen: status starts as “Проверяем вход...” and can be delayed by auth restore.
- Trips list: startup `loadPosts()` can inject skeletons and then retry messages; acceptable inside Trips but risky as a Home boot dependency.
- Feed full section: `#profileFeedSection` starts with skeleton markup; feed has render/cache fallback but no guarantee of visible fresh data on first weak-network launch.
- Ponds section: starts with skeletons and loads in background.
- Map: loading state can persist while provider/Supabase/style/data are pending.
- Weather card: fallback exists only when `fetchWeather()` rejects; no app-level timeout means pending fetch can delay fallback publication.

## Existing fallback mechanisms that are safe to reuse

- Splash force-hide and fallback safety already exist; do not couple them to network state.
- Posts have timeout/retry infrastructure and scheduled retry; follow-ups can reuse this after removing boot dependency.
- Feed Supabase core has soft/reject timeout helpers for feed operations.
- Weather has a static fallback publisher in the catch path.
- App resume manager already distinguishes boot completion/resume refresh; do not add a competing boot lifecycle.
- Shell/Home owners already provide measured geometry and diagnostics; do not add viewport or device-specific patches.

## Reverted PR risk assessment (#791–#800)

The rollback history shows a risky pattern: multiple PRs coupled boot hardening, offline cache, splash timing, diagnostics overlay, map fallback, and service worker/cache changes into the same launch-critical area.

- #791 (`af17ab3`): added offline boot hardening, boot store, network state, diagnostics, splash edits, auth edits, map edits, index edits, and `sw.js` edits in one PR. Risk: too many owners in the boot path changed together, making it hard to isolate whether launch broke from splash, cache, diagnostics, auth, or service worker behavior.
- #792 (`2e9feba`): added last-known cache across Home, Feed, Trips, weather, posts rendering/API, boot store, diagnostics, index, and `sw.js`. Risk: cache/read-through UI state became coupled to first render and service worker assets.
- #793 (`2d5ebdb`): added offline map fallback plus last-known map/cache changes and `sw.js`. Risk: Map-owned offline behavior and global boot/cache behavior changed together.
- #794 (`abe13c6`): changed splash timing by waiting for intro animation before revealing shell and also touched boot hardening, weather bridge, Figma shell, global CSS, index, and `sw.js`. Risk: splash became coupled to animation and boot hardening instead of staying a simple lifecycle overlay.
- #795–#797 (`412b3af`, `97e6a3d`, `fd574a8`): expanded global diagnostics/overlay and touched splash/diagnostics/index/`sw.js`. Risk: diagnostics became runtime launch code, and overlay/freeze fixes changed app startup behavior.
- #798–#800 (`a2b3e92`, `d64c093`, `2676262`): repeatedly touched splash intro animation, global CSS/main CSS, diagnostics, index, `sw.js`, and tests. Risk: repeated splash/diagnostics/cache interactions obscured the real weak-network blocker.

Audit conclusion: the unsafe part was not the goal of weak-network support. The unsafe part was combining **boot gating**, **offline cache**, **service worker changes**, **splash timing**, **diagnostics UI**, and **screen fallbacks** into launch-critical PRs. Follow-ups must isolate one owner and one reversible behavior at a time.

## Safe follow-up PR sequence

### PR 1 — Audit instrumentation only, no behavior change

Goal: make the current boot waits measurable without changing launch order.

Small change:

- Add lightweight console/performance marks around existing awaits in `initKlevbyApp()`, `initAuth()`, `restoreAuthState()`, `loadPosts()`, and `fetchWeather()`.
- No UI overlay; no diagnostics screen; no splash/service worker/cache changes.

Do not touch:

- `sw.js`, splash lifecycle, Home geometry, TouchBar, App Shell measurements, cache versions, Map/Trips/Profile/Chat/Create behavior.

Rollback criteria:

- Any new console error, exception, measurable startup regression, or visible UI difference.

### PR 2 — Auth restore deadline only

Goal: prevent auth restore from blocking boot indefinitely.

Small change:

- Wrap `restoreAuthState("init")` Supabase auth calls with an app-owned soft timeout that marks auth ready as guest/current cached state and lets boot continue.
- Do not change login/register/logout behavior.

Do not touch:

- Splash, service worker, posts/trips data loading, Home geometry, Feed cache, Map.

Rollback criteria:

- Logged-in users are unexpectedly logged out, auth status flickers incorrectly, or auth callbacks regress.

### PR 3 — Decouple Home visual finalization from posts load

Goal: Home shell becomes visible before Trips/posts network data finishes.

Small change:

- Let `initAuth()` finish auth/UI state without awaiting initial `loadPosts()` for Home boot; schedule posts load after Home finalization using existing posts retry infrastructure.
- Keep Trips list behavior owned by posts/trips modules.

Do not touch:

- Posts query semantics, Supabase schema, Trips rendering rules, Home geometry, TouchBar, splash, service worker.

Rollback criteria:

- Trips data does not load after boot, Home action cards break, or posts load no longer retries after weak-network recovery.

### PR 4 — Weather timeout using existing fallback

Goal: make weather fallback publish on weak internet instead of waiting for browser fetch timeout.

Small change:

- Add an `AbortController` timeout or Promise timeout to `fetchWeather()` so existing catch fallback publishes after a short deadline.

Do not touch:

- Weather UI layout, Home geometry, cache/local storage, service worker, splash.

Rollback criteria:

- Weather never updates on normal internet, fallback overwrites successful fresh weather, or console shows abort errors as uncaught failures.

### PR 5 — Reduce non-Home early network contention

Goal: delay nonessential background network until Home is visible.

Small change:

- Gate only early background tasks that are not required for first Home visual readiness, such as ponds scheduled load or feed realtime start, behind existing app readiness events/timers.

Do not touch:

- Feed content rendering, Trips posts loading semantics, Map lazy initialization, service worker, splash, Home geometry.

Rollback criteria:

- Feed/ponds stop refreshing, auth-change refreshes regress, or realtime subscriptions fail to start after a normal boot.

### PR 6 — Map-only weak-network fallback audit/fix

Goal: improve Map screen loading separately from Home startup.

Small change:

- If diagnostics prove Map-specific hangs, add Map-owned timeout/status handling around provider/Supabase waits.

Do not touch:

- Home boot, splash, service worker, global cache, Trips, Feed.

Rollback criteria:

- Map provider fails on normal network, markers/depth layers regress, or Home startup changes.

## Current suspected root cause

The strongest root cause is **serial boot coupling**: `initKlevbyApp()` waits for `initAuth()`, and `initAuth()` waits for both auth restore and posts loading before Home presentation is finalized. The auth calls have no local timeout, and posts are not required for the first visible Home shell. On weak internet, this makes data readiness a prerequisite for visual readiness.

Second-order contributors:

- External Supabase CDN loading is startup-critical and parser-blocking.
- Weather has fallback but no timeout.
- Ponds/feed realtime/background loads add early network contention.
- Map has its own weak-network risks, but it is lazy and should not be part of Home boot fixes.

## Non-goals / do-not-touch list for weak-network follow-ups

- Do not change `sw.js` or cache versions until a specific service-worker bug is proven.
- Do not add last-known Home/Feed/Trips/Map cache in the first follow-ups.
- Do not change splash timing or couple splash to auth/network/cache/diagnostics.
- Do not change Home geometry, density tiers, lower rhythm solver, TouchBar, or App Shell measurements.
- Do not add device/model/screenshot-specific logic.
- Do not move layout responsibility from CSS into JavaScript.
- Do not modify Trips/Map/Chat/Profile/Create Flow while fixing Home boot unless a follow-up is explicitly scoped to that owner.
- Do not add global diagnostics overlays into startup runtime.
