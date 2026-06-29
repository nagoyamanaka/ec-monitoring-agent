import { LlmAgent } from "@google/adk";

/**
 * 影響評価＋自責他責ルータの専門エージェント（推論のみ・ツール無し）。タスク34。
 *
 * 「今回ぶんの判断」（自責他責・影響範囲・障害規模）を引用付きで算定する。根本原因は再利用できるが
 * 影響は毎回違うので、既知ルートでも算定が要る唯一の判断。出力の fault ラベルが出口
 * （own→Remediation / external・運用→Runbook エスカレーション）の振り分け信号になる（タスク35）。
 *
 * ★証拠相関のルール:
 *  - own      = 直近の commit / terraform 差分と相関する（自社の変更が起点）
 *  - external = 外部API・ベンダー由来で直近の自社変更が無い
 *  - unknown  = 証拠で断定できない（推測で埋めない）
 *
 * ★ハルシネーションガード: 各算定には必ず根拠の citation（証拠ログ・類似事例・commit/terraform 差分の id）
 *   を付ける。citation を出せない場合は impact を省略する（根拠なき影響主張は出さない＝§7.3 と同方針。
 *   citation の無い impact は LLMOutputParser/InvestigationReportMapper のガードで最終的に落とされる）。
 */
export function createImpactTriageAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: "impact_triage",
    model,
    description:
      "障害の影響評価（自責他責・影響範囲・障害規模）を引用付きで算定する専門エージェント。",
    instruction: `あなたは障害の影響評価担当です。与えられた証拠（appLogs / terraformDiff / recentCommits）と
occurrenceCount、根本原因の仮説をもとに、今回の障害ぶんの影響を算定してください。

1. fault（自責他責）を判定する:
   - own: 直近の commit / terraform 差分と相関し、自社コード/IaC の変更が起点と判断できる。
   - external: 外部API・ベンダー由来で、直近の自社変更が見当たらない。
   - unknown: 証拠から断定できない（断定せず unknown を返す。推測で own/external にしない）。
2. scope（影響範囲・1文）と scale（障害規模＝件数/割合/継続時間など・1文）を算定する。
3. affectedSubjects に影響を受けた主体（サービス名・チーム・顧客セグメント）を列挙する。
4. すべての算定に根拠の citation（参照した証拠ログ・類似インシデント・commit/terraform 差分の id）を付ける。
   証拠で裏付けられない項目は出さない。citation を一切出せない場合は影響評価を出さないこと（根拠なき主張は禁止）。

結果は impact = { fault, scope, scale, affectedSubjects, citations } の形でコーディネーターへ返してください。`,
  });
}
