import Link from "next/link";

export default function LegalPageShell({
  eyebrow,
  title,
  updatedAt,
  sections,
}: {
  eyebrow: string;
  title: string;
  updatedAt: string;
  sections: Array<{ heading: string; body: string[] }>;
}) {
  return (
    <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-[980px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-[#ddd4c7] bg-[#fffbf4] px-6 py-7 shadow-[0_20px_48px_rgba(34,49,39,0.06)] sm:px-8 sm:py-9">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-[#ddd4c7] bg-[#fffaf1] px-3 py-1.5 text-xs font-bold text-[#566252] transition hover:bg-[var(--brand-accent-soft)]"
          >
            홈으로
          </Link>

          <div className="mt-5">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-[#5d735f]">{eyebrow}</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#223127] sm:text-4xl">{title}</h1>
            <div className="mt-3 text-sm font-semibold text-[#6c756a]">최종 업데이트: {updatedAt}</div>
            <p className="mt-4 text-sm leading-6 text-[#5a6658] sm:text-[15px]">
              본 문서는 MVP 검토용 mock 정책 페이지입니다. 실제 서비스 운영 전 법률 검토와 실사업자
              정보 반영이 필요합니다.
            </p>
          </div>

          <div className="mt-8 space-y-7">
            {sections.map((section) => (
              <section key={section.heading} className="rounded-[24px] border border-[#e5dccf] bg-[#fffaf1] px-5 py-5">
                <h2 className="text-lg font-black text-[#223127]">{section.heading}</h2>
                <div className="mt-3 space-y-3 text-sm leading-6 text-[#586356] sm:text-[15px]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
