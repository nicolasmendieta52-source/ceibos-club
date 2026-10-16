import {createHash} from 'node:crypto';
import {clavePartido} from './notification-utils.mjs';

const COLLECTION = 'notificationStartDispatches';

// Server-only collection: existing Firestore rules deny client access by default.
export async function reserveStarts(db, partidos, owner, now = Date.now()) {
  return db.runTransaction(async transaction => {
    const entries = partidos.map(partido => {
      const key = clavePartido(partido);
      const ref = db.collection(COLLECTION).doc(createHash('sha256').update(key).digest('hex'));
      return {partido, key, ref};
    });
    const snapshots = await Promise.all(entries.map(entry => transaction.get(entry.ref)));
    const alreadySent = [], busy = [];
    const available = entries.filter((entry, index) => {
      const record = snapshots[index].data();
      if (record?.status === 'sent') { alreadySent.push(entry.partido); return false; }
      if (record?.leaseUntil > now) { busy.push(entry.partido); return false; }
      return true;
    });
    for (const entry of available) transaction.set(entry.ref, {
      matchKey:entry.key, owner, status:'sending', leaseUntil:now + 120_000,
      fixtureDate:entry.partido.fecha, fixtureTime:entry.partido.hora
    }, {merge:true});
    return {entries:available, alreadySent, busy};
  });
}

export async function completeStarts(db, entries, owner, result, now = Date.now()) {
  await db.runTransaction(async transaction => {
    const snapshots = await Promise.all(entries.map(entry => transaction.get(entry.ref)));
    entries.forEach((entry, index) => {
      if (snapshots[index].data()?.owner !== owner) return;
      transaction.set(entry.ref, {
        status:'sent', sentAt:new Date(now).toISOString(), leaseUntil:0,
        delivered:result.enviados, failed:result.fallidos
      }, {merge:true});
    });
  });
}

export async function releaseStarts(db, entries, owner) {
  await db.runTransaction(async transaction => {
    const snapshots = await Promise.all(entries.map(entry => transaction.get(entry.ref)));
    entries.forEach((entry, index) => {
      const record = snapshots[index].data();
      if (record?.owner === owner && record.status !== 'sent') transaction.set(entry.ref, {status:'retry',leaseUntil:0}, {merge:true});
    });
  });
}
