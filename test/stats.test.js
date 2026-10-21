// Android 版 StatsTest と同じ例で、集計が同じ結果になることを確かめる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epochDay } from '../js/domain/dates.js';
import * as Stats from '../js/domain/stats.js';
import * as Format from '../js/domain/format.js';

const DSH = 3;
const STUDY = 1;
const MOVE = 2;
const monday = epochDay(2026, 10, 12);
const at = (d, h, mi) => new Date(2026, 9, d, h, mi).getTime();
const record = (categoryId, startAt, endAt, subCategoryId = null, subStartAt = null, subEndAt = null) =>
  ({ id: 0, categoryId, startAt, endAt, subCategoryId, subStartAt, subEndAt, memo: null, createdAt: 0 });
const byId = (stats) => Object.fromEntries(stats.map((s) => [s.categoryId, s]));

test('サブの時間はサブ項目に足す', () => {
  // 企画書 4-5 の例：移動60分（うち20分はサブで勉強）＋勉強90分
  const records = [
    record(MOVE, at(13, 8, 0), at(13, 9, 0), STUDY, at(13, 8, 40), at(13, 9, 0)),
    record(STUDY, at(13, 20, 0), at(13, 21, 30)),
  ];
  const stats = byId(Stats.aggregate(records, monday, 7, DSH));
  assert.equal(stats[STUDY].totalMinutes, 110);
  assert.equal(stats[STUDY].subMinutes, 20);
  assert.equal(Stats.statMinutes(stats[STUDY], false), 90);
  assert.equal(stats[MOVE].totalMinutes, 60);
  assert.equal(stats[MOVE].subMinutes, 0);
  // 火曜（13日）は週の2日目
  assert.equal(stats[STUDY].perDay[1], 110);
  assert.equal(Stats.statPerDay(stats[STUDY], false)[1], 90);
  // 合計の多い順
  assert.equal(Stats.aggregate(records, monday, 7, DSH)[0].categoryId, STUDY);
});

test('区切りで分け、期間外は数えない', () => {
  // 月曜 2:00〜4:00：2:00〜3:00 は前週の日曜分なので、この週には数えない
  const stats = Stats.aggregate([record(STUDY, at(12, 2, 0), at(12, 4, 0))], monday, 7, DSH);
  assert.equal(stats.length, 1);
  assert.equal(stats[0].totalMinutes, 60);
  assert.equal(stats[0].perDay[0], 60);
  // 日曜の深夜 1:00〜2:00（カレンダー上は翌週月曜）は日曜分
  const sundayNight = Stats.aggregate([record(STUDY, at(19, 1, 0), at(19, 2, 0))], monday, 7, DSH);
  assert.equal(sundayNight[0].perDay[6], 60);
});

test('週の開始曜日は設定に従う', () => {
  const friday = epochDay(2026, 10, 16);
  assert.equal(Stats.weekStart(friday, 1), monday);
  assert.equal(Stats.weekStart(friday, 7), epochDay(2026, 10, 11));
  assert.equal(Stats.weekStart(monday, 1), monday);
  const range = Stats.weekRange(monday, DSH);
  assert.equal(range.start, at(12, 3, 0));
  assert.equal(range.end, at(19, 3, 0));
});

test('◯時間以上：届いた時点で達成', () => {
  const notYet = Stats.goalProgress(450, 600, 'AT_LEAST', false);
  assert.equal(notYet.achieved, false);
  assert.ok(Math.abs(notYet.percent - 75) < 0.01);
  assert.equal(notYet.remainingMinutes, 150);
  const done = Stats.goalProgress(660, 600, 'AT_LEAST', false);
  assert.equal(done.achieved, true);
  assert.ok(Math.abs(done.percent - 110) < 0.01);
  assert.equal(done.remainingMinutes, 0);
});

test('◯時間以内：週が終わってから数える', () => {
  // 週の途中は、超えていなくても達成に数えない
  const midWeek = Stats.goalProgress(180, 420, 'AT_MOST', false);
  assert.equal(midWeek.achieved, false);
  assert.equal(midWeek.nearLimit, false);
  assert.equal(Stats.goalProgress(180, 420, 'AT_MOST', true).achieved, true);
  // 80%を超えたら注意、100%を超えたら超過
  assert.equal(Stats.goalProgress(360, 420, 'AT_MOST', false).nearLimit, true);
  const over = Stats.goalProgress(480, 420, 'AT_MOST', true);
  assert.equal(over.over, true);
  assert.equal(over.achieved, false);
  assert.equal(over.overMinutes, 60);
});

test('週の範囲の表示', () => {
  assert.equal(Format.weekRange(monday), '2026年10月12日〜18日');
  assert.equal(Format.weekRange(epochDay(2026, 10, 26)), '2026年10月26日〜11月1日');
  assert.equal(Format.weekRange(epochDay(2026, 12, 28)), '2026年12月28日〜2027年1月3日');
});
