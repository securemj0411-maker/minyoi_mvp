import { findDiscoveredCategoryForRegistryCategory } from "./report-category-key-spec";

export type ReportCategoryEditorialSpec = {
  category: string;
  laneFallback: string;
  readinessMetricFallback: string;
  holdReasons: string[];
  nextSafeReportOnlyTask: string;
};

const DISCOVERED_SUFFIX_CANDIDATES = [
  "_discovered",
  "_audio_discovered",
  "_pc_discovered",
  "_tech_discovered",
] as const;

export const reportCategoryEditorialSpecs: ReportCategoryEditorialSpec[] = [
  {
    category: "earphone_discovered",
    laneFallback: "parser_candidate",
    readinessMetricFallback: "parser_ready=100%",
    holdReasons: [
      "non-AirPods rows are not broadly covered by the current candidate scope",
      "parts/case/side-only rows remain exclusion evidence",
      "Galaxy Buds family now has direct evidence, but still needs family-specific parser/rule expansion before promotion",
      "Galaxy Buds narrow positive buckets are still mostly empty and remain report-only visibility evidence",
    ],
    nextSafeReportOnlyTask:
      "AirPods-only candidate evidence can stay internal; Galaxy Buds family evidence now exists, and narrow explicit positive buckets should be thickened without reviving a generic family-positive claim before runtime promotion.",
  },
  {
    category: "headphone_discovered",
    laneFallback: "parser_candidate",
    readinessMetricFallback: "parser_ready=90.6%",
    holdReasons: [
      "AirPods Max rows with unknown connector/generation stay review-gated",
      "matched-SKU rows only; accessory/merch rows excluded",
    ],
    nextSafeReportOnlyTask:
      "Keep matched-SKU boundary and deepen AirPods Max connector examples before parser policy wiring.",
  },
  {
    category: "monitor_discovered",
    laneFallback: "parser_candidate",
    readinessMetricFallback: "parser_ready=47.5%",
    holdReasons: ["overall parser_ready remains low", "model-code rows only; resolution/Hz-only rows are not promotion evidence"],
    nextSafeReportOnlyTask:
      "Add more confirmed model-code examples or keep monitor as model-code-only internal readiness.",
  },
  {
    category: "desktop_pc_discovered",
    laneFallback: "parser_candidate_report_only",
    readinessMetricFallback: "parser_ready=60%",
    holdReasons: [
      "CPU/GPU identity must both resolve for full-unit candidates",
      "GPU-only, mining, commercial, and generic desktop rows stay out",
    ],
    nextSafeReportOnlyTask:
      "Collect complete full-unit CPU+GPU examples; keep this as report-only candidate until full-unit gate is tighter.",
  },
  {
    category: "game_console_body_narrow",
    laneFallback: "parser_candidate",
    readinessMetricFallback: "console_candidate=71.3%",
    holdReasons: ["body_narrow only; broad game_console_discovered is contaminated", "edition/body ambiguity remains review-gated"],
    nextSafeReportOnlyTask:
      "Deepen body_narrow edition/body examples without promoting broad game_console rows.",
  },
  {
    category: "game_console_discovered",
    laneFallback: "hold_or_split",
    readinessMetricFallback: "console_candidate=11.3%",
    holdReasons: [
      "broad category contains accessory, media/title, buying, bundle, and unknown-body pressure",
      "must remain split from body_narrow",
    ],
    nextSafeReportOnlyTask:
      "Use this only as split/contamination evidence; do not turn it into a public parser candidate.",
  },
  {
    category: "camera_discovered",
    laneFallback: "hold_report_only",
    readinessMetricFallback: "parser_ready=61.3%",
    holdReasons: [
      "runtime category/comparable-key is missing",
      "package/lens-kit/body-only signals are not safe to merge yet",
    ],
    nextSafeReportOnlyTask:
      "Keep mapping package signal classes; hold runtime parser until category/comparable-key design exists.",
  },
  {
    category: "smartwatch_discovered",
    laneFallback: "hold_report_only",
    readinessMetricFallback: "parser_ready=88.9%",
    holdReasons: [
      "high parser_ready is still review-gated",
      "unknown connectivity/size and strap risk block promotion",
      "Apple Watch SE/Series generation still needs explicit text and cannot be inferred from family alone",
      "explicit generation positives now exist, but strong full-set density is still report-only and not promotion evidence",
      "cellular-ready / gps-only / pairing-reset wording is now separated, but still remains review evidence rather than runtime approval",
      "Series9 clean core remains tiny and adjacent rows are still dominated by bundle/cellular noise",
      "Series9 adjacent bundle pressure is now mostly box/strap context rather than clean neighboring body rows",
      "Series9 box-only neighbors still carry owner-care/cosmetic/seller-pitch overlays and have not produced a clean packaging-only row",
      "Series9 adjacent rows still carry personal/state wording after stripping bundle/cellular payload, but that wording lives inside contaminated carriers and is not clean adjacency evidence",
      "Watch8 44mm non-unopened pressure is now decomposed, but activation/accessory overlap still blocks a clean broadening story",
      "Watch8 tiny pressure row-class packets still show no clean body row after removing unopened-heavy pressure",
      "Watch8 non-merchant activation row still carries charger/LTE/cosmetic baggage and has not produced a clean activation row",
    ],
    nextSafeReportOnlyTask:
      "Use Apple Watch generation evidence, narrow priority positive buckets, Series9 clean-core adjacency packets plus box-only context and neighbor-wording survival, Galaxy Watch activation/accessory pressure packets, overlap-context packets, non-merchant activation semantics, and strap/accessory boundary evidence together to keep generation/network review-gated until personal-clean density improves.",
  },
  {
    category: "speaker_audio_discovered",
    laneFallback: "hold_report_only",
    readinessMetricFallback: "model_matched=40%",
    holdReasons: [
      "generic speaker rows remain high",
      "amp/receiver/PA speaker classes are boundary cases, not candidate rows",
    ],
    nextSafeReportOnlyTask:
      "Continue portable-family model-token evidence; keep generic speaker and device-class boundary rows held.",
  },
  {
    category: "home_appliance_tech_discovered",
    laneFallback: "hold_report_only",
    readinessMetricFallback: "model_ready=12.3%",
    holdReasons: [
      "generic home-appliance/vacuum rows dominate",
      "robot/bedding/accessory subtype boundaries are not one parser family",
    ],
    nextSafeReportOnlyTask:
      "Split vacuum subtype evidence further before any candidate parser shape is drafted.",
  },
];

const editorialByCategory = new Map(reportCategoryEditorialSpecs.map((spec) => [spec.category, spec]));

export function findReportCategoryEditorialSpec(category: string): ReportCategoryEditorialSpec | null {
  return editorialByCategory.get(category) ?? null;
}

export function findEditorialSpecForGroupCategory(groupCategory: string): ReportCategoryEditorialSpec | null {
  const mapped = findDiscoveredCategoryForRegistryCategory(groupCategory);
  if (mapped) return editorialByCategory.get(mapped) ?? null;
  for (const suffix of DISCOVERED_SUFFIX_CANDIDATES) {
    const spec = editorialByCategory.get(`${groupCategory}${suffix}`);
    if (spec) return spec;
  }
  return null;
}
