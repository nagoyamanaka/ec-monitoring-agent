# Step 4-4: backoffice/frontend 設計（React CSR・feature-sliced）

> **Step4 を4分割したうちの「backoffice/frontend」担当。**
> バックエンド（`step4-3`）のAPI/SSEを消費するReact CSR UIに責務を限定する。
> **本書は step1 のフロント節（layer-first）を feature-sliced に更新するもので、こちらを正とする。**
>
> 前提: `step4-3-backoffice-backend.md` のAPIが利用可能。

---

## デザインテーマ（タスク0で確定）

**方針: 「ダーク観測コンソール × Tremor」をベース、デモ演出のみネオン系アニメを部分採用（タスク12）。**

監視・アラート＋AI調査レビューという題材と、デモの体験価値（①リアルタイムに動く過程の可視化 ②危険度のランク別表示 ③レポートの割合/ゲージ表示 ④予兆のグラフ表示）すべてに最も相性が良いため。

### 選定理由（要件 → 効くタスク）

| 体験要件 | 関係タスク | テーマでの担保 |
| -------- | ---------- | -------------- |
| 動く過程をリアルタイムに見やすく | タスク4 `useAlertStream`（ANALYZING→OPEN）/ タスク8 `EvidencePanel`（証拠の積み上げ） | ダーク基調はストリーム/ログの逐次更新が最も読みやすく緊張感が出る |
| 危険度をランク別で | タスク2 `severity.ts` / `SeverityBadge` / タスク13 `RiskLevel`(HIGH/MEDIUM/LOW) | オブザーバビリティ標準配色（赤/橙/青）をランク色に採用 |
| レポートを割合・視覚的に | confidence→% / confidenceゲージ（タスク6/12）/ タスク11 analytics | **Tremor** のゲージ/ドーナツ/チャートで実装コスト最小化 |
| 予兆をグラフで | タスク13 `ForecastPage` / `RiskCard` / シナリオ6の降下演出 | グラフは Tremor、降ってくる演出は③ネオン系アニメを部分採用 |

### 採用ライブラリ

- **可視化: [Tremor](https://www.tremor.so/)** — ゲージ/ドーナツ/エリアチャート/カテゴリ色（ランク色）が標準装備・ダーク対応。`confidenceゲージ`・`analytics`・`forecastグラフ` をほぼ実装ゼロで賄う。`shared/ui/` に薄くラップして features から参照。
- **演出（タスク12のみ）: [Aceternity UI](https://ui.aceternity.com/)** 的なフェード/グロー — 証拠積み上げ・シナリオ6のリスク降下に部分採用。プロダクションUIには持ち込まない（デモ演出に限定）。

### デザイントークン（暫定・実装時に調整可）

```
背景      bg      #0B0E14   surface #151A23   border #232A36
テキスト  text    #E5E7EB   muted   #94A3B8
アクセント accent  cyan #22D3EE（リンク/フォーカス/アクティブ）
ランク色  CRITICAL/HIGH #F43F5E   WARNING/MEDIUM #F59E0B   INFO/LOW #38BDF8
confidence ゲージ  低→高で #F43F5E → #F59E0B → #22C55E のグラデーション
```

### 参考にした方向性（比較検討）

- **採用①: ダーク観測コンソール** — [Datadog](https://www.datadoghq.com/dashboards/) / [Grafana(play)](https://play.grafana.org/) / [Sentry](https://sentry.io/welcome/) / [shadcn/ui dashboard(dark)](https://ui.shadcn.com/examples/dashboard)
- 不採用②: ライト・エンタープライズ — [Linear](https://linear.app/) / [Vercel](https://vercel.com/) / [shadcn/ui tasks](https://ui.shadcn.com/examples/tasks)（緊張感・没入感で①に劣る）
- 部分採用③: ダーク＋ネオン — [Tremor](https://www.tremor.so/) / [Aceternity UI](https://ui.aceternity.com/)（録画映えは最強だが情報密度の高いP1/stretchⅢで可読性が不利。演出のみ採用）

---

## アーキテクチャ判断：feature-sliced DDD（校正版）

レイヤーを feature 配下に切るが、**各レイヤーの粒度を校正する**（過剰設計回避）。

| レイヤー | 置くもの | 置かないもの |
| -------- | -------- | ------------ |
| `domain/` | **型＋純粋なview-logic**（`AlertView`型、severity→色、confidence整形） | 集約・ふるまい・`DomainService`（バックエンドの責務） |
| `application/` | 薄いユースケース（`submitFeedback` / `approveRemediation`） | 重いオーケストレーション。hooksに畳んでよい |
| `infrastructure/` | **APIクライアント＋SSE**（HttpClient依存、`AlertStream`実装） | — ここが最も価値ある抽象 |
| `presentation/` | pages / components / hooks | ビジネスロジック |

> **原則**: フロントの `domain` は「型＋純関数」。バックエンドの集約を複製しない。`UserDomainService` 相当はクライアント側に本物の不変条件がある時だけ（今回は無し）。

---

## ディレクトリ

```
src/apps/backoffice/frontend/src/
├── main.tsx
├── App.tsx                          # React Router ルーティング
│
├── features/
│   ├── alerts/                      # メイン機能
│   │   ├── domain/
│   │   │   ├── AlertView.ts         # 表示用型（classification.confidence / category 等）
│   │   │   ├── InvestigationReportView.ts  # investigationSteps / suggestedActions / reviewStatus
│   │   │   ├── EvidenceView.ts      # InfraEvidence の表示型（appLogs/terraformDiff/recentCommits）
│   │   │   ├── RemediationView.ts   # PR URL / ステータス
│   │   │   └── severity.ts          # 純関数: severity→バッジ色、confidence→%表記
│   │   ├── application/
│   │   │   ├── submitFeedback.ts    # 承認/却下 → PATCH /alerts/:id/feedback
│   │   │   └── approveRemediation.ts# 承認 → POST /alerts/:id/remediation/draft-pr
│   │   ├── infrastructure/
│   │   │   ├── alertsApi.ts         # GET /alerts, GET /alerts/:id, PATCH feedback（HttpClient依存）
│   │   │   ├── evidenceApi.ts       # GET /alerts/:id/evidence, /investigation/status
│   │   │   ├── remediationApi.ts    # POST draft-pr, GET remediation
│   │   │   ├── AlertStream.ts       # SSEストリーム interface（Mock差し替え可能）
│   │   │   └── SSEAlertStream.ts    # AlertStream の SSE 実装（/alerts/stream）
│   │   └── presentation/
│   │       ├── pages/
│   │       │   ├── AlertsPage.tsx        # /alerts（デモのメイン舞台）
│   │       │   └── AlertDetailPage.tsx   # /alerts/:id（フル詳細・調査プロセス全表示）
│   │       ├── components/
│   │       │   ├── AlertList.tsx
│   │       │   ├── AlertCard.tsx          # 一覧の1行（severityストライプ・summary・確信度横バー）。クリックで選択
│   │       │   ├── AlertDetailDrawer.tsx  # 右オーバーレイ詳細ドロワー（confidenceゲージ＋AlertCardExpanded）
│   │       │   ├── AlertCardExpanded.tsx # AI分析結果＋調査ステップ＋[✓承認][✗却下]（ドロワー本体／詳細ページで共用）
│   │       │   ├── EvidencePanel.tsx     # Cloud Logging/Terraform/GitHub 証拠の積み上げ可視化
│   │       │   └── RemediationPanel.tsx  # CVEレポート＋PRリンク＋承認ボタン（SECURITY）
│   │       └── hooks/
│   │           ├── useAlertStream.ts     # SSE接続（AlertStream interfaceを利用）
│   │           └── useAlerts.ts          # 一覧取得＋ストリームのマージ
│   │
│   ├── analytics/
│   │   ├── infrastructure/analyticsApi.ts
│   │   └── presentation/pages/AnalyticsPage.tsx
│   │
│   └── demo/                         # デモ系を完全に閉じ込める（プロダクションUI非侵食）
│       ├── infrastructure/demoApi.ts
│       └── presentation/
│           ├── DemoDrawer.tsx        # AlertsLayoutのみで参照
│           ├── ScenarioControls.tsx  # シナリオ1〜5実行ボタン
│           ├── PaymentModeToggle.tsx
│           ├── SystemStatus.tsx      # RabbitMQ接続・SSE接続数・インシデント数
│           └── hooks/useDemoControls.ts
│
└── shared/
    ├── api/
    │   ├── HttpClient.ts             # interface（プロトコル非依存）
    │   └── FetchHttpClient.ts        # fetch実装（baseURL・エラー・タイムアウト）。axios不使用
    ├── ui/
    │   └── SeverityBadge.tsx         # CRITICAL/WARNING/INFO
    └── layouts/
        ├── AlertsLayout.tsx          # /alerts 専用（DemoDrawerをここだけで参照）
        └── DefaultLayout.tsx         # /alerts/:id, /analytics（DemoDrawer非表示）
```

---

## 依存関係ルール

```
presentation → application, domain, infrastructure(interface)
application  → infrastructure(interface), domain
infrastructure → shared/api(HttpClient), domain
domain        → （依存なし。純粋）

features/* → shared/*（逆は不可）
features間の直接依存は禁止（共有は shared に上げる）
AlertsLayout → features/demo/DemoDrawer（ここだけ）。DefaultLayout は参照しない
```

---

## SSE の扱い（最重要）

SSEは **infrastructureの関心事**。interfaceで抽象化し、hookが消費する。

```typescript
// features/alerts/infrastructure/AlertStream.ts
interface AlertStream {
  subscribe(onAlert: (alert: AlertView) => void): () => void; // 戻り値はunsubscribe
}

// SSEAlertStream.ts … EventSource('/alerts/stream') 実装。再接続・heartbeat無視
// MockAlertStream … テスト/デモ用（差し替え可能にする価値が実在）
```

```
useAlertStream():
  1. AlertStream.subscribe() で購読
  2. 受信 alert を state にマージ（同一IDは置換）
     - 未知障害は最初 ANALYZING（「分析中」表示）→ 数秒後に OPEN ＋ 調査結果で再push
  3. unmount で unsubscribe
```

> **デモの核**: 「分析中 → 証拠が1つずつ積み上がる → AI推定が確信度付きで出る → 承認」がSSEでリアルタイムに動く様子。`EvidencePanel` は証拠到着ごとに行が増える演出にする。

---

## 画面と表示内容

| パス | 役割 | DemoDrawer |
| ---- | ---- | ---------- |
| `/alerts` | 一覧（マスター）＋クリックで**右オーバーレイ・詳細ドロワー** | **常時表示**（デモ舞台） |
| `/alerts/:id` | フル詳細（調査プロセス全表示・PR詳細・ディープリンク） | 非表示 |
| `/analytics` | AI精度トラッキング | 非表示 |

### 閲覧モデル：マスター詳細（右ドロワー）〔当初のインライン展開から改訂〕

> **改訂理由**: 当初は「カードのインライン展開（アコーディオン）」を正としていたが、(1) 展開で下のカードが押し下げられ**一覧の文脈（トリアージ性）を失う**、(2) confidenceゲージ・証拠パネルがカード内で窮屈、(3) Datadog/Sentry/Grafana など観測コンソールの定石（master-detail）と乖離、という3点から **「一覧＋右オーバーレイ・ドロワー」に改める**。

- **一覧行（`AlertCard`）** は**2ゾーン構成**で、視覚階層を主役→従属→副次に固定する（初見可読性の核）。
  - **左ゾーン（内容）**: ① **主役 = 人間語タイトル（`eventTitle`／`config/eventCatalog.json`）**（`text-lg`・最も明るい `slate-50`）。機械イベント名（`ec.payment.timeout`）は作業者に伝わらないため、eventName→人間語（「決済タイムアウト」）に写像して主役にし、**eventName は技術ID として小さく併記**（カタログ未登録時のみ eventName を主役にフォールバック）。② **従属メタ**: severity・**category（人間語：`categoryInfo`／`config/alertCategories.json`。APPLICATION→「アプリ層」等。hover で説明）**・相対時刻（hover で絶対時刻）・**発生回数チップ「×N」（`occurrenceCount > 1` のときのみ）**。左に severity カラーストライプ。**「×N」は重複観測の畳み込み（同一 dedupKey）の件数**＝障害時にカードを乱立させず1枚＋件数で見せる（アラート嵐の抑制。backend の `Alert.occurrenceCount` を `AlertView` 経由で表示・hover で説明）。**分析中は severity が未確定（backend が WARNING 固定）なので、バッジ・ストライプとも「重要度 判定中」(neutral) で出す**（即対応ニーズに対し誤った重大度で誘導しない）。③ **副次 = 推定原因（`alertReason`）**: known は「該当: 〈patternName〉」、unknown は「AI推定: 〈suggestedPatternName〉」、分析中は「調査中…」。**確信度はこの推定対象に対する値**として右レールの確信度チップと対で意味を持つ（「確信度だけ出して対象不明」を避ける）。
  - **右ゾーン（固定幅レール）**: **対応状態バッジ（`AlertStatusBadge`）＋確信度チップ（`ConfidenceChip`）を集約**。状態と確信度を右端に分散させず1つのレール（区切り線付き）にまとめることで、ワイド画面でも**間延びしない**。確信度は当初の全幅バーから階層逆転回避のためチップへ降格（バー `ConfidenceBar` は analytics 用に残置、ドーナツ `ConfidenceGauge` は詳細ドロワー専用）。
  - **幅制約**: 一覧は `max-w-4xl` に収め、行が横に伸びすぎて視線が散るのを防ぐ。
- **トリアージ・ソート（`sortForTriage`）**: 一覧は時系列ではなく**「上から潰せばよい」並び**にする。① 未処理を上 / 処理済み（承認・却下）を下、② 重大度降順、③ 発生時刻降順。安定ソートで同点は元順を保つ。
- **オリエンテーション・ヘッダ（`AlertsHeader`）** を一覧上部に常設し、初見でも「何の画面か」を伝える: (a) 一文説明（AI が検知・分類・調査→人が承認/却下でレビュー）、(b) **作業指標になる件数のみ**（レビュー待ち・分析中・CRITICAL。総件数は出さない＝文脈なしの数字を避ける。ready 時のみ）、(c) 凡例（重大度色・確信度の意味）。
- **詳細ドロワー（`AlertDetailDrawer`）** は `fixed` の右オーバーレイ（背景 dim ＋ Esc/バックドロップ/✕ で閉）。**大きい confidence ゲージはここに置く**（本来の意味を持つ場所）。本体は `AlertCardExpanded` を再利用（summary・調査ステップ・推奨アクション・[✓承認][✗却下]）し、証拠パネル（タスク8）・リメディエーション（タスク9）を差し込む。フッタに `/alerts/:id` へのリンク（ディープリンク用）。
- **オーバーレイにする理由**: AlertsLayout の demo aside（右 20rem・タスク10）と物理的に重ねられる＝3カラム化で横が窒息しない。SSE 更新は `alerts.find(id)` 経由で**ドロワーにもライブ反映**される（選択中の alert が ANALYZING→OPEN で更新されると詳細も追従）。

### インタラクション・フィードバック原則〔全コンポーネント共通の前提〕

> **前提**: 操作に対する**即時の視覚フィードバック**と、**操作結果の state 反映**を必須要件とする。観測コンソールはオペレータが「自分の操作が効いたか」を確信できることが信頼の土台になるため。

- **ホバー / フォーカス / 押下の視覚反応**: クリック可能要素は hover（背景・ring）、focus-visible（リング）、active（`scale-95` 等の押し込み）を必ず持つ。キーボード操作可能にする（`focus-visible`）。
- **非同期操作の3状態を出す**: 送信前 / 送信中（`disabled`＋「送信中…」等のラベル）/ 完了（結果表示へ差し替え）。**ラベル差し替えでレイアウトシフトを起こさない**（`min-w` 等で幅を固定）。
- **mutation 後は必ず state に反映する**: PATCH/POST は `{ok:true}` しか返さず SSE push も無いケースがある（例: `PATCH /alerts/:id/feedback`）。**送信成功後に該当リソースを再取得してマージ**し、画面（一覧ドロワー・詳細）へ即時反映する。「サーバは更新されたのに画面が変わらない」を作らない（`useAlerts.refreshAlert` / `useAlert.refresh`）。
- **reduced-motion 尊重**: 演出系トランジションは `prefers-reduced-motion` を尊重する。

### アラートの2種別と「何が・なぜ」の提示〔重要・データ仕様〕

> backend（`AnalyzeAlertUseCase`）は全アラートを必ず次のどちらかにする。フロントは**両方の説明データを必ず提示する**（当初は classification を捨て known アラートで「何が・なぜ」が空だった）。

| 種別 | status | 説明データ | confidence |
| ---- | ------ | ---------- | ---------- |
| **既知パターン一致**（known） | `OPEN` | `classification.patternName` ＋ **`matchedConditions`（一致根拠）** | classification.confidence |
| **未知**（unknown） | `ANALYZING`→調査後 `OPEN` | `investigationReport`（summary・調査ステップ・推奨アクション） | report.confidence |

- **「未調査」状態は実在しない**（分類器は必ず known/unknown を返し、unknown は即 ANALYZING）。OPEN かつ report 無しは**既知パターン一致**であって未調査ではない。状態バッジ（`AlertStatusBadge`）はこれを「未調査」と誤表示しない。
- **レビュー状態は `feedback` ベース（`alertReviewState`）**で既知・未知を統一（known は `investigationReport` を持たず `reviewStatus` で判定できないため）。これにより**既知アラートも承認/却下できる**。
- **人間語マッピングは presentation 側の static JSON に外出し**（本決定前の差し替え・将来のデータ移行が容易）。機械語をそのまま出さず必ず写像を通すことで作業者の認知コストを下げる:
  - `config/eventCatalog.json`: eventName → タイトル＋説明（行の主役・ドロワー説明）。未登録は eventName にフォールバック。
  - `config/alertCategories.json`: category → ラベル＋説明（人間語チップ・tooltip）。
  - （旧 `eventDomains.json` は eventCatalog に統合・廃止＝より具体的な per-event タイトルが上位互換のため。）

`AlertCardExpanded`（ドロワー本体／詳細ページ共用）の表示要素:
- **推定原因**: known=該当パターン名、unknown=AI推定パターン名
- **一致根拠**（known のみ）: `matchedConditions` を**テーブル表示**（項目／期待値／実値の3列）＝「なぜそう判断したか」を整列して読ませる（一覧はカード維持、ドロワー内のこの根拠のみ表形式）
- 原因仮説サマリー・調査ステップ・推奨アクション（unknown の `investigationReport`）
- 確信度（confidence）・category バッジ
- 証拠パネル（`EvidencePanel`）: Cloud Logging / Terraform / GitHub の3ソース
- SECURITY時は `RemediationPanel`: CVE概要＋修正PRリンク＋[✓承認][✗却下]
- 操作: `PATCH /alerts/:id/feedback` に reviewStatus 送信

---

## HTTPクライアント方針（step1踏襲）

- `HttpClient` interface ＋ `FetchHttpClient` 実装（axios不使用＝サプライチェーンリスク回避）。
- `*Api.ts` は interface に依存しテスト時モック差し替え可能。
- REST は抽象化しない（プロトコル変更シナリオが非現実的）。SSEのみ `AlertStream` で抽象化。

---

## step1 との差分（要反映）

step1 のフロント節は layer-first（`pages/ components/ hooks/ infrastructure/`）。本書の feature-sliced が正。step1 側のフロント構成図は本構成に合わせて更新する（TODO: `step4-4-backoffice-frontend-todo.md` のタスクに含む）。

---

## 予兆ブリーフィング UI（stretchⅡ）

> **位置づけ**: P0 ＋ P1 ＋ 既存stretch 着地後の capstone。設計全体は `step4-1` 7章、API は `step4-3`「予兆ブリーフィング配線」節。本節は **UI（feature slice）** に限定。既存 feature は無傷で `features/forecast/` を新設するだけ。

### feature slice（新設）

```
features/forecast/
  domain/        ForecastView.ts（RiskItem→level色・confidence→%）/ RiskLevel.ts（純関数のみ）
  infrastructure/ forecastApi.ts（POST /forecast, GET /forecast）
  application/   triggerForecast.ts（生成トリガー）
  presentation/
    pages/ForecastPage.tsx（リスク一覧・level降順）
    components/
      RiskCard.tsx（window・subject・level バッジ・confidence）
      CitationList.tsx（★引用チップ: PR#123 / schedule / incident#7 を可視化＝根拠の明示）
```

### 表示の肝

- **引用チップ（`CitationList`）が主役**。各リスクが「どの未来シグナル × どの過去事例」を根拠にしたかをチップで明示し、**ハルシネーションでない＝根拠ありを視覚化**する。これが「効く出力」の体験価値。
- `RiskCard`: 時間窓（"土20:00"）・対象（subject）・level バッジ（HIGH/MEDIUM/LOW）・confidence ゲージ・reasoning 文。
- ルーティングに `/forecast` を追加。`FORECAST_ENABLED` off 時はナビ非表示（本番非侵食）。
- デモシナリオ6: `/forecast` でトリガー → 引用付きリスクが降ってくる演出（録画前提・ライブ安定化は不要）。

### 既存との関係

- 既存 `features/alerts` / `features/demo` / `features/analytics` はノータッチ。
- `shared/`（HttpClient/FetchHttpClient/SeverityBadge/layouts）を流用。`SeverityBadge` は RiskLevel にも転用可。

### stretchⅢ（イベントソーシング予知ビュー）でのUI

> 設計のみ。実装はハッカソン後（`step4-1` §7.10）。

- **UI 追加はほぼ不要**。stretchⅢ は予知の**入力源**（event log 由来の `PRECURSOR` シグナル）が1つ増えるだけで、出力は同じ `RiskForecast`。`ForecastPage` / `RiskCard` / `CitationList` はそのまま使える。
- 強いて足すなら `CitationList` の引用チップに「event log 由来（直近イベント列）」の種別表示を1つ増やす程度（`ForecastSignalKind=PRECURSOR` の色分け）。既存 feature 無傷の追加。
