import { GoogleGenAI } from "@google/genai";
import { LLMTextClient } from "../../domain/LLMTextClient.js";
import { LLMClientError } from "../errors/LLMClientError.js";

// 1回の generateContent のクライアント側タイムアウト。gemini-2.5-pro は JSON 応答＋推論で
// 30秒を超える回が多く、旧既定 30秒だと毎回「Gemini timeout」→ fallback（confidence=0）に落ちていた。
// 既定を 90秒へ引き上げ、env で調整可能にする（ADK 経路の AI_INVESTIGATION_TIMEOUT_MS とは別軸の、
// 単一Gemini経路の上限。高速化したい場合は GEMINI_MODEL=gemini-2.5-flash の併用も可）。
const TIMEOUT_MS = Math.max(
  1_000,
  parseInt(process.env.GEMINI_TIMEOUT_MS ?? "90000"),
);
const MAX_ATTEMPTS = Math.max(1, parseInt(process.env.GEMINI_MAX_ATTEMPTS ?? "2"));

/**
 * Gemini（@google/genai）固有の「text in → text out」実装。
 * SDK 初期化・generateContent 呼び出し・レスポンス本文の抽出に加え、
 * 呼び出しの信頼性（タイムアウト＋1回リトライ）まで本クライアントが担う。
 *
 * モデルへの到達経路は env で2系統を切り替える（同じ Gemini モデル・課金経路だけが違う）:
 *   - GOOGLE_GENAI_USE_VERTEXAI=true → Vertex AI 経由。認証は ADC（Cloud Run / GCE は
 *     アタッチされた SA、ローカルは `gcloud auth application-default login`）。API キー不要で、
 *     GCP の課金（＝$300 無料クレジット / 予算アラート）が適用される。← 本番の既定。
 *   - それ以外 → Google AI Studio 経由（GEMINI_API_KEY・APIキー課金。無料クレジット対象外）。
 *     ローカルで ADC を用意できない場合のフォールバック。
 *
 * 出力のパース／バリデーション／ドメインマッピングは持たない（LLMInvestigationAdapter の責務）。
 */
export class GeminiLLMClient implements LLMTextClient {
  private readonly genAI: GoogleGenAI;
  private readonly modelName: string;

  constructor() {
    this.modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-pro";

    if (process.env.GOOGLE_GENAI_USE_VERTEXAI === "true") {
      const project =
        process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT_ID ?? "";
      const location = process.env.GOOGLE_CLOUD_LOCATION ?? "global";
      this.genAI = new GoogleGenAI({ vertexai: true, project, location });
    } else {
      const apiKey = process.env.GEMINI_API_KEY ?? "";
      this.genAI = new GoogleGenAI({ apiKey });
    }
  }

  async generate(systemInstruction: string, prompt: string): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const result = await Promise.race([
          this.genAI.models.generateContent({
            model: this.modelName,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Gemini timeout")), TIMEOUT_MS),
          ),
        ]);
        return result.text ?? "";
      } catch (error) {
        lastError = error;
      }
    }

    throw new LLMClientError("Gemini", lastError);
  }
}
