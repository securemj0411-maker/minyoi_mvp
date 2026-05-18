"use client";

import { useEffect, useId, useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "S급과 A급은 뭐가 다른가요?",
    answer: "S급은 실사용 흔적이 거의 없거나 새것에 가까운 매물입니다. A급은 풀세트, 배터리 상태, 외관 설명처럼 좋은 신호가 있지만 S급보다는 보수적으로 보는 등급입니다.",
  },
  {
    question: "미개봉이 S급인가요?",
    answer: "아니요. 미개봉/새상품은 S급보다 위의 별도 등급입니다. 다나와 새상품 기준과 번개장터 미개봉 거래 흐름을 함께 보고, 중고 S급 시세와 섞지 않습니다.",
  },
  {
    question: "등급은 어떤 기준으로 분류하나요?",
    answer: "상품명, 설명, 구성품, 배터리, 흠집/파손 표현, 판매자 문구를 함께 봅니다. 상태가 애매하면 더 높은 등급으로 올리지 않고 보수적으로 분류합니다.",
  },
  {
    question: "시세 정확도는 어느 정도인가요?",
    answer: "같은 모델, 같은 옵션, 같은 상태의 매물끼리 우선 비교합니다. 표본이 많고 최근 거래가 충분하면 신뢰도가 높아지고, 표본이 얇으면 신뢰도를 낮춰 표시합니다.",
  },
  {
    question: "손해볼 가능성은 없나요?",
    answer: "완전히 없앨 수는 없습니다. 판매자 응답, 실제 구성품, 흠집, 시세 변동, 재판매 시점 때문에 달라질 수 있습니다. 그래서 차익은 택배비와 거래 비용을 반영해 보수적으로 계산합니다.",
  },
  {
    question: "사용감이 있는데 시세는 어떻게 맞추나요?",
    answer: "사용감 매물은 새상품이나 S급 시세로 비교하지 않습니다. 사용감 등급으로 분류된 매물끼리 먼저 비교해 수익이 부풀려 보이지 않도록 합니다.",
  },
  {
    question: "상품이 사라지거나 판매완료되면 어떻게 되나요?",
    answer: "추천 보관함을 다시 볼 때 판매완료로 정리합니다. 신고나 숨김 등 내부 사유를 사용자에게 노출하지 않고, 진행할 수 없는 매물이라는 점만 명확히 보여줍니다.",
  },
  {
    question: "정보가 틀리면 어떻게 알려주나요?",
    answer: "상품 보기 모달에서 정보 오류 신고를 누르면 운영자가 확인합니다. 적절한 피드백으로 승인되면 토큰 3개가 지급되고, 1인당 피드백 횟수 제한은 없습니다.",
  },
];

export default function SiteHelpFaq() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="도움말 열기"
        className="fixed bottom-4 right-4 z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-[#d9cfbf] bg-[#fffaf1]/95 text-xl font-black text-[#314238] shadow-[0_14px_36px_rgba(34,49,39,0.22)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#9fb49c] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9fb49c] dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100 dark:hover:border-emerald-800 sm:bottom-5 sm:right-5"
      >
        ?
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            aria-label="도움말 닫기"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <section className="absolute bottom-0 right-0 max-h-[88vh] w-full overflow-hidden rounded-t-[28px] border border-[#ddd4c7] bg-[#fffaf6] shadow-[0_28px_80px_rgba(34,49,39,0.28)] dark:border-zinc-800 dark:bg-zinc-950 sm:bottom-5 sm:right-5 sm:w-[430px] sm:rounded-[28px]">
            <header className="flex items-start justify-between gap-4 border-b border-[#e6dccf] px-4 py-4 dark:border-zinc-800">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#667466] dark:text-zinc-500">
                  Help
                </p>
                <h2 id={titleId} className="mt-1 text-lg font-black tracking-tight text-[#223127] dark:text-zinc-100">
                  자주 묻는 질문
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[#ddd4c7] bg-white px-3 py-1.5 text-xs font-black text-[#4d5a4e] transition hover:bg-[#f4eee3] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                닫기
              </button>
            </header>

            <div className="max-h-[calc(88vh-82px)] overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                {FAQ_ITEMS.map((item, index) => (
                  <details
                    key={item.question}
                    open={index < 2}
                    className="group rounded-2xl border border-[#e7dece] bg-white/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-black text-[#26362d] dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
                      <span>{item.question}</span>
                      <span className="mt-0.5 text-xs text-[#7b8679] transition group-open:rotate-180 dark:text-zinc-500">⌄</span>
                    </summary>
                    <p className="mt-2 text-[13px] font-semibold leading-5 text-[#667066] dark:text-zinc-400">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-[#dbe7d7] bg-[#f1f7ef] p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="text-sm font-black text-[#223127] dark:text-zinc-100">고객센터 및 피드백</div>
                <p className="mt-1 text-[13px] font-semibold leading-5 text-[#5f6d60] dark:text-zinc-400">
                  상품 정보가 틀렸다면 상품 보기 모달의 정보 오류 신고를 사용해주세요. 운영자 검수 후 적절하면 토큰 3개를 지급합니다.
                  서비스 의견은 고객센터로 보내주세요.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href="mailto:help@minyoi.kr?subject=%EC%B0%A8%EC%9D%B5%EC%9E%A1%EC%9D%B4%20%ED%94%BC%EB%93%9C%EB%B0%B1"
                    className="flex h-10 items-center justify-center rounded-xl bg-[#314238] px-3 text-xs font-black text-[#f7f1e6] transition hover:bg-[#27362e]"
                  >
                    고객센터
                  </a>
                  <a
                    href="/me#my-reveals-list"
                    onClick={() => setOpen(false)}
                    className="flex h-10 items-center justify-center rounded-xl border border-[#cddbc9] bg-white px-3 text-xs font-black text-[#314238] transition hover:bg-[#f6fbf4] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    피드백 보내기
                  </a>
                </div>
                <p className="mt-2 text-[11px] font-bold text-[#758174] dark:text-zinc-500">
                  피드백은 1인당 횟수 제한 없이 보낼 수 있습니다.
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
