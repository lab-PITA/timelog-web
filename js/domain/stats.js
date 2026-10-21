// 集計（企画書 4-4・4-5・4-8）。Android 版 domain/Stats.kt と同じ結果になるように移植したもの。
// 項目の合計＝メインとして行った時間＋サブとして行った時間。
import { dayOfWeek } from './dates.js';
import { dayStart, range, splitByDay, minutesOf } from './timecalc.js';

/** 記録の範囲 */
export const recordRange = (r) => range(r.startAt, r.endAt);

/** 記録のサブの範囲（なければ null） */
export function recordSubRange(r) {
  return r.subCategoryId != null && r.subStartAt != null && r.subEndAt != null ? range(r.subStartAt, r.subEndAt) : null;
}

/** その日付を含む週の開始日。firstDay は ISO の曜日番号（1＝月曜） */
export function weekStart(day, firstDay) {
  return day - ((dayOfWeek(day) - firstDay + 7) % 7);
}

/** 週の範囲。週の区切りも1日の区切り時刻に従う */
export function weekRange(start, dayStartHour) {
  return range(dayStart(start, dayStartHour), dayStart(start + 7, dayStartHour));
}

/**
 * 期間 [firstDay, firstDay+days) の記録を項目ごとに集計する。
 * 日付をまたぐ記録は日ごとに分け、期間外の部分は数えない。
 * 返り値：[{ categoryId, mainMinutes, subMinutes, totalMinutes, perDay, perDaySub }]（合計の多い順）
 */
export function aggregate(records, firstDay, days, dayStartHour) {
  const main = new Map();
  const sub = new Map();

  const add = (target, categoryId, r) => {
    for (const { day, part } of splitByDay(r, dayStartHour)) {
      const index = day - firstDay;
      if (index < 0 || index >= days) continue;
      if (!target.has(categoryId)) target.set(categoryId, new Array(days).fill(0));
      target.get(categoryId)[index] += minutesOf(part);
    }
  };

  for (const r of records) {
    add(main, r.categoryId, recordRange(r));
    const subRange = recordSubRange(r);
    if (subRange) add(sub, r.subCategoryId, subRange);
  }

  const ids = [...main.keys(), ...[...sub.keys()].filter((id) => !main.has(id))];
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  return ids
    .map((id) => {
      const m = main.get(id) ?? new Array(days).fill(0);
      const s = sub.get(id) ?? new Array(days).fill(0);
      const mainMinutes = sum(m);
      const subMinutes = sum(s);
      return {
        categoryId: id,
        mainMinutes,
        subMinutes,
        totalMinutes: mainMinutes + subMinutes,
        perDay: m.map((v, i) => v + s[i]),
        perDaySub: s,
      };
    })
    .filter((st) => st.totalMinutes > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/** サブを含めるかどうかで実績を選ぶ */
export function statMinutes(stat, includeSub) {
  return includeSub ? stat.totalMinutes : stat.mainMinutes;
}

export function statPerDay(stat, includeSub) {
  return includeSub ? stat.perDay : stat.perDay.map((all, i) => all - stat.perDaySub[i]);
}

/**
 * 目標の達成状況。
 * ◯時間以上：目標に届いた時点で達成。
 * ◯時間以内：週が終わるまでは達成に数えない。終わった時点で超えていなければ達成。
 */
export function goalProgress(actualMinutes, targetMinutes, type, weekFinished) {
  const percent = targetMinutes > 0 ? (actualMinutes * 100) / targetMinutes : 0;
  const over = type === 'AT_MOST' && actualMinutes > targetMinutes;
  return {
    actualMinutes,
    targetMinutes,
    type,
    percent,
    achieved: type === 'AT_LEAST' ? actualMinutes >= targetMinutes : weekFinished && actualMinutes <= targetMinutes,
    over,
    nearLimit: type === 'AT_MOST' && !over && percent > 80,
    remainingMinutes: Math.max(targetMinutes - actualMinutes, 0),
    overMinutes: over ? actualMinutes - targetMinutes : 0,
  };
}

/** 今週の経過割合（0〜1）。目標バーの「今日までの目安」の線に使う */
export function weekElapsedFraction(nowMs, week) {
  return Math.min(Math.max((nowMs - week.start) / (week.end - week.start), 0), 1);
}
