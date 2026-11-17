import {answerClubQuestion} from './club-assistant-model.js?v=20261117directa';

function initAssistant(){
 const dialog=document.getElementById('clubAssistantDialog');if(!dialog||typeof dialog.showModal!=='function')return;
 const log=dialog.querySelector('[data-assistant-log]'),form=dialog.querySelector('form'),input=form.querySelector('textarea'),send=form.querySelector('button'),status=dialog.querySelector('[data-assistant-status]'),examples=dialog.querySelector('.club-assistant-examples');
 let state={sports:[],events:[],facts:[]},context={},opener=null,busy=false,sequence=0;const waiters=new Set();
 function collectFacts(){
  const facts=[];
  for(const id of ['club','predio','shop','socios','solidario','contacto','proyecto-gimnasio','noticias','interno']){
   const root=document.getElementById(id);if(!root)continue;
   const heading=root.querySelector('h2')?.textContent.replace(/\s+/g,' ').trim()||id;
   for(const p of root.querySelectorAll('p, .club-news-award, .noticia-dato, .predio-dato')){
    if(p.closest('.interno-live,.interno-torneo,.interno-alerts,.interno-media-post,form,dialog,[aria-hidden=true]')||p.matches('.interno-kicker'))continue;
    const text=p.textContent.replace(/\s+/g,' ').trim();if(text.length<22||text.length>1800)continue;
    const card=p.closest('article,.prod,.soli-card,.socio-card'),title=[heading,card?.querySelector('h3,h4')?.textContent].filter(Boolean).join(' · '),anchor=card?.id||card?.querySelector('h3[id]')?.id||id;
    facts.push({title,text,href:'#'+encodeURIComponent(anchor),keywords:id==='club'?'historia club':id==='shop'?'tienda indumentaria':id});
   }
   for(const a of root.querySelectorAll('a[href^="mailto:"],a[href^="tel:"],a[href*="instagram.com/"]')){if(id==='interno'&&a.closest('.interno-recuerdos,.interno-history'))continue;facts.push({title:heading,text:a.getAttribute('href').startsWith('mailto:')?'Correo de contacto: '+a.getAttribute('href').slice(7).split('?')[0]:a.textContent.replace(/\s+/g,' ').trim()+' · '+a.href,href:'#'+id,keywords:'contacto correo email telefono redes instagram '+id});}
  }
  for(const edition of document.querySelectorAll('.interno-recuerdos[id]')){
   const year=Number(edition.querySelector('.interno-recuerdos-titulo')?.textContent.match(/\b(?:19|20)\d{2}\b/)?.[0]);if(!year)continue;
   for(const group of edition.querySelectorAll('.interno-copas>div')){const category=group.querySelector('h4')?.textContent.trim();if(!category)continue;const categoryId=/femenino/i.test(category)?'femenino':/masculino/i.test(category)?'masculino':'papi';
    for(const row of group.querySelectorAll('dl>div')){const cup=row.querySelector('dt')?.textContent.trim(),team=row.querySelector('dd')?.textContent.trim();if(!cup||!team)continue;facts.push({title:'Campeones del Interno '+year,text:team+' ganó la Copa de '+cup+' del Interno '+year+' ('+category+').',href:'#'+edition.id,champion:{year,category,categoryId,cup,team}});}
   }
  }
  for(const script of document.querySelectorAll('script[type="application/ld+json"]')){try{const data=JSON.parse(script.textContent),address=data.address;if(address?.streetAddress)facts.push({title:'Dirección de Ceibos',text:[address.streetAddress,address.addressLocality,address.addressCountry].filter(Boolean).join(', ')+'.',href:'#predio',keywords:'ubicacion direccion donde queda llegar'});}catch{}}
  return facts;
 }
 function requestData(){window.dispatchEvent(new Event('ceibos:assistant-request'));window.dispatchEvent(new Event('ceibos:interno-search-request'));window.dispatchEvent(new Event('ceibos:gym-request'));}
 function viewport(){if(!dialog.open)return;const view=window.visualViewport,height=view?.height||innerHeight;dialog.style.setProperty('--assistant-height',height+'px');dialog.style.setProperty('--assistant-top',(view?.offsetTop||0)+'px');dialog.classList.toggle('is-compact',height<600);}
 function scroll(){log.scrollTop=log.scrollHeight;}
 function appendUser(text){const message=document.createElement('div'),label=document.createElement('strong'),p=document.createElement('p');message.className='club-assistant-message is-user';label.textContent='Vos';p.textContent=text;message.append(label,p);log.append(message);scroll();}
 function appendAnswer(answer){
  const message=document.createElement('div'),label=document.createElement('strong'),p=document.createElement('p');message.className='club-assistant-message is-ceibos';label.textContent='Ceibos';p.textContent=answer.text;message.append(label,p);
  const links=new Map(),details=new Set();if(answer.items?.length){const list=document.createElement('ul');for(const row of answer.items){if(row.text&&row.text!==answer.text&&!details.has(row.text)){details.add(row.text);const li=document.createElement('li'),paragraph=document.createElement('p');paragraph.textContent=row.text;li.append(paragraph);list.append(li);}if(/^(?:#|\/(?!\/)|\?)/.test(row.href||'')&&!links.has(row.href))links.set(row.href,row.label);}if(list.children.length)message.append(list);}
  if(answer.source){const source=document.createElement('small');source.className='club-assistant-source';source.textContent=answer.source;message.append(source);}
  if(answer.choices?.length){const choices=document.createElement('div');choices.className='club-assistant-choices';for(const choice of answer.choices){const button=document.createElement('button');button.type='button';button.textContent=choice.label;button.addEventListener('click',()=>ask(choice.question,choice.resolution));choices.append(button);}message.append(choices);}
  if(links.size){const footer=document.createElement('div');footer.className='club-assistant-links';for(const [href,title]of links){const a=document.createElement('a');a.href=href;a.textContent=title+' →';a.addEventListener('click',event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey)dialog.close();});footer.append(a);}message.append(footer);}
  log.append(message);scroll();return message;
 }
 function ready(kind){return kind==='interno'?Boolean(state.interno):kind==='club'?state.clubResultsReady===true:Boolean(state.gym&&state.gym.status!=='loading');}
 function waitData(kind){if(ready(kind))return Promise.resolve();return new Promise(resolve=>{const timer=setTimeout(done,6500);function done(){clearTimeout(timer);waiters.delete(check);resolve();}function check(){if(ready(kind))done();}waiters.add(check);});}
 function changed(){for(const notify of [...waiters])notify();}
 async function ask(value,resolution=null){
  const question=String(value||'').trim().slice(0,300);if(!question||busy)return;busy=true;send.disabled=true;const turn=sequence,queryContext=resolution?{...context,resolution}:context;input.value='';examples.hidden=true;appendUser(resolution?.label||question);status.textContent='Consultando datos del club…';
  try{
   requestData();let answer=answerClubQuestion(question,{...state,facts:[...state.facts,...collectFacts()]},queryContext);
   if(answer.waiting){await waitData(answer.waiting);answer=answerClubQuestion(question,{...state,facts:[...state.facts,...collectFacts()]},queryContext);}
   if(turn===sequence){context=answer.context||{};appendAnswer(answer);}
  }catch{if(turn===sequence)appendAnswer({text:'No pude completar esa consulta. Probá de nuevo o usá el buscador para encontrar la sección.',items:[{label:'Ver Interno',href:'#interno'},{label:'Ver Gym',href:'#gym-campaign'}]});}
  finally{if(turn===sequence){busy=false;send.disabled=false;status.textContent='';if(dialog.open)input.focus({preventScroll:true});}}
 }
 function welcome(){log.replaceChildren();appendAnswer({text:'¡Hola! Consultame sobre la información publicada en Ceibos: partidos, resultados, equipos, Gym, eventos, historia, tienda y más. Si un dato no está publicado, te lo voy a aclarar.'});examples.hidden=false;}
 function open(button){
  const search=document.getElementById('siteSearchDialog');if(search?.open)search.close();if(document.querySelector('dialog[open]')&&!dialog.open)return;
  opener=button||document.activeElement;window.dispatchEvent(new Event('ceibos:search-open'));if(!log.children.length)welcome();if(!dialog.open)dialog.showModal();document.body.classList.add('club-assistant-open');viewport();requestData();input.focus({preventScroll:true});scroll();
 }
 window.addEventListener('ceibos:assistant-content',event=>{state={...state,...event.detail};changed();});
 window.addEventListener('ceibos:interno-search-data',event=>{state.interno=event.detail;changed();});
 window.addEventListener('ceibos:gym-data',event=>{state.gym=event.detail;changed();});
 document.querySelectorAll('[data-assistant-open]').forEach(button=>button.addEventListener('click',()=>open(button)));
 dialog.querySelector('[data-assistant-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{document.body.classList.remove('club-assistant-open');const target=opener?.isConnected&&opener.getClientRects().length&&!opener.closest('[inert]')?opener:document.getElementById('clubAssistantFab');target?.focus({preventScroll:true});});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
 form.addEventListener('submit',event=>{event.preventDefault();ask(input.value);});
 input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();ask(input.value);}});
 dialog.querySelectorAll('[data-assistant-question]').forEach(button=>button.addEventListener('click',()=>ask(button.dataset.assistantQuestion)));
 dialog.querySelector('[data-assistant-reset]').addEventListener('click',()=>{sequence++;busy=false;send.disabled=false;context={};input.value='';status.textContent='';welcome();input.focus();});
 window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);addEventListener('resize',viewport);
}
if(typeof document!=='undefined')initAssistant();
