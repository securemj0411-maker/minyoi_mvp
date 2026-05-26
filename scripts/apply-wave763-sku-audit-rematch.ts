/**
 * Wave 763 — SKU audit 후속 rematch trigger
 *
 * 폭넓은 분류 audit (2026-05-27) 결과 7 개 SKU 에서 잘못된 매칭 발견.
 * Catalog 코드 변경 없이 rematch 만 필요한 SKU 와, catalog 변경 + rematch
 * 필요한 SKU 가 섞여있음.
 *
 * 사용법:
 *   - dry run 측정: npx tsx scripts/apply-wave763-sku-audit-rematch.ts --phase=2
 *   - 실제 적용:    npx tsx scripts/apply-wave763-sku-audit-rematch.ts --phase=2 --apply
 *   - phase=all 로 7 개 SKU 한 번에 trigger 도 가능 (catalog 변경 후 호출 권장).
 *
 * Baseline snapshot: _audit_skus_baseline_20260527 (3,819 매물).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { triggerRematchForSkus } from "../src/lib/rematch-helpers";

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      process.env[key] ??= rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // optional
  }
}

const PHASE_2_SKUS = [
  // Catalog 이미 fix (mustNotContain 박혀있음) — rematch trigger 만 필요
  "airpods-max", // line 5961~5970 에 "맥스2", "2세대", "usbc", "c핀" 등 박힘 → 77 건 즉시 2세대 SKU 로 이동
  "shoe-yeezy-boost-500-700", // 잔류 4 건 — 이미 split SKU 운영 중
];

const PHASE_3_SKUS = [
  // Catalog mustNotContain 추가 후 rematch — 비-Ralph false-positive 흡수 해소
  "clothing-polo-pique-classic",
  "clothing-polo-pony-tee",
  "clothing-polo-knit-sweater",
];

const PHASE_4_SKUS = [
  // Catalog modelName split / sku_name 정리 후 rematch
  "clothing-adidas-trefoil",
  "shoe-newbalance-kith-collab", // stale (catalog 정의 X) — 다음 ruleMatch 시 narrow SKU 또는 null 로 reroute
  "watch-seiko-broad",
  "clothing-polo-knit-sweater", // stale (catalog 정의 X) — knit 매물은 polo-rrl-knit 또는 null 로 reroute
];

const REASON = "wave763-sku-audit-rematch";

async function main() {
  const appDir = process.cwd();
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const phaseArg = args.find((a) => a.startsWith("--phase="))?.split("=")[1] ?? "2";

  let skus: string[];
  switch (phaseArg) {
    case "2":
      skus = PHASE_2_SKUS;
      break;
    case "3":
      skus = PHASE_3_SKUS;
      break;
    case "4":
      skus = PHASE_4_SKUS;
      break;
    case "all":
      skus = [...PHASE_2_SKUS, ...PHASE_3_SKUS, ...PHASE_4_SKUS];
      break;
    default:
      console.error("[wave763] invalid --phase=", phaseArg, "(use 2/3/4/all)");
      process.exit(1);
  }

  console.log("[wave763] starting rematch", { phase: phaseArg, skus, apply });

  const result = await triggerRematchForSkus(skus, `${REASON}-phase${phaseArg}`, {
    dryRun: !apply,
    resetDetailStatus: true,
  });

  console.log("[wave763] result", result);
  console.log(apply ? "[wave763] APPLIED" : "[wave763] DRY RUN — pass --apply to execute");
}

main().catch((err) => {
  console.error("[wave763] failed", err);
  process.exit(1);
});
