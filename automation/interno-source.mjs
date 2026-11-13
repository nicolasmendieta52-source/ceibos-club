import {validateInterno} from '../assets/interno-model.js';
export const INTERNO_SOURCE='https://interno2026.ceibosfutbol.workers.dev/';
export const PUBLIC_SCRIPT='https://script.google.com/macros/s/AKfycby6uKKfOzV8tgNxWSwbVgeiV9IGohws3Uq9IIBw6QAZi4AwvNwwdclDRmFEKk-JWxrtcQ/exec';
const categoryIds={M:'masculino',F:'femenino',P:'mas38'},prefixes={M:'mas',F:'fem',P:'papi'};
const aliases={'real alta gama':'real-alta-gama','la bomb squad':'la-bomb-squad','fishermans':'fishermans','la vuelta fc':'la-vuelta','garrulos fc':'garrulos-fc','canuya fc':'la-canuya','orleans fc':'orleans','la naranja mecanica':'la-naranja-mecanica','matanza':'la-matanza','levantate fc':'levantate-fc','ramillete fc':'ramillete','purohumo fc':'purohumo-fc','deportivo resaca':'deportivo-resaca'};
const fold=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const label=(value,max=120)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error('Texto público del Interno inválido');return value.trim();};
const number=value=>{if(!Number.isSafeInteger(value)||value<0)throw Error('Contador del Interno inválido');return value;};
const absent=value=>value===null||value===undefined||value==='';
const score=value=>absent(value)?null:number(value);
function groupId(code,value){return prefixes[code]+'-'+label(value,16).toLowerCase();}
function publicTime(value){if(absent(value))return null;const match=/^(\d{1,2}):([0-5]\d)$/.exec(String(value).trim());if(!match||+match[1]>23)throw Error('Hora de la fuente inválida');return match[1].padStart(2,'0')+':'+match[2];}
function court(value){if(absent(value))return null;const name=label(String(value),100);return /^\d+$/.test(name)?'Cancha '+name:name;}
const roundNames={grupos:'Fase de grupos','16avos':'16avos de final',octavos:'Octavos de final',cuartos:'Cuartos de final',semifinal:'Semifinal',final:'Final'};

function activeTeamIds(remote){
  const ids=new Set();
  for(const group of remote.grupos){
    if(!Array.isArray(group.tabla)||!group.tabla.length)throw Error('Tabla de grupo vacía');
    for(const row of group.tabla)ids.add(row.equipo_id);
  }
  for(const match of remote.partidos)for(const id of [match.local_id,match.visitante_id])if(!absent(id))ids.add(id);
  for(const row of remote.goleadores)ids.add(row.equipo_id);
  return ids;
}

function emptyPapiCategory(source){
  const papi=source.categorias.P;
  return papi&&['grupos','partidos','goleadores'].every(key=>Array.isArray(papi[key])&&!papi[key].length)
    &&!Object.values(source.equipos).some(team=>team.categoria==='P');
}

export function mergeInternoSource(previous,source,{now=new Date().toISOString()}={}){
  validateInterno(previous);
  if(!source||typeof source.torneo!=='string'||!/\b2026\b/.test(source.torneo)||!source.equipos||Array.isArray(source.equipos)||!source.categorias||!Object.keys(source.equipos).length)throw Error('La fuente no contiene el Interno 2026 completo');
  if(Object.keys(source.categorias).some(code=>!Object.hasOwn(categoryIds,code)))throw Error('La fuente agregó una categoría con datos; revisar su correspondencia antes de importar');
  const selected=Object.entries(categoryIds).filter(([code])=>code!=='P'||(source.categorias.P&&!emptyPapiCategory(source)));
  const output=structuredClone(previous),covered=new Set(selected.map(([,id])=>id)),teamMap=new Map(),incomingTeams=[],incomingGroups=[],sourceStandings={},sourceScorers={},matches=[];let pending=0,byes=0;
  if(!covered.has('mas38')&&previous.teams.some(team=>team.categoryId==='mas38'&&team.sourceTeamId))throw Error('Papi fútbol desapareció de la fuente; se conserva la última versión');
  for(const[code,categoryId]of selected){
    const category=output.categories.find(row=>row.id===categoryId),remote=source.categorias[code];
    if(!category||!remote||!Array.isArray(remote.grupos)||!Array.isArray(remote.partidos)||!Array.isArray(remote.goleadores)||remote.partidos.length>2000)throw Error('Categoría de la fuente incompleta: '+code);
    // The public registry retains withdrawn teams. The standings and fixtures
    // identify the current participants, including a replacement with a new ID.
    const active=activeTeamIds(remote),entries=Object.entries(source.equipos).filter(([id,team])=>team.categoria===code&&active.has(id));
    if(!entries.length||entries.length>200)throw Error('Categoría de la fuente incompleta: '+code);
    if(category.format?.teamCount&&category.format.teamCount!==entries.length)throw Error('Cambió la cantidad de equipos; revisar el formato confirmado de '+category.name);
    if(category.format&&remote.grupos.length!==previous.groups.filter(group=>group.categoryId===categoryId).length)throw Error('Cambió la cantidad de grupos; revisar el formato confirmado de '+category.name);
    const used=new Set();
    for(const[externalId,remoteTeam]of entries){
      if(!/^[A-Za-z0-9_-]{1,60}$/.test(externalId))throw Error('Identidad de equipo inválida');
      const name=label(remoteTeam.nombre),known=previous.teams.filter(team=>team.categoryId===categoryId),existing=known.find(team=>team.sourceTeamId===externalId)||known.find(team=>fold(team.name)===fold(name)||fold(team.id)===fold(name)||team.id===aliases[fold(name)]);
      const id=existing?.id||categoryId+'-'+fold(name).replace(/ /g,'-');if(used.has(id))throw Error('Dos equipos de la fuente se asociaron al mismo escudo');used.add(id);
      const equivalent=existing&&(fold(existing.name)===fold(name)||fold(existing.id)===fold(name)||existing.id===aliases[fold(name)]);
      const row={...(existing||{sourceUrl:INTERNO_SOURCE}),id,name:equivalent?existing.name:name,categoryId,sourceTeamId:externalId,sourceName:name};
      if(!absent(remoteTeam.grupo))row.groupId=groupId(code,remoteTeam.grupo);else delete row.groupId;
      teamMap.set(externalId,row);incomingTeams.push(row);
    }
    for(const remoteGroup of remote.grupos){
      const id=groupId(code,remoteGroup.grupo),existing=previous.groups.find(group=>group.id===id);if(!Array.isArray(remoteGroup.tabla)||!remoteGroup.tabla.length)throw Error('Tabla de grupo vacía');
      incomingGroups.push({...existing,id,categoryId,name:existing?.name||'Grupo '+label(remoteGroup.grupo),...(existing?.sourceUrl?{}:{sourceUrl:INTERNO_SOURCE})});
    }
  }
  const teamOrder=new Map(previous.teams.map((team,index)=>[team.id,index]));incomingTeams.sort((a,b)=>(teamOrder.get(a.id)??10000)-(teamOrder.get(b.id)??10000)||a.id.localeCompare(b.id));
  output.teams=[...incomingTeams,...previous.teams.filter(team=>!covered.has(team.categoryId))];
  output.groups=[...previous.groups.filter(group=>!covered.has(group.categoryId)),...incomingGroups];
  for(const[code,categoryId]of selected){
    const remote=source.categorias[code],category=output.categories.find(row=>row.id===categoryId);
    sourceStandings[categoryId]=remote.grupos.map(group=>{
      const id=groupId(code,group.grupo),metadata=output.groups.find(row=>row.id===id);
      const rows=group.tabla.map(row=>{const team=teamMap.get(row.equipo_id);if(!team||team.categoryId!==categoryId||team.groupId!==id)throw Error('Equipo de tabla mal asignado');
        const played=number(row.pj),won=number(row.pg),drawn=number(row.pe),lost=number(row.pp),gf=number(row.gf),ga=number(row.gc),points=row.pts;
        if(won+drawn+lost!==played||!Number.isInteger(points)||row.dg!==gf-ga)throw Error('Tabla de posiciones inconsistente');
        // Papi's official table is authoritative; do not infer a scoring rule
        // from empty tables or reuse the other categories' points configuration.
        const adjustment=category.points?points-won*category.points.win-drawn*category.points.draw-lost*category.points.loss:0;
        return {teamId:team.id,name:team.name,position:number(row.pos),played,won,drawn,lost,gf,ga,gd:gf-ga,points,adjustment,adjustmentNote:adjustment?'Puntaje publicado en la fuente del Interno.':'',tied:false};
      });
      if(rows.every(row=>row.played===0))for(const row of rows)row.position=null;
      return {...metadata,rows};
    });
    let position=1;sourceScorers[categoryId]=remote.goleadores.map((row,index)=>{const team=teamMap.get(row.equipo_id),goals=number(row.goles);if(!team||team.categoryId!==categoryId||!goals)throw Error('Goleador de la fuente inválido');if(index&&goals>remote.goleadores[index-1].goles)throw Error('Goleadores fuera de orden');if(index&&goals!==remote.goleadores[index-1].goles)position=index+1;return {player:label(row.nombre,100),teamId:team.id,teamName:team.name,goals,position};});
    if(!remote.partidos.length&&previous.matches.some(match=>match.categoryId===categoryId&&match.sourceId))throw Error('La fuente devolvió un fixture vacío; se conserva la última versión');
    for(const item of remote.partidos){
      if(item.estado==='bye'){byes++;continue;}
      if(!Object.hasOwn(roundNames,item.fase))throw Error('Fase de la fuente no reconocida');
      const home=teamMap.get(item.local_id),away=teamMap.get(item.visitante_id);
      if(!home||!away){if(item.fase!=='grupos'&&absent(item.gl)&&absent(item.gv)){pending++;continue;}throw Error('Partido con equipos desconocidos');}
      if(home.categoryId!==categoryId||away.categoryId!==categoryId)throw Error('Partido entre categorías distintas');
      if(!/^[A-Za-z0-9_-]{1,60}$/.test(item.id))throw Error('Identidad de partido inválida');
      const gl=score(item.gl),gv=score(item.gv);if((gl===null)!==(gv===null))throw Error('Marcador incompleto');
      const statusMap={programado:'scheduled',pendiente:'scheduled',confirmado:'scheduled',en_juego:'scheduled',jugado:'finished',finalizado:'finished',terminado:'finished',suspendido:'suspended',postergado:'postponed',cancelado:'cancelled'};
      let status=statusMap[item.estado];if(!status)throw Error('Estado del partido no reconocido');if(gl!==null&&status==='scheduled')status='finished';if(status==='finished'&&gl===null)throw Error('Resultado final sin marcador');
      const interzonal=code==='P'&&item.fase==='grupos'&&item.grupo==='IZ'&&!item.copa;
      const isGroup=item.fase==='grupos'&&!item.copa&&!interzonal,old=previous.matches.find(match=>match.categoryId===categoryId&&match.sourceId===item.id);
      const row={id:old?.id||'src-'+code.toLowerCase()+'-'+item.id.toLowerCase(),categoryId,homeId:home.id,awayId:away.id,stage:interzonal?'interzonal':isGroup?'groups':'playoffs',status,sourceId:item.id,sourceUrl:INTERNO_SOURCE};
      if(isGroup)row.groupId=groupId(code,item.grupo);row.round=[interzonal?'Interzonal':roundNames[item.fase],(isGroup||interzonal)&&item.jornada?'Fecha '+number(item.jornada):'',!isGroup&&item.copa?'Copa '+label(item.copa,30):''].filter(Boolean).join(' · ');
      if(!absent(item.fecha))row.date=label(item.fecha,10);const time=publicTime(item.hora),name=court(item.cancha);if(time)row.time=time;if(name)row.court=name;
      if(status==='finished'){
        row.homeGoals=gl;row.awayGoals=gv;const pl=score(item.pl),pv=score(item.pv);if((pl===null)!==(pv===null))throw Error('Penales incompletos');if(pl!==null)row.penalties={home:pl,away:pv};
        const scorers=new Map();if(!Array.isArray(item.eventos))throw Error('Eventos del partido inválidos');
        for(const event of item.eventos){if(event.t!=='gol'||absent(event.j))continue;const team=teamMap.get(event.eq);if(!team||![home.id,away.id].includes(team.id))throw Error('Gol de equipo ajeno al partido');const player=label(event.j,100),key=team.id+'|'+fold(player),entry=scorers.get(key)||{player,teamId:team.id,goals:0};entry.goals++;scorers.set(key,entry);}
        row.scorers=[...scorers.values()];
      }
      // A manual correction of the real kickoff remains local; the source owns the announced schedule.
      if(old?.startedAt&&old.date===row.date&&old.time===row.time&&row.status==='scheduled')row.startedAt=old.startedAt;
      matches.push(row);
    }
  }
  output.matches=[...previous.matches.filter(match=>!covered.has(match.categoryId)),...matches];output.sourceStandings={...previous.sourceStandings,...sourceStandings};output.sourceScorers={...previous.sourceScorers,...sourceScorers};
  output.sourceInfo={url:INTERNO_SOURCE,intervalMinutes:60,importedAt:now,checkedAt:now,sourceUpdatedAt:label(source.actualizado,80),categories:[...covered],pendingPlayoffs:pending,byes};
  validateInterno(output);return output;
}

export function sameInternoSnapshot(left,right){const withoutTime=value=>{const data=structuredClone(value);if(data.sourceInfo)for(const key of ['importedAt','checkedAt','sourceUpdatedAt'])delete data.sourceInfo[key];return data;};return JSON.stringify(withoutTime(left))===JSON.stringify(withoutTime(right));}
