"use client";

import { useEffect, useState } from "react";
import { DEFAULT_KAKAO_MEMO_TEMPLATE_ID, KAKAO_LOGIN_SCOPES } from "@/lib/kakao";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type SendMode = "default" | "custom";

type SessionState = {
  checked: boolean;
  hasSession: boolean;
  hasKakaoToken: boolean;
  provider: string | null;
};

type ResultState =
  | { status: "idle" }
  | { status: "busy"; message: string }
  | { status: "success"; message: string; detail: string }
  | { status: "error"; message: string; detail: string };

export function KakaoMemoTestPanel() {
  const [sessionState, setSessionState] = useState<SessionState>({
    checked: false,
    hasSession: false,
    hasKakaoToken: false,
    provider: null,
  });
  const [mode, setMode] = useState<SendMode>("default");
  const [templateId, setTemplateId] = useState(DEFAULT_KAKAO_MEMO_TEMPLATE_ID);
  const [result, setResult] = useState<ResultState>({ status: "idle" });

  async function refreshSessionState() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setSessionState({ checked: true, hasSession: false, hasKakaoToken: false, provider: null });
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    setSessionState({
      checked: true,
      hasSession: Boolean(session),
      hasKakaoToken: Boolean(session?.provider_token),
      provider: typeof session?.user?.app_metadata?.provider === "string" ? session.user.app_metadata.provider : null,
    });
  }

  useEffect(() => {
    void refreshSessionState();
  }, []);

  async function requestKakaoConsent() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setResult({ status: "busy", message: "카카오 동의 화면으로 이동 중..." });
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/debug")}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo,
        scopes: KAKAO_LOGIN_SCOPES,
      },
    });
    if (error) {
      setResult({ status: "error", message: "카카오 재동의 시작 실패", detail: error.message });
    }
  }

  async function sendTestMemo() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setResult({ status: "error", message: "Supabase client 없음", detail: "브라우저 공개 env를 확인하세요." });
      return;
    }
    setResult({ status: "busy", message: "카카오톡 테스트 발송 중..." });
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      setResult({ status: "error", message: "로그인이 필요해요", detail: "카카오로 다시 로그인한 뒤 테스트하세요." });
      await refreshSessionState();
      return;
    }
    if (!session.provider_token) {
      setResult({
        status: "error",
        message: "카카오 메시지 토큰이 없어요",
        detail: "기존 로그인 세션에는 talk_message 권한이 없을 수 있어요. 먼저 [카카오 메시지 권한 다시 받기]를 눌러주세요.",
      });
      await refreshSessionState();
      return;
    }

    const res = await fetch("/api/debug/kakao-memo", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kakaoAccessToken: session.provider_token,
        mode,
        templateId: templateId.trim() || DEFAULT_KAKAO_MEMO_TEMPLATE_ID,
        linkUrl: `${window.location.origin}/me`,
        text: "차익잡이 테스트 알림\n새 추천 후보가 도착했어요. /me에서 바로 확인해보세요.",
      }),
    });
    const apiData = await res.json().catch(() => null);
    await refreshSessionState();
    const detail = JSON.stringify(apiData, null, 2);
    if (!res.ok || !apiData?.ok) {
      setResult({
        status: "error",
        message: `발송 실패 (${res.status})`,
        detail,
      });
      return;
    }
    setResult({
      status: "success",
      message: "카카오톡 나와의 채팅방으로 테스트를 보냈어요.",
      detail,
    });
  }

  return (
    <section className="rounded-md border border-yellow-200 bg-yellow-50 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-950">카카오톡 테스트 알림</div>
          <div className="mt-1 max-w-3xl text-xs leading-5 text-zinc-600">
            현재 로그인한 카카오 계정의 나와의 채팅방으로 MVP 테스트 메시지를 보냅니다.
            실제 retention 자동 발송 전에 권한, 토큰, 템플릿을 확인하는 운영용 패널입니다.
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full bg-white px-2 py-1 text-zinc-700 ring-1 ring-yellow-200">
              scope: {KAKAO_LOGIN_SCOPES}
            </span>
            <span className={`rounded-full px-2 py-1 ring-1 ${
              sessionState.hasKakaoToken
                ? "bg-blue-50 text-blue-800 ring-blue-200"
                : "bg-white text-amber-800 ring-yellow-200"
            }`}>
              {sessionState.checked
                ? sessionState.hasKakaoToken
                  ? "카카오 토큰 있음"
                  : "카카오 토큰 없음"
                : "세션 확인 중"}
            </span>
            {sessionState.provider ? (
              <span className="rounded-full bg-white px-2 py-1 text-zinc-700 ring-1 ring-yellow-200">
                provider: {sessionState.provider}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={requestKakaoConsent}
            className="rounded-md border border-yellow-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-yellow-500"
          >
            카카오 메시지 권한 다시 받기
          </button>
          <button
            type="button"
            onClick={sendTestMemo}
            disabled={result.status === "busy"}
            className="rounded-md bg-[#223127] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#344136] disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {result.status === "busy" ? "발송 중" : "테스트 카톡 보내기"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-md border border-yellow-200 bg-white p-3">
          <div className="text-xs font-bold text-zinc-700">발송 방식</div>
          <div className="mt-2 grid gap-1.5">
            {([
              ["default", "기본 텍스트"],
              ["custom", "템플릿 ID"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
                  mode === value
                    ? "bg-[#223127] text-white"
                    : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-yellow-200 bg-white p-3">
          <label className="block">
            <span className="text-xs font-bold text-zinc-700">커스텀 템플릿 ID</span>
            <input
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              disabled={mode !== "custom" || result.status === "busy"}
              className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-yellow-500 disabled:bg-zinc-100 disabled:text-zinc-400"
              placeholder={DEFAULT_KAKAO_MEMO_TEMPLATE_ID}
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            기본 텍스트 방식은 콘솔 템플릿 없이 바로 테스트합니다. 템플릿 ID 방식은 Kakao Developers의 메시지 템플릿 설정과 링크 등록이 맞아야 성공합니다.
          </p>
        </div>
      </div>

      {result.status !== "idle" ? (
        <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${
          result.status === "success"
            ? "border-blue-200 bg-blue-50 text-blue-800"
            : result.status === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-yellow-200 bg-white text-zinc-700"
        }`}>
          <div className="font-semibold">{result.message}</div>
          {"detail" in result ? (
            <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-2 text-[11px] leading-5 text-zinc-700">
              {result.detail}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
