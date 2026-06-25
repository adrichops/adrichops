(function () {
  const root = document.querySelector('[data-maker-graph]');
  if (!root) return;

  const svg = root.querySelector('[data-graph-svg]');
  const regionList = root.querySelector('[data-region-list]');
  const detail = root.querySelector('[data-graph-detail]');
  const sourceList = root.querySelector('[data-graph-sources]');
  const resetButton = root.querySelector('[data-graph-reset]');
  const title = root.querySelector('[data-graph-title]');
  const dek = root.querySelector('[data-graph-dek]');
  const cards = root.querySelector('[data-graph-cards]');
  const roleFilter = root.querySelector('[data-role-filter]');
  const searchInput = root.querySelector('[data-graph-search]');

  let graph = null;
  let activeRegion = null;
  let activeNode = null;
  let role = 'all';
  let query = '';

  const roleClass = (value) => String(value || 'node').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const esc = (value) => String(value || '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));

  function sourceMap() {
    return new Map((graph.sources || []).map((source) => [source.id, source]));
  }

  function nodeMatches(node) {
    if (role !== 'all' && roleClass(node.role) !== role) return false;
    const hay = [node.name, node.role, node.specialty, ...(node.famousLines || [])].join(' ').toLowerCase();
    return !query || hay.includes(query);
  }

  function renderRegions() {
    regionList.innerHTML = graph.regions.map((region) => `
      <button class="region-button" type="button" data-region="${esc(region.id)}" aria-pressed="${activeRegion && activeRegion.id === region.id ? 'true' : 'false'}">
        <strong>${esc(region.name)}</strong>
        <span>${esc(region.location)}</span>
      </button>
    `).join('');
    regionList.querySelectorAll('[data-region]').forEach((button) => {
      button.addEventListener('click', () => selectRegion(button.dataset.region));
    });
  }

  function pointOnEllipse(index, total, cx, cy, rx, ry) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(total, 1);
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry
    };
  }

  function renderOverview() {
    activeRegion = null;
    activeNode = null;
    title.textContent = 'Regional map';
    dek.textContent = 'Start with a region node. Click Sakai, Sanjo, Echizen or Miki to expand the people, roles, relationships and lines inside it.';
    detail.innerHTML = '<strong>Pick a region.</strong><span>The graph starts broad on purpose. Region is context; the useful layer is the relationship between smith, sharpener, workshop, brand and line.</span>';
    cards.innerHTML = '';
    sourceList.innerHTML = '';
    roleFilter.hidden = true;
    searchInput.value = '';
    query = '';
    renderRegions();

    const width = 900;
    const height = 560;
    const cx = width / 2;
    const cy = height / 2;
    const points = graph.regions.map((region, index) => ({ region, ...pointOnEllipse(index, graph.regions.length, cx, cy, 300, 170) }));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = `
      <g class="graph-lines">
        ${points.map((point) => `<line x1="${cx}" y1="${cy}" x2="${point.x}" y2="${point.y}"></line>`).join('')}
      </g>
      <g class="graph-center"><circle cx="${cx}" cy="${cy}" r="70"></circle><text x="${cx}" y="${cy - 6}">Japan</text><text class="small" x="${cx}" y="${cy + 18}">maker map</text></g>
      <g class="graph-nodes">
        ${points.map((point) => `
          <g class="graph-node region-node" tabindex="0" role="button" aria-label="Open ${esc(point.region.name)}" data-region="${esc(point.region.id)}" transform="translate(${point.x} ${point.y})">
            <circle r="62"></circle>
            <text y="-4">${esc(point.region.name)}</text>
            <text class="small" y="20">${esc(point.region.location)}</text>
          </g>
        `).join('')}
      </g>
    `;
    svg.querySelectorAll('[data-region]').forEach((node) => {
      node.addEventListener('click', () => selectRegion(node.dataset.region));
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectRegion(node.dataset.region);
        }
      });
    });
  }

  function renderRegion() {
    renderRegions();
    roleFilter.hidden = false;
    title.textContent = activeRegion.name;
    dek.textContent = activeRegion.summary;

    const width = 980;
    const height = 620;
    const cx = width / 2;
    const cy = height / 2;
    const visibleNodes = activeRegion.nodes.filter(nodeMatches);
    const positions = new Map();
    visibleNodes.forEach((node, index) => {
      positions.set(node.id, pointOnEllipse(index, visibleNodes.length, cx, cy, 330, 205));
    });
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = (activeRegion.edges || []).filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to));

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = `
      <g class="graph-lines">
        ${visibleEdges.map((edge) => {
          const a = positions.get(edge.from);
          const b = positions.get(edge.to);
          return `<line class="edge-${esc(roleClass(edge.kind))}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line><text class="edge-label" x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 8}">${esc(edge.label)}</text>`;
        }).join('')}
      </g>
      <g class="graph-center"><circle cx="${cx}" cy="${cy}" r="78"></circle><text x="${cx}" y="${cy - 8}">${esc(activeRegion.name)}</text><text class="small" x="${cx}" y="${cy + 18}">${esc(activeRegion.location)}</text></g>
      <g class="graph-nodes">
        ${visibleNodes.map((node) => {
          const point = positions.get(node.id);
          return `
            <g class="graph-node maker-node role-${esc(roleClass(node.role))} ${activeNode && activeNode.id === node.id ? 'is-active' : ''}" tabindex="0" role="button" aria-label="Open ${esc(node.name)}" data-node="${esc(node.id)}" transform="translate(${point.x} ${point.y})">
              <circle r="58"></circle>
              <text y="-7">${esc(node.name)}</text>
              <text class="small" y="18">${esc(node.role)}</text>
            </g>`;
        }).join('')}
      </g>
    `;
    svg.querySelectorAll('[data-node]').forEach((node) => {
      node.addEventListener('click', () => selectNode(node.dataset.node));
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectNode(node.dataset.node);
        }
      });
    });

    renderRegionCards(visibleNodes);
    renderSources(activeRegion.sourceIds || []);
    if (activeNode && visibleNodeIds.has(activeNode.id)) renderNodeDetail(activeNode);
    else renderRegionDetail();
  }

  function renderRegionCards(nodes) {
    cards.innerHTML = nodes.map((node) => `
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

  function renderRegionDetail() {
    detail.innerHTML = `
      <strong>${esc(activeRegion.name)}: read the chain.</strong>
      <span>${esc(activeRegion.summary)}</span>
      <ul>${(activeRegion.notes || []).map((note) => `<li>${esc(note)}</li>`).join('')}</ul>
    `;
  }

  function renderNodeDetail(node) {
    const edges = (activeRegion.edges || []).filter((edge) => edge.from === node.id || edge.to === node.id);
    const related = edges.map((edge) => {
      const otherId = edge.from === node.id ? edge.to : edge.from;
      const other = activeRegion.nodes.find((item) => item.id === otherId);
      return { edge, other };
    });
    const sources = [...new Set([...(activeRegion.sourceIds || []), ...(node.sourceIds || [])])];
    renderSources(sources);
    detail.innerHTML = `
      <span class="role-badge role-${esc(roleClass(node.role))}">${esc(node.role)}</span>
      <strong>${esc(node.name)}</strong>
      <span>${esc(node.specialty)}</span>
      <div class="line-list">${(node.famousLines || []).map((line) => `<span>${esc(line)}</span>`).join('')}</div>
      ${node.caveat ? `<p class="graph-caveat">${esc(node.caveat)}</p>` : ''}
      ${related.length ? `<h3>Relationships</h3><ul>${related.map(({ edge, other }) => `<li><b>${esc(edge.label)}</b>${other ? ` with ${esc(other.name)}` : ''}: ${esc(edge.detail)}</li>`).join('')}</ul>` : ''}
    `;
  }

  function renderSources(ids) {
    const byId = sourceMap();
    const sources = [...new Set(ids)].map((id) => byId.get(id)).filter(Boolean);
    sourceList.innerHTML = sources.length ? sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)}</a>`).join('') : '<span>Source trail pending for this node.</span>';
  }

  function selectRegion(id) {
    activeRegion = graph.regions.find((region) => region.id === id) || graph.regions[0];
    activeNode = null;
    role = 'all';
    query = '';
    roleFilter.value = 'all';
    searchInput.value = '';
    renderRegion();
  }

  function selectNode(id) {
    activeNode = activeRegion.nodes.find((node) => node.id === id);
    renderRegion();
  }

  roleFilter.addEventListener('change', () => {
    role = roleFilter.value;
    activeNode = null;
    renderRegion();
  });
  searchInput.addEventListener('input', () => {
    query = searchInput.value.trim().toLowerCase();
    activeNode = null;
    if (activeRegion) renderRegion();
  });
  resetButton.addEventListener('click', renderOverview);

  fetch('/data/maker-graph.json')
    .then((response) => response.json())
    .then((data) => {
      graph = data;
      renderOverview();
    })
    .catch(() => {
      detail.innerHTML = '<strong>Maker map could not load.</strong><span>Try refreshing the page.</span>';
    });
})();
