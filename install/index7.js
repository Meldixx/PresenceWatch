(()=>{
const V='1.6.0';
const MANIFEST='https://raw.githubusercontent.com/Meldixx/PresenceWatch/main/install/manifest.json';
const S=vendetta.plugin.storage;
const R=vendetta.metro.common.React;
const N=vendetta.metro.common.ReactNative;
const F=vendetta.metro.common.FluxDispatcher;
const C=vendetta.metro.common.clipboard;
const P=new Map(), PL=new Map(), REPEAT=new Map(), UNPATCH=[], PATCHED=new Set();
let patchTimer=null,pollTimer=null,maintenanceTimer=null,summaryTimer=null,storeUnsub=null,channelInnerUnpatch=null;

const COLORS=['#5865F2','#3BA55C','#F0B232','#ED4245','#EB459E','#9B59B6','#00A8FC','#747F8D'];
const ICONS=['👁','⭐','💙','🔥','🎮','🌙','🔔','👤','🦊','🌸','💎','⚡'];
const REPEATS=[0,5,10,30,60];
const COOLDOWNS=[0,15,30,60,120];
const SORTS=['custom','online','name','recent'];
const SORT_LABEL={custom:'Свой порядок',online:'Сначала онлайн',name:'По имени',recent:'По активности'};
const PRESETS=[
 {id:'online',name:'Только вход',prefs:{online:true,offline:false,status:false,muted:false}},
 {id:'all',name:'Все изменения',prefs:{online:true,offline:true,status:true,muted:false}},
 {id:'inout',name:'Вход + выход',prefs:{online:true,offline:true,status:false,muted:false}},
 {id:'quiet',name:'Тихий',prefs:{online:false,offline:false,status:false,muted:true}}
];
const DEF={online:'🟢 {name} появился в сети • {platform}',offline:'⚫ {name} вышел из сети • был онлайн {duration}',status:'🟡 {name}: {status} • {platform}'};
const CHANGELOGS={
 '1.6.0':['Полностью переделано ядро presence-мониторинга','Добавлен PresenceStore polling каждые 3 секунды','Dispatcher PRESENCE_UPDATE оставлен как быстрый путь','Safe Mode больше не может отключить ядро отслеживания','Исправлен fallback статуса при неполном PRESENCE_UPDATE','Расширена диагностика мониторинга и уведомлений'],
 '1.5.9':['Расширенная статистика, активности, Timeline, repeat','Поиск, сортировка, cooldown, тихие часы и сводка'],
 '1.5.8':['Совместимость старых PIN'],
 '1.5.7':['Системные Android-уведомления и диагностика'],
 '1.5.6':['Имя, группы, эмодзи, цвета и оформление'],
 '1.5.0':['PIN, Privacy, pinned, swipe, Safe mode'],
 '1.4.0':['Активности, Timeline, страницы пользователей и группы']
};

function init(){
 S.users=S.users&&typeof S.users==='object'?S.users:{};
 S.history=Array.isArray(S.history)?S.history:[];
 S.timeline=Array.isArray(S.timeline)?S.timeline:[];
 S.stats=S.stats&&typeof S.stats==='object'?S.stats:{};
 S.activities=S.activities&&typeof S.activities==='object'?S.activities:{};
 S.errors=Array.isArray(S.errors)?S.errors:[];
 S.groups=Array.isArray(S.groups)?S.groups:[];
 S.order=Array.isArray(S.order)?S.order:[];
 S.templates={...DEF,...(S.templates&&typeof S.templates==='object'?S.templates:{})};
 S.defaults={online:true,offline:false,status:false,...(S.defaults&&typeof S.defaults==='object'?S.defaults:{})};
 S.paused=!!S.paused;
 S.retentionDays=[7,30,90].includes(+S.retentionDays)?+S.retentionDays:30;
 S.sortMode=SORTS.includes(S.sortMode)?S.sortMode:'custom';
 S.security={enabled:false,pinHash:'',privacy:false,...(S.security&&typeof S.security==='object'?S.security:{})};
 S.safeMode={enabled:true,disabled:{},counts:{},...(S.safeMode&&typeof S.safeMode==='object'?S.safeMode:{})};
 S.safeMode.disabled=S.safeMode.disabled&&typeof S.safeMode.disabled==='object'?S.safeMode.disabled:{};
 S.safeMode.counts=S.safeMode.counts&&typeof S.safeMode.counts==='object'?S.safeMode.counts:{};
 for(const k of ['load','presence','poll','notifications','activities']){delete S.safeMode.disabled[k];delete S.safeMode.counts[k]}
 S.lastNotify=S.lastNotify&&typeof S.lastNotify==='object'?S.lastNotify:{};
 S.cooldownSec=COOLDOWNS.includes(+S.cooldownSec)?+S.cooldownSec:30;
 S.quiet={enabled:false,start:0,end:8,...(S.quiet&&typeof S.quiet==='object'?S.quiet:{})};
 S.dailySummary={enabled:false,hour:21,lastDate:'',...(S.dailySummary&&typeof S.dailySummary==='object'?S.dailySummary:{})};
 S.update={current:V,latest:V,available:false,checkedAt:0,...(S.update&&typeof S.update==='object'?S.update:{})};
 S.notifyDiag={lastAttempt:0,lastCall:0,lastError:'',backend:'Не проверено',...(S.notifyDiag&&typeof S.notifyDiag==='object'?S.notifyDiag:{})};
 S.diag={lastDispatcherAt:0,lastPollAt:0,lastChangeAt:0,lastChangeSource:'нет',pollCount:0,storeFound:false,...(S.diag&&typeof S.diag==='object'?S.diag:{})};
 S.unreadEvents=Math.max(0,+S.unreadEvents||0);
 S.seenVersion=String(S.seenVersion||'');
}
init();

const valid=id=>/^\d{15,22}$/.test(String(id||''));
const tracked=()=>Object.keys(S.users||{}).filter(valid);
const has=id=>!!S.users?.[String(id)];
const ps=x=>{x=String(x??'offline').toLowerCase();return ['online','idle','dnd'].includes(x)?x:'offline'};
const sl=x=>x==='online'?'В сети':x==='idle'?'Неактивен':x==='dnd'?'Не беспокоить':'Не в сети';
const dot=x=>x==='online'?'🟢':x==='idle'?'🌙':x==='dnd'?'⛔':'⚫';
const dur=ms=>{let s=Math.max(0,Math.floor((+ms||0)/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d?`${d}д ${h}ч`:h?`${h}ч ${m}м`:m?`${m}м ${s%60}с`:`${s%60}с`};
const ago=t=>{if(!t)return'нет';let d=Date.now()-t;return d<30000?'только что':d<3600000?`${Math.max(1,Math.floor(d/60000))} мин назад`:d<86400000?`${Math.floor(d/3600000)} ч назад`:new Date(t).toLocaleString()};
const toast=x=>{try{vendetta.ui.toasts.showToast(String(x))}catch{}};
const pstore=()=>{try{return vendetta.metro.findByStoreName('PresenceStore')}catch{return null}};
const ustore=()=>{try{return vendetta.metro.findByStoreName('UserStore')}catch{return null}};
const user=id=>{try{return ustore()?.getUser?.(String(id))}catch{return null}};
const uname=id=>{let u=user(id);return u?.globalName||u?.username||String(id)};
const alias=id=>S.users?.[String(id)]?.alias||'';
const displayName=id=>alias(id)||uname(id);
function status(id){try{const st=pstore();return ps(st?.getStatus?.(String(id))??st?.getPresence?.(String(id))?.status)}catch{return'offline'}}
function activities(id){try{const st=pstore();let a=st?.getActivities?.(String(id))??st?.getPresence?.(String(id))?.activities;return Array.isArray(a)?a:[]}catch{return[]}}
const avatar=id=>{let u=user(id);try{return u?.getAvatarURL?.(null,128,true)||u?.getAvatarURL?.()||null}catch{return null}};
function platform(id,p){
 const parse=o=>{if(!o||typeof o!=='object')return'';return Object.entries(o).filter(([,v])=>ps(v)!=='offline').map(([k])=>k==='mobile'?'Mobile':k==='desktop'?'Desktop':k==='web'?'Web':k).join(' + ')};
 let r=parse(p?.clientStatus??p?.client_status??p?.presence?.clientStatus??p?.presence?.client_status);if(r)return r;
 try{let st=pstore();r=parse(st?.getClientStatus?.(String(id))??st?.getPresence?.(String(id))?.clientStatus);if(r)return r}catch{}
 return PL.get(String(id))||'Неизвестно';
}

function logError(where,e){try{S.errors=[{at:Date.now(),where:String(where),message:String(e?.message||e),stack:String(e?.stack||'').slice(0,1200)},...(Array.isArray(S.errors)?S.errors:[])].slice(0,100)}catch{}}
const CORE=new Set(['load','presence','poll','notifications','activities']);
function safe(name,fn,fallback=null){
 if(!CORE.has(name)&&S.safeMode?.enabled&&S.safeMode?.disabled?.[name])return fallback;
 try{return fn()}catch(e){
  logError(name,e);
  if(!CORE.has(name))try{let c=(+S.safeMode.counts[name]||0)+1;let disabled=S.safeMode.disabled||{};if(c>=3&&S.safeMode.enabled)disabled={...disabled,[name]:true};S.safeMode={...S.safeMode,counts:{...S.safeMode.counts,[name]:c},disabled};if(c===3&&S.safeMode.enabled)toast(`PresenceWatch Safe mode: ${name} отключён`)}catch{}
  return fallback;
 }
}

function discordPush(){try{return vendetta.metro.findByProps?.('presentLocalNotification','openNotificationSettings')||vendetta.metro.findByProps?.('presentLocalNotification','clearAllNotifications')}catch{return null}}
function notificationBackend(){
 let a=discordPush();
 if(a?.presentLocalNotification)return['Discord PushNotification',body=>a.presentLocalNotification({alertBody:String(body),userInfo:{type:'PRESENCEWATCH'}})];
 let m=N?.NativeModules?.PushNotificationAndroid;
 if(m?.presentLocalNotification)return['PushNotificationAndroid',body=>m.presentLocalNotification({alertBody:String(body),userInfo:{type:'PRESENCEWATCH'}})];
 if(m?.localNotification)return['PushNotificationAndroid.localNotification',body=>m.localNotification({title:'PresenceWatch',message:String(body),bigText:String(body),playSound:true,soundName:'default',priority:'high',importance:'high'})];
 return null;
}
function notify(body){
 S.notifyDiag={...S.notifyDiag,lastAttempt:Date.now(),lastError:''};
 return safe('notifications',()=>{
  const b=notificationBackend();
  if(!b){S.notifyDiag={...S.notifyDiag,backend:'Недоступен',lastError:'Не найден системный модуль'};toast('PresenceWatch: '+body);return false}
  b[1](body);S.notifyDiag={...S.notifyDiag,backend:b[0],lastCall:Date.now(),lastError:''};return true;
 },false);
}
function openNotificationSettings(){try{let a=discordPush();if(a?.openNotificationSettings)return a.openNotificationSettings();return N?.Linking?.openSettings?.()}catch(e){logError('notification-settings',e)}}

function hash(pin){let s='PW:'+String(pin||''),h=2166136261;for(let c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
function legacyHash(pin){let s=`PresenceWatch:${String(pin||'')}:Meldix`,h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
function verifyPin(pin){let cur=String(S.security?.pinHash||''),next=hash(pin);if(cur===next)return true;if(cur===legacyHash(pin)){S.security={...S.security,pinHash:next};toast('PIN обновлён до нового формата');return true}return false}

const blankStat=()=>({totalMs:0,lastSessionMs:0,sessionStarted:0,lastSeen:0,lastStatusAt:0,eventCount:0});
const stat=id=>S.stats?.[String(id)]||blankStat();
function ensureStat(id){id=String(id);if(!S.stats[id])S.stats={...S.stats,[id]:blankStat()};return S.stats[id]}
function setStat(id,x){S.stats={...S.stats,[String(id)]:x}}
function prefs(id){let x=S.users?.[String(id)]?.prefs||{};return{online:x.online??!!S.defaults.online,offline:x.offline??!!S.defaults.offline,status:x.status??!!S.defaults.status,muted:!!x.muted}}
function patchUser(id,p){id=String(id);if(S.users[id])S.users={...S.users,[id]:{...S.users[id],...p}}}
function setPrefs(id,p){patchUser(id,{prefs:{...prefs(id),...p}})}
function computeOrder(){let all=tracked(),seen=new Set(),out=[];for(const id of S.order||[])if(all.includes(id)&&!seen.has(id)){seen.add(id);out.push(id)}for(const id of all)if(!seen.has(id)){seen.add(id);out.push(id)}return out}
function syncOrder(){let out=computeOrder(),cur=Array.isArray(S.order)?S.order:[];if(cur.length!==out.length||cur.some((x,i)=>x!==out[i]))S.order=out;return out}
function moveOrder(id,dir){let a=computeOrder().slice(),i=a.indexOf(String(id)),j=i+(dir<0?-1:1);if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];S.order=a;S.sortMode='custom'}
function add(id,a=''){id=String(id||'').trim();if(!valid(id)){toast('Некорректный Discord ID');return false}S.users={...S.users,[id]:{favorite:false,pinned:false,group:'',color:COLORS[0],icon:ICONS[0],repeatMin:0,...(S.users[id]||{addedAt:Date.now()}),alias:a||S.users[id]?.alias||'',prefs:S.users[id]?.prefs||{...S.defaults,muted:false}}};syncOrder();P.set(id,status(id));PL.set(id,platform(id));ensureStat(id);toast(`${displayName(id)} добавлен`);return true}
function clearRepeat(id){let t=REPEAT.get(String(id));if(t)clearTimeout(t);REPEAT.delete(String(id))}
function remove(id){id=String(id);clearRepeat(id);let u={...S.users};delete u[id];S.users=u;S.order=(S.order||[]).filter(x=>x!==id);P.delete(id);PL.delete(id);toast(`${uname(id)} удалён`)}
function toggle(id){has(id)?remove(id):add(id)}

function inQuietHours(){if(!S.quiet.enabled)return false;let h=new Date().getHours(),a=Math.max(0,Math.min(23,+S.quiet.start||0)),b=Math.max(0,Math.min(23,+S.quiet.end||0));return a===b?false:a<b?(h>=a&&h<b):(h>=a||h<b)}
function canNotify(id,type){let p=prefs(id);if(S.paused||p.muted||!p[type]||inQuietHours())return false;let k=`${id}:${type}`,last=+S.lastNotify[k]||0,cd=Math.max(0,+S.cooldownSec||0)*1000;if(cd&&Date.now()-last<cd)return false;S.lastNotify={...S.lastNotify,[k]:Date.now()};return true}
function tpl(t,d){let v={name:d.name||d.id,id:d.id,status:sl(d.status),platform:d.platform||'Неизвестно',time:new Date(d.time||Date.now()).toLocaleTimeString(),duration:dur(d.duration)};return String(t||'').replace(/\{(name|id|status|platform|time|duration)\}/g,(_,k)=>v[k])}
function activityType(x){return +x===0?'Играет':+x===1?'Стримит':+x===2?'Слушает':+x===3?'Смотрит':+x===4?'Статус':'Активность'}
function normActs(a){return(Array.isArray(a)?a:[]).filter(x=>x&&x.name).map(x=>({key:String(x.id||`${x.type}:${x.name}:${x.details||''}`),name:String(x.name),type:+x.type||0,label:activityType(x.type),details:String(x.details||''),state:String(x.state||'')})).slice(0,12)}
function pushTimeline(e){S.timeline=[e,...S.timeline].slice(0,1500);S.unreadEvents=Math.min(999,S.unreadEvents+1)}
function syncActs(id,a,now=Date.now(),record=true){safe('activities',()=>{let next=normActs(a),prev=S.activities[id]?.items||[],pm=new Map(prev.map(x=>[x.key,x])),nm=new Map(next.map(x=>[x.key,x]));if(record){for(const x of next)if(!pm.has(x.key))pushTimeline({id,at:now,kind:'activity_start',activity:x});for(const x of prev)if(!nm.has(x.key))pushTimeline({id,at:now,kind:'activity_end',activity:x})}S.activities={...S.activities,[id]:{items:next,updatedAt:now}}})}
function scheduleRepeat(id){clearRepeat(id);let min=Math.max(0,+S.users?.[id]?.repeatMin||0);if(!min)return;REPEAT.set(id,setTimeout(()=>{REPEAT.delete(id);if(has(id)&&!S.paused&&status(id)!=='offline'&&!prefs(id).muted&&!inQuietHours())notify(`🔔 ${displayName(id)} всё ещё в сети • ${platform(id)}`)},min*60000))}

function processChange(id,n,source='poll',payload=null){
 id=String(id);if(!has(id))return;const now=Date.now(),o=P.has(id)?P.get(id):status(id),pl=platform(id,payload);
 P.set(id,n);PL.set(id,pl);if(o===n)return;
 S.diag={...S.diag,lastChangeAt:now,lastChangeSource:source};
 let x=ensureStat(id),sd=0;
 if(o==='offline'&&n!=='offline')x={...x,sessionStarted:now,lastStatusAt:now,eventCount:(x.eventCount||0)+1};
 else if(o!=='offline'&&n==='offline'){sd=Math.max(0,now-(x.sessionStarted||now));x={...x,totalMs:(x.totalMs||0)+sd,lastSessionMs:sd,sessionStarted:0,lastSeen:now,lastStatusAt:now,eventCount:(x.eventCount||0)+1};clearRepeat(id)}
 else x={...x,lastStatusAt:now,eventCount:(x.eventCount||0)+1};
 setStat(id,x);
 const nm=alias(id)||payload?.user?.globalName||payload?.user?.username||uname(id),entry={id,name:nm,at:now,from:o,to:n,platform:pl,kind:'status',source};
 S.history=[entry,...S.history].slice(0,1000);pushTimeline(entry);
 const ctx={id,name:nm,status:n,platform:pl,time:now,duration:sd};
 if(o==='offline'&&n!=='offline'){if(canNotify(id,'online'))notify(tpl(S.templates.online,ctx));scheduleRepeat(id)}
 else if(o!=='offline'&&n==='offline'){if(canNotify(id,'offline'))notify(tpl(S.templates.offline,ctx))}
 else if(o!=='offline'&&n!=='offline'&&canNotify(id,'status'))notify(tpl(S.templates.status,ctx));
}

function event(p){safe('presence',()=>{
 S.diag={...S.diag,lastDispatcherAt:Date.now()};
 let id=String(p?.user?.id??p?.userId??p?.user_id??p?.presence?.user?.id??p?.id??'');if(!has(id))return;
 let a=p?.activities??p?.presence?.activities;if(Array.isArray(a))syncActs(id,a,Date.now(),true);
 const raw=p?.status??p?.presence?.status??(p?.clientStatus&&Object.values(p.clientStatus)[0])??(p?.client_status&&Object.values(p.client_status)[0]);
 const n=raw==null?status(id):ps(raw);
 processChange(id,n,'dispatcher',p);
})}
function pollPresence(){safe('poll',()=>{
 const st=pstore();S.diag={...S.diag,lastPollAt:Date.now(),pollCount:(+S.diag.pollCount||0)+1,storeFound:!!st};if(!st)return;
 for(const id of tracked()){
  const n=status(id),a=activities(id);if(Array.isArray(a))syncActs(id,a,Date.now(),true);
  if(!P.has(id)){P.set(id,n);PL.set(id,platform(id));continue}
  if(P.get(id)!==n)processChange(id,n,'PresenceStore',null);
 }
})}
function prime(){syncOrder();const st=pstore();S.diag={...S.diag,storeFound:!!st};for(const id of tracked()){let s=status(id);P.set(id,s);PL.set(id,platform(id));let x=ensureStat(id);if(s!=='offline'&&!x.sessionStarted)setStat(id,{...x,sessionStarted:Date.now()});syncActs(id,activities(id),Date.now(),false)}}
function attachStore(){try{const st=pstore();if(!st)return;if(typeof st.addChangeListener==='function'){const cb=()=>pollPresence();st.addChangeListener(cb);storeUnsub=()=>{try{st.removeChangeListener?.(cb)}catch{}}}}catch(e){logError('store-listener',e)}}
function cleanup(){let cutoff=Date.now()-Math.max(1,+S.retentionDays||30)*86400000;S.history=S.history.filter(x=>+x.at>=cutoff).slice(0,1000);S.timeline=S.timeline.filter(x=>+x.at>=cutoff).slice(0,1500);S.errors=S.errors.slice(0,100)}
function summaryText(){let d=new Date();d.setHours(0,0,0,0);let e=S.history.filter(x=>x.at>=+d),joins=e.filter(x=>x.from==='offline'&&x.to!=='offline').length,on=tracked().filter(id=>status(id)!=='offline').length;return`📊 PresenceWatch за сегодня\nСобытий: ${e.length} • входов: ${joins} • сейчас онлайн: ${on}`}
function daily(force=false){if(!force&&!S.dailySummary.enabled)return;let now=new Date(),key=now.toDateString();if(!force&&(now.getHours()!==Math.max(0,Math.min(23,+S.dailySummary.hour||21))||S.dailySummary.lastDate===key))return;notify(summaryText());S.dailySummary={...S.dailySummary,lastDate:key}}
async function checkUpdate(silent=false){try{let r=await fetch(`${MANIFEST}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);let m=await r.json(),latest=String(m?.hash||'').replace(/^presencewatch-/,'')||V;S.update={current:V,latest,available:latest!==V,checkedAt:Date.now()};if(!silent)toast(latest===V?'Установлена актуальная версия':`Доступна версия ${latest}`)}catch(e){logError('update',e);if(!silent)toast('Не удалось проверить обновления')}}

function getProfileItems(ret){try{let items=ret?.props?.items;if(Array.isArray(items))return Array.isArray(items[0])?items[0]:items;items=ret?.props?.children?.props?.items;if(Array.isArray(items))return Array.isArray(items[0])?items[0]:items;let n=vendetta.utils.findInReactTree(ret,x=>Array.isArray(x?.props?.items));items=n?.props?.items;if(Array.isArray(items))return Array.isArray(items[0])?items[0]:items}catch(e){logError('profile-items',e)}return null}
function addProfileItem(items,id){if(!Array.isArray(items)||!valid(id))return false;if(items.some(x=>x?.id==='presencewatch-profile'||String(x?.label||'').includes('PresenceWatch')))return true;let item={id:'presencewatch-profile',label:'PresenceWatch',subLabel:has(id)?'Отслеживается':'Не отслеживается',action:()=>toggle(id)},di=items.findIndex(x=>x?.variant==='destructive'||x?.isDestructive);di>=0?items.splice(di,0,item):items.push(item);return true}
function patchProfile(name){if(PATCHED.has(name))return true;return safe('profile-menu',()=>{let mod=vendetta.metro.findByName(name,false);if(!mod?.default)return false;let un=vendetta.patcher.after('default',mod,(args,ret)=>{let p=args?.[0]||{},id=String(p?.user?.id??p?.userId??'');if(valid(id))addProfileItem(getProfileItems(ret),id)});UNPATCH.push(un);PATCHED.add(name);return true},false)}
function patchChannel(){let name='ChannelLongPressActionSheet';if(PATCHED.has(name))return true;return safe('channel-menu',()=>{let mod=vendetta.metro.findByName(name,false);if(!mod?.default)return false;let outer=vendetta.patcher.after('default',mod,(_,ret)=>{let ch=ret?.props?.channel;if(!ch?.isDM?.())return;let id=String(ch?.getRecipientId?.()??'');if(!valid(id))return;try{channelInnerUnpatch?.()}catch{}channelInnerUnpatch=vendetta.patcher.after('type',ret,(_,tree)=>{let groups=vendetta.utils.findInReactTree(tree,n=>Array.isArray(n)&&String(n?.[0]?.type?.name||'')==='ActionSheetRowGroup');if(!Array.isArray(groups)||!groups.length)return;for(let g of groups){let children=Array.isArray(g?.props?.children)?g.props.children:[];if(children.some(x=>x?.key==='presencewatch-channel'))return;if(children[0]?.type){let row=R.cloneElement(children[0],{key:'presencewatch-channel',label:'PresenceWatch',subLabel:has(id)?'Отслеживается':'Не отслеживается',onPress:()=>toggle(id)});g.props.children=[children[0],row,...children.slice(1)];break}}})});UNPATCH.push(outer);PATCHED.add(name);return true},false)}
function installPatches(){patchProfile('UserProfileOverflowMenu');patchProfile('BotUserProfileOverflowMenu');patchChannel()}
function startPatches(){installPatches();if(patchTimer)clearInterval(patchTimer);patchTimer=setInterval(installPatches,1500)}

function SwipeCard({children,id,disabled}){let A=N?.Animated,PR=N?.PanResponder;if(!A?.ValueXY||!PR?.create)return R.createElement(N.View,null,children);let pan=R.useRef(new A.ValueXY()).current,resp=R.useRef(null);if(!resp.current)resp.current=PR.create({onMoveShouldSetPanResponder:(_,g)=>!disabled&&Math.abs(g.dx)>20,onPanResponderMove:(_,g)=>pan.setValue({x:Math.max(-90,Math.min(90,g.dx)),y:0}),onPanResponderRelease:(_,g)=>{if(g.dx>70)patchUser(id,{pinned:!S.users[id]?.pinned});if(g.dx<-70)setPrefs(id,{muted:!prefs(id).muted});A.spring(pan,{toValue:{x:0,y:0},useNativeDriver:false}).start()},onPanResponderTerminate:()=>A.spring(pan,{toValue:{x:0,y:0},useNativeDriver:false}).start()});return R.createElement(A.View,{style:{transform:[{translateX:pan.x}]},...resp.current.panHandlers},children)}

function Settings(){
 try{vendetta.storage.useProxy(S)}catch(e){logError('useProxy',e)}
 const h=R.createElement;const[,force]=R.useState(0);const[input,setInput]=R.useState('');const[search,setSearch]=R.useState('');const[selected,setSelected]=R.useState(null);const[cfg,setCfg]=R.useState(null);const[groupInput,setGroupInput]=R.useState('');const[pin,setPin]=R.useState('');const[newPin,setNewPin]=R.useState('');const[unlocked,setUnlocked]=R.useState(!S.security.enabled);const[aliasValue,setAliasValue]=R.useState('');
 R.useEffect(()=>{S.unreadEvents=0;const tm=setInterval(()=>force(x=>x+1),1000);return()=>clearInterval(tm)},[]);
 const st={page:{padding:14,gap:12,paddingBottom:42},card:{backgroundColor:'#1d1f23',borderRadius:16,padding:14,gap:9},row:{flexDirection:'row',alignItems:'center',gap:8},grow:{flex:1},title:{color:'#fff',fontSize:22,fontWeight:'800'},head:{color:'#fff',fontSize:16,fontWeight:'800'},text:{color:'#e5e7eb',fontSize:14},muted:{color:'#8f96a3',fontSize:12,lineHeight:17},section:{color:'#8f96a3',fontSize:11,fontWeight:'800',textTransform:'uppercase'},input:{backgroundColor:'#111214',color:'#fff',borderRadius:10,padding:11},primary:{backgroundColor:'#5865F2',borderRadius:10,padding:10,alignItems:'center'},secondary:{backgroundColor:'#2a2d33',borderRadius:10,padding:9,alignItems:'center'},danger:{backgroundColor:'#4a292d',borderRadius:10,padding:9,alignItems:'center'},btn:{color:'#fff',fontWeight:'800'},chips:{flexDirection:'row',gap:6,flexWrap:'wrap'},chip:{backgroundColor:'#2a2d33',paddingHorizontal:8,paddingVertical:5,borderRadius:20},chipOn:{borderWidth:1,borderColor:'#5865F2'},statRow:{flexDirection:'row',gap:8,flexWrap:'wrap'},stat:{minWidth:'30%',backgroundColor:'#15171a',padding:9,borderRadius:10,gap:2},statL:{color:'#747f8d',fontSize:9,fontWeight:'800'},statV:{color:'#fff',fontSize:13,fontWeight:'700'}};
 if(S.security.enabled&&!unlocked)return h(N.View,{style:st.page},h(N.Text,{style:st.title},'🔒 PresenceWatch'),h(N.TextInput,{style:st.input,value:pin,onChangeText:setPin,secureTextEntry:true,keyboardType:'numeric',placeholder:'PIN',placeholderTextColor:'#666'}),h(N.Pressable,{style:st.primary,onPress:()=>verifyPin(pin)?setUnlocked(true):toast('Неверный PIN')},h(N.Text,{style:st.btn},'Разблокировать')));
 const masked=!!S.security.privacy,shown=id=>masked?`${displayName(id).slice(0,1)}••••`:displayName(id),groupName=id=>S.groups.find(g=>g.id===S.users[id]?.group)?.name||'Без группы';
 if(selected&&has(selected)){
  const id=selected,u=S.users[id],pf=prefs(id),s=status(id),x=stat(id),acts=S.activities[id]?.items||[],timeline=S.timeline.filter(e=>e.id===id).slice(0,40),cur=s!=='offline'&&x.sessionStarted?Date.now()-x.sessionStarted:0;
  return h(N.ScrollView,{contentContainerStyle:st.page,keyboardShouldPersistTaps:'handled'},
   h(N.Pressable,{style:st.secondary,onPress:()=>setSelected(null)},h(N.Text,{style:st.btn},'← Назад')),
   h(N.View,{style:[st.card,{borderLeftWidth:4,borderLeftColor:u.color||COLORS[0]}]},h(N.Text,{style:st.title},`${u.icon||'👁'} ${shown(id)}`),h(N.Text,{style:st.muted},`${dot(s)} ${sl(s)} • ${platform(id)}`),h(N.View,{style:st.statRow},h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'ТЕКУЩАЯ'),h(N.Text,{style:st.statV},s==='offline'?'—':dur(cur))),h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'ВСЕГО ONLINE'),h(N.Text,{style:st.statV},dur((x.totalMs||0)+cur))),h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'ПОСЛ. СЕССИЯ'),h(N.Text,{style:st.statV},dur(x.lastSessionMs||0))),h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'LAST SEEN'),h(N.Text,{style:st.statV},s==='offline'?ago(x.lastSeen):'Сейчас')),h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'СОБЫТИЙ'),h(N.Text,{style:st.statV},String(x.eventCount||0))))),
   h(N.View,{style:st.card},h(N.Text,{style:st.head},'Оформление и организация'),h(N.TextInput,{style:st.input,value:aliasValue,onChangeText:setAliasValue,placeholder:displayName(id),placeholderTextColor:'#666'}),h(N.Pressable,{style:st.primary,onPress:()=>{patchUser(id,{alias:aliasValue.trim()});toast('Имя сохранено')}},h(N.Text,{style:st.btn},'Сохранить имя')),h(N.Text,{style:st.section},'Группа'),h(N.View,{style:st.chips},h(N.Pressable,{style:[st.chip,!u.group&&st.chipOn],onPress:()=>patchUser(id,{group:''})},h(N.Text,{style:st.text},'Без группы')),...S.groups.map(g=>h(N.Pressable,{key:g.id,style:[st.chip,u.group===g.id&&st.chipOn],onPress:()=>patchUser(id,{group:g.id})},h(N.Text,{style:st.text},g.name)))),h(N.Text,{style:st.section},'Эмодзи / иконка'),h(N.View,{style:st.chips},...ICONS.map(ic=>h(N.Pressable,{key:ic,style:[st.chip,u.icon===ic&&st.chipOn],onPress:()=>patchUser(id,{icon:ic})},h(N.Text,{style:{fontSize:20}},ic)))),h(N.Text,{style:st.section},'Цвет'),h(N.View,{style:st.chips},...COLORS.map(c=>h(N.Pressable,{key:c,style:{width:38,height:38,borderRadius:19,backgroundColor:c,borderWidth:u.color===c?3:0,borderColor:'#fff'},onPress:()=>patchUser(id,{color:c})}))),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'📌 Закрепить'),h(N.Switch,{value:!!u.pinned,onValueChange:v=>patchUser(id,{pinned:v})})),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'⭐ Избранное'),h(N.Switch,{value:!!u.favorite,onValueChange:v=>patchUser(id,{favorite:v})}))),
   h(N.View,{style:st.card},h(N.Text,{style:st.head},'Уведомления'),h(N.View,{style:st.chips},...PRESETS.map(pr=>h(N.Pressable,{key:pr.id,style:st.chip,onPress:()=>{setPrefs(id,pr.prefs);toast('Пресет: '+pr.name)}},h(N.Text,{style:st.text},pr.name)))),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'Вход в сеть'),h(N.Switch,{value:pf.online,onValueChange:v=>setPrefs(id,{online:v})})),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'Выход из сети'),h(N.Switch,{value:pf.offline,onValueChange:v=>setPrefs(id,{offline:v})})),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'Смена статуса'),h(N.Switch,{value:pf.status,onValueChange:v=>setPrefs(id,{status:v})})),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'Mute'),h(N.Switch,{value:pf.muted,onValueChange:v=>setPrefs(id,{muted:v})})),h(N.Pressable,{style:st.secondary,onPress:()=>{let i=REPEATS.indexOf(+u.repeatMin||0);patchUser(id,{repeatMin:REPEATS[(i+1)%REPEATS.length]})}},h(N.Text,{style:st.btn},`Повторное уведомление: ${u.repeatMin?u.repeatMin+' мин':'выкл.'}`))),
   h(N.View,{style:st.card},h(N.Text,{style:st.head},'Активности'),...(acts.length?acts.map((a,i)=>h(N.View,{key:i,style:st.stat},h(N.Text,{style:st.statV},`${a.label||activityType(a.type)}: ${a.name}`),a.details?h(N.Text,{style:st.muted},a.details):null,a.state?h(N.Text,{style:st.muted},a.state):null)):[h(N.Text,{key:'none',style:st.muted},'Нет видимых активностей')])),
   h(N.View,{style:st.card},h(N.Text,{style:st.head},'Timeline'),...(timeline.length?timeline.map((e,i)=>h(N.View,{key:i,style:st.stat},h(N.Text,{style:st.statV},e.kind==='status'?`${sl(e.from)} → ${sl(e.to)}`:e.kind==='activity_start'?`▶ ${e.activity?.name||''}`:`■ ${e.activity?.name||''}`),h(N.Text,{style:st.muted},`${new Date(e.at).toLocaleString()}${e.source?' • '+e.source:''}`))):[h(N.Text,{key:'none',style:st.muted},'Пусто')]))
  );
 }
 let list=tracked(),q=search.trim().toLowerCase(),ord=computeOrder(),oi=new Map(ord.map((x,i)=>[x,i]));if(q)list=list.filter(id=>displayName(id).toLowerCase().includes(q)||uname(id).toLowerCase().includes(q)||id.includes(q)||groupName(id).toLowerCase().includes(q));list.sort((a,b)=>{let pa=!!S.users[a]?.pinned,pb=!!S.users[b]?.pinned;if(pa!==pb)return pb-pa;if(S.sortMode==='custom')return(oi.get(a)??9999)-(oi.get(b)??9999);if(S.sortMode==='name')return displayName(a).localeCompare(displayName(b));if(S.sortMode==='recent')return(stat(b).lastStatusAt||0)-(stat(a).lastStatusAt||0);return(status(a)==='offline')-(status(b)==='offline')});
 return h(N.ScrollView,{contentContainerStyle:st.page,keyboardShouldPersistTaps:'handled'},
  h(N.View,{style:st.card},h(N.View,{style:st.row},h(N.View,{style:st.grow},h(N.Text,{style:st.title},'PresenceWatch'),h(N.Text,{style:st.muted},`VERSION ${V} • ${S.paused?'⏸ Пауза':'● Активен'}`)),h(N.Switch,{value:!S.paused,onValueChange:v=>S.paused=!v})),S.seenVersion!==V?h(N.View,{style:{gap:5}},h(N.Text,{style:st.section},'Что нового'),...(CHANGELOGS[V]||[]).map((x,i)=>h(N.Text,{key:i,style:st.muted},`• ${x}`)),h(N.Pressable,{style:st.secondary,onPress:()=>S.seenVersion=V},h(N.Text,{style:st.btn},'Понятно'))):null),
  h(N.View,{style:st.card},h(N.Text,{style:st.head},'Мониторинг и уведомления'),h(N.Text,{style:st.text},`PresenceStore: ${S.diag.storeFound?'найден':'НЕ НАЙДЕН'} • Backend: ${notificationBackend()?.[0]||'не найден'}`),h(N.Text,{style:st.muted},`Dispatcher: ${ago(S.diag.lastDispatcherAt)} • Poll: ${ago(S.diag.lastPollAt)} • проверок: ${S.diag.pollCount||0}`),h(N.Text,{style:st.muted},`Последняя смена: ${ago(S.diag.lastChangeAt)} • источник: ${S.diag.lastChangeSource||'нет'} • вызов push: ${ago(S.notifyDiag.lastCall)}`),S.notifyDiag.lastError?h(N.Text,{style:{color:'#ed4245'}},S.notifyDiag.lastError):null,h(N.View,{style:st.row},h(N.Pressable,{style:[st.primary,st.grow],onPress:()=>notify('🔔 Тестовое системное уведомление PresenceWatch')},h(N.Text,{style:st.btn},'Тест уведомления')),h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>{pollPresence();let t=tracked().map(id=>`${displayName(id)}: ${sl(status(id))}`).join('\n');toast(t||'Watchlist пуст')}},h(N.Text,{style:st.btn},'Проверить статусы'))),h(N.Pressable,{style:st.secondary,onPress:openNotificationSettings},h(N.Text,{style:st.btn},'Настройки уведомлений Android'))),
  h(N.View,{style:st.card},h(N.Text,{style:st.head},'Watchlist'),h(N.TextInput,{style:st.input,value:input,onChangeText:setInput,keyboardType:'numeric',placeholder:'Discord ID',placeholderTextColor:'#666'}),h(N.Pressable,{style:st.primary,onPress:()=>{if(add(input))setInput('')}},h(N.Text,{style:st.btn},'＋ Добавить')),h(N.TextInput,{style:st.input,value:search,onChangeText:setSearch,placeholder:'Поиск по имени / ID / группе',placeholderTextColor:'#666'}),h(N.Pressable,{style:st.secondary,onPress:()=>{let i=SORTS.indexOf(S.sortMode);S.sortMode=SORTS[(i+1)%SORTS.length]}},h(N.Text,{style:st.btn},`Сортировка: ${SORT_LABEL[S.sortMode]}`)),h(N.Text,{style:st.muted},'Свайп вправо — закрепить • влево — mute')),
  ...list.map(id=>{const u=S.users[id],pf=prefs(id),open=cfg===id,s=status(id),x=stat(id);const card=h(N.View,{style:[st.card,{borderLeftWidth:4,borderLeftColor:u.color||COLORS[0]}]},h(N.View,{style:st.row},!masked&&avatar(id)?h(N.Image,{source:{uri:avatar(id)},style:{width:44,height:44,borderRadius:22}}):null,h(N.View,{style:st.grow},h(N.Text,{style:st.head},`${u.pinned?'📌 ':''}${u.favorite?'⭐ ':''}${u.icon||'👁'} ${shown(id)}`),h(N.Text,{style:st.muted},`${dot(s)} ${sl(s)} • ${groupName(id)}${pf.muted?' • 🔕':''}`))),h(N.View,{style:st.statRow},h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'ПОСЛЕДНИЙ РАЗ'),h(N.Text,{style:st.statV},s==='offline'?ago(x.lastSeen):'Сейчас')),h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'СОБЫТИЙ'),h(N.Text,{style:st.statV},String(x.eventCount||0)))),open?h(N.View,{style:{gap:8}},h(N.View,{style:st.row},h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>{moveOrder(id,-1);force(x=>x+1)}},h(N.Text,{style:st.btn},'↑ Выше')),h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>{moveOrder(id,1);force(x=>x+1)}},h(N.Text,{style:st.btn},'↓ Ниже'))),h(N.View,{style:st.row},h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>patchUser(id,{pinned:!u.pinned})},h(N.Text,{style:st.btn},u.pinned?'Открепить':'Закрепить')),h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>setPrefs(id,{muted:!pf.muted})},h(N.Text,{style:st.btn},pf.muted?'Unmute':'Mute')),h(N.Pressable,{style:[st.danger,st.grow],onPress:()=>remove(id)},h(N.Text,{style:st.btn},'Удалить')))):null,h(N.View,{style:st.row},h(N.Pressable,{style:[st.primary,st.grow],onPress:()=>{setAliasValue(alias(id)||uname(id));setSelected(id)}},h(N.Text,{style:st.btn},'Открыть')),h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>setCfg(open?null:id)},h(N.Text,{style:st.btn},'⚙'))));return h(SwipeCard,{key:id,id,disabled:open},card)}),
  h(N.View,{style:st.card},h(N.Text,{style:st.head},'Группы'),h(N.View,{style:st.row},h(N.TextInput,{style:[st.input,st.grow],value:groupInput,onChangeText:setGroupInput,placeholder:'Новая группа',placeholderTextColor:'#666'}),h(N.Pressable,{style:st.primary,onPress:()=>{let n=groupInput.trim();if(n){S.groups=[...S.groups,{id:'g'+Date.now(),name:n}].slice(0,30);setGroupInput('')}}},h(N.Text,{style:st.btn},'Добавить'))),...(S.groups.length?S.groups.map(g=>h(N.View,{key:g.id,style:st.row},h(N.Text,{style:[st.text,st.grow]},`${g.name} • ${tracked().filter(id=>S.users[id]?.group===g.id).length}`),h(N.Pressable,{style:st.danger,onPress:()=>{for(const id of tracked())if(S.users[id]?.group===g.id)patchUser(id,{group:''});S.groups=S.groups.filter(x=>x.id!==g.id)}},h(N.Text,{style:st.btn},'×')))):[h(N.Text,{key:'none',style:st.muted},'Групп пока нет')])),
  h(N.View,{style:st.card},h(N.Text,{style:st.head},'Глобальные уведомления'),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'По умолчанию: вход'),h(N.Switch,{value:!!S.defaults.online,onValueChange:v=>S.defaults={...S.defaults,online:v}})),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'По умолчанию: выход'),h(N.Switch,{value:!!S.defaults.offline,onValueChange:v=>S.defaults={...S.defaults,offline:v}})),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'По умолчанию: смена статуса'),h(N.Switch,{value:!!S.defaults.status,onValueChange:v=>S.defaults={...S.defaults,status:v}})),h(N.Pressable,{style:st.secondary,onPress:()=>{let i=COOLDOWNS.indexOf(+S.cooldownSec||0);S.cooldownSec=COOLDOWNS[(i+1)%COOLDOWNS.length]}},h(N.Text,{style:st.btn},`Cooldown: ${S.cooldownSec} сек`)),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'Тихие часы'),h(N.Switch,{value:!!S.quiet.enabled,onValueChange:v=>S.quiet={...S.quiet,enabled:v}})),h(N.View,{style:st.row},h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>S.quiet={...S.quiet,start:(+S.quiet.start+1)%24}},h(N.Text,{style:st.btn},`С: ${String(S.quiet.start).padStart(2,'0')}:00`)),h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>S.quiet={...S.quiet,end:(+S.quiet.end+1)%24}},h(N.Text,{style:st.btn},`До: ${String(S.quiet.end).padStart(2,'0')}:00`)))),
  h(N.View,{style:st.card},h(N.Text,{style:st.head},'Ежедневная сводка'),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'Включена'),h(N.Switch,{value:!!S.dailySummary.enabled,onValueChange:v=>S.dailySummary={...S.dailySummary,enabled:v}})),h(N.Pressable,{style:st.secondary,onPress:()=>S.dailySummary={...S.dailySummary,hour:(+S.dailySummary.hour+1)%24}},h(N.Text,{style:st.btn},`Время: ${String(S.dailySummary.hour).padStart(2,'0')}:00`)),h(N.Pressable,{style:st.secondary,onPress:()=>daily(true)},h(N.Text,{style:st.btn},'Сводка сейчас'))),
  h(N.View,{style:st.card},h(N.Text,{style:st.head},'Безопасность'),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'Privacy'),h(N.Switch,{value:!!S.security.privacy,onValueChange:v=>S.security={...S.security,privacy:v}})),h(N.TextInput,{style:st.input,value:newPin,onChangeText:setNewPin,keyboardType:'numeric',secureTextEntry:true,placeholder:'Новый PIN 4–8 цифр',placeholderTextColor:'#666'}),h(N.Pressable,{style:st.secondary,onPress:()=>{if(/^\d{4,8}$/.test(newPin)){S.security={...S.security,enabled:true,pinHash:hash(newPin)};setNewPin('');setUnlocked(true);toast('PIN установлен')}else toast('PIN должен быть 4–8 цифр')}},h(N.Text,{style:st.btn},S.security.enabled?'Сменить PIN':'Установить PIN')),S.security.enabled?h(N.Pressable,{style:st.danger,onPress:()=>{S.security={...S.security,enabled:false,pinHash:''};setUnlocked(true);toast('PIN отключён')}},h(N.Text,{style:st.btn},'Отключить PIN')):null),
  h(N.View,{style:st.card},h(N.Text,{style:st.head},'Safe mode'),h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'Включён для UI-модулей'),h(N.Switch,{value:!!S.safeMode.enabled,onValueChange:v=>S.safeMode={...S.safeMode,enabled:v}})),h(N.Text,{style:st.muted},'Ядро presence/poll/notifications Safe Mode больше не отключает.'),h(N.Text,{style:st.muted},`Отключённые UI-модули: ${Object.keys(S.safeMode.disabled||{}).filter(k=>S.safeMode.disabled[k]).join(', ')||'нет'}`),h(N.Pressable,{style:st.secondary,onPress:()=>S.safeMode={enabled:S.safeMode.enabled,disabled:{},counts:{}}},h(N.Text,{style:st.btn},'Сбросить Safe mode'))),
  h(N.View,{style:st.card},h(N.Text,{style:st.head},'История / сервис'),h(N.Pressable,{style:st.secondary,onPress:()=>{S.retentionDays=S.retentionDays===7?30:S.retentionDays===30?90:7;cleanup()}},h(N.Text,{style:st.btn},`Хранить ${S.retentionDays} дней`)),h(N.Pressable,{style:st.secondary,onPress:()=>{C.setString(JSON.stringify(S.errors,null,2));toast('Лог скопирован')}},h(N.Text,{style:st.btn},`Ошибки: ${S.errors.length} • копировать`)),h(N.Pressable,{style:st.danger,onPress:()=>S.errors=[]},h(N.Text,{style:st.btn},'Очистить журнал ошибок'))),
  h(N.View,{style:st.card},h(N.Text,{style:st.head},'Обновления'),h(N.Text,{style:st.text},`Установлена: ${V}`),h(N.Text,{style:st.muted},`Последняя: ${S.update.latest||V}`),h(N.Pressable,{style:st.secondary,onPress:()=>checkUpdate(false)},h(N.Text,{style:st.btn},'Проверить обновления'))),
  h(N.View,{style:st.card},h(N.Text,{style:st.head},'Changelog'),...Object.entries(CHANGELOGS).map(([ver,items])=>h(N.View,{key:ver,style:{gap:3}},h(N.Text,{style:st.text},`v${ver}`),...items.map((x,i)=>h(N.Text,{key:i,style:st.muted},`• ${x}`)))))
 );
}

return{
 onLoad(){safe('load',()=>{cleanup();prime();try{F.subscribe('PRESENCE_UPDATE',event)}catch(e){logError('dispatcher-subscribe',e)}attachStore();pollPresence();pollTimer=setInterval(pollPresence,3000);startPatches();maintenanceTimer=setInterval(cleanup,3600000);summaryTimer=setInterval(()=>daily(false),60000);checkUpdate(true)})},
 onUnload(){try{F.unsubscribe('PRESENCE_UPDATE',event)}catch{};try{storeUnsub?.()}catch{};for(const t of [patchTimer,pollTimer,maintenanceTimer,summaryTimer])if(t)clearInterval(t);try{channelInnerUnpatch?.()}catch{};for(const id of [...REPEAT.keys()])clearRepeat(id);for(const u of UNPATCH.splice(0))try{u?.()}catch{};PATCHED.clear();P.clear();PL.clear()},
 settings:Settings
}
})()
