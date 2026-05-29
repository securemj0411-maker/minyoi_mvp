export const USER_ACTION_HEADER = "x-minyoi-user-action";

export function hasUserActionHeader(headers: Headers): boolean {
  return headers.get(USER_ACTION_HEADER) === "1";
}
