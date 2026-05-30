import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 712b (2026-05-23): bias-free agent 14+21 brand 검증 결과 일괄 신설.
//
// 의류 14 brand + 신발 21 brand bias-free agent 결과로 발견된 누락 SKU.
// 사용자 명시 "세분화 좋음, 한 번에 박아도 됨" — 큰 commit으로 진행.
//
// 각 SKU 풀 ≥5건 또는 p50 명확. 충돌 risk 없음 (별 brand/모델/콜라보).
// 기존 broad SKU와 narrow 충돌 가능성은 새 SKU의 mustNotContain으로 회피.
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품", "11급", "ss급정품", "1:1", "미러",
  "한짝", "한쪽만", "박스만", "삽니다", "구합니다", "매입",
] as const;

export const WAVE_712B_BIAS_FREE_SKUS: Sku[] = [
  // ============================================================================
  // ===== 의류 =====
  // ============================================================================

  // ─── Adidas 의류 collab (trefoil에서 분리) ───
  // Wave 716 (2026-05-23): 120x spread audit — 팀가이스트 후디 (~63만) 별도 신설 + 일반 트랙탑 (~10만) 분리.
  {
    id: "clothing-adidas-thugclub-collab",
    brand: "Adidas x Thug Club", category: "clothing", laneKey: "adidas_thugclub_collab",
    modelName: "Thug Club × Adidas (트랙탑/조거 — 팀가이스트 후디 제외)",
    aliases: ["Thug Club Adidas", "떠그클럽 아디다스"],
    mustContain: [["adidas", "아디다스"], ["thug club", "떠그클럽", "떠그 클럽"]],
    mustNotContain: [
      ...COMMON_NOISE, "superstar", "슈퍼스타", "스니커즈", "sneaker", "운동화",
      // Wave 716: 팀가이스트 후디 별도 narrow (가격 6배 차이)
      "팀가이스트 후드", "팀가이스트 후디", "team geist hoodie",
      "팀가이스트 레더", "team geist leather", "레더 후디",
      // 비-collab 아디다스 축구 매물 차단
      "수원삼성", "축구", "풋살", "아디컬러", "adicolor",
    ],
    msrpKrw: 100000, released: 2025,
  },
  // Wave 868: 팀가이스트 레더 자켓은 후디와 상품 타입/시세축이 달라 별도 held lane.
  {
    id: "clothing-thugclub-teamgeist-leather-jacket",
    brand: "Adidas x Thug Club", category: "clothing", laneKey: "thugclub_teamgeist_leather_jacket",
    modelName: "Thug Club × Adidas Team Geist Leather Jacket",
    aliases: ["Team Geist Leather Jacket", "팀가이스트 레더 자켓"],
    mustContain: [
      ["adidas", "아디다스", "떠그클럽", "thug club", "떠그 클럽", "팀가이스트", "team geist"],
      ["레더", "leather", "가죽"],
      ["자켓", "재킷", "jacket"],
    ],
    mustNotContain: [...COMMON_NOISE, "스니커즈", "sneaker", "운동화", "후드", "후디", "hoodie", "후드티"],
    msrpKrw: 630000, released: 2025,
  },
  // Wave 716: 팀가이스트 후디 별도 narrow (median 63만 — 일반 트랙탑 10만과 6배 차이).
  {
    id: "clothing-thugclub-teamgeist-hoodie",
    brand: "Adidas x Thug Club", category: "clothing", laneKey: "thugclub_teamgeist_hoodie",
    modelName: "Thug Club × Adidas Team Geist Hoodie",
    aliases: ["Team Geist Hoodie", "팀가이스트 후드"],
    mustContain: [
      ["떠그클럽", "thug club", "떠그 클럽", "팀가이스트", "team geist"],
      ["후드", "후디", "hoodie", "후드티"],
    ],
    mustNotContain: [...COMMON_NOISE, "스니커즈", "sneaker", "운동화", "레더 자켓", "레더자켓", "leather jacket", "가죽 자켓", "가죽자켓"],
    msrpKrw: 630000, released: 2025,
  },
  {
    id: "clothing-adidas-bape-collab",
    brand: "Adidas x BAPE", category: "clothing", laneKey: "adidas_bape_collab",
    modelName: "BAPE × Adidas (트랙수트/샤크후드/티 의류)",
    aliases: ["BAPE Adidas", "베이프 아디다스", "BAPE × Adidas", "샤크 아디다스"],
    // Wave 715 P0#2: 매칭 키워드 확장 (ape head, ape sta, 비에이프).
    mustContain: [
      ["adidas", "아디다스"],
      ["bape", "베이프", "비에이프", "샤크", "ape head", "에이프헤드", "ape sta", "베이프스타"],
    ],
    mustNotContain: [...COMMON_NOISE, "superstar", "슈퍼스타", "스니커즈", "sneaker", "운동화", "신발"],
    msrpKrw: 280000, released: 2024,
  },
  {
    id: "clothing-adidas-sftm-collab",
    brand: "Adidas x SFTM", category: "clothing", laneKey: "adidas_sftm_collab",
    modelName: "SFTM (Song For The Mute) × Adidas (자켓/팬츠/롱슬리브)",
    aliases: ["SFTM Adidas", "송포더뮤트 아디다스"],
    mustContain: [
      ["adidas", "아디다스"],
      ["sftm", "송포더뮤트", "song for the mute", "송 포 더 뮤트"],
      ["자켓", "재킷", "jacket", "팬츠", "pants", "바지", "롱슬리브", "long sleeve", "셔츠", "shirt", "티셔츠", "tee", "후드", "hoodie", "맨투맨", "sweat", "져지", "jersey", "트랙탑", "트랙 팬츠", "트랙팬츠"],
    ],
    mustNotContain: [...COMMON_NOISE, "country og", "superstar 82", "campus", "shadow turf", "컨트리", "adistar", "아디스타", "태권도화", "스니커즈", "운동화", "신발"],
    msrpKrw: 170000, released: 2024,
  },
  {
    id: "clothing-adidas-y3-collab",
    brand: "Adidas x Y-3", category: "clothing", laneKey: "adidas_y3_collab",
    modelName: "Y-3 (Yohji Yamamoto) × Adidas 의류",
    aliases: ["Y-3 Adidas", "요지 야마모토 아디다스", "야마모토 Y3"],
    mustContain: [["y-3", "y3", "요지", "yohji", "yamamoto", "야마모토"], ["아디다스", "adidas"]],
    mustNotContain: [
      ...COMMON_NOISE, "스니커즈", "sneaker", "sneakers", "운동화", "신발", "shoe", "shoes", "슈즈",
      // Wave 881: Y-3 shoe model titles often carry Yohji/Yamamoto/Adidas wording and were being absorbed by apparel.
      "qasa", "콰사", "콰사 하이", "qasa high", "qasa elle",
      "kaiwa", "카이와", "adios", "아디오스", "takumi", "타쿠미",
      "pureboost", "퓨어부스트", "runner 4d", "러너 4d", "4d runner", "zg knit", "zg-knit",
    ],
    msrpKrw: 200000, released: 2024,
  },
  {
    id: "clothing-adidas-fog-collab",
    brand: "Adidas x FOG", category: "clothing", laneKey: "adidas_fog_apparel",
    modelName: "Fear of God Athletics × Adidas 의류 (푸퍼/트랙/헤비플리스)",
    aliases: ["FOG Adidas", "피어오브갓 아디다스", "FG Athletics"],
    mustContain: [["adidas", "아디다스"], ["피어", "fog ", "fear of god", "피오갓", "fg athletics"]],
    mustNotContain: [...COMMON_NOISE, "essentials", "에센셜", "basketball", "86 lo", "86 hi", "스니커즈", "신발"],
    msrpKrw: 250000, released: 2024,
  },

  // ─── FOG Main Line 의류 (Essentials 아님, premium tier) ───
  // Wave 715 P0#3 (2026-05-23): 54x spread 해소. London Fog 25% 흡수 + Nike 콜라보 분리.
  {
    id: "clothing-fog-main-jacket",
    brand: "Fear of God Main", category: "clothing", laneKey: "fog_main_jacket",
    modelName: "Fear of God Main Line 자켓/봄버/코트 (3rd~8th 시즌, Eternal, California)",
    aliases: ["FoG Jacket", "피어오브갓 자켓", "Eternal Bomber", "이터널"],
    mustContain: [
      ["피어오브갓", "피오갓", "fear of god", "fog "],
      ["자켓", "재킷", "jacket", "봄버", "bomber", "블루종", "코트", "coat"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "essentials", "에센셜", "1977",
      // Wave 715 P0#3: London Fog (다른 brand) 25% 흡수 차단.
      "london fog", "런던포그", "런던 포그", "lonfo",
      // Wave 715: Nike × FOG 콜라보 분리 (별도 SKU).
      "nike", "나이키", "에어 피어", "air fear", "air fog", "warm up", "웜업",
      // Wave 715: Adidas × FOG athletics 분리.
      "adidas", "아디다스", "fg athletics", "에프지", "fg-1",
      // Wave 715: Zegna × FOG 콜라보 차단 (premium suit, 100~200만 outlier).
      "zegna", "제냐", "에르메네질도",
      // Wave 715: 럭셔리 매장 RTW 차단.
      "barneys", "바니스",
      // Wave 750 bias-free (2026-05-24): false positive 추가 발견.
      "mountain fog", "마운틴 포그", "마운틴포그",  // Mountain Fog brand (별 brand)
      "notes from he", "notes from",  // Notes from He brand
      "리본 포그", "ribbon fog",  // false brand
      "nfl",  // NFL 라이센스
      // 시즌/한정 라인 outlier (Main Line 내 시세 다양 — Eternal 시그니처는 별 시세군)
      "이터널", "eternal", "eternal collection",  // Eternal premium (700k-1M)
      "애슬래틱 푸퍼", "athletic puffer",  // Athletic Puffer 시그니처
      "센스x", "센스 x", "sense x",  // 4th 센스 collab
      // Wave 812: sample audit found broad material/season outliers in this lane.
      "5th", "6th", "8th", "라이더", "rider", "스웨이드", "suede",
      "퍼자켓", "퍼 자켓", "fur jacket", "fur", "쉐르파", "sherpa",
      "데님 자켓", "데님재킷", "트러커", "trucker", "초어", "chore",
    ],
    msrpKrw: 800000, released: 2018,
  },
  {
    id: "clothing-fog-main-pants",
    brand: "Fear of God Main", category: "clothing", laneKey: "fog_main_pants",
    modelName: "Fear of God Main Line 팬츠 (옥스포드/주짓수/카고/스웻팬츠)",
    aliases: ["FoG Pants", "피어오브갓 팬츠"],
    mustContain: [
      ["피어오브갓", "피오갓", "fear of god", "fog "],
      ["팬츠", "pants", "바지", "조거", "스웻팬츠", "카고", "주짓수", "옥스포드"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "essentials", "에센셜", "1977",
      // Wave 715 P0#4: 같은 noise pattern.
      "london fog", "런던포그", "런던 포그", "lonfo",
      "nike", "나이키", "에어 피어", "air fear", "warm up", "웜업",
      "adidas", "아디다스", "fg athletics", "에프지", "fg-1",
      "zegna", "제냐",
    ],
    msrpKrw: 550000, released: 2018,
  },
  // Wave 715 P0#3: Nike × Fear of God 의류 콜라보 별도 SKU 신설 (warm up jacket / hoodie 가격 다름).
  {
    id: "clothing-nike-fog-collab",
    brand: "Nike x Fear of God", category: "clothing", laneKey: "nike_fog_apparel_collab",
    modelName: "Nike × Fear of God 의류 콜라보 (Warm Up Jacket / Hoodie / Pants)",
    aliases: ["Nike FOG Apparel", "나이키 피어오브갓", "Nike Fear of God"],
    mustContain: [
      ["nike", "나이키"],
      ["피어오브갓", "피오갓", "fear of god", "fog "],
      ["warm up", "warmup", "웜업", "윔업", "후드", "hoodie", "후디", "자켓", "재킷", "jacket", "팬츠", "pants", "바지", "쇼츠", "shorts", "반바지"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "essentials", "에센셜",
      // 신발 차단
      "스니커즈", "sneaker", "운동화", "신발", "air fear of god 1",
      // London Fog 차단
      "london fog", "런던포그",
    ],
    msrpKrw: 350000, released: 2019,
  },
  {
    id: "clothing-fog-main-tee",
    brand: "Fear of God Main", category: "clothing", laneKey: "fog_main_tee",
    modelName: "Fear of God Main Line 티셔츠/롱슬리브",
    aliases: ["FoG Tee", "피어오브갓 티"],
    mustContain: [
      ["피어오브갓", "피오갓", "fear of god", "fog "],
      ["티셔츠", "반팔", "tee ", "롱슬리브", "long sleeve"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "essentials", "에센셜", "1977",
      // Wave 812: jacket/material wording must not fall through to tee via description noise.
      "자켓", "재킷", "jacket", "봄버", "bomber", "블루종", "코트", "coat",
      "트러커", "trucker", "스웨이드", "suede", "퍼자켓", "fur jacket", "쉐르파", "sherpa",
    ],
    msrpKrw: 370000, released: 2018,
  },
  {
    id: "clothing-fog-main-hoodie",
    brand: "Fear of God Main", category: "clothing", laneKey: "fog_main_hoodie",
    modelName: "Fear of God Main Line 후드",
    aliases: ["FoG Hoodie", "피어오브갓 후드"],
    mustContain: [
      ["피어오브갓", "피오갓", "fear of god", "fog "],
      ["후드", "hoodie", "후디"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "essentials", "에센셜", "1977",
      // Wave 812: jacket/material wording must stay out of the hoodie lane.
      "자켓", "재킷", "jacket", "봄버", "bomber", "블루종", "코트", "coat",
      "트러커", "trucker", "스웨이드", "suede", "퍼자켓", "fur jacket", "쉐르파", "sherpa",
    ],
    msrpKrw: 430000, released: 2018,
  },

  // ─── Polo Ralph Lauren 누락 카테고리 ───
  {
    id: "clothing-polo-shirt-pattern",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_shirt_pattern",
    modelName: "Polo 패턴 셔츠 (체크/스트라이프/깅엄/플란넬/페이즐리/하와이안)",
    aliases: ["Polo Shirt", "폴로 체크 셔츠", "폴로 플란넬", "폴로 하와이안"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌"],
      ["체크 셔츠", "체크셔츠", "스트라이프 셔츠", "깅엄", "플란넬", "flannel", "페이즐리", "paisley", "하와이안", "마드라스"],
    ],
    // Wave 800 (2026-05-24) Phase 2: 68x audit — 블레이저/금장 등 별 product type 차단.
    mustNotContain: [...COMMON_NOISE, "RRL", "purple label", "퍼플라벨", "옥스포드", "oxford", "polo bear",
      "라코스테", "lacoste", "타미힐피거", "tommy", "유니클로", "나이키", "아디다스", "버버리", "fendi", "디올",
      "rlx", "j.lindeberg", "마크앤로나", "waac", "u.s. polo", "us polo", "디스커버리", "내셔널지오그래픽",
      // 별 product type
      "블레이저", "blazer", "재킷", "자켓",
      "도스킨", "doeskin", "울 플란넬 블레이저", "wool flannel blazer",
      // Patchwork flannel shirts are still a shirt-pattern lane; jacket/blazer tokens above keep outerwear out.
      "리미티드", "limited", "한정 셔츠",
      "금장", "gold button",
    ],
    msrpKrw: 159000, released: 2018,
  },
  {
    id: "clothing-polo-sweatshirt-crewneck",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_sweatshirt_crewneck",
    modelName: "Polo 맨투맨/스웻셔츠/크루넥",
    aliases: ["Polo Sweatshirt", "폴로 맨투맨", "폴로 크루넥"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌"],
      ["맨투맨", "스웻셔츠", "sweatshirt", "크루넥", "crewneck"],
    ],
    mustNotContain: [...COMMON_NOISE, "RRL", "purple label", "퍼플라벨", "polo bear", "후드", "hoodie",
      "라코스테", "lacoste", "타미힐피거", "유니클로", "나이키", "아디다스", "버버리", "rlx"],
    msrpKrw: 199000, released: 2018,
  },
  {
    id: "clothing-polo-knit-sweater",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_knit_sweater",
    modelName: "Polo 니트/케이블/꽈배기/V넥/롤넥/페어아일",
    aliases: ["Polo Knit", "폴로 니트", "폴로 케이블", "폴로 꽈배기"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌"],
      ["니트", "knit", "스웨터", "sweater", "케이블", "cable", "꽈배기", "v넥", "롤넥", "페어아일", "fair isle"],
    ],
    // Wave 800 (2026-05-24) Phase 2: 95x spread — 다른 brand "polo 니트" generic 차단.
    // Wave 764 (2026-05-24): 보세/sub-brand polo knit 추가 차단 — 사용자 #4 보고.
    //   "마론에디션 25 blue stripe polo knit" / "벨리에 홀가먼트 폴로 니트" / "투티/A9 폴로 진스 컴퍼니" → polo_knit_sweater 흡수.
    mustNotContain: [...COMMON_NOISE, "RRL", "purple label", "퍼플라벨", "polo bear", "베어", "라코스테", "타미힐피거", "rlx",
      // Other brand polo collar knits (false match)
      "믹쏘", "mixxo", "자라", "zara", "wolsey", "월시", "월시폴로",
      "poszer", "포저", "스파오", "유니클로", "uniqlo", "에잇세컨즈",
      "cos", "코스", "솔리드옴므", "솔리드 옴므", "solid homme",
      "나이키", "nike", "아디다스", "adidas", "클롯", "clot",
      "더 니트 컴퍼니", "the knit company", "인더로우", "in the row",
      "라벨 아카이브", "label archive", "브룩스브라더스", "brooks brothers",
      "챕스", "chaps", "마르니", "marni", "럭비 랄프로렌", "rugby ralph lauren",
      "로렌 랄프로렌", "lauren ralph lauren",
      // Wave 764: 한국 보세/sub-brand 추가 (사용자 #4 audit 발견).
      "마론에디션", "마롱에디션", "maron edition", "에스피오나지", "espionage",
      "벨리에", "vellie", "ballier", "벨리어", "투티", "투티에이나인", "tuti a9", "투티/a9", "투티a9",
      "빈폴", "beanpole", "시스템", "system", "타임", "time", "에피그램", "epigram",
      "코오롱스포츠", "kolon sport", "kolon", "k2", "아미", "ami",
      "스튜디오 톰보이", "톰보이", "studio tomboy", "tomboy",
      "잭니클라우스", "jack nicklaus", "유타", "utar",
      "dancing skeletons", "dancing skeleton",
      // Wave 766 (2026-05-24): polo jeans / polo sport sub-line 변형 보강 + 더 많은 보세 brand.
      "polo 진스 컴퍼니", "폴로 진스 컴퍼니", "polo jeans company",
      "폴로진스", "폴로(polo)진스", "polo)진스", "polo jeans", "폴로 진스", "polo sport", "폴로 스포츠",
      "걸즈", "girls", "보이즈", "boys", "주니어", "youth",
      "z pattern", "z패턴", "zpattern",
      "얀13", "yan13", "오일릴리", "오일 릴리", "oilily", "지컷", "g cut", "g-cut", "듀엘", "duel",
      "그레일즈", "grailz", "g sports", "g-sports", "gsports",
      // 캐시미어 100% 별도 라인 (top tier) — Wave 766: 순서 변형 추가.
      "캐시미어 100", "100프로 캐시미어", "100% cashmere", "캐시미어 100프로", "캐시미어100", "100캐시미어",
      "나바호 핸드니트", "navajo handknit",  // Polo Country 한정
      // Wave 810b (2026-05-30): 다른 라인/직조 차단 — owner case 발견:
      //   "폴로 랄프로렌 케이블 니트 S 퍼플" (₩80K) 의 비교 매물로
      //   "폴로 랄프로렌 메쉬 니트 코튼 쿼터집 스웨터 M" (₩130K) 들어옴.
      //   "메쉬" vs "케이블" = 다른 직조 + "쿼터집/하프집업" = 다른 product type.
      //   가격대 다 다름 → 같은 SKU 묶이면 시세 왜곡.
      "메쉬 니트", "메쉬니트", "mesh knit",  // 다른 직조
      "쿼터집", "쿼터 집", "쿼터집업", "쿼터 집업", "quarter zip",  // 하프집업과 별도 type
      "하프집업", "하프 집업", "half zip", "halfzip", "1/2 zip",
      "풀집업", "풀 집업", "full zip", "full-zip",
      "집업 니트", "집업니트", "zip-up knit",
      "후드 니트", "후드니트", "hood knit", "hooded knit",  // 후드 변형
      "터틀넥", "turtleneck", "turtle neck",  // 시세 다름 (롤넥과 비슷하지만 명시)
    ],
    msrpKrw: 219000, released: 2018,
  },
  {
    id: "clothing-polo-pants-chino",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_pants_chino",
    modelName: "Polo 치노/슬랙스/와이드/카고/코듀로이",
    aliases: ["Polo Chino", "폴로 치노", "폴로 슬랙스"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌"],
      ["치노", "chino", "슬랙스", "slacks", "와이드", "카고", "cargo", "코듀로이", "corduroy"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "RRL", "purple label", "퍼플라벨", "polo bear", "라코스테", "타미힐피거", "rlx",
      // Wave 816: cap/jacket/shorts polluted chino pants samples.
      "모자", "캡", "볼캡", "baseball cap", "베이스 볼 캡", "베이스볼캡", "cap", "hat",
      "자켓", "재킷", "jacket", "치노자켓", "치노 자켓",
      "셔츠", "shirt", "오버셔츠", "오버 셔츠",
      "반바지", "하프 팬츠", "하프팬츠", "쇼츠", "shorts",
    ],
    msrpKrw: 179000, released: 2018,
  },
  {
    id: "clothing-polo-purple-label",
    brand: "Polo Purple Label", category: "clothing", laneKey: "polo_purple_label",
    modelName: "Polo Purple Label (top tier — cashmere/wool/silk)",
    aliases: ["Purple Label", "퍼플라벨", "퍼플 라벨"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌"],
      ["퍼플라벨", "purple label", "퍼플 라벨"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "RRL", "polo bear", "rlx", "라코스테",
      // Wave 716 (2026-05-23): 42x spread audit — accessory + low-detail 매물 차단.
      // 넥타이 12만은 의류 아님 (accessory 별 시세군).
      "넥타이", "넥 타이", "tie ", "necktie",
      "벨트", "belt", "지갑", "wallet", "월렛",
      "포켓치프", "pocket square", "행커치프",
      "양말", "socks", "스카프", "scarf", "머플러", "muffler",
      "모자", "cap", "헷", "베레모", "fedora", "페도라",
      "안경", "선글라스", "sunglasses", "glasses",
      "쿠션", "타올", "수건", "베개", "이불",
    ],
    msrpKrw: 990000, released: 2018,
  },
  {
    id: "clothing-polo-sport-90s",
    brand: "Polo Sport", category: "clothing", laneKey: "polo_sport_90s",
    modelName: "Polo Sport (90s vintage athletic 라인)",
    aliases: ["Polo Sport", "폴로 스포츠"],
    mustContain: [
      ["폴로 스포츠", "polo sport"],
    ],
    mustNotContain: [...COMMON_NOISE, "RRL", "purple label", "polo bear"],
    msrpKrw: 220000, released: 1995,
  },
  {
    id: "clothing-polo-rlx-golf",
    brand: "Polo RLX", category: "clothing", laneKey: "polo_rlx_golf",
    modelName: "Polo RLX Golf 라인",
    aliases: ["Polo RLX", "RLX 골프"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌"],
      ["rlx", "rlx 골프", "rlx polo"],
    ],
    mustNotContain: [...COMMON_NOISE, "RRL", "purple label", "polo bear"],
    msrpKrw: 159000, released: 2010,
  },

  // ─── Polo Chief Keef Stadium ───
  // Wave 715 P0#1 (2026-05-23): 132x spread → modern Chief Keef vs vintage 1992 OG 분리.
  // 기존 SKU = modern 치프키프 빅포니 PK 카라티 (~30건, p50 5만) narrow.
  // vintage 1992 Polo Stadium OG (~10건, p50 100만) 신설.
  {
    id: "clothing-polo-chiefkeef-modern",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_chiefkeef_stadium",
    modelName: "Polo Chief Keef Big Pony (modern graphic PK 카라티)",
    aliases: ["Chief Keef Polo", "치프키프", "Polo P-Wing", "빅포니"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌"],
      ["치프키프", "chief keef", "p-wing", "p wing", "빅포니"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "RRL", "purple label", "polo bear",
      // Wave 715: vintage 1992 OG 흡수 차단
      "1992", "1993", "1990", "1991", "vintage og", "stadium og", "올드", "vintage", "빈티지",
      "90s", "90's", "y2k", "00s",
    ],
    msrpKrw: 290000, released: 2014,
  },
  // Wave 715 P0#1: vintage 1992 OG Polo Stadium 별도 SKU 신설
  {
    id: "clothing-polo-stadium-1992-og",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_stadium_1992_og",
    modelName: "Polo Stadium 1992 OG (vintage archive Stadium line)",
    aliases: ["Polo Stadium 1992", "Stadium OG", "P-Wing Vintage", "폴로 스타디움 빈티지"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌"],
      ["stadium", "스타디움"],
      ["1992", "1993", "1990", "1991", "vintage", "빈티지", "올드", "og", "archive", "아카이브"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "RRL", "purple label", "polo bear",
      // modern Chief Keef 흡수 차단
      "치프키프", "chief keef", "빅포니",
      "리프로", "reproduction", "복각", "rep",
    ],
    msrpKrw: 290000, released: 1992,
  },

  // ─── Stone Island sub-line 3개 ───
  {
    id: "clothing-stone-island-shadow-project",
    brand: "Stone Island Shadow Project", category: "clothing", laneKey: "stone_island_shadow_project",
    modelName: "Stone Island Shadow Project (premium DPM/Marina)",
    aliases: ["Stone Island Shadow", "스톤아일랜드 쉐도우", "Shadow Project"],
    mustContain: [["stone island", "스톤아일랜드"], ["shadow project", "쉐도우 프로젝트", "쉐도우프로젝트", "쉐도우", "섀도우", "shadow"]],
    mustNotContain: [...COMMON_NOISE, "ghost piece", "고스트", "supreme", "슈프림"],
    msrpKrw: 590000, minPriceKrw: 100000, released: 2008,  // Wave 768: Stone Island Shadow premium floor
  },
  {
    id: "clothing-stone-island-ghost-piece",
    brand: "Stone Island Ghost Piece", category: "clothing", laneKey: "stone_island_ghost_piece",
    modelName: "Stone Island Ghost Piece (premium minimalist)",
    aliases: ["Stone Island Ghost", "스톤아일랜드 고스트"],
    mustContain: [["stone island", "스톤아일랜드"], ["ghost piece", "고스트 피스", "고스트피스", "ghost"]],
    mustNotContain: [...COMMON_NOISE, "shadow project", "쉐도우"],
    msrpKrw: 390000, minPriceKrw: 80000, released: 2010,  // Wave 768: Stone Island Ghost Piece floor
  },
  {
    id: "clothing-stone-island-crinkle-reps",
    brand: "Stone Island", category: "clothing", laneKey: "stone_island_crinkle_reps",
    modelName: "Stone Island Crinkle Reps (패딩/자켓 시그니처 패브릭)",
    aliases: ["Crinkle Reps", "크링클랩스", "크링클 랩스"],
    mustContain: [["stone island", "스톤아일랜드"], ["crinkle reps", "크링클랩스", "크링클 랩스", "crinkle"]],
    mustNotContain: [...COMMON_NOISE, "shadow project", "쉐도우", "supreme", "슈프림"],
    msrpKrw: 690000, minPriceKrw: 100000, released: 2015,  // Wave 768: Stone Island Crinkle Reps floor
  },
  {
    id: "clothing-stone-island-overshirt",
    brand: "Stone Island", category: "clothing", laneKey: "stone_island_overshirt",
    modelName: "Stone Island Overshirt / Nylon Metal / Old Effect",
    aliases: ["Stone Island Overshirt", "스톤아일랜드 오버셔츠", "Stone Island Nylon Metal"],
    mustContain: [
      ["stone island", "스톤아일랜드", "스톤 아일랜드"],
      ["오버셔츠", "오버 셔츠", "overshirt", "나일론메탈", "나일론 메탈", "nylon metal", "올드이펙트", "올드 이펙트", "올드이팩트", "올드 이팩트", "old effect", "스트레치 코튼 트윌"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "shadow project", "쉐도우 프로젝트", "쉐도우프로젝트",
      "ghost piece", "고스트 피스", "고스트피스",
      "크링클랩스", "크링클 랩스", "crinkle reps", "crinkle",
      "패딩", "다운", "down", "puffer", "베스트", "vest", "조끼",
      "팬츠", "바지", "조거", "트랙팬츠", "카고", "pants", "trousers", "jogger", "cargo",
    ],
    msrpKrw: 590000, minPriceKrw: 100000, released: 2018,
    defaultProductType: "shirt",
  },

  // ─── Arc'teryx 누락 ───
  {
    id: "clothing-arcteryx-down",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_down",
    modelName: "Arc'teryx Down 자켓 (Cerium / Thorium / Nuclei / Therma SV)",
    aliases: ["Arc'teryx Down", "아크테릭스 다운", "세륨", "토륨", "Cerium"],
    mustContain: [
      ["arcteryx", "arc'teryx", "아크테릭스"],
      ["cerium", "세륨", "세리움", "thorium", "토륨", "쏘리움", "소리움", "nuclei", "누클리아이", "뉴클리", "therma", "써마"],
    ],
    mustNotContain: [...COMMON_NOISE, "leaf", "veilance", "beams"],
    msrpKrw: 590000, released: 2018,
  },

  // ─── BAPE × Adidas collab (의류 신설) ───
  {
    id: "clothing-bape-adidas-collab",
    brand: "BAPE x Adidas", category: "clothing", laneKey: "bape_adidas_collab",
    modelName: "BAPE × Adidas 의류 (트랙수트/샤크후드/티)",
    aliases: ["BAPE Adidas", "베이프 아디다스"],
    mustContain: [["bape", "베이프", "a bathing ape"], ["adidas", "아디다스"]],
    mustNotContain: [...COMMON_NOISE, "스니커즈", "sneaker", "운동화", "신발"],
    msrpKrw: 280000, released: 2003,
  },

  // ─── BAPE 누락 카테고리 ───
  {
    id: "clothing-bape-longsleeve",
    brand: "BAPE", category: "clothing", laneKey: "bape_longsleeve",
    modelName: "BAPE 롱슬리브 (FW 시즌)",
    aliases: ["BAPE Long Sleeve", "베이프 롱슬리브"],
    mustContain: [["bape", "베이프"], ["롱슬리브", "long sleeve", "long-sleeve"]],
    mustNotContain: [...COMMON_NOISE, "후드", "hoodie", "맨투맨", "반팔", "tee "],
    msrpKrw: 220000, released: 2018,
  },
  {
    id: "bag-bape-backpack",
    brand: "BAPE", category: "bag", laneKey: "bape_backpack",
    modelName: "BAPE 백팩/메신저/슬링백",
    aliases: ["BAPE Backpack", "베이프 백팩"],
    mustContain: [["bape", "베이프"], ["백팩", "backpack", "메신저", "messenger", "슬링"]],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 199000, released: 2018,
  },

  // ─── North Face 누락 ───
  {
    id: "clothing-tnf-white-label-novelty",
    brand: "The North Face White Label", category: "clothing", laneKey: "tnf_white_label_novelty",
    modelName: "TNF White Label / Novelty (한국 단독 라인 다운)",
    aliases: ["TNF Novelty", "TNF 화이트라벨", "노벨티 눕시"],
    mustContain: [["north face", "northface", "노스페이스", "노페", "tnf"], ["화이트라벨", "white label", "novelty", "노벨티"]],
    mustNotContain: [...COMMON_NOISE, "purple label", "퍼플라벨"],
    msrpKrw: 390000, released: 2011,
  },
  {
    id: "clothing-tnf-steep-tech-original",
    brand: "The North Face", category: "clothing", laneKey: "tnf_steep_tech_original",
    modelName: "TNF Steep Tech (Original 1989 헤리티지, Supreme 콜라보 아님)",
    aliases: ["TNF Steep Tech", "스팁테크"],
    mustContain: [["north face", "northface", "노스페이스", "tnf"], ["steep tech", "스팁테크", "스팁 테크"]],
    mustNotContain: [...COMMON_NOISE, "supreme", "슈프림"],
    msrpKrw: 590000, released: 1989,
  },

  // ─── Stussy 모델 시리즈 신설 ───
  {
    id: "clothing-stussy-8ball-hoodie",
    brand: "Stussy", category: "clothing", laneKey: "stussy_8ball_hoodie",
    modelName: "Stussy 8 Ball 후드/zip (시그니처)",
    aliases: ["Stussy 8 Ball Hoodie", "스투시 8볼 후드", "에잇볼 후드"],
    mustContain: [["stussy", "스투시", "stüssy"], ["8 ball", "8ball", "8볼", "에잇볼", "당구공"], ["후드", "hoodie", "후디", "zip"]],
    mustNotContain: [...COMMON_NOISE, "nike", "dior", "cpfm", "born x raised", "마크 제이콥스"],
    msrpKrw: 170000, released: 2015,
  },
  {
    id: "clothing-stussy-world-tour-tee",
    brand: "Stussy", category: "clothing", laneKey: "stussy_world_tour_tee",
    modelName: "Stussy World Tour Tee (DSM/도쿄/뉴욕)",
    aliases: ["Stussy World Tour", "월드투어 티"],
    mustContain: [["stussy", "스투시", "stüssy"], ["월드투어", "world tour"], ["반팔", "티셔츠", "tee ", "t-shirt"]],
    mustNotContain: [...COMMON_NOISE, "후드", "hoodie", "맨투맨", "nike"],
    msrpKrw: 73000, released: 2010,
  },
  // Wave 716 (2026-05-23): 이름과 데이터 mismatch — 76% tees in this lane. Rename to Tee + 봄버/후디 차단.
  {
    id: "clothing-stussy-pigment-dye-hoodie",
    brand: "Stussy", category: "clothing", laneKey: "stussy_pigment_dye_hoodie",
    modelName: "Stussy Pigment Dye Tee (~7만 — 76% 매칭이 티셔츠)",
    aliases: ["Stussy Pigment Dye Tee", "스투시 피그먼트 티", "피그먼트 다이드 티"],
    mustContain: [
      ["stussy", "스투시", "stüssy"],
      ["피그먼트", "pigment", "다이드", "dyed", "디키"],
    ],
    mustNotContain: [
      ...COMMON_NOISE, "nike",
      // Wave 716: hoodie/bomber 별 SKU (가격 ~13만/40만)
      "후드", "후디", "hoodie", "후드티",
      "봄버", "bomber", "봄버자켓",
      "자켓", "재킷", "jacket",
      // Wave 800 (2026-05-24) Phase 2: 324x spread — Martin Rose collab + dyed bomber 차단.
      "martin rose", "마틴 로즈", "마틴로즈",
      "아워레가시", "아워 레가시", "ourlegacy", "our legacy",
      "돌리", "dolly", "blush pink",
      "8볼", "8 ball", "8ball", "에잇볼",
      "stussy dyed nylon", "dyed nylon bomber",  // 다른 product type (bomber jacket)
      "올리브", "olive",  // dyed nylon olive bomber 시그니처
    ],
    msrpKrw: 70000, released: 2020,
  },

  // ─── Stussy × Nike Spiridon / AF1 Mid sub-model ───
  {
    id: "shoe-stussy-nike-spiridon",
    brand: "Stussy x Nike", category: "shoe", laneKey: "stussy_nike_spiridon",
    modelName: "Nike × Stussy Air Zoom Spiridon Cage 2",
    aliases: ["Stussy Spiridon", "스피리돈", "Stussy x Nike Spiridon"],
    mustContain: [["nike", "나이키"], ["stussy", "스투시", "나투시"], ["spiridon", "스피리돈"]],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 290000, released: 2020,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-stussy-nike-af1-mid",
    brand: "Stussy x Nike", category: "shoe", laneKey: "stussy_nike_af1_mid",
    modelName: "Nike × Stussy Air Force 1 Mid (Black/Fossil)",
    aliases: ["Stussy AF1 Mid", "스투시 에어포스 미드", "Stussy Force Mid"],
    mustContain: [["nike", "나이키"], ["stussy", "스투시", "나투시"], ["af1", "에어포스", "air force 1", "force 1"], ["mid", "미드"]],
    mustNotContain: [...COMMON_NOISE, "low", "로우"],
    msrpKrw: 199000, released: 2022,
    defaultProductType: "sneaker",
  },

  // ─── CDG x Junya 의류 ───
  {
    id: "clothing-junya-watanabe-apparel-broad",
    brand: "Junya Watanabe", category: "clothing", laneKey: "junya_watanabe_apparel",
    modelName: "Junya Watanabe 의류 broad (팬츠/자켓/스커트/원피스/모자)",
    aliases: ["Junya Watanabe", "준야 와타나베", "준야"],
    mustContain: [["junya", "준야", "와타나베", "watanabe"]],
    mustNotContain: [
      ...COMMON_NOISE, "스니커즈", "sneaker", "운동화", "신발", "574", "nb",
      // Wave 716 (2026-05-23): 41x spread → collab narrow 분리.
      "carhartt", "칼하트",
      "levi", "리바이스", "리바이",
      "cp company", "c.p. company", "씨피컴퍼니", "씨피 컴퍼니",
      "brooks brothers", "브룩스브라더스", "브룩스 브라더스",
      "베르베르진", "vere", "자미로콰이", "jamiroquai",
      "carimor", "karimor", "카리모어",  // Junya × Karimor
      "newmanual", "뉴매뉴얼", "new manual",
      // Wave 800 (2026-05-24) bias-free Phase 1: 베이츠 / m65 파카 / by cdg 더블코트 차단.
      "bates", "베이츠",  // Junya × Bates 가죽 라이더 (3.2M)
      "m65 파카", "m65파카", "m-65 파카", "m65 jacket",  // Junya × CP M65
      "by cdg", "by 꼼데", "junya watanabe by",  // CDG sub-line (별도 시세군 2M+)
      "더블코트", "double coat", "싱글코트", "single coat",  // 코트 sub-lines
      "해외발송", "직배송",  // overseas-listing pattern (가격 부풀려짐)
    ],
    msrpKrw: 590000, released: 2018,
  },

  // ─── CDG x Converse broad ───
  {
    id: "shoe-cdg-converse-chuck70-broad",
    brand: "CDG x Converse", category: "shoe", laneKey: "cdg_converse_chuck70_broad",
    modelName: "CDG Play × Converse Chuck 70 / Jack Purcell / One Star (broad)",
    aliases: ["CDG Converse", "꼼데 컨버스", "CDG Play Converse"],
    mustContain: [["꼼데", "cdg", "comme des", "comme des garcons"], ["컨버스", "converse"]],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 140000, released: 2014,
    defaultProductType: "sneaker",
  },

  // ─── NB collab 누락 ───
  {
    id: "shoe-newbalance-thisisneverthat-collab",
    brand: "NB x This Is Never That", category: "shoe", laneKey: "nb_thisisneverthat_collab",
    modelName: "NB × This Is Never That (디스이즈네버댓)",
    aliases: ["NB TINT", "디스이즈네버댓 뉴발란스", "디네댓 NB"],
    mustContain: [["new balance", "newbalance", "뉴발란스", "뉴발", "nb"], ["디스이즈네버댓", "디네댓", "this is never that", "tint"]],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 250000, released: 2019,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-newbalance-salehe-collab",
    brand: "NB x Salehe Bembury", category: "shoe", laneKey: "nb_salehe_collab",
    modelName: "NB × Salehe Bembury (2002R/992 한정)",
    aliases: ["NB Salehe", "살레헤 뉴발란스"],
    mustContain: [["new balance", "newbalance", "뉴발란스", "뉴발", "nb"], ["살레헤", "salehe", "벰버리", "bembury"]],
    mustNotContain: [
      ...COMMON_NOISE,
      "캡", "cap", "모자", "hat", "볼캡", "ball cap", "메쉬캡", "트러커캡",
      "티셔츠", "tee", "후드", "hoodie", "맨투맨", "자켓", "jacket", "가방", "bag",
    ],
    msrpKrw: 290000, released: 2023,
    defaultProductType: "sneaker",
  },

  // ============================================================================
  // ===== 신발 =====
  // ============================================================================

  // ─── Onitsuka Tiger (Asics와 분리, 185건/30d) ───
  {
    id: "shoe-onitsuka-mexico-66",
    brand: "Onitsuka Tiger", category: "shoe", laneKey: "onitsuka_mexico_66",
    modelName: "Onitsuka Tiger Mexico 66 (Slip-on/SD/VIN/Sabot/Mary Jane)",
    aliases: ["Onitsuka Mexico 66", "오니츠카 멕시코 66", "Mexico 66"],
    mustContain: [
      ["onitsuka", "오니츠카", "오니츠카타이거", "오니츠카티이거", "오니츠카카이거"],
      ["mexico", "멕시코", "맥시코", "오니츠카타이거 66", "오니츠카 66", "onitsuka 66"],
    ],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 119000, released: 1966,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-onitsuka-broad",
    brand: "Onitsuka Tiger", category: "shoe", laneKey: "onitsuka_broad",
    modelName: "Onitsuka Tiger broad (Tokuten/Serrano/EDR78/Colorado 85/Corsair/Runspark)",
    aliases: ["Onitsuka Tiger", "오니츠카 타이거"],
    mustContain: [["onitsuka", "오니츠카", "오니츠카타이거", "오니츠카티이거"]],
    mustNotContain: [...COMMON_NOISE, "mexico 66", "멕시코 66", "맥시코66"],
    msrpKrw: 119000, released: 1949,
    defaultProductType: "sneaker",
  },

  // ─── AF1 LV8 sub-line (Wave 696 누락) ───
  {
    id: "shoe-nike-af1-lv8-low",
    brand: "Nike", category: "shoe", laneKey: "nike_af1_lv8_low",
    modelName: "Nike AF1 Low '07 LV8 sub-series (NBA/Athletic Club/한글날/Independence Day)",
    aliases: ["AF1 LV8", "에어포스1 LV8", "별포스"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "af1"],
      ["lv8", "lv 8", "lv-8", "별포스", "한글날", "hangeul", "독립기념일", "independence day", "40주년", "athletic club"],
    ],
    mustNotContain: [...COMMON_NOISE, "루이비통", "louis vuitton", "virgil"],
    msrpKrw: 159000, minPriceKrw: 50000, released: 2014,  // Wave 768: AF1 LV8 collab 가품 floor (16K outlier 차단)
    defaultProductType: "sneaker",
  },

  // ─── Dunk Low 누락 — Tune Squad / Cacao Wow / UNDEFEATED ───
  {
    id: "shoe-nike-af1-tune-squad",
    brand: "Nike", category: "shoe", laneKey: "nike_af1_tune_squad",
    modelName: "Nike AF1 × Space Jam Tune Squad (트와일라잇 마쉬/튠)",
    aliases: ["AF1 Tune Squad", "에어포스 튠 스쿼드", "트와일라잇 마쉬"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "af1"],
      ["튠", "tune squad", "트와일라잇 마쉬", "looney tunes", "스페이스 잼", "space jam"],
    ],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 200000, released: 2021,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-af1-undefeated",
    brand: "Nike", category: "shoe", laneKey: "nike_af1_undefeated",
    modelName: "Nike AF1 × UNDEFEATED (언디핏/우방)",
    aliases: ["AF1 UNDEFEATED", "에어포스 언디핏", "에어포스 우방"],
    mustContain: [["에어포스 1", "에어포스1", "air force 1", "af1"], ["undefeated", "언디핏", "우방"]],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 250000, released: 2020,
    defaultProductType: "sneaker",
  },

  // ─── Salomon 누락 핵심 ───
  {
    id: "shoe-salomon-rx-slide-3",
    brand: "Salomon", category: "shoe", laneKey: "salomon_rx_slide_3",
    modelName: "Salomon RX Slide 3.0 (시그니처 슬리퍼)",
    aliases: ["Salomon RX Slide", "살로몬 RX 슬라이드", "RX 슬라이즈"],
    mustContain: [["salomon", "살로몬"], ["rx slide", "rx-slide", "rx 슬라이드", "rx슬라이드", "rx 슬라이즈", "rx 슬라이더"]],
    mustNotContain: [...COMMON_NOISE, "mm6", "margiela", "마르지엘라", "cdg", "꼼데", "sandy liang", "broken arm", "brokenarm", "브로큰암", "the broken arm", "beams", "빔즈", "ltr", "leather", "가죽", "코르크", "cork", "moc"],
    msrpKrw: 69000, released: 2020,
    defaultProductType: "sandal",
  },
  {
    id: "shoe-salomon-phantasm",
    brand: "Salomon", category: "shoe", laneKey: "salomon_phantasm_broad",
    modelName: "Salomon S/LAB Phantasm 2/3 (카본 러닝)",
    aliases: ["Salomon S/LAB Phantasm", "살로몬 판타즘", "판티즘"],
    mustContain: [["salomon", "살로몬"], ["phantasm", "판타즘", "판티즘"]],
    mustNotContain: [...COMMON_NOISE, "mm6", "margiela", "마르지엘라", "cdg", "꼼데", "platform", "플랫폼"],
    msrpKrw: 370000, released: 2022,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-salomon-rx-mary-jane",
    brand: "Salomon", category: "shoe", laneKey: "salomon_rx_mary_jane",
    modelName: "Salomon RX Mary Jane / Marie-Jeanne",
    aliases: ["Salomon RX MJ", "살로몬 메리제인", "RX Marie-Jeanne"],
    mustContain: [["salomon", "살로몬"], ["mary jane", "메리제인", "메리 제인", "marie-jeanne", "marie jeanne", "rx mj"]],
    mustNotContain: [...COMMON_NOISE, "sandy liang", "샌디리앙", "mm6", "margiela"],
    msrpKrw: 200000, released: 2024,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-salomon-xt-whisper",
    brand: "Salomon", category: "shoe", laneKey: "salomon_xt_whisper_narrow",
    modelName: "Salomon XT-Whisper (시그니처 트레일)",
    aliases: ["Salomon XT-Whisper", "살로몬 XT-위스퍼", "XT Whisper", "휘스퍼"],
    mustContain: [["salomon", "살로몬"], ["xt-whisper", "xt 위스퍼", "xt-위스퍼", "xt whisper", "xt휘스퍼", "휘스퍼"]],
    mustNotContain: [...COMMON_NOISE, "mm6", "margiela", "cdg", "꼼데", "aries", "에리즈", "beams", "빔즈", "beaker", "비이커", "sophnet", "소프넷", "kith", "키스"],
    msrpKrw: 220000, released: 2017,
    defaultProductType: "sneaker",
  },

  // ─── Hoka 핵심 6개 ───
  {
    id: "shoe-hoka-mafate-xlim-collab",
    brand: "Hoka x Xlim", category: "shoe", laneKey: "hoka_mafate_xlim",
    modelName: "Hoka × Xlim Mafate Speed 2 (premium collab)",
    aliases: ["Hoka Xlim Mafate", "호카 엑슬림 마파테"],
    mustContain: [["hoka", "호카"], ["엑슬림", "xlim", "x-lim"]],
    mustNotContain: [...COMMON_NOISE, "bondi", "본디", "clifton", "클리프턴", "mach", "마하"],
    msrpKrw: 280000, released: 2024,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-hoka-hopara",
    brand: "Hoka One One", category: "shoe", laneKey: "hoka_hopara",
    modelName: "Hoka Hopara / Hopara 2 (워터 슬립온)",
    aliases: ["Hoka Hopara", "호카 호파라"],
    mustContain: [["hoka", "호카"], ["호파라", "hopara"]],
    mustNotContain: [...COMMON_NOISE, "bondi", "본디", "clifton", "클리프턴", "mach", "마하", "mafate", "마파테"],
    msrpKrw: 159000, released: 2022,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-hoka-mach-6",
    brand: "Hoka One One", category: "shoe", laneKey: "hoka_mach_6",
    modelName: "Hoka Mach 6 (러닝)",
    aliases: ["Hoka Mach 6", "호카 마하 6"],
    mustContain: [["hoka", "호카"], ["mach 6", "mach6", "마하 6", "마하6"]],
    mustNotContain: [...COMMON_NOISE, "mach x", "mach 7"],
    msrpKrw: 199000, released: 2024,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-hoka-kaha-3-gtx",
    brand: "Hoka One One", category: "shoe", laneKey: "hoka_kaha_3_gtx",
    modelName: "Hoka Kaha 3 GTX (등산화 신상)",
    aliases: ["Hoka Kaha 3", "호카 카하 3"],
    mustContain: [["hoka", "호카"], ["kaha 3", "kaha3", "카하 3", "카하3"]],
    mustNotContain: [...COMMON_NOISE, "kaha 2", "카하 2"],
    msrpKrw: 320000, released: 2024,
    defaultProductType: "boot",
  },

  // ─── Mizuno Golf segment (사용자 메모 누락) ───
  {
    id: "club-mizuno-jpx",
    brand: "Mizuno", category: "sport_golf", laneKey: "mizuno_jpx_golf",
    modelName: "Mizuno JPX 골프 아이언 (800/825/850/900/921/923/925/E500/Forged)",
    aliases: ["Mizuno JPX", "미즈노 JPX", "JPX Forged"],
    mustContain: [["mizuno", "미즈노"], ["jpx"]],
    mustNotContain: [...COMMON_NOISE, "축구화", "풋살화", "러닝화", "스니커즈", "운동화", "모렐리아", "morelia", "알파", "alpha"],
    msrpKrw: 800000, released: 2015,
  },
  {
    id: "club-mizuno-mx",
    brand: "Mizuno", category: "sport_golf", laneKey: "mizuno_mx_golf",
    modelName: "Mizuno MX 골프 (한국 베스트셀러 — 17/23/25/30/70/100/200)",
    aliases: ["Mizuno MX", "미즈노 MX"],
    mustContain: [["mizuno", "미즈노"], ["mx-", "mx23", "mx25", "mx30", "mx70", "mx100", "mx200", "mx17"]],
    mustNotContain: [...COMMON_NOISE, "축구화", "풋살화", "러닝화", "스니커즈", "운동화", "모렐리아", "알파", "jpx"],
    msrpKrw: 400000, released: 2010,
  },
  {
    id: "shoe-mizuno-wave-prophecy",
    brand: "Mizuno", category: "shoe", laneKey: "mizuno_wave_prophecy",
    modelName: "Mizuno Wave Prophecy (LS/MOC/9/β + Graphpaper/Blankof/Nonnative collab)",
    aliases: ["Wave Prophecy", "웨이브 프로페시", "프로페시"],
    mustContain: [["mizuno", "미즈노"], ["프로페시", "prophecy", "프로페서"]],
    mustNotContain: [...COMMON_NOISE, "모렐리아", "morelia", "알파", "alpha", "골프", "골프화", "jpx", "mp-", "mx-"],
    msrpKrw: 280000, released: 2018,
    defaultProductType: "sneaker",
  },

  // ─── Sacai split 5 SKU ───
  {
    id: "shoe-nike-sakai-vaporwaffle",
    brand: "Nike x Sacai", category: "shoe", laneKey: "nike_sakai_vaporwaffle",
    modelName: "Nike × Sacai VaporWaffle (Sport Fuchsia/Sail/Black White)",
    aliases: ["Sacai Vaporwaffle", "사카이 베이퍼와플", "베이퍼와플"],
    mustContain: [["nike", "나이키"], ["sakai", "sacai", "사카이"], ["베이퍼와플", "베이퍼 와플", "vaporwaffle", "vapor waffle"]],
    mustNotContain: [...COMMON_NOISE, "블레이저", "blazer", "ld와플", "ldwaffle", "ldv", "cortez", "코르테즈", "magmascape"],
    msrpKrw: 350000, released: 2020,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-sakai-ldwaffle",
    brand: "Nike x Sacai", category: "shoe", laneKey: "nike_sakai_ldwaffle",
    modelName: "Nike × Sacai LD Waffle / LDV (Summit White/Wolf Grey/Pine Green/Blue Multi)",
    aliases: ["Sacai LD Waffle", "사카이 LD와플", "LDV", "LDWaffle"],
    mustContain: [["nike", "나이키"], ["sakai", "sacai", "사카이"], ["ld와플", "ld waffle", "ldwaffle", "ldv", "엘디와플"]],
    mustNotContain: [...COMMON_NOISE, "블레이저", "blazer", "베이퍼와플", "vaporwaffle", "cortez", "코르테즈", "magmascape"],
    msrpKrw: 250000, minPriceKrw: 100000, released: 2019,  // Wave 769: Sacai LD Waffle collab 가품 floor
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-sakai-blazer-low",
    brand: "Nike x Sacai", category: "shoe", laneKey: "nike_sakai_blazer_low",
    modelName: "Nike × Sacai Blazer Low (Magma Orange/Iron Grey/Classic Green/KAWS)",
    aliases: ["Sacai Blazer Low", "사카이 블레이저 로우"],
    mustContain: [["nike", "나이키"], ["sakai", "sacai", "사카이"], ["blazer", "블레이저", "블레이져"], ["low", "로우"]],
    mustNotContain: [...COMMON_NOISE, "mid", "미드", "hi", "하이", "베이퍼와플", "ld와플"],
    msrpKrw: 180000, released: 2020,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-nike-sakai-cortez",
    brand: "Nike x Sacai", category: "shoe", laneKey: "nike_sakai_cortez",
    modelName: "Nike × Sacai Zoom Cortez 4.0",
    aliases: ["Sacai Cortez", "사카이 코르테즈"],
    mustContain: [["nike", "나이키"], ["sakai", "sacai", "사카이"], ["cortez", "코르테즈"]],
    mustNotContain: [...COMMON_NOISE, "블레이저", "베이퍼와플", "ld와플"],
    msrpKrw: 200000, released: 2022,
    defaultProductType: "sneaker",
  },

  // ─── Adidas Boost 핵심 6개 ───
  {
    id: "shoe-adidas-adios-pro",
    brand: "Adidas", category: "shoe", laneKey: "adidas_adios_pro",
    modelName: "Adidas Adizero Adios Pro 3/4 (마라톤 카본)",
    aliases: ["Adios Pro", "아디오스 프로"],
    mustContain: [["adidas", "아디다스", "adizero"], ["adios pro", "아디오스 프로", "아디오스프로"]],
    mustNotContain: [...COMMON_NOISE, "evo", "boston", "보스턴", "takumi", "타쿠미", "y-3", "wales bonner"],
    msrpKrw: 299000, released: 2022,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-adidas-takumi-sen",
    brand: "Adidas", category: "shoe", laneKey: "adidas_takumi_sen",
    modelName: "Adidas Adizero Takumi Sen 9/10/11",
    aliases: ["Takumi Sen", "타쿠미센"],
    mustContain: [["adidas", "아디다스", "adizero"], ["takumi", "타쿠미"]],
    mustNotContain: [...COMMON_NOISE, "adios", "boston", "prime x", "y-3"],
    msrpKrw: 250000, released: 2023,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-adidas-nmd-r1",
    brand: "Adidas", category: "shoe", laneKey: "adidas_nmd_r1",
    modelName: "Adidas NMD R1 (V2/V3 라이프스타일)",
    aliases: ["NMD R1", "엔엠디 R1"],
    mustContain: [["adidas", "아디다스"], ["nmd r1", "nmd-r1", "nmd"]],
    mustNotContain: [...COMMON_NOISE, "s1", "neighborhood", "네이버후드", "pharrell", "퍼렐", "hu"],
    msrpKrw: 199000, released: 2015,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-adidas-pureboost",
    brand: "Adidas", category: "shoe", laneKey: "adidas_pureboost",
    modelName: "Adidas Pureboost 22/23/Go (데일리 부스트)",
    aliases: ["Pureboost", "퓨어부스트"],
    mustContain: [["adidas", "아디다스"], ["pureboost", "퓨어부스트", "퓨어 부스트", "pure boost"]],
    mustNotContain: [...COMMON_NOISE, "ultraboost", "울트라부스트", "y-3", "nmd"],
    msrpKrw: 159000, released: 2017,
    defaultProductType: "sneaker",
  },

  // ─── Dr. Martens 1단계 6개 ───
  {
    id: "shoe-drmartens-1461-smooth-black",
    brand: "Dr. Martens", category: "shoe", laneKey: "drmartens_1461_smooth_black",
    modelName: "Dr. Martens 1461 Smooth Black (3-hole derby)",
    aliases: ["DR 1461 Smooth Black", "닥마 1461 스무스 블랙"],
    mustContain: [["닥터마틴", "닥마", "dr martens", "dr.martens", "drmartens"], ["1461"], ["스무스", "smooth"], ["블랙", "black"]],
    mustNotContain: [...COMMON_NOISE, "모노", "mono", "벡스", "bex", "쿼드", "quad", "체리", "cherry", "1460", "2976", "3989"],
    msrpKrw: 199000, released: 1959,
    defaultProductType: "shoe",
  },
  {
    id: "shoe-drmartens-wingtip-3989",
    brand: "Dr. Martens", category: "shoe", laneKey: "drmartens_wingtip_3989",
    modelName: "Dr. Martens Wingtip Brogue 3989 (윙팁/브로그)",
    aliases: ["DR 3989", "닥마 윙팁", "윙팁 브로그"],
    mustContain: [["닥터마틴", "닥마", "dr martens", "drmartens"], ["3989", "윙팁", "wingtip", "브로그", "brogue", "14399", "11883", "13619", "14147", "10458"]],
    mustNotContain: [...COMMON_NOISE, "1461", "1460", "2976"],
    msrpKrw: 269000, released: 1985,
    defaultProductType: "shoe",
  },
  {
    id: "shoe-drmartens-jadon",
    brand: "Dr. Martens", category: "shoe", laneKey: "drmartens_jadon",
    modelName: "Dr. Martens Jadon (플랫폼 8홀)",
    aliases: ["DR Jadon", "닥마 제이든"],
    mustContain: [["닥터마틴", "닥마", "dr martens", "drmartens"], ["jadon", "제이든", "제이단"]],
    mustNotContain: [...COMMON_NOISE, "1461", "1460", "2976"],
    msrpKrw: 319000, released: 2014,
    defaultProductType: "boot",
  },
  {
    id: "shoe-drmartens-adrian-tassel-loafer",
    brand: "Dr. Martens", category: "shoe", laneKey: "drmartens_adrian",
    modelName: "Dr. Martens Adrian Tassel Loafer",
    aliases: ["DR Adrian", "닥마 아드리안", "태슬 로퍼"],
    mustContain: [["닥터마틴", "닥마", "dr martens", "drmartens"], ["adrian", "아드리안", "태슬 로퍼"]],
    mustNotContain: [...COMMON_NOISE, "1461", "1460", "2976", "3989"],
    msrpKrw: 229000, released: 2020,
    defaultProductType: "shoe",
  },
  {
    id: "shoe-drmartens-sandal-gryphon",
    brand: "Dr. Martens", category: "shoe", laneKey: "drmartens_sandal_broad",
    modelName: "Dr. Martens Sandal broad (Gryphon/Myles/Blaire/Nartilla)",
    aliases: ["DR Sandal", "닥마 샌들"],
    mustContain: [["닥터마틴", "닥마", "dr martens", "drmartens"], ["gryphon", "그리폰", "myles", "마일즈", "blaire", "블레어", "nartilla", "나틸라"]],
    mustNotContain: [...COMMON_NOISE, "1461", "1460", "2976"],
    msrpKrw: 129000, released: 2018,
    defaultProductType: "sandal",
  },

  // ─── Vans 누락 ───
  {
    id: "shoe-vans-anaheim-factory",
    brand: "Vans", category: "shoe", laneKey: "vans_anaheim_factory",
    modelName: "Vans Anaheim Factory (Old Skool/Authentic/Era 36 DX)",
    aliases: ["Vans Anaheim", "반스 애너하임"],
    mustContain: [["반스", "vans"], ["애너하임", "애나하임", "anaheim"]],
    mustNotContain: [...COMMON_NOISE, "컨버스", "converse"],
    msrpKrw: 89000, released: 2014,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-vans-style-36",
    brand: "Vans", category: "shoe", laneKey: "vans_style_36",
    modelName: "Vans Style 36 (Era 76)",
    aliases: ["Vans Style 36", "반스 스타일 36"],
    mustContain: [["반스", "vans"], ["스타일 36", "스타일36", "style 36"]],
    mustNotContain: [
      ...COMMON_NOISE,
      "컨버스", "converse",
      // Wave 810: Vault/OG/LX and premium collabs use a different resale curve.
      "볼트", "vault", " og ", " og)", "og)", " lx ", " lx)", "lx)",
      "팝 트레이딩", "pop trading", "재팬", "japan",
      // Wave 825: open-back mule silhouette should not price with normal Style 36.
      "뮬", "mule",
    ],
    msrpKrw: 89000, released: 2017,
    defaultProductType: "sneaker",
  },
  // Wave 740 (2026-05-24): Vans Vault premium broad — Vault/OG/LX 라인 별 시세 (8-20만)
  {
    id: "shoe-vans-vault-broad",
    brand: "Vans", category: "shoe", laneKey: "vans_vault_broad",
    modelName: "Vans Vault Broad (OG/LX/Premium reissue)",
    aliases: ["Vans Vault", "반스 볼트"],
    mustContain: [
      ["반스", "vans"],
      ["vault", "볼트",
       " og ", " og)", "og)",
       " lx ", " lx)", "lx)",
       "premium", "프리미엄",
       "anaheim factory",
       "처카 lx", "처카lx", "chukka lx"],
    ],
    mustNotContain: [...COMMON_NOISE, "컨버스", "converse"],
    msrpKrw: 159000, released: 2014,
    defaultProductType: "sneaker",
  },
  // Wave 740 (2026-05-24): Vans Generic Broad — model name unspecified fallback.
  {
    id: "shoe-vans-generic-broad",
    brand: "Vans", category: "shoe", laneKey: "vans_generic_broad",
    modelName: "Vans Generic Broad (narrow 외 일반)",
    aliases: ["Vans", "반스"],
    mustContain: [
      ["반스", "vans"],
      ["스니커즈", "sneakers", "신발", "shoes", "shoe",
       "운동화",
       // Vans 모델 misc
       "노트케이스", "noteacase",
       "프로토타입", "prototype",
       "코너스 스토어", "corner store",
       "솔로 컬렉션", "solo",
       "스폰지밥", "spongebob",
       "디즈니", "disney",
       "ucla",
       "마스터드림", "masterdream",
       "에라 95", "에라95", "era 95",
       "ucfp",
       "스폰서십"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      // narrow 우선
      "old skool", "올드스쿨", "올드 스쿨", "oldskool",
      "sk8", "스케이트",
      "어센틱", "authentic",
      "에라", " era ", "era ",  // Wave 235 한정 분리
      "슬립온", "slip on", "slip-on",
      "anaheim", "애너하임",
      "style 36", "스타일 36",
      "vault", "볼트", "프리미엄",
      // collab
      "kith", "fear of god", "fog", "wtaps", "fragment",
      "마스터마인드", "mastermind", "bottega",
      "리벤지", "revenge",
      "나이젤카본", "nigel cabourn",
    ],
    msrpKrw: 79000, released: 1966,
    defaultProductType: "sneaker",
  },

  // ─── Converse 핵심 누락 ───
  {
    id: "shoe-converse-chuck-allstar-broad",
    brand: "Converse", category: "shoe", laneKey: "converse_chuck_allstar_broad",
    modelName: "Converse Chuck Taylor All Star (척테일러 일반, 척70 아님)",
    aliases: ["Chuck Taylor All Star", "척테일러", "올스타"],
    mustContain: [["컨버스", "converse"], ["올스타", "all star", "척테일러", "chuck taylor"]],
    // Wave 737 leak fix: mustNotContain "70" 단독 제거 — 사이즈 "270mm/280mm"에 매칭되어 519건 leak.
    //   "70" 자체가 substring 검색이라 사이즈 표기 다 차단됨. "chuck 70/척 70/ct70/1970" specific만 유지.
    mustNotContain: [...COMMON_NOISE, "1970", "chuck 70", "chuck taylor 70", "all star 70", "척 70", "척70", "척테일러 70", "올스타 70", "ct70", "ct 70", "1970s", " 70s ", "cdg", "꼼데", "stussy", "스투시", "ader error", "아더에러", "carhartt", "칼하트", "펑첸왕"],
    msrpKrw: 79000, released: 1923,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-converse-chuck70-low-broad",
    brand: "Converse", category: "shoe", laneKey: "converse_chuck70_low_broad",
    modelName: "Converse Chuck 70 Low / Ox (모든 컬러)",
    aliases: ["Chuck 70 Low", "척70 로우", "Chuck70 Ox"],
    mustContain: [["컨버스", "converse"], ["70", "척70", "chuck70", "ct70", "1970", "1970s", " 70s "], [" 로우 ", "로우탑", "로우 탑", "low", "ox", "ox로우", "ox 로우"]],
    mustNotContain: [...COMMON_NOISE, "하이", "high", "hi top", "cdg", "꼼데", "stussy", "스투시", "ader error", "carhartt",
      "미션v", "미션 v", "mission v",
      "atcx", "at-cx", "at cx",
      "스케치화이트", "스케치 화이트", "sketch white",
      "이자벨마랑", "이자벨 마랑", "isabel marant",
      "화이트팩", "화이트 팩", "white pack",
      "컬러체인지", "컬러 체인지", "color change"],
    msrpKrw: 99000, released: 2013,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-converse-runstar-hike",
    brand: "Converse", category: "shoe", laneKey: "converse_runstar_hike",
    modelName: "Converse Run Star Hike (플랫폼 하이)",
    aliases: ["Run Star Hike", "런스타 하이크"],
    mustContain: [["컨버스", "converse"], ["런스타", "run star", "runstar"], ["하이크", "hike"]],
    mustNotContain: [...COMMON_NOISE, "motion", "모션"],
    msrpKrw: 139000, released: 2018,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-fengchenwang-converse-collab",
    brand: "Feng Chen Wang x Converse", category: "shoe", laneKey: "fcw_converse_collab",
    modelName: "Feng Chen Wang × Converse Chuck 70 (2-in-1 신상 SS25)",
    aliases: ["FCW Converse", "펑첸왕 컨버스", "투인원"],
    mustContain: [["펑첸왕", "feng chen wang", "fengchenwang", "fcw"], ["컨버스", "converse"]],
    mustNotContain: [...COMMON_NOISE, "자켓", "팬츠", "가방", "후드"],
    msrpKrw: 189000, released: 2025,
    defaultProductType: "sneaker",
  },

  // ─── Yeezy 핵심 ───
  {
    id: "shoe-yeezy-boost-350-v2-zebra",
    brand: "Adidas Yeezy", category: "shoe", laneKey: "yeezy_350_zebra",
    modelName: "Adidas Yeezy Boost 350 V2 Zebra (자브라/지브라)",
    aliases: ["Yeezy Zebra", "이지 자브라", "이지 지브라"],
    mustContain: [["yeezy", "이지"], ["350"], ["zebra", "지브라", "자브라", "제브라"]],
    mustNotContain: [...COMMON_NOISE, "베이지", "세이지", "케이지", "에이지", "크레이지", "이지갭", "이지온"],
    msrpKrw: 350000, released: 2017,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-yeezy-foam-runner-sand",
    brand: "Adidas Yeezy", category: "shoe", laneKey: "yeezy_foam_runner_sand",
    modelName: "Adidas Yeezy Foam Runner Sand (premium colorway)",
    aliases: ["Yeezy Foam Sand", "이지 폼러너 샌드"],
    mustContain: [["yeezy", "이지"], ["foam", "폼"], ["sand", "샌드"]],
    mustNotContain: [...COMMON_NOISE, "베이지", "세이지", "케이지", "크레이지", "이지갭"],
    msrpKrw: 159000, released: 2020,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-yeezy-quantum",
    brand: "Adidas Yeezy", category: "shoe", laneKey: "yeezy_quantum",
    modelName: "Adidas Yeezy Quantum (BSKTBL 농구화)",
    aliases: ["Yeezy Quantum", "이지 퀀텀"],
    mustContain: [["yeezy", "이지"], ["quantum", "퀀텀"]],
    mustNotContain: [...COMMON_NOISE, "베이지", "세이지", "케이지", "크레이지"],
    msrpKrw: 250000, released: 2020,
    defaultProductType: "sneaker",
  },

  // ─── Crocs 누락 핵심 (Sanrio 63건!) ───
  {
    id: "shoe-crocs-sanrio-collab",
    brand: "Crocs x Sanrio", category: "shoe", laneKey: "crocs_sanrio_collab",
    modelName: "Crocs × Sanrio (Hello Kitty/Kuromi/My Melody/Cinnamoroll)",
    aliases: ["Sanrio Crocs", "산리오 크록스", "헬로키티 크록스"],
    mustContain: [["crocs", "크록스"], ["sanrio", "산리오", "hello kitty", "헬로키티", "kuromi", "쿠로미", "my melody", "마이멜로디", "cinnamoroll", "시나모롤", "pochacco", "포차코"]],
    mustNotContain: [...COMMON_NOISE, "크록스st", "크록스 st", "eva슬리퍼"],
    msrpKrw: 75000, released: 2024,
    defaultProductType: "slipper",
  },
  {
    id: "shoe-crocs-crocband",
    brand: "Crocs", category: "shoe", laneKey: "crocs_crocband",
    modelName: "Crocs Crocband (Bayaband와 별개)",
    aliases: ["Crocs Crocband", "크록밴드"],
    mustContain: [["crocs", "크록스"], ["crocband", "크록밴드"]],
    mustNotContain: [...COMMON_NOISE, "bayaband", "바야밴드"],
    msrpKrw: 49000, released: 2007,
    defaultProductType: "slipper",
  },
  {
    id: "shoe-crocs-anderson-bell-collab",
    brand: "Crocs x Anderson Bell", category: "shoe", laneKey: "crocs_anderson_bell_collab",
    modelName: "Crocs × Anderson Bell (한국 디자이너)",
    aliases: ["Anderson Bell Crocs", "앤더슨벨 크록스"],
    mustContain: [["crocs", "크록스"], ["anderson bell", "앤더슨벨", "앤더슨 벨"]],
    mustNotContain: [...COMMON_NOISE],
    msrpKrw: 290000, released: 2024,
    defaultProductType: "slipper",
  },

  // ─── Puma Rose × Speedcat (BLACKPINK) ───
  {
    id: "shoe-puma-rose-speedcat",
    brand: "Puma x Rose", category: "shoe", laneKey: "puma_rose_speedcat",
    modelName: "Puma × Rosé (BLACKPINK) Speedcat PRM/LEA",
    aliases: ["Rose Speedcat", "로제 스피드캣", "BLACKPINK Speedcat"],
    mustContain: [["puma", "푸마"], ["로제", "rose"], ["스피드캣", "speedcat", "speed cat"]],
    mustNotContain: [...COMMON_NOISE, "mostro", "palermo", "팔레르모", "coperni"],
    msrpKrw: 200000, released: 2025,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-puma-nitro-running",
    brand: "Puma", category: "shoe", laneKey: "puma_nitro_running",
    modelName: "Puma Nitro 러닝 패밀리 (Deviate/Velocity/ForeverRun/MagMax/Magnify/Liberate)",
    aliases: ["Puma Nitro", "나이트로", "디비에이트", "Deviate"],
    mustContain: [["puma", "푸마"], ["나이트로", "nitro", "디비에이트", "deviate", "벨로시티", "velocity", "포에버런", "foreverrun", "매그맥스", "magmax", "패스트트랙", "fasttrack", "매그니파이", "magnify"]],
    mustNotContain: [...COMMON_NOISE, "speedcat", "palermo", "팔레르모", "골프", "golf"],
    msrpKrw: 150000, released: 2021,
    defaultProductType: "sneaker",
  },
];
