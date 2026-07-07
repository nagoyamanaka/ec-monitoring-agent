# Step 7: 最終レビューTODO（実行粒度・締切 7/10）

> 出典: `docs/steps/step7-final-review-strategy.md`（採点・優先度の根拠はそちら）。
> 実行者想定: **各タスクは他のエージェントが本書だけで完遂できる粒度**で書く。人間のみ可能なタスクは §H に分離。
> ガードレール: main は常時テスト緑・提出可能を維持。UI変更は既存テスト（1017件）を壊さないこと。デモseed・contracts のワイヤ型には触れない。

## 優先順位一覧（上から消化）

| #   | タスク                                        | 優先          | 実行者                   | 状態                                                                                                                                              |
| --- | --------------------------------------------- | ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | 本番デプロイURLの床（tf apply・予報403・OOM） | ★★★★★         | 人間                     | 未                                                                                                                                                |
| A1  | 絵文字の豆腐化解消（フォント＋SVG化）         | ★★★★★         | 人間(sudo)＋エージェント | 済（フォント導入＋主役絵文字SVG化・要C2再撮影で最終確認）                                                                                         |
| C1  | 動画タイトルカード（0:00-0:05）作成           | ★★★★★         | エージェント             | 未                                                                                                                                                |
| A2  | ブランド統一（EC Monitoring→Kizashi）         | ★★★★☆         | エージェント             | 未                                                                                                                                                |
| B1  | アーキ図ダーク版再レンダ                      | ★★★★☆         | エージェント             | 済（architecture.md と同期済みを検証の上ダーク化・Kizashiロゴ追加・3520×2060差替／ライト版退避）                                                  |
| C2  | take003 再撮影（豆腐なし・新ブランド）        | ★★★★☆         | エージェント→人間確認    | 未（A1/A2/C1後）                                                                                                                                  |
| B2  | ProtoPedia画像5枚のポスター化                 | ★★★☆☆         | エージェント             | 未（C2後）                                                                                                                                        |
| A3  | 生ID露出の人間語化                            | ★★★☆☆         | エージェント             | 済（予報引用チップ=desc主／subject生IDをmonoメタ行へ・アラート詳細のAI推定パターン機械IDを人間語化＋生IDをパターンIDメタ行へ・UT+2 369緑・tsc緑） |
| B3  | 動画サムネイル作成                            | ★★★☆☆         | エージェント             | 未                                                                                                                                                |
| A4  | 予兆ページ導入文の圧縮＋Heroコピー            | ★★☆☆☆         | エージェント             | 未                                                                                                                                                |
| A5  | 調査中の証拠パネルの逐次表示                  | ★☆☆☆☆（余力） | エージェント             | 未                                                                                                                                                |

---

## A. アプリ改善

### A1 絵文字の豆腐化解消 ★★★★★　✅

**事実**: 撮影ホスト（WSL）は `fc-list | grep -ci emoji` → **0**。フロントは絵文字16種を使用（🛡🖥🕹🔗📘📈🔧📄⚡⚖⚠ ✓❯❮✕✗）。take002 の全スクショで「🛡 今打てる先手」→「� 今打てる先手」等に化けている。動画も同一環境撮影のため同様。

**手順**:

1. （人間・§H2）ホストにフォント導入: `sudo apt-get install -y fonts-noto-color-emoji && fc-cache -f`。検証: `fc-list | grep -ci emoji` ≥ 1。
2. （エージェント・恒久対策）**主要絵文字のSVGアイコン化**。sudo が待てない場合はこちらを先行してよい。対象を列挙:
   ```bash
   grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/apps/backoffice/frontend/src --include='*.tsx' -l
   ```
   最低限の置換対象（動画に映る主役のみ・全部やらない）:
   - `features/forecast/presentation/components/RiskCard.tsx` の 🛡（先手カード）と🔗
   - `shared/ui/`／alerts 系の 📋（リンクをコピー）・📅（土 20:00 の頭）・🕹（デモコンソール）
     置換方針: `lucide-react` は**依存追加せず**、16px の inline SVG コンポーネント（`shared/ui/icons.tsx` を新設）で `Shield`/`Link`/`Copy`/`Calendar`/`Gamepad` の5つだけ手書き。`currentColor` 継承・`aria-hidden`。
3. 検証: `pnpm --filter backoffice-frontend test` 緑 → ローカル compose で `/forecast` と `/alerts` を目視（またはスクショ採取スクリプトで1枚撮って□が無いこと）。

**受け入れ条件**: 再撮影スクショ上に U+FFFD/豆腐が1つも写らない。

**実施記録（2026-07-07）**: フォント導入済み（`fc-list | grep -ci emoji`=1）。恒久対策として `shared/ui/icons.tsx` を新設し、`Shield`/`Clock`/`Link`/`Gamepad` の4アイコンを inline SVG（`currentColor`・`aria-hidden`・1em）で手書き。置換対象＝動画の主役のみ:

- `RiskCard.tsx`: 🛡（先手カード）→`ShieldIcon`、⏱（予報ウィンドウ見出し）→`ClockIcon`
- `ReferencedEvidenceCard.tsx` / `AlertDetailPage.tsx`（リンクをコピー）: 🔗→`LinkIcon`
- `DemoDrawer.tsx` / `ForecastDemoConsole.tsx`: 🕹️（デモコンソール）→`GamepadIcon`

TODO記載の 📋（コピー）・📅（カレンダー）は**コード上に存在しなかった**ため対象外。`EvidencePanel.tsx` のソース種アイコン（🛡📈 等は文字列マップ・型変更が必要）は font 導入で描画されるため据置。`✓✗✕❮❯⚠⚖⬡` は color emoji でなく通常テキストフォントで描画される記号のため対象外。フロントUT 367件緑・`tsc --noEmit` 緑。

### A2 ブランド統一（EC Monitoring → Kizashi） ★★★★☆　✅

**事実**: `src/apps/backoffice/frontend/src/shared/ui/AppHeader.tsx:44` が「EC Monitoring」。提出名は「Kizashi」。README の H1 は「EC Monitoring Agent」。

**手順**:

1. `AppHeader.tsx` のロゴ文字列を **`Kizashi`** に変更し、直後に小さく `AI-SRE` の副題 span（既存のスタイルトーン踏襲・tealアクセント可）。
2. `index.html` の `<title>` を `Kizashi — AI-SRE 観測コンソール` へ（ファイルは `src/apps/backoffice/frontend/index.html` を確認）。
3. README.md の H1 を `# Kizashi（兆し） — AI-SRE 調査エージェント` に変更（旧名は括弧書きで残す: `（リポジトリ名: ec-monitoring-agent）`）。
4. 「EC Monitoring」文字列に依存するテスト/E2Eを検索して同時修正:
   ```bash
   grep -rn "EC Monitoring" src e2e --include='*.ts' --include='*.tsx'
   ```
5. 検証: フロントUT＋関連E2E緑。

**受け入れ条件**: デプロイURL/ローカルの全画面ヘッダーとタブタイトルが Kizashi。テスト緑。

### A3 生ID露出の人間語化 ★★★☆☆　✅

**事実**: 予報引用チップ見出しが `chore_db_cap_db_connection_pool_max_connections_100_40_for_cost_opti…`／`google_sql_database_instance_ec_db`。アラート詳細「AI 推定パターン」が `TERRAFORM_DB_MAX_CONNECTIONS_REDUCTION` の生表示。

**手順**:

1. `RiskCard.tsx`（予報引用チップ）: 現在1行目=生ID・2行目=人間語説明になっている。**表示順を入替**（1行目=人間語説明を太字見出しに、2行目=生IDを `font-mono` の小さいメタ行に）。データ構造・contracts は変更しない。純粋な表示順の入替のみ。
2. アラート詳細のパターン名表示コンポーネント（`grep -rn "推定パターン" src/apps/backoffice/frontend/src` で特定）: 表示用変換 `patternName.replace(/_/g, ' ').toLowerCase()` を適用した `<span>`＋生IDは `title` 属性 or 併記の小メタ行へ。**バックエンド・保存値は不変**。
3. 検証: フロントUT緑・スクショ目視。

**受け入れ条件**: 予報カードとアラート詳細の見出し行に snake_case が現れない（メタ行は可）。

**実施記録（2026-07-07）**: 表示順の入替のみ・contracts/保存値は不変。
- 予報引用チップ（`CitationList.tsx`）: `ReferencedEvidenceCard` に `meta?` prop を追加し、`title`=人間語 `desc`（font-medium 見出し）／`meta`=生ID `subject`（font-mono の小メタ行）へ入替。`description` は任意化。
- アラート詳細（`AlertCardExpanded.tsx`）: AI 推定パターン名が機械 ID（`^[A-Z0-9]+(_[A-Z0-9]+)+$`）のときだけ `replace(/_/g," ").toLowerCase()` で見出しを人間語化し、生IDは既存の結晶化行と同型の「パターンID: `<code>`」メタ行へ降格。既に人間語の patternName は誤変換しない。
- UT +2（機械ID/人間語・見出し=desc/メタ=mono subject）。フロントUT 369件緑・`tsc --noEmit` 緑。**ライブ視覚確認は生ID発生に有料 AI 経路が必要なため未実施**（表示専用のため UT で担保）。

### A4 予兆ページ導入文の圧縮＋Heroコピー ★★☆☆☆　✅

**現状**: 見出し「予兆ブリーフィング」＋説明3文（未マージPR・インフラ変更・スケジュール…実在シグナルと照合済み…）。

**手順**: 見出し直下の説明を1文に: **「障害が起きる前に、根拠付きで予報し、いま打てる先手まで提示します——引用は実在シグナルと照合済みのものだけ。」** 残り2文分の情報（シグナル種の列挙）は右サイド「投入シグナル」パネルが既に担っているため削除。

**受け入れ条件**: 導入部が1文・2行以内。フロントUT緑。

### A5 調査中の証拠パネル逐次表示（余力のみ）

「AI が証拠を解析しています…」静的1行を、SSEイベント到着分だけ先に証拠カードとして逐次描画（既存のライブ・タイムラインのデータ源を再利用）。**実装コストが2時間を超えるなら着手しない**（動画は編集倍速でカバー可能）。

---

## B. ProtoPedia・図・サムネイル

### B1 アーキ図ダーク版 ★★★★☆　✅

**事実**: `docs/protopedia/assets/architecture.png`（3520×2060）は白背景。アプリ・動画はダーク。ProtoPedia画像5枚の中で1枚だけ別ブランドに見える。

**手順**:

1. `docs/protopedia/assets/architecture-diagram.html` の配色トークンをダークへ:
   - 背景 `#0B1220` ／パネル面 `#121B2E` ／罫線 `#26324A` ／本文 `#E6EDF7` ／サブ文字 `#8FA3BF`
   - アクセントは現UIの teal（`#2DD4BF` 系）を主・凡例の意味色（read-only=青系・学習=緑・write=赤・人の判断=amber）は**彩度を落として維持**
   - 左上に `Kizashi` ロゴ文字を追加（A2と同一表記）
2. 再レンダ: `docs/protopedia/assets/画像取り直しコマンド.txt` 記載の headless Chrome コマンドを使用（3520×2060 維持）。
3. 検証: PNG を目視——文字コントラスト（サブ文字が背景に沈まないこと）・絵文字/記号の豆腐なし。

**受け入れ条件**: ダーク版 `architecture.png` 差し替え済み・ライト版は `architecture-light.png` として退避。

**実施記録（2026-07-07）**: 着手前に `architecture-diagram.html` が `architecture.md` と同期済みであることを検証（両者は同一コミット 039f292「doc最新化」7/7 10:47 で同時更新・8エージェント/予兆3シグナル/dedup/write隔離/read-only 4証拠/デプロイ構成すべて一致・唯一の陳腐化 PNG 側 Pro→Pro/Flash も HTML では修正済み）。内容変更なし＝純ダーク化のみ実施。

- ダーク版 HTML を新設 `architecture-diagram-dark.html`（元ライト HTML は保持）。センチネル2段置換で全カラートークンを指定パレットへ（背景 `#0B1220`／面 `#121B2E`・カード `#1B2740`／罫線 `#2B3A52`／本文 `#E6EDF7`／サブ `#8FA3BF`）、意味色は彩度を落として維持（read-only=青 `#60A5FA`／学習=緑 `#34D399`／write=ローズ `#FB7185`／人の判断=amber `#D9A32B`／主アクセント teal `#2DD4BF`）。
- 左上に Kizashi ロゴ（teal `#2DD4BF` 太字）＋「（兆し）／ AI-SRE 観測コンソール」副題を追加（A2 と同一表記）。
- headless Chrome（`chrome-headless-shell` 142・libasound 追加不要で起動）で **3520×2060**（1760×1030 ×2）再レンダ。ダーク→`architecture.png` 差替、ライト版は現行 HTML から fresh 再レンダして `architecture-light.png` へ退避。
- 目視検証: 背景ダーク・文字コントラスト良好（サブ文字が沈まない）・豆腐/U+FFFD なし（本図は color-emoji 不使用・記号のみ）。

### B2 ProtoPedia画像5枚のポスター化 ★★★☆☆（C2後）

**方針**: 「UIスクショ」でなく「1枚=1メッセージのポスター」。take003 のスクショに、下辺の帯（ダーク・半透明）＋1行コピーを焼き込む。

| #         | 素材（take003）               | 焼き込みコピー                            |
| --------- | ----------------------------- | ----------------------------------------- |
| 1（Hero） | part1 `01-forecast-card.png`  | 障害は、起きる前に終わらせる。            |
| 2         | B1 のアーキ図ダーク版         | （コピーなし・図のみ）                    |
| 3         | part2 `03-live-timeline.png`  | 8つのAIエージェントが、ライブで調査する。 |
| 4         | part2 `06-evidence-panel.png` | 結論には、実在する証拠だけ。              |
| 5         | part3 `01-known-instant.png`  | 二度目の同じ障害は、1秒で終わる。         |

**手順**: HTML テンプレート（画像を `background`、下帯＋テキスト）→ headless Chrome で 1920×1080 PNG 出力。`scripts/video-capture/` の既存 Chrome 起動系を流用可。フォントは Noto Sans JP（システム導入済みのはず。無ければ `画像取り直しコマンド.txt` と同条件）。

**受け入れ条件**: 5枚とも 16:9・ダーク・豆腐なし・コピーが可読（最小28px相当）。

### B3 動画サムネイル ★★★☆☆

予報カードのクローズアップ（HIGH・90%・引用チップが読める拡大率）＋左上 `Kizashi` ＋下部コピー「障害は、起きる前に終わらせる。」。B2 と同じテンプレ機構で 1280×720。YouTube アップロード時に人間が設定（§H3）。

---

## C. 動画

### C1 タイトルカード作成 ★★★★★

黒背景（`#0B1220`）中央に2行: 大「障害は、起きる前に終わらせる。」／小「Kizashi — AI-SRE エージェント」。HTML→headless Chrome→1920×1080 PNG。`scripts/video-capture/output/` 配下でなく `docs/protopedia/assets/title-card.png` に保存。動画編集で 0:00–0:05 に静止配置（台本 `script.md` は更新済み・カット0参照）。

### C2 take003 再撮影 ★★★★☆（A1・A2 完了後）

1. 前提: A1（豆腐解消）・A2（ヘッダーKizashi）・（可能ならA3/A4）がローカル compose に反映済み。
2. `scripts/video-capture/README.md` の手順どおりパート4本を再撮影（mp4直接出力・take003）。
3. 撮影後チェック（機械可能）: 各パートの代表スクショに□/U+FFFDが無い・ヘッダーがKizashi・`script.md` チェックリスト全項目。
4. 人間へ引き渡し: fallback が出たテイクの有無を報告（出ていたら該当パートのみ再撮影）。

### C3 台本の最終整合

`docs/protopedia/video/script.md` は本レビューで更新済み（カット0追加・カット2/4/5圧縮・チェックリスト増強）。take003 撮影後、**実物の数値（confidence・件数・チップ文言）と台本の食い違いを突合して台本側を直す**（従来ルール通り）。

---

## H. 人間タスク（エージェント実行不可）

| #   | タスク                    | 内容                                                                                                                                                                                                                                     |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **本番URLの床（最優先）** | tf apply（予報403=GOOGLE_GENAI_USE_VERTEXAI 修正の適用）→ 本番で `GET /forecast` が事前生成キャッシュを返すこと・edge 512MiB OOM の再発監視・シナリオ3b/6 の実 Gemini fallback 率目視。一次審査は審査員が無人でURLを触るため全加点の土台 |
| H2  | 絵文字フォント導入        | `sudo apt-get install -y fonts-noto-color-emoji && fc-cache -f`（A1手順1）                                                                                                                                                               |
| H3  | 提出操作                  | YouTube アップロード（サムネ=B3）・ProtoPedia 登録（原稿=`protopedia-submission.md`・画像=B2の5枚）・GitHub リポ公開状態確認                                                                                                             |
| H4  | 最終リハ                  | デプロイURLをシークレットウィンドウで一巡（forecast→alerts→詳細→承認→既知）。所要5分                                                                                                                                                     |

---

## 完了の定義（優秀賞ラインの床）

- [ ] 本番デプロイURLで予報カードが無人・課金ゼロで表示される（H1）
- [ ] 動画・画像5枚・アプリのどこにも豆腐が写らない（A1/C2）
- [ ] すべての提出面の名前が Kizashi で統一（A2/B1/C1）
- [ ] 動画 0:00–0:05 にHeroコピーのタイトルカード（C1）
- [ ] ProtoPedia に mermaid 生テキストが無い（原稿修正済み・貼り付け時に確認）
