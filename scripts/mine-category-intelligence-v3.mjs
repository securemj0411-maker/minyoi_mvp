/**
 * mine-category-intelligence-v3.mjs
 *
 * v3: AI query planning + normalized marketplace samples + shared knowledge
 *     + embedding clustering + AI cluster labeling + promotion-ready outputs.
 *
 * 실행:
 *   node scripts/mine-category-intelligence-v3.mjs --category="에어팟 애플워치 갤럭시워치" --plan-only
 *   node scripts/mine-category-intelligence-v3.mjs --category="리셀 가능한 애플 제품" --limit=700 --pages=3
 *   node scripts/mine-category-intelligence-v3.mjs --category=smartphone --reuse-samples
 *   node scripts/mine-category-intelligence-v3.mjs --category=tablet --limit=700 --pages=3
 *   node scripts/mine-category-intelligence-v3.mjs --category=laptop --limit=700 --pages=3
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const rootDir = path.join(appDir, "..");
const outDir = path.join(appDir, "category-intelligence");
const sharedKnowledgePath = path.join(outDir, "shared_knowledge.json");
const categoryPlansDir = path.join(outDir, "category-plans");

// ─── Category configs (v1과 동일) ─────────────────────────────────────────────

const CATEGORIES = {
  smartphone: {
    label: "Smartphone",
    queries: [
      "아이폰 15", "아이폰 15 프로", "아이폰 14 프로", "아이폰 13",
      "갤럭시 s24", "갤럭시 s23", "갤럭시 z플립", "갤럭시 z폴드",
    ],
    seedSkus: [
      "iphone-15", "iphone-15-pro", "iphone-15-pro-max",
      "iphone-14", "iphone-14-pro", "iphone-14-pro-max",
      "galaxy-s24", "galaxy-s24-ultra", "galaxy-s23", "galaxy-s23-ultra",
      "galaxy-z-flip5", "galaxy-z-flip6", "galaxy-z-fold5", "galaxy-z-fold6",
    ],
    minNormalPrice: 50000,
    clusterK: 18,
    aiHints: "스마트폰. 주요 노이즈: 케이스/필름/충전기(액세서리), 부품폰/액정만(부품), 고장/파손(파손), 매입글, 재고정리/완납폰/선착순특가/제휴카드(업자미끼), 일괄묶음(다중). 정상: 공기계, 자급제, 중고 본품.",
  },
  tablet: {
    label: "Tablet",
    queries: [
      "아이패드 프로", "아이패드 에어", "아이패드 미니", "아이패드 10세대",
      "갤럭시탭 s9", "갤럭시탭 s8", "갤럭시탭 s10",
    ],
    seedSkus: [
      "ipad-pro-m2", "ipad-pro-m4", "ipad-air-5", "ipad-air-6",
      "ipad-mini-6", "ipad-10", "galaxy-tab-s8", "galaxy-tab-s9", "galaxy-tab-s10",
    ],
    minNormalPrice: 80000,
    clusterK: 14,
    aiHints: "태블릿. 주요 노이즈: 케이스/키보드/펜슬/필름(액세서리), 액정파손/휘어짐/터치불량(파손), 부품용, 매입글. 정상: 공기계, Wi-Fi/셀룰러 본품.",
  },
  laptop: {
    label: "Laptop",
    queries: [
      "맥북 에어 m1", "맥북 에어 m2", "맥북 에어 m3",
      "맥북 프로 m2", "맥북 프로 m3", "그램 노트북", "갤럭시북",
    ],
    seedSkus: [
      "macbook-air-m1", "macbook-air-m2", "macbook-air-m3",
      "macbook-pro-m2", "macbook-pro-m3", "lg-gram", "galaxy-book",
    ],
    minNormalPrice: 150000,
    clusterK: 14,
    aiHints: "노트북. 주요 노이즈: 충전기/파우치 단독(액세서리), 액정파손/침수/키보드불량/배터리사이클과다(파손), 부품용, 매입글. 정상: 중고 본체.",
  },
  small_appliance: {
    label: "Small Appliance",
    queries: [
      "다이슨 에어랩", "다이슨 드라이기", "로보락", "닌텐도 스위치",
      "플스5", "소니 헤드폰", "보스 헤드폰",
    ],
    seedSkus: [
      "dyson-airwrap", "dyson-supersonic", "roborock", "nintendo-switch",
      "playstation-5", "sony-headphone", "bose-headphone",
    ],
    minNormalPrice: 30000,
    clusterK: 12,
    aiHints: "소형가전/전자기기. 노이즈: 부품/고장/소모품/호환액세서리/구매글/다중상품. 정상: 중고 본체.",
  },
  smartwatch_discovered: {
    label: "Smartwatch From Bunjang Category",
    categoryIds: ["600720100"],
    queries: [
      "애플워치", "애플워치 se", "애플워치 울트라", "갤럭시워치",
      "갤럭시워치 클래식", "스마트워치",
    ],
    seedSkus: [
      "apple-watch-se", "apple-watch-series", "apple-watch-ultra",
      "galaxy-watch", "galaxy-watch-classic", "galaxy-watch-ultra",
    ],
    minNormalPrice: 50000,
    clusterK: 12,
    aiHints: "번개장터 600720100 스마트워치/밴드 카테고리. 정상: 애플워치/갤럭시워치 본체. 노이즈: 스트랩/밴드/충전기/보호필름/케이스 단독, 배터리 낮음, 액정파손, 매입글, 여러 모델 나열.",
  },
  headphone_discovered: {
    label: "Headphone From Bunjang Category",
    categoryIds: ["600500011"],
    queries: [
      "에어팟 맥스", "소니 헤드폰", "보스 헤드폰", "젠하이저 헤드폰",
      "비츠 헤드폰", "무선 헤드폰",
    ],
    seedSkus: [
      "airpods-max", "sony-wh-1000xm", "bose-qc", "bose-quietcomfort",
      "sennheiser-headphone", "beats-headphone",
    ],
    minNormalPrice: 50000,
    clusterK: 12,
    aiHints: "번개장터 600500011 헤드폰 카테고리. 정상: 무선/유선 헤드폰 본체. 노이즈: 이어패드/케이스/케이블/거치대 단독, 가품/레플, 고장/한쪽 소리 안남, 매입글, 여러 제품 일괄.",
  },
  earphone_discovered: {
    label: "Earphone From Bunjang Category",
    categoryIds: ["600500010"],
    queries: [
      "에어팟 프로", "에어팟 프로2", "에어팟 4", "버즈 프로",
      "버즈3 프로", "무선 이어폰",
    ],
    seedSkus: [
      "airpods-pro", "airpods-pro-2", "airpods-4",
      "galaxy-buds-pro", "galaxy-buds3-pro",
    ],
    minNormalPrice: 30000,
    clusterK: 12,
    aiHints: "번개장터 600500010 이어폰 카테고리. 정상: 양쪽 유닛+케이스 전체 본품. 노이즈: 한쪽 유닛/본체만/케이스만/이어팁/철가루방지 스티커, 가품/레플/호환, 고장/배터리 이상, 매입글.",
  },
  monitor_discovered: {
    label: "Monitor From Bunjang Category",
    categoryIds: ["600100007"],
    queries: [
      "게이밍 모니터", "LG 27인치 모니터", "삼성 오디세이 모니터",
      "델 모니터", "벤큐 조위", "울트라와이드 모니터",
    ],
    seedSkus: [
      "lg-monitor", "samsung-odyssey", "dell-monitor", "benq-zowie",
      "ultrawide-monitor", "gaming-monitor",
    ],
    minNormalPrice: 30000,
    clusterK: 12,
    aiHints: "번개장터 600100007 모니터 카테고리. 정상: 모니터 본체. 노이즈: 모니터암/스탠드/어댑터/케이블/부품/패널 단독, 액정파손/멍/줄/번인/불량화소, 업자성 재고/전국설치, TV/태블릿/터치패널 혼합, 여러 대 일괄.",
  },
  game_console_discovered: {
    label: "Game Console From Bunjang Category",
    categoryIds: ["600600001", "600600002"],
    queries: [
      "닌텐도 스위치 OLED", "닌텐도 스위치 라이트", "닌텐도 스위치 본체",
      "플스5 디스크", "플스5 디지털", "PS5 본체",
    ],
    seedSkus: [
      "nintendo-switch-oled", "nintendo-switch-lite", "nintendo-switch",
      "playstation-5-disc", "playstation-5-digital", "playstation-4-pro",
    ],
    minNormalPrice: 50000,
    clusterK: 12,
    aiHints: "번개장터 600600001/600600002 게임기 카테고리. 정상: 닌텐도 스위치/스위치 OLED/스위치 라이트/플레이스테이션 본체. 노이즈: 게임 타이틀/칩/팩 단독, 듀얼센스/조이콘/프로콘/충전독/케이스/파우치/스킨 등 액세서리 단독, 커펌/밴/고장/부품용, 계정/다운로드 코드, 여러 기기 일괄.",
  },
  game_console_body_narrow: {
    label: "Game Console Body Narrow Mining",
    categoryIds: ["600600001", "600600002"],
    queryOnly: true,
    queries: [
      "닌텐도 스위치 OLED 본체", "닌텐도 스위치 OLED 풀박스",
      "닌텐도 스위치 라이트 본체", "닌텐도 스위치 본체 풀박스",
      "플스5 본체 디스크", "플스5 본체 디지털",
      "PS5 본체", "플스5 슬림 본체",
    ],
    seedSkus: [
      "nintendo-switch-oled-body", "nintendo-switch-lite-body",
      "nintendo-switch-v2-body", "playstation-5-disc-body",
      "playstation-5-digital-body", "playstation-5-slim-body",
    ],
    minNormalPrice: 100000,
    clusterK: 10,
    aiHints: "번개장터 게임기 카테고리의 본체 전용 좁은 마이닝. 이 config는 category page를 섞지 않고 검색어 기반으로만 수집한다. 정상: 닌텐도 스위치 OLED/라이트/구형·신형 본체, PS5 디스크/디지털/슬림 본체처럼 비교 가능한 콘솔 하드웨어. 노이즈: 게임 타이틀/칩/팩/CD/디스크 단독, 듀얼센스/조이콘/프로콘/독/충전기/케이스/파우치/그립캡/터치펜/하우징 단독, 커펌/밴/고장/부품용, 매입글, 여러 본체나 게임 다수 일괄.",
  },
  camera_discovered: {
    label: "Camera Body From Bunjang Category",
    categoryIds: ["600300001"],
    queries: [
      "소니 미러리스 바디", "캐논 미러리스 바디", "니콘 미러리스 바디",
      "후지필름 미러리스 바디", "캐논 DSLR 바디", "소니 a7 바디",
    ],
    seedSkus: [
      "sony-a7-series", "sony-a6000-series", "canon-eos-r",
      "canon-eos-m", "nikon-z", "fujifilm-x-series",
    ],
    minNormalPrice: 80000,
    clusterK: 12,
    aiHints: "번개장터 600300001 DSLR/미러리스 카테고리. 정상: 카메라 바디 본체 또는 명확한 바디+기본 구성. 노이즈: 렌즈/필터/컨버터/가방/스트랩/배터리/충전기 단독, 렌즈 포함 키트와 바디 단품 혼합, 필름카메라/토이카메라/캠코더 혼입, 셔터막/센서/액정/AF 고장, 컷수 과다 또는 컷수 미상, 매입글, 여러 바디 일괄.",
  },
  speaker_audio_discovered: {
    label: "Speaker Audio From Bunjang Category",
    categoryIds: ["600500006"],
    queries: [
      "블루투스 스피커", "마샬 스피커", "보스 스피커",
      "JBL 스피커", "앰프", "사운드바",
    ],
    seedSkus: [
      "marshall-speaker", "bose-speaker", "jbl-speaker",
      "sony-speaker", "soundbar", "amplifier",
    ],
    minNormalPrice: 20000,
    clusterK: 12,
    aiHints: "번개장터 600500006 스피커/앰프 카테고리. 정상: 블루투스 스피커/패시브 스피커/앰프/사운드바 본체 단품 또는 명확한 기본 구성. 노이즈: 케이블/리모컨/스탠드/브라켓/거치대/전원어댑터 단독, 이어폰/헤드폰/마이크/오디오 인터페이스 혼입, 차량용 오디오/카오디오, 고장/소리 안남/잡음/찢어짐/수리용, 여러 대 일괄/매장 정리, 매입글.",
  },
  desktop_pc_discovered: {
    label: "Desktop PC From Bunjang Category",
    categoryIds: ["600100006"],
    queries: [
      "게이밍 컴퓨터 본체", "조립PC 본체", "사무용 컴퓨터 본체",
      "데스크탑 본체", "아이맥", "맥미니",
    ],
    seedSkus: [
      "gaming-desktop", "office-desktop", "assembled-pc",
      "imac", "mac-mini", "mac-studio",
    ],
    minNormalPrice: 50000,
    clusterK: 12,
    aiHints: "번개장터 600100006 데스크탑/PC 카테고리. 정상: 완제품 데스크탑 본체, 조립PC 본체, iMac/Mac mini/Mac Studio 본체. 노이즈: 그래픽카드/CPU/메인보드/RAM/SSD/HDD/케이스/파워/쿨러/부품 단독, 모니터/키보드/마우스 주변기기 단독, 폐컴퓨터/고장/부품용, PC방/사무실 대량 일괄, 매입글/출장매입/업자 광고, 견적글.",
  },
  home_appliance_tech_discovered: {
    label: "Home Appliance Tech From Bunjang Category",
    categoryIds: ["610500005", "610600", "610700003"],
    queries: [
      "다이슨 청소기", "로보락 로봇청소기", "드리미 로봇청소기",
      "에어프라이어", "닌자 블렌더", "다이슨 에어랩",
    ],
    seedSkus: [
      "dyson-vacuum", "roborock-robot-vacuum", "dreame-robot-vacuum",
      "air-fryer", "ninja-blender", "dyson-airwrap",
    ],
    minNormalPrice: 20000,
    clusterK: 12,
    aiHints: "번개장터 생활/주방/미용 가전 discovery. 정상: 청소기/로봇청소기/에어프라이어/블렌더/헤어드라이어/에어랩 등 전자식 가전 본체와 명확한 기본 구성. 노이즈: 필터/브러시/배터리/거치대/어댑터/부품 단독, 화장품/소모품/식기/비전자 주방용품, 고장/수리용/부품용, 렌탈/설치형/대형가전 배송 리스크, 여러 제품 일괄, 매입글.",
  },
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function argValue(name, fallback) {
  for (const arg of process.argv) {
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch { /* optional */ }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))];
}

function extractJson(text) {
  const raw = text.trim();
  if (raw.startsWith("{") || raw.startsWith("[")) return JSON.parse(raw);
  const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*([\s\S]*?)```/);
  if (match) return JSON.parse(match[1]);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error("JSON not found in AI response");
}

function slugify(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "unknown";
}

function planSlug(text) {
  return slugify(text).replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || `request-${hashText(text).slice(0, 8)}`;
}

function isAccessoryOnlyQuery(query) {
  const compact = String(query ?? "").toLowerCase().replace(/\s+/g, "");
  const accessoryTerms = [
    "밴드", "스트랩", "케이스", "필름", "보호필름", "강화유리", "충전기",
    "거치대", "이어팁", "커버", "루프", "악세사리", "악세서리", "액세서리",
  ];
  return accessoryTerms.some((term) => compact.includes(term));
}

function hashText(text) {
  return createHash("sha256").update(String(text ?? "")).digest("hex").slice(0, 24);
}

function normalizeMarketplaceSample(sample) {
  const pid = String(sample.pid ?? sample.source_listing_id ?? "");
  const title = String(sample.name ?? sample.title ?? "");
  const description = String(sample.description ?? "");
  return {
    ...sample,
    source: sample.source ?? "bunjang",
    source_type: sample.source_type ?? "marketplace_listing",
    source_listing_id: sample.source_listing_id ?? pid,
    url: sample.url ?? (pid ? `https://m.bunjang.co.kr/products/${pid}` : ""),
    title,
    name: title,
    description,
    price: toInt(sample.price),
    seller: sample.seller ?? {
      review_rating: sample.reviewRating ?? null,
      review_count: toInt(sample.reviewCount),
      sales_count: toInt(sample.salesCount),
      proshop: Boolean(sample.isProshop),
      is_official: Boolean(sample.isOfficial),
    },
    metrics: sample.metrics ?? {
      num_faved: toInt(sample.numFaved),
      view_count: sample.viewCount ?? null,
    },
    content_hash: sample.content_hash ?? hashText([
      "bunjang",
      pid,
      title,
      sample.price,
      description.slice(0, 500),
    ].join("\n")),
  };
}

async function loadSharedKnowledge() {
  try {
    return JSON.parse(await readFile(sharedKnowledgePath, "utf-8"));
  } catch {
    return {
      version: 1,
      updated_at: null,
      notes: "Cross-category noise and SKU mining knowledge. Auto-suggested entries still require promotion review before production.",
      noise_rules: [
        { keyword: "케이스", type: "accessory", precision: 0.92, categories: ["smartphone", "tablet"], source: "seed" },
        { keyword: "필름", type: "accessory", precision: 0.9, categories: ["smartphone", "tablet"], source: "seed" },
        { keyword: "매입", type: "buying", precision: 0.95, categories: ["smartphone", "tablet", "laptop"], source: "seed" },
        { keyword: "삽니다", type: "buying", precision: 0.94, categories: ["smartphone", "tablet", "laptop"], source: "seed" },
        { keyword: "부품용", type: "parts", precision: 0.9, categories: ["smartphone", "tablet", "laptop"], source: "seed" },
        { keyword: "액정파손", type: "damaged", precision: 0.9, categories: ["smartphone", "tablet", "laptop"], source: "seed" },
      ],
      category_notes: {},
    };
  }
}

async function saveSharedKnowledge(sharedKnowledge) {
  sharedKnowledge.updated_at = new Date().toISOString();
  await mkdir(outDir, { recursive: true });
  await writeFile(sharedKnowledgePath, JSON.stringify(sharedKnowledge, null, 2));
}

function sharedHintsForCategory(sharedKnowledge, category) {
  const rules = sharedKnowledge.noise_rules ?? [];
  const relevant = rules
    .filter((rule) => (rule.categories ?? []).includes(category) || (rule.precision ?? 0) >= 0.93)
    .slice(0, 30);
  if (!relevant.length) return "";
  return `\n교차 카테고리 지식: ${relevant.map((r) => `${r.keyword}=${r.type}(p=${r.precision})`).join(", ")}`;
}

function updateSharedKnowledge(sharedKnowledge, category, validatedKeywords) {
  const existing = new Map((sharedKnowledge.noise_rules ?? []).map((r) => [`${r.type}:${r.keyword}`, r]));
  for (const item of validatedKeywords.filter((v) => v.precision >= 0.8 && keywordRiskFlags(v.keyword, v.expectedType).length === 0)) {
    const key = `${item.expectedType ?? item.type ?? "noise"}:${item.keyword}`;
    const prev = existing.get(key);
    if (prev) {
      prev.precision = Math.max(Number(prev.precision ?? 0), Number(item.precision ?? 0));
      prev.hit_count = Math.max(Number(prev.hit_count ?? 0), Number(item.hitCount ?? 0));
      prev.categories = [...new Set([...(prev.categories ?? []), category])];
      prev.last_seen_at = new Date().toISOString();
    } else {
      existing.set(key, {
        keyword: item.keyword,
        type: item.expectedType ?? item.type ?? "noise",
        precision: Number(item.precision ?? 0),
        hit_count: Number(item.hitCount ?? 0),
        categories: [category],
        source: "mine-category-intelligence-v3",
        last_seen_at: new Date().toISOString(),
      });
    }
  }
  sharedKnowledge.noise_rules = [...existing.values()]
    .filter((rule) => keywordRiskFlags(rule.keyword, rule.type).length === 0)
    .sort((a, b) => String(a.keyword).localeCompare(String(b.keyword), "ko"));
}

// Korean text tokenization — whitespace split, remove short tokens and stopwords
const KO_STOPWORDS = new Set(["이", "그", "저", "을", "를", "이", "가", "은", "는", "에", "의", "로", "으로", "에서", "이다", "합니다", "있습니다", "있어요", "입니다", "됩니다", "해요", "해서", "하고", "하며", "또는", "또는", "및", "등", "때", "것", "수", "들"]);

function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^가-힣a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !KO_STOPWORDS.has(t));
}

// ─── Bunjang API ──────────────────────────────────────────────────────────────

async function searchPage(query, page) {
  const url = new URL("https://api.bunjang.co.kr/api/1/find_v2.json");
  url.searchParams.set("q", query);
  url.searchParams.set("order", "score");
  url.searchParams.set("page", String(page));
  url.searchParams.set("n", "30");
  url.searchParams.set("stat_device", "w");
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.list ?? [])
    .map((item) => ({
      pid: String(item.pid ?? ""),
      name: String(item.name ?? ""),
      price: toInt(item.price),
      numFaved: toInt(item.num_faved),
      query,
      freeShipping: item.free_shipping === true || item.free_shipping === "1",
    }))
    .filter((item) => item.pid);
}

function productArrayCandidates(value, arrays = []) {
  if (Array.isArray(value)) {
    const productLikeCount = value.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.pid || item.productId || item.productSeq) &&
        (item.name || item.productName || item.title),
    ).length;

    if (productLikeCount > 0) arrays.push(value);
    for (const item of value) productArrayCandidates(item, arrays);
    return arrays;
  }

  if (value && typeof value === "object") {
    for (const child of Object.values(value)) productArrayCandidates(child, arrays);
  }

  return arrays;
}

function extractCategoryProducts(payload, categoryId) {
  const arrays = productArrayCandidates(payload);
  const largest = arrays.sort((a, b) => b.length - a.length)[0] ?? [];
  return largest
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      pid: String(item.pid ?? item.productId ?? item.productSeq ?? ""),
      name: String(item.name ?? item.productName ?? item.title ?? ""),
      price: toInt(item.price ?? item.productPrice ?? item.salePrice),
      numFaved: toInt(item.numFaved ?? item.num_faved ?? item.favoriteCount ?? item.faved),
      query: `category:${categoryId}`,
      categoryId,
      freeShipping: item.free_shipping === true || item.free_shipping === "1",
    }))
    .filter((item) => item.pid);
}

async function categoryPage(categoryId, page, size = 60) {
  const url = new URL("https://api.bunjang.co.kr/api/search/v8/pw/product/specs/category");
  url.searchParams.set("categoryId", categoryId);
  url.searchParams.set("order", "score");
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  return extractCategoryProducts(await res.json(), categoryId);
}

async function fetchDetail(pid) {
  const url = `https://api.bunjang.co.kr/api/pms/v1/products/${pid}/detail/web`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  const json = await res.json();
  const product = json?.data?.product ?? {};
  const shop = json?.data?.shop ?? {};
  return {
    description: String(product.description ?? "").slice(0, 900),
    condition: String(product.condition ?? ""),
    saleStatus: String(product.saleStatus ?? ""),
    productSpecs: product.productSpecs ?? null,
    isProshop: shop.proshop === true || shop.isOfficialSeller === true,
    salesCount: toInt(shop.salesCount),
    reviewRating: shop.reviewRating == null ? null : Number(shop.reviewRating),
    reviewCount: toInt(shop.reviewCount),
  };
}

async function collectSamples({ queries, categoryIds = [], limit, pages }) {
  const byPid = new Map();
  for (const categoryId of categoryIds) {
    for (let page = 0; page < pages; page++) {
      const items = await categoryPage(categoryId, page);
      for (const item of items) {
        if (!byPid.has(item.pid)) byPid.set(item.pid, item);
      }
      await sleep(120);
    }
  }
  for (const query of queries) {
    for (let page = 0; page < pages; page++) {
      const items = await searchPage(query, page);
      for (const item of items) {
        if (!byPid.has(item.pid)) byPid.set(item.pid, item);
      }
      await sleep(120);
    }
  }
  const selected = [...byPid.values()].slice(0, limit);
  const samples = [];
  for (const [idx, item] of selected.entries()) {
    const detail = await fetchDetail(item.pid);
    await sleep(180);
    if (!detail) continue;
    samples.push({ ...item, ...detail });
    if ((idx + 1) % 25 === 0) console.log(`  collected ${idx + 1}/${selected.length}`);
  }
  return samples;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedBatch(texts, apiKey) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: 256 }),
  });
  if (!res.ok) throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

async function embedSamples(samples, apiKey) {
  const BATCH = 100;
  const all = [];
  for (let i = 0; i < samples.length; i += BATCH) {
    const batch = samples.slice(i, i + BATCH);
    const texts = batch.map((s) => `${s.name}\n${s.description.slice(0, 300)}`);
    const embeddings = await embedBatch(texts, apiKey);
    all.push(...embeddings);
    if (i + BATCH < samples.length) {
      console.log(`  embedded ${Math.min(i + BATCH, samples.length)}/${samples.length}`);
      await sleep(300);
    }
  }
  return all; // index-aligned with samples
}

// ─── K-means clustering ───────────────────────────────────────────────────────

function cosineDist(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return 1 - dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

function hashString(input) {
  let h = 2166136261;
  for (const ch of String(input ?? "")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let state = hashString(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assignToCentroids(embeddings, centroids) {
  return embeddings.map((e) => {
    let best = 0, bestDist = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      const dist = cosineDist(e, centroids[c]);
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    return best;
  });
}

function recomputeCentroids(embeddings, assignments, k) {
  const dim = embeddings[0].length;
  const centroids = Array.from({ length: k }, () => new Float64Array(dim));
  const counts = new Int32Array(k);
  for (let i = 0; i < embeddings.length; i++) {
    const c = assignments[i];
    counts[c]++;
    for (let d = 0; d < dim; d++) centroids[c][d] += embeddings[i][d];
  }
  for (let c = 0; c < k; c++) {
    if (counts[c] > 0) for (let d = 0; d < dim; d++) centroids[c][d] /= counts[c];
  }
  return centroids;
}

function kMeans(embeddings, k, maxIter = 60, seed = "default") {
  const random = seededRandom(seed);
  // k-means++ initialization
  const centroids = [];
  const first = Math.floor(random() * embeddings.length);
  centroids.push([...embeddings[first]]);
  while (centroids.length < k) {
    const dists = embeddings.map((e) => {
      let minD = Infinity;
      for (const c of centroids) minD = Math.min(minD, cosineDist(e, c));
      return minD;
    });
    const sum = dists.reduce((a, b) => a + b, 0);
    let r = random() * sum;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) { centroids.push([...embeddings[i]]); break; }
    }
  }

  let assignments = assignToCentroids(embeddings, centroids);
  for (let iter = 0; iter < maxIter; iter++) {
    const newCentroids = recomputeCentroids(embeddings, assignments, k);
    const newAssignments = assignToCentroids(embeddings, newCentroids);
    const changed = newAssignments.filter((a, i) => a !== assignments[i]).length;
    assignments = newAssignments;
    if (changed === 0) break;
  }
  const finalCentroids = recomputeCentroids(embeddings, assignments, k);
  return { assignments, centroids: finalCentroids };
}

function clusterGroups(samples, assignments, k) {
  const groups = Array.from({ length: k }, () => []);
  samples.forEach((s, i) => groups[assignments[i]].push({ ...s, _idx: i }));
  return groups;
}

// Representative samples = closest to centroid
function representativeSamples(group, centroid, embeddings, n = 5) {
  return group
    .map((s) => ({ s, dist: cosineDist(embeddings[s._idx], centroid) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n)
    .map((x) => x.s);
}

// ─── OpenAI helpers ───────────────────────────────────────────────────────────

async function chatCompletion(messages, apiKey, { model = "gpt-4.1-mini", temperature = 0.1, json = true } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return json ? extractJson(text) : text;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePlannedCategory(raw, fallbackId) {
  const id = String(raw.id ?? raw.category ?? fallbackId ?? raw.label ?? "category")
    .toLowerCase()
    .replace(/[^a-z0-9_가-힣-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || fallbackId;
  const label = String(raw.label ?? id);
  const rawQueries = Array.isArray(raw.queries) && raw.queries.length ? raw.queries.slice(0, 12).map(String) : [label];
  const coreQueries = rawQueries.filter((query) => !isAccessoryOnlyQuery(query));
  return {
    id,
    label,
    queries: coreQueries.length >= 3 ? coreQueries : rawQueries.slice(0, 8),
    seedSkus: Array.isArray(raw.seedSkus) ? raw.seedSkus.slice(0, 40).map(String) : [],
    minNormalPrice: Math.max(1000, toInt(raw.minNormalPrice, 30000)),
    clusterK: Math.min(24, Math.max(8, toInt(raw.clusterK, 14))),
    aiHints: `${String(raw.aiHints ?? `${label} 중고 매물. 정상 본품과 액세서리/부품/구매글/홍보글을 구분.`)} 검색 쿼리 단계에서 밴드/스트랩/케이스/필름/충전기 같은 액세서리 전용 쿼리는 제외한다.`,
    generated_by: "ai-category-planner",
  };
}

async function generateCategorySet(request, apiKey, sharedKnowledge, maxCategories) {
  const sharedExamples = (sharedKnowledge.noise_rules ?? [])
    .slice(0, 35)
    .map((rule) => `${rule.keyword}:${rule.type}:${(rule.categories ?? []).join("/")}`)
    .join(", ");
  const staticExamples = Object.entries(CATEGORIES)
    .map(([id, cfg]) => `${id}=${cfg.label}`)
    .join(", ");
  const result = await chatCompletion([
    {
      role: "system",
      content: "You are a category planner for a Korean secondhand resale intelligence engine. Return valid JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Break the user's category request into mining-ready product families. If the request includes several similar product families, split them. If it is one clear family, return one category. Prefer reusable category ids, but do not require hardcoded configs.",
        marketplace: "Bunjang Korea",
        category_request: request,
        max_categories: maxCategories,
        static_category_examples: staticExamples,
        shared_noise_knowledge: sharedExamples,
        rules: [
          "Use stable category ids in lowercase snake_case or ascii words, e.g. airpods, applewatch, galaxywatch, ipad, macbook.",
          "Queries must be Korean marketplace search queries likely to collect real used core products.",
          "Do not split by SKU too narrowly. airpods is one category; iPhone may be smartphone or iphone depending request.",
          "Include category-specific noise hints such as parts, accessories, buying posts, counterfeit, multi-model bundles.",
          "minNormalPrice should reject obvious accessories but not cheap damaged core products too aggressively.",
        ],
        output_schema: {
          categories: [
            {
              id: "category_id",
              label: "Human-readable label",
              queries: ["8~12 Korean search queries"],
              seedSkus: ["rough SKU ids expected in this product family"],
              minNormalPrice: "number KRW",
              clusterK: "number 8~24",
              aiHints: "Korean context: SKU axes, common noise, dangerous false positives",
            },
          ],
        },
      }),
    },
  ], apiKey);

  const categories = Array.isArray(result.categories) ? result.categories : [];
  return categories
    .slice(0, maxCategories)
    .map((cat, idx) => normalizePlannedCategory(cat, `category_${idx + 1}`));
}

async function resolveCategoryRequests(categoryArg, apiKey, sharedKnowledge, generatedAt) {
  if (categoryArg === "all") {
    return {
      request: categoryArg,
      planned: Object.entries(CATEGORIES).map(([id, config]) => ({ id, config: { ...config, generated_by: "static-config" } })),
      planPath: null,
    };
  }

  const explicit = categoryArg.split(",").map((c) => c.trim()).filter(Boolean);
  const allExplicitStatic = explicit.length > 0 && explicit.every((cat) => CATEGORIES[cat]);
  if (allExplicitStatic) {
    return {
      request: categoryArg,
      planned: explicit.map((id) => ({ id, config: { ...CATEGORIES[id], generated_by: "static-config" } })),
      planPath: null,
    };
  }

  const maxCategories = Number(argValue("--max-categories", "6"));
  console.log(`[planner] planning category request with AI: ${categoryArg}`);
  const plannedConfigs = await generateCategorySet(categoryArg, apiKey, sharedKnowledge, maxCategories);
  const planned = plannedConfigs.map((config) => ({ id: config.id, config }));
  const plan = {
    version: 1,
    request: categoryArg,
    generated_at: generatedAt,
    planner: "ai-category-planner",
    categories: planned.map(({ id, config }) => ({ id, ...config })),
  };
  await mkdir(categoryPlansDir, { recursive: true });
  const planPath = path.join(categoryPlansDir, `${planSlug(categoryArg)}.json`);
  await writeFile(planPath, JSON.stringify(plan, null, 2));
  return { request: categoryArg, planned, planPath };
}

// ─── Phase 3: AI cluster labeling ─────────────────────────────────────────────

const ALLOWED_LISTING_TYPES = new Set(["normal", "accessory", "parts", "damaged", "buying", "commercial", "multi", "counterfeit", "ambiguous"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);

function normalizeClusterLabel(label, clusterId) {
  const listingType = String(label?.listing_type ?? "ambiguous");
  const confidence = String(label?.confidence ?? "low");
  return {
    ...label,
    cluster_id: clusterId,
    listing_type: ALLOWED_LISTING_TYPES.has(listingType) ? listingType : "ambiguous",
    confidence: ALLOWED_CONFIDENCE.has(confidence) ? confidence : "low",
    rationale_ko: ALLOWED_LISTING_TYPES.has(listingType)
      ? label?.rationale_ko
      : `${label?.rationale_ko ?? ""} / 허용되지 않은 listing_type(${listingType})이라 ambiguous로 정규화`,
  };
}

async function labelCluster(clusterId, repSamples, clusterSize, category, config, apiKey) {
  const compacted = repSamples.map((s) => ({
    pid: s.pid,
    title: s.name,
    price: s.price,
    condition: s.condition,
    isProshop: s.isProshop,
    salesCount: s.salesCount,
    description: s.description.slice(0, 300),
  }));
  return chatCompletion([
    {
      role: "system",
      content: "You are a Korean secondhand market listing classifier. Return valid JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Classify this cluster of similar listings. Identify their common listing type and distinctive patterns.",
        category,
        category_hints: config.aiHints,
        classification_rules: [
          "`normal` means a complete core product that matches the target product family in category_hints, not merely a legitimate marketplace listing.",
          "Adjacent products outside the target family must not be labeled normal. Examples: game software/title/chip/pack for a console-hardware category, watch straps for smartwatch, cases/cables/stands for electronics.",
          "Use `accessory` for usable adjacent items or accessories that are not the target core product.",
          "Use `parts` for replacement parts, broken-for-repair items, or single component listings.",
          "Use `multi` when several target products or product families are bundled so one comparable SKU cannot be inferred.",
          "Only provide sku_hint for normal clusters that represent a target core product SKU.",
        ],
        cluster_id: clusterId,
        cluster_size: clusterSize,
        representative_samples: compacted,
        output_schema: {
          cluster_id: "number",
          listing_type: "normal|accessory|parts|damaged|buying|commercial|multi|counterfeit|ambiguous",
          confidence: "high|medium|low",
          rationale_ko: "왜 이 클러스터가 해당 타입인지 한국어로 설명",
          distinctive_keywords: ["이 클러스터를 구분짓는 핵심 단어들 (5~10개)"],
          negative_context: ["정상 매물에도 등장해서 제외하면 안 되는 컨텍스트 (예: 박스 포함)"],
          sku_hint: "normal 타입일 때만: 이 그룹이 대표하는 SKU 모델명 (예: iPhone 15 Pro 256GB)",
          price_note_ko: "가격 분포에서 특이한 점 (있으면)",
        },
      }),
    },
  ], apiKey);
}

// ─── Phase 4: Pattern extraction (TF-IDF style) ───────────────────────────────

function extractDistinctiveKeywords(noiseGroupSamples, normalGroupSamples, topN = 15) {
  const countWords = (samples) => {
    const freq = new Map();
    for (const s of samples) {
      const words = tokenize(`${s.name} ${s.description}`);
      for (const w of new Set(words)) freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    return freq;
  };
  const noiseFreq = countWords(noiseGroupSamples);
  const normalFreq = countWords(normalGroupSamples);
  const noiseTotal = Math.max(1, noiseGroupSamples.length);
  const normalTotal = Math.max(1, normalGroupSamples.length);

  const scored = [...noiseFreq.entries()]
    .filter(([, c]) => c >= 2)
    .map(([word, noiseCount]) => {
      const normalCount = normalFreq.get(word) ?? 0;
      const noiseRate = noiseCount / noiseTotal;
      const normalRate = normalCount / normalTotal;
      const score = noiseRate / (normalRate + 0.05); // +0.05 smoothing
      return { word, score, noiseCount, precision: noiseCount / (noiseCount + normalCount) };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}

// ─── Phase 5: Keyword auto-validation ─────────────────────────────────────────

async function validateKeyword(keyword, expectedType, allSamples, apiKey) {
  const hits = allSamples.filter((s) =>
    `${s.name} ${s.description}`.toLowerCase().includes(keyword.toLowerCase())
  );
  if (hits.length === 0) return { keyword, expectedType, precision: 0, hitCount: 0, validated: false };
  const sampleHits = hits.sort((a, b) => String(a.pid).localeCompare(String(b.pid))).slice(0, 5).map((s) => ({
    pid: s.pid,
    title: s.name,
    price: s.price,
    description: s.description.slice(0, 200),
  }));

  const result = await chatCompletion([
    { role: "system", content: "Korean secondhand market listing evaluator. Return valid JSON only." },
    {
      role: "user",
      content: JSON.stringify({
        task: `이 매물들이 진짜 "${expectedType}" 타입인가? 각 매물에 대해 판단하고 전체 precision(0.0~1.0)을 계산해줘.`,
        expected_type: expectedType,
        keyword_used: keyword,
        listings: sampleHits,
        output_schema: {
          per_listing: [{ pid: "string", is_correct_type: "boolean", reason_ko: "string" }],
          precision: "number (0.0~1.0)",
          verdict_ko: "전체 평가 한 문장",
        },
      }),
    },
  ], apiKey);
  return { keyword, expectedType, precision: result?.precision ?? 0, hitCount: hits.length, verdict: result?.verdict_ko, validated: true };
}

// ─── Price distribution (cluster-aware) ───────────────────────────────────────

function priceDistributionFromClusters(samples, normalIndices, config) {
  const normalSamples = samples.filter((_, i) => normalIndices.has(i) && samples[i].price >= config.minNormalPrice);

  // Group by rough model key. Keep patterns category-scoped so a broad token
  // such as "s20" in a camera title does not become a Galaxy price bucket.
  function roughKey(name) {
    const t = name.toLowerCase().replace(/\s+/g, "");
    const generalPatterns = [
      [/아이폰(1[1-6])(?:프로맥스|promax|pro max)/i, "iphone-$1-pro-max"],
      [/아이폰(1[1-6])(?:프로|pro)/i, "iphone-$1-pro"],
      [/아이폰(1[1-6])(?:플러스|plus)/i, "iphone-$1-plus"],
      [/아이폰(1[1-6])/i, "iphone-$1"],
      [/갤럭시s(2[0-5])울트라|s(2[0-5])ultra/i, "galaxy-s$1$2-ultra"],
      [/갤럭시s(2[0-5])플러스|s(2[0-5])plus/i, "galaxy-s$1$2-plus"],
      [/갤럭시s(2[0-5])|s(2[0-5])/i, "galaxy-s$1$2"],
      [/z플립([3-7])|zflip([3-7])/i, "galaxy-z-flip$1$2"],
      [/z폴드([3-7])|zfold([3-7])/i, "galaxy-z-fold$1$2"],
      [/아이패드프로/i, "ipad-pro"], [/아이패드에어/i, "ipad-air"],
      [/아이패드미니/i, "ipad-mini"], [/맥북에어/i, "macbook-air"],
      [/맥북프로/i, "macbook-pro"],
    ];
    const categoryPatterns = {
      camera_discovered: [
        [/소니(?:알파)?a7m?([2-5])|sonya7m?([2-5])/i, "sony-a7m$1$2"],
        [/소니(?:알파)?a7c(?:ii|2)?|sonya7c(?:ii|2)?/i, "sony-a7c"],
        [/소니a6([0-9]{3})|sonya6([0-9]{3})/i, "sony-a6$1$2"],
        [/캐논(?:eos)?r6(?:mark2|mk2|ii|2)?|canoneosr6(?:mark2|mk2|ii|2)?/i, "canon-eos-r6"],
        [/캐논(?:eos)?r8|canoneosr8/i, "canon-eos-r8"],
        [/캐논(?:eos)?r10|canoneosr10/i, "canon-eos-r10"],
        [/캐논(?:eos)?rp|canoneosrp/i, "canon-eos-rp"],
        [/캐논(?:eos)?200d|canoneos200d/i, "canon-eos-200d"],
        [/후지(?:필름)?x-t([0-9]{1,2})|fujix-t([0-9]{1,2})/i, "fujifilm-x-t$1$2"],
        [/후지(?:필름)?x-s([0-9]{1,2})|fujix-s([0-9]{1,2})/i, "fujifilm-x-s$1$2"],
        [/니콘z([0-9]{1,2})|nikonz([0-9]{1,2})/i, "nikon-z$1$2"],
      ],
      game_console_discovered: [
        [/스위치oled|switcholed|닌텐도oled/i, "nintendo-switch-oled"],
        [/스위치라이트|switchlite/i, "nintendo-switch-lite"],
        [/스위치2|switch2/i, "nintendo-switch-2"],
        [/닌텐도스위치|nintendoswitch|switch/i, "nintendo-switch"],
        [/ps5|플스5|플레이스테이션5/i, "playstation-5"],
        [/ps4|플스4|플레이스테이션4/i, "playstation-4"],
      ],
      game_console_body_narrow: [
        [/스위치oled|switcholed|닌텐도oled/i, "nintendo-switch-oled"],
        [/스위치라이트|switchlite/i, "nintendo-switch-lite"],
        [/스위치2|switch2/i, "nintendo-switch-2"],
        [/닌텐도스위치|nintendoswitch|switch/i, "nintendo-switch"],
        [/ps5.{0,16}(디지털|digital)|(?:디지털|digital).{0,16}ps5/i, "playstation-5-digital"],
        [/ps5.{0,16}(슬림|slim)|(?:슬림|slim).{0,16}ps5/i, "playstation-5-slim"],
        [/ps5|플스5|플레이스테이션5/i, "playstation-5"],
        [/ps4|플스4|플레이스테이션4/i, "playstation-4"],
      ],
      monitor_discovered: [
        [/([2-4][0-9])인치.*?(fhd|qhd|uhd|4k).*?([1-3][0-9]{2})hz/i, "monitor-$1in-$2-$3hz"],
        [/([2-4][0-9])인치.*?(fhd|qhd|uhd|4k)/i, "monitor-$1in-$2"],
      ],
      speaker_audio_discovered: [
        [/마샬스탠모어 ?([1-3])|marshallstanmore ?([1-3])/i, "marshall-stanmore-$1$2"],
        [/마샬액톤 ?([1-3])|marshallacton ?([1-3])/i, "marshall-acton-$1$2"],
        [/마샬워번 ?([1-3])|marshallwoburn ?([1-3])/i, "marshall-woburn-$1$2"],
        [/jblgo ?([2-4])/i, "jbl-go-$1"],
        [/jblflip ?([4-7])/i, "jbl-flip-$1"],
        [/jblcharge ?([4-6])/i, "jbl-charge-$1"],
        [/브리츠(?:bz-)?([a-z0-9-]{3,})|britz(?:bz-)?([a-z0-9-]{3,})/i, "britz-$1$2"],
        [/보스사운드링크|bosesoundlink/i, "bose-soundlink"],
        [/lg(?:엑스붐|xboom)?pk([0-9])/i, "lg-pk$1"],
      ],
      desktop_pc_discovered: [
        [/아이맥|imac/i, "imac"],
        [/맥미니|macmini/i, "mac-mini"],
        [/맥스튜디오|macstudio/i, "mac-studio"],
        [/rtx ?(30[56789]0|40[56789]0|50[6789]0)/i, "desktop-rtx-$1"],
        [/gtx ?(16[056]0)/i, "desktop-gtx-$1"],
        [/i([3579])-?(1[0-5])세대/i, "desktop-intel-i$1-$2th"],
        [/i([3579])-?(1[0-5])[0-9]{3}/i, "desktop-intel-i$1-$2th"],
        [/라이젠 ?([3579])|ryzen ?([3579])/i, "desktop-ryzen-$1$2"],
        [/게이밍(?:컴퓨터|pc|본체)|gamingpc/i, "gaming-desktop"],
        [/사무용(?:컴퓨터|pc|본체)/i, "office-desktop"],
      ],
      home_appliance_tech_discovered: [
        [/다이슨v([0-9]{1,2})|dysonv([0-9]{1,2})/i, "dyson-v$1$2"],
        [/다이슨에어랩|dysonairwrap/i, "dyson-airwrap"],
        [/다이슨슈퍼소닉|dysonsupersonic/i, "dyson-supersonic"],
        [/로보락s([0-9]{1,2})|roborocks([0-9]{1,2})/i, "roborock-s$1$2"],
        [/로보락q([0-9]{1,2})|roborockq([0-9]{1,2})/i, "roborock-q$1$2"],
        [/드리미(?:x|l)?([0-9]{1,2})|dreame(?:x|l)?([0-9]{1,2})/i, "dreame-$1$2"],
        [/닌자(?:블렌더|초퍼)|ninjablender/i, "ninja-blender"],
        [/에어프라이어|airfryer/i, "air-fryer"],
        [/로봇청소기/i, "robot-vacuum"],
      ],
    };
    const patterns = categoryPatterns[config.key] ?? generalPatterns;
    for (const [pat, key] of patterns) {
      const m = t.match(pat);
      if (m) return key.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? "");
    }
    return "unknown";
  }

  const byKey = new Map();
  for (const s of normalSamples) {
    const key = roughKey(s.name);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(s.price);
  }
  return [...byKey.entries()]
    .map(([key, prices]) => ({
      key,
      count: prices.length,
      min: Math.min(...prices),
      p25: quantile(prices, 0.25),
      median: quantile(prices, 0.5),
      p75: quantile(prices, 0.75),
      max: Math.max(...prices),
      core_sample_count: prices.length,
      excluded_count: samples.length - normalSamples.length,
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── Output formatters ────────────────────────────────────────────────────────

function markdownCatalog({ config, category, generatedAt, clusterLabels, prices }) {
  const normalClusters = clusterLabels.filter((c) => c.listing_type === "normal" && c.confidence !== "low");
  const lines = [
    `# ${config.label} — Catalog Suggestions (v2)`,
    "",
    `- category: ${category}`,
    `- generated_at: ${generatedAt}`,
    `- method: embedding-cluster-label`,
    "",
    "## Discovered Normal Clusters (SKU Candidates)",
    "",
    "| cluster | confidence | sku_hint | distinctive_keywords |",
    "|---|---|---|---|",
  ];
  for (const c of normalClusters) {
    lines.push(`| ${c.cluster_id} | ${c.confidence} | ${c.sku_hint ?? "-"} | ${(c.distinctive_keywords ?? []).slice(0, 5).join(", ")} |`);
  }
  lines.push("", "## Price Distribution Snapshot", "", "| rough key | count | p25 | median | p75 |", "|---|---:|---:|---:|---:|");
  for (const row of prices.slice(0, 20)) {
    lines.push(`| ${row.key} | ${row.count} | ${row.p25.toLocaleString("ko-KR")} | ${row.median.toLocaleString("ko-KR")} | ${row.p75.toLocaleString("ko-KR")} |`);
  }
  lines.push("");
  return lines.join("\n") + "\n";
}

function markdownNoise({ config, category, generatedAt, clusterLabels, validatedKeywords }) {
  const noiseClusters = clusterLabels.filter((c) => c.listing_type !== "normal" && c.listing_type !== "ambiguous");
  const keywordRows = validatedKeywords.map((v) => {
    const type = v.expectedType ?? "noise";
    const riskFlags = keywordRiskFlags(v.keyword, type);
    const approvalStatus = riskFlags.length
      ? "blocked_needs_review"
      : v.precision >= 0.80
        ? "auto_approved_for_review"
        : v.precision >= 0.60
          ? "needs_human_review"
          : "rejected";
    return { ...v, type, riskFlags, approvalStatus };
  });
  const lines = [
    `# ${config.label} — Noise Rule Suggestions (v2)`,
    "",
    `- category: ${category}`,
    `- generated_at: ${generatedAt}`,
    `- method: cluster-discovered (auto-validated)`,
    "",
    "## Discovered Noise Clusters",
    "",
    "| cluster | type | confidence | distinctive_keywords | rationale |",
    "|---|---|---|---|---|",
  ];
  for (const c of noiseClusters) {
    lines.push(`| ${c.cluster_id} | ${c.listing_type} | ${c.confidence} | ${(c.distinctive_keywords ?? []).slice(0, 5).join(", ")} | ${c.rationale_ko ?? "-"} |`);
  }
  lines.push("", "## Auto-Validated Keywords", "", "> precision ≥ 0.80 이더라도 일반 판매 문구/모델군 단어/거래 문장은 자동 반영하지 않는다.", "");
  const approved = keywordRows.filter((v) => v.approvalStatus === "auto_approved_for_review");
  const review = keywordRows.filter((v) => v.approvalStatus !== "auto_approved_for_review" && v.approvalStatus !== "rejected");
  const rejected = keywordRows.filter((v) => v.approvalStatus === "rejected");
  if (approved.length) {
    lines.push("### ✅ 자동 승인", "");
    for (const v of approved) lines.push(`- \`${v.keyword}\` — precision: ${v.precision.toFixed(2)}, hits: ${v.hitCount}${v.verdict ? ` — ${v.verdict}` : ""}`);
    lines.push("");
  }
  if (review.length) {
    lines.push("### 🔍 사람 검수/자동 차단", "");
    for (const v of review) {
      const risk = v.riskFlags.length ? ` / risk=${v.riskFlags.join(",")}` : "";
      lines.push(`- \`${v.keyword}\` — ${v.type}, precision: ${v.precision.toFixed(2)}, hits: ${v.hitCount}${risk}${v.verdict ? ` — ${v.verdict}` : ""}`);
    }
    lines.push("");
  }
  if (rejected.length) {
    lines.push("### ❌ 자동 기각 (precision < 0.60)", "");
    for (const v of rejected) lines.push(`- \`${v.keyword}\` — precision: ${v.precision.toFixed(2)}, hits: ${v.hitCount}`);
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

function markdownReview({ config, category, generatedAt, samples, clusterLabels, validatedKeywords }) {
  const ambiguous = clusterLabels.filter((c) => c.listing_type === "ambiguous" || c.confidence === "low");
  const lines = [
    `# ${config.label} — Category Expansion Review (v2)`,
    "",
    `- category: ${category}`,
    `- generated_at: ${generatedAt}`,
    `- samples: ${samples.length}`,
    `- clusters: ${clusterLabels.length}`,
    "",
    "## 클러스터 요약",
    "",
    "| cluster | type | confidence | size | sample titles |",
    "|---|---|---|---|---|",
  ];
  for (const c of clusterLabels) {
    const ex = (c._samples ?? []).slice(0, 2).map((s) => s.name).join(" / ");
    lines.push(`| ${c.cluster_id} | ${c.listing_type} | ${c.confidence} | ${c._size ?? "?"} | ${ex} |`);
  }
  if (ambiguous.length) {
    lines.push("", "## ⚠️ 사람 검수 필요 (모호 클러스터)", "");
    for (const c of ambiguous) {
      lines.push(`### Cluster ${c.cluster_id} — ${c.listing_type} (${c.confidence})`);
      lines.push(`- 사유: ${c.rationale_ko ?? "-"}`);
      for (const s of c._samples ?? []) lines.push(`  - ${s.pid} / ${s.name} / ${s.price?.toLocaleString("ko-KR")}원`);
      lines.push("");
    }
  }
  const approvedCount = validatedKeywords.filter((v) => v.precision >= 0.80).length;
  lines.push("", "## 키워드 검증 요약", "", `- 자동 승인: ${approvedCount}개`, `- 검수 필요: ${validatedKeywords.filter((v) => v.precision >= 0.60 && v.precision < 0.80).length}개`, `- 자동 기각: ${validatedKeywords.filter((v) => v.precision < 0.60).length}개`, "");
  return lines.join("\n") + "\n";
}

function buildNoiseRules({ category, generatedAt, clusterLabels, validatedKeywords }) {
  return {
    version: 1,
    category,
    generated_at: generatedAt,
    method: "v3_embedding_cluster_ai_validation",
    rules: validatedKeywords.map((item) => {
      const type = item.expectedType ?? "noise";
      const riskFlags = keywordRiskFlags(item.keyword, type);
      return {
        keyword: item.keyword,
        type,
        precision: Number(item.precision ?? 0),
        hit_count: Number(item.hitCount ?? 0),
        risk_flags: riskFlags,
        approval_status: riskFlags.length ? "blocked_needs_review" : item.precision >= 0.8 ? "auto_approved_for_review" : item.precision >= 0.6 ? "needs_human_review" : "rejected",
        verdict_ko: item.verdict ?? "",
      };
    }),
    cluster_evidence: clusterLabels
      .filter((c) => c.listing_type !== "normal")
      .map((c) => ({
        cluster_id: c.cluster_id,
        listing_type: c.listing_type,
        classification_confidence: c.confidence === "high" ? 0.9 : c.confidence === "medium" ? 0.7 : 0.45,
        confidence_label: c.confidence,
        confidence_reason: c.rationale_ko ?? "",
        evidence_terms: c.distinctive_keywords ?? [],
      })),
  };
}

function keywordRiskFlags(keyword, expectedType) {
  const raw = String(keyword ?? "").trim();
  const text = raw.toLowerCase().replace(/\s+/g, "");
  const flags = [];
  const broadProductFamilyKeywords = new Set([
    "airpods",
    "에어팟",
    "applewatch",
    "애플워치",
    "galaxywatch",
    "갤럭시워치",
    "iphone",
    "아이폰",
    "galaxy",
    "갤럭시",
    "smartphone",
    "스마트폰",
    "휴대폰",
    "핸드폰",
    "laptop",
    "notebook",
    "노트북",
    "macbook",
    "맥북",
    "ipad",
    "아이패드",
    "tablet",
    "태블릿",
    "nintendo",
    "닌텐도",
    "switch",
    "스위치",
    "playstation",
    "플레이스테이션",
    "플스",
    "ps",
    "ps2",
    "ps3",
    "ps4",
    "ps5",
    "psp",
    "vita",
    "psvita",
    "ds",
    "2ds",
    "3ds",
    "dsi",
    "게임",
    "게임기",
    "타이틀",
    "칩",
    "팩",
  ]);
  if (!expectedType || expectedType === "noise") flags.push("generic_noise_type");
  if (!text || text.length < 2) flags.push("too_short");
  const genericMarketWords = new Set([
    "가격", "판매", "팝니다", "판매합니다", "연락주세요", "문의", "직거래",
    "상품은", "이미지에", "상태", "있음", "반품", "택배", "평일",
    "미개봉", "새상품", "소장용", "소장용으로", "비닐", "뜯지", "분들께",
  ]);
  if (genericMarketWords.has(text)) flags.push("generic_marketplace_word");
  if (["apple", "애플", "samsung", "삼성", "galaxy", "갤럭시", "iphone", "아이폰"].includes(text)) {
    flags.push("generic_brand_or_family");
  }
  if (
    expectedType === "parts" &&
    !/(유닛|본체만|케이스만|충전케이스|단품|낱개|왼쪽|오른쪽|좌측|우측|부분|한쪽|이어버드)/.test(text)
  ) {
    flags.push("parts_keyword_without_part_context");
  }
  if (expectedType !== "normal" && /(에어팟|airpods|버즈|buds|노캔|라이트닝|8핀|c타입|4세대|프로2|프로3)/.test(text)) {
    flags.push("model_or_option_as_noise_keyword");
  }
  if (broadProductFamilyKeywords.has(text) && expectedType !== "accessory") {
    flags.push("broad_product_family_keyword");
  }
  if (/(아이폰|iphone)\d{1,2}(프로|max|promax|plus|플러스)?/.test(text) && expectedType !== "normal") {
    flags.push("model_name_as_noise_keyword");
  }
  if (/(갤럭시|galaxy)(s|z)?\d{1,2}(울트라|ultra|플러스|plus|fe)?/.test(text) && expectedType !== "normal") {
    flags.push("model_name_as_noise_keyword");
  }
  if (/(입니다|합니다|있습니다|판매합니다|드립니다|재고는)$/.test(text)) {
    flags.push("sentence_fragment");
  }
  if (/(해서|하여|하고|되면|하면|하시면|하실|쓰실|보시면|드립니다|합니다)$/.test(text)) {
    flags.push("verb_phrase_fragment");
  }
  if (/(택배비|배송비|안전결제|없으시면|주시면|문의|연락|번개톡)/.test(text)) {
    flags.push("transaction_or_sentence_fragment");
  }
  if (/^\d+$/.test(text)) flags.push("numeric_only");
  return flags;
}

function buildSkuCatalog({ category, generatedAt, clusterLabels, prices }) {
  const normalClusters = clusterLabels.filter((c) => c.listing_type === "normal" && c.confidence !== "low");
  const rawSkus = normalClusters.map((cluster) => {
    const hint = String(cluster.sku_hint ?? `cluster-${cluster.cluster_id}`);
    const priceRow = prices.find((row) => hint.toLowerCase().replace(/\s+/g, "").includes(row.key.replace(/-/g, "")));
    const riskFlags = skuCandidateRiskFlags(cluster);
    return {
      id: slugify(hint),
      brand: "",
      model_name: hint,
      aliases: [...new Set([hint, ...(cluster.distinctive_keywords ?? [])])].slice(0, 12),
      model_codes: [],
      differentiators: [],
      sku_median: priceRow?.median ?? null,
      price_range: priceRow ? [priceRow.p25, priceRow.p75] : null,
      source_cluster_ids: [cluster.cluster_id],
      classification_confidence: cluster.confidence === "high" ? 0.9 : 0.7,
      risk_flags: riskFlags,
      approval_status: riskFlags.length ? "blocked_needs_review" : cluster.confidence === "high" ? "needs_human_approval" : "needs_review",
      rationale_ko: cluster.rationale_ko ?? "",
    };
  });
  const merged = new Map();
  for (const sku of rawSkus) {
    const prev = merged.get(sku.id);
    if (!prev) {
      merged.set(sku.id, sku);
      continue;
    }
    prev.aliases = [...new Set([...prev.aliases, ...sku.aliases])].slice(0, 16);
    prev.risk_flags = [...new Set([...prev.risk_flags, ...sku.risk_flags])];
    prev.source_cluster_ids = [...new Set([...prev.source_cluster_ids, ...sku.source_cluster_ids])];
    prev.classification_confidence = Math.max(prev.classification_confidence, sku.classification_confidence);
    prev.sku_median = prev.sku_median ?? sku.sku_median;
    prev.price_range = prev.price_range ?? sku.price_range;
    prev.rationale_ko = [prev.rationale_ko, sku.rationale_ko].filter(Boolean).join(" / ").slice(0, 600);
    prev.approval_status = prev.risk_flags.length ? "blocked_needs_review" : prev.classification_confidence >= 0.85 ? "needs_human_approval" : "needs_review";
  }
  return {
    version: 1,
    category,
    generated_at: generatedAt,
    method: "v3_normal_cluster_to_sku_candidates",
    skus: [...merged.values()].sort((a, b) => a.id.localeCompare(b.id, "ko")),
  };
}

function skuCandidateRiskFlags(cluster) {
  const text = [
    cluster.sku_hint,
    ...(cluster.distinctive_keywords ?? []),
    cluster.rationale_ko,
  ].join(" ").toLowerCase();
  const flags = [];
  const commercialTerms = ["특가", "선착순", "완납폰", "제휴카드", "통신사", "개통", "재고", "유심", "할부", "맞춤", "초특가", "한정수량"];
  if (commercialTerms.some((term) => text.includes(term))) flags.push("commercial_or_bait_terms");

  const skuHintText = String(cluster.sku_hint ?? "").toLowerCase();
  const modelHits = new Set();
  const patterns = [
    /iphone\s*(1[1-9]|2[0-9]|se)/gi,
    /아이폰\s*(1[1-9]|2[0-9]|se)/gi,
    /galaxy\s*s\s*(2[0-9])/gi,
    /갤럭시\s*s\s*(2[0-9])/gi,
    /갤럭시\s*z\s*플립\s*([3-9])/gi,
    /z\s*플립\s*([3-9])/gi,
    /갤럭시\s*z\s*폴드\s*([3-9])/gi,
    /z\s*폴드\s*([3-9])/gi,
    /airpods?\s*(max|pro|[1-9])/gi,
    /에어팟\s*(맥스|프로|[1-9]|4세대)/gi,
    /애플워치\s*(se|울트라|[1-9])/gi,
    /apple\s*watch\s*(se|ultra|[1-9])/gi,
    /galaxy\s*watch\s*(classic|ultra|[1-9])/gi,
    /갤럭시\s*워치\s*(클래식|울트라|[1-9])/gi,
    /wh-?\s*1000xm\s*([3-9])/gi,
    /xm\s*([3-9])/gi,
  ];
  for (const pattern of patterns) {
    for (const match of skuHintText.matchAll(pattern)) modelHits.add(match[0].replace(/\s+/g, ""));
  }
  if (modelHits.size >= 2) flags.push("multi_model_sku_hint");

  const separatorCount = (String(cluster.sku_hint ?? "").match(/[,/|]/g) ?? []).length;
  if (/[,+/|]/.test(String(cluster.sku_hint ?? "")) && modelHits.size >= 2) {
    flags.push("separator_with_multiple_models");
  }
  if (separatorCount >= 2) flags.push("many_separators_in_sku_hint");
  if (/(다양한\s*사양|풀세트|풀셋트|사무용.*게이밍|게이밍.*사무용|및)/.test(String(cluster.sku_hint ?? ""))) {
    flags.push("broad_bundle_or_usecase_sku_hint");
  }

  const genericAliasTerms = ["본체", "무선", "블루투스", "이어폰", "헤드폰", "헤드셋", "새상품", "미개봉", "정품"];
  const aliases = cluster.distinctive_keywords ?? [];
  const genericAliasCount = aliases.filter((alias) =>
    genericAliasTerms.includes(String(alias).toLowerCase().replace(/\s+/g, ""))
  ).length;
  if (genericAliasCount >= 3) flags.push("generic_alias_heavy");
  return [...new Set(flags)];
}

function markdownHumanReview({ config, category, generatedAt, noiseRules, skuCatalog, clusterLabels }) {
  const reviewRules = noiseRules.rules.filter((r) => r.approval_status !== "rejected");
  const reviewSkus = skuCatalog.skus;
  const ambiguous = clusterLabels.filter((c) => c.listing_type === "ambiguous" || c.confidence === "low");
  const lines = [
    `# ${config.label} — Human Review Queue (v3)`,
    "",
    `- category: ${category}`,
    `- generated_at: ${generatedAt}`,
    "- 목적: AI가 만든 룰/SKU 후보 중 production 반영 전 사람이 승인할 것만 모음",
    "",
    "## 승인 후보 Noise Rules",
    "",
    "| approve | type | keyword | precision | hits | note |",
    "|---|---|---|---:|---:|---|",
  ];
  for (const rule of reviewRules) {
    lines.push(`| [ ] | ${rule.type} | \`${rule.keyword}\` | ${rule.precision.toFixed(2)} | ${rule.hit_count} | ${rule.verdict_ko || "-"} |`);
  }
  lines.push("", "## 승인 후보 SKU", "", "| approve | sku_id | model_name | aliases | median | confidence |", "|---|---|---|---|---:|---:|");
  for (const sku of reviewSkus) {
    const checkbox = sku.approval_status === "blocked_needs_review" ? "BLOCK" : "[ ]";
    const risk = sku.risk_flags?.length ? ` / risk=${sku.risk_flags.join(",")}` : "";
    lines.push(`| ${checkbox} | ${sku.id} | ${sku.model_name}${risk} | ${sku.aliases.slice(0, 5).join(", ")} | ${sku.sku_median?.toLocaleString("ko-KR") ?? "-"} | ${sku.classification_confidence.toFixed(2)} |`);
  }
  if (ambiguous.length) {
    lines.push("", "## 모호 클러스터", "");
    for (const c of ambiguous) {
      lines.push(`### Cluster ${c.cluster_id} — ${c.listing_type} / ${c.confidence}`);
      lines.push(`- reason: ${c.rationale_ko ?? "-"}`);
      for (const s of c._samples ?? []) lines.push(`  - ${s.pid} / ${s.name} / ${s.price?.toLocaleString("ko-KR")}원`);
      lines.push("");
    }
  }
  return lines.join("\n") + "\n";
}

function markdownPromotionPlan({ category, generatedAt, noiseRules, skuCatalog }) {
  const approvedRules = noiseRules.rules.filter((r) => r.approval_status === "auto_approved_for_review");
  const promotableSkus = skuCatalog.skus.filter((sku) => sku.approval_status === "needs_human_approval");
  const blockedSkus = skuCatalog.skus.filter((sku) => sku.approval_status === "blocked_needs_review");
  const lines = [
    `# ${category} — Promotion Plan (v3)`,
    "",
    `- generated_at: ${generatedAt}`,
    "- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.",
    "",
    "## 다음 명령",
    "",
    "```bash",
    `node scripts/promote-catalog.mjs --category=${category} --dry-run`,
    `node scripts/promote-catalog.mjs --category=${category} --apply`,
    "```",
    "",
    "## 반영 후보 요약",
    "",
    `- noise rules: ${noiseRules.rules.length}개 (${approvedRules.length}개 고신뢰)`,
    `- sku candidates: ${skuCatalog.skus.length}개 (${promotableSkus.length}개 promotion 후보, ${blockedSkus.length}개 risk 차단)`,
    "",
    "## pipeline.ts 후보",
    "",
  ];
  for (const rule of approvedRules) {
    lines.push(`- ${rule.type}: \`${rule.keyword}\` (precision ${rule.precision.toFixed(2)}, hits ${rule.hit_count})`);
  }
  lines.push("", "## catalog.ts 후보", "");
  for (const sku of promotableSkus) {
    lines.push(`- ${sku.id}: ${sku.model_name} / aliases=${sku.aliases.slice(0, 5).join(", ")}`);
  }
  if (blockedSkus.length) {
    lines.push("", "## 차단된 SKU 후보 (검수 필요)", "");
    for (const sku of blockedSkus) {
      lines.push(`- ${sku.id}: ${sku.model_name} / risk=${sku.risk_flags.join(", ")}`);
    }
  }
  return lines.join("\n") + "\n";
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

async function runCategory({ category, config, limit, pages, generatedAt, apiKey, sharedKnowledge }) {
  const categoryDir = path.join(outDir, category);
  await mkdir(categoryDir, { recursive: true });
  const queryPlan = {
    category,
    source: "bunjang",
    source_type: "marketplace_listing",
    label: config.label,
    categoryIds: config.categoryIds ?? [],
    queries: config.queries,
    seedSkus: config.seedSkus ?? [],
    minNormalPrice: config.minNormalPrice,
    clusterK: config.clusterK,
    aiHints: config.aiHints,
  };
  await writeFile(path.join(categoryDir, "query_plan.json"), JSON.stringify(queryPlan, null, 2));

  // Phase 1: Collect
  let samples;
  if (hasFlag("--reuse-samples")) {
    samples = JSON.parse(await readFile(path.join(categoryDir, "samples.json"), "utf-8"));
    console.log(`\n[${category}] reusing ${samples.length} samples`);
  } else {
    console.log(`\n[${category}] collecting (limit=${limit}, pages=${pages})`);
    samples = await collectSamples({
      queries: config.queries,
      categoryIds: config.queryOnly ? [] : config.categoryIds ?? [],
      limit,
      pages,
    });
    await writeFile(path.join(categoryDir, "samples.json"), JSON.stringify(samples, null, 2));
  }
  samples = samples.map(normalizeMarketplaceSample);
  await writeFile(path.join(categoryDir, "normalized_samples.json"), JSON.stringify(samples, null, 2));
  console.log(`[${category}] samples: ${samples.length}`);

  // Phase 2: Embed (cache to embeddings.json)
  let embeddings;
  const embedPath = path.join(categoryDir, "embeddings.json");
  const shouldReembed = !hasFlag("--reuse-samples") || !await readFile(embedPath, "utf-8").then(() => true).catch(() => false);
  if (shouldReembed) {
    console.log(`[${category}] embedding ${samples.length} samples...`);
    embeddings = await embedSamples(samples, apiKey);
    await writeFile(embedPath, JSON.stringify(embeddings), "utf-8");
  } else {
    embeddings = JSON.parse(await readFile(embedPath, "utf-8"));
    if (embeddings.length !== samples.length) {
      console.log(`[${category}] embeddings mismatch, re-embedding...`);
      embeddings = await embedSamples(samples, apiKey);
      await writeFile(embedPath, JSON.stringify(embeddings), "utf-8");
    } else {
      console.log(`[${category}] reusing cached embeddings`);
    }
  }

  // Phase 3: K-means cluster
  const k = config.clusterK;
  console.log(`[${category}] clustering k=${k}...`);
  const { assignments, centroids } = kMeans(embeddings, k, 60, category);
  const groups = clusterGroups(samples, assignments, k);

  // Phase 4: AI cluster labeling
  console.log(`[${category}] labeling ${k} clusters...`);
  const clusterLabels = [];
  for (let c = 0; c < k; c++) {
    const group = groups[c];
    if (!group.length) continue;
    const reps = representativeSamples(group, centroids[c], embeddings);
    let label;
    try {
      label = await labelCluster(c, reps, group.length, category, config, apiKey);
      await sleep(200);
    } catch (err) {
      console.error(`  cluster ${c} label failed: ${err.message}`);
      label = { cluster_id: c, listing_type: "ambiguous", confidence: "low", rationale_ko: "AI 레이블링 실패" };
    }
    label = normalizeClusterLabel(label, c);
    label._size = group.length;
    label._samples = reps.map((s) => ({ pid: s.pid, name: s.name, price: s.price }));
    clusterLabels.push(label);
    process.stdout.write(`  [${c}/${k - 1}] ${label.listing_type} (${label.confidence}) — ${group.length}건\n`);
  }

  // Phase 5: Keyword extraction + validation
  const normalIndices = new Set();
  const noiseGroupSamples = [];
  for (const label of clusterLabels) {
    if (label.listing_type === "normal") {
      groups[label.cluster_id].forEach((s) => normalIndices.add(s._idx));
    } else if (label.listing_type !== "ambiguous") {
      noiseGroupSamples.push(...groups[label.cluster_id]);
    }
  }
  const normalSamples = samples.filter((_, i) => normalIndices.has(i));

  // Extract candidate keywords from noise clusters
  const rawKeywords = extractDistinctiveKeywords(noiseGroupSamples, normalSamples, 20);
  console.log(`[${category}] validating ${rawKeywords.length} keyword candidates...`);
  const validatedKeywords = [];
  for (const { word, precision: extractedPrecision } of rawKeywords.slice(0, 20)) {
    if (extractedPrecision < 0.50) continue; // pre-filter very noisy words
    const noiseLabel = clusterLabels.find((c) =>
      c.listing_type !== "normal" && (c.distinctive_keywords ?? []).some((k) => k.includes(word) || word.includes(k))
    );
    const expectedType = noiseLabel?.listing_type ?? "noise";
    try {
      const result = await validateKeyword(word, expectedType, samples, apiKey);
      validatedKeywords.push(result);
      await sleep(150);
    } catch (err) {
      console.error(`  keyword "${word}" validation failed: ${err.message}`);
    }
  }

  // Price distribution
  const prices = priceDistributionFromClusters(samples, normalIndices, { ...config, key: category });
  const noiseRules = buildNoiseRules({ category, generatedAt, clusterLabels, validatedKeywords });
  const skuCatalog = buildSkuCatalog({ category, generatedAt, clusterLabels, prices });

  // Outputs
  const clusterAnalysis = clusterLabels.map((c) => {
    const out = { ...c };
    delete out._samples;
    return out;
  });
  await writeFile(path.join(categoryDir, "cluster_analysis.json"), JSON.stringify(clusterAnalysis, null, 2));
  await writeFile(path.join(categoryDir, "price_distribution.json"), JSON.stringify(prices, null, 2));
  await writeFile(path.join(categoryDir, "catalog_SUGGESTIONS.md"), markdownCatalog({ config, category, generatedAt, clusterLabels, prices }));
  await writeFile(path.join(categoryDir, "noise_PATCH.md"), markdownNoise({ config, category, generatedAt, clusterLabels, validatedKeywords }));
  await writeFile(path.join(categoryDir, "REVIEW.md"), markdownReview({ config, category, generatedAt, samples, clusterLabels, validatedKeywords }));
  await writeFile(path.join(categoryDir, "noise_rules.json"), JSON.stringify(noiseRules, null, 2));
  await writeFile(path.join(categoryDir, "sku_catalog.json"), JSON.stringify(skuCatalog, null, 2));
  await writeFile(path.join(categoryDir, "human_review_queue.md"), markdownHumanReview({ config, category, generatedAt, noiseRules, skuCatalog, clusterLabels }));
  await writeFile(path.join(categoryDir, "PROMOTION_PLAN.md"), markdownPromotionPlan({ category, generatedAt, noiseRules, skuCatalog }));
  updateSharedKnowledge(sharedKnowledge, category, validatedKeywords);

  const approved = validatedKeywords.filter((v) => v.precision >= 0.80).length;
  console.log(`[${category}] done. normal clusters: ${normalIndices.size}/${samples.length}, approved keywords: ${approved}, sku candidates: ${skuCatalog.skus.length}`);
  return { category, samples: samples.length, clusters: k, approvedKeywords: approved, skuCandidates: skuCatalog.skus.length };
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(rootDir, "poc", ".env"));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { console.error("OPENAI_API_KEY required"); process.exit(1); }

  const limit = Number(argValue("--limit", "500"));
  const pages = Number(argValue("--pages", "3"));
  const categoryArg = argValue("--category", "smartphone");
  const planOnly = hasFlag("--plan-only");
  const generatedAt = new Date().toISOString();

  await mkdir(outDir, { recursive: true });
  const sharedKnowledge = await loadSharedKnowledge();
  const resolved = await resolveCategoryRequests(categoryArg, apiKey, sharedKnowledge, generatedAt);
  const requested = resolved.planned.map(({ id }) => id);
  console.log(`mine-category-intelligence v3 — ${requested.join(", ")}`);
  if (resolved.planPath) console.log(`[planner] wrote ${path.relative(appDir, resolved.planPath)}`);
  for (const { id, config } of resolved.planned) {
    console.log(`  plan ${id}: ${config.queries.slice(0, 5).join(", ")}${config.queries.length > 5 ? "..." : ""}`);
  }
  if (planOnly) {
    console.log("\nPlan-only mode. Re-run without --plan-only to collect and mine these categories.");
    return;
  }

  const summaries = [];
  for (const { id: cat, config: baseConfig } of resolved.planned) {
    let config = baseConfig;
    config = {
      ...config,
      aiHints: `${config.aiHints}${sharedHintsForCategory(sharedKnowledge, cat)}`,
    };
    const result = await runCategory({ category: cat, config, limit, pages, generatedAt, apiKey, sharedKnowledge });
    summaries.push(result);
  }
  await saveSharedKnowledge(sharedKnowledge);
  console.log("\n=== Summary ===");
  for (const s of summaries) console.log(`  ${s.category}: ${s.samples} samples, ${s.clusters} clusters, ${s.approvedKeywords} approved keywords, ${s.skuCandidates} sku candidates`);
}

main().catch((err) => { console.error(err); process.exit(1); });
