// データの保存と読み書き。Android 版の Room（項目・記録・目標）・DataStore（設定）・タイマーの状態をまとめて持つ。
// 全データを1つのオブジェクトとしてメモリに置き、変更のたびにブラウザの中（IndexedDB）へ丸ごと保存する。
// 項目・記録・目標の形は Android 版のテーブルと同じ（バックアップ JSON をそのまま読み書きできるように）。
import { sampleCategories } from './seed.js';
import { truncateToMinute, overlaps, range } from '../domain/timecalc.js';
import * as Format from '../domain/format.js';

export const DEFAULT_SETTINGS = { dayStartHour: 3, weekStart: 1, themeColor: 'GREEN' };

/** 途中解除の記録に付けるメモ（Android 版との互換のため残す） */
export const EARLY_EXIT_MEMO = '途中解除';

function initialData() {
  return {
    categories: sampleCategories(),
    records: [],
    goals: [],
    settings: { ...DEFAULT_SETTINGS },
    /** 目標を最後に引き継いだ週（エポック日数） */
    lastCarriedWeek: null,
    /** 計測中のタイマー（なければ null） */
    timer: null,
    /** 「ホーム画面に追加」の案内を閉じたか */
    installHintClosed: false,
  };
}

const nextId = (list) => list.reduce((max, x) => Math.max(max, x.id), 0) + 1;
const byOrder = (a, b) => a.sortOrder - b.sortOrder || a.id - b.id;
const byStart = (a, b) => a.startAt - b.startAt || a.id - b.id;

/**
 * タイマーを記録にする。開始・終了は分に切り捨てる。1分に満たないときは null。
 * サブ項目は記録全体にかける。
 */
export function timerToRecord(timer, nowMs, earlyExit = false) {
  const start = truncateToMinute(timer.startAt);
  const end = truncateToMinute(nowMs);
  if (end <= start) return null;
  return {
    categoryId: timer.categoryId,
    startAt: start,
    endAt: end,
    subCategoryId: timer.subId ?? null,
    subStartAt: timer.subId != null ? start : null,
    subEndAt: timer.subId != null ? end : null,
    memo: earlyExit ? EARLY_EXIT_MEMO : null,
    createdAt: nowMs,
  };
}

/**
 * ストアを作る。backend は { load(): Promise<object|null>, save(data): Promise<void> }。
 * ブラウザでは IndexedDB、テストではメモリを使う。
 */
export function createStore(backend) {
  let data = initialData();
  const listeners = new Set();
  let saving = Promise.resolve();
  let onSaved = () => {};

  const notify = () => listeners.forEach((fn) => fn());

  /** 変更を保存する。保存は順番に行い、最後の状態が必ず残るようにする */
  function commit() {
    const snapshot = JSON.parse(JSON.stringify(data));
    notify();
    saving = saving
      .then(() => backend.save(snapshot))
      .then(() => {
        store.saveError = null;
        onSaved();
      })
      .catch((e) => {
        store.saveError = e;
        notify();
      });
    return saving;
  }

  const store = {
    saveError: null,

    /** 保存してある内容を読み込む。初めてなら初期の項目16個を入れる */
    async load() {
      const raw = await backend.load();
      if (raw) {
        data = { ...initialData(), ...raw, settings: { ...DEFAULT_SETTINGS, ...raw.settings } };
        notify();
      } else {
        data = initialData();
        await commit();
      }
    },

    /** ほかのタブで変更されたときなどに、保存してある内容を読み直す */
    async reload() {
      const raw = await backend.load();
      if (raw) {
        data = { ...initialData(), ...raw, settings: { ...DEFAULT_SETTINGS, ...raw.settings } };
        notify();
      }
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** 保存が終わったときに呼ぶ（ほかのタブへの知らせに使う） */
    setOnSaved(fn) {
      onSaved = fn;
    },

    /** 保存が終わるまで待つ */
    flush: () => saving,

    get data() {
      return data;
    },

    get settings() {
      return data.settings;
    },

    // ---- 項目 ----

    /** すべての項目（並び順） */
    categories() {
      return [...data.categories].sort(byOrder);
    },

    category(id) {
      return data.categories.find((c) => c.id === id) ?? null;
    },

    addCategory(name, color, icon) {
      const sortOrder = data.categories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
      const category = { id: nextId(data.categories), name, color, icon, sortOrder, isArchived: false };
      data.categories.push(category);
      commit();
      return category.id;
    },

    updateCategory(category) {
      data.categories = data.categories.map((c) => (c.id === category.id ? { ...category } : c));
      commit();
    },

    reorderCategories(idsInOrder) {
      const order = new Map(idsInOrder.map((id, i) => [id, i]));
      data.categories = data.categories.map((c) => (order.has(c.id) ? { ...c, sortOrder: order.get(c.id) } : c));
      commit();
    },

    // ---- 記録 ----

    /** 範囲 [from, to) に少しでもかかる記録（開始順） */
    recordsInRange(r) {
      return data.records.filter((x) => x.startAt < r.end && x.endAt > r.start).sort(byStart);
    },

    /** 時間が重なる記録 */
    overlapping(r, excludeId = 0) {
      return data.records.filter((x) => x.id !== excludeId && overlaps(range(x.startAt, x.endAt), r)).sort(byStart);
    },

    /** before 以前に終わった記録のうち、いちばん遅い終了時刻 */
    latestEndBefore(before) {
      let latest = null;
      for (const r of data.records) if (r.endAt <= before && (latest == null || r.endAt > latest)) latest = r.endAt;
      return latest;
    },

    record(id) {
      return data.records.find((r) => r.id === id) ?? null;
    },

    addRecord(record) {
      const saved = { ...record, id: nextId(data.records) };
      data.records.push(saved);
      commit();
      return saved.id;
    },

    updateRecord(record) {
      data.records = data.records.map((r) => (r.id === record.id ? { ...record } : r));
      commit();
    },

    deleteRecord(id) {
      data.records = data.records.filter((r) => r.id !== id);
      commit();
    },

    // ---- 目標 ----

    goalsForWeek(week) {
      return data.goals.filter((g) => g.weekStart === week).sort((a, b) => a.id - b.id);
    },

    /** 同じ週・同じ項目の目標があれば置き換える */
    saveGoal(goal) {
      const existing = data.goals.find((g) => g.categoryId === goal.categoryId && g.weekStart === goal.weekStart);
      if (existing) {
        data.goals = data.goals.map((g) => (g === existing ? { ...goal, id: existing.id } : g));
      } else {
        data.goals.push({ ...goal, id: nextId(data.goals) });
      }
      commit();
    },

    deleteGoal(id) {
      data.goals = data.goals.filter((g) => g.id !== id);
      commit();
    },

    /**
     * 新しい週になったら、前の週の目標を引き継ぐ（企画書 4-8）。
     * 一度引き継いだ週には二度と行わない（目標を全部消しても復活しないように）。
     */
    carryOverGoals(week) {
      if (data.lastCarriedWeek != null && week <= data.lastCarriedWeek) return;
      data.lastCarriedWeek = week;
      if (data.goals.some((g) => g.weekStart === week)) {
        commit();
        return;
      }
      const previous = data.goals.reduce((max, g) => (g.weekStart < week && (max == null || g.weekStart > max) ? g.weekStart : max), null);
      if (previous != null) {
        let id = nextId(data.goals);
        for (const g of this.goalsForWeek(previous)) data.goals.push({ ...g, id: id++, weekStart: week });
      }
      commit();
    },

    // ---- 設定 ----

    setSetting(key, value) {
      data.settings = { ...data.settings, [key]: value };
      commit();
    },

    closeInstallHint() {
      data.installHintClosed = true;
      commit();
    },

    // ---- タイマー ----

    get timer() {
      return data.timer;
    },

    /** 計測を始める。すでに計測中ならそのまま */
    startTimer(category, sub, nowMs = Date.now()) {
      if (data.timer) return data.timer;
      data.timer = {
        categoryId: category.id,
        categoryName: category.name,
        subId: sub?.id ?? null,
        subName: sub?.name ?? null,
        startAt: nowMs,
      };
      commit();
      return data.timer;
    },

    /** 計測を止めて記録を保存する。お知らせの文を返す（計測中でなければ null） */
    stopTimer(nowMs = Date.now()) {
      const timer = data.timer;
      if (!timer) return null;
      const record = timerToRecord(timer, nowMs);
      data.timer = null;
      if (record) data.records.push({ ...record, id: nextId(data.records) });
      commit();
      if (!record) return '1分未満のため記録しませんでした';
      return `${Format.range(range(record.startAt, record.endAt))} ${timer.categoryName} を記録しました`;
    },

    // ---- バックアップ ----

    /** 読み込んだバックアップで、項目・記録・目標・設定をすべて置き換える */
    replaceAll(parsed) {
      data = {
        ...data,
        categories: parsed.categories,
        records: parsed.records,
        goals: parsed.goals,
        settings: parsed.settings ? { ...parsed.settings } : data.settings,
      };
      return commit();
    },
  };
  return store;
}

/** テスト用：メモリに保存する */
export function memoryBackend(initial = null) {
  let saved = initial;
  return {
    load: async () => (saved ? JSON.parse(JSON.stringify(saved)) : null),
    save: async (d) => {
      saved = d;
    },
  };
}

