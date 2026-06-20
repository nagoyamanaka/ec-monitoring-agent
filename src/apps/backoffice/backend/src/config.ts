export const config = {
  port: parseInt(process.env.PORT ?? "3001"),
  mongoUrl: process.env.MONGO_URL ?? "mongodb://localhost:27017/monitoring",
  rabbitmqUrl: process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672/",
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  },
  demo: {
    enabled: process.env.DEMO_ENABLED === "true",
    feedbackAutoPromoteThreshold: parseInt(
      process.env.FEEDBACK_AUTO_PROMOTE_THRESHOLD ?? "3"
    ),
  },
  github: {
    token: process.env.GITHUB_TOKEN ?? "",
    targetRepo: process.env.GITHUB_TARGET_REPO ?? "",
  },
  ingestToken: process.env.INGEST_TOKEN ?? "",
} as const;
