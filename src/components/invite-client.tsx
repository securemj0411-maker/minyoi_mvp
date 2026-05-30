"use client";

// Wave 731 (2026-05-24): 친구 초대 UI.
// - 사용자 본인 추천 코드 표시 + 공유 링크 복사
// - 카카오 공유 (카카오 SDK 사용)
// - 추천 현황 (가입 / 결제 / 누적 크레딧)

import Link from "next/link";
import { useEffect, useState } from "react";

type ReferralInfo = {
  code: string;
  stats: {
    signupCount: number;
    paymentCount: number;
    totalCredits: number;
  };
};

export default function InviteClient() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/me/referral", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) {
            if (active) setError("로그인이 필요해요");
          } else {
            if (active) setError("추천 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
          }
          return;
        }
        const data = (await res.json()) as ReferralInfo;
        if (active) setInfo(data);
      } catch {
        if (active) setError("추천 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const shareUrl = info ? `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${info.code}` : "";

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      window.prompt("복사하세요:", shareUrl);
    }
  }

  async function shareKakao() {
    if (!info || sharing) return;
    setSharing(true);
    try {
      const kakao = (window as unknown as {
        Kakao?: {
          isInitialized: () => boolean;
          Share?: { sendDefault: (config: Record<string, unknown>) => void };
        };
      }).Kakao;
      if (!kakao?.Share?.sendDefault || !kakao.isInitialized()) {
        window.alert("카카오 공유가 준비되지 않았어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      // Wave 741 (2026-05-24): sendDefault 복원. 친구 초대 카피 + "지금 바로가기" CTA.
      // Wave 805 (2026-05-30): 카피 강화 — 보상 명시 + value (₩2,900 가치 5크레딧) + 시인성 ↑.
      const imageUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/new_balance.jpeg`;
      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: "🎁 친구가 5크레딧 보냈어요 — 득템잡이",
          description: "중고 매물 시세 AI 비교 — 같은 상태 끼리만 비교해서 진짜 싼 매물 잡아드려요. 이 링크로 가입하면 5크레딧 (₩2,900 가치) 즉시 받기.",
          imageUrl,
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
        buttons: [
          {
            title: "5크레딧 받고 시작하기",
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl,
            },
          },
        ],
      });
    } catch (err) {
      console.error("[invite] kakao share failed", err);
      window.alert("카카오 공유에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="inline-flex items-end gap-1.5">
          <span className="h-2 w-2 animate-bounce-high rounded-full bg-[#3182f6] dark:bg-[#ffffff] [animation-delay:-0.32s]" />
          <span className="h-2 w-2 animate-bounce-high rounded-full bg-[#3182f6] dark:bg-[#ffffff] [animation-delay:-0.16s]" />
          <span className="h-2 w-2 animate-bounce-high rounded-full bg-[#3182f6] dark:bg-[#ffffff]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{error}</p>
        <Link
          href="/login"
          className="mt-4 inline-flex h-10 items-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700"
        >
          로그인 하러 가기
        </Link>
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="mx-auto max-w-md space-y-5">
      {/* 헤더 */}
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
          친구 초대하고 크레딧 받기
        </h1>
        <p className="mt-2 text-sm font-bold leading-6 text-zinc-500 dark:text-zinc-400">
          아래 링크를 친구에게 공유해주세요.<br />
          친구가 <span className="text-blue-600 dark:text-blue-300">이 링크로 가입</span>하면 둘 다 <b>+5 크레딧</b>!
        </p>
      </div>

      {/* 공유 액션 (메인) — 큰 버튼 두 개 */}
      <div className="space-y-3">
        {/* 카카오 공유 (주력) */}
        <button
          type="button"
          onClick={shareKakao}
          disabled={sharing}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#fee500] px-4 text-base font-black text-[#191600] shadow-sm transition hover:bg-[#f6dc00] disabled:opacity-60"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#191600]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#fee500]" fill="currentColor">
              <path d="M12 4C6.9 4 2.8 7.2 2.8 11.2c0 2.6 1.8 4.9 4.5 6.1l-.7 2.6c-.1.4.3.7.6.5l3.1-2.1c.5.1 1.1.1 1.7.1 5.1 0 9.2-3.2 9.2-7.2S17.1 4 12 4Z" />
            </svg>
          </span>
          {sharing ? "공유 중..." : "카카오로 친구 초대하기"}
        </button>

        {/* 링크 복사 */}
        <button
          type="button"
          onClick={copyLink}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200 dark:hover:bg-blue-950/40"
        >
          {copied ? "✓ 링크 복사됨" : "초대 링크 복사"}
        </button>
      </div>

      {/* 보상 자세한 설명 — 사용자에게 가장 중요 */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm leading-7 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <div className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
          이렇게 작동해요
        </div>
        <ol className="mt-3 space-y-3 text-[13px] font-semibold">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">1</span>
            <span>위 링크를 카톡으로 공유하거나 복사해서 친구에게 보내세요.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">2</span>
            <span>친구가 그 링크로 들어와서 카카오 가입하면, <b className="text-zinc-900 dark:text-white">친구와 나 양쪽에 5크레딧</b> 즉시 지급돼요.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">3</span>
            <span>친구가 <b className="text-zinc-900 dark:text-white">처음 크레딧을 충전</b>하면 나에게 추가 보상이 와요.<br />
              · 20크레딧 충전 → <b>+3 크레딧</b><br />
              · 200크레딧 충전 → <b>+30 크레딧</b><br />
              · 500크레딧 충전 → <b>+60 크레딧</b>
            </span>
          </li>
        </ol>
        <p className="mt-4 text-[11px] font-bold text-zinc-500 dark:text-zinc-500">
          * 한 사람은 한 번만 추천받을 수 있어요. 자기 자신 추천은 안 돼요.
        </p>
      </div>

      {/* 추천 현황 — Wave 742 (2026-05-24): 0 일 때도 항상 표시 (사용자 정정). */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          지금까지 내가 초대한 친구
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">가입</dt>
            <dd className="mt-1 text-lg font-black tabular-nums text-zinc-950 dark:text-white">
              {info.stats.signupCount}<span className="text-[10px] text-zinc-500">명</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">결제</dt>
            <dd className="mt-1 text-lg font-black tabular-nums text-zinc-950 dark:text-white">
              {info.stats.paymentCount}<span className="text-[10px] text-zinc-500">명</span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">받은 크레딧</dt>
            <dd className="mt-1 text-lg font-black tabular-nums text-blue-700 dark:text-blue-300">
              +{info.stats.totalCredits}
            </dd>
          </div>
        </dl>
      </div>

      {/* 뒤로 */}
      <div className="text-center">
        <Link href="/me" className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
          ← 내 대시보드로 돌아가기
        </Link>
      </div>
    </div>
  );
}
