'use strict';
const {onRequest} = require('firebase-functions/v2/https');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {defineSecret, defineString} = require('firebase-functions/params');
const admin = require('firebase-admin');
const archiver = require('archiver');
const nodemailer = require('nodemailer');
const path = require('path');

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const GMAIL_USER = defineString('GMAIL_USER', {default: 'jvaremodeling1599@gmail.com'});
const ADMIN_EMAIL = defineString('ADMIN_EMAIL', {default: 'jvaremodeling1599@gmail.com'});
const ALLOWED_ORIGIN = defineString('ALLOWED_ORIGIN', {default: 'https://jvaremodeling.com'});
const REGION='us-central1';
const MAX_FILES=10, MAX_IMAGE=10*1024*1024, MAX_VIDEO=50*1024*1024, MAX_TOTAL=100*1024*1024;
const ALLOWED_TYPES=new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime']);
const SEVEN_DAYS_MS=7*24*60*60*1000;

function cors(req,res){
  const origin=req.get('origin')||'';
  const configured=ALLOWED_ORIGIN.value().replace(/\/$/,'');
  const allowedOrigins=new Set([
    configured,
    configured.replace('https://','https://www.'),
    'https://jva-remodeling.web.app',
    'https://jva-remodeling.firebaseapp.com'
  ]);
  const allowed=allowedOrigins.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if(allowed) res.set('Access-Control-Allow-Origin',origin);
  res.set('Vary','Origin');
  res.set('Access-Control-Allow-Headers','Content-Type');
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  if(req.method==='OPTIONS'){res.status(204).send('');return true;}
  if(origin && !allowed){res.status(403).json({error:'Origin not allowed.'});return true;}
  return false;
}
function cleanText(v,max){return String(v||'').trim().slice(0,max)}
function safeName(name,index){
  const ext=path.extname(name).toLowerCase().slice(0,10);
  const stem=path.basename(name,ext).replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,70)||'file';
  return `${String(index+1).padStart(2,'0')}-${stem}${ext}`;
}
function validate(body){
  const fullName=cleanText(body.fullName,120), phone=cleanText(body.phone,40), email=cleanText(body.email,180), projectType=cleanText(body.projectType,80), description=cleanText(body.description,12000);
  if(body.website) throw new Error('Invalid request.');
  if(fullName.length<2)throw new Error('Full name is required.');
  if(phone.replace(/\D/g,'').length<7)throw new Error('Valid phone is required.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Valid email is required.');
  if(!projectType)throw new Error('Project type is required.');
  if(description.length<10)throw new Error('Project description is required.');
  const startedAt=Number(body.startedAt||0); if(!startedAt || Date.now()-startedAt<750)throw new Error('Please try again.');
  if(body.files!=null && !Array.isArray(body.files))throw new Error('Invalid file list.');
  const files=body.files||[]; if(files.length>MAX_FILES)throw new Error('Maximum 10 files.');
  let total=0;
  const checked=files.map((f,i)=>{if(!f||typeof f!=='object')throw new Error('Invalid file details.');const name=cleanText(f.name,160),type=cleanText(f.type,100),size=Number(f.size);if(!ALLOWED_TYPES.has(type))throw new Error(`Unsupported file type: ${name}`);const max=type.startsWith('video/')?MAX_VIDEO:MAX_IMAGE;if(!Number.isSafeInteger(size)||size<=0||size>max)throw new Error(`Invalid file size: ${name}`);total+=size;return {name,type,size,safeName:safeName(name,i)};});
  if(total>MAX_TOTAL)throw new Error('Combined upload exceeds 100 MB.');
  return {fullName,phone,email,projectType,description,files:checked};
}
async function makeUploadUrl(objectPath,contentType){
  const [url]=await bucket.file(objectPath).getSignedUrl({version:'v4',action:'write',expires:Date.now()+15*60*1000,contentType}); return url;
}

exports.createEstimateRequest = onRequest({region:REGION,timeoutSeconds:60,memory:'256MiB'},async(req,res)=>{
  if(cors(req,res))return; if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
  let data;
  try{data=validate(req.body||{});}catch(e){return res.status(400).json({error:'Please check the form and file details, then try again.'});}
  try{
    const ref=db.collection('estimateRequests').doc(), requestId=ref.id, expiresAt=admin.firestore.Timestamp.fromMillis(Date.now()+SEVEN_DAYS_MS);
    const files=[];
    for(const f of data.files){const objectPath=`estimate-requests/${requestId}/uploads/${f.safeName}`;files.push({...f,objectPath,url:await makeUploadUrl(objectPath,f.type)});}
    await ref.set({fullName:data.fullName,phone:data.phone,email:data.email,projectType:data.projectType,description:data.description,status:'uploading',createdAt:admin.firestore.FieldValue.serverTimestamp(),expiresAt,files:files.map(({url,...f})=>f)});
    res.json({requestId,uploads:files.map(f=>({name:f.name,url:f.url}))});
  }catch(e){console.error(e);res.status(500).json({error:'We could not start your request right now. Please try again.'});}
});

async function createZip(requestId,files){
  if(!files.length)return null;
  const zipPath=`estimate-requests/${requestId}/JVA-Estimate-${requestId}.zip`, zipFile=bucket.file(zipPath);
  await new Promise((resolve,reject)=>{
    const output=zipFile.createWriteStream({metadata:{contentType:'application/zip'}}), archive=archiver('zip',{zlib:{level:6}});
    output.on('finish',resolve); output.on('error',reject); archive.on('error',reject); archive.pipe(output);
    files.forEach(f=>archive.append(bucket.file(f.objectPath).createReadStream(),{name:f.safeName})); archive.finalize();
  });
  const expiresAtMs=Date.now()+SEVEN_DAYS_MS;
  const [url]=await zipFile.getSignedUrl({version:'v4',action:'read',expires:expiresAtMs,responseDisposition:`attachment; filename="JVA-Estimate-${requestId}.zip"`});
  return {zipPath,url,expiresAtMs};
}
async function sendEmail(record,downloadUrl){
  const user=GMAIL_USER.value();
  const pass=GMAIL_APP_PASSWORD.value();
  const to=ADMIN_EMAIL.value();
  if(!user || !pass || !to) throw new Error('Gmail email service is not configured.');
  const safe=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const submittedAt=record.createdAt?.toDate?.()||new Date();
  const submittedTime=new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Chicago'}).format(submittedAt);
  const files=record.files||[];
  const fileDetails=files.length?`<ul>${files.map(f=>`<li>${safe(f.name)} (${(Number(f.size)/1024/1024).toFixed(1)} MB)</li>`).join('')}</ul>`:'<p>No files were uploaded.</p>';
  const html=`<h2>New JVA Remodeling estimate request</h2><p><b>Customer Name:</b> ${safe(record.fullName)}</p><p><b>Phone:</b> ${safe(record.phone)}</p><p><b>Customer Email:</b> ${safe(record.email)}</p><p><b>Project Type:</b> ${safe(record.projectType)}</p><p><b>Date / Time (Chicago):</b> ${safe(submittedTime)}</p><p><b>Project Description:</b><br>${safe(record.description).replace(/\n/g,'<br>')}</p><p><b>Uploaded Files:</b> ${files.length}</p>${fileDetails}${downloadUrl?`<p><a href="${downloadUrl}">Download project files as ZIP</a> (available for about 7 days)</p>`:''}`;
  const transporter=nodemailer.createTransport({service:'gmail',auth:{user,pass}});
  await transporter.sendMail({
    from:`JVA Remodeling Website <${user}>`,
    to,
    replyTo:record.email,
    subject:`New Estimate Request — ${record.fullName}`,
    html
  });
}

exports.finalizeEstimateRequest = onRequest({region:REGION,timeoutSeconds:540,memory:'1GiB',secrets:[GMAIL_APP_PASSWORD]},async(req,res)=>{
  if(cors(req,res))return; if(req.method!=='POST')return res.status(405).json({error:'Method not allowed.'});
  const requestId=cleanText(req.body?.requestId,80);
  if(!/^[A-Za-z0-9_-]{10,}$/.test(requestId))return res.status(400).json({error:'Invalid request ID.'});
  const ref=db.collection('estimateRequests').doc(requestId);
  let claimed=false;
  try{
    const claim=await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)return {missing:true};
      const record=snap.data();
      if(record.status==='complete')return {complete:true};
      if(record.status==='processing' && Date.now()-(record.processingStartedAt?.toMillis?.()||0)<10*60*1000)return {processing:true};
      tx.update(ref,{status:'processing',processingStartedAt:admin.firestore.FieldValue.serverTimestamp()});
      return {record};
    });
    if(claim.missing)return res.status(404).json({error:'Request not found.'});
    if(claim.complete)return res.json({ok:true});
    if(claim.processing)return res.status(409).json({error:'Your request is already being processed. Please try again shortly.'});
    claimed=true;
    const record=claim.record;
    for(const f of record.files||[]){const [exists]=await bucket.file(f.objectPath).exists();if(!exists)throw new Error(`Missing upload: ${f.name}`);const [meta]=await bucket.file(f.objectPath).getMetadata();if(Number(meta.size)!==Number(f.size))throw new Error(`Upload size mismatch: ${f.name}`);if(meta.contentType!==f.type)throw new Error(`Upload type mismatch: ${f.name}`);}
    const retentionFloorMs=Math.max(record.expiresAt?.toMillis?.()||0,Date.now()+SEVEN_DAYS_MS);
    await ref.update({expiresAt:admin.firestore.Timestamp.fromMillis(retentionFloorMs)});
    const zip=await createZip(requestId,record.files||[]);
    const expiresAtMs=Math.max(retentionFloorMs,zip?.expiresAtMs||Date.now()+SEVEN_DAYS_MS);
    await ref.update({expiresAt:admin.firestore.Timestamp.fromMillis(expiresAtMs),zipPath:zip?.zipPath||null});
    await sendEmail(record,zip?.url||'');
    await ref.update({status:'complete',finalizedAt:admin.firestore.FieldValue.serverTimestamp()}); res.json({ok:true});
  }catch(e){
    console.error(e);
    if(claimed){try{await ref.update({status:'uploading'});}catch(resetError){console.error('Could not release estimate request',resetError);}}
    res.status(500).json({error:'We could not complete your request right now. Please try again.'});
  }
});

exports.cleanupExpiredEstimates = onSchedule({schedule:'every day 03:15',timeZone:'America/Chicago',region:REGION,timeoutSeconds:540,memory:'512MiB'},async()=>{
  const now=admin.firestore.Timestamp.now(); const snap=await db.collection('estimateRequests').where('expiresAt','<=',now).limit(250).get();
  for(const doc of snap.docs){try{await bucket.deleteFiles({prefix:`estimate-requests/${doc.id}/`});await doc.ref.delete();}catch(e){console.error('cleanup failed',doc.id,e);}}
});
