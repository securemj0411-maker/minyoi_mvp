// Wave 749 (2026-05-25): 매물 카드 썸네일 fallback — 카테고리 워터마크 배지.
//
// 사용 위치: 매물 카드 4곳 (explore-client / pack-reveal-modal / user-reveal-dashboard / admin-pool-browser)
// 사용 시점: thumbnailUrl 이 null 일 때 (비어있는 placeholder div 교체).
// 디자인: deuktem_category_watermarks.html 참조. 흰색/어두운 원형 배경 + 토스 블루(라이트) / 흰색(다크) 스트로크.
//
// 다크/라이트 분기: SVG 두 장 (public/deuktem_watermarks_svg/{light,dark}/) 을 dark: variant 로 토글.
//   라이트 모드 → `light/<cat>.svg` (흰 원, 파란 스트로크)
//   다크 모드 → `dark/<cat>.svg` (어두운 원, 흰 스트로크)
//
// 매핑: Sku["category"] (catalog.ts) → 사용 가능한 워터마크 파일.
//   사용 가능: bag/camera/clothing/console/golf/headphones/laptop/phone/ring/shoe/watch (11종)
//   매핑 안 되는 카테고리는 null 반환 (워터마크 없이 빈 div) — small_appliance/bike/drone/perfume/kickboard/lego.

import Image from "next/image";
import { categoryFromComparableKey } from "@/lib/category-readiness";

type SkuCategory =
  | "earphone" | "smartwatch" | "smartphone" | "tablet" | "laptop"
  | "monitor" | "speaker" | "camera" | "game_console" | "small_appliance"
  | "home_appliance" | "desktop" | "watch" | "sport_golf" | "shoe"
  | "bag" | "bike" | "drone" | "perfume" | "kickboard" | "lego" | "clothing";

// 카테고리 → 워터마크 SVG 파일명 (확장자 제외, light/dark 하위 동일)
const WATERMARK_MAP: Partial<Record<SkuCategory, string>> = {
  earphone: "headphones",
  smartwatch: "watch",
  watch: "watch",
  smartphone: "phone",
  tablet: "laptop",     // 가장 비슷한 디바이스 워터마크
  laptop: "laptop",
  desktop: "laptop",    // 가장 비슷한
  monitor: "laptop",    // 가장 비슷한 (화면류)
  speaker: "headphones",
  camera: "camera",
  game_console: "console",
  shoe: "shoe",
  bag: "bag",
  sport_golf: "golf",
  clothing: "clothing",
  // home_appliance / small_appliance / bike / drone / perfume / kickboard / lego → 매핑 없음 → null
};

function resolveWatermark(
  category: SkuCategory | string | null | undefined,
  comparableKey: string | null | undefined,
): string | null {
  const fromCat = category ? WATERMARK_MAP[category as SkuCategory] : undefined;
  if (fromCat) return fromCat;
  const inferred = categoryFromComparableKey(comparableKey ?? null);
  if (inferred) {
    return WATERMARK_MAP[inferred as SkuCategory] ?? null;
  }
  return null;
}

export interface CategoryWatermarkProps {
  category?: SkuCategory | string | null;
  comparableKey?: string | null;
  /** 워터마크 크기 (px). Image width/height 에 박힘. */
  size?: number;
  /** 추가 className */
  className?: string;
  /**
   * 배치 mode:
   *   - "fallback" (기본): 부모 inset:0 채우고 중앙 표시. thumbnailUrl 없을 때 placeholder.
   *   - "corner": 우하단 작은 배지. 사진 위에 overlay. 사진 안 가림.
   */
  variant?: "fallback" | "corner";
}

/**
 * 매물 썸네일 자리/위에 표시하는 카테고리 워터마크 배지.
 * 부모 element 는 position:relative 여야 함.
 *
 * - `variant="fallback"`: 사진 없을 때 placeholder (중앙 fill).
 * - `variant="corner"`: 사진 위 우하단 작은 배지 (항상 표시).
 */
export function CategoryWatermark({
  category,
  comparableKey,
  size = 64,
  className = "",
  variant = "fallback",
}: CategoryWatermarkProps) {
  const name = resolveWatermark(category, comparableKey);
  if (!name) return null;

  const light = `/deuktem_watermarks_svg/light/${name}.svg`;
  const dark = `/deuktem_watermarks_svg/dark/${name}.svg`;

  const wrapperClass =
    variant === "corner"
      ? `pointer-events-none absolute bottom-1 right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] ${className}`
      : `pointer-events-none absolute inset-0 flex items-center justify-center ${className}`;

  return (
    <div className={wrapperClass} aria-hidden="true">
      {/* 라이트 모드 — 흰 원 + 토스 블루 stroke */}
      <Image
        src={light}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="block dark:hidden"
        style={{ width: size, height: size }}
      />
      {/* 다크 모드 — 어두운 원 + 흰색 stroke */}
      <Image
        src={dark}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="hidden dark:block"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

export default CategoryWatermark;
