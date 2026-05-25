import { strict as assert } from "node:assert";
import { test } from "node:test";

import { ruleMatch } from "../src/lib/catalog";

test("PS5 disc console body listings beat game-disc broad fallback", () => {
  assert.equal(
    ruleMatch("초기형 ps5 디스크 중고 팝니다")?.id,
    "ps5-disc-standard",
  );
  assert.equal(
    ruleMatch("[A급] 플스5 PS5 디스크 1118A 풀박스")?.id,
    "ps5-disc-standard",
  );
  assert.equal(
    ruleMatch("ps5 디스크 드라이브 가격"),
    null,
  );
  assert.notEqual(
    ruleMatch("ps5 스파이더맨 디스크 팝니다")?.id,
    "ps5-disc-standard",
  );
});

test("game title SKUs reject character goods and printed merch", () => {
  assert.equal(ruleMatch("포켓몬센터 포코피아 한정판 잡지"), null);
  assert.equal(ruleMatch("포코피아 장패드 데스크 매트 포코 아 포켓몬"), null);
  assert.equal(ruleMatch("포켓몬 이치방쿠지 Lets Go for a Walk I상 핸드타월"), null);
  assert.equal(
    ruleMatch("닌텐도 스위치 포켓몬스터 레츠고 피카츄")?.id,
    "switch-game-pokemon-letsgo",
  );
});

test("console body SKUs reject uncovered game titles and drive-only accessories", () => {
  assert.equal(
    ruleMatch("새 상품 미 개봉 닌텐도 스위치 호그와트 레거시를 분양합니다."),
    null,
  );
  assert.equal(
    ruleMatch("PS5 플레이스테이션5 슬림 디스크 드라이브 팝니다"),
    null,
  );
  assert.equal(
    ruleMatch("플스5 슬림 디스크 버전 풀박스")?.id,
    "ps5-slim-disc",
  );
});
