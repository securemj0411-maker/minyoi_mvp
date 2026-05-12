export const nextWorkReportMode = {
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  guideHintsReferenceReport: "model-guide-parser-hints-latest.md",
} as const;

export const nextWorkNotQueuedReasons: string[] = [
  "earphone_discovered and headphone_discovered already have strong narrow blocker docs; next step would be tests or main review, not subagent wiring",
  "game_console_discovered is broad contamination map only; body_narrow handles the safe subset",
];

export const nextWorkGuardrails: string[] = [
  "Queue is report-only guidance",
  "No runtime catalog apply",
  "No public promotion",
  "No candidate pool policy wiring",
  "Before parser/report work for earphone/smartwatch public families, consult reports/model-guide-parser-hints-latest.md",
  "Use reports/model-guide-parser-gap-audit-latest.md to decide whether the next safe task is evidence thickening or a new axis packet",
  "Stop when actual wiring/main approval is needed",
];
