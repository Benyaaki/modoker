/* Campaigns use authenticated RPCs. All eligibility and reward decisions live in PostgreSQL. */
(() => {
 'use strict';
 const client=window.modokerClient;if(!client)return;
 const $=s=>document.querySelector(s);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const message=(selector,text,error=false)=>{const n=$(selector);if(n){n.replaceChildren(document.createTextNode(text));n.dataset.error=String(error);}};
 const errors={confirm_email:'Confirma tu correo antes de canjear el código.',invalid_code:'El código no es válido, ha vencido o está desactivado. Comprueba que sea del tipo correcto.',rate_limit:'Has realizado varios intentos. Espera 15 minutos antes de volver a intentarlo.',creator_already_redeemed:'Esta cuenta ya canjeó su código de creador. Solo se permite un canje, aunque cambies de creador o termine tu Plus.',own_code:'No puedes canjear tu propio código de creador.',code_exhausted:'Este código ya alcanzó su límite de canjes.'};
 const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error)throw error;return data;};
 const editErrors={'Campaign changed; reload':'Este código cambió desde que lo abriste. Recarga sus datos antes de guardar.','Limit below existing redemptions':'El límite no puede ser menor que los canjes ya realizados.','Cannot transfer redeemed code':'Un código con canjes no puede reasignarse a otro creador.','Creator role paused':'Reactiva el rol del creador antes de activar su código.','Invalid code format':'Usa de 3 a 64 letras, números o guiones para el código.','Campaign not found':'No encontramos ese código. Actualiza la lista.'};
 const readable=e=>editErrors[e?.message]||(e?.code==='23505'?'Ese código ya existe. Elige otro.':e?.code==='22023'?'Revisa los campos. El creador debe tener una cuenta con correo confirmado.':e?.code==='42501'?'No tienes permiso para esta acción. Comprueba tu sesión y acceso.':'No pudimos conectar. Inténtalo de nuevo.');
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
 let creatorRows=[],campaignRows=[],codePage=0,selectedCampaign=null,editBusy=false;
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
   campaignRows=s.codes||[];renderCodeRows();
   message('#campaign-launch-status',s.launch_at?`Lanzamiento iniciado el ${date(s.launch_at)}. Los beneficios se aplican al consultar cada cuenta.`:'Los beneficios están reservados. Todavía no se ha iniciado su vigencia.');$('#campaign-launch').hidden=!!s.launch_at;message('#campaign-status','Datos actualizados.');return true;
  }catch(e){message('#campaign-status',readable(e),true);return false;}
 }
 document.addEventListener('modoker:campaigns',adminLoad);$('#campaign-refresh')?.addEventListener('click',adminLoad);

 function codeState(c){if(!c.active)return 'paused';if(c.expires_at&&new Date(c.expires_at)<=new Date())return 'expired';if(Number(c.uses)>=Number(c.max_uses))return 'exhausted';return 'active';}
 const codeStates={active:'Activo',paused:'Pausado',expired:'Vencido',exhausted:'Agotado'};
 function renderCodeRows(){
  const list=$('#campaign-list');if(!list)return;list.replaceChildren();const q=($('#campaign-search')?.value||'').trim().toLocaleUpperCase(),kind=$('#campaign-filter-kind')?.value||'all',state=$('#campaign-filter-state')?.value||'all';
  const rows=campaignRows.filter(c=>(kind==='all'||c.kind===kind)&&(state==='all'||codeState(c)===state)&&`${c.code||''} ${c.label} ${c.owner_email||''}`.toLocaleUpperCase().includes(q));
  const pages=Math.max(1,Math.ceil(rows.length/15));codePage=Math.min(codePage,pages-1);message('#campaign-list-count',`${count(rows.length)} códigos · ${count(campaignRows.length)} en total`);
  if(!rows.length)list.append(el('p',campaignRows.length?'No hay códigos que coincidan con estos filtros.':'Todavía no hay códigos. Empieza desde Nuevo código.','campaign-caption'));
  for(const c of rows.slice(codePage*15,codePage*15+15)){
   const row=el('article',undefined,'code-row'),main=el('div',undefined,'code-row-main');main.append(el('strong',c.code||c.label),el('span',c.kind==='creator'?`${c.label} · ${c.owner_email||'Sin creador'}`:'Invitación privada · acceso anticipado'));
   const usage=el('div',undefined,'code-row-usage');usage.append(el('strong',`${count(c.uses)} / ${count(c.max_uses)}`),el('span','canjes'));
   const status=el('div',undefined,'code-row-status');status.append(el('span',codeStates[codeState(c)],`campaign-tag code-state-${codeState(c)}`),el('small',c.expires_at?`Hasta ${date(c.expires_at)}`:'Sin vencimiento'));
   const edit=el('button','Editar ↗','btn subtle');edit.type='button';edit.dataset.editCampaign=c.id;edit.setAttribute('aria-label',`Editar ${c.code||c.label}`);edit.addEventListener('click',()=>openEditor(c.id));row.append(main,usage,status,edit);list.append(row);
  }
  $('#campaign-previous').disabled=codePage===0;$('#campaign-next').disabled=codePage>=pages-1;message('#campaign-page',`${codePage+1} / ${pages}`);
 }
 for(const key of ['#campaign-search','#campaign-filter-kind','#campaign-filter-state'])$(key)?.addEventListener(key==='#campaign-search'?'input':'change',()=>{codePage=0;renderCodeRows();});
 $('#campaign-previous')?.addEventListener('click',()=>{codePage=Math.max(0,codePage-1);renderCodeRows();});$('#campaign-next')?.addEventListener('click',()=>{codePage++;renderCodeRows();});
 const localDate=iso=>{if(!iso)return '';const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
 function openEditor(id,focus=true){
  if(editBusy)return;const c=campaignRows.find(c=>c.id===id);if(!c)return;selectedCampaign=c;const panel=$('#campaign-editor'),form=$('#campaign-edit'),creator=c.kind==='creator';panel.hidden=false;form.reset();
  message('#campaign-editor-kind',creator?'CÓDIGO DE CREADOR':'INVITACIÓN PRIVADA');message('#campaign-editor-title',c.code||c.label);message('#campaign-editor-summary',`${count(c.uses)} canjes registrados${creator?` · ${count(c.reward_months)} meses ganados por el creador`:''}. Los datos acumulados se conservan al editar.`);
  form.elements.label.value=c.label;form.elements.active.value=String(c.active);form.elements.code.value=c.code||'';form.elements.code.required=creator;form.elements.max_uses.value=c.max_uses;form.elements.max_uses.min=Math.max(1,Number(c.uses)||0);form.elements.expires_at.value=localDate(c.expires_at);form.elements.expires_at.dataset.originalValue=form.elements.expires_at.value;
  form.elements.owner_id.replaceChildren();for(const person of creatorRows){const option=el('option',`${person.name||'Creador'} · ${person.email}${person.active?'':' · rol pausado'}`);option.value=person.user_id;form.elements.owner_id.append(option);}
  const owner=c.owner_id||creatorRows.find(r=>r.email===c.owner_email)?.user_id;if(owner&&!Array.from(form.elements.owner_id.options).some(o=>o.value===owner)){const option=el('option',c.owner_email||'Creador asociado');option.value=owner;form.elements.owner_id.append(option);}form.elements.owner_id.value=owner||'';
  form.elements.owner_id.disabled=!creator||Number(c.uses)>0;$('#campaign-edit-owner-field').hidden=!creator;$('#campaign-edit-regenerate-field').hidden=creator;form.elements.regenerate.disabled=creator;
  message('#campaign-edit-code-note',creator?'Si cambias el código, el anterior dejará de admitir canjes. El progreso y las recompensas siguen asociados a esta campaña. Con canjes registrados no se puede cambiar el creador.':'Por seguridad no recuperamos el código privado anterior. Deja el campo vacío para conservarlo o escribe uno nuevo. También puedes generar una nueva invitación. Los accesos ya concedidos se conservan.');
  message('#campaign-edit-status','');if(focus){panel.scrollIntoView({behavior:'smooth',block:'start'});panel.focus({preventScroll:true});}
 }
 function closeEditor(){if(editBusy)return;const id=selectedCampaign?.id;$('#campaign-editor').hidden=true;selectedCampaign=null;document.querySelector(`[data-edit-campaign="${id}"]`)?.focus({preventScroll:true});}
 $('#campaign-editor-close')?.addEventListener('click',closeEditor);$('#campaign-edit-cancel')?.addEventListener('click',closeEditor);
 $('#campaign-edit [name=regenerate]')?.addEventListener('change',event=>{const field=$('#campaign-edit').elements.code;field.disabled=event.currentTarget.checked;if(field.disabled)field.value='';});
 $('#campaign-edit')?.addEventListener('submit',async event=>{
  event.preventDefault();if(editBusy||!selectedCampaign)return;const form=event.currentTarget,c=selectedCampaign,payload=Object.fromEntries(new FormData(form));payload.expected_updated_at=c.updated_at;payload.max_uses=Number(payload.max_uses);payload.active=payload.active==='true';payload.regenerate=form.elements.regenerate.checked;payload.expires_at=form.elements.expires_at.value===form.elements.expires_at.dataset.originalValue?c.expires_at:(payload.expires_at?new Date(payload.expires_at).toISOString():null);if(!payload.owner_id)delete payload.owner_id;
  editBusy=true;disable(form,true);$('#campaign-editor-close').disabled=true;message('#campaign-edit-status','Guardando los cambios…');
  try{
   const result=await rpc('modoker_admin_update_campaign',{p_id:c.id,p_payload:payload});const refreshed=await adminLoad();editBusy=false;if(refreshed)openEditor(c.id,false);
   message('#campaign-status','Código actualizado. Se conservaron sus canjes y beneficios.');message('#campaign-edit-status',refreshed?'Cambios guardados.':'Cambios guardados. No pudimos recargar el detalle; actualiza los datos antes de volver a editar.');
   if(c.kind==='early_access'&&result.new_code){const output=el('div',undefined,'campaign-result');output.append(el('strong','Guarda tu nueva invitación; no volverá a mostrarse.'));const field=el('input');field.className='campaign-code';field.readOnly=true;field.value=result.new_code;field.setAttribute('aria-label','Nueva invitación privada');const copy=el('button','Copiar invitación','btn subtle');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(result.new_code);copy.textContent='Copiada';}catch{field.select();}});output.append(field,copy);$('#campaign-edit-status').append(output);}
  }catch(e){message('#campaign-edit-status',readable(e),true);if(e.code==='40001'){const reload=el('button','Recargar datos del código','btn subtle');reload.type='button';reload.addEventListener('click',async()=>{if(await adminLoad())openEditor(c.id,false);});$('#campaign-edit-status').append(reload);}}
  finally{editBusy=false;disable(form,false);$('#campaign-editor-close').disabled=false;if(selectedCampaign){form.elements.owner_id.disabled=selectedCampaign.kind!=='creator'||Number(selectedCampaign.uses)>0;form.elements.regenerate.disabled=selectedCampaign.kind==='creator';form.elements.code.disabled=form.elements.regenerate.checked;}}
 });
 // Normalize the actual value, including pasted text, without moving the caret to the end.
 for(const field of document.querySelectorAll('#campaign-create [name=code],#campaign-edit [name=code],#creator-redeem [name=code],#early-redeem [name=code]')){
  field.autocapitalize='characters';field.spellcheck=false;field.classList.add('uppercase-code');const normalize=event=>{if(event.isComposing)return;const start=field.selectionStart,end=field.selectionEnd,value=field.value,upper=value.toUpperCase();if(value===upper)return;field.value=upper;if(start!==null)field.setSelectionRange(value.slice(0,start).toUpperCase().length,value.slice(0,end).toUpperCase().length);};field.addEventListener('input',normalize);field.addEventListener('compositionend',normalize);
 }
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
