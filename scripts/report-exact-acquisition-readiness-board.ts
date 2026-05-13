import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reportDir = path.join(root, "reports");

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = path.join(reportDir, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

type MonitorDetail = {
  activeClean?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type IpadDetail = {
  activeClean?: number;
  bundlePriceReview?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type IpadPro11M4Detail = {
  activeClean?: number;
  bundlePriceReview?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type Ps5Detail = {
  activeClean?: number;
  bundlePriceReview?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type Ps5SlimDetail = {
  activeClean?: number;
  bundlePriceReview?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type SwitchOledDetail = {
  activeClean?: number;
  bundlePriceReview?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type SonyHeadphoneDetail = {
  activeClean?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type JblFlip6Detail = {
  activeClean?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type AirpodsMaxUsbcDetail = {
  activeClean?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type CameraBodyExactDetail = {
  activeClean?: number;
  packageReview?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type GalaxyBuds3ProDetail = {
  activeClean?: number;
  holdOrReview?: number;
  detailFetched?: number;
  decision?: string;
};

type LgEvidence = {
  cleanRows?: number;
  recognizedComparableRows?: number;
  deterministicPatchCandidateRows?: number;
  totalRows?: number;
  decision?: string;
};

type BoseQcUltraVerification = {
  detail?: {
    fetched?: number;
    activeClean?: number;
    sold?: number;
    review?: number;
  };
};

type GameConsoleNarrowVerification = {
  detail?: {
    fetched?: number;
    fetchFailed?: number;
    inLane?: number;
    outOfLane?: number;
    sold?: number;
    live?: number;
    baseUnitOnly?: number;
    reviewAiL2Manual?: number;
    hardHold?: number;
    buyFakeDamaged?: number;
  };
};

type SampleSummary = {
  byTask?: Array<{
    taskId: string;
    fetched: number;
    clean: number;
    aiL2OrManual: number;
    hold: number;
  }>;
};

function pct(value: number, total: number) {
  if (total <= 0) return "0.0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

async function main() {
  const monitor = readJson<MonitorDetail>("monitor-exact-no-write-detail-verification-latest.json", {});
  const ipad = readJson<IpadDetail>("ipad-pro-13-m2-refined-no-write-detail-verification-latest.json", {});
  const ipadPro11M4 = readJson<IpadPro11M4Detail>("ipad-pro-11-m4-no-write-detail-verification-latest.json", {});
  const ps5 = readJson<Ps5Detail>("ps5-disc-digital-no-write-detail-verification-latest.json", {});
  const ps5Slim = readJson<Ps5SlimDetail>("ps5-slim-no-write-detail-verification-latest.json", {});
  const switchOled = readJson<SwitchOledDetail>("switch-oled-no-write-detail-verification-latest.json", {});
  const sonyHeadphone = readJson<SonyHeadphoneDetail>("sony-headphone-no-write-detail-verification-latest.json", {});
  const jblFlip6 = readJson<JblFlip6Detail>("jbl-flip6-no-write-detail-verification-latest.json", {});
  const airpodsMaxUsbc = readJson<AirpodsMaxUsbcDetail>("airpods-max-usbc-no-write-detail-verification-latest.json", {});
  const cameraBodyExact = readJson<CameraBodyExactDetail>("camera-body-exact-no-write-detail-verification-latest.json", {});
  const galaxyBuds3Pro = readJson<GalaxyBuds3ProDetail>("galaxy-buds3-pro-no-write-detail-verification-latest.json", {});
  const lg = readJson<LgEvidence>("lg-gram-17-modelcode-evidence-packet-latest.json", {});
  const boseQcUltra = readJson<BoseQcUltraVerification>("bose_qc_ultra-no-write-verification-latest.json", {});
  const switchOledBaseUnit = readJson<GameConsoleNarrowVerification>("switch_oled_base_unit_only-no-write-verification-latest.json", {});
  const ps5DiscBasic = readJson<GameConsoleNarrowVerification>("ps5_disc_basic-no-write-verification-latest.json", {});
  const ps5DigitalBasic = readJson<GameConsoleNarrowVerification>("ps5_digital_basic-no-write-verification-latest.json", {});
  const ps5SlimDiscBasic = readJson<GameConsoleNarrowVerification>("ps5_slim_disc_basic-no-write-verification-latest.json", {});
  const ps5SlimDigitalBasic = readJson<GameConsoleNarrowVerification>("ps5_slim_digital_basic-no-write-verification-latest.json", {});
  const summary = readJson<SampleSummary>("exact-acquisition-no-write-sample-summary-latest.json", {});

  const lanes = [
    {
      lane: "monitor_exact_model_code",
      stage: "detail_verified_no_write",
      evidence: "reports/monitor-exact-no-write-detail-verification-latest.md",
      fetched: monitor.detailFetched ?? 0,
      activeClean: monitor.activeClean ?? 0,
      reviewRows: monitor.holdOrReview ?? 0,
      readiness: (monitor.activeClean ?? 0) >= 8 ? "owner_review_tiny_acquisition_design_ready" : "needs_more_detail_evidence",
      next: "Owner approval can turn this into a tiny capped acquisition/backfill design. Broad monitor remains closed.",
      blocker: "False-hold review for multi/parts wording before runtime policy.",
    },
    {
      lane: "sony_headphone_xm4_ch520",
      stage: "detail_verified_no_write",
      evidence: "reports/sony-headphone-no-write-detail-verification-latest.md",
      fetched: sonyHeadphone.detailFetched ?? 0,
      activeClean: sonyHeadphone.activeClean ?? 0,
      reviewRows: sonyHeadphone.holdOrReview ?? 0,
      readiness: (sonyHeadphone.activeClean ?? 0) >= 8 ? "owner_review_tiny_acquisition_design_ready" : "needs_more_detail_evidence",
      next: "Owner approval can turn this into a tiny capped internal acquisition design. Broad headphone remains closed.",
      blocker: "Keep allowed SKUs limited to Sony WH-1000XM4 and WH-CH520; no Bose/AirPods Max/parts expansion.",
    },
    {
      lane: "speaker_jbl_flip6",
      stage: "detail_verified_no_write",
      evidence: "reports/jbl-flip6-no-write-detail-verification-latest.md",
      fetched: jblFlip6.detailFetched ?? 0,
      activeClean: jblFlip6.activeClean ?? 0,
      reviewRows: jblFlip6.holdOrReview ?? 0,
      readiness: (jblFlip6.activeClean ?? 0) >= 4 ? "owner_review_tiny_acquisition_design_ready" : "thin_needs_more_detail_evidence",
      next: "If active clean stays >=4 in a second wave, owner can review tiny internal-only acquisition. Broad speaker remains closed.",
      blocker: "Thin lane; keep case-only/rental/PA/mixed bundle rows hard-held.",
    },
    {
      lane: "airpods_max_usbc",
      stage: "detail_verified_no_write",
      evidence: "reports/airpods-max-usbc-no-write-detail-verification-latest.md",
      fetched: airpodsMaxUsbc.detailFetched ?? 0,
      activeClean: airpodsMaxUsbc.activeClean ?? 0,
      reviewRows: airpodsMaxUsbc.holdOrReview ?? 0,
      readiness: (airpodsMaxUsbc.activeClean ?? 0) >= 6 ? "owner_review_tiny_acquisition_design_ready" : "thin_or_connector_ambiguous_needs_more_detail_evidence",
      next: "If strict explicit USB-C active clean rows stay >=6, owner can review tiny internal-only acquisition. Broad AirPods Max remains connector-gated.",
      blocker: "Require explicit USB-C/C-type detail evidence; color-only/new-model/2024 hints, Lightning, case/cushion/parts rows stay review or hold.",
    },
    {
      lane: "switch_oled",
      stage: "detail_verified_no_write",
      evidence: "reports/switch-oled-no-write-detail-verification-latest.md",
      fetched: switchOled.detailFetched ?? 0,
      activeClean: switchOled.activeClean ?? 0,
      reviewRows: switchOled.holdOrReview ?? 0,
      readiness: (switchOled.activeClean ?? 0) >= 8 ? "owner_review_tiny_acquisition_design_ready" : (switchOled.activeClean ?? 0) >= 4 ? "promising_but_needs_second_detail_wave" : "not_ready_live_bundle_blocked",
      next: "Run a second fresh no-write detail wave if active clean is 4-7. Keep Switch 2/Lite/accessory/game bundles closed.",
      blocker: "Bundle/game/accessory pressure must stay review-only; full-set and body-only should not merge without owner policy.",
    },
    {
      lane: "ps5_disc_digital_standard",
      stage: "detail_verified_no_write",
      evidence: "reports/ps5-disc-digital-no-write-detail-verification-latest.md",
      fetched: ps5.detailFetched ?? 0,
      activeClean: ps5.activeClean ?? 0,
      reviewRows: ps5.holdOrReview ?? 0,
      readiness: (ps5.activeClean ?? 0) >= 4 ? "owner_review_tiny_acquisition_design_ready" : "not_ready_bundle_live_blocked",
      next: "Keep no-write. Needs more fresh active clean rows or bundle normalization before acquisition.",
      blocker: "High sold/inactive and game/controller bundle pressure; standard Disc/Digital parser bug was fixed but volume is not enough yet.",
    },
    {
      lane: "ps5_slim",
      stage: "detail_verified_no_write",
      evidence: "reports/ps5-slim-no-write-detail-verification-latest.md",
      fetched: ps5Slim.detailFetched ?? 0,
      activeClean: ps5Slim.activeClean ?? 0,
      reviewRows: ps5Slim.holdOrReview ?? 0,
      readiness: (ps5Slim.activeClean ?? 0) >= 6 ? "owner_review_tiny_acquisition_design_ready" : (ps5Slim.activeClean ?? 0) >= 4 ? "promising_but_needs_second_detail_wave" : "not_ready_bundle_live_blocked",
      next: "Run a second fresh no-write detail wave if active clean is 4-5. Keep Slim Disc/Digital separate from Standard, Pro, Portal, accessories, and game bundles.",
      blocker: "Slim listings often include games/controllers/stands or omit edition; bundle rows stay review-only.",
    },
    {
      lane: "camera_body_only_exact_model",
      stage: "detail_verified_no_write",
      evidence: "reports/camera-body-exact-no-write-detail-verification-latest.md",
      fetched: cameraBodyExact.detailFetched ?? 0,
      activeClean: cameraBodyExact.activeClean ?? 0,
      reviewRows: cameraBodyExact.holdOrReview ?? 0,
      readiness: (cameraBodyExact.activeClean ?? 0) >= 6 ? "owner_review_tiny_acquisition_design_ready" : (cameraBodyExact.activeClean ?? 0) >= 4 ? "promising_but_needs_second_detail_wave" : "not_ready_package_live_blocked",
      next: "If active clean stays >=6 in a second wave, owner can review tiny internal-only camera acquisition. Broad camera remains closed.",
      blocker: "Lens kit/full-set/accessory/fixed-lens/damaged rows stay review-only; exact body model must be visible.",
    },
    {
      lane: "galaxy_buds_3_pro",
      stage: "detail_verified_no_write",
      evidence: "reports/galaxy-buds3-pro-no-write-detail-verification-latest.md",
      fetched: galaxyBuds3Pro.detailFetched ?? 0,
      activeClean: galaxyBuds3Pro.activeClean ?? 0,
      reviewRows: galaxyBuds3Pro.holdOrReview ?? 0,
      readiness: (galaxyBuds3Pro.activeClean ?? 0) >= 6 ? "owner_review_tiny_acquisition_design_ready" : (galaxyBuds3Pro.activeClean ?? 0) >= 4 ? "promising_but_needs_second_detail_wave" : "not_ready_parts_live_blocked",
      next: "Run a second fresh full-set focused wave if active clean is 4-5. Keep single-unit/case/buying/fake rows excluded.",
      blocker: "Galaxy Buds live rows have strong single-unit/case/buying pressure; full-set proof must be explicit.",
    },
    {
      lane: "ipad_pro_11_m4_256_wifi",
      stage: "detail_verified_no_write",
      evidence: "reports/ipad-pro-11-m4-no-write-detail-verification-latest.md",
      fetched: ipadPro11M4.detailFetched ?? 0,
      activeClean: ipadPro11M4.activeClean ?? 0,
      reviewRows: ipadPro11M4.holdOrReview ?? 0,
      readiness: (ipadPro11M4.activeClean ?? 0) >= 4 ? "owner_review_tiny_acquisition_design_ready" : "not_ready_live_bundle_blocked",
      next: "Owner can review tiny internal-only acquisition only if bundle/live pressure stays controlled in another wave. Broad tablet remains closed.",
      blocker: "Keep 13-inch/Air/Cellular/accessory/bundle rows review-only.",
    },
    {
      lane: "ipad_pro_13_m2_refined_wifi",
      stage: "detail_verified_no_write",
      evidence: "reports/ipad-pro-13-m2-refined-no-write-detail-verification-latest.md",
      fetched: ipad.detailFetched ?? 0,
      activeClean: ipad.activeClean ?? 0,
      reviewRows: ipad.holdOrReview ?? 0,
      readiness: (ipad.activeClean ?? 0) >= 6 ? "owner_review_tiny_acquisition_design_ready" : "not_ready_live_bundle_blocked",
      next: "Keep no-write. Add live detail filter and decide bundle normalization/review policy before acquisition.",
      blocker: "Search query is good, but sold/inactive and Apple Pencil/Magic Keyboard bundle pressure is high.",
    },
    {
      lane: "lg_gram_17_2024_modelcode",
      stage: "post_patch_no_write_replay",
      evidence: "reports/lg-gram-17-modelcode-evidence-packet-latest.md",
      fetched: lg.totalRows ?? 0,
      activeClean: lg.cleanRows ?? 0,
      reviewRows: Math.max(0, (lg.totalRows ?? 0) - (lg.cleanRows ?? 0)),
      readiness: (lg.deterministicPatchCandidateRows ?? 0) === 0 ? "deterministic_modelcode_gap_consumed_ai_l2_residual" : "needs_more_deterministic_patch",
      next: "Stop broad deterministic patching. Residual rows need explicit RAM/SSD/chip or AI L2/manual review.",
      blocker: "RAM/SSD/chip often missing; Pro/older generation must stay hold.",
    },
    {
      lane: "bose_qc_ultra",
      stage: "detail_verified_no_write",
      evidence: "reports/bose_qc_ultra-no-write-detail-verification-adapter-latest.md",
      fetched: boseQcUltra.detail?.fetched ?? 0,
      activeClean: boseQcUltra.detail?.activeClean ?? 0,
      reviewRows: (boseQcUltra.detail?.sold ?? 0) + (boseQcUltra.detail?.review ?? 0),
      readiness: (boseQcUltra.detail?.activeClean ?? 0) >= 6 ? "owner_review_tiny_acquisition_design_ready" : "needs_more_detail_evidence",
      next: "Owner approval can turn this into a tiny capped internal acquisition design. Broad earphone/headphone remains closed.",
      blocker: "1세대/2세대 currently treated as same-family comparable; separate generation pricing policy pending owner decision. Keep accessory/parts/damaged/buying rows hard-held.",
    },
    {
      lane: "switch_oled_base_unit_only",
      stage: "policy_applied_no_write_verified",
      evidence: "reports/switch_oled_base_unit_only-no-write-detail-verification-adapter-latest.md",
      fetched: switchOledBaseUnit.detail?.inLane ?? 0,
      activeClean: switchOledBaseUnit.detail?.baseUnitOnly ?? 0,
      reviewRows: (switchOledBaseUnit.detail?.inLane ?? 0) - (switchOledBaseUnit.detail?.baseUnitOnly ?? 0),
      readiness: (switchOledBaseUnit.detail?.baseUnitOnly ?? 0) >= 4 ? "owner_review_tiny_acquisition_design_ready" : "needs_more_detail_evidence",
      next: "Owner approval can turn this into a tiny capped internal acquisition. Game 1~2개 동봉은 AI L2/manual review, 풀세트/액세서리 번들은 hard hold (정책 wave2 owner decision).",
      blocker: "본체+기본 구성만 comparable. 게임 1~2 = AI L2. 풀세트/프로콘/캐리백 등 = hard hold. Switch 2/Lite는 wrong_model 차단.",
    },
    {
      lane: "ps5_disc_basic",
      stage: "policy_applied_no_write_verified",
      evidence: "reports/ps5_disc_basic-no-write-detail-verification-adapter-latest.md",
      fetched: ps5DiscBasic.detail?.inLane ?? 0,
      activeClean: ps5DiscBasic.detail?.baseUnitOnly ?? 0,
      reviewRows: (ps5DiscBasic.detail?.inLane ?? 0) - (ps5DiscBasic.detail?.baseUnitOnly ?? 0),
      readiness: (ps5DiscBasic.detail?.baseUnitOnly ?? 0) >= 8 ? "owner_review_tiny_acquisition_design_ready" : "needs_more_detail_evidence",
      next: "Owner approval can turn this into a tiny capped internal acquisition. Disc/Digital/Standard/Slim/Pro 별도 lane 통합 금지.",
      blocker: "기본 컨트롤러 1개 포함은 comparable. 추가 컨트롤러/게임/액세서리는 AI L2/manual. Standard vs Slim vs Pro 시세 별도.",
    },
    {
      lane: "ps5_digital_basic",
      stage: "policy_applied_no_write_verified",
      evidence: "reports/ps5_digital_basic-no-write-detail-verification-adapter-latest.md",
      fetched: ps5DigitalBasic.detail?.inLane ?? 0,
      activeClean: ps5DigitalBasic.detail?.baseUnitOnly ?? 0,
      reviewRows: (ps5DigitalBasic.detail?.inLane ?? 0) - (ps5DigitalBasic.detail?.baseUnitOnly ?? 0),
      readiness: (ps5DigitalBasic.detail?.baseUnitOnly ?? 0) >= 8 ? "owner_review_tiny_acquisition_design_ready" : "needs_more_detail_evidence",
      next: "Owner approval can turn this into a tiny capped internal acquisition. Disc와 통합 금지.",
      blocker: "기본 컨트롤러 1개 포함 comparable. Disc/Digital 가격 차이 50k 확인 (530k vs 480k).",
    },
    {
      lane: "ps5_slim_disc_basic",
      stage: "policy_applied_no_write_verified",
      evidence: "reports/ps5_slim_disc_basic-no-write-detail-verification-adapter-latest.md",
      fetched: ps5SlimDiscBasic.detail?.inLane ?? 0,
      activeClean: ps5SlimDiscBasic.detail?.baseUnitOnly ?? 0,
      reviewRows: (ps5SlimDiscBasic.detail?.inLane ?? 0) - (ps5SlimDiscBasic.detail?.baseUnitOnly ?? 0),
      readiness: (ps5SlimDiscBasic.detail?.baseUnitOnly ?? 0) >= 8 ? "owner_review_tiny_acquisition_design_ready" : "needs_more_detail_evidence",
      next: "Owner approval can turn this into a tiny capped internal acquisition. Standard와 Slim 통합 금지, Slim Disc/Digital은 별도.",
      blocker: "기본 컨트롤러 1개 comparable. Slim median 690k. 추가 액세서리/게임/컨트롤러는 AI L2/manual.",
    },
    {
      lane: "ps5_slim_digital_basic",
      stage: "policy_applied_no_write_verified",
      evidence: "reports/ps5_slim_digital_basic-no-write-detail-verification-adapter-latest.md",
      fetched: ps5SlimDigitalBasic.detail?.inLane ?? 0,
      activeClean: ps5SlimDigitalBasic.detail?.baseUnitOnly ?? 0,
      reviewRows: (ps5SlimDigitalBasic.detail?.inLane ?? 0) - (ps5SlimDigitalBasic.detail?.baseUnitOnly ?? 0),
      readiness: (ps5SlimDigitalBasic.detail?.baseUnitOnly ?? 0) >= 8 ? "owner_review_tiny_acquisition_design_ready" : "needs_more_detail_evidence",
      next: "Owner approval can turn this into a tiny capped internal acquisition. Slim Disc와 통합 금지 (시장에서 가격 수렴 관찰됐지만 정책상 별도 유지).",
      blocker: "기본 컨트롤러 1개 comparable. Slim Disc/Digital median 동일 690k 관찰. 추가 액세서리/게임은 AI L2/manual.",
    },
  ];

  const searchOnlyRows = summary.byTask ?? [];
  const output = {
    generatedAt: new Date().toISOString(),
    scope: "exact_acquisition_no_write_readiness_board",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    lanes,
    searchOnlyRows,
    decision:
      "Monitor exact model-code and Sony WH-1000XM4/WH-CH520 have enough detail-verified clean rows for owner-reviewed tiny acquisition design. PS5 and iPad need live/bundle policy or more fresh detail evidence. LG Gram model-code parser gap is consumed; residual goes to AI L2/manual.",
  };

  const md = [
    "# Exact Acquisition Readiness Board",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- scope: ${output.scope}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    "",
    "## Lane Status",
    "",
    "| lane | stage | fetched | active clean | review/hold | active rate | readiness | blocker | next |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |",
    ...lanes.map((lane) =>
      `| ${lane.lane} | ${lane.stage} | ${lane.fetched} | ${lane.activeClean} | ${lane.reviewRows} | ${pct(lane.activeClean, lane.fetched)} | ${lane.readiness} | ${lane.blocker} | ${lane.next} |`,
    ),
    "",
    "## Search-Only Context",
    "",
    "| task | fetched | clean | aiL2/manual | hold |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...searchOnlyRows.map((row) => `| ${row.taskId} | ${row.fetched} | ${row.clean} | ${row.aiL2OrManual} | ${row.hold} |`),
    "",
    "## Decision",
    "",
    `- ${output.decision}`,
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "exact-acquisition-readiness-board-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "exact-acquisition-readiness-board-latest.md"), md);
  console.log("wrote reports/exact-acquisition-readiness-board-latest.json");
  console.log("wrote reports/exact-acquisition-readiness-board-latest.md");
  console.log(
    JSON.stringify({
      lanes: lanes.map((lane) => ({
        lane: lane.lane,
        fetched: lane.fetched,
        activeClean: lane.activeClean,
        readiness: lane.readiness,
      })),
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
