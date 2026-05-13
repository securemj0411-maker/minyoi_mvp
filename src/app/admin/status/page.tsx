import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

type LaneReplay = {
  lane: string;
  total: number;
  skuMatchPct: string;
  laneMatchPct: string;
  parseReadyPct: string;
  needsReviewFalsePct: string;
  unknownPartsPct: string;
  comparableKeyCompletePct: string;
  grade: string;
  nextAction: string;
};

type ExpansionRow = {
  lane: string;
  stage: string;
  reason: string;
  next: string;
};

type OwnerCandidate = {
  lane: string;
  fetched: number;
  activeClean: number;
  reviewRows: number;
  readiness: string;
  next: string;
  blocker?: string;
};

type CurrentState = {
  generatedAt: string;
  operationalHealth: {
    sourceHealth: string;
    runCount: number;
    failedRuns: number;
    failureRate: number;
    packReveal: string;
    packHealthy: boolean;
    activeReadyPool: string;
  };
  productMainline?: {
    percent?: number;
    revealCategories?: number;
    revealSkus?: number;
    narrowRevealSkus?: number;
    defaultReadySkus?: number;
    smartphoneDeterministic?: string;
    cameraState?: string;
  };
};

type FamilyParserSummary = {
  category?: string;
  generatedAt?: string;
  skuCounts?: Array<{ key: string; count: number }>;
  modelCounts?: Array<{ key: string; count: number }>;
  keyCounts?: Array<{ key: string; count: number }>;
  topComparableKeys?: Array<{ key: string; count: number }>;
};

const STAGE_LABELS: Record<string, { ko: string; emoji: string; color: string }> = {
  owner_review_ready: { ko: "실전 후보 대기", emoji: "✅", color: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  internal_candidate: { ko: "내부 후보", emoji: "🟦", color: "bg-blue-100 text-blue-900 border-blue-300" },
  internal_learning: { ko: "내부 학습 중", emoji: "🔍", color: "bg-sky-100 text-sky-900 border-sky-300" },
  ai_l2_escrow: { ko: "AI 판단 영역", emoji: "🤖", color: "bg-violet-100 text-violet-900 border-violet-300" },
  collect_only: { ko: "표본 부족", emoji: "🟡", color: "bg-amber-100 text-amber-900 border-amber-300" },
  public_ready_blocked: { ko: "공개 차단", emoji: "🚫", color: "bg-rose-100 text-rose-900 border-rose-300" },
};

const STAGE_ORDER = [
  "owner_review_ready",
  "internal_candidate",
  "internal_learning",
  "ai_l2_escrow",
  "collect_only",
  "public_ready_blocked",
];

const KO_DICT: Record<string, string> = {
  airpods: "에어팟",
  max: "맥스",
  usbc: "USB-C",
  pro: "프로",
  iphone: "아이폰",
  ipad: "아이패드",
  air: "에어",
  mini: "미니",
  galaxy: "갤럭시",
  buds: "버즈",
  ultra: "울트라",
  self: "(자급제)",
  macbook: "맥북",
  applewatch: "애플워치",
  galaxywatch: "갤럭시워치",
  watch: "워치",
  monitor: "모니터",
  camera: "카메라",
  speaker: "스피커",
  earphone: "이어폰",
  smartwatch: "스마트워치",
  laptop: "노트북",
  smartphone: "스마트폰",
  tablet: "태블릿",
  desktop: "데스크탑",
  headphone: "헤드폰",
  console: "콘솔",
  game: "게임",
  body: "본체",
  exact: "특정",
  model: "모델",
  code: "코드",
  refined: "정제",
  modelcode: "모델코드",
  wifi: "Wi-Fi",
  cellular: "셀룰러",
  discovered: "(전체)",
  m1: "M1",
  m2: "M2",
  m3: "M3",
  m4: "M4",
  m5: "M5",
  ch520: "CH520",
  xm4: "XM4",
  flip5: "Flip 5",
  flip6: "Flip 6",
  flip: "Flip",
  fold: "Fold",
  bose: "보스",
  qc: "QC",
  qc45: "QC45",
  beats: "Beats",
  solo: "솔로",
  solo4: "솔로 4",
  studio: "스튜디오",
  sony: "Sony",
  wh: "WH",
  wh1000xm4: "WH-1000XM4",
  jbl: "JBL",
  ps5: "PS5",
  slim: "슬림",
  disc: "디스크",
  digital: "디지털",
  standard: "스탠다드",
  switch: "스위치",
  oled: "OLED",
  lg: "LG",
  gram: "그램",
  benq: "벤큐",
  xl2540k: "XL2540K",
  appliance: "가전",
  home: "홈",
  tech: "기술",
  pc: "PC",
  cpu: "CPU",
  gpu: "GPU",
  used: "중고",
  private: "개인",
  positive: "양품",
  stick: "스틱",
  vacuum: "청소기",
  tab: "탭",
  s10: "S10",
  s23: "S23",
  s24: "S24",
  s25: "S25",
  z: "Z",
  unlocked: "(자급제)",
};

function toKorean(laneId: string): string {
  const parts = laneId.toLowerCase().split("_");
  const out: string[] = [];
  for (const p of parts) {
    if (KO_DICT[p]) {
      out.push(KO_DICT[p]);
    } else if (/^[0-9]+gb$/.test(p)) {
      out.push(p.replace("gb", "GB"));
    } else if (/^[0-9]+in$/.test(p)) {
      out.push(p.replace("in", "인치"));
    } else if (/^[0-9]+$/.test(p)) {
      out.push(p);
    } else {
      out.push(p.toUpperCase());
    }
  }
  return out.join(" ");
}

const REPORTS = path.join(process.cwd(), "reports");

async function loadJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(path.join(REPORTS, file), "utf8");
    return JSON.parse(buf) as T;
  } catch {
    return fallback;
  }
}

function diagnose(
  row: ExpansionRow,
  replay: LaneReplay | undefined,
): { headline: string; sub: string; tone: string } {
  const total = replay?.total ?? 0;
  const sku = replay ? Number(replay.skuMatchPct) : 0;
  const action = replay?.nextAction ?? "";
  const reason = row.reason ?? "";

  const sampleNote =
    total === 0
      ? "표본 없음"
      : total >= 150
        ? `표본 ${total}건 (충분)`
        : total >= 30
          ? `표본 ${total}건`
          : `표본 ${total}건 (부족)`;

  if (row.stage === "collect_only") {
    return {
      headline: "📊 표본 부족 — 더 모아야 판단",
      sub: sampleNote,
      tone: "text-amber-700",
    };
  }

  if (action === "stop_deterministic_patching_watch_leaks") {
    return {
      headline: `🟢 결정론 완성 — 감시만 (${sku.toFixed(0)}%)`,
      sub: `${sampleNote} · 추가 패치 금지`,
      tone: "text-emerald-700",
    };
  }

  if (action === "precision_stop_or_one_small_patch_then_stop") {
    return {
      headline: `🔵 결정론 거의 완성 (${sku.toFixed(0)}%)`,
      sub: `${sampleNote} · 소량 패치 후 정지`,
      tone: "text-sky-700",
    };
  }

  if (row.stage === "owner_review_ready") {
    return {
      headline: "✅ 실전 후보 — 오너 승인 시 수집",
      sub: `${sampleNote} · 활성 매물 검증 완료`,
      tone: "text-emerald-700",
    };
  }

  if (reason.includes("self_unlocked_ambiguity")) {
    return {
      headline: "🤖 자급제 명시 안 됨 → AI 영역",
      sub: `${sampleNote} · 결정론 한계 (silent carrier 추정 금지)`,
      tone: "text-violet-700",
    };
  }
  if (reason.includes("generation_ambiguity")) {
    return {
      headline: "🤖 세대/연식 추정 필요 → AI 영역",
      sub: `${sampleNote} · 결정론 한계`,
      tone: "text-violet-700",
    };
  }
  if (reason.includes("bundle_or_accessory_ambiguity")) {
    return {
      headline: "🤖 구성품·번들 모호 → AI 영역",
      sub: `${sampleNote} · 결정론 한계 (가격으로 본품 추정 금지)`,
      tone: "text-violet-700",
    };
  }
  if (reason.includes("connectivity_ambiguity")) {
    return {
      headline: "🤖 Wi-Fi/셀룰러 추정 필요 → AI 영역",
      sub: `${sampleNote} · 결정론 한계`,
      tone: "text-violet-700",
    };
  }
  if (reason.includes("parser_unknown_option")) {
    return {
      headline: "🤖 옵션 정보 부족 → AI 영역",
      sub: `${sampleNote} · 결정론 한계 (RAM/SSD/사이즈 등 명시 누락)`,
      tone: "text-violet-700",
    };
  }
  if (reason.includes("deterministic_modelcode_gap_consumed")) {
    return {
      headline: "🤖 결정론 한계 도달 → AI/수동 검토",
      sub: sampleNote,
      tone: "text-violet-700",
    };
  }

  if (row.stage === "ai_l2_escrow") {
    return {
      headline: "🤖 AI 영역",
      sub: `${sampleNote} · 결정론 한계`,
      tone: "text-violet-700",
    };
  }

  if (row.stage === "internal_learning") {
    return {
      headline: "🔍 내부 학습 중 — 결정론 양호",
      sub: `${sampleNote} · 추가 검증 필요`,
      tone: "text-sky-700",
    };
  }

  return { headline: "—", sub: sampleNote, tone: "text-slate-500" };
}

async function loadAll() {
  const [
    state,
    expansion,
    replay,
    owner,
    earphoneParser,
    smartwatchParser,
    headphoneParser,
    speakerParser,
    cameraParser,
    desktopParser,
    monitorParser,
    applianceParser,
  ] = await Promise.all([
    loadJson<CurrentState | null>("current-state-board-latest.json", null),
    loadJson<{ generatedAt: string; stageCounts: Record<string, number>; rows: ExpansionRow[] }>(
      "internal-acquisition-expansion-plan-latest.json",
      { generatedAt: "", stageCounts: {}, rows: [] },
    ),
    loadJson<{
      generatedAt: string;
      totalLanes: number;
      totalSamples: number;
      gradeCounts: Record<string, number>;
      lanes: LaneReplay[];
    }>("lane-replay-readiness-latest.json", {
      generatedAt: "",
      totalLanes: 0,
      totalSamples: 0,
      gradeCounts: {},
      lanes: [],
    }),
    loadJson<{ generatedAt: string; approvedCandidates: OwnerCandidate[] }>(
      "tiny-acquisition-owner-packet-latest.json",
      { generatedAt: "", approvedCandidates: [] },
    ),
    loadJson<FamilyParserSummary>("earphone-parser-latest.json", { skuCounts: [] }),
    loadJson<FamilyParserSummary>("smartwatch-parser-latest.json", { skuCounts: [] }),
    loadJson<FamilyParserSummary>("headphone-parser-latest.json", { skuCounts: [] }),
    loadJson<FamilyParserSummary>("speaker-parser-latest.json", { modelCounts: [] }),
    loadJson<FamilyParserSummary>("camera-parser-latest.json", { modelCounts: [] }),
    loadJson<FamilyParserSummary>("desktop-parser-latest.json", { keyCounts: [] }),
    loadJson<FamilyParserSummary>("monitor-parser-latest.json", { topComparableKeys: [] }),
    loadJson<FamilyParserSummary>("home-appliance-parser-latest.json", { keyCounts: [] }),
  ]);
  return {
    state,
    expansion,
    replay,
    owner,
    earphoneParser,
    smartwatchParser,
    headphoneParser,
    speakerParser,
    cameraParser,
    desktopParser,
    monitorParser,
    applianceParser,
  };
}

export default async function StatusPage() {
  const {
    state,
    expansion,
    replay,
    owner,
    earphoneParser,
    smartwatchParser,
    headphoneParser,
    speakerParser,
    cameraParser,
    desktopParser,
    monitorParser,
    applianceParser,
  } = await loadAll();
  const replayMap = new Map(replay.lanes.map((l) => [l.lane, l]));
  const familySkuRows = [
    ...(earphoneParser.skuCounts ?? []).map((row) => ({
      family: "earphone",
      label: toKorean(row.key.replace(/-/g, "_")),
      key: row.key,
      count: row.count,
    })),
    ...(smartwatchParser.skuCounts ?? []).map((row) => ({
      family: "smartwatch",
      label: toKorean(row.key.replace(/-/g, "_")),
      key: row.key,
      count: row.count,
    })),
  ].sort((a, b) => b.count - a.count);

  const trackedUniverseRows = [
    ...(earphoneParser.skuCounts ?? []).map((row) => ({
      category: "earphone",
      label: toKorean(row.key.replace(/-/g, "_")),
      key: row.key,
      count: row.count,
    })),
    ...(smartwatchParser.skuCounts ?? []).map((row) => ({
      category: "smartwatch",
      label: toKorean(row.key.replace(/-/g, "_")),
      key: row.key,
      count: row.count,
    })),
    ...(headphoneParser.skuCounts ?? []).map((row) => ({
      category: "headphone",
      label: toKorean(row.key.replace(/-/g, "_")),
      key: row.key,
      count: row.count,
    })),
    ...(speakerParser.modelCounts ?? []).map((row) => ({
      category: "speaker",
      label: toKorean(row.key.replace(/-/g, "_")),
      key: row.key,
      count: row.count,
    })),
    ...(cameraParser.modelCounts ?? []).map((row) => ({
      category: "camera",
      label: toKorean(row.key.replace(/-/g, "_")),
      key: row.key,
      count: row.count,
    })),
    ...(desktopParser.keyCounts ?? []).map((row) => ({
      category: "desktop",
      label: toKorean(row.key.replace(/[|:-]/g, "_")),
      key: row.key,
      count: row.count,
    })),
    ...(monitorParser.topComparableKeys ?? []).map((row) => ({
      category: "monitor",
      label: toKorean(row.key.replace(/[|:-]/g, "_")),
      key: row.key,
      count: row.count,
    })),
    ...(applianceParser.keyCounts ?? []).map((row) => ({
      category: "home_appliance",
      label: toKorean(row.key.replace(/[|:-]/g, "_")),
      key: row.key,
      count: row.count,
    })),
  ].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.category.localeCompare(b.category);
  });

  const sourceHealth = state?.operationalHealth.sourceHealth ?? "unknown";
  const healthBadge =
    sourceHealth === "healthy"
      ? { label: "정상", color: "bg-emerald-100 text-emerald-800 border-emerald-300" }
      : sourceHealth === "degraded"
        ? { label: "관찰 중", color: "bg-amber-100 text-amber-800 border-amber-300" }
        : { label: "주의", color: "bg-rose-100 text-rose-800 border-rose-300" };

  const sortedLanes = [...expansion.rows].sort((a, b) => {
    const sa = STAGE_ORDER.indexOf(a.stage);
    const sb = STAGE_ORDER.indexOf(b.stage);
    if (sa !== sb) return sa - sb;
    return a.lane.localeCompare(b.lane);
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">미뇨이 진행 현황</h1>
        <p className="mt-1 text-sm text-slate-600">
          상품 라인별 결정론 정확도와 단계, 운영 상태를 한 화면에서.
        </p>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          이 표는 전체 SKU 우주가 아니라 현재 본류에서 추적 중인 대표 lane 요약판입니다. 기본 ready 대량 풀(earphone/smartwatch)과
          세부 SKU 전체는 별도 내부 데이터에 살아 있고, 여기서는 reveal/narrow/AI blocker 판단에 중요한 라인만 노출합니다.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          업데이트: {state?.generatedAt ? new Date(state.generatedAt).toLocaleString("ko-KR") : "—"}
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-slate-800">운영 상태</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="시스템 상태" value={healthBadge.label} accent={healthBadge.color} />
          <StatCard
            label="활성 후보 풀"
            value={`${state?.operationalHealth.activeReadyPool ?? "—"}개`}
            accent="bg-slate-100 text-slate-800 border-slate-300"
          />
          <StatCard
            label="팩 오픈 정상도"
            value={state?.operationalHealth.packReveal ?? "—"}
            accent="bg-emerald-50 text-emerald-800 border-emerald-200"
          />
          <StatCard
            label="크론 실패율"
            value={`${((state?.operationalHealth.failureRate ?? 0) * 100).toFixed(1)}%`}
            accent="bg-slate-100 text-slate-800 border-slate-300"
          />
          <StatCard
            label="제품 본류"
            value={`${state?.productMainline?.percent ?? "—"}%`}
            accent="bg-blue-50 text-blue-800 border-blue-200"
          />
          <StatCard
            label="리빌 카테고리"
            value={`${state?.productMainline?.revealCategories ?? "—"}개`}
            accent="bg-violet-50 text-violet-800 border-violet-200"
          />
          <StatCard
            label="활성 SKU"
            value={`${state?.productMainline?.revealSkus ?? "—"}개`}
            accent="bg-slate-100 text-slate-800 border-slate-300"
          />
          <StatCard
            label="기본 ready SKU"
            value={`${state?.productMainline?.defaultReadySkus ?? "—"}개`}
            accent="bg-emerald-50 text-emerald-800 border-emerald-200"
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-slate-800">상품 라인 단계 분포</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STAGE_ORDER.map((s) => {
            const meta = STAGE_LABELS[s];
            const count = expansion.stageCounts[s] ?? 0;
            return (
              <div key={s} className={`rounded-lg border px-3 py-3 ${meta.color}`}>
                <div className="text-xl">{meta.emoji}</div>
                <div className="mt-1 text-xs font-medium">{meta.ko}</div>
                <div className="mt-1 text-2xl font-bold">{count}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          전체 {expansion.rows.length}개 라인 · 결정론 검증 {replay.totalLanes}개 · 표본 {replay.totalSamples.toLocaleString()}건
        </p>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-800">✅ 실전 후보 대기 (오너 승인 시 내부 수집)</h2>
          <span className="text-xs text-slate-500">{owner.approvedCandidates.length}개</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {owner.approvedCandidates.map((c) => {
            const r = replayMap.get(c.lane);
            const pct = c.fetched > 0 ? Math.round((c.activeClean / c.fetched) * 100) : 0;
            const accuracy = r ? Number(r.skuMatchPct) : null;
            return (
              <article key={c.lane} className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">{toKorean(c.lane)}</h3>
                <p className="mt-0.5 text-[11px] text-slate-400">{c.lane}</p>
                <dl className="mt-3 space-y-3">
                  <div>
                    <dt className="text-xs text-slate-500">활성 매물 (검증 통과)</dt>
                    <dd className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-emerald-700">{c.activeClean}</span>
                      <span className="text-xs text-slate-500">/ 전체 {c.fetched}개</span>
                    </dd>
                    <ProgressBar pct={pct} color="bg-emerald-500" />
                  </div>
                  {accuracy !== null ? (
                    <div>
                      <dt className="text-xs text-slate-500">결정론 정확도 (학습 표본)</dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-800">{accuracy.toFixed(1)}%</dd>
                      <ProgressBar pct={Math.round(accuracy)} color="bg-sky-500" />
                    </div>
                  ) : null}
                </dl>
                {c.blocker ? <p className="mt-3 text-[11px] text-slate-500">⚠️ {c.blocker}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">전체 라인 ({expansion.rows.length}개)</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">제품</th>
                <th className="px-3 py-2 text-left">단계</th>
                <th className="px-3 py-2 text-right">결정론</th>
                <th className="px-3 py-2 text-right">표본</th>
                <th className="px-3 py-2 text-left">진단 (왜 이런 상태?)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedLanes.map((row) => {
                const r = replayMap.get(row.lane);
                const accuracy = r ? Number(r.skuMatchPct) : null;
                const total = r?.total ?? 0;
                const meta = STAGE_LABELS[row.stage] ?? { ko: row.stage, emoji: "·", color: "" };
                return (
                  <tr key={row.lane} className="text-slate-800">
                    <td className="px-3 py-2">
                      <div className="font-medium">{toKorean(row.lane)}</div>
                      <div className="text-[10px] text-slate-400">{row.lane}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${meta.color}`}>
                        <span>{meta.emoji}</span>
                        <span>{meta.ko}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {accuracy !== null ? (
                        <span
                          className={`font-semibold ${
                            accuracy >= 90
                              ? "text-emerald-700"
                              : accuracy >= 70
                                ? "text-sky-700"
                                : accuracy >= 50
                                  ? "text-amber-700"
                                  : "text-slate-500"
                          }`}
                        >
                          {accuracy.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {total > 0 ? total.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        const diag = diagnose(row, r);
                        return (
                          <div>
                            <div className={`text-xs font-medium ${diag.tone}`}>{diag.headline}</div>
                            <div className="text-[10px] text-slate-400">{diag.sub}</div>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-slate-800">기본 ready family 세부 SKU</h2>
        <p className="mb-3 text-xs text-slate-500">
          아래는 대표 lane 말고, 기본 ready 축에서 실제로 추적 중인 earphone/smartwatch 세부 SKU 분포입니다.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">family</th>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">key</th>
                <th className="px-3 py-2 text-right">count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {familySkuRows.map((row) => (
                <tr key={`${row.family}:${row.key}`}>
                  <td className="px-3 py-2 text-xs text-slate-500">{row.family}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.label}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-400">{row.key}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-slate-800">전체 추적 SKU / 모델 우주</h2>
        <p className="mb-3 text-xs text-slate-500">
          우리가 지금까지 파서/마이닝/리포트에서 실제로 추적한 SKU, 모델, comparable key 기반 라인들을 카테고리별로 그대로 보여줍니다.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">category</th>
                <th className="px-3 py-2 text-left">label</th>
                <th className="px-3 py-2 text-left">raw key</th>
                <th className="px-3 py-2 text-right">count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trackedUniverseRows.map((row) => (
                <tr key={`${row.category}:${row.key}`}>
                  <td className="px-3 py-2 text-xs text-slate-500">{row.category}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.label}</td>
                  <td className="px-3 py-2 text-[11px] text-slate-400">{row.key}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-10 text-xs text-slate-400">
        <p>
          이 페이지는 reports/ 디렉토리의 최신 측정값을 그대로 보여줍니다. DB 변경 / 후보풀 변경 / 사용자 공개는 모두 차단된 상태에서 측정된 수치입니다.
        </p>
      </footer>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${accent}`}>
      <div className="text-xs">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const safe = Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full ${color}`} style={{ width: `${safe}%` }} />
    </div>
  );
}
