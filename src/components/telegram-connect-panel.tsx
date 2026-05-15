"use client";

import { useCallback, useEffect, useState } from "react";
import { BellIcon, CheckCircleIcon, PauseIcon, SendIcon } from "@/components/icons";

// Wave 93a: 텔레그램 연동 UI.
// 1. 미연결 상태: 봇 정보 + "연결 코드 받기" 버튼
// 2. 코드 발급됨 (만료 전): deep link 버튼 + 코드 표시 + 취소
// 3. 연결 완료: 사용자명 / 연결 시각 / 일시중지 / 해제

type Status = {
  botConfigured: boolean;
  botUsername: string | null;
  connected: boolean;
  chatId: number | null;
  telegramUsername: string | null;
  verifiedAt: string | null;
  paused: boolean;
  pendingVerifyExpiresAt: string | null;
};

type StartVerifyResp = {
  code: string;
  expiresAt: string;
  deepLink: string | null;
  botUsername: string | null;
};

function fmtKst(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
}

export default function TelegramConnectPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [verify, setVerify] = useState<StartVerifyResp | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/me/telegram/status", { cache: "no-store" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const data = (await r.json()) as Status;
      setStatus(data);
      if (data.connected) setVerify(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 5000); // 연결 진행 중 polling
    return () => clearInterval(t);
  }, [refresh]);

  async function startVerify() {
    setActionLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/me/telegram/start-verify", { method: "POST" });
      const data = (await r.json()) as StartVerifyResp & { error?: string };
      if (!r.ok) throw new Error(data.error ?? `${r.status}`);
      setVerify(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function disconnect() {
    if (!confirm("텔레그램 연결을 해제할까요?")) return;
    setActionLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/me/telegram/disconnect", { method: "POST" });
      if (!r.ok) throw new Error(`${r.status}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#e2d9cb] bg-[#fffaf6] p-5 text-sm font-bold text-[#5a6658] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        상태 확인 중…
      </div>
    );
  }

  if (!status?.botConfigured) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        텔레그램 봇이 아직 설정되지 않았어요. 운영자에게 문의해주세요. (HOTDEAL_TELEGRAM_BOT_USERNAME 환경변수 필요)
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {status.connected ? (
        <ConnectedView status={status} onDisconnect={disconnect} actionLoading={actionLoading} />
      ) : verify ? (
        <PendingVerifyView verify={verify} onCancel={() => setVerify(null)} />
      ) : (
        <NotConnectedView botUsername={status.botUsername} onStart={startVerify} actionLoading={actionLoading} />
      )}
    </div>
  );
}

function NotConnectedView({ botUsername, onStart, actionLoading }: {
  botUsername: string | null;
  onStart: () => void;
  actionLoading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#e2d9cb] bg-[#fffaf6] p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)] dark:bg-zinc-800 dark:text-emerald-300">
          <BellIcon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-black text-[#223127] dark:text-zinc-100">텔레그램 알림 연결</div>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#5a6658] dark:text-zinc-400">
            핫딜 매물이 나오면 텔레그램으로 즉시 알려드려요. 연결 코드를 받아 봇에 입력하면 자동 연결됩니다.
          </p>
          <div className="mt-3 text-xs font-bold text-[#7a8577] dark:text-zinc-500">
            봇: <span className="font-black text-[var(--brand-accent-strong)]">@{botUsername}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onStart}
        disabled={actionLoading}
        className="mt-4 h-11 w-full rounded-xl bg-[var(--brand-accent-strong)] text-sm font-black text-[var(--brand-cream)] transition disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
      >
        {actionLoading ? "발급 중…" : "연결 코드 받기"}
      </button>
    </div>
  );
}

function PendingVerifyView({ verify, onCancel }: {
  verify: StartVerifyResp;
  onCancel: () => void;
}) {
  const [secLeft, setSecLeft] = useState(0);
  useEffect(() => {
    const update = () => setSecLeft(Math.max(0, Math.floor((new Date(verify.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [verify.expiresAt]);

  return (
    <div className="rounded-2xl border border-[#c8d8c4] bg-[var(--brand-accent-soft)] p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="text-sm font-black text-[#223127] dark:text-zinc-100">연결 준비됨</div>
      <p className="mt-1 text-xs font-semibold leading-6 text-[#5a6658] dark:text-zinc-400">
        아래 버튼을 누르면 텔레그램 봇이 열려요. <strong>“START” 한 번만</strong> 누르면 자동으로 연결됩니다.
      </p>

      <div className="mt-4 flex gap-2">
        {verify.deepLink && (
          <a
            href={verify.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0088cc] px-4 text-sm font-black text-white transition hover:bg-[#0077b3]"
          >
            <SendIcon className="h-4 w-4" />
            텔레그램 열기
          </a>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-xl border border-[#ddd4c7] px-4 text-sm font-bold text-[#556252] dark:border-zinc-700 dark:text-zinc-300"
        >
          취소
        </button>
      </div>

      <p className="mt-3 text-[11px] font-semibold text-[#7a8577] dark:text-zinc-500">
        {secLeft > 0
          ? `${Math.floor(secLeft / 60)}:${String(secLeft % 60).padStart(2, "0")} 안에 START 누르세요. 연결되면 자동 갱신됩니다.`
          : "만료됨 — 취소 후 다시 시도하세요."}
      </p>
    </div>
  );
}

function ConnectedView({ status, onDisconnect, actionLoading }: {
  status: Status;
  onDisconnect: () => void;
  actionLoading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#c8d8c4] bg-[#f0f6ec] p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <CheckCircleIcon className="h-4 w-4" />
            </span>
            <span className="text-base font-black text-[#223127] dark:text-zinc-100">연결됨</span>
          </div>
          <div className="mt-2 space-y-1 text-xs font-semibold text-[#5a6658] dark:text-zinc-400">
            <div>텔레그램: {status.telegramUsername ? `@${status.telegramUsername}` : `chat ${status.chatId}`}</div>
            <div>연결: {fmtKst(status.verifiedAt)}</div>
            {status.paused && (
              <div className="flex items-center gap-1.5 font-black text-amber-700 dark:text-amber-400">
                <PauseIcon className="h-3.5 w-3.5" /> 알림 일시 중지 (텔레그램에서 /resume)
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={actionLoading}
          className="h-9 rounded-lg border border-red-300 bg-white px-3 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-zinc-900 dark:text-red-300"
        >
          연결 해제
        </button>
      </div>
    </div>
  );
}
