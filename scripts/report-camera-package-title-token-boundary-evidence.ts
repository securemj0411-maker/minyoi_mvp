import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CameraRow = {
  pid?: string | number;
  title?: string;
  price?: number;
  model_key?: string | null;
  package_config?: string | null;
  packageSignal?: string;
  boundaryClass?: string;
  evidenceClass?: string;
};

type CameraBoundaryEvidence = {
  category: string;
  rows: CameraRow[];
};

type TitleTokenRow = CameraRow & {
  titlePackageTokenClass: string;
  hasLensIdentityToken: boolean;
  hasBodyOnlyToken: boolean;
  hasFullBoxToken: boolean;
  hasAccessoryBundleToken: boolean;
  hasLensKitToken: boolean;
  tokenBoundaryDecision: string;
  runtimeApproved: false;
};

type TitleTokenEvidence = Omit<TitleTokenRow, "tokenBoundaryDecision">;

const reportsDir = path.join(process.cwd(), "reports");

function normalizedTitle(row: CameraRow): string {
  return (row.title ?? "").toLowerCase();
}

function hasLensIdentityToken(title: string): boolean {
  return /(\b\d{2,3}\s?-\s?\d{2,3}\b|\b\d{2,3}mm\b|번들렌즈|렌즈\s?(포함|킷|셋|세트)|더블\s?줌|double\s?zoom)/i.test(title);
}

function titlePackageTokenClass(row: CameraRow): string {
  const title = normalizedTitle(row);
  if (/더블\s?줌|double\s?zoom|렌즈\s?킷|번들렌즈/i.test(title)) return "explicit_lens_kit_or_lens_identity";
  if (/바디|body|전투용바디|세로그립/i.test(title)) return "explicit_body_only_or_body_accessory";
  if (/풀박스|풀\s?박스|full\s?box/i.test(title)) return "full_box_without_lens_identity";
  if (/배터리|sd카드|케이스|가방|충전기|스트랩/i.test(title)) return "accessory_bundle_without_lens_identity";
  return "missing_package_title_token";
}

function tokenBoundaryDecision(row: TitleTokenEvidence): string {
  if (row.titlePackageTokenClass === "explicit_lens_kit_or_lens_identity" && row.hasLensIdentityToken) return "lens_identity_reference_only";
  if (row.titlePackageTokenClass === "explicit_body_only_or_body_accessory") return "body_only_do_not_merge_with_lens_kit";
  if (row.titlePackageTokenClass === "full_box_without_lens_identity") return "full_box_not_lens_kit_hold";
  if (row.titlePackageTokenClass === "accessory_bundle_without_lens_identity") return "accessory_bundle_not_lens_kit_hold";
  return "missing_package_signal_hold";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const boundary = JSON.parse(
    await readFile(path.join(reportsDir, "camera-package-signal-boundary-evidence-latest.json"), "utf8"),
  ) as CameraBoundaryEvidence;

  const rows: TitleTokenRow[] = boundary.rows.map((row) => {
    const title = normalizedTitle(row);
    const base = {
      ...row,
      titlePackageTokenClass: titlePackageTokenClass(row),
      hasLensIdentityToken: hasLensIdentityToken(title),
      hasBodyOnlyToken: /바디|body|전투용바디/.test(title),
      hasFullBoxToken: /풀박스|풀\s?박스|full\s?box/.test(title),
      hasAccessoryBundleToken: /배터리|sd카드|케이스|가방|충전기|스트랩|세로그립/.test(title),
      hasLensKitToken: /더블\s?줌|double\s?zoom|렌즈\s?킷|번들렌즈/.test(title),
      runtimeApproved: false as const,
    };
    return {
      ...base,
      tokenBoundaryDecision: tokenBoundaryDecision(base),
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: boundary.category,
    decision: "camera_package_title_token_boundary_report_only",
    sourceReports: ["camera-package-signal-boundary-evidence-latest.json", "camera-false-merge-risk-matrix-latest.json"],
    metrics: {
      titleRows: rows.length,
      lensIdentityTokenRows: rows.filter((row) => row.hasLensIdentityToken).length,
      lensKitTokenRows: rows.filter((row) => row.hasLensKitToken).length,
      bodyOnlyTokenRows: rows.filter((row) => row.hasBodyOnlyToken).length,
      fullBoxTokenRows: rows.filter((row) => row.hasFullBoxToken).length,
      accessoryBundleTokenRows: rows.filter((row) => row.hasAccessoryBundleToken).length,
      missingPackageTitleTokenRows: rows.filter((row) => row.titlePackageTokenClass === "missing_package_title_token").length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      titlePackageTokenClassCounts: countBy(rows.map((row) => row.titlePackageTokenClass)),
      tokenBoundaryDecisionCounts: countBy(rows.map((row) => row.tokenBoundaryDecision)),
      packageConfigCounts: countBy(rows.map((row) => row.package_config ?? "unknown")),
    },
    rows,
    policyImplications: [
      "Lens-kit words are reference evidence only unless explicit lens identity is available.",
      "Full-box, battery, SD card, case, grip, and accessory bundle tokens are not lens-kit identity.",
      "Body-only title tokens must remain separate from lens-kit rows.",
      "No camera package recovery rule or runtime category parser change is approved here.",
    ],
    nextReportOnlyExperiments: [
      "collect lens identity token examples such as focal length or explicit lens model",
      "keep full-box and accessory bundle rows as false-merge negative examples",
      "split body-only evidence from lens-kit evidence before any future parser design",
    ],
    doNotDo: [
      "Do not runtime-wire camera category",
      "Do not public-promote camera_discovered",
      "Do not recover package_config from title tokens in runtime parser",
      "Do not candidate-pool wire camera package policy",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "camera-package-title-token-boundary-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | package_config | title_token_class | lens_identity | decision | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.package_config ?? "-"} | ${row.titlePackageTokenClass} | ${row.hasLensIdentityToken ? "yes" : "no"} | ${row.tokenBoundaryDecision} | no | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Camera Package Title Token Boundary Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only camera package title-token boundary evidence. This is not runtime wiring and not public promotion.",
    "",
    `Title rows: ${report.metrics.titleRows}`,
    `Lens identity token rows: ${report.metrics.lensIdentityTokenRows}`,
    `Missing package title token rows: ${report.metrics.missingPackageTitleTokenRows}`,
    `Runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    "",
    table,
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((line) => `- ${line}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "camera-package-title-token-boundary-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/camera-package-title-token-boundary-evidence-latest.json");
  console.log("wrote reports/camera-package-title-token-boundary-evidence-latest.md");
  console.log(
    `camera package title token boundary: lens_identity=${report.metrics.lensIdentityTokenRows}, missing_signal=${report.metrics.missingPackageTitleTokenRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
