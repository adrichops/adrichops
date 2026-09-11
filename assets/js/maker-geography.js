(function () {
  const coordinates = {
    sakai:[135.48,34.57], sanjo:[138.96,37.63], echizen:[136.17,35.90],
    'tosa-kochi':[133.53,33.56], miki:[134.99,34.80], 'seki-gifu':[136.92,35.49],
    'tsubame-niigata':[138.93,37.67], kyoto:[135.77,35.01], aomori:[140.47,40.60],
    okayama:[133.47,34.98], kumamoto:[130.71,32.80], kagoshima:[130.56,31.60],
    nagasaki:[129.87,32.75], yamaguchi:[131.47,34.19], tanegashima:[130.97,30.73],
    saga:[130.30,33.25], hiroshima:[132.46,34.39], shimane:[132.76,35.47],
    miyazaki:[131.42,31.91], oita:[131.61,33.24], tokushima:[134.56,34.07],
    tottori:[134.24,35.50], fukuoka:[130.40,33.59], nagano:[138.18,36.65],
    mie:[136.51,34.73], tokyo:[139.69,35.69]
  };
  // Geographic coordinates are used only by the country overview.
  const project = ([lon, lat]) => ({x:(lon-137)*Math.cos(37*Math.PI/180)*200, y:(37-lat)*200});
  const boundary = fetch('/data/japan-boundary.json').then(r => {
    if (!r.ok) throw new Error('Map boundary unavailable');
    return r.json();
  }).catch(() => null);
  const svgNS = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  window.MakerGeography = function (canvas, regions, color, selectRegion) {
    const stage = document.createElement('div');
    stage.className = 'map-stage';
    canvas.before(stage);
    stage.innerHTML = '<svg class="map-landscape" aria-hidden="true"><g data-map-terrain></g></svg><div class="map-pins" aria-label="Knife-making regions"></div><span class="map-north" aria-label="North is up">N &#8593;</span><p class="map-attribution">Boundaries: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Natural Earth</a></p>';
    stage.append(canvas);
    const terrain = stage.querySelector('[data-map-terrain]');
    const pinLayer = stage.querySelector('.map-pins');
    const picker = document.createElement('section');
    picker.className='map-region-picker';picker.hidden=true;
    picker.setAttribute('aria-label','Regions in this area');
    stage.append(picker);
    const anchors = new Map(regions.filter(r => coordinates[r.id]).map(r => [r.id, project(coordinates[r.id])]));
    let cy, active = '', frame = 0, signature = '';
    const bounds = {x1:project([128,46]).x, y1:project([128,46]).y, x2:project([146,30]).x, y2:project([146,30]).y};

    boundary.then(geo => {
      if (!geo) {
        stage.querySelector('.map-attribution').textContent = 'Map background unavailable. Region controls still work.';
        return;
      }
      const polygons = geo.geometry.type === 'MultiPolygon' ? geo.geometry.coordinates : [geo.geometry.coordinates];
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('class', 'map-coastline');
      path.setAttribute('fill-rule', 'evenodd');
      path.setAttribute('d', polygons.map(p => p.map(r => r.map((point,i) => {
        const {x,y} = project(point);
        return (i ? 'L' : 'M')+x.toFixed(1)+','+y.toFixed(1);
      }).join(' ')+'Z').join(' ')).join(' '));
      terrain.append(path);
      stage.dataset.boundaryReady = 'true';
    });

    function camera(box, animate = false, ceiling = 12) {
      if (!cy) return;
      cy.stop();
      const zoom = Math.min(ceiling, Math.max(.08, Math.min((cy.width()-40)/(box.x2-box.x1), (cy.height()-100)/(box.y2-box.y1))));
      const pan = {x:cy.width()/2-(box.x1+box.x2)/2*zoom, y:cy.height()/2-(box.y1+box.y2)/2*zoom};
      if (animate && !reducedMotion.matches) cy.animate({zoom, pan}, {duration:320});
      else cy.viewport({zoom, pan});
      sync();
    }

    function clusters() {
      const zoom = cy.zoom(), pan = cy.pan(), groups = [];
      // Cluster in screen space, not by administrative ownership.
      for (const region of regions) {
        if (!anchors.has(region.id)) continue;
        const p = anchors.get(region.id), x = p.x*zoom+pan.x, y = p.y*zoom+pan.y;
        const group = groups.find(g => Math.abs(g.x-x)<120 && Math.abs(g.y-y)<58);
        if (group) group.regions.push(region);
        else groups.push({x,y,regions:[region]});
      }
      return groups.filter(g => g.x>-70 && g.x<cy.width()+70 && g.y>15 && g.y<cy.height()-25);
    }

    function sync() {
      if (!cy || cy.destroyed()) return;
      if (active) { pinLayer.replaceChildren(); picker.hidden=true; signature=''; return; }
      const zoom = cy.zoom(), pan = cy.pan();
      terrain.setAttribute('transform', `translate(${pan.x} ${pan.y}) scale(${zoom})`);
      const groups = clusters();
      const next = groups.map(g => g.regions.map(r=>r.id).join(',')).join('|');
      if (next !== signature) {
        signature = next;
        pinLayer.replaceChildren();
        groups.forEach(group => {
          const first = group.regions[0], button = document.createElement('button');
          button.type = 'button'; button.className = 'map-region-pin';
          button.dataset.regions = group.regions.map(r=>r.id).join(',');
          button.style.setProperty('--pin-color',color(first.id));
          const name = document.createElement('strong'); name.textContent = first.name.split(' / ')[0];
          const detail = document.createElement('span');
          detail.textContent = group.regions.length>1
            ? '+'+(group.regions.length-1)+(group.regions.length===2?' region':' regions')
            : first.location===name.textContent ? first.nodes.length+' makers' : first.location;
          button.append(name,detail);
          button.title = group.regions.map(r=>r.name).join(', ');
          button.setAttribute('aria-label', group.regions.length>1 ? 'Zoom to '+button.title : 'Explore '+first.name);
          button.onclick = () => {
            if (group.regions.length === 1) selectRegion(first.id);
            else {
              picker.replaceChildren();picker.hidden=false;
              const heading=document.createElement('strong');heading.textContent='Regions in this area';
              const close=document.createElement('button');close.type='button';close.className='map-picker-close';
              close.innerHTML='&times;';close.setAttribute('aria-label','Close region list');close.title='Close region list';
              close.onclick=()=>{picker.hidden=true;canvas.focus({preventScroll:true});};
              picker.append(heading,close);
              const list=document.createElement('div');list.className='map-picker-list';
              group.regions.forEach(region=>{
                const choice=document.createElement('button');choice.type='button';choice.dataset.chooseRegion=region.id;
                choice.textContent=region.name;choice.style.setProperty('--pin-color',color(region.id));
                choice.onclick=()=>{picker.hidden=true;selectRegion(region.id);canvas.focus({preventScroll:true});};
                list.append(choice);
              });
              picker.append(list);list.firstElementChild.focus({preventScroll:true});
              const points = group.regions.map(r=>anchors.get(r.id));
              const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
              const x=(Math.min(...xs)+Math.max(...xs))/2, y=(Math.min(...ys)+Math.max(...ys))/2;
              const halfWidth=Math.max(5,(Math.max(...xs)-Math.min(...xs))*.8);
              const halfHeight=Math.max(5,(Math.max(...ys)-Math.min(...ys))*.8);
              camera({x1:x-halfWidth,y1:y-halfHeight,x2:x+halfWidth,y2:y+halfHeight},true);
            }
          };
          pinLayer.append(button);
        });
      }
      [...pinLayer.children].forEach((button,i) => {
        button.style.left=groups[i].x+'px'; button.style.top=groups[i].y+'px';
      });
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(() => {frame=0;sync();});
    }
    stage.addEventListener('keydown', event => {
      if(event.key==='Escape'){picker.hidden=true;canvas.focus({preventScroll:true});return;}
      if (event.target !== canvas || !cy) return;
      const directions = {ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]};
      if (directions[event.key]) {event.preventDefault();cy.panBy({x:directions[event.key][0],y:directions[event.key][1]});}
    });
    canvas.tabIndex=0;
    return {
      stage,
      bind(instance, region) {
        cy=instance;active=region;signature='';picker.hidden=true;
        stage.dataset.view=region?'network':'geography';
        for(const element of stage.querySelectorAll('.map-landscape,.map-north,.map-attribution,.map-pins'))element.style.display=region?'none':'';
        cy.on('pan zoom resize',schedule);sync();
      },
      overview(animate=false) {picker.hidden=true;camera(bounds,animate);},
      fit(animate=false) {
        if (!active) return camera(bounds,animate);
        const box=cy.elements().boundingBox();
        camera(box,animate,1.15);
      },
      sync
    };
  };
})();
