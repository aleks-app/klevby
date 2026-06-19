# Supabase Inventory

PR-1 only documents current Supabase usage. No data code is changed.

## Target rule

Feature UI must not call Supabase directly.

Target flow:

```text
UI module -> module state -> repository -> Supabase client provider -> Supabase
```

Repository return contract for future PRs:

```text
{
  ok: boolean,
  data: array | object | null,
  error: null | normalizedError,
  source: "supabase" | "cache" | "empty" | "offline",
  stale: boolean
}
```

## Search patterns used for inventory

```text
.supabase
createClient
.from(
.channel(
.auth.
.storage.
.rpc(
```

## Current high-risk Supabase/direct-data files by match count

| Matches | File | Future repository / owner | Risk |
|---:|---|---|---|
| 105 | `assets/js/profile/profile-core.js` | `profile.repository.js` + auth service | High: profile/auth data mixed with UI/runtime ownership |
| 93 | `assets/js/feed/supabase/supabase-posts.js` | `feed.repository.js` | Medium: already isolated under feed, but not global repository contract |
| 78 | `assets/js/app.js` | core bootstrap + repositories | High: global app file should not own data access |
| 69 | `assets/js/chat-private.js` | `chat.repository.js` + realtime owner | High: private chat + realtime/data flow |
| 53 | `assets/js/auth.js` | auth service | High: auth must stay stable during migration |
| 45 | `assets/js/market-logic.js` | `market.repository.js` | High: market UI/data are mixed |
| 42 | `assets/js/posts/posts-api.js` | `feed.repository.js` or `posts.repository.js` | Medium: post data access |
| 42 | `assets/js/chat-message-actions.js` | `chat.repository.js` | High: message mutations |
| 38 | `assets/js/profile.js` | `profile.repository.js` | High: legacy/global profile touchpoints |
| 37 | `assets/js/feed/feed-actions.js` | `feed.repository.js` | Medium: feed mutations/actions |
| 34 | `assets/js/feed/feed-api.js` | `feed.repository.js` | Medium: feed API wrapper exists but not final repository |
| 33 | `assets/js/chat.js` | `chat.repository.js` | High: chat shell/runtime mixed with data |
| 33 | `assets/js/chat-public.js` | `chat.repository.js` | High: public chat data/realtime |
| 30 | `assets/js/auth-profile.js` | auth/profile services | High: auth/profile bridge |
| 29 | `assets/js/ponds.js` | `ponds.repository.js` | Medium: ponds/water-body data |
| 29 | `assets/js/feed/actions/actions-core.js` | `feed.repository.js` | Medium: feed actions and global compatibility |
| 28 | `assets/js/chat-lifecycle.js` | chat module + realtime owner | High: lifecycle may subscribe/unsubscribe |
| 27 | `assets/js/feed/supabase/supabase-core.js` | `feed.repository.js` + Supabase provider | Medium: feed-local Supabase core |
| 22 | `assets/js/profile/profile-avatar.js` | `profile.repository.js` + storage service | Medium: avatar/storage flow |
| 22 | `assets/js/call.js` | call/realtime owner | Medium: call lifecycle/realtime |
| 21 | `assets/js/chat-push.js` | chat notifications service | Medium: push + chat state |
| 20 | `assets/js/feed/modals/comments-actions.js` | `feed.repository.js` | Medium: comment mutations |
| 15 | `assets/js/map-logic.js` | `map.repository.js` / `ponds.repository.js` | Medium: map data mixed into map runtime |
| 15 | `assets/js/feed/supabase/supabase-comments.js` | `feed.repository.js` | Medium: comments data |
| 15 | `assets/js/chat-user.js` | `chat.repository.js` / profile repository | Medium: chat user lookup |
| 13 | `assets/js/market/market-upload.js` | `market.repository.js` + storage service | High: uploads/storage |
| 13 | `assets/js/chat-realtime.js` | realtime owner | High: direct realtime |
| 12 | `assets/js/supabase/water-depth-sources.js` | `map.repository.js` | Medium: depth source access |
| 12 | `assets/js/profile/profile-photos.js` | `profile.repository.js` + storage service | Medium: photo/storage flow |
| 11 | `assets/js/feed/supabase/supabase-rest.js` | `feed.repository.js` | Medium |
| 11 | `assets/js/feed/supabase/supabase-likes.js` | `feed.repository.js` | Medium |
| 11 | `assets/js/feed/supabase/supabase-auth.js` | auth service / feed repository | Medium |
| 10 | `assets/js/supabase/supabase-core.js` | Supabase client provider | High: final single client source |
| 9 | `assets/js/feed/supabase/supabase-counts.js` | `feed.repository.js` | Medium |
| 9 | `assets/js/feed/feed-utils.js` | feed module | Low/Medium: compatibility data references |
| 8 | `assets/js/chat-private/chat-private-utils.js` | chat repository | Medium |
| 8 | `assets/js/chat-private/chat-private-messages.js` | chat repository | Medium |
| 7 | `assets/js/supabase/supabase-compat-globals.js` | temporary compatibility bridge | High: keep stable until migration ends |
| 7 | `assets/js/feed/supabase/supabase-main.js` | feed repository | Medium |
| 6 | `assets/js/feed/modals/photo-viewer.js` | feed/profile storage | Low/Medium |
| 6 | `assets/js/feed-supabase.js` | feed repository | Medium |
| 6 | `assets/js/call-realtime.js` | realtime owner | High |
| 5 | `assets/js/supabase/supabase-realtime-manager.js` | realtime owner | High: future single owner |
| 5 | `assets/js/feed/feed-render.js` | feed module | Low/Medium: render should not fetch |
| 4 | `assets/js/supabase/supabase-auth-service.js` | auth service | Medium |
| 4 | `assets/js/profile/public/profile-public-api.js` | profile repository | Medium |
| 4 | `assets/js/feed/supabase/supabase-normalize.js` | feed repository | Low |
| 4 | `assets/js/feed/render/feed-render-cards.js` | feed render | Low: render should remain data-free |
| 4 | `assets/js/feed/feed-events.js` | feed module | Medium |
| 4 | `assets/js/config.js` | core config | Medium |
| 4 | `assets/js/app/app-resume-manager.js` | core resume/auth refresh | Medium |

## Repository grouping target

| Future repository | Current source files |
|---|---|
| `feed.repository.js` | `assets/js/feed/supabase/*`, `assets/js/feed/feed-api.js`, feed actions/comment actions |
| `chat.repository.js` | `chat.js`, `chat-private.js`, `chat-public.js`, `chat-message-actions.js`, `chat-private/*` |
| `market.repository.js` | `market-logic.js`, `market/market-upload.js`, `market/*` |
| `profile.repository.js` | `profile.js`, `profile/profile-core.js`, `profile/profile-avatar.js`, `profile/profile-photos.js`, `profile/public/*` |
| `ponds.repository.js` | `ponds.js`, relevant map water-body reads |
| `map.repository.js` | `map-logic.js`, `supabase/water-depth-sources.js`, depth map source data |
| `auth.repository.js` / auth service | `auth.js`, `auth-profile.js`, `supabase-auth-service.js`, feed auth bridge |
| `realtime owner` | `supabase-realtime-manager.js`, `chat-realtime.js`, `call-realtime.js`, feed realtime |

## Migration safety rules

1. No direct `.from(...)` in UI modules after migration.
2. No direct `.channel(...)` outside the realtime owner after migration.
3. No feature creates its own Supabase client.
4. Every repository returns empty/fallback state instead of throwing into UI.
5. Every data PR must document empty/loading/error behavior.
6. Any database schema/RLS change must ship separately from UI migration unless explicitly approved.
