export const USER_REF_STORAGE_KEY = "minyoi-user-ref-v1";

export function getOrCreateUserRef(): string {
  if (typeof window === "undefined") return "";
  let ref = window.localStorage.getItem(USER_REF_STORAGE_KEY);
  if (!ref) {
    const cryptoApi = window.crypto;
    ref =
      cryptoApi && typeof cryptoApi.randomUUID === "function"
        ? cryptoApi.randomUUID()
        : `local-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    window.localStorage.setItem(USER_REF_STORAGE_KEY, ref);
  }
  return ref;
}
