(()=>{
 const root=document.querySelector('.game-tour');if(!root)return;
 const track=root.querySelector('.game-tour-track'),screen=root.querySelector('.game-tour-sticky'),games=['gta','rdr','minecraft','sims','elden','stardew'],images=[...root.querySelectorAll('[data-tour-image]')],media=matchMedia('(prefers-reduced-motion: reduce)');let pending=false;
 const clamp=n=>Math.max(0,Math.min(1,n));
 function update(){
  pending=false;const reduced=media.matches||document.documentElement.dataset.motion==='reduce',box=track.getBoundingClientRect(),height=innerHeight;
  // Native page scroll. The screen continues moving upward, at a gentler rate, across all six games. No wheel interception or scroll writes.
  const progress=clamp((height*.35-box.top)/(height*1.9));screen.style.setProperty("--tour-drift",`${progress*height*(innerWidth<=700?1.65:1.4)}px`);
  const game=games[Math.min(games.length-1,Math.floor(progress*games.length))],theme=document.documentElement.dataset.theme==='dark'?'dark':'light';
  images.forEach(img=>img.setAttribute('aria-hidden',String(img.dataset.tourImage!==game+'-'+theme)));
  const unfold=clamp((height*.94-box.top)/(height*.72));root.classList.toggle('motion-reduced',reduced);
  screen.style.setProperty('--screen-tilt',`${reduced?0:(1-unfold)*20}deg`);screen.style.setProperty('--screen-lift',`${reduced?0:(1-unfold)*42}px`);screen.style.setProperty('--screen-scale',String(reduced?1:.94+unfold*.06));
 }
 function queue(){if(!pending){pending=true;requestAnimationFrame(update);}}
 addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);media.addEventListener('change',queue);new MutationObserver(queue).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion','data-theme']});update();
})();
