(() => {
  'use strict';
  const getCfg = () => window.JZX_ADMIN_CONFIG || {};
  let initialized = false, app = null, auth = null, db = null, storage = null;
  const enabled = () => {
    const cfg = getCfg();
    return Boolean(cfg.firebase?.enabled && cfg.firebase?.config?.apiKey && window.firebase);
  };
  const allowedEmail = () => String(getCfg().allowedGoogleEmail || '').trim().toLowerCase();
  const settingsDoc = () => getCfg().firebase?.settingsDoc || 'sites/jmx-public';
  const assetFolder = () => getCfg().firebase?.assetFolder || 'jmx-site-assets';
  const trafficGlobalDoc = () => getCfg().firebase?.trafficGlobalDoc || 'traffic/global';
  const trafficMonthlyPrefix = () => getCfg().firebase?.trafficMonthlyPrefix || 'traffic/monthly_';
  const chicagoMonthKey = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago', year:'numeric', month:'2-digit'}).formatToParts(new Date());
      const y = parts.find(x=>x.type==='year')?.value, m = parts.find(x=>x.type==='month')?.value;
      return `${y}-${m}`;
    } catch {
      const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    }
  };
  function init(){
    if(initialized) return true;
    if(!enabled()) return false;
    try{
      const cfg = getCfg();
      app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(cfg.firebase.config);
      auth = firebase.auth(); db = firebase.firestore(); storage = firebase.storage(); initialized = true; return true;
    }catch(err){ console.error('Firebase init failed', err); return false; }
  }
  const isAllowed = user => !allowedEmail() || String(user?.email || '').toLowerCase() === allowedEmail();
  async function signIn(){
    if(!init()) throw new Error('Firebase is not configured.');
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    if(!isAllowed(result.user)){ await auth.signOut(); throw new Error('This Google account is not authorized.'); }
    return result.user;
  }
  async function signOut(){ if(init()) await auth.signOut(); }
  function onAuth(cb){ if(!init()) return () => {}; return auth.onAuthStateChanged(u => cb(isAllowed(u) ? u : null)); }
  async function loadSettings(){ if(!init()) return null; const snap = await db.doc(settingsDoc()).get(); return snap.exists ? snap.data() : null; }
  async function saveSettings(data){ if(!init()) throw new Error('Firebase is not configured.'); const user=auth.currentUser; if(!user || !isAllowed(user)) throw new Error('Admin sign-in required.'); await db.doc(settingsDoc()).set(data,{merge:false}); return true; }
  async function uploadImage(key,file){
    if(!init()) throw new Error('Firebase is not configured.'); const user=auth.currentUser; if(!user || !isAllowed(user)) throw new Error('Admin sign-in required.');
    const safe = String(file.name || 'image').replace(/[^a-z0-9._-]+/gi,'-');
    const ref = storage.ref(`${assetFolder()}/${key}/${Date.now()}-${safe}`);
    await ref.put(file,{contentType:file.type || 'application/octet-stream'}); return await ref.getDownloadURL();
  }
  async function deleteImageByUrl(url){ if(!init() || !url) return; try{ await storage.refFromURL(url).delete(); }catch(e){ console.warn('Could not delete old cloud image',e); } }
  async function incrementTraffic(){
    if(!init()) return null;
    const monthKey = chicagoMonthKey();
    const inc = firebase.firestore.FieldValue.increment(1);
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.set(db.doc(trafficGlobalDoc()), {views:inc, updatedAt:now}, {merge:true});
    batch.set(db.doc(`${trafficMonthlyPrefix()}${monthKey}`), {views:inc, monthKey, updatedAt:now}, {merge:true});
    await batch.commit();
    return monthKey;
  }
  async function loadTrafficStats(){
    if(!init()) return null;
    const user=auth.currentUser;
    if(!user || !isAllowed(user)) throw new Error('Admin sign-in required to read traffic counters.');
    const monthKey = chicagoMonthKey();
    const [globalSnap, monthlySnap] = await Promise.all([
      db.doc(trafficGlobalDoc()).get(),
      db.doc(`${trafficMonthlyPrefix()}${monthKey}`).get()
    ]);
    return {
      monthKey,
      monthly: monthlySnap.exists ? Number(monthlySnap.data()?.views || 0) : 0,
      global: globalSnap.exists ? Number(globalSnap.data()?.views || 0) : 0
    };
  }
  window.JZXCloud = { enabled, init, signIn, signOut, onAuth, isAllowed, loadSettings, saveSettings, uploadImage, deleteImageByUrl, incrementTraffic, loadTrafficStats, chicagoMonthKey };
})();
