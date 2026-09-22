export const SECTIONS = ['inicio','gym-campaign','partido-destacado','noticias','deportes','archivo','resultados','fixture','vida','shop','solidario','club','predio','socios','contacto'];
export const ACTIONS = ['gym_form','whatsapp','email','phone','instagram','external','navigation','sport_futbol','sport_rugby','sport_hockey','sport_basketball','category','notifications_open','notifications_enable','notifications_disable','match','share','shop'];
export const LABELS = {inicio:'Inicio','gym-campaign':'Gimnasio','partido-destacado':'Partido destacado',noticias:'Noticias',deportes:'Deportes',archivo:'Archivo deportivo',resultados:'Resultados',fixture:'Próximos partidos',vida:'Vida del club',shop:'Tienda',solidario:'Solidario',club:'El club',predio:'Predio',socios:'Socios',contacto:'Contacto',gym_form:'Formulario del Gym',whatsapp:'WhatsApp',email:'Correo',phone:'Teléfono',instagram:'Instagram',external:'Otros enlaces externos',navigation:'Navegación',sport_futbol:'Fútbol',sport_rugby:'Rugby',sport_hockey:'Hockey',sport_basketball:'Basketball',category:'Categorías deportivas',notifications_open:'Abrir notificaciones',notifications_enable:'Solicitar notificaciones',notifications_disable:'Desactivar notificaciones',match:'Detalle del partido',share:'Compartir',shop:'Tienda'};
export const emptyCounts = keys => Object.fromEntries(keys.map(key=>[key,0]));
export function deviceInfo(ua, width) {
  return {device:/iPad|Tablet/i.test(ua)?'Tablet':/Mobile|Android|iPhone/i.test(ua)?'Móvil':width<700?'Pantalla pequeña':'Desktop',
    browser:/Edg\//.test(ua)?'Edge':/Firefox|FxiOS/.test(ua)?'Firefox':/Chrome|CriOS/.test(ua)?'Chrome':/Safari/.test(ua)?'Safari':'Otro',
    os:/iPhone|iPad/.test(ua)?'iOS':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Mac OS/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Otro'};
}
export function referrerHost(value, ownHost='ceibosclub.com') {
  try { const u=new URL(value);if (/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':')) return 'Directo / no informado';return u.hostname===ownHost||u.hostname==='www.'+ownHost?'Interno':u.hostname.slice(0,120); } catch { return 'Directo / no informado'; }
}
export function summarize(visits) {
  const result={visits:visits.length,visitors:new Set(visits.map(v=>v.ownerUid)).size,active:0,seconds:0,interactions:0,scroll:0,engaged:0,sections:emptyCounts(SECTIONS),actions:emptyCounts(ACTIONS),devices:{},browsers:{},systems:{},origins:{},days:{}};
  const add=(map,key,n=1)=>{map[key]=(Object.hasOwn(map,key)?map[key]:0)+n;};
  for(const v of visits){result.seconds+=v.activeSeconds||0;result.interactions+=v.interactions||0;result.scroll+=v.scrollDepth||0;if(v.activeSeconds>=10||v.interactions>0)result.engaged++;if(Date.now()-v.lastSeenMs<120000)result.active++;
    for(const key of SECTIONS)result.sections[key]+=v.sections?.[key]||0;
    for(const key of ACTIONS)result.actions[key]+=v.actions?.[key]||0;
    add(result.devices,v.device||'Otro');add(result.browsers,v.browser||'Otro');add(result.systems,v.os||'Otro');add(result.origins,v.referrer||'Directo / no informado');
    const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Montevideo'}).format(new Date(v.createdMs));add(result.days,day);
  }
  return result;
}
export function csvValue(value){const s=String(value??'');return '"'+(/^[=+\-@\t\r]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';}
