import type { ModelGuide, ModelGuideSection } from "@/lib/model-guides";

function SectionCard({ section }: { section: ModelGuideSection }) {
  return (
    <section className="rounded-2xl border border-[#e2dbcf] bg-[#fffaf1] p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
      <h4 className="text-sm font-black text-[var(--brand-accent-strong)] dark:text-zinc-100">{section.title}</h4>
      <ul className="mt-2 space-y-2 text-xs leading-5 text-[#526152] dark:text-zinc-300">
        {section.items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-accent)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ModelGuidePanel({
  guide,
  cardName,
  onClose,
  onBackToListing,
}: {
  guide: ModelGuide | null;
  cardName?: string;
  onClose: () => void;
  onBackToListing?: () => void;
}) {
  return (
    <div className="flex max-h-[calc(100vh-24px)] overflow-hidden rounded-2xl border border-[#ddd6ca] bg-[#fffdf9] shadow-2xl shadow-[rgba(49,66,56,0.16)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex min-h-0 w-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-[#e2dbcf] p-4 dark:border-zinc-800">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--brand-accent)] dark:text-zinc-300">
              Model Guide
            </div>
            <div className="mt-1 truncate text-base font-black text-[var(--brand-accent-strong)] dark:text-zinc-50">
              {guide?.title ?? "공략 준비 중"}
            </div>
            {cardName ? (
              <>
                <div className="mt-1 truncate text-xs text-[#697469] dark:text-zinc-400">{cardName}</div>
                <div className="mt-1 text-[11px] leading-5 text-[#7a8578] dark:text-zinc-500">
                  이 공략은 상품명과 옵션 추정 기준으로 연결됩니다. 실제 상세 비교도 함께 확인해주세요.
                </div>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {onBackToListing ? (
              <button
                type="button"
                onClick={onBackToListing}
                className="rounded-lg border border-[#d9d1c4] px-2.5 py-1.5 text-xs font-bold text-[#566555] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                상세 비교
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#d9d1c4] px-2.5 py-1.5 text-xs font-bold text-[#566555] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {guide ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#d8e2d7] bg-[var(--brand-accent-soft)] p-4 dark:border-zinc-800 dark:bg-zinc-800/60">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--brand-accent-strong)] ring-1 ring-[#d5dfd2] dark:bg-zinc-900/70 dark:text-zinc-100 dark:ring-zinc-700">
                    {guide.category}
                  </span>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[#596759] ring-1 ring-[#d5dfd2] dark:bg-zinc-900/70 dark:text-zinc-300 dark:ring-zinc-700">
                    {guide.family}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#425141] dark:text-zinc-200">{guide.summary}</p>
                {guide.quickFacts.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {guide.quickFacts.map((fact) => (
                      <span
                        key={fact}
                        className="rounded-full border border-[#d5dfd2] bg-white/80 px-3 py-1 text-[11px] font-bold text-[var(--brand-accent-strong)] dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100"
                      >
                        {fact}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {guide.sections.map((section) => (
                  <SectionCard key={`${guide.guideKey}-${section.type}`} section={section} />
                ))}
              </div>

              <div className="rounded-2xl border border-[#e2dbcf] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                <h4 className="text-sm font-black text-[var(--brand-accent-strong)] dark:text-zinc-100">출처 기준</h4>
                <ul className="mt-2 space-y-2 text-xs leading-5 text-[#566555] dark:text-zinc-300">
                  {guide.sources.map((source) => (
                    <li key={`${guide.guideKey}-${source.sourceType}-${source.label}`}>
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold underline decoration-[#c9d7c9] underline-offset-2 transition hover:text-[var(--brand-accent-strong)] dark:decoration-zinc-600"
                        >
                          {source.label}
                        </a>
                      ) : (
                        <span className="font-bold">{source.label}</span>
                      )}
                      <span className="ml-2 text-[#758175] dark:text-zinc-400">{source.sourceType}</span>
                      {source.note ? <div className="mt-0.5 text-[#758175] dark:text-zinc-400">{source.note}</div> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#e2dbcf] bg-[#fffaf1] p-5 text-sm leading-6 text-[#566555] dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
              <div className="text-base font-black text-[var(--brand-accent-strong)] dark:text-zinc-100">
                아직 공략 문서를 준비 중입니다
              </div>
              <p className="mt-2">
                이 모델은 추천은 가능하지만, 모델 공략 문서는 아직 검수 중입니다. 우선은 상세 비교와 실제 상품 설명을 함께 확인해주세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
