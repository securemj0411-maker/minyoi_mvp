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
  polo_pony_tee: { status: "ready", label: "Polo Pony Logo T-Shirt", note: "Wave 198" },
  polo_oxford_shirt: { status: "ready", label: "Polo Oxford Shirt (Standard)", note: "Wave 198" },
  polo_bear_collab: { status: "ready", label: "Polo Bear Print (한정)", note: "Wave 198" },
  polo_rrl: { status: "ready", label: "Polo RRL Double RL (broad fallback)", note: "Wave 218: narrow 5개 분리 후 catch-all" },
  // Wave 218 (2026-05-19): RRL narrow 5개 — product type 별 가격대 완전 다름 (CV 1.56 분산)
  polo_rrl_tee: { status: "ready", label: "Polo RRL Tee / Sweat / Hoodie", note: "Wave 218" },
  polo_rrl_denim: { status: "ready", label: "Polo RRL Denim (jeans/shirt)", note: "Wave 218" },
  polo_rrl_shirt_pants: { status: "ready", label: "Polo RRL Shirt / Pants", note: "Wave 218" },
  polo_rrl_accessory: { status: "ready", label: "Polo RRL Accessory", note: "Wave 218" },
  polo_rrl_sneaker: { status: "ready", label: "Polo RRL Sneaker", note: "Wave 218 — shoe 카테고리" },
  polo_rrl_broad: { status: "ready", label: "Polo RRL (broad fallback)", note: "Wave 218: narrow 분리 후 catch-all" },
  tnf_nuptse_1996: { status: "ready", label: "TNF 1996 Retro Nuptse", note: "Wave 198" },
  tnf_mountain_jacket: { status: "ready", label: "TNF Mountain Jacket (Gore-Tex)", note: "Wave 198" },
  tnf_denali_fleece: { status: "ready", label: "TNF Denali Fleece", note: "Wave 198" },
  tnf_purple_label: { status: "ready", label: "TNF Purple Label (일본 Nanamica)", note: "Wave 198" },
  tnf_supreme_collab: { status: "ready", label: "Supreme × TNF (broad fallback)", note: "Wave 219: product type 분리 후 catch-all" },
  // Wave 219 (2026-05-19): Supreme × TNF product type 분리 — 자켓 380K vs 백팩 320K vs 슬리퍼 350K vs G-Shock 320K
  tnf_supreme_backpack: { status: "ready", label: "Supreme × TNF Backpack", note: "Wave 219 (bag 카테고리)" },
  tnf_supreme_slipper: { status: "ready", label: "Supreme × TNF Mule/Slipper", note: "Wave 219 (shoe 카테고리)" },
  tnf_supreme_gshock: { status: "ready", label: "Supreme × TNF × G-Shock DW-6900", note: "Wave 219 한정 콜라보" },
  tnf_borealis: { status: "ready", label: "TNF Borealis Backpack", note: "Wave 198 bag" },
  tnf_hotshot: { status: "ready", label: "TNF Hot Shot Backpack", note: "Wave 198 bag" },
  tnf_bigshot: { status: "ready", label: "TNF Big Shot Backpack", note: "Wave 198 bag" },
  tnf_nuptse_mule: { status: "ready", label: "TNF Nuptse Mule (슬리퍼)", note: "Wave 198 shoe" },
  stussy_nike_collab: { status: "ready", label: "Nike × Stüssy (collab)", note: "Wave 198 ⭐ 매물 압도적 (109건/14d)" },
  stussy_basic_tee: { status: "ready", label: "Stüssy Basic Tee (8 Ball/World Tour)", note: "Wave 198" },
  stussy_hoodie: { status: "ready", label: "Stüssy Hoodie / Crewneck", note: "Wave 198" },
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
  mm6_margiela_apparel: { status: "ready", label: "MM6 Margiela Apparel (broad)", note: "Wave 203" },
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
  acne_pvc_tote: { status: "ready", label: "Acne PVC Tote", note: "Wave 205 bag" },
  acne_musubi: { status: "ready", label: "Acne Musubi (시그니처)", note: "Wave 205 bag" },
  acne_apparel: { status: "ready", label: "Acne Apparel (broad fallback)", note: "Wave 219: product type 분리 후 catch-all" },
  // Wave 219 (2026-05-19): Acne product type 5분리 — 티 130K vs 맨투맨 230K vs 자켓 590K vs 데님 320K vs 셔츠 380K
  acne_tee: { status: "ready", label: "Acne Tee / Long-Sleeve", note: "Wave 219" },
  acne_sweat: { status: "ready", label: "Acne Sweat/Hoodie (Fairview)", note: "Wave 219" },
  acne_jacket_coat: { status: "ready", label: "Acne Jacket/Coat", note: "Wave 219" },
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
  fog_essentials: { status: "ready", label: "FOG Essentials (티/후드/스웻)", note: "Wave 227 일반인 친화" },
  coach_broad: { status: "ready", label: "Coach Bag (broad)", note: "Wave 227 가품 식별 가능" },
  coach_tabby: { status: "ready", label: "Coach Tabby (시그니처)", note: "Wave 227" },
  longchamp_le_pliage: { status: "ready", label: "Longchamp Le Pliage (시그니처)", note: "Wave 227 나일론" },
  nike_tailwind_79: { status: "ready", label: "Nike Tailwind 79 (Vintage Runner)", note: "Wave 227" },
  adidas_trefoil: { status: "ready", label: "Adidas Trefoil/Track Suit", note: "Wave 227 의류" },
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
  bape_tee: { status: "ready", label: "BAPE T-Shirt/Hoodie (Ape Head/카모)", note: "Wave 214 — 매물 118건 faved 94!" },
  bape_shark_hoodie: { status: "ready", label: "BAPE Shark Hoodie (시그니처)", note: "Wave 214 한정" },
  matinkim_apparel: { status: "ready", label: "Matin Kim Apparel (한국 designer)", note: "Wave 214 친화" },
  reebok_apparel: { status: "ready", label: "Reebok Apparel (트랙수트/티)", note: "Wave 214" },
  arcteryx_apparel: { status: "ready", label: "Arc'teryx Apparel (broad fallback)", note: "Wave 218: narrow 5개 분리 후 catch-all" },
  // Wave 218 (2026-05-19): Arc'teryx 모델별 narrow 5개 — 가격대 X 3-5 (Beta 600K vs Squamish 190K)
  arcteryx_beta: { status: "ready", label: "Arc'teryx Beta (SL/AR/LT)", note: "Wave 218 Gore-Tex" },
  arcteryx_gamma: { status: "ready", label: "Arc'teryx Gamma (MX/SL/LT)", note: "Wave 218 softshell" },
  arcteryx_alpha: { status: "ready", label: "Arc'teryx Alpha (SV/AR/FL)", note: "Wave 218 등반/expedition" },
  arcteryx_atom: { status: "ready", label: "Arc'teryx Atom (LT/SL/HW)", note: "Wave 218 insulated" },
  arcteryx_vertex_squamish: { status: "ready", label: "Arc'teryx Vertex / Squamish", note: "Wave 218 etc" },
  arcteryx_broad: { status: "ready", label: "Arc'teryx (broad fallback)", note: "Wave 218: narrow 분리 후 catch-all" },
  fila_apparel: { status: "ready", label: "Fila Apparel", note: "Wave 214 친화" },
  patagonia_apparel: { status: "ready", label: "Patagonia (broad fallback)", note: "Wave 219: 모델별 분리 후 catch-all" },
  // Wave 219 (2026-05-19): Patagonia 3분리 — Retro X 199K / Down 290K / Shell 199K
  patagonia_retro_x: { status: "ready", label: "Patagonia Retro X Fleece", note: "Wave 219" },
  patagonia_down: { status: "ready", label: "Patagonia Down (Nano Puff)", note: "Wave 219" },
  patagonia_shell: { status: "ready", label: "Patagonia Shell (Torrentshell)", note: "Wave 219" },
  mlb_apparel: { status: "ready", label: "MLB Cap (broad fallback)", note: "Wave 219: collab 분리 후 catch-all" },
  // Wave 219 (2026-05-19): MLB collab 분리 — Gucci 480K / Nike 79K / Murakami 220K vs 일반 49K
  mlb_cap_gucci_collab: { status: "ready", label: "Gucci × MLB Cap (한정 명품)", note: "Wave 219" },
  mlb_cap_nike_collab: { status: "ready", label: "Nike × MLB Cap", note: "Wave 219" },
  mlb_cap_murakami_collab: { status: "ready", label: "Murakami × MLB Cap (9twenty)", note: "Wave 219" },
  discovery_apparel: { status: "ready", label: "Discovery Expedition", note: "Wave 214 outdoor" },
  // Wave 215 (2026-05-19): Yeezy + BAPE STA + Stussy 8 Ball
  yeezy_boost_350: { status: "ready", label: "Yeezy Boost 350 (V1/V2)", note: "Wave 215 — Yeezy 매물 521건 압도적" },
  yeezy_boost_500_700: { status: "ready", label: "Yeezy Boost 500/700", note: "Wave 215" },
  yeezy_slide: { status: "ready", label: "Yeezy Slide", note: "Wave 215" },
  yeezy_foam_runner: { status: "ready", label: "Yeezy Foam Runner", note: "Wave 215" },
  bape_sta: { status: "ready", label: "BAPE STA (Bapesta 신발)", note: "Wave 215" },
  stussy_8ball_knit: { status: "ready", label: "Stüssy 8 Ball Knit", note: "Wave 215" },
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
  // 사용자 정책: broad 사이즈 무관, collab narrow 분리, 가품 floor 0.30 (의류 시장 가품 ↑).
  // production 14d sweep: Polo 419건 / TNF 153건 / Stüssy 195건. Nike×Stussy collab 109건 (56%) — narrow 필수.
  // Wave 215 (2026-05-19): 사용자 명시 "ready 바로 되게 다 준비" → internal_only → ready 승격.
  //   Wave 198~214 catalog 26 의류 SKU + lane 다 ready 등록. 가품 floor 0.30 + AD 패턴 14종 + collab narrow 분리 완료.
  clothing: {
    status: "ready",
    label: "Clothing",
    note: "Wave 215 ready 승격 (2026-05-19): 의류 26 SKU + lane 다 ready. Polo/TNF/Stüssy/Supreme/Margiela/CDG/Lacoste/Acne/Carhartt/Lululemon/Kitsuné/BAPE/마뗑킴/Reebok/Arcteryx/Fila/Patagonia/MLB/Discovery 박음. broad 사이즈 무관, collab narrow 분리. 가품 floor 0.30 + AD 14종.",
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
