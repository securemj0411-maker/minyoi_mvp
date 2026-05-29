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

  it("노캔은 안됨 같은 일반 모델 표현은 ANC 고장으로 보지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "에어팟4세대 팔아요",
      description: "새상품은 아니고 노캔은 안됨니다. 일반 모델이에요.",
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
    assert.ok(!signals("에어팟프로 1세대 A급 세트", "노이즈캔슬링이나 통화정상 작동하며 불량없습니다. 지지직거림 없습니다.").includes("audio_output_issue"));
    assert.ok(!signals("애플 에어팟 프로1", "하자 없고 연결 문제 없고 지지직 소리 없습니당").includes("audio_output_issue"));
  });

  it("색상명+노이즈캔슬링 조합은 화이트 노이즈 하자로 오탐하지 않는다", () => {
    assert.ok(!signals("보스 qc45 스모크화이트 노이즈캐슬링 무선 헤드폰").includes("audio_output_issue"));
  });

  it("작동상 문제 없음/충전기 포함 표현은 충전 하자로 오탐하지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "소니 WH-1000XM5 블랙 헤드폰",
      description: "2년전에 구매 했어요. 박스 충전기 다 있어요. 작동상 문제 아무것도 없어요.",
    });

    assert.ok(result.signals.includes("negated_defect"));
    assert.ok(!result.signals.includes("battery_degraded"));
  });

  it("충전 케이스 구성 설명과 다른 문장의 음질 문제 없음은 충전 하자로 묶지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "애플 에어팟 4세대 C타입 급처 풀박스",
      description: "박스, 에어팟 본체, 충전 케이스 모두 깨끗하게 사용했어요. 음질에 문제 일도 없습니다.",
    });

    assert.ok(!result.signals.includes("battery_degraded"));
  });

  it("기기상 문제 전혀없음은 페어링 하자로 오탐하지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "에어팟 맥스 스페이스 그레이",
      description: "페어링, 노이즈캔슬링, 버튼 등 기기상 문제는 전혀없고 방금 전부 확인했습니다.",
    });

    assert.ok(result.signals.includes("negated_defect"));
    assert.ok(!result.signals.includes("pairing_or_connection_issue"));
  });

  it("오른쪽 지지직은 한쪽 유닛 분실이 아니라 소리 이상으로 본다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "애플 에어팟 프로 1세대",
      description: "사용감이 좀 있고 오른쪽에서 지지직 소리가 납니다. 박스는 따로 없습니다. 양쪽 모두 노이즈캔슬링은 됩니다.",
    });

    assert.ok(result.signals.includes("audio_output_issue"));
    assert.ok(!result.signals.includes("single_side_unit"));
  });

  it("오른쪽 밑 찍힘은 한쪽 유닛 누락으로 보지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "삼성 갤럭시 버즈3 FE",
      description: "케이스 오른쪽밑에 찍힘 말고는 전혀 하자없이 깨끗합니다.",
    });

    assert.ok(!result.signals.includes("single_side_unit"));
  });

  it("지지직거리지 않음/노캔O는 기능 하자로 오탐하지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "에어팟 프로 1세대 8핀",
      description: "기능상 하자 없습니다. 지지직 거림x, 노캔o 입니다.",
    });

    assert.ok(!result.signals.includes("audio_output_issue"));
    assert.ok(!result.signals.includes("anc_or_transparency_issue"));
  });

  it("지지직 매물이 많지만 이 매물은 문제없다는 비교 설명은 소리 하자로 보지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "하자X 에어팟프로1 풀박",
      description: "다른 게시글보니 지지직 거린다는 매물이 많은데, 이건 전혀 그런 문제없습니다.",
    });

    assert.ok(!result.signals.includes("audio_output_issue"));
  });

  it("파손 우려로 직거래만 한다는 배송 안내는 파손 하자로 보지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "갤럭시 버즈4 프로 화이트 미개봉",
      description: "미개봉 새제품입니다. 파손우려가 있어 직거래로만 판매합니다.",
    });

    assert.ok(!result.signals.includes("physical_damage"));
  });

  it("떨어뜨림/떨어트린 적 없음은 파손 하자로 보지 않는다", () => {
    assert.ok(!signals("보스 QC 울트라", "기스나 충격 떨어뜨림 일절 없습니다.").includes("physical_damage"));
    assert.ok(!signals("에어팟 4세대", "실착 5회이고 떨어트린적도 없어요. 거의 새상품입니다.").includes("physical_damage"));
  });

  it("구성에 케이스가 포함된 매물은 충전케이스 단품으로 보지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "갤럭시 버즈 프로4 화이트 팝니다",
      description: "갤럭시 버즈 프로와 헬리녹스 케이스 팝니다. 실사용은 일주일 정도입니다.",
    });

    assert.ok(!result.signals.includes("charging_case_only"));
  });

  it("풀박스+케이스티파이 번들 표현은 보호 케이스 단품으로 보지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "에어팟 프로 2세대 풀박스+케이스티파이",
      description: "오른쪽 마이크 잘 안됩니다. 케이스티파이 케이스도 같이 드리겠습니다.",
    });

    assert.ok(!result.signals.includes("protective_case_only"));
    assert.ok(result.signals.includes("mic_issue"));
  });

  it("케이스 포함 번들은 보호 케이스 단품으로 보지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "에어팟 3 (케이스티파이 케이스 포함)",
      description: "작동에 이상 없어요.",
    });

    assert.ok(!result.signals.includes("protective_case_only"));
  });

  it("케이스만 없는 풀박스는 케이스 단품 매물로 보지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "에어팟맥스 풀박스(케이스제외)",
      description: "에어팟맥스 제품입니다. 케이스만 없는 풀박스제품입니다.",
    });

    assert.ok(!result.signals.includes("charging_case_only"));
    assert.ok(result.signals.includes("missing_parts"));
  });

  it("케이스를 잃어버리고 양쪽 유닛은 있는 매물은 한쪽 유닛 누락으로 보지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "삼성 갤럭시 버즈2 프로 이어폰만 왼쪽 오른쪽",
      description: "본체 케이스 잃어버려서 없어요. 왼쪽 오른쪽 둘다 생활기스 있어요.",
    });

    assert.ok(!result.signals.includes("single_side_unit"));
    assert.ok(result.signals.includes("missing_parts"));
  });

  it("마이크 이상무는 마이크 하자로 보지 않는다", () => {
    const result = parseEarphoneConditionEvidence({
      title: "에어팟 4세대 노캔",
      description: "노캔 기능 잘 됩니다. 배터리 마이크 음질 이상무입니다.",
    });

    assert.ok(!result.signals.includes("mic_issue"));
  });

  it("기능문제 없음/연결 문제 없음은 페어링 하자로 보지 않는다", () => {
    assert.ok(!signals("에어팟4세대 노캔O S급", "기능문제 없습니다. 노캔 페어링등등 바로 사용하시면 됩니다.").includes("pairing_or_connection_issue"));
    assert.ok(!signals("Bose 보스 qc 울트라", "기능 이상 전혀 없고 연결 문제도 없습니다.").includes("pairing_or_connection_issue"));
    assert.ok(!signals("애플 에어팟 2세대", "양쪽 다 문제없고 연결 잘 됩니더.").includes("pairing_or_connection_issue"));
    assert.ok(!signals("에어팟 맥스", "연결 다 잘되고요 기계 문제는 하나도 없습니당 정상작동 잘됩니다.").includes("pairing_or_connection_issue"));
    assert.ok(!signals("에어팟맥스2 풀박스", "음질, 연결, 충전 관련 문제 일체 없음.").includes("pairing_or_connection_issue"));
    assert.ok(!signals("에어팟맥스2 풀박스", "음질, 연결, 충전 관련 문제 일체 없음.").includes("battery_degraded"));
  });

  it("본체와 보관 케이스가 같이 있는 구성은 케이스 단품으로 보지 않는다", () => {
    assert.ok(!signals("에어팟 맥스 실버", "구성품은 본체, 박스, 정품 보호 케이스, 보관 케이스만 드립니다.").includes("charging_case_only"));
    assert.ok(!signals("에어팟 맥스 8핀 민트", "기기 단품과 고무 케이스, 보관 케이스만 드리기에 저렴하게 내놓습니다.").includes("charging_case_only"));
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

  it("parseListingOptions는 이어폰 하드 신호를 condition_notes와 flawed 등급으로 연결한다", () => {
    const parsed = parseListingOptions({
      category: "earphone",
      title: "에어팟 프로 1세대 팝니다",
      description: "노캔 사용시 지지직 소리 나고요 찍힘 있습니다.",
      skuId: "airpods-pro-1",
      skuName: "AirPods Pro 1",
    });

    assert.equal(parsed.conditionClass, "flawed");
    assert.ok(parsed.conditionNotes.includes("repair_or_defect_signal"));
    assert.ok(parsed.conditionNotes.includes("earphone_audio_issue"));
    assert.ok(parsed.conditionNotes.includes("earphone_anc_issue"));
  });

  it("parseListingOptions는 한쪽 유닛/충전 이슈를 사용자 노출 note로 남긴다", () => {
    const singleSide = parseListingOptions({
      category: "earphone",
      title: "에어팟 프로 2",
      description: "왼쪽 잃어버려서 없습니다. 오른쪽만 사용 가능.",
      skuId: "airpods-pro-2",
      skuName: "AirPods Pro 2",
    });
    const charging = parseListingOptions({
      category: "earphone",
      title: "에어팟 4세대 유선충전만 안됨",
      description: "무선 충전은 가능하고 유선충전만 안돼요.",
      skuId: "airpods-4",
      skuName: "AirPods 4",
    });

    assert.equal(singleSide.conditionClass, "flawed");
    assert.ok(singleSide.conditionNotes.includes("single_side_only"));
    assert.ok(singleSide.conditionNotes.includes("earphone_single_side_unit"));
    assert.equal(charging.conditionClass, "flawed");
    assert.ok(charging.conditionNotes.includes("repair_or_defect_signal"));
    assert.ok(charging.conditionNotes.includes("earphone_battery_issue"));
  });

  it("parseListingOptions는 노캔 일반 모델/정상 부정형을 flawed로 낮추지 않는다", () => {
    const noAnc = parseListingOptions({
      category: "earphone",
      title: "에어팟4세대 팔아요",
      description: "노캔은 안됨니다. 소리 정상이고 지지직거림 없습니다.",
      skuId: "airpods-4",
      skuName: "AirPods 4",
    });

    assert.notEqual(noAnc.conditionClass, "flawed");
    assert.ok(!noAnc.conditionNotes.includes("earphone_anc_issue"));
    assert.ok(!noAnc.conditionNotes.includes("earphone_audio_issue"));
    assert.ok((noAnc.parsedJson.earphone_condition_signals as string[]).includes("no_anc_variant"));
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
