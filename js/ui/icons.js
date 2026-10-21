// 線画アイコン（Material Symbols Outlined）
import { html } from '../vendor/preact-htm.js';
import { CATEGORY_ICONS, UI_ICONS } from './icon-data.js';
import { cssColor } from '../data/colors.js';

/** 画面用のアイコン。color を省くと文字色 */
export function Icon({ name, size = 24, color, class: cls = '' }) {
  return html`<svg class="icon ${cls}" width=${size} height=${size} viewBox="0 0 24 24" fill=${color ?? 'currentColor'}
    aria-hidden="true" dangerouslySetInnerHTML=${{ __html: UI_ICONS[name] ?? UI_ICONS.label }} />`;
}

/** 項目のアイコン（項目の色で描く）。不明な名前は「ラベル」 */
export function CategoryIcon({ category, icon, color, size = 32 }) {
  const name = icon ?? category?.icon;
  const fill = color ?? (category ? cssColor(category.color) : 'var(--sub)');
  return html`<svg class="icon" width=${size} height=${size} viewBox="0 0 24 24" fill=${fill} aria-hidden="true"
    dangerouslySetInnerHTML=${{ __html: CATEGORY_ICONS[name] ?? UI_ICONS.label }} />`;
}
