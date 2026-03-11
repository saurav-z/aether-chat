// Aether Service Worker - Privacy-First Notification Handler

let monitoredTopics = [];
let relayUrl = '';
let pollInterval = null;

self.addEventListener('install', (event) => {
  console.log('[Aether SW] Installing service worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Aether SW] Activating service worker');
  event.waitUntil(clients.claim());
});

async function checkMessages() {
  if (!relayUrl || monitoredTopics.length === 0) return;

  let totalNew = 0;
  for (const topic of monitoredTopics) {
    try {
      const response = await fetch(`${relayUrl}/count/${topic}`);
      const data = await response.json();
      if (data.count > 0) {
        totalNew += data.count;
      }
    } catch (e) {
      console.error('[Aether SW] Poll failed for topic', topic, e);
    }
  }

  if (totalNew > 0 && Notification.permission === 'granted') {
    self.registration.showNotification('Aether', {
      body: `You have ${totalNew} new secure signal${totalNew > 1 ? 's' : ''}`,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'aether-polling', // Unique tag to prevent multiple non-collapsed notifications
      silent: true,
      renotify: true,
      data: { count: totalNew }
    });
  }
}

self.addEventListener('message', (event) => {
  const { type, topics, url, title, body } = event.data;

  if (type === 'SYNC_TOPICS') {
    monitoredTopics = topics || [];
    if (url) {
        relayUrl = url.replace(/\/$/, '');
    }
    console.log(`[Aether SW] Synced ${monitoredTopics.length} topics. Relay: ${relayUrl}`);

    if (!pollInterval && relayUrl) {
      pollInterval = setInterval(checkMessages, 60000); // Poll every minute
    }
    if (relayUrl) checkMessages(); // Check immediately
  }

  if (type === 'NOTIFY_IF_SAFE') {
    if (Notification.permission === 'granted') {
      self.registration.showNotification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'aether-message',
        requireInteraction: false,
        silent: true,
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
        if (client.url.includes('/') && 'focus' in client) {
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
