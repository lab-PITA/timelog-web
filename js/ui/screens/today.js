// 今日タブ：1日の円グラフと記録の一覧（企画書 4-3・6-4）
import { html, useState } from '../../vendor/preact-htm.js';
import { app, useStore, useSession } from '../context.js';
import { TopBar, SwitchTabs, DatePill, DateHeader, Empty, RecordRow, CalendarDialog, swipeHandlers } from '../components.js';
import { CategoryIcon } from '../icons.js';
import { DayClockChart } from '../charts.js';
import { ShareSummary } from './share.js';
import { cssColor } from '../../data/colors.js';
import * as T from '../../domain/timecalc.js';
import { aggregate, recordRange, recordSubRange } from '../../domain/stats.js';
import * as Format from '../../domain/format.js';

/** その日の円グラフ・一覧・合計をまとめて作る */
export function buildDay(store, day) {
  const dayStartHour = store.settings.dayStartHour;
  const dayRange = T.dayRange(day, dayStartHour);
  const records = store.recordsInRange(dayRange);

  // 一覧は新しい記録が上（開始が遅い順。同じなら後から作った記録が上）
  const timeline = [...records].sort((a, b) => b.startAt - a.startAt || b.id - a.id).map((r) => {
    const sub = r.subCategoryId != null ? store.category(r.subCategoryId) : null;
    const subRange = recordSubRange(r);
    const subText = sub ? `サブ:${sub.name}` + (subRange ? ` ${Format.duration(T.minutesOf(subRange))}` : '') : null;
    return {
      recordId: r.id,
      category: store.category(r.categoryId),
      detail: [subText, r.memo].filter(Boolean).join('　') || null,
      timeText: Format.range(recordRange(r)),
      minutes: T.minutesOf(T.intersect(recordRange(r), dayRange) ?? { start: 0, end: 0 }),
      overlapped: records.some((o) => o.id !== r.id && T.overlaps(recordRange(o), recordRange(r))),
    };
  });

  // 円グラフ：後から入力した記録を上に描くため、作成順に並べる
  const segment = (recordId, part, category, outer) => ({
    recordId,
    startMinute: T.toMinuteOfDay(part.start),
    minutes: T.minutesOf(part),
    color: category ? cssColor(category.color) : '#888888',
    outer,
  });
  const segments = [...records]
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
    .flatMap((r) => {
      const main = T.intersect(recordRange(r), dayRange);
      const subRange = recordSubRange(r);
      const sub = subRange && T.intersect(subRange, dayRange);
      return [
        main && segment(r.id, main, store.category(r.categoryId), false),
        sub && segment(r.id, sub, store.category(r.subCategoryId), true),
      ].filter(Boolean);
    });

  const stats = aggregate(records, day, 1, dayStartHour);
  const sum = Math.max(stats.reduce((s, x) => s + x.totalMinutes, 0), 1);
  const totals = stats.map((s) => ({ category: store.category(s.categoryId), minutes: s.totalMinutes, subMinutes: s.subMinutes, percent: (s.totalMinutes * 100) / sum }));

  const recordedMinutes = T.unionMinutes(records.map((r) => T.intersect(recordRange(r), dayRange)).filter(Boolean));
  return { timeline, segments, totals, recordedMinutes };
}

export function SubNote() {
  return html`<p class="note">※サブで行った時間も含むため、合計は実際の時間を超えることがあります</p>`;
}

export function TodayScreen() {
  const store = useStore();
  const today = T.logicalDate(Date.now(), store.settings.dayStartHour);
  // null の間は「今日」
  const [selected, setSelected] = useSession('todayDate', null);
  const [mode, setMode] = useSession('todayMode', 0);
  const [dialog, setDialog] = useState(null);
  const day = selected ?? today;
  const d = buildDay(store, day);
  const openRecord = (id) => app.open({ name: 'recordEdit', id });
  const shift = (n) => setSelected(day + n);

  return html`<div class="screen">
    <${TopBar} title="今日" action="share" actionLabel="共有" onAction=${() => setDialog('share')} />
    <${DatePill} text=${Format.fullDate(day)} onPrev=${() => shift(-1)} onNext=${() => shift(1)} onClick=${() => setDialog('date')} />
    <div class="scroll">
      <div class="chart-pad" ...${swipeHandlers(shift)}>
        <${DayClockChart} segments=${d.segments} centerTitle="記録済み" centerValue=${Format.duration(d.recordedMinutes)} onTapRecord=${openRecord} />
      </div>
      <${SwitchTabs} options=${['時系列', '項目別']} selected=${mode} onSelect=${setMode} />
      <${DateHeader} left=${Format.shortDate(day)} right=${`記録済み ${Format.duration(d.recordedMinutes)}`} />
      ${d.timeline.length === 0
        ? html`<${Empty} text="この日の記録はまだありません" />`
        : mode === 0
          ? d.timeline.map(
              (item) => html`<${RecordRow} key=${item.recordId} category=${item.category} detail=${item.detail} timeText=${item.timeText}
                durationText=${Format.duration(item.minutes)} overlapped=${item.overlapped} onClick=${() => openRecord(item.recordId)} />`,
            )
          : html`${d.totals.map((t) => html`<${TotalRow} key=${t.category?.id} total=${t} />`)}<${SubNote} />`}
    </div>
    ${dialog === 'date' && html`<${CalendarDialog} initial=${day} onSelect=${setSelected} onDismiss=${() => setDialog(null)} />`}
    ${dialog === 'share' &&
    html`<${ShareSummary} title=${Format.fullDate(day)} totalLabel=${`記録済み ${Format.duration(d.recordedMinutes)}`}
      items=${d.totals} onDismiss=${() => setDialog(null)}>
      <${DayClockChart} segments=${d.segments} centerTitle="記録済み" centerValue=${Format.duration(d.recordedMinutes)} maxWidth=${300} />
    <//>`}
  </div>`;
}

/** 項目別の1行：アイコン　勉強　　3時間20分　18.6% */
function TotalRow({ total }) {
  return html`<div class="list-row static">
    <${CategoryIcon} category=${total.category} />
    <span class="list-main">
      <b class="list-title ellipsis">${total.category?.name ?? '（不明）'}</b>
      ${total.subMinutes > 0 && html`<span class="list-detail">うちサブ ${Format.duration(total.subMinutes)}</span>`}
    </span>
    <span class="list-value big">${Format.duration(total.minutes)}</span>
    <span class="list-pct">${Format.percent1(total.percent)}</span>
  </div>`;
}
