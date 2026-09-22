import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
async function main(){
 const raw=process.env.FIREBASE_SERVICE_ACCOUNT?.trim();if(!raw)throw Error('Falta cuenta de servicio');
 let key;try{key=JSON.parse(raw);}catch{key=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));}
 const db=getFirestore(initializeApp({credential:cert(key)}));let count=0;
 while(true){const old=await db.collection('analyticsVisits').where('expiresAt','<',Timestamp.now()).limit(400).get();if(old.empty)break;const batch=db.batch();old.docs.forEach(d=>batch.delete(d.ref));await batch.commit();count+=old.size;}
 console.log(`Estadísticas: ${count} registros vencidos eliminados.`);
}
main().catch(()=>{console.error('No se pudo completar la limpieza de estadísticas.');process.exitCode=1;});
