export type RegistryReadinessStep = {
  name: string;
  command: string[];
};

export type RegistryEvidenceSpec = {
  file: string;
  role: string;
  metrics: string[];
};

export type RegistryPacketPhase =
  | "baseline"
  | "boundary"
  | "review"
  | "positive-density"
  | "structure";

export type RegistryPacketGroup = {
  key: string;
  category: string;
  family: string;
  phase: RegistryPacketPhase;
  tags: string[];
  notes: string[];
  scripts: readonly string[];
};

export type PacketSuiteSpec = {
  key: string;
  category: string;
  readinessSteps: RegistryReadinessStep[];
  latestPhaseFiles: string[];
  manifestFiles: string[];
  evidenceSpecs?: RegistryEvidenceSpec[];
};

export type RegistryChainArtifacts = {
  readinessSteps: RegistryReadinessStep[];
  latestPhaseFiles: string[];
  manifestFiles: string[];
  evidenceSpecs: RegistryEvidenceSpec[];
};

const reportBaseFromScript = (scriptFile: string): string => scriptFile.replace(/^report-/, "").replace(/\.ts$/, "");

const packetScriptPath = (scriptFile: string): string => `scripts/${scriptFile}`;

const makePacketGroup = (group: RegistryPacketGroup): RegistryPacketGroup => group;
const makePacketSuite = (suite: PacketSuiteSpec): PacketSuiteSpec => suite;

const unique = <T>(items: T[]): T[] => [...new Set(items)];

export type RegistryPacketArtifact = {
  scriptFile: string;
  base: string;
  scriptPath: string;
  reportJsonPath: string;
  reportMdPath: string;
  manifestMdName: string;
};

export function compilePacketArtifacts(scriptFiles: readonly string[]): RegistryPacketArtifact[] {
  return scriptFiles.map((scriptFile) => {
    const base = reportBaseFromScript(scriptFile);
    return {
      scriptFile,
      base,
      scriptPath: packetScriptPath(scriptFile),
      reportJsonPath: `reports/${base}-latest.json`,
      reportMdPath: `reports/${base}-latest.md`,
      manifestMdName: `${base}-latest.md`,
    };
  });
}

export function compileLatestPhaseFiles(artifacts: readonly RegistryPacketArtifact[]): string[] {
  return artifacts.flatMap((artifact) => [artifact.scriptPath, artifact.reportJsonPath, artifact.reportMdPath]);
}

export function compileManifestFiles(artifacts: readonly RegistryPacketArtifact[]): string[] {
  return artifacts.map((artifact) => artifact.manifestMdName);
}




const monitorPacketScripts = [
  "report-monitor-model-code-blockers.ts",
  "report-monitor-model-code-deep-dive.ts",
  "report-monitor-hint-false-positive-review.ts",
  "report-monitor-test-candidate-readiness.ts",
  "report-monitor-exclusion-readiness.ts",
  "report-monitor-exclusion-evidence-matrix.ts",
  "report-monitor-pending-model-code-evidence.ts",
  "report-monitor-pending-model-spec-evidence.ts",
] as const;

export const monitorReadinessSteps: RegistryReadinessStep[] = [
  { name: "monitor", command: ["npx", "tsx", "scripts/report-monitor-parser.ts"] },
  { name: "monitor-model-code-blockers", command: ["npx", "tsx", "scripts/report-monitor-model-code-blockers.ts"] },
  { name: "monitor-model-code-deep-dive", command: ["npx", "tsx", "scripts/report-monitor-model-code-deep-dive.ts"] },
  { name: "monitor-hint-false-positive-review", command: ["npx", "tsx", "scripts/report-monitor-hint-false-positive-review.ts"] },
  { name: "monitor-test-candidate-readiness", command: ["npx", "tsx", "scripts/report-monitor-test-candidate-readiness.ts"] },
  { name: "monitor-exclusion-readiness", command: ["npx", "tsx", "scripts/report-monitor-exclusion-readiness.ts"] },
  { name: "monitor-exclusion-evidence-matrix", command: ["npx", "tsx", "scripts/report-monitor-exclusion-evidence-matrix.ts"] },
  { name: "monitor-pending-model-code-evidence", command: ["npx", "tsx", "scripts/report-monitor-pending-model-code-evidence.ts"] },
  { name: "monitor-pending-model-spec-evidence", command: ["npx", "tsx", "scripts/report-monitor-pending-model-spec-evidence.ts"] },
];

const monitorPacketArtifacts = compilePacketArtifacts(monitorPacketScripts);

export const monitorLatestPhaseFiles: string[] = compileLatestPhaseFiles(monitorPacketArtifacts);

export const monitorManifestFiles: string[] = compileManifestFiles(monitorPacketArtifacts);

export const monitorCategoryEvidenceSpecs: RegistryEvidenceSpec[] = [
  { file: "monitor-exclusion-evidence-matrix-latest.json", role: "generic/accessory/review exclusion boundary", metrics: ["matrixRows", "hardExclusionRows", "reviewGatedRows", "confirmedTestCandidates"] },
  { file: "monitor-pending-model-code-evidence-latest.json", role: "pending model-code unknown boundary", metrics: ["pendingRows", "criticalUnknownRows", "confirmedTestCandidates"] },
  { file: "monitor-pending-model-spec-evidence-latest.json", role: "pending model-code external spec evidence", metrics: ["externallyResolvedResolutionRows", "externallyResolvedRefreshRows", "refreshStillUnknownRows", "confirmedTestCandidates"] },
];

const desktopPacketScripts = [
  "report-desktop-full-unit-blockers.ts",
  "report-desktop-partial-key-deep-dive.ts",
  "report-desktop-token-review.ts",
  "report-desktop-test-candidate-readiness.ts",
  "report-desktop-test-candidate-token-evidence.ts",
  "report-desktop-cpu-gpu-title-token-boundary-evidence.ts",
  "report-desktop-exclusion-readiness.ts",
  "report-desktop-exclusion-evidence-matrix.ts",
] as const;

export const desktopReadinessSteps: RegistryReadinessStep[] = [
  { name: "desktop", command: ["npx", "tsx", "scripts/report-desktop-parser.ts"] },
  { name: "desktop-full-unit-blockers", command: ["npx", "tsx", "scripts/report-desktop-full-unit-blockers.ts"] },
  { name: "desktop-partial-key-deep-dive", command: ["npx", "tsx", "scripts/report-desktop-partial-key-deep-dive.ts"] },
  { name: "desktop-token-review", command: ["npx", "tsx", "scripts/report-desktop-token-review.ts"] },
  { name: "desktop-test-candidate-readiness", command: ["npx", "tsx", "scripts/report-desktop-test-candidate-readiness.ts"] },
  { name: "desktop-test-candidate-token-evidence", command: ["npx", "tsx", "scripts/report-desktop-test-candidate-token-evidence.ts"] },
  { name: "desktop-cpu-gpu-title-token-boundary-evidence", command: ["npx", "tsx", "scripts/report-desktop-cpu-gpu-title-token-boundary-evidence.ts"] },
  { name: "desktop-exclusion-readiness", command: ["npx", "tsx", "scripts/report-desktop-exclusion-readiness.ts"] },
  { name: "desktop-exclusion-evidence-matrix", command: ["npx", "tsx", "scripts/report-desktop-exclusion-evidence-matrix.ts"] },
];

const desktopPacketArtifacts = compilePacketArtifacts(desktopPacketScripts);

export const desktopLatestPhaseFiles: string[] = compileLatestPhaseFiles(desktopPacketArtifacts);

export const desktopManifestFiles: string[] = compileManifestFiles(desktopPacketArtifacts);

export const desktopCategoryEvidenceSpecs: RegistryEvidenceSpec[] = [
  { file: "desktop-test-candidate-token-evidence-latest.json", role: "CPU/GPU unresolved test-candidate boundary", metrics: ["testCandidateOnlyRows", "unresolvedCpuOrGpuRows", "genericDesktopRows"] },
  { file: "desktop-cpu-gpu-title-token-boundary-evidence-latest.json", role: "CPU/GPU title-token vs key mismatch boundary", metrics: ["rowsWithBothTitleTokens", "unresolvedKeyDespiteTitleTokenRows", "ambiguousCpuTokenRows", "genericKeyDespiteTokensRows"] },
  { file: "desktop-exclusion-evidence-matrix-latest.json", role: "GPU-only/commercial exclusion boundary", metrics: ["matrixRows", "gpuOnlyRows", "commercialOrMiningRows", "positiveCandidateRows"] },
];

const gameConsolePacketScripts = [
  "report-game-console-body-blockers.ts",
  "report-game-console-strict-parser-deep-dive.ts",
  "report-game-console-edition-token-review.ts",
  "report-game-console-exclusion-readiness.ts",
  "report-game-console-coverage-matrix.ts",
  "report-game-console-evidence-matrix.ts",
  "report-game-console-body-edition-boundary-evidence.ts",
  "report-game-console-contamination-blockers.ts",
  "report-game-console-contamination-evidence-matrix.ts",
] as const;

export const gameConsoleReadinessSteps: RegistryReadinessStep[] = [
  { name: "game-console-broad", command: ["npx", "tsx", "scripts/report-game-console-narrowing.ts", "--category=game_console_discovered"] },
  { name: "game-console-body-narrow", command: ["npx", "tsx", "scripts/report-game-console-narrowing.ts", "--category=game_console_body_narrow"] },
  { name: "game-console-parser", command: ["npx", "tsx", "scripts/report-game-console-parser.ts", "--category=game_console_body_narrow"] },
  { name: "game-console-body-blockers", command: ["npx", "tsx", "scripts/report-game-console-body-blockers.ts"] },
  { name: "game-console-strict-parser-deep-dive", command: ["npx", "tsx", "scripts/report-game-console-strict-parser-deep-dive.ts"] },
  { name: "game-console-edition-token-review", command: ["npx", "tsx", "scripts/report-game-console-edition-token-review.ts"] },
  { name: "game-console-exclusion-readiness", command: ["npx", "tsx", "scripts/report-game-console-exclusion-readiness.ts"] },
  { name: "game-console-coverage-matrix", command: ["npx", "tsx", "scripts/report-game-console-coverage-matrix.ts"] },
  { name: "game-console-evidence-matrix", command: ["npx", "tsx", "scripts/report-game-console-evidence-matrix.ts"] },
  { name: "game-console-body-edition-boundary-evidence", command: ["npx", "tsx", "scripts/report-game-console-body-edition-boundary-evidence.ts"] },
  { name: "game-console-contamination-blockers", command: ["npx", "tsx", "scripts/report-game-console-contamination-blockers.ts"] },
  { name: "game-console-contamination-evidence-matrix", command: ["npx", "tsx", "scripts/report-game-console-contamination-evidence-matrix.ts"] },
];

const gameConsolePacketArtifacts = compilePacketArtifacts(gameConsolePacketScripts);

export const gameConsoleLatestPhaseFiles: string[] = compileLatestPhaseFiles(gameConsolePacketArtifacts);

export const gameConsoleManifestFiles: string[] = compileManifestFiles(gameConsolePacketArtifacts);

export const gameConsoleBodyCategoryEvidenceSpecs: RegistryEvidenceSpec[] = [
  { file: "game-console-evidence-matrix-latest.json", role: "body_narrow coverage/exclusion boundary", metrics: ["coverageRows", "positiveCoverageRows", "reviewGatedCoverageRows", "exclusionRows"] },
  { file: "game-console-body-edition-boundary-evidence-latest.json", role: "body_narrow edition/body review boundary", metrics: ["positiveUnits", "reviewGatedUnits", "switch2Units", "ps5Units", "unknownEditionUnits", "unknownBodyUnits"] },
];

export const gameConsoleBroadCategoryEvidenceSpecs: RegistryEvidenceSpec[] = [
  { file: "game-console-contamination-evidence-matrix-latest.json", role: "broad category contamination boundary", metrics: ["broadConsoleCandidateRows", "broadConsoleCandidateRate", "contaminationRows", "contaminationRate", "bodyNarrowConsoleCandidateRate"] },
];

const cameraPacketScripts = [
  "report-camera-package-blockers.ts",
  "report-camera-package-deep-dive.ts",
  "report-camera-fixed-lens-accessory-review.ts",
  "report-camera-interchangeable-package-review.ts",
  "report-camera-false-merge-risk-matrix.ts",
  "report-camera-package-evidence-matrix.ts",
  "report-camera-package-signal-boundary-evidence.ts",
  "report-camera-package-title-token-boundary-evidence.ts",
] as const;

export const cameraReadinessSteps: RegistryReadinessStep[] = [
  { name: "camera", command: ["npx", "tsx", "scripts/report-camera-parser.ts"] },
  { name: "camera-package-blockers", command: ["npx", "tsx", "scripts/report-camera-package-blockers.ts"] },
  { name: "camera-package-deep-dive", command: ["npx", "tsx", "scripts/report-camera-package-deep-dive.ts"] },
  { name: "camera-fixed-lens-accessory-review", command: ["npx", "tsx", "scripts/report-camera-fixed-lens-accessory-review.ts"] },
  { name: "camera-interchangeable-package-review", command: ["npx", "tsx", "scripts/report-camera-interchangeable-package-review.ts"] },
  { name: "camera-false-merge-risk-matrix", command: ["npx", "tsx", "scripts/report-camera-false-merge-risk-matrix.ts"] },
  { name: "camera-package-evidence-matrix", command: ["npx", "tsx", "scripts/report-camera-package-evidence-matrix.ts"] },
  { name: "camera-package-signal-boundary-evidence", command: ["npx", "tsx", "scripts/report-camera-package-signal-boundary-evidence.ts"] },
  { name: "camera-package-title-token-boundary-evidence", command: ["npx", "tsx", "scripts/report-camera-package-title-token-boundary-evidence.ts"] },
];

const cameraPacketArtifacts = compilePacketArtifacts(cameraPacketScripts);

export const cameraLatestPhaseFiles: string[] = compileLatestPhaseFiles(cameraPacketArtifacts);

export const cameraManifestFiles: string[] = compileManifestFiles(cameraPacketArtifacts);

export const cameraCategoryEvidenceSpecs: RegistryEvidenceSpec[] = [
  { file: "camera-package-evidence-matrix-latest.json", role: "package/body-only/lens-kit evidence boundary", metrics: ["matrixRows", "unknownPackageEvidenceRows", "lensKitReferenceRows", "bodyOnlyReferenceRows"] },
  { file: "camera-package-signal-boundary-evidence-latest.json", role: "unknown package signal boundary", metrics: ["unknownPackageRows", "recoveryLikeUnknownPackageRows", "missingSignalUnknownPackageRows", "bodyOnlyReferenceRows"] },
  { file: "camera-package-title-token-boundary-evidence-latest.json", role: "package title-token boundary", metrics: ["lensIdentityTokenRows", "bodyOnlyTokenRows", "fullBoxTokenRows", "accessoryBundleTokenRows", "missingPackageTitleTokenRows"] },
];

const speakerPacketScripts = [
  "report-speaker-family-blockers.ts",
  "report-speaker-family-deep-dive.ts",
  "report-speaker-device-class-review.ts",
  "report-speaker-device-class-boundary-evidence.ts",
  "report-speaker-portable-model-subset-boundary-evidence.ts",
  "report-speaker-generic-exclusion-readiness.ts",
  "report-speaker-portable-conditions-matrix.ts",
  "report-speaker-portable-generic-overlap-evidence.ts",
] as const;

export const speakerReadinessSteps: RegistryReadinessStep[] = [
  { name: "speaker", command: ["npx", "tsx", "scripts/report-speaker-parser.ts"] },
  { name: "speaker-family-blockers", command: ["npx", "tsx", "scripts/report-speaker-family-blockers.ts"] },
  { name: "speaker-family-deep-dive", command: ["npx", "tsx", "scripts/report-speaker-family-deep-dive.ts"] },
  { name: "speaker-device-class-review", command: ["npx", "tsx", "scripts/report-speaker-device-class-review.ts"] },
  { name: "speaker-device-class-boundary-evidence", command: ["npx", "tsx", "scripts/report-speaker-device-class-boundary-evidence.ts"] },
  { name: "speaker-portable-model-subset-boundary-evidence", command: ["npx", "tsx", "scripts/report-speaker-portable-model-subset-boundary-evidence.ts"] },
  { name: "speaker-generic-exclusion-readiness", command: ["npx", "tsx", "scripts/report-speaker-generic-exclusion-readiness.ts"] },
  { name: "speaker-portable-conditions-matrix", command: ["npx", "tsx", "scripts/report-speaker-portable-conditions-matrix.ts"] },
  { name: "speaker-portable-generic-overlap-evidence", command: ["npx", "tsx", "scripts/report-speaker-portable-generic-overlap-evidence.ts"] },
];

const speakerPacketArtifacts = compilePacketArtifacts(speakerPacketScripts);

export const speakerLatestPhaseFiles: string[] = compileLatestPhaseFiles(speakerPacketArtifacts);

export const speakerManifestFiles: string[] = compileManifestFiles(speakerPacketArtifacts);

export const speakerCategoryEvidenceSpecs: RegistryEvidenceSpec[] = [
  { file: "speaker-portable-generic-overlap-evidence-latest.json", role: "portable family vs generic overlap", metrics: ["genericRows", "brandOnlyOverlapRows", "modelTokenOverlapRows", "noOverlapRows"] },
  { file: "speaker-device-class-boundary-evidence-latest.json", role: "amp/PA/unknown variant boundary", metrics: ["boundaryRows", "ampReceiverRows", "paSpeakerRows", "unknownVariantRows"] },
  { file: "speaker-portable-model-subset-boundary-evidence-latest.json", role: "portable exact-model subset boundary", metrics: ["portableExactModelUnits", "unknownVariantUnits", "ampReceiverUnits", "paSpeakerUnits"] },
];

const homeAppliancePacketScripts = [
  "report-home-appliance-blockers.ts",
  "report-home-appliance-deep-dive.ts",
  "report-home-appliance-logistics-generic-review.ts",
  "report-home-appliance-vacuum-test-candidate-readiness.ts",
  "report-home-appliance-vacuum-model-subtype-boundary-evidence.ts",
  "report-home-appliance-generic-vacuum-exclusion-readiness.ts",
  "report-home-appliance-vacuum-overlap-evidence.ts",
  "report-home-appliance-vacuum-subtype-boundary-evidence.ts",
] as const;

export const homeApplianceReadinessSteps: RegistryReadinessStep[] = [
  { name: "home-appliance", command: ["npx", "tsx", "scripts/report-home-appliance-parser.ts"] },
  { name: "home-appliance-blockers", command: ["npx", "tsx", "scripts/report-home-appliance-blockers.ts"] },
  { name: "home-appliance-deep-dive", command: ["npx", "tsx", "scripts/report-home-appliance-deep-dive.ts"] },
  { name: "home-appliance-logistics-generic-review", command: ["npx", "tsx", "scripts/report-home-appliance-logistics-generic-review.ts"] },
  { name: "home-appliance-vacuum-test-candidate-readiness", command: ["npx", "tsx", "scripts/report-home-appliance-vacuum-test-candidate-readiness.ts"] },
  { name: "home-appliance-vacuum-model-subtype-boundary-evidence", command: ["npx", "tsx", "scripts/report-home-appliance-vacuum-model-subtype-boundary-evidence.ts"] },
  { name: "home-appliance-generic-vacuum-exclusion-readiness", command: ["npx", "tsx", "scripts/report-home-appliance-generic-vacuum-exclusion-readiness.ts"] },
  { name: "home-appliance-vacuum-overlap-evidence", command: ["npx", "tsx", "scripts/report-home-appliance-vacuum-overlap-evidence.ts"] },
  { name: "home-appliance-vacuum-subtype-boundary-evidence", command: ["npx", "tsx", "scripts/report-home-appliance-vacuum-subtype-boundary-evidence.ts"] },
];

const homeAppliancePacketArtifacts = compilePacketArtifacts(homeAppliancePacketScripts);

export const homeApplianceLatestPhaseFiles: string[] = compileLatestPhaseFiles(homeAppliancePacketArtifacts);

export const homeApplianceManifestFiles: string[] = compileManifestFiles(homeAppliancePacketArtifacts);

export const homeApplianceCategoryEvidenceSpecs: RegistryEvidenceSpec[] = [
  { file: "home-appliance-vacuum-overlap-evidence-latest.json", role: "vacuum model-ready vs generic overlap", metrics: ["modelReadyRows", "genericRows", "brandOnlyOverlapRows", "modelTokenOverlapRows"] },
  { file: "home-appliance-vacuum-model-subtype-boundary-evidence-latest.json", role: "model-ready vacuum subtype boundary", metrics: ["stickOrHandheldUnits", "robotVacuumUnits", "logisticsRiskCount"] },
  { file: "home-appliance-vacuum-subtype-boundary-evidence-latest.json", role: "vacuum subtype boundary", metrics: ["evidenceRows", "beddingCleanerRows", "robotVacuumRows", "accessoryPartsRows"] },
];

const headphonePacketScripts = [
  "report-headphone-matched-sku-blockers.ts",
  "report-headphone-matched-sku-evidence-matrix.ts",
  "report-headphone-airpods-max-review-evidence.ts",
] as const;

export const headphoneReadinessSteps: RegistryReadinessStep[] = [
  { name: "headphone", command: ["npx", "tsx", "scripts/report-headphone-parser.ts"] },
  { name: "headphone-matched-sku-blockers", command: ["npx", "tsx", "scripts/report-headphone-matched-sku-blockers.ts"] },
  { name: "headphone-matched-sku-evidence-matrix", command: ["npx", "tsx", "scripts/report-headphone-matched-sku-evidence-matrix.ts"] },
  { name: "headphone-airpods-max-review-evidence", command: ["npx", "tsx", "scripts/report-headphone-airpods-max-review-evidence.ts"] },
];

const headphonePacketArtifacts = compilePacketArtifacts(headphonePacketScripts);

export const headphoneLatestPhaseFiles: string[] = compileLatestPhaseFiles(headphonePacketArtifacts);

export const headphoneManifestFiles: string[] = compileManifestFiles(headphonePacketArtifacts);

export const headphoneCategoryEvidenceSpecs: RegistryEvidenceSpec[] = [
  { file: "headphone-matched-sku-evidence-matrix-latest.json", role: "matched SKU positive boundary", metrics: ["normal", "normalWithSku", "parserReadyRate", "needsReviewRate", "unknownSkuExampleRows"] },
  { file: "headphone-airpods-max-review-evidence-latest.json", role: "AirPods Max connector/generation review gate", metrics: ["reviewRows", "unknownGenerationRows", "unknownConnectorRows", "explicitUsbcRows", "explicitLightningRows"] },
];

const earphonePacketScripts = [
  "report-earphone-airpods-blockers.ts",
  "report-earphone-airpods-evidence-matrix.ts",
  "report-earphone-galaxybuds-family-evidence.ts",
  "report-earphone-parts-exclusion-evidence.ts",
  "report-earphone-galaxybuds-priority-positive-buckets.ts",
] as const;

export const earphoneReadinessSteps: RegistryReadinessStep[] = [
  { name: "earphone", command: ["npx", "tsx", "scripts/report-earphone-parser.ts"] },
  { name: "earphone-airpods-blockers", command: ["npx", "tsx", "scripts/report-earphone-airpods-blockers.ts"] },
  { name: "earphone-airpods-evidence-matrix", command: ["npx", "tsx", "scripts/report-earphone-airpods-evidence-matrix.ts"] },
  { name: "earphone-galaxybuds-family-evidence", command: ["npx", "tsx", "scripts/report-earphone-galaxybuds-family-evidence.ts"] },
  { name: "earphone-parts-exclusion-evidence", command: ["npx", "tsx", "scripts/report-earphone-parts-exclusion-evidence.ts"] },
  { name: "earphone-galaxybuds-priority-positive-buckets", command: ["npx", "tsx", "scripts/report-earphone-galaxybuds-priority-positive-buckets.ts"] },
];

const earphonePacketArtifacts = compilePacketArtifacts(earphonePacketScripts);

export const earphoneLatestPhaseFiles: string[] = compileLatestPhaseFiles(earphonePacketArtifacts);

export const earphoneManifestFiles: string[] = compileManifestFiles(earphonePacketArtifacts);

export const earphoneCategoryEvidenceSpecs: RegistryEvidenceSpec[] = [
  { file: "earphone-airpods-evidence-matrix-latest.json", role: "AirPods-only positive boundary", metrics: ["normal", "parserReadyRate", "partsRows", "unknownRows", "buyingOrCalloutRows"] },
  { file: "earphone-galaxybuds-family-evidence-latest.json", role: "Galaxy Buds family/model-scope boundary", metrics: ["totalGalaxyBudsRows", "normalRows", "partsRows", "buyingOrCalloutRows", "scopeCount"] },
  { file: "earphone-galaxybuds-priority-positive-buckets-latest.json", role: "Galaxy Buds narrow explicit positive buckets", metrics: ["galaxyBudsRows", "budsFeSurvivingRows", "buds3ProSurvivingRows", "buds3SurvivingRows", "scopeCount"] },
  { file: "earphone-parts-exclusion-evidence-latest.json", role: "parts/accessory exclusion boundary", metrics: ["partsRows", "directExclusionRows", "ambiguousPartsRows"] },
];

const smartwatchPacketScripts = [
  "report-smartwatch-ambiguity-blockers.ts",
  "report-smartwatch-ambiguity-evidence-matrix.ts",
  "report-smartwatch-applewatch-generation-evidence.ts",
  "report-smartwatch-applewatch-fullset-generation-positives.ts",
  "report-smartwatch-applewatch-connectivity-review-evidence.ts",
  "report-smartwatch-applewatch-priority-positive-buckets.ts",
  "report-smartwatch-applewatch-positive-review-balance.ts",
  "report-smartwatch-applewatch-priority-bucket-cluster-audit.ts",
  "report-smartwatch-applewatch-risk-scope-dependency.ts",
  "report-smartwatch-applewatch-scope-independence-audit.ts",
  "report-smartwatch-applewatch-se3-overlap-lanes.ts",
  "report-smartwatch-applewatch-se3-shared-core-seller-split.ts",
  "report-smartwatch-applewatch-se3-personal-vs-starlight-used.ts",
  "report-smartwatch-applewatch-series10-titanium-context.ts",
  "report-smartwatch-applewatch-series10-titanium-condition-splits.ts",
  "report-smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split.ts",
  "report-smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches.ts",
  "report-smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers.ts",
  "report-smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-context.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-condition-splits.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-owner-care-bundle-split.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-signal-carrier-split.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-coherent-lane-thickening.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-thickening.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-bundle-adjacent-lanes.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-candidates.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-box-vs-strap-adjacency.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-boxonly-neighbor-context.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-neighbor-wording-survival.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blockers.ts",
  "report-smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-row-composition.ts",
  "report-smartwatch-applewatch-series10-vs-series9-positive-comparison.ts",
  "report-smartwatch-applewatch-series10-vs-series9-condition-balance.ts",
  "report-smartwatch-galaxywatch-priority-positive-buckets.ts",
  "report-smartwatch-galaxywatch-watch7-watch8-pressure.ts",
  "report-smartwatch-galaxywatch-watch7-44mm-clean-openbox-nonmerchant-thickening.ts",
  "report-smartwatch-galaxywatch-watch7-44mm-bluetooth-explicit-noconflict-nonmerchant-personal-used-thickening.ts",
  "report-smartwatch-galaxywatch-watch7-vs-watch8-44mm-bluetooth.ts",
  "report-smartwatch-galaxywatch-watch8-vs-watch7-44mm-personal-clean.ts",
  "report-smartwatch-galaxywatch-watch8-40mm-bluetooth-explicit.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-personal-clean-context.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-activation-accessory-pressure.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-pressure-row-classes.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-overlap-context-split.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-row-semantics.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-merchant-fullbox-row-semantics.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-nonunopened-blocker-scoreboard.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit-noconflict-personal-used.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-connectivity-conflict-lanes.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-unopened-contamination-lanes.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-unopened-context.ts",
  "report-smartwatch-galaxywatch-watch8-44mm-wifi-noconflict.ts",
  "report-smartwatch-galaxywatch-watch8-connectivity-lanes.ts",
  "report-smartwatch-connectivity-size-evidence.ts",
  "report-smartwatch-connectivity-model-boundary-evidence.ts",
  "report-smartwatch-strap-accessory-evidence.ts",
] as const;

export const smartwatchReadinessSteps: RegistryReadinessStep[] = [
  { name: "smartwatch", command: ["npx", "tsx", "scripts/report-smartwatch-parser.ts"] },
  { name: "smartwatch-ambiguity-blockers", command: ["npx", "tsx", "scripts/report-smartwatch-ambiguity-blockers.ts"] },
  { name: "smartwatch-ambiguity-evidence-matrix", command: ["npx", "tsx", "scripts/report-smartwatch-ambiguity-evidence-matrix.ts"] },
  { name: "smartwatch-applewatch-generation-evidence", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-generation-evidence.ts"] },
  { name: "smartwatch-applewatch-fullset-generation-positives", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-fullset-generation-positives.ts"] },
  { name: "smartwatch-applewatch-connectivity-review-evidence", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-connectivity-review-evidence.ts"] },
  { name: "smartwatch-applewatch-priority-positive-buckets", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-priority-positive-buckets.ts"] },
  { name: "smartwatch-applewatch-positive-review-balance", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-positive-review-balance.ts"] },
  { name: "smartwatch-applewatch-priority-bucket-cluster-audit", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-priority-bucket-cluster-audit.ts"] },
  { name: "smartwatch-applewatch-risk-scope-dependency", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-risk-scope-dependency.ts"] },
  { name: "smartwatch-applewatch-scope-independence-audit", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-scope-independence-audit.ts"] },
  { name: "smartwatch-applewatch-se3-overlap-lanes", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-se3-overlap-lanes.ts"] },
  { name: "smartwatch-applewatch-se3-shared-core-seller-split", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-se3-shared-core-seller-split.ts"] },
  { name: "smartwatch-applewatch-se3-personal-vs-starlight-used", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-se3-personal-vs-starlight-used.ts"] },
  { name: "smartwatch-applewatch-series10-titanium-context", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series10-titanium-context.ts"] },
  { name: "smartwatch-applewatch-series10-titanium-condition-splits", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series10-titanium-condition-splits.ts"] },
  { name: "smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split.ts"] },
  { name: "smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches.ts"] },
  { name: "smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers.ts"] },
  { name: "smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-context", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-context.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-condition-splits", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-condition-splits.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-owner-care-bundle-split", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-owner-care-bundle-split.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-signal-carrier-split", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-signal-carrier-split.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-coherent-lane-thickening", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-coherent-lane-thickening.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-thickening", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-thickening.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-bundle-adjacent-lanes", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-bundle-adjacent-lanes.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-candidates", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-candidates.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-box-vs-strap-adjacency", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-box-vs-strap-adjacency.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-boxonly-neighbor-context", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-boxonly-neighbor-context.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-neighbor-wording-survival", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-neighbor-wording-survival.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blockers", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blockers.ts"] },
  { name: "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-row-composition", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-row-composition.ts"] },
  { name: "smartwatch-applewatch-series10-vs-series9-positive-comparison", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series10-vs-series9-positive-comparison.ts"] },
  { name: "smartwatch-applewatch-series10-vs-series9-condition-balance", command: ["npx", "tsx", "scripts/report-smartwatch-applewatch-series10-vs-series9-condition-balance.ts"] },
  { name: "smartwatch-galaxywatch-priority-positive-buckets", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-priority-positive-buckets.ts"] },
  { name: "smartwatch-galaxywatch-watch7-watch8-pressure", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch7-watch8-pressure.ts"] },
  { name: "smartwatch-galaxywatch-watch7-44mm-clean-openbox-nonmerchant-thickening", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch7-44mm-clean-openbox-nonmerchant-thickening.ts"] },
  { name: "smartwatch-galaxywatch-watch7-44mm-bluetooth-explicit-noconflict-nonmerchant-personal-used-thickening", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch7-44mm-bluetooth-explicit-noconflict-nonmerchant-personal-used-thickening.ts"] },
  { name: "smartwatch-galaxywatch-watch7-vs-watch8-44mm-bluetooth", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch7-vs-watch8-44mm-bluetooth.ts"] },
  { name: "smartwatch-galaxywatch-watch8-vs-watch7-44mm-personal-clean", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-vs-watch7-44mm-personal-clean.ts"] },
  { name: "smartwatch-galaxywatch-watch8-40mm-bluetooth-explicit", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-40mm-bluetooth-explicit.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-personal-clean-context", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-personal-clean-context.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-activation-accessory-pressure", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-activation-accessory-pressure.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-pressure-row-classes", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-pressure-row-classes.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-overlap-context-split", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-overlap-context-split.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-row-semantics", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-row-semantics.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-merchant-fullbox-row-semantics", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-merchant-fullbox-row-semantics.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-nonunopened-blocker-scoreboard", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-nonunopened-blocker-scoreboard.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit-noconflict-personal-used", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit-noconflict-personal-used.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-connectivity-conflict-lanes", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-connectivity-conflict-lanes.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-unopened-contamination-lanes", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-unopened-contamination-lanes.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-unopened-context", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-unopened-context.ts"] },
  { name: "smartwatch-galaxywatch-watch8-44mm-wifi-noconflict", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-44mm-wifi-noconflict.ts"] },
  { name: "smartwatch-galaxywatch-watch8-connectivity-lanes", command: ["npx", "tsx", "scripts/report-smartwatch-galaxywatch-watch8-connectivity-lanes.ts"] },
  { name: "smartwatch-connectivity-size-evidence", command: ["npx", "tsx", "scripts/report-smartwatch-connectivity-size-evidence.ts"] },
  { name: "smartwatch-connectivity-model-boundary-evidence", command: ["npx", "tsx", "scripts/report-smartwatch-connectivity-model-boundary-evidence.ts"] },
  { name: "smartwatch-strap-accessory-evidence", command: ["npx", "tsx", "scripts/report-smartwatch-strap-accessory-evidence.ts"] },
];

const smartwatchPacketArtifacts = compilePacketArtifacts(smartwatchPacketScripts);

export const smartwatchLatestPhaseFiles: string[] = compileLatestPhaseFiles(smartwatchPacketArtifacts);

export const smartwatchManifestFiles: string[] = compileManifestFiles(smartwatchPacketArtifacts);

export const smartwatchCategoryEvidenceSpecs: RegistryEvidenceSpec[] = [
  { file: "smartwatch-ambiguity-evidence-matrix-latest.json", role: "size/connectivity ambiguity overview", metrics: ["parserReadyRate", "needsReviewRate", "reviewRows", "strapSuspectRows"] },
  { file: "smartwatch-applewatch-generation-evidence-latest.json", role: "Apple Watch generation direct evidence boundary", metrics: ["explicitGenerationRows", "ambiguousGenerationRows", "multiGenerationRollupRows", "scopeCount"] },
  { file: "smartwatch-applewatch-fullset-generation-positives-latest.json", role: "Apple Watch explicit generation full-set opportunity packet", metrics: ["strongFullsetRows", "nearFullsetRows", "accessoryRiskRows", "missingConnectivityOrSizeRows", "generationScopeCount"] },
  { file: "smartwatch-applewatch-connectivity-review-evidence-latest.json", role: "Apple Watch connectivity/fit wording review packet", metrics: ["cellularReadyRows", "cellularWarningRows", "pairingResetRows", "gpsOnlyRows", "crossSizeCompatibilityRows"] },
  { file: "smartwatch-applewatch-priority-positive-buckets-latest.json", role: "Apple Watch narrow priority positive buckets", metrics: ["se3UnopenedRows", "series10TitaniumRows", "series7StainlessCellularRows", "series9Battery90plusRows", "scopeCount"] },
  { file: "smartwatch-applewatch-positive-review-balance-latest.json", role: "Apple Watch positive vs review balance summary", metrics: ["positiveUnits", "reviewPressureUnits", "positiveToReviewRatio", "cellularReadyRows", "unknownConnectivityUnits"] },
  { file: "smartwatch-applewatch-priority-bucket-cluster-audit-latest.json", role: "Apple Watch priority bucket seller/template concentration audit", metrics: ["scopeCount", "highRiskScopes", "mediumRiskScopes", "lowRiskScopes"] },
  { file: "smartwatch-applewatch-risk-scope-dependency-latest.json", role: "Apple Watch risky positive scope merchant/overlap dependency audit", metrics: ["scopeCount", "merchantHeavyScopes", "overlapHeavyScopes", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-scope-independence-audit-latest.json", role: "Apple Watch risky scope pair overlap/independence audit", metrics: ["scopeCount", "pairCount", "highOverlapPairs", "mediumOverlapPairs", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-se3-overlap-lanes-latest.json", role: "Apple Watch SE3 starlight/battery overlap lane split", metrics: ["baseRows", "sharedCoreRows", "starlightUnopenedRows", "starlightUsedRows", "batteryNonstarlightRows"] },
  { file: "smartwatch-applewatch-se3-shared-core-seller-split-latest.json", role: "Apple Watch SE3 shared overlap core seller split", metrics: ["sharedCoreRows", "personalUsedRows", "merchantLikeRows", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-se3-personal-vs-starlight-used-latest.json", role: "Apple Watch SE3 personal-used core vs starlight-used comparison", metrics: ["sharedCorePersonalRows", "starlightUsedRows", "sharedCorePersonalMerchantLikeRows", "starlightUsedMerchantLikeRows", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-series10-titanium-context-latest.json", role: "Apple Watch Series10 titanium explicit-generation context packet", metrics: ["totalRows", "merchantLikeRows", "nonMerchantRows", "bundleRows", "fortyTwoRows", "fortySixRows", "gpsRows", "cellularRows"] },
  { file: "smartwatch-applewatch-series10-titanium-condition-splits-latest.json", role: "Apple Watch Series10 titanium condition/bundle split packet", metrics: ["totalRows", "cleanPersonalUsedRows", "lightBundleRows", "unopenedLikeRows", "merchantLikeRows", "heavyBundleRows", "cellularRows"] },
  { file: "smartwatch-applewatch-series10-46mm-battery90plus-clean-personal-used-split-latest.json", role: "Apple Watch Series10 46mm battery90+ clean personal-used split packet", metrics: ["baseRows", "nonMerchantRows", "personalUsedRows", "explicitGpsOrCleanConnectivityRows", "bundleRows", "premiumPitchRows", "unopenedRows", "cellularRows", "cleanPersonalUsedRows"] },
  { file: "smartwatch-applewatch-series10-46mm-battery90plus-care-vs-cellular-branches-latest.json", role: "Apple Watch Series10 46mm battery90+ care-backed GPS vs cellular-premium branch packet", metrics: ["baseRows", "nonMerchantRows", "personalRows", "gpsPersonalRows", "careBackedGpsRows", "plainCleanPersonalRows", "cellularPremiumRows", "bundleRows", "careRows", "cellularRows", "titaniumRows"] },
  { file: "smartwatch-applewatch-series10-46mm-battery90plus-branch-signal-carriers-latest.json", role: "Apple Watch Series10 46mm battery90+ branch signal-carrier packet", metrics: ["baseRows", "titleBatteryRows", "descriptionOnlyBatteryRows", "titlePlainBranchRows", "titleCareBranchRows", "descriptionOnlyCareBranchRows", "titleCellularPremiumRows", "descriptionOnlyCellularPremiumRows", "descriptionOnlyGpsRows"] },
  { file: "smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness-latest.json", role: "Apple Watch Series10 46mm vs Series9 45mm battery90+ cleanliness comparison packet", metrics: ["series10BaseRows", "series10CleanPersonalUsedRows", "series10BundleRows", "series10CellularRows", "series9BaseRows", "series9CleanPersonalUsedRows", "series9LightBundleRows", "series9CellularConflictRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-context-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ context packet", metrics: ["totalRows", "merchantLikeRows", "nonMerchantRows", "cellularConflictRows", "unopenedLikeRows", "bundleRows", "cleanPersonalUsedRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-condition-splits-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ condition/bundle split packet", metrics: ["totalRows", "cleanPersonalUsedRows", "lightBundleRows", "unopenedLikeRows", "merchantLikeRows", "heavyBundleRows", "cellularConflictRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-owner-care-bundle-split-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ owner-care vs bundle split packet", metrics: ["totalRows", "lightBundleOnlyRows", "premiumBundleRows", "ownerCareRows", "ownerCareNoPremiumRows", "personalUseReasonRows", "unopenedOrCellularRows", "cleanNoBundleRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-signal-carrier-split-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ title vs description signal-carrier split packet", metrics: ["totalRows", "titleBatteryRows", "descriptionOnlyBatteryRows", "titleGpsRows", "descriptionOnlyGpsRows", "titleModelRows", "descriptionOnlyModelRows", "descriptionCarriedCleanRows", "descriptionCarriedBundleRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ clean overlap across signal-carrier, owner-care, and condition packets", metrics: ["signalCarrierCleanRows", "ownerCareNoPremiumRows", "conditionCleanPersonalUsedRows", "overlapSignalAndOwnerCareRows", "overlapSignalAndConditionRows", "overlapAllThreeRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-coherent-lane-thickening-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ coherent lane thickening packet", metrics: ["totalRows", "coherentCoreRows", "adjacentOwnerCareRows", "adjacentDescriptionCarriedRows", "bundleAdjacentRows", "merchantLikeRows", "cellularConflictRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-bundle-adjacent-lanes-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ bundle-adjacent decomposition packet", metrics: ["totalBundleAdjacentRows", "premiumBundleRows", "strapOnlyRows", "boxOnlyRows", "accessoryHeavyRows", "ownerCareBundleRows", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-candidates-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ adjacent clean-candidate packet", metrics: ["baseRows", "coherentCoreRows", "adjacentCleanCandidateRows", "adjacentOwnerCareRows", "adjacentDescriptionSignalRows", "adjacentBodyOnlyRows", "adjacentBoxlessRows", "adjacentBundleRows", "adjacentCellularRows", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-box-vs-strap-adjacency-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ box-vs-strap adjacency packet", metrics: ["totalAdjacentBundleRows", "boxOnlyRows", "strapPresentRows", "boxAndStrapRows", "boxOwnerCareRows", "strapOwnerCareRows", "cellularContaminatedRows", "merchantLikeRows", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-boxonly-neighbor-context-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ box-only neighbor context packet", metrics: ["totalBoxOnlyRows", "ownerCareRows", "cosmeticWearRows", "sellerPitchRows", "cellularRows", "nonMerchantRows", "cleanBoxPackagingRows", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-neighbor-wording-survival-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ neighbor wording survival packet", metrics: ["baseRows", "coherentCoreRows", "adjacentRows", "residualNeighborRows", "residualOwnerCareRows", "residualConditionRows", "residualPersonalReasonRows", "residualMultiSignalRows", "residualThinRows", "bundleCarrierRows", "cellularCarrierRows", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blockers-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ adjacent wording blocker dominance packet", metrics: ["adjacentRows", "bundleRows", "boxRows", "strapRows", "ownerCareRows", "cosmeticWearRows", "sellerPitchRows", "cellularRows", "bundleAndPitchRows", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-row-composition-latest.json", role: "Apple Watch Series9 45mm GPS battery90+ adjacent row composition packet", metrics: ["adjacentRows", "boxOwnerCareRows", "strapOwnerCareRows", "bundlePitchRows", "boxCosmeticRows", "bundleCellularRows", "otherBundleNeighborRows", "runtimeApprovedRows"] },
  { file: "smartwatch-applewatch-series10-vs-series9-positive-comparison-latest.json", role: "Apple Watch Series10 vs Series9 positive comparison packet", metrics: ["series10Rows", "series9Rows", "series10NonMerchantRows", "series9NonMerchantRows", "series10CleanPersonalRows", "series9CleanPersonalRows"] },
  { file: "smartwatch-applewatch-series10-vs-series9-condition-balance-latest.json", role: "Apple Watch Series10 vs Series9 condition/bundle balance packet", metrics: ["series10TotalRows", "series9TotalRows", "series10CleanPersonalUsedRows", "series9CleanPersonalUsedRows", "series10MerchantLikeRows", "series9MerchantLikeRows", "series10UnopenedLikeRows", "series9UnopenedLikeRows"] },
  { file: "smartwatch-galaxywatch-priority-positive-buckets-latest.json", role: "Galaxy Watch narrow priority positive buckets", metrics: ["watch8Classic46BluetoothNewRows", "watch840BluetoothOnlyNewRows", "watch744CleanOpenboxRows", "watch6Classic43WifiWorkingRows", "scopeCount"] },
  { file: "smartwatch-galaxywatch-watch7-watch8-pressure-latest.json", role: "Galaxy Watch Watch7/Watch8 narrow pressure packet", metrics: ["scopeCount", "watch7CleanSurvivingRows", "watch7BluetoothSurvivingRows", "watch8NewPressureRawRows", "runtimeApprovedRows"] },
  { file: "smartwatch-galaxywatch-watch7-44mm-bluetooth-explicit-noconflict-nonmerchant-personal-used-thickening-latest.json", role: "Galaxy Watch7 44mm bluetooth explicit no-conflict non-merchant personal-used anchor packet", metrics: ["baseRows", "noConflictRows", "nonMerchantRows", "personalUsedRows", "accessoryRows", "chargerRows", "cleanRows"] },
  { file: "smartwatch-galaxywatch-watch7-vs-watch8-44mm-bluetooth-latest.json", role: "Galaxy Watch7 vs Watch8 44mm explicit Bluetooth purity comparison", metrics: ["watch7Rows", "watch8Rows", "watch7MerchantLikeRows", "watch8MerchantLikeRows", "watch7NonMerchantRows", "watch8NonMerchantRows"] },
  { file: "smartwatch-galaxywatch-watch8-vs-watch7-44mm-personal-clean-latest.json", role: "Galaxy Watch8 vs Watch7 44mm personal-clean comparison packet", metrics: ["watch7Rows", "watch8Rows", "watch7PersonalUsedRows", "watch8PersonalUsedRows", "watch7ExplicitBluetoothRows", "watch8ExplicitBluetoothRows"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-personal-clean-context-latest.json", role: "Galaxy Watch8 44mm personal-clean context packet", metrics: ["totalRows", "personalStoryRows", "explicitBluetoothRows", "activationFutureRows", "cleanNoConflictRows", "runtimeApprovedRows"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-activation-accessory-pressure-latest.json", role: "Galaxy Watch8 44mm activation-vs-accessory pressure packet", metrics: ["baseRows", "activationFutureRows", "accessoryBundleRows", "activationAndAccessoryRows", "activationOnlyRows", "accessoryOnlyRows", "merchantLikeRows", "nonMerchantRows", "cleanResidualRows", "runtimeApprovedRows"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-pressure-row-classes-latest.json", role: "Galaxy Watch8 44mm tiny pressure row-class packet", metrics: ["totalRows", "merchantActivationAccessoryRows", "personalAccessoryOnlyRows", "personalAccessoryActivationRows", "personalStoryRows", "cleanBodyRows", "runtimeApprovedRows"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-overlap-context-split-latest.json", role: "Galaxy Watch8 44mm overlap context split packet", metrics: ["baseRows", "overlapRows", "activationChargerNonMerchantRows", "merchantOwnerCareFullboxRows", "activationWithCosmeticWearRows", "chargerIncludedRows", "fullboxRows", "merchantLikeRows", "nonMerchantRows", "unmatchedOverlapRows", "runtimeApprovedRows"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-nonmerchant-activation-row-semantics-latest.json", role: "Galaxy Watch8 44mm non-merchant activation row semantics packet", metrics: ["totalNonMerchantActivationRows", "chargerRows", "cosmeticWearRows", "personalStoryRows", "lteCarrierRows", "explicitProblemRows", "cleanActivationRows", "runtimeApprovedRows"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-merchant-fullbox-row-semantics-latest.json", role: "Galaxy Watch8 44mm merchant-like fullbox row semantics packet", metrics: ["totalMerchantFullboxRows", "ownerCareRows", "chargerRows", "bundleRows", "activationRows", "cleanMerchantRows", "runtimeApprovedRows"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-nonunopened-blocker-scoreboard-latest.json", role: "Galaxy Watch8 44mm non-unopened blocker scoreboard packet", metrics: ["nonUnopenedRows", "activationChargerNonMerchantRows", "merchantFullboxRows", "cleanResidualRows", "connectivityConflictedRows", "accessoryBundleRows", "ownerCareRows", "runtimeApprovedRows"] },
  { file: "smartwatch-galaxywatch-watch8-40mm-bluetooth-explicit-latest.json", role: "Galaxy Watch8 40mm explicit Bluetooth comparison packet", metrics: ["rawRows", "survivingRows", "merchantLikeRows", "nonMerchantRows", "explicitLteMentions"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-bluetooth-explicit-latest.json", role: "Galaxy Watch8 44mm explicit Bluetooth narrow packet", metrics: ["rawRows", "survivingRows", "merchantLikeRows", "nonMerchantRows", "explicitLteMentions"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-unopened-contamination-lanes-latest.json", role: "Galaxy Watch8 44mm unopened-heavy contamination decomposition", metrics: ["baseRows", "accessoryBundleRows", "merchantLikeRows", "multiQtyRows", "completedMarkerRows", "connectivityConflictRows", "cleanUnopenedRows", "cleanUnopenedNoConnectivityConflictRows"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-connectivity-conflict-lanes-latest.json", role: "Galaxy Watch8 44mm connectivity conflict split", metrics: ["baseRows", "lteConflictRows", "activationConflictRows", "wifiOnlyRows", "wifiOnlyNoConflictRows", "merchantConflictRows"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-unopened-context-latest.json", role: "Galaxy Watch8 44mm unopened/open-box/accessory context packet", metrics: ["totalRows", "unopenedRows", "openboxRows", "accessoryBundleRows", "cleanUnopenedRows", "merchantLikeRows", "nonMerchantRows"] },
  { file: "smartwatch-galaxywatch-watch8-44mm-wifi-noconflict-latest.json", role: "Galaxy Watch8 44mm wifi/bluetooth-only no-conflict tiny slice", metrics: ["totalRows", "merchantLikeRows", "nonMerchantRows", "accessoryBundleRows", "multiQtyRows", "completedMarkerRows"] },
  { file: "smartwatch-galaxywatch-watch8-connectivity-lanes-latest.json", role: "Galaxy Watch8 connectivity lane split", metrics: ["baseRows", "bluetoothRows", "lteRows", "unknownConnectivityRows", "runtimeApprovedRows"] },
  { file: "smartwatch-connectivity-size-evidence-latest.json", role: "unknown size/connectivity gate", metrics: ["unknownConnectivityUnits", "unknownSizeUnits", "unknownConnectivityKeyRows", "unknownSizeKeyRows"] },
  { file: "smartwatch-connectivity-model-boundary-evidence-latest.json", role: "model-level connectivity boundary", metrics: ["modelsWithUnknownConnectivity", "unknownConnectivityUnits", "modelsWithUnknownSize", "unknownSizeUnits"] },
  { file: "smartwatch-strap-accessory-evidence-latest.json", role: "strap/accessory vs body-context boundary", metrics: ["strapAccessoryOnlyRows", "chargerStandAccessoryOnlyRows", "compatibilityRollupRows", "bodyWithAccessoryBundleRows", "bodyMissingCoreComponentRows"] },
];

export const registryPacketGroups: RegistryPacketGroup[] = [
  makePacketGroup({
    key: "smartwatch-wearables",
    category: "smartwatch",
    family: "Apple Watch / Galaxy Watch",
    phase: "positive-density",
    tags: ["guide-bridge", "wearables", "size", "connectivity", "generation", "accessory"],
    notes: [
      "Heaviest report-only family; includes narrow Apple Watch and Galaxy Watch thickening packets.",
      "Still report-only. Runtime parser wiring and promotion remain intentionally deferred.",
    ],
    scripts: smartwatchPacketScripts,
  }),
  makePacketGroup({
    key: "earphone-airpods-galaxybuds",
    category: "earphone",
    family: "AirPods / Galaxy Buds",
    phase: "positive-density",
    tags: ["guide-bridge", "audio", "connector", "anc", "parts"],
    notes: [
      "AirPods boundaries are stronger than Galaxy Buds positive density.",
      "Use this family to validate guide hints before any parser promotion work.",
    ],
    scripts: earphonePacketScripts,
  }),
  makePacketGroup({
    key: "headphone-airpodsmax",
    category: "headphone",
    family: "AirPods Max / matched SKU",
    phase: "boundary",
    tags: ["audio", "matched-sku", "headphone", "connector"],
    notes: [
      "Narrower than earphone; primarily a clean boundary family rather than a density family.",
    ],
    scripts: headphonePacketScripts,
  }),
  makePacketGroup({
    key: "monitor-modelcode",
    category: "monitor",
    family: "monitor model code",
    phase: "boundary",
    tags: ["display", "model-code", "pending-spec", "exclusion"],
    notes: [
      "Registry pilot covers model-code, pending-spec, and exclusion evidence packets.",
    ],
    scripts: monitorPacketScripts,
  }),
  makePacketGroup({
    key: "desktop-fullunit",
    category: "desktop",
    family: "desktop full-unit",
    phase: "boundary",
    tags: ["desktop", "cpu", "gpu", "test-candidate", "exclusion"],
    notes: [
      "Focuses on unresolved CPU/GPU token boundaries and full-unit vs component separation.",
    ],
    scripts: desktopPacketScripts,
  }),
  makePacketGroup({
    key: "game-console-body",
    category: "game-console",
    family: "console body narrow / broad",
    phase: "boundary",
    tags: ["console", "edition", "body", "contamination"],
    notes: [
      "Includes both body_narrow and broad contamination evidence in one family packet group.",
    ],
    scripts: gameConsolePacketScripts,
  }),
  makePacketGroup({
    key: "camera-package",
    category: "camera",
    family: "camera package / body-only / lens-kit",
    phase: "boundary",
    tags: ["camera", "package", "lens-kit", "body-only"],
    notes: [
      "Primarily package-state and title-token boundary verification.",
    ],
    scripts: cameraPacketScripts,
  }),
  makePacketGroup({
    key: "speaker-portable",
    category: "speaker",
    family: "portable speaker",
    phase: "boundary",
    tags: ["speaker", "portable", "device-class", "generic-overlap"],
    notes: [
      "Separates portable speakers from amp/receiver/PA and generic overlap noise.",
    ],
    scripts: speakerPacketScripts,
  }),
  makePacketGroup({
    key: "home-appliance-vacuum",
    category: "home-appliance",
    family: "vacuum subtype",
    phase: "boundary",
    tags: ["home-appliance", "vacuum", "subtype", "generic-overlap"],
    notes: [
      "Newest registry pilot family; still intentionally report-only.",
    ],
    scripts: homeAppliancePacketScripts,
  }),
];

const registryGroupByKey = new Map(registryPacketGroups.map((group) => [group.key, group]));

export function findRegistryPacketGroupByKey(key: string): RegistryPacketGroup | null {
  return registryGroupByKey.get(key) ?? null;
}

export const registryPacketSuites: PacketSuiteSpec[] = [
  makePacketSuite({
    key: "smartwatch",
    category: "smartwatch",
    readinessSteps: smartwatchReadinessSteps,
    latestPhaseFiles: smartwatchLatestPhaseFiles,
    manifestFiles: smartwatchManifestFiles,
    evidenceSpecs: smartwatchCategoryEvidenceSpecs,
  }),
  makePacketSuite({
    key: "earphone",
    category: "earphone",
    readinessSteps: earphoneReadinessSteps,
    latestPhaseFiles: earphoneLatestPhaseFiles,
    manifestFiles: earphoneManifestFiles,
    evidenceSpecs: earphoneCategoryEvidenceSpecs,
  }),
  makePacketSuite({
    key: "headphone",
    category: "headphone",
    readinessSteps: headphoneReadinessSteps,
    latestPhaseFiles: headphoneLatestPhaseFiles,
    manifestFiles: headphoneManifestFiles,
    evidenceSpecs: headphoneCategoryEvidenceSpecs,
  }),
  makePacketSuite({
    key: "monitor",
    category: "monitor",
    readinessSteps: monitorReadinessSteps,
    latestPhaseFiles: monitorLatestPhaseFiles,
    manifestFiles: monitorManifestFiles,
    evidenceSpecs: monitorCategoryEvidenceSpecs,
  }),
  makePacketSuite({
    key: "desktop",
    category: "desktop",
    readinessSteps: desktopReadinessSteps,
    latestPhaseFiles: desktopLatestPhaseFiles,
    manifestFiles: desktopManifestFiles,
    evidenceSpecs: desktopCategoryEvidenceSpecs,
  }),
  makePacketSuite({
    key: "game-console",
    category: "game-console",
    readinessSteps: gameConsoleReadinessSteps,
    latestPhaseFiles: gameConsoleLatestPhaseFiles,
    manifestFiles: gameConsoleManifestFiles,
    evidenceSpecs: [...gameConsoleBodyCategoryEvidenceSpecs, ...gameConsoleBroadCategoryEvidenceSpecs],
  }),
  makePacketSuite({
    key: "camera",
    category: "camera",
    readinessSteps: cameraReadinessSteps,
    latestPhaseFiles: cameraLatestPhaseFiles,
    manifestFiles: cameraManifestFiles,
    evidenceSpecs: cameraCategoryEvidenceSpecs,
  }),
  makePacketSuite({
    key: "speaker",
    category: "speaker",
    readinessSteps: speakerReadinessSteps,
    latestPhaseFiles: speakerLatestPhaseFiles,
    manifestFiles: speakerManifestFiles,
    evidenceSpecs: speakerCategoryEvidenceSpecs,
  }),
  makePacketSuite({
    key: "home-appliance",
    category: "home-appliance",
    readinessSteps: homeApplianceReadinessSteps,
    latestPhaseFiles: homeApplianceLatestPhaseFiles,
    manifestFiles: homeApplianceManifestFiles,
    evidenceSpecs: homeApplianceCategoryEvidenceSpecs,
  }),
];

export function compileChainArtifacts(suites: PacketSuiteSpec[]): RegistryChainArtifacts {
  return {
    readinessSteps: suites.flatMap((suite) => suite.readinessSteps),
    latestPhaseFiles: unique(suites.flatMap((suite) => suite.latestPhaseFiles)),
    manifestFiles: unique(suites.flatMap((suite) => suite.manifestFiles)),
    evidenceSpecs: unique(suites.flatMap((suite) => suite.evidenceSpecs ?? [])),
  };
}

export function summarizeRegistryTags(groups: RegistryPacketGroup[]): Array<{ tag: string; groups: number; packets: number }> {
  const counts = new Map<string, { groups: number; packets: number }>();

  for (const group of groups) {
    for (const tag of group.tags) {
      const current = counts.get(tag) ?? { groups: 0, packets: 0 };
      current.groups += 1;
      current.packets += group.scripts.length;
      counts.set(tag, current);
    }
  }

  return [...counts.entries()]
    .map(([tag, value]) => ({ tag, groups: value.groups, packets: value.packets }))
    .sort((a, b) => b.packets - a.packets || a.tag.localeCompare(b.tag));
}

export function summarizeRegistryPhases(
  groups: RegistryPacketGroup[],
): Array<{ phase: RegistryPacketPhase; groups: number; packets: number; categories: string[] }> {
  const counts = new Map<RegistryPacketPhase, { groups: number; packets: number; categories: Set<string> }>();

  for (const group of groups) {
    const current = counts.get(group.phase) ?? { groups: 0, packets: 0, categories: new Set<string>() };
    current.groups += 1;
    current.packets += group.scripts.length;
    current.categories.add(group.category);
    counts.set(group.phase, current);
  }

  return [...counts.entries()]
    .map(([phase, value]) => ({
      phase,
      groups: value.groups,
      packets: value.packets,
      categories: [...value.categories].sort(),
    }))
    .sort((a, b) => b.packets - a.packets || a.phase.localeCompare(b.phase));
}
