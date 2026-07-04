import { LlmAgent } from "@google/adk";

/**
 * 相関主張の検証専門エージェント（タスク J2・案A）。**批判役（read-only・推論のみ・ツール無し）**。
 *
 * root_cause_analyst が挙げた relatedAlerts 候補を確定前に検証し、証拠のない因果の橋
 * （例: 他責の決済タイムアウトを同時発生の在庫アラートで内部原因化）を人間到達前に落とす。
 * remediation_planner→remediation_reviewer と同じ「生産者→批判役」ペアを相関に適用する。
 *
 * ★役割分担（J1 と二段）: 案B（J1）＝「citation が収集済み証拠 id に解決するか」を
 *   マッパが機械判定する決定論の歯。本エージェント（案A）＝機械では判定できない
 *   「因果の向きの妥当性」を推論判定する。二段で precision を上げつつ、
 *   実在証拠を指せる正当な相関（recall）は守る。
 * ★write 隔離: verdict を返すだけ。レポートの書き換え・証拠の追加収集はしない。
 */
export function createCorrelationVerifierAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: "correlation_verifier",
    model,
    description:
      "relatedAlerts 候補ごとに「共有証拠を指せるか」「因果の向きが妥当か」を検証し keep/reject を返す批判役エージェント（read-only・推論のみ）。",
    instruction: `あなたは相関主張の検証担当（批判役）です。調査が挙げた relatedAlerts 候補
（関連アラート）を、確定した根本原因・impact.fault（自責/他責）・収集済み証拠と突き合わせ、
候補ごとに keep / reject を判定してください。

判定基準:
(1) 共有証拠: その関連は収集済み証拠の具体的な id（commit sha / terraform リソースアドレス /
    メトリクス名）を「両アラートが共有する証拠」として指せるか。指せない関連は reject。
    時間的に近い・もっともらしい機序を思いつく、だけでは関連にしない（証拠のない因果の橋を
    作らない。citation を出せない関連はシステムの決定論ガードでも破棄される）。
(2) 因果の向き: impact.fault と relation の向きが整合するか。とりわけ外部起因
    （fault=external＝他責。例: 外部決済サービス起因のタイムアウト）の障害を、同時発生した
    内部アラートを upstream（起因）にして内部原因で説明し直す向きは、その内部アラートが
    真因だという直接証拠が無い限り reject（人間なら取らない向きの排除）。
    upstream / downstream / same_root_cause は機序・時系列として妥当な向きかを確認すること。

各候補について { "alertId": "...", "verdict": "keep" | "reject", "reason": "判定理由（1文）" } の
一覧をコーディネーターへ返してください。迷う場合は reject 側に倒すこと（確信度はガードで
別途較正されるため、疑わしい相関を残す利益は無い）。あなたは判定を返すだけで、証拠の追加収集・
レポート本文の書き換え・relatedAlerts の直接編集は行いません。`,
  });
}
