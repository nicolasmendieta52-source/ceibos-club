const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
export const searchText=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/([a-z])(\d)/g,'$1 $2').replace(/[^a-z0-9]+/g,' ').trim();
const words=value=>searchText(value).split(' ').filter(Boolean);
const stop=new Set(['de','del','el','la','los','las','en','para','por','con','un','una','ver','busco','buscar','quiero','donde']);
const sportAliases={futbol:'futbol football soccer',basketball:'basket basquet basquetbol basketball baske',rugby:'rugby',hockey:'hockey'};
const sectionRows=[
 ['inicio','Inicio','#inicio','Ceibos Club','home portada'],
 ['fixture','Próximos partidos','#fixture','El fixture de los deportes del club','fixture horarios horario agenda juega juegan fecha partidos'],
 ['resultados','Resultados','#resultados','Los últimos resultados de los deportes','marcadores resultado gano goles'],
 ['deportes','Deportes','#deportes','Fútbol, basketball, rugby y hockey','planteles categorias'],
 ['interno','Interno Ceibos','#interno','El torneo de fútbol 8','interno futbol 8 torneo'],
 ['interno-live','Ahora en las canchas','#interno-ahora','Partidos simultáneos, canchas y minuto de juego','interno vivo directo ahora reloj entretiempo juega canchas minutos'],
 ['gym','Gimnasio Ceibos','#gym-campaign','La campaña de ladrillos y sus aportes','gym gimnasio ladrillo ladrillos colaborar aportes recaudacion meta'],
 ['gym-proyecto','Proyecto del Gimnasio','#proyecto-gimnasio','Conocé el proyecto y su video','gym gimnasio construccion video'],
 ['noticias','Noticias del club','#noticias','Logros y novedades de Ceibos','noticia comunidad felicitaciones campeones ascenso'],
 ['vida','Vida Ceibos','#vida','La agenda social del club','eventos cena fiesta cmc calendario social'],
 ['club','Nuestra historia','#club','Conocé Ceibos Club','club historia totus tuus fundacion'],
 ['predio','Predio de Ceibos','#predio','Canchas e instalaciones','ubicacion direccion mapa llegar canchas'],
 ['archivo','Archivo histórico','#archivo','Temporadas y logros de los deportes','historia campeonatos archivo'],
 ['shop','Tienda Ceibos','#shop','La indumentaria oficial del club','shop tienda ropa camiseta remera musculosa comprar'],
 ['solidario','Ceibos solidario','#solidario','Las acciones solidarias del club','olla ollas abrigo canastas solidaridad'],
 ['contacto','Contacto y socios','#contacto','Contactate con el club','sumate socio socios contacto administracion cuotas telefono email'],
 ['reglamento','Reglamento del Interno','/assets/reglamento-interno-f8-ceibos-2026.pdf','Abrir el reglamento 2026 en PDF','interno reglamento reglas futbol 8 pdf formato']
];
const dateText=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Intl.DateTimeFormat('es-UY',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'Fecha a confirmar';

export function buildSearchIndex({sports=[],events=[],interno=null,content=[]}={}){
 const entries=new Map();
 const add=(id,title,href,description='',keywords='',kind='Sección',boost=0)=>{
  if(!title||!/^(?:#|\/(?!\/)|\?)/.test(href))return;
  const row={id,title:clean(title),href,description:clean(description),kind,boost};
  row.titleText=searchText(row.title);row.tokens=words([row.title,row.description,keywords].join(' '));entries.set(id,row);
 };
 for(const [id,title,href,description,keys]of sectionRows)add(id,title,href,description,keys);
 for(const sport of sports){
  if(!/^[a-z]+$/.test(sport.slug||''))continue;
  add('sport-'+sport.slug,sport.name,'#'+sport.slug,'Planteles, fixture, resultados y tablas',sportAliases[sport.slug]||sport.name,'Deporte',15);
  for(const category of sport.categories||[])add('category-'+sport.slug+'-'+category,sport.name+' · '+category,'?deporte='+encodeURIComponent(sport.slug)+'&categoria='+encodeURIComponent(category)+'#'+sport.slug,'Fixture, resultados, posiciones y goleadores',[sportAliases[sport.slug],category,'categoria equipo plantel horarios partidos juega tabla tablas campeonato goleadores posiciones'].join(' '),'Categoría',25);
 }
 for(const event of events)if(event.fecha&&event.titulo)add('event-'+event.fecha+'-'+event.titulo,event.titulo,'#evento-'+event.fecha+'-'+searchText(event.titulo).replace(/ /g,'-'),dateText(event.fecha)+' · '+(event.desc||''),'vida ceibos evento agenda social cena fiesta '+event.tipo,'Evento',20);
 for(const row of content)add('content-'+row.id,row.title,row.href,row.description,row.keywords,row.kind||'Noticia',20);
 if(interno){
  const tabs=[['grupos','Grupos'],['equipos','Equipos'],['fixture','Fixture'],['resultados','Resultados'],['posiciones','Tabla de posiciones'],['goleadores','Goleadores'],['cruces','Formato y cruces']];
  for(const category of interno.categories||[]){
   const url='?internoCategoria='+encodeURIComponent(category.id);
   for(const [tab,label]of tabs)add('interno-'+category.id+'-'+tab,label+' · '+category.name,url+'&internoTab='+tab+'#interno','Interno Ceibos 2026','interno '+category.name+' '+(category.id==='mas38'?'papi futbol +38':'')+' '+label+(tab==='fixture'?' horarios partidos juega':'')+(tab==='posiciones'?' campeonato tabla tablas':'')+(tab==='cruces'?' copas reglamento formato':''),'Interno',20);
  }
  for(const team of interno.teams||[]){
   const category=interno.categories.find(c=>c.id===team.categoryId),group=interno.groups.find(g=>g.id===team.groupId);
   add('team-'+team.id,team.name,'?internoCategoria='+encodeURIComponent(team.categoryId)+'&internoTab=equipos&internoEquipo='+encodeURIComponent(team.id)+'#interno','Interno · '+(category?.name||'')+(group?' · '+group.name:''),'interno equipo partidos fixture horarios juega resultados cancha '+category?.name+' '+group?.name,'Equipo',60);
  }
  for(const group of interno.groups||[]){const category=interno.categories.find(c=>c.id===group.categoryId);add('group-'+group.id,group.name+' · '+category?.name,'?internoCategoria='+encodeURIComponent(group.categoryId)+'&internoTab=grupos#interno','Grupos del Interno 2026','interno grupo grupos serie zona '+category?.name,'Grupo',10);}
  for(const match of interno.matches||[]){
   if(match.status==='cancelled')continue;
   const home=interno.teams.find(t=>t.id===match.homeId),away=interno.teams.find(t=>t.id===match.awayId);if(!home||!away)continue;
   const category=interno.categories.find(c=>c.id===match.categoryId),finished=match.status==='finished';
   const detail=[category?.name,dateText(match.date),match.time?match.time+' h':finished?'':'Horario a confirmar',match.court,finished?match.homeGoals+'–'+match.awayGoals:''].filter(Boolean).join(' · ');
   add('match-'+match.id,home.name+' vs. '+away.name,'?internoCategoria='+encodeURIComponent(match.categoryId)+'&internoTab='+(finished?'resultados':'fixture')+'&internoPartido='+encodeURIComponent(match.id)+'#interno',detail,'interno partido partidos fixture horarios juega '+(finished?'resultado goles':'proximo'),'Partido');
  }
 }
 return [...entries.values()];
}

function nearWord(a,b){
 if(a.length<4||b.length<4||/\d/.test(a+b))return false;
 const limit=a.length>=8?2:1;if(Math.abs(a.length-b.length)>limit)return false;
 let previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));if(Math.min(...row)>limit)return false;previous=row;}
 return previous[b.length]<=limit;
}

export function searchIndex(index,query,limit=12){
 const normalized=searchText(String(query||'').slice(0,100)),allWords=words(normalized),tokens=allWords.length>1?allWords.filter(word=>!stop.has(word)):allWords;
 if(!tokens.length)return {results:[],approximate:false};
 const rank=fuzzy=>index.flatMap(row=>{
  let score=row.boost;
  for(const token of tokens){
   if(row.tokens.includes(token))score+=40;
   else if(row.tokens.some(word=>word.startsWith(token)))score+=20;
   else if(fuzzy&&row.tokens.some(word=>nearWord(token,word)))score+=2;
   else return [];
  }
  if(row.titleText===normalized)score+=1000;else if(row.titleText.startsWith(normalized))score+=350;else if(row.titleText.includes(normalized))score+=150;
  return [{...row,score}];
 }).sort((a,b)=>b.score-a.score||a.title.length-b.title.length||a.title.localeCompare(b.title,'es')).slice(0,limit);
 const exact=rank(false);return exact.length?{results:exact,approximate:false}:{results:rank(true),approximate:true};
}
