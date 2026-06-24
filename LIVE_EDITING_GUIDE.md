# Live editing guide

## Add a new review

1. Copy a file from `content/reviews/`.
2. Rename it with a clean slug, for example `new-knife-review.md`.
3. Change the `id`, `title`, `summary`, `status`, `heroImage`, source trail and product links.
4. Use an honest status label: `Owned`, `Handled`, `Research brief`, `Wishlist` or `Owned / long-term reference`.
5. Write with Markdown headings under the frontmatter.
6. Run `python3 scripts/build.py`.

## Add referral links

Use article-level `products` in the Markdown frontmatter for links specific to that article. Use `data/products.json` for reusable product records used by the Knife Finder and What's in My Roll.

Never hard-code copied Amazon star ratings, prices or review counts. Replace `YOURTAG-21` with your real Amazon Associates tag only after joining the programme.


## Edit the Kit Builder

Open `data/kit-items.json` to add or change cards for knives, stones, strops, boards, storage and utensils. Keep the fields consistent: `id`, `name`, `category`, `profile`, `edgeLengthMm`, `steelType`, `handleType`, `bestFor`, `maintenance`, `tags` and `learnUrl`. The public page is `/kit-builder/`; the old `/build-roll/` URL redirects there.

## Edit the Knife Finder

Open `data/finder.json`. Each rule contains:

- `match`: which answers trigger it.
- `title`, `profile`, `steel`, `length`, `maintenanceLevel`.
- `why` and `avoid`.
- `maintenanceKit`: stone, strop, board and storage recommendations.
- `articleIds`: follow-up reading.

The low-fuss vegetable-prep path is `low-fuss-vegetable-nakiri`.

## Publish

On Netlify, the build command is already set in `netlify.toml`:

```bash
python3 -m pip install -r requirements.txt && python3 scripts/build.py
```

Netlify will rebuild the static pages after every Git push or CMS edit.
