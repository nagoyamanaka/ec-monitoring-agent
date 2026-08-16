# video-capture — 提出動画の素材テイク自動撮影

台本 `docs/protopedia/video/script.md`（ローカル管理・リポジトリ外）に対応する
**パート単位の動画（編集用 H.264 mp4）と画面遷移ごとのスクリーンショット**を Playwright で自動採取する。
ナレーション・テロップ・倍速加工は撮影後の編集工程で行う＝**尺合わせは録画側でやらない**。

Playwright の録画は VP8 in webm 固定で編集ソフト（DaVinci / Premiere / CapCut 等）が読めないため、
撮影直後に **H.264 mp4 へ自動変換**してパート本体として出す（ロスレスな webm 源は `.raw/` に温存）。
変換に使う ffmpeg は `pnpm run setup` で入る `ffmpeg-static`（root不要）。`FFMPEG_PATH` で自前の
ffmpeg を指定してもよい。ffmpeg が見つからない環境では変換をスキップし webm のまま出す（警告付き）。

撮り直しの定型運用は `docs/protopedia/video/retake-prompt.md`（ローカル管理・リポジトリ外）を参照。

本体 pnpm workspace には属さない独立パッケージ（`pnpm-workspace.yaml` 対象外）。
出力 `output/` は .gitignore 済み。採用スクショは `docs/protopedia/assets/`（ローカル管理・リポジトリ外）へコピーする。

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
node capture.mjs dogfooding      # draft PR カットは既定で PR #29 を使用（DRAFT_PR_URL=... で上書き）
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
`HEADED=1` ブラウザ表示／`SLOWMO`（ms・既定150）／`DWELL_SCALE`（間合い倍率・既定1）／`RESET=1`／`DRAFT_PR_URL`（未指定なら既定 PR #29）

### スライド埋め込みクリップ専用: `capture-s5-clip.mjs`

```bash
TAKE=take009 node capture-s5-clip.mjs   # → output/takeNNN/s5-forecast.mp4
```

決勝スライド S5（予報デモ）に**埋める27秒**だけを撮る。`forecast` シーンが台本カット1〜3の
素材（ProtoPedia 用スクショ込み・Valkey カード・PR #83・アラート詳細まで写る約49秒）なのに対し、
こちらは**予報カード → 引用先の実 PR → 先手**の3画面しか撮らない＝カットが頭を落とすだけで済む。
撮影前に `GET /forecast` の1枚目が期待どおりか（subject・level・引用）を検査して落ちる。
環境変数: `PR_MATCH`（クリックする引用の href・既定 `/pull/55`）／`EXPECT_SUBJECT`（既定 `db_connection_pool`）／
`PR_ZOOM`（PR ページだけの拡大率・既定 1.35）。27秒への切り出しは `temp/hackathon-study/slides/cut_s3_clip.sh`。

### ProtoPedia メイン画像専用: `make-hero.mjs`

```bash
node make-hero.mjs        # 3案すべて → output/hero/hero-{a,b,c}.png
node make-hero.mjs a      # 採用案（時間軸）だけ
```

スクショを素材にしない**描き起こしのメイン画像**。`make-posters.mjs` の hero（part1 スクショに帯と
コピーを焼く型）は一覧カード幅に縮むと上2/3が情報ゼロの暗色になるため、決勝勢と同じ
「巨大な主張が1つ」の型で作り直したもの。`*-card.png` は幅320pxへ縮めた検証用で、
ここで読めないものは実際の一覧でも読めない。

| 案 | 型 | 置き場所 |
| --- | --- | --- |
| **B（採用）** | アイコン＋巨大ワードマーク＋1行＋下辺のスペック帯 | `docs/protopedia/assets/hero-brand.png` |
| A | 時間軸の図＋巨大見出し | `docs/protopedia/assets/hero-timeline.png`（代替として温存） |

`poster-1-hero.png` は `make-posters.mjs` の出力なので上書きしない＝名前を分けてある。

**案Bで踏んだ落とし穴（画）**: マークからタイルを外して字面だけを 560px で置くと、折れ線が
**家具（リクライニングチェア）に見えて意匠が壊れる**。タイルは飾りではなく、字面を
「グラフの軌跡」として読ませる枠。またアイコンを主役にすると、参照している DriftScribe /
KangaL とは主従が逆（向こうはワードマークが主役）になり、アイコンショーケースに見える。

**案Bで踏んだ落とし穴（文言）**: 下辺の3列は最初「判断に使える時間 81時間2分／8つのAI
エージェント／既知は1秒」だった=**実装の自慢であって判断材料ではない**。81時間はデモ1件の
値なのにスペックの顔で置くと製品の性質と誤読され、エージェント数は全員が言えるうえ「数が
多いほど良い」という嘘の含意が乗る。**載せる基準は「他作品が同じことを言えないか」**で、
現行の3列（根拠＝照合できない引用は表示しない／判断＝決めるのは人／導入＝既存の監視基盤を
置き換えない）は技術審査員が最初に確かめる「出力を信じていいか・本番が壊れないか・乗り換えが
要るか」に1列ずつ対応している。**具体の数値は1つも載せない**＝UI が変わっても腐らない。

図と語彙はアプリの実装に従う。ずらすと嘘になるので、UI を変えたらここも追従する:

| 画像の要素 | 正の在処 |
| --- | --- |
| 「次の一点」の幾何（点は立ち上がりの延長線上） | `frontend/public/favicon.svg` / `shared/ui/BrandMark.tsx` |
| 人が動ける区間＝cyan・発生窓＝amber・起点＝白丸 | `features/forecast/presentation/components/ForecastTimeline.tsx` |
| level 文言「高リスク」（**「HIGH」は廃止済み**） | `features/forecast/domain/RiskLevel.ts` の `riskLevelLabel` |
| 確信度%を出さない | `RiskCard.tsx`（未較正のため意図的に非表示） |

フォントは本体と同じ `@fontsource/ibm-plex-sans-jp` の実体を data URI で焼き込むので、
実行環境にフォントが無くてもフォールバックしない。

## 出力

```
output/
  hero/                           # make-hero.mjs（ProtoPedia メイン画像・原寸1920x1080 と縮小検証）
  take001/                        # 実行ごとに自動採番（TAKE= で固定可）
    part1-forecast.mp4            # パート本体（H.264・1920x1080・30fps）。外部タブは partN-*-popupM.mp4
    part2-investigation.mp4
    ...
    screens/part1-forecast/NN-<label>.png
    .raw/                         # Playwright 録画のロスレス webm 源（再変換用に温存）
```

環境変数（変換）: `FFMPEG_PATH`（自前 ffmpeg のパス。未指定なら ffmpeg-static → PATH の順で解決）

ProtoPedia 紹介画像5枚の採用候補は台本の対応表を参照（part1 `01-forecast-card` / part2 `03-live-timeline`・
`05-evidence-panel` / part3 `01-known-instant`。アーキ図はスライドPNG）。

## 編集

パート本体は編集用の H.264 mp4 なので、そのまま **DaVinci Resolve / Premiere / CapCut 等の
タイムラインへ読み込める**（VP8 webm と違い、そのまま扱える）。ナレーション音声・テロップ・
倍速区間はエディタ上で合わせる。GUI を使わず ffmpeg で組み立てるなら以下が目安（`ffmpeg` は
`ffmpeg-static` の実体でも可・`node -e "console.log(require('ffmpeg-static'))"` でパス確認）:

```bash
# カット4相当の倍速区間（例: 2倍速。×2 表示テロップは編集側で焼き込む）
ffmpeg -i take001/part2-investigation.mp4 -filter:v "setpts=PTS/2" -an part2-x2.mp4

# 結合（同解像度・同コーデック前提）: list.txt に file '...mp4' を並べて
ffmpeg -f concat -safe 0 -i list.txt -c copy master.mp4

# 合成音声（VOICEVOX 等で書き出した narration.wav）を載せる（YouTube 用の最終 mp4）
ffmpeg -i master.mp4 -i narration.wav -c:v copy -c:a aac -shortest final.mp4
```

## 注意

- 偽カーソル（水色ドット）を注入してクリック位置を可視化している。UI 本体は無改変。
- セレクタは data-testid が無いため aria-label / ロール / 文言に依存。**UI 文言を変えたらここも追従**
  （依存文言の一覧は retake-prompt.md のドリフト検査表）。
- 撮影はローカル compose で行う（本番URLでは撮らない）。
