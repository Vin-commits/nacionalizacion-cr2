// Nombre de la caché (Incrementa la versión si haces cambios aquí)
const CACHE_NAME = 'nacionalizacion-cr-cache-v31'; // Nueva versión por corrección

// Archivos para guardar en caché (el "App Shell")
const CACHE_FILES = [
  '.', // Importante para cachear el index.html en la raíz
  'index.html', // Cachear explícitamente por si '.' falla
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'new-logo.png', // Asegúrate que este archivo exista en /public
  // CDNs importantes
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/browser@latest/umd/zxing-browser.min.js',
  // Firebase SDKs
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-functions-compat.js' // <-- ✅ Añadido Functions
]; // <-- ✅ Corchete de cierre único y correcto

// Evento "install": Se dispara cuando el Service Worker se instala
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalando...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando archivos del App Shell:', CACHE_FILES);
      // Usar addAll es más atómico, fallará si *uno* falla, lo cual es bueno para el App Shell.
      // Si falla, sabremos que algo esencial no se cacheó.
      return cache.addAll(CACHE_FILES)
        .catch(err => {
          console.error('[Service Worker] Falló addAll al cachear App Shell:', err);
          // Puedes decidir si lanzar el error para que falle la instalación
          // throw err;
        });
    }).then(() => {
        // Forzar la activación inmediata del nuevo SW en lugar de esperar
        console.log('[Service Worker] Skip waiting activado.');
        return self.skipWaiting();
    })
  );
});

// Evento "activate": Se dispara cuando el nuevo Service Worker se activa
self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activando...');
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Eliminando caché antigua:', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => {
            // Tomar control inmediato de las páginas abiertas
            console.log('[Service Worker] Clientes reclamados.');
            return self.clients.claim();
        })
    );
});


// Evento "fetch": Se dispara CADA VEZ que la app pide un recurso
self.addEventListener('fetch', (e) => {
  // Ignorar peticiones que no son GET (ej: POST a Firebase Functions)
  if (e.request.method !== 'GET') {
    // console.log(`[Service Worker] Ignorando petición no-GET: ${e.request.method} ${e.request.url}`);
    return; // Dejar pasar a la red
  }

  // Ignorar URLs de APIs externas o Firebase
  const url = new URL(e.request.url);
  if (url.hostname.includes('api.hacienda.go.cr') ||
      url.hostname.includes('vpic.nhtsa.dot.gov') ||
      url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('google.com')) { // Ampliar para incluir auth/functions
    // console.log(`[Service Worker] Petición externa/API (pasa a red): ${e.request.url}`);
    // Siempre ir a la red para estas
    // No cachear la respuesta de la API aquí
    return fetch(e.request);
  }

  // Estrategia: Cache First, then Network (para App Shell y CDNs)
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // console.log(`[Service Worker] Sirviendo desde caché: ${e.request.url}`);
        return cachedResponse;
      }

      // console.log(`[Service Worker] Pidiendo a la red (no en caché): ${e.request.url}`);
      return fetch(e.request).then((networkResponse) => {
          // Cachear la respuesta solo si es válida (status 200)
          if (networkResponse && networkResponse.status === 200) {
              // console.log(`[Service Worker] Cacheando respuesta de red para: ${e.request.url}`);
              // IMPORTANTE: Clonar la respuesta antes de usarla
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                  cache.put(e.request, responseToCache);
              });
          } else {
               // console.log(`[Service Worker] No se cachea respuesta no válida (${networkResponse.status}) para: ${e.request.url}`);
          }
          return networkResponse;
        }
      ).catch(error => {
          console.error(`[Service Worker] Error en fetch para ${e.request.url}:`, error);
          // Podrías devolver una página offline aquí si fetch falla
          // return caches.match('/offline.html');
          throw error; // Propagar el error
      });
    })
  );
});
