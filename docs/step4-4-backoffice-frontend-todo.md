# Step 4-4 TODO: backoffice/frontend 実装

> 対応設計: `docs/step4-4-backoffice-frontend.md`（feature-sliced・校正版）
> 前提: `step4-3` のAPI/SSEが利用可能。優先度: **P0** / **P1** / **stretch**。
> 構成は feature-sliced（`features/<feature>/{domain,application,infrastructure,presentation}` ＋ `shared/`）。domainは型＋純関数のみ。
> **デザインテーマ（タスク0で確定）**: 「**ダーク観測コンソール × Tremor**」をベース、デモ演出のみネオン系アニメを部分採用（タスク12）。配色トークン・参考URL・採用理由は `step4-4-backoffice-frontend.md`「デザインテーマ」節を正とする。可視化は Tremor（ゲージ/ドーナツ/チャート＝危険度ランク色・confidence割合・予兆グラフ）を `shared/ui/` に薄くラップして使う。
> **インタラクション・フィードバック前提（全タスク共通）**: クリック可能要素は hover/focus-visible/active の視覚反応を持ち、非同期操作は送信前→送信中（disabled・幅固定でシフト無し）→完了の3状態を出す。**mutation 成功後は必ずリソースを再取得して state へ反映**（PATCH/POST が `{ok}` のみ返し SSE push が無いケースがあるため）。詳細は `step4-4-backoffice-frontend.md`「インタラクション・フィードバック原則」節を正とする。

---

##

### タスク 0: step1 フロント節の更新 〔P0・ドキュメント〕 ✅

- [x] 【修正】`docs/step1-directory-structure.md` のフロント構成図を layer-first → feature-sliced に差し替え（step4-4を正とする旨を明記）。設計判断メモの表・構成図・依存関係サマリー・正準注記の4箇所を更新済み
- [x] デザインテーマを決定（**ダーク観測コンソール × Tremor**、演出のみネオン系を部分採用）。配色トークン・参考URL・採用理由は `step4-4-backoffice-frontend.md`「デザインテーマ」節に記載済み

### タスク 1: shared 基盤 〔P0〕 ✅

- [x] 【新規】`shared/api/HttpClient.ts`（interface・HttpError/HttpTimeoutError）/ `FetchHttpClient.ts`（baseURL・クエリ組立・AbortControllerタイムアウト・JSONパース・axios不使用）
- [x] 【新規】`shared/ui/SeverityBadge.tsx`（CRITICAL/WARNING/INFO＋RiskLevel HIGH/MEDIUM/LOW 転用・素のTailwindランク色）＋ `shared/ui/cn.ts`（clsx+tailwind-merge）
- [x] 【新規】`shared/ui/tremor/`（Tremor薄ラッパ：`index.ts` 再エクスポート窓口 / `colors.ts` rankColor・confidenceColor / `ConfidenceGauge.tsx`）。features は @tremor/react を直接importせず本窓口経由
- [x] 【新規】`shared/layouts/AlertsLayout.tsx`（DemoDrawer差し込み口は本レイアウトのみ・slot方式でタスク10連携）/ `DefaultLayout.tsx`
- [x] 【基盤】`tsconfig.json`（bundler/DOM/react-jsx・@shared/@features paths）/ `tailwind.config.js`（Tremor tremor-_/dark-tremor-_ トークン・safelist・darkMode class）/ `postcss.config.js` / `src/index.css`（ダーク基調）。依存追加：@tremor/react・tailwindcss・postcss・autoprefixer・clsx・tailwind-merge
- [x] 検証：`tsc --noEmit` 緑・`tailwindcss` ビルド成功
- 残（タスク7）：`vite.config.ts` / `index.html` / `main.tsx`（index.css読込・`<html class="dark">`）/ `App.tsx`

### タスク 2: alerts/domain（型＋純関数）〔P0〕 ✅

- [x] 【新規】`features/alerts/domain/AlertView.ts`（AlertView/Status/Severity/Category 型・分類/フィードバック view 型・ワイヤ DTO `AlertDto` ＋ `toAlertView` 純関数・`isAnalyzing`/`primaryConfidence`）
- [x] 【新規】`InvestigationReportView.ts`（investigationSteps/suggestedActions/reviewStatus・ReviewStatus 型・`InvestigationReportDto`＋`toInvestigationReportView`・`isReviewed`）
- [x] 【新規】`severity.ts`（severity→バッジランク橋渡し・重大度ソート・confidence→%。配色そのものは shared/ui に一元化し二重管理を回避）
- [x] 検証：`tsc --noEmit` 緑

### タスク 3: alerts/infrastructure（API＋SSE）〔P0〕 ✅

- [x] 【新規】`alertsApi.ts`（`createAlertsApi(http)` ＋ `AlertsApi` interface・GET /alerts→`{alerts}` / GET /alerts/:id / PATCH /alerts/:id/feedback。受信 AlertPrimitives を `toAlertView` で写像・`SubmitFeedbackInput` 型・id encode）
- [x] 【新規】`AlertStream.ts`（interface・push port）/ `SSEAlertStream.ts`（EventSource('/alerts/stream')・CLOSED時のみ手動再接続・heartbeatコメント行は自動無視・壊れた行は握り潰し）/ `MockAlertStream.ts`（emit/listenerCount でテスト・デモ駆動）
- [x] 検証：`tsc --noEmit` 緑

### タスク 4: alerts/presentation hooks 〔P0〕 ✅

- 【新規】`hooks/useAlertStream.ts`（subscribe→state マージ・同一ID置換・ANALYZING→OPEN遷移）/ `hooks/useAlerts.ts`（一覧取得＋ストリームマージ）

### タスク 5: alerts/application 〔P0〕 ✅

- 【新規】`application/submitFeedback.ts`（承認/却下→PATCH feedback）

### タスク 6: alerts ページ・コンポーネント 〔P0〕 ✅

- 【新規】`pages/AlertsPage.tsx`（AlertsLayout）/ `pages/AlertDetailPage.tsx`（DefaultLayout）
- 【新規】`components/AlertList.tsx` / `AlertCard.tsx` / `AlertCardExpanded.tsx`（サマリ・confidence・categoryバッジ・調査ステップ・推奨アクション・[✓承認][✗却下]）

#### 6b: 閲覧モデルを master-detail（右ドロワー）へ改訂 〔P0・UX改善〕 ✅

> **背景**: 当初のカード**インライン展開**はトリアージ性を損ない、confidenceゲージが一覧で浮いていた。`step4-4` 本書「閲覧モデル」節の改訂に合わせて UI を更新。

- [x] 【新規】`shared/ui/tremor/ConfidenceBar.tsx`（ラベル＋横バー＋%。一覧行用。ドーナツ `ConfidenceGauge` は詳細ドロワー専用に格上げ）＋ `tremor/index.ts` から再エクスポート
- [x] 【改修】`AlertCard.tsx`：インライン展開を廃し**1行のマスター**へ（severity カラーストライプ・相対時刻＋絶対時刻ツールチップ・eventName・source＋summary 1行省略・`ConfidenceBar`・`selected`/`onSelect`）
- [x] 【新規】`AlertDetailDrawer.tsx`：右オーバーレイ詳細（背景 dim・Esc/バックドロップ/✕ で閉・大きい `ConfidenceGauge`・本体は `AlertCardExpanded` 再利用・`/alerts/:id` リンク）
- [x] 【改修】`AlertList.tsx`（`selectedId`/`onSelect`）/ `AlertsPage.tsx`（選択 state・`alerts.find(id)` で SSE をドロワーへライブ反映）
- [x] 検証：`tsc --noEmit` 緑 / 対象テスト 20 件緑（`AlertCard`/`AlertList`/`AlertDetailDrawer`）

#### 6c: フィードバック反映バグ修正＋操作フィードバック 〔P0・bugfix〕 ✅

> **不具合**: 承認/却下を押しても画面が揺れるだけで「承認済み/却下済み」にならない。原因はバックエンドは reviewStatus を更新済みだが、フロントが PATCH 後に state を更新していなかった（PATCH は `{ok:true}` のみ返し SSE push も無い）。

- [x] 【改修】`useAlerts.refreshAlert(id)` / `useAlert.refresh()` を追加し、`AlertsPage`/`AlertDetailPage` の `handleDecision` で**送信成功後に再取得→マージ**（ドロワー・詳細へ即時反映）
- [x] 【改修】`AlertCardExpanded` の承認/却下ボタンに hover/focus-visible/active(scale) を付与し、`min-w` でラベル差し替え時のレイアウトシフト（“揺れ”）を解消
- [x] 検証：`tsc --noEmit` 緑 / alerts feature テスト 34 件緑

#### 6d: 初見可読性（視覚階層＋オリエンテーション）〔P0・UX改善〕 ✅

> **背景**: 「初見でどういう画面か分からない／詰め詰めで内容が入ってこない」。根因は密度より (1) 視覚階層の逆転（副次の確信度バーが主役より目立つ）、(2) 文脈不在（画面の説明・件数・状態・凡例が無い）。

- [x] 【新規】`shared/ui/tremor/ConfidenceChip.tsx`（「確信度 90%」のコンパクト表示。一覧行はバーからチップへ降格）
- [x] 【新規】`components/AlertStatusBadge.tsx`（分析中／レビュー待ち／承認済み／却下済み／未調査を reviewStatus から導出。一覧行・ドロワー header で共用）
- [x] 【新規】`components/AlertsHeader.tsx`（説明文＋件数サマリ〔total・CRITICAL・レビュー待ち、ready時のみ〕＋凡例）。`AlertList` 上部に常設
- [x] 【改修】`AlertCard.tsx`：階層を ①eventName主役＋状態バッジ ②従属メタ（severity/category/source/時刻）③副次（summary＋確信度チップ）へ再配分
- [x] 検証：`tsc --noEmit` 緑 / frontend テスト 40 件緑（`AlertStatusBadge`/`AlertsHeader` テスト追加）

#### 6e: 業務文脈・トリアージ順・空間配置 〔P0・UX改善〕 ✅

> **背景**: 「①総件数(8件)が指標にならない ②時系列だと未処理が埋もれる ③eventName が機械名で業務的に分からない ④右に散って間延び・要素が小さい」。

- [x] 【新規】`domain/eventDomain.ts`（`eventDomainLabel`: eventName 接頭辞→注文/在庫/決済… 日本語化。未知は null）＋ UT
- [x] 【新規】`domain/alertSort.ts`（`sortForTriage`/`compareForTriage`: 未処理↑→重大度降順→時刻降順の純関数・安定ソート）＋ UT。`AlertList` で表示時に適用
- [x] 【改修】`AlertCard.tsx`：2ゾーン化（左=ドメインラベル＋eventName主役/メタ/summary、右=固定幅レールに状態＋確信度を集約）・タイトル `text-base` へ拡大。`AlertList` を `max-w-4xl` に幅制約
- [x] 【改修】`AlertsHeader.tsx`：総件数チップを廃し actionable（レビュー待ち・分析中>0・CRITICAL）のみに
- [x] 検証：`tsc --noEmit` 緑 / frontend テスト 48 件緑（`eventDomain`/`alertSort` UT 追加）

#### 6f: 「何が・なぜ」提示＋既知アラート対応＋視認性 〔P0・UX改善〕 ✅

> **背景**: 「①対象サービスの説明が無い ②グレー文字が読みづらい ③要素が小さい ④確信度だけで対象/理由が分からない ⑤未調査って実在する？」。調査の結果、**全アラートは known/unknown の2種別**で、フロントは known の `classification`（patternName・matchedConditions）を丸ごと捨てていた＝「何が・なぜ」が空。「未調査」状態は実在せず、それは既知パターン一致の誤ラベルだった。

- [x] 【視認性】#2/#3: 本文を `text-base/lg`＋明色（slate-50/200/300、アクセント cyan）に。状態バッジ・確信度チップも拡大
- [x] 【新規】`config/eventDomains.json`（label＋description）＋ `domain/eventDomain.ts` を JSON 駆動に（`eventDomain`/`eventDomainLabel`）。行は hover ツールチップ、ドロワーに説明文
- [x] 【新規】`domain/alertReason.ts`（known→patternName / unknown→suggestedPatternName / analyzing）＋ UT。行③に「該当/AI推定: パターン名」を表示し確信度の対象を明示
- [x] 【新規】`domain/alertReview.ts`（feedback ベースの `alertReviewState`/`isAlertReviewed`）＋ UT。`AlertStatusBadge` を feedback ベースに（「未調査」廃止・既知/未知統一）
- [x] 【改修】`AlertView`: `classification.matchedConditions` を View へ追加（従来は欠落）
- [x] 【改修】`AlertCardExpanded`: 既知=該当パターン名＋一致根拠、未知=summary/steps/actions を提示。**既知アラートも承認/却下可能**に（feedback ベース）。`AlertDetailDrawer` ヘッダにドメイン説明
- [x] 検証：`tsc --noEmit` 緑 / frontend テスト 55 件緑（`alertReason`/`alertReview` UT・既知パターン UT 追加）

#### 6g: 人間語マッピング＋分析中の重要度判定中＋タイトル主役化 〔P0・UX改善〕 ✅

> **背景**: 「①即対応ニーズ→分析中は重要度未確定と出すべき ②eventName だけでは分からない ③表のほうが分かりやすい？ ④category(APPLICATION 等) や payment/order が機械語で『これ何？』」。障害ツールとして作業者の認知コストを下げる。

- [x] 【新規】`config/eventCatalog.json`＋`domain/eventCatalog.ts`（eventName→人間語タイトル＋説明）。`AlertCard` の主役を人間語タイトルに、eventName は技術IDとして併記/未登録はフォールバック。旧 `eventDomains.*` は統合・削除
- [x] 【新規】`config/alertCategories.json`＋`domain/alertCategory.ts`（APPLICATION→「アプリ層」等の人間語＋説明）。行・ドロワーの category を人間語チップ＋tooltip に
- [x] 【改修】#1: 分析中は severity 未確定（backend が WARNING 固定）のため、バッジ・ストライプを「重要度 判定中」(neutral) に
- [x] 【改修】`AlertDetailDrawer` ヘッダも人間語タイトル＋説明＋人間語 category に
- [x] 検証：`tsc --noEmit` 緑 / frontend テスト 58 件緑（`eventCatalog`/`alertCategory` UT 追加）
- [x] #3: 一覧は**カード維持**で決定。代わりにドロワーの「一致した根拠」を**テーブル（項目/期待値/実値）**に変更（field・期待・実値が整列して読みやすい）

### タスク 7: App.tsx ルーティング 〔P0〕 ✅

- 【新規】`App.tsx`（/alerts, /alerts/:id, /analytics）/ `main.tsx`

> ✅ **ここまででシナリオ1・2・3がUIでリアルタイムに動く（SSEで分析中→結果）。**

---

## P1: 差別化

### タスク 8: 証拠パネル 〔P1〕

- 【新規】`features/alerts/domain/EvidenceView.ts` / `infrastructure/evidenceApi.ts`
- 【新規】`components/EvidencePanel.tsx`（Cloud Logging/Terraform/GitHub の証拠が**到着ごとに積み上がる**演出＝自律性の可視化）
- シナリオ4の見せ場

### タスク 9: リメディエーション（SECURITY）〔P1〕

- 【新規】`features/alerts/domain/RemediationView.ts` / `infrastructure/remediationApi.ts` / `application/approveRemediation.ts`
- 【新規】`components/RemediationPanel.tsx`（CVE概要・修正PRリンク・[✓承認][✗却下]）
- シナリオ5の見せ場

### タスク 9b: 調査ステップ／推奨アクションのリンク化 〔P1〕

> **背景**: 現状 `AlertCardExpanded` の調査ステップ・推奨アクションは **プレーンテキスト**（seed/LLM の文字列をそのまま列挙）。作業者は「どこを見ればいいか」をテキストから自力で辿る必要があり、障害対応の動線として弱い。外部サービス（GitHub / Cloud Logging / Cloud Console / Runbook）への **ディープリンク** で飛べるようにして、調査の実行コストを下げる。
> **接続方針**: 既に基盤は揃っている — タスク8 `EvidencePanel`（Cloud Logging / Terraform / GitHub の証拠提示）とタスク9 `RemediationPanel`（修正 PR リンク）が外部連携の入口。本タスクはそれを **調査ステップ／アクション行**にも広げる位置づけ。
> **データ形状の選択肢**（contracts `InvestigationReportPrimitives` の拡張要否）:
>   - (a) **後方互換・フロント補完**: 文字列のまま受け取り、frontend が URL 検出（`/https?:\/\//`）でリンク化。最小コスト・LLM 非依存だが精度は文字列頼み。
>   - (b) **契約拡張（推奨）**: `investigationSteps` / `suggestedActions` を `{ text; href?; kind? }` の構造化型へ拡張し、backend（LLM プロンプト or evidence 連携）が `href`（GitHub Issue/PR・Cloud Logging クエリ URL・Runbook）を埋める。表示側は `kind`（log/code/runbook）でアイコン分け。
> 採用は (b) 寄り。まず contracts に optional `href`/`kind` を足し（後方互換）、seed から URL 付きで配信して体験を作る。

- [ ] 【設計】contracts `InvestigationReportPrimitives` に step/action の構造化（optional `href`/`kind`）を追加するか決定（上記 (a)/(b)）
- [ ] 【新規/改修】`InvestigationReportView` ＋ `toInvestigationReportView` を構造化型へ拡張（後方互換: 文字列も受ける）
- [ ] 【改修】`AlertCardExpanded` の調査ステップ／推奨アクションを、`href` があれば外部リンク（新規タブ・`rel="noopener"`・kind アイコン）に
- [ ] 【seed】E2E/デモ seed に GitHub/Cloud Logging のサンプル URL を付与し動線を可視化
- 補足（#4 `suggestedPatternName` の扱い）: これは **LLM が生成する自由記述ラベル**（eventName/category のような閉じた語彙ではない）。よって eventCatalog のような JSON マッピングは不適。**検索キーではなく表示用の人間語ラベル**（検索キーは `patternId`/`eventName`）。本番プロンプトで「日本語の読めるパターン名」を要求し、フロントはそのまま表示する方針。StubLLMClient のスラッグは人間語ラベルへ修正済み。

### タスク 10: demo ドロワー 〔P1〕

- 【新規】`features/demo/infrastructure/demoApi.ts` ＋ `presentation/`: `DemoDrawer.tsx` / `ScenarioControls.tsx`（シナリオ1〜5）/ `PaymentModeToggle.tsx` / `SystemStatus.tsx` / `hooks/useDemoControls.ts`
- AlertsLayout のみに差し込む（プロダクションUI非侵食）

### タスク 11: analytics 〔P1〕

- 【新規】`features/analytics/infrastructure/analyticsApi.ts` / `presentation/pages/AnalyticsPage.tsx`

---

## stretch

### タスク 12: デモ演出の磨き込み 〔stretch〕

- 証拠到着アニメーション、confidenceゲージ、reviewStatus遷移のトランジション
- 審査の体験価値（基準3・4）に直結。**設計よりここに時間を割く価値が高い**

#### ROI の高い演出（master-detail 改訂を踏まえた優先順）

> **意図**: 閲覧モデルを「一覧（マスター）＋右ドロワー（detail）」に改めたため、**演出の主舞台が2面に分かれた**。録画で効くのは「①一覧で“異変が起きる”→②ドロワーで“AIが調べる過程”が見える」の2段。下記は録画映え／実装コストの ROI 降順。

- [ ] **ドロワーのスライドイン＋背景 dim**（最優先・低コスト）：行クリックで右から滑り込む。master-detail への改訂を“気持ちよさ”として体験させる土台。`transition` ＋ `translate-x` で実装、`prefers-reduced-motion` 尊重。
- [ ] **一覧行の ANALYZING→OPEN 遷移演出**（高 ROI）：分析中インジケータ（実装済の cyan パルス）→ 解決時に行がフラッシュ＋`ConfidenceBar` が 0→確信度へアニメ。一覧を見ているだけで“勝手に解決していく”様子が伝わる＝自律性の可視化。
- [ ] **ドロワー内の証拠積み上げ**（タスク8連動・本命）：`EvidencePanel` の証拠行が SSE 到着ごとに1つずつ stagger フェードイン。**“AIが調べている過程”の主演出**。ドロワーに移したことで一覧を潰さず大きく見せられる。
- [ ] **confidence ゲージのカウントアップ**（中）：ドロワーを開いた瞬間に 0%→確信度へ。大ゲージをドロワー専用に格上げした狙い（一覧では横バーで静か・詳細では動かして主役）を活かす。
- [ ] **reviewStatus トランジション**（低コスト）：[✓承認]/[✗却下] 押下でボタン→ステータスバッジへフェード差し替え。
- 演出は `features/demo` 寄せ or `shared/ui` の薄いラッパに限定し、プロダクションUIを侵食しない（本書「採用ライブラリ」方針）。

---

## stretchⅡ: 予兆ブリーフィング UI

> **着手条件**: P0 ＋ P1 ＋ 既存stretch 着地後。設計は `step4-4`「予兆ブリーフィングUI」節。既存featureは無傷で `features/forecast/` を新設するだけ。

### タスク 13: forecast feature slice 〔stretchⅡ〕

- 【新規】`features/forecast/domain/ForecastView.ts`（RiskItem→level色）/ `RiskLevel.ts`（純関数のみ）
- 【新規】`features/forecast/infrastructure/forecastApi.ts`（POST /forecast, GET /forecast）/ `application/triggerForecast.ts`
- 【新規】`presentation/pages/ForecastPage.tsx`（リスク一覧・level降順）
- 【新規】`components/RiskCard.tsx`（window・subject・level バッジ・confidenceゲージ・reasoning）/ **`CitationList.tsx`（引用チップ＝根拠の明示・ハルシネーション否定の可視化・本機能の体験の肝）**
- 【修正】`App.tsx` に `/forecast` 追加（`FORECAST_ENABLED` off時はナビ非表示）
- `shared/`（HttpClient/SeverityBadge/layouts）流用。`SeverityBadge` を RiskLevel に転用
- デモシナリオ6（録画）: `/forecast` トリガー → 引用付きリスク降下演出

---

## stretchⅢ: イベントソーシング予知ビュー UI（設計のみ・実装はハッカソン後）

> **着手条件**: stretchⅡ 着地後。設計は `step4-4`「stretchⅢ」節 ＋ `step4-1` §7.10。

### タスク 14: PRECURSOR 引用チップの表示 〔stretchⅢ〕

- **UI 追加はほぼ不要**。stretchⅢ は予知の入力源が1つ増えるだけで出力は同じ `RiskForecast`。`ForecastPage` / `RiskCard` / `CitationList` はそのまま使える
- 強いて足すなら `CitationList` に `ForecastSignalKind=PRECURSOR`（event log 由来＝直近イベント列）の引用チップ種別を1つ追加（色分け）。既存 feature 無傷
