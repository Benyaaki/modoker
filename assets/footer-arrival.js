(()=>{
 const wordmark=document.querySelector('.footer-wordmark');if(!wordmark)return;
 const root=document.documentElement,media=matchMedia('(prefers-reduced-motion:reduce)');let played=false,timer;
 const reduced=()=>media.matches||root.dataset.motion==='reduce';
 const stop=()=>{clearTimeout(timer);wordmark.classList.remove('footer-arrival')};
 const observer=new IntersectionObserver(entries=>{
  if(played||!entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.55))return;
  played=true;observer.disconnect();if(reduced())return;
  wordmark.classList.add('footer-arrival');timer=setTimeout(stop,1250);
 },{threshold:[0,.55]});
 observer.observe(wordmark);
 media.addEventListener('change',()=>{if(reduced())stop()});
 new MutationObserver(()=>{if(reduced())stop()}).observe(root,{attributes:true,attributeFilter:['data-motion']});
})();
