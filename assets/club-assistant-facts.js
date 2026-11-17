import {searchText} from './search-model.js?v=20261117';
const generic=new Set(['a','al','ante','como','con','cual','cuales','cuando','cuanta','cuantas','cuanto','cuantos','de','del','el','ella','en','es','esta','estan','este','hay','hace','hacer','info','informacion','la','las','lo','los','me','mi','para','por','puedo','que','quien','quienes','quiero','se','son','su','sus','tiene','tienen','un','una','y','ceibos','club','pagina','web','saber','sobre']);
const aliases={fundacion:['fundo','fundado','fundada','nacio','creo','fundacion','nacimiento'],ubicacion:['donde','direccion','ubicacion','queda','llegar','camino'],entrenamiento:['entrena','entrenan','entrenar','entrenamientos','entrenamiento','practica'],tienda:['shop','tienda','ropa','indumentaria','comprar','camisetas','camiseta','musculosa','remera'],socios:['socios','socio','cuota','cuotas','pagos','pago','pagar'],basquet:['basketball','basket','basquet','basquetbol'],entrenador:['entrenador','entrenadores','tecnico','tecnica','dirige'],talle:['talles','talle'],precio:['precio','precios','cuesta','costo','vale','sale'],lema:['lema','significa','significado'],solidario:['solidaria','solidario','solidarias','solidarios']};
function normalizeToken(token){if(['gym','gimnasio'].includes(token))return 'gimnasio';if(['mide','metros','area','superficie','tamano'].includes(token))return 'dimension';if(['gano','campeon','campeona','campeones','campeonas'].includes(token))return 'campeon';for(const [key,values]of Object.entries(aliases))if(values.includes(token))return key;return token;}
const tokens=text=>searchText(text).split(' ').filter(t=>t&&!generic.has(t)).map(normalizeToken);
const strict=new Set(['entrenamiento','entrenador','talle','precio']);
const matches=(a,b)=>a===b||(!/\d/.test(a+b)&&a.length>=5&&b.length>=5&&a.slice(0,5)===b.slice(0,5));

export function answerChampionQuestion(question,facts=[],now=Date.now()){
 const q=searchText(question),records=facts.filter(f=>f.champion&&f.text&&f.href),mentioned=records.filter(f=>(' '+q+' ').includes(' '+searchText(f.champion.team)+' '));
 const intent=/\b(campeon|campeona|campeones|campeonas|ganador|ganadores|ganadoras)\b/.test(q)||/\bgano\b/.test(q)&&/\b(interno|copa|oro|plata|bronce|cobre|lata)\b/.test(q);
 if(!intent||!/\binterno\b/.test(q)&&!mentioned.length||/\b(cuantos|cuantas|cantidad|partido|partidos|goles|resultado|resultados|marcador|juega|juegan)\b/.test(q))return null;
 if(!records.length)return {text:'No tengo ese campeón publicado para la consulta. Podés revisar la información del Interno.',items:[{label:'Ver Interno',href:'#interno',text:''}],choices:[],context:{},intent:'information'};
 const year=q.match(/\b(?:19|20)\d{2}\b/)?.[0],currentYear=Number(new Intl.DateTimeFormat('en',{timeZone:'America/Montevideo',year:'numeric'}).format(now)),relative=/\b(ano|temporada) (pasado|pasada|anterior)\b/.test(q)?currentYear-1:/\b(este ano|esta temporada|edicion actual)\b/.test(q)?currentYear:null,latest=Math.max(...records.map(f=>f.champion.year)),edition=year?Number(year):relative??(Number.isFinite(latest)?latest:null);
 if(!edition)return null;
 const category=/\bfemenin[oa]s?\b|\bcampeona\b/.test(q)?'femenino':/\bmasculin[oa]s?\b/.test(q)?'masculino':/\bpapi\b|\b38\b/.test(q)?'papi':null,cup=q.match(/\b(oro|plata|bronce|cobre|lata)\b/)?.[0],allCups=/\b(campeones|campeonas|ganadores|ganadoras|todas|cada copa)\b/.test(q),wantedCup=cup||(!allCups&&!mentioned.length?'oro':null);
 const selected=records.filter(f=>f.champion.year===edition&&(!category||f.champion.categoryId===category)&&(!wantedCup||searchText(f.champion.cup)===wantedCup)&&(!mentioned.length||mentioned.some(m=>m.champion.team===f.champion.team)));
 const unique=[...new Map(selected.map(f=>[f.champion.categoryId+'|'+f.champion.cup+'|'+f.champion.team,f])).values()],href=(unique[0]||records.find(f=>f.champion.year===edition)||records[0]).href;
 const text=unique.length===1?unique[0].text:unique.length?'Campeones del Interno '+edition+':\n'+unique.map(f=>f.champion.category+' · '+f.champion.cup+': '+f.champion.team+'.').join('\n'):'No tengo un campeón publicado del Interno '+edition+' para esa categoría o copa.';
 return {text,items:[{label:'Ver campeones del Interno',href,text:''}],choices:[],context:{},intent:'information'};
}

export function retrieveClubFacts(question,facts=[],limit=3){
 let query=[...new Set(tokens(question))];if(query.includes('tienda'))query=query.filter(t=>t!=='ubicacion');if(!query.length)return [];
 const ranked=facts.flatMap(fact=>{
  if(!fact.text||!fact.href||!/^#|^\/(?!\/)|^\?/.test(fact.href))return [];
  if(query.includes('papi')&&fact.scope==='mf')return [];
  if(query.includes('tienda')&&!/^#(?:shop|socios)(?:$|\/)/.test(fact.href)&&!(/\b(tienda|bulk|indumentaria|comprar|shop)\b/.test(searchText(fact.text))))return [];
  const title=tokens(fact.title||''),body=tokens(fact.text),all=[...title,...body,...tokens(fact.keywords||'')];
  if(query.some(t=>strict.has(t)&&!all.some(word=>matches(t,word))))return [];
  if(query.some(t=>/^\d+$/.test(t)&&!all.includes(t)))return [];
  const hits=query.filter(t=>all.some(word=>matches(t,word)));if(!hits.length)return [];
  if(hits.length<Math.min(query.length,2))return [];
  const score=hits.length/query.length*100+hits.reduce((s,t)=>s+(title.some(word=>matches(t,word))?20:0),0)+(query.includes('tienda')&&/\b(bulk|tienda)\b/.test(searchText(fact.text))?25:0)-(body.length>120?8:0);
  return [{...fact,score}];
 }).sort((a,b)=>b.score-a.score||a.text.length-b.text.length);
 const seen=new Set();return ranked.filter(row=>{const key=searchText(row.text);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit);
}
