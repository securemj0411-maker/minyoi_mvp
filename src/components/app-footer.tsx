import Link from "next/link";

const legalLinks = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund-policy", label: "환불정책" },
  { href: "/youth-policy", label: "청소년보호정책" },
];

export default function AppFooter() {
  return (
    <footer className="mt-10 border-t border-[#e2d9cb] bg-[#f8f4ec] dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6 px-4 py-8 text-sm text-[#5c655b] sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-semibold text-[#344136] dark:text-zinc-200">
          {legalLinks.map((link) => (
            <Link key={link.label} href={link.href} className="transition hover:text-[var(--brand-accent-strong)]">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="grid gap-3 text-[13px] leading-6 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <div className="font-black text-[#223127] dark:text-zinc-100">미뇨이</div>
            <div className="mt-2">
              상호명: 미뇨이
              <br />
              대표자: 이민제
              <br />
              사업자등록번호: 123-45-67890
              <br />
              통신판매업신고: 2026-서울강남-00000
            </div>
          </div>

          <div>
            <div className="font-black text-[#223127] dark:text-zinc-100">고객 지원</div>
            <div className="mt-2">
              이메일: help@minyoi.kr
              <br />
              대표번호: 02-1234-5678
              <br />
              운영시간: 평일 10:00 - 18:00
              <br />
              호스팅 제공자: Vercel
            </div>
          </div>

          <div>
            <div className="font-black text-[#223127] dark:text-zinc-100">사업장 정보</div>
            <div className="mt-2">
              주소: 서울특별시 강남구 테헤란로 000, 0층
              <br />
              서비스명: 미뇨이 MVP
              <br />
              중고 상품 추천 및 모니터링 서비스
            </div>
          </div>
        </div>

        <div className="border-t border-[#e8dfd2] pt-4 text-xs leading-5 text-[#7a8177] dark:border-zinc-800 dark:text-zinc-400">
          현재 표시되는 사업자 정보와 정책 링크는 MVP 검토용 mock입니다. 실제 운영 전 사업자 정보, 신고번호,
          정책 문서는 최종 값으로 교체해야 합니다.
        </div>
      </div>
    </footer>
  );
}
