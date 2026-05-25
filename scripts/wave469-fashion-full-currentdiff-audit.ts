import { readFile } from "node:fs/promises";
import { ruleMatch } from "../src/lib/catalog";

type RawRow = { pid: number; name: string | null; sku_id: string | null; description_preview: string | null; price: number | null };
type Group = { sku: string; count: number; currentDiff: number; nullNow: number; examples: Array<{ pid: number; title: string | null; price: number | null; current: string | null }> };

async function loadEnv(path: string) {
  try {
    const raw = await readFile(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}

function restBase() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw) throw new Error("SUPABASE_URL missing");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return { apikey: key, authorization: `Bearer ${key}` };
}

async function fetchPage(offset: number, limit: number) {
  const response = await fetch(
    `${restBase()}/mvp_raw_listings?select=pid,name,sku_id,description_preview,price` +
      `&listing_state=eq.active&or=(sku_id.like.clothing-%25,sku_id.like.bag-%25)&order=sku_id.asc,pid.asc&offset=${offset}&limit=${limit}`,
    { headers: headers() },
  );
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return (await response.json()) as RawRow[];
}

async function main() {
  await loadEnv(".env.local");
  await loadEnv(".env");
  const groups = new Map<string, Group>();
  const limit = Number(process.env.PAGE_LIMIT ?? "500");
  const maxRows = Number(process.env.MAX_ROWS ?? "5000");
  let offset = Number(process.env.START_OFFSET ?? "0");
  let scanned = 0;
  while (scanned < maxRows) {
    const rows = await fetchPage(offset, limit);
    if (rows.length === 0) break;
    for (const row of rows.slice(0, Math.max(0, maxRows - scanned))) {
      if (!row.sku_id) continue;
      const group = groups.get(row.sku_id) ?? { sku: row.sku_id, count: 0, currentDiff: 0, nullNow: 0, examples: [] };
      group.count += 1;
      const current = ruleMatch(row.name ?? "", row.description_preview ?? "");
      if ((current?.id ?? null) !== row.sku_id) {
        group.currentDiff += 1;
        if (!current) group.nullNow += 1;
        if (group.examples.length < 20) group.examples.push({ pid: row.pid, title: row.name, price: row.price, current: current?.id ?? null });
      }
      groups.set(row.sku_id, group);
    }
    scanned += Math.min(rows.length, maxRows - scanned);
    console.error(`[wave469 fashion audit] offset=${offset} scanned=${scanned}`);
    if (rows.length < limit) break;
    offset += limit;
  }
  const ranked = [...groups.values()].filter((g) => g.currentDiff > 0).sort((a, b) => b.currentDiff - a.currentDiff || b.count - a.count).slice(0, 50);
  console.log(JSON.stringify({ scanned, groupsWithDiff: ranked.length, ranked }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
