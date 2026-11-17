import {answerClubQuestion,clubToday,questionDate} from './club-assistant-model.js?v=20261117conversacion';
import {answerStructuredClubQuestion} from './club-assistant-data.js?v=20261117conversacion';
import {normalizeClubQuestion,fold,teamCandidates,canonicalTeamQuestion,questionTopic} from './club-assistant-language.js?v=20261117conversacion';
import {resolveClubCategories} from './club-assistant-matches.js?v=20261117conversacion';
import {retrieveClubFacts} from './club-assistant-facts.js?v=20261117conversacion';

const reply=(text,extra={})=>({text,items:[],choices:[],context:{},...extra});
const link=(label,href,text='')=>({label,href,text});
const labelFor=(entity,state)=>entity?.kind==='club'?entity.label:entity?.kind==='interno'?state.interno?.teams.find(t=>t.id===entity.teamId)?.name:null;
const withoutMemory=context=>{const {conversation,resolution,...rest}=context;return rest;};
const correctionPrefix=/^(?:no[,\s]+|me referia a\s+|quise decir\s+|era\s+)/;
const days='lunes|martes|miercoles|jueves|viernes|sabado|domingo|hoy|manana|ayer';

function entityFrom(answer,state,question){
 if(answer.context?.tableSubject)return answer.context.tableSubject;
 if(answer.context?.matchQuery?.subject)return answer.context.matchQuery.subject;
 const team=state.interno?.teams.find(t=>t.id===answer.context?.teamId);
 if(team)return {kind:'interno',teamId:team.id,categoryId:team.categoryId,name:team.name};
 const found=teamCandidates(question,state.interno);return found.teams.length===1&&!found.approximate?{kind:'interno',teamId:found.teams[0].id,name:found.teams[0].name}:null;
}

function relatedQuestions(question,answer,state,topic){
 if(answer.choices?.length||answer.waiting||answer.repair||answer.unavailable)return [];
 const entity=entityFrom(answer,state,question),label=labelFor(entity,state),q=fold(question),choices=[];
 if(topic==='gym'){
  if(!/\bfalta|faltan\b/.test(q))choices.push({label:'Cuánto falta',question:'¿Cuánto falta para la meta del Gym?'});
  if(!/\b(colabor|aportar)/.test(q))choices.push({label:'Cómo colaborar',question:'¿Cómo colaboro con el Gym?'});
 }else if(label){
  if(!/\b(proximo|proximos|juega|fixture)\b/.test(q))choices.push({label:'Próximo partido',question:'¿Contra quién juega '+label+' próximamente?'});
  if(entity.kind==='interno'&&!/\b(puntos|tabla|posicion)\b/.test(q))choices.push({label:'Su tabla',question:'¿Cuántos puntos tiene '+label+'?'});
  else if(!/\b(balance|cuantos|victorias)\b/.test(q))choices.push({label:'Balance del año',question:'¿Cuántos partidos ganó '+label+' este año?'});
  if(choices.length<2&&!/\b(resultado|salio|perdio|gano)\b/.test(q))choices.push({label:'Último resultado',question:'¿Cuál fue el último resultado de '+label+'?'});
 }
 return choices.slice(0,2);
}

function finish(answer,question,state,previous,now,topic,extra={}){
 const context={...(answer.context||{})};delete context.resolution;delete context.conversation;
 const memory={question:extra.original||question,query:question,topic:topic||previous.topic||null,entity:entityFrom(answer,state,question),lastText:answer.text};
 if(answer.choices?.length)memory.pending={question,choices:answer.choices,mention:extra.mention||'',topic:memory.topic};
 if(answer.repair)memory.repairQuestion=previous.query||previous.question;
 context.conversation=memory;
 return {...answer,context,suggestions:answer.suggestions||relatedQuestions(question,answer,state,memory.topic)};
}

function choosePending(value,pending){
 const q=fold(value).replace(/^(?:la|el|los|las|de|del|la de|el de) /,'').trim();if(q.length<3)return [];
 return pending.choices.filter(c=>{const label=' '+fold(c.label)+' ';return label.includes(' '+q+' ')||q.split(' ').filter(w=>w.length>=3).every(w=>label.includes(' '+w+' '));});
}

function swapSubject(question,oldEntity,newEntity,state){
 let result=question;
 const oldLabel=labelFor(oldEntity,state),newLabel=labelFor(newEntity,state);
 if(oldEntity?.kind==='club'&&newEntity.kind==='interno')result=result.replace(new RegExp('\\b'+fold(oldEntity.category)+'\\b','g'),newLabel).replace(/\b(futbol|rugby|basketball|hockey)\b/g,'');
 else if(oldEntity?.kind==='interno'&&oldLabel&&newLabel)result=canonicalTeamQuestion(question,fold(oldLabel),{name:newLabel});
 return result;
}

function repairAnswer(previous,state){
 const label=labelFor(previous.entity,state),topic=previous.topic;
 let text='¿Qué dato buscabas? Podés reformular tu pregunta o indicar qué parte querés corregir.',choices=[];
 if(label){text='¿Qué querías saber de '+label+'?';choices=[{label:'Próximo partido',question:'¿Contra quién juega '+label+' próximamente?'},{label:'Último resultado',question:'¿Cuál fue el último resultado de '+label+'?'},{label:'Balance del año',question:'¿Cuántos partidos ganó '+label+' este año?'}];}
 else if(topic==='gym'){text='¿Qué querías saber del Gym?';choices=[{label:'Recaudación',question:'¿Cuánto recaudó el Gym?'},{label:'Cuánto falta',question:'¿Cuánto falta para la meta del Gym?'},{label:'Cómo colaborar',question:'¿Cómo colaboro con el Gym?'}];}
 return reply(text,{choices,repair:true,editQuestion:previous.query||previous.question||''});
}

function missingAttribute(question,state,context){
 const q=fold(question),price=/\b(precio|cuesta|costo|vale|cuota|entrada)\b/.test(q),training=/\b(entrena|entrenan|entrenamiento|entrenamientos|entrenador|tecnico|talles|talle)\b/.test(q),opening=/\b(inaugura|inauguran|inauguracion|abre|apertura)\b/.test(q)&&/\b(gym|gimnasio)\b/.test(q);
 if(/\b(vale|valen)\b/.test(q)&&/\b(victoria|empate|derrota)\b/.test(q))return null;
 if(!price&&!training&&!opening)return null;
 const bodyMatch=f=>price?/\b(precio|cuesta|costo|cuota|usd|uyu|pesos|dolares)\b|\$/.test(fold(f.text)):opening?/\b(inaugura|inauguracion|apertura)\b/.test(fold(f.text)):/\b(entrena|entrenan|entrenamiento|entrenamientos|entrenador|tecnico|talle|talles)\b/.test(fold(f.text));
 const facts=retrieveClubFacts(question,(state.facts||[]).filter(bodyMatch));
 if(facts.length)return reply(facts[0].text,{items:[link('Ver información publicada',facts[0].href)],intent:'information'});
 if(price&&/\b(cena|fiesta|cmc|evento)\b/.test(q))return reply('El precio de ese evento no está publicado en la web. Podés consultarlo con el club.',{items:[link('Consultar al club','#contacto')],unavailable:true});
 if(training)return reply('No encontré ese dato confirmado entre los horarios, responsables o talles publicados. Podés consultarlo con el club.',{items:[link('Consultar al club','#contacto')],unavailable:true});
 if(opening)return reply('No hay una fecha de inauguración del Gym confirmada en la información publicada.',{items:[link('Ver proyecto del gimnasio','#proyecto-gimnasio')],unavailable:true});
 if(price)return reply('No hay un precio confirmado publicado para esa consulta. Podés consultarlo con el club.',{items:[link('Consultar al club','#contacto')],unavailable:true});
 return null;
}

function eventDetail(question,state){
 const q=fold(question);if(!/\b(cena|fiesta|cmc|evento)\b/.test(q)||!/\b(donde|lugar|ubicacion|hora|horario)\b/.test(q))return null;
 const exact=(state.events||[]).filter(e=>(' '+q+' ').includes(' '+fold(e.titulo)+' '));if(exact.length!==1)return null;
 const event=exact[0],description=String(event.desc||''),time=/\b(hora|horario)\b/.test(q);
 if(time&&!/\b\d{1,2}:\d{2}\b/.test(description)||!time&&!/\b(en el|en la|lugar|sede|direccion|complejo|salon|restaurante)\b/.test(fold(description)))return reply('El '+(time?'horario':'lugar')+' de '+event.titulo+' todavía no está confirmado en la web.',{items:[link('Ver evento','#evento-'+event.fecha+'-'+fold(event.titulo).replace(/ /g,'-'))],unavailable:true});
 return reply(event.titulo+': '+description,{items:[link('Ver evento','#evento-'+event.fecha+'-'+fold(event.titulo).replace(/ /g,'-'))],intent:'event'});
}

function ageAnswer(question,state,now){
 if(!/\b(cuantos anos|edad)\b/.test(fold(question))||!/\b(ceibos|club)\b/.test(fold(question)))return null;
 const monthNames=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 const fact=(state.facts||[]).find(f=>/\b(nacio|fundado|fundo)\b/.test(fold(f.text))&&/\b\d{1,2} de [a-z]+ de \d{4}\b/.test(fold(f.text)));
 const date=fact&&fold(fact.text).match(/\b(\d{1,2}) de ([a-z]+) de (\d{4})\b/);if(!date||!monthNames.includes(date[2]))return null;
 const today=clubToday(now),birth=date[3]+'-'+String(monthNames.indexOf(date[2])+1).padStart(2,'0')+'-'+date[1].padStart(2,'0'),years=Number(today.slice(0,4))-Number(date[3])-(today.slice(5)<birth.slice(5)?1:0);
 return reply('Ceibos Club tiene '+years+' años. Nació el '+date[1]+' de '+date[2]+' de '+date[3]+'.',{items:[link('Ver historia del club',fact.href)],intent:'information'});
}

function helpAnswer(question){
 const q=fold(question);if(!/^(?:que (?:podes|puedo) (?:preguntar|consultar|hacer)|que sabes|ayuda|como funciona|que informacion tenes|que puedo ver)/.test(q))return null;
 return reply('Podés consultar próximos partidos, resultados, balances, tablas, goleadores, equipos y grupos del Interno, la recaudación del Gym y la información publicada del club.',{choices:[{label:'Partidos del Interno',question:'¿Qué partidos hay en el Interno esta semana?'},{label:'Recaudación del Gym',question:'¿Cuánto recaudó el Gym?'},{label:'Deportes y categorías',question:'¿Qué deportes hay en Ceibos?'},{label:'Próximo evento',question:'¿Cuál es el próximo evento de Ceibos?'}],intent:'help'});
}

export function answerClubConversation(value,state={},context={},now=Date.now(),depth=0){
 const original=String(value||'').trim().slice(0,300),previous=context.conversation||{},baseContext=withoutMemory(context);let question=normalizeClubQuestion(original),q=fold(question),queryContext={...baseContext,...(context.resolution?{resolution:context.resolution}:{})},topic=questionTopic(question),mention='';
 const done=(answer,extra={})=>finish(answer,question,state,previous,now,topic,{original,...extra});
 if(depth===0){
  const parts=original.split(/[?;]\s*(?:y\s+)?(?=¿?[a-záéíóúñ])/i).map(p=>p.trim()).filter(Boolean);
  if(parts.length===2){const first=answerClubConversation(parts[0],state,context,now,1),replies=[first,answerClubConversation(parts[1],state,first.choices?.length?context:first.context,now,1)],pending=replies.findIndex(a=>a.choices?.length),waiting=replies.find(a=>a.waiting);if(waiting)return waiting;
   if(pending>=0){const other=replies[1-pending],chosen=replies[pending];return {...chosen,text:(other.choices?.length?'':other.text+'\n\n')+chosen.text};}
   const last=replies[1];return {...last,text:replies.map(a=>a.text).join('\n\n'),items:replies.flatMap(a=>a.items||[]),source:[...new Set(replies.map(a=>a.source).filter(Boolean))].join(' ')};
  }
 }
 if(/^(gracias|muchas gracias|mil gracias|perfecto|buenisimo|genial|dale gracias|ok gracias|ta gracias|no gracias)[ !.]*$/.test(question))return {...reply('¡De nada! Cuando quieras, seguimos con otra consulta.',{context:{...baseContext,conversation:previous},intent:'social'}),suggestions:[]};
 if(/^(no|eso no|no era eso|no me entendiste|no es lo que buscaba|esta mal|respuesta incorrecta)[ !.]*$/.test(question)&&previous.question)return done(repairAnswer(previous,state));
 const help=helpAnswer(question);if(help)return done(help);
 if(/^y\b/.test(q)&&!previous.query&&!topic)return done(reply('¿Sobre qué equipo o tema querés consultar?',{choices:[{label:'El Gym',question:'¿Cuánto recaudó el Gym?'},{label:'El Interno',question:'¿Qué partidos hay en el Interno esta semana?'}]}));
 if(/\b(deportes)\b/.test(q)&&/\b(que|cuales|hay|practican|tiene)\b/.test(q)&&state.sports?.length)return done(reply('En Ceibos se practican '+state.sports.map(s=>s.name).join(', ')+'.',{items:[link('Ver deportes y categorías','#deportes')],intent:'information'}));

 if(previous.pending){
  const candidates=context.resolution?previous.pending.choices.filter(c=>JSON.stringify(c.resolution)===JSON.stringify(context.resolution)):q.split(' ').length<=5?choosePending(question,previous.pending):[];
  if(candidates.length===1){const choice=candidates[0];queryContext.resolution=choice.resolution;question=previous.pending.question;topic=previous.pending.topic;
   if(choice.resolution?.kind==='interno'){const team=state.interno?.teams.find(t=>t.id===choice.resolution.teamId);if(team)question=canonicalTeamQuestion(question,previous.pending.mention,team);}
   else if(!choice.resolution)question=choice.question;
  }else if(candidates.length>1&&!topic){question=previous.pending.question+' de '+question;topic=previous.pending.topic;}
 }

 if(correctionPrefix.test(question)&&previous.question){
  const correction=question.replace(correctionPrefix,''),clubs=resolveClubCategories(correction,state.sports||[]),teams=teamCandidates(correction,state.interno);
  if(clubs.length===1){question=previous.query;queryContext={...baseContext,resolution:clubs[0]};topic='sports';}
  else if(teams.teams.length===1&&!teams.approximate){const team=teams.teams[0],entity={kind:'interno',teamId:team.id,name:team.name};question=swapSubject(previous.query,previous.entity,entity,state);queryContext={...baseContext,resolution:entity,teamId:team.id};topic='interno';}
  else if(questionDate(correction,now).date){question=previous.query.replace(new RegExp('\\b(?:el |este |proximo |pasado )?(?:'+days+')(?: pasado| proximo| que viene)?\\b','g'),'').replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?\b/g,'')+' '+correction;queryContext={...baseContext};delete queryContext.date;delete queryContext.matchId;if(queryContext.matchQuery)queryContext.matchQuery={...queryContext.matchQuery,match:null};topic=previous.topic;}
  else if(/\b(local|visitante)\b/.test(correction)){question='y '+correction;topic=previous.topic;}
  else if(/\b(?:19|20)\d{2}\b|\b(ano pasado|este ano|esta temporada)\b/.test(correction)){question=previous.query.replace(/\b(?:19|20)\d{2}\b|\b(este ano|ano pasado|esta temporada)\b/g,'')+' '+correction;topic=previous.topic;}
 }
 q=fold(question);
 if(previous.topic==='gym'&&!topic&&/^(?:y |cuanto |cual |como )/.test(q)&&/\b(falta|faltan|meta|porcentaje|avance|lleva|colaboro|aporto|total)\b/.test(q)){question+=' del gym';topic='gym';}
 if(previous.topic==='events'&&!topic&&/^(?:y )?(?:donde|a que hora|cuanto cuesta)/.test(q)){const event=(state.events||[]).find(e=>fold(previous.query).includes(fold(e.titulo)));if(event){question+=' '+event.titulo;topic='events';}}
 if(previous.topic==='shop'&&!topic&&/\b(talle|talles|precio|cuesta|color|colores)\b/.test(q)){question+=' de la tienda de Ceibos';topic='shop';}
 if(/\binterno\b/.test(fold(previous.query||''))&&/^y\b/.test(q)&&/\b(femenino|masculino|papi)\b/.test(q)&&q.split(' ').length<=4){question=previous.query.replace(/\b(femenino|masculino|papi)\b/g,'')+' '+q.replace(/^y /,'');topic='interno';}
 if(baseContext.tableSubject&&/^y\b/.test(q)&&q.split(' ').length<=5){const subjects=resolveClubCategories(q,state.sports||[]);if(subjects.length===1){question=previous.query;queryContext.resolution=subjects[0];}else if(/\b(?:19|20)\d{2}\b|\b(ano pasado|este mes|mes pasado|octubre|noviembre|local|visitante)\b/.test(q))question=previous.query.replace(/\b(?:19|20)\d{2}\b|\b(este ano|ano pasado|esta temporada)\b/g,'')+' '+q.replace(/^y /,'');}
 if(topic&&previous.topic&&topic!==previous.topic&&!correctionPrefix.test(normalizeClubQuestion(original))&&!previous.pending&&!/^y\b/.test(q))queryContext=context.resolution?{resolution:context.resolution}:{};
 if(questionDate(question,now).invalid)return done(reply('Esa fecha no es válida. Usá una fecha real en formato día/mes/año o indicá un día de la semana.'));

 const missing=missingAttribute(question,state,queryContext);if(missing)return done(missing);
 const event=eventDetail(question,state);if(event)return done(event);
 const age=ageAnswer(question,state,now);if(age)return done(age);
 const intent=/\b(partido|partidos|juega|juegan|resultado|resultados|gano|perdio|empato|puntos|posicion|tabla|grupo|goleador|goleadores|cancha|cuando|hora)\b/.test(fold(question));
 if(intent&&!/\b(campeon|campeones|campeona|campeonas)\b/.test(fold(question))){
  const found=teamCandidates(question,state.interno),pair=found.teams.length===2&&/\b(contra|entre)\b/.test(fold(question))&&!found.approximate&&found.teams.every(t=>(' '+fold(question)+' ').includes(' '+fold(t.name)+' '));
  if(!pair&&(found.teams.length>1||found.approximate)){mention=found.mention;return done(reply(found.approximate?'¿Te referís a este equipo?':'¿Qué equipo querés consultar?',{choices:found.teams.slice(0,8).map(t=>({label:t.name+' · '+state.interno.categories.find(c=>c.id===t.categoryId)?.name,question,resolution:{kind:'interno',teamId:t.id,categoryId:t.categoryId,name:t.name}})),context:queryContext}),{mention});}
  if(found.teams.length===1&&!found.approximate&&found.mention!==fold(found.teams[0].name))question=canonicalTeamQuestion(question,found.mention,found.teams[0]);
 }
 const structured=answerStructuredClubQuestion(question,state,queryContext,now);if(structured)return done(structured);
 const answer=answerClubQuestion(question,state,queryContext,now);
 if(/^(No encontr[eé]|Encontr[eé] estas opciones)/.test(answer.text))answer.unavailable=true;
 return done(answer);
}
