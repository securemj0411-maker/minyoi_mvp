import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("easy mode distinguishes velocity analysis loading from sparse velocity samples", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /type BeginnerGuideStepContext = \{/);
  assert.match(modal, /analysisLoading\?: boolean/);
  assert.match(modal, /Boolean\(context\.analysisLoading\)/);
  assert.match(modal, /activeAnalysisLoading/);
  assert.match(modal, /analysisLoading=\{activeAnalysisLoading\}/);
  assert.match(modal, /analysisLoading=\{idx === 0 \? activeAnalysisLoading : false\}/);
  assert.match(modal, /saleSpeedDisplay\(card, \{ analysisLoading \}\)/);
  assert.match(modal, /비교 기록 불러오는 중/);
  assert.match(modal, /비교 기준을 불러오는 중이에요/);
  assert.match(modal, /같은 모델과 같은 상태의 비교 매물을 가져오는 중이에요/);
  assert.match(modal, /setAnalysisLoadingPids/);
  assert.match(modal, /거래 기록 데이터를 받는 중이에요/);
  assert.match(modal, /분석 진행 중/);
  assert.match(modal, /확인 중/);
  assert.match(modal, /로딩이 끝난 뒤에도 표본이 부족한 경우에만 부족하다고 표시합니다/);
});
