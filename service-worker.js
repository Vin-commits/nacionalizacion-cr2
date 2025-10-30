// Nombre de la caché (Incrementa la versión si haces cambios)
const CACHE_NAME = 'nacionalizacion-cr-cache-v45';

// Archivos CRÍTICOS del App Shell (solo cachear si existen)
const CACHE_FILES = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'new-logo.png'
];

// CDNs importantes - Se cachearán bajo demanda o en install
const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/browser@latest/umd/zxing-browser.min.js',
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-functions-compat.js'
];

// ===== EVENTO: INSTALL =====
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalando v34...');
  
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cacheando App Shell crítico...');
        // Cachear archivos críticos (si uno falla, falla todo)
        return cache.addAll(CACHE_FILES);
      })
      .then(() => {
        console.log('[Service Worker] Intentando pre-cachear CDNs...');
        return caches.open(CACHE_NAME).then(cache => {
          // Intentar cachear CDNs sin fallar si uno falla
          return Promise.allSettled(
            CDN_URLS.map(url => 
              cache.add(url).catch(err => {
                console.warn(`[Service Worker] No se pudo pre-cachear: ${url}`, err.message);
              })
            )
          );
        });
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting activado.');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[Service Worker] ❌ Error en instalación:', err);
        throw err; // Fallar la instalación si el App Shell crítico falla
      })
  );
});

// ===== EVENTO: ACTIVATE =====
self.addEventListener('activate', (e) => {
  console.log('[Service Worker] Activando v34...');
  
  e.waitUntil(
    caches.keys()
      .then((keyList) => {
        return Promise.all(
          keyList.map((key) => {
            if (key !== CACHE_NAME) {
              console.log('[Service Worker] Eliminando caché antigua:', key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] ✅ Clientes reclamados.');
        return self.clients.claim();
      })
  );
});

// ===== EVENTO: FETCH =====
self.addEventListener('fetch', (e) => {
  // Solo manejar peticiones GET
  if (e.request.method !== 'GET') {
    return; // Dejar pasar al navegador por defecto
  }

  const url = new URL(e.request.url);
  
  // APIs externas y Firebase: SIEMPRE ir a la red (sin cachear)
  if (
    url.hostname.includes('api.hacienda.go.cr') ||
    url.hostname.includes('vpic.nhtsa.dot.gov') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com')
  ) {
    // ✅ CORRECCIÓN CRÍTICA: Usar respondWith para interceptar
    e.respondWith(fetch(e.request));
    return; // Salir completamente del listener
  }

  // Estrategia: Cache First, Network Fallback (para App Shell y CDNs)
  e.respondWith(
    caches.match(e.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Encontrado en caché, servirlo
          return cachedResponse;
        }

        // No está en caché, ir a la red
        return fetch(e.request).then((networkResponse) => {
          // Solo cachear respuestas válidas
          if (
            networkResponse && 
            networkResponse.status === 200 && 
            networkResponse.type !== 'opaque'
          ) {
            // Clonar la respuesta antes de cachearla
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseToCache);
            });
          }
          
          return networkResponse;
        });
      })
      .catch(error => {
        console.error(`[Service Worker] ❌ Error fetch para ${e.request.url}:`, error);
        
        // Opcional: Podrías devolver una página offline aquí
        // if (e.request.destination === 'document') {
        //   return caches.match('/offline.html');
        // }
        
        throw error; // Propagar el error
      })
  );
});
