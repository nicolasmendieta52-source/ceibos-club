import {SECTIONS,ACTIONS,emptyCounts,deviceInfo,referrerHost} from './analytics-model.js';
const CHOICE='ceibos_metrics_consent_v1';
let consent=null, stop=null, starting=false;
try{consent=localStorage.getItem(CHOICE);}catch{}
const banner=document.createElement('aside');banner.className='metrics-consent';banner.setAttribute('aria-label','Preferencias de estadísticas');
banner.innerHTML='<p><strong>Ayudanos a mejorar la web</strong>¿Nos permitís medir visitas e interacciones de forma anónima? No registramos lo que escribís en formularios. <a href="/privacidad/">Más información</a></p><div><button type="button" data-choice="yes">Aceptar estadísticas</button><button type="button" data-choice="no">Ahora no</button></div>';
document.body.append(banner);
function show(){banner.hidden=consent!==null;}
show();
banner.addEventListener('click',e=>{const choice=e.target.closest('[data-choice]')?.dataset.choice;if(!choice)return;consent=choice;try{localStorage.setItem(CHOICE,choice);}catch{}show();if(choice==='yes')start();else stop?.();});
document.querySelectorAll('[data-metrics-preferences]').forEach(button=>button.addEventListener('click',()=>{banner.hidden=false;banner.querySelector('button').focus();}));
window.addEventListener('storage',e=>{if(e.key==='ceibos_metrics_exclude'){if(e.newValue==='1')stop?.();else if(consent==='yes')start();}if(e.key===CHOICE){consent=e.newValue;show();if(consent==='yes')start();else stop?.();}});
function excluded(){try{return localStorage.getItem('ceibos_metrics_exclude')==='1';}catch{return false;}}
async function start(){
 if(excluded()||starting||stop||consent!=='yes'||navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
 starting=true;
 try{
  const config=await(await fetch('/notification-config.json')).json();
  const base='https://www.gstatic.com/firebasejs/11.10.0/';
  const [appSdk,authSdk,dbSdk]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
  if(consent!=='yes'||excluded())return;
  const app=appSdk.getApps().find(a=>a.name==='ceibos-metrics')||appSdk.initializeApp(config.firebase,'ceibos-metrics');
  const auth=authSdk.getAuth(app);await auth.authStateReady();
  const user=auth.currentUser||(await authSdk.signInAnonymously(auth)).user;
  if(consent!=='yes'||excluded())return;
  const db=dbSdk.getFirestore(app), id=crypto.randomUUID(), ref=dbSdk.doc(db,'analyticsVisits',id);
  let enabled=true,busy=false,dirty=true,lastTick=performance.now(),lastActivity=Date.now(),writes=0;
  const started=Date.now();
  const data={version:1,ownerUid:user.uid,...deviceInfo(navigator.userAgent,innerWidth),language:(navigator.language||'').slice(0,20),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Desconocida',referrer:referrerHost(document.referrer),path:location.pathname==='/'?'/':location.pathname.slice(0,120),activeSeconds:0,scrollDepth:0,interactions:0,sections:emptyCounts(SECTIONS),actions:emptyCounts(ACTIONS)};
  function tick(){const now=performance.now();if(!document.hidden&&Date.now()-lastActivity<60000)data.activeSeconds=Math.min(10800,data.activeSeconds+Math.min(15,Math.max(0,Math.round((now-lastTick)/1000))));lastTick=now;dirty=true;}
  let initialCreatedAt=null;
  async function save(force=false){if(!force&&(document.hidden||Date.now()-lastActivity>60000))return;if(!enabled||busy||!dirty||writes>=190||consent!=='yes'||excluded())return;busy=true;dirty=false;try{
    if(!initialCreatedAt){const stamp=dbSdk.Timestamp.now();initialCreatedAt=stamp;}
    await dbSdk.setDoc(ref,{...data,createdAt:initialCreatedAt,lastSeen:dbSdk.serverTimestamp(),expiresAt:dbSdk.Timestamp.fromMillis(started+90*86400000)});writes++;
  }catch{dirty=true;}finally{busy=false;}}
  function action(key){if(!ACTIONS.includes(key)||data.interactions>=500)return;data.actions[key]=Math.min(500,data.actions[key]+1);data.interactions++;dirty=true;save();}
  function activity(){lastActivity=Date.now();}
  function scroll(){activity();const height=document.documentElement.scrollHeight-innerHeight;data.scrollDepth=Math.max(data.scrollDepth,height>0?Math.min(100,Math.round(scrollY/height*100)):100);dirty=true;}
  function click(e){activity();const el=e.target.closest('a,button');if(!el)return;
    if(el.matches('[data-gym-cta]'))return action('gym_form');
    const ids={notifFab:'notifications_open',notifActivar:'notifications_enable',notifDesactivar:'notifications_disable'};if(ids[el.id])return action(ids[el.id]);
    if(el.matches('.dep-tab')){const sport=el.id.replace('tab-','');return action('sport_'+sport);}
    if(el.hasAttribute('data-categoria'))return action('category');
    if(el.closest('#shop'))return action('shop');
    if(el.matches('[data-modo-partido]'))return action('match');
    if(el.matches('[data-postal-partido],[data-postal-partido-indice]'))return action('share');
    if(el.tagName==='A'){try{const u=new URL(el.href);if(u.protocol==='mailto:')action('email');else if(u.protocol==='tel:')action('phone');else if(/(^|\.)(wa.me|whatsapp.com)$/.test(u.hostname))action('whatsapp');else if(/(^|\.)instagram.com$/.test(u.hostname))action('instagram');else if(u.origin!==location.origin)action('external');else action('navigation');}catch{}}
  }
  const observer=new IntersectionObserver(entries=>{for(const e of entries){const key=e.target.id;if(e.isIntersecting&&data.sections[key]===0){data.sections[key]=1;dirty=true;}}},{threshold:0.1});
  SECTIONS.forEach(key=>{const el=document.getElementById(key);if(el)observer.observe(el);});
  const onVisibility=()=>{tick();if(!document.hidden)lastActivity=Date.now();save(true);};
  document.addEventListener('click',click);document.addEventListener('keydown',activity);window.addEventListener('scroll',scroll,{passive:true});document.addEventListener('visibilitychange',onVisibility);
  const clock=setInterval(tick,10000), timer=setInterval(save,60000);scroll();
  stop=()=>{enabled=false;clearInterval(clock);clearInterval(timer);observer.disconnect();document.removeEventListener('click',click);document.removeEventListener('keydown',activity);window.removeEventListener('scroll',scroll);document.removeEventListener('visibilitychange',onVisibility);stop=null;};
  await save();
 }catch{/* La medición nunca bloquea el sitio. */}finally{starting=false;}
}
if(consent==='yes')start();
