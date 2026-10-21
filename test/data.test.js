// Android 版 BackupTest・TimerTest と同じ例で、保存・バックアップ・タイマーを確かめる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, memoryBackend, timerToRecord, EARLY_EXIT_MEMO } from '../js/data/store.js';
import { exportJson, parseBackup, exportCsv, hasUserData, BackupFormatError } from '../js/data/backup.js';
import { epochDay } from '../js/domain/dates.js';
import { OLD_SAMPLES } from '../js/data/seed.js';

const at = (h, m, s = 0) => new Date(2026, 9, 16, h, m, s).getTime();

async function newStore() {
  const backend = memoryBackend();
  const store = createStore(backend);
  await store.load();
  return { store, backend };
}

async function seed(store) {
  store.addRecord({ categoryId: 5, startAt: at(8, 0), endAt: at(9, 0), subCategoryId: 4, subStartAt: at(8, 40), subEndAt: at(9, 0), memo: null, createdAt: 1 });
  store.addRecord({ categoryId: 4, startAt: at(20, 0), endAt: at(21, 30), subCategoryId: null, subStartAt: null, subEndAt: null, memo: '数学, "問題集"\n2章', createdAt: 2 });
  const study = store.categories().find((c) => c.name === '勉強');
  store.updateCategory({ ...study, name: '勉強（資格）' });
  store.saveGoal({ categoryId: 4, weekStart: epochDay(2026, 10, 12), targetMinutes: 600, type: 'AT_LEAST', includeSub: true });
  store.setSetting('dayStartHour', 4);
  store.setSetting('weekStart', 7);
  store.setSetting('themeColor', 'BLUE');
  store.setSetting('darkMode', 'DARK');
  await store.flush();
}

test('初回は項目16個が入る', async () => {
  const { store } = await newStore();
  const names = store.categories().map((c) => c.name);
  assert.equal(names.length, 16);
  assert.equal(names[0], '睡眠');
  assert.equal(names[7], '化粧');
  assert.equal(new Set(store.categories().map((c) => c.icon)).size, 16);
  assert.equal(store.categories()[0].color, 0xff1e3a9e | 0);
});

test('初期項目は上下左右で同じ色が隣り合わない', async () => {
  const { store } = await newStore();
  const colors = store.categories().map((c) => c.color);
  for (let i = 0; i < 16; i++) {
    if (i % 4 !== 3) assert.notEqual(colors[i], colors[i + 1], `${i} と右`);
    if (i + 4 < 16) assert.notEqual(colors[i], colors[i + 4], `${i} と下`);
  }
});

test('以前の初期項目のままなら新しい初期項目に入れ替わる', async () => {
  const old = OLD_SAMPLES.map(([name, color, icon], i) => ({ id: i + 1, name, color, icon, sortOrder: i, isArchived: false }));
  const base = { records: [], goals: [], settings: { dayStartHour: 3, weekStart: 1, themeColor: 'GREEN' }, lastCarriedWeek: null, timer: null };
  const fresh = createStore(memoryBackend({ ...base, categories: old }));
  await fresh.load();
  assert.equal(fresh.categories()[0].name, '睡眠');
  // 記録があれば変えない
  const used = createStore(memoryBackend({ ...base, categories: old, records: [{ id: 1, categoryId: 2, startAt: 0, endAt: 60_000, createdAt: 0 }] }));
  await used.load();
  assert.equal(used.categories()[0].name, '動画');
});

test('閉じて開き直してもデータが残る', async () => {
  const { store, backend } = await newStore();
  await seed(store);
  const again = createStore(backend);
  await again.load();
  assert.deepEqual(again.data, store.data);
});

test('書き出し → 全部消す → 読み込み で元に戻る', async () => {
  const { store } = await newStore();
  await seed(store);
  const before = JSON.parse(JSON.stringify(store.data));
  const json = exportJson(store.data);

  const { store: fresh } = await newStore();
  const parsed = parseBackup(json);
  await fresh.replaceAll(parsed);
  assert.deepEqual(fresh.categories(), store.categories());
  assert.deepEqual(fresh.data.records, before.records);
  assert.deepEqual(fresh.data.goals, before.goals);
  assert.deepEqual(fresh.settings, { dayStartHour: 4, weekStart: 7, themeColor: 'BLUE', darkMode: 'DARK' });
});

test('Android 版の形式（color が負の数）を読める', () => {
  const json = JSON.stringify({
    app: 'com.labpita.timelog',
    version: 1,
    exportedAt: 1792300000000,
    settings: { dayStartHour: 3, weekStart: 1, themeColor: 'GREEN' },
    categories: [{ id: 1, name: '動画', color: -45149, icon: 'video', sortOrder: 0, isArchived: false }],
    records: [{ id: 1, categoryId: 1, startAt: 1792282800000, endAt: 1792294200000, subCategoryId: null, subStartAt: null, subEndAt: null, memo: null, createdAt: 1792294260000 }],
  });
  const parsed = parseBackup(json);
  assert.equal(parsed.categories[0].color, -45149);
  assert.deepEqual(parsed.goals, []);
  // darkMode がないファイルは「端末に合わせる」
  assert.equal(parsed.settings.darkMode, 'SYSTEM');
  assert.equal(parsed.records.length, 1);
});

test('壊れたファイルでは今のデータを消さない', async () => {
  for (const bad of ['これはJSONではない', '{"app":"other"}', '{"app":"com.labpita.timelog","version":1}', 'null', '{"app":"com.labpita.timelog","version":2}']) {
    assert.throws(() => parseBackup(bad), BackupFormatError, bad);
  }
  assert.throws(() => parseBackup('{"app":"com.labpita.timelog","version":2}'), /アプリを更新/);
});

test('CSV：見出しと値の囲み', async () => {
  const { store } = await newStore();
  await seed(store);
  store.setSetting('dayStartHour', 3);
  const csv = exportCsv(store.data);
  assert.ok(csv.startsWith('﻿日付,開始,終了,分,項目,サブ項目,サブ開始,サブ終了,サブ分,メモ\r\n'));
  const lines = csv.slice(1).split('\r\n');
  assert.ok(lines.some((l) => l.startsWith('2026-10-16,8:00,9:00,60,移動,勉強（資格）,8:40,9:00,20,')));
  assert.ok(csv.includes('"数学, ""問題集""\n2章"'));
});

test('消えるデータがあるときだけ確認する', async () => {
  const { store } = await newStore();
  assert.equal(hasUserData(store.data), false);
  const first = store.categories()[0];
  store.updateCategory({ ...first, name: '読書' });
  assert.equal(hasUserData(store.data), true);
  store.updateCategory(first);
  assert.equal(hasUserData(store.data), false);
  store.addRecord({ categoryId: first.id, startAt: at(8, 0), endAt: at(9, 0), createdAt: 0 });
  assert.equal(hasUserData(store.data), true);
});

test('目標の引き継ぎは1度だけ', async () => {
  const { store } = await newStore();
  const w1 = epochDay(2026, 10, 12);
  const w2 = w1 + 7;
  store.saveGoal({ categoryId: 4, weekStart: w1, targetMinutes: 600, type: 'AT_LEAST', includeSub: true });
  store.carryOverGoals(w2);
  assert.equal(store.goalsForWeek(w2).length, 1);
  // 全部消しても復活しない
  store.deleteGoal(store.goalsForWeek(w2)[0].id);
  store.carryOverGoals(w2);
  assert.equal(store.goalsForWeek(w2).length, 0);
  // 同じ項目・同じ週の目標は置き換え
  store.saveGoal({ categoryId: 4, weekStart: w1, targetMinutes: 300, type: 'AT_MOST', includeSub: false });
  assert.equal(store.goalsForWeek(w1).length, 1);
  assert.equal(store.goalsForWeek(w1)[0].targetMinutes, 300);
});

// ---- タイマー ----

const t = (h, m, s = 0) => new Date(2026, 9, 18, h, m, s).getTime();
const timer = { categoryId: 1, categoryName: '勉強', subId: 3, subName: '移動', startAt: t(9, 0, 40) };

test('タイマー：分に切り捨てて記録', () => {
  const r = timerToRecord(timer, t(9, 25, 59));
  assert.equal(r.startAt, t(9, 0));
  assert.equal(r.endAt, t(9, 25));
  // サブは記録全体
  assert.equal(r.subCategoryId, 3);
  assert.equal(r.subStartAt, r.startAt);
  assert.equal(r.subEndAt, r.endAt);
  assert.equal(r.memo, null);
});

test('タイマー：1分未満は記録しない', () => {
  assert.equal(timerToRecord(timer, t(9, 0, 59)), null);
  const early = timerToRecord({ ...timer, subId: null }, t(10, 0), true);
  assert.equal(early.memo, EARLY_EXIT_MEMO);
  assert.equal(early.subStartAt, null);
});

test('タイマー：開き直しても計測中、ストップは1回だけ保存', async () => {
  const { store, backend } = await newStore();
  const start = Date.now() - 30 * 60_000;
  store.startTimer({ id: 5, name: 'バイト' }, null, start);
  await store.flush();

  const restored = createStore(backend);
  await restored.load();
  assert.equal(restored.timer.startAt, start);
  assert.equal(restored.timer.categoryName, 'バイト');

  assert.match(restored.stopTimer(), /バイト を記録しました/);
  assert.equal(restored.stopTimer(), null);
  await restored.flush();
  const again = createStore(backend);
  await again.load();
  assert.equal(again.timer, null);
  assert.equal(again.data.records.length, 1);
  const saved = again.data.records[0];
  assert.equal(saved.categoryId, 5);
  assert.equal((saved.endAt - saved.startAt) / 60_000, 30);
});

test('タイマー：計測中にサブだけ変える', async () => {
  const { store } = await newStore();
  // 12:00 に「食事＋サブ動画」でスタート
  store.startTimer({ id: 2, name: '食事' }, { id: 12, name: '動画' }, t(12, 0, 10));
  // 12:20 にサブを AI（id 99）に変える
  assert.equal(store.changeTimerSub({ id: 99, name: 'AI' }, t(12, 20, 30)), '12:00〜12:20 食事 を記録して、サブを「AI」に変えました');
  assert.equal(store.timer.startAt, t(12, 20));
  assert.equal(store.timer.sessionStartAt, t(12, 0, 10));
  // 同じサブなら何もしない
  assert.equal(store.changeTimerSub({ id: 99, name: 'AI' }, t(12, 30)), null);
  store.stopTimer(t(12, 50, 5));
  const [a, b] = store.data.records;
  assert.deepEqual([a.startAt, a.endAt, a.subCategoryId, a.subStartAt, a.subEndAt], [t(12, 0), t(12, 20), 12, t(12, 0), t(12, 20)]);
  assert.deepEqual([b.startAt, b.endAt, b.subCategoryId], [t(12, 20), t(12, 50), 99]);
});

test('タイマー：1分未満でサブを変えたら記録しない', async () => {
  const { store } = await newStore();
  store.startTimer({ id: 2, name: '食事' }, { id: 12, name: '動画' }, t(12, 0, 10));
  assert.equal(store.changeTimerSub(null, t(12, 0, 50)), 'サブを「なし」に変えました');
  assert.equal(store.data.records.length, 0);
  assert.equal(store.timer.subId, null);
  assert.equal(store.timer.startAt, t(12, 0, 10));
});
