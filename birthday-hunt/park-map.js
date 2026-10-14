// Standalone reference overlay: opening it never replaces a clue or answer draft.
'use strict';
(() => {
 const open=document.getElementById('open-park-map'),dialog=document.getElementById('park-map-dialog');
 if(!dialog||typeof dialog.showModal!=='function')return;
 const viewport=document.getElementById('map-viewport'),image=document.getElementById('park-map-image');
 const minus=document.getElementById('map-zoom-out'),plus=document.getElementById('map-zoom-in');
 const levels=[1,2,3,4,6,8];let level=0,previousFocus;
 function zoom(next){
  const old=levels[level],cx=(viewport.scrollLeft+viewport.clientWidth/2)/old,cy=(viewport.scrollTop+viewport.clientHeight/2)/old;
  level=Math.max(0,Math.min(levels.length-1,next));const scale=levels[level];
  image.style.width=(scale*100)+'%';
  document.getElementById('map-zoom-level').textContent=(scale*100)+'%';
  minus.disabled=level===0;plus.disabled=level===levels.length-1;
  viewport.scrollLeft=level?cx*scale-viewport.clientWidth/2:0;
  viewport.scrollTop=level?cy*scale-viewport.clientHeight/2:0;
 }
 open.addEventListener('click',event=>{
  event.preventDefault();previousFocus=open;
  if(!image.getAttribute('src')||!image.naturalWidth)image.src=image.dataset.src;
  dialog.showModal();document.body.classList.add('map-is-open');zoom(level);
 });
 document.getElementById('close-park-map').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{document.body.classList.remove('map-is-open');previousFocus?.focus();});
 plus.addEventListener('click',()=>zoom(level+1));minus.addEventListener('click',()=>zoom(level-1));
 document.getElementById('map-fit').addEventListener('click',()=>zoom(0));
 image.addEventListener('error',()=>{document.getElementById('map-error').hidden=false;viewport.hidden=true;});
 image.addEventListener('load',()=>{document.getElementById('map-error').hidden=true;viewport.hidden=false;});
})();
