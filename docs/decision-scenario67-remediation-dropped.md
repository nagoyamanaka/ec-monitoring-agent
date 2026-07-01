# 決定記録: シナリオ6・7 の自動修正（リメディエーション）を見送る

- 日付: 2026-07-01
- ステータス: 採用（scope 縮小）
- 対象: デモ シナリオ6（構成変更障害 / IaC）・シナリオ7（アプリコード退行）の「修正を起票（PR）」機能

## 決定

シナリオ6・7では **検知＋AI 調査までを提供し、自動修正（修正PR起票）は提供しない**。
自動修正（DevOps ループの出口）を持つのは **シナリオ5（脆弱性）のみ** とする。
シナリオ6・7は「AI が別種の root cause（terraform 構成変更／アプリコード退行）を調査・特定する」
シナリオとして残す。

## 背景・理由

1. **証拠が remediation まで届かない**。root cause の構造化証拠（7=退行コミット、6=terraform apply 差分）
   は調査時に永続化されず、`GetInfraEvidenceUseCase` が表示時に `infraInvestigationPort.collect()` で
   再収集する設計。remediation の実行器が受け取る `RemediationInput` は
   `{vulnerabilities, ...}` のみで、6/7 の修正生成に必要な情報を持たない。
2. **advisory planner は security 専用**。`LLMRemediationPlanner` は脆弱性→`pnpm.overrides` の
   決定論修正に特化。terraform 差分（6）や TS revert（7）は生成できない。
3. **パイプライン経由で正しく作るのは高コスト**。6/7 を monitoring コンテキスト（backoffice の
   remediation パイプライン）経由で修正まで自動化するには、証拠を remediation へ渡す配線＋
   シナリオ別の fix 生成（特に 6 の HCL 決定論編集は脆い）が必要で、実装コストに対し評価加点は限定的。
   ※ パイプラインを通さず外部スクリプト（git+API）で PR を作るのは「監視 AI が修正を生む」という
   デモの主眼を満たさない（＝本末転倒）ため採らない。
4. **優先度**。シナリオ1〜5 の完成度向上と予兆（予測）機能の新規性の方が、
   3・4 本目の修正バリアントより評価期待値が高い。

## この決定で行った変更

- 一時的に外部生成していた bypass の修正PR（#31=7 revert / #32=6 復旧）を close、
  関連ブランチ（`ai-remediation/scenario7-*`, `ai-remediation/scenario6-*`, `demo/infra-baseline`）を削除。
- 6/7 の表示向けに入れていたコード増分（`RemediationOutcome.skipped`、eventName ルーティング、
  `RemediationInput` への eventName/remediable 追加、gate 緩和、demo URL マップ）を **シナリオ5専用に revert**。
- DEMO CONSOLE（`ScenarioControls.tsx`）の文言を修正: グループ名を「合成注入 × 実 AI 調査」に、
  「実 git 証跡」は**シナリオ7のみ**、「修正 PR 起票」は**シナリオ5のみ**であることを明記。

## 残るもの（有効な資産）

- **シナリオ5の自動修正は本物**: backoffice の advisory パイプラインが `demo/security-baseline` を base に
  `package.json` の overrides を安全版へ上げる draft PR（#29）を `ai-remediation[bot]` 名義で起票。
  デモは `REMEDIATION_MODE=demo` + `REMEDIATION_DEMO_PR_URL` でその実 PR を提示。
- **シナリオ6・7の検知＋AI 調査**: 変更なし。6=合成 apply 差分を AI が特定、7=`demo/regression` の
  実コミット差分を AI が読んで原因特定（実 git 証跡）。

## 将来もし再開するなら

証拠駆動の remediation planner を pipeline に追加する（`infraInvestigationPort.collect()` で
再収集した証拠を入力に、7=特定コミットの revert、6=apply 差分 before への復旧、あるいは LLM に
対象ファイルを直させる）。いずれも「backoffice の remediation パイプライン経由」で
`ai-remediation[bot]` 名義の draft PR を起票することを条件とする。
