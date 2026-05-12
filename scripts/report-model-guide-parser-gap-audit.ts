import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { MODEL_GUIDES } from "@/lib/model-guides";

const reportsDir = path.join(process.cwd(), "reports");

type AxisCoverageStrength = "direct" | "adjacent" | "weak" | "missing";

type AxisAuditRow = {
  axis: string;
  coverageStrength: AxisCoverageStrength;
  directReports: string[];
  adjacentReports: string[];
  weakReports: string[];
  coveredReports: string[];
  missingFollowup: string[];
};

type CoverageNeedles = {
  direct: string[];
  adjacent: string[];
  weak: string[];
};

function markdownTable(headers: string[], rows: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function matchesAny(file: string, needles: string[]): boolean {
  return needles.some((needle) => file.includes(needle));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function getCoverageStrength(row: Pick<AxisAuditRow, "directReports" | "adjacentReports" | "weakReports">): AxisCoverageStrength {
  if (row.directReports.length > 0) return "direct";
  if (row.adjacentReports.length > 0) return "adjacent";
  if (row.weakReports.length > 0) return "weak";
  return "missing";
}

function summarizeGuideCoverage(axisAudits: AxisAuditRow[]): AxisCoverageStrength {
  const strengths = axisAudits.map((row) => row.coverageStrength);
  if (strengths.includes("missing")) return "missing";
  if (strengths.includes("weak")) return "weak";
  if (strengths.includes("adjacent")) return "adjacent";
  return "direct";
}

function expectedReportNeedles(category: string, family: string, axis: string): CoverageNeedles {
  if (category === "earphone" && family === "airpods") {
    if (axis === "connector") {
      return {
        direct: ["earphone-airpods-blockers", "parser-airpods-headphone-boundary-examples"],
        adjacent: ["earphone-airpods-evidence-matrix"],
        weak: ["earphone-parser"],
      };
    }
    if (axis === "anc") {
      return {
        direct: ["earphone-airpods-evidence-matrix", "earphone-airpods-blockers"],
        adjacent: ["parser-airpods-headphone-boundary-examples"],
        weak: ["earphone-parser"],
      };
    }
    if (axis === "fullset_vs_parts") {
      return {
        direct: ["earphone-parts-exclusion-evidence"],
        adjacent: ["parser-airpods-headphone-boundary-examples", "earphone-airpods-blockers"],
        weak: ["earphone-parser"],
      };
    }
    if (axis === "generation") {
      return {
        direct: ["headphone-airpods-max-review-evidence", "headphone-matched-sku-blockers"],
        adjacent: ["headphone-matched-sku-evidence-matrix"],
        weak: ["headphone-parser"],
      };
    }
  }

  if (category === "earphone" && family === "galaxybuds") {
    if (axis === "family") {
      return {
        direct: ["earphone-galaxybuds-family-evidence"],
        adjacent: ["earphone-airpods-evidence-matrix"],
        weak: ["earphone-parser"],
      };
    }
    if (axis === "fullset_vs_parts") {
      return {
        direct: ["earphone-parts-exclusion-evidence"],
        adjacent: [],
        weak: ["earphone-parser"],
      };
    }
  }

  if (category === "smartwatch") {
    if (axis === "size") {
      return {
        direct: ["smartwatch-connectivity-size-evidence"],
        adjacent: ["smartwatch-ambiguity-blockers"],
        weak: ["smartwatch-parser"],
      };
    }
    if (axis === "connectivity") {
      return {
        direct: ["smartwatch-connectivity-size-evidence", "smartwatch-connectivity-model-boundary-evidence"],
        adjacent: ["smartwatch-ambiguity-evidence-matrix"],
        weak: ["smartwatch-parser"],
      };
    }
    if (axis === "generation") {
      if (family === "applewatch") {
        return {
          direct: ["smartwatch-applewatch-generation-evidence"],
          adjacent: ["smartwatch-ambiguity-split-prep", "smartwatch-ambiguity-blockers"],
          weak: ["smartwatch-parser"],
        };
      }
      return {
        direct: ["smartwatch-ambiguity-split-prep", "smartwatch-ambiguity-blockers"],
        adjacent: ["smartwatch-ambiguity-evidence-matrix"],
        weak: ["smartwatch-parser"],
      };
    }
    if (axis === "family") {
      return {
        direct: ["smartwatch-connectivity-model-boundary-evidence", "smartwatch-ambiguity-evidence-matrix"],
        adjacent: ["smartwatch-ambiguity-blockers"],
        weak: ["smartwatch-parser"],
      };
    }
    if (axis === "classic_boundary") {
      return {
        direct: ["smartwatch-connectivity-model-boundary-evidence"],
        adjacent: ["smartwatch-ambiguity-blockers"],
        weak: [],
      };
    }
  }

  return { direct: [], adjacent: [], weak: [] };
}

function suggestedFollowups(category: string, family: string, axis: string): string[] {
  if (category === "earphone" && family === "airpods") {
    if (axis === "connector") return ["connector 미표기 hold examples를 report-only로 더 분리"];
    if (axis === "anc") return ["ANC/non-ANC title ambiguity examples를 따로 모으기"];
    if (axis === "fullset_vs_parts") return ["본체/유닛/케이스 혼합 examples를 더 모으기"];
    if (axis === "generation") return ["AirPods Max 세대 불명확 examples를 family-level report와 분리"];
  }

  if (category === "earphone" && family === "galaxybuds") {
    if (axis === "family") return ["Galaxy Buds family용 report-only subset evidence 추가"];
    if (axis === "fullset_vs_parts") return ["Galaxy Buds 단품/케이스 단품 examples를 별도 축으로 수집"];
  }

  if (category === "smartwatch") {
    if (axis === "size") return ["size 미표기 smartwatch rows를 review packet으로 분리"];
    if (axis === "connectivity") return ["Bluetooth/LTE 미표기 rows를 별도 ambiguity 예시로 정리"];
    if (axis === "generation") return ["SE/Series 세대 미표기 rows를 report-only로 더 쪼개기"];
    if (axis === "family") return ["Ultra/Series/SE family 혼합 rows를 family boundary evidence로 더 보강"];
    if (axis === "classic_boundary") return ["Galaxy Watch Classic / 일반형 혼합 rows를 따로 대조"];
  }

  return ["추가 evidence 분리 검토"];
}

async function main(): Promise<void> {
  const files = await readdir(reportsDir);

  const rows = MODEL_GUIDES.map((guide) => {
    const axisAudits: AxisAuditRow[] = guide.parserHints.mustSplitAxes.map((axis) => {
      const needles = expectedReportNeedles(guide.category, guide.family, axis);
      const mdFiles = files.filter((file) => file.endsWith(".md"));
      const directReports = mdFiles.filter((file) => matchesAny(file, needles.direct));
      const adjacentReports = mdFiles.filter(
        (file) => !directReports.includes(file) && matchesAny(file, needles.adjacent),
      );
      const weakReports = mdFiles.filter(
        (file) => !directReports.includes(file) && !adjacentReports.includes(file) && matchesAny(file, needles.weak),
      );
      const coverageStrength = getCoverageStrength({ directReports, adjacentReports, weakReports });
      const coveredReports = unique([...directReports, ...adjacentReports, ...weakReports]);
      return {
        axis,
        coverageStrength,
        directReports,
        adjacentReports,
        weakReports,
        coveredReports,
        missingFollowup: coverageStrength === "direct" ? [] : suggestedFollowups(guide.category, guide.family, axis),
      };
    });

    const coverageSummary = summarizeGuideCoverage(axisAudits);
    const fullyCovered = axisAudits.every((row) => row.coverageStrength !== "missing");

    return {
      guideKey: guide.guideKey,
      title: guide.title,
      category: guide.category,
      family: guide.family,
      variantScope: guide.variantScope ?? "family",
      mustSplitAxes: guide.parserHints.mustSplitAxes,
      coverageSummary,
      fullyCovered,
      axisAudits,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeMutation: false,
    purpose: [
      "Compare model guide parserHints against existing report-only blocker/readiness evidence.",
      "Show which mustSplitAxes already have report coverage and which ones still need better evidence packets.",
      "This audit is advisory only; do not treat it as runtime parser wiring approval.",
    ],
    rows,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "model-guide-parser-gap-audit-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Model Guide Parser Gap Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only audit comparing `model-guides.ts` parser hints with existing blocker/readiness evidence reports.",
    "",
    "## Usage Rules",
    "",
    ...report.purpose.map((line) => `- ${line}`),
    "",
    "## Guide Coverage Summary",
    "",
    markdownTable(
      ["guide_key", "family", "variant_scope", "must_split_axes", "coverage_summary", "fully_covered"],
      rows.map((row) => [
        row.guideKey,
        row.family,
        row.variantScope,
        row.mustSplitAxes.join(", "),
        row.coverageSummary,
        row.fullyCovered ? "yes" : "no",
      ]),
    ),
    "",
    "## Axis Audit",
    "",
    ...rows.flatMap((row) => [
      `### ${row.title}`,
      "",
      ...row.axisAudits.flatMap((axisRow) => [
        `- axis: \`${axisRow.axis}\``,
        `  - coverage_strength: ${axisRow.coverageStrength}`,
        `  - direct_reports: ${axisRow.directReports.join(", ") || "-"}`,
        `  - adjacent_reports: ${axisRow.adjacentReports.join(", ") || "-"}`,
        `  - weak_reports: ${axisRow.weakReports.join(", ") || "-"}`,
        `  - covered_reports: ${axisRow.coveredReports.join(", ") || "-"}`,
        `  - missing_followup: ${axisRow.missingFollowup.join(", ") || "-"}`,
      ]),
      "",
    ]),
  ].join("\n");

  await writeFile(path.join(reportsDir, "model-guide-parser-gap-audit-latest.md"), `${md}\n`);
  console.log("wrote reports/model-guide-parser-gap-audit-latest.json");
  console.log("wrote reports/model-guide-parser-gap-audit-latest.md");
  console.log(`model guide parser gap audit: guides=${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
