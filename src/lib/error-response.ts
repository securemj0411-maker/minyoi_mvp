// Wave 184 (2026-05-17): API 에러 응답 sanitize utility.
// 메모리 노트: "API 에러 응답에 DB schema/파일경로/사이트 구조 누출 가능성"
//
// 패턴:
// - err.message 를 그대로 response 에 박지 않음 (DB schema, internal 정보 leak)
// - 사용자에게는 sanitized 한국어 메시지
// - 운영자는 console.error 로 detail (Vercel/Supabase 로그에서 디버깅)

import { NextResponse } from "next/server";

export type ErrorResponseOptions = {
  status?: number;
  userMessage?: string;
  // 노출해도 안전한 추가 정보 (예: retryAfter, 카테고리 등). DB error/raw err.message X.
  details?: Record<string, unknown>;
};

/**
 * 사용자 노출 에러 응답. err.message 를 response 에 박지 않음.
 *
 * @param errorCode - 클라이언트가 분기에 쓸 stable code (예: "rate_limited", "pool_listings_failed")
 * @param options - status / userMessage(한국어) / details
 */
export function errorResponse(errorCode: string, options?: ErrorResponseOptions): NextResponse {
  return NextResponse.json(
    {
      error: errorCode,
      message: options?.userMessage ?? "요청 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
      ...(options?.details ?? {}),
    },
    { status: options?.status ?? 500 },
  );
}

/**
 * 에러 로그 박고 sanitized response. 가장 흔한 사용처.
 *
 * 사용:
 * ```ts
 * try { ... } catch (err) {
 *   return logAndRespond("[my-endpoint]", err, "my_failed", {
 *     userMessage: "데이터를 불러오지 못했어요.",
 *     context: { userRef, pid },
 *   });
 * }
 * ```
 *
 * @param logPrefix - 로그 prefix (검색 용)
 * @param err - catch block 의 err
 * @param errorCode - 클라이언트가 분기에 쓸 stable code
 * @param options - status / userMessage / context (로그에만 박힘, response X)
 */
export function logAndRespond(
  logPrefix: string,
  err: unknown,
  errorCode: string,
  options?: ErrorResponseOptions & { context?: Record<string, unknown> },
): NextResponse {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(logPrefix, {
    errorCode,
    detail,
    stack,
    ...(options?.context ?? {}),
  });
  return errorResponse(errorCode, {
    status: options?.status,
    userMessage: options?.userMessage,
    details: options?.details,
  });
}
