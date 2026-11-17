import {answerClubConversation} from './club-assistant-conversation.js?v=20261117conversacion';

function initAssistant(){
 const dialog=document.getElementById('clubAssistantDialog');if(!dialog||typeof dialog.showModal!=='function')return;
 const log=dialog.querySelector('[data-assistant-log]'),form=dialog.querySelector('form'),input=form.querySelector('textarea'),send=form.querySelector('button'),status=dialog.querySelector('[data-assistant-status]'),examples=dialog.querySelector('.club-assistant-examples'),stop=dialog.querySelector('[data-assistant-stop]');
 let state={sports:[],events:[],facts:[]},context={},opener=null,busy=false,sequence=0,draftContext=null;const waiters=new Set();
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
 function setBusy(value){busy=value;send.disabled=value;stop.hidden=!value;log.setAttribute('aria-busy',String(value));}
 function editDraft(question,snapshot){if(busy)return;input.value=question;draftContext=structuredClone(snapshot||{});status.textContent='Modificá la pregunta y volvé a enviarla.';input.focus({preventScroll:true});input.setSelectionRange(0,input.value.length);}
 function appendUser(text,question,snapshot){const message=document.createElement('div'),label=document.createElement('strong'),p=document.createElement('p'),edit=document.createElement('button');message.className='club-assistant-message is-user';label.textContent='Vos';p.textContent=text;edit.type='button';edit.className='club-assistant-edit';edit.textContent='Editar';edit.setAttribute('aria-label','Editar pregunta: '+text);edit.addEventListener('click',()=>editDraft(question,snapshot));message.append(label,p,edit);log.append(message);scroll();}
 function appendAnswer(answer,question=''){
  const message=document.createElement('div'),label=document.createElement('strong'),p=document.createElement('p');message.className='club-assistant-message is-ceibos';label.textContent='Ceibos';p.textContent=answer.text;message.append(label,p);
  const links=new Map(),details=new Set(),textRows=[];if(answer.items?.length){for(const row of answer.items){if(row.text&&row.text!==answer.text&&!details.has(row.text)){details.add(row.text);textRows.push(row.text);}if(/^(?:#|\/(?!\/)|\?)/.test(row.href||'')&&!links.has(row.href))links.set(row.href,row.label);}}
  function listRows(rows,parent){const list=document.createElement('ul');for(const value of rows){const li=document.createElement('li'),paragraph=document.createElement('p');paragraph.textContent=value;li.append(paragraph);list.append(li);}if(list.children.length)parent.append(list);}
  listRows(textRows.slice(0,5),message);if(textRows.length>5){const more=document.createElement('details'),summary=document.createElement('summary');more.className='club-assistant-more';summary.textContent='Ver '+(textRows.length-5)+' más';more.append(summary);listRows(textRows.slice(5),more);message.append(more);}
  if(answer.source){const source=document.createElement('small');source.className='club-assistant-source';source.textContent=answer.source;message.append(source);}
  if(answer.choices?.length){const choices=document.createElement('div');choices.className='club-assistant-choices';for(const choice of answer.choices){const button=document.createElement('button');button.type='button';button.textContent=choice.label;button.addEventListener('click',()=>ask(choice.question,choice.resolution,{context:answer.context}));choices.append(button);}message.append(choices);}
  if(question&&!answer.choices?.length){const actions=document.createElement('div'),copy=document.createElement('button'),repair=document.createElement('button');actions.className='club-assistant-actions';copy.type=repair.type='button';copy.textContent='Copiar';copy.dataset.assistantCopy='';copy.setAttribute('aria-label','Copiar respuesta');copy.addEventListener('click',async()=>{try{const text=[answer.text,...textRows,...(answer.source?[answer.source]:[]),...[...links].map(([href,title])=>title+': '+new URL(href,location.href).href)].join('\n\n');await navigator.clipboard.writeText(text);copy.textContent='Copiado';status.textContent='Respuesta copiada.';}catch{status.textContent='No pude copiar automáticamente. Podés seleccionar el texto de la respuesta.';}});repair.textContent='No era lo que buscaba';repair.dataset.assistantRepair='';repair.addEventListener('click',()=>ask('No es lo que buscaba',null,{context:answer.context}));actions.append(copy,repair);message.append(actions);}
  if(answer.editQuestion){const edit=document.createElement('button');edit.type='button';edit.className='club-assistant-rephrase';edit.textContent='Reformular mi pregunta';edit.addEventListener('click',()=>editDraft(answer.editQuestion,answer.context));message.append(edit);}
  if(answer.suggestions?.length){const suggestions=document.createElement('div');suggestions.className='club-assistant-followups';suggestions.setAttribute('aria-label','Podés seguir consultando');for(const suggestion of answer.suggestions){const button=document.createElement('button');button.type='button';button.textContent=suggestion.label+' ↗';button.addEventListener('click',()=>ask(suggestion.question,null,{context:answer.context}));suggestions.append(button);}message.append(suggestions);}
  if(links.size){const footer=document.createElement('div');footer.className='club-assistant-links';for(const [href,title]of links){const a=document.createElement('a');a.href=href;a.textContent=title+' →';a.addEventListener('click',event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey)dialog.close();});footer.append(a);}message.append(footer);}
  log.append(message);scroll();return message;
 }
 function ready(kind){return kind==='interno'?Boolean(state.interno):kind==='club'?state.clubResultsReady===true:kind==='tables'?state.tablesReady===true:Boolean(state.gym&&state.gym.status!=='loading');}
 function waitData(kind,turn){if(ready(kind))return Promise.resolve();return new Promise(resolve=>{const timer=setTimeout(done,6500);function done(){clearTimeout(timer);waiters.delete(check);resolve();}function check(){if(ready(kind)||turn!==sequence)done();}waiters.add(check);});}
 function changed(){for(const notify of [...waiters])notify();}
 async function ask(value,resolution=null,options={}){
  const question=String(value||'').trim().slice(0,300);if(!question||busy)return;setBusy(true);const turn=sequence,snapshot=options.context||draftContext||context,queryContext=resolution?{...snapshot,resolution}:snapshot;draftContext=null;input.value='';examples.hidden=true;appendUser(resolution?.label||question,question,snapshot);status.textContent='Consultando datos del club…';
  try{
   requestData();let answer=answerClubConversation(question,{...state,facts:[...state.facts,...collectFacts()]},queryContext);
   if(answer.waiting){await waitData(answer.waiting,turn);if(turn!==sequence)return;answer=answerClubConversation(question,{...state,facts:[...state.facts,...collectFacts()]},queryContext);}
   if(turn===sequence){context=answer.context||{};appendAnswer(answer,question);}
  }catch{if(turn===sequence)appendAnswer({text:'No pude completar esa consulta. Podés volver a intentarlo o revisar la sección.',items:[{label:'Ver Interno',href:'#interno'},{label:'Ver Gym',href:'#gym-campaign'}],editQuestion:question},question);}
  finally{if(turn===sequence){setBusy(false);status.textContent='';if(dialog.open)input.focus({preventScroll:true});}}
 }
 function welcome(){log.replaceChildren();appendAnswer({text:'Hola. ¿Qué querés saber de Ceibos? Podés escribir una pregunta o empezar por acá.'});examples.hidden=false;log.append(examples);}
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
 stop.addEventListener('click',()=>{sequence++;setBusy(false);changed();status.textContent='Consulta detenida. Podés escribir otra pregunta.';input.focus({preventScroll:true});});
 dialog.querySelector('[data-assistant-reset]').addEventListener('click',()=>{sequence++;setBusy(false);changed();context={};draftContext=null;input.value='';status.textContent='';welcome();input.focus();});
 window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);addEventListener('resize',viewport);
}
if(typeof document!=='undefined')initAssistant();
