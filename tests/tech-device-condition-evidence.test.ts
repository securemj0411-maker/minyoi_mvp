import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTechDeviceConditionEvidence } from "@/lib/condition-evidence/tech-device";

function signals(title: string, description = "") {
  return parseTechDeviceConditionEvidence({ title, description }).signals;
}

describe("tech device condition evidence parser", () => {
  it("액정 잔상과 터치 불량은 각각 hard signal로 분리한다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이폰 14 프로 256",
      description: "잔상 조금 있고 터치 불량 있습니다.",
    });

    assert.ok(result.hardBlockCandidates.includes("display_panel_issue"));
    assert.ok(result.hardBlockCandidates.includes("touch_issue"));
  });

  it("잔상 없음/기능 정상은 display issue로 오탐하지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이폰 15 프로 256GB 파손 없음",
      description: "잔상 없음 기능 정상. 배터리 96%.",
    });

    assert.ok(result.signals.includes("negated_defect"));
    assert.ok(result.signals.includes("battery_high_health"));
    assert.ok(!result.signals.includes("display_panel_issue"));
  });

  it("페이스아이디 불가와 카메라 초점불량은 구매 전 차단 후보로 남긴다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이폰 13 프로",
      description: "Face ID 안됨. 후면 카메라 초점불량 있어요.",
    });

    assert.ok(result.hardBlockCandidates.includes("faceid_or_biometric_issue"));
    assert.ok(result.hardBlockCandidates.includes("camera_issue"));
  });

  it("페이스아이디 정상/카메라 정상은 하자로 보지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이폰 13 프로",
      description: "페이스아이디 정상, 카메라 정상입니다.",
    });

    assert.ok(!result.signals.includes("faceid_or_biometric_issue"));
    assert.ok(!result.signals.includes("camera_issue"));
    assert.ok(result.signals.includes("normal_function_positive"));
  });

  it("초기화 완료와 아이클라우드 로그아웃은 lock issue가 아니라 positive signal이다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이패드 미니 7",
      description: "아이클라우드 로그아웃 완료했고 초기화 완료입니다.",
    });

    assert.ok(result.signals.includes("unlocked_reset_positive"));
    assert.ok(!result.signals.includes("account_or_activation_lock"));
  });

  it("아이클라우드 잠김/분실신고는 hard signal로 남긴다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이패드 프로",
      description: "아이클라우드 잠김 상태라 초기화 불가입니다.",
    });

    assert.ok(result.hardBlockCandidates.includes("account_or_activation_lock"));
  });

  it("보호필름 깨짐은 액정 교체/파손으로 오탐하지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "갤럭시 S24",
      description: "강화유리 필름 깨짐 있고 본체 액정은 정상입니다.",
    });

    assert.ok(!result.signals.includes("screen_replaced_or_repaired"));
    assert.ok(!result.signals.includes("display_panel_issue"));
  });

  it("액정 깨진 곳 없이 깨끗하다는 표현은 display issue로 오탐하지 않는다", () => {
    assert.ok(!signals("아이폰 14", "액정은 필름 잘 붙여놔서 깨진 곳 없이 깨끗합니다.").includes("display_panel_issue"));
  });

  it("스피커 기능 이상무는 speaker/mic issue로 오탐하지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "갤럭시 z폴드5",
      description: "블루투스 와이파이 스피커 기능 전부 이상무입니다.",
    });

    assert.ok(result.signals.includes("normal_function_positive"));
    assert.ok(!result.signals.includes("speaker_or_mic_issue"));
  });

  it("일본판 카메라 무음은 camera issue로 오탐하지 않는다", () => {
    assert.ok(!signals("아이폰 16 일본판", "기능 문제 없어요. 일본 아이폰이라 카메라 기본 무음이에요.").includes("camera_issue"));
  });

  it("사설 수리는 hard, 공식 리퍼는 positive로 분리한다", () => {
    const unofficial = parseTechDeviceConditionEvidence({
      title: "아이폰 15",
      description: "사설 수리 이력 있습니다.",
    });
    const factory = parseTechDeviceConditionEvidence({
      title: "아이폰 15 리퍼 미개봉",
      description: "애플 리퍼 제품입니다.",
    });

    assert.ok(unofficial.hardBlockCandidates.includes("unofficial_or_partial_repair"));
    assert.ok(factory.positiveSignals.includes("factory_refurbished"));
    assert.ok(!factory.hardBlockCandidates.includes("unofficial_or_partial_repair"));
  });

  it("배터리 저하와 높은 사이클은 warning으로 남긴다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "애플워치 8",
      description: "배터리 효율 78%, 사이클 620회입니다.",
    });

    assert.ok(result.warningSignals.includes("low_battery_health"));
    assert.ok(result.warningSignals.includes("high_battery_cycles"));
    assert.ok(!result.hardBlockCandidates.includes("low_battery_health"));
  });

  it("할부 미납과 유심 인식 불가는 carrier/finance risk로 남긴다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "갤럭시 S23",
      description: "잔여 할부 있고 유심 인식 불가입니다.",
    });

    assert.ok(result.hardBlockCandidates.includes("carrier_or_finance_risk"));
  });

  it("셀룰러 사용 불가 GPS 모드 설명은 carrier/finance risk로 오탐하지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "애플워치 SE3 셀룰러",
      description: "통신사 약정으로 셀룰러 사용 불가, GPS 모드만 가능합니다.",
    });

    assert.ok(!result.hardBlockCandidates.includes("carrier_or_finance_risk"));
  });

  it("확정기변 불가능은 carrier/finance risk로 남긴다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이폰 17 프로",
      description: "유심기변용이고 확정기변 불가능합니다.",
    });

    assert.ok(result.hardBlockCandidates.includes("carrier_or_finance_risk"));
  });
});
