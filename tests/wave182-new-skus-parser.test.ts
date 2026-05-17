// Wave 182 Phase 2 회귀: 33개 새 narrow SKU 매물 매칭 + comparable_key 완성 검증.
// 사용자 지적 "파서도 다 넣어야 되는 거 아님?" — SKU만 박고 parser 미보강이면 needs_review=true로 풀 진입 X.
// 각 SKU의 대표 매물 텍스트로 ruleMatch + parseListingOptions 호출 → narrow comparable_key 완성하는지.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";

function check(title: string, desc: string, expectedSkuId: string, expectKeyContains: string[]) {
  const matched = ruleMatch(title, desc);
  assert.equal(matched?.id, expectedSkuId, `ruleMatch fail: "${title}" → expected ${expectedSkuId}, got ${matched?.id ?? "null"}`);
  const parsed = parseListingOptions({
    title,
    description: desc,
    skuId: matched?.id,
    skuName: matched?.modelName,
    category: matched?.category,
  });
  assert.ok(parsed.comparableKey, `comparable_key null: "${title}"`);
  for (const part of expectKeyContains) {
    assert.ok(parsed.comparableKey!.includes(part), `comparable_key missing "${part}": "${parsed.comparableKey}" (title: "${title}")`);
  }
  assert.equal(parsed.needsReview, false, `needs_review=true (parser unknown): "${title}" → ${parsed.comparableKey}`);
}

describe("Wave 182 chunk 1: M1 Air + iPad mini 6 + iPad Air 5", () => {
  it("macbook-air-m1-13-256: 맥북 에어 M1 13인치 8GB 256GB", () => {
    check(
      "맥북 에어 M1 13인치 8GB 256GB 스페이스 그레이",
      "정상 작동 풀박스. 충전기 포함.",
      "macbook-air-m1-13-256",
      ["macbook_air", "m1", "13in", "8gb_ram", "256gb_ssd"],
    );
  });

  it("ipad-mini-6-64-wifi: 아이패드 미니 6 64GB Wi-Fi", () => {
    check(
      "아이패드 미니 6 64GB 와이파이 스페이스그레이",
      "A15 칩셋. 정상 작동.",
      "ipad-mini-6-64-wifi",
      ["ipad_mini", "64gb", "wifi"],
    );
  });

  it("ipad-mini-6-256-wifi: 아이패드 미니 6 256GB Wi-Fi", () => {
    check(
      "아이패드 미니 6 256GB Wi-Fi 핑크",
      "정상.",
      "ipad-mini-6-256-wifi",
      ["ipad_mini", "256gb", "wifi"],
    );
  });

  it("ipad-air-5-m1-64-wifi: 아이패드 에어 5 64GB Wi-Fi", () => {
    check(
      "아이패드 에어 5 64GB 와이파이 M1",
      "정상.",
      "ipad-air-5-m1-64-wifi",
      ["ipad_air", "64gb", "wifi"],
    );
  });

  it("ipad-air-5-m1-256-wifi: 아이패드 에어 5 256GB Wi-Fi", () => {
    check(
      "아이패드 에어 5 256GB Wi-Fi 블루",
      "M1 칩.",
      "ipad-air-5-m1-256-wifi",
      ["ipad_air", "256gb", "wifi"],
    );
  });
});

describe("Wave 182 chunks 2+3: MacBook Pro 14 / 16 M-series", () => {
  it("macbook-pro-14-m1-pro-16-512", () => {
    check(
      "맥북 프로 14인치 M1 Pro 16GB 512GB 스페이스그레이",
      "2021년 모델. 정상.",
      "macbook-pro-14-m1-pro-16-512",
      ["macbook_pro", "14in", "16gb_ram", "512gb_ssd"],
    );
  });

  it("macbook-pro-14-m1-max-32-1tb", () => {
    check(
      "맥북 프로 14인치 M1 Max 32GB 1TB",
      "2021. 정상.",
      "macbook-pro-14-m1-max-32-1tb",
      ["macbook_pro", "14in", "32gb_ram", "1024gb_ssd"],
    );
  });

  it("macbook-pro-14-m3-max-36-1tb", () => {
    check(
      "맥북 프로 14인치 M3 Max 36GB 1TB",
      "2023. 정상.",
      "macbook-pro-14-m3-max-36-1tb",
      ["macbook_pro", "14in", "36gb_ram", "1024gb_ssd"],
    );
  });

  it("macbook-pro-14-m4-pro-24-512", () => {
    check(
      "맥북 프로 14인치 M4 Pro 24GB 512GB",
      "2024. 정상.",
      "macbook-pro-14-m4-pro-24-512",
      ["macbook_pro", "14in", "24gb_ram", "512gb_ssd"],
    );
  });

  it("macbook-pro-16-m1-pro-16-512", () => {
    check(
      "맥북 프로 16인치 M1 Pro 16GB 512GB",
      "2021. 정상.",
      "macbook-pro-16-m1-pro-16-512",
      ["macbook_pro", "16in", "16gb_ram", "512gb_ssd"],
    );
  });

  it("macbook-pro-16-m4-max-36-1tb", () => {
    check(
      "맥북 프로 16인치 M4 Max 36GB 1TB",
      "2024. 정상.",
      "macbook-pro-16-m4-max-36-1tb",
      ["macbook_pro", "16in", "36gb_ram", "1024gb_ssd"],
    );
  });
});

describe("Wave 182 chunk 4: Air 15 + iPad Pro M1 + iPad Air 4", () => {
  it("macbook-air-m2-15-256: 맥북 에어 M2 15인치 8GB 256GB", () => {
    check(
      "맥북 에어 M2 15인치 8GB 256GB",
      "2023. 정상.",
      "macbook-air-m2-15-256",
      ["macbook_air", "m2", "15in", "8gb_ram", "256gb_ssd"],
    );
  });

  it("macbook-air-m4-15-256: 맥북 에어 M4 15인치 16GB 256GB", () => {
    check(
      "맥북 에어 M4 15인치 16GB 256GB",
      "2025. 정상.",
      "macbook-air-m4-15-256",
      ["macbook_air", "m4", "15in", "16gb_ram", "256gb_ssd"],
    );
  });

  it("ipad-pro-11-m1-128-wifi", () => {
    check(
      "아이패드 프로 11인치 M1 128GB 와이파이",
      "2021. 3세대. 정상.",
      "ipad-pro-11-m1-128-wifi",
      ["ipad_pro", "128gb", "wifi"],
    );
  });

  // Wave 182 root fix (2026-05-17): catalog normalize 가 "12.9" → "13인치" 변환 (Wave 114c).
  // 옛 narrow SKU mustContain "12.9" 만 박혀서 변환 후 매칭 fail + mustNotContain "13인치" 자기자신 차단.
  // Fix: mustContain 에 "13인치" 추가 + mustNotContain "13인치" 제거. m1 chip 으로 m2/m4 narrow 격리.
  it("ipad-pro-12-9-m1-128-wifi", () => {
    check(
      "아이패드 프로 12.9인치 M1 128GB Wi-Fi",
      "2021. 5세대. 정상.",
      "ipad-pro-12-9-m1-128-wifi",
      ["ipad_pro", "128gb", "wifi"],
    );
  });

  it("ipad-air-4-64-wifi", () => {
    check(
      "아이패드 에어 4 64GB 와이파이",
      "A14. 2020년 모델. 정상.",
      "ipad-air-4-64-wifi",
      ["ipad_air", "64gb", "wifi"],
    );
  });
});

describe("Wave 182 chunk 4: Galaxy Tab S7 / Galaxy S20 / Galaxy Note", () => {
  it("galaxy-tab-s7", () => {
    check(
      "갤럭시탭 S7 128GB Wi-Fi",
      "정상.",
      "galaxy-tab-s7",
      ["galaxy_tab"],
    );
  });

  it("galaxy-tab-s7-plus", () => {
    check(
      "갤럭시탭 S7 플러스 256GB Wi-Fi",
      "정상.",
      "galaxy-tab-s7-plus",
      ["galaxy_tab"],
    );
  });

  it("galaxy-tab-s7-fe", () => {
    check(
      "갤럭시탭 S7 FE 64GB Wi-Fi",
      "정상.",
      "galaxy-tab-s7-fe",
      ["galaxy_tab"],
    );
  });

  it("galaxy-s20", () => {
    check(
      "갤럭시 S20 128GB 미라지 화이트",
      "정상.",
      "galaxy-s20",
      ["galaxy_s", "128gb"],
    );
  });

  it("galaxy-s20-plus", () => {
    check(
      "갤럭시 S20 플러스 128GB",
      "정상.",
      "galaxy-s20-plus",
      ["galaxy_s", "128gb"],
    );
  });

  it("galaxy-s20-ultra", () => {
    check(
      "갤럭시 S20 울트라 256GB",
      "정상.",
      "galaxy-s20-ultra",
      ["galaxy_s", "256gb"],
    );
  });

  it("galaxy-note20-ultra", () => {
    check(
      "갤럭시 노트20 울트라 256GB",
      "정상.",
      "galaxy-note20-ultra",
      ["256gb"],
    );
  });

  it("galaxy-note10", () => {
    check(
      "갤럭시 노트10 256GB",
      "정상.",
      "galaxy-note10",
      ["256gb"],
    );
  });

  it("galaxy-note10-plus", () => {
    check(
      "갤럭시 노트10 플러스 256GB",
      "정상.",
      "galaxy-note10-plus",
      ["256gb"],
    );
  });
});

describe("Wave 182 chunk 5: 옛 인기 모델 (mini 5, iPad 7/8, Z Flip/Fold 3, Watch 3/Active 2)", () => {
  it("ipad-mini-5-64-wifi", () => {
    check(
      "아이패드 미니 5 64GB Wi-Fi",
      "A12 칩. 정상.",
      "ipad-mini-5-64-wifi",
      ["ipad_mini", "64gb", "wifi"],
    );
  });

  it("ipad-7", () => {
    check(
      "아이패드 7세대 32GB Wi-Fi",
      "정상.",
      "ipad-7",
      [],
    );
  });

  it("ipad-8", () => {
    check(
      "아이패드 8세대 32GB Wi-Fi",
      "정상.",
      "ipad-8",
      [],
    );
  });

  it("galaxy-z-flip-3", () => {
    check(
      "갤럭시 Z플립3 256GB",
      "정상.",
      "galaxy-z-flip-3",
      ["256gb"],
    );
  });

  it("galaxy-z-fold-3", () => {
    check(
      "갤럭시 Z폴드3 256GB",
      "정상.",
      "galaxy-z-fold-3",
      ["256gb"],
    );
  });

  it("galaxywatch-3", () => {
    check(
      "갤럭시 워치 3 44mm",
      "정상.",
      "galaxywatch-3",
      [],
    );
  });

  it("galaxywatch-active-2", () => {
    check(
      "갤럭시 워치 액티브 2 44mm",
      "정상.",
      "galaxywatch-active-2",
      [],
    );
  });
});

describe("Wave 182 chunk 6: Sony LinkBuds + Bose 700/Earbuds II + Galaxy Buds 2/Live + Galaxy Tab S6", () => {
  it("sony-linkbuds", () => {
    check("소니 LinkBuds WF-L900", "도넛 디자인.", "sony-linkbuds", []);
  });

  it("sony-linkbuds-s", () => {
    check("소니 LinkBuds S WF-LS900N", "정상.", "sony-linkbuds-s", []);
  });

  it("sony-linkbuds-fit", () => {
    check("소니 LinkBuds Fit WF-LS910N", "정상.", "sony-linkbuds-fit", []);
  });

  it("bose-700-headphones", () => {
    check("Bose 700 헤드폰 블랙", "정상.", "bose-700-headphones", []);
  });

  it("bose-qc-earbuds-ii", () => {
    check("Bose QC 이어버드 II", "정상.", "bose-qc-earbuds-ii", []);
  });

  it("galaxy-buds-2", () => {
    check("갤럭시 버즈 2 라벤더", "정상.", "galaxy-buds-2", []);
  });

  it("galaxy-buds-2-pro", () => {
    check("갤럭시 버즈 2 프로 그래파이트", "정상.", "galaxy-buds-2-pro", []);
  });

  it("galaxy-buds-live", () => {
    check("갤럭시 버즈 라이브 미스틱 브론즈", "정상.", "galaxy-buds-live", []);
  });

  it("galaxy-tab-s6", () => {
    check("갤럭시탭 S6 128GB Wi-Fi", "정상.", "galaxy-tab-s6", []);
  });

  it("galaxy-tab-s6-lite", () => {
    check("갤럭시탭 S6 Lite 64GB Wi-Fi", "정상.", "galaxy-tab-s6-lite", []);
  });
});

describe("Wave 187: 가민 워치 (smartwatch 확장)", () => {
  it("garmin-fenix-7", () => check("가민 페닉스 7", "47mm.", "garmin-fenix-7", []));
  it("garmin-fenix-7s", () => check("가민 페닉스 7S", "42mm.", "garmin-fenix-7s", []));
  it("garmin-fenix-7x", () => check("가민 페닉스 7X", "51mm.", "garmin-fenix-7x", []));
  it("garmin-fenix-8", () => check("가민 페닉스 8", "AMOLED.", "garmin-fenix-8", []));
  it("garmin-forerunner-265", () => check("가민 포러너 265", "정상.", "garmin-forerunner-265", []));
  it("garmin-forerunner-955", () => check("가민 포러너 955", "정상.", "garmin-forerunner-955", []));
  it("garmin-forerunner-965", () => check("가민 포러너 965", "정상.", "garmin-forerunner-965", []));
  it("garmin-instinct-2", () => check("가민 인스팅트 2", "정상.", "garmin-instinct-2", []));
  it("garmin-venu-3", () => check("가민 비누 3", "정상.", "garmin-venu-3", []));
  it("garmin-epix-pro", () => check("가민 에픽스 프로", "Gen 2.", "garmin-epix-pro", []));
});

describe("Wave 186: 새 카테고리 kickboard (전동킥보드/스쿠터)", () => {
  it("xiaomi-mi-scooter-pro-2", () => check("샤오미 미 스쿠터 프로 2 킥보드", "정상.", "xiaomi-mi-scooter-pro-2", []));
  it("xiaomi-mi-scooter-3", () => check("샤오미 미 스쿠터 3 전동킥보드", "정상.", "xiaomi-mi-scooter-3", []));
  it("xiaomi-mi-scooter-4", () => check("샤오미 미 스쿠터 4 킥보드", "정상.", "xiaomi-mi-scooter-4", []));
  it("xiaomi-mi-scooter-4-pro", () => check("샤오미 미 스쿠터 4 프로", "전동킥보드.", "xiaomi-mi-scooter-4-pro", []));
  it("xiaomi-mi-scooter-4-ultra", () => check("샤오미 미 스쿠터 4 울트라", "전동킥보드.", "xiaomi-mi-scooter-4-ultra", []));
  it("ninebot-max-g2", () => check("세그웨이 닌봇 맥스 G2", "정상.", "ninebot-max-g2", []));
  it("ninebot-f40", () => check("세그웨이 닌봇 F40", "정상.", "ninebot-f40", []));
  it("ninebot-f30", () => check("닌봇 F30", "정상.", "ninebot-f30", []));
  it("ninebot-e45", () => check("닌봇 E45", "정상.", "ninebot-e45", []));
});

describe("Wave 185: 새 카테고리 perfume (명품 향수)", () => {
  it("jo-malone-wood-sage-sea-salt-100", () => check("조말론 우드세이지 시솔트 100ml", "정상.", "jo-malone-wood-sage-sea-salt-100", []));
  it("le-labo-santal-33-50", () => check("르라보 산탈 33 50ml", "정상.", "le-labo-santal-33-50", []));
  it("le-labo-santal-33-100", () => check("르라보 산탈 33 100ml", "정상.", "le-labo-santal-33-100", []));
  it("diptyque-philosykos-75", () => check("Diptyque Philosykos 75ml", "정상.", "diptyque-philosykos-75", []));
  it("tom-ford-tobacco-vanille-50", () => check("Tom Ford Tobacco Vanille 50ml", "정상.", "tom-ford-tobacco-vanille-50", []));
  it("replica-jazz-club-100", () => check("Replica Jazz Club 100ml", "정상.", "replica-jazz-club-100", []));
  it("memo-russian-leather-75", () => check("Memo Russian Leather 75ml", "정상.", "memo-russian-leather-75", []));
});

describe("Wave 184: 새 카테고리 drone (DJI 드론 + DJI 액션캠 + GoPro)", () => {
  it("dji-mini-2", () => check("DJI Mini 2", "정상.", "dji-mini-2", []));
  it("dji-mini-3-pro", () => check("DJI Mini 3 Pro", "정상.", "dji-mini-3-pro", []));
  it("dji-mini-4-pro", () => check("DJI Mini 4 Pro", "정상.", "dji-mini-4-pro", []));
  it("dji-mavic-3", () => check("DJI Mavic 3 본체", "정상.", "dji-mavic-3", []));
  it("dji-mavic-3-pro", () => check("DJI Mavic 3 Pro", "정상.", "dji-mavic-3-pro", []));
  it("dji-mavic-3-classic", () => check("DJI Mavic 3 Classic", "정상.", "dji-mavic-3-classic", []));
  it("dji-air-2s", () => check("DJI Air 2S", "정상.", "dji-air-2s", []));
  it("dji-air-3", () => check("DJI Air 3", "정상.", "dji-air-3", []));
  it("dji-air-3s", () => check("DJI Air 3S", "정상.", "dji-air-3s", []));
  it("dji-avata", () => check("DJI Avata 본체", "정상.", "dji-avata", []));
  it("dji-avata-2", () => check("DJI Avata 2", "정상.", "dji-avata-2", []));
  it("dji-osmo-action-3", () => check("DJI Osmo Action 3", "정상.", "dji-osmo-action-3", []));
  it("dji-osmo-action-4", () => check("DJI Osmo Action 4", "정상.", "dji-osmo-action-4", []));
  it("dji-osmo-action-5-pro", () => check("DJI Osmo Action 5 Pro", "정상.", "dji-osmo-action-5-pro", []));
  it("dji-osmo-pocket-2", () => check("DJI Osmo Pocket 2", "정상.", "dji-osmo-pocket-2", []));
  it("dji-osmo-pocket-3", () => check("DJI Osmo Pocket 3", "정상.", "dji-osmo-pocket-3", []));
  it("gopro-hero-9", () => check("GoPro Hero 9 Black", "정상.", "gopro-hero-9", []));
  it("gopro-hero-10", () => check("GoPro Hero 10 Black", "정상.", "gopro-hero-10", []));
  it("gopro-hero-11", () => check("GoPro Hero 11 Black", "정상.", "gopro-hero-11", []));
  it("gopro-hero-12", () => check("GoPro Hero 12 Black", "정상.", "gopro-hero-12", []));
  it("gopro-hero-13", () => check("GoPro Hero 13 Black", "정상.", "gopro-hero-13", []));
  it("gopro-max", () => check("GoPro Max 360", "정상.", "gopro-max", []));
});

describe("Wave 183: 헤어 기기 (home_appliance 확장)", () => {
  it("dyson-supersonic-hd08", () => {
    check("다이슨 슈퍼소닉 HD08 핑크", "정상.", "dyson-supersonic-hd08", []);
  });

  it("dyson-supersonic-origin", () => {
    check("다이슨 슈퍼소닉 오리진 HD13", "정상.", "dyson-supersonic-origin", []);
  });

  it("dyson-airwrap-hs05", () => {
    check("다이슨 에어랩 멀티스타일러", "Complete HS05", "dyson-airwrap-hs05", []);
  });

  it("dyson-airwrap-id", () => {
    check("다이슨 에어랩 i.d. 코안다 2x", "HS08", "dyson-airwrap-id", []);
  });

  it("dyson-corrale-hs07", () => {
    check("다이슨 코랄 HS07 무선 고데기", "정상.", "dyson-corrale-hs07", []);
  });

  it("cyaars-glampam", () => {
    check("시아루스 글램팜", "정상.", "cyaars-glampam", []);
  });

  it("panasonic-eh-na0j", () => {
    check("파나소닉 EH-NA0J 나노이", "정상.", "panasonic-eh-na0j", []);
  });

  it("babyliss-pro-2174u", () => {
    check("바비리스 프로 2174U 파마기", "정상.", "babyliss-pro-2174u", []);
  });
});

describe("Wave 182 Phase 4: Galaxy Book 시리즈", () => {
  it("galaxy-book-4", () => {
    check("갤럭시북 4 15.6인치 16GB 512GB", "Intel Core 5", "galaxy-book-4", []);
  });

  it("galaxy-book-4-pro", () => {
    check("갤럭시북 4 프로 14인치 16GB 512GB", "Core Ultra 7", "galaxy-book-4-pro", []);
  });

  it("galaxy-book-4-ultra", () => {
    check("갤럭시북 4 울트라 16인치 RTX 4070", "Core Ultra 9", "galaxy-book-4-ultra", []);
  });

  it("galaxy-book-5", () => {
    check("갤럭시북 5 15.6인치", "Intel Core 5", "galaxy-book-5", []);
  });

  it("galaxy-book-5-pro", () => {
    check("갤럭시북 5 프로 14인치", "Core Ultra 5", "galaxy-book-5-pro", []);
  });
});
