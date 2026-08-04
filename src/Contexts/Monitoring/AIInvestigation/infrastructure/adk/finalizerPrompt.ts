import { SYSTEM_INSTRUCTION } from "../aiinvestigation/InvestigationPromptBuilder.js";
import type { InvestigationTranscript } from "./InvestigationFinalizer.js";

/**
 * finalizer（清書役）のプロンプト構築。純関数＝プロバイダ非依存でここだけ UT する
 * （疎通は GeminiInvestigationFinalizer の責務。InvestigationPromptBuilder / GeminiLLMClient と同じ分け方）。
 */

/**
 * 1サブエージェント出力あたりの上限。証拠を丸ごと引き写す collector が長文を返すことがあり、
 * 無制限だと清書1回のコンテキストが調査本体より太る。結論は先頭に出るので先頭側を残す。
 */
const MAX_OUTPUT_CHARS = 6_000;

/** 直近のみ残す件数。同じサブエージェントの反復呼び出しでは後の回ほど証拠が多い。 */
const MAX_OUTPUTS = 20;

/**
 * 清書役の役割指示。出力スキーマ・引用規約・確信度の較正基準は調査本体と同一である必要があるため
 * SYSTEM_INSTRUCTION をそのまま再利用し（コーディネーターと同じ流儀）、その上に「調査はしない・
 * 転記だけする」の制約を重ねる。
 */
export const FINALIZER_INSTRUCTION =
  SYSTEM_INSTRUCTION +
  `

【あなたの役割：清書役（finalizer）】
あなたは調査を**しません**。すでに終わった調査の記録を、上の JSON スキーマへ**転記するだけ**です。
ツールは持たず、追加の証拠収集も再分析も行いません。

厳守事項:
- 記録に現れた内容だけを書く。新しい原因・宛先（team）・引用（citations）・PR URL を作らない。
- 記録に根拠が無い項目は、空文字やプレースホルダで埋めず**フィールドごと省略**する。
  とくに escalation は runbook_escalation が実際に引いた宛先がある場合のみ載せる（宛先の捏造は禁止）。
- citations / evidenceBundle は入力の citableIds に実在する文字列の逐語コピーだけを使う。
- 結論を作り直さない。summary・confidence・severity は記録の到達点をそのまま反映する
  （記録より自信のある書き方にしない）。
- 記録どうしが食い違う場合は、より後に出た記述（より多くの証拠を見た側）を採る。
- コーディネーターの下書きが空でも、サブエージェントの出力だけから JSON を組み立てる。
  下書きが空であること自体を summary に書かない（調査の結論を書く）。`;

/** 1件ぶんの見出し付き本文。空出力は「呼ばれたが何も返さなかった」事実として残す。 */
function renderSubAgentOutput(
  entry: InvestigationTranscript["subAgentOutputs"][number],
  index: number,
): string {
  const body = entry.output.trim();
  const clipped =
    body.length > MAX_OUTPUT_CHARS ? `${body.slice(0, MAX_OUTPUT_CHARS)}…（以下省略）` : body;
  return `### ${index + 1}. ${entry.agent}\n${clipped === "" ? "(空応答)" : clipped}`;
}

export function buildFinalizerPrompt(transcript: InvestigationTranscript): string {
  const outputs = transcript.subAgentOutputs.slice(-MAX_OUTPUTS);
  const subAgentSection =
    outputs.length === 0
      ? "(サブエージェントの出力なし)"
      : outputs.map(renderSubAgentOutput).join("\n\n");
  const draft = transcript.coordinatorFinalText.trim();

  return `以下は、すでに完了した障害調査セッションの記録です。これを JSON へ清書してください。

## 調査の入力（citableIds＝引用してよい ID の全量を含む）
${transcript.seedPrompt}

## サブエージェントの出力（時系列）
${subAgentSection}

## コーディネーターの下書き
${draft === "" ? "(空。※これは異常ではなく、上のサブエージェント出力から組み立ててください)" : draft}`;
}
