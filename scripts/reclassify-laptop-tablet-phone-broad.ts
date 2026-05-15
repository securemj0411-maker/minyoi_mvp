// Wave 113: 전체 카테고리 raw null sku 매물 30일 reclassify
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ruleMatch } from "../src/lib/catalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

async function loadEnv(p: string) {
  try {
    const raw = await readFile(p, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...rest] = t.split("=");
      if (!process.env[k]) process.env[k] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}

// 우리 catalog 운영 brand 키워드 (광범위 sweep)
const _KEYWORDS = [
  "맥북", "macbook", "아이맥", "imac", "맥미니", "mac mini", "맥프로", "맥 스튜디오", "mac studio",
  "아이폰", "iphone", "갤럭시", "galaxy", "갤럭시북",
  "아이패드", "ipad", "갤럭시탭", "갤탭",
  "에어팟", "airpods", "비츠", "beats",
  "소니 wh", "sony wh", "보스 qc", "bose qc",
  "애플워치", "갤럭시워치", "applewatch",
  "ps5", "switch", "스위치",
];

async function main() {
  await loadEnv(path.join(appDir, ".env.local"));
  await loadEnv(path.join(appDir, ".env"));
  const URL_BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const HDR: Record<string, string> = { apikey: KEY, authorization: `Bearer ${KEY}` };

  console.log("[1/3] fetching null sku rows (active, 7d)...");
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  let allRows: Array<{ pid: number; name: string; description_preview: string | null }> = [];

  // Apple/Samsung brand 패턴 매물만 — 빠르게 1000 rows 가져옴 (PostgREST max)
  const r = await fetch(
    `${URL_BASE}/mvp_raw_listings?select=pid,name,description_preview` +
    `&sku_id=is.null&listing_state=eq.active&first_seen_at=gte.${since}` +
    `&or=(name.ilike.*맥북*,name.ilike.*아이패드*,name.ilike.*아이폰*,name.ilike.*갤럭시*,name.ilike.*에어팟*,name.ilike.*ipad*,name.ilike.*iphone*,name.ilike.*galaxy*,name.ilike.*airpods*,name.ilike.*macbook*,name.ilike.*아이맥*,name.ilike.*imac*)` +
    `&order=first_seen_at.desc&limit=2000`,
    { headers: HDR },
  );
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  allRows = (await r.json()) as typeof allRows;
  console.log(`  → ${allRows.length} rows`);

  console.log("[2/3] re-classifying...");
  const changes: { pid: number; to: string }[] = [];
  const broadIds: Record<string, number> = {};
  for (const row of allRows) {
    const sku = ruleMatch(row.name ?? "", row.description_preview ?? "");
    if (sku) {
      changes.push({ pid: row.pid, to: sku.id });
      broadIds[sku.id] = (broadIds[sku.id] ?? 0) + 1;
    }
  }
  console.log(`  → ${changes.length} matched (${Math.round((changes.length / allRows.length) * 100)}%)`);
  console.log("  Top SKUs:");
  for (const [id, c] of Object.entries(broadIds).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`    ${c.toString().padStart(4)} : ${id}`);
  }

  if (changes.length === 0) {
    console.log("✅ no matches");
    return;
  }

  console.log("[3/3] updating raw_listings.sku_id (chunk 50)...");
  const CHUNK = 50;
  const byNewSku = new Map<string, number[]>();
  for (const c of changes) {
    const arr = byNewSku.get(c.to) ?? [];
    arr.push(c.pid);
    byNewSku.set(c.to, arr);
  }
  let done = 0;
  for (const [newSku, pids] of byNewSku.entries()) {
    for (let i = 0; i < pids.length; i += CHUNK) {
      const chunk = pids.slice(i, i + CHUNK);
      const pr = await fetch(
        `${URL_BASE}/mvp_raw_listings?pid=in.(${chunk.join(",")})`,
        {
          method: "PATCH",
          headers: { ...HDR, "content-type": "application/json", prefer: "return=minimal" },
          body: JSON.stringify({ sku_id: newSku, score_dirty: true }),
        },
      );
      if (!pr.ok) throw new Error(`${pr.status} ${await pr.text()}`);
      done += chunk.length;
      process.stdout.write(`\r  → ${done}/${changes.length}`);
    }
  }
  console.log("\n✅ done");
}
main().catch((e) => { console.error(e); process.exit(1); });
