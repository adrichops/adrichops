#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen
import json
import re
import time

import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "uploads" / "post-images"
DB_PATH = ROOT / "data" / "post-images.json"
FOLDERS = ["content/reviews", "content/makers", "content/guides", "content/recommendations"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AdrichopsImageResearch/1.0; +https://adrichops.pages.dev)"
}

MANUAL = {
    "maker-spotlight-takada-no-hamono": {
        "heroImage": "assets/uploads/takada-making.jpg",
        "heroAlt": "Mitsuaki Takada working at Takada no Hamono",
        "imageCaption": "Mitsuaki Takada in the workshop.",
        "imageCredit": "© TAKADA no HAMONO",
        "imageCreditUrl": "http://www.takadanohamono.com/profile.html",
        "imageFit": "contain",
        "gallery": [
            {
                "src": "assets/uploads/takada-mitsuaki-t-logo.gif",
                "alt": "Mitsuaki-T brand mark",
                "caption": "Mitsuaki-T brand mark from Takada no Hamono.",
                "credit": "© TAKADA no HAMONO",
                "creditUrl": "http://www.takadanohamono.com/mitsuaki-t.html"
            }
        ]
    }
}

SEARCH_FALLBACKS = {
    "amazon-chef-knife-shortlist-what-to-buy-first": "https://commons.wikimedia.org/wiki/File:Kitchen_knife.jpg",
    "boning-fillet-slicer-cleaver-specialist-profiles": "https://commons.wikimedia.org/wiki/File:Kitchen_knives.jpg",
    "bread-serrated-knife-profile-guide": "https://commons.wikimedia.org/wiki/File:Bread_knife.jpg",
    "chef-knife-vs-gyuto-which-all-purpose-profile": "https://commons.wikimedia.org/wiki/File:Kitchen_knife.jpg",
    "history-of-japanese-steel-manufacturing-tatara-yasugi-vg10": "https://commons.wikimedia.org/wiki/File:Tatara_furnace.jpg",
    "honing-vs-sharpening-when-to-use-steel": "https://commons.wikimedia.org/wiki/File:Sharpening_steel.jpg",
    "how-japanese-kitchen-knives-are-made": "https://commons.wikimedia.org/wiki/File:Sakai_forged_knife.jpg",
    "how-steel-is-made-ore-scrap-fire-chemistry": "https://commons.wikimedia.org/wiki/File:Electric_arc_furnace.jpg",
    "japanese-knife-culture-practical-guide": "https://commons.wikimedia.org/wiki/File:Japanese_kitchen_knives.jpg",
    "japanese-knife-regions-sakai-seki-sanjo": "https://commons.wikimedia.org/wiki/File:Japan_location_map.svg",
    "knife-maintenance-daily-routine": "https://commons.wikimedia.org/wiki/File:Kitchen_knife.jpg",
    "knife-steel-metallurgy-basics-for-cooks": "https://commons.wikimedia.org/wiki/File:Steel_microstructure.svg",
    "nakiri-profile-guide": "https://commons.wikimedia.org/wiki/File:Nakiri_b%C5%8Dch%C5%8D.jpg",
    "petty-paring-utility-profile-guide": "https://commons.wikimedia.org/wiki/File:Kitchen_knives.jpg",
    "santoku-profile-guide": "https://commons.wikimedia.org/wiki/File:Santoku_knife.jpg",
    "sharpening-basics-burr-angle-pressure": "https://commons.wikimedia.org/wiki/File:Sharpening_a_knife.jpg",
    "stainless-carbon-steel-care-patina-rust": "https://commons.wikimedia.org/wiki/File:Rust_and_dirt_on_a_knife_blade.jpg",
    "start-here-main-kitchen-knife-profiles": "https://commons.wikimedia.org/wiki/File:Kitchen_knives.jpg",
    "stropping-and-deburring-clean-apex": "https://commons.wikimedia.org/wiki/File:Razor_strop.jpg",
    "vg10-ginsan-aogami-shirogami-guide": "https://commons.wikimedia.org/wiki/File:Steel_microstructure.svg",
    "whetstone-grits-1000-3000-6000": "https://commons.wikimedia.org/wiki/File:Whetstone.jpg",
    "who-made-your-japanese-knife": "https://commons.wikimedia.org/wiki/File:Sakai_forged_knife.jpg",
}

QUERY_FALLBACKS = {
    "Board": "cutting board kitchen",
    "Care": "knife maintenance kitchen knife",
    "Review brief": "chef knife kitchen",
    "Maker spotlight": "Japanese kitchen knife blacksmith",
    "Guide": "kitchen knives",
    "sharpening": "whetstone sharpening stone",
    "profile": "chef knife kitchen",
    "steel": "steel metallurgy knife",
    "boards": "cutting board kitchen",
}


def load_posts():
    posts = []
    for folder in FOLDERS:
        for path in sorted((ROOT / folder).glob("*.md")):
            text = path.read_text(encoding="utf-8")
            if not text.startswith("---"):
                continue
            data = yaml.safe_load(text.split("---", 2)[1]) or {}
            data["_path"] = str(path.relative_to(ROOT))
            data["id"] = data.get("id") or path.stem
            posts.append(data)
    return posts


def source_urls(post):
    urls = []
    if post["id"] in SEARCH_FALLBACKS:
        urls.append(SEARCH_FALLBACKS[post["id"]])
    for source in post.get("sourceTrail") or []:
        url = source.get("url")
        if url and "kitchenknifeforums.com" not in url:
            urls.append(url)
    for product in post.get("products") or []:
        url = product.get("url")
        if url and "amazon." not in url:
            urls.append(url)
    return list(dict.fromkeys(urls))


def fetch(url):
    try:
        request = Request(url, headers=HEADERS)
        with urlopen(request, timeout=6) as response:
            body = response.read()
            return {
                "url": response.geturl(),
                "headers": dict(response.headers),
                "content": body,
                "text": body.decode(response.headers.get_content_charset() or "utf-8", errors="replace"),
            }
    except Exception:
        if url.startswith("https://"):
            try:
                request = Request("http://" + url[8:], headers=HEADERS)
                with urlopen(request, timeout=6) as response:
                    body = response.read()
                    return {
                        "url": response.geturl(),
                        "headers": dict(response.headers),
                        "content": body,
                        "text": body.decode(response.headers.get_content_charset() or "utf-8", errors="replace"),
                    }
            except Exception:
                return None
        return None


def meta_content(html, base_url):
    images = []
    for pattern in [
        r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image|og:image:secure_url)["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image|twitter:image|og:image:secure_url)["\']',
    ]:
        for match in re.findall(pattern, html, flags=re.I):
            images.append(urljoin(base_url, match))
    for match in re.findall(r'<img[^>]+(?:src|data-src)=["\']([^"\']+)["\']', html, flags=re.I):
        images.append(urljoin(base_url, match))
    return list(dict.fromkeys(images))


def commons_metadata(page_url):
    title = urlparse(page_url).path.rsplit("/", 1)[-1]
    api = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime",
        "iiurlwidth": "1600",
    }
    try:
        response = fetch(api + "?" + urlencode(params))
        if not response:
            return None
        data = json.loads(response["text"])
        page = next(iter(data["query"]["pages"].values()))
        info = page["imageinfo"][0]
        ext = info.get("extmetadata") or {}
        author = clean_html((ext.get("Artist") or {}).get("value") or "Wikimedia Commons contributor")
        license_name = clean_html((ext.get("LicenseShortName") or {}).get("value") or "Wikimedia Commons")
        description = clean_html((ext.get("ImageDescription") or {}).get("value") or title.replace("_", " "))
        image_url = info.get("thumburl") or info.get("url")
        return {
            "image_url": image_url,
            "credit": f"{author}, {license_name}",
            "caption": description[:180],
            "credit_url": page_url,
        }
    except Exception:
        return None


def commons_search_metadata(query):
    api = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"file:{query}",
        "gsrnamespace": "6",
        "gsrlimit": "8",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": "1600",
    }
    response = fetch(api + "?" + urlencode(params))
    if not response:
        return None
    try:
        data = json.loads(response["text"])
        pages = list((data.get("query") or {}).get("pages", {}).values())
    except Exception:
        return None
    candidates = []
    for page in pages:
        info_list = page.get("imageinfo") or []
        if not info_list:
            continue
        info = info_list[0]
        mime = info.get("mime", "")
        if not mime.startswith("image/") or mime == "image/svg+xml":
            continue
        width = info.get("width") or 0
        height = info.get("height") or 0
        if width < 240 or height < 140:
            continue
        ext = info.get("extmetadata") or {}
        author = clean_html((ext.get("Artist") or {}).get("value") or "Wikimedia Commons contributor")
        license_name = clean_html((ext.get("LicenseShortName") or {}).get("value") or "Wikimedia Commons")
        description = clean_html((ext.get("ImageDescription") or {}).get("value") or page.get("title", "").replace("File:", "").replace("_", " "))
        page_url = "https://commons.wikimedia.org/wiki/" + page.get("title", "").replace(" ", "_")
        candidates.append({
            "image_url": info.get("thumburl") or info.get("url"),
            "credit": f"{author}, {license_name}",
            "caption": description[:180],
            "credit_url": page_url,
            "area": width * height,
        })
    candidates.sort(key=lambda item: item["area"], reverse=True)
    return candidates[0] if candidates else None


def clean_html(value):
    value = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", value).strip()


def image_ext(url, content_type):
    path = urlparse(url).path.lower()
    if path.endswith(".png") or "png" in content_type:
        return ".png"
    if path.endswith(".webp") or "webp" in content_type:
        return ".webp"
    if path.endswith(".gif") or "gif" in content_type:
        return ".gif"
    if path.endswith(".svg") or "svg" in content_type:
        return ".svg"
    return ".jpg"


def save_image(post_id, image_url):
    response = fetch(image_url)
    if not response:
        return None
    content_type = response["headers"].get("content-type", "")
    if "image" not in content_type and not urlparse(image_url).path.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg")):
        return None
    ext = image_ext(image_url, content_type)
    out = OUT_DIR / f"{post_id}{ext}"
    out.write_bytes(response["content"])
    if ext != ".svg":
        try:
            with Image.open(out) as img:
                width, height = img.size
            if width < 240 or height < 140:
                out.unlink(missing_ok=True)
                return None
        except Exception:
            out.unlink(missing_ok=True)
            return None
    return "assets/uploads/post-images/" + out.name


def discover_from_url(post, url):
    if "commons.wikimedia.org/wiki/File:" in url:
        meta = commons_metadata(url)
        if not meta:
            return None
        path = save_image(post["id"], meta["image_url"])
        if not path:
            return None
        return {
            "heroImage": path,
            "heroAlt": post.get("heroAlt") or post.get("title") or "Article image",
            "imageCaption": meta["caption"],
            "imageCredit": meta["credit"],
            "imageCreditUrl": meta["credit_url"],
            "imageFit": "contain" if path.endswith(".svg") else "cover",
        }

    page = fetch(url)
    if not page:
        return None
    html = page["text"]
    candidates = [
        image for image in meta_content(html, page["url"])
        if not any(skip in image.lower() for skip in ["logo", "icon", "sprite", "avatar", "favicon"])
    ]
    for image_url in candidates[:12]:
        path = save_image(post["id"], image_url)
        if path:
            host = urlparse(page["url"]).netloc.replace("www.", "")
            return {
                "heroImage": path,
                "heroAlt": post.get("heroAlt") or post.get("title") or "Article image",
                "imageCaption": post.get("deck") or post.get("summary") or post.get("title"),
                "imageCredit": host,
                "imageCreditUrl": page["url"],
                "imageFit": "contain",
            }
    return None


def commons_query_for(post):
    title = clean_html(post.get("title") or post["id"]).replace(":", " ")
    category = str(post.get("category") or "").lower()
    if "sharpen" in title.lower() or "stone" in title.lower() or category == "sharpening":
        return QUERY_FALLBACKS["sharpening"]
    if "board" in title.lower() or category in {"boards", "board"}:
        return QUERY_FALLBACKS["boards"]
    if "steel" in title.lower() or category == "steel":
        return QUERY_FALLBACKS["steel"]
    if post.get("type") == "Maker spotlight":
        return title.split(",")[0]
    return title


def discover_from_commons_search(post):
    for query in [clean_html(post.get("title") or ""), commons_query_for(post), QUERY_FALLBACKS.get(post.get("type") or "", "kitchen knives")]:
        if not query:
            continue
        meta = commons_search_metadata(query)
        if not meta:
            continue
        path = save_image(post["id"], meta["image_url"])
        if not path:
            continue
        return {
            "heroImage": path,
            "heroAlt": post.get("heroAlt") or post.get("title") or "Article image",
            "imageCaption": meta["caption"],
            "imageCredit": meta["credit"],
            "imageCreditUrl": meta["credit_url"],
            "imageFit": "cover",
        }
    return None


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    existing = {}
    if DB_PATH.exists():
        existing = json.loads(DB_PATH.read_text(encoding="utf-8")).get("posts") or {}
    results = dict(existing)
    report = []

    for post in load_posts():
        post_id = post["id"]
        if post_id in MANUAL:
            results[post_id] = MANUAL[post_id]
            report.append((post_id, "manual"))
            continue
        initial_urls = [SEARCH_FALLBACKS[post_id]] if post_id in SEARCH_FALLBACKS else []
        for url in initial_urls:
            data = discover_from_url(post, url)
            if data:
                results[post_id] = data
                report.append((post_id, url))
                break
            time.sleep(0.2)
        if post_id not in results:
            data = discover_from_commons_search(post)
            if data:
                results[post_id] = data
                report.append((post_id, "commons-search"))
            else:
                report.append((post_id, "missing"))

    DB_PATH.write_text(json.dumps({"posts": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for post_id, source in report:
        print(f"{post_id}\t{source}", flush=True)
    print(f"wrote {DB_PATH.relative_to(ROOT)} with {len(results)} entries")


if __name__ == "__main__":
    main()
