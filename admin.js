(() => {
'use strict';
const STORAGE_KEY='jzx-site-settings-v1', DRAFT_KEY='jzx-site-draft-v1', SESSION_KEY='jzx-admin-session-v1', DB_NAME='jzx-site-assets', STORE='images';
const defaults=window.JZX_DEFAULTS||{}, cfg=window.JZX_ADMIN_CONFIG||{};
const clone=o=>JSON.parse(JSON.stringify(o));
const deepMerge=(a,b)=>{if(Array.isArray(a))return Array.isArray(b)?b.map((v,i)=>deepMerge(a[i]??{},v)):clone(a);if(a&&typeof a==='object'){const o={...a};if(b&&typeof b==='object')Object.keys(b).forEach(k=>o[k]=deepMerge(a[k],b[k]));return o}return b===undefined?a:b};
let data=(()=>{try{return deepMerge(defaults,JSON.parse(localStorage.getItem(DRAFT_KEY)||localStorage.getItem(STORAGE_KEY)||'{}'))}catch{return clone(defaults)}})();
const ensureBlueDesign=()=>{data.theme=data.theme||{};if(data.theme.designVersion==='blue-collage-v1')return;Object.assign(data.theme,{preset:'blue',designVersion:'blue-collage-v1',background:'#05080d',surface:'#0a1119',text:'#ffffff',muted:'#cbd5e1',accentDark:'#05466d',accent:'#00a8ff',accentBright:'#58c8ff',accentLight:'#d9f4ff',accentSoft:'#2bb8ff',lineColor:'#00a8ff',glowColor:'#58c8ff',glowEnabled:'no'});};
ensureBlueDesign();
const normalizeRestoredBrandAssets=()=>{
  data.images=data.images||{};
  if(!data.images.headerLogo || data.images.headerLogo==='images/header-logo-blue-reference.png') data.images.headerLogo='images/logo-small.jpg';
  if(!data.images.heroSingle || String(data.images.heroSingle).startsWith('local-preview:')) data.images.heroSingle='images/hero-kitchen.jpg';
  if(!data.images.heroLeft || String(data.images.heroLeft).startsWith('local-preview:')) data.images.heroLeft='images/hero-kitchen.jpg';
  if(!data.images.heroRight || data.images.heroRight==='images/bathroom.jpg' || String(data.images.heroRight).startsWith('local-preview:')) data.images.heroRight='images/jzx-main-logo.jpg';
};
normalizeRestoredBrandAssets();
const applyAdminThemeVars=()=>{const t=data.theme||{};const r=document.documentElement.style;r.setProperty('--theme-accent',t.accent||'#00a8ff');r.setProperty('--theme-accent-secondary',t.accentDark||'#0077cc');r.setProperty('--theme-accent-dark',t.accentDark||'#05466d');r.setProperty('--theme-accent-bright',t.accentBright||'#58c8ff');r.setProperty('--theme-bg',t.background||'#05080d');r.setProperty('--theme-surface',t.surface||'#0a1119');r.setProperty('--theme-text',t.text||'#ffffff');r.setProperty('--theme-text-secondary',t.muted||'#cbd5e1');r.setProperty('--theme-border',t.lineColor||t.accent||'#00a8ff');r.setProperty('--gold',t.accent||'#00a8ff');r.setProperty('--bright',t.accentBright||'#58c8ff');};
applyAdminThemeVars();
const UNDO_KEY='jzx-admin-undo-v1', REDO_KEY='jzx-admin-redo-v1';
const readHistory=key=>{try{const v=JSON.parse(sessionStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return []}};
const writeHistory=(key,v)=>{try{sessionStorage.setItem(key,JSON.stringify(v.slice(-30)))}catch{}};
let lastDraftSnapshot=clone(data);
const pushUndoSnapshot=()=>{const stack=readHistory(UNDO_KEY);stack.push(clone(lastDraftSnapshot));writeHistory(UNDO_KEY,stack);writeHistory(REDO_KEY,[]);lastDraftSnapshot=clone(data);};
const updateHistoryButtons=()=>{const u=$('#undoBtn'),r=$('#redoBtn');if(u)u.disabled=readHistory(UNDO_KEY).length===0;if(r)r.disabled=readHistory(REDO_KEY).length===0;};
const cloudOn=()=>Boolean(window.JZXCloud?.enabled?.());
let cloudTimer=null, rendered=false;
const status=t=>{const st=document.querySelector('#saveStatus');if(st)st.textContent=t};
const queueCloudSave=()=>{
  if(!cloudOn())return;
  clearTimeout(cloudTimer);
  cloudTimer=setTimeout(async()=>{
    try{
      data.__meta=data.__meta||{};
      data.__meta.publishedAt=Date.now();
      await window.JZXCloud.saveSettings(data);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
      localStorage.setItem(DRAFT_KEY,JSON.stringify(data));
      status('Published to cloud.');
    }catch(e){
      console.warn(e);
      status('Saved on this device — cloud sync failed. Use Publish Changes to retry.');
    }
  },900);
};
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const openDb=()=>new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const dbPut=async(k,v)=>{const db=await openDb();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(v,k);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})};
const dbGet=async k=>{const db=await openDb();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(k);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})};
const dbDel=async k=>{const db=await openDb();return new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(k);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})};
const dbKeys=async()=>{const db=await openDb();return new Promise((res,rej)=>{const store=db.transaction(STORE,'readonly').objectStore(STORE);const r=store.getAllKeys();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})};
const dataUrlToFile=(dataUrl,key)=>{
  const m=String(dataUrl||'').match(/^data:([^;]+);base64,(.+)$/);
  if(!m)return null;
  const mime=m[1]||'image/jpeg', bin=atob(m[2]), bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const ext=(mime.split('/')[1]||'jpg').replace('jpeg','jpg').replace(/[^a-z0-9]/gi,'')||'jpg';
  return new File([bytes],`${key}.${ext}`,{type:mime});
};
const getPath=(o,p)=>p.split('.').reduce((x,k)=>x?.[k],o);
const setPath=(o,p,v)=>{const ks=p.split('.');let x=o;ks.slice(0,-1).forEach(k=>x=x[k]??=(/^\d+$/.test(ks[ks.indexOf(k)+1]||'')?[]:{}));x[ks.at(-1)]=v};
const save=()=>{
  pushUndoSnapshot();
  data.__meta=data.__meta||{};
  data.__meta.localUpdatedAt=Date.now();
  localStorage.setItem(DRAFT_KEY,JSON.stringify(data));
  lastDraftSnapshot=clone(data);
  const st=$('#saveStatus');
  if(st){
    st.textContent=cloudOn()?'Draft saved on this device — use Preview Draft, then Publish Changes when ready.':'Draft saved on this device — use Preview Draft to review it.';
    st.classList.add('save-flash');
    setTimeout(()=>st.classList.remove('save-flash'),800);
  }
  updateHistoryButtons();
};
const fileToData=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(f)});
let adminCloudLoaded=false;
const showAdmin=async()=>{
  $('#loginView').classList.add('hidden');
  $('#adminView').classList.remove('hidden');
  sessionStorage.setItem(SESSION_KEY,'1');

  if(cloudOn() && !adminCloudLoaded){
    adminCloudLoaded=true;
    try{
      const remote=await window.JZXCloud.loadSettings();
      if(remote){
        let local={};
        try{local=JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}catch{}
        const localEdited=Number(local?.__meta?.localUpdatedAt||0);
        const remotePublished=Number(remote?.__meta?.publishedAt||0);

        // In the ADMIN only, preserve a newer unpublished edit from this device.
        data=deepMerge(defaults,remote);
        if(localEdited>remotePublished) data=deepMerge(data,local);
        ensureBlueDesign();
        normalizeRestoredBrandAssets();

        localStorage.setItem(DRAFT_KEY,JSON.stringify(data));
        lastDraftSnapshot=clone(data);
        status(localEdited>remotePublished
          ? 'Loaded cloud settings; newer edits on this device are still pending publication.'
          : 'Loaded latest settings from cloud.');
      }
    }catch(e){
      console.warn(e);
      status('Cloud settings could not be loaded; using this device copy.');
    }
  }

  if(!rendered){
    render();
    rendered=true;
  }
};
const hideAdmin=(message='')=>{
  $('#adminView')?.classList.add('hidden');
  $('#loginView')?.classList.remove('hidden');
  sessionStorage.removeItem(SESSION_KEY);
  if(message && $('#loginNote')) $('#loginNote').textContent=message;
};
const logout=async()=>{sessionStorage.removeItem(SESSION_KEY);try{if(cloudOn())await window.JZXCloud.signOut()}catch{}hideAdmin('Signed out. Sign in with the authorized Google account.');};

function initLogin(){
  // PRODUCTION BUILD: Firebase Google Authentication is always required.
  // There is no localhost/file:// bypass in this build.
  const previewBtn=$('#previewLogin');
  if(previewBtn) previewBtn.remove();
  $('#logoutBtn').addEventListener('click',logout);

  if(cloudOn()){
    window.JZXCloud.init();
    const host=$('#googleButton');
    host.innerHTML='<button class="btn primary" id="firebaseGoogleLogin" type="button">Sign in with Google</button>';
    $('#firebaseGoogleLogin').addEventListener('click',async()=>{
      try{
        await window.JZXCloud.signIn();
      }catch(e){
        hideAdmin('Sign in with the authorized Google account.');
        alert(e.message||'Google sign-in failed.');
      }
    });
    $('#loginNote').textContent='Sign in with the authorized Google account to access and publish website changes.';
    window.JZXCloud.onAuth(async (user,state)=>{
      if(user){
        await showAdmin();
        return;
      }
      hideAdmin(state?.unauthorized
        ? 'This Google account is not authorized. Sign in with the authorized account.'
        : 'Sign in with the authorized Google account.');
    });
    return;
  }

  // Fail closed: never expose the Admin when Firebase Authentication is unavailable.
  $('#googleButton').innerHTML='';
  $('#loginNote').textContent='Firebase Authentication is not configured. Admin access is disabled.';
}
function bindSimpleFields(){
  $$('[data-path]').forEach(el=>{el.value=getPath(data,el.dataset.path)??'';el.addEventListener('change',()=>{setPath(data,el.dataset.path,el.value);if(el.dataset.path.startsWith('theme.'))applyAdminThemeVars();save()})});
}
const THEME_PRESETS={
  original:{background:'#080808',surface:'#101010',text:'#ffffff',muted:'#b8b8b8',accentDark:'#8a5a00',accent:'#d69b00',accentBright:'#ffd700',accentLight:'#fff4a3',accentSoft:'#ffbf00',lineColor:'#d69b00',glowColor:'#ffd700'},
  champagne:{background:'#090806',surface:'#15120d',text:'#fffaf0',muted:'#c9c0ae',accentDark:'#7d5d24',accent:'#c9a45b',accentBright:'#f1d38a',accentLight:'#fff0bd',accentSoft:'#d9b769',lineColor:'#c9a45b',glowColor:'#ffe09a'},
  copper:{background:'#0b0807',surface:'#17100d',text:'#fff8f3',muted:'#c4b2a8',accentDark:'#6f321d',accent:'#b7663b',accentBright:'#e89563',accentLight:'#ffc59f',accentSoft:'#cc7848',lineColor:'#b7663b',glowColor:'#ffad78'},
  silver:{background:'#08090a',surface:'#111315',text:'#f8f9fa',muted:'#aeb4ba',accentDark:'#555d64',accent:'#89939c',accentBright:'#d8dde2',accentLight:'#f3f5f7',accentSoft:'#b5bdc5',lineColor:'#89939c',glowColor:'#eef5ff'},
  blue:{background:'#05090d',surface:'#0c141c',text:'#f4f9ff',muted:'#a8b9c8',accentDark:'#174b70',accent:'#2f83bd',accentBright:'#65c8ff',accentLight:'#bcecff',accentSoft:'#3da6df',lineColor:'#2f83bd',glowColor:'#7bd5ff'},
  emerald:{background:'#050a08',surface:'#0d1713',text:'#f4fff9',muted:'#a9c0b5',accentDark:'#17603d',accent:'#299866',accentBright:'#4de39b',accentLight:'#b5ffd9',accentSoft:'#36ba7b',lineColor:'#299866',glowColor:'#67f0ad'},
  burgundy:{background:'#0b0507',surface:'#190d12',text:'#fff7f9',muted:'#c4aeb5',accentDark:'#661d34',accent:'#a7375d',accentBright:'#ef7099',accentLight:'#ffc0d4',accentSoft:'#c94b73',lineColor:'#a7375d',glowColor:'#ff88ad'}
};
function bindThemePreset(){
  const sel=$('#themePreset'); if(!sel) return;
  sel.addEventListener('change',()=>{
    if(sel.value==='custom') return;
    const preset=THEME_PRESETS[sel.value]; if(!preset) return;
    data.theme={...(data.theme||{}),...preset,preset:sel.value,designVersion:'blue-collage-v1'};
    Object.entries(preset).forEach(([k,v])=>{const el=document.querySelector(`[data-path="theme.${k}"]`);if(el)el.value=v});
    applyAdminThemeVars();
    save();
  });
  $$('[data-path^="theme."]').filter(el=>el!==sel).forEach(el=>el.addEventListener('input',()=>{if(sel.value!=='custom'){sel.value='custom';setPath(data,'theme.preset','custom')}}));
}
const cacheBustImage=(src)=>{
  if(!src)return '';
  if(/^data:|^blob:|^https?:\/\//i.test(src)) return src;
  const sep=src.includes('?')?'&':'?';
  return `${src}${sep}v=${Date.now()}`;
};
const getAsset=async(key,fallback)=>cacheBustImage(fallback||'');
async function previewFor(key,img,fallback){
  if(!img)return;
  img.src=await getAsset(key,fallback);
  img.style.display=img.src?'block':'none';
  img.onerror=()=>{img.style.display='none'};
}
function makeImageEditor(key,title,fallback){
  const w=document.createElement('div');
  w.className='image-editor image-preview-only';
  w.dataset.imageKey=key;
  w.innerHTML=`<h3>${title}</h3><img alt="${title}"><p class="small image-folder-note">Image is managed directly from the <code>images</code> folder. Replace the project image using the same filename, then refresh this admin page.</p>`;
  previewFor(key,$('img',w),fallback);
  return w;
}
function bindStaticImageEditors(){
  $$('.image-editor[data-image-key]').forEach(w=>{
    const key=w.dataset.imageKey;
    const fallback=getPath(data,'images.'+key);
    previewFor(key,$('img',w),fallback);
    w.querySelectorAll('input[type=file],.remove-image').forEach(el=>el.remove());
    if(!w.querySelector('.image-folder-note')){
      const note=document.createElement('p');
      note.className='small image-folder-note';
      note.innerHTML='Image is managed directly from the <code>images</code> folder. Replace the file using the same filename, then refresh this page.';
      w.appendChild(note);
    }
  });
}
function renderServices(){
  const host=$('#servicesEditor');host.innerHTML='';
  (data.services||[]).forEach((s,i)=>{
    const c=document.createElement('div');
    c.className='repeat-card';
    c.innerHTML=`<h3>Service ${i+1}</h3><img><p class="small image-folder-note">Image preview from the <code>images</code> folder. Replace the matching file in GitHub to change it.</p><label>Title<input value="${(s.title||'').replace(/"/g,'&quot;')}"></label><label>Description<textarea rows="3">${s.description||''}</textarea></label>`;
    const [title,desc]=c.querySelectorAll('input,textarea'),img=$('img',c);
    previewFor(`service-${i}`,img,s.image);
    title.addEventListener('change',()=>{data.services[i].title=title.value;save()});
    desc.addEventListener('change',()=>{data.services[i].description=desc.value;save()});
    addItemVisibilityControls(c,'services',i,[['title','Title'],['description','Text'],['image','Image']]);
    host.appendChild(c);
  });
}
function renderProjects(){const host=$('#projectsEditor');host.innerHTML='';['before1','after1','before2','after2','before3','after3','before4','after4'].forEach(k=>{const ed=makeImageEditor(`project-${k}`,k.toUpperCase(),data.projects?.[k]);const row=document.createElement('div');row.className='item-visibility-controls';row.appendChild(makeVisibilitySwitch(itemVisible('projects',k),on=>setItemVisible('projects',k,on),'Show image'));ed.insertBefore(row,ed.querySelector('img'));host.appendChild(ed)})}
function renderTextPairs(hostId,items,pathPrefix,labels){const host=$(hostId);if(!host)return;host.innerHTML='';(items||[]).forEach((d,i)=>{const c=document.createElement('div');c.className='repeat-card';c.innerHTML=`<h3>${labels.card} ${i+1}</h3><label>${labels.a}<input></label><label>${labels.b}<textarea rows="3"></textarea></label>`;const input=$('input',c),ta=$('textarea',c);input.value=d[labels.ak]||'';ta.value=d[labels.bk]||'';input.addEventListener('change',()=>{getPath(data,pathPrefix)[i][labels.ak]=input.value;save()});ta.addEventListener('change',()=>{getPath(data,pathPrefix)[i][labels.bk]=ta.value;save()});const group=pathPrefix.split('.')[0];addItemVisibilityControls(c,group,i,[[labels.ak,labels.a],[labels.bk,labels.b]]);host.appendChild(c)})}
function renderTrust(){renderTextPairs('#trustEditor',data.trust?.items,'trust.items',{card:'Reason',a:'Title',b:'Description',ak:'title',bk:'text'})}
function renderProcess(){renderTextPairs('#processEditor',data.process?.steps,'process.steps',{card:'Step',a:'Title',b:'Description',ak:'title',bk:'text'})}
function renderTestimonials(){const host=$('#testimonialsEditor');if(!host)return;host.innerHTML='';(data.testimonials?.items||[]).forEach((d,i)=>{const c=document.createElement('div');c.className='repeat-card';c.innerHTML=`<h3>Testimonial ${i+1}</h3><label>Customer name<input></label><label>Project / service<input></label><label>Review<textarea rows="4"></textarea></label>`;const ins=c.querySelectorAll('input'),ta=$('textarea',c);ins[0].value=d.name||'';ins[1].value=d.project||'';ta.value=d.quote||'';ins[0].addEventListener('change',()=>{data.testimonials.items[i].name=ins[0].value;save()});ins[1].addEventListener('change',()=>{data.testimonials.items[i].project=ins[1].value;save()});ta.addEventListener('change',()=>{data.testimonials.items[i].quote=ta.value;save()});addItemVisibilityControls(c,'testimonials',i,[['name','Name'],['project','Project'],['quote','Review']]);host.appendChild(c)})}
function renderFaq(){renderTextPairs('#faqEditor',data.faq?.items,'faq.items',{card:'FAQ',a:'Question',b:'Answer',ak:'question',bk:'answer'})}
function renderCatalogue(){
  const host=$('#catalogueEditor');host.innerHTML='';
  (data.catalogue||[]).forEach((d,i)=>{
    const c=document.createElement('div');
    c.className='repeat-card';
    c.innerHTML=`<h3>Slot ${i+1}${i<3?' — visible':''}</h3><img><p class="small image-folder-note">Image preview from the <code>images</code> folder. Replace the matching file in GitHub to change it.</p><label>Title<input value="${(d.title||'').replace(/"/g,'&quot;')}"></label>`;
    const img=$('img',c),title=$('input',c);
    previewFor(`catalogue-${i}`,img,d.image);
    title.addEventListener('change',()=>{data.catalogue[i].title=title.value;save()});
    addItemVisibilityControls(c,'catalogue',i,[['title','Title'],['image','Image']]);
    host.appendChild(c);
  });
}
const localTrafficMonthKey=()=>{
  try{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit'}).formatToParts(new Date());
    return `${parts.find(x=>x.type==='year')?.value}-${parts.find(x=>x.type==='month')?.value}`;
  }catch{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
};
const previousTrafficMonthKey=(key=localTrafficMonthKey())=>{
  const [y,m]=String(key).split('-').map(Number);
  if(!y||!m)return '';
  const d=new Date(Date.UTC(y,m-2,15));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
};
const formatMonthLabel=(key)=>{
  const [y,m]=String(key||'').split('-').map(Number);
  if(!y||!m)return 'Month';
  try{return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'America/Chicago'}).format(new Date(Date.UTC(y,m-1,15)))}catch{return key}
};
async function loadTrafficCounters(){
  const current=$('#currentMonthCount'), previous=$('#previousMonthCount');
  const currentLabel=$('#currentMonthLabel'), previousLabel=$('#previousMonthLabel');
  if(!current||!previous)return;
  const currentKey=localTrafficMonthKey(), previousKey=previousTrafficMonthKey(currentKey);
  currentLabel.textContent=formatMonthLabel(currentKey);
  previousLabel.textContent=formatMonthLabel(previousKey);
  current.textContent='…'; previous.textContent='…';
  try{
    if(cloudOn()){
      const stats=await window.JZXCloud.loadTrafficStats();
      current.textContent=Number(stats?.current||0).toLocaleString();
      previous.textContent=Number(stats?.previous||0).toLocaleString();
      currentLabel.textContent=formatMonthLabel(stats?.currentMonthKey||currentKey);
      previousLabel.textContent=formatMonthLabel(stats?.previousMonthKey||previousKey);
    }else{
      current.textContent=(Number(localStorage.getItem(`jzx-traffic-monthly-v1:${currentKey}`))||0).toLocaleString();
      previous.textContent=(Number(localStorage.getItem(`jzx-traffic-monthly-v1:${previousKey}`))||0).toLocaleString();
    }
  }catch(e){
    console.warn(e);
    current.textContent=(Number(localStorage.getItem(`jzx-traffic-monthly-v1:${currentKey}`))||0).toLocaleString();
    previous.textContent=(Number(localStorage.getItem(`jzx-traffic-monthly-v1:${previousKey}`))||0).toLocaleString();
  }
}
$('#refreshTrafficBtn')?.addEventListener('click',loadTrafficCounters);

function render(){bindNav();bindSimpleFields();bindThemePreset();bindStaticImageEditors();renderServices();renderProjects();renderTrust();renderProcess();renderTestimonials();renderFaq();renderCatalogue();bindVisibilityUI();updateHistoryButtons();loadTrafficCounters();const cs=$('#cloudStatus');if(cs)cs.textContent=cloudOn()?'Firebase configured — drafts stay local until you choose Publish Changes.':'Firebase is not configured.';}

const publishNow=async()=>{
  if(!cloudOn()){
    const c=window.JZX_ADMIN_CONFIG;
    if(!c?.firebase?.enabled || !c?.firebase?.config?.apiKey) return alert('Firebase configuration did not load. Refresh this page once and try again.');
    if(!window.firebase) return alert('Firebase SDK did not load. Check your internet connection, then refresh this page.');
    return alert('Firebase could not initialize. Refresh this page and try again.');
  }
  try{
    status('Publishing settings to cloud…');
    data.__meta=data.__meta||{};
    data.__meta.publishedAt=Date.now();
    data.__meta.localUpdatedAt=data.__meta.localUpdatedAt||data.__meta.publishedAt;
    // Images are intentionally NOT uploaded to Firebase Storage.
    // They are managed as normal files inside the project /images folder.
    if(data.cloudImages) delete data.cloudImages;
    await window.JZXCloud.saveSettings(data);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
    localStorage.setItem(DRAFT_KEY,JSON.stringify(data));
    lastDraftSnapshot=clone(data);
    status('Published settings. Images are managed from the project images folder.');
  }catch(e){
    console.error(e);
    alert(e?.message||'Cloud publish failed.');
  }
};
$('#publishBtn')?.addEventListener('click',publishNow);$('#publishCloudBtn')?.addEventListener('click',publishNow);
$('#previewDraftBtn')?.addEventListener('click',()=>{
  localStorage.setItem(DRAFT_KEY,JSON.stringify(data));
  window.open('index.html?preview=1','_blank','noopener');
});
$('#undoBtn')?.addEventListener('click',()=>{
  const undo=readHistory(UNDO_KEY);
  if(!undo.length)return;
  const previous=undo.pop();
  const redo=readHistory(REDO_KEY);
  redo.push(clone(data));
  writeHistory(UNDO_KEY,undo);writeHistory(REDO_KEY,redo);
  localStorage.setItem(DRAFT_KEY,JSON.stringify(previous));
  location.reload();
});
$('#redoBtn')?.addEventListener('click',()=>{
  const redo=readHistory(REDO_KEY);
  if(!redo.length)return;
  const next=redo.pop();
  const undo=readHistory(UNDO_KEY);
  undo.push(clone(data));
  writeHistory(REDO_KEY,redo);writeHistory(UNDO_KEY,undo);
  localStorage.setItem(DRAFT_KEY,JSON.stringify(next));
  location.reload();
});
$('#syncCloudBtn')?.addEventListener('click',async()=>{
  if(!cloudOn())return alert('Firebase is not configured yet.');
  if(!confirm('Load the published cloud settings and replace the current local draft on this device?'))return;
  try{const remote=await window.JZXCloud.loadSettings();if(remote){const undo=readHistory(UNDO_KEY);undo.push(clone(data));writeHistory(UNDO_KEY,undo);writeHistory(REDO_KEY,[]);data=deepMerge(defaults,remote);localStorage.setItem(DRAFT_KEY,JSON.stringify(data));location.reload()}else alert('No published settings document exists yet.')}catch(e){alert(e.message||'Could not load cloud settings.')}
});

$('#exportBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jmx-site-settings.json';a.click();URL.revokeObjectURL(a.href)});
$('#importInput').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  if(!confirm('Import this settings file and replace the current local draft? Nothing will be published until you choose Publish Changes.')){e.target.value='';return;}
  try{const previous=clone(data);data=deepMerge(defaults,JSON.parse(await f.text()));const undo=readHistory(UNDO_KEY);undo.push(previous);writeHistory(UNDO_KEY,undo);writeHistory(REDO_KEY,[]);data.__meta=data.__meta||{};data.__meta.localUpdatedAt=Date.now();localStorage.setItem(DRAFT_KEY,JSON.stringify(data));location.reload()}catch{alert('Invalid settings file.')}
});
$('#resetBtn').addEventListener('click',async()=>{if(!confirm('Reset all editable settings to the original website defaults? Images in the project images folder will not be deleted.'))return;const undo=readHistory(UNDO_KEY);undo.push(clone(data));writeHistory(UNDO_KEY,undo);writeHistory(REDO_KEY,[]);data=clone(defaults);data.__meta=data.__meta||{};data.__meta.localUpdatedAt=Date.now();localStorage.setItem(DRAFT_KEY,JSON.stringify(data));const db=await openDb();await new Promise((res,rej)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});location.reload()});
initLogin();
})();
