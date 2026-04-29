self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Этот файл нужен, чтобы телефон распознал сайт как приложение
});
