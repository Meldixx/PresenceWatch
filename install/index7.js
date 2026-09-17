(()=>{const V='1.5.7',S=vendetta.plugin.storage,R=vendetta.metro.common.React,N=vendetta.metro.common.ReactNative,F=vendetta.metro.common.FluxDispatcher,C=vendetta.metro.common.clipboard,P=new Map(),PL=new Map(),UN=[],PATCHED=new Set(),REP=new Map();let pt=null,ci=null,mt=null,st=null;
const COLORS=['#5865F2','#3BA55C','#F0B232','#ED4245','#EB459E','#9B59B6','#00A8FC','#747F8D'],ICONS=['👁','⭐','💙','🔥','🎮','🌙','🔔','👤','🦊','🌸','💎','⚡'],PRESETS=[['Только вход',{online:true,offline:false,status:false,muted:false}],['Все изменения',{online:true,offline:true,status:true,muted:false}],['Вход + выход',{online:true,offline:true,status:false,muted:false}],['Тихий',{online:false,offline:false,status:false,muted:true}]],DEF={online:'🟢 {name} появился в сети • {platform}',offline:'⚫ {name} вышел из сети • был онлайн {duration}',status:'🟡 {name}: {status} • {platform}'};
function init(){S.users=S.users&&typeof S.users==='object'?S.users:{};S.history=Array.isArray(S.history)?S.history:[];S.timeline=Array.isArray(S.timeline)?S.timeline:[];S.stats=S.stats&&typeof S.stats==='object'?S.stats:{};S.activities=S.activities&&typeof S.activities==='object'?S.activities:{};S.errors=Array.isArray(S.errors)?S.errors:[];S.groups=Array.isArray(S.groups)?S.groups:[];S.order=Array.isArray(S.order)?S.order:[];S.templates={...DEF,...(S.templates||{})};S.defaults={online:true,offline:false,status:false,...(S.defaults||{})};S.paused=!!S.paused;S.retentionDays=[7,30,90].includes(+S.retentionDays)?+S.retentionDays:30;S.security={enabled:false,pinHash:'',privacy:false,...(S.security||{})};S.safeMode={enabled:true,disabled:{},counts:{},...(S.safeMode||{})};S.safeMode.disabled=S.safeMode.disabled||{};S.safeMode.counts=S.safeMode.counts||{};S.lastNotify=S.lastNotify||{};S.cooldownSec=Number.isFinite(+S.cooldownSec)?+S.cooldownSec:30;S.quiet={enabled:false,start:0,end:8,...(S.quiet||{})};S.dailySummary={enabled:false,hour:21,lastDate:'',...(S.dailySummary||{})};S.update={current:V,latest:V,available:false,checkedAt:0,...(S.update||{})};S.notifyDiag={lastAttempt:0,lastSuccess:0,lastError:'',backend:'Не проверено',...(S.notifyDiag||{})};S.lastEventAt=+S.lastEventAt||0;S.unreadEvents=+S.unreadEvents||0;S.seenVersion=String(S.seenVersion||'')}init();
const valid=x=>/^\d{15,22}$/.test(String(x||'')),ids=()=>Object.keys(S.users).filter(valid),has=id=>!!S.users[String(id)],ps=x=>['online','idle','dnd'].includes(String(x||'').toLowerCase())?String(x).toLowerCase():'offline',sl=x=>x==='online'?'В сети':x==='idle'?'Неактивен':x==='dnd'?'Не беспокоить':'Не в сети',dot=x=>x==='online'?'🟢':x==='idle'?'🌙':x==='dnd'?'⛔':'⚫',dur=m=>{let s=Math.max(0,Math.floor((+m||0)/1000)),h=Math.floor(s/3600),n=Math.floor(s%3600/60);return h?`${h}ч ${n}м`:n?`${n}м`:`${s}с`},ago=t=>!t?'нет':Date.now()-t<60000?'только что':Date.now()-t<3600000?`${Math.floor((Date.now()-t)/60000)} мин назад`:new Date(t).toLocaleString(),toast=x=>{try{vendetta.ui.toasts.showToast(String(x))}catch{}},pstore=()=>{try{return vendetta.metro.findByStoreName('PresenceStore')}catch{return null}},ustore=()=>{try{return vendetta.metro.findByStoreName('UserStore')}catch{return null}},user=id=>{try{return ustore()?.getUser?.(id)}catch{return null}},uname=id=>user(id)?.globalName||user(id)?.username||id,alias=id=>S.users[id]?.alias||'',name=id=>alias(id)||uname(id),status=id=>{try{return ps(pstore()?.getStatus?.(id)??pstore()?.getPresence?.(id)?.status)}catch{return'offline'}},avatar=id=>{try{return user(id)?.getAvatarURL?.(null,128,true)||null}catch{return null}},platform=(id,e)=>{let c=e?.clientStatus??e?.client_status??pstore()?.getClientStatus?.(id)??pstore()?.getPresence?.(id)?.clientStatus;if(c&&typeof c==='object'){let a=Object.keys(c).filter(k=>ps(c[k])!=='offline').map(k=>k==='mobile'?'Mobile':k==='desktop'?'Desktop':k==='web'?'Web':k);if(a.length)return a.join(' + ')}return PL.get(id)||'Неизвестно'};
function err(w,e){try{S.errors=[{at:Date.now(),where:w,message:String(e?.message||e)},...S.errors].slice(0,100)}catch{}}function safe(w,f,z=null){if(S.safeMode.enabled&&S.safeMode.disabled[w])return z;try{return f()}catch(e){err(w,e);let c=(+S.safeMode.counts[w]||0)+1;S.safeMode={...S.safeMode,counts:{...S.safeMode.counts,[w]:c},disabled:c>=3&&S.safeMode.enabled?{...S.safeMode.disabled,[w]:true}:S.safeMode.disabled};return z}}
function push(){try{return vendetta.metro.findByProps?.('presentLocalNotification','openNotificationSettings')||vendetta.metro.findByProps?.('presentLocalNotification','clearAllNotifications')}catch{return null}}function backend(){let a=push();if(a?.presentLocalNotification)return['Discord PushNotification',b=>a.presentLocalNotification({alertBody:String(b)})];let m=N?.NativeModules?.PushNotificationAndroid;if(m?.presentLocalNotification)return['PushNotificationAndroid',b=>m.presentLocalNotification({alertBody:String(b)})];if(m?.localNotification)return['PushNotificationAndroid.localNotification',b=>m.localNotification({title:'PresenceWatch',message:String(b),bigText:String(b),playSound:true,soundName:'default',priority:'high',importance:'high'})];return null}function notify(x){S.notifyDiag={...S.notifyDiag,lastAttempt:Date.now(),lastError:''};try{let b=backend();if(!b){S.notifyDiag={...S.notifyDiag,backend:'Недоступен',lastError:'Не найден системный модуль'};toast('PresenceWatch: '+x);return false}b[1](x);S.notifyDiag={...S.notifyDiag,backend:b[0],lastSuccess:Date.now(),lastError:''};return true}catch(e){err('notifications',e);S.notifyDiag={...S.notifyDiag,lastError:String(e?.message||e)};toast('PresenceWatch: '+x);return false}}function notifSettings(){try{let a=push();if(a?.openNotificationSettings)return a.openNotificationSettings();return N?.Linking?.openSettings?.()}catch(e){err('notification-settings',e)}}
function hash(p){let s='PW:'+p,h=2166136261;for(let c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}const blank=()=>({totalMs:0,lastSessionMs:0,sessionStarted:0,lastSeen:0,lastStatusAt:0,eventCount:0}),stat=id=>S.stats[id]||blank(),ensure=id=>{if(!S.stats[id])S.stats={...S.stats,[id]:blank()};return S.stats[id]},setstat=(id,x)=>S.stats={...S.stats,[id]:x},prefs=id=>{let p=S.users[id]?.prefs||{};return{online:p.online??S.defaults.online,offline:p.offline??S.defaults.offline,status:p.status??S.defaults.status,muted:!!p.muted}},patch=(id,x)=>{if(S.users[id])S.users={...S.users,[id]:{...S.users[id],...x}}},setprefs=(id,x)=>patch(id,{prefs:{...prefs(id),...x}});
function order(){let all=ids(),seen=new Set(),o=[];for(let id of S.order)if(all.includes(id)&&!seen.has(id)){seen.add(id);o.push(id)}for(let id of all)if(!seen.has(id))o.push(id);return o}function sync(){let o=order();if(o.join('|')!==S.order.join('|'))S.order=o}function move(id,d){let a=order(),i=a.indexOf(id),j=i+d;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];S.order=a}function add(id){id=String(id||'').trim();if(!valid(id))return toast('Некорректный ID'),false;S.users={...S.users,[id]:{alias:'',group:'',color:COLORS[0],icon:ICONS[0],pinned:false,favorite:false,repeatMin:0,prefs:{...S.defaults,muted:false},addedAt:Date.now(),...(S.users[id]||{})}};sync();P.set(id,status(id));PL.set(id,platform(id));ensure(id);return true}function rem(id){let u={...S.users};delete u[id];S.users=u;S.order=S.order.filter(x=>x!==id);let t=REP.get(id);if(t)clearTimeout(t);REP.delete(id);P.delete(id)}
function quiet(){if(!S.quiet.enabled)return false;let h=new Date().getHours(),a=+S.quiet.start||0,b=+S.quiet.end||0;return a<b?h>=a&&h<b:h>=a||h<b}function can(id,k){let p=prefs(id);if(S.paused||p.muted||!p[k]||quiet())return false;let key=id+':'+k,last=+S.lastNotify[key]||0;if(Date.now()-last<(+S.cooldownSec||0)*1000)return false;S.lastNotify={...S.lastNotify,[key]:Date.now()};return true}function tmpl(t,d){return String(t||'').replace(/\{(name|id|status|platform|time|duration)\}/g,(_,k)=>({name:d.name,id:d.id,status:sl(d.status),platform:d.platform,time:new Date(d.time).toLocaleTimeString(),duration:dur(d.duration)})[k])}function repeat(id){let old=REP.get(id);if(old)clearTimeout(old);let m=+S.users[id]?.repeatMin||0;if(!m)return;REP.set(id,setTimeout(()=>{REP.delete(id);if(has(id)&&status(id)!=='offline'&&!prefs(id).muted&&!quiet())notify(`🔔 ${name(id)} всё ещё в сети • ${platform(id)}`)},m*60000))}
function acts(id,a,rec=true){let next=(Array.isArray(a)?a:[]).filter(x=>x?.name).map(x=>({key:String(x.id||x.type+':'+x.name),name:x.name,type:+x.type||0,details:x.details||''})).slice(0,12),prev=S.activities[id]?.items||[],pm=new Map(prev.map(x=>[x.key,x])),nm=new Map(next.map(x=>[x.key,x]));if(rec){for(let x of next)if(!pm.has(x.key))S.timeline=[{id,at:Date.now(),kind:'activity_start',activity:x},...S.timeline].slice(0,1500);for(let x of prev)if(!nm.has(x.key))S.timeline=[{id,at:Date.now(),kind:'activity_end',activity:x},...S.timeline].slice(0,1500)}S.activities={...S.activities,[id]:{items:next,updatedAt:Date.now()}}}
function event(e){safe('presence',()=>{let id=String(e?.user?.id??e?.userId??e?.user_id??e?.presence?.user?.id??e?.id??'');if(!has(id))return;S.lastEventAt=Date.now();if(S.paused)return;let a=e?.activities??e?.presence?.activities;if(Array.isArray(a))acts(id,a,true);let n=ps(e?.status??e?.presence?.status??Object.values(e?.clientStatus||e?.client_status||{})[0])||status(id),o=P.has(id)?P.get(id):status(id),pl=platform(id,e);P.set(id,n);PL.set(id,pl);if(o===n)return;let x=ensure(id),now=Date.now(),sd=0;if(o==='offline'&&n!=='offline')x={...x,sessionStarted:now,lastStatusAt:now,eventCount:x.eventCount+1};else if(o!=='offline'&&n==='offline'){sd=now-(x.sessionStarted||now);x={...x,totalMs:x.totalMs+sd,lastSessionMs:sd,sessionStarted:0,lastSeen:now,lastStatusAt:now,eventCount:x.eventCount+1}}else x={...x,lastStatusAt:now,eventCount:x.eventCount+1};setstat(id,x);let en={id,name:name(id),at:now,from:o,to:n,platform:pl,kind:'status'};S.history=[en,...S.history].slice(0,1000);S.timeline=[en,...S.timeline].slice(0,1500);let d={id,name:name(id),status:n,platform:pl,time:now,duration:sd};if(o==='offline'&&n!=='offline'){if(can(id,'online'))notify(tmpl(S.templates.online,d));repeat(id)}else if(o!=='offline'&&n==='offline'&&can(id,'offline'))notify(tmpl(S.templates.offline,d));else if(o!=='offline'&&n!=='offline'&&can(id,'status'))notify(tmpl(S.templates.status,d))})}
function prime(){sync();for(let id of ids()){let s=status(id);P.set(id,s);PL.set(id,platform(id));let x=ensure(id);if(s!=='offline'&&!x.sessionStarted)setstat(id,{...x,sessionStarted:Date.now()});let a=pstore()?.getActivities?.(id)??pstore()?.getPresence?.(id)?.activities;if(Array.isArray(a))acts(id,a,false)}}function clean(){let c=Date.now()-S.retentionDays*86400000;S.history=S.history.filter(x=>x.at>=c).slice(0,1000);S.timeline=S.timeline.filter(x=>x.at>=c).slice(0,1500);S.errors=S.errors.slice(0,100)}function summary(){let d=new Date();d.setHours(0,0,0,0);let h=S.history.filter(x=>x.at>=+d);return`📊 PresenceWatch за сегодня\nСобытий: ${h.length} • входов: ${h.filter(x=>x.from==='offline'&&x.to!=='offline').length} • сейчас онлайн: ${ids().filter(x=>status(x)!=='offline').length}`}
function items(ret){try{let i=ret?.props?.items??ret?.props?.children?.props?.items;if(Array.isArray(i))return Array.isArray(i[0])?i[0]:i;let n=vendetta.utils.findInReactTree(ret,x=>Array.isArray(x?.props?.items));i=n?.props?.items;return Array.isArray(i)?(Array.isArray(i[0])?i[0]:i):null}catch{return null}}function prof(namex){if(PATCHED.has(namex))return;let m=vendetta.metro.findByName(namex,false);if(!m?.default)return;UN.push(vendetta.patcher.after('default',m,(a,r)=>{let id=String(a?.[0]?.user?.id??a?.[0]?.userId??''),it=items(r);if(valid(id)&&it&&!it.some(x=>x?.id==='presencewatch-profile')){let z={id:'presencewatch-profile',label:'PresenceWatch',subLabel:has(id)?'Отслеживается':'Не отслеживается',action:()=>has(id)?rem(id):add(id)},d=it.findIndex(x=>x?.variant==='destructive');d>=0?it.splice(d,0,z):it.push(z)}}));PATCHED.add(namex)}function chan(){let n='ChannelLongPressActionSheet';if(PATCHED.has(n))return;let m=vendetta.metro.findByName(n,false);if(!m?.default)return;UN.push(vendetta.patcher.after('default',m,(_,r)=>{let ch=r?.props?.channel;if(!ch?.isDM?.())return;let id=String(ch.getRecipientId?.()||'');if(!valid(id))return;try{ci?.()}catch{}ci=vendetta.patcher.after('type',r,(_,tree)=>{let gs=vendetta.utils.findInReactTree(tree,x=>Array.isArray(x)&&String(x?.[0]?.type?.name||'')==='ActionSheetRowGroup');if(!Array.isArray(gs)||!gs.length)return;for(let g of gs){let c=Array.isArray(g?.props?.children)?g.props.children:[];if(c.some(x=>x?.key==='presencewatch-channel'))return;if(c[0]?.type){let row=R.cloneElement(c[0],{key:'presencewatch-channel',label:'PresenceWatch',subLabel:has(id)?'Отслеживается':'Не отслеживается',onPress:()=>has(id)?rem(id):add(id)});g.props.children=[c[0],row,...c.slice(1)];break}}})}));PATCHED.add(n)}function patches(){safe('menus',()=>{prof('UserProfileOverflowMenu');prof('BotUserProfileOverflowMenu');chan()})}
function Swipe({children,id,off}){let A=N?.Animated,Q=N?.PanResponder;if(!A?.ValueXY||!Q?.create)return R.createElement(N.View,null,children);let p=R.useRef(new A.ValueXY()).current,q=R.useRef(null);if(!q.current)q.current=Q.create({onMoveShouldSetPanResponder:(_,g)=>!off&&(Math.abs(g.dx)>20||Math.abs(g.dy)>20),onPanResponderMove:(_,g)=>p.setValue({x:Math.max(-90,Math.min(90,g.dx)),y:0}),onPanResponderRelease:(_,g)=>{if(g.dx>70)patch(id,{pinned:!S.users[id].pinned});if(g.dx<-70)setprefs(id,{muted:!prefs(id).muted});A.spring(p,{toValue:{x:0,y:0},useNativeDriver:false}).start()}});return R.createElement(A.View,{style:{transform:[{translateX:p.x}]},...q.current.panHandlers},children)}
function Settings(){
  try{vendetta.storage.useProxy(S)}catch{}
  const h=R.createElement;
  const[,force]=R.useState(0);
  const[input,setInput]=R.useState('');
  const[selected,setSelected]=R.useState(null);
  const[cfg,setCfg]=R.useState(null);
  const[groupInput,setGroupInput]=R.useState('');
  const[pin,setPin]=R.useState('');
  const[unlocked,setUnlocked]=R.useState(!S.security.enabled);
  const[aliasValue,setAliasValue]=R.useState('');
  R.useEffect(()=>{S.unreadEvents=0;const tm=setInterval(()=>force(x=>x+1),1000);return()=>clearInterval(tm)},[]);
  const st={page:{padding:14,gap:12,paddingBottom:40},card:{backgroundColor:'#1d1f23',borderRadius:16,padding:14,gap:9},row:{flexDirection:'row',alignItems:'center',gap:8},grow:{flex:1},title:{color:'#fff',fontSize:22,fontWeight:'800'},head:{color:'#fff',fontSize:16,fontWeight:'800'},text:{color:'#e5e7eb'},muted:{color:'#8f96a3',fontSize:12},input:{backgroundColor:'#111214',color:'#fff',borderRadius:10,padding:11},primary:{backgroundColor:'#5865F2',borderRadius:10,padding:10,alignItems:'center'},secondary:{backgroundColor:'#2a2d33',borderRadius:10,padding:9,alignItems:'center'},danger:{backgroundColor:'#4a292d',borderRadius:10,padding:9,alignItems:'center'},btn:{color:'#fff',fontWeight:'800'},chips:{flexDirection:'row',gap:6,flexWrap:'wrap'},chip:{backgroundColor:'#2a2d33',paddingHorizontal:8,paddingVertical:5,borderRadius:20}};
  if(S.security.enabled&&!unlocked){
    return h(N.View,{style:st.page},
      h(N.Text,{style:st.title},'🔒 PresenceWatch'),
      h(N.TextInput,{style:st.input,value:pin,onChangeText:setPin,secureTextEntry:true,keyboardType:'numeric',placeholder:'PIN',placeholderTextColor:'#666'}),
      h(N.Pressable,{style:st.primary,onPress:()=>hash(pin)===S.security.pinHash?setUnlocked(true):toast('Неверный PIN')},h(N.Text,{style:st.btn},'Разблокировать'))
    );
  }
  const masked=!!S.security.privacy;
  const shown=id=>masked?`${name(id).slice(0,1)}••••`:name(id);
  const groupName=id=>S.groups.find(g=>g.id===S.users[id]?.group)?.name||'Без группы';
  if(selected&&has(selected)){
    const id=selected,u=S.users[id],pf=prefs(id),timeline=S.timeline.filter(e=>e.id===id).slice(0,30);
    return h(N.ScrollView,{contentContainerStyle:st.page,keyboardShouldPersistTaps:'handled'},
      h(N.Pressable,{style:st.secondary,onPress:()=>setSelected(null)},h(N.Text,{style:st.btn},'← Назад')),
      h(N.View,{style:[st.card,{borderLeftWidth:4,borderLeftColor:u.color||COLORS[0]}]},
        h(N.Text,{style:st.title},`${u.icon||'👁'} ${shown(id)}`),
        h(N.Text,{style:st.muted},`${dot(status(id))} ${sl(status(id))} • ${platform(id)}`)
      ),
      h(N.View,{style:st.card},
        h(N.Text,{style:st.head},'Имя'),
        h(N.TextInput,{style:st.input,value:aliasValue,onChangeText:setAliasValue,placeholder:name(id),placeholderTextColor:'#666'}),
        h(N.Pressable,{style:st.primary,onPress:()=>{patch(id,{alias:aliasValue.trim()});toast('Имя сохранено')}},h(N.Text,{style:st.btn},'Сохранить имя')),
        h(N.Text,{style:st.head},'Группа'),
        h(N.View,{style:st.chips},
          h(N.Pressable,{style:st.chip,onPress:()=>patch(id,{group:''})},h(N.Text,{style:st.text},'Без группы')),
          ...S.groups.map(g=>h(N.Pressable,{key:g.id,style:st.chip,onPress:()=>patch(id,{group:g.id})},h(N.Text,{style:st.text},g.name)))
        ),
        h(N.Text,{style:st.head},'Эмодзи / иконка'),
        h(N.View,{style:st.chips},...ICONS.map(ic=>h(N.Pressable,{key:ic,style:st.chip,onPress:()=>patch(id,{icon:ic})},h(N.Text,{style:{fontSize:20}},ic)))),
        h(N.Text,{style:st.head},'Цвет'),
        h(N.View,{style:st.chips},...COLORS.map(c=>h(N.Pressable,{key:c,style:{width:38,height:38,borderRadius:19,backgroundColor:c,borderWidth:u.color===c?3:0,borderColor:'#fff'},onPress:()=>patch(id,{color:c})}))),
        h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'📌 Закрепить'),h(N.Switch,{value:!!u.pinned,onValueChange:v=>patch(id,{pinned:v})})),
        h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'⭐ Избранное'),h(N.Switch,{value:!!u.favorite,onValueChange:v=>patch(id,{favorite:v})}))
      ),
      h(N.View,{style:st.card},
        h(N.Text,{style:st.head},'Уведомления'),
        ...PRESETS.map(([n,p])=>h(N.Pressable,{key:n,style:st.secondary,onPress:()=>setprefs(id,p)},h(N.Text,{style:st.btn},n))),
        h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'Mute'),h(N.Switch,{value:pf.muted,onValueChange:v=>setprefs(id,{muted:v})}))
      ),
      h(N.View,{style:st.card},
        h(N.Text,{style:st.head},'Timeline'),
        ...(timeline.length?timeline.map((e,i)=>h(N.Text,{key:i,style:st.muted},`${new Date(e.at).toLocaleString()} • ${e.kind==='status'?`${sl(e.from)} → ${sl(e.to)}`:`${e.kind==='activity_start'?'▶':'■'} ${e.activity?.name||''}`}`)):[h(N.Text,{key:'none',style:st.muted},'Пусто')])
      )
    );
  }
  const ord=order();
  const list=ids().sort((a,b)=>(Number(!!S.users[b].pinned)-Number(!!S.users[a].pinned))+(ord.indexOf(a)-ord.indexOf(b))/10000);
  return h(N.ScrollView,{contentContainerStyle:st.page,keyboardShouldPersistTaps:'handled'},
    h(N.View,{style:st.card},
      h(N.View,{style:st.row},h(N.View,{style:st.grow},h(N.Text,{style:st.title},'PresenceWatch'),h(N.Text,{style:st.muted},`VERSION ${V} • ${S.paused?'⏸ Пауза':'● Активен'}`)),h(N.Switch,{value:!S.paused,onValueChange:v=>S.paused=!v}))
    ),
    h(N.View,{style:st.card},
      h(N.Text,{style:st.head},'Системные уведомления'),
      h(N.Text,{style:st.text},`Backend: ${backend()?.[0]||'не найден'}`),
      h(N.Text,{style:st.muted},`Последний PRESENCE_UPDATE: ${ago(S.lastEventAt)} • успешный push: ${ago(S.notifyDiag.lastSuccess)}`),
      S.notifyDiag.lastError?h(N.Text,{style:{color:'#ed4245'}},S.notifyDiag.lastError):null,
      h(N.View,{style:st.row},
        h(N.Pressable,{style:[st.primary,st.grow],onPress:()=>{notify('🔔 Тестовое уведомление PresenceWatch');force(x=>x+1)}},h(N.Text,{style:st.btn},'Тест уведомления')),
        h(N.Pressable,{style:[st.secondary,st.grow],onPress:notifSettings},h(N.Text,{style:st.btn},'Настройки Android'))
      )
    ),
    h(N.View,{style:st.card},
      h(N.TextInput,{style:st.input,value:input,onChangeText:setInput,keyboardType:'numeric',placeholder:'Discord ID',placeholderTextColor:'#666'}),
      h(N.Pressable,{style:st.primary,onPress:()=>{if(add(input))setInput('')}},h(N.Text,{style:st.btn},'＋ Добавить'))
    ),
    ...list.map(id=>{
      const u=S.users[id],pf=prefs(id),open=cfg===id;
      const card=h(N.View,{style:[st.card,{borderLeftWidth:4,borderLeftColor:u.color||COLORS[0]}]},
        h(N.View,{style:st.row},!masked&&avatar(id)?h(N.Image,{source:{uri:avatar(id)},style:{width:44,height:44,borderRadius:22}}):null,h(N.View,{style:st.grow},h(N.Text,{style:st.head},`${u.pinned?'📌 ':''}${u.icon||'👁'} ${shown(id)}`),h(N.Text,{style:st.muted},`${dot(status(id))} ${sl(status(id))} • ${groupName(id)}${pf.muted?' • 🔕':''}`))),
        open?h(N.View,{style:st.row},h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>{move(id,-1);force(x=>x+1)}},h(N.Text,{style:st.btn},'↑')),h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>{move(id,1);force(x=>x+1)}},h(N.Text,{style:st.btn},'↓')),h(N.Pressable,{style:[st.danger,st.grow],onPress:()=>rem(id)},h(N.Text,{style:st.btn},'Удалить'))):null,
        h(N.View,{style:st.row},h(N.Pressable,{style:[st.primary,st.grow],onPress:()=>{setAliasValue(alias(id)||uname(id));setSelected(id)}},h(N.Text,{style:st.btn},'Открыть')),h(N.Pressable,{style:[st.secondary,st.grow],onPress:()=>setCfg(open?null:id)},h(N.Text,{style:st.btn},'⚙')))
      );
      return h(Swipe,{key:id,id,off:open},card);
    }),
    h(N.View,{style:st.card},
      h(N.Text,{style:st.head},'Группы'),
      h(N.View,{style:st.row},h(N.TextInput,{style:[st.input,st.grow],value:groupInput,onChangeText:setGroupInput,placeholder:'Новая группа',placeholderTextColor:'#666'}),h(N.Pressable,{style:st.primary,onPress:()=>{let n=groupInput.trim();if(n){S.groups=[...S.groups,{id:'g'+Date.now(),name:n}];setGroupInput('')}}},h(N.Text,{style:st.btn},'Добавить'))),
      ...S.groups.map(g=>h(N.View,{key:g.id,style:st.row},h(N.Text,{style:[st.text,st.grow]},g.name),h(N.Pressable,{style:st.danger,onPress:()=>{for(let id of ids())if(S.users[id].group===g.id)patch(id,{group:''});S.groups=S.groups.filter(x=>x.id!==g.id)}},h(N.Text,{style:st.btn},'×'))))
    ),
    h(N.View,{style:st.card},
      h(N.Text,{style:st.head},'Безопасность'),
      h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow]},'Privacy'),h(N.Switch,{value:S.security.privacy,onValueChange:v=>S.security={...S.security,privacy:v}})),
      h(N.TextInput,{style:st.input,value:pin,onChangeText:setPin,keyboardType:'numeric',secureTextEntry:true,placeholder:'Новый PIN 4–8 цифр',placeholderTextColor:'#666'}),
      h(N.Pressable,{style:st.secondary,onPress:()=>{if(/^\d{4,8}$/.test(pin)){S.security={...S.security,enabled:true,pinHash:hash(pin)};setPin('');toast('PIN установлен')}}},h(N.Text,{style:st.btn},'Установить PIN'))
    ),
    h(N.View,{style:st.card},
      h(N.Text,{style:st.head},'История / сервис'),
      h(N.Pressable,{style:st.secondary,onPress:()=>notify(summary())},h(N.Text,{style:st.btn},'Сводка сейчас')),
      h(N.Pressable,{style:st.secondary,onPress:()=>{S.retentionDays=S.retentionDays===7?30:S.retentionDays===30?90:7;clean()}},h(N.Text,{style:st.btn},`Хранить ${S.retentionDays} дней`)),
      h(N.Pressable,{style:st.secondary,onPress:()=>{C.setString(JSON.stringify(S.errors,null,2));toast('Лог скопирован')}},h(N.Text,{style:st.btn},`Ошибки: ${S.errors.length} • копировать`)),
      h(N.Text,{style:st.muted},'v1.5.7: системные Android-уведомления через родной PushNotification Discord, тест и диагностика.')
    )
  );
}
return{
  onLoad(){
    safe('load',()=>{
      clean();
      prime();
      F.subscribe('PRESENCE_UPDATE',event);
      patches();
      pt=setInterval(patches,1500);
      mt=setInterval(clean,3600000);
      st=setInterval(()=>{
        if(S.dailySummary.enabled&&new Date().getHours()===S.dailySummary.hour){
          const k=new Date().toDateString();
          if(S.dailySummary.lastDate!==k){
            notify(summary());
            S.dailySummary={...S.dailySummary,lastDate:k};
          }
        }
      },60000);
    });
  },
  onUnload(){
    try{F.unsubscribe('PRESENCE_UPDATE',event)}catch{}
    for(const x of [pt,mt,st])if(x)clearInterval(x);
    try{ci?.()}catch{}
    for(const x of UN)try{x?.()}catch{}
    for(const x of REP.values())clearTimeout(x);
    PATCHED.clear();P.clear();PL.clear();
  },
  settings:Settings
}
})()
