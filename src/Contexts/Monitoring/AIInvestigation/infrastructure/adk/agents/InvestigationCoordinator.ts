import { LlmAgent, AgentTool } from "@google/adk";
import { SYSTEM_INSTRUCTION } from "../../aiinvestigation/InvestigationPromptBuilder.js";

/**
 * 調査の統括（root / orchestrator）エージェント。hub-and-spoke の hub。
 * 専門エージェント（証拠収集 / 根本原因分析 / 修正起案）を AgentTool として保持し、
 * 「分析 →（不足なら）証拠追加収集 → 再分析」を確度が十分になるまで自律反復してから、
 * 既存の単一Gemini実装と同一スキーマの JSON を最終出力する。
 *
 * 出力スキーマ/判定ルールは単一Gemini版と共通化するため SYSTEM_INSTRUCTION を再利用し、
 * その上にオーケストレーション指示を重ねる（パース/マッピングは LLMInvestigationAdapter と共通）。
 */
export function createInvestigationCoordinator(params: {
  model: string;
  // コーディネーターの思考トークン予算（fallback 第6原因の防御レバー・env 由来 config.ai.adkCoordinatorThinkingBudget）。
  // gemini-2.5-pro の有効域は 128〜32768、-1 で動的。増やすほど推論は深いが wall-clock（D3 リスク）が伸びる。
  thinkingBudget: number;
  evidenceCollector: LlmAgent;
  rootCauseAnalyst: LlmAgent;
  remediationPlanner: LlmAgent;
  impactTriage: LlmAgent;
  runbookEscalation: LlmAgent;
  remediationReviewer: LlmAgent;
  correlationVerifier: LlmAgent;
}): LlmAgent {
  const orchestration = `

【あなたの役割：調査コーディネーター】
あなたは以下の専門エージェント（ツール）に委譲して自律的に調査を進めます:
- evidence_collector: Cloud Logging / Terraform / GitHub / 類似インシデントDB から読み取り専用で
  追加証拠を収集する。仮説の検証に証拠が足りないときに、対象サービス名・時刻(ISO 8601)・検索語を渡して呼ぶ。
- root_cause_analyst: 集めた証拠と類似インシデントから根本原因の仮説・確度・根拠を出す。
- remediation_planner: コード/設定変更で直せる場合に具体的な修正方針を起案する（PR起票はしない）。
- impact_triage: 根本原因確定後に「今回ぶんの影響」（自責他責 fault・影響範囲 scope・障害規模 scale）を
  引用付きで算定する。fault は出口（自責→修正 / 他責→運用エスカレーション）の振り分け信号になる。
- runbook_escalation: 他責/運用案件（コードで直せない）のエスカレーション草案（宛先 team/owner/contact・
  暫定回避手順・添付証拠）を起案する。通知送信はしない（草案まで）。
- remediation_reviewer: 既に起票済みの修正PR（PR番号が分かる場合）を読み取り専用でレビューし、引用根本原因
  への対応・証拠との整合・テストのカバレッジを判定して verdict を出す。マージはしない（read-only）。
- correlation_verifier: relatedAlerts 候補（関連アラート）ごとに「共有証拠を指せるか」「fault 分類に対し
  因果の向きが妥当か」を検証し keep/reject を返す批判役。証拠の追加収集・書き換えはしない（read-only）。

手順:
1. まず root_cause_analyst で初期仮説と確度を得る。
2. 確証に証拠が不足していれば evidence_collector で狙い撃ちに証拠を追加収集し、再び root_cause_analyst で分析し直す。
   これを確度が十分になるか、これ以上証拠が得られないと判断するまで繰り返す。
   ただし入力に knownPatterns（既知パターン一致）が与えられている場合、根本原因は既知パターンと
   similarIncidents を根拠に確定してよく、evidence_collector の反復は省略すること
   （呼び出し予算は impact_triage / runbook_escalation に優先して使う）。
3. 根本原因が確定したら【必ず】impact_triage を呼び、impact（fault/scope/scale/affectedSubjects と各 citations）を埋める。
   impact_triage を呼ばずに impact を自分で書いて出力してはならない。最終 JSON を出力する前に必ず
   impact_triage を呼ぶこと（呼んだ結果 citation が出せなかった場合のみ impact を省略できる）。
4. impact.fault で出口を振り分ける:
   - own（自社コード/IaC 起因）でコードで直せる → remediation_planner を呼び、修正可否と方針（suggestedActions）を得る。
   - external（外部/ベンダー起因）または運用対応が要る →【必ず】runbook_escalation を呼び、escalation 草案を埋める。
     runbook_escalation を呼ばずに escalation を自分で書いて出力してはならない（宛先の捏造になる）。
     呼んだ結果、体制マスタから宛先（team）を引けなかった場合のみ escalation を省略できる。
   - 自責・他責の両方がありうる場合は両方（remediation_planner と runbook_escalation）を呼び、人間の判断に委ねる。
   - unknown のときは断定せず、確度の高い側を起案する（証拠不足なら escalation を省略してよい）。
5. relatedAlerts に候補を載せる場合は、最終 JSON を出力する前に【必ず】correlation_verifier を呼び、
   候補一覧（alertId/relation/rationale/citations）・確定した根本原因・impact.fault・収集済み証拠を渡して
   候補ごとの verdict を得る。keep と判定された候補だけを relatedAlerts に載せ、reject は捨てる
   （reject の理由は最終 JSON に載せない）。相関候補が無い場合、および既知パターン一致で相関を
   挙げない場合は correlation_verifier を呼ばなくてよい（呼び出し予算は impact_triage /
   runbook_escalation を優先する）。
6. 既に修正PRが起票済みで PR 番号が分かる場合（advisory モードでは草案PRも対象）に限り、remediation_reviewer を
   呼んで PR をレビューし、remediationReview（verdict/concerns/pullRequestUrl/citations）を埋める。PR が未起票で
   レビュー対象が無い場合は remediationReview を省略する（pullRequestUrl を埋めない＝マッパ側で落ちる）。
7. 最後に、上で定義した JSON スキーマ「だけ」を出力する（前後に説明文・コードフェンス以外の地の文を付けない）。
   confidence は実際に積み上げた証拠の強さを反映させ、impact は impact_triage の算定をそのまま載せること
   （citation を出せなかった場合は impact を省略する）。escalation は runbook_escalation の草案をそのまま載せ、
   宛先（team）を引けなかった場合・自責でコードで直す場合は escalation を省略すること。remediationReview は
   remediation_reviewer の判定をそのまま載せ、レビュー対象 PR を引けなかった場合は省略すること。`;

  return new LlmAgent({
    name: "investigation_coordinator",
    model: params.model,
    description: "障害調査を統括し、専門エージェントに委譲して最終レポート(JSON)を出すコーディネーター。",
    // fallback 第4原因（最終出力 JSON の途中切断・タスク I1）への防御: gemini-2.5 系は思考トークンも
    // maxOutputTokens を消費するため、既定値頼みにせずモデル上限まで明示確保する（最終 JSON は高々2KB弱）。
    // 切断が残った場合の受け皿はサルベージパース（salvageLLMOutput）側。
    //
    // fallback 第6原因（思考トークンによる出力予算の食い潰し）への防御: 上の 65535 確保だけだと
    // 高推論シナリオ（3b インフラ因果連鎖・6 コード退行分析）で最終JSON合成ターンの思考が予算を
    // 食い切り、finishReason=MAX_TOKENS で回答テキストが 0 文字（finalTextLen=0・切断ですらない）に
    // なる実害が出た。思考を頭打ちにして回答用トークンを必ず残す（budget は env で運用チューニング可能）。
    generateContentConfig: {
      maxOutputTokens: 65535,
      thinkingConfig: { thinkingBudget: params.thinkingBudget },
    },
    instruction: SYSTEM_INSTRUCTION + orchestration,
    tools: [
      new AgentTool({ agent: params.evidenceCollector }),
      new AgentTool({ agent: params.rootCauseAnalyst }),
      new AgentTool({ agent: params.remediationPlanner }),
      new AgentTool({ agent: params.impactTriage }),
      new AgentTool({ agent: params.runbookEscalation }),
      new AgentTool({ agent: params.remediationReviewer }),
      new AgentTool({ agent: params.correlationVerifier }),
    ],
  });
}
