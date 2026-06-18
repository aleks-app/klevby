# KlevGo Design System v1 Foundation

Design tokens live in `assets/css/base/klevgo-design-tokens.css` and are imported near the top of `assets/css/main.css`, immediately after `base/global.css`.

## How to add shared values

- Add new shared colors to the relevant color group in `klevgo-design-tokens.css`.
- Add new radii to the radius group only when an existing token cannot describe the intended shape.
- Prefer semantic component tokens, such as button/card/filter tokens, when a component needs a stable API over raw color or radius values.
- Keep screen-specific positioning, dimensions, and one-off spacing inside the screen CSS.

## Usage rules

- New screens and new components should use design tokens for shared colors, radii, and reusable states instead of hardcoded values.
- Screen CSS remains responsible for layout and screen-specific spacing; shared colors, radii, surfaces, borders, and component states should come from tokens.
- Do not change the global font family without a separate PR.
- Do not introduce or connect a new font from this foundation layer.
- Figma values should first be added or updated in `klevgo-design-tokens.css`, then applied in component or screen CSS through token references.

## Migration rule

Existing screens are not automatically migrated by Design System v1. Migrate hardcoded values only in small, intentional follow-up changes when the visual result can be verified.
