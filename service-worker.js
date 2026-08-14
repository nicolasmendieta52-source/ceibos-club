const ICONO_CEIBOS = "/assets/icono-app-ceibos.png?v=20260810b";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let mensaje = {};
  try {
    mensaje = event.data ? event.data.json() : {};
  } catch {
    mensaje = { body: event.data?.text() || "Hay novedades deportivas en Ceibos Club." };
  }

  const titulo = mensaje.title || "Ceibos Club";
  const opciones = {
    body: mensaje.body || "Hay novedades deportivas en Ceibos Club.",
    icon: ICONO_CEIBOS,
    badge: ICONO_CEIBOS,
    tag: mensaje.tag || "ceibos-club",
    renotify: Boolean(mensaje.renotify),
    data: { url: mensaje.url || "/#fixture" },
    vibrate: [180, 80, 180]
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/#fixture", self.location.origin).href;
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const abierta = ventanas.find(ventana => new URL(ventana.url).origin === self.location.origin);
    if (abierta) {
      await abierta.focus();
      if ("navigate" in abierta) await abierta.navigate(destino);
      return;
    }
    await self.clients.openWindow(destino);
  })());
});
