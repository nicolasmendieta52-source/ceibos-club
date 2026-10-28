import {validateInterno,publicInternoUrl,sortedMatches,internoStandings,internoScorers} from './interno-model.js?v=20261028torneo';

const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceLink = (url,label) => publicInternoUrl(url) ? '<a class="interno-media-link" href="'+escape(publicInternoUrl(url))+'" target="_blank" rel="noopener noreferrer">'+escape(label)+' ↗</a>' : '';
const empty = (title,message,url) => '<div class="interno-empty"><span class="interno-soon">Próximamente</span><h4>'+escape(title)+'</h4><p>'+escape(message)+'</p>'+sourceLink(url,'Ver destacada 2026')+'</div>';
const dateLabel = date => date ? new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')) : 'Fecha a confirmar';

function matchMarkup(data,match){
  const home=data.teams.find(t=>t.id===match.homeId),away=data.teams.find(t=>t.id===match.awayId);
  const group=data.groups.find(g=>g.id===match.groupId);
  const phase=match.round || (match.stage==='playoffs'?'Eliminatorias':group?.name || 'Fase de grupos');
  const status={postponed:'Postergado',suspended:'Suspendido'}[match.status];
  const finished=match.status==='finished';
  const datetime=match.date?' datetime="'+escape(match.date+(match.time?'T'+match.time+':00-03:00':''))+'"':'';
  return '<article class="interno-match"><div class="interno-match-meta"><span>'+escape(phase)+'</span>'+(status?'<strong>'+status+'</strong>':'')+'<time'+datetime+'>'+escape(dateLabel(match.date))+(match.time?' · '+escape(match.time)+' h':finished?'':' · Horario a confirmar')+'</time></div><div class="interno-match-pair"><span>'+escape(home.name)+'</span><strong class="interno-score">'+(finished?match.homeGoals+' <span>–</span> '+match.awayGoals:'<span>vs.</span>')+'</strong><span>'+escape(away.name)+'</span></div>'+(match.penalties?'<p class="interno-match-note">Penales: '+match.penalties.home+'–'+match.penalties.away+'</p>':'')+(match.doubleForfeit?'<p class="interno-match-note">Doble incomparecencia: sin puntos ni goles.</p>':'')+(match.venue?'<p class="interno-match-note">'+escape(match.venue)+'</p>':'')+(match.sourceUrl?sourceLink(match.sourceUrl,'Ver publicación'):'')+'</article>';
}

export function internoPanelMarkup(data,categoryId,tab){
  const teams=data.teams.filter(t=>t.categoryId===categoryId);
  if(tab==='equipos'){
    if(!teams.length)return empty('Los protagonistas de 2026','La lista de equipos de esta categoría se publicará acá, con sus presentaciones oficiales.',data.teamsSourceUrl);
    const cards=teams.slice().sort((a,b)=>a.name.localeCompare(b.name,'es')).map(team=>{
      const group=data.groups.find(g=>g.id===team.groupId);
      const initials=team.name.split(/\s+/).slice(0,2).map(word=>[...word][0]).join('');
      return '<article class="interno-team"><div class="interno-team-mark" aria-hidden="true"><span>'+escape(initials)+'</span>'+(team.logoUrl?'<img src="'+escape(publicInternoUrl(team.logoUrl))+'" alt="" loading="lazy" decoding="async">':'')+'</div><div><h4>'+escape(team.name)+'</h4>'+(group?'<p>'+escape(group.name)+'</p>':'')+(team.sourceUrl?sourceLink(team.sourceUrl,'Presentación'):'')+'</div></article>';
    }).join('');
    return '<p class="interno-panel-note">'+teams.length+' '+(teams.length===1?'equipo confirmado':'equipos confirmados')+'</p><div class="interno-team-grid">'+cards+'</div>'+sourceLink(data.teamsSourceUrl,'Ver destacada 2026');
  }
  if(tab==='fixture'||tab==='resultados'){
    const matches=sortedMatches(data,categoryId,tab==='resultados');
    if(!matches.length)return empty(tab==='fixture'?'El camino al título':'Cada partido cuenta',tab==='fixture'?'Acá vas a encontrar los cruces de esta categoría, ordenados del más próximo al más lejano.':'Los resultados de esta categoría aparecerán acá cuando se jueguen los partidos.');
    return '<div class="interno-match-list">'+matches.map(match=>matchMarkup(data,match)).join('')+'</div>';
  }
  if(tab==='posiciones'){
    const groups=internoStandings(data,categoryId);
    if(groups===null)return empty('La tabla de +38','Las posiciones se publicarán cuando la organización confirme el formato y los criterios de esta categoría.');
    if(!groups.length)return empty('La pelea por las copas','Las series y sus tablas de posiciones aparecerán acá cuando se anuncie el sorteo.');
    const tables=groups.map(group=>'<div class="interno-table-wrap" tabindex="0" role="region" aria-label="Posiciones: '+escape(group.name)+'"><table class="interno-table"><caption>'+escape(group.name)+'</caption><thead><tr><th scope="col"><abbr title="Posición">Pos.</abbr></th><th scope="col">Equipo</th>'+['PJ','PG','PE','PP','GF','GC','DG','Pts'].map((label,i)=>'<th scope="col"><abbr title="'+['Partidos jugados','Partidos ganados','Partidos empatados','Partidos perdidos','Goles a favor','Goles en contra','Diferencia de goles','Puntos'][i]+'">'+label+'</abbr></th>').join('')+'</tr></thead><tbody>'+group.rows.map(row=>'<tr><td>'+(row.position===null?'—':row.position+(row.tied?'*':''))+'</td><th scope="row">'+escape(row.name)+'</th>'+[row.played,row.won,row.drawn,row.lost,row.gf,row.ga,row.gd].map(n=>'<td>'+n+'</td>').join('')+'<td><strong>'+row.points+'</strong></td></tr>').join('')+'</tbody></table></div>'+group.rows.filter(r=>r.adjustment).map(r=>'<p class="interno-panel-note">'+escape(r.name)+': '+(r.adjustment>0?'+':'')+r.adjustment+' puntos. '+escape(r.adjustmentNote)+'</p>').join('')).join('');
    return tables+'<p class="interno-panel-note">Solo cuentan los partidos finalizados de la fase de grupos. Victoria: 3 puntos · Empate: 1. Desempates: diferencia de goles, goles a favor y enfrentamiento directo. * Igualdad pendiente de resolución por la organización.</p>';
  }
  if(tab==='goleadores'){
    const scorers=internoScorers(data,categoryId);
    if(!scorers.length)return empty('Los que hacen la diferencia','La tabla se actualizará a partir de los goles registrados en los partidos de esta categoría.');
    return '<div class="interno-table-wrap" tabindex="0" role="region" aria-label="Tabla de goleadores"><table class="interno-table interno-scorers"><caption>Goleadores · '+escape(data.categories.find(c=>c.id===categoryId).name)+'</caption><thead><tr><th scope="col">Pos.</th><th scope="col">Jugador/a</th><th scope="col">Equipo</th><th scope="col">Goles</th></tr></thead><tbody>'+scorers.map(row=>'<tr><td>'+row.position+'</td><th scope="row">'+escape(row.player)+'</th><td>'+escape(row.teamName)+'</td><td><strong>'+row.goals+'</strong></td></tr>').join('')+'</tbody></table></div><p class="interno-panel-note">Goles registrados en los partidos finalizados. Los goles sin autor confirmado se incorporarán cuando se informe el nombre.</p>';
  }
  return '';
}

function initInterno(){
  const panel=document.getElementById('interno-panel'),select=document.getElementById('interno-categoria'),status=document.getElementById('interno-feed-status');
  if(!panel||!select||!status)return;
  const tabs=[...document.querySelectorAll('[data-interno-tab]')];
  let currentTab='equipos',data=null,lastJson='',loading=false;
  const contact=document.getElementById('interno-inscripcion');
  const originalContact=contact?{href:contact.href,text:contact.textContent}:null;
  const originalState=document.getElementById('interno-inscripcion-estado').textContent;
  const originalText=document.getElementById('interno-inscripcion-texto').textContent;
  function render(){
    tabs.forEach(button=>{const active=button.dataset.internoTab===currentTab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    panel.setAttribute('aria-labelledby','interno-tab-'+currentTab);
    if(data)panel.innerHTML=internoPanelMarkup(data,select.value,currentTab);
  }
  tabs.forEach((button,index)=>{
    button.addEventListener('click',()=>{currentTab=button.dataset.internoTab;render();});
    button.addEventListener('keydown',event=>{
      const next={ArrowRight:(index+1)%tabs.length,ArrowLeft:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
      if(next===undefined)return;event.preventDefault();tabs[next].click();tabs[next].focus();
    });
  });
  select.addEventListener('change',render);
  panel.addEventListener('error',event=>{if(event.target.tagName==='IMG')event.target.remove();},true);
  async function refresh(){
    if(loading||document.hidden)return;loading=true;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch('data/interno.json?actualizado='+Date.now(),{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('No se pudo leer el torneo');
      const next=validateInterno(await response.json()),json=JSON.stringify(next);
      if(json!==lastJson){
        const previous=select.value;data=next;lastJson=json;
        select.replaceChildren(...data.categories.map(category=>{const option=document.createElement('option');option.value=category.id;option.textContent=category.name;return option;}));
        if(data.categories.some(c=>c.id===previous))select.value=previous;
        render();
        const form=data.registrationOpen&&publicInternoUrl(data.registrationUrl);
        if(contact&&originalContact){contact.href=form||originalContact.href;contact.textContent=form?'Inscribirme al Interno ↗':originalContact.text;}
        document.getElementById('interno-inscripcion-estado').textContent=form?'Inscripciones abiertas':originalState;
        document.getElementById('interno-inscripcion-texto').textContent=form?'Completá el formulario oficial para anotarte al Interno.':originalText;
      }
      status.textContent='';
    }catch{
      status.textContent=data?'No pudimos actualizar el torneo. Seguís viendo los últimos datos cargados.':'No pudimos cargar el torneo. Consultá los anuncios del Interno en Instagram; volveremos a intentar en un minuto.';
    }finally{clearTimeout(timer);loading=false;}
  }
  refresh();setInterval(refresh,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}

if(typeof document!=='undefined'){
  initInterno();
  // Accept embed heights only from an Instagram frame rendered in this section.
  window.addEventListener('message',event=>{
    if(event.origin!=='https://www.instagram.com')return;
    const frame=[...document.querySelectorAll('#interno .interno-instagram')].find(element=>element.contentWindow===event.source);
    if(!frame)return;
    let message=event.data;if(typeof message==='string'){try{message=JSON.parse(message);}catch{return;}}
    const height=Number(message?.details?.height);
    if(message?.type!=='MEASURE'||!Number.isFinite(height)||height<250||height>1800)return;
    frame.style.height=Math.ceil(height)+'px';
  });
}
