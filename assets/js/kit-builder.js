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
  const storyBtn = q('[data-kit-story-export]');
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

  function itemImage(item, className = 'kit-item-image') {
    if (!item.imageUrl) return '';
    return `<figure class="${className}"><img src="${esc(item.imageUrl)}" alt="${esc(item.imageAlt || item.name)}" loading="lazy"></figure>`;
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
      ${itemImage(item, 'kit-item-image slot-image')}
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
        ${itemImage(item)}
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
    statusEl.innerHTML = '';
    statusEl.hidden = true;
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

  function loadCanvasImage(src) {
    return new Promise((resolve) => {
      if (!src) {
        resolve(null);
        return;
      }
      let settled = false;
      const finish = (image) => {
        if (settled) return;
        settled = true;
        resolve(image);
      };
      const image = new Image();
      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      image.src = src;
      setTimeout(() => finish(null), 3000);
    });
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
      } else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) visible[visible.length - 1] = `${visible[visible.length - 1].replace(/[.,;:!?]+$/, '')}...`;
    visible.forEach((row, index) => ctx.fillText(row, x, y + index * lineHeight));
    return visible.length * lineHeight;
  }

  function drawCoverImage(ctx, image, x, y, width, height) {
    if (!image) return;
    const sourceRatio = image.width / image.height;
    const targetRatio = width / height;
    let sx = 0;
    let sy = 0;
    let sw = image.width;
    let sh = image.height;
    if (sourceRatio > targetRatio) {
      sw = image.height * targetRatio;
      sx = (image.width - sw) / 2;
    } else {
      sh = image.width / targetRatio;
      sy = (image.height - sh) / 2;
    }
    ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  }

  async function downloadStoryExport() {
    if (storyBtn) {
      storyBtn.disabled = true;
      storyBtn.textContent = 'Exporting...';
    }
    const selected = slots.map((id, index) => ({ index, item: itemById(id) })).filter((entry) => entry.item);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    const images = await Promise.all(selected.map(({ item }) => loadCanvasImage(item.imageUrl)));

    ctx.fillStyle = '#0f0f0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f5eee3';
    ctx.font = '900 92px Montserrat, Arial, sans-serif';
    ctx.fillText('ADRIC', 72, 122);
    ctx.fillStyle = '#ff4a43';
    ctx.fillText('HOPS', 380, 122);
    ctx.fillStyle = '#f5eee3';
    ctx.font = '900 112px Montserrat, Arial, sans-serif';
    ctx.fillText('My knife kit', 72, 252);
    ctx.fillStyle = '#bdb4a8';
    ctx.font = '700 34px Montserrat, Arial, sans-serif';
    ctx.fillText(`${selected.length}/${SLOT_COUNT} slots built in the Adrichops kit builder`, 76, 312);

    if (!selected.length) {
      ctx.strokeStyle = 'rgba(245,238,227,.22)';
      ctx.lineWidth = 3;
      roundRect(ctx, 72, 430, 936, 420, 34);
      ctx.stroke();
      ctx.fillStyle = '#f5eee3';
      ctx.font = '900 64px Montserrat, Arial, sans-serif';
      drawWrappedText(ctx, 'No kit selected yet.', 118, 575, 820, 72, 2);
      ctx.fillStyle = '#bdb4a8';
      ctx.font = '700 34px Montserrat, Arial, sans-serif';
      drawWrappedText(ctx, 'Add knives and tools, then export again.', 118, 720, 760, 44, 2);
    } else {
      const cardW = 444;
      const cardH = 246;
      const gapX = 42;
      const gapY = 32;
      const startX = 72;
      const startY = 400;
      selected.slice(0, 10).forEach(({ index, item }, position) => {
        const col = position % 2;
        const row = Math.floor(position / 2);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);
        roundRect(ctx, x, y, cardW, cardH, 28);
        ctx.fillStyle = '#191715';
        ctx.fill();
        ctx.strokeStyle = 'rgba(245,238,227,.18)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        roundRect(ctx, x + 18, y + 18, 150, 102, 18);
        ctx.clip();
        ctx.fillStyle = '#26231f';
        ctx.fillRect(x + 18, y + 18, 150, 102);
        drawCoverImage(ctx, images[position], x + 18, y + 18, 150, 102);
        ctx.restore();

        ctx.fillStyle = '#ff4a43';
        ctx.font = '900 26px Montserrat, Arial, sans-serif';
        ctx.fillText(String(index + 1).padStart(2, '0'), x + 188, y + 46);
        ctx.fillStyle = '#f5eee3';
        ctx.font = '900 34px Montserrat, Arial, sans-serif';
        drawWrappedText(ctx, item.name, x + 188, y + 86, 220, 36, 2);
        ctx.fillStyle = '#bdb4a8';
        ctx.font = '800 23px Montserrat, Arial, sans-serif';
        drawWrappedText(ctx, `${item.profile || item.category} · ${item.edgeLengthMm ? `${item.edgeLengthMm}mm` : item.category}`, x + 22, y + 162, 390, 30, 2);
        ctx.fillStyle = '#f5eee3';
        ctx.font = '800 22px Montserrat, Arial, sans-serif';
        drawWrappedText(ctx, item.steelType || item.handleType || '', x + 22, y + 218, 390, 28, 1);
      });
    }

    ctx.fillStyle = '#bdb4a8';
    ctx.font = '800 28px Montserrat, Arial, sans-serif';
    ctx.fillText('adrichops.pages.dev/kit-builder', 72, 1848);
    ctx.fillStyle = '#ff4a43';
    ctx.fillRect(72, 1872, 936, 8);

    canvas.toBlob((blob) => {
      if (!blob) {
        if (storyBtn) {
          storyBtn.disabled = false;
          storyBtn.textContent = 'Export failed';
          setTimeout(() => { storyBtn.textContent = 'Export Story PNG'; }, 1400);
        }
        return;
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'adrichops-kit-story.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1200);
      if (storyBtn) {
        storyBtn.disabled = false;
        storyBtn.textContent = 'Story downloaded';
        setTimeout(() => { storyBtn.textContent = 'Export Story PNG'; }, 1400);
      }
    }, 'image/png');
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
  if (storyBtn) storyBtn.addEventListener('click', downloadStoryExport);
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
