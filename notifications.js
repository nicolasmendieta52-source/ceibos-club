import {opcionesInterno} from './assets/interno-notification-preferences.js?v=20261110';
import {validateInterno} from './assets/interno-model.js?v=20261110formatos';
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
const interno=document.getElementById('notifInterno');
const internoOpciones=document.getElementById('notifInternoOpciones');
const categorias=[...document.querySelectorAll('[data-notif-interno-category]')];
const tipos=[...document.querySelectorAll('[data-notif-interno-event]')];
const equipo=document.getElementById('notifInternoEquipo');
const equipoAyuda=document.getElementById('notifInternoEquipoAyuda');
let torneo=null,torneoLoading=null,torneoLoadedAt=0,overflowAnterior='';

let config = null;
let firebase = null;
let ultimaFocalizada = null;

function deportesElegidos() {
  return {...Object.fromEntries(opciones.map(opcion => [opcion.value, opcion.checked])),internoOpciones:{categories:categorias.filter(input=>input.checked).map(input=>input.value),teamId:equipo.value||equipo.dataset.selectedTeam||'',events:Object.fromEntries(tipos.map(input=>[input.value,input.checked]))}};
}

function actualizarEquipos(){
  if(!torneo)return;
  const selected=equipo.value||equipo.dataset.selectedTeam||'',allowed=categorias.filter(input=>input.checked).map(input=>input.value);
  equipo.replaceChildren(new Option('Todos los equipos de mi selección',''));
  for(const category of torneo.categories.filter(category=>allowed.includes(category.id))){
    const teams=torneo.teams.filter(team=>team.categoryId===category.id).sort((a,b)=>a.name.localeCompare(b.name,'es'));
    if(!teams.length)continue;
    const group=document.createElement('optgroup');group.label=category.name;
    for(const team of teams)group.append(new Option(team.name,team.id));equipo.append(group);
  }
  const unavailable=selected&&!torneo.teams.some(team=>team.id===selected);
  if(unavailable)equipo.append(new Option('Mi equipo (no disponible en la lista actual)',selected));
  equipo.value=[...equipo.options].some(option=>option.value===selected)?selected:'';equipo.dataset.selectedTeam=equipo.value;
  if(unavailable){equipoAyuda.textContent='Conservamos tu equipo anterior. Elegí otra opción si querés cambiar a quién seguís.';return;}
  equipoAyuda.textContent=allowed.length===1&&allowed[0]==='mas38'&&!torneo.teams.some(team=>team.categoryId==='mas38')?'Podés seguir Papi fútbol. Sus equipos aparecerán cuando se anuncien.':'Elegí un equipo o seguí todos los de las categorías marcadas.';
}

async function cargarEquipos(){
  if(torneo&&Date.now()-torneoLoadedAt<60000){actualizarEquipos();return;}
  if(torneoLoading)return torneoLoading;
  torneoLoading=(async()=>{try{
    const response=await fetch('/data/interno.json?notificaciones='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error();
    const data=validateInterno(await response.json());torneo=data;torneoLoadedAt=Date.now();actualizarEquipos();
  }catch{equipoAyuda.textContent='No pudimos cargar los equipos. Podés seguir las categorías y volver a intentar al abrir este panel.';}finally{torneoLoading=null;}})();
  return torneoLoading;
}

function actualizarOpcionesInterno(){
  internoOpciones.hidden=!interno.checked;internoOpciones.disabled=!interno.checked;interno.setAttribute('aria-expanded',String(interno.checked));
  if(interno.checked)cargarEquipos();
}

function guardarPreferenciasLocal(preferencias) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(preferencias));
}

function cargarPreferenciasLocal() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (!guardadas) return;
    opciones.forEach(opcion => { if (typeof guardadas[opcion.value] === "boolean") opcion.checked = guardadas[opcion.value]; });
    const settings=opcionesInterno(guardadas.internoOpciones);
    categorias.forEach(input=>input.checked=settings.categories.includes(input.value));tipos.forEach(input=>input.checked=settings.events[input.value]);equipo.dataset.selectedTeam=settings.teamId;
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
  await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  return navigator.serviceWorker.ready;
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
    if (!opciones.some(input=>input.checked)) throw new Error("Elegí por lo menos un deporte o el Interno.");
    if(interno.checked&&!preferencias.internoOpciones.categories.length)throw Error('Elegí al menos una categoría del Interno.');
    if(interno.checked&&!Object.values(preferencias.internoOpciones.events).some(Boolean))throw Error('Elegí al menos un tipo de aviso del Interno.');
    if (!configuracionCompleta(config)) {
      mostrarEstado("El sistema está preparado, pero falta conectar Firebase antes de habilitarlo al público.", "aviso");
      return;
    }
    if (esIosSinInstalar()) {
      mostrarEstado("En iPhone: Compartir → Agregar a inicio. Después abrí Ceibos Club desde el ícono y volvé a tocar este botón.", "aviso");
      return;
    }
    if(!('Notification' in window))throw Error('Este navegador no admite notificaciones web.');
    // Request permission in the button's user gesture, before asynchronous network work.
    const permiso = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permiso !== "granted") throw new Error("El permiso fue rechazado. Podés habilitarlo desde la configuración del navegador.");
    const registro = await obtenerRegistro();
    const existente = await registro.pushManager.getSubscription();
    const suscripcion = existente || await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertirClaveVapid(config.vapidPublicKey)
    });
    await guardarSuscripcion(suscripcion, preferencias);
    guardarPreferenciasLocal(preferencias);
    localStorage.setItem(ACTIVE_KEY, "1");
    actualizarInterfaz(true);
    mostrarEstado("Listo: tus preferencias quedaron guardadas.", "ok");
    if (!existente) await registro.showNotification("Notificaciones activadas", {
      body: interno.checked?"Vas a recibir los avisos del Interno que elegiste.":"Ceibos Club te avisará cuando haya partidos nuevos.",
      icon: "/assets/icono-app-ceibos.png?v=20260810b",
      badge: "/assets/icono-app-ceibos.png?v=20260810b",
      tag: "ceibos-bienvenida",
      data: { url: interno.checked?"/#interno":"/#fixture" }
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

function abrirModal({seguirInterno=false}={}) {
  ultimaFocalizada = document.activeElement;
  modal.hidden = false;
  overflowAnterior=document.body.style.overflow;document.body.style.overflow = "hidden";
  if(seguirInterno){
    if(localStorage.getItem(ACTIVE_KEY)!=='1')opciones.forEach(input=>input.checked=input===interno);
    interno.checked=true;
  }
  actualizarOpcionesInterno();mostrarEstado('');activar.disabled=true;
  cerrar.focus();
  cargarConfig().then(valor => {
    if (!configuracionCompleta(valor)) mostrarEstado("Sistema preparado: falta completar la conexión con Firebase.", "aviso");
  }).catch(() => mostrarEstado("No se pudo leer la configuración.", "error")).finally(()=>activar.disabled=false);
}

function cerrarModal() {
  modal.hidden = true;
  document.body.style.overflow = overflowAnterior;
  ultimaFocalizada?.focus?.();
}

cargarPreferenciasLocal();
actualizarOpcionesInterno();
const permisoConcedido = "Notification" in window && Notification.permission === "granted";
actualizarInterfaz(localStorage.getItem(ACTIVE_KEY) === "1" && permisoConcedido);
fab.addEventListener("click", ()=>abrirModal());
document.querySelectorAll('[data-notificaciones-interno]').forEach(button=>button.addEventListener('click',()=>abrirModal({seguirInterno:true})));
interno.addEventListener('change',actualizarOpcionesInterno);
categorias.forEach(input=>input.addEventListener('change',actualizarEquipos));
equipo.addEventListener('change',()=>equipo.dataset.selectedTeam=equipo.value);
[...opciones,...categorias,...tipos,equipo].forEach(input=>input.addEventListener('change',()=>{
  if(localStorage.getItem(ACTIVE_KEY)==='1')mostrarEstado('Tenés cambios sin guardar. Tocá «Guardar preferencias».','aviso');
  else if(estado.classList.contains('error'))mostrarEstado('');
}));
cerrar.addEventListener("click", cerrarModal);
modal.addEventListener("click", event => { if (event.target === modal) cerrarModal(); });
activar.addEventListener("click", activarNotificaciones);
desactivar.addEventListener("click", desactivarNotificaciones);
addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) cerrarModal(); });
modal.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...modal.querySelectorAll('button,input,select,a[href]')].filter(element=>!element.disabled&&element.getClientRects().length),first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
