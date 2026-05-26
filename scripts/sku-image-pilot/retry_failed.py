"""
Retry failed SKUs from errors.json with:
  - urllib.parse.quote on URL path (fixes ASCII/UnicodeEncodeError + control chars)
  - Different fallback queries for no_results
  - Skip 403/404 with explicit log (these need manual curation)

Updates manifest_all.json in place + writes errors_remaining.json.
"""

import html
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch_all_sku_images import (  # noqa: E402
    ROOT,
    OUT_DIR,
    MANIFEST_PATH,
    BRAND_HINTS,
    UA,
    JPEG_QUALITY,
    MAX_DIM,
    slugify,
    clean_query,
    fetch_bing_results,
    pick_image,
    existing_output,
)

from PIL import Image

ERRORS_PATH = ROOT / "errors.json"
REMAINING_PATH = ROOT / "errors_remaining.json"


def encode_url(url: str) -> str:
    """URL-quote the path portion so non-ASCII / TM / control chars survive HTTP."""
    parsed = urllib.parse.urlsplit(url)
    safe_path = urllib.parse.quote(parsed.path, safe="/")
    safe_query = urllib.parse.quote(parsed.query, safe="=&")
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, safe_path, safe_query, parsed.fragment))


def download_and_resize(url: str, dest_no_ext: Path):
    safe_url = encode_url(url)
    req = urllib.request.Request(
        safe_url,
        headers={
            "User-Agent": UA,
            "Referer": "https://www.bing.com/",
            "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    img = Image.open(io.BytesIO(data))
    if img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")
    w, h = img.size
    scale = min(1.0, MAX_DIM / max(w, h))
    if scale < 1.0:
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    final = dest_no_ext.with_suffix(".jpg")
    img.save(final, "JPEG", quality=JPEG_QUALITY, optimize=True)
    return final, final.stat().st_size, img.size


# Fallback query rewrites for SKUs Bing returned 0 useful results
FALLBACK_QUERY_REWRITES = {
    "BAPE 롱슬리브 (FW 시즌)": "BAPE long sleeve t-shirt",
    "Bose QuietComfort 45": "Bose QC45 headphones",
    "Galaxy Z Flip 4": "Samsung Galaxy Z Flip4",
    "Galaxy Tab S7 FE": "Samsung Galaxy Tab S7 FE tablet",
    "Stüssy Hoodie (pullover)": "Stussy basic pullover hoodie",
    "Stüssy Hoodie / Crewneck": "Stussy crewneck hoodie",
    "Converse × ADER ERROR (collab)": "Converse ADER ERROR collaboration sneaker",
    "Converse × Stüssy (척테일러 70 collab)": "Converse Stussy Chuck Taylor 70 collab",
    "Lacoste Pique Polo Shirt (시그니처)": "Lacoste pique polo shirt classic",
    "Lacoste Sneakers (운동화)": "Lacoste mens sneakers",
    "Hermes Oran Sandal (internal learning lane)": "Hermes Oran sandal",
    "Louis Vuitton LV Trainer": "Louis Vuitton LV Trainer sneaker",
    "Louis Vuitton Run Away Sneaker": "Louis Vuitton Run Away mens sneaker",
    "NB x Auralee Collab (990v4/1906R/475/XC-72/WRPD)": "New Balance Auralee 990v4 collab",
    "NB x Stone Island Collab (991v2/574)": "New Balance Stone Island 991v2 collab",
    "Nike × Stüssy Apparel (collab)": "Nike Stussy hoodie collab",
    "Nike × Stüssy Footwear (collab)": "Nike Stussy sneaker collab",
    "Puma Deviate Nitro": "Puma Deviate Nitro running shoe",
    "Puma Velocity Nitro": "Puma Velocity Nitro running",
    "Air Force 1 Low Shadow (WMNS)": "Nike Air Force 1 Shadow womens",
    "Air Jordan 11 High": "Air Jordan 11 retro high",
    "Galaxy Tab S7 FE": "Samsung Galaxy Tab S7 FE",
    "Gucci Rhyton Sneaker": "Gucci Rhyton chunky sneaker white",
    "Patagonia Synchilla / Snap-T Fleece Pullover": "Patagonia Snap-T Synchilla fleece pullover",
    "TNF Nuptse Mule": "North Face Nuptse mule slipper",
}


def retry_sku(entry: dict) -> dict | None:
    sku = entry["sku_name"]
    slug = slugify(sku)
    if existing_output(slug):
        # already done from somewhere else
        return None

    # decide query
    q = FALLBACK_QUERY_REWRITES.get(sku, clean_query(sku))
    print(f"  retry {slug}  q={q!r}", flush=True)
    new_entry = {"sku_name": sku, "slug": slug, "query": q}
    try:
        results = fetch_bing_results(q)
        # try first 3 results (some may fail download)
        last_err = None
        for r in results[:3]:
            try:
                pick = {**r, "pick_reason": "retry_first3"}
                final, size, dims = download_and_resize(pick["image_url"], OUT_DIR / slug)
                new_entry.update(pick)
                new_entry["file_path"] = str(final.relative_to(ROOT))
                new_entry["bytes"] = size
                new_entry["final_dims"] = list(dims)
                new_entry["status"] = "ok"
                print(f"    -> OK {size}b {dims}", flush=True)
                return new_entry
            except Exception as e:
                last_err = e
                continue
        new_entry["status"] = "error"
        new_entry["error"] = repr(last_err) if last_err else "no_usable_result"
        return new_entry
    except Exception as e:
        new_entry["status"] = "error"
        new_entry["error"] = repr(e)
        return new_entry


def main():
    errors = json.loads(ERRORS_PATH.read_text())
    print(f"retrying {len(errors)} failed SKUs", flush=True)
    manifest = json.loads(MANIFEST_PATH.read_text())
    by_slug = {m["slug"]: m for m in manifest}

    remaining = []
    fixed = 0
    for entry in errors:
        result = retry_sku(entry)
        if result is None:
            continue
        if result["status"] == "ok":
            by_slug[result["slug"]] = result
            fixed += 1
        else:
            remaining.append(result)
        time.sleep(1.0)

    MANIFEST_PATH.write_text(json.dumps(list(by_slug.values()), ensure_ascii=False, indent=2))
    REMAINING_PATH.write_text(json.dumps(remaining, ensure_ascii=False, indent=2))
    print(f"\nfixed: {fixed}")
    print(f"still failing: {len(remaining)}  ({REMAINING_PATH})")


if __name__ == "__main__":
    main()
