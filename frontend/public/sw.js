// Aether Service Worker - Privacy-First Notification Handler

self.addEventListener('install', (event) => {
  console.log('[Aether SW] Installing service worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Aether SW] Activating service worker');
  event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
  const { type, title, body } = event.data;

  if (type === 'NOTIFY_IF_SAFE') {
    // Only notify if notification permission is already granted
    // We NEVER request permission from the service worker
    if (Notification.permission === 'granted') {
      self.registration.showNotification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'aether-message',
        requireInteraction: false,
        silent: true,
        data: {
          timestamp: Date.now()
        }
      });
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

self.addEventListener('push', (event) => {
  // Handle push notifications only if permission is granted
  if (Notification.permission === 'granted' && event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Aether', {
        body: data.body || 'New message received',
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'aether-message',
        silent: true,
        data: data
      })
    );
  }
});
