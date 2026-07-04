# Step 6 TODO: ファイナルスプリント（予兆 × デモ防御）

## 全てのtodo共通でまもること

todo実施後に

- プロジェクトルートのREADME.md
- docs/architecture.md
- docs/steps/step6-final-sprint-strategy.md
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
  - [ ] 同一セッションで **preventiveAction（先手・F11a）も目視**: 各リスクに先手1文が出るか・citations のシグナルに言及した具体的内容か（出なくても先手行が消えるだけでカードは成立＝縮退設計済み。プロンプト調整が要る場合のみ Claude Code へ差し戻し）
- [x] 【引用検証の可視化】意図的に偽引用を混ぜたケースで**ドロップされる**ことをデモで見せられるようにする（✅ `StubLLMClient` が予兆 SYSTEM_INSTRUCTION を判別し**偽引用 ghost-\* 入りの固定予報**を返す→ローカルE2E `e2e/backoffice/forecast.e2e.test.ts` で「ghost-1 のみ citations から drop／ghost-2 だけのリスクは丸ごと破棄／MEMORY 引用が実在 Alert に解決／GET はキャッシュ配信」を決定論検証。e2e overlay に `FORECAST_ENABLED=true` 追加。stub の引用は `plan-1/sch-1/inc-1`＝**3系統が stub モードの UI にも揃い、記憶 seed が引けなければ inc-1 が偽引用として落ちて E2E が赤くなる**。実機の観測点は `forecast_fake_citation_dropped` ログ）
- [x] 【バグ修正・実機で発見】MEMORY 引用「当時のアラートを開く」が「指定されたアラートは見つかりませんでした」になる（✅ 詳細ページは共有一覧 state から id を引くが、一覧 API は RESOLVED を除外＝アーカイブ seed に永遠に到達しない構造バグ。`useAlertDetail`（新規 hook・UT 5件）が現役＝共有一覧 state／アーカイブ＝`GET /alerts/:id` 単品の二源を単一インターフェース `{alert,status,refresh}` に畳む（一覧に無い id だけ単品 fetch）。**アーカイブは共有一覧へ merge しない**＝一覧ページに RESOLVED が混入しない。類似シナリオの関連アラート導線も同じ穴だったので同時に解消。Playwright 実クリックで /forecast → 引用チップ → 詳細描画 → 一覧混入なし を確認済み）
- [x] 【UI・見やすさ（タイムチャート不採用の代替）】RiskCard は **window を主見出し**（「いつ危ないか」が予報の答え・subject は補足行）、引用は**種別レーン**（変更予定 cyan／負荷予定 amber／過去の記憶 emerald の左ボーダー・語り順固定）＋「根拠 n系統」チップで**収束の強さ**を可視化（`groupCitationsByKind`/`citationKindCount`＝domain 純関数・UT3件）。タイムチャートは window が LLM 由来の自由文字列で時刻を捏造せずには描けないため不採用。`FORECAST_HORIZON` は録画前に「今週末（7/5 土〜7/6 日）」等の具体日付へ（.env.example に注記）。seed の `ec.checkout.latency_degraded` を eventCatalog に追加（詳細ページ見出しの生英語防止）
- [ ] 【録画】「実際に動いた1回を録る」（捏造NG・`step4-1` §7.6）
- 【録画・提出前チェック】`make e2e` 実行後は一覧に「AI推定: [STUB] 未知の障害パターン（推定）」が出ていないこと（STUB 残留）を確認（I2 で自動原状復帰済み・念のための目視1行）

### ~~タスク F9: 2本目シナリオ（seed 替えのみ）~~〔**切り確定**（時間制約・strategy §1.6）〕

- ~~新規コードは書かない。§3.2 の別ドメイン seed を追加し汎用性を示す。~~ 「同一機構で源を足すだけ」の汎用性は ProtoPedia ストーリー／アーキ図の `ForecastSignalSource[]` 継ぎ目で**語りで**示す。

### タスク F10: 予兆からの「次の一手」（推奨アクション1行 ＋ 橋渡しCTA）〔②着地✅・①は F11a へ再スコープ〕

> **背景（2026-07-04 設計相談）**: 予兆ページは予報＋根拠（引用）を出すが「読んで終わり」感がある。reactive（/alerts）には **承認**という閉じるアクションがあるのに予兆には対の一手が無い＝物足りなさの正体。**ただし mutate（plan の適用保留・PR へレビュー要求・スケジュール調整）は足さない**——(1) write-zero は意図的な安全特性（全 Gateway read-only・F6）で無人デプロイURL審査での本番書き込みは David/Sarah の信頼を一発で失う、(2) 予兆の真の防御アクションは *システムの外*（GitHub/Terraform 側・実行主体は人間）にあり、ツール内ボタンは「偽物の演出」か「本当に危険」の二択にしかならない、(3) 締切（人間6時間は F8 に全振り）。→ 足すのは **B類（判断を助ける／物語を繋ぐ）のみ**。

- [ ] **① 推奨アクション1行（助言・副作用ゼロ）**〔**見送り 2026-07-05**〕: citations と同じ「AI生成→防御的正規化→純表示」に乗せる
  - **見送り理由**: LLM 出力に1フィールド増える＝contract/adapter/stub/seed の同時更新＋「実 Gemini で安定して出るか」の人間検証が F8 に増え、録画クリティカルパスにリスクを足す。②（backend ゼロ）と違い波及が広い。F8 着地後に余力があれば再検討
  - → **2026-07-05 方向性相談で F11a として再スコープ復活**: 上の見送りは①を「演出の追加」として評価した判断。「予兆の主目的＝発火前に握りつぶす」に照らすと①は本体機能であり、optional 縮退＋stub 決定論でリスクは絞れる（詳細・優先度は F11）
  - contract/domain: `RiskItem` に `recommendedAction?: string`（optional・後方互換）。`ForecastContract.ts` / `RiskForecast.ts`
  - `GeminiForecastAdapter`: プロンプトに「各リスクに *推奨される先手* を1文」追加。safeParse で trim・空はドロップ（citations と同扱い）。JSON を締める文言も足す
  - `StubLLMClient`: 固定予報に `recommendedAction` を1文追加（`forecast.e2e.test.ts` を緑に保つ）
  - `ForecastView` / `RiskCard`: `reasoning` の下に 🛡 付き1行。**reactive の推奨アクションと同じ視覚言語**。「システムがやる」でなく「人間が外で打つ先手の提案」と読める文言・スタイル（実行ボタンにはしない＝write-zero 維持）
  - 正直さ: reasoning と同レベルの助言テキスト（reactive `recommendedActions` と同じ honesty）
- [x] **② 橋渡しCTA（純ナビゲーション・backend ゼロ）**: `BriefingBody` 末尾に**ページ単位で1個**（per-risk にしない＝未発火リスクに対応する具体 alert がまだ無くリンク先を作れない）。risks がある時だけ表示。文言例「この予兆が**実際に発火したら** → 分類 → AI調査 → 承認 が同じ証拠で対応します」＋ `/alerts` への react-router Link。**D1 フック「では実際に起きたら?」をUI上で繋ぐだけ**（新機構ゼロ）（✅ 2026-07-05 `ForecastBridgeCta` 新設。審査員レンズでの設計判断: 見出しは D1 台本フレーズ**そのまま**「では、実際に発火したら？」＝録画ナレーションと画面が同期（Marcus 60秒フック）／**破線ボーダー**＝「まだ発火していない未来」の視覚表現で実線 RiskCard（実在照合済みの根拠）と誤認させない（Lisa）／パイプラインは 検知→分類→AI調査→承認・学習 の小チップ連鎖＝FirstRunGuide と同語彙・新規概念ゼロ（D2 整合）／リンクはテキストリンク1個のみ・**button ロール不在を RTL で固定**＝write-zero を視覚語彙でも維持（David）／文言は「同じ証拠ソース（GitHub・Terraform・過去事例）を横断する反応的パイプラインが引き継ぐ」＝「同じ証拠で対応」より盛らない表現に調整。fallback 時は risks 空のため出ない。RTL 2件追加・frontend 295 全緑）**→ 同日 F11b で保険の位置づけへ降格**（見出し「もし防ぎきれずに発火したら？」・サイズ/明度を先手ブロックに従属。最新の見た目は F11b の記録が正）
- 【留意】F8 録画依存: ① は LLM 出力に1フィールド増えるので stub/seed 同時更新が必須。実 Gemini での「推奨アクションも安定して出るか」確認が人間タスク（F8 §103）に1項目増える
- 【却下記録】承認相当の状態アクション（確認済み/対応中のトリアージ状態）は write＋永続化＋状態管理が要り締切と critical path 外＝不採用。予兆の「アクション」はシステム外の人間判断という設計思想を貫く

### タスク F11: 予防ファースト転回（「防ぐ」を主役に・「受ける」を保険に）〔実装✅ 2026-07-05・残りは F8 実走目視のみ〕

> **背景（2026-07-05 方向性相談）**: 予兆の第一目的は**発火前にインシデントを握りつぶす（リスクそのものを減らす）**こと。「実際に発火したら反応的パイプラインが受ける」は保険＝サブ。ところが現状の予兆ページはアクション導線が F10-② 橋渡しCTA だけ＝**「受ける」がメインに見える主客転倒**。防ぐための一手が画面に無い。
> **鍵になる事実**: 「握りつぶす」ループは **write なしで既に閉じられる**——先手の実行先（PR・plan・スケジュール）への実リンクは CitationList が既に持っている。①（先手1行）を足せば「先手を読む → 引用チップから GitHub/plan へ飛ぶ → 人間が外で実行（マージ延期・縮小幅見直し・事前スケールアップ）」が1クリック動線で成立する。write-zero の設計思想（防ぐのは人間・システムは根拠付き助言まで）と完全に整合。
> **F10 との関係**: F10-① の見送りを撤回して防御的に再スコープ（F11a）。F10-② は成果物を活かしたまま**保険の位置づけへ降格**（F11b）。F10 の mutate 却下・トリアージ状態却下は不変。

- [x] **F11a 先手（回避アクション）1行 ＝ F10-① の再スコープ復活**〔LLM 変更あり・防御的設計で録画リスクを絞る〕（✅ 2026-07-05 実装。`RiskItemPrimitives.preventiveAction?`（contracts）→ `RiskItem`（domain）→ `toForecastBriefingPrimitives`（wire 明示マッピング・欠落時はキーごと省略）。プロンプトは「citations の実在シグナルに言及する具体的な先手・実行主体は人間・無理に作らない（省略可）」を強制。safeParse は trim・空白のみ/非文字列はフィールドごと drop（リスクは残す）。引用検証（F5）は `{ ...risk }` spread のため**変更ゼロで先手が素通し**。stub は1件目に先手つき・2件目は敢えて省略＝**出る/出ないの両縮退経路を決定論固定**（adapter UT 3件・stub 契約 UT・E2E `preventiveAction` 到達アサート追加）。UI は `RiskCard` reasoning 直下に cyan パネル「🛡 今打てる先手」＋「実行先は下の引用リンクから」の添え書き＝引用チップの実リンク（PR/plan/過去 Alert）が実行先という1クリック動線を明示。button ロール不在を RTL で固定）
  - **追記 2026-07-05（実機フィードバック）**: 実走で reasoning が「〜懸念があります」で終わり次の一手が見えないケースを観察 → プロンプトを強化: preventiveAction は**「〜することを推奨します」形**で・**HIGH/MEDIUM は原則必須**（捏造はしない・どうしても無い場合のみ省略）・**reasoning は診断に徹し対処を書かない**（先手との役割分担を明文化）。stub も推奨します形へ追従
  - contract/domain: `RiskItem.preventiveAction?: string`（optional・後方互換）。`ForecastContract.ts` / `RiskForecast.ts`。**reactive の `recommendedActions`（事後対応）と意味が異なるため別名**＝「防ぐ」と「対応する」を型名でも区別
  - `GeminiForecastAdapter` プロンプト: 「各リスクに、**発火自体を防ぐために人間が今打てる先手**を1文。必ず citations の実在シグナルに言及する形で」（例: PR のマージをセール後へ延期／plan の縮小幅を見直し／セール前に接続上限を一時引き上げ）。safeParse で trim・空/欠落は**フィールドだけ落とす**（リスク自体は残す＝実 Gemini が出さなくてもカードは壊れず先手行が消えるだけの優雅な縮退）
  - `StubLLMClient`: 固定予報に preventiveAction を追加（`forecast.e2e.test.ts` の決定論維持・E2E で先手表示も固定）
  - UI（`RiskCard`）: 「🛡 先手」ブロックを reasoning 直下・**カード内の視覚的主役**（cyan 系の明確なパネル・引用レーンより手前）に。実行ボタンにはしない。実行先への動線は既存 CitationList の実リンクが担う
  - 正直さ: 助言テキストのみ・「システムが防いだ」とは言わない（防ぐのは人間）。効果数値（防げた件数等）は捏造しない
- [x] **F11b 導線の階層是正**〔copy/デザインのみ・LLM 無関係・F11a と独立に着地可〕（✅ 2026-07-05: ページヘッダを「障害が**起きる前に、先手を打って握りつぶす**ための予報です。（…）直近のリスクと今打てる先手を提示します」へ。`ForecastBridgeCta` は見出し「もし防ぎきれずに発火したら？」・本文「先手を打てないまま予兆が現実になっても〜」・p-5→p-4・見出し/本文/リンクを text-xs・チップ/ボーダー/リンクの明度を一段落とし先手ブロック（cyan パネル）に視覚的に従属。RTL の見出しアサート追従）
- [x] **F11c F8 への波及（人間検証 +1 目視）**: 実 Gemini 実走確認（F8 §103）に「preventiveAction が安定して出るか・citations 言及が妥当か」を追加。**既存の「HIGH＋引用3系統＋confidence 安定」確認と同一セッションで見られる**＝追加の実走は不要（✅ F8 §103 に子項目として登録済み）
- 【審査への効き】Alex: 「読んで終わり」→「今日打つ手が1行で出る」＝ペインキラーの完成形／Marcus: 60秒フックが「起きる前に当てる」から「**起きる前に潰させる**」へ強化（0-15秒の予報カードに先手が載る）／David: write-zero・引用接地・欠落縮退で堅牢性は不変／Sarah: 新機構ゼロ（既存の「AI生成→防御的正規化→純表示」パターンの1フィールド追加）
- 【やらない（既決の再確認）】mutate 系（plan 保留・PR レビュー要求・スケジュール調整）／トリアージ状態／効果測定の数値化（「一般に」の枕詞つきで語り・ProtoPedia 側が担当）

### タスク F12: 予兆デモコンソール（生成/リセット＋投入シグナル台帳）〔実装✅ 2026-07-05〕

> **背景（2026-07-05 実機フィードバック）**: (1) 生成済み予報を**リセットできない**（デモ卓で初期状態に戻せない）。(2) ヘッダ右の「予報を再生成」ボタンだけでは、初見の審査員に**投入データがデモ用サンプルであること・ボタンが何をするのか**が伝わらない（UX 欠陥）。→ アラート一覧の DEMO CONSOLE と**同型のデモコンソール**を予兆ページにも置き、デモ系 UI をそこへ閉じ込める（似た機能は似た見た目・同じ場所＝一覧で学んだ操作文法がそのまま通じる）。

- [x] **backend: `DELETE /forecast`**（`RiskForecastRepository.clearLatest()`＋`ForecastResetController`・`demoGuard` 配下）。**アラート側 `/demo/reset` にはあえて相乗りしない**: 審査員が一覧のリセットを押しただけで提出前に温めた予報キャッシュ（無人閲覧の要・GET /forecast）まで消えると一次審査で不利になるため、予報のリセットは予兆ページ内の明示操作のみ（結合テストで独立性を担保）
- [x] **frontend: `ForecastDemoConsole`**（右 aside・`lg:grid-cols-[minmax(0,1fr)_20rem]`＋sticky＝AlertsLayout と同じ空間文法）。DemoDrawer と同一の視覚言語: fuchsia「🕹️ デモコンソール」ピル／**投入シグナル台帳**（未適用 plan・未マージ PR・負荷スケジュール・過去事例の4行に realness バッジ＝**実データ emerald は実 GitHub PR の1つだけ・残り3つは合成seed amber**・ホバーで「入口のみ合成・突合→AI予報→引用検証は実経路」の正直さ全文）／操作は cyan「▶ 予報を生成（AI 突合・約1分）」（生成済みなら再生成表記・実行中「AI が突合中…」）＋ slate/rose「予報をリセット」（title で「シグナルは残る＝もう一度生成できる」を明示）。可用性は DemoDrawer と同じ **GET /demo/status 404 判定**＝本番（DEMO off）ではコンソールごと非表示・予報閲覧は無傷
- [x] ヘッダの単独「予報を再生成」ボタンは廃止（デモ操作はコンソールへ集約）。empty 状態の案内は「→ 右のデモコンソールから『予報を生成』」（アラート一覧の空状態 CTA と同文法・コンソール非表示時は出さない）
- テスト: forecastApi UT2・ForecastDemoConsole RTL4・ForecastPage RTL（リセット/コンソール非表示ほか）・結合（DELETE→GET 404）＝全緑（root 934・int 28・frontend 306）

---

## B. デモ防御（今の強みを守る）〔本スプリント〕

> 予兆の録画テイクと**同時に**詰める（60秒フックは予兆に依存）。汎用ポリッシュはしない。

### タスク D1: 60秒フック（開幕を予兆に）〔取り: Marcus / Alex〕

- 【設計】`step6-final-sprint-strategy.md` §5 の 0-15/15-35/35-60 秒構成をデモ台本に落とす
- 【UI】予兆の予報カード＋引用チップを**最初に見せられる**導線（`ForecastPage` を開幕に置く or 専用 demo 開幕ビュー）
- 【接続】「では実際に起きたら？」で反応的パイプライン（分類→ADK調査→承認）へ滑らかに遷移
- 【台本メモ・I4 より】**3b と 5 は同一根本原因（Cloud SQL 縮小）の物語**。連続で見せると重複感が出る一方、5 の関連アラートに「同一根本原因: インフラ障害（CRITICAL ログ検知）」が張られるクロスアラート相関の見せ場になる＝台本は「**3b →（波及）→ 5 で相関を回収**」の順を明記する

### タスク D2: 認知負荷トリム〔取り: Lisa〕

- [x] 【UI】デモ卓（`ScenarioControls`）のシナリオ単位開示・調査中表示・昇格通知・戻る導線・アラート名日本語化（✅ 12f517e で着地）
- [x] realness バッジ／確度スペクトルの説明文を「読む物」から「一目で分かる」へ圧縮（文言短縮・凡例のホバー化など）＝残りはこれのみ（✅ `ScenarioControls`: aiRole/description を各1行へ短縮（3/3b の長文も圧縮・⏱1分ラグと 3b 推奨は温存）、realness 凡例は常時表示を `short` 1行に絞り全文 `note` はバッジホバー（title・cursor-help）へ退避＝正直さの情報は tooltip に残す。全891テスト緑・frontend tsc 緑）
- 既存の段階開示方針の延長＝新規概念は増やさない

### タスク D3: ライブ脆さ対策〔取り: David・**最終ピッチ=渋谷ライブ確定で重要度up**〕

- 【実地データ 2026-07-02】ローカル実機で fallback を再現・計測: `adk_investigation_run_completed: elapsedMs=59396, events=1, timedOut=false, finalTextLen=0, agentTrace=[(no tool calls)]` → `ai_investigation_unparseable: rawLen=0`。**ADC マウント・env は正常なのに最初の LLM 呼び出しが応答イベント無しで59秒後に終了**（散文ですらなく空＝ADK がエラーを飲み込んだ形。トークン失効 or Vertex 側エラーの無言ドロップが疑い）。散文パターンとは別の第3の fallback 原因として真因追跡に追加
- 【実地データ 2026-07-03】**第4の原因を rawSnippet ログで確定＝最終出力 JSON の途中切断**（→ 対策はタスク I1 に集約）: シナリオ6実走で fallback 発生。finalText は正しい JSON（e12b655 正引用・confidence 0.95）だが **794 字で mid-string 切断**→parse 不能。timedOut=false・agentTrace 3委譲とも正常・成功時 finalTextLen=1182〜1642
- 【実地データ 2026-07-04・第5の原因＝wall-clock タイムアウト】シナリオ6（アプリコード退行）実走で再び fallback。ただし今回は前回と別モード: `elapsedMs=256722・timedOut=true・events=12・maxLlmCalls=16・finalTextLen=0`、agentTrace は **coordinator→root_cause_analyst を反復→impact_triage→root_cause_analyst… と実際に多段オーケストレーションが回っている**（証拠収集も成功＝fallback 画面に e12b655 等の実コミットリンクが残る）。**問題は "壊れた" ではなく "遅い"**——16 LLM 呼び出し × gemini-2.5-pro 約18-20秒/回 ≒ 250秒超 が `AI_INVESTIGATION_TIMEOUT_MS` を食い破り、coordinator が最終 JSON を吐く前に打ち切られている。**これが無人デプロイURL審査での最大リスク**（審査員が未知シナリオを踏むと4分待って fallback）。対策候補（I1 と別枠）: (a) sub-agent を gemini-flash に（推論以外の証拠収集/整形は速いモデルで十分）／(b) maxLlmCalls を 16→8-10 に絞る／(c) coordinator に「時間/呼び出しが尽きたら現時点の JSON を必ず出す」early-emit を強制／(d) timeout を実測 p95 に合わせて引き上げ。**録画・デモは known/similar/forecast（事前キャッシュ）中心にすれば回避可能だが、"未知→ADK自律調査" こそ本作の必然性の核なので、成功テイクを1本は録れる状態にするのが D3 の到達点**
- 【明文化】AI経路タイムアウト時のフォールバック導線（`GEMINI_TIMEOUT_MS`/`AI_INVESTIGATION_TIMEOUT_MS`・fallback confidence の見え方）をデモ台本に記述。fallback でも証拠リンクが残る改善（evidenceLinks 温存）は着地済み＝「失敗しても空にならない」ことを台本の保険として明記
- 【真因】ADK 散文出力（JSONでなく地の文が返る）の rawSnippet ログで真因を確定し、プロンプト側で JSON 強制を締める（fallback 率を下げる＝ライブ耐性の本丸）
- 【退避】録画テイクを正とし、ライブは「録画済みを再現する」位置づけにする（`AI_INVESTIGATION_STUB` の決定的応答経路を演出上どう使うか整理）
- 【確認】予兆導入後も main が全テスト緑・提出可能を維持（`feature/forecast` を merge する条件＝全緑）

### タスク D4: DevOpsドッグフーディング可視化〔取り: 公式審査観点「実運用を見据えたDevOpsプロセス」〕✅

- [x] 【整理】自リポジトリの CI/CD が本プロダクト自身の運用である事実を1枚図に: app.yml（typecheck/UT/E2E→build→Cloud Run/GCE deploy）・Trivy→実 ingest（シナリオ4の実経路）・terraform.yml（plan/apply・state lock 対策済み）・ai-remediation.yml（dispatch→実修正→テストゲート→draft PR）（✅ `architecture.md §6.5 DevOps ドッグフーディング（自己運用ループ）` に自己参照ループの mermaid 1枚図＋①自己デプロイ/②自己IaC/③自己検知（ループの閉じ＝Trivy→自 ingest）/④自己修復（AI→自リポジトリ draft PR）の対応を追加。README のドッグフーディング箇条書きも §6.5 へ導線）
- [x] 【デモ導線】「監視対象のECも、監視するエージェント自身も、同じ DevOps ループの中にいる」をデモ or 録画のどこで見せるか決める（発表資料側と分担）（✅ 決定記録 `docs/steps/step6-d4-devops-dogfooding.md`: **動画の"技術の裏側"パートで §6.5 図を1カット＋③を名指しナレーション**／ライブ本編には挿さない（D1 フックを薄めない）／シナリオ4 は③④の実経路なので触る際に1文添えて接地／専用ダッシュボードは不採用（D2 逆行）。ナレーション15秒案・README/ProtoPedia 分担を明記）

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
**P0 維持の根拠補強（2026-07-03 実機総点検・I4）**: シナリオ6で fallback が実発生した際、バナーは「再調査をおすすめします」と言うのに**ドロワー/詳細ページのどちらにも再調査ボタンが無い**行き止まりを再確認（`POST /alerts/:id/reinvestigate` は backend 実装済みのまま未結線）。ライブ・無人デプロイ審査の両方で fallback は現実に起きる＝導線の格上げは演出でなく必須。

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

### タスク E8: アラート詳細 AI レポートの視覚再設計 〔P0・設計済み・実装待ち〕

**問題（実機スクショ 2026-07-04）**: 詳細ページの報告書は情報粒度・カテゴリは良いが、全セクションが同じ視覚密度のテキスト縦積みで「読む物」。証拠がどこから流入し結論へ収束したかの*構造*が文でしか表現されていない。調査ステップは生エージェント名の ol リスト・算定根拠は生ログチップの横並び。

- 設計: `docs/steps/step6-report-visual-design.md`（審査員5レンズ→原則、提案A〜E、棄却案、実装計画）
- [x] (A) 証拠フローダイアグラム（metrics.evidenceCounts→SVG手組み・実測のみ・G1 の⏱1行を吸収）〔P0〕（✅ `evidenceFlowModel` domain 純関数（>0ソースのみ・太さは離散3段階・ariaSummary 1文）＋`EvidenceFlowDiagram`（流入源→AI調査→結論ノード・結論に ConfidenceGauge＋キャリブレーション注記を合流・狭幅は▼で縦積み）。fallback/旧データ/0件は null→⏱1行へ劣化。図が描けるとき ⏱1行は図ヘッダに吸収。**AI調査ノードはホバー/フォーカスで7エージェント台帳**＝「✓＝この調査のステップに登場」（`mentionedAgents`＝ステップ文の生エージェント名から決定論導出・言及ゼロならハイライト無し台帳・読み上げは sr-only 1行で代替。常時表示は図の邪魔＝D2 と同じ段階開示））
- [x] (B) 調査ステップの縦タイムライン化＋エージェント名の人間語化（時刻は捏造しない・順序のみ）〔P0〕（✅ `InvestigationTimeline`（接続線＋ノード・full のみ）＋`humanizeAgentNames`（INVESTIGATION_AGENTS 台帳へ写像・不一致は原文）。fallback の証拠リンク表示（E3）はタイムライン化しない）
- [x] (C) 結論ファースト再配置（fault/scale をヒーローへ昇格・summary 射影はノータッチ）〔P0〕（✅ AI推定パターン直下に FaultBadge＋障害規模1行（ImpactPanel と共用の FaultBadge を export）・推奨アクションを調査ステップより先に・summary は max-w-prose）
- [x] (D) 引用チップの折りたたみ＋ソース種別レーン（F8 引用レーンと同じ視覚言語）〔P1〕（✅ `groupCitations`（プレフィックス→観測データ cyan／変更履歴 amber／過去事例 emerald／その他・語り順固定）＋`CitationChips`（既定は「n件」トグルのみ・展開でレーン表示・全文 row 化で mono の可読性改善）。ImpactPanel 算定根拠／EscalationPanel 添付証拠／RemediationReviewPanel 判定根拠の3箇所を置換）
- [x] (E) 余白・見出し階層の微調整〔P1〕（✅ full は space-y-5・summary 射影は現状維持）
- backend 変更ゼロ・frontend 射影のみ。**F8 録画前に A〜C 着地が最大価値**。merge 条件＝全緑＋RTL 同時更新（✅ 全908テスト緑・frontend tsc 緑・UT/RTL 15件追加。**実機確認済み**: ローカル実スタック＋Playwright で 在庫引当の失敗（metrics 付き実レポート）の詳細ページを 1280px/420px で実描画・引用レーン展開も確認）

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

> **根拠**: ローカル実機（実 ADK・非 stub）を Playwright で全シナリオ実走（3 は GCP 専用のため 3b で代替）。実測: 既知 484ms/類似 413ms/未知カード着弾 906〜909ms・AI 調査 105〜134 秒（5走）・承認→昇格→再注入 910ms で結晶化既知。**検証済みで良好**: 初回ガイド・空状態CTA・生500非露出・dedup×N・類似67%ゲージ・E1ライブパイプライン（実イベント中継）・昇格学習ループ・3b の Terraform 差分証拠・5 の「同一根本原因」相関・4 の CVE 特定と修正起票 UI・Esc/✕/バックドロップのドロワー閉。
> その場修正済み（✅・全778テスト緑）: similarity 生 float 丸め（`AlertCardExpanded.formatValue`）／3・3b の生イベント名→ `eventCatalog` に `critical_log_entries` 追加／詳細ページ h2 の生 eventName → `eventTitle` 化／デモコンソール件数の SSE 追随（`DemoDrawer` に `refreshKey`・RTL テスト付き）／ライブパイプライン注記「実測 60〜120 秒」→「およそ 2 分前後」（実測に整合）。

### タスク I1: fallback 第4原因＝最終出力 JSON の途中切断への防御 〔P0・D3 の本丸・シナリオ6で実発生〕

- 【実測 2026-07-03】シナリオ6（アプリコード退行＝実コミット差分が売りの本丸）が fallback。rawSnippet ログで真因確定: **finalText は正しい JSON（e12b655 正引用・confidence 0.95・修正方針まで正確）だが 794 字で mid-string 切断**→ safeParse 失敗 → UI は「自動調査に失敗しました」。分析は正解なのに失敗表示＝一次審査（無人デプロイ URL）でのデモ即死パターン
- 対策（いずれか/併用）: ① parse 失敗時に**最終合成のみ1回リトライ** ② **途切れ JSON のサルベージパース**（完成済みフィールド summary/confidence/steps を best-effort 回収し、fallback でなく部分レポートとして表示） ③ 最終出力の maxOutputTokens 引き上げ
- ✅ 実装済み（2026-07-03）: **②＋③を採用**。② `salvageLLMOutput`（`LLMOutputParser`）＝括弧/文字列の状態機械で「最後に完成した値」まで巻き戻して修復パースし、summary が回収できれば部分レポート（isFallback=false）として返す。ADK/単一Gemini 両アダプタに組み込み、回収時は `ai_investigation_salvaged` を warn ログ（rawLen/rawSnippet 付き＝切断頻度の観測点）。③ Coordinator の `generateContentConfig.maxOutputTokens=65535` 明示（gemini-2.5 系は思考トークンも上限を消費するため既定値頼みにしない）。①は `runEphemeral` がセッション破棄する契約のため「最終合成のみ」の安価なリトライが組めず見送り（全グラフ再走＝2分追加は demo に不適）
- 検証: シナリオ6を複数回実走し fallback 率が下がることを確認（E2E は stub のため実走でのみ検証可能）

### タスク I2: make e2e がローカル環境を STUB のまま残す罠 〔P0・録画/デモ前の事故防止〕

- 【実測】`make e2e` の `docker compose run e2e` が depends_on 経由で backoffice-backend を **e2e overlay（AI_INVESTIGATION_STUB=true）で再作成**し、終了後もそのまま残る。次にデモ/録画すると一覧に「AI推定: **[STUB] 未知の障害パターン（推定）**」が露出（Makefile コメント「ローカル開発時は false のまま」は実態と不一致）
- 対策: `e2e` ターゲット末尾に `$(DC) up -d ec-backend backoffice-backend` を追加して local 構成へ原状復帰（+コメント修正）。**録画・提出前チェックリストにも「make e2e 後は STUB 確認」を1行**
- ✅ 実装済み（2026-07-03）: `e2e` ターゲット末尾で exit status を保持しつつ `$(DC) up -d ec-backend backoffice-backend` で原状復帰（`test-integration` と同じ status 温存パターン）。Makefile コメントを実態（overlay 再作成が残留する）に合わせて修正。チェック1行は F8 の【録画・提出前チェック】に追加

### タスク I3: investigationSteps への evidenceLinks 全件連結ノイズ 〔P0→P1・レポート信頼性〕

- 【実測】シナリオ4/6 で `demo/regression` の直近コミット10件（merge 含む・原因と無関係）が「調査完了 — AI がたどったステップ」に混入。D5 ティザー「調査ステップ 13」も水増し。同時に証拠パネルは「証拠は見つかりませんでした」（CitedCommitFilter は引用絞り済み）＝**ステップには10コミット・証拠は0件という矛盾に見える**
- 方向: `InvestigationReportMapper` の evidenceLinks 連結（`InvestigationReportMapper.ts:79`）に CitedCommitFilter と同じ**引用 sha 絞り**を適用（シナリオ6では正解 e12b655 が引用されるので残る）。**fallback 時は全件温存**＝「失敗しても空にしない」の D3 意図は守る
- 表示だけの代替案: ステップと分離して「参照した直近コミット」見出しにするだけでも矛盾は解消する
- ✅ 実装済み（2026-07-03）: 引用判定を `CitedEvidence`（AIInvestigation/domain）に**単一ソース化**（引用源 = summary / impact.citations / escalation.evidenceBundle / remediationReview.citations）し、CitedCommitFilter（証拠パネル）と `toInvestigationReport` の evidenceLinks 絞り（調査ステップ）が同じ基準を共有＝「ステップには10件・証拠は0件」の食い違いが構造的に起きない。コミットリンクは href の `/commit/{sha}` から sha を逆引きして照合、Cloud Logging 等コミット以外のリンクは決定的導出のまま温存。ガード適用後（citations 空 impact 除去後）の値を引用源にし、永続化後に読む CitedCommitFilter とずれない。`buildFallbackReport` は絞らず全件温存（D3 意図維持・回帰テストで固定）

### タスク I4: 残りの文言・整合の小粒 〔P2〕

- リセット直後の ValueStrip が「自動トリアージ 1・AI 調査 1」（seed の過去解決事例 5eed0000… が集計に乗る）: 学習履歴の種として意図的なら現状維持可。気になる場合のみ「過去実績を含む」注記 or 集計から RESOLVED 除外を判断（✅ **注記案を採用**: ストリップ末尾に「※過去実績含む」＋ tooltip に累計の説明・RTL テスト追加。RESOLVED 除外は GET /analytics の集計が Analytics ページ・昇格ファネルと共有のためここだけ意味を変えない＝不採用）
- デモ台本メモ（D1 連動）: **3b と 5 は同一根本原因（Cloud SQL 縮小）の物語**。連続で見せると重複感が出る一方、5 の関連アラートに「同一根本原因: インフラ障害（CRITICAL ログ検知）」が張られ**クロスアラート相関の見せ場**になる＝台本は「3b →（波及）→ 5 で相関を回収」の順を明記（✅ D1 のタスク本文に台本メモとして転記済み＝台本作成時に確実に乗る）
- E3（fallback 体験の格上げ）の優先度維持の根拠を実測で補強: 今回 fallback 実発生時、バナーは「再調査をおすすめします」と言うのに**ドロワー/詳細ページのどちらにも再調査ボタンが無い**行き止まりを確認（E3 は未実装のまま）（✅ E3 の問題文に「P0 維持の根拠補強（2026-07-03）」として追記済み）

---

## J. 相関の健全化＝ハルシネーション vs 関連（案B＋案A・2026-07-04）〔stretch・審査加点〕

> **背景（実機確認）**: 決済タイムアウト（他責・外部決済サービス起因）のオンデマンドレポートが、同時発生した在庫系アラートを根拠に「在庫競合→DB高負荷→決済タイムアウト」という**証拠のない因果を捏造**していた。相関は「精度 vs 再現率」の綱引き＝**ハルシネーション（でっち上げ）と関連見落とし（削りすぎ）の両にらみ**。時間窓等の決定論フィルタは正当な相関（例: インフラ障害→アプリ500＝**旧4b→6・現3b→5** の Cloud SQL 縮小の物語）まで削るため**不採用**。判別軸は「時間の近さ」でなく「**共有証拠の有無＋因果の向きの妥当性**」＝証拠グラウンディングで行う。
>
> **既に着手済み（2026-07-04）**: ① 在庫競合デモシナリオ（旧3）を廃止し汚染源を除去＋シナリオ番号 -1 繰り上げ（4→3…7→6・3b合成）。② `InvestigationPromptBuilder` の SYSTEM_INSTRUCTION で relatedAlerts の契約を厳格化（共有証拠必須・推測の因果橋禁止・他責の再分類禁止）。**本章はこの契約を"構造の歯"と"推論役"で実効化する残タスク。**
>
> **設計の据わり**: これは既存の「引用検証＝偽引用を実在照合で落とす」（Forecast §3.1・impact.citations ガード）と**同型**。「LLM は適当」への David/Lisa の懸念に、Forecast（予兆の引用）だけでなく**調査の相関**でも同じ答えを出す＝審査観点（自律的判断の設計・実運用の堅牢性）に直撃。

### タスク J1: relatedAlerts の citation 必須化＋構造ドロップ〔案B・構造の歯・P0候補〕✅

- [x] 【契約】`relatedAlerts` の wire 型に `citations: string[]`（根拠＝収集済み証拠 id: commit sha / terraform address / log id / 類似事例 id）を追加（contracts 単一ソース・後方互換 optional で開始）
- [x] 【プロンプト】SYSTEM_INSTRUCTION の relatedAlerts に「各関連に citations 必須。指せる共有証拠が無ければ関連にしない」を明記（既存の厳格化に citation 要求を接続）
- [x] 【ガード】`InvestigationReportMapper`/`LLMOutputParser` で **citations が収集済み証拠 id に解決しない関連を破棄**（impact.citations の既存ガードと同じ場所・同じ思想＝「根拠なき主張は落とす」）
- [x] 【確信度の健全化】`ConfidenceCalibration.ts:71` の `related_alert` 加点を「**citation 解決済みの関連のみ**」にゲート＝捏造相関が確信度を押し上げる現行バグ（意図的に残した残課題）を解消。**正当な相関は実在証拠を指せるので加点は温存**（削りすぎない）
- [x] 【テスト】`ConfidenceCalibration.test.ts:55-79`（証拠 id を伴わない純相関を正当扱い）を「citation を伴う正当相関＝加点／citation 無し＝非加点」へ更新。決済↔在庫（共有証拠ゼロ）が落ちること・インフラ→アプリ（terraform/commit 共有）が残ることを固定
- 【なぜ効くか】決済タイムアウトは infraEvidence（commit/terraform）がゼロ＝指せる共有証拠が無い→捏造相関は構造的に落ちる。インフラ→アプリは terraform/commit を共有→残る
- ✅ **実装済み（2026-07-05）**: 照合語彙は `collectCitableEvidenceIds`（`CitedEvidence.ts`＝引用判定の単一ソースに同居・小文字化済み）＝ **commit sha / terraform リソースアドレス・由来 sha / メトリクス名（metricType・displayName）に限定**。todo 記載の「log id / 類似事例 id」は語彙に**含めない**設計判断: appLogs は安定 id が無く resource 名は「同時期にログが存在する」程度の弱い歯＝捏造を通す／similarIncidents は「自分の類似事例」を写すだけで解決してしまい「infraEvidence ゼロの他責障害では指せる共有証拠が無い」という構造の歯（上記【なぜ効くか】）が抜ける。precision 優先・向きの妥当性は J2 の領分。ガードは `guardRelatedAlerts`（マッパ・Forecast 引用検証と同型の2段: 未解決 citation を除去→解決ゼロの関連を丸ごと破棄。解決判定は「citation 文字列が証拠 id を含む」＝cited_commit と同じ流儀・case-insensitive）。両アダプタ（単一Gemini/ADK）が `toInvestigationReport(output, evidenceLinks, citableEvidenceIds)` で語彙を渡す（未指定の既定は空＝安全側で全破棄）・salvage（切断回収）経路にも同ガード適用。確信度は「candidateAlerts 突合 ∧ citations 非空」で加点（マッパ通過後の関連は解決済み citation を必ず持つ＝正当相関の加点温存・旧データの citation 無し相関は非加点）。UT: mapper 3件（未解決 citation のみ除去・共有証拠ゼロの捏造は丸ごと破棄・case-insensitive）/ parser 2件 / calibration 1件 / `CitedEvidence.test.ts` 3件を追加。全921テスト緑・frontend tsc 緑（wire は optional 追加のみ・UI 変更なし）。E2E は stub が relatedAlerts を返さないため影響なし。**実 Gemini で 3b→5 の正当相関（terraform 共有）が残ることの実走確認は人間**（F8 実走と同時が効率的）

### タスク J2: 相関検証エージェント（correlation_verifier）〔案A・向きの推論・stretch〕✅

- [x] 【新規】`agents/CorrelationVerifierAgent.ts`＝`remediation_reviewer` と同型の**批判役（read-only・推論のみ）**。root_cause が挙げた relatedAlerts 候補ごとに verdict（keep/reject＋理由）を返す
- [x] 判定基準: ① 具体的な共有証拠を指せるか（案B の citation と同基準）② **fault 分類に対し因果の向きが妥当か**（外部起因＝他責の障害を内部原因で説明していないか＝人間なら取らない向きの排除）
- [x] 【配線】`InvestigationCoordinator` の手順に「root_cause の相関案を確定前に correlation_verifier へ通す」を追加。maxLlmCalls 予算に載る（既知パターン時は既存方針どおり省略可）
- 【役割分担】案B＝「証拠 id の有無」を機械判定（決定論の歯）／案A＝「向きの妥当性」を推論判定。二段で precision を上げつつ recall（正当な相関）を守る
- 【コスト注意】D3 の ADK 遅延（maxLlmCalls×gemini-2.5-pro）に1段足すので、verifier は軽量モデル（flash）候補＝§D3 (a) と併せて検討
- ✅ **実装済み（2026-07-05）**: `CorrelationVerifierAgent`（推論のみ・ツール無し＝root_cause_analyst と同構成・「迷う場合は reject 側に倒す」を明記＝疑わしい相関を残す利益は無い）。Coordinator の手順に**新ステップ5**（impact.fault 確定後・最終 JSON 出力前）: 候補一覧＋根本原因＋fault＋収集済み証拠を渡し **keep のみ relatedAlerts に載せる**・候補ゼロ/既知パターンで相関を挙げない場合は呼ばない（呼び出し予算は impact_triage/runbook_escalation 優先）。**モデルは D3 対策で分離**: `AI_INVESTIGATION_VERIFIER_MODEL`（`config.ai.adkVerifierModel`・**既定 gemini-2.5-flash**＝1ショット判定は速度優先。runner の `verifierModel` 未指定時は本体 model にフォールバック＝新しい失敗モードを増やさない）。フロントは `INVESTIGATION_AGENTS` 台帳に correlation_verifier を追加（impact_triage の次）＝E1 ライブ中継・台帳表示・人間語化は台帳から自動導出。**7→8エージェント**（README・architecture 図・提出資料プロンプト・UI 文言・.env.example を一括更新）。J1 のマッパガードは決定論のバックストップとして不変（verifier が keep を誤っても citation 未解決なら落ちる）。全923テスト緑・frontend tsc 緑（ADK graph は「疎通主体の薄い infra」＝既存方針どおりエージェント factory の UT は作らない）。**実 Gemini での実走確認（3b→5 の正当相関が verifier を通って keep されること・LLM 1呼び出し追加で fallback 率が悪化しないこと・flash がプロジェクトで有効なこと）は人間**（F8/D3 実走と同時が効率的）

### 案D（依存グラフ/トポロジ制約）〔不採用・ハッカソン後の布石〕

- サービス依存（payment→外部 / order→inventory→DB…）を宣言し、依存エッジの向きにしか相関を張らせない＝「payment の上流に internal DB」を構造的に不可能化。成熟した observability の定番（因果グラフ/サービスマップ）。
- **今回不採用**: 依存モデルの導入コストが重く、案B＋案A で本問題は解ける。将来価値が出たら `ForecastSignalSource[]` 同様の継ぎ目として設計/ADR で語る。

---

## C. ハッカソン後（設計/ADRのみ・実装しない）

> stretchⅢ（event-log 基盤・予知ビュー）は `step4-1` §7.10 ＋ 各 step4 todo の stretchⅢ 節が正。本スプリントでは着手しない。継ぎ目 `ForecastSignalSource[]`（F1）を守るのが唯一の前提作業。予兆 ADR 種は `step4-1` タスク8（step4-1-strategy-todo.md）に残置。
