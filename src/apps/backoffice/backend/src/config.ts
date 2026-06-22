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
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  },
  ai: {
    // true で AI調査の LLM を StubLLMClient に差し替える（ローカルE2E用・Gemini課金なし）
    useStubInvestigation: process.env.AI_INVESTIGATION_STUB === "true",
  },
  demo: {
    enabled: process.env.DEMO_ENABLED === "true",
    feedbackAutoPromoteThreshold: parseInt(
      process.env.FEEDBACK_AUTO_PROMOTE_THRESHOLD ?? "3"
    ),
    // demo シナリオ facade が EC backend を叩くための接続先と、注文投入に使う商品
    ecBackendUrl: process.env.EC_BACKEND_URL ?? "http://localhost:3000",
    productId: process.env.DEMO_PRODUCT_ID ?? "demo-product-1",
  },
  github: {
    token: process.env.GITHUB_TOKEN ?? "",
    targetRepo: process.env.GITHUB_TARGET_REPO ?? "",
  },
  elasticsearch: {
    // 空なら InMemory にフォールバック（SimilarPatternRule は無効）。設定すると ES バックエンド＋graded confidence 分類が有効化される。
    url: process.env.ELASTICSEARCH_URL ?? "",
    similarIncidentsIndex:
      process.env.ELASTICSEARCH_SIMILAR_INCIDENTS_INDEX ?? "similar-incidents",
    // BM25 の生スコアは corpus 依存・非有界なので [0,1] 正規化の飽和点は env で調整可能にする
    // （短文の解決メモだと max は数程度。デフォルトは控えめに 5）。
    similarScoreCeiling: Number(
      process.env.ELASTICSEARCH_SIMILAR_SCORE_CEILING ?? 5,
    ),
    // この確度未満は棄権して AI 調査経路に回す
    similarMinConfidence: Number(
      process.env.ELASTICSEARCH_SIMILAR_MIN_CONFIDENCE ?? 0.6,
    ),
  },
  ingestToken: process.env.INGEST_TOKEN ?? "",
} as const;
