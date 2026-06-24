# Adrichops production redesign

This is the consolidated redesign: the minimal Notion-style site is now the production experience, and the card-stack concept has been moved into `/explore/` as a dedicated interactive deck.

## What changed

- Real top-level routes: `/about/`, `/reviews/`, `/maker-spotlight/`, `/whats-in-my-roll/`, `/kit-builder/`, `/recommendations/`, `/disclosure/`, `/guides/`, `/explore/`.
- Real generated article pages such as `/reviews/tojiro-dp-210mm-gyuto-shortlist-review/` and `/maker-spotlight/maker-spotlight-takada-no-hamono/`.
- Markdown source files in `content/` instead of relying only on one large JSON file.
- Generated `data/posts.json` manifest for search, deck navigation and the Knife Finder.
- Data-driven Knife Finder in `data/finder.json`.
- Reusable affiliate/product data in `data/products.json`.
- Source-trail discipline and status labels on article pages.
- Cleaner article template: verdict, status, source trail, maintenance pairing, who it is for, who should skip.
- Card navigation is now a dedicated Explore Deck, not a second duplicate website.

## Local preview

```bash
python3 -m pip install -r requirements.txt
python3 scripts/build.py
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Editing flow

Edit Markdown files in `content/`. Edit the Knife Finder in `data/finder.json`. Edit reusable product links in `data/products.json`. Then run `python3 scripts/build.py` before publishing.

For Netlify, connect the GitHub repo and keep the included build command. For browser editing, configure Netlify Identity + Git Gateway and visit `/admin/`.

## Cloudflare Pages

Use the `adrichops` Pages project. Build command:

```bash
python3 -m pip install -r requirements.txt && python3 scripts/build.py
```

Build output directory:

```text
.
```


## Flickable card deck

The production site keeps the minimal reading experience, while `/explore/` provides the tactile card UX. Readers can flick the active card left or right, use the arrow buttons, or use keyboard arrow keys to move through each section. The deck pulls from the same `data/posts.json` content, so it does not duplicate articles.


## Kit Builder

The `/kit-builder/` section lets readers create a ten-slot kit from `data/kit-items.json`. Items can be knives, stones, strops, boards, storage or utensils. Cards can be dragged from the database into the available slots and filled slots can be dragged to rearrange the order. The selected kit is saved in the reader's browser with localStorage and can be copied or exported as JSON.
