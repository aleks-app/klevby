# KlevGo PWA pre-splash cold-start audit

## 1. Observed problem summary

Installed iPhone PWA launch is currently reported as:

1. User taps the Home Screen icon.
2. An empty dark/black screen appears with no logo and no app UI for roughly 2–2.5 seconds.
3. A full white screen appears.
4. The normal KlevGo splash appears.
5. Home opens normally.

This audit treats the KlevGo splash as **not broken**. The reported defect is the **pre-splash interval** before the branded splash can be painted. Existing `startupTimings` can be healthy while this still feels bad because those timings start when application JavaScript is already parsing/running, while the user-visible dark/white delay can happen earlier: iOS standalone WebView creation, `start_url` navigation, service-worker navigation response, HTML delivery, render-blocking CSS, and first paint.

## 2. Cold-start timeline

### A. Tap Home Screen icon

- iOS opens a standalone WebView because `index.html` declares `apple-mobile-web-app-capable=yes` and `apple-mobile-web-app-status-bar-style=black-translucent`.
- During this native WebView creation phase the app has not necessarily requested or painted HTML yet. A dark/black native surface is plausible here because the page metadata and manifest use black theme/background values.

### B. Manifest / `start_url` navigation

- The manifest is generated at runtime by `assets/js/pwa-manifest.js`, not as a static `.webmanifest` file.
- The generated manifest sets:
  - `start_url: "./index.html"`
  - `scope: "./"`
  - `display: "standalone"`
  - `orientation: "portrait"`
  - `background_color: "#000000"`
  - `theme_color: "#000000"`
- Because the installed PWA uses `./index.html`, launch should target same-origin `/index.html` relative to the installed scope. This audit did not find an app-owned redirect in the source path. However, deployed host behavior must still be verified externally: if `https://klevby.com/index.html` redirects to `/`, or `http` redirects to `https`, iOS may spend part of the blank pre-splash window waiting on navigation before any app HTML can paint.

### C. Service worker involvement

- The service worker is registered at `/sw.js` from `assets/js/pwa.js` after application initialization begins.
- Once installed and controlling the page, `sw.js` intercepts same-origin `GET` requests.
- Navigation/HTML requests are detected by `request.mode === "navigate"`, `/`, or `.html` paths and are handled with `networkFirst(request, { cacheHtmlFallback: true })`.
- `networkFirst()` waits for a fresh network `fetch(..., { cache: "no-store" })` before consulting cache. Only after network failure does it return the exact cached request or `/index.html` fallback.
- Therefore, on a cold PWA launch with an active controller, the current navigation strategy can delay the first HTML response behind network latency even though `/index.html` is precached. On lake/3G this can become much worse than on good LTE.

### D. HTML response and first parser work

- `index.html` starts with blocking scripts before its metadata and stylesheet links:
  - `assets/js/app/app-surface-gate.js`
  - Supabase CDN script
  - fallback `document.write()` for Supabase CDN
- The first stylesheet link (`assets/css/main.css`) is later in the `<head>` after metadata, PWA tags, icons, preconnects, and DNS hints.
- There is no critical inline CSS in the document head that sets a branded first paint for `html`, `body`, or `#klevbyAppRoot` before external CSS is available.

### E. First paint before external CSS

- If WebKit paints after HTML arrives but before `assets/css/main.css` and its `@import` chain are fully applied, the default canvas/body background is white.
- The dark app background, `html { background: #000000; }`, body gradient, and `.app-splash` overlay are all in `assets/css/base/global.css`, reached through `assets/css/main.css` via `@import`.
- `main.css` itself imports many downstream CSS files. The splash styling is not inline; it depends on `main.css -> base/global.css` being fetched and parsed.

### F. Splash becomes visible

- The splash DOM exists early in the body as `#appSplash.app-splash`.
- Its full-screen black/radial overlay, logo layout, and animation are defined in `assets/css/base/global.css`.
- The splash lifecycle JavaScript is loaded near the end of `index.html` as `assets/js/app/app-splash.js` with `defer`.
- The splash JavaScript hides/removes the splash after a minimum visible duration or force timeout; it does not create the first visual surface. CSS availability is what makes the existing splash DOM appear as the branded splash.

### G. App JS startup and Home open

- `assets/js/app.js` starts `initKlevbyApp()` on `DOMContentLoaded`, after the HTML has already been parsed far enough for deferred scripts to execute.
- `startupTimings` around `initKlevbyApp`, `initAuth`, posts, and weather measure this later application phase, not native WebView creation, navigation wait, first HTML byte, render-blocking CSS, or first paint.

## 3. Owner files

### Manifest / PWA metadata

- `assets/js/pwa-manifest.js`
  - Runtime-generated manifest.
  - Owns `start_url`, `scope`, `display`, `orientation`, `background_color`, `theme_color`, and icons.
- `index.html`
  - Owns `theme-color`, `background-color`, iOS standalone tags, Apple touch icon, and manifest link element.

### Service worker / navigation response

- `sw.js`
  - Owns precache list, same-origin fetch interception, navigation detection, `networkFirst()`, cache fallback, and static asset strategies.
- `assets/js/pwa.js`
  - Owns service-worker registration and update flow.

### First HTML paint / head / load order

- `index.html`
  - Owns document order before first paint: blocking scripts, metadata, stylesheet links, body splash DOM, and deferred scripts.
- `assets/css/main.css`
  - Owns CSS import graph entry point.
- `assets/css/base/global.css`
  - Owns `html`, `body`, app background, and splash CSS.

### Splash first visibility and lifecycle

- `index.html`
  - Owns initial splash DOM (`#appSplash`).
- `assets/css/base/global.css`
  - Owns splash visual presentation and animation CSS.
- `assets/js/app/app-splash.js`
  - Owns splash hide timing and removal.
- `assets/js/app.js`
  - Contains a fallback splash safety hide and starts app initialization.

## 4. Most likely causes

### Cause of the empty dark screen

Most likely: the empty dark screen is the iOS standalone WebView / PWA launch surface before app HTML and renderable CSS are available. The repository aligns PWA metadata to black (`theme-color`, manifest `theme_color`, manifest `background_color`, and black-translucent iOS status bar), so a black native launch surface is expected. The problem is not the color itself; it is that this surface is unbranded and lasts around 2–2.5 seconds.

The strongest source-level risk is the service-worker navigation strategy: controlled navigations use network-first HTML. Even with `/index.html` precached, the SW tries network first and only uses cached HTML after network failure. On weak networks that are slow but not failed, the user can wait on a blank native surface before any HTML reaches the renderer.

### Cause of the full white screen

Most likely: once HTML starts rendering, there is no inline critical first-paint background. The CSS that makes `html`, `body`, and `.app-splash` dark/branded lives in external CSS reached through `assets/css/main.css` and `@import`. Before those styles apply, WebKit can paint the default white page canvas. That creates a white screen between the native dark launch surface and the styled KlevGo splash.

A secondary risk is stale/mixed cache: `sw.js` precaches `/index.html` and `/assets/css/main.css`, but the live HTML references cache-busted CSS/JS URLs while the SW app shell list includes unversioned paths. Because CSS/JS are classified as fresh assets and served network-first, a controlled launch can combine cached HTML fallback with network-first style/script loading. That can extend or vary the white pre-splash period if CSS is slow, stale, or unavailable.

### Why good JS timings do not contradict the bad launch feel

`initKlevbyApp ~20ms`, `initAuth ~15ms`, and non-blocking posts/weather describe the app after JavaScript has begun. The reported black/white sequence can happen before:

- app JS starts,
- `DOMContentLoaded` fires,
- `initKlevbyApp()` marks its first timing,
- splash hide/show lifecycle code runs,
- posts/weather/auth are relevant.

So the app can have excellent JavaScript startup metrics while the user still waits several seconds for iOS navigation, SW network-first HTML, external CSS, and first styled paint.

## 5. Network / cold-start risk

### Good LTE

On good LTE, network-first `/index.html` may return quickly enough that the black native surface is brief. If `main.css` and imported CSS also arrive quickly, the white flash may be short or barely noticed. The normal splash then appears and Home opens normally.

### Lake / 3G / weak network

On lake/3G, the same sequence can degrade significantly:

- iOS creates the standalone WebView and shows an unbranded dark surface.
- The SW-controlled navigation waits for network HTML even though cached HTML may exist.
- HTML can begin without the external CSS needed for dark/branded first paint.
- CSS uses an import graph, so splash/body styling can be delayed behind stylesheet fetch/parse work.
- The user sees dark blank, then white blank, then the normal splash.

Current source structure therefore suggests the app may depend on network and external CSS before showing any branded app surface.

## 6. Safe follow-up PR plan

Each follow-up must be tiny, reversible, and separately verifiable.

### PR 1: critical dark first paint only

Goal: prevent a white first paint before external CSS.

- Scope only the earliest document paint contract.
- Candidate owner: `index.html` head critical inline style.
- Keep it minimal: `html`, `body`, and root/splash background only.
- Do not change splash lifecycle, app JS, Home geometry, cache versions, or service worker.

### PR 2: PWA metadata color alignment only, if needed

Goal: ensure iOS/manifest/native surfaces match the intended earliest app background.

- Scope only PWA visual metadata.
- Candidate owners: `index.html` PWA meta tags and/or `assets/js/pwa-manifest.js`.
- Keep black/dark colors aligned with PR 1.
- Do not change runtime boot logic.

### PR 3: navigation/SW audit-informed improvement only, if proven

Goal: avoid waiting on network before any HTML is available.

- Scope only navigation response strategy in `sw.js`.
- Consider only after deployed-device diagnostics prove the dark blank is dominated by navigation/network wait.
- Do not change cache version or cache-clearing behavior unless separately approved.
- Do not mix with auth/posts/weather, splash animation, Home, TouchBar, or diagnostics UI.

### PR 4: splash first-frame polish only, only if later proven necessary

Goal: improve splash first frame if the splash itself is later shown to be the issue.

- Scope only splash presentation owner files.
- Do not change splash lifecycle timing unless the audit target changes and evidence proves it is necessary.
- Keep the current conclusion intact: the reported problem is before the normal splash.

## 7. Dangerous things not to mix

Do not mix future pre-splash fixes with:

- auth, `initAuth`, Supabase session handling, or login state;
- posts, feed loading, weather loading, or lake data;
- Home geometry, lower rhythm solver, density tiers, App Shell measurements, or TouchBar;
- service-worker cache version changes unless specifically required and separately approved;
- update prompts, diagnostics overlays, or new diagnostics UI;
- a revival of the previous large splash/cache/boot PR chain.

The next fix should be contract-level and minimal: earliest paint first, then metadata, then SW navigation only if proven.

## 8. Acceptance criteria for future fixes

- From tap to first visible app surface, the user should not see white.
- The earliest visible surface should be dark/branded or at least dark and consistent with the final splash.
- The app should not need network to avoid a blank/white pre-splash screen.
- Home geometry must remain unchanged.
- TouchBar and App Shell measurements must remain unchanged.
- Splash remains normal and is not treated as the root issue unless later diagnostics prove otherwise.

## 9. Audit PR acceptance

- Only `docs/audits/pwa-pre-splash-cold-start-audit.md` is changed.
- No runtime files are changed.
- The report separates pre-splash startup from the splash itself.
- The report explains why good JS timings do not contradict the user-visible black/white delay.
