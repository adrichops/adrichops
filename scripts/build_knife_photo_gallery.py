#!/usr/bin/env python3
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "uploads" / "knife-photos"
DATA_PATH = ROOT / "data" / "photo-gallery.json"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AdrichopsPhotoGallery/1.0; +https://adrichops.pages.dev)"
}

FILES = [
    ("File:Gyuto, yanagiba, santoku, and nakiri (version 2).jpg", "Four Japanese kitchen knife profiles"),
    ("File:Gyuto, yanagiba, santoku, and nakiri (version 2, alt angle).jpg", "Japanese knife profiles side angle"),
    ("File:240mm gyuto.jpg", "240mm gyuto"),
    ("File:240mm gyuto (top-down view).jpg", "240mm gyuto top-down"),
    ("File:Munetoshi Bloomery Iron Gyuto.jpg", "Munetoshi bloomery iron gyuto"),
    ("File:Nakiri.jpg", "Hammered nakiri"),
    ("File:180mm Ashi Ginga Carbon Steel Santoku (2026)-104A8749.jpg", "Ashi Ginga carbon steel santoku"),
    ("File:Santoku-Kai-Shun-Nagare.jpg", "Kai Shun Nagare santoku"),
    ("File:Masashi Kokuen Kiritsuke Petty 135mm (2026)-104A7479.jpg", "Kiritsuke-style petty knife"),
    ("File:Moritaka 8.25-Inch Aogami Super Carbon Steel Gyuto (2026)-104A7336.jpg", "Moritaka Aogami Super gyuto"),
    ("File:Hitohira Togashi 165mm Deba Shirogami 2 (2026)-104A7987.jpg", "Hitohira Togashi deba"),
    ("File:Deba Shouren Ginsan stainless steel Knife, Jikko Knives, Sakai (49070649923).jpg", "Jikko deba Sakai"),
    ("File:Steelport 6-Inch Chef Knife (2026)-104A7331.jpg", "Hand-forged chef knife"),
    ("File:Chef Knives, German, Japanese, Chinese.jpg", "German Japanese and Chinese chef knives"),
    ("File:Chefs knifes on a wooden cutting board.jpg", "Chef knives on wooden board"),
    ("File:Japonese knife Tokyo (willem!).jpg", "Japanese knife shop in Tokyo"),
    ("File:Victorinox kitchen cutlery.jpg", "Victorinox kitchen cutlery"),
    ("File:Kitchen knife made of stainless steel with sliced white cabbage.jpg", "Kitchen knife with sliced cabbage"),
    ("File:Arrotino giapponese.JPG", "Japanese knife sharpener"),
    ("File:Whetstone Knife Sharpening, 2015-(01).jpg", "Knife sharpening on a waterstone"),
    ("File:Strops-and-pastes-knife-01.jpg", "Strops and sharpening pastes"),
]


def clean(value):
    value = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", value).strip()


def commons_info(title):
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": "2400",
    }
    url = COMMONS_API + "?" + urlencode(params)
    with urlopen(Request(url, headers=HEADERS), timeout=30) as response:
        data = json.loads(response.read())
    page = next(iter(data["query"]["pages"].values()))
    info = page["imageinfo"][0]
    meta = info.get("extmetadata") or {}
    source_page = "https://commons.wikimedia.org/wiki/" + page["title"].replace(" ", "_")
    return {
        "title": page["title"].replace("File:", "").replace("_", " "),
        "imageUrl": info.get("thumburl") or info["url"],
        "originalUrl": info["url"],
        "sourceUrl": source_page,
        "author": clean((meta.get("Artist") or {}).get("value") or "Wikimedia Commons contributor"),
        "license": clean((meta.get("LicenseShortName") or {}).get("value") or "Wikimedia Commons"),
        "caption": clean((meta.get("ImageDescription") or {}).get("value") or page["title"].replace("File:", "")),
        "originalWidth": info.get("width"),
        "originalHeight": info.get("height"),
        "mime": info.get("mime", ""),
    }


def extension(mime, url):
    if "png" in mime:
        return ".png"
    if "webp" in mime:
        return ".webp"
    suffix = Path(url.split("?", 1)[0]).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"


def slugify(value):
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def download(item, label):
    ext = extension(item["mime"], item["imageUrl"])
    filename = slugify(label) + ext.replace(".jpeg", ".jpg")
    path = OUT_DIR / filename
    with urlopen(Request(item["imageUrl"], headers=HEADERS), timeout=45) as response:
        path.write_bytes(response.read())
    return "assets/uploads/knife-photos/" + filename


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    photos = []
    for title, label in FILES:
        item = commons_info(title)
        item["id"] = slugify(label)
        item["displayTitle"] = label
        item["localImage"] = download(item, label)
        photos.append(item)
        print(f"{label}: {item['localImage']} ({item['originalWidth']}x{item['originalHeight']})")
    DATA_PATH.write_text(json.dumps({"photos": photos}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {DATA_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
