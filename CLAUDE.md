# タイムログ（ブラウザ版）

Android 版「タイムログ」1.0.0 を iPhone の Safari でも使えるようにしたブラウザ版（PWA＝ホーム画面に追加するとアプリのように使えるWebページ）。
仕様は Android 版と同じく、非公開リポジトリ `lab-PITA/time-manager` の `docs/SPEC.md`、引き継ぎ資料は同じリポジトリの `HANDOFF.md`。依頼者はプログラミング未経験なので、説明は日本語で、専門用語には一言説明を添える。

- **Android 版（`lab-PITA/time-manager`）は変えないこと。** 依頼者は Android 版を今のまま使い続ける
- 公開URL：https://lab-pita.github.io/timelog-web/ （GitHub Pages。`main` ブランチの中身がそのまま公開される）
- データは端末のブラウザの中（IndexedDB）だけに保存する。サーバー・ログイン・同期はなし
- バックアップ JSON は Android 版と同じ形式。お互いに書き出し・読み込みできる

## しくみ
- ビルド（変換）作業なし。このリポジトリの中身をそのまま静的サイトとして置けば動く
- 画面描画は Preact＋htm（`js/vendor/preact-htm.js`、htm 3.1.1 の standalone 版をそのまま置いている）
- アイコンは Material Symbols Outlined の SVG を `js/ui/icon-data.js` に埋め込み（オフラインで表示するため）
- `sw.js`（Service Worker）がファイルを端末に保存し、オフラインでも開けるようにする

## コマンド
- テスト：`npm test`（Node 22。日本時間で実行される）
  - `timecalc.test.js`・`stats.test.js`：Android 版の TimeCalcTest・StatsTest と同じ例
  - `data.test.js`：保存・バックアップ・CSV・タイマー（Android 版の BackupTest・TimerTest と同じ例）
  - `files.test.js`：`sw.js` の FILES にアプリのファイルがすべて入っているか
- 動作確認用サーバー：`npm run serve` → http://localhost:8080/

## 修正するときの決まり
- ファイルを変えたら `sw.js` の `VERSION` を上げる（上げないと、iPhone に古いファイルが残ったままになる）
- ファイルを増やしたら `sw.js` の `FILES` にも足す（`files.test.js` が確かめる）
- 版を上げるときは `js/ui/screens/settings.js` の `APP_VERSION` も合わせる
- 計算ルールは `js/domain/`（Android 版 `domain/` の TimeCalc・Stats・Format の移植）。Android 版と結果が変わらないようにする

## 構成
- `js/domain/`：日付（エポック日数）・時間計算・集計・表示の書式。画面に依存しない
- `js/data/`：ストア（全データを1つのオブジェクトで持ち、変更のたびに IndexedDB へ丸ごと保存）、バックアップ、色、初期項目
- `js/ui/`：共通パーツ（`components.js`）、グラフ（`charts.js`）、ホイール（`wheels.js`）、画面（`screens/`）
- `js/app.js`：起動、下部タブ、サブ画面の移動（ブラウザの「戻る」でも閉じる）、お知らせ、テーマカラー

## Android 版との違い
- タイマーの常駐通知・集中モード（画面の固定）はなし（ブラウザではできない）。開始時刻を保存しておき、開いたときに経過時間を計算して表示する
- 設定の「集中モードの準備」「バッテリー設定の案内」「エラーの記録」の代わりに「使い方」（`screens/help.js`）と「ホーム画面に追加する方法」（iPhone・Android 両方の手順）
- 初めて開いたときだけ簡単な使い方を出す（`introShown`）
- 初期の項目16個は一般向け（睡眠・食事・仕事・勉強・移動・家事・風呂・化粧・運動・休憩・スマホ・動画・ゲーム・読書・買い物・趣味）。アイコンは Android 版にもある名前だけを使う
  - 以前の初期項目（Android 版と同じ16個）のまま何も記録していなければ、開いたときに新しい初期項目へ入れ替える
- ファイルの保存は、iPhone では共有の画面（「"ファイル"に保存」）、それ以外はダウンロード
- カレンダーは日付を押すとすぐ決まる（OK ボタンなし）
