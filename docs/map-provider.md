# Map provider configuration

Klevby keeps the existing Yandex implementation as the default and fallback while the MapLibre/MapTiler foundation is tested.

## Enable MapLibre with MapTiler

Edit `assets/js/config.js` before deployment:

```js
MAP_PROVIDER: "maplibre",
MAPTILER_API_KEY: "YOUR_BROWSER_SAFE_MAPTILER_KEY",
MAPTILER_STYLE_URL: "https://api.maptiler.com/maps/streets-v2-dark/style.json",
```

Use a browser/public MapTiler key with the appropriate allowed-origin restrictions. Do not put a private server credential in this client-side config.

For a temporary diagnostic session, the same values can be assigned before opening Map without editing provider logic:

```js
window.KLEVB_MAP_PROVIDER = "maplibre";
window.KLEVB_MAPTILER_KEY = "YOUR_BROWSER_SAFE_MAPTILER_KEY";
// Optional custom MapTiler style URL:
window.KLEVB_MAPTILER_STYLE_URL = "https://api.maptiler.com/maps/streets-v2-dark/style.json";
```

The window overrides are read when Map is opened. Set them from an earlier script or the browser console before navigating to Map.

## Loading and fallback behavior

- App startup loads only Klevby's local map logic; it does not request MapLibre JS/CSS, a MapTiler style, MapTiler tiles, or Yandex Maps.
- Opening Map resolves the provider configuration.
- `MAP_PROVIDER: "maplibre"` with a non-empty key lazily requests the pinned MapLibre GL JS script and stylesheet, then the configured MapTiler style and its resources.
- If the MapTiler key is empty, MapLibre assets are not requested and the existing Yandex provider is loaded lazily instead.
- If MapLibre or the MapTiler style fails during initialization, the partial map is removed and Klevby attempts the existing Yandex path.
- If the fallback also fails, the existing in-map retry state is shown inside the stable `#map` element.

## Current foundation scope

- Existing fishing spots with valid numeric `lat` and `lng` render as simple MapLibre markers and continue to use the existing filters and popup actions.
- A MapLibre map tap converts `[lng, lat]` at the provider boundary to the app's existing `[lat, lng]` modal/save flow.
- Trip/post markers remain on the Yandex path because their current implementation depends on Yandex geocoding. Porting that geocoding is deferred.
- The fixed Map app-screen shell, header navigation, hidden TouchBar, document scroll lock, hint, action bar, filter sheet, and stable container identities are unchanged.
