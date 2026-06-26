(function () {
  const root = document.documentElement;
  const storedTheme = localStorage.getItem('adrichops-theme') || 'dark';
  root.setAttribute('data-theme', storedTheme);
  const themeButton = document.querySelector('[data-theme-toggle]');
  const brandLogo = document.querySelector('[data-brand-logo]');
  const themeFavicon = document.querySelector('[data-theme-favicon]');
  const moon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 15.8A8.5 8.5 0 0 1 8.2 4 7 7 0 1 0 20 15.8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const sun = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function syncThemeAssets(){
    const isDark = root.getAttribute('data-theme') === 'dark';
    if(themeButton) themeButton.innerHTML = isDark ? sun : moon;
    if(brandLogo) brandLogo.src = isDark ? brandLogo.dataset.logoDark : brandLogo.dataset.logoLight;
    if(themeFavicon) themeFavicon.href = isDark ? '/assets/brand/favicon-dark.png' : '/assets/brand/favicon-light.png';
  }
  syncThemeAssets();
  if (themeButton) themeButton.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('adrichops-theme', next);
    syncThemeAssets();
  });

  const navToggle = document.querySelector('[data-nav-toggle]');
  const navMenu = document.querySelector('[data-nav-menu]');
  const navLinks = navMenu ? [...navMenu.querySelectorAll('a')] : [];
  const navScrim = document.createElement('button');
  navScrim.type = 'button';
  navScrim.className = 'nav-scrim';
  navScrim.setAttribute('aria-label', 'Close navigation menu');
  document.body.appendChild(navScrim);

  function openNav(){
    if (!navToggle || !navMenu) return;
    navMenu.classList.add('is-open');
    document.body.classList.add('nav-open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Close navigation menu');
    setTimeout(() => navLinks[0] && navLinks[0].focus(), 0);
  }
  function closeNav(restoreFocus){
    if (!navToggle || !navMenu) return;
    navMenu.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open navigation menu');
    if (restoreFocus) navToggle.focus();
  }
  function toggleNav(){
    const isOpen = navToggle && navToggle.getAttribute('aria-expanded') === 'true';
    isOpen ? closeNav(false) : openNav();
  }
  if (navToggle) navToggle.addEventListener('click', toggleNav);
  navScrim.addEventListener('click', () => closeNav(true));
  navLinks.forEach(link => link.addEventListener('click', () => closeNav(false)));
  window.matchMedia('(min-width: 1061px)').addEventListener('change', e => {
    if (e.matches) closeNav(false);
  });

  const searchButton = document.querySelector('[data-search-open]');
  const dialog = document.querySelector('[data-search-dialog]');
  const closeButton = document.querySelector('[data-search-close]');
  const input = document.querySelector('[data-search-input]');
  const results = document.querySelector('[data-search-results]');
  let posts = [];
  async function loadPosts(){
    if (posts.length) return posts;
    try { const res = await fetch('/data/posts.json'); const json = await res.json(); posts = json.posts || []; } catch(e) { posts = []; }
    return posts;
  }
  function openSearch(){
    if (!dialog) return;
    closeNav(false);
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    loadPosts().then(() => { renderSearch(''); setTimeout(() => input && input.focus(), 0); });
  }
  function closeSearch(){
    if (!dialog) return;
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
  }
  function renderSearch(q){
    if (!results) return;
    const query = q.trim().toLowerCase();
    const matches = posts.filter(p => {
      const hay = [p.title, p.summary, p.type, p.category, p.maker, p.steel, p.bestFor].join(' ').toLowerCase();
      return !query || hay.includes(query);
    }).slice(0, 9);
    results.innerHTML = matches.map(p => `<a class="search-result" href="${p.route}"><strong>${escapeHTML(p.title)}</strong><span>${escapeHTML(p.type || 'Note')} · ${escapeHTML(p.readTime || '')}</span></a>`).join('') || '<div class="search-result"><strong>No matching notes yet.</strong><span>Try maker, nakiri, VG10, Shapton or board.</span></div>';
  }
  function escapeHTML(str){ return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
  if (searchButton) searchButton.addEventListener('click', openSearch);
  if (closeButton) closeButton.addEventListener('click', closeSearch);
  if (dialog) dialog.addEventListener('click', e => { if (e.target === dialog) closeSearch(); });
  if (input) input.addEventListener('input', e => renderSearch(e.target.value));
  window.addEventListener('keydown', e => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape') { closeSearch(); closeNav(true); }
  });

  document.querySelectorAll('[data-save-post]').forEach(btn => {
    const id = btn.getAttribute('data-save-post');
    const saved = new Set(JSON.parse(localStorage.getItem('adrichops-saved') || '[]'));
    function sync(){ btn.classList.toggle('primary', saved.has(id)); btn.setAttribute('aria-pressed', saved.has(id) ? 'true' : 'false'); }
    sync();
    btn.addEventListener('click', () => { saved.has(id) ? saved.delete(id) : saved.add(id); localStorage.setItem('adrichops-saved', JSON.stringify([...saved])); sync(); });
  });
  document.querySelectorAll('[data-copy-link]').forEach(btn => btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); btn.textContent = 'Copied'; setTimeout(()=>btn.textContent='Copy link', 1400); } catch(e) {}
  }));

  document.querySelectorAll('[data-filter-input]').forEach(input => {
    const target = input.getAttribute('data-filter-input');
    const rows = [...document.querySelectorAll(`[data-filter-group="${target}"] [data-filter-item]`)];
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      rows.forEach(row => { row.hidden = q && !row.getAttribute('data-filter-text').toLowerCase().includes(q); });
    });
  });

  document.querySelectorAll('[data-current-url]').forEach(input => {
    input.value = location.href;
  });
  document.querySelectorAll('[data-current-path]').forEach(input => {
    input.value = location.pathname;
  });

  function bindAsyncForm(selector, successMessage) {
    document.querySelectorAll(selector).forEach(form => {
      const status = form.querySelector('[data-form-status]');
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        if (status) {
          status.textContent = 'Sending...';
          status.classList.remove('is-error');
        }
        if (button) button.disabled = true;
        try {
          const response = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: { 'accept': 'application/json' }
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Something went wrong.');
          form.reset();
          form.querySelectorAll('[data-current-url]').forEach(input => { input.value = location.href; });
          form.querySelectorAll('[data-current-path]').forEach(input => { input.value = location.pathname; });
          if (status) status.textContent = data.message || successMessage;
        } catch (error) {
          if (status) {
            status.textContent = error.message || 'Could not send. Try again later.';
            status.classList.add('is-error');
          }
        } finally {
          if (button) button.disabled = false;
        }
      });
    });
  }
  bindAsyncForm('[data-feedback-form]', 'Feedback sent.');
  bindAsyncForm('[data-newsletter-form]', 'Signed up.');
})();
