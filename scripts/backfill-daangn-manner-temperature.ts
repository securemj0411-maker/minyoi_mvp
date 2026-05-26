// Wave 758 (2026-05-26): 기존 풀 ready daangn 매물 매너온도 backfill.
//
// 흐름:
//   1. mvp_candidate_pool status=ready ∩ raw_listings source=daangn ∩ daangn_manner_temperature IS NULL pids
//   2. 각 pid 의 url 에서 detail HTML fetch
//   3. parseDaangnDetailHtml → user.score, user.reviewCount
//   4. UPDATE daangn_manner_temperature + daangn_review_count
//
// 사용:
//   tsx scripts/backfill-daangn-manner-temperature.ts [--limit N] [--dry-run]
//
// 환경:
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요 (rest-pure path)
//
// rate limit: 매물 간 800ms sleep (당근 측 부담 최소화)

import { fetchDaangnText, parseDaangnDetailHtml } from "../src/lib/daangn";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ENV missing: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필수.");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1] ?? "0") : 0;

function headers() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function fetchCandidates(): Promise<Array<{ pid: number; url: string }>> {
  // 풀 ready 먼저 가져옴 (~700)
  const poolRes = await fetch(
    `${SUPABASE_URL}/rest/v1/mvp_candidate_pool?select=pid&status=eq.ready&limit=5000`,
    { headers: headers() },
  );
  const poolRows = await poolRes.json() as Array<{ pid: number }>;
  const poolPids = poolRows.map((r) => Number(r.pid));
  if (poolPids.length === 0) return [];

  // chunk 로 raw_listings 좁힘 + daangn + manner_temp NULL
  const candidates: Array<{ pid: number; url: string }> = [];
  for (let i = 0; i < poolPids.length; i += 500) {
    const chunk = poolPids.slice(i, i + 500);
    const rawRes = await fetch(
      `${SUPABASE_URL}/rest/v1/mvp_raw_listings?select=pid,url,daangn_manner_temperature&source=eq.daangn&pid=in.(${chunk.join(",")})`,
      { headers: headers() },
    );
    const rawRows = await rawRes.json() as Array<{ pid: number; url: string | null; daangn_manner_temperature: number | null }>;
    for (const row of rawRows) {
      if (row.daangn_manner_temperature != null) continue; // 이미 박힌 row skip
      if (!row.url) continue;
      candidates.push({ pid: Number(row.pid), url: row.url });
    }
  }
  return candidates;
}

async function patchMannerTemp(pid: number, mannerTemp: number | null, reviewCount: number | null) {
  if (isDryRun) {
    console.log(`[dry-run] pid=${pid} manner=${mannerTemp}°C reviews=${reviewCount}`);
    return;
  }
  const body = {
    daangn_manner_temperature: mannerTemp,
    daangn_review_count: reviewCount,
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mvp_raw_listings?pid=eq.${pid}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.warn(`[patch fail] pid=${pid} status=${res.status}`);
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`[start] dryRun=${isDryRun} limit=${limit || "all"}`);
  const candidates = await fetchCandidates();
  const targets = limit > 0 ? candidates.slice(0, limit) : candidates;
  console.log(`[targets] ${targets.length} pids to backfill`);

  let success = 0;
  let nullScore = 0;
  let fetchFail = 0;
  let parseFail = 0;
  for (let i = 0; i < targets.length; i += 1) {
    const { pid, url } = targets[i];
    process.stdout.write(`[${i + 1}/${targets.length}] pid=${pid} ... `);
    try {
      const fetched = await fetchDaangnText(url, 8_000);
      if (!fetched.ok) {
        fetchFail += 1;
        console.log(`FETCH_FAIL status=${fetched.status}`);
        await sleep(800);
        continue;
      }
      const parsed = parseDaangnDetailHtml(fetched.body);
      if (!parsed) {
        parseFail += 1;
        console.log(`PARSE_FAIL`);
        await sleep(800);
        continue;
      }
      const score = parsed.user.score;
      const reviewCount = parsed.user.reviewCount;
      if (score == null) {
        nullScore += 1;
        console.log(`NULL_SCORE`);
        await sleep(800);
        continue;
      }
      await patchMannerTemp(pid, score, reviewCount);
      success += 1;
      console.log(`OK manner=${score}°C reviews=${reviewCount}`);
    } catch (err) {
      fetchFail += 1;
      console.log(`ERR ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(800);
  }

  console.log(`\n[summary] success=${success} nullScore=${nullScore} fetchFail=${fetchFail} parseFail=${parseFail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
