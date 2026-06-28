import { InvestigationContext } from "../../domain/InvestigationContext.js";

/**
 * LLMへ送るプロンプトの構築（プロバイダ非依存）。
 * systemInstruction は固定。userPrompt はトークン予算（3,500）を超えないよう
 * similarIncidents を動的に削減する。
 */

export const SYSTEM_INSTRUCTION = `あなたはECシステムの障害調査AIエージェントです。
提供された障害イベント・既知パターン・類似インシデント・インフラ証拠（InfraEvidence）を分析し、
必ずJSONフォーマットで回答してください。
errorEvent.severity はソースが観測時点で付与した事前重大度です。これを出発点（prior）とし、
証拠から見直す根拠がある場合のみ severity を変更してください。
infraEvidence.metrics は Cloud Monitoring から相関取得した症状指標（CPU/メモリ使用率・5xx 数）の
窓内サマリ（latest/max）です。インフラ起因の障害では、この値の急増・飽和を根本原因推定の裏付けに
使ってください（例: 5xx 数の急増 × CPU 飽和 → 容量起因）。
suggestedActions には「どう直すか」の具体的な修正方針を含めてください（例: 依存パッケージの
バージョン更新なら "axios を 1.6.0 → 1.7.4 に更新 (CVE-XXXX)"）。これがユーザーが remediate を
実行するか判断する材料になります。
remediable は「自社コードの変更（依存更新・設定/コード修正）で直せ、PR 起票で対処可能」と
判断できる場合のみ true。インフラ手動対応・外部要因・運用対応が必要なものは false。
operatorFeedback が含まれる場合は、人間オペレータによる再調査依頼です。前回調査の誤りの指摘や
修正方針が書かれているので、これを最優先の手がかりとして結論（summary・severity・アクション）を
見直してください。
candidateAlerts は同時期に発生している他のアラート一覧です。今回の障害と根本原因を共有する・
波及関係にある等、関連すると判断したものだけを relatedAlerts に載せてください。必ず candidateAlerts に
実在する alertId を参照し、存在しない ID を作らないこと。関連が無ければ空配列にしてください。
relation は same_root_cause（同一根本原因）/ downstream（波及・下流）/ upstream（起因・上流）/
precursor（予兆）/ similar（同型）から選び、rationale に関連と判断した根拠を1文で書いてください。
impact は「今回の障害ぶんの判断」です。fault は own（自社コード/IaC 起因＝直近 commit・terraform 差分と
相関する）/ external（外部API・ベンダー起因＝直近の自社変更が無い）/ unknown（証拠不足で断定不能）から
選んでください。scope（影響範囲）・scale（障害規模＝件数/割合/継続時間）も算定し、affectedSubjects に
影響を受けた主体（サービス名・チーム・顧客セグメント）を列挙してください。impact の各算定には必ず根拠の
citations（参照した証拠ログ・類似インシデント・commit/terraform 差分の id）を載せ、証拠に無いことは
推測で断定せず fault を "unknown" にしてください。citations を出せない（証拠で裏付けられない）場合は
impact を省略してください（根拠なき影響主張は出さない）。
{
  "summary": "障害の説明（日本語・1〜2文）",
  "confidence": 0.87,
  "severity": "CRITICAL" | "WARNING" | "INFO",
  "investigationSteps": ["調べたこと1", "調べたこと2"],
  "suggestedActions": ["対応アクション1（具体的な修正方針）", "対応アクション2"],
  "suggestedPatternName": "自動昇格候補のパターン名（例: DB_CONNECTION_EXHAUSTION）",
  "remediable": true | false,
  "relatedAlerts": [{ "alertId": "...", "relation": "same_root_cause", "rationale": "関連の根拠（1文）" }],
  "impact": { "fault": "own" | "external" | "unknown", "scope": "影響範囲（1文）", "scale": "障害規模（1文）", "affectedSubjects": ["payment", "..."], "citations": ["証拠/類似事例の id", "..."] }
}`;

const MAX_ESTIMATED_TOKENS = 3500;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function buildUserPrompt(context: InvestigationContext): string {
  // 人間の指摘は再調査の最重要シグナル。トークン削減時も落とさない。
  const operatorFeedback = context.operatorNote
    ? { operatorFeedback: context.operatorNote }
    : {};

  // 相関候補は alertId 参照に必要なため、トークン削減時も落とさない（件数自体は use case 側で上限制御）。
  const candidateAlerts = context.candidateAlerts?.length
    ? { candidateAlerts: context.candidateAlerts }
    : {};

  const full = JSON.stringify(
    {
      errorEvent: context.errorEvent,
      knownPatterns: context.knownPatterns,
      similarIncidents: context.similarIncidents,
      ...(context.infraEvidence ? { infraEvidence: context.infraEvidence } : {}),
      ...candidateAlerts,
      ...operatorFeedback,
    },
    null,
    2,
  );

  if (estimateTokens(SYSTEM_INSTRUCTION + full) <= MAX_ESTIMATED_TOKENS) {
    return full;
  }

  return JSON.stringify(
    {
      errorEvent: context.errorEvent,
      knownPatterns: context.knownPatterns,
      similarIncidents: [],
      ...(context.infraEvidence ? { infraEvidence: context.infraEvidence } : {}),
      ...candidateAlerts,
      ...operatorFeedback,
    },
    null,
    2,
  );
}
