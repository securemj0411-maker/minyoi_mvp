import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseListingOptions } from "@/lib/option-parser";

describe("option parser visible damage regression", () => {
  it("'조금 있어서'를 액정 금 있음으로 오탐하지 않는다", () => {
    const parsed = parseListingOptions({
      category: "earphone",
      title: "Apple 에어팟 4세대 노이즈캔슬링 블루투스 이어폰",
      description: [
        "선명한 음질과 뛰어난 노이즈 캔슬링 기능으로 몰입감 있는 사운드를 즐길 수 있어요",
        "생활기스가 조금 있어서 싸게 팔아봅니다",
        "노이즈 캔슬링 됩니다",
      ].join("\n"),
      skuId: "airpods-4-anc",
      skuName: "AirPods 4 ANC",
    });

    assert.ok(!parsed.conditionNotes.includes("display_defect"));
    assert.notEqual(parsed.conditionClass, "flawed");
  });

  it("이어폰 뚜껑/케이스 생활 스크래치를 display_defect로 보지 않는다", () => {
    const parsed = parseListingOptions({
      category: "earphone",
      title: "에어팟 프로 2세대 8핀",
      description: [
        "생활 스크래치는 조금 있지만, 전체적으로 깨끗합니다.",
        "윗뚜껑이 살짝 안 맞아요 (사진 참고)",
        "노이즈 캔슬링 잘 작동해요",
        "양쪽 다 잘 들리고 충전도 잘 됩니다.",
      ].join("\n"),
      skuId: "airpods-pro-2",
      skuName: "AirPods Pro 2",
    });

    assert.ok(!parsed.conditionNotes.includes("display_defect"));
  });

  it("유리/액정 금감은 정상 작동 문구가 있어도 display_defect로 유지한다", () => {
    const parsed = parseListingOptions({
      category: "smartphone",
      title: "아이폰 15",
      description: "앞유리 조금 금갔어요. 그래도 기능은 정상 작동합니다.",
      skuId: "iphone-15",
      skuName: "iPhone 15",
    });

    assert.ok(parsed.conditionNotes.includes("display_defect"));
    assert.equal(parsed.conditionClass, "flawed");
  });
});
