document.documentElement.classList.add('js');
const root=document.documentElement;
const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const save=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
root.dataset.motion=read('modoker-web-motion')||(prefersReduced?'reduce':'full');
root.dataset.theme=read('modoker-web-theme')||'light';
document.querySelector('.theme-toggle')?.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';save('modoker-web-theme',root.dataset.theme);});
const motionButton=document.querySelector('#reduce-motion');
function updateMotion(){motionButton.setAttribute('aria-pressed',String(root.dataset.motion==='reduce'));motionButton.textContent=root.dataset.motion==='reduce'?'Activar movimiento':'Reducir movimiento';}
updateMotion();motionButton.addEventListener('click',()=>{root.dataset.motion=root.dataset.motion==='reduce'?'full':'reduce';save('modoker-web-motion',root.dataset.motion);updateMotion();});
const menuButton=document.querySelector('.menu-toggle');
const mobileMenu=document.querySelector('#mobile-menu');
function closeMobileMenu(){mobileMenu?.close();menuButton?.setAttribute('aria-expanded','false');document.body.classList.remove('drawer-open');}
menuButton?.addEventListener('click',()=>{mobileMenu.showModal();menuButton.setAttribute('aria-expanded','true');document.body.classList.add('drawer-open');});
mobileMenu?.querySelector('.drawer-close').addEventListener('click',closeMobileMenu);
mobileMenu?.addEventListener('cancel',()=>{menuButton.setAttribute('aria-expanded','false');document.body.classList.remove('drawer-open');});
mobileMenu?.addEventListener('click',e=>{if(e.target===mobileMenu){const r=mobileMenu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeMobileMenu();}});
mobileMenu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMobileMenu));
document.querySelector('.drawer-theme')?.addEventListener('click',()=>document.querySelector('.theme-toggle').click());
matchMedia('(min-width:801px)').addEventListener('change',e=>{if(e.matches)closeMobileMenu();});
const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);}},{threshold:.09});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
document.querySelectorAll('[data-demo]').forEach(button=>button.addEventListener('click',()=>{
 const mode=button.dataset.demo;document.querySelector('.dock-demo').dataset.mode=mode;document.querySelectorAll('[data-demo]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 document.querySelector('#demo-game').textContent=mode==='store'?'Sin los mods gestionados':'Tu conjunto restaurado';document.querySelector('#demo-vault').textContent=mode==='store'?'Listos para volver':'De vuelta en el juego';
}));
const stage=document.querySelector('[data-parallax]');let pointerFrame;
stage?.addEventListener('pointermove',e=>{if(root.dataset.motion==='reduce')return;cancelAnimationFrame(pointerFrame);pointerFrame=requestAnimationFrame(()=>{const r=stage.getBoundingClientRect();stage.style.setProperty('--px',`${((e.clientX-r.left)/r.width-.5)*8}px`);stage.style.setProperty('--py',`${((e.clientY-r.top)/r.height-.5)*8}px`);});});stage?.addEventListener('pointerleave',()=>{cancelAnimationFrame(pointerFrame);stage.style.setProperty('--px','0px');stage.style.setProperty('--py','0px');});
const profiles={'Ligero':'Unos pocos ajustes para disfrutar los detalles.','Supervivencia':'Otra atmósfera y un desafío distinto.','Mi mezcla':'Tu perfil, con tus propios ajustes.'};document.querySelectorAll('[data-profile]').forEach(button=>button.addEventListener('click',()=>{document.querySelector('#profile-name').textContent=button.dataset.profile;document.querySelector('#profile-desc').textContent=profiles[button.dataset.profile];document.querySelectorAll('[data-profile]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));

// Bounded requests, verified blocks retained for retries within this page.
const downloadButton=document.querySelector('#download-app');let release,controller;
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
const sha=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
if(downloadButton){
 const panel=document.querySelector('.download-progress'),status=document.querySelector('#download-status'),cancelButton=document.querySelector('#cancel-download');
 const verified=new Map();let cacheKey='';
 const state=(kind,message)=>{panel.dataset.state=kind;status.textContent=message;};
 const request=async(url,signal,expected,onProgress)=>{
  const aborter=new AbortController();let timer;
  const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>aborter.abort(),45000);};
  const cancel=()=>aborter.abort();signal?.addEventListener('abort',cancel,{once:true});
  if(signal?.aborted)aborter.abort();reset();
  try{
   const response=await fetch(url,{signal:aborter.signal,cache:'no-cache'});
   if(!response.ok)throw Error('El servidor no pudo entregar el archivo.');
   if(!expected)return await response.json();
   const reader=response.body.getReader(),bytes=new Uint8Array(expected);let offset=0;
   for(;;){const {done,value}=await reader.read();if(done)break;reset();if(offset+value.length>expected){await reader.cancel();throw Error('El archivo recibido tiene un tamaño incorrecto.');}bytes.set(value,offset);offset+=value.length;onProgress?.(offset);}
   if(offset!==expected)throw Error('La transferencia llegó incompleta.');return bytes;
  }catch(e){if(signal?.aborted)throw new DOMException('Cancelado','AbortError');if(aborter.signal.aborted)throw Error('La conexión dejó de responder.');throw e;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 };
 const loadRelease=async signal=>{const info=await request('downloads/release.json',signal);if(!Array.isArray(info.parts)||!info.parts.length||!/^Modoker-[\w.-]+\.exe$/.test(info.fileName))throw Error('La información de descarga no es válida.');return info;};
 loadRelease().then(info=>{release=info;document.querySelector('#download-size').textContent=`${(info.size/1000000).toFixed(1)} MB · v${info.version} · portable`;}).catch(()=>{document.querySelector('#download-size').textContent='Consulta la versión al descargar.';});
 const preventExit=e=>{e.preventDefault();e.returnValue='';};
 cancelButton.addEventListener('click',()=>controller?.abort());
 downloadButton.addEventListener('click',async()=>{
  if(controller)return;controller=new AbortController();const signal=controller.signal;
  downloadButton.disabled=true;downloadButton.textContent='Descargando Modoker…';cancelButton.hidden=false;panel.hidden=false;panel.setAttribute('aria-busy','true');state('loading','Conectando con tu descarga…');window.addEventListener('beforeunload',preventExit);
  try{
   release=release||await loadRelease(signal);if(cacheKey!==release.sha256){verified.clear();cacheKey=release.sha256;}
   const downloadId=crypto.randomUUID(),track=event=>window.dispatchEvent(new CustomEvent('modoker-download',{detail:{event,release:release.version,id:downloadId}}));track('started');const chunks=[];let received=0;
   for(const [index,part]of release.parts.entries()){
    if(signal.aborted)throw new DOMException('Cancelado','AbortError');
    const url=new URL(part.path,location.href);if(url.origin!==location.origin)throw Error('Origen de descarga no válido.');
    let bytes=verified.get(part.path);
    if(!bytes){for(let attempt=0;attempt<3;attempt++){
     state('loading',attempt?'La conexión se interrumpió. Reintentando este bloque…':`Recibiendo tu app · bloque ${index+1} de ${release.parts.length}`);
     try{bytes=await request(url,signal,part.size,offset=>state('loading',`Recibiendo tu app · ${((received+offset)/1000000).toFixed(1)} MB de ${(release.size/1000000).toFixed(1)} MB`));if(await sha(bytes)!==part.sha256)throw Error('El bloque recibido no coincide con la versión publicada.');verified.set(part.path,bytes);break;}
     catch(e){if(signal.aborted||attempt===2)throw e;}
    }}chunks.push(bytes);received+=bytes.byteLength;
   }
   if(received!==release.size)throw Error('La descarga no está completa.');state('checking','Todo recibido. Comprobando tu archivo…');
   const blob=new Blob(chunks,{type:'application/octet-stream'});if(await sha(await blob.arrayBuffer())!==release.sha256){verified.clear();throw Error('La comprobación final no coincide. No se guardó el ejecutable.');}if(signal.aborted)throw new DOMException('Cancelado','AbortError');
   track('verified');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=release.fileName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   state('ready','Archivo comprobado y enviado al navegador. Revisa sus descargas.');downloadButton.textContent='Descargar de nuevo';verified.clear();
  }catch(e){state('error',signal.aborted?'Descarga cancelada. Puedes retomarla desde aquí.':`${e.message||'No pudimos completar la descarga.'} Pulsa Reintentar; conservamos los bloques comprobados mientras esta página siga abierta.`);downloadButton.textContent='Reintentar descarga';}
  finally{downloadButton.disabled=false;cancelButton.hidden=true;panel.setAttribute('aria-busy','false');window.removeEventListener('beforeunload',preventExit);controller=null;}
 });
}

(()=>{const header=document.querySelector('.site-header');if(!header)return;let pending=false;
function update(){pending=false;const compact=header.classList.contains('nav-compact');header.classList.toggle('nav-compact',scrollY>(compact?32:90));}
addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(update);}},{passive:true});update();})();
