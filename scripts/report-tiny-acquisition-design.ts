import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Candidate = {
  lane: string;
  fetched: number;
  activeClean: number;
  reviewRows: number;
  evidence: string;
};

type OwnerPacket = {
  approvedCandidates?: Candidate[];
};

const root = process.cwd();
const reportDir = path.join(root, "reports");

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = path.join(reportDir, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function lanePlan(lane: Candidate) {
  const common = {
    lane: lane.lane,
    evidence: lane.evidence,
    futureWriteCap: lane.activeClean,
    mode: "owner_approval_required_internal_only",
    sameRequestGuards: [
      "fresh detail refetch",
      "active sale status",
      "normal listing type",
      "same comparable key as detail-verification report",
      "no public promotion",
      "no candidate-pool release",
    ],
  };
  if (lane.lane === "airpods_max_usbc") {
    return {
      ...common,
      acceptedScope: "AirPods Max USB-C only with explicit USB-C/C-type evidence.",
      hardExclusions: ["Lightning/8-pin/old generation", "color-only/2024-only ambiguity", "case/cushion/parts", "fake/clone", "buying", "damaged"],
    };
  }
  if (lane.lane === "sony_headphone_xm4_ch520") {
    return {
      ...common,
      acceptedScope: "Sony WH-1000XM4 and WH-CH520 only.",
      hardExclusions: ["XM5/XM3/CH720N/Bose/AirPods Max", "earpad/cushion/case/pouch only", "buying", "damaged/audio failure"],
    };
  }
  if (lane.lane === "speaker_jbl_flip6") {
    return {
      ...common,
      acceptedScope: "JBL Flip 6 portable Bluetooth speaker only.",
      hardExclusions: ["other JBL models", "case/pouch/stand/charger only", "rental/PA/microphone/soundbar", "buying", "damaged"],
    };
  }
  if (lane.lane === "monitor_exact_model_code") {
    return {
      ...common,
      acceptedScope: "Selected monitor exact model-code rows only.",
      hardExclusions: ["monitor arm/stand/panel only", "TV", "PC bundle", "damaged panel", "generic model-name without model code"],
    };
  }
  if (lane.lane === "galaxy_buds_3_pro") {
    return {
      ...common,
      acceptedScope: "Galaxy Buds3 Pro full-set rows only.",
      hardExclusions: ["Galaxy Buds2/FE/Live/wrong model", "single unit/charging case/case/pouch/tips only", "buying", "fake/clone", "damaged/parts"],
    };
  }
  if (lane.lane === "ipad_pro_11_m4_256_wifi") {
    return {
      ...common,
      acceptedScope: "iPad Pro 11-inch M4 256GB Wi-Fi rows only.",
      hardExclusions: [
        "12.9/13-inch or iPad Air/Mini/wrong generation",
        "Cellular/LTE/5G/eSIM conflict",
        "512GB/1TB/2TB storage mismatch",
        "Apple Pencil/Magic Keyboard/case bundle price review",
        "accessory-only/parts/buying/damaged",
      ],
    };
  }
  if (lane.lane === "bose_qc_ultra") {
    return {
      ...common,
      acceptedScope: "Bose QC Ultra headphones (1세대/2세대 same-family comparable, owner-decision pending for split).",
      hardExclusions: ["QC45/QC35/QC25/QC15/NC700/QC Earbuds", "earpad/cushion/case/pouch only", "buying", "fake", "damaged/audio failure"],
    };
  }
  if (lane.lane === "switch_oled_base_unit_only") {
    return {
      ...common,
      acceptedScope: "Switch OLED 본체 + 기본 구성 (조이콘 좌/우 일체, 도크, 스탠드, 그립, HDMI 케이블, AC 어댑터)만 comparable.",
      hardExclusions: [
        "Switch 2 / Switch Lite / 구형 Switch (wrong model)",
        "게임 1~2개 동봉 (review→AI L2/manual, not hard exclusion)",
        "풀세트/다수 게임 (3+)/프로콘/캐리백/액세서리 번들",
        "buying/fake/damaged",
      ],
    };
  }
  if (lane.lane === "ps5_disc_basic") {
    return {
      ...common,
      acceptedScope: "PS5 Standard Disc 본체 + 기본 컨트롤러 1개 포함.",
      hardExclusions: [
        "Slim/Pro/Digital edition (별도 lane, 통합 금지)",
        "추가 컨트롤러/게임 1~2개/충전거치대/헤드셋 (review→AI L2/manual)",
        "다수 컨트롤러 (3+)/다수 게임 (3+)/풀세트",
        "buying/fake/damaged",
      ],
    };
  }
  if (lane.lane === "ps5_digital_basic") {
    return {
      ...common,
      acceptedScope: "PS5 Standard Digital 본체 + 기본 컨트롤러 1개 포함 (disc drive 없음).",
      hardExclusions: [
        "Disc edition (별도 lane, Disc/Digital 통합 금지)",
        "Slim/Pro (별도 lane)",
        "다수 컨트롤러/풀세트/다수 게임",
        "buying/fake/damaged",
      ],
    };
  }
  if (lane.lane === "ps5_slim_disc_basic") {
    return {
      ...common,
      acceptedScope: "PS5 Slim Disc 본체 + 기본 컨트롤러 1개 포함.",
      hardExclusions: [
        "Standard/Pro (별도 lane, 세대 통합 금지)",
        "Slim Digital (별도 lane, Disc/Digital 통합 금지)",
        "다수 컨트롤러/풀세트/다수 게임",
        "buying/fake/damaged",
      ],
    };
  }
  if (lane.lane === "ps5_slim_digital_basic") {
    return {
      ...common,
      acceptedScope: "PS5 Slim Digital 본체 + 기본 컨트롤러 1개 포함 (disc drive 없음).",
      hardExclusions: [
        "Standard/Pro (별도 lane, 세대 통합 금지)",
        "Slim Disc (별도 lane, Disc/Digital 통합 금지)",
        "다수 컨트롤러/풀세트/다수 게임",
        "buying/fake/damaged",
      ],
    };
  }
  return {
    ...common,
    acceptedScope: "Exact lane only.",
    hardExclusions: ["sold/inactive", "accessory/parts", "bundle requiring price normalization", "buying", "damaged"],
  };
}

async function main() {
  const ownerPacket = readJson<OwnerPacket>("tiny-acquisition-owner-packet-latest.json", {});
  const plans = (ownerPacket.approvedCandidates ?? []).map(lanePlan);
  const output = {
    generatedAt: new Date().toISOString(),
    scope: "tiny_acquisition_design_owner_approval_packet",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    plans,
    executionOrder: [
      "airpods_max_usbc",
      "sony_headphone_xm4_ch520",
      "speaker_jbl_flip6",
      "monitor_exact_model_code",
      "galaxy_buds_3_pro",
      "ipad_pro_11_m4_256_wifi",
      "bose_qc_ultra",
      "switch_oled_base_unit_only",
      "ps5_disc_basic",
      "ps5_digital_basic",
      "ps5_slim_disc_basic",
      "ps5_slim_digital_basic",
    ].filter((lane) => plans.some((plan) => plan.lane === lane)),
    globalContract: [
      "Owner must approve before any executor writes to Supabase.",
      "Executor must re-fetch detail in the same request before writing.",
      "Write cap per lane must be <= activeClean count from latest owner packet.",
      "Internal-only acquisition rows do not imply category readiness or public candidate pool release.",
      "AI L2 may explain ambiguity but cannot override sold/inactive/accessory/parts/bundle hard holds.",
    ],
  };

  const md = [
    "# Tiny Acquisition Design",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- scope: ${output.scope}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    `- lanes: ${plans.length}`,
    `- executionOrder: ${output.executionOrder.join(", ") || "-"}`,
    "",
    "## Plans",
    "",
    "| lane | cap | accepted scope | hard exclusions | evidence |",
    "| --- | ---: | --- | --- | --- |",
    ...plans.map((plan) =>
      `| ${plan.lane} | ${plan.futureWriteCap} | ${plan.acceptedScope} | ${plan.hardExclusions.join("; ")} | ${plan.evidence} |`,
    ),
    "",
    "## Same-Request Guards",
    "",
    ...plans.map((plan) => `- ${plan.lane}: ${plan.sameRequestGuards.join(", ")}`),
    "",
    "## Global Contract",
    "",
    ...output.globalContract.map((item) => `- ${item}`),
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "tiny-acquisition-design-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "tiny-acquisition-design-latest.md"), md);
  console.log("wrote reports/tiny-acquisition-design-latest.json");
  console.log("wrote reports/tiny-acquisition-design-latest.md");
  console.log(JSON.stringify({ lanes: plans.length, executionOrder: output.executionOrder }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
