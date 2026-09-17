(()=>{
const V='1.2.4';
const S=vendetta.plugin.storage;
const R=vendetta.metro.common.React;
const N=vendetta.metro.common.ReactNative;
const F=vendetta.metro.common.FluxDispatcher;
const C=vendetta.metro.common.clipboard;
const P=new Map();
const PL=new Map();
const UN=[];
const PATCHED=new Set();
let patchTimer=null;
let started=Date.now();

const DEF={
  online:'🟢 {name} появился в сети • {platform}',
  offline:'⚫ {name} вышел из сети • был онлайн {duration}',
  status:'🟡 {name}: {status} • {platform}'
};

S.users??={};
S.history??=[];
S.stats??={};
S.notifyOffline??=false;
S.notifyStatusChanges??=false;
S.templates={...DEF,...(S.templates||{})};
S.lastEventAt??=0;
S.debug??={};

const valid=id=>/^\d{15,22}$/.test(String(id||''));
const tracked=()=>Object.keys(S.users||{}).filter(valid);
const has=id=>!!S.users?.[String(id)];
const ps=x=>{x=String(x??'offline').toLowerCase();return ['online','idle','dnd'].includes(x)?x:'offline'};
const sl=x=>x==='online'?'В сети':x==='idle'?'Неактивен':x==='dnd'?'Не беспокоить':'Не в сети';
const dot=x=>x==='online'?'🟢':x==='idle'?'🌙':x==='dnd'?'⛔':'⚫';
const dur=ms=>{let s=Math.max(0,Math.floor((+ms||0)/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d?`${d}д ${h}ч`:h?`${h}ч ${m}м`:m?`${m}м ${s%60}с`:`${s%60}с`};
const ago=t=>{if(!t)return'Нет данных';let d=Date.now()-t;return d<30000?'Только что':d<3600000?`${Math.max(1,Math.floor(d/60000))} мин назад`:d<86400000?`${Math.floor(d/3600000)} ч назад`:new Date(t).toLocaleString()};
const pstore=()=>{try{return vendetta.metro.findByStoreName('PresenceStore')}catch{return null}};
const ustore=()=>{try{return vendetta.metro.findByStoreName('UserStore')}catch{return null}};
const cstore=()=>{try{return vendetta.metro.findByStoreName('ChannelStore')}catch{return null}};
const user=id=>{try{return ustore()?.getUser?.(String(id))}catch{return null}};
const uname=id=>{let u=user(id);return u?.globalName||u?.username||String(id)};
const alias=id=>S.users?.[String(id)]?.alias||'';
const displayName=id=>alias(id)||uname(id);
const status=id=>{try{let s=pstore();return ps(s?.getStatus?.(String(id))??s?.getPresence?.(String(id))?.status)}catch{return'offline'}};
const plat=o=>{if(!o||typeof o!=='object')return'Неизвестно';let a=Object.entries(o).filter(([,v])=>ps(v)!=='offline').map(([k])=>k==='mobile'?'Mobile':k==='desktop'?'Desktop':k==='web'?'Web':k);return a.join(' + ')||'Неизвестно'};
function platform(id,p){let c=p?.clientStatus??p?.client_status??p?.presence?.clientStatus??p?.presence?.client_status,r=plat(c);if(r!=='Неизвестно')return r;try{let s=pstore(),q=plat(s?.getClientStatus?.(String(id))??s?.getPresence?.(String(id))?.clientStatus);return q!=='Неизвестно'?q:(PL.get(String(id))||'Неизвестно')}catch{return PL.get(String(id))||'Неизвестно'}}
function avatar(id){let u=user(id);try{let x=u?.getAvatarURL?.(null,128,true)||u?.getAvatarURL?.();if(x)return x}catch{}return u?.avatar?`https://cdn.discordapp.com/avatars/${id}/${u.avatar}.png?size=128`:null}
const toast=x=>{try{vendetta.ui.toasts.showToast(String(x))}catch{}};
function notify(x){try{let n=N?.NativeModules?.PushNotificationAndroid;if(n?.presentLocalNotification){n.presentLocalNotification({alertTitle:'PresenceWatch',alertBody:x,message:x});return}}catch{}toast('PresenceWatch: '+x)}
function tpl(t,d){let v={name:d.name||d.id,id:d.id,status:sl(d.status),platform:d.platform||'Неизвестно',time:new Date(d.time||Date.now()).toLocaleTimeString(),duration:dur(d.duration)};return String(t||'').replace(/\{(name|id|status|platform|time|duration)\}/g,(_,k)=>v[k])}
function stat(id){id=String(id);let all={...S.stats},x=all[id]||{totalMs:0,lastSessionMs:0,sessionStarted:0,lastSeen:0,lastStatusAt:0};if(!all[id]){all[id]=x;S.stats=all}return x}
function setStat(id,x){S.stats={...S.stats,[String(id)]:x}}
function add(id,a=''){id=String(id||'').trim();if(!valid(id)){toast('Некорректный Discord ID');return false}S.users={...S.users,[id]:{...(S.users[id]||{addedAt:Date.now()}),alias:a||S.users[id]?.alias||''}};P.set(id,status(id));PL.set(id,platform(id));stat(id);toast(`${displayName(id)} добавлен в PresenceWatch`);return true}
function remove(id){id=String(id);let u={...S.users};delete u[id];S.users=u;P.delete(id);PL.delete(id);toast(`${uname(id)} удалён из PresenceWatch`)}
function toggle(id){has(id)?remove(id):add(id)}
function prime(){for(const id of tracked()){let s=status(id);P.set(id,s);PL.set(id,platform(id));let x=stat(id);if(s!=='offline'&&!x.sessionStarted)setStat(id,{...x,sessionStarted:Date.now()})}}
function event(p){let id=String(p?.user?.id??p?.userId??p?.user_id??p?.presence?.user?.id??p?.id??'');if(!has(id))return;let now=Date.now(),n=ps(p?.status??p?.presence?.status??(Object.values(p?.clientStatus||p?.client_status||{})[0]))||status(id),o=P.has(id)?P.get(id):status(id),pl=platform(id,p);P.set(id,n);PL.set(id,pl);S.lastEventAt=now;if(o===n)return;let x=stat(id),sd=0;if(o==='offline'&&n!=='offline')x={...x,sessionStarted:now,lastStatusAt:now};else if(o!=='offline'&&n==='offline'){sd=Math.max(0,now-(x.sessionStarted||now));x={...x,totalMs:(x.totalMs||0)+sd,lastSessionMs:sd,sessionStarted:0,lastSeen:now,lastStatusAt:now}}else x={...x,lastStatusAt:now};setStat(id,x);let nm=alias(id)||p?.user?.globalName||p?.user?.username||uname(id);S.history=[{id,name:nm,at:now,from:o,to:n,platform:pl},...(S.history||[])].slice(0,300);let c={id,name:nm,status:n,platform:pl,time:now,duration:sd};if(o==='offline'&&n!=='offline')notify(tpl(S.templates.online,c));else if(o!=='offline'&&n==='offline'&&S.notifyOffline)notify(tpl(S.templates.offline,c));else if(o!=='offline'&&n!=='offline'&&S.notifyStatusChanges)notify(tpl(S.templates.status,c))}

function getMainItems(ret){
  try{
    let items=ret?.props?.items;
    if(Array.isArray(items)&&Array.isArray(items[0]))return items[0];
    items=ret?.props?.children?.props?.items;
    if(Array.isArray(items)&&Array.isArray(items[0]))return items[0];
    const node=vendetta.utils.findInReactTree(ret,n=>Array.isArray(n?.props?.items)&&Array.isArray(n.props.items[0]));
    return node?.props?.items?.[0]??null;
  }catch{return null}
}
function getChannelRows(ret){
  try{
    const group=vendetta.utils.findInReactTree(ret,n=>Array.isArray(n)&&n.length>1&&String(n?.[0]?.type?.name||'')==='ActionSheetRowGroup');
    const rows=group?.[1]?.props?.children;
    if(Array.isArray(rows))return rows;
    const groupNode=vendetta.utils.findInReactTree(ret,n=>String(n?.type?.name||'')==='ActionSheetRowGroup'&&Array.isArray(n?.props?.children));
    return Array.isArray(groupNode?.props?.children)?groupNode.props.children:null;
  }catch{return null}
}
function profileIdFromProps(props){const id=props?.user?.id??props?.userId;return valid(id)?String(id):''}
function dmUserIdFromProps(props){
  try{
    let ch=props?.channel;
    if(!ch&&props?.channelId)ch=cstore()?.getChannel?.(String(props.channelId));
    let id=ch?.getRecipientId?.();
    if(!id&&Array.isArray(ch?.recipients)&&ch.recipients.length===1)id=ch.recipients[0];
    return valid(id)?String(id):'';
  }catch{return''}
}
function addMenuItem(items,id){
  if(!Array.isArray(items)||!valid(id))return false;
  if(items.some(x=>x?.__presencewatch||x?.id==='presencewatch-profile'||String(x?.label||'').includes('PresenceWatch')))return true;
  const item={__presencewatch:true,id:'presencewatch-profile',label:has(id)?'✓ Удалить из PresenceWatch':'👁 Добавить в PresenceWatch',action:()=>toggle(id)};
  let di=items.findIndex(x=>x?.variant==='destructive'||x?.isDestructive);
  di>=0?items.splice(di,0,item):items.push(item);
  return true;
}
function addChannelMenuItem(ret,id){
  const rows=getChannelRows(ret);
  if(!Array.isArray(rows)||!rows.length||!valid(id))return false;
  if(rows.some(x=>x?.key==='presencewatch-channel'||String(x?.props?.label||'').includes('PresenceWatch')))return true;
  const template=rows.find(x=>x?.type);
  if(!template?.type)return false;
  const row=R.createElement(template.type,{key:'presencewatch-channel',label:has(id)?'✓ Удалить из PresenceWatch':'👁 Добавить в PresenceWatch',onPress:()=>toggle(id)});
  rows.push(row);
  return true;
}
function patchNamed(name,kind){
  if(PATCHED.has(name))return true;
  let mod=null;
  try{mod=vendetta.metro.findByName(name,false)}catch{}
  if(!mod?.default)return false;
  try{
    const un=vendetta.patcher.after('default',mod,(args,ret)=>{
      try{
        const props=args?.[0]||{};
        const id=kind==='profile'?profileIdFromProps(props):dmUserIdFromProps(props);
        if(!id)return;
        const ok=kind==='channel'?addChannelMenuItem(ret,id):addMenuItem(getMainItems(ret),id);
        if(kind==='channel')S.debug.channelInjected=!!ok;
      }catch(e){S.debug.lastPatchError=String(e?.message||e)}
    });
    UN.push(un);PATCHED.add(name);S.debug.lastPatched=name;return true;
  }catch(e){S.debug.lastPatchError=String(e?.message||e);return false}
}
function tryInstallMenuPatches(){
  patchNamed('UserProfileOverflowMenu','profile');
  patchNamed('BotUserProfileOverflowMenu','profile');
  patchNamed('ChannelLongPressActionSheet','channel');
  S.debug.patched=[...PATCHED];
}
function startMenuPatches(){
  tryInstallMenuPatches();
  if(patchTimer)clearInterval(patchTimer);
  patchTimer=setInterval(tryInstallMenuPatches,1000);
}

function exp(){try{C.setString(JSON.stringify({app:'PresenceWatch',version:V,users:S.users,stats:S.stats,history:S.history,notifyOffline:S.notifyOffline,notifyStatusChanges:S.notifyStatusChanges,templates:S.templates},null,2));toast('Настройки скопированы')}catch{toast('Ошибка экспорта')}}
async function imp(){try{let d=JSON.parse(await Promise.resolve(C.getString()));if(d?.app!=='PresenceWatch'||typeof d.users!=='object')throw Error('неверный формат');let u={};for(const [id,x]of Object.entries(d.users))if(valid(id))u[id]={alias:typeof x?.alias==='string'?x.alias:'',addedAt:+x?.addedAt||Date.now()};S.users=u;S.stats=typeof d.stats==='object'&&d.stats?d.stats:S.stats;S.history=Array.isArray(d.history)?d.history.slice(0,300):S.history;S.notifyOffline=!!d.notifyOffline;S.notifyStatusChanges=!!d.notifyStatusChanges;S.templates={...DEF,...(d.templates||{})};prime();toast(`Импортировано: ${Object.keys(u).length}`)}catch(e){toast('Ошибка импорта: '+(e?.message||e))}}

function Settings(){
  try{vendetta.storage.useProxy(S)}catch{}
  const h=R.createElement;
  const[,tick]=R.useState(0);
  const[input,setInput]=R.useState('');
  const[editId,setEditId]=R.useState(null);
  const[editValue,setEditValue]=R.useState('');
  const[delId,setDelId]=R.useState(null);
  const[to,setTo]=R.useState(S.templates.online);
  const[tf,setTf]=R.useState(S.templates.offline);
  const[ts,setTs]=R.useState(S.templates.status);
  R.useEffect(()=>{let t=setInterval(()=>tick(x=>x+1),1000);return()=>clearInterval(t)},[]);
  const ids=tracked();
  const online=ids.filter(id=>status(id)!=='offline').length;
  const st={page:{padding:14,gap:12,paddingBottom:42},hero:{backgroundColor:'#17181b',borderRadius:20,padding:18,gap:12,borderWidth:1,borderColor:'#2a2c31'},card:{backgroundColor:'#1d1f23',borderRadius:18,padding:16,gap:11,borderWidth:1,borderColor:'#2a2c31'},user:{backgroundColor:'#1d1f23',borderRadius:18,padding:15,gap:11,borderWidth:1,borderColor:'#2a2c31'},row:{flexDirection:'row',alignItems:'center',gap:10},grow:{flex:1},title:{color:'#f7f8f9',fontSize:23,fontWeight:'800'},head:{color:'#f4f5f6',fontSize:17,fontWeight:'800'},text:{color:'#e5e7eb',fontSize:14},hint:{color:'#8f96a3',fontSize:12,lineHeight:17},muted:{color:'#777d87',fontSize:11},input:{backgroundColor:'#111214',color:'#fff',borderRadius:12,paddingHorizontal:13,paddingVertical:12,borderWidth:1,borderColor:'#303239'},inputMulti:{backgroundColor:'#111214',color:'#fff',borderRadius:12,paddingHorizontal:13,paddingVertical:12,borderWidth:1,borderColor:'#303239',minHeight:50,textAlignVertical:'top'},primary:{backgroundColor:'#5865F2',borderRadius:12,paddingVertical:12,paddingHorizontal:14,alignItems:'center'},secondary:{backgroundColor:'#2a2d33',borderRadius:11,paddingVertical:10,paddingHorizontal:12,alignItems:'center'},danger:{backgroundColor:'#4a292d',borderRadius:11,paddingVertical:10,paddingHorizontal:12,alignItems:'center'},danger2:{backgroundColor:'#b43742',borderRadius:11,paddingVertical:10,paddingHorizontal:12,alignItems:'center'},btn:{color:'#fff',fontWeight:'800',fontSize:13},avatar:{width:54,height:54,borderRadius:27,backgroundColor:'#303239'},chips:{flexDirection:'row',gap:7,flexWrap:'wrap',marginTop:5},chip:{backgroundColor:'#2a2d33',borderRadius:999,paddingHorizontal:9,paddingVertical:5},chipText:{color:'#cfd2d8',fontSize:11,fontWeight:'700'},stats:{flexDirection:'row',gap:8},stat:{flex:1,backgroundColor:'#151619',borderRadius:12,padding:10,gap:3},statL:{color:'#767d89',fontSize:10,fontWeight:'700'},statV:{color:'#e8eaed',fontSize:12,fontWeight:'700'},buttons:{flexDirection:'row',gap:8},switch:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},metricRow:{flexDirection:'row',gap:8},metric:{flex:1,backgroundColor:'#202228',borderRadius:14,padding:12,gap:3},metricNum:{color:'#fff',fontSize:20,fontWeight:'800'},metricLab:{color:'#8f96a3',fontSize:11},section:{color:'#8f96a3',fontSize:11,fontWeight:'800',textTransform:'uppercase',letterSpacing:.7}};
  const saveAlias=id=>{let v=String(editValue||'').trim();S.users={...S.users,[id]:{...S.users[id],alias:v}};setEditId(null);setEditValue('');toast(v?'Имя сохранено':'Используется имя Discord')};
  const cards=ids.map(id=>{let u=user(id),s=status(id),x=stat(id),cur=s!=='offline'&&x.sessionStarted?Date.now()-x.sessionStarted:0,total=(x.totalMs||0)+cur,pl=platform(id),a=avatar(id),editing=editId===id,confirm=delId===id;return h(N.View,{key:id,style:[st.user,{borderLeftWidth:3,borderLeftColor:s==='online'?'#3ba55d':s==='idle'?'#d9a441':s==='dnd'?'#ed4245':'#4e5058'}]},h(N.View,{style:st.row},a?h(N.Image,{source:{uri:a},style:st.avatar}):h(N.View,{style:st.avatar}),h(N.View,{style:st.grow},h(N.Text,{style:st.head},displayName(id)),h(N.Text,{style:st.hint},u?.username?`@${u.username}`:`ID ${id}`),h(N.View,{style:st.chips},h(N.View,{style:st.chip},h(N.Text,{style:st.chipText},`${dot(s)} ${sl(s)}`)),h(N.View,{style:st.chip},h(N.Text,{style:st.chipText},`📱 ${pl}`))))),h(N.View,{style:st.stats},h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'ПОСЛЕДНИЙ РАЗ'),h(N.Text,{style:st.statV},s==='offline'?ago(x.lastSeen):'Сейчас')),h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'СЕССИЯ'),h(N.Text,{style:st.statV},cur?dur(cur):'—')),h(N.View,{style:st.stat},h(N.Text,{style:st.statL},'ВСЕГО'),h(N.Text,{style:st.statV},dur(total)))),editing?h(N.View,{style:{gap:8}},h(N.TextInput,{style:st.input,value:editValue,onChangeText:setEditValue,placeholder:uname(id),placeholderTextColor:'#666b74',autoFocus:true}),h(N.View,{style:st.buttons},h(N.Pressable,{style:[st.primary,{flex:1}],onPress:()=>saveAlias(id)},h(N.Text,{style:st.btn},'Сохранить')),h(N.Pressable,{style:[st.secondary,{flex:1}],onPress:()=>{setEditId(null);setEditValue('')}},h(N.Text,{style:st.btn},'Отмена')))):null,h(N.View,{style:st.buttons},h(N.Pressable,{style:[st.secondary,{flex:1}],onPress:()=>{setDelId(null);setEditId(id);setEditValue(alias(id)||u?.globalName||u?.username||'')}},h(N.Text,{style:st.btn},'✏️ Имя')),h(N.Pressable,{style:[confirm?st.danger2:st.danger,{flex:1}],onPress:()=>{if(confirm){remove(id);setDelId(null);if(editId===id)setEditId(null)}else{setDelId(id);setTimeout(()=>setDelId(x=>x===id?null:x),4000)}}},h(N.Text,{style:st.btn},confirm?'Удалить точно?':'Удалить'))))});
  const hist=(S.history||[]).slice(0,20).map((e,i)=>h(N.View,{key:`${e.at}-${i}`,style:{backgroundColor:'#151619',borderRadius:12,padding:11,gap:3}},h(N.View,{style:st.row},h(N.Text,{style:[st.text,st.grow,{fontWeight:'700'}]},`${dot(e.to)} ${alias(e.id)||e.name}`),h(N.Text,{style:st.muted},new Date(e.at).toLocaleTimeString())),h(N.Text,{style:st.hint},`${sl(e.from)} → ${sl(e.to)} • ${e.platform||'Неизвестно'}`)));
  return h(N.ScrollView,{contentContainerStyle:st.page,keyboardShouldPersistTaps:'handled'},
    h(N.View,{style:st.hero},h(N.Text,{style:st.title},'PresenceWatch'),h(N.Text,{style:st.hint},`VERSION ${V} • ● Активен`),h(N.View,{style:st.metricRow},h(N.View,{style:st.metric},h(N.Text,{style:st.metricNum},String(ids.length)),h(N.Text,{style:st.metricLab},'Отслеживается')),h(N.View,{style:st.metric},h(N.Text,{style:st.metricNum},String(online)),h(N.Text,{style:st.metricLab},'Онлайн')),h(N.View,{style:st.metric},h(N.Text,{style:st.metricNum},String((S.history||[]).length)),h(N.Text,{style:st.metricLab},'Событий'))),h(N.Text,{style:st.hint},`Запущен: ${ago(started)} • Последнее событие: ${S.lastEventAt?ago(S.lastEventAt):'ещё не было'}`),h(N.Text,{style:st.hint},`Меню: ${[...PATCHED].join(', ')||'ожидание модулей'}`),S.debug.channelInjected?h(N.Text,{style:st.hint},'Long press: подключено'):null),
    h(N.View,{style:st.card},h(N.Text,{style:st.section},'Watchlist'),h(N.Text,{style:st.head},'Добавить пользователя'),h(N.TextInput,{style:st.input,value:input,onChangeText:setInput,keyboardType:'numeric',placeholder:'Discord ID',placeholderTextColor:'#666b74'}),h(N.Pressable,{style:st.primary,onPress:()=>{if(add(input))setInput('')}},h(N.Text,{style:st.btn},'＋ Добавить')),h(N.Text,{style:st.hint},'Также можно добавить через ⋯ профиля или долгим нажатием на ЛС.')),
    ...cards,
    h(N.View,{style:st.card},h(N.Text,{style:st.section},'Уведомления'),h(N.View,{style:st.switch},h(N.View,{style:st.grow},h(N.Text,{style:st.text},'Выход из сети'),h(N.Text,{style:st.hint},'Уведомить при переходе в Offline')),h(N.Switch,{value:!!S.notifyOffline,onValueChange:v=>S.notifyOffline=v})),h(N.View,{style:st.switch},h(N.View,{style:st.grow},h(N.Text,{style:st.text},'Online / Idle / DND'),h(N.Text,{style:st.hint},'Уведомлять о смене активного статуса')),h(N.Switch,{value:!!S.notifyStatusChanges,onValueChange:v=>S.notifyStatusChanges=v})),h(N.Pressable,{style:st.secondary,onPress:()=>notify('🟢 Тестовое уведомление PresenceWatch')},h(N.Text,{style:st.btn},'🔔 Проверить уведомление'))),
    h(N.View,{style:st.card},h(N.Text,{style:st.section},'Свои тексты уведомлений'),h(N.Text,{style:st.hint},'Переменные: {name} {id} {status} {platform} {time} {duration}'),h(N.TextInput,{style:st.inputMulti,value:to,onChangeText:setTo,multiline:true}),h(N.TextInput,{style:st.inputMulti,value:tf,onChangeText:setTf,multiline:true}),h(N.TextInput,{style:st.inputMulti,value:ts,onChangeText:setTs,multiline:true}),h(N.Pressable,{style:st.primary,onPress:()=>{S.templates={online:to||DEF.online,offline:tf||DEF.offline,status:ts||DEF.status};toast('Тексты сохранены')}},h(N.Text,{style:st.btn},'Сохранить шаблоны'))),
    h(N.View,{style:st.card},h(N.Text,{style:st.section},'Экспорт / импорт'),h(N.View,{style:st.buttons},h(N.Pressable,{style:[st.secondary,{flex:1}],onPress:exp},h(N.Text,{style:st.btn},'Экспорт')),h(N.Pressable,{style:[st.secondary,{flex:1}],onPress:imp},h(N.Text,{style:st.btn},'Импорт')))),
    h(N.View,{style:st.card},h(N.Text,{style:st.section},'История'),...(hist.length?hist:[h(N.Text,{key:'empty',style:st.hint},'История появится после изменения статуса.')]),hist.length?h(N.Pressable,{style:st.danger,onPress:()=>{S.history=[];toast('История очищена')}},h(N.Text,{style:st.btn},'Очистить историю')):null),
    h(N.Text,{style:st.hint},'Invisible отображается как Offline. PresenceWatch видит только presence-события, которые получает твой Discord-клиент.')
  );
}

return{
  onLoad(){started=Date.now();prime();F.subscribe('PRESENCE_UPDATE',event);startMenuPatches()},
  onUnload(){try{F.unsubscribe('PRESENCE_UPDATE',event)}catch{};if(patchTimer){clearInterval(patchTimer);patchTimer=null}for(const u of UN.splice(0))try{u?.()}catch{};PATCHED.clear();P.clear();PL.clear()},
  settings:Settings
}
})()