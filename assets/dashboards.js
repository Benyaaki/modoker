(() => {
 'use strict';
 const client=window.modokerClient;if(!client)return;
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
 const fmt=v=>new Intl.NumberFormat('es-CL').format(num(v));
 const date=v=>v?new Intl.DateTimeFormat(window.ModokerI18n?.locale()||'es-CL',{dateStyle:'medium',timeZone:'America/Santiago'}).format(new Date(v)):'—';
 const dateTime=v=>v?new Intl.DateTimeFormat(window.ModokerI18n?.locale()||'es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(v)):'—';
 const text=(s,v)=>{const el=$(s);if(el)el.textContent=v;};
 function el(tag,content,cls){const e=document.createElement(tag);if(content!==undefined)e.textContent=content;if(cls)e.className=cls;return e;}
 function download(data,name,type='application/json'){const blob=new Blob([data],{type});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function csvCell(v){let s=String(v??'');if(/^\s*[=+@\-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
 const csv=rows=>'\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
 function selectView(prefix,key){
  const available=$$(`[data-${prefix}-panel]`);if(!available.some(x=>x.dataset[prefix+'Panel']===key))return;
  available.forEach(x=>x.hidden=x.dataset[prefix+'Panel']!==key);
  $$(`[data-${prefix}-view]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[prefix+'View']===key)));
  // A shorter panel must not leave the viewport at the old panel's footer.
  const heading=prefix==='admin'?$('#admin-section-title'):available.find(x=>!x.hidden)?.querySelector('h2,h3');
  if(heading){
   const frame=heading.closest('.dashboard-content')||heading.parentElement;
   if(frame)frame.style.overflowAnchor='none';
   requestAnimationFrame(()=>{
    if(!heading.isConnected)return;
    heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});
    const header=$('.site-header'),offset=(header?.getBoundingClientRect().bottom||0)+24;
    const top=Math.max(0,window.scrollY+heading.getBoundingClientRect().top-Math.max(110,offset));
    window.scrollTo({top,behavior:'instant'});
   });
  }

 }
 $$('[data-member-view]').forEach(b=>b.addEventListener('click',()=>selectView('member',b.dataset.memberView)));
 $$('[data-member-jump]').forEach(b=>b.addEventListener('click',()=>selectView('member',b.dataset.memberJump)));
 let user=null,account=null,accountBusy=false;
 const feedback=(message,error=false)=>{text('#account-feedback',message);$('#account-feedback')?.setAttribute('data-error',String(error));};
 function paintAccount(detail){
  user=detail.user;account=detail.account;
  if(!$('#auth-member'))return;
  if(!accountBusy)$('#profile-name').value=user.user_metadata?.display_name||'';
  text('#member-id',user.id);text('#member-since',date(user.created_at));text('#member-verified',user.email_confirmed_at?'Confirmado.':'Por confirmar.');
  text('#pending-email',user.new_email?`Cambio pendiente a ${user.new_email}. Revisa tus correos.`:'');
  text('#plan-detail-name',account.plus?'Plus.':'Gratis.');
  text('#plan-detail-description',account.plus?'Tu cuenta tiene acceso Plus. Puedes usar perfiles adicionales y variantes en la app.':'La app local está disponible sin suscripción.');
  const entitlement=account.entitlement;
  const labels={active:'Activo',pending:'Pendiente',cancelled:'Cancelado',expired:'Vencido'};
  text('#plan-state',entitlement?(entitlement.state==='active'&&!account.plus?'Vencido':labels[entitlement.state]||'Por revisar'):'Plan gratuito');
  text('#plan-source',entitlement?.source==='mercadopago'?'Mercado Pago':entitlement?.source==='loyalty'?'Tarjeta de timbres':entitlement?.source==='manual'?'Acceso manual':'Sin suscripción');
  text('#plan-until',entitlement?date(entitlement.valid_until):'Sin vencimiento para el uso gratuito');
  const request=account.requests?.find(r=>['pending','processing'].includes(r.state));
  text('#delete-request-state',request?`${request.state==='pending'?'Solicitud pendiente':'Solicitud en revisión'} · ${date(request.created_at)}`:'No tienes solicitudes pendientes.');
  $('#cancel-delete-request').hidden=request?.state!=='pending';
  $('#delete-request-form button[type=submit]').disabled=!!request;
  $('#delete-confirm').disabled=!!request;
 }
 document.addEventListener('modoker:account',e=>paintAccount(e.detail));
 document.addEventListener('modoker:language-change',()=>{if(user&&account){const before=accountBusy;accountBusy=true;try{paintAccount({user,account});}finally{accountBusy=before;}}});
 if(window.modokerAccountState)paintAccount(window.modokerAccountState);
 document.addEventListener('modoker:session',e=>{if(!e.detail.signedIn){user=null;account=null;document.body.classList.remove('member-view');$('#auth-member')?.setAttribute('hidden','');}});
 function messageFor(error){
  if(error?.code==='invalid_credentials')return 'La contraseña actual no es correcta.';
  if(error?.code==='same_password')return 'Elige una contraseña diferente de la actual.';
  if(error?.code==='PGRST202')return 'Esta gestión necesita completar su configuración. Inténtalo más adelante.';
  if(error?.code==='P0001')return 'Antes de solicitar la eliminación debes transferir la administración a otra cuenta.';
  if(error?.code==='over_email_send_rate_limit')return 'Espera unos minutos antes de solicitar otro correo.';
  if(error?.code==='email_exists')return 'No pudimos usar ese correo. Revisa la dirección e inténtalo nuevamente.';
  if(/fetch|network/i.test(error?.message||''))return 'No pudimos conectar. Revisa tu conexión.';
  return 'No pudimos completar el cambio. Revisa los datos e inténtalo nuevamente.';
 }
 async function action(form,task){
  if(accountBusy)return;if(form&&!form.reportValidity())return;
  accountBusy=true;const buttons=form?[...form.querySelectorAll('button')]:[];buttons.forEach(b=>b.disabled=true);feedback('Guardando…');
  try{await task();}catch(error){feedback(messageFor(error),true);}
  finally{accountBusy=false;buttons.forEach(b=>b.disabled=false);if(user&&account)paintAccount({user,account});}
 }
 async function verifiedUser(){const r=await client.auth.getUser();if(r.error||!r.data.user)throw r.error||Error('No session');return r.data.user;}
 async function reauthenticate(password){const current=await verifiedUser();const result=await client.auth.signInWithPassword({email:current.email,password});if(result.error)throw result.error;if(result.data.user.id!==current.id)throw Error('Identity mismatch');return result.data.user;}
 $('#profile-form')?.addEventListener('submit',e=>{e.preventDefault();const name=$('#profile-name').value.trim().slice(0,80);action(e.currentTarget,async()=>{const result=await client.auth.updateUser({data:{display_name:name}});if(result.error)throw result.error;user=result.data.user;feedback('Nombre actualizado.');});});
 $('#email-change-form')?.addEventListener('submit',e=>{e.preventDefault();const email=$('#new-email').value.trim(),password=$('#email-password').value;action(e.currentTarget,async()=>{await reauthenticate(password);const result=await client.auth.updateUser({email},{emailRedirectTo:new URL('cuenta.html',location.href).href});if(result.error)throw result.error;user=result.data.user;$('#email-change-form').reset();feedback('Revisa los enlaces enviados a tus correos. El cambio se completará al confirmarlos.');}).finally(()=>{$('#email-password').value='';});});
 $('#password-change-form')?.addEventListener('submit',e=>{e.preventDefault();const current=$('#current-password').value,password=$('#new-password').value;if(password!==$('#repeat-new-password').value){feedback('Las nuevas contraseñas no coinciden.',true);return;}action(e.currentTarget,async()=>{await reauthenticate(current);const result=await client.auth.updateUser({password});if(result.error)throw result.error;$('#password-change-form').reset();const out=await client.auth.signOut({scope:'global'});if(out.error){feedback('Contraseña actualizada. No pudimos revocar las sesiones; vuelve a intentarlo desde Seguridad.',true);return;}feedback('Contraseña actualizada. Vuelve a iniciar sesión.');const status=$('#auth-status');if(status)status.textContent='Contraseña actualizada. Vuelve a iniciar sesión.';}).finally(()=>{$('#current-password').value='';$('#new-password').value='';$('#repeat-new-password').value='';});});
 $('#sign-out-everywhere')?.addEventListener('click',()=>action(null,async()=>{const result=await client.auth.signOut({scope:'global'});if(result.error)throw result.error;feedback('Sesiones revocadas. Los accesos emitidos caducan según su vigencia.');}));
 $$('[data-account-theme]').forEach(button=>button.addEventListener('click',()=>{document.documentElement.dataset.theme=button.dataset.accountTheme;try{localStorage.setItem('modoker-web-theme',button.dataset.accountTheme);}catch{}updateTheme();}));
 function updateTheme(){$$('[data-account-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.accountTheme===document.documentElement.dataset.theme)));}
 new MutationObserver(updateTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});updateTheme();
 $('#export-account')?.addEventListener('click',()=>action(null,async()=>{
  const current=await verifiedUser();const portal=await client.rpc('modoker_portal');if(portal.error)throw portal.error;
  const data={exported_at:new Date().toISOString(),profile:{id:current.id,email:current.email,display_name:current.user_metadata?.display_name||'',created_at:current.created_at,email_confirmed_at:current.email_confirmed_at},plan:{plus:portal.data.plus,entitlement:portal.data.entitlement||null},loyalty:portal.data.loyalty||null,privacy_requests:portal.data.requests||[]};
  download(JSON.stringify(data,null,2),'modoker-mis-datos.json');feedback('Tu archivo está preparado. Revisa las descargas del navegador.');
 }));
 $('#delete-request-form')?.addEventListener('submit',e=>{e.preventDefault();if($('#delete-confirm').value!=='ELIMINAR')return;action(e.currentTarget,async()=>{const result=await client.rpc('modoker_privacy_request',{p_action:'request'});if(result.error)throw result.error;account=result.data;$('#delete-confirm').value='';feedback('Solicitud registrada. Tu cuenta sigue activa mientras se revisa.');});});
 $('#cancel-delete-request')?.addEventListener('click',()=>action(null,async()=>{const result=await client.rpc('modoker_privacy_request',{p_action:'cancel'});if(result.error)throw result.error;account=result.data;feedback('Retiraste la solicitud de eliminación.');}));

 const root=$('#admin-root');if(!root)return;
 let adminGeneration=0,view='overview',days=30,page=0,search='',filter='all',confirmed='all',directory=[],total=0,report=null,canAdmin=false,listGeneration=0;
 const notice=message=>text('#admin-notice',message);
 function deny(){canAdmin=false;adminGeneration++;root.hidden=true;$('#private-unavailable').hidden=false;document.title='Modoker';}
 document.addEventListener('modoker:session',e=>{if(!e.detail.signedIn)deny();});
 const titles={campaigns:['Códigos que conectan.','Acceso anticipado, creadores y beneficios de tu comunidad.'],analytics:['Entiende qué conecta.','Visitas, secciones e interacciones de la web.'],team:['Tu equipo.','Personas con acceso a gestión. Solo administradores principales pueden cambiar el equipo.'],overview:['Una mirada a todo.','Tu comunidad y sus próximos cambios.'],community:['Las personas primero.','Encuentra una cuenta y revisa su estado.'],downloads:['Cada descarga cuenta.','Del primer clic al archivo verificado.'],plan:['Un plan para cada quien.','Accesos gratuitos, Plus y suscripciones.'],requests:['Escuchar también es cuidar.','Solicitudes de privacidad, con seguimiento.'],activity:['Cada cambio, en su lugar.','Un registro de las gestiones realizadas.']};
 function setView(key){if(!canAdmin)return;view=key;selectView('admin',key);text('#admin-section-title',titles[key][0]);text('#admin-section-description',titles[key][1]);$('#admin-period').hidden=!['overview','downloads','plan','analytics'].includes(key);if(key==='campaigns')document.dispatchEvent(new CustomEvent('modoker:campaigns'));if(key==='analytics')document.dispatchEvent(new CustomEvent('modoker:analytics'));if(key==='community')loadDirectory();if(key==='requests')loadRequests();if(key==='activity')loadAudit();if(key==='plan')document.dispatchEvent(new CustomEvent('modoker:financials'));}
 $$('[data-admin-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.adminView)));
 $$('[data-admin-jump]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.adminJump)));
 const svgNS='http://www.w3.org/2000/svg';
 function svgNode(tag,attrs={},content){const e=document.createElementNS(svgNS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(content!==undefined)e.textContent=content;return e;}
 function plot(container,values,keys,colors){
  container.replaceChildren();if(!values?.length){container.append(el('p','El historial necesita completar su configuración.','data-empty'));return;}
  const w=640,h=190,left=30,right=10,top=12,bottom=30,max=Math.max(1,...values.flatMap(v=>keys.map(k=>num(v[k])))),plotW=w-left-right,plotH=h-top-bottom;
  const svg=svgNode('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':keys.length===1?'Registros diarios del periodo seleccionado':'Descargas iniciadas y verificadas por día'});
  for(let n=0;n<3;n++){const y=top+plotH*n/2;svg.append(svgNode('path',{d:`M${left} ${y}H${w-right}`,stroke:'currentColor',opacity:'.12',fill:'none'}));svg.append(svgNode('text',{x:left-7,y:y+3,'text-anchor':'end',class:'chart-axis'},fmt(Math.round(max*(1-n/2)))));}
  const groupW=plotW/values.length,barW=Math.max(1,groupW*.66/keys.length);
  values.forEach((v,i)=>keys.forEach((key,j)=>{const count=num(v[key]),height=count/max*plotH;const bar=svgNode('rect',{x:left+i*groupW+groupW*.17+j*barW,y:top+plotH-height,width:Math.max(.6,barW-1),height:height||1,rx:Math.min(3,barW/3),fill:colors[j],opacity:count?'1':'.18',class:'chart-bar'});bar.append(svgNode('title',{},`${String(v.day).slice(0,10)} · ${key==='registrations'?'Registros':key==='started'?'Iniciadas':'Verificadas'}: ${fmt(count)}`));svg.append(bar);}));
  [...new Set([0,Math.floor((values.length-1)/2),values.length-1])].forEach(i=>{svg.append(svgNode('text',{x:left+(i+.5)*groupW,y:h-7,'text-anchor':'middle',class:'chart-axis'},String(values[i].day).slice(5,10).split('-').reverse().join('/')));});
  container.append(svg);
  const details=el('details'),summary=el('summary','Ver los datos del gráfico');details.className='chart-data';details.append(summary);
  const table=el('table');const head=el('tr');['Fecha',...keys.map(k=>k==='registrations'?'Registros':k==='started'?'Iniciadas':'Verificadas')].forEach(x=>head.append(el('th',x)));table.append(head);
  values.forEach(v=>{const row=el('tr');row.append(el('td',String(v.day).slice(0,10)));keys.forEach(k=>row.append(el('td',fmt(v[k]))));table.append(row);});details.append(table);container.append(details);
 }
 function metrics(overview){
  $$('[data-metric]').forEach(e=>e.textContent=fmt(overview[e.dataset.metric]));const all=num(overview.users),plus=num(overview.plus),free=num(overview.free),share=all?Math.min(100,plus/all*100):0;
  text('#plus-ratio',all?`${Math.round(share)}%`:'—');$('#plan-ring').style.setProperty('--share',share+'%');$('#plan-ring').style.background=all?'':'var(--line)';$('#plan-ring').setAttribute('aria-label',`${fmt(free)} cuentas gratuitas y ${fmt(plus)} con acceso Plus`);
  $('#free-plan-bar').style.width=(all?free/all*100:0)+'%';$('#plus-plan-bar').style.width=share+'%';
 }
 async function refresh(){
  const generation=++adminGeneration;notice('Actualizando…');
  try{
   const identity=await client.auth.getUser();if(identity.error||!identity.data.user){deny();return;}
   const overview=await client.rpc('modoker_admin_overview');if(generation!==adminGeneration)return;if(overview.error){deny();return;}
   canAdmin=true;root.hidden=false;$('#private-unavailable').hidden=true;document.title='Tu centro — Modoker';metrics(overview.data);
   const result=await client.rpc('modoker_admin_report',{p_days:days});if(generation!==adminGeneration)return;
   if(result.error){report=null;notice('Los nuevos históricos y gestiones necesitan aplicar la actualización de la base de datos. Los totales actuales ya están conectados.');}
   else{report=result.data;metrics(report.overview);notice('');}
   plot($('#registrations-chart'),report?.daily,['registrations'],['#f2f77c']);plot($('#downloads-chart'),report?.daily,['started','verified'],['#287bf1','#dce766']);
   text('#chart-period-caption',report?`${days} días · datos diarios`:'Historial por configurar');text('#pending-request-count',report?fmt(report.pending_requests):'—');text('#admin-updated','Actualizado '+new Intl.DateTimeFormat(window.ModokerI18n?.locale()||'es-CL',{hour:'2-digit',minute:'2-digit'}).format(new Date()));
   const versions=$('#download-versions');versions.replaceChildren();for(const v of report?.versions||[]){const row=el('tr');[v.release,fmt(v.started),fmt(v.verified),num(v.started)?`${Math.round(num(v.verified)/num(v.started)*100)}%`:'—'].forEach(value=>row.append(el('td',value)));versions.append(row);}if(!versions.children.length)emptyRow(versions,4,report?'Todavía no hay descargas registradas.':'Historial pendiente de configurar.');
   setView(view);document.dispatchEvent(new CustomEvent('modoker:dashboard-ready'));
  }catch{if(!canAdmin)deny();else notice('No pudimos actualizar los datos. Conservamos la última consulta.');}
 }
 function emptyRow(body,count,message){const row=el('tr'),cell=el('td',message);cell.colSpan=count;row.append(cell);body.append(row);}
 let selectedPersonId=null;
 async function loadDirectoryUnsafe(){
  const generation=++listGeneration;const body=$('#admin-users');text('#directory-count','Consultando…');
  const result=await client.rpc('modoker_admin_directory',{p_search:search,p_filter:filter,p_confirmed:confirmed,p_offset:page*20});if(generation!==listGeneration||!canAdmin)return;
  if(result.error){body.replaceChildren();emptyRow(body,6,'Completa la actualización de la base de datos para consultar este módulo.');text('#directory-count','Consulta no disponible');return;}
  directory=result.data.rows;total=num(result.data.total);body.replaceChildren();
  for(const person of directory){const row=el('tr'),who=el('td'),wrap=el('div',undefined,'person-cell'),initial=el('span',(person.display_name||person.email||'?').slice(0,1).toUpperCase(),'person-initial'),name=el('div',person.display_name||'Sin nombre');name.append(el('small',person.blocked?'Bloqueada':person.admin?'Equipo':'Cuenta'));wrap.append(initial,name);who.append(wrap);row.append(who);
   const mail=el('td',person.email);mail.append(el('small',person.confirmed?' · Confirmado':' · Pendiente'));row.append(mail);const plan=el('td');plan.append(el('span',person.plus?'Plus':'Gratis','status-pill'+(person.plus?' plus':'')));row.append(plan,el('td',dateTime(person.last_sign_in_at)),el('td',date(person.created_at)));
   const actions=el('td'),button=el('button','Ver detalle ↗','row-detail-button');button.type='button';button.addEventListener('click',()=>showPerson(person));actions.append(button);row.append(actions);body.append(row);
  }
  if(selectedPersonId){const selected=directory.find(p=>p.id===selectedPersonId);if(selected)showPerson(selected,false);else{selectedPersonId=null;$('#directory-detail').hidden=true;}}
  if(!directory.length)emptyRow(body,6,'No encontramos cuentas con estos filtros.');text('#directory-count',`${fmt(total)} ${total===1?'persona':'personas'} · ${directory.length?'mostrando '+(page*20+1)+'–'+(page*20+directory.length):'sin resultados'}`);text('#admin-page',`Página ${page+1}`);$('#admin-prev').disabled=page===0;$('#admin-next').disabled=(page+1)*20>=total;
 }
 function showPerson(person,move=true){selectedPersonId=person.id;const detail=$('#directory-detail');detail.replaceChildren();detail.hidden=false;detail.append(el('h3',person.display_name||person.email));const dl=el('dl',undefined,'definition-list');const data=[['Correo',person.email],['Identificador',person.id],['Plan',person.plus?'Plus':'Gratis'],['Origen del acceso',person.source==='manual'?'Prueba manual':person.source==='mercadopago'?'Mercado Pago':'Sin suscripción'],['Vigencia',date(person.valid_until)],['Último ingreso',dateTime(person.last_sign_in_at)]];for(const [k,v]of data){const row=el('div');row.append(el('dt',k),el('dd',v));dl.append(row);}detail.append(dl);document.dispatchEvent(new CustomEvent('modoker:person',{detail:person}));if(move){detail.setAttribute('tabindex','-1');requestAnimationFrame(()=>{detail.focus({preventScroll:true});detail.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});}}
 $('#admin-search-form').addEventListener('submit',e=>{e.preventDefault();selectedPersonId=null;$('#directory-detail').hidden=true;search=$('#admin-search').value.trim();filter=$('#admin-filter').value;confirmed=$('#admin-confirmed').value;page=0;loadDirectory();});
 $('#admin-prev').addEventListener('click',()=>{page=Math.max(0,page-1);loadDirectory();});$('#admin-next').addEventListener('click',()=>{page++;loadDirectory();});
 $('#export-directory').addEventListener('click',()=>{if(!directory.length)return;const rows=[['Nombre','Correo','Plan','Confirmado','Registro','Último ingreso'],...directory.map(p=>[p.display_name,p.email,p.plus?'Plus':'Gratis',p.confirmed?'Sí':'No',p.created_at,p.last_sign_in_at])];download(csv(rows),'modoker-comunidad-pagina-'+(page+1)+'.csv','text/csv;charset=utf-8');});
 const requestLabels={pending:'Pendiente',processing:'En revisión',cancelled:'Retirada',completed:'Completada'};
 async function loadRequestsUnsafe(){
  const result=await client.rpc('modoker_admin_requests');if(!canAdmin)return;const body=$('#privacy-requests');body.replaceChildren();if(result.error){emptyRow(body,5,'Este módulo necesita completar su configuración.');return;}
  for(const request of result.data){const row=el('tr');[request.email||'Cuenta eliminada','Eliminación de cuenta',requestLabels[request.state]||request.state,dateTime(request.created_at)].forEach(v=>row.append(el('td',v)));const actions=el('td');const detail=el('button','Ver detalle ↗','row-detail-button');detail.type='button';detail.addEventListener('click',()=>window.ModokerAudit.openRequest(request.id));actions.append(detail);if(request.state==='pending'){const button=el('button','Iniciar revisión ↗','row-detail-button');button.addEventListener('click',async()=>{button.disabled=true;const r=await client.rpc('modoker_admin_review_request',{p_id:request.id});if(r.error){notice('No pudimos actualizar la solicitud.');button.disabled=false;}else{notice('Solicitud en revisión. No se ha eliminado la cuenta.');loadRequests();}});actions.append(button);}row.append(actions);body.append(row);}
  if(!result.data.length)emptyRow(body,5,'No hay solicitudes registradas.');
 }
 async function loadAuditUnsafe(){const result=await client.rpc('modoker_admin_audit');if(!canAdmin)return;const timeline=$('#admin-audit');timeline.replaceChildren();if(result.error){timeline.append(el('p','Este módulo necesita completar su configuración.','data-empty'));return;}
  const labels=window.ModokerAudit.labels;
  for(const event of result.data){const row=el('article',undefined,'audit-event'),content=el('div');content.append(el('strong',labels[event.action]||'Otra gestión administrativa'),el('p',`${event.actor_email||'Cuenta eliminada'}${event.target_email&&event.target_email!==event.actor_email?' → '+event.target_email:''}`));const detail=el('button','Ver detalle ↗','row-detail-button');detail.type='button';detail.addEventListener('click',()=>window.ModokerAudit.openEvent(event.id));content.append(detail);row.append(el('i'),content,el('time',dateTime(event.created_at)));timeline.append(row);}if(!result.data.length)timeline.append(el('p','Las próximas gestiones aparecerán aquí.','data-empty'));
 }
 function loadDirectory(){return loadDirectoryUnsafe().catch(()=>{text('#directory-count','No pudimos consultar las cuentas. Vuelve a intentarlo.');});}
 function loadRequests(){return loadRequestsUnsafe().catch(()=>notice('No pudimos consultar las solicitudes. Vuelve a intentarlo.'));}
 function loadAudit(){return loadAuditUnsafe().catch(()=>notice('No pudimos consultar la actividad. Vuelve a intentarlo.'));}
 $('#admin-period').addEventListener('change',()=>{days=Number($('#admin-period').value);refresh();});$('#admin-refresh').addEventListener('click',refresh);
 refresh();
})();
