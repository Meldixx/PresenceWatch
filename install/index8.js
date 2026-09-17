(()=>{
const R=vendetta.metro.common.React;
const N=vendetta.metro.common.ReactNative;
const SRC='https://raw.githubusercontent.com/Meldixx/PresenceWatch/main/install/index6.js';
let delegate=null,loading=null,loadError=null,started=false,disposed=false;
const listeners=new Set();
const notify=()=>{for(const fn of [...listeners])try{fn(x=>x+1)}catch{}};
function patchSource(src){
  src=String(src);
  if(!src.includes("const V='1.5.1'"))throw Error('Неожиданная версия базового файла');
  src=src.replace("const V='1.5.1';","const V='1.5.3';");
  src=src.replace("const CHANGELOGS={","const CHANGELOGS={'1.5.3':['Исправлен бесконечный React render в настройках','Исправлен ensureOrder без записи в storage на каждом render','Исправлена ошибка загрузчика hotfix 1.5.2','Стабилизирован экран PresenceWatch'],");
  const old="S.order=out;return out}";
  const fixed="let cur=Array.isArray(S.order)?S.order:[];if(cur.length!==out.length||cur.some((x,i)=>x!==out[i]))S.order=out;return out}";
  if(!src.includes(old))throw Error('Не найден актуальный участок ensureOrder');
  return src.replace(old,fixed);
}
async function ensureLoaded(){
  if(delegate)return delegate;
  if(loading)return loading;
  loading=(async()=>{
    try{
      const r=await fetch(`${SRC}?hotfix=1.5.3&t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)throw Error(`HTTP ${r.status}`);
      const src=patchSource(await r.text());
      const plugin=eval(src);
      if(!plugin||typeof plugin!=='object')throw Error('Некорректный объект плагина');
      delegate=plugin;
      loadError=null;
      if(!disposed&&!started&&typeof delegate.onLoad==='function'){
        delegate.onLoad();
        started=true;
      }
      notify();
      return delegate;
    }catch(e){
      loadError=String(e?.message||e);
      loading=null;
      notify();
      throw e;
    }
  })();
  return loading;
}
function Settings(){
  const[,tick]=R.useState(0);
  R.useEffect(()=>{listeners.add(tick);ensureLoaded().catch(()=>{});return()=>listeners.delete(tick)},[]);
  if(delegate?.settings)return R.createElement(delegate.settings);
  const st={page:{padding:28,gap:18},title:{color:'#fff',fontSize:30,fontWeight:'800'},text:{color:'#aeb1b8',fontSize:16},err:{color:'#ed4245',fontSize:16},btn:{backgroundColor:'#5865F2',borderRadius:14,padding:16,alignItems:'center'},bt:{color:'#fff',fontWeight:'800',fontSize:16}};
  return R.createElement(N.View,{style:st.page},
    R.createElement(N.Text,{style:st.title},'PresenceWatch'),
    loadError?R.createElement(N.Text,{style:st.err},`Ошибка загрузки: ${loadError}`):R.createElement(N.Text,{style:st.text},'Загрузка PresenceWatch v1.5.3…'),
    loadError?R.createElement(N.Pressable,{style:st.btn,onPress:()=>{loadError=null;loading=null;ensureLoaded().catch(()=>{});tick(x=>x+1)}},R.createElement(N.Text,{style:st.bt},'Повторить')):null
  );
}
ensureLoaded().catch(()=>{});
return{
  onLoad(){disposed=false;ensureLoaded().catch(()=>{})},
  onUnload(){disposed=true;try{delegate?.onUnload?.()}catch{};started=false},
  settings:Settings
}
})()
