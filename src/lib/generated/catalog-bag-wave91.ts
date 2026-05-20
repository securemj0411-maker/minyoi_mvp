// Wave 91/93 V2 — bag catalog (resale ≤200만). pollution 정밀화.
import type { Sku } from "@/lib/catalog";

export const BAG_CATALOG: Sku[] = [
  {
    id: "bag-lv-monogram-pochette-accessoires",
    brand: "Louis Vuitton",
    category: "bag",
    modelName: "Monogram Pochette Accessoires (빈티지)",
    aliases: [],
    mustContain: [
      ["루이비통 포셰트", "lv 포셰트", "포셰트 액세서리", "포셰트액세서리", "pochette accessoires", "pochette accessoire", "pochette accessoire monogram", "포쉐트 악세사리", "포쉐트액세서리"],
    ],
    mustNotContain: [
      "메티스", "metis", "키 포셰트", "key pouch", "키파우치", "키 파우치", "felicie", "펠리시", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 1200000,
    released: 2024,
    laneKey: "bag_lv_pochette_accessoires_vintage",
  },
  {
    id: "bag-lv-monogram-neverfull-pm",
    brand: "Louis Vuitton",
    category: "bag",
    modelName: "Neverfull PM Monogram",
    aliases: [],
    mustContain: [
      ["네버풀", "neverfull"],
      ["pm", "스몰", "small"],
    ],
    mustNotContain: [
      "mm", "gm", "다미에", "damier", "이너백만", "이너백 단품", "인너백만", "파우치만", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 2790000,
    released: 2024,
    laneKey: "bag_lv_neverfull_pm_monogram",
  },
  {
    id: "bag-lv-monogram-speedy-25",
    brand: "Louis Vuitton",
    category: "bag",
    modelName: "Speedy 25 Monogram (빈티지)",
    aliases: [],
    mustContain: [
      ["스피디", "speedy"],
      ["25"],
    ],
    mustNotContain: [
      "30", "35", "40", "반둘리에", "bandouliere", "나노", "nano", "다미에", "damier", "에삐", "epi", "앙프렝뜨", "empreinte", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 2200000,
    released: 2024,
    laneKey: "bag_lv_speedy_25_monogram",
  },
  {
    id: "bag-lv-monogram-alma-bb",
    brand: "Louis Vuitton",
    category: "bag",
    modelName: "Alma BB Monogram (빈티지)",
    aliases: [],
    mustContain: [
      ["알마", "alma"],
      ["bb"],
    ],
    mustNotContain: [
      "pm", "mm", "gm", "에삐", "epi", "베르니", "vernis", "다미에", "damier", "앙프렝뜨", "empreinte", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 2590000,
    released: 2024,
    laneKey: "bag_lv_alma_bb_monogram",
  },
  {
    id: "bag-lv-pochette-metis-monogram",
    brand: "Louis Vuitton",
    category: "bag",
    modelName: "Pochette Metis Monogram",
    aliases: [],
    mustContain: [
      ["포셰트 메티스", "포쉐트 메티스", "포셰트메티스", "포쉐트메티스", "pochette metis", "pochette métis"],
    ],
    mustNotContain: [
      "미니", "mini", "이스트웨스트", "east west", "리버스", "reverse", "앙프렝뜨", "empreinte", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 3100000,
    released: 2024,
    laneKey: "bag_lv_pochette_metis_monogram",
  },
  {
    id: "bag-lv-sarah-wallet-monogram",
    brand: "Louis Vuitton",
    category: "bag",
    modelName: "Sarah Wallet Monogram (장지갑)",
    aliases: [],
    mustContain: [
      ["사라월릿", "사라 월릿", "sarah wallet", "사라장지갑", "사라 장지갑"],
    ],
    mustNotContain: [
      "에밀리", "emilie", "조시", "josephine", "조세핀", "다미에", "damier", "앙프렝뜨", "empreinte", "에삐", "epi", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 1150000,
    released: 2024,
    laneKey: "bag_lv_sarah_wallet_monogram",
  },
  {
    id: "bag-lv-zippy-wallet-monogram",
    brand: "Louis Vuitton",
    category: "bag",
    modelName: "Zippy Wallet Monogram",
    aliases: [],
    mustContain: [
      ["지피월릿", "지피 월릿", "zippy wallet", "지피 장지갑", "지피장지갑"],
    ],
    mustNotContain: [
      "코인", "coin", "콤팩트", "compact", "다미에", "damier", "그래피티", "graffiti", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 1230000,
    released: 2024,
    laneKey: "bag_lv_zippy_wallet_monogram",
  },
  {
    id: "bag-gucci-gg-marmont-mini",
    brand: "Gucci",
    category: "bag",
    modelName: "GG Marmont Mini Shoulder Bag",
    aliases: [],
    mustContain: [
      ["마몽", "marmont", "마몬트"],
      ["미니", "mini"],
    ],
    mustNotContain: [
      "스몰", "small", "미디움", "medium", "라지", "large", "벨트백", "belt bag", "카메라백", "camera", "탑핸들", "top handle", "백팩", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 2150000,
    released: 2024,
    laneKey: "bag_gucci_marmont_mini_shoulder",
  },
  {
    id: "bag-gucci-gg-marmont-camera",
    brand: "Gucci",
    category: "bag",
    modelName: "GG Marmont Matelasse Camera Bag (스몰)",
    aliases: [],
    mustContain: [
      ["마몽", "marmont", "마몬트"],
      ["카메라", "camera"],
    ],
    mustNotContain: [
      "미디움", "medium", "라지", "large", "탑핸들", "top handle", "벨트백", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 1990000,
    released: 2024,
    laneKey: "bag_gucci_marmont_camera_small",
  },
  {
    id: "bag-gucci-gg-supreme-card-wallet",
    brand: "Gucci",
    category: "bag",
    modelName: "GG Supreme Bifold/Card Wallet",
    aliases: [],
    mustContain: [
      ["gg 슈프림", "gg슈프림", "수프림", "supreme"],
      ["지갑", "월릿", "wallet", "카드지갑", "카드 지갑", "반지갑"],
    ],
    mustNotContain: [
      "여행용", "여권", "passport", "장지갑", "long wallet", "지피", "체인 월릿", "chain wallet", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 580000,
    released: 2024,
    laneKey: "bag_gucci_supreme_wallet",
  },
  {
    id: "bag-gucci-dionysus-mini",
    brand: "Gucci",
    category: "bag",
    modelName: "Dionysus Mini Shoulder Bag",
    aliases: [],
    mustContain: [
      ["디오니소스", "dionysus"],
      ["미니", "mini", "슈퍼미니", "super mini"],
    ],
    mustNotContain: [
      "스몰", "small", "미디움", "medium", "라지", "large", "체인 월릿", "chain wallet", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 2350000,
    released: 2024,
    laneKey: "bag_gucci_dionysus_mini",
    defaultProductType: "shoulder", // Wave 269d: narrow SKU type fallback
  },
  {
    id: "bag-prada-saffiano-galleria-mini",
    brand: "Prada",
    category: "bag",
    modelName: "Saffiano Galleria Mini",
    aliases: [],
    mustContain: [
      ["프라다", "prada"],
      ["갈레리아", "갈러리아", "갤러리아", "galleria"],
      ["미니", "mini"],
    ],
    mustNotContain: [
      "스몰", "small", "미디움", "medium", "라지", "large", "마이크로", "micro", "재투입", "재출시", "re-edition", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 3400000,
    released: 2024,
    laneKey: "bag_prada_galleria_mini_saffiano",
    defaultProductType: "tote", // Wave 269d: narrow SKU type fallback
  },
  {
    id: "bag-prada-nylon-hobo-vintage",
    brand: "Prada",
    category: "bag",
    modelName: "Re-Edition 2005 Nylon Hobo (또는 빈티지 나일론 호보)",
    aliases: [],
    mustContain: [
      ["프라다", "prada"],
      ["나일론", "nylon", "테수토", "tessuto", "1bh204"],
      ["호보", "hobo", "리에디션", "re-edition", "재투입", "2005"],
    ],
    mustNotContain: [
      "미러급", "정품가품모름", "복원중", "수리중", "스트랩만", "체인만", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 2200000,
    released: 2024,
    laneKey: "bag_prada_nylon_hobo",
    defaultProductType: "shoulder", // Wave 236d — Hobo bag = shoulder bag.
  },
  {
    id: "bag-prada-saffiano-card-wallet",
    brand: "Prada",
    category: "bag",
    modelName: "Saffiano 사피아노 카드/반지갑",
    aliases: [],
    mustContain: [
      ["프라다", "prada"],
      ["사피아노", "saffiano"],
      ["지갑", "월릿", "wallet", "카드", "card", "반지갑", "장지갑"],
    ],
    mustNotContain: [
      "여행용", "여권", "passport", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 750000,
    released: 2024,
    laneKey: "bag_prada_saffiano_wallet",
    defaultProductType: "wallet", // Wave 236d — Saffiano Wallet (mustContain wallet 강제).
  },
  {
    id: "bag-celine-trio-medium",
    brand: "Celine",
    category: "bag",
    modelName: "Trio Crossbody Bag (Medium 또는 Large)",
    aliases: [],
    mustContain: [
      ["셀린느", "셀린", "celine"],
      ["트리오", "trio"],
    ],
    mustNotContain: [
      "미니", "스몰 트리오", "small trio", "트리옴프", "triomphe", "트리오페", "팔로우", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 950000,
    released: 2024,
    laneKey: "bag_celine_trio_crossbody",
    defaultProductType: "crossbody", // Wave 269d: narrow SKU type fallback
  },
  {
    id: "bag-celine-vintage-macadam",
    brand: "Celine",
    category: "bag",
    modelName: "Vintage Macadam Canvas Bag",
    aliases: [],
    mustContain: [
      ["셀린느", "셀린", "celine"],
      ["마카담", "macadam", "올드 셀린느", "올드셀린느"],
    ],
    mustNotContain: [
      "트리옴프", "triomphe", "리에디션", "복각", "현행", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 1500000,
    released: 2024,
    laneKey: "bag_celine_vintage_macadam",
    defaultProductType: "shoulder", // Wave 236d — Vintage Macadam = shoulder bag.
  },
  {
    id: "bag-balenciaga-classic-city-mini",
    brand: "Balenciaga",
    category: "bag",
    modelName: "Classic City Mini/Small",
    aliases: [],
    mustContain: [
      ["발렌시아가", "balenciaga"],
      ["시티", "city"],
    ],
    mustNotContain: [
      "네오 클래식", "neo classic", "북", "book", "아워글래스", "hourglass", "벨로", "velo", "그라피티", "데이", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 3200000,
    released: 2024,
    laneKey: "bag_balenciaga_classic_city",
  },
  {
    id: "bag-margiela-5ac-mini",
    brand: "Maison Margiela",
    category: "bag",
    modelName: "5AC Mini/Micro Bag",
    aliases: [],
    mustContain: [
      ["마르지엘라", "margiela", "메종 마르지엘라", "메종마르지엘라"],
      ["5ac"],
    ],
    mustNotContain: [
      "라지", "large", "xl", "엑스라지", "extra large", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 1700000,
    released: 2024,
    laneKey: "bag_margiela_5ac_mini",
    defaultProductType: "crossbody", // Wave 269d: narrow SKU type fallback
  },
  {
    id: "bag-baobao-issey-miyake-lucent",
    brand: "Issey Miyake",
    category: "bag",
    modelName: "BaoBao Lucent 6x6/4x4/Matte (인기 색상)",
    aliases: [],
    mustContain: [
      ["바오바오", "baobao", "bao bao", "이세이미야케", "이슈에이미야케", "issey miyake"],
    ],
    mustNotContain: [
      "짝퉁", "이미테이션", "복각", "퀄리티", "미러급", "키즈", "아동", "토일렛", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
      // Wave 241 (2026-05-19): 사용자 코멘트 "이건 신발인데 신발이랑 비교하네" — Camper x Issey Miyake 신발이 BaoBao bag SKU 매칭.
      "캠퍼", "camper", "asics", "아식스", "salomon", "살로몬",
      // Wave 410 (2026-05-20): "이세이 미야케 맨 ... 레더 스니커" uses 스니커 without 즈.
      "운동화", "sneaker", "스니커", "스니커즈", "샌들", "sandal", "슬리퍼", "slipper",
    ],
    msrpKrw: 580000,
    released: 2024,
    laneKey: "bag_baobao_lucent",
    defaultProductType: "tote",
  },
  {
    id: "bag-bottega-cassette-mini",
    brand: "Bottega Veneta",
    category: "bag",
    modelName: "Cassette Mini Bag",
    aliases: [],
    mustContain: [
      ["보테가", "bottega", "보테가베네타", "bottega veneta"],
      ["카세트", "cassette"],
    ],
    mustNotContain: [
      "라지", "large", "체인", "chain", "맥시", "maxi", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 2950000,
    released: 2024,
    laneKey: "bag_bottega_cassette_mini",
    defaultProductType: "crossbody", // Wave 236d — Cassette Mini = mini crossbody bag.
  },
  {
    id: "bag-mcm-visetos-medium-backpack",
    brand: "MCM",
    category: "bag",
    modelName: "Visetos Medium Stark Backpack",
    aliases: [],
    mustContain: [
      ["mcm", "엠씨엠"],
      ["비세토스", "visetos", "스타크", "stark", "백팩", "backpack", "토트"],
    ],
    mustNotContain: [
      "복각", "짝퉁", "이미테이션", "키즈", "아동", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 890000,
    released: 2024,
    laneKey: "bag_mcm_visetos_stark",
    defaultProductType: "backpack", // Wave 269d: narrow SKU type fallback
  },
  {
    id: "bag-coach-signature-tote",
    brand: "Coach",
    category: "bag",
    modelName: "Signature Canvas Tote / Camera Bag",
    aliases: [],
    mustContain: [
      ["coach", "코치"],
      ["시그니처", "signature", "카메라", "camera"],
      ["토트", "tote", "가방", "bag", "백 "],
    ],
    mustNotContain: [
      "복각", "짝퉁", "이미테이션", "키즈", "아동", "퀄리티", "미러급", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 590000,
    released: 2024,
    laneKey: "bag_coach_signature",
    defaultProductType: "tote", // Wave 269d: narrow SKU type fallback
  },
  {
    id: "bag-coach-wallet",
    brand: "Coach",
    category: "bag",
    modelName: "Signature Canvas / Leather Wallet",
    aliases: [],
    mustContain: [
      ["coach", "코치"],
      ["지갑", "월릿", "wallet", "카드지갑", "카드 지갑", "반지갑"],
    ],
    mustNotContain: [
      "복각", "짝퉁", "이미테이션", "키즈", "아동", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 290000,
    released: 2024,
    laneKey: "bag_coach_wallet",
    defaultProductType: "wallet", // Wave 236d — Coach Wallet (mustContain wallet).
  },
  {
    id: "bag-michael-kors-jet-set",
    brand: "Michael Kors",
    category: "bag",
    modelName: "Jet Set Crossbody / Tote",
    aliases: [],
    mustContain: [
      ["마이클코어스", "마이클 코어스", "michael kors", "마코"],
      ["제트셋", "jet set", "토트", "tote", "크로스"],
    ],
    mustNotContain: [
      "복각", "짝퉁", "이미테이션", "키즈", "아동", "퀄리티", "미러급", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 480000,
    released: 2024,
    laneKey: "bag_michaelkors_jetset",
  },
  {
    id: "bag-tory-burch-mcgraw",
    brand: "Tory Burch",
    category: "bag",
    modelName: "McGraw / Robinson Tote / Camera",
    aliases: [],
    mustContain: [
      ["토리버치", "토리 버치", "tory burch"],
      ["맥그로우", "mcgraw", "로빈슨", "robinson", "카메라", "camera", "토트", "tote", "미러", "mirror"],
    ],
    mustNotContain: [
      "복각", "짝퉁", "이미테이션", "키즈", "아동", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 580000,
    released: 2024,
    laneKey: "bag_toryburch_mcgraw_robinson",
  },
  {
    id: "bag-kate-spade-nora",
    brand: "Kate Spade",
    category: "bag",
    modelName: "Nora / Knott / Margaux",
    aliases: [],
    mustContain: [
      ["케이트 스페이드", "케이트스페이드", "kate spade"],
      ["노라", "nora", "knott", "노트", "margaux", "마고"],
    ],
    mustNotContain: [
      "복각", "짝퉁", "이미테이션", "키즈", "아동", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 380000,
    released: 2024,
    laneKey: "bag_katespade_nora",
  },
  {
    id: "bag-marc-jacobs-tote",
    brand: "Marc Jacobs",
    category: "bag",
    modelName: "The Tote Bag (Medium/Mini)",
    aliases: [],
    mustContain: [
      ["마크제이콥스", "마크 제이콥스", "marc jacobs"],
      ["더 토트", "더토트", "the tote", "토트백", "스내쇼트", "snapshot"],
    ],
    mustNotContain: [
      "복각", "짝퉁", "이미테이션", "키즈", "아동", "퀄리티", "미러급", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
      // Wave 235 (2026-05-19): Denim Tears × Marc Jacobs Tote 180만/50만 collab — 별도 SKU.
      "denim tears", "데님티어스", "데님 티어스", "tremaine emory", "트리메인 에모리",
    ],
    msrpKrw: 695000,
    released: 2024,
    laneKey: "bag_marcjacobs_the_tote",
  },
  {
    id: "bag-celine-vintage-trio-pouch",
    brand: "Celine",
    category: "bag",
    modelName: "Vintage Solo / Pouch (마카담 외 빈티지)",
    aliases: [],
    // Wave 232 (2026-05-19): product type 강제 — 시계/신발 매물 차단.
    mustContain: [
      ["셀린느", "셀린", "celine"],
      ["올드 셀린느", "올드셀린느", "마카담", "macadam", "트리오", "trio"],
      ["가방", "bag", "토트백", "tote", "숄더백", "shoulder bag", "크로스백", "crossbody", "백팩", "backpack", "포셰트", "pochette", "파우치", "pouch", "백"],
    ],
    mustNotContain: [
      "트리옴프", "triomphe", "현행", "리에디션", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 800000,
    released: 2024,
    laneKey: "bag_celine_vintage_pouch",
  },
  {
    id: "bag-lv-monogram-key-pouch",
    brand: "Louis Vuitton",
    category: "bag",
    modelName: "Key Pouch / Cles Monogram",
    aliases: [],
    // Wave 264 (2026-05-20): mustContain group 1 추가 — LV brand 강제 (사용자 발견 false positive).
    //   기존: ["키 포셰트", "키 파우치", ...] 만 — "나이키 에어포스 1 로우" 매물의 "키" 매칭? false positive 의심.
    //   fix: mustContain 에 LV brand 강제 group 추가. + mustNotContain 에 nike/adidas/스니커즈 추가.
    mustContain: [
      ["루이비통", "lv", "louis vuitton"],
      ["키 포셰트", "키포셰트", "키 파우치", "키파우치", "키 포쉐트", "키포쉐트", "key pouch", "cles", "클레"],
    ],
    mustNotContain: [
      "다미에", "damier", "에삐", "epi", "앙프렝뜨",
      // Wave 264 false positive 차단 — 다른 brand 신발/잡화
      "나이키", "nike", "아디다스", "adidas", "에어포스", "airforce", "에어맥스", "airmax", "스니커즈", "운동화", "조던", "jordan",
      "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 380000,
    released: 2024,
    laneKey: "bag_lv_key_pouch_monogram",
    defaultProductType: "pouch",
  },
  {
    id: "bag-gucci-marmont-card-wallet",
    brand: "Gucci",
    category: "bag",
    modelName: "GG Marmont Leather Card Holder / 반지갑",
    aliases: [],
    mustContain: [
      ["마몽", "marmont", "마몬트"],
      ["카드지갑", "카드 지갑", "반지갑", "card holder", "wallet"],
    ],
    mustNotContain: [
      "장지갑", "long wallet", "지피", "체인 월릿", "chain wallet", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 530000,
    released: 2024,
    laneKey: "bag_gucci_marmont_card_wallet",
  },
  {
    id: "bag-lv-felicie-pochette",
    brand: "Louis Vuitton",
    category: "bag",
    modelName: "Felicie Pochette Monogram",
    aliases: [],
    mustContain: [
      ["펠리시", "felicie"],
      ["포셰트", "pochette", "포쉐트"],
    ],
    mustNotContain: [
      "메티스", "metis", "액세서리만", "이너 파우치만", "이너파우치만", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 2050000,
    released: 2024,
    laneKey: "bag_lv_felicie_pochette",
  },
  {
    id: "bag-prada-tessuto-vintage-shoulder",
    brand: "Prada",
    category: "bag",
    modelName: "Vintage Tessuto Nylon Shoulder Bag",
    aliases: [],
    // Wave 232 (2026-05-19): product type 강제 — 시계/신발 매물 차단.
    //   원래 "프라다" + "빈티지/tessuto" → 가방/시계/신발 다 매칭됨.
    mustContain: [
      ["프라다", "prada"],
      ["테수토", "tessuto", "올드 프라다", "올드프라다"],
      ["가방", "bag", "토트백", "tote", "숄더백", "shoulder bag", "크로스백", "crossbody", "백팩", "backpack", "포셰트", "pochette", "백"],
    ],
    mustNotContain: [
      "현행", "리에디션", "re-edition", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 1200000,
    released: 2024,
    laneKey: "bag_prada_tessuto_vintage",
  },
  {
    id: "bag-gucci-jackie-mini",
    brand: "Gucci",
    category: "bag",
    modelName: "Jackie 1961 Mini Hobo",
    aliases: [],
    mustContain: [
      ["재키", "jackie"],
      ["미니", "mini", "1961", "스몰"],
    ],
    mustNotContain: [
      "미디움", "medium", "라지", "large", "노트북", "백팩", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 2950000,
    released: 2024,
    laneKey: "bag_gucci_jackie_mini",
  },
  {
    id: "bag-lv-card-holder-monogram",
    brand: "Louis Vuitton",
    category: "bag",
    modelName: "Pocket Organizer / Card Holder Monogram",
    aliases: [],
    // Wave 258 (2026-05-20): mustContain 보강 — "오거나이저/organizer/엔벨로프 비즈니스/비즈니스 카드/악어지갑" 추가.
    // 사용자 SQL 검증 — LV 78건 sku_id=NULL 매물 중 28건 "오거나이저/카드 홀더" 매칭 안 됨.
    mustContain: [
      ["루이비통", "lv", "louis vuitton"],
      ["카드지갑", "카드 지갑", "포켓 오거나이저", "포켓오거나이저", "오거나이저", "organizer", "card holder", "카드홀더", "카드 홀더", "엔벨로프 비즈니스", "엔벨로프", "비즈니스 카드", "비즈니스카드", "악어지갑", "악어 지갑"],
    ],
    mustNotContain: [
      "장지갑", "반지갑", "지피", "사라", "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔", "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정", "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 500000, // Wave 258 — 실제 LV organizer/card holder 시세 평균 (월릿 broad: 보레알리스 670k / 이클립스 530k / 모노그램 600k 등 → median ~500k)
    released: 2024,
    laneKey: "bag_lv_card_holder",
    defaultProductType: "card_holder", // Wave 258 — LV card holder/organizer 라인.
  },
  // Wave 258 (2026-05-20): Bottega Cassette Wallet 신설 — 사용자 직접 발견.
  //   pid 404983654 "카세트 카드지갑" / pid 408265628 "카세트 패러킷 반지갑" sku_id=NULL.
  //   기존 bag-bottega-cassette-mini (crossbody) 와 같은 comparable_key 묶임 → 시세 sample 오염.
  //   별도 SKU 신설 → product_type=wallet 분리 → 비교 매물 list 자동 분리.
  {
    id: "bag-bottega-cassette-wallet",
    brand: "Bottega Veneta",
    category: "bag",
    modelName: "Cassette Wallet (카드지갑/반지갑)",
    aliases: [],
    mustContain: [
      ["보테가", "bottega", "보테가베네타", "bottega veneta"],
      ["카세트", "cassette"],
      ["카드지갑", "카드 지갑", "반지갑", "지갑", "wallet", "월릿", "카드 홀더", "card holder", "카드케이스", "카드 케이스"],
    ],
    mustNotContain: [
      "크로스백", "카메라백", "백팩", "토트백", "숄더백", "미니백", "버킷백",
      "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔",
      "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정",
      "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 400000, // Wave 258 — 사용자 SQL sample: 카드지갑 270k / 패러킷 반지갑 440k / 보레알리스 430k → median ~400k
    released: 2024,
    laneKey: "bag_bottega_cassette_wallet",
    defaultProductType: "wallet",
  },
  // Wave 261 (2026-05-20): Prada Pocono Nylon Vintage broad — 사용자 SQL 발견 ~7건 매물 sku_id=NULL.
  //   포코노 빈티지 라인: 백팩 / 토트백 / 숄더백 / 미니 숄더 — 가격 280k-700k.
  //   기존 bag-prada-nylon-hobo-vintage 는 Hobo specific만 — 포코노 일반 라인 누락.
  {
    id: "bag-prada-pocono-vintage",
    brand: "Prada",
    category: "bag",
    modelName: "Prada Pocono Nylon Vintage (백팩/토트/숄더 broad)",
    aliases: [],
    mustContain: [
      ["프라다", "prada"],
      ["포코노", "pocono"],
    ],
    mustNotContain: [
      "호보", "hobo", "리에디션", "re-edition",
      "지갑", "wallet", "월렛", "카드지갑", "반지갑",
      "삽니다", "매입", "구합니다", "구해요", "구함",
      "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔",
      "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정",
      "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 500000, // Wave 261 — 사용자 SQL: 280k-700k median ~500k.
    released: 2024,
    laneKey: "bag_prada_pocono_vintage",
    // multi product_type (백팩/토트/숄더) — defaultProductType 안 박음. parser text 추출 의존.
  },
  // Wave 258: Gucci GG Marmont Matelasse Wallet 신설 — 사용자 발견 matelassé 카드지갑/반지갑.
  //   기존 bag-gucci-gg-marmont-mini (shoulder) / -camera 등 본품 SKU 와 별도 product_type.
  //   기존 bag-gucci-gg-supreme-card-wallet 은 supreme 라인만 — marmont 라인 누락.
  {
    id: "bag-gucci-marmont-wallet",
    brand: "Gucci",
    category: "bag",
    modelName: "GG Marmont Matelasse Wallet (카드지갑/반지갑)",
    aliases: [],
    mustContain: [
      ["구찌", "gucci"],
      ["마몽", "marmont", "마몬트", "마몽트"],
      ["카드지갑", "카드 지갑", "반지갑", "지갑", "wallet", "월릿", "카드 홀더", "card holder", "체인 카드", "마틀라세", "matelasse", "마틀라쎄"],
    ],
    mustNotContain: [
      "백팩", "크로스백", "숄더백", "토트백", "카메라백", "미니백", "벨트백",
      "탑핸들", "top handle",
      "넥타이핀", "키링", "키체인", "키링만", "스트랩 단품", "체인만", "장식만", "팁만", "스트로공", "벨트", "shoe", "신발", "의류", "옷", "반팔",
      "감정 가능", "감정 문의", "정가품 문의", "st급", "ST급", "레플리카", "복각", "정가품감정",
      "스트랩만", "더스트백만", "박스만", "보증서만", "감정 후 입금", "감정원", "감정사", "외관 부분만",
    ],
    msrpKrw: 500000, // Wave 258 — 사용자 SQL: 마몬트 카드지갑 280k~490k → median ~400k. 신상품 530k+ → msrp 500k.
    released: 2024,
    laneKey: "bag_gucci_marmont_wallet",
    defaultProductType: "wallet",
  },
];
