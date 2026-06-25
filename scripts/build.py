#!/usr/bin/env python3
from pathlib import Path
import json, re, html, shutil, datetime
from urllib.parse import quote
import yaml

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = 'https://adrichops.pages.dev'
NAV = [
    ('/about/', 'About'),
    ('/reviews/', 'Reviews'),
    ('/maker-spotlight/', 'Maker spotlight'),
    ('/knife-photos/', 'Knife photos'),
    ('/whats-in-my-roll/', "What’s in my roll"),
    ('/kit-builder/', 'Kit Builder'),
    ('/recommendations/', 'Recommendations'),
    ('/disclosure/', 'Disclosure'),
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
    data['route'] = data.get('route') or route_for(data)
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

def load_photo_gallery():
    path = ROOT / 'data' / 'photo-gallery.json'
    if not path.exists():
        return []
    return (json.loads(path.read_text(encoding='utf-8')).get('photos') or [])

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
{schema_tag}
</head>
<body>'''

def header(current=''):
    nav = ''.join(f'<a href="{href}" {"aria-current=\"page\"" if current==label else ""}>{esc(label)}</a>' for href,label in NAV)
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
    return f'''<div class="search-dialog" data-search-dialog aria-hidden="true"><div class="search-panel" role="dialog" aria-label="Search Adrichops"><header><input data-search-input type="search" placeholder="Search maker, nakiri, VG10, Shapton, board…"><button class="icon-button" type="button" data-search-close aria-label="Close search">×</button></header><div class="search-results" data-search-results></div></div></div>
<footer class="footer"><div class="footer-inner"><p>© {year} Adrichops. Personal knife notes, source trails and disclosed affiliate links.</p><nav class="footer-links">{links}<a href="/privacy/">Privacy</a><a href="/explore/">Explore deck</a></nav></div></footer>
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
        out.append(f'''<a class="article-card" href="{p['route']}">
  <img src="/{esc(p.get('heroImage','assets/img/hero-gyuto.svg'))}" alt="{esc(p.get('heroAlt','Article illustration'))}">
  <div class="article-card-body"><span class="eyebrow">{esc(p.get('type','Note'))} · {esc(p.get('readTime',''))}</span><h3>{esc(p.get('title'))}</h3><p>{esc(p.get('summary') or p.get('deck'))}</p><span class="status-pill">{esc(p.get('status',''))}</span></div>
</a>''')
    return '<div class="article-card-grid">' + ''.join(out) + '</div>'

def finder_markup():
    data = json.loads((ROOT / 'data/finder.json').read_text(encoding='utf-8'))
    groups = []
    defaults = {'task':'vegetable','care':'low','budget':'mid'}
    for q in data['questions']:
        opts = []
        for opt in q['options']:
            checked = 'checked' if defaults.get(q['id']) == opt['value'] else ''
            opts.append(f'<label class="finder-option"><input type="radio" name="{esc(q["id"])}" value="{esc(opt["value"])}" {checked}> <span>{esc(opt["label"])}</span></label>')
        groups.append(f'<fieldset class="finder-group"><legend>{esc(q["label"])}</legend><div class="finder-options">{"".join(opts)}</div></fieldset>')
    return f'''<section class="finder" data-finder>
  <div class="finder-grid"><form class="finder-form">{''.join(groups)}</form><div class="finder-result" data-finder-result></div></div>
</section><script src="/assets/js/finder.js" defer></script>'''

def home(posts):
    start_posts = [p for p in posts if p['id'] in ['start-here-main-kitchen-knife-profiles','chef-knife-vs-gyuto-which-all-purpose-profile','sharpening-basics-burr-angle-pressure','king-vs-shapton-starter-stones-guide','hasegawa-asahi-hinoki-cutting-board-guide','japanese-knife-culture-practical-guide']]
    latest = posts[:10]
    entry = [('/about/','About','Line cook, chipped Shun, Tojiro DP, Japan, then Adrichops.'),('/reviews/','Reviews','Knives, stones and boards with owned/researched labels.'),('/maker-spotlight/','Maker spotlight','Workshops, sharpeners and brands worth understanding.'),('/knife-photos/','Knife photos','High-resolution knife photos with visible attribution and source backlinks.'),('/whats-in-my-roll/',"What’s in my roll",'The personal kit, the sensible kit, and what to edit over time.'),('/kit-builder/','Kit Builder','Drag up to 10 knives, stones, strops, boards, storage and utensils into a saved kit.'),('/recommendations/','Recommendations','Knife Finder, starter paths and maintenance pairings.'),('/explore/','Explore deck','A tactile card browser for the notebook.')]
    entry_html = ''.join(f'<a class="entry-card" href="{href}"><span class="eyebrow">Start</span><strong>{esc(label)}</strong><p>{esc(text)}</p></a>' for href,label,text in entry)
    return head('Adrichops — Japanese knives, sharpening and practical buying notes', 'My personal knife notebook: reviews, maker spotlights, sharpening, boards, stones and recommendations.', '/') + header('') + f'''<main class="page">
  <section class="hero">
    <div><span class="kicker">Personal knife notebook</span><h1>Adrichops.</h1><p class="lead">Kitchen knives, sharpening, makers and buying notes from my own kitchen path: former line cook, chipped Shun edges, a long-running Tojiro DP, and a trip to Japan that turned practical knife interest into functional-art appreciation.</p></div>
    <aside class="hero-note"><strong>No fake mysticism. No pretend testing.</strong><p>Articles are labelled as owned, researched, maker profile or guide. Affiliate links are disclosed. Source trails stay visible.</p></aside>
  </section>
  <section class="section"><div class="section-head"><div><span class="kicker">Navigation</span><h2>Start with the useful path.</h2></div><p>Minimal site first, card deck second. The main experience is built for reading; the deck is there when you want to browse.</p></div><div class="entry-grid">{entry_html}</div></section>
  <section class="section story-strip"><div class="story-card"><span class="kicker">Origin</span><h2>From the line to the makers.</h2><p>Adrichops starts with my college line-cook years, a manager’s chipped Damascus Kai Shun, YouTube sharpening rabbit holes, and the Tojiro DP VG10 gyuto that became my working reference. A trip to Japan and conversations around makers like Takada-san and Baba Hamono turned the private obsession into a public notebook.</p><p><a class="button" href="/about/">Read the story</a></p></div><div class="timeline"><div class="timeline-item"><b>Line cook</b><span>Knife skills became practical, not decorative.</span></div><div class="timeline-item"><b>Sharpening</b><span>Chipped Shun edges taught burrs, patience and humility.</span></div><div class="timeline-item"><b>Tojiro DP</b><span>The first Japanese knife and still the reference point.</span></div><div class="timeline-item"><b>Japan</b><span>Meeting makers reframed knives as tools and functional art.</span></div></div></section>
  <section class="section"><div class="section-head"><div><span class="kicker">Start here</span><h2>First notes to read.</h2></div><a class="text-link" href="/guides/">All guides</a></div>{cards(start_posts)}</section>
  <section class="section"><div class="section-head"><div><span class="kicker">Finder</span><h2>One recommendation, plus the upkeep.</h2></div><a class="text-link" href="/recommendations/">Full recommendations</a></div>{finder_markup()}</section>
  <section class="section"><div class="section-head"><div><span class="kicker">Notebook database</span><h2>Latest notes.</h2></div><div class="section-actions"><button class="button" type="button" data-search-open>Search</button><a class="button" href="/explore/">Open deck</a></div></div>{article_summary_list(latest)}</section>
</main>''' + footer()

def collection_page(title, desc, current, posts, route, intro='', grid=False):
    content = cards(posts) if grid else f'<div class="database-toolbar"><input class="search-input" type="search" placeholder="Filter this page…" data-filter-input="collection"></div><div data-filter-group="collection">{article_summary_list(posts)}</div>'
    return head(f'{title} — Adrichops', desc, route) + header(current) + f'''<main class="page"><section class="collection-hero"><span class="kicker">Adrichops</span><h1>{esc(title)}</h1><p>{esc(intro or desc)}</p></section>{content}</main>''' + footer()

def about_page():
    return head('About — Adrichops', 'My line-cook origin story behind Adrichops: sharpening a chipped Shun, buying a Tojiro DP, visiting Japan and starting a personal knife notebook.', '/about/', '/assets/img/about-line-cook.svg') + header('About') + '''<main class="page"><section class="collection-hero"><span class="kicker">About</span><h1>Line cook first. Knife nerd after.</h1><p>Adrichops exists because practical cooking turned into my long-running curiosity about edges, steel, makers and the quiet pleasure of a tool that does exactly what it should.</p></section><section class="story-strip"><div class="story-card"><h2>About me</h2><p>I spent a couple of years as a line cook during college. It was not romantic. It was hot, repetitive, fast, occasionally chaotic, and exactly the kind of environment where a knife stops being an object and becomes a daily working tool.</p><p>That time lit the fuse. I remember learning how to sharpen the Damascus Kai Shun my manager had, mostly because the poor thing had chips that needed help. I watched YouTube instructionals, made mistakes, raised burrs badly, removed burrs worse, and slowly learned that sharpness is not magic. It is contact, pressure, patience and a little humility.</p><p>Then I bought my first Japanese knife: a Tojiro DP gyuto in VG10. I used it for the rest of my time as a line cook, then kept cooking with it afterwards while learning more about knife skills, sharpening, steel and why some tools feel alive on a board.</p><p>Last year I visited Japan, met makers and people connected to the craft, including Takada-san and the people at Baba Hamono. That trip made the interest sharper. Japanese knives are not only tools, and they are not only art objects. The best ones sit in the useful middle: functional art that earns its place by cutting food.</p><p>Adrichops is the place I built to explain that to friends without turning every dinner into a lecture.</p></div><div class="timeline"><div class="timeline-item"><b>College</b><span>A couple of years on the line made knives practical.</span></div><div class="timeline-item"><b>Shun</b><span>A chipped Damascus Kai Shun started the sharpening rabbit hole.</span></div><div class="timeline-item"><b>Tojiro</b><span>The DP VG10 gyuto became the first real Japanese reference point.</span></div><div class="timeline-item"><b>Japan</b><span>Meeting makers turned appreciation into a public notebook.</span></div></div></section><section class="section"><div class="section-head"><div><span class="kicker">How the site works</span><h2>Source trail first. Hype second.</h2></div></div><div class="entry-grid"><div class="entry-card"><span class="eyebrow">Owned</span><strong>Personal experience is labelled.</strong><p>When I own or use a knife long term, the article says so.</p></div><div class="entry-card"><span class="eyebrow">Researched</span><strong>Review briefs are not fake tests.</strong><p>Amazon-accessible gear is treated as researched buying guidance unless marked otherwise.</p></div><div class="entry-card"><span class="eyebrow">Affiliate</span><strong>Links are disclosed.</strong><p>Referral links may earn commission. They do not change the stated caveats.</p></div></div></section></main>''' + footer()

def disclosure_page():
    return head('Disclosure — Adrichops', 'Affiliate disclosure, review integrity, source policy and correction policy for Adrichops.', '/disclosure/') + header('Disclosure') + '''<main class="page"><section class="collection-hero"><span class="kicker">Disclosure</span><h1>Affiliate links, source trails and review integrity.</h1><p>Adrichops may use affiliate links. My goal is to make recommendations useful without pretending every product has been personally tested.</p></section><article class="article-body"><h2>Amazon Associates statement</h2><p>As an Amazon Associate I earn from qualifying purchases.</p><h2>How links work</h2><p>Some product links may be affiliate links to Amazon or other retailers. If you buy through them, Adrichops may earn a commission at no extra cost to you.</p><h2>Status labels</h2><p><strong>Owned</strong> means I have personal long-term experience with the item. <strong>Research brief</strong> means the article is based on official specifications, retailer information and community consensus rather than a claimed hands-on test. <strong>Maker profile</strong> means the piece is about context, style and buying considerations, not a guarantee about every individual knife.</p><h2>Source policy</h2><p>Article pages include a source trail where useful. Official maker pages, specialist retailers, technical references, KKF-style discussion and Reddit-style community consensus can all inform a piece, but the writing remains original and claims are framed carefully.</p><h2>Corrections</h2><p>If a specification, maker attribution, steel, heat-treatment note or retailer detail changes, the article should be corrected. Knife information moves; the site should not pretend otherwise.</p></article></main>''' + footer()

def privacy_page():
    return head('Privacy — Adrichops', 'Privacy notes for Adrichops local storage, saved notes, theme settings and affiliate links.', '/privacy/') + header('') + '''<main class="page"><section class="collection-hero"><span class="kicker">Privacy</span><h1>Small site, small data footprint.</h1><p>Adrichops is a static site. It uses local browser storage for theme choice, saved notes, Knife Finder state and Kit Builder selections.</p></section><article class="article-body"><h2>Local storage</h2><p>The theme toggle, saved articles, Knife Finder choices and Kit Builder deck may be stored in your browser. That data stays on your device unless the hosting platform or future analytics setup changes.</p><h2>Affiliate links</h2><p>External retailers may collect their own analytics or referral data after you leave Adrichops.</p><h2>Future analytics</h2><p>If analytics are added later, this page should be updated before launch.</p></article></main>''' + footer()

def roll_page(products, posts):
    tojiro = next((p for p in posts if p['id']=='tojiro-dp-210mm-gyuto-shortlist-review'), None)
    roll_items = [
        ('01','Tojiro DP VG10 gyuto','The first Japanese knife in the story and the long-term reference point. Still the baseline for value, stainless convenience and gateway-knife realism.', tojiro['route'] if tojiro else '/reviews/'),
        ('02','1000 grit stone','The useful starting point. Shapton if low-fuss splash-and-go matters; King if budget and feedback matter more.' , '/guides/king-vs-shapton-starter-stones-guide/'),
        ('03','Strop or deburring block','A finishing tool, not a belief system. Use it after proper burr removal.', '/guides/stropping-and-deburring-clean-apex/'),
        ('04','Edge-friendly board','Hasegawa, Asahi or hinoki depending on care tolerance. The board can save more edge life than another steel debate.', '/guides/hasegawa-asahi-hinoki-cutting-board-guide/'),
        ('05','Blade guard / roll','A sharp knife rolling loose in a drawer is slapstick until it is not.', '/guides/boards-storage-and-edge-life/')]
    items = ''.join(f'<a class="roll-item" href="{href}"><div class="number">{num}</div><div><h3>{esc(title)}</h3><p>{esc(text)}</p></div></a>' for num,title,text,href in roll_items)
    return head("What’s in my roll — Adrichops", 'The personal Adrichops knife roll: Tojiro DP reference, stones, strop, boards and storage notes.', '/whats-in-my-roll/', '/assets/img/knife-roll.svg') + header("What’s in my roll") + f'''<main class="page"><section class="collection-hero"><span class="kicker">Personal kit</span><h1>What’s in my roll.</h1><p>This page should stay personal. It starts with the Tojiro DP that carried the line-cook years and adds the boring maintenance gear that keeps sharp knives happy.</p></section><section class="roll-grid"><div class="roll-list">{items}</div><aside class="hero-note"><strong>Edit this page as the kit becomes real.</strong><p>When you add new owned knives, boards, stones or travel gear, update this page first. It is more trustworthy than a generic “best knives” list.</p><p><a class="button primary" href="/kit-builder/">Build your kit</a></p></aside></section></main>''' + footer()

def kit_builder_page():
    return head('Kit Builder — Adrichops', 'Create a custom ten-slot knife kit deck with drag-and-drop cards for knives, stones, strops, boards, storage and utensils.', '/kit-builder/', '/assets/img/knife-roll.svg') + header('Kit Builder') + """<main class="page"><section class="collection-hero"><span class="kicker">Interactive kit builder</span><h1>Build your kit.</h1><p>Drag cards from the database into the ten-slot deck, then drag slotted cards around to rearrange the order. Cards carry practical attributes like edge length, steel or material, handle type and knife profile. The kit saves locally in your browser.</p></section><section class="kit-builder" data-kit-builder><aside class="kit-summary-panel"><div class="section-head"><div><span class="kicker">Your kit</span><h2>10-slot deck.</h2></div><p>Start with fewer knives than the internet wants, then add the support gear that keeps them sharp: stone, strop, board and storage. Drag cards directly between the database and the slots.</p></div><div class="kit-summary" data-kit-summary></div><div class="kit-status" data-kit-status></div><div class="kit-control-row"><button class="button primary" type="button" data-kit-starter>Load starter kit</button><button class="button" type="button" data-kit-clear>Clear kit</button><button class="button" type="button" data-kit-copy>Copy summary</button><button class="button" type="button" data-kit-export>Export JSON</button></div></aside><div class="kit-builder-board"><section class="kit-library-panel"><div class="section-head"><div><span class="kicker">Available cards</span><h2>Knife and kit database.</h2></div><p>Drag a card into any open slot, or click Add to use the active slot.</p></div><div class="kit-control-row"><input class="search-input" type="search" placeholder="Search knife, gyuto, VG10, Shapton…" data-kit-search><select data-kit-category aria-label="Filter by category"></select><select data-kit-profile aria-label="Filter by profile"></select><select data-kit-steel aria-label="Filter by steel"></select></div><div class="kit-library-grid" data-kit-library></div></section><section class="kit-slots-panel" data-kit-drop-zone><div class="section-head"><div><span class="kicker">Available slots</span><h2>Your deck.</h2></div><p>Drop cards anywhere on this deck. Filled slots can still be dragged onto another slot to reorder the kit.</p></div><p class="kit-drop-note">Desktop: drag and drop. Mobile fallback: select a slot, then tap Add on a card.</p><div class="kit-slots" data-kit-slots></div></section></div></section></main><script src="/assets/js/kit-builder.js" defer></script>""" + footer()

def recommendations_page(posts):
    rec_posts = [p for p in posts if p['id'] in ['amazon-chef-knife-shortlist-what-to-buy-first','nakiri-profile-guide','king-vs-shapton-starter-stones-guide','hasegawa-asahi-hinoki-cutting-board-guide','vg10-ginsan-aogami-shirogami-guide','sharpening-basics-burr-angle-pressure']]
    return head('Recommendations — Adrichops', 'Knife Finder, starter kits, maintenance pairings and affiliate-ready buying notes.', '/recommendations/') + header('Recommendations') + f'''<main class="page"><section class="collection-hero"><span class="kicker">Recommendations</span><h1>Choose the knife and the upkeep together.</h1><p>The Finder returns a knife direction, steel direction, blade length, caveats and maintenance kit. Low-fuss vegetable prep, for example, points to a VG10 stainless-clad nakiri or simple stainless nakiri with stone, strop, board and storage pairings.</p></section>{finder_markup()}<section class="section"><div class="section-head"><div><span class="kicker">Starter paths</span><h2>Useful next reads.</h2></div></div>{cards(rec_posts)}</section></main>''' + footer()

def explore_page():
    return head('Explore deck — Adrichops', 'A tactile flickable card-navigation view for Adrichops articles, maker spotlights, reviews and recommendations.', '/explore/') + header('') + '''<main class="page"><section class="collection-hero"><span class="kicker">Card navigation</span><h1>Explore the deck.</h1><p>Browse Adrichops like a stack of knife cards. Choose a section, then flick the active card left or right to move through reviews, maker spotlights and recommendations.</p></section><section class="explore-layout" data-explore-deck><nav class="deck-nav" data-deck-nav aria-label="Deck sections"></nav><div class="card-stage"><div class="card-stage-head"><div><span class="kicker">Active stack</span><h2 data-stage-title>Reviews</h2><p data-stage-dek>Choose a section to load the stack.</p></div><div class="deck-controls" aria-label="Card controls"><button class="deck-control-button" type="button" data-deck-prev aria-label="Previous card">‹</button><span class="deck-counter" data-deck-counter>1 / 1</span><button class="deck-control-button" type="button" data-deck-next aria-label="Next card">›</button></div></div><p class="deck-hint">Flick the top card left or right. Arrow keys and the buttons work too.</p><div class="card-stack" data-card-stack tabindex="0" aria-live="polite"></div></div><aside class="deck-preview" data-deck-preview></aside></section></main><script src="/assets/js/explore-deck.js" defer></script>''' + footer()

def knife_photos_page(photos):
    first_image = photos[0]['localImage'] if photos else '/assets/img/hero-gyuto.svg'
    figures = []
    for photo in photos:
        source = photo.get('sourceUrl') or photo.get('originalUrl') or '#'
        original = photo.get('originalUrl') or source
        dimensions = f'{photo.get("originalWidth")} × {photo.get("originalHeight")}' if photo.get('originalWidth') and photo.get('originalHeight') else 'High-resolution source'
        caption = photo.get('caption') or photo.get('displayTitle') or photo.get('title')
        credit = f'{photo.get("author", "Wikimedia Commons contributor")} · {photo.get("license", "Wikimedia Commons")}'
        figures.append(f'''<figure class="photo-card">
  <a class="photo-link" href="{esc(source)}" target="_blank" rel="noopener" aria-label="Open source page for {esc(photo.get('displayTitle'))}"><img src="{esc(site_path(photo.get('localImage')))}" alt="{esc(photo.get('displayTitle') or caption)}" loading="lazy"></a>
  <figcaption><strong>{esc(photo.get('displayTitle') or photo.get('title'))}</strong><span>{esc(caption)}</span><span>{esc(dimensions)}</span><a href="{esc(source)}" target="_blank" rel="noopener">Image: {esc(credit)}</a><a href="{esc(original)}" target="_blank" rel="noopener">Open original file</a></figcaption>
</figure>''')
    return head('High-resolution knife photos — Adrichops', 'A sourced gallery of high-resolution knife photos with author attribution, license notes and backlinks for every image.', '/knife-photos/', site_path(first_image)) + header('Knife photos') + f'''<main class="page photo-page"><section class="collection-hero"><span class="kicker">Knife photos</span><h1>High-resolution knife photos.</h1><p>A visual reference shelf for profiles, finishes and sharpening scenes. Every image on this page includes visible attribution and a backlink to the source page.</p></section><section class="photo-grid" aria-label="High-resolution knife photo gallery">{''.join(figures)}</section></main>''' + footer()

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
    return head(f"{post.get('title')} — Adrichops", post.get('summary') or post.get('deck') or '', post.get('route','/'), site_path(post.get('heroImage','assets/img/hero-gyuto.svg')), schema) + header('') + f'''<main class="article-page"><article><div class="breadcrumbs"><a href="/">Home</a><span>/</span><a href="{('/maker-spotlight/' if post.get('type')=='Maker spotlight' else '/reviews/' if post.get('type')=='Review brief' else '/guides/')}">{esc(post.get('type','Guide'))}</a></div><header class="article-hero"><span class="kicker">{esc(post.get('type','Note'))}</span><h1>{esc(post.get('title'))}</h1><p class="summary">{esc(post.get('summary') or post.get('deck'))}</p><div class="article-meta"><span class="status-pill {status_class}">{esc(post.get('status',''))}</span><span class="status-pill">{esc(post.get('readTime',''))}</span><button class="button" type="button" data-save-post="{esc(post.get('id'))}">Save</button><button class="button" type="button" data-copy-link>Copy link</button></div></header><div class="article-layout"><aside class="article-sidebar"><div class="aside-card"><h3>Verdict</h3><p>{esc(post.get('verdict') or 'Useful when matched to the right cook, board and maintenance routine.')}</p></div><div class="aside-card"><h3>Specs / context</h3><dl class="spec-list">{spec_html}</dl></div><div class="aside-card"><h3>Maintenance pairing</h3><ul>{maintenance}</ul></div><div class="aside-card"><h3>Source trail</h3><p>{esc(post.get('sourceMode','Source-led note.'))}</p><div class="source-list">{source_html}</div></div></aside><div class="article-body"><figure{hero_figure_class}><img src="{esc(site_path(post.get('heroImage','assets/img/hero-gyuto.svg')))}" alt="{esc(post.get('heroAlt','Article illustration'))}">{image_credit_html(hero_item)}</figure>{gallery_html}{f'<p class="pullquote">{esc(post.get("pullQuote"))}</p>' if post.get('pullQuote') else ''}<section class="decision-box"><div><b>Who this is for</b><p>{esc(who_for(post))}</p></div><div><b>Who should skip</b><p>{esc(who_skip(post))}</p></div></section>{''.join(body_sections)}{take_html}{product_html}<h2>Related notes</h2><div class="related-list">{rel_html}</div></div></div></article></main>''' + footer()

def redirect_page(target, title='Redirecting'):
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url={target}"><title>{esc(title)}</title><link rel="canonical" href="{target}"></head><body><p><a href="{target}">Continue to {esc(target)}</a></p></body></html>'

def main():
    posts = load_posts()
    photos = load_photo_gallery()
    # Save regenerated manifest
    for p in posts:
        p['route'] = p.get('route') or route_for(p)
    (ROOT / 'data' / 'posts.json').write_text(json.dumps({'posts': posts}, ensure_ascii=False, indent=2), encoding='utf-8')
    products = json.loads((ROOT / 'data/products.json').read_text(encoding='utf-8')).get('products', [])
    remove_public_path('/editing-guide/')
    remove_public_path('/editing-guide.html')
    # Core pages
    write('/index.html', home(posts))
    write('/about/', about_page())
    write('/disclosure/', disclosure_page())
    write('/privacy/', privacy_page())
    write('/whats-in-my-roll/', roll_page(products, posts))
    write('/kit-builder/', kit_builder_page())
    write('/recommendations/', recommendations_page(posts))
    write('/explore/', explore_page())
    write('/knife-photos/', knife_photos_page(photos))
    reviews = [p for p in posts if p.get('type') == 'Review brief']
    makers = [p for p in posts if p.get('type') == 'Maker spotlight']
    write('/reviews/', collection_page('Reviews', 'Knife, board and stone review briefs with clear owned or researched status labels.', 'Reviews', reviews, '/reviews/', 'Review pages separate personal experience from researched buying notes. Affiliate links are disclosed and caveats stay visible.'))
    write('/maker-spotlight/', collection_page('Maker spotlight', 'Maker and workshop profiles for Takada no Hamono, Ashi, Konosuke, Myojin, Yoshikane, Toyama, Wakui and more.', 'Maker spotlight', makers, '/maker-spotlight/', 'Maker spotlights are context pieces: source-led, practical and not written as hype trophies.'))
    write('/guides/', guide_index(posts))
    # Articles + old /posts redirects
    for p in posts:
        write(p['route'], article_html(p, posts))
        write(f'/posts/{p["id"]}/', redirect_page(p['route'], p['title']))
    # Old URLs redirects
    write('/about.html', redirect_page('/about/', 'About'))
    write('/reviews.html', redirect_page('/reviews/', 'Reviews'))
    write('/makers.html', redirect_page('/maker-spotlight/', 'Maker spotlight'))
    write('/recommendations.html', redirect_page('/recommendations/', 'Recommendations'))
    write('/knife-photos.html', redirect_page('/knife-photos/', 'Knife photos'))
    write('/roll.html', redirect_page('/whats-in-my-roll/', "What’s in my roll"))
    write('/disclosure.html', redirect_page('/disclosure/', 'Disclosure'))
    write('/privacy.html', redirect_page('/privacy/', 'Privacy'))
    write('/kit.html', redirect_page('/whats-in-my-roll/', "What’s in my roll"))
    write('/kit-builder.html', redirect_page('/kit-builder/', 'Kit Builder'))
    write('/build-roll/', redirect_page('/kit-builder/', 'Kit Builder'))
    write('/build-roll.html', redirect_page('/kit-builder/', 'Kit Builder'))
    write('/explore.html', redirect_page('/explore/', 'Explore deck'))
    post_redirect = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Redirecting — Adrichops</title></head><body><p>Redirecting…</p><script>fetch('/data/posts.json').then(r=>r.json()).then(d=>{const id=new URLSearchParams(location.search).get('id')||location.hash.slice(1);const p=(d.posts||[]).find(x=>x.id===id||x.slug===id);location.replace(p?p.route:'/');}).catch(()=>location.replace('/'));</script></body></html>'''
    write('/post.html', post_redirect)
    # 404
    write('/404.html', head('Page not found — Adrichops', 'The requested Adrichops page could not be found.', '/404.html') + header('') + '<main class="page"><section class="collection-hero"><span class="kicker">404</span><h1>Lost edge.</h1><p>This page is not in the kit. Try the notebook, recommendations or search.</p><p><a class="button primary" href="/">Back home</a></p></section></main>' + footer())
    # sitemap
    urls = ['/', '/about/', '/reviews/', '/maker-spotlight/', '/knife-photos/', '/whats-in-my-roll/', '/kit-builder/', '/recommendations/', '/disclosure/', '/privacy/', '/guides/', '/explore/'] + [p['route'] for p in posts]
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{BASE_URL.rstrip()}{u}</loc></url>\n' for u in urls) + '</urlset>\n'
    (ROOT / 'sitemap.xml').write_text(sitemap, encoding='utf-8')
    (ROOT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {BASE_URL}/sitemap.xml\n', encoding='utf-8')

if __name__ == '__main__':
    main()
