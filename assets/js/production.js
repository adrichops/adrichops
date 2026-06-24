(() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => AC.escapeHtml(value || '');
  const postUrl = (post) => AC.postUrl(post);
  const sortPosts = (posts) => [...posts].sort((a, b) => {
    const af = a.featured ? 1 : 0;
    const bf = b.featured ? 1 : 0;
    if (bf !== af) return bf - af;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
  const statusOf = (post) => post.status || (String(post.type || '').toLowerCase().includes('review') ? 'Research brief' : 'Guide');
  const isMaker = (post) => String(post.type || '').toLowerCase().includes('maker spotlight');
  const isReview = (post) => String(post.type || '').toLowerCase().includes('review') || String(post.id || '').includes('shortlist-review');
  const reviewKind = (post) => {
    const text = AC.postTone(post);
    if (text.includes('hasegawa') || text.includes('asahi') || text.includes('hinoki') || text.includes('board')) return 'boards';
    if (text.includes('stone') || text.includes('shapton') || text.includes('king')) return 'stones';
    return 'knives';
  };
  const codeFor = (post) => {
    if (isMaker(post)) return 'MK';
    if (isReview(post)) return 'RV';
    const c = AC.classifyPost(post);
    return { sharpening: 'SH', maintenance: 'MT', culture: 'CL', profiles: 'PF', guide: 'GD', review: 'RV' }[c] || 'NT';
  };
  const meta = (post) => [statusOf(post), post.readTime, post.bestFor || post.steel || post.maker].filter(Boolean).slice(0, 3);
  const metaCluster = (post) => `<div class="meta-cluster">${meta(post).map((item) => `<span>${esc(item)}</span>`).join('')}</div>`;
  const row = (post, index = 0) => `
    <a class="note-row" href="${postUrl(post)}">
      <span class="note-row-code">${esc(codeFor(post))}${String(index + 1).padStart(2, '0')}</span>
      <span>
        <span class="status-strip">${meta(post).map((item) => `<span class="database-pill">${esc(item)}</span>`).join('')}</span>
        <h3>${esc(post.title)}</h3>
        <p>${esc(post.summary || post.deck || '')}</p>
      </span>
      <img src="${esc(post.heroImage || 'assets/img/hero-gyuto.svg')}" alt="${esc(post.heroAlt || '')}" loading="lazy">
    </a>`;
  const card = (post) => `
    <a class="editorial-card" href="${postUrl(post)}">
      <div>
        ${metaCluster(post)}
        <h3>${esc(post.title)}</h3>
        <p>${esc(post.summary || post.deck || '')}</p>
      </div>
      <img src="${esc(post.heroImage || 'assets/img/hero-gyuto.svg')}" alt="${esc(post.heroAlt || '')}" loading="lazy">
    </a>`;

  const attachFilter = ({ posts, list, stats, search, buttons, predicate, render = row }) => {
    let active = 'all';
    let query = '';
    const draw = () => {
      const visible = posts.filter((post) => {
        const filterOk = predicate(post, active);
        const queryOk = !query.trim() || AC.postTone(post).includes(query.trim().toLowerCase());
        return filterOk && queryOk;
      });
      list.innerHTML = visible.length ? visible.map(render).join('') : '<div class="empty-state">No notes match that filter.</div>';
      if (stats) stats.textContent = `${visible.length} of ${posts.length} notes shown`;
      buttons.forEach((button) => button.classList.toggle('active', button.dataset.filter === active || button.dataset.reviewFilter === active || button.dataset.makerFilter === active));
      AC.syncSavedControls();
      AC.initReveal();
    };
    buttons.forEach((button) => button.addEventListener('click', () => { active = button.dataset.filter || button.dataset.reviewFilter || button.dataset.makerFilter || 'all'; draw(); }));
    if (search) search.addEventListener('input', () => { query = search.value; draw(); });
    draw();
  };

  const initHome = async (posts) => {
    const count = q('#home-count');
    if (count) count.textContent = `${posts.length} source-led notes`;
    const featured = q('#home-featured');
    if (featured) {
      const first = posts.find((p) => p.id === 'tojiro-dp-210mm-gyuto-shortlist-review') || posts[0];
      featured.innerHTML = `
        <article class="feature-note notion-panel">
          <div>
            <p class="eyebrow"><span class="red-dot" aria-hidden="true"></span>Start with the baseline</p>
            <h3>${esc(first.title)}</h3>
            <p>${esc(first.deck || first.summary || '')}</p>
            ${metaCluster(first)}
            <div class="button-row"><a class="button primary" href="${postUrl(first)}">Read the note</a><a class="button secondary" href="recommendations.html">Use the Knife Finder</a></div>
          </div>
          <img src="${esc(first.heroImage || 'assets/img/hero-gyuto.svg')}" alt="${esc(first.heroAlt || '')}">
        </article>`;
    }
    const latest = q('#home-latest-list');
    if (latest) latest.innerHTML = sortPosts(posts).slice(0, 10).map(row).join('');
    const source = q('#home-source-summary');
    if (source) {
      const sourceCount = posts.reduce((sum, p) => sum + ((p.sourceTrail || p.sources || []).length), 0);
      source.textContent = `${sourceCount} source-trail entries across maker, retailer, forum and reference notes.`;
    }
  };

  const initReviews = (posts) => {
    const reviewPosts = sortPosts(posts.filter(isReview));
    const list = q('#review-list');
    if (!list) return;
    attachFilter({
      posts: reviewPosts,
      list,
      stats: q('#review-stats'),
      search: q('#review-search'),
      buttons: qa('[data-review-filter]'),
      predicate: (post, active) => active === 'all' || reviewKind(post) === active || (active === 'owned' && statusOf(post).toLowerCase().includes('owned')),
      render: card
    });
  };

  const initMakers = (posts) => {
    const makerPosts = sortPosts(posts.filter(isMaker));
    const list = q('#maker-list');
    if (!list) return;
    attachFilter({
      posts: makerPosts,
      list,
      stats: q('#maker-stats'),
      search: q('#maker-search'),
      buttons: qa('[data-maker-filter]'),
      predicate: (post, active) => active === 'all' || AC.postTone(post).includes(active),
      render: card
    });
  };

  const initRecommendations = async (posts) => {
    const panel = q('[data-production-finder]');
    if (!panel) return;
    const result = q('#production-finder-result');
    const response = await fetch('data/finder.json', { cache: 'no-store' });
    const data = await response.json();
    const state = { ...(data.defaults || {}) };
    const exactKey = () => `${state.task}:${state.care}:${state.intent}`;
    const getRec = () => data.recommendations[exactKey()] || data.recommendations[`${state.task}:${state.care}:learn`] || data.recommendations[data.fallbacks[state.task]] || Object.values(data.recommendations)[0];
    const drawChoices = () => {
      Object.entries(data.choices || {}).forEach(([group, choices]) => {
        const target = q(`[data-choice-group="${group}"]`, panel);
        if (!target) return;
        target.innerHTML = choices.map((choice) => `<button class="choice${state[group] === choice.value ? ' active' : ''}" type="button" data-finder-group="${esc(group)}" data-finder-value="${esc(choice.value)}" aria-pressed="${state[group] === choice.value ? 'true' : 'false'}">${esc(choice.label)}</button>`).join('');
      });
    };
    const drawResult = () => {
      const rec = getRec();
      const recPosts = (rec.articleIds || []).map((id) => posts.find((post) => post.id === id)).filter(Boolean);
      result.innerHTML = `
        <p class="eyebrow"><span class="red-dot" aria-hidden="true"></span>Recommended setup</p>
        <h3>${esc(rec.title)}</h3>
        <p class="section-note">${esc(rec.why)}</p>
        <div class="finder-specs">
          <div><span>Profile</span><strong>${esc(rec.profile)}</strong></div>
          <div><span>Steel direction</span><strong>${esc(rec.steel)}</strong></div>
          <div><span>Length</span><strong>${esc(rec.length)}</strong></div>
        </div>
        <h4>Maintenance needs</h4>
        <ul class="kit-list">${(rec.maintenance || []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
        <h4>Read next</h4>
        <div class="read-next-list">${recPosts.map((post) => `<a href="${postUrl(post)}"><strong>${esc(post.title)}</strong><br><small>${esc(post.summary || '')}</small></a>`).join('')}</div>`;
    };
    panel.addEventListener('click', (event) => {
      const button = event.target.closest('[data-finder-group]');
      if (!button) return;
      state[button.dataset.finderGroup] = button.dataset.finderValue;
      drawChoices();
      drawResult();
    });
    drawChoices();
    drawResult();
  };

  const initExplore = (posts) => {
    const sectionWrap = q('#deck-sections');
    const cardsWrap = q('#deck-cards');
    const preview = q('#deck-preview');
    if (!sectionWrap || !cardsWrap || !preview) return;
    const sections = [
      { id: 'reviews', label: 'Reviews', note: 'Knives, boards and stones', filter: (p) => isReview(p) },
      { id: 'makers', label: 'Maker Spotlight', note: 'People and workshops', filter: (p) => isMaker(p) },
      { id: 'sharpening', label: 'Sharpening', note: 'Edges, burrs and stones', filter: (p) => AC.classifyPost(p) === 'sharpening' },
      { id: 'maintenance', label: 'Maintenance', note: 'Boards, storage and care', filter: (p) => AC.classifyPost(p) === 'maintenance' },
      { id: 'steel', label: 'Steel', note: 'Metallurgy and history', filter: (p) => AC.postTone(p).includes('steel') || AC.postTone(p).includes('yasugi') || AC.postTone(p).includes('tatara') },
      { id: 'profiles', label: 'Profiles', note: 'Shapes and jobs', filter: (p) => AC.classifyPost(p) === 'profiles' || p.category === 'guide' },
    ];
    let active = sections[0];
    let activePost = null;
    const drawPreview = (post) => {
      if (!post) return;
      activePost = post;
      preview.innerHTML = `
        <img src="${esc(post.heroImage || 'assets/img/hero-gyuto.svg')}" alt="${esc(post.heroAlt || '')}">
        <p class="eyebrow">${esc(statusOf(post))}</p>
        <h2>${esc(post.title)}</h2>
        <p class="section-note">${esc(post.summary || post.deck || '')}</p>
        ${metaCluster(post)}
        <div class="button-row"><a class="button primary" href="${postUrl(post)}">Open article</a><button class="button secondary" type="button" data-save-post="${esc(post.id)}">${AC.isSaved(post.id) ? 'Saved' : 'Save'}</button></div>`;
      AC.syncSavedControls();
    };
    const draw = () => {
      const deckPosts = sortPosts(posts.filter(active.filter)).slice(0, 10);
      sectionWrap.innerHTML = sections.map((section) => `<button class="deck-section-button${section.id === active.id ? ' is-active' : ''}" type="button" data-section="${section.id}"><span>${esc(section.note)}</span><strong>${esc(section.label)}</strong></button>`).join('');
      cardsWrap.innerHTML = deckPosts.map((post, index) => `<button class="deck-card-button${index === 0 ? ' is-active' : ''}" type="button" data-post="${esc(post.id)}" style="--i:${index};"><span class="deck-card-type"><span>${esc(codeFor(post))}</span><span>${esc(post.readTime || '')}</span></span><h3>${esc(post.title)}</h3><p>${esc(post.summary || post.deck || '')}</p><span class="status-pill">${esc(statusOf(post))}</span></button>`).join('');
      drawPreview(deckPosts[0]);
    };
    sectionWrap.addEventListener('click', (event) => {
      const button = event.target.closest('[data-section]');
      if (!button) return;
      active = sections.find((section) => section.id === button.dataset.section) || active;
      draw();
    });
    cardsWrap.addEventListener('click', (event) => {
      const button = event.target.closest('[data-post]');
      if (!button) return;
      qa('.deck-card-button', cardsWrap).forEach((item) => item.classList.toggle('is-active', item === button));
      const post = posts.find((item) => item.id === button.dataset.post);
      drawPreview(post);
    });
    draw();
  };

  const initCollectionLinks = async (posts) => {
    const latest = q('#all-notes-list');
    if (latest) latest.innerHTML = sortPosts(posts).map(row).join('');
  };

  document.addEventListener('DOMContentLoaded', async () => {
    if (!document.body.classList.contains('variant-production')) return;
    let posts = [];
    try { posts = await AC.loadPosts(); } catch (error) { console.error(error); }
    const page = document.body.dataset.page;
    if (page === 'production-home') initHome(posts);
    if (page === 'reviews') initReviews(posts);
    if (page === 'makers') initMakers(posts);
    if (page === 'recommendations') initRecommendations(posts).catch(console.error);
    if (page === 'explore') initExplore(posts);
    initCollectionLinks(posts);
    AC.initReveal();
  });
})();
