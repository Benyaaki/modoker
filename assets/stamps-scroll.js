(()=>{
 const section=document.querySelector('.plus-stamps-section');if(!section)return;
 const story=section.querySelector('.stamps-story'),track=section.querySelector('.stamp-demo-track'),card=section.querySelector('.stamp-demo'),stamps=[...section.querySelectorAll('.demo-stamps span')],result=section.querySelector('#demo-stamp-result'),media=matchMedia('(prefers-reduced-motion: reduce)');let pending=false,last=-1;
 const clamp=n=>Math.max(0,Math.min(1,n));
 function draw(){pending=false;const reduced=media.matches||document.documentElement.dataset.motion==='reduce',compact=innerWidth<760||innerHeight<740;
 section.classList.toggle('stamps-scroll-reduced',reduced);section.classList.toggle('stamps-scroll-compact',compact);
 const box=section.getBoundingClientRect(),range=Math.max(1,compact?track.offsetHeight-card.offsetHeight:section.offsetHeight-story.offsetHeight),progress=reduced?1:clamp((110-(compact?track.getBoundingClientRect().top:box.top))/range),count=reduced?6:Math.min(6,Math.floor(progress*7));
 stamps.forEach((s,i)=>{s.classList.toggle('stamped',i<count);s.style.setProperty('--stamp-order',i);});
 section.style.setProperty('--stamp-progress',String(progress));card.classList.toggle('card-complete',count===6);card.setAttribute('aria-label',`Demostración: ${count} de seis timbres${count===6?', dos meses de regalo':''}`);
 if(count!==last){result.textContent=count===6?'Dos meses de Plus de regalo.':count===0?'Un mes. Un nuevo timbre.':`${count} de 6 timbres. Tu tarjeta avanza.`;last=count;}
 }
 function queue(){if(!pending){pending=true;requestAnimationFrame(draw);}}
 addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue);media.addEventListener('change',queue);new MutationObserver(queue).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});draw();
})();
