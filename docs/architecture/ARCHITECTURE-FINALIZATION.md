# KlevGo Architecture Finalization

## Final status after PR-12

KlevGo now has a staged AppShell architecture foundation without a big-bang rewrite.

The runtime foundation is:

1. Core Viewport Kernel measures the Shell.
2. CSS tokens expose stable `--kg-*` frame values.
3. `.kg-screen` consumes the measured Header/TouchBar frame.
4. Home uses the shared screen contract and Grid layout.
5. Legacy Home lower-fill solver is retired by default, with emergency safety diagnostics retained.

## What is stable now

- `assets/js/app/app-shell-viewport-owner.js` is the official Viewport Kernel runtime entrypoint.
- `assets/js/core/viewport/viewport-kernel.js` is the adapter target for future physical migration.
- `assets/css/core/screen-contract.css` is the shared screen frame contract.
- `assets/css/modules/home/home-grid-foundation.css` is the Home Grid foundation.
- Header and TouchBar are integrated through measured Kernel tokens, not per-device rules.

## What must not happen next

Do not start a large cleanup PR.

Forbidden next actions:

- deleting `app-home-screen-owner.js` immediately;
- moving runtime scripts and changing `index.html` order;
- replacing Supabase calls while touching Home layout;
- removing emergency `safety-fill` before phone validation;
- adding device-specific media queries.

## Recommended next workstream

After PR-12 merge and phone checks, the next architecture track should be data stability:

1. Supabase Client Provider.
2. Repository result envelope.
3. Feed repository migration.
4. Chat/Trips/Market/Profile repository migrations one module at a time.

## Phone validation gate

The architecture is considered stable only after:

- iPhone PWA Home check;
- Android APK Home check;
- TouchBar frame check;
- Header frame check;
- no visible Home jump after app resume/orientation change;
- no console 404s for new CSS/JS files.
