import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignFromLedger} from './gym-ledger.mjs';
const fixture=()=>({summary:[['Recaudado (USD)',87450],['Meta (USD)',200000],['Avance',0],['Faltan (USD)',0],['Ladrillos',60],['Saldo inicial (USD)',87450],['Pagos nuevos confirmados (USD)',0]],rows:[['Ladrillo','Nombre público','Objetivo USD','Pagado USD','Estado','Incluido en saldo inicial','Fecha del pago','Notas privadas','Tipo'],...Array.from({length:60},(_,i)=>[i+1,'',1000,'','Pendiente','No','','','Aportante'])]});
test('sponsors pendientes se muestran sin sumar y las cuotas se actualizan sin duplicarse',()=>{
 const {summary,rows}=fixture(); rows[1]=[1,'Sponsor',5000,'','Pendiente','No','','privado','Sponsor'];
 let m=campaignFromLedger(summary,rows);assert.equal(m.raised,87450);assert.equal(m.brickLabels[0],'Sponsor');assert.equal(m.brickSponsors[0],true);assert.equal(m.brickProgress[0],0);
 rows[2]=[2,'Ana',1000,250,'Confirmado','No','','secreto','Aportante'];summary[0][1]=87700;
 m=campaignFromLedger(summary,rows);assert.equal(m.brickProgress[1],.25);assert.equal(m.raised,87700);assert.ok(!JSON.stringify(m).includes('secreto'));
 rows[2][3]=1000;summary[0][1]=88450;assert.equal(campaignFromLedger(summary,rows).raised,88450);
 rows[2][5]='Sí';summary[0][1]=87450;assert.equal(campaignFromLedger(summary,rows).raised,87450);
 assert.deepEqual(campaignFromLedger(summary,[rows[0],...rows.slice(1).reverse()]),campaignFromLedger(summary,rows));
});
test('rechaza datos incompletos, duplicados y diferencias de totales',()=>{
 for(const mutate of [r=>r.pop(),r=>r[2][0]=1,r=>r[1][3]=-1,r=>r[1][4]='Pagado',r=>{r[1][4]='Confirmado';r[1][3]=10;},r=>{r[1][4]='Confirmado';}]){
 const {summary,rows}=fixture();mutate(rows);assert.throws(()=>campaignFromLedger(summary,rows));
 }
});

test('integra Sponsors sin sumar pendientes, duplicar empresas ni ocupar filas con personas',()=>{
 const {summary,rows}=fixture();
 rows[1][1]='Persona pendiente';
 rows[2]=[2,'FNC',5000,1000,'Confirmado','No','','nota privada','Sponsor'];
 summary[0][1]=88450;
 const m=campaignFromLedger(summary,rows,[['FNC'],['CATIVELLI'],[' fnc '],[],['FIXED']]);
 assert.equal(m.raised,88450);
 assert.equal(m.brickLabels[0],'');
 assert.equal(m.brickLabels[1],'FNC');
 assert.equal(m.brickProgress[1],.2);
 assert.equal(m.brickLabels[2],'CATIVELLI');
 assert.equal(m.brickProgress[2],0);
 assert.equal(m.brickLabels[3],'FIXED');
 assert.equal(m.brickSponsors.filter(Boolean).length,3);
 assert.deepEqual(campaignFromLedger(summary,[rows[0],...rows.slice(1).reverse()],[['FNC'],['CATIVELLI'],['FIXED']]),m);
 assert.throws(()=>campaignFromLedger(summary,rows,[['#REF!']]));
 for(const row of rows.slice(1)) row[1] ||= 'Nombre reservado';
 assert.throws(()=>campaignFromLedger(summary,rows,[['Empresa nueva']]),/lugares libres/);
});
