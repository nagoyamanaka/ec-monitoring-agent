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
  - `GET /alerts/:id/evidence` → `InfraEvidence`（appLogs / terraformDiff / recentCommits）を取得
  - `GET /alerts/:id/investigation/status` → `collecting | analyzing | done` をポーリング。証拠が「**到着ごとに積み上がる**」演出のトリガーに使う（`done` になったタイミングで evidence を fetch → stagger フェードイン）
- 【新規】`components/EvidencePanel.tsx`（Cloud Logging/Terraform/GitHub の証拠が**到着ごとに積み上がる**演出＝自律性の可視化）
- シナリオ4の見せ場

### タスク 9: リメディエーション（remediate 起票ボタン＋API配線＋結果反映）〔P1〕

> **現状/前提**: backend は揃っている — `POST /alerts/:id/remediation/draft-pr`（起票トリガー＝**人間の承認アクション**・202）/ `GET /alerts/:id/remediation`（status・PR URL・vulnerabilityCount・reason）/ dispatch 経路の CI callback `POST /ingest/remediation-result`。調査レポートに `remediable`（AI が「コードで直せる」と判定）と `suggestedActions`（修正方針＝ROI判断材料）も載る（step4-2）。**フロントには remediation UI が未実装**＝本タスクで新設。
> **設計原則（step4-1 §4 / step4-2）**: 調査(read)とリメディ(write)は分離。毎回 remediate するとコスト高・方針不一致なら無駄（ROI）なので**起票は人間が判断**。`remediable` は **ボタン活性/ROI提示の advisory** で、write 実行の最終ゲートは人間承認＋executor の deterministic 判定。
> **状態の非同期性（重要）**: `advisory` モードは即 `drafted`（PR URL あり）。`dispatch` モードは `dispatched`（PR URL なし）で受付のみ→CI が実修正+UT後に callback で `drafted`/`failed` 確定。**この確定は現状 SSE push が無く、フロントは GET /remediation 再取得でしか気づけない**。

- [ ] 【新規】`features/alerts/domain/RemediationView.ts`（`RemediationResponse` 契約→View 純関数。status `none|dispatched|drafted|skipped|failed`→表示状態・PR URL・件数・reason）＋ UT
- [ ] 【新規】`infrastructure/remediationApi.ts`（`getRemediation(id)`=GET / `draftRemediation(id)`=POST draft-pr→202）/ `application/triggerRemediation.ts`
- [ ] 【新規】`components/RemediationPanel.tsx`：`report.remediable` のときのみ「修正を起票」ボタンを活性（`suggestedActions`＝修正方針を ROI 材料として併記）。起票後は status バッジ＋PR リンク（drafted）/受付中（dispatched）/理由（failed・skipped）
- [ ] 【配線】起票は **202＋mutation 後再取得**（共通原則）。`dispatched` の間は `GET /remediation` を**ポーリング**（タスク8の investigation/status と同方式）して `drafted`/`failed` 確定を反映
- [ ] 【SSE通知・要 backend判断】dispatch callback の確定をリアルタイム化するなら `RecordRemediationResultUseCase` に `SSEAlertNotifier`（or 専用 remediation チャネル）を追加。**ポーリングで吸収するか push を足すかは要判断**（step4-3 へ波及）
- **backend で何をやるか（step4-3）**:
  - [x] 既存で足りる: `POST /alerts/:id/remediation/draft-pr`・`GET /alerts/:id/remediation`・`POST /ingest/remediation-result`（CI callback）は配線済み。`remediable`/`suggestedActions` も調査レポートに載る（実装済み）
  - [ ] **追加候補は SSE push のみ**: `RecordRemediationResultUseCase` に notifier 注入＋`BackofficeApp` 配線。ポーリングで足りるなら不要
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
- [ ] 【内部リンク】「類似既知」分類（`SimilarPatternRule`）のカードから**元の解決済み Alert（`/alerts/:id`）へ内部ディープリンク**する。土台は揃っている — `SimilarIncident`/`ResolvedIncident` は optional `sourceAlertId`（back-link）を保持済み（step4-2 タスク 12 追記）。残る結線は2点: ①`SimilarPatternRule` が `best.incident.sourceAlertId` を分類結果へ載せる（現状は `patternId: similar:${incident.id}` のみで back-link 未露出）／②contracts の classification primitives に optional `sourceAlertId` を足してフロントへ伝搬。「過去の同型障害をどう直したか」へ即移動できる動線で、graded confidence の意思決定支援を補強する
- 補足（#4 `suggestedPatternName` の扱い）: これは **LLM が生成する自由記述ラベル**（eventName/category のような閉じた語彙ではない）。よって eventCatalog のような JSON マッピングは不適。**検索キーではなく表示用の人間語ラベル**（検索キーは `patternId`/`eventName`）。本番プロンプトで「日本語の読めるパターン名」を要求し、フロントはそのまま表示する方針。StubLLMClient のスラッグは人間語ラベルへ修正済み。

### タスク 9c: フィードバックを対話・編集形式へ深化 〔P1〕

> **背景（懸念1）**: 現状のフィードバックは [✓承認]/[✗却下] の二値（`alertReview`/`submitFeedback`）。「正解の積み上げで学習」には足りるが、**“どう違うか・どう直すか”を人間が書き込み、それを AI に返して再調査させる**動線が無い。これがあると (1) 学習シグナルが二値→自然言語で太り、(2) AI の修正方針/severity をその場で正せる。
> **設計の選択肢**:
>   - (a) **編集フォーム**: レポート（summary/severity/suggestedActions）を人間が直接編集→**差分**を保存し次回 context へ渡す。最小・確実だが「対話」ではない。
>   - (b) **コメント/対話履歴**: alert に `feedbackThread`（追記のみ・who/when/text）を持たせ人間⇄AI のやりとりを残す。「何が問題？」に人間が答える→AI が再調査。学習が太るが状態とAPIが増える。
>   - (c) **フロー（チャット）形式**: (b) を会話 UI で。最もリッチだが実装コスト最大。
> **推奨**: (a) を土台に (b) を段階追加。まず却下時に自由記述 note（差分/理由）を必須化し再調査トリガーへ、次にスレッド化。
> **backend 依存**: 自由記述 note は既存 `operatorNote` を流用可。再調査は `InvestigateAlertUseCase` を人手トリガーで再実行する経路が要る（step4-2/4-3）。`feedbackThread` 化は contracts/Alert 拡張。

- [ ] 【設計】(a)/(b)/(c) と再調査トリガー有無を決定（学習シグナルの形＝二値 vs 自然言語）。`submitFeedback` の二値学習は維持し、上乗せで設計
- [ ] 【改修】却下フローに理由/修正方針の入力（`operatorNote` 活用）→送信→（任意）再調査トリガー
- [ ] 【新規・(b)採用時】`feedbackThread` View＋API（追記コメント列）と AI 応答表示
- [ ] 【演出】送信→AI 再調査中→更新 の3状態（共通原則）
- **backend で何をやるか（step4-2/4-3）**:
  - [ ] **再調査トリガー経路**: `POST /alerts/:id/reinvestigate`（新規）で `InvestigateAlertUseCase` を人手再実行（現状は `InvestigateAlertDomainEvent`＝unknown 分類時のみ自動）。人間の note/差分を `InvestigationContext` に足して渡す
  - [ ] **(a) 最小**: 却下 note は既存 `operatorNote`（`SubmitFeedbackUseCase`）流用で済む。レポート編集を保存するなら Alert に編集コマンド/エンドポイント
  - [ ] **(b) スレッド化**: `feedbackThread`（追記コメント列・who/when/text）を Alert 集約＋`AlertContract` に追加、append コマンド/エンドポイント、AI 応答の保存
  - 注意: 二値学習（`SubmitFeedback`→`SimilarIncident.index`/昇格）の経路は壊さず**上乗せ**で設計する

### タスク 9d: レビュー後のライフサイクル状態遷移（修正フェーズ・差し戻し）〔P1〕

> **背景（懸念2）**: いま状態は2系統が分離 — Alert の `reviewStatus`（PENDING_REVIEW/APPROVED/REJECTED）と Remediation の `status`（dispatched/drafted/skipped/failed）。作業者体験としては **「レビュー→修正フェーズ→完了 or 再レビュー（差し戻し）」の1本のライフサイクル**が欲しい。承認したら修正へ進み、PR がダメなら差し戻して再試行、直れば完了、という導線。
> **設計の論点**: 状態機械をどこに持つか。
>   - (a) **UI 合成（後方互換・最小）**: 既存2状態から表示フェーズ（`reviewing|remediating|done|sent_back`）を純関数で導出。backend 無変更。差し戻し＝却下＋再起票で表現。
>   - (b) **backend ライフサイクル（明示）**: Alert か Remediation に状態列（`reviewed→remediating→verifying→done`/`sent_back`）と遷移APIを足し、差し戻し（`sent_back`）を一級に。dispatch の maxAttempts 自己修正ループとも接続。
> **推奨**: まず (a) の派生表示で動線を可視化、必要になれば (b)。**「却下＝学習シグナル」と「差し戻し＝やり直し」は別概念**として区別すること（混ぜると学習が濁る）。
> **backend 依存**: (b) は step4-2/4-3（状態フィールド＋遷移コマンド・差し戻し→再 dispatch）。

- [ ] 【設計】(a) 派生 / (b) 明示状態 を決定。状態名・遷移・差し戻しの意味（却下 vs 差し戻しの区別）
- [ ] 【新規】`domain/alertLifecycle.ts`（reviewStatus＋remediation status→表示フェーズの純関数）＋ UT
- [ ] 【改修】ドロワー/詳細にフェーズのステッパー表示（reviewing→remediating→done / sent_back）
- [ ] 【配線・(b)採用時】差し戻し（再レビュー/再起票）アクションと遷移API
- **backend で何をやるか（step4-2/4-3）**:
  - [ ] **(a) UI 派生なら backend 変更ゼロ**（既存 `reviewStatus`＋remediation `status` から導出）
  - [ ] **(b) 明示状態**: Alert か Remediation にライフサイクル状態列（`reviewed→remediating→verifying→done`/`sent_back`）と遷移コマンドを追加。`AlertContract`/`RemediationRecord` に状態を露出
  - [ ] **差し戻し→再 dispatch**: `sent_back` で `GitHubActionsRemediationDispatcher` を再実行（dispatch の `maxAttempts` 自己修正ループと接続）
  - [ ] **コマンド分離**: 「却下（学習シグナル＝`SubmitFeedback`）」と「差し戻し（やり直し＝新 `SendBackRemediation` 等）」を別コマンドに（混ぜると学習が濁る）

### タスク 9e: 相関アラートと詳細導線（関連の可視化）〔P1〕

> **背景（懸念3）**: いまアラートは単体表示。だが「該当アラート／相関の高いアラート」を**日付・情報つきで束ねて見たい・詳細へ飛びたい**。これは検知層の dedup（同一 dedupKey の occurrenceCount＝同型の嵐を1枚に畳む）とは別軸の、**異なるアラート間の相関**（例: DB枯渇=infra と payment失敗=app が同一根本原因）。step4-1 §2.5(c)「相関は AI 調査の副産物・エンジン化しない」に沿い、**調査が見つけた関連**を提示する。
> **データ源の選択肢**:
>   - (a) **occurrenceCount の内訳（最小）**: 既に畳んだ同一 dedupKey の発生履歴（日時×N）を詳細に展開。backend が発生履歴を持つ必要（現状は count のみ）。
>   - (b) **類似既知への back-link（土台あり）**: タスク9b の `sourceAlertId` 経由で過去の解決済み同型 Alert へ内部リンク（`/alerts/:id`）。
>   - (c) **AI 相関（差別化）**: 調査レポートが「関連アラートID＋関係＋根拠」を出し、フロントが関連カード列＋詳細リンクで提示。step4-2 の調査出力（contracts）拡張が要る。
> **推奨**: まず (b)（既存土台）＋(a) の履歴展開、次に (c) を段階。
> **backend 依存**: (a) 発生履歴の保持 / (c) 調査出力に `relatedAlerts`（id・relation・根拠）追加（step4-2/4-3）。

- [ ] 【設計】相関の出所（occurrence履歴 / back-link / AI相関）と最小スコープを決定
- [ ] 【新規】`domain/relatedAlerts.ts`（関連アラート View・日時/severity/関係ラベル）＋ `components/RelatedAlertsPanel.tsx`（カード列→`/alerts/:id` 詳細導線）
- [ ] 【改修】ドロワー/詳細に「関連アラート」セクション（日付・情報・詳細リンク）
- [ ] 【内部リンク】(b) `sourceAlertId`（タスク9b と統合）で解決済み同型へ
- **backend で何をやるか（step4-2/4-3）**:
  - [ ] **(a) 発生履歴**: `occurrenceCount` だけでなく**発生日時列**を保持（dedup 加算は `AnalyzeAlertUseCase`・`AlertRepository.findOpenByDedupKey`）。Alert 集約＋`AlertContract` に履歴を追加
  - [ ] **(b) back-link**: `SimilarPatternRule` が `best.incident.sourceAlertId` を分類結果へ載せる＋classification primitives に optional `sourceAlertId`（**タスク9b と同一作業**・`SimilarIncident`/`ResolvedIncident` は保持済み）
  - [ ] **(c) AI 相関**: 調査出力（`InvestigationReport`/`AlertContract`）に `relatedAlerts`（id・relation・根拠）を追加。LLM プロンプト（`InvestigationPromptBuilder`）＋`LLMOutputParser`＋`InvestigationReportMapper` を拡張

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
