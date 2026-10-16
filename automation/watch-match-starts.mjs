import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {MatchStartTimer} from './match-start-timer.mjs';
import {planificarInicios, marcarEnviados, podarEstado} from './notification-utils.mjs';
import {inicializarNotificaciones, enviarInicioProgramado} from './send-notifications.mjs';
import {reserveWatcher, releaseWatcher} from './notification-start-store.mjs';

const root = path.resolve(import.meta.dirname, '..');
const statePath = path.join(root, 'data/notification-state.json');
const fixturePath = path.join(root, 'data/club-data.json');
export const WATCH_MINUTES = 180;
const REFRESH_MS = 60_000;

export async function solicitarRelevo({dryRun = false, fetchImpl = fetch} = {}) {
  const repository = process.env.GITHUB_REPOSITORY || 'nicolasmendieta52-source/ceibos-club';
  if (!process.env.GITHUB_TOKEN) throw new Error('El relevo requiere el token temporal del workflow.');
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/actions/workflows/avisar-inicio-partidos.yml/dispatches`, {
    method:'POST', headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},
    body:JSON.stringify({ref:'main',inputs:{dry_run:dryRun}}),signal:AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Relevo del vigilante: HTTP ${response.status}`);
  console.log(`Relevo solicitado${dryRun ? ' · SIMULACIÓN SIN ENVÍOS' : ''}.`);
}

export async function leerFixtureVigente() {
  const repository = process.env.GITHUB_REPOSITORY || 'nicolasmendieta52-source/ceibos-club';
  const headers = {Accept:'application/vnd.github+json'};
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${repository}/contents/data/club-data.json?ref=main`, {
    headers, cache:'no-store', signal:AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Lectura del fixture vigente: HTTP ${response.status}`);
  const file = await response.json();
  const data = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  if (!Array.isArray(data.partidos)) throw new Error('El fixture vigente no contiene una lista de partidos.');
  return data;
}

export async function main() {
  const dryRun = process.argv.includes('--dry-run') || process.env.NOTIFICATIONS_DRY_RUN === 'true';
  const state = podarEstado(JSON.parse(await fs.readFile(statePath, 'utf8')));
  let fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  try { fixture = await leerFixtureVigente(); }
  catch(error) { console.warn(error.message + '; se conserva la última copia del fixture.'); }
  const started = Date.now();
  const until = started + WATCH_MINUTES * 60_000;
  const plans = planificarInicios(fixture, state, started, dryRun ? started + 7 * 24 * 60 * 60_000 : until);
  const upcoming = () => planificarInicios(fixture, state, Date.now(), Date.now() + 24 * 60 * 60_000).some(plan => plan.inicio >= Date.now());
  console.log(`Inicio programado: ${plans.length} horarios${dryRun ? ' · SIMULACIÓN SIN ENVÍOS' : ' · vigilancia anticipada hasta 3 horas'}.`);
  for (const plan of plans) console.log(JSON.stringify({deporte:plan.deporte, categorias:plan.partidos.map(p=>p.categoria), preparar:new Date(plan.preparar).toISOString(), enviar:new Date(plan.inicio).toISOString()}));
  if (dryRun) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      const backend = await inicializarNotificaciones();
      if (!backend) throw new Error('Falta la configuración privada de Firebase o Web Push.');
      try {
        await backend.db.collection('notificationSubscriptions').where('enabled', '==', true).limit(1).get();
        await backend.db.collection('notificationStartDispatches').limit(1).get();
        console.log('Firebase y Web Push verificados en GitHub; no se enviaron notificaciones.');
        if (process.env.NOTIFICATIONS_CHECK_HANDOFF === 'true') await solicitarRelevo({dryRun:true});
      } finally { await backend.db.terminate(); }
    }
    return;
  }
  if (!plans.length && !upcoming()) return;

  const backend = await inicializarNotificaciones();
  if (!backend) throw new Error('Falta la configuración privada para programar notificaciones.');
  const {db} = backend;
  const owner = process.env.GITHUB_RUN_ID || randomUUID();
  if (!await reserveWatcher(db, owner)) {
    console.log('Inicio programado: ya hay un vigilante activo; esta revisión no duplica el proceso.');
    await db.terminate();
    return;
  }
  let leader = true;
  let followUpRequested = false;
  let write = Promise.resolve();
  const saveState = () => write = write.then(() => fs.writeFile(statePath, JSON.stringify(podarEstado(state), null, 2) + '\n'));
  let timer;
  let refreshVersion = 0;
  const reconcile = () => timer.reconcile(planificarInicios(fixture, state, Date.now(), until));
  const refresh = async () => {
    const version = ++refreshVersion;
    try {
      const latest = await leerFixtureVigente();
      if (version === refreshVersion) fixture = latest;
    }
    catch(error) { console.warn(error.message + '; siguen activos los horarios ya conocidos.'); }
    reconcile();
  };
  timer = new MatchStartTimer({
    prepare: async job => {
      // This read happens five minutes before kickoff, never on the kickoff timer's critical path.
      await refresh();
      if (!timer.current(job)) return null;
      const snapshot = await db.collection('notificationSubscriptions').where('enabled', '==', true).get();
      console.log(`Aviso preparado: ${job.deporte} · ${new Date(job.inicio).toISOString()}`);
      return snapshot;
    },
    send: async (job, snapshot) => {
      if (!snapshot) throw new Error('No se pudieron preparar los destinatarios.');
      console.log(`Envío de inicio: previsto=${new Date(job.inicio).toISOString()} ejecutado=${new Date().toISOString()}`);
      const result = await enviarInicioProgramado(db, snapshot, job.deporte, job.partidos, owner);
      marcarEnviados(state, 'start', result.completed);
      await saveState();
      if (result.busy.length) throw new Error('Otro proceso está enviando este inicio; se comprobará nuevamente.');
    },
    onError:error => console.error(`Inicio programado: ${error?.message || error}`)
  });
  reconcile();
  console.log('Vigilante activo; relevo anticipado habilitado si siguen existiendo partidos próximos.');
  try {
    while ((timer.jobs.size || (leader && upcoming())) && Date.now() < until) {
      await sleep(Math.min(REFRESH_MS, Math.max(1, until - Date.now())));
      await refresh();
      if (leader) {
        leader = await reserveWatcher(db, owner);
        if (leader && !followUpRequested && upcoming() && Date.now() >= until - 15 * 60_000) {
          try {
            await solicitarRelevo();
            await releaseWatcher(db, owner);
            followUpRequested = true;
            leader = false;
            // Existing timers continue for fifteen minutes while the successor warms up.
            console.log('Relevo liberado; los temporizadores actuales continúan hasta finalizar su ventana.');
          } catch(error) { console.error(error.message + '; se reintentará el relevo en la próxima lectura.'); }
        }
      }
    }
    // Allow a send already in progress to finish before the workflow saves its audit file.
    for (let attempt = 0; attempt < 120 && [...timer.jobs.values()].some(job => job.sending || job.dispatching); attempt++) await sleep(1000);
    await saveState();
  } finally {
    timer.stop();
    await releaseWatcher(db, owner);
    await db.terminate();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => {
  console.error(`Inicio programado: ${error?.message || error}`);
  process.exitCode = 1;
});
