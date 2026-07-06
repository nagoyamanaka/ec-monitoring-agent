# video-capture — 提出動画の素材テイク自動撮影

台本 [docs/protopedia/video/script.md](../../docs/protopedia/video/script.md)（2分・7カット）に対応する
**生テイク（.webm）と画面遷移ごとのスクリーンショット**を Playwright でパート単位に自動採取する。
ナレーション・テロップ・倍速加工は撮影後の編集工程（ffmpeg）で行う＝**尺合わせは録画側でやらない**。

撮り直しの定型運用は **[docs/protopedia/video/retake-prompt.md](../../docs/protopedia/video/retake-prompt.md)**
（AI エージェントに貼り付けるランブック）を参照。

本体 pnpm workspace には属さない独立パッケージ（`pnpm-workspace.yaml` 対象外）。
出力 `output/` は .gitignore 済み。**採用スクショのみ** `docs/protopedia/assets/` へコピーしてコミットする。

## セットアップ

```bash
cd scripts/video-capture
pnpm run setup   # pnpm install --ignore-workspace + chromium 取得
```

## 撮影前の前提（台本のチェックリストと同じ）

1. ローカル compose 起動済み: `docker compose -f docker-compose.yml -f docker-compose.local.yml up`
2. **実 Gemini 経路**（`.env.local` に Vertex 設定・`AI_INVESTIGATION_STUB=false`）。fallback が出たテイクは撮り直し
3. `FORECAST_ENABLED=true` かつ **予報は事前生成済み**（`GET /forecast` がキャッシュを返す状態。撮影中に POST しない）
4. 予報の引用チップ（実PR / plan / 過去Alert）を手でクリックしてリンク切れがないこと
5. `FORECAST_HORIZON` を具体日付にしておくと window 表示が具体化する（compose コメント参照）

## 使い方

```bash
node capture.mjs all             # 全パート順撮り → output/takeNNN/（新規テイク自動採番）
node capture.mjs forecast        # パート単位の撮り直し（これも新規テイクを切る）
TAKE=take003 node capture.mjs learning   # 既存テイクに追記（同名パートは上書き）
RESET=1 node capture.mjs investigation   # demo reset してから 3b 発火
DRAFT_PR_URL=https://github.com/... node capture.mjs dogfooding
```

| シーン | 出力パート | 台本カット | 内容 | 所要 |
| --- | --- | --- | --- | --- |
| `forecast` | `part1-forecast` | 1〜3前半 | 予報カード→引用→先手→ブリッジCTA | 〜1分 |
| `investigation` | `part2-investigation` | 3後半〜5 | 3b発火→着弾/未知→ADKライブ調査→レポート/証拠 | 〜3分（実調査込み） |
| `learning` | `part3-learning` | 5承認〜6 | 承認→既知へ昇格→3b再発火→即・既知の対比 | 〜1分 |
| `dogfooding` | `part4-dogfooding` | 7素材 | シナリオ4（脆弱性）→実 draft PR 提示 | 〜1分 |

**実行順序の制約**: `learning` は `investigation` が残した「調査済み・未レビューの 3b Alert」を
承認対象にするため、**直後に続けて実行**する（`all` はこの順で回る）。

環境変数: `FRONT_URL`（既定 http://localhost:5173）／`API_URL`（同 3001）／`TAKE`（既存テイクへ追記）／
`HEADED=1` ブラウザ表示／`SLOWMO`（ms・既定150）／`DWELL_SCALE`（間合い倍率・既定1）／`RESET=1`／`DRAFT_PR_URL`

## 出力

```
output/
  take001/                        # 実行ごとに自動採番（TAKE= で固定可）
    part1-forecast.webm           # パート本体（1920x1080）。外部タブは partN-*-popupM.webm
    part2-investigation.webm
    ...
    screens/part1-forecast/NN-<label>.png
    .raw/                         # Playwright の一時 webm（リネーム前）
```

ProtoPedia 紹介画像5枚の採用候補は台本の対応表を参照（part1 `01-forecast-card` / part2 `03-live-timeline`・
`05-evidence-panel` / part3 `01-known-instant`。アーキ図はスライドPNG）。

## 編集（ffmpeg の目安）

```bash
# カット4相当の倍速区間（例: 2倍速。×2 表示テロップは編集側で焼き込む）
ffmpeg -i take001/part2-investigation.webm -filter:v "setpts=PTS/2" -an part2-x2.webm

# 結合（同解像度前提）: list.txt に file '...webm' を並べて
ffmpeg -f concat -safe 0 -i list.txt -c copy master.webm

# 合成音声（VOICEVOX 等で書き出した narration.wav）を載せて mp4 化（YouTube 用）
ffmpeg -i master.webm -i narration.wav -c:v libx264 -crf 20 -c:a aac -shortest final.mp4
```

## 注意

- 偽カーソル（水色ドット）を注入してクリック位置を可視化している。UI 本体は無改変。
- セレクタは data-testid が無いため aria-label / ロール / 文言に依存。**UI 文言を変えたらここも追従**
  （依存文言の一覧は retake-prompt.md のドリフト検査表）。
- 撮影はローカル compose で行う（本番URLでは撮らない）。
