// Wave 69: client-side admin display override.
// 5-click hidden toggle in AppNav (logo 왼쪽) → localStorage flag → frontend
// admin UI 노출. 서버사이드 isAdminUser는 영향 X (실제 admin email 인증 유지).
const KEY = "minyoi_admin_override_v1";

export function hasClientAdminOverride(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setClientAdminOverride(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // ignore (private mode, quota)
  }
}
