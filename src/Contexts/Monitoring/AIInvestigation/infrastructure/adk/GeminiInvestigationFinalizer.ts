import { GoogleGenAI } from "@google/genai";
import { LLMClientError } from "../errors/LLMClientError.js";
import { INVESTIGATION_RESPONSE_SCHEMA } from "../aiinvestigation/investigationResponseSchema.js";
import type {
  InvestigationFinalizer,
  InvestigationTranscript,
} from "./InvestigationFinalizer.js";
import { FINALIZER_INSTRUCTION, buildFinalizerPrompt } from "./finalizerPrompt.js";

export type GeminiInvestigationFinalizerConfig = {
  /** 清書役のモデル。推論でなく転記なので軽量モデル（flash）想定。 */
  readonly model: string;
  /** Vertex AI 経由（ADC 認証・本番既定）か、AI Studio 経由（APIキー）か。 */
  readonly useVertexAI: boolean;
  readonly project?: string;
  readonly location?: string;
  readonly apiKey?: string;
  /** 1回の清書のクライアント側タイムアウト(ms)。調査本体の後ろに直列で乗るので短く。 */
  readonly timeoutMs?: number;
};

/** 清書は転記なので待たされる理由が無い。ここで詰まるくらいなら下書きへ縮退した方が速い。 */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * `InvestigationFinalizer` の Gemini 実装（ADR-26 恒久策）。
 *
 * ツールを一切持たない単発 `generateContent` に `responseSchema`（制約付きデコード）を付け、
 * 思考予算を 0 にする。これで「思考が maxOutputTokens を食い潰して回答が 0 文字」も
 * 「JSON でなく散文が返る」も原理的に起こらない——前者は思考が予算を取らないため、
 * 後者は制約付きデコードが JSON 以外のトークンを出せないため。
 *
 * GeminiLLMClient と同じく「疎通主体の薄い infra」なのでユニットテストはコロケーションせず、
 * プロンプト構築は finalizerPrompt.ts、縮退判断は finalizeInvestigationOutput.ts の UT で担保する。
 */
export class GeminiInvestigationFinalizer implements InvestigationFinalizer {
  private readonly genAI: GoogleGenAI;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config: GeminiInvestigationFinalizerConfig) {
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.genAI = config.useVertexAI
      ? new GoogleGenAI({
          vertexai: true,
          project: config.project ?? "",
          location: config.location ?? "global",
        })
      : new GoogleGenAI({ apiKey: config.apiKey ?? "" });
  }

  async finalize(transcript: InvestigationTranscript): Promise<string> {
    try {
      const result = await Promise.race([
        this.genAI.models.generateContent({
          model: this.model,
          contents: buildFinalizerPrompt(transcript),
          config: {
            systemInstruction: FINALIZER_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: INVESTIGATION_RESPONSE_SCHEMA,
            // 転記に熟考は要らない。0 にすることで「思考が出力予算を食い潰す」機序を断つ
            // （縮退リトライの min(4096,…) は同じレバーを弱めただけの対症、こちらは根を外す）。
            thinkingConfig: { thinkingBudget: 0 },
            maxOutputTokens: 65535,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Gemini finalizer timeout")),
            this.timeoutMs,
          ),
        ),
      ]);
      return result.text ?? "";
    } catch (error) {
      // リトライはしない。ここで粘るより、コーディネーターの下書きへ縮退する方が速くて安全
      // （下書きが使えるなら現行と同等、使えないなら既存の縮退リトライが受け止める）。
      throw new LLMClientError("Gemini(finalizer)", error);
    }
  }
}
