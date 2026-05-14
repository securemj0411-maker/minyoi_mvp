// Wave 95: 사기 매물 패턴 broader audit.
// Wave 94에서 "전문사기조직" 1건 발견. 다른 카테고리/SKU에 비슷한 패턴 있는지 sweep.
// raw_listings DB 직접 조회 — 사용자에게 노출되는 매물 안에서 사기 의심 패턴 검색.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

const FRAUD_PATTERNS = [
  // 직접 사기 키워드
  { key: "fraud_org", regex: /전문사기조직|사기조직|사기\s*신고|사기\s*경고|사기꾼/i },
  { key: "fraud_warning", regex: /사기\s*당함|사기\s*당했|먹튀|먹튀\s*조심|업자\s*x/i },
  // 신뢰 anxiety (정직한 셀러라면 안 적는 표현)
  { key: "trust_anxiety", regex: /진짜\s*정품|100%\s*정품|정품\s*맞아요|정품인증|확실한\s*정품/i },
  // 가품 직접 표현
  { key: "fake_direct", regex: /이미테이션|레플리카|복각품|복제품|가품\s*있음|st급/i },
  // 의심 거래 표현
  { key: "suspicious_trade", regex: /선입금|선결제\s*환불\s*불가|환불\s*불가\s*명시|반품\s*불가\s*명시/i },
  // 가격 anchor 의심
  { key: "abnormal_low", regex: /파격\s*가격|반값|반의\s*반값|급처분|폐업\s*세일/ },
  // 도난 의심 (자전거 / 명품)
  { key: "stolen_suspect", regex: /시리얼\s*없음|영수증\s*없음|구매\s*경로\s*불명|선물\s*받은\s*제품/ },
];

type Row = { pid: number; name: string; sku_id: string | null; price: number; listing_state: string };

async function main() {
  console.log("Wave 95 사기/이상 매물 패턴 broader audit");
  console.log("최근 7일 raw_listings 전체 search\n");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const PAGE = 1000;
  const MAX = 100_000;
  const allRows: Row[] = [];
  for (let offset = 0; offset < MAX; offset += PAGE) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,sku_id,price,listing_state&first_seen_at=gte.${encodeURIComponent(since)}&order=first_seen_at.desc&offset=${offset}&limit=${PAGE}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    const chunk = (await res.json()) as Row[];
    allRows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  console.log(`scanned: ${allRows.length} rows (7d)\n`);

  const matchesByPattern = new Map<string, Row[]>();
  for (const row of allRows) {
    for (const p of FRAUD_PATTERNS) {
      if (p.regex.test(row.name)) {
        const list = matchesByPattern.get(p.key) ?? [];
        list.push(row);
        matchesByPattern.set(p.key, list);
      }
    }
  }

  console.log("=== 패턴별 매칭 ===");
  const summary: Array<{ pattern: string; count: number; assigned_sku_count: number; samples: Array<{ pid: number; name: string; sku_id: string | null; price: number }> }> = [];
  for (const p of FRAUD_PATTERNS) {
    const matches = matchesByPattern.get(p.key) ?? [];
    const assignedCount = matches.filter((r) => r.sku_id != null).length;
    console.log(`\n[${p.key}] ${matches.length}건 (sku_id 배정: ${assignedCount}건)`);
    const top = matches.slice(0, 5);
    for (const r of top) {
      const skuLabel = r.sku_id ? `[${r.sku_id}]` : "[no_sku]";
      console.log(`  ${skuLabel} ₩${r.price.toLocaleString()} "${r.name.slice(0, 65)}"`);
    }
    summary.push({
      pattern: p.key,
      count: matches.length,
      assigned_sku_count: assignedCount,
      samples: top.map((r) => ({ pid: r.pid, name: r.name, sku_id: r.sku_id, price: r.price })),
    });
  }

  // sku_id가 배정된 사기 의심 매물 — 사용자 노출 risk
  console.log("\n=== 🚨 sku_id 배정된 사기 의심 매물 (사용자 노출 risk) ===");
  const dangerous = allRows.filter((r) => r.sku_id != null && FRAUD_PATTERNS.some((p) => p.regex.test(r.name)));
  console.log(`총 ${dangerous.length}건`);
  const byCategory = new Map<string, number>();
  for (const r of dangerous.slice(0, 30)) {
    const matched = FRAUD_PATTERNS.find((p) => p.regex.test(r.name));
    console.log(`  [${matched?.key}] [${r.sku_id}] ₩${r.price.toLocaleString()} "${r.name.slice(0, 60)}"`);
  }
  for (const r of dangerous) {
    const cat = r.sku_id?.split("-")[0] ?? "unknown";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
  }
  console.log("\nSKU prefix별 분포:");
  for (const [cat, n] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${n}건`);
  }

  await writeFile(
    path.join(appDir, "reports/wave95-fraud-broader-audit-latest.json"),
    JSON.stringify({
      wave: 95,
      measured_at: new Date().toISOString(),
      scanned_rows: allRows.length,
      total_matches: dangerous.length,
      patterns: summary,
      dangerous_with_sku: dangerous.slice(0, 100),
    }, null, 2),
  );
  console.log("\n→ reports/wave95-fraud-broader-audit-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
