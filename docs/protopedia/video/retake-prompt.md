# 動画・画像 撮り直しランブック（AI エージェント用プロンプト）

> 使い方（人間）: このファイル全文を Claude Code に貼り付けて「実行して」と言うだけ。
> 以降はエージェントへの指示。

あなたはこのリポジトリ（Kizashi）のハッカソン提出動画の素材を、最新の UI・台本で撮り直すエージェントです。
以下を上から順に実行してください。判断に迷ったら**撮影を止めずに警告として報告**に回すのが原則です。

## 正とする資料（最初に読む）

- 台本: `docs/protopedia/video/script.md`（2分・7カット・パート対応表あり）
- 撮影ツール: `scripts/video-capture/`（README.md に前提・使い方・出力構造）

## Step 0 — ユーザー確認（1問だけ）

「台本の構成に響く大きな変更（シナリオ追加/廃止・UI 大改修・主張の変更）の予定はありますか？」と確認する。
- **ある** → 変更内容を聞き、台本の構成から相談（このランブックはそこで中断）。
- **ない/些細** → 以降を自動で進める。

## Step 1 — ドリフト検査（UI 文言 × 撮影スクリプト）

`capture.mjs` は data-testid が無いため以下の文言・構造に依存する。現行ソースに存在するか grep で確認し、
ズレていたら **capture.mjs 側を追従修正**する（UI は変えない）:

| 依存 | 使い所 |
| --- | --- |
| `/forecast` の `<article>`（RiskCard） | part1 カード待ち |
| 文言「今打てる先手」 | part1 先手ブロック |
| `aside[aria-label="反応的パイプラインへの案内"]`・リンク「アラート一覧を見る」 | part1 ブリッジCTA |
| デモ操作卓ボタン「インフラ障害（合成・反復用）」「脆弱性検知」（行クリックはパネル展開のみ・発火は展開後の`aria-label="<ラベル> を実行"`ボタン） | part2/3/4 シナリオ発火 |
| ボタン「承認」（exact）・「既知パターンへ昇格」 | part2/3 レビュー操作 |
| eventName `critical_log_entries`（3b） | part3 の対象 Alert 特定 |
| 予報カードの外部引用チップ `a[href^="http"]`（plan-1→PR #83 / pr-55→draft PR） | part1 カット2 の「証拠を開く」同一タブ遷移 |
| リンク「修正 PR を開く」（RemediationPanel・drafted 時） | part4 カット7 の draft PR 同一タブ遷移 |

あわせて台本のカット表と現行 UI の流れに乖離がないか（画面・遷移が実在するか）を確認する。

**証拠リンクの写り方（重要）**: 「証拠を開く」「修正 PR を開く」は実装上 `target=_blank`（別タブ）だが、
撮影スクリプトは (c) 方式＝**撮影時だけその要素の target を外し、本物のクリックで同一タブ遷移**させて
**本編 mp4 に PR を焼く**（別タブ popup を編集で差し込む必要はない・アプリのソースは無改変）。

## Step 2 — 台本ブラッシュアップ（構成は変えない）

`script.md` のナレーション・テロップを AI 審査員レンズで磨く。**制約**:
- 全体 2:00 以内・約300字/分（各カットの字数見積りを維持）
- カット構成・パート分割は変えない（変えたくなったらユーザーに相談）
- 事実ベースのみ: 実測数値だけ・「本番運用」等の示唆禁止・情緒演出（深夜オンコール調）禁止
- レンズ: 冒頭12秒で掴めるか（VC）／専門用語が掴みを殺していないか（UX）／
  ハルシネーション否定（引用検証・批判役）が言葉で立っているか（Principal Eng）／機能の列挙になっていないか（PM）

## Step 3 — 前提確認（撮影環境）

1. ローカル compose 起動確認（`curl http://localhost:3001/alerts` が 200）。未起動ならユーザーに起動を依頼
2. `GET /forecast` が 200（キャッシュ済み予報）を返すこと。404「未生成」なら:
   - リハ目的 → `POST /forecast`（ローカルは stub・課金なし）で生成してよい
   - **本番テイク** → 実 Gemini 突合が必要。ユーザーに F8 seed での再生成を確認
3. 予報の引用チップの解決先 URL（実PR / 過去Alert）を HTTP で疎通確認
4. `AI_INVESTIGATION_STUB=false`（実 Gemini）であること。本番テイクで stub は不可
5. `DRAFT_PR_URL`（AI 起票済み draft PR の URL）— **既定は PR #29（`https://github.com/nagoyamanaka/ec-monitoring-agent/pull/29`）が capture.mjs にハードコード済み**。差し替える場合のみ env で上書き
6. **カット7（part4）は調査完了（RemediationPanel が `drafted`）を待ってからアプリ内「修正 PR を開く」を押す**設計＝part4 が**約2分長くなる**（実 Gemini 調査を待つため）。リンクが出ない環境（remediation 未 drafted 等）は既定 #29 への直行にフォールバックする
7. **カット2（part1）は予報カードの外部チップ2本（plan-1→#83 / pr-55→draft）を順に同一タブで開いて /forecast へ戻る**。撮影前に両 href の疎通を確認（Step 3-3 の疎通確認に含める）

## Step 4 — 撮影実行

```bash
cd scripts/video-capture
pnpm run setup                      # 初回のみ（chromium + ffmpeg-static を取得）
RESET=1 node capture.mjs all       # draft PR は既定の PR #29 を使用（上書きは DRAFT_PR_URL=<URL> を前置）
```

出力は `output/takeNNN/`（自動採番）。パート本体は**編集用 H.264 mp4**（`partN-*.mp4`）で、
ロスレスな webm 源は `.raw/` に温存される。パート単位の撮り直しは
`TAKE=takeNNN node capture.mjs <scene>` で同テイクに追記できる。
ログに「mp4 変換 skip（ffmpeg 未検出）」が出たら `pnpm run setup` をやり直すか
`FFMPEG_PATH` を渡す（変換されないと webm のまま出て編集ソフトで読めない）。

## Step 5 — QA(スクショと API で目視・機械両面)

- 各 `screens/*/**.png` を開いて確認: 空白/エラーバナー/生 HTTP エラーの映り込みが無いか・
  合成入力バッジが出ているか（正直さの原則）・確信度と件数が不自然でないか
- `GET /alerts` で対象 Alert の `investigationReport.isFallback` が **false** であること。
  true（fallback テイク）なら該当パートを撮り直し
- NG パートのみ `TAKE=takeNNN node capture.mjs <scene>` で再撮影（learning は investigation とセットで）

## Step 6 — 台本の数値同期

テイク実物（確信度・根拠系統数・所要秒数など）と `script.md` の記述がズレていたら**台本側を実物に合わせて更新**する。

## Step 7 — 報告（ユーザーへ）

- テイクディレクトリのパスと、パート→カット対応・各 mp4 の長さ
- ProtoPedia 画像5枚の採用候補ファイル（台本の対応表に沿って）
- 台本を変更した場合はその差分要点
- 残る人間タスク: 採用スクショの `docs/protopedia/assets/` へのコピー＆コミット・
  合成音声の生成・ffmpeg 編集（倍速/結合/音声、コマンドは README）・YouTube アップロード
