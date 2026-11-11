export const DEFAULT_CLOCK={halfMinutes:25,breakMinutes:5};
export function clockSettings(data){return {...DEFAULT_CLOCK,...data?.clock};}
export function courtName(match){return match.court&&match.venue&&match.court!==match.venue?match.venue+' · '+match.court:String(match.court||match.venue||'');}

export function validClockStart(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value))return false;
  const date=new Date(value.slice(0,10)+'T12:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value.slice(0,10)&&Number.isFinite(Date.parse(value));
}

export function liveKickoff(match){
  if(match.startedAt)return validClockStart(match.startedAt)?Date.parse(match.startedAt):null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(match.date||'')||! /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(match.time||''))return null;
  const wall=match.date+'T'+match.time+':00.000Z',naive=Date.parse(wall);
  if(!Number.isFinite(naive)||new Date(naive).toISOString()!==wall)return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'America/Montevideo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(naive).map(part=>[part.type,part.value]));
  const rendered=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
  return naive+(naive-rendered);
}

export function clockText(seconds){
  const value=Math.max(0,Math.floor(seconds));
  return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
}

export function matchClock(match,config=DEFAULT_CLOCK,now=Date.now()){
  const start=liveKickoff(match),half=config.halfMinutes*60,rest=config.breakMinutes*60;
  if(match.status!=='scheduled'||start===null)return {phase:'unavailable',start};
  const elapsed=Math.floor((now-start)/1000);
  if(elapsed<0)return {phase:'upcoming',start,seconds:-elapsed,label:'Empieza en',text:clockText(-elapsed),progress:0};
  if(elapsed<half)return {phase:'first',start,seconds:elapsed,label:'Primer tiempo',text:clockText(elapsed),progress:elapsed/(half*2)};
  if(elapsed<half+rest)return {phase:'halftime',start,seconds:half+rest-elapsed,label:'Entretiempo · faltan',text:clockText(half+rest-elapsed),progress:.5};
  if(elapsed<half*2+rest)return {phase:'second',start,seconds:elapsed-rest,label:'Segundo tiempo',text:clockText(elapsed-rest),progress:(elapsed-rest)/(half*2)};
  return {phase:'awaiting',start,seconds:half*2,label:'Tiempo reglamentario cumplido',text:clockText(half*2),progress:1};
}

export function liveBoard(data,now=Date.now(),court=''){
  const settings=clockSettings(data),rows=data.matches.map(match=>({match,clock:matchClock(match,settings,now),court:courtName(match)})).filter(row=>row.clock.phase!=='unavailable'&&(!court||row.court===court));
  const compare=(a,b)=>(!a.court)-(!b.court)||a.court.localeCompare(b.court,'es',{numeric:true})||a.clock.start-b.clock.start||a.match.id.localeCompare(b.match.id);
  const active=rows.filter(row=>['first','halftime','second'].includes(row.clock.phase)).sort(compare);
  const awaiting=rows.filter(row=>row.clock.phase==='awaiting'&&now-row.clock.start<(settings.halfMinutes*2+settings.breakMinutes+60)*60000).sort(compare);
  const upcoming=rows.filter(row=>row.clock.phase==='upcoming'&&row.clock.start-now<=86400000).sort((a,b)=>a.clock.start-b.clock.start||compare(a,b));
  const next=upcoming.length?upcoming.filter(row=>row.clock.start===upcoming[0].clock.start):[];
  return {active,awaiting,next,settings};
}
