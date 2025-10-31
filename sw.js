/* Service Worker for Notifications (Induct Finish System)
   -------------------------------------------------------
   - Displays desktop notifications when triggered.
   - Works for both Web Push messages (if integrated later)
     and local messages from the site itself.
   - NOTE: Service workers cannot play custom sounds —
     your OS default notification sound will be used.
*/

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/** Utility: Show a notification */
async function showInductNotification(data = {}) {
  const title = data.title || 'New Induct Finish Request';
  const body =
    data.body ||
    `Employee ${data.employeeId || 'Unknown'} (${data.shift || 'N/A'}) submitted a request.`;

  const options = {
    body,
    icon:
      data.icon ||
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f47b.png',
    badge:
      data.badge ||
      'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f47b.png',
    tag: data.tag || 'induct-request',
    renotify: true,
    requireInteraction: true, // stays visible until clicked
    data: {
      url: data.url || '/', // page to open/focus on click
      meta: data.meta || {},
    },
  };

  return self.registration.showNotification(title, options);
}

/** Web Push (if server integration is added later) */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : 'New request received.' };
  }
  event.waitUntil(showInductNotification(payload));
});

/** Local messages from a page */
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg && msg.type === 'LOCAL_NOTIFY') {
    event.waitUntil(showInductNotification(msg.payload || {}));
  }
});

/** Focus or open tab when clicked */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification?.data?.url || '/';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const matching = allClients.find((c) => c.url.includes(urlToOpen));
      if (matching) {
        await matching.focus();
      } else {
        await self.clients.openWindow(urlToOpen);
      }
    })()
  );
});
