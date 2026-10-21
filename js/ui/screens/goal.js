// 目標タブ（企画書 4-8・6-4）と目標の設定画面。参考の「予算」画面と同じ構成
import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { app, useStore, useSession } from '../context.js';
import { TopBar, DatePill, CalendarDialog, PrimaryButton, SwitchTabs, InputRow, InputBox, Toggle, CategoryGrid, Keypad } from '../components.js';
import { Icon, CategoryIcon } from '../icons.js';
import { ProgressBar, WeekdayBarsDialog, weekLabels } from '../charts.js';
import { currentWeek } from './week.js';
import { cssColor } from '../../data/colors.js';
import { aggregate, weekRange, goalProgress, statMinutes, statPerDay, weekElapsedFraction } from '../../domain/stats.js';
import * as Format from '../../domain/format.js';

/** 「◯時間以内」の注意色（企画書 4-8） */
const CAUTION_YELLOW = '#EBB000';
const ACHIEVED_GREEN = '#3BAA5C';

export const goalTypeText = (type, minutes) => Format.duration(minutes) + (type === 'AT_LEAST' ? '以上' : '以内');

export function GoalScreen() {
  const store = useStore();
  const [offset, setOffset] = useSession('goalOffset', 0);
  const [dialog, setDialog] = useState(null);

  // 新しい週になっていたら、前の週の目標を引き継ぐ
  useEffect(() => store.carryOverGoals(currentWeek(store, 0)), []);

  const now = Date.now();
  const week = currentWeek(store, offset);
  const range = weekRange(week, store.settings.dayStartHour);
  const stats = new Map(aggregate(store.recordsInRange(range), week, 7, store.settings.dayStartHour).map((s) => [s.categoryId, s]));
  const finished = now >= range.end;
  const pace = offset === 0 ? weekElapsedFraction(now, range) : null;
  const items = store.goalsForWeek(week).map((goal) => {
    const stat = stats.get(goal.categoryId);
    return {
      goal,
      category: store.category(goal.categoryId),
      progress: goalProgress(stat ? statMinutes(stat, goal.includeSub) : 0, goal.targetMinutes, goal.type, finished),
      subMinutes: goal.includeSub ? stat?.subMinutes ?? 0 : 0,
      perDay: stat ? statPerDay(stat, goal.includeSub) : Array(7).fill(0),
    };
  });
  const achieved = items.filter((i) => i.progress.achieved).length;
  const edit = () => app.open({ name: 'goalEdit', week });

  return html`<div class="screen">
    <${TopBar} title="目標" action="add" actionLabel="目標の設定" onAction=${edit} />
    <${DatePill} text=${Format.weekRange(week)} onPrev=${() => setOffset(offset - 1)} onNext=${() => setOffset(offset + 1)} onClick=${() => setDialog({ type: 'date' })} />
    ${items.length === 0
      ? html`<div class="goal-empty">
          <p>${offset === 0 ? '今週の目標を立てましょう' : 'この週の目標はありません'}</p>
          <${PrimaryButton} text="目標を追加" onClick=${edit} />
        </div>`
      : html`<div class="scroll">
          <div class="goal-summary">
            <div class="goal-summary-head"><span class="grow">達成</span><b class="goal-count">${achieved}</b><span>／${items.length}</span></div>
            <${ProgressBar} fraction=${achieved / items.length} color="var(--main)" />
          </div>
          ${items.map((item) => html`<${GoalRow} key=${item.goal.id} item=${item} pace=${pace} onClick=${() => setDialog({ type: 'detail', item })} />`)}
          <p class="note">※「◯時間以内」の目標は、週が終わった時点で超えていなければ達成に数えます</p>
        </div>`}
    ${dialog?.type === 'date' &&
    html`<${CalendarDialog} initial=${week} onSelect=${(day) => setOffset(offset + Math.floor((day - week) / 7))} onDismiss=${() => setDialog(null)} />`}
    ${dialog?.type === 'detail' &&
    html`<${WeekdayBarsDialog} title=${`${dialog.item.category?.name ?? ''}　実績 ${Format.duration(dialog.item.progress.actualMinutes)}`}
      labels=${weekLabels(week)} minutes=${dialog.item.perDay} color=${dialog.item.category ? cssColor(dialog.item.category.color) : 'var(--sub)'}
      onDismiss=${() => setDialog(null)} />`}
  </div>`;
}

/**
 *  📖 勉強（10時間以上）          残り 2時間30分
 *  ███████████████░░░░░│           75%
 *  実績 7時間30分（うちサブ 1時間）
 */
function GoalRow({ item, pace, onClick }) {
  const p = item.progress;
  const categoryColor = item.category ? cssColor(item.category.color) : 'var(--sub)';
  let right = '';
  let rightColor = 'var(--text)';
  if (p.over) {
    right = `超過 ${Format.duration(p.overMinutes)}`;
    rightColor = 'var(--warning)';
  } else if (!(p.type === 'AT_LEAST' && p.remainingMinutes === 0)) {
    right = `残り ${Format.duration(p.remainingMinutes)}`;
    if (p.nearLimit) rightColor = CAUTION_YELLOW;
  }
  return html`<button class="bar-row" onClick=${onClick}>
    <span class="bar-row-head">
      <${CategoryIcon} category=${item.category} size=${28} />
      <span class="ellipsis grow">${item.category?.name ?? '（不明）'}（${goalTypeText(p.type, p.targetMinutes)}）</span>
      <span class="goal-right ${p.over ? 'bold' : ''}" style=${{ color: rightColor }}>${right}</span>
    </span>
    <span class="bar-row-bar">
      <${ProgressBar} fraction=${p.percent / 100} color=${p.over ? 'var(--warning)' : categoryColor} marker=${pace}
        hatchedFraction=${p.targetMinutes > 0 ? item.subMinutes / p.targetMinutes : 0} />
      ${p.type === 'AT_LEAST' && p.achieved &&
      html`<span class="achieved"><${Icon} name="check_circle" size=${20} color=${ACHIEVED_GREEN} />達成</span>`}
      <b class="goal-pct" style=${{ color: p.over ? 'var(--warning)' : 'var(--text)' }}>${Math.round(p.percent)}%</b>
    </span>
    <span class="list-detail">実績 ${Format.duration(p.actualMinutes)}${item.subMinutes > 0 ? `（うちサブ ${Format.duration(item.subMinutes)}）` : ''}</span>
  </button>`;
}

// ---------------- 目標の設定 ----------------

const emptyGoalForm = () => ({ categoryId: null, type: 'AT_LEAST', hours: '', minutes: '', field: 'HOURS', includeSub: true });

/** 目標の設定画面：項目→種類→時間→サブを含めるか→保存 */
export function GoalEditScreen({ week }) {
  const store = useStore();
  const [f, setF] = useState(emptyGoalForm);
  const goals = store.goalsForWeek(week);
  const categories = store.categories().filter((c) => !c.isArchived);
  const targetMinutes = (parseInt(f.hours, 10) || 0) * 60 + (parseInt(f.minutes, 10) || 0);
  const canSave = f.categoryId != null && targetMinutes > 0;
  const editingExisting = goals.some((g) => g.categoryId === f.categoryId);

  /** 項目を選ぶ。すでに目標がある項目なら、その内容を読み込む */
  const select = (category) => {
    const existing = goals.find((g) => g.categoryId === category.id);
    if (existing) {
      setF({
        ...emptyGoalForm(),
        categoryId: category.id,
        type: existing.type,
        hours: Math.floor(existing.targetMinutes / 60) > 0 ? String(Math.floor(existing.targetMinutes / 60)) : '',
        minutes: existing.targetMinutes % 60 > 0 ? String(existing.targetMinutes % 60) : '',
        includeSub: existing.includeSub,
      });
    } else {
      setF((x) => ({ ...x, categoryId: category.id }));
    }
  };
  const digit = (d) =>
    setF((x) => {
      const key = x.field === 'HOURS' ? 'hours' : 'minutes';
      const next = (x[key] + d).replace(/^0+/, '');
      // 1週間は168時間、分は59まで
      if ((parseInt(next, 10) || 0) > (x.field === 'HOURS' ? 168 : 59)) return x;
      return { ...x, [key]: next };
    });
  const del = () => setF((x) => (x.field === 'HOURS' ? { ...x, hours: x.hours.slice(0, -1) } : { ...x, minutes: x.minutes.slice(0, -1) }));
  const save = () => {
    if (!canSave) return;
    store.saveGoal({ categoryId: f.categoryId, weekStart: week, targetMinutes, type: f.type, includeSub: f.includeSub });
    setF(emptyGoalForm());
  };

  return html`<div class="screen">
    <${TopBar} title="目標の設定" onBack=${app.back} />
    <div class="scroll">
      <p class="caption">${Format.weekRange(week)} の目標</p>
      <p class="section-title">項目</p>
      <${CategoryGrid} categories=${categories} selectedId=${f.categoryId} onSelect=${select} />
      ${goals.length > 0 &&
      html`<p class="section-title">設定済みの目標</p>
        <div class="divider" />
        ${goals.map((goal) => {
          const category = store.category(goal.categoryId);
          return html`<div class="goal-set-row" key=${goal.id}>
            <button class="goal-set-main" onClick=${() => category && select(category)}>
              <${CategoryIcon} category=${category} size=${28} />
              <b class="ellipsis grow">${category?.name ?? '（不明）'}</b>
              <span>${goalTypeText(goal.type, goal.targetMinutes)}${goal.includeSub ? '' : '（サブ除く）'}</span>
            </button>
            <button class="icon-btn sub" aria-label="削除" onClick=${() => {
              store.deleteGoal(goal.id);
              if (f.categoryId === goal.categoryId) setF(emptyGoalForm());
            }}><${Icon} name="delete" /></button>
          </div>`;
        })}
        <p class="caption">行をタップすると変更できます</p>`}
      <div class="spacer" />
    </div>
    <div class="bottom-panel bordered">
      <${SwitchTabs} options=${['◯時間以上', '◯時間以内']} selected=${f.type === 'AT_LEAST' ? 0 : 1}
        onSelect=${(i) => setF((x) => ({ ...x, type: i === 0 ? 'AT_LEAST' : 'AT_MOST' }))} />
      <${InputRow} label="目標">
        <${InputBox} text=${f.hours} highlighted=${f.field === 'HOURS'} align="end" large onClick=${() => setF((x) => ({ ...x, field: 'HOURS' }))} />
        <span class="unit">時間</span>
        <${InputBox} text=${f.minutes} highlighted=${f.field === 'MINUTES'} align="end" large onClick=${() => setF((x) => ({ ...x, field: 'MINUTES' }))} />
        <span class="unit">分</span>
      <//>
      <${InputRow} label="サブ">
        <span class="grow">サブで行った時間も含める</span>
        <${Toggle} checked=${f.includeSub} label="サブで行った時間も含める" onChange=${(v) => setF((x) => ({ ...x, includeSub: v }))} />
      <//>
      <div class="gap8" />
      <${Keypad} onDigit=${digit} onDelete=${del} onExtra=${() => setF((x) => ({ ...x, hours: '', minutes: '', field: 'HOURS' }))} extraLabel="クリア" />
      <${PrimaryButton} text=${editingExisting ? '変更を保存' : '保存'} disabled=${!canSave} onClick=${save} />
    </div>
  </div>`;
}
