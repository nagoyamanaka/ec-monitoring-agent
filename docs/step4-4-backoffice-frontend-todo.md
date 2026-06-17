# Step 4-4 TODO: backoffice/frontend 実装

> 対応設計: `docs/step4-4-backoffice-frontend.md`（feature-sliced・校正版）
> 前提: `step4-3` のAPI/SSEが利用可能。優先度: **P0** / **P1** / **stretch**。
> 構成は feature-sliced（`features/<feature>/{domain,application,infrastructure,presentation}` ＋ `shared/`）。domainは型＋純関数のみ。

---

## P0: 提出ライン

### タスク 0: step1 フロント節の更新 〔P0・ドキュメント〕
- 【修正】`docs/step1-directory-structure.md` のフロント構成図を layer-first → feature-sliced に差し替え（step4-4を正とする旨を明記）

### タスク 1: shared 基盤 〔P0〕
- 【新規】`shared/api/HttpClient.ts`（interface）/ `FetchHttpClient.ts`（baseURL・エラー・タイムアウト・axios不使用）
- 【新規】`shared/ui/SeverityBadge.tsx`
- 【新規】`shared/layouts/AlertsLayout.tsx`（DemoDrawerをここだけ参照）/ `DefaultLayout.tsx`

### タスク 2: alerts/domain（型＋純関数）〔P0〕
- 【新規】`features/alerts/domain/AlertView.ts` / `InvestigationReportView.ts`（investigationSteps/suggestedActions/reviewStatus）/ `severity.ts`（severity→色, confidence→%）

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
