import test from 'node:test';
import assert from 'node:assert/strict';
import {initCampaign,campaignModel,campaignSnapshot,SEEN_BRICKS_KEY} from '../assets/gym-campaign.js';

// Exercise the real renderer and observer callbacks without controlling a user's browser.
class Element extends EventTarget {
  constructor(){super();this.children=[];this.attributes=new Map();this.classes=new Set();this.textContent='';this.style={setProperty(){}};}
  get className(){return [...this.classes].join(' ');}
  set className(value){this.classes=new Set(value.split(/\s+/).filter(Boolean));}
  get classList(){const s=this.classes;return {add:n=>s.add(n),remove:n=>s.delete(n),contains:n=>s.has(n),toggle:(n,on)=>on?s.add(n):s.delete(n)};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  removeAttribute(name){this.attributes.delete(name);}
  querySelector(selector){return this.children.find(n=>n.classList.contains(selector.slice(1)));}
}
const data=count=>({goal:225000,raised:count*1000,sourceUrl:'',sponsors:[],contributionUrl:'https://example.com/form',
  brickLabels:Array.from({length:100},(_,i)=>i<count?'Aportante '+i:''),brickProgress:Array.from({length:100},(_,i)=>i<count?1:0)});
const snapshot=count=>JSON.stringify(campaignSnapshot(campaignModel(data(count))));
function root(){const fields=new Map();return {fields,querySelector(selector){const key=selector.match(/data-gym-([\w-]+)/)[1];if(!fields.has(key))fields.set(key,new Element());return fields.get(key);}};}
async function ready(){for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));}
function environment(t,{saved=null,reduced=false,blocked=false}={}){
  const previous=Object.fromEntries(['window','document','IntersectionObserver'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const store=new Map(saved?[[SEEN_BRICKS_KEY,saved]]:[]),observers=[];
  const win=new EventTarget(),doc=new EventTarget(),motion=new EventTarget();motion.matches=reduced;
  win.matchMedia=()=>motion;win.setInterval=()=>1;win.clearInterval=()=>{};
  win.localStorage={getItem:k=>{if(blocked)throw Error('Storage disabled');return store.get(k)??null;},setItem:(k,v)=>{if(blocked)throw Error('Storage disabled');store.set(k,v);}};
  doc.hidden=false;doc.createElement=()=>new Element();
  class Observer {
    constructor(callback,options){this.callback=callback;this.options=options;this.targets=[];observers.push(this);}
    observe(target){this.targets.push(target);}
    disconnect(){this.targets=[];}
    reveal(indices,ratio=1){this.callback(indices.map(i=>({target:this.targets[i],isIntersecting:ratio>0,intersectionRatio:ratio})));}
  }
  Object.assign(globalThis,{window:win,document:doc,IntersectionObserver:Observer});
  t.after(()=>{for(const [key,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  let source=data(72);
  t.mock.method(globalThis,'fetch',async url=>{if(!url.startsWith('/data/'))throw Error('Source unavailable');return Response.json(source);});
  return {store,observers,motion,setSource:value=>{source=value;},update:value=>win.dispatchEvent(new CustomEvent('ceibos:gym-update',{detail:value}))};
}
const placing=host=>host.fields.get('wall').children.flatMap((brick,i)=>brick.classList.contains('is-placing')?[i]:[]);
function finish(host){for(const brick of host.fields.get('wall').children)brick.dispatchEvent(new Event('animationend'));}

test('nuevos aportes esperan a estar visibles, se animan una vez y no se repiten al reabrir',async t=>{
  const env=environment(t,{saved:snapshot(70)}),host=root();
  const stop=initCampaign(host);await ready();
  assert.deepEqual(placing(host),[]);
  assert.match(host.fields.get('wall-summary').textContent,/2 nuevos desde tu última visita/);
  env.observers[0].reveal([70],.2);assert.deepEqual(placing(host),[],'no iniciar por una fracción apenas visible');
  env.observers[0].reveal([70,71]);assert.deepEqual(placing(host),[70,71]);
  finish(host);env.observers[0].reveal([70,71],0);env.observers[0].reveal([70,71]);assert.deepEqual(placing(host),[]);
  env.setSource(data(73));env.update(data(73));assert.deepEqual(placing(host),[]);
  env.observers[0].reveal([72]);assert.deepEqual(placing(host),[72]);stop();
  const reopened=root(),stopAgain=initCampaign(reopened);await ready();
  env.observers[1].reveal([70,71,72]);assert.deepEqual(placing(reopened),[]);
  assert.ok(!env.store.get(SEEN_BRICKS_KEY).includes('Aportante'));stopAgain();
});

test('primera visita anima los ocupados; movimiento reducido conserva los datos sin animar',async t=>{
  const env=environment(t,{reduced:true}),host=root();env.setSource(data(3));
  const stop=initCampaign(host);await ready();env.observers[0].reveal([0,1,2,3]);
  assert.deepEqual(placing(host),[]);assert.match(host.fields.get('wall-summary').textContent,/3 de 100/);
  env.motion.matches=false;env.motion.dispatchEvent(new Event('change'));
  env.observers[0].reveal([0,1,2]);assert.deepEqual(placing(host),[],'no reproducir después los movimientos omitidos');stop();
});

test('sin almacenamiento funciona la entrada y solo anima los cambios durante esa visita',async t=>{
  const env=environment(t,{blocked:true}),host=root();env.setSource(data(3));
  const stop=initCampaign(host);await ready();env.observers[0].reveal([0,1,2,3]);
  assert.deepEqual(placing(host),[0,1,2]);finish(host);
  env.update(data(4));assert.deepEqual(placing(host),[3]);finish(host);
  env.observers[0].reveal([0,1,2,3]);assert.deepEqual(placing(host),[]);stop();
});

test('un fallo de Sheets no reemplaza el recuerdo reciente por un respaldo antiguo',async t=>{
  const saved=snapshot(72),env=environment(t,{saved}),host=root();
  env.setSource({...data(70),sourceUrl:'https://source.example/campaign.json'});
  const stop=initCampaign(host);await ready();env.observers[0].reveal([0,1,69,70,71]);
  assert.equal(env.store.get(SEEN_BRICKS_KEY),saved);assert.deepEqual(placing(host),[]);
  assert.match(host.fields.get('status').textContent,/último dato disponible/);stop();
});
