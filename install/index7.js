(()=>{
const V='1.5.5';
const S=vendetta.plugin.storage;
const R=vendetta.metro.common.React;
const N=vendetta.metro.common.ReactNative;
const F=vendetta.metro.common.FluxDispatcher;
const C=vendetta.metro.common.clipboard;
const P=new Map(),PL=new Map(),UN=[],PATCHED=new Set(),REPEAT=new Map();
let patchTimer=null,channelInnerUnpatch=null,maintenanceTimer=null,summaryTimer=null,badgeUnpatch=null;

const DEF={online:'🟢 {name} появился в сети • {platform}',offline:'⚫ {name} вышел из сети • был онлайн {duration}',status:'🟡 {name}: {status} • {platform}'};
const CHANGELOGS={
'1.5.5':['Убран hotfix-loader и eval','Исправлен бесконечный React render','Storage больше не изменяется во время render','Прямой стабильный main-файл','Сохранены PIN, privacy, drag/swipe, pin, Safe mode и badge'],
'1.5.4':['Исправление кэшированного index7.js'],
'1.5.3':['Исправление ensureOrder'],
'1.5.1':['Безопасная инициализация новых модулей'],
'1.5.0':['PIN-защита','Скрытие чувствительных данных','Drag & drop порядок','Закрепление сверху','Свайпы по карточке','Badge непрочитанных','Safe mode','Changelog по версиям'],
'1.4.0':['Активности','Расширенный Timeline','Страница пользователя','Избранное, группы, цвет и иконка','Пресеты','Повторные уведомления','Дневная сводка','Автоочистка','Журнал ошибок','Проверка обновлений','Pause PresenceWatch']
};
const COLORS=['#5865F2','#3BA55C','#F0B232','#ED4245','#EB459E','#9B59B6','#00A8FC','#747F8D'];
const ICONS=['👁','⭐','💙','🔥','🎮','🌙','🔔','👤'];
const PRESETS=[
{name:'Только вход',prefs:{online:true,offline:false,status:false,muted:false}},
{name:'Все изменения',prefs:{online:true,offline:true,status:true,muted:false}},
{name:'Вход + выход',prefs:{online:true,offline:true,status:false,muted:false}},
{name:'Тихий',prefs:{online:false,offline:false,status:false,muted:true}}
];

function init(){
 S.users=S.users&&typeof S.users==='object'?S.users:{};
 S.history=Array.isArray(S.history)?S.history:[];
 S.timeline=Array.isArray(S.timeline)?S.timeline:[];
 S.stats=S.stats&&typeof S.stats==='object'?S.stats:{};
 S.activities=S.activities&&typeof S.activities==='object'?S.activities:{};
 S.errors=Array.isArray(S.errors)?S.errors:[];
 S.templates={...DEF,...(S.templates&&typeof S.templates==='object'?S.templates:{})};
 S.defaults={online:true,offline:false,status:false,...(S.defaults&&typeof S.defaults==='object'?S.defaults:{})};
 S.cooldownSec=Number.isFinite(+S.cooldownSec)?Math.max(0,+S.cooldownSec):30;
 S.quiet={enabled:false,start:0,end:8,...(S.quiet&&typeof S.quiet==='object'?S.quiet:{})};
 S.groups=Array.isArray(S.groups)?S.groups:[];
 S.order=Array.isArray(S.order)?S.order:[];
 S.sortMode=['custom','online','name','recent'].includes(S.sortMode)?S.sortMode:'custom';
 S.retentionDays=[7,30,90].includes(+S.retentionDays)?+S.retentionDays:30;
 S.paused=!!S.paused;
 S.lastNotify=S.lastNotify&&typeof S.lastNotify==='object'?S.lastNotify:{};
 S.dailySummary={enabled:false,hour:21,lastDate:'',...(S.dailySummary&&typeof S.dailySummary==='object'?S.dailySummary:{})};
 S.security={enabled:false,pinHash:'',privacy:false,...(S.security&&typeof S.security==='object'?S.security:{})};
 S.safeMode={enabled:true,disabled:{},counts:{},...(S.safeMode&&typeof S.safeMode==='object'?S.safeMode:{})};
 if(!S.safeMode.disabled||typeof S.safeMode.disabled!=='object')S.safeMode.disabled={};
 if(!S.safeMode.counts||typeof S.safeMode.counts!=='object')S.safeMode.counts={};
 S.unreadEvents=Math.max(0,+S.unreadEvents||0);
 S.lastEventAt=+S.lastEventAt||0;
 S.seenVersion=String(S.seenVersion||'');
 S.update={current:V,latest:V,available:false,checkedAt:0,...(S.update&&typeof S.update==='object'?S.update:{})};
}
init();

const valid=id=>/^\d{15,22}$/.test(String(id||''));
const tracked=()=>Object.keys(S.users||{}).filter(valid);
const has=id=>!!S.users?.[String(id)];
const ps=x=>{x=String(x??'offline').toLowerCase();return ['online','idle','dnd'].includes(x)?x:'offline'};
const sl=x=>x==='online'?'В сети':x==='idle'?'Неактивен':x==='dnd'?'Не беспокоить':'Не в сети';
const dot=x=>x==='online'?'🟢':x==='idle'?'🌙':x==='dnd'?'⛔':'⚫';
const dur=ms=>{let s=Math.max(0,Math.floor((+ms||0)/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d?`${d}д ${h}ч`:h?`${h}ч ${m}м`:m?`${m}м ${s%60}с`:`${s%60}с`};
const ago=t=>{if(!t)return'Нет данных';let d=Date.now()-t;return d<30000?'Только что':d<3600000?`${Math.max(1,Math.floor(d/60000))} мин назад`:d<86400000?`${Math.floor(d/3600000)} ч назад`:new Date(t).toLocaleString()};
const dayKey=t=>{let d=t instanceof Date?t:new Date(t||Date.now());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const pstore=()=>{try{return vendetta.metro.findByStoreName('PresenceStore')}catch{return null}};
const ustore=()=>{try{return vendetta.metro.findByStoreName('UserStore')}catch{return null}};
const user=id=>{try{return ustore()?.getUser?.(String(id))}catch{return null}};
const uname=id=>{let u=user(id);return u?.globalName||u?.username||String(id)};
const alias=id=>S.users?.[String(id)]?.alias||'';
const displayName=id=>alias(id)||uname(id);
const status=id=>{try{let s=pstore();return ps(s?.getStatus?.(String(id))??s?.getPresence?.(String(id))?.status)}catch{return'offline'}};
const plat=o=>{if(!o||typeof o!=='object')return'Неизвестно';let a=Object.entries(o).filter(([,v])=>ps(v)!=='offline').map(([k])=>k==='mobile'?'Mobile':k==='desktop'?'Desktop':k==='web'?'Web':k);return a.join(' + ')||'Неизвестно'};
function platform(id,p){let c=p?.clientStatus??p?.client_status??p?.presence?.clientStatus??p?.presence?.client_status,r=plat(c);if(r!=='Неизвестно')return r;try{let s=pstore(),q=plat(s?.getClientStatus?.(String(id))??s?.getPresence?.(String(id))?.clientStatus);return q!=='Неизвестно'?q:(PL.get(String(id))||'Неизвестно')}catch{return PL.get(String(id))||'Неизвестно'}}
function avatar(id){let u=user(id);try{return u?.getAvatarURL?.(null,128,true)||u?.getAvatarURL?.()||null}catch{return null}}
const toast=x=>{try{vendetta.ui.toasts.showToast(String(x))}catch{}};

function logError(where,e){try{S.errors=[{at:Date.now(),where:String(where),message:String(e?.message||e),stack:String(e?.stack||'').slice(0,1000)},...(Array.isArray(S.errors)?S.errors:[])].slice(0,100)}catch{}}
function safe(name,fn,fallback=null){
 if(S.safeMode?.enabled&&S.safeMode?.disabled?.[name])return fallback;
 try{return fn()}catch(e){
  logError(name,e);
  try{
   let c=(+S.safeMode.counts[name]||0)+1;
   S.safeMode={...S.safeMode,counts:{...S.safeMode.counts,[name]:c},disabled:c>=3&&S.safeMode.enabled?{...S.safeMode.disabled,[name]:true}:S.safeMode.disabled};
   if(c===3&&S.safeMode.enabled)toast(`PresenceWatch Safe mode: ${name} отключён`);
  }catch{}
  return fallback;
 }
}
function pinHash(pin){let s=`PresenceWatch:${String(pin||'')}:Meldix`,h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
const maskId=id=>{id=String(id||'');return id.length>8?`${id.slice(0,3)}••••••${id.slice(-3)}`:'••••••'};
const maskName=n=>{n=String(n||'');return n?`${n[0]}${'•'.repeat(Math.min(8,Math.max(3,n.length-1)))}`:'••••'};
function notify(x){safe('notifications',()=>{let m=N?.NativeModules?.PushNotificationAndroid;if(m?.presentLocalNotification)m.presentLocalNotification({alertTitle:'PresenceWatch',alertBody:x,message:x});else toast('PresenceWatch: '+x)})}
function tpl(t,d){let v={name:d.name||d.id,id:d.id,status:sl(d.status),platform:d.platform||'Неизвестно',time:new Date(d.time||Date.now()).toLocaleTimeString(),duration:dur(d.duration)};return String(t||'').replace(/\{(name|id|status|platform|time|duration)\}/g,(_,k)=>v[k])}

const blankStat=()=>({totalMs:0,lastSessionMs:0,sessionStarted:0,lastSeen:0,lastStatusAt:0,eventCount:0});
function stat(id){return S.stats?.[String(id)]||blankStat()}
function ensureStat(id){id=String(id);if(!S.stats[id])S.stats={...S.stats,[id]:blankStat()};return S.stats[id]}
function setStat(id,x){S.stats={...S.stats,[String(id)]:x}}
function prefs(id){let x=S.users?.[String(id)]?.prefs||{};return{online:x.online??!!S.defaults.online,offline:x.offline??!!S.defaults.offline,status:x.status??!!S.defaults.status,muted:!!x.muted}}
function patchUser(id,p){id=String(id);if(S.users[id])S.users={...S.users,[id]:{...S.users[id],...p}}}
function setPrefs(id,p){patchUser(id,{prefs:{...prefs(id),...p}})}

function computeOrder(){
 let ids=tracked(),seen=new Set(),out=[];
 for(const id of S.order||[])if(ids.includes(id)&&!seen.has(id)){seen.add(id);out.push(id)}
 for(const id of ids)if(!seen.has(id)){seen.add(id);out.push(id)}
 return out;
}
function syncOrder(){
 let out=computeOrder(),cur=Array.isArray(S.order)?S.order:[];
 if(cur.length!==out.length||cur.some((x,i)=>x!==out[i]))S.order=out;
 return out;
}
function moveOrder(id,dir){
 let a=computeOrder().slice(),i=a.indexOf(String(id)),j=i+(dir<0?-1:1);
 if(i<0||j<0||j>=a.length)return;
 [a[i],a[j]]=[a[j],a[i]];
 S.order=a;S.sortMode='custom';
}
function add(id,a=''){
 id=String(id||'').trim();
 if(!valid(id)){toast('Некорректный Discord ID');return false}
 S.users={...S.users,[id]:{favorite:false,pinned:false,group:'',color:COLORS[0],icon:ICONS[0],repeatMin:0,...(S.users[id]||{addedAt:Date.now()}),alias:a||S.users[id]?.alias||'',prefs:S.users[id]?.prefs||{...S.defaults,muted:false}}};
 syncOrder();P.set(id,status(id));PL.set(id,platform(id));ensureStat(id);
 toast(`${displayName(id)} добавлен`);
 return true;
}
function clearRepeat(id){let t=REPEAT.get(String(id));if(t)clearTimeout(t);REPEAT.delete(String(id))}
function remove(id){id=String(id);clearRepeat(id);let u={...S.users};delete u[id];S.users=u;S.order=(S.order||[]).filter(x=>x!==id);P.delete(id);PL.delete(id);toast(`${uname(id)} удалён`)}
function toggle(id){has(id)?remove(id):add(id)}

function inQuietHours(){if(!S.quiet.enabled)return false;let h=new Date().getHours(),a=Math.max(0,Math.min(23,+S.quiet.start||0)),b=Math.max(0,Math.min(23,+S.quiet.end||0));return a===b?false:a<b?(h>=a&&h<b):(h>=a||h<b)}
function canNotify(id,type){let p=prefs(id);if(S.paused||p.muted||!p[type]||inQuietHours())return false;let k=`${id}:${type}`,last=+S.lastNotify[k]||0,cd=Math.max(0,+S.cooldownSec||0)*1000;if(cd&&Date.now()-last<cd)return false;S.lastNotify={...S.lastNotify,[k]:Date.now()};return true}
function activityType(x){return+x===0?'Играет':+x===1?'Стримит':+x===2?'Слушает':+x===3?'Смотрит':+x===4?'Статус':'Активность'}
function normActs(a){return(Array.isArray(a)?a:[]).filter(x=>x&&x.name).map(x=>({key:String(x.id||`${x.type}:${x.name}:${x.details||''}`),name:String(x.name),type:+x.type||0,label:activityType(x.type),details:String(x.details||''),state:String(x.state||'')})).slice(0,12)}
function pushTimeline(e){S.timeline=[e,...S.timeline].slice(0,1500);S.unreadEvents=Math.min(999,S.unreadEvents+1)}
function syncActs(id,a,now=Date.now(),record=true){
 safe('activities',()=>{
  let next=normActs(a),prev=S.activities[id]?.items||[],pm=new Map(prev.map(x=>[x.key,x])),nm=new Map(next.map(x=>[x.key,x]));
  if(record){for(const x of next)if(!pm.has(x.key))pushTimeline({id,at:now,kind:'activity_start',activity:x});for(const x of prev)if(!nm.has(x.key))pushTimeline({id,at:now,kind:'activity_end',activity:x})}
  S.activities={...S.activities,[id]:{items:next,updatedAt:now}};
 })
}
function prime(){
 syncOrder();
 for(const id of tracked()){
  let s=status(id);P.set(id,s);PL.set(id,platform(id));let x=ensureStat(id);
  if(s!=='offline'&&!x.sessionStarted)setStat(id,{...x,sessionStarted:Date.now()});
  try{let a=pstore()?.getActivities?.(id)??pstore()?.getPresence?.(id)?.activities;if(Array.isArray(a))syncActs(id,a,Date.now(),false)}catch(e){logError('prime activities',e)}
 }
}
function scheduleRepeat(id){
 clearRepeat(id);let min=Math.max(0,+S.users?.[id]?.repeatMin||0);if(!min)return;
 REPEAT.set(id,setTimeout(()=>{REPEAT.delete(id);safe('repeat',()=>{if(has(id)&&!S.paused&&status(id)!=='offline'&&!prefs(id).muted&&!inQuietHours())notify(`🔔 ${displayName(id)} всё ещё в сети • ${platform(id)}`)})},min*60000));
}
function event(p){
 safe('presence',()=>{
  let id=String(p?.user?.id??p?.userId??p?.user_id??p?.presence?.user?.id??p?.id??'');
  if(!has(id)||S.paused)return;
  let now=Date.now(),a=p?.activities??p?.presence?.activities;if(Array.isArray(a))syncActs(id,a,now,true);
  let n=ps(p?.status??p?.presence?.status??Object.values(p?.clientStatus||p?.client_status||{})[0])||status(id);
  let o=P.has(id)?P.get(id):status(id),pl=platform(id,p);
  P.set(id,n);PL.set(id,pl);S.lastEventAt=now;if(o===n)return;
  let x=ensureStat(id),sd=0;
  if(o==='offline'&&n!=='offline')x={...x,sessionStarted:now,lastStatusAt:now,eventCount:(x.eventCount||0)+1};
  else if(o!=='offline'&&n==='offline'){sd=Math.max(0,now-(x.sessionStarted||now));x={...x,totalMs:(x.totalMs||0)+sd,lastSessionMs:sd,sessionStarted:0,lastSeen:now,lastStatusAt:now,eventCount:(x.eventCount||0)+1};clearRepeat(id)}
  else x={...x,lastStatusAt:now,eventCount:(x.eventCount||0)+1};
  setStat(id,x);
  let nm=alias(id)||p?.user?.globalName||p?.user?.username||uname(id),entry={id,name:nm,at:now,from:o,to:n,platform:pl};
  S.history=[entry,...S.history].slice(0,1000);pushTimeline({...entry,kind:'status'});
  let ctx={id,name:nm,status:n,platform:pl,time:now,duration:sd};
  if(o==='offline'&&n!=='offline'){if(canNotify(id,'online'))notify(tpl(S.templates.online,ctx));scheduleRepeat(id)}
  else if(o!=='offline'&&n==='offline'){if(canNotify(id,'offline'))notify(tpl(S.templates.offline,ctx))}
  else if(o!=='offline'&&n!=='offline'&&canNotify(id,'status'))notify(tpl(S.templates.status,ctx));
 })
}
function cleanupData(){safe('cleanup',()=>{let cut=Date.now()-Math.max(1,+S.retentionDays||30)*86400000;S.history=S.history.filter(x=>+x.at>=cut).slice(0,1000);S.timeline=S.timeline.filter(x=>+x.at>=cut).slice(0,1500);S.errors=S.errors.slice(0,100)})}
function summaryText(){let d=new Date();d.setHours(0,0,0,0);let ev=S.history.filter(e=>e.at>=+d),joins=ev.filter(e=>e.from==='offline'&&e.to!=='offline'),online=tracked().filter(id=>status(id)!=='offline').length;return`📊 PresenceWatch за сегодня\nСобытий: ${ev.length} • входов: ${joins.length} • сейчас онлайн: ${online}`}
function checkDailySummary(force=false){safe('summary',()=>{if(!force&&!S.dailySummary.enabled)return;let now=new Date(),key=dayKey(now);if(!force&&(now.getHours()!==Math.max(0,Math.min(23,+S.dailySummary.hour||21))||S.dailySummary.lastDate===key))return;notify(summaryText());S.dailySummary={...S.dailySummary,lastDate:key}})}
async function checkUpdate(silent=false){try{let r=await fetch(`https://raw.githubusercontent.com/Meldixx/PresenceWatch/main/install/manifest.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);let m=await r.json(),latest=String(m?.hash||'').replace(/^presencewatch-/,'')||V;S.update={current:V,latest,available:latest!==V,checkedAt:Date.now()};if(!silent)toast(latest===V?'Установлена актуальная версия':`Доступна версия ${latest}`)}catch(e){logError('update check',e);if(!silent)toast('Не удалось проверить обновления')}}

function getProfileItems(ret){
 try{
  let items=ret?.props?.items;if(Array.isArray(items))return Array.isArray(items[0])?items[0]:items;
  items=ret?.props?.children?.props?.items;if(Array.isArray(items))return Array.isArray(items[0])?items[0]:items;
  let node=vendetta.utils.findInReactTree(ret,n=>Array.isArray(n?.props?.items));items=node?.props?.items;if(Array.isArray(items))return Array.isArray(items[0])?items[0]:items;
 }catch{}
 return null;
}
function addProfileItem(items,id){
 if(!Array.isArray(items)||!valid(id))return false;
 if(items.some(x=>x?.id==='presencewatch-profile'||String(x?.label||'').includes('PresenceWatch')))return true;
 let item={id:'presencewatch-profile',label:'PresenceWatch',subLabel:has(id)?'Отслеживается':'Не отслеживается',action:()=>toggle(id)};
 let di=items.findIndex(x=>x?.variant==='destructive'||x?.isDestructive);di>=0?items.splice(di,0,item):items.push(item);return true;
}
function patchProfile(name){
 if(PATCHED.has(name))return true;
 try{
  let m=vendetta.metro.findByName(name,false);if(!m?.default)return false;
  let un=vendetta.patcher.after('default',m,(args,ret)=>{try{let p=args?.[0]||{},id=String(p?.user?.id??p?.userId??'');if(valid(id))addProfileItem(getProfileItems(ret),id)}catch{}});
  UN.push(un);PATCHED.add(name);return true;
 }catch(e){logError('profile patch',e);return false}
}
function findGroups(tree){try{return vendetta.utils.findInReactTree(tree,n=>Array.isArray(n)&&String(n?.[0]?.type?.name||'')==='ActionSheetRowGroup')}catch{return null}}
function rows(g){let c=g?.props?.children;return Array.isArray(c)?c:(c?[c]:[])}
function patchChannel(){
 const name='ChannelLongPressActionSheet';if(PATCHED.has(name))return true;
 try{
  let m=vendetta.metro.findByName(name,false);if(!m?.default)return false;
  let un=vendetta.patcher.after('default',m,(_,ret)=>{
   try{
    let ch=ret?.props?.channel;if(!ch?.isDM?.())return;let id=String(ch?.getRecipientId?.()||'');if(!valid(id))return;
    try{channelInnerUnpatch?.()}catch{}
    channelInnerUnpatch=vendetta.patcher.after('type',ret,(_,comp)=>{
     try{
      let gs=findGroups(comp);if(!Array.isArray(gs)||!gs.length)return;
      if(gs.some(g=>rows(g).some(x=>x?.key==='presencewatch-channel-row')))return;
      let gi=gs.findIndex(g=>g?.type&&rows(g).length);if(gi<0)return;
      let base=gs[gi],chd=rows(base),tplRow=chd[0];if(!tplRow?.type)return;
      let eye=null;for(const g of gs)for(const r of rows(g)){let l=String(r?.props?.label||'');if(/прочитан|read/i.test(l)){eye=r?.props?.icon;break}}
      let row=R.cloneElement(tplRow,{key:'presencewatch-channel-row',label:'PresenceWatch',subLabel:has(id)?'Отслеживается':'Не отслеживается',icon:eye??tplRow?.props?.icon,onPress:()=>toggle(id)});
      let next=[...chd];next.splice(Math.min(1,next.length),0,row);gs[gi]=R.cloneElement(base,{children:next});
     }catch{}
    });
   }catch{}
  });
  UN.push(un);PATCHED.add(name);return true;
 }catch(e){logError('channel patch',e);return false}
}
function startPatches(){
 const run=()=>{patchProfile('UserProfileOverflowMenu');patchProfile('BotUserProfileOverflowMenu');patchChannel()};
 run();patchTimer=setInterval(run,1500);
}
function patchBadge(){
 if(PATCHED.has('PresenceWatchBadge'))return;
 try{
  let m=vendetta.metro.findByName('PluginCard',false);if(!m?.default)return;
  badgeUnpatch=vendetta.patcher.after('default',m,(args,ret)=>{
   try{
    let plugin=args?.[0]?.item;if(plugin?.name!=='PresenceWatch'||!S.unreadEvents)return;
    let arr=vendetta.utils.findInReactTree(ret,n=>Array.isArray(n)&&n.some(x=>String(x?.type?.name||'')==='Title'));
    if(!Array.isArray(arr)||arr.some(x=>x?.key==='presencewatch-badge'))return;
    let i=arr.findIndex(x=>String(x?.type?.name||'')==='Title');if(i<0)return;
    arr.splice(i+1,0,R.createElement(N.View,{key:'presencewatch-badge',style:{backgroundColor:'#5865F2',borderRadius:999,minWidth:22,paddingHorizontal:6,paddingVertical:2,alignSelf:'center'}},R.createElement(N.Text,{style:{color:'#fff',fontSize:11,fontWeight:'800',textAlign:'center'}},String(Math.min(99,S.unreadEvents)))));
   }catch{}
  });
  PATCHED.add('PresenceWatchBadge');
 }catch{}
}

function SwipeCard({children,onMove,onSwipe,disabled}){
 const A=N?.Animated,PR=N?.PanResponder;
 const panRef=R.useRef(null),stepRef=R.useRef(0),moveRef=R.useRef(onMove),swipeRef=R.useRef(onSwipe),disabledRef=R.useRef(disabled),respRef=R.useRef(null);
 moveRef.current=onMove;swipeRef.current=onSwipe;disabledRef.current=disabled;
 if(!panRef.current&&A?.ValueXY)panRef.current=new A.ValueXY();
 if(!respRef.current&&PR?.create&&panRef.current){
  respRef.current=PR.create({
   onMoveShouldSetPanResponder:(_,g)=>!disabledRef.current&&(Math.abs(g.dx)>12||Math.abs(g.dy)>12),
   onPanResponderGrant:()=>{stepRef.current=0},
   onPanResponderMove:(_,g)=>{
    if(Math.abs(g.dx)>Math.abs(g.dy))panRef.current.setValue({x:Math.max(-90,Math.min(90,g.dx)),y:0});
    else{
     panRef.current.setValue({x:0,y:Math.max(-90,Math.min(90,g.dy))});
     let s=g.dy>65?1:g.dy<-65?-1:0;if(s&&s!==stepRef.current){moveRef.current?.(s);stepRef.current=s}
    }
   },
   onPanResponderRelease:(_,g)=>{if(Math.abs(g.dx)>70&&Math.abs(g.dx)>Math.abs(g.dy))swipeRef.current?.(g.dx>0?'pin':'mute');A.spring(panRef.current,{toValue:{x:0,y:0},useNativeDriver:false}).start();stepRef.current=0},
   onPanResponderTerminate:()=>{A.spring(panRef.current,{toValue:{x:0,y:0},useNativeDriver:false}).start();stepRef.current=0}
  });
 }
 if(!panRef.current||!respRef.current)return R.createElement(N.View,null,children);
 return R.createElement(A.View,{style:{transform:[{translateX:panRef.current.x},{translateY:panRef.current.y}]},...respRef.current.panHandlers},children);
}

function Settings(){
 try{vendetta.storage.useProxy(S)}catch(e){logError('useProxy',e)}
 const h=R.createElement;
 const[,tick]=R.useState(0),[input,setInput]=R.useState(''),[search,setSearch]=R.useState(''),[selected,setSelected]=R.useState(null),[cfg,setCfg]=R.useState(null),[del,setDel]=R.useState(null),[pin,setPin]=R.useState(''),[newPin,setNewPin]=R.useState(''),[unlocked,setUnlocked]=R.useState(!S.security.enabled),[reveal,setReveal]=R.useState(false),[groupInput,setGroupInput]=R.useState('');
 R.useEffect(()=>{S.unreadEvents=0;let t=setInterval(()=>tick(x=>x+1),1000);return()=>clearInterval(t)},[]);
 const st={page:{padding:14,gap:12,paddingBottom:42},hero:{backgroundColor:'#17181b',borderRadius:20,padding:18,gap:12,borderWidth:1,borderColor:'#2a2c31'},card:{backgroundColor:'#1d1f23',borderRadius:18,padding:16,gap:10,borderWidth:1,borderColor:'#2a2c31'},user:{backgroundColor:'#1d1f23',borderRadius:18,padding:15,gap:10,borderWidth:1,borderColor:'#2a2c31'},row:{flexDirection:'row',alignItems:'center',gap:10},grow:{flex:1},title:{color:'#fff',fontSize:23,fontWeight:'800'},head:{color:'#f4f5f6',fontSize:17,fontWeight:'800'},text:{color:'#e5e7eb',fontSize:14},hint:{color:'#8f96a3',fontSize:12,lineHeight:17},input:{backgroundColor:'#111214',color:'#fff',borderRadius:12,paddingHorizontal:13,paddingVertical:12,borderWidth:1,borderColor:'#303239'},primary:{backgroundColor:'#5865F2',borderRadius:12,paddingVertical:12,paddingHorizontal:14,alignItems:'center'},secondary:{backgroundColor:'#2a2d33',borderRadius:11,paddingVertical:10,paddingHorizontal:12,alignItems:'center'},danger:{backgroundColor:'#4a292d',borderRadius:11,paddingVertical:10,paddingHorizontal:12,alignItems:'center'},btn:{color:'#fff',fontWeight:'800',fontSize:13},avatar:{width:52,height:52,borderRadius:26,backgroundColor:'#303239'},buttons:{flexDirection:'row',gap:8},switch:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},chips:{flexDirection:'row',gap:7,flexWrap:'wrap'},chip:{backgroundColor:'#2a2d33',borderRadius:999,paddingHorizontal:9,paddingVertical:5},chipText:{color:'#cfd2d8',fontSize:11,fontWeight:'700'},section:{color:'#8f96a3',fontSize:11,fontWeight:'800',textTransform:'uppercase'},stats:{flexDirection:'row',gap:8},stat:{flex:1,backgroundColor:'#151619',borderRadius:12,padding:10,gap:3},statL:{color:'#767d89',fontSize:10,fontWeight:'700'},statV:{color:'#e8eaed',fontSize:12,fontWeight:'700'}};
 if(S.security.enabled&&!unlocked)return h(N.View,{style:[st.page,{flex:1,justifyContent:'center'}]},h(N.View,{style:st.hero},h(N.Text,{style:st.title},'🔒 PresenceWatch'),h(N.Text,{style:st.hint},'Введите PIN для доступа к настройкам.'),h(N.TextInput,{style:st.input,value:pin,onChangeText:setPin,keyboardType:'numeric',secureTextEntry:true,maxLength:8,placeholder:'PIN',placeholderTextColor:'#666'}),h(N.Pressable,{style:st.primary,onPress:()=>{if(pinHash(pin)===S.security.pinHash){setUnlocked(true);setPin('')}else toast('Неверный PIN')}},h(N.Text,{style:st.btn},'Разблокировать'))));
 const privacy=S.security.privacy&&!reveal,sn=id=>privacy?maskName(displayName(id)):displayName(id),sid=id=>privacy?maskId(id):id,sav=id=>privacy?null:avatar(id),groupName=id=>(S.groups||[]).find(g=>g.id===id)?.name||'Без группы';
 let ids=tracked(),q=search.toLowerCase().trim(),order=computeOrder(),oi=new Map(order.map((x,i)=>[x,i]));
 ids=ids.filter(id=>!q||displayName(id).toLowerCase().includes(q)||id.includes(q));
 ids.sort((a,b)=>{let pa=!!S.users[a]?.pinned,pb=!!S.users[b]?.pinned;if(pa!==pb)return pb-pa;if(S.sortMode==='custom')return(oi.get(a)??9999)-(oi.get(b)??9999);if(S.sortMode==='name')return displayName(a).localeCompare(displayName(b));if(S.sortMode==='recent')return(stat(b).lastStatusAt||0)-(stat(a).lastStatusAt||0);return(status(a)==='offline')-(status(b)==='offline')});
 if(selected&&has(selected)){
  let id=selected,s=status(id),x=stat(id),a=sav(id),acts=S.activities[id]?.items||[],tl=S.timeline.filter(e=>e.id===id).slice(0,50),pf=prefs(id);
  const activityChildren=acts.length
   ?acts.map((it,i)=>h(N.Text,{key:`a-${i}`,style:st.text},`${it.label}: ${it.name}${it.details?` • ${it.details}`:''}`))
   :[h(N.Text,{key:'e',style:st.hint},'Нет видимых активностей')];
  const timelineChildren=tl.length
   ?tl.map((e,i)=>h(N.View,{key:`t-${i}`,style:st.stat},
      h(N.Text,{style:st.statV},e.kind==='status'?`${sl(e.from)} → ${sl(e.to)}`:e.kind==='activity_start'?`▶ ${e.activity?.name}`:`■ ${e.activity?.name}`),
      h(N.Text,{style:st.hint},new Date(e.at).toLocaleString())
    ))
   :[h(N.Text,{key:'t-empty',style:st.hint},'Timeline пуст')];
  return h(N.ScrollView,{contentContainerStyle:st.page},
   h(N.Pressable,{style:st.secondary,onPress:()=>setSelected(null)},h(N.Text,{style:st.btn},'← Назад')),
   h(N.View,{style:st.hero},
    h(N.View,{style:st.row},
     a?h(N.Image,{source:{uri:a},style:st.avatar}):h(N.View,{style:st.avatar}),
     h(N.View,{style:st.grow},
      h(N.Text,{style:st.title},`${S.users[id]?.icon||'👁'} ${sn(id)}`),
      h(N.Text,{style:st.hint},sid(id)),
      h(N.Text,{style:st.text},`${dot(s)} ${sl(s)} • ${platform(id)}`)
     )
    ),
    h(N.View,{style:st.switch},h(N.Text,{style:st.text},'📌 Закрепить'),h(N.Switch,{value:!!S.users[id]?.pinned,onValueChange:v=>patchUser(id,{pinned:v})})),
    h(N.View,{style:st.switch},h(N.Text,{style:st.text},'⭐ Избранный'),h(N.Switch,{value:!!S.users[id]?.favorite,onValueChange:v=>patchUser(id,{favorite:v})}))
   ),
   h(N.View,{style:st.card},h(N.Text,{style:st.section},'Активности'),...activityChildren),
   h(N.View,{style:st.card},
    h(N.Text,{style:st.section},'Пресеты уведомлений'),
    ...PRESETS.map((p,i)=>h(N.Pressable,{key:`p-${i}`,style:st.secondary,onPress:()=>{setPrefs(id,p.prefs);tick(x=>x+1)}},h(N.Text,{style:st.btn},p.name))),
    h(N.View,{style:st.switch},h(N.Text,{style:st.text},'🔕 Без уведомлений'),h(N.Switch,{value:pf.muted,onValueChange:v=>setPrefs(id,{muted:v})})),
    h(N.Pressable,{style:st.secondary,onPress:()=>{
      let vals=[0,5,10,30,60],cur=+S.users[id]?.repeatMin||0,i=vals.indexOf(cur);
      patchUser(id,{repeatMin:vals[(i+1)%vals.length]});tick(x=>x+1);
    }},h(N.Text,{style:st.btn},`Повтор: ${+S.users[id]?.repeatMin?`${S.users[id].repeatMin} мин`:'выкл.'}`))
   ),
   h(N.View,{style:st.card},h(N.Text,{style:st.section},'Timeline'),...timelineChildren)
  );
 }
 const cards=ids.map(id=>{
  let s=status(id),x=stat(id),a=sav(id),pf=prefs(id),open=cfg===id,pinU=!!S.users[id]?.pinned,fav=!!S.users[id]?.favorite;
  let card=h(N.View,{style:[st.user,{borderLeftWidth:4,borderLeftColor:S.users[id]?.color||COLORS[0]}]},h(N.View,{style:st.row},a?h(N.Image,{source:{uri:a},style:st.avatar}):h(N.View,{style:st.avatar}),h(N.View,{style:st.grow},h(N.Text,{style:st.head},`${pinU?'📌 ':''}${fav?'⭐ ':''}${S.users[id]?.icon||'👁'} ${sn(id)}`),h(N.Text,{style:st.hint},sid(id)),h(N.View,{style:st.chips},h(N.View,{style:st.chip},h(N.Text,{style:st.chipText},`${dot(s)} ${sl(s)}`)),pf.muted?h(N.View,{style:st.chip},h(N.Text,{style:st.chipText},'🔕')):null))),h(N.View,{style:st.stats},h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'ПОСЛЕДНИЙ РАЗ'),h(N.Text,{style:st.statV},s==='offline'?ago(x.lastSeen):'Сейчас')),h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'СОБЫТИЙ'),h(N.Text,{style:st.statV},String(x.eventCount||0))),h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'ГРУППА'),h(N.Text,{style:st.statV},groupName(S.users[id]?.group)))),open?h(N.View,{style:{gap:8}},h(N.View,{style:st.switch},h(N.Text,{style:st.text},'📌 Закрепить'),h(N.Switch,{value:pinU,onValueChange:v=>{patchUser(id,{pinned:v});tick(x=>x+1)}})),h(N.View,{style:st.switch},h(N.Text,{style:st.text},'🔕 Mute'),h(N.Switch,{value:pf.muted,onValueChange:v=>{setPrefs(id,{muted:v});tick(x=>x+1)}})),h(N.View,{style:st.buttons},h(N.Pressable,{style:[st.secondary,{flex:1}],onPress:()=>{moveOrder(id,-1);tick(x=>x+1)}},h(N.Text,{style:st.btn},'↑ Выше')),h(N.Pressable,{style:[st.secondary,{flex:1}],onPress:()=>{moveOrder(id,1);tick(x=>x+1)}},h(N.Text,{style:st.btn},'↓ Ниже')))):null,h(N.View,{style:st.buttons},h(N.Pressable,{style:[st.primary,{flex:1}],onPress:()=>setSelected(id)},h(N.Text,{style:st.btn},'Открыть')),h(N.Pressable,{style:[st.secondary,{flex:1}],onPress:()=>setCfg(open?null:id)},h(N.Text,{style:st.btn},'⚙')),h(N.Pressable,{style:[st.danger,{flex:1}],onPress:()=>{if(del===id){remove(id);setDel(null)}else{setDel(id);setTimeout(()=>setDel(x=>x===id?null:x),4000)}}},h(N.Text,{style:st.btn},del===id?'Точно?':'Удалить'))));
  return h(SwipeCard,{key:id,disabled:open,onMove:d=>{moveOrder(id,d);tick(x=>x+1)},onSwipe:a=>{if(a==='pin')patchUser(id,{pinned:!pinU});else setPrefs(id,{muted:!pf.muted});tick(x=>x+1)}},card);
 });
 const cycleSort=()=>{let a=['custom','online','name','recent'],i=a.indexOf(S.sortMode);S.sortMode=a[(i+1)%a.length];tick(x=>x+1)};
 return h(N.ScrollView,{contentContainerStyle:st.page,keyboardShouldPersistTaps:'handled'},
  h(N.View,{style:st.hero},h(N.View,{style:st.row},h(N.View,{style:st.grow},h(N.Text,{style:st.title},'PresenceWatch'),h(N.Text,{style:st.hint},`VERSION ${V} • ${S.paused?'⏸ Пауза':'● Активен'}`)),h(N.Switch,{value:!S.paused,onValueChange:v=>{S.paused=!v;tick(x=>x+1)}})),h(N.Text,{style:st.hint},`Отслеживается: ${tracked().length} • онлайн: ${tracked().filter(id=>status(id)!=='offline').length} • непрочитано: ${S.unreadEvents}`),S.security.privacy?h(N.Pressable,{style:st.secondary,onPress:()=>setReveal(x=>!x)},h(N.Text,{style:st.btn},reveal?'Скрыть данные':'Показать данные')):null),
  S.seenVersion!==V?h(N.View,{style:st.card},h(N.Text,{style:st.section},'Что нового'),h(N.Text,{style:st.head},`PresenceWatch ${V}`),...(CHANGELOGS[V]||[]).map((x,i)=>h(N.Text,{key:i,style:st.text},`• ${x}`)),h(N.Pressable,{style:st.secondary,onPress:()=>{S.seenVersion=V;tick(x=>x+1)}},h(N.Text,{style:st.btn},'Понятно'))):null,
  h(N.View,{style:st.card},h(N.Text,{style:st.section},'Watchlist'),h(N.TextInput,{style:st.input,value:input,onChangeText:setInput,keyboardType:'numeric',placeholder:'Discord ID',placeholderTextColor:'#666'}),h(N.Pressable,{style:st.primary,onPress:()=>{if(add(input))setInput('')}},h(N.Text,{style:st.btn},'＋ Добавить')),h(N.TextInput,{style:st.input,value:search,onChangeText:setSearch,placeholder:'Поиск',placeholderTextColor:'#666'}),h(N.Pressable,{style:st.secondary,onPress:cycleSort},h(N.Text,{style:st.btn},`Сортировка: ${S.sortMode}`)),h(N.Text,{style:st.hint},'Drag вверх/вниз меняет порядок. Свайп вправо — закрепить, влево — mute.')),
  ...cards,
  h(N.View,{style:st.card},h(N.Text,{style:st.section},'Безопасность'),h(N.View,{style:st.switch},h(N.Text,{style:st.text},'Скрывать имена, ID и аватары'),h(N.Switch,{value:!!S.security.privacy,onValueChange:v=>{S.security={...S.security,privacy:v};setReveal(false)}})),h(N.TextInput,{style:st.input,value:newPin,onChangeText:setNewPin,keyboardType:'numeric',secureTextEntry:true,maxLength:8,placeholder:S.security.enabled?'Новый PIN (4–8 цифр)':'Создать PIN (4–8 цифр)',placeholderTextColor:'#666'}),h(N.View,{style:st.buttons},h(N.Pressable,{style:[st.primary,{flex:1}],onPress:()=>{if(!/^\d{4,8}$/.test(newPin)){toast('PIN должен быть 4–8 цифр');return}S.security={...S.security,enabled:true,pinHash:pinHash(newPin)};setNewPin('');toast('PIN установлен')}},h(N.Text,{style:st.btn},S.security.enabled?'Сменить PIN':'Включить PIN')),S.security.enabled?h(N.Pressable,{style:[st.danger,{flex:1}],onPress:()=>{S.security={...S.security,enabled:false,pinHash:''};setUnlocked(true);toast('PIN отключён')}},h(N.Text,{style:st.btn},'Отключить PIN')):null)),
  h(N.View,{style:st.card},h(N.Text,{style:st.section},'Safe mode'),h(N.View,{style:st.switch},h(N.Text,{style:st.text},'Автозащита модулей'),h(N.Switch,{value:!!S.safeMode.enabled,onValueChange:v=>S.safeMode={...S.safeMode,enabled:v}})),...Object.entries(S.safeMode.disabled||{}).filter(([,v])=>v).map(([k])=>h(N.Text,{key:k,style:st.hint},`⚠ Отключён: ${k}`)),h(N.Pressable,{style:st.secondary,onPress:()=>{S.safeMode={enabled:true,disabled:{},counts:{}};tick(x=>x+1)}},h(N.Text,{style:st.btn},'Сбросить Safe mode'))),
  h(N.View,{style:st.card},h(N.Text,{style:st.section},'Группы'),h(N.View,{style:st.buttons},h(N.TextInput,{style:[st.input,{flex:1}],value:groupInput,onChangeText:setGroupInput,placeholder:'Название группы',placeholderTextColor:'#666'}),h(N.Pressable,{style:st.primary,onPress:()=>{let name=groupInput.trim();if(!name)return;S.groups=[...S.groups,{id:`g${Date.now()}`,name}].slice(0,30);setGroupInput('')}},h(N.Text,{style:st.btn},'Добавить'))),...S.groups.map(g=>h(N.Text,{key:g.id,style:st.text},`• ${g.name}`))),
  h(N.View,{style:st.card},h(N.Text,{style:st.section},'История и сводка'),h(N.Pressable,{style:st.secondary,onPress:()=>{S.retentionDays=S.retentionDays===7?30:S.retentionDays===30?90:7;cleanupData();tick(x=>x+1)}},h(N.Text,{style:st.btn},`Хранить историю: ${S.retentionDays} дней`)),h(N.Pressable,{style:st.secondary,onPress:()=>checkDailySummary(true)},h(N.Text,{style:st.btn},'Сводка сейчас'))),
  h(N.View,{style:st.card},h(N.Text,{style:st.section},'Обновления'),h(N.Text,{style:st.text},`Установлена: ${V}`),h(N.Text,{style:st.hint},`Последняя: ${S.update?.latest||'не проверялась'}`),h(N.Pressable,{style:st.secondary,onPress:()=>checkUpdate(false)},h(N.Text,{style:st.btn},'Проверить обновления'))),
  h(N.View,{style:st.card},h(N.Text,{style:st.section},'Changelog'),...Object.entries(CHANGELOGS).map(([v,a])=>h(N.View,{key:v,style:{gap:3}},h(N.Text,{style:st.head},`v${v}`),...a.map((x,i)=>h(N.Text,{key:i,style:st.hint},`• ${x}`))))),
  h(N.View,{style:st.card},h(N.Text,{style:st.section},'Журнал ошибок'),...(S.errors.length?S.errors.slice(0,10).map((e,i)=>h(N.Text,{key:i,style:st.hint},`${new Date(e.at).toLocaleString()} • ${e.where}: ${e.message}`)):[h(N.Text,{key:'n',style:st.hint},'Ошибок нет')]),h(N.View,{style:st.buttons},h(N.Pressable,{style:[st.secondary,{flex:1}],onPress:()=>{C.setString(JSON.stringify(S.errors,null,2));toast('Лог скопирован')}},h(N.Text,{style:st.btn},'Скопировать')),h(N.Pressable,{style:[st.danger,{flex:1}],onPress:()=>{S.errors=[];tick(x=>x+1)}},h(N.Text,{style:st.btn},'Очистить'))))
 );
}

return{
 onLoad(){
  safe('onLoad',()=>{
   cleanupData();prime();F.subscribe('PRESENCE_UPDATE',event);startPatches();
   maintenanceTimer=setInterval(cleanupData,3600000);
   summaryTimer=setInterval(()=>checkDailySummary(false),60000);
   setTimeout(patchBadge,2500);
   checkUpdate(true);
  });
 },
 onUnload(){
  try{F.unsubscribe('PRESENCE_UPDATE',event)}catch{}
  if(patchTimer)clearInterval(patchTimer);if(maintenanceTimer)clearInterval(maintenanceTimer);if(summaryTimer)clearInterval(summaryTimer);
  try{channelInnerUnpatch?.()}catch{};try{badgeUnpatch?.()}catch{};
  for(const id of [...REPEAT.keys()])clearRepeat(id);
  for(const u of UN.splice(0))try{u?.()}catch{}
  PATCHED.clear();P.clear();PL.clear();
 },
 settings:Settings
}
})()
