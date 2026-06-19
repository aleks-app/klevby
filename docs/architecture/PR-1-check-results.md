# PR-1 Check Results

This report was produced while preparing the PR-1 structural inventory patch.

## Runtime diff guard

Compared the modified workspace against a clean extraction of the original archive.

Allowed differences only:

```text
assets/js/core/**
assets/js/modules/**
assets/js/legacy/**
assets/css/core/**
assets/css/modules/**
assets/css/legacy/**
docs/architecture/**
```

No changes were made to:

```text
index.html
existing assets/js runtime files
existing assets/css runtime files
package.json
package-lock.json
android runtime project files
```

## Dependency install

Command:

```bash
npm install
```

Result: failed in this execution environment.

Reason:

```text
sharp tried to download libvips from github.com and failed with getaddrinfo EAI_AGAIN github.com
```

Workaround used for local verification only:

```bash
npm install --ignore-scripts
```

Result: passed. This installed local tooling without running native package postinstall scripts. `node_modules` was removed afterward and is not part of the PR.

## Build / Android asset checks

Command:

```bash
npm run build:web
```

Result: passed.

Output summary:

```text
MapLibre 5.24.0 asset ready
www synced successfully
```

Command before Android sync:

```bash
npm run validate:android-assets
```

Result: failed as expected before Android sync.

Reason:

```text
Missing required generated asset: android/app/src/main/assets/public/index.html
Run "npm run prepare:android" before building the APK.
```

Command:

```bash
npm run prepare:android
```

Result: passed.

Output summary:

```text
Copying web assets from www to android/app/src/main/assets/public
Creating capacitor.config.json in android/app/src/main/assets
Sync finished
Capacitor web assets are current: root == www == Android public.
```

Command after Android sync:

```bash
npm run validate:android-assets
```

Result: passed.

Generated `www`, Android public assets, `node_modules`, and Playwright result folders were removed afterward so the PR remains inventory-only.

## E2E / test results

Command:

```bash
npm run test:e2e
```

Result: partially passed, then failed because Playwright browser binaries are missing in this environment.

What passed:

```text
Node/unit-style subtests executed and passed through subtest 135.
```

What failed:

```text
7 Playwright browser specs failed before execution because Chromium headless shell was not installed:
Executable doesn't exist at /home/oai/.cache/ms-playwright/chromium_headless_shell-1223/...
```

Attempted browser installation:

```bash
npx playwright install chromium --with-deps
```

Result: failed due environment/network package-manager timeout while trying to reach Debian package mirrors.

Conclusion:

```text
The E2E failure is environmental, not caused by PR-1 runtime changes. PR-1 does not modify runtime files.
```

## Static local asset check

Checked all local `src`/`href` references in `index.html`.

Result:

```text
index local refs: 153
missing local refs: 0
```

This confirms PR-1 did not create missing JS/CSS/image path references.

## Browser console smoke attempt

Attempted headless Chromium smoke via local HTTP and `file://`.

Result: blocked by container/browser policy before the app loaded.

Observed error:

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR
```

Conclusion:

```text
A real browser console smoke-check must be run on the developer machine or preview environment. In this environment the browser was blocked before the app runtime could load.
```

## PR-1 safety conclusion

PR-1 remains safe because only architecture documentation and empty future folders were added. No runtime code, CSS, HTML, build config, package files, or Android project files are changed.
