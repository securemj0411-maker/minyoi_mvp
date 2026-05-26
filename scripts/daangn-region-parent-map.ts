// Wave 772 (2026-05-27): Daangn region_id → 시/구 부모 매핑 생성.
//   목적: DB에 동만 저장된 매물에 대해 UI render 시점에 "서울특별시 서초구 서초동" 같은 full path 노출.
//   결과물: src/lib/generated/daangn-region-parents.json
//
// 실행: DAANGN_REGIONS_FILE=/tmp/regions.json npx tsx scripts/daangn-region-parent-map.ts

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const OUT_PATH = path.resolve(__dirname, "../src/lib/generated/daangn-region-parents.json");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const RATE_LIMIT_MS = 350;

const PARENT_REGEX = /(서울특별시|경기도|인천광역시|부산광역시|대구광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|강원특별자치도|강원도|충청북도|충청남도|전라북도|전북특별자치도|전라남도|경상북도|경상남도|제주특별자치도)[ ㄱ-힣]{0,20}(구|시|군) [ㄱ-힣0-9.]+(동|읍|면|가|로)/;

async function fetchRegionPath(id: string, name: string): Promise<string | null> {
  const url = `https://www.daangn.com/kr/buy-sell?in=${encodeURIComponent(name)}-${id}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9" } });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(PARENT_REGEX);
    return match?.[0] ?? null;
  } catch {
    return null;
  }
}

async function main() {
  let regionsJson = "[]";
  const filePath = process.env.DAANGN_REGIONS_FILE;
  if (filePath && existsSync(filePath)) {
    regionsJson = readFileSync(filePath, "utf-8");
  } else if (process.env.DAANGN_REGIONS_JSON) {
    regionsJson = process.env.DAANGN_REGIONS_JSON;
  }
  const regions: Array<{ id: string; name: string }> = JSON.parse(regionsJson);
  if (regions.length === 0) {
    console.error("Set DAANGN_REGIONS_FILE or DAANGN_REGIONS_JSON.");
    process.exit(1);
  }

  let existing: Record<string, string> = {};
  if (existsSync(OUT_PATH)) {
    try { existing = JSON.parse(readFileSync(OUT_PATH, "utf-8")); } catch {}
  }

  const result: Record<string, string> = { ...existing };
  let success = 0, fail = 0;

  for (let i = 0; i < regions.length; i++) {
    const { id, name } = regions[i];
    if (existing[id]) continue;
    const fullPath = await fetchRegionPath(id, name);
    if (fullPath) {
      result[id] = fullPath;
      success++;
    } else {
      fail++;
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    if (i % 30 === 0 && i > 0) {
      const dir = path.dirname(OUT_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + "\n");
    }
  }

  const dir = path.dirname(OUT_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + "\n");
  console.log(`[summary] success=${success} fail=${fail} written=${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
