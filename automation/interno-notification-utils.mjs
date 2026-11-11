import {createHash} from 'node:crypto';
import {validateInterno} from '../assets/interno-model.js';
import {fechaMontevideo,horaMontevideo,instanteInicio,minutosDesdeInicio} from './notification-utils.mjs';
export {siguePartidoInterno} from '../assets/interno-notification-preferences.js';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
const statusNames={scheduled:'Programado',postponed:'Postergado',suspended:'Suspendido',finished:'Finalizado',cancelled:'Cancelado'};

export function partidosInterno(data){
  validateInterno(data);
  return data.matches.map(match=>{
    const home=data.teams.find(team=>team.id===match.homeId),away=data.teams.find(team=>team.id===match.awayId),category=data.categories.find(category=>category.id===match.categoryId),group=data.groups.find(group=>group.id===match.groupId);
    return {deporte:'interno',categoria:category.name,rival:home.name+' vs. '+away.name,fecha:match.date||'',hora:match.time||'',cancha:match.venue||'',estado:statusNames[match.status],internoId:data.season+'|'+match.id,internoMatchId:match.id,internoCategoryId:match.categoryId,internoTeamIds:[home.id,away.id],homeName:home.name,awayName:away.name,internoStatus:match.status,homeGoals:match.homeGoals??null,awayGoals:match.awayGoals??null,penalties:match.penalties||null,doubleForfeit:match.doubleForfeit===true,fase:match.round||group?.name||(match.stage==='playoffs'?'Eliminatorias':'Fase de grupos')};
  });
}

export function destinoInterno(partido,tipo){
  return '/?internoCategoria='+encodeURIComponent(partido.internoCategoryId)+'&internoTab='+(tipo==='result'?'resultados':'fixture')+'&internoPartido='+encodeURIComponent(partido.internoMatchId)+'#interno';
}

function detalle(partido,includeDate=false){
  const date=includeDate&&partido.fecha?new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(partido.fecha+'T12:00:00Z'))+' · ':'';
  return date+partido.homeName+' vs. '+partido.awayName+' · '+(partido.hora?partido.hora+' h':'Horario a confirmar')+(partido.cancha?' · '+partido.cancha:'');
}

export function crearMensajeInterno(tipo,partidos,ahora=new Date()){
  const matches=[...partidos].sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.hora.localeCompare(b.hora)),match=matches[0];
  if(!match)throw Error('El aviso del Interno requiere un partido');
  const category=matches.every(item=>item.internoCategoryId===match.internoCategoryId)?' · '+match.categoria:'';
  let title,body;
  if(tipo==='result'){
    title=(match.resultUpdated?'Resultado actualizado':'Final')+' · Interno'+category;
    body=match.homeName+' '+match.homeGoals+'–'+match.awayGoals+' '+match.awayName+(match.penalties?' · Penales '+match.penalties.home+'–'+match.penalties.away:'')+(match.doubleForfeit?' · Doble incomparecencia':'');
  }else if(tipo==='start'){
    const minutes=Math.max(0,minutosDesdeInicio(match,ahora)||0);
    title=(minutes<1?'Arranca ahora':'Partido iniciado')+' · Interno'+category;
    body=(minutes>=1?'Comenzó hace '+minutes+' min · ':'')+detalle(match);
  }else if(tipo==='today'){
    title='Hoy se juega el Interno'+category;body=detalle(match);
  }else if(tipo==='change'){
    const label={cancelled:'Partido cancelado',postponed:'Partido postergado',suspended:'Partido suspendido'}[match.internoStatus]||'Fixture actualizado';
    title=label+' · Interno'+category;body=detalle(match,true);
  }else{title='Nuevo partido del Interno'+category;body=detalle(match,true);}
  if(matches.length>1){title=(tipo==='start'?'Arrancan partidos':tipo==='today'?'Hoy se juega':'Novedades')+' · Interno'+category;body=matches.length+' partidos de tu selección. '+detalle(match,tipo==='new');}
  return {title,body:body.slice(0,500),url:destinoInterno(match,tipo),tag:'ceibos-interno-'+tipo+'-'+digest(matches.map(item=>[item.internoId,item.fecha,item.hora])),renotify:['start','today','result','change'].includes(tipo),ttl:tipo==='start'?15*60:24*60*60};
}

export function detectarEventosInterno(data,previous={},ahora=new Date()){
  const matches=partidosInterno(data),hoy=fechaMontevideo(ahora),recent=new Date(Date.parse(hoy+'T12:00:00Z')-2*86400000).toISOString().slice(0,10),events=[],snapshots={};
  const state={version:1,initialized:true,matches:{},sent:{...(previous.sent||{})}};
  const add=(tipo,partido,version='')=>{const key=tipo+'|'+partido.internoId+'|'+version;if(!state.sent[key])events.push({key,tipo,partido});};
  for(const match of matches){
    const old=previous.matches?.[match.internoId],start=instanteInicio(match);
    const schedule=digest([match.internoTeamIds,match.fecha,match.hora,match.cancha,match.internoStatus,match.fase]);
    const result=digest([match.homeGoals,match.awayGoals,match.penalties,match.doubleForfeit]);
    snapshots[match.internoId]={schedule,result,status:match.internoStatus};
    if(match.internoStatus==='scheduled'&&match.fecha>=hoy&&(start===null||start>ahora.getTime())){
      if(!old&&!(match.fecha===hoy&&horaMontevideo(ahora)>=9*60))add('new',match);
      if(match.fecha===hoy&&horaMontevideo(ahora)>=9*60)add('today',match,hoy);
    }
    if(old&&old.schedule!==schedule&&match.internoStatus!=='finished'&&(!match.fecha||match.fecha>=recent))add('change',match,schedule);
    if(previous.initialized&&match.internoStatus==='finished'&&(!match.fecha||match.fecha>=recent)&&(!old||old.status!=='finished'||old.result!==result))add('result',{...match,resultUpdated:old?.status==='finished'},result);
  }
  state.matches=snapshots;
  for(const [key,value] of Object.entries(state.sent))if(!Number.isFinite(Date.parse(value))||Date.parse(value)<ahora.getTime()-150*86400000)delete state.sent[key];
  return {events,state};
}
