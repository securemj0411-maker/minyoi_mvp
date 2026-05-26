"""
Upload SKU images to Supabase Storage bucket 'sku-images' and register URLs in mvp_sku_images.

Reads manifest_all.json and for each {status:'ok'} entry:
  1. uploads out/<slug>.jpg -> storage://sku-images/<slug>.jpg
  2. UPSERTs row into public.mvp_sku_images (sku_name PK)
     with image_url = public URL.
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
MANIFEST = ROOT / "manifest_all.json"
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET = "sku-images"


def http_request(method: str, url: str, headers: dict, body: bytes | None = None, timeout: int = 30):
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    return urllib.request.urlopen(req, timeout=timeout)


CONTENT_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def upload_file(slug: str, path: Path) -> tuple[str, str]:
    ext = path.suffix.lower()
    ctype = CONTENT_TYPES.get(ext, "image/jpeg")
    object_path = f"{slug}{ext}"
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{object_path}"
    data = path.read_bytes()
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": ctype,
        "x-upsert": "true",  # overwrite if exists
    }
    try:
        with http_request("POST", upload_url, headers, data) as r:
            _ = r.read()
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")[:300]
        raise RuntimeError(f"upload {object_path} failed: {e.code} {msg}")
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{object_path}"
    return public_url, object_path


def upsert_row(sku_name: str, image_url: str, storage_path: str, entry: dict):
    rest_url = f"{SUPABASE_URL}/rest/v1/mvp_sku_images?on_conflict=sku_name"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    dims = entry.get("final_dims") or [None, None]
    payload = {
        "sku_name": sku_name,
        "image_url": image_url,
        "storage_path": storage_path,
        "source_url": entry.get("source_url"),
        "pick_reason": entry.get("pick_reason"),
        "bytes": entry.get("bytes"),
        "width": dims[0] if isinstance(dims, list) and len(dims) > 0 else None,
        "height": dims[1] if isinstance(dims, list) and len(dims) > 1 else None,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    try:
        with http_request("POST", rest_url, headers, body) as r:
            _ = r.read()
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")[:300]
        raise RuntimeError(f"upsert row {sku_name!r} failed: {e.code} {msg}")


def main():
    manifest = json.loads(MANIFEST.read_text())
    ok_entries = [m for m in manifest if m.get("status") in ("ok", "skipped_exists") and m.get("file_path")]
    print(f"uploading {len(ok_entries)} files to bucket={BUCKET}", flush=True)
    uploaded = 0
    failed = []
    for i, entry in enumerate(ok_entries, 1):
        slug = entry["slug"]
        sku = entry["sku_name"]
        rel = entry["file_path"]
        path = ROOT / rel
        if not path.exists():
            failed.append({**entry, "fail_reason": "file_missing"})
            print(f"[{i}/{len(ok_entries)}] MISS {slug}", flush=True)
            continue
        try:
            public_url, object_path = upload_file(slug, path)
            upsert_row(sku, public_url, f"{BUCKET}/{object_path}", entry)
            uploaded += 1
            if i % 25 == 0 or i == len(ok_entries):
                print(f"[{i}/{len(ok_entries)}] uploaded {slug}", flush=True)
        except Exception as e:
            failed.append({**entry, "fail_reason": repr(e)})
            print(f"[{i}/{len(ok_entries)}] FAIL {slug}  {e}", flush=True)

    fail_path = ROOT / "upload_errors.json"
    fail_path.write_text(json.dumps(failed, ensure_ascii=False, indent=2))
    print(f"\nuploaded: {uploaded}/{len(ok_entries)}")
    print(f"failed: {len(failed)}  ({fail_path})")


if __name__ == "__main__":
    main()
