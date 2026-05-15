import { readFile } from "node:fs/promises";
import { ruleMatch } from "@/lib/catalog";
async function main() {
  const samples = JSON.parse(await readFile("category-intelligence/galaxy_tab_s10_ultra_256_self/parse_ready_sample.json", "utf-8"));
  const rows = Array.isArray(samples) ? samples : (samples as { samples?: unknown[] }).samples ?? [];
  let t=0,n=0,b=0,nu=0,w=0;
  const bIds: Record<string,number>={};
  const fails: {n:string,d:string,r:string}[]=[];
  for (const row of rows as Array<{name?:string;description?:string}>) {
    t++; const r=ruleMatch(row.name??"",row.description??"");
    if (r?.laneKey==="galaxy_tab_s10_ultra_256_self") n++;
    else if (r?.laneKey) w++;
    else if (r) { b++; bIds[r.id]=(bIds[r.id]??0)+1; if(fails.length<8)fails.push({n:row.name??"",d:(row.description??"").slice(0,80),r:r.id}); }
    else { nu++; if(fails.length<10)fails.push({n:row.name??"",d:(row.description??"").slice(0,80),r:"null"}); }
  }
  console.log(`Total: ${t}, narrow: ${n}(${(n/t*100).toFixed(1)}%), wrong: ${w}, broad: ${b}, null: ${nu}`);
  console.log(`Broad:`); for (const [id,c] of Object.entries(bIds).sort((a,b)=>b[1]-a[1])) console.log(`  ${c}: ${id}`);
  console.log(`Fails:`); for (const f of fails) console.log(`  → ${f.r}: ${f.n} | ${f.d}`);
}
main().catch(e=>{console.error(e);process.exit(1);});
