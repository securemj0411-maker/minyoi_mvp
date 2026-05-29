import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTechDeviceConditionEvidence } from "@/lib/condition-evidence/tech-device";
import { parseListingOptions } from "@/lib/option-parser";

describe("ready hard-chip residue regressions", () => {
  it("골프 그립 교체는 정비/프리미엄 신호이지 일반 수리 하자가 아니다", () => {
    const parsed = parseListingOptions({
      category: "sport_golf",
      title: "혼마 드라이버",
      description: "그립 교체 1개월전입니다. 헤드와 커버 포함이고 상태 좋습니다.",
    });

    assert.ok(parsed.conditionNotes.includes("golf_grip_new"));
    assert.ok(!parsed.conditionNotes.includes("repair_or_defect_signal"));
  });

  it("다이슨 필터/배터리 소모품 교체와 정상 작동 문맥을 하자로 보지 않는다", () => {
    const filter = parseListingOptions({
      category: "home_appliance",
      title: "다이슨 V8",
      description: "새 필터로 교체했습니다. 상태작동 양호합니다.",
    });
    const battery = parseListingOptions({
      category: "home_appliance",
      title: "다이슨 V8",
      description: "새 밧데리 교체했습니다. 기존 배터리는 일반청소 모드로 10분 정도 가능해서 새것으로 교체했고 작동 양호합니다.",
    });

    assert.ok(!filter.conditionNotes.includes("repair_or_defect_signal"));
    assert.ok(!battery.conditionNotes.includes("repair_or_defect_signal"));
  });

  it("배터리 교체 후 효율 100%는 0% 저하 배터리로 오독하지 않는다", () => {
    const parsed = parseListingOptions({
      category: "smartphone",
      title: "아이폰 14 프로",
      description: "내용 수정후 재등록합니다. 최근 배터리 교체로 효율 100%입니다. 외관 깨끗합니다.",
    });
    const evidence = parseTechDeviceConditionEvidence({
      title: "아이폰 14 프로",
      description: "최근 배터리 교체로 효율 100%입니다.",
    });

    assert.ok(parsed.conditionNotes.includes("battery_perfect"));
    assert.ok(!parsed.conditionNotes.includes("low_battery_health"));
    assert.ok(!parsed.conditionNotes.includes("repair_or_defect_signal"));
    assert.ok(evidence.signals.includes("battery_perfect"));
    assert.ok(!evidence.signals.includes("low_battery_health"));
  });

  it("모든 기능 정상인 이어폰의 사진상 생활 하자 언급은 일반 수리 하자로 승격하지 않는다", () => {
    const parsed = parseListingOptions({
      category: "earphone",
      title: "에어팟 프로2",
      description: "상태 좋습니다. 모든 기능 다 정상작동해요. 하자는 사진에 보이는게 전부입니다.",
    });

    assert.ok(parsed.conditionNotes.includes("good_condition"));
    assert.ok(!parsed.conditionNotes.includes("repair_or_defect_signal"));
  });

  it("에어팟 맥스 생활 스크래치와 밴드 늘어짐 부정은 디스플레이 하자가 아니다", () => {
    const parsed = parseListingOptions({
      category: "earphone",
      title: "에어팟 맥스",
      description: "생활 스크래치가 조금 있지만 밴드 늘어짐이나 오염 없습니다. 케이블 빼고 구성품 있습니다.",
    });

    assert.ok(parsed.conditionNotes.includes("cosmetic_wear"));
    assert.ok(!parsed.conditionNotes.includes("display_defect"));
  });
});
