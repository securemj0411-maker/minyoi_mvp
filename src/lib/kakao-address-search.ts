// Wave 886.4 (2026-05-27): Kakao Local 주소 검색 API.
//   docs: https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword
//   사용: 사용자가 "상도동", "서울 동작구" 등 검색 → 후보 주소 + 좌표 반환.
//   user 선택 → 기존 GPS 경로 (reverseGeocode + matchDaangnRegionByPath) 재사용.

type KakaoRegionParts = {
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string;
  region_3depth_h_name?: string;
};

type KakaoAddressDoc = {
  address_name: string;  // "서울 동작구 상도동"
  address?: KakaoRegionParts | null;
  road_address?: KakaoRegionParts | null;
  // 일부 응답은 top-level에도 region depth 가 있을 수 있음 (keyword API).
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string;
  x: string;  // longitude
  y: string;  // latitude
};

type KakaoAddressResponse = {
  documents?: KakaoAddressDoc[];
  meta?: { total_count: number; pageable_count: number };
};

export type AddressSearchResult = {
  fullPath: string;
  region1: string;
  region2: string;
  region3: string;
  lat: number;
  lng: number;
};

const KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json";

export async function searchAddress(query: string, limit: number = 15): Promise<{ ok: boolean; results: AddressSearchResult[]; error?: string }> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) return { ok: false, results: [], error: "KAKAO_REST_API_KEY missing" };
  const q = query.trim();
  if (!q) return { ok: true, results: [] };

  try {
    // 1) Address API first (full or partial address — e.g. "상도동", "서울 동작구")
    const addrRes = await fetch(`${KAKAO_ADDRESS_URL}?query=${encodeURIComponent(q)}&size=${Math.min(limit, 30)}`, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });
    const addrJson = (await addrRes.json().catch(() => ({}))) as KakaoAddressResponse;
    let docs = addrJson.documents ?? [];

    // 2) If no results, fallback to keyword API — handles dong names without 시/구 prefix
    if (docs.length === 0) {
      const kwRes = await fetch(`${KAKAO_KEYWORD_URL}?query=${encodeURIComponent(q)}&size=${Math.min(limit, 15)}&category_group_code=AT4`, {
        headers: { Authorization: `KakaoAK ${apiKey}` },
      });
      const kwJson = (await kwRes.json().catch(() => ({}))) as KakaoAddressResponse;
      docs = kwJson.documents ?? [];
    }

    const seen = new Set<string>();
    const out: AddressSearchResult[] = [];
    for (const d of docs) {
      const lat = Number(d.y);
      const lng = Number(d.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      // Kakao 응답: region depth는 address (지번주소) 또는 road_address (도로명) 하위에 있음.
      // keyword API 는 top-level 에 있기도 함. 다 fallback.
      const parts = d.address ?? d.road_address ?? null;
      const region1 = (parts?.region_1depth_name ?? d.region_1depth_name ?? "").trim();
      const region2 = (parts?.region_2depth_name ?? d.region_2depth_name ?? "").trim();
      const region3 = (parts?.region_3depth_h_name || parts?.region_3depth_name || d.region_3depth_name || "").trim();
      const fullPath = [region1, region2, region3].filter(Boolean).join(" ") || (d.address_name ?? "").trim();
      if (!fullPath) continue;
      // dedupe by fullPath (Kakao 가끔 같은 동에 여러 lot/road address 반환)
      if (seen.has(fullPath)) continue;
      seen.add(fullPath);
      out.push({ fullPath, region1, region2, region3, lat, lng });
      if (out.length >= limit) break;
    }
    return { ok: true, results: out };
  } catch (err) {
    return { ok: false, results: [], error: String(err) };
  }
}
