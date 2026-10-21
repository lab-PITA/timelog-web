// グラフ。Android 版 ui/components/Charts.kt の形を SVG で描く。
import { html } from '../vendor/preact-htm.js';
import { Dialog } from './components.js';
import { DAY_MINUTES, ymd, dayOfWeek } from '../domain/dates.js';
import * as Format from '../domain/format.js';

/** 真上を0度として時計回りの角度 → 座標 */
function point(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

/** 円弧のパス（真上が0度・時計回り）。1周ぶんは半分ずつに分けて描く */
function arcPath(cx, cy, r, startDeg, sweepDeg) {
  if (sweepDeg >= 359.99) return arcPath(cx, cy, r, startDeg, 180) + ' ' + arcPath(cx, cy, r, startDeg + 180, 180);
  const [x1, y1] = point(cx, cy, r, startDeg);
  const [x2, y2] = point(cx, cy, r, startDeg + sweepDeg);
  const f = (n) => n.toFixed(2);
  return `M ${f(x1)} ${f(y1)} A ${r} ${r} 0 ${sweepDeg > 180 ? 1 : 0} 1 ${f(x2)} ${f(y2)}`;
}

/** 時計型グラフの寸法（Android 版の ClockGeometry と同じ比率。幅300で考える） */
const CLOCK = (() => {
  const size = 300;
  const subOuter = size / 2 - 24;
  const subWidth = 10;
  const subInner = subOuter - subWidth;
  const mainOuter = subInner - 4;
  const mainWidth = mainOuter * 0.36;
  return { size, c: size / 2, subOuter, subWidth, subRadius: subOuter - subWidth / 2, mainWidth, mainRadius: mainOuter - mainWidth / 2 };
})();

/**
 * 1日の時計型ドーナツグラフ（企画書 4-3・6-4）。
 * 内側の太いリング＝メイン、外側の細いリング＝サブ。記録のない時間は薄い灰色。
 * segments は描く順（後から入力した記録ほど後ろ＝上に描かれる）：[{ recordId, startMinute, minutes, color, outer }]
 */
export function DayClockChart({ segments, centerTitle, centerValue, onTapRecord, maxWidth }) {
  const { size, c } = CLOCK;
  const toDeg = (minute) => (minute / DAY_MINUTES) * 360;
  return html`<div class="clock" style=${maxWidth ? { maxWidth: `${maxWidth}px` } : null}>
    <svg viewBox="0 0 ${size} ${size}" class="clock-svg">
      <circle cx=${c} cy=${c} r=${CLOCK.mainRadius} fill="none" stroke="var(--empty)" stroke-width=${CLOCK.mainWidth} />
      ${segments.map((s) => {
        const [r, w] = s.outer ? [CLOCK.subRadius, CLOCK.subWidth] : [CLOCK.mainRadius, CLOCK.mainWidth];
        return html`<path class=${onTapRecord ? 'seg tappable' : 'seg'} d=${arcPath(c, c, r, toDeg(s.startMinute), toDeg(s.minutes))}
          fill="none" stroke=${s.color} stroke-width=${w} onClick=${onTapRecord && (() => onTapRecord(s.recordId))} />`;
      })}
      ${[0, 6, 12, 18].map((hour) => {
        const [x, y] = point(c, c, CLOCK.subOuter + 12, hour * 15);
        return html`<text x=${x} y=${y} class="clock-label" text-anchor="middle" dominant-baseline="central">${hour}</text>`;
      })}
      ${Array.from({ length: 24 }, (_, hour) => hour)
        .filter((hour) => hour % 6 !== 0)
        .map((hour) => {
          const [x1, y1] = point(c, c, CLOCK.subOuter + 1, hour * 15);
          const [x2, y2] = point(c, c, CLOCK.subOuter + 5, hour * 15);
          return html`<line x1=${x1} y1=${y1} x2=${x2} y2=${y2} stroke="var(--divider)" stroke-width="1" />`;
        })}
    </svg>
    <div class="clock-center"><span class="clock-title">${centerTitle}</span><b class="clock-value">${centerValue}</b></div>
  </div>`;
}

/**
 * 項目別の割合のドーナツグラフ。参考レポート画面と同じく、
 * 引き出し線で外側に「18.6%／勉強」を付ける（5%未満は省略）。slices：[{ color, fraction, label }]
 */
export function DonutWithLabels({ slices }) {
  const w = 360;
  const h = 280;
  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.min(h / 2 - 34, w / 2 - 96);
  const width = outer * 0.42;
  const radius = outer - width / 2;
  let start = 0;
  const parts = slices.map((s, i) => {
    const sweep = s.fraction * 360;
    const arc = html`<path key=${'a' + i} d=${arcPath(cx, cy, radius, start, sweep)} fill="none" stroke=${s.color} stroke-width=${width} />`;
    let label = null;
    if (s.fraction >= 0.05) {
      const mid = start + sweep / 2;
      const [x1, y1] = point(cx, cy, outer + 2, mid);
      const [x2, y2] = point(cx, cy, outer + 18, mid);
      const right = Math.sin((mid * Math.PI) / 180) >= -1e-9;
      const x3 = x2 + (right ? 22 : -22);
      const tx = right ? x3 + 4 : x3 - 4;
      const anchor = right ? 'start' : 'end';
      label = html`<g key=${'l' + i}>
        <polyline points="${x1},${y1} ${x2},${y2} ${x3},${y2}" fill="none" stroke=${s.color} stroke-width="1.5" />
        <text x=${tx} y=${y2 - 3} text-anchor=${anchor} class="donut-pct">${(s.fraction * 100).toFixed(1)} %</text>
        <text x=${tx} y=${y2 + 15} text-anchor=${anchor} class="donut-name">${s.label}</text>
      </g>`;
    }
    start += sweep;
    return [arc, label];
  });
  return html`<svg viewBox="0 0 ${w} ${h}" class="donut-svg">${parts.map((p) => p[0])}${parts.map((p) => p[1])}</svg>`;
}

/**
 * 横棒（太さ12px・角丸）。fraction は 0〜1（超えた分は満タン）。
 * marker を渡すと、その位置に細い縦線（今日までの目安）を引く。
 * hatchedFraction を渡すと、塗った部分の終わり側のその長さを斜線で描く（サブで行った時間）。
 */
export function ProgressBar({ fraction, color, marker = null, hatchedFraction = 0 }) {
  const total = Math.min(Math.max(fraction, 0), 1);
  const hatched = Math.min(Math.max(hatchedFraction, 0), total);
  const solidPct = total > 0 ? ((total - hatched) / total) * 100 : 0;
  return html`<div class="bar">
    <div class="bar-track">
      ${total > 0 &&
      html`<div class="bar-fill" style=${{ width: `max(${total * 100}%, 12px)`, '--bar-color': color }}>
        <div class="bar-solid" style=${{ width: `${solidPct}%` }} />
        ${hatched > 0 && html`<div class="bar-hatch" />`}
      </div>`}
    </div>
    ${marker != null && html`<div class="bar-marker" style=${{ left: `${Math.min(Math.max(marker, 0), 1) * 100}%` }} />`}
  </div>`;
}

/**
 * 曜日ごとの内訳（7本の縦棒）を出すダイアログ。
 * labels：[{ text, cls }]。subMinutes を渡すと、サブの分を薄い色で重ねて「うちサブ」も出す。
 */
export function WeekdayBarsDialog({ title, labels, minutes, color, subMinutes, onDismiss }) {
  const max = Math.max(...minutes, 1);
  const w = 300;
  const chartH = 158;
  const slot = w / minutes.length;
  const barW = slot * 0.55;
  return html`<${Dialog} title=${title} onDismiss=${onDismiss} buttons=${[{ text: '閉じる', onClick: onDismiss }]}>
    <svg viewBox="0 0 ${w} ${chartH + 22}" class="weekday-svg">
      ${minutes.map((m, i) => {
        const h = (chartH * m) / max;
        const sh = subMinutes ? (chartH * (subMinutes[i] ?? 0)) / max : 0;
        const x = slot * i + (slot - barW) / 2;
        return html`<g key=${i}>
          ${m > 0 && html`<rect x=${x} y=${chartH - h} width=${barW} height=${h} rx="4" fill=${color} />`}
          ${sh > 0 && html`<rect x=${x} y=${chartH - h} width=${barW} height=${sh} rx="4" fill="var(--bg)" fill-opacity="0.55" />`}
          <text x=${slot * i + slot / 2} y=${chartH + 17} text-anchor="middle" class="weekday-label ${labels[i].cls}">${labels[i].text}</text>
        </g>`;
      })}
      <line x1="0" y1=${chartH} x2=${w} y2=${chartH} stroke="var(--divider)" stroke-width="1" />
    </svg>
    <div class="weekday-list">
      ${minutes.map(
        (m, i) => html`<div class="weekday-row" key=${i}>
          <span class="weekday-name ${labels[i].cls}">${labels[i].text}</span>
          <span class="weekday-value">${Format.duration(m)}</span>
          ${subMinutes && subMinutes[i] > 0 && html`<span class="sub small">うちサブ ${Format.duration(subMinutes[i])}</span>`}
        </div>`,
      )}
    </div>
  <//>`;
}

/** 週の7日分のラベル（「月 12」）と色（土曜は青、日曜は赤） */
export function weekLabels(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = weekStart + i;
    const dow = dayOfWeek(day);
    return { text: `${Format.weekday(dow)} ${ymd(day).d}`, cls: dow === 6 ? 'saturday' : dow === 7 ? 'sunday' : '' };
  });
}
