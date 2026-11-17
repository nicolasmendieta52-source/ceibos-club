import {searchText} from './search-model.js?v=20261117';

export const fold=searchText;
const corrections={partidso:'partidos',partdos:'partidos',partidoso:'partidos',partdios:'partidos',resreva:'reserva',resrva:'reserva',recaudnado:'recaudando',recuadado:'recaudado',recaduado:'recaudado',goleadore:'goleadores',goleadro:'goleador',proximso:'proximos',proxmo:'proximo',canhca:'cancha',canhcas:'canchas',fehca:'fecha',cuatnos:'cuantos',cuatno:'cuanto',setiembre:'septiembre',basketbol:'basketball'};
export function normalizeClubQuestion(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
  .replace(/\b[a-z]+\b/g,word=>corrections[word]||word)
  .replace(/\b(?:me podes decir|me podrias decir|podrias decirme|necesito saber|quisiera saber|quiero saber|decime|contame|che)\b/g,' ')
  .replace(/\besta noche\b/g,'hoy').replace(/\bvs\.?\b/g,'contra').replace(/\s+/g,' ').replace(/^[,;:\s]+/,'').trim().slice(0,300);
}

export function editDistance(a,b){
 const rows=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)rows[i][0]=i;for(let j=0;j<=b.length;j++)rows[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
 }
 return rows[a.length][b.length];
}

const entityStop=new Set(('quien quienes cuando cuanto cuantos cuantas contra juega juegan jugar partido partidos resultado resultados proximo proximos ultimo ultimos horario horarios fecha manana pasado hoy ayer semana viene sabado domingo lunes martes miercoles jueves viernes cancha canchas donde grupo grupos equipo equipos interno futbol masculino femenino tabla tablas puntos posicion posiciones puesto gano ganados perdio perdidos empato empates victorias derrotas goles goleador goleadores anotadores primero esta este tiene quiero saber favor gracias que como para todos todas lleva balance temporada ano casa visitante local falta faltan quedan recaudacion pesos dolares acumulado cuantos').split(' '));
export function teamCandidates(question,data){
 if(!data?.teams?.length)return {teams:[],approximate:false,mention:''};
 const q=' '+fold(question)+' ',exact=data.teams.filter(t=>{const name=fold(t.name);if(name==='la fecha')return [...q.matchAll(/\bla fecha\b/g)].some(m=>!/^ (?:del?|para|que|en que)\b/.test(q.slice(m.index+m[0].length)));return q.includes(' '+name+' ');});
 if(exact.length)return {teams:exact,approximate:false,mention:exact.length===1?fold(exact[0].name):''};
 const aliases=[];
 for(const team of data.teams){
  const name=fold(team.name),short=name.replace(/^(?:la|el|los|las) /,'');
  if(short!==name&&short.length>=4)aliases.push({team,alias:short});
  if(name==='rapineros')aliases.push({team,alias:'rapi'});
  if(name==='los fishermans')aliases.push({team,alias:'fisherman'});
  for(const word of name.split(' '))if(word.length>=4&&!entityStop.has(word))aliases.push({team,alias:word});
 }
 const direct=aliases.filter(a=>q.includes(' '+a.alias+' '));
 if(direct.length){const longest=Math.max(...direct.map(a=>a.alias.length)),best=direct.filter(a=>a.alias.length===longest);return {teams:[...new Map(best.map(a=>[a.team.id,a.team])).values()],approximate:false,mention:best[0].alias};}
 const tokens=fold(question).split(' ').filter(w=>w.length>=5&&!entityStop.has(w)&&!/^\d+$/.test(w)),found=[];
 for(const token of tokens)for(const alias of aliases)if(alias.alias.length>=5&&!alias.alias.includes(' ')&&Math.abs(token.length-alias.alias.length)<=1&&editDistance(token,alias.alias)<=1)found.push({...alias,token});
 return {teams:[...new Map(found.map(a=>[a.team.id,a.team])).values()],approximate:found.length>0,mention:found[0]?.token||''};
}

export function canonicalTeamQuestion(question,mention,team){
 const q=fold(question),name=fold(team.name),needle=fold(mention);
 if(needle&&(' '+q+' ').includes(' '+needle+' '))return (' '+normalizeClubQuestion(question)+' ').replace(new RegExp('(^|\\s)'+needle+'(?=\\s|[?.,!]|$)'),(_,before)=>before+name).trim();
 return question+' de '+team.name;
}

export function questionTopic(question){
 const q=fold(question);
 if(/\b(gym|gimnasio|ladrillo|ladrillos|recaudacion|recaudado|recaudando)\b/.test(q))return 'gym';
 if(/\b(cena|fiesta|cmc|evento|eventos)\b/.test(q))return 'events';
 if(/\b(tienda|ropa|camiseta|remera|indumentaria|shop|bulk)\b/.test(q))return 'shop';
 if(/\b(entrena|entrenamiento|entrenamientos|entrenador|tecnico)\b/.test(q))return 'training';
 if(/\b(interno|grupo|grupos|rapineros)\b/.test(q))return 'interno';
 if(/\b(partido|partidos|resultado|resultados|juega|gano|perdio|empato|goleador|goleadores|puntos|posicion|tabla|balance)\b/.test(q))return 'sports';
 if(/\b(historia|fundo|fundacion|nacio|lema|totus|tuus|predio|direccion|ubicacion|contacto|socios|socio|noticias|solidario)\b/.test(q))return 'club';
 return null;
}
