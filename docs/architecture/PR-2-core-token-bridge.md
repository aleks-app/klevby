# PR-2 — Core Token Bridge

## Goal

Add new `--kg-*` shell tokens as safe aliases for the existing `--klevby-app-*` viewport tokens.

## Scope

This PR only adds a bridge. It does not migrate feature CSS to the new tokens.

## Runtime owner

Current runtime owner remains:

- `assets/js/app/app-shell-viewport-owner.js`

## Legacy tokens

- `--klevby-app-viewport-width`
- `--klevby-app-viewport-height`
- `--klevby-app-available-top`
- `--klevby-app-available-bottom`
- `--klevby-app-available-height`
- `--klevby-app-available-bottom-offset`
- `--klevby-app-inline-inset`

## New bridge tokens

- `--kg-viewport-width`
- `--kg-viewport-height`
- `--kg-shell-top`
- `--kg-shell-bottom`
- `--kg-shell-height`
- `--kg-shell-bottom-offset`
- `--kg-screen-inline`
- `--kg-safe-top`
- `--kg-safe-bottom`

## Hard rule

Feature modules must not consume `--kg-*` yet.

That migration starts only after the Screen Contract PR.

## Verification

The browser console smoke-check must show matching values for every old/new runtime pair.
