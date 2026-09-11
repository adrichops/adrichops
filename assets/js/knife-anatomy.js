import * as THREE from 'three';
import {OrbitControls} from '../vendor/three-0.180.0/OrbitControls.js';
import {RoomEnvironment} from '../vendor/three-0.180.0/RoomEnvironment.js';

const sources={
  knifewear:['Knifewear','https://knifewear.com/en-us/blogs/articles/kitchen-knife-anatomy-explained-spine-belly-choil-and-more'],
  sharpedge:['SharpEdge','https://sharpedgeshop.com/blogs/knives-101/parts-of-japanese-kitchen-knife'],
  topham:['Topham Knife Co','https://www.tophamknifeco.com/advanced-chef-knife-grinds/']
};
const terms=[
  {id:'kissaki',en:'Tip',ja:'切っ先',kana:'きっさき',romaji:'Kissaki',group:'Blade geometry',source:'knifewear',point:[5.12,-.13,.03],text:'The forward point of the blade, used for precise cuts.',note:'The point is distinct from the curved belly behind it.'},
  {id:'mune',en:'Spine',ja:'棟',kana:'むね',romaji:'Mune',group:'Blade geometry',source:'knifewear',point:[.2,.65,.05],text:'The unsharpened top of the blade, opposite the cutting edge.',note:'Also called mine (峰). Thickness often decreases towards the tip: distal taper.'},
  {id:'hira',en:'Blade face',ja:'平',kana:'ひら',romaji:'Hira',group:'Blade geometry',source:'topham',point:[.1,.24,.05],text:'The broad face of the blade. In the wide-bevel study it lies between the spine and shinogi; the reference-inspired model has a continuous grind.',note:'Hira describes a surface. Jigane describes a material; the same area can be both.'},
  {id:'shinogi',en:'Bevel ridge',ja:'鎬',kana:'しのぎ',romaji:'Shinogi',group:'Blade geometry',source:'topham',point:[2.5,-.16,.05],text:'The change of plane between the hira and the primary bevel.',note:'A wide-bevel gyuto can have a distinct shinogi. Full-flat or continuously convex grinds need not have one. This is not the cladding line.'},
  {id:'kireha',en:'Primary bevel',ja:'切刃',kana:'きれは',romaji:'Kireha / kiriha',group:'Blade geometry',source:'knifewear',point:[1.1,-.56,.03],text:'The broad sloping surface that thins the blade towards its edge.',note:'Also romanized kiriha. A double-bevel knife is ground on both sides; it is not a single-bevel knife with an ura.'},
  {id:'hasaki',en:'Cutting edge',ja:'刃先',kana:'はさき',romaji:'Hasaki',group:'Blade geometry',source:'sharpedge',point:[2.4,-.78,.01],text:'The sharpened meeting of the blade surfaces, running from heel to tip.',note:'The edge is a line; the kireha is the wider surface above it.'},
  {id:'hamoto',en:'Heel of the edge',ja:'刃元',kana:'はもと',romaji:'Hamoto',group:'Blade geometry',source:'sharpedge',point:[-1.35,-.94,.01],text:'The rear part of the cutting edge, closest to the handle.',note:'Distinguish the heel of the edge from the curved choil behind it.'},
  {id:'ago',en:'Choil',ja:'顎',kana:'あご',romaji:'Ago',group:'Blade geometry',source:'knifewear',point:[-1.8,-.45,.04],text:'The rear blade transition below the neck, where a finger may rest in a pinch grip.',note:'Often translated as chin. Some sellers use ago for the heel region more broadly.'},
  {id:'sori',en:'Edge curvature',ja:'反り',kana:'そり',romaji:'Sori',group:'Blade geometry',source:'sharpedge',point:[4,-.45,.01],text:'The curvature towards the front of the edge, often called the belly.',note:'It is a shape, not a separate layer of steel.'},
  {id:'hagane',en:'Hard core steel',ja:'鋼',kana:'はがね',romaji:'Hagane',group:'Steel construction',source:'sharpedge',point:[1,-.87,.016],text:'The harder steel that forms the cutting edge of this clad knife.',note:'Spelled hagane, not higane. In this three-layer model it continues inside the blade between two cladding layers.'},
  {id:'jigane',en:'Softer cladding',ja:'地金',kana:'じがね',romaji:'Jigane',group:'Steel construction',source:'sharpedge',point:[1.4,.35,.05],text:'The softer iron or steel around the cutting core in a laminated blade.',note:'The exposed core boundary is a material boundary, not the shinogi. Cladding is not necessarily stainless.'},
  {id:'machi',en:'Tang shoulder',ja:'マチ',kana:'まち',romaji:'Machi',group:'Handle and tang',source:'sharpedge',point:[-2.35,.5,.05],text:'The shoulder where the blade neck steps down into the tang.',note:'A visible gap at the handle is not present on every knife.'},
  {id:'nakago',en:'Tang',ja:'中子',kana:'なかご',romaji:'Nakago',group:'Handle and tang',source:'knifewear',point:[-4.3,.31,.06],text:'The steel extension secured inside the handle.',note:'The handle becomes translucent here to show the normally hidden tang.'},
  {id:'e',en:'Handle',ja:'柄',kana:'え',romaji:'E',group:'Handle and tang',source:'knifewear',point:[-4.4,.35,.38],text:'The grip around the tang. This model has an octagonal Japanese-style handle.',note:'Wa handles differ from the riveted scales of many Western-style handles.'},
  {id:'kakumaki',en:'Ferrule',ja:'角巻',kana:'かくまき',romaji:'Kakumaki',group:'Handle and tang',source:'sharpedge',point:[-2.86,.35,.34],text:'The collar at the blade end of this wa handle.',note:'Ferrule terminology varies with construction; kuchigane is also encountered for collars or bolsters.'},
  {id:'ejiri',en:'Handle butt',ja:'柄尻',kana:'えじり',romaji:'Ejiri',group:'Handle and tang',source:'sharpedge',point:[-6,.34,.1],text:'The rear end of the handle, opposite the blade.',note:''}
];
const root=document.querySelector('[data-knife-study]');
const $=key=>root.querySelector(`[data-knife-${key}]`);
const sceneHost=$('scene'), inspector=$('inspector');
root.dataset.constructionView='whole';
let selected='hira', layerView=false, studyView=false, revealTang=false, renderer, controls, scene, camera, model, referenceBlade, frame=0, visible=true;
const partMeshes=new Map(), claddingGroups=[], pickMeshes=[], markers=new Map();
let highlightLine;

function renderTerms(query=''){
  $('terms').replaceChildren();
  const matches=terms.filter(t=>[t.en,t.ja,t.kana,t.romaji,t.id==='hagane'?'higane':''].join(' ').toLowerCase().includes(query.toLowerCase()));
  for(const group of [...new Set(matches.map(t=>t.group))]){
    const section=document.createElement('section');
    const heading=document.createElement('h3');heading.textContent=group;section.append(heading);
    for(const t of matches.filter(t=>t.group===group)){
      const button=document.createElement('button');button.type='button';button.className='anatomy-term';button.dataset.term=t.id;
      button.setAttribute('aria-pressed',String(t.id===selected));
      button.innerHTML=`<span><strong>${t.en}</strong><small>${t.romaji}</small></span><span lang="ja">${t.ja}</span>`;
      button.onclick=()=>{select(t.id);sceneHost.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});};section.append(button);
    }
    $('terms').append(section);
  }
  $('empty').hidden=matches.length>0;
}
function select(id){
  const term=terms.find(t=>t.id===id);if(!term)return;
  selected=id;root.dataset.selectedPart=id;
  const [source,url]=sources[term.source];
  inspector.innerHTML=`<span class="kicker">${term.group}</span><div class="term-japanese" lang="ja">${term.ja}</div><h2>${term.en}</h2><p class="term-reading">${term.romaji} <span lang="ja">/ ${term.kana}</span></p><p>${term.text}</p>${term.note?`<p class="term-note">${term.note}</p>`:''}<a href="${url}" target="_blank" rel="noopener">Reference: ${source}</a><div class="term-neighbours"><button type="button" data-term-prev aria-label="Previous term" title="Previous term">&#8592;</button><button type="button" data-term-next aria-label="Next term" title="Next term">&#8594;</button></div>`;
  const index=terms.indexOf(term);
  inspector.querySelector('[data-term-prev]').onclick=()=>select(terms[(index+terms.length-1)%terms.length].id);
  inspector.querySelector('[data-term-next]').onclick=()=>select(terms[(index+1)%terms.length].id);
  root.querySelectorAll('[data-term]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.term===id)));
  if(id==='nakago'){revealTang=true;$('tang').checked=true;}
  if(model && !studyView && ['shinogi','kireha','hagane','jigane'].includes(id))setView('bevel');
  updateMaterials();updateMarkers();requestRender();
}
renderTerms();select(selected);
$('search').oninput=e=>renderTerms(e.target.value.trim());

const upper=t=>.64-.025*t-.155*t**6;
const lower=t=>-.91+.06*t+1.31*t**3;
const thickness=t=>.06*(1-.4*t-.57*t**3);
const claddingLine=t=>.09+.013*Math.sin(t*19)+.004*Math.sin(t*67);
const skin=(t,v)=>{
  const bevel=Math.min(v/.43,1);
  const convex=bevel+.045*Math.sin(bevel*Math.PI);
  const face=(v-.43)/.57;
  return .0008+(thickness(t)-.0008)*(v<.43?convex:1-.08*face**2+.12*Math.sin(face*Math.PI));
};
const bladePoint=(t,v,z)=>new THREE.Vector3(-1.8+7.1*t,lower(t)+(upper(t)-lower(t))*v,z);
const smoothSkin=(t,v)=>.00065+(thickness(t)-.00065)*Math.sin(v*Math.PI/2)**.8;
const bladeAnchors={kissaki:[.995,.5],mune:[.28,1],hira:[.3,.67],shinogi:[.48,.43],kireha:[.46,.25],hasaki:[.6,0],hamoto:[.04,0],ago:[0,.22],sori:[.82,0],hagane:[.35,.045],jigane:[.4,.72]};
function termPoint(term){
  const anchor=bladeAnchors[term.id];
  return anchor?bladePoint(...anchor,(studyView?skin:smoothSkin)(...anchor)+.02):new THREE.Vector3(...term.point);
}

function bandGeometry(v0,v1,zFront,zBack){
  const positions=[],uvs=[],indices=[],segments=160,rows=12;
  const bound=(v,t)=>typeof v==='function'?v(t):v;
  const point=(t,s,z)=>{const v=THREE.MathUtils.lerp(bound(v0,t),bound(v1,t),s);return bladePoint(t,v,z(t,v));};
  // Separate surface grids preserve the shinogi and spine normals, without faceting the belly.
  function surface(nx,ny,at,reverse=false){
    const offset=positions.length/3;
    for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){
      const p=at(i/nx,j/ny);positions.push(p.x,p.y,p.z);uvs.push((p.x+1.8)/7.1,(p.y+.95)/1.67);
    }
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
      const a=offset+i*(ny+1)+j,b=a+ny+1;
      indices.push(...(reverse?[a,a+1,b,b,a+1,b+1]:[a,b,a+1,b,b+1,a+1]));
    }
  }
  surface(segments,rows,(t,s)=>point(t,s,zFront));
  surface(segments,rows,(t,s)=>point(t,s,zBack),true);
  for(const s of [0,1])surface(segments,1,(t,w)=>point(t,s,(t,v)=>THREE.MathUtils.lerp(zBack(t,v),zFront(t,v),w)),s===1);
  for(const t of [0,1])surface(1,rows,(w,s)=>point(t,s,(t,v)=>THREE.MathUtils.lerp(zBack(t,v),zFront(t,v),w)),t===1);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function addMesh(geometry,material,part,parent=model){
  const mesh=new THREE.Mesh(geometry,material);mesh.userData.part=part;mesh.userData.baseColor=material.color.clone();
  parent.add(mesh);pickMeshes.push(mesh);
  if(!partMeshes.has(part))partMeshes.set(part,[]);partMeshes.get(part).push(mesh);return mesh;
}
function metal(color,roughness=.35){return new THREE.MeshPhysicalMaterial({color,metalness:1,roughness,anisotropy:.65,side:THREE.DoubleSide});}
function brushedTexture(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(1024,256);
  let seed=29;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<256;y++){
    const grain=185+random()*42;
    for(let x=0;x<1024;x++){const i=(y*1024+x)*4,value=grain+random()*12;pixels.data.set([value,value,value,255],i);}
  }
  ctx.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.rotation=Math.PI/2;texture.repeat.set(2,2);texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
}
function satinTexture(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#e1e3e4';ctx.fillRect(0,0,1024,512);
  for(let i=0;i<1600;i++){
    const x=(i*79.73)%1024,y=(i*43.37)%512;
    ctx.strokeStyle=i%3?'#68727918':'#ffffff30';ctx.lineWidth=.3+(i%3)*.15;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+3,Math.min(512,y+40+(i%100)));ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
}
function woodTexture(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#d7bd84';ctx.fillRect(0,0,1024,512);
  for(let i=0;i<550;i++){
    ctx.strokeStyle=i%5?'#90713718':'#fff2cf55';ctx.lineWidth=.3+(i%7)*.12;ctx.beginPath();
    const y=(i*31.37)%512;
    for(let x=0;x<=1024;x+=4){const py=y+Math.sin(x*.005+i)*2+Math.sin(x*.0018+i*.08)*12;x?ctx.lineTo(x,py):ctx.moveTo(x,py);}ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
}
function handleGeometry(start,end,backRadius,frontRadius){
  // Rounded octagon: broad grip facets remain flat, with small bevels at each corner and end.
  const outline=[];
  for(let i=0;i<8;i++){
    const a=Math.PI/8+i*Math.PI/4,b=a+Math.PI/4;
    const p=new THREE.Vector2(Math.cos(a),Math.sin(a)),q=new THREE.Vector2(Math.cos(b),Math.sin(b));
    outline.push(p.clone().lerp(q,.10),p.clone().lerp(q,.90));
  }
  const positions=[],uvs=[],indices=[],n=outline.length;
  const rings=[[start,.94],[start+.018,.985],[start+.045,1],[end-.035,1],[end-.012,.985],[end,.95]];
  rings.forEach(([x,scale],r)=>{
    const radius=THREE.MathUtils.lerp(backRadius,frontRadius,(x-start)/(end-start))*scale;
    for(let j=0;j<=n;j++){
      const p=outline[j%n];positions.push(x,.32+p.x*radius,p.y*radius*.88);uvs.push((x-start)/(end-start),j/n);
      if(r<rings.length-1 && j<n){const a=r*(n+1)+j,b=a+n+1;indices.push(a,a+1,b,b,a+1,b+1);}
    }
  });
  // End caps use their own normals rather than rounding the whole handle into a cylinder.
  for(const index of [0,rings.length-1]){
    const offset=positions.length/3,x=rings[index][0];positions.push(x,.32,0);uvs.push(.5,.5);
    for(let j=0;j<n;j++){const i=(index*(n+1)+j)*3;positions.push(...positions.slice(i,i+3));uvs.push(outline[j].x*.5+.5,outline[j].y*.5+.5);}
    for(let j=0;j<n;j++){const a=offset+1+j,b=offset+1+(j+1)%n;indices.push(...(index===0?[offset,b,a]:[offset,a,b]));}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function makeKnife(){
  model=new THREE.Group();scene.add(model);
  const grain=brushedTexture(),satin=satinTexture();
  const steel=(color,roughness)=>{const material=metal(color,roughness);material.map=satin;material.roughnessMap=grain;material.bumpMap=grain;material.bumpScale=.001;return material;};
  referenceBlade=addMesh(bandGeometry(0,1,smoothSkin,(t,v)=>-smoothSkin(t,v)),steel('#e3e4e5',.26),'reference');
  const coreThickness=t=>skin(t,claddingLine(t))-.0003;
  addMesh(bandGeometry(0,1,(t,v)=>Math.min(skin(t,v),coreThickness(t)),(t,v)=>-Math.min(skin(t,v),coreThickness(t))),steel('#b9c1c7',.2),'hagane');
  for(const sign of [1,-1]){
    const group=new THREE.Group();group.userData.sign=sign;model.add(group);claddingGroups.push(group);
    const outside=(t,v)=>sign*(skin(t,v)+.00015), inside=t=>sign*coreThickness(t);
    addMesh(bandGeometry(claddingLine,.43,outside,inside),steel('#aab6bd',.42),'kireha',group);
    addMesh(bandGeometry(.43,1,outside,inside),steel('#e1e4e7',.19),'hira',group);
  }
  const neck=new THREE.Shape();neck.moveTo(-2.48,.59);neck.bezierCurveTo(-2.27,.61,-2,.64,-1.8,.64);neck.lineTo(-1.8,-.32);neck.bezierCurveTo(-1.95,-.06,-2.02,.20,-2.22,.20);neck.lineTo(-2.48,.20);neck.closePath();
  const neckGeo=new THREE.ExtrudeGeometry(neck,{depth:.092,steps:1,curveSegments:32,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:3});neckGeo.translate(0,0,-.046);addMesh(neckGeo,steel('#e3e4e5',.26),'machi');
  const tangShape=new THREE.Shape();tangShape.moveTo(-5.6,.23);tangShape.lineTo(-2.4,.17);tangShape.lineTo(-2.4,.44);tangShape.lineTo(-5.6,.34);tangShape.closePath();
  const tangGeo=new THREE.ExtrudeGeometry(tangShape,{depth:.07,bevelEnabled:true,bevelThickness:.003,bevelSize:.008,bevelSegments:2});tangGeo.translate(0,0,-.035);addMesh(tangGeo,metal('#747b80',.55),'nakago');
  const wood=woodTexture();
  addMesh(handleGeometry(-6.175,-3.34,.39,.35),new THREE.MeshPhysicalMaterial({map:wood,color:'#ffffff',roughness:.6,clearcoat:.08,clearcoatRoughness:.5}),'e');
  addMesh(handleGeometry(-3.34,-2.48,.35,.322),new THREE.MeshPhysicalMaterial({color:'#090a0d',roughness:.22,clearcoat:.55,clearcoatRoughness:.2}),'kakumaki');
}
function updateMaterials(){
  if(!model)return;
  referenceBlade.visible=!studyView;
  for(const mesh of partMeshes.get('hagane'))mesh.visible=studyView;
  for(const group of claddingGroups)group.visible=studyView;
  for(const meshes of partMeshes.values())for(const mesh of meshes){
    const id=mesh.userData.part;
    const active=id===selected || id==='reference' && selected==='hira' || selected==='jigane' && ['hira','kireha'].includes(id);
    mesh.material.emissive.set(active?'#f2b78b':'#000000');mesh.material.emissiveIntensity=active?.035:0;
    const transparent=revealTang && ['e','kakumaki'].includes(id);
    if(mesh.material.transparent!==transparent){mesh.material.transparent=transparent;mesh.material.needsUpdate=true;}
    mesh.material.opacity=mesh.material.transparent?.13:1;mesh.material.depthWrite=!mesh.material.transparent;
  }
  for(const g of claddingGroups)g.position.set(0,layerView?g.userData.sign*1.65:0,layerView?g.userData.sign*.8:0);
  if(highlightLine){model.remove(highlightLine);highlightLine.geometry.dispose();highlightLine.material.dispose();highlightLine=null;}
  const band={mune:1,shinogi:.43,hasaki:0,sori:0,hamoto:0};
  if(selected in band){
    const v=band[selected],points=[];
    for(let i=0;i<=70;i++){
      const t=selected==='hamoto'?i/350:selected==='sori'?.6+i/175:i/70;
      const p=bladePoint(t,v,(studyView?skin:smoothSkin)(t,v)+.02+(layerView && v>.14?.8:0));
      if(layerView && v>.14)p.y+=1.65;points.push(p);
    }
    highlightLine=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),80,.015,6,false),new THREE.MeshBasicMaterial({color:'#ff6a4f'}));model.add(highlightLine);
  }else if(['kissaki','ago','ejiri'].includes(selected)){
    let points;
    if(selected==='kissaki')points=[bladePoint(.91,1,.03),bladePoint(1,1,.03),bladePoint(.91,0,.03)];
    else if(selected==='ago')points=[new THREE.Vector3(-2.22,.20,.065),new THREE.Vector3(-1.95,-.06,.065),new THREE.Vector3(-1.8,-.91,.065)];
    else points=Array.from({length:9},(_,i)=>new THREE.Vector3(-6.18,.32+Math.cos(i*Math.PI/4)*.39,Math.sin(i*Math.PI/4)*.39));
    highlightLine=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,.02,6,false),new THREE.MeshBasicMaterial({color:'#ff6a4f'}));model.add(highlightLine);
  }
}
function updateMarkers(){
  if(!model)return;
  const active=terms.find(t=>t.id===selected);
  const shown=terms.filter(t=>t.id===selected || ['kissaki','mune','hira','e','kakumaki'].includes(t.id));
  $('hotspots').replaceChildren();markers.clear();
  for(const term of shown){
    const button=document.createElement('button');button.type='button';button.className='knife-hotspot';button.dataset.hotspot=term.id;
    button.setAttribute('aria-label',`${term.en} / ${term.romaji} / ${term.ja}`);button.setAttribute('aria-pressed',String(term===active));
    const label=document.createElement('span');label.textContent=`${term.en} / ${term.ja}`;button.append(label);
    button.onclick=()=>select(term.id);$('hotspots').append(button);markers.set(term.id,button);
  }
  placeMarkers();
}
function placeMarkers(){
  if(!model)return;
  model.updateMatrixWorld(true);camera.updateMatrixWorld();
  for(const [id,button] of markers){
    const term=terms.find(t=>t.id===id),p=termPoint(term);
    if(layerView && ['hira','jigane','kireha','shinogi','mune'].includes(id)){p.z+=.8;p.y+=1.65;}
    model.localToWorld(p);p.project(camera);
    const x=(p.x+1)*sceneHost.clientWidth/2,y=(1-p.y)*sceneHost.clientHeight/2;
    button.hidden=p.z>1 || x<22 || x>sceneHost.clientWidth-22 || y<22 || y>sceneHost.clientHeight-22;
    button.style.left=x+'px';button.style.top=y+'px';
  }
}
function draw(){
  frame=0;if(!renderer || !visible)return;
  controls.update();renderer.render(scene,camera);placeMarkers();
  root.dataset.renderCount=String(Number(root.dataset.renderCount||0)+1);
  if(controls.autoRotate)requestRender();
}
function requestRender(){if(renderer && !frame && visible)frame=requestAnimationFrame(draw);}
function resetCamera(){
  if(!camera)return;
  const mobile=sceneHost.clientWidth<600;
  model.rotation.set(.14,-.10,mobile?.84:.32);
  const aspect=sceneHost.clientWidth/sceneHost.clientHeight;
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const distance=Math.max(size.y,size.x/aspect)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.25;
  camera.aspect=aspect;camera.position.set(center.x,center.y+distance*.16,center.z+distance);camera.updateProjectionMatrix();
  controls.target.copy(center);controls.update();requestRender();
}

try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(sceneHost.clientWidth,sceneHost.clientHeight);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.domElement.setAttribute('aria-label','Interactive 3D gyuto');renderer.domElement.tabIndex=0;sceneHost.prepend(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,sceneHost.clientWidth/sceneHost.clientHeight,.1,100);
  const pmrem=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment();
  for(const [x,y,z,w,h,intensity] of [[0,5,4,12,2,7],[-4,1,-5,3,8,5],[3,-4,3,10,1,4]]){
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(intensity,intensity,intensity),side:THREE.DoubleSide}));panel.position.set(x,y,z);panel.lookAt(0,0,0);room.add(panel);
  }
  scene.environment=pmrem.fromScene(room,.025).texture;scene.environmentIntensity=.75;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#edf7ff','#685b49',1.3));
  const light=new THREE.DirectionalLight('#fff4df',2);light.position.set(2,6,8);scene.add(light);
  makeKnife();controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.enablePan=false;controls.minDistance=5;controls.maxDistance=38;controls.autoRotateSpeed=1.2;
  controls.addEventListener('change',requestRender);resetCamera();updateMaterials();updateMarkers();
  $('loading').hidden=true;root.dataset.ready='true';
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
  renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!down || Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;
    const box=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(pickMeshes).filter(h=>{
      for(let object=h.object;object;object=object.parent)if(!object.visible)return false;
      return !revealTang || !['e','kakumaki'].includes(h.object.userData.part);
    });
    if(!hits.length)return;
    const hit=hits[0],p=model.worldToLocal(hit.point.clone());let id=hit.object.userData.part;
    if(['reference','hira','kireha','hagane'].includes(id)){
      const t=THREE.MathUtils.clamp((p.x+1.8)/7.1,0,1),v=(p.y-lower(t))/(upper(t)-lower(t));
      id=layerView?(id==='hagane'?'hagane':'jigane'):t>.94?'kissaki':t<.02?'ago':v>.94?'mune':v<.025?'hasaki':!studyView?'hira':Math.abs(v-.43)<.04?'shinogi':v<claddingLine(t)?'hagane':v<.43?'kireha':'hira';
    }else if(id==='e' && p.x<-6)id='ejiri';
    select(id);
  });
  renderer.domElement.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();model.rotation.y+=e.key==='ArrowLeft'?-.15:.15;requestRender();}
  });
  new ResizeObserver(()=>{renderer.setSize(sceneHost.clientWidth,sceneHost.clientHeight);resetCamera();}).observe(sceneHost);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestRender();}).observe(sceneHost);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('loading').hidden=false;$('loading').textContent='3D paused. The terminology list remains available.';});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{$('loading').hidden=true;requestRender();});
  requestRender();
}catch(error){
  $('loading').textContent='3D is unavailable in this browser. The complete terminology list is available below.';
  root.dataset.ready='fallback';console.warn('Gyuto renderer unavailable:',error.message);
}
function setView(view){
  layerView=view==='layers';studyView=view!=='whole';root.dataset.constructionView=view;
  root.querySelectorAll('[data-knife-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.knifeView===view)));
  if(view==='whole' && ['shinogi','kireha','hagane','jigane'].includes(selected))select('hira');
  updateMaterials();updateMarkers();resetCamera();requestRender();
}
root.querySelectorAll('[data-knife-view]').forEach(button=>button.onclick=()=>setView(button.dataset.knifeView));
$('tang').onchange=e=>{revealTang=e.target.checked;updateMaterials();requestRender();};
$('reset').onclick=resetCamera;
$('spin').onclick=()=>{if(!controls)return;controls.autoRotate=!controls.autoRotate;$('spin').setAttribute('aria-pressed',String(controls.autoRotate));requestRender();};
