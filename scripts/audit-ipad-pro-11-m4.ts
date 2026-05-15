import { readFile } from "node:fs/promises";
import { ruleMatch } from "@/lib/catalog";
async function main() {
  const samples = JSON.parse(await readFile("category-intelligence/ipad_pro_11_m4_256_wifi/parse_ready_sample.json", "utf-8"));
  const rows = Array.isArray(samples) ? samples : (samples as { samples?: unknown[] }).samples ?? [];
  let total=0,narrow=0,broad=0,nullC=0,wrong=0;
  const broadIds: Record<string,number>={}, wrongIds: Record<string,number>={};
  const fails: {n:string,d:string,r:string}[]=[];
  for (const row of rows as Array<{name?:string;description?:string}>) {
    total++; const r=ruleMatch(row.name??"",row.description??"");
    if (r?.laneKey==="ipad_pro_11_m4_256_wifi") narrow++;
    else if (r?.laneKey) { wrong++; wrongIds[r.id]=(wrongIds[r.id]??0)+1; if(fails.length<6)fails.push({n:row.name??"",d:(row.description??"").slice(0,80),r:r.id}); }
    else if (r) { broad++; broadIds[r.id]=(broadIds[r.id]??0)+1; if(fails.length<6)fails.push({n:row.name??"",d:(row.description??"").slice(0,80),r:r.id}); }
    else { nullC++; if(fails.length<10)fails.push({n:row.name??"",d:(row.description??"").slice(0,80),r:"null"}); }
  }
  console.log(`Total: ${total}, target: ${narrow}(${(narrow/total*100).toFixed(1)}%), wrong narrow: ${wrong}, broad: ${broad}, null: ${nullC}`);
  console.log(`Wrong:`); for (const [id,c] of Object.entries(wrongIds).sort((a,b)=>b[1]-a[1])) console.log(`  ${c}: ${id}`);
  console.log(`Broad:`); for (const [id,c] of Object.entries(broadIds).sort((a,b)=>b[1]-a[1])) console.log(`  ${c}: ${id}`);
  console.log(`Fails:`); for (const f of fails) console.log(`  → ${f.r}: ${f.n} | ${f.d}`);
}
main().catch(e=>{console.error(e);process.exit(1);});
