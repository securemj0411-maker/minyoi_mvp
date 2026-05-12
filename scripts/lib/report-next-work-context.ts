import { findTopRegistryBacklogSignalForQueueCategory, type RegistryBacklogSignalRow } from "./report-registry-backlog-context";
import { type ReadinessRow } from "./report-category-status-context";
import { resolveNextWorkPlanEntryForCategory, type NextWorkPlanEntry } from "./report-next-work-plan-spec";

export type SuiteStatus = {
  candidateRows: Array<{
    category: string;
    status: string;
    primaryMetric: string;
    blockerReport: string;
    nextAction: string;
  }>;
  holdRows: Array<{
    category: string;
    decision: string;
    primaryMetric: string;
    blockerReport: string;
    nextAction: string;
  }>;
};

export type GuideGapAudit = {
  rows: Array<{
    guideKey: string;
    title: string;
    category: string;
    coverageSummary: "direct" | "adjacent" | "weak" | "missing";
    fullyCovered: boolean;
    axisAudits: Array<{
      axis: string;
      coverageStrength: "direct" | "adjacent" | "weak" | "missing";
      missingFollowup: string[];
    }>;
  }>;
};

export type GuideCoverageBucket = {
  direct: number;
  adjacent: number;
  weak: number;
  missing: number;
  fullyCovered: number;
  total: number;
};

export type GuideSignal = {
  guideKey: string;
  title: string;
  weakestCoverage: "direct" | "adjacent" | "weak" | "missing";
  weakestAxes: string[];
  recommendation: string;
};

export type NextWorkBaseRow = {
  category: string;
  registryGroupKey: string | null;
  kind: "candidate" | "hold";
  status: string;
  metric: string;
  blockerReport: string;
  existingNextAction: string;
  readinessSummary: ReadinessRow | null;
  guideCoverage?: GuideCoverageBucket;
  guideSignals: GuideSignal[];
  registryBacklogTopSignal: RegistryBacklogSignalRow | null;
} & NextWorkPlanEntry;

const coverageRank = { missing: 0, weak: 1, adjacent: 2, direct: 3 } as const;

function normalizeGuideCategory(category: string): string {
  return category.replace(/_discovered$|_body_narrow$/g, "");
}

export function buildGuideCoverageByCategory(guideGap: GuideGapAudit): Map<string, GuideCoverageBucket> {
  const guideCoverageByCategory = new Map<string, GuideCoverageBucket>();
  for (const row of guideGap.rows) {
    const bucket = guideCoverageByCategory.get(row.category) ?? {
      direct: 0,
      adjacent: 0,
      weak: 0,
      missing: 0,
      fullyCovered: 0,
      total: 0,
    };
    bucket[row.coverageSummary] += 1;
    bucket.total += 1;
    if (row.fullyCovered) bucket.fullyCovered += 1;
    guideCoverageByCategory.set(row.category, bucket);
  }
  return guideCoverageByCategory;
}

export function buildGuideSignalsByCategory(guideGap: GuideGapAudit): Map<string, GuideSignal[]> {
  const guideSignalsByCategory = new Map<string, GuideSignal[]>();
  for (const row of guideGap.rows) {
    const weakestRank = row.axisAudits.reduce((lowest, axis) => Math.min(lowest, coverageRank[axis.coverageStrength]), 3);
    const weakestCoverage = (Object.entries(coverageRank).find(([, rank]) => rank === weakestRank)?.[0] ?? "direct") as
      | "direct"
      | "adjacent"
      | "weak"
      | "missing";
    const weakestAxes = row.axisAudits.filter((axis) => axis.coverageStrength === weakestCoverage).map((axis) => axis.axis);
    const recommendation =
      weakestCoverage === "missing"
        ? "missing axis direct evidence packet을 최우선 report-only task로 승격"
        : weakestCoverage === "weak"
          ? "weak axis evidence를 기존 next task보다 앞서 두껍게 보강"
          : weakestCoverage === "adjacent"
            ? "family-specific direct evidence packet으로 adjacent coverage를 직접 증거로 승격"
            : "guide-backed direct evidence exists; no extra guide-driven packet required now";
    const bucket = guideSignalsByCategory.get(row.category) ?? [];
    bucket.push({
      guideKey: row.guideKey,
      title: row.title,
      weakestCoverage,
      weakestAxes,
      recommendation,
    });
    guideSignalsByCategory.set(row.category, bucket);
  }
  return guideSignalsByCategory;
}

export function buildNextWorkBaseRows(params: {
  suite: SuiteStatus;
  readinessRows: ReadinessRow[];
  guideGap: GuideGapAudit;
  registryBacklogRows: RegistryBacklogSignalRow[];
}): NextWorkBaseRow[] {
  const readinessByCategory = new Map(params.readinessRows.map((row) => [row.category, row]));
  const guideCoverageByCategory = buildGuideCoverageByCategory(params.guideGap);
  const guideSignalsByCategory = buildGuideSignalsByCategory(params.guideGap);

  return [
    ...params.suite.candidateRows.map((row) => ({ kind: "candidate" as const, ...row })),
    ...params.suite.holdRows.map((row) => ({
      kind: "hold" as const,
      status: row.decision,
      primaryMetric: row.primaryMetric,
      blockerReport: row.blockerReport,
      nextAction: row.nextAction,
      category: row.category,
    })),
  ]
    .map((row) => {
      const plan = resolveNextWorkPlanEntryForCategory(row.category);
      if (!plan) return null;
      const guideCategory = normalizeGuideCategory(row.category);
      return {
        category: row.category,
        registryGroupKey: plan.registryGroupKey,
        kind: row.kind,
        status: row.status,
        metric: row.primaryMetric,
        blockerReport: row.blockerReport,
        existingNextAction: row.nextAction,
        readinessSummary: readinessByCategory.get(row.category) ?? null,
        guideCoverage: guideCoverageByCategory.get(guideCategory),
        guideSignals: guideSignalsByCategory.get(guideCategory) ?? [],
        registryBacklogTopSignal: findTopRegistryBacklogSignalForQueueCategory(row.category, params.registryBacklogRows) ?? null,
        ...plan,
      };
    })
    .filter((row): row is NextWorkBaseRow => row !== null)
    .sort((a, b) => a.priority - b.priority);
}
