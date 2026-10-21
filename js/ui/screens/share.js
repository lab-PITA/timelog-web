// 共有用のまとめ画面（企画書 6-4）。全画面に、グラフと項目別の時間を1画面に収めて表示する。
// スクリーンショットは依頼者が自分で撮る（画像の自動保存はしない）。
import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { Icon, CategoryIcon } from '../icons.js';
import * as Format from '../../domain/format.js';

/** 案内の文字を出しておく時間（スクリーンショットに写らないよう消す） */
const HINT_MILLIS = 1_000;

/** items：[{ category, minutes, percent }] */
export function ShareSummary({ title, totalLabel, items, onDismiss, children }) {
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), HINT_MILLIS);
    return () => clearTimeout(timer);
  }, []);
  return html`<div class="share">
    <button class="icon-btn sub share-close" aria-label="閉じる" onClick=${onDismiss}><${Icon} name="close" /></button>
    <p class="share-app">タイムログ</p>
    <h2 class="share-title">${title}</h2>
    <p class="share-total">${totalLabel}</p>
    ${items.length === 0
      ? html`<div class="empty grow">記録はまだありません</div>`
      : html`<div class="share-chart">${children}</div>
          <div class="share-grid">
            ${items.map(
              (item) => html`<div class="share-cell">
                <${CategoryIcon} category=${item.category} size=${20} />
                <span class="ellipsis share-name">${item.category?.name ?? '（不明）'}</span>
                <span class="share-value"><b>${Format.duration(item.minutes)}</b><small>${Format.percent1(item.percent)}</small></span>
              </div>`,
            )}
          </div>`}
    <div class="share-hint ${showHint ? '' : 'hidden'}">この画面をスクリーンショットして共有できます</div>
  </div>`;
}
