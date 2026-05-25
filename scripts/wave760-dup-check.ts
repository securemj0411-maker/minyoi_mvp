import { CATALOG } from "@/lib/catalog";
const ids = CATALOG.map(s => s.id);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
console.log("Total:", CATALOG.length, "Unique:", new Set(ids).size, "Dup:", new Set(dup).size);
for (const d of new Set(dup)) console.log("  DUP:", d);
