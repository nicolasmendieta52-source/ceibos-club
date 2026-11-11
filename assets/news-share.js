const GREEN='#18342e',GOLD='#e5bb52',CREAM='#f6f1e4';
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('No se pudo cargar la foto de la noticia'));image.src=src;});}
function contain(ctx,image,x,y,width,height){const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);}
function fitText(ctx,text,size,width,family='Anton'){while(size>18){ctx.font='400 '+size+'px "'+family+'", Arial, sans-serif';if(ctx.measureText(text).width<=width)break;size--;}return size;}

export async function createNewsStory(article){
  const photo=article.querySelector('.club-news-photo img'),heading=article.querySelector('h3'),time=article.querySelector('time');
  if(!photo||!heading)throw Error('La noticia no tiene foto o título');
  const fonts=document.fonts?Promise.allSettled([document.fonts.load('400 120px Anton'),document.fonts.load('500 30px "DM Sans"')]):Promise.resolve();
  const [image,emblem]=await Promise.all([loadImage(photo.currentSrc||photo.src),loadImage('/assets/escudo-ceibos.png'),fonts]);
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo preparar la postal');
  ctx.fillStyle=GREEN;ctx.fillRect(0,0,1080,1920);ctx.fillStyle=GOLD;ctx.fillRect(60,170,960,3);
  contain(ctx,emblem,72,210,105,136);ctx.fillStyle=CREAM;ctx.textAlign='left';ctx.font='600 31px "DM Sans", Arial, sans-serif';ctx.fillText('CEIBOS CLUB',210,260);ctx.fillStyle=GOLD;ctx.font='500 22px "DM Sans", Arial, sans-serif';ctx.fillText('NOTICIAS DEL CLUB',210,305);
  const lines=heading.innerText.split(/\n/).map(line=>line.trim().toUpperCase()).filter(Boolean);let y=500;
  for(const line of lines.slice(0,3)){ctx.fillStyle=y===500?CREAM:GOLD;const size=fitText(ctx,line,142,936);ctx.fillText(line,72,y);y+=size+18;}
  ctx.fillStyle='#10251f';ctx.fillRect(0,740,1080,608);contain(ctx,image,0,740,1080,608);
  ctx.fillStyle=GOLD;ctx.fillRect(72,1395,72,3);ctx.fillStyle=CREAM;ctx.font='500 31px "DM Sans", Arial, sans-serif';ctx.fillText(article.querySelector('.club-news-award')?.textContent.trim()||'La alegría de ser Ceibos',72,1460,936);
  ctx.fillStyle=GOLD;ctx.font='500 25px "DM Sans", Arial, sans-serif';ctx.fillText(time?.textContent.trim()||'',72,1512);ctx.fillStyle=CREAM;ctx.font='500 25px "DM Sans", Arial, sans-serif';ctx.fillText('Foto: '+(article.querySelector('.club-news-source')?.textContent.trim()||'Ceibos Club'),72,1564,936);
  ctx.fillStyle=GOLD;ctx.fillRect(72,1610,936,2);ctx.fillStyle=CREAM;ctx.font='600 30px "DM Sans", Arial, sans-serif';ctx.fillText('ceibosclub.com',72,1665);ctx.textAlign='right';ctx.fillStyle=GOLD;ctx.font='italic 30px Georgia, serif';ctx.fillText('Totus Tuus',1008,1665);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('No se pudo crear la postal')),'image/png'));
}

function initNewsSharing(){
  const dialog=document.getElementById('noticiaPostalDialog');if(!dialog||typeof dialog.showModal!=='function')return;
  const preview=document.getElementById('noticiaPostalImagen'),status=document.getElementById('noticiaPostalEstado'),send=dialog.querySelector('[data-news-send]');let current=null,opener=null;
  function clear(){if(current)URL.revokeObjectURL(current.url);current=null;preview.removeAttribute('src');}
  function download(){if(!current)return;const link=document.createElement('a');link.href=current.url;link.download=current.file.name;link.click();status.textContent='Postal descargada. Agregala a una historia desde Instagram.';}
  document.querySelectorAll('[data-news-share]').forEach(button=>{
    button.hidden=false;button.addEventListener('click',async()=>{const article=document.getElementById(button.dataset.newsShare),message=article?.querySelector('[data-news-status]');if(!article)return;button.disabled=true;if(message)message.textContent='Preparando la postal…';
      try{const blob=await createNewsStory(article);clear();const file=new File([blob],article.id+'-historia.png',{type:'image/png'});current={file,url:URL.createObjectURL(blob),link:'https://ceibosclub.com/#'+article.id};preview.src=current.url;preview.alt='Postal: '+article.querySelector('h3').innerText.replace(/\n/g,' ');status.textContent='';opener=button;dialog.showModal();dialog.scrollTop=0;if(message)message.textContent='';}
      catch{if(message)message.textContent='No pudimos preparar la postal. Probá nuevamente o abrí la publicación de Instagram.';}finally{button.disabled=false;}
    });
  });
  dialog.querySelector('[data-news-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{clear();opener?.focus();});
  dialog.querySelector('[data-news-download]').addEventListener('click',download);
  dialog.querySelector('[data-news-link]').addEventListener('click',async()=>{if(!current)return;try{await navigator.clipboard.writeText(current.link);status.textContent='Enlace copiado. Podés pegarlo en el sticker de enlace de tu historia.';}catch{status.textContent='Enlace de la noticia: '+current.link;}});
  send.addEventListener('click',async()=>{if(!current)return;const data={files:[current.file]};try{if(navigator.share&&navigator.canShare?.(data)){send.disabled=true;await navigator.share(data);status.textContent='Postal enviada al menú de compartir.';}else download();}catch(error){if(error.name!=='AbortError')status.textContent='No se pudo compartir. Usá Descargar PNG para guardarla y subirla a Instagram.';}finally{send.disabled=false;}});
}
if(typeof document!=='undefined')initNewsSharing();
