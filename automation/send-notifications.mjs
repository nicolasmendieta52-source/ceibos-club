import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { agruparPorDeporte, detectarEventos, fechaMontevideo, marcarEnviados, podarEstado } from "./notification-utils.mjs";

const raiz = path.resolve(import.meta.dirname, "..");
const datosPath = path.join(raiz, "data", "club-data.json");
const estadoPath = path.join(raiz, "data", "notification-state.json");
const configPath = path.join(raiz, "notification-config.json");
const indiceAnterior = process.argv.indexOf("--previous");
const anteriorPath = indiceAnterior >= 0 ? path.resolve(process.argv[indiceAnterior + 1]) : datosPath;
const modoPrueba = process.argv.includes("--test");

const NOMBRES = { futbol: "Fútbol", rugby: "Rugby", hockey: "Hockey", basketball: "Basketball" };
let webpush;

async function leerJson(ruta, fallback = {}) {
  try { return JSON.parse(await fs.readFile(ruta, "utf8")); }
  catch { return fallback; }
}

function cuentaServicio(valor) {
  if (!valor) return null;
  const limpio = valor.trim();
  try { return JSON.parse(limpio); }
  catch {
    try { return JSON.parse(Buffer.from(limpio, "base64").toString("utf8")); }
    catch { return null; }
  }
}

function fechaHumana(iso) {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(anio, mes - 1, dia)));
}

function detallePartido(partido) {
  const hora = /^\d{1,2}:\d{2}$/.test(String(partido.hora || "")) ? `${partido.hora} h` : "horario a confirmar";
  const cancha = partido.cancha ? ` · ${partido.cancha}` : "";
  return `${partido.categoria} vs ${partido.rival} · ${hora}${cancha}`;
}

function crearMensaje(tipo, deporte, partidos) {
  const ordenados = [...partidos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.hora || "").localeCompare(String(b.hora || "")));
  const primero = ordenados[0];
  if (tipo === "today") {
    return {
      title: `Hoy juega Ceibos · ${NOMBRES[deporte]}`,
      body: ordenados.length === 1 ? detallePartido(primero) : `${ordenados.length} categorías juegan hoy. Primero: ${detallePartido(primero)}.`,
      url: "/#fixture",
      tag: `ceibos-hoy-${deporte}-${primero.fecha}`,
      renotify: true
    };
  }
  return {
    title: `Nuevos partidos de ${NOMBRES[deporte]}`,
    body: ordenados.length === 1 ? `${fechaHumana(primero.fecha)} · ${detallePartido(primero)}` : `${ordenados.length} partidos publicados. Primero: ${fechaHumana(primero.fecha)} · ${detallePartido(primero)}.`,
    url: "/#fixture",
    tag: `ceibos-nuevos-${deporte}-${primero.fecha}`,
    renotify: false
  };
}

async function enviarGrupo(snapshot, deporte, mensaje) {
  let enviados = 0;
  let eliminados = 0;
  for (const documento of snapshot.docs) {
    const suscriptor = documento.data();
    if (!suscriptor.enabled || suscriptor.deportes?.[deporte] !== true || !suscriptor.endpoint || !suscriptor.keys?.p256dh || !suscriptor.keys?.auth) continue;
    try {
      await webpush.sendNotification({ endpoint: suscriptor.endpoint, keys: suscriptor.keys }, JSON.stringify(mensaje), {
        TTL: 24 * 60 * 60,
        urgency: mensaje.renotify ? "high" : "normal"
      });
      enviados += 1;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await documento.ref.delete();
        eliminados += 1;
      } else {
        console.warn(`notificaciones: no se pudo enviar a una suscripción (${error?.statusCode || error?.message || "error"})`);
      }
    }
  }
  console.log(`notificaciones: ${NOMBRES[deporte]} · ${enviados} enviadas${eliminados ? ` · ${eliminados} suscripciones vencidas eliminadas` : ""}`);
}

async function enviarPrueba(snapshot) {
  const mensaje = {
    title: "Notificación de prueba · Ceibos Club",
    body: "¡Listo! Vas a recibir avisos de los partidos de los deportes que elegiste.",
    url: "/#fixture",
    tag: `ceibos-prueba-${Date.now()}`,
    renotify: true
  };
  let enviados = 0;
  let eliminados = 0;
  for (const documento of snapshot.docs) {
    const suscriptor = documento.data();
    if (!suscriptor.enabled || !suscriptor.endpoint || !suscriptor.keys?.p256dh || !suscriptor.keys?.auth) continue;
    try {
      await webpush.sendNotification({ endpoint: suscriptor.endpoint, keys: suscriptor.keys }, JSON.stringify(mensaje), {
        TTL: 10 * 60,
        urgency: "high"
      });
      enviados += 1;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await documento.ref.delete();
        eliminados += 1;
      } else {
        console.warn(`notificaciones: no se pudo enviar la prueba a una suscripción (${error?.statusCode || error?.message || "error"})`);
      }
    }
  }
  console.log(`notificaciones: prueba terminada · ${enviados} enviadas${eliminados ? ` · ${eliminados} suscripciones vencidas eliminadas` : ""}`);
}

async function main() {
  const [config, actuales, anteriores, estadoInicial] = await Promise.all([
    leerJson(configPath),
    leerJson(datosPath, { partidos: [] }),
    leerJson(anteriorPath, { partidos: [] }),
    leerJson(estadoPath, { version: 1, sentNew: {}, sentToday: {} })
  ]);
  const servicio = cuentaServicio(process.env.FIREBASE_SERVICE_ACCOUNT);
  const clavePrivada = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!config.enabled || !config.vapidPublicKey || !servicio || !clavePrivada) {
    console.log("notificaciones: configuración incompleta; se omite el envío sin afectar la actualización de partidos");
    return;
  }

  const estado = podarEstado({ version: 1, ...estadoInicial });
  const eventos = detectarEventos(anteriores, actuales, estado, fechaMontevideo());
  if (!modoPrueba && !eventos.nuevos.length && !eventos.delDia.length) {
    console.log("notificaciones: no hay avisos nuevos para enviar");
    await fs.writeFile(estadoPath, `${JSON.stringify(estado, null, 2)}\n`);
    return;
  }

  const [{ cert, getApps, initializeApp }, { getFirestore }, webpushModule] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/firestore"),
    import("web-push")
  ]);
  webpush = webpushModule.default;
  if (!getApps().length) initializeApp({ credential: cert(servicio) });
  const db = getFirestore();
  const snapshot = await db.collection("notificationSubscriptions").where("enabled", "==", true).get();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:administracion@ceibosclub.com", config.vapidPublicKey, clavePrivada);

  if (modoPrueba) {
    await enviarPrueba(snapshot);
    return;
  }

  for (const [tipo, partidos] of [["new", eventos.nuevos], ["today", eventos.delDia]]) {
    for (const [deporte, grupo] of agruparPorDeporte(partidos)) {
      await enviarGrupo(snapshot, deporte, crearMensaje(tipo, deporte, grupo));
    }
    marcarEnviados(estado, tipo, partidos);
  }
  await fs.writeFile(estadoPath, `${JSON.stringify(podarEstado(estado), null, 2)}\n`);
  console.log(`notificaciones: proceso terminado (${eventos.nuevos.length} partidos nuevos, ${eventos.delDia.length} recordatorios del día)`);
}

main().catch(error => {
  console.error(`notificaciones: error de envío: ${error?.message || error}`);
  process.exitCode = 1;
});
