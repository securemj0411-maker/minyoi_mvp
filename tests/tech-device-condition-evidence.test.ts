import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTechDeviceConditionEvidence } from "@/lib/condition-evidence/tech-device";
import { parseListingOptions } from "@/lib/option-parser";

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

  it("뒷면 검은 점/후면 생활기스는 화면 흑점으로 오탐하지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이패드 프로 12.9",
      description: "액정은 필름 한 번도 뗀 적 없어서 깔끔합니다. 뒷면은 미세기스랑 검은 점같은 찍힘 기스가 살짝 있습니다.",
    });

    assert.ok(!result.signals.includes("display_panel_issue"));
  });

  it("액정 깨진 곳 없이 깨끗하다는 표현은 display issue로 오탐하지 않는다", () => {
    assert.ok(!signals("아이폰 14", "액정은 필름 잘 붙여놔서 깨진 곳 없이 깨끗합니다.").includes("display_panel_issue"));
  });

  it("후면유리/뒷판 파손은 생활기스가 아니라 구조 손상 hard signal로 잡는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이폰 13 미니 128GB",
      description: "찍힘 있고 뒷면깨져서 싸게 올려요.",
    });

    assert.ok(result.hardBlockCandidates.includes("body_or_back_glass_damage"));
  });

  it("폴더블 힌지 검은 반점과 접으면 화면 나감은 hard signal로 잡는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "갤럭시 z플립5 256기가",
      description: "가운데 힌지부분 검은색 반점이 있고 뒷판 깨져있습니다. 접으면 화면 나가요.",
    });

    assert.ok(result.hardBlockCandidates.includes("display_panel_issue"));
    assert.ok(result.hardBlockCandidates.includes("body_or_back_glass_damage"));
    assert.ok(result.hardBlockCandidates.includes("foldable_hinge_or_inner_damage"));
  });

  it("무잔상 문구가 있어도 내부 LCD 멍/검은점이 있으면 display issue로 잡는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "갤럭시Z플립5 256GB",
      description: "잔상 유무 무. 터치 카메라 기능 이상 없어요. 내부 LCD 멍 있어요.",
    });

    assert.ok(result.hardBlockCandidates.includes("display_panel_issue"));
  });

  it("태블릿 붉은 반점과 내부 액정 나감은 display issue로 잡는다", () => {
    assert.ok(signals("아이패드 미니 5", "검색 바탕에서만 붉은 반점이 보입니다.").includes("display_panel_issue"));
    assert.ok(signals("갤럭시탭 S8 울트라", "액정이 나갔어요. 겉 액정이 아니라 안에 액정이 나갔고 갑자기 먹통입니다.").includes("display_panel_issue"));
    assert.ok(signals("아이패드 에어 4", "화면 왼쪽하단에 흰색 색번짐이 있긴 합니다.").includes("display_panel_issue"));
  });

  it("폴더블 내부액정 주름/반점은 기능 정상 문구가 있어도 hard signal로 잡는다", () => {
    const parsed = parseListingOptions({
      category: "smartphone",
      title: "갤럭시 Z 플립5 민트 256GB",
      description: "외부액정은 터치 잘 되고 잘나옵니다. 내부액정은 주름이 좀 지고 반점이 있는데, 터치랑 화면은 잘 됩니다.",
    });

    assert.equal(parsed.conditionClass, "flawed");
    assert.ok(parsed.conditionNotes.includes("display_defect"));
    assert.ok(parsed.conditionNotes.includes("foldable_hinge_damage"));
  });

  it("액정/후면 깨끗, 카메라 무음, 스피커 이상 없음은 손상으로 오탐하지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이폰 16 일본판",
      description: "액정 깨끗합니다. 후면도 깨끗합니다. 일본판이라 카메라 무음이고 스피커 이상 없습니다.",
    });

    assert.ok(!result.hardBlockCandidates.includes("display_panel_issue"));
    assert.ok(!result.hardBlockCandidates.includes("body_or_back_glass_damage"));
    assert.ok(!result.hardBlockCandidates.includes("camera_issue"));
    assert.ok(!result.hardBlockCandidates.includes("speaker_or_mic_issue"));
  });

  it("스피커 기능 이상무는 speaker/mic issue로 오탐하지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "갤럭시 z폴드5",
      description: "블루투스 와이파이 스피커 기능 전부 이상무입니다.",
    });

    assert.ok(result.signals.includes("normal_function_positive"));
    assert.ok(!result.signals.includes("speaker_or_mic_issue"));
  });

  it("스피커 제품 설명의 30시간 이상 재생은 speaker issue로 오탐하지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "마샬 엠버튼 II 블루투스 스피커",
      description: "30시간 이상 재생 가능한 휴대용 스피커입니다. 사운드 좋고 정상 작동합니다.",
    });

    assert.ok(!result.signals.includes("speaker_or_mic_issue"));
  });

  it("충전단자 고장과 주변광 센서 문제는 hard signal로 남긴다", () => {
    const parsed = parseListingOptions({
      category: "tablet",
      title: "아이패드 10세대 블루",
      description: "어제부터 충전이 안되는데 충전단자가 고장난 듯해요. 주변광 센서에도 문제가 있다고 하네요.",
      skuId: "ipad-10th",
      skuName: "iPad 10th gen",
    });

    assert.equal(parsed.conditionClass, "flawed");
    assert.ok((parsed.parsedJson.tech_device_condition_signals as string[]).includes("charging_or_sensor_issue"));
    assert.ok(parsed.conditionNotes.includes("device_charging_or_sensor_issue"));
  });

  it("충전기 없음/필름 금감은 충전·센서나 화면 하자로 오탐하지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이패드 7세대",
      description: "액정은 멀쩡하고 필름에 금이 살짝 있습니다. 충전기는 없습니다.",
    });

    assert.ok(!result.signals.includes("charging_or_sensor_issue"));
    assert.ok(!result.signals.includes("display_panel_issue"));
  });

  it("수리내역 없음과 강화유리필름 교체는 액정 수리로 오탐하지 않는다", () => {
    assert.ok(!signals("아이폰13 A급 화이트", "수리내역없습니다 배터리성능86 모든기능이상없으며 하자없습니다").includes("screen_replaced_or_repaired"));
    assert.ok(!signals("아이폰15프로", "기변 직전 강화유리필름 교체해서 필름 교체할 필요 없습니다.").includes("screen_replaced_or_repaired"));
  });

  it("사설수리x/기능이상x는 사설수리 하자로 오탐하지 않는다", () => {
    const parsed = parseListingOptions({
      category: "smartwatch",
      title: "애플워치10 46mm SSS급",
      description: "사설수리x 기능이상x 모든기능정상 생활기스 거의 없는 최상급입니다.",
      skuId: "apple-watch-series-10-46mm",
      skuName: "Apple Watch Series 10 46mm",
    });

    assert.ok(!parsed.conditionNotes.includes("refurbished_or_repaired"));
    assert.ok(!parsed.conditionNotes.includes("repair_or_defect_signal"));
  });

  it("사설 수리 내역 없음/수리 x/불량 없이 정상작동은 수리 하자로 오탐하지 않는다", () => {
    const noHistory = parseListingOptions({
      category: "smartwatch",
      title: "애플워치 10",
      description: "사설 수리 내역 없습니다. 배터리 95% 모든기능정상.",
    });
    const noRepair = parseListingOptions({
      category: "smartwatch",
      title: "애플워치 울트라2",
      description: "태두리기스 액정깨끗. 수리 x 하자 x 모든기능정상.",
    });
    const noDefect = parseListingOptions({
      category: "smartwatch",
      title: "애플워치 시리즈 10",
      description: "사설수리 절대 없이 100%로 사용했습니다. 시스템 불량/크라운 불량/디스플레이 불량 없이 모두 정상작동 됩니다.",
    });

    assert.ok(!noHistory.conditionNotes.includes("refurbished_or_repaired"));
    assert.ok(!noRepair.conditionNotes.includes("screen_replaced"));
    assert.ok(!noDefect.conditionNotes.includes("refurbished_or_repaired"));
    assert.ok(!noDefect.conditionNotes.includes("display_defect"));
  });

  it("충전독/충전기 없음과 스트랩 조정 문구는 본체 기능 고장으로 오탐하지 않는다", () => {
    const chargerMissing = parseListingOptions({
      category: "smartwatch",
      title: "갤럭시워치",
      description: "충전독은 잃어버려서 없습니다. 기능에는 아무런 문제가 없습니다.",
    });
    const strapOnly = parseListingOptions({
      category: "smartwatch",
      title: "갤럭시 워치4",
      description: "시계줄은 교체해서 쓰셔야 할 거 같아요. 제 손목 사이즈에 맞게 빼놔서 길이 조정 불가. 충전기도 함께 드려요.",
    });

    assert.ok(!chargerMissing.conditionNotes.includes("device_charging_or_sensor_issue"));
    assert.ok(!strapOnly.conditionNotes.includes("repair_or_defect_signal"));
  });

  it("보호필름 깨짐/배송 파손 동의/자급제 가개통 무관 문구는 하자로 오탐하지 않는다", () => {
    const filmOnly = parseListingOptions({
      category: "smartwatch",
      title: "갤럭시 워치6",
      description: "액정 멀쩡하구요 사용하던 필름이 깨져있습니다.",
    });
    const shippingOnly = parseListingOptions({
      category: "smartwatch",
      title: "애플워치",
      description: "파손 동의시 택배거래 가능하고 제품은 정상입니다.",
    });
    const unlockedRetail = parseListingOptions({
      category: "smartwatch",
      title: "갤럭시워치울트라",
      description: "자급제라 가개통같은거 신경안쓰시고 사용가능해요.",
    });

    assert.ok(!filmOnly.conditionNotes.includes("display_defect"));
    assert.ok(!shippingOnly.conditionNotes.includes("repair_or_defect_signal"));
    assert.ok(!unlockedRetail.conditionNotes.includes("sim_or_carrier_issue"));
  });

  it("백화 없음/침수 취급하지 않음/모서리 파손 없음은 하자로 오탐하지 않는다", () => {
    assert.ok(!signals("갤럭시 탭", "화면 백화현상 및 픽셀 깨짐 없습니다. 후면에 생활기스 정도는 있습니다.").includes("display_panel_issue"));
    assert.ok(!signals("애플워치", "분실, 도난, 침수 취급하지 않습니다. 모든 기능 정상입니다.").includes("water_damage"));
    assert.ok(!signals("아이패드", "모서리깔끔. 파손없음. 정상작동.").includes("body_or_back_glass_damage"));
  });

  it("필름 금/공기방울/워치줄 구멍/터치 오작동 X는 화면 하자로 오탐하지 않는다", () => {
    assert.ok(!signals("갤럭시 탭", "액정 깨진 것 아니고 필름에 금이 간 건데 확인 필요하시면 필름 벗겨서 보여드려요.").includes("display_panel_issue"));
    assert.ok(!signals("애플워치 울트라", "보호필름에 공기가 들어가서 화면깨진거처럼 보일 수 있는데 화면 깨지거나 흠 없습니다.").includes("display_panel_issue"));
    assert.ok(!signals("갤럭시 워치6", "워치 줄에 살짝 구멍나있어요. 너무 커서 살짝 구멍뚫어서 사용했었어요.").includes("display_panel_issue"));
    assert.ok(!signals("애플워치 울트라2", "화면기스, 터치 및 소프트웨어 오작동 X 상태 S급.").includes("touch_issue"));
  });

  it("판매점 고지문과 지문방지필름은 실제 결함으로 오탐하지 않는다", () => {
    const shopPolicy = "잔상: 양호. 고객 부주의(파손/침수/충격)은 교환 불가입니다.";
    assert.ok(!signals("갤럭시탭 S8", shopPolicy).includes("display_panel_issue"));
    assert.ok(!signals("갤럭시탭 S8", shopPolicy).includes("water_damage"));
    assert.ok(!signals("갤럭시탭 S8", shopPolicy).includes("body_or_back_glass_damage"));
    assert.ok(!signals("아이패드 프로", "구성품은 박스, 지문방지필름, 케이스입니다. 기능상 하자 없음.").includes("faceid_or_biometric_issue"));
    assert.ok(!signals("갤럭시 워치7", "화면에는 기스없어요 줄은 다른걸로 교체하셔도 됩니다.").includes("screen_replaced_or_repaired"));
  });

  it("모서리/하단부 깨짐은 일반 하자 언급이 아니라 본체 파손 신호로 잡는다", () => {
    const parsed = parseListingOptions({
      category: "tablet",
      title: "아이패드 프로",
      description: "오른쪽 하단 깨짐 있어서 저렴히 팔아요. 하단부 금가 있는데 화면은 잘 나옵니다.",
    });

    assert.equal(parsed.conditionClass, "flawed");
    assert.ok(parsed.conditionNotes.includes("device_body_damage"));
  });

  it("활성화잠금과 휨 증상은 정상 작동 문구가 있어도 hard signal로 잡는다", () => {
    assert.ok(signals("아이패드 미니", "전체적으로 깨끗합니다. 다만 활성화잠금으로 사용못하고 있습니다.").includes("account_or_activation_lock"));
    assert.ok(signals("아이패드 7세대", "휨 증상이 있지만 기기 작동하는 데에는 문제 일절 없습니다.").includes("body_or_back_glass_damage"));
    assert.ok(signals("갤럭시탭 S9 화면X", "화면은 들어오지않고 충전기 꽂으면 전원은 들어옵니다.").includes("display_panel_issue"));
  });

  it("화면 깨진 곳 없음은 display defect로 오탐하지 않는다", () => {
    const parsed = parseListingOptions({
      category: "smartphone",
      title: "아이폰13미니128gb",
      description: "화면 깨진곳없고 필름 붙혀져 있습니다. 전면,후면 카메라와 버튼 다 눌리고 이상없습니다.",
    });

    assert.ok(!parsed.conditionNotes.includes("display_defect"));
  });

  it("카메라도 문제 없다는 문맥은 camera issue로 오탐하지 않는다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "갤럭시 s24 울트라",
      description: "액정도 기스없습니다. 카메라도 그렇구요. 문제하나 없는 폰입니다.",
    });

    assert.ok(!result.signals.includes("camera_issue"));
  });

  it("일본판 카메라 무음은 camera issue로 오탐하지 않는다", () => {
    assert.ok(!signals("아이폰 16 일본판", "기능 문제 없어요. 일본 아이폰이라 카메라 기본 무음이에요.").includes("camera_issue"));
  });

  it("카메라 렌즈/유리 손상은 기능 이상과 별도 하드 신호로 잡는다", () => {
    const crackedLens = parseListingOptions({
      category: "smartphone",
      title: "아이폰 15 블랙",
      description: "기능 문제 없어요. 카메라 렌즈 깨짐 있습니다.",
      skuId: "iphone-15",
      skuName: "iPhone 15",
    });
    const coverScratch = parseListingOptions({
      category: "smartphone",
      title: "갤럭시 S23 울트라",
      description: "액정 오른쪽 하단 약간 깨짐과 카메라 커버 부분에 크게 흠집이 있습니다.",
      skuId: "galaxy-s23-ultra",
      skuName: "Galaxy S23 Ultra",
    });
    const cameraBruise = parseListingOptions({
      category: "smartphone",
      title: "아이폰 13 프로",
      description: "카메라 멍 2개 정도 있음. 촬영은 가능하지만 사진 확인 필요합니다.",
      skuId: "iphone-13-pro",
      skuName: "iPhone 13 Pro",
    });

    assert.equal(crackedLens.conditionClass, "flawed");
    assert.ok((crackedLens.parsedJson.tech_device_condition_signals as string[]).includes("camera_lens_or_glass_damage"));
    assert.ok(crackedLens.conditionNotes.includes("camera_lens_damage"));
    assert.ok(coverScratch.conditionNotes.includes("camera_lens_damage"));
    assert.ok(cameraBruise.conditionNotes.includes("camera_lens_damage"));
  });

  it("카메라 정상/보호필름/카메라섬 생활기스는 렌즈 손상으로 오탐하지 않는다", () => {
    const noDamage = parseListingOptions({
      category: "smartphone",
      title: "아이폰 15 옐로",
      description: "액정, 카메라 기스및 파손 없습니다. 카메라보호필름, 풀케이스 착용해서 깨끗합니다.",
    });
    const normalCamera = parseListingOptions({
      category: "smartphone",
      title: "아이폰 15 프로",
      description: "찍힘, 깨짐, 기스 X. 카메라 이상, 수리 이력 X. 배터리 효율 84%",
    });
    const cameraIslandWear = parseListingOptions({
      category: "smartphone",
      title: "아이폰 13 프로",
      description: "기스나 깨짐 1도 없는 A급 모델이구요. 카메라섬 주변에 생활기스 정도 있습니다.",
    });

    assert.ok(!noDamage.conditionNotes.includes("camera_lens_damage"));
    assert.equal(noDamage.conditionClass, "clean");
    assert.ok(!normalCamera.conditionNotes.includes("camera_lens_damage"));
    assert.ok(!cameraIslandWear.conditionNotes.includes("camera_lens_damage"));
    assert.ok(!signals("아이폰 15", "카메라보호필름 부착되어 있습니다.").includes("camera_lens_or_glass_damage"));
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

  it("가개통/개통된 단말기 워치 LTE 제한은 carrier risk로 남긴다", () => {
    assert.ok(signals("갤럭시워치 울트라", "개통된단말기입니다 LTE불가 블루투스 잡아서 사용하셔야됩니다").includes("carrier_or_finance_risk"));
    assert.ok(signals("갤럭시워치8 울트라", "셀룰러사용 불가하고 블루투스로 사용가능 합니다 (가개통)").includes("carrier_or_finance_risk"));
  });

  it("확정기변 불가능은 carrier/finance risk로 남긴다", () => {
    const result = parseTechDeviceConditionEvidence({
      title: "아이폰 17 프로",
      description: "유심기변용이고 확정기변 불가능합니다.",
    });

    assert.ok(result.hardBlockCandidates.includes("carrier_or_finance_risk"));
  });

  it("parseListingOptions는 smartphone/tablet/smartwatch parsedJson에 condition-gate evidence를 저장한다", () => {
    const phone = parseListingOptions({
      category: "smartphone",
      title: "아이폰 17 프로",
      description: "유심기변용이고 확정기변 불가능합니다.",
      skuId: "iphone-17-pro",
      skuName: "iPhone 17 Pro",
    });
    const tablet = parseListingOptions({
      category: "tablet",
      title: "아이패드 미니 7",
      description: "아이클라우드 로그아웃 완료했고 초기화 완료입니다.",
      skuId: "ipad-mini",
      skuName: "iPad mini",
    });
    const watch = parseListingOptions({
      category: "smartwatch",
      title: "애플워치 8",
      description: "배터리 효율 78%, 사이클 620회입니다.",
      skuId: "apple-watch-series-8-41mm",
      skuName: "Apple Watch Series 8",
    });

    assert.equal((phone.parsedJson.tech_device_condition_policy as { mode?: string } | null)?.mode, "condition_gate_v1");
    assert.ok((phone.parsedJson.tech_device_condition_signals as string[]).includes("carrier_or_finance_risk"));
    assert.ok((tablet.parsedJson.tech_device_condition_signals as string[]).includes("unlocked_reset_positive"));
    assert.ok((watch.parsedJson.tech_device_condition_signals as string[]).includes("low_battery_health"));
  });

  it("hard tech evidence는 parseListingOptions condition_notes로 연결된다", () => {
    const parsed = parseListingOptions({
      category: "smartphone",
      title: "삼성 갤럭시 Z 플립 3 블랙",
      description: "녹색 라인이 있고 액정 화면 오른쪽 상단 검정색으로 되어있어서 그쪽 부분 터치안됨",
    });

    assert.equal(parsed.conditionClass, "flawed");
    assert.ok(parsed.conditionNotes.includes("display_defect"));
  });

  it("다른 카테고리 parsedJson에는 tech device shadow evidence를 박지 않는다", () => {
    const parsed = parseListingOptions({
      category: "earphone",
      title: "에어팟 프로 2",
      description: "정상 작동합니다.",
      skuId: "airpods-pro-2-usbc",
      skuName: "AirPods Pro 2 USB-C",
    });

    assert.equal(parsed.parsedJson.tech_device_condition_evidence, null);
    assert.equal(parsed.parsedJson.tech_device_condition_policy, null);
  });
});
