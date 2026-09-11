(async function () {
  const root = document.querySelector('[data-maker-explorer]');
  if (!root) return;
  const el = name => root.querySelector('[data-' + name + ']');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const mobile = matchMedia('(max-width: 760px)');
  const state = {region:'', query:'', role:'', node:'', edge:'', view:'map'};
  let graphKey='';
  let cy, graph;
  try {
    const response = await fetch('/data/maker-graph.json', {cache:'no-cache'});
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
  const regionLabel = r => r.name.replaceAll(' / ',' /\n')+(r.name.toLowerCase().includes(r.location.toLowerCase())?'':'\n'+r.location.replaceAll(' / ',' /\n'));
  const geography = new MakerGeography(el('maker-canvas'), [...regions.values()], regionColor, selectRegion);
  const layouts = new Map();
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
    if (['works-at','workshop-background','succession'].includes(e.kind) || (e.kind==='regional-hub' && /workshop|maker identity/i.test(e.label))) return '#6bb7ff';
    if (['smith-to-sharpener','brand-to-sharpener'].includes(e.kind)) return '#efbd49';
    if (e.kind==='alias') return '#61d6cb';
    if (['regional-hub','regional-peer','region-member'].includes(e.kind)) return '#aeb8c3';
    return '#ff968a';
  }
  const adjacent = id => edges.filter(e => e.from===id || e.to===id);
  function edgeLabel(e) {
    if (['student','teacher','apprenticeship','worked-under'].includes(e.kind)) return 'Training';
    if (e.kind==='family') return 'Family';
    if (e.kind==='succession') return 'Workshop\n succession';
    if (e.kind==='workshop-background') return /former|background|historical/i.test(e.label)?'Former workshop':'Workshop';
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
    root.classList.toggle('has-selection',Boolean(state.node || state.edge));
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
    if(state.view==='directory')el('map-caption').textContent=list.length+' makers and workshops'+(state.region?' · '+regions.get(state.region).name:'');
  }
  function graphStyles() {
    const dark=document.documentElement.dataset.theme==='dark', ink=dark?'#f3f5f7':'#16191d', paper=dark?'#191d22':'#ffffff';
    return [
      {selector:'node',style:{'label':'data(label)','shape':'roundrectangle','width':180,'height':86,'background-color':paper,'border-width':3,'border-color':'data(color)','color':ink,'font-family':'system-ui, sans-serif','font-size':22,'font-weight':600,'text-wrap':'wrap','text-max-width':165,'text-valign':'center','text-halign':'center'}},
      {selector:'node.region',style:{'shape':'ellipse','width':170,'height':124,'background-color':dark?'#29333e':'#eaf1f7','font-size':20,'text-max-width':140}},
      {selector:'node.external',style:{'border-style':'dashed'}},
      {selector:'node.focus',style:{'border-width':4,'background-color':dark?'#29333e':'#eaf1f7'}},
      {selector:'edge',style:{'curve-style':'bezier','width':2.5,'line-color':'data(color)','target-arrow-color':'data(color)','target-arrow-shape':'triangle','arrow-scale':0.8,'label':'data(label)','font-size':12,'font-family':'system-ui, sans-serif','color':ink,'text-wrap':'wrap','text-max-width':78,'text-background-color':paper,'text-background-opacity':1,'text-background-padding':4,'text-rotation':'none','text-margin-y':-8}},
      {selector:'edge.provisional',style:{'line-style':'dashed'}},
      {selector:'edge',style:{'label':''}},
      {selector:'edge.membership',style:{'width':1.2,'opacity':0.4,'target-arrow-shape':'none','line-style':'solid'}},
      {selector:'edge.highlighted',style:{'label':'data(label)','width':4,'z-index':9}},
      {selector:'.muted',style:{'opacity':0.2}},
      {selector:'edge.selected',style:{'label':'data(label)','width':5,'z-index':10,'font-weight':700}},
      {selector:':selected',style:{'overlay-opacity':0}}
    ];
  }
  function showGraph() {
    if(state.view!=='map') return;
    if(!window.cytoscape){state.view='directory';el('map-status').textContent='The graph could not load. The directory is still available.';render();return;}
    const key=state.region+'|'+state.query+'|'+state.role;
    if(cy && graphKey===key){cy.resize();highlight();if(state.edge)cy.center(cy.getElementById(state.edge).connectedNodes());else if(state.node)cy.center(cy.getElementById(state.node));geography.sync();return;}
    const previous=cy?{zoom:cy.zoom(),pan:{...cy.pan()}}:null;
    const wasRegional=Boolean(cy?.nodes('.region').length);
    if(cy)cy.destroy();
    graphKey=key;
    const region=regions.get(state.region), elements=[];
    const hub=region?'region:'+region.id:'japan';
    if(region){
      elements.push({data:{id:hub,label:regionLabel(region),color:regionColor(region.id),regionId:region.id},classes:'region',position:{x:0,y:0}});
      const local=new Set(filtered().map(n=>n.id));
      const connected=edges.filter(e=>local.has(e.from)||local.has(e.to));
      const ids=new Set([...local,...connected.flatMap(e=>[e.from,e.to])]);
      [...ids].forEach((id,i)=>{const n=nodes.get(id),angle=i*2*Math.PI/ids.size;elements.push({data:{id,label:n.name,role:n.role,color:roleColor(n.role)},classes:local.has(id)?'maker':'maker external',position:{x:Math.cos(angle)*600,y:Math.sin(angle)*600}});});
      local.forEach(id=>elements.push({data:{id:'member:'+id,source:hub,target:id,color:'#aeb8c3',label:'Regional association'},classes:'membership'}));
      connected.forEach(e=>elements.push({data:{id:e.id,source:e.from,target:e.to,label:edgeLabel(e),color:edgeColor(e)},classes:community(e)?'provisional':''}));
      el('map-caption').textContent=region.name+' · '+local.size+' makers · '+connected.length+' relationships';
    }else{
      el('map-caption').textContent=regions.size+' regions · '+nodes.size+' makers and workshops';
    }
    const cached=layouts.get(key);
    if(cached) elements.filter(e=>!e.data.source).forEach(e=>{e.position=cached[e.data.id];});
    const layout=region && !cached?{name:'cose',randomize:false,animate:false,fit:false,nodeRepulsion:()=>18000,idealEdgeLength:e=>e.hasClass('membership')?150:110,edgeElasticity:()=>80,nodeOverlap:30,numIter:500,componentSpacing:100}:{name:'preset',fit:false};
    cy=cytoscape({container:el('maker-canvas'),elements,style:graphStyles(),minZoom:0.08,maxZoom:20,wheelSensitivity:0.2,pixelRatio:Math.min(devicePixelRatio,2),boxSelectionEnabled:false,autounselectify:true,layout});
    if(region && !cached){
      const origin={...cy.getElementById(hub).position()};
      cy.nodes().positions(n=>({x:n.position('x')-origin.x,y:n.position('y')-origin.y}));
      layouts.set(key,Object.fromEntries(cy.nodes().map(n=>[n.id(),{...n.position()}])));
    }
    cy.nodes('.region').lock();
    geography.bind(cy,state.region);
    fitGraph();
    if(region && cy.zoom()<0.72){cy.zoom(0.72);cy.center(cy.getElementById(hub));}
    if(previous && wasRegional===Boolean(region) && !matchMedia('(prefers-reduced-motion: reduce)').matches){
      const destination={zoom:cy.zoom(),pan:{...cy.pan()}};
      cy.viewport(previous);cy.animate(destination,{duration:320});
    }
    geography.sync();
    cy.on('tap','node',e=>{const n=e.target;if(n.id()==='japan')reset();else if(n.hasClass('region'))selectRegion(n.data('regionId'));else selectNode(n.id());});
    cy.on('tap','edge',e=>{if(e.target.hasClass('membership')){const id=e.target.target().id();if(id.startsWith('region:'))selectRegion(id.slice(7));else selectNode(id);}else selectEdge(e.target.id());});
    cy.on('tap',e=>{if(e.target===cy){state.node='';state.edge='';showProfile();highlight();}});
    highlight();
  }
  function fitGraph() {
    if(!cy) return;
    cy.resize();geography.fit();
  }
  function highlight() {
    if(!cy) return;
    cy.elements().removeClass('muted selected highlighted focus');
    if(state.edge){const edge=cy.getElementById(state.edge);cy.elements().addClass('muted');edge.removeClass('muted').addClass('selected');edge.connectedNodes().removeClass('muted');}
    else if(state.node){const node=cy.getElementById(state.node);cy.elements().addClass('muted');node.removeClass('muted').addClass('focus');const relations=node.connectedEdges().not('.membership');relations.removeClass('muted').addClass('highlighted');relations.connectedNodes().removeClass('muted');}
  }
  function revealProfile() {
    if(mobile.matches){el('maker-profile').focus({preventScroll:true});el('maker-profile').scrollIntoView({behavior:'smooth',block:'start'});}
  }
  function selectNode(id,reveal=true) {
    const n=nodes.get(id);if(!n) return;
    state.node=id;if(!state.region || !cy?.getElementById(id).length)state.region=n.regionId;state.edge='';state.query='';state.role='';render();if(reveal) revealProfile();
  }
  function selectEdge(id,reveal=true){
    state.edge=id;
    if(state.view==='map' && !cy?.getElementById(id).length){const edge=edges.find(e=>e.id===id);if(edge){state.region=nodes.get(edge.from).regionId;state.query='';state.role='';render();}}
    showProfile();highlight();if(reveal)revealProfile();
  }
  function selectRegion(id) {
    state.region=id;state.query='';state.role='';state.edge='';state.node='';state.view='map';
    render();
  }
  function reset(){Object.assign(state,{region:'',node:'',query:'',role:'',edge:'',view:'map'});render();geography.overview();}
  function render() {
    el('maker-region').value=state.region;el('maker-role').value=state.role;el('maker-search').value=state.query;
    root.querySelectorAll('[data-map-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapView===state.view)));
    el('maker-directory').hidden=state.view!=='directory';el('region-grid').hidden=true;
    el('maker-canvas').hidden=state.view!=='map';
    geography.stage.hidden=state.view!=='map';
    root.querySelector('.map-location-note').hidden=Boolean(state.region) || state.view!=='map';
    root.querySelector('[data-map-view="map"]').textContent=state.region?'Graph':'Map';
    root.querySelector('.map-zoom').hidden=state.view!=='map';
    el('map-back').disabled=false;
    showDirectory();showProfile();showGraph();
  }
  el('maker-region').innerHTML='<option value="">All regions</option>'+[...regions.values()].map(r=>'<option value="'+esc(r.id)+'">'+esc(r.name)+' · '+esc(r.location)+'</option>').join('');
  el('maker-region').onchange=e=>e.target.value?selectRegion(e.target.value):reset();
  el('maker-role').onchange=e=>{state.role=e.target.value;state.view='directory';state.node='';state.edge='';render();};
  el('maker-search').oninput=e=>{state.query=e.target.value.toLowerCase();state.view='directory';state.node='';state.edge='';render();};
  el('map-back').onclick=reset;
  root.querySelectorAll('[data-map-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.mapView;render();});
  root.querySelectorAll('[data-map-zoom]').forEach(b=>b.onclick=()=>{if(!cy)return;if(b.dataset.mapZoom==='fit')return fitGraph();cy.zoom({level:cy.zoom()*(b.dataset.mapZoom==='in'?1.2:1/1.2),renderedPosition:{x:cy.width()/2,y:cy.height()/2}});});
  new ResizeObserver(()=>{if(cy && state.view==='map')cy.resize();}).observe(el('maker-canvas'));
  new MutationObserver(()=>{if(cy)cy.style(graphStyles());}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  mobile.addEventListener('change',()=>{graphKey='';render();});
  el('map-status').textContent='';render();
})();
