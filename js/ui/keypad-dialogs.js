// 後から入力・記録の編集で、開始・終了・時間をテンキーで入れるダイアログ。
// Android 版 ui/components/KeypadDialogs.kt に対応する（上下スワイプのホイールの代わり）。
import { html, useState } from '../vendor/preact-htm.js';
import { Dialog, Keypad } from './components.js';
import { DAY_MINUTES, floorMod } from '../domain/dates.js';
import * as TimeInput from '../domain/timeinput.js';
import * as Format from '../domain/format.js';

/**
 * 開始と終了を1つの画面で入れるダイアログ。first は最初の入力先（'start' | 'end'）。
 * 終了が開始以前なら翌日とみなす（23:30〜0:30 など。同じ時刻なら24時間）。
 */
export function TimeRangeDialog({ title, initialStart, initialEnd, first = 'start', onConfirm, onDismiss }) {
  const [target, setTarget] = useState(first);
  const [buffers, setBuffers] = useState({ start: '', end: '' });
  // まだ何も入れていない欄は元の時刻のまま
  const value = (key) => (buffers[key] === '' ? (key === 'start' ? initialStart : initialEnd) : TimeInput.parse(buffers[key]));
  const start = value('start');
  const end = value('end');
  const valid = start != null && end != null;
  const duration = valid ? floorMod(end - start, DAY_MINUTES) || DAY_MINUTES : 0;

  const digit = (d) => {
    const next = TimeInput.append(buffers[target], d);
    setBuffers({ ...buffers, [target]: next });
    // 開始の欄に4桁入れたら、終了の欄に進む
    if (target === 'start' && next.length === TimeInput.MAX_DIGITS) setTarget('end');
  };
  const field = (key, label) => {
    const text = buffers[key] === '' ? Format.clock(key === 'start' ? initialStart : initialEnd) : TimeInput.display(buffers[key]);
    return html`<button class="time-field ${target === key ? 'highlighted' : ''} ${buffers[key] === '' ? 'placeholder' : ''}"
      aria-label=${label} onClick=${() => setTarget(key)}>${text}</button>`;
  };

  return html`<${Dialog} title=${title} onDismiss=${onDismiss} buttons=${[
    { text: 'キャンセル', onClick: onDismiss },
    { text: 'OK', bold: true, disabled: !valid, onClick: () => onConfirm(start, end) },
  ]}>
    <div class="time-fields">
      <div class="time-col"><span class="time-field-label">開始</span>${field('start', '開始')}</div>
      <span class="time-tilde">〜</span>
      <div class="time-col"><span class="time-field-label">終了</span>${field('end', '終了')}</div>
    </div>
    <p class="range-duration ${valid ? '' : 'warning'}">
      ${valid ? `時間 ${Format.duration(duration)}${end <= start ? '（終了は翌日）' : ''}` : '時刻が正しくありません（例：1420 → 14:20）'}
    </p>
    <${Keypad} compact onDigit=${digit} extraLabel="クリア"
      onExtra=${() => setBuffers({ ...buffers, [target]: '' })}
      onDelete=${() => setBuffers({ ...buffers, [target]: TimeInput.remove(buffers[target]) })} />
  <//>`;
}

/** 時間（分）をテンキーで入れるダイアログ */
export function DurationDialog({ title, initialMinutes, onConfirm, onDismiss }) {
  const [buffer, setBuffer] = useState('');
  const minutes = buffer === '' ? initialMinutes : parseInt(buffer, 10);
  const valid = minutes >= 1 && minutes <= DAY_MINUTES;
  const digit = (d) => {
    const next = (buffer + d).replace(/^0+/, '');
    // 1回の記録は最大24時間（1440分）
    if (next.length > 4 || (parseInt(next, 10) || 0) > DAY_MINUTES) return;
    setBuffer(next);
  };
  return html`<${Dialog} title=${title} onDismiss=${onDismiss} buttons=${[
    { text: 'キャンセル', onClick: onDismiss },
    { text: 'OK', bold: true, disabled: !valid, onClick: () => onConfirm(minutes) },
  ]}>
    <div class="duration-value"><b class=${buffer === '' ? 'placeholder' : ''}>${minutes}</b> 分</div>
    <p class="range-duration ${valid ? '' : 'warning'}">${valid ? Format.duration(minutes) : '1〜1440分（24時間）で入れてください'}</p>
    <${Keypad} compact onDigit=${digit} extraLabel="クリア" onExtra=${() => setBuffer('')} onDelete=${() => setBuffer(buffer.slice(0, -1))} />
  <//>`;
}
