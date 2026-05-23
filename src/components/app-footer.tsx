"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const legalLinks = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund-policy", label: "환불정책" },
  { href: "/youth-policy", label: "청소년보호정책" },
];

// Wave 372: 모바일 친화 푸터 — 사업자 정보 collapse. 한국 전자상거래법은 "표시" 요건만,
// 형태 자유. 데스크탑은 기본 열림 (sm+), 모바일은 닫힘 → 사용자 클릭 시 펼침.
export default function AppFooter() {
  // Wave launch-102 (사용자 정정): cau* admin path 면 footer hide.
  // Wave launch-112 (2026-05-24): 로그인/회원가입/콜백 페이지도 footer hide (focused single-action 화면).
  const pathname = usePathname();
  if (pathname && pathname.startsWith("/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY")) {
    return null;
  }
  if (pathname === "/login" || pathname === "/signup" || pathname?.startsWith("/auth/")) {
    return null;
  }
  return (
    <footer className="mt-10 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-[1380px] px-4 py-5 text-xs text-zinc-600 sm:px-6 sm:py-7 lg:px-8">
        {/* Legal links */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] font-bold text-zinc-900 dark:text-zinc-200">
          {legalLinks.map((link, idx) => (
            <span key={link.label} className="flex items-center gap-x-3">
              <Link href={link.href} className="transition hover:text-[var(--brand-accent-strong)]">
                {link.label}
              </Link>
              {idx < legalLinks.length - 1 ? (
                <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">·</span>
              ) : null}
            </span>
          ))}
        </div>

        {/* 사업자 정보 — 모바일 collapse, 데스크탑 열림 */}
        <details className="group mt-4 sm:open" open>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-bold text-zinc-900 transition hover:text-[var(--brand-accent-strong)] dark:text-zinc-200 sm:cursor-default">
            <span>득템잡이 · 사업자 정보</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 transition-transform group-open:rotate-180 sm:hidden">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>

          <div className="mt-3 space-y-1 leading-5 text-zinc-500 dark:text-zinc-400">
            <div>
              상호명 <b className="font-bold text-zinc-900 dark:text-zinc-300">득템잡이</b>
              <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
              대표 <b className="font-bold text-zinc-900 dark:text-zinc-300">이민제</b>
            </div>
            <div>
              사업자등록번호 <b className="font-bold text-zinc-900 dark:text-zinc-300">563-62-00789</b>
              <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
              통신판매업신고 <b className="font-bold text-zinc-900 dark:text-zinc-300">신고 준비 중</b>
            </div>
            <div>
              주소 제주특별자치도 제주시 수덕로 75, 302호
            </div>
            <div>
              이메일 <a href="mailto:mj12270411@gmail.com" className="font-bold text-zinc-900 hover:text-[var(--brand-accent-strong)] dark:text-zinc-300">mj12270411@gmail.com</a>
              <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
              대표번호 010-8168-5816
              <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
              평일 10:00–18:00
            </div>
            <div>
              호스팅 Vercel
              <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
              서비스명 득템잡이 — 중고 매물 시세 분석 및 크레딧 기반 정보 제공 서비스
            </div>
          </div>
        </details>

        <div className="mt-4 text-[10px] leading-4 text-zinc-400 dark:text-zinc-500">
          득템잡이는 중고거래 매물의 시세 차이·거래 리스크를 분석해 제공하는 정보 서비스이며, 실제 거래의 당사자가 아닙니다.
        </div>
      </div>
    </footer>
  );
}
