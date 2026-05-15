// Wave 117: iPhone 12/13 mini + SE + 17 시리즈 catalog 추가 후 null 매물 reclassify
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

async function main() {
  await loadEnv(path.join(appDir, ".env.local"));
  await loadEnv(path.join(appDir, ".env"));
  const URL_BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const HDR: Record<string, string> = { apikey: KEY, authorization: `Bearer ${KEY}` };

  console.log("[1/3] fetching iPhone null sku (14d)...");
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const r = await fetch(
    `${URL_BASE}/mvp_raw_listings?select=pid,name,description_preview,price` +
    `&sku_id=is.null&listing_state=eq.active&first_seen_at=gte.${since}` +
    `&or=(name.ilike.*아이폰*,name.ilike.*iphone*)` +
    `&order=first_seen_at.desc&limit=10000`,
    { headers: HDR },
  );
  const rows = (await r.json()) as Array<{ pid: number; name: string; description_preview: string | null; price: number }>;
  console.log(`  → ${rows.length} rows`);

  console.log("[2/3] re-classifying with Wave 117 catalog...");
  const changes: { pid: number; to: string }[] = [];
  const broadIds: Record<string, number> = {};
  for (const row of rows) {
    const sku = ruleMatch(row.name ?? "", row.description_preview ?? "");
    if (sku) {
      changes.push({ pid: row.pid, to: sku.id });
      broadIds[sku.id] = (broadIds[sku.id] ?? 0) + 1;
    }
  }
  console.log(`  → ${changes.length} matched (${Math.round((changes.length / rows.length) * 100)}%)`);
  for (const [id, c] of Object.entries(broadIds).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`    ${c.toString().padStart(4)} : ${id}`);
  }

  if (changes.length === 0) { console.log("✅ no matches"); return; }
  console.log("[3/3] updating raw_listings.sku_id...");
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
