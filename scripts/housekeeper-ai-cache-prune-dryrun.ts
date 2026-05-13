// Wave 33 dry-run only — measure what `housekeeper-ai-cache-prune` would prune
// under the retention policy proposed in Wave 29 §3. NO DELETE. NO DDL.
//
// Retention policy (proposed, not yet enforced):
//   R1. stale-by-age: classified_at < now() - 30 days
//   R2. raw-row-gone: pid no longer in mvp_raw_listings (FK CASCADE should already cover —
//                    measured as sanity check; expected 0)
//   R3. content-hash-stale: content_hash differs from current mvp_raw_listings.content_hash
//                           AND classified_at < now() - 14 days
//
// 출력: reports/wave33-ai-cache-prune-dryrun-latest.json
//
// 사용: `npx tsx scripts/housekeeper-ai-cache-prune-dryrun.ts`
// production DB read-only. write 없음.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { restFetch, serviceHeaders } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const REPORT_PATH = path.join(appDir, "reports/wave33-ai-cache-prune-dryrun-latest.json");

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}
const RETENTION_R1_DAYS = 30;
const RETENTION_R3_DAYS = 14;

type Counts = {
  total_rows: number;
  r1_stale_by_age: number;
  r2_raw_row_gone: number;
  r3_content_hash_stale: number;
  union_would_prune: number;
  oldest_classified_at: string | null;
  newest_classified_at: string | null;
};

async function selectCount(table: string, filter: string): Promise<number> {
  const headers = { ...serviceHeaders(), Prefer: "count=exact" };
  const url = `${process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?${filter}&limit=1`;
  const res = await restFetch(url, { headers });
  if (!res.ok) throw new Error(`select count failed ${res.status}: ${await res.text()}`);
  const contentRange = res.headers.get("content-range") ?? "";
  const total = Number(contentRange.split("/")[1] ?? "0");
  if (!Number.isFinite(total)) throw new Error(`bad content-range: ${contentRange}`);
  return total;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  const cutoffR1 = new Date(Date.now() - RETENTION_R1_DAYS * 86_400_000).toISOString();
  const cutoffR3 = new Date(Date.now() - RETENTION_R3_DAYS * 86_400_000).toISOString();

  // total
  const total = await selectCount("mvp_listing_ai_classifications", "select=pid");
  // R1 stale by age
  const r1 = await selectCount(
    "mvp_listing_ai_classifications",
    `select=pid&classified_at=lt.${encodeURIComponent(cutoffR1)}`,
  );

  // Wave 34: R2/R3는 `mvp_listing_ai_cache_retention_v1` view에서 측정. view 미배포 시
  // sentinel 0으로 fallback. view migration은 supabase/migrations/20260514000300_*.sql 참조.
  let r2 = 0;
  let r3 = 0;
  let viewAvailable = false;
  try {
    const viewBase = `${process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/mvp_listing_ai_cache_retention_v1`;
    const r2Res = await restFetch(`${viewBase}?select=pid&r2_raw_row_gone=is.true&limit=1`, {
      headers: { ...serviceHeaders(), Prefer: "count=exact" },
    });
    if (r2Res.ok) {
      r2 = Number((r2Res.headers.get("content-range") ?? "0/0").split("/")[1] ?? 0);
      viewAvailable = true;
    }
    if (viewAvailable) {
      const r3Res = await restFetch(`${viewBase}?select=pid&r3_raw_updated_after_classify=is.true&limit=1`, {
        headers: { ...serviceHeaders(), Prefer: "count=exact" },
      });
      if (r3Res.ok) {
        r3 = Number((r3Res.headers.get("content-range") ?? "0/0").split("/")[1] ?? 0);
      }
    }
  } catch {
    // view 미배포 또는 권한 부재 — sentinel 0 유지.
  }

  // bounds
  const oldestRes = await restFetch(
    `${process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/mvp_listing_ai_classifications?select=classified_at&order=classified_at.asc&limit=1`,
    { headers: serviceHeaders() },
  );
  const newestRes = await restFetch(
    `${process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/mvp_listing_ai_classifications?select=classified_at&order=classified_at.desc&limit=1`,
    { headers: serviceHeaders() },
  );
  const oldestJson = (await oldestRes.json()) as Array<{ classified_at: string }>;
  const newestJson = (await newestRes.json()) as Array<{ classified_at: string }>;

  const counts: Counts = {
    total_rows: total,
    r1_stale_by_age: r1,
    r2_raw_row_gone: r2,
    r3_content_hash_stale: r3,
    union_would_prune: r1 + r2 + r3,
    oldest_classified_at: oldestJson[0]?.classified_at ?? null,
    newest_classified_at: newestJson[0]?.classified_at ?? null,
  };

  const payload = {
    wave: 33,
    kind: "housekeeper_ai_cache_prune_dryrun",
    generated_at: new Date().toISOString(),
    policy: {
      r1_stale_age_days: RETENTION_R1_DAYS,
      r3_content_hash_stale_days: RETENTION_R3_DAYS,
      cutoff_r1: cutoffR1,
      cutoff_r3: cutoffR3,
    },
    counts,
    view_available: viewAvailable,
    notes: [
      "DRY-RUN ONLY. No DELETE issued.",
      viewAvailable
        ? "R2/R3 measured from mvp_listing_ai_cache_retention_v1 view."
        : "View mvp_listing_ai_cache_retention_v1 not deployed — R2/R3 reported as sentinel 0. Apply migration 20260514000300_ai_cache_retention_view.sql post owner sign-off.",
      "R3 here is a proxy (raw.source_updated_at > cache.classified_at + 14d). Live housekeeper must reconcile via code-level contentHash before DELETE.",
    ],
  };

  await writeFile(REPORT_PATH, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
