"use client";

import { useEffect, useId, useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
  shortAnswer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "S급과 A급은 뭐가 다른가요?",
    answer: "S급은 실사용 흔적이 거의 없거나 새것에 가까운 매물입니다. A급은 풀세트, 배터리 상태, 외관 설명처럼 좋은 신호가 있지만 S급보다는 보수적으로 보는 등급입니다.",
    shortAnswer: "S급은 새것에 가까운 상태, A급은 좋은 신호가 있지만 조금 더 보수적으로 보는 상태예요.",
  },
  {
    question: "미개봉이 S급인가요?",
    answer: "아니요. 미개봉/새상품은 S급보다 위의 별도 등급입니다. 다나와 새상품 기준과 번개장터 미개봉 거래 흐름을 함께 보고, 중고 S급 시세와 섞지 않습니다.",
    shortAnswer: "아니요. 미개봉/새상품은 S급보다 위의 별도 등급으로 봅니다.",
  },
  {
    question: "등급은 어떤 기준으로 분류하나요?",
    answer: "상품명, 설명, 구성품, 배터리, 흠집/파손 표현, 판매자 문구를 함께 봅니다. 상태가 애매하면 더 높은 등급으로 올리지 않고 보수적으로 분류합니다.",
    shortAnswer: "상품명, 설명, 구성품, 배터리, 흠집 표현, 판매자 문구를 함께 봅니다.",
  },
  {
    question: "시세 정확도는 어느 정도인가요?",
    answer: "같은 모델, 같은 옵션, 같은 상태의 매물끼리 우선 비교합니다. 표본이 많고 최근 거래가 충분하면 신뢰도가 높아지고, 표본이 얇으면 신뢰도를 낮춰 표시합니다.",
    shortAnswer: "같은 모델, 옵션, 상태의 매물끼리 우선 비교하고 표본이 얇으면 신뢰도를 낮춰 표시합니다.",
  },
  {
    question: "손해볼 가능성은 없나요?",
    answer: "완전히 없앨 수는 없습니다. 판매자 응답, 실제 구성품, 흠집, 시세 변동, 재판매 시점 때문에 달라질 수 있습니다. 그래서 차익은 택배비와 거래 비용을 반영해 보수적으로 계산합니다.",
    shortAnswer: "완전히 없앨 수는 없어서 택배비와 거래 비용까지 넣어 보수적으로 계산합니다.",
  },
  {
    question: "사용감이 있는데 시세는 어떻게 맞추나요?",
    answer: "사용감 매물은 새상품이나 S급 시세로 비교하지 않습니다. 사용감 등급으로 분류된 매물끼리 먼저 비교해 수익이 부풀려 보이지 않도록 합니다.",
    shortAnswer: "사용감 매물은 사용감 매물끼리 먼저 비교해서 수익이 부풀려 보이지 않게 합니다.",
  },
  {
    question: "상품이 사라지거나 판매완료되면 어떻게 되나요?",
    answer: "추천 보관함을 다시 볼 때 판매완료로 정리합니다. 신고나 숨김 등 내부 사유를 사용자에게 노출하지 않고, 진행할 수 없는 매물이라는 점만 명확히 보여줍니다.",
    shortAnswer: "추천 보관함을 다시 볼 때 판매완료로 정리해서 진행 불가 상태를 명확히 보여줍니다.",
  },
  {
    question: "정보가 틀리면 어떻게 알려주나요?",
    answer: "상품 보기 모달에서 정보 오류 신고를 누르면 운영자가 확인합니다. 적절한 피드백으로 승인되면 토큰 3개가 지급되고, 1인당 피드백 횟수 제한은 없습니다.",
    shortAnswer: "상품 보기 모달에서 정보 오류 신고를 누르면 운영자가 확인하고, 승인되면 토큰 3개를 지급합니다.",
  },
];

function HeadsetIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
    >
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v3.5A2.5 2.5 0 0 0 6.5 19H8v-7H6.5A2.5 2.5 0 0 0 4 14.5" />
      <path d="M20 13v3.5A2.5 2.5 0 0 1 17.5 19H16v-7h1.5a2.5 2.5 0 0 1 2.5 2.5" />
      <path d="M16 19c0 1.1-.9 2-2 2h-2" />
    </svg>
  );
}

export default function SiteHelpFaq() {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const titleId = useId();
  const selectedItem = FAQ_ITEMS[selectedIndex] ?? FAQ_ITEMS[0];

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setIsThinking(true);
    const timeout = window.setTimeout(() => setIsThinking(false), 360);
    return () => window.clearTimeout(timeout);
  }, [open, selectedIndex]);

  function askQuestion(index: number) {
    setSelectedIndex(index);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="AI 도움말 열기"
        className="fixed bottom-4 right-4 z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-[#bfd2c1] bg-[#f8fff5]/95 text-xl font-black text-[#263d2f] shadow-[0_16px_42px_rgba(31,65,45,0.26)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[#82aa88] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bb993] dark:border-emerald-900/70 dark:bg-zinc-900/95 dark:text-zinc-100 sm:bottom-5 sm:right-5"
      >
        <span className="absolute inset-0 rounded-full bg-emerald-300/20 blur-md" />
        <HeadsetIcon className="relative h-6 w-6" />
        <span className="absolute -right-1 -top-1 rounded-full border border-white bg-[#214233] px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm dark:border-zinc-950">
          AI
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            aria-label="도움말 닫기"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <section className="absolute bottom-0 right-0 max-h-[90vh] w-full overflow-hidden rounded-t-[28px] border border-[#d7e2d4] bg-[#f7fbf3] shadow-[0_28px_80px_rgba(34,49,39,0.3)] dark:border-zinc-800 dark:bg-zinc-950 sm:bottom-5 sm:right-5 sm:w-[440px] sm:rounded-[28px]">
            <header className="border-b border-[#dfe8d9] bg-white/70 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#234332] text-xs font-black text-white shadow-[0_10px_24px_rgba(35,67,50,0.22)]">
                    <HeadsetIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-[#5e755f] dark:text-emerald-400">Assistant</p>
                    <h2 id={titleId} className="mt-0.5 text-lg font-black text-[#223127] dark:text-zinc-100">
                      AI 도움말
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-[#d8dfd3] bg-white px-3 py-1.5 text-xs font-black text-[#4d5a4e] transition hover:bg-[#f1f6ee] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  닫기
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] font-bold text-[#637063] dark:text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]" />
                질문을 고르면 바로 답해드릴게요
              </div>
            </header>

            <div className="max-h-[calc(90vh-92px)] overflow-y-auto px-4 py-3">
              <div className="rounded-3xl border border-[#dce8d8] bg-white p-3 shadow-[0_10px_28px_rgba(34,49,39,0.07)] dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex items-start gap-2.5">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e7f4e5] text-[10px] font-black text-[#234332] dark:bg-emerald-950 dark:text-emerald-300">
                    <HeadsetIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-[#f3f8ef] px-3 py-2.5 dark:bg-zinc-950">
                    <p className="text-sm font-black text-[#223127] dark:text-zinc-100">
                      궁금한 내용을 골라주세요.
                    </p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#647064] dark:text-zinc-400">
                      등급, 시세, 손해 가능성, 피드백 보상을 짧게 풀어서 설명해드릴게요.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {FAQ_ITEMS.slice(0, 4).map((item, index) => (
                    <button
                      key={item.question}
                      type="button"
                      onClick={() => askQuestion(index)}
                      className={`rounded-full border px-3 py-2 text-[12px] font-black transition ${
                        selectedIndex === index
                          ? "border-[#234332] bg-[#234332] text-white shadow-[0_8px_18px_rgba(35,67,50,0.18)]"
                          : "border-[#dbe5d6] bg-white text-[#35483a] hover:border-[#a7c2a5] hover:bg-[#f8fff5] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {item.question}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex items-start justify-end gap-2.5">
                  <div className="max-w-[86%] rounded-2xl rounded-tr-sm bg-[#234332] px-3 py-2.5 text-right text-sm font-black leading-5 text-white">
                    {selectedItem.question}
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2.5">
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e7f4e5] text-[10px] font-black text-[#234332] dark:bg-emerald-950 dark:text-emerald-300">
                    <HeadsetIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-[#f3f8ef] px-3 py-2.5 dark:bg-zinc-950">
                    {isThinking ? (
                      // Wave 730: animate-bounce → animate-bounce-high (더 높이 튐) + 다크모드 variant 추가 (다크에서 회색-녹색 안 보임).
                      <div className="flex h-10 items-end gap-1.5" aria-label="답변 준비 중">
                        <span className="h-2 w-2 animate-bounce-high rounded-full bg-[#3182f6] dark:bg-[#ffffff]" />
                        <span className="h-2 w-2 animate-bounce-high rounded-full bg-[#3182f6] dark:bg-[#ffffff] [animation-delay:120ms]" />
                        <span className="h-2 w-2 animate-bounce-high rounded-full bg-[#3182f6] dark:bg-[#ffffff] [animation-delay:240ms]" />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-black leading-5 text-[#223127] dark:text-zinc-100">
                          {selectedItem.shortAnswer}
                        </p>
                        <p className="mt-2 text-[13px] font-semibold leading-5 text-[#637063] dark:text-zinc-400">
                          {selectedItem.answer}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-2 text-xs font-black text-[#536453] dark:text-zinc-400">자주 묻는 질문</div>
                <div className="grid gap-2">
                  {FAQ_ITEMS.map((item, index) => (
                    <button
                      key={item.question}
                      type="button"
                      onClick={() => askQuestion(index)}
                      className={`flex items-start justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                        selectedIndex === index
                          ? "border-[#a9c9a6] bg-[#eef8ea] dark:border-emerald-900/80 dark:bg-emerald-950/20"
                          : "border-[#e4ecdf] bg-white/80 hover:border-[#bfd2c1] hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <span className="text-sm font-black text-[#26362d] dark:text-zinc-100">{item.question}</span>
                      <span className="mt-0.5 shrink-0 text-xs font-black text-[#7b8679] dark:text-zinc-500">답변</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-[#dbe7d7] bg-[#f1f7ef] p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="text-sm font-black text-[#223127] dark:text-zinc-100">고객센터 및 피드백</div>
                <p className="mt-1 text-[13px] font-semibold leading-5 text-[#5f6d60] dark:text-zinc-400">
                  상품 정보가 틀렸다면 상품 보기 모달의 정보 오류 신고를 사용해주세요. 운영자 검수 후 적절하면 토큰 3개를 지급합니다.
                  서비스 의견은 고객센터로 보내주세요.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href="mailto:mj12270411@gmail.com?subject=%EB%93%9D%ED%85%9C%EC%9E%A1%EC%9D%B4%20%ED%94%BC%EB%93%9C%EB%B0%B1"
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
