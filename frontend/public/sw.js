/* PeerPays service worker - handles Web Push (lock-screen) notifications. */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'PeerPays', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'PeerPays';
  const options = {
    body: data.body || '',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    data: { url: data.url || '/', bookingId: data.bookingId || null },
    tag: data.bookingId || undefined,
    renotify: !!data.bookingId,
    vibrate: [120, 60, 120, 60, 200],
    silent: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
