(() => {
 const root=document.documentElement, reduced=()=>root.dataset.motion==='reduce';
 const deck=document.querySelector('.deck-canvas');
 if(deck){
  const cards=[...deck.querySelectorAll('.deck-card')],count=document.querySelector('.deck-count');let active=0,start=null;
  function show(delta){active=(active+delta+cards.length)%cards.length;cards.forEach((c,i)=>{c.dataset.slot=String((i-active+cards.length)%cards.length);c.setAttribute('aria-hidden',String(i!==active));});count.textContent=`${String(active+1).padStart(2,'0')} / 03`;}
  show(0);document.querySelector('[data-deck-prev]').addEventListener('click',()=>show(-1));document.querySelector('[data-deck-next]').addEventListener('click',()=>show(1));
  deck.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(e.key==='ArrowRight'?1:-1);}});
  deck.addEventListener('pointerdown',e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY};deck.setPointerCapture(e.pointerId);});
  deck.addEventListener('pointerup',e=>{if(start){const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy))show(dx<0?1:-1);}start=null;});
  deck.addEventListener('pointercancel',()=>{start=null;});
 }
 const world=document.querySelector('.immersive-world'),cards=[...document.querySelectorAll('.world-card')],title=document.querySelector('.world-title');
 const appStage=document.querySelector('.app-scroll-stage');
 const steps=[...document.querySelectorAll('[data-journey-step]')],stepNumber=document.querySelector('#journey-step'),meter=document.querySelector('.journey-meter>span');let pending=false;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 function update(){pending=false;
  if(world){
   if(reduced()){title.style.transform='';title.style.opacity='';cards.forEach(c=>{c.style.transform='';c.style.opacity='';});}
   else{const box=world.getBoundingClientRect(),range=world.offsetHeight-innerHeight,p=clamp(-box.top/Math.max(1,range));title.style.transform=`scale(${1+p*.06})`;title.style.opacity=String(1-p*.12);
    cards.forEach((c,i)=>{const phase=clamp((p-.025-i*.035)*1.6),spread=.95+phase*.05,z=-350+phase*360;c.style.transform=`translate(-50%,-50%) translate3d(calc(var(--x) * ${spread}),calc(var(--y) * ${spread}),${z}px) rotate(var(--r))`;c.style.opacity=String(clamp((phase-.2)*4));});
   }
  }
  if(appStage){const p=reduced()?1:clamp((innerHeight*.94-appStage.getBoundingClientRect().top)/(innerHeight*.72));appStage.style.setProperty('--screen-tilt',`${(1-p)*20}deg`);appStage.style.setProperty('--screen-lift',`${(1-p)*42}px`);appStage.style.setProperty('--screen-scale',String(.94+p*.06));}
  if(steps.length){let current=0;steps.forEach((s,i)=>{if(s.getBoundingClientRect().top<innerHeight*.6)current=i;});if(stepNumber)stepNumber.textContent=String(current+1).padStart(2,'0');if(meter)meter.style.width=`${(current+1)/steps.length*100}%`;}
 }
 function queue(){if(!pending){pending=true;requestAnimationFrame(update);}}
 addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);new MutationObserver(queue).observe(root,{attributes:true,attributeFilter:['data-motion']});queue();
 const preview=document.querySelector('.app-preview-images');let previewTimer;
 document.querySelectorAll('.app-preview-images ~ [data-preview-mode], .app-window [data-preview-mode]').forEach(button=>button.addEventListener('click',()=>{
  if(preview.dataset.preview===button.dataset.previewMode)return;
  const mode=button.dataset.previewMode;preview.dataset.preview=mode;
  document.querySelectorAll('.app-preview-images ~ [data-preview-mode], .app-window [data-preview-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  const imgs=preview.querySelectorAll('img');imgs[0].setAttribute('aria-hidden',String(mode!=='light'));imgs[1].setAttribute('aria-hidden',String(mode!=='dark'));
  clearTimeout(previewTimer);preview.classList.remove('preview-changing');requestAnimationFrame(()=>{preview.classList.add('preview-changing');previewTimer=setTimeout(()=>preview.classList.remove('preview-changing'),800);});
 }));
 const mix=document.querySelector('.mix-scene'),captions={light:'Los detalles que te gustan.',blend:'A tu manera de jugar.',adventure:'Un mundo distinto.'};
 if(mix){
  const buttons=[...mix.querySelectorAll('[data-mix-mode]')],modes=buttons.map(b=>b.dataset.mixMode);let timer,visible=false;
  const paused=()=>reduced()||document.hidden||!visible||mix.matches(':hover')||mix.contains(document.activeElement);
  function choose(mode,manual=false){mix.dataset.mix=mode;const caption=mix.querySelector('.mix-caption');caption.setAttribute('aria-live',manual?'polite':'off');caption.textContent=captions[mode];buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mixMode===mode)));}
  function schedule(delay=10000){clearTimeout(timer);if(paused())return;timer=setTimeout(()=>{if(!paused()){choose(modes[(modes.indexOf(mix.dataset.mix)+1)%modes.length]);schedule();}},delay);}
  buttons.forEach(button=>button.addEventListener('click',()=>{choose(button.dataset.mixMode,true);schedule(14000);}));
  mix.addEventListener('pointerenter',()=>clearTimeout(timer));mix.addEventListener('pointerleave',()=>schedule(14000));mix.addEventListener('focusin',()=>clearTimeout(timer));mix.addEventListener('focusout',()=>setTimeout(()=>schedule(14000),0));
  document.addEventListener('visibilitychange',()=>schedule());new MutationObserver(()=>schedule()).observe(root,{attributes:true,attributeFilter:['data-motion']});
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.25}).observe(mix);
 }
 const questions=[...document.querySelectorAll('.faq-redesign details')],running=new WeakMap();
 questions.forEach((detail,index)=>detail.querySelector('summary').addEventListener('click',event=>{
  event.preventDefault();const answer=detail.querySelector('.faq-answer'),wasOpen=detail.open;
  questions.forEach(other=>{if(other!==detail){running.get(other)?.cancel();other.open=false;}});running.get(detail)?.cancel();
  const finish=()=>{detail.open=!wasOpen;document.querySelector('#faq-progress').textContent=detail.open?`Pregunta ${String(index+1).padStart(2,'0')} de 06`:'06 preguntas para explorar';};
  if(reduced()){finish();return;}
  if(!wasOpen)detail.open=true;
  const height=answer.scrollHeight,animation=answer.animate(wasOpen?[{height:`${height}px`,opacity:1},{height:'0px',opacity:0}]:[{height:'0px',opacity:0},{height:`${height}px`,opacity:1}],{duration:320,easing:'cubic-bezier(.2,.7,.2,1)'});running.set(detail,animation);animation.onfinish=finish;
 }));
})();


