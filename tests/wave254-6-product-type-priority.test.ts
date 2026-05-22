// Wave 254.6 (2026-05-20): parseClothingProductType / parseBagProductType regex 우선순위 정정.
//   사용자 발견 root cause — pid 331382713 "빔즈 노스페이스 눕시 쇼츠":
//     기존: 모델명 (눕시/nuptse) 이 product_type 키워드 (쇼츠/shorts) 보다 먼저 매칭 → down_jacket 잘못.
//     fix: 명시적 product_type 키워드 (쇼츠/모자/벨트/지갑/원피스/스커트) 가 모델명 기반 패턴보다 먼저.
//   systemic 영향: clothing-tnf-* / clothing-polo-rrl-* / clothing-fog-* + 쇼츠/모자/벨트 매물.
//   catalog 2차 safety: jacket/down_jacket/coat SKU 가 명백 product_type 키워드 매물 자동 reject.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseListingOptions } from "@/lib/option-parser";
import { ruleMatch } from "@/lib/catalog";

describe("Wave 254.6 — clothing product_type regex 우선순위", () => {
  describe("user-reported root case", () => {
    it("pid 331382713 — '빔즈 노스페이스 눕시 쇼츠 M' → shorts (down_jacket X)", () => {
      const result = parseListingOptions({
        title: "빔즈 노스페이스 눕시 쇼츠 M 사이즈 판매합니다",
        description: "제품 : 빔즈 노스페이스 Nuptse Short",
        skuId: null, // catalog mustNotContain 가 reject → skuId null 가능
        skuName: null,
        category: "clothing",
      });
      const productType = (result.parsedJson as any).clothing_product_type;
      assert.equal(productType, "shorts",
        `parseClothingProductType returned ${productType} for "눕시 쇼츠" (expected shorts)`);
    });
  });

  describe("systemic — 모델명 (jacket/down_jacket) + product_type 키워드", () => {
    const cases = [
      { title: "노스페이스 눕시 쇼츠 M", expected: "shorts", reason: "down_jacket 모델명 + shorts" },
      { title: "노스페이스 마운틴 자켓 쇼츠", expected: "shorts", reason: "jacket 모델명 + shorts" },
      { title: "노스페이스 데날리 모자", expected: "cap", reason: "jacket 모델명 + cap" },
      { title: "슈프림 노스페이스 모자", expected: "cap", reason: "supreme collab + cap" },
      { title: "폴로 RRL 데님 쇼츠", expected: "shorts", reason: "denim 모델명 + shorts" },
      { title: "칼하트 오리지널 재팬 카펜터 워크 데님 숏팬츠", expected: "shorts", reason: "숏팬츠 should beat generic pants" },
      { title: "폴로 랄프로렌 벨트", expected: "belt", reason: "폴로 + belt (polo_shirt 매칭 X)" },
      { title: "구찌 다운 베스트 지갑", expected: "wallet", reason: "down_jacket 키워드 + wallet" },
      { title: "프라다 스커트", expected: "skirt", reason: "skirt 정확 매칭" },
      { title: "샤넬 원피스", expected: "dress", reason: "dress 정확 매칭" },
      { title: "슈프림 노스페이스 카고 자켓 블랙 XL", expected: "jacket", reason: "bare 카고 + 자켓 is jacket, not pants" },
      { title: "슈프림 노스페이스 카고 팬츠 블랙 XL", expected: "pants", reason: "카고 팬츠 remains pants" },
      { title: "아크테릭스 스쿼미시 후디 클로리스", expected: "jacket", reason: "outdoor Hoody = jacket line" },
      { title: "아크테릭스 감마LT 후디", expected: "jacket", reason: "Arc'teryx Hoody = jacket line" },
      { title: "아크테릭스 아톰 블랙 후드 달려있음", expected: "jacket", reason: "Arc'teryx hooded jacket description" },
      { title: "아크테릭스 알파sv 새상품", expected: "jacket", reason: "Arc'teryx Alpha SV hard-shell title can omit jacket" },
      { title: "BAPE ABC Camo Shark Half Zip 베이프 반집업", expected: "hoodie_zip", reason: "BAPE Shark half zip = hoodie zip" },
      { title: "챔피온 리버스위브 후드티셔츠 판매합니다", expected: "hoodie", reason: "후드티셔츠 is hoodie, not tee" },
      { title: "라코스테 피케티셔츠 새상품", expected: "polo_shirt", reason: "pique tee = polo shirt" },
      { title: "라코스테 슬림핏 폴로티셔츠 블루", expected: "polo_shirt", reason: "폴로티셔츠 is polo/pique shirt, not generic tee" },
      { title: "폴로 랄프로렌 옥스포드 멀티포니 체크셔츠 M", expected: "shirt", reason: "Polo brand token should not beat explicit shirt" },
      { title: "톰브라운 반팔셔츠 100", expected: "shirt", reason: "반팔셔츠 is shirt, not tee" },
      { title: "톰브라운 스트라이프 반팔 카라티 1사이즈", expected: "polo_shirt", reason: "카라티 is polo shirt" },
      { title: "톰브라운 스트라이프 폴로셔츠 사이즈 4", expected: "polo_shirt", reason: "폴로셔츠 is polo shirt, not generic shirt" },
      { title: "정품 톰브라운 화이트 후드 옥스포드 짚업셔츠 2", expected: "shirt", reason: "hooded oxford zip shirt is shirt, not hoodie" },
      { title: "comme des garcons blouse", expected: "shirt", reason: "blouse is shirt-like, not tee" },
      { title: "톰브라운 사선 니트 긴팔 티셔츠", expected: "long_sleeve_tee", reason: "knit long-sleeve tee should not enter knit/sweater comparable" },
    ];
    for (const { title, expected, reason } of cases) {
      it(`"${title}" → ${expected} (${reason})`, () => {
        const result = parseListingOptions({
          title,
          description: title,
          skuId: null,
          skuName: null,
          category: "clothing",
        });
        const productType = (result.parsedJson as any).clothing_product_type;
        assert.equal(productType, expected, `expected ${expected}, got ${productType}`);
      });
    }
  });

  describe("football shoe broad lanes keep brand in comparable model", () => {
    it("Adidas and Puma football shoes do not share one generic football key", () => {
      const adidas = parseListingOptions({
        title: "아디다스 프레데터 엣지.1 260",
        description: "거의새거입니다",
        skuId: "shoe-adidas-football",
        skuName: "Adidas Football",
        category: "shoe",
      });
      const puma = parseListingOptions({
        title: "푸마 울트라 축구화 260",
        description: "거의새거입니다",
        skuId: "shoe-puma-football",
        skuName: "Puma Football",
        category: "shoe",
      });

      assert.equal(adidas.comparableKey, "shoe|adidas_football_predator|football_shoe|260|a_grade");
      assert.equal(puma.comparableKey, "shoe|puma_football|football_shoe|260|a_grade");
    });

    it("Nike Mercurial football surface variants do not share one sample bucket", () => {
      const futsal = parseListingOptions({
        title: "나이키 머큐리얼 베이퍼15 풋살화 265mm",
        description: "한번 신은거라서 아주 깨끗하고 좋습니다",
        skuId: "shoe-nike-mercurial-broad",
        skuName: "Nike Mercurial Vapor (축구화)",
        category: "shoe",
      });
      const eliteFg = parseListingOptions({
        title: "나이키 머큐리얼 베이퍼 15 엘리트 FG 265",
        description: "상태 좋습니다",
        skuId: "shoe-nike-mercurial-broad",
        skuName: "Nike Mercurial Vapor (축구화)",
        category: "shoe",
      });

      assert.equal(futsal.comparableKey, "shoe|nike_mercurial_broad|football_tf|265|b_grade");
      assert.equal(eliteFg.comparableKey, "shoe|nike_mercurial_broad|football_fg|265|b_grade");
    });
  });

  describe("CDG PVC bag direct lane", () => {
    it("pvc가방/pvc백 붙임 표현도 CDG broad가 아니라 PVC bag lane으로 간다", () => {
      assert.equal(ruleMatch("꼼데가르송 PVC가방,투명가방", "")?.id, "bag-cdg-pvc");
      assert.equal(ruleMatch("꼼데가르송 pvc백", "")?.id, "bag-cdg-pvc");
      assert.equal(ruleMatch("꼼데가르송 pvc가방 cdg가방", "")?.id, "bag-cdg-pvc");
    });

    it("Gucci x CDG 100주년 PVC collab은 CDG PVC bag lane에 섞지 않는다", () => {
      assert.equal(ruleMatch("구찌 100주년 꼼데가르송 PVC 토트백 지드래곤", "")?.id ?? null, null);
    });
  });

  describe("LV wallet and Acne tee direct lanes", () => {
    it("LV Zippy/Sarah wallet Korean spacing variants stay in wallet lanes", () => {
      assert.equal(ruleMatch("[새상품 / 정품] 루이비통 모노그램 지피 월릿 지퍼 장지갑", "")?.id, "bag-lv-zippy-wallet-monogram");
      assert.equal(ruleMatch("루이비통 모노그램 [지피월릿 / 장지갑] 정품", "")?.id, "bag-lv-zippy-wallet-monogram");
      assert.equal(ruleMatch("루이비통 모노그램 사라 월릿 장지갑", "")?.id, "bag-lv-sarah-wallet-monogram");
      assert.equal(ruleMatch("루이비통 다미에 지피 월릿 장지갑", "")?.id ?? null, null);
    });

    it("Acne knit/tee/polo residuals route to separate apparel lanes", () => {
      assert.equal(ruleMatch("아크네 스튜디오 포켓 반팔 버건디 컬러 라지 사이즈", "포켓 반팔 티셔츠입니다")?.id, "clothing-acne-tee");
      assert.equal(ruleMatch("아크네 스튜디오 네이비 롱슬리브 니트", "")?.id, "clothing-acne-knit");
      assert.equal(ruleMatch("아크네 스튜디오 ACNE 브이넥 긴팔 롱슬리브 니트티", "")?.id, "clothing-acne-knit");
      assert.equal(ruleMatch("아크네 스튜디오 블랙 반팔 폴로티", "")?.id, "clothing-acne-polo");
    });

    it("Acne button-up short-sleeve shirts do not route to tee", () => {
      assert.equal(
        ruleMatch("아크네 버튼업 반팔셔츠 48", "차은우가 입었던 버튼업 셔츠 반팔버전입니다.")?.id,
        "clothing-acne-shirt",
      );
    });
  });

  describe("Wave 492 — fashion tail conservative splits", () => {
    it("purchase history text should not look like a buy-request listing", () => {
      assert.equal(
        ruleMatch("acne studio 아크네 남성 울코트 판매합니다", "구매 100초반이였는데 할인받아서 90때 샀습니다")?.id,
        "clothing-acne-jacket-coat",
      );
      assert.equal(
        ruleMatch("아크테릭스 감마mx후디 정품 s", "무등산 아크테릭스 구매 21년12월? 22년1월 구매함 상태좋고 3번입음")?.id,
        "clothing-arcteryx-gamma",
      );
      assert.equal(
        ruleMatch("JH8138 아디다스 슈퍼스타 270사이즈", "슈프림매장 도산점에서 139,000원에 구매 미착용 새상품")?.id,
        "shoe-adidas-superstar-broad",
      );
    });

    it("MLB cap, MLB apparel, and Gucci x MLB cap stay separated", () => {
      assert.equal(ruleMatch("구찌 MLB 뉴욕 양키스 콜라보 캡 네이비", "")?.id, "clothing-mlb-cap-gucci-collab");
      assert.equal(ruleMatch("뉴에라 MLB 팀 로고 반팔 티셔츠 XL", "")?.id, "clothing-mlb-apparel-broad");
      assert.equal(ruleMatch("[정품꿀매물] MLB 뉴욕양키스 반팔티 M", "")?.id, "clothing-mlb-apparel-broad");
      assert.equal(ruleMatch("MLB 뉴욕 양키스 볼캡", "")?.id, "clothing-mlb-cap");
      assert.equal(ruleMatch("아디다스 후드집업ML95100패딩져지후드티바람막이리복퓨마mlb슈프림", "")?.id ?? null, null);
    });

    it("CDG x Lacoste and FOG vest layering context stay conservative", () => {
      assert.equal(ruleMatch("꼼데가르송 셔츠 x 라코스테 폴로 셔츠 그린 XL", "")?.id ?? null, null);
      assert.equal(
        ruleMatch("[XXS] FOG Essentials 우먼 베스트", "핑크색 반팔 티셔츠에 레이어드해서 두번 입었네요")?.id,
        "clothing-fog-essentials",
      );
      assert.equal(ruleMatch("피오갓에센셜 숏슬리브 폴로 타우페", "")?.id, "clothing-fog-essentials");
      assert.equal(ruleMatch("(m)피어오브갓 에센셜 카라티셔츠", "")?.id, "clothing-fog-essentials");
    });

    it("fashion bundles stay out of single-item comparable lanes", () => {
      assert.equal(ruleMatch("가을 옷 7벌 일괄 나이키 후드티, mlb 조거팬츠 등", "")?.id ?? null, null);
      assert.equal(ruleMatch("나이키 x 스투시 NRG 크루넥 팬츠 게임로얄 셋업", "")?.id ?? null, null);
    });

    it("seller credibility text with 판매/구매 does not look like a buy request", () => {
      assert.equal(
        ruleMatch("(XL) 나이키 X 스투시 윈드러너 자켓 바람막이 하바네로 레드", "100% 정품만 판매/구매 합니다.")?.id,
        "clothing-stussy-nike-collab",
      );
    });

    it("styling context in descriptions does not promote bottoms/jackets into tee lanes", () => {
      assert.equal(
        ruleMatch(
          "[크리스탈] 폴로 랄프로렌 여성 코튼 치노 쇼츠 반바지",
          "셔츠, 티셔츠 등 어떤 상의와도 매치가 잘 되며",
        )?.id,
        "clothing-polo-apparel-broad",
      );
      assert.equal(
        ruleMatch(
          "스투시 크루즈 코치 자켓 머스타드",
          "스투시의 아이코닉한 스톡 로고가 프린팅되어 있는 제품입니다",
        )?.id,
        "clothing-stussy-apparel-broad",
      );
      assert.equal(ruleMatch("[M] 아크네 개이커백 (댕댕이 베이커백)", "")?.id ?? null, null);
    });
  });

  describe("Margiela Tabi flat family stays out of sneaker/boot comparables", () => {
    it("Tabi flat, Mary Jane, and slip-on route to a flat lane", () => {
      assert.equal(
        ruleMatch("(W) 메종 마르지엘라 타비 발레 플랫 슈즈 아이보리 39 사이즈", "정품")?.id,
        "shoe-margiela-tabi-flat",
      );
      assert.equal(
        ruleMatch("메종 마르지엘라 타비 메리제인 슈즈 브라운 37.5", "정품")?.id,
        "shoe-margiela-tabi-flat",
      );
      assert.equal(
        ruleMatch("메종 마르지엘라 슬립온 타비 슈즈 블랙", "정품")?.id,
        "shoe-margiela-tabi-flat",
      );
      assert.equal(
        ruleMatch("메종 마르지엘라 타비 스니커즈 화이트 37 (박스, 카드 포함)", "정품")?.id,
        "shoe-margiela-tabi-sneaker",
      );
      assert.equal(ruleMatch("마르지엘라 타비 키링", "")?.id ?? null, null);
    });

    it("EU half sizes near shoe wording parse for Tabi flats", () => {
      const parsed = parseListingOptions({
        title: "메종 마르지엘라 타비 메리제인 슈즈 브라운 37.5",
        description: "상태 좋습니다",
        skuId: "shoe-margiela-tabi-flat",
        skuName: "Margiela Tabi Flat / Mary Jane / Slip-on",
        category: "shoe",
        defaultProductType: "flat",
      });

      assert.equal(parsed.comparableKey, "shoe|tabi_flat|mary_jane|240|b_grade");
      assert.equal(parsed.needsReview, false);
    });

    it("generic Tabi broad does not default to sneaker when product type is unknown", () => {
      const parsed = parseListingOptions({
        title: "마르지엘라 타비 Maison Margiela / 40",
        description: "정품입니다",
        skuId: "shoe-margiela-tabi",
        skuName: "Maison Margiela Tabi (broad)",
        category: "shoe",
      });

      assert.equal(parsed.comparableKey, "shoe|tabi|type_unknown|unknown_size|unknown_condition");
      assert.equal(parsed.needsReview, true);
    });

    it("Tabi residual shoe shapes split away from the broad Tabi lane", () => {
      assert.equal(
        ruleMatch("[43] 메종 마르지엘라 타비 통 샌들 쪼리 플립플랍 블랙", "")?.id,
        "shoe-margiela-tabi-sandal",
      );
      assert.equal(
        ruleMatch("메종마르지엘라 2020 s/s 화이트 타비 샌들", "")?.id,
        "shoe-margiela-tabi-sandal",
      );
      assert.equal(
        ruleMatch("메종 마르지엘라 타비 슬라이드 37 (235)", "")?.id,
        "shoe-margiela-tabi-sandal",
      );
      assert.equal(
        ruleMatch("마르지엘라 타비 로퍼 42", "")?.id,
        "shoe-margiela-tabi-loafer",
      );
      assert.equal(
        ruleMatch("마르지엘라 타비 페이퍼 더비 42", "")?.id,
        "shoe-margiela-tabi-loafer",
      );
      assert.equal(
        ruleMatch("[37] 메종 마르지엘라 maison margiela tabi 타비 힐", "")?.id,
        "shoe-margiela-tabi-pump",
      );
      assert.equal(
        ruleMatch("메종마르지엘라 타비 펌프스힐", "")?.id,
        "shoe-margiela-tabi-pump",
      );
      assert.equal(
        ruleMatch("메종 마르지엘라 x 리복 타비 인스타펌프 퓨리", "")?.id,
        "shoe-margiela-tabi-reebok",
      );
      assert.equal(
        ruleMatch("마르지엘라 타비 독일군", "마르지엘라의 시그니처 디자인 타비 독일군 스니커즈")?.id,
        "shoe-margiela-tabi-german-army",
      );
      assert.equal(
        ruleMatch("[290] 리복 x 메종 마르지엘라 클래식 레더 타비 슈즈 화이트", "")?.id,
        "shoe-margiela-tabi-reebok",
      );
      assert.equal(
        ruleMatch("마르지엘라 타비슈즈 블랙 페인트 41.5사이즈", "")?.id,
        "shoe-margiela-tabi-painted-sneaker",
      );
      assert.equal(
        ruleMatch("Maison margiela tabi mules", "")?.id,
        "shoe-margiela-tabi-slipper",
      );
      assert.equal(
        ruleMatch("메종마르지엘라 타비 컨버스 (사이즈 41)", "")?.id,
        "shoe-margiela-tabi-sneaker",
      );
      assert.equal(
        ruleMatch("(43/275)메종마르지엘라신발 타비 에스파드류 메종마르지엘라스니커즈", "")?.id,
        "shoe-margiela-tabi-slipper",
      );
      assert.equal(
        ruleMatch("(구매 43)마르지엘라 타비 통 샌들 슬리퍼 쪼리 플리플랍", "상태 상관없이 구매합니다"),
        null,
      );
    });

    it("Tabi residual splits create separate comparable keys by shape", () => {
      const reebok = parseListingOptions({
        title: "리복 x 메종 마르지엘라 클래식 레더 타비 슈즈 화이트 EUR 40 / 255mm",
        description: "거의 새상품",
        skuId: "shoe-margiela-tabi-reebok",
        skuName: "Margiela x Reebok Tabi (Instapump / Classic Leather)",
        category: "shoe",
        defaultProductType: "sneaker",
      });
      const sandal = parseListingOptions({
        title: "메종 마르지엘라 타비 슬라이드 37 (235)",
        description: "정품",
        skuId: "shoe-margiela-tabi-sandal",
        skuName: "Margiela Tabi Sandal / Flip Flop / Slide",
        category: "shoe",
        defaultProductType: "sandal",
      });
      const pump = parseListingOptions({
        title: "[37] 메종 마르지엘라 maison margiela tabi 타비 힐",
        description: "5회 정도 착용했습니다",
        skuId: "shoe-margiela-tabi-pump",
        skuName: "Margiela Tabi Pumps / Heel",
        category: "shoe",
        defaultProductType: "pump",
      });
      const loaferWithPriceNoise = parseListingOptions({
        title: "메종 마르지엘라 타비 브러쉬드 카프스킨 로퍼 블랙 EU 41",
        description: "최저가 2,221,377원에 구매 가능하며 단시간 착용했습니다.",
        skuId: "shoe-margiela-tabi-loafer",
        skuName: "Margiela Tabi Loafer / Derby",
        category: "shoe",
        defaultProductType: "loafer",
      });
      const espadrille = parseListingOptions({
        title: "(43/275)메종마르지엘라신발 타비 에스파드류 메종마르지엘라스니커즈",
        description: "상태 좋습니다",
        skuId: "shoe-margiela-tabi-slipper",
        skuName: "Margiela Tabi Slipper / Espadrille",
        category: "shoe",
        defaultProductType: "slipper",
      });

      assert.equal(reebok.comparableKey, "shoe|tabi_reebok|sneaker|255|a_grade");
      assert.equal(sandal.comparableKey, "shoe|tabi_sandal|sandal|235|unknown_condition");
      assert.equal(pump.comparableKey, "shoe|tabi_pump|pump|235|b_grade");
      assert.equal(loaferWithPriceNoise.comparableKey, "shoe|tabi_loafer|loafer|260|a_grade");
      assert.equal(espadrille.comparableKey, "shoe|tabi_slipper|slipper|275|b_grade");
    });
  });

  describe("정상 매물 — 모델명 단독 매칭 (regression 검증)", () => {
    const cases = [
      { title: "노스페이스 눕시 1996", expected: "down_jacket" },
      { title: "노스페이스 마운틴 자켓 고어텍스", expected: "jacket" },
      { title: "노스페이스 데날리 플리스", expected: "jacket" },
      { title: "폴로 랄프로렌 옥스포드 셔츠", expected: "shirt" },
      { title: "스투시 후드", expected: "hoodie" },
      { title: "베이프 티셔츠", expected: "tee" },
      { title: "RRL 청바지", expected: "jeans" },
    ];
    for (const { title, expected } of cases) {
      it(`"${title}" → ${expected}`, () => {
        const result = parseListingOptions({
          title,
          description: title,
          skuId: null,
          skuName: null,
          category: "clothing",
        });
        const productType = (result.parsedJson as any).clothing_product_type;
        assert.equal(productType, expected);
      });
    }
  });

  describe("Wave 486 — Polo Pique stale cleanup keeps true Ralph Lauren domestic wording", () => {
    it("Polo Ralph Lauren big-pony pk/collar tee routes to the pique lane", () => {
      assert.equal(ruleMatch("폴로 랄프로렌 빅포니 카라티 pk티", "")?.id, "clothing-polo-pique-classic");
    });

    it("other-brand pique polo/dress rows do not enter Polo Ralph Lauren pique", () => {
      for (const title of [
        "라코스테 블루 피케 폴로 원피스",
        "지포어 TECH PIQUE POLO",
        "칼하트WIP S/S CHASE PIQUE POLO 남성",
        "캐피탈 타이틀리 우븐 피케 랭글 칼라 집업 푸에블로 폴로 블랙",
        "폴로 랄프로렌 빅포니 카라티 pk티 치프키프",
        "몽클레어 여성 신상 폴로 피케 반팔티셔츠 26ss",
      ]) {
        assert.notEqual(ruleMatch(title, "")?.id, "clothing-polo-pique-classic");
      }
      assert.equal(ruleMatch("몽클레어 여성 신상 폴로 피케 반팔티셔츠 26ss", "")?.id ?? null, null);
    });
  });

  describe("Wave 413 — clothing product_type title-first", () => {
    it("제목의 반팔 티셔츠가 설명 검색어의 팬츠/쇼츠에 오염되지 않음", () => {
      const result = parseListingOptions({
        title: "BAPE 베이프 타이거 카모 반팔 티셔츠",
        description: "검색용 팬츠 쇼츠 바지 데님 포함 아닙니다. 실물은 반팔 티셔츠입니다.",
        skuId: "clothing-bape-tee",
        skuName: "BAPE Basic Tee",
        category: "clothing",
        defaultProductType: "tee",
      });

      assert.equal(result.parsedJson.clothing_product_type, "tee");
      assert.equal(result.parsedJson.clothing_product_type_source, "title");
      assert.equal(result.parsedJson.clothing_product_type_from_catalog, false);
    });

    it("제목에서 타입을 못 잡으면 설명까지 fallback 함", () => {
      const result = parseListingOptions({
        title: "BAPE ABC Camo College ATS",
        description: "반팔 티셔츠 L 사이즈",
        skuId: "clothing-bape-tee",
        skuName: "BAPE Basic Tee",
        category: "clothing",
        defaultProductType: "tee",
      });

      assert.equal(result.parsedJson.clothing_product_type, "tee");
      assert.equal(result.parsedJson.clothing_product_type_source, "combined");
      assert.equal(result.parsedJson.clothing_product_type_from_catalog, false);
    });
  });

  describe("Wave 425 — clothing type_unknown cleanup", () => {
    const cases = [
      { title: "꼼데가르송 유니크한 크롭탑 볼레로 comme des garcons 컬렉션", expected: "tee" },
      { title: "챔피온 X 글로니 캐미솔 나시 탑 White", expected: "tee" },
      { title: "90s 빈티지 챔피온 리버스위브 멜란지 그레이 스웻 XL 버버진", expected: "crewneck" },
      { title: "00s Champion reverse weave 스웨트셔츠 XL", expected: "crewneck" },
      { title: "[32x32] 칼하트 wip 스트레이드 데님 (34)", expected: "jeans" },
      { title: "칼하트 스티치 데님 31x32", expected: "jeans" },
    ];

    for (const { title, expected } of cases) {
      it(`${title} -> ${expected}`, () => {
        const result = parseListingOptions({
          title,
          description: title,
          skuId: "clothing-champion-apparel-broad",
          skuName: "Champion apparel",
          category: "clothing",
        });

        assert.equal(result.parsedJson.clothing_product_type, expected);
        assert.equal(result.needsReview, false);
      });
    }
  });

  describe("Wave 424 — Polo Oxford spacing variants", () => {
    for (const title of [
      "폴로 랄프로렌 옥스포드셔츠(XL)",
      "폴로 랄프로렌 블루 화이트 스트라이프 옥스포드셔츠(L)",
      "폴로 랄프로렌 클래식핏 옥스포드 깅엄 체크 셔츠 105 L 새제",
    ]) {
      it(`${title} -> clothing-polo-oxford-shirt`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, "clothing-polo-oxford-shirt");
      });
    }

    for (const title of [
      "55)폴로랄프로렌 옥스포드 셔츠 보이즈l",
      "[폴로반팔티증정][2제품] 폴로 보이즈 화이트 옥스포드 셔츠/ 베이지",
      "폴로 랄프로렌 옥스포드 셔츠 14~16",
    ]) {
      it(`${title} does not enter adult Oxford`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id ?? null, null);
      });
    }
  });

  describe("Wave 456 — duplicate generated/manual shoe SKU candidates", () => {
    it("Adidas Stan Smith duplicate SKU definitions resolve to one broad lane", () => {
      assert.equal(
        ruleMatch("아디다스 오리지널 스탠스미스 벨크로 265", "")?.id,
        "shoe-adidas-stansmith-broad",
      );
      assert.equal(
        ruleMatch("아디다스 스탠스미스 W BZ0409", "")?.id,
        "shoe-adidas-stansmith-broad",
      );
    });
  });

  describe("BAPE basic apparel catalog split", () => {
    const cases = [
      { title: "베이프 반팔 티셔츠 L", expectedSku: "clothing-bape-tee" },
      { title: "베이프 화이트 후드티 카모 후드", expectedSku: "clothing-bape-hoodie" },
      { title: "베이프 퍼플 카모 후드집업", expectedSku: "clothing-bape-hoodie-zip" },
      { title: "베이프 카모 맨투맨 크루넥", expectedSku: "clothing-bape-crewneck" },
      { title: "BAPE ABC Camo Shark Half Zip 베이프 반집업", expectedSku: "clothing-bape-shark-hoodie" },
      { title: "베이프 카메 1st 고어텍스 스노우보드자켓 M사이즈", expectedSku: "clothing-bape-jacket-broad" },
    ];

    for (const { title, expectedSku } of cases) {
      it(`${title} -> ${expectedSku}`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, expectedSku, `${title} matched ${sku?.id}`);
      });
    }

    it("BAPE Shark non-hoodie product types do not enter Shark Hoodie lane", () => {
      for (const title of [
        "BAPE 샤크 티셔츠 L",
        "베이프 샤크 팬츠 M",
        "BAPE Shark shorts XL",
        "베이프 샤크 맨투맨",
        "BAPE X Puma ABC Camo Hoodie 베이프 카모 후드티",
        "베이프 X 네이버후드 롱슬리브 티셔츠",
      ]) {
        const sku = ruleMatch(title, title);
        assert.ok(
          sku === null || sku.id !== "clothing-bape-shark-hoodie",
          `${title} matched ${sku?.id}`,
        );
      }
    });

    it("BAPE basic lanes reject collab, homage, and diffusion-line samples", () => {
      const bapeBasicSkuIds = new Set([
        "clothing-bape-tee",
        "clothing-bape-hoodie",
        "clothing-bape-hoodie-zip",
        "clothing-bape-crewneck",
        "clothing-bape-shark-hoodie",
        "clothing-bape-jacket-broad",
      ]);
      for (const title of [
        "정품 베이프 아디다스 콜라보 후드",
        "[L] aape 베이프 후드집업",
        "XXL 푸부 BAPE 오마주 카모 빅로고 후드집업",
        "Bape x chocolte 후드집업",
        "[XL(size5)] 베이프 X 라코스테 후드집업",
        "자운드 베이프 콜라보 후드티 xl 팝니다",
        "[XL추천/후드분실] 유일매물 타미힐피거 x 에이프 베이프 데님 자켓",
      ]) {
        const sku = ruleMatch(title, title);
        assert.ok(
          !sku || !bapeBasicSkuIds.has(sku.id),
          `${title} matched ${sku?.id}`,
        );
      }
    });
  });

  describe("catalog 2차 safety — jacket SKU 가 mismatch 매물 reject", () => {
    it("tnf-nuptse-1996 SKU 가 '눕시 쇼츠' 매물에 매칭 안 됨 (catalog mustNotContain + Wave 254.6 노이즈)", () => {
      const text = "빔즈 노스페이스 눕시 쇼츠 M 판매합니다";
      const sku = ruleMatch(text, text);
      // SKU 가 매칭되어도 broad fallback 또는 null. tnf-nuptse-1996 narrow 는 매칭 X.
      assert.ok(
        sku === null || sku.id !== "clothing-tnf-nuptse-1996",
        `tnf-nuptse-1996 잘못 매칭됨: ${sku?.id}`,
      );
    });

    it("tnf-mountain-jacket SKU 가 '마운틴 자켓 모자' 매물에 매칭 안 됨", () => {
      const text = "노스페이스 마운틴 자켓 모자 새상품";
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.id !== "clothing-tnf-mountain-jacket",
        `mountain-jacket 잘못 매칭됨: ${sku?.id}`,
      );
    });

    it("down-jacket lanes reject shirt/polo variants", () => {
      assert.equal(ruleMatch("노스페이스 눕시 셔츠", "")?.id ?? null, null);
      assert.equal(ruleMatch("몽클레어 블루 반팔 카라티", "")?.id ?? null, null);
    });

    it("arcteryx-beta SKU 가 '베타 벨트' 매물에 매칭 안 됨", () => {
      const text = "아크테릭스 베타 자켓 벨트 단품";
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.id !== "clothing-arcteryx-beta",
        `arcteryx-beta 잘못 매칭됨: ${sku?.id}`,
      );
    });
    it("Arc'teryx Crag apparel does not enter generic Arc'teryx broad", () => {
      for (const title of [
        "아크테릭스 크래그 코튼 팬츠 32 블랙",
        "아크테릭스 크래그 SL 반팔 티셔츠 블랙",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "clothing-arcteryx", `${title} matched ${sku?.id}`);
      }
    });

    it("Arc'teryx Vertex shoe rows do not enter Vertex/Squamish clothing", () => {
      const sku = ruleMatch("아크테릭스 VERTEX 트레일런닝화 280mm 등산화", "정품");
      assert.notEqual(
        sku?.id,
        "clothing-arcteryx-vertex-squamish",
        `Vertex shoe row matched clothing lane: ${sku?.id}`,
      );
    });

    it("Dr. Martens Flora Chelsea does not enter 2976 Chelsea samples", () => {
      const sku = ruleMatch("닥터마틴 첼시부츠 플로라 체리레드 39사이즈 새것", "");
      assert.notEqual(
        sku?.id,
        "shoe-drmartens-2976-chelsea",
        `Flora Chelsea row matched 2976 lane: ${sku?.id}`,
      );
    });

    it("shoe title product type wins over description heel measurements", () => {
      const title = "이태리명품 발렌시아가 트리플S 올 오버 로고 오버솔 스니커즈240";
      const description = "Triple S Oversole Sneakers SIZE EUR 37 JP 24.5 Heel height about 6cm";
      const sku = ruleMatch(title, description);
      const parsed = parseListingOptions({
        title,
        description,
        skuId: sku?.id ?? null,
        skuName: sku?.modelName ?? null,
        category: sku?.category ?? null,
        defaultProductType: sku?.defaultProductType ?? null,
      });
      assert.equal(parsed.parsedJson.shoe_product_type, "sneaker");
      assert.match(parsed.comparableKey ?? "", /^shoe\|balenciaga_triple_s_broad\|sneaker\|/);
    });

    it("tnf-denali-fleece SKU 가 '데날리 팬츠' 매물에 매칭 안 됨", () => {
      const text = "노스페이스 00s 윈드스토퍼 후리스 플리스 블랙 데날리 팬츠 바지 xxl";
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.id !== "clothing-tnf-denali-fleece",
        `tnf-denali-fleece 잘못 매칭됨: ${sku?.id}`,
      );
    });

    it("tnf-mountain-jacket SKU 가 Purple/High Mountain variants에 매칭 안 됨", () => {
      for (const text of [
        "THE NORTH FACE PURPLE Mountain Jacket",
        "노스페이스 하이마운틴자켓 xl",
      ]) {
        const sku = ruleMatch(text, text);
        assert.ok(
          sku === null || sku.id !== "clothing-tnf-mountain-jacket",
          `tnf-mountain-jacket variant 잘못 매칭됨: ${text} -> ${sku?.id}`,
        );
      }
    });

    it("tnf-mountain-jacket SKU 가 Antora variants에 매칭 안 되고 stored SKU도 review hold", () => {
      const text = "노스페이스 안토라 자켓 옐로우 L 사이즈 마운틴자켓 새제품";
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.id !== "clothing-tnf-mountain-jacket",
        `tnf-mountain-jacket Antora variant 잘못 매칭됨: ${sku?.id}`,
      );

      const parsed = parseListingOptions({
        title: text,
        description: "정품 새상품",
        skuId: "clothing-tnf-mountain-jacket",
        skuName: "TNF Mountain Jacket (Gore-Tex)",
        category: "clothing",
      });
      assert.equal(parsed.needsReview, true);
      assert.ok((parsed.parsedJson.critical_unknown as string[]).includes("clothing_tnf_mountain_variant_review"));
    });

    it("정상 매물 — '노스페이스 1996 눕시' 다운자켓 → tnf-nuptse-1996 매칭 (regression)", () => {
      const text = "노스페이스 1996 눕시 다운자켓 M";
      const sku = ruleMatch(text, text);
      assert.equal(sku?.id, "clothing-tnf-nuptse-1996",
        `정상 nuptse 매물 매칭 실패: ${sku?.id}`);
    });

    it("TNF Nuptse 1996 key does not absorb vest / eco / non-1996 lines", () => {
      assert.equal(
        ruleMatch("노스페이스 눕시 조끼패딩", "정품")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("노스페이스 1996 에코 눕시 여성 블랙 유광 패딩", "정품")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("노스페이스 리마스터 눕시 패딩 L", "정품")?.id,
        "clothing-tnf-nuptse-broad",
      );
      assert.equal(
        ruleMatch("노스페이스 500 눕시 패딩 브라운", "정품")?.id,
        "clothing-tnf-nuptse-broad",
      );
    });

    it("RRL 데님 generic은 jeans fallback, 명시적 데님 셔츠는 shirt 유지", () => {
      const generic = parseListingOptions({
        title: "rrl 데님",
        description: "더블알엘 여성 하이보이핏 데님 29",
        skuId: "clothing-polo-rrl-denim",
        skuName: "Polo RRL Denim (jeans / shirt)",
        category: "clothing",
        defaultProductType: "jeans",
      });
      const shirt = parseListingOptions({
        title: "RRL 데님 셔츠 M",
        description: "더블알엘 데님 셔츠",
        skuId: "clothing-polo-rrl-denim",
        skuName: "Polo RRL Denim (jeans / shirt)",
        category: "clothing",
        defaultProductType: "jeans",
      });

      assert.equal(generic.parsedJson.clothing_product_type, "jeans");
      assert.equal(generic.needsReview, false);
      assert.equal(shirt.parsedJson.clothing_product_type, "shirt");
    });

    it("RRL repeated jacket lines split away from generic jacket-coat", () => {
      const tieTitle = "더블알엘 rrl 핸드메이드 홀스프린트 리넨 타이";
      const tieDesc = "Condition : 새상품. 코리아 익스클루시브 자켓이랑도 잘 맞습니다.";
      assert.notEqual(
        ruleMatch(tieTitle, tieDesc)?.id,
        "clothing-polo-rrl-jacket-coat",
      );
      const tieParsed = parseListingOptions({
        title: tieTitle,
        description: tieDesc,
        skuId: "clothing-polo-rrl-jacket-coat",
        skuName: "Polo RRL Jacket / Coat (캔버스/데님/카코트/필드)",
        category: "clothing",
      });
      assert.equal(tieParsed.needsReview, true);
      assert.equal(tieParsed.parsedJson.clothing_product_type, "type_unknown");
      assert.equal(tieParsed.parsedJson.clothing_accessory_title_block, true);

      assert.equal(
        ruleMatch("더블알엘 RRL 브라운스비치 헤링본 자켓", "정품")?.id,
        "clothing-polo-rrl-browns-beach-jacket",
      );
      assert.equal(
        ruleMatch("RRL 더블알엘 LOT271 리랜드 데님 자켓 L", "정품")?.id,
        "clothing-polo-rrl-denim-jacket",
      );
      assert.equal(
        ruleMatch("더블알엘 데님 워크 자켓", "정품")?.id,
        "clothing-polo-rrl-denim-jacket",
      );
      assert.equal(
        ruleMatch("RRL 황소자수 베이지 데님 트러커 XL", "정품")?.id,
        "clothing-polo-rrl-denim-jacket",
      );
      assert.equal(
        ruleMatch("Rrl distressed slim fit denim", "정품")?.id,
        "clothing-polo-rrl-denim",
      );
      assert.equal(
        ruleMatch("RRL 그리즐리 자켓 L사이즈 새상품", "정품")?.id,
        "clothing-polo-rrl-grizzly-jacket",
      );
      assert.equal(
        ruleMatch("RRL 그리즐리 블랙데님 재킷 (폴로 더블알엘)", "정품")?.id,
        "clothing-polo-rrl-grizzly-jacket",
      );
      assert.equal(
        ruleMatch("rrl 덱자켓 블랙 xxl", "정품")?.id,
        "clothing-polo-rrl-jacket-coat",
      );
      assert.equal(
        ruleMatch("RRL 더블알엘 캔버스 트러커 자켓", "정품")?.id,
        "clothing-polo-rrl-jacket-coat",
      );
    });

    it("RRL pants lane rejects adjacent Ralph/Levi's bait rows", () => {
      assert.notEqual(
        ruleMatch("리바이스 LVC 와이드 치노 서스펜더 RRL", "정품")?.id,
        "clothing-polo-rrl-pants",
      );
      assert.notEqual(
        ruleMatch("[새상품] 랄프로렌 Rugby 치노 팬츠 34 사이즈 RRL", "정품")?.id,
        "clothing-polo-rrl-pants",
      );
    });

    it("RRL leather/suede shirts route to the high-value shirt lane", () => {
      for (const title of [
        "더블알엘 스웨이드 웨스턴 오버셔츠 s사이즈 염소가죽 rrl",
        "[새상품] RRL 러프아웃 스웨이드 워크 오버 셔츠 L",
        "Rrl 러프아웃 스웨이드 셔츠",
        "Rrl 러프아웃 스웨이드 워크셔츠 L",
      ]) {
        assert.equal(
          ruleMatch(title, "정품")?.id,
          "clothing-polo-rrl-shirt-leather-suede",
        );
      }
    });

    it("RRL leather/suede jackets route without mixing denim or Grizzly lanes", () => {
      assert.equal(
        ruleMatch("Rrl 인디고 러프아웃 스웨이드 자켓", "정품")?.id,
        "clothing-polo-rrl-jacket-leather-suede",
      );
      assert.equal(
        ruleMatch("25fw rrl 러프아웃 스웨이드 초어", "정품")?.id,
        "clothing-polo-rrl-jacket-leather-suede",
      );
      assert.equal(
        ruleMatch("rrl 더블알엘 명작 그리즐리 가죽 자켓 L", "정품")?.id,
        "clothing-polo-rrl-grizzly-jacket",
      );
      assert.equal(ruleMatch("rrl스타일 가죽자켓 3xl", "정품")?.id ?? null, null);
    });

    it("RRL waffle knit henley does not collide with tee lane", () => {
      assert.equal(
        ruleMatch("RRL 와플 니트 헨리넥 반팔티", "정품")?.id,
        "clothing-polo-rrl-knit",
      );
    });

    it("Acne repeated denim lines split away from generic denim", () => {
      assert.equal(
        ruleMatch("아크네 스튜디오 Max clean lt vtg 데님 30/32", "정품")?.id,
        "clothing-acne-max-denim",
      );
      assert.equal(
        ruleMatch("아크네스튜디오 Bla Konst 부츠컷 데님 팬츠 진청", "정품")?.id,
        "clothing-acne-bla-konst-denim",
      );
      assert.equal(
        ruleMatch("아크네 슈퍼배기핏 데님", "정품")?.id,
        "clothing-acne-super-baggy-denim",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 데님 반바지 S사이즈", "정품")?.id,
        "clothing-acne-denim-shorts",
      );
      assert.equal(
        ruleMatch("아크네스튜디오 데님 오버롤 멜빵 점프수트 팬츠 34", "정품")?.id,
        "clothing-acne-denim-overall",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 청바지 데님 팬츠 33/32", "정품")?.id,
        "clothing-acne-denim",
      );
      assert.equal(
        ruleMatch("최종가)아크네스튜디오 청바지(부츠컷) 24/34", "정품")?.id,
        "clothing-acne-denim",
      );
      assert.equal(
        ruleMatch("아크네스튜디오 맥스 로우 32x32", "정품")?.id,
        "clothing-acne-max-denim",
      );
      assert.equal(
        ruleMatch("아크네 블라콘스트 노스 (연청) 30x32", "정품")?.id,
        "clothing-acne-bla-konst-denim",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 2021M 라이트블루 루즈핏 팝니다", "정품")?.id,
        "clothing-acne-denim",
      );
      assert.equal(
        ruleMatch("아크네 리버진 33사이즈", "정품")?.id,
        "clothing-acne-denim",
      );
      assert.equal(
        ruleMatch("정품 아크네 스튜디오 기프트 박스 패키지 스카프 머플러 니트 데님 쇼핑백", "정품")?.id ?? null,
        null,
      );
    });

    it("Acne repeated shoe lines split away from apparel broad", () => {
      assert.equal(
        ruleMatch("아크네스튜디오 맨하탄", "정품")?.id,
        "shoe-acne-manhattan",
      );
      assert.equal(
        ruleMatch("[40] 아크네스튜디오 맨하탄 락어웨이 더티", "정품")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 락어웨이 41사이즈", "정품")?.id,
        "shoe-acne-rockaway",
      );
    });

    it("Acne broad rejects scarf, perfume, and shoe bait while keeping apparel types", () => {
      assert.equal(
        ruleMatch("아크네 스튜디오 하운즈투스 알파카 프린지 스카프 화이트 블랙", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("[정품] 아크네스튜디오 프린지 울 스키니 머플러 목도리", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("프레데릭말 아크네스튜디오 향수 100ml", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네 페리 네이비 43사이즈", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네스튜디오 블루 스웨이드 PVC 스틸레토 펌프스", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네 레더 로퍼 43", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네스튜디오 바디백 라벤더퍼플 남녀공용", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("동아제약 아크네 프로 겔제 30ml", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네스 모공 클리어 젤 클렌저 세안 브러쉬 증정기획", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네스 여드름 진정패치 + 포켓몬 파우치 pvc 슬라이딩 치코리타", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("JW 앤더슨 바시티 봄버 자켓 JW Anderson 아크네 로에베 아미", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 베이커 차정원 백,블랙 스몰", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 멀티 포켓 마이크로백 레드", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네 Acne 13 S/S 라펠 핀", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("폰즈 파우더 비비 블러링 아크네 핑키쉬", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("센카 시나모롤 에디션 퍼펙트휩 아크네케어", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 플립플랍 아크네스튜디오 블루 리버스 쪼리", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("르샵 양털 뽀글이 아크네 무스탕 소유 착용 55", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 블러링 로고 티셔츠 s", "")?.id,
        "clothing-acne-tee",
      );
      assert.equal(
        ruleMatch("[M] 아크네 스튜디오 크루넥 긴팔 티셔츠", "")?.id,
        "clothing-acne-tee",
      );
      assert.equal(
        ruleMatch("아크네스튜디오 반집업 긴팔 티셔츠 XL 블랙", "")?.id,
        "clothing-acne-tee",
      );
      assert.equal(
        ruleMatch("아크네스튜디오 이안 무스탕", "")?.id,
        "clothing-acne-jacket-coat",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 마키오 ma-1 봄버 팝니다", "")?.id,
        "clothing-acne-jacket-coat",
      );
      assert.equal(
        ruleMatch("아크네 오버사이즈 후리스", "")?.id,
        "clothing-acne-jacket-coat",
      );
      assert.equal(
        ruleMatch("아크네 블랙 스키니진", "")?.id,
        "clothing-acne-denim",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 플로라가탄 스톡홀름 리버스테이블랙진 30", "")?.id,
        "clothing-acne-denim",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 베이지 반바지 50", "")?.id,
        "clothing-acne-shorts",
      );
      assert.equal(
        ruleMatch("아크네 반바지 두개", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("[EU48] 아크네 스투디오 라이더 트라우저 블랙", "")?.id,
        "clothing-acne-pants",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 검정색 라이더 슬랙스 네이비", "")?.id,
        "clothing-acne-pants",
      );
      assert.equal(
        ruleMatch("아크네 치노팬츠 50사이즈(32-34)", "")?.id,
        "clothing-acne-pants",
      );
      assert.equal(
        ruleMatch("[XS]아크네 모헤어 스트라이프 니트", "")?.id,
        "clothing-acne-knit",
      );
      assert.equal(
        ruleMatch("아크네스튜디오 체스트 로고 자수 울 코튼 가디건 L", "")?.id,
        "clothing-acne-knit",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 형광 peele", "")?.id,
        "clothing-acne-knit",
      );
      assert.equal(
        ruleMatch("[os] 아크네스크튜디오 체크 스카프", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 스트라이프 카라 럭비티", "")?.id,
        "clothing-acne-polo",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 타이다이 스트라이프 폴로 티셔츠", "")?.id,
        "clothing-acne-polo",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 모자", "")?.id,
        "clothing-acne-cap",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 ADELIA 메쉬 PSS15 블라우스", "")?.id,
        "clothing-acne-shirt",
      );
      for (const title of [
        "아크네 스웻셔츠 please call me girl",
        "acne 아크네스튜디오 야광 로고 크루넥 맨투맨 스웻셔츠 L사이즈",
        "M 아크네스튜디오 포바 아쿠아블루 오버사이즈 맨투맨 오버핏 스웨트셔츠",
      ]) {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, "clothing-acne-sweat", `${title} matched ${sku?.id}`);
      }
      assert.equal(
        ruleMatch("아크네 패치포켓 나그랑 롱 슬리브", "")?.id,
        "clothing-acne-tee",
      );
      assert.equal(
        ruleMatch("모스키노 아크네 바나나 스팽글 자수 티셔츠", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("시스템 티셔츠 한섬 헬무트랭 아크네스튜디오 타임 이자벨마랑 마쥬", "")?.id ?? null,
        null,
      );
      assert.equal(
        ruleMatch("아크네 티셔츠 원피스 xs", "")?.id,
        "clothing-acne-dress",
      );
      assert.equal(
        ruleMatch("아크네 포바 페이스 스마일로고 퍼플 버건디 멜란지 스웻 티셔츠", "")?.id,
        "clothing-acne-sweat",
      );
      assert.equal(
        ruleMatch("아크네 화이트 얄라 후드 티셔츠 L", "")?.id,
        "clothing-acne-sweat",
      );
      assert.equal(
        ruleMatch("아크네스튜디오 페어뷰 기모 맨투맨 티셔츠 S사이즈 정품", "")?.id,
        "clothing-acne-sweat",
      );
      assert.equal(
        ruleMatch("아크네 스튜디오 타이다이 스트라이프 폴로 티셔츠", "")?.id,
        "clothing-acne-polo",
      );

      const fleece = parseListingOptions({
        title: "아크네 오버사이즈 후리스",
        description: "정품",
        skuId: "clothing-acne-apparel",
        skuName: "Acne Studios Apparel (broad)",
        category: "clothing",
      });
      assert.equal(fleece.parsedJson.clothing_product_type, "jacket");

      const rugby = parseListingOptions({
        title: "아크네 스튜디오 스트라이프 카라 럭비티",
        description: "정품",
        skuId: "clothing-acne-apparel",
        skuName: "Acne Studios Apparel (broad)",
        category: "clothing",
      });
      assert.equal(rugby.parsedJson.clothing_product_type, "polo_shirt");

      const skinnyJeans = parseListingOptions({
        title: "아크네 블랙 스키니진",
        description: "정품",
        skuId: "clothing-acne-apparel",
        skuName: "Acne Studios Apparel (broad)",
        category: "clothing",
      });
      assert.equal(skinnyJeans.parsedJson.clothing_product_type, "jeans");

      const trousers = parseListingOptions({
        title: "[EU48] 아크네 스투디오 라이더 트라우저 블랙",
        description: "정품",
        skuId: "clothing-acne-apparel",
        skuName: "Acne Studios Apparel (broad)",
        category: "clothing",
      });
      assert.equal(trousers.parsedJson.clothing_product_type, "pants");

      const mustang = parseListingOptions({
        title: "아크네스튜디오 무스탕",
        description: "정품",
        skuId: "clothing-acne-apparel",
        skuName: "Acne Studios Apparel (broad)",
        category: "clothing",
      });
      assert.equal(mustang.parsedJson.clothing_product_type, "jacket");

      const fieldJacket = parseListingOptions({
        title: "아크네 스튜디오의 페이스 야상 점퍼",
        description: "정품",
        skuId: "clothing-acne-apparel",
        skuName: "Acne Studios Apparel (broad)",
        category: "clothing",
      });
      assert.equal(fieldJacket.parsedJson.clothing_product_type, "jacket");
    });
  });
});

describe("Wave 254.6 — bag 모델명 false positive 차단", () => {
  describe("Wave 414 — shoe broad safety", () => {
    it("Prada Downtown sneaker is not rejected by bare down/down jacket noise", () => {
      const text = "급처! 정품 프라다 다운타운 스니커즈";
      const sku = ruleMatch(text, text);
      assert.equal(sku?.id, "shoe-prada-broad");
    });

    it("shoe box + dustbag accessory set does not match Gucci shoe broad", () => {
      const text = "구찌신발상자 + 더스트백 셋트";
      const sku = ruleMatch(text, text);
      assert.notEqual(sku?.id, "shoe-gucci-broad", `${text} matched ${sku?.id}`);
    });

    it("Louis Vuitton bootcut denim is not a shoe despite boot substring", () => {
      const text = "루이비통 패턴 플레어 부츠컷 데님";
      const sku = ruleMatch(text, text);
      assert.ok(sku === null || sku.category !== "shoe", `${text} matched ${sku?.id}`);
    });

    it("shoe dustbag-only listing does not match luxury shoe broad", () => {
      const text = "구찌 신발용 더스트백 상태최상 정품 가로21세로39";
      const sku = ruleMatch(text, text);
      assert.notEqual(sku?.id, "shoe-gucci-broad", `${text} matched ${sku?.id}`);
    });
  });

  describe("Wave 470 — LV key pouch narrow Korean Cles safety", () => {
    it("LV key pouch requires explicit key pouch/Cles wording", () => {
      assert.equal(
        ruleMatch("루이비통 모노그램 키파우치", "정품")?.id,
        "bag-lv-monogram-key-pouch",
      );
      for (const title of [
        "루이비통 클레이 그린 스니커즈",
        "루이비통 클래식 TV",
        "몽클레르 루이비통 콜라보 의류",
        "정품 크록스 클레오2 블랙 230",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "bag-lv-monogram-key-pouch", `${title} matched ${sku?.id}`);
      }
    });
  });

  describe("Wave 471 — purchase-history date does not block luxury bag listings", () => {
    it("year.month 구매 history is not treated as a buy request", () => {
      const sku = ruleMatch(
        "샤넬 가브리엘 호보 유광 스몰",
        "2021.05 구매 30번대. 호보 유광 자체가 흔하지 않아요. 모든 구성품 포함입니다",
      );
      assert.equal(sku?.id, "bag-chanel-broad");
    });
  });

  describe("Wave 484 — Chanel broad residuals split to repeated bag families", () => {
    it("Chanel cosmetic/WOC/shopper lanes catch real high-value bag variants", () => {
      assert.equal(ruleMatch("샤넬 코스메틱 박스백(정품)", "")?.id, "bag-chanel-cosmetic-box");
      assert.equal(ruleMatch("샤넬 코스메틱 미니체인가방", "")?.id, "bag-chanel-cosmetic-box");
      assert.equal(ruleMatch("샤넬백 크루즈 참월렛 체인 골드메탈 가방 정품", "")?.id, "bag-chanel-woc-charm-wallet");
      assert.equal(
        ruleMatch("CHANEL 샤넬 미사용 2025 봄 여름 프리 컬렉션 컬렉션의 쇼핑백", "핸드백 정보 모델 램스킨 쇼퍼백 AS5413")?.id,
        "bag-chanel-shopper-new-surf",
      );
      assert.equal(ruleMatch("샤넬 악어 크로커 크록 뉴서프 쇼핑백", "")?.id, "bag-chanel-shopper-new-surf");
    });

    it("paper shopping-bag rows do not enter Chanel bag lanes", () => {
      assert.equal(ruleMatch("샤넬 종이 쇼핑백 단품", "")?.id ?? null, null);
      assert.equal(ruleMatch("샤넬 쇼핑백만 판매", "")?.id ?? null, null);
    });
  });

  describe("Wave 485 — Gucci broad residuals split to repeated bag families", () => {
    it("Gucci Marmont and Ophidia high-value bag variants route to narrow lanes", () => {
      assert.equal(ruleMatch("구찌 GG 마몽 마몬트 마틀라세 스몰 숄더백 443497", "")?.id, "bag-gucci-gg-marmont-small-shoulder");
      assert.equal(ruleMatch("구찌 오피디아 탑핸들백 백화점판 정품 팝니다.", "")?.id, "bag-gucci-ophidia-top-handle");
      assert.equal(ruleMatch("구찌 GG 오피디아 라지 토트백", "")?.id, "bag-gucci-ophidia-tote");
    });

    it("Gucci Marmont wallet and mini/camera lanes do not collapse into small shoulder", () => {
      assert.notEqual(ruleMatch("구찌 마몽 카드지갑", "")?.id, "bag-gucci-gg-marmont-small-shoulder");
      assert.notEqual(ruleMatch("구찌 마몽 카메라백 스몰", "")?.id, "bag-gucci-gg-marmont-small-shoulder");
      assert.notEqual(ruleMatch("구찌 마몽 버킷백 핑크", "숄더백으로도 토트백으로도 연출 가능한 가방입니다")?.id, "bag-gucci-gg-marmont-small-shoulder");
      assert.notEqual(ruleMatch("구찌 마몽 GG 마틀라세 벨벳 퍼플 크로스백 숄더백", "")?.id, "bag-gucci-gg-marmont-small-shoulder");
    });
  });

  describe("Wave 472 — Celine Triomphe family is separated from generic broad", () => {
    it("Celine Triomphe bag variants route to the Triomphe family lane", () => {
      for (const title of [
        "셀린느 트리옹프 오벌백 라지",
        "셀린느 트리옹프 버킷백 스몰",
        "셀린느 트리옹프 미니 폴코 백팩 197662CAS",
        "셀린느 트리옹프 호보백",
      ]) {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, "bag-celine-triomphe-broad", `${title} matched ${sku?.id}`);
      }
    });

    it("Celine shopping-bag packaging does not enter Triomphe", () => {
      const sku = ruleMatch("셀린느 중형 쇼핑백 상태최상 정품", "가로35세로50폭17");
      assert.notEqual(sku?.id, "bag-celine-triomphe-broad");
    });
  });

  describe("Wave 473 — Adidas Trefoil rejects high-variance collab apparel", () => {
    it("Thug Club and Fear of God Adidas apparel do not enter plain Trefoil", () => {
      for (const title of [
        "아디다스 떠그클럽 트랙탑 2XL",
        "Adidas x Thug Club Woven Track Top Light",
        "아디다스 x 피어오브갓 애슬레틱스 헤더 플리스 스웻팬츠L",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "clothing-adidas-trefoil", `${title} matched ${sku?.id}`);
      }
    });
  });

  describe("Wave 474 — LV Alma BB Monogram requires material signal", () => {
    it("Monogram/Cles-style exact signals keep Alma BB in the monogram lane", () => {
      for (const title of [
        "루이비통 모노그램 알마 BB 풀박스",
        "루이비통 모노그램 알마BB 여성 토트백 가방",
        "267001607 루이비통 알마 BB 모노그램 M53152",
        "[S+급/10회사용미만] 루이비통 알마 BB 모노그램 가방 캔버스 05",
      ]) {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, "bag-lv-monogram-alma-bb", `${title} matched ${sku?.id}`);
      }
    });

    it("non-monogram Alma BB variants do not enter the monogram lane", () => {
      for (const title of [
        "루이비통 네오 알마bb 크림",
        "루이비통 가방 알마 BB 버블그램",
        "루이비통알마bb백팩",
        "루이비통 알마BB",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "bag-lv-monogram-alma-bb", `${title} matched ${sku?.id}`);
      }
    });
  });

  describe("Wave 415 — luxury shoe broad repeated models split to narrow candidates", () => {
    const cases = [
      { title: "에르메스 바운싱 스니커즈 카프스킨 스웨이드 고트스킨 & 블랑", expectedSku: "shoe-hermes-bouncing" },
      { title: "[정품] 루이비통 LV 트레이너 데님 스니커즈 (8)", expectedSku: "shoe-louisvuitton-lv-trainer" },
      { title: "구찌 에이스 웹 스니커즈 빈티지 260", expectedSku: "shoe-gucci-ace" },
      { title: "디올 B23 오블리크 하이탑 스니커즈 신발 36사이즈 230 235", expectedSku: "shoe-dior-b23" },
      { title: "[S급/정품] 디올 B30 테크니컬 스니커즈 40", expectedSku: "shoe-dior-b30" },
    ];

    for (const { title, expectedSku } of cases) {
      it(`${title} -> ${expectedSku}`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, expectedSku, `${title} matched ${sku?.id}`);
      });
    }
  });

  describe("Wave 416 — short latin token boundary + next luxury narrow candidates", () => {
    const cases = [
      { title: "루이비통 런어웨이 스니커즈 36", expectedSku: "shoe-louisvuitton-runaway" },
      { title: "7 / 루이비통 LV 프리즘 런어웨이 스니커즈", expectedSku: "shoe-louisvuitton-runaway" },
      { title: "구찌 띠로고 라이톤 스니커즈 신발 6.5사이즈 255 260 판매", expectedSku: "shoe-gucci-rhyton" },
      { title: "구찌라이톤 스니커즈 245", expectedSku: "shoe-gucci-rhyton" },
    ];

    for (const { title, expectedSku } of cases) {
      it(`${title} -> ${expectedSku}`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, expectedSku, `${title} matched ${sku?.id}`);
      });
    }

    it("Nike LV8 does not leak into Louis Vuitton broad through bare lv token", () => {
      const title = "정품 새상품 나이키 에어 포스 107 LV8 235 운동화 스니커즈 남여";
      const sku = ruleMatch(title, title);
      assert.notEqual(sku?.id, "shoe-louisvuitton-broad", `${title} matched ${sku?.id}`);
      assert.notEqual(sku?.id, "shoe-louisvuitton-lv-trainer", `${title} matched ${sku?.id}`);
      assert.notEqual(sku?.id, "shoe-louisvuitton-runaway", `${title} matched ${sku?.id}`);
    });
  });

  describe("Wave 417 — Dior B-series split and brand-bait reject", () => {
    const cases = [
      { title: "[44사이즈]디올 오블리크 B25 러너 스니커즈", expectedSku: "shoe-dior-b25" },
      { title: "디올 B25 러너스니커즈 블랙", expectedSku: "shoe-dior-b25" },
      { title: "디올 B27 하이탑 스니커즈 신발 44사이즈 280 285 판매", expectedSku: "shoe-dior-b27" },
      { title: "디올 B27 미드탑 신발 40사이즈", expectedSku: "shoe-dior-b27" },
      { title: "[42] 디올 B57 CD로고 스니커즈 신발", expectedSku: "shoe-dior-b57" },
      { title: "{ 44 } 디올 B57 스니커즈", expectedSku: "shoe-dior-b57" },
    ];

    for (const { title, expectedSku } of cases) {
      it(`${title} -> ${expectedSku}`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, expectedSku, `${title} matched ${sku?.id}`);
      });
    }

    it("Dior broad does not absorb other-brand bait", () => {
      const title = "구찌 꿀벌 스니커즈 신발 디올발렌";
      const sku = ruleMatch(title, title);
      assert.notEqual(sku?.id, "shoe-dior-broad", `${title} matched ${sku?.id}`);
    });

    it("Cactus Jack B23 collab does not enter plain Dior B23 lane", () => {
      const title = "43 / 디올 X 캑터스 잭 B23 하이탑 스니커즈 3SH126ZOI";
      const sku = ruleMatch(title, title);
      assert.ok(
        sku === null || sku.id !== "shoe-dior-b23",
        `${title} matched ${sku?.id}`,
      );
    });
  });

  describe("Wave 418 — luxury shoe broad safety and repeated model splits", () => {
    const cases = [
      { title: "[42]발렌시아가 3XL 스니커즈 그레이 화이트 레드 42", expectedSku: "shoe-balenciaga-3xl" },
      { title: "발렌시아가 반짝이 3XL 체인 자물쇠 운동화사이즈:41", expectedSku: "shoe-balenciaga-3xl" },
      { title: "[43]발렌시아가 3xl 에그쉘 원아웃", expectedSku: "shoe-balenciaga-3xl" },
      { title: "구찌 롸이톤  띠로고 스니커즈 240 정품", expectedSku: "shoe-gucci-rhyton" },
      { title: "(W) 구찌 롸이톤 레더 스니커즈 입 모양 프린트", expectedSku: "shoe-gucci-rhyton" },
      { title: "구찌 테니스 1977  가죽 스니커즈", expectedSku: "shoe-gucci-tennis-1977" },
      { title: "프라다 아메리카컵 스니커즈 220-225", expectedSku: "shoe-prada-america-cup" },
      { title: "275) 프라다 스포츠 빈티지 아메리칸 컵 레더 스니커즈 신발", expectedSku: "shoe-prada-america-cup" },
      { title: "에르메스 에제리 슬리퍼 쪼리 35사이즈", expectedSku: "shoe-hermes-egerie" },
      { title: "에르메스 이즈미르 샌들 앱송 & 골드 [41 SIZE] 265MM", expectedSku: "shoe-hermes-izmir" },
    ];

    for (const { title, expectedSku } of cases) {
      it(`${title} -> ${expectedSku}`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, expectedSku, `${title} matched ${sku?.id}`);
      });
    }

    it("Balenciaga Track broad does not absorb Track Sandal", () => {
      const title = "발렌시아가 트랙 샌들 블랙 41사이즈";
      const sku = ruleMatch(title, title);
      assert.notEqual(sku?.id, "shoe-balenciaga-track-broad", `${title} matched ${sku?.id}`);
    });

    it("Balenciaga Track broad does not absorb Tractor Chelsea boots", () => {
      const title = "유일 매물 백화점 정품 발렌시아가 트랙터 첼시부츠 36";
      const sku = ruleMatch(title, title);
      assert.notEqual(sku?.id, "shoe-balenciaga-track-broad", `${title} matched ${sku?.id}`);
    });

    it("Balenciaga 3XL clothing size does not enter 3XL sneaker lane", () => {
      const title = "발렌시아가 티셔츠 3XL";
      const sku = ruleMatch(title, title);
      assert.ok(sku === null || sku.id !== "shoe-balenciaga-3xl", `${title} matched ${sku?.id}`);
    });

    it("Gucci multi-item honeybee + Tennis description does not promote title to Tennis 1977", () => {
      const title = "Gucci 구찌 스니커즈 새상품 정품(260mm/245mm)";
      const description = [
        "구찌 벌꿀 화이트 스니커즈 정가1,270,000 원",
        "구찌 tennis 1977 스니커즈 정가 1,240,000 원",
      ].join("\n");
      const sku = ruleMatch(title, description);
      assert.notEqual(sku?.id, "shoe-gucci-tennis-1977", `${title} matched ${sku?.id}`);
    });
  });

  describe("Wave 422 — popular shoe broad safety tightening", () => {
    it("NB 530 color-specific narrow does not absorb black/grey variants", () => {
      const blackPhantom = ruleMatch("[택포/새상품] 뉴발 530 블랙팬텀 (MR530SMN)", "뉴발란스 530 블랙팬텀 240사이즈 MR530SMN");
      const vintageGrey = ruleMatch("뉴발 530 빈티지그레이 (260)", "뉴발란스 530 빈티지 그레이 색상 260사이즈");
      const naturalSpacing = ruleMatch("뉴발란스 남녀공용 530 그레이 실버 메탈릭 MR530LG", "사이즈 240");
      const bestSeller = ruleMatch("뉴발란스 530SG, 대한민국 베스트셀러 슈즈", "240 사이즈");

      assert.equal(blackPhantom?.id, "shoe-newbalance-530-broad");
      assert.equal(vintageGrey?.id, "shoe-newbalance-530-broad");
      assert.equal(naturalSpacing?.id, "shoe-newbalance-530-broad");
      assert.equal(bestSeller?.id, "shoe-newbalance-530-white-silver-navy");
    });

    it("NB 530 white/silver/navy lane still matches explicit color signals", () => {
      const sku = ruleMatch("뉴발란스 530 화이트 실버 네이비 240", "MR530SG 정품");
      assert.equal(sku?.id, "shoe-newbalance-530-white-silver-navy");
    });

    it("Sambae and Samba Rose do not enter plain Samba OG broad", () => {
      for (const title of [
        "아디다스 삼배(SAMBAE) W 블랙 -JI1350",
        "아디다스 삼바로즈(W) 스니커즈",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "shoe-adidas-samba-og-broad", `${title} matched ${sku?.id}`);
      }
    });

    it("Superstar apparel and mule derivatives do not enter plain Superstar broad", () => {
      for (const title of [
        "레어 공용 아디다스 레알마드리드 슈퍼스타 져지 파이어버드 M",
        "아디다스 아디폼 슈퍼스타 뮬 UK12",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "shoe-adidas-superstar-broad", `${title} matched ${sku?.id}`);
      }
    });

    it("Song for the Mute Superstar collab does not enter plain Superstar broad", () => {
      for (const title of [
        "아디다스 송포더뮤트 콜라보 슈퍼스타 225/265",
        "Adidas x Song for the Mute Superstar 265",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "shoe-adidas-superstar-broad", `${title} matched ${sku?.id}`);
      }
    });

    it("shoe box listings do not enter New Balance narrow lanes", () => {
      const sku = ruleMatch("뉴발 신발박스 993 530 팝니다", "박스만 판매합니다");
      assert.ok(sku === null || sku.category !== "shoe", `box listing matched ${sku?.id}`);
    });

    it("Miu Miu x New Balance 530 does not enter plain NB 530 broad", () => {
      const sku = ruleMatch("(새제품) 뉴발란스 x 미우 미우 530 스웨이드 메쉬 스니커즈 에크루", "정품");
      assert.notEqual(sku?.id, "shoe-newbalance-530-broad", `Miu Miu collab matched ${sku?.id}`);
    });

    it("Salehe Bembury x New Balance 530 does not enter plain NB 530 broad", () => {
      for (const title of [
        "[260]뉴발란스 x 살레헤 벰버리 530 페일 골드",
        "New Balance x Salehe Bembury 530 Pale Gold",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "shoe-newbalance-530-broad", `${title} matched ${sku?.id}`);
      }
    });
  });

  it("'Borealis 키링' → type_unknown (backpack 모델명 단독 false positive 차단)", () => {
    const result = parseListingOptions({
      title: "노스페이스 Borealis 키링",
      description: "보레알리스 키링",
      skuId: null,
      skuName: null,
      category: "bag",
    });
    const productType = (result.parsedJson as any).bag_product_type;
    // Wave 254.6 fix: 키링 단독 매물은 backpack 매칭 X.
    assert.notEqual(productType, "backpack",
      `bag_product_type 잘못 backpack 박힘: ${productType}`);
  });

  it("정상 — 'TNF Borealis 백팩' → backpack (regression)", () => {
    const result = parseListingOptions({
      title: "노스페이스 보레알리스 백팩",
      description: "보레알리스 백팩",
      skuId: null,
      skuName: null,
      category: "bag",
    });
    const productType = (result.parsedJson as any).bag_product_type;
    assert.equal(productType, "backpack");
  });

  it("BaoBao/Issey Miyake bag SKU 가 Issey Miyake sneaker 매물에 매칭 안 됨", () => {
    const text = "이세이 미야케 맨 ISSEY MIYAKE MEN 화이트 레더 스니커";
    const sku = ruleMatch(text, text);
    assert.ok(
      sku === null || sku.id !== "bag-baobao-issey-miyake-lucent",
      `baobao bag SKU가 sneaker 매물에 잘못 매칭됨: ${sku?.id}`,
    );
  });

  it("Coach broad SKU 가 Coccinelle/코치넬레 매물에 매칭 안 됨", () => {
    const text = "코치넬레 마빈 트위스트 스몰 숄더백";
    const sku = ruleMatch(text, text);
    assert.ok(
      sku === null || !sku.id.startsWith("bag-coach"),
      `coach SKU가 Coccinelle 매물에 잘못 매칭됨: ${sku?.id}`,
    );
  });

  it("Coach generic tote/shoulder는 signature narrow로 과승격하지 않음", () => {
    assert.equal(ruleMatch("코치 토트백", "코치 일반 토트백")?.id, "bag-coach-broad");
    assert.equal(ruleMatch("코치 시그니처 토트백", "코치 signature canvas tote")?.id, "bag-coach-signature-tote");
  });

  it("Bottega broad SKU 가 Cassette narrow 매칭을 가리지 않음", () => {
    const text = "[정품] 보테가베네타 카세트백 크로스백 풀구성";
    const sku = ruleMatch(text, text);
    assert.equal(sku?.id, "bag-bottega-cassette-mini");
  });

  it("구매인증 문구는 매입글로 오인하지 않고 Bottega Cassette narrow를 유지", () => {
    const text = "보테가베네타 카세트백 미니 블랙 (백화점구매인증가능)";
    const sku = ruleMatch(text, "신세계 백화점 구매인증 가능합니다.");
    assert.equal(sku?.id, "bag-bottega-cassette-mini");
  });

  it("Bottega Cassette 구성품 쇼핑백/파우치 문구가 product type을 tote/pouch로 오염시키지 않음", () => {
    const title = "[급처]네고많이가능 백화점판 [정품] 보테가베네타 카세트백 크로스백";
    const description = "풀구성이에요 백화점영수증 개런티카드 쇼핑백 파우치등 구성 다있습니다";
    const result = parseListingOptions({
      title,
      description,
      skuId: "bag-bottega-cassette-mini",
      skuName: "Cassette Mini Bag",
      category: "bag",
      defaultProductType: "crossbody",
    });
    assert.equal(result.parsedJson.bag_product_type, "crossbody");
    assert.equal(result.comparableKey, "bag|bottega_cassette_mini|crossbody|era_unknown|unknown_size_variant");
  });

  it("Wave 498 — bag comparable_key preserves brand/lane so backpacks do not mix", () => {
    const lululemon = parseListingOptions({
      title: "룰루레몬 미니 백팩 8L",
      description: "새상품",
      skuId: "bag-lululemon-backpack",
      skuName: "Lululemon Backpack",
      category: "bag",
      defaultProductType: "backpack",
    });
    const carhartt = parseListingOptions({
      title: "칼하트 킥플립 백팩 블랙",
      description: "정품",
      skuId: "bag-carhartt-backpack",
      skuName: "Carhartt Backpack",
      category: "bag",
      defaultProductType: "backpack",
    });
    const supreme = parseListingOptions({
      title: "슈프림 백팩 블랙",
      description: "정품",
      skuId: "bag-supreme-backpack",
      skuName: "Supreme Backpack",
      category: "bag",
      defaultProductType: "backpack",
    });
    assert.equal(lululemon.comparableKey, "bag|lululemon_backpack|backpack|era_unknown|unknown_size_variant|a_grade");
    assert.equal(carhartt.comparableKey, "bag|carhartt_backpack|backpack|era_unknown|unknown_size_variant");
    assert.equal(supreme.comparableKey, "bag|supreme_backpack_broad|backpack|era_unknown|unknown_size_variant");
  });

  it("Wave 501 — Supreme backpacks split known variants instead of one broad sample bucket", () => {
    const realtree = parseListingOptions({
      title: "슈프림 리얼트리 백팩 팝니다",
      description: "정품",
      skuId: "bag-supreme-backpack",
      skuName: "Supreme Backpack",
      category: "bag",
      defaultProductType: "backpack",
    });
    const field = parseListingOptions({
      title: "23SS 슈프림 필드 백팩 블랙 판매합니다",
      description: "정품",
      skuId: "bag-supreme-backpack",
      skuName: "Supreme Backpack",
      category: "bag",
      defaultProductType: "backpack",
    });
    const fw23 = parseListingOptions({
      title: "슈프림 백팩 23FW",
      description: "새상품",
      skuId: "bag-supreme-backpack",
      skuName: "Supreme Backpack",
      category: "bag",
      defaultProductType: "backpack",
    });
    assert.equal(realtree.comparableKey, "bag|supreme_backpack_realtree|backpack|era_unknown|unknown_size_variant");
    assert.equal(field.comparableKey, "bag|supreme_backpack_field|backpack|era_unknown|unknown_size_variant");
    assert.equal(fw23.comparableKey, "bag|supreme_backpack_23fw|backpack|era_unknown|unknown_size_variant|a_grade");
  });

  it("Wave 498 — shoe broad comparable_key keeps brand instead of one luxury broad bucket", () => {
    const dior = parseListingOptions({
      title: "정품 디올 디커넥트 스니커즈 240",
      description: "상태 좋습니다",
      skuId: "shoe-dior-broad",
      skuName: "Dior Shoes (broad)",
      category: "shoe",
    });
    const gucci = parseListingOptions({
      title: "구찌 스니커즈 260",
      description: "상태 좋습니다",
      skuId: "shoe-gucci-broad",
      skuName: "Gucci Shoes (broad)",
      category: "shoe",
    });
    assert.equal(dior.comparableKey, "shoe|dior_broad|sneaker|240|b_grade");
    assert.equal(gucci.comparableKey, "shoe|gucci_broad|sneaker|260|b_grade");
  });

  it("Wave 500 — shoe collab comparable_key keeps collaborator axis", () => {
    const cdgNike = parseListingOptions({
      title: "꼼데가르송 X 나이키 클래식 SP2 블랙 240",
      description: "정품",
      skuId: "shoe-cdg-nike-collab",
      skuName: "Nike x CDG",
      category: "shoe",
    });
    const stussyNike = parseListingOptions({
      title: "나이키X스투시 LD-1000 블루 240",
      description: "정품",
      skuId: "shoe-stussy-nike-collab",
      skuName: "Nike x Stussy",
      category: "shoe",
    });
    assert.equal(cdgNike.comparableKey, "shoe|cdg_nike_collab|sneaker|240|unknown_condition");
    assert.equal(stussyNike.comparableKey, "shoe|stussy_nike_collab|sneaker|240|unknown_condition");
  });

  it("Wave 500 — Adidas Adizero sub-lines do not share one running-shoe key", () => {
    const aruku = parseListingOptions({
      title: "아디다스 아디제로 아루쿠 그레이 270",
      description: "상태 좋아요",
      skuId: "shoe-adidas-adizero",
      skuName: "Adidas Adizero",
      category: "shoe",
    });
    const evoSl = parseListingOptions({
      title: "아디다스 아디제로 EVO SL 270 러닝화",
      description: "상태 좋아요",
      skuId: "shoe-adidas-adizero",
      skuName: "Adidas Adizero",
      category: "shoe",
    });
    const boston = parseListingOptions({
      title: "아디다스 아디제로 보스턴13 270",
      description: "상태 좋아요",
      skuId: "shoe-adidas-adizero",
      skuName: "Adidas Adizero",
      category: "shoe",
    });
    assert.equal(aruku.comparableKey, "shoe|adidas_adizero_aruku|sneaker|270|b_grade");
    assert.equal(evoSl.comparableKey, "shoe|adidas_adizero_evo_sl|sneaker|270|b_grade");
    assert.equal(boston.comparableKey, "shoe|adidas_adizero_boston|sneaker|270|b_grade");
  });

  it("Wave 501 — Asics Novablast and Superblast split comparable model keys", () => {
    const novablast = parseListingOptions({
      title: "아식스 노바블라스트 5 에키덴 245mm 새상품",
      description: "국내 매장 구매",
      skuId: "shoe-asics-novablast",
      skuName: "Asics Novablast/Superblast",
      category: "shoe",
    });
    const superblast = parseListingOptions({
      title: "아식스 슈퍼블라스트 글로우 옐로우 아쿠아마린 265 새제품 팝니다.",
      description: "정품",
      skuId: "shoe-asics-novablast",
      skuName: "Asics Novablast/Superblast",
      category: "shoe",
    });
    assert.equal(novablast.comparableKey, "shoe|asics_novablast|sneaker|245|a_grade");
    assert.equal(superblast.comparableKey, "shoe|asics_superblast|sneaker|265|a_grade");
  });

  it("Wave 500 — Dunk Low off-color rows stay out of black-white ready lane", () => {
    const offColor = parseListingOptions({
      title: "나이키 덩크 로우 라이트 소프트 핑크 여성 240",
      description: "정품",
      skuId: "shoe-nike-dunk-low-black-white",
      skuName: "Nike Dunk Low Standard Colors",
      category: "shoe",
    });
    const blackWhite = parseListingOptions({
      title: "나이키 덩크 로우 블랙 화이트 240",
      description: "정품",
      skuId: "shoe-nike-dunk-low-black-white",
      skuName: "Nike Dunk Low Standard Colors",
      category: "shoe",
    });
    assert.equal(offColor.needsReview, true);
    assert.ok((offColor.parsedJson.critical_unknown as string[]).includes("shoe_dunk_color_variant_review"));
    assert.equal(blackWhite.needsReview, false);
  });

  it("Wave 529 — Dunk Low Neptune Green Sail stays out of black-white ready lane", () => {
    const title = "[새제품] 250 나이키 덩크 로우 SE 85 넵튠 그린 앤 세일";
    const offColor = parseListingOptions({
      title,
      description: "정품",
      skuId: "shoe-nike-dunk-low-black-white",
      skuName: "Nike Dunk Low Standard Colors",
      category: "shoe",
    });
    assert.equal(offColor.needsReview, true);
    assert.ok((offColor.parsedJson.critical_unknown as string[]).includes("shoe_dunk_color_variant_review"));
    assert.notEqual(ruleMatch(title, "정품")?.id, "shoe-nike-dunk-low-black-white");
  });

  it("Wave 501 — Dunk Low SE Flip stays out unless black-white is explicit", () => {
    const flip = parseListingOptions({
      title: "나이키 덩크로우 SE플립 판매합니다",
      description: "정품",
      skuId: "shoe-nike-dunk-low-black-white",
      skuName: "Nike Dunk Low Standard Colors",
      category: "shoe",
    });
    assert.equal(flip.needsReview, true);
    assert.ok((flip.parsedJson.critical_unknown as string[]).includes("shoe_dunk_color_variant_review"));
  });

  it("Bottega Cassette repeated variants split away from generic cassette mini", () => {
    assert.equal(
      ruleMatch("보테가 베네타 미니 패딩 테크 카세트백 S급", "")?.id,
      "bag-bottega-cassette-padded-tech",
    );
    assert.equal(
      ruleMatch("새상품급 보테가베네타 스몰 패딩 레더 카세트백 가방 패러킷 그린 정품", "")?.id,
      "bag-bottega-cassette-padded",
    );
    assert.equal(
      ruleMatch("보테가베네타 미니 카세트 카메라백", "")?.id,
      "bag-bottega-cassette-camera",
    );
    assert.equal(
      ruleMatch("보테가베네타 카세트 미니 버킷백 블랙", "")?.id,
      "bag-bottega-cassette-bucket",
    );
    assert.equal(
      ruleMatch("보테가베네타 카세트 지갑 3단 폴더형 나파 포켓 미니지갑", "")?.id,
      "bag-bottega-cassette-wallet",
    );
    assert.equal(
      ruleMatch("보테가베네타 카세트백 미니 블랙", "")?.id,
      "bag-bottega-cassette-mini",
    );
  });

  it("bag product type은 제목의 토트백을 설명 수납품보다 우선한다", () => {
    const result = parseListingOptions({
      title: "메종 마르지엘라 5AC 드로스트링 미니 토트백",
      description: "지갑, 휴대폰, 파우치 정도는 들어가고 스트랩으로 숄더나 크로스로도 연출 가능합니다.",
      skuId: "bag-margiela-5ac-mini",
      skuName: "5AC Mini/Micro Bag",
      category: "bag",
      defaultProductType: "crossbody",
    });

    assert.equal(result.parsedJson.bag_product_type, "tote");
    assert.equal(result.parsedJson.bag_product_type_source, "title");
    assert.equal(result.comparableKey, "bag|margiela_5ac_mini|tote|era_unknown|unknown_size_variant");
  });

  it("Longchamp Le Pliage requires explicit line text, not generic Longchamp bag wording", () => {
    assert.equal(
      ruleMatch("롱샴 르 플리아쥬 핸드백 블랙", "정품")?.id,
      "bag-longchamp-le-pliage",
    );
    assert.equal(
      ruleMatch("롱샴 토트백 블랙", "정품")?.id ?? null,
      null,
    );
    assert.equal(
      ruleMatch("롱샴 핸드백 블랙", "정품")?.id ?? null,
      null,
    );
  });

  it("Margiela 5AC glued notation은 broad fallback이 아니라 5AC narrow로 간다", () => {
    assert.equal(ruleMatch("마르지엘라 5ac크로스백", "정품끈 보유")?.id, "bag-margiela-5ac-mini");
    assert.equal(ruleMatch("메종마르지엘라 5ac미니백", "브라운 가방")?.id, "bag-margiela-5ac-mini");
  });

  it("명품 종이 쇼핑백/패키지는 broad bag SKU로 매칭하지 않음", () => {
    for (const text of [
      "생로랑 쇼핑백",
      "[새것] 입생로랑 발렌타인 종이백 패키지 1개",
    ]) {
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.category !== "bag",
        `paper shopping bag이 bag SKU로 잘못 매칭됨: ${text} -> ${sku?.id}`,
      );
    }
  });

  it("paper shopping-bag accessory rows do not enter clothing broad, while included shopping bag remains allowed", () => {
    const accessory = ruleMatch(
      "톰브라운 쇼핑백 미사용 (중) 맨투맨,니트,가디건,후드,후드집업용",
      "쇼핑백 단품",
    );
    assert.ok(
      accessory === null || accessory.category !== "clothing",
      `shopping-bag accessory matched clothing SKU: ${accessory?.id}`,
    );

    const fullItem = ruleMatch(
      "톰브라운 밀라노스티치 가디건 쇼핑백 포함",
      "정품 가디건 본품",
    );
    assert.equal(fullItem?.id, "clothing-thombrowne-apparel-broad");
  });

  it("정상 명품 가방 표현은 broad bag fallback 유지", () => {
    const sku = ruleMatch("생로랑 케이트 크로커다일 태슬백 블랙 은장", "생로랑 케이트 숄더백");
    assert.equal(sku?.id, "bag-ysl-broad");
  });

  it("패션 broad fallback은 description 구성품 브랜드 때문에 다른 broad로 갈아타지 않음", () => {
    const sku = ruleMatch(
      "미우미우 토트백  정품",
      "전체적으로 상태 양호합니다. 본품과 스트랩 구성입니다. 디올 더스트백에 넣어드릴께요.",
    );
    assert.equal(sku?.id, "bag-miumiu-broad");
  });

  it("Supreme 5패널/스냅백 모자류는 bag SKU로 매칭하지 않음", () => {
    for (const text of [
      "슈프림 월드와이드 메쉬 백 5패널 블랙 20SS",
      "슈프림 사이드 스냅백",
    ]) {
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.category !== "bag",
        `Supreme cap이 bag SKU로 잘못 매칭됨: ${text} -> ${sku?.id}`,
      );
    }
  });

  it("Supreme repeated side bag lines split away from generic shoulder", () => {
    assert.equal(
      ruleMatch("슈프림 반다나 타프 사이드백 블랙 21SS", "")?.id,
      "bag-supreme-bandana-tarp-side",
    );
    assert.equal(
      ruleMatch("슈프림 필드 사이드 백 올리브 곤즈 - 23SS", "")?.id,
      "bag-supreme-field-side",
    );
    assert.equal(
      ruleMatch("[OS] 슈프림 퍼퍼 사이드백 블루 페이즐리 - 22FW", "")?.id,
      "bag-supreme-puffer-side",
    );
    assert.equal(
      ruleMatch("슈프림 푸퍼 사이드백 블루 페이즐리 가방", "")?.id,
      "bag-supreme-puffer-side",
    );
    assert.equal(
      ruleMatch("슈프림 숄더백 크로스백 미니백 블랙- 18SS", "")?.id,
      "bag-supreme-shoulder",
    );
  });

  it("Supreme mesh/Nike bag variants do not enter generic shoulder", () => {
    assert.equal(
      ruleMatch("슈프림 나이키 레더 숄더백", "")?.id,
      "bag-supreme-nike-leather-shoulder",
    );
    assert.equal(
      ruleMatch("Supreme 슈프림 메쉬 미니더플백 카모", "")?.id,
      "bag-supreme-mesh-duffle",
    );
    assert.equal(
      ruleMatch("슈프림 메쉬 더플백 블랙 23ss", "")?.id,
      "bag-supreme-mesh-duffle",
    );
    assert.equal(
      ruleMatch("supreme 슈프림 메쉬 더블백 23ss", "")?.id,
      "bag-supreme-mesh-duffle",
    );
    assert.equal(
      ruleMatch("슈프림 메쉬 토트백 레드 - 25SS", "")?.id,
      "bag-supreme-mesh-tote",
    );
    assert.equal(
      ruleMatch("슈프림 플레이보이 메쉬 백 카모 26ss", "")?.id,
      "bag-supreme-mesh-bag",
    );
    assert.equal(
      ruleMatch("슈프림 x 밴슨 레더스 메쉬 백 6-패널 블랙 - 25FW", "")?.id ?? null,
      null,
    );
    assert.equal(
      ruleMatch("슈프림X코스 포타프로 헤드폰", "")?.id ?? null,
      null,
    );
  });

  it("Supreme x TNF bag shapes split away from backpack and cap noise", () => {
    assert.equal(
      ruleMatch("슈프림 x 노스페이스 RTG 가방 백팩 블랙 - 20SS", "")?.id,
      "bag-tnf-supreme-backpack",
    );
    assert.equal(
      ruleMatch("슈프림 노스페이스 숄더백 Shoulder Bag 중고제품.팝니다.", "")?.id,
      "bag-tnf-supreme-shoulder",
    );
    assert.equal(
      ruleMatch("[os] 슈프림 노스페이스 멀티 토트백", "")?.id,
      "bag-tnf-supreme-tote",
    );
    assert.equal(
      ruleMatch("슈프림 노스페이스 16FW 루11 럼바팩 낙엽", "")?.id,
      "bag-tnf-supreme-waist",
    );
    assert.equal(
      ruleMatch("슈프림 x 노스페이스 스플릿 6-패널 블랙 - 24SS", "")?.id ?? null,
      null,
    );
    assert.equal(
      ruleMatch("마지막으로 내립니더 !! 슈프림 노스페이스 스키 고글 블루", "")?.id ?? null,
      null,
    );
  });

  it("Supreme x TNF repeated apparel lines split away from broad collab", () => {
    assert.equal(
      ruleMatch("Supreme 슈프림 노스페이스 히말라야 라임 XL", "")?.id,
      "clothing-tnf-supreme-himalaya-parka",
    );
    assert.equal(
      ruleMatch("슈프림 노스페이스 19ss 아크로고 바람막이", "")?.id,
      "clothing-tnf-supreme-arc-logo-jacket",
    );
    assert.equal(
      ruleMatch("슈프림 노스페이스 테이프심 코치 자켓 블랙 XL", "")?.id,
      "clothing-tnf-supreme-tape-seam-jacket",
    );
    assert.equal(
      ruleMatch("슈프림 x 노스페이스 트레킹 컨버터블 자켓 블랙 - 22SS", "")?.id,
      "clothing-tnf-supreme-trekking-convertible-jacket",
    );
    assert.equal(
      ruleMatch("슈프림 x 노스페이스 스팁 테크 아포지 자켓 블랙 - 21FW", "")?.id,
      "clothing-tnf-supreme-steep-tech-jacket",
    );
    assert.equal(
      ruleMatch("supreme x the north face split shell 자켓", "")?.id,
      "clothing-tnf-supreme-split-shell-jacket",
    );
    assert.equal(
      ruleMatch("슈프림 x 노스페이스 스플릿 눕시 카모 패딩 L사이즈", "")?.id,
      "clothing-tnf-supreme-nuptse",
    );
    assert.equal(
      ruleMatch("슈프림 노스페이스 반다나 자켓", "")?.id,
      "clothing-tnf-supreme-bandana-jacket",
    );
    assert.equal(
      ruleMatch("슈프림 노스페이스 반다나 마운틴 자켓 바람막이 S 블랙", "")?.id,
      "clothing-tnf-supreme-bandana-jacket",
    );
    assert.equal(
      ruleMatch("슈프림 노스페이스 레더 마운틴 가죽자켓 블랙 L사이즈", "")?.id,
      "clothing-tnf-supreme-leather-mountain-jacket",
    );
    assert.equal(
      ruleMatch("슈프림 x 노스페이스 아크로고 마운틴 파카 옐로우 - 19SS", "")?.id,
      "clothing-tnf-supreme-arc-logo-jacket",
    );
    assert.equal(
      ruleMatch("슈프림 노스페이스 레더 마운틴 파카 M (18FW)", "")?.id,
      "clothing-tnf-supreme-leather-mountain-jacket",
    );
    assert.equal(
      ruleMatch("슈프림 x 노스페이스 서밋 시리즈 레스큐 발토로 자켓 블랙 패딩", "구매희망시 내부라벨")?.id,
      "clothing-tnf-supreme-baltoro",
    );
    assert.equal(
      ruleMatch("(s) OG 노스페이스드라이로프 슈프림노스페이스발토로 노스페이스패딩", "")?.id ?? null,
      null,
    );
    assert.equal(
      ruleMatch("(260)슈프림 22SS 노스페이스 트레킹 샌달 블랙", "")?.id,
      "shoe-tnf-supreme-slipper",
    );
  });

  it("Supreme x TNF G-Shock routes to watch, not clothing", () => {
    const sku = ruleMatch("슈프림X노스페이스X카시오 지샥 DW-6900 블랙", "");
    assert.equal(sku?.id, "watch-tnf-supreme-gshock-dw6900");
    assert.equal(sku?.category, "watch");

    const parsed = parseListingOptions({
      title: "슈프림X노스페이스X카시오 지샥 DW-6900 블랙",
      description: "정품 풀구성",
      skuId: "watch-tnf-supreme-gshock-dw6900",
      skuName: "Supreme × TNF × G-Shock DW-6900 (한정 콜라보)",
      category: "watch",
    });
    assert.equal(parsed.comparableKey, "casio|tnf_supreme_gshock_dw6900");
    assert.equal(ruleMatch("슈프림 카시오 지샥 DW-6900 블랙", "")?.id ?? null, null);
  });

  it("Salomon ACS 크로스백/숄더백/웨이스트백은 shoe ACS Pro로 매칭하지 않음", () => {
    for (const text of [
      "[해외] 살로몬 ACS 리바이즈드 크로스백 26SS",
      "[해외] 살로몬 ACS 숄더백 26SS",
      "[해외] 살로몬 ACS 웨이스트백 3 26SS",
    ]) {
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.id !== "shoe-salomon-acs-pro",
        `Salomon ACS bag이 shoe SKU로 잘못 매칭됨: ${text} -> ${sku?.id}`,
      );
    }
  });

  it("뷰티/SPA/스타일 bait 가방 매물은 럭셔리 broad SKU로 매칭하지 않음", () => {
    for (const text of [
      "디올뷰티 리미티드 홀리데이 토드백 미듐 사이즈",
      "르메르 유니클로 유니클로U 드로우 스트링백 숄더백 크로스백 여행가방",
    ]) {
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.category !== "bag",
        `beauty/SPA bait가 bag SKU로 잘못 매칭됨: ${text} -> ${sku?.id}`,
      );
    }
  });

  it("백화점판 의류 문구는 bare 백 신호로 럭셔리 bag broad에 매칭하지 않음", () => {
    for (const text of [
      "디올 DIOR 로고 니트 L 백화점판 캐시미어 신형 팝니다",
      "급처 루이비통 모노그램 스케이트진 국내백화점",
      "M) [백화점판] 루이비통 그라디언트 니트",
    ]) {
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.category !== "bag",
        `백화점판/의류 매물이 bag SKU로 잘못 매칭됨: ${text} -> ${sku?.id}`,
      );
    }
  });

  it("톰브라운 스타일/룩 bait와 강아지 니트는 Thom Browne apparel broad에 매칭하지 않음", () => {
    const dogKnit = ruleMatch("톰브라운 스탈 강아지 니트L", "5kg 아가가 입으면 잘 맞아요");
    assert.ok(
      dogKnit === null || dogKnit.id !== "clothing-thombrowne-apparel-broad",
      `pet/style bait가 Thom Browne apparel broad로 잘못 매칭됨: ${dogKnit?.id}`,
    );

    const suspender = ruleMatch(
      "[정품] 장원영의 타미진스 빈티지 톰브라운 타미힐피거 서스펜더",
      "타미정품 박스풀. 톰브라운룩 코디용 서스펜더입니다.",
    );
    assert.ok(
      suspender === null || suspender.id !== "clothing-thombrowne-apparel-broad",
      `Tommy/style bait가 Thom Browne apparel broad로 잘못 매칭됨: ${suspender?.id}`,
    );
  });

  it("Thom Browne / Carhartt 별도 콜라보 라인은 broad apparel fallback에 섞지 않음", () => {
    for (const [title, blockedSku] of [
      ["톰브라운X코에 KOE 옥스포드 버튼다운 화이트 셔츠", "clothing-thombrowne-apparel-broad"],
      ["톰브라운 미스터톰 스웨트셔츠 백화점 한정판", "clothing-thombrowne-apparel-broad"],
      ["와코마리아 x 칼하트 레오파드 셔츠", "clothing-carhartt-apparel-broad"],
    ] as const) {
      const sku = ruleMatch(title, title);
      assert.ok(
        sku === null || sku.id !== blockedSku,
        `separate collab/limited line matched broad SKU: ${title} -> ${sku?.id}`,
      );
    }
  });

  it("MM6/Margiela collaborations do not fall into unrelated apparel broad lanes", () => {
    assert.equal(ruleMatch("슈프림 x MM6 메종 마르지엘라 박스로고 티셔츠 XL", "")?.id ?? null, null);
    assert.equal(ruleMatch("메종 마르지엘라 MM6 x 노스페이스 서클 후리스 자켓", "")?.id ?? null, null);
  });

  it("Nike championship court shoe wording does not match Champion clothing broad", () => {
    const sku = ruleMatch("나이키 덩크 로우 레트로 챔피언쉽 코트 퍼플 275", "스니커즈");
    assert.ok(
      sku === null || sku.id !== "clothing-champion-apparel-broad",
      `Nike shoe colorway matched Champion clothing broad: ${sku?.id}`,
    );
  });

  it("Champion Reverse Weave is split from generic Champion apparel broad", () => {
    assert.equal(
      ruleMatch("90s Champion Reverse Weave 스웻셔츠", "정품")?.id,
      "clothing-champion-reverse-weave",
    );
    assert.equal(
      ruleMatch("챔피온 리버스위브 후드티셔츠 판매합니다", "정품")?.id,
      "clothing-champion-reverse-weave",
    );
    assert.equal(
      ruleMatch("챔피온 USA 그레이 맨투맨", "정품")?.id,
      "clothing-champion-apparel-broad",
    );
  });

  it("Champion collab and limited lanes do not fall back to generic Champion broad", () => {
    for (const title of [
      "챔피온 X 글로니 캐미솔 나시 탑 White",
      "글로니x챔피온 스웨트 베스트 후드 멜란지 그레이 S",
      "챔피온 x 디스이즈네버댓 콜라보 맨투맨 크루넥",
      "FUCT x Champion 퍽트 챔피온 스웻팬츠",
    ]) {
      const sku = ruleMatch(title, "정품");
      assert.ok(
        sku === null || sku.id !== "clothing-champion-apparel-broad",
        `Champion collab matched generic broad SKU: ${title} -> ${sku?.id}`,
      );
    }

    assert.equal(
      ruleMatch("챔피온 USA 그레이 맨투맨", "정품")?.id,
      "clothing-champion-apparel-broad",
    );
  });

  it("CDG PLAY heart staples are split from generic Comme des Garcons broad", () => {
    assert.equal(
      ruleMatch("꼼데가르송 플레이 검정 하트 반팔 티셔츠", "정품")?.id,
      "clothing-cdg-play-tee",
    );
    assert.equal(
      ruleMatch("꼼데가르송 하트 와펜 가디건 S", "정품")?.id,
      "clothing-cdg-play-cardigan",
    );
    assert.equal(
      ruleMatch("꼼데가르송 플레이 블랙 하트 PK 반팔 카라티", "정품")?.id,
      "clothing-cdg-play-polo",
    );
    assert.equal(
      ruleMatch("꼼데가르송 플레이 스트라이프 셔츠", "정품")?.id,
      "clothing-cdg-play-shirt",
    );
    assert.equal(
      ruleMatch("꼼데가르송 플레이 하트 후드 집업", "정품")?.id,
      "clothing-cdg-play-hoodie",
    );
    assert.equal(
      ruleMatch("꼼데가르송 티셔츠 Comme Des Garcons", "정품")?.id,
      "clothing-cdg-apparel-broad",
    );
    for (const title of [
      "요지 재패니즈 하이웨스트 비대칭 스커트 꼼데가르송 맛",
      "꼼데가르송 구찌 홀리데이 PVC백",
      "나이키 플레이 꼼데가르송 콜라보 후드티 남성 사이즈 XL",
    ]) {
      const sku = ruleMatch(title, "정품");
      assert.ok(
        sku === null || !sku.id.startsWith("clothing-cdg-"),
        `CDG apparel bait should not match clothing CDG SKU: ${title} -> ${sku?.id}`,
      );
    }
  });

  it("CDG Homme lines are split from generic Comme des Garcons broad", () => {
    assert.equal(
      ruleMatch("꼼데가르송 옴므 플러스 그래픽 반팔티", "정품")?.id,
      "clothing-cdg-homme-plus-apparel-broad",
    );
    assert.equal(
      ruleMatch("꼼데가르송 옴므 comme des garcons homme 셔츠", "정품")?.id,
      "clothing-cdg-homme-apparel-broad",
    );
    assert.equal(
      ruleMatch("Comme des Garcons Homme 헤비 울 자켓", "정품")?.id,
      "clothing-cdg-homme-apparel-broad",
    );
  });

  it("Carhartt Detroit/Active jacket은 broad apparel이 아니라 실모델 lane으로 분리한다", () => {
    assert.equal(
      ruleMatch("칼하트 WIP 디트로이트 자켓 OG", "정품")?.id,
      "clothing-carhartt-detroit-jacket",
    );
    assert.equal(
      ruleMatch("(XL)칼하트 덕 액티브 후드자켓 J130 BRN 칼하트브라운", "정품")?.id,
      "clothing-carhartt-active-jacket",
    );
    assert.equal(
      ruleMatch("칼하트 블루 윈드브레이커 숏 자켓 2xl", "정품")?.id,
      "clothing-carhartt-apparel-broad",
    );
  });

  it("Carhartt repeated pants lanes are split from broad apparel", () => {
    assert.equal(
      ruleMatch("Carhartt 더블니 워크 팬츠 (34\")", "정품")?.id,
      "clothing-carhartt-double-knee-pants",
    );
    assert.equal(
      ruleMatch("칼하트 WIP 레귤러 카고팬츠 바지 화이트 40X32", "정품")?.id,
      "clothing-carhartt-cargo-pants",
    );
    assert.equal(
      ruleMatch("칼하트 블루 윈드브레이커 숏 자켓 2xl", "정품")?.id,
      "clothing-carhartt-apparel-broad",
    );
  });

  it("Carhartt repeated WIP/vintage model lanes are split from broad apparel", () => {
    assert.equal(
      ruleMatch("칼하트 WIP OG 산타페 자켓 파이신 S", "정품")?.id,
      "clothing-carhartt-santa-fe-jacket",
    );
    assert.equal(
      ruleMatch("칼하트 wip 메디슨 자켓 네이비 L", "정품")?.id,
      "clothing-carhartt-madison-apparel-broad",
    );
    assert.equal(
      ruleMatch("칼하트 랜든 팬츠 스미스필드 버번 스톤 다이드 36", "정품")?.id,
      "clothing-carhartt-landon-pants",
    );
    assert.notEqual(
      ruleMatch("칼하트 랜든 쇼츠 반바지 (30)", "정품")?.id,
      "clothing-carhartt-landon-pants",
    );
    assert.equal(
      ruleMatch("칼하트 WIP 체이스 스웻팬츠 헤더그레이 S", "정품")?.id,
      "clothing-carhartt-chase-sweatpants",
    );
    assert.equal(
      ruleMatch("칼하트 연청 데님 셔츠", "정품")?.id,
      "clothing-carhartt-apparel-broad",
    );
  });

  it("Dior J'ADIOR 슬링백 신발은 Dior bag broad로 매칭하지 않음", () => {
    const sku = ruleMatch("디올 J'ADIOR 39D 약250 슬링백", "디올 슬링백 슈즈");
    assert.ok(
      sku === null || sku.id !== "bag-dior-broad",
      `J'ADIOR shoe가 Dior bag broad로 잘못 매칭됨: ${sku?.id}`,
    );
  });

  it("백앤센스 이너백 액세서리는 Lemaire bag broad로 매칭하지 않음", () => {
    const sku = ruleMatch("백앤센스 르메르 크루아상 미니 포춘백 이너백", "이너백 액세서리");
    assert.ok(
      sku === null || sku.id !== "bag-lemaire-broad",
      `이너백 액세서리가 Lemaire bag broad로 잘못 매칭됨: ${sku?.id}`,
    );
  });

  it("Prada beauty gift crossbody는 Pocono narrow bag으로 매칭하지 않음", () => {
    const sku = ruleMatch("프라다뷰티 3단 크로스백", "프라다뷰티 기프트 포코노 천 소재");
    assert.ok(
      sku === null || sku.id !== "bag-prada-pocono-vintage",
      `beauty gift가 Prada Pocono bag으로 잘못 매칭됨: ${sku?.id}`,
    );
  });

  it("정상 Prada Pocono 본품은 vintage Pocono lane 유지", () => {
    const sku = ruleMatch("프라다 포코노 빈티지 숄더백", "프라다 포코노 나일론 본품 가방");
    assert.equal(sku?.id, "bag-prada-pocono-vintage");
  });

  it("Prada Re-Edition 2005 Tessuto/Hobo는 기존 nylon hobo narrow로 매칭", () => {
    const sku = ruleMatch("프라다 리에디션 2005 테수토 호보백 블랙 골드 1BH204 R064", "프라다 re-edition 2005 hobo");
    assert.equal(sku?.id, "bag-prada-nylon-hobo-vintage");
  });

  it("정상 Lemaire Croissant 본품은 이너백 포함 문구가 있어도 broad fallback 유지", () => {
    const sku = ruleMatch("르메르 크루아상 스몰 블랙+이너백드림", "본품 가방 판매합니다.");
    assert.equal(sku?.id, "bag-lemaire-broad");
  });

  it("Patagonia shell은 다른 outdoor brand-stuffed bait 매물에 매칭하지 않음", () => {
    const text = "나이키 ACG 바람막이 소프트쉘 블랙 XL 로아 몽벨 파타고니아";
    const sku = ruleMatch(text, text);
    assert.ok(
      sku === null || sku.id !== "clothing-patagonia-shell",
      `Patagonia style bait가 shell SKU로 잘못 매칭됨: ${sku?.id}`,
    );
    assert.notEqual(
      ruleMatch("파타고니아 베이비 토렌쉘 3L 바람막이", "정품")?.id,
      "clothing-patagonia-shell",
    );
  });

  it("Patagonia Retro-X 붙임 표기는 살리고 Retro Pile/Pullover는 섞지 않음", () => {
    assert.equal(
      ruleMatch(
        "파타고니아 클래식 레트로X (새상품)",
        "새상품이고 비닐은 없습니다\n남성사이즈 S (공식사이트 구매)\n무료배송, 교환, 환불 불가",
      )?.id,
      "clothing-patagonia-retro-x",
    );
    assert.equal(
      ruleMatch("파타고니아 레트로파일 풀오버 후드", "후리스")?.id ?? null,
      null,
    );
  });

  it("Wave 456 — Adidas Gazelle broad는 Bold 변형을 먹지 않음", () => {
    assert.equal(
      ruleMatch("아디다스 가젤 OG 225", "정품")?.id,
      "shoe-adidas-gazelle-og-broad",
    );
    assert.equal(
      ruleMatch(
        "(235,240)(새상품)아디다스 스니커즈 가젤 핑크 클라우드 화이트",
        "트렌드인 아디다스 스페지알 삼바와 같이 슬림한 단화 쉐입입니다.",
      )?.id,
      "shoe-adidas-gazelle-og-broad",
    );
    assert.equal(
      ruleMatch(
        "아디다스 가젤 헤이지 그린 270 팝니다.",
        "아디다스 가젤 인도어 헤이지 그린 270 사이즈 판매합니다.",
      )?.id,
      "shoe-adidas-gazelle-indoor-bold-orange",
    );
    assert.equal(
      ruleMatch("새상품) 아디다스 가젤 볼드 핑크 올모스트 옐로우 240", "정품")?.id ?? null,
      null,
    );
    assert.equal(
      ruleMatch("아디다스 가젤부스트 275 런닝화 새상품", "정품")?.id ?? null,
      null,
    );
    assert.equal(
      ruleMatch("아디다스 가젤 클랏 에디슨 첸 270", "정품")?.id ?? null,
      null,
    );
    assert.equal(
      ruleMatch("아디다스 가젤 OG 플랫폼", "정품")?.id ?? null,
      null,
    );
  });

  it("Wave 457 — Adidas Superstar broad는 named derivatives를 먹지 않음", () => {
    assert.equal(
      ruleMatch("아디다스 슈퍼스타 260", "정품")?.id,
      "shoe-adidas-superstar-broad",
    );
    for (const title of [
      "아디다스 슈퍼스타 80s 메탈토 골드 한정판 운동화",
      "아디다스 슈퍼스타 프리미엄 화이트블랙 260",
      "새상품급)아디다스 X Farm 플라워 슈퍼스타(230)",
      "아디다스 슈퍼스타 팔리 parley 280",
      "아디다스 슈퍼스타 마운티어링 슬립온 275",
      "[260] 아디다스 x 디몹 슈퍼스타 80s 80V D-MOP",
      "아디다스 슈퍼스타 레고",
      "[295] 아디다스 x 션 우더스푼 슈퍼스타 블랙",
      "아디다스 슈퍼스타 보네가w",
    ]) {
      const sku = ruleMatch(title, title);
      assert.notEqual(sku?.id, "shoe-adidas-superstar-broad", `${title} matched ${sku?.id}`);
    }
  });

  it("Wave 457 — Adidas Samba OG broad는 club/team/high/classic 파생을 먹지 않음", () => {
    assert.equal(
      ruleMatch("아디다스 삼바 OG 260", "정품")?.id,
      "shoe-adidas-samba-og-broad",
    );
    assert.equal(
      ruleMatch("아디다스 삼바 OG 코어 블랙 260", "정품")?.id,
      "shoe-adidas-samba-og-black",
    );
    for (const title of [
      "아디다스 삼바 하이 235",
      "[미사용/정품] 아디다스 삼바 유벤투스 270",
      "(새상품)아디다스 삼바 팀 쉐도우 그린 셀틱 240",
      "[미사용/정품] 아디다스 삼바 FC 바이에른 뮌헨 270",
      "아디다스 삼바 클래식 245 벨라하디드",
      "(정품/새상품)아디다스 삼바255 / Adidas x Kasina",
    ]) {
      const sku = ruleMatch(title, title);
      assert.notEqual(sku?.id, "shoe-adidas-samba-og-broad", `${title} matched ${sku?.id}`);
    }
  });

  it("Wave 458 — 구매 이력/판매자 매입 상담 문구는 정상 shoe 매물을 차단하지 않음", () => {
    assert.equal(
      ruleMatch(
        "컨버스 척 70 하이 빈티지 화이트 220",
        "컨버스 척 70 하이 빈티지 화이트 220사이즈입니다. 별도 문의 없으시면 바로 안전결제 부탁드려요!\n백화점 구매",
      )?.id,
      "shoe-converse-chuck70-high-broad",
    );
    assert.equal(
      ruleMatch(
        "[37]발렌시아가 트리플 s 블랙 판매.",
        "정품\n국내 매장 구매\n37사이즈\n상태 아주좋습니다",
      )?.id,
      "shoe-balenciaga-triple-s-broad",
    );
    assert.equal(
      ruleMatch(
        "[295] 나이키 사카이 블레이저 회검",
        "고트 구매\n1회착용\n구성품 다 있음",
      )?.id,
      "shoe-nike-sakai-collab",
    );
    assert.equal(
      ruleMatch(
        "[40.5사이즈]에르메스 H 부메랑 스니커즈",
        "구매 시 당일 빠른 배송\n대구 전 지역 명품 매입 문의 · 최고가 매입",
      )?.id,
      "shoe-hermes-broad",
    );
  });

  it("Wave 458 — 실제 구매요청/매입요청은 계속 차단", () => {
    assert.equal(
      ruleMatch("(구매 43)마르지엘라 타비 통 샌들 슬리퍼 쪼리 플리플랍", "상태 상관없이 구매합니다"),
      null,
    );
    assert.equal(
      ruleMatch("에르메스 스니커즈 매입합니다", "삽니다"),
      null,
    );
  });

  it("Wave 501 — Y-3 broad shoe lane does not absorb hats", () => {
    assert.equal(
      ruleMatch("[OS] 아디다스 X 요지야마모토 Y-3 리버스 블랙 네이비 버킷모자", "")?.id,
      undefined,
    );
  });

  it("Wave 506 — remaining ready shoe samples split exact comparable axes", () => {
    const salomonAcsPlus = parseListingOptions({
      title: "살로몬 ACS+ 화이트 실버 260mm",
      description: "정품",
      skuId: "shoe-salomon-acs-pro",
      skuName: "Salomon ACS Pro / ACS+OG (Advanced)",
      category: "shoe",
    });
    assert.equal(salomonAcsPlus.comparableKey, "shoe|acs_plus|sneaker|260|unknown_condition");

    const adidasCopaFg = parseListingOptions({
      title: "아디다스 코파퓨어2+ fg 새상품",
      description: "270 새상품",
      skuId: "shoe-adidas-football",
      skuName: "Adidas Football",
      category: "shoe",
    });
    assert.equal(adidasCopaFg.comparableKey, "shoe|adidas_football_copa|football_fg|270|a_grade");

    const nikeSacaiBlazer = parseListingOptions({
      title: "나이키 블레이저 미드 사카이 스노우 비치 새상품 싸게팜",
      description: "265 새상품",
      skuId: "shoe-nike-sakai-collab",
      skuName: "Nike x Sacai",
      category: "shoe",
    });
    assert.equal(nikeSacaiBlazer.comparableKey, "shoe|nike_sakai_blazer|sneaker|265|a_grade");

    const hokaKaha = parseListingOptions({
      title: "호카 카하2 GTX 250 새상품",
      description: "새상품 사이즈미스",
      skuId: "shoe-hoka-kaha-gtx",
      skuName: "Hoka Kaha 2 GTX",
      category: "shoe",
      defaultProductType: "boot",
    });
    assert.equal(hokaKaha.comparableKey, "shoe|kaha_gtx|boot|250|a_grade");
  });

  it("Wave 529 — shoe size parser prefers earliest explicit mm over later size inventory text", () => {
    const parsed = parseListingOptions({
      title: "뉴발 ML2002RA 235사이즈 새상품",
      description: "뉴발란스 ML2002RA 235사이즈 새상품입니다. 240사이즈 270사이즈도 새상품으로있습니다",
      skuId: "shoe-newbalance-2002r",
      skuName: "New Balance 2002R",
      category: "shoe",
    });
    assert.equal(parsed.parsedJson.shoe_size_mm, 235);
    assert.equal(parsed.comparableKey, "shoe|2002r|sneaker|235|a_grade");
  });

  it("Wave 459 — shoe specific lane과 broad sibling이 같이 잡히면 specific lane을 우선", () => {
    assert.equal(
      ruleMatch("나이키 코르테즈 레더 흰검", "정품")?.id,
      "shoe-nike-cortez",
    );
    assert.equal(
      ruleMatch("뉴발란스 2002R 프로텍션 팩 씨 솔트", "정품")?.id,
      "shoe-newbalance-2002r",
    );
    assert.equal(
      ruleMatch("이지 부스트 350 v2 트리플 블랙", "정품")?.id,
      "shoe-yeezy-boost-350",
    );
    assert.equal(
      ruleMatch("살로몬 Acs 프로 어드밴스드 바닐라 루나락", "정품")?.id,
      "shoe-salomon-acs-pro",
    );
  });

  it("Wave 459 — intended collab short Korean brand tokens are not treated as external bait", () => {
    assert.equal(
      ruleMatch("나이키 x 꼼데가르송 옴므 플러스 덩크 하이 PVC", "정품")?.id,
      "shoe-cdg-nike-collab",
    );
    assert.equal(
      ruleMatch("아디다스 웨일즈보너 삼바 컬리지에이트 그린", "정품")?.id,
      "shoe-adidas-samba-wales-bonner",
    );
  });

  it("Wave 459 — Dunk Low Seoul은 설명의 직거래 지역명만으로 승격하지 않음", () => {
    assert.equal(
      ruleMatch(
        "나이키 덩크 로우 오션 240 사이즈 Nike 스니커즈 운동화 신발",
        "서울 송파 직거래, 택배 가능합니다.",
      )?.id,
      "shoe-nike-dunk-low-black-white",
    );
    assert.equal(
      ruleMatch("나이키 덩크 로우 서울 260", "정품")?.id,
      "shoe-nike-dunk-low-seoul",
    );
  });

  it("Wave 460 — intended shoe collab tokens are preserved without opening broad bait", () => {
    assert.equal(
      ruleMatch("나이키 슈프림 덩크sb 브라운", "정품")?.id,
      "shoe-supreme-nike-sb-collab",
    );
    assert.equal(
      ruleMatch("[새상품]나이키SB 슈프림 덩크 로우 하이퍼블루 270", "정품")?.id,
      "shoe-supreme-nike-sb-collab",
    );
    assert.equal(
      ruleMatch("아식스 세실리에 반센 GT-2160 미드나잇 230사이즈", "정품")?.id,
      "shoe-asics-cecilie-bahnsen-collab",
    );
    assert.equal(
      ruleMatch("발렌시아가 아디다스 스탠스미스 원아웃 오프화이트", "정품")?.id,
      "shoe-adidas-balenciaga-collab",
    );
    assert.equal(
      ruleMatch(
        "발렌시아가 아디다스 스탠 스미스 스니커즈 36사이즈",
        "매장 방문 구매, 당일 현금 매입 모두 가능합니다. 모든 명품 100% 당일 현금 매입 약속드립니다.",
      )?.id,
      "shoe-adidas-balenciaga-collab",
    );
    assert.equal(
      ruleMatch("정품 미국어그 클래식미니 230mm250mm", "새상품 미국어그 클래식미니 220mm")?.id,
      "shoe-ugg-classic-mini",
    );
    assert.equal(
      ruleMatch("아디다스 F50tf 245", "정품")?.id,
      "shoe-adidas-football",
    );
    assert.equal(
      ruleMatch("아디다스f50엘리트 ag 팝니다", "정품")?.id,
      "shoe-adidas-football",
    );
    assert.equal(
      ruleMatch("아디다스 아디제로 아디오스 프로3 오프화이트 베러 스칼렛 285", "정품")?.id,
      "shoe-adidas-adizero",
    );
    assert.equal(
      ruleMatch("아디다스 토바코 그루엔 다크 브라운", "230사이즈 미착용 새제품 발매가 139,000원 구매")?.id,
      "shoe-adidas-tobacco-broad",
    );
    assert.equal(
      ruleMatch("휴먼메이드 아디다스 255 캠퍼스 스니커즈 그린", "실사용5회 정도. 스턱엑스에서 구매")?.id,
      "shoe-adidas-campus",
    );
    assert.equal(
      ruleMatch(
        "아디다스 핸드볼 스페지알 스니커즈 네이비 (235) BD7633",
        "빈티지한 느낌을 위해서 물빠진 네이비색 만들었어요. 2개이상 구매시 무료배송 입니다.",
      )?.id,
      "shoe-adidas-spezial",
    );
    assert.equal(
      ruleMatch("아디다스 x 퍼렐 윌리엄스 휴먼레이스 삼바 알루미늄 원더 모브 240mm", "아디다스코리아 구매")?.id,
      "shoe-adidas-samba-pharrell",
    );
    assert.equal(
      ruleMatch("43 / 디올 B57 미드탑 스니커즈", "쇼룸방문구매, 당일매입 모두 가능합니다. 중고명품 100% 당일현금매입 약속드립니다.")?.id,
      "shoe-dior-b57",
    );
    assert.equal(
      ruleMatch("발렌시아가 3xl 블랙/화이트 45사이즈", "신세계 센텀 구매 박스 더스트백 포함")?.id,
      "shoe-balenciaga-3xl",
    );
    assert.equal(
      ruleMatch("아식스 노바블라스트5 블랙 와이드 판매합니다", "국내 택(온유어마크 구매)")?.id,
      "shoe-asics-novablast",
    );
    assert.equal(
      ruleMatch("아식스 조그100S 시트락 250", "정품")?.id,
      "shoe-asics-jog-100",
    );
    assert.equal(
      ruleMatch("아식스 조그 100T 화이트 런닝화 새상품급", "정품")?.id,
      "shoe-asics-jog-100",
    );
    assert.equal(
      ruleMatch("아식스 젤님버스 10.1 크림/퓨어실버", "정품")?.id,
      "shoe-asics-gel-nimbus",
    );
    assert.equal(
      ruleMatch("아식스 젤 님버스 9 글레이셔 그레이 240", "진짜 레어템 못 구해요 이거")?.id,
      "shoe-asics-gel-nimbus",
    );
    assert.equal(
      ruleMatch("아식스 젤님버스 10.1 크림/퓨어실버", "구성품 없이 신발만 판매입니다")?.id,
      "shoe-asics-gel-nimbus",
    );
    assert.equal(
      ruleMatch("[42사이즈]디올 B30 테크니컬 스니커즈", "-매입 제품이다보니 확인하지 못한 사용감, 미세 오염, 미세 스크래치는 존재할 수 있습니다")?.id,
      "shoe-dior-b30",
    );
    assert.equal(
      ruleMatch("[40사이즈]디올 오블리크 B25 러너 스니커즈", "-매입 제품이다보니 확인하지 못한 사용감, 미세 오염, 미세 스크래치는 존재할 수 있습니다")?.id,
      "shoe-dior-b25",
    );
    assert.equal(
      ruleMatch("아식스 젤카야노 14 실버", "구매 원합니다"),
      null,
    );
    assert.equal(
      ruleMatch("ASICS GEL-KINETIC FLUENT MEN", "재고가 없는 구매대행 상품입니다. 현지에서 직접 구매합니다"),
      null,
    );
    assert.equal(
      ruleMatch("뉴발란스 M2002RAW 2002시리즈 웜 알파카", "구매 시 요청 사항에 원하시는 사이즈 꼭 남겨주세요.")?.id,
      "shoe-newbalance-2002r",
    );
    assert.equal(
      ruleMatch("NB2002R 트렌드 남녀 런닝화 에어벤트화 빈티지 슈즈", "정품 새상품")?.id,
      "shoe-newbalance-2002r",
    );
    assert.equal(
      ruleMatch("정품/새상품 호카본디9와이드러닝화 ( 블랙 / 화이트 )", "구매전 채팅주세요")?.id,
      "shoe-hoka-bondi-9",
    );
    assert.equal(
      ruleMatch("호카(Hoka) 본디 8TS 하버 미스트255 size", "중고에 대한 이해도가 있는 분만 구매해 주세요")?.id,
      "shoe-hoka-bondi-8",
    );
    assert.equal(
      ruleMatch("뉴발란스 327LAB 255", "정품")?.id,
      "shoe-newbalance-327-broad",
    );
    assert.equal(
      ruleMatch("뉴발란스 1600LG 230", "사용감 거의 없고 박스 없습니다")?.id,
      "shoe-newbalance-1600-broad",
    );
    assert.equal(
      ruleMatch("뉴발란스 1300jp(280), 26년 5월까지만 판매", "동일모델 275사이즈와 교환도 가능합니다")?.id,
      "shoe-newbalance-1300-broad",
    );
    assert.equal(
      ruleMatch("무료배송 - Made in USA 뉴발란스 1400JP(베이지) 270", "일괄구매 or 빠른거래시 가격 조정 가능합니다.")?.id,
      "shoe-newbalance-1400-broad",
    );
    assert.equal(
      ruleMatch("에르메스 에제리 샌들 젤리슈즈 알로하 EGERIE", "완벽한 정품만 매입,위탁판매하며 가품일시 2배이상 보상해드리니")?.id,
      "shoe-hermes-egerie",
    );
    assert.equal(
      ruleMatch(
        "[285] 미즈노 모렐리아 클래식 MD",
        "모렐리아 중급 등급의 소가죽 제품으로 단종 모델이라 구하기 힘들며 강도가 아주 좋은 스터드라 추천드립니다.\n모든 상품은 배송비 별도 3,500원 입니다.\n제품 및 구매 관련 문의는 편하게 번개톡 주세요.",
      )?.id,
      "shoe-mizuno-morelia",
    );
    assert.equal(
      ruleMatch(
        "(정품) 루이비통 모노그램 스웨이드 부츠 신발 34.5",
        "가품시 100프로 환불 가능합니다. 상태 확실한 파워 정품만 거래합니다. 반품 및 환불은 불가하오니 신중구매 부탁드리며, 구매 전 궁금하신 점은 꼭 문의주세요",
      )?.id,
      "shoe-louisvuitton-broad",
    );
    assert.equal(
      ruleMatch("나이키에어맥스95SE프리미엄 AH8697-002", "정품")?.id,
      "shoe-nike-airmax-95",
    );
    assert.equal(
      ruleMatch("나이키에어맥스97/여성운동화(사이즈230)", "정품")?.id,
      "shoe-nike-airmax-97",
    );
    assert.equal(
      ruleMatch("(255)나이키 고어텍스 GTX 방수에어맥스90다크스모크그레이[대전]", "정품")?.id,
      "shoe-nike-airmax-90",
    );
    assert.equal(
      ruleMatch("뉴발란스 x 리바이스 데님 99Ov3 270", "정품")?.id,
      "shoe-newbalance-levis-collab",
    );
    assert.equal(
      ruleMatch("조던1x트래비스 스캇 레트로 로우og sp 모카", "정품")?.id,
      "shoe-nike-jordan-1-low-travis-scott-mocha",
    );
    assert.equal(
      ruleMatch("아식스 x 세실리에반센 젤 퀀텀 360", "에딕티드 당첨으로 구매")?.id,
      "shoe-asics-cecilie-bahnsen-collab",
    );
    assert.equal(
      ruleMatch("발렌시아가x아디다스x오프화이트 스탠스미스", "정품"),
      null,
    );
  });

  it("Wave 467 — final shoe tail keeps real shoes and rejects apparel/accessory spillover", () => {
    assert.equal(
      ruleMatch("나투시 나이키스투시 LD-1000 SP 팬텀 아쿠아블루", "미국 LA 스투시매장에서 구매해온 정품")?.id,
      "shoe-stussy-nike-collab",
    );
    assert.equal(ruleMatch("나이키x스투시 나투시 바람막이 셋업", "")?.id ?? null, null);
    assert.equal(ruleMatch("나이키 티파니 포스터 정품 (액자포함) 슈프림 스투시", "")?.id ?? null, null);
    assert.equal(ruleMatch("반스 어센틱 패치워크 데님 일본판 270", "")?.id, "shoe-vans-authentic");
    assert.equal(ruleMatch("노스페이스 보레알리스 부띠 NS87R65B 방한부츠 260", "")?.id, "shoe-tnf-hiking-boots");
    assert.equal(ruleMatch("아디다스 샌들 가젤 비치", "")?.id ?? null, null);
  });
});
