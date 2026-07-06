# video-capture — 提出動画の素材テイク自動撮影

台本 [docs/protopedia/video/script.md](../../docs/protopedia/video/script.md) のカット1〜8に対応する
**生テイク（.webm）と画面遷移ごとのスクリーンショット**を Playwright で自動採取する。
ナレーション・テロップ・倍速加工は撮影後の編集工程（ffmpeg）で行う＝**尺合わせは録画側でやらない**。

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
node capture.mjs all             # 全シーン順撮り（forecast → investigation → learning → dogfooding）
node capture.mjs forecast        # シーン単位の撮り直し
RESET=1 node capture.mjs investigation   # demo reset してから 3b 発火
DRAFT_PR_URL=https://github.com/... node capture.mjs dogfooding
```

| シーン | 台本カット | 内容 | 所要 |
| --- | --- | --- | --- |
| `forecast` | 1〜3 | 予報カード→引用チップ解決→先手→ブリッジCTA→/alerts | 〜1分 |
| `investigation` | 4〜6 | 3b発火→着弾/未知分類→ADKライブ調査→レポート/証拠→承認直前 | 〜3分（実調査込み） |
| `learning` | 7 | 承認→既知へ昇格→3b再発火→即・既知の対比 | 〜1分 |
| `dogfooding` | 8 | シナリオ4（脆弱性）→実 draft PR 提示 | 〜1分 |

**実行順序の制約**: `learning` は `investigation` が残した「調査済み・未レビューの 3b Alert」を
承認対象にするため、**直後に続けて実行**する（`all` はこの順で回る）。

環境変数: `FRONT_URL`（既定 http://localhost:5173）／`API_URL`（同 3001）／`HEADED=1` ブラウザ表示／
`SLOWMO`（ms・既定150）／`DWELL_SCALE`（間合い倍率・既定1）／`RESET=1`／`DRAFT_PR_URL`

## 出力

```
output/
  video/<scene>.webm            # テイク本体（1920x1080）。外部タブは <scene>-popupN.webm
  screens/<scene>/NN-<label>.png
```

ProtoPedia 紹介画像5枚との対応（採用候補）:

| 画像 | ファイル |
| --- | --- |
| 1. 予報カード＋引用チップ | `screens/forecast/01-forecast-card.png` |
| 2. アーキ図 | （スライドPNG・本ツール対象外） |
| 3. 調査ライブ・タイムライン | `screens/investigation/03-live-timeline.png` |
| 4. 証拠パネル | `screens/investigation/05-evidence-panel.png` 前後 |
| 5. 既知1秒の対比 | `screens/learning/01-known-instant.png` |

## 編集（ffmpeg の目安）

```bash
# カット5相当の倍速区間（例: 2倍速。×2 表示テロップは編集側で焼き込む）
ffmpeg -i investigation.webm -filter:v "setpts=PTS/2" -an investigation-x2.webm

# 結合（同解像度前提）: list.txt に file '...webm' を並べて
ffmpeg -f concat -safe 0 -i list.txt -c copy master.webm

# 合成音声（VOICEVOX 等で書き出した narration.wav）を載せて mp4 化（YouTube 用）
ffmpeg -i master.webm -i narration.wav -c:v libx264 -crf 20 -c:a aac -shortest final.mp4
```

## 注意

- 偽カーソル（水色ドット）を注入してクリック位置を可視化している。UI 本体は無改変。
- セレクタは data-testid が無いため aria-label / ロール / 文言に依存。**UI 文言を変えたらここも追従**。
- 撮影はローカル compose で行う（本番URLでは撮らない）。
