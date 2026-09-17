(()=>{
const R=vendetta.metro.common.React;
const N=vendetta.metro.common.ReactNative;
const SRC='https://raw.githubusercontent.com/Meldixx/PresenceWatch/main/install/index6.js';
let delegate=null,loading=null,loadError=null,started=false,disposed=false;
const listeners=new Set();
const notify=()=>{for(const fn of [...listeners])try{fn(x=>x+1)}catch{}};
function patchSource(src){
  if(!String(src).includes("const V='1.5.1'"))throw Error('Неожиданная версия базового файла');
  src=String(src).replace("const V='1.5.1';","const V='1.5.2';");
  src=src.replace("const CHANGELOGS={","const CHANGELOGS={'1.5.2':['Исправлен бесконечный React render в настройках','Убрана запись S.order при каждом render','Стабилизирован экран PresenceWatch'],");
  const old="S.order=next;return next}";
  const fixed="let cur=Array.isArray(S.order)?S.order:[];if(cur.length!==next.length||cur.some((x,i)=>x!==next[i]))S.order=next;return next}";
  if(!src.includes(old))throw Error('Не найден участок ensureOrder');
  src=src.replace(old,fixed);
  return src;
}
async function ensureLoaded(){
  if(delegate)return delegate;
  if(loading)return loading;
  loading=(async()=>{
    try{
      const r=await fetch(`${SRC}?hotfix=1.5.2&t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)throw Error(`HTTP ${r.status}`);
      const src=patchSource(await r.text());
      const plugin=eval(src);
      if(!plugin||typeof plugin!=='object')throw Error('Некорректный объект плагина');
      delegate=plugin;
      loadError=null;
      if(!disposed&&!started&&typeof delegate.onLoad==='function'){
        started=true;
        await Promise.resolve(delegate.onLoad());
      }
      notify();
      return delegate;
    }catch(e){
      loadError=e;
      loading=null;
      notify();
      throw e;
    }
  })();
  return loading;
}
function Settings(){
  const[,force]=R.useState(0);
  R.useEffect(()=>{listeners.add(force);ensureLoaded().catch(()=>{});return()=>listeners.delete(force)},[]);
  if(loadError)return R.createElement(N.View,{style:{padding:18,gap:12}},R.createElement(N.Text,{style:{color:'#fff',fontSize:22,fontWeight:'800'}},'PresenceWatch'),R.createElement(N.Text,{style:{color:'#ed4245'}},`Ошибка загрузки hotfix: ${String(loadError?.message||loadError)}`),R.createElement(N.Pressable,{style:{backgroundColor:'#5865F2',borderRadius:12,padding:12,alignItems:'center'},onPress:()=>{loadError=null;loading=null;force(x=>x+1);ensureLoaded().catch(()=>{})}},R.createElement(N.Text,{style:{color:'#fff',fontWeight:'800'}},'Повторить')));
  if(!delegate?.settings)return R.createElement(N.View,{style:{padding:18}},R.createElement(N.Text,{style:{color:'#fff'}},'PresenceWatch v1.5.2 загружается…'));
  return R.createElement(delegate.settings);
}
return{
  onLoad(){disposed=false;ensureLoaded().catch(()=>{})},
  onUnload(){disposed=true;try{if(started)delegate?.onUnload?.()}catch{}started=false;delegate=null;loading=null},
  settings:Settings
}
})()
