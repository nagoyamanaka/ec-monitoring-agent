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
escalation は「他責/運用案件（impact.fault=external、またはコード/IaC で直せず運用対応が要るもの）」の
エスカレーション草案です。自責（fault=own かつ remediable=true）でコードで直せる場合は escalation を省略し、
suggestedActions に修正方針を書いてください。他責/運用の場合は escalation に引き継ぎ先 team/owner/contact
（与えられた体制情報＝escalationDirectory がある場合はそこから引き、無ければ team を空文字にして宛先不明を明示。
宛先を捏造しない）・reason（なぜそのチーム/運用か・1文）・interimWorkaround（暫定回避手順。過去の resolvedNote を
根拠に）・severityRationale（重大度の根拠・1文）・evidenceBundle（添付すべき証拠/引用の id）を埋めてください。
自責・他責の両方がありうる場合は suggestedActions（修正方針）と escalation（引き継ぎ草案）の両方を出して構いません。
通知送信・チケット起票はしないでください（草案まで＝人間承認の前段）。
remediationReview は「修正PRが起票済みで、その diff を渡された場合」に限り、その PR を読み取り専用でレビューした結果です。
(1)diff が引用根本原因に実際に対応しているか (2)変更ファイルは証拠（commit/terraform 差分・ログ）と整合するか
(3)テストは障害経路をカバーするか を確認し、verdict を pass（対応し整合）/ concerns（要確認の懸念あり）/
reject（根本原因に無関係・誤修正）で返してください。concerns / reject のときは concerns に「なぜ pass でないか」を
具体的に列挙し、判定根拠は citations（diff hunk・変更ファイルパス・テスト名・CI チェック id）で裏付けてください。
レビュー対象 PR が無い（diff を渡されていない＝まだ起票前）場合は remediationReview を省略してください
（自動マージはしません＝verdict を出すだけで承認・マージは人間が行います）。
{
  "summary": "障害の説明（日本語・1〜2文）",
  "confidence": 0.87,
  "severity": "CRITICAL" | "WARNING" | "INFO",
  "investigationSteps": ["調べたこと1", "調べたこと2"],
  "suggestedActions": ["対応アクション1（具体的な修正方針）", "対応アクション2"],
  "suggestedPatternName": "自動昇格候補のパターン名（例: DB_CONNECTION_EXHAUSTION）",
  "remediable": true | false,
  "relatedAlerts": [{ "alertId": "...", "relation": "same_root_cause", "rationale": "関連の根拠（1文）" }],
  "impact": { "fault": "own" | "external" | "unknown", "scope": "影響範囲（1文）", "scale": "障害規模（1文）", "affectedSubjects": ["payment", "..."], "citations": ["証拠/類似事例の id", "..."] },
  "escalation": { "team": "...", "owner": "...", "contact": "...", "reason": "...", "interimWorkaround": "...", "severityRationale": "...", "evidenceBundle": ["証拠/引用の id", "..."] },
  "remediationReview": { "verdict": "pass" | "concerns" | "reject", "concerns": ["懸念点1", "..."], "pullRequestUrl": "...", "citations": ["diff hunk/変更ファイル/テスト名 等", "..."] }
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
