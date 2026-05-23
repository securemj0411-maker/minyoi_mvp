// 최소 test — 번개장터 API 1 query만
import { searchPage } from "@/lib/bunjang";

async function test() {
  console.error("START: test bunjang searchPage");
  const tStart = Date.now();
  try {
    const items = await searchPage("골프 드라이버", 0, { order: "score", limit: 30 });
    const elapsed = Date.now() - tStart;
    console.error(`DONE: ${items.length} items in ${elapsed}ms`);
    console.error("First 3:");
    items.slice(0, 3).forEach((i) => console.error(`  ${i.pid} | ${i.price} | ${i.name}`));
  } catch (e) {
    console.error(`ERROR: ${(e as Error).message}`);
    console.error((e as Error).stack);
  }
}

test();
