// Wave 199 (2026-05-19): 가입 시 동의 정보 임시 보관 + 가입 완료 후 DB insert.
//   카카오 OAuth 는 가입 전 동의 받은 후 redirect → callback. 동의 정보 redirect 동안 보관해야.
//   localStorage = 클라이언트 변조 위험. but 베타 단계 충분. 추후 server-side signed token 가능.

const STORAGE_KEY = "minyoi-pending-consents-v1";

export type PendingConsents = {
  terms: boolean;
  privacy: boolean;
  age_14: boolean;
  marketing: boolean;
  stored_at: string;
};

export function persistPendingConsents(consents: {
  terms: boolean;
  privacy: boolean;
  age_14: boolean;
  marketing: boolean;
}) {
  if (typeof window === "undefined") return;
  try {
    const payload: PendingConsents = { ...consents, stored_at: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[consents] localStorage write failed", err);
  }
}

export function readPendingConsents(): PendingConsents | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingConsents;
    // 1시간 지난 token 은 폐기 (오래된 stale 위변조 차단).
    const storedAt = new Date(parsed.stored_at).getTime();
    if (Date.now() - storedAt > 60 * 60 * 1000) {
      clearPendingConsents();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingConsents() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * 가입 완료 후 호출. session 있는 상태에서 /api/auth/consents 로 동의 정보 POST.
 * 실패해도 가입 자체 진행 — consent insert 는 best-effort (운영자가 추후 수동 검증 가능).
 */
export async function flushPendingConsents(): Promise<{ ok: boolean; inserted: number }> {
  const pending = readPendingConsents();
  if (!pending) return { ok: true, inserted: 0 };
  try {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { ok: false, inserted: 0 };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false, inserted: 0 };
    const res = await fetch("/api/auth/consents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        terms: pending.terms,
        privacy: pending.privacy,
        age_14: pending.age_14,
        marketing: pending.marketing,
      }),
    });
    if (!res.ok) {
      console.error("[consents] flush failed", { status: res.status });
      return { ok: false, inserted: 0 };
    }
    const json = (await res.json()) as { ok?: boolean; inserted?: number };
    clearPendingConsents();
    return { ok: Boolean(json.ok), inserted: Number(json.inserted ?? 0) };
  } catch (err) {
    console.error("[consents] flush error", err);
    return { ok: false, inserted: 0 };
  }
}
