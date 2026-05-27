// Wave 774 (2026-05-27): 토스 송금 deep link helper — manual deposit + processing 공용.
//   supertoss://send 가 토스 앱 송금 화면을 prefill (bank + accountNo + amount).
//   비공식 reverse-engineered scheme — 토스 앱 업데이트로 깨질 risk 있음.
//   카나리아 모니터링 별도 wave 권장.
// Wave 776 (2026-05-27): 카카오페이 QR universal link 추가.
//   https://qr.kakaopay.com/{qrId} 가 본인 카카오페이 수취 QR.
//   링크 클릭 → 카카오페이 앱 열림 → 송금 화면 (수취자 prefill, 금액은 직접 입력).
//   토스와 다르게 amount prefill 미지원 (사용자가 앱에서 직접 입력).

// 카카오페이 QR universal link — owner 카카오페이 수취 QR 코드 ID
export const KAKAOPAY_QR_URL = "https://qr.kakaopay.com/281006020758065968058098";

const TOSS_BANK_PARAM = "우리은행"; // Wave 774b — 풀네임 (짧은 "우리" 는 토스에서 인식 안 됨)
const ACCOUNT_RAW = "1002367160511";
export const TOSS_APP_STORE_URL = "https://apps.apple.com/kr/app/id839333328";
export const TOSS_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=viva.republica.toss";

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
 * 카카오페이 QR universal link 호출.
 * 카카오페이 앱 자동 실행 (수취자만 prefill). 금액은 사용자가 직접 입력.
 * universal link 라 별도 fallback 코드 불필요 (미설치 시 카카오페이 download 페이지 자동).
 */
export function openKakaopayQr(): void {
  if (typeof window === "undefined") return;
  window.location.href = KAKAOPAY_QR_URL;
}
