// データのバックアップ（企画書 4-7）。Android 版 Backup.kt と同じ形式の JSON を読み書きする。
// Android 版で書き出したファイルをブラウザ版で読み込める（逆も可）。
import { isUntouchedSamples } from './seed.js';
import { THEME_COLORS } from './colors.js';
import { isoDate } from '../domain/dates.js';
import { logicalDate } from '../domain/timecalc.js';
import { recordSubRange } from '../domain/stats.js';
import * as Format from '../domain/format.js';

const APP_ID = 'com.labpita.timelog';
const FORMAT_VERSION = 1;

/** 読み込んだファイルがこのアプリのバックアップとして読めないとき */
export class BackupFormatError extends Error {}

/**
 * 読み込むと消えてしまうデータがあるか。
 * 記録・目標が1件でもある、または項目を初期状態から変えていれば true。
 */
export function hasUserData(data) {
  if (data.records.length > 0 || data.goals.length > 0) return true;
  return !isUntouchedSamples(data.categories);
}

export function exportJson(data, nowMs = Date.now()) {
  const s = data.settings;
  return JSON.stringify(
    {
      app: APP_ID,
      version: FORMAT_VERSION,
      exportedAt: nowMs,
      settings: { dayStartHour: s.dayStartHour, weekStart: s.weekStart, themeColor: s.themeColor },
      categories: [...data.categories]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        .map((c) => ({ id: c.id, name: c.name, color: c.color, icon: c.icon, sortOrder: c.sortOrder, isArchived: c.isArchived })),
      records: [...data.records]
        .sort((a, b) => a.startAt - b.startAt || a.id - b.id)
        .map((r) => ({
          id: r.id,
          categoryId: r.categoryId,
          startAt: r.startAt,
          endAt: r.endAt,
          subCategoryId: r.subCategoryId ?? null,
          subStartAt: r.subStartAt ?? null,
          subEndAt: r.subEndAt ?? null,
          memo: r.memo ?? null,
          createdAt: r.createdAt,
        })),
      goals: [...data.goals]
        .sort((a, b) => a.weekStart - b.weekStart || a.id - b.id)
        .map((g) => ({ id: g.id, categoryId: g.categoryId, weekStart: g.weekStart, targetMinutes: g.targetMinutes, type: g.type, includeSub: g.includeSub })),
    },
    null,
    2,
  );
}

/** 読み取れない値があったときに投げる（あとでまとめて「読み取れませんでした」にする） */
class ParseError extends Error {}

const int = (o, key) => {
  const v = o?.[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ParseError(key);
  return Math.trunc(v);
};
const intOrNull = (o, key) => (o[key] == null ? null : int(o, key));
const str = (o, key) => {
  if (typeof o?.[key] !== 'string') throw new ParseError(key);
  return o[key];
};
const bool = (o, key, fallback) => (typeof o[key] === 'boolean' ? o[key] : fallback);
const array = (o, key) => {
  if (!Array.isArray(o?.[key])) throw new ParseError(key);
  return o[key];
};

/**
 * バックアップのファイルを読み取って確かめる。ここではまだデータを入れ替えない
 * （壊れたファイルで今のデータが消えないように）。
 */
export function parseBackup(text) {
  let root;
  try {
    root = JSON.parse(text);
  } catch {
    throw new BackupFormatError('ファイルの中身を読み取れませんでした');
  }
  if (root == null || typeof root !== 'object' || root.app !== APP_ID) throw new BackupFormatError('タイムログのバックアップファイルではありません');
  if (typeof root.version === 'number' && root.version > FORMAT_VERSION) {
    throw new BackupFormatError('新しいバージョンのアプリで作られたファイルです。アプリを更新してください');
  }
  try {
    const categories = array(root, 'categories').map((o) => ({
      id: int(o, 'id'),
      name: str(o, 'name'),
      color: int(o, 'color') | 0,
      icon: str(o, 'icon'),
      sortOrder: int(o, 'sortOrder'),
      isArchived: bool(o, 'isArchived', false),
    }));
    const records = array(root, 'records').map((o) => ({
      id: int(o, 'id'),
      categoryId: int(o, 'categoryId'),
      startAt: int(o, 'startAt'),
      endAt: int(o, 'endAt'),
      subCategoryId: intOrNull(o, 'subCategoryId'),
      subStartAt: intOrNull(o, 'subStartAt'),
      subEndAt: intOrNull(o, 'subEndAt'),
      memo: o.memo == null ? null : str(o, 'memo'),
      createdAt: int(o, 'createdAt'),
    }));
    const goals = (Array.isArray(root.goals) ? root.goals : []).map((o) => {
      const type = str(o, 'type');
      if (type !== 'AT_LEAST' && type !== 'AT_MOST') throw new ParseError('type');
      return {
        id: int(o, 'id'),
        categoryId: int(o, 'categoryId'),
        weekStart: int(o, 'weekStart'),
        targetMinutes: int(o, 'targetMinutes'),
        type,
        includeSub: bool(o, 'includeSub', true),
      };
    });
    // 同じ週・同じ項目の目標は1つだけ（Android 版と同じく、後のものは無視する）
    const seen = new Set();
    const uniqueGoals = goals.filter((g) => {
      const key = `${g.categoryId}/${g.weekStart}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    let settings = null;
    if (root.settings && typeof root.settings === 'object') {
      const o = root.settings;
      const dayStartHour = typeof o.dayStartHour === 'number' ? o.dayStartHour : 3;
      const weekStart = typeof o.weekStart === 'number' && o.weekStart >= 1 && o.weekStart <= 7 ? o.weekStart : 1;
      settings = { dayStartHour, weekStart, themeColor: THEME_COLORS[o.themeColor] ? o.themeColor : 'GREEN' };
    }
    return { settings, categories, records, goals: uniqueGoals };
  } catch (e) {
    if (e instanceof ParseError) throw new BackupFormatError('ファイルの中身を読み取れませんでした');
    throw e;
  }
}

/** カンマ・改行・ダブルクォートを含む値は "" で囲む */
export function csvField(value) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** 記録のCSV。Excelで文字化けしないよう先頭にBOMを付ける */
export function exportCsv(data) {
  const dayStartHour = data.settings.dayStartHour;
  const names = new Map(data.categories.map((c) => [c.id, c.name]));
  const rows = [...data.records]
    .sort((a, b) => a.startAt - b.startAt || a.id - b.id)
    .map((r) => {
      const sub = recordSubRange(r);
      return [
        isoDate(logicalDate(r.startAt, dayStartHour)),
        Format.time(r.startAt),
        Format.time(r.endAt),
        String(Math.floor((r.endAt - r.startAt) / 60_000)),
        names.get(r.categoryId) ?? '',
        r.subCategoryId != null ? names.get(r.subCategoryId) ?? '' : '',
        sub ? Format.time(sub.start) : '',
        sub ? Format.time(sub.end) : '',
        sub ? String(Math.floor((sub.end - sub.start) / 60_000)) : '',
        r.memo ?? '',
      ];
    });
  const header = ['日付', '開始', '終了', '分', '項目', 'サブ項目', 'サブ開始', 'サブ終了', 'サブ分', 'メモ'];
  return '﻿' + [header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
