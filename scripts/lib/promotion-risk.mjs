export const CORE_RUNTIME_SKU_IDS = new Set([
  "airpods-max",
  "beats-solo4",
  "bose-qc45",
  "bose-qc-ultra-headphones",
  "sony-wh-1000xm3",
  "sony-wh-1000xm4",
  "sony-wh-1000xm5",
  "sony-wh-1000xm6",
  "sony-wh-ch520",
  "sony-wh-ch720n",
  "sony-wh-ult900n",
]);

export function promotionRiskFlags(sku) {
  const text = `${sku.modelName ?? ""} ${(sku.aliases ?? []).join(" ")}`.toLowerCase();
  const riskFlags = [];

  if (CORE_RUNTIME_SKU_IDS.has(sku.id)) {
    riskFlags.push("runtime_core_sku_duplicate");
  }

  if (sku.category === "smartwatch") {
    const sizes = new Set([...text.matchAll(/\b(40|41|42|43|44|45|46|47|49)\s*mm\b/g)].map((match) => match[1]));
    if (sizes.size > 1) riskFlags.push("smartwatch_size_mixed");

    const isAppleWatchSe = /(?:애플\s*워치|애플워치|apple\s*watch|applewatch)/.test(text) && /\bse\b|에스이/.test(text);
    const hasSeGeneration = /(?:\bse\s*[123]\b|\bse\s*(?:1|2|3)\s*세대\b|se\s*(?:1st|2nd|3rd)|(?:1|2|3)\s*세대|(?:1st|2nd|3rd))/.test(text);
    if (isAppleWatchSe && !hasSeGeneration) riskFlags.push("applewatch_se_generation_missing");
  }

  if (sku.sourceCategory === "headphone_discovered") {
    const isAirpodsMax = /(?:airpods?\s*max|에어팟\s*맥스|에어팟맥스)/.test(text);
    const hasAmbiguousAirpodsMaxGeneration = /(?:1st\s*or\s*2nd|1\s*세대\s*(?:\/|또는|or)\s*2\s*세대|1세대.*2세대|1st.*2nd)/.test(text);
    if (isAirpodsMax && hasAmbiguousAirpodsMaxGeneration) {
      riskFlags.push("airpods_max_generation_ambiguous");
    }

    const headphoneModelKeys = new Set(
      [...text.matchAll(/\b(airpods?\s*max|wh[-\s]?(?:1000xm[3-6]|ch520|ch720n|ult900n)|qc\s*ultra|qc45|beats\s*solo\s*4)\b/g)]
        .map((match) => match[1].replace(/\s+/g, "-"))
    );
    if (headphoneModelKeys.size > 1) riskFlags.push("headphone_model_mixed");
  }

  if (sku.sourceCategory === "earphone_discovered") {
    const isAirpodsPro2 = /(?:airpods?\s*pro\s*2|에어팟\s*프로\s*2|에어팟프로2|프로2)/.test(text);
    const hasUsbC = /(?:usb-c|usbc|c타입|타입c|씨타입|타입씨)/.test(text);
    const hasLightning = /(?:lightning|라이트닝|8핀)/.test(text);
    if (isAirpodsPro2 && (hasUsbC || hasLightning)) {
      riskFlags.push("runtime_core_model_duplicate");
    }
    if (isAirpodsPro2 && !hasUsbC && !hasLightning) {
      riskFlags.push("airpods_pro2_connector_missing");
    }
  }

  if (/부품용|락걸림|잠김|분실|도난|고장|불량/.test(text)) {
    riskFlags.push("sku_alias_contains_listing_risk");
  }

  return [...new Set(riskFlags)];
}

export function promotionNoiseRiskFlags(rule, category) {
  const keyword = String(rule.keyword ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const riskFlags = [];

  if (category === "earphone_discovered" && rule.type === "parts" && ["유닛", "단품"].includes(keyword)) {
    riskFlags.push("context_dependent_earphone_part_keyword");
  }

  return [...new Set(riskFlags)];
}
