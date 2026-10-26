(()=>{
 const root=document.documentElement,media=matchMedia('(prefers-reduced-motion: reduce)'),reduced=()=>root.dataset.motion==='reduce'||media.matches;
 const gauges=new Set(),frames=new WeakMap(),visible=new WeakSet();
 function draw(g,p){g.querySelector('.gauge-fill').style.strokeDashoffset=String(100-p*100);g.querySelector('.gauge-needle').setAttribute('transform',`rotate(${p*180} 115 120)`);}
 function play(g){cancelAnimationFrame(frames.get(g));const target=g.dataset.plan==='plus'?1:.38;g.setAttribute('aria-label',g.dataset.plan==='plus'?'Plan Plus: todas las capacidades del plan':'Plan Gratis: acceso esencial');if(reduced()){draw(g,target);return;}draw(g,0);let start;function step(now){start??=now;const t=Math.min(1,(now-start)/1450),e=1-Math.pow(1-t,3);draw(g,target*e);if(t<1)frames.set(g,requestAnimationFrame(step));}frames.set(g,requestAnimationFrame(step));}
 const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){if(!visible.has(e.target)){visible.add(e.target);play(e.target);}}else{visible.delete(e.target);cancelAnimationFrame(frames.get(e.target));}}),{threshold:.15});
 document.querySelectorAll('[data-plan-gauge]').forEach(g=>{gauges.add(g);draw(g,0);io.observe(g);});
 function setAccount(plus){document.querySelectorAll('[data-account-gauge]').forEach(g=>{const plan=plus?'plus':'free',changed=g.dataset.plan!==plan;g.dataset.plan=plan;g.closest('.plan-stage')?.setAttribute('data-plan',plan);if(changed&&visible.has(g))play(g);});}
 document.addEventListener('modoker:account',e=>setAccount(e.detail.account.plus===true));if(window.modokerAccountState)setAccount(window.modokerAccountState.account.plus===true);
 document.querySelectorAll('[data-gauge-choice]').forEach(b=>b.addEventListener('click',()=>{const g=document.querySelector('[data-demo-gauge]');g.dataset.plan=b.dataset.gaugeChoice;document.querySelectorAll('[data-gauge-choice]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelector('#potential-label').textContent=b.dataset.gaugeChoice==='plus'?'Plus · más formas de jugar':'Gratis · tu primer perfil';play(g);}));
 function respectMotion(){if(reduced())gauges.forEach(g=>{cancelAnimationFrame(frames.get(g));draw(g,g.dataset.plan==='plus'?1:.38);});}
 new MutationObserver(respectMotion).observe(root,{attributes:true,attributeFilter:['data-motion']});media.addEventListener('change',respectMotion);
})();
