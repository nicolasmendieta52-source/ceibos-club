import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {internoSyncDue} from './interno-sync-due.mjs';

export const WATCH_MINUTES=170;
const SYNC_WORKFLOW='actualizar-interno.yml',WATCH_WORKFLOW='mantener-lectura-interno.yml';

export function createInternoWatcher({token=process.env.GITHUB_TOKEN,repository=process.env.GITHUB_REPOSITORY,fetchImpl=fetch,now=Date.now}={}){
  if(!token||!repository||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))throw Error('Falta la configuración temporal del vigilante del Interno');
  const base='https://api.github.com/repos/'+repository;
  let lastAttempt=-Infinity;
  async function api(endpoint,body){
    const response=await fetchImpl(base+endpoint,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','Cache-Control':'no-cache'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Vigilante del Interno: HTTP '+response.status+' en '+endpoint.split('?')[0]);
    return response.status===204?null:response.json();
  }
  async function dispatch(workflow,inputs){await api('/actions/workflows/'+workflow+'/dispatches',{ref:'main',inputs});}
  return {
    async tick({allowDispatch=true}={}){
      const file=await api('/contents/data/interno.json?ref=main');
      const data=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
      if(!data.sourceInfo)throw Error('El snapshot del Interno no informa su última lectura');
      const due=internoSyncDue(data,now()),checkedAt=data.sourceInfo.checkedAt||data.sourceInfo.importedAt;
      if(!due||!allowDispatch)return {due,checkedAt,requested:false};
      const runs=await api('/actions/workflows/'+SYNC_WORKFLOW+'/runs?per_page=10');
      if(runs.workflow_runs?.some(run=>['requested','waiting','pending','queued','in_progress'].includes(run.status)))return {due,checkedAt,requested:false,active:true};
      if(now()-lastAttempt<10*60000)return {due,checkedAt,requested:false,retryAfter:true};
      lastAttempt=now();
      await dispatch(SYNC_WORKFLOW,{dry_run:false});
      return {due,checkedAt,requested:true};
    },
    async relay(mode='watch'){
      if(!['watch','verify'].includes(mode))throw Error('Modo de relevo inválido');
      await dispatch(WATCH_WORKFLOW,{mode});
      return {relayRequested:true,mode};
    }
  };
}

export async function main(){
  const mode=process.env.INTERNO_WATCH_MODE||'watch';
  if(!['watch','verify','probe'].includes(mode))throw Error('Modo de vigilancia inválido');
  const watcher=createInternoWatcher();
  const log=value=>console.log('Vigilante Interno: '+JSON.stringify(value));
  if(mode!=='watch'){
    log(await watcher.tick({allowDispatch:false}));
    if(mode==='probe')log(await watcher.relay('verify'));
    return;
  }
  const until=Date.now()+WATCH_MINUTES*60000;
  console.log('Vigilante Interno activo: revisión cada minuto; lectura por hora y relevo automático.');
  let lastMessage='';
  while(Date.now()<until){
    try{const value=await watcher.tick(),message=JSON.stringify(value);if(message!==lastMessage){log(value);lastMessage=message;}}
    catch(error){console.error(error.message);}
    await sleep(Math.min(60000,Math.max(1,until-Date.now())));
  }
  for(let attempt=0;attempt<3;attempt++){
    try{log(await watcher.relay());return;}
    catch(error){console.error(error.message);if(attempt===2)throw error;await sleep(10000);}
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
