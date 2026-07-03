# Step 6 TODO: ファイナルスプリント（予兆 × デモ防御）

## 全てのtodo共通でまもること

todo実施後に

- プロジェクトルートのREADME.md
- docs/architecture.md
  を最新化すること(todoの内容を反映しているか確認して、遅れてるなら更新すること)

> 対応設計: `docs/steps/step6-final-sprint-strategy.md`
> **予兆（F系）は `step4-1/2/3/4` の todo から stretchⅡ 予兆タスクを本ファイルへ集約したもの**（旧ファイルにはポインタ stub を残置）。旧タスク番号を各所に併記＝トレーサビリティ維持。
> 優先度: **P0**（本命1本の録画品質）/ **stretch**（余力時）/ **設計のみ**（ハッカソン後）。
> 着手条件: フェーズ0〜3 着地済み（✅）。予兆は `feature/forecast` ブランチ・`FORECAST_ENABLED` 既定 off・**録画前提**・write ゼロ。main は常時 全テスト緑（7/2時点 694）・提出可能を維持。
> 公式確定情報（strategy §1.5）: 一次提出物＝公開リポジトリ＋**デプロイURL（動作確認できる状態必須＝無人安定性が一次から効く）**＋ProtoPedia（動画・アーキ図必須・ストーリー）。最終ピッチ＝Google渋谷ライブ。審査観点に「実運用を見据えたDevOpsプロセス」が明記＝D4 追加。
> 実行体制（strategy §1.6）: **F1〜F7 実装は Claude Code に委譲**。人間の約6時間は F8（seed/録画）・デプロイ検証に全振り。スマホ4時間は提出資料（`docs/steps/step6-submission-prompt.md` を使用）。**F9 は切り確定**。

---

## A. 予兆ブリーフィング（Forecast）〔stretchⅡ → 本スプリント P0〕

> 出すシナリオは §3 の**DB接続枯渇 1本を本命**、2本目は同一機構の seed 替え（stretch）。既存P0パイプライン無傷・突合キーは (B) 構造化タグ。

### タスク F1: Forecast ドメイン型 〔P0〕（旧 step4-2 タスク19）✅

- 【新規】`Forecast/domain/ForecastSignal.ts`（id/kind/subject/when/desc/source・kind=FUTURE_CHANGE|SCHEDULE|MEMORY）
- 【新規】`RiskForecast.ts`（forecastId/generatedAt/horizon/risks[]/isFallback、`RiskItem`=window/subject/level/confidence/**citations**/reasoning）
- 【新規】`Schedule.ts`（`ScheduleWindow`）/ `ScheduleSource.ts`（interface・read-only）
- 【新規】`Forecast/domain/ForecastSignalSource.ts`（IF・`collect(horizon): Promise<ForecastSignal[]>`）★Ⅱ→Ⅲ の継ぎ目（`step4-1` §7.9）。主シグナル源を源非依存に抽象化し、Handler に Gateway を名指しさせない

> **相関（step4-4 タスク9e）との共通化メモ**: `RiskItem.citations`（引用＝根拠 id）と実装済み AI 相関（`InvestigationReportPrimitives.relatedAlerts`）は**同型パターン**＝「LLM が _id + ラベル + 根拠_ を出し、防御的に正規化してから実在レコードへ照合」。引用 incidentId は `SimilarIncident.sourceAlertId`＝実在 Alert id（step4-2 タスク12）なので実在 Alert に解決できる。
> **ただし context を跨いだ型共有はしない**: 相関は Monitoring BC、引用は Forecast BC の別物。`RelatedAlertPrimitives` を Forecast から import しない（BC 結合を避ける）。共通なのは*手順*（防御的正規化＋citations 必須プロンプト＋実在照合）だけ。`GeminiForecastAdapter`（F4）の safeParse/clamp/fallback は `LLMOutputParser`/`InvestigationReportMapper` を**参考にする**（コピー元）。frontend 共通化は F7 のメモを正とする。

### タスク F2: ForecastMemory projection（突合キーB）〔P0〕（旧 step4-2 タスク20）✅

- 【新規】`Forecast/domain/ForecastMemory.ts`（`ForecastMemoryEntry`=incidentId/subject/trigger/outcome、`ForecastMemoryRepository`：warmUp/findBySubjects）
- 【新規】`infrastructure/` 実装（Resolved から subject 投影）。`ForecastMemoryEntry.incidentId` は `SimilarIncident.sourceAlertId`（step4-2 タスク12 の back-link）を投影元にすれば citation を**実在する Alert id**に解決でき引用検証（§7.3）が効く
- 【補足】`trigger`/`outcome` 文も `resolvedNote`（index 時に AI調査 summary をフォールバック充填）から導出できる
- 【修正】`InvestigationReport` に optional `subject?: string` 追記（後方互換）＋ `InvestigateAlertUseCase` で導出して埋める ← **唯一の既存P0変更点**（要リグレッションテスト）

### タスク F3: Gateway 未来シグナル取得メソッド ＋ ForecastSignalSource 実装 〔P0〕（旧 step4-2 タスク21）✅

- 【修正】`GitHubGateway` に `listOpenPullRequests()`（未マージ）/ `TerraformGateway` に `getPendingPlan()`（未適用）を追加（**read-only維持**）
- 各 `*Impl.ts` に実装追加
- 【新規】`ForecastSignalSource` の3実装（各 Gateway/Source を内包し `ForecastSignal` に正規化して返す）:
  - `PullRequestSignalSource`（GitHub `listOpenPullRequests` → FUTURE_CHANGE）
  - `PendingPlanSignalSource`（Terraform `getPendingPlan` → FUTURE_CHANGE）
  - `ScheduleSignalSource`（`ScheduleSource.list` → SCHEDULE）
- 設計判断: 正規化（subject/when/desc 付与）を各 Source 内に閉じ、Handler は `ForecastSignalSource[]` を回すだけ＝stretchⅢ の源追加が容易

### タスク F4: ForecastPort ＋ Gemini アダプタ 〔P0〕（旧 step4-2 タスク22）✅

- 【新規】`Forecast/domain/ForecastPort.ts` / `ForecastContext.ts`
- 【新規】`infrastructure/GeminiForecastAdapter.ts`（既存Geminiアダプタ踏襲・JSON固定・**citations必須をプロンプト強制**・safeParse・confidenceクランプ・fallback）
- 【設計判断・実装済み】**ADK は意図的に非使用**: 入力（シグナル）は Handler が Source 群から事前収集済みで、LLM の仕事は突合・格付けの1ショット合成＝ツールコール型の動的探索（ADK の価値）が不要。D3/I1 で実測済みの ADK 脆さ（無言ドロップ・散文・JSON途中切断）を無人閲覧経路（GET /forecast・録画）に持ち込まず、`responseMimeType=application/json` 強制の単発 generateContent で構造化を堅くする。`LLMTextClient`（GeminiLLMClient＝Vertex/AI Studio 切替・timeout・リトライ持ち）を注入するコンポジション。後から agentic 化したければ `ForecastPort` 差し替えのみ（Handler ノータッチ）
- 【実装メモ】citations 空の RiskItem はアダプタでは落とさない（「空は不正」の drop は F5 引用検証へ集約＝実在照合と同じ場所・二重実装回避）。未知 level は LOW 丸め（盛らない側）・level降順/confidence降順ソートはアダプタが保証。fallback は throw せず `isFallback=true`・risks 空（UT 13ケース・全791テスト緑）

### タスク F5: ForecastRiskCommandHandler 〔P0〕（旧 step4-2 タスク23）✅

- 【新規】`Forecast/application/ForecastRisk/ForecastRiskCommand.ts` / `ForecastRiskCommandHandler.ts` / `ForecastRiskUseCase.ts`（AnalyzeAlert と同構造: Handler は Command→params 変換のみの薄い層・ロジックは UseCase。`run()` は収集→予報→検証→保存の1段の抽象度＝SLAP、各ステップは private メソッドへ）
- フロー: `signalSources: ForecastSignalSource[]` を回して主シグナル収集（PR/plan/schedule）→ subject抽出→ ForecastMemory.findBySubjects（MEMORY）→ 全シグナル結合 → Context → Port.forecast → **引用検証（citations実在照合・偽引用は落とす）** → 保存（最小はメモリ最新）
- 依存は `ForecastSignalSource[]` / ForecastMemoryRepository / ForecastPort / Logger（全て read-only・write無し）。**Gateway は名指ししない**（Source 経由）
- 設計判断（継ぎ目）: 源を配列で受け、stretchⅢ は `EventLogPrecursorSource` を配列に足すだけ＝Handler ノータッチ（`step4-1` §7.9）。記憶（MEMORY）は subject 駆動なので配列反復と別ステップ
- 【実装メモ】引用検証は2段: 偽引用（実在しないシグナル id）を citations から破棄（`forecast_fake_citation_dropped` ログ＝F8 の偽引用実演の観測点）＋裏付けゼロ（citations 空 or 全偽）のリスクを丸ごと破棄（`forecast_uncited_risk_dropped`）。保存は `ForecastBriefing`（予報＋**シグナル全量同梱**＝引用チップの解決先を配信に含める・`RiskForecastRepository`/InMemory 最新1件）。シグナル0件は Gemini を呼ばず空予報（isFallback=false・課金ゼロ）。wire 契約 `Forecast/domain/contracts/ForecastContract.ts`（F7 は @monitoring alias で直接 import）。MEMORY シグナルの source は `incident.<実在AlertId>`（UT 4ケース）

### タスク F6: forecast ルート・コントローラ ＋ DI ＋ seed 〔P0〕（旧 step4-3 タスク13・14）✅

- 【新規】`routes/forecastRoutes.ts` ＋ `ForecastPostController`（POST /forecast → `ForecastRiskCommandHandler`）/ `ForecastGetController`（GET /forecast → 最新 RiskForecast）。`routes/index.ts` に登録（既存ルートはノータッチ）
- **【審査対応】GET /forecast は事前生成済みの最新 RiskForecast を返す**＝審査員の非同期閲覧（デプロイURL審査）に Gemini 待ちゼロ・課金ゼロで耐える。提出前に POST を1回打ってキャッシュを温めておく。POST は `DEMO_ENABLED` 配下
- 【修正】`BackofficeApp.ts`：read-only依存を new して `ForecastRiskCommandHandler` を Bus 登録
  - **★継ぎ目**: `signalSources: ForecastSignalSource[]` を組み立てて渡す（Gateway を名指ししない）。`PullRequestSignalSource`（GitHub）/ `PendingPlanSignalSource`（Terraform）/ `ScheduleSignalSource`（ScheduleSource）の3つ
  - `ForecastMemoryRepository` / **ForecastPort=GeminiForecastAdapter★差し替え点**
- 起動時 `ForecastMemoryRepository.warmUp()` を `start()` 内に追加（SimilarIncident の warmUp と並行）
- 【新規】`ScheduleSource` の seed 実装（JSON/config）。`DEMO_ENABLED` 配下で投入
- 【修正】`config.ts`：`FORECAST_ENABLED`（既定off）/ `FORECAST_HORIZON`（既定 "今週末"）追加
- **write は発生しない**（全Gateway read-only）
- **【確認済み方針・2026-07-03】定期実行（cron/setInterval）はやらない**: 審査員の非同期閲覧に対し「たまたま失敗した最新予報」を見せるリスクと Gemini 課金が増えるだけで掴みに寄与しない。手動 POST（デモ卓）＋提出前キャッシュ温めで無人安定性を取る。Bus 登録済みハンドラなので本運用の定期化は `FORECAST_ENABLED` 配下に1本足すだけ＝stretchⅢ と併せて「語り」で示す。SSE push も設計上任意のまま＝デモではページを開けば足りる（D2 認知負荷と整合）
- 【実装メモ】`forecastGuard`（FORECAST_ENABLED off＝/forecast まとめて404・demoGuard と同方針）、POST はさらに demoGuard を重ねる。horizon は config 固定＝無認証デモ経路に入力面を作らない（H1 整合）。POST レスポンスは生成結果（引用検証済み・fallback 含む）をそのまま返す＝デモ卓で即 confirm。`InMemoryPendingInfraPlanStore` を `TerraformGatewayImpl` に配線（F8 の pending plan seed の受け皿・record 口は `pendingInfraPlanStore`）。schedule seed は `seeds/ForecastScheduleSeed.ts`（checkout 土20:00 x5）。`BackofficeAppOverrides.forecastPort` を追加（結合テストの決定論差し替え口）。結合テスト3件（404→POST 引用検証→GET キャッシュ）・全緑（unit 803・integration 27）

### タスク F7: forecast feature slice（UI）〔P0〕（旧 step4-4 タスク13）✅

- 【新規】`features/forecast/domain/ForecastView.ts`（RiskItem→level色）/ `RiskLevel.ts`（純関数のみ）
- 【新規】`features/forecast/infrastructure/forecastApi.ts`（POST /forecast, GET /forecast）/ `application/triggerForecast.ts`
- 【新規】`presentation/pages/ForecastPage.tsx`（リスク一覧・level降順）
- 【新規】`components/RiskCard.tsx`（window・subject・level バッジ・confidenceゲージ・reasoning）/ **`CitationList.tsx`（引用チップ＝根拠の明示・ハルシネーション否定の可視化・本機能の体験の肝）**
- 【修正】`App.tsx` に `/forecast` 追加（`FORECAST_ENABLED` off時はナビ非表示）
- `shared/`（HttpClient/SeverityBadge/layouts）流用。`SeverityBadge` を RiskLevel に転用
- 【任意・安ければ】アラート一覧側に予兆への**導線1個だけ**（例: ナビバッジ「予兆: HIGH 1件」・`FORECAST_ENABLED` 時のみ）。一覧へ予報コンテンツは混載しない（reactive/proactive の優先度混線を避ける step4-2 の決定を維持）。D1 の「では実際に起きたら？」の逆方向遷移がデモで滑らかになる

> **共通化の継ぎ目（タスク9e 相関との共有）**: `CitationList`（引用 id 提示）と `RelatedAlertsPanel`（相関 id 提示）は**同型**。**本タスク実装時に** `domain/relatedAlerts.ts` の `toRelatedAlertViews(refs, lookup)` と `RelatedAlertsPanel` のカード描画を `shared/ui` へ昇格（例 `shared/ui/ReferencedAlertCard` ＋ resolver）し両者で共有する＝正しい抽出点（第二の消費者が現れる今）。**先行抽出はしない（YAGNI）**。backend は BC を跨いで型共有しない（相関=Monitoring / 引用=Forecast）。
>
> ✅ **実装済み（2026-07-03）**: カード描画を `shared/ui/ReferencedEvidenceCard`（chipTone cyan/emerald/amber・to/href/onClick の3リンク形）へ昇格し `RelatedAlertsPanel` と `CitationList` が共有。resolver（`toRelatedAlertViews` 等）は AlertView 依存のため feature domain に残置（shared は features を import できない規約）。FORECAST_ENABLED の frontend 判定は **GET /forecast の 404 を body で判別**（guard の `sendStatus(404)`=非JSON → disabled ／ controller の `{error}` JSON → empty=未生成）＝専用 status API を増やさない。`ForecastProvider`（composition root で1回張る）が「ナビ表示可否＋HIGH n件バッジ＋最新予報」の単一ソース。MEMORY 引用は source `incident.<AlertId>` から `/alerts/:id` へ、FUTURE_CHANGE は `url`（PR html_url）へ実リンク。POST（生成）は 90 秒タイムアウト・DEMO off の 404 は「デモ操作が無効」の文言に写像。任意項目のナビ導線は **Forecast タブ内の「HIGH n件」rose バッジ**として実装（一覧へのコンテンツ混載なし）。`/forecast` が SPA ルート化したため vite proxy / nginx を Accept 出し分け側へ移動。UT/RTL 17件追加（domain 13・api 6 含む）・frontend 236 全緑。

### タスク F8: フラッグシップ seed ＋ 録画テイク 〔P0〕（新規・本スプリント）

- 【新規】§3.1 DB接続枯渇シナリオの seed 一式:
  - [x] 過去インシデント N件（`sourceAlertId` 付き＝citation が実在 Alert に解決できる）（✅ `ResolvedAlertSeed.ts` に2件追加（`FORECAST_MEMORY_SEED_ALERT_IDS`）: ①過去の max_connections 縮小→枯渇（`report.subject="google_sql_database_instance.ec_db"`＝pending plan の terraform address と同語彙で突合）②週末セール checkout 負荷（`subject="checkout_db_connection_pool"`＝schedule seed の checkout と突合）。demo reset が再seed・`GET /alerts/:id` で開ける・一覧には出ない（RESOLVED））
  - [ ] ステージ済み未マージ PR（pool 100→40 縮小）＝ `listOpenPullRequests` が拾える実 PR（draft 可）← **人間タスク**（GITHUB_TARGET_REPO に draft PR を1本立てる。タイトルに db/connection/pool 系の語を入れると過去事例①とも突合する）
  - [x] Terraform pending plan（connection 上限縮小）＝ `getPendingPlan` が拾える（✅ `seeds/ForecastPendingPlanSeed.ts`＝Cloud SQL `max_connections` 100→40。`DEMO_ENABLED` 配下で `InMemoryPendingInfraPlanStore` へ起動時投入）
  - [x] `ScheduleSource` seed（土20:00 checkout 負荷x5）（✅ F6 着地済みの値をフラッグシップ確定値としてコメント更新のみ）
- 【実装メモ】**MEMORY は生成時に再 warmUp**（`ForecastRiskUseCase.recallMemorySignals`）: 起動時 warmUp だけだと demo reset の再seed・デモ中に承認/解決した事例が記憶に載らない穴があった（reset → POST /forecast がデモ卓の手順）。主シグナル0件時は再投影もスキップ（課金ゼロ経路は不変）
- [ ] 【検証】`POST /forecast` → HIGH リスク＋引用3系統＋confidence が安定して出る seed に調整 ← **実 Gemini での実走確認は人間**（配線と突合はE2Eで検証済み。引用3系統のうち PR は上記 draft PR 待ち）
- [x] 【引用検証の可視化】意図的に偽引用を混ぜたケースで**ドロップされる**ことをデモで見せられるようにする（✅ `StubLLMClient` が予兆 SYSTEM_INSTRUCTION を判別し**偽引用 ghost-\* 入りの固定予報**を返す→ローカルE2E `e2e/backoffice/forecast.e2e.test.ts` で「ghost-1 のみ citations から drop／ghost-2 だけのリスクは丸ごと破棄／MEMORY 引用が実在 Alert に解決／GET はキャッシュ配信」を決定論検証。e2e overlay に `FORECAST_ENABLED=true` 追加。実機の観測点は `forecast_fake_citation_dropped` ログ）
- [ ] 【録画】「実際に動いた1回を録る」（捏造NG・`step4-1` §7.6）
- 【録画・提出前チェック】`make e2e` 実行後は一覧に「AI推定: [STUB] 未知の障害パターン（推定）」が出ていないこと（STUB 残留）を確認（I2 で自動原状復帰済み・念のための目視1行）

### ~~タスク F9: 2本目シナリオ（seed 替えのみ）~~〔**切り確定**（時間制約・strategy §1.6）〕

- ~~新規コードは書かない。§3.2 の別ドメイン seed を追加し汎用性を示す。~~ 「同一機構で源を足すだけ」の汎用性は ProtoPedia ストーリー／アーキ図の `ForecastSignalSource[]` 継ぎ目で**語りで**示す。

---

## B. デモ防御（今の強みを守る）〔本スプリント〕

> 予兆の録画テイクと**同時に**詰める（60秒フックは予兆に依存）。汎用ポリッシュはしない。

### タスク D1: 60秒フック（開幕を予兆に）〔取り: Marcus / Alex〕

- 【設計】`step6-final-sprint-strategy.md` §5 の 0-15/15-35/35-60 秒構成をデモ台本に落とす
- 【UI】予兆の予報カード＋引用チップを**最初に見せられる**導線（`ForecastPage` を開幕に置く or 専用 demo 開幕ビュー）
- 【接続】「では実際に起きたら？」で反応的パイプライン（分類→ADK調査→承認）へ滑らかに遷移
- 【台本メモ・I4 より】**4b と 6 は同一根本原因（Cloud SQL 縮小）の物語**。連続で見せると重複感が出る一方、6 の関連アラートに「同一根本原因: インフラ障害（CRITICAL ログ検知）」が張られるクロスアラート相関の見せ場になる＝台本は「**4b →（波及）→ 6 で相関を回収**」の順を明記する

### タスク D2: 認知負荷トリム〔取り: Lisa〕

- [x] 【UI】デモ卓（`ScenarioControls`）のシナリオ単位開示・調査中表示・昇格通知・戻る導線・アラート名日本語化（✅ 12f517e で着地）
- [ ] realness バッジ／確度スペクトルの説明文を「読む物」から「一目で分かる」へ圧縮（文言短縮・凡例のホバー化など）＝残りはこれのみ
- 既存の段階開示方針の延長＝新規概念は増やさない

### タスク D3: ライブ脆さ対策〔取り: David・**最終ピッチ=渋谷ライブ確定で重要度up**〕

- 【実地データ 2026-07-02】ローカル実機で fallback を再現・計測: `adk_investigation_run_completed: elapsedMs=59396, events=1, timedOut=false, finalTextLen=0, agentTrace=[(no tool calls)]` → `ai_investigation_unparseable: rawLen=0`。**ADC マウント・env は正常なのに最初の LLM 呼び出しが応答イベント無しで59秒後に終了**（散文ですらなく空＝ADK がエラーを飲み込んだ形。トークン失効 or Vertex 側エラーの無言ドロップが疑い）。散文パターンとは別の第3の fallback 原因として真因追跡に追加
- 【実地データ 2026-07-03】**第4の原因を rawSnippet ログで確定＝最終出力 JSON の途中切断**（→ 対策はタスク I1 に集約）: シナリオ7実走で fallback 発生。finalText は正しい JSON（e12b655 正引用・confidence 0.95）だが **794 字で mid-string 切断**→parse 不能。timedOut=false・agentTrace 3委譲とも正常・成功時 finalTextLen=1182〜1642
- 【明文化】AI経路タイムアウト時のフォールバック導線（`GEMINI_TIMEOUT_MS`/`AI_INVESTIGATION_TIMEOUT_MS`・fallback confidence の見え方）をデモ台本に記述。fallback でも証拠リンクが残る改善（evidenceLinks 温存）は着地済み＝「失敗しても空にならない」ことを台本の保険として明記
- 【真因】ADK 散文出力（JSONでなく地の文が返る）の rawSnippet ログで真因を確定し、プロンプト側で JSON 強制を締める（fallback 率を下げる＝ライブ耐性の本丸）
- 【退避】録画テイクを正とし、ライブは「録画済みを再現する」位置づけにする（`AI_INVESTIGATION_STUB` の決定的応答経路を演出上どう使うか整理）
- 【確認】予兆導入後も main が全テスト緑・提出可能を維持（`feature/forecast` を merge する条件＝全緑）

### タスク D4: DevOpsドッグフーディング可視化〔取り: 公式審査観点「実運用を見据えたDevOpsプロセス」〕

- 【整理】自リポジトリの CI/CD が本プロダクト自身の運用である事実を1枚図に: app.yml（typecheck/UT/E2E→build→Cloud Run/GCE deploy）・Trivy→実 ingest（シナリオ5の実経路）・terraform.yml（plan/apply・state lock 対策済み）・ai-remediation.yml（dispatch→実修正→テストゲート→draft PR）
- 【デモ導線】「監視対象のECも、監視するエージェント自身も、同じ DevOps ループの中にいる」をデモ or 録画のどこで見せるか決める（発表資料側と分担）

### タスク D5: ドロワー→詳細ページ導線のティザーCTA 〔P1・Lisa/E系連動〕完了✅

- 【課題】ドロワー末尾の「AI レポートを詳細ページで読む」テキストリンクはクリック価値が伝わらない（ドロワーで要約が読める＋遷移先に何があるか不明＝空手形）
- [x] 【UI】フッターをコンテンツ連動ティザーカードへ: full 射影（タスク37）限定コンテンツのインベントリチップ（調査ステップN・推奨アクションN・コードで修正可能・影響評価・エスカレーション草案・修正PRレビュー）＋推奨アクション先頭1件の抜粋（line-clamp 2行）
- [x] 【設計】抽出は domain 純関数 `reportTeaser`（UT 5ケース）。ティザー不成立（レポート無し/summary のみ）は素のリンクへフォールバック。ドロワー本文の射影境界（summary＝トリアージ用）は動かさない
- 【検討済み代替】スクロールトリガー展開は非採用: ドロワーはスクロールが発生しないケースが多くトリガー自体が発火しない・スクロール起点の自動遷移は予期しない画面移動になる・インライン全文展開は詳細ページ（ディープリンク/共有）の存在意義と射影分離を崩す。フッター常時可視のティザーカードが最小コストで同じ目的を満たす

---

## E. デザイン攻勢（Lisa 視点・実機操作評価 2026-07-02 に基づく）

> **根拠**: ローカル実機を Playwright で実操作して評価（既知アラート到達 **実測867ms**・ANALYZING 59秒・空状態・500エラー状態・狭幅480pxまで確認）。実装は **Claude Code**、人間はレビューのみ。F 系（予兆）と並行可（衝突は `shared/ui` 程度）。**merge 条件 = 全テスト緑＋RTL テスト同時更新**。
> 狙い: 審査観点3（ユーザビリティ）だけでなく、E1 は観点1（自律的判断の可視化）に直撃。デプロイURL審査（無人）と動画の両方で効く。

### タスク E1: AI調査ライブ・タイムライン 〔P0・最大の wow〕完了✅

**問題（実測）**: 未知アラートの調査中、ドロワーは「AI が証拠を解析しています…」の静的1行が **60〜120秒**続く（今回実測59秒）。7エージェントの自律調査という最大の売りが、審査員には「ローディング」にしか見えない＝死んだ時間。

- [x] (a) 【P0・安全】ANALYZING 中のドロワー/カードに**調査パイプラインビュー**: 経過時間タイマー（実測値）＋エージェント台帳（Coordinator/EvidenceCollector/RootCauseAnalyst/ImpactTriage…の役割1行）＋不確定プログレス。完了時に `InvestigationReport` の調査ステップ（`InvestigationStepPrimitives`）を**タイムラインとして順次アニメ表示**（ツール別アイコン: ログ/Terraform/コミット/類似DB）。捏造なし＝実データのみ、進行中は「完了時に確定」と正直に表示（✅ `InvestigationPipelinePanel` 新設。ドロワー＝ライブ＋完了タイムライン／詳細ページ＝ライブのみ（full の調査ステップと重複させない）。ANALYZING 告知はパネルに一本化＝`AlertCardExpanded` の `analyzingNotice` で抑止・EvidencePanel の静的「解析しています…」は分析中は非表示。完了タイムラインは**ライブで完了を見届けたときだけ**流す）
- [x] (b) 【P1・wow最大】**実 ADK イベントの SSE 中継**: f640add で agentTrace をログ化済み＝同じイベントタップを `SSEAlertNotifier` の新イベント種（investigation-progress）に乗せ、フロントで「いま EvidenceCollector が fetch_commit_diff を実行中」を**ライブ表示**。実イベントのみ中継（演出の捏造はしない）。変更点: `ADKInvestigationAgentRunner`（タップ追加）→ notifier 注入 → `AlertsDataProvider`（イベント購読）→ E1(a) のタイムラインに合流（✅ 契約 `InvestigationProgressPrimitives`（contracts 単一ソース・alertId/agent/tool/at）＋`InvestigationProgressNotifier` ポート。相関キーは `InvestigationContext.alertId`（プロンプトには載せない）。EventEmitter/Redis 両 notifier 対応（専用 channel `monitoring:sse:investigation-progress`）。再調査の run 切り分けはクリア処理でなく `progressForRun(alert.updatedAt)` のクライアント側フィルタ）

### タスク E2: アラートカードの情報設計 〔P0〕完了✅

**問題（実測）**: 1カードにバッジ6個（severity/カテゴリ/時刻/該当パターン/状態/分類）＝概念過多。`該当: PROMOTED_EC.DB.CONNECTION_POOL_EXHAUSTED` と**生の内部IDが露出**。さらに**上部チップ「レビュー待ち 0件」とカードの「レビュー待ち」バッジが矛盾**する実バグを確認。

- [x] 【バグ】チップ集計とカードバッジの状態算出を単一ソース化（レビュー待ち件数が一覧と常に一致）（✅ `alertWorkState` を domain/alertReview に新設し AlertsHeader / AlertStatusBadge 双方が使用。既知=report無しの取りこぼしと ANALYZING の混入を解消）
- [x] 該当パターンの人間化: `PROMOTED_` プレフィックス→結晶化アイコン＋日本語名（eventCatalog 流用）。生IDはツールチップ/詳細へ降格（✅ alertReason が `(AUTO_)?PROMOTED_` を検出し crystallized+eventTitle へ写像。カードは ◈＋人間語・tooltip に生ID、詳細（AlertCardExpanded）は結晶化チップ＋パターンID行）
- [x] バッジの軸分離: severity（左ボーダー色＝既存）/ 状態（右端）/ 分類根拠（1チップ）に整理し、カード上のバッジを最大3に（✅ カードから SeverityBadge チップ・UnknownFaultBadge を撤去（sr-only で読み上げは温存・コンポーネントは削除）＝category/状態/確信度の3チップ）
- [x] 上部チップ（レビュー待ち/CRITICAL）を**クリック可能フィルタ**に（0件時は淡色化）（✅ AlertsHeader の FilterChip＋matchesAlertFilter 単一ソース・AlertList が絞り込み。0件は淡色+disabled・再クリック/解除リンクで解除。**導線の明示**: 漏斗アイコン＋「クリックで絞り込み:」ラベルでチップ群をグルーピング・選択中は ✓＋✕・hover でリング強調・クリック不可の「分析中」チップは区切り線の右へ分離＝バッジと誤認されない）
- [x] タイムスタンプを `ja-JP` ロケールに統一（実測: ドロワーが `7/2/2026, 2:16:55 PM` と英語式）（✅ `shared/format/dateTime.ts`（formatDateTimeJa/formatTimeJa）へ一本化・各所のローカル formatter を削除）

### タスク E3: fallback 体験の格上げ 〔P0・D3連動〕完了✅

**問題（実測）**: fallback 時のドロワーが「自動調査に失敗しました。手動での確認が必要です。」＋「証拠は見つかりませんでした。」で行き止まり。バナーは「再調査をおすすめします」と言うのに**再調査ボタンがドロワーに無い**。一覧カードは「AI推定: 」と**空文字**を表示。
**P0 維持の根拠補強（2026-07-03 実機総点検・I4）**: シナリオ7で fallback が実発生した際、バナーは「再調査をおすすめします」と言うのに**ドロワー/詳細ページのどちらにも再調査ボタンが無い**行き止まりを再確認（`POST /alerts/:id/reinvestigate` は backend 実装済みのまま未結線）。ライブ・無人デプロイ審査の両方で fallback は現実に起きる＝導線の格上げは演出でなく必須。

- [x] ドロワーのfallbackバナー直下に**「再調査を実行」ボタン**（既存 `POST /alerts/:id/reinvestigate` を結線するだけ）（✅ `FallbackRecoveryBanner` 新設＝警告バナー＋ワンクリック再調査。operatorNote 必須の既存契約は「前回の自動調査は出力不正で失敗しました…」の定型指摘文で満たす。ドロワーの既存インラインバナーを置換＋**詳細ページにも同バナーを追加**（I4 で確認した「どちらにも無い」行き止まりを両方解消）。再調査中（ANALYZING）はパイプラインビューが進行を示すため非表示）
- [x] fallback でも evidenceLinks（温存済み）を「収集済みの証拠リンク」として表示（backend は対応済み・UI 側の出し分け）（✅ `AlertCardExpanded`＝fallback の investigationSteps を「収集済みの証拠リンク」見出し＋「一次情報へのリンクは残っています」注記で **summary 射影でも**表示。full の「調査ステップ」とは排他＝二重表示なし）
- [x] 「AI推定: 」空文字の抑止（fallback 時は「調査失敗・再調査可」の定型文）（✅ `alertReason` が report.isFallback で patternName「調査失敗・再調査可」を返す＝一覧カード/展開ビュー共通）

### タスク E4: 審査員ファーストラン 〔P0・デプロイURL審査に直撃〕完了✅

**問題（実測）**: ①リセット直後の空一覧は「現在アクティブなアラートはありません。」のみ＝**次の一手の案内ゼロ**。②起動直後に「アラートの取得に失敗しました。HTTP 500 Internal Server Error」と**生のHTTPエラーが露出**（自動リトライなし・審査員がコールドアクセスすると最初に見る画面になり得る）。③リセット後「1 アラート」表示 vs 空一覧の軸不一致。

- [x] 空状態に CTA: 「→ 右のデモシナリオから障害を注入してください」＋確度スペクトル3群の1行説明（デモ卓への視線誘導）（✅ AlertList 空状態）
- [x] 取得失敗時: 自動リトライ（指数バックオフ・n回）＋「起動処理中の可能性があります。自動で再試行しています…」の文言。生の `HTTP 500` は詳細折りたたみへ（✅ useAlerts に 1s/2s/4s×3回・`retrying` 公開、使い切り後は手動「再試行」ボタン）
- [x] 統計タイル「アラート」→「アクティブアラート」等、一覧と同じ軸のラベルに統一（✅ AnalyticsResponse に `activeAlertCount`（非 RESOLVED）追加→ /demo/status が `activeAlerts` を返し SystemStatus タイルが表示＝リセット後「1 vs 空一覧」不一致解消）
- [x] 初回訪問ガイド（dismissible・3ステップ: ①注入 → ②AI調査を見る → ③承認で学習）。localStorage で1回きり（✅ FirstRunGuide 新設・AlertsPage 冒頭）

### タスク E5: ライブ感マイクロインタラクション 〔P1〕完了✅

- [x] SSE 着弾時のカードスライドイン＋一瞬のグロー（新規と更新を区別）（✅ `AlertCard` が prop の前回値比較で検出: 新規=マウント時 createdAt が直近10秒（初回ロードの過去分は動かさない）→ `card-arrive`（スライドイン＋シアングロー）／既存更新=updatedAt 変化 → `card-update-flash`（移動なしグロー）＝移動の有無で新規/更新を区別。解決フラッシュ（resolve-flash）とは重ねない・アニメ終了リセットは animationName 判別で子要素の bubbling と混線しない）
- [x] dedup ×N 加算時のカウンタパルス（storm デモの体感を強化）（✅ occurrenceCount 増加 → 重複バッジに `count-pulse`（scale+brightness 0.5s））
- [x] ANALYZING→OPEN の状態遷移アニメ（badge クロスフェード）（✅ `AlertStatusBadge` が alertWorkState 遷移時のみ key 差し替え＋`badge-fade-in`。初期マウント・無関係な再レンダーでは動かない）
- [x] ライブインジケータ（既存）に最終イベント種別を一言添える（「アラート受信 たった今」）（✅ `useAlerts` に `lastEvent`（アラート受信/アラート更新/修正提案 受信/AI調査 進行中）を追加し `StreamStatusIndicator` が **open 中のみ**相対時刻つきで表示＝AI調査中の60〜120秒も鼓動が見える。非ライブ中は受信が止まっており誤解を招くため出さない）
- すべて実データ駆動（演出の捏造なし）・`prefers-reduced-motion` で全アニメ無効化。RTL/hook テスト追加（AlertCard 4・AlertStatusBadge 2・StreamStatusIndicator 2・useAlerts 2）

### タスク E6: Analytics を学習ループの証明に 〔P1〕

**実測**: ドーナツ2枚（分類正答率/既知・未知内訳）＋KPI 5タイル＋承認済み一覧は既に良い骨格。足すのは物語の数字だけ。

- 「既知分類 <1秒 vs AI調査 平均◯秒」の対比タイル（実測値から算出＝実データ）
- 昇格ファネル（未知→承認→昇格の3段バー）
- 正答率の母数を常時明示（「1/1 件」は既にあり・母数小の注記を添える）

### タスク E7: 仕上げ 〔P1・小粒多数〕（スクショ撮影以外✅）

- [x] favicon / `<title>`（「EC Monitoring Agent」）/ OG メタ＋OG画像（ProtoPedia・リンクプレビュー対策）（✅ `public/favicon.svg`（BrandMark と同一意匠）・`<title>`/description/og:\*/twitter:card を index.html に追加・`public/og-image.png`（1200×630・ダーク観測コンソール調・Playwright レンダで生成）。**og:image は絶対パス `/og-image.png`**＝デプロイ先ドメインがビルド時に確定しないための割り切り（主要クローラは相対解決可・確定後に絶対URL化が理想）
- [x] デモ卓シナリオ名の truncate 解消（✅ `ScenarioControls` の行ラベルを truncate → `line-clamp-2`（2行許容））
- [x] 狭幅（〜480px）でのバッジ縦書き崩れと カード内折返しの調整（✅ AlertCard メタ行を flex-wrap 化＋category チップ/重複バッジに whitespace-nowrap（1文字ずつ縦になる圧縮を根絶）・ドロワー header の category チップも同様・ドロワー幅 `w-[clamp(480px,38vw,480px)]`（常に480px＝狭幅で溢れる）→ `w-full max-w-[480px]`）
- [x] フォーカスリング/キーボード操作の一貫性（✅ Esc でドロワー閉は既存実装＋既存 RTL テストで固定済みを確認。focus-visible リング（cyan・ring-2）を AlertCard 本体・ドロワー✕・ヘッダ FilterChip・絞り込み解除・再接続ボタンに統一追加＝Tab 巡回で現在地が常に見える）
- [ ] README 用スクショ・GIF の撮影（E1 完成後の画面で）← **残り。実機起動＋実走が必要なため録画テイク（F8）と同時に人間が撮るのが効率的**

> **実装順（推奨）**: E2バグ修正＋E4（半日相当・審査員の初撃体験）→ E1(a)（wow の土台）→ E3 → E1(b)（本線タップ・慎重に）→ E5〜E7。各タスク独立コミット・全緑維持。

---

## G. 価値の定量可視化（Alex / Marcus 攻略）

> **なぜこのカテゴリか**: 両者の点が低い共通根はUXでも技術でもなく「**ペインの緩和が数字で見えない**」こと。Alex は「ビタミンかペインキラーか」を数字で判定し、Marcus は最初の60秒で「価値が言えるか」を見る。D1（予兆フック）は掴みを、E 系は使い心地を押すが、**"この製品は何をどれだけ削ったか" を製品自身に語らせるタスクが無い**——それを埋める。
> **正直さの制約（必須）**: 表示するのは**システムが実際に記録した事実のみ**（調査経過時間・横断した証拠の件数・ソース数・×N・昇格数）。「人間なら◯分」の換算係数は根拠を出せないため**製品UIには出さない**（換算はナレーション/ProtoPedia側で「一般に」の枕詞つきで語る）。盛った瞬間に David/Sarah の信頼を失い純損になる。
> 実装 = Claude Code。E 系と同枝で進めて衝突回避。

### タスク G1: 調査レポートの「働きの明細」〔P0・Alex 直撃〕完了✅

**狙い**: レポートを読んだ審査員が「これを人間がやったら」と**自分で**換算してしまう状態を作る。事実の列挙が最強のペインキラー証明。

- [x] 【backend】調査完了時に**実測メトリクス**を `InvestigationReport` に添付（後方互換 optional）: `elapsedMs`（既にログにある値）・収集ソース数・証拠件数の内訳（ログ n 件 / コミット n 件 / 差分 n 件 / 類似事例 n 件）。ADK/単一Gemini 両経路で同じ形に（✅ 契約 `InvestigationMetricsPrimitives`（contracts 単一ソース・elapsedMs＋evidenceCounts: logs/metrics/terraformChanges/commits/similarIncidents）。計測・添付は Port 実装でなく **UseCase 側**（`InvestigateAlertUseCase`/`ReinvestigateAlertUseCase` が `buildInvestigationMetrics(context, elapsed)` を `withMetrics` で添付）＝ADK/単一Gemini/オンデマンド生成（POST /alerts/:id/report→同 UseCase）の全経路で同形・LLM 出力に依存しない deterministic 導出。fallback レポートにも付く（事実は温存）。収集ソース数は内訳から表示側導出＝二重持ちしない）
- [x] 【UI】ドロワーのレポート冒頭に1行サマリ: 「**92秒**で Cloud Logging・GitHub・類似事例DB を横断し、**証拠62件**を収集して原因を推定」＝数字は全部実測（✅ 純関数 `investigationWorkload.workloadSummary`（件数0のソースは「横断した」と主張しない・1秒未満丸め）→ `AlertCardExpanded` 冒頭の ⏱ 1行（ドロワー/詳細ページ共通・fallback と metrics 無しの旧データは非表示））
- [x] 【UI】既知アラートには対比を1行: 「既知パターン一致＝**1秒未満・AI コストゼロ**で確定（初回調査の結晶化）」→ 学習ループの経済性を毎回想起させる（✅ 該当パターン（既知）セクション直下に ⚡ 1行・結晶化パターンは「（初回 AI 調査の結晶化を再利用）」を付記）

### タスク G2: 一覧のバリューストリップ ＋ 5秒ポジショニング 〔P0・Marcus 直撃〕完了✅

**狙い**: デプロイURLを開いた審査員が**5秒**で「何の価値か」を掴める。現状のヘッダー文「AI が検知・分類・調査したアラートのレビュー一覧です」は**機構の説明**であって価値の主張ではない。

- [x] 【copy】ヘッダー下の説明文を価値訴求に書き換え: 例「アラート発火後の**調査・評価・報告**を AI エージェントが肩代わりします。既知は1秒で確定、未知は証拠つきで原因を提示」（機構説明はツールチップ/ガイドへ降格）（✅ AlertsHeader。機構3ステップは FirstRunGuide が担う）
- [x] 【UI】一覧上部に**実績ストリップ**（Analytics の実データを read）: 「自動トリアージ n 件 ／ 既知即決 n 件 ／ AI 調査 n 件 ／ 昇格 n 件」— デモを触るほど数字が増える＝価値が蓄積して見える（✅ ValueStrip 新設・lastUpdatedAt で再取得＝SSE 着弾のたび数字が伸びる。昇格数は GET /analytics に promotedPatternCount を同梱（既存 patterns query 再利用））
- [x] 【接続】ストリップのクリックで Analytics へ（E6 の対比タイル・昇格ファネルが受け皿）（✅ ストリップ全体をボタン化し /analytics へ遷移）

### タスク G3: 提出資料の Marcus レンズ磨き 〔P0・スマホ時間・doc のみ〕

- `docs/steps/step6-submission-prompt.md` に **B-6（投資家レンズ・レビュープロンプト）を追加済み**: 生成したストーリー/概要/動画台本を「60秒で課題→解決→独自性が立つか／数字はあるか／専門用語で掴みを殺していないか」で査読させ、修正案を出させる。ProtoPedia ストーリー①（課題の背景）に**運用現場のペインの実感**（深夜のアラート対応・調査の手作業列挙）を必ず入れる

> **やらないこと（検討の上で棄却）**: 「人間換算◯分/¥◯削減」の断定表示（根拠なし＝盛り・信頼毀損）／TAM・市場規模の UI 表示（製品でなくピッチの仕事）／Gemini トークン費用の表示（精度が出ず fake precision になる）。

---

## H. 提出そのものの防御と Google レンズ（David 残課題 ＋ 審査員実像）

> **David/Sarah に専用カテゴリを作らなかった理由**: 両者は既に高得点で、残課題は既存タスクが吸収している（David=D3/E3、Sarah=D1台本/B-6/スコープ規律の維持）。ただし精査の結果、**2つだけ未カバーの高効果タスク**が見つかった——①公開リポジトリ化の衛生（事故れば一発失格級・David の本能領域）②実在の審査員像＝**Google Cloud のエンジニアが ADK/GCP の使い込み深度を見る**視点。ここだけ埋める。

### タスク H1: 公開リポジトリ化・公開デプロイの衛生 〔P0・提出前必須・実装=Claude Code〕

**根拠（2026-07-02 確認済み）**: tracked な env 系は `.env.example` / `e2e/.env.prod`（URLのみ・秘密なし）/ `tfvars.example` のみで現状クリーン。ただし**全履歴の走査は未実施**、公開デプロイの悪用ガードも未整理。

- 【履歴スキャン】gitleaks（または同等）で**全コミット履歴**を走査（トークン・APIキー・ADC json の混入確認）。検出時はローテーション（履歴書き換えは最終手段）
- 【現物確認】workflows / terraform / docs 内のインライン秘密が `secrets.*` / Secret Manager 参照になっているか一括 grep（`GITHUB_TOKEN`・`INGEST_TOKEN`・webhook Basic 認証まわり）
- 【公開デプロイの悪用ガード】審査員に開放する以上 `DEMO_ENABLED` は on＝**Gemini を呼ぶ操作（シナリオ注入・再調査・レポート生成・POST /forecast）が無認証で叩ける**。最低限: デモ系エンドポイントの簡易レート制限（IP/分）＋ GCP 予算アラートの閾値確認＋ `REMEDIATION_MAX_ATTEMPTS`/`AI_INVESTIGATION_ADK_MAX_LLM_CALLS` の上限が本番 env で効いていることの確認（課金暴走の安全弁を提出前に点検）
- 【提出直前】7/9-10 は main フリーズ・デプロイ環境フリーズ（strategy 提出運用と同期）

### タスク H2: Google レンズ＝ADK/GCP 使い込みの明示 〔P1・doc のみ・スマホ時間可〕

**根拠**: 実在の審査員は Google Cloud のエンジニア/DevRel。「ADK（Google の新 SDK）をどこまで実戦で使い込んだか」は彼らにとって**自社プロダクトのフィードバック価値**があり、加点が偏る領域。現状 README/ProtoPedia には「ADK 使用」の事実しか無く、**深度が見えない**。

- 【README/ProtoPedia】「GCP 活用マップ」1節: どのプロダクトを・どこで・**なぜ**（Cloud Run×GCE 折衷の理由、Cloud Monitoring を検知権威にした境界設計、Vertex AI/ADC 経路）
- 【README】「ADK 実戦ポイント」数行: AgentTool による hub-and-spoke 7エージェント・FunctionTool＋zod/v4 の nominal 型一致の落とし穴・イベントループのトレース可視化・**エラー無言ドロップへの防御（fallback 設計）**——使い込んだ者にしか書けない具体で深度を証明（自慢でなく知見の共有トーンで）
- （余力）同素材で Zenn 記事1本（ハッカソン後でも可・転職資産と兼用）

---

## I. デモシナリオ実機総点検（2026-07-03・Playwright 実走・AI審査員レンズ）

> **根拠**: ローカル実機（実 ADK・非 stub）を Playwright で全シナリオ実走（4 は GCP 専用のため 4b で代替）。実測: 既知 484ms/類似 413ms/未知カード着弾 906〜909ms・AI 調査 105〜134 秒（5走）・承認→昇格→再注入 910ms で結晶化既知。**検証済みで良好**: 初回ガイド・空状態CTA・生500非露出・dedup×N・類似67%ゲージ・E1ライブパイプライン（実イベント中継）・昇格学習ループ・4b の Terraform 差分証拠・6 の「同一根本原因」相関・5 の CVE 特定と修正起票 UI・Esc/✕/バックドロップのドロワー閉。
> その場修正済み（✅・全778テスト緑）: similarity 生 float 丸め（`AlertCardExpanded.formatValue`）／4・4b の生イベント名→ `eventCatalog` に `critical_log_entries` 追加／詳細ページ h2 の生 eventName → `eventTitle` 化／デモコンソール件数の SSE 追随（`DemoDrawer` に `refreshKey`・RTL テスト付き）／ライブパイプライン注記「実測 60〜120 秒」→「およそ 2 分前後」（実測に整合）。

### タスク I1: fallback 第4原因＝最終出力 JSON の途中切断への防御 〔P0・D3 の本丸・シナリオ7で実発生〕

- 【実測 2026-07-03】シナリオ7（アプリコード退行＝実コミット差分が売りの本丸）が fallback。rawSnippet ログで真因確定: **finalText は正しい JSON（e12b655 正引用・confidence 0.95・修正方針まで正確）だが 794 字で mid-string 切断**→ safeParse 失敗 → UI は「自動調査に失敗しました」。分析は正解なのに失敗表示＝一次審査（無人デプロイ URL）でのデモ即死パターン
- 対策（いずれか/併用）: ① parse 失敗時に**最終合成のみ1回リトライ** ② **途切れ JSON のサルベージパース**（完成済みフィールド summary/confidence/steps を best-effort 回収し、fallback でなく部分レポートとして表示） ③ 最終出力の maxOutputTokens 引き上げ
- ✅ 実装済み（2026-07-03）: **②＋③を採用**。② `salvageLLMOutput`（`LLMOutputParser`）＝括弧/文字列の状態機械で「最後に完成した値」まで巻き戻して修復パースし、summary が回収できれば部分レポート（isFallback=false）として返す。ADK/単一Gemini 両アダプタに組み込み、回収時は `ai_investigation_salvaged` を warn ログ（rawLen/rawSnippet 付き＝切断頻度の観測点）。③ Coordinator の `generateContentConfig.maxOutputTokens=65535` 明示（gemini-2.5 系は思考トークンも上限を消費するため既定値頼みにしない）。①は `runEphemeral` がセッション破棄する契約のため「最終合成のみ」の安価なリトライが組めず見送り（全グラフ再走＝2分追加は demo に不適）
- 検証: シナリオ7を複数回実走し fallback 率が下がることを確認（E2E は stub のため実走でのみ検証可能）

### タスク I2: make e2e がローカル環境を STUB のまま残す罠 〔P0・録画/デモ前の事故防止〕

- 【実測】`make e2e` の `docker compose run e2e` が depends_on 経由で backoffice-backend を **e2e overlay（AI_INVESTIGATION_STUB=true）で再作成**し、終了後もそのまま残る。次にデモ/録画すると一覧に「AI推定: **[STUB] 未知の障害パターン（推定）**」が露出（Makefile コメント「ローカル開発時は false のまま」は実態と不一致）
- 対策: `e2e` ターゲット末尾に `$(DC) up -d ec-backend backoffice-backend` を追加して local 構成へ原状復帰（+コメント修正）。**録画・提出前チェックリストにも「make e2e 後は STUB 確認」を1行**
- ✅ 実装済み（2026-07-03）: `e2e` ターゲット末尾で exit status を保持しつつ `$(DC) up -d ec-backend backoffice-backend` で原状復帰（`test-integration` と同じ status 温存パターン）。Makefile コメントを実態（overlay 再作成が残留する）に合わせて修正。チェック1行は F8 の【録画・提出前チェック】に追加

### タスク I3: investigationSteps への evidenceLinks 全件連結ノイズ 〔P0→P1・レポート信頼性〕

- 【実測】シナリオ3/5 で `demo/regression` の直近コミット10件（merge 含む・原因と無関係）が「調査完了 — AI がたどったステップ」に混入。D5 ティザー「調査ステップ 13」も水増し。同時に証拠パネルは「証拠は見つかりませんでした」（CitedCommitFilter は引用絞り済み）＝**ステップには10コミット・証拠は0件という矛盾に見える**
- 方向: `InvestigationReportMapper` の evidenceLinks 連結（`InvestigationReportMapper.ts:79`）に CitedCommitFilter と同じ**引用 sha 絞り**を適用（シナリオ7では正解 e12b655 が引用されるので残る）。**fallback 時は全件温存**＝「失敗しても空にしない」の D3 意図は守る
- 表示だけの代替案: ステップと分離して「参照した直近コミット」見出しにするだけでも矛盾は解消する
- ✅ 実装済み（2026-07-03）: 引用判定を `CitedEvidence`（AIInvestigation/domain）に**単一ソース化**（引用源 = summary / impact.citations / escalation.evidenceBundle / remediationReview.citations）し、CitedCommitFilter（証拠パネル）と `toInvestigationReport` の evidenceLinks 絞り（調査ステップ）が同じ基準を共有＝「ステップには10件・証拠は0件」の食い違いが構造的に起きない。コミットリンクは href の `/commit/{sha}` から sha を逆引きして照合、Cloud Logging 等コミット以外のリンクは決定的導出のまま温存。ガード適用後（citations 空 impact 除去後）の値を引用源にし、永続化後に読む CitedCommitFilter とずれない。`buildFallbackReport` は絞らず全件温存（D3 意図維持・回帰テストで固定）

### タスク I4: 残りの文言・整合の小粒 〔P2〕

- リセット直後の ValueStrip が「自動トリアージ 1・AI 調査 1」（seed の過去解決事例 5eed0000… が集計に乗る）: 学習履歴の種として意図的なら現状維持可。気になる場合のみ「過去実績を含む」注記 or 集計から RESOLVED 除外を判断（✅ **注記案を採用**: ストリップ末尾に「※過去実績含む」＋ tooltip に累計の説明・RTL テスト追加。RESOLVED 除外は GET /analytics の集計が Analytics ページ・昇格ファネルと共有のためここだけ意味を変えない＝不採用）
- デモ台本メモ（D1 連動）: **4b と 6 は同一根本原因（Cloud SQL 縮小）の物語**。連続で見せると重複感が出る一方、6 の関連アラートに「同一根本原因: インフラ障害（CRITICAL ログ検知）」が張られ**クロスアラート相関の見せ場**になる＝台本は「4b →（波及）→ 6 で相関を回収」の順を明記（✅ D1 のタスク本文に台本メモとして転記済み＝台本作成時に確実に乗る）
- E3（fallback 体験の格上げ）の優先度維持の根拠を実測で補強: 今回 fallback 実発生時、バナーは「再調査をおすすめします」と言うのに**ドロワー/詳細ページのどちらにも再調査ボタンが無い**行き止まりを確認（E3 は未実装のまま）（✅ E3 の問題文に「P0 維持の根拠補強（2026-07-03）」として追記済み）

---

## C. ハッカソン後（設計/ADRのみ・実装しない）

> stretchⅢ（event-log 基盤・予知ビュー）は `step4-1` §7.10 ＋ 各 step4 todo の stretchⅢ 節が正。本スプリントでは着手しない。継ぎ目 `ForecastSignalSource[]`（F1）を守るのが唯一の前提作業。予兆 ADR 種は `step4-1` タスク8（step4-1-strategy-todo.md）に残置。
