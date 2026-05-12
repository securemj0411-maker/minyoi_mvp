import assert from "node:assert/strict";
import test from "node:test";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

const monitorContractPassFixtures = [
  { pid: "405611963", title: "aw2525hm", skuId: "monitor-aw2525hm", key: "monitor|aw2525hm|25in|fhd|320hz|ips|unknown_shape" },
  { pid: "407507139", title: "XL2540K 240hz BenQ", description: "택배로 보내면 문제의 하자등이 발생할 수 있기때문에 직거래로 부탁드립니다.", skuId: "monitor-xl2540k", key: "monitor|xl2540k|24_5in|fhd|240hz|tn|unknown_shape" },
  { pid: "397185864", title: "벤큐 XL2540K (상태S급)", skuId: "monitor-xl2540k", key: "monitor|xl2540k|24_5in|fhd|240hz|tn|unknown_shape" },
  { pid: "395930226", title: "벤큐 XL2540k", skuId: "monitor-xl2540k", key: "monitor|xl2540k|24_5in|fhd|240hz|tn|unknown_shape" },
  { pid: "363589705", title: "BenQ 벤큐 ZOWIE XL2540K 게이밍모니터 판매합니다.", skuId: "monitor-xl2540k", key: "monitor|xl2540k|24_5in|fhd|240hz|tn|unknown_shape" },
  { pid: "394321832", title: "xl2540k 240hz", skuId: "monitor-xl2540k", key: "monitor|xl2540k|24_5in|fhd|240hz|tn|unknown_shape" },
];

const newlyCoveredLiveReadFixtures = [
  { pid: "397559150", title: "소니a7m3  상태좋은바디 판매합니다", description: "m3 처분합니다\n풀박스구성입니다\n관리잘하고쓰던거라상태조좋아요", skuId: "camera-sony-a7m3", key: "camera|sony|a7_iii|body_only|no_lens" },
  { pid: "162388869", title: "소니 a7m3   ilce-7m3 바디셋", description: "컷수 2000\n외관 깔끔합니다\n바디셋 렌즈 별도", skuId: "camera-sony-a7m3", key: "camera|sony|a7_iii|body_only|no_lens" },
  { pid: "405349514", title: "JBL 플립6 팝니다", description: "급하게 팝니다 음질이상없고 JBL 로고만 조금 더럽습니다 직거 남춘천역\n쿨거시 네고 ㄱㄴ", skuId: "speaker-jbl-flip-6", key: "speaker|jbl_flip_6|portable_bluetooth_speaker" },
  { pid: "392643820", title: "jbl플립6", description: "JBL 플립6 블랙 색상 박스있고 교신보긴봄 거파금2 직거대전 택거시 택배비 본인부담\n음질이 소리 최소로 하면 안좋고 최대로하면 좋아요", skuId: "speaker-jbl-flip-6", key: "speaker|jbl_flip_6|portable_bluetooth_speaker" },
  { pid: "406437446", title: "Jbl flip6 블루투스 스피커 풀박스(설명서 충전단자 포함)", description: "직거래는 대구 수성구 두산동 쪽에서 가능하고 안전결제도되요", skuId: "speaker-jbl-flip-6", key: "speaker|jbl_flip_6|portable_bluetooth_speaker" },
  { pid: "405256022", title: "JBL 플립6 블루투스 스피커 민트색상", description: "JBL 플립6 민트색 블루투스 스피커입니다. 생활 기스 약간 있고, 음질은 이상 없습니다", skuId: "speaker-jbl-flip-6", key: "speaker|jbl_flip_6|portable_bluetooth_speaker" },
];

test("live-read monitor contract-pass fixtures stay runtime-ready", () => {
  for (const fixture of monitorContractPassFixtures) {
    const classified = classifyListing(fixture.title, fixture.description ?? "", 100_000);
    assert.equal(classified.listingType, "normal", fixture.pid);
    assert.equal(classified.sku?.id, fixture.skuId, fixture.pid);

    const parsed = parseListingOptions({
      category: classified.sku?.category ?? null,
      skuId: classified.sku?.id ?? null,
      skuName: classified.sku?.modelName ?? null,
      title: fixture.title,
      description: fixture.description ?? "",
    });
    assert.equal(parsed.comparableKey, fixture.key, fixture.pid);
    assert.equal(parsed.needsReview, false, fixture.pid);
  }
});

test("live-read exact fixtures stay runtime-ready without additional public wiring", () => {
  for (const fixture of newlyCoveredLiveReadFixtures) {
    const classified = classifyListing(fixture.title, fixture.description, 100_000);
    assert.equal(classified.listingType, "normal", fixture.pid);
    assert.equal(classified.sku?.id, fixture.skuId, fixture.pid);

    const parsed = parseListingOptions({
      category: classified.sku?.category ?? null,
      skuId: classified.sku?.id ?? null,
      skuName: classified.sku?.modelName ?? null,
      title: fixture.title,
      description: fixture.description,
    });
    assert.equal(parsed.comparableKey, fixture.key, fixture.pid);
    assert.equal(parsed.needsReview, false, fixture.pid);
  }
});

test("live-read preserved hold fixtures stay out of runtime-ready pool", () => {
  assert.equal(
    classifyListing("소니 a7m2 바디셋", "", 900_000).listingType,
    "unknown",
  );
  assert.equal(
    classifyListing("소니 a7m4  바디셋", "", 2_000_000).listingType,
    "unknown",
  );
  assert.notEqual(
    classifyListing("소니 e마운트 바디캡", "", 10_000).listingType,
    "normal",
  );
  assert.equal(
    classifyListing("소니 a7m3 바디 삽니다", "", 1_200_000).listingType,
    "buying",
  );
  assert.notEqual(
    classifyListing("밴큐 XL2540k 240hz 모니터 새제품급", "새제품급 모니터 2대 중 1대 판매합니다.", 260_000).listingType,
    "normal",
  );
  assert.notEqual(
    classifyListing("Jbl 플립6 스피커+듣보 스피커 일괄판매", "", 100_000).listingType,
    "normal",
  );
  assert.equal(
    classifyListing("Jbl 플립 6", "", 70_000).listingType,
    "unknown",
  );
  assert.equal(
    classifyListing("JBL FLIP6", "", 70_000).listingType,
    "unknown",
  );
  assert.notEqual(
    classifyListing("[대여]jbl flip6 블루투스 스피커 1일 단기 렌탈 임대", "", 20_000).listingType,
    "normal",
  );
  assert.equal(
    classifyListing("정품 JBL 플립6 하드쉘 케이스", "", 12_000).listingType,
    "accessory",
  );
});
