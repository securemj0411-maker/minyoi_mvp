// Wave 761 (2026-05-26): 비수도권 region 발견 v2.
//   v1 brute scan 의 dbId regex 가 outdated. 새 시도: regionIdFromURL 매칭.
//   id=5000 valid 확인됨 → 4000-9999 range 의 다른 region 존재 가능성.
//
// 사용: tsx scripts/daangn-region-discover-v2.ts <start> <end>

import { fetchDaangnText, type DaangnRegionSeed } from "../src/lib/daangn";

const args = process.argv.slice(2);
const RANGE_START = Number(args[0] ?? "4204");
const RANGE_END = Number(args[1] ?? "9999");
const BATCH_SIZE = Number(args[2] ?? "5");
const DELAY_MS = Number(args[3] ?? "800");

function extractRegion(html: string, expectId: string): DaangnRegionSeed | null {
  // 정확 검출 v3: urlId 검사 폐기 (3000/3500 같은 valid region 이 urlId 누락 case 있음).
  // 진짜 valid signal: nearby region 링크에 self (in={name}-{expectId}) 포함 여부.
  // 무효 id 페이지 = nearby 0 또는 self 매치 없음. valid 면 self link 있음.
  const nearbyMatches = html.match(/in=%[A-F0-9%]+-\d{1,7}/g) ?? [];
  if (nearbyMatches.length < 3) return null;
  for (const m of nearbyMatches) {
    const idMatch = m.match(/-(\d+)$/);
    if (idMatch && idMatch[1] === expectId) {
      const namePart = m.slice(3, m.lastIndexOf("-"));
      try {
        const decoded = decodeURIComponent(namePart);
        if (decoded && /^[가-힣]/.test(decoded)) return { id: expectId, name: decoded };
      } catch { /* skip */ }
    }
  }
  return null;
}

async function scanOne(id: number): Promise<DaangnRegionSeed | null> {
  const url = `https://www.daangn.com/kr/buy-sell/?in=t-${id}&search=%EB%85%B8%ED%8A%B8%EB%B6%81`;
  try {
    const resp = await fetchDaangnText(url, 8_000);
    if (!resp.ok) return null;
    if (resp.blockSignal.blocked) {
      process.stderr.write(`\n[BLOCK] ${resp.blockSignal.reason}\n`);
      throw new Error("BLOCKED");
    }
    return extractRegion(resp.body, String(id));
  } catch (err) {
    if ((err as Error).message === "BLOCKED") throw err;
    return null;
  }
}

async function main() {
  const found: DaangnRegionSeed[] = [];
  const total = RANGE_END - RANGE_START + 1;
  let scanned = 0;
  let lastReport = Date.now();

  process.stderr.write(`=== discover v2 id=${RANGE_START}..${RANGE_END}, batch=${BATCH_SIZE} ===\n`);

  for (let base = RANGE_START; base <= RANGE_END; base += BATCH_SIZE) {
    const batch: number[] = [];
    for (let i = 0; i < BATCH_SIZE && base + i <= RANGE_END; i += 1) {
      batch.push(base + i);
    }
    const results = await Promise.all(batch.map((id) => scanOne(id)));
    for (const r of results) {
      if (r) found.push(r);
    }
    scanned += batch.length;
    if (Date.now() - lastReport > 2500) {
      process.stderr.write(`  scanned ${scanned}/${total}, found ${found.length}\n`);
      lastReport = Date.now();
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  process.stderr.write(`\n=== DONE — ${found.length} regions ===\n\n`);
  // sort by id
  found.sort((a, b) => Number(a.id) - Number(b.id));
  // 출력: 한 줄당 1개
  for (const r of found) {
    console.log(`  { id: "${r.id}", name: "${r.name}" },`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
