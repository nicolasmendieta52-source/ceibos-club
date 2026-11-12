import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';import {chromium} from 'playwright';
import {mergeInternoSource,sameInternoSnapshot,INTERNO_SOURCE,PUBLIC_SCRIPT} from './interno-source.mjs';

export async function readInternoPublic({launch=options=>chromium.launch(options),fetcher=fetch,timeoutMs=90000}={}){
  const response=await fetcher(INTERNO_SOURCE,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('La fuente del Interno no respondió: HTTP '+response.status);
  const html=await response.text(),match=html.match(/\b(?:var|let|const)\s+URL_WEB\s*=\s*(['"])(https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec)\1/);
  if(match?.[2]!==PUBLIC_SCRIPT)throw Error('Cambió la aplicación pública del Interno; revisar la fuente antes de importar');
  const executablePath=process.env.INTERNO_BROWSER_EXECUTABLE_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
  const browser=await launch({headless:true,...(executablePath?{executablePath}:{})});
  try{const page=await browser.newPage();await page.goto(PUBLIC_SCRIPT,{waitUntil:'domcontentloaded',timeout:45000});const deadline=Date.now()+timeoutMs;
    // Apps Script can document.write its template into an about:blank child.
    // Read the public application's loaded state rather than guessing an iframe URL.
    while(Date.now()<deadline){for(const frame of page.frames()){
      try{const data=await frame.evaluate(()=>typeof S!=='undefined'?S.data:null);if(data)return data;}catch{}
    }await page.waitForTimeout(1000);}throw Error('La aplicación pública no entregó los datos dentro del plazo');
  }finally{await browser.close();}
}

export async function main(){
  const file=new URL('../data/interno.json',import.meta.url),previous=JSON.parse(await fs.readFile(file,'utf8')),from=process.argv.indexOf('--from-file');let source,lastError;
  if(from>=0){if(!process.argv[from+1])throw Error('Falta el archivo de datos de prueba');source=JSON.parse(await fs.readFile(path.resolve(process.argv[from+1]),'utf8'));}
  else for(let attempt=0;attempt<3;attempt++){try{source=await readInternoPublic();break;}catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,2000));}}
  if(!source)throw lastError||Error('No se pudo leer la fuente pública');
  const output=mergeInternoSource(previous,source),dry=process.argv.includes('--dry-run')||process.env.INTERNO_SYNC_DRY_RUN==='true';
  if(sameInternoSnapshot(previous,output)){
    output.sourceInfo.importedAt=previous.sourceInfo.importedAt;
    console.log('Interno: fuente leída, sin cambios; lectura verificada '+output.sourceInfo.checkedAt+(dry?' · simulación, sin guardar.':'.'));
  }else console.log('Interno: '+output.matches.length+' partidos · '+output.teams.length+' equipos · '+output.matches.filter(match=>match.status==='finished').length+' resultados confirmados'+(dry?' · simulación, sin guardar.':'.'));
  if(dry)return;const temp=path.join(path.dirname(fileURLToPath(file)),'.interno-'+process.pid+'.tmp');
  // The output was fully validated before any write; a failed read keeps the previous snapshot.
  await fs.writeFile(temp,JSON.stringify(output,null,2)+'\n');try{await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error('Interno: '+error.message);process.exitCode=1;});
