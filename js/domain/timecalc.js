// 時間計算のルール（企画書 3章・4-1）。Android 版 domain/TimeCalc.kt と同じ結果になるように移植したもの。
// 範囲は { start, end }（エポックミリ秒。end は含まない）、日付はエポック日数、時刻は 0:00 からの分で表す。
import { MINUTE_MS, DAY_MINUTES, atTime, calendarDate, floorMod, minuteOfDay } from './dates.js';

export const range = (start, end) => ({ start, end });

/** 範囲の分数 */
export const minutesOf = (r) => Math.floor((r.end - r.start) / MINUTE_MS);

export const sameRange = (a, b) => a.start === b.start && a.end === b.end;

/** 秒以下を切り捨てて分単位にする。 */
export function truncateToMinute(epochMs) {
  return epochMs - floorMod(epochMs, MINUTE_MS);
}

/** クイック記録の終了＝OKを押した時刻（分に切り捨て）の1分前 */
export function quickEnd(nowMs) {
  return truncateToMinute(nowMs) - MINUTE_MS;
}

/** クイック記録：終了＝OKを押した時刻の1分前、開始＝終了−分数。 */
export function quickRange(nowMs, minutes) {
  const end = quickEnd(nowMs);
  return range(end - minutes * MINUTE_MS, end);
}

/** クイック記録のサブ：記録の終わり側に寄せる。分数がなければ記録全体。 */
export function subRangeEndAligned(main, subMinutes) {
  if (subMinutes == null) return main;
  return range(Math.max(main.end - subMinutes * MINUTE_MS, main.start), main.end);
}

/** 「前回から」キー：直前の記録の終了から今（OKの1分前）までの分数。今日の記録がなければ null。 */
export function minutesSinceLast(lastEndMs, nowMs, dayStartHour) {
  if (lastEndMs == null) return null;
  const todayStart = dayStart(logicalDate(nowMs, dayStartHour), dayStartHour);
  if (lastEndMs <= todayStart) return null;
  const minutes = Math.trunc((quickEnd(nowMs) - lastEndMs) / MINUTE_MS);
  return minutes > 0 ? minutes : null;
}

/** 1日の区切り（既定 3:00）を考慮した「その時刻が属する日」。 */
export function logicalDate(epochMs, dayStartHour) {
  const day = calendarDate(epochMs);
  return new Date(epochMs).getHours() < dayStartHour ? day - 1 : day;
}

export function dayStart(day, dayStartHour) {
  return atTime(day, dayStartHour * 60);
}

/** その日の範囲（区切り時刻〜翌日の区切り時刻）。 */
export function dayRange(day, dayStartHour) {
  return range(dayStart(day, dayStartHour), dayStart(day + 1, dayStartHour));
}

/** 2つの範囲の重なり部分。重ならなければ null。 */
export function intersect(a, b) {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return start < end ? range(start, end) : null;
}

export function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

/** 日付をまたぐ記録を、日ごとの部分に分ける。[{ day, part }] */
export function splitByDay(r, dayStartHour) {
  const result = [];
  let day = logicalDate(r.start, dayStartHour);
  for (;;) {
    const d = dayRange(day, dayStartHour);
    if (d.start >= r.end) break;
    const part = intersect(r, d);
    if (part) result.push({ day, part });
    day += 1;
  }
  return result;
}

/**
 * 「日付＋時刻」を実際の日時にする。区切り時刻より前の時刻（例 1:00）は、
 * その日の深夜＝カレンダー上の翌日として扱う。
 */
export function atLogicalDate(day, minute, dayStartHour) {
  const calendarDay = Math.floor(minute / 60) < dayStartHour ? day + 1 : day;
  return atTime(calendarDay, minute);
}

/** 後から入力の開始・終了。終了が開始以前なら翌日の時刻とみなす（23:30〜0:30 など）。 */
export function rangeFromTimes(day, startMinute, endMinute, dayStartHour) {
  const startMs = atLogicalDate(day, startMinute, dayStartHour);
  const minutes = floorMod(endMinute - startMinute, DAY_MINUTES) || DAY_MINUTES;
  return range(startMs, startMs + minutes * MINUTE_MS);
}

/** 記録の範囲内で、サブの開始・終了時刻を実際の日時にする。範囲外なら null。 */
export function subRangeWithin(main, subStartMinute, subEndMinute) {
  const start = timeWithin(main, subStartMinute);
  if (start == null) return null;
  const minutes = floorMod(subEndMinute - subStartMinute, DAY_MINUTES);
  const end = start + minutes * MINUTE_MS;
  if (minutes === 0 || end > main.end) return null;
  return range(start, end);
}

/** 記録の範囲 [start, end] の中でその時刻になる日時。 */
function timeWithin(main, minute) {
  const firstDay = calendarDate(main.start);
  for (let offset = 0; offset <= 1; offset++) {
    const candidate = atTime(firstDay + offset, minute);
    if (candidate >= main.start && candidate <= main.end) return candidate;
  }
  return null;
}

/** 時刻 → 0:00 からの分 */
export const toMinuteOfDay = minuteOfDay;

/** 重なりを二重に数えない合計分数（今日タブの「記録済み」） */
export function unionMinutes(ranges) {
  let total = 0;
  let currentEnd = -Infinity;
  for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
    const start = Math.max(r.start, currentEnd);
    if (r.end > start) total += r.end - start;
    currentEnd = Math.max(currentEnd, r.end);
  }
  return Math.floor(total / MINUTE_MS);
}
