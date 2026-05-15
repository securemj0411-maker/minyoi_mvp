// Wave 114 precision audit: 세대/옵션/모델명/스페셜에디션 격리 정확성 검증
import { ruleMatch } from "../src/lib/catalog";

const tests: { name: string; desc?: string; expected: string | null; reason: string }[] = [
  // ===== iPhone Pro 256 self FALSE POSITIVE 검증 =====
  { name: "아이폰16프로", expected: "iphone-16-pro", reason: "자급제/256 명시 X → broad만" },
  { name: "아이폰16프로 256", expected: "iphone-16-pro", reason: "자급제 명시 X → broad" },
  { name: "아이폰16프로 자급제", expected: "iphone-16-pro", reason: "256 명시 X → broad" },
  { name: "아이폰16프로 256 자급제", expected: "iphone-16-pro-256-self", reason: "둘 다 명시 → narrow" },
  { name: "아이폰 16 프로 128 자급제", expected: "iphone-16-pro-128-self", reason: "128 명시 → narrow 128" },

  // ===== 세대 격리 =====
  { name: "아이폰 15 프로 256 자급제", expected: "iphone-15-pro-256-self", reason: "15 Pro" },
  { name: "아이폰 14 프로 256 자급제", expected: "iphone-14-pro-256-self", reason: "14 Pro" },
  { name: "아이폰 13 프로 256 자급제", expected: null, reason: "13 Pro 256 self는 catalog X" },

  // ===== Pro vs Pro Max =====
  { name: "아이폰 15 프로맥스 256 자급제", expected: "iphone-15-pro-max-256-self", reason: "Pro Max" },
  { name: "아이폰 15 프로 맥스 256 자급제", expected: "iphone-15-pro-max-256-self", reason: "Pro Max 공백" },
  { name: "아이폰 16 프로맥스 256 자급제", expected: "iphone-16-pro-max-256-self", reason: "16 Pro Max" },

  // ===== Galaxy S25 Edge vs 일반/FE/Ultra =====
  { name: "갤럭시 S25 256", expected: "galaxy-s25", reason: "일반 S25" },
  { name: "갤럭시s25엣지 512gb 자급제", expected: "galaxy-s25-edge", reason: "S25 Edge" },
  { name: "갤럭시 S25 엣지 512 자급제", expected: "galaxy-s25-edge", reason: "S25 Edge 공백" },
  { name: "갤럭시 S25 FE 256", expected: "galaxy-s25-fe", reason: "S25 FE" },
  { name: "갤럭시 S25 울트라 256 자급제", expected: "galaxy-s25-ultra-256-self", reason: "S25 Ultra" },
  { name: "갤럭시 S25 플러스 256", expected: "galaxy-s25-plus", reason: "S25 Plus" },

  // ===== Galaxy S26 신상 =====
  { name: "갤럭시 S26 256", expected: "galaxy-s26", reason: "S26 broad" },
  { name: "갤럭시 S26 울트라 512", expected: "galaxy-s26-ultra", reason: "S26 Ultra" },
  { name: "갤럭시 S26 플러스 256", expected: "galaxy-s26-plus", reason: "S26 Plus" },

  // ===== Galaxy FE 세대 =====
  { name: "갤럭시S23FE 256", expected: "galaxy-s23-fe", reason: "S23 FE" },
  { name: "갤럭시S24FE 256", expected: "galaxy-s24-fe", reason: "S24 FE" },

  // ===== MacBook chip 세대 격리 =====
  { name: "맥북에어 13 m3 256", expected: "macbook-air-m3-13-256", reason: "M3 narrow" },
  { name: "맥북에어 13 m4 256", expected: "macbook-air", reason: "M4는 narrow X → broad" },
  { name: "맥북에어 13 m2 256", expected: "macbook-air-m2-13-256", reason: "M2 narrow" },
  { name: "맥북에어 13 m1 256", expected: "macbook-air", reason: "M1 narrow X" },
  { name: "맥북에어 15 m3 256", expected: "macbook-air", reason: "15인치는 narrow X" },
  { name: "맥북프로 14 m3 18 512", expected: "macbook-pro-14-m3-18-512", reason: "narrow" },
  { name: "맥북프로 16 m3 18 512", expected: "macbook-pro", reason: "16인치는 narrow X" },

  // ===== iPad Pro/Air 인치/세대 격리 =====
  { name: "아이패드 프로 11 M4 256 와이파이", expected: "ipad-pro-11-m4-256-wifi", reason: "11/M4/256" },
  { name: "아이패드 프로 13 M4 256 와이파이", expected: "ipad-pro-13-m4-256-wifi", reason: "13/M4/256" },
  { name: "아이패드 프로 11 M2 256 와이파이", expected: "ipad-pro-11-m2-256-wifi", reason: "11/M2/256" },
  { name: "아이패드 프로 13 M4 256 셀룰러", expected: "ipad-pro", reason: "Cellular narrow X" },
  { name: "아이패드 에어 11 M2 256 와이파이", expected: "ipad-air-m2-11-256-wifi", reason: "11/M2/256 Air" },
  { name: "아이패드 에어 13 M2 256 와이파이", expected: "ipad-air", reason: "13인치 Air narrow X" },

  // ===== 자급제 negative — 통신사 명시 reject =====
  { name: "아이폰 16 프로 256 자급제 KT 약정", expected: null, reason: "통신사 reject" },
  { name: "갤럭시 S23 256 자급제 SKT 완납", expected: null, reason: "통신사 reject" },
  { name: "맥북에어 13 M3 256 부품용", expected: null, reason: "부품용 reject" },
  { name: "맥북에어 13 M3 256 대여", expected: null, reason: "대여 reject (Wave 113)" },
];

let pass = 0, fail = 0;
const fails: string[] = [];
for (const t of tests) {
  const result = ruleMatch(t.name, t.desc ?? "");
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
