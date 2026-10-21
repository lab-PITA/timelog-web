// 週間タブ：項目別の合計（企画書 4-4・6-4）
import { html, useState } from '../../vendor/preact-htm.js';
import { useStore, useSession } from '../context.js';
import { TopBar, DatePill, Empty, CalendarDialog } from '../components.js';
import { CategoryIcon } from '../icons.js';
import { DonutWithLabels, ProgressBar, WeekdayBarsDialog, weekLabels } from '../charts.js';
import { ShareSummary } from './share.js';
import { SubNote } from './today.js';
import { cssColor } from '../../data/colors.js';
import { logicalDate } from '../../domain/timecalc.js';
import { aggregate, weekStart as weekStartOf, weekRange } from '../../domain/stats.js';
import * as Format from '../../domain/format.js';

/** 表示中の週。offset は今週からいくつずらすか */
export function currentWeek(store, offset) {
  const today = logicalDate(Date.now(), store.settings.dayStartHour);
  return weekStartOf(today, store.settings.weekStart) + offset * 7;
}

export function WeekScreen() {
  const store = useStore();
  const [offset, setOffset] = useSession('weekOffset', 0);
  const [dialog, setDialog] = useState(null);
  const week = currentWeek(store, offset);
  const records = store.recordsInRange(weekRange(week, store.settings.dayStartHour));
  const stats = aggregate(records, week, 7, store.settings.dayStartHour);
  const sum = Math.max(stats.reduce((s, x) => s + x.totalMinutes, 0), 1);
  const max = Math.max(stats[0]?.totalMinutes ?? 0, 1);
  const rows = stats.map((stat) => ({ category: store.category(stat.categoryId), stat, percent: (stat.totalMinutes * 100) / sum }));
  const colorOf = (c) => (c ? cssColor(c.color) : 'var(--sub)');
  const slices = rows.map((r) => ({ color: colorOf(r.category), fraction: r.percent / 100, label: r.category?.name ?? '（不明）' }));
  const jumpTo = (day) => setOffset(offset + Math.floor((day - week) / 7));

  return html`<div class="screen">
    <${TopBar} title="週間" action="share" actionLabel="共有" onAction=${() => setDialog({ type: 'share' })} />
    <${DatePill} text=${Format.weekRange(week)} onPrev=${() => setOffset(offset - 1)} onNext=${() => setOffset(offset + 1)} onClick=${() => setDialog({ type: 'date' })} />
    <div class="scroll">
      ${rows.length === 0
        ? html`<${Empty} text="この週の記録はまだありません" />`
        : html`<div class="donut-wrap"><${DonutWithLabels} slices=${slices} /></div>
            ${rows.map(
              (row) => html`<button key=${row.stat.categoryId} class="bar-row" onClick=${() => setDialog({ type: 'detail', row })}>
                <span class="bar-row-head">
                  <${CategoryIcon} category=${row.category} size=${28} />
                  <b class="ellipsis grow">${row.category?.name ?? '（不明）'}</b>
                  <span class="value">${Format.duration(row.stat.totalMinutes)}</span>
                </span>
                <span class="bar-row-bar">
                  <${ProgressBar} fraction=${row.stat.totalMinutes / max} color=${colorOf(row.category)} />
                  <span class="bar-pct">${Format.percent1(row.percent)}</span>
                </span>
                ${row.stat.subMinutes > 0 && html`<span class="list-detail">うちサブ ${Format.duration(row.stat.subMinutes)}</span>`}
              </button>`,
            )}
            <${SubNote} />`}
    </div>
    ${dialog?.type === 'date' && html`<${CalendarDialog} initial=${week} onSelect=${jumpTo} onDismiss=${() => setDialog(null)} />`}
    ${dialog?.type === 'share' &&
    html`<${ShareSummary} title=${Format.weekRange(week)}
      totalLabel=${`合計 ${Format.duration(stats.reduce((s, x) => s + x.totalMinutes, 0))}（サブを含む）`}
      items=${rows.map((r) => ({ category: r.category, minutes: r.stat.totalMinutes, percent: r.percent }))} onDismiss=${() => setDialog(null)}>
      <${DonutWithLabels} slices=${slices} />
    <//>`}
    ${dialog?.type === 'detail' &&
    html`<${WeekdayBarsDialog} title=${`${dialog.row.category?.name ?? ''}　${Format.duration(dialog.row.stat.totalMinutes)}`}
      labels=${weekLabels(week)} minutes=${dialog.row.stat.perDay} subMinutes=${dialog.row.stat.perDaySub}
      color=${colorOf(dialog.row.category)} onDismiss=${() => setDialog(null)} />`}
  </div>`;
}
