// Wave 773 (2026-05-27): Kakao Local API reverse geocoding (위/경도 → 행정구역).
//   docs: https://developers.kakao.com/docs/latest/ko/local/dev-guide#address-coord-to-region
//   사용: server-side만 (REST API key 보호).
//
// 응답 예시:
//   { documents: [{ region_type: "B", region_1depth_name: "서울특별시", region_2depth_name: "서초구", region_3depth_name: "서초동", code: "1165010800" }, ...] }
//   region_type: "H" = 행정동, "B" = 법정동. 동 단위는 "H" 또는 "B" 양쪽 결과 둘 다 있음.

type KakaoRegion = {
  region_type: "H" | "B";
  region_1depth_name: string;
  region_2depth_name: string;
  region_3depth_name: string;
  code: string;
};

export type ReverseGeocodeResult = {
  ok: boolean;
  region1: string | null;  // 시도 (e.g., "서울특별시")
  region2: string | null;  // 시군구 (e.g., "서초구")
  region3: string | null;  // 동읍면 (e.g., "서초동")
  fullPath: string | null; // "서울특별시 서초구 서초동"
  error?: string;
};

const KAKAO_API_URL = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json";

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    return { ok: false, region1: null, region2: null, region3: null, fullPath: null, error: "KAKAO_REST_API_KEY missing" };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, region1: null, region2: null, region3: null, fullPath: null, error: "invalid_coords" };
  }
  try {
    const url = `${KAKAO_API_URL}?x=${lng}&y=${lat}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
    });
    if (!res.ok) {
      return { ok: false, region1: null, region2: null, region3: null, fullPath: null, error: `kakao_http_${res.status}` };
    }
    const json = await res.json() as { documents?: KakaoRegion[] };
    const docs = json.documents ?? [];
    // 행정동(H) 우선, 없으면 법정동(B).
    const adminDoc = docs.find((d) => d.region_type === "H") ?? docs.find((d) => d.region_type === "B");
    if (!adminDoc) {
      return { ok: false, region1: null, region2: null, region3: null, fullPath: null, error: "no_region_found" };
    }
    const region1 = adminDoc.region_1depth_name?.trim() || null;
    const region2 = adminDoc.region_2depth_name?.trim() || null;
    const region3 = adminDoc.region_3depth_name?.trim() || null;
    const fullPath = [region1, region2, region3].filter(Boolean).join(" ") || null;
    return { ok: true, region1, region2, region3, fullPath };
  } catch (err) {
    return { ok: false, region1: null, region2: null, region3: null, fullPath: null, error: String(err) };
  }
}
