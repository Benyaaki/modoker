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
 let currentUser=null,sessionTicket=0,downloadAbort=null,memberTicket=0;
 async function member(){
  if(!$('#creator-customer')||!currentUser)return;
  const ticket=++memberTicket,uid=currentUser.id;
  try{
   const s=await rpc('modoker_campaign_status');if(ticket!==memberTicket||currentUser?.id!==uid)return;const form=$('#creator-redeem');
   form.hidden=!!s.redeemed;
   message('#creator-status',s.redeemed?`Código de ${s.redeemed.label||'tu creador'} canjeado. ${s.launch_at?'Tu beneficio ya puede aplicarse a tu cuenta.':'Tu mes de Plus está reservado para el lanzamiento.'}`:'');
   const benefits=$('#creator-benefits');benefits.replaceChildren();
   for(const c of s.claims||[]){const n=el('p',`${c.months} ${c.months===1?'mes':'meses'} de Plus · ${c.kind==='creator_month'?'Código de creador':'Recompensa de creador'} · ${c.applied_at?'Aplicado hasta '+date(c.valid_until):'Reservado para el lanzamiento'}`,'campaign-result');benefits.append(n);}
   paintCommunity(s);

  }catch(e){message('#creator-status',readable(e),true);message('#creator-community-status',readable(e),true);}
 }
 $('#creator-redeem')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;disable(form,true);message('#creator-status','Comprobando tu código…');
  try{const r=await rpc('modoker_redeem_code',{p_code:form.elements.code.value.trim(),p_kind:'creator'});if(!r.ok){message('#creator-status',errors[r.error]||'No pudimos canjear el código.',true);return;}await member();if(currentUser){const account=await rpc('modoker_portal');document.dispatchEvent(new CustomEvent('modoker:account',{detail:{user:currentUser,account}}));}}
  catch(e){message('#creator-status',readable(e),true);}finally{disable(form,false);}
 });

 const count=n=>new Intl.NumberFormat('es-CL').format(Number(n)||0);
 function metrics(target,items){const box=$(target);if(!box)return;box.replaceChildren();for(const [label,value,note]of items){const card=el('article',undefined,'creator-metric');card.append(el('span',label),el('strong',count(value)));if(note)card.append(el('small',note));box.append(card);}}
 function chart(target,rows){
  const root=$(target);if(!root)return;root.replaceChildren();if(!rows?.length){root.append(el('p','Aún no hay datos para este período.'));return;}
  const max=Math.max(1,...rows.map(r=>Number(r.count)||0)),total=rows.reduce((n,r)=>n+Number(r.count||0),0);
  root.append(el('p',total?`${count(total)} canjes en este período.`:'Cuando se produzca el primer canje, lo verás aquí.','campaign-caption'));
  const plot=el('div',undefined,'creator-bars');plot.setAttribute('role','img');plot.setAttribute('aria-label',`Canjes diarios durante 30 días. Total: ${count(total)}. El detalle se encuentra debajo.`);
  for(const r of rows){const bar=el('div',undefined,'creator-bar');bar.title=`${date(r.date+'T12:00:00')}: ${count(r.count)} canjes`;const fill=el('i');fill.style.height=`${Math.max(1,Number(r.count)/max*100)}%`;if(!Number(r.count))fill.className='empty';bar.append(fill);plot.append(bar);}root.append(plot);
  const axis=el('div',undefined,'creator-chart-axis');axis.append(el('span',date(rows[0].date+'T12:00:00')),el('span',date(rows[rows.length-1].date+'T12:00:00')));root.append(axis);
  const details=el('details',undefined,'creator-chart-details');details.append(el('summary','Ver detalle por día'));const table=el('table');const head=el('tr');head.append(el('th','Fecha'),el('th','Canjes'));const thead=el('thead');thead.append(head);table.append(thead);const body=el('tbody');for(const r of rows){const tr=el('tr');tr.append(el('td',date(r.date+'T12:00:00')),el('td',count(r.count)));body.append(tr);}table.append(body);details.append(table);root.append(details);
 }
 function clearCommunity(){
  ++memberTicket;for(const key of ['#creator-community-nav','#creator-role-badge','#creator-community-content'])if($(key))$(key).hidden=true;
  $('#creator-progress')?.replaceChildren();
  const panel=$('[data-member-panel="community"]');if(panel&&!panel.hidden){panel.hidden=true;const fallback=$('[data-member-panel="overview"]');if(fallback)fallback.hidden=false;for(const n of document.querySelectorAll('[data-member-view]'))n.setAttribute('aria-pressed',String(n.dataset.memberView==='overview'));}
 }
 function paintCommunity(s){
  const creator=s.is_creator===true;for(const key of ['#creator-community-nav','#creator-role-badge','#creator-community-content'])if($(key))$(key).hidden=!creator;
  if(!creator){clearCommunity();return;}
  const codes=s.creator||[],uses=codes.reduce((n,c)=>n+Number(c.uses||0),0),rewards=codes.reduce((n,c)=>n+Number(c.rewards||0),0),last30=(s.daily||[]).reduce((n,d)=>n+Number(d.count||0),0);
  metrics('#creator-community-metrics',[['Canjes de tu comunidad',uses,'Cuentas con correo confirmado'],['Últimos 30 días',last30,'Canjes, no visitas'],['Meses ganados',rewards,s.launch_at?'Tus hitos de creador':'Reservados para el lanzamiento']]);
  message('#creator-community-status',codes.length?'Datos actualizados. Gracias por ayudar a que más personas conozcan Modoker.':'Ya eres creador. El equipo todavía debe asignarte tu código para que puedas compartirlo.');
  const progress=$('#creator-progress');progress.replaceChildren();
  for(const c of codes){
   const box=el('article',undefined,'campaign-card creator-code-card'),uses=Number(c.uses)||0,remaining=100-(uses%100),expired=c.expires_at&&new Date(c.expires_at)<=new Date();
   box.append(el('span','CÓDIGO DE TU COMUNIDAD','eyebrow'),el('h3',c.label));const code=el('div',undefined,'creator-share-code');code.append(el('code',c.code));const copy=el('button','Copiar código','btn subtle');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(c.code);copy.textContent='Copiado';}catch{message('#creator-community-status','Selecciona el código y cópialo para compartirlo.');}});code.append(copy);box.append(code,el('span',expired?'Vencido':c.active?'Activo':'Pausado','campaign-tag'));
   const bar=el('progress');bar.className='campaign-progress';bar.max=100;bar.value=uses%100;bar.setAttribute('aria-label',`${uses%100} de 100 canjes hacia tu próxima recompensa`);box.append(bar,el('p',`${count(remaining)} canjes para tus próximos dos meses de Plus.`));
   const milestones=el('div',undefined,'creator-milestones');milestones.append(el('span',`${count(uses)} canjes totales`),el('strong',`${count(c.rewards)} meses ganados`));box.append(milestones,el('p',`Próximo hito: ${count((Math.floor(uses/100)+1)*100)} canjes. ${s.launch_at?'Beneficios aplicables a tu cuenta.':'Tus meses comenzarán desde el lanzamiento.'}`,'campaign-caption'));
   if(Number(c.max_uses)<(Math.floor(uses/100)+1)*100)box.append(el('p','El límite actual del código no alcanza el siguiente hito. Contacta con el equipo para revisar su ampliación.','campaign-caption'));
   if(!c.active||expired)box.append(el('p','Este código no admite nuevos canjes por ahora. Los anteriores se conservan.','campaign-caption'));
   progress.append(box);
  }
  chart('#creator-community-chart',s.daily||[]);
 }
 $('#creator-community-refresh')?.addEventListener('click',async event=>{const b=event.currentTarget;b.disabled=true;message('#creator-community-status','Actualizando tu comunidad…');try{await member();}finally{b.disabled=false;}});
 $('#creator-community-nav')?.addEventListener('click',member);
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
 async function session(){const ticket=++sessionTicket;const {data,error}=await client.auth.getSession();if(ticket!==sessionTicket)return;currentUser=error?null:data?.session?.user;if(currentUser)await member();else clearCommunity();await early();}
 if($('#creator-customer')||$('#early-access')){session();client.auth.onAuthStateChange(()=>setTimeout(session,0));}
 document.addEventListener('modoker:account',e=>{if(e.detail?.user){currentUser=e.detail.user;member();}else if(!e.detail?.user){currentUser=null;clearCommunity();}});
 // Administration is independently authenticated and authorized by every RPC.
 let adminBusy=false;
 let creatorRows=[];
 let adminTicket=0;

 function renderCreatorRows(){
  const list=$('#creator-admin-list');if(!list)return;list.replaceChildren();const query=($('#creator-admin-search')?.value||'').trim().toLocaleLowerCase();
  const rows=creatorRows.filter(c=>`${c.name} ${c.email}`.toLocaleLowerCase().includes(query));
  if(!rows.length){list.append(el('p',creatorRows.length?'No encontramos creadores con esa búsqueda.':'Aún no has asignado creadores. Empieza por una cuenta con correo confirmado.'));return;}
  for(const c of rows){const box=el('article',undefined,'campaign-card');box.append(el('span',c.active?'CREADOR ACTIVO':'ROL PAUSADO','eyebrow'),el('h3',c.name||'Creador'),el('p',c.email),el('p',`${count(c.codes)} códigos · ${count(c.uses)} canjes · ${count(c.reward_months)} meses ganados.`),el('p',`Rol asignado el ${date(c.assigned_at)}.`,'campaign-caption'));const toggle=el('button',c.active?'Pausar rol de creador':'Reactivar rol de creador','btn subtle');toggle.type='button';toggle.addEventListener('click',async()=>{if(c.active&&!confirm('Se ocultará Mi comunidad y se pausarán sus códigos. Los canjes y beneficios ya ganados se conservarán. ¿Continuar?'))return;toggle.disabled=true;try{await rpc('modoker_admin_creators',{p_action:'toggle',p_payload:{user_id:c.user_id,active:!c.active}});await adminLoad();message('#creator-admin-status',c.active?'Rol pausado. Sus códigos también quedaron pausados.':'Rol reactivado. Revisa qué códigos quieres activar en la pestaña Códigos.');}catch(e){message('#creator-admin-status',readable(e),true);}finally{toggle.disabled=false;}});box.append(toggle);list.append(box);}
 }
 $('#creator-admin-search')?.addEventListener('input',renderCreatorRows);
 document.querySelectorAll('[data-campaign-tab]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.campaignTab;for(const b of document.querySelectorAll('[data-campaign-tab]'))b.setAttribute('aria-pressed',String(b===button));for(const panel of document.querySelectorAll('[data-campaign-section]'))panel.hidden=panel.dataset.campaignSection!==key;}));
 $('#creator-assign')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,email=form.elements.email.value.trim();disable(form,true);message('#creator-admin-status','Asignando rol…');try{await rpc('modoker_admin_creators',{p_action:'assign',p_payload:{email}});await adminLoad();message('#creator-admin-status','Rol asignado. La persona verá Mi comunidad al actualizar su cuenta. Ahora puedes crear y asociarle un código.');form.reset();}catch(e){message('#creator-admin-status',readable(e),true);}finally{disable(form,false);}});
 async function adminLoad(){
  if(!$('#campaign-list'))return;
  const ticket=++adminTicket;message('#campaign-status','Actualizando códigos y métricas…');
  try{const [s,community]=await Promise.all([rpc('modoker_admin_campaigns',{p_action:'list',p_payload:{}}),rpc('modoker_admin_creators',{p_action:'list',p_payload:{}})]);if(ticket!==adminTicket)return;const list=$('#campaign-list');list.replaceChildren();
   const m=community.metrics||{};metrics('#campaign-admin-metrics',[['Creadores registrados',m.creators,`${count(m.active_creators)} con rol activo`],['Códigos de creador',m.creator_codes,`${count(m.active_codes)} admiten nuevos canjes`],['Canjes confirmados',m.redemptions,`${count(m.last30)} en los últimos 30 días`],['Meses para creadores',m.reward_months,'Dos por cada hito de 100 canjes'],['Accesos anticipados',m.early_grants,'Invitaciones canjeadas y no revocadas']]);chart('#campaign-admin-chart',community.daily||[]);creatorRows=community.creators||[];renderCreatorRows();fillCreatorPicker();
   if(!s.codes.length)list.append(el('p','Todavía no hay códigos. Crea el primero para tu comunidad.'));
   for(const c of s.codes){const box=el('article',undefined,'campaign-card');box.append(el('span',c.kind==='creator'?'CREADOR':'ACCESO ANTICIPADO','eyebrow'),el('h3',c.label),el('span',c.active?'Activo':'Pausado','campaign-tag'),el('p',c.code?`Código: ${c.code}`:'Código privado: solo se muestra al crearlo.'),el('p',`${c.uses} de ${c.max_uses} canjes · ${date(c.expires_at)}`));if(c.owner_email)box.append(el('p',c.owner_email,'campaign-caption'));if(c.kind==='creator')box.append(el('p',`${c.reward_months} meses de recompensa · dos por cada 100 canjes.`));const toggle=el('button',c.active?'Pausar código':'Activar código','btn subtle');toggle.type='button';const role=creatorRows.find(r=>r.email===c.owner_email);if(c.kind==='creator'&&role&&!role.active){toggle.disabled=true;box.append(el('p','Reactiva primero el rol en la pestaña Creadores.','campaign-caption'));}toggle.addEventListener('click',async()=>{toggle.disabled=true;try{await rpc('modoker_admin_campaigns',{p_action:'toggle',p_payload:{id:c.id,active:!c.active}});await adminLoad();message('#campaign-status','Estado del código actualizado.');}catch(e){message('#campaign-status',readable(e),true);}finally{toggle.disabled=false;}});box.append(toggle);list.append(box);}
   message('#campaign-launch-status',s.launch_at?`Lanzamiento iniciado el ${date(s.launch_at)}. Los beneficios se aplican al consultar cada cuenta.`:'Los beneficios están reservados. Todavía no se ha iniciado su vigencia.');$('#campaign-launch').hidden=!!s.launch_at;message('#campaign-status','Datos actualizados.');
  }catch(e){message('#campaign-status',readable(e),true);}
 }
 document.addEventListener('modoker:campaigns',adminLoad);$('#campaign-refresh')?.addEventListener('click',adminLoad);
 function fillCreatorPicker(){
  const form=$('#campaign-create');if(!form)return;const select=form.elements.creator_id,selected=select.value;
  select.replaceChildren(el('option','Elige un creador registrado'));select.firstElementChild.value='';
  for(const c of creatorRows.filter(c=>c.active)){const option=el('option',`${c.name||'Creador'} · ${c.email}`);option.value=c.user_id;select.append(option);}
  if([...select.options].some(o=>o.value===selected))select.value=selected;
  applyCreatorChoice();
 }
 function applyCreatorChoice(){const form=$('#campaign-create');if(!form||form.elements.kind.value!=='creator')return;const c=creatorRows.find(c=>c.user_id===form.elements.creator_id.value&&c.active);form.elements.owner_email.value=c?.email||'';form.elements.label.value=(c?.name||c?.email||'').slice(0,100);}
 $('#campaign-go-creators')?.addEventListener('click',()=>{document.querySelector('[data-campaign-tab="creators"]')?.click();const form=$('#creator-assign');if(form){form.closest('details').open=true;form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.email.focus({preventScroll:true});}});
 const create=$('#campaign-create');
 create?.elements.creator_id.addEventListener('change',applyCreatorChoice);
 create?.elements.kind.addEventListener('change',()=>{const creator=create.elements.kind.value==='creator';$('#campaign-creator-fields').hidden=!creator;$('#campaign-owner-picker').hidden=!creator;$('#campaign-label-field').hidden=creator;create.elements.label.required=!creator;create.elements.creator_id.required=creator;create.elements.creator_id.disabled=!creator;for(const key of ['code','owner_email']){create.elements[key].required=creator;create.elements[key].disabled=!creator;}create.elements.max_uses.value=creator?'1000':'10';if(creator)applyCreatorChoice();else create.elements.label.value='';});
 create?.addEventListener('submit',async event=>{
  event.preventDefault();if(adminBusy)return;adminBusy=true;const payload=Object.fromEntries(new FormData(create));delete payload.creator_id;payload.max_uses=Number(payload.max_uses);payload.expires_at=payload.expires_at?new Date(payload.expires_at).toISOString():null;disable(create,true);message('#campaign-status','Creando el código…');
  try{const r=await rpc('modoker_admin_campaigns',{p_action:'create',p_payload:payload});const result=$('#campaign-created');result.hidden=false;const input=el('input');input.className='campaign-code';input.readOnly=true;input.value=r.code;input.setAttribute('aria-label','Código creado');const copy=el('button','Copiar código','btn subtle');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(r.code);copy.textContent='Copiado';}catch{input.select();copy.textContent='Selecciona y copia el código';}});result.replaceChildren(el('strong',r.kind==='early_access'?'Guarda esta invitación: no volveremos a mostrar su código.':'Código de creador creado.'),input,copy);result.scrollIntoView({behavior:'smooth',block:'center'});await adminLoad();message('#campaign-status','Código creado correctamente.');}
  catch(e){message('#campaign-status',readable(e),true);}finally{disable(create,false);adminBusy=false;const creator=create.elements.kind.value==='creator';for(const key of ['code','owner_email','creator_id'])create.elements[key].disabled=!creator;}
 });
 $('#campaign-launch')?.addEventListener('click',async event=>{
  if(!confirm('Esto inicia la vigencia de los beneficios reservados de toda la comunidad. ¿El lanzamiento de Modoker ya está listo?'))return;
  if(prompt('Escribe LANZAR para confirmar el inicio de los beneficios.')!=='LANZAR')return;
  const b=event.currentTarget;b.disabled=true;try{await rpc('modoker_admin_campaigns',{p_action:'launch',p_payload:{}});await adminLoad();message('#campaign-status','Beneficios del lanzamiento iniciados.');}catch(e){message('#campaign-status',readable(e),true);}finally{b.disabled=false;}
 });
})();
