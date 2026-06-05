import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return legacyManualDepositDisabled();
}

export async function POST() {
  return legacyManualDepositDisabled();
}

function legacyManualDepositDisabled() {
  return new NextResponse(
    resultHtml(
      "레거시 입금 처리 종료",
      "크레딧 수동입금 처리는 종료됐어요. 멤버십 신청/연장 승인 메뉴를 이용해주세요.",
    ),
    { status: 410, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function resultHtml(title: string, message: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Pretendard Variable",sans-serif;background:#f5f7fb;color:#191f28;margin:0;padding:24px;display:flex;align-items:center;justify-content:center;min-height:100vh}main{max-width:420px;width:100%;background:#fff;border-radius:24px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,0.08);text-align:center}h1{font-size:22px;font-weight:900;margin:0 0 12px}p{font-size:14px;color:#6b7684;line-height:1.6;margin:0}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;
}
