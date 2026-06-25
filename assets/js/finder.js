(async function(){
  const root = document.querySelector('[data-finder]');
  if (!root) return;
  const result = root.querySelector('[data-finder-result]');
  let data, products, posts;
  try {
    data = await (await fetch('/data/finder.json')).json();
    products = (await (await fetch('/data/products.json')).json()).products || [];
    posts = (await (await fetch('/data/posts.json')).json()).posts || [];
  } catch (e) {
    if (result) result.innerHTML = '<p>Finder data could not load. Check data/finder.json.</p>';
    return;
  }
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));
  const postMap = Object.fromEntries(posts.map(p => [p.id, p]));
  function selected(){
    const values = {};
    root.querySelectorAll('input[type="radio"]:checked').forEach(i => values[i.name] = i.value);
    return values;
  }
  function score(rule, values){
    let s = 0;
    for (const [k,v] of Object.entries(rule.match || {})) {
      if (values[k] === v) s += 4;
      else if (v === '*') s += 1;
      else s -= 4;
    }
    return s;
  }
  function choose(values){
    const ranked = [...data.rules].sort((a,b) => score(b, values) - score(a, values));
    return ranked[0] || data.rules.find(r => r.id === data.fallback) || data.rules[0];
  }
  function productCard(product, compact = false) {
    if (!product) return '';
    return `<article class="finder-product-card${compact ? ' is-compact' : ''}">
      <span>${escapeHTML(product.category || product.merchant || 'Product')}</span>
      <strong>${escapeHTML(product.name)}</strong>
      ${product.note ? `<p>${escapeHTML(product.note)}</p>` : ''}
      <a class="button${compact ? '' : ' primary'}" href="${escapeHTML(product.url || '#')}" rel="sponsored nofollow noopener" target="_blank">${escapeHTML(product.cta || 'Check current price')}</a>
    </article>`;
  }
  function render(){
    const values = selected();
    const r = choose(values);
    const specs = [['Profile', r.profile], ['Steel', r.steel], ['Length', r.length], ['Care', r.maintenanceLevel]];
    const buyOptions = (r.productIds || []).map(id => productMap[id]).filter(Boolean);
    const buyMarkup = buyOptions.length ? `<section class="finder-buy-options">
      <div class="finder-subhead"><h3>Buy options</h3><p>Affiliate search links use the Adrichops Amazon tag. Check the exact seller, size and model before buying.</p></div>
      <div class="finder-product-grid">${buyOptions.map(p => productCard(p)).join('')}</div>
    </section>` : '';
    const kit = (r.maintenanceKit || []).map(item => {
      const products = (item.productIds || []).map(id => productMap[id]).filter(Boolean);
      const links = products.length ? `<div class="finder-product-grid is-compact">${products.map(p => productCard(p, true)).join('')}</div>` : '';
      return `<div><b>${escapeHTML(item.label)}</b><span>${escapeHTML(item.text)}</span>${links}</div>`;
    }).join('');
    const articles = (r.articleIds || []).map(id => postMap[id]).filter(Boolean).map(p => `<a class="text-link" href="${p.route}">${escapeHTML(p.title)}</a>`).join(' ');
    result.innerHTML = `<span class="kicker">Recommendation</span><h3>${escapeHTML(r.title)}</h3><p>${escapeHTML(r.why)}</p><div class="finder-specs">${specs.map(([k,v]) => `<div><b>${k}</b><span>${escapeHTML(v)}</span></div>`).join('')}</div><p><strong>Watch out:</strong> ${escapeHTML(r.avoid || '')}</p>${buyMarkup}<h3 class="finder-section-title">Maintenance setup</h3><div class="maintenance-kit">${kit}</div><h3 class="finder-section-title">Read next</h3><p>${articles}</p>`;
    localStorage.setItem('adrichops-finder', JSON.stringify(values));
  }
  function escapeHTML(str){ return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
  const stored = JSON.parse(localStorage.getItem('adrichops-finder') || '{}');
  Object.entries(stored).forEach(([name,value]) => {
    const input = root.querySelector(`input[name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`);
    if (input) input.checked = true;
  });
  root.addEventListener('change', render);
  render();
})();
