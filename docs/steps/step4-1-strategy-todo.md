# Step 4-1 TODO: 戦略・前提セットアップ

> 対応設計: `docs/steps/step4-1-strategy.md`
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

- [ ] `.github/workflows/app.yml`: lint + test + build
- [ ] Trivy / `npm audit`（pnpm audit）ステップ追加（HIGH以上で検出）
- [ ] 検出結果を `POST /ingest/security-scan` に送る step（`INGEST_TOKEN` ヘッダ）
- [ ] Cloud Run への deploy step（とどける）
- [x] **AIリメディ workflow**: `.github/workflows/ai-remediation.yml`（`repository_dispatch: ai-remediation` 起動）。ブランチ作成→AIエージェント(Gemini CLI/差替可)が実コード修正→trivy再スキャン+UT緑→draft PR→`POST /ingest/remediation-result` callback。backend の dispatch 経路（`REMEDIATION_MODE=dispatch`）から起動される

**設計メモ**: これがシナリオ5（DevOpsループ）の起点。backendの `/ingest/security-scan`（step4-3）完成後に結線。
リメディの「実修正＋UT検証」は API サーバ内ではなく **CI ランナー**で回す（精度はテストゲートで担保・隔離/安全/リソース面）。Gemini は Vertex AI 認証で GCP 無料クレジット内、品質不足なら workflow の1ステップを `claude-code-action` に差し替え。詳細は `step4-3` タスク11。

## タスク 5: GitHub リメディエーション権限 〔P1〕

- [ ] PR起票用 `GITHUB_TOKEN`（対象 `GITHUB_TARGET_REPO` 限定・最小権限）
- [ ] 自動マージは無効（人間承認ゲート）

## タスク 6: Elastic Cloud 登録 〔stretch〕

- [ ] **公式サイトから**登録（GCPマーケットプレイス経由は無料トライアルなし）
- [ ] フェーズ2（`SimilarPatternRule`・Elastic 内包の分類 Rule）着手時のみ。P0/P1完了後

## タスク 7: 意思決定のロック（ADR Step5の種）〔P0・ドキュメント〕

- [ ] a2a不使用 / ADK in-process / category弁別子 / read-write分離 / Cloud Run折衷 を ADR 化（`docs/steps/step5-adr.md`）
  - **a2a不使用の補強（2026-06-23 確定）**: マルチエージェント統合を3パターンに分離して論じる＝①ADK in-process（調査/推論・密結合・関数呼び出し）／②dispatch+callback（実行/修正・疎・タスク委譲）／③A2A facade（外部相互運用・stretch候補・コア外）。①②とも「会話」でなく「タスク委譲/関数呼び出し」なので A2A 不要。トポロジは hub-and-spoke（mesh でない）。詳細は `step4-2` タスク18 コメント＋タスク30
- [ ] 参照: `project-prompt.md` の「Step5で作成するADR」一覧

## タスク 8: 予兆ブリーフィングの意思決定ロック 〔stretchⅡ・ドキュメント〕

> 設計は今固める（安い・物語が跳ねる）。詳細は `step4-1-strategy.md` 7章。
> **実装タスク（旧 step4-2/3/4 の stretchⅡ 予兆タスク）は `docs/steps/step6-final-sprint-todo.md`（F1〜F9）へ集約・7/10 締切で本命1本を実装する方針に格上げ。締切戦略は `docs/steps/step6-final-sprint-strategy.md`。本タスク（ADR種）はここに残す（ADR 一覧＝タスク7・9 と同居のため）。**

- [ ] ADR に追加: 予測を統計MLでなく **LLM推論＋引用検証** で構成する理由（データ依存を切る）
- [ ] ADR に追加: join を自前ルールエンジンでなく **LLM委譲＋3点足場（正規化/引用縛り/引用検証）** にする理由
- [ ] ADR に追加: 突合キーを **(A)テキストjoin → (B)構造化タグ** へ段階移行する理由（本プロジェクトは B 採用）
- [ ] ADR に追加: 予兆を **P0パイプライン無傷の追加レイヤー**（read-onlyの調査の一種）として載せる設計判断
- [ ] ADR に追加: 予兆入力を **`ForecastSignalSource` で源非依存に抽象化**し、stretchⅢ で event-log 源を追加してもハンドラ/ポートをノータッチにする継ぎ目（`step4-1` §7.9）
- [ ] デモシナリオ6（録画前提）の seed 構成を確定（過去2-3件＋ステージ未マージPR＋スケジュール）

## タスク 9: イベントソーシング予知ビューの意思決定ロック 〔stretchⅢ・ドキュメント〕

> 設計・ADR を今固める。実装は **stretchⅡ 着地後＝ハッカソン後**。前倒し実装はしない（薄い／障害寄りの現行 DomainEvent では予兆の母集団が足りずデモ価値が出ない）。詳細は `step4-1-strategy.md` §7.10。

- [ ] ADR に追加: 予知の差別化を **「入力データの質（業務 DomainEvent の粒度）」** に置く理由（OpenTelemetry の汎用インフラ指標は横展開可・ドメインイベントは外部ベンダーが原理的に作れない内製 moat＝ビジネスオブザーバビリティ）
- [ ] ADR に追加: イベントソーシング基盤（全DomainEvent追記＋予知ビュー）を **前倒しせず stretchⅢ に置く**理由（DDIA unbundling は設計とADRで先に示す）
- [ ] ADR に追加: 予測を **相関ベースで止め、因果推論を将来課題（研究フロンティア）** として線引きする理由（相関→因果のロードマップ）
- [ ] スコープ確認: stretchⅢ の前提作業＝ **EC ドメインイベント拡張**（正常系の業務イベントを増やす）の要否・範囲を Step5 で判断
