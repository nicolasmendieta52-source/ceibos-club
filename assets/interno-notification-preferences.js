export const INTERNOCATEGORIES=['masculino','femenino','mas38'];
export const INTERNOTYPES=['new','change','today','start','result'];

export function opcionesInterno(value={}){
  return {
    categories:Array.isArray(value?.categories)?[...new Set(value.categories.filter(id=>INTERNOCATEGORIES.includes(id)))]:[...INTERNOCATEGORIES],
    teamId:typeof value?.teamId==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(value.teamId)?value.teamId:'',
    events:Object.fromEntries(INTERNOTYPES.map(type=>[type,typeof value?.events?.[type]==='boolean'?value.events[type]:true]))
  };
}

export function siguePartidoInterno(deportes,partido,tipo){
  if(deportes?.interno!==true)return false;
  const options=opcionesInterno(deportes.internoOpciones);
  return options.events[tipo]===true&&options.categories.includes(partido.internoCategoryId)&&(!options.teamId||partido.internoTeamIds?.includes(options.teamId));
}
