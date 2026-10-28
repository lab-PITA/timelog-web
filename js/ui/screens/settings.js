// 設定タブ（企画書 6-4）。参考の「その他」画面と同じ構成。
// Android 版にしかない項目（集中モード・バッテリーの案内、エラーの記録）の代わりに、使い方とホーム画面に追加する方法の案内を置く。
import { html, useState, useRef } from '../../vendor/preact-htm.js';
import { app, useStore, clearSession } from '../context.js';
import { TopBar, ChoiceDialog, Dialog } from '../components.js';
import { Icon } from '../icons.js';
import { THEME_COLORS } from '../../data/colors.js';
import { exportJson, exportCsv, parseBackup, hasUserData, BackupFormatError } from '../../data/backup.js';
import { calendarDate, isoDate } from '../../domain/dates.js';
import * as Format from '../../domain/format.js';

export const APP_VERSION = '1.2.2';

const DARK_MODES = { SYSTEM: '端末に合わせる', LIGHT: 'ライト', DARK: 'ダーク' };

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * ファイルを保存する。iPhone では共有の画面を出して「"ファイル"に保存」を選んでもらう
 * （ホーム画面から開いたアプリではダウンロードがうまく動かないことがあるため）。
 * 返り値：'shared' | 'downloaded' | 'cancelled'
 */
export async function saveFile(name, text, type) {
  const file = new File([text], name, { type });
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

const today = () => isoDate(calendarDate(Date.now()));

export function SettingsScreen() {
  const store = useStore();
  const settings = store.settings;
  const [dialog, setDialog] = useState(null);
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);

  const run = async (errorTitle, block) => {
    try {
      const m = await block();
      if (m) setMessage(m);
    } catch (e) {
      setMessage({
        title: errorTitle,
        body: e instanceof BackupFormatError ? e.message : `うまくいきませんでした。もう一度お試しください。\n（${e?.name ?? 'Error'}）`,
        error: true,
      });
    }
  };

  const savedBody = (how, text) =>
    how === 'shared' ? `${text}\n\n共有の画面で「"ファイル"に保存」を選んだ場合は、「ファイル」アプリに保存されています。` : text;

  const exportData = () =>
    run('書き出しに失敗しました', async () => {
      const how = await saveFile(`timelog-backup-${today()}.json`, exportJson(store.data), 'application/json');
      if (how === 'cancelled') return null;
      return { title: '書き出しました', body: savedBody(how, '機種変更のときは、このファイルを新しいスマホに移して、タイムログの「設定」→「データの読み込み」で読み込んでください。') };
    });
  const exportCsvFile = () =>
    run('CSV出力に失敗しました', async () => {
      const how = await saveFile(`timelog-records-${today()}.csv`, exportCsv(store.data), 'text/csv');
      if (how === 'cancelled') return null;
      return { title: 'CSVを出力しました', body: savedBody(how, 'Excel やスプレッドシートで開けます。') };
    });
  const pickFile = () => fileInput.current.click();
  const onFile = (e) => {
    const file = e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!file) return;
    run('読み込みに失敗しました', async () => {
      // 先にファイル全体を読み取って確かめてから入れ替える（壊れたファイルで今のデータが消えないように）
      const parsed = parseBackup(await file.text());
      await store.replaceAll(parsed);
      if (store.saveError) throw store.saveError;
      clearSession();
      return { title: '読み込みました', body: `項目 ${parsed.categories.length}件、記録 ${parsed.records.length}件、目標 ${parsed.goals.length}件を復元しました。` };
    });
  };

  const row = (icon, title, onClick, value) => html`<button class="setting-row" onClick=${onClick}>
    <${Icon} name=${icon} size=${28} color="var(--main)" />
    <span class="grow">${title}</span>
    ${value && html`<span class="sub">${value}</span>`}
  </button>`;

  return html`<div class="screen group-bg">
    <${TopBar} title="設定" />
    <div class="scroll">
      <div class="gap" />
      ${row('category', '項目の管理', () => app.open({ name: 'categories' }))}
      <div class="gap" />
      ${row('schedule', '1日の区切り時刻', () => setDialog('dayStart'), `${settings.dayStartHour}:00`)}
      ${row('date_range', '週の開始曜日', () => setDialog('weekStart'), `${Format.weekday(settings.weekStart)}曜日`)}
      ${row('palette', 'テーマカラー', () => setDialog('theme'), THEME_COLORS[settings.themeColor].label)}
      ${row('dark_mode', 'ライト／ダーク', () => setDialog('darkMode'), DARK_MODES[settings.darkMode] ?? DARK_MODES.SYSTEM)}
      <div class="gap" />
      ${row('info', '使い方', () => app.open({ name: 'help' }))}
      ${row('add_to_home_screen', 'ホーム画面に追加する方法', () => app.open({ name: 'installGuide' }))}
      <div class="gap" />
      ${row('upload', 'データの書き出し', exportData)}
      ${row('download', 'データの読み込み', () => (hasUserData(store.data) ? setDialog('import') : pickFile()))}
      ${row('table_chart', 'CSV出力', exportCsvFile)}
      <p class="version">タイムログ（ブラウザ版）${APP_VERSION}</p>
    </div>
    <input type="file" ref=${fileInput} class="hidden-input" onChange=${onFile} />

    ${dialog === 'dayStart' &&
    html`<${ChoiceDialog} title="1日の区切り時刻" note="この時刻より前の記録は前日の分として扱います"
      options=${[0, 1, 2, 3, 4, 5, 6].map((h) => ({ value: h, label: `${h}:00` }))} selected=${settings.dayStartHour}
      onSelect=${(v) => store.setSetting('dayStartHour', v)} onDismiss=${() => setDialog(null)} />`}
    ${dialog === 'weekStart' &&
    html`<${ChoiceDialog} title="週の開始曜日" options=${[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: `${Format.weekday(d)}曜日` }))}
      selected=${settings.weekStart} onSelect=${(v) => store.setSetting('weekStart', v)} onDismiss=${() => setDialog(null)} />`}
    ${dialog === 'theme' &&
    html`<${ChoiceDialog} title="テーマカラー"
      options=${Object.entries(THEME_COLORS).map(([key, t]) => ({ value: key, label: t.label, leading: html`<span class="swatch" style=${{ background: t.main }} />` }))}
      selected=${settings.themeColor} onSelect=${(v) => store.setSetting('themeColor', v)} onDismiss=${() => setDialog(null)} />`}
    ${dialog === 'darkMode' &&
    html`<${ChoiceDialog} title="ライト／ダーク" note="「端末に合わせる」は、スマホのダークモードの設定に従います"
      options=${Object.entries(DARK_MODES).map(([value, label]) => ({ value, label }))} selected=${settings.darkMode ?? 'SYSTEM'}
      onSelect=${(v) => store.setSetting('darkMode', v)} onDismiss=${() => setDialog(null)} />`}
    ${dialog === 'import' &&
    html`<${Dialog} title="データを読み込みますか？" onDismiss=${() => setDialog(null)} buttons=${[
      { text: 'やめる', onClick: () => setDialog(null) },
      { text: 'ファイルを選ぶ', bold: true, onClick: () => { setDialog(null); pickFile(); } },
    ]}>
      <p>読み込むと、今のアプリの項目・記録・目標・設定は、すべてファイルの内容に置き換わります。</p>
      <p>次の画面で、「データの書き出し」で保存したファイル（timelog-backup-…json）を選んでください。</p>
    <//>`}
    ${message &&
    html`<${Dialog} title=${message.title} titleClass=${message.error ? 'warning' : ''} onDismiss=${() => setMessage(null)}
      buttons=${[{ text: 'OK', bold: true, onClick: () => setMessage(null) }]}>
      ${message.body.split('\n\n').map((p) => html`<p>${p}</p>`)}
    <//>`}
  </div>`;
}
