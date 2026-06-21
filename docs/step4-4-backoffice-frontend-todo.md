# Step 4-4 TODO: backoffice/frontend 実装

> 対応設計: `docs/step4-4-backoffice-frontend.md`（feature-sliced・校正版）
> 前提: `step4-3` のAPI/SSEが利用可能。優先度: **P0** / **P1** / **stretch**。
> 構成は feature-sliced（`features/<feature>/{domain,application,infrastructure,presentation}` ＋ `shared/`）。domainは型＋純関数のみ。
> **デザインテーマ（タスク0で確定）**: 「**ダーク観測コンソール × Tremor**」をベース、デモ演出のみネオン系アニメを部分採用（タスク12）。配色トークン・参考URL・採用理由は `step4-4-backoffice-frontend.md`「デザインテーマ」節を正とする。可視化は Tremor（ゲージ/ドーナツ/チャート＝危険度ランク色・confidence割合・予兆グラフ）を `shared/ui/` に薄くラップして使う。

---

## P0: 提出ライン

### タスク 0: step1 フロント節の更新 〔P0・ドキュメント〕 ✅

- [x] 【修正】`docs/step1-directory-structure.md` のフロント構成図を layer-first → feature-sliced に差し替え（step4-4を正とする旨を明記）。設計判断メモの表・構成図・依存関係サマリー・正準注記の4箇所を更新済み
- [x] デザインテーマを決定（**ダーク観測コンソール × Tremor**、演出のみネオン系を部分採用）。配色トークン・参考URL・採用理由は `step4-4-backoffice-frontend.md`「デザインテーマ」節に記載済み

### タスク 1: shared 基盤 〔P0〕 ✅

- [x] 【新規】`shared/api/HttpClient.ts`（interface・HttpError/HttpTimeoutError）/ `FetchHttpClient.ts`（baseURL・クエリ組立・AbortControllerタイムアウト・JSONパース・axios不使用）
- [x] 【新規】`shared/ui/SeverityBadge.tsx`（CRITICAL/WARNING/INFO＋RiskLevel HIGH/MEDIUM/LOW 転用・素のTailwindランク色）＋ `shared/ui/cn.ts`（clsx+tailwind-merge）
- [x] 【新規】`shared/ui/tremor/`（Tremor薄ラッパ：`index.ts` 再エクスポート窓口 / `colors.ts` rankColor・confidenceColor / `ConfidenceGauge.tsx`）。features は @tremor/react を直接importせず本窓口経由
- [x] 【新規】`shared/layouts/AlertsLayout.tsx`（DemoDrawer差し込み口は本レイアウトのみ・slot方式でタスク10連携）/ `DefaultLayout.tsx`
- [x] 【基盤】`tsconfig.json`（bundler/DOM/react-jsx・@shared/@features paths）/ `tailwind.config.js`（Tremor tremor-*/dark-tremor-* トークン・safelist・darkMode class）/ `postcss.config.js` / `src/index.css`（ダーク基調）。依存追加：@tremor/react・tailwindcss・postcss・autoprefixer・clsx・tailwind-merge
- [x] 検証：`tsc --noEmit` 緑・`tailwindcss` ビルド成功
- 残（タスク7）：`vite.config.ts` / `index.html` / `main.tsx`（index.css読込・`<html class="dark">`）/ `App.tsx`

### タスク 2: alerts/domain（型＋純関数）〔P0〕 ✅

- [x] 【新規】`features/alerts/domain/AlertView.ts`（AlertView/Status/Severity/Category 型・分類/フィードバック view 型・ワイヤ DTO `AlertDto` ＋ `toAlertView` 純関数・`isAnalyzing`/`primaryConfidence`）
- [x] 【新規】`InvestigationReportView.ts`（investigationSteps/suggestedActions/reviewStatus・ReviewStatus 型・`InvestigationReportDto`＋`toInvestigationReportView`・`isReviewed`）
- [x] 【新規】`severity.ts`（severity→バッジランク橋渡し・重大度ソート・confidence→%。配色そのものは shared/ui に一元化し二重管理を回避）
- [x] 検証：`tsc --noEmit` 緑

### タスク 3: alerts/infrastructure（API＋SSE）〔P0〕

- 【新規】`alertsApi.ts`（GET /alerts, GET /alerts/:id, PATCH feedback）
- 【新規】`AlertStream.ts`（interface）/ `SSEAlertStream.ts`（EventSource('/alerts/stream')・再接続・heartbeat無視）/ `MockAlertStream.ts`

### タスク 4: alerts/presentation hooks 〔P0〕

- 【新規】`hooks/useAlertStream.ts`（subscribe→state マージ・同一ID置換・ANALYZING→OPEN遷移）/ `hooks/useAlerts.ts`（一覧取得＋ストリームマージ）

### タスク 5: alerts/application 〔P0〕

- 【新規】`application/submitFeedback.ts`（承認/却下→PATCH feedback）

### タスク 6: alerts ページ・コンポーネント 〔P0〕

- 【新規】`pages/AlertsPage.tsx`（AlertsLayout）/ `pages/AlertDetailPage.tsx`（DefaultLayout）
- 【新規】`components/AlertList.tsx` / `AlertCard.tsx` / `AlertCardExpanded.tsx`（サマリ・confidence・categoryバッジ・調査ステップ・推奨アクション・[✓承認][✗却下]）

### タスク 7: App.tsx ルーティング 〔P0〕

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
