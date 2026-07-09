export const config = {
  port: parseInt(process.env.PORT ?? "3001"),
  mongoUrl: process.env.MONGO_URL ?? "mongodb://localhost:27017/monitoring",
  rabbitmq: {
    host: process.env.RABBITMQ_HOST ?? "localhost",
    port: parseInt(process.env.RABBITMQ_PORT ?? "5672"),
    user: process.env.RABBITMQ_USER ?? "guest",
    pass: process.env.RABBITMQ_PASS ?? "guest",
    vhost: process.env.RABBITMQ_VHOST ?? "/",
    retryTtl: parseInt(process.env.RABBITMQ_RETRY_TTL ?? "5000"),
    exchangeName: process.env.EXCHANGE_NAME ?? "ec-domain-events",
    // channel prefetch（未ack同時配信上限）。1 だと長時間ハンドラ（AI調査 ~100秒）が全キューを止める
    // ヘッドオブラインブロッキングになるため、完了後 ack（at-least-once）を保ったまま並列度を上げる。
    // 既定 3（並列2で既に ~116秒なので 429/遅延を抑えつつ collect 用の枠も残す）。
    prefetch: Math.max(1, parseInt(process.env.RABBITMQ_PREFETCH ?? "3")),
  },
  gemini: {
    // true で Vertex AI 経由（ADC 認証・GCP 無料クレジット対象・本番既定）、false で AI Studio（APIキー課金）。
    useVertexAI: process.env.GOOGLE_GENAI_USE_VERTEXAI === "true",
    project:
      process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT_ID ?? "",
    location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
    // AI Studio フォールバック用（useVertexAI=false のときのみ使用）。
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-pro",
  },
  ai: {
    // true で AI調査の LLM を StubLLMClient に差し替える（ローカルE2E用・Gemini課金なし）。最優先。
    useStubInvestigation: process.env.AI_INVESTIGATION_STUB === "true",
    // true で AIInvestigationPort を ADK マルチエージェント版（タスク18）に差し替える（Vertex 必須）。
    // stub が優先。未設定なら単一Gemini版（LLMInvestigationAdapter）。
    useAdk: process.env.AI_INVESTIGATION_ADK === "true",
    // ADK 自律ループの LLM 呼び出し上限（トークン暴走の安全弁。dispatch ループの maxAttempts と同思想）。
    adkMaxLlmCalls: Math.max(
      1,
      parseInt(process.env.AI_INVESTIGATION_ADK_MAX_LLM_CALLS ?? "8"),
    ),
    // 相関検証エージェント（correlation_verifier・タスク J2）専用のモデル。批判役は1ショットの
    // keep/reject 判定で応答速度が効く（D3 の wall-clock 逼迫に LLM 1呼び出し足すため）ので既定 flash。
    adkVerifierModel:
      process.env.AI_INVESTIGATION_VERIFIER_MODEL ?? "gemini-2.5-flash",
    // ロール別の静的モデル割当（D3 対策①・sub-agent 軽量化）。ロール＝難易度の代理変数なので
    // 実行時のルーターLLMは挟まず、env で決定的にチューニングする（agentTrace/elapsedMs を見て調整）。
    // evidence_collector: ツール往復が主で推論が薄く、自律ループで最も呼ばれる→既定 flash。
    adkCollectorModel:
      process.env.AI_INVESTIGATION_COLLECTOR_MODEL ?? "gemini-2.5-flash",
    // runbook_escalation: 体制マスタ引き＋定型草案で推論が薄い→既定 flash。
    adkEscalationModel:
      process.env.AI_INVESTIGATION_ESCALATION_MODEL ?? "gemini-2.5-flash",
    // impact_triage: citation 必須の算定（空なら impact ごと破棄されるガード直結）のため、
    // 既定は主モデル（未指定=undefined→runner 側で model にフォールバック）。flash 化は env で計測してから。
    adkTriageModel: process.env.AI_INVESTIGATION_TRIAGE_MODEL,
    // コーディネーターの思考トークン予算（fallback 第6原因＝思考が maxOutputTokens を食い潰し空応答の防御レバー）。
    // gemini-2.5-pro は思考も出力予算を消費するため上限にキャップして最終JSON用トークンを必ず残す。
    // 有効域は 128〜32768、-1 で動的（モデル任せ）。増やすほど推論は深いが wall-clock が伸びて
    // D3（無人審査のタイムアウト→fallback）リスクが上がるトレードオフ。既定 16384 はバランス点
    // （最終JSONは高々2KB弱なので 65535 のうち約49Kが回答に残る）。
    adkCoordinatorThinkingBudget: parseInt(
      process.env.AI_INVESTIGATION_COORDINATOR_THINKING_BUDGET ?? "16384",
    ),
    // AI調査1件のウォールクロック上限(ms)。ADK の8エージェント自律ループは実測 92-116秒かかり、
    // 既定120秒では並列実行時に超過して暫定落ちする。240秒へ広げて余裕を持たせる。
    investigationTimeoutMs: Math.max(
      1_000,
      parseInt(process.env.AI_INVESTIGATION_TIMEOUT_MS ?? "240000"),
    ),
  },
  forecast: {
    // 予兆ブリーフィング（step6 F系）。既定 on＝forecast ルートは 404・既存P0経路に影響ゼロ。
    enabled: process.env.FORECAST_ENABLED ?? "true",
    // 予報の対象期間。POST /forecast はこの値で固定生成する（無認証デモ経路に入力面を作らない）。
    horizon: process.env.FORECAST_HORIZON ?? "今週末",
    // flagship plan-1（バックボーン VM を e2-standard-2→e2-small に縮小）の引用チップ「証拠を開く」
    // の解決先＝この plan を CI の terraform plan ジョブで本物の plan として生成した実 PR（#83）。
    // DEMO_INFRA_APPLY_PR_URL（scenario3/3b の適用済み証拠 PR #60）と同じ「事前起票した本物を毎回指す」
    // 割り切り。空にすると plan-1 は非リンク表示に戻る（env で上書き可）。
    pendingPlanPrUrl:
      process.env.FORECAST_PENDING_PLAN_PR_URL ??
      "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/83",
    // U2 plan-2（Valkey maxmemory 縮小）は**合成 seed のまま非リンク**にする。Valkey は VM 上の
    // compose プロセスで terraform 単独リソースを持たず、本物の terraform plan を作れない
    // （VM metadata 経由にすると address が backbone VM になり flagship と subject 衝突するため不採用）。
    // Valkey シナリオの実クリック証拠は過去インシデント（inc-3/4→実 Alert）が担保する。
  },
  demo: {
    enabled: process.env.DEMO_ENABLED === "true",
    feedbackAutoPromoteThreshold: parseInt(
      process.env.FEEDBACK_AUTO_PROMOTE_THRESHOLD ?? "3",
    ),
    // demo シナリオ facade が EC backend を叩くための接続先と、注文投入に使う商品
    ecBackendUrl: process.env.EC_BACKEND_URL ?? "http://localhost:3000",
    productId: process.env.DEMO_PRODUCT_ID ?? "demo-product-1",
    // インフラ障害シナリオ（3/3b）の apply 差分に添える「由来変更の実 PR」URL（REMEDIATION_DEMO_PR_URL
    // と同じ割り切り＝事前に手動起票した本物を毎回指す）。空なら Terraform 証拠は従来通り非リンク表示。
    infraApplyPrUrl:
      process.env.DEMO_INFRA_APPLY_PR_URL ??
      "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/60",
  },
  github: {
    token: process.env.GITHUB_TOKEN ?? "",
    targetRepo: process.env.GITHUB_TARGET_REPO ?? "",
    // 調査が「どの ref を見るか」。空＝既定ブランチ(main)を時間窓で絞る（本番）。
    // デモ環境では demo/regression を指す＝そのブランチの直近コミットを壁時計非依存で証跡に使う
    // （静的に1回積んだ証跡コミットを、審査員がいつ閲覧しても発見できるようにするため）。
    targetRef: process.env.GITHUB_TARGET_REF ?? "",
    // 修正PRの起票先。未設定なら調査用の targetRepo にフォールバック（同一リポを想定）。
    remediationRepo:
      process.env.GITHUB_REMEDIATION_REPO ??
      process.env.GITHUB_TARGET_REPO ??
      "",
    // 修正PRの base ブランチ。空＝既定ブランチ(main)。デモは main を汚さないため
    // 事前用意の baseline ブランチ（脆弱な状態）を指し、そこへ修正 PR を向ける。
    remediationBaseRef: process.env.GITHUB_REMEDIATION_BASE_REF ?? "",
  },
  remediation: {
    // "dispatch" = CI(GitHub Actions)のAIエージェントへ repository_dispatch（実修正+UT/E2E）。
    // "advisory" = in-process で SECURITY_REMEDIATION.md の方針PRを起票（CI不要・既定）。
    // "demo"     = 事前に1本だけ起票した本物の草案PRのURL（REMEDIATION_DEMO_PR_URL）を毎回返す。
    //              GitHub 非接触・PR増殖なし・書き込みトークン不要（審査/デモ用・既定）。
    //              実際にPRを起票したい場合のみ advisory / dispatch を明示する。
    mode: (process.env.REMEDIATION_MODE ?? "demo") as
      | "dispatch"
      | "advisory"
      | "demo",
    // demo モードで返す、事前に手動起票した本物の草案PRのURL（シナリオ4＝脆弱性検知用）。
    demoPullRequestUrl:
      process.env.REMEDIATION_DEMO_PR_URL ??
      "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/29",
    // dispatch 経路で起動する repository_dispatch のイベント種別（ターゲットリポの workflow と一致させる）。
    dispatchEventType:
      process.env.REMEDIATION_DISPATCH_EVENT_TYPE ?? "ai-remediation",
    // AI修正→検証→再修正の自己修正ループ上限。通らないと延々リトライして課金暴走するのを防ぐ安全弁。
    // CI 側ループ（ai-remediation.yml）と将来の調査検証ループ（タスク16）の両方が従う単一ソース。
    maxAttempts: Math.max(
      1,
      parseInt(process.env.REMEDIATION_MAX_ATTEMPTS ?? "2"),
    ),
  },
  elasticsearch: {
    // 空なら InMemory にフォールバック（SimilarPatternRule は無効）。設定すると ES バックエンド＋graded confidence 分類が有効化される。
    url: process.env.ELASTICSEARCH_URL ?? "",
    similarIncidentsIndex:
      process.env.ELASTICSEARCH_SIMILAR_INCIDENTS_INDEX ?? "similar-incidents",
    // リポジトリの search は既に有界な字句類似度 [0,1]（lexicalSimilarity）を返すので、
    // SimilarPatternRule 側の正規化は実質恒等＝既定 1。生 BM25 を消費していた頃の名残の安全クランプ。
    similarScoreCeiling: Number(
      process.env.ELASTICSEARCH_SIMILAR_SCORE_CEILING ?? 1,
    ),
    // この確度未満は棄権して AI 調査経路に回す
    similarMinConfidence: Number(
      process.env.ELASTICSEARCH_SIMILAR_MIN_CONFIDENCE ?? 0.6,
    ),
  },
  valkey: {
    // 空なら無効＝null object でフォールバックし、in-process notifier（EventEmitterSSEAlertNotifier）/
    // Mongo 直読のまま（現状動作を壊さない）。設定すると SSE Pub/Sub fan-out（task17）と
    // read-model projection（task18）が有効化される。compose/Cloud Run に注入されていてもアプリ未読込なら no-op。
    url: process.env.REDIS_URL ?? "",
  },
  // プロセスの起動ロール（task19 で分岐）。
  // all = 単一プロセス（既定・ローカル/現状。Subscriber+クエリ+SSE を1プロセス）、
  // worker = RabbitMQ Subscriber+projector+publish 側、edge = クエリ/SSE+subscribe 側。
  role: (process.env.ROLE ?? "all") as "all" | "worker" | "edge",
  ingestToken: process.env.INGEST_TOKEN ?? "",
} as const;
