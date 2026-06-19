import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMTextClient } from "../../domain/LLMTextClient.js";
import { LLMClientError } from "../errors/LLMClientError.js";

const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;

/**
 * Gemini API（@google/generative-ai）固有の「text in → text out」実装。
 * SDK 初期化・generateContent 呼び出し・レスポンス本文の抽出に加え、
 * 呼び出しの信頼性（タイムアウト＋1回リトライ）まで本クライアントが担う。
 *
 * 出力のパース／バリデーション／ドメインマッピングは持たない（LLMInvestigationAdapter の責務）。
 */
export class GeminiLLMClient implements LLMTextClient {
  private readonly genAI: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY ?? "";
    this.modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generate(systemInstruction: string, prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction,
      generationConfig: { responseMimeType: "application/json" },
    });

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Gemini timeout")), TIMEOUT_MS),
          ),
        ]);
        return result.response.text();
      } catch (error) {
        lastError = error;
      }
    }

    throw new LLMClientError("Gemini", lastError);
  }
}
