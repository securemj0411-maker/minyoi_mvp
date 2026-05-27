// Wave 888 (2026-05-27): Generate Daangn region centroid coordinates.
//
// Output:
//   src/lib/generated/daangn-region-geo.json
//
// Uses Kakao Local search server-side. This is an operator script, not runtime.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_DAANGN_REGION_SEEDS, type DaangnRegionSeed } from "../src/lib/daangn";
import regionParentsRaw from "../src/lib/generated/daangn-region-parents.json";

type GeoEntry = {
  id: string;
  name: string;
  query: string;
  fullPath: string;
  lat: number;
  lng: number;
  source: "daangn_parent" | "daangn_seed";
};

type KakaoRegionParts = {
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string;
  region_3depth_h_name?: string;
};

type KakaoAddressDoc = {
  address_name?: string;
  address?: KakaoRegionParts | null;
  road_address?: KakaoRegionParts | null;
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string;
  x?: string;
  y?: string;
};

type KakaoAddressResponse = {
  documents?: KakaoAddressDoc[];
};

const OUT_PATH = path.resolve(__dirname, "../src/lib/generated/daangn-region-geo.json");
const ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json";
const KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const regionParents = regionParentsRaw as Record<string, string>;

function loadDotEnvLocal() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function normalizePath(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function expandProvince(value: string) {
  return value
    .replace(/^서울\b/, "서울특별시")
    .replace(/^부산\b/, "부산광역시")
    .replace(/^인천\b/, "인천광역시")
    .replace(/^대구\b/, "대구광역시")
    .replace(/^대전\b/, "대전광역시")
    .replace(/^광주\b/, "광주광역시")
    .replace(/^울산\b/, "울산광역시")
    .replace(/^경기\b/, "경기도")
    .replace(/^강원\b/, "강원특별자치도")
    .replace(/^충북\b/, "충청북도")
    .replace(/^충남\b/, "충청남도")
    .replace(/^전북\b/, "전북특별자치도")
    .replace(/^전남\b/, "전라남도")
    .replace(/^경북\b/, "경상북도")
    .replace(/^경남\b/, "경상남도")
    .replace(/^제주\b/, "제주특별자치도");
}

function gyeonggiPath(name: string) {
  const cityDistrict = name.match(/^(수원|성남|안양|안산|고양|용인)\s+(.+)$/);
  if (cityDistrict) return `경기도 ${cityDistrict[1]}시 ${cityDistrict[2]}`;
  if (name === "경기 광주시") return "경기도 광주시";
  return `경기도 ${name}`;
}

function seedQueryFromHeader(seed: DaangnRegionSeed, header: string) {
  const name = seed.name.trim();
  if (header.includes("서울특별시")) return `서울특별시 ${name}`;
  if (header.includes("부산광역시")) return `부산광역시 ${name.replace(/^부산\s+/, "")}`;
  if (header.includes("인천광역시")) return `인천광역시 ${name.replace(/^인천\s+/, "")}`;
  if (header.includes("대구광역시")) return `대구광역시 ${name.replace(/^대구\s+/, "")}`;
  if (header.includes("대전광역시")) return `대전광역시 ${name.replace(/^대전\s+/, "")}`;
  if (header.includes("광주광역시")) return `광주광역시 ${name.replace(/^광주\s+/, "")}`;
  if (header.includes("울산광역시")) return `울산광역시 ${name.replace(/^울산\s+/, "")}`;
  if (header.includes("경기도")) return gyeonggiPath(name);
  return name;
}

function inlineCommentQuery(comment: string, name: string) {
  const clean = comment
    .replace(/—.*$/, "")
    .replace(/현\s+대구/g, "대구광역시")
    .replace(/[()]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  const shortGyeonggi: Record<string, string> = {
    여주: "경기도 여주시",
    연천: "경기도 연천군",
    가평: "경기도 가평군",
    양평: "경기도 양평군",
  };

  const base = shortGyeonggi[clean] ?? expandProvince(clean);
  return normalizePath(`${base} ${name}`);
}

function parseSeedQueries() {
  const source = readFileSync(path.resolve(__dirname, "../src/lib/daangn.ts"), "utf8");
  const queries = new Map<string, string>();
  let header = "";

  for (const line of source.split(/\r?\n/)) {
    const headerMatch = line.match(/\/\/\s*─+\s*(.+?)\s*─+/);
    if (headerMatch) {
      header = headerMatch[1];
      continue;
    }

    const seedMatch = line.match(/\{\s*id:\s*"(\d+)",\s*name:\s*"([^"]+)"\s*\}.*?(?:\/\/\s*(.*))?$/);
    if (!seedMatch) continue;

    const [, id, name, commentRaw] = seedMatch;
    if (regionParents[id]) {
      queries.set(id, regionParents[id]);
      continue;
    }

    const comment = commentRaw?.trim();
    queries.set(id, comment ? inlineCommentQuery(comment, name) : seedQueryFromHeader({ id, name }, header));
  }

  return queries;
}

async function kakaoSearch(query: string, apiKey: string) {
  const urls = [
    `${ADDRESS_URL}?query=${encodeURIComponent(query)}&size=1`,
    `${KEYWORD_URL}?query=${encodeURIComponent(query)}&size=1`,
  ];

  for (const url of urls) {
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) continue;
    const json = (await res.json().catch(() => ({}))) as KakaoAddressResponse;
    const doc = json.documents?.[0];
    if (!doc) continue;
    const lat = Number(doc.y);
    const lng = Number(doc.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const parts = doc.address ?? doc.road_address ?? null;
    const region1 = (parts?.region_1depth_name ?? doc.region_1depth_name ?? "").trim();
    const region2 = (parts?.region_2depth_name ?? doc.region_2depth_name ?? "").trim();
    const region3 = (parts?.region_3depth_h_name || parts?.region_3depth_name || doc.region_3depth_name || "").trim();
    const fullPath = normalizePath([region1, region2, region3].filter(Boolean).join(" ") || doc.address_name || query);
    return { fullPath, lat, lng };
  }

  return null;
}

async function main() {
  loadDotEnvLocal();
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    console.error("KAKAO_REST_API_KEY missing");
    process.exit(1);
  }

  let existing: Record<string, GeoEntry> = {};
  if (existsSync(OUT_PATH)) {
    existing = JSON.parse(readFileSync(OUT_PATH, "utf8")) as Record<string, GeoEntry>;
  }

  const queries = parseSeedQueries();
  for (const [id, fullPath] of Object.entries(regionParents)) {
    if (!queries.has(id)) queries.set(id, fullPath);
  }

  const namesById = new Map(DEFAULT_DAANGN_REGION_SEEDS.map((seed) => [seed.id, seed.name]));
  for (const [id, fullPath] of Object.entries(regionParents)) {
    if (!namesById.has(id)) namesById.set(id, fullPath.split(" ").pop() ?? id);
  }

  const output: Record<string, GeoEntry> = { ...existing };
  const entries = [...queries.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  let ok = 0;
  let failed = 0;

  for (const [id, query] of entries) {
    if (output[id]?.lat && output[id]?.lng) continue;
    const geo = await kakaoSearch(query, apiKey);
    if (!geo) {
      failed += 1;
      console.warn(`[miss] ${id} ${query}`);
    } else {
      output[id] = {
        id,
        name: namesById.get(id) ?? id,
        query,
        fullPath: geo.fullPath,
        lat: Number(geo.lat.toFixed(7)),
        lng: Number(geo.lng.toFixed(7)),
        source: regionParents[id] ? "daangn_parent" : "daangn_seed",
      };
      ok += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 90));
  }

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(`[daangn-region-geo] ok=${ok} failed=${failed} total=${Object.keys(output).length} out=${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
