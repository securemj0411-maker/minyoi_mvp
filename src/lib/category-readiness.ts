import type { Sku } from "@/lib/catalog";

export type CategoryReadinessStatus = "ready" | "internal_only" | "blocked";

export type CategoryReadinessDecision = {
  category: Sku["category"] | null;
  status: CategoryReadinessStatus;
  canEnterPool: boolean;
  reason: string;
  label: string;
  note?: string;
  minReadyPool?: number;
  laneKey?: string;
};

export type LaneReadinessStatus = "ready" | "blocked";

export type LaneReadinessConfig = {
  status: LaneReadinessStatus;
  label: string;
  note?: string;
};

export type LaneReadinessMap = Record<string, LaneReadinessConfig>;

// Narrow-lane readiness overrides category readiness. A SKU tagged with a
// laneKey here can enter the public candidate pool even if its broader
// category is `internal_only`. Categories without a ready lane stay gated.
export const LANE_READINESS: LaneReadinessMap = {
  camera_body_only_exact_model: {
    status: "ready",
    label: "Camera (body-only exact model)",
    note: "교환식 카메라 body-only narrow lane. lens/번들/킷/액세서리/하자 행은 catalog mustNotContain으로 차단.",
  },
  monitor_benq_xl2540k: {
    status: "ready",
    label: "BenQ ZOWIE XL2540K",
    note: "단일 모델 모니터 narrow lane.",
  },
  speaker_jbl_flip6: {
    status: "ready",
    label: "JBL Flip 6",
    note: "단일 모델 portable speaker narrow lane. broad speaker/PA는 차단 유지.",
  },
  monitor_lg_27up850n: {
    status: "ready",
    label: "LG 27UP850N-W",
    note: "Wave 24: LG UltraFine 4K USB-C narrow lane. distribution 압축으로 pool 미달, sample 누적 대기 상태. 27UL850/27UK850/27UP550/27UP600/27US550 + UltraGear/32\"/24\"는 catalog mustNotContain으로 차단.",
  },
  monitor_lg_27gp850: {
    status: "ready",
    label: "LG UltraGear 27GP850-B",
    note: "Wave 24 fallback: LG UltraGear QHD 165Hz Nano IPS narrow lane. 27GN850/27GP83/27GP95/27GP700 + UltraFine UP/UL/UK + 32\"/24\"는 catalog mustNotContain으로 차단.",
  },
  speaker_bose_soundlink_flex: {
    status: "ready",
    label: "Bose SoundLink Flex",
    note: "Wave 16: Bose SoundLink Flex portable speaker narrow lane. Mini/Revolve/Color/Micro/사운드바는 catalog mustNotContain으로 차단.",
  },
  speaker_sonos_roam: {
    status: "ready",
    label: "Sonos Roam",
    note: "Wave 20: Sonos Roam (1st gen) portable speaker narrow lane. Bunjang 모집단 0건으로 sample 누적 대기 상태. Roam SL/Roam 2/Move/One/Five/Era 등은 catalog mustNotContain으로 차단.",
  },
  speaker_marshall_emberton_ii: {
    status: "ready",
    label: "Marshall Emberton II",
    note: "Wave 20 pivot 1: Sonos Roam Bunjang 0건 → Marshall Emberton II. 16 row apply 했으나 median 150k 압축으로 pool 미달 (JBL Flip 6 패턴 반복). sample 누적 + 가격 하락 대기.",
  },
  speaker_bose_soundlink_mini_ii: {
    status: "ready",
    label: "Bose SoundLink Mini II",
    note: "Wave 20 pivot 2: Marshall Emberton II도 distribution 좁아 Bose SoundLink Mini II로 전환. msrp 219k (2015), 중고 50~130k wider distribution.",
  },
  home_appliance_dyson_v12_detect_slim: {
    status: "ready",
    label: "Dyson V12 Detect Slim",
    note: "Wave 19: 단일 모델 stick vacuum narrow lane. V6/V7/V8/V10/V11/V15/Gen5/Outsize/Omni-glide 등은 catalog mustNotContain으로 차단.",
  },
  desktop_imac_m3_24: {
    status: "ready",
    label: "iMac M3 24\"",
    note: "Wave 22: Apple iMac M3 24-inch (2023) narrow lane. M1/M2/M4/Intel + 27\"/21\" 이전 세대 + Mac Studio/mini/Pro/MacBook은 catalog mustNotContain으로 차단.",
  },
  home_appliance_roborock_s8_pro_ultra: {
    status: "ready",
    label: "Roborock S8 Pro Ultra",
    note: "Wave 21: 단일 모델 robot vacuum narrow lane. S8 base/S8+/S8 MaxV/Qrevo/S7/Q-series 등은 catalog mustNotContain으로 차단.",
  },
  ps5_disc_digital_standard: {
    status: "ready",
    label: "PlayStation 5 (Standard)",
    note: "PS5 Disc/Digital Standard 단독 narrow lane. Slim/Pro/PSVR/Switch는 catalog mustNotContain으로 차단.",
  },
  // Wave 93 (2026-05-15): pollution audit 통과 narrow lane 3개. shoe/bag/bike 카테고리는
  // internal_only 유지 (broad coverage 부족). 단 아래 SKU는 결정론 충분 + 표본 양호로 ready 승격.
  shoe_salomon_xt6_black: {
    status: "ready",
    label: "Salomon XT-6 Black",
    note: "Wave 93: n=31, pollution 0%, median ₩156k. 본품만 정책 + cross-color reject 정밀. description 짧지만 결정론 충분 (사이즈+컨디션). MM6/Margiela 콜라보 + 키즈 사이즈 차단.",
  },
  bike_trek_emonda_sl5: {
    status: "ready",
    label: "Trek Emonda SL5",
    note: "Wave 93: n=39, pollution 2.6%, median ₩1,710k. 카테고리 토큰 (자전거/sram/시마노 등) + 부품/전기자전거 reject 적용. 프레임 사이즈/사고 여부 UI 가이드 필수.",
  },
  bike_merida_bignine: {
    status: "ready",
    label: "Merida Big Nine MTB",
    note: "Wave 93: n=15, pollution 0%, median ₩750k. MTB hardtail. e-BIG.NINE/team 등급은 mustNotContain 차단. 프레임 사이즈/사고 여부 UI 가이드 필수.",
  },
  ipad_pro_11_m4_256_wifi: {
    status: "ready",
    label: "iPad Pro 11\" M4 256GB Wi-Fi",
    note: "단일 변형 narrow lane. 13인치/셀룰러/M1~M3/타 용량은 catalog mustNotContain으로 차단.",
  },
  iphone_15_pro_128gb_self: {
    status: "ready",
    label: "iPhone 15 Pro 128GB (자급제)",
    note: "자급제 + 128GB + 비-Pro Max만. 통신사 약정/완납폰/리퍼/타 용량은 catalog mustNotContain으로 차단.",
  },
  macbook_air_m3_13_256: {
    status: "ready",
    label: "MacBook Air M3 13\" 256GB",
    note: "laptop_broad의 첫 narrow exit. M3 칩 + 13인치 + 256GB만. M1/M2/M4, 15인치, MacBook Pro, 부품/액정/메인보드 매물은 catalog mustNotContain으로 차단.",
  },
  airpods_max_usbc: {
    status: "ready",
    label: "AirPods Max (USB-C, 2024)",
    note: "AirPods Max USB-C 신형 narrow lane. Lightning 구형은 catalog mustNotContain으로 분리.",
  },
  ipad_pro_13_m4_256_wifi: {
    status: "ready",
    label: "iPad Pro 13\" M4 256GB Wi-Fi",
    note: "11\" sibling lane (ipad_pro_11_m4_256_wifi)와 분리. 셀룰러/타 용량/타 chip 차단.",
  },
  iphone_16_pro_128gb_self: {
    status: "ready",
    label: "iPhone 16 Pro 128GB (자급제)",
    note: "iphone_15_pro_128gb_self의 16세대 sibling. Pro Max/15/17/통신사 차단.",
  },
  // Wave 108 (2026-05-15): iPhone Pro Max 256GB 자급제 narrow lane. 매물 89건 (15: 37, 16: 52).
  iphone_15_pro_max_256gb_self: {
    status: "ready",
    label: "iPhone 15 Pro Max 256GB (자급제)",
    note: "iphone_15_pro_128gb_self의 Pro Max 256GB sibling. 14/16세대, 128/512/1TB, 통신사 차단.",
  },
  iphone_16_pro_max_256gb_self: {
    status: "ready",
    label: "iPhone 16 Pro Max 256GB (자급제)",
    note: "iPhone 16 Pro Max 자급제 narrow lane. 15/17세대, 128/512/1TB, 통신사 차단.",
  },
  // Wave 114 (2026-05-15): iPhone Pro 256GB 자급제 narrow lane 3개. broad audit에서 발견.
  // Pro 시리즈는 128/256/512/1TB 옵션 4개. 256은 중간 옵션이라 매물 dense.
  iphone_15_pro_256gb_self: {
    status: "ready",
    label: "iPhone 15 Pro 256GB (자급제)",
    note: "Pro Max 아닌 일반 Pro 256GB 자급제. 14/16세대, Pro Max, 128/512/1TB, 통신사 차단.",
  },
  iphone_16_pro_256gb_self: {
    status: "ready",
    label: "iPhone 16 Pro 256GB (자급제)",
    note: "Pro Max 아닌 일반 Pro 256GB 자급제. 15/17세대, Pro Max, 128/512/1TB, 통신사 차단.",
  },
  iphone_14_pro_256gb_self: {
    status: "ready",
    label: "iPhone 14 Pro 256GB (자급제)",
    note: "Pro Max 아닌 일반 Pro 256GB 자급제. 13/15세대, Pro Max, 128/512/1TB, 통신사 차단.",
  },
  // Wave 120 (2026-05-15): 추가 narrow self lane (Galaxy S21/S22 256, iPhone 13/14 256).
  // 매물 14일 추정: S21 256 277건, S22 256 300건, iPhone 14 256 36건, iPhone 13 256 23건.
  galaxy_s21_256_self: {
    status: "ready",
    label: "Galaxy S21 256GB (자급제)",
    note: "S20/S22, Ultra/Plus/FE, 128/512/1TB, 통신사 차단.",
  },
  galaxy_s22_256_self: {
    status: "ready",
    label: "Galaxy S22 256GB (자급제)",
    note: "S21/S23/S24, Ultra/Plus/FE, 128/512/1TB, 통신사 차단.",
  },
  iphone_13_256gb_self: {
    status: "ready",
    label: "iPhone 13 256GB (자급제)",
    note: "Pro/Pro Max/mini, 12/14세대, 128/512/1TB, 통신사 차단.",
  },
  iphone_14_256gb_self: {
    status: "ready",
    label: "iPhone 14 256GB (자급제)",
    note: "Pro/Pro Max/Plus, 13/15세대, 128/512/1TB, 통신사 차단.",
  },
  // Wave 123 (2026-05-15): MacBook Air M4 + Pro 14 M4 narrow lane.
  macbook_air_m4_13_256: {
    status: "ready",
    label: "MacBook Air M4 13\" 256GB",
    note: "M4 base 16GB/256GB. M1/M2/M3, 15인치, 24GB/32GB, 512+ 차단.",
  },
  macbook_pro_14_m4_256: {
    status: "ready",
    label: "MacBook Pro 14\" M4 256GB (base)",
    note: "M4 base 16GB/256GB. M1/M2/M3, M4 Pro/Max, 16인치, 24GB/32GB+, 512+ 차단.",
  },
  // Wave 124: 옛 Intel macbook narrow lane 일괄 (Pro 16/15/13, Air 13). M1~M5 차단, Intel only 분리.
  // RAM/SSD 다양 매물 수용 (옛 Intel = 명시 안 한 매물 다수). 시세 분포 변동성 받아들임.
  macbook_pro_16_2019: { status: "ready", label: "MacBook Pro 16\" 2019 (Intel)", note: "Intel i7/i9. M1 16 Pro = 2021 → 2019 명시면 Intel only." },
  macbook_pro_15_2019: { status: "ready", label: "MacBook Pro 15\" 2019 (Intel)", note: "Intel only. 15\" Pro Apple Silicon X." },
  macbook_pro_15_2018: { status: "ready", label: "MacBook Pro 15\" 2018 (Intel)", note: "Intel only. 15\" Pro Apple Silicon X." },
  macbook_pro_15_2017: { status: "ready", label: "MacBook Pro 15\" 2017 (Intel)", note: "Intel only. A1707." },
  macbook_pro_13_2019: { status: "ready", label: "MacBook Pro 13\" 2019 (Intel)", note: "Intel only. A2159/A1989." },
  macbook_pro_13_2017: { status: "ready", label: "MacBook Pro 13\" 2017 (Intel)", note: "Intel only. A1706/A1708." },
  // Wave 182 (2026-05-17): 9년 정책 — macbook_pro_13_2013/2015/2016, macbook_air_13_2015 SKU 제거.
  macbook_air_13_2018: { status: "ready", label: "MacBook Air 13\" 2018 (Intel)", note: "Intel only. A1932. Air M1 = 2020." },
  macbook_air_13_2017: { status: "ready", label: "MacBook Air 13\" 2017 (Intel)", note: "Intel only. A1466." },
  // Wave 108: Galaxy S 일반(Ultra/Plus 아닌) 256GB 자급제 narrow lane.
  galaxy_s23_256_self: {
    status: "ready",
    label: "Galaxy S23 256GB (자급제)",
    note: "Galaxy S23 Ultra/Plus 아닌 일반 256GB 자급제. s22/s24/s25, Ultra/Plus/FE, 통신사 차단.",
  },
  galaxy_s24_256_self: {
    status: "ready",
    label: "Galaxy S24 256GB (자급제)",
    note: "Galaxy S24 일반 256GB 자급제. s23/s25, Ultra/Plus/FE, 통신사 차단.",
  },
  galaxy_s25_256_self: {
    status: "ready",
    label: "Galaxy S25 256GB (자급제)",
    note: "Galaxy S25 일반 256GB 자급제. s23/s24/s26, Ultra/Plus/FE, 통신사 차단.",
  },
  // Wave 110: iPhone 15/16 일반(Pro 아닌) 256GB 자급제 narrow lane.
  iphone_15_256gb_self: {
    status: "ready",
    label: "iPhone 15 256GB (자급제)",
    note: "iPhone 15 일반 256GB 자급제. 14/16세대, Pro/Pro Max/Plus, 통신사 차단.",
  },
  iphone_16_256gb_self: {
    status: "ready",
    label: "iPhone 16 256GB (자급제)",
    note: "iPhone 16 일반 256GB 자급제. 15/17세대, Pro/Pro Max/Plus/16e, 통신사 차단.",
  },
  // Wave 111f (2026-05-15): 신상 모델 narrow lane.
  iphone_air_256gb_self: {
    status: "ready",
    label: "iPhone Air 256GB (자급제)",
    note: "Apple 2025 신상 iPhone Air. iPhone 15/16/Pro 차단.",
  },
  iphone_air_512gb_self: {
    status: "ready",
    label: "iPhone Air 512GB (자급제)",
    note: "iPhone Air 512GB sibling.",
  },
  galaxy_z_flip_7_256_self: {
    status: "ready",
    label: "Galaxy Z Flip 7 256GB (자급제)",
    note: "Samsung 2025-07 신상. Z Flip 5/6, 폴드, 통신사 차단.",
  },
  ipad_air_m2_11_256_wifi: {
    status: "ready",
    label: "iPad Air M2 11\" 256GB Wi-Fi",
    note: "iPad Pro M4의 보급형 sibling. M1/M3, 13인치, 셀룰러, 타 용량은 catalog mustNotContain으로 차단.",
  },
  galaxy_s25_ultra_256_self: {
    status: "ready",
    label: "Galaxy S25 Ultra 256GB (자급제)",
    note: "S24/S26, 512/1TB, 통신사 약정/완납폰/리퍼는 catalog mustNotContain으로 차단.",
  },
  ipad_air_m3_11_256_wifi: {
    status: "ready",
    label: "iPad Air M3 11\" 256GB Wi-Fi",
    note: "M3 신모델 (2025) narrow lane. M1/M2/M4, 13인치, 셀룰러는 catalog로 차단.",
  },
  // Wave 119 (2026-05-15): iPad Air 13" narrow lane (M2/M3 sibling). 14일 매물 87건.
  ipad_air_m2_13_256_wifi: {
    status: "ready",
    label: "iPad Air M2 13\" 256GB Wi-Fi",
    note: "iPad Air M2 13인치 sibling lane. M1/M3/M4, 11인치, 셀룰러 차단.",
  },
  ipad_air_m3_13_256_wifi: {
    status: "ready",
    label: "iPad Air M3 13\" 256GB Wi-Fi",
    note: "iPad Air M3 (2025) 13인치 sibling lane. M1/M2/M4, 11인치, 셀룰러 차단.",
  },
  galaxy_tab_s10_ultra_256_self: {
    status: "ready",
    label: "Galaxy Tab S10 Ultra 256GB (자급제)",
    note: "S10 Ultra Wi-Fi 256GB 자급제 narrow lane. S9/S11/FE/셀룰러/통신사는 catalog로 차단.",
  },
  macbook_pro_14_m3_18_512: {
    status: "ready",
    label: "MacBook Pro 14\" M3 18GB 512GB",
    note: "MacBook Air sibling. M1/M2/M4, 16인치, Air, 타 RAM/SSD는 catalog로 차단.",
  },
  lg_gram_17_2024: {
    status: "ready",
    label: "LG 그램 17\" 2024 (16GB 512GB)",
    note: "한국 인기 laptop narrow. 14/15/16인치, gram pro, 구세대(2020-2023)는 catalog로 차단.",
  },
  iphone_14_pro_128gb_self: {
    status: "ready",
    label: "iPhone 14 Pro 128GB (자급제)",
    note: "iPhone 15/16 Pro 자급제 sibling. 13/15세대, Pro Max, 통신사는 catalog로 차단.",
  },
  galaxy_s24_ultra_256_self: {
    status: "ready",
    label: "Galaxy S24 Ultra 256GB (자급제)",
    note: "S25 자급제 sibling. S22/S23/S25, 512/1TB, 통신사는 catalog로 차단.",
  },
  ps5_slim: {
    status: "ready",
    label: "PlayStation 5 Slim (Disc/Digital)",
    note: "PS5 Slim 2023-11 narrow lane. Standard sibling은 ps5_disc_digital_standard. Pro/PSVR/Switch/액세서리는 catalog mustNotContain으로 분리.",
  },
  iphone_13_pro_128gb_self: {
    status: "ready",
    label: "iPhone 13 Pro 128GB (자급제)",
    note: "iPhone 14/15/16 Pro 자급제 sibling.",
  },
  iphone_12_pro_128gb_self: {
    status: "ready",
    label: "iPhone 12 Pro 128GB (자급제)",
    note: "구형 자급제 narrow lane. Pro Max/미니/통신사는 catalog로 차단.",
  },
  galaxy_s23_ultra_256_self: {
    status: "ready",
    label: "Galaxy S23 Ultra 256GB (자급제)",
    note: "S22/S24/S25 sibling 차단.",
  },
  ipad_pro_11_m2_256_wifi: {
    status: "ready",
    label: "iPad Pro 11\" M2 256GB Wi-Fi",
    note: "M4 sibling. M1/M3/M4, 13인치, 셀룰러 차단.",
  },
  ipad_mini_7_128_wifi: {
    status: "ready",
    label: "iPad mini 7 (A17 Pro) 128GB Wi-Fi",
    note: "신모델. mini 5/6, M-chip, 256+ 차단.",
  },
  ipad_pro_13_m2_256_wifi: {
    status: "ready",
    label: "iPad Pro 13\" M2 256GB Wi-Fi",
    note: "M4 13\" sibling. 11\"/M1/M3/M4/셀룰러/타 용량은 catalog로 차단.",
  },
  macbook_air_m2_13_256: {
    status: "ready",
    label: "MacBook Air M2 13\" 256GB",
    note: "M3 sibling. M1/M3/M4, 15인치, MacBook Pro, 타 RAM/SSD는 catalog로 차단.",
  },
  iphone_11_pro_128gb_self: {
    status: "ready",
    label: "iPhone 11 Pro 128GB (자급제)",
    note: "구형 자급제 narrow lane. Pro Max/12/통신사/리퍼는 catalog로 차단.",
  },
  galaxy_z_flip_5_256_self: {
    status: "ready",
    label: "Galaxy Z Flip 5 256GB (자급제)",
    note: "Flip 4/6, Fold, 512/1TB, 통신사는 catalog로 차단.",
  },
  switch_oled: {
    status: "ready",
    label: "Nintendo Switch OLED",
    note: "OLED 단독 narrow lane. v1/Lite/Switch 2/PS는 catalog로 차단.",
  },
  // Wave 75: Wave 67 신 SKU 측정 결과 ready 승격 (parseRate ≥ 90% + NRfalse ≥ 5).
  watch_gshock_dw5600: {
    // 2026-05-15: 운영자 결정 — 시계 카테고리 전체 차단 (모델 다양성/한정판 구분 어려움).
    // 카테고리 watch=blocked + lane도 blocked로 통일.
    status: "blocked",
    label: "Casio G-Shock DW-5600",
    note: "Wave 67/74 ready 승격됐으나 2026-05-15 운영자 결정으로 차단 (시계 카테고리 전체).",
  },
  sport_golf_titleist_tsr2_driver: {
    status: "blocked",
    label: "Titleist TSR2 Driver",
    note: "Wave 90 1차 후보. 2026-05-15: loft 옵션 parser 보강 전 사용자 노출 차단. 카테고리 internal_only라 시세 학습은 계속.",
  },
  sport_golf_titleist_tsr3_driver: {
    status: "blocked",
    label: "Titleist TSR3 Driver",
    note: "동일 (loft 옵션 parser 보강 전 사용자 노출 차단).",
  },
  // 미진입 (측정 불충분): watch_gshock_ga2100 (NRtrue 28건, 옛 parser version), watch_gshock_gmwb5000 (parseRate 55%),
  // watch_seiko_5_sports_srpd (1건), watch_seiko_5_sports_sbsa (0건), camera_sony_a6400 (production 0건)
  // Wave 142 (2026-05-17): 액세서리/luxury narrow lane 3개 신설 (사용자 원래 의도 = 상품 다양화).
  // 정밀 검토 후 표본 충분한 lane만 ready (애플펜슬 단독 0건 → drop).
  // Wave 182 (2026-05-17): magic_keyboard_ipad SKU 제거 (액세서리 — catalog 정비).
  applewatch_s8_hermes: {
    status: "ready",
    label: "Apple Watch Series 8 Hermès",
    note: "Wave 142: S8 Hermès Edition 본품 narrow lane (29건, median ₩528k). 가죽 밴드 별매 (밴드만/스트랩만) + parts/buying 차단. 일반 S8 SKU와는 mustNotContain 양방향 격리.",
  },
  applewatch_s10_hermes: {
    status: "ready",
    label: "Apple Watch Series 10 Hermès",
    note: "Wave 142: S10 Hermès Edition 본품 narrow lane (42건, median ₩962k). 일반 S10 대비 시세 ~+₩300~400K. 가죽 밴드 별매/parts/buying 차단. 일반 S10 SKU와는 mustNotContain 양방향 격리.",
  },
  // Wave 184 (2026-05-17): 새 카테고리 "drone" narrow lane 22개 — DJI/GoPro.
  // 모두 본체 only (Fly More Combo 등 별도 매물 차단). 짝퉁 거의 없음 (DJI 활성화 + GoPro 정품 등록).
  dji_mini_2: { status: "ready", label: "DJI Mini 2", note: "Wave 184: 본체 only. Fly More Combo 매물은 mustNotContain 으로 격리." },
  dji_mini_3_pro: { status: "ready", label: "DJI Mini 3 Pro", note: "Wave 184: 본체 only." },
  dji_mini_4_pro: { status: "ready", label: "DJI Mini 4 Pro", note: "Wave 184: 본체 only. 2024 신모델." },
  dji_mavic_3: { status: "ready", label: "DJI Mavic 3", note: "Wave 184: 본체 only." },
  dji_mavic_3_pro: { status: "ready", label: "DJI Mavic 3 Pro", note: "Wave 184: 본체 only." },
  dji_mavic_3_classic: { status: "ready", label: "DJI Mavic 3 Classic", note: "Wave 184: 본체 only." },
  dji_air_2s: { status: "ready", label: "DJI Air 2S", note: "Wave 184: 본체 only." },
  dji_air_3: { status: "ready", label: "DJI Air 3", note: "Wave 184: 본체 only." },
  dji_air_3s: { status: "ready", label: "DJI Air 3S", note: "Wave 184: 본체 only. 2024 신모델." },
  dji_avata: { status: "ready", label: "DJI Avata (FPV)", note: "Wave 184: 본체 only." },
  dji_avata_2: { status: "ready", label: "DJI Avata 2", note: "Wave 184: 본체 only. 2024 신모델." },
  dji_osmo_action_3: { status: "ready", label: "DJI Osmo Action 3", note: "Wave 184: 단일 옵션." },
  dji_osmo_action_4: { status: "ready", label: "DJI Osmo Action 4", note: "Wave 184: 단일 옵션." },
  dji_osmo_action_5_pro: { status: "ready", label: "DJI Osmo Action 5 Pro", note: "Wave 184: 단일 옵션. 2024 신모델." },
  dji_osmo_pocket_2: { status: "ready", label: "DJI Osmo Pocket 2", note: "Wave 184: 단일 옵션." },
  dji_osmo_pocket_3: { status: "ready", label: "DJI Osmo Pocket 3", note: "Wave 184: 단일 옵션. 2023 인기." },
  gopro_hero_9: { status: "ready", label: "GoPro Hero 9 Black", note: "Wave 184: 단일 옵션." },
  gopro_hero_10: { status: "ready", label: "GoPro Hero 10 Black", note: "Wave 184: 단일 옵션." },
  gopro_hero_11: { status: "ready", label: "GoPro Hero 11 Black", note: "Wave 184: 단일 옵션." },
  gopro_hero_12: { status: "ready", label: "GoPro Hero 12 Black", note: "Wave 184: 단일 옵션." },
  gopro_hero_13: { status: "ready", label: "GoPro Hero 13 Black", note: "Wave 184: 단일 옵션. 2024 신모델." },
  gopro_max: { status: "ready", label: "GoPro Max (360)", note: "Wave 184: 단일 옵션. 360도 카메라." },
  // Wave 185 (2026-05-17): 새 카테고리 "perfume" narrow lane 22개.
  jo_malone_wood_sage_sea_salt_100: { status: "ready", label: "Jo Malone Wood Sage & Sea Salt 100ml", note: "Wave 185" },
  jo_malone_lime_basil_mandarin_100: { status: "ready", label: "Jo Malone Lime Basil & Mandarin 100ml", note: "Wave 185" },
  jo_malone_english_pear_freesia_100: { status: "ready", label: "Jo Malone English Pear & Freesia 100ml", note: "Wave 185" },
  jo_malone_blackberry_bay_100: { status: "ready", label: "Jo Malone Blackberry & Bay 100ml", note: "Wave 185" },
  jo_malone_peony_blush_suede_100: { status: "ready", label: "Jo Malone Peony & Blush Suede 100ml", note: "Wave 185" },
  le_labo_santal_33_50: { status: "ready", label: "Le Labo Santal 33 50ml", note: "Wave 185" },
  le_labo_santal_33_100: { status: "ready", label: "Le Labo Santal 33 100ml", note: "Wave 185" },
  le_labo_noir_29_50: { status: "ready", label: "Le Labo The Noir 29 50ml", note: "Wave 185" },
  diptyque_philosykos_75: { status: "ready", label: "Diptyque Philosykos 75ml", note: "Wave 185" },
  diptyque_do_son_75: { status: "ready", label: "Diptyque Do Son 75ml", note: "Wave 185" },
  diptyque_eau_capitale_75: { status: "ready", label: "Diptyque Eau Capitale 75ml", note: "Wave 185" },
  tom_ford_black_orchid_50: { status: "ready", label: "Tom Ford Black Orchid 50ml", note: "Wave 185" },
  tom_ford_tobacco_vanille_50: { status: "ready", label: "Tom Ford Tobacco Vanille 50ml", note: "Wave 185" },
  tom_ford_lost_cherry_50: { status: "ready", label: "Tom Ford Lost Cherry 50ml", note: "Wave 185" },
  tom_ford_oud_wood_50: { status: "ready", label: "Tom Ford Oud Wood 50ml", note: "Wave 185" },
  replica_jazz_club_100: { status: "ready", label: "Replica Jazz Club 100ml", note: "Wave 185" },
  replica_by_the_fireplace_100: { status: "ready", label: "Replica By the Fireplace 100ml", note: "Wave 185" },
  replica_beach_walk_100: { status: "ready", label: "Replica Beach Walk 100ml", note: "Wave 185" },
  replica_when_the_rain_stops_100: { status: "ready", label: "Replica When the Rain Stops 100ml", note: "Wave 185" },
  memo_russian_leather_75: { status: "ready", label: "Memo Russian Leather 75ml", note: "Wave 185" },
  memo_irish_leather_75: { status: "ready", label: "Memo Irish Leather 75ml", note: "Wave 185" },
  memo_italian_leather_75: { status: "ready", label: "Memo Italian Leather 75ml", note: "Wave 185" },
  // Wave 185 internal test (2026-05-18): Dyson Airwrap Origin 신모델 추가.
  dyson_airwrap_origin: { status: "ready", label: "Dyson Airwrap Origin", note: "Wave 185 internal test: 저가형 Airwrap 2024.11 신모델." },
  // Wave 185 internal test (2026-05-18): DJI 신모델 (Pocket 4 / Action 6 / Osmo Nano).
  dji_osmo_pocket_4: { status: "ready", label: "DJI Osmo Pocket 4", note: "Wave 185 internal test: 2025 신모델, 매물 4건 발견." },
  dji_osmo_action_6: { status: "ready", label: "DJI Osmo Action 6", note: "Wave 185 internal test: 2025 신모델." },
  dji_osmo_nano: { status: "ready", label: "DJI Osmo Nano", note: "Wave 185 internal test: 2025 신모델, 컴팩트 액션캠." },
  // Wave 186 (2026-05-18): 새 카테고리 "kickboard" narrow lane 9개.
  xiaomi_mi_scooter_pro_2: { status: "ready", label: "Xiaomi Mi Scooter Pro 2", note: "Wave 186" },
  xiaomi_mi_scooter_3: { status: "ready", label: "Xiaomi Mi Scooter 3", note: "Wave 186" },
  xiaomi_mi_scooter_4: { status: "ready", label: "Xiaomi Mi Scooter 4", note: "Wave 186" },
  xiaomi_mi_scooter_4_pro: { status: "ready", label: "Xiaomi Mi Scooter 4 Pro", note: "Wave 186" },
  xiaomi_mi_scooter_4_ultra: { status: "ready", label: "Xiaomi Mi Scooter 4 Ultra", note: "Wave 186" },
  ninebot_max_g2: { status: "ready", label: "Segway Ninebot Max G2", note: "Wave 186" },
  ninebot_f40: { status: "ready", label: "Segway Ninebot F40", note: "Wave 186" },
  ninebot_f30: { status: "ready", label: "Segway Ninebot F30", note: "Wave 186" },
  ninebot_e45: { status: "ready", label: "Segway Ninebot E45", note: "Wave 186" },
  // Wave 187 (2026-05-18): 가민 워치 (smartwatch 확장) — Fenix / Forerunner / Instinct / Venu / Epix.
  garmin_fenix_7: { status: "ready", label: "Garmin Fenix 7 (47mm)", note: "Wave 187" },
  garmin_fenix_7s: { status: "ready", label: "Garmin Fenix 7S (42mm)", note: "Wave 187" },
  garmin_fenix_7x: { status: "ready", label: "Garmin Fenix 7X (51mm)", note: "Wave 187" },
  garmin_fenix_8: { status: "ready", label: "Garmin Fenix 8 (AMOLED)", note: "Wave 187 신모델 2024" },
  garmin_forerunner_265: { status: "ready", label: "Garmin Forerunner 265", note: "Wave 187" },
  garmin_forerunner_955: { status: "ready", label: "Garmin Forerunner 955", note: "Wave 187" },
  garmin_forerunner_965: { status: "ready", label: "Garmin Forerunner 965", note: "Wave 187" },
  garmin_forerunner_970: { status: "ready", label: "Garmin Forerunner 970", note: "Wave 189 신모델 2025" },
  garmin_instinct_2: { status: "ready", label: "Garmin Instinct 2", note: "Wave 187" },
  garmin_venu_3: { status: "ready", label: "Garmin Venu 3", note: "Wave 187" },
  garmin_epix_pro: { status: "ready", label: "Garmin Epix Pro", note: "Wave 187" },
  // Wave 188 (2026-05-18): 레고 한정판 12 SKU.
  lego_75192_millennium_falcon: { status: "ready", label: "LEGO 75192 Millennium Falcon UCS", note: "Wave 188" },
  lego_75313_at_at: { status: "ready", label: "LEGO 75313 AT-AT UCS", note: "Wave 188" },
  lego_75331_razor_crest: { status: "ready", label: "LEGO 75331 Razor Crest UCS", note: "Wave 188" },
  lego_75355_x_wing: { status: "ready", label: "LEGO 75355 X-Wing UCS", note: "Wave 188" },
  lego_10297_boutique_hotel: { status: "ready", label: "LEGO 10297 Boutique Hotel", note: "Wave 188" },
  lego_10312_jazz_club: { status: "ready", label: "LEGO 10312 Jazz Club", note: "Wave 188" },
  lego_10326_natural_history_museum: { status: "ready", label: "LEGO 10326 Natural History Museum", note: "Wave 188" },
  lego_42143_ferrari_daytona: { status: "ready", label: "LEGO 42143 Ferrari Daytona", note: "Wave 188" },
  lego_42115_lamborghini_sian: { status: "ready", label: "LEGO 42115 Lamborghini Sián", note: "Wave 188" },
  lego_21319_central_perk: { status: "ready", label: "LEGO 21319 Central Perk", note: "Wave 188" },
  lego_21338_a_frame_cabin: { status: "ready", label: "LEGO 21338 A-Frame Cabin", note: "Wave 188" },
  lego_21054_white_house: { status: "ready", label: "LEGO 21054 White House", note: "Wave 188" },
  // Wave 198 (2026-05-18): 의류 narrow lane 19개 — Polo / TNF / Stüssy 시그니처 + collab.
  polo_pique_classic: { status: "ready", label: "Polo Pique Classic Fit", note: "Wave 198" },
  polo_bigpony_pique: { status: "ready", label: "Polo Big Pony Pique (카라티)", note: "Wave 712a — bias-free 검증으로 193건/주 black hole 발견. 빅포니 카라티 + pique mustContain 강제로 catch." },
  polo_pony_tee: { status: "ready", label: "Polo Pony Logo T-Shirt", note: "Wave 198" },
  polo_oxford_shirt: { status: "ready", label: "Polo Oxford Shirt (Standard)", note: "Wave 198" },
  polo_bear_collab: { status: "ready", label: "Polo Bear Print (한정)", note: "Wave 682 release — Wave 572/580/682 누적 차단: 양말/파자마/이불/잠옷/보이즈/걸즈/패밀리 후디/큐알신형(가품)/y2k 빈티지 명시." },
  polo_rrl: { status: "blocked", label: "Polo RRL Double RL (broad fallback)", note: "Wave 407: clothing broad fallback hold — narrow RRL lanes only." },
  // Wave 218 (2026-05-19): RRL narrow 5개 — product type 별 가격대 완전 다름 (CV 1.56 분산)
  polo_rrl_tee: { status: "ready", label: "Polo RRL Tee / Sweat / Hoodie", note: "Wave 684 release — 스위터/마운틴 파카/헨리넥/자카드/셀럽(류준열)/리페어/와시드 차단. product_type별 comparable_key 자동 분리." },
  polo_rrl_denim: { status: "ready", label: "Polo RRL Denim (jeans/shirt)", note: "Wave 218" },
  polo_rrl_shirt_pants: { status: "blocked", label: "Polo RRL Shirt / Pants (catch-all)", note: "Wave 407: catch-all hold. Use shirt/pants narrow lanes." },
  // Wave 247.1 (2026-05-19): shirt-pants split — production sample 74건 (CV 0.86) → shirt 49 / pants 20 narrow 분리.
  polo_rrl_shirt: { status: "ready", label: "Polo RRL Shirt (옥스포드/플란넬)", note: "Wave 247.1 — broad 의 66% 셔츠 매물 분리 (49건, median 34만)" },
  polo_rrl_pants: { status: "ready", label: "Polo RRL Pants (치노/슬랙스)", note: "Wave 247.1 — broad 의 27% 팬츠 매물 분리 (20건, median 37만)" },
  polo_rrl_accessory: { status: "blocked", label: "Polo RRL Accessory", note: "Wave 407: accessory lane is not clothing-ready; re-home/split before pool." },
  polo_rrl_sneaker: { status: "ready", label: "Polo RRL Sneaker", note: "Wave 218 — shoe 카테고리" },
  polo_rrl_jacket_coat: { status: "blocked", label: "Polo RRL Jacket / Coat", note: "Wave 539: broad jacket/coat p25/p75=82만/264만 is too wide for public ready. Keep split RRL denim/leather/grizzly/Browns Beach lanes only." },
  polo_rrl_broad: { status: "blocked", label: "Polo RRL (broad fallback)", note: "Wave 407: clothing broad fallback hold — narrow RRL lanes only." },
  tnf_nuptse_1996: { status: "ready", label: "TNF 1996 Retro Nuptse", note: "Wave 198" },
  tnf_mountain_jacket: { status: "ready", label: "TNF Mountain Jacket (Gore-Tex)", note: "Wave 198" },
  tnf_denali_fleece: { status: "ready", label: "TNF Denali Fleece", note: "Wave 198" },
  tnf_purple_label: { status: "ready", label: "TNF Purple Label (일본 Nanamica)", note: "Wave 683 release — 일본 정품 라인, product_type별 comparable_key 자동 분리됨 (셔츠 5만 vs 다운 56만). 몽키타임/빔스/Fragment collab + 가품 시그널 차단." },
  tnf_supreme_collab: { status: "blocked", label: "Supreme × TNF (legacy laneKey)", note: "Wave 407: legacy broad hold. Use model-specific Supreme x TNF lanes." },
  tnf_supreme_collab_broad: { status: "blocked", label: "Supreme × TNF (broad fallback — 기타 자켓/베스트)", note: "Wave 407: broad hold. Use model-specific Supreme x TNF lanes." },
  // Wave 245.3 (2026-05-19): Supreme × TNF 자켓 모델별 narrow 7개 신설 (production 107건 측정, 자켓 53건/50%).
  tnf_supreme_nuptse: { status: "ready", label: "Supreme × TNF 1996 Nuptse", note: "Wave 245.3 — median 83만 / msrp down_jacket" },
  tnf_supreme_mountain_jacket: { status: "ready", label: "Supreme × TNF Mountain Jacket (Gore-Tex)", note: "Wave 245.3 — median 68만" },
  tnf_supreme_mountain_light: { status: "ready", label: "Supreme × TNF Mountain Light", note: "Wave 245.3 — median 70만" },
  tnf_supreme_mountain_parka: { status: "ready", label: "Supreme × TNF Mountain Parka", note: "Wave 245.3 — median 70만" },
  tnf_supreme_expedition: { status: "ready", label: "Supreme × TNF Expedition", note: "Wave 245.3 — median 107만 (의류만; 가방은 broad 차단)" },
  tnf_supreme_denali_fleece: { status: "ready", label: "Supreme × TNF Denali Fleece", note: "Wave 245.3 — median 39만" },
  tnf_supreme_baltoro: { status: "ready", label: "Supreme × TNF Baltoro Down Jacket", note: "Wave 245.3 — median 84.5만" },
  // Wave 219 (2026-05-19): Supreme × TNF product type 분리 — 자켓 380K vs 백팩 320K vs 슬리퍼 350K vs G-Shock 320K
  tnf_supreme_backpack: { status: "ready", label: "Supreme × TNF Backpack", note: "Wave 219 (bag 카테고리)" },
  tnf_supreme_slipper: { status: "ready", label: "Supreme × TNF Mule/Slipper", note: "Wave 219 (shoe 카테고리)" },
  tnf_supreme_gshock: { status: "ready", label: "Supreme × TNF × G-Shock DW-6900", note: "Wave 439 — watch 카테고리로 이동" },
  tnf_borealis: { status: "ready", label: "TNF Borealis Backpack", note: "Wave 198 bag" },
  tnf_hotshot: { status: "ready", label: "TNF Hot Shot Backpack", note: "Wave 198 bag" },
  tnf_bigshot: { status: "ready", label: "TNF Big Shot Backpack", note: "Wave 198 bag" },
  tnf_nuptse_mule: { status: "ready", label: "TNF Nuptse Mule (슬리퍼)", note: "Wave 198 shoe" },
  stussy_nike_collab: { status: "ready", label: "Nike × Stüssy Apparel (collab)", note: "Wave 690 release — 30~50만 가격대 안정 (fleece/windrunner/tee/hoodie), 셋업/월드투어 한정 차단." },
  stussy_basic_tee: { status: "ready", label: "Stüssy Basic Tee (8 Ball/World Tour)", note: "Wave 678 release — Wave 656에서 도시 한정/DSM/마틴로즈/CPFM/돌리/갱스타/월드투어 명시 차단. LATEST v32 spread <4x." },
  stussy_hoodie: { status: "ready", label: "Stüssy Hoodie / Crewneck", note: "Wave 678 release — Wave 655에서 월드투어/CPFM/스컬본즈/iD 매거진 명시 차단. LATEST v32 spread <4x." },
  stussy_waist_bag: { status: "ready", label: "Stüssy Waist Bag", note: "Wave 198 bag" },
  stussy_dior_collab: { status: "ready", label: "Dior × Stüssy (FW21 한정)", note: "Wave 198 한정판" },
  // Wave 199 (2026-05-18): 매물 mining 발견 후속 SKU
  stussy_nike_shoe_collab: { status: "ready", label: "Nike × Stüssy Footwear", note: "Wave 199 신발 분리 (collab 109건 중 56% 신발)" },
  stussy_crossbody: { status: "ready", label: "Stüssy Crossbody / Tote / 30주년", note: "Wave 199 bag broad" },
  polo_leather_loafer: { status: "ready", label: "Polo Leather Loafer/Moccasin/Derby", note: "Wave 199 shoe" },
  tnf_hiking_boots: { status: "ready", label: "TNF Hiking Boots / 등산화", note: "Wave 199 shoe" },
  // Wave 199 Tier 2: 라코스테 + 아더에러
  lacoste_sneakers: { status: "ready", label: "Lacoste Sneakers", note: "Wave 199 Tier 2 shoe" },
  lacoste_tote: { status: "ready", label: "Lacoste Tote/Shopper/Backpack", note: "Wave 199 Tier 2 bag" },
  lacoste_pique_polo: { status: "ready", label: "Lacoste Pique Polo (시그니처)", note: "Wave 199 Tier 2 clothing" },
  adererror_shopper: { status: "ready", label: "ADER ERROR Shopper (시그니처)", note: "Wave 199 Tier 2 bag" },
  adererror_converse_collab: { status: "ready", label: "Converse × ADER ERROR (collab)", note: "Wave 199 Tier 2 shoe collab" },
  // Wave 200 (2026-05-18) Tier 3 — 꼼데가르송 / Stussy×Converse / Polo Big Pony
  cdg_nike_collab: { status: "ready", label: "Nike × CDG Homme Plus (collab)", note: "Wave 200 Tier 3 shoe collab — 매물 압도적" },
  cdg_pvc_bag: { status: "ready", label: "CDG PVC Bag (시그니처)", note: "Wave 200 Tier 3 bag — faved 51" },
  stussy_converse_collab: { status: "ready", label: "Converse × Stüssy (척테일러)", note: "Wave 200 Tier 3 shoe collab" },
  polo_big_pony_tote: { status: "ready", label: "Polo Big Pony Tote (시그니처)", note: "Wave 200 Tier 3 bag" },
  // Wave 201 (2026-05-18): 꼼데가르송 collab 분리
  cdg_newbalance_collab: { status: "ready", label: "NB × CDG Junya Watanabe", note: "Wave 201 collab shoe" },
  cdg_vans_collab: { status: "ready", label: "Vans × CDG", note: "Wave 201 collab shoe" },
  cdg_salomon_collab: { status: "ready", label: "Salomon × CDG", note: "Wave 201 collab shoe — XT-6/Alpine" },
  // Wave 202 (2026-05-18): On Running + Birkenstock + Lululemon + Levis collab — 매물 폭발적 발견.
  onrunning_cloud_monster: { status: "ready", label: "On Running Cloud Monster (시그니처)", note: "Wave 202 — 매물 압도적" },
  onrunning_cloud_basic: { status: "ready", label: "On Running Cloud (5/X/Z5)", note: "Wave 202" },
  onrunning_cloudsurfer: { status: "ready", label: "On Running Cloudsurfer", note: "Wave 202" },
  onrunning_loewe_collab: { status: "ready", label: "Loewe × On Cloudtilt (한정)", note: "Wave 202 collab" },
  onrunning_paf_collab: { status: "ready", label: "PAF × On Running (한정)", note: "Wave 202 collab" },
  birkenstock_boston: { status: "ready", label: "Birkenstock Boston (시그니처)", note: "Wave 202 — 매물 다수" },
  birkenstock_arizona: { status: "ready", label: "Birkenstock Arizona", note: "Wave 202" },
  birkenstock_zurich: { status: "ready", label: "Birkenstock Zürich", note: "Wave 202" },
  birkenstock_milano: { status: "ready", label: "Birkenstock Milano", note: "Wave 202" },
  lululemon_backpack: { status: "ready", label: "Lululemon Backpack (시그니처 faved 91)", note: "Wave 202 — 매물 압도적" },
  newbalance_levis_collab: { status: "ready", label: "NB × Levi's 990v3 (collab)", note: "Wave 202 collab" },
  nike_levis_collab: { status: "ready", label: "Nike × Levi's Air Max 95 (collab)", note: "Wave 202 collab" },
  // Wave 203 (2026-05-18): 마르지엘라 mining — 매물 압도적 (80건 sample). 타비 / MM6 collab / 글램슬램.
  margiela_tabi: { status: "ready", label: "Margiela Tabi (broad fallback)", note: "Wave 219: product type 분리 후 catch-all" },
  // Wave 219 (2026-05-19): Tabi product type 분리 — 부츠 100K vs 스니커즈 120~200K vs 슬리퍼 170K
  margiela_tabi_sneaker: { status: "ready", label: "Margiela Tabi Sneaker (Low/High)", note: "Wave 219" },
  margiela_tabi_boot: { status: "ready", label: "Margiela Tabi Boot", note: "Wave 219" },
  margiela_tabi_slipper: { status: "ready", label: "Margiela Tabi Slipper/Espadrille", note: "Wave 219" },
  margiela_german_army: { status: "ready", label: "Margiela German Army Trainer (Replica)", note: "Wave 203" },
  mm6_salomon_collab: { status: "ready", label: "Salomon × MM6 (X-ALP/ACS)", note: "Wave 203 collab" },
  margiela_glam_slam: { status: "ready", label: "Margiela Glam Slam (시그니처)", note: "Wave 203 bag" },
  mm6_margiela_apparel: { status: "blocked", label: "MM6 Margiela Apparel (broad)", note: "Wave 407: broad apparel hold until model-level audit." },
  // Wave 204 (2026-05-18): 슈프림 collab 8 SKU — 매물 80건 sample 거의 다 슈프림.
  supreme_nike_airforce1_collab: { status: "ready", label: "Supreme × Nike Air Force 1 (collab)", note: "Wave 204 — 매물 20+건 압도적" },
  supreme_nike_airmax_collab: { status: "ready", label: "Supreme × Nike Air Max (collab)", note: "Wave 204" },
  supreme_nike_sb_collab: { status: "ready", label: "Supreme × Nike SB (덩크/블레이저/AF2)", note: "Wave 204" },
  supreme_timberland_collab: { status: "ready", label: "Supreme × Timberland", note: "Wave 204" },
  supreme_drmartens_collab: { status: "ready", label: "Supreme × Dr.Martens", note: "Wave 204" },
  supreme_vans_collab: { status: "ready", label: "Supreme × Vans", note: "Wave 204" },
  supreme_backpack: { status: "ready", label: "Supreme Backpack (FW/SS)", note: "Wave 204 bag" },
  supreme_shoulder_bag: { status: "ready", label: "Supreme Shoulder/Mesh/Side", note: "Wave 204 bag" },
  // Wave 205 (2026-05-18): 가격 친화 brand — 크록스(매물 faved 48~108!) + 칼하트 + 아크네 + 메종키츠네 가방
  crocs_classic_clog: { status: "ready", label: "Crocs Classic Clog (시그니처)", note: "Wave 205 — 가격 친화 ⭐" },
  crocs_bayaband: { status: "ready", label: "Crocs Bayaband", note: "Wave 205" },
  crocs_crush: { status: "ready", label: "Crocs Crush / Mega Crush", note: "Wave 205" },
  crocs_platform: { status: "ready", label: "Crocs Platform 키높이", note: "Wave 205" },
  crocs_eco_clog: { status: "ready", label: "Crocs Eco Clog", note: "Wave 205" },
  carhartt_backpack: { status: "ready", label: "Carhartt WIP Backpack", note: "Wave 205 bag" },
  carhartt_messenger: { status: "ready", label: "Carhartt WIP Messenger/Clutch", note: "Wave 205 bag" },
  carhartt_converse_collab: { status: "ready", label: "Converse × Carhartt WIP", note: "Wave 205 collab" },
  carhartt_salomon_collab: { status: "ready", label: "Salomon × Carhartt WIP (등산화)", note: "Wave 205 collab" },
  acne_triplo: { status: "ready", label: "Acne Triplo", note: "Wave 205 shoe" },
  acne_bertin_boots: { status: "ready", label: "Acne Bertin Boots", note: "Wave 205 shoe" },
  acne_manhattan: { status: "ready", label: "Acne Manhattan Sneakers", note: "Wave 442 shoe split" },
  acne_rockaway: { status: "ready", label: "Acne Rockaway Sneakers", note: "Wave 442 shoe split" },
  acne_pvc_tote: { status: "ready", label: "Acne PVC Tote", note: "Wave 205 bag" },
  acne_musubi: { status: "ready", label: "Acne Musubi (시그니처)", note: "Wave 205 bag" },
  acne_apparel: { status: "ready", label: "Acne Apparel (broad fallback)", note: "Wave 715 P0#5 — 150x spread audit, 추가 bag 모델명 (plaque/whitley/kobenhavn/banner/knot backpack/mini musubi) + 라프시몬스/face logo/vintage 차단." },
  // Wave 219 (2026-05-19): Acne product type 5분리 — 티 130K vs 맨투맨 230K vs 자켓 590K vs 데님 320K vs 셔츠 380K
  acne_tee: { status: "ready", label: "Acne Tee / Long-Sleeve", note: "Wave 219" },
  acne_sweat: { status: "ready", label: "Acne Sweat/Hoodie (Fairview)", note: "Wave 219" },
  acne_jacket_coat: { status: "ready", label: "Acne Jacket/Coat", note: "Wave 219" },
  acne_shorts: { status: "ready", label: "Acne Shorts", note: "Wave 449 conservative shorts split" },
  acne_dress: { status: "ready", label: "Acne Dress / One-Piece", note: "Wave 450 conservative dress split" },
  acne_pants: { status: "ready", label: "Acne Pants / Trousers", note: "Wave 451 conservative pants split" },
  acne_knit: { status: "ready", label: "Acne Knit / Cardigan", note: "Wave 453 conservative knit split" },
  acne_polo: { status: "ready", label: "Acne Polo / Rugby Shirt", note: "Wave 454 conservative polo split" },
  acne_cap: { status: "ready", label: "Acne Cap / Hat", note: "Wave 454 conservative cap split" },
  acne_denim: { status: "ready", label: "Acne Denim (Jean/Shorts)", note: "Wave 219" },
  acne_shirt: { status: "ready", label: "Acne Shirt", note: "Wave 219" },
  kitsune_tote: { status: "ready", label: "Maison Kitsuné Tote/Eco", note: "Wave 205 bag" },
  // Wave 206 (2026-05-18): 푸마 매물 폭발적 — 스피드캣/팔레르모/Open YY/스웨이드/축구화
  puma_speedcat: { status: "ready", label: "Puma Speedcat (시그니처)", note: "Wave 206 — 매물 다수 faved 11~43" },
  puma_palermo: { status: "ready", label: "Puma Palermo", note: "Wave 206 — 매물 다수" },
  puma_openyy_collab: { status: "ready", label: "Puma × Open YY (한국 한정)", note: "Wave 206 collab" },
  puma_suede_classic: { status: "ready", label: "Puma Suede/Clyde/GV Special", note: "Wave 206" },
  puma_football: { status: "ready", label: "Puma Football/Futsal (Ultra/King/Future)", note: "Wave 206" },
  // Wave 207 (2026-05-18): 미즈노 축구화/풋살화 — 매물 80건+ 폭발적, 가품 risk 낮음
  mizuno_morelia: { status: "ready", label: "Mizuno Morelia (basic/II)", note: "Wave 207 축구화" },
  mizuno_morelia_neo: { status: "ready", label: "Mizuno Morelia Neo (III/IV)", note: "Wave 207 — 매물 매우 다수" },
  mizuno_alpha: { status: "ready", label: "Mizuno Alpha (1/2/3)", note: "Wave 207" },
  mizuno_monarcida: { status: "ready", label: "Mizuno Monarcida (보급)", note: "Wave 207" },
  mizuno_sala: { status: "ready", label: "Mizuno Morelia Sala (풋살화)", note: "Wave 207" },
  // Wave 208 (2026-05-18): 살로몬 본 라인 매물 60건+ 압도적
  salomon_xt_6: { status: "ready", label: "Salomon XT-6 (시그니처)", note: "Wave 208 — 매물 매우 다수" },
  salomon_xt_series: { status: "ready", label: "Salomon XT Series (Quest/Whisper/Wings/4)", note: "Wave 208" },
  salomon_xa_pro: { status: "ready", label: "Salomon XA Pro/Comp/로그", note: "Wave 208" },
  salomon_acs_pro: { status: "ready", label: "Salomon ACS Pro/+OG", note: "Wave 208" },
  salomon_speedcross: { status: "ready", label: "Salomon Speedcross", note: "Wave 208" },
  salomon_x_ultra: { status: "ready", label: "Salomon X-Ultra GTX", note: "Wave 208" },
  // Wave 209 (2026-05-18): 아식스 본 라인 + collab — 매물 60+건 폭발적
  asics_gel_1130: { status: "ready", label: "Asics Gel-1130 (시그니처)", note: "Wave 209 — 매물 매우 다수" },
  asics_gel_kayano: { status: "ready", label: "Asics Gel Kayano (14/26/27)", note: "Wave 209" },
  asics_gel_nimbus: { status: "ready", label: "Asics Gel Nimbus", note: "Wave 209" },
  asics_gel_kinetic: { status: "ready", label: "Asics Gel Kinetic", note: "Wave 209" },
  asics_novablast: { status: "ready", label: "Asics Novablast/Superblast", note: "Wave 209" },
  asics_jog_100: { status: "ready", label: "Asics Jog 100/Life Walker (입문)", note: "Wave 209" },
  asics_kiko_collab: { status: "ready", label: "Asics × Kiko Kostadinov (collab)", note: "Wave 209" },
  asics_cecilie_bahnsen_collab: { status: "ready", label: "Asics × Cecilie Bahnsen (한정)", note: "Wave 209 faved 41~75!" },
  // Wave 210 (2026-05-18): 호카 추가 + FOG + 챔피온/토미힐피거
  hoka_mafate_speed: { status: "ready", label: "Hoka Mafate Speed 4 (트레일)", note: "Wave 210 — 매물 다수" },
  hoka_mach: { status: "ready", label: "Hoka Mach (5/6)", note: "Wave 210" },
  hoka_kaha_gtx: { status: "ready", label: "Hoka Kaha 2 GTX (등산화)", note: "Wave 210" },
  hoka_anacapa: { status: "ready", label: "Hoka Anacapa Breeze Low", note: "Wave 210" },
  nike_fog_collab: { status: "ready", label: "Nike × FOG (Air FOG/라이트본/Raid/스카이론)", note: "Wave 210 한정 collab" },
  adidas_fog_collab: { status: "ready", label: "Adidas × FOG Athletics 86", note: "Wave 210 한정 collab" },
  fog_fear_of_god_self: { status: "ready", label: "Fear of God 자체 (8th/디스턴스 러너/캘리포니아 뮬)", note: "Wave 210" },
  champion_trainer: { status: "ready", label: "Champion Trainer/Slipper", note: "Wave 210 입문" },
  tommy_hilfiger_bag: { status: "ready", label: "Tommy Hilfiger Bag", note: "Wave 210 bag" },
  // Wave 211 (2026-05-19): 나이키 Air Max 시리즈 + Blazer + Sacai collab
  nike_airmax_1: { status: "ready", label: "Nike Air Max 1", note: "Wave 211" },
  nike_airmax_90: { status: "ready", label: "Nike Air Max 90", note: "Wave 211 — 매물 다수 (faved 30!)" },
  nike_airmax_95: { status: "ready", label: "Nike Air Max 95", note: "Wave 211 — 매물 매우 다수" },
  nike_airmax_97: { status: "ready", label: "Nike Air Max 97", note: "Wave 211 — 매물 매우 다수 (faved 36)" },
  nike_blazer_broad: { status: "ready", label: "Nike Blazer (broad fallback)", note: "Wave 219: Mid/Low/Hi 분리 후 catch-all" },
  // Wave 220 (2026-05-19): orphan sku_id cleanup — Air Force 1 Low Black 시그니처.
  nike_airforce_1_low_black: { status: "ready", label: "Nike Air Force 1 Low Black (Triple Black)", note: "Wave 220 — orphan cleanup, 79건 매물 진입" },
  // Wave 226 (2026-05-19): Nike/Adidas/NB 누락 인기 narrow lane (사용자 명시 "Nike/Adidas/뉴발 narrow 추가").
  //   측정 결과: NB iconic 718 / Samba 218 / Cortez 206 매물 unmatched. catalog 신규 + 530 mustContain fix.
  newbalance_574_broad: { status: "ready", label: "NB 574 (broad)", note: "Wave 226" },
  newbalance_2002r: { status: "ready", label: "NB 2002R", note: "Wave 226" },
  newbalance_9060: { status: "ready", label: "NB 9060 (Y2K)", note: "Wave 226" },
  newbalance_990v3: { status: "ready", label: "NB 990v3 (MIUSA)", note: "Wave 226" },
  newbalance_990v4: { status: "ready", label: "NB 990v4 (MIUSA)", note: "Wave 226" },
  nike_cortez: { status: "ready", label: "Nike Cortez (Classic/Nylon)", note: "Wave 226" },
  adidas_samba_kith: { status: "ready", label: "KITH × Samba (collab)", note: "Wave 226 한정" },
  adidas_samba_wales_bonner: { status: "ready", label: "Wales Bonner × Samba", note: "Wave 226 한정" },
  adidas_samba_pharrell: { status: "ready", label: "Pharrell × Samba Humanrace", note: "Wave 226 한정" },
  adidas_samba_sporty_rich: { status: "ready", label: "Sporty & Rich × Samba", note: "Wave 226 한정" },
  // Wave 227 (2026-05-19): 의류/가방 누락 narrow.
  // Wave 245.2 (2026-05-19): FOG Essentials 6 narrow + 1 broad — product-type 별 시세 분리.
  fog_essentials: { status: "ready", label: "FOG Essentials (legacy laneKey)", note: "Wave 686 release — broad fallback (narrow 6개 다 ready), 데님/뉴에라/벨트백/아노락 추가 차단." },
  fog_essentials_broad: { status: "ready", label: "FOG Essentials (broad fallback — 베스트/니트/플리스/모자)", note: "Wave 686 release — narrow 6개 fallback, 데님/캡/가방/아노락 cross-category 차단." },
  fog_essentials_hoodie: { status: "ready", label: "FOG Essentials Hoodie", note: "Wave 245.2 — median 16만" },
  fog_essentials_crewneck: { status: "ready", label: "FOG Essentials Crewneck / Sweat", note: "Wave 245.2 — median 7.2만" },
  fog_essentials_tee: { status: "ready", label: "FOG Essentials Tee", note: "Wave 245.2 — median 5.5만" },
  fog_essentials_pants: { status: "ready", label: "FOG Essentials Pants (스웻팬츠/조거)", note: "Wave 245.2 — median 9.5만" },
  fog_essentials_shorts: { status: "ready", label: "FOG Essentials Shorts (반바지)", note: "Wave 245.2 — median 6만" },
  fog_essentials_jacket: { status: "ready", label: "FOG Essentials Jacket (자켓/아노락)", note: "Wave 245.2 — median 18.2만" },
  coach_broad: { status: "ready", label: "Coach Bag (broad)", note: "Wave 227 가품 식별 가능" },
  coach_tabby: { status: "ready", label: "Coach Tabby (시그니처)", note: "Wave 227" },
  longchamp_le_pliage: { status: "ready", label: "Longchamp Le Pliage (시그니처)", note: "Wave 227 나일론" },
  nike_tailwind_79: { status: "ready", label: "Nike Tailwind 79 (Vintage Runner)", note: "Wave 227" },
  adidas_trefoil: { status: "ready", label: "Adidas Trefoil/Track Suit", note: "Wave 678 release — Wave 652/676에서 레더/세트/누빔/플라워/빈티지 블루종 명시 차단. LATEST v32 spread <4x." },
  // Wave 233 (2026-05-19): Vans 시리즈 누락 — 239 매물 unmatched (일반인 친화 15~60K).
  vans_old_skool: { status: "ready", label: "Vans Old Skool", note: "Wave 233" },
  vans_sk8_hi: { status: "ready", label: "Vans SK8-Hi", note: "Wave 233" },
  vans_authentic: { status: "ready", label: "Vans Authentic", note: "Wave 233" },
  vans_era: { status: "ready", label: "Vans Era", note: "Wave 233" },
  vans_slip_on: { status: "ready", label: "Vans Slip-On", note: "Wave 233" },
  // Wave 235 (2026-05-19): collab variant 분리 — broad SKU stddev 진단 mismatch 발굴.
  offwhite_blazer_mid_collab: { status: "ready", label: "Off-White × Nike Blazer Mid", note: "Wave 235 collab — Blazer Mid broad 95만/73만 mismatch 색출" },
  bape_vans_collab: { status: "ready", label: "BAPE × Vans (Old Skool/Sk8-Hi LX)", note: "Wave 235 collab" },
  clot_superstar_collab: { status: "ready", label: "Clot × Adidas Superstar", note: "Wave 235 collab — Superstar broad 90만 mismatch" },
  thugclub_superstar_collab: { status: "ready", label: "Thug Club × Adidas Superstar (떠그다스)", note: "Wave 235 collab — 한국 인기" },
  vans_sato_era_collab: { status: "ready", label: "Vans × Sato Era 95 (Satoshi 한정)", note: "Wave 235 collab — Era broad 85만~108만 mismatch" },
  // Wave 219 (2026-05-19): Nike Blazer variant 분리 — Mid 119K / Low/Platform 99K / Hi 129K
  nike_blazer_mid: { status: "ready", label: "Nike Blazer Mid / Mid 77", note: "Wave 219" },
  nike_blazer_low: { status: "ready", label: "Nike Blazer Low / Low 77 / Platform", note: "Wave 219" },
  nike_blazer_high: { status: "ready", label: "Nike Blazer Hi / High", note: "Wave 219" },
  nike_sakai_collab: { status: "ready", label: "Nike × Sacai", note: "Wave 211 collab — 매물 다수" },
  // Wave 212 (2026-05-19): 아디다스 추가 13 SKU — 매물 폭발적 (셔링백 faved 252~255 압도적)
  adidas_shering: { status: "ready", label: "Adidas Shering Hobo Bag (시그니처)", note: "Wave 212 — 매물 1위 faved 252~255!" },
  adidas_cross_mini: { status: "ready", label: "Adidas Mini Cross/힙색/웨이스트", note: "Wave 212" },
  adidas_campus: { status: "ready", label: "Adidas Campus (00s/Japan)", note: "Wave 212" },
  adidas_spezial: { status: "ready", label: "Adidas Spezial", note: "Wave 212" },
  adidas_forum: { status: "ready", label: "Adidas Forum (Low/Mid)", note: "Wave 212" },
  adidas_sl72: { status: "ready", label: "Adidas SL72 (vintage)", note: "Wave 212" },
  adidas_stansmith_broad: { status: "ready", label: "Adidas Stan Smith (broad)", note: "Wave 212" },
  adidas_superstar_broad: { status: "ready", label: "Adidas Superstar (broad)", note: "Wave 212" },
  adidas_ultraboost: { status: "ready", label: "Adidas Ultra Boost", note: "Wave 212" },
  adidas_adilette: { status: "ready", label: "Adidas Adilette (슬리퍼)", note: "Wave 212" },
  adidas_football: { status: "ready", label: "Adidas Football (F50/Predator/Copa/X)", note: "Wave 212" },
  adidas_adizero: { status: "ready", label: "Adidas Adizero (러닝)", note: "Wave 212" },
  adidas_balenciaga_collab: { status: "ready", label: "Adidas × Balenciaga (한정)", note: "Wave 212 collab" },
  adidas_rafsimons_collab: { status: "ready", label: "Adidas × Raf Simons", note: "Wave 212 collab" },
  // Wave 214 (2026-05-19): 의류 mainstream 9 SKU — 사용자 정책 "옷 안 버린다"
  bape_tee: { status: "ready", label: "BAPE T-Shirt (Ape Head/카모)", note: "Wave 679 release — Wave 241/593/632/679 누적 차단: 요시다포터/챔피온/풋볼/사쿠라/빅사루/롱슬리브/빈티지 시즌 명시. spread 9.5x → 차단 후 추정 <6x." },
  bape_hoodie: { status: "ready", label: "BAPE Hoodie (basic/camo)", note: "Wave 680 release — PONR/Patchwork/85주년/톰제리/인형 묶음 + 가품 시그널 (흑계/대장급/정품 택O) + 빈티지 시즌 차단." },
  bape_hoodie_zip: { status: "ready", label: "BAPE Hoodie Zip (basic/camo)", note: "Wave 681 release — bape_hoodie 패턴 spread (PONR/Patchwork/85주년/가품 시그널/빈티지) 동일 차단." },
  bape_crewneck: { status: "ready", label: "BAPE Crewneck / Sweatshirt", note: "Wave 681 release — 추가 collab/한정/가품 시그널/빈티지 시즌 명시 차단." },
  bape_shark_hoodie: { status: "ready", label: "BAPE Shark Hoodie (시그니처)", note: "Wave 214 한정" },
  matinkim_apparel: { status: "ready", label: "Matin Kim Apparel (한국 designer)", note: "Wave 689 release — 매물 풀 거의 없음 (release 안전), 한국 designer 가격대 명확." },
  reebok_apparel: { status: "blocked", label: "Reebok Apparel (트랙수트/티)", note: "Wave 407: broad apparel hold until model-level audit." },
  arcteryx_apparel: { status: "ready", label: "Arc'teryx Apparel (broad fallback)", note: "Wave 688 release — narrow Beta/Gamma/Alpha/Atom/Vertex 다 ready, LEAF/System A/Fission/Solano/Gen 2.1 차단." },
  // Wave 218 (2026-05-19): Arc'teryx 모델별 narrow 5개 — 가격대 X 3-5 (Beta 600K vs Squamish 190K)
  arcteryx_beta: { status: "ready", label: "Arc'teryx Beta (SL/AR/LT)", note: "Wave 218 Gore-Tex" },
  arcteryx_gamma: { status: "ready", label: "Arc'teryx Gamma (MX/SL/LT)", note: "Wave 218 softshell" },
  arcteryx_alpha: { status: "ready", label: "Arc'teryx Alpha (SV/AR/FL)", note: "Wave 218 등반/expedition" },
  arcteryx_atom: { status: "ready", label: "Arc'teryx Atom (LT/SL/HW)", note: "Wave 218 insulated" },
  arcteryx_vertex_squamish: { status: "ready", label: "Arc'teryx Vertex / Squamish", note: "Wave 218 etc" },
  arcteryx_broad: { status: "ready", label: "Arc'teryx (broad fallback)", note: "Wave 688 release — narrow 5개 ready, 특수 라인 (LEAF/System A/Fission/Solano/Gen 2.1) cross-product 차단." },
  fila_apparel: { status: "ready", label: "Fila Apparel", note: "Wave 689 release — 6건 spread 3.5x (2~7만), 가격대 안정." },
  patagonia_apparel: { status: "ready", label: "Patagonia (broad fallback)", note: "Wave 687 release — broad fallback (narrow retro_x/shell/deep_pile/down 다 ready), 40주년/레거시/빈티지(80s/90s/00s)/US Made/딥파일 차단." },
  patagonia_synchilla: { status: "ready", label: "Patagonia Synchilla / Snap-T (시그니처 플리스)", note: "Wave 712a — bias-free 검증으로 162건/주 시그니처 모델. Wave 654가 broad에서 차단만 하고 narrow 안 박아 30~131건 잘못 매칭됐던 black hole 해결." },
  // Wave 219 (2026-05-19): Patagonia 3분리 — Retro X 199K / Down 290K / Shell 199K
  patagonia_retro_x: { status: "ready", label: "Patagonia Retro X (단독, 신칠라 분리됨)", note: "Wave 678 release — Wave 654에서 mustContain narrow + 신칠라/스냅T/캔버스 fleece 명시 차단. LATEST v32 spread <4x." },
  patagonia_down: { status: "ready", label: "Patagonia Down (Nano Puff)", note: "Wave 687 release — 40주년 레거시/80s 빈티지/US Made/00s Fitz Roy 차단." },
  patagonia_shell: { status: "ready", label: "Patagonia Shell (Torrentshell)", note: "Wave 219" },
  // Wave 251.2 (2026-05-19): Deep Pile 90s 빈티지 콜렉터 narrow split (p50 ₩390k vs mainstream ₩165k).
  patagonia_deep_pile: { status: "ready", label: "Patagonia Deep Pile (90s 빈티지)", note: "Wave 251.2 — n=10, mainstream 2.4배 시세" },
  mlb_apparel: { status: "ready", label: "MLB Cap (broad fallback)", note: "Wave 689 release — cap-only SKU (mustContain '모자/cap' 강제), Wave 689에서 어센틱 덕아웃/이정후/오타니/FOG x MLB collab/빈티지 차단." },
  // Wave 219 (2026-05-19): MLB collab 분리 — Gucci 480K / Nike 79K / Murakami 220K vs 일반 49K
  mlb_cap_gucci_collab: { status: "ready", label: "Gucci × MLB Cap (한정 명품)", note: "Wave 219" },
  mlb_cap_nike_collab: { status: "ready", label: "Nike × MLB Cap", note: "Wave 219" },
  mlb_cap_murakami_collab: { status: "ready", label: "Murakami × MLB Cap (9twenty)", note: "Wave 219" },
  discovery_apparel: { status: "ready", label: "Discovery Expedition", note: "Wave 689 release — 한국 익숙 브랜드, 매물 풀 작아 안전." },
  // Wave 215 (2026-05-19): Yeezy + BAPE STA + Stussy 8 Ball
  yeezy_boost_350: { status: "ready", label: "Yeezy Boost 350 (V1/V2)", note: "Wave 215 — Yeezy 매물 521건 압도적" },
  yeezy_boost_500_700: { status: "ready", label: "Yeezy Boost 500/700", note: "Wave 215" },
  yeezy_slide: { status: "ready", label: "Yeezy Slide", note: "Wave 215" },
  yeezy_foam_runner: { status: "ready", label: "Yeezy Foam Runner", note: "Wave 215" },
  bape_sta: { status: "ready", label: "BAPE STA (Bapesta 신발)", note: "Wave 215" },
  stussy_8ball_knit: { status: "ready", label: "Stüssy 8 Ball Knit", note: "Wave 215" },
  // Wave 691 (2026-05-23) — 신규 핵심 brand 신설 (Pareto top — 5,300건/주 매물 lane 없던 brand).
  shoe_ugg_classic_broad: { status: "ready", label: "UGG Classic Boot (Short/Mini/Tall/Ultra Mini)", note: "Wave 691 — 695 매물/주, 여성 친화. '어그로' 슬랭/가방/패딩/픽시 자전거 차단." },
  shoe_adidas_samba_broad: { status: "ready", label: "Adidas Samba (Broad — OG/Classic)", note: "Wave 691 — 400+ 매물/주, collab 4개 별도. Wales Bonner/Pharrell/Kith/Sporty 차단." },
  shoe_adidas_gazelle_broad: { status: "ready", label: "Adidas Gazelle (OG/Indoor broad)", note: "Wave 691 — 601 매물/주, lane 부재 신설. Wales Bonner/Gucci/Kith collab 차단." },
  shoe_nike_dunk_low_broad: { status: "ready", label: "Nike Dunk Low (Broad — 일반 colorway)", note: "Wave 691 — 1,374 매물/주, Wave 134 narrow (Panda + Black/White)에서 흡수 안 된 일반 colorway. SP/한정/SB/Travis/Off-White/AMBUSH 차단." },
  shoe_nike_airjordan_1_low: { status: "ready", label: "Air Jordan 1 Low (broad)", note: "Wave 691 — AJ 2,231 매물/주. 가품 위험 큼 — collab(Travis/Off-White/Fragment/Dior/Union)/11급/SS급정품 강력 차단." },
  shoe_nike_airjordan_1_mid: { status: "ready", label: "Air Jordan 1 Mid (broad)", note: "Wave 691 — Mid colorway broad. High/Low 별도, collab/한정 다 차단." },
  // Wave 693 (2026-05-23): AJ family 확장 (AJ1 High / AJ3 / AJ4 / AJ11) — 337 매물/주.
  shoe_nike_airjordan_1_high: { status: "ready", label: "Air Jordan 1 High (broad)", note: "Wave 693 — 128 매물/주, 가품 위험 큼. Travis/Off-White/Dior/Fragment/Union/Spider Verse + 11급/SS급/1:1 차단." },
  shoe_nike_airjordan_3: { status: "ready", label: "Air Jordan 3 (broad)", note: "Wave 693 — 34 매물/주, Retro 3세대. Travis/Off-White/Dior collab 차단." },
  shoe_nike_airjordan_4: { status: "ready", label: "Air Jordan 4 (broad)", note: "Wave 693 — 130 매물/주, 가품 매우 큼. Travis/Off-White/KAWS/Union/에미넴/OVO collab 차단." },
  shoe_nike_airjordan_11: { status: "ready", label: "Air Jordan 11 (broad)", note: "Wave 693 — 45 매물/주, Retro 11세대." },
  // Wave 694 (2026-05-23) — Dunk Low 32 narrow SKU 신설 (Agent deep sweep 966건 분석 후 89% 색상 식별률 달성).
  // 1단계 (16): COLLAB 5 + Mass narrow 11
  shoe_nike_dunk_low_offwhite: { status: "ready", label: "Off-White x Dunk Low (The 50)", note: "Wave 694 — 56 매물, 가격 5~65만 collab. mustContain lot/the 50/오프화이트." },
  shoe_nike_dunk_low_supreme: { status: "ready", label: "Supreme SB Dunk Low", note: "Wave 694 — 29 매물 15~95만, Supreme/라멜지/오션포그/쥬얼." },
  shoe_nike_dunk_low_kasina: { status: "ready", label: "Kasina x Dunk Low (한국 collab)", note: "Wave 694 — 13 매물 5~75만, 80's 버스/넵튠." },
  shoe_nike_dunk_low_travis_scott: { status: "ready", label: "Travis Scott SB Dunk Low", note: "Wave 694 — 8 매물 200~400만 한정. 가품 위험 매우 큼." },
  shoe_nike_dunk_low_undefeated: { status: "ready", label: "Undefeated x Dunk Low SP", note: "Wave 694 — 12 매물, 5 On It / SP 시리즈." },
  shoe_nike_dunk_low_university_red: { status: "ready", label: "Dunk Low University Red (유레드)", note: "Wave 694 — 18 매물, 유레드/팀레드 줄임말 포함." },
  shoe_nike_dunk_low_university_blue: { status: "ready", label: "Dunk Low University Blue (유블루)", note: "Wave 694 — 14 매물." },
  shoe_nike_dunk_low_court_purple: { status: "ready", label: "Dunk Low Court Purple (코퍼)", note: "Wave 694 — 17 매물, 한국 줄임말 코퍼/챔피언쉽 코트 퍼플." },
  shoe_nike_dunk_low_coast: { status: "ready", label: "Dunk Low Coast (WMNS)", note: "Wave 694 — 14 매물 연파랑." },
  shoe_nike_dunk_low_wolf_grey: { status: "ready", label: "Dunk Low Wolf Grey", note: "Wave 694 — 12 매물." },
  shoe_nike_dunk_low_grey_fog: { status: "ready", label: "Dunk Low Grey Fog", note: "Wave 694 — 12 매물 (Jackpot Grey Fog 별도)." },
  shoe_nike_dunk_low_midnight_navy: { status: "ready", label: "Dunk Low Midnight Navy (미네)", note: "Wave 694 — 11 매물, 미네 줄임말." },
  shoe_nike_dunk_low_chicago: { status: "ready", label: "Dunk Low Chicago", note: "Wave 694 — 11 매물 (SB Pro Chicago 별도)." },
  shoe_nike_dunk_low_varsity_green: { status: "ready", label: "Dunk Low Varsity Green", note: "Wave 694 — 11 매물." },
  shoe_nike_dunk_low_halloween: { status: "ready", label: "Dunk Low Halloween (시즌 한정)", note: "Wave 694 — 18 매물, 시즌 한정." },
  shoe_nike_dunk_low_disrupt: { status: "ready", label: "Dunk Low Disrupt (silhouette 분리)", note: "Wave 694 — 15 매물, Disrupt 2 통합." },
  // 2단계 (16): MEDIUM narrow (5~10 매물)
  shoe_nike_dunk_low_gym_red: { status: "ready", label: "Dunk Low Gym Red (≠ University Red)", note: "Wave 694 — 8 매물, 짐레드 별 colorway." },
  shoe_nike_dunk_low_lx: { status: "ready", label: "Dunk Low LX (Premium Leather/Suede)", note: "Wave 694 — 9 매물." },
  shoe_nike_dunk_low_medium_curry: { status: "ready", label: "Dunk Low Medium Curry", note: "Wave 694 — 9 매물, 미디엄 커리/커리 통합." },
  shoe_nike_dunk_low_smoke_grey: { status: "ready", label: "Dunk Low Smoke Grey", note: "Wave 694 — 8 매물." },
  shoe_nike_dunk_low_photon_dust: { status: "ready", label: "Dunk Low Photon Dust", note: "Wave 694 — 8 매물." },
  shoe_nike_dunk_low_golden_road: { status: "ready", label: "Dunk Low Golden Road", note: "Wave 694 — 8 매물 Championship Goldenrod." },
  shoe_nike_dunk_low_varsity_maize: { status: "ready", label: "Dunk Low Varsity Maize", note: "Wave 694 — 7 매물." },
  shoe_nike_dunk_low_jackpot: { status: "ready", label: "Dunk Low Jackpot (Malachite)", note: "Wave 694 — 7 매물." },
  shoe_nike_dunk_low_paisley: { status: "ready", label: "Dunk Low Paisley (Bandana)", note: "Wave 694 — 7 매물." },
  shoe_nike_dunk_low_zebra: { status: "ready", label: "Dunk Low Zebra", note: "Wave 694 — 6 매물 (SB Quartersnacks 별도)." },
  shoe_nike_dunk_low_light_bone: { status: "ready", label: "Dunk Low Light Bone", note: "Wave 694 — 6 매물." },
  shoe_nike_dunk_low_clear_jade: { status: "ready", label: "Dunk Low Clear Jade (코끼리덩크)", note: "Wave 694 — 6 매물, 한국 별명 코끼리덩크." },
  shoe_nike_dunk_low_summit_white: { status: "ready", label: "Dunk Low Summit White (Triple White)", note: "Wave 694 — 6 매물, Panda와 분리." },
  shoe_nike_dunk_low_akio_pink: { status: "ready", label: "Dunk Low Akio Pink (WMNS)", note: "Wave 694 — 5 매물." },
  shoe_nike_dunk_low_union: { status: "ready", label: "Union x Dunk Low (Passport Pack)", note: "Wave 694 — 5 매물 collab." },
  shoe_nike_dunk_low_lebron_pebbles: { status: "ready", label: "LeBron x Fruity Pebbles Dunk Low", note: "Wave 694 — 5 매물 collab." },
  // SB Pro broad (silhouette 분리)
  shoe_nike_sb_dunk_low_broad: { status: "ready", label: "Nike SB Dunk Low Pro (Broad)", note: "Wave 694 — SB Pro 일반 (collab 16+ 차단). 가품 위험 큼." },
  // Wave 695 (2026-05-23) — AJ1 30 narrow SKU 신설 (Agent deep sweep 1500건, 한국 은어 다 매핑).
  // 1단계 COLLAB 7개 (가품 위험 매우 큼):
  shoe_nike_jordan_1_low_cactus_jack_olive: { status: "ready", label: "AJ1 Low Travis Scott Cactus Jack Olive", note: "Wave 695 — 41 매물 collab, 평균 567K." },
  shoe_nike_jordan_1_low_travis_phantom: { status: "ready", label: "AJ1 Low Travis Phantom", note: "Wave 695 — 19 매물 collab, 평균 717K." },
  shoe_nike_jordan_1_low_fragment: { status: "ready", label: "AJ1 Low Fragment", note: "Wave 695 — 23 매물 collab, 평균 1.43M." },
  shoe_nike_jordan_1_low_fragment_travis_military_blue: { status: "ready", label: "AJ1 Low Fragment x Travis Military Blue (highest tier)", note: "Wave 695 — 4 매물, 평균 2.11M 최고가." },
  shoe_nike_jordan_1_high_union_la: { status: "ready", label: "AJ1 High Union LA", note: "Wave 695 — 22 매물 collab, 평균 346K." },
  shoe_nike_jordan_1_high_off_white: { status: "ready", label: "AJ1 High Off-White", note: "Wave 695 — 26 매물 collab, 평균 1.36M." },
  shoe_nike_jordan_1_high_alaska_vaa: { status: "ready", label: "AJ1 High Alaska VAA (Vibram)", note: "Wave 695 — 17 매물 collab, 평균 660K." },
  // 1단계 Mass narrow 10개:
  shoe_nike_jordan_1_high_dark_mocha: { status: "ready", label: "AJ1 High Dark Mocha", note: "Wave 695 — 23 매물, 평균 209K." },
  shoe_nike_jordan_1_high_hyper_royal: { status: "ready", label: "AJ1 High Hyper Royal", note: "Wave 695 — 18 매물." },
  shoe_nike_jordan_1_high_shattered_backboard: { status: "ready", label: "AJ1 High Shattered Backboard (SBB)", note: "Wave 695 — 14 매물." },
  shoe_nike_jordan_1_high_killer_whale: { status: "ready", label: "AJ1 High Killer Whale (범고래)", note: "Wave 695 — 11 매물, 한국 은어." },
  // Wave 703 (2026-05-23) HOTFIX: latushi 라벨 정정 — Pearl Pink가 아닌 SB Defiant LA to Chicago (Court Purple).
  shoe_nike_jordan_1_high_sb_la_to_chicago: { status: "ready", label: "AJ1 High SB Defiant LA to Chicago", note: "Wave 703 fix — 라투시/벗투시 = LA to Chicago (Court Purple/Sail/Univ Gold). 12 매물." },
  shoe_nike_jordan_1_high_black_toe: { status: "ready", label: "AJ1 High Black Toe", note: "Wave 695 — 8 매물." },
  shoe_nike_jordan_1_low_starfish: { status: "ready", label: "AJ1 Low Starfish", note: "Wave 695 — 25 매물." },
  shoe_nike_jordan_1_mid_grey_fog_w: { status: "ready", label: "AJ1 Mid Grey Fog (WMNS)", note: "Wave 695 — 15 매물 WMNS." },
  shoe_nike_jordan_1_mid_midnight_navy_cojp: { status: "ready", label: "AJ1 Mid Midnight Navy CO.JP", note: "Wave 695 — 7 매물 Japan exclusive." },
  shoe_nike_jordan_1_low_magpie_snkrs_korea: { status: "ready", label: "AJ1 Low Magpie 까치 (SNKRS Day Korea)", note: "Wave 695 — 한국 발매 명칭." },
  // 2단계 Mass narrow (5~10 매물):
  shoe_nike_jordan_1_high_court_purple: { status: "ready", label: "AJ1 High Court Purple", note: "Wave 695 — 11 매물." },
  shoe_nike_jordan_1_high_pine_green: { status: "ready", label: "AJ1 High Pine Green", note: "Wave 695 — 7 매물." },
  shoe_nike_jordan_1_high_lucky_green: { status: "ready", label: "AJ1 High Lucky Green", note: "Wave 695 — 10 매물." },
  shoe_nike_jordan_1_high_obsidian: { status: "ready", label: "AJ1 High Obsidian", note: "Wave 695 — 6 매물." },
  shoe_nike_jordan_1_high_yellow_toe_taxi: { status: "ready", label: "AJ1 High Yellow Toe (Taxi)", note: "Wave 695 — 7 매물." },
  shoe_nike_jordan_1_high_bordeaux: { status: "ready", label: "AJ1 High Bordeaux", note: "Wave 695 — 5 매물." },
  shoe_nike_jordan_1_high_patent_bred: { status: "ready", label: "AJ1 High Patent Bred", note: "Wave 695 — 5 매물." },
  shoe_nike_jordan_1_mid_smoke_grey: { status: "ready", label: "AJ1 Mid Smoke Grey (+Light Smoke)", note: "Wave 695 — 39 매물 (smoke + light smoke 통합)." },
  shoe_nike_jordan_1_low_wolf_grey: { status: "ready", label: "AJ1 Low Wolf Grey", note: "Wave 695 — 12 매물." },
  shoe_nike_jordan_1_low_tokyo_gyokuro: { status: "ready", label: "AJ1 Low Tokyo Gyokuro", note: "Wave 695 — 8 매물." },
  // Collab 2단계:
  shoe_nike_jordan_1_low_nigel_sylvester: { status: "ready", label: "AJ1 Low Nigel Sylvester", note: "Wave 695 — 6 매물 collab." },
  shoe_nike_jordan_1_low_zion_williamson: { status: "ready", label: "AJ1 Low Zion Williamson", note: "Wave 695 — 8 매물 collab." },
  shoe_nike_jordan_1_high_trophy_room: { status: "ready", label: "AJ1 High Trophy Room", note: "Wave 695 — 4 매물 collab." },
  // Silhouette variant:
  shoe_nike_jordan_1_element_goretex: { status: "ready", label: "AJ1 Element Gore-Tex", note: "Wave 695 — 7 매물 silhouette." },
  shoe_nike_jordan_1_zoom_comfort: { status: "ready", label: "AJ1 Zoom Comfort CMFT", note: "Wave 695 — 6 매물 silhouette." },
  // Wave 696 (2026-05-23) — AF1 + Air Max 1단계 22 SKU 신설 (Pareto 80% 흡수)
  // AF1 1단계 Mass narrow 7개:
  shoe_nike_airforce_1_low_triple_white: { status: "ready", label: "AF1 Low Triple White (트화/올화)", note: "Wave 696 — 323 매물 mass, 평균 8만." },
  shoe_nike_airforce_1_low_triple_black: { status: "ready", label: "AF1 Low Triple Black (트블/올블)", note: "Wave 696 — 123 매물 mass." },
  shoe_nike_airforce_1_low_black_white: { status: "ready", label: "AF1 Low Black/White Two-tone", note: "Wave 696 — 27 매물." },
  shoe_nike_airforce_1_mid_07: { status: "ready", label: "AF1 Mid '07 (Black/White)", note: "Wave 696 — 67 매물, Mid 가장 인기." },
  shoe_nike_airforce_1_low_shadow: { status: "ready", label: "AF1 Low Shadow (WMNS)", note: "Wave 696 — 14 매물." },
  shoe_nike_airforce_1_low_goretex: { status: "ready", label: "AF1 Low Gore-Tex (고어텍스포스)", note: "Wave 696 — 20 매물." },
  shoe_nike_airforce_1_low_wheat: { status: "ready", label: "AF1 Low Wheat/Khaki (된장포스)", note: "Wave 696 — 9 매물, 된장포스 한국 은어." },
  // AF1 1단계 COLLAB 6개 (가품 위험):
  shoe_gdragon_airforce1_paranoise: { status: "ready", label: "AF1 Paranoise (지디 콜라보 — 한국 핵심)", note: "Wave 696 — 38 매물, 평균 29만." },
  shoe_stussy_airforce1_collab: { status: "ready", label: "AF1 Stussy Collab", note: "Wave 696 — 33 매물." },
  shoe_offwhite_airforce1_collab: { status: "ready", label: "AF1 Off-White (Brooklyn/MoMA/Lemonade)", note: "Wave 696 — 29 매물, 평균 36만, 가품 폭탄." },
  shoe_ambush_airforce1_collab: { status: "ready", label: "AF1 AMBUSH Collab", note: "Wave 696 — 20 매물." },
  shoe_tiffany_airforce1_collab: { status: "ready", label: "AF1 Tiffany & Co. (가품 위험 매우 큼)", note: "Wave 696 — 평균 70만+." },
  shoe_louis_vuitton_airforce1_virgil: { status: "ready", label: "AF1 LV x Virgil Abloh (luxury 가품 폭탄)", note: "Wave 696 — 평균 43만+, 차단 강력." },
  // Air Max 1단계 — Generation broad 4개:
  shoe_nike_airmax_plus_tn_broad: { status: "ready", label: "Air Max Plus / TN broad", note: "Wave 696 — 30 매물, '플러스' 단독 금지." },
  shoe_nike_airmax_dn_broad: { status: "ready", label: "Air Max DN / DN8 broad (2024 신모델)", note: "Wave 696 — 43 매물." },
  shoe_nike_airmax_270_broad: { status: "ready", label: "Air Max 270 broad", note: "Wave 696 — 30 매물." },
  shoe_nike_airmax_98_broad: { status: "ready", label: "Air Max 98 broad", note: "Wave 696 — 37 매물, 평균 19만." },
  // Air Max 1단계 COLLAB 4개:
  shoe_kasina_airmax_1_sp: { status: "ready", label: "AM1 SP Kasina (원앙) — 한국 collab", note: "Wave 696 — 38 매물." },
  shoe_cdg_nike_airmax_collab: { status: "ready", label: "Air Max CDG Collab (premium — 가품 위험)", note: "Wave 696 — 27 매물, 평균 43만." },
  shoe_travis_nike_airmax_1: { status: "ready", label: "AM1 Travis Scott (Cactus Jack/Wheat)", note: "Wave 696 — 24 매물, 평균 26만." },
  shoe_offwhite_nike_airmax_collab: { status: "ready", label: "Air Max Off-White (90/97)", note: "Wave 696 — 23 매물, 평균 32만." },
  // Wave 698 (2026-05-23) — NB 25 SKU (1단계 14 broad + 11 collab) — Agent deep sweep 3,629건
  shoe_newbalance_327_broad: { status: "ready", label: "NB 327 broad", note: "Wave 698 — 332 매물 mass 1위." },
  shoe_newbalance_2002r_broad: { status: "ready", label: "NB 2002R broad", note: "Wave 698 — 217 매물 mass." },
  shoe_newbalance_992: { status: "ready", label: "NB 992 (Made in USA Premium)", note: "Wave 698 — 215 매물 평균 30만." },
  shoe_newbalance_530_broad: { status: "ready", label: "NB 530 broad (mass 베스트셀러)", note: "Wave 698 — 213 매물." },
  shoe_newbalance_993: { status: "ready", label: "NB 993 (Made in USA)", note: "Wave 698 — 162 매물." },
  shoe_newbalance_1906r_broad: { status: "ready", label: "NB 1906R broad (신상 mass)", note: "Wave 698 — 146 매물." },
  shoe_newbalance_990v6_broad: { status: "ready", label: "NB 990v6 (Made in USA 신상)", note: "Wave 698 — 81 매물." },
  shoe_newbalance_991_broad: { status: "ready", label: "NB 991 (Made in UK)", note: "Wave 698 — 67 매물." },
  shoe_newbalance_1906a_broad: { status: "ready", label: "NB 1906A (실버 메탈릭)", note: "Wave 698 — 63 매물." },
  shoe_newbalance_1400_broad: { status: "ready", label: "NB 1400 (vintage USA)", note: "Wave 698 — 65 매물." },
  shoe_newbalance_1300_broad: { status: "ready", label: "NB 1300 (vintage USA premium)", note: "Wave 698 — 61 매물 평균 27만." },
  shoe_newbalance_1600_broad: { status: "ready", label: "NB 1600 (vintage USA mass)", note: "Wave 698 — 61 매물." },
  shoe_newbalance_1500_broad: { status: "ready", label: "NB 1500 (Made in UK)", note: "Wave 698 — 56 매물." },
  shoe_newbalance_550_broad: { status: "ready", label: "NB 550 broad (농구 retro)", note: "Wave 698 — 29 매물." },
  // NB COLLAB 11개 (가품 위험):
  shoe_newbalance_aime_leon_dore_collab: { status: "ready", label: "NB x ALD Collab", note: "Wave 698 — 76 매물 collab, 가품 위험 큼." },
  shoe_newbalance_cdg_collab: { status: "ready", label: "NB x CDG Collab", note: "Wave 698 — 44 매물." },
  shoe_newbalance_kith_collab: { status: "ready", label: "NB x Kith Collab", note: "Wave 698 — 34 매물." },
  shoe_newbalance_junya_watanabe_collab: { status: "ready", label: "NB x Junya Watanabe", note: "Wave 698 — 29 매물." },
  shoe_newbalance_auralee_collab: { status: "ready", label: "NB x Auralee", note: "Wave 698 — 23 매물." },
  shoe_newbalance_stone_island_collab: { status: "ready", label: "NB x Stone Island", note: "Wave 698 — 21 매물." },
  // Wave 703 (2026-05-23) HOTFIX: 미우미우 SKU 제거 — 사용자 명품 정책 위반 (premium-only ⭐, 가품 풀 큼).
  // shoe_newbalance_miumiu_collab — SKU 삭제됨.
  shoe_newbalance_jjjjound_collab: { status: "ready", label: "NB x JJJJound", note: "Wave 698 — 11 매물 평균 45만." },
  shoe_newbalance_jcrew_collab: { status: "ready", label: "NB x J.Crew (1400)", note: "Wave 698 — 15 매물." },
  shoe_newbalance_casablanca_collab: { status: "ready", label: "NB x Casablanca (327)", note: "Wave 698 — 13 매물." },
  // Wave 700 (2026-05-23) — Crocs collab + 부츠/슬리퍼 + Puma 4 broad
  shoe_crocs_salehe_bembury_collab: { status: "ready", label: "Crocs x Salehe Bembury", note: "Wave 700 — 얼친/팜 한정." },
  shoe_crocs_bape_collab: { status: "ready", label: "Crocs x BAPE", note: "Wave 700 — 네이비/카모 collab." },
  shoe_crocs_balenciaga_collab: { status: "ready", label: "Crocs x Balenciaga (luxury)", note: "Wave 700 — 가품 폭탄, 45만+." },
  shoe_crocs_boots_broad: { status: "ready", label: "Crocs Boots broad", note: "Wave 700 — Classic Boot / Mega Crush / Echo Boot." },
  shoe_crocs_slipper_broad: { status: "ready", label: "Crocs Slipper/Sandal broad", note: "Wave 700 — 산라/슬라이드/털 슬리퍼." },
  shoe_crocs_light_ride_broad: { status: "ready", label: "Crocs LiteRide broad", note: "Wave 700 — Light Ride 360." },
  shoe_puma_speedcat_broad: { status: "ready", label: "Puma Speedcat broad", note: "Wave 700 — OG/Open YY collab." },
  shoe_puma_palermo_broad: { status: "ready", label: "Puma Palermo broad", note: "Wave 700 — Elevata/OG." },
  shoe_puma_suede_broad: { status: "ready", label: "Puma Suede broad", note: "Wave 700 — Classic." },
  shoe_puma_clyde_broad: { status: "ready", label: "Puma Clyde broad", note: "Wave 700 — Classic." },
  // Wave 701 (2026-05-23) — Asics 13 SKU (Agent deep sweep 1,785건)
  shoe_asics_gel_1130_broad: { status: "ready", label: "Asics Gel-1130 broad", note: "Wave 701 — 198 매물 (217 누락)." },
  shoe_asics_superblast: { status: "ready", label: "Asics Superblast", note: "Wave 701 — 73 매물 평균 20만." },
  shoe_asics_lifewalker: { status: "ready", label: "Asics Lifewalker", note: "Wave 701 — 53 매물 시니어 mass." },
  shoe_asics_gel_venture: { status: "ready", label: "Asics Gel-Venture", note: "Wave 701 — 29 매물 트레일." },
  shoe_asics_i4p_collab: { status: "ready", label: "Asics x i4p (IAB) Collab", note: "Wave 701 — 29 매물 한국 collab." },
  shoe_asics_gt_2160_broad: { status: "ready", label: "Asics GT-2160 broad", note: "Wave 701 — 23 매물." },
  shoe_asics_metaspeed: { status: "ready", label: "Asics Metaspeed", note: "Wave 701 — 21 매물 마라톤 hi-end." },
  shoe_asics_gel_1090: { status: "ready", label: "Asics Gel-1090", note: "Wave 701 — 20 매물." },
  shoe_asics_gel_sonoma: { status: "ready", label: "Asics Gel-Sonoma", note: "Wave 701 — 19 매물." },
  shoe_asics_gel_quantum: { status: "ready", label: "Asics Gel-Quantum (plain)", note: "Wave 701 — 13 매물." },
  shoe_asics_hyper: { status: "ready", label: "Asics Hyper 시리즈", note: "Wave 701 — 13 매물." },
  shoe_asics_anderson_bell_collab: { status: "ready", label: "Asics x Anderson Bell Collab", note: "Wave 701 — 12 매물." },
  shoe_asics_jjjjound_collab: { status: "ready", label: "Asics x JJJJound (가품 위험 ★★★)", note: "Wave 701 — 11 매물 평균 33만." },
  // Wave 702 (2026-05-23) — On Running 8 SKU
  shoe_onrunning_cloudtilt_broad: { status: "ready", label: "On Cloudtilt broad", note: "Wave 702 — 31 매물 (non-Loewe)." },
  shoe_onrunning_kith_collab: { status: "ready", label: "On x Kith Collab", note: "Wave 702 — 9 매물 평균 45만." },
  shoe_onrunning_cloudboom_broad: { status: "ready", label: "On Cloudboom broad (Echo 3/Strike/LS)", note: "Wave 702 — 8 매물 마라톤 카본." },
  shoe_onrunning_cloudaway_broad: { status: "ready", label: "On Cloudaway broad", note: "Wave 702 — 10 매물." },
  shoe_onrunning_cloudzone_broad: { status: "ready", label: "On Cloudzone broad (non-Kith)", note: "Wave 702 — 5 매물." },
  shoe_onrunning_cloudvista_broad: { status: "ready", label: "On Cloudvista Waterproof", note: "Wave 702 — 6 매물." },
  shoe_onrunning_cloudventure_broad: { status: "ready", label: "On Cloudventure broad (non-PAF/Loewe)", note: "Wave 702 — 5 매물." },
  shoe_onrunning_pleasures_collab: { status: "ready", label: "On x Pleasures Collab", note: "Wave 702 — 3 매물." },

  // ============================================================================
  // Wave 712b (2026-05-23) — 의류 14 brand + 신발 21 brand bias-free 검증 신설 (52 SKU)
  // ============================================================================
  // Adidas 의류 collab (trefoil 31.80x spread fix)
  adidas_thugclub_collab: { status: "ready", label: "Adidas × Thug Club 의류", note: "Wave 712b — 109건/주 23만, trefoil 흡수 fix." },
  adidas_bape_collab: { status: "ready", label: "Adidas × BAPE 의류", note: "Wave 712b — 133건/주 27.8만." },
  adidas_sftm_collab: { status: "ready", label: "Adidas × Song For The Mute 의류", note: "Wave 712b — 125건/주 17만." },
  adidas_y3_collab: { status: "ready", label: "Adidas × Y-3 의류 (요지 야마모토)", note: "Wave 712b — 68건/주 9만." },
  adidas_fog_apparel: { status: "ready", label: "Adidas × FOG Athletics 의류", note: "Wave 712b — 65건/주 15만, 2025-12 partnership 종료." },
  // FOG Main Line 의류
  fog_main_jacket: { status: "ready", label: "FOG Main Line 자켓 (Eternal/California)", note: "Wave 715 — London Fog 25% 흡수 차단 + Nike/Adidas/Zegna 콜라보 분리." },
  fog_main_pants: { status: "ready", label: "FOG Main Line 팬츠", note: "Wave 715 — 54x spread → London Fog/Nike/Adidas 차단." },
  nike_fog_apparel_collab: { status: "ready", label: "Nike × Fear of God 의류 콜라보", note: "Wave 715 — Warm Up jacket/hoodie 신설. fog_main에서 분리." },
  fog_main_tee: { status: "ready", label: "FOG Main Line 티셔츠/롱슬리브", note: "Wave 712b — 22건/주 18.7만." },
  fog_main_hoodie: { status: "ready", label: "FOG Main Line 후드", note: "Wave 712b — 20건/주 21.5만." },
  // Polo Ralph Lauren 7개
  polo_shirt_pattern: { status: "ready", label: "Polo 패턴 셔츠 (체크/스트라이프/깅엄)", note: "Wave 712b — 315건/주 누락 회복." },
  polo_sweatshirt_crewneck: { status: "ready", label: "Polo 맨투맨/스웻셔츠", note: "Wave 712b — 150건/주 카테고리 SKU 부재 회복." },
  polo_knit_sweater: { status: "ready", label: "Polo 니트/케이블/꽈배기", note: "Wave 712b — 161건/주." },
  polo_pants_chino: { status: "ready", label: "Polo 치노/슬랙스/와이드", note: "Wave 712b — 90건/주." },
  polo_purple_label: { status: "ready", label: "Polo Purple Label (top tier)", note: "Wave 712b — 30건/주 69만 premium." },
  polo_sport_90s: { status: "ready", label: "Polo Sport (90s vintage athletic)", note: "Wave 712b — 21건/주 12만." },
  polo_rlx_golf: { status: "ready", label: "Polo RLX Golf", note: "Wave 712b — 11건/주 5만." },
  polo_chiefkeef_stadium: { status: "ready", label: "Polo Chief Keef Big Pony (modern PK)", note: "Wave 715 — narrow modern only (~30건 p50 5만). vintage Stadium 분리." },
  polo_stadium_1992_og: { status: "ready", label: "Polo Stadium 1992 OG (vintage archive)", note: "Wave 715 — vintage 1992 OG narrow (~10건 p50 100만). 132x spread 해소." },
  // Stone Island sub-line
  stone_island_shadow_project: { status: "ready", label: "Stone Island Shadow Project", note: "Wave 712b — 15건/주 55만." },
  stone_island_ghost_piece: { status: "ready", label: "Stone Island Ghost Piece", note: "Wave 712b — 15건/주 34.5만." },
  stone_island_crinkle_reps: { status: "ready", label: "Stone Island Crinkle Reps (패딩 시그니처)", note: "Wave 712b — 38건/주 64.8만." },
  // Arc'teryx Down
  arcteryx_down: { status: "ready", label: "Arc'teryx Down (Cerium/Thorium/Nuclei)", note: "Wave 712b — 39건/주 60만." },
  // Wave 715 P1 — Arc'teryx LEAF/Veilance 별도 narrow
  arcteryx_leaf: { status: "ready", label: "Arc'teryx LEAF (군용/방산 premium)", note: "Wave 715 — broad에서 LEAF 분리 (시세 다름)." },
  arcteryx_veilance: { status: "ready", label: "Arc'teryx Veilance (도시 premium minimalist)", note: "Wave 715 — 60x spread 해소." },
  // Wave 715 P1 — Thom Browne 6-split (640건 58x → narrow)
  thombrowne_4bar: { status: "ready", label: "Thom Browne 4-Bar Stripe (시그니처)", note: "Wave 715 — premium 라인 (~150-300만)." },
  thombrowne_cardigan: { status: "ready", label: "Thom Browne Cardigan", note: "Wave 715 — V넥 가디건 (~80-150만)." },
  thombrowne_knit: { status: "ready", label: "Thom Browne Knit Sweater", note: "Wave 715 — 케이블 니트 (~80-150만)." },
  thombrowne_shirt: { status: "ready", label: "Thom Browne Shirt", note: "Wave 715 — 옥스포드/럭비 (~30-80만)." },
  thombrowne_suit_coat: { status: "ready", label: "Thom Browne Suit/Blazer/Coat (premium)", note: "Wave 715 — 200-400만 top tier." },
  thombrowne_sweat_hoodie: { status: "ready", label: "Thom Browne Sweat/Hoodie", note: "Wave 715 — 맨투맨/후디 (~50-100만)." },
  // Wave 715 P1 — Polo Apparel vintage 분리
  polo_apparel_vintage: { status: "ready", label: "Polo Apparel Vintage (90s/00s archive)", note: "Wave 715 — broad 488건 110x → vintage narrow 분리." },
  // Wave 715 P1 — Moncler 3-split
  moncler_maya: { status: "ready", label: "Moncler Maya (시그니처 light down)", note: "Wave 715 — 220만 premium." },
  moncler_grenoble: { status: "ready", label: "Moncler Grenoble (스키웨어)", note: "Wave 715 — 300만 premium ski line." },
  moncler_tricot: { status: "ready", label: "Moncler Tricot (니트 sub-line)", note: "Wave 715 — 120만 다른 시세군." },
  // Wave 715 P1 — Supreme Box Logo narrow
  supreme_box_logo: { status: "ready", label: "Supreme Box Logo (BOGO)", note: "Wave 715 — 시즌별 가격 크게 다름, narrow 필수." },
  // Wave 715 P1 — Carhartt WIP Detroit
  carhartt_heritage_usa: { status: "ready", label: "Carhartt Heritage USA (미국산 라인)", note: "Wave 715 — WIP과 시세 다름 (+50%)." },
  // Wave 726 (2026-05-24): 신규 brand
  alpha_mil_jacket: { status: "ready", label: "Alpha Industries MA-1 / N3B 항공자켓", note: "Wave 726 — 70건/주 p50 10만." },
  levis_denim_broad: { status: "ready", label: "Levi's Denim Broad (501/550/LVC)", note: "Wave 726 — 72건/주 p50 8.5만." },
  discovery_broad: { status: "ready", label: "Discovery Expedition (패딩/맨투맨)", note: "Wave 726 — 74건/주 p50 4.2만 (일반인 친화)." },
  // Wave 727 — 골프웨어 6 brand
  titleist_broad: { status: "ready", label: "Titleist Golf Apparel", note: "Wave 727 — 1,006건/주 p50 11만." },
  pxg_broad: { status: "ready", label: "PXG Golf Apparel", note: "Wave 727 — 463건/주 p50 8.5만." },
  malbon_broad: { status: "ready", label: "Malbon Golf Apparel", note: "Wave 727 — 433건/주 p50 7.9만." },
  gfore_broad: { status: "ready", label: "G/FORE Golf Apparel", note: "Wave 727 — 291건/주 p50 10.9만." },
  jlindeberg_broad: { status: "ready", label: "J.Lindeberg Golf Apparel", note: "Wave 727 — 241건/주 p50 5.9만." },
  marklona_broad: { status: "ready", label: "Mark&Lona Golf Apparel", note: "Wave 727 — 190건/주 p50 9만." },
  // Wave 728 — supreme/arcteryx leak fix
  supreme_dickies_collab: { status: "ready", label: "Supreme × Dickies (카고팬츠/플란넬)", note: "Wave 728 — broad에서 차단되던 collab 회수." },
  supreme_mm6_collab: { status: "ready", label: "Supreme × MM6 Margiela", note: "Wave 728 — broad에서 차단되던 collab." },
  supreme_collab_broad: { status: "ready", label: "Supreme Collab Broad (Velvet Underground 등)", note: "Wave 728 — 일반 collab catch-all." },
  arcteryx_proton: { status: "ready", label: "Arc'teryx Proton (Insulated)", note: "Wave 728 — 라인 누락 회복." },
  arcteryx_solano: { status: "ready", label: "Arc'teryx Solano (light)", note: "Wave 728 — 한정 라인." },
  arcteryx_rampart_pants: { status: "ready", label: "Arc'teryx Rampart Pants", note: "Wave 728 — pants 라인 누락 회복." },
  // Wave 729 — Carhartt broad (double_knee leak fix + 4 SKU 신설)
  carhartt_hoodie_sweat: { status: "ready", label: "Carhartt Hoodie / Sweat / Crewneck (Broad)", note: "Wave 729 — 18+건/주 p50 7.7만." },
  carhartt_denim_pants: { status: "ready", label: "Carhartt Denim / Landon / Newel Pants", note: "Wave 729 — 9+건/주 p50 9.1만." },
  carhartt_overall_anorak: { status: "ready", label: "Carhartt Overall / Nimbus Anorak", note: "Wave 729 — 7건/주 p50 8-10만." },
  carhartt_shirt_flannel: { status: "ready", label: "Carhartt Flannel / Workshirt", note: "Wave 729 — 7건/주 p50 8만." },
  // Wave 730 — Nike apparel broad 5 SKU 신설
  nike_dri_fit_therma_broad: { status: "ready", label: "Nike Dri-FIT / Therma Training", note: "Wave 730 — 52건/주 p50 5만." },
  nike_windbreaker_broad: { status: "ready", label: "Nike Windrunner / Windbreaker", note: "Wave 730 — 47건/주 p50 6만." },
  nike_hoodie_sweat_broad: { status: "ready", label: "Nike Hoodie / Sweat / Crewneck", note: "Wave 730 — 36건/주 p50 5만." },
  nike_tee_broad: { status: "ready", label: "Nike Tee / Short Sleeve", note: "Wave 730 — 23건/주 p50 6만." },
  nike_pants_shorts_broad: { status: "ready", label: "Nike Pants / Cargo / Shorts", note: "Wave 730 — 16건/주 p50 11.7만." },
  // Wave 715 P2-P3 — 잔여 narrow split
  polo_oxford_vintage: { status: "ready", label: "Polo Oxford Vintage (90s/00s archive)", note: "Wave 715 — 67x spread 해소." },
  polo_pique_vintage: { status: "ready", label: "Polo Pique Vintage (90s/00s archive)", note: "Wave 715 — 65x spread 해소." },
  adidas_trefoil_archive: { status: "ready", label: "Adidas Trefoil Archive (90s 빈티지)", note: "Wave 715 — 77x spread broad → vintage 분리." },
  polo_bear_vintage: { status: "ready", label: "Polo Bear Vintage (90s premium)", note: "Wave 715 — 55x spread → 빈티지 분리." },
  stussy_vintage_collab: { status: "ready", label: "Stussy Vintage Collab (한정)", note: "Wave 715 — 74x broad spread → 빈티지 collab 분리." },
  // Wave 715 P1 — CDG 3-split
  cdg_play: { status: "ready", label: "CDG PLAY (heart 로고 basic)", note: "Wave 715 — broad에서 PLAY 분리." },
  cdg_homme_plus: { status: "ready", label: "CDG Homme Plus (premium mainline)", note: "Wave 715 — 110만 premium tier." },
  // Wave 716: cdg_junya 삭제 — junya_watanabe_apparel broad와 중복 → 실제 collab narrow로 교체.
  junya_carhartt_collab: { status: "ready", label: "Junya × Carhartt collab (워크자켓)", note: "Wave 716 — 50-85만 별도." },
  junya_levi_collab: { status: "ready", label: "Junya × Levi's collab (데님)", note: "Wave 716 — 66만 별도." },
  junya_cp_company_collab: { status: "ready", label: "Junya × C.P. Company collab (premium)", note: "Wave 716 — 220만 premium tier." },
  junya_brooks_brothers_collab: { status: "ready", label: "Junya × Brooks Brothers collab", note: "Wave 716 — 68-94만 별도." },
  acne_denim_premium: { status: "ready", label: "Acne Denim Premium (2021M/Petit)", note: "Wave 716 — 50x spread → 600k tier 분리." },
  // Wave 716 P0/P1 — agent 권고 적용
  thugclub_teamgeist_hoodie: { status: "ready", label: "Thug Club × Adidas Team Geist Hoodie / Leather", note: "Wave 716 — 120x adidas_thugclub_collab spread 해소 (63만 tier)." },
  polo_rrl_work_chore_jacket: { status: "ready", label: "Polo RRL Work / Chore Jacket", note: "Wave 716 — 75x polo_rrl_jacket_coat spread (53만 tier)." },
  polo_rrl_wool_mackinaw_jacket: { status: "ready", label: "Polo RRL Wool / Mackinaw Jacket", note: "Wave 716 — 90만 premium tier." },
  bape_varsity_jacket: { status: "ready", label: "BAPE Varsity Jacket", note: "Wave 716 — 40x bape_jacket_broad spread (22만 tier)." },
  bape_coach_jacket: { status: "ready", label: "BAPE Coach Jacket", note: "Wave 716 — 19만 tier 분리." },
  // BAPE
  bape_adidas_collab: { status: "ready", label: "BAPE × Adidas 의류 collab", note: "Wave 712b — 174건/주 (가장 큰 misclassification fix)." },
  bape_longsleeve: { status: "ready", label: "BAPE 롱슬리브 (FW)", note: "Wave 712b — 32건/주 14.8만." },
  bape_backpack: { status: "ready", label: "BAPE 백팩/메신저", note: "Wave 712b — 39건/주 13만." },
  // TNF
  tnf_white_label_novelty: { status: "ready", label: "TNF White Label Novelty Down (KR 단독)", note: "Wave 712b — 54건/주 21.5만." },
  tnf_steep_tech_original: { status: "ready", label: "TNF Steep Tech Original (1989 헤리티지)", note: "Wave 712b — 36건/주 40만." },
  // CDG/Junya
  junya_watanabe_apparel: { status: "ready", label: "Junya Watanabe 의류 broad", note: "Wave 712b — 70+건/주 (NB collab 외 단독 의류)." },
  cdg_converse_chuck70_broad: { status: "ready", label: "CDG Play × Converse Chuck 70 broad", note: "Wave 712b — 125건/주 white narrow 외 흡수." },
  // Stussy
  stussy_8ball_hoodie: { status: "ready", label: "Stussy 8 Ball 후드", note: "Wave 712b — 시그니처." },
  stussy_world_tour_tee: { status: "ready", label: "Stussy World Tour Tee", note: "Wave 712b — 194건/주 8만." },
  stussy_pigment_dye_hoodie: { status: "ready", label: "Stussy Pigment Dye Hoodie", note: "Wave 712b — 114건/주 9만." },
  stussy_nike_spiridon: { status: "ready", label: "Stussy × Nike Spiridon Cage 2", note: "Wave 712b — 74건/주 16.7만." },
  stussy_nike_af1_mid: { status: "ready", label: "Stussy × Nike AF1 Mid", note: "Wave 712b — 57건/주 12.5만." },
  // NB collab
  nb_thisisneverthat_collab: { status: "ready", label: "NB × This Is Never That (디스이즈네버댓)", note: "Wave 712b — 21건/주 20만." },
  nb_salehe_collab: { status: "ready", label: "NB × Salehe Bembury", note: "Wave 712b — 6건/주 23.5만." },

  // 신발 SKU (712b)
  onitsuka_mexico_66: { status: "ready", label: "Onitsuka Tiger Mexico 66", note: "Wave 712b — 90건/주 10.7만 (Asics와 별 brand)." },
  onitsuka_broad: { status: "ready", label: "Onitsuka Tiger broad (Tokuten/Serrano/EDR78)", note: "Wave 712b — 95건/주." },
  nike_af1_lv8_low: { status: "ready", label: "Nike AF1 Low LV8 sub-series", note: "Wave 712b — 55건/주 (NBA/Athletic Club/한글날)." },
  nike_af1_tune_squad: { status: "ready", label: "Nike AF1 × Tune Squad (Space Jam)", note: "Wave 712b — 14건/주 23.5만." },
  nike_af1_undefeated: { status: "ready", label: "Nike AF1 × UNDEFEATED", note: "Wave 712b — 11건/주 12.5만." },
  salomon_rx_slide_3: { status: "ready", label: "Salomon RX Slide 3.0", note: "Wave 712b — 56건/주 11만, 친화도 ⭐⭐⭐⭐⭐ entry." },
  salomon_phantasm_broad: { status: "ready", label: "Salomon S/LAB Phantasm 2/3", note: "Wave 712b — 63건/주 37만 카본 러닝." },
  salomon_rx_mary_jane: { status: "ready", label: "Salomon RX Mary Jane / Marie-Jeanne", note: "Wave 712b — 23건/주 17만." },
  salomon_xt_whisper_narrow: { status: "ready", label: "Salomon XT-Whisper", note: "Wave 712b — 79건/주 19만 (XT-series에서 분리)." },
  hoka_mafate_xlim: { status: "ready", label: "Hoka × Xlim Mafate Speed 2", note: "Wave 712b — 31건/주 35.2만 premium collab." },
  hoka_hopara: { status: "ready", label: "Hoka Hopara 워터 슬립온", note: "Wave 712b — 30건/주 13.8만." },
  hoka_mach_6: { status: "ready", label: "Hoka Mach 6 러닝", note: "Wave 712b — 39건/주 12만." },
  hoka_kaha_3_gtx: { status: "ready", label: "Hoka Kaha 3 GTX 등산화", note: "Wave 712b — 10건/주 27.9만 신상." },
  mizuno_jpx_golf: { status: "ready", label: "Mizuno JPX Golf 아이언", note: "Wave 712b — 36건/주 26.3만." },
  mizuno_mx_golf: { status: "ready", label: "Mizuno MX Golf 아이언 (한국 베스트)", note: "Wave 712b — 15건/주 17만." },
  mizuno_wave_prophecy: { status: "ready", label: "Mizuno Wave Prophecy + collab", note: "Wave 712b — 25건/주 24만 (Graphpaper/Blankof/Nonnative)." },
  nike_sakai_vaporwaffle: { status: "ready", label: "Nike × Sacai Vaporwaffle", note: "Wave 712b — 84건/주 35만 split." },
  nike_sakai_ldwaffle: { status: "ready", label: "Nike × Sacai LDV Waffle", note: "Wave 712b — 93건/주 25만 split." },
  nike_sakai_blazer_low: { status: "ready", label: "Nike × Sacai Blazer Low", note: "Wave 712b — 69건/주 18만 split." },
  nike_sakai_cortez: { status: "ready", label: "Nike × Sacai Zoom Cortez 4.0", note: "Wave 712b — 17건/주 20만." },
  adidas_adios_pro: { status: "ready", label: "Adidas Adizero Adios Pro 3/4", note: "Wave 712b — 52건/주 29.9만 카본 마라톤." },
  adidas_takumi_sen: { status: "ready", label: "Adidas Adizero Takumi Sen 9/10", note: "Wave 712b — 25만 카본 racer." },
  adidas_nmd_r1: { status: "ready", label: "Adidas NMD R1", note: "Wave 712b — 9건/주 19.9만." },
  adidas_pureboost: { status: "ready", label: "Adidas Pureboost 22/23/Go", note: "Wave 712b — 13건/주 15.9만." },
  drmartens_1461_smooth_black: { status: "ready", label: "Dr. Martens 1461 Smooth Black", note: "Wave 712b — 71건/주 15.5만." },
  drmartens_wingtip_3989: { status: "ready", label: "Dr. Martens Wingtip 3989", note: "Wave 712b — 63건/주 7.3만." },
  drmartens_jadon: { status: "ready", label: "Dr. Martens Jadon platform", note: "Wave 712b — 24건/주 12.7만." },
  drmartens_adrian: { status: "ready", label: "Dr. Martens Adrian Tassel Loafer", note: "Wave 712b — 19건/주 10.9만." },
  drmartens_sandal_broad: { status: "ready", label: "Dr. Martens Sandal broad", note: "Wave 712b — 54건/주 7만 (Gryphon/Myles/Blaire)." },
  vans_anaheim_factory: { status: "ready", label: "Vans Anaheim Factory", note: "Wave 712b — 63건/주 5만 ⭐⭐⭐⭐⭐." },
  vans_style_36: { status: "ready", label: "Vans Style 36", note: "Wave 712b — 42건/주 5만." },
  converse_chuck_allstar_broad: { status: "ready", label: "Converse Chuck Taylor All Star broad", note: "Wave 712b — 436건/주 unmatched 회복." },
  converse_chuck70_low_broad: { status: "ready", label: "Converse Chuck 70 Low/Ox broad", note: "Wave 712b — 106건/주 7.7만." },
  converse_runstar_hike: { status: "ready", label: "Converse Run Star Hike 플랫폼", note: "Wave 712b — 43건/주 5만." },
  fcw_converse_collab: { status: "ready", label: "Feng Chen Wang × Converse 2-in-1", note: "Wave 712b — 36건/주 12만 SS25 신상." },
  yeezy_350_zebra: { status: "ready", label: "Yeezy Boost 350 V2 Zebra", note: "Wave 712b — 23건/주 35만." },
  yeezy_foam_runner_sand: { status: "ready", label: "Yeezy Foam Runner Sand", note: "Wave 712b — 24건/주 21.7만 premium colorway." },
  yeezy_quantum: { status: "ready", label: "Yeezy Quantum 농구화", note: "Wave 712b — 13건/주 12.1만." },
  crocs_sanrio_collab: { status: "ready", label: "Crocs × Sanrio (Hello Kitty 등)", note: "Wave 712b — 63건/주 2만 mass." },
  crocs_crocband: { status: "ready", label: "Crocs Crocband (Bayaband 별개)", note: "Wave 712b — 5건/주." },
  crocs_anderson_bell_collab: { status: "ready", label: "Crocs × Anderson Bell (한국 디자이너)", note: "Wave 712b — 9건/주 26만." },
  puma_rose_speedcat: { status: "ready", label: "Puma × Rosé Speedcat (BLACKPINK)", note: "Wave 712b — 41건/주 13.8만." },
  puma_nitro_running: { status: "ready", label: "Puma Nitro 러닝 패밀리 (Deviate/Velocity/ForeverRun)", note: "Wave 712b — 61건/주 11.7만." },

  // ============================================================================
  // Wave 712c (2026-05-23) — 신발 추가 100+ SKU
  // ============================================================================
  // NB Vintage / Mass Entry
  nb_509: { status: "ready", label: "NB 509 / XLIM", note: "Wave 712c — 26건/주 15.5만 꼼데 collab 활발." },
  nb_610: { status: "ready", label: "NB 610 / ML610", note: "Wave 712c — 24건/주 16만 꼼데/말차." },
  nb_1906l: { status: "ready", label: "NB 1906L 로퍼", note: "Wave 712c — 21건/주 16만 1906 파생." },
  nb_996: { status: "ready", label: "NB 996 (Made in USA 헤리티지)", note: "Wave 712c — 13건/주 9.6만." },
  nb_5740: { status: "ready", label: "NB 5740 빈티지 럭스 (5만대 entry)", note: "Wave 712c — 9건/주 5.3만 ⭐⭐⭐⭐ mass entry." },
  nb_237: { status: "ready", label: "NB 237 (4만대 entry)", note: "Wave 712c — 5건/주 4만 ⭐⭐⭐⭐⭐." },
  nb_725: { status: "ready", label: "NB 725", note: "Wave 712c — 6건/주 5.1만." },
  nb_740: { status: "ready", label: "NB 740 (씨솔트)", note: "Wave 712c — 8건/주 9.7만." },
  nb_fuelcell: { status: "ready", label: "NB FuelCell 러닝 broad", note: "Wave 712c — 42건/주 13만." },
  nb_1080: { status: "ready", label: "NB 1080 Fresh Foam X 러닝", note: "Wave 712c — 10건/주 8.7만." },
  nb_tds_collab: { status: "ready", label: "NB × Tokyo Design Studio", note: "Wave 712c — 11건/주 15만." },
  nb_kale_collab: { status: "ready", label: "NB × Kale (1906R)", note: "Wave 712c — 8건/주." },

  // Asics 추가
  asics_gel_quantum: { status: "ready", label: "Asics Gel-Quantum", note: "Wave 712c — 113건/주 23만." },
  asics_metaspeed: { status: "ready", label: "Asics Metaspeed Sky/Edge/Tokyo/Ray", note: "Wave 712c — 56건/주 25.5만." },
  asics_gt_2160: { status: "ready", label: "Asics GT-2160", note: "Wave 712c — 54건/주 18만." },
  asics_gel_1090: { status: "ready", label: "Asics Gel-1090 V1/V2", note: "Wave 712c — 46건/주 9.5만." },
  asics_gel_venture: { status: "ready", label: "Asics Gel-Venture 6/10 트레일", note: "Wave 712c — 38건/주 8만." },
  asics_gel_sonoma: { status: "ready", label: "Asics Gel-Sonoma 15-50 트레일", note: "Wave 712c — 37건/주 9.9만." },
  asics_jjjjound_collab: { status: "ready", label: "Asics × JJJJound", note: "Wave 712c — 34건/주 30만." },
  asics_andersson_collab: { status: "ready", label: "Asics × Andersson Bell (한국 디자이너)", note: "Wave 712c — 33건/주 15.9만." },

  // Air Max
  nike_airmax_95_og_neon: { status: "ready", label: "Nike Air Max 95 OG Neon", note: "Wave 712c — 34건/주 20.1만 시그니처." },
  levis_nike_airmax_95: { status: "ready", label: "Levi's × Nike AM95", note: "Wave 712c — 30건/주 25.6만." },
  nike_airmax_97_silver_bullet: { status: "ready", label: "Nike Air Max 97 Silver Bullet", note: "Wave 712c — 16건/주 9.5만." },

  // Dr.Martens family
  drmartens_1461_classic: { status: "ready", label: "Dr. Martens 1461 Classic broad", note: "Wave 712c — 69건/주 12.9만 variant 미특정." },
  drmartens_1461_mono: { status: "ready", label: "Dr. Martens 1461 Mono 올블랙", note: "Wave 712c — 36건/주 9.9만." },
  drmartens_1461_bex: { status: "ready", label: "Dr. Martens 1461 Bex 두꺼운 솔", note: "Wave 712c — 16건/주 15.4만." },
  drmartens_1461_quad: { status: "ready", label: "Dr. Martens 1461 Quad 플랫폼", note: "Wave 712c — 11건/주 16.6만." },
  drmartens_1461_cherry: { status: "ready", label: "Dr. Martens 1461 Cherry/Oxblood", note: "Wave 712c — 11건/주 14.4만." },
  drmartens_1461_crazy_horse: { status: "ready", label: "Dr. Martens 1461 Crazy Horse 수공", note: "Wave 712c — 13건/주 17.3만." },
  drmartens_1461_mie: { status: "ready", label: "Dr. Martens 1461 MIE (Made in England)", note: "Wave 712c — 12건/주 14.7만 premium." },
  drmartens_1460_smooth: { status: "ready", label: "Dr. Martens 1460 Smooth Leather", note: "Wave 712c — 21건/주 10.5만." },
  drmartens_1460_mono: { status: "ready", label: "Dr. Martens 1460 Mono 올블랙", note: "Wave 712c — 17건/주 10.6만." },
  drmartens_1460_nappa: { status: "ready", label: "Dr. Martens 1460 Nappa premium 가죽", note: "Wave 712c — 10건/주 13만." },
  drmartens_2976_smooth: { status: "ready", label: "Dr. Martens 2976 Chelsea Smooth", note: "Wave 712c — 21건/주 11.5만." },
  drmartens_2976_mono: { status: "ready", label: "Dr. Martens 2976 Chelsea Mono", note: "Wave 712c — 14건/주 10.3만." },
  drmartens_pascal: { status: "ready", label: "Dr. Martens Pascal (별도 모델)", note: "Wave 712c — 19건/주 11.9만." },
  drmartens_polley: { status: "ready", label: "Dr. Martens Polley Mary Jane", note: "Wave 712c — 7건/주 14.4만." },

  // Yeezy broad
  yeezy_350_broad: { status: "ready", label: "Yeezy Boost 350 V2 broad", note: "Wave 712c — 152건/주 18.2만." },
  yeezy_700_wave_runner: { status: "ready", label: "Yeezy Boost 700 Wave Runner", note: "Wave 712c — 22건/주 25.5만." },
  yeezy_500_broad: { status: "ready", label: "Yeezy Boost 500", note: "Wave 712c — 107건/주 15.9만." },
  yeezy_slide_broad: { status: "ready", label: "Yeezy Slide", note: "Wave 712c — 87건/주 17.1만." },
  yeezy_foam_runner_broad: { status: "ready", label: "Yeezy Foam Runner", note: "Wave 712c — 117건/주 16.8만." },
  yeezy_ys_sl_pod: { status: "ready", label: "Yeezy YS-01/SL-02 POD 슬리퍼", note: "Wave 712c — 21건/주 8만 신상." },

  // Hoka 추가
  hoka_mafate_satisfy: { status: "ready", label: "Hoka × Satisfy Mafate Speed 4", note: "Wave 712c — 13건/주 31.8만." },
  hoka_bondi_eg: { status: "ready", label: "Hoka × Engineered Garments Bondi B/L", note: "Wave 712c — 14건/주 19.7만." },
  hoka_cielo_x1: { status: "ready", label: "Hoka Cielo X1 마라톤 카본", note: "Wave 712c — 10건/주 14.6만." },

  // Salomon 추가
  salomon_xt_4: { status: "ready", label: "Salomon XT-4 OG/Advanced", note: "Wave 712c — 32건/주 17만." },
  salomon_xt_quest: { status: "ready", label: "Salomon XT-Quest", note: "Wave 712c — 55건/주 18.5만." },
  salomon_xt_wings_2: { status: "ready", label: "Salomon XT Wings 2", note: "Wave 712c — 58건/주 17.4만." },
  salomon_acs_pro_og: { status: "ready", label: "Salomon ACS Pro OG/Plus", note: "Wave 712c — 48건/주 12.8만." },
  salomon_x_alp: { status: "ready", label: "Salomon X-Alp Leather/GTX 부츠", note: "Wave 712c — 20건/주 27.4만." },
  mm6_salomon_spectur: { status: "ready", label: "MM6 × Salomon Spectur/XT-15/Mary Jane", note: "Wave 712c — premium collab 분리." },

  // On Running
  on_cloud_6: { status: "ready", label: "On Cloud 6 신상 2025-03", note: "Wave 712c — 19건/주 15.5만." },
  on_cloudtilt_mainline: { status: "ready", label: "On Cloudtilt mainline (Loewe 제외)", note: "Wave 712c — 21건/주 16만." },
  on_cloudaway: { status: "ready", label: "On Cloudaway 1/2", note: "Wave 712c — 24건/주 16.1만." },
  on_cloudboom: { status: "ready", label: "On Cloudboom (Strike/LS/Eco/Max)", note: "Wave 712c — 17건/주 24만 premium racing." },
  on_kith_ktech: { status: "ready", label: "Kith × On K-Tech 1/2", note: "Wave 712c — 9건/주 45만 premium." },

  // Superstar
  bape_adidas_superstar: { status: "ready", label: "BAPE × Adidas Superstar", note: "Wave 712c — 48건/주 21.1만 (단일 최대 누락 fix)." },
  adidas_superstar_82: { status: "ready", label: "Adidas Superstar 82 retro", note: "Wave 712c — 37건/주 8만 신상." },
  adidas_superstar_adifom: { status: "ready", label: "Adidas Adifom Superstar rainboot", note: "Wave 712c — 19건/주 6.9만." },
  sftm_adidas_superstar: { status: "ready", label: "SFTM × Adidas Superstar 82", note: "Wave 712c — 9건/주 15.4만." },
  wotherspoon_adidas_superstar: { status: "ready", label: "Sean Wotherspoon × Adidas Superstar", note: "Wave 712c — 5건/주 12.4만." },

  // Cortez collab
  nike_cortez_union: { status: "ready", label: "Nike × Union LA Cortez", note: "Wave 712c — 14건/주 11.6만." },
  nike_cortez_kendrick: { status: "ready", label: "Nike × Kendrick Lamar Cortez", note: "Wave 712c — 3건/주 18.6만." },
  nike_cortez_shark: { status: "ready", label: "Nike Cortez Shark (size?)", note: "Wave 712c — 2건/주 15만." },
  nike_cortez_hangul_day: { status: "ready", label: "Nike Cortez 한글날", note: "Wave 712c — 5건/주 10만." },

  // AJ1 추가
  aj1_low_powder_blue: { status: "ready", label: "AJ1 Low OG Black & Dark Powder Blue", note: "Wave 712c — 22건/주 10만." },
  aj1_high_royal_toe: { status: "ready", label: "AJ1 High Royal Toe", note: "Wave 712c — 15건/주 7.5만." },
  aj1_low_travis_sail_reservoir: { status: "ready", label: "AJ1 Low × Travis Sail & Reservoir", note: "Wave 712c — 10건/주 48만." },
  aj1_low_travis_velvet_brown: { status: "ready", label: "AJ1 Low × Travis Velvet Brown 2025 신상", note: "Wave 712c — 9건/주 48만." },
  aj1_high_gym_red: { status: "ready", label: "AJ1 High OG Gym Red 피고래", note: "Wave 712c — 10건/주 10만." },

  // Puma
  puma_mostro: { status: "ready", label: "Puma Mostro Y2K 리바이벌", note: "Wave 712c — 9건/주 9.4만 (A$AP Rocky 2026 ↑)." },
  puma_hstreet_pure: { status: "ready", label: "Puma H-Street pure", note: "Wave 712c — 4건/주 8.8만." },
  puma_mb_basketball: { status: "ready", label: "Puma MB.04/Stewie 농구화", note: "Wave 712c — 6건/주 6.1만." },
  puma_openyy_hstreet: { status: "ready", label: "Puma × Open YY H-Street (별 silhouette)", note: "Wave 712c — 32건/주 14.7만." },
  puma_cell_broad: { status: "ready", label: "Puma Cell Dome/Venom/Geo Y2K", note: "Wave 712c — 12건/주 13.9만." },

  // Crocs 추가
  crocs_eco_non_clog: { status: "ready", label: "Crocs Eco non-clog (서지/웨이브/메리제인)", note: "Wave 712c — 11건/주." },
  crocs_fashion_dress_flat: { status: "ready", label: "Crocs Fashion Dress Flat (브루클린/이사벨라/세레나)", note: "Wave 712c — 10건/주 여성 dress 카테고리 신설." },
  crocs_wedge_broad: { status: "ready", label: "Crocs Wedge broad", note: "Wave 712c — 4-7건/주 웨지." },
  crocs_fur_lined: { status: "ready", label: "Crocs Fur-Lined (퍼클로그/털크록스)", note: "Wave 712c — 5건/주 winter." },

  // Blazer
  readymade_blazer_collab: { status: "ready", label: "Nike × Readymade Blazer Mid", note: "Wave 712c — 16건/주 14.7만." },
  supreme_sb_blazer_collab: { status: "ready", label: "Nike × Supreme SB Blazer", note: "Wave 712c — 9건/주 17만 가품 risk 高." },
  stranger_blazer_collab: { status: "ready", label: "Nike × Stranger Things Blazer Hawkins", note: "Wave 712c — 8건/주 8.9만." },
  offwhite_blazer_low_collab: { status: "ready", label: "Off-White × Nike Blazer Low", note: "Wave 712c — 48건/주 9.4만." },
  cdg_blazer_collab: { status: "ready", label: "CDG × Nike Blazer", note: "Wave 712c — 20건/주 9.7만." },

  // Mizuno
  mizuno_morelia_basic: { status: "ready", label: "Mizuno Morelia / Morelia II 클래식", note: "Wave 712c — 67건/주 10.1만." },
  mizuno_wave_rider: { status: "ready", label: "Mizuno Wave Rider 10/26/28", note: "Wave 712c — 15건/주 9만." },

  // Adidas Boost 추가
  adidas_adios_pro_evo: { status: "ready", label: "Adidas Adios Pro Evo 1 premium 슈퍼슈즈", note: "Wave 712c — 4건/주 80만 한정." },
  adidas_evo_sl: { status: "ready", label: "Adidas Adizero Evo SL 신상", note: "Wave 712c — 53건/주 14만." },
  adidas_aruku: { status: "ready", label: "Adidas Aruku 워킹화", note: "Wave 712c — 3건/주 8.3만." },
  adidas_y3_shoe_collab: { status: "ready", label: "Y-3 × Adidas Adios/Takumi 신발", note: "Wave 712c — 14건/주 33만 collab." },
};

export type CategoryReadinessConfig = {
  status: CategoryReadinessStatus;
  label: string;
  note: string;
  minReadyPool: number;
  minParseRate: number;
  minTrustedKeys: number;
  lastMeasuredAt?: string | null;
  operatorNote?: string;
};

export const CATEGORY_READINESS: Record<Sku["category"], CategoryReadinessConfig> = {
  earphone: {
    status: "ready",
    label: "Audio",
    note: "AirPods 계열은 SKU/노이즈/커넥터 파서가 후보팩 최소 기준을 통과했습니다.",
    minReadyPool: 6,
    minParseRate: 0.85,
    minTrustedKeys: 5,
  },
  smartwatch: {
    status: "ready",
    label: "Watch",
    note: "Apple Watch/Galaxy Watch는 사이즈·셀룰러·모델 파서가 후보팩 최소 기준을 통과했습니다.",
    minReadyPool: 6,
    minParseRate: 0.8,
    minTrustedKeys: 5,
  },
  smartphone: {
    status: "internal_only",
    label: "Mobile Phone",
    note: "용량·배터리효율·자급제/통신사·파손 상태 검증이 더 필요해 시세 학습만 허용합니다.",
    minReadyPool: 8,
    minParseRate: 0.9,
    minTrustedKeys: 10,
  },
  tablet: {
    status: "internal_only",
    label: "Tablet",
    note: "세대·용량·Wi-Fi/Cellular·펜/키보드 포함 여부 검증 전까지 시세 학습만 허용합니다.",
    minReadyPool: 8,
    minParseRate: 0.88,
    minTrustedKeys: 8,
  },
  laptop: {
    status: "internal_only",
    label: "PC/Laptop",
    note: "칩·연식·RAM·SSD·화면 크기·배터리 사이클 파서 검증 전까지 시세 학습만 허용합니다.",
    minReadyPool: 8,
    minParseRate: 0.85,
    minTrustedKeys: 8,
  },
  monitor: {
    status: "internal_only",
    label: "Monitor",
    note: "모델코드·인치·해상도·주사율 파서 골격만 열었고, 카탈로그 승격과 공개 후보팩은 보류합니다.",
    minReadyPool: 8,
    minParseRate: 0.85,
    minTrustedKeys: 8,
  },
  speaker: {
    status: "internal_only",
    label: "Speaker",
    note: "JBL/LG portable exact-model 5개만 내부 파싱 후보로 열고, broad speaker/audio 공개 후보팩은 보류합니다.",
    minReadyPool: 8,
    minParseRate: 0.9,
    minTrustedKeys: 5,
  },
  camera: {
    status: "internal_only",
    label: "Camera",
    note: "교환식 카메라 body-only exact-model만 내부 파싱 후보로 열고, 렌즈/킷/컴팩트/액세서리/하자/구매 행은 보류합니다.",
    minReadyPool: 8,
    minParseRate: 0.9,
    minTrustedKeys: 5,
  },
  small_appliance: {
    status: "blocked",
    label: "Small Appliance",
    note: "카테고리별 SKU/옵션/노이즈 모델이 아직 없어 후보팩과 시세 학습 모두 보류합니다.",
    minReadyPool: 10,
    minParseRate: 0.9,
    minTrustedKeys: 10,
  },
  // Wave 184 (2026-05-17): 새 카테고리 "drone" — DJI 드론 + 액션캠/포켓 + GoPro.
  // narrow lane 22개 모두 LANE_READINESS=ready 로 등록 (catalog narrow lane 정확).
  drone: {
    status: "internal_only",
    label: "Drone & Action Cam",
    note: "DJI 드론 (Mini/Mavic/Air/Avata) + DJI Osmo Action/Pocket + GoPro Hero. 짝퉁 거의 없음 (DJI 활성화 + GoPro 정품 등록). narrow lane 22개 LANE_READINESS=ready 로 풀 진입.",
    minReadyPool: 6,
    minParseRate: 0.9,
    minTrustedKeys: 5,
  },
  // Wave 188 (2026-05-18): 새 카테고리 "lego" — 한정판/UCS/모듈러 (세트 번호 고유 식별).
  lego: {
    status: "internal_only",
    label: "LEGO (한정판)",
    note: "한정판 / UCS / 모듈러 빌딩 / Technic / Ideas / Architecture. 세트 번호로 narrow lane 분리. 짝퉁 (LEPIN 카피) mustNotContain 차단. 미개봉 시세 +30~50%.",
    minReadyPool: 6,
    minParseRate: 0.9,
    minTrustedKeys: 5,
  },
  // Wave 186 (2026-05-18): 새 카테고리 "kickboard" — 전동킥보드/스쿠터 (샤오미 Mi Scooter / 세그웨이 닌봇).
  kickboard: {
    status: "internal_only",
    label: "Electric Scooter (전동킥보드)",
    note: "한국 인기 전동킥보드. 짝퉁 거의 없음 (정품 등록). 단일 옵션 (색상/배터리 변형 시세 동일). narrow lane 9개 LANE_READINESS=ready.",
    minReadyPool: 6,
    minParseRate: 0.9,
    minTrustedKeys: 5,
  },
  // Wave 185 (2026-05-17): 새 카테고리 "perfume" — 명품 향수 (Jo Malone / Le Labo / Diptyque / Tom Ford / Replica / Memo).
  // narrow lane 22개 (브랜드 × 향 × 용량). mustNotContain "분주/소분/샘플/공병" 차단.
  perfume: {
    status: "internal_only",
    label: "Perfume",
    note: "명품 향수 narrow lane (브랜드 + 향 + 용량). 짝퉁 일부 있으나 명품 가방보다 낮음. mustNotContain '분주/소분/리필/샘플/vial/빈병/공병' 으로 noise 차단.",
    minReadyPool: 6,
    minParseRate: 0.9,
    minTrustedKeys: 5,
  },
  game_console: {
    status: "internal_only",
    label: "Game Console",
    note: "PS5/Switch broad는 보류. ps5_disc_digital_standard + ps5_slim narrow lane만 LANE_READINESS로 별도 ready 처리.",
    minReadyPool: 6,
    minParseRate: 0.9,
    minTrustedKeys: 4,
  },
  desktop: {
    status: "ready",
    label: "Desktop",
    note: "Wave 17: Mac mini M2 narrow lane unlock 후 readiness DB row에서 ready.",
    minReadyPool: 1,
    minParseRate: 0.85,
    minTrustedKeys: 3,
  },
  home_appliance: {
    status: "ready",
    label: "Home Appliance",
    note: "Wave 19: Dyson V12 Detect Slim narrow lane unlock 후 readiness DB row에서 ready.",
    minReadyPool: 1,
    minParseRate: 0.85,
    minTrustedKeys: 3,
  },
  // Wave 67: 신 사업 카테고리 — 시계 + 골프. internal_only로 진입, 측정 후 ready 결정.
  watch: {
    status: "internal_only",
    label: "Watch",
    note: "Wave 67: Casio G-Shock + Seiko 5 Sports narrow lane 진입. 모델 코드 명시 매물만 매칭, 가품/액세서리 거름.",
    minReadyPool: 5,
    minParseRate: 0.9,
    minTrustedKeys: 5,
  },
  sport_golf: {
    status: "internal_only",
    label: "Golf",
    note: "Wave 90 source 다양화 1차 후보. 2026-05-15: loft 옵션 parser 보강 전 사용자 노출 보류, 시세 학습만 허용.",
    minReadyPool: 5,
    minParseRate: 0.9,
    minTrustedKeys: 4,
  },
  // Wave 91 (2026-05-15): 일반인 친화 + 차익 가능 카테고리 진입. internal_only로 시작.
  // 측정 후 ready 승격 결정.
  shoe: {
    status: "internal_only",
    label: "Shoes",
    note: "Wave 91: 한정판 스니커즈 (Jordan/Yeezy/Dunk/NB). resale ≤200만, 본품만. 가품 위험 ↑↑ (Panda/Travis Scott 등).",
    minReadyPool: 10,
    minParseRate: 0.85,
    minTrustedKeys: 5,
  },
  bag: {
    // Wave 221 (2026-05-19): internal_only → ready (사용자 명시 "ready로 가야된다").
    //   bag narrow lane 다수 박혀있음 (Stussy/CDG/Coach/Polo/Patagonia/LV/Prada/Kitsune/Bottega 등).
    //   가품 floor 0.25 + AD pattern 차단 (Wave 196/216).
    //   bag 매물 1229건 detail_done + parsed usable 22% — pool 진입 가능.
    status: "ready",
    label: "Bags",
    note: "Wave 221: bag narrow lane 다수 ready. 가품 floor 0.25 + AD 차단. (이전 Wave 91 internal_only)",
    minReadyPool: 10,
    minParseRate: 0.85,
    minTrustedKeys: 5,
  },
  bike: {
    status: "internal_only",
    label: "Bicycles",
    note: "Wave 91: 자전거 (Giant/Trek/Cannondale/Specialized/Brompton). resale ≤200만. 도난자전거/사고차 risk → 시리얼/영수증 가이드 필요.",
    minReadyPool: 8,
    minParseRate: 0.8,
    minTrustedKeys: 4,
  },
  // Wave 198 (2026-05-18): 새 카테고리 "clothing" — Polo / TNF / Stüssy.
  // Wave 407 (2026-05-20): category-level ready 폐기.
  //   의류는 brand/apparel broad가 너무 넓어 operator-pool 비교매물 오염이 반복됨.
  //   이제 명시적으로 검수된 LANE_READINESS ready lane만 public pool 진입.
  clothing: {
    status: "internal_only",
    label: "Clothing",
    note: "Wave 407 hold (2026-05-20): category-wide clothing ready disabled. Only audited narrow laneKey entries in LANE_READINESS can enter public pool; broad/apparel/fallback lanes stay internal.",
    minReadyPool: 8,
    minParseRate: 0.85,
    minTrustedKeys: 5,
  },
};

export function categoryFromComparableKey(value: string | null | undefined): Sku["category"] | null {
  const family = value?.split("|")[0] ?? "";
  if (
    family === "earphone" ||
    family === "smartwatch" ||
    family === "smartphone" ||
    family === "tablet" ||
    family === "laptop" ||
    family === "monitor" ||
    family === "speaker" ||
    family === "camera" ||
    family === "game_console" ||
    family === "small_appliance" ||
    family === "home_appliance" ||
    family === "desktop" ||
    family === "watch" ||
    family === "sport_golf" ||
    family === "shoe" ||
    family === "bag" ||
    family === "bike" ||
    family === "drone" ||
    family === "perfume" ||
    family === "kickboard" ||
    family === "lego" ||
    family === "clothing"
  ) {
    return family;
  }
  if (family === "airpods") return "earphone";
  if (family === "applewatch" || family === "galaxywatch") return "smartwatch";
  if (family === "iphone" || family === "galaxy_s") return "smartphone";
  if (family === "ipad" || family === "galaxy_tab") return "tablet";
  if (family === "macbook") return "laptop";
  if (family === "display") return "monitor";
  if (family === "ps5" || family === "playstation" || family === "switch") return "game_console";
  return null;
}

export type CategoryReadinessMap = Partial<Record<Sku["category"], CategoryReadinessConfig>>;

type CategoryReadinessDbRow = {
  category: Sku["category"];
  status: CategoryReadinessStatus;
  label: string;
  note: string | null;
  min_ready_pool: number | null;
  min_parse_rate: number | null;
  min_trusted_keys: number | null;
  last_measured_at: string | null;
  operator_note: string | null;
};

function supabaseRest() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw) return null;
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders(): Record<string, string> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function normalizeDbRow(row: CategoryReadinessDbRow): CategoryReadinessConfig {
  const fallback = CATEGORY_READINESS[row.category] ?? {
    status: "blocked" as const,
    label: row.category,
    note: "",
    minReadyPool: 8,
    minParseRate: 0.9,
    minTrustedKeys: 8,
  };
  return {
    status: row.status ?? fallback.status,
    label: row.label ?? fallback.label,
    note: row.note ?? fallback.note,
    minReadyPool: Number(row.min_ready_pool ?? fallback.minReadyPool),
    minParseRate: Number(row.min_parse_rate ?? fallback.minParseRate),
    minTrustedKeys: Number(row.min_trusted_keys ?? fallback.minTrustedKeys),
    lastMeasuredAt: row.last_measured_at,
    operatorNote: row.operator_note ?? "",
  };
}

export async function loadCategoryReadinessMap(): Promise<CategoryReadinessMap> {
  const base = supabaseRest();
  const headers = authHeaders();
  if (!base || !headers) return CATEGORY_READINESS;
  try {
    const res = await fetch(
      `${base}/mvp_category_readiness?select=category,status,label,note,min_ready_pool,min_parse_rate,min_trusted_keys,last_measured_at,operator_note`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) return CATEGORY_READINESS;
    const rows = (await res.json()) as CategoryReadinessDbRow[];
    const fromDb: CategoryReadinessMap = {};
    for (const row of rows) {
      fromDb[row.category] = normalizeDbRow(row);
    }
    return { ...CATEGORY_READINESS, ...fromDb };
  } catch {
    return CATEGORY_READINESS;
  }
}

export function evaluateCategoryReadiness(
  category: Sku["category"] | null | undefined,
  readinessMap: CategoryReadinessMap = CATEGORY_READINESS,
): CategoryReadinessDecision {
  if (!category) {
    return {
      category: null,
      status: "blocked",
      canEnterPool: false,
      reason: "category_unknown",
      label: "Unknown",
    };
  }

  const config = readinessMap[category] ?? CATEGORY_READINESS[category];
  if (!config) {
    return {
      category,
      status: "blocked",
      canEnterPool: false,
      reason: `category_unconfigured_${category}`,
      label: category,
    };
  }

  return {
    category,
    status: config.status,
    canEnterPool: config.status === "ready",
    reason: config.status === "ready" ? "category_ready" : `category_${config.status}_${category}`,
    label: config.label,
    note: config.note,
    minReadyPool: config.minReadyPool,
  };
}

export function categoryReadinessRows(readinessMap: CategoryReadinessMap = CATEGORY_READINESS) {
  return Object.entries(readinessMap).map(([category, config]) => ({
    category: category as Sku["category"],
    ...config,
  }));
}

export function evaluateLaneReadinessForSku(
  sku: Sku | null | undefined,
  laneMap: LaneReadinessMap = LANE_READINESS,
): CategoryReadinessDecision | null {
  const laneKey = sku?.laneKey;
  if (!laneKey) return null;
  const config = laneMap[laneKey];
  if (!config) return null;
  return {
    category: sku?.category ?? null,
    status: config.status === "ready" ? "ready" : "blocked",
    canEnterPool: config.status === "ready",
    reason: config.status === "ready" ? `lane_ready_${laneKey}` : `lane_blocked_${laneKey}`,
    label: config.label,
    note: config.note,
    laneKey,
  };
}

export async function loadLaneReadinessMap(): Promise<LaneReadinessMap> {
  // DB-backed override hook — table not present yet, so we fall back to the
  // in-code map. Mirrors `loadCategoryReadinessMap()` shape so tick-pipeline
  // can `await` both without a special case once a `mvp_lane_readiness`
  // table exists.
  return LANE_READINESS;
}
