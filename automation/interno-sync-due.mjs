import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function internoSyncDue(data,now=Date.now()){
  const last=Date.parse(data?.sourceInfo?.checkedAt||data?.sourceInfo?.importedAt||'');
  return !Number.isFinite(last)||last>now||Math.floor(last/3600000)<Math.floor(now/3600000);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const data=JSON.parse(await fs.readFile(new URL('../data/interno.json',import.meta.url),'utf8'));
  const due=process.env.GITHUB_EVENT_NAME!=='schedule'||internoSyncDue(data);
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'due='+due+'\n');
  console.log(due?'Interno: corresponde una lectura de la fuente.':'Interno: lectura verificada hace menos de una hora; se evita una consulta duplicada.');
}
