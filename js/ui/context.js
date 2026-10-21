// 画面全体で共有するもの（ストア・画面の移動・お知らせ）。起動時に app.js が中身を入れる。
import { useEffect, useReducer, useState } from '../vendor/preact-htm.js';

export const app = {
  /** data/store.js のストア */
  store: null,
  /** サブ画面を開く：{ name: 'recordEdit', id } など */
  open: (route) => {},
  /** サブ画面を閉じる */
  back: () => {},
  /** 画面下に短いお知らせを出す */
  toast: (message) => {},
  /** Android の Chrome で「ホーム画面に追加」を出すためのもの（使えないときは null） */
  installPrompt: null,
};

/** ストアが変わったら画面を描き直す */
export function useStore() {
  const [, rerender] = useReducer((n) => n + 1, 0);
  useEffect(() => app.store.subscribe(rerender), []);
  return app.store;
}

/** 今の時刻。intervalMs ごと（分なら分の変わり目）に更新する */
export function useNow(intervalMs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let timer;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      timer = setTimeout(tick, intervalMs - (t % intervalMs) + 50);
    };
    timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 50);
    // 画面に戻ってきたら（iPhone は裏にいる間タイマーが止まる）すぐ更新する
    const onVisible = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

/** タブを切り替えても入力中の内容を覚えておく状態（Android 版の ViewModel の代わり） */
const session = new Map();

export function useSession(key, initial) {
  const [, rerender] = useReducer((n) => n + 1, 0);
  if (!session.has(key)) session.set(key, typeof initial === 'function' ? initial() : initial);
  const set = (update) => {
    const prev = session.get(key);
    session.set(key, typeof update === 'function' ? update(prev) : update);
    rerender();
  };
  return [session.get(key), set];
}

/** 入力中の内容を忘れる（データの読み込み後など） */
export function clearSession() {
  session.clear();
}
