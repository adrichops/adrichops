(async function () {
  const root = document.querySelector('[data-maker-explorer]');
  if (!root) return;
  const el = name => root.querySelector('[data-' + name + ']');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const mobile = matchMedia('(max-width: 760px)');
  const state = {region:'', query:'', role:'', node:'', edge:'', relationIndex:0, view:mobile.matches ? 'directory' : 'map'};
  let cy, graph;
  try {
    const response = await fetch('/data/maker-graph.json');
    if (!response.ok) throw new Error();
    graph = await response.json();
  } catch (_) {
    el('map-status').innerHTML = 'The maker directory could not load. <button type="button" onclick="location.reload()">Try again</button>';
    return;
  }
  const regions = new Map(graph.regions.map(r => [r.id,r]));
  const nodes = new Map(graph.regions.flatMap(r => r.nodes.map(n => [n.id,{...n,regionId:r.id,regionName:r.name,location:n.location || r.location}])));
  const sources = new Map(graph.sources.map(s => [s.id,s]));
  const edges = graph.regions.flatMap(r => r.edges || []).filter(e => nodes.has(e.from) && nodes.has(e.to)).map((e,i) => ({...e,id:'relation-'+i}));
  const colors = ['#ff776b','#efbd49','#72d695','#61d6cb','#6bb7ff','#cfa3ff'];
  const regionColor = id => colors[[...regions.keys()].indexOf(id)%colors.length];
  function roleColor(role) {
    role = role.toLowerCase();
    if (role.includes('polisher')) return '#61d6cb';
    if (role.includes('blacksmith')) return '#ff776b';
    if (role.includes('sharpener')) return '#efbd49';
    if (role.includes('handle')) return '#cfa3ff';
    return '#6bb7ff';
  }
  function edgeColor(e) {
    if (['student','teacher','apprenticeship','worked-under','family'].includes(e.kind)) return '#56ce8b';
    if (['works-at','workshop-background'].includes(e.kind) || (e.kind==='regional-hub' && /workshop|maker identity/i.test(e.label))) return '#6bb7ff';
    if (['smith-to-sharpener','brand-to-sharpener'].includes(e.kind)) return '#efbd49';
    if (e.kind==='alias') return '#61d6cb';
    if (['regional-hub','regional-peer','region-member'].includes(e.kind)) return '#aeb8c3';
    return '#ff968a';
  }
  const adjacent = id => edges.filter(e => e.from===id || e.to===id);
  function edgeLabel(e) {
    if (['student','teacher','apprenticeship','worked-under'].includes(e.kind)) return 'Training';
    if (e.kind==='family') return 'Family';
    if (e.kind==='workshop-background') return 'Former workshop';
    if (e.kind==='works-at') return /previous|former/i.test(e.label)?'Previously worked with':'Works with';
    if (e.kind==='smith-to-sharpener') return 'Forging /\nsharpening';
    if (e.kind==='brand-to-sharpener') return 'Brand /\nsharpener';
    if (e.kind==='brand-to-line') return 'Brand / line';
    if (e.kind==='alias') return 'Alias';
    if (e.kind==='regional-peer') return 'Regional peers';
    if (e.kind==='regional-hub') return /workshop|maker identity/i.test(e.label)?'Workshop':'Regional\nnetwork';
    if (e.kind==='region-member') return 'Region';
    return 'Collaboration';
  }
  const community = e => /community|forum|reddit/i.test(e.sourceType || '') || !(e.sourceIds || []).length;
  function matches(n) {
    return (!state.region || n.regionId===state.region) && (!state.role || n.role.toLowerCase().replaceAll('-',' ').includes(state.role)) &&
      (!state.query || [n.name,...(n.aliases || []),n.regionName,n.role,...(n.famousLines || [])].join(' ').toLowerCase().includes(state.query));
  }
  const filtered = () => [...nodes.values()].filter(matches).sort((a,b) => a.name.localeCompare(b.name));
  function sourceLinks(ids) {
    return [...new Set(ids || [])].map(id => sources.get(id)).filter(Boolean).map(s => '<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.label || s.id)+' ↗</a>').join('');
  }
  function relationshipRow(e) {
    return '<button class="relationship-row'+(state.edge===e.id?' selected':'')+'" type="button" data-relation="'+e.id+'" style="--relation-color:'+edgeColor(e)+'"><strong>'+esc(e.label || e.kind)+'</strong><span>'+esc(nodes.get(e.from).name)+' → '+esc(nodes.get(e.to).name)+'</span><small>'+(community(e)?'Community report / source needed':'Source linked')+'</small></button>';
  }
  function showProfile() {
    const n=nodes.get(state.node), e=edges.find(e=>e.id===state.edge);
    if (e) {
      el('maker-profile').innerHTML='<button class="button small" data-profile-back type="button">Back to maker</button><span class="kicker">Relationship</span><h2>'+esc(e.label || e.kind)+'</h2><p class="relationship-direction">'+esc(nodes.get(e.from).name)+' → '+esc(nodes.get(e.to).name)+'</p><p>'+esc(e.detail)+'</p><p class="evidence-note">'+(community(e)?'Community report or missing direct source. Treat this relationship as provisional.':'Read the linked source for the scope of this relationship.')+'</p><div class="profile-sources">'+sourceLinks(e.sourceIds)+'</div><div class="profile-actions">'+[e.from,e.to].map(id=>'<button class="button" type="button" data-person="'+esc(id)+'">'+esc(nodes.get(id).name)+'</button>').join('')+'</div>';
    } else if (n) {
      const rels=adjacent(n.id);
      el('maker-profile').innerHTML='<span class="kicker">'+esc(n.regionName)+' · '+esc(n.location)+'</span><h2>'+esc(n.name)+'</h2><p class="profile-role" style="--role-color:'+roleColor(n.role)+'">'+esc(n.role)+'</p>'+(n.aliases?.length?'<p class="profile-alias">Also known as '+esc(n.aliases.join(', '))+'</p>':'')+'<p>'+esc(n.specialty)+'</p>'+(n.famousLines?.length?'<h3>Known for</h3><ul>'+n.famousLines.map(l=>'<li>'+esc(l)+'</li>').join('')+'</ul>':'')+'<h3>Relationships <span>'+rels.length+'</span></h3><div class="profile-relations">'+(rels.map(relationshipRow).join('') || '<p>No documented connections yet.</p>')+'</div>'+(n.caveat?'<p class="evidence-note">'+esc(n.caveat)+'</p>':'')+'<details class="profile-sources"><summary>Sources</summary>'+(sourceLinks(n.sourceIds) || '<p>No direct source attached yet.</p>')+'</details><button class="button" type="button" data-maker-suggestion-open>Suggest changes</button>';
    } else {
      const r=regions.get(state.region);
      el('maker-profile').innerHTML='<span class="kicker">'+(r?esc(r.location):'A shared craft')+'</span><h2>'+(r?esc(r.name):'Meet the makers')+'</h2><p>'+(r?esc(r.summary):'A knife may pass through several workshops before it reaches your kitchen. Explore the people, their roles and their connections.')+'</p><h3>A few useful words</h3><dl class="role-glossary"><dt>Blacksmith</dt><dd>Forges and heat-treats the blade.</dd><dt>Sharpener</dt><dd>Grinds the blade geometry and prepares the edge.</dd><dt>Polisher</dt><dd>Refines the surface and finish.</dd><dt>Handle maker</dt><dd>Makes and fits the grip.</dd></dl><a class="text-link" href="/blog/who-made-your-japanese-knife/">Read the beginner\'s guide →</a>';
    }
    el('maker-profile').querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>selectNode(b.dataset.person));
    el('maker-profile').querySelectorAll('[data-relation]').forEach(b=>b.onclick=()=>selectEdge(b.dataset.relation));
    el('maker-profile').querySelector('[data-profile-back]')?.addEventListener('click',()=>{state.edge='';showProfile();highlight();});
    // Delegate to the existing suggestion form and approval workflow.
    el('maker-profile').querySelector('[data-maker-suggestion-open]')?.addEventListener('click',()=>document.querySelector('.map-intro [data-maker-suggestion-open]').click());
  }
  function showDirectory() {
    const list=filtered();
    el('maker-directory').innerHTML=list.map(n=>'<button type="button" class="directory-row'+(state.node===n.id?' selected':'')+'" data-person="'+esc(n.id)+'" style="--role-color:'+roleColor(n.role)+'"><strong>'+esc(n.name)+'</strong><span>'+esc(n.role)+'</span><small>'+esc(n.regionName)+'</small></button>').join('') || '<div class="map-empty"><h2>No makers found</h2><p>Try another name or clear the filters.</p><button type="button" class="button" data-clear-filters>Clear filters</button></div>';
    el('maker-directory').querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>selectNode(b.dataset.person));
    el('maker-directory').querySelector('[data-clear-filters]')?.addEventListener('click',reset);
    el('map-caption').textContent=list.length+' makers and workshops'+(state.region?' · '+regions.get(state.region).name:'');
  }
  function showRegions() {
    el('region-grid').innerHTML=[...regions.values()].map(r=>'<button type="button" data-region="'+esc(r.id)+'" style="--region-color:'+regionColor(r.id)+'"><strong>'+esc(r.name)+'</strong><span>'+esc(r.location)+'</span><small>'+r.nodes.length+' makers & workshops</small></button>').join('');
    el('region-grid').querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>selectRegion(b.dataset.region));
  }
  function graphStyles() {
    const dark=document.documentElement.dataset.theme==='dark', ink=dark?'#f3f5f7':'#16191d', paper=dark?'#191d22':'#ffffff';
    return [
      {selector:'node',style:{'label':'data(label)','shape':'roundrectangle','width':170,'height':86,'background-color':paper,'border-width':2,'border-color':'data(color)','color':ink,'font-family':'system-ui, sans-serif','font-size':16,'font-weight':600,'text-wrap':'wrap','text-max-width':153,'text-valign':'center','text-halign':'center'}},
      {selector:'node.focus',style:{'border-width':4,'background-color':dark?'#29333e':'#eaf1f7'}},
      {selector:'edge',style:{'curve-style':'bezier','width':2.5,'line-color':'data(color)','target-arrow-color':'data(color)','target-arrow-shape':'triangle','arrow-scale':0.8,'label':'data(label)','font-size':12,'font-family':'system-ui, sans-serif','color':ink,'text-wrap':'wrap','text-max-width':78,'text-background-color':paper,'text-background-opacity':1,'text-background-padding':4,'text-rotation':'none','text-margin-y':-8}},
      {selector:'edge.provisional',style:{'line-style':'dashed'}},
      {selector:'.muted',style:{'opacity':0.22}},
      {selector:'edge.selected',style:{'width':5,'z-index':10,'font-weight':700}},
      {selector:':selected',style:{'overlay-opacity':0}}
    ];
  }
  function showGraph() {
    if(cy){cy.destroy();cy=null;}
    if(!state.region || !state.node || state.view!=='map') return;
    if(!window.cytoscape){state.view='directory';el('map-status').textContent='The graph could not load. The directory is still available.';render();return;}
    const all=adjacent(state.node);
    const pageSize=mobile.matches?1:8;
    state.relationIndex=Math.min(state.relationIndex,Math.max(0,all.length-1));
    state.relationIndex=Math.floor(state.relationIndex/pageSize)*pageSize;
    const connected=all.slice(state.relationIndex,state.relationIndex+pageSize);
    const ids=new Set([state.node,...connected.flatMap(e=>[e.from,e.to])]);
    const elements=[...ids].map((id,i)=>{const n=nodes.get(id);return {data:{id,label:n.name+'\n'+n.role,color:roleColor(n.role)},position:{x:180,y:i?340:110},classes:id===state.node?'focus':''};});
    connected.forEach(e=>elements.push({data:{id:e.id,source:e.from,target:e.to,label:edgeLabel(e),color:edgeColor(e)},classes:community(e)?'provisional':''}));
    cy=cytoscape({container:el('maker-canvas'),elements,style:graphStyles(),minZoom:0.2,maxZoom:2.2,wheelSensitivity:0.15,boxSelectionEnabled:false,autounselectify:true,layout:mobile.matches?{name:'preset',padding:30}:{name:'concentric',concentric:n=>n.id()===state.node?2:1,levelWidth:()=>1,minNodeSpacing:35,avoidOverlap:true,padding:30,animate:false}});
    fitGraph();
    cy.on('tap','node',e=>selectNode(e.target.id()));
    cy.on('tap','edge',e=>selectEdge(e.target.id()));
    el('map-caption').textContent=nodes.get(state.node).name+' · '+all.length+' relationships';
    el('mobile-relations').hidden=!all.length || (!mobile.matches && all.length<=pageSize);
    const range=pageSize===1?'Connection '+(state.relationIndex+1):'Connections '+(state.relationIndex+1)+'-'+Math.min(all.length,state.relationIndex+pageSize);
    el('mobile-relations').innerHTML='<button type="button" class="button" data-relation-prev '+(state.relationIndex===0?'disabled':'')+'>Previous</button><span>'+range+' of '+all.length+'</span><button type="button" class="button" data-relation-next '+(state.relationIndex+pageSize>=all.length?'disabled':'')+'>Next</button>';
    el('mobile-relations').querySelector('[data-relation-prev]').onclick=()=>{state.relationIndex-=pageSize;state.edge='';showGraph();showProfile();};
    el('mobile-relations').querySelector('[data-relation-next]').onclick=()=>{state.relationIndex+=pageSize;state.edge='';showGraph();showProfile();};
    highlight();
  }
  function fitGraph() {
    if(!cy) return;
    cy.resize();cy.fit(undefined,35);
    if(cy.zoom()>1.15) cy.zoom({level:1.15,renderedPosition:{x:cy.width()/2,y:cy.height()/2}});
  }
  function highlight() {
    if(!cy) return;
    cy.elements().removeClass('muted selected');
    if(state.edge){const edge=cy.getElementById(state.edge);cy.elements().addClass('muted');edge.removeClass('muted').addClass('selected');edge.connectedNodes().removeClass('muted');}
  }
  function revealProfile() {
    if(mobile.matches){el('maker-profile').focus({preventScroll:true});el('maker-profile').scrollIntoView({behavior:'smooth',block:'start'});}
  }
  function selectNode(id,reveal=true) {
    const n=nodes.get(id);if(!n) return;
    state.node=id;state.region=n.regionId;state.edge='';state.relationIndex=0;render();if(reveal) revealProfile();
  }
  function selectEdge(id,reveal=true){
    state.edge=id;
    if(state.view==='map'){state.relationIndex=Math.max(0,adjacent(state.node).findIndex(e=>e.id===id));showGraph();}
    showProfile();highlight();if(reveal)revealProfile();
  }
  function selectRegion(id) {
    state.region=id;state.query='';state.role='';state.edge='';state.relationIndex=0;
    const list=regions.get(id)?.nodes || [];
    state.node=state.view==='map' ? [...list].sort((a,b)=>adjacent(b.id).length-adjacent(a.id).length)[0]?.id || '' : '';
    render();
  }
  function reset(){Object.assign(state,{region:'',node:'',query:'',role:'',edge:''});render();}
  function render() {
    if(state.view==='map' && state.region && !state.node) state.view='directory';
    el('maker-region').value=state.region;el('maker-role').value=state.role;el('maker-search').value=state.query;
    root.querySelectorAll('[data-map-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapView===state.view)));
    el('maker-directory').hidden=state.view!=='directory';el('region-grid').hidden=state.view!=='map' || Boolean(state.region);
    el('maker-canvas').hidden=state.view!=='map' || !state.region;
    el('mobile-relations').hidden=true;
    root.querySelector('.map-zoom').hidden=state.view!=='map' || !state.region;
    el('map-back').disabled=!state.region && !state.query && !state.role;
    showDirectory();showRegions();showProfile();showGraph();
    root.querySelectorAll('[data-geo-region]').forEach(b=>b.classList.toggle('selected',b.dataset.geoRegion===state.region));
  }
  el('maker-region').innerHTML='<option value="">All regions</option>'+[...regions.values()].map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+' · '+esc(r.location)+'</option>').join('');
  el('maker-region').onchange=e=>e.target.value?selectRegion(e.target.value):reset();
  el('maker-role').onchange=e=>{state.role=e.target.value;state.view='directory';state.node='';state.edge='';render();};
  el('maker-search').oninput=e=>{state.query=e.target.value.toLowerCase();state.view='directory';state.node='';state.edge='';render();};
  el('map-back').onclick=reset;
  root.querySelectorAll('[data-map-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.mapView;if(state.view==='map' && state.region && !state.node) state.node=filtered()[0]?.id || '';render();});
  root.querySelectorAll('[data-map-zoom]').forEach(b=>b.onclick=()=>{if(!cy)return;if(b.dataset.mapZoom==='fit')return fitGraph();cy.zoom({level:cy.zoom()*(b.dataset.mapZoom==='in'?1.2:1/1.2),renderedPosition:{x:cy.width()/2,y:cy.height()/2}});});
  new ResizeObserver(()=>fitGraph()).observe(el('maker-canvas'));
  new MutationObserver(()=>{if(cy)cy.style(graphStyles());}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  el('maker-canvas').insertAdjacentHTML('afterend','<div class="mobile-relations" data-mobile-relations hidden></div>');
  mobile.addEventListener('change',()=>{state.relationIndex=0;render();});
  el('map-status').textContent='';render();
  // Geographic coordinates are separate from the relationship layout.
  const coords={sakai:[135.48,34.57],sanjo:[138.96,37.63],echizen:[136.17,35.90],'tosa-kochi':[133.53,33.56],miki:[134.99,34.80],'seki-gifu':[136.92,35.49],'tsubame-niigata':[138.93,37.67],kyoto:[135.77,35.01],aomori:[140.47,40.60],okayama:[133.47,34.98],kumamoto:[130.71,32.80],kagoshima:[130.56,31.60],nagasaki:[129.87,32.75],yamaguchi:[131.47,34.19],tanegashima:[130.97,30.73],saga:[130.30,33.25],hiroshima:[132.46,34.39],shimane:[132.76,35.47],miyazaki:[131.42,31.91],oita:[131.61,33.24],tokushima:[134.56,34.07],tottori:[134.24,35.50],fukuoka:[130.40,33.59],nagano:[138.18,36.65],mie:[136.51,34.73],tokyo:[139.69,35.69]};
  try {
    const response=await fetch('/data/japan-boundary.json');if(!response.ok)throw new Error();
    const geo=await response.json();
    const polygons=geo.geometry.type==='MultiPolygon'?geo.geometry.coordinates:[geo.geometry.coordinates];
    const cosine=Math.cos(37*Math.PI/180), points=polygons.flat(2);
    const xs=points.map(p=>p[0]*cosine), ys=points.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=Math.min(720/(maxX-minX),640/(maxY-minY));
    const project=([lon,lat])=>[400+(lon*cosine-(minX+maxX)/2)*scale,360- (lat-(minY+maxY)/2)*scale];
    const paths=polygons.map(p=>p.map(r=>r.map((point,i)=>(i?'L':'M')+project(point).map(v=>v.toFixed(2)).join(',')).join(' ')+'Z').join(' '));
    el('japan-map').innerHTML=paths.map(d=>'<path class="japan-land" d="'+d+'"></path>').join('')+[...regions.values()].filter(r=>coords[r.id]).map(r=>{const [x,y]=project(coords[r.id]);return '<g class="geo-pin" role="button" tabindex="0" aria-label="'+esc(r.name)+'" data-pin-region="'+esc(r.id)+'"><circle cx="'+x+'" cy="'+y+'" r="11" fill="transparent"></circle><circle cx="'+x+'" cy="'+y+'" r="5" fill="'+regionColor(r.id)+'"><title>'+esc(r.name)+'</title></circle></g>';}).join('');
    el('geography-list').innerHTML=[...regions.values()].map(r=>'<button type="button" data-geo-region="'+esc(r.id)+'" style="--region-color:'+regionColor(r.id)+'">'+esc(r.name)+'<small>'+esc(r.location)+'</small></button>').join('');
    function selectGeographicRegion(id) {
      selectRegion(id);const [x,y]=project(coords[id]);
      el('japan-map').querySelector('.geo-selected')?.remove();
      el('japan-map').insertAdjacentHTML('beforeend','<g class="geo-selected" pointer-events="none"><circle cx="'+x+'" cy="'+y+'" r="13" fill="none" stroke="currentColor" stroke-width="3"></circle><text x="'+(x+18)+'" y="'+(y-18)+'">'+esc(regions.get(id).name)+'</text></g>');
    }
    el('geography-list').querySelectorAll('button').forEach(b=>b.onclick=()=>selectGeographicRegion(b.dataset.geoRegion));
    el('japan-map').querySelectorAll('[data-pin-region]').forEach(pin=>{
      pin.onclick=()=>selectGeographicRegion(pin.dataset.pinRegion);
      pin.onkeydown=e=>{if(e.key==='Enter' || e.key===' '){e.preventDefault();selectGeographicRegion(pin.dataset.pinRegion);}};
    });
  } catch(_){el('geography-list').textContent='The geographic map could not load. All regions remain available above.';}
})();
