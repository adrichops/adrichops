(async function () {
  const root = document.querySelector('[data-explore-deck]');
  if (!root) return;

  const nav = root.querySelector('[data-deck-nav]');
  const stack = root.querySelector('[data-card-stack]');
  const title = root.querySelector('[data-stage-title]');
  const dek = root.querySelector('[data-stage-dek]');
  const preview = root.querySelector('[data-deck-preview]');
  const counter = root.querySelector('[data-deck-counter]');
  const prevButton = root.querySelector('[data-deck-prev]');
  const nextButton = root.querySelector('[data-deck-next]');

  let posts = [];
  try {
    const response = await fetch('/data/posts.json', { cache: 'no-store' });
    posts = (await response.json()).posts || [];
  } catch (error) {
    posts = [];
  }

  const sections = [
    { id: 'about', label: 'About', text: 'The line-cook origin story.', url: '/about/' },
    { id: 'reviews', label: 'Reviews', text: 'Knives, boards and stones with status labels.' },
    { id: 'makers', label: 'Maker spotlight', text: 'Sakai, Sanjo and the shops people whisper about.' },
    { id: 'roll', label: 'What’s in my roll', text: 'The personal setup and sensible maintenance kit.', url: '/whats-in-my-roll/' },
    { id: 'kit', label: 'Kit Builder', text: 'Drag knives, stones, strops and boards into a 10-slot deck.', url: '/kit-builder/' },
    { id: 'recommendations', label: 'Recommendations', text: 'Knife Finder, starter paths and buying notes.', url: '/recommendations/' },
    { id: 'disclosure', label: 'Disclosure', text: 'Affiliate policy and source discipline.', url: '/disclosure/' }
  ];

  const state = {
    section: sections[1],
    cards: [],
    index: 0,
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    latestX: 0,
    latestY: 0,
    startTime: 0,
    didDrag: false
  };

  function html(str) {
    return String(str || '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }

  function cardRoute(card) {
    return card.route || card.url || '#';
  }

  function cardsFor(id) {
    if (id === 'reviews') return posts.filter((p) => p.type === 'Review brief').slice(0, 18);
    if (id === 'makers') return posts.filter((p) => p.type === 'Maker spotlight').slice(0, 18);
    if (id === 'recommendations') return posts.filter((p) => ['sharpening', 'maintenance', 'guide', 'culture', 'recommendations'].includes(p.category)).slice(0, 18);
    if (id === 'about') return [{
      title: 'About Adrian',
      type: 'Personal note',
      readTime: '3 min read',
      summary: 'Line cook, chipped Shun, Tojiro DP, Japan, Takada-san, Baba Hamono and the beginning of Adrichops.',
      route: '/about/',
      status: 'Personal'
    }];
    if (id === 'roll') return [{
      title: 'What’s in my roll',
      type: 'Personal kit',
      readTime: '4 min read',
      summary: 'The Tojiro that stayed, the stones that make sense, the boards that protect edges, and the gear worth editing as Adrian’s kit evolves.',
      route: '/whats-in-my-roll/',
      status: 'Personal'
    }];
    if (id === 'kit') return [{
      title: 'Kit Builder',
      type: 'Interactive tool',
      readTime: 'Tool',
      summary: 'A draggable ten-slot deck for building a knife kit from knives, stones, strops, boards, storage and utensils.',
      route: '/kit-builder/',
      status: 'Interactive'
    }];
    if (id === 'disclosure') return [{
      title: 'Disclosure and review integrity',
      type: 'Policy',
      readTime: '3 min read',
      summary: 'What is affiliate, what is researched, what is owned, and how source trails work.',
      route: '/disclosure/',
      status: 'Policy'
    }];
    return posts.slice(0, 18);
  }

  function shortestOffset(position, active, length) {
    let diff = position - active;
    if (length > 1) {
      const half = length / 2;
      if (diff > half) diff -= length;
      if (diff < -half) diff += length;
    }
    return diff;
  }

  function renderNav() {
    nav.innerHTML = sections.map((section) => `
      <button class="deck-tab-card" type="button" data-section="${html(section.id)}" aria-pressed="${section.id === state.section.id ? 'true' : 'false'}">
        <strong>${html(section.label)}</strong>
        <span>${html(section.text)}</span>
      </button>`).join('');
  }

  function renderPreview() {
    const card = state.cards[state.index];
    if (!card) {
      preview.innerHTML = '<span class="kicker">Selected card</span><h3>No cards yet.</h3><p>Add posts and rebuild the site.</p>';
      return;
    }
    preview.innerHTML = `
      <span class="kicker">Selected card</span>
      <h3>${html(card.title)}</h3>
      <p>${html(card.summary || card.deck || '')}</p>
      <div class="preview-meta">
        <span class="status-pill">${html(card.status || card.type || 'Note')}</span>
        <span class="status-pill">${html(card.readTime || '')}</span>
      </div>
      <a class="button primary" href="${html(cardRoute(card))}">Open selected card</a>`;
  }

  function renderStack() {
    const count = state.cards.length;
    if (!count) {
      stack.innerHTML = '<div class="empty-state">No cards in this section yet.</div>';
      if (counter) counter.textContent = '0 / 0';
      renderPreview();
      return;
    }

    stack.innerHTML = state.cards.map((card, index) => {
      const offset = shortestOffset(index, state.index, count);
      const abs = Math.abs(offset);
      const visible = abs <= 4;
      const active = index === state.index;
      const drift = active ? 0 : Math.sign(offset || 1) * Math.min(abs, 4);
      return `
        <article class="stack-card ${active ? 'is-active' : ''} ${visible ? '' : 'is-hidden'}" data-index="${index}" role="button" tabindex="${visible ? '0' : '-1'}" aria-current="${active ? 'true' : 'false'}" aria-label="${html(active ? 'Selected card: ' : 'Preview card: ')}${html(card.title)}"
          style="--offset:${offset}; --abs:${abs}; --drift:${drift}; --z:${100 - abs};">
          <span class="eyebrow">${html(card.type || 'Note')} · ${html(card.readTime || '')}</span>
          <strong>${html(card.title)}</strong>
          <p>${html(card.summary || card.deck || '')}</p>
          <span class="status-pill">${html(card.status || card.category || '')}</span>
        </article>`;
    }).join('');

    if (counter) counter.textContent = `${state.index + 1} / ${count}`;
    renderPreview();
  }

  function renderSection(sectionId, keepIndex = false) {
    state.section = sections.find((section) => section.id === sectionId) || sections[1];
    state.cards = cardsFor(state.section.id);
    state.index = keepIndex ? Math.min(state.index, Math.max(state.cards.length - 1, 0)) : 0;
    if (title) title.textContent = state.section.label;
    if (dek) dek.textContent = state.section.text;
    renderNav();
    renderStack();
  }

  function selectIndex(index) {
    const count = state.cards.length;
    if (!count) return;
    state.index = ((index % count) + count) % count;
    renderStack();
  }

  function move(direction) {
    selectIndex(state.index + direction);
  }

  function topCard() {
    return stack.querySelector('.stack-card.is-active');
  }

  function resetDraggedCard(card) {
    if (!card) return;
    card.style.transition = 'transform .2s cubic-bezier(.2,.8,.2,1)';
    card.style.transform = '';
    window.setTimeout(() => {
      if (card && card.isConnected) card.style.transition = '';
    }, 220);
  }

  function beginDrag(event) {
    const card = event.target.closest('.stack-card.is-active');
    if (!card || !stack.contains(card) || (typeof event.button === 'number' && event.button > 0)) return;
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.latestX = event.clientX;
    state.latestY = event.clientY;
    state.startTime = performance.now();
    state.didDrag = false;
    card.classList.add('is-dragging');
    card.setPointerCapture(event.pointerId);
  }

  function updateDrag(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const card = topCard();
    if (!card) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    state.latestX = event.clientX;
    state.latestY = event.clientY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) state.didDrag = true;
    const limitedY = Math.max(-90, Math.min(90, dy * 0.24));
    const rotation = Math.max(-18, Math.min(18, dx / 18));
    card.style.transition = 'none';
    card.style.transform = `translate(${dx}px, ${limitedY}px) rotate(${rotation}deg)`;
    card.style.setProperty('--swipe-progress', Math.min(1, Math.abs(dx) / 180).toFixed(2));
  }

  function endDrag(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    const card = topCard();
    const dx = event.clientX - state.startX;
    const elapsed = Math.max(performance.now() - state.startTime, 1);
    const velocity = dx / elapsed;
    const direction = dx < 0 ? 1 : -1;
    const shouldMove = Math.abs(dx) > 120 || Math.abs(velocity) > 0.55;

    state.dragging = false;
    state.pointerId = null;
    if (card) {
      card.classList.remove('is-dragging');
      card.style.removeProperty('--swipe-progress');
    }

    if (!card) return;
    if (shouldMove && state.cards.length > 1) {
      const throwX = direction === 1 ? -900 : 900;
      const rotation = direction === 1 ? -24 : 24;
      card.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1), opacity .22s ease';
      card.style.transform = `translate(${throwX}px, 0) rotate(${rotation}deg)`;
      card.style.opacity = '0';
      setTimeout(() => {
        card.style.opacity = '';
        move(direction);
      }, 180);
    } else {
      resetDraggedCard(card);
    }
  }

  nav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-section]');
    if (!button) return;
    renderSection(button.dataset.section);
  });

  stack.addEventListener('pointerdown', beginDrag);
  stack.addEventListener('pointermove', updateDrag);
  stack.addEventListener('pointerup', endDrag);
  stack.addEventListener('pointercancel', endDrag);
  stack.addEventListener('click', (event) => {
    const card = event.target.closest('.stack-card');
    if (!card || !stack.contains(card)) return;
    if (state.didDrag) {
      event.preventDefault();
      state.didDrag = false;
      return;
    }
    const index = Number(card.dataset.index);
    if (Number.isInteger(index) && index !== state.index) selectIndex(index);
  });
  stack.addEventListener('keydown', (event) => {
    const card = event.target.closest('.stack-card');
    if (!card) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    if (event.key === 'Enter') { window.location.href = cardRoute(state.cards[state.index]); }
  });

  if (prevButton) prevButton.addEventListener('click', () => move(-1));
  if (nextButton) nextButton.addEventListener('click', () => move(1));
  window.addEventListener('keydown', (event) => {
    if (!root.matches(':hover') && document.activeElement !== stack && !stack.contains(document.activeElement)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
  });

  renderSection('reviews');
})();
