// テンキーでの時刻入力（後から入力・記録の編集）。Android 版 domain/TimeInput.kt と同じ。
// 電子レンジのタイマーのように右から詰めて入れる：1 → 0:01、14 → 0:14、142 → 1:42、1420 → 14:20。
// 4桁まで。時は0〜23、分は0〜59のときだけ時刻として使える。

export const MAX_DIGITS = 4;

export function append(buffer, digit) {
  return buffer.length >= MAX_DIGITS ? buffer : (buffer + digit).replace(/^0+/, '');
}

export function remove(buffer) {
  return buffer.slice(0, -1);
}

/** 入力中の数字を「14:20」の形にする（空なら null） */
export function display(buffer) {
  if (buffer === '') return null;
  const padded = buffer.padStart(MAX_DIGITS, '0');
  return `${parseInt(padded.slice(0, 2), 10)}:${padded.slice(2)}`;
}

/** 時刻として正しければ 0:00 からの分、空・範囲外なら null */
export function parse(buffer) {
  if (buffer === '') return null;
  const padded = buffer.padStart(MAX_DIGITS, '0');
  const hour = parseInt(padded.slice(0, 2), 10);
  const minute = parseInt(padded.slice(2), 10);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
