# Klevby

Deploy trigger.

## E2E smoke tests (Playwright)

Минимальные smoke-тесты добавлены только для read-only проверки доступности UI.

### Установка

```bash
npm install
npx playwright install chromium
```

### Запуск

```bash
npm run test:e2e
```

или:

```bash
npx playwright test
```

### BASE_URL

По умолчанию тест использует:

- `https://klevby.com/?v=smoke-test`

Можно переопределить:

```bash
BASE_URL="https://klevby.com/?v=smoke-test" npm run test:e2e
```

Тесты запускаются вручную и не подключены к production build.

## Сборка Android APK

Capacitor берёт web assets из `www` (`webDir` в `capacitor.config.ts`), а не напрямую
из корневых `index.html` и `assets`. Перед каждой Android-сборкой выполните:

```bash
npm run prepare:android
cd android
./gradlew assembleDebug
```

`prepare:android` обновляет MapLibre, полностью пересоздаёт `www`, копирует его в
`android/app/src/main/assets/public` и проверяет runtime-файлы и depth GeoJSON.
Android `preBuild` также запускает эту проверку и останавливает сборку, если
generated assets отсутствуют или устарели. Не используйте прямой
`npx cap sync android` вместо `npm run prepare:android`.
