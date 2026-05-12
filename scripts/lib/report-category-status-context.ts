import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ReportCategoryEvidenceMapping } from "./report-category-evidence-spec";
import { findReportCategoryEditorialSpec, type ReportCategoryEditorialSpec } from "./report-category-editorial-spec";

export type ReadinessRow = {
  category: string;
  status: string;
  primaryMetric: string;
  caveat: string;
  nextAction: string;
};

export type CategoryStatusContext = {
  category: string;
  evidence: ReportCategoryEvidenceMapping["evidence"];
  editorial: ReportCategoryEditorialSpec;
  readiness: ReadinessRow | null;
};

export async function readReportJson<T>(reportsDir: string, file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

export async function loadReadinessRows(reportsDir: string): Promise<ReadinessRow[]> {
  const summary = await readReportJson<{ rows?: ReadinessRow[] }>(reportsDir, "parser-readiness-summary-latest.json");
  return Array.isArray(summary.rows) ? summary.rows : [];
}

export function buildReadinessByCategory(rows: ReadinessRow[]): Map<string, ReadinessRow> {
  return new Map(rows.map((row) => [row.category, row]));
}

export function compileCategoryStatusContexts(params: {
  readinessRows: ReadinessRow[];
  evidenceSpecs: ReportCategoryEvidenceMapping[];
  editorialSpecs?: ReportCategoryEditorialSpec[];
}): CategoryStatusContext[] {
  const readinessByCategory = buildReadinessByCategory(params.readinessRows);

  return params.evidenceSpecs.map((spec) => {
    const editorial =
      params.editorialSpecs?.find((editorialSpec) => editorialSpec.category === spec.category) ??
      findReportCategoryEditorialSpec(spec.category);
    if (!editorial) {
      throw new Error(`missing editorial spec for category: ${spec.category}`);
    }
    return {
      category: spec.category,
      evidence: spec.evidence,
      editorial,
      readiness: readinessByCategory.get(spec.category) ?? null,
    };
  });
}
