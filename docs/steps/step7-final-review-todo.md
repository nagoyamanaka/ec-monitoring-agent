# Step 7: 最終レビューTODO（実行粒度・締切 7/10）

> 出典: `docs/steps/step7-final-review-strategy.md`（採点・優先度の根拠はそちら）。
> 実行者想定: **各タスクは他のエージェントが本書だけで完遂できる粒度**で書く。人間のみ可能なタスクは §H に分離。
> ガードレール: main は常時テスト緑・提出可能を維持。UI変更は既存テスト（1017件）を壊さないこと。デモseed・contracts のワイヤ型には触れない。

## 優先順位一覧（上から消化）

| #   | タスク                                        | 優先          | 実行者                   | 状態                                                                                                                                              |
| --- | --------------------------------------------- | ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | 本番デプロイURLの床（tf apply・予報403・OOM） | ★★★★★         | 人間                     | 未                                                                                                                                                |
| A1  | 絵文字の豆腐化解消（フォント＋SVG化）         | ★★★★★         | 人間(sudo)＋エージェント | 済（フォント導入＋主役絵文字SVG化・要C2再撮影で最終確認）                                                                                         |
| C1  | 動画タイトルカード（0:00-0:05）作成           | ★★★★★         | エージェント             | 済（`title-card.png` 1920×1080・#0B1220・Heroコピー＋Kizashi副題・豆腐なし目視確認）                                                              |
| A2  | ブランド統一（EC Monitoring→Kizashi）         | ★★★★☆         | エージェント             | 未                                                                                                                                                |
| B1  | アーキ図ダーク版再レンダ                      | ★★★★☆         | エージェント             | 済（architecture.md と同期済みを検証の上ダーク化・Kizashiロゴ追加・3520×2060差替／ライト版退避）                                                  |
| C2  | take003 再撮影（豆腐なし・新ブランド）        | ★★★★☆         | エージェント→人間確認    | 済（実Gemini経路で4パート撮影・主役6枚を目視＝豆腐0/ヘッダKizashi/実調査90%・fallbackなし／part4のdraft PRカットも PR #29 で撮影済み）           |
| B2  | ProtoPedia画像5枚のポスター化                 | ★★★☆☆         | エージェント             | 済（take003素材に下辺グラデ帯＋1行コピー焼き込み・4ポスター生成＋アーキ図で5枚・目視で可読/豆腐0）                                                 |
| A3  | 生ID露出の人間語化                            | ★★★☆☆         | エージェント             | 済（予報引用チップ=desc主／subject生IDをmonoメタ行へ・アラート詳細のAI推定パターン機械IDを人間語化＋生IDをパターンIDメタ行へ・UT+2 369緑・tsc緑） |
| B3  | 動画サムネイル作成                            | ★★★☆☆         | エージェント             | 済（予報カードを1.92倍クローズアップ・左上Kizashi・下部Heroコピー・1280×720・豆腐0／YouTube設定は人間H3）                                          |
| A4  | 予兆ページ導入文の圧縮＋Heroコピー            | ★★☆☆☆         | エージェント             | 未                                                                                                                                                |
| D1  | 提出文の plan リンク主張を正確化              | ★★★★☆         | エージェント             | 済（submission 76行目を「実在の draft PR・過去事例」へ修正・planを実在リンク列挙から除外）                                                        |
| D2  | terraform plan の永続化＋PRコメント（CIのみ） | ★★★☆☆         | エージェント＋人間(CI確認) | 済（plan.txt＋redacted JSONをartifact保存・PRコメントupsert・生plan.jsonはsensitive平文を含むため不保存／要人間=ダミーPRでCI確認）                |
| D3  | plan の record口への自動投入                  | ★★☆☆☆（D2後） | エージェント＋人間(CI確認) | 済（POST /ingest/terraform-plan 新設・CIからredacted差分を自動POST・UT+9 1065緑・tsc緑／要人間=D2と同じダミーPRで疎通確認）                       |
| D3.5| flagship plan-1 を実在VM plan へ張り替え＋#83リンク | ★★★★☆    | エージェント＋人間(PR)   | 済（plan-1=バックボーンVM e2-standard-2→e2-small・過去事例/stub/subject突合も張り替え・#83を既定リンク・ローカル実Gemini検証で引用[plan-1,sch-1,inc-2]・1069緑）|
| D4  | flagship張り替え後の part1/part2 再撮影         | ★★★☆☆（B必須）| エージェント             | 未（Option Bで plan-1=VM縮小＋証拠を開く→#83 に変化・音声台本不変/on-screenのみ・script.mdカット1/2メモ更新済み）                                 |
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

**実施記録（2026-07-07）**: 生成スクリプト `scripts/video-capture/make-posters.mjs` を新設（Playwright chromium・take003 スクショを data URI 背景＋下辺グラデ帯＋teal アクセントバー＋`KIZASHI AI-SRE` ラベル＋1行コピー・1920×1080）。`node make-posters.mjs` で `docs/protopedia/assets/` に4枚出力：

| # | 出力 | 元スクショ | 焼き込みコピー |
| --- | --- | --- | --- |
| 1（Hero） | `poster-1-hero.png` | part1 `01-forecast-card` | 障害は、起きる前に終わらせる。 |
| 2 | `architecture.png`（B1ダーク版・帯なし図のみ） | — | （コピーなし） |
| 3 | `poster-3-live-agents.png` | part2 `03-live-timeline` | 8つのAIエージェントが、ライブで調査する。 |
| 4 | `poster-4-evidence.png` | part2 `06-evidence-panel` | 結論には、実在する証拠だけ。 |
| 5 | `poster-5-known.png` | part3 `01-known-instant` | 二度目の同じ障害は、1秒で終わる。 |

目視検証: コピーは 60〜76px（最小28px要件を大きく満たす）・帯は下端の空きダーク領域に載り主要コンテンツ（予報カード/8エージェント/90%証拠/完全一致）を隠さない・全画面ヘッダ Kizashi・U+FFFD/□ なし。ポスター1/4は最下部の証跡行が帯に一部かかるが結論情報は露出。B3 動画サムネ（1280×720）も同 `make-posters.mjs` 系で流用可。

### B3 動画サムネイル ★★★☆☆　✅

予報カードのクローズアップ（HIGH・90%・引用チップが読める拡大率）＋左上 `Kizashi` ＋下部コピー「障害は、起きる前に終わらせる。」。B2 と同じテンプレ機構で 1280×720。YouTube アップロード時に人間が設定（§H3）。

**実施記録（2026-07-07）**: 生成スクリプト `scripts/video-capture/make-thumbnail.mjs` を新設（Playwright chromium・B2 と同機構）。`part1-forecast/01-forecast-card.png` の予報カード領域（crop 668×376＝16:9）を **1.92倍** に拡大し 1280×720 に。左上に `Kizashi AI-SRE` ワードマーク（ダークピル＋teal ボーダーで見出しと分離）、下部に teal アクセントバー＋Heroコピー「障害は、起きる前に終わらせる。」（62px 太字）。上下に軽いダークグラデで可読性確保。出力 `docs/protopedia/assets/video-thumbnail.png`。

- 目視: **HIGH バッジ・確信度 95%**（予報の実値。todo の「90%」は調査確信度の混記で、予報カードは 95%）・今打てる先手カード・予報説明文が可読。豆腐/□ なし。引用チップ（根拠引用）は下端で一部コピー帯に重なるが、HIGH/95%/先手のクローズアップの方がサムネとして訴求が強いと判断しそちらを主役化。crop 座標は `make-thumbnail.mjs` の `CX/CY/CW` で微調整可。
- **残（人間 H3）**: YouTube アップロード時にこの PNG をサムネ設定。

---

## C. 動画

### C1 タイトルカード作成 ★★★★★　✅

黒背景（`#0B1220`）中央に2行: 大「障害は、起きる前に終わらせる。」／小「Kizashi — AI-SRE エージェント」。HTML→headless Chrome→1920×1080 PNG。`scripts/video-capture/output/` 配下でなく `docs/protopedia/assets/title-card.png` に保存。動画編集で 0:00–0:05 に静止配置（台本 `script.md` は更新済み・カット0参照）。

**実施記録（2026-07-07）**: `docs/protopedia/assets/title-card.html` を新設（`#0B1220` 背景・中央寄せ・Noto Sans CJK JP）。headless Chrome（`chrome-headless-shell` 142・`--force-device-scale-factor=1 --window-size=1920,1080`）で **1920×1080** PNG を `title-card.png` に出力。Heroコピーを 108px 太字（`#E6EDF7`）、副題「**Kizashi**（teal `#2DD4BF`）— AI-SRE エージェント」を 44px（`#8FA3BF`）、上部に teal のアクセントバー。目視検証: 豆腐/U+FFFD なし・文字コントラスト良好。台本カット0（`script.md`）の文言と一致。

### C2 take003 再撮影 ★★★★☆（A1・A2 完了後）

1. 前提: A1（豆腐解消）・A2（ヘッダーKizashi）・（可能ならA3/A4）がローカル compose に反映済み。
2. `scripts/video-capture/README.md` の手順どおりパート4本を再撮影（mp4直接出力・take003）。
3. 撮影後チェック（機械可能）: 各パートの代表スクショに□/U+FFFDが無い・ヘッダーがKizashi・`script.md` チェックリスト全項目。
4. 人間へ引き渡し: fallback が出たテイクの有無を報告（出ていたら該当パートのみ再撮影）。

**実施記録（2026-07-07）**: `RESET=1 node capture.mjs all` で **take003** を新規採番・4パート撮影（実Gemini経路＝`AI_INVESTIGATION_STUB=false`／`GOOGLE_GENAI_USE_VERTEXAI=true`／Vertex `asia-northeast1`・予報は事前生成キャッシュを使用しPOSTなし）。exit 0。

- 出力: `part1-forecast.mp4`(1.5M)／`part2-investigation.mp4`(4.5M)／`part3-learning.mp4`(1.4M)／`part4-dogfooding.mp4`(879K)・すべて H.264/1920×1080。スクショ計12枚。
- **fallbackなし**: part2 は実 ADK 8エージェント調査が完走（139秒・証拠6件・確信度90%・`db connection exhaustion`・実Terraform差分 `max_connections 100→20`／`3/3 実在照合済み`）。散文フォールバックや空応答は出ていない。
- **豆腐チェック（機械＋目視）**: 主役5枚（part1/01-forecast-card・part2/04-report・part2/06-evidence-panel・part3/01-known-instant・part4/01-cve-alert）に U+FFFD/□ が **1つも無い**。絵文字アイコン（🕹デモコンソール・🛡先手・🕒予報ウィンドウ・🔗リンク）は SVG 化＋フォント導入で正常描画。
- **ブランド**: 全画面ヘッダーが `Kizashi AI-SRE`。タブタイトルは A2 で `Kizashi — AI-SRE 観測コンソール`。
- **A3/A4 反映確認**: 予報引用チップは人間語 desc が見出し・生 ID は mono メタ行／導入文は1文。
- **part4 draft PR カット（追撮・2026-07-07）**: 既定 draft PR を **PR #29（`https://github.com/nagoyamanaka/ec-monitoring-agent/pull/29`）に確定**。`capture.mjs` に `DEFAULT_DRAFT_PR_URL` としてハードコード（`DRAFT_PR_URL` env で上書き可）・README/retake-prompt/script.md も PR #29 明記へ更新。`TAKE=take003 node capture.mjs dogfooding` で追記撮影 → `part4-dogfooding/02-draft-pr.png` を採取。目視: `Draft`／「AI が起票した草案（自動マージはしません）」／実CVEリンク（CVE-2021-3807・CVE-2022-25883）／`ai-remediation[bot]` の2コミット・GitHub ダークテーマ・豆腐なし。動画物語（自分自身を監視・人間承認）に合致。
  - ⚠ **再撮影の落とし穴**: 同一シナリオ4は既発火だと dedup で新規アラートIDが出ず `waitForAlert` が90秒タイムアウトする。part4 のみ撮り直す時は **先に `POST /demo/reset`** してから `TAKE=... node capture.mjs dogfooding`。
- **要人間確認・残**: 採用スクショの `docs/protopedia/assets/` へのコピー＋コミット（B2 のポスター化素材確定と併せて実施）。

### C3 台本の最終整合 ✅

`docs/protopedia/video/script.md` は本レビューで更新済み（カット0追加・カット2/4/5圧縮・チェックリスト増強）。take003 撮影後、**実物の数値（confidence・件数・チップ文言）と台本の食い違いを突合して台本側を直す**（従来ルール通り）。

**実施記録（2026-07-07）**: take003 の12スクショを目視突合し `script.md` を更新。ナレーションは「揮発数値はナレで言わない」設計のため矛盾なし。各カット撮影メモに「**実測（take003）**」で on-screen 実測値を焼き込み、編集/テロップが実物に一致するよう整合。

- 予報カード: 窓 `土 20:00-23:00`・確信度 **95%**・HIGH・根拠3系統6件・評価シグナル9件・plan `max_connections 100→40`。
- 調査(3b): `db connection exhaustion`・**139秒**・証拠 **6件**（Terraform 1＋類似事例DB 5）・確信度 **90%**（自己申告95%→裏付け上限で補正）・算定根拠 3/3 実在照合・退行 `max_connections 100→20`。
- 8エージェント実名（part4で確認）: Coordinator/EvidenceCollector/RootCauseAnalyst/ImpactTriage/**CorrelationVerifier=批判役**/RemediationPlanner/RunbookEscalation/RemediationReviewer。ナレの「批判役」「実ログ・コミット差分・インフラ差分」に一致。
- 既知: 完全一致（EXACT）・承認済み90%・総6件=既知即決1+AI調査5+学習1。
- CVE: 「脆弱性の検知」（trivy）・draft PR #29（CVE-2021-3807／CVE-2022-25883・`ai-remediation[bot]` 2コミット）。
- **文言修正**: カット2の引用チップ記述を実物へ（外部リンク付き＝`pr-55` の draft PR チップ／`plan-1` はTerraformプランで外部PRなし・「open PR」→「draft PR」・チップ順を明記）。

---

## D. terraform plan 取り込み経路（「plan済み・未適用」を実装で本物にする）

**背景（2026-07-07 判明）**: 予報の引用チップ `plan-1`（`Cloud SQL max_connections 100→40 縮小・plan済み未適用`）は `ForecastPendingPlanSeed.ts` の純合成 seed。参照先の `google_sql_database_instance.ec_db` は **infra/terraform に存在しない**（本番DBはVM上のMongo）。現行 `terraform.yml` は PR で plan（検証のみ・成果物破棄）→ main merge で environment 承認後 apply であり、「保存された plan が適用待ち」という状態・その取り込みは未実装。提出文の「実在の plan へ飛べる」は過大主張だった（→D1で修正済み）。一方 seed のコメント自身が「実機では CI の plan パイプラインが同じ record 口へ積む想定」と謳っており、これを実装で本物にするのが本章。plan-on-PR のコメント投稿・plan成果物の保存は Atlantis/Terraform Cloud 等で主流の実務プラクティスであり、「自リポジトリの CI シグナルを自分で取り込む」特徴④ドッグフーディング（Trivy→検知）の予兆版として物語も強化する。

**ガードレール（全タスク共通）**: flagship の `plan-1` seed・subject 語彙 `google_sql_database_instance.ec_db` は **変更禁止**（`ResolvedAlertSeed` の `report.subject` と MEMORY 突合ペア・動画/スクショ撮影済み）。実投入 plan は別シグナルとして共存させる。デモ値が合成であることは「正直さの原則」（合成入力バッジ）で開示済みのまま維持。

**seed 撤去は不可（2026-07-07 判断）**: 「今打てる先手」＝「sch-1 完了まで plan-1 の適用を延期」であり、先手提示・過去事例突合（inc-1/inc-2 と同 subject）・確信度95%・pr-55 とのワンセット物語のすべてが plan-1 に依存。撤去＝flagship 再設計＋全面再撮影になる。整理としても嘘ではない: `ec_db` は**監視対象EC（架空環境）のインフラ**であって Kizashi 自身のインフラではなく、決済シナリオの決済システムが実在しないのと同格の合成入力（バッジ開示済み）。Kizashi 側の処理（ストア照合・偽引用破棄・Gemini突合）は実経路。

**想定問答（審査で指摘された場合・H4 リハに含める）**:
> Q: この Terraform plan は実在するのか？
> A: デモの監視対象（EC）は合成環境で、plan もその一部——UI のバッジで明示しています。ただし Kizashi 側は本物で、plan の取り込み口（record口・URL付き引用解決）は実装済み、引用の実在照合はシグナルストアに対して実際に走ります。実在リンクへ解決する引用は pr-55（実 draft PR）と過去事例で確認できます。実運用では CI の plan パイプラインが同じ口へ構造化差分を積む設計です（D2/D3 実施済みならその旨を添える）。

### D1 提出文の plan リンク主張を正確化 ★★★★☆　✅

**実施記録（2026-07-07）**: `protopedia-submission.md` 76行目「対処先（実在の PR・plan・過去事例）へ飛べます」→「対処先（実在の draft PR・過去事例）へ飛べます」。plan を実在リンクの列挙から除外（plan-1 チップは外部リンク無しで表示される実態と一致）。特徴①冒頭の「未適用の Terraform plan…を突合し」はシステムが受け付ける**シグナル種の説明**であり虚偽でないため据置。動画 `script.md` は撮影メモに「plan-1 はTerraformプランで外部PRなし」と明記済みで修正不要。

### D2 terraform plan の永続化＋PRコメント（CIのみ・バックエンド変更なし） ★★★☆☆

**内容**: `.github/workflows/terraform.yml` の plan job を主流の plan-visible 形へ:

1. `terraform plan -out=tfplan -no-color -input=false -lock-timeout=5m` に変更し、続けて `terraform show -json tfplan > plan.json` と `terraform show -no-color tfplan > plan.txt` を生成。
2. `actions/upload-artifact` で `plan.json`/`plan.txt` を保存（retention 短めで可）。
3. PR イベント時のみ、`actions/github-script` で plan.txt の要約（`resource_changes` の address/action と行数上限つき本文を `<details>` 折りたたみ）を PR コメントに upsert（`permissions: pull-requests: write` は設定済み。既存コメントを探して更新し、コメント増殖させない）。
4. `concurrency: terraform-prod` の直列化はそのまま（plan/apply のロック競合対策コメント参照）。apply 側は現行どおり（保存 planfile の持ち回しはしない＝main で再 plan して apply。ここまで変えると承認フロー再検証が必要で締切に合わない）。

**検証**: WIF のためローカル実行不可。infra/terraform 配下を触るダミー draft PR（例: コメント1行追加）で plan コメントが付くことを人間が確認 → ダミーPRはクローズ。
**受け入れ条件**: infra を触る PR に plan 差分コメントが自動投稿され、Actions artifact に plan.json が残る。既存の plan/apply ジョブの成否に影響なし。

**実施記録（2026-07-08）**: `.github/workflows/terraform.yml` の plan job を改修（apply job は不変・`needs: plan`/environment 承認ゲート維持）。

- `terraform plan -out=tfplan` 化＋「Render plan」ステップで `plan.txt`（表示用）と `plan-changes.json`（構造化差分）を生成。
- **受け入れ条件からの安全側変更**: 生 `terraform show -json`（plan.json）は Secret Manager の `secret_data`（INGEST_TOKEN 実値）等の **sensitive 値を平文で含む**（テキスト版と違いマスクされない）。公開リポジトリでは artifact を誰でも取得できるため、**生 plan.json は保存せず**（生成後即 rm）、`before_sensitive`/`after_sensitive` マスクで値を `"(sensitive)"` へ redact した `plan-changes.json` を保存する。redact は `.github/scripts/tfplan-to-pending-plan.jq` に集約（managed のみ・no-op/read 除外・`["delete","create"]`→replace 合成・値200字/deltas20件/リソース50件上限）。合成 plan.json フィクスチャで sensitive 置換・data source 除外・空出力（変更0件）を検証済み。
- artifact: `terraform-plan-<run_id>-<run_attempt>`（plan.txt＋plan-changes.json・retention 7日）。
- PR コメント: `actions/github-script@v7` でマーカー `<!-- terraform-plan-comment -->` を upsert（増殖なし）。本文＝リソース変更一覧（address — action）＋ `<details>` 内に plan.txt 全文（55,000字で切り詰め・sensitive は terraform がマスク済み）。`continue-on-error: true` で必須 plan job の成否に影響させない。
- `setup-terraform` の wrapper が stdout リダイレクトを壊す既知問題があるため plan job のみ `terraform_wrapper: false`（step outputs 未使用なので安全・apply job は不変）。
- **残（人間）**: infra を触るダミー draft PR で plan コメント・artifact・（D3の）ingest を確認 → クローズ。

### D3 plan の record口への自動投入 ★★☆☆☆（D2 完了後・時間があれば）

**内容**: D2 の `plan.json` から `resource_changes` を `PendingPlan` 型（`address`/`action`/`attributeDeltas`/`plannedAt`/`summary`/`url`=PR html_url）へ変換し、バックエンドの `pendingInfraPlanStore.record()`（`BackofficeApp.ts:208` 付近）に到達する ingest エンドポイントへ CI から POST する。これで「未適用 plan が予兆シグナル（FUTURE_CHANGE・url付き＝証拠を開く可）として現れる」が実配線になる。

**論点（着手前に判断すること）**:
- **認証**: 本番は IAP 背後。CI からは deployer SA の OIDC で IAP audience トークンを取るか、検知ソースの peer ingest と同型の内部認証口を使う。ここが一番の工数リスク——半日超えそうなら D3 は見送り、D2 止まりで提出してよい（D2 だけでも「plan の永続化・可視化」は本物）。
- **揮発性**: store は InMemory のため再起動で消える。flagship は `DEMO_ENABLED` の seed 再投入で復元されるので影響なし。実投入分は「PR が開いている間に再投入され得る」程度の割り切りで可。
- **seed との共存**: ガードレール参照。`plan-1` には触れない。実投入 plan は別 id で共存し、subject が一致しない限り flagship の物語には影響しない。

**受け入れ条件**: infra を触る PR を開く→（予報再生成後）シグナルソースに url 付き FUTURE_CHANGE が現れ、引用された場合チップの「証拠を開く」が実 PR に解決する。既存 flagship 予報（plan-1/pr-55/sch-1/inc-1/inc-2）は不変。

**実施記録（2026-07-08）**: 論点だった認証は新規機構不要で解決——既存の security-scan / remediation-result と同じ **`INGEST_URL`＋`x-ingest-token` 直 POST**（app.yml の Trivy ingest で CI→本番到達の実績あり・IAP 経由ではなく edge の ingest 境界）。

- バックエンド: `POST /ingest/terraform-plan` 新設。`TerraformPlanIngestPostController`（認証・パース・HTTP 応答のみの薄い境界・SecurityScanIngest と同型）→ `TerraformPlanTranslator`（`application/RecordPendingPlan/`・源固有形を知る唯一の場所・構造検証と上限・不正は 400）→ `pendingInfraPlanStore.record()`（seed と同じ口）。`IngestDependencies` に store を追加配線。
- `InMemoryPendingInfraPlanStore.record()` に **同一 url は置換**を追加（同じ PR への push のたびに plan シグナルが増殖しない）。seed は url なし＝常に素通しで flagship（plan-1）の挙動不変。
- CI: terraform.yml plan job の PR イベント時のみ、D2 の redact 済み `plan-changes.json` をそのまま payload として `curl -fsS -X POST $INGEST_URL/ingest/terraform-plan`（`continue-on-error: true`・INGEST_URL 未設定/変更0件はスキップ）。summary は「terraform plan（PR #N）: X件のリソース変更（先頭address 他）・apply待ち」＝引用チップ desc にそのまま出る人間語。
- ガードレール順守: `ForecastPendingPlanSeed`・subject 語彙 `google_sql_database_instance.ec_db` は不変。実投入 plan は url 付きの別エントリとして共存（PendingPlanSignalSource の id は listPending 順の連番なので、実投入があると seed の id は plan-2 になり得るが、突合・引用は subject/生成時点のシグナル集合で閉じるため物語に影響なし）。
- 検証: 翻訳器 UT6件＋store UT3件を追加（全体 1065件緑・tsc 緑）。ワークフローは YAML 構造検証＋jq をフィクスチャで実行確認。**terraform.yml の `secrets.INGEST_URL/INGEST_TOKEN` は app.yml と同一 repo secrets のため追加設定不要**。
- **残（人間）**: D2 のダミー draft PR で ①plan コメント ②artifact ③ingest 202（Actions ログの `{resourceCount,summary,url}` 出力）④本番 `POST /forecast` 再生成後に url 付き FUTURE_CHANGE が引用され得ること、を確認 → PR クローズ。store は InMemory のため edge 再起動で実投入分は消える（seed は DEMO_ENABLED で復元・割り切りは本文の論点どおり）。

### D3.5 flagship plan-1 を実在リソースの本物 plan へ張り替え（Option B）＋実 PR #83 リンク ★★★★☆

**背景（2026-07-08 判断）**: 旧 flagship plan-1（`google_sql_database_instance.ec_db` 100→40）は監視対象 EC の**合成インフラ**で本番 infra/terraform に実体が無く、CI で本物の terraform plan を生成できない。そこにリンクを張ると「Cloud SQL と書いてあるのに別 PR に飛ぶ」捏造になる（当初は別 subject で共存させる案だったが、ユーザー判断で**flagship 自体を実話に張り替える Option B** を採用）。「どうせリンクを付けるなら part1 は撮り直し」との判断。

**張り替え後の flagship**: plan-1 を**実在リソース** `module.gce_backbone.google_compute_instance.backbone`（RabbitMQ+Mongo+ES+Valkey+worker 同居 VM＝本番 DB(Mongo) のホスト）の `machine_type` を **e2-standard-2 → e2-small** に縮小する plan に変更。VM 縮小＝Mongo がメモリ/接続を捌けず接続枯渇の再来リスク＝予兆テーマは維持。**実 PR #83 が CI で本物の plan を生成済み**なので「証拠を開く」は本物に解決＝捏造でない。

**エージェント実施（2026-07-08）**:
- 証拠 PR: ブランチ `chore/vm-cost-optimization`（base `develop`＝infra が main と一致・merge しても apply されない）→ 人間が push・**PR #83** 作成済み（`infra/terraform/envs/prod/main.tf` に `machine_type = "e2-small"`・`terraform fmt -check` 通過・DO NOT MERGE draft）。
- seed 張り替え: `ForecastPendingPlanSeed.ts`＝plan-1 を VM machine_type 変更へ。`ResolvedAlertSeed.ts` の過去事例 `poolShrinkRegression` を「前回 VM 縮小で枯渇」へ、`report.subject` を `google_compute_instance.backbone` に（pending plan address とトークン突合 4 語＝MEMORY 突合維持）。`StubLLMClient.ts` の固定予報 subject/reasoning/先手を VM 話へ。
- リンク配線: `config.forecast.pendingPlanPrUrl`（env `FORECAST_PENDING_PLAN_PR_URL`・**既定 = PR #83**）を `withPendingPlanEvidenceUrl` で plan-1 seed に後付け。DEMO_INFRA_APPLY_PR_URL（#60）と同じ「本物 PR を毎回指す」規約。ローカル/本番とも既定で #83 リンクが出る。
- **ローカル実機検証（実 Gemini 経路）**: restart→reset→`POST /forecast` で plan-1 が `subject=module_gce_backbone_google_compute_instance_backbone`・desc=VM 縮小・`url=…/pull/83` を持ち、予報リスクが `citations=[plan-1, sch-1, inc-2]`／inc-2=MEMORY `google_compute_instance.backbone`（過去の同一 VM 枯渇）を引用、reasoning も「VM 縮小→過去同種障害→週末負荷」と一貫。**全体 1069 UT 緑・tsc 緑**。
- 突合維持の要点: `subjectsMatch` はトークン重なり（多トークンは 2 語以上）。pending(VM address) と past(`google_compute_instance.backbone`) は google/compute/instance/backbone の 4 語共有で成立。schedule↔weekendCheckout は不変。E2E（`forecast.e2e.test.ts`）は id ベースのアサートなので緑を維持（コメントのみ更新）。

**残（人間）**: ①**PR #83 は draft のまま開けておく**（「証拠を開く」が open な pending plan に解決するため。閉じても閲覧は可）。②本番 tf の `plain_env` に `FORECAST_PENDING_PLAN_PR_URL` は入れなくても既定 #83 で動くが、明示したい場合は追記。③**part1/part2 の再撮影**（下記 D4）。

**追補（2026-07-08・スクショレビューで判明した残整合）**:
- **UI の pr-55/pr-83 チップは PR タイトル直写し**（`PullRequestSignalSource` が desc/subject にタイトルを使う）＝コード変更でなく **GitHub 上のリタイトルで直す（人間）**:
  - **PR #55**: 「cap DB connection pool (max_connections 100→40) for cost optimization」→「**chore(db): cap Mongo connection pool (maxPoolSize 100→40) to fit downsized backbone VM**」。diff（MongoClientFactory `maxPoolSize: 40`）はそのままタイトルを実態に合わせ、「VM 縮小に合わせてアプリ側プールも縮小」として flagship と同一物語に編入する（旧 Cloud SQL 語彙 `max_connections` を UI から消す）。connection/pool トークンは維持されるので inc-1/inc-3 との MEMORY 突合も切れない。
  - **PR #83**: タイトルから「（デモ証拠PR・DO NOT MERGE）」を外す（pr-83 チップに直写しされ予報 UI に出るため）。draft 状態＋本文警告は維持（draft はマージ不可なので安全）。
- **デモコンソール（投入シグナル台帳）は VM 話へ更新済み**（`ForecastDemoConsole.tsx`・静的台帳: Terraform plan 行=バックボーンVM e2-standard-2→e2-small・実 PR の plan と同内容／未マージ PR 行=VM 縮小・プール縮小の draft PR ほか／過去事例行=前回の VM 縮小で枯渇した事例ほか）。
- **過去の同型障害アラート**: inc-2（`poolShrinkRegression`）は VM 話へ再構築済み（前回の VM 縮小→枯渇→machine_type 戻して解消・subject=`google_compute_instance.backbone`）。inc-1（週末 checkout 負荷）・inc-3（汎用プール枯渇アーカイブ）は **Cloud SQL 語彙を含まず物語とも矛盾しない**（負荷側・症状側の記憶）ため意図的に据置＝全記憶を VM 話に揃えると単調になり、リタイトル後の pr-55（プール縮小）との突合材料も失うため。
- **#83 の D2/D3 パイプライン発火の前提**: PR の plan job は「PR ブランチ×base(develop) のマージ結果」の terraform.yml で走る。D2/D3 改修（commit `2f69b35`）が develop に無い間は旧 plan job（コメント/artifact/ingest なし・plan 実行のみ）。**feature/step7-d を develop へ merge 後、#83 の checks を Re-run** すると plan コメント＋artifact＋ingest が発火する。

### D4 flagship 実話張り替え後の part1/part2 再撮影 ★★★☆☆（Option B に伴い必須化）

take003 は旧 Cloud SQL 表示・plan-1 リンクなしで撮影済み。Option B で plan-1 が「バックボーンVM e2-standard-2→e2-small 縮小」＋「証拠を開く→PR #83」に変わったため、**カット1（予報カード）とカット2（引用チップの証拠を開く）は要再撮影**。ナレは揮発値・リソース名を言わない設計なので**音声台本は不変**、on-screen のみ差分（`script.md` カット1/2 メモ更新済み）。再撮影時は C2 の落とし穴（dedup・`POST /demo/reset` 先行）に注意。plan-1 チップの「証拠を開く」→ PR #83 のクリック解決も収録するとドッグフーディングが映える。

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
