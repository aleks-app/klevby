# KlevGo Full Application Audit & Global Diagnostics

**Audit date:** 2026-06-24  
**Audit version:** `2026-06-24-full-audit-1`  
**Branch:** `codex/full-app-audit-diagnostics`  
**Scope:** Boot, App Shell, all primary screens, TouchBar, offline/cache, auth, diagnostics instrumentation. No layout redesign.

---

## Executive summary

KlevGo has a **shell-first boot architecture** that correctly avoids blocking first paint on Supabase/auth. Offline boot hardening, last-known cache, splash timing, and map fallback are in place and working as designed.

This audit adds a **global diagnostics snapshot** (`window.__KLEVBY_GLOBAL_DIAGNOSTICS__`) integrated into the existing 7-tap logo diagnostics overlay. The snapshot is phone-safe (no tokens, no profile dumps) and covers boot, shell, screen contract, TouchBar, network, caches, auth status, and per-screen health.

**Top risks (not fixed in this PR):**

1. Home Figma overlays and TouchBar home-mode positioning still rely on token fallbacks including `847px` — geometry must stay token-driven via `app-shell-viewport-owner.js` / `app-home-screen-owner.js`.
2. Chat uses a separate overlay/viewport module (`chat-viewport.js`) outside the main section routing contract.
3. Map provider failures are isolated but MapLibre lazy load can still degrade UX on weak networks.
4. Several `100vh` usages remain (low risk with `dvh` tokens elsewhere).
5. `tests/touchbar-screen-contract.test.js` is **stale** — expects literal `top: 847px` while CSS uses `var(--klevby-home-touchbar-top, 847px)`.

**What this PR changed:** Global diagnostics module, splash/network diagnostic hooks, diagnostics UI summary + Copy global JSON, audit report. **No Home/Trips/TouchBar geometry changes.**

---

## What was audited

| Area | Primary files reviewed |
|------|------------------------|
| Boot / startup | `index.html`, `app-boot-store.js`, `app-boot-hardening.js`, `app-splash.js`, `app.js`, `auth.js` |
| App Shell | `app-shell-viewport-owner.js`, `app-navigation.js`, `app.js` (`showSection`) |
| TouchBar | `mobile-tabbar.css`, `ui-tabbar.js`, `app-android-diagnostics.js` |
| Offline / cache | `app-network-state.js`, `app-last-known-cache.js`, `app-last-known-map.js`, `sw.js`, `pwa.js` |
| Auth / Supabase | `auth.js`, `supabase-core.js`, `app-boot-store.js` |
| Home | `app-home-screen-owner.js`, `home-mobile.css`, Figma bridge modules |
| Feed / Trips | `feed-main.js`, `feed-render.js`, `trips-screen-owner.js`, `app-trips-create-flow-owner.js` |
| Map | `map-logic.js`, `water-body-detail.js`, `depth-maps-registry.js` |
| Chat / Profile | `chat-shell.js`, `chat-viewport.js`, `profile-core.js` |
| CSS layout risks | Grep across `assets/css/` |
| JS risks | Grep across `assets/js/` |

---

## Current boot flow

```
index.html
  ├─ inline trace / boot-store / last-known / network / boot-hardening (early defer)
  ├─ #klevbyAppRoot + #appSplash (body.klevby-splash-active hides chrome)
  ├─ header + sections (Home shell DOM)
  └─ deferred scripts → app-shell-viewport-owner → app-splash → … → app.js

app-boot-store.js
  ├─ markFirstRender on DOMContentLoaded
  └─ captures events, errors, network errors

app-boot-hardening.js
  ├─ global error / unhandledrejection → emergency screen
  └─ does NOT hide splash directly

app-splash.js
  ├─ min 1500ms visible, intro 2400ms, force hide 3400ms
  ├─ hides when shell ready AND visual timing met
  └─ klevby-app-splash-hidden event

app.js initKlevbyApp()
  ├─ finalizeColdHomeBootPresentation() — sync, no await
  ├─ initSupabase() — sync client setup
  ├─ fetchWeather / SW register — non-blocking
  ├─ runBootAuthInBackground() — void, 15s timeout, does NOT block boot
  └─ markBootCompleted in finally

klevby-app-shell-ready
  └─ splash hideAppSplashWhenShellReady
```

**Boot does not await auth** before first render. Auth restore runs in background with `withTimeout(..., 15000)`.

---

## App Shell / screen contract status

`showSection()` in `app.js` assigns:

| Screen key | Section ID | Type | Chrome mode |
|------------|------------|------|-------------|
| home | homeSection | tab | home |
| feed | feedSection | tab | feed |
| trips | tripsSection | tab | trips |
| map | mapSection | tab | map |
| market | marketSection | fullscreen | inner |
| ponds | pondsSection | fullscreen | inner |
| water-body-detail | waterBodyDetailSection | fullscreen | inner |
| auth | authSection | fullscreen | inner |
| profile | profileSection | fullscreen | inner (via openKlevbyProfile) |

**Create Trip Flow** is overlay type `flow` via `KlevbyTripsCreateFlowOwner` (not a routed section).

**Chat** is a floating shell (`chat-shell.js`), not a `showSection` target — opens from TouchBar `#nav-chat`.

### Screen-by-screen status

| Screen | Type | Shared viewport | Safe-area | TouchBar | Hardcoded layout risk | Offline | Notes |
|--------|------|-----------------|-----------|----------|----------------------|---------|-------|
| Home | tab | Partial — Figma bridge + `app-home-screen-owner` | Yes (tokens) | Yes (home chrome mode) | Medium — Figma fixed overlays | Last-known home/weather | Geometry-first owner exists |
| Feed | tab | Yes | Yes | Yes | Low | Last-known feed | Skeleton/empty states present |
| Trips | tab / fullscreen CSS | Yes | Yes | Hidden in fullscreen | Low–medium | Last-known trips | Create flow is separate overlay |
| Create Flow | flow | Overlay | Yes | Hidden when open | Low | Draft local only | 6-step, header back wired |
| Map | tab | Yes | Yes | Yes | Medium — map canvas | Viewport/waterbody cache | Lazy MapLibre, offline fallback |
| Chat | overlay | Separate `chat-viewport.js` | Partial | Launcher in tabbar | Medium | Limited | Not in section routing |
| Profile/Auth | fullscreen | Partial | Yes | Restored on exit | Low | Guest mode | Auth flash risk mitigated by background restore |
| Marketplace | fullscreen | Yes | Yes | Hidden | Low | Unknown | Wired in navigation |
| Ponds | fullscreen | Yes | Yes | Hidden | Low | Unknown | Bridge module |
| Waterbody detail | fullscreen | Yes | Yes | Hidden | Medium | Map cache keys | Back to map |

---

## Offline / cache status

| Component | Status |
|-----------|--------|
| `KlevbyNetworkState` | online / weak / offline + probe via `index.html` fetch |
| Service worker | `sw.js` v `20260624-full-app-audit-1`, app shell assets |
| Last-known cache | Keys: feed, trips, weather, home, map-* |
| Home/Feed/Trips fallback | Integrated via last-known modules |
| Map fallback | `KlevbyLastKnownMap` + offline UI in map-logic |
| Tile caching | Not implemented (intentional — legal/provider constraints) |

---

## Diagnostics added

### `window.__KLEVBY_GLOBAL_DIAGNOSTICS__`

Published by `assets/js/app/app-global-diagnostics.js` (`KlevbyGlobalDiagnostics`).

Sections: `boot`, `appShell`, `currentScreen`, `viewport`, `safeArea`, `TouchBar`, `network`, `serviceWorker`, `caches`, `lastKnownCache`, `auth`, `supabase`, `Home`, `Feed`, `Trips`, `CreateFlow`, `Map`, `Chat`, `screens[]`, `errors`, `warnings`, `auditVersion`, `timestamp`.

### Visible UI (`app-android-diagnostics.js`)

- **7-tap logo** on Home (iPhone PWA standalone or Android native) opens diagnostics panel.
- **Global summary** lines: screen, network, boot, auth, warning count.
- **Copy JSON** — full layout + global diagnostics bundle.
- **Copy global JSON** — compact global snapshot only (phone-friendly).
- Existing: Clear diagnostics, Simulate offline, Clear last-known cache, Clear map cache, Refresh.

### How to open on device

1. Open app on iPhone PWA (installed) or Android APK.
2. Go to **Home** tab.
3. Tap the **KlevGo logo** in the header **7 times** within 4 seconds.
4. Use **Copy global JSON** or **Copy JSON** and paste into Notes/messenger.

URL flags (dev): `?klevbyAndroidDebug=1` or `?klevbyViewportDebug=1`.

---

## CSS layout risk scan

| Pattern | Count / location | Risk |
|---------|------------------|------|
| `top: NNNpx` (3+ digits) | None in CSS files | — |
| `847px` fallback | `mobile-tabbar.css:37`, `home-empty-ad-shell.js` | **Medium** — fallback only; real value must come from `--klevby-home-touchbar-top` |
| `100vh` | `global.css`, `app-surface-gate.css`, `profile-public.css` | **Low** — mitigated by `--klevby-app-height` / `dvh` elsewhere |
| z-index splash/chrome | splash `2147483645`, emergency `2147483646`, Figma overlays `2147480000+` | **Medium** — ordering documented; splash fix merged |
| Duplicate viewport listeners | `app-shell-viewport-owner`, `app-home-screen-owner`, `chat-viewport` | **Medium** — potential double measurement |
| `overflow: hidden` on body/html | boot/splash/home lock | **Low** — intentional for mobile shell |

---

## JavaScript risk scan

| Pattern | Finding | Risk |
|---------|---------|------|
| Unhandled fetch | Network probe has AbortController; auth uses `withTimeout` | Low |
| Fetch without timeout | Map tile/provider fetches, some feed APIs | Medium |
| Await before first render | `initKlevbyApp` has no top-level await; auth backgrounded | Low |
| Unhandled rejection | `app-boot-hardening.js` global handler | Low |
| Direct Supabase without wrapper | `auth.js`, `map-logic.js`, profile modules | Medium — isolated |
| DOM assumed present | Guarded in boot hardening; some feed/map paths assert nodes | Medium |
| Console-only diagnostics | Map uses `console.warn(buildMapDiagnostic(...))` | Medium — now supplemented by global diag |
| Screen type unknown | Only when `showSection` not yet called | Low |

---

## Issue table

| ID | Severity | Area | File(s) | Description | User-visible impact | Recommended fix | Safe now |
|----|----------|------|---------|-------------|---------------------|-----------------|----------|
| AUD-001 | High | Home layout | `home-empty-ad-shell.js`, `mobile-tabbar.css` | TouchBar top uses CSS var with `847px` fallback | Wrong TouchBar position if token pipeline fails | Ensure `app-home-screen-owner` always publishes `--klevby-home-touchbar-top` | No |
| AUD-002 | High | Chat | `chat-viewport.js`, `chat-shell.js` | Chat outside App Shell section contract | Chat overlap/clipping on some devices | Unify chat viewport with shell owner | No |
| AUD-003 | Medium | Map | `map-logic.js` | MapLibre lazy load + provider fallback | Slow/blank map on weak net | Extend map diagnostics in UI; keep fallback | Partial |
| AUD-004 | Medium | CSS | Figma overlay modules | Fixed z-index overlays `2147480000+` | Rare chrome/splash conflicts | Centralize overlay z-index tokens | No |
| AUD-005 | Medium | Tests | `touchbar-screen-contract.test.js` | Expects literal `847px`/`70px` | CI false failure | Update test to match CSS variables | Yes |
| AUD-006 | Medium | Viewport | `app-home-screen-owner.js`, `app-shell-viewport-owner.js` | Duplicate resize/visualViewport listeners | Redundant work / race on resize | Consolidate listeners in shell owner | No |
| AUD-007 | Medium | Feed | `feed-api.js`, posts loaders | Some fetches lack explicit timeout | Hang on weak network | Use `KlevbyBootStore.withTimeout` | Partial |
| AUD-008 | Low | CSS | `global.css`, `profile-public.css` | `100vh` usage | Minor mobile browser chrome issues | Prefer `dvh` / `--klevby-app-height` | No |
| AUD-009 | Low | Diagnostics | `map-logic.js` | Map errors console-only | Harder field debug without 7-tap | Wire map errors to boot store (partial exists) | Yes |
| AUD-010 | Low | Profile | `profile-core.js` | Profile load async paths | Delayed profile on slow auth | Already non-blocking boot | No |
| AUD-011 | Medium | Trips | `trips-fullscreen.css` | Fullscreen mode hides tabbar | Expected; verify scroll bottom padding | Audit token consumption only | No |
| AUD-012 | Low | SW | `sw.js` | Cache version must bump with asset changes | Stale APK/PWA assets | Keep sync:www in release pipeline | Yes |

---

## Recommended next PRs

1. **Fix touchbar contract test** (AUD-005) — match CSS variable pattern.
2. **Chat shell contract** (AUD-002) — route chat through shell viewport tokens.
3. **Map diagnostics surfacing** (AUD-003/009) — push provider errors into `KlevbyBootStore`.
4. **Viewport listener consolidation** (AUD-006).
5. **Feed fetch timeouts** (AUD-007) — localized `withTimeout` wrappers.

---

## What was intentionally not changed

- Home geometry, lower rhythm solver, density tiers
- TouchBar visual design
- `showSection` routing architecture
- Auth behavior (beyond read-only diagnostics)
- Map tile caching strategy
- Full CSS/JS rewrite of layout or feed/trips loaders

---

## Test results (this PR)

| Check | Result |
|-------|--------|
| `node --check` (changed JS) | Pass |
| `npm run build:web` | Pass |
| `npm run lint` | Not configured |
| `node --test tests/*.test.js` | **1 pre-existing failure:** `touchbar-screen-contract.test.js` (AUD-005) |

---

## Changed files (instrumentation)

- `assets/js/app/app-global-diagnostics.js` (new)
- `assets/js/app/app-android-diagnostics.js`
- `assets/js/app/app-splash.js`
- `assets/js/app/app-network-state.js`
- `index.html`
- `sw.js`
- `docs/audits/app-full-diagnostics-audit.md` (this report)
