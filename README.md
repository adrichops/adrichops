# Adrichops

A static site about kitchen tools and the people who make them. Primary navigation: About, Maker map, Blog, Disclosure and Tool Finder.

## Local preview

```bash
python3 -m pip install -r requirements.txt
python3 scripts/build.py
python3 -m http.server 8080
```

Open `http://localhost:8080`. Run the build after editing content or templates.

## Content and recommendations

- `content/`: Markdown articles. All articles are collected under `/blog/`; older article URLs remain available.
- `scripts/build.py`: shared templates, pages and generated search manifest.
- `data/products.json`: product descriptions, source links and Amazon affiliate search URLs.
- `data/finder.json`: Tool Finder needs, priorities and product selections.
- `assets/js/finder.js`: recommendation rendering. The `/knife-finder/` and `/recommendations/` routes redirect to `/tool-finder/`.

The finder starts with Victorinox and Tojiro for everyday knives, and King or Shapton for a first sharpening stone. Amazon search links are labelled as searches, not verified product listings. Do not invent ownership, testing experience, prices or availability.

## Maker map

- `data/maker-graph.json`: regions, maker profiles, relationships and source records. Preserve stable IDs when editing.
- `assets/js/maker-graph.js`: a node-and-edge regional graph and searchable directory. Selecting a region shows all its maker records and their connections, including labelled cross-region collaborators. Selecting a maker highlights connections without removing the regional network. Mobile supports the same graph with pan and zoom.
- `assets/vendor/`: locally hosted Cytoscape 3.33.1 and its MIT licence.
- `data/japan-boundary.json`: Japan boundaries from Natural Earth 1:50m, public domain. Geographic coordinates are independent of graph positions.

Every new relationship needs source IDs, a relationship type, a precise description and appropriate confidence. Community reports and records without attached sources are displayed as provisional. A retailer's pseudonym should not be linked to a legal identity without evidence.

Thin region-to-maker edges indicate database grouping, not an employment or collaboration claim. External collaborators retain their own region label. The graph starts at a readable regional zoom; the Fit graph control shows the entire network.

With Playwright and Chrome installed, run `node scripts/check_maker_graph.cjs` against the local server on port 8063. Set `ADRICHOPS_PREVIEW` to check another address. This verifies all region records and that node/edge selection preserves the full network on desktop and mobile.

Existing feedback, newsletter and maker-change suggestion forms use the Cloudflare Pages Functions in `functions/`. Maker suggestions retain the approval workflow; they do not directly modify the published database.

## Publishing

Cloudflare Pages project: `adrichops`. Build command:

```bash
python3 -m pip install -r requirements.txt && python3 scripts/build.py
```

Output directory: `.`. The repository includes generated pages. Publish from a clean checkout so local research files and private working documents are not uploaded. D1 bindings are defined in `wrangler.toml`; secrets remain in Cloudflare configuration.

The kit builder remains available at `/kit-builder/` as a secondary tool; it is not part of the main menu.
