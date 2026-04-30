/* map-logic.js */
/* Простая логика карты Klevby: Supabase posts -> Yandex Map markers */

(function () {
  // 1. Сюда вставишь свои значения
  var SUPABASE_URL = 'PASTE_SUPABASE_URL_HERE';
  var SUPABASE_ANON_KEY = 'PASTE_SUPABASE_ANON_KEY_HERE';

  // 2. Сюда вставишь API-ключ Яндекс.Карт
  var YANDEX_MAPS_API_KEY = 'PASTE_YANDEX_MAPS_API_KEY_HERE';

  // Центр Беларуси / Минск
  var DEFAULT_CENTER = [53.9023, 27.5619];
  var DEFAULT_ZOOM = 7;

  var mapInstance = null;
  var mapStarted = false;

  document.addEventListener('DOMContentLoaded', function () {
    startMapLogic();
  });

  function startMapLogic() {
    if (mapStarted) return;
    mapStarted = true;

    var mapSection = document.getElementById('mapSection');
    var mapContainer = document.getElementById('map');

    if (!mapSection || !mapContainer) {
      console.warn('Klevby map: не найден #mapSection или #map');
      return;
    }

    if (!mapContainer.style.minHeight) {
      mapContainer.style.minHeight = '360px';
    }

    if (!window.supabase || !window.supabase.createClient) {
      console.error('Klevby map: библиотека Supabase не найдена. Проверь подключение Supabase в <head>.');
      return;
    }

    if (
      SUPABASE_URL === 'PASTE_SUPABASE_URL_HERE' ||
      SUPABASE_ANON_KEY === 'PASTE_SUPABASE_ANON_KEY_HERE'
    ) {
      console.error('Klevby map: вставь SUPABASE_URL и SUPABASE_ANON_KEY в map-logic.js');
      return;
    }

    if (YANDEX_MAPS_API_KEY === 'PASTE_YANDEX_MAPS_API_KEY_HERE') {
      console.error('Klevby map: вставь YANDEX_MAPS_API_KEY в map-logic.js');
      return;
    }

    var mapDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    loadYandexMaps()
      .then(function () {
        window.ymaps.ready(function () {
          initMap(mapDb, mapSection, mapContainer);
        });
      })
      .catch(function (error) {
        console.error('Klevby map: ошибка загрузки Яндекс.Карт', error);
      });
  }

  function loadYandexMaps() {
    return new Promise(function (resolve, reject) {
      if (window.ymaps && window.ymaps.ready) {
        resolve();
        return;
      }

      var oldScript = document.querySelector('script[data-klevby-yandex-maps="true"]');

      if (oldScript) {
        oldScript.addEventListener('load', resolve);
        oldScript.addEventListener('error', reject);
        return;
      }

      var script = document.createElement('script');
      script.src =
        'https://api-maps.yandex.ru/2.1/?apikey=' +
        encodeURIComponent(YANDEX_MAPS_API_KEY) +
        '&lang=ru_RU';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-klevby-yandex-maps', 'true');

      script.onload = resolve;
      script.onerror = reject;

      document.head.appendChild(script);
    });
  }

  async function initMap(mapDb, mapSection, mapContainer) {
    mapInstance = new window.ymaps.Map('map', {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      controls: ['zoomControl', 'fullscreenControl']
    });

    keepMapResponsive(mapInstance, mapSection, mapContainer);

    try {
      var posts = await loadPosts(mapDb);
      await addPostsToMap(posts, mapInstance);
    } catch (error) {
      console.error('Klevby map: ошибка загрузки объявлений на карту', error);
    }
  }

  async function loadPosts(mapDb) {
    var result = await mapDb
      .from('posts')
      .select('id, name, city, text, telegram');

    if (result.error) {
      throw result.error;
    }

    return Array.isArray(result.data) ? result.data : [];
  }

  async function addPostsToMap(posts, map) {
    var clusterer = new window.ymaps.Clusterer({
      preset: 'islands#greenClusterIcons',
      groupByCoordinates: false,
      clusterDisableClickZoom: false,
      clusterOpenBalloonOnClick: true
    });

    var geoObjects = [];
    var cityCache = {};

    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];

      if (!post || !post.city) continue;

      var city = String(post.city).trim();
      if (!city) continue;

      var cacheKey = city.toLowerCase();

      if (!cityCache[cacheKey]) {
        cityCache[cacheKey] = await geocodeCity(city);
      }

      var coords = cityCache[cacheKey];

      if (!coords) {
        console.warn('Klevby map: город не найден через геокодер:', city);
        continue;
      }

      var placemark = new window.ymaps.Placemark(
        coords,
        {
          balloonContentHeader: makeHeader(post),
          balloonContentBody: makeBody(post),
          hintContent: makeHint(post)
        },
        {
          preset: 'islands#greenDotIcon'
        }
      );

      geoObjects.push(placemark);
    }

    if (!geoObjects.length) {
      console.warn('Klevby map: нет объявлений с городами для отображения');
      return;
    }

    clusterer.add(geoObjects);
    map.geoObjects.add(clusterer);

    if (geoObjects.length === 1) {
      map.setCenter(geoObjects[0].geometry.getCoordinates(), 10);
    } else {
      map.setBounds(clusterer.getBounds(), {
        checkZoomRange: true,
        zoomMargin: 40
      });
    }
  }

  async function geocodeCity(city) {
    try {
      var query = city;

      if (!/беларус|belarus/i.test(query)) {
        query = city + ', Беларусь';
      }

      var result = await window.ymaps.geocode(query, {
        results: 1
      });

      var firstGeoObject = result.geoObjects.get(0);

      if (!firstGeoObject) {
        return null;
      }

      return firstGeoObject.geometry.getCoordinates();
    } catch (error) {
      console.warn('Klevby map: ошибка геокодинга города:', city, error);
      return null;
    }
  }

  function makeHeader(post) {
    var name = post.name ? String(post.name).trim() : 'Рыбак Klevby';

    return (
      '<div style="font-weight:700;font-size:15px;">' +
      escapeHtml(name) +
      '</div>'
    );
  }

  function makeBody(post) {
    var text = post.text ? String(post.text).trim() : 'Описание не указано';
    var telegram = post.telegram ? String(post.telegram).trim() : '';
    var telegramUrl = makeTelegramUrl(telegram);

    var html = '';

    html += '<div style="max-width:260px;">';
    html += '<div style="margin:6px 0 10px;line-height:1.35;">';
    html += escapeHtml(text);
    html += '</div>';

    if (telegramUrl) {
      html +=
        '<a href="' +
        escapeHtml(telegramUrl) +
        '" target="_blank" rel="noopener noreferrer" ' +
        'style="display:inline-block;padding:8px 10px;border-radius:10px;background:#25d366;color:#07140c;text-decoration:none;font-weight:700;">' +
        'Написать в Telegram' +
        '</a>';
    } else if (telegram) {
      html +=
        '<div style="font-size:13px;color:#555;">Telegram: ' +
        escapeHtml(telegram) +
        '</div>';
    }

    html += '</div>';

    return html;
  }

  function makeHint(post) {
    var name = post.name ? String(post.name).trim() : 'Рыбак';
    var city = post.city ? String(post.city).trim() : '';

    if (city) {
      return escapeHtml(name + ' — ' + city);
    }

    return escapeHtml(name);
  }

  function makeTelegramUrl(value) {
    var tg = String(value || '').trim();

    if (!tg) return '';

    if (tg.charAt(0) === '@') {
      tg = tg.slice(1);
    }

    if (/^https?:\/\//i.test(tg)) {
      try {
        var url = new URL(tg);
        var host = url.hostname.replace(/^www\./, '').toLowerCase();

        if (host === 't.me' || host === 'telegram.me') {
          return url.href;
        }

        return '';
      } catch (e) {
        return '';
      }
    }

    if (/^t\.me\//i.test(tg) || /^telegram\.me\//i.test(tg)) {
      return 'https://' + tg;
    }

    tg = tg.replace(/\s/g, '');

    if (/^[a-zA-Z0-9_]{5,32}$/.test(tg)) {
      return 'https://t.me/' + tg;
    }

    return '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function keepMapResponsive(map, mapSection, mapContainer) {
    function fixSize() {
      if (map && map.container) {
        map.container.fitToViewport();
      }
    }

    window.addEventListener('resize', function () {
      setTimeout(fixSize, 200);
    });

    document.addEventListener('click', function () {
      setTimeout(fixSize, 300);
    });

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            setTimeout(fixSize, 200);
          }
        });
      });

      observer.observe(mapContainer);
    }

    if ('MutationObserver' in window) {
      var mutationObserver = new MutationObserver(function () {
        setTimeout(fixSize, 200);
      });

      mutationObserver.observe(mapSection, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }

    setTimeout(fixSize, 500);
  }
})();
