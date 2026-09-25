import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignFromLedger} from './gym-ledger.mjs';
const fixture=()=>({summary:[['Recaudado (USD)',87450],['Meta (USD)',200000],['Avance',0],['Faltan (USD)',0],['Ladrillos',100],['Saldo inicial (USD)',87450],['Pagos nuevos confirmados (USD)',0]],rows:[['Ladrillo','Nombre público','Objetivo USD','Pagado USD','Estado','Incluido en saldo inicial','Fecha del pago','Notas privadas','Tipo'],...Array.from({length:100},(_,i)=>[i+1,'',1000,'','Pendiente','No','','','Aportante'])]});
test('pago global de sponsors suma una vez y las empresas ocupan sus lugares',()=>{
 const {summary,rows}=fixture();rows[1]=[1,'Sponsors',30000,30000,'Pendiente','No','','','Sponsor'];summary[0][1]+=30000;
 const m=campaignFromLedger(summary,rows,[['FNC'],['ACSA']]);
 assert.equal(m.raised,117450);assert.equal(m.brickSponsors.filter(Boolean).length,0);
 assert.deepEqual(m.sponsors,['FNC','ACSA']);assert.ok(m.brickLabels.every(n=>!n));assert.ok(!m.brickLabels.includes('Sponsors'));
});
test('no publica planes ni precios cuando reemplazan accidentalmente un nombre',()=>{
 const {summary,rows}=fixture();rows[1]=[1,'Individual (2 años) = USD 1.080',1080,1080,'Pendiente','No','','','Aportante'];summary[0][1]+=1080;
 const m=campaignFromLedger(summary,rows);assert.equal(m.raised,88530);assert.equal(m.brickLabels[0],'Aportante');
});
test('sponsors pendientes se muestran sin sumar y las cuotas se actualizan sin duplicarse',()=>{
 const {summary,rows}=fixture(); rows[1]=[1,'Sponsor',5000,'','Pendiente','No','','privado','Sponsor'];
 let m=campaignFromLedger(summary,rows);assert.equal(m.raised,87450);assert.equal(m.brickLabels[0],'');assert.deepEqual(m.sponsors,['Sponsor']);assert.equal(m.brickSponsors[0],false);assert.equal(m.brickProgress[0],0);
 rows[2]=[2,'Ana',1000,250,'Confirmado','No','','secreto','Aportante'];summary[0][1]=87700;
 m=campaignFromLedger(summary,rows);assert.equal(m.brickProgress[1],.25);assert.equal(m.raised,87700);assert.ok(!JSON.stringify(m).includes('secreto'));
 rows[2][3]=1000;summary[0][1]=88450;assert.equal(campaignFromLedger(summary,rows).raised,88450);
 rows[2][5]='Sí';summary[0][1]=87450;assert.equal(campaignFromLedger(summary,rows).raised,87450);
 assert.deepEqual(campaignFromLedger(summary,[rows[0],...rows.slice(1).reverse()]),campaignFromLedger(summary,rows));
});
test('rechaza datos incompletos, duplicados y diferencias de totales',()=>{
 for(const mutate of [r=>r.pop(),r=>r[2][0]=1,r=>r[1][3]=-1,r=>r[1][8]='Inválido',r=>{r[1][4]='Confirmado';r[1][3]=10;}]){
 const {summary,rows}=fixture();mutate(rows);assert.throws(()=>campaignFromLedger(summary,rows));
 }
});

test('todo importe anotado cuenta independientemente del estado, sin duplicar saldo inicial',()=>{
 const {summary,rows}=fixture();
 rows[1]=[1,'Ana',1000,500,'Pendiente','No','','','Aportante'];
 summary[0][1]=87950;
 const paid=campaignFromLedger(summary,rows);
 assert.equal(paid.raised,87950);assert.equal(paid.brickLabels[0],'Ana');assert.equal(paid.brickProgress[0],.5);
 for(const state of ['Confirmado','','Pagado']){rows[1][4]=state;assert.deepEqual(campaignFromLedger(summary,rows),paid);}
 rows[1][5]='Sí';summary[0][1]=87450;assert.equal(campaignFromLedger(summary,rows).raised,87450);
 rows[1][5]='No';rows[1][3]='';assert.equal(campaignFromLedger(summary,rows).brickLabels[0],'');
 rows[1][3]=0;assert.equal(campaignFromLedger(summary,rows).raised,87450);
});

test('integra Sponsors sin sumar pendientes, duplicar empresas ni ocupar filas con personas',()=>{
 const {summary,rows}=fixture();
 rows[1][1]='Persona pendiente';
 rows[2]=[2,'FNC',5000,1000,'Confirmado','No','','nota privada','Sponsor'];
 summary[0][1]=88450;
 const m=campaignFromLedger(summary,rows,[['FNC'],['CATIVELLI'],[' fnc '],[],['FIXED']]);
 assert.equal(m.raised,88450);
 assert.equal(m.brickLabels[0],'');
 assert.equal(m.brickLabels[1],'');
 assert.equal(m.brickProgress[1],0);
 assert.equal(m.brickLabels[2],'');
 assert.equal(m.brickProgress[2],0);
 assert.equal(m.brickLabels[3],'');assert.deepEqual(m.sponsors,['FNC','CATIVELLI','FIXED']);
 assert.equal(m.brickSponsors.filter(Boolean).length,0);
 assert.deepEqual(campaignFromLedger(summary,[rows[0],...rows.slice(1).reverse()],[['FNC'],['CATIVELLI'],['FIXED']]),m);
 assert.throws(()=>campaignFromLedger(summary,rows,[['#REF!']]));
 for(const row of rows.slice(1)) row[1] ||= 'Nombre reservado';
 assert.ok(campaignFromLedger(summary,rows,[['Empresa nueva']]).sponsors.includes('Empresa nueva'));
});
