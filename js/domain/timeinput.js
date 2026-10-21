// テンキーでの時刻入力（後から入力・記録の編集）。Android 版 domain/TimeInput.kt と同じ。
// 「時・時・分・分」の4桁を左から順に埋める：1 → 1-:--、12 → 12:--、123 → 12:3-、1234 → 12:34。
// 消すと右から1桁ずつ戻る（12:34 → 12:3- → 12:--）。
// ありえない数字は入らない（時の2桁目で24以上・分の1桁目で6以上になるとき）。
// 時の1桁目に3〜9を押したら、0を補って「09:--」にする。

export const MAX_DIGITS = 4;

export function append(buffer, digit) {
  switch (buffer.length) {
    case 0:
      return digit >= 3 ? `0${digit}` : `${digit}`;
    case 1:
      return parseInt(buffer, 10) * 10 + digit <= 23 ? buffer + digit : buffer;
    case 2:
      return digit <= 5 ? buffer + digit : buffer;
    case 3:
      return buffer + digit;
    default:
      return buffer;
  }
}

export function remove(buffer) {
  return buffer.slice(0, -1);
}

/** 入力中の数字を「12:3-」の形にする（空なら null） */
export function display(buffer) {
  if (buffer === '') return null;
  const p = buffer.padEnd(MAX_DIGITS, '-');
  return `${p[0]}${p[1]}:${p[2]}${p[3]}`;
}

/** 4桁そろっていれば 0:00 からの分、空・途中なら null */
export function parse(buffer) {
  if (buffer.length !== MAX_DIGITS) return null;
  return parseInt(buffer.slice(0, 2), 10) * 60 + parseInt(buffer.slice(2), 10);
}
