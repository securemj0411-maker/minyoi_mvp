import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseEarphoneConditionEvidence } from "@/lib/condition-evidence/earphone";
import { parseListingOptions } from "@/lib/option-parser";

function signals(title: string, description = "") {
  return parseEarphoneConditionEvidence({ title, description }).signals;
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

  it("parseListingOptions는 earphone parsedJson에 shadow evidence를 저장한다", () => {
    const parsed = parseListingOptions({
      category: "earphone",
      title: "애플 에어팟 프로 1세대",
      description: "노이즈켄슬링 작동시 지지직 소리가 납니다.",
      skuId: "airpods-pro-1",
      skuName: "AirPods Pro 1",
    });

    assert.equal((parsed.parsedJson.earphone_condition_policy as { mode?: string } | null)?.mode, "shadow_only");
    assert.deepEqual(
      (parsed.parsedJson.earphone_condition_signals as string[]).filter((signal) => signal.includes("issue")).sort(),
      ["anc_or_transparency_issue", "audio_output_issue"],
    );
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
