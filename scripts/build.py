#!/usr/bin/env python3
from pathlib import Path
import json, re, html, shutil, datetime
from urllib.parse import quote
import yaml

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = 'https://adrichops.pages.dev'
NAV = [
    ('/about/', 'About'),
    ('/maker-map/', 'Maker map'),
    ('/blog/', 'Blog'),
    ('/disclosure/', 'Disclosure'),
    ('/tool-finder/', 'Tool Finder'),
]

def slugify(value):
    value = str(value).lower().strip()
    value = re.sub(r'[“”"\']', '', value)
    value = re.sub(r'[^a-z0-9]+', '-', value)
    return value.strip('-') or 'note'

def parse_md(path):
    text = path.read_text(encoding='utf-8')
    if not text.startswith('---'):
        raise ValueError(f'{path} missing YAML frontmatter')
    _, fm, body = text.split('---', 2)
    data = yaml.safe_load(fm) or {}
    data['bodyMarkdown'] = body.strip()
    if 'id' not in data:
        data['id'] = slugify(data.get('title', path.stem))
    data['slug'] = data.get('slug') or data['id']
    data['legacyRoute'] = data.get('route') or legacy_route_for(data)
    data['route'] = route_for(data)
    data['body'] = markdown_to_sections(data['bodyMarkdown'])
    return data

def markdown_to_sections(md):
    sections = []
    current = None
    buffer = []
    def flush():
        nonlocal buffer, current
        if current is not None:
            paragraphs = []
            para = []
            for line in buffer:
                if line.strip() == '':
                    if para:
                        paragraphs.append(' '.join(para).strip())
                        para = []
                else:
                    para.append(line.strip())
            if para:
                paragraphs.append(' '.join(para).strip())
            current['paragraphs'] = paragraphs
            sections.append(current)
        buffer = []
    for line in md.splitlines():
        if line.startswith('## '):
            flush()
            current = {'heading': line[3:].strip(), 'paragraphs': []}
        else:
            buffer.append(line)
    flush()
    if not sections and md.strip():
        sections.append({'heading':'Note', 'paragraphs':[p.strip() for p in md.split('\n\n') if p.strip()]})
    return sections

def route_for(post):
    return f"/blog/{post['id']}/"

def legacy_route_for(post):
    if post.get('type') == 'Maker spotlight':
        return f"/maker-spotlight/{post['id']}/"
    if post.get('type') == 'Review brief':
        return f"/reviews/{post['id']}/"
    return f"/guides/{post['id']}/"

def load_posts():
    posts = []
    image_db_path = ROOT / 'data' / 'post-images.json'
    image_db = {}
    if image_db_path.exists():
        image_db = (json.loads(image_db_path.read_text(encoding='utf-8')).get('posts') or {})
    for folder in ['content/reviews','content/makers','content/guides','content/recommendations']:
        for path in sorted((ROOT / folder).glob('*.md')):
            post = parse_md(path)
            if post.get('id') in image_db:
                image_meta = image_db[post['id']]
                post.update({k: v for k, v in image_meta.items() if v is not None})
                if 'gallery' not in image_meta and all(str((item or {}).get('src') or (item or {}).get('image') or '').startswith('assets/img/') for item in (post.get('gallery') or [])):
                    post['gallery'] = []
            posts.append(post)
    posts.sort(key=lambda p: (p.get('date',''), p.get('title','')), reverse=True)
    return posts

def load_maker_graph():
    path = ROOT / 'data' / 'maker-graph.json'
    if not path.exists():
        return {'regions': [], 'sources': []}
    return json.loads(path.read_text(encoding='utf-8'))

def load_shops():
    path = ROOT / 'data' / 'recommended-shops.json'
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding='utf-8')).get('shops', [])

def esc(s):
    return html.escape(str(s or ''), quote=True)

def text_only(md):
    return re.sub(r'[#*`>\-]+',' ', str(md or '')).strip()

def site_path(path):
    path = str(path or '')
    if path.startswith(('http://', 'https://')):
        return path
    return '/' + path.lstrip('/')

def absolute_image(path):
    path = str(path or '/assets/img/hero-gyuto.svg')
    if path.startswith(('http://', 'https://')):
        return path
    return BASE_URL.rstrip('/') + '/' + path.lstrip('/')

def image_credit_html(item):
    caption = item.get('caption') or item.get('imageCaption') or ''
    credit = item.get('credit') or item.get('imageCredit') or ''
    credit_url = item.get('creditUrl') or item.get('imageCreditUrl') or ''
    parts = []
    if caption:
        parts.append(esc(caption))
    if credit:
        credit_text = f'Image: {credit}'
        if credit_url:
            parts.append(f'<a href="{esc(credit_url)}" target="_blank" rel="noopener">{esc(credit_text)}</a>')
        else:
            parts.append(esc(credit_text))
    return f'<figcaption>{" · ".join(parts)}</figcaption>' if parts else ''

def head(title, desc, route='/', image='/assets/img/hero-gyuto.svg', schema=None):
    canonical = BASE_URL.rstrip('/') + route
    schema_tag = f'<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>' if schema else ''
    return f'''<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:image" content="{esc(absolute_image(image))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="icon" href="/assets/brand/favicon-dark.png" type="image/png" data-theme-favicon>
<link rel="apple-touch-icon" href="/assets/brand/favicon-dark.png">
<link rel="stylesheet" href="/assets/css/site.css">
<link rel="stylesheet" href="/assets/css/refinement.css">
{schema_tag}
</head>
<body>'''

def header(current=''):
    nav = ''.join(f'<a href="{href}" {"aria-current=" + chr(34) + "page" + chr(34) if current==label else ""}>{esc(label)}</a>' for href,label in NAV)
    return f'''<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="/" aria-label="Adrichops home"><img class="brand-logo" src="/assets/brand/logo-dark.png" alt="Adrichops" width="960" height="97" data-brand-logo data-logo-dark="/assets/brand/logo-dark.png" data-logo-light="/assets/brand/logo-light.png"></a>
    <nav class="nav-tabs" id="primary-navigation" data-nav-menu aria-label="Primary navigation">{nav}</nav>
    <div class="header-actions">
      <button class="icon-button menu-button" type="button" data-nav-toggle aria-label="Open navigation menu" aria-expanded="false" aria-controls="primary-navigation"><span aria-hidden="true"></span></button>
      <button class="icon-button" type="button" data-search-open aria-label="Search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      <button class="icon-button" type="button" data-theme-toggle aria-label="Toggle light or dark theme"></button>
    </div>
  </div>
</header>'''

def footer():
    year = datetime.date.today().year
    links = ''.join(f'<a href="{href}">{esc(label)}</a>' for href,label in NAV)
    return f'''<div class="search-dialog" data-search-dialog aria-hidden="true"><div class="search-panel" role="dialog" aria-label="Search Adrichops"><header><input data-search-input type="search" placeholder="Search maker, nakiri, cleaver, cai dao, VG10…"><button class="icon-button" type="button" data-search-close aria-label="Close search">×</button></header><div class="search-results" data-search-results></div></div></div>
<section class="site-engagement" aria-label="Feedback and newsletter">
  <div class="engagement-inner">
    <form class="engagement-card feedback-form" data-feedback-form action="/api/feedback" method="post">
      <div><span class="kicker">Feedback</span><h2>Was this useful?</h2></div>
      <fieldset class="csat-scale" aria-label="How satisfied were you with this content?">
        <legend>How satisfied were you with this content?</legend>
        <label><input type="radio" name="score" value="1" required><span>1</span></label>
        <label><input type="radio" name="score" value="2"><span>2</span></label>
        <label><input type="radio" name="score" value="3"><span>3</span></label>
        <label><input type="radio" name="score" value="4"><span>4</span></label>
        <label><input type="radio" name="score" value="5"><span>5</span></label>
      </fieldset>
      <label class="field-label">Your note<textarea name="comment" rows="4" maxlength="1200" placeholder="What should I keep, fix or explain better?"></textarea></label>
      <input type="hidden" name="page_url" data-current-url>
      <input type="hidden" name="pathname" data-current-path>
      <label class="bot-field" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
      <div class="form-row"><button class="button primary" type="submit">Send feedback</button><p class="form-status" data-form-status aria-live="polite"></p></div>
    </form>
    <form class="engagement-card newsletter-form" data-newsletter-form action="/api/newsletter" method="post">
      <div><span class="kicker">Newsletter</span><h2>Get new notes.</h2><p>Occasional reviews, maker updates and practical knife notes.</p></div>
      <label class="field-label">Email address<input type="email" name="email" autocomplete="email" required placeholder="you@example.com"></label>
      <input type="hidden" name="page_url" data-current-url>
      <input type="hidden" name="pathname" data-current-path>
      <label class="bot-field" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
      <div class="form-row"><button class="button primary" type="submit">Sign up</button><p class="form-status" data-form-status aria-live="polite"></p></div>
    </form>
  </div>
</section>
<footer class="footer"><div class="footer-inner"><p>© {year} Adrichops. Personal knife notes, source trails and disclosed affiliate links.</p><nav class="footer-links">{links}</nav></div></footer>
<script src="/assets/js/main.js" defer></script>
</body></html>'''

def write(path, content):
    path = ROOT / path.lstrip('/')
    if path.suffix == '':
        path = path / 'index.html'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')

def remove_public_path(path):
    path = ROOT / path.lstrip('/')
    if path.suffix == '':
        path = path / 'index.html'
    if path.exists():
        path.unlink()
    try:
        path.parent.rmdir()
    except OSError:
        pass

def article_summary_list(posts, n=None):
    rows = []
    for p in (posts[:n] if n else posts):
        status_class = 'owned' if str(p.get('status','')).startswith('Owned') else ''
        rows.append(f'''<a class="note-row" href="{p['route']}" data-filter-item data-filter-text="{esc(' '.join([p.get('title',''), p.get('summary',''), p.get('type',''), p.get('category',''), p.get('maker',''), p.get('steel','')]))}">
  <div><span class="eyebrow">{esc(p.get('type','Note'))}</span><div class="note-title">{esc(p.get('title'))}</div><div class="note-summary">{esc(p.get('summary') or p.get('deck'))}</div></div>
  <span class="note-meta">{esc(p.get('readTime',''))}</span>
  <span class="status-pill {status_class}">{esc(p.get('status',''))}</span>
  <span class="note-meta">{esc(p.get('category',''))}</span>
</a>''')
    return '<div class="notebook">' + ''.join(rows) + '</div>'

def cards(posts):
    out = []
    for p in posts:
        credit = p.get('imageCredit') or ''
        credit_url = p.get('imageCreditUrl') or ''
        credit_html = f'<div class="card-credit">Image: <a href="{esc(credit_url)}" target="_blank" rel="noopener">{esc(credit)}</a></div>' if credit and credit_url else ''
        out.append(f'''<article class="article-card"><a href="{p['route']}"><img loading="lazy" src="{esc(site_path(p.get('heroImage','assets/img/hero-gyuto.svg')))}" alt="{esc(p.get('heroAlt','Article image'))}"></a>{credit_html}<a class="article-card-body" href="{p['route']}"><span class="eyebrow">{esc(p.get('type','Note'))} · {esc(p.get('readTime',''))}</span><h3>{esc(p.get('title'))}</h3><p>{esc(p.get('summary') or p.get('deck'))}</p><span class="status-pill">{esc(p.get('status',''))}</span></a></article>''')
    return '<div class="article-card-grid">' + ''.join(out) + '</div>'

def shop_cards(shops):
    rows = []
    for shop in shops:
        tags = ''.join(f'<span>{esc(tag)}</span>' for tag in shop.get('tags') or [])
        rows.append(f'''<a class="shop-card" href="{esc(shop.get('url','#'))}" target="_blank" rel="noopener">
  <img src="{esc(site_path(shop.get('image','assets/img/shop-default.svg')))}" alt="{esc(shop.get('imageAlt') or shop.get('name') or 'Recommended shop')}">
  <div class="shop-card-body"><span class="eyebrow">{esc(shop.get('location','Shop'))}</span><h3>{esc(shop.get('name'))}</h3><p>{esc(shop.get('blurb'))}</p><div class="tag-row">{tags}</div></div>
</a>''')
    return '<div class="shop-grid">' + ''.join(rows) + '</div>'

def finder_markup():
    data = json.loads((ROOT / 'data/finder.json').read_text(encoding='utf-8'))
    groups = []
    defaults = {'task':'all-purpose','priority':'value'}
    for q in data['questions']:
        opts = []
        for opt in q['options']:
            checked = 'checked' if defaults.get(q['id']) == opt['value'] else ''
            opts.append(f'<label class="finder-option"><input type="radio" name="{esc(q["id"])}" value="{esc(opt["value"])}" {checked}> <span>{esc(opt["label"])}</span></label>')
        groups.append(f'<fieldset class="finder-group"><legend>{esc(q["label"])}</legend><div class="finder-options">{"".join(opts)}</div></fieldset>')
    return f'''<section class="finder" data-finder>
  <div class="finder-grid"><form class="finder-form">{''.join(groups)}<button class="button primary finder-submit" type="submit">Find my tool</button></form><div class="finder-result" data-finder-result tabindex="-1"><p>Loading recommendations...</p></div></div>
</section><script src="/assets/js/finder.js" defer></script>'''

def home(posts, shops):
    by_id = {p['id']: p for p in posts}
    first = [by_id[key] for key in ['first-kitchen-kit', 'who-made-your-japanese-knife', 'king-vs-shapton-starter-stones-guide'] if key in by_id]
    return head('Adrichops - Kitchen knives, makers and learning to sharpen', 'Practical tools for your kitchen, the people who make them, and notes for getting started.', '/') + header('') + f'''<main class="page home-simple">
<section class="collection-hero"><span class="kicker">My kitchen notebook</span><h1>Adrichops</h1><p>Good tools. The people behind them. What I learn along the way.</p></section>
<section class="home-paths" aria-label="Explore Adrichops"><a href="/maker-map/"><span class="kicker">Meet the makers</span><h2>Who made your knife?</h2><p>Explore the blacksmiths, sharpeners and workshops behind Japanese kitchen knives.</p><span class="text-link">Explore the maker map →</span></a><a href="/tool-finder/"><span class="kicker">Start cooking</span><h2>A useful first kit.</h2><p>Victorinox and Tojiro knives. Shapton and King stones. A recommendation for the job you actually do.</p><span class="text-link">Open Tool Finder →</span></a></section>
<section class="section"><div class="section-head"><h2>New to kitchen knives?</h2><a class="text-link" href="/blog/">All articles</a></div>{cards(first)}</section>
<section class="home-about"><h2>I'm Adrian.</h2><p>I spent a couple of years as a line cook. My Tojiro DP stayed with me, and learning about sharpening and makers became a lasting interest. This is where I share that learning, with personal experience and research clearly labelled.</p><a class="text-link" href="/about/">About me →</a></section>
</main>''' + footer()
def collection_page(title, desc, current, posts, route, intro='', grid=False):
    content = cards(posts) if grid else f'<div class="database-toolbar"><input class="search-input" type="search" placeholder="Filter this page…" data-filter-input="collection"></div><div data-filter-group="collection">{article_summary_list(posts)}</div>'
    return head(f'{title} — Adrichops', desc, route) + header(current) + f'''<main class="page"><section class="collection-hero"><span class="kicker">Adrichops</span><h1>{esc(title)}</h1><p>{esc(intro or desc)}</p></section>{content}</main>''' + footer()

def maker_spotlight_page(posts, graph):
    regions = graph.get('regions') or []
    sources = {source.get('id'): source for source in graph.get('sources') or []}
    nodes = [(region, node) for region in regions for node in region.get('nodes') or []]
    edges = [(region, edge) for region in regions for edge in region.get('edges') or [] if edge.get('kind') not in ['region-member', 'regional-hub']]
    role_counts = {
        'Blacksmiths': sum(1 for _, node in nodes if 'blacksmith' in str(node.get('role','')).lower()),
        'Sharpeners / polishers': sum(1 for _, node in nodes if any(token in str(node.get('role','')).lower() for token in ['sharpener', 'polisher'])),
        'Brands / retailers': sum(1 for _, node in nodes if any(token in str(node.get('role','')).lower() for token in ['brand', 'retailer', 'supplier'])),
        'Workshops': sum(1 for _, node in nodes if any(token in str(node.get('role','')).lower() for token in ['workshop', 'cooperative']))
    }
    stat_html = ''.join(f'<div class="entry-card"><span class="eyebrow">Database</span><strong>{count}</strong><p>{esc(label)}</p></div>' for label, count in [
        ('regions mapped', len(regions)),
        ('maker, workshop and brand nodes', len(nodes)),
        ('relationship edges', len(edges)),
        ('source links', len(sources))
    ])
    role_html = ''.join(f'<div class="entry-card"><span class="eyebrow">Role</span><strong>{count}</strong><p>{esc(label)}</p></div>' for label, count in role_counts.items())
    focus_ids = ['sakai','sanjo','echizen','tosa-kochi','tokyo','nagano','mie','seki-gifu','okayama','shimane','nagasaki','kumamoto']
    region_by_id = {region.get('id'): region for region in regions}
    region_cards = []
    for region in [region_by_id[key] for key in focus_ids if key in region_by_id]:
        sample = ', '.join(node.get('name','') for node in (region.get('nodes') or [])[:5])
        source_labels = ', '.join(sources.get(source_id, {}).get('label', source_id) for source_id in (region.get('sourceIds') or [])[:2])
        region_cards.append(f'''<a class="entry-card" href="/maker-map/"><span class="eyebrow">{esc(region.get('location',''))}</span><strong>{esc(region.get('name',''))}</strong><p>{esc(region.get('summary',''))}</p><p><b>Includes:</b> {esc(sample or 'Source trail pending')}</p>{f'<p><b>Sources:</b> {esc(source_labels)}</p>' if source_labels else ''}</a>''')
    relationship_cards = []
    for region, edge in edges[:14]:
        source_labels = ', '.join(sources.get(source_id, {}).get('label', source_id) for source_id in (edge.get('sourceIds') or [])[:2])
        relationship_cards.append(f'''<a class="entry-card" href="/maker-map/"><span class="eyebrow">{esc(region.get('name',''))} · {esc(edge.get('kind','relationship'))}</span><strong>{esc(edge.get('label') or 'Relationship trail')}</strong><p>{esc(edge.get('detail') or 'Relationship context pending.')}</p>{f'<p><b>Sources:</b> {esc(source_labels)}</p>' if source_labels else ''}</a>''')
    hitohira_nodes = [(region, node) for region, node in nodes if any(str(source_id).startswith('hitohira') for source_id in node.get('sourceIds') or [])][:12]
    hitohira_html = ''.join(f'''<a class="entry-card" href="/maker-map/"><span class="eyebrow">{esc(region.get('name',''))} · {esc(node.get('role',''))}</span><strong>{esc(node.get('name',''))}</strong><p>{esc(node.get('specialty',''))}</p><p><b>Known lines:</b> {esc(', '.join((node.get('famousLines') or [])[:3]) or 'Line trail pending')}</p></a>''' for region, node in hitohira_nodes)
    source_ids = ['hitohira-brands', 'hitohira-about', 'hitohira-morihei', 'hitohira-jiro', 'hitohira-jiro-bbq', 'hitohira-moki', 'knifejapan-brand-list', 'kkf-community']
    source_html = ''.join(f'<a class="entry-card" href="{esc(sources[source_id]["url"])}" target="_blank" rel="noopener"><span class="eyebrow">Source</span><strong>{esc(sources[source_id]["label"])}</strong><p>{esc(sources[source_id]["url"])}</p></a>' for source_id in source_ids if source_id in sources)
    return head('Maker spotlight — Adrichops', 'Source-led maker, workshop, sharpener and brand context generated from the Adrichops maker graph database.', '/maker-spotlight/') + header('Maker spotlight') + f'''<main class="page"><section class="collection-hero"><span class="kicker">Maker spotlight</span><h1>Makers, regions and source trails.</h1><p>The maker spotlight is now driven by the maker graph database: regions first, named people second, relationships third. It separates blacksmiths, sharpeners, polishers, handle makers, workshops, brands and retailers so the story does not flatten into one romantic stamp on a blade.</p></section><section class="section"><div class="section-head"><div><span class="kicker">Database shape</span><h2>What is mapped so far.</h2></div><p>These counts come from <code>data/maker-graph.json</code>, so this page grows as the graph grows.</p></div><div class="entry-grid">{stat_html}</div><div class="entry-grid">{role_html}</div></section><section class="section"><div class="section-head"><div><span class="kicker">Regions</span><h2>Read the map by place first.</h2></div><a class="button" href="/maker-map/">Open maker map</a></div><div class="entry-grid">{''.join(region_cards)}</div></section><section class="section"><div class="section-head"><div><span class="kicker">Relationships</span><h2>Useful trails to investigate.</h2></div><p>Edges are buying clues and research leads, not blanket guarantees for every listing under a name.</p></div><div class="entry-grid">{''.join(relationship_cards)}</div></section><section class="section"><div class="section-head"><div><span class="kicker">Hitohira trail</span><h2>New source-led additions.</h2></div><p>Hitohira adds brand, retailer and story context: Jiro, Morihei, Moki, Daitoku, Tadokoro, Takada, Tetsujin and related source trails.</p></div><div class="entry-grid">{hitohira_html}</div></section><section class="section"><div class="section-head"><div><span class="kicker">Long-form profiles</span><h2>Written spotlights.</h2></div><p>These are the deeper essays. The map database is broader and more current; the essays are where selected makers get full context.</p></div>{cards(posts)}</section><section class="section"><div class="section-head"><div><span class="kicker">Sources</span><h2>Reference trail.</h2></div></div><div class="entry-grid">{source_html}</div></section></main>''' + footer()

def about_page():
    return head('About — Adrichops', 'My line-cook origin story behind Adrichops: sharpening a chipped Shun, buying a Tojiro DP, visiting Japan and starting a personal knife notebook.', '/about/', '/assets/img/about-line-cook.svg') + header('About') + '''<main class="page"><section class="collection-hero"><span class="kicker">About</span><h1>Line cook first. Knife nerd after.</h1><p>Adrichops exists because practical cooking turned into my long-running curiosity about edges, steel, makers and the quiet pleasure of a tool that does exactly what it should.</p></section><section class="story-strip about-story-strip"><div class="story-card"><h2>About me</h2><p>I spent a couple of years as a line cook during college. It was not romantic. It was hot, repetitive, fast, occasionally chaotic, and exactly the kind of environment where a knife stops being an object and becomes a daily working tool.</p><p>That time lit the fuse. I remember learning how to sharpen the Damascus Kai Shun my manager had, mostly because the poor thing had chips that needed help. I watched YouTube instructionals, made mistakes, raised burrs badly, removed burrs worse, and slowly learned that sharpness is not magic. It is contact, pressure, patience and a little humility.</p><p>Then I bought my first Japanese knife: a Tojiro DP gyuto in VG10. I used it for the rest of my time as a line cook, then kept cooking with it afterwards while learning more about knife skills, sharpening, steel and why some tools feel alive on a board.</p><p>Last year I visited Japan, met makers and people connected to the craft, including Takada-san and the people at Baba Hamono. That trip made the interest sharper. Japanese knives are not only tools, and they are not only art objects. The best ones sit in the useful middle: functional art that earns its place by cutting food.</p><p>I want the reviews here to come from experience where I have it, and from clear source trails where I am still learning. This site is also a record of that learning: a place to keep sharing what I find as this passion keeps growing.</p><p>Adrichops is the place I built to explain that to friends without turning every dinner into a lecture.</p></div></section><section class="section"><div class="section-head"><div><span class="kicker">How the site works</span><h2>Source trail first. Hype second.</h2></div></div><div class="entry-grid"><div class="entry-card"><span class="eyebrow">Owned</span><strong>Personal experience is labelled.</strong><p>When I own or use a knife long term, the article says so.</p></div><div class="entry-card"><span class="eyebrow">Researched</span><strong>Review briefs are not fake tests.</strong><p>Amazon-accessible gear is treated as researched buying guidance unless marked otherwise.</p></div><div class="entry-card"><span class="eyebrow">Affiliate</span><strong>Links are disclosed.</strong><p>Referral links may earn commission. They do not change the stated caveats.</p></div></div></section></main>''' + footer()

def disclosure_page():
    return head('Disclosure — Adrichops', 'Affiliate disclosure, review integrity, source policy and correction policy for Adrichops.', '/disclosure/') + header('Disclosure') + '''<main class="page"><section class="collection-hero"><span class="kicker">Disclosure</span><h1>Affiliate links, source trails and review integrity.</h1><p>Adrichops may use affiliate links. My goal is to make recommendations useful without pretending every product has been personally tested.</p></section><article class="article-body"><h2>Amazon Associates statement</h2><p>As an Amazon Associate I earn from qualifying purchases.</p><h2>How links work</h2><p>Some product links may be affiliate links to Amazon or other retailers. If you buy through them, Adrichops may earn a commission at no extra cost to you.</p><h2>Status labels</h2><p><strong>Owned</strong> means I have personal long-term experience with the item. <strong>Research brief</strong> means the article is based on official specifications, retailer information and community consensus rather than a claimed hands-on test. <strong>Maker profile</strong> means the piece is about context, style and buying considerations, not a guarantee about every individual knife.</p><h2>Source policy</h2><p>Article pages include a source trail where useful. Official maker pages, specialist retailers, technical references, KKF-style discussion and Reddit-style community consensus can all inform a piece, but the writing remains original and claims are framed carefully.</p><h2>Corrections</h2><p>If a specification, maker attribution, steel, heat-treatment note or retailer detail changes, the article should be corrected. Knife information moves; the site should not pretend otherwise.</p></article></main>''' + footer()

def privacy_page():
    return head('Privacy — Adrichops', 'Privacy notes for Adrichops local storage, feedback, newsletter signup, saved notes, theme settings and affiliate links.', '/privacy/') + header('') + '''<main class="page"><section class="collection-hero"><span class="kicker">Privacy</span><h1>Small site, small data footprint.</h1><p>Adrichops uses local browser storage for theme choice, saved notes, Tool Finder state and Kit Builder selections. Feedback and newsletter forms are stored server-side so they can be read later.</p></section><article class="article-body"><h2>Local storage</h2><p>The theme toggle, saved articles, Tool Finder choices and Kit Builder deck may be stored in your browser. That data stays on your device.</p><h2>Feedback</h2><p>If you submit the feedback form, the site stores the satisfaction score, optional comment, page URL and browser user-agent. This is used to understand what content is useful and what needs correction.</p><h2>Newsletter</h2><p>If you sign up for the newsletter, the site stores your email address, signup page and signup time. You can ask to be removed when newsletter sending is added.</p><h2>Affiliate links</h2><p>External retailers may collect their own analytics or referral data after you leave Adrichops.</p><h2>Future analytics</h2><p>If analytics are added later, this page should be updated before launch.</p></article></main>''' + footer()

def kit_builder_page():
    return head('Kit Builder — Adrichops', 'Create a custom ten-slot knife kit deck with drag-and-drop cards for knives, stones, strops, boards, storage and utensils.', '/kit-builder/', '/assets/img/knife-roll.svg') + header('Kit Builder') + """<main class="page"><section class="collection-hero"><span class="kicker">Interactive kit builder</span><h1>Build your kit.</h1><p>Drag cards from the database into the ten-slot deck, then drag slotted cards around to rearrange the order. Cards carry practical attributes like edge length, steel or material, handle type and knife profile. The kit saves locally in your browser.</p></section><section class="kit-builder" data-kit-builder><aside class="kit-summary-panel"><div class="section-head"><div><span class="kicker">Your kit</span><h2>10-slot deck.</h2></div><p>Start with fewer knives than the internet wants, then add the support gear that keeps them sharp: stone, strop, board and storage. Drag cards directly between the database and the slots.</p></div><div class="kit-summary" data-kit-summary></div><div class="kit-status" data-kit-status></div><div class="kit-control-row"><button class="button primary" type="button" data-kit-starter>Load starter kit</button><button class="button" type="button" data-kit-clear>Clear kit</button><button class="button" type="button" data-kit-copy>Copy summary</button><button class="button" type="button" data-kit-export>Export JSON</button><button class="button" type="button" data-kit-story-export>Export Story PNG</button></div></aside><div class="kit-builder-board"><section class="kit-library-panel"><div class="section-head"><div><span class="kicker">Available cards</span><h2>Knife and kit database.</h2></div><p>Drag a card into any open slot, or click Add to use the active slot.</p></div><div class="kit-control-row"><input class="search-input" type="search" placeholder="Search knife, gyuto, VG10, Shapton…" data-kit-search><select data-kit-category aria-label="Filter by category"></select><select data-kit-profile aria-label="Filter by profile"></select><select data-kit-steel aria-label="Filter by steel"></select></div><div class="kit-library-grid" data-kit-library></div></section><section class="kit-slots-panel" data-kit-drop-zone><div class="section-head"><div><span class="kicker">Available slots</span><h2>Your deck.</h2></div><p>Drop cards anywhere on this deck. Filled slots can still be dragged onto another slot to reorder the kit.</p></div><p class="kit-drop-note">Desktop: drag and drop. Mobile fallback: select a slot, then tap Add on a card.</p><div class="kit-slots" data-kit-slots></div></section></div></section></main><script src="/assets/js/kit-builder.js" defer></script>""" + footer()

def blog_page(posts):
    by_id = {p['id']: p for p in posts}
    start = [by_id[key] for key in ['first-kitchen-kit', 'who-made-your-japanese-knife', 'king-vs-shapton-starter-stones-guide'] if key in by_id]
    return head('Blog - Adrichops', 'Beginner guides, maker stories and practical kitchen knife notes.', '/blog/') + header('Blog') + f'''<main class="page blog-page"><section class="collection-hero"><span class="kicker">The notebook</span><h1>Blog</h1><p>Start with your kitchen. Get curious about the craft.</p></section><section class="section beginner-reads"><div class="section-head"><h2>Start here</h2></div>{cards(start)}</section><section class="section"><div class="section-head"><h2>All articles</h2><span>{len(posts)} notes</span></div><div class="blog-controls"><label>Search articles<input type="search" class="search-input" data-blog-search placeholder="Try sharpening, Tojiro or Sakai"></label><label>Topic<select data-blog-topic><option value="all">All topics</option><option value="buying">Buying your first tools</option><option value="sharpening">Sharpening and care</option><option value="makers">Makers and craft</option></select></label></div><p data-blog-count role="status"></p><div data-blog-articles>{article_summary_list(posts)}</div></section></main><script src="/assets/js/blog.js" defer></script>''' + footer()
def recommendations_page(posts):
    return head('Tool Finder - Adrichops', 'Beginner recommendations for knives, sharpening stones, boards and storage, matched to your cooking needs.', '/tool-finder/') + header('Tool Finder') + f'''<main class="page tool-finder-page"><section class="collection-hero"><span class="kicker">A practical first kit</span><h1>Tool Finder</h1><p>What do you need help with? Start with a useful tool and add more only when you need it.</p></section>{finder_markup()}<p class="affiliate-note">As an Amazon Associate I earn from qualifying purchases. Amazon links search for the named model; check the seller and exact specification. <a href="/disclosure/">How I choose recommendations</a></p></main>''' + footer()
def shops_page(shops):
    return head('Recommended shops — Adrichops', 'Recommended knife shops and retailer source trails for Japanese kitchen knives, maintenance gear and maker research.', '/shops/', '/assets/img/shop-cleancut.svg') + header('Shops') + f'''<main class="page"><section class="collection-hero"><span class="kicker">Recommended shops</span><h1>Shops worth checking.</h1><p>This is a practical shortlist of retailers and source trails I want to keep close to the recommendations. Each card has space for a link, a short note, an image and tags so the page can grow without becoming another unstructured link dump.</p></section><section class="section"><div class="section-head"><div><span class="kicker">Retailers</span><h2>Start here.</h2></div><p>Exact stock changes quickly. Treat these as shop/source starting points, then check dimensions, steel, maker notes, return terms and shipping before buying.</p></div>{shop_cards(shops)}</section></main>''' + footer()

def maker_suggestion_dialog():
    return '''<div class="suggestion-dialog" data-maker-suggestion-dialog aria-hidden="true">
  <div class="suggestion-panel" role="dialog" aria-modal="true" aria-labelledby="maker-suggestion-title">
    <header>
      <div><span class="kicker">Maker map</span><h2 id="maker-suggestion-title">Suggest a change.</h2></div>
      <button class="icon-button" type="button" data-maker-suggestion-close aria-label="Close suggestion form">×</button>
    </header>
    <form class="maker-suggestion-form" data-maker-suggestion-form action="/api/maker-suggestions" method="post">
      <div class="form-grid two">
        <label class="field-label">Your email<input type="email" name="submitter_email" autocomplete="email" required placeholder="you@example.com"></label>
        <label class="field-label">Your name<input type="text" name="submitter_name" autocomplete="name" maxlength="120" placeholder="Optional"></label>
      </div>
      <div class="form-grid two">
        <label class="field-label">Change type<select name="request_type" required>
          <option value="add_node">Add maker / shop / line</option>
          <option value="edit_node">Edit existing node</option>
          <option value="add_relationship">Add relationship edge</option>
          <option value="edit_relationship">Edit relationship edge</option>
          <option value="source_correction">Source or attribution correction</option>
        </select></label>
        <label class="field-label">Region id<input type="text" name="region_id" maxlength="120" placeholder="sakai, sanjo, echizen..."></label>
      </div>
      <fieldset class="form-fieldset"><legend>Node fields</legend>
        <div class="form-grid two">
          <label class="field-label">Node id<input type="text" name="node_id" maxlength="160" placeholder="sakai-nakagawa-satoshi"></label>
          <label class="field-label">Display name<input type="text" name="node_name" maxlength="180" placeholder="Satoshi Nakagawa"></label>
          <label class="field-label">Role<select name="role">
            <option value="">Choose if relevant</option>
            <option>Blacksmith</option>
            <option>Sharpener</option>
            <option>Polisher</option>
            <option>Sharpener / polisher</option>
            <option>Handle maker</option>
            <option>Workshop</option>
            <option>Brand</option>
            <option>Line / brand</option>
            <option>Retailer</option>
          </select></label>
          <label class="field-label">Aliases<input type="text" name="aliases" maxlength="300" placeholder="Comma-separated pseudonyms or spellings"></label>
        </div>
        <label class="field-label">Specialty<textarea name="specialty" rows="3" maxlength="800" placeholder="What should the profile say?"></textarea></label>
        <label class="field-label">Known lines<textarea name="famous_lines" rows="2" maxlength="600" placeholder="Comma-separated lines, brands or collaborations"></textarea></label>
      </fieldset>
      <fieldset class="form-fieldset"><legend>Relationship edge fields</legend>
        <div class="form-grid two">
          <label class="field-label">From node id<input type="text" name="relationship_from" maxlength="160" placeholder="teacher, smith, workshop..."></label>
          <label class="field-label">To node id<input type="text" name="relationship_to" maxlength="160" placeholder="student, sharpener, line..."></label>
          <label class="field-label">Relationship type<select name="relationship_kind">
            <option value="">Choose if relevant</option>
            <option value="student">Student / lineage</option>
            <option value="apprenticeship">Apprenticeship</option>
            <option value="works-at">Works at / workshop</option>
            <option value="smith-to-sharpener">Smith to sharpener</option>
            <option value="line-collaboration">Line collaboration</option>
            <option value="brand-to-line">Brand to line</option>
            <option value="alias">Alias / pseudonym</option>
            <option value="regional-peer">Regional peer</option>
          </select></label>
          <label class="field-label">Edge label<input type="text" name="relationship_label" maxlength="180" placeholder="student, works at, forged for..."></label>
        </div>
        <label class="field-label">Relationship detail<textarea name="relationship_detail" rows="3" maxlength="900" placeholder="Short context for the edge."></textarea></label>
      </fieldset>
      <fieldset class="form-fieldset"><legend>Source trail</legend>
        <div class="form-grid two">
          <label class="field-label">Source label<input type="text" name="source_label" maxlength="180" placeholder="Hitohira profile, KKF post, retailer page..."></label>
          <label class="field-label">Source URL<input type="url" name="source_url" maxlength="600" placeholder="https://..."></label>
          <label class="field-label">Confidence<select name="confidence">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="low">Low / community sourced</option>
          </select></label>
        </div>
      </fieldset>
      <label class="field-label">Notes<textarea name="notes" rows="4" maxlength="1400" placeholder="Anything I should know before approving this?"></textarea></label>
      <input type="hidden" name="page_url" data-current-url>
      <input type="hidden" name="pathname" data-current-path>
      <label class="bot-field" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
      <div class="form-row"><button class="button primary" type="submit">Send suggestion</button><p class="form-status" data-form-status aria-live="polite"></p></div>
    </form>
  </div>
</div>'''

def explore_page():
    return head('Explore deck — Adrichops', 'A tactile flickable card-navigation view for Adrichops articles, maker spotlights, reviews and recommendations.', '/explore/') + header('') + '''<main class="page"><section class="collection-hero"><span class="kicker">Card navigation</span><h1>Explore the deck.</h1><p>Browse Adrichops like a stack of knife cards. Choose a section, then flick the active card left or right to move through reviews, maker spotlights and recommendations.</p></section><section class="explore-layout" data-explore-deck><nav class="deck-nav" data-deck-nav aria-label="Deck sections"></nav><div class="card-stage"><div class="card-stage-head"><div><span class="kicker">Active stack</span><h2 data-stage-title>Reviews</h2><p data-stage-dek>Choose a section to load the stack.</p></div><div class="deck-controls" aria-label="Card controls"><button class="deck-control-button" type="button" data-deck-prev aria-label="Previous card">‹</button><span class="deck-counter" data-deck-counter>1 / 1</span><button class="deck-control-button" type="button" data-deck-next aria-label="Next card">›</button></div></div><p class="deck-hint">Flick the top card left or right. Arrow keys and the buttons work too.</p><div class="card-stack" data-card-stack tabindex="0" aria-live="polite"></div></div><aside class="deck-preview" data-deck-preview></aside></section></main><script src="/assets/js/explore-deck.js" defer></script>''' + footer()

def maker_map_page(graph):
    count = sum(len(r.get('nodes', [])) for r in graph.get('regions', []))
    return head('Maker map - Adrichops', 'Explore Japanese knife makers, their roles and the relationships behind your knife.', '/maker-map/') + header('Maker map') + f'''<main class="page maker-map-page"><section class="map-intro"><div><span class="kicker">People behind the edge</span><h1>Maker map</h1><p>The people, places and relationships behind Japanese kitchen knives.</p></div><button class="button" type="button" data-maker-suggestion-open>Suggest changes</button></section>
<section class="maker-explorer" data-maker-explorer aria-label="Maker explorer">
<div class="map-controls"><label>Search makers<input class="search-input" type="search" data-maker-search placeholder="Name, alias or knife line"></label><label>Region<select data-maker-region><option value="">All regions</option></select></label><label>Role<select data-maker-role><option value="">All roles</option><option value="blacksmith">Blacksmith</option><option value="sharpener">Sharpener</option><option value="polisher">Polisher</option><option value="handle maker">Handle maker</option><option value="workshop">Workshop</option><option value="brand">Brand</option></select></label><div class="map-view-switch" role="group" aria-label="View"><button type="button" data-map-view="map" aria-pressed="true">Map</button><button type="button" data-map-view="directory" aria-pressed="false">Directory</button></div></div>
<div class="map-role-key" aria-label="Maker role colour legend"><span class="map-key-heading">Makers</span><div class="map-legend"><span style="--key-color:#ff776b">Blacksmith</span><span style="--key-color:#efbd49">Sharpener</span><span style="--key-color:#61d6cb">Sharpener / polisher</span><span style="--key-color:#cfa3ff">Handle maker</span><span style="--key-color:#6bb7ff">Workshop / brand</span></div></div>\n<div class="map-workspace"><div class="map-main"><div class="map-toolbar"><button class="button small" type="button" data-map-back disabled>All regions</button><span data-map-caption role="status">{count} makers and workshops</span><div class="map-zoom"><button type="button" data-map-zoom="out" aria-label="Zoom out" title="Zoom out"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg></button><button type="button" data-map-zoom="fit" aria-label="Fit graph" title="Fit graph"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg></button><button type="button" data-map-zoom="in" aria-label="Zoom in" title="Zoom in"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg></button></div></div><div data-region-grid class="region-picker"></div><div data-maker-canvas class="maker-canvas" role="group" aria-label="Maker relationships. The Directory view lists every maker and their connections."></div><div data-maker-directory class="maker-directory" hidden></div><p class="map-load-status" data-map-status role="status">Loading makers...</p><details class="map-key" open><summary>Relationship colours</summary><div class="map-legend"><span style="--key-color:#56ce8b">Training / family</span><span style="--key-color:#6bb7ff">Workshop</span><span style="--key-color:#efbd49">Smith / sharpener</span><span style="--key-color:#ff968a">Collaboration</span><span style="--key-color:#61d6cb">Alias</span><span style="--key-color:#aeb8c3">Regional connection</span></div><p>Arrows follow the named relationship. Dashed edges are community reports or relationships still needing a direct source. Dashed node borders identify makers connected from another region.</p></details></div>
<aside class="maker-profile" data-maker-profile tabindex="-1"><h2>Meet the makers</h2><p>Explore a region or search for someone you know.</p><p><a href="/blog/who-made-your-japanese-knife/">New here? How a Japanese knife is made →</a></p></aside></div>
<details class="geography-section"><summary>Where in Japan?</summary><div class="geography-layout"><svg data-japan-map viewBox="0 0 800 720" role="img" aria-label="Japanese knife-making regions"></svg><div data-geography-list class="geography-list"></div></div><p class="image-credit">Map boundaries: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Natural Earth, public domain</a>. Pins show regional reference locations.</p></details>
</section></main>{maker_suggestion_dialog()}<script src="/assets/vendor/cytoscape-3.33.1.min.js" defer></script><script src="/assets/js/maker-graph.js" defer></script>''' + footer()
def guide_index(posts):
    guides = [p for p in posts if p.get('type') != 'Review brief' and p.get('type') != 'Maker spotlight']
    return collection_page('Guides', 'Sharpening, maintenance, steel, profiles, boards, stones and Japanese knife culture.', '', guides, '/guides/', 'Research-led guides under eight minutes, with practical caveats and source trails.')

def who_for(post):
    typ = post.get('type')
    if post.get('bestFor'):
        return post.get('bestFor')
    if typ == 'Maker spotlight':
        return 'Readers trying to understand a maker before chasing stock or hype.'
    if typ == 'Review brief':
        return 'Readers comparing practical buying options before clicking a retailer link.'
    return 'Readers who want the practical version before going deeper.'

def who_skip(post):
    typ = post.get('type')
    if typ == 'Maker spotlight':
        return 'Skip buying by name alone. Read dimensions, grind notes, steel, retailer measurements and owner context first.'
    if typ == 'Review brief':
        return 'Skip if you need a claimed hands-on review. This is labelled as researched unless the status says owned.'
    if post.get('category') == 'sharpening':
        return 'Skip buying more gear until burr formation, pressure and deburring make sense.'
    if post.get('category') == 'maintenance':
        return 'Skip miracle products. Hand wash, dry, store safely and use a sane board first.'
    return 'Skip if you want mythology. This note is meant to be practical and source-aware.'

def maintenance_pairing(post):
    text = []
    title = (post.get('title','') + ' ' + post.get('category','') + ' ' + post.get('steel','')).lower()
    if 'nakiri' in title or 'vegetable' in title:
        text.append('Board: Hasegawa, Asahi or hinoki if you accept the care trade-off.')
        text.append('Stone: Shapton 1000 or King 1000 before polishing higher.')
    elif 'carbon' in title or 'aogami' in title or 'white' in title:
        text.append('Care: wipe during prep, dry fully, accept patina and avoid damp storage.')
        text.append('Board: soft synthetic or hinoki, not glass, marble or punishment bamboo.')
    elif 'sharpen' in title or 'stone' in title or 'grit' in title:
        text.append('Routine: 1000 grit, controlled pressure, burr removal, light strop.')
    elif post.get('type') == 'Review brief':
        text.append('Stone: one reliable 1000 grit stone is enough to start.')
        text.append('Board: soft board plus blade guard beats another spec-sheet argument.')
    else:
        text.append('Maintenance: hand wash, dry, store safely and match the board to the edge.')
    return text

def article_html(post, all_posts):
    related = [p for p in all_posts if p['id'] != post['id'] and (p.get('category') == post.get('category') or p.get('type') == post.get('type'))][:4]
    specs = post.get('specs') or {}
    if not specs:
        specs = {'Type': post.get('type',''), 'Steel': post.get('steel',''), 'Best for': post.get('bestFor',''), 'Length': post.get('length','')}
    spec_html = ''.join(f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k,v in specs.items() if v)
    source_html = ''.join(f'<a href="{esc(s.get("url","#"))}" target="_blank" rel="noopener"><strong>{esc(s.get("name","Source"))}</strong><span>{esc(s.get("type","Source"))} — {esc(s.get("note",""))}</span></a>' for s in (post.get('sourceTrail') or [])[:8]) or '<p>No source trail added yet.</p>'
    product_html = ''
    if post.get('products'):
        product_cards = ''.join(f'<div class="product-card"><strong>{esc(pr.get("name"))}</strong><p>{esc(pr.get("note"))}</p><a class="button" href="{esc(pr.get("url","#"))}" target="_blank" rel="sponsored nofollow noopener">{esc(pr.get("cta","Check availability"))}</a></div>' for pr in post.get('products'))
        product_html = f'<h2>Relevant links</h2><p>Affiliate links may earn commission. Check the exact listing, size and seller before buying.</p><div class="product-grid">{product_cards}</div>'
    body_sections = []
    for sec in post.get('body') or []:
        if sec.get('heading','').lower() == 'takeaways':
            continue
        body_sections.append(f'<h2>{esc(sec.get("heading"))}</h2>' + ''.join(f'<p>{esc(par)}</p>' for par in sec.get('paragraphs') or []))
    takeaways = ''.join(f'<li>{esc(t)}</li>' for t in post.get('takeaways') or [])
    take_html = f'<h2>Takeaways</h2><ul>{takeaways}</ul>' if takeaways else ''
    rel_html = ''.join(f'<a href="{p["route"]}">{esc(p["title"])}</a>' for p in related)
    maintenance = ''.join(f'<li>{esc(t)}</li>' for t in maintenance_pairing(post))
    maintenance_html = f'<div class="aside-card"><h3>Care</h3><ul>{maintenance}</ul></div>' if post.get('type') == 'Review brief' else ''
    decision_html = f'<section class="decision-box"><div><b>Who this is for</b><p>{esc(who_for(post))}</p></div><div><b>Who should skip</b><p>{esc(who_skip(post))}</p></div></section>' if post.get('type') == 'Review brief' else ''
    hero_item = {
        'caption': post.get('imageCaption') or post.get('heroCaption'),
        'credit': post.get('imageCredit') or post.get('heroCredit'),
        'creditUrl': post.get('imageCreditUrl') or post.get('heroCreditUrl'),
    }
    hero_figure_class = ' class="fit-contain"' if post.get('imageFit') == 'contain' else ''
    gallery_html = ''
    if post.get('gallery'):
        gallery_items = ''.join(
            f'<figure><img src="{esc(site_path(g.get("src") or g.get("image") or ""))}" alt="{esc(g.get("alt") or g.get("caption") or "Article image")}">{image_credit_html(g)}</figure>'
            for g in post.get('gallery') or []
            if g.get('src') or g.get('image')
        )
        if gallery_items:
            gallery_html = f'<div class="article-gallery">{gallery_items}</div>'
    schema = {'@context':'https://schema.org','@type':'Article','headline':post.get('title'),'description':post.get('summary'),'author':{'@type':'Person','name':'Adrian'},'datePublished':post.get('date'),'image':absolute_image(post.get('heroImage','assets/img/hero-gyuto.svg'))}
    status_class = 'owned' if str(post.get('status','')).startswith('Owned') else ''
    return head(f"{post.get('title')} — Adrichops", post.get('summary') or post.get('deck') or '', post.get('route','/'), site_path(post.get('heroImage','assets/img/hero-gyuto.svg')), schema) + header('') + f'''<main class="article-page"><article><div class="breadcrumbs"><a href="/">Home</a><span>/</span><a href="/blog/">Blog</a><span>/</span><span>{esc(post.get('type','Note'))}</span></div><header class="article-hero"><span class="kicker">{esc(post.get('type','Note'))}</span><h1>{esc(post.get('title'))}</h1><p class="summary">{esc(post.get('summary') or post.get('deck'))}</p><div class="article-meta"><span class="status-pill {status_class}">{esc(post.get('status',''))}</span><span class="status-pill">{esc(post.get('readTime',''))}</span><button class="button" type="button" data-save-post="{esc(post.get('id'))}">Save</button><button class="button" type="button" data-copy-link>Copy link</button></div></header><div class="article-layout"><aside class="article-sidebar"><div class="aside-card"><h3>Verdict</h3><p>{esc(post.get('verdict') or 'Useful when matched to the right cook, board and maintenance routine.')}</p></div><div class="aside-card"><h3>Specs / context</h3><dl class="spec-list">{spec_html}</dl></div>{maintenance_html}<div class="aside-card"><h3>Source trail</h3><p>{esc(post.get('sourceMode','Source-led note.'))}</p><div class="source-list">{source_html}</div></div></aside><div class="article-body"><figure{hero_figure_class}><img src="{esc(site_path(post.get('heroImage','assets/img/hero-gyuto.svg')))}" alt="{esc(post.get('heroAlt','Article illustration'))}">{image_credit_html(hero_item)}</figure>{gallery_html}{f'<p class="pullquote">{esc(post.get("pullQuote"))}</p>' if post.get('pullQuote') else ''}{decision_html}{''.join(body_sections)}{take_html}{product_html}<h2>Related notes</h2><div class="related-list">{rel_html}</div></div></div></article></main>''' + footer()

def redirect_page(target, title='Redirecting'):
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url={target}"><title>{esc(title)}</title><link rel="canonical" href="{target}"></head><body><p><a href="{target}">Continue to {esc(target)}</a></p></body></html>'

def main():
    posts = load_posts()
    maker_graph = load_maker_graph()
    shops = load_shops()
    # Save regenerated manifest
    for p in posts:
        p['route'] = p.get('route') or route_for(p)
    (ROOT / 'data' / 'posts.json').write_text(json.dumps({'posts': posts}, ensure_ascii=False, indent=2), encoding='utf-8')
    remove_public_path('/editing-guide/')
    remove_public_path('/editing-guide.html')
    remove_public_path('/knife-photos/')
    remove_public_path('/whats-in-my-roll/')
    # Core pages
    write('/index.html', home(posts, shops))
    write('/about/', about_page())
    write('/disclosure/', disclosure_page())
    write('/privacy/', privacy_page())
    write('/kit-builder/', kit_builder_page())
    write('/tool-finder/', recommendations_page(posts))
    write('/knife-finder/', redirect_page('/tool-finder/', 'Tool Finder'))
    write('/shops/', shops_page(shops))
    write('/explore/', explore_page())
    write('/maker-map/', maker_map_page(maker_graph))
    write('/blog/', blog_page(posts))
    # Articles + old /posts redirects
    for p in posts:
        write(p['route'], article_html(p, posts))
        write(f'/posts/{p["id"]}/', redirect_page(p['route'], p['title']))
        if p.get('legacyRoute') and p['legacyRoute'] != p['route']:
            write(p['legacyRoute'], redirect_page(p['route'], p['title']))
    # Old URLs redirects
    write('/about.html', redirect_page('/about/', 'About'))
    write('/reviews/', redirect_page('/blog/', 'Blog'))
    write('/reviews.html', redirect_page('/blog/', 'Blog'))
    write('/guides/', redirect_page('/blog/', 'Blog'))
    write('/guides.html', redirect_page('/blog/', 'Blog'))
    write('/maker-spotlight/', redirect_page('/blog/', 'Blog'))
    write('/maker-spotlight.html', redirect_page('/blog/', 'Blog'))
    write('/makers.html', redirect_page('/blog/', 'Blog'))
    write('/recommendations/', redirect_page('/tool-finder/', 'Tool Finder'))
    write('/recommendations.html', redirect_page('/tool-finder/', 'Tool Finder'))
    write('/knife-finder.html', redirect_page('/tool-finder/', 'Tool Finder'))
    write('/shops.html', redirect_page('/shops/', 'Shops'))
    write('/knife-photos/', redirect_page('/maker-map/', 'Maker map'))
    write('/knife-photos.html', redirect_page('/maker-map/', 'Maker map'))
    write('/roll.html', redirect_page('/kit-builder/', 'Kit Builder'))
    write('/disclosure.html', redirect_page('/disclosure/', 'Disclosure'))
    write('/privacy.html', redirect_page('/privacy/', 'Privacy'))
    write('/kit.html', redirect_page('/kit-builder/', 'Kit Builder'))
    write('/kit-builder.html', redirect_page('/kit-builder/', 'Kit Builder'))
    write('/build-roll/', redirect_page('/kit-builder/', 'Kit Builder'))
    write('/build-roll.html', redirect_page('/kit-builder/', 'Kit Builder'))
    write('/explore.html', redirect_page('/explore/', 'Explore deck'))
    post_redirect = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Redirecting — Adrichops</title></head><body><p>Redirecting…</p><script>fetch('/data/posts.json').then(r=>r.json()).then(d=>{const id=new URLSearchParams(location.search).get('id')||location.hash.slice(1);const p=(d.posts||[]).find(x=>x.id===id||x.slug===id);location.replace(p?p.route:'/');}).catch(()=>location.replace('/'));</script></body></html>'''
    write('/post.html', post_redirect)
    # 404
    write('/404.html', head('Page not found — Adrichops', 'The requested Adrichops page could not be found.', '/404.html') + header('') + '<main class="page"><section class="collection-hero"><span class="kicker">404</span><h1>Lost edge.</h1><p>This page is not in the kit. Try the blog, Tool Finder or search.</p><p><a class="button primary" href="/">Back home</a></p></section></main>' + footer())
    # sitemap
    urls = ['/', '/about/', '/maker-map/', '/blog/', '/disclosure/', '/tool-finder/', '/privacy/'] + [p['route'] for p in posts]
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{BASE_URL.rstrip()}{u}</loc></url>\n' for u in urls) + '</urlset>\n'
    (ROOT / 'sitemap.xml').write_text(sitemap, encoding='utf-8')
    (ROOT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {BASE_URL}/sitemap.xml\n', encoding='utf-8')

if __name__ == '__main__':
    main()
