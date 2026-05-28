import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";
import { CATALOG } from "@/lib/catalog";
import { parseEarphoneConditionEvidence } from "@/lib/condition-evidence/earphone";
import { parseListingOptions } from "@/lib/option-parser";

function signals(title: string, description = "") {
  return parseEarphoneConditionEvidence({ title, description }).signals;
}

function buildAirpodsPool(parsedJson: Record<string, unknown>, pid = 926001) {
  const sku = CATALOG.find((item) => item.laneKey === "airpods_max_usbc" || item.id === "airpods-max-usbc");
  assert.ok(sku, "airpods max catalog sku must exist");

  return buildCandidatePoolRows({
    rows: [
      {
        pid,
        source: "bunjang",
        price: 130_000,
        skuMedian: 170_000,
        estimatedBuyCost: 130_000,
        shippingFee: 0,
        shippingFeeGeneral: 0,
        riskHits: 0,
        thumbnailUrl: "https://example.com/airpods.jpg",
        skuId: sku.id,
        score: 95,
        scoreFlags: [],
        imageCount: 4,
        shopReviewCount: 12,
      },
    ],
    parsedByPid: new Map([
      [
        pid,
        {
          category: "earphone",
          comparable_key: "airpods|airpods_max_usbc|usbc",
          parse_confidence: 0.95,
          needs_review: false,
          parsed_json: {
            condition_notes: [],
            ...parsedJson,
          },
          condition_class: "normal",
        },
      ],
    ]),
    catalogById: new Map(CATALOG.map((item) => [item.id, item])),
    categoryReadiness: {
      earphone: {
        status: "ready",
        label: "Audio",
        note: "ready",
        minReadyPool: 6,
        minParseRate: 0.85,
        minTrustedKeys: 5,
      },
    } as Parameters<typeof buildCandidatePoolRows>[0]["categoryReadiness"],
    now: "2026-05-29T00:00:00.000Z",
  });
}

describe("earphone condition evidence shadow parser", () => {
  it("노캔 작동 중 지지직은 ANC 이슈와 소리 이슈를 함께 남긴다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "애플 에어팟 프로 1세대",
      description: "노이즈켄슬링 작동시 지지직 소리가 납니다.",
    });

    assert.ok(result.signals.includes("anc_or_transparency_issue"));
    assert.ok(result.signals.includes("audio_output_issue"));
    assert.ok(result.hardBlockCandidates.includes("anc_or_transparency_issue"));
  });

  it("마이크 이상과 박스 없음은 기능 이슈와 구성품 누락으로 분리한다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "에어팟 3세대 판매합니다",
      description: "마이크 약간 이상함. 박스는 없습니다.",
    });

    assert.ok(result.signals.includes("mic_issue"));
    assert.ok(result.signals.includes("missing_parts"));
    assert.ok(result.hardBlockCandidates.includes("mic_issue"));
    assert.ok(result.warningSignals.includes("missing_parts"));
  });

  it("노캔이 없는 일반 모델은 ANC 고장이 아니라 variant로 본다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "에어팟 4세대 노캔 x",
      description: "노캔 안되는 일반모델입니다.",
    });

    assert.ok(result.signals.includes("no_anc_variant"));
    assert.ok(!result.signals.includes("anc_or_transparency_issue"));
  });

  it("정상 작동 부정형은 페어링/소리 이슈로 오탐하지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "에어팟 프로 2 풀세트",
      description: "페어링 정상이고 소리 이상 없습니다.",
    });

    assert.ok(result.signals.includes("negated_defect"));
    assert.ok(!result.signals.includes("pairing_or_connection_issue"));
    assert.ok(!result.signals.includes("audio_output_issue"));
  });

  it("음질/소리 문제 없음 표현은 audio issue로 오탐하지 않는다", () => {
    assert.ok(!signals("에어팟 맥스 8핀", "음질이나 문제 전혀 없습니다.").includes("audio_output_issue"));
    assert.ok(!signals("에어팟 3세대 풀박스", "외관하자 거의 없고 음질 문제 아예 없습니다.").includes("audio_output_issue"));
    assert.ok(!signals("갤럭시 버즈 라이브", "음질 좋고 깨끗합니다.").includes("audio_output_issue"));
  });

  it("노캔 잘됨/문제없음 표현은 ANC issue로 오탐하지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "애플 에어팟 프로 1세대",
      description: "노이즈캔슬링 잘되고 풀충전하면 오래가요. 사용시에 문제없고 생활기스만 있습니다.",
    });

    assert.ok(!result.signals.includes("anc_or_transparency_issue"));
  });

  it("깨끗한 상태 표현은 physical damage로 오탐하지 않는다", () => {
    assert.ok(!signals("에어팟 프로2 풀박스", "외관 상태 깨끗하고 생활미세기스 약간 있습니다.").includes("physical_damage"));
    assert.ok(!signals("에어팟 4세대", "본체와 충전 케이스 모두 깨끗한 상태에요.").includes("physical_damage"));
  });

  it("한쪽 유닛 분실은 single_side_unit으로 남긴다", () => {
    assert.ok(signals("에어팟 프로 2", "왼쪽 잃어버려서 없습니다. 오른쪽만 사용 가능.").includes("single_side_unit"));
  });

  it("충전케이스만 매물은 charging_case_only로 남긴다", () => {
    assert.ok(signals("에어팟 프로2 충전케이스만 판매", "유닛 없이 충전케이스만 있습니다.").includes("charging_case_only"));
  });

  it("풀사이즈 헤드폰 단품은 부품 차단이 아니라 구성품 누락 경고로 남긴다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "소니 WH-1000XM6 헤드폰 단품",
      description: "본체만 드립니다. 작동 정상.",
    });

    assert.ok(result.signals.includes("missing_parts"));
    assert.ok(result.warningSignals.includes("missing_parts"));
    assert.ok(!result.hardBlockCandidates.includes("missing_parts"));
  });

  it("오염 표현은 hygiene_or_stain 경고로 남긴다", () => {
    assert.ok(signals("에어팟 프로", "이어팁에 화장품이 조금 묻어 있습니다.").includes("hygiene_or_stain"));
  });

  it("parseListingOptions는 earphone parsedJson에 gate evidence를 저장한다", () => {
    const parsed = parseListingOptions({
      category: "earphone",
      title: "애플 에어팟 프로 1세대",
      description: "노이즈켄슬링 작동시 지지직 소리가 납니다.",
      skuId: "airpods-pro-1",
      skuName: "AirPods Pro 1",
    });

    assert.equal((parsed.parsedJson.earphone_condition_policy as { mode?: string } | null)?.mode, "pool_gate_v1");
    assert.deepEqual(
      (parsed.parsedJson.earphone_condition_signals as string[]).filter((signal) => signal.includes("issue")).sort(),
      ["anc_or_transparency_issue", "audio_output_issue"],
    );
  });

  it("pool_gate_v1 hard candidate는 candidate pool 진입을 차단한다", () => {
    const result = buildAirpodsPool({
      earphone_condition_policy: {
        mode: "pool_gate_v1",
        hard_block_candidates: ["audio_output_issue"],
        warning_signals: [],
      },
    });

    assert.equal(result.entries.length, 0);
    assert.deepEqual(result.invalidations, [
      { pid: 926001, reason: "earphone_condition_audio_output_issue" },
    ]);
  });

  it("shadow_only hard candidate는 기존 row 보호를 위해 pool gate로 쓰지 않는다", () => {
    const result = buildAirpodsPool({
      earphone_condition_policy: {
        mode: "shadow_only",
        hard_block_candidates: ["audio_output_issue"],
        warning_signals: [],
      },
    });

    assert.equal(result.invalidations.length, 0);
    assert.equal(result.entries.length, 1);
  });

  it("pool_gate_v1 warning-only signal은 candidate pool을 막지 않는다", () => {
    const result = buildAirpodsPool({
      earphone_condition_policy: {
        mode: "pool_gate_v1",
        hard_block_candidates: [],
        warning_signals: ["missing_parts"],
      },
    });

    assert.equal(result.invalidations.length, 0);
    assert.equal(result.entries.length, 1);
  });

  it("다른 카테고리 parsedJson에는 earphone shadow evidence를 박지 않는다", () => {
    const parsed = parseListingOptions({
      category: "smartphone",
      title: "아이폰 15",
      description: "정상 작동합니다.",
      skuId: "iphone-15",
      skuName: "iPhone 15",
    });

    assert.equal(parsed.parsedJson.earphone_condition_evidence, null);
    assert.equal(parsed.parsedJson.earphone_condition_policy, null);
  });
});
