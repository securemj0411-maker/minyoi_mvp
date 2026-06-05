// Wave 774 (2026-05-27): 토스 송금 deep link helper — manual deposit + processing 공용.
//   supertoss://send 가 토스 앱 송금 화면을 prefill (bank + accountNo + amount).
//   비공식 reverse-engineered scheme — 토스 앱 업데이트로 깨질 risk 있음.
//   카나리아 모니터링 별도 wave 권장.
// Wave 776 (2026-05-27): 카카오페이 QR universal link.
//   https://qr.kakaopay.com/{qrId} — owner 가 카카오페이 앱에서 패키지별 고정금액 QR 발급.
//   링크 클릭 → 카카오페이 앱 열림 → 송금 화면 (수취자 + 금액 prefill).
// Wave 776b: 비공식 hex concatenation 시도 → 실패 (owner 발급 QR 은 alphanumeric prefix + amount + salt 복합 인코딩, reverse-eng 불가).
// Wave 776c: amount=0 base URL fallback 시도 → 검증용.
// Wave 776d (2026-05-27): owner 가 패키지별 5개 QR 직접 발급 + share.
//   amount → URL lookup table 로 처리. amount 없거나 unknown 이면 base URL fallback.

import { PAYMENT_ACCOUNT_RAW, PAYMENT_BANK_NAME } from "@/lib/payment-account";

// 변동 금액 QR (fallback) — owner 일반 송금 QR
const KAKAOPAY_BASE_QR_ID = "281006020758065968058098";
export const KAKAOPAY_QR_BASE_URL = `https://qr.kakaopay.com/${KAKAOPAY_BASE_QR_ID}`;

// Wave 776d: owner 가 카카오페이 앱에서 직접 발급한 패키지별 고정금액 QR.
//   prefix `FHrTex3Pf` = owner user ID (alphanumeric, 변동금액 QR 의 24자리 숫자 ID 와 다름).
//   suffix = amount + salt/timestamp 복합 인코딩 (reverse-eng 불가, 매번 발급마다 다를 수 있음).
const KAKAOPAY_QR_BY_AMOUNT: Record<number, string> = {
  690: "https://qr.kakaopay.com/FHrTex3Pf15902386",
  2900: "https://qr.kakaopay.com/FHrTex3Pf5aa09554",
  9900: "https://qr.kakaopay.com/FHrTex3Pf135607224",
  19900: "https://qr.kakaopay.com/FHrTex3Pf26de06257",
  49900: "https://qr.kakaopay.com/FHrTex3Pf617601061",
};

/**
 * 카카오페이 QR URL 생성 — amount 별 owner 발급 QR lookup.
 * 매핑 없으면 base URL (변동 금액).
 */
export function buildKakaopayQrUrl(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return KAKAOPAY_QR_BASE_URL;
  return KAKAOPAY_QR_BY_AMOUNT[amount] ?? KAKAOPAY_QR_BASE_URL;
}

const TOSS_BANK_PARAM = PAYMENT_BANK_NAME;
const ACCOUNT_RAW = PAYMENT_ACCOUNT_RAW;
export const TOSS_APP_STORE_URL = "https://apps.apple.com/kr/app/id839333328";
export const TOSS_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=viva.republica.toss";

export function buildTossDeepLink(amount: number): string {
  const params = new URLSearchParams({
    bank: TOSS_BANK_PARAM,
    accountNo: ACCOUNT_RAW,
    amount: String(amount),
    origin: "qr",
  });
  return `supertoss://send?${params.toString()}`;
}

export function buildAndroidTossIntent(amount: number): string {
  const params = new URLSearchParams({
    bank: TOSS_BANK_PARAM,
    accountNo: ACCOUNT_RAW,
    amount: String(amount),
    origin: "qr",
  });
  const fallback = encodeURIComponent(TOSS_PLAY_STORE_URL);
  return `intent://send?${params.toString()}#Intent;scheme=supertoss;package=viva.republica.toss;S.browser_fallback_url=${fallback};end`;
}

/**
 * 토스 앱 송금 호출 + 미설치 fallback (iOS App Store / Android Play Store).
 * 호출자는 click handler 안에서 사용 (user gesture 필요 — iOS Safari).
 *
 * Wave 775b (2026-05-27): iOS fallback 휴리스틱 fix — 사용자 발견 버그
 *   "토스 앱으로 갔다가 앱스토어로 갑자기 이동".
 *   원인: setTimeout (1500ms) 후 visibility=visible 일 때 App Store redirect 했는데
 *   iOS Safari 가 deep link 호출 후 background 안 보내는 case 가 있음
 *   → 앱 깔려있어도 fallback 잘못 트리거.
 *   Fix: visibilitychange 이벤트로 정확하게 — hidden 으로 바뀌면 앱 열린 것 확정.
 */
export function openTossSend(amount: number): void {
  if (typeof window === "undefined") return;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/i.test(ua);

  if (isAndroid) {
    // Android Chrome 의 intent:// 가 자동으로 Play Store fallback 처리
    window.location.href = buildAndroidTossIntent(amount);
    return;
  }

  if (isIOS) {
    // visibility hidden 감지 → 토스 앱 열린 것 확정 → App Store redirect 차단
    let appOpened = false;
    const onVisChange = () => {
      if (document.visibilityState === "hidden") {
        appOpened = true;
      }
    };
    document.addEventListener("visibilitychange", onVisChange);

    window.location.href = buildTossDeepLink(amount);

    // 2.5s 후 visibility 변화 없었으면 → 앱 미설치 → App Store
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVisChange);
      if (!appOpened && document.visibilityState === "visible") {
        window.location.href = TOSS_APP_STORE_URL;
      }
    }, 2500);
    return;
  }

  // Desktop: best-effort. 토스 데스크탑 앱 있으면 작동, 없으면 무시.
  window.location.href = buildTossDeepLink(amount);
}

/**
 * 카카오페이 QR universal link 호출 (amount prefill).
 * 비공식 hex concatenation — Wave 776b.
 * universal link 라 별도 fallback 코드 불필요 (미설치 시 카카오페이 download 페이지 자동).
 */
export function openKakaopayQr(amount: number): void {
  if (typeof window === "undefined") return;
  window.location.href = buildKakaopayQrUrl(amount);
}
