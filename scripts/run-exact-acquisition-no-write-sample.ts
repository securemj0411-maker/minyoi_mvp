import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { searchPage, type SearchItem } from "../src/lib/bunjang";
import { ruleMatch } from "../src/lib/catalog";
import { parseListingOptions } from "../src/lib/option-parser";
import { classifyListing } from "../src/lib/pipeline";

type WaveTask = {
  id: string;
  category: string;
  mode: string;
  status: string;
  scope: string[];
  evidence: string;
  forbidden: string;
};

type WaveReport = {
  tasks?: WaveTask[];
};

type SampleDecision = "clean_candidate" | "hold" | "ai_l2_or_manual";

const root = process.cwd();
const reportDir = path.join(root, "reports");
const wavePath = path.join(reportDir, "exact-acquisition-next-wave-latest.json");

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function intArg(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(arg(name, String(fallback)), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function norm(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function fileSlug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "all";
}

function holdReasonForTask(taskId: string, item: SearchItem, listingType: string, comparableKey: string | null): string[] {
  const text = norm(`${item.name} ${item.raw?.description ?? ""}`);
  const reasons: string[] = [];
  if (listingType !== "normal") reasons.push(`listing_type_${listingType}`);
  if (!comparableKey) reasons.push("missing_comparable_key");

  if (taskId.includes("lg_gram")) {
    if (!/lg|엘지|그램|gram/i.test(text)) reasons.push("missing_lg_gram");
    if (!/(17\s*인치|17\s*형|\b17z90s\b|\b17zd90s\b|\b17zd90su\b|\b17\b)/i.test(text)) reasons.push("missing_17_inch_or_model_code");
    if (!/(2024|코어\s*울트라|core\s*ultra|ultra\s*[57]|\b17z90s\b|\b17zd90s\b|\b17zd90su\b)/i.test(text)) reasons.push("missing_2024_or_ultra_context");
    if (/(그램\s*프로|gram\s*pro|rtx|13세대|12세대|11세대|202[0-3]|202[56]|삽니다|매입|구매|부품|액정|키보드|파우치)/i.test(text)) reasons.push("lg_gram_hold_signal");
  }

  if (taskId.includes("ipad_pro_13_m2")) {
    if (!/(아이패드|ipad)/i.test(text) || !/(프로|pro)/i.test(text)) reasons.push("missing_ipad_pro");
    if (!/(12\.9|13\s*인치|13\s*형)/i.test(text)) reasons.push("missing_12_9_or_13_context");
    if (!/(6세대|6\s*th|m2)/i.test(text)) reasons.push("missing_m2_or_6th_context");
    if (!/256/.test(text)) reasons.push("missing_256");
    if (!/(wifi|wi-fi|와이파이|와파|wlan)/i.test(text)) reasons.push("missing_explicit_wifi");
    if (/(4세대|5세대|m1|a2378|a2379|a2461|a2462)/i.test(text)) reasons.push("ipad_wrong_generation_signal");
    if (/(셀룰러|cellular|\blte\b|\b5g\b|유심|esim|wi-?fi\s*\+\s*cell|\bcell\b)/i.test(text)) reasons.push("ipad_cellular_signal");
    if (/(매입|삽니다|케이스|키보드\s*만|펜슬\s*만|액정|파손|부품)/i.test(text)) reasons.push("ipad_hold_signal");
  }

  if (taskId.includes("ipad_pro_11_m4")) {
    if (!/(아이패드|ipad)/i.test(text) || !/(프로|pro)/i.test(text)) reasons.push("missing_ipad_pro");
    if (!/(11\s*인치|11\s*형|11\"|11″|\b11\b)/i.test(text)) reasons.push("missing_11_context");
    if (!/\bm4\b/i.test(text)) reasons.push("missing_m4_context");
    if (!/256/.test(text)) reasons.push("missing_256");
    if (!/(wifi|wi-fi|와이파이|와파|wlan)/i.test(text)) reasons.push("missing_explicit_wifi");
    if (/(12\.9|13\s*인치|13\s*형|m1|m2|m3|아이패드\s*에어|ipad\s*air|아이패드\s*미니|ipad\s*mini)/i.test(text)) reasons.push("ipad_wrong_model_signal");
    if (/(셀룰러|cellular|\blte\b|\b5g\b|유심|esim|wi-?fi\s*\+\s*cell|\bcell\b)/i.test(text)) reasons.push("ipad_cellular_signal");
    if (/(512|1\s*tb|1테라|2\s*tb|2테라)/i.test(text)) reasons.push("ipad_wrong_storage_signal");
    if (/(매입|삽니다|구합니다|구매합니다|케이스\s*만|키보드\s*만|펜슬\s*만|액정|파손|부품)/i.test(text)) reasons.push("ipad_hold_signal");
  }

  if (taskId.includes("monitor")) {
    if (!/(모니터|monitor|zowie|alienware|ultragear|lg|삼성|samsung|benq|벤큐|dell)/i.test(text)) reasons.push("missing_monitor_context");
    if (/(거치대|암\b|모니터암|스탠드\s*만|부품|패널\s*만|티비|tv|본체|컴퓨터\s*풀세트|pc\s*세트|삽니다|매입)/i.test(text)) reasons.push("monitor_hold_signal");
  }

  if (taskId.includes("ps5_disc_digital")) {
    if (!/(ps5|플스\s*5|플스5|플레이스테이션\s*5|playstation\s*5)/i.test(text)) reasons.push("missing_ps5_context");
    if (!/(디스크|disc|디지털|digital|cd|씨디|cd롬)/i.test(text)) reasons.push("missing_disc_or_digital_edition");
    if (/(슬림|slim|프로|pro|ps5pro|ps5\s*pro|플스5\s*프로|vr|psvr|포탈|portal|스위치|switch)/i.test(text)) reasons.push("ps5_wrong_model_signal");
    if (/(패드\s*만|컨트롤러\s*만|듀얼센스\s*만|충전\s*거치대|충전거치대|케이스|커버|스킨|부품|디스크\s*드라이브\s*만)/i.test(text)) reasons.push("ps5_accessory_only_signal");
    if (/(게임\s*만|타이틀\s*만|cd\s*만|소프트웨어|계정|다운로드|dl\s*코드)/i.test(text)) reasons.push("ps5_game_or_account_signal");
    if (/(게임|타이틀|페르소나|스파이더맨|마일즈|듀얼센스\s*2개|컨트롤러\s*2개|패드\s*2개|\+\s*듀얼센스|\+\s*게임)/i.test(text)) reasons.push("ps5_bundle_price_review");
    if (/(삽니다|매입|구합니다|구매합니다)/i.test(text)) reasons.push("buying_signal");
    if (/(고장|파손|수리|침수|전원\s*안|부팅\s*안|불량|부품용)/i.test(text)) reasons.push("damaged_or_parts_signal");
  }

  if (taskId.includes("ps5_slim")) {
    if (!/(ps5|플스\s*5|플스5|플레이스테이션\s*5|playstation\s*5)/i.test(text)) reasons.push("missing_ps5_context");
    if (!/(슬림|slim)/i.test(text)) reasons.push("missing_slim_context");
    if (!/(디스크|disc|디지털|digital|cd|씨디|cd롬|cfi[-\s]?\d{4}\s*[ab]\b)/i.test(text)) reasons.push("missing_disc_or_digital_edition");
    if (/(프로|pro|ps5pro|ps5\s*pro|플스5\s*프로|vr|psvr|포탈|portal|스위치|switch|ps4|플스\s*4)/i.test(text)) reasons.push("ps5_slim_wrong_model_signal");
    if (/(패드\s*만|컨트롤러\s*만|듀얼센스\s*만|충전\s*거치대|충전거치대|케이스|커버|스킨|스탠드\s*만|거치대\s*만|부품|디스크\s*드라이브\s*만|ssd\s*만|ssd\s*단품)/i.test(text)) {
      reasons.push("ps5_slim_accessory_only_signal");
    }
    if (/(게임\s*만|타이틀\s*만|cd\s*만|소프트웨어|계정|다운로드|dl\s*코드|기프트|gift\s*card|월정액|psn\s*카드)/i.test(text)) reasons.push("ps5_game_or_account_signal");
    if (/(게임|타이틀|페르소나|스파이더맨|마일즈|레데리|듀얼센스\s*2개|컨트롤러\s*2개|패드\s*2개|\+\s*듀얼센스|\+\s*게임|\+\s*타이틀|\+\s*스탠드|\+\s*충전)/i.test(text)) {
      reasons.push("ps5_bundle_price_review");
    }
    if (/(삽니다|매입|구합니다|구매합니다)/i.test(text)) reasons.push("buying_signal");
    if (/(고장|파손|수리|침수|전원\s*안|부팅\s*안|불량|부품용)/i.test(text)) reasons.push("damaged_or_parts_signal");
  }

  if (taskId.includes("switch_oled")) {
    if (!/(닌텐도|nintendo|스위치|switch)/i.test(text)) reasons.push("missing_switch_context");
    if (!/(oled|올레드)/i.test(text)) reasons.push("missing_oled_context");
    if (/(스위치\s*2|스위치2|switch\s*2|switch2|라이트|\blite\b|switchlite|스위치\s*라이트|일반\s*스위치|구형\s*스위치|스위치\s*v1|\bps5\b|\bps4\b|플스\s*[45]|플레이스테이션\s*[45])/i.test(text)) reasons.push("switch_wrong_model_or_platform_signal");
    if (/(컨트롤러\s*만|조이콘\s*만|프로콘\s*만|프로\s*컨트롤러\s*만|충전기\s*만|케이스\s*만|독\s*만|거치대\s*만|스탠드\s*만|보호\s*필름\s*만|하우징|스킨\s*만)/i.test(text)) reasons.push("switch_accessory_only_signal");
    if (/(게임\s*만|게임\s*팩|게임\s*카드|게임\s*소프트만|타이틀\s*만|기프트|gift\s*card|eshop|이샵\s*카드|닌텐도\s*카드)/i.test(text)) reasons.push("switch_game_or_code_only_signal");
    if (/(매입|삽니다|구해요|구합니다|구매\s*합니다|구매합니다)/i.test(text)) reasons.push("buying_signal");
    if (/(부품\s*용|부품용|부품\s*만|고장|불량\s*품|파손\s*품|액정\s*파손|밴|커펌)/i.test(text)) reasons.push("damaged_or_parts_signal");
  }

  if (taskId.includes("sony_headphone")) {
    if (!/(소니|sony)/i.test(text)) reasons.push("missing_sony_context");
    if (!/(wh[-\s]?1000xm4|wh1000xm4|xm4|wh[-\s]?ch520|whch520|ch520)/i.test(text)) reasons.push("missing_allowed_sony_model");
    if (/(xm6|xm5|xm3|ch720n|ult900n|ult\s*wear|qc45|qc\s*ultra|보스|bose|에어팟|airpods)/i.test(text)) reasons.push("sony_wrong_model_signal");
    if (/(이어패드|이어\s*패드|이어쿠션|이어\s*쿠션|헤드쿠션|쿠션|케이스\s*만|파우치\s*만|커버\s*만|스탠드|거치대|부품|배터리\s*교체용)/i.test(text)) reasons.push("sony_headphone_accessory_or_parts_signal");
    if (/(삽니다|매입|구합니다|구매합니다)/i.test(text)) reasons.push("buying_signal");
    if (/(고장|파손|수리|침수|전원\s*안|충전\s*안|소리\s*안|한쪽\s*안|노캔\s*안|불량|부품용)/i.test(text)) reasons.push("damaged_or_parts_signal");
  }

  if (taskId.includes("jbl_flip6")) {
    if (!/(jbl|제이비엘)/i.test(text)) reasons.push("missing_jbl_context");
    if (!/(flip\s*6|flip6|플립\s*6|플립6)/i.test(text)) reasons.push("missing_flip6_model");
    if (!/(스피커|speaker|블루투스|bluetooth|flip\s*6|flip6|플립\s*6|플립6)/i.test(text)) reasons.push("speaker_context_missing");
    if (/(flip\s*[1-57]|flip[1-57]|플립\s*[1-57]|플립[1-57]|go\s*[0-9]|go[0-9]|charge|차지|boombox|붐박스|clip|클립|xtreme|익스트림|partybox|파티박스|eon)/i.test(text)) reasons.push("jbl_wrong_model_signal");
    if (/(케이스|하드쉘|파우치|가방|커버|스탠드|거치대|충전기|케이블).{0,16}(단독|단품|만|판매|팝니다|구함|삽니다)|(?:단독|단품|만|판매|팝니다|구함|삽니다).{0,16}(케이스|하드쉘|파우치|가방|커버|스탠드|거치대|충전기|케이블)/i.test(text)) reasons.push("jbl_flip6_accessory_only_signal");
    if (/(렌탈|대여|임대|무선\s*마이크|마이크|노래방|karaoke|pa\s*스피커|리시버|receiver|앰프|amp|사운드바|soundbar|북쉘프|패시브\s*스피커)/i.test(text)) reasons.push("jbl_flip6_wrong_device_or_rental_signal");
    if (/(삽니다|매입|구합니다|구매합니다)/i.test(text)) reasons.push("buying_signal");
    if (/(고장|파손|수리|침수|전원\s*안|충전\s*안|소리\s*안|불량|부품용)/i.test(text)) reasons.push("damaged_or_parts_signal");
  }

  if (taskId.includes("airpods_max_usbc")) {
    if (!/(에어팟|airpods)/i.test(text)) reasons.push("missing_airpods_context");
    if (!/(맥스|max)/i.test(text)) reasons.push("missing_airpods_max_context");
    if (!/(usb[-\s]?c|usbc|c\s*타입|타입\s*c|씨\s*타입|c핀|c\s*핀)/i.test(text)) reasons.push("missing_explicit_usbc_context");
    if (/(라이트닝|lightning|8\s*핀|8핀|1세대|1\s*세대|1st|구형)/i.test(text)) reasons.push("airpods_max_lightning_or_old_generation_signal");
    if (/(에어팟\s*프로|airpods\s*pro|에어팟\s*[234]\s*세대|airpods\s*[234]|버즈|buds)/i.test(text)) reasons.push("airpods_max_wrong_airpods_model_signal");
    if (/(이어\s*쿠션|이어쿠션|이어\s*패드|이어패드|헤드\s*밴드|헤드밴드|캐노피|canopy|케이스\s*만|파우치\s*만|커버\s*만|스탠드|거치대|부품|배터리\s*교체용)/i.test(text)) {
      reasons.push("airpods_max_accessory_only_signal");
    }
    if (/(삽니다|매입|구합니다|구매합니다)/i.test(text)) reasons.push("buying_signal");
    if (/(가품|레플|이미테이션|짝퉁|호환|비정품|고장|파손|수리|침수|전원\s*안|충전\s*안|소리\s*안|한쪽\s*안|노캔\s*안|불량|부품용)/i.test(text)) {
      reasons.push("damaged_or_parts_signal");
    }
  }

  if (taskId.includes("camera_body_exact")) {
    if (!/(카메라|camera|미러리스|dslr|canon|캐논|sony|소니|nikon|니콘|fujifilm|후지|후지필름|eos|ilce)/i.test(text)) reasons.push("missing_camera_context");
    if (!/(바디|바디만|바디셋|body)/i.test(text)) reasons.push("missing_body_only_context");
    if (/(렌즈|lens|번들|번들킷|키트|kit|세트|풀셋|풀셋트|렌즈캡|바디캡|뒷캡|캡\s*만|스트랩\s*만|가방\s*만|케이스\s*만|삼각대|플래시|필터)/i.test(text)) {
      reasons.push("camera_lens_or_accessory_bundle_signal");
    }
    if (/(똑딱이|컴팩트|렌즈\s*일체형|g7x|x70|rx100|gr\s*iii|zv-1|zv1|파워샷|powershot)/i.test(text)) reasons.push("camera_fixed_lens_signal");
    if (/(삽니다|매입|구합니다|구매합니다)/i.test(text)) reasons.push("buying_signal");
    if (/(고장|파손|수리|침수|전원\s*안|셔터\s*안|초점\s*불량|불량|부품용|하자)/i.test(text)) reasons.push("damaged_or_parts_signal");
  }

  if (taskId.includes("galaxy_buds_3_pro")) {
    if (!/(갤럭시\s*버즈|갤럭시버즈|갤버즈|galaxy\s*buds|buds)/i.test(text)) reasons.push("missing_galaxy_buds_context");
    if (!/(3\s*프로|3프로|3\s*pro|buds\s*3\s*pro|buds3\s*pro|버즈\s*3\s*프로)/i.test(text)) reasons.push("missing_buds3_pro_context");
    if (/(버즈\s*2\s*프로|버즈2\s*프로|버즈2프로|buds\s*2\s*pro|buds2\s*pro|buds2pro|버즈\s*2\b|버즈2\b|buds\s*2\b|buds2\b|버즈\s*fe|버즈fe|buds\s*fe|라이브|live|버즈\s*\+|버즈\+|plus)/i.test(text)) {
      reasons.push("galaxy_buds_wrong_model_signal");
    }
    if (/(왼쪽|오른쪽|좌측|우측|한쪽|편쪽|유닛|이어버드\s*단품|낱개|본체\s*충전케이스|충전\s*본체|충전케이스|케이스\s*만|케이스\s*단품|파우치|커버|이어\s*팁|이어팁|팁\s*만|크래들\s*만)/i.test(text)) {
      reasons.push("galaxy_buds_parts_or_accessory_signal");
    }
    if (/(삽니다|매입|구합니다|구매합니다)/i.test(text)) reasons.push("buying_signal");
    if (/(가품|짝퉁|레플|복제품|고장|파손|불량|소리\s*안|작동\s*안|부품용)/i.test(text)) reasons.push("damaged_or_parts_signal");
  }

  return [...new Set(reasons)];
}

function decisionFor(reasons: string[], parseNeedsReview: boolean, taskId: string): SampleDecision {
  const hasHardHold = reasons.some(
    (reason) =>
      reason.endsWith("_hold_signal") ||
      reason.endsWith("_wrong_generation_signal") ||
      reason.endsWith("_wrong_model_signal") ||
      reason.endsWith("_cellular_signal") ||
      reason.endsWith("_accessory_only_signal") ||
      reason.endsWith("_game_or_account_signal") ||
      reason.endsWith("_damaged_or_parts_signal") ||
      (reason.startsWith("listing_type_") && reason !== "listing_type_unknown"),
  );
  if (hasHardHold) return "hold";
  if (taskId.includes("lg_gram") || taskId.includes("ipad_pro_13_m2")) {
    if (reasons.length === 0 && !parseNeedsReview) return "clean_candidate";
    return "ai_l2_or_manual";
  }
  if (reasons.length === 0 && !parseNeedsReview) return "clean_candidate";
  if (reasons.length <= 1) return "ai_l2_or_manual";
  return "hold";
}

function taskMatchesFilter(task: WaveTask, filter: string) {
  if (filter === "all") return ["monitor_exact_model_code_wave1", "lg_gram_17_2024_query_repair_wave1", "ipad_pro_13_m2_exact_wifi_wave1"].includes(task.id);
  return task.id === filter || task.category === filter;
}

function builtInTask(filter: string): WaveTask | null {
  if (filter === "lg_gram_17_2024_modelcode_wave2") {
    return {
      id: "lg_gram_17_2024_modelcode_wave2",
      category: "laptop",
      mode: "no_write_exact_modelcode_sample",
      status: "report_only",
      scope: [
        "LG 그램 17Z90S",
        "LG 그램 17ZD90S",
        "LG 그램 17ZD90SU",
        "그램 17Z90S 노트북",
        "그램 17ZD90S 노트북",
        "그램 17ZD90SU 노트북",
      ],
      evidence: "reports/exact-acquisition-no-write-sample-lg_gram_17_2024_query_repair_wave1-latest.md",
      forbidden: "No DB acquisition, no runtime patch, no public promotion.",
    };
  }
  if (filter === "ps5_disc_digital_standard_wave1") {
    return {
      id: "ps5_disc_digital_standard_wave1",
      category: "game_console",
      mode: "no_write_ps5_disc_digital_sample",
      status: "report_only",
      scope: [
        "ps5 디스크 본체",
        "플스5 디스크 본체",
        "플레이스테이션5 디스크 본체",
        "ps5 digital 본체",
        "ps5 디지털 본체",
        "플스5 디지털 에디션 본체",
      ],
      evidence: "reports/acquisition-runtime-review-ordering-packet-latest.md",
      forbidden: "No PS5 Slim/Pro/accessory/game/account bundle promotion. No DB acquisition or public promotion.",
    };
  }
  if (filter === "ps5_slim_wave1") {
    return {
      id: "ps5_slim_wave1",
      category: "game_console",
      mode: "no_write_ps5_slim_sample",
      status: "report_only",
      scope: [
        "ps5 슬림 디스크 본체",
        "플스5 슬림 디스크 본체",
        "플레이스테이션5 슬림 디스크 본체",
        "ps5 slim disc console",
        "ps5 슬림 디지털 본체",
        "플스5 슬림 디지털 에디션 본체",
        "ps5 slim digital console",
      ],
      evidence: "category-intelligence/ps5_slim/parse_summary.json",
      forbidden: "No PS5 Pro/PSVR/Portal/Switch/accessory/game/account bundle promotion. No DB acquisition or public promotion.",
    };
  }
  if (filter === "switch_oled_wave1") {
    return {
      id: "switch_oled_wave1",
      category: "game_console",
      mode: "no_write_switch_oled_sample",
      status: "report_only",
      scope: [
        "닌텐도 스위치 OLED 본체",
        "닌텐도 스위치 OLED 풀박스",
        "스위치 OLED 본체",
        "스위치 올레드 본체",
        "nintendo switch oled console",
      ],
      evidence: "reports/game-console-evidence-matrix-latest.md",
      forbidden: "No Switch 2/Lite/V1/accessory/game/account bundle promotion. No DB acquisition or public promotion.",
    };
  }
  if (filter === "sony_headphone_xm4_ch520_wave1") {
    return {
      id: "sony_headphone_xm4_ch520_wave1",
      category: "headphone",
      mode: "no_write_sony_headphone_sample",
      status: "report_only",
      scope: [
        "소니 WH-1000XM4 헤드폰",
        "소니 WH1000XM4 헤드폰",
        "소니 XM4 헤드폰",
        "sony wh-1000xm4 headphone",
        "소니 WH-CH520 헤드폰",
        "소니 WHCH520 헤드폰",
        "소니 CH520 헤드폰",
      ],
      evidence: "reports/headphone-sony-first-wave-owner-review-packet-latest.md",
      forbidden: "No headphone broad promotion. Only Sony WH-1000XM4 and WH-CH520 no-write sample.",
    };
  }
  if (filter === "jbl_flip6_wave1") {
    return {
      id: "jbl_flip6_wave1",
      category: "speaker",
      mode: "no_write_jbl_flip6_sample",
      status: "report_only",
      scope: [
        "JBL Flip 6 스피커",
        "JBL Flip6 스피커",
        "JBL 플립6 스피커",
        "제이비엘 플립6",
        "JBL Flip 6 블루투스 스피커",
      ],
      evidence: "reports/speaker-jbl-flip6-owner-review-packet-latest.md",
      forbidden: "No broad speaker promotion. No case-only/rental/PA/bundle/public candidate promotion.",
    };
  }
  if (filter === "ipad_pro_11_m4_256_wifi_wave1") {
    return {
      id: "ipad_pro_11_m4_256_wifi_wave1",
      category: "tablet",
      mode: "no_write_ipad_pro_11_m4_256_wifi_sample",
      status: "report_only",
      scope: [
        "아이패드 프로 11 m4 256 와이파이",
        "아이패드 프로 11 m4 256 wifi",
        "아이패드 프로 11인치 m4 256 와이파이",
        "ipad pro 11 m4 256 wifi",
      ],
      evidence: "reports/tablet-ipad-pro-m4-owner-assessment-latest.md",
      forbidden: "No tablet broad promotion. No 13-inch/Air/Cellular/bundle/accessory/public candidate promotion.",
    };
  }
  if (filter === "airpods_max_usbc_wave1") {
    return {
      id: "airpods_max_usbc_wave1",
      category: "earphone",
      mode: "no_write_airpods_max_usbc_sample",
      status: "report_only",
      scope: [
        "에어팟 맥스 usb-c",
        "에어팟맥스 usb-c",
        "에어팟 맥스 c타입",
        "에어팟맥스 c타입",
        "airpods max usb-c",
        "airpods max usbc",
      ],
      evidence: "reports/headphone-airpods-max-review-evidence-latest.md",
      forbidden: "No AirPods Max broad promotion. No Lightning/color-only/accessory/parts/clone/public candidate promotion.",
    };
  }
  if (filter === "camera_body_exact_wave1") {
    return {
      id: "camera_body_exact_wave1",
      category: "camera",
      mode: "no_write_camera_body_exact_sample",
      status: "report_only",
      scope: [
        "캐논 EOS R6 Mark II 바디",
        "소니 A7M3 바디",
        "소니 A7C 바디",
        "소니 A5100 바디",
        "캐논 EOS M6 바디",
        "니콘 Z9 바디",
        "캐논 EOS 6D 바디",
        "후지필름 X-T4 바디",
      ],
      evidence: "reports/camera-body-only-internal-sublane-plan-latest.md",
      forbidden: "No broad camera promotion. No lens-kit/fixed-lens/accessory/damaged/public candidate promotion.",
    };
  }
  if (filter === "galaxy_buds_3_pro_wave1") {
    return {
      id: "galaxy_buds_3_pro_wave1",
      category: "earphone",
      mode: "no_write_galaxy_buds_3_pro_sample",
      status: "report_only",
      scope: [
        "갤럭시 버즈 3 프로",
        "갤럭시버즈3프로",
        "갤버즈3프로",
        "galaxy buds 3 pro",
      ],
      evidence: "category-intelligence/galaxy_buds_3_pro/parse_summary.json",
      forbidden: "No broad Galaxy Buds promotion. No single-unit/case-only/buying/fake/public candidate promotion.",
    };
  }
  if (filter !== "ipad_pro_13_m2_refined_wave2") return null;
  return {
    id: "ipad_pro_13_m2_refined_wave2",
    category: "tablet",
    mode: "no_write_refined_query_sample",
    status: "report_only",
    scope: [
      "아이패드 프로 12.9 6세대 m2 256 wifi",
      "아이패드 프로 12.9 6세대 256 와이파이",
      "아이패드 프로6세대 m2 12.9 256기가 와이파이",
    ],
    evidence: "reports/ipad-pro-13-m2-query-guard-refinement-latest.md",
    forbidden: "No DB acquisition, no runtime patch, no public promotion.",
  };
}

async function main() {
  const taskFilter = arg("task", "all");
  const perQueryLimit = intArg("limit", 10, 1, 30);
  const page = intArg("page", 0, 0, 3);
  const order = arg("order", "date") === "score" ? "score" : "date";
  const wave = readJson<WaveReport>(wavePath, {});
  const customTask = builtInTask(taskFilter);
  const tasks = customTask ? [customTask] : (wave.tasks ?? []).filter((task) => taskMatchesFilter(task, taskFilter) && task.scope.length > 0);

  const rows: Array<{
    taskId: string;
    query: string;
    pid: string;
    title: string;
    price: number;
    listingType: string;
    skuId: string | null;
    comparableKey: string | null;
    parseNeedsReview: boolean;
    decision: SampleDecision;
    reasons: string[];
  }> = [];

  const seen = new Set<string>();
  for (const task of tasks) {
    for (const query of task.scope) {
      const items = await searchPage(query, page, { order, limit: perQueryLimit });
      for (const item of items) {
        const key = `${task.id}:${item.pid}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const classified = classifyListing(item.name, "", item.price);
        const sku = classified.sku ?? ruleMatch(item.name, "");
        const parsed = parseListingOptions({
          title: item.name,
          description: "",
          skuId: sku?.id ?? null,
          skuName: sku?.modelName ?? null,
          category: sku?.category ?? null,
        });
        const reasons = holdReasonForTask(task.id, item, classified.listingType, parsed.comparableKey);
        rows.push({
          taskId: task.id,
          query,
          pid: item.pid,
          title: item.name,
          price: item.price,
          listingType: classified.listingType,
          skuId: sku?.id ?? null,
          comparableKey: parsed.comparableKey,
          parseNeedsReview: parsed.needsReview,
          decision: decisionFor(reasons, parsed.needsReview, task.id),
          reasons,
        });
      }
    }
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.decision] = (acc[row.decision] ?? 0) + 1;
    return acc;
  }, {});

  const byTask = tasks.map((task) => {
    const taskRows = rows.filter((row) => row.taskId === task.id);
    return {
      taskId: task.id,
      category: task.category,
      queries: task.scope.length,
      fetched: taskRows.length,
      clean: taskRows.filter((row) => row.decision === "clean_candidate").length,
      aiL2OrManual: taskRows.filter((row) => row.decision === "ai_l2_or_manual").length,
      hold: taskRows.filter((row) => row.decision === "hold").length,
    };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    mode: "no_write_live_search_sample",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    taskFilter,
    page,
    order,
    perQueryLimit,
    counts,
    byTask,
    rows,
    decision:
      "Use this as a search-scope triage only. Clean candidates still require detail verification before any DB acquisition or public promotion.",
  };

  const md = [
    "# Exact Acquisition No-Write Sample",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- taskFilter: ${taskFilter}`,
    `- mode: ${output.mode}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    "",
    "## Counts",
    "",
    ...Object.entries(counts).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Task",
    "",
    "| task | fetched | clean | aiL2/manual | hold |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...byTask.map((row) => `| ${row.taskId} | ${row.fetched} | ${row.clean} | ${row.aiL2OrManual} | ${row.hold} |`),
    "",
    "## Sample Rows",
    "",
    "| task | decision | pid | price | title | sku | comparable | reasons |",
    "| --- | --- | --- | ---: | --- | --- | --- | --- |",
    ...rows.slice(0, 80).map((row) =>
      `| ${row.taskId} | ${row.decision} | ${row.pid} | ${row.price} | ${row.title.replace(/\|/g, "/")} | ${row.skuId ?? "-"} | ${row.comparableKey ?? "-"} | ${row.reasons.join(", ") || "-"} |`,
    ),
    "",
    "## Decision",
    "",
    `- ${output.decision}`,
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  const slug = fileSlug(taskFilter);
  const json = `${JSON.stringify(output, null, 2)}\n`;
  await writeFile(path.join(reportDir, "exact-acquisition-no-write-sample-latest.json"), json);
  await writeFile(path.join(reportDir, "exact-acquisition-no-write-sample-latest.md"), md);
  await writeFile(path.join(reportDir, `exact-acquisition-no-write-sample-${slug}-latest.json`), json);
  await writeFile(path.join(reportDir, `exact-acquisition-no-write-sample-${slug}-latest.md`), md);
  console.log("wrote reports/exact-acquisition-no-write-sample-latest.json");
  console.log("wrote reports/exact-acquisition-no-write-sample-latest.md");
  console.log(`wrote reports/exact-acquisition-no-write-sample-${slug}-latest.json`);
  console.log(`wrote reports/exact-acquisition-no-write-sample-${slug}-latest.md`);
  console.log(JSON.stringify({ tasks: tasks.length, rows: rows.length, counts }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
