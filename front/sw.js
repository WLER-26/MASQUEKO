const CACHE_NAME = 'masqueko-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/pages/index.html',
  '/pages/home.html',
  '/pages/comunidades.html',
  '/pages/amigos.html',
  '/pages/chat.html',
  '/pages/perfil.html',
  '/pages/404.html',
  '/pages/tag.html',
  '/pages/community.html',
  '/css/style.css',
  '/css/perfil-style.css',
  '/css/chat-style.css',
  '/css/comunidades-style.css',
  '/css/amigos-style.css',
  '/js/api.js',
  '/js/script.js',
  '/js/home-script.js',
  '/js/comunidades-script.js',
  '/js/chat-script.js',
  '/js/perfil-script.js',
  '/js/amigos-script.js',
  '/js/tag-script.js',
  '/js/community-script.js',
  '/assets/logo-masqueko.png',
  '/assets/profile-pic.png'
];

// Instalação: Cache inicial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Servir do cache ou buscar na rede
self.addEventListener('fetch', (event) => {
  // Ignora requisições de API e externas para não cachear dados dinâmicos
  if (
    event.request.url.includes('/api/') || 
    event.request.url.includes('socket.io') ||
    event.request.url.includes('firestore') ||
    event.request.url.includes('googleapis')
  ) {
    return; 
  }

  // Estratégia: Cache First, falling back to Network (mas atualizando o cache se der)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Se achou no cache, retorna. Senão, vai pra rede.
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Se a resposta for válida e for um arquivo do nosso site, guarda no cache
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return networkResponse;
      }).catch(() => {
        // Fallback offline para navegação (se tentar abrir uma página sem internet)
        if (event.request.mode === 'navigate') {
            return caches.match('/pages/index.html');
        }
      });
    })
  );
});