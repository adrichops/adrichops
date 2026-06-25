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

  const state = {
    graph: null,
    regionById: new Map(),
    nodeById: new Map(),
    activeRegion: null,
    activeNode: null,
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
    if (state.role !== 'all' && roleClass(node.role) !== state.role) return false;
    const haystack = [
      node.name,
      node.role,
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

  function seedPosition(node, index, total) {
    const saved = state.positions.get(node.id);
    if (saved) return { ...node, x: saved.x, y: saved.y, vx: saved.vx || 0, vy: saved.vy || 0 };

    const width = state.activeRegion ? 1060 : 900;
    const height = state.activeRegion ? 680 : 560;
    if (node.id === 'japan' || node.isRegion && state.activeRegion && node.regionId === state.activeRegion.id) {
      return { ...node, x: width / 2, y: height / 2, vx: 0, vy: 0 };
    }
    const radius = state.activeRegion ? 235 : 190;
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(total, 1);
    return {
      ...node,
      x: width / 2 + Math.cos(angle) * radius + (Math.random() * 28 - 14),
      y: height / 2 + Math.sin(angle) * radius + (Math.random() * 28 - 14),
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

  function renderRegions() {
    regionList.innerHTML = state.graph.regions.map((region) => `
      <button class="region-button" type="button" data-region="${esc(region.id)}" aria-pressed="${state.activeRegion && state.activeRegion.id === region.id ? 'true' : 'false'}">
        <strong>${esc(region.name)}</strong>
        <span>${esc(region.location)}</span>
      </button>
    `).join('');
    regionList.querySelectorAll('[data-region]').forEach((button) => {
      button.addEventListener('click', () => selectRegion(button.dataset.region));
    });
  }

  function edgeClass(edge) {
    return `graph-edge edge-${roleClass(edge.kind)}`;
  }

  function renderGraph() {
    if (state.simulation) state.simulation.stop();
    cancelAnimationFrame(state.raf);

    const selection = graphSelection();
    const width = state.activeRegion ? 1060 : 900;
    const height = state.activeRegion ? 680 : 560;
    const nodes = selection.nodes.map((node, index) => seedPosition(node, index, selection.nodes.length));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = selection.edges
      .map((edge) => ({ ...edge, source: nodeById.get(edge.from), target: nodeById.get(edge.to) }))
      .filter((edge) => edge.source && edge.target);

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = `
      <g class="graph-viewport">
        <g class="graph-lines">
          ${edges.map((edge) => `<line class="${esc(edgeClass(edge))}" data-edge="${esc(edge.from)}:${esc(edge.to)}"></line>`).join('')}
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

    state.simulation = createSimulation(nodes, edges, width, height);
    state.simulation.start();
  }

  function nodeMarkup(node) {
    const active = state.activeNode && state.activeNode.id === node.id;
    const className = [
      'graph-node',
      node.isHub ? 'hub-node' : '',
      node.isRegion ? 'region-node' : 'maker-node',
      `role-${roleClass(node.role)}`,
      active ? 'is-active' : ''
    ].filter(Boolean).join(' ');
    const radius = node.isHub ? 54 : node.isRegion ? 50 : 42;
    const label = node.isHub ? 'Open regional map' : node.isRegion ? `Open ${node.name}` : `Open ${node.name}`;
    return `
      <g class="${esc(className)}" tabindex="0" role="button" aria-label="${esc(label)}" data-node="${esc(node.id)}">
        <circle r="${radius}"></circle>
        <text y="-4">${esc(shortLabel(node.name))}</text>
        <text class="small" y="17">${esc(node.isRegion ? node.location : node.role)}</text>
      </g>
    `;
  }

  function shortLabel(value) {
    const text = String(value || '');
    if (text.length <= 18) return text;
    return `${text.slice(0, 16)}...`;
  }

  function tick(nodes, edges) {
    edges.forEach((edge) => {
      const line = svg.querySelector(`[data-edge="${CSS.escape(`${edge.from}:${edge.to}`)}"]`);
      if (!line) return;
      line.setAttribute('x1', edge.source.x);
      line.setAttribute('y1', edge.source.y);
      line.setAttribute('x2', edge.target.x);
      line.setAttribute('y2', edge.target.y);
    });

    nodes.forEach((node) => {
      state.positions.set(node.id, { x: node.x, y: node.y, vx: node.vx, vy: node.vy });
      const group = svg.querySelector(`[data-node="${CSS.escape(node.id)}"]`);
      if (group) group.setAttribute('transform', `translate(${node.x} ${node.y})`);
    });
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
        const desired = edge.kind === 'region-member' || edge.kind === 'regional-hub' ? 160 : 210;
        const force = ((distance - desired) / distance) * 0.014 * alpha;
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
          const force = (a.isHub || b.isHub ? 4600 : 7600) / distanceSq * alpha;
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
          node.vx += (centerX - node.x) * 0.018 * alpha;
          node.vy += (centerY - node.y) * 0.018 * alpha;
        } else {
          node.vx += (centerX - node.x) * 0.0035 * alpha;
          node.vy += (centerY - node.y) * 0.0035 * alpha;
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
          <h2>Japan</h2>
          <section>
            <h3>Regions</h3>
            <div class="wiki-list">${state.graph.regions.map((region) => wikiButton(state.nodeById.get(`region:${region.id}`))).join('')}</div>
          </section>
        </article>
      `;
      bindWikiLinks();
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
      if (edge.kind === 'student' || edge.kind === 'apprenticeship') {
        if (edge.from === node.id) studentIds.add(edge.to);
        if (edge.to === node.id) teacherIds.add(edge.from);
      }
    });
    const regionNode = state.nodeById.get(`region:${node.regionId}`);
    const sources = [...new Set([...(state.regionById.get(node.regionId).sourceIds || []), ...(node.sourceIds || [])])];

    detail.innerHTML = `
      <article class="graph-note">
        <h2>${esc(node.name)}</h2>
        <section>
          <h3>Role</h3>
          <p>${esc(node.role)} (${esc(node.regionName)})</p>
        </section>
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
          return `<li><b>${esc(edge.label)}</b>${other ? ` with ${wikiButton(other)}` : ''}: ${esc(edge.detail)}</li>`;
        }).join('')}</ul></section>` : ''}
        ${node.caveat ? `<p class="graph-caveat">${esc(node.caveat)}</p>` : ''}
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
    state.role = 'all';
    state.query = '';
    roleFilter.value = 'all';
    searchInput.value = '';
    state.view = { x: 0, y: 0, scale: 1 };
    syncView();
  }

  function selectNode(id, options = {}) {
    const node = state.nodeById.get(id);
    if (!node) return;
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
      renderRegions();
      renderNodeDetail(node);
    }
  }

  function syncView() {
    renderRegions();
    roleFilter.hidden = !state.activeRegion;
    if (state.activeRegion) {
      title.textContent = state.activeRegion.name;
      dek.textContent = 'Drag nodes, pan the canvas, or click a linked note to follow the maker trail.';
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

  roleFilter.addEventListener('change', () => {
    state.role = roleFilter.value;
    state.activeNode = state.activeRegion ? state.nodeById.get(`region:${state.activeRegion.id}`) : null;
    syncView();
  });

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value.trim().toLowerCase();
    state.activeNode = state.activeRegion ? state.nodeById.get(`region:${state.activeRegion.id}`) : null;
    if (state.activeRegion) syncView();
  });

  resetButton.addEventListener('click', () => {
    state.activeRegion = null;
    state.activeNode = state.nodeById.get('japan');
    state.role = 'all';
    state.query = '';
    roleFilter.value = 'all';
    searchInput.value = '';
    state.view = { x: 0, y: 0, scale: 1 };
    syncView();
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
