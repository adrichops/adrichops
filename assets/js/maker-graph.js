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

    const width = state.activeRegion ? 1700 : 1180;
    const height = state.activeRegion ? 1100 : 760;
    if (node.id === 'japan' || node.isRegion && state.activeRegion && node.regionId === state.activeRegion.id) {
      return { ...node, x: width / 2, y: height / 2, vx: 0, vy: 0 };
    }
    const radius = state.activeRegion ? 330 : 260;
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(total, 1);
    return {
      ...node,
      x: width / 2 + Math.cos(angle) * radius + (Math.random() * 28 - 14),
      y: height / 2 + Math.sin(angle) * radius + (Math.random() * 28 - 14),
      vx: 0,
      vy: 0
    };
  }

  const lineageKinds = new Set(['apprenticeship', 'student', 'family', 'worked-under', 'workshop-background', 'regional-hub']);

  function layoutSelection(nodes, edges, width, height) {
    if (!state.activeRegion) {
      return nodes.map((node, index) => seedPosition(node, index, nodes.length));
    }

    const regionId = `region:${state.activeRegion.id}`;
    const nodeById = new Map(nodes.map((node) => [node.id, { ...node, vx: 0, vy: 0 }]));
    const regionNode = nodeById.get(regionId);
    if (regionNode) {
      regionNode.x = width / 2;
      regionNode.y = 92;
    }

    const makerNodes = nodes.filter((node) => node.id !== regionId && !node.isHub);
    const outgoing = new Map();
    const incoming = new Map();
    edges.forEach((edge) => {
      if (!lineageKinds.has(edge.kind) || edge.kind === 'region-member') return;
      if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) return;
      if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
      if (!incoming.has(edge.to)) incoming.set(edge.to, []);
      outgoing.get(edge.from).push(edge.to);
      incoming.get(edge.to).push(edge.from);
    });

    const rootIds = makerNodes
      .filter((node) => !incoming.has(node.id))
      .sort((a, b) => roleWeight(a) - roleWeight(b) || a.name.localeCompare(b.name))
      .map((node) => node.id);
    if (!rootIds.length) makerNodes.forEach((node) => rootIds.push(node.id));

    const depth = new Map(rootIds.map((id) => [id, 1]));
    const queue = [...rootIds];
    while (queue.length) {
      const id = queue.shift();
      const nextDepth = (depth.get(id) || 1) + 1;
      (outgoing.get(id) || []).forEach((childId) => {
        if (!depth.has(childId) || nextDepth < depth.get(childId)) {
          depth.set(childId, nextDepth);
          queue.push(childId);
        }
      });
    }
    makerNodes.forEach((node) => {
      if (!depth.has(node.id)) depth.set(node.id, 1);
      if (node.regionId && node.regionId !== state.activeRegion.id) {
        depth.set(node.id, Math.max(depth.get(node.id), 4));
      }
    });

    const columns = new Map();
    makerNodes.forEach((node) => {
      const key = depth.get(node.id);
      if (!columns.has(key)) columns.set(key, []);
      columns.get(key).push(node);
    });

    const sortedDepths = [...columns.keys()].sort((a, b) => a - b);
    const top = 230;
    const maxPerRow = 8;
    let yCursor = top;
    sortedDepths.forEach((key) => {
      const row = columns.get(key).sort((a, b) => roleWeight(a) - roleWeight(b) || a.name.localeCompare(b.name));
      const chunkCount = Math.ceil(row.length / maxPerRow);
      for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
        const chunk = row.slice(chunkIndex * maxPerRow, (chunkIndex + 1) * maxPerRow);
        const y = yCursor + chunkIndex * 132;
        chunk.forEach((node, index) => {
          const span = width - 260;
          const x = 130 + span * ((index + 1) / (chunk.length + 1));
          const target = nodeById.get(node.id);
          target.x = x;
          target.y = y;
        });
      }
      yCursor += chunkCount * 132 + 82;
    });

    return [...nodeById.values()];
  }

  function roleWeight(node) {
    const role = roleClass(node.role);
    if (role === 'cooperative' || role === 'workshop') return 1;
    if (role === 'blacksmith') return 2;
    if (role === 'sharpener' || role === 'polisher') return 3;
    if (role === 'handle-maker') return 4;
    if (role === 'brand') return 5;
    return 6;
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
    return `graph-edge edge-${roleClass(edge.kind)} source-${roleClass(edge.sourceType || 'direct')} confidence-${roleClass(edge.confidence || 'standard')}`;
  }

  function renderGraph() {
    if (state.simulation) state.simulation.stop();
    cancelAnimationFrame(state.raf);

    const selection = graphSelection();
    const width = state.activeRegion ? 1700 : 1180;
    const height = state.activeRegion ? 1100 : 760;
    const nodes = layoutSelection(selection.nodes, selection.edges, width, height);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = selection.edges
      .map((edge) => ({ ...edge, source: nodeById.get(edge.from), target: nodeById.get(edge.to) }))
      .filter((edge) => edge.source && edge.target);

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = `
      <defs>
        <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z"></path>
        </marker>
      </defs>
      <g class="graph-viewport">
        <g class="graph-lines">
          ${edges.map((edge) => `<line class="${esc(edgeClass(edge))}" data-edge="${esc(edge.from)}:${esc(edge.to)}"${edge.kind !== 'region-member' && edge.kind !== 'regional-hub' ? ' marker-end="url(#graph-arrow)"' : ''}></line>`).join('')}
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

    if (state.activeRegion) {
      tick(nodes, edges);
      state.simulation = createStaticSimulation(nodes, edges);
    } else {
      state.simulation = createSimulation(nodes, edges, width, height);
      state.simulation.start();
    }
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
    const radius = node.isHub ? 64 : node.isRegion ? 58 : 48;
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
        const desired = edge.kind === 'region-member' || edge.kind === 'regional-hub' ? 220 : 300;
        const force = ((distance - desired) / distance) * 0.013 * alpha;
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
          const force = (a.isHub || b.isHub ? 7400 : 12800) / distanceSq * alpha;
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
          node.vx += (centerX - node.x) * 0.0028 * alpha;
          node.vy += (centerY - node.y) * 0.0028 * alpha;
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

  function createStaticSimulation(nodes, edges) {
    return {
      start() {
        tick(nodes, edges);
      },
      stop() {},
      heat() {
        tick(nodes, edges);
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
