import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("global help button opens FAQ with grade, market, risk, and feedback guidance", () => {
  const layout = source("src/app/layout.tsx");
  const help = source("src/components/site-help-faq.tsx");

  assert.match(layout, /import SiteHelpFaq/);
  assert.match(layout, /<SiteHelpFaq \/>/);
  assert.match(help, /function HeadsetIcon/);
  assert.match(help, /aria-label="AI 도움말 열기"/);
  assert.match(help, /fixed bottom-4 right-4/);
  assert.match(help, /AI 도움말/);
  assert.match(help, /질문을 고르면 바로 답해드릴게요/);
  assert.match(help, /답변 준비 중/);
  assert.match(help, /자주 묻는 질문/);
  assert.match(help, /S급과 A급은 뭐가 다른가요/);
  assert.match(help, /미개봉이 S급인가요/);
  assert.match(help, /등급은 어떤 기준으로 분류하나요/);
  assert.match(help, /시세 정확도는 어느 정도인가요/);
  assert.match(help, /손해볼 가능성은 없나요/);
  assert.match(help, /사용감이 있는데 시세는 어떻게 맞추나요/);
  assert.match(help, /상품이 사라지거나 판매완료되면 어떻게 되나요/);
  assert.match(help, /정보가 틀리면 어떻게 알려주나요/);
  assert.match(help, /고객센터 및 피드백/);
  assert.match(help, /운영자가 확인합니다/);
  assert.match(help, /토큰 3개/);
  assert.match(help, /1인당 피드백 횟수 제한은 없습니다/);
  assert.match(help, /href="\/me#my-reveals-list"/);
});
