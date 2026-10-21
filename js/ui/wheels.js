// 上下にスワイプして数字を選ぶホイール（企画書 6-4：時刻の選択は時計型ではなくホイール）。
// Android 版 ui/components/Wheels.kt に対応する。
import { html, useState, useRef, useLayoutEffect, useEffect } from '../vendor/preact-htm.js';
import { Dialog } from './components.js';
import { DAY_MINUTES, floorMod } from '../domain/dates.js';
import * as Format from '../domain/format.js';

const ITEM = 44;
/** 上下ループさせるための繰り返し回数（止まったら真ん中の回に戻す） */
const REPS = 9;
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * 0〜count-1 を選ぶホイール。端まで行くと反対側につながる（59分の次は0分）。
 * 止まったときに onChange を呼ぶ。
 */
export function NumberWheel({ count, value, onChange, label = pad2 }) {
  const ref = useRef(null);
  const middle = Math.floor(REPS / 2) * count;
  const [center, setCenter] = useState(middle + value);
  const settleTimer = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useLayoutEffect(() => {
    ref.current.scrollTop = (middle + value) * ITEM;
  }, []);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const settle = () => {
    const el = ref.current;
    if (!el) return;
    const index = Math.round(el.scrollTop / ITEM);
    const v = floorMod(index, count);
    // 端に近づかないよう、同じ値の真ん中の回へ移す
    if (Math.abs(index - (middle + v)) >= count) el.scrollTop = (middle + v) * ITEM;
    setCenter(middle + v);
    onChangeRef.current(v);
  };

  const onScroll = () => {
    setCenter(Math.round(ref.current.scrollTop / ITEM));
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, 140);
  };

  return html`<div class="wheel">
    <div class="wheel-band" />
    <div class="wheel-scroll" ref=${ref} onScroll=${onScroll}>
      <div class="wheel-pad" />
      ${Array.from({ length: count * REPS }, (_, i) => html`<div key=${i} class="wheel-item ${i === center ? 'selected' : ''}"
        onClick=${() => ref.current.scrollTo({ top: i * ITEM, behavior: 'smooth' })}>${label(i % count)}</div>`)}
      <div class="wheel-pad" />
    </div>
  </div>`;
}

/** 時と分のホイール（例：14 : 20）。minute は 0:00 からの分 */
function TimeWheel({ minute, onChange }) {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return html`<div class="time-wheel">
    <${NumberWheel} count=${24} value=${h} label=${String} onChange=${(v) => onChange(v * 60 + (minute % 60))} />
    <span class="wheel-colon">:</span>
    <${NumberWheel} count=${60} value=${m} onChange=${(v) => onChange(Math.floor(minute / 60) * 60 + v)} />
  </div>`;
}

/**
 * 開始と終了を1つの画面で調整するダイアログ。
 * 終了が開始より前なら翌日とみなす（23:30〜0:30 など）。
 */
export function TimeRangeDialog({ title, initialStart, initialEnd, onConfirm, onDismiss }) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  // ホイールは止まったときに値を返すので、最新の値を ref でも持つ
  const latest = useRef({ start, end });
  latest.current = { start, end };
  const duration = floorMod(end - start, DAY_MINUTES) || DAY_MINUTES;
  return html`<${Dialog} title=${title} onDismiss=${onDismiss} buttons=${[
    { text: 'キャンセル', onClick: onDismiss },
    { text: 'OK', bold: true, onClick: () => onConfirm(latest.current.start, latest.current.end) },
  ]}>
    <div class="range-heads"><span>開始</span><span>終了</span></div>
    <div class="range-wheels">
      <${TimeWheel} minute=${start} onChange=${setStart} />
      <span class="range-tilde">〜</span>
      <${TimeWheel} minute=${end} onChange=${setEnd} />
    </div>
    <p class="range-duration">時間 ${Format.duration(duration)}${end <= start ? '（終了は翌日）' : ''}</p>
  <//>`;
}

/** 時間（◯時間◯分）を上下スワイプで選ぶダイアログ */
export function DurationDialog({ title, initialMinutes, onConfirm, onDismiss }) {
  const [hours, setHours] = useState(Math.min(Math.floor(initialMinutes / 60), 24));
  const [minutes, setMinutes] = useState(initialMinutes % 60);
  // 1回の記録は最大24時間
  const total = Math.min(hours * 60 + minutes, DAY_MINUTES);
  return html`<${Dialog} title=${title} onDismiss=${onDismiss} buttons=${[
    { text: 'キャンセル', onClick: onDismiss },
    { text: 'OK', bold: true, disabled: total <= 0, onClick: () => onConfirm(total) },
  ]}>
    <div class="duration-wheels">
      <div class="duration-wheel"><${NumberWheel} count=${25} value=${hours} label=${String} onChange=${setHours} /></div>
      <span>時間</span>
      <div class="duration-wheel"><${NumberWheel} count=${60} value=${minutes} onChange=${setMinutes} /></div>
      <span>分</span>
    </div>
  <//>`;
}
