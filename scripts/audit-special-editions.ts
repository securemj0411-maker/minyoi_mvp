import { ruleMatch } from "../src/lib/catalog";

const tests: { name: string; expected: string | null; reason: string }[] = [
  // ===== 한정판 / 콜라보 / 스페셜에디션 =====
  { name: "비츠 솔로4 Jennie 한정판", expected: "beats-solo4", reason: "한정판도 본품 매칭" },
  { name: "에어팟 프로 2 한정 케이스 미개봉", expected: null, reason: "케이스 단품 reject" },
  { name: "샤넬 에어팟 프로 케이스", expected: null, reason: "샤넬 케이스 단품 reject" },
  { name: "아이폰 15 프로 256 자급제 한정판 화이트", expected: "iphone-15-pro-256-self", reason: "본품 한정판 OK" },

  // ===== 고급 모델 vs 일반 =====
  { name: "아이폰 16 프로 256 자급제", expected: "iphone-16-pro-256-self", reason: "Pro 256 self" },
  { name: "아이폰 16 256", expected: "iphone-16", reason: "일반 16 broad" },
  { name: "아이폰 16 일반 256", expected: "iphone-16", reason: "일반 명시 broad" },
  { name: "갤럭시 S25 256", expected: "galaxy-s25", reason: "일반 broad" },
  { name: "갤럭시 S25 울트라 256", expected: "galaxy-s25-ultra", reason: "Ultra broad" },

  // ===== iPad 13인치 vs 11인치 (고급) =====
  { name: "아이패드 프로 11 M4 256 와이파이", expected: "ipad-pro-11-m4-256-wifi", reason: "11인치 M4 wifi" },
  { name: "아이패드 프로 13 M4 256 와이파이", expected: "ipad-pro-13-m4-256-wifi", reason: "13인치 M4 wifi" },
  { name: "아이패드 프로 12.9 M4 256 와이파이", expected: "ipad-pro-13-m4-256-wifi", reason: "12.9=13 동일 모델?" },

  // ===== Apple Watch 세대 / mm 격리 =====
  { name: "애플워치 울트라 2 49mm", expected: "applewatch-ultra2", reason: "Ultra 2" },
  { name: "애플워치 울트라 49mm", expected: "applewatch-ultra", reason: "Ultra (1세대)" },
  { name: "애플워치 SE 3 40mm", expected: "applewatch-se3", reason: "SE 3" },
  { name: "애플워치 SE 2 40mm", expected: "applewatch-se2", reason: "SE 2" },
  { name: "애플워치 시리즈 10 42mm", expected: "applewatch-series10", reason: "Series 10" },
  { name: "애플워치 시리즈 9 41mm", expected: "applewatch-series9", reason: "Series 9" },

  // ===== AirPods 세대 / 커넥터 =====
  { name: "에어팟 프로 2 라이트닝", expected: "airpods-pro-2-lightning", reason: "Pro 2 Lightning" },
  { name: "에어팟 프로 2 USB-C", expected: "airpods-pro-2-usbc", reason: "Pro 2 USB-C" },
  { name: "에어팟 프로 3", expected: "airpods-pro-3", reason: "Pro 3 (USB-C only)" },
  { name: "에어팟 4 ANC", expected: "airpods-4-anc", reason: "AirPods 4 with ANC" },
  { name: "에어팟 4", expected: "airpods-4", reason: "AirPods 4 base" },
  { name: "에어팟 맥스 USB-C", expected: "airpods-max-usbc", reason: "Max USB-C 신형" },
  { name: "에어팟 맥스 Lightning", expected: "airpods-max", reason: "Max Lightning 구형" },

  // ===== Galaxy 세대 격리 (S22/S23/S24/S25/S26 cross-check) =====
  { name: "갤럭시 S22 256", expected: null, reason: "S22 catalog X" },
  { name: "갤럭시 S20 256", expected: null, reason: "S20 catalog X" },
  { name: "갤럭시 S26 256", expected: "galaxy-s26", reason: "S26 신상" },

  // ===== MacBook chip 세대 cross =====
  { name: "맥북 프로 14 m4 18 512", expected: "macbook-pro", reason: "M4 narrow X → broad" },
  { name: "맥북 프로 14 m2 16 512", expected: "macbook-pro", reason: "M2 14 narrow X → broad" },
  { name: "맥북 프로 14 m3 36 1TB", expected: "macbook-pro", reason: "36GB/1TB narrow X" },
];

let pass = 0, fail = 0;
const fails: string[] = [];
for (const t of tests) {
  const result = ruleMatch(t.name, "");
  const ok = (result?.id ?? null) === t.expected;
  if (ok) pass++;
  else {
    fail++;
    fails.push(`✗ "${t.name}" → ${result?.id ?? "null"} (expected ${t.expected ?? "null"}) — ${t.reason}`);
  }
}
console.log(`\n${pass}/${pass + fail} pass\n`);
if (fails.length > 0) {
  console.log("FAILURES:");
  for (const f of fails) console.log("  " + f);
}
