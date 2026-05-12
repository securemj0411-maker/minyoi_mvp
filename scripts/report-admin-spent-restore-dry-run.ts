import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDetail } from "@/lib/bunjang";
import { classifyListing } from "@/lib/pipeline";
import { detectSoldOut, describeSignals, isSoldOut } from "@/lib/sold-out";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const ADMIN_EMAILS = new Set([
  "danshinadarina@gmail.com",
  "mj1270411@gmail.com",
  "mj12270411@gmail.com",
]);

type AuthUser = {
  id: string;
  email: string | null;
};

type PackOpenRow = {
  user_ref: string;
  band_requested: number;
  result: string;
  tokens_spent: number | null;
  tokens_refunded: number | null;
  revealed_pids: number[] | null;
  opened_at: string;
};

type PoolRow = {
  pid: number;
  profit_band: number;
  status: string;
  exposure_count: number | null;
  max_exposure: number | null;
  invalidated_reason: string | null;
  updated_at: string | null;
};

type ListingRow = {
  pid: number;
  name: string | null;
  price: number | null;
  url: string | null;
  sku_name: string | null;
};

type RevealRow = {
  user_ref: string;
  pid: number;
  revealed_at: string;
};

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
  } catch {
    // optional env file
  }
}

function supabaseBaseUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL required");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

async function restJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${supabaseBaseUrl()}/rest/v1${pathname}`, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function authUsers(): Promise<AuthUser[]> {
  const res = await fetch(`${supabaseBaseUrl()}/auth/v1/admin/users?per_page=100&page=1`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) throw new Error(`/auth/v1/admin/users ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { users?: AuthUser[] };
  return json.users ?? [];
}

function inFilter(ids: number[]) {
  return ids.join(",");
}

function compact(text: unknown, limit = 64) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function table(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
await loadEnvFile(path.join(appDir, ".env.local"));
await loadEnvFile(path.join(appDir, ".env"));

const generatedAt = new Date().toISOString();
const users = await authUsers();
const adminUserRefs = new Map<string, string>();
for (const user of users) {
  const email = user.email?.trim().toLowerCase();
  if (email && ADMIN_EMAILS.has(email)) adminUserRefs.set(`auth:${user.id}`, email);
}

const adminRefFilter = [...adminUserRefs.keys()].map(encodeURIComponent).join(",");
const packOpenRows = adminRefFilter
  ? await restJson<PackOpenRow[]>(
      `/mvp_pack_opens?select=user_ref,band_requested,result,tokens_spent,tokens_refunded,revealed_pids,opened_at&user_ref=in.(${adminRefFilter})&band_requested=eq.3&result=eq.success&order=opened_at.desc&limit=200`,
    )
  : [];

const candidatePids = [...new Set(packOpenRows.flatMap((row) => row.revealed_pids ?? []))].filter((pid) => Number.isFinite(pid));
const poolRows = candidatePids.length
  ? await restJson<PoolRow[]>(
      `/mvp_candidate_pool?select=pid,profit_band,status,exposure_count,max_exposure,invalidated_reason,updated_at&pid=in.(${inFilter(candidatePids)})&limit=1000`,
    )
  : [];
const listingRows = candidatePids.length
  ? await restJson<ListingRow[]>(
      `/mvp_listings?select=pid,name,price,url,sku_name&pid=in.(${inFilter(candidatePids)})&limit=1000`,
    )
  : [];
const revealRows = candidatePids.length
  ? await restJson<RevealRow[]>(
      `/mvp_pack_reveals?select=user_ref,pid,revealed_at&pid=in.(${inFilter(candidatePids)})&limit=5000`,
    )
  : [];

const poolByPid = new Map(poolRows.map((row) => [row.pid, row]));
const listingByPid = new Map(listingRows.map((row) => [row.pid, row]));
const revealsByPid = new Map<number, RevealRow[]>();
for (const row of revealRows) {
  const list = revealsByPid.get(row.pid) ?? [];
  list.push(row);
  revealsByPid.set(row.pid, list);
}

const rows = [];
for (const pid of candidatePids) {
  const pool = poolByPid.get(pid);
  const listing = listingByPid.get(pid);
  const reveals = revealsByPid.get(pid) ?? [];
  const nonAdminReveals = reveals.filter((row) => !adminUserRefs.has(row.user_ref));
  const adminReveals = reveals.filter((row) => adminUserRefs.has(row.user_ref));
  let decision:
    | "restore_candidate"
    | "hold_non_admin_revealed"
    | "hold_missing_pool"
    | "hold_not_spent"
    | "hold_invalidated"
    | "hold_not_band3";
  let reason: string;
  if (!pool) {
    decision = "hold_missing_pool";
    reason = "candidate pool row 없음";
  } else if (pool.profit_band !== 3) {
    decision = "hold_not_band3";
    reason = `band=${pool.profit_band}`;
  } else if (nonAdminReveals.length > 0) {
    decision = "hold_non_admin_revealed";
    reason = "일반/비운영자에게 이미 공개됨";
  } else if (pool.status === "invalidated") {
    decision = "hold_invalidated";
    reason = pool.invalidated_reason ?? "invalidated";
  } else if (pool.status !== "spent") {
    decision = "hold_not_spent";
    reason = `status=${pool.status}`;
  } else {
    decision = "restore_candidate";
    reason = "운영자에게만 공개된 band3 spent row";
  }
  let liveDecision = "not_checked";
  let liveReason = "not restore candidate";
  if (decision === "restore_candidate" && listing) {
    await sleep(120);
    try {
      const detail = await fetchDetail(String(pid));
      const signals = detectSoldOut(detail, listing.price, { title: listing.name });
      if (isSoldOut(signals)) {
        liveDecision = "hold_live_sold";
        liveReason = describeSignals(signals);
      } else {
        const liveType = classifyListing(listing.name ?? "", detail?.description ?? "", listing.price ?? 0).listingType;
        if (liveType === "normal") {
          liveDecision = "restore_live_candidate";
          liveReason = "live detail normal";
        } else {
          liveDecision = `hold_live_type_${liveType}`;
          liveReason = "runtime classifier rejected live detail";
        }
      }
    } catch (error) {
      liveDecision = "hold_live_error";
      liveReason = error instanceof Error ? error.message.slice(0, 140) : String(error).slice(0, 140);
    }
  }
  rows.push({
    pid,
    decision,
    reason,
    liveDecision,
    liveReason,
    status: pool?.status ?? null,
    exposureCount: pool?.exposure_count ?? null,
    maxExposure: pool?.max_exposure ?? null,
    updatedAt: pool?.updated_at ?? null,
        name: listing?.name ?? null,
    price: listing?.price ?? null,
    skuName: listing?.sku_name ?? null,
    adminRevealCount: adminReveals.length,
    nonAdminRevealCount: nonAdminReveals.length,
    adminEmails: [...new Set(adminReveals.map((row) => adminUserRefs.get(row.user_ref) ?? row.user_ref))],
  });
}

const report = {
  generatedAt,
  scope: "band3 spent rows consumed by admin pack opens",
  adminUserRefs: Object.fromEntries(adminUserRefs),
  packOpenRows: packOpenRows.map((row) => ({
    ...row,
    adminEmail: adminUserRefs.get(row.user_ref) ?? null,
    revealedCount: row.revealed_pids?.length ?? 0,
  })),
  summary: {
    adminBand3SuccessOpens: packOpenRows.length,
    distinctCandidatePids: candidatePids.length,
    decisions: countBy(rows, (row) => row.decision),
    liveDecisions: countBy(rows, (row) => row.liveDecision),
  },
  rows,
  restorePlan: {
    mutationApplied: false,
    recommendedPatch:
      "Only rows with decision=restore_candidate and liveDecision=restore_live_candidate should be restored by setting status='ready', exposure_count=0, reserved_by=null, reserved_until=null.",
  },
};

await mkdir(reportsDir, { recursive: true });
const jsonPath = path.join(reportsDir, "admin-spent-restore-dry-run-latest.json");
const mdPath = path.join(reportsDir, "admin-spent-restore-dry-run-latest.md");
await writeFile(jsonPath, JSON.stringify(report, null, 2));

const md = `# Admin Spent Restore Dry Run

- generatedAt: ${generatedAt}
- scope: 운영자 계정이 프리미엄 후보팩에서 공개해 spent 된 후보 복구 후보 분리
- mutationApplied: false

## Summary

${table(
  ["metric", "value"],
  [
    ["admin band3 success opens", report.summary.adminBand3SuccessOpens],
    ["distinct candidate pids", report.summary.distinctCandidatePids],
    ...Object.entries(report.summary.decisions).map(([key, value]) => [key, value]),
    ...Object.entries(report.summary.liveDecisions).map(([key, value]) => [`live:${key}`, value]),
  ],
)}

## Admin Opens

${table(
  ["opened_at", "admin", "tokens", "revealed"],
  report.packOpenRows.map((row) => [
    row.opened_at,
    row.adminEmail,
    `${row.tokens_spent ?? 0}/${row.tokens_refunded ?? 0}`,
    row.revealedCount,
  ]),
)}

## Restore Candidates

${table(
  ["decision", "live", "pid", "status", "exp", "admin", "nonAdmin", "price", "name"],
  rows.map((row) => [
    row.decision,
    row.liveDecision,
    row.pid,
    row.status,
    `${row.exposureCount ?? "-"} / ${row.maxExposure ?? "-"}`,
    row.adminRevealCount,
    row.nonAdminRevealCount,
    row.price ?? "",
    compact(row.name),
  ]),
)}

## Next

- \`restore_candidate\` + \`restore_live_candidate\`만 복구 대상으로 본다.
- \`hold_non_admin_revealed\`는 실제 유저 공개 이력이 있으므로 복구 금지.
- live verify에서 sold/type/error가 난 row는 복구하지 않는다.
`;

await writeFile(mdPath, `${md}\n`);

console.log(JSON.stringify({
  generatedAt,
  jsonPath,
  mdPath,
  summary: report.summary,
}, null, 2));

}
