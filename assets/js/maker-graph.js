(function () {
  const root = document.querySelector('[data-maker-graph]');
  if (!root) return;

  const svg = root.querySelector('[data-graph-svg]');
  const geoSvg = document.querySelector('[data-region-map]');
  const regionFilter = root.querySelector('[data-region-filter]');
  const detail = root.querySelector('[data-graph-detail]');
  const sourceList = root.querySelector('[data-graph-sources]');
  const resetButtons = root.querySelectorAll('[data-graph-reset]');
  const title = root.querySelector('[data-graph-title]');
  const dek = root.querySelector('[data-graph-dek]');
  const cards = root.querySelector('[data-graph-cards]');
  const roleFilter = root.querySelector('[data-role-filter]');
  const searchInput = root.querySelector('[data-graph-search]');
  const mobileQuery = window.matchMedia('(max-width: 720px)');

  const state = {
    graph: null,
    regionById: new Map(),
    nodeById: new Map(),
    activeRegion: null,
    activeNode: null,
    activeEdgeKey: '',
    role: 'all',
    query: '',
    positions: new Map(),
    simulation: null,
    raf: 0,
    view: { x: 0, y: 0, scale: 1 },
    pan: null
  };

  const esc = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  const roleClass = (value) => String(value || 'node').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const regionColors = {
    sakai: '#ff5a4f',
    sanjo: '#f0a629',
    echizen: '#54c56b',
    'tosa-kochi': '#25b8a8',
    miki: '#46a5ff',
    'seki-gifu': '#9b8cff',
    'tsubame-niigata': '#d879ff',
    kyoto: '#f25f9c',
    aomori: '#6fd3ff',
    okayama: '#d4b75f',
    kumamoto: '#ff8a48',
    kagoshima: '#ff6f91',
    nagasaki: '#40c9a2',
    yamaguchi: '#d4e157',
    tanegashima: '#ffb74d',
    saga: '#80cbc4',
    hiroshima: '#4fc3f7',
    shimane: '#a1887f',
    miyazaki: '#ffab91',
    oita: '#b2dfdb',
    tokushima: '#aed581',
    tottori: '#ce93d8',
    fukuoka: '#90caf9',
    nagano: '#ffcc80',
    mie: '#c5e1a5',
    tokyo: '#f5eee3'
  };
  const regionGeoPositions = {
    aomori: [140.74, 40.82],
    'tsubame-niigata': [138.93, 37.67],
    sanjo: [138.96, 37.63],
    nagano: [138.18, 36.65],
    tokyo: [139.69, 35.69],
    echizen: [136.17, 35.90],
    'seki-gifu': [136.92, 35.49],
    kyoto: [135.77, 35.01],
    mie: [136.51, 34.73],
    miki: [134.99, 34.80],
    sakai: [135.48, 34.57],
    okayama: [133.92, 34.66],
    hiroshima: [132.46, 34.39],
    shimane: [132.76, 35.47],
    tottori: [134.24, 35.50],
    yamaguchi: [131.47, 34.19],
    tokushima: [134.56, 34.07],
    'tosa-kochi': [133.53, 33.56],
    fukuoka: [130.40, 33.59],
    saga: [130.30, 33.25],
    nagasaki: [129.87, 32.75],
    oita: [131.61, 33.24],
    kumamoto: [130.71, 32.80],
    miyazaki: [131.42, 31.91],
    kagoshima: [130.56, 31.60],
    tanegashima: [130.97, 30.73]
  };
  const regionLabelOffsets = {
    aomori: [100, -28],
    'tsubame-niigata': [-180, -58],
    sanjo: [86, -86],
    nagano: [128, -18],
    tokyo: [132, 26],
    echizen: [-190, -24],
    'seki-gifu': [134, -20],
    kyoto: [-196, -18],
    mie: [144, 58],
    miki: [-196, 58],
    sakai: [144, 54],
    okayama: [-190, -34],
    hiroshima: [-214, 28],
    shimane: [-198, -110],
    tottori: [66, -110],
    yamaguchi: [-218, 90],
    tokushima: [140, -8],
    'tosa-kochi': [134, 78],
    fukuoka: [-214, -116],
    saga: [-230, -52],
    nagasaki: [-226, 18],
    oita: [150, -88],
    kumamoto: [-224, 92],
    miyazaki: [152, 28],
    kagoshima: [-204, 156],
    tanegashima: [150, 152]
  };
  const regionMapLabelPositions = {
    aomori: [928, 258],
    sanjo: [820, 370],
    'tsubame-niigata': [548, 386],
    nagano: [842, 486],
    tokyo: [952, 568],
    echizen: [422, 538],
    'seki-gifu': [748, 568],
    kyoto: [452, 610],
    mie: [848, 660],
    miki: [352, 748],
    sakai: [620, 662],
    okayama: [234, 586],
    hiroshima: [298, 652],
    shimane: [178, 472],
    tottori: [386, 456],
    yamaguchi: [150, 808],
    tokushima: [660, 774],
    'tosa-kochi': [768, 892],
    fukuoka: [96, 650],
    saga: [82, 734],
    nagasaki: [92, 876],
    oita: [414, 812],
    kumamoto: [264, 890],
    miyazaki: [484, 940],
    kagoshima: [264, 1000],
    tanegashima: [540, 1000]
  };
  const edgeColors = {
    apprenticeship: '#2fbf71',
    student: '#2fbf71',
    family: '#2fbf71',
    'worked-under': '#2fbf71',
    'works-at': '#36a3ff',
    'workshop-background': '#36a3ff',
    'smith-to-sharpener': '#d99100',
    'brand-to-sharpener': '#d99100',
    'line-collaboration': '#ff6f61',
    'brand-to-line': '#ff6f61',
    collaboration: '#ff6f61',
    alias: '#18b7a2',
    'regional-peer': '#d7d1c5',
    'region-member': '#d7d1c5',
    'regional-hub': '#d7d1c5'
  };

  function roleTokens(role) {
    return String(role || 'node')
      .split(/\s*(?:\/|,|&|\band\b)\s*/i)
      .map(roleClass)
      .filter(Boolean);
  }

  function regionIdForNode(node) {
    if (!node) return '';
    if (node.isRegion) return node.regionId;
    return node.regionId || '';
  }

  function regionColor(id) {
    return regionColors[id] || '#ff5a4f';
  }

  function regionInitials(node) {
    const name = node && node.name ? node.name : '';
    if (!name) return '';
    return name
      .replace(/\s*\/\s*/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  function sourceMap() {
    return new Map((state.graph.sources || []).map((source) => [source.id, source]));
  }

  function buildIndexes(graph) {
    state.regionById.clear();
    state.nodeById.clear();
    state.nodeById.set('japan', {
      id: 'japan',
      name: 'Japan',
      role: 'Hub',
      isHub: true,
      specialty: 'Regional entry point for the maker map.'
    });

    graph.regions.forEach((region) => {
      state.regionById.set(region.id, region);
      state.nodeById.set(`region:${region.id}`, {
        id: `region:${region.id}`,
        regionId: region.id,
        name: region.name,
        role: 'Region',
        location: region.location,
        summary: region.summary,
        notes: region.notes || [],
        sourceIds: region.sourceIds || [],
        isRegion: true
      });
      region.nodes.forEach((node) => {
        state.nodeById.set(node.id, {
          ...node,
          regionId: region.id,
          regionName: region.name,
          location: region.location,
          sourceIds: node.sourceIds || []
        });
      });
    });
  }

  function nodeMatches(node) {
    if (!node || node.isRegion || node.isHub) return true;
    if (state.role !== 'all' && !roleTokens(node.role).includes(state.role)) return false;
    const haystack = [
      node.name,
      node.role,
      ...(node.aliases || []),
      node.regionName,
      node.specialty,
      ...(node.famousLines || [])
    ].join(' ').toLowerCase();
    return !state.query || haystack.includes(state.query);
  }

  function graphSelection() {
    if (!state.activeRegion) {
      const nodes = [
        state.nodeById.get('japan'),
        ...state.graph.regions.map((region) => state.nodeById.get(`region:${region.id}`))
      ].filter(Boolean);
      const edges = state.graph.regions.map((region) => ({
        from: 'japan',
        to: `region:${region.id}`,
        kind: 'regional-hub',
        label: region.name,
        detail: `${region.name} region entry point.`
      }));
      return { nodes, edges };
    }

    const region = state.activeRegion;
    const ids = new Set([`region:${region.id}`]);
    const directIds = new Set(region.nodes.filter(nodeMatches).map((node) => node.id));
    directIds.forEach((id) => ids.add(id));

    const relationshipEdges = (region.edges || []).filter((edge) => {
      const from = state.nodeById.get(edge.from);
      const to = state.nodeById.get(edge.to);
      if (!from || !to) return false;
      if (state.role === 'all' && !state.query) return true;
      return directIds.has(edge.from) || directIds.has(edge.to);
    });
    relationshipEdges.forEach((edge) => {
      ids.add(edge.from);
      ids.add(edge.to);
    });

    const membershipEdges = [...ids]
      .filter((id) => id !== `region:${region.id}`)
      .map((id) => ({
        from: `region:${region.id}`,
        to: id,
        kind: 'region-member',
        label: 'region',
        detail: `${state.nodeById.get(id).name} appears in the ${region.name} graph.`
      }));

    return {
      nodes: [...ids].map((id) => state.nodeById.get(id)).filter(Boolean),
      edges: [...membershipEdges, ...relationshipEdges]
    };
  }

  function graphDimensions() {
    const mobile = mobileQuery.matches;
    const denseRegionalMap = !state.activeRegion && (state.graph?.regions?.length || 0) > 16;
    return {
      width: state.activeRegion ? (mobile ? 980 : 1480) : denseRegionalMap ? (mobile ? 1180 : 1600) : (mobile ? 860 : 1180),
      height: state.activeRegion ? (mobile ? 980 : 980) : denseRegionalMap ? (mobile ? 1180 : 1100) : (mobile ? 820 : 760),
      ringRadius: state.activeRegion ? (mobile ? 330 : 430) : denseRegionalMap ? (mobile ? 430 : 470) : (mobile ? 285 : 280),
      memberDistance: state.activeRegion ? (mobile ? 330 : 430) : denseRegionalMap ? (mobile ? 420 : 470) : (mobile ? 285 : 285),
      relationDistance: state.activeRegion ? (mobile ? 310 : 390) : denseRegionalMap ? (mobile ? 390 : 430) : (mobile ? 300 : 390),
      repulsion: state.activeRegion ? (mobile ? 25500 : 36500) : (mobile ? 16800 : 16800),
      hubRepulsion: mobile ? 9800 : 9400
    };
  }

  function seedPosition(node, index, total) {
    const saved = state.positions.get(node.id);
    if (saved) return { ...node, x: saved.x, y: saved.y, vx: saved.vx || 0, vy: saved.vy || 0 };

    const { width, height, ringRadius } = graphDimensions();
    if (node.id === 'japan' || node.isRegion && state.activeRegion && node.regionId === state.activeRegion.id) {
      return { ...node, x: width / 2, y: height / 2, vx: 0, vy: 0 };
    }
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(total, 1);
    return {
      ...node,
      x: width / 2 + Math.cos(angle) * ringRadius + (Math.random() * 28 - 14),
      y: height / 2 + Math.sin(angle) * ringRadius + (Math.random() * 28 - 14),
      vx: 0,
      vy: 0
    };
  }

  function applyView() {
    const viewport = svg.querySelector('.graph-viewport');
    if (viewport) {
      viewport.setAttribute('transform', `translate(${state.view.x} ${state.view.y}) scale(${state.view.scale})`);
    }
  }

  function svgPoint(event) {
    const rect = svg.getBoundingClientRect();
    const box = svg.viewBox.baseVal;
    const rawX = box.x + ((event.clientX - rect.left) / rect.width) * box.width;
    const rawY = box.y + ((event.clientY - rect.top) / rect.height) * box.height;
    return {
      x: (rawX - state.view.x) / state.view.scale,
      y: (rawY - state.view.y) / state.view.scale
    };
  }

  function renderRegionFilter() {
    if (!regionFilter) return;
    regionFilter.innerHTML = '<option value="all">All regions</option>' + state.graph.regions.map((region) => (
      `<option value="${esc(region.id)}">${esc(region.name)} (${esc(region.location)})</option>`
    )).join('');
    regionFilter.value = state.activeRegion ? state.activeRegion.id : 'all';
  }

  function renderGeographyMap() {
    if (!geoSvg) return;
    const width = 1280;
    const height = 1040;
    const bounds = { minLon: 128.0, maxLon: 146.2, minLat: 29.45, maxLat: 45.85 };
    const padding = { left: 124, right: 112, top: 64, bottom: 92 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const project = ([lon, lat]) => ({
      x: padding.left + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * plotW,
      y: padding.top + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * plotH
    });
    const islandPath = (coords) => coords.map((coord, index) => {
      const point = project(coord);
      return `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }).join(' ') + ' Z';
    const islands = [
      {
        className: 'hokkaido',
        coords: [[140.1, 41.8], [141.1, 41.35], [142.2, 41.45], [143.3, 41.85], [144.7, 42.55], [145.55, 43.45], [145.25, 44.35], [143.95, 45.10], [142.35, 45.55], [140.75, 45.08], [139.72, 44.12], [139.88, 42.92]]
      },
      {
        className: 'honshu',
        coords: [[130.95, 34.18], [131.65, 34.45], [132.42, 34.24], [133.08, 34.05], [133.72, 34.36], [134.38, 34.65], [135.05, 34.48], [135.64, 34.72], [136.08, 35.35], [136.76, 35.55], [137.34, 35.18], [138.08, 35.92], [138.42, 36.82], [139.05, 37.42], [139.98, 37.58], [140.78, 38.25], [141.34, 39.18], [141.44, 40.30], [140.88, 40.82], [139.95, 40.52], [139.22, 39.72], [138.54, 38.72], [137.44, 37.62], [136.36, 36.58], [135.20, 35.76], [134.12, 35.52], [132.96, 35.42], [131.86, 35.02], [130.98, 34.62]]
      },
      {
        className: 'shikoku',
        coords: [[132.02, 33.48], [132.76, 33.18], [133.72, 33.38], [134.56, 33.64], [134.74, 34.12], [133.92, 34.36], [132.88, 34.20], [132.08, 33.86]]
      },
      {
        className: 'kyushu',
        coords: [[129.34, 31.55], [129.82, 31.08], [130.62, 30.92], [131.38, 31.42], [131.88, 32.20], [131.62, 33.05], [130.82, 33.72], [130.03, 33.62], [129.48, 32.92], [129.12, 32.12]]
      },
      {
        className: 'tanegashima-island',
        coords: [[130.78, 30.35], [131.02, 30.40], [131.08, 30.86], [130.94, 31.05], [130.80, 30.70]]
      }
    ];
    geoSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const points = state.graph.regions.map((region) => {
      const coord = regionGeoPositions[region.id] || [137.5, 36.0];
      const projected = project(coord);
      const [dx, dy] = regionLabelOffsets[region.id] || [76, -18];
      const positioned = regionMapLabelPositions[region.id];
      return {
        region,
        x: projected.x,
        y: projected.y,
        labelX: positioned ? positioned[0] : Math.max(86, Math.min(width - 86, projected.x + dx)),
        labelY: positioned ? positioned[1] : Math.max(46, Math.min(height - 46, projected.y + dy))
      };
    });
    geoSvg.innerHTML = `
      <defs>
        <linearGradient id="japan-map-fill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity=".26"></stop>
          <stop offset="100%" stop-color="currentColor" stop-opacity=".08"></stop>
        </linearGradient>
      </defs>
      <g class="japan-map-shape" aria-hidden="true">
        ${islands.map((island) => `<path class="${esc(island.className)}" d="${islandPath(island.coords)}"></path>`).join('')}
      </g>
      <g class="regional-map-callouts" aria-hidden="true">
        ${points.map((point) => {
          const active = state.activeRegion && state.activeRegion.id === point.region.id;
          return `<g class="regional-map-node${active ? ' is-active' : ''}" transform="translate(${point.x} ${point.y})" style="--region-color: ${esc(regionColor(point.region.id))}">
            <line class="map-callout-line" x1="0" y1="0" x2="${(point.labelX - point.x).toFixed(1)}" y2="${(point.labelY - point.y).toFixed(1)}"></line>
          </g>`;
        }).join('')}
      </g>
      <g class="regional-map-pins">
        ${points.map((point) => {
          const active = state.activeRegion && state.activeRegion.id === point.region.id;
          return `<g class="regional-map-node${active ? ' is-active' : ''}" data-map-region="${esc(point.region.id)}" aria-label="Open ${esc(point.region.name)}" transform="translate(${point.x} ${point.y})" style="--region-color: ${esc(regionColor(point.region.id))}">
            <circle class="map-pin-halo" r="14"></circle>
            <circle class="map-pin" r="5"></circle>
          </g>`;
        }).join('')}
      </g>
      <g class="regional-map-labels">
        ${points.map((point) => {
          const active = state.activeRegion && state.activeRegion.id === point.region.id;
          return `<g class="regional-map-node${active ? ' is-active' : ''}" data-map-region="${esc(point.region.id)}" tabindex="0" role="button" aria-label="Open ${esc(point.region.name)}" transform="translate(${point.labelX} ${point.labelY})" style="--region-color: ${esc(regionColor(point.region.id))}">
            <rect class="map-label-bg" x="-77" y="-26" width="154" height="52" rx="16"></rect>
            <text class="region-flag" y="-7">${esc(compactLabel(point.region.name, 16))}</text>
            <text class="small" y="13">${esc(compactLabel(point.region.location, 15))}</text>
          </g>`;
        }).join('')}
      </g>
    `;
    geoSvg.querySelectorAll('[data-map-region]').forEach((node) => {
      node.addEventListener('click', () => selectRegion(node.dataset.mapRegion));
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectRegion(node.dataset.mapRegion);
        }
      });
    });
  }

  function edgeClass(edge) {
    return `graph-edge ${edgeMetaClass(edge)}`;
  }

  function edgeMetaClass(edge) {
    return `edge-${roleClass(edge.kind)} source-${roleClass(edge.sourceType || 'direct')} confidence-${roleClass(edge.confidence || 'standard')}`;
  }

  function edgeKey(edge) {
    return `${edge.from}:${edge.to}`;
  }

  function renderGraph() {
    if (state.simulation) state.simulation.stop();
    cancelAnimationFrame(state.raf);

    const selection = graphSelection();
    const { width, height } = graphDimensions();
    const nodes = selection.nodes.map((node, index) => seedPosition(node, index, selection.nodes.length));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = selection.edges
      .map((edge) => ({ ...edge, source: nodeById.get(edge.from), target: nodeById.get(edge.to) }))
      .filter((edge) => edge.source && edge.target);

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.classList.toggle('is-active-region', Boolean(state.activeRegion));
    svg.innerHTML = `
      <defs>
        <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z"></path>
        </marker>
      </defs>
      <g class="graph-viewport">
        <g class="graph-hit-lines">
          ${edges.map((edge) => edgeShouldLabel(edge) ? `<line class="graph-edge-hit" data-edge-hit="${esc(edgeKey(edge))}"></line>` : '').join('')}
        </g>
        <g class="graph-lines">
          ${edges.map((edge) => `<line class="${esc(edgeClass(edge))}" data-edge="${esc(edgeKey(edge))}" style="${esc(edgeStyle(edge))}"${edge.kind !== 'region-member' && edge.kind !== 'regional-hub' ? ' marker-end="url(#graph-arrow)"' : ''}></line>`).join('')}
        </g>
        <g class="graph-labels">
          ${edges.map((edge) => edgeLabelMarkup(edge)).join('')}
        </g>
        <g class="graph-nodes">
          ${nodes.map((node) => nodeMarkup(node)).join('')}
        </g>
      </g>
    `;
    applyView();

    nodes.forEach((node) => {
      const group = svg.querySelector(`[data-node="${CSS.escape(node.id)}"]`);
      if (!group) return;
      group.addEventListener('click', () => selectNode(node.id));
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectNode(node.id);
        }
      });
      enableDrag(group, node, nodes, edges);
    });
    edges.filter(edgeShouldLabel).forEach((edge) => {
      const key = edgeKey(edge);
      svg.querySelectorAll(`[data-edge="${CSS.escape(key)}"], [data-edge-hit="${CSS.escape(key)}"], [data-edge-label="${CSS.escape(key)}"]`).forEach((element) => {
        element.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          selectEdge(edge);
        });
      });
    });

    state.simulation = createSimulation(nodes, edges, width, height);
    state.currentNodes = nodes;
    state.currentEdges = edges;
    state.simulation.start();
  }

  function edgeLabelMarkup(edge) {
    if (!edgeShouldLabel(edge)) return '';
    const text = shortEdgeLabel(edge.label || edge.kind);
    const width = Math.max(72, Math.min(220, text.length * 8.4 + 28));
    return `
      <g class="edge-label-wrap ${esc(edgeMetaClass(edge))}" data-edge-label="${esc(edgeKey(edge))}">
        <g style="${esc(edgeStyle(edge))}">
        <rect x="${-width / 2}" y="-15" width="${width}" height="30" rx="15"></rect>
        <text y="1">${esc(text)}</text>
        </g>
      </g>
    `;
  }

  function edgeStyle(edge) {
    const edgeColor = edgeColors[edge.kind] || '#d7d1c5';
    const regionId = edge.to.replace(/^region:/, '');
    const regionStyle = edge.kind === 'regional-hub' ? `--region-color: ${regionColor(regionId)}; ` : '';
    return `${regionStyle}--edge-color: ${edgeColor}`;
  }

  function edgeShouldLabel(edge) {
    if (edge.kind === 'region-member') return false;
    if (edge.kind === 'regional-hub') return false;
    return true;
  }

  function shortEdgeLabel(value) {
    const text = String(value || '').trim();
    if (text.length <= 32) return text;
    return `${text.slice(0, 30)}...`;
  }

  function nodeMarkup(node) {
    const active = state.activeNode && state.activeNode.id === node.id;
    const className = [
      'graph-node',
      node.isHub ? 'hub-node' : '',
      node.isRegion ? 'region-node' : 'maker-node',
      ...roleTokens(node.role).map((role) => `role-${role}`),
      active ? 'is-active' : ''
    ].filter(Boolean).join(' ');
    const radius = node.isHub ? 86 : node.isRegion ? 92 : 76;
    const label = node.isHub ? 'Open regional map' : node.isRegion ? `Open ${node.name}` : `Open ${node.name}`;
    const regionId = regionIdForNode(node);
    const style = regionId ? ` style="--region-color: ${esc(regionColor(regionId))}"` : '';
    return `
      <g class="${esc(className)}" tabindex="0" role="button" aria-label="${esc(label)}" data-node="${esc(node.id)}"${style}>
        <circle r="${radius}"></circle>
        ${nodeTextMarkup(node)}
      </g>
    `;
  }

  function nodeTextMarkup(node) {
    const primary = node.isHub ? 'Japan' : node.isRegion ? node.name : node.name;
    const secondary = node.isHub ? 'Hub' : node.isRegion ? node.location : node.role;
    return `
      <foreignObject class="node-label-box" x="-68" y="-42" width="136" height="84">
        <div xmlns="http://www.w3.org/1999/xhtml" class="node-html-label">
          <span class="node-primary">${esc(primary)}</span>
          <span class="node-secondary">${esc(secondary)}</span>
        </div>
      </foreignObject>
    `;
  }

  function regionNameLines(value) {
    const parts = String(value || '').split(/\s*\/\s*/).filter(Boolean);
    if (parts.length > 1) return parts.slice(0, 2).map((part) => compactLabel(part, 10));
    return wrapLabel(value, 11, 2);
  }

  function makerNameLines(value) {
    return wrapLabel(value, 12, 2);
  }

  function wrapLabel(value, maxLength, maxLines) {
    const words = String(value || '').replace(/\s*\/\s*/g, ' / ').split(/\s+/).filter(Boolean);
    const lines = [];
    words.forEach((word) => {
      const current = lines[lines.length - 1] || '';
      const next = current ? `${current} ${word}` : word;
      if (!current || next.length <= maxLength) {
        lines[lines.length - 1] = next;
      } else if (lines.length < maxLines) {
        lines.push(word);
      } else {
        lines[lines.length - 1] = `${lines[lines.length - 1]} ${word}`;
      }
    });
    if (!lines.length) return [''];
    return lines.slice(0, maxLines).map((line) => compactLabel(line, maxLength + 2));
  }

  function compactLabel(value, maxLength) {
    const text = String(value || '');
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
  }

  function shortLabel(value) {
    const text = String(value || '');
    if (text.length <= 18) return text;
    return `${text.slice(0, 16)}...`;
  }

  function tick(nodes, edges) {
    updateFocusClasses(nodes, edges);
    edges.forEach((edge) => {
      const key = edgeKey(edge);
      const line = svg.querySelector(`[data-edge="${CSS.escape(key)}"]`);
      const hitLine = svg.querySelector(`[data-edge-hit="${CSS.escape(key)}"]`);
      if (!line) return;
      [line, hitLine].filter(Boolean).forEach((edgeLine) => {
        edgeLine.setAttribute('x1', edge.source.x);
        edgeLine.setAttribute('y1', edge.source.y);
        edgeLine.setAttribute('x2', edge.target.x);
        edgeLine.setAttribute('y2', edge.target.y);
      });
      const label = svg.querySelector(`[data-edge-label="${CSS.escape(key)}"]`);
      if (label) {
        const midX = (edge.source.x + edge.target.x) / 2;
        const midY = (edge.source.y + edge.target.y) / 2;
        const dx = edge.target.x - edge.source.x || 0.01;
        const dy = edge.target.y - edge.source.y || 0.01;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const offset = edge.kind === 'regional-peer' ? 18 : 0;
        const x = midX + (-dy / distance) * offset;
        const y = midY + (dx / distance) * offset;
        label.setAttribute('transform', `translate(${x} ${y})`);
      }
    });

    nodes.forEach((node) => {
      state.positions.set(node.id, { x: node.x, y: node.y, vx: node.vx, vy: node.vy });
      const group = svg.querySelector(`[data-node="${CSS.escape(node.id)}"]`);
      if (group) group.setAttribute('transform', `translate(${node.x} ${node.y})`);
    });
  }

  function updateFocusClasses(nodes, edges) {
    const activeId = state.activeNode && !state.activeNode.isHub && !state.activeNode.isRegion ? state.activeNode.id : null;
    const activeEdgeKey = state.activeEdgeKey;
    const activeEdge = activeEdgeKey ? edges.find((edge) => edgeKey(edge) === activeEdgeKey) : null;
    const connected = new Set(activeId ? [activeId] : activeEdge ? [activeEdge.from, activeEdge.to] : []);
    if (activeId || activeEdge) {
      edges.forEach((edge) => {
        if (edge.kind === 'region-member') return;
        if (activeId && edge.from === activeId) connected.add(edge.to);
        if (activeId && edge.to === activeId) connected.add(edge.from);
      });
    }

    const hasFocus = Boolean(activeId || activeEdge);
    svg.classList.toggle('has-focused-node', hasFocus);
    svg.classList.toggle('has-focused-item', hasFocus);
    nodes.forEach((node) => {
      const group = svg.querySelector(`[data-node="${CSS.escape(node.id)}"]`);
      if (!group) return;
      group.classList.toggle('is-active', Boolean(activeId && node.id === activeId));
      group.classList.toggle('is-connected', Boolean(hasFocus && connected.has(node.id)));
      group.classList.toggle('is-dimmed', Boolean(hasFocus && !connected.has(node.id) && !node.isRegion));
    });

    edges.forEach((edge) => {
      const focused = Boolean(
        edge.kind !== 'region-member' &&
        (activeEdgeKey && edgeKey(edge) === activeEdgeKey || activeId && (edge.from === activeId || edge.to === activeId))
      );
      const key = edgeKey(edge);
      const line = svg.querySelector(`[data-edge="${CSS.escape(key)}"]`);
      const hitLine = svg.querySelector(`[data-edge-hit="${CSS.escape(key)}"]`);
      const label = svg.querySelector(`[data-edge-label="${CSS.escape(key)}"]`);
      [line, hitLine].filter(Boolean).forEach((edgeLine) => {
        edgeLine.classList.toggle('is-focused', focused);
        edgeLine.classList.toggle('is-dimmed', Boolean(hasFocus && !focused));
        edgeLine.style.opacity = hasFocus ? (focused ? '1' : '0.16') : '';
      });
      if (label) {
        label.classList.toggle('is-focused', focused);
        label.classList.toggle('is-dimmed', Boolean(hasFocus && !focused));
        label.style.opacity = state.activeRegion && hasFocus ? (focused ? '1' : '0') : '';
      }
    });
  }

  function applyFocusState() {
    if (state.currentNodes && state.currentEdges) updateFocusClasses(state.currentNodes, state.currentEdges);
  }

  function createSimulation(nodes, edges, width, height) {
    let alpha = 1;
    let stopped = false;
    const centerX = width / 2;
    const centerY = height / 2;

    function step() {
      if (stopped) {
        state.raf = 0;
        return;
      }
      const byId = new Map(nodes.map((node) => [node.id, node]));

      edges.forEach((edge) => {
        const source = byId.get(edge.from);
        const target = byId.get(edge.to);
        if (!source || !target) return;
        const dx = target.x - source.x || 0.01;
        const dy = target.y - source.y || 0.01;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dimensions = graphDimensions();
        const desired = edge.kind === 'region-member' || edge.kind === 'regional-hub' ? dimensions.memberDistance : dimensions.relationDistance;
        const force = ((distance - desired) / distance) * (state.activeRegion ? 0.011 : 0.013) * alpha;
        const fx = dx * force;
        const fy = dy * force;
        if (!source.fixed) {
          source.vx += fx;
          source.vy += fy;
        }
        if (!target.fixed) {
          target.vx -= fx;
          target.vy -= fy;
        }
      });

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x || 0.01;
          const dy = b.y - a.y || 0.01;
          const distanceSq = Math.max(dx * dx + dy * dy, 900);
          const dimensions = graphDimensions();
          const force = (a.isHub || b.isHub ? dimensions.hubRepulsion : dimensions.repulsion) / distanceSq * alpha;
          const distance = Math.sqrt(distanceSq);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          if (!a.fixed) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (!b.fixed) {
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      nodes.forEach((node) => {
        if (node.id === 'japan' || node.isRegion && state.activeRegion && node.regionId === state.activeRegion.id) {
          node.vx += (centerX - node.x) * 0.016 * alpha;
          node.vy += (centerY - node.y) * 0.016 * alpha;
        } else {
          node.vx += (centerX - node.x) * (state.activeRegion ? 0.0014 : 0.0028) * alpha;
          node.vy += (centerY - node.y) * (state.activeRegion ? 0.0014 : 0.0028) * alpha;
        }
        if (!node.fixed) {
          node.x += node.vx;
          node.y += node.vy;
        }
        node.vx *= 0.82;
        node.vy *= 0.82;
        node.x = Math.max(62, Math.min(width - 62, node.x));
        node.y = Math.max(62, Math.min(height - 62, node.y));
      });

      tick(nodes, edges);
      alpha *= 0.988;
      if (alpha > 0.025 || nodes.some((node) => node.fixed)) {
        state.raf = requestAnimationFrame(step);
      } else {
        state.raf = 0;
      }
    }

    return {
      start() {
        stopped = false;
        state.raf = requestAnimationFrame(step);
      },
      stop() {
        stopped = true;
      },
      heat(value) {
        alpha = Math.max(alpha, value);
        if (!state.raf) state.raf = requestAnimationFrame(step);
      }
    };
  }

  function enableDrag(group, node, nodes, edges) {
    group.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      group.setPointerCapture(event.pointerId);
      node.fixed = true;
      group.classList.add('is-dragging');
      selectNode(node.id, { keepGraph: true });
    });

    group.addEventListener('pointermove', (event) => {
      if (!node.fixed) return;
      const point = svgPoint(event);
      node.x = point.x;
      node.y = point.y;
      node.vx = 0;
      node.vy = 0;
      tick(nodes, edges);
      if (state.simulation) state.simulation.heat(0.35);
    });

    function release(event) {
      if (!node.fixed) return;
      node.fixed = false;
      group.classList.remove('is-dragging');
      if (event.pointerId !== undefined && group.hasPointerCapture(event.pointerId)) {
        group.releasePointerCapture(event.pointerId);
      }
      if (state.simulation) state.simulation.heat(0.2);
    }

    group.addEventListener('pointerup', release);
    group.addEventListener('pointercancel', release);
  }

  function bindViewportControls() {
    svg.addEventListener('wheel', (event) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const box = svg.viewBox.baseVal;
      const x = box.x + ((event.clientX - rect.left) / rect.width) * box.width;
      const y = box.y + ((event.clientY - rect.top) / rect.height) * box.height;
      const previous = state.view.scale;
      const next = Math.max(0.62, Math.min(1.85, previous * (event.deltaY > 0 ? 0.92 : 1.08)));
      state.view.x = x - (x - state.view.x) * (next / previous);
      state.view.y = y - (y - state.view.y) * (next / previous);
      state.view.scale = next;
      applyView();
    }, { passive: false });

    svg.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.graph-node')) return;
      const rect = svg.getBoundingClientRect();
      const box = svg.viewBox.baseVal;
      state.pan = {
        x: event.clientX,
        y: event.clientY,
        unitX: box.width / rect.width,
        unitY: box.height / rect.height
      };
      svg.classList.add('is-panning');
      svg.setPointerCapture(event.pointerId);
    });

    svg.addEventListener('pointermove', (event) => {
      if (!state.pan) return;
      state.view.x += (event.clientX - state.pan.x) * state.pan.unitX;
      state.view.y += (event.clientY - state.pan.y) * state.pan.unitY;
      state.pan.x = event.clientX;
      state.pan.y = event.clientY;
      applyView();
    });

    function endPan(event) {
      if (!state.pan) return;
      state.pan = null;
      svg.classList.remove('is-panning');
      if (event.pointerId !== undefined && svg.hasPointerCapture(event.pointerId)) {
        svg.releasePointerCapture(event.pointerId);
      }
    }

    svg.addEventListener('pointerup', endPan);
    svg.addEventListener('pointercancel', endPan);
  }

  function wikiLabel(node) {
    if (!node) return '';
    if (node.isRegion) return node.name;
    if (node.isHub) return node.name;
    return `${node.name} (${node.regionName} ${String(node.role || 'maker').toLowerCase()})`;
  }

  function wikiButton(node) {
    if (!node) return '';
    return `<button class="wiki-link" type="button" data-wiki="${esc(node.id)}">[[${esc(wikiLabel(node))}]]</button>`;
  }

  function renderCards(nodes) {
    const makerNodes = nodes.filter((node) => !node.isHub && !node.isRegion);
    cards.innerHTML = makerNodes.map((node) => `
      <button class="maker-card role-${esc(roleClass(node.role))}" type="button" data-node-card="${esc(node.id)}">
        <span>${esc(node.role)}</span>
        <strong>${esc(node.name)}</strong>
        <small>${esc((node.famousLines || []).slice(0, 3).join(' / '))}</small>
      </button>
    `).join('') || '<p class="muted">No makers match this filter.</p>';
    cards.querySelectorAll('[data-node-card]').forEach((button) => {
      button.addEventListener('click', () => selectNode(button.dataset.nodeCard));
    });
  }

  function renderRegionDetail(regionNode) {
    const region = state.regionById.get(regionNode.regionId);
    const people = region.nodes.map((node) => state.nodeById.get(node.id)).filter(Boolean);
    detail.innerHTML = `
      <article class="graph-note">
        <h2>${esc(region.name)}</h2>
        <section>
          <h3>Role</h3>
          <p>Region (${esc(region.location)})</p>
        </section>
        <section>
          <h3>People</h3>
          <div class="wiki-list">${people.map(wikiButton).join('')}</div>
        </section>
        <section>
          <h3>Context</h3>
          <p>${esc(region.summary)}</p>
          ${(region.notes || []).length ? `<ul>${region.notes.map((note) => `<li>${esc(note)}</li>`).join('')}</ul>` : ''}
        </section>
      </article>
    `;
    bindWikiLinks();
    renderSources(region.sourceIds || []);
  }

  function relatedEdges(node) {
    return state.graph.regions.flatMap((region) => (region.edges || []).map((edge) => ({ ...edge, regionId: region.id })))
      .filter((edge) => edge.from === node.id || edge.to === node.id);
  }

  function renderNodeDetail(node) {
    if (node.id === 'japan') {
      detail.innerHTML = `
        <article class="graph-note">
          <h2>Select a region.</h2>
          <section>
            <h3>Map controls</h3>
            <p>Use the region and filter panels above, then click a node or relationship edge to open its profile here.</p>
          </section>
        </article>
      `;
      renderSources([]);
      return;
    }

    if (node.isRegion) {
      renderRegionDetail(node);
      return;
    }

    const edges = relatedEdges(node);
    const studentIds = new Set(node.students || []);
    const teacherIds = new Set();
    edges.forEach((edge) => {
      if (edge.kind === 'student' || edge.kind === 'apprenticeship' || edge.kind === 'family' || edge.kind === 'worked-under') {
        if (edge.from === node.id) studentIds.add(edge.to);
        if (edge.to === node.id) teacherIds.add(edge.from);
      }
    });
    const regionNode = state.nodeById.get(`region:${node.regionId}`);
    const edgeSources = edges.flatMap((edge) => edge.sourceIds || []);
    const sources = [...new Set([...(state.regionById.get(node.regionId).sourceIds || []), ...(node.sourceIds || []), ...edgeSources])];

    detail.innerHTML = `
      <article class="graph-note">
        <h2>${esc(node.name)}</h2>
        <section>
          <h3>Role</h3>
          <p>${esc(node.role)} (${esc(node.regionName)})</p>
        </section>
        ${(node.aliases || []).length ? `<section><h3>Also appears as</h3><div class="line-list">${node.aliases.map((alias) => `<span>${esc(alias)}</span>`).join('')}</div></section>` : ''}
        ${studentIds.size ? `<section><h3>Students</h3><div class="wiki-list">${[...studentIds].map((id) => wikiButton(state.nodeById.get(id))).join('')}</div></section>` : ''}
        ${teacherIds.size ? `<section><h3>Teachers</h3><div class="wiki-list">${[...teacherIds].map((id) => wikiButton(state.nodeById.get(id))).join('')}</div></section>` : ''}
        <section>
          <h3>Region</h3>
          <div class="wiki-list">${wikiButton(regionNode)}</div>
        </section>
        <section>
          <h3>Specialty</h3>
          <p>${esc(node.specialty)}</p>
        </section>
        ${(node.famousLines || []).length ? `<section><h3>Known lines</h3><div class="line-list">${node.famousLines.map((line) => `<span>${esc(line)}</span>`).join('')}</div></section>` : ''}
        ${edges.length ? `<section><h3>Edges</h3><ul>${edges.map((edge) => {
          const other = state.nodeById.get(edge.from === node.id ? edge.to : edge.from);
          const sourceNote = edge.sourceType ? ` <span class="edge-source-note">${esc(edge.sourceType)}${edge.confidence ? ` / ${esc(edge.confidence)}` : ''}</span>` : '';
          return `<li><b>${esc(edge.label)}</b>${other ? ` with ${wikiButton(other)}` : ''}${sourceNote}: ${esc(edge.detail)}</li>`;
        }).join('')}</ul></section>` : ''}
        ${node.caveat ? `<p class="graph-caveat">${esc(node.caveat)}</p>` : ''}
      </article>
    `;
    bindWikiLinks();
    renderSources(sources);
  }

  function renderEdgeDetail(edge) {
    const from = state.nodeById.get(edge.from);
    const to = state.nodeById.get(edge.to);
    const sources = [...new Set([...(edge.sourceIds || []), ...(from && from.sourceIds || []), ...(to && to.sourceIds || [])])];
    detail.innerHTML = `
      <article class="graph-note">
        <h2>${esc(edge.label || edge.kind)}</h2>
        <section>
          <h3>Relationship</h3>
          <p>${from ? wikiButton(from) : esc(edge.from)} to ${to ? wikiButton(to) : esc(edge.to)}</p>
        </section>
        <section>
          <h3>Type</h3>
          <p>${esc(edge.kind)}${edge.sourceType ? ` · ${esc(edge.sourceType)}` : ''}${edge.confidence ? ` · ${esc(edge.confidence)} confidence` : ''}</p>
        </section>
        <section>
          <h3>Context</h3>
          <p>${esc(edge.detail || 'Relationship context pending.')}</p>
        </section>
      </article>
    `;
    bindWikiLinks();
    renderSources(sources);
  }

  function renderSources(ids) {
    const byId = sourceMap();
    const sources = [...new Set(ids)].map((id) => byId.get(id)).filter(Boolean);
    sourceList.innerHTML = sources.length
      ? sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)}</a>`).join('')
      : '<span>Source trail pending for this node.</span>';
  }

  function bindWikiLinks() {
    detail.querySelectorAll('[data-wiki]').forEach((button) => {
      button.addEventListener('click', () => selectNode(button.dataset.wiki));
    });
  }

  function selectRegion(id) {
    state.activeRegion = state.regionById.get(id) || null;
    state.activeNode = state.activeRegion ? state.nodeById.get(`region:${state.activeRegion.id}`) : null;
    state.activeEdgeKey = '';
    state.role = 'all';
    state.query = '';
    roleFilter.value = 'all';
    if (regionFilter) regionFilter.value = state.activeRegion ? state.activeRegion.id : 'all';
    searchInput.value = '';
    state.view = { x: 0, y: 0, scale: 1 };
    syncView();
  }

  function selectNode(id, options = {}) {
    const node = state.nodeById.get(id);
    if (!node) return;
    state.activeEdgeKey = '';
    if (node.id === 'japan') {
      state.activeRegion = null;
      state.activeNode = node;
    } else if (node.isRegion) {
      state.activeRegion = state.regionById.get(node.regionId);
      state.activeNode = node;
    } else {
      state.activeRegion = state.regionById.get(node.regionId);
      state.activeNode = node;
    }
    if (!options.keepGraph) syncView();
    else {
      renderRegionFilter();
      renderGeographyMap();
      renderNodeDetail(node);
      applyFocusState();
    }
  }

  function selectEdge(edge) {
    state.activeEdgeKey = edgeKey(edge);
    state.activeNode = null;
    renderRegionFilter();
    renderGeographyMap();
    renderEdgeDetail(edge);
    applyFocusState();
  }

  function syncView() {
    renderRegionFilter();
    renderGeographyMap();
    resetButtons.forEach((button) => {
      button.hidden = !state.activeRegion;
    });
    roleFilter.hidden = !state.activeRegion;
    if (state.activeRegion) {
      title.textContent = state.activeRegion.name;
      dek.textContent = 'Click a maker to reveal its relationship labels. Drag nodes or pan the canvas.';
    } else {
      title.textContent = 'Regional map';
      dek.textContent = 'Start with a regional node, then expand into people, workshops, relationships and famous lines.';
    }
    const selection = graphSelection();
    renderGraph();
    renderCards(selection.nodes);
    if (state.activeNode) renderNodeDetail(state.activeNode);
    else if (state.activeRegion) renderRegionDetail(state.nodeById.get(`region:${state.activeRegion.id}`));
    else renderNodeDetail(state.nodeById.get('japan'));
  }

  if (regionFilter) {
    regionFilter.addEventListener('change', () => {
      if (regionFilter.value === 'all') {
        resetToRegionalMap();
      } else {
        selectRegion(regionFilter.value);
      }
    });
  }

  roleFilter.addEventListener('change', () => {
    state.role = roleFilter.value;
    state.activeNode = state.activeRegion ? state.nodeById.get(`region:${state.activeRegion.id}`) : null;
    state.activeEdgeKey = '';
    syncView();
  });

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value.trim().toLowerCase();
    state.activeNode = state.activeRegion ? state.nodeById.get(`region:${state.activeRegion.id}`) : null;
    state.activeEdgeKey = '';
    if (state.activeRegion) syncView();
  });

  function resetToRegionalMap() {
    state.activeRegion = null;
    state.activeNode = state.nodeById.get('japan');
    state.activeEdgeKey = '';
    state.role = 'all';
    state.query = '';
    roleFilter.value = 'all';
    if (regionFilter) regionFilter.value = 'all';
    searchInput.value = '';
    state.view = { x: 0, y: 0, scale: 1 };
    syncView();
  }

  resetButtons.forEach((button) => {
    button.addEventListener('click', resetToRegionalMap);
  });
  mobileQuery.addEventListener('change', () => {
    state.positions.clear();
    state.view = { x: 0, y: 0, scale: 1 };
    if (state.graph) syncView();
  });

  bindViewportControls();

  fetch('/data/maker-graph.json')
    .then((response) => response.json())
    .then((data) => {
      state.graph = data;
      buildIndexes(data);
      state.activeNode = state.nodeById.get('japan');
      syncView();
    })
    .catch(() => {
      detail.innerHTML = '<strong>Maker map could not load.</strong><span>Try refreshing the page.</span>';
    });
})();
