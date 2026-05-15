import { ruleMatch, normalize } from "@/lib/catalog";
const title = "S23울트라 256G 크림";
console.log("input:", title);
console.log("normalize:", JSON.stringify(normalize(title)));
console.log("ruleMatch result:", ruleMatch(title)?.id ?? "null");
console.log("---");
// 변형 시도
const variants = [
  "갤럭시 S23 울트라 256GB",  // brand 명시
  "갤럭시 S23 울트라 256",
  "갤럭시 S23울트라 256G",
  "갤럭시 s23 울트라 256g 크림",  // already normalized form
  "S23 ultra 256",
];
for (const v of variants) console.log(`"${v}" → ${ruleMatch(v)?.id ?? "null"}`);
