import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignModel, contributionLink, campaignFromCsv, BRICK_COUNT, brickPosition, brickLayout, campaignSnapshot, readCampaignSnapshot, newBrickIndices } from '../assets/gym-campaign.js';

const wallModel = count => campaignModel({goal:225000,raised:count*1000,
  brickLabels:Array.from({length:100},(_,i)=>i<count?`Aportante ${i+1}`:''),
  brickProgress:Array.from({length:100},(_,i)=>i<count?1:0)});

test('al volver, detecta solo ladrillos nuevos y no repite la entrada de los ya conocidos',()=>{
 const previous=campaignSnapshot(wallModel(70));
 const current=wallModel(72);
 assert.deepEqual(newBrickIndices(previous,current),[70,71]);
 assert.deepEqual(newBrickIndices(campaignSnapshot(current),current),[]);
 assert.deepEqual(newBrickIndices(null,wallModel(3)),[0,1,2]);
 assert.deepEqual(newBrickIndices(null,wallModel(0)),[]);
 current.brickLabels[0]='Nombre corregido';
 assert.deepEqual(newBrickIndices(campaignSnapshot(wallModel(72)),current),[]);
});

test('anima un aporte parcial nuevo, pero no una corrección a la baja ni diferencias de redondeo',()=>{
 const current=wallModel(2);current.fills[1]=.5;
 const previous=campaignSnapshot(current);
 current.fills[1]=.75;
 assert.deepEqual(newBrickIndices(previous,current),[1]);
 current.fills[1]=.25;assert.deepEqual(newBrickIndices(previous,current),[]);
 current.fills[1]=.5000000001;assert.deepEqual(newBrickIndices(previous,current),[]);
 current.brickLabels[80]='Aportante registrado';
 assert.deepEqual(newBrickIndices(previous,current),[80]);
});

test('el recuerdo local guarda solo ocupación y avance, y descarta versiones o datos inválidos',()=>{
 const snapshot=campaignSnapshot(wallModel(70));
 const raw=JSON.stringify(snapshot);
 assert.ok(!raw.includes('Aportante'));assert.deepEqual(Object.keys(snapshot).sort(),['fills','occupied','version']);
 assert.deepEqual(readCampaignSnapshot(raw),snapshot);
 for(const value of [null,'invalid','{}',JSON.stringify({...snapshot,version:2}),JSON.stringify({...snapshot,fills:[1]}),JSON.stringify({...snapshot,fills:Array(100).fill(2)}),JSON.stringify({...snapshot,occupied:Array(100).fill('sí')})])assert.equal(readCampaignSnapshot(value),null);
});

test('separa sponsors de snapshots anteriores y reserva los 100 ladrillos para aportantes', () => {
  const data={goal:200000,raised:57260,brickSponsors:Array(100).fill(false),brickLabels:Array(100).fill(''),brickProgress:Array(100).fill(0)};
  for(let i=0;i<40;i++){data.brickLabels[i]='Persona '+i;data.brickProgress[i]=1;}
  for(let i=40;i<52;i++){data.brickLabels[i]='Sponsor '+i;data.brickSponsors[i]=true;data.brickProgress[i]=1;}
  const model=campaignModel(data);
  assert.equal(model.sponsors.length,12);assert.equal(model.brickLabels.filter(Boolean).length,40);
  assert.equal(model.fills.filter(n=>n>0).length,40);assert.equal(model.raised,57260);
  for(const columns of [10,5]) {
    const layout=brickLayout(model,columns);
    assert.equal(new Set(layout.map(p=>p.row+'/'+p.column)).size,100);
    assert.deepEqual(layout[0],{row:100/columns,column:1});
    assert.deepEqual(layout[39],{row:100/columns-Math.floor(39/columns),column:39%columns+1});
  }
  assert.equal(data.brickLabels[40],'Sponsor 40');
});

test('pared vacía o llena conserva 100 posiciones incluso si no hay espacio entre grupos', () => {
  for(const columns of [10,5])for(const count of [0,12,99,100]){
    const data={brickSponsors:Array.from({length:100},(_,i)=>i<count),brickLabels:Array(100).fill('Nombre')};
    const positions=brickLayout(data,columns);
    assert.equal(new Set(positions.map(p=>`${p.row}/${p.column}`)).size,100);
    assert.ok(positions.every(p=>p.row>=1&&p.row<=100/columns&&p.column>=1&&p.column<=columns));
  }
});

test('los sponsors pendientes conservan importe cero y el avance individual cambia con cada pago', () => {
  const data={goal:200000,raised:500,brickProgress:Array(100).fill(0),brickSponsors:Array(100).fill(false)};
  data.brickSponsors[30]=true;
  data.brickProgress[0]=.5;
  assert.equal(campaignModel(data).fills[30],0);
  assert.equal(campaignModel(data).fills[0],.5);
  assert.equal(campaignModel(data).percent,.25);
  data.brickProgress[0]=1;
  assert.equal(campaignModel({...data,raised:1000}).fills[0],1);
  for (const bad of [[0],Array(100).fill(NaN),Array(100).fill(-1),Array(100).fill(2)]) assert.throws(()=>campaignModel({...data,brickProgress:bad}));
  assert.throws(()=>campaignModel({...data,brickSponsors:Array(100).fill('Sponsor')}));
});

test('los 100 ladrillos suben desde la base de izquierda a derecha en desktop y móvil', () => {
  for(const columns of [10,5]) {
    assert.deepEqual(brickPosition(0,columns),{row:100/columns,column:1});
    assert.deepEqual(brickPosition(columns,columns),{row:100/columns-1,column:1});
    assert.deepEqual(brickPosition(99,columns),{row:1,column:columns});
    assert.equal(new Set(Array.from({length:100},(_,i)=>JSON.stringify(brickPosition(i,columns)))).size,100);
  }
});

test('el monto real llena 43 de 100 ladrillos y el 72,5% del siguiente', () => {
  const model = campaignModel({ goal: 200000, raised: 87450 });
  assert.equal(model.remaining, 112550);
  assert.equal(model.brickValue, 200000 / 100);
  assert.equal(model.fills.length, 100);
  assert.equal(model.fills.filter(fill => fill === 1).length, 43);
  assert.ok(Math.abs(model.fills[43] - .725) < 1e-10);
  assert.ok(Math.abs(model.percent - 43.725) < 1e-10);
  assert.ok(Math.abs(model.fills.reduce((sum, fill) => sum + fill, 0) * model.brickValue - 87450) < 1e-8);
});

test('cero, meta alcanzada y sobrepasada mantienen valores coherentes', () => {
  assert.ok(campaignModel({ goal: 200000, raised: 0 }).fills.every(fill => fill === 0));
  for (const raised of [200000, 250000]) {
    const model = campaignModel({ goal: 200000, raised });
    assert.equal(model.percent, 100);
    assert.equal(model.remaining, 0);
    assert.equal(model.raised, raised);
    assert.ok(model.fills.every(fill => fill === 1));
  }
});

test('aportes parciales, nuevos ladrillos y correcciones conservan el total', () => {
  for (const raised of [1, 1999, 2000, 87451, 89450, 80000]) {
    const model = campaignModel({ goal: 200000, raised });
    assert.ok(Math.abs(model.fills.reduce((sum, fill) => sum + fill, 0) * model.brickValue - raised) < 1e-8);
  }
});

const feed = (raised = '87450,00') => 'Campo,Valor\r\ngoal,"200000,00"\r\nraised,"'+raised+'"\r\nbrickCount,100\r\n'+
  Array.from({length:BRICK_COUNT},(_,i)=>`brick${i+1},${i===0?'"Familia Pérez, Ana y Luis"':i===99?'"Último aportante"':''}`).join('\r\n');

test('lee la fuente de Sheets con coma decimal, comillas y los 100 lugares', () => {
  const model = campaignFromCsv('\uFEFF'+feed());
  assert.equal(model.raised, 87450);
  assert.equal(model.brickLabels[0], 'Familia Pérez, Ana y Luis');
  assert.equal(model.brickLabels[1], '');
  assert.equal(model.brickLabels[99], 'Último aportante');
  assert.equal(campaignFromCsv(feed('87450.25')).raised,87450.25);
  assert.equal(campaignFromCsv(feed().replace('"Familia Pérez, Ana y Luis"','"Ana ""Lala""\nPérez"')).brickLabels[0],'Ana "Lala"\nPérez');
});

test('rechaza feeds incompletos, errores de fórmulas y montos mal formados', () => {
  for (const bad of ['<html>Iniciar sesión</html>',feed(''),feed('-10'),feed('NaN'),feed('87.450,00'),
    feed().replace('brickCount,100','brickCount,80'),feed().replace('brick100,"Último aportante"',''),
    feed()+'\r\nraised,0',feed().replace('Familia Pérez, Ana y Luis','#REF!'),feed()+'"']) {
    assert.throws(()=>campaignFromCsv(bad));
  }
});

test('la fuente directa conserva aportes parciales, sponsors separados y exige los 100 avances',()=>{
 const modern=feed()+'\r\nfeedVersion,2\r\nsponsors,"FNC\nSUBARU"\r\nupdatedAt,2026-10-26T10:00:00-03:00\r\n'+Array.from({length:100},(_,i)=>`fill${i+1},${i===0?'0.5':'0'}`).join('\r\n');
 const data=campaignFromCsv(modern);
 assert.equal(data.brickProgress[0],0.5);assert.equal(data.brickProgress[99],0);
 assert.deepEqual(data.sponsors,['FNC','SUBARU']);assert.equal(data.updatedAt,'2026-10-26T10:00:00-03:00');
 assert.throws(()=>campaignFromCsv(modern.replace('fill100,0','')));
 assert.throws(()=>campaignFromCsv(modern.replace('fill1,0.5','fill1,2')));
});

test('rechaza montos inválidos y metas que no permiten calcular progreso', () => {
  for (const data of [null, {}, { goal: 0, raised: 20 }, { goal: -1, raised: 20 },
    { goal: 200000, raised: -1 }, { goal: 200000, raised: '87450' },
    { goal: Infinity, raised: 20 }, { goal: 200000, raised: NaN }]) {
    assert.throws(() => campaignModel(data), TypeError);
  }
});

test('el formulario usa HTTPS o el contacto del club', () => {
  assert.equal(contributionLink('https://example.com/form'), 'https://example.com/form');
  for (const link of ['', undefined, 'javascript:alert(1)', 'http://example.com']) {
    assert.ok(contributionLink(link).startsWith('mailto:info@ceibosclub.com?'));
  }
});
