/* Public client configuration. No administrative secrets belong in this file. */
(() => {
 'use strict';
 const status=document.querySelector('#auth-status');
 const say=(text,error=false)=>{if(status){status.textContent=text;status.dataset.error=String(error);}};
 if(!window.supabase){say('No pudimos cargar el acceso. Recarga la página.',true);return;}
 const management=document.body.dataset.page==='admin.html';
 // Desktop email confirmation links must not replace this browser's personal session.
 const callbackHash=new URLSearchParams(location.hash.slice(1));
 const desktopEmailConfirmation=callbackHash.get('type')==='email_change'&&callbackHash.has('access_token');
 if(desktopEmailConfirmation)history.replaceState(null,'',location.pathname+location.search);

 const client=window.supabase.createClient('https://oemzrgvcmzxmljhvcafj.supabase.co','sb_publishable_W8ap7mBjhhJxPny3tWRwyA_xgWB1uvb',{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storage:management?sessionStorage:localStorage,storageKey:management?'modoker-management-v1':'modoker-auth-v1'}
 });
 window.modokerClient=client;
 const form=document.querySelector('#access-form'), area=document.querySelector('#auth-guest'), member=document.querySelector('#auth-member');
 const field=id=>document.querySelector(id), callback=new URL('cuenta.html',location.href).href;
 let restoreTicket=0,lastRefresh=0;
 let mode=location.hash==='#registro'?'register':'login',busy=false,recovering=false,renderId=0;
 function setMode(next){
  mode=next;say('');
  const register=mode==='register',reset=mode==='reset',update=mode==='update';
  document.querySelectorAll('[data-access]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.access===mode));b.disabled=busy;});
  document.querySelectorAll('.access-register').forEach(el=>el.hidden=!register);
  if(!form)return;
  field('#password-row').hidden=reset;field('#confirm-row').hidden=!(register||update);
  field('#email-row').hidden=update;
  field('#access-email').required=!update;field('#access-email').disabled=update;
  field('#access-password').required=!reset;field('#access-password').disabled=reset;
  field('#access-password').minLength=register||update?8:1;
  field('#access-password').autocomplete=register||update?'new-password':'current-password';
  field('#access-confirm').required=register||update;field('#access-confirm').disabled=!(register||update);
  field('#access-name').required=false;field('#access-name').disabled=!register;
  field('#forgot-password').hidden=reset||update;field('#back-login').hidden=!(reset||update);
  field('#access-title').textContent=register?'Hazlo tuyo.':reset?'Vuelve a entrar.':update?'Una nueva llave.':'Qué bueno verte.';
  field('#access-description').textContent=register?'Crea tu cuenta y confirma tu correo.':reset?'Te enviaremos un enlace para recuperar tu acceso.':update?'Elige una contraseña nueva para tu cuenta.':'Vuelve a tu espacio de Modoker.';
  field('#access-submit').textContent=register?'Crear mi cuenta ↗':reset?'Enviar enlace ↗':update?'Guardar contraseña ↗':'Iniciar sesión ↗';
 }
 const errors={invalid_credentials:'Correo o contraseña incorrectos.',email_not_confirmed:'Confirma tu correo antes de iniciar sesión.',user_already_exists:'Revisa tu correo o intenta iniciar sesión.',over_email_send_rate_limit:'Espera unos minutos antes de solicitar otro correo.',over_request_rate_limit:'Demasiados intentos. Espera un momento y vuelve a probar.',weak_password:'Usa una contraseña más segura, de al menos 8 caracteres.',signup_disabled:'El registro está temporalmente deshabilitado.',otp_expired:'El enlace venció o ya fue utilizado. Solicita otro.',validation_failed:'Revisa el correo y los campos del formulario.'};
 function explain(error){return errors[error?.code]||(/fetch|network/i.test(error?.message||'')?'No pudimos conectar. Revisa tu conexión e inténtalo otra vez.':'No pudimos completar la operación. Inténtalo nuevamente.');}
 async function render(session){
  const ticket=++renderId;
  document.querySelectorAll('.account-link').forEach(a=>{a.setAttribute('aria-label',session?'Mi cuenta':'Iniciar sesión o registrarse');a.title=session?'Mi cuenta':'Iniciar sesión o registrarse';a.dataset.signedIn=String(!!session);});
  document.querySelectorAll('.drawer-account').forEach(el=>{el.querySelector('a').textContent=session?'Mi cuenta ↗':'Iniciar sesión ↗';el.querySelector('a[href*=registro]').hidden=!!session;});
  if(!form)return;
  if(!session||recovering){window.modokerAccountState=null;area.hidden=false;member.hidden=true;document.body.classList.remove('member-view');return;}
  area.hidden=true;member.hidden=false;document.body.classList.add('member-view');field('#member-name').textContent='Tu espacio.';
  field('#member-email').textContent='Verificando tu cuenta…';field('#member-plan').textContent='Consultando';field('#admin-link').hidden=true;
  const {data,error}=await client.auth.getUser();if(ticket!==renderId)return;
  if(error||!data.user){window.modokerAccountState=null;
   if(error&&![401,403].includes(error.status)&&!['session_not_found','refresh_token_not_found','refresh_token_already_used','bad_jwt'].includes(error.code)){
    member.hidden=true;area.hidden=true;showRestore('Tu sesión está guardada. No pudimos verificarla por ahora. Reintenta cuando tengas conexión.');return;
   }
   document.body.classList.remove('member-view');area.hidden=false;member.hidden=true;say('Tu sesión ya no es válida. Inicia sesión nuevamente.',true);return;}
  hideRestore();
  field('#member-name').textContent=data.user.user_metadata?.display_name?`Hola, ${data.user.user_metadata.display_name}.`:'Tu espacio.';
  field('#member-email').textContent=data.user.email||'';
  let result=await client.rpc('modoker_portal');if(result.error?.code==='PGRST202')result=await client.rpc('modoker_account');if(ticket!==renderId)return;
  if(result.error){field('#member-plan').textContent='Por configurar';field('#member-note').textContent='Tu cuenta está activa. Estamos preparando la información del plan.';return;}
  const account=result.data;field('#member-plan').textContent=account.plus?'Plus':'Gratis';
  field('#member-note').textContent=account.plus?'Acceso Plus asociado a tu cuenta. Puedes usar perfiles adicionales y variantes en la app.':'La aplicación local sigue disponible sin suscripción.';
  field('#admin-link').hidden=true;window.modokerAccountState={user:data.user,account};document.dispatchEvent(new CustomEvent('modoker:account',{detail:{user:data.user,account}}));
 }
 client.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'){recovering=true;setMode('update');}
  if(event==='SIGNED_OUT'){recovering=false;document.querySelectorAll('input[type=password]').forEach(input=>input.value='');setMode('login');}
  // Supabase callbacks must return synchronously; defer other client calls.
  setTimeout(()=>restore().catch(()=>showRestore('No pudimos verificar tu sesión. Puedes reintentar.')),0);
 });
 document.querySelectorAll('[data-access]').forEach(b=>b.addEventListener('click',()=>{if(!busy){recovering=false;setMode(b.dataset.access);}}));
 field('#forgot-password')?.addEventListener('click',()=>setMode('reset'));
 field('#back-login')?.addEventListener('click',async()=>{if(recovering){await client.auth.signOut({scope:'local'});recovering=false;}setMode('login');});
 field('#toggle-password')?.addEventListener('click',e=>{const input=field('#access-password'),show=input.type==='password';input.type=show?'text':'password';e.currentTarget.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña');e.currentTarget.setAttribute('aria-pressed',String(show));});
 form?.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  const email=field('#access-email').value.trim(),password=field('#access-password').value;
  if((mode==='register'||mode==='update')&&password!==field('#access-confirm').value){say('Las contraseñas no coinciden.',true);return;}
  if(mode==='update'&&!recovering){say('Abre primero el enlace de recuperación enviado a tu correo.',true);return;}
  busy=true;field('#access-submit').disabled=true;form.setAttribute('aria-busy','true');say('Un momento…');
  try{
   let result;
   if(mode==='register')result=await client.auth.signUp({email,password,options:{emailRedirectTo:callback,data:{display_name:field('#access-name').value.trim().slice(0,80)}}});
   else if(mode==='reset')result=await client.auth.resetPasswordForEmail(email,{redirectTo:callback});
   else if(mode==='update')result=await client.auth.updateUser({password});
   else result=await client.auth.signInWithPassword({email,password});
   if(result.error)throw result.error;
   field('#access-password').value='';field('#access-confirm').value='';
   if(mode==='register'){if(result.data?.session){await restore();}else{try{sessionStorage.setItem('modoker-pending-email',email);}catch{}location.assign(new URL('verifica-correo.html',location.href).href);}}
   else if(mode==='reset')say('Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso. Ábrelo en este mismo navegador.');
   else if(mode==='update'){recovering=false;setMode('login');await client.auth.signOut({scope:'local'});say('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');}
   else {await restore();say('Sesión iniciada.');}
  }catch(error){say(explain(error),true);}
  finally{busy=false;field('#access-submit').disabled=false;form.removeAttribute('aria-busy');}
 });
 field('#sign-out')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;const {error}=await client.auth.signOut({scope:'local'});button.disabled=false;if(error){field('#member-note').textContent=explain(error);return;}say('Cerraste sesión en este navegador.');});
 if(form)setMode(mode);
 const restoring=document.createElement('div');restoring.className='session-restoring';restoring.setAttribute('role','status');
 const restoreMessage=document.createElement('p'),retry=document.createElement('button');retry.type='button';retry.className='btn blue';retry.textContent='Reintentar conexión ↗';restoring.append(restoreMessage,retry);
 if(area){area.before(restoring);area.hidden=true;}
 function showRestore(message){if(!form)return;restoreMessage.textContent=message;restoring.hidden=false;}
 function hideRestore(){restoring.hidden=true;}
 async function restore(){const ticket=++restoreTicket;lastRefresh=Date.now();const {data,error}=await client.auth.getSession();if(ticket!==restoreTicket)return;
  if(error){showRestore('No pudimos recuperar tu sesión. Reintenta la conexión.');return;}
  document.dispatchEvent(new CustomEvent('modoker:session',{detail:{signedIn:!!data.session}}));hideRestore();await render(data.session);
 }
 retry.addEventListener('click',()=>{retry.disabled=true;restore().catch(()=>showRestore('No pudimos verificar tu sesión. Reintenta la conexión.')).finally(()=>retry.disabled=false);});
 showRestore('Recuperando tu sesión…');restore().catch(()=>showRestore('No pudimos recuperar tu sesión. Reintenta la conexión.'));
 function refreshVisible(){if(!form||management||busy||document.hidden||Date.now()-lastRefresh<10000||document.activeElement?.matches('input'))return;restore().catch(()=>showRestore('No pudimos actualizar tu cuenta. Reintenta la conexión.'));}
 window.addEventListener('pageshow',event=>{if(event.persisted)refreshVisible();});window.addEventListener('focus',refreshVisible);window.addEventListener('online',()=>{lastRefresh=0;refreshVisible();});document.addEventListener('visibilitychange',refreshVisible);
 if(desktopEmailConfirmation)say('El enlace de cambio de correo fue procesado. Actualiza tu cuenta en la aplicación para comprobar el estado.');
 const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));
 if(query.has('error')||hash.has('error')){say('El enlace de acceso venció o no es válido. Solicita uno nuevo.',true);history.replaceState(null,'',location.pathname);}
 // Only public release telemetry; never include paths to local games, identities or files.
 let telemetry=Promise.resolve();
 window.addEventListener('modoker-download',e=>{
  try{if(localStorage.getItem('modoker-web-statistics')!=='allow')return;}catch{return;}
  const {event,release,id}=e.detail||{};if(!['started','verified'].includes(event)||!/^[0-9.]{1,24}$/.test(release||''))return;
  if(['127.0.0.1','localhost'].includes(location.hostname))return;
  telemetry=telemetry.then(()=>client.rpc('modoker_download',{p_id:id,p_release:release,p_event:event})).catch(()=>{});
 });
})();
