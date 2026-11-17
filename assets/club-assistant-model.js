import {searchText,buildSearchIndex,searchIndex} from './search-model.js?v=20261117';
import {liveKickoff,matchClock,clockSettings,liveBoard} from './interno-live-clock.js?v=20261116acciones';
import {internoStandings,internoScorers} from './interno-model.js?v=20261113papi';
import {retrieveClubFacts,answerChampionQuestion} from './club-assistant-facts.js?v=20261117directa';
import {REGULATION_FACTS} from './club-assistant-regulation.js?v=20261117';
import {answerClubMatchQuery} from './club-assistant-matches.js?v=20261117interpretacion';

const zone='America/Montevideo';
const weekdays=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const money=n=>'USD '+new Intl.NumberFormat('es-UY',{maximumFractionDigits:2}).format(n);
export function clubToday(now=Date.now()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(row=>[row.type,row.value]));return p.year+'-'+p.month+'-'+p.day;
}
const addDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const dateLabel=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')?new Intl.DateTimeFormat('es-UY',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')).replace(',',''):'Fecha a confirmar';
const stamp=value=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('es-UY',{dateStyle:'short',timeStyle:'short',hourCycle:'h23',timeZone:zone}).format(new Date(value))+' h':'';
const internalUrl=(category,tab='fixture',team='',match='')=>'?internoCategoria='+encodeURIComponent(category)+'&internoTab='+tab+(team?'&internoEquipo='+encodeURIComponent(team):'')+(match?'&internoPartido='+encodeURIComponent(match):'')+'#interno';
const reply=(text,extra={})=>({text,items:[],choices:[],context:{},...extra});
const item=(label,href,text='')=>({label,href,text});
function factReply(question,facts){
 const selected=/\b(todos|todas|cuales|informacion|reglas|formato)\b/.test(searchText(question))?facts:facts.slice(0,1);
 return reply(selected[0].text,{items:selected.map((fact,i)=>item('Ver '+(fact.title||'información'),fact.href,i?fact.text:'')),intent:'information'});
}
const member=(m,id)=>m.homeId===id||m.awayId===id;
const dateSuffix=date=>date?' el '+date.slice(8)+'/'+date.slice(5,7)+'/'+date.slice(0,4):'';

export function questionDate(question,now=Date.now()){
 const q=searchText(question),today=clubToday(now),explicit=String(question).match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?\b/);
 if(explicit){const date=(explicit[3]||today.slice(0,4))+'-'+explicit[2].padStart(2,'0')+'-'+explicit[1].padStart(2,'0');const parsed=new Date(date+'T12:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?{date}:{invalid:true};}
 const named=q.replace(/\bsetiembre\b/g,'septiembre').match(new RegExp('\\b(\\d{1,2})(?: de)? ('+months.join('|')+')(?: (?:de )?(\\d{4}))?\\b'));
 if(named){const date=(named[3]||today.slice(0,4))+'-'+String(months.indexOf(named[2])+1).padStart(2,'0')+'-'+named[1].padStart(2,'0'),parsed=new Date(date+'T12:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date?{date}:{invalid:true};}
 if(/\bpasado manana\b/.test(q))return {date:addDays(today,2)};
 if(/\bmanana\b/.test(q))return {date:addDays(today,1)};
 if(/\bhoy\b/.test(q))return {date:today};if(/\bayer\b/.test(q))return {date:addDays(today,-1)};
 const day=weekdays.findIndex(name=>q.split(' ').includes(name));
 if(day>=0){const current=new Date(today+'T12:00:00Z').getUTCDay();let delta=(day-current+7)%7;if(/\bpasad[oa]\b/.test(q))delta=delta?delta-7:-7;else if(/\bproxim[oa]\b/.test(q)&&!delta)delta=7;return {date:addDays(today,delta)};}
 return {};
}

function findTeams(question,data){
 const q=' '+searchText(question)+' ',teams=data?.teams||[];
 const exact=teams.filter(team=>q.includes(' '+searchText(team.name)+' '));if(exact.length)return {teams:exact,approximate:false};
 const ignored=new Set(['deportivo','atletico','club','equipo','partido','partidos','contra','quien','cuando','juega','juegan','resultado','resultados','miercoles','proximo','manana','cancha','horario','grupo','futbol','interno']);
 const tokens=searchText(question).split(' ').filter(word=>word.length>=4&&!ignored.has(word));
 const entries=teams.map(team=>({id:team.id,title:team.name,titleText:searchText(team.name),tokens:searchText(team.name).split(' '),boost:0}));
 const direct=teams.filter(team=>tokens.some(token=>searchText(team.name).split(' ').some(word=>word.startsWith(token))));if(direct.length)return {teams:direct,approximate:direct.length!==1};
 const candidates=new Set();for(const token of tokens){const found=searchIndex(entries,token,6);if(found.approximate)for(const row of found.results)candidates.add(row.id);}
 return {teams:teams.filter(team=>candidates.has(team.id)),approximate:true};
}

function gymAnswer(q,gym){
 if(/\b(colaborar|colaboro|aportar|aporto|comprar|sumarme)\b/.test(q))return reply('En la campaña del Gym podés abrir el formulario oficial para registrar tu colaboración. El muro muestra los aportes registrados y el avance de la recaudación.',{items:[item('Colaborar con el Gym','#gym-campaign')],intent:'gym'});
 if(/\b(cuesta|precio|cuota|costo|vale|sale|mensual)\b/.test(q))return reply('No tengo una tarifa publicada para esa consulta. Podés consultar al club o abrir el formulario de colaboración.',{items:[item('Consultar al club','#contacto'),item('Ver campaña del Gym','#gym-campaign')],intent:'gym'});
 if(!gym||!Number.isFinite(gym.raised)||!Number.isFinite(gym.goal)||gym.goal<=0)return reply('Todavía no pude cargar la recaudación del gimnasio. Podés ver el estado en la campaña y volver a preguntarme en unos segundos.',{items:[item('Ver campaña del Gym','#gym-campaign')],intent:'gym',waiting:'gym'});
 const percentage=new Intl.NumberFormat('es-UY',{maximumFractionDigits:2}).format(Math.min(gym.raised/gym.goal,1)*100),remaining=Math.max(0,gym.goal-gym.raised),verified=gym.status==='live';
 if(/\bladrillos?\b/.test(q)&&/\b(cuantos|cantidad|ocupados|faltan|total)\b/.test(q)&&Number.isInteger(gym.brickCount))return reply('El muro tiene '+gym.brickCount+' ladrillos'+(Number.isInteger(gym.occupied)?': '+gym.occupied+' ocupados y '+Math.max(0,gym.brickCount-gym.occupied)+' disponibles':'.')+(verified?'.':' (último dato disponible; no pude verificar una lectura nueva).'),{items:[item('Ver muro de ladrillos','#gym-campaign')],source:gym.checkedAt?'Última lectura verificada: '+stamp(gym.checkedAt):'',intent:'gym'});
 const text=(verified?'El Gym lleva recaudados ':'El último dato disponible del Gym es ')+money(gym.raised)+', sobre una meta de '+money(gym.goal)+'. Va un '+percentage+'%'+(remaining?'; faltan '+money(remaining)+'.':'. ¡La meta está alcanzada!')+(verified?'':' No pude verificar una lectura nueva de la planilla; este importe es el último disponible.');
 return reply(text,{items:[item('Ver recaudación y ladrillos','#gym-campaign')],source:(gym.checkedAt?'Última lectura verificada: '+stamp(gym.checkedAt):gym.updatedAt?'Fecha del dato disponible: '+stamp(gym.updatedAt):'Se muestra el último dato disponible en la web.'),intent:'gym',waiting:gym.status==='loading'?'gym':undefined});
}

function describeInterno(data,match,team){
 const home=data.teams.find(t=>t.id===match.homeId),away=data.teams.find(t=>t.id===match.awayId),date=dateLabel(match.date),court=match.court&&match.venue&&match.court!==match.venue?match.venue+' · '+match.court:match.court||match.venue;
 const pair=home.name+' vs. '+away.name,details=date+(match.time?' a las '+match.time+' h':', horario a confirmar')+(court?', en '+court:', cancha a confirmar');
 if(match.status==='finished')return pair+' · '+details+'. '+(Number.isInteger(match.homeGoals)&&Number.isInteger(match.awayGoals)?'Resultado confirmado: '+match.homeGoals+'–'+match.awayGoals+(match.penalties?' (penales '+match.penalties.home+'–'+match.penalties.away+')':'')+'.':'El resultado no está confirmado.');
 if(['postponed','suspended'].includes(match.status))return pair+' figura '+(match.status==='postponed'?'postergado':'suspendido')+'. Datos cargados: '+details+'.';
 const opponent=team?(home.id===team.id?away:home):null;
 return (team?team.name+' juega contra '+opponent.name:pair)+' el '+details+'.';
}

function internoFacts(data){
 if(!data)return [];
 const facts=[{title:'Equipos del Interno',text:'El Interno tiene '+data.teams.length+' equipos. '+data.categories.map(c=>c.name+': '+data.teams.filter(t=>t.categoryId===c.id).length+' equipos en '+data.groups.filter(g=>g.categoryId===c.id).length+' grupos o zonas').join(' · ')+'.',href:'#interno'}];
 for(const category of data.categories){const format=category.format;if(!format)continue;const href=internalUrl(category.id,'cruces'),title='Formato del Interno '+category.name;for(const stage of format.stages||[])facts.push({title:title+' · '+stage.title,text:stage.text,href});for(const cup of format.cups||[])facts.push({title:title+' · '+cup.name,text:cup.text,href});facts.push({title,text:[format.summary,format.matchesLabel,format.finalNote].filter(Boolean).join(' · '),href});}
 return facts;
}

export function answerClubQuestion(question,state={},context={},now=Date.now()){
 const raw=String(question||'').trim().slice(0,300),q=searchText(raw),today=clubToday(now),dateQuestion=questionDate(raw,now),allFacts=[...(state.facts||[]),...REGULATION_FACTS,...internoFacts(state.interno)];
 if(!q)return reply('Escribí qué querés saber del club. Por ejemplo: “¿Contra quién juega Rapiñeros el miércoles?” o “¿Cuánto recaudó el Gym?”.');
 if(/\b(gym|gimnasio|ladrillos?|recaud\w*|meta)\b/.test(q)||/\b(cuanta plata|cuanto dinero)\b/.test(q)){
  if(!/\b(recaud\w*|plata|dinero|meta|avance|porcentaje|ladrillos?|colaborar|colaboro|aportar|aporto|precio|cuesta|vale|sale|costo|cuota)\b|cuanto (va|lleva)|como va/.test(q)&&q.split(' ').length>2){const facts=retrieveClubFacts(raw,allFacts);if(facts.length)return factReply(raw,facts);return reply('No encontré ese dato confirmado sobre el gimnasio. Podés ver la información del proyecto o consultar al club.',{items:[item('Proyecto del Gym','#proyecto-gimnasio'),item('Contactar al club','#contacto')]});}
  return gymAnswer(q,state.gym);
 }
 if(dateQuestion.invalid)return reply('Esa fecha no es válida. Probá con un día como “mañana”, “el miércoles” o una fecha en formato día/mes.');
 if(/\b(hola|buenas|ayuda)\b/.test(q)&&q.split(' ').length<=4)return reply('¡Hola! Puedo consultar partidos, resultados y equipos, la recaudación del Gym y los eventos publicados del club.',{choices:[{label:'Rapiñeros el miércoles',question:'¿Contra quién juega Rapiñeros el miércoles?'},{label:'Recaudación del Gym',question:'¿Cuánta plata lleva recaudada el Gym?'},{label:'Próximo evento',question:'¿Cuál es el próximo evento de Ceibos?'}]});
 if(/\b(cena|fiesta|cmc|eventos?)\b/.test(q)){
  let events=(state.events||[]).filter(e=>e.fecha>=today).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const exact=events.filter(e=>(' '+q+' ').includes(' '+searchText(e.titulo)+' '));
  if(exact.length)events=exact;else if(!/\b(proximo|eventos?)\b/.test(q))events=events.filter(e=>q.split(' ').some(word=>word.length>=4&&searchText(e.titulo+' '+e.desc).split(' ').includes(word)));
  if(dateQuestion.date)events=events.filter(e=>e.fecha===dateQuestion.date);
  if(!events.length)return reply('No tengo un evento publicado que coincida con esa consulta.',{items:[item('Ver Vida Ceibos','#vida')]});
  if(!exact.length&&events.length>1&&!/\b(proximo|eventos?)\b/.test(q))return reply('¿A cuál de estos eventos te referís?',{choices:events.slice(0,5).map(e=>({label:e.titulo+' · '+dateLabel(e.fecha),question:'¿Cuándo es '+e.titulo+dateSuffix(e.fecha)+'?'}))});
  const event=events[0];return reply(event.titulo+' es el '+dateLabel(event.fecha)+'. '+(event.desc||''),{items:[item('Ver evento','#evento-'+event.fecha+'-'+searchText(event.titulo).replace(/ /g,'-'))],intent:'event'});
 }
 const champion=answerChampionQuestion(raw,allFacts,now);if(champion)return champion;
 if(/\b(reglamento|reglas|formato)\b/.test(q)&&(/\binterno\b/.test(q)||!/(rugby|hockey|basket|futbol)/.test(q))){const facts=q.split(' ').length>3?retrieveClubFacts(raw,allFacts):[];return facts.length?factReply(raw,facts):reply('El Interno es fútbol 8. Masculino y Papi juegan 25 + 5 + 25 minutos; Femenino, 20 + 5 + 20. Podés consultar el reglamento y el formato confirmado de cada categoría.',{items:[item('Abrir reglamento PDF','/assets/reglamento-interno-f8-ceibos-2026.pdf'),item('Ver formato y cruces',internalUrl('masculino','cruces'))]});}
 if(/\b(jugadores|plantel|planteles|cambios|offside|penales|amarilla|amarillas|roja|rojas|sancion|sanciones|tolerancia|desempate|desempates|pelota|pelotas|walkover)\b/.test(q)&&(/\b(interno|papi|masculino|femenino)\b/.test(q)||context.teamId)){
  const team=state.interno?.teams.find(t=>t.id===context.teamId),category=state.interno?.categories.find(c=>c.id===team?.categoryId),facts=retrieveClubFacts(raw+(!/\binterno\b/.test(q)&&category?' Interno '+category.name:''),allFacts);
  return facts.length?factReply(raw,facts):reply('No encontré esa regla específica publicada para la categoría consultada. Podés revisar el PDF y el formato del torneo.',{items:[item('Ver reglamento del Interno','/assets/reglamento-interno-f8-ceibos-2026.pdf')],intent:'information'});
 }
 if(/\b(tienda|shop|comprar|ropa|indumentaria|fundo|fundacion|nacio|historia|lema|significa|predio|direccion|ubicacion|contacto|correo|email|entrena|entrenan|entrenamientos|entrenador|entrenadores|talle|talles|precio|cuota)\b/.test(q)){
  const facts=retrieveClubFacts(raw,allFacts);if(facts.length)return factReply(raw,facts);
  if(/\b(entrena|entrenan|entrenamientos|entrenador|entrenadores|talle|talles|precio|cuota)\b/.test(q))return reply('No encontré ese dato confirmado entre la información publicada en la web. Podés consultar al club para obtenerlo.',{items:[item('Contactar al club','#contacto')]});
 }
 const durationQuestion=/\b(dura|duran|duracion)\b/.test(q)||/\b(cuantos minutos|cuanto tiempo)\b/.test(q)&&!/\b(falta|faltan|quedan)\b/.test(q);
 if(durationQuestion&&/\b(interno|partido|partidos|masculino|femenino|papi)\b/.test(q)){
  const subject=state.interno?.teams.find(t=>t.id===context.teamId),categoryId=/\bpapi\b|\b38\b/.test(q)?'mas38':/\bfemenin[oa]s?\b/.test(q)?'femenino':/\bmasculin[oa]s?\b/.test(q)?'masculino':subject?.categoryId;
  if(!categoryId&&!/\binterno\b/.test(q))return reply('¿De qué deporte o categoría querés saber la duración? Para el Interno puedo consultar los tiempos publicados.',{choices:[{label:'Duración del Interno',question:'¿Cuánto duran los partidos del Interno?'}]});
  if(!state.interno)return reply('Estoy cargando los tiempos publicados del Interno.',{waiting:'interno'});
  const categories=state.interno.categories.filter(c=>!categoryId||c.id===categoryId);
  return reply('Duración publicada para el Interno:',{items:categories.map(c=>{const settings=clockSettings(state.interno,{categoryId:c.id});return item('Ver formato de '+c.name,internalUrl(c.id,'cruces'),c.name+': dos tiempos de '+settings.halfMinutes+' minutos y '+settings.breakMinutes+' de entretiempo ('+(settings.halfMinutes*2+settings.breakMinutes)+' minutos en total, sin contar demoras).');}),intent:'information'});
 }
 const matchQuery=answerClubMatchQuery(raw,state,context,now,dateQuestion);if(matchQuery)return matchQuery;
 const data=state.interno,found=findTeams(raw,data),follow=/^(y\b|a que hora\b|donde\b|en que cancha\b|cuando\b|el (lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b)/.test(q),savedTeam=data?.teams.find(t=>t.id===context.teamId);
 if((found.approximate&&found.teams.length)||found.teams.length>1)return reply(found.approximate?'¿Te referís a alguno de estos equipos?':'¿Qué equipo querés consultar?',{choices:found.teams.slice(0,6).map(team=>({label:team.name,question:'Ver partidos de '+team.name+dateSuffix(dateQuestion.date)}))});
 const team=found.teams[0]||(follow?savedTeam:null),date=dateQuestion.date||(follow?context.date:null),source=data?.sourceInfo?'Última lectura del Interno: '+stamp(data.sourceInfo.checkedAt||data.sourceInfo.importedAt):'';
 if(team&&/\b(posicion|posiciones|puesto|puntos|tabla)\b/.test(q)){
  const group=internoStandings(data,team.categoryId)?.find(g=>g.rows.some(r=>r.teamId===team.id)),row=group?.rows.find(r=>r.teamId===team.id);
  return reply(row?team.name+' · '+group.name+': '+(row.position===null?'sin posición asignada todavía':row.position+'.º'+(row.tied?' (igualdad pendiente de desempate)':''))+'. '+row.points+' puntos, '+row.played+' partidos jugados, '+row.won+' ganados, '+row.drawn+' empatados y '+row.lost+' perdidos.':'No tengo una tabla confirmada para ese equipo.',{items:[item('Ver tabla del grupo',internalUrl(team.categoryId,'posiciones'))],source,context:{teamId:team.id}});
 }
 if(team&&/\b(grupo|serie|zona)\b/.test(q)&&!dateQuestion.date){const group=data.groups.find(g=>g.id===team.groupId);return reply(group?team.name+' está en '+group.name+'.':'No tengo un grupo confirmado para '+team.name+'.',{items:[item('Ver grupos',internalUrl(team.categoryId,'grupos'))],context:{teamId:team.id},source});}
 const wantsResult=/\b(resultado|resultados|salio|salieron|gano|perdio|empato|jugo)\b/.test(q)||/como (le fue|quedo)|cuanto quedo/.test(q);
 const category=/\bpapi\b|\b38\b/.test(q)?'mas38':/\bfemenin[oa]s?\b/.test(q)?'femenino':/\bmasculin[oa]s?\b/.test(q)?'masculino':null;
 if(data&&/\b(goleador|goleadores|anotador|anotadores)\b/.test(q)&&(team||category||/\binterno\b/.test(q))){
  if(!team&&!category)return reply('¿De qué categoría del Interno querés ver los goleadores?',{choices:data.categories.map(c=>({label:c.name,question:'Goleadores del Interno '+c.name}))});
  const id=team?.categoryId||category,rows=internoScorers(data,id).filter(r=>!team||r.teamId===team.id);
  return reply(rows.length?'Goleadores publicados'+(team?' de '+team.name:' de '+data.categories.find(c=>c.id===id).name)+':':'No hay goleadores identificados publicados para esa consulta.',{items:rows.slice(0,8).map(r=>item('Ver goleadores',internalUrl(id,'goleadores'),r.player+' · '+r.teamName+' · '+r.goals+' goles.')).concat(rows.length?[]:[item('Ver goleadores',internalUrl(id,'goleadores'))]),source});
 }
 const fixtureIntent=Boolean(team||/\b(partido|partidos|juega|juegan|fixture|resultado|resultados|cancha|horario|horarios)\b/.test(q)||(dateQuestion.date&&(category||/\binterno\b/.test(q))));
 if(data&&/\b(ahora|simultaneo|simultaneos|vivo)\b/.test(q)&&!team){const board=liveBoard(data,now);return reply(board.active.length?'Hay '+board.active.length+' partidos en horario de juego según el fixture. El reloj es estimado.':'Ahora no hay partidos en horario de juego según el fixture.',{items:board.active.slice(0,8).map(row=>item('Ver partido',internalUrl(row.match.categoryId,'fixture','',row.match.id),describeInterno(data,row.match)+' '+row.clock.label+': '+row.clock.text)),source});}
 if(fixtureIntent&&(team||category||/\binterno\b/.test(q))){
  if(!data)return reply('Todavía estoy cargando los partidos del Interno. Probá de nuevo en unos segundos.',{items:[item('Ver Interno','#interno')],waiting:'interno'});
  let matches=data.matches.filter(m=>m.status!=='cancelled'&&(!team||member(m,team.id))&&(!category||m.categoryId===category));
  if(date)matches=matches.filter(m=>m.date===date);
  if(wantsResult)matches=matches.filter(m=>m.status==='finished').sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.time||'').localeCompare(a.time||''));
  else if(!date)matches=matches.filter(m=>m.status!=='finished'&&(!m.date||m.date>=today)&&(m.date!==today||!m.time||liveKickoff(m)>=now||['first','halftime','second'].includes(matchClock(m,clockSettings(data,m),now).phase))).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.time||'99:99').localeCompare(b.time||'99:99'));
  if(!date&&matches.length){const first=matches[0].date;matches=matches.filter(m=>m.date===first);}
  const label=team?team.name:category?data.categories.find(c=>c.id===category)?.name:'el Interno';
  if(!matches.length)return reply('No tengo '+(wantsResult?'un resultado confirmado':'un partido confirmado')+' de '+label+(date?' para el '+dateLabel(date):'')+'.',{items:[item('Ver '+(team?'partidos del equipo':'fixture'),internalUrl(team?.categoryId||category||'masculino',team?'equipos':wantsResult?'resultados':'fixture',team?.id||''))],context:team?{teamId:team.id,date}: {},source});
  if(matches.length===1){const match=matches[0];return reply(describeInterno(data,match,team),{items:[item('Ver partido',internalUrl(match.categoryId,match.status==='finished'?'resultados':'fixture','',match.id))],context:team?{teamId:team.id,date:match.date,matchId:match.id}: {},source,intent:'fixture'});}
  return reply('Estos son los partidos publicados de '+label+(date?' para el '+dateLabel(date):'')+(matches.length>8?' (muestro 8 de '+matches.length+')':'')+':',{items:matches.slice(0,8).map(m=>item('Ver partido',internalUrl(m.categoryId,m.status==='finished'?'resultados':'fixture','',m.id),describeInterno(data,m,team))),context:team?{teamId:team.id,date}: {},source});
 }
 const facts=retrieveClubFacts(raw,allFacts);
 if(facts.length)return factReply(raw,facts);
 if(fixtureIntent&&!data)return reply('Todavía se están cargando los datos del Interno. También podés indicar el deporte y la categoría que querés consultar.',{items:[item('Ver fixture','#fixture'),item('Ver Interno','#interno')],waiting:'interno'});
 const foundPages=searchIndex(buildSearchIndex({sports:state.sports,events:state.events,interno:data,content:state.content}),raw,4).results;
 return foundPages.length?reply('Encontré estas opciones relacionadas con tu consulta:',{items:foundPages.map(row=>item(row.title,row.href,row.description))}):reply('No encontré ese dato entre la información publicada. Puedo ayudarte con los partidos, resultados, equipos, Gym, eventos y el resto del contenido público de Ceibos.',{choices:[{label:'Partidos de Rapiñeros',question:'¿Contra quién juega Rapiñeros próximamente?'},{label:'Recaudación del Gym',question:'¿Cuánto recaudó el Gym?'},{label:'Próximo evento',question:'¿Cuál es el próximo evento?'}]});
}
