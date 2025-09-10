// Service Worker for Cross-Origin Isolation
// This enables SharedArrayBuffer support required by Zoom Web Video SDK

const CROSS_ORIGIN_ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp'
};

// Only apply headers to Zoom meeting pages
const ZOOM_ROUTES = [
  '/meeting',
  '/joiner',
  '/preview'
];

function shouldApplyHeaders(url) {
  const pathname = new URL(url).pathname;
  return ZOOM_ROUTES.some(route => pathname.includes(route));
}

self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Only intercept requests to our own domain
  if (url.startsWith(self.location.origin)) {
    // For navigation requests (HTML pages), apply cross-origin isolation headers
    if (event.request.mode === 'navigate' && shouldApplyHeaders(url)) {
      event.respondWith(
        fetch(event.request).then(response => {
          // Check if response is valid (status 200-599)
          if (response.status >= 200 && response.status <= 599) {
            // Clone the response to modify headers
            const newResponse = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: new Headers(response.headers)
            });
            
            // Apply cross-origin isolation headers
            Object.entries(CROSS_ORIGIN_ISOLATION_HEADERS).forEach(([key, value]) => {
              newResponse.headers.set(key, value);
            });
            
            console.log('🔒 Applied cross-origin isolation headers for:', url);
            return newResponse;
          } else {
            // For invalid responses, return the original response without modification
            console.warn('⚠️ Invalid response status for:', url, 'status:', response.status);
            return response;
          }
        }).catch(error => {
          // Handle network errors gracefully
          console.error('❌ Network error for:', url, error);
          // Let the browser handle the error naturally
          return fetch(event.request);
        })
      );
    }
  }
});

// Service worker installation
self.addEventListener('install', event => {
  console.log('🔒 Cross-origin isolation service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('🔒 Cross-origin isolation service worker activated');
  event.waitUntil(self.clients.claim());
});
