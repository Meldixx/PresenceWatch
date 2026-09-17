(()=>{
const CORE='https://raw.githubusercontent.com/Meldixx/PresenceWatch/7ce58e78fdfdab8c967c3796893b07c3f1ad74a9/install/index.js';
const V='1.1.2';
const S=vendetta.plugin.storage,R=vendetta.metro.common.React,N=vendetta.metro.common.ReactNative;
let base=null,loadError='',unpatches=[],profileId='',isProfileSheet=false;
const valid=id=>/^\d{15,22}$/.test(String(id||''));
const has=id=>!!S.users?.[String(id)];
const toast=x=>{try{vendetta.ui.toasts.showToast(String(x))}catch{}};
function getId(p){
  if(!p||typeof p!=='object')return'';
  const v=p.user?.id??p.userId??p.user_id??p.targetUserId??p.profile?.user?.id??p.member?.user?.id??p.context?.user?.id??p.context?.userId??p.props?.user?.id??p.props?.userId;
  return v==null?'':String(v);
}
function userName(id){try{const u=vendetta.metro.findByStoreName('UserStore')?.getUser?.(String(id));return u?.globalName||u?.username||id}catch{return id}}
function toggle(id){
  id=String(id||'');if(!valid(id))return;
  if(has(id)){
    const users={...(S.users||{})};delete users[id];S.users=users;toast(`${userName(id)} удалён из PresenceWatch`);
  }else{
    S.users={...(S.users||{}),[id]:{alias:'',addedAt:Date.now()}};
    S.stats={...(S.stats||{}),[id]:S.stats?.[id]||{totalMs:0,lastSessionMs:0,sessionStarted:0,lastSeen:0,lastStatusAt:0}};
    toast(`${userName(id)} добавлен в PresenceWatch`);
  }
}
function patchProfileMenu(){
  try{
    const Forms=vendetta.ui.components.Forms;
    const Lazy=vendetta.metro.findByProps('openLazy','hideActionSheet');
    const Simple=vendetta.metro.findByProps('showSimpleActionSheet');
    const patched=new WeakSet();
    const close=()=>{try{Lazy?.hideActionSheet?.()}catch{}};
    const act=id=>{close();toggle(id)};
    const looks=row=>!!row&&typeof row==='object'&&(typeof row?.props?.onPress==='function'||typeof row?.props?.label==='string'||/Row|Button|Item|Option|Entry/.test(String(row?.type?.name??row?.type?.displayName??'')));
    const makeRow=id=>R.createElement(Forms.FormRow,{key:'presencewatch-profile-row',label:has(id)?'✓ Удалить из PresenceWatch':'👁 Добавить в PresenceWatch',subLabel:has(id)?'Пользователь уже отслеживается':'Уведомлять, когда пользователь появится в сети',onPress:()=>act(id)});
    function inject(tree,id){
      if(!tree||!valid(id)||!Forms?.FormRow)return tree;
      try{
        const node=makeRow(id);
        const container=vendetta.utils.findInReactTree(tree,n=>Array.isArray(n?.props?.children)&&n.props.children.some(looks));
        if(container){
          const children=container.props.children;
          if(!children.some(x=>x?.key==='presencewatch-profile-row')){
            const destructive=children.findIndex(x=>x?.props?.isDestructive||x?.props?.destructive);
            destructive>=0?children.splice(destructive,0,node):children.push(node);
          }
          return tree;
        }
        return R.createElement(R.Fragment,null,tree,node);
      }catch{return tree}
    }
    if(Lazy?.openLazy){
      unpatches.push(vendetta.patcher.before('openLazy',Lazy,args=>{
        try{
          const component=args?.[0],key=String(args?.[1]||''),props=args?.[2]||{};
          const id=getId(props);
          profileId=id;
          isProfileSheet=valid(id)&&(/UserProfile/i.test(key)||/Profile.*User|User.*Profile/i.test(key));
          if(!isProfileSheet||typeof component?.then!=='function')return;
          component.then(mod=>{
            if(!mod||typeof mod.default!=='function'||patched.has(mod))return;
            patched.add(mod);
            unpatches.push(vendetta.patcher.after('default',mod,(a,result)=>{
              const idNow=getId(a?.[0])||profileId;
              return isProfileSheet&&valid(idNow)?inject(result,idNow):result;
            }));
          }).catch(()=>{});
        }catch{}
      }));
    }
    if(Simple?.showSimpleActionSheet){
      unpatches.push(vendetta.patcher.before('showSimpleActionSheet',Simple,args=>{
        try{
          const cfg=args?.[0];if(!cfg||!Array.isArray(cfg.options))return;
          const id=getId(cfg.context)||getId(cfg.props)||getId(cfg);
          const key=String(cfg.key||'');
          if(!valid(id)||(!/User|Profile/i.test(key)&&!cfg.user&&!cfg.context?.user))return;
          if(cfg.options.some(x=>x?.__presencewatch))return;
          const option={__presencewatch:true,label:has(id)?'✓ Удалить из PresenceWatch':'👁 Добавить в PresenceWatch',onPress:()=>act(id)};
          const destructive=cfg.options.findIndex(x=>x?.isDestructive);
          destructive>=0?cfg.options.splice(destructive,0,option):cfg.options.push(option);
        }catch{}
      }));
    }
  }catch(e){toast('PresenceWatch: не удалось подключить меню профиля')}
}
async function loadBase(){
  try{
    const res=await vendetta.utils.safeFetch(CORE,{cache:'no-store'});
    let code=await res.text();
    code=code.replace("const V='1.1.1'","const V='1.1.2'");
    base=eval(code);
    await base?.onLoad?.();
  }catch(e){
    loadError=String(e?.message||e||'unknown error');
    toast('PresenceWatch: ошибка загрузки основной части');
  }
}
function Settings(){
  const[,tick]=R.useState(0);
  R.useEffect(()=>{if(base||loadError)return;const t=setInterval(()=>tick(x=>x+1),250);return()=>clearInterval(t)},[]);
  if(base?.settings)return R.createElement(base.settings);
  return R.createElement(N.View,{style:{padding:18,gap:10}},R.createElement(N.Text,{style:{color:'#fff',fontSize:21,fontWeight:'800'}},`PresenceWatch ${V}`),R.createElement(N.Text,{style:{color:loadError?'#ed4245':'#b5bac1',fontSize:14}},loadError?`Ошибка: ${loadError}`:'Загрузка плагина…'));
}
return{
  onLoad(){patchProfileMenu();loadBase()},
  onUnload(){for(const f of unpatches.splice(0))try{f?.()}catch{};try{base?.onUnload?.()}catch{};base=null},
  settings:Settings
}
})()
