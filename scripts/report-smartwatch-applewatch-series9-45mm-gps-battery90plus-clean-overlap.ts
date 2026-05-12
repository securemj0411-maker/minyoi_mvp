import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SignalCarrierReport = {
  metrics?: Record<string, number>;
  laneSamples?: Record<string, Array<string | number>>;
};

type OwnerCareReport = {
  metrics?: Record<string, number>;
  samplePidsByLane?: Record<string, Array<string | number>>;
};

type ConditionSplitReport = {
  metrics?: Record<string, number>;
  laneSamples?: Record<string, Array<string | number>>;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

function toPidSet(values: Array<string | number> | undefined): Set<string> {
  return new Set((values ?? []).map((value) => String(value)));
}

async function main(): Promise<void> {
  const signal = await readJson<SignalCarrierReport>("smartwatch-applewatch-series9-45mm-gps-battery90plus-signal-carrier-split-latest.json");
  const owner = await readJson<OwnerCareReport>("smartwatch-applewatch-series9-45mm-gps-battery90plus-owner-care-bundle-split-latest.json");
  const condition = await readJson<ConditionSplitReport>("smartwatch-applewatch-series9-45mm-gps-battery90plus-condition-splits-latest.json");

  const signalClean = toPidSet(signal.laneSamples?.descriptionCarriedCleanPids);
  const ownerClean = toPidSet(owner.samplePidsByLane?.ownerCareNoPremium);
  const conditionClean = toPidSet(condition.laneSamples?.cleanPersonalUsedPids);

  const signalAndOwner = [...signalClean].filter((pid) => ownerClean.has(pid));
  const signalAndCondition = [...signalClean].filter((pid) => conditionClean.has(pid));
  const ownerAndCondition = [...ownerClean].filter((pid) => conditionClean.has(pid));
  const allThree = signalAndOwner.filter((pid) => conditionClean.has(pid));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_clean_overlap_report_only",
    metrics: {
      signalCarrierCleanRows: Number(signal.metrics?.descriptionCarriedCleanRows ?? 0),
      ownerCareNoPremiumRows: Number(owner.metrics?.ownerCareNoPremiumRows ?? 0),
      conditionCleanPersonalUsedRows: Number(condition.metrics?.cleanPersonalUsedRows ?? 0),
      overlapSignalAndOwnerCareRows: signalAndOwner.length,
      overlapSignalAndConditionRows: signalAndCondition.length,
      overlapOwnerCareAndConditionRows: ownerAndCondition.length,
      overlapAllThreeRows: allThree.length,
      runtimeApprovedRows: 0,
    },
    overlapPids: {
      signalCarrierClean: [...signalClean],
      ownerCareNoPremium: [...ownerClean],
      conditionCleanPersonalUsed: [...conditionClean],
      signalAndOwnerCare: signalAndOwner,
      signalAndCondition: signalAndCondition,
      ownerCareAndCondition: ownerAndCondition,
      allThree,
    },
    policyImplications: [
      "This packet checks whether the clean Series9 row is consistently the same listing across signal-carrier, owner-care, and condition packets.",
      "If the same PID survives all three packets, the Series9 lane is small but coherent rather than three disconnected tiny stories.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "thicken the coherent overlap lane before adding any title fallback or confidence discussion",
      "keep description-carried bundle rows separate so accessory payload does not collapse into the clean overlap story",
    ],
    doNotDo: [
      "Do not treat overlap coherence as runtime approval",
      "Do not merge bundle-heavy description rows into the clean overlap lane",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Clean Overlap",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only overlap packet across Series9 signal-carrier, owner-care, and condition clean lanes.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Overlap PIDs",
    "",
    ...Object.entries(report.overlapPids).map(([k, v]) => `- ${k}: ${(v as Array<string | number>).join(", ") || "-"}`),
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap-latest.md");
  console.log(`applewatch series9 clean overlap: all_three=${allThree.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
