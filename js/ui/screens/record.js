// 記録タブ：クイック／後から／タイマー（企画書 4-1・4-2・5-1・6-4）
import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { app, useStore, useNow, useSession } from '../context.js';
import {
  TopBar, SwitchTabs, InputRow, InputBox, TextField, PrimaryButton, CategoryGrid, Keypad,
  OverlapDialog, CategoryPickerDialog, CalendarDialog, DatePill, Dialog,
} from '../components.js';
import { Icon, CategoryIcon } from '../icons.js';
import { TimeRangeDialog, DurationDialog } from '../keypad-dialogs.js';
import { DAY_MINUTES, calendarDate } from '../../domain/dates.js';
import * as T from '../../domain/timecalc.js';
import { recordRange, recordSubRange } from '../../domain/stats.js';
import * as Format from '../../domain/format.js';

/** 記録後に「元に戻す」を表示する時間（企画書 4-1） */
const UNDO_MILLIS = 5_000;

const dropdown = html`<${Icon} name="arrow_drop_down" color="var(--sub)" />`;

/** 重なった記録を「14:20〜14:50 勉強」の形にする */
function describe(records) {
  return records.map((r) => `${Format.range(recordRange(r))} ${app.store.category(r.categoryId)?.name ?? ''}`);
}

export function RecordTab() {
  const store = useStore();
  // 計測中に開いたら、タイマーを表示する
  const [mode, setMode] = useSession('recordMode', () => (store.timer ? 2 : 0));
  return html`<div class="screen">
    <${TopBar} title="記録" action="edit" actionLabel="項目の管理" onAction=${() => app.open({ name: 'categories' })} />
    <${SwitchTabs} options=${['クイック', '後から', 'タイマー']} selected=${mode} onSelect=${setMode} />
    ${mode === 0 ? html`<${QuickRecord} />` : mode === 1 ? html`<${RecordForm} />` : html`<${TimerScreen} />`}
  </div>`;
}

// ---------------- クイック記録 ----------------

const emptyQuick = () => ({ categoryId: null, mainMinutes: '', subId: null, subMinutes: '', target: 'MAIN', notice: null });

function QuickRecord() {
  const store = useStore();
  const now = useNow(60_000);
  const [f, setF] = useSession('quick', emptyQuick);
  const [saved, setSaved] = useSession('quickSaved', null);
  const [pending, setPending] = useState(null);
  const [showSubPicker, setShowSubPicker] = useState(false);

  // 「元に戻す」は5秒で消す
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), Math.max(saved.until - Date.now(), 0));
    return () => clearTimeout(timer);
  }, [saved]);

  const categories = store.categories().filter((c) => !c.isArchived);
  const selected = store.category(f.categoryId);
  const sub = store.category(f.subId);
  const main = parseInt(f.mainMinutes, 10) || null;
  const subMinutes = f.subMinutes === '' ? null : parseInt(f.subMinutes, 10);
  const range = main > 0 ? T.quickRange(now, main) : null;
  const preview = range == null ? f.notice ?? '分数を入力してください' : `${Format.range(range)}　${selected ? selected.name : '項目を選んでください'}`;
  const subPreview = range && sub ? `サブ ${Format.range(T.subRangeEndAligned(range, subMinutes))}　${sub.name}` : null;
  const canSave = selected != null && range != null && (sub == null || subMinutes == null || (subMinutes >= 1 && subMinutes <= main));

  const digit = (d) =>
    setF((x) => {
      const key = x.target === 'MAIN' ? 'mainMinutes' : 'subMinutes';
      const next = (x[key] + d).replace(/^0+/, '');
      // 1回の記録は最大24時間（1440分）
      if (next.length > 4 || (parseInt(next, 10) || 0) > DAY_MINUTES) return x;
      return { ...x, [key]: next, notice: null };
    });
  const del = () =>
    setF((x) => {
      const key = x.target === 'MAIN' ? 'mainMinutes' : 'subMinutes';
      return { ...x, [key]: x[key].slice(0, -1) };
    });
  // 「前回から」キー：直前の記録の終了から今までの分数を入れる
  const fromLast = () => {
    const t = Date.now();
    const lastEnd = store.latestEndBefore(T.quickEnd(t));
    const minutes = T.minutesSinceLast(lastEnd, t);
    if (minutes == null) {
      // 押しても何も起きないと分かりにくいので、理由をプレビュー欄に出す
      const notice =
        lastEnd == null ? '前の記録がまだありません' : lastEnd >= T.quickEnd(t) ? '前の記録が今まで続いています' : '前の記録が24時間以上前のため使えません';
      setF((x) => ({ ...x, mainMinutes: '', notice, target: 'MAIN' }));
      return;
    }
    setF((x) => ({ ...x, mainMinutes: String(minutes), notice: null, target: 'MAIN' }));
  };

  const save = (record) => {
    const id = store.addRecord(record);
    setF(emptyQuick());
    setSaved({ recordId: id, message: `${Format.range(recordRange(record))} ${store.category(record.categoryId)?.name ?? ''} を記録しました`, until: Date.now() + UNDO_MILLIS });
  };

  const ok = () => {
    if (!canSave) return;
    const t = Date.now();
    const r = T.quickRange(t, main);
    const subRange = f.subId != null ? T.subRangeEndAligned(r, subMinutes) : null;
    const record = {
      categoryId: f.categoryId,
      startAt: r.start,
      endAt: r.end,
      subCategoryId: f.subId,
      subStartAt: subRange?.start ?? null,
      subEndAt: subRange?.end ?? null,
      memo: null,
      createdAt: t,
    };
    const conflicts = store.overlapping(r);
    if (conflicts.length === 0) save(record);
    else setPending({ record, conflicts: describe(conflicts) });
  };

  const undo = () => {
    if (!saved) return;
    store.deleteRecord(saved.recordId);
    setSaved(null);
  };

  return html`<div class="screen-body">
    <div class="scroll tiles-area">
      <${CategoryGrid} categories=${categories} selectedId=${f.categoryId} onSelect=${(c) => setF((x) => ({ ...x, categoryId: c.id }))} />
    </div>
    <div class="bottom-panel">
      <${InputRow} label="サブ">
        <${InputBox} text=${sub?.name ?? 'なし'} placeholder=${!sub} onClick=${() => setShowSubPicker(true)} trailing=${dropdown} />
      <//>
      ${sub &&
      html`<${InputRow} label="サブ時間">
        <${InputBox} text=${f.subMinutes || '全体'} placeholder=${!f.subMinutes} highlighted=${f.target === 'SUB'} align="end" large
          onClick=${() => setF((x) => ({ ...x, target: 'SUB' }))} />
        <span class="unit">分</span>
      <//>`}
      <${InputRow} label="時間">
        <${InputBox} text=${f.mainMinutes} highlighted=${!!sub && f.target === 'MAIN'} align="end" large
          onClick=${() => setF((x) => ({ ...x, target: 'MAIN' }))} />
        <span class="unit">分</span>
      <//>
      <div class="preview">
        ${saved
          ? html`<div class="undo-bar"><span class="ellipsis">${saved.message}</span><button class="text-btn bold" onClick=${undo}>元に戻す</button></div>`
          : html`<div class="preview-text ${canSave ? 'ready' : ''}">${preview}</div>${subPreview && html`<div class="preview-sub">${subPreview}</div>`}`}
      </div>
      <${Keypad} onDigit=${digit} onDelete=${del} onExtra=${fromLast} />
      <${PrimaryButton} text="OK" disabled=${!canSave} onClick=${ok} />
    </div>
    ${showSubPicker &&
    html`<${CategoryPickerDialog} title="サブ項目" categories=${categories} selectedId=${f.subId}
      onSelect=${(c) => {
        setF((x) => (c ? { ...x, subId: c.id } : { ...x, subId: null, subMinutes: '', target: 'MAIN' }));
        setShowSubPicker(false);
      }}
      onDismiss=${() => setShowSubPicker(false)} />`}
    ${pending &&
    html`<${OverlapDialog} conflicts=${pending.conflicts}
      onSave=${() => {
        const r = pending.record;
        setPending(null);
        save(r);
      }}
      onRetry=${() => setPending(null)} />`}
  </div>`;
}

// ---------------- 後から入力・記録の編集 ----------------

/** 新しい入力：直近30分（クイック記録と同じ終わり方） */
function newForm(dayStartHour) {
  const r = T.quickRange(Date.now(), 30);
  return {
    date: T.logicalDate(r.start, dayStartHour),
    start: T.toMinuteOfDay(r.start),
    end: T.toMinuteOfDay(r.end),
    categoryId: null,
    subId: null,
    subWhole: true,
    subStart: null,
    subEnd: null,
    memo: '',
    createdAt: 0,
  };
}

function formFromRecord(r, dayStartHour) {
  const sub = recordSubRange(r);
  return {
    date: T.logicalDate(r.startAt, dayStartHour),
    start: T.toMinuteOfDay(r.startAt),
    end: T.toMinuteOfDay(r.endAt),
    categoryId: r.categoryId,
    subId: r.subCategoryId,
    subWhole: sub == null || T.sameRange(sub, recordRange(r)),
    subStart: sub ? T.toMinuteOfDay(sub.start) : null,
    subEnd: sub ? T.toMinuteOfDay(sub.end) : null,
    memo: r.memo ?? '',
    createdAt: r.createdAt,
  };
}

/** 後から入力（企画書 4-2）と記録の編集で共用する。editId がなければ新規。 */
export function RecordForm({ editId = null, onFinished }) {
  const store = useStore();
  const dayStartHour = store.settings.dayStartHour;
  const [newF, setNewF] = useSession('later', () => newForm(dayStartHour));
  const [editF, setEditF] = useState(() => (editId != null && store.record(editId) ? formFromRecord(store.record(editId), dayStartHour) : null));
  const isEdit = editId != null;
  const f = isEdit ? editF : newF;
  const setF = isEdit ? setEditF : setNewF;
  const [dialog, setDialog] = useState(null);
  const [pending, setPending] = useState(null);
  const [noLast, setNoLast] = useState(false);

  if (!f) return html`<div class="empty">この記録は削除されています</div>`;

  const update = (patch) => setF((x) => ({ ...x, ...patch }));
  const mainRange = T.rangeFromTimes(f.date, f.start, f.end, dayStartHour);
  const sub = store.category(f.subId);
  const subRange = f.subId == null ? null : f.subWhole ? mainRange : f.subStart != null && f.subEnd != null ? T.subRangeWithin(mainRange, f.subStart, f.subEnd) : null;
  const error = sub && subRange == null ? 'サブの時間は記録の時間の範囲内にしてください' : null;
  const canSave = f.categoryId != null && error == null;
  const endNextDay = calendarDate(mainRange.end) !== calendarDate(mainRange.start);
  const minutes = T.minutesOf(mainRange);
  // アーカイブ済みの項目は、編集中の記録で使っているときだけ表示する
  const categories = store.categories().filter((c) => !c.isArchived || c.id === f.categoryId);

  const commit = (record) => {
    if (isEdit) {
      store.updateRecord(record);
      onFinished();
      return;
    }
    store.addRecord(record);
    // 続けて入力しやすいよう、次の開始を今回の終了にする
    setF((x) => ({ ...x, start: x.end, end: (x.end + 30) % DAY_MINUTES, categoryId: null, subId: null, subWhole: true, subStart: null, subEnd: null, memo: '' }));
    app.toast(`${Format.range(mainRange)} ${store.category(record.categoryId)?.name ?? ''} を記録しました`);
  };

  const save = () => {
    if (!canSave) return;
    const record = {
      id: editId ?? 0,
      categoryId: f.categoryId,
      startAt: mainRange.start,
      endAt: mainRange.end,
      subCategoryId: f.subId,
      subStartAt: subRange?.start ?? null,
      subEndAt: subRange?.end ?? null,
      memo: f.memo.trim() || null,
      createdAt: isEdit ? f.createdAt : Date.now(),
    };
    const conflicts = store.overlapping(mainRange, editId ?? 0);
    if (conflicts.length === 0) commit(record);
    else setPending({ record, conflicts: describe(conflicts) });
  };

  const subStart = f.subWhole ? f.start : f.subStart;
  const subEnd = f.subWhole ? f.end : f.subEnd;

  /**
   * 「前回の続きから」：開始を直前の記録の終わりに合わせる（時間の長さはそのまま）。
   * 選んでいる日の終わり（今日なら今）より前に終わった、いちばん新しい記録を使う。
   */
  const startFromLast = () => {
    const dayEnd = T.dayRange(f.date, dayStartHour).end;
    const lastEnd = store.latestEndBefore(Math.min(dayEnd, Date.now()));
    if (lastEnd == null) {
      setNoLast(true);
      return;
    }
    setNoLast(false);
    const start = T.toMinuteOfDay(lastEnd);
    update({ date: T.logicalDate(lastEnd, dayStartHour), start, end: (start + minutes) % DAY_MINUTES });
    // すぐに時間を入れられるようにする
    setDialog('duration');
  };

  return html`<div class="screen-body">
    <div class="scroll">
      ${!isEdit &&
      html`<button class="from-last-btn" onClick=${startFromLast}><${Icon} name="history" size=${22} color="var(--main)" />前回の続きから入力</button>
        ${noLast && html`<p class="form-error">前の記録がまだありません</p>`}`}
      <${InputRow} label="日付">
        <${DatePill} text=${Format.compactDate(f.date)} small showIcon=${false} onPrev=${() => update({ date: f.date - 1 })}
          onNext=${() => update({ date: f.date + 1 })} onClick=${() => setDialog('date')} />
      <//>
      <${InputRow} label="開始"><${InputBox} text=${Format.clock(f.start)} onClick=${() => setDialog({ type: 'main', first: 'start' })} /><//>
      <${InputRow} label="終了"><${InputBox} text=${Format.clock(f.end) + (endNextDay ? '（翌日）' : '')} onClick=${() => setDialog({ type: 'main', first: 'end' })} /><//>
      <${InputRow} label="時間"><${InputBox} text=${Format.duration(minutes)} onClick=${() => setDialog('duration')} /><//>
      <${InputRow} label="サブ">
        <${InputBox} text=${sub?.name ?? 'なし'} placeholder=${!sub} onClick=${() => setDialog('subPicker')} trailing=${dropdown} />
      <//>
      ${sub &&
      html`<${InputRow} label="サブ開始"><${InputBox} text=${subStart != null ? Format.clock(subStart) : ''} onClick=${() => setDialog({ type: 'sub', first: 'start' })} /><//>
        <${InputRow} label="サブ終了"><${InputBox} text=${subEnd != null ? Format.clock(subEnd) : ''} onClick=${() => setDialog({ type: 'sub', first: 'end' })} /><//>`}
      <${InputRow} label="メモ"><${TextField} value=${f.memo} placeholder="メモを追加" onInput=${(memo) => update({ memo })} /><//>
      ${error && html`<p class="form-error">${error}</p>`}
      <p class="section-title">項目</p>
      <${CategoryGrid} categories=${categories} selectedId=${f.categoryId} onSelect=${(c) => update({ categoryId: c.id })} />
      ${isEdit && html`<button class="text-btn danger block" onClick=${() => setDialog('delete')}>この記録を削除</button>`}
      <div class="spacer" />
    </div>
    <${PrimaryButton} text=${isEdit ? '保存する' : '記録する'} disabled=${!canSave} onClick=${save} />

    ${dialog === 'date' && html`<${CalendarDialog} initial=${f.date} onSelect=${(date) => update({ date })} onDismiss=${() => setDialog(null)} />`}
    ${dialog?.type === 'main' &&
    html`<${TimeRangeDialog} title="記録の時間" initialStart=${f.start} initialEnd=${f.end} first=${dialog.first} onDismiss=${() => setDialog(null)}
      onConfirm=${(start, end) => {
        update({ start, end });
        setDialog(null);
      }} />`}
    ${dialog === 'duration' &&
    html`<${DurationDialog} title="時間" initialMinutes=${minutes} onDismiss=${() => setDialog(null)}
      onConfirm=${(m) => {
        // 時間を変えると、開始はそのままで終了を動かす
        if (m >= 1 && m <= DAY_MINUTES) update({ end: (f.start + m) % DAY_MINUTES });
        setDialog(null);
      }} />`}
    ${dialog?.type === 'sub' &&
    html`<${TimeRangeDialog} title="サブの時間" initialStart=${subStart ?? f.start} initialEnd=${subEnd ?? f.end} first=${dialog.first} onDismiss=${() => setDialog(null)}
      onConfirm=${(start, end) => {
        // 記録全体と同じ時間なら「全体」のまま（記録の時間を変えるとサブも追従する）
        if (start === f.start && end === f.end) update({ subWhole: true, subStart: null, subEnd: null });
        else update({ subWhole: false, subStart: start, subEnd: end });
        setDialog(null);
      }} />`}
    ${dialog === 'subPicker' &&
    html`<${CategoryPickerDialog} title="サブ項目" categories=${categories.filter((c) => !c.isArchived)} selectedId=${f.subId}
      onSelect=${(c) => {
        update(c ? { subId: c.id } : { subId: null, subWhole: true, subStart: null, subEnd: null });
        setDialog(null);
      }}
      onDismiss=${() => setDialog(null)} />`}
    ${dialog === 'delete' &&
    html`<${Dialog} title="記録を削除しますか？" onDismiss=${() => setDialog(null)} buttons=${[
      { text: 'キャンセル', onClick: () => setDialog(null) },
      { text: '削除する', danger: true, onClick: () => { store.deleteRecord(editId); onFinished(); } },
    ]}><p>削除した記録は元に戻せません。</p><//>`}
    ${pending &&
    html`<${OverlapDialog} conflicts=${pending.conflicts}
      onSave=${() => {
        const r = pending.record;
        setPending(null);
        commit(r);
      }}
      onRetry=${() => setPending(null)} />`}
  </div>`;
}

/** 記録の編集画面（今日タブからタップで開く） */
export function EditRecordScreen({ id }) {
  return html`<div class="screen">
    <${TopBar} title="記録の編集" onBack=${app.back} />
    <${RecordForm} editId=${id} onFinished=${app.back} />
  </div>`;
}

// ---------------- タイマー ----------------

function TimerScreen() {
  const store = useStore();
  const [f, setF] = useSession('timer', { categoryId: null, subId: null });
  const [showSubPicker, setShowSubPicker] = useState(false);
  const running = store.timer;

  if (running) return html`<${RunningTimer} running=${running} />`;

  const categories = store.categories().filter((c) => !c.isArchived);
  const sub = store.category(f.subId);
  const start = () => {
    const category = store.category(f.categoryId);
    if (!category) return;
    store.startTimer(category, sub);
    // 次に使うときのために選択を戻す
    setF({ categoryId: null, subId: null });
  };

  return html`<div class="screen-body">
    <div class="scroll tiles-area">
      <${CategoryGrid} categories=${categories} selectedId=${f.categoryId} onSelect=${(c) => setF((x) => ({ ...x, categoryId: c.id }))} />
    </div>
    <div class="bottom-panel">
      <${InputRow} label="サブ">
        <${InputBox} text=${sub?.name ?? 'なし'} placeholder=${!sub} onClick=${() => setShowSubPicker(true)} trailing=${dropdown} />
      <//>
      <p class="hint">計測中にアプリを閉じても、計測は続きます。開き直すと経過時間が表示されます。</p>
      <${PrimaryButton} text="スタート" disabled=${f.categoryId == null} onClick=${start} />
    </div>
    ${showSubPicker &&
    html`<${CategoryPickerDialog} title="サブ項目" categories=${categories} selectedId=${f.subId}
      onSelect=${(c) => {
        setF((x) => ({ ...x, subId: c?.id ?? null }));
        setShowSubPicker(false);
      }}
      onDismiss=${() => setShowSubPicker(false)} />`}
  </div>`;
}

/** 計測中の表示：項目アイコンと名前、大きな経過時間、赤いストップ */
function RunningTimer({ running }) {
  const store = useStore();
  const now = useNow(1_000);
  const [showSubPicker, setShowSubPicker] = useState(false);
  const category = store.category(running.categoryId);
  const sessionStart = running.sessionStartAt ?? running.startAt;
  const stop = () => {
    const message = store.stopTimer();
    if (message) app.toast(message);
  };
  return html`<div class="screen-body running">
    <div class="running-center">
      <${CategoryIcon} category=${category} size=${72} color=${category ? undefined : 'var(--main)'} />
      <b class="running-name">${running.categoryName}</b>
      ${running.subName && html`<span class="sub">サブ：${running.subName}</span>`}
      ${running.subId != null && html`<button class="outline-pill" onClick=${() => setShowSubPicker(true)}>サブを変える</button>`}
      <b class="running-elapsed">${Format.elapsed(now - sessionStart)}</b>
      <span class="sub">${Format.time(sessionStart)} から計測中</span>
    </div>
    <${PrimaryButton} text="ストップ" danger onClick=${stop} />
    ${showSubPicker &&
    html`<${CategoryPickerDialog} title="サブ項目" categories=${store.categories().filter((c) => !c.isArchived)} selectedId=${running.subId}
      onSelect=${(c) => {
        setShowSubPicker(false);
        const message = store.changeTimerSub(c);
        if (message) app.toast(message);
      }}
      onDismiss=${() => setShowSubPicker(false)} />`}
  </div>`;
}
