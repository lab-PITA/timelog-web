// 色（企画書 6-2）。項目の色は Android 版と同じく ARGB の32ビット整数（符号付き）で持つ。

/** テーマカラー。変わるのはメインカラーと淡いメインカラーの2色だけ */
export const THEME_COLORS = {
  GREEN: { label: 'グリーン', main: '#3BAA5C', light: '#E6F4EA' },
  CARROT: { label: 'キャロット', main: '#FF963C', light: '#FDF0E4' },
  BLUE: { label: 'ブルー', main: '#3A8FD9', light: '#E4F0FB' },
  PINK: { label: 'ピンク', main: '#EE6A9B', light: '#FDE8F0' },
  GRAY: { label: 'グレー', main: '#707070', light: '#EEEEEE' },
};

const argb = (rgb) => (0xff000000 | rgb) | 0;

/** 項目に使える12色 */
export const CATEGORY_COLORS = {
  ORANGE: argb(0xff8000),
  GREEN: argb(0x00b050),
  NAVY: argb(0x1e3a9e),
  PINK: argb(0xff4fa3),
  MINT: argb(0x4ccb7e),
  CYAN: argb(0x22c3d6),
  PURPLE: argb(0x9b1fb0),
  RED: argb(0xe60012),
  LAVENDER: argb(0xa64dff),
  YELLOW: argb(0xebb000),
  BROWN: argb(0x8b5a2b),
  GRAY: argb(0x7a7a7a),
};

export const CATEGORY_COLOR_LIST = Object.values(CATEGORY_COLORS);

/** ARGB の整数 → CSS の色（#RRGGBB） */
export function cssColor(color) {
  return '#' + ((color >>> 0) & 0xffffff).toString(16).padStart(6, '0');
}

/** 2色を割合 t で混ぜる（ダークモードの淡いメインカラー用） */
export function mix(from, to, t) {
  const p = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = p(from);
  const b = p(to);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** ダークモードの淡いメインカラー（企画書 6-6） */
export function darkLight(theme) {
  return theme === 'GREEN' ? '#1F3326' : mix('#121212', THEME_COLORS[theme].main, 0.22);
}
