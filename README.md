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
