"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import MarketHistoryChart from "@/components/market-history-chart";
import ModelGuidePanel from "@/components/model-guide-panel";
import { ConditionChip, ConditionPhotoBadge } from "@/components/condition-chip";
import { RiskScoreBar } from "@/components/risk-score-bar";
import { BunjangLogo, BunjangSourceBadge, DanawaLogo, DanawaSourceBadge } from "@/components/market-brand-logo";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FlameIcon,
  HourglassIcon,
  PackageIcon,
  ScaleIcon,
  ShieldIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TrophyIcon,
  WalletIcon,
  ZapIcon,
} from "@/components/icons";
import { findModelGuide, type ModelGuide } from "@/lib/model-guides";
import type { PackBand, RevealCard, RevealFeedbackType, RevealListingDetail } from "@/lib/pack-open";
import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE } from "@/lib/profit";
import { buyPriceGuidance } from "@/lib/buy-price-guidance";
import { categoryFromComparableKey } from "@/lib/category-readiness";
import {
  counterfeitChecklistFor,
  PRIORITY_LABEL,
  type CounterfeitCheckPriority,
} from "@/lib/counterfeit-checklist";
// Wave A (2026-05-20): 카테고리별 브랜드 깊이 정보 (Nike Jordan, Adidas Yeezy 등).
// CounterfeitChecklistPanel + WhyTrustCollapse 가품 Q 답 둘 다 사용.
import {
  detectBrandDepth,
  COUNTERFEIT_RISK_LABEL,
  type BrandDepthMatch,
} from "@/lib/category-brand-depth";
import {
  sellHelperFor,
  suggestedAskingPrice,
  buildBodyTemplate,
} from "@/lib/sell-helper";
import { buildRiskScore, type RiskScoreInput, type RiskTone } from "@/lib/risk-score";

type RevealResult =
  | {
      result: "success";
      reveals: RevealCard[];
      attemptedCount: number;
      durationMs: number;
    }
  | {
      result: "refunded";
      reason: string;
      tokensRefunded: number;
      durationMs: number;
    }
  | {
      result: "unavailable";
      reason: string;
      durationMs: number;
    };

type Props = {
  open: boolean;
  band: PackBand;
  loading: boolean;
  result: RevealResult | null;
  initialPreviewCard?: RevealCard | null;
  initialPreviewMode?: "listing" | "guide";
  initialPreviewSeed?: string | number | null;
  onClose: () => void;
  onLinkClicked: (pid: number) => void;
  onFeedback: (pid: number, feedbackType: RevealFeedbackType, note?: string) => void;
  currentFeedbackType?: string | null;
  onLoadDetail: (pid: number) => Promise<RevealListingDetail>;
  relatedItems?: RelatedRevealItem[];
  onOpenRelatedItem?: (pid: number) => void;
  // Wave 182b (2026-05-17): 손해 신고 — 카드 list 에서 빼고 모달 안 1곳에만 박음.
  // optional — pack 열기 흐름 (새 매물 받기) 에서는 안 박힘. user-reveal-dashboard "상품 보기" 에서만 전달.
  onReportLoss?: (card: RevealCard) => void;
  // optional: 이 매물 이미 신고됨 — 버튼 비활성화.
  alreadyReportedLoss?: boolean;
  onLoadGuide?: (card: RevealCard) => Promise<ModelGuide | null>;
  renderGuidePanel?: (args: {
    card: RevealCard;
    guide: ModelGuide | null;
    loading: boolean;
    error: string | null;
    onClose: () => void;
  }) => ReactNode;
  onRetry: () => void;
};

type RelatedRevealItem = {
  pid: number;
  name: string;
  price: number;
  thumbnailUrl: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  marketBasis: RevealCard["marketBasis"] | null;
  revealedAt: string;
};

type PreviewSide = "left" | "right";
type TransactionFeedbackType = Extract<RevealFeedbackType, "contacted" | "bought" | "passed" | "inspected" | "listed" | "resold">;
type RecommendationFeatureTone = "profit" | "market" | "speed" | "quality";
type RecommendationFeatureCard = {
  icon: ReactNode;
  title: string;
  body: string;
  tone: RecommendationFeatureTone;
};

// 2026-05-19 P0 fix: 폴백 게이트화. 실데이터 없을 때 거짓 "약 2일 (카테고리 평균)" 노출 문제.
//   - `NEXT_PUBLIC_VELOCITY_UI_TEST==='1'` 인 환경(개발/테스트)에서만 48h 폴백을 보여준다.
//   - 운영(게이트 OFF)에서는 폴백 hours = null → UI 카드는 "회전 데이터 수집 중"으로 표시.
//   - 거짓 "카테고리 평균" 카피 제거 (Wave 297 결정 로그 미반영분 해소).
const UI_TEST_FALLBACK_VELOCITY_HOURS = 48;
const VELOCITY_UI_TEST_ENABLED =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_VELOCITY_UI_TEST === "1";

const TRANSACTION_STATUS_LABEL: Record<TransactionFeedbackType, string> = {
  contacted: "문의함",
  bought: "매수함",
  passed: "포기함",
  inspected: "검수 완료",
  listed: "판매 등록",
  resold: "판매 완료",
};

const TRANSACTION_ACTIONS: Array<{
  type: TransactionFeedbackType;
  label: string;
  note: string;
}> = [
  { type: "contacted", label: "문의했어요", note: "판매자에게 문의함" },
  { type: "bought", label: "매수했어요", note: "매수 완료" },
  { type: "passed", label: "포기했어요", note: "이 매물은 진행하지 않음" },
];

const POST_BUY_ACTIONS: Array<{
  type: TransactionFeedbackType;
  label: string;
  note: string;
}> = [
  { type: "inspected", label: "검수 완료", note: "매수 후 검수 완료" },
  { type: "listed", label: "판매 등록", note: "재판매 등록 완료" },
  { type: "resold", label: "판매 완료", note: "재판매 완료" },
];

function isTransactionFeedbackType(value: string | null | undefined): value is TransactionFeedbackType {
  return value === "contacted"
    || value === "bought"
    || value === "passed"
    || value === "inspected"
    || value === "listed"
    || value === "resold";
}

function isPostBuyFeedbackType(value: TransactionFeedbackType | null) {
  return value === "bought" || value === "inspected" || value === "listed" || value === "resold";
}

const LOADING_STEPS = [
  "AI가 추천 상품을 끌어오고 있습니다...",
  "지금 살아있는 상품인지 다시 확인하는 중...",
  "방금 팔면 얼마나 남는지 시세를 계산 중...",
  "리스크 신호와 단품 여부를 마지막으로 걸러내는 중...",
];

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function signedKrw(value: number) {
  const rounded = Math.round(value);
  const sign = rounded >= 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ko-KR")}원`;
}

function profitRange(min: number, max: number) {
  if (min === max) return signedKrw(max);
  return `${signedKrw(min)} ~ ${signedKrw(max)}`;
}

function expectedProfitAverage(card: RevealCard) {
  return Math.round((card.expectedProfitMin + card.expectedProfitMax) / 2);
}

function netProfitPercent(card: RevealCard) {
  if (!card.price || card.price <= 0) return null;
  const profit = expectedProfitAverage(card);
  const pct = Math.round((profit / card.price) * 100);
  return Number.isFinite(pct) ? pct : null;
}

function displayProfitRange(card: RevealCard) {
  return profitRange(card.expectedProfitMin, card.expectedProfitMax);
}

// Wave 359+362: "득템 점수" — 100점 만점. 차익 + 신뢰도 + 셀러 + 시세 표본 종합.
// 기본 50점. 차익률 ↑↑↑ 가장 강한 가중치. 미뇨이 자체 메트릭 (°C 당근 따라 X).
type DealScore = {
  score: number; // 0~100
  label: string;
  toneClass: string;
};

function calculateDealScore(card: RevealCard): DealScore {
  const profitPct = netProfitPercent(card) ?? 0;
  const confidence = card.confidence ?? 0;
  const sellerRating = card.savedDetail?.sellerReviewRating ?? null;
  const reviewCount = card.savedDetail?.sellerReviewCount ?? 0;
  const sampleCount = card.marketBasis?.sampleCount ?? 0;

  let score = 50;
  // 차익률: 5% → +7.5, 10% → +15, 30%+ → +40 (cap)
  if (profitPct > 0) score += Math.min(profitPct * 1.5, 40);
  // AI 신뢰도
  if (confidence >= 0.8) score += 8;
  else if (confidence >= 0.6) score += 4;
  // 셀러 신뢰
  if (sellerRating != null && sellerRating >= 4.8 && reviewCount >= 30) score += 6;
  else if (sellerRating != null && sellerRating >= 4.5) score += 2;
  // 시세 표본
  if (sampleCount >= 20) score += 4;
  else if (sampleCount >= 10) score += 2;

  score = Math.min(100, Math.max(0, Math.round(score)));

  // Wave 363: 빨강 (rose)은 "위험" 시그널. 점수 ↑ = 좋은 매물 = 초록 진해짐.
  let label = "보통";
  let toneClass = "text-zinc-500 dark:text-zinc-400";
  if (score >= 90) {
    label = "최고";
    toneClass = "text-emerald-700 dark:text-emerald-300";
  } else if (score >= 80) {
    label = "강추";
    toneClass = "text-emerald-600 dark:text-emerald-400";
  } else if (score >= 70) {
    label = "좋음";
    toneClass = "text-emerald-500 dark:text-emerald-400";
  }
  return { score, label, toneClass };
}

function krwRange(min: number, max: number) {
  if (Math.round(min) === Math.round(max)) return krw(max);
  return `${krw(min)} ~ ${krw(max)}`;
}

function finiteKrw(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

// Wave 392+393: "왜 이 가격?" — condition은 "비교 그룹"으로 사용 (band-aware).
// 진짜 "왜 싸지" 이유 = description 키워드 (급매/이사 등) 또는 셀러 시세 모름.
// "사용감 있어서 싸요" 같은 카피는 부정확 — 사용감 매물도 사용감끼리 비교한 시세 기준.
function getWhyCheapReasons(card: RevealCard): string[] {
  const reasons: string[] = [];
  const cond = card.marketBasis?.conditionClass ?? null;
  const desc = card.savedDetail?.descriptionPreview ?? "";
  const profitPct = netProfitPercent(card) ?? 0;

  // 상태 라벨 (카피 안 형용사 형식 — "X 매물 중에서도" 자연 어법)
  const condLabel =
    cond === "unopened" ? "미개봉" :
    cond === "mint" ? "S급" :
    cond === "clean" ? "A급" :
    cond === "worn" ? "사용감 있는" :
    cond === "flawed" ? "하자 있는" :
    cond === "low_batt" ? "배터리 약한" :
    cond === "normal" ? "비슷한 상태의" : null;

  // 1. Description 키워드 — 가장 명확한 셀러 의도
  if (/급매|급처|빨리/.test(desc)) {
    reasons.push(condLabel
      ? `${condLabel} 매물 중에서도 셀러가 급하게 팔고 싶어해요`
      : "셀러가 급하게 팔고 싶어해요");
  } else if (/이사|이전|학업|입대|군대|해외/.test(desc)) {
    reasons.push("이사·이전 등 정리하는 매물");
  } else if (/선물|받았|개봉만|쓸 일/.test(desc)) {
    reasons.push("선물받았지만 사용 안 함");
  }

  // 2. 차익률 큰데 (>=30%) → 셀러가 그 상태 시세 모름
  if (reasons.length === 0 && profitPct >= 30 && condLabel) {
    reasons.push(`${condLabel} 매물 중에서도 셀러가 낮게 등록한 듯`);
  }

  // Fallback — band-aware 비교 명시 (정직한 일반론)
  if (reasons.length === 0) {
    if (condLabel) {
      reasons.push(`${condLabel} 매물 중에서도 저렴하게 올라왔어요`);
    } else {
      reasons.push("비슷한 상태 매물 중에서도 저렴해요");
    }
  }

  return reasons.slice(0, 2);
}

// Wave 393.2: 위계 ↓ — 큰 amber panel → 작은 inline 한 줄. boilerplate 톤 어울리게.
function WhyCheapPanel({ card }: { card: RevealCard }) {
  const reasons = getWhyCheapReasons(card);
  if (reasons.length === 0) return null;
  return (
    <div className="mt-2 flex items-start gap-1.5 text-[11px] font-medium leading-5 text-zinc-500 dark:text-zinc-400">
      <span className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true">💡</span>
      <span className="min-w-0">{reasons.join(" · ")}</span>
    </div>
  );
}

// Wave 392.3: 진입장벽 / 불안감 해소 Q&A. 사용자가 모달 보면서 의문 들면 펼침.
// 셀러 / 가품 / 안전결제 / 사기 신고 4개 — 가장 자주 묻는 거.
function WhyTrustCollapse({ card }: { card: RevealCard }) {
  // Wave 394.6.c (외부 review #8): FAQ → 리스크 카드. 첫 Q (셀러 신뢰) default 펼침.
  // "이건 부가 정보가 아니라 구매 판단의 핵심임. FAQ로 숨기면 안 됨" — 외부 review.
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const sellerRating = card.savedDetail?.sellerReviewRating ?? null;
  const reviewCount = card.savedDetail?.sellerReviewCount ?? 0;
  const isPremiumSeller = sellerRating != null && sellerRating >= 4.8 && reviewCount >= 30;
  const cond = card.marketBasis?.conditionClass ?? null;
  const conditionLabel =
    cond === "unopened" ? "미개봉" :
    cond === "mint" ? "S급" :
    cond === "clean" ? "A급" :
    cond === "worn" ? "사용감 있음" :
    cond === "flawed" ? "하자 있음" :
    cond === "low_batt" ? "배터리 약함" : "일반";

  // Wave 394.6.d (외부 review 가품 답 카테고리별 분기 — Wave 393.8 CounterfeitChecklistPanel 연장):
  // "전자제품이 뭔 가품이냐" 사용자 짚음. 폰/태블릿/노트북 = 가품 거의 X (잠금/부품이 진짜 위험).
  // 신발/명품/에어팟 = 가품 위험 큼. WhyTrust 가품 Q 답을 카테고리별 분기 = 정확한 위험 신호.
  //
  // Wave A (2026-05-20): brand 감지되면 brand-specific 답으로 교체 (Nike Jordan / Adidas Yeezy 등).
  //   외부 review 직접 인용: "라벨/봉제/안감 3축 확인하세요'가 너무 일반적. Bird-aid 라벨,
  //   GORE-TEX 4면 박음질 같은 모델별 가품 체크포인트가 있어야 진짜 가치 있음."
  const category = categoryFromComparableKey(card.marketBasis?.comparableKey ?? null);
  const brandDepth = detectBrandDepth(category, {
    skuId: card.skuId ?? null,
    skuName: card.skuName ?? null,
    name: card.name ?? null,
  });
  const counterfeitAnswer = ((): React.ReactNode => {
    const condBold = <b className="font-bold">{conditionLabel}</b>;
    // Brand 감지된 경우 — brand-specific 답 우선 (shoe Wave A. 후속 wave 에서 다른 카테고리 확장).
    if (brandDepth) {
      const riskLabel = COUNTERFEIT_RISK_LABEL[brandDepth.brand.counterfeitRisk];
      const top2Checks = brandDepth.brand.counterfeitChecks.slice(0, 2);
      return (
        <>
          이 매물은 {condBold}로 분류돼요. <b className="font-bold">{brandDepth.brand.label}</b> — <b className="font-bold">{riskLabel}</b>.
          {top2Checks.length > 0 ? (
            <>
              {" "}변별 포인트: {top2Checks.map((c, i) => (
                <span key={i}>{i > 0 ? " · " : ""}{c}</span>
              ))}
            </>
          ) : null}
          {brandDepth.brand.authentication.length > 0 ? (
            <>
              {" "}인증: <b className="font-bold">{brandDepth.brand.authentication[0]}</b>.
            </>
          ) : null}
        </>
      );
    }
    switch (category) {
      case "shoe":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">신발 가품 위험 큼</b> (특히 명품/한정판).
          {" "}KREAM 검수 권장. 안창 / 박스 / 태그 / 시리얼 확인 필수.</>;
      case "earphone":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">차이팟(가품 에어팟) 흔함</b>.
          {" "}패키지 시리얼 / 케이스 정품 인증 / 무게(정품 50g) 확인.</>;
      case "bag":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">명품 가방 가품 위험 큼</b>.
          {" "}라벨 / 봉제선 / 안감 / 시리얼 확인. 정품 인증 서비스 (KREAM, 트렌비) 권장.</>;
      case "watch":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">명품 시계 가품 위험 매우 큼</b>.
          {" "}정품 보증서 필수 + 시리얼 매칭 + AS 가능 확인.</>;
      case "perfume":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">공병 / 가짜 향료 위험</b>.
          {" "}시리얼 + 박스 인쇄 품질 + 향 패턴 확인.</>;
      case "clothing":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">명품/스트릿웨어 가품 흔함</b> (Supreme/Stussy/BAPE 등).
          {" "}라벨 / 봉제 / 태그 / 시리얼 확인.</>;
      case "smartphone":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">iCloud/구글 잠금, IMEI 위변조, 부품 교체</b>. 통신사 등록 확인.</>;
      case "tablet":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">iCloud 잠금, 액정, 배터리 상태</b>. 모델 + IMEI 확인.</>;
      case "smartwatch":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">iCloud 잠금, 페어링, 배터리 사이클</b>.</>;
      case "laptop":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">iCloud (맥북), 부품 교체 (램/SSD), 액정, 키보드</b>.</>;
      case "drone":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">DJI 가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">활성화 (DJI 계정), 펌웨어, 배터리 사이클</b>.</>;
      case "camera":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">셔터 카운트, 렌즈 곰팡이, 센서 클리닝, AS 가능</b>.</>;
      default:
        return <>이 매물은 {condBold}로 분류돼요. 미뇨이는 의심 키워드 매물을 사전 차단하고 있어요.
          {" "}그래도 직거래 시 <b className="font-bold">시리얼 번호 / 정품 보증서</b> 확인 권장. 아래 체크리스트 펼쳐서 확인하세요.</>;
    }
  })();

  const qas: { q: string; a: React.ReactNode }[] = [
    {
      q: "셀러 믿을 만한가요?",
      a: sellerRating != null ? (
        <>
          이 셀러 평점은 <b className="font-bold">{sellerRating.toFixed(1)}점</b> ({reviewCount.toLocaleString("ko-KR")}건 후기).
          {isPremiumSeller
            ? " 우수 셀러로 분류돼요 (평점 4.8+ & 후기 30건+)."
            : reviewCount >= 10
              ? " 평점 적당해요. 안전결제로 거래하면 안전합니다."
              : " 후기 수가 적어요. 안전결제 + 직거래 검수 권장."}
        </>
      ) : (
        <>이 셀러는 아직 후기가 없어요. <b className="font-bold">안전결제 + 직거래 검수</b>를 꼭 권장해요. 또는 다른 매물 보세요.</>
      ),
    },
    {
      q: "가품 위험 없나요?",
      a: counterfeitAnswer,
    },
    {
      q: "안전결제 어떻게 되나요?",
      a: (
        <>
          번개장터는 <b className="font-bold">안전결제 셀러 의무</b>예요. 셀러가 3.5% 수수료 부담하고, 구매자는 0원.
          {" "}결제 후 셀러 정산은 거래 완료 확인 후 진행돼요. 입금 사기 X.
        </>
      ),
    },
    {
      q: "사기 당하면 어떻게 하나요?",
      a: (
        <>
          안전결제 매물이면 <b className="font-bold">번개장터 분쟁센터</b>에 신고하면 거래 정지 + 환불 절차 진행돼요.
          {" "}직거래 사기는 경찰서 사이버수사대 신고. 미뇨이는 거래 당사자 아니지만 위험 신호를 사전 알려드려요.
        </>
      ),
    },
  ];

  return (
    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="px-4 py-2.5">
        {/* Wave 394.6.c (외부 review #8): "궁금한 점" 고객센터 톤 → "구매 전 확인" 능동형. */}
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          <span aria-hidden="true">🛡</span>
          <span>구매 전 확인 — 자주 묻는 4가지</span>
        </div>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {qas.map((item, idx) => {
          const open = openIdx === idx;
          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : idx)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              >
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {item.q}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {open ? (
                <div className="px-4 pb-3 text-xs font-medium leading-6 text-zinc-600 dark:text-zinc-400">
                  {item.a}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function costAssuranceSnapshot(card: RevealCard) {
  const salePrice = finiteKrw(card.marketBasis?.medianPrice);
  const sellingFee = salePrice == null ? null : Math.round(salePrice * SELLING_FEE_RATE);
  const freeShipping = Boolean(card.savedDetail?.freeShipping);
  const inferredBuyCostMin = salePrice == null || sellingFee == null
    ? null
    : finiteKrw(salePrice - card.expectedProfitMax - sellingFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
  const inferredBuyCostMax = salePrice == null || sellingFee == null
    ? null
    : finiteKrw(salePrice - card.expectedProfitMin - sellingFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
  const buyCostLow = freeShipping
    ? card.price
    : inferredBuyCostMin == null
      ? null
      : Math.max(card.price, Math.min(inferredBuyCostMin, inferredBuyCostMax ?? inferredBuyCostMin));
  const buyCostHigh = freeShipping
    ? card.price
    : inferredBuyCostMax == null
      ? null
      : Math.max(buyCostLow ?? card.price, Math.max(inferredBuyCostMax, inferredBuyCostMin ?? inferredBuyCostMax));
  const shippingLow = buyCostLow == null ? null : Math.max(0, buyCostLow - card.price);
  const shippingHigh = buyCostHigh == null ? null : Math.max(shippingLow ?? 0, buyCostHigh - card.price);
  const shippingKnown = freeShipping || shippingLow != null;
  const buyerCostLabel = buyCostLow == null || buyCostHigh == null
    ? `${krw(card.price)} + 배송비 확인`
    : krwRange(buyCostLow, buyCostHigh);
  const shippingLabel = freeShipping
    ? "0원 · 무료배송 확인"
    : shippingLow == null || shippingHigh == null
      ? "확인 필요"
      : `${krwRange(shippingLow, shippingHigh)} 계산 반영`;
  const confidenceLabel = freeShipping
    ? "배송비 확인됨"
    : shippingKnown
      ? "배송비 계산 반영"
      : "비용 확인 필요";
  const confidenceClass = freeShipping
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
    : shippingKnown
      ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200";

  return {
    salePrice,
    sellingFee,
    buyerCostLabel,
    shippingLabel,
    confidenceLabel,
    confidenceClass,
  };
}

function marketSourceBadge(card: RevealCard) {
  const market = card.marketBasis;
  if (!market) return null;
  // Wave 246 (2026-05-19): medianPrice 가 0/null 이면 출처 배지 자체가 의미 없음.
  // 사용자 사례 (pid 406974440): "번개 S급 시세 0원" — 시세 0인데 S급 배지만 떠서 미스리딩.
  // 정책 (b): 0원 시 표시 안 함. 호출 측 가드와 중복이지만 defense-in-depth.
  if (!market.medianPrice || market.medianPrice <= 0) return null;
  if (market.priceSource === "reference") return { label: "다나와", tone: "reference" as const };
  if (market.conditionClass === "mint") return { label: "번개 S급", tone: "mint" as const };
  return null;
}

// Wave 2026-05-19 v2 (외부인 #7 권장 매입가 프레임):
// 헬퍼 본체는 src/lib/buy-price-guidance.ts (모달 + 카드 리스트 공유).

function freshLabel(seconds: number) {
  if (seconds < 60) return `${seconds}초 전 검증`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}분 전 검증`;
  return `${Math.round(seconds / 3600)}시간 전 검증`;
}

// 2026-05-20 P0-Upload: 셀러 등록 시점 라벨 (first_seen_at 기반).
//   "등록 N시간 전" — 사용자가 가장 궁금해하는 정보. freshLabel(검증)과 구분.
//   미뇨이 crawler 처음 발견 시점 = 실제 업로드 + 0~30분 lag (collect cadence 기준).
function uploadAgoLabel(firstSeenAtIso: string | null | undefined): string | null {
  if (!firstSeenAtIso) return null;
  const ms = Date.now() - new Date(firstSeenAtIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "방금 등록";
  if (seconds < 3600) return `${Math.round(seconds / 60)}분 전 등록`;
  if (seconds < 24 * 3600) return `${Math.round(seconds / 3600)}시간 전 등록`;
  return `${Math.round(seconds / 86400)}일 전 등록`;
}

// Wave 393.7: 신선도 chip + Pro link 제거 (사용자 짚음 — 모달엔 불필요).
// ConditionChip(friendly)만 노출. 신선도는 매입/시세 메타 라인의 freshLabel에 이미 있음.
// Wave 394.2 (외부 review #20): 사진 분석 부재 한계 명시 — "AI가 사진 봤겠지" 오해 차단.
// description (텍스트) 기반 판단이라는 한계 1줄. 사진 직접 확인 권장.
function LastVerifiedAtBadge({ card }: { card: RevealCard }) {
  const cond = card.marketBasis?.conditionClass ?? null;
  if (!cond) return null;
  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center gap-2">
        <ConditionChip conditionClass={cond} variant="friendly" />
      </div>
      <div className="mt-1 text-[10px] font-medium leading-tight text-zinc-400 dark:text-zinc-500">
        AI가 매물 설명(텍스트) 기준 판단 · 사진은 직접 확인 권장
      </div>
    </div>
  );
}

function velocityHoursLabel(value: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  if (value < 24) return `${Math.round(value * 10) / 10}시간`;
  return `${Math.round((value / 24) * 10) / 10}일`;
}

function marketSampleLabel(card: RevealCard) {
  const market = card.marketBasis;
  if (market?.sampleCount > 0) {
    return `표본 ${market.sampleCount.toLocaleString("ko-KR")}건`;
  }
  return "표본 부족";
}

function marketConditionLabel(card: RevealCard) {
  const market = card.marketBasis;
  if (market?.priceSource === "reference") return "미개봉/새상품";
  return market?.conditionLabel ?? "같은 상태";
}

function marketBasisPlainSentence(card: RevealCard) {
  const market = card.marketBasis;
  if (!market) return "모델과 상태 분류가 충분하지 않으면 추천 강도를 낮춰요.";
  if (market.priceSource === "reference") {
    return "미개봉/새상품은 다나와 새 가격을 기준으로 보고, 번개 미개봉 거래 추이는 따로 확인해요.";
  }
  const condition = market.conditionLabel ?? "같은 상태";
  return `${condition}로 분류된 매물끼리 먼저 비교해요. 새상품이나 더 깨끗한 상품 시세를 섞어 수익을 부풀리지 않아요.`;
}

function uniqueCompactList(values: Array<string | null | undefined>, limit: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const clean = value?.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function recommendationGoodSignals(card: RevealCard) {
  const detail = card.savedDetail;
  const market = card.marketBasis;
  const velocity = card.velocityBasis;
  const goodVerdicts = verdictsForCard(card).filter((v) => v.tone === "good").map((v) => v.label);
  return uniqueCompactList([
    detail?.sellerReviewRating != null && detail.sellerReviewRating >= 4.5
      ? `셀러 후기 ${detail.sellerReviewRating.toFixed(1)}`
      : null,
    velocity?.medianHoursToSold != null && velocity.medianHoursToSold > 0 && velocity.sold7dCount > 0
      ? `비슷한 상품 ${velocityHoursLabel(velocity.medianHoursToSold)} 안에 판매`
      : null,
    market?.priceSource === "reference" ? "다나와 새 가격 확인" : `${marketConditionLabel(card)} 시세로 비교`,
    detail?.freeShipping ? "무료배송" : null,
    ...goodVerdicts,
  ], 4);
}

function recommendationWatchSignals(card: RevealCard) {
  const market = card.marketBasis;
  return uniqueCompactList([
    market?.confidence === "low" ? "시세 표본은 아직 낮은 편" : null,
    market?.conditionClass === "worn" ? "사용감은 같은 등급 시세에 반영" : null,
  ], 3);
}

function recommendationFeatureCards(card: RevealCard): RecommendationFeatureCard[] {
  const detail = card.savedDetail;
  const market = card.marketBasis;
  const velocity = card.velocityBasis;
  const flow = card.skuListingFlow;
  const cards: RecommendationFeatureCard[] = [];

  const profitMin = Math.min(card.expectedProfitMin, card.expectedProfitMax);
  const profitMax = Math.max(card.expectedProfitMin, card.expectedProfitMax);
  if (profitMin > 0) {
    cards.push({
      icon: <WalletIcon className="h-4 w-4" />,
      title: "비용 차감 통과",
      body: `매입 ${krw(card.price)} 기준, 비용 차감 후 ${profitRange(profitMin, profitMax)} 남는 구간으로 봤어요.`,
      tone: "profit",
    });
  }

  if (market?.medianPrice && market.medianPrice > 0 && card.price > 0) {
    const discount = Math.round(((market.medianPrice - card.price) / market.medianPrice) * 100);
    if (discount >= 8) {
      cards.push({
        icon: <TargetIcon className="h-4 w-4" />,
        title: `시세보다 ${discount}% 낮음`,
        body: `${marketConditionLabel(card)} 기준 시세 ${krw(market.medianPrice)}와 비교했을 때 매입가가 낮아요.`,
        tone: "market",
      });
    }
  }

  if (velocity?.medianHoursToSold != null && velocity.medianHoursToSold > 0 && velocity.sold7dCount > 0) {
    cards.push({
      icon: <ScaleIcon className="h-4 w-4" />,
      title: `${velocityHoursLabel(velocity.medianHoursToSold)} 회전`,
      body: `최근 7일 비슷한 상품 판매 ${velocity.sold7dCount.toLocaleString("ko-KR")}건을 같이 봤어요.`,
      tone: "speed",
    });
  } else if (flow && flow.avgPerDay7d > 0) {
    const ratio = flow.count24h / flow.avgPerDay7d;
    if (ratio >= 1.3) {
      cards.push({
        icon: <ScaleIcon className="h-4 w-4" />,
        title: "오늘 유입 많음",
        body: `최근 24시간 ${flow.count24h}건, 7일 평균 ${flow.avgPerDay7d}건/일보다 매물이 활발해요.`,
        tone: "speed",
      });
    }
  }

  const goodVerdicts = verdictsForCard(card)
    .filter((v) => v.tone === "good")
    .map((v) => v.label)
    .filter((label) => !label.startsWith("시세보다") && !label.includes("회전") && !label.includes("시세 신뢰"));
  if (goodVerdicts.length > 0) {
    cards.push({
      icon: <ShieldIcon className="h-4 w-4" />,
      title: goodVerdicts.slice(0, 2).join(" · "),
      body: "매물 설명과 상태 신호에서 추가로 잡힌 장점이에요.",
      tone: "quality",
    });
  } else if (detail?.sellerReviewRating != null && detail.sellerReviewRating >= 4.5) {
    cards.push({
      icon: <ShieldIcon className="h-4 w-4" />,
      title: `셀러 후기 ${detail.sellerReviewRating.toFixed(1)}`,
      body: `후기 ${detail.sellerReviewCount.toLocaleString("ko-KR")}건의 판매자 신뢰도도 같이 봤어요.`,
      tone: "quality",
    });
  }

  if (cards.length === 0) {
    cards.push({
      icon: <TargetIcon className="h-4 w-4" />,
      title: market?.label ?? card.skuName,
      body: `${marketSampleLabel(card)}과 비용 차감 기준으로 추천 후보에 남겼어요.`,
      tone: "market",
    });
  }

  return cards.slice(0, 4);
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`rounded-full bg-zinc-200/80 dark:bg-zinc-800 ${className}`} />;
}

function RevealResultSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2" aria-hidden="true">
      <div className="grid gap-3 rounded-xl border border-[#e3ddd2] bg-[#fffdf9] p-3 shadow-lg shadow-[rgba(92,116,95,0.08)] dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(0,1fr)]">
        <div className="h-[118px] w-full rounded-lg bg-zinc-200/80 dark:bg-zinc-800 sm:h-[132px] sm:w-[132px] lg:h-[150px] lg:w-[150px]" />
        <div className="min-w-0 space-y-3">
          <SkeletonLine className="h-4 w-4/5" />
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <SkeletonLine className="h-3 w-20 bg-emerald-200/80 dark:bg-emerald-900/60" />
            <SkeletonLine className="mt-2 h-7 w-36 bg-emerald-200/80 dark:bg-emerald-900/60" />
            <SkeletonLine className="mt-2 h-3 w-52" />
          </div>
          <div className="hidden flex-wrap gap-1.5 sm:flex">
            <SkeletonLine className="h-5 w-16" />
            <SkeletonLine className="h-5 w-20" />
            <SkeletonLine className="h-5 w-14" />
          </div>
          <div className="hidden rounded-lg border border-[#e2d9cb] bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:block">
            <SkeletonLine className="h-3 w-24" />
            <SkeletonLine className="mt-2 h-4 w-4/5" />
            <SkeletonLine className="mt-2 h-3 w-2/3" />
          </div>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-[#e3ddd2] bg-[#fffdf9] p-3 shadow-lg shadow-[rgba(92,116,95,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
        <SkeletonLine className="h-3 w-36" />
        <div className="h-[190px] rounded-md bg-white p-3 dark:bg-zinc-900">
          <div className="flex h-full items-end gap-2">
            {[56, 82, 48, 68, 92, 74, 60].map((height, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-t bg-zinc-200/80 dark:bg-zinc-800"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[#d8e2d7] bg-[var(--brand-accent-soft)] px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/60">
          <SkeletonLine className="h-3 w-32 bg-emerald-200/80 dark:bg-emerald-900/60" />
          <SkeletonLine className="mt-2 h-7 w-48 bg-emerald-200/80 dark:bg-emerald-900/60" />
          <SkeletonLine className="mt-2 h-3 w-5/6" />
        </div>
      </div>
    </div>
  );
}

// 2026-05-15 (사용자 코멘트 pid 405627929 — "왜 신뢰 100%? 리뷰도 없는데?"):
// 신뢰도 점수가 어떤 근거로 나왔는지 사용자에게 보여줌. 클릭 시 펼침.
// 모델 정확도(파서 매칭) + 시세 표본 + 시세 신뢰 등급 + 회전 속도 + 위험 키워드.
function ConfidenceBreakdown({ card }: { card: RevealCard }) {
  const market = card.marketBasis;
  const velocity = card.velocityBasis;
  const sample = market?.sampleCount ?? 0;
  const sold = market?.soldSampleCount ?? 0;
  const marketConf = market?.confidence ?? null;
  const marketConfLabel =
    marketConf === "high" ? "높음" : marketConf === "medium" ? "보통" : marketConf === "low" ? "낮음" : "—";

  // Wave 134 (2026-05-16): condition별 시세 표본 분리 표시 — 사업 보고서 L2 retention 강화.
  // 같은 SKU+옵션 매물이라도 condition별 시세 spread 15~40% (Wave 130 측정).
  // 사용자가 "내 매물 condition은 N건 vs 다른 등급 N건" 답 받음 = 신뢰 시그널.
  const matchedConditionLabel = market?.conditionLabel ?? null;
  const otherConditions = market?.otherConditions ?? [];
  const sampleTone: "good" | "warn" | undefined = sample >= 8 ? "good" : sample > 0 ? undefined : "warn";
  // 내 매물 condition 표본 — Wave 130 marketBasis는 매칭된 condition row의 표본 수 (fallback chain 후)
  const matchedSampleText = sample > 0
    ? matchedConditionLabel
      ? `내 등급(${matchedConditionLabel}) ${sample}건 (판매 ${sold})`
      : `${sample}건 (판매 ${sold}건)`
    : "표본 부족";

  // Wave 2026-05-19 v3 (사용자 피드백 — 단어 일반인 친화):
  // "모델 매칭/시세 표본/시세 신뢰/판매 속도" → "모델 인식/비슷한 매물/비교 데이터/팔리는 속도"
  const lines: { label: string; value: string; tone?: "good" | "warn"; hint?: string }[] = [
    {
      label: "모델 인식",
      value: market?.label ? `${market.label}` : "분류 흐림",
      tone: market?.label ? "good" : "warn",
      hint: "AI가 매물 제목/설명에서 모델/옵션/상태를 알아본 결과예요. 분류 흐림이면 시세 비교가 부정확할 수 있어요.",
    },
    {
      label: "비슷한 매물",
      value: matchedSampleText,
      tone: sampleTone,
      hint: "같은 모델·같은 상태 매물이 몇 건 있는지. 8건+ 면 비교 신뢰 충분, 그 미만이면 참고용으로만.",
    },
    {
      label: "비교 데이터",
      value: marketConfLabel === "높음" ? "충분" : marketConfLabel === "보통" ? "보통" : marketConfLabel === "낮음" ? "부족" : marketConfLabel,
      tone: marketConf === "high" ? "good" : marketConf === "low" ? "warn" : undefined,
      hint: "비슷한 매물 수 + 거래 완료 건수 + 분류 정확도를 합쳐서 본 점수.",
    },
  ];

  // 2026-05-19 P0-4: sold7dCount>0 가드 추가. 다른 velocity 표시 지점들(saleSpeedDisplay 등)과
  // 일관성. 7일 표본 0건이면 historical median만으로 "약 N일" 출력 X (통계적 오해 방지).
  if (
    velocity?.medianHoursToSold != null &&
    velocity.medianHoursToSold > 0 &&
    (velocity.sold7dCount ?? 0) > 0
  ) {
    const days = Math.round(velocity.medianHoursToSold / 24);
    lines.push({
      label: "팔리는 속도",
      value: days <= 0 ? "1일 이내" : `약 ${days}일`,
      tone: days <= 3 ? "good" : days >= 14 ? "warn" : undefined,
      hint: "비슷한 매물이 평균 며칠 만에 거래되는지. 내가 사서 다시 팔 때 걸리는 시간 추정.",
    });
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-md bg-white p-2 text-left text-[11px] leading-4 dark:bg-zinc-900">
      <div className="text-[10px] font-bold text-zinc-400">왜 이 점수가 나왔나</div>
      {lines.map((line) => (
        <div
          key={line.label}
          className={`flex items-center justify-between gap-2 ${line.hint ? "cursor-help" : ""}`}
          title={line.hint}
        >
          <span className="text-zinc-500 dark:text-zinc-400">
            {line.label}
            {line.hint ? <span className="ml-0.5 text-[8px] font-bold text-zinc-300 dark:text-zinc-600">ⓘ</span> : null}
          </span>
          <span
            className={`font-bold tabular-nums ${
              line.tone === "good"
                ? "text-emerald-700 dark:text-emerald-300"
                : line.tone === "warn"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-zinc-700 dark:text-zinc-200"
            }`}
          >
            {line.value}
          </span>
        </div>
      ))}
      {/* Wave 134 (2026-05-16): condition별 표본 분리 — 사용자에게 "다른 등급은 표본 얼마인지" 가시화.
          marketBasis.otherConditions는 Wave 130에서 이미 채워짐. sample ≥ 3 만 표시 (fetchLatestMarketStats 정책). */}
      {otherConditions.length > 0 && (
        <div className="mt-1 border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
          <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            다른 등급 표본
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {otherConditions.slice(0, 4).map((oc) => (
              <span key={oc.conditionClass} className="text-[10px] text-zinc-500 dark:text-zinc-400">
                <span className="font-bold text-zinc-600 dark:text-zinc-300">{oc.label}</span>{" "}
                <span className="tabular-nums">{oc.sampleCount}건</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="pt-1 text-[10px] leading-[1.4] text-zinc-400">
        비슷한 매물이 많고 같은 모델끼리 정확히 비교됐을 때 점수가 올라가요. 비슷한 매물 부족 / 분류 흐림 / 새상품 섞임이 많으면 점수 내려가요.
      </div>
    </div>
  );
}

function MarketBasisMini({ card }: { card: RevealCard }) {
  // Wave 129 (2026-05-16): source breakdown 표시 — 사업 보고서 L3 (multi-source ground truth).
  //   보고서: "시세 자체보다 시세의 출처를 보여주는 게 retention factor".
  // Wave 130 (2026-05-16): condition별 시세 분리 — 사업 보고서 L2 (끼리 비교 retention).
  //   같은 SKU+옵션이라도 condition별 시세 spread 15~40%. 매물 condition에 맞는 시세 우선 표시.
  //   otherConditions로 비교 가능 ("내 매물(worn) vs mint 시세" 등).
  const market = card.marketBasis;
  const [expanded, setExpanded] = useState(false);
  if (!market) return null;
  const confidence = market.confidence ?? "low";
  const confidenceLabel = confidence === "high" ? "높음" : confidence === "medium" ? "보통" : "낮음";
  const confidenceClass = confidence === "high"
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
    : confidence === "medium"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
  const hasCondition = market.conditionClass && market.conditionClass !== "all";
  const sourceLabel = market.priceSource === "reference"
    ? "다나와 새 가격 기준"
    : market.conditionClass === "mint"
      ? "번개 S급 매물 기준"
      : `번개 ${market.conditionLabel ?? "같은 상태"} 매물 기준`;
  const compactSourceLabel = market.priceSource === "reference"
    ? "다나와"
    : `번개 ${market.conditionLabel ?? "같은 상태"}`;
  return (
    <div className="rounded-lg border border-[#e2d9cb] bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
        <span className="font-black text-zinc-700 dark:text-zinc-200">시세 근거</span>
        {hasCondition && market.conditionLabel ? (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {market.conditionLabel}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-1.5 py-0.5 dark:bg-zinc-800">
          {market.priceSource === "reference" ? (
            <DanawaLogo className="h-3.5 w-3.5 rounded-[3px]" />
          ) : (
            <BunjangLogo className="h-3.5 w-3.5 rounded-[3px]" />
          )}
          {compactSourceLabel}
        </span>
        <span
          className="rounded-full bg-zinc-50 px-1.5 py-0.5 tabular-nums dark:bg-zinc-800"
          title={`판매중 ${market.activeSampleCount.toLocaleString("ko-KR")}건 + 거래완료 ${market.soldSampleCount.toLocaleString("ko-KR")}건`}
        >
          비슷한 매물 {market.sampleCount.toLocaleString("ko-KR")}건
        </span>
        {/* Wave 2026-05-19 v3 (사용자 피드백 — 단어 일반인 친화): "신뢰" 칩 → "비교 데이터" */}
        <span
          className={`cursor-help rounded-full px-1.5 py-0.5 ${confidenceClass}`}
          title="비슷한 매물 데이터가 얼마나 충분한지 — 충분 = 비교 매물 8건+. 보통 = 비교 매물 적당. 부족 = 비교 매물 적거나 분류 흐림."
        >
          비교 데이터 {confidenceLabel === "높음" ? "충분" : confidenceLabel === "보통" ? "보통" : "부족"}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="ml-auto rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-black text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {expanded ? "접기" : "자세히"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px]">
            <span className="font-black text-zinc-800 dark:text-zinc-100">
              {market.label ?? card.skuName}
            </span>
            {market.fallbackUsed && (
              <span className="text-[9px] font-bold uppercase text-zinc-400 dark:text-zinc-500">
                (가까운 상태 기준)
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1 font-bold text-zinc-600 dark:text-zinc-300">
              {market.priceSource === "reference" ? (
                <DanawaLogo className="h-4 w-4 rounded-[4px]" />
              ) : (
                <BunjangLogo className="h-4 w-4 rounded-[4px]" />
              )}
              {sourceLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-bold tabular-nums dark:bg-zinc-800">
              거래완료 {market.soldSampleCount.toLocaleString("ko-KR")}건
            </span>
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-bold tabular-nums dark:bg-zinc-800">
              판매중 {market.activeSampleCount.toLocaleString("ko-KR")}건
            </span>
            {market.disappearedSampleCount > 0 && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-bold tabular-nums dark:bg-zinc-800">
                만료 {market.disappearedSampleCount.toLocaleString("ko-KR")}건
              </span>
            )}
          </div>
          {/* Wave 130: 다른 condition 시세 비교 — "내 매물(worn) 시세 vs 다른 등급" — 사업 보고서 L2 끼리 비교. */}
          {market.otherConditions && market.otherConditions.length > 0 && (
            <>
              <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                동일 모델 다른 등급 시세
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
                {market.otherConditions.slice(0, 4).map((oc) => (
                  <span
                    key={oc.conditionClass}
                    className="rounded-md bg-zinc-50 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400"
                  >
                    <span className="font-bold">{oc.label}</span>
                    <span className="ml-1 tabular-nums">{oc.medianPrice ? krw(oc.medianPrice) : "-"}</span>
                    <span className="ml-1 text-zinc-400 dark:text-zinc-500">({oc.sampleCount}건)</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// 2026-05-17: 공통 utility (src/lib/listing-verdicts.ts) 호출로 변경.
// chip 라벨 결정 로직 단일 source — 3 화면 통일 (drift 차단).
// 새 chip 4종 추가: 시세보다 -N%, 수요 매우높음/높음/보통, 방금 등록, 시세 sample N건.
// max 4 → 6 으로 확장.
import { buildVerdicts, type Verdict, VERDICT_TONE_CLASS } from "@/lib/listing-verdicts";

function verdictsForCard(card: RevealCard): Verdict[] {
  const detail = card.savedDetail;
  const velocity = card.velocityBasis;
  const flow = card.skuListingFlow;
  const market = card.marketBasis;
  return buildVerdicts({
    price: card.price,
    skuMedian: market?.medianPrice ?? null,
    expectedProfitMin: card.expectedProfitMin,
    expectedProfitMax: card.expectedProfitMax,
    confidence: card.confidence,
    marketSampleCount: market?.sampleCount ?? null,
    marketConfidenceLabel: (market?.confidence as "high" | "medium" | "low" | null) ?? null,
    medianHoursToSold: velocity?.medianHoursToSold ?? null,
    soldSampleCount: market?.soldSampleCount ?? null,
    flowCount24h: flow?.count24h ?? null,
    flowAvgPerDay7d: flow?.avgPerDay7d ?? null,
    sellerReviewRating: detail?.sellerReviewRating ?? null,
    sellerReviewCount: detail?.sellerReviewCount ?? null,
    freeShipping: detail?.freeShipping ?? null,
    favoriteCount: detail?.favoriteCount ?? null,
    lastSeenAt: null, // RevealCard 에 직접 안 박힘 (별도 fetch 필요 — 보류)
    descriptionPreview: detail?.descriptionPreview ?? null,
  });
}

function VerdictBadgesMini({ card }: { card: RevealCard }) {
  const verdicts = verdictsForCard(card);
  if (verdicts.length === 0) return null;
  const hiddenMobileCount = Math.max(0, verdicts.length - 3);
  return (
    <div className="flex flex-wrap gap-1">
      {verdicts.map((v, index) => (
        <span
          key={v.label}
          className={`${index >= 3 ? "hidden sm:inline-flex" : "inline-flex"} rounded-full border px-2 py-0.5 text-[10px] font-black ${VERDICT_TONE_CLASS[v.tone]}`}
        >
          {v.label}
        </span>
      ))}
      {hiddenMobileCount > 0 ? (
        <span
          className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-black text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 sm:hidden"
          title={`화면에 숨긴 추가 신호 ${hiddenMobileCount}개가 더 있어요`}
        >
          추가 신호 {hiddenMobileCount}개
        </span>
      ) : null}
    </div>
  );
}

function RevealRiskScoreMini({
  card,
  containerClassName,
  triggerClassName,
  triggerLabel,
  triggerContent,
  hideChevron,
  portalDetail,
}: {
  card: RevealCard;
  containerClassName?: string;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerContent?: ReactNode;
  hideChevron?: boolean;
  portalDetail?: boolean;
}) {
  const riskInput = revealRiskScoreInput(card);
  return (
    <RiskScoreBar
      {...riskInput}
      showDetail
      compact
      containerClassName={containerClassName}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel}
      triggerContent={triggerContent}
      hideChevron={hideChevron}
      portalDetail={portalDetail}
    />
  );
}

function revealRiskScoreInput(card: RevealCard): RiskScoreInput {
  return {
    descriptionPreview: card.savedDetail?.descriptionPreview ?? null,
    conditionClass: card.marketBasis?.conditionClass ?? null,
    price: card.price,
    skuMedian: card.marketBasis?.medianPrice ?? null,
    confidence: card.confidence,
    sellerReviewRating: card.savedDetail?.sellerReviewRating ?? null,
    sellerReviewCount: card.savedDetail?.sellerReviewCount ?? null,
  };
}

// Wave 333: fixedSafetyCtaClass 제거 — FixedBunjangFooter에서 안전도 버튼 빠지면서 미사용.

// Wave 359+361: 득템 점수 — 당근 Manner Meter 영감 (작고 우측).
// state는 부모 (RevealCardItem)가 관리 → button + evidence 분리.
function DealMeterButton({
  card,
  expanded,
  onToggle,
}: {
  card: RevealCard;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { score, toneClass } = calculateDealScore(card);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-expanded={expanded}
      className="group flex shrink-0 flex-col items-end whitespace-nowrap leading-tight"
    >
      <span className="flex items-baseline gap-0.5">
        <span className={`text-lg font-bold tabular-nums ${toneClass}`}>
          {score}
        </span>
        <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">/100</span>
      </span>
      <span className="mt-0.5 text-[10px] font-medium text-zinc-500 underline underline-offset-2 transition group-hover:text-zinc-800 dark:text-zinc-400 dark:group-hover:text-zinc-100">
        득템 점수
      </span>
    </button>
  );
}

function DealEvidencePanel({ card }: { card: RevealCard }) {
  const profitPct = netProfitPercent(card);
  const profitAvg = expectedProfitAverage(card);
  const sampleCount = card.marketBasis?.sampleCount ?? 0;
  const sellerRating = card.savedDetail?.sellerReviewRating ?? null;
  const reviewCount = card.savedDetail?.sellerReviewCount ?? 0;
  const confidencePct = Math.round((card.confidence ?? 0) * 100);
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-[#e1dacd] bg-[#fbf6ee] px-3 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">1</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-zinc-900 dark:text-zinc-100">
            예상 차익 {signedKrw(profitAvg)}{profitPct != null ? ` (+${profitPct}%)` : ""}
          </div>
          <div className="mt-0.5 text-zinc-500 dark:text-zinc-400">
            매입가 {krw(card.price)}
            {card.marketBasis?.medianPrice && card.marketBasis.medianPrice > 0
              ? ` · 시세 ${krw(card.marketBasis.medianPrice)}`
              : " · 시세 표본 부족"}
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[9px] font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">2</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-zinc-900 dark:text-zinc-100">AI 분석 신뢰도 {confidencePct}%</div>
          <div className="mt-0.5 text-zinc-500 dark:text-zinc-400">
            {sampleCount > 0 ? `같은 매물 ${sampleCount}건 비교 분석` : "표본 부족 — 추정치"}
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">3</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-zinc-900 dark:text-zinc-100">
            {sellerRating != null
              ? `셀러 평점 ${sellerRating.toFixed(1)}점 · 후기 ${reviewCount.toLocaleString("ko-KR")}건`
              : "셀러 후기 없음"}
          </div>
          <div className="mt-0.5 text-zinc-500 dark:text-zinc-400">
            {sellerRating != null && sellerRating >= 4.8 && reviewCount >= 30
              ? "우수 셀러 — 거래 신뢰도 ↑"
              : sellerRating != null && sellerRating >= 4.5
              ? "평점 양호"
              : "안전결제 + 직거래 검수 권장"}
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[9px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">4</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-zinc-900 dark:text-zinc-100">번개장터 안전결제 — 셀러 의무 부담 (3.5%)</div>
          <div className="mt-0.5 text-zinc-500 dark:text-zinc-400">구매자(나)는 0원 — 결제 안 들어가도 셀러가 부담</div>
        </div>
      </div>
    </div>
  );
}

function RevealProductImage({ card }: { card: RevealCard }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const largePreview = previewOpen && card.thumbnailUrl ? (
    <>
      <div
        className="fixed inset-0 z-[220] bg-zinc-950/86 backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
          setPreviewOpen(false);
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="상품 사진 크게 보기"
        className="fixed inset-0 z-[230] flex items-center justify-center p-3"
        onClick={(e) => {
          e.stopPropagation();
          setPreviewOpen(false);
        }}
      >
        <div className="relative h-full max-h-[88dvh] w-full max-w-3xl">
          <Image
            src={card.thumbnailUrl}
            alt={card.name}
            fill
            sizes="100vw"
            className="object-contain object-center"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewOpen(false);
          }}
          className="fixed right-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-black text-zinc-900 shadow-lg transition hover:bg-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
        >
          닫기
        </button>
      </div>
    </>
  ) : null;

  return (
    <div className="relative left-1/2 h-[290px] w-screen -translate-x-1/2 overflow-hidden rounded-none bg-[#eee7da] dark:bg-zinc-800 sm:left-auto sm:mx-0 sm:h-[240px] sm:w-[240px] sm:translate-x-0 sm:rounded-lg lg:h-[280px] lg:w-[280px]">
      {/* Wave 393.3: ConditionPhotoBadge 모달에선 nav (좌상 ← 🏠 floating)에 가려서 제거.
          텍스트 영역 LastVerifiedAtBadge 옆에 ConditionChip으로 대체 노출. */}
      {card.thumbnailUrl ? (
        <>
          <Image
            src={card.thumbnailUrl}
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 240px, 280px"
            className="scale-[1.08] object-cover object-center opacity-55 blur-sm"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,249,0.22),rgba(238,231,218,0.30))] dark:bg-none dark:bg-zinc-950/20" />
          <div className="absolute inset-0 p-0 sm:p-2">
            <div className="relative h-full w-full">
              <Image
                src={card.thumbnailUrl}
                alt={card.name}
                fill
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 240px, 280px"
                className="scale-[1.08] rounded-none object-contain object-center drop-shadow-[0_10px_18px_rgba(34,49,39,0.18)] sm:scale-100 sm:rounded-md"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
            className="absolute bottom-2 right-2 z-10 rounded-full bg-zinc-950/72 px-3 py-1.5 text-xs font-black text-white shadow-lg backdrop-blur transition hover:bg-zinc-950/86"
          >
            크게 보기
          </button>
          {typeof document !== "undefined" ? createPortal(largePreview, document.body) : largePreview}
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-xs font-semibold text-zinc-400">
          이미지 없음
        </div>
      )}
    </div>
  );
}

function SkuListingFlowMini({ card }: { card: RevealCard }) {
  const flow = card.skuListingFlow;
  if (!flow) return null;
  // 24h count 대비 7d 평균 색상 강조 (오늘 많이 올라옴 = emerald, 평소 같음 = neutral, 적음 = amber)
  const ratio = flow.avgPerDay7d > 0 ? flow.count24h / flow.avgPerDay7d : 1;
  const trendTone =
    ratio >= 1.3
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
      : ratio <= 0.6
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200";
  const trendLabel = ratio >= 1.3 ? "오늘 많음" : ratio <= 0.6 ? "오늘 적음" : "평소 수준";
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-1.5 text-[11px] leading-4 ${trendTone}`}>
      <span className="font-black">매물 유입량</span>
      <span className="tabular-nums">24h <b>{flow.count24h}</b>건</span>
      <span>·</span>
      <span className="tabular-nums">7일 평균 {flow.avgPerDay7d}건/일</span>
      <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold dark:bg-zinc-900/50">
        {trendLabel}
      </span>
    </div>
  );
}

function saleSpeedDisplay(card: RevealCard) {
  const velocity = card.velocityBasis;
  const hasRealTurnEstimate =
    velocity?.medianHoursToSold != null &&
    Number.isFinite(velocity.medianHoursToSold) &&
    velocity.medianHoursToSold > 0 &&
    velocity.sold7dCount > 0;
  // 2026-05-19 P0: 운영 게이트 OFF에선 hours=null → "수집 중" 표시. 개발 게이트 ON에선 48h 폴백 유지.
  const hours = hasRealTurnEstimate
    ? velocity.medianHoursToSold
    : (VELOCITY_UI_TEST_ENABLED ? UI_TEST_FALLBACK_VELOCITY_HOURS : null);
  return {
    hours,
    label: hours == null ? "수집 중" : velocityHoursLabel(hours),
    isFallback: !hasRealTurnEstimate,
    isFast: hours != null && hours > 0 && hours <= 48,
    isSlow: hours != null && hours > 168,
    confidenceLabel: !hasRealTurnEstimate
      ? (VELOCITY_UI_TEST_ENABLED ? "UI 테스트" : "데이터 수집 중")
      : velocity?.confidence === "high"
        ? "신뢰 높음"
        : velocity?.confidence === "medium"
          ? "신뢰 보통"
          : "참고용",
    sold7dCount: velocity?.sold7dCount ?? 0,
  };
}

type UpperFoldTileTone = "good" | "info" | "warn" | RiskTone;

function marketEvidenceSummary(card: RevealCard) {
  const market = card.marketBasis;
  if (!market) return "시세 기준 확인중";
  const sample = market.sampleCount ?? 0;
  const source = market.priceSource === "reference" ? "다나와" : "번개";
  const condition = marketConditionLabel(card);
  if (sample > 0) return `${condition} · ${source} ${sample.toLocaleString("ko-KR")}건`;
  return `${condition} · ${source} 기준`;
}

// Wave 324 (사용자 피드백 + 외부 감사/외부인 #5): 일반인에게 raw 매물 건수는 의미 없음.
// 핵심은 "수요·공급 균형이 어떤가" — 공급(매물 등록)만 보지 말고 수요(거래완료) 같이 본 평가가 헤드라인.
// raw 숫자는 sub로 강등.
function marketActivityDisplay(card: RevealCard) {
  const flow = card.skuListingFlow;
  const market = card.marketBasis;
  const velocity = card.velocityBasis;
  const supply24h = flow?.count24h ?? 0;
  const supplyAvg = flow?.avgPerDay7d ?? 0;
  const soldRecent = velocity?.sold7dCount ?? market?.soldSampleCount ?? 0;
  const active = market?.activeSampleCount ?? 0;

  // 공급 평가
  const supplyRatio = supplyAvg > 0 ? supply24h / supplyAvg : null;
  const supplyLevel: "high" | "normal" | "low" | null = supplyRatio == null
    ? null
    : supplyRatio >= 1.25 ? "high" : supplyRatio <= 0.55 ? "low" : "normal";

  // 수요 평가 — 거래 데이터 있으면 활발도. 판매중 대비 거래완료 비율로.
  // soldRecent = 7일 판매 수, active = 현재 매물 수. ratio 높으면 수요 활발.
  // 2026-05-20 P0-Demand-B: sample-floor 게이트. N=1,2 표본으로 "수요 활발/약함" 단정 위험.
  //   active+sold 합 < 5 면 demand 단정 X (null로 떨어뜨려서 sub에 표본 표시).
  //   velocity P0-1 정직성 원칙 (낮은 신뢰도 데이터는 "수집 중" 표기) 동일 적용.
  const demandSampleSize = active + soldRecent;
  const demandSampleSufficient = demandSampleSize >= 5;
  const demandRatio = active > 0 && soldRecent > 0 && demandSampleSufficient
    ? soldRecent / active
    : null;
  const demandLevel: "active" | "ok" | "weak" | null = demandRatio == null
    ? null
    : demandRatio >= 0.5 ? "active" : demandRatio >= 0.2 ? "ok" : "weak";

  // 복합 평가 — 수요가 우선, 공급은 secondary
  let value: string;
  let tone: "good" | "info" | "warn";

  if (demandLevel == null && supplyLevel == null) {
    value = "데이터 부족";
    tone = "warn";
  } else if (demandLevel === "active") {
    value = supplyLevel === "low" ? "수요 활발 · 공급 부족" : "수요 활발";
    tone = "good";
  } else if (demandLevel === "weak") {
    value = "수요 약함";
    tone = "warn";
  } else if (demandLevel === "ok") {
    value = supplyLevel === "high" ? "수요 보통 · 공급 많음" : "수요 보통";
    tone = "info";
  } else if (supplyLevel === "high") {
    value = "공급 많음 · 거래 데이터 부족";
    tone = "info";
  } else if (supplyLevel === "low") {
    value = "매물 적음";
    tone = "info";
  } else {
    value = "평소 수준";
    tone = "info";
  }

  // sub — raw 숫자 디테일
  const subParts: string[] = [];
  if (supply24h > 0) subParts.push(`오늘 매물 ${supply24h}건`);
  if (supplyAvg > 0) subParts.push(`평균 ${supplyAvg}건/일`);
  if (soldRecent > 0) subParts.push(`최근 거래 ${soldRecent}건`);
  // 2026-05-20 P0-Demand-B: 표본 부족(<5)이면 명시. 사용자가 "왜 데이터 부족인지" 즉시 인지.
  if (demandSampleSize > 0 && !demandSampleSufficient) {
    subParts.push(`표본 ${demandSampleSize}건 — 누적 중`);
  }
  const sub = subParts.length > 0 ? subParts.join(" · ") : marketEvidenceSummary(card);

  return {
    label: "수요 · 공급",
    value,
    sub,
    tone,
  };
}

// Wave 2026-05-19 v3 (사용자 피드백): "현재성" 타일 자체 제거 — 매입/시세 줄에 검증 시점 이미 있음.
// verificationDisplay 함수도 제거됨.

function safetyDisplay(card: RevealCard, risk: ReturnType<typeof buildRiskScore>) {
  const rating = card.savedDetail?.sellerReviewRating ?? null;
  const reviewCount = card.savedDetail?.sellerReviewCount ?? 0;
  const reviewCountLabel = reviewCount.toLocaleString("ko-KR");
  const reviewBadge =
    reviewCount >= 100
      ? { label: `후기 ${reviewCountLabel}+`, className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200" }
      : reviewCount >= 30
        ? { label: `후기 ${reviewCountLabel}`, className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200" }
        : reviewCount >= 10
          ? { label: `후기 ${reviewCountLabel}`, className: "border-[#d6e2d3] bg-white/75 text-[#4d6654] dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300" }
          : reviewCount > 0
            ? { label: "후기 적음", className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" }
            : null;
  // Wave 393.6: "후기 수 확인" 같은 라벨 X — 실제 후기 건수 적기.
  if (rating != null && rating >= 4.8 && reviewCount >= 10) {
    return {
      value: `평점 ${rating.toFixed(1)} 셀러`,
      sub: `후기 ${reviewCountLabel}건${reviewCount >= 30 ? " (충분)" : ""}`,
      Icon: TrophyIcon,
      badge: reviewBadge,
      tone: "good" as const,
    };
  }
  return {
    value: risk.label,
    sub: reviewCount > 0 && rating != null
      ? `평점 ${rating.toFixed(1)} · 후기 ${reviewCountLabel}건`
      : risk.tone === "safe" ? "차단 필터 통과" : "확인 포인트 있음",
    Icon: ShieldIcon,
    badge: reviewBadge,
    tone: risk.tone,
  };
}

function upperFoldTileClass(tone: UpperFoldTileTone) {
  if (tone === "safe" || tone === "good") {
    return {
      card: "border-emerald-200/80 bg-white/80 dark:border-emerald-900/45 dark:bg-zinc-900/55",
      dot: "bg-emerald-500",
      value: "text-emerald-700 dark:text-emerald-300",
    };
  }
  if (tone === "caution" || tone === "info" || tone === "warn") {
    return {
      card: "border-amber-200/80 bg-white/80 dark:border-amber-900/45 dark:bg-zinc-900/55",
      dot: "bg-amber-400",
      value: "text-amber-700 dark:text-amber-300",
    };
  }
  return {
    card: "border-rose-200/80 bg-white/80 dark:border-rose-900/45 dark:bg-zinc-900/55",
    dot: "bg-rose-500",
    value: "text-rose-700 dark:text-rose-300",
  };
}

// Wave 334: 타일 평가별 아이콘 매핑 — JSX element 직접 반환 (react-hooks 호환).
function renderActivityIcon(value: string, className: string) {
  if (value.includes("활발")) return <FlameIcon className={className} />;
  if (value.includes("약함")) return <TrendingDownIcon className={className} />;
  if (value.includes("매물 적음")) return <PackageIcon className={className} />;
  if (value.includes("공급 많음")) return <TrendingUpIcon className={className} />;
  return <ActivityIcon className={className} />;
}

function renderSpeedIcon(speed: ReturnType<typeof saleSpeedDisplay>, className: string) {
  if (speed.isFast) return <ZapIcon className={className} />;
  if (speed.isSlow) return <HourglassIcon className={className} />;
  return <ClockIcon className={className} />;
}

function renderSafetyIcon(tone: "good" | RiskTone, value: string, className: string) {
  if (value.includes("우수") || (tone === "good" && value.includes("⭐"))) return <TrophyIcon className={className} />;
  if (tone === "safe" || tone === "good") return <ShieldIcon className={className} />;
  return <AlertTriangleIcon className={className} />;
}

// Wave 394.4 (외부 review #3 + 사용자 본인 강조): "어떤 매물 비교했나" — 시세 근거 매물 직접 노출.
// "/me 운영자풀처럼 시세근거 sample 직접 볼수있으면 진짜 좋을듯" — 사용자 인용.
// USP 정면 = band-aware (같은 모델 / 같은 상태 매물끼리 비교). 시세 그래프 옆에 sample 매물 보여줘
// "이 시세는 어떻게 산출됐나" 투명성 + 신뢰도 boost.
//
// Wave 394.4.b 수정 (사용자 짚음 — 첫 fetch endpoint 실패):
// 신규 /api/market/comparable-listings 만들었는데 mvp_listings 에 comparable_key 컬럼 없어 fetch 실패.
// 사용자 reference: "/me운영자풀에 시세 근거보기 눌렀을때 나오는 sample끼리 비교 매물 그거 참고"
// → 이미 /api/listings/[pid]/market-source 가 정확히 그 endpoint. 재사용.
// market-source 의 풍부한 데이터 (saleStatus + listingState + 위험 매물 제외 + condition 정확 매칭) 활용.
type ComparableListing = {
  pid: number;
  name: string;
  price: number;
  thumbnailUrl: string | null;
  saleStatus: string | null;
  listingState: string | null;
  lastSeenAt: string | null;
  sourceQuery: string | null;
  bunjangUrl: string;
};

function ComparableListingsPanel({ card, mode = "simple" }: { card: RevealCard; mode?: "simple" | "detailed" }) {
  const [listings, setListings] = useState<ComparableListing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ck = card.marketBasis?.comparableKey ?? null;
  const cc = card.marketBasis?.conditionClass ?? null;
  // Wave 394.5.b: detailed 모드 시 더 많이 (6 → 12).
  const limit = mode === "detailed" ? 12 : 6;

  useEffect(() => {
    if (!ck) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Wave 394.4.b: /api/listings/[pid]/market-source 호출 — admin 풀에서 사용하는 동일한 endpoint.
    // condition_class + comparable_key 정확 매칭, COMPARABLE_EXCLUDE_NOTES 적용 (위험 매물 제외).
    fetch(`/api/listings/${card.pid}/market-source`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { comparables?: ComparableListing[] }) => {
        if (!cancelled) {
          // disappeared 매물 제외, 가격 낮은 순 정렬 (사용자 짚음), max 16 보관 (mode 따라 render slice).
          // simple = 6, detailed = 12 표시. fetch 한 번에 16 까지 보관해서 mode 변경 시 re-fetch X.
          const filtered = (j.comparables ?? [])
            .filter((c) => c.listingState !== "disappeared")
            .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
            .slice(0, 16);
          setListings(filtered);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "fetch failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ck, card.pid]);

  if (!ck) return null;

  const ccLabel =
    cc === "unopened" ? "미개봉"
    : cc === "mint" ? "S급"
    : cc === "clean" ? "A급"
    : cc === "worn" ? "사용감 있는"
    : cc === "flawed" ? "하자 있는"
    : cc === "low_batt" ? "배터리 약한"
    : cc === "normal" ? "비슷한 상태"
    : null;

  return (
    <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/40 px-2.5 py-2 dark:border-emerald-900/30 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
          <span aria-hidden="true">🔍</span>
          <span>이 시세 비교 매물</span>
        </div>
        {ccLabel ? (
          <span className="text-[10px] font-medium text-emerald-700/70 dark:text-emerald-300/70">
            {ccLabel} 매물끼리만
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">비교 매물 불러오는 중...</div>
      ) : error ? (
        <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">비교 매물 불러오기 실패</div>
      ) : !listings || listings.length === 0 ? (
        <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          {ccLabel ? `${ccLabel} 비교 매물 누적 중` : "비교 매물 누적 중"} — 데이터 쌓이면 자동 표시
        </div>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {/* Wave 394.5.b: mode 따라 slice. simple = 6 / detailed = 12. */}
          {listings.slice(0, limit).map((item) => {
            const itemPrice = item.price > 0 ? item.price : 0;
            const priceDiff = card.price && itemPrice ? itemPrice - card.price : 0;
            const diffPct = card.price && itemPrice ? Math.round((priceDiff / card.price) * 100) : 0;
            const isSimilar = Math.abs(diffPct) <= 2;
            const isMoreExpensive = !isSimilar && priceDiff > 0;

            // listingState (시스템 분류) 우선, saleStatus (셀러 설정) fallback.
            // 강한 신호 = sold (실제 거래가). 약한 신호 = active (현재 호가).
            const isSold = item.listingState === "sold" || item.saleStatus === "SOLD_OUT" || item.saleStatus === "sold";
            const isReserved = item.saleStatus === "reserved" || item.saleStatus === "RESERVED" || item.saleStatus === "예약중";

            // Wave 394.6.b.fix4 (사용자 짚음): "판매중" chip = default 상태 (99% active)
            // → 매물명 가독성만 깎음. "판매완료/예약중" 만 우측 가격 위 작게 표시 (특별 정보).
            const statusBadge = isSold
              ? { label: "판매완료", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200" }
              : isReserved
                ? { label: "예약중", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200" }
                : null; // "판매중" 안 보임 (default)
            return (
              <li key={item.pid} className="flex items-center gap-2 rounded bg-white/70 px-1.5 py-1.5 dark:bg-zinc-900/50">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-[#f2eadf] dark:bg-zinc-800">
                  {item.thumbnailUrl ? (
                    <Image src={item.thumbnailUrl} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[8px] text-zinc-400">없음</div>
                  )}
                </div>
                {/* 가운데 = 매물명 (chip 제거, 가독성 ↑ — line-clamp-2 좌측 다 차지) */}
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[11px] font-medium leading-snug text-zinc-700 dark:text-zinc-300">
                    {item.name || "이름 없음"}
                  </div>
                </div>
                {/* 우측 = (선택) 판매완료/예약중 badge + 가격 + 차이 % column */}
                <div className="shrink-0 text-right">
                  {statusBadge ? (
                    <div className="mb-0.5">
                      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                  ) : null}
                  <div className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {krw(itemPrice)}
                  </div>
                  {!isSimilar ? (
                    <div className={`text-[10px] font-bold tabular-nums ${isMoreExpensive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {isMoreExpensive ? `+${diffPct}%` : `${diffPct}%`}
                    </div>
                  ) : (
                    <div className="text-[10px] font-medium text-zinc-400">비슷</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-1.5 space-y-0.5 text-[10px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">
        <div>
          {ccLabel ? (
            <>같은 모델 · {ccLabel} 매물끼리만 비교 (다른 상태는 별도 시세).</>
          ) : (
            <>같은 모델 매물 비교.</>
          )}
        </div>
        {listings && listings.length > 0 ? (
          // Wave 394.6.b.fix3: 사용자 짚음 — "현재 매입가 대비 몇 % 싸거나 비싼지". 비교 매물 기준 표현.
          <div>
            <span className="text-emerald-600 dark:text-emerald-400">+%</span> 비교 매물 비쌈 (이 매물 더 쌈) ·{" "}
            <span className="text-rose-600 dark:text-rose-400">−%</span> 비교 매물 쌈 (이 매물 더 비쌈)
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UpperFoldFearReducers({ card }: { card: RevealCard }) {
  const speed = saleSpeedDisplay(card);
  const risk = buildRiskScore(revealRiskScoreInput(card));
  const activity = marketActivityDisplay(card);
  const safety = safetyDisplay(card, risk);
  const speedTone: "good" | "info" | "warn" = speed.isSlow ? "warn" : speed.isFast ? "good" : "info";
  // Wave 2026-05-19 v2 (사용자 피드백): "현재성" 타일 제거 — 매입/시세 줄에 이미 검증 시점 있어 중복.
  // 4 타일 → 3 타일 (오늘 물량 / 보통 N일 안에 팔림 / 거래 안전).
  const activityIconClass = `mt-1 h-5 w-5 ${upperFoldTileClass(activity.tone).value}`;
  const speedIconClass = `mt-1 h-5 w-5 ${upperFoldTileClass(speedTone).value}`;
  const tiles: Array<{
    key: string;
    label: string;
    value: string;
    sub: string;
    tone: UpperFoldTileTone;
    icon: React.ReactNode;
  }> = [
    {
      key: "activity",
      label: activity.label,
      value: activity.value,
      sub: activity.sub,
      tone: activity.tone,
      icon: renderActivityIcon(activity.value, activityIconClass),
    },
    {
      key: "speed",
      label: "팔리는 속도",
      // 2026-05-19 P0: 폴백 운영 게이트 OFF면 value/sub 정직하게. 거짓 "카테고리 평균" 카피 제거.
      value: speed.isFallback && !VELOCITY_UI_TEST_ENABLED
        ? "수집 중"
        : (speed.isFast ? "빠름" : speed.isSlow ? "느림" : "보통"),
      sub: speed.isFallback
        ? (VELOCITY_UI_TEST_ENABLED
            ? `약 ${speed.label} · 표본 부족 (UI 테스트 표시)`
            : "회전 데이터 수집 중")
        : `약 ${speed.label} · 최근 판매 ${speed.sold7dCount.toLocaleString("ko-KR")}건`,
      tone: speedTone,
      icon: renderSpeedIcon(speed, speedIconClass),
    },
  ];
  const safetyTone = upperFoldTileClass(safety.tone);
  // Wave 334: 평가별 아이콘 — renderSafetyIcon이 JSX 반환 (컴포넌트 새로 만들지 않음).
  const safetyIconNode = renderSafetyIcon(safety.tone, safety.value, `mt-1 h-5 w-5 ${safetyTone.value}`);
  // - dot 크기 통일 (h-1.5 w-1.5) — ShieldIcon 대신 dot로 거래 안전도 통일
  // - sub line-clamp-2 + 고정 높이 (정렬 어긋남 방지)
  // - 라벨 한 줄 고정
  return (
    <div className="mt-2 overflow-hidden border-t border-zinc-200 bg-white/0 dark:border-zinc-800 sm:rounded-xl sm:border sm:bg-white sm:dark:bg-zinc-900/40">
      <div className="grid grid-cols-3 divide-x divide-zinc-200 dark:divide-zinc-800">
        {tiles.map((tile) => {
          const tone = upperFoldTileClass(tile.tone);
          return (
            <div key={tile.key} className="flex flex-col items-center px-2 py-2.5 text-center">
              <div className="flex h-3 items-center justify-center text-[9px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span className="truncate">{tile.label}</span>
              </div>
              {tile.icon}
              <div className={`mt-1 line-clamp-1 text-xs font-bold leading-tight tabular-nums ${tone.value}`}>
                {tile.value}
              </div>
              <div className="mt-1 line-clamp-2 min-h-[24px] text-[10px] font-medium leading-3 text-zinc-500 dark:text-zinc-400">
                {tile.sub}
              </div>
            </div>
          );
        })}
        <RevealRiskScoreMini
          card={card}
          containerClassName="contents"
          triggerClassName="flex w-full flex-col items-center justify-start px-2 py-2.5 text-center transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
          triggerContent={(
            <span className="flex w-full flex-col items-center">
              <span className="flex h-3 items-center justify-center text-[9px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span className="truncate">거래 안전</span>
              </span>
              {safetyIconNode}
              <span className={`mt-1 line-clamp-1 text-xs font-bold leading-tight tabular-nums ${safetyTone.value}`}>
                {safety.value}
              </span>
              <span className="mt-1 line-clamp-2 block min-h-[24px] text-[10px] font-medium leading-3 text-zinc-500 dark:text-zinc-400">
                {safety.sub}
              </span>
            </span>
          )}
          hideChevron
          portalDetail
        />
      </div>
    </div>
  );
}

function RecommendationReasonPanel({ card, className = "" }: { card: RevealCard; className?: string }) {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const market = card.marketBasis;
  const isMarketInvalidated = Math.min(card.expectedProfitMin, card.expectedProfitMax) <= 0;
  const marketSample = market?.sampleCount ?? 0;
  const soldSample = market?.soldSampleCount ?? 0;
  const condition = marketConditionLabel(card);
  const goodSignals = recommendationGoodSignals(card);
  const watchSignals = recommendationWatchSignals(card);
  const featureCards = recommendationFeatureCards(card);
  const toneClass = {
    profit: "border-emerald-100 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100",
    market: "border-sky-100 bg-sky-50/70 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-100",
    speed: "border-amber-100 bg-amber-50/70 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100",
    quality: "border-[#d8e2d7] bg-white/85 text-[#223127] dark:border-zinc-800 dark:bg-zinc-900/45 dark:text-zinc-100",
  } satisfies Record<RecommendationFeatureTone, string>;
  const reasonSummary = isMarketInvalidated
    ? "지금 기준으로는 차익이 없어 판매완료 상품처럼 정리하는 게 맞아요."
    : featureCards.slice(0, 2).map((feature) => feature.title).join(" · ");

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <section className={`rounded-none border-0 bg-transparent p-0 shadow-none dark:bg-transparent sm:rounded-2xl sm:border sm:border-[#d6e2d3] sm:bg-[linear-gradient(180deg,#f8fcf5_0%,#eef7eb_100%)] sm:p-3.5 sm:shadow-[0_12px_28px_rgba(49,66,56,0.08)] sm:dark:border-emerald-900/40 sm:dark:bg-none sm:dark:bg-emerald-950/20 lg:col-span-2 ${className}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="group flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-[#223127] dark:text-zinc-100">
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
              왜 이 상품을 추천했나요?
            </div>
            <div className="mt-1 hidden text-xs font-semibold leading-5 text-[#60705f] dark:text-zinc-300 sm:block">
              {reasonSummary}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[#b9d0b4] bg-white/90 px-2.5 py-1 text-[11px] font-black text-[#4f6a52] shadow-sm transition group-hover:bg-[#e4f0e1] dark:border-emerald-900/60 dark:bg-zinc-900 dark:text-emerald-200">
            근거 보기
          </span>
        </button>
      </section>

      {open && portalRoot ? createPortal(
        <>
          <div
            className="fixed inset-0 z-[120] bg-zinc-950/28 backdrop-blur-[1px]"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="추천 이유 자세히 보기"
            onClick={(e) => e.stopPropagation()}
            className="recommendation-reason-dialog fixed left-1/2 top-1/2 z-[130] max-h-[min(82dvh,640px)] w-[calc(100vw-28px)] max-w-[540px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[#d6e2d3] bg-[#fffdf9] shadow-2xl shadow-zinc-950/24 dark:border-zinc-700 dark:bg-zinc-900 sm:max-h-[84vh]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#e8dfd2] bg-[#fffdf9]/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-black text-[#223127] dark:text-zinc-100">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  왜 이 상품을 추천했나요?
                </div>
                <div className="mt-0.5 truncate text-xs font-semibold text-[#60705f] dark:text-zinc-300">
                  {reasonSummary}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[calc(min(82dvh,640px)-74px)] overflow-y-auto px-4 py-3 sm:max-h-[calc(84vh-74px)] sm:px-5 sm:py-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {featureCards.map((feature) => (
                  <div key={`${feature.title}-${feature.body}`} className={`rounded-xl border px-3 py-2.5 shadow-sm ${toneClass[feature.tone]}`}>
                    <div className="flex items-center gap-2 text-xs font-black">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/75 text-current shadow-sm dark:bg-zinc-900/55">
                        {feature.icon}
                      </span>
                      <span>{feature.title}</span>
                    </div>
                    <div className="mt-1.5 text-[11px] font-semibold leading-5 opacity-75">
                      {feature.body}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:hidden">
                <MarketBasisMini card={card} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-100 bg-white/85 px-3 py-2.5 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900/45">
                  <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-200">좋은 점</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {goodSignals.length > 0 ? goodSignals.map((signal) => (
                      <span key={signal} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                        {signal}
                      </span>
                    )) : (
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">차익과 시세 기준을 함께 확인했어요.</span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-white/85 px-3 py-2.5 shadow-sm dark:border-amber-900/50 dark:bg-zinc-900/45">
                  <div className="text-[11px] font-black text-amber-800 dark:text-amber-200">확인할 점</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {watchSignals.length > 0 ? watchSignals.map((signal) => (
                      <span key={signal} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        {signal}
                      </span>
                    )) : (
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">큰 주의 신호는 적어요.</span>
                    )}
                  </div>
                </div>
              </div>
              <details className="mt-2 rounded-xl border border-white/80 bg-white/75 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                <summary className="cursor-pointer text-[11px] font-black text-[#4f6a52] dark:text-emerald-200">
                  계산 기준 보기
                </summary>
                <div className="mt-2 grid gap-2 text-[11px] font-semibold leading-5 text-[#647064] dark:text-zinc-400 sm:grid-cols-2">
                  <div>
                    <b className="text-[#223127] dark:text-zinc-100">비교군</b>
                    <br />
                    {market?.label ? `${market.label} · ${condition} 기준으로 비교했어요.` : "모델 분류가 약하면 추천 강도를 낮춰요."}
                  </div>
                  <div>
                    <b className="text-[#223127] dark:text-zinc-100">비용/상태</b>
                    <br />
                    판매수수료, 재배송비, 안전버퍼를 차감하고 상품 보기 전후로 판매완료 여부를 다시 봐요.
                  </div>
                  <div className="sm:col-span-2">
                    {marketBasisPlainSentence(card)}
                  </div>
                </div>
              </details>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#697768] dark:text-zinc-400">
                <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-zinc-900/60">
                  {marketSample > 0 ? `비슷한 매물 ${marketSample.toLocaleString("ko-KR")}건` : "비슷한 매물 부족"}
                </span>
                <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-zinc-900/60">
                  {soldSample > 0 ? `최근 거래 ${soldSample.toLocaleString("ko-KR")}건` : "거래 데이터 누적 중"}
                </span>
                {/* 2026-05-20 P0-Upload: 셀러 등록 시점 우선 (있으면). 검증 시점은 sub로 강등. */}
                {uploadAgoLabel(card.firstSeenAt) ? (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-zinc-900/60" title={`데이터 ${freshLabel(card.freshSeconds)}`}>
                    {uploadAgoLabel(card.firstSeenAt)}
                  </span>
                ) : (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-zinc-900/60">
                    {freshLabel(card.freshSeconds)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <style jsx global>{`
            @keyframes recommendationReasonSettle {
              from {
                opacity: 0;
                transform: translate(-50%, calc(-50% + 10px));
              }
              to {
                opacity: 1;
                transform: translate(-50%, -50%);
              }
            }

            .recommendation-reason-dialog {
              animation: recommendationReasonSettle 130ms ease-out;
            }
          `}</style>
        </>,
        portalRoot,
      ) : null}
    </>
  );
}

function MarketGraphTrustLine({ card }: { card: RevealCard }) {
  const market = card.marketBasis;
  if (!market) return null;
  const condition = marketConditionLabel(card);
  const source = market.priceSource === "reference" ? "다나와 기준선 + 번개 미개봉 추이" : `번개 ${condition} 매물 추이`;
  return (
    <details className="rounded-lg border border-[#e2d9cb] bg-white/70 px-3 py-2 text-[11px] font-semibold leading-5 text-[#5f6d5f] dark:border-zinc-800 dark:bg-zinc-900/45 dark:text-zinc-300">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
        <span className="font-black text-[#4f6a52] dark:text-emerald-200">그래프 기준 보기</span>
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
          {condition} · {source}
        </span>
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-[#e7f2e4] px-2 py-0.5 text-[10px] font-black text-[#4f6a52] dark:bg-emerald-950/50 dark:text-emerald-300">
          {condition} 기준
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">{source}</span>
      </div>
      <div className="mt-1">
        이 그래프는 같은 모델 중 비슷한 상태로 분류된 매물을 우선 사용해요. 상태가 다른 매물을 섞어 시세를 부풀리지 않아요.
      </div>
    </details>
  );
}

function savedRatingLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(1);
}

// Wave 80: SavedDetailMini 미사용 (찜/리뷰/판매자 설명 직접 노출 법적 위험으로 제거).
// _SavedDetailMini로 명시 — 차후 필요 시 재활용.
function _SavedDetailMini({ card }: { card: RevealCard }) {
  const detail = card.savedDetail;
  if (!detail) return null;
  const description = detail.descriptionPreview.trim();
  const rating = savedRatingLabel(detail.sellerReviewRating);

  return (
    <div className="rounded-lg border border-[#e7dece] bg-[#fffaf1] px-3 py-2 text-[11px] leading-5 text-[#5f675e] dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300">
      <div className="flex flex-wrap gap-1.5">
        {detail.favoriteCount != null ? (
          <span className="rounded-full bg-[#f3eee5] px-2 py-0.5 font-black text-[#344136] dark:bg-zinc-900 dark:text-zinc-200">
            찜 {detail.favoriteCount.toLocaleString("ko-KR")}
          </span>
        ) : null}
        {rating ? (
          <span className="rounded-full bg-[#f3eee5] px-2 py-0.5 font-black text-[#344136] dark:bg-zinc-900 dark:text-zinc-200">
            리뷰 {rating}
          </span>
        ) : null}
        {detail.sellerReviewCount > 0 ? (
          <span className="rounded-full bg-[#f3eee5] px-2 py-0.5 font-black text-[#344136] dark:bg-zinc-900 dark:text-zinc-200">
            리뷰 {detail.sellerReviewCount.toLocaleString("ko-KR")}개
          </span>
        ) : null}
        {detail.freeShipping ? (
          <span className="rounded-full bg-[#f3eee5] px-2 py-0.5 font-black text-[#344136] dark:bg-zinc-900 dark:text-zinc-200">
            무료배송
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-2 line-clamp-3 whitespace-pre-line font-semibold text-[#6b7269] dark:text-zinc-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}

// Wave 2026-05-19 v3 (사용자 피드백 — 셀러 신뢰도 별도 카드):
// 거래 안전 타일 + RecommendationReason 안 셀러 후기가 분산 → 별도 카드로 통합.
// savedDetail에 있는 데이터만 활용 (sellerReviewRating/sellerReviewCount/freeShipping).
// is_proshop / last_seen_at 은 prop 부재 → 다음 wave (API 확장 필요).
// Wave 393.6: 호출처 제거됨 (UpperFold tile + WhyTrust Q&A에 정보 있음).
// 함수는 보존 — 추후 재활용 가능. ESLint _ prefix로 unused 허용.
function _SellerTrustPanel({ card }: { card: RevealCard }) {
  const detail = card.savedDetail;
  const rating = detail?.sellerReviewRating ?? null;
  const reviewCount = detail?.sellerReviewCount ?? 0;
  const freeShipping = Boolean(detail?.freeShipping);

  // 등급 판단 — 일반인 친화 4단계
  let trustLevel: "good" | "ok" | "caution" | "danger";
  let trustHeadline: string;
  let trustSub: string;
  // Wave 393.5: sub 단순화 — WhyTrustCollapse Q&A에 자세한 답 이미 있음.
  // 헤드라인은 등급 + 별점, sub은 "후기 N건 (수 충분/적음)" 단순 정보만.
  if (rating != null && rating >= 4.8 && reviewCount >= 30) {
    trustLevel = "good";
    trustHeadline = `우수 셀러 ⭐ ${rating.toFixed(1)}`;
    trustSub = `후기 ${reviewCount.toLocaleString("ko-KR")}건 (수 충분)`;
  } else if (rating != null && rating >= 4.5 && reviewCount >= 10) {
    trustLevel = "ok";
    trustHeadline = `평점 ${rating.toFixed(1)} 셀러`;
    trustSub = `후기 ${reviewCount.toLocaleString("ko-KR")}건`;
  } else if (reviewCount > 0 && rating != null) {
    trustLevel = "caution";
    trustHeadline = `평점 ${rating.toFixed(1)} · 후기 ${reviewCount.toLocaleString("ko-KR")}건`;
    trustSub = reviewCount < 10 ? "후기 적음 — 안전결제 권장" : "후기 보통 — 안전결제 권장";
  } else {
    trustLevel = "danger";
    trustHeadline = "신규/익명 셀러";
    trustSub = "후기 없음 — 안전결제 + 직거래 검수";
  }

  // Wave 323 (디자인 통일): 모든 패널 같은 base — 흰 카드 + 색 accent strip (좌측 보더).
  // 등급별 좌측 4px 보더 색만 변경. 박스 안 박스 없음.
  const accentBorderClass = trustLevel === "good"
    ? "border-l-emerald-500"
    : trustLevel === "ok"
      ? "border-l-emerald-300"
      : trustLevel === "caution"
        ? "border-l-amber-400"
        : "border-l-rose-500";
  const valueColor = trustLevel === "good" || trustLevel === "ok"
    ? "text-emerald-700 dark:text-emerald-300"
    : trustLevel === "caution"
      ? "text-amber-700 dark:text-amber-300"
      : "text-rose-700 dark:text-rose-300";

  // Wave 334: 등급별 아이콘 시각화.
  const TrustIcon = trustLevel === "good"
    ? TrophyIcon
    : trustLevel === "ok"
      ? ShieldIcon
      : AlertTriangleIcon;

  return (
    <section className={`mt-3 border-t border-zinc-200 border-l-4 ${accentBorderClass} bg-white/0 py-3 pl-3 dark:border-zinc-800 sm:rounded-xl sm:border sm:bg-white sm:p-3 sm:dark:bg-zinc-900/40`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <TrustIcon className={`mt-3 h-6 w-6 shrink-0 ${valueColor}`} />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              셀러 정보
            </div>
            <div className={`mt-1 text-sm font-bold ${valueColor}`}>
              {trustHeadline}
            </div>
            <div className="mt-0.5 text-xs font-medium leading-4 text-zinc-600 dark:text-zinc-400">
              {trustSub}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {freeShipping ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              무료배송
            </span>
          ) : null}
          <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            안전결제 권장
          </span>
        </div>
      </div>
      {(trustLevel === "caution" || trustLevel === "danger") ? (
        <div className="mt-2 border-t border-zinc-100 pt-2 text-[11px] font-medium leading-4 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          후기 적은 셀러는 번개페이 안전결제 + 직거래 검수 권장.
        </div>
      ) : null}
    </section>
  );
}

// Wave 2026-05-19 (외부인 #2 B3 가품 체크리스트):
// 카테고리별 정적 체크리스트 (counterfeit-checklist.ts). 12개 위험 카테고리만 노출.
// 안전 카테고리(monitor/desktop/lego/speaker/kickboard/game_console/home_appliance/sport_golf)는
// counterfeitChecklistFor() null 반환 → 미표시 (노이즈 안 박음).
function CounterfeitChecklistPanel({ card }: { card: RevealCard }) {
  const [expanded, setExpanded] = useState(false);
  const category = categoryFromComparableKey(card.marketBasis?.comparableKey ?? null);
  const checklist = counterfeitChecklistFor(category);
  if (!checklist) return null;

  // Wave A (2026-05-20): brand 감지 시 brand-specific 변별 포인트 + 시장 위험 + 인증 박스 노출.
  //   외부 review — "Bird-aid 라벨, GORE-TEX 4면 박음질 같은 모델별 가품 체크포인트가 진짜 가치 있음."
  const brandDepth: BrandDepthMatch | null = detectBrandDepth(category, {
    skuId: card.skuId ?? null,
    skuName: card.skuName ?? null,
    name: card.name ?? null,
  });

  const mustChecks = checklist.checks.filter((c) => c.priority === "must");
  const recommendedChecks = checklist.checks.filter((c) => c.priority === "recommended");
  const extraChecks = checklist.checks.filter((c) => c.priority === "extra");
  const totalCount = checklist.checks.length;

  // Wave 393.8: 카테고리별 헤드라인 — "전자제품이 뭔 가품이냐" (사용자 짚음).
  // 가품 위험 카테고리 vs 정품 거래 카테고리 분기. 헤드라인 의미 정확.
  const headlineByCategory: Record<string, string> = {
    shoe: `가품 + 사이즈 점검 ${totalCount}개`,
    earphone: `차이팟 가품 + 정품 점검 ${totalCount}개`,
    bag: `명품 가품 점검 ${totalCount}개`,
    perfume: `정품 진위 점검 ${totalCount}개`,
    watch: `명품 가품 점검 ${totalCount}개`,
    clothing: `명품 정품 점검 ${totalCount}개`,
    smartphone: `잠금 + 기기 상태 점검 ${totalCount}개`,
    tablet: `iCloud 잠금 + 상태 점검 ${totalCount}개`,
    smartwatch: `잠금 + 배터리 점검 ${totalCount}개`,
    laptop: `잠금 + 부품 점검 ${totalCount}개`,
    drone: `활성화 + 펌웨어 점검 ${totalCount}개`,
    camera: `셔터 + 렌즈 점검 ${totalCount}개`,
  };
  const headlineText = headlineByCategory[checklist.category] ?? `구매 전 점검 ${totalCount}개`;

  // 카테고리별 uppercase 헤더도 자연어
  // Wave 394.1 (외부 review #9): 정품 단정형 ("정품 확인") → 방어적 ("정품 확인 필요").
  // "사용자가 '앱이 정품 판정해줬다'고 오해할 수 있음. 특히 명품 정품 판단 민감.
  // 앱이 보장하는 듯한 문구는 위험" — 외부 review. 능동형 ("구매 전 점검", "기기 점검") 그대로 OK.
  const upperHeaderByCategory: Record<string, string> = {
    shoe: "구매 전 점검",
    earphone: "구매 전 점검",
    bag: "정품 확인 필요",
    perfume: "정품 확인 필요",
    watch: "정품 확인 필요",
    clothing: "정품 확인 필요",
    smartphone: "기기 점검",
    tablet: "기기 점검",
    smartwatch: "기기 점검",
    laptop: "기기 점검",
    drone: "기기 점검",
    camera: "기기 점검",
  };
  const upperHeader = upperHeaderByCategory[checklist.category] ?? "구매 전 점검";

  // Wave 323 (디자인 통일): 흰 카드 + rose 좌측 보더 + 본문은 색 강도 줄임.
  const priorityDotClass: Record<CounterfeitCheckPriority, string> = {
    must: "bg-rose-500",
    recommended: "bg-amber-400",
    extra: "bg-zinc-300 dark:bg-zinc-600",
  };

  // Wave 393.5: rose → amber (사용자 짚음 — rose는 "이 매물 가품"으로 헷갈림.
  // 실제 의미 = 구매 전 정품 점검 체크리스트).
  return (
    <section className="mt-3 border-t border-zinc-200 border-l-4 border-l-amber-400 bg-white/0 py-3 pl-3 dark:border-zinc-800 sm:rounded-xl sm:border sm:bg-white sm:p-3 sm:dark:bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {upperHeader} — {checklist.label}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <ShieldIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            {headlineText}
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs font-medium leading-4 text-zinc-600 dark:text-zinc-400 sm:line-clamp-none">
            {checklist.riskHeadline}
          </div>
          {brandDepth ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium leading-4">
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {brandDepth.brand.label}
              </span>
              <span
                className={
                  brandDepth.brand.counterfeitRisk === "high"
                    ? "rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                    : brandDepth.brand.counterfeitRisk === "moderate"
                      ? "rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                      : "rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                }
              >
                {COUNTERFEIT_RISK_LABEL[brandDepth.brand.counterfeitRisk]}
              </span>
            </div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {expanded ? "접기" : `필수 ${mustChecks.length}개`}
        </span>
      </button>
      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {brandDepth ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                <span aria-hidden="true">🎯</span>
                <span>{brandDepth.brand.label} — 모델별 변별 포인트</span>
              </div>
              {brandDepth.brand.counterfeitChecks.length > 0 ? (
                <div>
                  <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100">가품 변별 (구체 항목)</div>
                  <ul className="mt-1 space-y-1">
                    {brandDepth.brand.counterfeitChecks.map((c, i) => (
                      <li
                        key={i}
                        className="flex gap-1.5 text-[11px] font-medium leading-4 text-zinc-700 dark:text-zinc-200"
                      >
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-rose-500" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {brandDepth.brand.marketRisks.length > 0 ? (
                <div>
                  <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100">시장 위험 (가품 외)</div>
                  <ul className="mt-1 space-y-1">
                    {brandDepth.brand.marketRisks.map((c, i) => (
                      <li
                        key={i}
                        className="flex gap-1.5 text-[11px] font-medium leading-4 text-zinc-700 dark:text-zinc-200"
                      >
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {brandDepth.brand.authentication.length > 0 ? (
                <div>
                  <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100">인증/검수 가능 채널</div>
                  <ul className="mt-1 space-y-1">
                    {brandDepth.brand.authentication.map((c, i) => (
                      <li
                        key={i}
                        className="flex gap-1.5 text-[11px] font-medium leading-4 text-zinc-700 dark:text-zinc-200"
                      >
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="text-[10px] font-medium leading-4 text-zinc-600 dark:text-zinc-400">
                ※ 미뇨이는 정품 판정 X. 직접 거래 시 셀러에게 사진/영상 요청해 본인 판단 권장.
              </div>
            </div>
          ) : null}
          {[...mustChecks, ...recommendedChecks, ...extraChecks].map((check) => (
            <div
              key={check.title}
              className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60"
            >
              <div className="flex items-start gap-2">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${priorityDotClass[check.priority]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                      {check.title}
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                      {PRIORITY_LABEL[check.priority]}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-400">
                    {check.detail}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="text-[10px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
            필수 항목 거절 시 거래 보류 권장. 안전결제 + 반품 보호 필수.
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          {mustChecks.slice(0, 4).map((check) => (
            <span
              key={check.title}
              className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
              title={check.detail}
            >
              {check.title}
            </span>
          ))}
          {mustChecks.length > 4 ? (
            <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              +{mustChecks.length - 4}
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
}

// Wave 2026-05-19 (외부인 #A1 판매 단계 도우미):
// 카테고리별 정적 템플릿 (sell-helper.ts). 매수 후(bought/inspected feedback) 자동 펼침.
// LLM 호출 없음 — 비용/모더레이션 책임 제거. 정적 룰만으로 일반인 친화 판매 가이드 제공.
function SellHelperPanel({
  card,
  currentFeedbackType,
}: {
  card: RevealCard;
  currentFeedbackType?: string | null;
}) {
  const category = categoryFromComparableKey(card.marketBasis?.comparableKey ?? null);
  const helper = sellHelperFor(category);
  // Wave 2026-05-19 v2 (사용자 피드백): 매수 전엔 아예 숨김.
  // bought/inspected/listed/resold feedback 받은 매물에만 노출 — 매수 흐름 후 자연스럽게 등장.
  const hasPurchased = currentFeedbackType === "bought"
    || currentFeedbackType === "inspected"
    || currentFeedbackType === "listed"
    || currentFeedbackType === "resold";
  const [expanded, setExpanded] = useState(true);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  if (!helper) return null;
  if (!hasPurchased) return null;

  const medianPrice = card.marketBasis?.medianPrice ?? null;
  const pricing = medianPrice != null && medianPrice > 0
    ? suggestedAskingPrice(category, medianPrice)
    : null;

  const recommendedTitle = `[${helper.label.split(" ")[0]} 매물] ${card.name}`;
  const bodyTemplate = buildBodyTemplate(category, card.name) ?? "";

  async function copyText(text: string, setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      window.setTimeout(() => setter(false), 1600);
    } catch {
      setter(false);
    }
  }

  const requiredPhotos = helper.photos.filter((p) => p.required);
  const optionalPhotos = helper.photos.filter((p) => !p.required);

  return (
    <section className="mt-3 border-t border-zinc-200 border-l-4 border-l-emerald-500 bg-white/0 py-3 pl-3 dark:border-zinc-800 sm:rounded-xl sm:border sm:bg-white sm:p-3 sm:dark:bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            판매 도우미 — {helper.label}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            <WalletIcon className="h-4 w-4 shrink-0" />
            {currentFeedbackType === "bought" ? "매수 완료 — 이제 팔아보자"
              : currentFeedbackType === "inspected" ? "검수 완료 — 등록 단계"
              : currentFeedbackType === "listed" ? "판매 등록 완료"
              : "판매 완료"}
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs font-medium leading-4 text-zinc-600 dark:text-zinc-400 sm:line-clamp-none">
            제목 / 본문 / 사진 / 호가 가이드 — 복붙 가능.
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {expanded ? "접기" : "펼치기"}
        </span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {/* 호가 가이드 — 평탄 */}
          {pricing ? (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                추천 호가 / 거래가
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">호가 (등록)</div>
                  <div className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
                    {krw(pricing.askingPrice)}
                  </div>
                  <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    시세 +{pricing.markupPct}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">거래가 (목표)</div>
                  <div className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {krw(pricing.targetClosePrice)}
                  </div>
                  <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    시세 기준
                  </div>
                </div>
              </div>
              <div className="mt-1.5 text-[10px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
                {helper.priceNote}
              </div>
            </div>
          ) : null}

          {/* 추천 제목 */}
          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                추천 제목
              </div>
              <button
                type="button"
                onClick={() => copyText(recommendedTitle, setCopiedTitle)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {copiedTitle ? "복사됨" : "복사"}
              </button>
            </div>
            <div className="mt-1.5 rounded-md bg-zinc-50 px-2.5 py-2 text-xs font-medium leading-5 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {recommendedTitle}
            </div>
            <div className="mt-1 text-[10px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
              패턴: <span className="font-mono">{helper.titlePattern}</span>
            </div>
          </div>

          {/* 본문 템플릿 */}
          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                본문 템플릿
              </div>
              <button
                type="button"
                onClick={() => copyText(bodyTemplate, setCopiedBody)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {copiedBody ? "복사됨" : "복사"}
              </button>
            </div>
            <pre className="mt-1.5 max-h-[200px] overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 px-2.5 py-2 text-[11px] font-medium leading-5 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {bodyTemplate}
            </pre>
          </div>

          {/* 사진 가이드 */}
          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              필수 사진 {requiredPhotos.length}장
              {optionalPhotos.length > 0 ? (
                <span className="ml-1 font-medium normal-case text-zinc-400">+ 선택 {optionalPhotos.length}</span>
              ) : null}
            </div>
            <ol className="mt-2 space-y-1.5">
              {requiredPhotos.map((photo, idx) => (
                <li key={photo.title} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {photo.title}
                    </div>
                    <div className="text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-400">
                      {photo.detail}
                    </div>
                  </div>
                </li>
              ))}
              {optionalPhotos.map((photo, idx) => (
                <li key={photo.title} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-[10px] font-bold text-white dark:bg-zinc-600">
                    +{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {photo.title}
                    </div>
                    <div className="text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
                      {photo.detail}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* 카테고리 팁 */}
          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              💡 팁
            </div>
            <div className="mt-1 text-xs font-medium leading-5 text-zinc-700 dark:text-zinc-300">
              {helper.proTip}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// Wave 331 (사용자 + 메모리 정책 박혀있던 거):
// 번개장터 안전결제 의무화 → 셀러 3.5% 수수료. 당근마켓 직거래는 수수료 0.
// 사용자가 어디 팔지 선택지 보고 결정.
function DaangnLogo({ className = "h-4 w-4" }: { className?: string }) {
  // 당근마켓 로고 — 녹색 잎 + 주황 핀 본체 + 흰 원 (정식 형태 근사).
  // 사용자가 정식 SVG/PNG 주면 교체.
  return (
    <svg className={className} viewBox="0 0 50 55" xmlns="http://www.w3.org/2000/svg" aria-label="당근마켓">
      <path d="M15 6 Q18 1 22 3 Q25 0.5 28 3 Q32 1 35 6 Q30 11 25 9 Q20 11 15 6 Z" fill="#5DBA5E" />
      <path d="M25 10 C12 10 6 22 11 36 L25 52 L39 36 C44 22 38 10 25 10 Z" fill="#FF7A36" />
      <circle cx="25" cy="27" r="6" fill="white" />
    </svg>
  );
}

function PlatformProfitCompare({ card }: { card: RevealCard }) {
  const [open, setOpen] = useState(false);
  const market = card.marketBasis;
  if (!market?.medianPrice || market.medianPrice <= 0) return null;

  const bunjangFee = Math.round(market.medianPrice * SELLING_FEE_RATE);
  const bunjangProfit = expectedProfitAverage(card);
  // 당근 차익 = 번개 차익 + 수수료 (당근 직거래는 수수료 0)
  // 단 당근 안전결제 사용 시 0.x% 수수료 — 무시할 수준이라 0으로.
  const daangnProfit = bunjangProfit + bunjangFee;
  if (bunjangProfit <= 0 && daangnProfit <= 0) return null;
  const bonusFromDaangn = bunjangFee;

  return (
    <section className="mt-3 border-t border-zinc-200 bg-white/0 py-3 dark:border-zinc-800 sm:rounded-xl sm:border sm:bg-white sm:p-3 sm:dark:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          어디에 팔지? — 차익 비교
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-700 transition hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          aria-label="수수료 차이 설명"
        >
          {open ? "✕" : "?"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-zinc-50 px-3 py-2.5 dark:bg-zinc-900/60">
          <div className="flex items-center gap-1.5">
            <BunjangLogo className="h-4 w-4 rounded-[4px]" />
            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">번개장터 판매</span>
          </div>
          <div className="mt-1 text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
            +{krw(bunjangProfit)}
          </div>
          <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
            수수료 3.5% 차감
          </div>
          {/* Wave 394.2 (외부 review #13): 채널 리스크 chip — 단순 순익 비교가 당근 무조건 좋아 보이는 문제. */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              전국 거래
            </span>
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              안전결제
            </span>
          </div>
        </div>
        <div className="rounded-md bg-orange-50 px-3 py-2.5 dark:bg-orange-950/30">
          <div className="flex items-center gap-1.5">
            <DaangnLogo className="h-4 w-4" />
            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">당근 직거래</span>
          </div>
          <div className="mt-1 text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
            +{krw(daangnProfit)}
          </div>
          <div className="text-[10px] font-medium text-orange-700 dark:text-orange-300">
            +{krw(bonusFromDaangn)} 더 (수수료 0)
          </div>
          {/* Wave 394.2 (외부 review #13): 당근 리스크 chip — "당근 = 무조건 더 좋다"는 단순화 정정. */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              지역 제한
            </span>
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              네고 부담
            </span>
          </div>
        </div>
      </div>
      {open ? (
        <div className="mt-2 space-y-1.5 rounded-md bg-zinc-50 px-3 py-2 text-[11px] font-medium leading-5 text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300">
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">번개장터:</span> 안전결제 의무 — 셀러 돈 받기 안전 (구매자 결제 후 셀러 정산). 대신 거래액의 3.5% 수수료.
          </div>
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">당근 직거래:</span> 수수료 0이지만 셀러도 주의 — 위조지폐 / 입금 미루기 / 반품 가짜 클레임 가능. 동네 직거래는 현장에서 현금 확인 필수.
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
            ※ 당근페이 사용 시 셀러도 보호 (입금 보장) — 별도 수수료 일부. 가장 안전한 셀러 보호는 번개 안전결제 또는 당근페이.
          </div>
        </div>
      ) : null}
    </section>
  );
}

function sellerQuestionText(card: RevealCard) {
  return [
    `${card.name} 보고 문의드립니다.`,
    "1. 표시 가격에 택배비가 포함돼 있나요?",
    "2. 번개페이/안전결제 수수료는 누가 부담하나요?",
    "3. 구성품은 사진과 설명에 보이는 것 전부 포함인가요?",
  ].join("\n");
}

function CostAssurancePanel({ card }: { card: RevealCard }) {
  const [copied, setCopied] = useState(false);
  const snapshot = costAssuranceSnapshot(card);
  const feeRateLabel = `${Math.round(SELLING_FEE_RATE * 1000) / 10}%`;
  const questions = sellerQuestionText(card);
  // Wave 337 (사용자 + 메모리 정책 bunjang_safe_payment_mandate):
  // 번개장터 안전결제 의무화 → 셀러가 3.5% 부담. 구매자(우리 사용자가 살 때)는 0원.
  // "문의 필요"는 잘못된 표현. 디폴트는 0원 명시.
  // "순익 차감"도 일반인 친화 라벨로 변경.
  const rows = [
    { label: "상품가", value: krw(card.price), note: "현재 매입 기준" },
    { label: "내가 낼 배송비", value: snapshot.shippingLabel, note: "택포/별도 문구는 구매 전 재확인" },
    {
      label: "결제 수수료 (내가 살 때)",
      value: "0원",
      note: "번개 안전결제는 셀러 의무 부담 (3.5%). 단 셀러가 별도 명시 시 협의 필요",
    },
    {
      // Wave 394.1 (외부 review #17): "안전결제 ... · 재배송 ... · 안전버퍼 ..." 한 줄 → 리스트 (\n 줄바꿈, whitespace-pre-line 렌더).
      // 비용 항목 3개 한 줄에 다 박으면 모바일에서 가독성 떨어짐.
      label: "되팔 때 빠지는 돈",
      value: `안전결제 ${feeRateLabel}${snapshot.sellingFee == null ? "" : ` ${krw(snapshot.sellingFee)}`}\n재배송비 ${krw(RESELL_SHIPPING_FEE)}\n안전버퍼 ${krw(SAFETY_BUFFER)}`,
      note: "내가 재판매 시 셀러로서 부담 — 시세에서 차감",
    },
  ];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(questions);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  // Wave 329: 헤드라인 expected_profit_average와 동일한 차익 사용 (배송비 등 모두 포함된 정확한 값).
  const guidance = buyPriceGuidance({
    price: card.price,
    currentProfit: expectedProfitAverage(card),
  });
  // Wave 325: verdict 4단계 (great/good/fair/tight). rose 제거 — 풀 매물은 다 안전 통과.
  const verdictClass = !guidance ? "" : (guidance.verdict === "great" || guidance.verdict === "good")
    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
    : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";

  return (
    <section className="mt-3 border-t border-zinc-200 bg-white/0 py-3 dark:border-zinc-800 sm:rounded-xl sm:border sm:bg-white sm:p-3 sm:dark:bg-zinc-900/40">
      {/* Wave 323 (디자인 평탄화): 박스 안 박스 제거, 단일 평면 + 섹션 구분선. */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          최종 매입가 체크
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${snapshot.confidenceClass}`}>
          {snapshot.confidenceLabel}
        </span>
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
        {snapshot.buyerCostLabel}
      </div>

      {/* 비용 분해 — 평탄 리스트 */}
      <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-2 text-xs">
            <div className="font-medium text-zinc-500 dark:text-zinc-400">{row.label}</div>
            <div className="min-w-0 text-right">
              {/* Wave 394.1 (외부 review #17): whitespace-pre-line — value 안 \n 줄바꿈 렌더. 비용 분해 리스트. */}
              <div className="whitespace-pre-line font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {row.value}
              </div>
              <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                {row.note}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Wave 333: 결과 라벨 명시 — 24,739원이 뭔지 가시적이지 않았던 거 fix */}
      {snapshot.salePrice != null ? (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <div className="text-[10px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
            시세 {krw(snapshot.salePrice)} − 매입 {snapshot.buyerCostLabel} − 비용
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              = 예상 차익
            </span>
            <span className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {displayProfitRange(card)}
            </span>
          </div>
        </div>
      ) : null}

      {/* Wave 326: 협상 가이드 — 가격대별 의미 명시. "이 이상에 사면" 동사 명시 + 위험 구간(차익 1만 미만) 별도. */}
      {guidance ? (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            협상 가이드
          </div>

          {/* 현재 매입가 — 헤드라인 */}
          <div className="mt-2 rounded-md bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
            <div className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">현재 매입가</div>
            <div className="mt-0.5 flex items-baseline justify-between">
              <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {krw(card.price)}
              </span>
              <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
                차익 +{krw(guidance.currentProfit)}
              </span>
            </div>
          </div>

          {/* 가격대별 의미 — 위→아래 (좋음→나쁨). 모든 라인 "차익" 용어 통일. */}
          <div className="mt-2 space-y-1.5 text-xs">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-emerald-600 dark:text-emerald-400">↓</span>
                  <span className="text-zinc-500 dark:text-zinc-400">협상 시도</span>
                  <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {krw(guidance.negotiationTarget)}
                  </span>
                </span>
                <span className="text-[11px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                  차익 +{krw(guidance.negotiationProfit)}
                </span>
              </div>
              {/* Wave 394.2 (외부 review #14): 협상가 산출 근거 1줄 — "왜 이 가격?" 의문 해소. */}
              {/* buyPriceGuidance.ts: negotiationRoom = min(차익×30%, 2만원) */}
              <div className="mt-0.5 pl-4 text-[10px] font-medium leading-tight text-zinc-400 dark:text-zinc-500">
                현재가 −{krw(guidance.negotiationRoom)} 깎기 (차익의 30% 또는 최대 2만원)
              </div>
            </div>

            {/* Wave 394.1 (외부 review #15): 위험/손해 구간 만원 단위 단순화. */}
            {/* "867,550원 이상" → "약 86.8만원 이상" — 일반인 직관성. 1자리 소수로 정밀도 유지. */}
            <div className="flex items-baseline justify-between gap-2 border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
              <span className="flex items-baseline gap-1.5">
                <span className="text-amber-600 dark:text-amber-400">⚠</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  약 <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{(guidance.dangerStart / 10000).toFixed(1)}만원</span> 이상에 사면
                </span>
              </span>
              <span className="text-[11px] font-medium tabular-nums text-amber-600 dark:text-amber-400">
                차익 1만원 미만 (위험)
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-baseline gap-1.5">
                <span className="text-rose-600 dark:text-rose-400">✕</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  약 <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{(guidance.breakEven / 10000).toFixed(1)}만원</span> 이상에 사면
                </span>
              </span>
              <span className="text-[11px] font-medium tabular-nums text-rose-600 dark:text-rose-400">
                손해 (차익 0 이하)
              </span>
            </div>
          </div>

          {/* Verdict */}
          <div className={`mt-2 rounded-md px-2.5 py-1.5 text-xs font-bold ${verdictClass}`}>
            {guidance.verdictLabel}
          </div>
        </div>
      ) : null}

      <details className="group mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <span>문의 전 확인 3가지 (복붙)</span>
          <span className="text-zinc-400 transition group-open:rotate-45">+</span>
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs font-medium leading-5 text-zinc-700 dark:text-zinc-300">
          <li>표시 가격에 택배비가 포함돼 있는지</li>
          <li>번개페이/안전결제 수수료를 누가 부담하는지</li>
          <li>구성품이 사진과 설명에 보이는 것 전부인지</li>
        </ol>
        <button
          type="button"
          onClick={handleCopy}
          className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {copied ? "복사됨" : "문장 복사"}
        </button>
      </details>
    </section>
  );
}

function LoadingStage({ completing = false }: { completing?: boolean }) {
  // Wave 76: 게이지/% 동기화 + 완료 시 100% 도달. 이전엔 transition-[width] lag로
  // 바와 텍스트 desync, server 응답 시 중간 % 상태에서 갑자기 카드 reveal 됐음.
  // completing=true면 현재 pct에서 100%로 ~350ms 사이 ease-in.
  const [pct, setPct] = useState(5);
  useEffect(() => {
    let rafId = 0;
    if (completing) {
      const startPct = pct;
      const FINISH_MS = 350;
      const startedAt = performance.now();
      const tick = () => {
        const elapsed = performance.now() - startedAt;
        const t = Math.min(1, elapsed / FINISH_MS);
        const eased = 1 - Math.pow(1 - t, 2);
        setPct(startPct + (100 - startPct) * eased);
        if (t < 1) rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(rafId);
    }
    const startedAt = performance.now();
    const TARGET_MS = 4000;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed < TARGET_MS) {
        const t = elapsed / TARGET_MS;
        // ease-out cubic: 빠르게 시작, 천천히 도착
        const eased = 1 - Math.pow(1 - t, 3);
        setPct(5 + eased * 85);
      } else {
        // 4s 이후엔 90~95% 천천히 증가
        const overshoot = (elapsed - TARGET_MS) / 1000;
        setPct(Math.min(95, 90 + overshoot * 0.5));
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completing]);

  // 단계 라벨은 게이지 % 임계값 기반 (시간 기반 X → 게이지와 항상 일치)
  const stepIndex = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3;

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 animate-ping rounded-full bg-[var(--brand-accent)]/20" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-[var(--brand-accent)] to-[var(--brand-accent-strong)] shadow-lg shadow-[rgba(92,116,95,0.35)]" />
        <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white text-[11px] font-black tabular-nums text-[var(--brand-accent-strong)] dark:bg-zinc-900 dark:text-zinc-100">
          {Math.round(pct)}%
        </div>
      </div>
      <div className="w-full max-w-xs">
        <div className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--brand-accent)] dark:text-zinc-300">
          LIVE ANALYSIS
        </div>
        <div className="mt-2 text-center text-xl font-black text-zinc-900 dark:text-zinc-50">AI가 상품을 분석중입니다</div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--brand-accent)] to-[var(--brand-accent-strong)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 min-h-[40px] text-center text-sm leading-5 text-zinc-500 transition dark:text-zinc-400">
          {LOADING_STEPS[stepIndex]}
        </div>
        <div className="mt-1 text-center text-xs text-zinc-400 dark:text-zinc-500">
          {/* Wave 394.1 (외부 review #19): "실시간 검증" → "최신 호가" — 호가는 추정 가능, 검증은 단정형. */}
          번개장터 최신 호가 · 시세 재계산 · 리스크 필터
        </div>
      </div>
    </div>
  );
}

function RevealCardItem({
  card,
  delay,
  currentFeedbackType,
  photoRef,
}: {
  card: RevealCard;
  delay: number;
  currentFeedbackType?: string | null;
  photoRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [shown, setShown] = useState(false);
  const [dealExpanded, setDealExpanded] = useState(false);
  // Wave 394.5.a (외부 review #23 — 사용자 명시 채택): 초보/상세 모드 토글.
  // 디폴트 = simple (메모리 룰 일반인 친화). detailed = "디테일 펼침" (이미 있는 정보 더 자세히).
  // localStorage 기억 — 한 번 선택하면 다음 모달도 자동.
  // 본질 = 일반인 친화 단일 톤 유지 + "더 자세히 보고 싶은 사용자" 옵션. 전문가 통계 도구 X (별 wave).
  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const isMarketInvalidated = Math.min(card.expectedProfitMin, card.expectedProfitMax) <= 0;
  const sourceBadge = marketSourceBadge(card);
  const netPct = netProfitPercent(card);
  // Wave 394.6.a (외부 review #1): 차익 헤드라인 옆 verdict chip — "3초 안에 사라/말아라/협상" 답.
  // buyPriceGuidance.verdict 4-tier (great/good/fair/tight) → 3-tier 단순화 (사용자 일반인 친화).
  const verdictGuidance = !isMarketInvalidated
    ? buyPriceGuidance({ price: card.price, currentProfit: expectedProfitAverage(card) })
    : null;
  const verdictTier = !verdictGuidance
    ? null
    : verdictGuidance.verdict === "great" || verdictGuidance.verdict === "good"
      ? { label: "매입 OK", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" }
      : verdictGuidance.verdict === "fair"
        ? { label: "협상 권장", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" }
        : { label: "협상 필수", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200" };
  // Wave 2026-05-19 v2: grossGap, dailyProfit 표시 제거 (일반인 헷갈림 / 노이즈 큼).
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  // Wave 394.5.a: localStorage 기억 mount sync. (dealExpanded sync 는 별 useEffect 가 자동.)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("minyoi_modal_mode");
      if (stored === "detailed") setMode("detailed");
    } catch {}
  }, []);
  // Wave 394.5.a.fix2 (사용자 버그 짚음 — "간단 보기 누르면 다시 안돌아가는데?"):
  // mode 변경 시 양방향 sync. detailed → 펼침 / simple → 접힘.
  // 이전 단방향 (detailed 시만 펼침) → simple 가도 dealExpanded 그대로 → 시각 변화 없음.
  useEffect(() => {
    setDealExpanded(mode === "detailed");
  }, [mode]);
  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "simple" ? "detailed" : "simple";
      try { localStorage.setItem("minyoi_modal_mode", next); } catch {}
      return next;
    });
  }, []);

  return (
    <div
      className={`grid gap-3 transition-all duration-700 lg:grid-cols-2 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      {/* 좌측 카드 — 매물 정보 (image + 메타 + verdicts + 노트 + 버튼) */}
      <div className="order-1 grid gap-3 overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent sm:rounded-2xl sm:border sm:border-[#dfd6c9] sm:bg-[linear-gradient(180deg,#fffdf9_0%,#fbf6ee_100%)] sm:p-3 sm:shadow-[0_16px_34px_rgba(49,66,56,0.09)] sm:ring-1 sm:ring-white/70 sm:dark:border-zinc-800 sm:dark:bg-none sm:dark:bg-zinc-900 sm:dark:ring-zinc-800/70 sm:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(0,1fr)]">
        <div ref={photoRef}>
          <RevealProductImage card={card} />
        </div>

        <div className="min-w-0 w-full space-y-3 px-3 sm:px-0">
          <div className="flex w-full items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Wave 392.2: 신선도 강조 — 매우 신선 매물 즉시 인지 + Pro USP hint. */}
              <LastVerifiedAtBadge card={card} />
              {/* Wave 359+361: 득템 점수 — 제목과 같은 행 우측 작게 (당근 36.8°C 톤). */}
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 line-clamp-2 text-base font-bold leading-tight text-zinc-900 dark:text-zinc-50">
                  {card.name}
                </div>
                <DealMeterButton card={card} expanded={dealExpanded} onToggle={() => setDealExpanded((v) => !v)} />
              </div>
              {dealExpanded ? <DealEvidencePanel card={card} /> : null}
              <div className="mt-2">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <WalletIcon className="h-3 w-3" />
                  예상 순익
                </div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                  <span className={`text-2xl font-bold leading-none tabular-nums ${
                    isMarketInvalidated
                      ? "text-rose-600 dark:text-rose-300"
                      : "text-emerald-600 dark:text-emerald-300"
                  }`}>
                    {displayProfitRange(card)}
                  </span>
                  {netPct != null ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                      isMarketInvalidated
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                    }`}>
                      {netPct >= 0 ? "+" : ""}{netPct}%
                    </span>
                  ) : null}
                  {/* Wave 394.6.a (외부 review #1): 3초 결정 chip — "매입 OK / 협상 권장 / 협상 필수". */}
                  {verdictTier ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${verdictTier.cls}`}>
                      {verdictTier.label}
                    </span>
                  ) : null}
                  {isMarketInvalidated ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-900 dark:bg-rose-900/40 dark:text-rose-100">
                      판매완료 처리
                    </span>
                  ) : null}
                </div>
                {/* Wave 2026-05-19 v2 (사용자 피드백): "일수익 표본 부족 · 참고용" 거의 모든 매물에 떠서 가치 없음 → 제거.
                    회수 속도 정보는 UpperFold 회수 속도 타일에서 보임. */}
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-400">
                  <span>매입 <span className="font-bold text-zinc-900 dark:text-zinc-100">{krw(card.price)}</span></span>
                  {/* Wave 246 (2026-05-19): explicit > 0 guard — 0 미스리딩 차단.
                     없으면 "시세 확인중" 보여서 사용자가 추정 데이터임을 인지. */}
                  {card.marketBasis?.medianPrice && card.marketBasis.medianPrice > 0 ? (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span>시세 <span className="font-bold text-zinc-900 dark:text-zinc-100">{krw(card.marketBasis.medianPrice)}</span></span>
                      {sourceBadge ? (
                        sourceBadge.tone === "reference"
                          ? <DanawaSourceBadge label={sourceBadge.label} />
                          : <BunjangSourceBadge label={sourceBadge.label} />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200" title="시세 표본 부족 또는 갱신중 — 차익은 추정치">
                        시세 확인중
                      </span>
                    </>
                  )}
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  {/* 2026-05-20 P0-Upload: 셀러 등록 시점 우선. 검증 시점은 title hover로 강등. */}
                  <span className="text-zinc-500" title={uploadAgoLabel(card.firstSeenAt) ? `데이터 ${freshLabel(card.freshSeconds)}` : undefined}>
                    {uploadAgoLabel(card.firstSeenAt) ?? freshLabel(card.freshSeconds)}
                  </span>
                  {card.optionBaseAssumed && card.optionBaseAssumed.length > 0 ? (
                    <span
                      title={`옵션 명시 안 됨 → SKU 기본 옵션 가정`}
                      className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      기본 옵션 가정
                    </span>
                  ) : null}
                </div>

                {/* Wave 394.5.a.fix (사용자 짚음 — "토글 어디있어?"): 메타 line 안 작은 chip 묻힘.
                    별도 row + emerald 강조로 옮김. 일반인 친화 디폴트는 유지 (simple), 토글이 또렷이 보임. */}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 hover:shadow dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                    title={mode === "simple" ? "더 자세한 정보 보기 (계산식 + 비교 매물 12개 + 신뢰도 분해)" : "간단하게 보기"}
                  >
                    {mode === "simple" ? (
                      <>
                        <span aria-hidden="true">🔍</span>
                        <span>상세 보기</span>
                        <span className="font-medium text-emerald-600/70 dark:text-emerald-400/70">— 계산식 · 비교 12개</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">←</span>
                        <span>간단 보기</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Wave 394.6.b.fix2 (사용자 정확 지적): 비교 매물 = "이 시세 진짜야?" 직빵 증명.
                    차익 헤드라인 직후 위치 — 외부 review #7 "3. 데이터 믿을 만한가" 핵심 신호.
                    "데이터 믿을 만한가? 의 측면에서 직빵으로 active 매물 중 비교매물 보여주는게 직빵.
                     시세가 진짜인지가 비교매물로 제일 증명." */}
                <ComparableListingsPanel card={card} mode={mode} />

                {/* Wave 392+393.2: "왜 싸지" 작은 inline note — 보조 정보 톤. */}
                <WhyCheapPanel card={card} />
                <UpperFoldFearReducers card={card} />
                {/* Wave 394.6.b (외부 review #7): 정보 순서 재정렬 — 사용자 판단 흐름 따름.
                    "1. 사도 되나 → 2. 얼마 남나 → 3. 데이터 믿을 만? → 4. 위험? → 5. 깎기 → 6. 어디 팔까".
                    가품/리스크 위로 (구매 결정 핵심), 채널 비교 아래로 (판매 결정). */}
                <CounterfeitChecklistPanel card={card} />
                <CostAssurancePanel card={card} />
                {/* Wave 392.3: 진입장벽/불안감 해소 Q&A — 4개 자주 묻는 거 collapse. */}
                <WhyTrustCollapse card={card} />
                {/* Wave 394.6.b: 채널 비교 → SellHelper 위 (둘 다 "판매" 관련 단위). */}
                <PlatformProfitCompare card={card} />
                {/* Wave 393.6: SellerTrustPanel 제거 — UpperFoldFearReducers 셀러 tile +
                    WhyTrustCollapse Q&A에 셀러 정보 이미 있음. 3중 중복 해소. */}
                <SellHelperPanel card={card} currentFeedbackType={currentFeedbackType} />
              </div>
              <RecommendationReasonPanel
                card={card}
                className="mt-2 border-t border-[#e1dacd] pt-2 sm:rounded-xl sm:border sm:p-3 sm:shadow-none sm:ring-0"
              />
            </div>
            {/* Wave 394.5.c: detailed 모드 시 신뢰도 분해 자동 펼침 (사용자 재닫음 가능). */}
            <details
              open={mode === "detailed"}
              className="group hidden shrink-0 rounded-full border border-[#d9e5d7] bg-[#f4faf1] px-3 py-1 text-right shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:block sm:min-w-[72px]"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-zinc-400">
                  <span>신뢰</span>
                  <span className="text-zinc-300 transition group-open:rotate-180 dark:text-zinc-500">▾</span>
                </div>
                <div className="text-sm font-black text-[#314238] dark:text-zinc-100">
                  {Math.round(card.confidence * 100)}%
                </div>
              </summary>
              <ConfidenceBreakdown card={card} />
            </details>
          </div>

        <div className="hidden sm:block">
          <VerdictBadgesMini card={card} />
        </div>

        {/* 2026-05-16 (사용자 코멘트 #110 후속): 헷갈림 안내 — Lightning vs USB-C 가격 동일 같은 사실. */}
        {/* catalog Sku.confusionNote 그대로 표시. 사용자가 매물 보고 헷갈리면 즉시 답. */}
        {card.confusionNote ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            {card.confusionNote}
          </div>
        ) : null}

        {/* 시세 근거 (요약) — desktop/tablet 카드. mobile은 "왜 이 상품을 추천했나요?" 안으로 접어 첫 화면 밀도를 낮춤. */}
        <div className="hidden sm:block">
          <MarketBasisMini card={card} />
        </div>
      </div>
      </div>
      {/* 좌측 카드 닫음 — 우측 카드 = 시세 그래프 + 디테일. */}

      {/* 우측 카드 — 시세 그래프 + 회전/유입 (시각 강조). */}
      <div className="order-2 space-y-2 px-3 sm:mx-0 sm:rounded-2xl sm:border sm:border-[#dfd6c9] sm:bg-[linear-gradient(180deg,#fffdf9_0%,#fbf7ef_100%)] sm:p-3 sm:shadow-[0_16px_34px_rgba(49,66,56,0.08)] sm:ring-1 sm:ring-white/70 sm:dark:border-zinc-800 sm:dark:bg-none sm:dark:bg-zinc-900 sm:dark:ring-zinc-800/70 lg:order-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-black uppercase tracking-widest text-[#5d735f] dark:text-emerald-400">
            시세 그래프 · 시장 분석
          </div>
          <span className="rounded-full bg-[#eef6ec] px-2 py-0.5 text-[10px] font-black text-[#4f6a52] ring-1 ring-[#d8e2d7] dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
            {/* Wave 394.1 (외부 review #19): "실시간" 과장 — 표본 부족 / 호가 추정인데 "실시간"이라 신뢰 역효과. */}
            최신 수집 기준
          </span>
        </div>

        {/* Wave 394.6.b.fix2 (사용자 재지적): 비교 매물 → 좌측 카드 안으로 이동 (차익 헤드라인 직후).
            "데이터 믿을 만한가? 의 측면에서 직빵으로 비교매물 보여주는게 active 매물 중에서 직빵.
             일단 시세가 진짜인지가 비교매물로 제일 증명." — 사용자 짚음.
            우측 카드 (자세한 그래프 추이) 와 분리 — 좌측 카드 = 매물 정보 + 시세 신뢰 증명. */}
        {/* ComparableListingsPanel 호출 = 좌측 카드 안 (차익 메타 line 다음). 우측 카드에선 제거. */}

        {/* 2026-05-15: 시세 30일 추이 chart (active/sold median). 사용자 베타테스터 질문 응답 — */}
        {/* "시세 어떤 기준으로 잡나" 시각화. history 부족하면 자동 hide. */}
        {/* 2026-05-16 (코멘트 id 105): conditionClass 전달 → 그래프도 같은 condition 매물 기준. */}
        <MarketHistoryChart
          comparableKey={card.marketBasis?.comparableKey ?? null}
          currentPrice={card.price}
          conditionClass={card.marketBasis?.conditionClass ?? null}
          priceSource={card.marketBasis?.priceSource ?? null}
          referencePrice={card.marketBasis?.priceSource === "reference" ? card.marketBasis?.medianPrice ?? null : null}
        />
        <MarketGraphTrustLine card={card} />

        <SkuListingFlowMini card={card} />
      </div>
      {/* 우측 카드 (시세 분석) 닫음. */}

    </div>
  );
}

function GuidePreviewPanel({
  card,
  guide,
  loading,
  error,
  onClose,
}: {
  card: RevealCard;
  guide: ModelGuide | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="flex max-h-[calc(100vh-24px)] items-center justify-center overflow-hidden rounded-2xl border border-[#ddd6ca] bg-[#fffdf9] p-6 shadow-2xl shadow-[rgba(49,66,56,0.16)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-300">공략 정보를 정리하는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex max-h-[calc(100vh-24px)] overflow-hidden rounded-2xl border border-[#ddd6ca] bg-[#fffdf9] shadow-2xl shadow-[rgba(49,66,56,0.16)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex min-h-0 w-full flex-col">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-sm font-black text-[var(--brand-accent-strong)] dark:text-zinc-100">공략 정보를 아직 불러오지 못했어요</div>
            <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{error}</p>
          </div>
          <div className="p-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-[#d5dfd2] bg-white px-4 py-3 text-center text-sm font-bold text-[var(--brand-accent-strong)] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ModelGuidePanel
      guide={guide}
      cardName={card.name}
      onClose={onClose}
    />
  );
}

function ModalActionFooter({
  card,
  onFeedback,
  currentFeedbackType,
  onReportLoss,
  alreadyReportedLoss,
}: {
  card: RevealCard;
  onFeedback: (pid: number, feedbackType: RevealFeedbackType, note?: string) => void;
  currentFeedbackType?: string | null;
  onReportLoss?: (card: RevealCard) => void;
  alreadyReportedLoss?: boolean;
}) {
  const [localStatus, setLocalStatus] = useState<TransactionFeedbackType | null>(
    isTransactionFeedbackType(currentFeedbackType) ? currentFeedbackType : null,
  );

  useEffect(() => {
    setLocalStatus(isTransactionFeedbackType(currentFeedbackType) ? currentFeedbackType : null);
  }, [currentFeedbackType, card.pid]);

  function handleTransactionFeedback(type: TransactionFeedbackType, note: string) {
    setLocalStatus(type);
    onFeedback(card.pid, type, note);
  }

  const statusLabel = localStatus ? TRANSACTION_STATUS_LABEL[localStatus] : "진행 전";

  return (
    <div className="rounded-2xl border border-[#e7dece] bg-[#fffdf9] p-2 dark:border-zinc-800 dark:bg-zinc-900 sm:p-3">
      <div className="sm:hidden">
        <div className="flex items-center gap-1.5">
          <details className="group relative min-w-0 flex-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-[#d8d2c6] bg-white/85 px-2.5 py-1.5 text-[11px] font-bold text-[#425247] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              <span>거래 상태</span>
              <span className="truncate text-[var(--brand-accent-strong)] dark:text-zinc-200">{statusLabel}</span>
            </summary>
            <div className="absolute inset-x-0 bottom-[calc(100%+8px)] z-20 rounded-xl border border-[#e1dacd] bg-[#fffdf9] p-2 shadow-2xl shadow-[rgba(49,66,56,0.18)] dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#758174] dark:text-zinc-400">
                  거래 상태
                </span>
                <span className="text-[11px] font-bold text-[var(--brand-accent-strong)] dark:text-zinc-200">
                  {statusLabel}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {TRANSACTION_ACTIONS.map((action) => {
                  const active = localStatus === action.type;
                  return (
                    <button
                      key={action.type}
                      type="button"
                      onClick={() => handleTransactionFeedback(action.type, action.note)}
                      className={`rounded-lg border px-2 py-2 text-[11px] font-black transition ${
                        active
                          ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,66,56,0.18)]"
                          : "border-[#d8d2c6] bg-[#fffdf9] text-[#425247] hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>
              {isPostBuyFeedbackType(localStatus) && (
                <div className="mt-2 border-t border-[#ebe4d8] pt-2 dark:border-zinc-800">
                  <div className="mb-1.5 text-[10px] font-bold text-[#758174] dark:text-zinc-400">
                    매수 후 진행
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {POST_BUY_ACTIONS.map((action) => {
                      const active = localStatus === action.type;
                      return (
                        <button
                          key={action.type}
                          type="button"
                          onClick={() => handleTransactionFeedback(action.type, action.note)}
                          className={`rounded-lg border px-2 py-2 text-[11px] font-black transition ${
                            active
                              ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,66,56,0.18)]"
                              : "border-[#d8d2c6] bg-[#fffdf9] text-[#425247] hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </details>
          {onReportLoss && (
            <button
              type="button"
              onClick={() => onReportLoss(card)}
              disabled={alreadyReportedLoss}
              title={alreadyReportedLoss ? "이미 신고됨 — 운영자 검수 진행 중" : "부정확 정보 신고하기 — 승인 시 토큰 +3"}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                alreadyReportedLoss
                  ? "cursor-not-allowed border-zinc-300 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                  : "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
              }`}
            >
              {alreadyReportedLoss ? "신고됨" : "오류 신고"}
            </button>
          )}
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="mb-2 rounded-xl border border-[#e1dacd] bg-white/85 p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#758174] dark:text-zinc-400">
              거래 상태
            </span>
            <span className="text-[11px] font-bold text-[var(--brand-accent-strong)] dark:text-zinc-200">
              {localStatus ? TRANSACTION_STATUS_LABEL[localStatus] : "아직 진행 전"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {TRANSACTION_ACTIONS.map((action) => {
              const active = localStatus === action.type;
              return (
                <button
                  key={action.type}
                  type="button"
                  onClick={() => handleTransactionFeedback(action.type, action.note)}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-black transition ${
                    active
                      ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,66,56,0.18)]"
                      : "border-[#d8d2c6] bg-[#fffdf9] text-[#425247] hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
          {isPostBuyFeedbackType(localStatus) && (
            <div className="mt-2 border-t border-[#ebe4d8] pt-2 dark:border-zinc-800">
              <div className="mb-1.5 text-[10px] font-bold text-[#758174] dark:text-zinc-400">
                매수 후 진행
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {POST_BUY_ACTIONS.map((action) => {
                  const active = localStatus === action.type;
                  return (
                    <button
                      key={action.type}
                      type="button"
                      onClick={() => handleTransactionFeedback(action.type, action.note)}
                      className={`rounded-lg border px-2 py-2 text-[11px] font-black transition ${
                        active
                          ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,66,56,0.18)]"
                          : "border-[#d8d2c6] bg-[#fffdf9] text-[#425247] hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {onReportLoss && (
          <button
            type="button"
            onClick={() => onReportLoss(card)}
            disabled={alreadyReportedLoss}
            title={alreadyReportedLoss ? "이미 신고됨 — 운영자 검수 진행 중" : "부정확 정보 신고하기 — 승인 시 토큰 +3"}
            className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-black leading-none transition ${
              alreadyReportedLoss
                ? "cursor-not-allowed border-zinc-300 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                : "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
            }`}
          >
            {alreadyReportedLoss ? "신고 완료 — 검수 중" : "정보 오류 신고 · 승인 시 +3"}
          </button>
        )}
      </div>
    </div>
  );
}

function FixedBunjangFooter({
  card,
  onLinkClicked,
}: {
  card: RevealCard;
  onLinkClicked: (pid: number) => void;
}) {
  // Wave 333 (사용자 피드백): 안전도("주의 1건") 버튼 제거 — 모달 안 셀러 카드/거래 안전 타일에 이미 있음.
  // 하단 fixed는 번개장터 이동 버튼만 풀 너비로.
  // Wave 394.1 (외부 review #6): CTA 문구 "번개장터에서 확인하기" 의미 불명확
  // (구매? 판매? 채널 추천?) → "번개장터 원본 매물 보기" 액션 명확화.
  // Wave 394.7 (외부 review #5): "정보 앱인데 광고 랜딩페이지 같음. 모바일 분석 내용 읽는 공간 줄어듦".
  // 사이즈 ↓ — py-3 → py-2.5, text-sm → text-[13px], shadow-lg → shadow-md, ring-1 제거.
  // min-h-11 (iOS 44px tap target) 유지. brand color 유지 (핵심 액션 색은 강조).
  return (
    <div className="shrink-0 border-t border-[#e7dece] bg-[#fffdf9]/95 p-1.5 shadow-[0_-10px_24px_rgba(49,66,56,0.10)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:p-2">
      <a
        href={card.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => onLinkClicked(card.pid)}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#00a862] bg-[#00c471] px-3 py-2.5 text-center text-[13px] font-bold text-white shadow-md shadow-[rgba(0,196,113,0.22)] transition hover:bg-[#00b267]"
      >
        <BunjangLogo className="h-[16px] w-[16px] rounded-[4px]" />
        번개장터 원본 매물 보기
      </a>
    </div>
  );
}

function RelatedRevealStrip({
  items,
  onBeforeOpenRelatedItem,
  onOpenRelatedItem,
}: {
  items: RelatedRevealItem[];
  onBeforeOpenRelatedItem?: () => void;
  onOpenRelatedItem?: (pid: number) => void;
}) {
  const visibleItems = items.slice(0, 8);
  if (visibleItems.length === 0 || !onOpenRelatedItem) return null;

  return (
    // Wave 366: 카드 박스 제거 → /me 피드 톤 (divider만 + 사진 크게 120px).
    <section className="mt-4 px-3 sm:px-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          다른 추천 매물
        </div>
        <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
          {visibleItems.length}개
        </span>
      </div>
      <div className="-mx-3 divide-y divide-zinc-100 dark:divide-zinc-800 sm:mx-0">
        {visibleItems.map((item) => {
          // Wave 246: medianPrice=0/null 이면 출처 배지 의미 없음.
          const hasMedian = !!(item.marketBasis?.medianPrice && item.marketBasis.medianPrice > 0);
          const sourceBadge = !hasMedian
            ? null
            : item.marketBasis?.priceSource === "reference"
              ? { tone: "reference" as const, label: "다나와" }
              : item.marketBasis?.conditionClass === "mint"
                ? { tone: "mint" as const, label: "번개 S급" }
                : null;
          return (
            <button
              key={item.pid}
              type="button"
              onClick={() => {
                onBeforeOpenRelatedItem?.();
                onOpenRelatedItem(item.pid);
              }}
              className="grid w-full min-w-0 grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-4 text-left transition active:bg-zinc-50 dark:active:bg-zinc-900/40"
            >
              <div className="relative aspect-square shrink-0 overflow-hidden rounded-lg bg-[#f2eadf] dark:bg-zinc-800">
                <ConditionPhotoBadge conditionClass={item.marketBasis?.conditionClass ?? null} compact />
                {item.thumbnailUrl ? (
                  <Image
                    src={item.thumbnailUrl}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                    사진 없음
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="line-clamp-2 text-sm font-bold leading-tight text-zinc-900 dark:text-zinc-50">
                  {item.name}
                </div>
                <div className="mt-1.5">
                  <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {profitRange(item.expectedProfitMin, item.expectedProfitMax)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  <span>매입 <b className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{krw(item.price)}</b></span>
                  {item.marketBasis?.medianPrice && item.marketBasis.medianPrice > 0 ? (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-600">·</span>
                      <span>시세 <b className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{krw(item.marketBasis.medianPrice)}</b></span>
                      {sourceBadge ? (
                        sourceBadge.tone === "reference"
                          ? <DanawaSourceBadge label={sourceBadge.label} />
                          : <BunjangSourceBadge label={sourceBadge.label} />
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function PackRevealModal({
  open,
  band: _band,
  loading,
  result,
  initialPreviewCard,
  initialPreviewMode = "listing",
  initialPreviewSeed,
  onClose,
  onLinkClicked,
  onFeedback,
  currentFeedbackType,
  onLoadDetail,
  relatedItems = [],
  onOpenRelatedItem,
  onReportLoss,
  alreadyReportedLoss,
  onLoadGuide,
  renderGuidePanel,
  onRetry,
}: Props) {
  const [previewCard, setPreviewCard] = useState<RevealCard | null>(null);
  const [previewGuide, setPreviewGuide] = useState<ModelGuide | null>(null);
  const [previewGuideLoading, setPreviewGuideLoading] = useState(false);
  const [previewGuideError, setPreviewGuideError] = useState<string | null>(null);
  const [previewSide, setPreviewSide] = useState<PreviewSide>("right");
  const consumedInitialPreviewSeedRef = useRef<string | number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const photoRef = useRef<HTMLDivElement | null>(null);
  // Wave 364: 사진이 viewport에 보이면 floating nav (icon-only), 안 보이면 sticky nav bar.
  const [photoVisible, setPhotoVisible] = useState(true);
  const activeRevealPid = result?.result === "success" ? result.reveals[0]?.pid ?? null : null;

  // 사진 영역 IntersectionObserver — scrollAreaRef 안에서 사진 visibility 추적.
  useEffect(() => {
    if (!open || activeRevealPid == null) return;
    const photoEl = photoRef.current;
    const scrollEl = scrollAreaRef.current;
    if (!photoEl || !scrollEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPhotoVisible(entry.isIntersecting),
      { root: scrollEl, threshold: 0.1 },
    );
    observer.observe(photoEl);
    return () => observer.disconnect();
  }, [open, activeRevealPid]);

  const resetDetailScroll = useCallback((behavior: ScrollBehavior = "auto") => {
    const node = scrollAreaRef.current;
    if (!node) return;
    node.scrollTop = 0;
    node.scrollTo({ top: 0, behavior });
  }, []);

  // Wave 76: loading 종료 후 LoadingStage를 잠깐 더 보여줘서 100% 도달 + smooth
  // 카드 reveal. 이전엔 응답 도착 시 중간 % 상태에서 갑자기 카드 노출됐음.
  const [displayLoading, setDisplayLoading] = useState(loading);
  const [completing, setCompleting] = useState(false);
  useEffect(() => {
    if (loading) {
      setDisplayLoading(true);
      setCompleting(false);
      return;
    }
    if (!displayLoading) return;
    setCompleting(true);
    const id = window.setTimeout(() => {
      setDisplayLoading(false);
      setCompleting(false);
    }, 500);
    return () => window.clearTimeout(id);
  }, [loading, displayLoading]);

  const closePreviewPanel = useCallback(() => {
    setPreviewCard(null);
    setPreviewGuide(null);
    setPreviewGuideLoading(false);
    setPreviewGuideError(null);
  }, []);

  const handleClose = useCallback(() => {
    closePreviewPanel();
    onClose();
  }, [closePreviewPanel, onClose]);

  const handlePreviewGuide = useCallback((card: RevealCard, side: PreviewSide) => {
    setPreviewCard(card);
    setPreviewSide(side);
    setPreviewGuide(null);
    setPreviewGuideError(null);

    if (!onLoadGuide) {
      setPreviewGuide(findModelGuide({
        skuId: card.skuId,
        comparableKey: card.marketBasis.comparableKey,
        skuName: card.skuName,
        name: card.name,
      }));
      setPreviewGuideLoading(false);
      return;
    }

    setPreviewGuideLoading(true);
    void onLoadGuide(card)
      .then((guide) => {
        setPreviewGuide(guide);
      })
      .catch((err) => {
        console.error("[pack-reveal-modal] preview guide load failed", err);
        setPreviewGuideError("공략 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => setPreviewGuideLoading(false));
  }, [onLoadGuide]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, handleClose]);

  // Wave 81: 모달 열림 시 body scroll lock. 모바일에서 백드롭 너머 스크롤 +
  // 터치 click-through 방지. iOS Safari 호환 위해 position fixed + 복원 패턴.
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open || loading || !result || result.result !== "success") return;
    if (!initialPreviewCard || initialPreviewSeed == null) return;
    if (consumedInitialPreviewSeedRef.current === initialPreviewSeed) return;

    consumedInitialPreviewSeedRef.current = initialPreviewSeed;
    // Wave 218: 상품 보기에서는 개발자용 상세 패널을 열지 않는다. 단, /me lazy
    // market analysis는 onLoadDetail 응답에 같이 오므로 백그라운드로만 호출한다.
    void onLoadDetail(initialPreviewCard.pid).catch((err) => {
      console.error("[pack-reveal-modal] lazy detail analysis load failed", err);
    });
    queueMicrotask(() => {
      if (initialPreviewMode === "guide") {
        handlePreviewGuide(initialPreviewCard, "right");
      }
    });
  }, [
    open,
    loading,
    result,
    initialPreviewCard,
    initialPreviewMode,
    initialPreviewSeed,
    handlePreviewGuide,
    onLoadDetail,
  ]);

  useLayoutEffect(() => {
    if (!open || activeRevealPid == null) return;
    resetDetailScroll("auto");
    const frame = window.requestAnimationFrame(() => resetDetailScroll("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [open, activeRevealPid, initialPreviewSeed, resetDetailScroll]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-stretch justify-stretch overscroll-contain bg-[#fffdf9] p-0 dark:bg-zinc-950 sm:items-center sm:justify-center sm:bg-[rgba(31,40,34,0.48)] sm:p-6 sm:backdrop-blur-sm sm:dark:bg-[rgba(9,9,11,0.62)]"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!loading) handleClose();
      }}
    >
      <div
        className="relative flex h-dvh max-h-dvh w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-[#fffdf9] shadow-none dark:bg-zinc-900 sm:h-auto sm:max-h-[88vh] sm:max-w-6xl sm:rounded-2xl sm:border sm:border-[#ddd6ca] sm:shadow-2xl sm:shadow-[rgba(49,66,56,0.16)] sm:dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wave 360+361+362+364: 당근식 nav 유기적 전환.
            사진 보일 때 → floating icon (drop-shadow on photo).
            사진 사라지면 → sticky nav bar (cream 배경 + border + zinc icon). */}
        {!loading ? (
          <>
            {/* (A) Floating icon nav — 사진 위 */}
            <div
              className={`pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1 transition-opacity duration-200 sm:left-4 sm:top-4 ${
                photoVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <button
                type="button"
                onClick={handleClose}
                aria-label="뒤로가기"
                tabIndex={photoVisible ? 0 : -1}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center text-white transition active:scale-90"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleClose}
                aria-label="대시보드로"
                tabIndex={photoVisible ? 0 : -1}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center text-white transition active:scale-90"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <path d="M9 22V12h6v10" />
                </svg>
              </button>
            </div>

            {/* (B) Sticky nav bar — 사진 사라지면 등장 */}
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 z-30 border-b border-[#e2dbcf] bg-[#fffdf9]/95 backdrop-blur transition-opacity duration-200 dark:border-zinc-800 dark:bg-zinc-900/95 ${
                photoVisible ? "opacity-0" : "opacity-100"
              }`}
            >
              <div className="flex items-center gap-1 px-3 py-2 sm:px-4">
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="뒤로가기"
                  tabIndex={photoVisible ? -1 : 0}
                  className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center text-zinc-900 transition hover:bg-zinc-100 rounded-full active:scale-90 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="대시보드로"
                  tabIndex={photoVisible ? -1 : 0}
                  className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center text-zinc-900 transition hover:bg-zinc-100 rounded-full active:scale-90 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <path d="M9 22V12h6v10" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : null}

        <div
          key={activeRevealPid ?? "empty"}
          ref={scrollAreaRef}
          className="min-h-0 flex-1 overflow-y-auto px-0 pb-3 pt-0 sm:p-4"
        >
          {displayLoading ? (
            <div className="space-y-4 px-3 sm:px-0">
              <LoadingStage completing={completing} />
              <div className="animate-pulse">
                <RevealResultSkeleton />
              </div>
            </div>
          ) : null}

          {!displayLoading && result?.result === "success" ? (
            <div className="space-y-4">
              <div>
                {/* 2026-05-17: 각 RevealCardItem 자체가 lg:grid-cols-2 (listing card + market card).
                    outer grid 는 1 column — 한 줄에 1 매물 (= 2 카드 옆에). */}
                <div className="grid gap-4">
                  {result.reveals.map((card, idx) => (
                    <RevealCardItem
                      key={card.pid}
                      card={card}
                      delay={idx * 250}
                      currentFeedbackType={currentFeedbackType}
                      photoRef={idx === 0 ? photoRef : undefined}
                    />
                  ))}
                </div>
              </div>
              {previewCard ? (
                <div
                  className={`fixed inset-x-3 bottom-3 top-12 z-[70] sm:inset-x-auto sm:bottom-4 sm:top-4 sm:w-[min(460px,calc(100vw-32px))] ${
                    previewSide === "left" ? "sm:left-4" : "sm:right-4"
                  }`}
                >
                  {renderGuidePanel ? (
                    renderGuidePanel({
                      card: previewCard,
                      guide: previewGuide,
                      loading: previewGuideLoading,
                      error: previewGuideError,
                      onClose: closePreviewPanel,
                    })
                  ) : (
                    <GuidePreviewPanel
                      card={previewCard}
                      guide={previewGuide}
                      loading={previewGuideLoading}
                      error={previewGuideError}
                      onClose={closePreviewPanel}
                    />
                  )}
                </div>
              ) : null}
              <RelatedRevealStrip
                items={relatedItems}
                onBeforeOpenRelatedItem={() => resetDetailScroll("auto")}
                onOpenRelatedItem={onOpenRelatedItem}
              />
              {result.reveals[0] ? (
                <ModalActionFooter
                  card={result.reveals[0]}
                  onFeedback={onFeedback}
                  currentFeedbackType={currentFeedbackType}
                  onReportLoss={onReportLoss}
                  alreadyReportedLoss={alreadyReportedLoss}
                />
              ) : null}
              <details className="border-t border-[#e5dccf] pt-3 text-[11px] font-semibold leading-5 text-[#7a8478] dark:border-zinc-800 dark:text-zinc-500">
                <summary className="cursor-pointer list-none font-black text-[#647064] dark:text-zinc-400">
                  시세 추천 유의사항
                </summary>
                <div className="mt-1.5 space-y-1">
                  <div>
                    상품 {result.attemptedCount}건 검증 → {result.reveals.length}건 추천 · {(result.durationMs / 1000).toFixed(1)}초
                  </div>
                  <div>같은 전체 본품 기준으로만 비교하고, 단품/본체만/케이스만은 제외합니다.</div>
                  <div>
                    AI 기반 시세 추천이며 수익을 보장하지 않습니다. 표시된 차익은 <b>해당 가격에 정상 판매됐을 때 추정 수익</b>이고,
                    실제 거래는 매입가 협상·판매 시점·시세 변동·구성품 차이로 달라질 수 있습니다.
                  </div>
                </div>
              </details>
            </div>
          ) : null}

          {!displayLoading && result?.result === "refunded" ? (
            <div className="space-y-4 py-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="text-base font-bold">검증 실패 — 크레딧 {result.tokensRefunded}개 환불됨</div>
                <p className="mt-2 text-sm">{result.reason}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-700"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : null}

          {!displayLoading && result?.result === "unavailable" ? (
            <div className="space-y-4 py-6">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
                <div className="text-base font-bold">현재 재고 부족</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{result.reason}</p>
                {/* Wave 106: dead-end 방지. unavailable은 토큰 차감 X (atomic RPC amount=0)이라
                    재시도 안전. 새 매물이 풀에 들어왔을 가능성 + 다른 등급도 시도 가능. */}
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  잠시 후 새 매물이 풀에 들어올 수 있어요. 다시 시도하거나 다른 등급을 열어보세요.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-700"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {!displayLoading && result?.result === "success" && result.reveals[0] ? (
          <FixedBunjangFooter
            card={result.reveals[0]}
            onLinkClicked={onLinkClicked}
          />
        ) : null}
      </div>
    </div>
  );
}

export type { RevealResult };
