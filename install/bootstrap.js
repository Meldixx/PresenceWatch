(()=>{
const V='1.2.1';
const CORE='https://raw.githubusercontent.com/Meldixx/PresenceWatch/main/install/index.js';
const S=vendetta.plugin.storage;
const R=vendetta.metro.common.React;
const N=vendetta.metro.common.ReactNative;
let core=null,err='',unpatch=null;
const valid=id=>/^\d{15,22}$/.test(String(id||''));
const has=id=>!!S.users?.[String(id)];
const toast=x=>{try{vendetta.ui.toasts.showToast(String(x))}catch{}};
function userName(id){try{const u=vendetta.metro.findByStoreName('UserStore')?.getUser?.(String(id));return u?.globalName||u?.username||id}catch{return id}}
function toggle(id){id=String(id||'');if(!valid(id))return;if(has(id)){const users={...(S.users||{})};delete users[id];S.users=users;toast(`${userName(id)} удалён из PresenceWatch`)}else{S.users={...(S.users||{}),[id]:{alias:'',addedAt:Date.now()}};S.stats={...(S.stats||{}),[id]:S.stats?.[id]||{totalMs:0,lastSessionMs:0,sessionStarted:0,lastSeen:0,lastStatusAt:0}};toast(`${userName(id)} добавлен в PresenceWatch`)}}
function patchProfileMenu(){
  try{
    const sheets=vendetta.metro.findByProps('openLazy');
    if(!sheets?.openLazy)return;
    unpatch=vendetta.patcher.before('openLazy',sheets,([sheet,args])=>{
      try{
        if(sheet!=='UserProfileActionSheet'||!args)return;
        const u=args.user;
        const id=String(u?.id??args.userId??'');
        if(!valid(id)||!Array.isArray(args.buttons))return;
        if(args.buttons.some(b=>b?.__presencewatch))return;
        args.buttons.push({
          __presencewatch:true,
          text:has(id)?'✓ Удалить из PresenceWatch':'👁 Добавить в PresenceWatch',
          onPress:()=>toggle(id)
        });
      }catch{}
    });
  }catch(e){toast('PresenceWatch: не удалось подключить меню профиля')}
}
async function loadCore(){
  try{
    const r=await vendetta.utils.safeFetch(`${CORE}?t=${Date.now()}`,{cache:'no-store'});
    if(!r?.ok&&r?.status)throw Error(`HTTP ${r.status}`);
    let code=await r.text();
    code=code.replace(/const V='[^']+'/,`const V='${V}'`);
    const factory=(0,eval)(`vendetta=>{return ${code}}\n//# sourceURL=${CORE}`);
    let raw=factory(vendetta);
    core=typeof raw==='function'?raw():raw;
    core=core?.default??core??{};
    await core?.onLoad?.();
  }catch(e){err=String(e?.message||e||'unknown error');toast(`PresenceWatch: ${err}`)}
}
function Settings(){
  const[,tick]=R.useState(0);
  R.useEffect(()=>{if(core||err)return;const t=setInterval(()=>tick(x=>x+1),250);return()=>clearInterval(t)},[]);
  if(core?.settings)return R.createElement(core.settings);
  return R.createElement(N.View,{style:{padding:18,gap:10}},R.createElement(N.Text,{style:{color:'#fff',fontSize:21,fontWeight:'800'}},`PresenceWatch ${V}`),R.createElement(N.Text,{style:{color:err?'#ed4245':'#b5bac1',fontSize:14}},err?`Ошибка: ${err}`:'Загрузка…'));
}
return{
  onLoad(){patchProfileMenu();loadCore()},
  onUnload(){try{unpatch?.()}catch{};try{core?.onUnload?.()}catch{};core=null},
  settings:Settings
}
})()