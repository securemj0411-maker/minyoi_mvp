"""
Fetch generic product images for every unique READY SKU and resize them.

Inputs:
  - Supabase: list of distinct sku_name where mvp_candidate_pool.status='ready'
  - Bing Images: search HTML for clean queries

Output:
  - out/<slug>.<ext>   (resized to MAX_DIM)
  - manifest.json      (one entry per SKU)

Resumable: if out/<slug>.* already exists, skip.
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

from PIL import Image

ROOT = Path(__file__).parent
OUT_DIR = ROOT / "out"
OUT_DIR.mkdir(exist_ok=True)
MANIFEST_PATH = ROOT / "manifest_all.json"
ERRORS_PATH = ROOT / "errors.json"

MAX_DIM = 640
JPEG_QUALITY = 85

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

BRAND_HINTS = {
    "bape": ["bape.com"],
    "airpods": ["apple.com"],
    "ipad": ["apple.com"],
    "iphone": ["apple.com"],
    "macbook": ["apple.com"],
    "apple watch": ["apple.com"],
    "imac": ["apple.com"],
    "barbour": ["barbour.com"],
    "marshall": ["marshall.com", "marshallheadphones.com"],
    "adidas": ["adidas.com"],
    "nike": ["nike.com"],
    "jordan": ["nike.com"],
    "new balance": ["newbalance.com"],
    "converse": ["converse.com"],
    "vans": ["vans.com"],
    "puma": ["puma.com"],
    "asics": ["asics.com"],
    "hoka": ["hoka.com", "hokaoneone.com"],
    "salomon": ["salomon.com"],
    "mizuno": ["mizuno.com"],
    "on running": ["on-running.com", "on.com"],
    "patagonia": ["patagonia.com"],
    "arc'teryx": ["arcteryx.com"],
    "tnf": ["thenorthface.com"],
    "north face": ["thenorthface.com"],
    "moncler": ["moncler.com"],
    "stone island": ["stoneisland.com"],
    "thom browne": ["thombrowne.com"],
    "polo": ["ralphlauren.com"],
    "ralph lauren": ["ralphlauren.com"],
    "lacoste": ["lacoste.com"],
    "supreme": ["supremenewyork.com"],
    "stussy": ["stussy.com"],
    "stüssy": ["stussy.com"],
    "carhartt": ["carhartt-wip.com", "carhartt.com"],
    "acne": ["acnestudios.com"],
    "uniqlo": ["uniqlo.com"],
    "matin kim": ["matinkim.com"],
    "ugg": ["ugg.com"],
    "crocs": ["crocs.com"],
    "birkenstock": ["birkenstock.com"],
    "dr. martens": ["drmartens.com"],
    "onitsuka tiger": ["onitsukatiger.com"],
    "dior": ["dior.com"],
    "gucci": ["gucci.com"],
    "prada": ["prada.com"],
    "louis vuitton": ["louisvuitton.com"],
    "balenciaga": ["balenciaga.com"],
    "hermes": ["hermes.com"],
    "margiela": ["maisonmargiela.com"],
    "yeezy": ["adidas.com", "yeezy.com"],
    "bose": ["bose.com"],
    "sony": ["sony.com", "sony.co.kr"],
    "beats": ["beatsbydre.com", "apple.com"],
    "galaxy": ["samsung.com"],
    "samsung": ["samsung.com"],
    "dyson": ["dyson.com"],
    "dji": ["dji.com"],
    "gopro": ["gopro.com"],
    "tom ford": ["tomfordbeauty.com"],
    "seiko": ["seikowatches.com"],
    "nintendo": ["nintendo.com", "nintendo.co.kr"],
    "switch": ["nintendo.com", "nintendo.co.kr"],
}


def fetch_skus():
    url = (
        f"{SUPABASE_URL}/rest/v1/rpc/"
    )
    # Use raw SQL via REST is non-trivial; use the candidate-pool/listings via PostgREST query
    # We'll use the REST views directly with a filter join. Simpler: query mvp_listings filtered to ready SKUs.
    # Easiest: PostgREST does not do joins easily. Use the materialised view path: filter via two requests:
    # 1) get distinct pids where status='ready'
    # 2) get sku_name for those pids
    # But that's costly. Better: write a small Postgres function. For now hardcode the 302 list passed in.
    raise NotImplementedError("Use fetch_skus_from_file")


def fetch_skus_from_file(path: Path):
    return json.loads(path.read_text())


def slugify(name: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", name)
    return s.strip("-").lower()[:80] or "sku"


def clean_query(sku_name: str) -> str:
    # Strip parentheticals (including Korean notes) and odd chars
    q = re.sub(r"\([^)]*\)", "", sku_name)
    # remove em-dashes and slashes (they confuse search)
    q = q.replace("—", " ").replace("/", " ")
    # collapse whitespace
    q = re.sub(r"\s+", " ", q).strip()
    return q


def fetch_bing_results(query: str, retries: int = 2):
    url = "https://www.bing.com/images/search?" + urllib.parse.urlencode(
        {"q": query, "form": "HDRSC2", "first": "1"}
    )
    last_err = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}
            )
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
        except Exception as e:
            last_err = e
            time.sleep(2 + attempt * 2)
    raise last_err  # type: ignore


def pick_image(results, sku_name: str):
    if not results:
        return None
    low = sku_name.lower()
    matched_brands = [b for b in BRAND_HINTS if b in low]
    if matched_brands:
        domains = {d for b in matched_brands for d in BRAND_HINTS[b]}
        for r in results:
            src = (r.get("source_url") or "") + " " + (r.get("image_url") or "")
            if any(d in src.lower() for d in domains):
                return {**r, "pick_reason": f"brand:{matched_brands[0]}"}
    return {**results[0], "pick_reason": "first_result"}


def download_and_resize(url: str, dest_no_ext: Path):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.bing.com/"})
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


def existing_output(slug: str):
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        p = OUT_DIR / f"{slug}{ext}"
        if p.exists() and p.stat().st_size > 0:
            return p
    return None


def main():
    sku_path = ROOT / "skus.json"
    if not sku_path.exists():
        print(f"ERROR: {sku_path} missing. Write the SKU list there first.", file=sys.stderr)
        sys.exit(1)
    skus = fetch_skus_from_file(sku_path)
    print(f"loaded {len(skus)} SKUs", flush=True)

    manifest = []
    errors = []
    for i, sku in enumerate(skus, 1):
        slug = slugify(sku)
        existing = existing_output(slug)
        entry = {"sku_name": sku, "slug": slug}
        if existing:
            entry["status"] = "skipped_exists"
            entry["file_path"] = str(existing.relative_to(ROOT))
            entry["bytes"] = existing.stat().st_size
            manifest.append(entry)
            if i % 25 == 0:
                print(f"[{i}/{len(skus)}] skip {slug}", flush=True)
            continue
        q = clean_query(sku)
        entry["query"] = q
        try:
            results = fetch_bing_results(q)
            pick = pick_image(results, sku)
            if not pick:
                entry["status"] = "no_results"
                errors.append(entry)
                manifest.append(entry)
                print(f"[{i}/{len(skus)}] NO_RESULTS {slug}  q={q}", flush=True)
                time.sleep(1.0)
                continue
            entry.update(pick)
            final, size, dims = download_and_resize(pick["image_url"], OUT_DIR / slug)
            entry["file_path"] = str(final.relative_to(ROOT))
            entry["bytes"] = size
            entry["final_dims"] = dims
            entry["status"] = "ok"
            print(
                f"[{i}/{len(skus)}] OK {slug}  {size}b {dims}  ({pick['pick_reason']})",
                flush=True,
            )
        except Exception as e:
            entry["status"] = "error"
            entry["error"] = repr(e)
            errors.append(entry)
            print(f"[{i}/{len(skus)}] ERROR {slug}  {e}", flush=True)
        manifest.append(entry)
        time.sleep(0.8)

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    ERRORS_PATH.write_text(json.dumps(errors, ensure_ascii=False, indent=2))
    print(f"\nmanifest -> {MANIFEST_PATH}")
    print(f"errors -> {ERRORS_PATH}  ({len(errors)} errors)")
    print(f"ok: {sum(1 for m in manifest if m['status'] == 'ok')}")
    print(f"skipped: {sum(1 for m in manifest if m['status'] == 'skipped_exists')}")


if __name__ == "__main__":
    main()
