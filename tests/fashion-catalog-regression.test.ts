import { strict as assert } from "node:assert";
import { test } from "node:test";

import { evaluatePoolGate } from "../src/lib/candidate-pool-builder";
import { ruleMatch, skuById } from "../src/lib/catalog";
import { parseListingOptions } from "../src/lib/option-parser";

test("fashion catalog resolves duplicate legacy shoe and bag lanes", () => {
  assert.equal(
    ruleMatch("아디다스 토바코 그루엔 메사 브라운 데저트 290")?.id,
    "shoe-adidas-tobacco-broad",
  );
  assert.equal(
    ruleMatch("아디다스 x 웨일스 보너 삼바 컬리지에이트 레드")?.id,
    "shoe-adidas-samba-wales-bonner",
  );
  assert.equal(
    ruleMatch("코치 태비 숄더백 20")?.id,
    "bag-coach-tabby",
  );
});

test("tnf nuptse 1996 requires explicit 1996 signal", () => {
  assert.equal(
    ruleMatch("노스페이스 1996 레트로 눕시 패딩")?.id,
    "clothing-tnf-nuptse-1996",
  );
  assert.equal(
    ruleMatch("노스페이스 700 눕시 패딩 그레이")?.id,
    "clothing-tnf-nuptse-broad",
  );
});

test("tnf nuptse variants route to internal learning lanes instead of public broad", () => {
  for (const [title, expected] of [
    ["노페 1992 눕시 다운 자켓 차콜 95사이즈 새상품 노스페이스 패딩", "clothing-tnf-nuptse-1992"],
    ["노스페이스 1996 레트로 눕시 베스트", "clothing-tnf-nuptse-vest"],
    ["North face 1996 Eco Nuptse 노스페이스 눕시 해외판", "clothing-tnf-nuptse-eco"],
    ["노스페이스 에코 눕시 패딩", "clothing-tnf-nuptse-eco"],
    ["( L ) 노스페이스 카우스 눕시", "clothing-tnf-nuptse-special"],
    ["The North Face RMST Nuptse Jacket Red L", "clothing-tnf-nuptse-special"],
  ] as const) {
    const sku = ruleMatch(title);
    assert.equal(sku?.id, expected, title);
    assert.equal(evaluatePoolGate({ sku, category: sku?.category ?? null }).canEnterPool, false, title);
  }

  assert.equal(
    ruleMatch("노스페이스 1996 노벨티 눕시 RVS 베스트 XL 105")?.id,
    "clothing-tnf-white-label-novelty",
  );
  assert.equal(
    ruleMatch("노스페이스 1996 노벨티 우드랜드 카모눕시 L100")?.id,
    "clothing-tnf-white-label-novelty",
  );
  assert.equal(ruleMatch("노스페이스 눕시 셔츠"), null);
});

test("FOG Essentials requires a brand signal, not generic essentials wording", () => {
  assert.equal(
    ruleMatch("S 아디다스 에센셜 플리스 3S 풀집 후드 후드티 블랙 GK9051"),
    null,
  );
  assert.equal(
    ruleMatch("피오갓 에센셜 후드티 블랙 M")?.id,
    "clothing-fog-essentials-hoodie",
  );
  assert.equal(
    ruleMatch("FOG Essentials 우먼 베스트")?.id,
    "clothing-fog-essentials",
  );
});

test("Supreme TNF Baltoro jacket wording keeps down-jacket comparable key", () => {
  const sku = ruleMatch("[L] 슈프림x노스페이스 자유의 여신상 발토로 자켓 블랙");
  assert.ok(sku);
  assert.equal(sku?.id, "clothing-tnf-supreme-baltoro");

  const parsed = parseListingOptions({
    title: "[L] 슈프림x노스페이스 자유의 여신상 발토로 자켓 블랙",
    description: "",
    skuId: sku.id,
    skuName: sku.modelName,
    category: sku.category,
    defaultProductType: sku.defaultProductType ?? null,
    bunjangConditionLabel: null,
  });

  assert.match(parsed.comparableKey ?? "", /^clothing\|tnf_supreme_baltoro\|down_jacket\|/);
});

test("Polo Ralph Lauren knit does not absorb other brands using polo as a garment word", () => {
  assert.equal(ruleMatch("COS 스트라이프 니트 폴로"), null);
  assert.equal(ruleMatch("솔리드옴므 남성 니트 폴로셔츠105"), null);
  assert.equal(ruleMatch("Z Pattern Knitted Polo Shirts Dust L사이즈"), null);
  assert.equal(ruleMatch("마르니 체커보드 폴로 니트"), null);
  assert.equal(ruleMatch("DANCING SKELETONS ZIP POLO KNIT_WHITE"), null);
  assert.equal(ruleMatch("유타 UTAR 골프 폴로넥 크라운 팬서 니트 베스트 핑크 M"), null);
  assert.equal(ruleMatch("빈폴 니트 폴로 셔츠(2XL)"), null);
  assert.equal(ruleMatch("폴로(Polo)진스 반집업 꽈배기 니트 L"), null);
  assert.equal(
    ruleMatch("[파격가 정품 여성용] 시스템 니트 반집업 90사이즈 타임 시리즈 에피그램 코오롱스포츠 k2 폴로 랄프로렌 아미"),
    null,
  );
  assert.equal(ruleMatch("잭니클라우스 쿨 래글런 배색 폴로 니트 반팔티셔츠"), null);
  assert.notEqual(ruleMatch("나이키 니트 폴로 셔츠")?.id, "clothing-polo-knit-sweater");
  assert.equal(
    ruleMatch("폴로 랄프로렌 네이비 케이블 니트 L")?.id,
    "clothing-polo-knit-sweater",
  );
});

test("Polo Oxford standard rejects Polo Jeans and sub-line shirt wording", () => {
  assert.notEqual(
    ruleMatch("폴로 진스 컴퍼니 U.S.R.L 밀리터리 옥스포드 셔츠")?.id,
    "clothing-polo-oxford-shirt",
  );
  assert.equal(
    ruleMatch("폴로 랄프로렌 옥스포드 셔츠 M")?.id,
    "clothing-polo-oxford-shirt",
  );
});

test("RRL ready pants lane rejects limited-edition outlier wording", () => {
  assert.equal(ruleMatch("RRL 리미티드 에디션 인디고 헤링본 팬츠 32x32"), null);
  assert.notEqual(
    ruleMatch("더블알엘 필드팬츠 시디드 네추럴 34x32 RRL")?.id,
    "clothing-polo-rrl-denim",
  );
  assert.equal(
    ruleMatch("RRL 더블알엘 치노 팬츠 32")?.id,
    "clothing-polo-rrl-pants",
  );
});

test("Polo Ralph Lauren pique does not absorb other brands using polo as a garment word", () => {
  assert.notEqual(ruleMatch("[새제품/정품] Malbon 말본골프 피멘토 퍼포먼스")?.id, "clothing-polo-pique-classic");
  assert.notEqual(ruleMatch("마크앤로나 반팔골프티105 폴로 카라티 골프웨어")?.id, "clothing-polo-pique-classic");
  assert.notEqual(ruleMatch("나이키 화이트 레드 스트라이프 피케 폴로티 럭비티 L")?.id, "clothing-polo-pique-classic");
  assert.notEqual(ruleMatch("로어즈 Striped Cotton Pique Polo")?.id, "clothing-polo-pique-classic");
  assert.notEqual(ruleMatch("Loars Striped Cotton Pique Polo Shirt")?.id, "clothing-polo-pique-classic");
  assert.ok(!(ruleMatch("나이키 화이트 레드 스트라이프 피케 폴로티 럭비티 L")?.id ?? "").startsWith("clothing-polo-"));
  assert.equal(
    ruleMatch("폴로 랄프로렌 반팔 피케 셔츠 슬림핏 L")?.id,
    "clothing-polo-pique-classic",
  );
});

test("Acne premium denim model tokens stay out of generic broad apparel", () => {
  assert.equal(
    ruleMatch("아크네 스튜디오 1992m 부츠컷 데님 팬츠 31")?.id,
    "clothing-acne-denim-premium",
  );
  assert.equal(ruleMatch("[아크네 스튜디오] River 데님 인디고 블루 (30x30)"), null);
  assert.equal(ruleMatch("[28] 아크네 스튜디오 1995 로데오 블루 데님 팬츠"), null);
  const maxDenim = ruleMatch("아크네 스튜디오 맥스 STR 로우 데님 팬츠");
  assert.equal(maxDenim?.id, "clothing-acne-max-denim");
  assert.equal(evaluatePoolGate({ sku: maxDenim, category: maxDenim?.category ?? null }).canEnterPool, false);
  assert.equal(
    ruleMatch("[46] AcneStudio OKEY PRINTED WORK JACKE")?.id,
    "clothing-acne-jacket-coat",
  );
});

test("Air Max 95 generic lane rejects Carhartt WIP collab wording", () => {
  assert.equal(
    ruleMatch("NIKE AIR MAX 95 WIP 칼하트"),
    null,
  );
});

test("Stussy Nike broad footwear stays out of ready pool until model split", () => {
  const broad = skuById("shoe-stussy-nike-collab");
  assert.ok(broad);
  assert.equal(evaluatePoolGate({ sku: broad, category: broad.category }).canEnterPool, false);

  const spiridon = skuById("shoe-stussy-nike-spiridon");
  assert.ok(spiridon);
  assert.equal(evaluatePoolGate({ sku: spiridon, category: spiridon.category }).canEnterPool, true);
});

test("Arc'teryx Atom/Beta/Proton explicit sub-lines do not collapse into broad lanes", () => {
  const atomGeneric = skuById("clothing-arcteryx-atom");
  const atomLtHoody = skuById("clothing-arcteryx-atom-lt-hoody");
  assert.ok(atomGeneric);
  assert.ok(atomLtHoody);
  assert.equal(evaluatePoolGate({ sku: atomGeneric, category: atomGeneric.category }).canEnterPool, false);
  assert.equal(evaluatePoolGate({ sku: atomLtHoody, category: atomLtHoody.category }).canEnterPool, true);

  assert.equal(
    ruleMatch("아크테릭스 아톰 LT 후디 s")?.id,
    "clothing-arcteryx-atom-lt-hoody",
  );
  assert.match(
    parseListingOptions({
      title: "아크테릭스 아톰 LT 후디 s",
      description: "",
      skuId: "clothing-arcteryx-atom-lt-hoody",
      skuName: "Arc'teryx Atom LT Hoody",
      category: "clothing",
      defaultProductType: "jacket",
      bunjangConditionLabel: null,
    }).comparableKey ?? "",
    /^clothing\|arcteryx_atom_lt_hoody\|jacket\|/,
  );
  assert.equal(
    ruleMatch("여성용 아톰lt 논후드 s", "아크테릭스 정품")?.id,
    "clothing-arcteryx-atom-lt-jacket",
  );
  assert.equal(
    ruleMatch("아크테릭스 아톰 lt 정글 XL"),
    null,
  );
  assert.equal(
    ruleMatch("아크테릭스 베타 SL 고어텍스 우먼")?.id,
    "clothing-arcteryx-beta-sl",
  );
  assert.equal(
    ruleMatch("아크테릭스 베타LT 이그나이트 XL")?.id,
    "clothing-arcteryx-beta-lt",
  );
  assert.equal(
    ruleMatch("아크테릭스 베타 AR 스톰후드 블랙")?.id,
    "clothing-arcteryx-beta-ar",
  );
  assert.equal(
    ruleMatch("아크테릭스 프로톤 FL 자켓")?.id,
    "clothing-arcteryx-proton-fl",
  );
  assert.equal(
    ruleMatch("아크테릭스 프로톤 LT 후디 M")?.id,
    "clothing-arcteryx-proton-lt",
  );
  assert.equal(
    ruleMatch(
      "아크테릭스 아톰 후디",
      "베타SL자켓이랑 입을려고 같은 색상으로 구매했지만 판매합니다.",
    )?.id,
    "clothing-arcteryx-atom",
  );
});

test("Wave 812 clothing sample safety blocks dirty public comparison lanes", () => {
  assert.equal(
    ruleMatch("폴로랄프로렌남성/PK반팔티/L")?.id,
    "clothing-polo-pique-classic",
  );
  assert.equal(ruleMatch("베이프 반팔 샤크 폴로 XL"), null);
  assert.notEqual(
    ruleMatch("스투시x마운틴하드웨어 반팔티 판매합니다")?.id,
    "clothing-stussy-basic-tee",
  );
  assert.notEqual(
    ruleMatch("스투시 돌리 피그먼트 다이드 반팔티")?.id,
    "clothing-stussy-pigment-dye-hoodie",
  );
  assert.notEqual(
    ruleMatch("스투시 8볼 피그먼트 다이드 티셔츠 내츄럴")?.id,
    "clothing-stussy-pigment-dye-hoodie",
  );
  assert.notEqual(
    ruleMatch("ESSENTIALS FEAR OF GOD Zip-up Hoodie")?.id,
    "clothing-fog-essentials-hoodie",
  );
  assert.equal(ruleMatch("피어오브갓 8th 스웨이드 라이더 자켓 우드 L"), null);
  assert.equal(
    ruleMatch("스투시 8볼 후드티 블랙")?.id,
    "clothing-stussy-8ball-hoodie",
  );
  assert.notEqual(
    ruleMatch("스투시 8볼 피그먼트 빅로고 후드집업")?.id,
    "clothing-stussy-zip-hoodie",
  );
  assert.notEqual(
    ruleMatch("스투시 스탁 서울 후드 애쉬헤더 후드티")?.id,
    "clothing-stussy-hoodie",
  );
  assert.equal(ruleMatch("아디다스 클롯 CLOT 폴로 니트 화이트 S 택있음"), null);
  assert.equal(ruleMatch("더 니트 컴퍼니 안테이 캐시미어 폴로 니트"), null);
  assert.equal(ruleMatch("인더로우 플레인 하프 니트 폴로 카본그레이"), null);
  assert.equal(ruleMatch("브룩스브라더스 네이비 니트 스웨터 폴로 랄프로렌"), null);
  assert.notEqual(ruleMatch("베이프 레이디스 우먼 크롭 반팔 링거티")?.id, "clothing-bape-tee");
  assert.notEqual(ruleMatch("베이프 스트로베리 티셔츠 XXS")?.id, "clothing-bape-tee");

  const bapeTee = skuById("clothing-bape-tee");
  const fogMain = skuById("clothing-fog-main-jacket");
  const alpha = skuById("clothing-alpha-mil-jacket");
  assert.ok(bapeTee);
  assert.ok(fogMain);
  assert.ok(alpha);
  assert.equal(evaluatePoolGate({ sku: bapeTee, category: bapeTee.category }).canEnterPool, false);
  assert.equal(evaluatePoolGate({ sku: fogMain, category: fogMain.category }).canEnterPool, false);
  assert.equal(evaluatePoolGate({ sku: alpha, category: alpha.category }).canEnterPool, false);
});

test("Stussy hoodie, zip hoodie, and crewneck use separate comparable lanes", () => {
  const crew = ruleMatch("스투시 크루넥 맨투맨 그린");
  assert.equal(crew?.id, "clothing-stussy-crewneck-sweat");
  assert.match(
    parseListingOptions({
      title: "스투시 크루넥 맨투맨 그린",
      description: "",
      skuId: crew?.id,
      skuName: crew?.modelName,
      category: crew?.category ?? null,
      defaultProductType: crew?.defaultProductType ?? null,
      bunjangConditionLabel: null,
    }).comparableKey ?? "",
    /^clothing\|stussy_crewneck_sweat\|crewneck\|/,
  );

  const zip = ruleMatch("스투시 후드집업 블랙 L");
  assert.equal(zip?.id, "clothing-stussy-zip-hoodie");
  assert.match(
    parseListingOptions({
      title: "스투시 후드집업 블랙 L",
      description: "",
      skuId: zip?.id,
      skuName: zip?.modelName,
      category: zip?.category ?? null,
      defaultProductType: zip?.defaultProductType ?? null,
      bunjangConditionLabel: null,
    }).comparableKey ?? "",
    /^clothing\|stussy_zip_hoodie\|hoodie_zip\|/,
  );

  assert.equal(
    ruleMatch("스투시 후드티 블랙 L")?.id,
    "clothing-stussy-hoodie",
  );
  assert.equal(ruleMatch("[S]스투시 반집업 맨투맨"), null);
  assert.equal(ruleMatch("스투시 8볼 맨투맨 xl"), null);
});

test("Stussy Nike Air Penny is ready as a narrow shoe lane while broad footwear stays blocked", () => {
  const airPenny = ruleMatch("Stussy X 나이키 에어페니2 페슬컬러");
  assert.equal(airPenny?.id, "shoe-stussy-nike-air-penny");
  assert.ok(airPenny);
  assert.equal(evaluatePoolGate({ sku: airPenny, category: airPenny.category }).canEnterPool, true);
});

test("Supreme Nike Air Max shoe lane rejects cap/accessory wording", () => {
  assert.equal(
    ruleMatch("[260] 나이키 X 슈프림 에어맥스 98 TL 화이트")?.id,
    "shoe-supreme-nike-airmax-collab",
  );
  assert.equal(
    ruleMatch("[OS] 슈프림 X 나이키 에어맥스 캠프캡, 모자 블랙.(#볼캡)"),
    null,
  );
  assert.equal(ruleMatch("슈프림 나이키 에어맥스 러닝캡"), null);
  assert.equal(ruleMatch("슈프림 나이키 에어맥스 캠프캡 스네이크 스킨"), null);
});

test("Wave 806 shoe broad lanes split explicit active model axes", () => {
  const cases: Array<[string, string, RegExp]> = [
    ["[270] 아식스 키코 젤키릴 아이스민트", "shoe-asics-kiko-gel-kiril", /^shoe\|kiko_gel_kiril\|sneaker\|/],
    ["[265] 아식스 키코 젤소켓2", "shoe-asics-kiko-gel-sokat", /^shoe\|kiko_gel_sokat\|sneaker\|/],
    ["아식스 UB3-젤 님버스9 운동화 255", "shoe-asics-gel-nimbus-9", /^shoe\|gel_nimbus_9\|sneaker\|/],
    ["아식스 젤 퀀텀 360 여자230", "shoe-asics-gel-quantum-360", /^shoe\|gel_quantum_360\|sneaker\|/],
    ["아식스 젤 퀀텀 키네틱 SP 블랙 275", "shoe-asics-gel-kinetic-sp", /^shoe\|gel_kinetic_sp\|sneaker\|/],
    ["푸마 디비에이트 나이트로3 런닝화 270", "shoe-puma-deviate-nitro", /^shoe\|deviate_nitro\|sneaker\|/],
    ["푸마 디비에이트 나이트로 엘리트 3 런닝화", "shoe-puma-deviate-nitro-elite", /^shoe\|deviate_nitro_elite\|sneaker\|/],
    ["미즈노 웨이브 프로페시 MOC 블랙 265 팝니다", "shoe-mizuno-wave-prophecy-moc", /^shoe\|wave_prophecy_moc\|sneaker\|/],
    ["미즈노 웨이브 프로페시 베타 화이트", "shoe-mizuno-wave-prophecy-beta", /^shoe\|wave_prophecy_beta\|sneaker\|/],
    ["컨버스 X 칼하트 WIP 원스타 아카데미 프로 275", "shoe-carhartt-converse-one-star", /^shoe\|carhartt_converse_one_star\|sneaker\|/],
  ];

  for (const [title, skuId, keyPattern] of cases) {
    const sku = ruleMatch(title);
    assert.equal(sku?.id, skuId);
    assert.ok(sku);
    assert.equal(evaluatePoolGate({ sku, category: sku.category }).canEnterPool, true);
    assert.match(
      parseListingOptions({
        title,
        description: "",
        skuId: sku.id,
        skuName: sku.modelName,
        category: sku.category,
        defaultProductType: sku.defaultProductType ?? null,
        bunjangConditionLabel: null,
      }).comparableKey ?? "",
      keyPattern,
    );
  }
});

test("Wave 874 Asics Cecilie Bahnsen stays collab even with Gel Quantum model text", () => {
  const cecilieQuantum = ruleMatch("아식스 x 세실리에 반센 젤 퀀텀 360 I 사쿠라가이");
  assert.equal(cecilieQuantum?.id, "shoe-asics-cecilie-bahnsen-collab");
  assert.equal(evaluatePoolGate({ sku: cecilieQuantum, category: cecilieQuantum?.category ?? null }).canEnterPool, true);
  assert.equal(
    ruleMatch("아식스 젤 퀀텀 360 여자230")?.id,
    "shoe-asics-gel-quantum-360",
  );
});

test("Wave 875 shoe audit keeps exchange-block notices and NB ALD routing precise", () => {
  const jordan = ruleMatch(
    "[260] 조던 1 로우 옵시디언",
    "교신 , 사이즈 문의시 답장 없이 차단합니다\n나이키 공홈에서 주문한 나코탭 새상품 입니다",
  );
  assert.equal(jordan?.id, "shoe-nike-airjordan-1-low");

  const lacoste = ruleMatch(
    "라코스테 카나비 270",
    "미시착 새제품입니다\n교환 환불 교신 ×",
  );
  assert.equal(lacoste?.id, "shoe-lacoste-sneakers");

  const cdgConverse = ruleMatch(
    "꼼데가르송 x 컨버스 척 70 로우 240",
    "-네고, 택포, 교신, 착샷 문의\n미리 사양합니다",
  );
  assert.equal(cdgConverse?.id, "shoe-converse-chuck70-cdg-play-white");

  assert.equal(
    ruleMatch("조던 1 로우 교환합니다"),
    null,
  );
  assert.equal(
    ruleMatch("뉴발란스 990v4 에임레온도르 트루 카모 베이지 260")?.id,
    "shoe-newbalance-aime-leon-dore-collab",
  );
  assert.equal(
    ruleMatch("뉴발란스 990v4 그레이 260")?.id,
    "shoe-newbalance-990v4",
  );
});

test("Wave 876 Nike Sacai exact model lanes beat old broad fallback", () => {
  assert.equal(
    ruleMatch("나이키 사카이 블레이저 로우 마그마 오렌지")?.id,
    "shoe-nike-sakai-blazer-low",
  );
  assert.equal(
    ruleMatch("나이키 사카이 블레이져 로우 그린")?.id,
    "shoe-nike-sakai-blazer-low",
  );
  assert.equal(
    ruleMatch("나이키 사카이 LD Waffle 화이트 270")?.id,
    "shoe-nike-sakai-ldwaffle",
  );
  assert.equal(
    ruleMatch("나이키 사카이 베이퍼와플 270")?.id,
    "shoe-nike-sakai-vaporwaffle",
  );
  assert.equal(
    ruleMatch("나이키x사카이 줌 코르테즈 SP 아이언 그레이 270 mm")?.id,
    "shoe-nike-sakai-cortez",
  );
  assert.equal(
    ruleMatch("나이키 사카이 와플")?.id,
    "shoe-nike-sakai-collab",
  );
  assert.equal(
    ruleMatch("아식스 슈퍼블라스트2 블루 페이드 265")?.id,
    "shoe-asics-superblast",
  );
  assert.equal(
    ruleMatch("아식스 노바블라스트5 245")?.id,
    "shoe-asics-novablast",
  );
  assert.equal(
    ruleMatch("라코스테 CANABY PIQUE 카나비 피케 스니커즈 그린 UK7사이즈")?.id,
    "shoe-lacoste-sneakers",
  );
});

test("Wave 806 broad shoe families are held when the model axis is ambiguous", () => {
  for (const skuId of [
    "shoe-asics-kiko-collab",
    "shoe-asics-gel-quantum",
    "shoe-puma-nitro-running",
    "shoe-mizuno-wave-prophecy",
    "shoe-carhartt-converse-collab",
  ]) {
    const sku = skuById(skuId);
    assert.ok(sku);
    assert.equal(evaluatePoolGate({ sku, category: sku.category }).canEnterPool, false);
  }
});

test("New Balance collab shoe lanes reject accessory and other-collab keyword pollution", () => {
  assert.equal(
    ruleMatch("[270] 뉴발란스x조프레쉬굿즈 990v4 #자운드에임레온도르992993"),
    null,
  );
  assert.equal(
    ruleMatch("뉴발란스 오라리 러닝캡 모자"),
    null,
  );
  assert.equal(
    ruleMatch("뉴발란스 살레헤 벰버리 캡"),
    null,
  );
  assert.equal(
    ruleMatch("뉴발란스 오라리 1906R 275 새상품")?.id,
    "shoe-newbalance-auralee-collab",
  );
  assert.equal(
    ruleMatch("뉴발란스 자운드 990v4 270")?.id,
    "shoe-newbalance-jjjjound-collab",
  );
  assert.equal(
    ruleMatch("[270 새상품급] 뉴발란스x에임레온도르991 그레이 #자운드992993")?.id,
    "shoe-newbalance-aime-leon-dore-collab",
  );
});

test("Wave 818 broad shoe watch buckets reject newly observed sample pollutants", () => {
  assert.equal(ruleMatch("뉴발란스327 나이키 데이브레이크 운동화"), null);
  assert.equal(ruleMatch("뉴발란스 327 staud 한정판 콜라보 280"), null);
  assert.equal(ruleMatch("뉴발란스 327 미스터 사보타지 sabotage 285"), null);
  assert.equal(ruleMatch("미착용 새제품 정품 뉴발란스 327 편한 운동화 남아여아 공용 220"), null);
  assert.equal(
    ruleMatch("뉴발란스 327 문빔 베이지화이트")?.id,
    "shoe-newbalance-327-broad",
  );

  assert.equal(ruleMatch("컨버스 x 코카콜라 척 70 하이 레더 레이싱 레드"), null);
  assert.equal(ruleMatch("컨버스 x 키아라 페라그니 척70 하이 스니커즈"), null);
  assert.equal(ruleMatch("컨버스 x 피어 오브 갓 에센셜 척 70 하이 내츄럴"), null);
  assert.equal(ruleMatch("컨버스 슬램잼 척 70 하이 리컨스트럭티드 295"), null);
  assert.equal(ruleMatch("컨버스 척 70 AT-CX 하이 운동화 블랙"), null);
  assert.equal(
    ruleMatch("컨버스 척테일러 70 하이 블랙 240mm")?.id,
    "shoe-converse-chuck70-high-broad",
  );
  assert.equal(
    ruleMatch("컨버스 척 70 클래식 블랙 하이")?.id,
    "shoe-converse-chuck70-high-broad",
  );
  const chuckPlus = ruleMatch("[290] CONVERSE 컨버스 척 70 플러스 하이 검흰");
  assert.equal(chuckPlus?.id, "shoe-converse-chuck70-plus-high");
  assert.equal(evaluatePoolGate({ sku: chuckPlus, category: chuckPlus?.category ?? null }).canEnterPool, false);
});

test("Wave 853 Converse 70s and Vans Cap LX route without polluting public broad", () => {
  const ambiguousChuck70 = ruleMatch("컨버스 척테일러70 230mm");
  assert.equal(ambiguousChuck70?.id, "shoe-converse-chuck70-ambiguous");
  assert.equal(evaluatePoolGate({ sku: ambiguousChuck70, category: ambiguousChuck70?.category ?? null }).canEnterPool, false);

  assert.equal(
    ruleMatch("컨버스 척테일러 70s 블랙 하이 280(남성용)")?.id,
    "shoe-converse-chuck70-high-broad",
  );
  assert.equal(
    ruleMatch("컨버스 척테일러 70 하이 옐로우 새상품(235)")?.id,
    "shoe-converse-chuck70-high-broad",
  );
  assert.equal(
    ruleMatch("컨버스 척 테일러 올스타 70S OX 레더 폴카도트 아이보리")?.id,
    "shoe-converse-chuck70-low-broad",
  );
  assert.equal(
    ruleMatch("컨버스 척 테일러 1970s OX로우 레오파드 스니커즈 245")?.id,
    "shoe-converse-chuck70-low-broad",
  );

  const vansCapLx = ruleMatch("[265] 반스 볼트 스케이트 하이 캡 LX");
  assert.equal(vansCapLx?.id, "shoe-vans-vault-broad");
  assert.equal(evaluatePoolGate({ sku: vansCapLx, category: vansCapLx?.category ?? null }).canEnterPool, false);
  assert.equal(ruleMatch("반스 볼트 cap 모자"), null);
});

test("Ader Error Converse shoe lane rejects cap accessories", () => {
  assert.equal(ruleMatch("아더에러 X 컨버스 볼캡"), null);
  assert.equal(
    ruleMatch("컨버스 x 아더에러 화이트 스니커즈")?.id,
    "shoe-adererror-converse-collab",
  );
  assert.equal(
    ruleMatch("컨버스 아더에러 척70 (275)")?.id,
    "shoe-adererror-converse-collab",
  );
});

test("Wave 878 Converse and Supreme exact collab lanes beat generic broad", () => {
  assert.equal(
    ruleMatch("펑첸왕 척 70 컨버스 투인원 그레이")?.id,
    "shoe-fengchenwang-converse-collab",
  );
  assert.equal(
    ruleMatch("컨버스x펑첸왕 척70 아이보리 270판매")?.id,
    "shoe-fengchenwang-converse-collab",
  );
  assert.equal(
    ruleMatch("나이키 x 슈프림 SB 덩크 로우 하이퍼 블루 275")?.id,
    "shoe-nike-dunk-low-supreme",
  );
});

test("Wave 819 Nike Mercurial exact boot axes split from broad", () => {
  const cases: Array<[string, string]> = [
    ["나이키 머큐리얼 베이퍼16 엘리트 ag", "shoe-nike-mercurial-vapor-16-elite-ag"],
    ["나이키 머큐리얼 베이퍼16 엘리트 fg 260", "shoe-nike-mercurial-vapor-16-elite-fg"],
    ["나이키 에어 줌 머큐리얼 베이퍼 XVI 엘리트 TF", "shoe-nike-mercurial-vapor-16-elite-tf"],
    ["나이키 머큐리얼 베이퍼 16 프로 TF 오션 큐브 핑크 블라스트", "shoe-nike-mercurial-vapor-16-pro-tf"],
    ["나이키 줌 머큐리얼 베이퍼 15 프로 TF 핑크 폼 블랙", "shoe-nike-mercurial-vapor-15-pro-tf"],
    ["(250) 나이키 머큐리얼 베이퍼15 프로tf", "shoe-nike-mercurial-vapor-15-pro-tf"],
    ["나이키 머큐리얼 베이퍼14 엘리트 AG", "shoe-nike-mercurial-vapor-14-elite-ag"],
    ["나이키 머큐리얼 베이퍼14 프로 풋살화 290mm", "shoe-nike-mercurial-vapor-14-pro-tf"],
  ];
  for (const [title, expectedId] of cases) {
    const sku = ruleMatch(title);
    assert.equal(sku?.id, expectedId, title);
    assert.equal(evaluatePoolGate({ sku, category: sku?.category ?? null }).canEnterPool, true, title);
  }

  assert.notEqual(
    ruleMatch("나이키 수퍼플라이 머큐리얼 트리플화이트 260")?.id,
    "shoe-nike-mercurial-broad",
  );
  assert.equal(
    ruleMatch("나이키머큐리얼베이퍼16엘리트&나이키 CTR360 마에스트리 2"),
    null,
  );
  assert.equal(ruleMatch("나이키 x PATTA 줌 머큐리얼 베이퍼 16 엘리트 SE FG 270mm"), null);
});

test("Air Max Plus broad rejects golf-shoe variants", () => {
  assert.equal(ruleMatch("여성 골프화- 나이키 에어맥스 플러스 TN 블랙 메탈릭 실버 오렌지 235mm"), null);
  assert.equal(
    ruleMatch("나이키 에어맥스 플러스 트리플 블랙 250")?.id,
    "shoe-nike-airmax-plus-tn-broad",
  );
});

test("Mizuno JPX and MX golf club lanes stay in sport_golf, not shoe", () => {
  for (const [title, expectedId] of [
    ["미즈노 JPX E3 포지드 아이언세트 5~P SR", "club-mizuno-jpx"],
    ["미즈노 MX 25 아이언세트 NS PRO", "club-mizuno-mx"],
  ] as const) {
    const sku = ruleMatch(title);
    assert.equal(sku?.id, expectedId, title);
    assert.equal(sku?.category, "sport_golf", title);

    const parsed = parseListingOptions({
      title,
      description: "샤프트는 ns pro 950 PM SR입니다. 헤드상태 양호합니다.",
      skuId: sku?.id ?? "",
      skuName: sku?.modelName ?? "",
      category: sku?.category ?? null,
      defaultProductType: sku?.defaultProductType ?? null,
      bunjangConditionLabel: null,
    });
    assert.match(parsed.comparableKey ?? "", /^sport_golf\|/);
    assert.doesNotMatch(parsed.comparableKey ?? "", /^shoe\|/);
  }
});

test("Wave 856 Superfly and UGG product axes stay separated", () => {
  const airSuperfly = ruleMatch("(W) 나이키 에어 슈퍼플라이 오일 그린 블랙 250");
  assert.equal(airSuperfly?.id, "shoe-nike-air-superfly");
  assert.equal(evaluatePoolGate({ sku: airSuperfly, category: airSuperfly?.category ?? null }).canEnterPool, false);
  assert.match(
    parseListingOptions({
      title: "(W) 나이키 에어 슈퍼플라이 오일 그린 블랙 250",
      description: "",
      skuId: airSuperfly?.id ?? "",
      skuName: airSuperfly?.modelName ?? "",
      category: airSuperfly?.category ?? "shoe",
      defaultProductType: airSuperfly?.defaultProductType ?? null,
      bunjangConditionLabel: null,
    }).comparableKey ?? "",
    /^shoe\|air_superfly\|sneaker\|/,
  );

  const mercurialSuperfly = ruleMatch("(새상품) 나이키 슈퍼플라이6 엘리트 FG [250] 축구화");
  assert.equal(mercurialSuperfly?.id, "shoe-nike-superfly-broad");
  assert.equal(evaluatePoolGate({ sku: mercurialSuperfly, category: mercurialSuperfly?.category ?? null }).canEnterPool, false);
  assert.match(
    parseListingOptions({
      title: "(새상품) 나이키 슈퍼플라이6 엘리트 FG [250] 축구화",
      description: "",
      skuId: mercurialSuperfly?.id ?? "",
      skuName: mercurialSuperfly?.modelName ?? "",
      category: mercurialSuperfly?.category ?? "shoe",
      defaultProductType: mercurialSuperfly?.defaultProductType ?? null,
      bunjangConditionLabel: null,
    }).comparableKey ?? "",
    /^shoe\|nike_superfly_broad\|football_fg\|/,
  );

  const uggClassic = ruleMatch("어그 클래식 부츠 체스트넛");
  assert.equal(uggClassic?.id, "shoe-ugg-classic-broad");
  assert.match(
    parseListingOptions({
      title: "어그 클래식 부츠 체스트넛",
      description: "",
      skuId: uggClassic?.id ?? "",
      skuName: uggClassic?.modelName ?? "",
      category: uggClassic?.category ?? "shoe",
      defaultProductType: uggClassic?.defaultProductType ?? null,
      bunjangConditionLabel: null,
    }).comparableKey ?? "",
    /^shoe\|ugg_classic_broad\|boot\|/,
  );
});

test("Wave 856 mid shoe broad pollutants do not stay in plain broad samples", () => {
  const fragmentSpiridon = ruleMatch("나이키 프라그먼트 에어 줌 스피리돈");
  assert.equal(fragmentSpiridon?.id, "shoe-nike-fragment-spiridon-collab");
  assert.equal(evaluatePoolGate({ sku: fragmentSpiridon, category: fragmentSpiridon?.category ?? null }).canEnterPool, false);
  assert.equal(ruleMatch("나이키 샥스z 메탈릭실버 225-280"), null);
  assert.equal(ruleMatch("아디다스 x 케이스스터디 스탠스미스 로우 프로 230"), null);
  assert.equal(ruleMatch("[250] 아디다스 스탠스미스 피터팬&팅커벨 실버"), null);

  const mexico66 = ruleMatch("오니츠카타이거 66 240");
  assert.equal(mexico66?.id, "shoe-onitsuka-mexico-66");
  assert.equal(evaluatePoolGate({ sku: mexico66, category: mexico66?.category ?? null }).canEnterPool, true);

  const olympus66 = ruleMatch("오니츠카타이거 올림푸스66 실버 255");
  assert.equal(olympus66?.id, "shoe-onitsuka-broad");
  assert.equal(evaluatePoolGate({ sku: olympus66, category: olympus66?.category ?? null }).canEnterPool, false);
});

test("Wave 857 lower-mid shoe broad routes cross-category and variant rows safely", () => {
  assert.equal(
    ruleMatch("아디다스 송포더뮤트 자켓 L")?.id,
    "clothing-adidas-sftm-collab",
  );
  assert.equal(
    ruleMatch("아디다스 송포더뮤트 컨트리 275")?.id,
    "shoe-adidas-song-for-the-mute-broad",
  );
  assert.equal(
    ruleMatch("Adidas x Song for the Mute Adistar 260mm")?.id,
    "shoe-adidas-song-for-the-mute-broad",
  );
  assert.equal(ruleMatch("아디다스 송포더뮤트 태권도화 블랙 새상품 (275)")?.id, "shoe-adidas-song-for-the-mute-broad");

  const drBlack = ruleMatch("닥터마틴 1460 블랙 uk9");
  assert.equal(drBlack?.id, "shoe-drmartens-1460-black");
  assert.equal(evaluatePoolGate({ sku: drBlack, category: drBlack?.category ?? null }).canEnterPool, true);
  assert.equal(ruleMatch("닥터마틴 1460 모노 블랙 워커 UK4")?.id, "shoe-drmartens-1460-mono");
  assert.notEqual(ruleMatch("닥터마틴 1460 파스칼 앰배서더 블랙 6홀")?.id, "shoe-drmartens-1460-black");

  assert.equal(ruleMatch("살로몬 X 빔즈 RX Slide 3.0 280"), null);
  assert.equal(ruleMatch("살로몬 브로큰암 rx 슬라이드 3.0 친칠라 블루"), null);
  assert.equal(ruleMatch("살로몬 Rx 슬라이드 LTR 가죽 코르크 슬라이더"), null);
  assert.equal(ruleMatch("살로몬 rx slide moc 글레이셔 그레이 280"), null);
  assert.equal(ruleMatch("살로몬 RX 슬라이드 3.0 블랙 285")?.id, "shoe-salomon-rx-slide-3");

  assert.equal(ruleMatch("아디다스 삼바로즈 화이트 핑크 스니커즈 운동화 신발 240"), null);
  assert.equal(ruleMatch("아디다스 삼바 비건 225"), null);
  assert.equal(ruleMatch("롯데본점-UGG 첼시 레인부츠(250)"), null);
  assert.notEqual(ruleMatch("뉴발란스 442 블랙 270 미우미우")?.id, "shoe-newbalance-generic-broad");
  assert.equal(ruleMatch("뉴발란스 ML610TBF 회색 270 트레일 러닝화")?.id, "shoe-newbalance-610-broad");
  assert.equal(ruleMatch("뉴발란스 ML610TBG 운동화 270mm")?.id, "shoe-newbalance-610-broad");
  assert.equal(ruleMatch("뉴발란스 ML610T 핑크 문 스니커즈")?.id, "shoe-newbalance-610-broad");
  assert.equal(ruleMatch("뉴발란스 ML 725Q 네이비 270 상태 굿")?.id, "shoe-newbalance-725-broad");
  assert.equal(ruleMatch("[270] 뉴발란스 프레쉬폼X 1080v13 블랙화이트")?.id, "shoe-newbalance-1080-broad");
  assert.equal(ruleMatch("(270)뉴발란스 도쿄디자인스튜디오 MT10TDS")?.id, "shoe-newbalance-tds-collab");
  assert.equal(ruleMatch("뉴발란스 703 화이트 운동화")?.id, "shoe-newbalance-generic-broad");
});

test("Wave 820 Adidas Superstar broad rejects non-comparable sample pollutants", () => {
  assert.equal(ruleMatch("아디다스 슈퍼스타 연핑크 볼캡 야구 모자 F"), null);
  assert.equal(ruleMatch("[250] 아디다스 슈퍼스타 골프화"), null);
  assert.equal(ruleMatch("280-285 아디다스 휴먼메이드 슈퍼스타 블랙"), null);
  assert.equal(ruleMatch("[260] 아디다스 x 윌리 차바리아 슈퍼스타 코어 블랙"), null);
  assert.equal(ruleMatch("아디다스X비욘세 슈퍼스타 플랫폼 스니커즈"), null);
  assert.equal(ruleMatch("ADIDAS X DISNEY 슈퍼스타 디즈니 아디다스"), null);
  assert.equal(ruleMatch("아디다스x캐롤라인 슈퍼스타 240"), null);
  assert.equal(ruleMatch("뉴발란스 574 레거시 신발 2개 화이트, 그레이 차정원 뉴발란스 새상품"), null);
  const pufflet = ruleMatch("아디다스 퍼피렛 슈퍼스타 클라우드 화이트 (250)");
  assert.equal(pufflet?.id, "shoe-adidas-superstar-pufflet");
  assert.equal(evaluatePoolGate({ sku: pufflet, category: pufflet?.category ?? null }).canEnterPool, false);
  assert.equal(
    ruleMatch("아디다스 슈퍼스타 화이트 블랙 280mm")?.id,
    "shoe-adidas-superstar-broad",
  );
});

test("Wave 858 New Balance 574 broad rejects collab rows while plain 574 stays matched", () => {
  assert.equal(ruleMatch("미우미우 뉴발란스 574빈티지 스니커즈 37사이즈"), null);
  assert.equal(ruleMatch("뉴발란스 New balance x 스트레이 랫츠 574 블랙 280"), null);
  assert.equal(ruleMatch("뉴발란스 574 레거시 아이보리 285")?.id, "shoe-newbalance-574-broad");
});

test("Wave 859 New Balance 530 broad rejects Yeseyesee collab rows", () => {
  assert.equal(ruleMatch("예스아이씨 x 뉴발란스 530 실버 265 MR530SMY"), null);
  assert.equal(ruleMatch("뉴발란스 530 x 예스아이씨 한정판 실버 로얄 블루 265 새제품급"), null);
  assert.equal(ruleMatch("뉴발란스 530 스틸그레이 240사이즈 새상품")?.id, "shoe-newbalance-530-broad");
});

test("Wave 860 New Balance vintage exact broad lanes beat generic fallback", () => {
  assert.equal(ruleMatch("뉴발란스 1500 딥그린 280 판매합니다")?.id, "shoe-newbalance-1500-broad");
  assert.equal(ruleMatch("New Balance 1500 Made in UK 35th Anniversary")?.id, "shoe-newbalance-1500-broad");
  assert.equal(ruleMatch("뉴발란스 U1500WHG Made in England")?.id, "shoe-newbalance-1500-broad");
  assert.equal(ruleMatch("뉴발란스 1400 오렌지 280")?.id, "shoe-newbalance-1400-broad");
  assert.equal(ruleMatch("뉴발란스 M1400CSE Made in USA")?.id, "shoe-newbalance-1400-broad");
  assert.equal(ruleMatch("Made in USA 뉴발란스 1400JP 베이지 270")?.id, "shoe-newbalance-1400-broad");
  const nb990v6 = ruleMatch("뉴발란스 990v6 265mm");
  assert.equal(nb990v6?.id, "shoe-newbalance-990v6");
  assert.equal(evaluatePoolGate({ sku: nb990v6, category: nb990v6?.category ?? null }).canEnterPool, true);
  assert.equal(ruleMatch("뉴발란스 x action bronson 990v6"), null);
});

test("Wave 861 Adidas Gazelle duplicate broad resolves to the ready lane", () => {
  assert.equal(ruleMatch("아디다스 가젤 블랙")?.id, "shoe-adidas-gazelle-broad");
  assert.equal(ruleMatch("새제품 아디다스 240 가젤 OG 그린 스니커즈 운동화 신발")?.id, "shoe-adidas-gazelle-broad");
  assert.equal(ruleMatch("아디다스 가젤x팜 콜라보 브라질월드컵 한정판 스니커즈"), null);
});

test("Wave 863 exact small shoe lanes restore normal rows while blocking variants", () => {
  const chuckWhite = ruleMatch("컨버스 척 70 클래식 화이트 235");
  assert.equal(chuckWhite?.id, "shoe-converse-chuck70-white");
  assert.equal(evaluatePoolGate({ sku: chuckWhite, category: chuckWhite?.category ?? null }).canEnterPool, true);

  assert.equal(ruleMatch("컨버스 화이트 척 70 ATCX 스니커즈 280"), null);
  assert.equal(ruleMatch("컨버스 척70 스케치화이트 스니커즈 270"), null);
  assert.equal(ruleMatch("컨버스 x 이자벨 마랑 척 70 로우 바닐라 화이트 235"), null);
  assert.equal(ruleMatch("새상품 컨버스 척 70 로우 화이트팩 컬러체인지 225사이즈"), null);

  const bondi7 = ruleMatch("호카 본디 7 1110531-BBLC");
  assert.equal(bondi7?.id, "shoe-hoka-bondi-7");
  assert.equal(evaluatePoolGate({ sku: bondi7, category: bondi7?.category ?? null }).canEnterPool, true);

  assert.equal(ruleMatch("아식스 x 아트모스 x 오호스 젤 1130 RE 글레이셔"), null);
});

test("Wave 864 Asics GT-2160 rejects premium collab axes", () => {
  const normal = ruleMatch("아식스 GT 2160 크림 퓨어실버 265");
  assert.equal(normal?.id, "shoe-asics-gt-2160");
  assert.equal(evaluatePoolGate({ sku: normal, category: normal?.category ?? null }).canEnterPool, true);

  const dime = ruleMatch("아식스 x 다임 GT 2160 한정판");
  assert.equal(dime?.id, "shoe-asics-gt2160-dime-collab");
  assert.equal(evaluatePoolGate({ sku: dime, category: dime?.category ?? null }).canEnterPool, false);
  const above = ruleMatch("아식스 GT-2160 어보브더클라우즈 크림/그린");
  assert.equal(above?.id, "shoe-asics-gt2160-above-clouds-collab");
  assert.equal(evaluatePoolGate({ sku: above, category: above?.category ?? null }).canEnterPool, false);
  const emmi = ruleMatch("emmi 콜라보 아식스 gt 2160 브리즈 크림");
  assert.equal(emmi?.id, "shoe-asics-gt2160-emmi-collab");
  assert.equal(evaluatePoolGate({ sku: emmi, category: emmi?.category ?? null }).canEnterPool, false);
  assert.equal(ruleMatch("아식스 x 우드우드 GT-2160 크림 오트밀"), null);
  assert.equal(ruleMatch("아식스 x 갤러리디파트먼트 GT-2160"), null);
});

test("Shoe luxury model names with accessory-like words keep exact internal lanes", () => {
  const prada = ruleMatch("PRADA 아메리카 컵 스니커즈");
  assert.equal(prada?.id, "shoe-prada-america-cup");
  assert.equal(evaluatePoolGate({ sku: prada, category: prada?.category ?? null }).canEnterPool, false);

  const oran = ruleMatch("에르메스 오란 샌들 카프스킨 & 골드 피케르 에크루즈 37.5W 245");
  assert.equal(oran?.id, "shoe-hermes-oran-sandal");
  assert.equal(evaluatePoolGate({ sku: oran, category: oran?.category ?? null }).canEnterPool, false);

  const gucciFullBox = ruleMatch("구찌 스니커즈(구찌 풀박세트, 정품)");
  assert.equal(gucciFullBox?.id, "shoe-gucci-broad");
});

test("Wave 821 Nike Dunk Low broad rejects non-general axes and promotes ready exact ids", () => {
  assert.equal(ruleMatch("나이키골프 덩크 로우 시큐리스 골프화 230mm"), null);
  assert.equal(ruleMatch("[275] 나이키 우먼스 덩크 로우 트위스트 블랙 앤 화이트"), null);
  assert.equal(ruleMatch("나이키 SB X 파워퍼프걸스/넥페이스 덩크로우 프로"), null);
  assert.equal(ruleMatch("나이키 쿼터스낵스 SB덩크 로우 지브라 케이크 260"), null);
  assert.equal(ruleMatch("도언베커 프리스타일 x 조이 나이키 덩크로우 250"), null);
  assert.equal(ruleMatch("[새상품] (W) 나이키 x 해리스 트위드 덩크 로우 블랙 앤 팬텀") , null);
  assert.equal(ruleMatch("나이키 덩크 로우 고어텍스 블랙"), null);
  assert.equal(ruleMatch("[새상품/정품]나이키 x NBA 덩크 로우 레트로"), null);
  assert.equal(ruleMatch("나이키 덩크로우 바나나 w250 m245"), null);
  assert.equal(ruleMatch("나이키 덩크로우 독일 공험 컬러 커스터마이징 했어요 시카고 컬러"), null);
  assert.equal(ruleMatch("나이키 덩크로우 트리플화이트 운동화 270 원래 올화이트인데 리폼했어요"), null);
  assert.notEqual(
    ruleMatch("나이키 덩크로우 레이서 블루 유니버시티 레드")?.id,
    "shoe-nike-dunk-low-university-blue",
  );

  assert.equal(
    ruleMatch("나이키 덩크 로우 골든로드 270")?.id,
    "shoe-nike-dunk-low-golden-road",
  );
  assert.equal(
    ruleMatch("나이키 덩크 로우 그레이 포그 240")?.id,
    "shoe-nike-dunk-low-grey-fog",
  );
  assert.equal(
    ruleMatch("나이키 덩크 로우 트리플 화이트 270")?.id,
    "shoe-nike-dunk-low-summit-white",
  );
  assert.equal(
    ruleMatch("나이키 스캇 덩크로우")?.id,
    "shoe-nike-dunk-low-travis-scott",
  );
});

test("Travis SB Dunk and CDG Nike broad lanes stay out of polluted public samples", () => {
  assert.equal(
    ruleMatch("[275] 베이프스타 Apestation by Indigo Studio"),
    null,
  );
  assert.equal(
    ruleMatch("W275 나이키 덩크로우 골든 갤스 메탈릭 실버 시카고 트래비스 스캇"),
    null,
  );
  assert.equal(
    ruleMatch("[275] 나이키 x 트래비스 스캇 SB 덩크 로우 Nike Scott")?.id,
    "shoe-nike-dunk-low-travis-scott",
  );
  const cdgNike = ruleMatch("나이키 꼼데가르송 새상품 운동화 280");
  assert.equal(cdgNike?.id, "shoe-cdg-nike-collab");
  assert.equal(evaluatePoolGate({ sku: cdgNike, category: cdgNike?.category ?? null }).canEnterPool, false);
});

test("Wave 822 Gucci Rhyton remains recognizable but internal-only until variant split", () => {
  const rhyton = ruleMatch("구찌 라이톤 입술더티 스니커즈 7");
  assert.equal(rhyton?.id, "shoe-gucci-rhyton");
  assert.equal(evaluatePoolGate({ sku: rhyton, category: rhyton?.category ?? null }).canEnterPool, false);
  assert.notEqual(ruleMatch("구찌 100주년 한정판 라이톤 스니커즈")?.id, "shoe-gucci-rhyton");
});

test("Wave 823 BAPE STA rejects goods/accessories and stays internal-only until split", () => {
  assert.equal(ruleMatch("베이프 베이비마일로 베이프스타 피규어"), null);
  assert.equal(ruleMatch("베이프 스타벅스 목베개 목쿠션 bape"), null);
  assert.equal(ruleMatch("베이프 스타벅스 코스터"), null);
  assert.equal(ruleMatch("마일로 코스터 스벅 베이프 스타벅스"), null);
  assert.equal(ruleMatch("베이프스타 정품 머리핀 핑크 헤어핀"), null);
  assert.equal(ruleMatch("베이프스타 컨버스 카모로고 260"), null);
  assert.equal(ruleMatch("베이프스타 주스월드 커스텀 265"), null);

  const bapeSta = ruleMatch("BAPE Bapesta 그린 카모 270");
  assert.equal(bapeSta?.id, "shoe-bape-sta");
  assert.equal(evaluatePoolGate({ sku: bapeSta, category: bapeSta?.category ?? null }).canEnterPool, false);
});

test("Wave 824 Yeezy 350 broad rejects order-style rows and stays internal-only", () => {
  assert.equal(
    ruleMatch("Yeezy 350 Boost V2블랙 스니커즈 오리지널 주문가능사이즈 220"),
    null,
  );
  assert.equal(
    ruleMatch("[아디다스 오리지널스] 이지 부스트 350 V2 블랙", "주문방법 [구매하기]→[요청사항]에[색상/사이즈]기재"),
    null,
  );

  assert.equal(ruleMatch("아디다스 이지부스트 350 V2 크림화이트 265"), null);
  assert.equal(ruleMatch("아디다스 이지부스트 350 V2 오닉스 255"), null);
});

test("Wave 825 Vans Style 36 rejects mule silhouette while plain lane stays ready", () => {
  assert.equal(ruleMatch("정품 반스 style 36 gum green 270")?.id, "shoe-vans-style-36");
  assert.equal(ruleMatch("5월31일 까지 특가 정품 반스 스타일36 뮬 270"), null);
  assert.notEqual(ruleMatch("반스 볼트 OG 스타일36 올드 골드")?.id, "shoe-vans-style-36");
  const style36 = ruleMatch("반스 스타일36 흰빨 레드 새상품");
  assert.equal(evaluatePoolGate({ sku: style36, category: style36?.category ?? null }).canEnterPool, true);
});

test("CDG Nike broad stays blocked while exact model lanes can release", () => {
  const cases: Array<[string, string]> = [
    ["나이키 X 꼼데가르송 우먼스 덩크 로우 블랙", "shoe-cdg-nike-dunk-low-collab"],
    ["나이키 x 꼼데가르송 터미네이터 하이 270", "shoe-cdg-nike-terminator-high-collab"],
    ["[새상품] 나이키 꼼데가르송 페가수스 275", "shoe-cdg-nike-pegasus-collab"],
    ["꼼데가르송 나이키 프레스토 텐트 신발", "shoe-cdg-nike-presto-tent-collab"],
    ["나이키 꼼데가르송 테니스 클래식 270판매", "shoe-cdg-nike-tennis-classic-collab"],
    ["나이키 꼼데가르송 센스 96 새상품 285", "shoe-cdg-nike-sense96-collab"],
    ["[260] 꼼데가르송 나이키 폼포짓 블랙", "shoe-cdg-nike-foamposite-collab"],
    ["나이키 꼼데가르송 블랙 / 에어 줌 탈라리아 SP / 275", "shoe-cdg-nike-talaria-collab"],
    ["[235] 나이키 꼼데가르송 힐 프리미어 white", "shoe-cdg-nike-heel-premier-collab"],
  ];
  for (const [title, expectedId] of cases) {
    const sku = ruleMatch(title);
    assert.equal(sku?.id, expectedId, title);
    assert.equal(evaluatePoolGate({ sku, category: sku?.category ?? null }).canEnterPool, true, title);
  }
  const broad = ruleMatch("나이키 cdg");
  assert.equal(broad?.id, "shoe-cdg-nike-collab");
  assert.equal(evaluatePoolGate({ sku: broad, category: broad?.category ?? null }).canEnterPool, false);
});

test("Wave 816 clothing sample spread pollutants do not enter narrow ready lanes", () => {
  const poloCap = ruleMatch("폴로 랄프 로렌 코튼 치노 베이스 볼 캡 [블랙]");
  assert.notEqual(poloCap?.id, "clothing-polo-pants-chino");
  if (poloCap) assert.equal(evaluatePoolGate({ sku: poloCap, category: poloCap.category }).canEnterPool, false);
  const poloJacket = ruleMatch("폴로 트월 치노자켓");
  assert.notEqual(poloJacket?.id, "clothing-polo-pants-chino");
  if (poloJacket) assert.equal(evaluatePoolGate({ sku: poloJacket, category: poloJacket.category }).canEnterPool, false);
  const poloChinoShirt = ruleMatch("폴로 랄프로렌 치노 밀리터리 셔츠");
  assert.notEqual(poloChinoShirt?.id, "clothing-polo-pants-chino");
  if (poloChinoShirt) assert.equal(evaluatePoolGate({ sku: poloChinoShirt, category: poloChinoShirt.category }).canEnterPool, false);
  assert.equal(
    ruleMatch("폴로 랄프로렌 네이비 코튼 치노 팬츠")?.id,
    "clothing-polo-pants-chino",
  );
  assert.notEqual(
    ruleMatch("아디다스 오리지널 트랙 탱크탑 민소매 티셔츠 ADIDAS 트랙탑 트레포일")?.id,
    "clothing-adidas-trefoil",
  );
  assert.equal(
    ruleMatch("아디다스 삼선 트랙탑")?.id,
    "clothing-adidas-trefoil",
  );
  assert.notEqual(
    ruleMatch("얀13 니트조끼 브이넥 꽈배기 루즈핏 베스트 Free 프리사이즈 / 오일릴리 랑방 지컷 아크네 듀엘 자라")?.id,
    "clothing-acne-knit",
  );
  assert.equal(
    ruleMatch("아크네스튜디오 페이스로고 패치 니트 M")?.id,
    "clothing-acne-knit",
  );
});

test("Wave 872 clothing tail audit blocks shoe styling bait and routes LEAF Alpha", () => {
  assert.equal(
    ruleMatch(
      "아크네 락어웨이/맨하탄 가죽/레더 42",
      "구성품 : 정품박스\n상태 : 8.5/10 (뒷부분 아주약간의 밑창마모만 존재)\n가죽으로 되있어서 슬랙스나 스트릿 모든 스타일과 잘어울립니다.",
    ),
    null,
  );
  assert.equal(
    ruleMatch("아크네 스튜디오 팬츠 46")?.id,
    "clothing-acne-pants",
  );

  const leafAlpha = ruleMatch("아크테릭스 리프 알파 LT 자켓");
  assert.equal(leafAlpha?.id, "clothing-arcteryx-leaf");
  assert.equal(evaluatePoolGate({ sku: leafAlpha, category: leafAlpha?.category ?? null }).canEnterPool, true);
  assert.equal(
    ruleMatch("아크테릭스 알파 SV 자켓")?.id,
    "clothing-arcteryx-alpha",
  );
});

test("fashion reference-only wording does not poison premium clothing lanes", () => {
  assert.equal(
    ruleMatch("유니클로U 브라운자켓 아크테릭스 베일런스 맛"),
    null,
  );
  assert.equal(
    ruleMatch("데상트 블레이저 (자켓) L사이즈 (아크테릭스 베일런스 st)"),
    null,
  );
  assert.equal(
    ruleMatch("110~) 00s 랭글러 미국판 그레이데님 웨스턴셔츠(RRL&LVC&폴로)"),
    null,
  );
  assert.equal(
    ruleMatch("아크테릭스 베일런스 아이스그레이 아리스 자켓")?.id,
    "clothing-arcteryx-veilance",
  );
  assert.equal(
    ruleMatch("RRL 더블알엘 데님 셔츠 M")?.id,
    "clothing-polo-rrl-denim",
  );
});

test("UGG explicit boot and slipper silhouettes do not collapse into Classic broad", () => {
  const cases: Array<[string, string, RegExp]> = [
    ["어그 클래식 미니 230", "shoe-ugg-classic-mini", /^shoe\|ugg_classic_mini\|boot\|/],
    ["어그 클래식 미니2 체스트넛 us8 250사이즈", "shoe-ugg-classic-mini-ii", /^shoe\|ugg_classic_mini_ii\|boot\|/],
    ["어그 클래식 울트라 미니 부츠 샌드 (W)", "shoe-ugg-classic-ultra-mini", /^shoe\|ugg_classic_ultra_mini\|boot\|/],
    ["어그 클래식 울트라 미니 플랫폼 부츠", "shoe-ugg-classic-ultra-mini-platform", /^shoe\|ugg_classic_ultra_mini_platform\|boot\|/],
    ["어그 클래식 울트라미니 뉴 하이츠", "shoe-ugg-classic-ultra-mini-new-heights", /^shoe\|ugg_classic_ultra_mini_new_heights\|boot\|/],
    ["어그 클래식 클리어 미니 부츠", "shoe-ugg-classic-clear-mini", /^shoe\|ugg_classic_clear_mini\|boot\|/],
    ["UGG W 클래식 미니 디퍼 부츠", "shoe-ugg-classic-mini-dipper", /^shoe\|ugg_classic_mini_dipper\|boot\|/],
    ["어그 클래식 미니 플랫폼 부츠", "shoe-ugg-classic-mini-platform", /^shoe\|ugg_classic_mini_platform\|boot\|/],
    ["UGG 어그 클래식 부츠 숏 240 체스트넛", "shoe-ugg-classic-short", /^shoe\|ugg_classic_short\|boot\|/],
    ["새상품 어그 클래식 쇼트 웨어 하이브리드 부츠", "shoe-ugg-classic-short-weather-hybrid", /^shoe\|ugg_classic_short_weather_hybrid\|boot\|/],
    ["어그 클래식 쇼트 2 부츠", "shoe-ugg-classic-short-ii", /^shoe\|ugg_classic_short_ii\|boot\|/],
    ["어그 클래식 톨 부츠", "shoe-ugg-classic-tall", /^shoe\|ugg_classic_tall\|boot\|/],
    ["어그 타스만 체스트넛", "shoe-ugg-tasman", /^shoe\|ugg_tasman\|slipper\|/],
    ["어그 뉴멜 부츠 블랙", "shoe-ugg-neumel", /^shoe\|ugg_neumel\|boot\|/],
    ["어그 디스켓 슬리퍼", "shoe-ugg-disquette", /^shoe\|ugg_disquette\|slipper\|/],
  ];

  for (const [title, skuId, keyPattern] of cases) {
    const sku = ruleMatch(title);
    assert.equal(sku?.id, skuId);
    assert.ok(sku);
    assert.equal(evaluatePoolGate({ sku, category: sku.category }).canEnterPool, true);
    assert.match(
      parseListingOptions({
        title,
        description: "",
        skuId: sku.id,
        skuName: sku.modelName,
        category: sku.category,
        defaultProductType: sku.defaultProductType ?? null,
        bunjangConditionLabel: null,
      }).comparableKey ?? "",
      keyPattern,
    );
  }

  assert.equal(
    ruleMatch("오즈어그웨어 UGG 클래식 플랫폼 미니 부츠 새상품"),
    null,
  );
  assert.equal(
    ruleMatch("새상품)밍크퍼 하트 숏 어그부츠 딸기우유 색상"),
    null,
  );
  assert.equal(
    ruleMatch("어그 클래식 부츠 체스트넛")?.id,
    "shoe-ugg-classic-broad",
  );
});

test("Asics Metaspeed excludes apparel and track spikes while keeping road shoes", () => {
  assert.equal(ruleMatch("아식스 메타스피드 하프타이즈"), null);
  assert.equal(ruleMatch("아식스 메타스피드 싱글렛 M 사이즈"), null);
  assert.equal(
    ruleMatch("아식스 메타스피드 MD 1093A210 702 중거리 육상 스파이크"),
    null,
  );

  const sku = ruleMatch("아식스 메타스피드 엣지 도쿄 265mm");
  assert.equal(sku?.id, "shoe-asics-metaspeed");
  assert.equal(evaluatePoolGate({ sku, category: sku?.category ?? null }).canEnterPool, true);

  const brandless = ruleMatch("메타스피드 스카이 파리 250mm 팝니다.");
  assert.equal(brandless?.id, "shoe-asics-metaspeed");
  assert.equal(evaluatePoolGate({ sku: brandless, category: brandless?.category ?? null }).canEnterPool, true);
});

test("Hoka Satisfy Mafate color shorthand stays public while Clifton LS is internal-only", () => {
  const mafate = ruleMatch("호카 새티스파이 라이트커피 265판매합니다.");
  assert.equal(mafate?.id, "shoe-hoka-mafate-satisfy-collab");
  assert.equal(evaluatePoolGate({ sku: mafate, category: mafate?.category ?? null }).canEnterPool, true);

  assert.equal(ruleMatch("호카 새티스파이 콜라보 270사이즈"), null);
  assert.equal(ruleMatch("(구매글)290 285 새티스파이 호카 클리프톤ls"), null);

  const clifton = ruleMatch("호카 x 새티스파이 클리프톤 LS 셀라돈 틴트 위스퍼 화이트");
  assert.equal(clifton?.id, "shoe-hoka-satisfy-clifton-ls-collab");
  assert.equal(evaluatePoolGate({ sku: clifton, category: clifton?.category ?? null }).canEnterPool, false);
});

test("NB Casablanca splits 327 and XC-72 while holding model-missing broad", () => {
  const nb327 = ruleMatch("[285] 뉴발란스 327 x 카사블랑카 그린");
  assert.equal(nb327?.id, "shoe-newbalance-casablanca-327-collab");
  assert.equal(evaluatePoolGate({ sku: nb327, category: nb327?.category ?? null }).canEnterPool, true);

  const xc72 = ruleMatch("뉴발란스 카사블랑카 XC-72 크림");
  assert.equal(xc72?.id, "shoe-newbalance-casablanca-xc72-collab");
  assert.equal(evaluatePoolGate({ sku: xc72, category: xc72?.category ?? null }).canEnterPool, true);

  assert.equal(ruleMatch("뉴발란스 카사블랑카 콜라보 270 거의새상품"), null);

  assert.equal(ruleMatch("뉴발란스237 카사블랑카 275"), null);
});

test("Lacoste pique polo excludes shirts, dresses, knits, and down vests", () => {
  const shirt = ruleMatch("라코스테 린넨 셔츠 34 사이즈");
  assert.notEqual(shirt?.id, "clothing-lacoste-pique-polo");
  if (shirt) assert.equal(evaluatePoolGate({ sku: shirt, category: shirt.category }).canEnterPool, false);
  assert.equal(ruleMatch("라코스테 25SS 피케 폴로드레스"), null);
  const knit = ruleMatch("(새상품) 라코스테 여성 케이블 스웨터 폴로 셔츠 (꽈배기) (니트)");
  assert.notEqual(knit?.id, "clothing-lacoste-pique-polo");
  if (knit) assert.equal(evaluatePoolGate({ sku: knit, category: knit.category }).canEnterPool, false);
  const downVest = ruleMatch("라코스테 피케 구스다운 베스트 팝니다");
  assert.notEqual(downVest?.id, "clothing-lacoste-pique-polo");
  if (downVest) assert.equal(evaluatePoolGate({ sku: downVest, category: downVest.category }).canEnterPool, false);
  assert.equal(ruleMatch("꼼데가르송 셔츠 x 라코스테 폴로 셔츠 그린 XL"), null);

  const polo = ruleMatch("새상품 라코스테 피케 폴로티셔츠 다크 그린 4");
  assert.equal(polo?.id, "clothing-lacoste-pique-polo");
  assert.equal(evaluatePoolGate({ sku: polo, category: polo?.category ?? null }).canEnterPool, true);
});

test("FOG Essentials jacket broad rejects other-brand essentials and stays internal-only", () => {
  assert.notEqual(
    ruleMatch("아디다스 테렉스 멀티에센셜 레인 자켓 방수 바람막이 L사이즈 새상품")?.id,
    "clothing-fog-essentials-jacket",
  );
  assert.notEqual(
    ruleMatch("뉴발란스 에센셜 헤리티지 웜엄자켓 새상품")?.id,
    "clothing-fog-essentials-jacket",
  );
  assert.equal(ruleMatch("부르즈수르트 셀비지 데님 자켓 피오갓 에센셜 스타일 리바이스"), null);

  const jacket = ruleMatch("피오갓 에센셜 초판 아노락 L");
  assert.equal(jacket?.id, "clothing-fog-essentials-jacket");
  assert.equal(evaluatePoolGate({ sku: jacket, category: jacket?.category ?? null }).canEnterPool, false);
});

test("Nike FOG apparel keeps warm-up pants out of mainline FOG pants", () => {
  const warmupPants = ruleMatch("나이키에어 피어오브갓 윔업 팬츠 XL");
  assert.equal(warmupPants?.id, "clothing-nike-fog-collab");
  assert.equal(evaluatePoolGate({ sku: warmupPants, category: warmupPants?.category ?? null }).canEnterPool, true);

  assert.notEqual(ruleMatch("나이키 에어 피어오브갓 1 라이트본 270")?.id, "clothing-nike-fog-collab");
});

test("Tail clothing exact lanes avoid broad collisions", () => {
  const landon = ruleMatch("칼하트윕 덕 랜든팬츠");
  assert.equal(landon?.id, "clothing-carhartt-landon-pants");
  assert.equal(evaluatePoolGate({ sku: landon, category: landon?.category ?? null }).canEnterPool, false);
  assert.equal(ruleMatch("칼하트 WIP 브랜든 데님 팬츠 리지드")?.id ?? null, null);

  const teamgeistLeather = ruleMatch("떠그클럽 아디다스 팀가이스트 레더 자켓 블랙");
  assert.equal(teamgeistLeather?.id, "clothing-thugclub-teamgeist-leather-jacket");
  assert.equal(evaluatePoolGate({ sku: teamgeistLeather, category: teamgeistLeather?.category ?? null }).canEnterPool, false);

  const teamgeistHoodie = ruleMatch("떠그클럽 아디다스 팀가이스트 후드 블랙");
  assert.equal(teamgeistHoodie?.id, "clothing-thugclub-teamgeist-hoodie");
  assert.equal(evaluatePoolGate({ sku: teamgeistHoodie, category: teamgeistHoodie?.category ?? null }).canEnterPool, true);
});

test("BAPE hoodie and zip hoodie keep full-zip and false brand wording apart", () => {
  assert.equal(
    ruleMatch("베이프 ABC 카모 타이거 풀 집 후드 핑크")?.id,
    "clothing-bape-hoodie-zip",
  );
  assert.equal(ruleMatch("베이프 x 뉴발란스 후디 자켓 그레이"), null);
  assert.equal(ruleMatch("스타베이프 그린 패치 집업 스웨트셔츠 XS"), null);

  const hoodie = ruleMatch("베이프 후드티 화이트 S");
  assert.equal(hoodie?.id, "clothing-bape-hoodie");
  assert.equal(evaluatePoolGate({ sku: hoodie, category: hoodie?.category ?? null }).canEnterPool, true);
});

test("Patagonia down comparisons keep vest, pullover, and down sweater product types apart", () => {
  assert.equal(ruleMatch("00s 나이키 다운 푸퍼 패딩 녹타 나이키코리아 파타고니아"), null);

  for (const [title, expected] of [
    ["파타고니아 Patagoina Nano Puff Vest", "vest"],
    ["파타고니아 Nano Puff Pullover L 사이즈", "jacket"],
    ["파타고니아 다운 스웨터 후디", "down_jacket"],
  ] as const) {
    const sku = ruleMatch(title);
    assert.equal(sku?.id, "clothing-patagonia-down");
    const parsed = parseListingOptions({
      title,
      description: "",
      skuId: sku?.id,
      skuName: sku?.modelName,
      category: sku?.category ?? null,
      defaultProductType: sku?.defaultProductType ?? null,
      bunjangConditionLabel: null,
    });
    assert.match(parsed.comparableKey ?? "", new RegExp(`^clothing\\|patagonia_down\\|${expected}\\|`));
  }
});

test("Polo patchwork flannel stays in shirt pattern while Supreme generic tokens do not open collab broad", () => {
  const poloPatchwork = ruleMatch("폴로 랄프로렌 패치워크 플란넬 셔츠");
  assert.equal(poloPatchwork?.id, "clothing-polo-shirt-pattern");
  assert.equal(evaluatePoolGate({ sku: poloPatchwork, category: poloPatchwork?.category ?? null }).canEnterPool, true);

  assert.notEqual(
    ruleMatch("폴로 랄프로렌 패치워크 플란넬 자켓")?.id,
    "clothing-polo-shirt-pattern",
  );

  assert.equal(
    ruleMatch("[슈프림] 슈프림 스몰 박스 크루넥 차콜 - 23FW 23년 10월에 출시한 슈프림 맨투맨 입니다")?.id ?? null,
    null,
  );
  assert.equal(ruleMatch("조던 나이키 MLXL후드집업 후드티 맨투맨 리복퓨마스파이더mlb슈프림조던"), null);

  const supremeCollab = ruleMatch("슈프림 준야 후드티");
  assert.equal(supremeCollab?.id, "clothing-supreme-collab-broad");
  assert.equal(evaluatePoolGate({ sku: supremeCollab, category: supremeCollab?.category ?? null }).canEnterPool, false);
});

test("Stussy basic hoodie and zip hoodie reject special/collab/product axes", () => {
  for (const title of [
    "스투시 x 유니온 후드 M",
    "스투시 Soul 1980 후드티",
    "칼하트x스투시x헤이즈 콜라보 엑티브 후드자켓 m",
  ]) {
    const sku = ruleMatch(title);
    assert.notEqual(sku?.id, "clothing-stussy-hoodie", title);
    if (sku) assert.equal(evaluatePoolGate({ sku, category: sku.category }).canEnterPool, false, title);
  }

  const knitZip = ruleMatch("스투시 청키 니트 후드집업");
  assert.notEqual(knitZip?.id, "clothing-stussy-zip-hoodie");
  if (knitZip) assert.equal(evaluatePoolGate({ sku: knitZip, category: knitZip.category }).canEnterPool, false);

  const sweaterCrew = ruleMatch("[XL]스투시 stussy 스트라이프 스웨터 스웻셔츠");
  assert.notEqual(sweaterCrew?.id, "clothing-stussy-crewneck-sweat");
  if (sweaterCrew) assert.equal(evaluatePoolGate({ sku: sweaterCrew, category: sweaterCrew.category }).canEnterPool, false);

  const ourLegacyCrew = ruleMatch("스투시 아워레가시 워크샵 맨투맨 L사이즈");
  assert.notEqual(ourLegacyCrew?.id, "clothing-stussy-crewneck-sweat");
  assert.notEqual(ourLegacyCrew?.id, "clothing-stussy-vintage-collab");
  if (ourLegacyCrew) assert.equal(evaluatePoolGate({ sku: ourLegacyCrew, category: ourLegacyCrew.category }).canEnterPool, false);

  const ourLegacyArchive = ruleMatch("스투시 워크샵 아워레가시 썬피그먼트 스웻 맨투맨", "archive vintage");
  assert.notEqual(ourLegacyArchive?.id, "clothing-stussy-crewneck-sweat");
  assert.notEqual(ourLegacyArchive?.id, "clothing-stussy-vintage-collab");
  if (ourLegacyArchive) assert.equal(evaluatePoolGate({ sku: ourLegacyArchive, category: ourLegacyArchive.category }).canEnterPool, false);

  const skullBonesHoodie = ruleMatch("스투시 SKULL & BONES PIG. DYED HOODIE 팝니다.");
  assert.notEqual(skullBonesHoodie?.id, "clothing-stussy-hoodie");
  if (skullBonesHoodie) assert.equal(evaluatePoolGate({ sku: skullBonesHoodie, category: skullBonesHoodie.category }).canEnterPool, false);

  const hoodie = ruleMatch("스투시 베이직 기모 후드 M");
  assert.equal(hoodie?.id, "clothing-stussy-hoodie");
  assert.equal(evaluatePoolGate({ sku: hoodie, category: hoodie?.category ?? null }).canEnterPool, true);

  const zip = ruleMatch("스투시 베이직 후드집업 블랙 L");
  assert.equal(zip?.id, "clothing-stussy-zip-hoodie");
  assert.equal(evaluatePoolGate({ sku: zip, category: zip?.category ?? null }).canEnterPool, true);
});

test("Polo knit requires Ralph Lauren signal and rejects other-brand polo knit wording", () => {
  const grailz = ruleMatch("그레일즈 G SPORTS KNIT POLO ZIP UP 니트집업");
  assert.notEqual(grailz?.id, "clothing-polo-knit-sweater");
  if (grailz) assert.equal(evaluatePoolGate({ sku: grailz, category: grailz.category }).canEnterPool, false);

  const amiOxford = ruleMatch("아미 옥스포드 폴로셔츠 44 (새상품급)");
  assert.notEqual(amiOxford?.id, "clothing-polo-oxford-shirt");
  if (amiOxford) assert.equal(evaluatePoolGate({ sku: amiOxford, category: amiOxford.category }).canEnterPool, false);

  const knit = ruleMatch("폴로 랄프로렌 네이비 니트 L");
  assert.equal(knit?.id, "clothing-polo-knit-sweater");
  assert.equal(evaluatePoolGate({ sku: knit, category: knit?.category ?? null }).canEnterPool, true);
});

test("RRL shirt rejects other-brand western shirt reference wording", () => {
  const hbarc = ruleMatch("H bar C 오리지널 스티치 웨스턴 셔츠 HbarC RRL 더블알엘");
  assert.notEqual(hbarc?.id, "clothing-polo-rrl-shirt");
  if (hbarc) assert.equal(evaluatePoolGate({ sku: hbarc, category: hbarc.category }).canEnterPool, false);

  const shirt = ruleMatch("RRL 더블알엘 샴브레이 셔츠 S");
  assert.equal(shirt?.id, "clothing-polo-rrl-shirt");
  assert.equal(evaluatePoolGate({ sku: shirt, category: shirt?.category ?? null }).canEnterPool, true);
});

test("Acne shorts rejects kids multi-brand set wording", () => {
  const multiBrandSet = ruleMatch(
    "120-130 DKNY, 미니로디니, 아크네스튜디오 세트",
    "아동복 반바지 세트 일괄",
  );
  assert.notEqual(multiBrandSet?.id, "clothing-acne-shorts");
  if (multiBrandSet) assert.equal(evaluatePoolGate({ sku: multiBrandSet, category: multiBrandSet.category }).canEnterPool, false);

  const shorts = ruleMatch("아크네 스튜디오 밴딩쇼츠 46");
  assert.equal(shorts?.id, "clothing-acne-shorts");
  assert.equal(evaluatePoolGate({ sku: shorts, category: shorts?.category ?? null }).canEnterPool, true);
});

test("Stussy vintage collab rejects other-brand outdoor archive rows", () => {
  const mountainHardwear = ruleMatch("00s 올드 마운틴 하드웨어 바람막이 자켓 L (103)");
  assert.notEqual(mountainHardwear?.id, "clothing-stussy-vintage-collab");
  assert.equal(mountainHardwear?.id, "clothing-mountain-hardwear-broad");
});

test("Carhartt ready clothing lanes reject tee, vest, and outer-jacket leakage", () => {
  assert.notEqual(ruleMatch("칼하트 wip 티셔츠 m")?.id, "clothing-carhartt-shirt-flannel");
  assert.notEqual(
    ruleMatch("[정품] 칼하트 남성 코튼 라운드 반팔 티셔츠 (S/크게나옴) 상상샵")?.id,
    "clothing-carhartt-heritage-usa",
  );
  assert.notEqual(
    ruleMatch(
      "[L] 칼하트wip 브루크 푸퍼 베스트 (패딩조끼)",
      "전부 실사진 입니다. 추가 사진 요청 받지 않습니다.",
    )?.id,
    "clothing-carhartt-denim-pants",
  );
  assert.equal(
    ruleMatch("[L-XL] 칼하트 WIP OG 덕 액티브 워크 후드 자켓 블랙")?.id,
    "clothing-carhartt-active-jacket",
  );
  assert.notEqual(
    ruleMatch("칼하트 WIP 블랙 봄버 자켓 집업")?.id,
    "clothing-carhartt-hoodie-sweat",
  );
  assert.equal(ruleMatch("칼하트 WIP 맨투맨 m사이즈")?.id, "clothing-carhartt-hoodie-sweat");
  assert.equal(ruleMatch("[L] 칼하트 WIP 블랑톤 체크 셔츠")?.id, "clothing-carhartt-shirt-flannel");
});

test("Stone Island overshirt rows route to an internal learning lane, not broad/null", () => {
  for (const title of [
    "스톤아일랜드 18FW 나일론메탈 오버셔츠 베이지 2XL",
    "스톤아일랜드 21fw 올드이팩트 오버셔츠 L",
    "스톤아일랜드 나일론메탈 오버셔츠",
    "스톤아일랜드 올드이펙트 오버셔츠",
    "스톤 아일랜드 10619 스트레치 코튼 트윌 오버셔츠 올리브 그린",
  ]) {
    const sku = ruleMatch(title);
    assert.equal(sku?.id, "clothing-stone-island-overshirt", title);
    assert.equal(evaluatePoolGate({ sku, category: sku?.category ?? null }).canEnterPool, false, title);
  }
});

test("Stone Island pants do not leak into the overshirt lane", () => {
  const sku = ruleMatch("M 스톤아일랜드 말파일 플리스 올드 이펙트 조거 팬츠");
  assert.equal(sku?.id, "clothing-stone-island-pants");
  assert.equal(evaluatePoolGate({ sku, category: sku?.category ?? null }).canEnterPool, false);
  assert.equal(
    ruleMatch("스톤아일랜드 매장판 쉐도우 컨버트 팬츠")?.id,
    "clothing-stone-island-shadow-project",
  );
});

test("Crocs slipper broad rejects other-brand slipper wording", () => {
  assert.notEqual(
    ruleMatch("[270 280 290] 나이키 조던 시스템 슬리퍼 크록스")?.id,
    "shoe-crocs-slipper-broad",
  );
});

test("Wave 880 recent clothing drift routes exact internal lanes", () => {
  let sku = ruleMatch("[A+등급 M] 슈프림 23FW 오렌지레드 와일드캣 푸퍼 후드점퍼자켓");
  assert.equal(sku?.id, "clothing-supreme-wildcat-puffer");
  assert.equal(evaluatePoolGate({ sku, category: sku?.category ?? null }).canEnterPool, false);

  sku = ruleMatch("[31x32] 칼하트 wip 말로우 진청");
  assert.equal(sku?.id, "clothing-carhartt-denim-pants");
});

test("Uniqlo broad rejects description-only size-reference mentions from other brands", () => {
  assert.notEqual(
    ruleMatch(
      "코치 x 챔피언 콜라보 가죽자켓 50. coach x champion",
      "50사이즈로 유니클로 XL입으시면 잘 맞습니다.",
    )?.id,
    "clothing-uniqlo-broad",
  );
  assert.equal(ruleMatch("유니클로U 코튼 자켓 XL")?.id, "clothing-uniqlo-broad");
  assert.equal(ruleMatch("유니클로 코치 자켓 블랙 4XL")?.id, "clothing-uniqlo-broad");
});

test("Stussy 8 Ball knit stays out of broad apparel and basic tee", () => {
  assert.equal(ruleMatch("스투시 모헤어 에잇볼 니트")?.id, "clothing-stussy-8ball-knit");
  assert.equal(ruleMatch("스투시 8ball knit sweater")?.id, "clothing-stussy-8ball-knit");
});

test("Fashion lookalike taste wording and short explicit condition signals are handled", () => {
  assert.equal(ruleMatch("사카이 맛 나이키 와플원"), null);
  assert.equal(ruleMatch("sacai style nike waffle one"), null);
  assert.equal(ruleMatch("나이키 사카이 와플")?.id, "shoe-nike-sakai-collab");

  const yeezy = ruleMatch("이지부스트 350 트루폼 260 민트급");
  assert.equal(yeezy?.id, "shoe-yeezy-boost-350-v2-broad");
  const yeezyParsed = parseListingOptions({
    title: "이지부스트 350 트루폼 260 민트급",
    description: "",
    skuId: yeezy?.id,
    skuName: yeezy?.modelName,
    category: yeezy?.category,
    defaultProductType: yeezy?.defaultProductType ?? null,
  });
  assert.equal((yeezyParsed.parsedJson.condition_grade as { tier?: string }).tier, "A");
  assert.equal(yeezyParsed.comparableKey?.endsWith("|a_grade"), true);

  const airMax = ruleMatch("[235 새제품] 나이키 우먼스 에어맥스 95");
  assert.equal(airMax?.id, "shoe-nike-airmax-95");
  const airMaxParsed = parseListingOptions({
    title: "[235 새제품] 나이키 우먼스 에어맥스 95",
    description: "",
    skuId: airMax?.id,
    skuName: airMax?.modelName,
    category: airMax?.category,
    defaultProductType: airMax?.defaultProductType ?? null,
  });
  assert.equal((airMaxParsed.parsedJson.condition_grade as { tier?: string }).tier, "A");
  assert.equal(airMaxParsed.comparableKey?.endsWith("|a_grade"), true);
});

test("Clothing compact no-wear wording does not fall into C-grade samples", () => {
  const sku = ruleMatch(
    "꼼데가르송 블레이저 자켓 (가격인하)",
    "꼼데가르송 블레이저 자켓\n심플한 디자인의 캐주얼자켓입니다\n1회착용 세탁보관 사용감전혀없구요\nS사이즈 국내95~100좋읍니다",
  );
  assert.equal(sku?.id, "clothing-cdg-apparel-broad");
  const parsed = parseListingOptions({
    title: "꼼데가르송 블레이저 자켓 (가격인하)",
    description: "꼼데가르송 블레이저 자켓\n심플한 디자인의 캐주얼자켓입니다\n1회착용 세탁보관 사용감전혀없구요\nS사이즈 국내95~100좋읍니다",
    skuId: sku?.id,
    skuName: sku?.modelName,
    category: sku?.category,
    defaultProductType: sku?.defaultProductType ?? null,
    bunjangConditionLabel: "USED",
  });
  assert.equal((parsed.parsedJson.condition_grade as { tier?: string }).tier, "A");
  assert.equal(parsed.comparableKey?.endsWith("|a_grade"), true);
});

test("Short explicit used wording aligns condition tier and comparable key", () => {
  const cap = ruleMatch("MLB 모자캡 53-55", "반택포함 만원입니다\n사용감있습니다");
  assert.equal(cap?.id, "clothing-mlb-cap");
  const capParsed = parseListingOptions({
    title: "MLB 모자캡 53-55",
    description: "반택포함 만원입니다\n사용감있습니다",
    skuId: cap?.id,
    skuName: cap?.modelName,
    category: cap?.category,
    defaultProductType: cap?.defaultProductType ?? null,
  });
  assert.equal((capParsed.parsedJson.condition_grade as { tier?: string }).tier, "C");
  assert.equal(capParsed.comparableKey?.endsWith("|c_grade"), true);

  const shoe = ruleMatch("아디다스 스페지알 화이트그린", "사용감있습니다");
  assert.equal(shoe?.id, "shoe-adidas-spezial");
  const shoeParsed = parseListingOptions({
    title: "아디다스 스페지알 화이트그린",
    description: "사용감있습니다",
    skuId: shoe?.id,
    skuName: shoe?.modelName,
    category: shoe?.category,
    defaultProductType: shoe?.defaultProductType ?? null,
  });
  assert.equal((shoeParsed.parsedJson.condition_grade as { tier?: string }).tier, "C");
  assert.equal(shoeParsed.comparableKey?.endsWith("|c_grade"), true);
});

test("Y-3 QASA shoe titles do not route into Y-3 apparel", () => {
  for (const [title, description] of [
    [
      "255) 아디다스 Y-3 QASA ELLE",
      "Y-3 QASA ELLE 스니커즈 255 사이즈입니다.",
    ],
    [
      "[255] 아디다스x요지야마모토 와이쓰리Y3 콰사 하이 코어블랙ㅡ단종매물",
      "착용 가능한 Y-3 콰사 하이 신발입니다.",
    ],
  ] as const) {
    const sku = ruleMatch(title, description);
    assert.equal(sku?.id, "shoe-y3-qasa-broad", title);
    assert.notEqual(sku?.id, "clothing-adidas-y3-collab", title);
    const parsed = parseListingOptions({
      title,
      description,
      skuId: sku?.id,
      skuName: sku?.modelName,
      category: sku?.category,
      defaultProductType: sku?.defaultProductType ?? null,
    });
    assert.match(parsed.comparableKey ?? "", /^shoe\|y3_qasa_broad\|sneaker\|/);
  }
});

test("Fashion unknown condition stays out of A/C comparable samples", () => {
  const sku = ruleMatch("크록스 라이트라이드");
  assert.equal(sku?.id, "shoe-crocs-light-ride-broad");
  const parsed = parseListingOptions({
    title: "크록스 라이트라이드",
    description: "",
    skuId: sku?.id,
    skuName: sku?.modelName,
    category: sku?.category,
    defaultProductType: sku?.defaultProductType ?? null,
  });
  assert.equal((parsed.parsedJson.condition_grade as { tier?: string }).tier, "UNKNOWN");
  assert.equal(parsed.comparableKey?.endsWith("|unknown_condition"), true);
});

test("Game title SKUs reject character goods and apparel accessories", () => {
  assert.equal(ruleMatch("무신사 X 사이버펑크 엣지러너 볼캡"), null);
  assert.equal(ruleMatch("사이버펑크 2077 타올 굿즈"), null);
  assert.equal(ruleMatch("사이버펑크 루시 피규어 굿스마일"), null);
  assert.equal(ruleMatch("사이버펑크 2077 디스크")?.id, "ps-game-cyberpunk");
  assert.equal(ruleMatch("레고 76175 마블 아이언 스파이더맨"), null);
  assert.equal(ruleMatch("닌텐도 스위치 레고 스타워즈 게임칩")?.id, "switch-game-lego");
});

test("Shoe compact one-wear wording aligns condition tier and comparable key", () => {
  const sku = ruleMatch("아디다스 스페지알 화이트그린", "36사이즈이고 한번 신어서 상태 너무 좋아요~");
  assert.equal(sku?.id, "shoe-adidas-spezial");
  const parsed = parseListingOptions({
    title: "아디다스 스페지알 화이트그린",
    description: "36사이즈이고 한번 신어서 상태 너무 좋아요~",
    skuId: sku?.id,
    skuName: sku?.modelName,
    category: sku?.category,
    defaultProductType: sku?.defaultProductType ?? null,
  });
  assert.equal((parsed.parsedJson.condition_grade as { tier?: string }).tier, "A");
  assert.equal(parsed.comparableKey?.endsWith("|a_grade"), true);
});
