export const MOCK_TOKEN_STORAGE_KEY = "minyoi-mock-tokens-v1";
export const STARTING_TOKENS = 5;

export function loadTokens(): number {
  if (typeof window === "undefined") return STARTING_TOKENS;
  const raw = window.localStorage.getItem(MOCK_TOKEN_STORAGE_KEY);
  if (raw == null) {
    window.localStorage.setItem(MOCK_TOKEN_STORAGE_KEY, String(STARTING_TOKENS));
    return STARTING_TOKENS;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : STARTING_TOKENS;
}

export function saveTokens(value: number): void {
  if (typeof window === "undefined") return;
  const safe = Math.max(0, Math.floor(value));
  window.localStorage.setItem(MOCK_TOKEN_STORAGE_KEY, String(safe));
}

export function spendTokens(amount: number): number {
  const next = Math.max(0, loadTokens() - Math.max(0, Math.floor(amount)));
  saveTokens(next);
  return next;
}

export function addTokens(amount: number): number {
  const next = loadTokens() + Math.max(0, Math.floor(amount));
  saveTokens(next);
  return next;
}
