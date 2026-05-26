// Wave 774 (2026-05-27): 토스 송금 deep link helper — manual deposit + processing 공용.
//   supertoss://send 가 토스 앱 송금 화면을 prefill (bank + accountNo + amount).
//   비공식 reverse-engineered scheme — 토스 앱 업데이트로 깨질 risk 있음.
//   카나리아 모니터링 별도 wave 권장.

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
 */
export function openTossSend(amount: number): void {
  if (typeof window === "undefined") return;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/i.test(ua);

  if (isAndroid) {
    window.location.href = buildAndroidTossIntent(amount);
    return;
  }

  if (isIOS) {
    const startedAt = Date.now();
    window.location.href = buildTossDeepLink(amount);
    setTimeout(() => {
      if (Date.now() - startedAt < 2000 && document.visibilityState === "visible") {
        window.location.href = TOSS_APP_STORE_URL;
      }
    }, 1500);
    return;
  }

  // Desktop: best-effort. 토스 데스크탑 앱 있으면 작동, 없으면 무시.
  window.location.href = buildTossDeepLink(amount);
}
