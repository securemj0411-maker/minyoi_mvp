"""
SKU generic image pilot fetcher.

For each SKU in PILOT_SKUS:
  1. Clean the SKU name (strip parentheticals)
  2. Fetch Bing Images search HTML
  3. Parse `m=` JSON from each `.iusc` card
  4. Pick the first result with a usable image URL
  5. Download the image to ./out/<slug>.<ext>
  6. Write a manifest.json with {slug, sku_name, query, source_url, image_url, file_path}
"""

import json
import os
import re
import sys
import time
import html
import urllib.parse
import urllib.request
from pathlib import Path

OUT_DIR = Path(__file__).parent / "out"
OUT_DIR.mkdir(exist_ok=True)

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

PILOT_SKUS = [
    "BAPE Shark Hoodie (시그니처 한정)",
    "Wales Bonner × Adidas Samba (collab)",
    "AirPods Max (Lightning)",
    "Barbour Quilted Jacket (리데스데일/베델/와스드)",
    "Marshall Emberton II",
]


def slugify(name: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", name)
    return s.strip("-").lower()[:60]


def clean_query(sku_name: str) -> str:
    # Strip parentheticals and Korean content inside them, keep the brand+model
    q = re.sub(r"\([^)]*\)", "", sku_name).strip()
    q = re.sub(r"\s+", " ", q)
    return q


def fetch_bing_results(query: str):
    url = "https://www.bing.com/images/search?" + urllib.parse.urlencode(
        {"q": query, "form": "HDRSC2", "first": "1"}
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=20) as r:
        html_text = r.read().decode("utf-8", errors="replace")
    matches = re.findall(r'class="iusc"[^>]*?m="([^"]+)"', html_text)
    results = []
    for m_raw in matches:
        try:
            d = json.loads(html.unescape(m_raw))
            if d.get("murl"):
                results.append(
                    {
                        "title": d.get("t", ""),
                        "image_url": d["murl"],
                        "source_url": d.get("purl", ""),
                    }
                )
        except Exception:
            continue
    return results


def pick_image(results, sku_name: str):
    if not results:
        return None
    # Heuristic: prefer brand official domain if obviously matched, else first result
    brand_hints = {
        "bape": ["bape.com"],
        "airpods": ["apple.com"],
        "barbour": ["barbour.com"],
        "marshall": ["marshall.com", "marshallheadphones.com"],
        "adidas": ["adidas.com"],
    }
    low = sku_name.lower()
    for brand, domains in brand_hints.items():
        if brand in low:
            for r in results:
                src = (r.get("source_url") or "") + " " + (r.get("image_url") or "")
                if any(d in src.lower() for d in domains):
                    return {**r, "pick_reason": f"brand_match:{brand}"}
    return {**results[0], "pick_reason": "first_result"}


def download(url: str, dest: Path):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.bing.com/"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
        content_type = r.headers.get("Content-Type", "")
    ext = ".jpg"
    if "png" in content_type:
        ext = ".png"
    elif "webp" in content_type:
        ext = ".webp"
    elif "jpeg" in content_type or "jpg" in content_type:
        ext = ".jpg"
    final = dest.with_suffix(ext)
    final.write_bytes(data)
    return final, len(data), content_type


def main():
    manifest = []
    for sku in PILOT_SKUS:
        slug = slugify(sku)
        q = clean_query(sku)
        print(f"\n=== {sku}", flush=True)
        print(f"    query: {q}", flush=True)
        entry = {"sku_name": sku, "slug": slug, "query": q}
        try:
            results = fetch_bing_results(q)
            print(f"    found {len(results)} results", flush=True)
            pick = pick_image(results, sku)
            if not pick:
                entry["status"] = "no_results"
                manifest.append(entry)
                continue
            entry.update(pick)
            path, size, ctype = download(pick["image_url"], OUT_DIR / slug)
            entry["file_path"] = str(path.relative_to(Path(__file__).parent))
            entry["bytes"] = size
            entry["content_type"] = ctype
            entry["status"] = "ok"
            print(f"    -> {entry['file_path']}  ({size} bytes, {ctype}, {pick['pick_reason']})", flush=True)
        except Exception as e:
            entry["status"] = "error"
            entry["error"] = repr(e)
            print(f"    ERROR: {e}", flush=True)
        manifest.append(entry)
        time.sleep(1.0)  # be polite

    manifest_path = Path(__file__).parent / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"\nmanifest -> {manifest_path}")


if __name__ == "__main__":
    main()
