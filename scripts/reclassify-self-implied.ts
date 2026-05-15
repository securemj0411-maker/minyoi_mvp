// Wave 115: 정상해지/확정기변 명시 매물 narrow lane 흡수 (broad → self narrow)
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

  console.log("[1/3] fetching broad matter with 정상해지/확정기변 markers...");
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const broadSkus = [
    "iphone-13-pro", "iphone-14-pro", "iphone-15-pro", "iphone-16-pro",
    "iphone-15-pro-max", "iphone-16-pro-max",
    "iphone-14", "iphone-15", "iphone-16",
    "galaxy-s23", "galaxy-s24", "galaxy-s25",
    "galaxy-s23-ultra", "galaxy-s24-ultra", "galaxy-s25-ultra",
  ];
  const skuFilter = broadSkus.map(s => `sku_id.eq.${s}`).join(",");
  const r = await fetch(
    `${URL_BASE}/mvp_raw_listings?select=pid,name,description_preview,sku_id` +
    `&or=(${skuFilter})&listing_state=eq.active&first_seen_at=gte.${since}` +
    `&or=(name.ilike.*정상해지*,name.ilike.*확정기변*,description_preview.ilike.*정상해지*,description_preview.ilike.*확정기변*)` +
    `&limit=1000`,
    { headers: HDR },
  );
  const rows = (await r.json()) as Array<{ pid: number; name: string; description_preview: string | null; sku_id: string }>;
  console.log(`  → ${rows.length} rows`);

  console.log("[2/3] re-evaluating with new self tokens...");
  const changes: { pid: number; from: string; to: string }[] = [];
  for (const row of rows) {
    const sku = ruleMatch(row.name ?? "", row.description_preview ?? "");
    if (sku && sku.id !== row.sku_id) {
      changes.push({ pid: row.pid, from: row.sku_id, to: sku.id });
    }
  }
  console.log(`  → ${changes.length} reassigned`);
  const fromTo: Record<string, number> = {};
  for (const c of changes) {
    const k = `${c.from} → ${c.to}`;
    fromTo[k] = (fromTo[k] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(fromTo).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${v.toString().padStart(4)} : ${k}`);
  }
  if (changes.length === 0) { console.log("✅ no reassignments"); return; }

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
