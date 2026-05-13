import fs from "node:fs";
import path from "node:path";

type ParsedRow = {
  pid: number;
  category: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
};

type RawRow = {
  pid: number;
  name: string;
  price: number;
  sku_id: string | null;
  sku_name: string | null;
  listing_state: string | null;
  sale_status: string | null;
  last_seen_at: string | null;
  detail_status: string | null;
  listing_type: string | null;
};

const appDir = process.cwd();
const reportDir = path.join(appDir, "reports");
const mdPath = path.join(reportDir, "ai-l2-tiny-escrow-candidates-latest.md");
const jsonPath = path.join(reportDir, "ai-l2-tiny-escrow-candidates-latest.json");
const pageSize = 1000;

const categoryPriority = new Map([
  ["smartphone", 1],
  ["tablet", 2],
  ["laptop", 3],
  ["smartwatch", 4],
  ["earphone", 5],
  ["monitor", 6],
]);

async function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function restBase() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL is not configured");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

async function restJson<T>(pathAndQuery: string): Promise<T[]> {
  const res = await fetch(`${restBase()}${pathAndQuery}`, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase REST failed ${res.status}: ${await res.text()}`);
  return await res.json() as T[];
}

async function fetchAll<T>(pathAndQuery: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const joiner = pathAndQuery.includes("?") ? "&" : "?";
    const page = await restJson<T>(`${pathAndQuery}${joiner}limit=${pageSize}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function parsedJson(row: ParsedRow) {
  const value = row.parsed_json;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function unknownParts(row: ParsedRow) {
  const fromJson = stringArray(parsedJson(row).unknown_parts);
  if (fromJson.length > 0) return fromJson;
  return row.comparable_key?.split("|").filter((part) => part.startsWith("unknown_")) ?? [];
}

function criticalUnknownParts(row: ParsedRow) {
  return stringArray(parsedJson(row).critical_unknown);
}

function reason(row: ParsedRow) {
  const unknown = unknownParts(row);
  const critical = criticalUnknownParts(row);
  if (critical.length > 0) return "parser_critical_unknown";
  if (unknown.some((part) => /connectivity|carrier/.test(part))) return "connectivity_ambiguity";
  if (unknown.some((part) => /generation|gen/.test(part))) return "generation_ambiguity";
  if (unknown.length > 0) return "parser_unknown_option";
  return "option_needs_review";
}

function isActiveRaw(row: RawRow | undefined) {
  if (!row) return false;
  if (row.detail_status !== "done") return false;
  if (row.listing_type !== "normal") return false;
  if (row.listing_state && row.listing_state !== "active") return false;
  if (row.sale_status && !["", "SELLING", "판매중", "active"].includes(row.sale_status)) return false;
  return Boolean(row.sku_id);
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function top(map: Map<string, number>) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, count }));
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  fs.mkdirSync(reportDir, { recursive: true });

  const cap = Math.max(1, Number(process.env.AI_L2_ESCROW_DRY_RUN_CAP ?? 100));
  const [parsedRows, rawRows] = await Promise.all([
    fetchAll<ParsedRow>("/mvp_listing_parsed?select=pid,category,comparable_key,parse_confidence,needs_review,parsed_json&needs_review=eq.true"),
    fetchAll<RawRow>("/mvp_raw_listings?select=pid,name,price,sku_id,sku_name,listing_state,sale_status,last_seen_at,detail_status,listing_type&detail_status=eq.done&listing_type=eq.normal"),
  ]);
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const categoryCounts = new Map<string, number>();
  const reasonCounts = new Map<string, number>();

  const eligible = parsedRows
    .map((parsed) => {
      const raw = rawByPid.get(Number(parsed.pid));
      const category = parsed.category ?? "unknown";
      const r = reason(parsed);
      const isEligible = isActiveRaw(raw)
        && category !== "unknown"
        && Boolean(parsed.comparable_key)
        && Boolean(raw?.sku_id);
      if (isEligible) {
        increment(categoryCounts, category);
        increment(reasonCounts, r);
      }
      return {
        pid: Number(parsed.pid),
        category,
        reason: r,
        unknownParts: unknownParts(parsed),
        criticalUnknown: criticalUnknownParts(parsed),
        comparableKey: parsed.comparable_key,
        parseConfidence: parsed.parse_confidence,
        title: raw?.name ?? "",
        price: raw?.price ?? null,
        skuId: raw?.sku_id ?? null,
        skuName: raw?.sku_name ?? null,
        lastSeenAt: raw?.last_seen_at ?? null,
        eligible: isEligible,
      };
    })
    .filter((row) => row.eligible)
    .sort((a, b) => {
      const cat = (categoryPriority.get(a.category) ?? 99) - (categoryPriority.get(b.category) ?? 99);
      if (cat !== 0) return cat;
      const seen = String(b.lastSeenAt ?? "").localeCompare(String(a.lastSeenAt ?? ""));
      if (seen !== 0) return seen;
      return b.price == null || a.price == null ? 0 : b.price - a.price;
    });

  const selected = eligible.slice(0, cap);
  const generatedAt = new Date().toISOString();
  const summary = {
    generatedAt,
    mode: "candidate_selection_dry_run_no_ai_no_db_mutation",
    counts: {
      needsReviewParsedRows: parsedRows.length,
      rawDoneNormalRows: rawRows.length,
      eligibleEscrowRows: eligible.length,
      selectedTinyCapRows: selected.length,
      cap,
    },
    categoryCounts: top(categoryCounts),
    reasonCounts: top(reasonCounts),
    selected,
    decision: {
      canProceedToRuntime: false,
      blocker: "FK migration approval is still required before needs_review escrow cache writes.",
      next: "After FK approval, wire this eligibility predicate with a tiny cap and keep pool-policy hard blocks.",
    },
  };

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  const md = [
    "# AI L2 Tiny Escrow Candidates",
    "",
    `Generated: ${generatedAt}`,
    "",
    "No AI calls, DB mutations, DDL, public promotion, or candidate-pool changes were made.",
    "",
    "## Counts",
    "",
    mdTable(["Metric", "Value"], Object.entries(summary.counts).map(([key, value]) => [key, value])),
    "",
    "## Eligible Categories",
    "",
    mdTable(["Category", "Rows"], summary.categoryCounts.map((row) => [row.key, row.count])),
    "",
    "## Eligible Reasons",
    "",
    mdTable(["Reason", "Rows"], summary.reasonCounts.map((row) => [row.key, row.count])),
    "",
    "## Selected Tiny Cap Preview",
    "",
    mdTable(
      ["pid", "category", "reason", "sku", "price", "title"],
      selected.slice(0, 30).map((row) => [row.pid, row.category, row.reason, row.skuId, row.price, row.title.slice(0, 80)]),
    ),
    "",
    "## Decision",
    "",
    `- Can proceed to runtime: ${summary.decision.canProceedToRuntime}`,
    `- Blocker: ${summary.decision.blocker}`,
    `- Next: ${summary.decision.next}`,
    "",
  ].join("\n");
  fs.writeFileSync(mdPath, md);
  console.log(`wrote ${mdPath}`);
  console.log(`wrote ${jsonPath}`);
  console.table(summary.counts);
  console.table(summary.categoryCounts);
  console.table(summary.reasonCounts);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
