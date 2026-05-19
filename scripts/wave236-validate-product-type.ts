// Wave 236 validate — parser v7 product-type 추출 패턴 in-memory simulate.
//   목적:
//     1. fashion 매물 5000+ 건 fetch
//     2. clothing/bag/shoe 별 product-type regex 적용
//     3. SKU defaultProductType fallback simulate (Wave 236d)
//     4. type_unknown 비율 (text 미명시 + catalog 미박힘) — pool 차단 비율
//     5. 같은 sku_id 내 product-type 분포 → 분리 효과 측정

import { CATALOG, type Sku } from "@/lib/catalog";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const SKU_BY_ID = new Map<string, Sku>(CATALOG.map((s) => [s.id, s]));

type Row = {
  pid: number;
  name: string;
  description_preview: string | null;
  sku_id: string | null;
};

// Wave 236b product-type extractors (parser v5 와 동일 패턴 simulate).
function parseClothingProductType(text: string): string {
  const t = text.toLowerCase();
  if (/패딩|다운 ?재킷|다운 ?자켓|down ?jacket|푸퍼|puffer|nano puff|nanopuff|구스다운|덕다운|눕시|nuptse|다운 ?베스트|다운 ?베어|다운 ?재킷|다운 ?파카|down ?parka/.test(t)) return "down_jacket";
  if (/코트(?!\s*디테일)|coat\b|trench|트렌치|체스터필드|chesterfield|피코트|peacoat|카코트|발마칸|balmacaan|울 ?코트/.test(t)) return "coat";
  if (/카디건|cardigan|니트 ?집업|knit ?zip/.test(t)) return "cardigan";
  if (/니트(?!\s*집업)|knit(?! ?zip)|스웨터|sweater|터틀넥|turtleneck|폴라넥|모크넥|mockneck|crewneck ?knit/.test(t)) return "knit";
  if (/조끼|베스트(?!\s*조끼)|vest\b|gilet/.test(t)) return "vest";
  if (/플리스|fleece|레트로 ?x|retro ?x|덴알리|denali|숄카라|숄 ?카라|shawl/.test(t)) return "jacket";
  if (/자켓|재킷|jacket|아노락|anorak|봄버|bomber|블레이저(?!\s*미드)|윈드 ?브레이커|windbreaker|바람막이|마운틴 ?라이트|mountain ?light|마운틴 ?파카|mountain ?parka|마운틴 ?자켓|mountain ?jacket|트랙 ?탑|track ?top|트랙수트|tracksuit|덱 ?자켓|deck ?jacket|쉴드|shield/.test(t)) return "jacket";
  if (/후드(?!\s*티 ?셔츠)|후디|hoodie|hooded sweat/.test(t)) return "hoodie";
  if (/맨투맨|크루넥|crewneck|sweatshirt|스웻 ?셔츠|스웻\(맨투맨\)|풀오버(?!\s*조끼)|스웻 ?셔트|sweat ?shirt/.test(t)) return "crewneck";
  if (/롱슬리브|long sleeve|롱 ?티|장 ?티|long sleeved/.test(t)) return "tee";
  if (/티 ?셔츠|tee\b|반팔 ?티|반팔티|t-shirt|tshirt|t ?셔츠|반팔(?!\s*티 ?셔츠)|탱크 ?탑|tank ?top|민소매|sleeveless|반 ?소매/.test(t)) return "tee";
  if (/폴로(?!\s*rrl|랄프)|polo shirt|폴로 ?티|피케 ?폴로|피케 ?셔츠|pique/.test(t)) return "polo_shirt";
  if (/셔츠(?!\s*ZIP)|shirt(?! sleeve)|남방|button ?up|버튼 ?다운|button ?down|옥스포드 ?셔츠|oxford ?shirt/.test(t)) return "shirt";
  if (/청바지|진(?:즈)?\b|jean(?:s)?\b|데님 ?팬츠|데님 ?진|denim ?jean|빈파포|빈티지 ?파이브 ?포켓|파이브 ?포켓|five ?pocket|5 ?포켓|5-pocket|기빈스|미드랜드|이스트웨스트|힐스뷰|에이버리|키팅진/.test(t)) return "jeans";
  if (/반바지|쇼츠|shorts\b|버뮤다|bermuda/.test(t)) return "shorts";
  if (/원피스|dress\b|드레스(?!\s*셔츠)|미니 ?원피스|롱 ?원피스/.test(t)) return "dress";
  if (/스커트|skirt/.test(t)) return "skirt";
  if (/팬츠|pants\b|바지(?!\s*받침)|trouser|치노|chino|슬랙스|slacks|조거|jogger|카고|cargo|트랙 ?팬츠|track ?pants|카펜터|carpenter|워크팬츠|workwear ?pants/.test(t)) return "pants";
  if (/볼캡|ball ?cap|야구모자|버킷햇|bucket hat|벙거지|비니|beanie|메쉬캡|메쉬 ?캡|트러커 ?캡|trucker cap|cap\b|모자\b|스냅백|snapback/.test(t)) return "cap";
  if (/벨트|belt\b/.test(t)) return "belt";
  if (/지갑|wallet|반지갑|장지갑|카드지갑|머니 ?클립|콘초 ?월렛|콘초 ?지갑/.test(t)) return "wallet";
  return "type_unknown";
}

function parseBagProductType(text: string): string {
  const t = text.toLowerCase();
  if (/카드지갑|반지갑|머니 ?클립|card ?holder|card ?case|카드 ?케이스|콘초 ?지갑/.test(t)) return "card_holder";
  if (/장지갑|long wallet|월렛|지갑(?!\s*케이스)|wallet\b|포켓 ?오거나이저|pocket ?organizer|콘초 ?월렛/.test(t)) return "wallet";
  if (/파우치|pouch|미니 ?파우치|cosmetic|화장품 ?파우치|포쉐트|pochette/.test(t)) return "pouch";
  if (/클러치|clutch/.test(t)) return "clutch";
  if (/메신저|messenger/.test(t)) return "messenger";
  if (/더플|duffle|duffel|보스턴 ?백|boston ?bag|여행 ?가방|트래블/.test(t)) return "duffle";
  if (/웨이스트|허리|힙색|waist ?bag|fanny ?pack|벨트 ?백|fanny|슬링 ?백|sling ?bag|sling\b|보레알리스 ?슬링|borealis ?sling/.test(t)) return "waist";
  if (/숄더|shoulder ?bag(?!\s*backpack)|어깨 ?가방|호보 ?백|hobo ?bag|hobo\b|버킷 ?백|bucket ?bag|체인 ?백|chain ?bag|chain ?미니/.test(t)) return "shoulder";
  if (/크로스(?!\s*?백 ?팩)|crossbody|cross ?bag|크로스 ?백(?!팩)|카메라 ?백|camera ?bag|사이드 ?백|side ?bag/.test(t)) return "crossbody";
  if (/토트|tote\b|쇼퍼|shopper|탑 ?핸들|top ?handle|핸드 ?백|handbag/.test(t)) return "tote";
  if (/백팩|backpack|배낭|knapsack|빅샷|big ?shot|보레알리스|borealis(?!\s*sling)|핫샷|hot ?shot/.test(t)) return "backpack";
  return "type_unknown";
}

function parseShoeProductType(text: string): string {
  const t = text.toLowerCase();
  if (/부츠|boot\b|첼시|chelsea|앵클 ?부츠|ankle ?boot|컴뱃|combat ?boot|콤뱃/.test(t)) return "boot";
  if (/샌들|sandal|쪼리/.test(t)) return "sandal";
  if (/로퍼|loafer|페니|penny/.test(t)) return "loafer";
  if (/슬리퍼|slipper|뮬\b|mule\b|에스파드류|espadrille|크록스|clog/.test(t)) return "slipper";
  if (/스니커즈|sneaker|운동화|단화\b|러닝화|러닝 ?화|블레이저|blazer|에어맥스|airmax|에어포스|airforce|덩크|dunk|조던|jordan|올드스쿨|sk8|에라\b|어센틱|슬립온|체커보드/.test(t)) return "sneaker";
  return "type_unknown";
}

async function fetchByPrefix(prefix: string, limit: number): Promise<Row[]> {
  const all: Row[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (all.length < limit) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,description_preview,sku_id&sku_id=like.${prefix}-%25&listing_state=eq.active&order=pid.desc&limit=${PAGE}&offset=${offset}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    if (!res.ok) break;
    const rows = (await res.json()) as Row[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all.slice(0, limit);
}

function analyze(category: string, rows: Row[], extractor: (text: string) => string) {
  console.log(`\n=== ${category} — ${rows.length} 매물 ===`);
  const typeCount = new Map<string, number>();
  const typeBySku = new Map<string, Map<string, number>>();
  const unknownSamples: Array<{ pid: number; name: string; skuId: string | null }> = [];
  let fromTextCount = 0;
  let fromCatalogCount = 0;
  let fromShoeDefaultCount = 0;
  let blockedCount = 0;

  for (const row of rows) {
    const text = `${row.name ?? ""}\n${row.description_preview ?? ""}`;
    let pt = extractor(text);
    let source = "text";

    if (pt === "type_unknown") {
      // Wave 236d: catalog defaultProductType fallback simulate.
      const sku = row.sku_id ? SKU_BY_ID.get(row.sku_id) : null;
      if (sku?.defaultProductType) {
        pt = sku.defaultProductType;
        source = "catalog";
        fromCatalogCount += 1;
      } else if (category === "shoe" && row.sku_id) {
        // Wave 236e: shoe + SKU 매칭 자체 = sneaker default (parser 룰 simulate).
        pt = "sneaker";
        source = "shoe-default";
        fromShoeDefaultCount += 1;
      } else {
        source = "blocked";
        blockedCount += 1;
      }
    } else {
      fromTextCount += 1;
    }

    typeCount.set(pt, (typeCount.get(pt) ?? 0) + 1);

    if (row.sku_id) {
      const skuTypes = typeBySku.get(row.sku_id) ?? new Map<string, number>();
      skuTypes.set(pt, (skuTypes.get(pt) ?? 0) + 1);
      typeBySku.set(row.sku_id, skuTypes);
    }

    if (pt === "type_unknown" && unknownSamples.length < 30) {
      unknownSamples.push({ pid: row.pid, name: row.name, skuId: row.sku_id });
    }
  }

  console.log(`\nproduct-type 분포:`);
  console.log(`  text 추출 성공: ${fromTextCount} (${((fromTextCount / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  catalog default fallback: ${fromCatalogCount} (${((fromCatalogCount / rows.length) * 100).toFixed(1)}%)`);
  if (fromShoeDefaultCount > 0) {
    console.log(`  shoe sneaker default (parser 룰): ${fromShoeDefaultCount} (${((fromShoeDefaultCount / rows.length) * 100).toFixed(1)}%)`);
  }
  console.log(`  pool 차단 (type_unknown): ${blockedCount} (${((blockedCount / rows.length) * 100).toFixed(1)}%)`);

  console.log(`\nproduct-type 최종 분포 (시세 daily 분리 결과):`);
  const sortedTypes = [...typeCount.entries()].sort((a, b) => b[1] - a[1]);
  for (const [pt, n] of sortedTypes) {
    const pct = ((n / rows.length) * 100).toFixed(1);
    console.log(`  ${pt}: ${n} (${pct}%)`);
  }

  console.log(`\n같은 SKU 내 다양한 product-type (top 15) — 분리 효과 측정:`);
  const skuTypeVariety = [...typeBySku.entries()]
    .filter(([_, types]) => types.size >= 3)
    .map(([sku, types]) => ({ sku, n: [...types.values()].reduce((a, b) => a + b, 0), types: types.size, dist: [...types.entries()].sort((a, b) => b[1] - a[1]) }))
    .sort((a, b) => b.types - a.types)
    .slice(0, 15);
  for (const { sku, n, types, dist } of skuTypeVariety) {
    const distStr = dist.slice(0, 5).map(([t, c]) => `${t}:${c}`).join(", ");
    console.log(`  ${sku} (n=${n}, ${types} types): ${distStr}`);
  }

  console.log(`\ntype_unknown sample 30건 (text 미명시 + catalog 미박힘 → 차단 후보):`);
  for (const s of unknownSamples) {
    console.log(`  pid ${s.pid} [${s.skuId ?? "no-sku"}]: ${s.name.slice(0, 80)}`);
  }
}

async function main() {
  console.log("fetching fashion samples...");
  const [clothing, bag, shoe] = await Promise.all([
    fetchByPrefix("clothing", 3000),
    fetchByPrefix("bag", 2000),
    fetchByPrefix("shoe", 3000),
  ]);

  analyze("clothing", clothing, parseClothingProductType);
  analyze("bag", bag, parseBagProductType);
  analyze("shoe", shoe, parseShoeProductType);
}

main().catch((err) => { console.error(err); process.exit(1); });
