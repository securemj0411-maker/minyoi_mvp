// Wave 724 (2026-05-23): Supabase Auth 영문 에러 메시지를 일반인 친화 한글로 매핑.
// 이전엔 `setMessage(error.message)` 라서 "Invalid login credentials", "User already registered"
// 같은 영문이 그대로 노출 → 입문자가 "내 잘못인가? 가입된 건가?" 혼란.
//
// 매핑 원칙:
// - 사용자가 할 수 있는 다음 행동을 명시 (재시도 / 운영자 문의 / 메일 확인 등)
// - DB schema / 내부 상태 노출 금지
// - 모르는 에러는 fallback (raw 영문 노출 X)
//
// 참고: Supabase auth 메시지는 영문 패턴이 안정적이지 않음. 부분 문자열 매칭으로 처리.

const SUPABASE_AUTH_ERROR_PATTERNS: Array<{ test: RegExp; message: string }> = [
  // 로그인 실패
  {
    test: /invalid.*login.*credentials|invalid_credentials/i,
    message: "이메일 또는 비밀번호가 맞지 않아요. 다시 확인해주세요.",
  },
  {
    test: /email.*not.*confirmed|email_not_confirmed/i,
    message: "이메일 인증이 아직 안 됐어요. 받은 메일의 인증 링크를 눌러주세요.",
  },

  // 가입 충돌
  {
    test: /user.*already.*registered|already.*been.*registered|user_already_exists/i,
    message: "이미 가입된 이메일이에요. 로그인 화면에서 시도해주세요.",
  },

  // 비밀번호 규칙
  {
    test: /password.*should.*be.*at.*least|password.*too.*short|weak_password/i,
    message: "비밀번호는 6자 이상으로 설정해주세요.",
  },

  // 이메일 형식
  {
    test: /unable.*to.*validate.*email|invalid.*email|email_address_invalid/i,
    message: "이메일 주소 형식이 올바르지 않아요.",
  },

  // Rate limit / 보안
  {
    test: /email.*rate.*limit|over_email_send_rate_limit/i,
    message: "이메일 발송 한도를 넘었어요. 잠시 후 다시 시도해주세요.",
  },
  {
    test: /for security purposes|over_request_rate_limit|too many requests/i,
    message: "잠시 후 다시 시도해주세요. (보안을 위해 잠깐 차단됐어요)",
  },

  // 가입/로그인 제한
  {
    test: /signup.*disabled|signup_disabled/i,
    message: "현재 가입을 받지 않고 있어요. 운영자에게 문의해주세요.",
  },
  {
    test: /anonymous.*sign.*ins.*disabled/i,
    message: "익명 로그인은 지원하지 않아요. 이메일이나 카카오로 가입해주세요.",
  },

  // 서버/DB 에러
  {
    test: /database.*error.*saving.*new.*user|unexpected_failure/i,
    message: "가입 처리 중 오류가 났어요. 잠시 후 다시 시도하거나 운영자에게 문의해주세요.",
  },

  // OAuth provider 에러
  {
    test: /access_denied|user.*cancel/i,
    message: "카카오 로그인이 취소됐어요. 다시 시도해주세요.",
  },
  {
    test: /provider.*disabled|provider_email_needs_verification/i,
    message: "카카오 로그인 설정에 문제가 있어요. 운영자에게 문의해주세요.",
  },
];

/**
 * Supabase Auth 영문 에러 메시지를 일반인 친화 한글로 변환.
 * 매칭 안 되면 generic fallback. raw 영문은 노출하지 않음.
 */
export function translateSupabaseAuthError(raw: string | null | undefined): string {
  if (!raw) {
    return "로그인 처리 중 오류가 났어요. 잠시 후 다시 시도하거나 운영자에게 문의해주세요.";
  }
  for (const { test, message } of SUPABASE_AUTH_ERROR_PATTERNS) {
    if (test.test(raw)) return message;
  }
  // Wave 724: 알려지지 않은 영문 메시지는 raw 노출하지 않고 generic fallback.
  // 운영자는 console.error 로그로 확인 가능.
  return "로그인 처리 중 오류가 났어요. 잠시 후 다시 시도하거나 운영자에게 문의해주세요.";
}

/**
 * /auth/callback 에서 redirect 시 query param 으로 전달할 error code 결정.
 * 카카오/Supabase 가 보내는 `error`, `error_description` 을 좁은 코드로 정규화.
 */
export function classifyOAuthCallbackError(
  error: string | null,
  errorDescription: string | null,
): string {
  if (!error) return "oauth-error";
  const desc = (errorDescription ?? "").toLowerCase();
  if (error === "access_denied") return "oauth-denied";
  if (error === "server_error" && /database/.test(desc)) return "oauth-db-error";
  if (/rate.*limit|too.*many/.test(desc)) return "oauth-rate-limit";
  return "oauth-error";
}
