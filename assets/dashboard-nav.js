(() => {
 'use strict';
 const mobile=matchMedia('(max-width:800px)');
 document.querySelectorAll('.workspace-side').forEach((side,index)=>{
  const nav=side.querySelector('.workspace-nav');if(!nav)return;let open=false;
  nav.id=nav.id||`workspace-modules-${index}`;
  const toggle=document.createElement('button');toggle.type='button';toggle.className='dashboard-module-toggle';toggle.setAttribute('aria-controls',nav.id);toggle.setAttribute('aria-expanded','false');
  const content=document.createElement('span');content.className='dashboard-module-copy';const eyebrow=document.createElement('small');eyebrow.textContent='Módulos';const name=document.createElement('strong');content.append(eyebrow,name);
  const icon=document.createElement('span');icon.className='dashboard-module-icon';const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('viewBox','0 0 24 24');arrow.setAttribute('aria-hidden','true');arrow.classList.add('dashboard-module-arrow');const path=document.createElementNS(arrow.namespaceURI,'path');path.setAttribute('d','m7 10 5 5 5-5');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');arrow.append(path);toggle.append(icon,content,arrow);nav.before(toggle);
  function label(){const selected=nav.querySelector('button[aria-pressed="true"]')||nav.querySelector('button');if(!selected)return;name.textContent=selected.querySelector('span')?.textContent||selected.textContent;icon.replaceChildren();const svg=selected.querySelector('svg');if(svg)icon.append(svg.cloneNode(true));toggle.setAttribute('aria-label',`Módulo actual: ${name.textContent}. ${open?'Cerrar':'Elegir'} módulos`);}
  function sync(){nav.hidden=mobile.matches&&!open;toggle.setAttribute('aria-expanded',String(mobile.matches&&open));side.classList.toggle('modules-open',mobile.matches&&open);label();}
  toggle.addEventListener('click',()=>{open=!open;sync();});nav.addEventListener('click',event=>{if(event.target.closest('[data-member-view],[data-admin-view]')){open=false;sync();}});
  side.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile.matches&&open){event.preventDefault();open=false;sync();toggle.focus();}});
  new MutationObserver(label).observe(nav,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});mobile.addEventListener('change',()=>{open=false;sync();});sync();
 });
})();
