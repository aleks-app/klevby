# Home feed/ad rotator diagnostics

Date: 2026-06-14

Scope: diagnostics only. This report does not change Home markup, styling, sizing,
animation, navigation, weather, TouchBar, viewport/density behavior, or any
production JavaScript.

## 1. Owner

- **Markup:** `index.html`, inside `#homeSection`, in
  `#homeFeedPreviewRotator > .home-feed-preview-rotator-viewport`. The two base
  slides are `.home-feed-preview-slide--feed` and
  `.home-feed-preview-slide--ad`.
- **Timer and active-state owner:**
  `assets/js/app/app-home-feed-preview-rotator.js`,
  `initHomeFeedPreviewRotator()`.
- **CSS and box-model owner:** `assets/css/screens/home-mobile.css`, primarily
  `.home-feed-preview-card`, `.home-feed-preview-rotator[-viewport]`,
  `.home-feed-preview-slide--feed`, `.home-feed-preview-slide--ad`, and
  `.home-feed-ad-*`.
- **Indirect layout owner:** `assets/js/app/app-home-screen-owner.js`. Its Home
  fit/bottom-rhythm solver selects `data-home-density`, writes
  `--klevby-home-lower-fill-y`, and measures the currently active feed/ad slide.
  It does not choose rotator slides, but its sizing token changes the shared
  minimum height.

## 2. Current behavior

`initHomeFeedPreviewRotator()`:

1. Finds the rotator and its two slides.
2. Stops initialization entirely for `prefers-reduced-motion: reduce`; in that
   case the ad remains hidden by the non-ready CSS and the feed remains visible.
3. Starts with slide index `0` (feed).
4. On the next animation frame, measures the feed slide and writes its rounded-up
   height as an inline `min-height` on the viewport.
5. If Home is visible and the document is not hidden, waits 4,500 ms and toggles
   the active index between `0` and `1`.
6. If Home or the document is hidden, polls every 1,000 ms instead of rotating.
7. Re-measures the feed height on resize, Home density changes, and visibility
   restoration.

Switching itself is only a synchronous `.is-active` class toggle. CSS performs a
650 ms cross-fade plus a 5 px vertical translation.

## 3. Measurements

### Method and limitation

The intended Playwright measurement could not run in this environment because no
browser executable is installed and the Playwright Chromium download endpoint
returned HTTP 403. The values below are therefore exact **box-model-derived
measurements** from the active DOM/CSS, not captured real-device telemetry.

Global `box-sizing: border-box` applies to both cards. At a 390 px viewport:

- `.home-feed-preview` width = `390 - 16 = 374 px`.
- Rotator width = `374 px`.
- Viewport width = `374 px`.
- Feed slide border-box width = `374 px`.
- Ad slide border-box width = `374 px`.

The feed slide remains in normal flow and determines the viewport's used height.
Its minimum/natural height is:

`top row 36 + card gap 8 + image/content 130/112/108 + vertical padding 28/24/22 + borders 2`

| Home density | Shared CSS minimum | Feed used height at zero lower fill | Ad used height | Viewport used height |
| --- | ---: | ---: | ---: | ---: |
| standard | 148 px | 204 px | 204 px | 204 px |
| compact | 132 px | 182 px | 182 px | 182 px |
| tight | 128 px | 176 px | 176 px | 176 px |

If the Home bottom-rhythm solver adds `F = --klevby-home-lower-fill-y`, the image
minimum and card minimum both receive `F`. The content/image constraint remains
the larger constraint, so the corresponding heights become `204 + F`,
`182 + F`, and `176 + F`. The rotator then copies the current feed height into
the viewport's inline `min-height`.

### Exact feed/ad differences

The **outer used border boxes are equal** after rotator initialization:

- **Width:** equal, 100% of the 374 px slot at a 390 px viewport.
- **Height:** equal in the final used layout because the ad is
  `position: absolute; inset: 0; height: 100%` and fills the feed-sized viewport.
- **Border:** both have a 1 px border; only border color differs.
- **Margin:** both are 0.
- **Border radius:** both inherit the base 18 px radius.

Their own sizing models are not intrinsically equal:

- **Feed padding:** 14 px standard, 12 px compact, 11 px tight.
- **Ad outer padding:** 0.
- **Ad content padding:** 14 px 16 px standard, 12 px 14 px compact, and
  11 px 13 px tight.
- **Feed minimum height:** the shared card token.
- **Ad intrinsic minimum height:** no independent card-level minimum in the
  current overlay rules; its outer height comes from `height: 100%` against the
  viewport.
- **Feed image area:** a right grid column, 118 px standard, 110 px compact,
  106 px tight, with minimum heights 130/112/108 px plus lower fill.
- **Ad image area:** an absolutely positioned full-card background with
  `background-size: cover`; it has no intrinsic layout contribution.
- **Feed position:** relative and in normal flow.
- **Ad position:** absolute overlay with `inset: 0`.
- **Inactive transform:** `translateY(5px)`.
- **Active transform:** `translateY(0)`.
- **Both transition:** opacity, visibility, and transform over 650 ms.

### Height stability

Under the current two-slide markup, the viewport height remains stable during a
normal switch because:

1. the feed never leaves normal flow, even when inactive;
2. `visibility: hidden` and `opacity: 0` do not remove it from layout;
3. the ad is an absolute overlay and therefore cannot change viewport height;
4. JavaScript pins the viewport's minimum height to the measured feed height.

This is stability by workaround, not intrinsic slide equivalence. The viewport
does not measure the ad, does not use the maximum of all slide heights, and does
not update from a `ResizeObserver` when feed content or assets change without a
window resize or density mutation.

## 4. Jump cause

The main visible “jump” is the transition design itself:

- The outgoing active slide moves from `translateY(0)` toward
  `translateY(5px)` while fading.
- The incoming slide starts at `translateY(5px)` and moves to
  `translateY(0)` while fading.
- Both cards are visible for part of the 650 ms cross-fade, but their very
  different internal compositions and edge/background contrast are displaced
  vertically at the same time. This reads as the whole card/slot shifting rather
  than as a clean content change.

The effect is amplified by asymmetric ownership: the feed is the permanent
in-flow sizing element while the ad is stretched over it. The outer rectangles
match, but the ad is not an independently equal-height sibling. Subpixel text
and background-cover rendering during transform interpolation can add apparent
movement, especially on real device pixel ratios.

There is no evidence that the normal timer toggle changes the viewport's layout
height. The likely issue is transformed cross-fade perception, not a true
collapse/reflow on every switch.

## 5. Risks

The implementation is functional but already relies on layout workarounds:

- only the feed owns normal-flow height;
- JavaScript copies the feed height into viewport `min-height`;
- only the ad is absolutely positioned and stretched to the viewport;
- the Home rhythm solver measures whichever slide is active, coupling the
  rotator to wider first-screen fitting;
- future ad content that needs more height will be clipped or compressed rather
  than expanding the slot;
- future asynchronous feed size changes are not observed directly;
- `prefers-reduced-motion` disables the rotator rather than preserving rotation
  with a non-animated state change.

Changing slide positioning, viewport overflow, or height ownership can therefore
affect weather/TouchBar spacing and the entire fixed-fit Home first screen.

## 6. Recommended safe plan

Use two separate phases and validate each on real devices.

### Immutable outer-slot constraint

The current outer Home feed/ad slot is accepted product geometry and is the
source of truth. “Normalize sizing” must not mean shrinking, reducing, or
visually resizing this block. The outer slot/card rectangle must retain:

- the same width;
- the same height behavior;
- the same border radius;
- the same position on Home;
- the same spacing relative to weather, nearby blocks, and TouchBar;
- the same Home first-screen rhythm.

The required model is a stable outer shell that does not move, shrink, or resize
during rotation. Feed/ad content is inner content that may be fitted, clipped,
faded, masked, or animated only inside that existing shell.

If an implementation changes the outer rectangle, Home first-screen geometry,
weather position, or TouchBar gap, stop the implementation and report the
regression instead of proceeding.

### Phase A: normalize internal sizing behavior without changing the slot

Here, “normalize sizing” means normalizing only how feed and ad content behave
inside the accepted slot. It does not authorize changing the slot itself.

1. Record the current outer slot rectangle and first-screen gaps as immutable
   baselines for each Home density.
2. Prove that feed and ad render inside that existing rectangle without changing
   its width, height behavior, border radius, position, or surrounding spacing.
3. Fit or clip inner feed/ad content as necessary inside the shell; do not derive
   a new outer size from either card and do not resize the shell to the maximum
   content height.
4. Keep one stable in-flow sizing wrapper. Do not make both real base slides
   absolute.
5. If runtime content observation is needed, use it only to validate or fit inner
   content. It must not write a new outer slot height during rotation.
6. Add a diagnostic test that records feed, ad, viewport, weather-gap, and
   TouchBar-gap geometry at standard, compact, and tight densities and asserts
   that the accepted outer geometry is unchanged.
7. Verify Phase A on the same real devices that exposed the mosaic regression
   before adding any animation.

### Phase B: add the least risky animation

1. Make the first visual code PR as narrow as possible: retain the current slot
   size and feed/ad timing, remove only the active/inactive `translateY`
   movement, and use opacity/visibility switching.
2. Do not change card sizes, slot height, layout, density, weather, TouchBar, or
   viewport behavior in that PR.
3. Keep the stable shell and accepted dimensions unchanged throughout the fade.
4. Animate only compositor-friendly opacity on the two bounded visual layers;
   do not animate height, min-height, margin, padding, grid tracks, or viewport
   position.
5. Preserve a no-motion path that can still switch instantly, if product behavior
   requires rotation under reduced motion.
6. Pause/avoid state changes while Home is not visible and guard against
   overlapping transitions.
7. Verify on real devices that the perceived jump is removed and re-run
   first-screen geometry assertions before, during, and after each switch.

If a more elaborate effect is later required, use at most one local,
pointer-events-none visual snapshot layer clipped inside the already stable
rotator viewport. It must never participate in layout, clone interactive DOM,
duplicate IDs, or become a global overlay. This should only be considered after
the opacity-only version is proven stable.

## 7. What not to do

- Do not repeat the mosaic implementation that cloned each slide into a
  12-by-11 grid (132 DOM fragments) per transition.
- Do not clone interactive Home markup or duplicate IDs/handlers.
- Do not make both real base slides `position: absolute`.
- Do not add a page/global overlay.
- Do not shrink, enlarge, or otherwise redefine the accepted outer slot.
- Do not animate slot height, card size, padding, margin, grid columns, Home
  density tokens, viewport/app-screen values, weather, or TouchBar position.
- Do not let the active slide become the only source of Home first-screen
  geometry during a transition.
- Do not assume equal outer rectangles mean equal intrinsic card sizing.
- Do not add a complex effect before real-device standard/compact/tight geometry
  checks pass.

## 8. Should sizing be normalized first?

**Yes, but only internally.** A future preparatory PR may prove and enforce that
feed and ad content both stay inside the current accepted shell. It must not
change the shell's visual size or any Home geometry. The safest first visual PR
is then a separate, minimal change that keeps the current timing and slot,
removes only the 5 px vertical transforms, and uses opacity/visibility. A mosaic
or any more complex effect should not be considered until that opacity-only
change has passed real-device geometry checks.
