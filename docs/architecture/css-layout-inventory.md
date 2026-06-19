# CSS / Layout Inventory

PR-1 only documents layout risk. It does not change layout code.

## Target layout rule

Final target:

```text
AppShell measures shell geometry once -> CSS receives shell tokens -> screens lay out content with CSS Grid/Flex/variables
```

Forbidden in future content layout:

- JS measuring content cards.
- JS writing content fill tokens.
- Per-device media queries.
- Hardcoded formulas such as `height - 633px`.
- `setTimeout` layout fixes.
- permanent visual positioning through `transform`.

## Search patterns used for inventory

```text
getBoundingClientRect
visualViewport
innerHeight
innerWidth
--klevby-home-lower-fill-y
--klevby-app-
--klevby-home-
data-home-density
height: calc(
min-height
100vh
100dvh
position: fixed
position: absolute
transform:
```

## Highest layout-risk files by match count

| Matches | File | Current role | Risk |
|---:|---|---|---|
| 219 | `assets/css/screens/home-mobile.css` | Home mobile layout/density/rhythm | Very high: mixed visual + geometry + density + PWA rules |
| 60 | `assets/js/app/app-android-diagnostics.js` | Android diagnostics | Medium: diagnostics should stay read-only |
| 37 | `assets/css/screens/profile.css` | Profile layout | Medium: screen-specific layout |
| 36 | `assets/css/base/global.css` | Global base CSS | High: global rules affect every screen |
| 33 | `assets/js/app/app-shell-viewport-owner.js` | AppShell viewport owner | High but expected: this should become the single viewport kernel |
| 31 | `assets/js/market/market-styles.js` | Injected market styles | High: JS-injected CSS can bypass layout contract |
| 30 | `assets/css/responsive/mobile.css` | Mobile responsive rules | Medium/High: must avoid device-specific patches |
| 26 | `assets/css/screens/trips-fullscreen.css` | Trips fullscreen layout | Medium: newer full-screen screen contract |
| 26 | `assets/css/mobile/mobile-tabbar.css` | TouchBar layout | High: global shell boundary |
| 25 | `assets/js/app/app-viewport-debug.js` | Viewport diagnostics | Medium: should remain read-only diagnostics |
| 25 | `assets/js/app/app-home-screen-owner.js` | Home screen owner/solver | Very high: content geometry owner to retire later |
| 25 | `assets/css/chat/chat-mobile.css` | Chat mobile layout | Medium |
| 23 | `assets/css/screens/auth-welcome.css` | Auth/welcome fullscreen layout | Medium |
| 20 | `assets/css/layout/header.css` | Header shell boundary | High: global shell boundary |
| 19 | `assets/js/feed/render/feed-render-styles.js` | Feed injected styles | Medium/High: JS-injected layout styles |
| 17 | `assets/js/map-logic.js` | Map runtime/layout interactions | Medium |
| 17 | `assets/css/screens/home.css` | Home base screen CSS | Medium/High |
| 16 | `assets/css/components/buttons-forms.css` | Shared component styles | Medium |
| 15 | `assets/css/components/modals-install.css` | Install modals | Medium |
| 13 | `assets/css/ponds.css` | Ponds layout | Low/Medium |
| 12 | `assets/js/call-styles.js` | Injected call styles | Medium/High |
| 12 | `assets/css/screens/water-body-detail.css` | Water body detail layout | Medium |
| 11 | `assets/js/feed/modals/modal-styles.js` | Injected modal styles | Medium/High |
| 10 | `assets/css/screens/profile-public.css` | Public profile layout | Medium |
| 10 | `assets/css/screens/map-water-depth.css` | Depth map UI | Medium |
| 8 | `assets/js/chat-viewport.js` | Chat viewport handling | High: may duplicate shell responsibility |
| 8 | `assets/css/mobile/mobile-float-button.css` | Floating button layout | Medium |

## Shell geometry files

These files are allowed to know about viewport/shell size in the target architecture, but ownership must be centralized:

- `assets/js/app/app-shell-viewport-owner.js`
- `assets/js/app/app-viewport-debug.js` as read-only diagnostics
- `assets/js/app/app-surface-gate.js`
- `assets/css/layout/header.css`
- `assets/css/mobile/mobile-tabbar.css`
- `assets/css/layout/bottom-nav.css`
- future `assets/js/core/viewport/viewport-kernel.js`
- future `assets/css/core/app-shell.css`

## Content geometry files

These should eventually stop measuring or solving layout in JS:

- `assets/js/app/app-home-screen-owner.js`
- `assets/js/chat-viewport.js`
- `assets/js/map-logic.js` where it affects screen geometry
- any JS-injected CSS files that create layout rules:
  - `assets/js/market/market-styles.js`
  - `assets/js/feed/render/feed-render-styles.js`
  - `assets/js/call-styles.js`
  - `assets/js/feed/modals/modal-styles.js`

## Home-specific risk

Home currently works but is fragile because layout stability depends on the Home screen owner and lower rhythm solver.

Do not remove these in PR-1:

- `data-home-density`
- `--klevby-home-lower-fill-y`
- Home rhythm diagnostics
- Home solver execution path

Future retirement order:

1. Add shell token bridge.
2. Add shared screen contract.
3. Move Home internal layout to CSS Grid/Flex.
4. Run old solver in diagnostics/read-only mode.
5. Remove content solver after phone tests pass.

## Final CSS contract target

Future screen CSS must follow:

```text
.kg-screen receives shell height.
.kg-screen__content lays out with CSS grid/flex.
Components use clamp(), minmax(), and shared spacing tokens.
Density comes from container/screen available size, not device names.
```

No device-model media queries are allowed.
