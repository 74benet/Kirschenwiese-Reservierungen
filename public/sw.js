// Service Worker: empfängt Push-Benachrichtigungen, auch wenn die App geschlossen ist

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data?.text() };
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'Kirschenwiese', {
            body: data.body || '',
            icon: '/logo.png',
            badge: '/logo.png',
            tag: data.tag,
            data: { url: data.url || '/' },
        })
    );
});

// Tippen auf die Benachrichtigung öffnet die App (oder holt sie in den Vordergrund)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            for (const client of windows) {
                if ('focus' in client) return client.focus();
            }
            return self.clients.openWindow(event.notification.data?.url || '/');
        })
    );
});
