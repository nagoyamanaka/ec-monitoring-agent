# Step 4-1 TODO: 戦略・前提セットアップ

> 対応設計: `docs/step4-1-strategy.md`
> このスコープは「コードを書く前に固める意思決定・環境」。各タスクに優先度: **P0必須** / **P1差別化** / **stretch**。
> 進める順番: このスコープ → step4-2 → step4-3 → step4-4。

---

## タスク 1: GCP プロジェクト・実行基盤の確保 〔P0〕

- [ ] GCP プロジェクト作成、課金有効化
- [ ] Compute Engine（e2-medium × 1）起動（要件1充足・既存方針）
- [ ] Cloud Run を有効化（「とどける」見せ場用。backoffice or 調査APIを後で載せる）
- [ ] Artifact Registry（コンテナpush先）

**設計メモ**: EDA常駐Subscriber（RabbitMQ）はCEに、ステートレスなAPI/UIはCloud Runに、の折衷を想定（戦略ADR）。

## タスク 2: Gemini API キー取得・疎通 〔P0〕

- [ ] `GEMINI_API_KEY` 発行、`GEMINI_MODEL`（gemini-2.0-flash系）決定
- [ ] `@google/generative-ai` で最小疎通（JSON返却プロンプトの素振り）

## タスク 3: シークレット・環境変数の棚卸し 〔P0〕

- [ ] `.env.example` 更新: `MONGO_URL` / `RABBITMQ_URL` / `GEMINI_API_KEY` / `GEMINI_MODEL` / `GITHUB_TOKEN` / `GITHUB_TARGET_REPO` / `INGEST_TOKEN` / `FEEDBACK_AUTO_PROMOTE_THRESHOLD` / `DEMO_ENABLED`
- [ ] 本番シークレットは Secret Manager（CEから参照）

## タスク 4: CI（GitHub Actions）骨組み 〔P1〕

- [ ] `.github/workflows/ci.yml`: lint + test + build
- [ ] Trivy / `npm audit`（pnpm audit）ステップ追加（HIGH以上で検出）
- [ ] 検出結果を `POST /ingest/security-scan` に送る step（`INGEST_TOKEN` ヘッダ）
- [ ] Cloud Run への deploy step（とどける）

**設計メモ**: これがシナリオ5（DevOpsループ）の起点。backendの `/ingest/security-scan`（step4-3）完成後に結線。

## タスク 5: GitHub リメディエーション権限 〔P1〕

- [ ] PR起票用 `GITHUB_TOKEN`（対象 `GITHUB_TARGET_REPO` 限定・最小権限）
- [ ] 自動マージは無効（人間承認ゲート）

## タスク 6: Elastic Cloud 登録 〔stretch〕

- [ ] **公式サイトから**登録（GCPマーケットプレイス経由は無料トライアルなし）
- [ ] フェーズ2（ElasticAlertClassifier）着手時のみ。P0/P1完了後

## タスク 7: 意思決定のロック（ADR Step5の種）〔P0・ドキュメント〕

- [ ] a2a不使用 / ADK in-process / category弁別子 / read-write分離 / Cloud Run折衷 を ADR 化（`docs/step5-adr.md`）
- [ ] 参照: `project-prompt.md` の「Step5で作成するADR」一覧

## タスク 8: 予兆ブリーフィングの意思決定ロック 〔stretchⅡ・ドキュメント〕

> 設計は今固める（安い・物語が跳ねる）。実装は **P0＋P1＋既存stretch 着地後**の capstone。詳細は `step4-1-strategy.md` 7章。

- [ ] ADR に追加: 予測を統計MLでなく **LLM推論＋引用検証** で構成する理由（データ依存を切る）
- [ ] ADR に追加: join を自前ルールエンジンでなく **LLM委譲＋3点足場（正規化/引用縛り/引用検証）** にする理由
- [ ] ADR に追加: 突合キーを **(A)テキストjoin → (B)構造化タグ** へ段階移行する理由（本プロジェクトは B 採用）
- [ ] ADR に追加: 予兆を **P0パイプライン無傷の追加レイヤー**（read-onlyの調査の一種）として載せる設計判断
- [ ] デモシナリオ6（録画前提）の seed 構成を確定（過去2-3件＋ステージ未マージPR＋スケジュール）
