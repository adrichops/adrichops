(() => {
  const DATA_URL = 'data/posts.json';
  const STORE_KEYS = {
    theme: 'adrichops:theme',
    saved: 'adrichops:saved-posts',
    finder: 'adrichops:finder-state'
  };

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const formatDate = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(`${isoDate}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return escapeHtml(isoDate);
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  const safeJsonRead = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  };

  const safeJsonWrite = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Local storage may be unavailable in strict privacy contexts.
    }
  };

  const loadPosts = async () => {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${DATA_URL}`);
    const payload = await response.json();
    const posts = Array.isArray(payload) ? payload : Array.isArray(payload.posts) ? payload.posts : [];
    return [...posts].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  };

  const getTheme = () => {
    try {
      return localStorage.getItem(STORE_KEYS.theme) || document.documentElement.dataset.theme || 'dark';
    } catch (error) {
      return document.documentElement.dataset.theme || 'dark';
    }
  };

  const syncThemeControls = (theme) => {
    qsa('[data-theme-toggle]').forEach((toggle) => {
      toggle.setAttribute('aria-label', `Current theme: ${theme}. Toggle colour theme`);
      toggle.setAttribute('title', theme === 'dark' ? 'Dark theme' : 'Light theme');
    });
  };

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    syncThemeControls(theme);
    try {
      localStorage.setItem(STORE_KEYS.theme, theme);
    } catch (error) {
      // Ignore storage errors.
    }
  };

  const postUrl = (post) => `post.html?id=${encodeURIComponent(post.id)}`;

  const postTone = (post = {}) => {
    const bodyText = (post.body || []).flatMap((section) => [section.heading, ...(section.paragraphs || [])]).join(' ');
    const productText = (post.products || []).map((product) => [product.name, product.note, product.category, product.merchant].join(' ')).join(' ');
    const takeaways = (post.takeaways || []).join(' ');
    const sources = (post.sourceTrail || post.sources || []).map((source) => [source.name, source.note, source.type].join(' ')).join(' ');
    return [post.title, post.summary, post.deck, post.category, post.type, post.steel, post.maker, post.bestFor, post.verdict, post.id, bodyText, productText, takeaways, sources].join(' ').toLowerCase();
  };

  const readingList = () => new Set(safeJsonRead(STORE_KEYS.saved, []));

  const writeReadingList = (set) => safeJsonWrite(STORE_KEYS.saved, Array.from(set));

  const isSaved = (id) => readingList().has(id);

  const toggleSaved = (id) => {
    const saved = readingList();
    if (saved.has(id)) saved.delete(id);
    else saved.add(id);
    writeReadingList(saved);
    syncSavedControls();
    return saved.has(id);
  };

  const syncSavedControls = () => {
    const saved = readingList();
    qsa('[data-save-post]').forEach((button) => {
      const id = button.getAttribute('data-save-post');
      const active = saved.has(id);
      button.classList.toggle('is-saved', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      const label = active ? 'Saved' : 'Save';
      button.innerHTML = `<span aria-hidden="true">${active ? 'Saved' : 'Save'}</span><span class="visually-hidden">${label} article</span>`;
    });
  };

  const metaLine = (post) => `
    <div class="meta-row">
      <span class="badge">${escapeHtml(post.type || 'Note')}</span>
      <span class="meta-pill">${formatDate(post.date)}</span>
      <span class="meta-pill">${escapeHtml(post.readTime || '4 min read')}</span>
      ${post.rating ? `<span class="meta-pill">Score ${escapeHtml(post.rating)}</span>` : ''}
    </div>`;

  const classifyPost = (post = {}) => {
    const tone = postTone(post);
    if (post.category === 'culture') return 'culture';
    if (post.category === 'review' || tone.includes('shortlist review')) return 'review';
    if (tone.includes('sharpen') || tone.includes('honing') || tone.includes('whetstone') || tone.includes('strop') || tone.includes('burr')) return 'sharpening';
    if (tone.includes('maintenance') || tone.includes('storage') || tone.includes('board') || tone.includes('carbon') || tone.includes('rust') || tone.includes('patina')) return 'maintenance';
    if (tone.includes('profile') || tone.includes('gyuto') || tone.includes('santoku') || tone.includes('nakiri') || tone.includes('petty') || tone.includes('paring') || tone.includes('serrated') || tone.includes('cleaver')) return 'profiles';
    if (tone.includes('japanese') || tone.includes('sakai') || tone.includes('sanjo') || tone.includes('hamono') || tone.includes('maker spotlight') || tone.includes('blacksmith') || tone.includes('sharpener') || tone.includes('konosuke') || tone.includes('takada') || tone.includes('myojin')) return 'culture';
    return post.category || 'guide';
  };

  const matchesFilter = (post, filter) => {
    if (filter === 'all') return true;
    if (filter === 'saved') return readingList().has(post.id);
    if (filter === 'guide') return post.category === 'guide';
    return classifyPost(post) === filter || post.category === filter || String(post.type || '').toLowerCase().includes(filter);
  };

  const sortedPosts = (posts, mode) => {
    const copy = [...posts];
    if (mode === 'alpha') return copy.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    if (mode === 'newest') return copy.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return copy.sort((a, b) => {
      const af = a.featured ? 1 : 0;
      const bf = b.featured ? 1 : 0;
      if (bf !== af) return bf - af;
      const priority = { guide: 3, review: 2, sharpening: 1, maintenance: 1, profiles: 2 };
      return (priority[classifyPost(b)] || 0) - (priority[classifyPost(a)] || 0) || String(b.date || '').localeCompare(String(a.date || ''));
    });
  };

  const renderPostCard = (post) => {
    const tone = classifyPost(post);
    const productCount = Array.isArray(post.products) ? post.products.length : 0;
    return `
    <article class="post-card ${post.featured ? 'is-featured-card' : ''}" data-category="${escapeHtml(tone)}" data-search="${escapeHtml(postTone(post))}">
      <a class="card-media" href="${postUrl(post)}" aria-label="Read ${escapeHtml(post.title)}">
        <img src="${escapeHtml(post.heroImage || 'assets/img/hero-gyuto.svg')}" alt="${escapeHtml(post.heroAlt || '')}" loading="lazy">
      </a>
      <div class="card-content">
        ${metaLine(post)}
        <h2><a href="${postUrl(post)}">${escapeHtml(post.title)}</a></h2>
        <p>${escapeHtml(post.summary || post.deck || '')}</p>
        <div class="card-chips" aria-label="Article details">
          <span>${escapeHtml(post.bestFor || tone)}</span>
          ${post.steel ? `<span>${escapeHtml(post.steel)}</span>` : ''}
          ${productCount ? `<span>${productCount} links</span>` : ''}
        </div>
        <div class="card-footer">
          <button class="save-button" type="button" data-save-post="${escapeHtml(post.id)}" aria-pressed="${isSaved(post.id) ? 'true' : 'false'}">${isSaved(post.id) ? 'Saved' : 'Save'}</button>
          <a class="read-link" href="${postUrl(post)}">Read note</a>
        </div>
      </div>
    </article>`;
  };

  const renderProductCards = (products = []) => {
    if (!products.length) return '';
    return `
      <div class="product-strip" aria-label="Affiliate product links">
        ${products.map((product) => `
          <article class="product-card">
            <div>
              <div class="product-merchant">${escapeHtml(product.merchant || 'Retailer')}<span class="paid-label">paid link</span></div>
              <h3>${escapeHtml(product.name || 'Product')}</h3>
              <p>${escapeHtml(product.note || 'Check current retailer details before buying.')}</p>
            </div>
            <a class="button secondary" href="${escapeHtml(product.url || '#')}" target="_blank" rel="sponsored nofollow noopener">${escapeHtml(product.cta || 'Check current price')}</a>
          </article>
        `).join('')}
      </div>`;
  };

  const renderFeatured = (post) => {
    const target = qs('#featured-post');
    if (!target || !post) return;
    target.className = 'featured-review';
    target.innerHTML = `
      <div class="featured-review-copy">
        ${metaLine(post)}
        <h2 id="featured-title"><a href="${postUrl(post)}">${escapeHtml(post.title)}</a></h2>
        <p>${escapeHtml(post.deck || post.summary || '')}</p>
        <div class="verdict-strip" aria-label="Article snapshot">
          <div class="stat-tile"><span>Steel</span><strong>${escapeHtml(post.steel || 'TBC')}</strong></div>
          <div class="stat-tile"><span>Length</span><strong>${escapeHtml(post.length || 'TBC')}</strong></div>
          <div class="stat-tile"><span>Best for</span><strong>${escapeHtml(post.bestFor || 'Prep')}</strong></div>
        </div>
        <div class="inline-actions">
          <a class="button primary" href="${postUrl(post)}">Read featured note</a>
          <button class="button quiet-button" type="button" data-save-post="${escapeHtml(post.id)}">${isSaved(post.id) ? 'Saved' : 'Save'}</button>
        </div>
      </div>
      <a class="featured-review-media" href="${postUrl(post)}" aria-label="Read ${escapeHtml(post.title)}">
        <img src="${escapeHtml(post.heroImage || 'assets/img/hero-gyuto.svg')}" alt="${escapeHtml(post.heroAlt || '')}">
      </a>`;
    syncSavedControls();
  };

  const renderPhotoWall = (posts) => {
    const target = qs('#photo-wall');
    if (!target) return;
    const images = posts.flatMap((post) => {
      const gallery = Array.isArray(post.gallery) ? post.gallery : [];
      return [{ src: post.heroImage, alt: post.heroAlt, title: post.title, caption: post.category, href: postUrl(post) }, ...gallery.map((item) => ({ ...item, title: item.title || post.title, href: postUrl(post) }))];
    }).filter((item) => item.src).slice(0, 6);

    target.innerHTML = images.map((item, index) => `
      <a class="photo-tile ${index === 0 ? 'is-large' : ''}" href="${escapeHtml(item.href || '#')}">
        <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt || item.title || 'Knife photo')}" loading="lazy">
        <span class="photo-caption"><strong>${escapeHtml(item.title || 'Knife detail')}</strong><span>${escapeHtml(item.caption || item.alt || '')}</span></span>
      </a>
    `).join('');
  };

  const finderLabels = {
    task: {
      first: 'First proper knife',
      veg: 'Vegetable prep',
      compact: 'Small kitchen or smaller hands',
      edge: 'Dull knife problem'
    },
    care: {
      low: 'Low fuss',
      normal: 'Normal care',
      nerd: 'Sharpening curious'
    },
    intent: {
      learn: 'Explain the shape',
      buy: 'Show common shortlist options',
      maintain: 'Keep it working'
    }
  };

  const finderBase = {
    first: {
      low: {
        title: 'Stainless 8 inch chef knife or 210mm gyuto',
        profile: 'Chef knife / gyuto',
        steel: 'Tough stainless for the lowest friction start; VG10 stainless-clad if you want a Japanese-feeling upgrade.',
        length: '200-210mm / 8 inch',
        why: 'It handles the widest range of board work before you know which specialist shapes you actually need.',
        maintenance: ['Wash by hand and dry immediately.', 'Use a soft board; avoid glass, stone and bamboo-heavy boards.', 'Use a 1000 grit stone when it stops biting, then a few light passes on a strop.', 'Use a blade guard or magnetic strip so the edge is not knocked in a drawer.'],
        productQueries: ['Victorinox Fibrox Pro 8 inch chef knife', 'Tojiro DP 210mm gyuto F-808', 'Shapton Kuromaku 1000 whetstone', 'Leather strop or deburring block', 'Hasegawa soft cutting board'],
        articleIds: ['chef-knife-vs-gyuto-which-all-purpose-profile', 'amazon-chef-knife-shortlist-what-to-buy-first', 'hasegawa-asahi-hinoki-cutting-board-guide', 'king-vs-shapton-starter-stones-guide']
      },
      normal: {
        title: 'Stainless gyuto or lighter Western chef knife',
        profile: 'Gyuto / modern chef knife',
        steel: 'Stainless or stainless-clad VG10 with enough toughness for daily prep.',
        length: '200-210mm',
        why: 'A thinner main knife rewards good board technique without demanding carbon-steel habits.',
        maintenance: ['Keep a 1000/3000 stone as the basic progression.', 'Deburr on a leather strop or clean cork after sharpening.', 'Use a soft board and safe storage.', 'Hone only if the knife responds well to a rod; harder Japanese-style edges often prefer a stone or strop.'],
        productQueries: ['Tojiro DP 210mm gyuto F-808', 'MAC MTH-80 Professional 8 inch chef knife', 'King 1000/6000 combination whetstone', 'Leather strop or deburring block', 'Universal blade guards'],
        articleIds: ['chef-knife-vs-gyuto-which-all-purpose-profile', 'tojiro-dp-210mm-gyuto-shortlist-review', 'king-vs-shapton-starter-stones-guide', 'stropping-and-deburring-clean-apex']
      },
      nerd: {
        title: 'Thin stainless-clad gyuto with a real sharpening plan',
        profile: 'Gyuto',
        steel: 'VG10, Swedish stainless, or similar harder stainless-clad steel.',
        length: '210mm',
        why: 'It lets you feel geometry, deburring and polish without jumping straight into reactive carbon care.',
        maintenance: ['Start on 1000 grit until you can raise and remove a burr.', 'Add 3000-6000 grit only after the 1000 grit edge is consistent.', 'Use a flattening plate because stones dish faster than beginners expect.', 'Finish with a strop using very light pressure.'],
        productQueries: ['Tojiro DP 210mm gyuto F-808', 'Shapton Kuromaku 1000 whetstone', 'King 1000/6000 combination whetstone', 'Flattening plate or lapping stone', 'Leather strop or deburring block'],
        articleIds: ['tojiro-dp-210mm-gyuto-shortlist-review', 'sharpening-basics-burr-angle-pressure', 'shapton-stones-review-brief', 'stropping-and-deburring-clean-apex']
      }
    },
    veg: {
      low: {
        title: 'VG10 stainless-clad nakiri or simple stainless 165mm nakiri',
        profile: 'Nakiri',
        steel: 'VG10 with stainless cladding, AUS-8, or another stainless kitchen steel rather than reactive carbon.',
        length: '160-170mm',
        why: 'For vegetable prep, a flat nakiri gives clean push cuts and easy board contact while the stainless direction keeps upkeep low.',
        maintenance: ['Use a 1000/3000 combination stone: 1000 for the working edge, 3000 for a cleaner vegetable finish.', 'Use a leather strop or deburring block after the stone to remove wire-edge remnants.', 'Use a large soft board so the flat edge contacts the board cleanly.', 'Store in a blade guard; nakiri edges are broad and easy to knock in a drawer.'],
        productQueries: ['Nakiri knife shortlist', 'King 1000/6000 combination whetstone', 'Leather strop or deburring block', 'Hasegawa soft cutting board', 'Universal blade guards'],
        articleIds: ['nakiri-profile-guide', 'hasegawa-asahi-hinoki-cutting-board-guide', 'king-vs-shapton-starter-stones-guide', 'stropping-and-deburring-clean-apex']
      },
      normal: {
        title: 'Thin 165mm stainless-clad nakiri',
        profile: 'Nakiri',
        steel: 'VG10, VG-MAX-style stainless, or stainless-clad carbon if you accept immediate drying.',
        length: '165mm',
        why: 'A slightly harder, thinner vegetable knife makes prep feel cleaner, but it needs better edge discipline than a soft Western chef knife.',
        maintenance: ['Keep a 1000/3000 stone for normal maintenance.', 'Add a strop for deburring rather than using heavy rod pressure.', 'Flatten the stone every few sessions.', 'Dry immediately around the heel and spine, where moisture can sit.'],
        productQueries: ['Nakiri knife shortlist', 'King 1000/6000 combination whetstone', 'Leather strop or deburring block', 'Flattening plate or lapping stone', 'Hasegawa soft cutting board'],
        articleIds: ['nakiri-profile-guide', 'sharpening-basics-burr-angle-pressure', 'king-vs-shapton-starter-stones-guide', 'hasegawa-cutting-board-review-brief']
      },
      nerd: {
        title: 'Laser-leaning nakiri with a controlled sharpening setup',
        profile: 'Nakiri',
        steel: 'Hard stainless-clad steel or carbon if you actively want patina care.',
        length: '165-180mm',
        why: 'Vegetable knives expose board contact, bevel consistency and deburring quickly, so they are good sharpening teachers.',
        maintenance: ['Use 1000 grit to reset the edge and 3000-6000 grit only for refinement.', 'Strop on leather or clean newspaper with almost no pressure.', 'Use a flattening plate; a dished stone rounds long flat edges.', 'Avoid twisting in dense squash or wedging through bone.'],
        productQueries: ['Nakiri knife shortlist', 'Shapton Kuromaku 1000 whetstone', 'King 1000/6000 combination whetstone', 'Flattening plate or lapping stone', 'Leather strop or deburring block'],
        articleIds: ['nakiri-profile-guide', 'sharpening-basics-burr-angle-pressure', 'shapton-stones-review-brief', 'hasegawa-asahi-hinoki-cutting-board-guide']
      }
    },
    compact: {
      low: {
        title: 'Stainless santoku or 150mm petty',
        profile: 'Santoku / petty',
        steel: 'Stainless steel with a durable edge rather than delicate high-hardness steel.',
        length: '150-180mm',
        why: 'Shorter blades feel more controlled on small boards and in cramped kitchens.',
        maintenance: ['Use a 1000 grit stone for basic sharpening.', 'Use a compact strop or deburring block after the stone.', 'Keep the board large enough that the tip is not constantly falling off the edge.', 'Use blade guards if storage is drawer-based.'],
        productQueries: ['Santoku knife shortlist', '120-150mm petty knife shortlist', 'Shapton Kuromaku 1000 whetstone', 'Leather strop or deburring block', 'Universal blade guards'],
        articleIds: ['santoku-profile-guide', 'petty-paring-utility-profile-guide', 'knife-maintenance-daily-routine', 'boards-storage-and-edge-life']
      },
      normal: {
        title: 'Stainless 165-180mm santoku',
        profile: 'Santoku',
        steel: 'Stainless or stainless-clad VG10.',
        length: '165-180mm',
        why: 'A santoku is compact but still broad enough for normal vegetable and protein prep.',
        maintenance: ['Use 1000/3000 grit stones as the core setup.', 'Strop lightly to deburr.', 'Avoid heavy rocking into the board; use push cuts and small slices.', 'Use safe storage because santoku tips can still chip if knocked.'],
        productQueries: ['Santoku knife shortlist', 'King 1000/6000 combination whetstone', 'Leather strop or deburring block', 'Hasegawa soft cutting board', 'Universal blade guards'],
        articleIds: ['santoku-profile-guide', 'whetstone-grits-1000-3000-6000', 'stropping-and-deburring-clean-apex', 'boards-storage-and-edge-life']
      },
      nerd: {
        title: 'Thin santoku plus petty pairing',
        profile: 'Santoku + petty',
        steel: 'Harder stainless-clad main knife and simple stainless petty.',
        length: '165-180mm main knife; 120-150mm petty',
        why: 'This covers compact board work and off-board tasks while giving you two edge lengths to maintain.',
        maintenance: ['Use 1000 grit for both knives, then 3000 grit on the santoku if wanted.', 'Use a strop and check the burr under bright light.', 'Flatten stones regularly.', 'Keep each knife in its own guard or slot.'],
        productQueries: ['Santoku knife shortlist', '120-150mm petty knife shortlist', 'King 1000/6000 combination whetstone', 'Leather strop or deburring block', 'Flattening plate or lapping stone'],
        articleIds: ['santoku-profile-guide', 'petty-paring-utility-profile-guide', 'sharpening-basics-burr-angle-pressure', 'stropping-and-deburring-clean-apex']
      }
    },
    edge: {
      low: {
        title: 'Keep the knife; buy a basic edge-care kit first',
        profile: 'Maintenance before replacement',
        steel: 'Works for most stainless household knives.',
        length: 'Any normal kitchen knife',
        why: 'A dull decent knife is usually a better fix than another cheap knife.',
        maintenance: ['Start with a 1000 grit stone, not a full stone collection.', 'Add a strop or deburring block to finish the edge cleanly.', 'Use a honing rod only for soft Western stainless that responds to realignment.', 'Improve the board and storage before judging edge retention.'],
        productQueries: ['Shapton Kuromaku 1000 whetstone', 'Leather strop or deburring block', 'Fine ceramic or steel honing rod', 'Hasegawa soft cutting board', 'Universal blade guards'],
        articleIds: ['sharpening-basics-burr-angle-pressure', 'honing-vs-sharpening-when-to-use-steel', 'stropping-and-deburring-clean-apex', 'knife-maintenance-daily-routine']
      },
      normal: {
        title: '1000/3000 stone, strop and board reset',
        profile: 'Sharpening setup',
        steel: 'Suitable for common stainless and many Japanese stainless knives.',
        length: 'Any kitchen prep knife',
        why: 'The stone does the work; the strop and board stop the edge from feeling ragged immediately after.',
        maintenance: ['Use 1000 grit for repair and 3000 grit for refinement.', 'Deburr with alternating light strokes before stropping.', 'Use a flattening plate when the stone stops feeling flat.', 'Use a kinder board and safe storage after sharpening.'],
        productQueries: ['King 1000/6000 combination whetstone', 'Leather strop or deburring block', 'Flattening plate or lapping stone', 'Hasegawa soft cutting board', 'Universal blade guards'],
        articleIds: ['king-vs-shapton-starter-stones-guide', 'stropping-and-deburring-clean-apex', 'hasegawa-asahi-hinoki-cutting-board-guide', 'knife-maintenance-daily-routine']
      },
      nerd: {
        title: 'Full basic sharpening bench',
        profile: 'Stone progression',
        steel: 'Any knife you are willing to practice on carefully.',
        length: 'Start with a cheap stainless knife before expensive blades',
        why: 'A repeatable burr, flat stone and clean deburr matter more than owning exotic abrasives.',
        maintenance: ['Use a 1000 grit stone until burr control is reliable.', 'Add 3000-6000 grit for refinement after the edge is already sharp.', 'Flatten with a lapping plate.', 'Strop lightly; heavy stropping can round the apex.'],
        productQueries: ['Shapton Kuromaku 1000 whetstone', 'King 1000/6000 combination whetstone', 'Flattening plate or lapping stone', 'Leather strop or deburring block', 'Fine ceramic or steel honing rod'],
        articleIds: ['sharpening-basics-burr-angle-pressure', 'king-vs-shapton-starter-stones-guide', 'shapton-stones-review-brief', 'honing-vs-sharpening-when-to-use-steel']
      }
    }
  };

  const tuneFinderRecommendation = (state) => {
    const byTask = finderBase[state.task] || finderBase.first;
    const base = byTask[state.care] || byTask.low;
    const articleIds = [...base.articleIds];
    if (state.intent === 'buy') articleIds.unshift('amazon-chef-knife-shortlist-what-to-buy-first');
    if (state.intent === 'maintain') articleIds.unshift('knife-maintenance-daily-routine', 'boards-storage-and-edge-life');
    if (state.intent === 'learn') articleIds.unshift(state.task === 'veg' ? 'nakiri-profile-guide' : state.task === 'compact' ? 'santoku-profile-guide' : state.task === 'edge' ? 'sharpening-basics-burr-angle-pressure' : 'start-here-main-kitchen-knife-profiles');
    return { ...base, articleIds: Array.from(new Set(articleIds)).slice(0, 4) };
  };

  const productIndex = (posts) => {
    const items = [];
    posts.forEach((post) => {
      (post.products || []).forEach((product) => {
        items.push({ ...product, postId: post.id, postTitle: post.title, searchText: [product.name, product.note, product.category, post.title, post.id].join(' ').toLowerCase() });
      });
    });
    return items;
  };

  const pickFinderProducts = (posts, queries = []) => {
    const items = productIndex(posts);
    const picked = [];
    const seen = new Set();
    queries.forEach((query) => {
      const words = String(query).toLowerCase().split(/\s+/).filter((word) => word.length > 2);
      const exact = items.find((item) => item.name.toLowerCase() === String(query).toLowerCase());
      const fuzzy = exact || items.find((item) => words.every((word) => item.searchText.includes(word))) || items.find((item) => words.some((word) => item.searchText.includes(word)));
      if (!fuzzy) return;
      const key = `${fuzzy.name}|${fuzzy.merchant}`;
      if (seen.has(key)) return;
      seen.add(key);
      picked.push(fuzzy);
    });
    return picked.slice(0, 5);
  };

  const initFinder = (posts) => {
    const panel = qs('[data-finder]');
    const result = qs('#finder-result');
    if (!panel || !result) return;
    const savedState = safeJsonRead(STORE_KEYS.finder, null);
    const state = Object.assign({ task: 'first', care: 'low', intent: 'learn' }, savedState || {});

    const syncButtons = () => {
      qsa('[data-choice]', panel).forEach((button) => {
        const active = state[button.dataset.choice] === button.dataset.value;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    const draw = () => {
      const rec = tuneFinderRecommendation(state);
      const picks = rec.articleIds.map((id) => posts.find((post) => post.id === id)).filter(Boolean);
      const products = pickFinderProducts(posts, rec.productQueries);
      result.innerHTML = `
        <div class="result-label">Recommended setup</div>
        <h3>${escapeHtml(rec.title)}</h3>
        <p class="section-note">${escapeHtml(rec.why)}</p>
        <div class="finder-spec-grid" aria-label="Recommended knife details">
          <div><span>Profile</span><strong>${escapeHtml(rec.profile)}</strong></div>
          <div><span>Steel direction</span><strong>${escapeHtml(rec.steel)}</strong></div>
          <div><span>Length</span><strong>${escapeHtml(rec.length)}</strong></div>
        </div>
        <div class="finder-maintenance">
          <h4>Maintenance kit for this pick</h4>
          <ul>${rec.maintenance.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </div>
        ${products.length ? `<div class="finder-products" aria-label="Relevant affiliate links">
          ${products.map((product) => `<a href="${escapeHtml(product.url || '#')}" target="_blank" rel="sponsored nofollow noopener"><span>${escapeHtml(product.category || 'Kit')}</span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.merchant || 'Retailer')} - paid link</small></a>`).join('')}
        </div>` : ''}
        <div class="result-label secondary-label">Read next</div>
        <div class="result-links">
          ${picks.map((post, index) => `<a href="${postUrl(post)}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(post.title)}</strong></a>`).join('')}
        </div>`;
      safeJsonWrite(STORE_KEYS.finder, state);
    };

    panel.addEventListener('click', (event) => {
      const button = event.target.closest('[data-choice]');
      if (!button) return;
      state[button.dataset.choice] = button.dataset.value;
      syncButtons();
      draw();
    });

    syncButtons();
    draw();
  };

  const renderHome = async () => {
    const posts = await loadPosts();
    const featured = posts.find((post) => post.featured) || posts[0];
    const currentTitle = qs('#current-test-title');
    if (currentTitle && featured) currentTitle.textContent = featured.title;
    const countPill = qs('#post-count-pill');
    if (countPill) countPill.textContent = `${posts.length} notes`;
    renderFeatured(featured);
    renderPhotoWall(posts);
    initFinder(posts);

    const grid = qs('#post-grid');
    const search = qs('#post-search');
    const stats = qs('#journal-stats');
    const filters = qsa('[data-filter]');
    const sorters = qsa('[data-sort]');
    if (!grid) return;

    let activeFilter = 'all';
    let activeQuery = '';
    let sortMode = 'curated';

    const draw = () => {
      const query = activeQuery.trim().toLowerCase();
      const base = sortedPosts(posts, sortMode);
      const visible = base.filter((post) => matchesFilter(post, activeFilter) && (!query || postTone(post).includes(query)));
      grid.innerHTML = visible.length ? visible.map(renderPostCard).join('') : '<div class="empty-state">No notes match that filter yet.</div>';
      if (stats) stats.textContent = `${visible.length} of ${posts.length} notes shown`;
      syncSavedControls();
      requestAnimationFrame(initReveal);
    };

    filters.forEach((button) => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.filter || 'all';
        filters.forEach((item) => item.classList.toggle('active', item === button));
        draw();
      });
    });

    sorters.forEach((button) => {
      button.addEventListener('click', () => {
        sortMode = button.dataset.sort || 'curated';
        sorters.forEach((item) => item.classList.toggle('active', item === button));
        draw();
      });
    });

    qsa('[data-quick-filter]').forEach((link) => {
      link.addEventListener('click', () => {
        const targetFilter = link.dataset.quickFilter;
        const button = filters.find((item) => item.dataset.filter === targetFilter);
        if (button) button.click();
      });
    });

    if (search) {
      search.addEventListener('input', () => {
        activeQuery = search.value;
        draw();
      });
    }

    draw();
  };

  const productClass = (product, post) => {
    const tone = [product.name, product.note, product.category, post.title, post.id, post.category, post.type].join(' ').toLowerCase();
    if (tone.includes('stone') || tone.includes('strop') || tone.includes('honing') || tone.includes('sharpen')) return 'sharpening';
    if (tone.includes('board') || tone.includes('storage') || tone.includes('guard') || tone.includes('oil') || tone.includes('care') || tone.includes('maintenance')) return 'care';
    return 'knife';
  };

  const renderKit = async () => {
    const target = qs('#kit-grid');
    if (!target) return;
    const stats = qs('#kit-stats');
    const search = qs('#kit-search');
    const filters = qsa('[data-kit-filter]');
    const posts = await loadPosts();
    const products = [];
    const seen = new Set();

    posts.forEach((post) => {
      (post.products || []).forEach((product) => {
        const key = `${product.name}|${product.merchant}`;
        if (seen.has(key)) return;
        seen.add(key);
        products.push({ ...product, postTitle: post.title, postId: post.id, className: productClass(product, post), postTone: postTone(post) });
      });
    });

    let activeFilter = 'all';
    let activeQuery = '';

    const draw = () => {
      const query = activeQuery.trim().toLowerCase();
      const visible = products.filter((product) => {
        const text = [product.name, product.note, product.merchant, product.postTitle, product.className, product.postTone].join(' ').toLowerCase();
        const filterMatch = activeFilter === 'all' || product.className === activeFilter;
        return filterMatch && (!query || text.includes(query));
      });

      target.innerHTML = visible.length ? visible.map((product) => `
        <article class="kit-card" data-category="${escapeHtml(product.className)}">
          <div>
            <div class="product-merchant">${escapeHtml(product.merchant || 'Retailer')}<span class="paid-label">paid link</span></div>
            <h2>${escapeHtml(product.name || 'Product')}</h2>
            <p>${escapeHtml(product.note || 'Check current retailer details before buying.')}</p>
          </div>
          <div class="kit-card-footer">
            <span class="meta-pill">${escapeHtml(product.className)}</span>
            <span class="meta-pill">Mentioned in: ${escapeHtml(product.postTitle || 'Review')}</span>
            <a class="read-link" href="post.html?id=${encodeURIComponent(product.postId)}">Read context</a>
            <a class="button secondary" href="${escapeHtml(product.url || '#')}" target="_blank" rel="sponsored nofollow noopener">${escapeHtml(product.cta || 'Check current price')}</a>
          </div>
        </article>
      `).join('') : '<div class="empty-state">No kit links match that filter yet.</div>';
      if (stats) stats.textContent = `${visible.length} of ${products.length} links shown`;
    };

    filters.forEach((button) => {
      button.addEventListener('click', () => {
        activeFilter = button.dataset.kitFilter || 'all';
        filters.forEach((item) => item.classList.toggle('active', item === button));
        draw();
      });
    });

    if (search) search.addEventListener('input', () => {
      activeQuery = search.value;
      draw();
    });

    draw();
  };

  const initTheme = () => {
    setTheme(getTheme());
    const toggle = qs('[data-theme-toggle]');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  };

  const initGlobalSearch = () => {
    if (qs('[data-search-dialog]')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'search-dialog';
    wrapper.setAttribute('data-search-dialog', '');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.innerHTML = `
      <div class="search-backdrop" data-search-close></div>
      <section class="search-modal" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
        <div class="search-modal-head">
          <div>
            <p class="eyebrow">Command search</p>
            <h2 id="global-search-title">Find a knife note</h2>
          </div>
          <button class="icon-button" type="button" data-search-close aria-label="Close search">Close</button>
        </div>
        <label class="global-search-input">
          <span class="visually-hidden">Search the site</span>
          <input type="search" data-global-search-input placeholder="Try gyuto, burr, Wusthof, storage..." autocomplete="off">
        </label>
        <div class="search-results" data-search-results aria-live="polite"></div>
      </section>`;
    document.body.append(wrapper);

    const dialog = wrapper;
    const input = qs('[data-global-search-input]', dialog);
    const results = qs('[data-search-results]', dialog);
    let cachedPosts = null;

    const open = async () => {
      dialog.classList.add('is-open');
      dialog.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      cachedPosts = cachedPosts || await loadPosts();
      renderResults(cachedPosts, input.value);
      setTimeout(() => input.focus(), 20);
    };

    const close = () => {
      dialog.classList.remove('is-open');
      dialog.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    };

    const renderResults = (posts, query) => {
      const q = String(query || '').trim().toLowerCase();
      const visible = (q ? posts.filter((post) => postTone(post).includes(q)) : posts).slice(0, 8);
      results.innerHTML = visible.length ? visible.map((post) => `
        <a class="search-result" href="${postUrl(post)}">
          <img src="${escapeHtml(post.heroImage || 'assets/img/hero-gyuto.svg')}" alt="" loading="lazy">
          <span><strong>${escapeHtml(post.title)}</strong><small>${escapeHtml(post.bestFor || classifyPost(post))} - ${escapeHtml(post.readTime || '')}</small></span>
        </a>`).join('') : '<div class="empty-state">No notes found. Try a broader knife, steel, or maintenance term.</div>';
    };

    qsa('[data-search-open]').forEach((button) => button.addEventListener('click', open));
    qsa('[data-search-close]', dialog).forEach((button) => button.addEventListener('click', close));
    input.addEventListener('input', () => cachedPosts && renderResults(cachedPosts, input.value));
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        open().catch(() => {});
      }
      if (event.key === 'Escape' && dialog.classList.contains('is-open')) close();
    });
  };

  const initSavedDelegation = () => {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-save-post]');
      if (!button) return;
      event.preventDefault();
      toggleSaved(button.getAttribute('data-save-post'));
      if (document.body.dataset.page === 'home') {
        const activeSaved = qs('[data-filter="saved"].active');
        if (activeSaved) activeSaved.click();
      }
    });
  };

  const initReveal = () => {
    const items = qsa('.reveal-on-scroll:not(.is-visible)');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    items.forEach((item) => observer.observe(item));
  };

  window.AC = {
    qs,
    qsa,
    escapeHtml,
    formatDate,
    loadPosts,
    renderPostCard,
    renderProductCards,
    metaLine,
    postUrl,
    postTone,
    classifyPost,
    isSaved,
    toggleSaved,
    syncSavedControls,
    initReveal,
    initFinder
  };

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initGlobalSearch();
    initSavedDelegation();
    initReveal();
    const page = document.body.dataset.page;
    if (page === 'home') {
      renderHome().catch((error) => {
        const grid = qs('#post-grid');
        if (grid) grid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      });
    }
    if (page === 'kit') {
      renderKit().catch((error) => {
        const grid = qs('#kit-grid');
        if (grid) grid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      });
    }
  });
})();
