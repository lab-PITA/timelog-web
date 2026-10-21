// 初回起動時のサンプル項目（企画書 4-6）。Android 版と同じ並び・色・アイコン。
import { CATEGORY_COLORS as C } from './colors.js';

export const SAMPLES = [
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
