// 初回起動時のサンプル項目（企画書 4-6）。誰でも使いやすい一般的な16個。
// アイコンはすべて別のもの。色は12色なので4色だけ2回使い、上下左右で同じ色が隣り合わないように並べる。
// アイコン名は Android 版にもあるものだけを使う（バックアップを Android 版で読み込んでも表示できるように）。
import { CATEGORY_COLORS as C } from './colors.js';

export const SAMPLES = [
  ['睡眠', C.NAVY, 'bed'],
  ['食事', C.ORANGE, 'restaurant'],
  ['仕事', C.BROWN, 'work'],
  ['勉強', C.RED, 'study'],
  ['移動', C.GRAY, 'train'],
  ['家事', C.MINT, 'cleaning'],
  ['風呂', C.CYAN, 'bath'],
  ['化粧', C.PINK, 'brush'],
  ['運動', C.GREEN, 'run'],
  ['休憩', C.LAVENDER, 'cafe'],
  ['スマホ', C.PURPLE, 'smartphone'],
  ['動画', C.YELLOW, 'video'],
  ['ゲーム', C.RED, 'game'],
  ['読書', C.BROWN, 'book'],
  ['買い物', C.ORANGE, 'shopping'],
  ['趣味', C.GREEN, 'art'],
];

/** 以前の初期項目（Android 版と同じ16個）。まだ何も使っていなければ新しい初期項目に入れ替える */
export const OLD_SAMPLES = [
  ['動画', C.PINK, 'video'],
  ['会計', C.YELLOW, 'calc'],
  ['授業', C.GREEN, 'school'],
  ['勉強', C.RED, 'study'],
  ['バイト', C.BROWN, 'work'],
  ['風呂', C.CYAN, 'bath'],
  ['移動', C.GRAY, 'train'],
  ['睡眠', C.NAVY, 'bed'],
  ['食事', C.ORANGE, 'restaurant'],
  ['家事', C.MINT, 'cleaning'],
  ['休憩', C.LAVENDER, 'cafe'],
  ['自分時間', C.PURPLE, 'private'],
  ['娯楽', C.CYAN, 'fun'],
  ['ゲーム', C.RED, 'game'],
  ['会話', C.GREEN, 'chat'],
  ['読書', C.BROWN, 'book'],
];

export function sampleCategories() {
  return SAMPLES.map(([name, color, icon], index) => ({ id: index + 1, name, color, icon, sortOrder: index, isArchived: false }));
}

/** 項目の一覧が、samples のとおりで何も変えていないか */
export function isUntouchedSamples(categories, samples = SAMPLES) {
  const current = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  if (current.length !== samples.length) return false;
  return current.every((c, i) => {
    const [name, color, icon] = samples[i];
    return c.name === name && c.color === color && c.icon === icon && !c.isArchived;
  });
}
