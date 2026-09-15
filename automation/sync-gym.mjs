import fs from 'node:fs/promises';
import { JWT } from 'google-auth-library';
import { campaignFromLedger } from './gym-ledger.mjs';
const file=new URL('../data/gym-campaign.json',import.meta.url);
async function main(){
 const raw=process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
 if(!raw) throw new Error('Falta la cuenta de servicio del club');
 let key; try{key=JSON.parse(raw);}catch{try{key=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));}catch{throw new Error('Formato de cuenta de servicio inválido');}}
 if(process.env.GYM_IDENTITY_ONLY==='true') { console.log(`Gym reader account: ${key.client_email}`); return; }
 if(process.env.GYM_ENABLE_SHEETS_API==='true') {
   const setup=new JWT({email:key.client_email,key:key.private_key,scopes:['https://www.googleapis.com/auth/cloud-platform']});
   const project=await setup.request({url:`https://cloudresourcemanager.googleapis.com/v1/projects/${key.project_id}`,timeout:20000});
   const enabled=await setup.request({url:`https://serviceusage.googleapis.com/v1/projects/${project.data.projectNumber}/services/sheets.googleapis.com:enable`,method:'POST',data:{},timeout:20000});
   console.log(`Gym: habilitación de Sheets solicitada; operación ${enabled.data.done?'completa':'en curso'}`);
 }
 const auth=new JWT({email:key.client_email,key:key.private_key,scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']});
 const spreadsheet='1jzX_XhiafqddsVbZIn1qii0HCGWxIUnPdvIs_8mdyFE';
 const result=await auth.request({url:`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet}/values:batchGet`,params:{ranges:["'Resumen'!A4:B10","'Ladrillos'!A1:I61"],valueRenderOption:'UNFORMATTED_VALUE'},timeout:20000});
 const values=result.data.valueRanges;
 const live=campaignFromLedger(values?.[0]?.values,values?.[1]?.values);
 const previous=JSON.parse(await fs.readFile(file,'utf8'));
 const changed=Object.keys(live).some(k=>JSON.stringify(live[k])!==JSON.stringify(previous[k]));
 if(!changed){console.log('Gym: sin cambios');return;}
 const output={...previous,...live,sourceUrl:'',dataSource:'google-sheets',updatedAt:new Date().toISOString()};
 await fs.writeFile(file,JSON.stringify(output,null,2)+'\n');
 console.log(`Gym: datos públicos actualizados. ${live.brickProgress.filter(n=>n>0).length} aportes confirmados.`);
}
main().catch(error=>{
 // Gaxios errors can contain authentication headers. Never log the error object.
 const api=error.response?.data?.error;
 if(api) console.error(`Gym: Google HTTP ${error.response.status}; ${api.status||'error'}; ${api.details?.find(d=>d.reason)?.reason||''}`);
 else console.error(`Gym: ${error.response?'falló la autenticación con Google':error.message}`);
 process.exitCode=1;
});
