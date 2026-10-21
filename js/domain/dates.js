// 日付の扱い。Android 版の LocalDate の代わりに「エポック日数」（1970-01-01 からの日数）の整数で日付を表す。
// 時刻の解釈はブラウザのタイムゾーン（日本時間）で行う。

export const MINUTE_MS = 60_000;
export const DAY_MINUTES = 24 * 60;
const DAY_MS = 86_400_000;

/** 年・月・日 → エポック日数 */
export function epochDay(y, m, d) {
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** エポック日数 → { y, m, d } */
export function ymd(day) {
  const dt = new Date(day * DAY_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** 曜日（ISO：1＝月曜 … 7＝日曜）。1970-01-01 は木曜 */
export function dayOfWeek(day) {
  return ((((day + 3) % 7) + 7) % 7) + 1;
}

/** その時刻のカレンダー上の日付（区切り時刻は考えない） */
export function calendarDate(epochMs) {
  const dt = new Date(epochMs);
  return epochDay(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

/** その日付の、0:00 からの分（0〜1439）の時刻 */
export function atTime(day, minuteOfDay) {
  const { y, m, d } = ymd(day);
  return new Date(y, m - 1, d, Math.floor(minuteOfDay / 60), minuteOfDay % 60).getTime();
}

/** 時刻 → 0:00 からの分（0〜1439） */
export function minuteOfDay(epochMs) {
  const dt = new Date(epochMs);
  return dt.getHours() * 60 + dt.getMinutes();
}

/** 2026-10-16（CSV の日付列） */
export function isoDate(day) {
  const { y, m, d } = ymd(day);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 負の数でも 0〜b-1 に収まる割り算の余り */
export function floorMod(a, b) {
  return ((a % b) + b) % b;
}
