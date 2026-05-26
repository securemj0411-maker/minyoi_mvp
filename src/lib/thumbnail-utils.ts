// Wave 759 (2026-05-26): 썸네일 URL 안전 처리.
//
// 문제: joongna 일부 매물 (0.05%, 11/21k) 의 thumbnail_url 이 .mp4 / .mov / .webm 영상 URL.
//   Next.js <Image> 는 영상 못 렌더 → broken image. 사용자가 깨진 이미지 봄.
//   bunjang/daangn 은 0건.
//
// 대응: API 응답 시점에 영상 URL → null 로 치환. UI 가 자연스럽게 CategoryWatermark fallback 표시.
//   더 정교한 대응 (poster 추출 / <video> 인라인) 은 표본 늘어나면 검토.

const VIDEO_EXTENSION_PATTERN = /\.(mp4|mov|webm|m4v|avi|mkv|hevc)(\?|$|#)/i;
const VIDEO_PATH_HINT = /\/(video|videos|stream|streams)\//i;

export function isVideoThumbnailUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return VIDEO_EXTENSION_PATTERN.test(url) || VIDEO_PATH_HINT.test(url);
}

/**
 * API 응답에서 thumbnail 내보낼 때 사용.
 *   - 영상 URL → null (UI 가 fallback 처리)
 *   - 그 외 → 원본 그대로
 */
export function safeThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (isVideoThumbnailUrl(url)) return null;
  return url;
}
