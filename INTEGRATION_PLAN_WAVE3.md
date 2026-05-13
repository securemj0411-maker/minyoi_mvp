# Wave 3 통합 절차 (메인 conductor 전용)

> sub-agent 7개 끝나면 이 순서대로 머지. 5분/lane = 35분 예상.
> 작업 후 이 파일 삭제.

## 1. 통합 순서 (의존성 없음, 알파벳)

| # | Worktree | Branch | Lane | LANE_READINESS 추가? |
|---|---|---|---|---|
| 1 | mvp-agent-a | feature/airpods-max-usbc | airpods_max_usbc | **No** (earphone LIVE) |
| 2 | mvp-agent-b | feature/ipad-air-m2-11-256 | ipad_air_m2_11_256_wifi | Yes (tablet internal) |
| 3 | mvp-agent-c | feature/ipad-pro-13-m4-256 | ipad_pro_13_m4_256_wifi | Yes |
| 4 | mvp-agent-d | feature/iphone-16-pro-128-self | iphone_16_pro_128gb_self | Yes (smartphone internal) |
| 5 | mvp-agent-e | feature/galaxy-s25-ultra-256-self | galaxy_s25_ultra_256_self | Yes |
| 6 | mvp-agent-f | feature/macbook-air-m3-13 | macbook_air_m3_13_256 | Yes (laptop internal) |
| 7 | mvp-agent-g | feature/bose-qc-ultra | (none — Bose는 earphone LIVE) | **No** |

## 2. Cherry-pick 패턴 (각 branch별)

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp
git cherry-pick --no-commit feature/<branch>~..feature/<branch>  # 단일 commit이면
# 또는 다중 commit이면 hash 명시
git reset HEAD STATUS_AGENT.md 2>/dev/null
rm -f STATUS_AGENT.md
# conflict 있으면 수동 해결, 없으면:
git commit -m "feat(lane): wire <lane_name> (Agent <X>)"
```

## 3. LANE_READINESS 추가 (한 번에, 6 lane)

`src/lib/category-readiness.ts`의 `LANE_READINESS` map 끝에 추가:

```ts
  airpods_max_usbc: {
    status: "ready",
    label: "AirPods Max (USB-C, 2024)",
    note: "AirPods Max USB-C 신형 narrow lane. Lightning 구형은 catalog mustNotContain으로 분리.",
  },
  ipad_air_m2_11_256_wifi: {
    status: "ready",
    label: "iPad Air M2 11\" 256GB Wi-Fi",
    note: "단일 변형 narrow lane. M1/M3, 13인치, 셀룰러는 catalog mustNotContain으로 차단.",
  },
  ipad_pro_13_m4_256_wifi: {
    status: "ready",
    label: "iPad Pro 13\" M4 256GB Wi-Fi",
    note: "11\" sibling lane (ipad_pro_11_m4_256_wifi)와 분리. 셀룰러/타 용량/타 chip 차단.",
  },
  iphone_16_pro_128gb_self: {
    status: "ready",
    label: "iPhone 16 Pro 128GB (자급제)",
    note: "iphone_15_pro_128gb_self의 16세대 sibling. Pro Max/15/17/통신사 차단.",
  },
  galaxy_s25_ultra_256_self: {
    status: "ready",
    label: "Galaxy S25 Ultra 256GB (자급제)",
    note: "S24/S23, 512/1TB, 통신사 약정/완납폰 차단.",
  },
  macbook_air_m3_13_256: {
    status: "ready",
    label: "MacBook Air M3 13\" 256GB",
    note: "laptop_broad의 첫 narrow exit. M1/M2/M4, 15\", Pro, 타 RAM/SSD 차단.",
  },
```

(Bose QC Ultra는 earphone LIVE라 LANE_READINESS 등록 불필요 — catalog에만 추가.)

## 4. 검증

```bash
npx tsc --noEmit 2>&1 | grep -E "^(src/|tests/)"  # must be empty
npm run test:core 2>&1 | grep -E "^ℹ (tests|pass|fail)"  # 102/105 유지

# Lane wire verify
cat > /tmp/verify.ts << 'EOF'
import { CATALOG } from "@/lib/catalog";
import { LANE_READINESS } from "@/lib/category-readiness";
import { evaluatePoolGate } from "@/lib/candidate-pool-builder";

const byLane = new Map<string, string[]>();
for (const sku of CATALOG) {
  if (!sku.laneKey) continue;
  if (!byLane.has(sku.laneKey)) byLane.set(sku.laneKey, []);
  byLane.get(sku.laneKey)!.push(sku.id);
}
console.log("Lanes:", byLane.size, "Total tagged SKUs:", [...byLane.values()].flat().length);

const orphans = [...new Set(Object.keys(LANE_READINESS))].filter((k) => !byLane.has(k));
const missing = [...byLane.keys()].filter((k) => !LANE_READINESS[k]);
console.log("Orphan readiness:", orphans);
console.log("SKU laneKey missing readiness:", missing);

let live = 0;
for (const sku of CATALOG) {
  if (!sku.laneKey) continue;
  const g = evaluatePoolGate({ sku, category: sku.category }, {});
  if (g.canEnterPool) live++;
}
console.log(`LIVE narrow-lane SKUs: ${live}`);
EOF
npx tsx /tmp/verify.ts && rm /tmp/verify.ts
```

기대 결과: 13 lane (6 신규 + 7 기존) / 21+ tagged SKUs LIVE.

## 5. LAUNCH_PLAN 업데이트

§4 Lane Registry에 6 신규 lane 추가 (LIVE 마킹), §8 Decision Log에 5/12 wave 3 추가, §11에 wave 3 결과 표.

## 6. 다음 wave 후보 (검토 후 결정)

| Lane | Category | Mining 데이터 | 비고 |
|---|---|---|---|
| AirPods Pro 3 | earphone | 없음 | 신규 출시 모델 (2025) |
| iPad Air M3 11" | tablet | 없음 | 2025 신형 |
| Galaxy Tab S10 Ultra | tablet | 있음 (S10 Ultra가 main에 있음) | 자급제 narrow |
| MacBook Pro 14" M3 18GB | laptop | 없음 | macbook-pro broad의 narrow exit |
| LG 그램 17" 2025 | laptop | 없음 | 한국 인기 |
| iPhone 14 Pro 128 자급제 | smartphone | 없음 | 15 Pro 패턴 재사용 |
| Galaxy S24 Ultra 256 자급제 | smartphone | 없음 | S25 패턴 재사용 |
| Apple Watch Ultra 2 | smartwatch | 없음 | smartwatch LIVE 카테고리 |
| Sony WH-1000XM5 narrow | earphone | 있음 (XM4와 같은 mining 결과) | XM5 sibling 분리 |
| Beats Studio Pro | earphone | 없음 | open-set 위험 낮음 |

**다음 wave는 또 6~8 sub-agent 병렬 가능.**

## 7. Blocker (해결 필요)

- D-002 Switch 2 정책 — 결정 후 ps5 패턴 재사용 가능
- D-003 AirPods Max 세대 ambiguity — wave 3에서 USB-C 분리하면 자연 해결될 가능성
