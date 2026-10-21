// 画面に出す日本語の書式。Android 版 domain/Format.kt と同じ表示にする。
import { dayOfWeek, ymd } from './dates.js';

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

/** ISO の曜日番号（1＝月曜）→「月」 */
export const weekday = (dow) => WEEKDAYS[dow - 1];

/** 2026年10月16日（金） */
export function fullDate(day) {
  const { y, m, d } = ymd(day);
  return `${y}年${m}月${d}日（${weekday(dayOfWeek(day))}）`;
}

/** 10月16日（金） */
export function shortDate(day) {
  const { m, d } = ymd(day);
  return `${m}月${d}日（${weekday(dayOfWeek(day))}）`;
}

/** 10/16（金）：狭い場所用 */
export function compactDate(day) {
  const { m, d } = ymd(day);
  return `${m}/${d}（${weekday(dayOfWeek(day))}）`;
}

/** 2026年10月12日〜18日 / 2026年10月26日〜11月1日 / 2026年12月28日〜2027年1月3日 */
export function weekRange(start) {
  const s = ymd(start);
  const e = ymd(start + 6);
  const head = `${s.y}年${s.m}月${s.d}日〜`;
  if (e.y !== s.y) return `${head}${e.y}年${e.m}月${e.d}日`;
  if (e.m !== s.m) return `${head}${e.m}月${e.d}日`;
  return `${head}${e.d}日`;
}

/** 0:00 からの分 → 14:05 */
export function clock(minute) {
  return `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`;
}

/** 時刻 → 14:05 */
export function time(epochMs) {
  const dt = new Date(epochMs);
  return clock(dt.getHours() * 60 + dt.getMinutes());
}

/** 14:20〜14:50 */
export function range(r) {
  return `${time(r.start)}〜${time(r.end)}`;
}

/** 3時間20分 / 45分 / 2時間 */
export function duration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

/** タイマーの経過時間：0:25:13 */
export function elapsed(millis) {
  const total = Math.max(Math.floor(millis / 1000), 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** 18.6%（小数1桁） */
export function percent1(value) {
  return `${value.toFixed(1)}%`;
}
