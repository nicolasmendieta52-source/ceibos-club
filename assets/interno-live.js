import {liveBoard,matchClock,clockSettings,courtName} from './interno-live-clock.js?v=20261111fuente';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hour=value=>new Intl.DateTimeFormat('es-UY',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Montevideo'}).format(value);
const day=value=>new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'short',timeZone:'America/Montevideo'}).format(value);

export function liveCardMarkup(data,row,teamMark=()=> ''){
  const {match,clock}=row,home=data.teams.find(team=>team.id===match.homeId),away=data.teams.find(team=>team.id===match.awayId),category=data.categories.find(category=>category.id===match.categoryId);
  const target='/?internoCategoria='+encodeURIComponent(match.categoryId)+'&internoTab=fixture&internoPartido='+encodeURIComponent(match.id)+'#interno';
  return '<article class="interno-live-card interno-live-'+clock.phase+'" data-live-match="'+escape(match.id)+'"><header><h4>'+escape(row.court||'Cancha a confirmar')+'</h4><span>'+escape(category.name)+'</span></header><div class="interno-live-teams"><div>'+teamMark(home,'reloj-'+match.id+'-local')+'<strong>'+escape(home.name)+'</strong></div><span class="interno-live-vs">vs.</span><div>'+teamMark(away,'reloj-'+match.id+'-visitante')+'<strong>'+escape(away.name)+'</strong></div></div><div class="interno-live-timer"><span class="interno-live-phase" data-live-phase>'+escape(clock.label)+'</span><strong class="interno-live-clock" data-live-clock aria-live="off">'+escape(clock.text)+'</strong></div><div class="interno-live-progress" aria-hidden="true"><span data-live-progress style="width:'+(clock.progress*100)+'%"></span></div><footer><span>'+escape(day(clock.start))+' · '+(match.startedAt?'Inicio ajustado ':'Inicio ')+escape(hour(clock.start))+' h'+(clock.phase==='awaiting'?' · Resultado a confirmar':'')+'</span><a href="'+escape(target)+'">Ver partido ↗</a></footer></article>';
}

export function initLiveBoard(root,teamMark){
  if(!root)return {setData(){},fresh(){},failed(){}};
  const content=root.querySelector('[data-live-content]'),filter=root.querySelector('[data-live-court]'),summary=root.querySelector('[data-live-summary]');
  let data=null,signature='',courtsSignature='',stale=false;
  function update(){
    if(!data||document.hidden)return;
    const now=Date.now(),board=liveBoard(data,now,filter.value),items=[...board.active,...board.awaiting,...board.next];
    const key=JSON.stringify([filter.value,...items.map(row=>[row.match.id,row.clock.phase])]);
    const text=(board.active.length?board.active.length+' '+(board.active.length===1?'partido en horario de juego':'partidos en horario de juego')+(board.active.some(row=>row.clock.phase==='halftime')?' · Incluye entretiempo':''):'Sin partidos en horario de juego')+(stale?' · No se pudo actualizar el fixture':'');
    if(summary.textContent!==text)summary.textContent=text;
    if(key!==signature){
      signature=key;
      const cards=rows=>'<div class="interno-live-grid">'+rows.map(row=>liveCardMarkup(data,row,teamMark)).join('')+'</div>';
      content.innerHTML=(board.active.length?cards(board.active):'<p class="interno-live-empty">'+(data.matches.length?'No hay partidos en horario de juego para esta selección.':'El tablero se activará cuando se carguen los partidos del Interno con fecha y hora.')+'</p>')+(board.awaiting.length?'<div class="interno-live-batch"><h4>Tiempo cumplido · cierre pendiente</h4>'+cards(board.awaiting)+'</div>':'')+(board.next.length?'<div class="interno-live-batch"><h4>Próxima tanda · '+escape(day(board.next[0].clock.start))+' · '+escape(hour(board.next[0].clock.start))+' h</h4>'+cards(board.next)+'</div>':'');
    }
    for(const row of items){
      const card=[...content.querySelectorAll('[data-live-match]')].find(card=>card.dataset.liveMatch===row.match.id);if(!card)continue;
      const clock=matchClock(row.match,clockSettings(data,row.match),now);
      card.querySelector('[data-live-clock]').textContent=clock.text;card.querySelector('[data-live-phase]').textContent=clock.label;card.querySelector('[data-live-progress]').style.width=(clock.progress*100)+'%';
    }
  }
  filter.addEventListener('change',()=>{signature='';update();});
  setInterval(update,1000);document.addEventListener('visibilitychange',update);window.addEventListener('pageshow',update);
  return {setData(next){
    data=next;signature='';stale=false;
    const courts=[...new Set(data.matches.filter(match=>match.status==='scheduled').map(courtName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true})),key=JSON.stringify(courts);
    if(key!==courtsSignature){const previous=filter.value;filter.replaceChildren(new Option('Todas las canchas',''),...courts.map(court=>new Option(court,court)));if(courts.includes(previous))filter.value=previous;courtsSignature=key;}
    filter.disabled=!courts.length;
    const durations=new Map();for(const category of next.categories||[]){const half=clockSettings(next,{categoryId:category.id}).halfMinutes;durations.set(half,[...(durations.get(half)||[]),category.name]);}
    root.querySelector('[data-live-rules]').textContent=[...durations].map(([half,names])=>names.join(' / ')+': '+half+' + '+clockSettings(next).breakMinutes+' + '+half+' min').join(' · ');
    update();
  },fresh(){stale=false;update();},failed(){stale=true;if(data)update();else{summary.textContent='Horarios no disponibles';content.innerHTML='<p class="interno-live-empty">No pudimos cargar los horarios. Volveremos a intentarlo automáticamente.</p>';}}};
}
