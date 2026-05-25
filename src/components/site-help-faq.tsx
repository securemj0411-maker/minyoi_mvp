"use client";

import { FormEvent, useEffect, useId, useState } from "react";

import { AlertTriangleIcon, GiftIcon, SendIcon } from "@/components/icons";

type FeedbackCategory = "other" | "price_wrong" | "category_wrong" | "fake";

const FEEDBACK_CATEGORIES: Array<{ value: FeedbackCategory; label: string; helper: string }> = [
  { value: "other", label: "서비스 의견", helper: "불편한 흐름이나 필요한 기능" },
  { value: "price_wrong", label: "시세 이상", helper: "수익, 가격, 비교 매물 오류" },
  { value: "category_wrong", label: "분류 이상", helper: "모델, 상태, 카테고리 오류" },
  { value: "fake", label: "위험 의심", helper: "가품, 사기, 수상한 매물" },
];

export default function SiteHelpFaq() {
  const [open, setOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>("other");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = feedbackMessage.trim();
    if (message.length < 5) {
      setSubmitState("error");
      setSubmitMessage("어떤 점이 이상했는지 5자 이상 적어주세요.");
      return;
    }
    setSubmitState("submitting");
    setSubmitMessage(null);
    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: feedbackCategory, message }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; reward?: number };
      if (!res.ok) {
        setSubmitState("error");
        setSubmitMessage(data.message ?? "로그인 후 다시 보내주세요.");
        return;
      }
      setSubmitState("success");
      setSubmitMessage(`접수됐어요. 운영자 검토 후 적절하면 +${data.reward ?? 20}크레딧을 지급합니다.`);
      setFeedbackMessage("");
    } catch (err) {
      setSubmitState("error");
      setSubmitMessage(err instanceof Error ? err.message : "네트워크 오류가 발생했어요.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="피드백 센터 열기"
        className="fixed bottom-4 right-4 z-[70] flex h-[52px] min-h-[52px] items-center gap-2 rounded-full border border-blue-400/30 bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-[0_16px_42px_rgba(37,99,235,0.34)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:border-blue-300/20 dark:bg-blue-500 dark:hover:bg-blue-400 sm:bottom-5 sm:right-5"
      >
        <SendIcon className="h-5 w-5" />
        <span className="hidden sm:inline">피드백</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            aria-label="도움말 닫기"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <section className="absolute bottom-0 right-0 max-h-[92dvh] w-full overflow-hidden rounded-t-[28px] border border-blue-100 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)] dark:border-zinc-800 dark:bg-zinc-950 sm:bottom-5 sm:right-5 sm:max-h-[76vh] sm:w-[380px] sm:rounded-[24px]">
            <header className="border-b border-blue-100 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-3.5 sm:py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xs font-black text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)]">
                    <SendIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Feedback</p>
                    <h2 id={titleId} className="mt-0.5 text-lg font-black text-zinc-950 dark:text-zinc-100">
                      피드백 센터
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-black text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  닫기
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.16)]" />
                틀린 정보와 불편한 점을 바로 보내주세요
              </div>
            </header>

            <div className="max-h-[calc(92dvh-92px)] overflow-y-auto px-4 py-3 sm:max-h-[calc(76vh-84px)] sm:px-3.5">
              <div className="rounded-[22px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-4 shadow-[0_12px_32px_rgba(37,99,235,0.10)] dark:border-blue-900/40 dark:from-blue-950/35 dark:via-zinc-950 dark:to-zinc-950 sm:p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]">
                    <GiftIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-black text-blue-600 dark:text-blue-300">좋은 제보 보상</div>
                    <div className="mt-0.5 text-xl font-black tracking-tight text-zinc-950 dark:text-white">
                      검토 후 +20크레딧
                    </div>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-zinc-600 dark:text-zinc-400">
                      시세가 이상하거나, 이미 팔렸거나, 상품 분류가 틀린 제보가 제일 도움이 돼요.
                    </p>
                  </div>
                </div>

                <form onSubmit={submitFeedback} className="mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    {FEEDBACK_CATEGORIES.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setFeedbackCategory(item.value)}
                        className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                          feedbackCategory === item.value
                            ? "border-blue-500 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)]"
                            : "border-zinc-200 bg-white text-zinc-800 hover:border-blue-200 hover:bg-blue-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-blue-900 dark:hover:bg-blue-950/25"
                        }`}
                      >
                        <span className="block text-[12px] font-black">{item.label}</span>
                        <span className={`mt-0.5 block text-[10px] font-bold leading-4 ${
                          feedbackCategory === item.value ? "text-blue-100" : "text-zinc-500 dark:text-zinc-400"
                        }`}>
                          {item.helper}
                        </span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={feedbackMessage}
                    onChange={(event) => {
                      setFeedbackMessage(event.target.value);
                      if (submitState !== "submitting") {
                        setSubmitState("idle");
                        setSubmitMessage(null);
                      }
                    }}
                    placeholder="예: 에어팟 맥스 시세가 너무 높게 잡힌 것 같아요. 비교 매물에 다른 세대가 섞인 것 같습니다."
                    className="mt-3 min-h-[88px] w-full resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold leading-5 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-blue-950"
                  />
                  <button
                    type="submit"
                    disabled={submitState === "submitting"}
                    className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-[0_12px_26px_rgba(37,99,235,0.22)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300 dark:bg-blue-500 dark:hover:bg-blue-400"
                  >
                    <SendIcon className="h-4 w-4" />
                    {submitState === "submitting" ? "보내는 중" : "피드백 보내기"}
                  </button>
                  {submitMessage ? (
                    <p className={`mt-2 text-[12px] font-bold leading-5 ${
                      submitState === "success" ? "text-blue-700 dark:text-blue-300" : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {submitMessage}
                    </p>
                  ) : null}
                </form>
              </div>

              <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex items-start gap-2.5">
                  <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <div className="text-sm font-black text-zinc-950 dark:text-zinc-100">특정 매물이 이상하다면</div>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
                      시세, 상태, 가품 의심처럼 상품 하나에 대한 제보는 상세 화면 신고가 가장 정확해요. 매물 정보가 같이 들어와서 검토가 빠르고, 승인되면 +20크레딧 보상도 바로 연결됩니다.
                    </p>
                  </div>
                </div>
                <a
                  href="/me#my-reveals-list"
                  onClick={() => setOpen(false)}
                  className="mt-3 flex h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
                >
                  상세 화면에서 신고하기
                </a>
              </div>

              <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="text-sm font-black text-zinc-950 dark:text-zinc-100">직접 연락</div>
                <p className="mt-1 text-[13px] font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
                  계정, 결제, 입금 문제는 메일로 보내주세요. 매물 오류는 위 제보나 상세 화면 신고가 더 빠릅니다.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href="mailto:mj12270411@gmail.com?subject=%EB%93%9D%ED%85%9C%EC%9E%A1%EC%9D%B4%20%ED%94%BC%EB%93%9C%EB%B0%B1"
                    className="flex h-10 items-center justify-center rounded-xl bg-zinc-950 px-3 text-xs font-black text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    고객센터
                  </a>
                  <a
                    href="/me#my-reveals-list"
                    onClick={() => setOpen(false)}
                    className="flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-black text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    상세 신고
                  </a>
                </div>
                <p className="mt-2 text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
                  피드백은 운영자가 검토한 뒤 보상 여부를 결정합니다.
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
