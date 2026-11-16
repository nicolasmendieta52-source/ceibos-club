import {opcionesInterno} from './assets/interno-notification-preferences.js?v=20261116estrellas';
import {validateInterno} from './assets/interno-model.js?v=20261113papi';
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
const grupos=document.getElementById('notifInternoGrupos'),equipos=document.getElementById('notifInternoEquipos');
const seleccionAyuda=document.getElementById('notifInternoSeleccionAyuda'),resumen=document.getElementById('notifInternoResumen');
let gruposElegidos=new Set(),equiposElegidos=new Set(),legacy=null;
let torneo=null,torneoLoading=null,torneoLoadedAt=0,overflowAnterior='';

let config = null;
let firebase = null;
let ultimaFocalizada = null;

function deportesElegidos() {
  return {...Object.fromEntries(opciones.map(opcion => [opcion.value, opcion.checked])),internoOpciones:{version:2,categories:categorias.filter(input=>input.checked).map(input=>input.value),groupIds:[...gruposElegidos],teamIds:[...equiposElegidos],events:Object.fromEntries(tipos.map(input=>[input.value,input.checked]))}};
}

function actualizarResumen(){
  const all=categorias.filter(input=>input.checked).map(input=>input.value),names=all.map(id=>torneo?.categories.find(c=>c.id===id)?.name||({masculino:'Masculino',femenino:'Femenino',mas38:'Papi fútbol (+38)'})[id]);
  for(const id of gruposElegidos){const group=torneo?.groups.find(g=>g.id===id);if(!all.includes(group?.categoryId))names.push(group?group.name+' · '+torneo.categories.find(c=>c.id===group.categoryId).name:'Grupo anterior: '+id);}
  for(const id of equiposElegidos){const team=torneo?.teams.find(t=>t.id===id);if(!all.includes(team?.categoryId)&&!gruposElegidos.has(team?.groupId))names.push(team?.name||'Equipo anterior: '+id);}
  resumen.textContent=names.length?'Vas a seguir: '+names.join(' · ')+'.':'Elegí al menos una categoría completa, un grupo o un equipo.';
}

function actualizarControles(){
  const all=categorias.filter(input=>input.checked).map(input=>input.value);
  for(const input of document.querySelectorAll('[data-notif-interno-group],[data-notif-interno-team]'))input.disabled=all.includes(input.dataset.selectionCategory);
  for(const note of document.querySelectorAll('[data-notif-interno-covered]'))note.hidden=!all.includes(note.dataset.notifInternoCovered);
  actualizarResumen();
}

function listaSelecciones(host,rows,selected,kind){
  const opened=new Set([...host.querySelectorAll('details[open]')].map(node=>node.dataset.selectionCategory));host.replaceChildren();
  function choice(row,categoryId=''){
    const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');
    label.className='notif-interno-choice';input.type='checkbox';input.value=row.id;input.dataset[kind==='group'?'notifInternoGroup':'notifInternoTeam']='';input.dataset.selectionCategory=categoryId;input.checked=selected.has(row.id);span.textContent=row.name;label.append(input,span);return label;
  }
  for(const category of torneo.categories){
    const items=rows.filter(row=>row.categoryId===category.id).slice().sort((a,b)=>a.name.localeCompare(b.name,'es'));
    if(!items.length)continue;
    const details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('div'),note=document.createElement('p');
    details.className='notif-interno-category-list';details.dataset.selectionCategory=category.id;details.open=opened.has(category.id)||items.some(row=>selected.has(row.id));summary.textContent=category.name;
    list.className='notif-interno-choices';for(const row of items)list.append(choice(row,category.id));
    note.className='notif-interno-help';note.dataset.notifInternoCovered=category.id;note.textContent='Ya seguís todos. Desmarcá la categoría completa para elegir solo algunos.';
    details.append(summary,note,list);host.append(details);
  }
  for(const id of selected)if(!rows.some(row=>row.id===id))host.append(choice({id,name:(kind==='group'?'Grupo':'Equipo')+' anterior (no disponible): '+id}));
  if(!host.children.length){const note=document.createElement('p');note.className='notif-interno-help';note.textContent='Todavía no hay opciones publicadas.';host.append(note);}
}

function actualizarEquipos(){
  if(!torneo)return;
  if(legacy){const team=torneo.teams.find(team=>team.id===legacy.teamId);if(team&&!legacy.categories.includes(team.categoryId))equiposElegidos.delete(team.id);legacy=null;}
  listaSelecciones(grupos,torneo.groups,gruposElegidos,'group');listaSelecciones(equipos,torneo.teams,equiposElegidos,'team');
  seleccionAyuda.textContent='Cada partido se avisa una sola vez, aunque coincida con varias selecciones.';actualizarControles();
}

async function cargarEquipos(){
  if(torneo&&Date.now()-torneoLoadedAt<60000){actualizarEquipos();return;}
  if(torneoLoading)return torneoLoading;
  torneoLoading=(async()=>{try{
    const response=await fetch('/data/interno.json?notificaciones='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error();
    const data=validateInterno(await response.json());torneo=data;torneoLoadedAt=Date.now();actualizarEquipos();
  }catch{seleccionAyuda.textContent='No pudimos cargar los grupos y equipos. Conservamos tu selección anterior. Podés seguir categorías o volver a intentar al abrir este panel.';}finally{torneoLoading=null;}})();
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
    categorias.forEach(input=>input.checked=settings.categories.includes(input.value)&&(settings.version===2||!settings.teamId));tipos.forEach(input=>input.checked=settings.events[input.value]);
    gruposElegidos=new Set(settings.groupIds||[]);equiposElegidos=new Set(settings.version===2?settings.teamIds:settings.teamId?[settings.teamId]:[]);if(settings.version===1&&settings.teamId)legacy=settings;
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
    if(interno.checked&&!['categories','groupIds','teamIds'].some(key=>preferencias.internoOpciones[key].length))throw Error('Elegí al menos una categoría completa, un grupo o un equipo del Interno.');
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
  window.dispatchEvent(new Event('ceibos-notification-preferences-changed'));
}

function abrirModal({seguirInterno=false,objetivo=null}={}) {
  if(objetivo)cargarPreferenciasLocal();
  const activa=localStorage.getItem(ACTIVE_KEY)==='1',seguiaInterno=interno.checked;
  ultimaFocalizada = document.activeElement;
  modal.hidden = false;
  overflowAnterior=document.body.style.overflow;document.body.style.overflow = "hidden";
  if(seguirInterno){
    if(localStorage.getItem(ACTIVE_KEY)!=='1')opciones.forEach(input=>input.checked=input===interno);
    interno.checked=true;
  }
  if(objetivo){
    if(!activa||!seguiaInterno){categorias.forEach(input=>input.checked=false);gruposElegidos.clear();equiposElegidos.clear();legacy=null;}
    if(!objetivo.following)(objetivo.kind==='group'?gruposElegidos:equiposElegidos).add(objetivo.id);
  }
  actualizarOpcionesInterno();mostrarEstado('');activar.disabled=true;
  cerrar.focus();
  cargarConfig().then(valor => {
    if (!configuracionCompleta(valor)) mostrarEstado("Sistema preparado: falta completar la conexión con Firebase.", "aviso");
  }).catch(() => mostrarEstado("No se pudo leer la configuración.", "error")).finally(()=>activar.disabled=false);
  if(objetivo)cargarEquipos().then(()=>{
    const input=[...modal.querySelectorAll('[data-notif-interno-'+objetivo.kind+']')].find(input=>input.value===objetivo.id);
    if(input){const details=input.closest('details');if(details)details.open=true;const focus=input.disabled?categorias.find(category=>category.value===input.dataset.selectionCategory):input;focus?.focus();focus?.scrollIntoView({block:'nearest'});}
    mostrarEstado('Avisos de '+objetivo.name+': '+(activa?'revisá y guardá tus preferencias.':'confirmá con «Activar notificaciones».'),'aviso');
  });
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
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-interno-follow-group],[data-interno-follow-team]');if(!button)return;
  const kind=button.hasAttribute('data-interno-follow-group')?'group':'team';
  abrirModal({seguirInterno:true,objetivo:{kind,id:button.getAttribute('data-interno-follow-'+kind),name:button.dataset.followName,following:button.getAttribute('aria-pressed')==='true'}});
});
interno.addEventListener('change',actualizarOpcionesInterno);
modal.addEventListener('change',event=>{
  const input=event.target;
  if(input.matches('[data-notif-interno-group]'))input.checked?gruposElegidos.add(input.value):gruposElegidos.delete(input.value);
  if(input.matches('[data-notif-interno-team]'))input.checked?equiposElegidos.add(input.value):equiposElegidos.delete(input.value);
  actualizarControles();
  if(localStorage.getItem(ACTIVE_KEY)==='1')mostrarEstado('Tenés cambios sin guardar. Tocá «Guardar preferencias».','aviso');
  else if(estado.classList.contains('error'))mostrarEstado('');
});
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
