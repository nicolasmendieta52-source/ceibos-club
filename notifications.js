const CONFIG_URL = "/notification-config.json";
const PREFS_KEY = "ceibos_notification_preferences_v1";
const ACTIVE_KEY = "ceibos_notifications_active_v1";
const FIREBASE_VERSION = "11.10.0";

const fab = document.getElementById("notifFab");
const modal = document.getElementById("notifModal");
const cerrar = document.getElementById("notifCerrar");
const activar = document.getElementById("notifActivar");
const desactivar = document.getElementById("notifDesactivar");
const estado = document.getElementById("notifEstado");
const opciones = [...document.querySelectorAll(".notif-opcion input")];

let config = null;
let firebase = null;
let ultimaFocalizada = null;

function deportesElegidos() {
  return Object.fromEntries(opciones.map(opcion => [opcion.value, opcion.checked]));
}

function guardarPreferenciasLocal(preferencias) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(preferencias));
}

function cargarPreferenciasLocal() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (!guardadas) return;
    opciones.forEach(opcion => { if (typeof guardadas[opcion.value] === "boolean") opcion.checked = guardadas[opcion.value]; });
  } catch {}
}

function mostrarEstado(texto, tipo = "") {
  estado.textContent = texto;
  estado.className = `notif-estado${tipo ? ` ${tipo}` : ""}`;
}

function configuracionCompleta(valor) {
  const firebaseConfig = valor?.firebase || {};
  return Boolean(valor?.enabled && valor?.vapidPublicKey && firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

async function cargarConfig() {
  if (config) return config;
  const respuesta = await fetch(`${CONFIG_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!respuesta.ok) throw new Error("No se encontró la configuración de notificaciones.");
  config = await respuesta.json();
  return config;
}

async function cargarFirebase() {
  if (firebase) return firebase;
  const appSdk = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
  const authSdk = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`);
  const firestoreSdk = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
  const app = appSdk.initializeApp(config.firebase);
  const auth = authSdk.getAuth(app);
  const credential = auth.currentUser ? { user: auth.currentUser } : await authSdk.signInAnonymously(auth);
  firebase = { auth, user: credential.user, firestoreSdk, db: firestoreSdk.getFirestore(app) };
  return firebase;
}

function convertirClaveVapid(clave) {
  const relleno = "=".repeat((4 - clave.length % 4) % 4);
  const base64 = (clave + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = atob(base64);
  return Uint8Array.from([...bytes].map(caracter => caracter.charCodeAt(0)));
}

function esIosSinInstalar() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  return ios && !instalada;
}

async function obtenerRegistro() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("Este navegador no admite notificaciones web.");
  }
  return navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
}

async function guardarSuscripcion(suscripcion, preferencias) {
  const { user, firestoreSdk, db } = await cargarFirebase();
  const serializada = suscripcion.toJSON();
  await firestoreSdk.setDoc(firestoreSdk.doc(db, "notificationSubscriptions", user.uid), {
    enabled: true,
    endpoint: serializada.endpoint,
    keys: serializada.keys,
    deportes: preferencias,
    userAgent: navigator.userAgent.slice(0, 350),
    updatedAt: firestoreSdk.serverTimestamp()
  }, { merge: true });
}

async function activarNotificaciones() {
  activar.disabled = true;
  mostrarEstado("Preparando las notificaciones…");
  try {
    const preferencias = deportesElegidos();
    if (!Object.values(preferencias).some(Boolean)) throw new Error("Elegí por lo menos un deporte.");
    await cargarConfig();
    if (!configuracionCompleta(config)) {
      mostrarEstado("El sistema está preparado, pero falta conectar Firebase antes de habilitarlo al público.", "aviso");
      return;
    }
    if (esIosSinInstalar()) {
      mostrarEstado("En iPhone: Compartir → Agregar a inicio. Después abrí Ceibos Club desde el ícono y volvé a tocar este botón.", "aviso");
      return;
    }
    const registro = await obtenerRegistro();
    const permiso = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permiso !== "granted") throw new Error("El permiso fue rechazado. Podés habilitarlo desde la configuración del navegador.");
    const existente = await registro.pushManager.getSubscription();
    const suscripcion = existente || await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertirClaveVapid(config.vapidPublicKey)
    });
    await guardarSuscripcion(suscripcion, preferencias);
    guardarPreferenciasLocal(preferencias);
    localStorage.setItem(ACTIVE_KEY, "1");
    actualizarInterfaz(true);
    mostrarEstado("Listo: vas a recibir avisos de los deportes seleccionados.", "ok");
    if (!existente) await registro.showNotification("Notificaciones activadas", {
      body: "Ceibos Club te avisará cuando haya partidos nuevos.",
      icon: "/assets/icono-app-ceibos.png?v=20260810b",
      badge: "/assets/icono-app-ceibos.png?v=20260810b",
      tag: "ceibos-bienvenida",
      data: { url: "/#fixture" }
    });
  } catch (error) {
    mostrarEstado(error?.message || "No se pudieron activar las notificaciones.", "error");
  } finally {
    activar.disabled = false;
  }
}

async function desactivarNotificaciones() {
  desactivar.disabled = true;
  mostrarEstado("Desactivando…");
  try {
    await cargarConfig();
    const registro = await obtenerRegistro();
    const suscripcion = await registro.pushManager.getSubscription();
    if (configuracionCompleta(config)) {
      const { user, firestoreSdk, db } = await cargarFirebase();
      await firestoreSdk.deleteDoc(firestoreSdk.doc(db, "notificationSubscriptions", user.uid));
    }
    if (suscripcion) await suscripcion.unsubscribe();
    localStorage.removeItem(ACTIVE_KEY);
    actualizarInterfaz(false);
    mostrarEstado("Notificaciones desactivadas.");
  } catch (error) {
    mostrarEstado(error?.message || "No se pudieron desactivar.", "error");
  } finally {
    desactivar.disabled = false;
  }
}

function actualizarInterfaz(activa) {
  fab.classList.toggle("activa", activa);
  activar.textContent = activa ? "Guardar preferencias" : "Activar notificaciones";
  desactivar.hidden = !activa;
}

function abrirModal() {
  ultimaFocalizada = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  cerrar.focus();
  cargarConfig().then(valor => {
    if (!configuracionCompleta(valor)) mostrarEstado("Sistema preparado: falta completar la conexión con Firebase.", "aviso");
  }).catch(() => mostrarEstado("No se pudo leer la configuración.", "error"));
}

function cerrarModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
  ultimaFocalizada?.focus?.();
}

cargarPreferenciasLocal();
const permisoConcedido = "Notification" in window && Notification.permission === "granted";
actualizarInterfaz(localStorage.getItem(ACTIVE_KEY) === "1" && permisoConcedido);
fab.addEventListener("click", abrirModal);
cerrar.addEventListener("click", cerrarModal);
modal.addEventListener("click", event => { if (event.target === modal) cerrarModal(); });
activar.addEventListener("click", activarNotificaciones);
desactivar.addEventListener("click", desactivarNotificaciones);
addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) cerrarModal(); });
