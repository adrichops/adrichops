
(() => {
  const isMinimalHome = () => document.body.classList.contains('variant-minimal-blog') && document.body.dataset.page === 'minimal-home';
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const isMakerPost = (post) => AC.postTone(post).includes('maker spotlight') || String(post.type || '').toLowerCase().includes('maker spotlight');

  const categoryFor = (post) => {
    if (post.category === 'culture') return 'culture';
    const classified = AC.classifyPost(post);
    if (classified === 'culture') return 'culture';
    return classified;
  };

  const sortPosts = (posts) => [...posts].sort((a, b) => {
    const af = a.featured ? 1 : 0;
    const bf = b.featured ? 1 : 0;
    if (bf !== af) return bf - af;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  const meta = (post) => [categoryFor(post), post.readTime || 'read', post.steel || post.bestFor || 'note'].filter(Boolean).slice(0, 3);

  const rowToken = (post) => {
    const tokens = { profiles: 'PR', review: 'RV', sharpening: 'SH', maintenance: 'MT', culture: 'CL', maker: 'MK' };
    return isMakerPost(post) ? tokens.maker : tokens[categoryFor(post)] || 'NT';
  };

  const renderFeatured = (post) => {
    const target = q('#minimal-featured');
    if (!target || !post) return;
    target.innerHTML = `
      <article class="minimal-featured-card reveal-on-scroll">
        <div class="minimal-featured-copy">
          <p class="eyebrow">Featured note</p>
          <h2><a href="${AC.postUrl(post)}">${AC.escapeHtml(post.title)}</a></h2>
          <p>${AC.escapeHtml(post.deck || post.summary || '')}</p>
          <div class="minimal-row-meta">${meta(post).map((item) => `<span>${AC.escapeHtml(item)}</span>`).join('')}</div>
          <div class="inline-actions">
            <a class="button primary" href="${AC.postUrl(post)}">Read article</a>
            <button class="button secondary" type="button" data-save-post="${AC.escapeHtml(post.id)}">${AC.isSaved(post.id) ? 'Saved' : 'Save article'}</button>
          </div>
        </div>
        <a class="minimal-featured-media" href="${AC.postUrl(post)}" aria-label="Read ${AC.escapeHtml(post.title)}">
          <img src="${AC.escapeHtml(post.heroImage || 'assets/img/hero-gyuto.svg')}" alt="${AC.escapeHtml(post.heroAlt || '')}">
        </a>
      </article>`;
  };

  const renderRow = (post, index) => `
    <a class="minimal-row" href="${AC.postUrl(post)}">
      <span class="minimal-row-number" aria-label="${String(index + 1).padStart(2, '0')}">${rowToken(post)}</span>
      <span class="minimal-row-copy">
        <span class="minimal-row-meta">${meta(post).map((item) => `<span>${AC.escapeHtml(item)}</span>`).join('')}</span>
        <h3>${AC.escapeHtml(post.title)}</h3>
        <p>${AC.escapeHtml(post.summary || post.deck || '')}</p>
      </span>
      <img src="${AC.escapeHtml(post.heroImage || 'assets/img/hero-gyuto.svg')}" alt="${AC.escapeHtml(post.heroAlt || '')}" loading="lazy">
    </a>`;

  const init = async () => {
    if (!isMinimalHome()) return;
    const posts = sortPosts(await AC.loadPosts());
    const grid = q('#post-grid');
    const stats = q('#journal-stats');
    const search = q('#post-search');
    const filters = qa('[data-filter]');
    if (!grid) return;

    if (AC.initFinder) AC.initFinder(posts);
    renderFeatured(posts.find((post) => post.featured) || posts[0]);

    const params = new URLSearchParams(window.location.search);
    const initialCategory = ['all', 'profiles', 'review', 'maker', 'sharpening', 'maintenance', 'culture', 'saved'].includes(params.get('deck')) ? params.get('deck') : 'all';
    const state = { category: initialCategory, query: params.get('q') || '' };
    if (search && state.query) search.value = state.query;

    const matches = (post) => {
      if (state.category === 'saved' && !AC.isSaved(post.id)) return false;
      const categoryMatch = state.category === 'all' || state.category === 'saved' || (state.category === 'maker' ? isMakerPost(post) : categoryFor(post) === state.category || AC.classifyPost(post) === state.category || post.category === state.category);
      const query = state.query.trim().toLowerCase();
      return categoryMatch && (!query || AC.postTone(post).includes(query));
    };

    const draw = () => {
      const visible = posts.filter(matches);
      grid.innerHTML = visible.length ? visible.map(renderRow).join('') : '<div class="empty-state">No notes match that filter yet.</div>';
      if (stats) stats.textContent = `${visible.length} of ${posts.length} notes shown`;
      filters.forEach((item) => item.classList.toggle('active', item.dataset.filter === state.category));
      AC.syncSavedControls();
      AC.initReveal();
    };


    document.addEventListener('click', (event) => {
      const hrefLink = event.target.closest('a[href^="index.html?deck="]');
      if (!hrefLink) return;
      const url = new URL(hrefLink.getAttribute('href'), window.location.href);
      const category = url.searchParams.get('deck') || 'all';
      if (!['all', 'profiles', 'review', 'maker', 'sharpening', 'maintenance', 'culture', 'saved'].includes(category)) return;
      event.preventDefault();
      state.category = category;
      state.query = url.searchParams.get('q') || '';
      if (search) search.value = state.query;
      draw();
      q('#latest')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', hrefLink.getAttribute('href'));
    });

    filters.forEach((button) => {
      button.addEventListener('click', () => {
        state.category = button.dataset.filter || 'all';
        filters.forEach((item) => item.classList.toggle('active', item === button));
        draw();
      });
    });

    if (search) search.addEventListener('input', () => {
      state.query = search.value;
      draw();
    });

    draw();
  };

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
      const grid = q('#post-grid');
      if (grid) grid.innerHTML = `<div class="empty-state">${AC.escapeHtml(error.message)}</div>`;
    });
  });
})();
