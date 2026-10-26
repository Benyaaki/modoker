(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ModokerI18nCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';const normalize=s=>String(s).replace(/\s+/g,' ').trim(),escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function create(catalog={},language='es'){
  const exact=new Map(Object.entries(catalog).map(([k,v])=>[normalize(k),v]));const patterns=[];
  for(const [source,target] of exact){const tokens=[...source.matchAll(/\{\{(\d+)\}\}/g)];if(!tokens.length||tokens.length>6||source.replace(/\{\{\d+\}\}/g,'').trim().length<5)continue;let start=0,regex='^',ids=[];for(const m of tokens){regex+=escape(source.slice(start,m.index))+'(.*?)';ids.push(m[1]);start=m.index+m[0].length;}regex+=escape(source.slice(start))+'$';patterns.push({regex:new RegExp(regex,'u'),ids,target,weight:source.length-tokens.length*5});}patterns.sort((a,b)=>b.weight-a.weight);
  function core(raw){const source=normalize(raw);if(language==='es'||!source)return raw;if(exact.has(source)&&!source.includes('{{'))return exact.get(source);for(const p of patterns){const m=source.match(p.regex);if(m){const values={};p.ids.forEach((id,i)=>values[id]=m[i+1]);return p.target.replace(/\{\{(\d+)\}\}/g,(_,id)=>values[id]??'');}}return raw;}
  function t(raw){if(typeof raw!=='string'||language==='es'||/^(?:modoker|minecraft|Grand Theft Auto V|Red Dead Redemption 2)$/i.test(raw.trim()))return raw;const translated=core(raw);if(translated!==raw)return raw.match(/^\s*/)[0]+translated.trim()+raw.match(/\s*$/)[0];if(raw.includes('\n'))return raw.split('\n').map(core).join('\n');if(raw.includes(' · '))return raw.split(' · ').map(core).join(' · ');return raw;}
  return {t,language,locale:language==='es'?'es-CL':language==='en'?'en-US':language==='fr'?'fr-FR':'pt-BR'};
 }
 return {create,normalize};
});
