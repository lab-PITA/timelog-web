// 画面の入口：データの読み込み、下部タブの5画面、サブ画面のつながり、お知らせ、テーマカラー。
// Android 版 ui/AppNavigation.kt・MainActivity.kt に対応する。
import { html, render, useState, useEffect } from './vendor/preact-htm.js';
import { app, useStore, useSession } from './ui/context.js';
import { Icon } from './ui/icons.js';
import { createStore } from './data/store.js';
import { browserBackend } from './data/idb.js';
import { THEME_COLORS, darkLight } from './data/colors.js';
import { RecordTab, EditRecordScreen } from './ui/screens/record.js';
import { TodayScreen } from './ui/screens/today.js';
import { WeekScreen } from './ui/screens/week.js';
import { GoalScreen, GoalEditScreen } from './ui/screens/goal.js';
import { SettingsScreen, InstallGuideScreen } from './ui/screens/settings.js';
import { CategoryListScreen, CategoryEditScreen } from './ui/screens/categories.js';

const TABS = [
  { label: '記録', icon: 'edit' },
  { label: '今日', icon: 'donut_large' },
  { label: '週間', icon: 'bar_chart' },
  { label: '目標', icon: 'flag' },
  { label: '設定', icon: 'more_horiz' },
];

const MESSAGE_MILLIS = 3_000;

/** テーマカラーを画面の色に反映する（ダークモードは端末の設定に合わせる） */
function applyTheme(themeColor) {
  const theme = THEME_COLORS[themeColor] ?? THEME_COLORS.GREEN;
  const root = document.documentElement.style;
  root.setProperty('--main', theme.main);
  root.setProperty('--main-light-day', theme.light);
  root.setProperty('--main-light-night', darkLight(themeColor));
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#1E1E1E' : theme.main);
}

function BottomTabBar({ selected, onSelect }) {
  return html`<nav class="tabbar">
    ${TABS.map(
      (t, i) => html`<button key=${t.label} class="tab ${i === selected ? 'selected' : ''}" aria-label=${t.label} onClick=${() => onSelect(i)}>
        <${Icon} name=${t.icon} size=${30} />
        ${i === selected && html`<span class="tab-label">${t.label}</span>`}
      </button>`,
    )}
  </nav>`;
}

function SubScreen({ route }) {
  switch (route.name) {
    case 'recordEdit':
      return html`<${EditRecordScreen} key=${route.id} id=${route.id} />`;
    case 'categories':
      return html`<${CategoryListScreen} />`;
    case 'categoryEdit':
      return html`<${CategoryEditScreen} key=${route.id ?? 'new'} id=${route.id} />`;
    case 'goalEdit':
      return html`<${GoalEditScreen} week=${route.week} />`;
    case 'installGuide':
      return html`<${InstallGuideScreen} />`;
    default:
      return null;
  }
}

function App() {
  const store = useStore();
  const [tab, setTab] = useSession('tab', 0);
  const [stack, setStack] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => applyTheme(store.settings.themeColor), [store.settings.themeColor]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(app.store.settings.themeColor);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // サブ画面の移動。ブラウザの「戻る」（iPhone の左端からのスワイプ）でも閉じられるよう履歴に積む
  app.open = (route) => {
    history.pushState({ depth: stack.length + 1 }, '');
    setStack((s) => [...s, route]);
  };
  app.back = () => history.back();
  useEffect(() => {
    const onPop = (e) => {
      const depth = e.state?.depth ?? 0;
      setStack((s) => s.slice(0, depth));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 後から入力の「記録しました」など、短いお知らせ
  app.toast = (message) => setToast({ message, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), MESSAGE_MILLIS);
    return () => clearTimeout(timer);
  }, [toast]);

  const route = stack[stack.length - 1];
  return html`
    <div class="main ${route ? 'covered' : ''}">
      <div class="tab-content">
        ${tab === 0 ? html`<${RecordTab} />` : tab === 1 ? html`<${TodayScreen} />` : tab === 2 ? html`<${WeekScreen} />` : tab === 3 ? html`<${GoalScreen} />` : html`<${SettingsScreen} />`}
      </div>
      <${BottomTabBar} selected=${tab} onSelect=${setTab} />
    </div>
    ${route && html`<div class="sub-screen"><${SubScreen} route=${route} /></div>`}
    ${toast && html`<div class="toast" key=${toast.id} onClick=${() => setToast(null)}>${toast.message}</div>`}
    ${store.saveError && html`<div class="save-error">保存できませんでした。空き容量を確認して、もう一度操作してください。</div>`}
  `;
}

async function main() {
  const backend = await browserBackend();
  app.store = createStore(backend);
  await app.store.load();
  // 最初の画面は履歴の0段目にしておく
  history.replaceState({ depth: 0 }, '');

  // 別のタブで変更されたら読み直す（同じデータを2つの画面で上書きし合わないように）
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('timelog');
    app.store.setOnSaved(() => channel.postMessage('saved'));
    channel.onmessage = () => app.store.reload();
  }

  render(html`<${App} />`, document.getElementById('app'));

  // データが勝手に消されないよう、ブラウザに頼んでおく（許可されるかはブラウザしだい）
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

main().catch((e) => {
  document.getElementById('app').innerHTML =
    '<p style="padding:24px;line-height:1.7">タイムログを開けませんでした。<br>プライベートブラウズを使っている場合は、通常のタブで開いてください。<br><small>' +
    String(e?.message ?? e) + '</small></p>';
});
