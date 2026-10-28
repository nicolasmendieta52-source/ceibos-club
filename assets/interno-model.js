const text = (value,max=120) => typeof value==='string' && value.trim().length>0 && value.trim().length<=max;
const integer = n => Number.isInteger(n) && n>=0;
const id = value => typeof value==='string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value);
export function publicInternoUrl(value){
  if(typeof value!=='string'||!value.trim())return null;
  try {const url=new URL(value,'https://ceibosclub.com');return url.protocol==='https:'?url.href:null;}catch{return null;}
}
function unique(rows,label){const ids=new Set();for(const row of rows){if(!id(row.id)||ids.has(row.id))throw Error(`${label}: identificador inválido o duplicado`);ids.add(row.id);}return ids;}
export function validateInterno(data){
  if(data?.version!==1||data.season!==2026||!Array.isArray(data.categories)||!data.categories.length||!Array.isArray(data.teams)||!Array.isArray(data.groups)||!Array.isArray(data.matches))throw Error('Datos del Interno no válidos');
  const categories=unique(data.categories,'Categorías'),teams=unique(data.teams,'Equipos'),groups=unique(data.groups,'Series');unique(data.matches,'Partidos');
  for(const category of data.categories){
    if(!text(category.name))throw Error('Nombre de categoría inválido');
    if(category.points!==null&&(!category.points||!['win','draw','loss'].every(k=>integer(category.points[k]))))throw Error('Puntuación de categoría inválida');
  }
  for(const group of data.groups)if(!categories.has(group.categoryId)||!text(group.name))throw Error('Serie inválida');
  for(const team of data.teams){
    if(!text(team.name)||!categories.has(team.categoryId)||(team.groupId&&!groups.has(team.groupId)))throw Error('Equipo inválido');
    if(team.groupId&&data.groups.find(g=>g.id===team.groupId).categoryId!==team.categoryId)throw Error('Equipo y serie de categorías distintas');
    if(team.pointsAdjustment!==undefined&&!Number.isInteger(team.pointsAdjustment))throw Error('Ajuste de puntos inválido');
    if(team.pointsAdjustment&&!text(team.adjustmentNote,300))throw Error('El ajuste de puntos requiere motivo de la organización');
    if(team.logoUrl&&!publicInternoUrl(team.logoUrl))throw Error('Logo no válido');
    if(team.sourceUrl&&!publicInternoUrl(team.sourceUrl))throw Error('Fuente de equipo no válida');
  }
  for(const match of data.matches){
    if(!categories.has(match.categoryId)||!teams.has(match.homeId)||!teams.has(match.awayId)||match.homeId===match.awayId)throw Error('Equipos de partido inválidos');
    const pair=[match.homeId,match.awayId].map(teamId=>data.teams.find(t=>t.id===teamId));
    if(pair.some(t=>t.categoryId!==match.categoryId))throw Error('Partido entre categorías distintas');
    if(!['groups','playoffs'].includes(match.stage)||!['scheduled','postponed','suspended','finished','cancelled'].includes(match.status))throw Error('Fase o estado de partido inválido');
    if(match.stage==='groups'&&(!groups.has(match.groupId)||pair.some(t=>t.groupId!==match.groupId)))throw Error('Partido de serie mal asignado');
    if(match.date){const d=new Date(match.date+'T12:00:00Z');if(!/^2026-\d{2}-\d{2}$/.test(match.date)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==match.date)throw Error('Fecha inválida');}
    if(match.time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(match.time))throw Error('Horario inválido');
    if(match.status==='finished'&&(!integer(match.homeGoals)||!integer(match.awayGoals)))throw Error('Un resultado requiere los dos marcadores');
    if(match.penalties&&(!(match.stage==='playoffs'&&match.status==='finished'&&match.homeGoals===match.awayGoals)||!integer(match.penalties.home)||!integer(match.penalties.away)||match.penalties.home===match.penalties.away))throw Error('Tanda de penales inválida');
    if(match.doubleForfeit&&(match.status!=='finished'||match.homeGoals!==0||match.awayGoals!==0))throw Error('La doble incomparecencia se registra 0–0, sin puntos ni goles');
    if(match.scorers!==undefined&&!Array.isArray(match.scorers))throw Error('Goleadores inválidos');
    for(const scorer of match.scorers||[])if(!text(scorer.player,100)||![match.homeId,match.awayId].includes(scorer.teamId)||!integer(scorer.goals)||scorer.goals===0)throw Error('Goleador inválido');
    if(match.status==='finished')for(const [teamId,goals] of [[match.homeId,match.homeGoals],[match.awayId,match.awayGoals]])if((match.scorers||[]).filter(s=>s.teamId===teamId).reduce((sum,s)=>sum+s.goals,0)>goals)throw Error('Goleadores por encima del marcador');
  }
  return data;
}
export function sortedMatches(data,categoryId,finished=false){
  return data.matches.filter(m=>m.categoryId===categoryId&&(finished?m.status==='finished':!['finished','cancelled'].includes(m.status)))
    .slice().sort((a,b)=>{if(!a.date)return b.date?1:0;if(!b.date)return -1;const dates=a.date.localeCompare(b.date);return (finished?-dates:dates)||(a.time||'99:99').localeCompare(b.time||'99:99');});
}
function rowsFor(teams){return new Map(teams.map(t=>[t.id,{teamId:t.id,name:t.name,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,points:0,adjustment:t.pointsAdjustment||0,adjustmentNote:t.adjustmentNote||''}]));}
function countGames(rows,games,rules){
  for(const match of games){const home=rows.get(match.homeId),away=rows.get(match.awayId);if(!home||!away)continue;
    if(match.doubleForfeit){home.played++;away.played++;home.lost++;away.lost++;continue;}
    for(const [row,gf,ga] of [[home,match.homeGoals,match.awayGoals],[away,match.awayGoals,match.homeGoals]]){row.played++;row.gf+=gf;row.ga+=ga;row.gd=row.gf-row.ga;if(gf>ga){row.won++;row.points+=rules.win;}else if(gf===ga){row.drawn++;row.points+=rules.draw;}else{row.lost++;row.points+=rules.loss;}}
  }
}
const scoreKey = row => `${row.points}|${row.gd}|${row.gf}`;
const scoreOrder = (a,b) => b.points-a.points||b.gd-a.gd||b.gf-a.gf;
export function internoStandings(data,categoryId){
  const category=data.categories.find(c=>c.id===categoryId);
  if(!category?.points)return null; // +38 has its own rules; do not assume the other categories' rules.
  return data.groups.filter(g=>g.categoryId===categoryId).map(group=>{
    const teams=data.teams.filter(t=>t.categoryId===categoryId&&t.groupId===group.id),rows=rowsFor(teams);
    const games=data.matches.filter(m=>m.categoryId===categoryId&&m.groupId===group.id&&m.stage==='groups'&&m.status==='finished');
    countGames(rows,games,category.points);for(const row of rows.values())row.points+=row.adjustment;
    const ordered=[...rows.values()].sort(scoreOrder),result=[];
    for(let i=0;i<ordered.length;){let end=i+1;while(end<ordered.length&&scoreKey(ordered[end])===scoreKey(ordered[i]))end++;
      const block=ordered.slice(i,end),mini=rowsFor(block.map(row=>({id:row.teamId,name:row.name})));
      countGames(mini,games.filter(m=>mini.has(m.homeId)&&mini.has(m.awayId)),category.points);
      block.sort((a,b)=>scoreOrder(mini.get(a.teamId),mini.get(b.teamId))||a.name.localeCompare(b.name,'es'));
      let position=i+1;
      block.forEach((row,j)=>{if(j&&scoreKey(mini.get(row.teamId))!==scoreKey(mini.get(block[j-1].teamId)))position=i+j+1;
        const tied=block.filter(r=>scoreKey(mini.get(r.teamId))===scoreKey(mini.get(row.teamId))).length>1;
        result.push({...row,position:games.length?position:null,tied:games.length>0&&tied});});i=end;
    }
    return {...group,rows:result};
  });
}
export function internoScorers(data,categoryId){
  const rows=new Map();
  for(const match of data.matches.filter(m=>m.categoryId===categoryId&&m.status==='finished'))for(const scorer of match.scorers||[]){
    const key=scorer.teamId+'|'+scorer.player.trim().normalize('NFKC').toLocaleLowerCase('es');
    const row=rows.get(key)||{player:scorer.player.trim(),teamId:scorer.teamId,teamName:data.teams.find(t=>t.id===scorer.teamId).name,goals:0};
    row.goals+=scorer.goals;rows.set(key,row);
  }
  const result=[...rows.values()].sort((a,b)=>b.goals-a.goals||a.player.localeCompare(b.player,'es'));
  let position=1;return result.map((r,i)=>{if(i&&r.goals!==result[i-1].goals)position=i+1;return {...r,position};});
}
