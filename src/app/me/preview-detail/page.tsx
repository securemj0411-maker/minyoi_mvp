"use client";

// 디자인 핸드오프 (handoff_product_detail) — /me 실제 데이터 바인딩.
// ?pid=NNNN 으로 특정 매물, 없으면 /api/packs/me 첫 매물 자동.
// 로그인 안 됐거나 reveal 없으면 dummy fallback.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { userRefForAuthUser } from "@/lib/user-ref";
import { computeDealScore } from "@/lib/deal-score";

type MeReveal = {
  pid: number;
  name: string;
  url: string;
  price: number;
  thumbnailUrl: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
  skuName: string | null;
  firstSeenAt: string | null;
  marketBasis: {
    medianPrice: number | null;
    p25Price: number | null;
    p75Price: number | null;
    sampleCount: number;
    conditionLabel: string | null;
    computedAt: string | null;
    priceSource: string;
  } | null;
  velocityBasis: { medianHoursToSold: number | null; sold7dCount: number } | null;
  skuListingFlow: { count24h: number; avgPerDay7d: number } | null;
  sellerName: string | null;
  sellerReviewRating: number | null;
  sellerReviewCount: number;
};

type PoolItem = {
  pid: number;
  name: string;
  price: number;
  skuMedian: number | null;
  thumbnailUrl: string | null;
  skuId: string | null;
  skuName: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number | null;
  firstSeenAt: string | null;
  sellerReviewRating: number | null;
  sellerReviewCount: number;
};

type PoolAnalysis = {
  marketBasis?: MeReveal["marketBasis"];
  velocityBasis?: MeReveal["velocityBasis"];
  skuListingFlow?: MeReveal["skuListingFlow"];
};

function poolItemToReveal(item: PoolItem, analysis: PoolAnalysis | null): MeReveal {
  return {
    pid: item.pid,
    name: item.name,
    url: `https://m.bunjang.co.kr/products/${item.pid}`,
    price: item.price,
    thumbnailUrl: item.thumbnailUrl,
    expectedProfitMin: item.expectedProfitMin,
    expectedProfitMax: item.expectedProfitMax,
    confidence: item.confidence ?? 0,
    skuName: item.skuName,
    firstSeenAt: item.firstSeenAt,
    marketBasis: analysis?.marketBasis ?? (item.skuMedian
      ? { medianPrice: item.skuMedian, p25Price: null, p75Price: null, sampleCount: 0, conditionLabel: null, computedAt: null, priceSource: "market" }
      : null),
    velocityBasis: analysis?.velocityBasis ?? null,
    skuListingFlow: analysis?.skuListingFlow ?? null,
    sellerName: null,
    sellerReviewRating: item.sellerReviewRating,
    sellerReviewCount: item.sellerReviewCount,
  };
}

type RevealDetail = {
  imageUrls: string[];
  conditionLabel: string | null;
  description: string;
  seller: {
    name: string | null;
    reviewRating: number | null;
    reviewCount: number;
    proshop: boolean;
    officialSeller: boolean;
  };
  shippingSummary: string;
};

type BoundData = {
  reveal: MeReveal;
  detail: RevealDetail | null;
};

const tokens = {
  bg: "#ebe6dc",
  cream: "#f7f2e8",
  card: "#ffffff",
  cardWarm: "#fffaf0",
  line: "#ece3d2",
  lineStrong: "#ddd4c0",
  ink: "#1a2620",
  ink2: "#344136",
  ink3: "#6f7c6d",
  ink4: "#98a497",
  em: "#3182f6",
  em700: "#1c64dd",
  em50: "#ecfdf5",
  amber: "#b45309",
  amberBg: "#fef7e0",
  rose: "#be123c",
  roseBg: "#ffe4e6",
};

type PhotoProps = {
  label: string;
  h1?: string;
  h2?: string;
  hue?: number;
  light?: number;
  ratio?: string;
  radius?: number;
  small?: boolean;
};

function PhotoPH({ label, h1, h2, hue = 140, light = 78, ratio = "1/1", radius = 12, small = false }: PhotoProps) {
  const stripe = `repeating-linear-gradient(135deg, oklch(${light}% 0.04 ${hue}) 0, oklch(${light}% 0.04 ${hue}) 10px, oklch(${light - 3}% 0.04 ${hue}) 10px, oklch(${light - 3}% 0.04 ${hue}) 20px)`;
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: ratio,
        background: stripe,
        borderRadius: radius,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: `oklch(${light - 35}% 0.04 ${hue})`,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        fontSize: small ? 9 : 11,
        letterSpacing: 0.5,
        lineHeight: 1.4,
        textAlign: "center",
        padding: 8,
      }}
    >
      {h1 && !small && <div style={{ fontWeight: 600, marginBottom: 2 }}>{h1}</div>}
      <div>{label}</div>
      {h2 && !small && <div style={{ opacity: 0.7, marginTop: 2 }}>{h2}</div>}
    </div>
  );
}

const svg = (children: ReactNode, w = 22, h = 22) => (
  <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const Icon = {
  back: (c = "currentColor") => (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  home: (c = "currentColor") => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  bolt: (c = "currentColor") => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill={c} stroke="none">
      <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
    </svg>
  ),
  carrot: (c = "currentColor") => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.78 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46M22 9s-1.33-2-3.5-2c-1.97 0-3.5 1.5-3.5 1.5M15 2s-2 1.33-2 3.5C13 7.47 14.5 9 14.5 9" />
    </svg>
  ),
  check: (c = "currentColor") => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  chevDown: (c = "currentColor") => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  chevRight: (c = "currentColor") => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  shield: (c = "currentColor") => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  search: (c = "currentColor") => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  pulse: (c = "currentColor") => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  clock: (c = "currentColor") => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  trophy: (c = "currentColor") => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM17 5h3v2a4 4 0 0 1-4 4M7 5H4v2a4 4 0 0 0 4 4" />
    </svg>
  ),
  expand: (c = "currentColor") => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  ),
  copy: (c = "currentColor") => (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  bookmark: (c = "currentColor") => (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

type ChipTone = "default" | "em" | "amber" | "rose" | "sky" | "dark" | "cream";

function Chip({ children, tone = "default", size = "sm" }: { children: ReactNode; tone?: ChipTone; size?: "xs" | "sm" }) {
  const tones: Record<ChipTone, { bg: string; fg: string; bd: string }> = {
    default: { bg: "#f3eee3", fg: "#5a6056", bd: "transparent" },
    em: { bg: "#e6f4ec", fg: "#1c64dd", bd: "transparent" },
    amber: { bg: "#fef3c7", fg: "#92400e", bd: "transparent" },
    rose: { bg: "#ffe4e6", fg: "#9f1239", bd: "transparent" },
    sky: { bg: "linear-gradient(90deg,#fff 0%,#eff7ff 50%,#d1f1eb 100%)", fg: "#0c4a6e", bd: "#bcdfff" },
    dark: { bg: "#1f2a24", fg: "#86efac", bd: "transparent" },
    cream: { bg: "transparent", fg: "#5a6056", bd: "#d8cdb6" },
  };
  const t = tones[tone];
  const pad = size === "xs" ? "2px 7px" : "3px 9px";
  const fs = size === "xs" ? 10 : 11;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        borderRadius: 999,
        padding: pad,
        fontSize: fs,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: -0.1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Eyebrow({ children, tone = "em", right }: { children: ReactNode; tone?: "em" | "amber" | "rose" | "muted"; right?: ReactNode }) {
  const colors = { em: "#1c64dd", amber: "#92400e", rose: "#9f1239", muted: "#6f7c6d" };
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: colors[tone],
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {children}
      </span>
      {right && <span style={{ fontSize: 11, color: "#6f7c6d", fontWeight: 600 }}>{right}</span>}
    </div>
  );
}

function SectionH({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 10px" }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: tokens.ink, letterSpacing: -0.3 }}>{children}</h3>
      {right}
    </div>
  );
}

function Card({ children, style, accent }: { children: ReactNode; style?: CSSProperties; accent?: string }) {
  return (
    <div
      style={{
        background: tokens.card,
        border: `1px solid ${tokens.line}`,
        borderRadius: 16,
        padding: 16,
        ...(accent ? { borderLeftWidth: 3, borderLeftColor: accent, borderLeftStyle: "solid" } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MarketStat({
  label,
  valueColor,
  value,
  sub,
  icon,
}: {
  label: string;
  valueColor: string;
  value: string;
  sub: string;
  icon: ReactNode;
}) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "4px 0" }}>
      <div style={{ fontSize: 10.5, color: tokens.ink3, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color: valueColor }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: valueColor, letterSpacing: -0.2 }}>{value}</div>
      <div style={{ fontSize: 10, color: tokens.ink4, marginTop: 4, lineHeight: 1.35 }}>{sub}</div>
    </div>
  );
}

type NegotiationRowTone = "em" | "amber" | "rose";

function NegotiationRow({
  icon,
  tone,
  label,
  sub,
  value,
}: {
  icon: string;
  tone: NegotiationRowTone;
  label: string;
  sub?: string;
  value: string;
}) {
  const tones = {
    em: { bg: "#e6f4ec", fg: "#1c64dd", icon: "#10b981" },
    amber: { bg: "#fef3c7", fg: "#92400e", icon: "#d97706" },
    rose: { bg: "#ffe4e6", fg: "#9f1239", icon: "#e11d48" },
  } as const;
  const t = tones[tone];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", background: t.bg, borderRadius: 12, marginBottom: 6 }}>
      <div style={{ width: 24, height: 24, borderRadius: 999, background: "#fff", color: t.icon, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 900, fontSize: 14 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: tokens.ink2, letterSpacing: -0.3 }}>
          {label}
          {sub && <span style={{ fontVariantNumeric: "tabular-nums", marginLeft: 6, fontSize: 13.5, color: t.fg }}>{sub}</span>}
        </div>
      </div>
      <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 800, color: t.fg, letterSpacing: -0.2, textAlign: "right" }}>{value}</div>
    </div>
  );
}

function Hero({ data }: { data: BoundData | null }) {
  const imgs = data?.detail?.imageUrls ?? (data?.reveal.thumbnailUrl ? [data.reveal.thumbnailUrl] : []);
  const conditionLabel = data?.detail?.conditionLabel ?? "상태 정보 없음";
  const dotCount = Math.min(imgs.length || 1, 4);
  return (
    <div style={{ position: "relative", background: "#000" }}>
      {imgs.length > 0 ? (
        <div style={{ width: "100%", aspectRatio: "4/4.2", overflow: "hidden", background: "#000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgs[0]} alt={data?.reveal.name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : (
        <PhotoPH label={data?.reveal.name ?? "매물 사진"} h1={data?.reveal.skuName ?? "SKU"} hue={150} light={72} ratio="4/4.2" radius={0} />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.35) 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 76,
          right: 14,
          display: "flex",
          gap: 4,
          padding: "5px 10px",
          background: "rgba(0,0,0,0.45)",
          borderRadius: 999,
          backdropFilter: "blur(8px)",
        }}
      >
        {Array.from({ length: dotCount }).map((_, i) => (
          <span key={i} style={{ width: 5, height: 5, borderRadius: 99, background: i === 0 ? "#fff" : "rgba(255,255,255,0.4)" }} />
        ))}
      </div>
      <div style={{ position: "absolute", right: 14, bottom: 18, display: "flex", gap: 8 }}>
        <button
          style={{
            background: "rgba(20,20,20,0.78)",
            backdropFilter: "blur(10px)",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {Icon.expand("#fff")} 크게 보기
        </button>
      </div>
      <div style={{ position: "absolute", left: 14, bottom: 18, display: "flex", gap: 6 }}>
        <span
          style={{
            background: "rgba(255,255,255,0.96)",
            borderRadius: 999,
            padding: "6px 11px",
            fontSize: 11,
            fontWeight: 800,
            color: "#4b5650",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          ● {conditionLabel}
        </span>
      </div>
    </div>
  );
}

function TopBar() {
  const pillBtn = (children: ReactNode, label: string) => (
    <button
      aria-label={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
        color: tokens.ink,
      }}
    >
      {children}
    </button>
  );
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 0,
        right: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 14px",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
        {pillBtn(Icon.back(), "뒤로")}
        {pillBtn(Icon.home(), "홈")}
      </div>
      <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>{pillBtn(Icon.bookmark(), "저장")}</div>
    </div>
  );
}

function StickyCTA() {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: "linear-gradient(180deg, rgba(235,230,220,0) 0%, rgba(235,230,220,0.95) 28%)",
        padding: "14px 14px 28px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: tokens.em,
          borderRadius: 999,
          padding: "4px 4px 4px 6px",
          boxShadow: "0 10px 24px rgba(5,150,105,0.28), 0 4px 8px rgba(5,150,105,0.18)",
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 999, background: "#0b1413", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, color: "#10b981", fontSize: 16 }}>N</span>
        </div>
        <button
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: -0.3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 0",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 20, height: 20, borderRadius: 999, background: "#0b1413", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fbbf24", flexShrink: 0 }}>
            {Icon.bolt("#fbbf24")}
          </span>
          <span>번개장터 원본 매물 보기</span>
        </button>
      </div>
    </div>
  );
}

function calcDealScore(reveal: MeReveal): number {
  // Wave 750 (2026-05-25): `src/lib/deal-score.ts` 의 computeDealScore 통합.
  // 기존 공식 폐기 (confidence bug: 0~1 * 0.2 = max 0.2 → confidence 가 점수에 거의 영향 X).
  return computeDealScore({
    price: reveal.price,
    expectedProfitMin: reveal.expectedProfitMin,
    expectedProfitMax: reveal.expectedProfitMax,
    confidence: reveal.confidence ?? null,
    sampleCount: reveal.marketBasis?.sampleCount ?? null,
    sellerReviewRating: reveal.sellerReviewRating,
    sellerReviewCount: reveal.sellerReviewCount,
  }).score;
}

function TitleBlock({ data }: { data: BoundData | null }) {
  const name = data?.reveal.name ?? "매물 이름";
  const score = data ? calcDealScore(data.reveal) : 100;
  return (
    <div style={{ padding: "18px 18px 0" }}>
      <div style={{ fontSize: 11, color: tokens.ink3, fontWeight: 600, marginBottom: 6 }}>AI 판단 · 매물 설명(텍스트) 기준 · 사진은 직접 확인 권장</div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <h1 style={{ margin: 0, flex: 1, fontSize: 20, lineHeight: 1.3, fontWeight: 800, color: tokens.ink, letterSpacing: -0.5 }}>{name}</h1>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: tokens.em700, letterSpacing: "0.14em", textTransform: "uppercase" }}>득템 점수</div>
          <div style={{ marginTop: 3, display: "flex", alignItems: "baseline", gap: 1, justifyContent: "flex-end" }}>
            <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 28, fontWeight: 900, color: tokens.em700, lineHeight: 1, letterSpacing: -0.5 }}>{score}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 700, color: tokens.ink4 }}>/100</span>
          </div>
          <div style={{ marginTop: 5, width: 70, height: 3, borderRadius: 99, background: "linear-gradient(90deg, #10b981 0%, #3182f6 100%)", marginLeft: "auto" }} />
        </div>
      </div>
    </div>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "시점 미상";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "방금 전";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const d = Math.floor(hr / 24);
  return `${d}일 전`;
}

function ProfitHero({ data }: { data: BoundData | null }) {
  const reveal = data?.reveal;
  const profitMin = reveal?.expectedProfitMin ?? 303850;
  const profitMax = reveal?.expectedProfitMax ?? 307350;
  const price = reveal?.price ?? 350000;
  const median = reveal?.marketBasis?.medianPrice ?? 690000;
  const sample = reveal?.marketBasis?.sampleCount ?? 12;
  const firstSeen = relativeTime(reveal?.firstSeenAt ?? null);
  const profitAvg = (profitMin + profitMax) / 2;
  const pct = price > 0 ? Math.round((profitAvg / price) * 100) : 0;
  return (
    <div style={{ padding: "14px 14px 0" }}>
      <div
        style={{
          background: "linear-gradient(135deg, #f3faf5 0%, #e6f4ec 100%)",
          border: "1px solid #c8e6d4",
          borderRadius: 18,
          padding: "16px 16px 14px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", right: -16, top: -16, opacity: 0.05, fontSize: 100, fontWeight: 900, color: "#3182f6", lineHeight: 1 }}>₩</div>
        <Eyebrow tone="em" right={<span style={{ color: "#6f7c6d", fontWeight: 600, whiteSpace: "nowrap" }}>{firstSeen} · 비교 {sample}개</span>}>
          예상 순익
        </Eyebrow>
        <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 28, fontWeight: 900, color: tokens.em700, letterSpacing: -1, lineHeight: 1.1, marginBottom: 8 }}>
          +{Math.round(profitMin).toLocaleString()}<span style={{ fontSize: 17 }}>원</span>
          {profitMax !== profitMin && (
            <div style={{ fontSize: 14, fontWeight: 700, color: "#6f7c6d", letterSpacing: -0.3, marginTop: 2 }}>
              ~ +{Math.round(profitMax).toLocaleString()}<span style={{ fontSize: 12 }}>원</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Chip tone="em">+{pct}%</Chip>
          {profitAvg > 0 && <Chip tone="em">매입 OK</Chip>}
        </div>
        <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 11, color: tokens.ink3, fontWeight: 600, marginTop: 8, whiteSpace: "nowrap" }}>
          매입 <span style={{ color: tokens.ink2, fontWeight: 800 }}>{price.toLocaleString()}원</span> · 시세 <span style={{ color: tokens.ink2, fontWeight: 800 }}>{median ? median.toLocaleString() : "—"}원</span>
        </div>
        <button
          style={{
            marginTop: 14,
            width: "100%",
            background: "#fff",
            border: "1px solid #c8e6d4",
            color: tokens.em700,
            fontSize: 13,
            fontWeight: 800,
            padding: "11px 12px",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center" }}>{Icon.search("#1c64dd")}</span>
          <span>계산식 · 비교 매물 {sample}개 보기</span>
          <span style={{ display: "inline-flex", alignItems: "center" }}>{Icon.chevRight("#1c64dd")}</span>
        </button>
      </div>
    </div>
  );
}

const SELLING_FEE_RATE_LOCAL = 0.035;

function SellWhere({ data }: { data: BoundData | null }) {
  const median = data?.reveal.marketBasis?.medianPrice ?? 690000;
  const price = data?.reveal.price ?? 350000;
  // 번장: 시세 - 매입 - 안전결제 수수료(3.5%) - 재배송 - 안전버퍼
  const bunjangProfit = Math.round(median - price - median * SELLING_FEE_RATE_LOCAL - 3500 - 5000);
  // 당근: 시세 - 매입 - 재배송 - 안전버퍼 (수수료 0)
  const danggnProfit = Math.round(median - price - 5000);
  const diff = danggnProfit - bunjangProfit;
  return (
    <div style={{ padding: "18px 14px 0" }}>
      <SectionH right={<span style={{ color: tokens.ink3, fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>채널별 예상 차익</span>}>어디에 팔지?</SectionH>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: tokens.card, border: `1px solid ${tokens.line}`, borderRadius: 14, padding: "12px 12px 13px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: "#0b1413", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{Icon.bolt("#fbbf24")}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: tokens.ink2 }}>번개장터</span>
          </div>
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 900, color: tokens.em700, letterSpacing: -0.4 }}>
            {bunjangProfit >= 0 ? "+" : ""}{bunjangProfit.toLocaleString()}<span style={{ fontSize: 11, fontWeight: 800 }}>원</span>
          </div>
          <div style={{ fontSize: 10.5, color: tokens.ink3, marginTop: 3, fontWeight: 600 }}>수수료 3.5% 차감</div>
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
            <Chip tone="em" size="xs">전국 거래</Chip>
            <Chip tone="em" size="xs">안전결제</Chip>
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #fffaf0 0%, #fff5dc 100%)", border: "1.5px solid #fbbf24", borderRadius: 14, padding: "12px 12px 13px", position: "relative" }}>
          {diff > 0 && (
            <div style={{ position: "absolute", top: -8, right: 10, background: "#b45309", color: "#fef3c7", fontSize: 9, fontWeight: 800, padding: "3px 7px", borderRadius: 999, letterSpacing: "0.05em" }}>+{diff.toLocaleString()}원 더</div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: "#ff6f0f", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{Icon.carrot("#fff")}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: tokens.ink2 }}>당근 직거래</span>
          </div>
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 900, color: "#b45309", letterSpacing: -0.4 }}>
            {danggnProfit >= 0 ? "+" : ""}{danggnProfit.toLocaleString()}<span style={{ fontSize: 11, fontWeight: 800 }}>원</span>
          </div>
          <div style={{ fontSize: 10.5, color: tokens.ink3, marginTop: 3, fontWeight: 600 }}>수수료 0원</div>
          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
            <Chip tone="amber" size="xs">지역 제한</Chip>
            <Chip tone="amber" size="xs">네고 부담</Chip>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketStats({ data }: { data: BoundData | null }) {
  const flow = data?.reveal.skuListingFlow;
  const velocity = data?.reveal.velocityBasis;
  const seller = data?.reveal;
  const supplyValue = flow ? `${flow.count24h}건/24h` : "수집 중";
  const supplyColor = flow ? tokens.em700 : tokens.amber;
  const velocityValue = velocity?.medianHoursToSold ? `약 ${Math.round(velocity.medianHoursToSold)}시간` : "수집 중";
  const velocityColor = velocity?.medianHoursToSold ? tokens.em700 : tokens.amber;
  const rating = seller?.sellerReviewRating;
  const reviews = seller?.sellerReviewCount ?? 0;
  const safeValue = rating ? `평점 ${rating.toFixed(1)} 셀러` : "정보 부족";
  const safeColor = rating && rating >= 4.5 ? tokens.em700 : tokens.amber;
  return (
    <div style={{ padding: "18px 14px 0" }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 10px", background: tokens.em50, borderRadius: 10 }}>
          <span style={{ fontSize: 14 }}>💡</span>
          <span style={{ fontSize: 11.5, color: "#065f46", fontWeight: 700, lineHeight: 1.4 }}>비슷한 상태의 매물 중에서도 셀러가 낮게 등록한 것 같아요</span>
        </div>
        <div style={{ display: "flex", alignItems: "stretch", borderRadius: 10 }}>
          <MarketStat label="수요·공급" value={supplyValue} valueColor={supplyColor} sub={flow ? `7일 평균 ${flow.avgPerDay7d}/일` : "같은 상태 · 번개 기준"} icon={Icon.pulse(supplyColor)} />
          <div style={{ width: 1, background: tokens.line }} />
          <MarketStat label="팔리는 속도" value={velocityValue} valueColor={velocityColor} sub={velocity?.sold7dCount ? `7일 ${velocity.sold7dCount}건 판매` : "회전 데이터 수집 중"} icon={Icon.clock(velocityColor)} />
          <div style={{ width: 1, background: tokens.line }} />
          <MarketStat label="거래 안전" value={safeValue} valueColor={safeColor} sub={`후기 ${reviews.toLocaleString()}건`} icon={Icon.trophy(safeColor)} />
        </div>
      </Card>
    </div>
  );
}

function PriceGraph() {
  return (
    <div style={{ padding: "18px 14px 0" }}>
      <SectionH right={<Chip tone="cream">최신 수집 기준</Chip>}>시세 그래프 · 시장 분석</SectionH>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", height: 140, padding: 16, background: "linear-gradient(180deg, #fbf7ec 0%, #ffffff 100%)" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ position: "absolute", left: 16, right: 16, top: 16 + i * 32, height: 1, background: "#f0e8d6" }} />
          ))}
          <svg viewBox="0 0 320 110" preserveAspectRatio="none" style={{ position: "absolute", inset: 16, width: "calc(100% - 32px)", height: "calc(100% - 32px)" }}>
            <path d="M 0 60 Q 80 50, 160 55 T 320 50" stroke="#cad8c9" strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
            <circle cx="0" cy="60" r="3" fill="#3182f6" />
            <text x="6" y="50" fontSize="9" fill="#6f7c6d" fontWeight="700">오늘</text>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: tokens.ink4, fontSize: 12, fontWeight: 600, letterSpacing: -0.2 }}>
            시세 누적 1일째 — 내일부터 추이 표시
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: `1px solid ${tokens.line}`, background: "#fbf7ec" }}>
          <div>
            <div style={{ fontSize: 10, color: tokens.ink3, fontWeight: 700, marginBottom: 2 }}>그래프 기준</div>
            <div style={{ fontSize: 11.5, color: tokens.ink2, fontWeight: 700 }}>같은 상태 · 번개 매물 추이</div>
          </div>
          <button style={{ background: "transparent", border: `1px solid ${tokens.lineStrong}`, color: tokens.ink2, fontSize: 11, fontWeight: 700, padding: "6px 11px", borderRadius: 999, cursor: "pointer" }}>기준 변경</button>
        </div>
      </Card>
    </div>
  );
}

function NegotiationGuide() {
  return (
    <div style={{ padding: "18px 14px 0" }}>
      <SectionH right={<Chip tone="em">차익 충분</Chip>}>협상 가이드</SectionH>
      <Card style={{ padding: 12 }}>
        <NegotiationRow icon="●" tone="em" label="현재 매입가" sub="350,000원" value="차익 +305,600원" />
        <NegotiationRow icon="↓" tone="em" label="협상 시도" sub="330,000원" value="차익 +325,600원" />
        <div style={{ fontSize: 10.5, color: tokens.ink3, padding: "0 4px 8px", lineHeight: 1.4 }}>현재가 −20,000원 깎기 (차익의 30% 또는 최대 2만원)</div>
        <NegotiationRow icon="!" tone="amber" label="약 64.6만원~ 사면" value="차익 1만원 미만" />
        <NegotiationRow icon="×" tone="rose" label="약 65.6만원~ 사면" value="손해 (차익 0 이하)" />
      </Card>
    </div>
  );
}

function CostRow({ label, sub, value, muted }: { label: string; sub?: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, color: muted ? tokens.ink3 : tokens.ink2, fontWeight: 700 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: tokens.ink4, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 800, color: muted ? tokens.ink3 : tokens.ink }}>{value}</div>
    </div>
  );
}

function CostBreakdown() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: "18px 14px 0" }}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: tokens.em700, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 3 }}>비용 계산</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: tokens.ink }}>
              매입 350,000<span style={{ color: tokens.ink3, fontWeight: 600 }}> ~ </span>353,500<span style={{ fontSize: 11, color: tokens.ink3, fontWeight: 600 }}>원 (배송비 반영)</span>
            </div>
          </div>
          <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>{Icon.chevDown(tokens.ink3)}</span>
        </button>
        {open && (
          <div style={{ borderTop: `1px solid ${tokens.line}`, padding: 16, background: "#fdfaf3" }}>
            <CostRow label="상품가" sub="현재 매입 기준" value="350,000원" />
            <CostRow label="내가 낼 배송비" sub="택포/별도 문구는 구매 전 재확인" value="0 ~ 3,500원" />
            <CostRow label="결제 수수료 (내가 살 때)" sub="번개 안전결제는 셀러 의무 (3.5%)" value="0원" />
            <div style={{ height: 1, background: tokens.line, margin: "12px 0" }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: tokens.ink3, marginBottom: 6 }}>되팔 때 빠지는 돈</div>
            <CostRow label="안전결제 3.5%" value="24,150원" muted />
            <CostRow label="재배송비" value="3,500원" muted />
            <CostRow label="안전버퍼" value="5,000원" muted />
            <div style={{ marginTop: 12, padding: 12, background: "#e6f4ec", borderRadius: 10, fontSize: 11, color: tokens.em700, fontWeight: 700, lineHeight: 1.5 }}>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>시세 690,000원 − 매입 350,000원 ~ 353,500원 − 비용</span>
              <div style={{ fontSize: 14, marginTop: 4, letterSpacing: -0.3 }}>
                = 예상 차익{" "}
                <span style={{ fontVariantNumeric: "tabular-nums", color: tokens.em700, fontSize: 16, fontWeight: 900 }}>+303,850원 ~ +307,350원</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function CompareList() {
  const items = [
    { name: "[L] 슈프림 x 노스페이스 RTG 자켓", price: 700000, pct: 100, hue: 30 },
    { name: "노스페이스 x 슈프림 트레킹 컨버터블 자켓", price: 750000, pct: 114, hue: 12 },
    { name: "[L] 슈프림 x 노스페이스 레터링 눕시", price: 850000, pct: 143, hue: 45 },
    { name: "슈프림 x 노스페이스 10SS 풀오버 (덕카모)", price: 958000, pct: 174, hue: 90 },
  ];
  return (
    <div style={{ padding: "18px 14px 0" }}>
      <SectionH right={<span style={{ fontSize: 10.5, color: tokens.ink3, fontWeight: 700, whiteSpace: "nowrap" }}>비슷한 상태끼리만</span>}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{Icon.search(tokens.ink2)} 시세 비교 매물 4개</span>
      </SectionH>
      <Card style={{ padding: 0 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderTop: i === 0 ? "none" : `1px solid ${tokens.line}` }}>
            <div style={{ width: 52, height: 52, flexShrink: 0 }}>
              <PhotoPH label="jacket" hue={it.hue} light={75} ratio="1/1" radius={9} small />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 12.5, fontWeight: 700, color: tokens.ink2, lineHeight: 1.35 }}>
                {it.name}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 14, fontWeight: 900, color: tokens.ink, letterSpacing: -0.3 }}>
                {it.price.toLocaleString()}<span style={{ fontSize: 10 }}>원</span>
              </div>
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 11, fontWeight: 800, color: tokens.em700, marginTop: 1 }}>+{it.pct}%</div>
            </div>
          </div>
        ))}
        <div style={{ padding: "10px 12px", borderTop: `1px solid ${tokens.line}`, textAlign: "center" }}>
          <button style={{ background: "transparent", border: "none", color: tokens.ink3, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>비교 매물 8개 더 보기 ↓</button>
        </div>
      </Card>
    </div>
  );
}

function AuthenticityCheck() {
  return (
    <div style={{ padding: "18px 14px 0" }}>
      <Card accent="#f59e0b" style={{ background: "#fffbef", borderColor: "#fde68a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ color: "#b45309" }}>{Icon.shield("#b45309")}</span>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: "#92400e", letterSpacing: "0.12em", textTransform: "uppercase" }}>정품 확인 필요 · 명품 의류</span>
        </div>
        <h4 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800, color: tokens.ink }}>
          명품 정품 점검 <span style={{ color: "#b45309" }}>6개</span>
        </h4>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: tokens.ink2, lineHeight: 1.5 }}>명품 옷 가품도 흔함. 라벨/봉제/안감 시리얼 3축 확인.</p>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <Chip tone="cream">노스페이스 (TNF)</Chip>
          <Chip tone="rose">가품 위험 큼</Chip>
          <Chip tone="cream">내부 라벨/태그 사진</Chip>
          <Chip tone="cream">안감 시리얼/홀로그램</Chip>
          <Chip tone="cream">정품 영수증 또는 미사용 택</Chip>
          <Chip tone="amber">필수 3개</Chip>
        </div>
      </Card>
    </div>
  );
}

function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);
  const items = [
    { q: "셀러 믿을 만한가요?", a: "이 셀러 평점은 5.0점 (242건 후기). 우수 셀러로 분류돼요 (평점 4.8+ & 후기 30건+)." },
    { q: "가품 위험 없나요?", a: "명품 의류는 가품 흔함. 라벨/봉제/안감 시리얼 3축 확인. 정품 영수증 요청." },
    { q: "안전결제 어떻게 되나요?", a: "번개장터 안전결제는 셀러가 수수료 3.5% 부담. 입금 후 7일 이내 분쟁 가능." },
    { q: "사기 당하면 어떻게 하나요?", a: "안전결제 사용 시 분쟁 접수. 직거래는 영수증/계좌이체 내역 보관." },
  ];
  return (
    <div style={{ padding: "18px 14px 0" }}>
      <Eyebrow
        tone="em"
        right={
          <button style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "transparent", border: "none", fontSize: 10, fontWeight: 700, color: tokens.ink3, cursor: "pointer" }}>
            {Icon.copy(tokens.ink3)} 복사
          </button>
        }
      >
        문의 전 확인 3가지
      </Eyebrow>
      <Card style={{ padding: 0 }}>
        <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", gap: 6, borderBottom: `1px solid ${tokens.line}`, background: "#fdfaf3" }}>
          <span style={{ color: "#b45309" }}>{Icon.shield("#b45309")}</span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: tokens.ink2 }}>구매 전 확인 — 자주 묻는 4가지</span>
        </div>
        {items.map((it, i) => {
          const open = openIdx === i;
          return (
            <div key={i} style={{ borderTop: i === 0 ? "none" : `1px solid ${tokens.line}` }}>
              <button
                onClick={() => setOpenIdx(open ? -1 : i)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "transparent", border: "none", textAlign: "left", cursor: "pointer" }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: tokens.ink, letterSpacing: -0.3 }}>{it.q}</span>
                <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: tokens.ink3 }}>{Icon.chevDown()}</span>
              </button>
              {open && <div style={{ padding: "0 14px 14px", fontSize: 12.5, color: tokens.ink2, lineHeight: 1.6 }}>{it.a}</div>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function OtherRecs() {
  const items = [
    { name: "아크테릭스 알파 SV 자켓 M", price: 880000, profit: 142000, pct: 19, hue: 200 },
    { name: "파타고니아 신칠라 베스트 XL", price: 145000, profit: 95000, pct: 65, hue: 35 },
    { name: "슈프림 박스로고 후드 블랙 M", price: 320000, profit: 78000, pct: 24, hue: 0 },
  ];
  return (
    <div style={{ padding: "18px 14px 0" }}>
      <SectionH right={<button style={{ background: "transparent", border: "none", color: tokens.em700, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>전체 →</button>}>다른 추천 매물</SectionH>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {items.map((it, i) => (
          <div key={i} style={{ flexShrink: 0, width: 140, background: tokens.card, border: `1px solid ${tokens.line}`, borderRadius: 12, overflow: "hidden" }}>
            <PhotoPH label={it.name.split(" ")[0]} hue={it.hue} light={76} ratio="1/1" radius={0} small />
            <div style={{ padding: "10px 10px 11px" }}>
              <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 11.5, fontWeight: 700, color: tokens.ink2, lineHeight: 1.35, minHeight: 30 }}>
                {it.name}
              </div>
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 900, color: tokens.em700, marginTop: 6 }}>
                +{it.profit.toLocaleString()}<span style={{ fontSize: 10 }}>원</span>
              </div>
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 10, color: tokens.ink3, fontWeight: 700, marginTop: 1 }}>
                매입 {it.price.toLocaleString()} · +{it.pct}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhyRec() {
  return (
    <div style={{ padding: "18px 14px 0" }}>
      <Card style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: tokens.em50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {Icon.check(tokens.em700)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: tokens.ink }}>왜 이 상품을 추천했나요?</div>
          <div style={{ fontSize: 11, color: tokens.ink3, marginTop: 2 }}>가격·셀러·시세 3가지 기준 통과</div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 11px", border: `1px solid ${tokens.lineStrong}`, borderRadius: 999, fontSize: 11, fontWeight: 700, color: tokens.ink2, background: "#fff" }}>
          근거 보기 {Icon.chevRight(tokens.ink3)}
        </span>
      </Card>
    </div>
  );
}

function StickyCTAReal({ data }: { data: BoundData | null }) {
  const url = data?.reveal.url;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: "linear-gradient(180deg, rgba(235,230,220,0) 0%, rgba(235,230,220,0.95) 28%)",
        padding: "14px 14px 28px",
      }}
    >
      <a
        href={url ?? "#"}
        target={url ? "_blank" : undefined}
        rel={url ? "noopener noreferrer" : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: tokens.em,
          borderRadius: 999,
          padding: "4px 4px 4px 6px",
          boxShadow: "0 10px 24px rgba(5,150,105,0.28), 0 4px 8px rgba(5,150,105,0.18)",
          textDecoration: "none",
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 999, background: "#0b1413", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 800, color: "#10b981", fontSize: 16 }}>N</span>
        </div>
        <span style={{ flex: 1, color: "#fff", fontSize: 14, fontWeight: 800, letterSpacing: -0.3, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", whiteSpace: "nowrap" }}>
          <span style={{ width: 20, height: 20, borderRadius: 999, background: "#0b1413", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fbbf24", flexShrink: 0 }}>
            {Icon.bolt("#fbbf24")}
          </span>
          <span>번개장터 원본 매물 보기</span>
        </span>
      </a>
    </div>
  );
}

function ProductDetailFrame({ data }: { data: BoundData | null }) {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        background: tokens.bg,
        borderRadius: 44,
        boxShadow: "0 30px 80px rgba(0,0,0,0.25), 0 0 0 11px #1a1a1a, 0 0 0 12px #2a2a2a",
        position: "relative",
        overflow: "hidden",
        color: tokens.ink,
        fontFamily: '"Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif',
      }}
    >
      <div style={{ position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)", width: 120, height: 32, background: "#000", borderRadius: 999, zIndex: 50 }} />
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, overflowY: "auto", background: tokens.bg, paddingBottom: 86, scrollbarWidth: "none" }}>
          <div style={{ position: "relative", background: "#000" }}>
            <Hero data={data} />
            <TopBar />
          </div>
          <div style={{ background: tokens.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, marginTop: -16, position: "relative", zIndex: 5, paddingBottom: 8 }}>
            <div style={{ position: "absolute", top: 7, left: "50%", transform: "translateX(-50%)", width: 36, height: 4, borderRadius: 99, background: "#d0c6b1" }} />
            <TitleBlock data={data} />
            <ProfitHero data={data} />
            <SellWhere data={data} />
            <WhyRec />
            <PriceGraph />
            <MarketStats data={data} />
            <NegotiationGuide />
            <CostBreakdown />
            <CompareList />
            <AuthenticityCheck />
            <FAQ />
            <OtherRecs />
            <div style={{ padding: "24px 14px 16px", textAlign: "center", fontSize: 10.5, color: tokens.ink4, lineHeight: 1.6 }}>
              매물 진위·거래 결과는 보장하지 않으며,
              <br />
              최종 판단은 이용자가 합니다.
            </div>
          </div>
        </div>
        <StickyCTAReal data={data} />
      </div>
    </div>
  );
}

function useRevealData(pidParam: number | null): { data: BoundData | null; status: "loading" | "ok" | "dummy"; error: string | null } {
  const [data, setData] = useState<BoundData | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "dummy">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        const token = sessionData.session?.access_token;
        const userId = sessionData.session?.user?.id;
        if (!token || !userId) {
          if (!cancelled) {
            setStatus("dummy");
            setError("로그인 안 됨 — 더미 데이터 표시");
          }
          return;
        }
        const userRef = userRefForAuthUser(userId);

        // 1. /me 와 동일한 풀에서 매물 가져오기 (auto-30개).
        const poolRes = await fetch("/api/packs/pool", {
          headers: { Authorization: `Bearer ${token}`, "x-user-ref": userRef },
          cache: "no-store",
        });
        if (!poolRes.ok) {
          if (!cancelled) {
            setStatus("dummy");
            setError(`풀 로드 실패 (${poolRes.status}) — /me 에서 매물이 보이면 그 pid를 ?pid=NNN 로 직접 지정해보세요.`);
          }
          return;
        }
        const poolJson = (await poolRes.json()) as { items?: PoolItem[]; message?: string };
        const items = poolJson.items ?? [];
        if (items.length === 0) {
          if (!cancelled) {
            setStatus("dummy");
            setError(poolJson.message ?? "풀 비어있음 — /me 들어가서 매물 확인 후 다시.");
          }
          return;
        }

        const chosenItem = pidParam ? items.find((it) => it.pid === pidParam) ?? items[0] : items[0];

        // 2. analysis fetch (marketBasis/velocity/flow lazy-fill — explore-client 패턴)
        let analysis: PoolAnalysis | null = null;
        try {
          const aRes = await fetch(`/api/packs/pool/analysis?pid=${chosenItem.pid}`, { cache: "no-store" });
          if (aRes.ok) analysis = (await aRes.json()) as PoolAnalysis;
        } catch {
          // analysis 실패해도 기본 정보로 진행
        }

        const reveal = poolItemToReveal(chosenItem, analysis);

        // 3. detail fetch (imageUrls + seller + shipping). reveal 안 한 매물엔 권한 없을 수 있음 — fail OK.
        let detail: RevealDetail | null = null;
        try {
          const detailRes = await fetch("/api/packs/reveals/detail", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-user-ref": userRef },
            body: JSON.stringify({ pid: chosenItem.pid }),
            cache: "no-store",
          });
          if (detailRes.ok) {
            const json = (await detailRes.json()) as { detail?: RevealDetail };
            detail = json.detail ?? null;
          }
        } catch {
          // detail 권한 없으면 thumbnailUrl 만으로 Hero 처리
        }

        if (!cancelled) {
          setData({ reveal, detail });
          setStatus("ok");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("dummy");
          setError(err instanceof Error ? err.message : "로드 실패 — 더미 데이터 표시");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pidParam]);

  return { data, status, error };
}

export default function PreviewDetailPage() {
  const pidParam = useMemo(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("pid");
    return v ? Number(v) || null : null;
  }, []);
  const { data, status, error } = useRevealData(pidParam);

  const banner = status === "loading"
    ? "데이터 로딩 중..."
    : status === "dummy"
    ? error ?? "더미 데이터"
    : `실데이터 pid=${data?.reveal.pid}`;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#2a2a2a", padding: "12px 12px 24px", gap: 12 }}>
      <div style={{ color: status === "ok" ? "#86efac" : "#fbbf24", fontFamily: "ui-monospace, monospace", fontSize: 11, padding: "6px 12px", background: "#000", borderRadius: 8, textAlign: "center", maxWidth: 360 }}>
        {banner}
      </div>
      <ProductDetailFrame data={data} />
    </div>
  );
}
