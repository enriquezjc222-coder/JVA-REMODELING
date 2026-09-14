(() => {
  'use strict';
  const cfg = window.JVA_ESTIMATE_CONFIG || {};
  const form = document.getElementById('estimateForm');
  const filesInput = document.getElementById('projectFiles');
  const fileList = document.getElementById('fileList');
  const fileSummary = document.getElementById('fileSummary');
  const submitBtn = document.getElementById('submitBtn');
  const message = document.getElementById('formMessage');
  const successPanel = document.getElementById('successPanel');
  const allowedTypes = new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime']);
  document.getElementById('startedAt').value = String(Date.now());

  const fmtBytes = n => n < 1024*1024 ? `${(n/1024).toFixed(0)} KB` : `${(n/1024/1024).toFixed(1)} MB`;
  const errEl = name => document.querySelector(`[data-error-for="${name}"]`);
  const setErr = (name,text='') => { const el=errEl(name); if(el) el.textContent=text; };
  const clearErrors = () => document.querySelectorAll('.error').forEach(el => el.textContent='');
  const currentFiles = () => Array.from(filesInput.files || []);

  function validateFiles(show=true){
    const files=currentFiles();
    let problem='';
    if(files.length > (cfg.maxFiles||10)) problem='You can upload a maximum of 10 files.';
    let total=0;
    for(const file of files){
      total += file.size;
      if(!allowedTypes.has(file.type)){ problem=`${file.name}: unsupported file type.`; break; }
      const max=file.type.startsWith('video/')?(cfg.maxVideoBytes||50*1024*1024):(cfg.maxImageBytes||10*1024*1024);
      if(file.size>max){ problem=`${file.name} is too large. ${file.type.startsWith('video/')?'Videos':'Images'} must be ${Math.round(max/1024/1024)} MB or smaller.`; break; }
    }
    if(!problem && total>(cfg.maxTotalBytes||100*1024*1024)) problem='The combined upload is too large. Maximum total is 100 MB.';
    if(show) setErr('projectFiles',problem);
    return !problem;
  }

  function renderFiles(){
    const files=currentFiles();
    fileList.innerHTML='';
    const total=files.reduce((n,f)=>n+f.size,0);
    fileSummary.textContent=files.length?`${files.length} file${files.length===1?'':'s'} selected — ${fmtBytes(total)} total.`:'No files selected.';
    files.forEach(f=>{
      const li=document.createElement('li');
      const a=document.createElement('span'); a.textContent=f.name;
      const b=document.createElement('span'); b.textContent=fmtBytes(f.size);
      li.append(a,b); fileList.append(li);
    });
    validateFiles(true);
  }
  filesInput.addEventListener('change',renderFiles);

  const desc=document.getElementById('description');
  const descCount=document.getElementById('descriptionCount');
  const updateCount=()=>descCount.textContent=`${desc.value.length.toLocaleString()} / 12,000`;
  desc.addEventListener('input',updateCount); updateCount();

  function validateForm(){
    clearErrors(); let ok=true;
    const values={
      fullName:document.getElementById('fullName').value.trim(),
      phone:document.getElementById('phone').value.trim(),
      email:document.getElementById('email').value.trim(),
      projectType:document.getElementById('projectType').value,
      description:desc.value.trim()
    };
    if(values.fullName.length<2){setErr('fullName','Please enter your full name.');ok=false;}
    if(values.phone.replace(/\D/g,'').length<7){setErr('phone','Please enter a valid phone number.');ok=false;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)){setErr('email','Please enter a valid email address.');ok=false;}
    if(!values.projectType){setErr('projectType','Please select a project type.');ok=false;}
    if(values.description.length<10){setErr('description','Please include a short description of your project.');ok=false;}
    if(!validateFiles(true))ok=false;
    return {ok,values};
  }

  async function uploadWithProgress(url,file){
    const res=await fetch(url,{method:'PUT',headers:{'Content-Type':file.type},body:file});
    if(!res.ok) throw new Error(`Upload failed for ${file.name}.`);
  }

  async function submitProduction(values,files){
    if(!cfg.createEndpoint || !cfg.finalizeEndpoint) throw new Error('Estimate service is not configured yet. Please contact JVA Remodeling directly.');
    const payload={...values,website:document.getElementById('website').value,startedAt:Number(document.getElementById('startedAt').value),files:files.map(f=>({name:f.name,type:f.type,size:f.size}))};
    const create=await fetch(cfg.createEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const created=await create.json().catch(()=>({}));
    if(!create.ok) throw new Error(created.error||'Could not start the estimate request.');
    for(let i=0;i<files.length;i++) await uploadWithProgress(created.uploads[i].url,files[i]);
    const fin=await fetch(cfg.finalizeEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:created.requestId})});
    const done=await fin.json().catch(()=>({}));
    if(!fin.ok) throw new Error(done.error||'Could not finish the estimate request.');
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(submitBtn.disabled)return;
    const {ok,values}=validateForm(); if(!ok){message.textContent='Please review the highlighted fields.';message.className='form-message error-state';return;}
    if(document.getElementById('website').value) return;
    submitBtn.disabled=true; submitBtn.textContent='Sending…'; message.textContent=''; message.className='form-message';
    try{
      await submitProduction(values,currentFiles());
      form.hidden=true; successPanel.hidden=false; successPanel.focus();
    }catch(err){
      console.error(err); message.textContent=err.message||'Something went wrong. Please try again.';message.className='form-message error-state';
    }finally{
      submitBtn.disabled=false; submitBtn.textContent='Submit Request';
    }
  });
})();
