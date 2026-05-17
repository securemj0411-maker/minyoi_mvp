// Wave 182 Phase 3 (2026-05-17): SKU base option fallback 매핑.
//
// 매물 텍스트에 옵션 (RAM/SSD/storage/size/connectivity 등) 명시 안 된 경우 가장 낮은 옵션 가정.
// 안전성 (§12b 정확성 우선 부합):
//   - base option = 가장 낮은 옵션 → base 시세도 가장 낮음 → priceGap underestimate → 추천 보수적
//   - 즉 false positive 발생 X. recall loss 만 (진짜 고옵션 매물이 base 시세로 비교돼 안 추천)
//   - 사용자에게 UI "기본 옵션 가정" 라벨로 정직히 표시
//
// 출처: Apple/Samsung 공식 spec (docs/SCRATCH/2026-05-17-tech-options-audit.md).
//
// 박지 않은 SKU:
//   - 자급제 변형 (-128-self, -256-self 등) — storage 명시 이미 박힘
//   - 단일 옵션 모델 (Apple Watch Ultra, earphone, monitor, speaker, camera, game console)
//   - broad SKU (ipad-pro, ipad-air, ipad-mini, macbook-air, macbook-pro)

export type SkuBaseOptions = {
  storageGb?: number;
  ramGb?: number;
  ssdGb?: number;
  watchSizeMm?: number;
  connectivity?: "wifi" | "cellular" | "gps" | "bluetooth";
  carrier?: "unlocked" | "skt" | "kt" | "lgu";
};

export const SKU_BASE_OPTIONS: Record<string, SkuBaseOptions> = {
  // ─── iPhone (storage axis) ─────────────────────────────────
  "iphone-se2": { storageGb: 64 },
  "iphone-se3": { storageGb: 64 },
  "iphone-11": { storageGb: 64 },
  "iphone-11-pro": { storageGb: 64 },
  "iphone-11-pro-max": { storageGb: 64 },
  "iphone-12-pro": { storageGb: 128 },
  "iphone-12-pro-max": { storageGb: 128 },
  "iphone-12-mini": { storageGb: 64 },
  "iphone-13-pro": { storageGb: 128 },
  "iphone-13-pro-max": { storageGb: 128 },
  "iphone-13-mini": { storageGb: 128 },
  "iphone-14-pro": { storageGb: 128 },
  "iphone-14-pro-max": { storageGb: 128 },
  "iphone-14-plus": { storageGb: 128 },
  "iphone-15-plus": { storageGb: 128 },
  // iPhone 15 Pro Max: Apple 이 128GB 옵션 안 만듦 → base 256GB.
  "iphone-15-pro-max": { storageGb: 256 },
  "iphone-16-pro": { storageGb: 128 },
  // iPhone 16 Pro Max: 128GB 없음 → base 256GB.
  "iphone-16-pro-max": { storageGb: 256 },
  "iphone-16-plus": { storageGb: 128 },
  "iphone-16e": { storageGb: 128 },
  // iPhone Air / 17 series: 128GB 없음 → base 256GB.
  "iphone-air": { storageGb: 256 },
  "iphone-17": { storageGb: 256 },
  "iphone-17-pro": { storageGb: 256 },
  "iphone-17-pro-max": { storageGb: 256 },
  "iphone-17-plus": { storageGb: 256 },
  "iphone-17e": { storageGb: 128 },

  // ─── Galaxy (storage axis) ─────────────────────────────────
  "galaxy-note10": { storageGb: 256 },
  "galaxy-note10-plus": { storageGb: 256 },
  "galaxy-note20": { storageGb: 256 },
  "galaxy-note20-ultra": { storageGb: 256 },
  "galaxy-s20": { storageGb: 128 },
  "galaxy-s20-plus": { storageGb: 128 },
  "galaxy-s20-ultra": { storageGb: 128 },
  "galaxy-s21": { storageGb: 128 },
  "galaxy-s21-plus": { storageGb: 128 },
  "galaxy-s22": { storageGb: 128 },
  "galaxy-s22-plus": { storageGb: 128 },
  "galaxy-s23": { storageGb: 128 },
  "galaxy-s23-plus": { storageGb: 256 },
  "galaxy-s23-ultra": { storageGb: 256 },
  "galaxy-s23-fe": { storageGb: 128 },
  "galaxy-s24": { storageGb: 256 },
  "galaxy-s24-plus": { storageGb: 256 },
  "galaxy-s24-ultra": { storageGb: 256 },
  "galaxy-s24-fe": { storageGb: 128 },
  "galaxy-s25": { storageGb: 128 },
  "galaxy-s25-plus": { storageGb: 256 },
  "galaxy-s25-ultra": { storageGb: 256 },
  "galaxy-s25-edge": { storageGb: 256 },
  "galaxy-s25-fe": { storageGb: 128 },
  "galaxy-s26": { storageGb: 256 },
  "galaxy-s26-plus": { storageGb: 256 },
  "galaxy-s26-ultra": { storageGb: 256 },
  "galaxy-z-flip-3": { storageGb: 128 },
  "galaxy-z-flip-4": { storageGb: 128 },
  "galaxy-z-flip-5": { storageGb: 256 },
  "galaxy-z-flip-6": { storageGb: 256 },
  "galaxy-z-flip-7": { storageGb: 256 },
  "galaxy-z-fold-3": { storageGb: 256 },
  "galaxy-z-fold-4": { storageGb: 256 },
  "galaxy-z-fold-5": { storageGb: 256 },
  "galaxy-z-fold-6": { storageGb: 256 },
  "galaxy-z-fold-7": { storageGb: 256 },

  // ─── iPad (storage + connectivity) ─────────────────────────
  "ipad-7": { storageGb: 32, connectivity: "wifi" },
  "ipad-8": { storageGb: 32, connectivity: "wifi" },
  "ipad-9": { storageGb: 64, connectivity: "wifi" },
  "ipad-10": { storageGb: 64, connectivity: "wifi" },
  "ipad-11": { storageGb: 128, connectivity: "wifi" },

  // ─── Galaxy Tab (storage + connectivity) ───────────────────
  "galaxy-tab-s6": { storageGb: 128, connectivity: "wifi" },
  "galaxy-tab-s6-lite": { storageGb: 64, connectivity: "wifi" },
  "galaxy-tab-s7": { storageGb: 128, connectivity: "wifi" },
  "galaxy-tab-s7-plus": { storageGb: 128, connectivity: "wifi" },
  "galaxy-tab-s7-fe": { storageGb: 64, connectivity: "wifi" },
  "galaxy-tab-s8": { storageGb: 128, connectivity: "wifi" },
  "galaxy-tab-s8-plus": { storageGb: 128, connectivity: "wifi" },
  "galaxy-tab-s8-ultra": { storageGb: 128, connectivity: "wifi" },
  "galaxy-tab-s9": { storageGb: 128, connectivity: "wifi" },
  "galaxy-tab-s9-plus": { storageGb: 256, connectivity: "wifi" },
  "galaxy-tab-s9-ultra": { storageGb: 256, connectivity: "wifi" },
  "galaxy-tab-s9-fe": { storageGb: 128, connectivity: "wifi" },
  "galaxy-tab-s9-fe-plus": { storageGb: 128, connectivity: "wifi" },
  "galaxy-tab-s10-plus": { storageGb: 256, connectivity: "wifi" },
  "galaxy-tab-s10-ultra": { storageGb: 256, connectivity: "wifi" },
  "galaxy-tab-s10-fe-plus": { storageGb: 128, connectivity: "wifi" },

  // ─── Apple Watch (size + connectivity) ─────────────────────
  // Series 7~9: 41/45mm.
  "applewatch-series5": { watchSizeMm: 40, connectivity: "gps" },
  "applewatch-series6": { watchSizeMm: 40, connectivity: "gps" },
  "applewatch-series7": { watchSizeMm: 41, connectivity: "gps" },
  "applewatch-series8": { watchSizeMm: 41, connectivity: "gps" },
  "applewatch-series9": { watchSizeMm: 41, connectivity: "gps" },
  // Series 10/11: 42/46mm (Apple size 변경).
  "applewatch-series10": { watchSizeMm: 42, connectivity: "gps" },
  "applewatch-series11": { watchSizeMm: 42, connectivity: "gps" },
  // SE: 40/44mm.
  "applewatch-se1": { watchSizeMm: 40, connectivity: "gps" },
  "applewatch-se2": { watchSizeMm: 40, connectivity: "gps" },
  "applewatch-se3": { watchSizeMm: 40, connectivity: "gps" },
  // Hermès: Cellular only.
  "applewatch-series8-hermes": { watchSizeMm: 41, connectivity: "cellular" },
  "applewatch-series10-hermes": { watchSizeMm: 42, connectivity: "cellular" },

  // ─── Galaxy Watch (size + connectivity) ────────────────────
  // Active 2: 40/44mm. Watch 3: 41/45mm. Watch 4~7: 40/44mm.
  "galaxywatch-active-2": { watchSizeMm: 40, connectivity: "bluetooth" },
  "galaxywatch-3": { watchSizeMm: 41, connectivity: "bluetooth" },
  "galaxywatch-4": { watchSizeMm: 40, connectivity: "bluetooth" },
  "galaxywatch-5": { watchSizeMm: 40, connectivity: "bluetooth" },
  "galaxywatch-6": { watchSizeMm: 40, connectivity: "bluetooth" },
  "galaxywatch-7": { watchSizeMm: 40, connectivity: "bluetooth" },

  // ─── MacBook Air (RAM + SSD) ───────────────────────────────
  // M1~M3: 8GB base. M4: 16GB base (Apple 변경).
  // catalog narrow lane (macbook-air-m{1,2,3,4}-{13,15}-{256,...}) 는 이미 RAM/SSD 명시.
  // broad macbook-air SKU 만 base 적용.
  // 단 catalog 안 narrow lane 가 RAM 명시되어 있어 base fallback 필요 X.
  // broad SKU 는 chip 미정이라 RAM/SSD base 박지 X.

  // ─── MacBook Pro chip variant (RAM + SSD) ──────────────────
  // M4 chip (Pro/Max 아닌) base: 16GB + 512GB.
  // M4 Pro base: 24GB + 512GB.
  // M4 Max base: 36GB + 1TB.
  // 단 narrow lane 이 이미 RAM 명시 (예: macbook-pro-14-m4-256 은 16GB) — base 자동 적용.
  // 별도 baseOptions 박지 X (narrow 명시로 충분).

  // ─── Galaxy Book (RAM + SSD) ───────────────────────────────
  // Samsung 한국 출시 base: 대부분 16GB + 512GB (Ultra 도 동일).
  "galaxy-book-4": { ramGb: 16, ssdGb: 512 },
  "galaxy-book-4-pro": { ramGb: 16, ssdGb: 512 },
  "galaxy-book-4-ultra": { ramGb: 16, ssdGb: 512 },
  "galaxy-book-5": { ramGb: 16, ssdGb: 512 },
  "galaxy-book-5-pro": { ramGb: 16, ssdGb: 512 },

  // ─── desktop Apple Silicon (RAM + SSD) ─────────────────────
  "desktop-mac-mini-m2-256": { ramGb: 8, ssdGb: 256 },
  "desktop-mac-mini-m4": { ramGb: 16, ssdGb: 256 },
  "desktop-imac-m1-24": { ramGb: 8, ssdGb: 256 },
  "desktop-imac-m3-24": { ramGb: 8, ssdGb: 256 },
  "desktop-imac-m4-24": { ramGb: 16, ssdGb: 256 },
  "desktop-mac-studio-m4-max-512": { ramGb: 36, ssdGb: 512 },
};

/**
 * Lookup base options for a given SKU id. Returns null if not in the map.
 */
export function baseOptionsFor(skuId: string | null | undefined): SkuBaseOptions | null {
  if (!skuId) return null;
  return SKU_BASE_OPTIONS[skuId] ?? null;
}
