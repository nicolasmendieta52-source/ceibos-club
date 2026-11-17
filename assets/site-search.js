import {buildSearchIndex,searchIndex} from './search-model.js?v=20261117';

function initSearch(){
 const dialog=document.getElementById('siteSearchDialog');if(!dialog||typeof dialog.showModal!=='function')return;
 const input=dialog.querySelector('input'),list=dialog.querySelector('[data-search-results]'),status=dialog.querySelector('[data-search-status]'),clear=dialog.querySelector('[data-search-clear]'),empty=dialog.querySelector('[data-search-empty]');
 let sports=[],events=[],interno=null,index=[],active=-1,opener=null,timer=0;
 function contentRows(){return [...document.querySelectorAll('#noticias .club-news-feature')].flatMap(article=>{
  const title=article.querySelector('h3'),id=article.id||title?.id;if(!id||!title)return [];
  const text=selector=>article.querySelector(selector)?.innerText.replace(/\s+/g,' ').trim()||'';
  return [{id,title:text('h3')+' '+text('.club-news-award'),href:'#'+encodeURIComponent(id),description:text('.club-news-category'),keywords:text('.club-news-body'),kind:'Noticia'}];
 });}
 function rebuild(){index=buildSearchIndex({sports,events,interno,content:contentRows()});if(dialog.open)render();}
 function select(position){
  const options=[...list.querySelectorAll('[role=option]')];active=position;
  options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===active)));
  if(active>=0&&options[active]){input.setAttribute('aria-activedescendant',options[active].id);options[active].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
 }
 function render(){
  clearTimeout(timer);timer=0;
  const query=input.value.trim(),found=query?searchIndex(index,query):{results:['interno-live','fixture','gym','noticias','vida','contacto'].map(id=>index.find(row=>row.id===id)).filter(Boolean),approximate:false};
  active=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();clear.hidden=!input.value;empty.hidden=found.results.length>0;
  status.textContent=query?(found.results.length?(found.approximate?'Resultados aproximados · ':'')+found.results.length+' '+(found.results.length===1?'sugerencia':'sugerencias'):'Sin coincidencias'):'Accesos frecuentes';
  if(!found.results.length)empty.textContent='No encontramos “'+query+'”. Probá con el nombre de un equipo, una categoría o una sección.'+(!interno?' Los equipos del Interno todavía se están cargando.':'');
  found.results.forEach((row,i)=>{
   const li=document.createElement('li'),link=document.createElement('a'),text=document.createElement('div'),kind=document.createElement('small'),title=document.createElement('strong'),description=document.createElement('p'),arrow=document.createElement('span');
   li.setAttribute('role','presentation');link.className='site-search-result';link.href=row.href;link.id='site-search-result-'+i;link.setAttribute('role','option');link.setAttribute('aria-selected','false');link.tabIndex=-1;
   kind.textContent=row.kind;title.textContent=row.title;description.textContent=row.description;arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');text.append(kind,title,description);link.append(text,arrow);li.append(link);list.append(li);
   link.addEventListener('click',event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)dialog.close();});
  });
  input.setAttribute('aria-expanded',String(found.results.length>0));
 }
 function viewport(){if(!dialog.open)return;const view=window.visualViewport;dialog.style.setProperty('--search-height',(view?.height||innerHeight)+'px');dialog.style.setProperty('--search-top',(view?.offsetTop||0)+'px');}
 function open(button){
  if(document.querySelector('dialog[open]')&&!dialog.open)return;
  opener=button||document.activeElement;window.dispatchEvent(new Event('ceibos:search-open'));
  window.dispatchEvent(new Event('ceibos:search-request'));window.dispatchEvent(new Event('ceibos:interno-search-request'));rebuild();
  if(!dialog.open){dialog.showModal();document.body.classList.add('site-search-open');}viewport();render();input.focus();
 }
 window.addEventListener('ceibos:search-content',event=>{sports=Array.isArray(event.detail?.sports)?event.detail.sports:[];events=Array.isArray(event.detail?.events)?event.detail.events:[];rebuild();});
 window.addEventListener('ceibos:interno-search-data',event=>{interno=event.detail;rebuild();});
 document.querySelectorAll('[data-site-search-open]').forEach(button=>button.addEventListener('click',()=>open(button)));
 dialog.querySelector('[data-search-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
 dialog.addEventListener('close',()=>{document.body.classList.remove('site-search-open');input.removeAttribute('aria-activedescendant');input.setAttribute('aria-expanded','false');const target=opener?.isConnected&&opener.getClientRects().length&&!opener.closest('[inert]')?opener:document.querySelector('#nav [data-site-search-open]');target?.focus({preventScroll:true});});
 clear.addEventListener('click',()=>{input.value='';render();input.focus();});
 input.addEventListener('input',()=>{clearTimeout(timer);active=-1;input.removeAttribute('aria-activedescendant');timer=setTimeout(render,70);});
 input.addEventListener('keydown',event=>{
  if(event.isComposing)return;if(timer&&['ArrowDown','ArrowUp'].includes(event.key))render();const options=[...list.querySelectorAll('[role=option]')];
  if(['ArrowDown','ArrowUp'].includes(event.key)&&options.length){event.preventDefault();select(event.key==='ArrowDown'?(active+1)%options.length:(active<=0?options.length:active)-1);}
 });
 dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);if(active<0)render();list.querySelectorAll('[role=option]')[Math.max(0,active)]?.click();});
 dialog.querySelectorAll('[data-search-query]').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.searchQuery;render();input.focus();}));
 addEventListener('keydown',event=>{
  const typing=event.target.closest('input,textarea,select,[contenteditable=true]');
  if((event.key.toLowerCase()==='k'&&(event.metaKey||event.ctrlKey)&&!event.altKey)||(event.key==='/'&&!typing&&!event.metaKey&&!event.ctrlKey&&!event.altKey)){
   if(document.querySelector('dialog[open]')&&!dialog.open)return;
   event.preventDefault();open();
  }
 });
 window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);addEventListener('resize',viewport);
 rebuild();
}
if(typeof document!=='undefined')initSearch();
