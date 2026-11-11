import {validateInterno,publicInternoUrl,sortedMatches,internoStandings,internoScorers} from './interno-model.js?v=20261110formatos';

const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceLink = (url,label) => publicInternoUrl(url) ? '<a class="interno-media-link" href="'+escape(publicInternoUrl(url))+'" target="_blank" rel="noopener noreferrer">'+escape(label)+' ↗</a>' : '';
const empty = (title,message,url) => '<div class="interno-empty"><span class="interno-soon">Próximamente</span><h4>'+escape(title)+'</h4><p>'+escape(message)+'</p>'+sourceLink(url,'Ver destacada 2026')+'</div>';
const dateLabel = date => date ? new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')) : 'Fecha a confirmar';

function teamMarkMarkup(team){
  const initials=team.name.split(/\s+/).slice(0,2).map(word=>[...word][0]).join('');
  const logo=publicInternoUrl(team.logoUrl),crop=team.logoCrop;
  // Show the original poster pixels through an SVG viewport; the supplied artwork stays intact.
  const clipId='interno-escudo-'+team.id;
  const mask=crop?.shape==='ellipse'?'<defs><clipPath id="'+clipId+'"><ellipse cx="'+(crop.x+crop.width/2)+'" cy="'+(crop.y+crop.height/2)+'" rx="'+crop.width/2+'" ry="'+crop.height/2+'"/></clipPath></defs>':'';
  const image=logo?(crop?'<svg viewBox="'+[crop.x,crop.y,crop.width,crop.height].join(' ')+'" aria-hidden="true" focusable="false">'+mask+'<image href="'+escape(logo)+'" width="'+crop.imageWidth+'" height="'+crop.imageHeight+'"'+(mask?' clip-path="url(#'+clipId+')"':'')+'/></svg>':'<img src="'+escape(logo)+'" alt="" loading="lazy" decoding="async">'):'';
  return '<div class="interno-team-mark'+(logo?' interno-team-mark-logo':'')+'" aria-hidden="true"><span>'+escape(initials)+'</span>'+image+'</div>';
}

function groupsMarkup(data,categoryId){
  const groups=data.groups.filter(group=>group.categoryId===categoryId);
  if(!groups.length)return empty('Los grupos de 2026','Los grupos de esta categoría aparecerán acá cuando los confirme la organización.');
  const count=data.teams.filter(team=>team.categoryId===categoryId).length,category=data.categories.find(category=>category.id===categoryId);
  const cards=groups.map(group=>{
    const teams=data.teams.filter(team=>team.categoryId===categoryId&&team.groupId===group.id);
    return '<article class="interno-group"><header><h4>'+escape(group.name)+'</h4><span>'+(teams.length||group.expectedTeams||0)+' equipos</span></header>'+(teams.length?'<ul>'+teams.map(team=>'<li>'+teamMarkMarkup(team)+'<span>'+escape(team.name)+'</span></li>').join('')+'</ul>':'<p class="interno-panel-note">Los equipos de esta zona se publicarán cuando se anuncie la nómina.</p>')+'</article>';
  }).join('');
  const sources=[...new Set(groups.map(group=>group.sourceUrl).filter(Boolean))];
  return '<p class="interno-panel-note">'+(count||category?.format?.teamCount||0)+' equipos · '+groups.length+' '+(categoryId==='mas38'?'zonas confirmadas':'grupos confirmados')+(!count?' · Nómina por anunciar':'')+'</p><div class="interno-group-grid">'+cards+'</div><div class="interno-group-sources">'+sources.map((url,index)=>sourceLink(url,url.endsWith('.mp4')?'Ver explicación del formato':sources.length===1?'Ver placa oficial de grupos':'Ver placa de grupos '+(index+1))).join('')+'</div>';
}

function formatBracketMarkup(block,index){
  const seed=value=>escape(typeof value==='number'?value+'.º':value);
  return '<section class="interno-bracket interno-format-bracket" aria-labelledby="interno-formato-cruce-'+index+'"><h5 id="interno-formato-cruce-'+index+'">'+escape(block.name)+'</h5><p class="interno-panel-note">'+escape(block.description)+'</p><ol class="interno-bracket-grid" style="--interno-bracket-count:'+block.pairs.length+';--interno-bracket-mobile-count:'+Math.min(4,block.pairs.length)+'" aria-label="Cruces según posición">'+block.pairs.map(([first,second],pairIndex)=>'<li><span class="interno-seed">'+seed(first)+'</span><span class="interno-seed-vs">vs.</span><span class="interno-seed interno-seed-second">'+seed(second)+'</span>'+(block.pairLabels?'<strong class="interno-pair-cup">'+escape(block.pairLabels[pairIndex])+'</strong>':'')+'</li>').join('')+'</ol>'+(block.destinations.length?'<div class="interno-bracket-destinations">'+block.destinations.map(destination=>'<p><span>'+escape(destination.label)+' ↓</span><strong>'+escape(destination.text)+'</strong></p>').join('')+'</div>':'')+'</section>';
}

function playoffsMarkup(data,categoryId){
  const category=data.categories.find(category=>category.id===categoryId),format=category?.format;
  if(!format)return empty('La definición de las copas','Los cruces de esta categoría se publicarán cuando la organización confirme su formato.');
  const video=escape(publicInternoUrl(format.videoUrl)),poster=escape(publicInternoUrl(format.posterUrl));
  return '<section class="interno-format" aria-labelledby="interno-formato-titulo"><div class="interno-format-head"><div><p class="interno-kicker">'+escape(category.name)+' · Formato 2026</p><h4 id="interno-formato-titulo">Así se juega</h4><p class="interno-panel-note">'+escape(format.summary)+'</p></div><p class="interno-format-guarantee">'+escape(format.matchesLabel)+'</p></div><details class="interno-format-video"><summary>Ver explicación en video · '+format.seconds+' s</summary><video controls playsinline preload="none" poster="'+poster+'" aria-label="Explicación del formato de '+escape(category.name)+'"><source src="'+video+'" type="video/mp4">'+sourceLink(format.videoUrl,'Abrir video')+'</video><p>El recorrido completo también está explicado en el texto de esta sección.</p></details><ol class="interno-format-stages">'+format.stages.map((stage,index)=>'<li><span aria-hidden="true">'+String(index+1).padStart(2,'0')+'</span><div><h5>'+escape(stage.title)+'</h5><p>'+escape(stage.text)+'</p></div></li>').join('')+'</ol><div class="interno-format-cups">'+format.cups.map(cup=>'<article class="interno-format-cup interno-cup-'+cup.id+'"><h5>'+escape(cup.name)+'</h5><p>'+escape(cup.text)+'</p></article>').join('')+'</div>'+format.brackets.map(formatBracketMarkup).join('')+(format.schedule.length?'<section class="interno-format-schedule" aria-label="Recorrido de jornadas"><h5>Jornada a jornada</h5><ol>'+format.schedule.map(day=>'<li><span>'+escape(day.label)+'</span><strong>'+escape(day.text)+'</strong></li>').join('')+'</ol></section>':'')+'<p class="interno-panel-note interno-format-final">'+escape(format.finalNote)+'</p></section>';
}

function matchMarkup(data,match){
  const home=data.teams.find(t=>t.id===match.homeId),away=data.teams.find(t=>t.id===match.awayId);
  const group=data.groups.find(g=>g.id===match.groupId);
  const phase=match.round || (match.stage==='playoffs'?'Eliminatorias':group?.name || 'Fase de grupos');
  const status={postponed:'Postergado',suspended:'Suspendido'}[match.status];
  const finished=match.status==='finished';
  const datetime=match.date?' datetime="'+escape(match.date+(match.time?'T'+match.time+':00-03:00':''))+'"':'';
  return '<article class="interno-match" id="interno-partido-'+escape(match.id)+'"><div class="interno-match-meta"><span>'+escape(phase)+'</span>'+(status?'<strong>'+status+'</strong>':'')+'<time'+datetime+'>'+escape(dateLabel(match.date))+(match.time?' · '+escape(match.time)+' h':finished?'':' · Horario a confirmar')+'</time></div><div class="interno-match-pair"><span>'+escape(home.name)+'</span><strong class="interno-score">'+(finished?match.homeGoals+' <span>–</span> '+match.awayGoals:'<span>vs.</span>')+'</strong><span>'+escape(away.name)+'</span></div>'+(match.penalties?'<p class="interno-match-note">Penales: '+match.penalties.home+'–'+match.penalties.away+'</p>':'')+(match.doubleForfeit?'<p class="interno-match-note">Doble incomparecencia: sin puntos ni goles.</p>':'')+(match.venue?'<p class="interno-match-note">'+escape(match.venue)+'</p>':'')+(match.sourceUrl?sourceLink(match.sourceUrl,'Ver publicación'):'')+'</article>';
}

export function internoPanelMarkup(data,categoryId,tab){
  const teams=data.teams.filter(t=>t.categoryId===categoryId);
  if(tab==='grupos')return groupsMarkup(data,categoryId);
  if(tab==='cruces')return playoffsMarkup(data,categoryId);
  if(tab==='equipos'){
    if(!teams.length)return empty('Los protagonistas de 2026','La lista de equipos de esta categoría se publicará acá, con sus presentaciones oficiales.',data.teamsSourceUrl);
    const cards=teams.slice().sort((a,b)=>a.name.localeCompare(b.name,'es')).map(team=>{
      const group=data.groups.find(g=>g.id===team.groupId);
      return '<article class="interno-team">'+teamMarkMarkup(team)+'<div><h4>'+escape(team.name)+'</h4>'+(group?'<p>'+escape(group.name)+'</p>':'')+(team.sourceUrl?sourceLink(team.sourceUrl,'Presentación'):'')+'</div></article>';
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
    if(groups===null)return empty('La tabla de papi fútbol','Las posiciones se publicarán cuando estén los equipos y se confirme la puntuación de esta categoría.');
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
  const notificationParams=new URLSearchParams(location.search),requestedCategory=notificationParams.get('internoCategoria'),requestedTab=notificationParams.get('internoTab'),requestedMatch=notificationParams.get('internoPartido');
  if(['masculino','femenino','mas38'].includes(requestedCategory))select.value=requestedCategory;
  let currentTab=['fixture','resultados','grupos'].includes(requestedTab)?requestedTab:'grupos',data=null,lastJson='',loading=false,notificationTargetPending=true;
  const contact=document.getElementById('interno-inscripcion');
  const originalContact=contact?{href:contact.href,text:contact.textContent}:null;
  const originalState=document.getElementById('interno-inscripcion-estado').textContent;
  const originalText=document.getElementById('interno-inscripcion-texto').textContent;
  function render(){
    tabs.forEach(button=>{const active=button.dataset.internoTab===currentTab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    panel.setAttribute('aria-labelledby','interno-tab-'+currentTab);
    panel.querySelectorAll('video').forEach(video=>video.pause());
    if(data)panel.innerHTML=internoPanelMarkup(data,select.value,currentTab);
    if(requestedMatch&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(requestedMatch)){
      const target=document.getElementById('interno-partido-'+requestedMatch);
      if(target){target.classList.add('interno-match-selected');if(notificationTargetPending){notificationTargetPending=false;requestAnimationFrame(()=>target.scrollIntoView({block:'center'}));}}
    }
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
  panel.addEventListener('toggle',event=>{if(event.target.matches('.interno-format-video')&&!event.target.open)event.target.querySelector('video')?.pause();},true);
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
