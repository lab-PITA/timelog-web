// Android 版 TimeCalcTest と同じ例で、時間計算が同じ結果になることを確かめる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epochDay } from '../js/domain/dates.js';
import * as T from '../js/domain/timecalc.js';
import * as Format from '../js/domain/format.js';

const DSH = 3;
const at = (y, mo, d, h, mi, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime();
const hm = (h, m) => h * 60 + m;

test('quickRange：OKの1分前が終了', () => {
  // 14:51:37 にOK、30分 → 14:20〜14:50
  const r = T.quickRange(at(2026, 10, 16, 14, 51, 37), 30);
  assert.equal(r.start, at(2026, 10, 16, 14, 20));
  assert.equal(r.end, at(2026, 10, 16, 14, 50));
  assert.equal(T.minutesOf(r), 30);
});

test('subRange は終わり側に寄せる', () => {
  const main = T.range(at(2026, 10, 16, 8, 0), at(2026, 10, 16, 9, 0));
  const sub = T.subRangeEndAligned(main, 20);
  assert.equal(sub.start, at(2026, 10, 16, 8, 40));
  assert.equal(sub.end, main.end);
  assert.deepEqual(T.subRangeEndAligned(main, null), main);
  // サブが長すぎても記録の範囲に収める
  assert.deepEqual(T.subRangeEndAligned(main, 90), main);
});

test('minutesSinceLast：直前の記録の終了から数える', () => {
  const now = at(2026, 10, 16, 14, 51);
  assert.equal(T.minutesSinceLast(at(2026, 10, 16, 13, 50), now, DSH), 60);
  assert.equal(T.minutesSinceLast(null, now, DSH), null);
  // 前日（区切り3:00より前）の記録しかないときは何もしない
  assert.equal(T.minutesSinceLast(at(2026, 10, 16, 2, 0), now, DSH), null);
  // 直前の記録がすでに今の1分前まである
  assert.equal(T.minutesSinceLast(at(2026, 10, 16, 14, 50), now, DSH), null);
});

test('logicalDate：区切りより前は前日', () => {
  assert.equal(T.logicalDate(at(2026, 10, 16, 2, 59), DSH), epochDay(2026, 10, 15));
  assert.equal(T.logicalDate(at(2026, 10, 16, 3, 0), DSH), epochDay(2026, 10, 16));
  assert.equal(T.logicalDate(at(2026, 10, 16, 2, 59), 0), epochDay(2026, 10, 16));
});

test('splitByDay：区切りで分ける', () => {
  // 2:00〜4:00 は 3:00 で前日分と当日分に分かれる
  const parts = T.splitByDay(T.range(at(2026, 10, 16, 2, 0), at(2026, 10, 16, 4, 0)), DSH);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].day, epochDay(2026, 10, 15));
  assert.equal(T.minutesOf(parts[0].part), 60);
  assert.equal(parts[1].day, epochDay(2026, 10, 16));
  assert.equal(T.minutesOf(parts[1].part), 60);
});

test('splitByDay：区切り3:00なら0時をまたいでも同じ日', () => {
  const r = T.range(at(2026, 10, 16, 23, 30), at(2026, 10, 17, 0, 30));
  const parts = T.splitByDay(r, DSH);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].day, epochDay(2026, 10, 16));
  assert.equal(T.minutesOf(parts[0].part), 60);
  // 区切り0:00なら2日に分かれる
  assert.equal(T.splitByDay(r, 0).length, 2);
});

test('overlaps：本当に重なるときだけ', () => {
  const a = T.range(at(2026, 10, 16, 10, 0), at(2026, 10, 16, 11, 0));
  assert.ok(T.overlaps(a, T.range(at(2026, 10, 16, 10, 59), at(2026, 10, 16, 12, 0))));
  assert.ok(T.overlaps(a, T.range(at(2026, 10, 16, 10, 10), at(2026, 10, 16, 10, 20))));
  // 終了と開始がぴったり接するのは重なりではない
  assert.ok(!T.overlaps(a, T.range(at(2026, 10, 16, 11, 0), at(2026, 10, 16, 12, 0))));
  assert.ok(!T.overlaps(a, T.range(at(2026, 10, 16, 9, 0), at(2026, 10, 16, 10, 0))));
});

test('rangeFromTimes：0時またぎと区切り', () => {
  const day = epochDay(2026, 10, 16);
  const r1 = T.rangeFromTimes(day, hm(23, 30), hm(0, 30), DSH);
  assert.equal(r1.start, at(2026, 10, 16, 23, 30));
  assert.equal(r1.end, at(2026, 10, 17, 0, 30));
  // 1:00〜2:00 は「16日の深夜」＝カレンダー上の17日
  const r2 = T.rangeFromTimes(day, hm(1, 0), hm(2, 0), DSH);
  assert.equal(r2.start, at(2026, 10, 17, 1, 0));
  assert.equal(T.minutesOf(r2), 60);
  // 2:00〜4:00 は区切りをまたいでも1件
  const r3 = T.rangeFromTimes(day, hm(2, 0), hm(4, 0), DSH);
  assert.equal(r3.start, at(2026, 10, 17, 2, 0));
  assert.equal(r3.end, at(2026, 10, 17, 4, 0));
  // 同じ時刻なら24時間
  assert.equal(T.minutesOf(T.rangeFromTimes(day, hm(9, 0), hm(9, 0), DSH)), 24 * 60);
});

test('subRangeWithin：記録の範囲内だけ', () => {
  const main = T.range(at(2026, 10, 16, 23, 0), at(2026, 10, 17, 1, 0));
  assert.deepEqual(T.subRangeWithin(main, hm(23, 40), hm(0, 20)), T.range(at(2026, 10, 16, 23, 40), at(2026, 10, 17, 0, 20)));
  assert.equal(T.subRangeWithin(main, hm(22, 0), hm(23, 30)), null);
  assert.equal(T.subRangeWithin(main, hm(0, 30), hm(1, 30)), null);
});

test('unionMinutes：重なりは二重に数えない', () => {
  const r = (h1, m1, h2, m2) => T.range(at(2026, 10, 16, h1, m1), at(2026, 10, 16, h2, m2));
  assert.equal(T.unionMinutes([r(9, 0, 10, 0), r(9, 30, 10, 30), r(11, 0, 11, 15)]), 105);
  assert.equal(T.unionMinutes([]), 0);
});

test('Format.duration', () => {
  assert.equal(Format.duration(30), '30分');
  assert.equal(Format.duration(120), '2時間');
  assert.equal(Format.duration(750), '12時間30分');
  assert.equal(Format.duration(0), '0分');
});

test('Format の日付・時刻', () => {
  const day = epochDay(2026, 10, 16);
  assert.equal(Format.fullDate(day), '2026年10月16日（金）');
  assert.equal(Format.shortDate(day), '10月16日（金）');
  assert.equal(Format.compactDate(day), '10/16（金）');
  assert.equal(Format.range(T.range(at(2026, 10, 16, 9, 5), at(2026, 10, 16, 14, 50))), '9:05〜14:50');
  assert.equal(Format.elapsed(25 * 60_000 + 13_000), '0:25:13');
});
