// 공용 포맷터 (순수, 서버-ok). KST 기준.
//   각 패널이 재구현하던 Intl.DateTimeFormat(8벌)/krw()/secondsUntil/relAge 를 1곳으로.
//   호출부 기존 포맷 보존: opts 로 seconds/dateOnly 선택.

const KST = "Asia/Seoul";

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const FMT_DATETIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const FMT_DATETIME_SEC = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const FMT_DATE = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
});

const FMT_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "26.06.07 14:30" (기본) · seconds → "…:45" · dateOnly → "26.06.07" · timeOnly → "14:30". 값 없으면 "—". */
export function fmtKst(
  value: string | number | Date | null | undefined,
  opts?: { seconds?: boolean; dateOnly?: boolean; timeOnly?: boolean },
): string {
  const d = toDate(value);
  if (!d) return "—";
  if (opts?.dateOnly) return FMT_DATE.format(d).replace(/\.\s*$/, "");
  if (opts?.timeOnly) return FMT_TIME.format(d);
  return (opts?.seconds ? FMT_DATETIME_SEC : FMT_DATETIME).format(d);
}

/** "99,000" (locale 숫자만). */
export function fmtNum(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("ko-KR");
}

/** "99,000원". */
export function fmtWon(value: number | null | undefined): string {
  return `${fmtNum(value)}원`;
}

/** "₩99,000". */
export function fmtKrwSign(value: number | null | undefined): string {
  return `₩${fmtNum(value)}`;
}

/** 초 → "5:09" (M:SS). 음수는 "0:00". */
export function fmtCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

/** ISO 시각까지 남은 초 (지났으면 음수/0). */
export function secondsUntil(iso: string | null | undefined): number {
  const d = toDate(iso);
  if (!d) return 0;
  return Math.round((d.getTime() - Date.now()) / 1000);
}

/** "방금 전" · "3분 전" · "2.4시간 전" · "5일 전". */
export function fmtRelativeAge(iso: string | number | Date | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = sec / 3600;
  if (hr < 24) return `${hr.toFixed(1)}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}
