// 共通パーツ（企画書 6-3）。Android 版 ui/components/Common.kt・Inputs.kt に対応する。
import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { Icon, CategoryIcon } from './icons.js';
import { epochDay, ymd, dayOfWeek, calendarDate } from '../domain/dates.js';

/** 上部バー：メインカラーで塗りつぶし。左に画面名、右にアイコンを1つまで */
export function TopBar({ title, onBack, action, actionLabel, onAction }) {
  return html`<header class="topbar">
    <div class="topbar-inner ${onBack ? 'has-back' : ''}">
      ${onBack && html`<button class="icon-btn" aria-label="戻る" onClick=${onBack}><${Icon} name="arrow_back" /></button>`}
      <h1 class="topbar-title">${title}</h1>
      ${action && html`<button class="icon-btn" aria-label=${actionLabel} onClick=${onAction}><${Icon} name=${action} size=${28} /></button>`}
    </div>
  </header>`;
}

/** 切替タブ：選択中はメインカラーの文字＋3pxの下線 */
export function SwitchTabs({ options, selected, onSelect }) {
  return html`<div class="switch-tabs" role="tablist">
    ${options.map(
      (label, i) => html`<button role="tab" aria-selected=${i === selected} class="switch-tab ${i === selected ? 'selected' : ''}"
        onClick=${() => onSelect(i)}>${label}</button>`,
    )}
  </div>`;
}

/** 文字列のおおよその幅（文字の高さ何個分か）。半角の数字は約0.6、日本語は1として数える */
function textWidthEm(text) {
  return [...text].reduce((w, c) => w + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
}

/** 日付ピル：＜ [ 2026年10月16日（金） 📅 ] ＞ */
export function DatePill({ text, subText, onPrev, onNext, onClick, small = false, showIcon = true }) {
  return html`<div class="date-pill-row">
    <button class="icon-btn sub" aria-label="前へ" onClick=${onPrev}><${Icon} name="chevron_left" /></button>
    <button class="date-pill ${small ? 'small' : ''}" onClick=${onClick}>
      <span class="date-pill-text" style=${small ? null : { '--em': textWidthEm(text) }}>${text}${subText && html`<small> ${subText}</small>`}</span>
      ${showIcon && html`<${Icon} name="calendar_month" color="var(--main)" />`}
    </button>
    <button class="icon-btn sub" aria-label="次へ" onClick=${onNext}><${Icon} name="chevron_right" /></button>
  </div>`;
}

/** 入力行：左にラベル、右に入力欄。下に区切り線 */
export function InputRow({ label, children }) {
  return html`<div class="input-row"><span class="input-label">${label}</span>${children}</div>`;
}

/** 淡いメインカラー・角丸12px・枠線なしの入力欄（タップで選択するタイプ） */
export function InputBox({ text, onClick, placeholder = false, highlighted = false, align = 'start', large = false, trailing }) {
  return html`<button class="input-box ${highlighted ? 'highlighted' : ''} ${placeholder ? 'placeholder' : ''} ${large ? 'large' : ''}"
    style=${{ textAlign: align }} onClick=${onClick}>
    <span class="input-box-text">${text}</span>${trailing}
  </button>`;
}

/** 淡いメインカラーの文字入力欄 */
export function TextField({ value, onInput, placeholder, maxLength }) {
  return html`<input class="text-field" type="text" value=${value} placeholder=${placeholder} maxLength=${maxLength}
    onInput=${(e) => onInput(e.currentTarget.value)} />`;
}

/** 主ボタン：横幅いっぱいのピル型 */
export function PrimaryButton({ text, onClick, disabled = false, danger = false }) {
  return html`<div class="primary-wrap">
    <button class="primary-btn ${danger ? 'danger' : ''}" disabled=${disabled} onClick=${onClick}>${text}</button>
  </div>`;
}

/** 項目タイルの4列グリッド */
export function CategoryGrid({ categories, selectedId, onSelect }) {
  return html`<div class="category-grid">
    ${categories.map(
      (c) => html`<button key=${c.id} class="tile ${c.id === selectedId ? 'selected' : ''}" onClick=${() => onSelect(c)}>
        <${CategoryIcon} category=${c} />
        <span class="tile-name">${c.name}</span>
      </button>`,
    )}
  </div>`;
}

/** 日付見出し：薄灰色の帯。左に日付、右に合計 */
export function DateHeader({ left, right }) {
  return html`<div class="date-header"><span>${left}</span><span>${right}</span></div>`;
}

/** 何もないときの表示 */
export function Empty({ text }) {
  return html`<div class="empty">${text}</div>`;
}

/** オン・オフのスイッチ */
export function Toggle({ checked, onChange, label }) {
  return html`<button class="toggle ${checked ? 'on' : ''}" role="switch" aria-checked=${checked} aria-label=${label}
    onClick=${() => onChange(!checked)}><span class="toggle-knob" /></button>`;
}

/** 電卓型テンキー。キーは項目タイルと同じスタイル */
export function Keypad({ onDigit, onDelete, onExtra, extraLabel = '前回から', compact = false }) {
  const key = (label, onClick, cls = '') => html`<button class="key ${cls}" onClick=${onClick}>${label}</button>`;
  return html`<div class="keypad ${compact ? 'compact' : ''}">
    ${[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => key(d, () => onDigit(d)))}
    ${key(extraLabel, onExtra, 'key-small')}
    ${key(0, () => onDigit(0))}
    ${key(html`<${Icon} name="backspace" aria-label="消去" />`, onDelete)}
  </div>`;
}

/** 記録リストの1行：アイコン　勉強　サブ:移動　　14:20〜14:50　30分 */
export function RecordRow({ category, detail, timeText, durationText, overlapped, onClick }) {
  return html`<button class="list-row" onClick=${onClick}>
    <${CategoryIcon} category=${category} />
    <span class="list-main">
      <span class="list-title"><b class="ellipsis">${category?.name ?? '（不明）'}</b>${overlapped && html`<span class="badge">重複</span>`}</span>
      ${detail && html`<span class="list-detail ellipsis">${detail}</span>`}
    </span>
    <span class="list-right"><span class="list-time">${timeText}</span><span class="list-value">${durationText}</span></span>
  </button>`;
}

/**
 * ダイアログ。buttons は [{ text, onClick, danger, bold }]（右から並ぶ順の逆＝左から順）。
 * 背景を押すと onDismiss。
 */
export function Dialog({ title, titleClass = '', children, buttons = [], onDismiss, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDismiss?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);
  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onDismiss?.()}>
    <div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      ${title && html`<h2 class="dialog-title ${titleClass}">${title}</h2>`}
      <div class="dialog-body">${children}</div>
      ${buttons.length > 0 &&
      html`<div class="dialog-buttons">
        ${buttons.map(
          (b) => html`<button class="text-btn ${b.danger ? 'danger' : ''} ${b.bold ? 'bold' : ''}" disabled=${b.disabled} onClick=${b.onClick}>${b.text}</button>`,
        )}
      </div>`}
    </div>
  </div>`;
}

/** 重なり警告（企画書 4-2）。上書きはせず、保存するか入力し直すかを選ぶ */
export function OverlapDialog({ conflicts, onSave, onRetry }) {
  return html`<${Dialog} title="時間が重なっています" titleClass="warning" onDismiss=${onRetry}
    buttons=${[{ text: '入力し直す', onClick: onRetry }, { text: 'このまま保存', onClick: onSave, bold: true }]}>
    <p>次の記録と時間が重なっています。</p>
    ${conflicts.slice(0, 5).map((c) => html`<p class="tight">・${c}</p>`)}
    ${conflicts.length > 5 && html`<p class="sub">ほか${conflicts.length - 5}件</p>`}
  <//>`;
}

/** サブ項目などを一覧から選ぶダイアログ。「なし」も選べる */
export function CategoryPickerDialog({ title, categories, selectedId, onSelect, onDismiss }) {
  const row = (key, icon, label, selected, onClick) => html`<button key=${key} class="picker-row ${selected ? 'selected' : ''}" onClick=${onClick}>
    ${icon}<span>${label}</span>
  </button>`;
  return html`<${Dialog} title=${title} onDismiss=${onDismiss} buttons=${[{ text: '閉じる', onClick: onDismiss }]}>
    ${row('none', html`<${Icon} name="block" size=${28} color="var(--sub)" />`, 'なし', selectedId == null, () => onSelect(null))}
    ${categories.map((c) => row(c.id, html`<${CategoryIcon} category=${c} size=${28} />`, c.name, selectedId === c.id, () => onSelect(c)))}
  <//>`;
}

/** 選択肢から1つ選ぶダイアログ（設定画面用） */
export function ChoiceDialog({ title, note, options, selected, onSelect, onDismiss }) {
  return html`<${Dialog} title=${title} onDismiss=${onDismiss} buttons=${[{ text: '閉じる', onClick: onDismiss }]}>
    ${note && html`<p class="sub small">${note}</p>`}
    ${options.map(
      (o) => html`<button key=${o.value} class="choice-row ${o.value === selected ? 'selected' : ''}" onClick=${() => {
        onSelect(o.value);
        onDismiss();
      }}>${o.leading}<span>${o.label}</span></button>`,
    )}
  <//>`;
}

/** カレンダーから日付を選ぶ。日付を押すとすぐ決まる */
export function CalendarDialog({ initial, onSelect, onDismiss }) {
  const first = ymd(initial);
  const [month, setMonth] = useState({ y: first.y, m: first.m });
  const today = calendarDate(Date.now());
  const start = epochDay(month.y, month.m, 1);
  const days = epochDay(month.m === 12 ? month.y + 1 : month.y, month.m === 12 ? 1 : month.m + 1, 1) - start;
  // 日曜はじまり（日〜土）
  const lead = dayOfWeek(start) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => start + i)];
  const shift = (n) => {
    const index = month.y * 12 + (month.m - 1) + n;
    setMonth({ y: Math.floor(index / 12), m: (index % 12) + 1 });
  };
  const color = (day) => {
    const dow = dayOfWeek(day);
    return dow === 7 ? 'sunday' : dow === 6 ? 'saturday' : '';
  };
  return html`<${Dialog} onDismiss=${onDismiss} buttons=${[
    { text: '今日', onClick: () => { onSelect(today); onDismiss(); } },
    { text: 'キャンセル', onClick: onDismiss },
  ]}>
    <div class="cal-head">
      <button class="icon-btn sub" aria-label="前の月" onClick=${() => shift(-1)}><${Icon} name="chevron_left" /></button>
      <b>${month.y}年${month.m}月</b>
      <button class="icon-btn sub" aria-label="次の月" onClick=${() => shift(1)}><${Icon} name="chevron_right" /></button>
    </div>
    <div class="cal-grid">
      ${['日', '月', '火', '水', '木', '金', '土'].map((w, i) => html`<span class="cal-week ${i === 0 ? 'sunday' : i === 6 ? 'saturday' : ''}">${w}</span>`)}
      ${cells.map((day, i) =>
        day == null
          ? html`<span key=${'e' + i} />`
          : html`<button key=${day} class="cal-day ${color(day)} ${day === today ? 'today' : ''} ${day === initial ? 'selected' : ''}"
              onClick=${() => { onSelect(day); onDismiss(); }}>${ymd(day).d}</button>`,
      )}
    </div>
  <//>`;
}

/** 左右スワイプを受け取る（今日タブで前後の日へ） */
export function swipeHandlers(onSwipe, threshold = 60) {
  let startX = null;
  let startY = null;
  return {
    onTouchStart: (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    },
    onTouchEnd: (e) => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null;
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}
