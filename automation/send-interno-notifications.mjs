import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {detectarEventosInterno,crearMensajeInterno,partidosInterno} from './interno-notification-utils.mjs';
import {inicializarNotificaciones,enviarGrupo} from './send-notifications.mjs';

const root=path.resolve(import.meta.dirname,'..');
const refFor=(db,event)=>db.collection('internoNotificationDispatches').doc(createHash('sha256').update(event.key).digest('hex'));

export async function reservarEventoInterno(db,event,owner,now=Date.now()){
  const ref=refFor(db,event);
  return db.runTransaction(async transaction=>{
    const record=(await transaction.get(ref)).data();
    if(record?.status==='sent')return 'sent';
    if(record?.leaseUntil>now)return 'busy';
    transaction.set(ref,{owner,status:'sending',leaseUntil:now+120000,type:event.tipo,matchId:event.partido.internoId},{merge:true});
    return 'reserved';
  });
}

export async function terminarEventoInterno(db,event,owner,result,now=Date.now()){
  const ref=refFor(db,event);
  await db.runTransaction(async transaction=>{const record=(await transaction.get(ref)).data();if(record?.owner===owner)transaction.set(ref,{status:result?'sent':'retry',leaseUntil:0,...(result?{sentAt:new Date(now).toISOString(),delivered:result.enviados,failed:result.fallidos}:{})},{merge:true});});
}

export async function main(){
  const dryRun=process.argv.includes('--dry-run')||process.env.NOTIFICATIONS_DRY_RUN==='true';
  const data=JSON.parse(await fs.readFile(path.join(root,'data/interno.json'),'utf8'));
  partidosInterno(data);
  if(dryRun&&process.env.GITHUB_ACTIONS!=='true'){
    console.log('Interno: simulación local · '+detectarEventosInterno(data).events.length+' avisos sobre un control vacío. No se conectó el servidor ni se enviaron avisos.');return;
  }
  const backend=await inicializarNotificaciones();if(!backend)throw Error('Falta la configuración de Firebase o Web Push');
  const {db}=backend,owner=process.env.GITHUB_RUN_ID||randomUUID();
  try{
    const baseline=db.collection('internoNotificationControl').doc('baseline'),previous=(await baseline.get()).data()||{};
    const {events,state}=detectarEventosInterno(data,previous);
    console.log('Interno: '+events.length+' avisos pendientes'+(dryRun?' · SIMULACIÓN SIN ENVÍOS':''));
    if(dryRun){
      await db.collection('notificationSubscriptions').limit(1).get();await db.collection('internoNotificationDispatches').limit(1).get();console.log('Conexión y permisos del servidor verificados. No se enviaron avisos ni se modificó el control.');return;
    }
    if(events.length){
      const snapshot=await db.collection('notificationSubscriptions').where('enabled','==',true).get();
      for(const event of events){
        const claim=await reservarEventoInterno(db,event,owner);
        if(claim==='busy')throw Error('Otro proceso está enviando un aviso; se reintentará en la próxima revisión');
        if(claim==='reserved')try{
          const result=await enviarGrupo(snapshot,'interno',crearMensajeInterno(event.tipo,[event.partido]),undefined,{tipo:event.tipo,partidos:[event.partido]});
          if(!result.enviados&&result.fallidos)throw Error('Falló el transporte de los avisos; se reintentará');
          await terminarEventoInterno(db,event,owner,result);
        }catch(error){await terminarEventoInterno(db,event,owner,null);throw error;}
        state.sent[event.key]=new Date().toISOString();
      }
    }
    // Save the baseline only after every event resolves; retries keep the previous comparison.
    if(JSON.stringify(previous)!==JSON.stringify(state))await baseline.set(state);
  }finally{await db.terminate();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error('Interno: '+error.message);process.exitCode=1;});
