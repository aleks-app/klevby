# KlevGo splash intro diagnostics audit

## Scope

This audit is diagnostics-first. It inspects the first `#appSplash` lifecycle only and does not change Home geometry, TouchBar layout, App Shell boundaries, auth, offline boot hardening, map/cache/feed/trips logic, or diagnostics overlay behavior outside adding a compact splash copy action.

## Intended splash lifecycle

1. `index.html` paints a dark boot-safe surface before the main stylesheet arrives.
2. `#appSplash` starts in `splash-state-initial`, with the KlevGo glyphs hidden/offset by CSS.
3. `assets/js/app/app-splash.js` reapplies the initial state, waits two animation frames, then switches to `splash-state-animating`.
4. CSS keyframes reveal the `K`, wave in `levGo`, and draw the underline.
5. JavaScript marks the animation complete by `animationend` or by the intro-duration fallback.
6. The splash can hide only after the intro is complete, the minimum visible duration has passed, and the App Shell has emitted `klevby-app-shell-ready`; the safety timeout is the emergency escape hatch.
7. The splash fades out and dispatches `klevby-app-splash-hidden` after removal.

## Owner files

- `index.html` owns the earliest dark boot surface, initial splash markup, and cache-busted script/style references.
- `assets/css/base/global.css` owns the splash initial, animating, completed, reduced-motion, and fade-out visual states.
- `assets/js/app/app-splash.js` owns measured lifecycle state, timing gates, class transitions, and the exported splash diagnostics object.
- `assets/js/app/app-android-diagnostics.js` owns the 7-tap diagnostics overlay controls, now including **Copy splash JSON**.
- `sw.js` owns precached app shell assets and reports its cache/build version to the page.

## What currently happens on startup

The code is designed to defer the animation until after `app-splash.js` loads and two `requestAnimationFrame` callbacks pass. In the reported iPhone PWA failure, the expected diagnostics should show one of these timelines:

- `animationClassAddedAt` and `animationStartedAt` are present, but the computed animation fields are `none`/empty or the computed transform/opacity are already final. That indicates CSS/keyframe delivery or cascade state is overriding the intended initial/animating states.
- `shellReadyAt` and `fadeOutStartedAt` occur before `animationCompletedAt` or before the expected `introDurationMs`. That indicates lifecycle gating is being bypassed by a hide path.
- `serviceWorkerCacheVersion` reports an older cache/build than the current splash diagnostics build. That indicates stale PWA assets are involved.
- `pageStartedAt` is substantially later than first visual paint because it is set by an inline script after splash markup, so it is a lifecycle marker for in-page splash code, not a browser-launch marker. The dark boot CSS still protects the page background.

## Hide owner and event/class/timer

The normal hide path is `klevby-app-shell-ready` → `hideAppSplashWhenShellReady()` → `markShellReady()` → `evaluateHide()` → `commitHide("shell-and-visual-ready")`. `commitHide()` adds `splash-state-fading-out hide`, sets `aria-hidden="true"`, waits for the opacity/visibility transition or a fade fallback, removes the node, and dispatches `klevby-app-splash-hidden`.

The emergency hide path is the splash safety timeout in `app-splash.js`. It sets shell-ready internally after the timeout and lets `evaluateHide()` commit `force-safety-timeout` or `force-safety-timeout-shell-not-ready`.

## Does animation start at all?

This PR adds `window.__KLEVBY_SPLASH_DIAGNOSTICS__` so a device can answer this directly. If `animationStartedAt` is non-null and `computedAnimationName` is a splash keyframe name while `currentState` is `animating`, the animation did start. If `animationStartedAt` is null, `app-splash.js` did not reach `startSplashAnimation()` or did not find `#appSplash`.

## Does animation start already in final state?

The new diagnostics capture `currentClasses`, `computedOpacity`, `computedTransform`, `computedFilter`, `computedAnimationName`, and `computedAnimationDuration`. A broken device showing `splash-state-animating` with opacity `1`, transform `none`, filter `none`, and no active splash keyframe at or near `animationClassAddedAt` means the visible wordmark is already in final state before the intro can be perceived.

## Is service worker cache involved?

It can be. The service worker precaches `/index.html`, `/assets/css/main.css`, and `/assets/js/app/app-splash.js`. Because the PWA can be controlled by a previously installed worker, stale CSS/JS can explain why timer-only edits appear to change duration without restoring the real animation. This PR bumps the cache/build version and exposes `serviceWorkerCacheVersion` when the active worker answers `KLEVB_GET_SW_VERSION`.

## Is there a white frame before splash?

The document now has an inline black `html, body` background and an inline `#appSplash` dark background before the external stylesheet. If a white frame is still visible before the splash on iPhone PWA, it is likely before this document's CSS is applied (browser/PWA launch surface or stale cached `index.html`) rather than Home/App Shell geometry.

## Exact suspected root cause

The strongest code-level suspicion is stale or mixed PWA shell assets: `index.html`, `assets/css/main.css`/`assets/css/base/global.css`, and `assets/js/app/app-splash.js` are all precached by `sw.js`, while recent fixes changed both lifecycle timing and CSS state guards. A mixed state can make the splash JavaScript report reasonable timers while the CSS either starts from completed visual styles or lacks the current keyframes/initial guards. The second likely cause is lifecycle ordering where `klevby-app-shell-ready` is received very early and hide eligibility is reached as soon as the minimum duration/intro fallback passes, making an already-final wordmark feel like an instant splash.

The new diagnostics are intended to distinguish these without guessing timers.

## Recommended minimal fix after device JSON

1. Ask for **Copy splash JSON** from the affected iPhone PWA.
2. Compare `serviceWorkerCacheVersion` to the current build and confirm whether stale assets are active.
3. If stale, ship/activate cache cleanup only; do not change animation timing.
4. If assets are current and computed animation is already final at `animationClassAddedAt`, fix only the splash CSS cascade/initial state.
5. If assets are current and `fadeOutStartedAt` precedes `animationCompletedAt` or `minDurationPassedAt`, fix only `app-splash.js` hide gating.
