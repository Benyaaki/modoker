(()=>{
 const root=document.querySelector('.game-tour');if(!root)return;
 const track=root.querySelector('.game-tour-track'),screen=root.querySelector('.game-tour-sticky'),games=['gta','rdr','minecraft'],images=[...root.querySelectorAll('[data-tour-image]')],media=matchMedia('(prefers-reduced-motion: reduce)');let pending=false;
 const clamp=n=>Math.max(0,Math.min(1,n));
 function update(){
  pending=false;const reduced=media.matches||document.documentElement.dataset.motion==='reduce',box=track.getBoundingClientRect(),height=innerHeight;
  // Natural page movement: no pinning, spacer, wheel handler or scroll writes.
  const progress=clamp((height*.8-box.top)/(height*1.1));
  const game=games[Math.min(2,Math.floor(progress*3))],theme=document.documentElement.dataset.theme==='dark'?'dark':'light';
  images.forEach(img=>img.setAttribute('aria-hidden',String(img.dataset.tourImage!==game+'-'+theme)));
  const unfold=clamp((height*.94-box.top)/(height*.72));root.classList.toggle('motion-reduced',reduced);
  screen.style.setProperty('--screen-tilt',`${reduced?0:(1-unfold)*20}deg`);screen.style.setProperty('--screen-lift',`${reduced?0:(1-unfold)*42}px`);screen.style.setProperty('--screen-scale',String(reduced?1:.94+unfold*.06));
 }
 function queue(){if(!pending){pending=true;requestAnimationFrame(update);}}
 addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);media.addEventListener('change',queue);new MutationObserver(queue).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion','data-theme']});update();
})();
