import {fold,teamCandidates} from './club-assistant-language.js?v=20261117conversacion';
import {resolveClubCategories,matchPeriod} from './club-assistant-matches.js?v=20261117conversacion';
import {clubToday,questionDate} from './club-assistant-model.js?v=20261117conversacion';
import {internoStandings,internoScorers} from './interno-model.js?v=20261113papi';
import {liveKickoff,matchClock,clockSettings,courtName} from './interno-live-clock.js?v=20261116acciones';

const answer=(text,extra={})=>({text,items:[],choices:[],context:{},intent:'information',...extra});
const item=(label,href,text='')=>({label,href,text});
const internoUrl=(category,tab='grupos')=>'?internoCategoria='+encodeURIComponent(category||'masculino')+'&internoTab='+tab+'#interno';
const clubUrl=s=>'?deporte='+s.sport+'&categoria='+encodeURIComponent(s.category)+'#'+s.sport;
const dateLabel=date=>new Intl.DateTimeFormat('es-UY',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')).replace(',','');
const stamp=value=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('es-UY',{dateStyle:'short',timeStyle:'short',timeZone:'America/Montevideo',hourCycle:'h23'}).format(new Date(value))+' h':'';
const sourceFor=data=>data?.sourceInfo?'Última lectura del Interno: '+stamp(data.sourceInfo.checkedAt||data.sourceInfo.importedAt):'';
const number=value=>value!==null&&value!==''&&value!==undefined&&Number.isFinite(Number(String(value).replace(',','.')))?Number(String(value).replace(',','.')):null;
const metric=(table,row,names)=>{const i=table.columns.findIndex(c=>names.includes(fold(c)));return i<0?null:row.values[i];};
const rowTeam=(table,row)=>String(metric(table,row,['equipo','club'])||'');
const clubRows=t=>t.rows.filter(r=>r.club===true||/\bceibos\b/.test(fold(rowTeam(t,r))));
const phaseSource=t=>(t.stale?'No se pudo verificar una actualización nueva. Se conserva la última tabla disponible. ':'')+(t.updatedAt?'Consulta de la fuente: '+stamp(t.updatedAt):'Según la tabla publicada en la categoría.')+(t.note?' '+t.note:'');

function categoryId(q){return /\bpapi\b|\b38\b/.test(q)?'mas38':/\bfemenin[oa]s?\b/.test(q)?'femenino':/\bmasculin[oa]s?\b/.test(q)?'masculino':null;}
function categoriesChoice(question,data,context){return answer('¿De qué categoría del Interno querés consultarlo?',{choices:data.categories.map(c=>({label:c.name,question,resolution:{kind:'internoCategory',categoryId:c.id,label:c.name}})),context});}

function tableSubjects(question,state,context){
 const subjects=resolveClubCategories(question,state.sports||[],context.resolution);
 if(subjects.length)return subjects;
 if(context.matchQuery?.subject?.kind==='club'&&/^y\b/.test(fold(question)))return [context.matchQuery.subject];
 if(context.tableSubject&&/^y\b/.test(fold(question)))return [context.tableSubject];
 return [];
}

function clubTableAnswer(question,state,context,now){
 const q=fold(question),scorers=/\b(goleador|goleadores|anotador|anotadores|goleo)\b/.test(q),subjects=tableSubjects(question,state,context);
 if(!subjects.length)return null;
 if(subjects.length>1)return answer('¿Qué deporte y categoría querés consultar?',{choices:subjects.slice(0,10).map(s=>({label:s.label,question,resolution:s})),context:{pendingDataQuestion:question}});
 const subject=subjects[0],href=clubUrl(subject),period=matchPeriod(question,now,'count'),year=Number(period.from?.slice(0,4)||clubToday(now).slice(0,4)),all=(state.tables||[]).filter(t=>t.sport===subject.sport&&fold(t.category)===fold(subject.category)&&t.season===year&&t.kind===(scorers?'scorers':'standings'));
 const nextContext={tableSubject:subject};
 if(period.invalid)return answer('El período indicado no es válido. Revisá las fechas y el orden de inicio y fin.',{context:nextContext});
 if(/\b(de local|de visitante|como local|como visitante)\b/.test(q))return answer('La tabla publicada de '+subject.label+' no ofrece un desglose de local y visitante.',{items:[item('Ver tabla de la categoría',href)],context:nextContext,unavailable:true});
 if(period.explicit&&(period.from!==year+'-01-01'||period.to!==year+'-12-31'))return answer('No hay una tabla histórica publicada de '+subject.label+' para ese período. Podés revisar las tablas disponibles de la categoría.',{items:[item('Ver tablas disponibles',href)],context:nextContext,unavailable:true});
 if(!all.length)return answer((state.tablesReady===false?'Todavía no pude cargar':'No hay')+' una tabla '+(scorers?'individual de goleadores o anotadores':'de posiciones')+' publicada de '+subject.label+' para '+year+'.',{items:[item('Ver categoría',href)],context:nextContext,waiting:state.tablesReady===false?'tables':undefined,unavailable:true});
 const named=all.filter(t=>q.includes(fold(t.title))),tables=(named.length?named:all),full=/\b(completa|completo|todos|todas)\b/.test(q),leader=/\b(primero|primera|lider|encabeza)\b/.test(q)&&!subjects.some(s=>fold(s.category)==='primera'),global=scorers&&/\b(liga|campeonato|torneo|ranking completo)\b/.test(q),lines=[];
 for(const table of tables){
  let rows=full||global||leader?table.rows:clubRows(table);
  if(leader)rows=rows.filter(r=>number(metric(table,r,['pos','posicion','puesto']))===1);
  if(scorers){
   const value=r=>number(metric(table,r,['goles','puntos','pts']))||0;
   rows=[...rows].sort((a,b)=>value(b)-value(a));
   if(!/\b(goleadores|anotadores|todos|todas)\b/.test(q)&&rows.length)rows=rows.filter(r=>value(r)===value(rows[0]));
   for(const row of rows.slice(0,8)){const player=metric(table,row,['jugador','anotador','nombre']),score=metric(table,row,['goles','puntos','pts']);if(player&&score!==null)lines.push(table.title+': '+player+' · '+score+' '+(table.columns.some(c=>fold(c)==='goles')?'goles':'puntos')+(global?' · '+rowTeam(table,row):'')+'.');}
  }else{
   for(const row of rows.slice(0,full?12:4)){const pos=metric(table,row,['pos','posicion','puesto']),points=metric(table,row,['pts','puntos']),played=metric(table,row,['pj','jugados']);lines.push(table.title+': '+(full||leader?rowTeam(table,row):subject.label)+(points!==null?' tiene '+points+' puntos':'')+(pos!==null?' · posición '+pos:'')+(played!==null?' · '+played+' jugados':'')+'.');}
  }
 }
 if(!lines.length)return answer('La fuente no publica '+(scorers?'goleadores o anotadores identificados':'una fila de posiciones')+' de Ceibos para '+subject.label+' en '+year+'.',{items:[item('Ver tabla publicada',href)],source:phaseSource(tables[0]),context:nextContext,unavailable:true});
 const title=scorers?(global?'Goleadores del campeonato':'Goleadores de '+subject.label):full?'Tabla de '+subject.label:leader?'Líder del campeonato de '+subject.label:null;
 return answer((title?title+' · '+year+'\n':'')+lines.slice(0,8).join('\n')+(tables.length>1?'\nCada fase conserva su propia tabla.':''),{items:[item(scorers?'Ver goleadores':'Ver tabla completa',href)],source:[...new Set(tables.map(phaseSource))].join(' '),context:nextContext,intent:'table'});
}

function internoDataAnswer(question,state,context,now){
 const q=fold(question),data=state.interno,found=teamCandidates(question,data),team=context.resolution?.kind==='interno'?data?.teams.find(t=>t.id===context.resolution.teamId):found.teams.length===1&&!found.approximate?found.teams[0]:null;
 const cat=categoryId(q)||(['internoCategory','internoGroup'].includes(context.resolution?.kind)?context.resolution.categoryId:null)||team?.categoryId||(/^y\b/.test(q)?context.internoCategory:null);
 const groupMatch=q.match(/\b(?:grupo|serie|zona) ([a-z1-9])\b/),groups=data?.groups.filter(g=>(!cat||g.categoryId===cat)&&(!groupMatch||fold(g.name).split(' ').at(-1)===groupMatch[1]))||[];
 const scoped=/\binterno\b/.test(q)||Boolean(team)||Boolean(groupMatch)&&Boolean(cat),scorers=/\b(goleador|goleadores|anotador|anotadores)\b/.test(q),table=/\b(tabla|posicion|posiciones|puesto|puntos|lider)\b/.test(q),directory=/\b(equipos|integran|estan|pertenece|grupo|grupos|zona|zonas)\b/.test(q)&&!table&&!scorers;
 if(!scoped||!scorers&&!table&&!directory)return null;
 if(!data)return answer('Estoy cargando los equipos y las tablas del Interno.',{waiting:'interno'});
 if(!cat&&(table||scorers||groupMatch))return categoriesChoice(question,data,{pendingDataQuestion:question});
 const source=sourceFor(data),href=internoUrl(cat,scorers?'goleadores':table?'posiciones':'grupos'),nextContext={teamId:team?.id,internoCategory:cat};
 if(table&&/\b(de local|de visitante|como local|como visitante)\b/.test(q))return answer('La tabla del Interno no publica un desglose de local y visitante para esa consulta.',{source,items:[item('Ver posiciones',href)],context:nextContext,unavailable:true});
 if(groupMatch&&groups.length!==1)return answer('No hay un grupo '+groupMatch[1].toUpperCase()+' publicado para esa categoría.',{items:[item('Ver grupos',href)],context:nextContext,unavailable:true});
 const group=groupMatch?groups[0]:team?data.groups.find(g=>g.id===team.groupId):null;
 if(directory){
  if(/\b(grupos|zonas)\b/.test(q)&&!groupMatch&&!team){const published=data.groups.filter(g=>!cat||g.categoryId===cat);return answer(/\b(cuantos|cantidad|total)\b/.test(q)?'Hay '+published.length+' grupos o zonas publicados'+(cat?' en el Interno '+data.categories.find(c=>c.id===cat).name:' en el Interno')+'.':published.map(g=>g.name+' · '+data.categories.find(c=>c.id===g.categoryId).name).join('\n'),{source,items:[item('Ver grupos',href)],context:nextContext});}
  const teams=data.teams.filter(t=>(!cat||t.categoryId===cat)&&(!group||t.groupId===group.id));
  const category=data.categories.find(c=>c.id===cat)?.name,scope=group?group.name+' · '+category:category?'Interno '+category:'el Interno';
  if(/\b(cuantos|cantidad|total)\b/.test(q))return answer('Hay '+teams.length+' equipos en '+scope+'.',{source,items:[item('Ver equipos y grupos',href)],context:nextContext});
  if(team&&!groupMatch&&group)return answer(team.name+' está en '+group.name+' del Interno '+category+'.',{source,items:[item('Ver grupo',href)],context:nextContext});
  return answer(scope+': '+teams.map(t=>t.name).join(', ')+'.',{source,items:[item('Ver equipos y grupos',href)],context:nextContext});
 }
 if(scorers){
  let rows=internoScorers(data,cat);if(team)rows=rows.filter(r=>r.teamId===team.id);if(group)rows=rows.filter(r=>data.teams.find(t=>t.id===r.teamId)?.groupId===group.id);
  const label=team?.name||group?.name||data.categories.find(c=>c.id===cat).name;
  if(!rows.length)return answer('No hay goleadores identificados publicados de '+label+'.',{source,items:[item('Ver goleadores',href)],context:nextContext,unavailable:true});
  if(/\bgoleador\b|\banotador\b/.test(q))rows=rows.filter(r=>r.goals===rows[0].goals);
  return answer('Goleadores de '+label+':\n'+rows.slice(0,8).map(r=>r.player+' · '+r.teamName+' · '+r.goals+' goles.').join('\n'),{source,items:[item('Ver goleadores',href)],context:nextContext,intent:'table'});
 }
 const standings=internoStandings(data,cat);
 if(!standings?.length)return answer('No hay una tabla confirmada publicada para esa categoría del Interno.',{source,items:[item('Ver posiciones',href)],context:nextContext,unavailable:true});
 const selected=group?standings.filter(g=>g.id===group.id||g.name===group.name):team?standings.filter(g=>g.rows.some(r=>r.teamId===team.id)):standings;
 const lines=selected.flatMap(g=>g.rows.filter(r=>!team||r.teamId===team.id).map(r=>g.name+': '+(r.position===null?'sin posición asignada':r.position+'.º')+' · '+r.name+' · '+(r.points===null?'puntos sin confirmar':r.points+' puntos')+' · '+r.played+' jugados'+(r.tied?' · igualdad pendiente de desempate':'')+'.'));
 return answer(lines.length?lines.join('\n'):'No hay posiciones publicadas para esa consulta.',{source,items:[item('Ver posiciones',href)],context:nextContext,intent:'table'});
}

function pairAnswer(question,state,now){
 const found=teamCandidates(question,state.interno),q=fold(question);if(found.teams.length!==2||found.approximate||!/\b(contra|entre)\b/.test(q))return null;
 const data=state.interno,[a,b]=found.teams,date=questionDate(question,now),past=/\b(salio|quedo|resultado|gano|perdio|jugo)\b/.test(q);
 let games=data.matches.filter(m=>[a.id,b.id].includes(m.homeId)&&[a.id,b.id].includes(m.awayId)&&m.status!=='cancelled'&&(!date.date||m.date===date.date));
 games=games.filter(m=>past?m.status==='finished':m.status!=='finished').sort((a,b)=>(past?-1:1)*(a.date||'9999').localeCompare(b.date||'9999'));
 const game=games[0],href=internoUrl(a.categoryId,past?'resultados':'fixture');
 if(!game)return answer('No hay '+(past?'un resultado confirmado':'un partido publicado')+' entre '+a.name+' y '+b.name+(date.date?' para el '+dateLabel(date.date):'')+'.',{source:sourceFor(data),items:[item('Ver partidos',href)],unavailable:true});
 const home=data.teams.find(t=>t.id===game.homeId),away=data.teams.find(t=>t.id===game.awayId);
 return answer(home.name+' vs. '+away.name+': '+(past?game.homeGoals+'–'+game.awayGoals+' · ':'')+dateLabel(game.date)+(game.time?' · '+game.time+' h':' · Horario a confirmar')+(courtName(game)?' · '+courtName(game):' · Cancha a confirmar')+'.',{source:sourceFor(data),items:[item('Ver partido',href)],context:{teamId:a.id,date:game.date,matchId:game.id},intent:'fixture'});
}

function agendaAnswer(question,state,context,now){
 const q=fold(question),data=state.interno,range=/\b(semana|mes|finde|fin de semana)\b/.test(q),fixture=/\b(partido|partidos|fixture|juega|juegan)\b/.test(q),past=/\b(gano|perdio|empato|victorias|derrotas|jugados|resultados|goles|racha)\b/.test(q);
 if(/\b(ahora|vivo|simultaneo|simultaneos)\b/.test(q))return null;
 if(!fixture||past||!/\binterno\b/.test(q)&&!categoryId(q)&&!(range&&context.teamId))return null;
 const found=teamCandidates(question,data),team=found.teams.length===1?found.teams[0]:range?data?.teams.find(t=>t.id===context.teamId):null;
 if(team&&!range)return null;
 if(!data)return answer('Estoy cargando el fixture del Interno.',{waiting:'interno'});
 const cat=categoryId(q)||context.resolution?.categoryId||team?.categoryId,period=matchPeriod(question,now,'next',questionDate(question,now));if(period.invalid)return null;
 const today=clubToday(now),onlyFuture=/\b(proximo|proximos|faltan|quedan)\b/.test(q)||!period.explicit;
 let games=data.matches.filter(m=>m.status!=='cancelled'&&(!cat||m.categoryId===cat)&&(!team||m.homeId===team.id||m.awayId===team.id)&&m.date&&(!period.from||m.date>=period.from)&&(!period.to||m.date<=period.to));
 if(onlyFuture)games=games.filter(m=>m.status!=='finished'&&m.date>=today&&(m.date!==today||!m.time||liveKickoff(m)>=now||['first','halftime','second'].includes(matchClock(m,clockSettings(data,m),now).phase)));
 games.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99:99').localeCompare(b.time||'99:99'));
 const label=team?.name||data.categories.find(c=>c.id===cat)?.name||'el Interno',href=internoUrl(cat,'fixture');
 if(!games.length)return answer('No hay partidos publicados de '+label+(period.label?' '+period.label:' para ese período')+'.',{items:[item('Ver fixture',href)],source:sourceFor(data),context:{teamId:team?.id,internoCategory:cat},unavailable:true});
 return answer('Partidos publicados de '+label+(period.label?' '+period.label:'')+': '+games.length+'.',{items:games.map(m=>{const home=data.teams.find(t=>t.id===m.homeId).name,away=data.teams.find(t=>t.id===m.awayId).name;return item('Ver fixture',href,dateLabel(m.date)+' · '+(m.time?m.time+' h':'Horario a confirmar')+'\n'+home+' vs. '+away+' · '+(courtName(m)||'Cancha a confirmar')+(m.status==='finished'?' · Finalizado '+m.homeGoals+'–'+m.awayGoals:''));}),source:sourceFor(data),context:{teamId:team?.id,internoCategory:cat},intent:'schedule'});
}

export function answerStructuredClubQuestion(question,state,context={},now=Date.now()){
 const q=fold(question);if(/\b(gym|gimnasio|ladrillos|recaudacion)\b/.test(q))return null;
 if(/\bpuntos\b.*\b(metio|anoto|marco|hizo|recibio)\b/.test(q)&&!/\b(tabla|campeonato)\b/.test(q))return null;
 const pair=pairAnswer(question,state,now);if(pair)return pair;
 if(/\b(vale|valen|otorga|otorgan|dan)\b/.test(q)&&/\b(victoria|empate|derrota)\b/.test(q))return null;
 const internal=internoDataAnswer(question,state,context,now);if(internal)return internal;
 if(/\b(tabla|posicion|posiciones|puesto|puntos|goleador|goleadores|anotador|anotadores|lider)\b/.test(q)){const club=clubTableAnswer(question,state,context,now);if(club)return club;}
 return agendaAnswer(question,state,context,now);
}
