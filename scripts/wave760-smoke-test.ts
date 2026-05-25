import { classifyListing } from "@/lib/pipeline";
import { ruleMatch } from "@/lib/catalog";
import { parseGameConsoleListing } from "@/lib/game-console-parser";

const tests: Array<[string, string, number]> = [
  ["닌텐도 스위치 포켓몬 브릴리언트 다이아몬드", "", 25000],
  ["닌텐도 스위치 포켓몬스터 소드", "", 46000],
  ["닌텐도 스위치 마리오카트8 디럭스 칩", "", 47000],
  ["닌텐도 스위치 마리오 오디세이", "", 41000],
  ["젤다의 전설 티어스 오브 더 킹덤", "", 52000],
  ["마인크래프트 스위치판", "", 30000],
  ["포켓몬스터 하트골드 일판", "", 130000],
  ["포켓몬스터 디아루가 닌텐도 칩", "", 59000],
  ["스위치2 마리오카트월드 칩", "", 75000],
  ["듀얼센스 정품 팝니다", "", 70000],
  ["아미보 카드 일괄", "", 12000],
  ["닌텐도 스위치 본체 풀박스", "", 350000],
  ["모여봐요 동물의 숲", "", 46000],
  ["스플래툰 3 정품 한글판", "", 40000],
  ["커비 디스커버리 미개봉", "", 60000],
  ["링피트 어드벤처", "", 40000],
  // 본체 SKU 와 충돌 안 나야 함
  ["닌텐도 스위치 OLED 본체 풀박", "", 320000],
  ["PS5 디스크 에디션 본체", "", 600000],
];

for (const [title, desc, price] of tests) {
  const cls = classifyListing(title, desc, price);
  const rm = ruleMatch(title, desc);
  const sku = cls.sku?.id ?? "NULL";
  const rmsku = rm?.id ?? "NULL";
  const parsed = rm?.category === "game_console" ? parseGameConsoleListing(title, desc, price).listingType : "-";
  console.log(`[${cls.listingType.padEnd(10)}] cls=${sku.padEnd(40)} rm=${rmsku.padEnd(40)} parser=${parsed} ← ${title}`);
}
