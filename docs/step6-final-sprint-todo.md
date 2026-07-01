# Step 6 TODO: ファイナルスプリント（予兆 × デモ防御）

> 対応設計: `docs/step6-final-sprint-strategy.md`
> **予兆（F系）は `step4-1/2/3/4` の todo から stretchⅡ 予兆タスクを本ファイルへ集約したもの**（旧ファイルにはポインタ stub を残置）。旧タスク番号を各所に併記＝トレーサビリティ維持。
> 優先度: **P0**（本命1本の録画品質）/ **stretch**（余力時）/ **設計のみ**（ハッカソン後）。
> 着手条件: フェーズ0〜3 着地済み（✅）。予兆は `feature/forecast` ブランチ・`FORECAST_ENABLED` 既定 off・**録画前提**・write ゼロ。main は常時 685緑・提出可能を維持。

---

## A. 予兆ブリーフィング（Forecast）〔stretchⅡ → 本スプリント P0〕

> 出すシナリオは §3 の**DB接続枯渇 1本を本命**、2本目は同一機構の seed 替え（stretch）。既存P0パイプライン無傷・突合キーは (B) 構造化タグ。

### タスク F1: Forecast ドメイン型 〔P0〕（旧 step4-2 タスク19）

- 【新規】`Forecast/domain/ForecastSignal.ts`（id/kind/subject/when/desc/source・kind=FUTURE_CHANGE|SCHEDULE|MEMORY）
- 【新規】`RiskForecast.ts`（forecastId/generatedAt/horizon/risks[]/isFallback、`RiskItem`=window/subject/level/confidence/**citations**/reasoning）
- 【新規】`Schedule.ts`（`ScheduleWindow`）/ `ScheduleSource.ts`（interface・read-only）
- 【新規】`Forecast/domain/ForecastSignalSource.ts`（IF・`collect(horizon): Promise<ForecastSignal[]>`）★Ⅱ→Ⅲ の継ぎ目（`step4-1` §7.9）。主シグナル源を源非依存に抽象化し、Handler に Gateway を名指しさせない

> **相関（step4-4 タスク9e）との共通化メモ**: `RiskItem.citations`（引用＝根拠 id）と実装済み AI 相関（`InvestigationReportPrimitives.relatedAlerts`）は**同型パターン**＝「LLM が _id + ラベル + 根拠_ を出し、防御的に正規化してから実在レコードへ照合」。引用 incidentId は `SimilarIncident.sourceAlertId`＝実在 Alert id（step4-2 タスク12）なので実在 Alert に解決できる。
> **ただし context を跨いだ型共有はしない**: 相関は Monitoring BC、引用は Forecast BC の別物。`RelatedAlertPrimitives` を Forecast から import しない（BC 結合を避ける）。共通なのは*手順*（防御的正規化＋citations 必須プロンプト＋実在照合）だけ。`GeminiForecastAdapter`（F4）の safeParse/clamp/fallback は `LLMOutputParser`/`InvestigationReportMapper` を**参考にする**（コピー元）。frontend 共通化は F7 のメモを正とする。

### タスク F2: ForecastMemory projection（突合キーB）〔P0〕（旧 step4-2 タスク20）

- 【新規】`Forecast/domain/ForecastMemory.ts`（`ForecastMemoryEntry`=incidentId/subject/trigger/outcome、`ForecastMemoryRepository`：warmUp/findBySubjects）
- 【新規】`infrastructure/` 実装（Resolved から subject 投影）。`ForecastMemoryEntry.incidentId` は `SimilarIncident.sourceAlertId`（step4-2 タスク12 の back-link）を投影元にすれば citation を**実在する Alert id**に解決でき引用検証（§7.3）が効く
- 【補足】`trigger`/`outcome` 文も `resolvedNote`（index 時に AI調査 summary をフォールバック充填）から導出できる
- 【修正】`InvestigationReport` に optional `subject?: string` 追記（後方互換）＋ `InvestigateAlertUseCase` で導出して埋める ← **唯一の既存P0変更点**（要リグレッションテスト）

### タスク F3: Gateway 未来シグナル取得メソッド ＋ ForecastSignalSource 実装 〔P0〕（旧 step4-2 タスク21）

- 【修正】`GitHubGateway` に `listOpenPullRequests()`（未マージ）/ `TerraformGateway` に `getPendingPlan()`（未適用）を追加（**read-only維持**）
- 各 `*Impl.ts` に実装追加
- 【新規】`ForecastSignalSource` の3実装（各 Gateway/Source を内包し `ForecastSignal` に正規化して返す）:
  - `PullRequestSignalSource`（GitHub `listOpenPullRequests` → FUTURE_CHANGE）
  - `PendingPlanSignalSource`（Terraform `getPendingPlan` → FUTURE_CHANGE）
  - `ScheduleSignalSource`（`ScheduleSource.list` → SCHEDULE）
- 設計判断: 正規化（subject/when/desc 付与）を各 Source 内に閉じ、Handler は `ForecastSignalSource[]` を回すだけ＝stretchⅢ の源追加が容易

### タスク F4: ForecastPort ＋ Gemini アダプタ 〔P0〕（旧 step4-2 タスク22）

- 【新規】`Forecast/domain/ForecastPort.ts` / `ForecastContext.ts`
- 【新規】`infrastructure/GeminiForecastAdapter.ts`（既存Geminiアダプタ踏襲・JSON固定・**citations必須をプロンプト強制**・safeParse・confidenceクランプ・fallback）

### タスク F5: ForecastRiskCommandHandler 〔P0〕（旧 step4-2 タスク23）

- 【新規】`Forecast/application/ForecastRisk/ForecastRiskCommand.ts` / `ForecastRiskCommandHandler.ts`
- フロー: `signalSources: ForecastSignalSource[]` を回して主シグナル収集（PR/plan/schedule）→ subject抽出→ ForecastMemory.findBySubjects（MEMORY）→ 全シグナル結合 → Context → Port.forecast → **引用検証（citations実在照合・偽引用は落とす）** → 保存（最小はメモリ最新）
- 依存は `ForecastSignalSource[]` / ForecastMemoryRepository / ForecastPort / Logger（全て read-only・write無し）。**Gateway は名指ししない**（Source 経由）
- 設計判断（継ぎ目）: 源を配列で受け、stretchⅢ は `EventLogPrecursorSource` を配列に足すだけ＝Handler ノータッチ（`step4-1` §7.9）。記憶（MEMORY）は subject 駆動なので配列反復と別ステップ

### タスク F6: forecast ルート・コントローラ ＋ DI ＋ seed 〔P0〕（旧 step4-3 タスク13・14）

- 【新規】`routes/forecastRoutes.ts` ＋ `ForecastPostController`（POST /forecast → `ForecastRiskCommandHandler`）/ `ForecastGetController`（GET /forecast → 最新 RiskForecast）。`routes/index.ts` に登録（既存ルートはノータッチ）
- 【修正】`BackofficeApp.ts`：read-only依存を new して `ForecastRiskCommandHandler` を Bus 登録
  - **★継ぎ目**: `signalSources: ForecastSignalSource[]` を組み立てて渡す（Gateway を名指ししない）。`PullRequestSignalSource`（GitHub）/ `PendingPlanSignalSource`（Terraform）/ `ScheduleSignalSource`（ScheduleSource）の3つ
  - `ForecastMemoryRepository` / **ForecastPort=GeminiForecastAdapter★差し替え点**
- 起動時 `ForecastMemoryRepository.warmUp()` を `start()` 内に追加（SimilarIncident の warmUp と並行）
- 【新規】`ScheduleSource` の seed 実装（JSON/config）。`DEMO_ENABLED` 配下で投入
- 【修正】`config.ts`：`FORECAST_ENABLED`（既定off）/ `FORECAST_HORIZON`（既定 "今週末"）追加
- **write は発生しない**（全Gateway read-only）

### タスク F7: forecast feature slice（UI）〔P0〕（旧 step4-4 タスク13）

- 【新規】`features/forecast/domain/ForecastView.ts`（RiskItem→level色）/ `RiskLevel.ts`（純関数のみ）
- 【新規】`features/forecast/infrastructure/forecastApi.ts`（POST /forecast, GET /forecast）/ `application/triggerForecast.ts`
- 【新規】`presentation/pages/ForecastPage.tsx`（リスク一覧・level降順）
- 【新規】`components/RiskCard.tsx`（window・subject・level バッジ・confidenceゲージ・reasoning）/ **`CitationList.tsx`（引用チップ＝根拠の明示・ハルシネーション否定の可視化・本機能の体験の肝）**
- 【修正】`App.tsx` に `/forecast` 追加（`FORECAST_ENABLED` off時はナビ非表示）
- `shared/`（HttpClient/SeverityBadge/layouts）流用。`SeverityBadge` を RiskLevel に転用

> **共通化の継ぎ目（タスク9e 相関との共有）**: `CitationList`（引用 id 提示）と `RelatedAlertsPanel`（相関 id 提示）は**同型**。**本タスク実装時に** `domain/relatedAlerts.ts` の `toRelatedAlertViews(refs, lookup)` と `RelatedAlertsPanel` のカード描画を `shared/ui` へ昇格（例 `shared/ui/ReferencedAlertCard` ＋ resolver）し両者で共有する＝正しい抽出点（第二の消費者が現れる今）。**先行抽出はしない（YAGNI）**。backend は BC を跨いで型共有しない（相関=Monitoring / 引用=Forecast）。

### タスク F8: フラッグシップ seed ＋ 録画テイク 〔P0〕（新規・本スプリント）

- 【新規】§3.1 DB接続枯渇シナリオの seed 一式:
  - 過去インシデント N件（`sourceAlertId` 付き＝citation が実在 Alert に解決できる）
  - ステージ済み未マージ PR（pool 100→40 縮小）＝ `listOpenPullRequests` が拾える実 PR（draft 可）
  - Terraform pending plan（connection 上限縮小）＝ `getPendingPlan` が拾える
  - `ScheduleSource` seed（土20:00 checkout 負荷x5）
- 【検証】`POST /forecast` → HIGH リスク＋引用3系統＋confidence が安定して出る seed に調整
- 【引用検証の可視化】意図的に偽引用を混ぜたケースで**ドロップされる**ことをデモで見せられるようにする（ハルシネーション・ガードの実演）
- 【録画】「実際に動いた1回を録る」（捏造NG・`step4-1` §7.6）

### タスク F9: 2本目シナリオ（seed 替えのみ）〔stretch・余力時〕

- 新規コードは書かない。§3.2 の別ドメイン seed（例: 決済プロバイダ障害告知 × 過去決済タイムアウト記憶）を追加し「同一機構が別ドメインでも効く」汎用性を示す。間に合わなければ即切り。

---

## B. デモ防御（今の強みを守る）〔本スプリント〕

> 予兆の録画テイクと**同時に**詰める（60秒フックは予兆に依存）。汎用ポリッシュはしない。

### タスク D1: 60秒フック（開幕を予兆に）〔取り: Marcus / Alex〕

- 【設計】`step6-final-sprint-strategy.md` §5 の 0-15/15-35/35-60 秒構成をデモ台本に落とす
- 【UI】予兆の予報カード＋引用チップを**最初に見せられる**導線（`ForecastPage` を開幕に置く or 専用 demo 開幕ビュー）
- 【接続】「では実際に起きたら？」で反応的パイプライン（分類→ADK調査→承認）へ滑らかに遷移

### タスク D2: 認知負荷トリム〔取り: Lisa〕

- 【UI】デモ卓（`ScenarioControls`）で1シナリオ選択時に他群を畳む（段階開示の徹底・同時表示概念を削減）
- realness バッジ／確度スペクトルの説明文を「読む物」から「一目で分かる」へ圧縮（文言短縮・凡例のホバー化など）
- 既存の段階開示方針の延長＝新規概念は増やさない

### タスク D3: ライブ脆さ対策〔取り: David〕

- 【明文化】AI経路タイムアウト時のフォールバック導線（`GEMINI_TIMEOUT_MS`/`AI_INVESTIGATION_TIMEOUT_MS`・fallback confidence の見え方）をデモ台本に記述
- 【退避】録画テイクを正とし、ライブは「録画済みを再現する」位置づけにする（`AI_INVESTIGATION_STUB` の決定的応答経路を演出上どう使うか整理）
- 【確認】予兆導入後も main が 685緑・提出可能を維持（`feature/forecast` を merge する条件＝全緑）

---

## C. ハッカソン後（設計/ADRのみ・実装しない）

> stretchⅢ（event-log 基盤・予知ビュー）は `step4-1` §7.10 ＋ 各 step4 todo の stretchⅢ 節が正。本スプリントでは着手しない。継ぎ目 `ForecastSignalSource[]`（F1）を守るのが唯一の前提作業。予兆 ADR 種は `step4-1` タスク8（step4-1-strategy-todo.md）に残置。
