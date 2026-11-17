import {searchText} from './search-model.js?v=20261117';
const text=q=>searchText(q).replace(/\bpartidso\b/g,'partidos').replace(/\bresreva\b/g,'reserva').replace(/\bsetiembre\b/g,'septiembre');
const monthNames=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const aliases={futbol:['futbol','football'],basketball:['basketball','basket','basquet','basquetbol','baske'],hockey:['hockey'],rugby:['rugby']};
const response=(message,extra={})=>({text:message,items:[],choices:[],context:{},...extra});
const link=(label,href,description='')=>({label,href,text:description});
const todayAt=now=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'America/Montevideo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(r=>[r.type,r.value]));return p.year+'-'+p.month+'-'+p.day;};
const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+86400000*n).toISOString().slice(0,10);
const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
const shortDate=date=>date?date.slice(8)+'/'+date.slice(5,7)+'/'+date.slice(0,4):'';
const endMonth=(year,month)=>new Date(Date.UTC(year,month+1,0,12)).toISOString().slice(0,10);
const startMonth=(year,month)=>year+'-'+String(month+1).padStart(2,'0')+'-01';
const numbers={uno:1,un:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
const urlFor=subject=>subject.kind==='interno'?'?internoCategoria='+encodeURIComponent(subject.categoryId)+'&internoTab=equipos&internoEquipo='+encodeURIComponent(subject.teamId)+'#interno':'?deporte='+encodeURIComponent(subject.sport)+'&categoria='+encodeURIComponent(subject.category)+'#'+subject.sport;

export function matchPeriod(question,now,operation,providedDate){
 const q=text(question),today=todayAt(now),currentYear=Number(today.slice(0,4)),yearMatch=q.match(/\b(?:19|20)\d{2}\b/);let year=yearMatch?Number(yearMatch[0]):currentYear;
 if(/\b(ano|temporada) (pasad[oa]|anterior)\b/.test(q))year=currentYear-1;
 const dates=[...String(question).matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)].map(m=>(m[3]||year)+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'));
 if(dates.some(d=>!validDate(d)))return {invalid:true};
 if(dates.length>=2){if(dates[0]>dates[1])return {invalid:true};return {from:dates[0],to:dates[1],label:'del '+shortDate(dates[0])+' al '+shortDate(dates[1]),explicit:true};}
 if(dates.length===1)return {from:dates[0],to:dates[0],label:'el '+shortDate(dates[0]),explicit:true};
 if(providedDate?.date)return {from:providedDate.date,to:providedDate.date,label:'el '+shortDate(providedDate.date),explicit:true};
 const months=[...q.matchAll(new RegExp('\\b('+monthNames.join('|')+')\\b','g'))].map(m=>monthNames.indexOf(m[1]));
 if(months.length){const from=startMonth(year,months[0]),to=months.length>1?endMonth(year,months[1]):/\bdesde\b/.test(q)?today:endMonth(year,months[0]);if(from>to)return {invalid:true};return {from,to,label:months.length===1&&!/\bdesde\b/.test(q)?'en '+monthNames[months[0]]+' de '+year:'del '+shortDate(from)+' al '+shortDate(to),explicit:true};}
 if(/\bmes pasado\b/.test(q)){const m=Number(today.slice(5,7))-2,y=m<0?currentYear-1:currentYear,month=(m+12)%12;return {from:startMonth(y,month),to:endMonth(y,month),label:'en '+monthNames[month]+' de '+y,explicit:true};}
 if(/\beste mes\b/.test(q))return {from:today.slice(0,7)+'-01',to:today,label:'en '+monthNames[Number(today.slice(5,7))-1]+' de '+currentYear,explicit:true};
 if(/\b(esta semana|semana pasada)\b/.test(q)){const weekday=new Date(today+'T12:00:00Z').getUTCDay(),monday=shift(today,-((weekday+6)%7)-(/pasada/.test(q)?7:0)),sunday=shift(monday,6);return {from:monday,to:sunday,label:'del '+shortDate(monday)+' al '+shortDate(sunday),explicit:true};}
 if(/\b(ultimo|pasado) (fin de semana|finde)\b/.test(q)){const weekday=new Date(today+'T12:00:00Z').getUTCDay(),sunday=shift(today,-(weekday||7));return {from:shift(sunday,-1),to:sunday,label:'del '+shortDate(shift(sunday,-1))+' al '+shortDate(sunday),explicit:true};}
 const explicit=Boolean(yearMatch||/\b(ano|temporada)\b/.test(q));
 if(explicit||['count','goalsFor','goalsAgainst','record','rate','average','streak','list'].includes(operation))return {from:year+'-01-01',to:year+'-12-31',label:'en '+year,year,explicit};
 return {from:operation==='next'?today:null,to:operation==='next'?null:today,label:'',explicit:false};
}

export function interpretMatchQuestion(question,now,prior=null,providedDate){
 const q=text(question);if(/\b(goleadores?|anotadores?|titulos|campeonatos|copas|reglamento|entrenamientos|gym|gimnasio|dura|duran|duracion)\b/.test(q)||/\b(cuantos minutos|cuanto tiempo)\b/.test(q)&&!/\b(falta|faltan|quedan)\b/.test(q))return null;
 const quant=/\b(cuantos?|cuantas?|cantidad|numero|total|veces|estadisticas|balance|resumen|porcentaje|promedio)\b/.test(q),list=/\b(todos|todas|cuales|historial|listado|lista|listame|mostrame|mostra|mostrar|ver las|ver los|contra quienes)\b/.test(q);
 const won=/\b(gano|ganaron|ganado|ganada|ganados|ganadas|victorias|victoria|triunfos|triunfo)\b/.test(q),lost=/\b(perdio|perdieron|perdido|perdida|perdidos|perdidas|derrotas|derrota)\b/.test(q),draw=/\b(empato|empataron|empatado|empatada|empatados|empatadas|empates|empate)\b/.test(q);
 const result=/\b(resultado|resultados|marcador|marcadores|salio|salieron|jugo|jugados|jugaron|ultimo|ultima|ultimos|ultimas)\b|como (le fue|quedo|salio)|cuanto quedo/.test(q)||won||lost||draw;
 const future=/\b(juega|juegan|jugara|jugaran|va a jugar|enfrenta|proximo|proxima|proximos|faltan|quedan|por jugar)\b/.test(q),goal=/\b(goles|tantos)\b/.test(q)||/\bpuntos\b.*\b(metio|anoto|hizo)\b/.test(q);
 const negativeGoals=/\b(en contra|recibio|recibidos|le hicieron)\b/.test(q),last=q.match(/\bultim[oa]s? (\d{1,2}|uno|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/),pluralRecent=/\bultim[oa]s (resultados|partidos|marcadores|victorias|derrotas|empates|triunfos)\b/.test(q);let lastN=last?Math.min(50,Number(last[1])||numbers[last[1]]):pluralRecent?5:null;
 let lastNOutcome=/\bultim[oa]s? (?:\d{1,2}|uno|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)? ?(?:victorias|triunfos|derrotas|empates)\b/.test(q);
 let outcome=/\bno (gano|ganaron)\b/.test(q)?'notWin':won?'win':lost?'loss':draw?'draw':'all',operation=null;
 if(/\b(cuanto (quedo|salio)|por cuanto)\b/.test(q))operation='last';
 else if(/\b(racha|consecutivos|seguidos)\b|lleva sin (ganar|perder)/.test(q)){operation='streak';if(/sin perder|invict/.test(q))outcome='unbeaten';if(/sin ganar/.test(q))outcome='notWin';}
 else if(/\bporcentaje\b/.test(q)&&(won||lost||draw))operation='rate';
 else if(goal&&(quant||/por partido/.test(q)))operation=/promedio|por partido/.test(q)?'average':negativeGoals?'goalsAgainst':'goalsFor';
 else if(/\b(balance|estadisticas|resumen|como viene|como le esta yendo)\b/.test(q)||quant&&[won,lost,draw].filter(Boolean).length>1)operation='record';
 else if(quant&&(result||future||/\b(partidos|partido|partidso|encuentros|encuentro)\b/.test(q)))operation='count';
 else if(list&&(result||future||/\b(partidos|partido|encuentros|victorias|derrotas|empates)\b/.test(q))||lastN>1)operation='list';
 else if((won||lost||draw)&&!providedDate?.date&&!/\b\d{1,2}[/-]\d{1,2}\b/.test(question)&&/\b(ano|temporada|mes|202\d|201\d)\b/.test(q)&&!/\b(ultimo|ultima|resultado|marcador)\b/.test(q))operation='count';
 else if(result)operation='last';else if(future||/\bpartidos?\b/.test(q))operation='next';
 const follow=contextFollowup(question);
 if(prior&&follow&&(won||lost||draw)&&!quant&&!goal&&!list&&!lastN&&!/\b(ultimo|ultima|resultado|marcador|salio)\b/.test(q)&&['count','record','rate','goalsFor','goalsAgainst','average','streak','list'].includes(prior.operation))operation=prior.operation==='record'?'count':prior.operation;
 if(!operation&&prior&&follow){operation=prior.operation;outcome=prior.outcome;}
 if(!operation)return null;
 let period=matchPeriod(question,now,operation,providedDate);if(period.invalid)return {invalid:true};
 if(prior&&follow&&!period.explicit){period=prior.period;if(!lastN&&prior.lastN){lastN=prior.lastN;lastNOutcome=prior.lastNOutcome;}}
 if(lastN&&!period.explicit)period={from:null,to:todayAt(now),label:lastNOutcome?'en los últimos '+lastN+' resultados que cumplen esa condición':'en los últimos '+lastN+' partidos registrados',explicit:false};
 const location=/\b(de visitante|como visitante|fuera de casa)\b/.test(q)?'away':/\b(de local|como local|en casa)\b/.test(q)?'home':prior&&follow?prior.location:null;
 const opponentMatch=q.match(/\b(?:contra|frente a) (?!quien\b|quienes\b)(.+)/),opponent=opponentMatch?opponentMatch[1].split(/\b(?:este ano|esta temporada|el ano pasado|en (?:19|20)\d{2}|de local|de visitante|desde|entre|durante|en (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))\b/)[0].trim():prior&&follow?prior.opponent:null;
 const lastOutcome=/\bultim[oa] (victoria|triunfo|derrota|empate)\b/.test(q);
 return {operation,outcome,period,location,lastN,lastNOutcome,lastOutcome,opponent,future:operation!=='streak'&&(future&&!result||Boolean(prior?.future&&follow&&!result&&!goal&&!/\b(ultimo|ultima)\b/.test(q))),goalsAgainst:negativeGoals};
}

export function resolveClubCategories(question,sports,resolution=null){
 const q=' '+text(question)+' ',mentioned=sports.filter(s=>aliases[s.slug]?.some(alias=>q.includes(' '+alias+' '))),pool=mentioned.length?mentioned:sports;
 if(resolution?.kind==='club')return sports.flatMap(s=>s.slug===resolution.sport&&(s.categories||[]).includes(resolution.category)?[{kind:'club',sport:s.slug,sportName:s.name,category:resolution.category,label:s.name+' · '+resolution.category}]:[]);
 const matches=pool.flatMap(s=>(s.categories||[]).flatMap(c=>{const name=text(c),exact=q.includes(' '+name+' '),family=name.split(' ').length>1&&q.includes(' '+name.split(' ')[0]+' ');return exact||family?[{kind:'club',sport:s.slug,sportName:s.name,category:c,label:s.name+' · '+c,exact,words:name.split(' ').length}]:[];}));
 const specific=matches.filter(row=>row.exact&&row.words>1);if(specific.length){const longest=Math.max(...specific.map(row=>row.words));return specific.filter(row=>row.words===longest);}
 if(matches.length)return matches;
 if(mentioned.length===1){const s=mentioned[0],cats=s.categories||[];if(cats.length===1||s.slug==='basketball'){const c=cats.includes('Basketball')?'Basketball':cats[0];return c?[{kind:'club',sport:s.slug,sportName:s.name,category:c,label:s.name+' · '+c}]:[];}return cats.map(c=>({kind:'club',sport:s.slug,sportName:s.name,category:c,label:s.name+' · '+c}));}
 return [];
}

function resultRows(rows,subject,today){
 const filtered=subject.kind==='interno'?rows:rows.filter(r=>text(r.deporte)===text(subject.sport)||aliases[subject.sport]?.includes(text(r.deporte))).filter(r=>text(r.categoria)===text(subject.category));
 const unique=new Map(),conflicts=new Set();let skipped=0;
 for(const row of filtered){
  if(!validDate(row.fecha)||row.fecha>today||typeof row.rival!=='string'||!row.rival.trim()||!Number.isInteger(row.gf)||!Number.isInteger(row.gc)||row.gf<0||row.gc<0||row.confirmed===false||/program|pendiente|suspend|posterg|cancel/.test(text(row.status||row.estado))){skipped++;continue;}
  const key=row.matchId||row.fecha+'|'+text(row.rival),previous=unique.get(key);if(previous&&(previous.gf!==row.gf||previous.gc!==row.gc)){conflicts.add(key);continue;}unique.set(key,row);
 }
 return {rows:[...unique].filter(([key])=>!conflicts.has(key)).map(([,row])=>row),skipped,conflicts:conflicts.size};
}
const won=m=>m.gf>m.gc,lost=m=>m.gf<m.gc,drawn=m=>m.gf===m.gc;
const outcomeMatch=(m,outcome)=>outcome==='win'?won(m):outcome==='loss'?lost(m):outcome==='draw'?drawn(m):outcome==='unbeaten'?!lost(m):outcome==='notWin'?!won(m):true;
const stats=rows=>({played:rows.length,wins:rows.filter(won).length,draws:rows.filter(drawn).length,losses:rows.filter(lost).length,gf:rows.reduce((n,r)=>n+r.gf,0),gc:rows.reduce((n,r)=>n+r.gc,0)});
const scoreLine=r=>shortDate(r.fecha)+' · vs. '+r.rival+' · '+r.gf+'–'+r.gc;
const plural=(n,singular,multiple)=>n+' '+(n===1?singular:multiple);
function contextFollowup(question){
 const q=text(question);if(/^(y\b|de (local|visitante)\b|en (19|20)\d{2}\b)/.test(q))return true;
 const neutral=new Set(('cuantos cuantas cuantos cuantas cantidad partidos partido partidso encuentros gano ganaron perdio empato victorias derrotas empates jugo este esta el la los las de del en ano temporada pasado pasada actual ultimo ultimos cinco tres dos local visitante goles favor contra recibio hizo porcentaje promedio tiene lleva').split(' '));
 return q.split(' ').every(w=>neutral.has(w)||/^\d+$/.test(w)||monthNames.includes(w));
}

export function answerClubMatchQuery(question,state,context,now,dateQuestion){
 const prior=context.matchQuery,detail=text(question).match(/^(?:y )?(?:en que cancha|donde|a que hora|cuando)\b/);
 if(prior&&detail&&!dateQuestion?.date){const subject=prior.subject,href=urlFor(subject),m=prior.match;if(m){const wantsTime=/hora|cuando/.test(text(question));return response(subject.label+' vs. '+m.rival+' · '+shortDate(m.fecha)+'. '+(wantsTime?(m.hora?'Horario: '+m.hora+' h.':'El horario no está confirmado.'):(m.cancha?'Cancha: '+m.cancha+'.':'La cancha no está registrada para ese partido.')),{context,items:[link('Ver partido en la categoría',href)]});}return response('¿Querés saber los datos del próximo partido o del último resultado?',{choices:[{label:'Próximo partido',question:'Próximo partido de '+subject.label,resolution:subject},{label:'Último resultado',question:'Último resultado de '+subject.label,resolution:subject}],context});}
 let raw=question,plan=interpretMatchQuestion(raw,now,context.matchQuery?.plan,dateQuestion),subjects=[];
 const pending=context.pendingMatchQuery,resolution=context.resolution;
 if(pending&&!plan&&text(raw).split(' ').length<=5){subjects=resolveClubCategories(raw,state.sports||[],resolution);if(pending.candidates)subjects=subjects.filter(s=>pending.candidates.some(c=>s.kind===c.kind&&s.sport===c.sport&&s.category===c.category));if(subjects.length){plan=pending.plan;raw=pending.question;}}
 if(!plan)return null;if(plan.invalid)return response('El período indicado no es válido. Usá fechas día/mes y un inicio anterior al final.');
 if(!subjects.length)subjects=resolveClubCategories(raw,state.sports||[],resolution);
 const data=state.interno,aggregate=['count','record','rate','goalsFor','goalsAgainst','average','streak','list'].includes(plan.operation);
 if(!subjects.length&&data&&(aggregate||context.matchQuery?.subject?.kind==='interno')){
  const q=' '+text(raw)+' ',all=data.teams.map(t=>({kind:'interno',teamId:t.id,categoryId:t.categoryId,label:t.name+' (Interno · '+data.categories.find(c=>c.id===t.categoryId)?.name+')',name:t.name}));
  subjects=resolution?.kind==='interno'?all.filter(t=>t.teamId===resolution.teamId):all.filter(t=>q.includes(' '+text(t.name)+' '));
  if(!subjects.length){const tokens=text(raw).split(' ').filter(w=>w.length>=4&&!['partidos','partidso','cuantos','ganados','perdidos','empates','resultado','resultados','interno','proximo'].includes(w));subjects=all.filter(t=>tokens.some(w=>text(t.name).split(' ').some(word=>word.startsWith(w))));}
 }
 if(!subjects.length&&contextFollowup(question)&&context.matchQuery?.subject)subjects=[context.matchQuery.subject];
 if(!subjects.length&&aggregate&&contextFollowup(question)&&context.teamId&&data){const t=data.teams.find(t=>t.id===context.teamId);if(t)subjects=[{kind:'interno',teamId:t.id,categoryId:t.categoryId,label:t.name+' (Interno)',name:t.name}];}
 if(!subjects.length){
  if(/\binterno\b/.test(text(raw))&&aggregate)return response('¿De qué equipo del Interno querés calcularlo? Escribí el nombre, por ejemplo: “cuántos partidos ganó Rapiñeros este año”.',{context:{pendingMatchQuery:{question:raw,plan}}});
  if(!state.interno&&/\b(rapineros|interno)\b/.test(text(raw)))return null;
  if(/\b(ceibos|club|futbol|hockey|rugby|basket|basquet)\b/.test(text(raw))||aggregate)return response('¿De qué equipo, deporte y categoría querés consultar los partidos?',{choices:(state.sports||[]).map(s=>({label:s.name,question:raw+' de '+s.name})),context:{pendingMatchQuery:{question:raw,plan}}});
  return null;
 }
 if(subjects.length>1)return response('¿Qué equipo o categoría querés consultar? Mantengo tu pregunta y el período indicado.',{choices:subjects.slice(0,10).map(s=>({label:s.label,question:raw,resolution:{...s}})),context:{pendingMatchQuery:{question:raw,plan,candidates:subjects}}});
 const subject=subjects[0],href=urlFor(subject),nextContext={matchQuery:{subject,plan},...(subject.kind==='interno'?{teamId:subject.teamId}:{})},period=plan.period,today=todayAt(now),label=subject.label,where=plan.location==='home'?' de local':plan.location==='away'?' de visitante':'';
 if(subject.kind!=='interno'&&(state.clubResultsReady===false||!Array.isArray(state.clubResults)))return response('Todavía estoy cargando los resultados del club. No voy a calcular el total con datos incompletos.',{waiting:'club',context:nextContext,items:[link('Ver categoría',href)]});
 if(plan.operation==='next'||plan.future){
  const fixtures=subject.kind==='interno'?data.matches.filter(m=>m.status==='scheduled'&&(m.homeId===subject.teamId||m.awayId===subject.teamId)).map(m=>({rival:data.teams.find(t=>t.id===(m.homeId===subject.teamId?m.awayId:m.homeId)).name,fecha:m.date,hora:m.time,cancha:m.court||m.venue,local:m.homeId===subject.teamId})):(state.clubMatches||[]).filter(r=>text(r.deporte)===text(subject.sport)&&text(r.categoria)===text(subject.category));
  let games=fixtures.filter(r=>validDate(r.fecha)&&r.fecha>=today&&(!period.from||r.fecha>=period.from)&&(!period.to||r.fecha<=period.to)&&(!plan.location||r.local===(plan.location==='home'))).sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'99:99').localeCompare(b.hora||'99:99'));
  if(plan.opponent||resolution?.opponent){
   const names=[...new Set(fixtures.map(r=>r.rival))],query=resolution?.opponent||plan.opponent,needle=text(query),candidates=names.filter(name=>text(name)===needle||text(name).includes(needle));
   if(candidates.length!==1)return response(candidates.length?'¿A qué rival te referís? Mantengo la categoría y el período.':'No encontré el rival “'+query+'” en el fixture de '+label+'. No voy a contar partidos contra otros rivales.',{choices:(candidates.length?candidates:names).slice(0,8).map(name=>({label:name,question:raw,resolution:{...subject,opponent:name,label:name}})),context:{pendingMatchQuery:{question:raw,plan,candidates:[subject]}}});
   plan.opponent=candidates[0];games=games.filter(r=>r.rival===plan.opponent);
  }
  if(plan.operation==='count')return response('Hay '+games.length+' '+(games.length===1?'partido futuro publicado':'partidos futuros publicados')+' de '+label+where+(period.label?' '+period.label:'')+'. Solo cuento los encuentros cargados en la web.',{context:nextContext,items:[link('Ver fixture de la categoría',href)]});
  if(plan.operation==='list')return response('Próximos partidos publicados de '+label+(period.label?' '+period.label:'')+': '+games.length+'.',{context:nextContext,items:games.slice(0,15).map(g=>link('Ver categoría',href,shortDate(g.fecha)+' · vs. '+g.rival+' · '+(g.hora?g.hora+' h':'Horario a confirmar')+' · '+(g.cancha||'Cancha a confirmar'))).concat([link('Ver fixture completo',href)])});
  const game=games[0];if(game)nextContext.matchQuery.match=game;return response(game?label+' juega contra '+game.rival+' el '+shortDate(game.fecha)+(game.hora?' a las '+game.hora+' h':', horario a confirmar')+(game.cancha?', en '+game.cancha:', cancha a confirmar')+'.':'No tengo un próximo partido publicado de '+label+(period.label?' '+period.label:'')+'.',{context:nextContext,items:[link('Ver categoría',href)]});
 }
 const inputs=subject.kind==='interno'?data.matches.filter(m=>m.status==='finished'&&(m.homeId===subject.teamId||m.awayId===subject.teamId)).map(m=>({matchId:m.id,rival:data.teams.find(t=>t.id===(m.homeId===subject.teamId?m.awayId:m.homeId)).name,fecha:m.date,hora:m.time,gf:m.homeId===subject.teamId?m.homeGoals:m.awayGoals,gc:m.homeId===subject.teamId?m.awayGoals:m.homeGoals,local:m.homeId===subject.teamId})):state.clubResults;
 const normalized=resultRows(inputs,subject,today);let games=normalized.rows.filter(r=>(!period.from||r.fecha>=period.from)&&(!period.to||r.fecha<=period.to)).sort((a,b)=>b.fecha.localeCompare(a.fecha)||(b.hora||'').localeCompare(a.hora||''));
 let opponent='';
 if(plan.opponent||resolution?.opponent){
  const names=[...new Set(normalized.rows.map(r=>r.rival))],query=resolution?.opponent||plan.opponent,needle=text(query),candidates=names.filter(name=>text(name)===needle||text(name).includes(needle));
  if(candidates.length!==1)return response(candidates.length?'¿A qué rival te referís? Mantengo la categoría y el período.':'No encontré el rival “'+query+'” entre los resultados de '+label+'. No voy a sumar partidos contra otros rivales.',{choices:(candidates.length?candidates:names).slice(0,8).map(name=>({label:name,question:raw,resolution:{...subject,opponent:name,label:name}})),context:{pendingMatchQuery:{question:raw,plan,candidates:[subject]}}});
  opponent=candidates[0];plan.opponent=opponent;games=games.filter(r=>r.rival===opponent);
 }
 let unknownLocation=0;if(plan.location){unknownLocation=games.filter(r=>typeof r.local!=='boolean').length;games=games.filter(r=>r.local===(plan.location==='home'));}
 if(plan.lastNOutcome)games=games.filter(r=>outcomeMatch(r,plan.outcome));if(plan.lastN)games=games.slice(0,plan.lastN);
 const selected=games.filter(r=>outcomeMatch(r,plan.outcome)),goalOperation=['goalsFor','goalsAgainst','average'].includes(plan.operation),summary=stats(goalOperation?selected:games),count=selected.length,condition=goalOperation?(plan.outcome==='win'?' en los partidos ganados':plan.outcome==='loss'?' en los partidos perdidos':plan.outcome==='draw'?' en los partidos empatados':''):'',span=condition+(period.label?' '+period.label:'')+where+(opponent?' contra '+opponent:'');
 const source='Calculado con los resultados publicados en Ceibos hasta el '+shortDate(today)+'.'+(normalized.conflicts?' Se omitieron '+normalized.conflicts+' resultados contradictorios.':'')+(unknownLocation?' Hay '+unknownLocation+' resultados sin condición de local/visitante registrada, que no se incluyeron.':'');
 if(!summary.played)return response(unknownLocation?'No puedo calcular '+label+span+' porque '+unknownLocation+' resultados no tienen registrada la condición de local/visitante.':games.length?'No hay partidos publicados que cumplan esa condición de '+label+span+'.':'No tengo resultados confirmados de '+label+span+'. Esto no significa que haya ganado cero partidos: no hay datos suficientes para calcularlo.',{context:nextContext,source,items:[link('Ver historial de la categoría',href)]});
 const record=plural(summary.played,'jugado','jugados')+' · '+plural(summary.wins,'victoria','victorias')+' · '+plural(summary.draws,'empate','empates')+' · '+plural(summary.losses,'derrota','derrotas')+'.';
 let answer;
 if(plan.operation==='count')answer=label+(plan.outcome==='win'?' ganó ':plan.outcome==='loss'?' perdió ':plan.outcome==='draw'?' empató ':plan.outcome==='notWin'?' no ganó ':' jugó ')+count+' '+(count===1?'partido':'partidos')+span+'.';
 else if(plan.operation==='record')answer='Balance de '+label+span+': '+record;
 else if(plan.operation==='goalsFor'||plan.operation==='goalsAgainst')answer=label+(plan.operation==='goalsFor'?' marcó '+plural(summary.gf,'gol','goles'):' recibió '+plural(summary.gc,'gol','goles'))+span+', en '+plural(summary.played,'partido registrado','partidos registrados')+'.';
 else if(plan.operation==='rate')answer=label+(plan.outcome==='draw'?' empató':plan.outcome==='loss'?' perdió':' ganó')+' el '+new Intl.NumberFormat('es-UY',{maximumFractionDigits:2}).format(count/summary.played*100)+'% de sus partidos'+span+' ('+count+' de '+summary.played+').';
 else if(plan.operation==='average')answer=label+' promedió '+new Intl.NumberFormat('es-UY',{maximumFractionDigits:2}).format((plan.goalsAgainst?summary.gc:summary.gf)/summary.played)+' goles '+(plan.goalsAgainst?'recibidos':'a favor')+' por partido'+span+'.';
 else if(plan.operation==='streak'){let streak=0;for(const game of games){if(!outcomeMatch(game,plan.outcome))break;streak++;}const run=plan.outcome==='win'?plural(streak,'victoria consecutiva','victorias consecutivas'):plan.outcome==='loss'?plural(streak,'derrota consecutiva','derrotas consecutivas'):plan.outcome==='draw'?plural(streak,'empate consecutivo','empates consecutivos'):plural(streak,'partido','partidos')+(plan.outcome==='unbeaten'?' sin perder':' sin ganar');answer=label+' lleva '+run+span+'.';}
 else if(plan.operation==='last'){const game=(plan.lastOutcome?selected:games)[0];if(game)nextContext.matchQuery.match=game;answer=game?label+' '+(won(game)?'ganó':lost(game)?'perdió':'empató')+' '+game.gf+'–'+game.gc+' contra '+game.rival+' el '+shortDate(game.fecha)+'.':'No hay un resultado que coincida con esa condición'+span+'.';}
 else answer=(plan.outcome==='win'?'Victorias':plan.outcome==='loss'?'Derrotas':plan.outcome==='draw'?'Empates':'Resultados')+' de '+label+span+': '+count+' '+(count===1?'partido registrado':'partidos registrados')+'.';
 const items=[link('Ver historial y resultados',href,plan.operation==='record'?'':record)];
 if(plan.operation==='list')for(const game of selected.slice(0,15))items.push(link('Ver categoría',href,scoreLine(game)));
 if(plan.operation==='list'&&selected.length>15)items.push(link('Ver el resto del historial',href,'Se muestran 15 de '+selected.length+' resultados.'));
 return response(answer,{context:nextContext,source,items,intent:'match-query'});
}
