// 어떤 NORMALIZATIONS rule이 256을 분리하는지 step-by-step 출력
const NORMALIZATIONS: [RegExp, string][] = [
  [/usb[\s\-_]*c/gi, " usbc "],
  [/c[\s\-_]*type/gi, " usbc "],
  [/c\s*타입|타입\s*c|씨\s*타입|타입\s*씨/gi, " usbc "],
  [/1\s*세대|일\s*세대|first|1st/gi, " 1세대 "],
  [/2\s*세대|이\s*세대|second|2nd/gi, " 2세대 "],
  [/3\s*세대|삼\s*세대|third|3rd/gi, " 3세대 "],
  [/4\s*세대|사\s*세대|fourth|4th/gi, " 4세대 "],
  [/프로\s*2(?!\d)/gi, " 프로 프로2 2세대 "],
  [/프로\s*1(?!\d)/gi, " 프로 프로1 1세대 "],
  [/\bpro\s*2\b/gi, " pro pro2 2세대 "],
  [/\bpro\s*1\b/gi, " pro pro1 1세대 "],
  [/에어팟\s*([234])/g, " 에어팟 $1세대 "],
  [/에어팟프로\s*([123])/g, " 에어팟 프로$1 "],
  [/애어팟/g, " 에어팟 "],
  [/울트라\s*2/gi, " 울트라 2 "],
  [/ultra\s*2/gi, " ultra 2 "],
  [/se\s*([123])/gi, " se$1 "],
  [/시리즈\s*([0-9]+)/g, " 시리즈 $1 "],
  [/series\s*([0-9]+)/gi, " series $1 "],
  [/애플\s*워치/g, " 애플워치 "],
  [/갤럭시\s*워치/g, " 갤럭시워치 "],
  [/아이\s*패드/g, " 아이패드 "],
  [/아이패드\s*(프로|에어|미니)/g, " 아이패드 $1 "],
  [/갤럭시\s*탭/g, " 갤럭시탭 "],
  [/갤\s*탭/g, " 갤탭 "],
  [/air\s*pods/gi, " airpods "],
];

let t = "갤럭시 s23 울트라 256기가 자급제".toLowerCase();
console.log(`초기: "${t}"`);
for (let i = 0; i < NORMALIZATIONS.length; i++) {
  const [pat, repl] = NORMALIZATIONS[i];
  const prev = t;
  t = t.replace(pat, repl);
  if (t !== prev) {
    console.log(`Rule ${i} (${pat}) 적용:`);
    console.log(`  "${prev}" → "${t}"`);
  }
}
