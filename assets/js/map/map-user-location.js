(function initKlevbyMapUserLocation(global) {
  const SOURCE_ID = "klevby-user-location-accuracy";
  const FILL_LAYER_ID = "klevby-user-location-accuracy-fill";
  const LINE_LAYER_ID = "klevby-user-location-accuracy-line";
  const GEOLOCATION_DENIED_MESSAGE = "Разрешите доступ к геолокации, чтобы видеть себя на карте";
  const GEOLOCATION_UNAVAILABLE_MESSAGE = "Не удалось определить местоположение. Проверьте настройки геолокации.";
  const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000
  };

  function createAccuracyFeature(longitude, latitude, accuracy) {
    const points = 64;
    const radius = Math.max(0, Number(accuracy) || 0);
    const latitudeRadians = latitude * Math.PI / 180;
    const latitudeDegrees = radius / 111320;
    const longitudeDegrees = radius / Math.max(111320 * Math.cos(latitudeRadians), 1);
    const coordinates = [];

    for (let index = 0; index <= points; index += 1) {
      const angle = index / points * Math.PI * 2;
      coordinates.push([
        longitude + Math.cos(angle) * longitudeDegrees,
        latitude + Math.sin(angle) * latitudeDegrees
      ]);
    }

    return {
      type: "Feature",
      properties: { accuracy: radius },
      geometry: { type: "Polygon", coordinates: [coordinates] }
    };
  }

  function createMarkerElement(documentRef) {
    const marker = documentRef.createElement("div");
    marker.className = "klevby-user-location-marker";
    marker.setAttribute("aria-label", "Ваше текущее местоположение");
    marker.innerHTML = `
      <span class="klevby-user-location-heading" aria-hidden="true"></span>
      <span class="klevby-user-location-dot" aria-hidden="true"></span>
    `;
    return marker;
  }

  function createController(options) {
    const map = options.map;
    const button = options.button;
    const geolocation = options.geolocation || global.navigator?.geolocation;
    const documentRef = options.document || global.document;
    const MarkerClass = options.MarkerClass || global.maplibregl?.Marker;
    const notify = options.notify || function () {};
    let marker = null;
    let markerElement = null;
    let lastPosition = null;
    let watchId = null;
    let followMode = false;
    let requestPending = false;
    let programmaticMove = false;

    function syncButton() {
      button.classList.remove("is-unavailable");
      button.classList.toggle("is-active", followMode);
      button.classList.toggle("is-loading", requestPending);
      button.setAttribute("aria-pressed", String(followMode));
      button.setAttribute("aria-label", followMode
        ? "Моё место, слежение включено"
        : "Моё место");
    }

    function ensureAccuracyLayer() {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] }
        });
      }
      if (!map.getLayer(FILL_LAYER_ID)) {
        map.addLayer({
          id: FILL_LAYER_ID,
          type: "fill",
          source: SOURCE_ID,
          paint: {
            "fill-color": "#1687ff",
            "fill-opacity": 0.14
          }
        });
      }
      if (!map.getLayer(LINE_LAYER_ID)) {
        map.addLayer({
          id: LINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": "#65b5ff",
            "line-width": 1.5,
            "line-opacity": 0.78
          }
        });
      }
      map.moveLayer(FILL_LAYER_ID);
      map.moveLayer(LINE_LAYER_ID);
    }

    function renderPosition(position) {
      const longitude = Number(position?.coords?.longitude);
      const latitude = Number(position?.coords?.latitude);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;

      const isFirstFix = !marker;
      lastPosition = position;
      ensureAccuracyLayer();
      map.getSource(SOURCE_ID)?.setData(createAccuracyFeature(
        longitude,
        latitude,
        position.coords.accuracy
      ));

      if (!marker && MarkerClass) {
        markerElement = createMarkerElement(documentRef);
        marker = new MarkerClass({ element: markerElement, anchor: "center" })
          .setLngLat([longitude, latitude])
          .addTo(map);
      } else {
        marker?.setLngLat([longitude, latitude]);
      }

      const heading = Number(position.coords.heading);
      const hasHeading = Number.isFinite(heading) && heading >= 0;
      markerElement?.classList.toggle("has-heading", hasHeading);
      if (hasHeading) {
        markerElement?.style.setProperty("--klevby-user-heading", `${heading}deg`);
      }

      if (requestPending) {
        requestPending = false;
        syncButton();
      }

      if (isFirstFix) {
        programmaticMove = true;
        map.flyTo({
          center: [longitude, latitude],
          zoom: Math.max(Number(map.getZoom?.()) || 0, 15),
          essential: true
        });
      } else if (followMode) {
        programmaticMove = true;
        map.easeTo({ center: [longitude, latitude], duration: 700 });
      }
    }

    function handleError(error) {
      if (error?.code === 1) {
        notify(GEOLOCATION_DENIED_MESSAGE);
      } else {
        notify(GEOLOCATION_UNAVAILABLE_MESSAGE);
      }
      stopFollowing();
    }

    function clearLocationVisuals() {
      marker?.remove();
      marker = null;
      markerElement = null;

      const source = map.getSource?.(SOURCE_ID);
      if (source && typeof source.setData === "function") {
        source.setData({ type: "FeatureCollection", features: [] });
      }
    }

    function stopFollowing() {
      if (watchId !== null && geolocation?.clearWatch) {
        geolocation.clearWatch(watchId);
      }
      watchId = null;
      followMode = false;
      requestPending = false;
      lastPosition = null;
      clearLocationVisuals();
      syncButton();
    }

    function startFollowing() {
      if (!geolocation?.watchPosition) {
        notify(GEOLOCATION_UNAVAILABLE_MESSAGE);
        return;
      }
      followMode = true;
      requestPending = true;
      syncButton();
      watchId = geolocation.watchPosition(renderPosition, handleError, GEOLOCATION_OPTIONS);
    }

    function handleClick() {
      if (followMode || requestPending) {
        stopFollowing();
      } else {
        startFollowing();
      }
    }

    function handleMoveStart(event) {
      if (!followMode) return;
      if (programmaticMove || !event?.originalEvent) {
        programmaticMove = false;
        return;
      }
      stopFollowing();
    }

    button.addEventListener("click", handleClick);
    map.on("movestart", handleMoveStart);
    map.on("styledata", function () {
      if (lastPosition) renderPosition(lastPosition);
    });
    syncButton();

    return {
      destroy: function () {
        stopFollowing();
        button.removeEventListener("click", handleClick);
        map.off?.("movestart", handleMoveStart);
        if (map.getLayer?.(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer?.(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource?.(SOURCE_ID)) map.removeSource(SOURCE_ID);
      },
      isFollowing: function () {
        return followMode;
      }
    };
  }

  global.KlevbyMapUserLocation = {
    SOURCE_ID,
    FILL_LAYER_ID,
    LINE_LAYER_ID,
    GEOLOCATION_DENIED_MESSAGE,
    createAccuracyFeature,
    createController
  };
})(typeof window !== "undefined" ? window : globalThis);
