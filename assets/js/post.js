document.addEventListener('DOMContentLoaded', async () => {
  const root = AC.qs('#post-root');
  const related = AC.qs('#related-posts');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const posts = await AC.loadPosts();
  const post = posts.find((item) => item.id === id) || posts[0];
  if (!post) { root.innerHTML = '<div class="empty-state">No posts have been published yet.</div>'; return; }

  const esc = AC.escapeHtml;
  const status = post.status || (String(post.type || '').toLowerCase().includes('review') ? 'Research brief' : 'Guide');
  const slugify = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  const sections = (post.body || []).map((section, index) => ({ ...section, id: `${slugify(section.heading)}-${index + 1}` }));
  const specs = { Status: status, Type: post.type || 'Note', ...(post.specs || {}) };
  const specRows = Object.entries(specs).filter(([, value]) => value).map(([label, value]) => `<div class="spec-row"><dt class="spec-label">${esc(label)}</dt><dd class="spec-value">${esc(value)}</dd></div>`).join('');
  const toc = sections.map((section) => `<a href="#${section.id}">${esc(section.heading || 'Section')}</a>`).join('');
  const sources = post.sourceTrail || post.sources || [];

  document.title = `${post.title} | Adrichops`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', post.summary || post.deck || 'Kitchen knife article from Adrichops.');
  const crumb = AC.qs('#crumb-title');
  if (crumb) crumb.textContent = post.title;

  root.innerHTML = `
    <article class="article-shell">
      <header class="article-hero reveal-on-scroll">
        <div class="article-hero-copy">
          <div class="meta-cluster"><span>${esc(status)}</span><span>${esc(post.type || 'Note')}</span><span>${esc(post.readTime || 'Read')}</span><span>${esc(AC.formatDate(post.date))}</span></div>
          <h1>${esc(post.title)}</h1>
          <p class="article-deck page-standfirst">${esc(post.deck || post.summary || '')}</p>
          <div class="verdict-strip" aria-label="Article snapshot">
            <div class="stat-tile"><span>Verdict</span><strong>${esc(post.verdict || status)}</strong></div>
            <div class="stat-tile"><span>Best for</span><strong>${esc(post.bestFor || 'Careful cooks')}</strong></div>
            <div class="stat-tile"><span>Research posture</span><strong>${esc(status)}</strong></div>
          </div>
          <div class="button-row article-actions">
            <button class="button secondary" type="button" data-save-post="${esc(post.id)}">${AC.isSaved(post.id) ? 'Saved' : 'Save article'}</button>
            <button class="button ghost" type="button" data-copy-link>Copy link</button>
            <button class="button ghost" type="button" data-focus-mode>Focus mode</button>
          </div>
        </div>
      </header>
      <div class="article-layout">
        <aside class="article-aside" aria-label="Article details">
          <section class="spec-card"><p class="eyebrow">At a glance</p><dl class="spec-list">${specRows}</dl></section>
          ${toc ? `<nav class="toc-card" aria-label="Article sections"><p class="eyebrow">In this note</p>${toc}</nav>` : ''}
          <section class="affiliate-note"><strong>Disclosure:</strong> This post may contain affiliate links. As an Amazon Associate I earn from qualifying purchases.</section>
        </aside>
        <div class="article-body">
          ${post.pullQuote ? `<blockquote class="pull-quote">${esc(post.pullQuote)}</blockquote>` : ''}
          ${sections.map((section) => `<section id="${section.id}" class="article-section reveal-on-scroll"><h2>${esc(section.heading || '')}</h2>${(section.paragraphs || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}</section>`).join('')}
          ${(post.takeaways || []).length ? `<section class="takeaway-box reveal-on-scroll"><h2>Board notes</h2><ol>${post.takeaways.map((item) => `<li>${esc(item)}</li>`).join('')}</ol></section>` : ''}
          ${sources.length ? `<section class="source-section reveal-on-scroll"><h2>Source trail</h2><p class="section-note">Research notes used for this article. Product links remain labelled separately.</p><div class="source-list">${sources.map((source) => `<a href="${esc(source.url || '#')}" target="_blank" rel="noopener noreferrer"><span>${esc(source.type || 'Source')}</span><strong>${esc(source.name || 'Source')}</strong>${source.note ? `<small>${esc(source.note)}</small>` : ''}</a>`).join('')}</div></section>` : ''}
          ${(post.products || []).length ? `<section id="links" class="product-section reveal-on-scroll"><h2>Links mentioned</h2><p class="section-note">Paid links are labelled. Check current retailer details before buying.</p>${AC.renderProductCards(post.products)}</section>` : ''}
        </div>
      </div>
    </article>`;

  AC.syncSavedControls();
  AC.initReveal();

  const updateProgress = () => {
    const bar = AC.qs('[data-reading-progress]');
    if (!bar) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const value = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
    bar.style.width = `${value}%`;
  };
  const copyButton = AC.qs('[data-copy-link]');
  if (copyButton) copyButton.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(window.location.href); copyButton.textContent = 'Copied'; }
    catch (error) { copyButton.textContent = 'Copy failed'; }
    setTimeout(() => { copyButton.textContent = 'Copy link'; }, 1600);
  });
  const focusButton = AC.qs('[data-focus-mode]');
  if (focusButton) focusButton.addEventListener('click', () => {
    document.body.classList.toggle('focus-reading');
    focusButton.textContent = document.body.classList.contains('focus-reading') ? 'Exit focus' : 'Focus mode';
  });
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  if (related) {
    const relatedPosts = posts.filter((item) => item.id !== post.id && AC.classifyPost(item) === AC.classifyPost(post)).slice(0, 4);
    const fallback = posts.filter((item) => item.id !== post.id).slice(0, 4);
    const cards = relatedPosts.length ? relatedPosts : fallback;
    related.innerHTML = cards.map((item) => `<a class="editorial-card" href="${AC.postUrl(item)}"><div><div class="meta-cluster"><span>${esc(item.status || item.type || 'Note')}</span><span>${esc(item.readTime || '')}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.summary || item.deck || '')}</p></div><img src="${esc(item.heroImage || 'assets/img/hero-gyuto.svg')}" alt="${esc(item.heroAlt || '')}" loading="lazy"></a>`).join('');
  }
});
