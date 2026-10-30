/* Campaigns use authenticated RPCs. All eligibility and reward decisions live in PostgreSQL. */
(() => {
 'use strict';
 const client=window.modokerClient;if(!client)return;
 const $=s=>document.querySelector(s);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const message=(selector,text,error=false)=>{const n=$(selector);if(n){n.replaceChildren(document.createTextNode(text));n.dataset.error=String(error);}};
 const errors={confirm_email:'Confirma tu correo antes de canjear el código.',invalid_code:'El código no es válido, ha vencido o está desactivado. Comprueba que sea del tipo correcto.',rate_limit:'Has realizado varios intentos. Espera 15 minutos antes de volver a intentarlo.',creator_already_redeemed:'Esta cuenta ya canjeó su código de creador. Solo se permite un canje, aunque cambies de creador o termine tu Plus.',own_code:'No puedes canjear tu propio código de creador.',code_exhausted:'Este código ya alcanzó su límite de canjes.'};
 const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error)throw error;return data;};
 const readable=e=>e?.code==='23505'?'Ese código ya existe. Elige otro.':e?.code==='22023'?'Revisa los campos. El creador debe tener una cuenta con correo confirmado.':e?.code==='42501'?'No tienes permiso para esta acción. Comprueba tu sesión y acceso.':'No pudimos conectar. Inténtalo de nuevo.';
 const disable=(form,busy)=>{form.setAttribute('aria-busy',String(busy));for(const n of form.querySelectorAll('button,input,select'))n.disabled=busy;};
 const date=x=>x?new Date(x).toLocaleDateString('es-CL'):'Sin vencimiento';
 let currentUser=null,sessionTicket=0,downloadAbort=null;
 async function member(){
  if(!$('#creator-customer')||!currentUser)return;
  try{
   const s=await rpc('modoker_campaign_status');const form=$('#creator-redeem');
   form.hidden=!!s.redeemed;
   message('#creator-status',s.redeemed?`Código de ${s.redeemed.label||'tu creador'} canjeado. ${s.launch_at?'Tu beneficio ya puede aplicarse a tu cuenta.':'Tu mes de Plus está reservado para el lanzamiento.'}`:'');
   const benefits=$('#creator-benefits');benefits.replaceChildren();
   for(const c of s.claims||[]){const n=el('p',`${c.months} ${c.months===1?'mes':'meses'} de Plus · ${c.kind==='creator_month'?'Código de creador':'Recompensa de creador'} · ${c.applied_at?'Aplicado hasta '+date(c.valid_until):'Reservado para el lanzamiento'}`,'campaign-result');benefits.append(n);}
   const progress=$('#creator-progress');progress.replaceChildren();
   for(const c of s.creator||[]){const box=el('article',undefined,'campaign-card');box.append(el('span','TU COMUNIDAD','eyebrow'),el('h3',c.label),el('p',`Tu código: ${c.code}`));const uses=Number(c.uses)||0,remaining=100-(uses%100);const bar=el('progress');bar.className='campaign-progress';bar.max=100;bar.value=uses%100;bar.setAttribute('aria-label',`${uses%100} de 100 canjes hacia tu próxima recompensa`);box.append(bar,el('p',`${uses} canjes · ${remaining} para recibir otros dos meses de Plus.`),el('p',`${Number(c.rewards)||0} meses de recompensa acumulados. Estos meses no suman timbres.`,'campaign-caption'));if(!c.active)box.append(el('p','Tu código está pausado.'));progress.append(box);}
  }catch(e){message('#creator-status',readable(e),true);}
 }
 $('#creator-redeem')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;disable(form,true);message('#creator-status','Comprobando tu código…');
  try{const r=await rpc('modoker_redeem_code',{p_code:form.elements.code.value.trim(),p_kind:'creator'});if(!r.ok){message('#creator-status',errors[r.error]||'No pudimos canjear el código.',true);return;}await member();if(currentUser){const account=await rpc('modoker_portal');window.dispatchEvent(new CustomEvent('modoker:account',{detail:{user:currentUser,account}}));}}
  catch(e){message('#creator-status',readable(e),true);}finally{disable(form,false);}
 });
 let earlyRelease=null;
 async function early(){
  if(!$('#early-access'))return;const auth=$('#early-auth'),form=$('#early-redeem');auth.replaceChildren();form.hidden=true;$('#early-ready').hidden=true;earlyRelease=null;
  if(!currentUser){auth.append(el('p','Inicia sesión o crea tu cuenta, confirma tu correo y vuelve aquí para usar tu invitación.'));const a=el('a','Ir a mi cuenta ↗','btn subtle');a.href='cuenta.html';auth.append(a);return;}
  if(!currentUser.email_confirmed_at){auth.append(el('p','Confirma el correo de tu cuenta para utilizar tu acceso anticipado.'));return;}
  form.hidden=false;
  try{const allowed=await rpc('modoker_early_allowed');if(!allowed)return;earlyRelease=await rpc('modoker_early_download');if(!earlyRelease){message('#early-status','Tu acceso está confirmado. Estamos preparando el instalador.');return;}form.hidden=true;$('#early-ready').hidden=false;$('#early-version').textContent=`Windows x64 · Instalador .exe · ${earlyRelease.version} · ${(earlyRelease.bytes/1048576).toFixed(1)} MB`;message('#early-status','Acceso confirmado. Ya puedes descargar tu instalador.');}
  catch(e){message('#early-status',readable(e),true);}
 }
 $('#early-redeem')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;disable(form,true);message('#early-status','Validando tu invitación…');
  try{const r=await rpc('modoker_redeem_code',{p_code:form.elements.code.value.trim(),p_kind:'early_access'});if(!r.ok){message('#early-status',errors[r.error]||'No pudimos validar la invitación.',true);return;}form.reset();await early();}catch(e){message('#early-status',readable(e),true);}finally{disable(form,false);}
 });
 const sha=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const sleep=(ms,signal)=>new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(t);reject(new DOMException('Cancelado','AbortError'));};const t=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});
 async function receive(url,part,signal){
  for(let attempt=0;attempt<3;attempt++){
   const timeout=new AbortController(),abort=()=>timeout.abort();signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>timeout.abort(),90000);
   try{if(signal.aborted)throw new DOMException('Cancelado','AbortError');const response=await fetch(url,{signal:timeout.signal,cache:'no-store',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('download');const b=await response.arrayBuffer();if(b.byteLength!==part.size||await sha(b)!==part.sha256.toLowerCase())throw Error('integrity');return b;}
   catch(e){if(signal.aborted||attempt===2)throw e;message('#early-status','La conexión se interrumpió. Reintentando la descarga…');await sleep(1000*(attempt+1),signal);}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
 }
 $('#early-cancel')?.addEventListener('click',()=>downloadAbort?.abort());
 $('#early-download')?.addEventListener('click',async()=>{
  if(downloadAbort||!earlyRelease)return;const control=new AbortController();downloadAbort=control;const button=$('#early-download');button.disabled=true;button.textContent='Descargando Modoker…';$('#early-cancel').hidden=false;
  const status=$('#early-status'),pulse=el('span',undefined,'download-pulse');pulse.setAttribute('aria-hidden','true');for(let i=0;i<3;i++)pulse.append(el('i'));status.replaceChildren(pulse,document.createTextNode('Preparando tu instalador…'));
  try{
   const r=await rpc('modoker_early_download');if(!r||!Array.isArray(r.objects)||!r.objects.length)throw Error('release');
   const {data:links,error}=await client.storage.from('modoker-early').createSignedUrls(r.objects.map(p=>p.name),600);if(error||links.some(l=>l.error||!l.signedUrl))throw error||Error('access');
   const pieces=new Array(r.objects.length);let next=0;
   await Promise.all(Array.from({length:Math.min(2,pieces.length)},async()=>{while(next<pieces.length){const i=next++;pieces[i]=await receive(links[i].signedUrl,r.objects[i],control.signal);}}));
   if(control.signal.aborted)throw new DOMException('Cancelado','AbortError');message('#early-status','Verificando tu instalador…');
   const blob=new Blob(pieces,{type:'application/octet-stream'});if(blob.size!==r.bytes||await sha(await blob.arrayBuffer())!==r.sha256.toLowerCase())throw Error('integrity');
   if(control.signal.aborted)throw new DOMException('Cancelado','AbortError');const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=r.filename;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('#early-status','Instalador verificado. Busca el archivo .exe en tus descargas.');
  }catch(e){control.abort();message('#early-status',e.name==='AbortError'?'Descarga cancelada. Puedes volver a intentarlo.':'La descarga no pudo completarse. Vuelve a intentarlo; no abriremos un archivo incompleto.',e.name!=='AbortError');}
  finally{downloadAbort=null;button.disabled=false;button.textContent='Descargar instalador ↗';$('#early-cancel').hidden=true;}
 });
 async function session(){const ticket=++sessionTicket;const {data,error}=await client.auth.getSession();if(ticket!==sessionTicket)return;currentUser=error?null:data?.session?.user;if(currentUser)await member();await early();}
 if($('#creator-customer')||$('#early-access')){session();client.auth.onAuthStateChange(()=>setTimeout(session,0));}
 window.addEventListener('modoker:account',e=>{if(e.detail?.user){currentUser=e.detail.user;member();}else if(!e.detail?.user){currentUser=null;$('#creator-progress')?.replaceChildren();}});
 // Administration is independently authenticated and authorized by every RPC.
 let adminBusy=false;
 async function adminLoad(){
  if(!$('#campaign-list'))return;
  try{const s=await rpc('modoker_admin_campaigns',{p_action:'list',p_payload:{}}),list=$('#campaign-list');list.replaceChildren();
   if(!s.codes.length)list.append(el('p','Todavía no hay códigos. Crea el primero para tu comunidad.'));
   for(const c of s.codes){const box=el('article',undefined,'campaign-card');box.append(el('span',c.kind==='creator'?'CREADOR':'ACCESO ANTICIPADO','eyebrow'),el('h3',c.label),el('span',c.active?'Activo':'Pausado','campaign-tag'),el('p',c.code?`Código: ${c.code}`:'Código privado: solo se muestra al crearlo.'),el('p',`${c.uses} de ${c.max_uses} canjes · ${date(c.expires_at)}`));if(c.owner_email)box.append(el('p',c.owner_email,'campaign-caption'));if(c.kind==='creator')box.append(el('p',`${c.reward_months} meses de recompensa · dos por cada 100 canjes.`));const toggle=el('button',c.active?'Pausar código':'Activar código','btn subtle');toggle.type='button';toggle.addEventListener('click',async()=>{toggle.disabled=true;try{await rpc('modoker_admin_campaigns',{p_action:'toggle',p_payload:{id:c.id,active:!c.active}});await adminLoad();message('#campaign-status','Estado del código actualizado.');}catch(e){message('#campaign-status',readable(e),true);}finally{toggle.disabled=false;}});box.append(toggle);list.append(box);}
   message('#campaign-launch-status',s.launch_at?`Lanzamiento iniciado el ${date(s.launch_at)}. Los beneficios se aplican al consultar cada cuenta.`:'Los beneficios están reservados. Todavía no se ha iniciado su vigencia.');$('#campaign-launch').hidden=!!s.launch_at;
  }catch(e){message('#campaign-status',readable(e),true);}
 }
 document.addEventListener('modoker:campaigns',adminLoad);$('#campaign-refresh')?.addEventListener('click',adminLoad);
 const create=$('#campaign-create');
 create?.elements.kind.addEventListener('change',()=>{const creator=create.elements.kind.value==='creator';$('#campaign-creator-fields').hidden=!creator;for(const key of ['code','owner_email']){create.elements[key].required=creator;create.elements[key].disabled=!creator;}create.elements.max_uses.value=creator?'1000':'10';});
 create?.addEventListener('submit',async event=>{
  event.preventDefault();if(adminBusy)return;adminBusy=true;const payload=Object.fromEntries(new FormData(create));payload.max_uses=Number(payload.max_uses);payload.expires_at=payload.expires_at?new Date(payload.expires_at).toISOString():null;disable(create,true);message('#campaign-status','Creando el código…');
  try{const r=await rpc('modoker_admin_campaigns',{p_action:'create',p_payload:payload});const result=$('#campaign-created');result.hidden=false;const input=el('input');input.className='campaign-code';input.readOnly=true;input.value=r.code;input.setAttribute('aria-label','Código creado');const copy=el('button','Copiar código','btn subtle');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(r.code);copy.textContent='Copiado';}catch{input.select();copy.textContent='Selecciona y copia el código';}});result.replaceChildren(el('strong',r.kind==='early_access'?'Guarda esta invitación: no volveremos a mostrar su código.':'Código de creador creado.'),input,copy);result.scrollIntoView({behavior:'smooth',block:'center'});await adminLoad();message('#campaign-status','Código creado correctamente.');}
  catch(e){message('#campaign-status',readable(e),true);}finally{disable(create,false);adminBusy=false;const creator=create.elements.kind.value==='creator';for(const key of ['code','owner_email'])create.elements[key].disabled=!creator;}
 });
 $('#campaign-launch')?.addEventListener('click',async event=>{
  if(!confirm('Esto inicia la vigencia de los beneficios reservados de toda la comunidad. ¿El lanzamiento de Modoker ya está listo?'))return;
  if(prompt('Escribe LANZAR para confirmar el inicio de los beneficios.')!=='LANZAR')return;
  const b=event.currentTarget;b.disabled=true;try{await rpc('modoker_admin_campaigns',{p_action:'launch',p_payload:{}});await adminLoad();message('#campaign-status','Beneficios del lanzamiento iniciados.');}catch(e){message('#campaign-status',readable(e),true);}finally{b.disabled=false;}
 });
})();
