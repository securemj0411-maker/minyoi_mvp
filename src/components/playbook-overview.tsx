"use client";

import { useEffect, useRef, useState } from "react";

type Tone = "default" | "good" | "warn" | "highlight";

type Block =
  | { kind: "p"; text: string }
  | { kind: "intro"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "checklist"; items: string[] }
  | { kind: "callout"; tone: Tone; text: string }
  | {
      kind: "table";
      headers: string[];
      rows: { tone?: Tone; cells: string[] }[];
    };

type Section = {
  id: string;
  number: number;
  title: string;
  short: string; // TOC chip 라벨 (짧게)
  blocks: Block[];
};

const SECTIONS: Section[] = [
  {
    id: "card-info",
    number: 1,
    title: "득템잡이 카드는 이런 정보를 보여줘요",
    short: "카드 보는 법",
    blocks: [
      {
        kind: "intro",
        text: "추천 카드에 나오는 숫자와 라벨은 단순 정보가 아니라 \"이 매물 사도 될까?\" 결정 도구입니다. 어떻게 읽는지 알면 같은 매물도 다르게 보여요.",
      },
      {
        kind: "list",
        items: [
          "보통 시세 — 같은 모델 매물들이 최근 얼마에 팔렸나",
          "이 매물 가격이 어디쯤? — 보통 가격보다 싼지 비슷한지 비싼지",
          "가격이 들쭉날쭉한지 — 어떤 모델은 시세 거의 고정, 어떤 모델은 매물마다 큰 차이",
          "판매자 등급 — 거래 횟수 + 평점 + 후기 수",
          "올라온 지 얼마 — 방금 올라온 건지 오래된 건지",
        ],
      },
      {
        kind: "p",
        text: "이 다섯 가지 조합으로 \"지금 사야 할까, 기다려야 할까\" 판단할 수 있어요.",
      },
    ],
  },
  {
    id: "seller-trust",
    number: 2,
    title: "판매자 등급이 가장 중요한 힌트",
    short: "판매자 등급",
    blocks: [
      {
        kind: "intro",
        text: "거래 많이 하고 평점 높은 판매자는 시장 시세를 잘 알고 가격 매겨요. 그래서 같은 \"싼 가격\"이라도 누가 올렸냐에 따라 의미가 정반대입니다.",
      },
      {
        kind: "table",
        headers: ["판매자 등급", "가격", "어떻게 봐야 하나"],
        rows: [
          { cells: ["좋은 판매자", "보통 시세대로", "정상가, 안전. 가격 흥정 어려움"] },
          {
            tone: "good",
            cells: [
              "좋은 판매자",
              "보통보다 싸게",
              "진짜 좋은 기회. 일부러 빨리 팔려고 싸게 올린 것 — 놓치면 안 됨",
            ],
          },
          {
            tone: "warn",
            cells: [
              "거래 거의 없는 판매자",
              "너무 싸게",
              "사기 가능성. 직접 한 번 더 확인",
            ],
          },
          { cells: ["거래 거의 없는 판매자", "보통 가격", "경험 적은 판매자, 흥정 여지 있음"] },
          { cells: ["좋은 판매자 + 업자", "보통보다 비싸게", "업자 매물. 보증 가능 / 가격 ↑"] },
        ],
      },
      {
        kind: "callout",
        tone: "highlight",
        text: "기억할 점: 좋은 판매자가 싸게 올렸으면 진짜 좋은 매물. 모르는 판매자가 싸게 올렸으면 의심부터. 판매자 신뢰도가 가격 시그널을 해석하는 기준이에요.",
      },
    ],
  },
  {
    id: "speed-matters",
    number: 3,
    title: "싼 매물은 빨리 사라져요 — 호가가 올라요",
    short: "싼 매물은 시간 게임",
    blocks: [
      { kind: "intro", text: "중고 거래에서 일어나는 시간 게임 메커니즘:" },
      {
        kind: "list",
        items: [
          "보통 시세보다 싼 매물이 올라옴",
          "다른 사람들도 보고 빨리 삽니다 (30분 ~ 몇 시간)",
          "그 매물이 팔리고 나면 다음 매물들이 그 가격 위로 올라옴 — 시장이 호가를 밀어올림",
          "즉 지금 싼 매물을 놓치면 다음 매물도 더 비싸게 사야 함",
        ],
      },
      {
        kind: "p",
        text: "우리가 자주 보는 패턴 — 보통 시세보다 10~15% 싼 매물은 평균 1~3시간 안에 거래 완료. 20% 이상 싼 매물은 30분 안에 사라집니다.",
      },
      {
        kind: "callout",
        tone: "highlight",
        text: "그래서 망설이면 그 매물뿐 아니라 시세까지 놓칩니다. 빨리 보고 빨리 결정.",
      },
    ],
  },
  {
    id: "pro-plan",
    number: 4,
    title: "프로 플랜이 진짜 도움 되는 5가지 상황",
    short: "프로 플랜 활용",
    blocks: [
      {
        kind: "intro",
        text: "실시간 알람이 돈으로 직결되는 케이스:",
      },
      {
        kind: "list",
        items: [
          "인기 모델 깊은 할인 매물 — 보통 30분 안에 팔리니까 알람 없으면 못 잡습니다",
          "새 모델 나오기 직전 구 모델 급매 — 1~2주 안에 시세 10~20% 뚝 떨어짐. 알람으로 매도 타이밍 잡기",
          "평일 밤 / 주말 새벽 등록 — 보는 사람 적은 시간 → 깎인 가격으로 올라오는 경우 많음",
          "시세보다 훨씬 싼 튀는 매물 — 한 달에 한두 번 나오는 진짜 기회",
          "희소 모델 (카메라, 단종 제품) — 거래량 적어 한 달에 1~2개만. 놓치면 다음 매물까지 오래 기다림",
        ],
      },
      {
        kind: "callout",
        tone: "good",
        text: "기본 플랜은 \"후보 매물 시세 확인\" 용도. 실제 수익은 알람 + 즉시 결정에서 나옵니다.",
      },
    ],
  },
  {
    id: "velocity",
    number: 5,
    title: "모델 거래 속도로 성격 파악",
    short: "거래 속도",
    blocks: [
      {
        kind: "intro",
        text: "같은 종류여도 모델마다 거래 사이클이 다릅니다.",
      },
      {
        kind: "list",
        items: [
          "신상품 (출시 1년 이내) — 거래 활발, 시세 안정. 싸게 올라온 매물이 진짜 기회",
          "출시 1~3년 — 거래량 보통, 가격 천천히 하락. 팔거면 빨리, 사거면 시즌 기다리기",
          "출시 3년 넘음 — 거래량 적음, 가격 변동 큼. 놓치면 며칠~몇 주 기다려야 다음 매물",
        ],
      },
      {
        kind: "p",
        text: "거래 활발한 모델 = 자주 기회. 거래 적은 모델 = 한 번 놓치면 오래 기다림.",
      },
    ],
  },
  {
    id: "season",
    number: 6,
    title: "시즌마다 시세가 어떻게 움직이나",
    short: "시즌 효과",
    blocks: [
      {
        kind: "table",
        headers: ["시기", "효과", "어떻게 활용"],
        rows: [
          {
            tone: "warn",
            cells: [
              "새 모델 나오기 1~2주 전",
              "구 모델 시세 급락 (10~20%)",
              "팔 거면 미리. 늦으면 손해",
            ],
          },
          {
            cells: ["새 모델 나온 직후 1~3개월", "신상 시세 안정, 할인 거의 없음", "사는 건 신중. 급매 알람만 노리기"],
          },
          {
            tone: "good",
            cells: ["출시 6개월 ~ 1년 지남", "안정기, 거래량 많음", "가장 사기 좋은 시기"],
          },
          {
            cells: ["명절 / 학기 시작", "거래량 ↑, 호가 ↑", "팔기 좋음. 사는 건 시즌 끝 기다리기"],
          },
          {
            tone: "good",
            cells: ["연말 / 새해 직전", "현금화 급매 ↑", "가장 사기 좋은 시기 (2)"],
          },
        ],
      },
    ],
  },
  {
    id: "category-trust",
    number: 7,
    title: "종류별 추천 매물 신뢰도",
    short: "종류별 신뢰도",
    blocks: [
      {
        kind: "intro",
        text: "득템잡이가 자동 분류하는 정확도는 종류마다 달라요.",
      },
      {
        kind: "list",
        items: [
          "이어폰 / 시계 (애플워치, 갤럭시워치) — 모델 종류 적어 거의 100% 정확. 카드 보고 바로 결정 OK",
          "스마트폰 — 자급제 / 통신사 차이 큼. 본문에 \"자급제\" 명시되어 있는지 꼭 확인",
          "태블릿 — 셀룰러 / 와이파이 / 용량 차이 큼. 카드 옵션 라벨 한 번 더 확인",
          "노트북 — 칩 세대 (M1 / M2 / M3) / 메모리 / 저장공간 확인. 부품용 / 고장 매물 주의",
          "카메라 — \"본체만\" 표기 확인. 렌즈 / 풀박스 포함이면 가격 ↑",
          "모니터 — 단일 모델만 정확. 비슷한 모델은 매물 적음",
        ],
      },
    ],
  },
  {
    id: "vs-search",
    number: 8,
    title: "직접 검색과 비교 — 같은 매물, 다른 시간",
    short: "직접 검색 비교",
    blocks: [
      {
        kind: "intro",
        text: "득템잡이는 번개장터·중고나라·당근의 공개 매물을 기반으로 추천합니다. 같은 데이터를 직접 검색할 수도 있고, 미리 분류·검증된 결과를 받을 수도 있습니다. 차이는 결정까지 드는 시간입니다.",
      },
      {
        kind: "p",
        text: "예시 — \"에어팟 프로 2 자급제\" 검색 첫 페이지 50건을 직접 분류하면 다음과 같이 나뉩니다:",
      },
      {
        kind: "list",
        items: [
          "부품용 / 액정만 / 메인보드 — 5건",
          "케이스만 / 충전기만 — 8건",
          "매입 / 삽니다 / 구매합니다 광고 — 6건",
          "사기 의심 (거래 0건 + 시세 60% 이하) — 3건",
          "통신사 약정 / 자급제 미명시 — 7건",
          "남는 본품 매물 — 21건",
        ],
      },
      {
        kind: "p",
        text: "여기서 시세 비교 + 판매자 등급을 일일이 확인하면 약 20분이 추가됩니다. 인기 매물은 등록 후 30분 ~ 몇 시간 안에 거래가 완료되는 경우가 많아, 그 사이 시세 우위 매물 일부는 거래가 마감됩니다.",
      },
      {
        kind: "table",
        headers: ["단계", "직접 검색", "득템잡이"],
        rows: [
          { cells: ["관련 없는 매물 거르기", "10분", "자동"] },
          { cells: ["시세 비교", "10분", "자동"] },
          { cells: ["판매자 등급 확인", "5분", "자동"] },
          { cells: ["남은 매물 결정", "5분", "5분"] },
        ],
      },
      {
        kind: "callout",
        tone: "highlight",
        text: "같은 검색 결과를 두고 결정까지 약 25분 차이가 납니다.",
      },
      {
        kind: "callout",
        tone: "good",
        text: "등록 후 30분 안에 거래 완료되는 매물은 알람 없이는 잡기 어렵습니다. 시세보다 낮은 매물은 다른 사용자도 동시에 발견하므로, 실시간 알람으로 결정 시간을 확보하는 것이 차이를 만듭니다.",
      },
      {
        kind: "p",
        text: "득템잡이는 모든 매물을 보여주지 않습니다. 정확도 우선 정책에 따라 확신이 서지 않는 매물은 \"안 보여줌\"으로 처리합니다. 보여주는 추천에 대한 신뢰를 우선합니다.",
      },
    ],
  },
  {
    id: "safety",
    number: 9,
    title: "사기 / 결함 매물 피하는 추가 확인",
    short: "사기 피하는 법",
    blocks: [
      {
        kind: "intro",
        text: "득템잡이가 자동 거른 다음에도 본인이 직접 한 번 더 확인:",
      },
      {
        kind: "checklist",
        items: [
          "스마트폰이면 본문에 \"자급제\" / \"공기계\" / \"언락\" 적혀있는지",
          "사진을 판매자가 직접 찍었는지 (제품 카탈로그 사진 아닌지)",
          "판매자 거래 5건 이상 + 평균 평점 4점 이상",
          "\"직거래만\" 가능하다면 위험 — 안전결제 거부는 사기 신호",
          "시세보다 너무 싸면 판매자 프로필 다른 매물도 보기",
        ],
      },
      {
        kind: "callout",
        tone: "warn",
        text: "⚠️ 득템잡이는 추천 도구이지 사기 탐지기는 아닙니다. 마지막 확인은 본인 책임입니다.",
      },
    ],
  },
  {
    id: "pro-patterns",
    number: 10,
    title: "Pro 사용자가 실제로 쓰는 패턴",
    short: "수익 패턴",
    blocks: [
      {
        kind: "list",
        items: [
          "알람 → 빠른 결정 → 안전결제 — 망설이면 30분 안에 팔립니다. 알람 오면 바로 확인 → 결정",
          "여러 모델 분산 알람 — 한 모델만 알람 = 기회 드물어요. 3~5개 모델 분산하면 매주 기회 1~3건",
          "시세 추세 보기 — 같은 모델 시세가 1주일 동안 어떻게 움직이는지. 떨어지는 중은 보류, 오르는 중은 빠른 결정",
          "마음에 드는 판매자 follow — 거래 많고 평점 높은 판매자는 정기적으로 매물 올립니다. 같은 판매자에서 여러 번 거래 = 안전 + 협상 여지 ↑",
        ],
      },
    ],
  },
];

function ToneClass(tone: Tone | undefined): string {
  switch (tone) {
    case "good":
      return "bg-[#eef5ea] dark:bg-emerald-950/40";
    case "warn":
      return "bg-[#fbf0e1] dark:bg-amber-950/40";
    case "highlight":
      return "bg-[var(--brand-accent-soft)] dark:bg-zinc-800";
    default:
      return "";
  }
}

function CalloutClass(tone: Tone): string {
  switch (tone) {
    case "good":
      return "border-l-4 border-[#74a07a] bg-[#eef5ea] dark:border-emerald-700 dark:bg-emerald-950/40";
    case "warn":
      return "border-l-4 border-[#c79750] bg-[#fbf0e1] dark:border-amber-700 dark:bg-amber-950/40";
    case "highlight":
      return "border-l-4 border-[var(--brand-accent-strong)] bg-[var(--brand-accent-soft)] dark:border-emerald-500 dark:bg-zinc-800";
    default:
      return "border-l-4 border-[#d5d0c4] bg-[#fbf8f2] dark:border-zinc-700 dark:bg-zinc-900";
  }
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.kind) {
    case "intro":
      return (
        <p className="text-sm font-semibold leading-7 text-[#3d4a3e] dark:text-zinc-200">
          {block.text}
        </p>
      );
    case "p":
      return (
        <p className="text-sm font-semibold leading-7 text-[#525a4f] dark:text-zinc-300">
          {block.text}
        </p>
      );
    case "list":
      return (
        <ul className="space-y-2 pl-1">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 text-sm font-semibold leading-6 text-[#525a4f] dark:text-zinc-300"
            >
              <span
                aria-hidden
                className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-accent-strong)] dark:bg-emerald-500"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "checklist":
      return (
        <ul className="space-y-2 pl-1">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 text-sm font-semibold leading-6 text-[#525a4f] dark:text-zinc-300"
            >
              <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-[#9aa893] dark:border-zinc-600">
                <span className="sr-only">체크</span>
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <div
          className={`rounded-r-xl px-4 py-3 text-sm font-semibold leading-6 text-[#3d4a3e] dark:text-zinc-200 ${CalloutClass(
            block.tone,
          )}`}
        >
          {block.text}
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-[#e7dece] dark:border-zinc-800">
          <table className="w-full min-w-[480px] text-left text-xs sm:text-sm">
            <thead className="bg-[#f3eee5] text-[10px] uppercase tracking-wider text-[#5d735f] dark:bg-zinc-900 dark:text-emerald-400 sm:text-[11px]">
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-black sm:px-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={`border-t border-[#ece5d5] dark:border-zinc-800 ${ToneClass(
                    row.tone,
                  )}`}
                >
                  {row.cells.map((c, ci) => (
                    <td
                      key={ci}
                      className="px-3 py-2.5 align-top font-semibold text-[#3d4a3e] dark:text-zinc-200 sm:px-4"
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function SectionView({ section }: { section: Section }) {
  return (
    <section
      id={section.id}
      className="scroll-mt-[170px] rounded-2xl border border-[#e7dece] bg-[#fffbf4] p-4 dark:border-zinc-800 dark:bg-zinc-950/40 sm:p-6 lg:scroll-mt-[120px]"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-sm font-black text-[var(--brand-accent-strong)] dark:bg-zinc-800 dark:text-emerald-400">
          {section.number}
        </span>
        <h3 className="pt-0.5 text-base font-black leading-7 text-[#223127] dark:text-zinc-100 sm:text-lg">
          {section.title}
        </h3>
      </div>
      <div className="mt-4 space-y-4 sm:pl-11">
        {section.blocks.map((b, i) => (
          <BlockRenderer key={i} block={b} />
        ))}
      </div>
    </section>
  );
}

export default function PlaybookOverview() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0]?.id ?? "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Mobile horizontal TOC scroll container — active chip이 viewport 밖이면 자동 가운데로.
  const tocScrollRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Sticky TOC 활성 표시 — IntersectionObserver
  useEffect(() => {
    if (typeof window === "undefined") return;
    const observers: IntersectionObserver[] = [];
    const visible = new Set<string>();

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(s.id);
            else visible.delete(s.id);
          }
          // 가장 위쪽 visible section을 active로
          for (const sec of SECTIONS) {
            if (visible.has(sec.id)) {
              setActiveId(sec.id);
              break;
            }
          }
        },
        { rootMargin: "-140px 0px -60% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => {
      for (const o of observers) o.disconnect();
    };
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // activeId 변경 시 horizontal TOC scroll container 안에서 chip 가운데 정렬.
  // Mobile에서 chip이 viewport 밖이면 자동으로 보이는 위치로 이동.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const container = tocScrollRef.current;
    const chip = chipRefs.current[activeId];
    if (!container || !chip) return;
    const containerRect = container.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    // chip이 container 가시 영역 밖이면 가운데 정렬로 scroll
    const outOfView =
      chipRect.left < containerRect.left + 16 ||
      chipRect.right > containerRect.right - 16;
    if (outOfView) {
      const targetScrollLeft =
        chip.offsetLeft - container.clientWidth / 2 + chip.clientWidth / 2;
      container.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
    }
  }, [activeId]);

  return (
    <div ref={containerRef} className="space-y-5">
      <div className="rounded-[24px] border border-[#e2d9cb] bg-[#fffaf6] p-4 shadow-[0_18px_36px_rgba(34,49,39,0.06)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-6 lg:rounded-[28px]">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
          Playbook
        </p>
        <h2 className="mt-1.5 text-xl font-black tracking-tight text-[#223127] dark:text-white sm:text-2xl lg:text-3xl">
          중고 거래 공략집
        </h2>
        <p className="mt-2 max-w-2xl text-xs font-semibold leading-6 text-[#687366] dark:text-zinc-400 sm:text-sm">
          득템잡이를 활용해 같은 매물도 다르게 보고, 시간 게임에서 우위를 가지는 법.
          모델별 상세는 아래 카드에서 따로 확인하세요.
        </p>
      </div>

      {/*
        Sticky TOC — stacking context 깨지지 않게 backdrop-blur / margin trick 제거.
        position: sticky 인라인 style 강제 (Tailwind 빌드 quirk fallback).
        isolation: isolate 로 자체 stacking context. z-30 < layout root nav z-40 보장.
      */}
      <div
        // Mobile: nav (60px) + dashboard menu (~52px) 아래로 → top-[112px].
        // Desktop(lg+): nav (60px) 바로 아래.
        className="sticky top-[112px] z-20 -mx-4 lg:top-[60px] lg:mx-0"
        style={{ isolation: "isolate" }}
      >
        <nav
          aria-label="공략집 목차"
          className="border-y border-[#e2d9cb] bg-[#f8f4ec] px-4 py-2 shadow-[0_8px_18px_rgba(34,49,39,0.06)] dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl sm:border sm:px-3"
        >
          <div ref={tocScrollRef} className="flex gap-1.5 overflow-x-auto pb-1">
            {SECTIONS.map((s) => {
              const active = activeId === s.id;
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    chipRefs.current[s.id] = el;
                  }}
                  type="button"
                  onClick={() => scrollTo(s.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black transition ${
                    active
                      ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] dark:bg-emerald-500 dark:text-zinc-950"
                      : "border-[#ddd4c7] bg-[#fbf8f2] text-[#344136] hover:border-[#c8d8c4] hover:bg-[var(--brand-accent-soft)] hover:text-[var(--brand-accent-strong)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      active
                        ? "bg-white/20 text-[var(--brand-cream)]"
                        : "bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)] dark:bg-zinc-800 dark:text-emerald-400"
                    }`}
                  >
                    {s.number}
                  </span>
                  <span>{s.short}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <SectionView key={s.id} section={s} />
        ))}
      </div>
    </div>
  );
}
