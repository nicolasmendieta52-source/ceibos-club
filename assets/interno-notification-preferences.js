export const INTERNOCATEGORIES=['masculino','femenino','mas38'];
export const INTERNOTYPES=['new','change','today','start','result'];
const validId=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(id);
const ids=value=>Array.isArray(value)?[...new Set(value.filter(validId))].slice(0,200):[];

export function opcionesInterno(value={}){
  const common={
    categories:Array.isArray(value?.categories)?[...new Set(value.categories.filter(id=>INTERNOCATEGORIES.includes(id)))]:value?.version===2?[]:[...INTERNOCATEGORIES],
    events:Object.fromEntries(INTERNOTYPES.map(type=>[type,typeof value?.events?.[type]==='boolean'?value.events[type]:true]))
  };
  return value?.version===2?{version:2,...common,groupIds:ids(value.groupIds),teamIds:ids(value.teamIds)}:{version:1,...common,teamId:validId(value?.teamId)?value.teamId:''};
}

export function siguePartidoInterno(deportes,partido,tipo){
  if(deportes?.interno!==true)return false;
  const options=opcionesInterno(deportes.internoOpciones);
  if(options.events[tipo]!==true)return false;
  if(options.version===2)return options.categories.includes(partido.internoCategoryId)
    ||options.groupIds.some(id=>partido.internoGroupIds?.includes(id))
    ||options.teamIds.some(id=>partido.internoTeamIds?.includes(id));
  // Existing subscriptions retain their original category AND single-team filter.
  return options.categories.includes(partido.internoCategoryId)&&(!options.teamId||partido.internoTeamIds?.includes(options.teamId));
}

export function sigueObjetivoInterno(deportes,kind,id,data){
  if(deportes?.interno!==true)return false;
  const row=(kind==='group'?data.groups:kind==='team'?data.teams:[]).find(row=>row.id===id),options=opcionesInterno(deportes.internoOpciones);
  if(!row||!Object.values(options.events).some(Boolean))return false;
  if(options.version===1)return options.categories.includes(row.categoryId)&&(kind==='group'?!options.teamId:!options.teamId||options.teamId===id);
  return options.categories.includes(row.categoryId)||(kind==='group'?options.groupIds.includes(id):options.teamIds.includes(id)||options.groupIds.includes(row.groupId));
}
