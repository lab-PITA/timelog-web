// 項目の管理（企画書 4-6）：一覧（ドラッグで並べ替え）と、追加・編集（名前・色・アイコン・アーカイブ）
import { html, useState, useRef } from '../../vendor/preact-htm.js';
import { app, useStore } from '../context.js';
import { TopBar, PrimaryButton, InputRow, TextField } from '../components.js';
import { Icon, CategoryIcon } from '../icons.js';
import { CATEGORY_ICONS } from '../icon-data.js';
import { CATEGORY_COLORS, CATEGORY_COLOR_LIST, cssColor } from '../../data/colors.js';

const ROW_HEIGHT = 64;

/** 項目の一覧。右端のつまみを上下にドラッグして並べ替える */
export function CategoryListScreen() {
  const store = useStore();
  const all = store.categories();
  const active = all.filter((c) => !c.isArchived);
  const archived = all.filter((c) => c.isArchived);
  // ドラッグ中の並び（ドラッグしていないときは null）
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const order = drag ? drag.order : active;

  const onPointerDown = (e, id) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const state = { id, order: active, startY: e.clientY, offset: 0 };
    dragRef.current = state;
    setDrag({ ...state });
  };
  const onPointerMove = (e) => {
    const state = dragRef.current;
    if (!state) return;
    let offset = e.clientY - state.startY;
    let order = state.order;
    const index = order.findIndex((c) => c.id === state.id);
    if (offset > ROW_HEIGHT / 2 && index < order.length - 1) {
      order = [...order];
      order.splice(index + 1, 0, order.splice(index, 1)[0]);
      state.startY += ROW_HEIGHT;
      offset -= ROW_HEIGHT;
    } else if (offset < -ROW_HEIGHT / 2 && index > 0) {
      order = [...order];
      order.splice(index - 1, 0, order.splice(index, 1)[0]);
      state.startY -= ROW_HEIGHT;
      offset += ROW_HEIGHT;
    }
    state.order = order;
    state.offset = offset;
    setDrag({ ...state });
  };
  const onPointerUp = () => {
    const state = dragRef.current;
    if (!state) return;
    dragRef.current = null;
    setDrag(null);
    // アーカイブ済みの項目は後ろに並べたままにする
    store.reorderCategories([...state.order.map((c) => c.id), ...archived.map((c) => c.id)]);
  };

  const row = (c, handle, extra = {}) => html`<div key=${c.id} class="cat-row ${extra.cls ?? ''}" style=${extra.style}>
    <button class="cat-row-main" onClick=${() => app.open({ name: 'categoryEdit', id: c.id })}>
      <${CategoryIcon} category=${c} />
      <b class="ellipsis grow">${c.name}</b>
    </button>
    ${handle &&
    html`<span class="drag-handle" aria-label="並べ替え" onPointerDown=${(e) => onPointerDown(e, c.id)} onPointerMove=${onPointerMove}
      onPointerUp=${onPointerUp} onPointerCancel=${onPointerUp}><${Icon} name="drag_indicator" size=${32} color="var(--sub)" /></span>`}
  </div>`;

  return html`<div class="screen">
    <${TopBar} title="項目の管理" onBack=${app.back} />
    <div class="scroll">
      <p class="caption">右端の ⠿ を上下にドラッグすると並べ替えできます</p>
      ${order.map((c) =>
        row(c, true, drag?.id === c.id ? { cls: 'dragging', style: { transform: `translateY(${drag.offset}px)` } } : {}),
      )}
      ${archived.length > 0 &&
      html`<p class="group-label">アーカイブ済み（記録画面には表示されません）</p>
        ${archived.map((c) => row(c, false, { cls: 'archived' }))}`}
    </div>
    <${PrimaryButton} text="項目を追加" onClick=${() => app.open({ name: 'categoryEdit', id: null })} />
  </div>`;
}

/** 項目の追加・編集。id が null なら新規 */
export function CategoryEditScreen({ id }) {
  const store = useStore();
  const existing = id != null ? store.category(id) : null;
  const [f, setF] = useState(() =>
    existing ? { name: existing.name, color: existing.color, icon: existing.icon } : { name: '', color: CATEGORY_COLORS.GREEN, icon: 'book' },
  );
  const canSave = f.name.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    const name = f.name.trim();
    if (existing) store.updateCategory({ ...store.category(id), name, color: f.color, icon: f.icon });
    else store.addCategory(name, f.color, f.icon);
    app.back();
  };
  /** アーカイブ（非表示）／元に戻す。過去の記録はそのまま残る */
  const toggleArchive = () => {
    const c = store.category(id);
    store.updateCategory({ ...c, isArchived: !c.isArchived });
    app.back();
  };

  return html`<div class="screen">
    <${TopBar} title=${existing ? '項目を編集' : '項目を追加'} onBack=${app.back} />
    <div class="scroll">
      <${InputRow} label="名前">
        <${TextField} value=${f.name} placeholder="例：読書" maxLength=${20} onInput=${(name) => setF((x) => ({ ...x, name: name.slice(0, 20) }))} />
      <//>
      <p class="section-title">色</p>
      <div class="pick-grid">
        ${CATEGORY_COLOR_LIST.map(
          (color) => html`<button key=${color} class="color-dot" style=${{ background: cssColor(color) }} aria-label="色"
            onClick=${() => setF((x) => ({ ...x, color }))}>${color === f.color && html`<${Icon} name="check" color="#fff" />`}</button>`,
        )}
      </div>
      <p class="section-title">アイコン</p>
      <div class="pick-grid">
        ${Object.keys(CATEGORY_ICONS).map(
          (name) => html`<button key=${name} class="icon-cell ${name === f.icon ? 'selected' : ''}" onClick=${() => setF((x) => ({ ...x, icon: name }))}>
            <${CategoryIcon} icon=${name} color=${cssColor(f.color)} size=${30} />
          </button>`,
        )}
      </div>
      ${existing &&
      html`<button class="text-btn block ${existing.isArchived ? '' : 'danger'}" onClick=${toggleArchive}>
          ${existing.isArchived ? 'アーカイブから戻す' : 'アーカイブする（記録画面に表示しない）'}
        </button>
        <p class="caption">アーカイブしても、過去の記録は消えません。</p>`}
      <div class="spacer" />
    </div>
    <${PrimaryButton} text="保存" disabled=${!canSave} onClick=${save} />
  </div>`;
}
