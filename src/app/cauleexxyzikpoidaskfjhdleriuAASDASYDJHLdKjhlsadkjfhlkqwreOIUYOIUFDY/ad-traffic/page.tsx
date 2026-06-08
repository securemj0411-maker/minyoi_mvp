// Wave 1230d (2026-06-08): 운영자 — 광고 유입 모니터.
//   mvp_ad_visits(봇 제외된 진짜 광고 유입) 표시: 출처·기기·지역·IP·클릭ID·유입경로.
//   admin auth 는 layout.tsx 에서 처리. _ui 프리미티브(서버-ok) 사용.

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

import { Badge, EmptyState, Notice, Panel, SectionHeader, StatCard, StatusBadge } from "../_ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "../_ui/Table";
import { fmtKst, fmtNum } from "../_ui/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdVisitRow = {
  id: number;
  created_at: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  click_id: string | null;
  click_id_type: string | null;
  landing_path: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  referer: string | null;
  user_agent: string | null;
};

async function fetchAdVisits(): Promise<{ rows: AdVisitRow[]; total: number; error: string | null }> {
  try {
    const res = await restFetch(
      `${tableUrl("mvp_ad_visits")}?select=id,created_at,source,medium,campaign,click_id,click_id_type,landing_path,ip,country,city,region,referer,user_agent&order=created_at.desc&limit=300`,
      { headers: { ...serviceHeaders(), Prefer: "count=exact" }, cache: "no-store" },
    );
    const rows = (await res.json()) as AdVisitRow[];
    const total = Number((res.headers.get("content-range") ?? "0-0/0").split("/")[1] ?? rows.length) || rows.length;
    return { rows, total, error: null };
  } catch (err) {
    return { rows: [], total: 0, error: err instanceof Error ? err.message : "ad visits fetch failed" };
  }
}

function deviceLabel(ua: string | null): string {
  if (!ua) return "—";
  if (/iPhone/i.test(ua)) return "📱 아이폰";
  if (/iPad/i.test(ua)) return "📱 아이패드";
  if (/Android/i.test(ua)) return "📱 안드로이드";
  if (/Macintosh|Mac OS X/i.test(ua)) return "💻 Mac";
  if (/Windows/i.test(ua)) return "💻 Windows";
  if (/Linux/i.test(ua)) return "💻 Linux";
  return "🖥 기타";
}

function browserLabel(ua: string | null): string {
  if (!ua) return "";
  if (/KAKAOTALK/i.test(ua)) return "카카오톡";
  if (/Instagram/i.test(ua)) return "인스타";
  if (/FBAN|FBAV/i.test(ua)) return "페북";
  if (/NAVER\(inapp/i.test(ua)) return "네이버앱";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/CriOS|Chrome/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua)) return "Safari";
  return "";
}

function sourceLabel(source: string | null): string {
  if (source === "gads") return "구글애즈";
  if (source === "google_ads") return "구글애즈(자동태그)";
  if (!source) return "—";
  return source;
}

function geoLabel(row: AdVisitRow): string {
  if (!row.country && !row.city && !row.region) return "—";
  const country = row.country === "KR" ? "🇰🇷 한국" : (row.country ?? "");
  const local = [row.region, row.city].filter(Boolean).join(" ");
  return local ? `${country} · ${local}` : country || "—";
}

function refererHost(referer: string | null): string {
  if (!referer) return "직접/앱";
  try {
    return new URL(referer).hostname.replace(/^www\./, "");
  } catch {
    return referer.slice(0, 24);
  }
}

function startOfTodayKstMs(): number {
  // KST(UTC+9) 자정을 UTC ms 로.
  const kstNow = Date.now() + 9 * 3_600_000;
  const kstMidnight = Math.floor(kstNow / 86_400_000) * 86_400_000;
  return kstMidnight - 9 * 3_600_000;
}

export default async function AdTrafficAdminPage() {
  const { rows, total, error } = await fetchAdVisits();
  const todayStart = startOfTodayKstMs();
  const weekAgo = Date.now() - 7 * 86_400_000;
  const todayCount = rows.filter((r) => new Date(r.created_at).getTime() >= todayStart).length;
  const weekCount = rows.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length;
  const realClickCount = rows.filter((r) => r.click_id).length;
  const uniqueIp = new Set(rows.map((r) => r.ip).filter(Boolean)).size;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6">
      <SectionHeader
        eyebrow="광고 유입"
        title="광고로 들어온 방문 기록"
        caption="구글애즈 등 광고로 사이트에 도착한 진짜 사람만 기록돼요(봇 자동 제외). 기기·지역·IP·클릭ID 확인. 새로고침하면 최신."
      />

      {error ? <Notice tone="rose" className="mb-4">광고 유입 테이블을 읽지 못했어요. {error}</Notice> : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="오늘" value={fmtNum(todayCount)} sub="KST 자정 기준" tone="blue" />
        <StatCard label="최근 7일" value={fmtNum(weekCount)} tone="slate" />
        <StatCard label="전체 누적" value={fmtNum(total)} tone="slate" />
        <StatCard label="확실한 광고클릭" value={fmtNum(realClickCount)} sub="gclid/wbraid 보유" tone="emerald" />
        <StatCard label="고유 IP" value={fmtNum(uniqueIp)} sub={`최근 ${rows.length}건 기준`} tone="slate" />
      </section>

      <Panel className="mt-5 p-4">
        <SectionHeader title="최근 광고 유입" caption={`최근 ${rows.length}건`} tone="slate" />
        {rows.length === 0 ? (
          <EmptyState icon="📣">
            아직 광고로 들어온 방문이 없어요. 구글애즈 Final URL 을 <span className="font-mono">minyoi-mvp.vercel.app/?src=gads</span> 로 설정하면 여기 쌓여요.
          </EmptyState>
        ) : (
          <Table minWidth={920}>
            <THead>
              <TR>
                <TH>시각 (KST)</TH>
                <TH>출처</TH>
                <TH>기기</TH>
                <TH>지역</TH>
                <TH>IP</TH>
                <TH>클릭ID</TH>
                <TH>유입경로</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => {
                const browser = browserLabel(row.user_agent);
                const adTone = row.source === "gads" || row.source === "google_ads";
                return (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap font-mono">{fmtKst(row.created_at, { seconds: true })}</TD>
                    <TD>
                      <StatusBadge tone={adTone ? "blue" : "slate"}>{sourceLabel(row.source)}</StatusBadge>
                      {row.campaign ? <div className="mt-0.5 truncate text-zinc-500">{row.campaign}</div> : null}
                    </TD>
                    <TD className="whitespace-nowrap">
                      {deviceLabel(row.user_agent)}
                      {browser ? <span className="text-zinc-500"> · {browser}</span> : null}
                    </TD>
                    <TD className="whitespace-nowrap">{geoLabel(row)}</TD>
                    <TD className="font-mono">{row.ip ?? "—"}</TD>
                    <TD>
                      {row.click_id ? (
                        <Badge tone="emerald">{row.click_id_type ?? "click"}</Badge>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </TD>
                    <TD className="max-w-[180px] truncate" title={row.referer ?? undefined}>
                      {refererHost(row.referer)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Panel>
    </main>
  );
}
