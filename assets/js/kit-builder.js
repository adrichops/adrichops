(async function () {
  const root = document.querySelector('[data-kit-builder]');
  if (!root) return;

  const SLOT_COUNT = 10;
  const STORAGE_KEY = 'adrichops-kit-builder-v1';
  const LEGACY_STORAGE_KEY = 'adrichops-roll-builder-v1';
  const q = (sel, base = root) => base.querySelector(sel);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  const slotsEl = q('[data-kit-slots]');
  const libraryEl = q('[data-kit-library]');
  const summaryEl = q('[data-kit-summary]');
  const statusEl = q('[data-kit-status]');
  const searchEl = q('[data-kit-search]');
  const categoryEl = q('[data-kit-category]');
  const profileEl = q('[data-kit-profile]');
  const steelEl = q('[data-kit-steel]');
  const clearBtn = q('[data-kit-clear]');
  const starterBtn = q('[data-kit-starter]');
  const exportBtn = q('[data-kit-export]');
  const copyBtn = q('[data-kit-copy]');
  const steelBuckets = [
    ['all', 'All steels/materials'],
    ['vg10', 'VG10'],
    ['ginsan', 'Ginsan'],
    ['aeb-l', 'AEB-L'],
    ['white', 'White steel'],
    ['blue', 'Blue steel'],
    ['skd', 'SKD'],
    ['stainless', 'Stainless'],
    ['ceramic', 'Ceramic / stone'],
    ['synthetic', 'Synthetic board'],
    ['leather', 'Leather / strop']
  ];

  let items = [];
  let activeSlot = 0;
  let slots = Array.from({ length: SLOT_COUNT }, () => null);

  try {
    const response = await fetch('/data/kit-items.json', { cache: 'no-store' });
    const data = await response.json();
    items = Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    items = [];
  }

  function itemById(id) {
    return items.find((item) => item.id === id) || null;
  }

  function typeLabel(item) {
    return (item.category || 'item').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function lengthLabel(item) {
    return item.edgeLengthMm ? `${item.edgeLengthMm}mm` : 'tool';
  }

  function itemMeta(item) {
    return [
      ['Profile', item.profile || '—'],
      ['Edge', item.edgeLengthMm ? `${item.edgeLengthMm}mm` : '—'],
      ['Steel/material', item.steelType || '—'],
      ['Handle', item.handleType || '—']
    ];
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || '{}';
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.slots)) {
        slots = Array.from({ length: SLOT_COUNT }, (_, index) => saved.slots[index] || null);
      }
      if (Number.isInteger(saved.activeSlot)) activeSlot = Math.max(0, Math.min(SLOT_COUNT - 1, saved.activeSlot));
    } catch (error) {}
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ slots, activeSlot }));
  }

  function populateFilters() {
    const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort();
    categoryEl.innerHTML = '<option value="all">All categories</option>' + categories.map((cat) => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('');
    refreshFilterOptions();
  }

  function queryCategory(query) {
    const normalized = query.trim().toLowerCase();
    const aliases = {
      knives: 'knife',
      knife: 'knife',
      stones: 'stone',
      stone: 'stone',
      strops: 'strop',
      strop: 'strop',
      boards: 'board',
      board: 'board',
      storage: 'storage',
      utensils: 'utensil',
      utensil: 'utensil'
    };
    return aliases[normalized] || '';
  }

  function effectiveCategory(query = (searchEl.value || '').trim().toLowerCase()) {
    return categoryEl.value !== 'all' ? categoryEl.value : queryCategory(query);
  }

  function itemMatches(item, { query, category, profile, steel }, ignore = '') {
    const exactCategoryQuery = queryCategory(query);
    const categoryOk = ignore === 'category' || !category || category === 'all' || item.category === category;
    const profileOk = ignore === 'profile' || profile === 'all' || item.profile === profile;
    const steelOk = ignore === 'steel' || steel === 'all' || String(item.steelType || '').toLowerCase().includes(steel);
    const hay = [item.name, item.category, item.profile, item.steelType, item.handleType, item.bestFor, item.maintenance, ...(item.tags || [])].join(' ').toLowerCase();
    const queryOk = !query || (exactCategoryQuery && item.category === exactCategoryQuery) || hay.includes(query);
    return categoryOk && profileOk && steelOk && queryOk;
  }

  function setSelectOptions(select, options, fallbackLabel, currentValue) {
    const optionHtml = options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
    select.innerHTML = `<option value="all">${esc(fallbackLabel)}</option>${optionHtml}`;
    select.value = options.some(([value]) => value === currentValue) ? currentValue : 'all';
  }

  function refreshFilterOptions() {
    const query = (searchEl.value || '').trim().toLowerCase();
    const category = effectiveCategory(query) || 'all';
    const profile = profileEl.value || 'all';
    const steel = steelEl.value || 'all';
    const state = { query, category, profile, steel };
    const profiles = [...new Set(items.filter((item) => itemMatches(item, state, 'profile')).map((item) => item.profile).filter(Boolean))].sort();
    const availableSteels = steelBuckets.slice(1).filter(([value]) => items.some((item) => itemMatches(item, state, 'steel') && String(item.steelType || '').toLowerCase().includes(value)));
    setSelectOptions(profileEl, profiles.map((value) => [value, value]), 'All profiles', profile);
    setSelectOptions(steelEl, availableSteels, 'All steels/materials', steel);
  }

  function filteredItems() {
    const query = (searchEl.value || '').trim().toLowerCase();
    const category = effectiveCategory(query) || 'all';
    const profile = profileEl.value || 'all';
    const steel = steelEl.value || 'all';
    return items.filter((item) => itemMatches(item, { query, category, profile, steel }));
  }

  function renderSlotCard(index) {
    const item = itemById(slots[index]);
    const active = index === activeSlot;
    if (!item) {
      return `<article class="kit-slot-card empty ${active ? 'active' : ''}" data-slot-drop="${index}" data-slot-card="${index}" tabindex="0" aria-label="Empty kit slot ${index + 1}">
        <div class="kit-slot-head"><span class="slot-number">Slot ${String(index + 1).padStart(2, '0')}</span><span class="drop-badge">Drop here</span></div>
        <div><strong>Empty slot</strong><p>Drag a card from the database into this slot, or select this slot and use Add.</p></div>
        <button class="button small" type="button" data-select-slot="${index}">${active ? 'Active slot' : 'Select slot'}</button>
      </article>`;
    }
    return `<article class="kit-slot-card filled ${active ? 'active' : ''}" data-slot-drop="${index}" data-slot-card="${index}" data-slot-drag="${index}" draggable="true" aria-label="Slot ${index + 1}: ${esc(item.name)}">
      <div class="kit-slot-head"><span class="slot-number">Slot ${String(index + 1).padStart(2, '0')} · ${esc(typeLabel(item))}</span><span class="drag-badge">Drag to move</span></div>
      <div><strong>${esc(item.name)}</strong><p>${esc(item.bestFor || '')}</p></div>
      <span class="kit-attributes">${itemMeta(item).map(([label, value]) => `<em>${esc(label)}: ${esc(value)}</em>`).join('')}</span>
      <div class="slot-actions"><button class="button small" type="button" data-select-slot="${index}">${active ? 'Active slot' : 'Select'}</button><button class="button small ghost" type="button" data-remove-slot="${index}">Remove</button></div>
    </article>`;
  }

  function renderSlots() {
    slotsEl.innerHTML = slots.map((_, index) => renderSlotCard(index)).join('');
  }

  function renderLibrary() {
    const list = filteredItems();
    libraryEl.innerHTML = list.length ? list.map((item) => {
      const selected = slots.includes(item.id);
      return `<article class="kit-library-card ${selected ? 'selected' : ''}" data-library-card="${esc(item.id)}" data-library-drag="${esc(item.id)}" draggable="true" aria-label="${esc(item.name)}">
        <div class="kit-card-top"><span>${esc(typeLabel(item))}</span><span>${esc(lengthLabel(item))}</span></div>
        <h3>${esc(item.name)}</h3>
        <p>${esc(item.bestFor || '')}</p>
        <dl>${itemMeta(item).map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
        <div class="tag-row">${(item.tags || []).slice(0, 4).map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>
        <div class="kit-card-actions"><button class="button primary small" type="button" data-add-item="${esc(item.id)}">Add to slot ${activeSlot + 1}</button>${item.learnUrl ? `<a class="button small" href="${esc(item.learnUrl)}">Read note</a>` : ''}</div>
      </article>`;
    }).join('') : '<div class="empty-state">No cards match that filter.</div>';
  }

  function kitStats() {
    const selected = slots.map(itemById).filter(Boolean);
    const countBy = (category) => selected.filter((item) => item.category === category).length;
    const steels = [...new Set(selected.filter((item) => item.category === 'knife').map((item) => item.steelType).filter(Boolean))];
    return { selected, knives: countBy('knife'), stones: countBy('stone'), strops: countBy('strop'), boards: countBy('board'), storage: countBy('storage'), utensils: countBy('utensil'), steels };
  }

  function renderSummary() {
    const stats = kitStats();
    const empty = SLOT_COUNT - stats.selected.length;
    summaryEl.innerHTML = `<div><span>Cards</span><strong>${stats.selected.length}/${SLOT_COUNT}</strong></div><div><span>Knives</span><strong>${stats.knives}</strong></div><div><span>Stones</span><strong>${stats.stones}</strong></div><div><span>Strops</span><strong>${stats.strops}</strong></div><div><span>Boards</span><strong>${stats.boards}</strong></div><div><span>Open slots</span><strong>${empty}</strong></div>`;
    const notes = [];
    if (stats.selected.length === 0) notes.push('Start with one main knife, one small prep knife, one 1000 grit stone, a strop or deburring tool, and a board that does not hate your edge.');
    if (stats.knives > 5) notes.push('That is a lot of blades. Very cool, very suspicious. Make sure each knife has a job.');
    if (stats.knives && !stats.stones) notes.push('Add at least one 1000 grit stone. Sharp knives without sharpening are temporary knives.');
    if (stats.knives && !stats.strops) notes.push('Add a strop or deburring block for cleaner edges after stone work.');
    if (stats.knives && !stats.boards) notes.push('Add a soft board. Edge life starts where the knife hits the surface.');
    if (stats.knives && !stats.storage) notes.push('Add guards, sayas or a roll. Sharp loose steel in a drawer is slapstick until it is not.');
    if (stats.steels.length > 3) notes.push('You are mixing a lot of steel types. That is fine, but maintenance expectations will vary.');
    if (!notes.length) notes.push('Balanced kit. The knives have support gear, which is usually where good ownership actually starts.');
    statusEl.innerHTML = notes.map((note) => `<p>${esc(note)}</p>`).join('');
  }

  function nextOpenSlot(fromIndex = activeSlot) {
    for (let offset = 1; offset <= SLOT_COUNT; offset += 1) {
      const index = (fromIndex + offset) % SLOT_COUNT;
      if (!slots[index]) return index;
    }
    return activeSlot;
  }

  function addItem(id, targetIndex = activeSlot) {
    slots[targetIndex] = id;
    activeSlot = nextOpenSlot(targetIndex);
    save();
    renderAll();
  }

  function removeSlot(index) {
    slots[index] = null;
    activeSlot = index;
    save();
    renderAll();
  }

  function moveSlot(sourceIndex, targetIndex) {
    if (sourceIndex === targetIndex) return;
    const moved = slots[sourceIndex];
    if (!moved) return;
    const next = slots.slice();
    next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    slots = next.slice(0, SLOT_COUNT);
    while (slots.length < SLOT_COUNT) slots.push(null);
    activeSlot = targetIndex;
    save();
    renderAll();
  }

  function clearKit() {
    slots = Array.from({ length: SLOT_COUNT }, () => null);
    activeSlot = 0;
    save();
    renderAll();
  }

  function starterKit() {
    const starter = ['tojiro-dp-210-gyuto', 'petty-150', 'bread-240', 'shapton-kuromaku-1000', 'leather-strop', 'hasegawa-board', 'blade-guard-240', 'bench-scraper'];
    slots = Array.from({ length: SLOT_COUNT }, (_, index) => starter[index] || null);
    activeSlot = nextOpenSlot(0);
    save();
    renderAll();
  }

  function exportData() {
    const selected = slots.map((id, index) => ({ slot: index + 1, item: itemById(id) })).filter((entry) => entry.item);
    return JSON.stringify({ name: 'Adrichops kit', slots: selected }, null, 2);
  }

  function downloadExport() {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'adrichops-kit.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function copySummary() {
    const selected = slots.map((id, index) => ({ index, item: itemById(id) })).filter((entry) => entry.item);
    const text = selected.length ? selected.map(({ index, item }) => `${index + 1}. ${item.name} — ${item.profile}; ${item.edgeLengthMm ? item.edgeLengthMm + 'mm' : 'tool'}; ${item.steelType}; ${item.handleType}`).join('\n') : 'No Adrichops kit selected yet.';
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.textContent = 'Copy summary'; }, 1200);
    } catch (error) {
      copyBtn.textContent = 'Copy failed';
      setTimeout(() => { copyBtn.textContent = 'Copy summary'; }, 1200);
    }
  }

  function setDropState(target, on) {
    root.querySelectorAll('.kit-slot-card.drag-over').forEach((el) => el.classList.remove('drag-over'));
    if (target && on) target.classList.add('drag-over');
  }

  function dragPayload(event) {
    const text = event.dataTransfer.getData('text/plain') || '';
    const [type, value] = text.split(':');
    if (!type || value === undefined) return null;
    return { type, value };
  }

  root.addEventListener('dragstart', (event) => {
    const library = event.target.closest('[data-library-drag]');
    const slot = event.target.closest('[data-slot-drag]');
    if (library) {
      event.dataTransfer.setData('text/plain', `kit-item:${library.dataset.libraryDrag}`);
      event.dataTransfer.effectAllowed = 'copy';
      library.classList.add('dragging');
      root.classList.add('is-dragging');
      return;
    }
    if (slot) {
      event.dataTransfer.setData('text/plain', `kit-slot:${slot.dataset.slotDrag}`);
      event.dataTransfer.effectAllowed = 'move';
      slot.classList.add('dragging');
      root.classList.add('is-dragging');
    }
  });

  root.addEventListener('dragend', () => {
    root.querySelectorAll('.dragging, .drag-over').forEach((el) => el.classList.remove('dragging', 'drag-over'));
    root.classList.remove('is-dragging');
  });

  root.addEventListener('dragover', (event) => {
    const drop = event.target.closest('[data-slot-drop]') || event.target.closest('[data-kit-drop-zone]');
    if (!drop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropState(drop, true);
  });

  root.addEventListener('dragleave', (event) => {
    const drop = event.target.closest('[data-slot-drop]') || event.target.closest('[data-kit-drop-zone]');
    if (drop && !drop.contains(event.relatedTarget)) drop.classList.remove('drag-over');
  });

  root.addEventListener('drop', (event) => {
    const slotDrop = event.target.closest('[data-slot-drop]');
    const drop = slotDrop || event.target.closest('[data-kit-drop-zone]');
    if (!drop) return;
    event.preventDefault();
    const targetIndex = slotDrop ? Number(slotDrop.dataset.slotDrop) : nextOpenSlot(activeSlot - 1);
    const payload = dragPayload(event);
    setDropState(null, false);
    root.classList.remove('is-dragging');
    if (!payload || Number.isNaN(targetIndex)) return;
    if (payload.type === 'kit-item') {
      addItem(payload.value, targetIndex);
      return;
    }
    if (payload.type === 'kit-slot') {
      moveSlot(Number(payload.value), targetIndex);
    }
  });

  root.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-slot]');
    if (remove) {
      event.preventDefault();
      removeSlot(Number(remove.dataset.removeSlot));
      return;
    }
    const select = event.target.closest('[data-select-slot]');
    if (select) {
      event.preventDefault();
      activeSlot = Number(select.dataset.selectSlot);
      save();
      renderAll();
      return;
    }
    const add = event.target.closest('[data-add-item]');
    if (add) {
      event.preventDefault();
      addItem(add.dataset.addItem, activeSlot);
      return;
    }
    const slotCard = event.target.closest('[data-slot-card]');
    if (slotCard) {
      activeSlot = Number(slotCard.dataset.slotCard);
      save();
      renderAll();
    }
  });

  [searchEl, categoryEl, profileEl, steelEl].forEach((control) => control.addEventListener('input', renderAll));
  clearBtn.addEventListener('click', clearKit);
  starterBtn.addEventListener('click', starterKit);
  exportBtn.addEventListener('click', downloadExport);
  copyBtn.addEventListener('click', copySummary);

  function renderAll() {
    renderSlots();
    refreshFilterOptions();
    renderLibrary();
    renderSummary();
  }

  loadSaved();
  populateFilters();
  renderAll();
})();
