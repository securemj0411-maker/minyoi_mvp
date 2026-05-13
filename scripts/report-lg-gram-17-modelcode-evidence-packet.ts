import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type SampleReport = {
  rows?: Array<{
    pid: string;
    title: string;
    price: number;
    decision: "clean_candidate" | "hold" | "ai_l2_or_manual";
    reasons: string[];
    skuId: string | null;
    comparableKey: string | null;
  }>;
};

const root = process.cwd();
const reportDir = path.join(root, "reports");
const sourcePath = path.join(reportDir, "exact-acquisition-no-write-sample-lg_gram_17_2024_modelcode_wave2-latest.json");

function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

const modelCodePatterns = [
  { family: "17z90sp", pattern: /\b17z90sp[a-z0-9-]*/i, policy: "hold_gram_pro" },
  { family: "17zd90sp", pattern: /\b17zd90sp[a-z0-9-]*/i, policy: "hold_gram_pro" },
  { family: "17zd90su", pattern: /\b17zd90su[a-z0-9-]*/i, policy: "candidate_2024_non_pro" },
  { family: "17z90s", pattern: /\b17z90s[a-z0-9-]*/i, policy: "candidate_2024_non_pro" },
  { family: "17zd90s", pattern: /\b17zd90s[a-z0-9-]*/i, policy: "candidate_2024_non_pro" },
  { family: "17z90tr", pattern: /\b17z90tr[a-z0-9-]*/i, policy: "hold_other_generation_or_pro" },
  { family: "older_or_other", pattern: /\b17z(?:d)?90[pqru][a-z0-9-]*/i, policy: "hold_older_or_other_generation" },
];

function codeFamily(title: string) {
  for (const row of modelCodePatterns) {
    if (row.pattern.test(title)) return row;
  }
  return { family: "unknown", policy: "manual_review" };
}

const source = readJson<SampleReport>(sourcePath);
const rows = (source?.rows ?? []).map((row) => {
  const family = codeFamily(row.title);
  const needsDeterministicPatch =
    row.decision === "ai_l2_or_manual" &&
    family.policy === "candidate_2024_non_pro" &&
    row.reasons.includes("missing_comparable_key");
  return {
    ...row,
    modelCodeFamily: family.family,
    modelCodePolicy: family.policy,
    needsDeterministicPatch,
  };
});

const byFamily = [...new Set(rows.map((row) => row.modelCodeFamily))].map((family) => {
  const familyRows = rows.filter((row) => row.modelCodeFamily === family);
  return {
    family,
    rows: familyRows.length,
    aiL2OrManual: familyRows.filter((row) => row.decision === "ai_l2_or_manual").length,
    hold: familyRows.filter((row) => row.decision === "hold").length,
    deterministicPatchCandidates: familyRows.filter((row) => row.needsDeterministicPatch).length,
  };
});

const deterministicPatchRows = rows.filter((row) => row.needsDeterministicPatch);
const recognizedComparableRows = rows.filter((row) =>
  row.modelCodePolicy === "candidate_2024_non_pro" &&
  Boolean(row.skuId) &&
  Boolean(row.comparableKey),
);
const cleanRows = rows.filter((row) => row.decision === "clean_candidate");
const output = {
  generatedAt: new Date().toISOString(),
  scope: "lg_gram_17_2024_modelcode_evidence_packet",
  source: "reports/exact-acquisition-no-write-sample-lg_gram_17_2024_modelcode_wave2-latest.json",
  runtimeMutation: false,
  supabaseMutation: false,
  publicPromotion: false,
  totalRows: rows.length,
  deterministicPatchCandidateRows: deterministicPatchRows.length,
  recognizedComparableRows: recognizedComparableRows.length,
  cleanRows: cleanRows.length,
  byFamily,
  rows,
  recommendedPatchScope: [
    "catalog ruleMatch should recognize 17Z90S / 17ZD90S / 17ZD90SU as LG Gram 17 2024 non-Pro candidates.",
    "option-parser should derive a stable laptop comparable key from LG Gram 17 model-code family before any acquisition.",
    "Do not include Gram Pro SP/TR or older P/Q/R/U/RU model-code families in the same lane.",
    "After any patch, rerun this same no-write sample and require clean_candidate rows without increasing Pro/older contamination.",
  ],
  decision:
    deterministicPatchRows.length === 0 && recognizedComparableRows.length >= 6
      ? "The narrow LG Gram model-code patch appears consumed: model-code candidates now receive SKU/comparable keys. Residual rows should stay AI/manual unless RAM/SSD/chip are explicit."
      : deterministicPatchRows.length >= 6
      ? "Evidence supports one narrow deterministic LG Gram model-code patch proposal, but no runtime change is applied in this report."
      : "Evidence is not thick enough for deterministic patch; keep LG Gram as AI/manual or gather another exact sample wave.",
};

const md = [
  "# LG Gram 17 Model-Code Evidence Packet",
  "",
  `- generatedAt: ${output.generatedAt}`,
  `- source: ${output.source}`,
  "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
  `- totalRows: ${output.totalRows}`,
  `- deterministicPatchCandidateRows: ${output.deterministicPatchCandidateRows}`,
  `- recognizedComparableRows: ${output.recognizedComparableRows}`,
  `- cleanRows: ${output.cleanRows}`,
  "",
  "## By Family",
  "",
  "| family | rows | AI/manual | hold | deterministic patch candidates |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...byFamily.map((row) => `| ${row.family} | ${row.rows} | ${row.aiL2OrManual} | ${row.hold} | ${row.deterministicPatchCandidates} |`),
  "",
  "## Rows",
  "",
  "| policy | decision | pid | price | title | reasons |",
  "| --- | --- | --- | ---: | --- | --- |",
  ...rows.map((row) =>
    `| ${row.modelCodePolicy} | ${row.decision} | ${row.pid} | ${row.price} | ${row.title.replace(/\|/g, "/")} | ${row.reasons.join(", ") || "-"} |`,
  ),
  "",
  "## Recommended Patch Scope",
  "",
  ...output.recommendedPatchScope.map((item) => `- ${item}`),
  "",
  "## Decision",
  "",
  `- ${output.decision}`,
  "",
].join("\n");

writeFileSync(path.join(reportDir, "lg-gram-17-modelcode-evidence-packet-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(path.join(reportDir, "lg-gram-17-modelcode-evidence-packet-latest.md"), md);

console.log("wrote reports/lg-gram-17-modelcode-evidence-packet-latest.json");
console.log("wrote reports/lg-gram-17-modelcode-evidence-packet-latest.md");
console.log(JSON.stringify({ totalRows: output.totalRows, deterministicPatchCandidateRows: output.deterministicPatchCandidateRows }));
