# Step 4-1: 戦略設計（なぜ作るか・差別化・スコープ・優先度）

> **Step4 を4分割したうちの「戦略設計」担当。最初に読む。**
> 技術詳細は下記を参照。本書は「何を・なぜ・どの順で・どこまで」を決める。
>
> | 順  | スコープ            | 設計ドキュメント                      | TODO                                       |
> | --- | ------------------- | ------------------------------------- | ------------------------------------------ |
> | 1   | 戦略設計            | `docs/step4-1-strategy.md`（本書）    | `docs/step4-1-strategy-todo.md`            |
> | 2   | context/Monitoring  | `docs/step4-2-monitoring-context.md`  | `docs/step4-2-monitoring-context-todo.md`  |
> | 3   | backoffice/backend  | `docs/step4-3-backoffice-backend.md`  | `docs/step4-3-backoffice-backend-todo.md`  |
> | 4   | backoffice/frontend | `docs/step4-4-backoffice-frontend.md` | `docs/step4-4-backoffice-frontend-todo.md` |

---

## 1. プロダクトの一言

**既存の観測SaaS（Datadog等）の "検知" の上に乗り、アラート発火後の「調査 → 評価 → レビュー」という人手のワークフローを圧縮するAI調査エージェント。**

分類ツールではなく、複数ソース（Cloud Logging / Terraform差分 / GitHub）を**自律的に横断して証拠を積み上げ、根拠付きで原因を推定し、人間がレビュー・承認する**——この一連を1ループで体現する。

---

## 2. 差別化（なぜSaaSと競合しないか）

| レイヤー              | 既存SaaS（Datadog/NewRelic/Splunk）          | 本プロダクト                                       |
| --------------------- | -------------------------------------------- | -------------------------------------------------- |
| 検知（detection）     | **支配領域**。メトリクス・ログ集約・異常検知 | やらない（彼らの上に乗る）                         |
| 調査（investigation） | 一部AI補助（Watchdog/Bits AI）               | **主戦場**。複数ソース横断の証拠収集を自律化       |
| 評価（evaluation）    | 手作業                                       | 類似インシデント照合＋AI原因推定（confidence付き） |
| レビュー（review）    | 手作業（ポストモーテム）                     | reviewStatus（承認/却下）＋修正PR起票まで          |

**Elasticのシナジー**: 運用履歴へのRAG。証拠が太る（logs + terraform diff + git）ほど類似検索の精度が上がり、ハルシネーションでなく**引用付きの仮説**が出る。

**設計の肝**: 「証拠収集（read-only）→ 事例照合（Elastic）→ AI推定（Gemini/ADK）→ 人間レビュー（＋修正PR）」の多層パイプライン。各層は別レイヤーでトレードオフでなくシナジー。

### 学習ループ：確度付き分類と知識の結晶化（差別化の中核）

既存SaaSは「**同じ障害が再発しても毎回ゼロから調べ直す**」。本プロダクトは **運用での確認を蓄積し、次に似た障害が来たら“確度付き”で先回りする**。肝は、学習が **0/1（未知→既知）の離散フリップではなく、確度の連続スペクトル**で進むこと。混同しやすいので**2段に分けて**捉える。

**① 連続的な確度（分類の確度・読み取り）＝学習の本体**

- 正解フィードバックは毎回 `SimilarIncident` として蓄積される（確度の母集団が太る）。
- 将来 `SimilarPatternRule`（kind=`SIMILARITY`・Elastic hybrid search）がそれを読み、**完全一致でなくても「過去のDB枯渇に82%類似・確度 中」のような graded confidence で分類**する。
- `ClassificationConfidence`（0〜1・`isHighConfidence()`）で low/中/high バンドを表現。**この確度をレポートに出すこと自体が意思決定支援**＝「未知です」より圧倒的に価値が高い（差別化テーブルの「評価（confidence付き）」の実体）。

**② 離散的な結晶化（昇格・書き込み）＝高速パスの最適化**

- 何度も確認され頻出が確定したものだけを `KnownErrorPattern`（完全一致・confidence 1.0）に**焼き付ける**。
- 効果は**速度と決定性**（Elastic を介さず1秒で既知分類＝デモシナリオ3）。学習の質そのものは ① が担い、② はそのキャッシュ化。

**昇格（②）の2トリガー**（＝結晶化を誰が起こすか）:

| 観点 | 自動（`SubmitFeedback`）                       | 手動（`PromotePattern`）             |
| ---- | ---------------------------------------------- | ------------------------------------ |
| 起点 | 確認回数・確度がしきい値到達                   | 人間が「確実」と判断                 |
| 値   | 統計的合意による焼き付け（早とちりを防ぐゲート） | 即時・人間のオーバーライド           |

> **正直な現状と弱点**: 今は分類が exact-match のみ＝**0/1 で粗い**。① の本体（`SimilarPatternRule`）は未実装で、`SimilarIncident` はまだ AI 調査の文脈強化にしか使われていない。これを分類段階へ引き込むのが **`step4-2` タスク17**（＝graded confidence の本体）。② の昇格ゲートを「回数固定 → 類似確度を取り込んだ加重」にするのが **タスク24/25**。confidence の出処が増えても `classification.confidence` / UI は不変（世代互換設計）。

> **発表の一言**: デモシナリオ3「次回1秒で既知」は ②（結晶化）の効果。だが**学習の連続性・確度付き意思決定支援は ①（`SimilarIncident` 蓄積 → 類似分類）が生む**。昇格は「学習」ではなく「よく確認された知識を安価な高速パスに焼き付ける最適化」と捉えるのが正確。

---

## 3. ハッカソン審査基準への対応

| 審査基準                              | 本プロダクトの当て方                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1. AIエージェントが価値の中心／自律性 | **自律的な証拠追加収集ループ**（analystが次に取る証拠を自分で判断）＋ADKマルチエージェント。"必然性" の核 |
| 2. 課題へのアプローチ・ストーリー     | AI-SRE（調査→レビュー圧縮）。旬で一貫性のある物語                                                         |
| 3. ユーザビリティ                     | バックオフィスで「証拠が積み上がる過程」を可視化。承認ボタン1つ                                           |
| 4. 実用性・体験価値                   | MTTR短縮の実感。CI連携でPR起票まで自動                                                                    |
| 5. 実装力                             | DDD/Clean/CQRS/EDA＋ポート段階移行。GCP（Gemini/ADK/Cloud Run）＋Elastic活用                              |

> 「つくる（調査エージェント）・まわす（GitHub Actions/CI）・とどける（Cloud Runデプロイ）」を**シナリオ5で1ループに**収める。

---

## 4. 重要な技術方針の決定

### a2a は使わない

- マルチエージェント分割（並列専門調査・自律ループ）は **ADKのin-processサブエージェントで実現でき、a2aは不要**。
- a2aは「異ベンダー/別ランタイム相互運用」専用（例: Elastic Agent Builder ↔ Gemini Enterprise）。本構成では境界をまたがないので使わない。
- 「トークン最適化」は*分割*の効果であってa2aの効果ではない。

### マルチエージェントは ADK in-process

- `AIInvestigationPort` の裏に Coordinator + 専門agent（Evidence/RootCause/Remediation）を1プロセスで構成。詳細は `step4-2`。
- フェーズ0（単一Gemini）で提出可能状態を確保 → ポート差し替えでADK版を載せる。

### category 弁別子

- `MonitoringEvent.category`（APPLICATION/INFRASTRUCTURE/CAPACITY/SECURITY）をサブクラスでなく弁別子フィールドで持つ。
- 「どの調査担当に振るか」のディスパッチキー。a2aの有無に依存しない前方互換。

### 調査(read) と リメディエーション(write) の分離

- 調査Gateway（CloudLogging/Terraform/GitHub）は読み取り専用。
- write操作はPR起票のみで `RemediationPort` に隔離。自動マージしない。
- 「AIが調査・人間が承認」を構造で体現。

### デプロイ：Cloud Run（見せ場）＋ Compute Engine

- 「とどける」の見せ場は Cloud Run に載せる。
- EDA（RabbitMQ常駐Subscriber）はステートレスなCloud Runと相性が悪い → 全部は載せない。**少なくともbackoffice（or 調査API）をCloud Run実機**にして物語を取る。トレードオフはADR化。

---

## 5. インシデントのスコープと優先度（7/10締切）

> 種類を増やして見せる発想は捨てる。**深さ優先**。a2a/Elastic/カテゴリの価値はインシデント種別と直交するので、新カテゴリをむやみに増やさない。

| 優先             | インシデント                  | category       | 根拠                                                                     |
| ---------------- | ----------------------------- | -------------- | ------------------------------------------------------------------------ |
| **必須（確定）** | Payment Timeout               | APPLICATION    | **コードに実在するDomainEvent**。追加工数ゼロ                            |
| **必須（確定）** | Inventory Reservation Failed  | APPLICATION    | 同上。EDA→Monitoring→AI調査→SSEのE2Eを最小コストで通す                   |
| **差別化の本丸** | IaC/設定変更起因（シナリオ4） | INFRASTRUCTURE | Cloud Logging+Terraform+GitHubの横断証拠収集を駆動できる唯一の種別       |
| **DevOps半分**   | CI/Trivy 脆弱性（シナリオ5）  | SECURITY       | CI/CDを装飾でなく機能させる。PR起票＝自律write。ソロでもDevOps物語が立つ |
| ストレッチ       | Traffic Spike                 | CAPACITY       | 新イベントソースの配管が要る。Phase0+1が早く終わった時だけ               |
| やらない         | DB / K8s 障害                 | -              | 再現コスト高、デモ価値に対し割が合わない                                 |

---

## 6. スコープ単位の進め方（スケジュールでなくスコープで一気に）

フェーズ（時間軸）でなく**スコープ単位**で一気にやる方針。各スコープのTODO内でタスクを依存順に並べ、各タスクに優先度タグ（**P0必須** / **P1差別化** / **stretch**）を付ける。

```
進める順番（ファイル番号順）:
  1. step4-1-strategy        ← 本書。前提セットアップ・意思決定（step4-1-strategy-todo）
  2. step4-2-monitoring-context ← Monitoringコンテキスト本体（最重要・最大）
  3. step4-3-backoffice-backend ← Express配線・SSE・ingest
  4. step4-4-backoffice-frontend ← UI（証拠パネル・承認・SSE）
```

> 各スコープ内で「P0だけ先に全部 → P1 → stretch」と進めれば、途中で止まっても**常に提出可能な状態**を保てる。

---

## 7. 予兆ブリーフィング（stretchⅡ・reactive → proactive）

> **位置づけ**: P0 ＋ P1 ＋ 既存stretch（ADK in-process）が**全部着地した後**にのみ着手する capstone。設計は本書で今固め、実装は最後。間に合わなければ設計書とADRで語る。

> **2段階の予知（stretchⅡ→Ⅲ）**: 「予知」には粒度の違う2段がある。**stretchⅡ＝既知の未来シグナル × 蓄積記憶の LLM 突合**（本章の主題）、**stretchⅢ＝ログベース・イベントソーシング基盤の上に立つ予知ビュー**（§7.10）。Ⅱは小さく見せられ、Ⅲは moat を構造として獲得する。**Ⅱを Ⅲ の足掛かりになる形（§7.9 の `ForecastSignalSource` 継ぎ目）で作れば、Ⅱ→Ⅲ は再設計でなく「源を1個足す」追加**になる。だから**最初からイベントソーシングに倒さない**（薄い／障害寄りの現行 DomainEvent では予兆の母集団が足りずデモ価値が出ない）。
>
> **データソースの正確な理解**: 現行（Ⅱ）の予兆入力は2系統で、**どちらも event log ではない**。①記憶（過去インシデント＝SimilarIncident / KnownErrorPattern）は Mongo の**状態スナップショット**（障害専用ストア）、②未来シグナル（未マージPR / pending plan / schedule）は forecast 実行時に read-only API を叩く**揮発的ライブread**で保存しない。イベントソーシング（全イベントを追記ログに貯める）は**この Mongo の移行ではなく新基盤の追加**であり、stretchⅢ の主題（§7.10）。

### 7.1 何をする機能か

既存はすべて**反応的**（インシデントが因果的に発生してから調査・評価・レビュー）。予兆ブリーフィングは**予防的**——「**既に分かっている未来シグナル**（未マージPR・未適用Terraform plan・業務/負荷スケジュール）」と「**蓄積した記憶**（SimilarIncident / KnownErrorPattern）」をエージェントが突き合わせ、**根拠（引用）付きのリスク予報**を出す。

```
[未来シグナル]                          [記憶＝既存資産]
 ├ GitHub open PR（未マージ）             ├ SimilarIncident（過去事例）
 ├ Terraform pending plan（未適用）        └ KnownErrorPattern
 └ Schedule（週末セール→負荷x5）                ↓ エージェントが突合・推論
   → 「土20:00、DB接続枯渇 HIGH（confidence 0.78）
       根拠: PR#123のpool縮小 × 過去同型3件 × セール負荷」
```

### 7.2 なぜ差別化として強いか（既存への上乗せ価値）

- **既存投資の伏線回収**: P1（InfraEvidence Gateway群）と P0（SimilarIncident記憶）を**再利用**するだけで成立。先行投資が「目的的」に見える構造。
- **差別化軸が直交**: 既存stretch（ADK）は「どれだけ高度に作ったか」、予兆は「どんな独自価値か」。審査基準（自律性・必然性・体験）への効きは **予兆 > ADK**。
- **統計MLでない**: フォージャストはレッドオーシャン＆データ大量要。本機能は **LLMによる"既知シグナルの突合推論"** なのでデモ規模でも成立する（→ ADR）。
- **設計だけでも効く**: 「P0パイプラインを一切触らず、read-only Gateway＋記憶の再利用で予報能力を**追加的に**載せられる」＝アーキテクチャ拡張性の証明。

### 7.3 統合の難所は"自前で解かない"（3点の足場＋LLM委譲）

突合（join）はルールエンジンで解くとブリットルで終わらない。**joinはGeminiに委譲**し、人間側は3点だけ用意する：

1. **正規化**: 全シグナルを共通の突合軸 `subject`（対象コンポーネント）＋ `when`（時間窓）＋ `desc` に揃える（`ForecastSignal`）。
2. **引用縛り**: 出力JSONで各リスクに「使ったシグナルidの `citations`」を**必須**にする（空は不正）。
3. **引用検証**: Handler側で `citations` のidが収集済みシグナルに**実在するか照合**し、実在しない引用のリスクは落とす/フラグ（ハルシネーション・ガード、数十行）。

→ what/when/how の推論はモデルがやる。人間は「joinできる形に整える・引用を強制する・引用の実在を検証する」だけ。

### 7.4 段階設計（A→B移行の物語をそのまま採用）

突合キーをどこまで構造化するかが唯一の判断点。**本プロジェクトは (B) を採る**（将来移行込み・時間があれば実装）。

| 段階            | 突合方式                                                                                        | 既存データ構造への影響                                                                  | 精度                 |
| --------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------- |
| (A)             | 既存 `InvestigationReport`/`InfraEvidence` を**テキストのまま**contextに流しLLMに意味joinさせる | 変更ゼロ                                                                                | ブレやすい           |
| **(B)（採用）** | 過去インシデントに **`subject`/`component` 構造化タグ**を持たせて突合                           | `InvestigationReport` に optional `subject` 追記 **or** `ForecastMemory` projection新設 | 安定・引用検証が効く |

> 「最初テキストjoin(A)で動かし、精度のために部品タグ(B)を構造化した」という**進化自体がADRになる**。

> **注意（A/B の取り違え防止）**: ここでの (A)/(B) は「**突合キーの構造化度**」の段階であって、§7（stretchⅡ）/§7.10（stretchⅢ）の**入力源の段階とは別軸**。本プロジェクトは stretchⅡ の中で突合キー (B) を採る。stretchⅢ は「入力源に event log を足す」話で、突合キー (B) はそのまま流用する。

### 7.5 データ構造への影響範囲（既存P0は無傷）

| 階層             | 内容                                                                                          | 既存step4項目                  |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------ |
| ① 完全新規型     | `RiskForecast`（集約/read-model）/ `ForecastSignal` / `Schedule`・`ScheduleSource`            | 追加のみ（既存無傷）           |
| ② 既存への追記   | `GitHubGateway.listOpenPullRequests()` / `TerraformGateway.getPendingPlan()`（read-only維持） | メソッド追加                   |
| ③ 記憶の突合キー | (B採用)`InvestigationReport` に optional `subject` **or** `ForecastMemory` projection         | optional追記 or 新規projection |

> **ランタイムの反応的パイプライン（AnalyzeAlert/InvestigateAlert）は無傷**。予兆は新規 `ForecastRiskCommandHandler` として横に生やす（write無し＝read-onlyの調査の一種）。

### 7.6 デモ方針（録画前提）

- ハッカソンはデモ動画提出が通る。**ライブ安定動作のコストは不要**。「実際に動いた1回を録る」（捏造はNG）。
- seed: 過去インシデント2〜3件＋ステージした未マージPR＋スケジュール。`/forecast` 起動でライブ生成 → 引用付きリスクをデモシナリオ6として収録。

### 7.7 見積もり（P1完了を前提とした増分・(B)採用）

| 工程                                                                         | 工数           |
| ---------------------------------------------------------------------------- | -------------- |
| シグナル正規化（既存Gateway結果に subject/when ラベル付け＋②のメソッド追加） | 1d             |
| ForecastMemory projection＋ `subject` タグ付け（③・B採用分）                 | 0.5〜1d        |
| Forecast context builder＋引用縛りプロンプト＋JSONスキーマ＋**引用検証**     | 1d             |
| API（POST/GET /forecast）＋最小表示（既存UI相乗り可）                        | 0.5d           |
| seed＋いい1テイク録る                                                        | 0.5d           |
| **合計（B採用・録画前提）**                                                  | **≈ 3.5〜4日** |

### 7.8 ADR種（Step5）

- 予測を統計MLでなく **LLM推論＋引用検証** で構成する理由（データ依存を切る判断・デモ規模での成立）
- joinを自前ルールエンジンでなく **LLMに委譲し、人間は正規化／引用縛り／引用検証の3点足場に限定**する理由
- 突合キーを **(A)テキストjoin → (B)構造化タグ** へ段階移行する理由（精度と既存無傷のトレードオフ）
- 予兆能力を **P0パイプライン無傷の追加レイヤー**（read-onlyの調査の一種）として載せる設計判断

---

## 7.9 stretchⅡ→Ⅲ の継ぎ目（`ForecastSignalSource`）

stretchⅡ を「捨て駒」にしないための**唯一の設計制約**。これさえ守れば Ⅱ→Ⅲ は再設計でなく追加で済む。

- **`ForecastSignalSource`（domain interface）を切り、`ForecastRiskCommandHandler` は3つの Gateway を名指しで呼ばず `ForecastSignalSource[]` を回す**。
  - stretchⅡ の実装＝ `PullRequestSignalSource`（GitHub `listOpenPullRequests`）/ `PendingPlanSignalSource`（Terraform `getPendingPlan`）/ `ScheduleSignalSource`（`ScheduleSource.list`）の3つ。
  - **stretchⅢ ＝ `EventLogPrecursorSource implements ForecastSignalSource` を1個足すだけ**（§7.10）。Handler も `ForecastPort` も引用検証もノータッチ。
- `ForecastSignal`（id/kind/subject/when/desc/source）は**源非依存の正規化型**に保つ（既に §7.5 で採用済み）。源が増えても突合機構は不変。
- `ForecastMemory` は **projection のまま**にする。Ⅱでは上流が Mongo(Resolved)、Ⅲではそれを event log に差し替えるだけで、`findBySubjects()` 呼び出し側は不変（projection は再構築可能であるべき、という原則どおり）。
- 記憶（MEMORY）シグナルは他シグナルの `subject` から引くため `ForecastSignalSource[]` の反復とは別ステップ（subject 抽出 → `findBySubjects`）に置く。源を足す継ぎ目はあくまで主シグナル側。

> コストはほぼゼロ（DI で配列を渡すだけ）なのに Ⅲ の手戻りを消せる。これが「stretchⅡ で Ⅲ の足掛かりを作る」の具体物。

## 7.10 stretchⅢ：ログベース・イベントソーシングと予知ビュー（DDIA unbundling）

> **位置づけ**: stretchⅡ 着地後の発展。**実装はハッカソン後**。本節は設計と ADR を今固めるためのもの（「予知ができる」でなく「**予知ができる設計になっている**」を構造で示す）。

### 何が変わるか（入力データの質）

stretchⅡ の予兆は「既知の未来シグナル × 過去インシデント記憶」までしか見ない。stretchⅢ は **DDIA の "データベースの解体（unbundling）"** に沿って、**全 DomainEvent（正常系の業務イベントを含む）を追記専用の event log に貯め**、そこから2つの read view を派生させる。

```
各種 DomainEvent（障害だけでない・EC業務イベント / Security / infra）
        ↓ すべてイベントとして
   EventLog 基盤（一次資料・追記のみ）  ← DDIA: unbundled, log-centric
        ↓
   ├─→ [調査ビュー] 障害周辺の証拠を引く（＝既存パイプライン・AnalyzeAlert/InvestigateAlert）
   └─→ [予知ビュー] 直近イベント列から予兆シグナルを抽出（EventLogPrecursorSource）
        ↓ 予兆ビューの出力も ForecastSignal に正規化 → 既存の Forecast 突合へ合流
   相関ベースの予兆（このイベント列の後に障害が頻発する）→ 引用付きリスク予報
```

### 設計原則

- **統計ML ではなく LLM 推論**を維持（stretchⅡ と同じ機構）。event log の直近イベント列を LLM の**追加 context** として渡すだけ＝「相関の検出」。**因果推論は研究フロンティア**として ADR に切り出す（相関→因果のロードマップ）。
- **予知の差別化は「予知機構」でなく「入力データの質」**。OpenTelemetry 標準のインフラ指標（CPU/レイテンシ/トレース）は汎用ベンダーが横展開できるが、**DDD の集約粒度の業務 DomainEvent は会社ごとに異なり外部ベンダーが原理的に作れない**＝内製の moat（ビジネスオブザーバビリティ）。
- **留意点（moat の前提）**: この主張は DomainEvent が実際に業務的意味を持つ場合のみ成立する。現行は4イベント・半分が障害寄り＝薄い。よって **EC ドメインイベントの拡張（正常系の業務イベントを増やす）が stretchⅢ の前提作業**（`Step6-ES-a`）。

### スコープ（前倒ししない理由つき）

| 作業 | 内容 | なぜ Ⅲ（前倒し不可） |
| ---- | ---- | -------------------- |
| EC ドメインイベント拡張 | 正常系業務イベントを増やし予兆の母集団を太らせる | 薄い母集団では予兆が出ずデモ価値ゼロ |
| EventLog 追記 sink | 全 DomainEvent を append-only に蓄積（障害専用でない一次資料） | 消費側（予知ビュー）が揃うまで貯めても使い道がない |
| ForecastMemory 上流差し替え | Mongo(Resolved) → event log（consumer はノータッチ） | projection の上流変更。Ⅱの継ぎ目（§7.9）があれば追加作業 |
| EventLogPrecursorSource | 直近イベント列→予兆 ForecastSignal（新 kind `PRECURSOR`） | §7.9 の継ぎ目に源を1個足す |

### ADR種（Step5・追加）

- 予知の差別化を「入力データの質（業務 DomainEvent 粒度）」に置く理由（汎用ベンダーが作れない内製 moat）
- イベントソーシング基盤を前倒しせず stretchⅢ に置く理由（薄い母集団・デモ価値・DDIA は設計とADRで先に示す）
- `ForecastSignalSource` でⅡ→Ⅲを追加接続にする継ぎ目設計
- 相関ベースで止め因果推論を将来課題（研究フロンティア）として線引きする理由

---

## 8. フロー全体図（発表資料用）

> **位置づけ**: ハッカソン発表・説明資料用のシーケンスと工程表。  
> ランタイムの全フローを「イベント受信 → 分類 → 診断 → フィードバック昇格」の1ループで示す。

---

### 8.1 全体フロー（テキスト図）

ランタイムは **自動フェーズ（イベント駆動）** と **人間フェーズ（オペレーター操作駆動）** の2段で構成される。前半は障害発生をトリガーに「分類 → 診断（AI調査）」まで自律で走り、後半は人間がAI結果を評価・承認して「既知の知識」へ還元する（学習ループ）。

- **自動フェーズの起点** = 障害イベントの発生（EC DomainEvent）。人手は介在しない。
- **人間フェーズの起点** = オペレーターの UI 操作（フィードバック送信 / Promote ボタン）。

```
【自動フェーズ：イベント駆動】  起点 = 障害イベントの発生
══════════════════════════════════════════════════════════════
  EC Backend で障害発生
    │  EC DomainEvent（例: ec.payment.timeout）を RabbitMQ に publish
    ▼
  CollectMonitoringEventSubscriber        ［源固有の型に触れる唯一の境界］
    │  EC DomainEvent → MonitoringEvent へ正規化
    ▼
  AnalyzeAlertUseCase                       （CommandBus 経由）
    │  AlertClassifier.classify(monitoringEvent)
    │
    ├─【既知＝完全一致】──────────────────┐
    │   Alert.createFromKnownPattern()     │
    │   AlertRepository.save() [OPEN]      │
    │   SSEAlertNotifier.notify()          │
    │   ◇ ここで終了（AI調査しない）       │
    │                                      │
    └─【未知】                             │
        Alert.createAsUnknown() [ANALYZING]│
        AlertRepository.save()             │
        SSEAlertNotifier.notify()          │
        EventBus.publish(                  │
          InvestigateAlertDomainEvent)     │
            │  EventBus 経由・非同期       │
            ▼                              │
      InvestigateAlertOnAlertClassifiedUnknown（DomainEventSubscriber）
            │  薄い変換 → 委譲            │
            ▼                              │
      InvestigateAlertUseCase              │
        SimilarIncident.findSimilar()      │ ← 過去事例で文脈強化
        (InfraInvestigationPort.collect)   │ ← P1: Cloud Logging/Terraform/GitHub
        AIInvestigationPort.investigate()  │ ← Gemini で原因推定
        alert.attachInvestigationReport()  │
        AlertRepository.save() [OPEN]      │
        SSEAlertNotifier.notify()          │
            │                              │
            ▼                              ▼
  ┌──────────────────────────────────────────────────────────┐
  │ バックオフィス UI に Alert ＋（あれば）調査レポートを表示 │
  └──────────────────────────────────────────────────────────┘
            │
            │   ★ここから先は「人間の判断」が起点★
            ▼
【人間フェーズ：オペレーター操作駆動】  起点 = UI 操作
══════════════════════════════════════════════════════════════
        ┌────────────────────────┴────────────────────────┐
   (A) AI調査結果の正誤を評価              (B) パターンを即時確定
   PATCH /alerts/:id/feedback           POST /patterns/:id/promote
        │                                         │
        ▼                                         ▼
   SubmitFeedbackUseCase                   PromotePatternUseCase
        │ alert.submitFeedback()                 │ findById(patternId)
        │ AlertRepository.save()                 │ pattern.promote()
        │ （reviewStatus=APPROVED/REJECTED）     │ save(isPromoted=true)
        │                                        ▼
        │【isCorrect=true のとき】           手動昇格 完了
        │  SimilarIncident.index()
        │   （解決事例として蓄積→次回のAI調査を強化）
        │
        │  correctFeedbackCount >= AUTO_PROMOTE_THRESHOLD(=3)
        │  かつ unknown ＋ investigationReport 有
        │   → KnownErrorPattern.create().promote() を save
        │     （★自動昇格）
        └──────────────────────────────────┐
                                            ▼
                              KnownErrorPattern が増える
                                            │
                                            ▼
              次回の同型障害は AnalyzeAlert が即 known 分類
              （AI調査をスキップ＝デモシナリオ3「次回は1秒で既知」）
              ＝ 学習ループが閉じる（reactive → 既知化）
```

> **2つの昇格経路**: `SubmitFeedback`＝正解の積み上げによる **自動学習**、`PromotePattern`＝オペレーター判断による **即時学習**。どちらも出口は同じ `KnownErrorPattern`（次回分類の高速化）。

**短絡設計のポイント**

`AnalyzeAlertUseCase` が完全一致（`eventName` + `payloadConditions`）を先に試し、一致した場合は Alert を保存・SSE 通知して **そこで終了する**（`InvestigateAlertDomainEvent` を発行しない）。`InvestigateAlertUseCase` には **未知アラートのみ**が到達するため、類似インシデント検索 → AI 調査から即座に始まる。

下図は分岐の流れ（左が既知＝短絡終了、右が未知＝AI調査へ）。

```
                     MonitoringEvent 受信
                             │
                             ▼
        ┌────────────────────────────────────────────┐
        │ AnalyzeAlertUseCase.run()                   │
        │   AlertClassifier.classify(monitoringEvent) │
        │   └ KnownPatternRule（eventName+payload 完全一致）│
        └────────────────────────────────────────────┘
                             │
            matched: true    │    matched: false
         ┌───────────────────┴────────────────────┐
         ▼【既知＝完全一致】                        ▼【未知】
  Alert.createFromKnownPattern()           Alert.createAsUnknown()
         │                                        │
  AlertRepository.save()                   AlertRepository.save()
         │                                        │
  SSEAlertNotifier.notify() [OPEN]         SSEAlertNotifier.notify() [ANALYZING]
         │                                        │
  ◇ ここで終了                              EventBus.publish(
    DomainEvent を発行しない                   InvestigateAlertDomainEvent)
    InvestigateAlert は起動しない                   │
                                                  ▼  EventBus 経由・非同期
                          ┌──────────────────────────────────────────────┐
                          │ InvestigateAlertOnAlertClassifiedUnknown.on()   │
                          │   （DomainEventSubscriber・薄い変換のみ）        │
                          │        │                                       │
                          │        ▼ 委譲                                  │
                          │ InvestigateAlertUseCase.run()                  │
                          │   SimilarIncident.findSimilar()  ← 類似検索     │
                          │   → AIInvestigationPort.investigate()  ← AI調査 │
                          │   → alert.attachInvestigationReport()          │
                          │   → AlertRepository.save()                     │
                          │   → SSEAlertNotifier.notify() [OPEN]           │
                          └──────────────────────────────────────────────┘
```

> **要点**: 「完全一致 → 即終了」は決定論的に安く済む `AnalyzeAlert`（上流）で完結し、コストのかかる AI 調査は未知時のみ。両者は EventBus（`InvestigateAlertDomainEvent`）で疎結合。受け口は `InvestigateAlertOnAlertClassifiedUnknown`（`DomainEventSubscriber`）が直接担い、Command/CommandHandler の二段ホップは挟まない。

---

### 8.2 工程表（ステップ別）

| #   | ステップ                 | 担当コンポーネント                               | 入力                                     | 出力                                                           | 主要技術                                       |
| --- | ------------------------ | ------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| 1   | **イベント受信・変換**   | `CollectMonitoringEventSubscriber`               | EC DomainEvent（RabbitMQ）               | `MonitoringEvent`                                              | RabbitMQ / amqplib                             |
| 2   | **分類**                 | `AnalyzeAlertCommandHandler` + `AlertClassifier` | `MonitoringEvent`                        | `AlertClassificationResult`                                    | `KnownPatternRule`（InMemory完全一致）         |
| 3a  | **既知Alert生成・通知**  | `AnalyzeAlertCommandHandler`                     | `KnownAlertClassification`               | Alert（`OPEN`）+ SSE push                                      | MongoDB + Node.js EventEmitter                 |
| 3b  | **未知Alert生成・通知**  | `AnalyzeAlertCommandHandler`                     | -                                        | Alert（`ANALYZING`）+ SSE push + `InvestigateAlertDomainEvent` | MongoDB + SSE + EventBus                       |
| 4   | **インフラ証拠収集**     | `InfraInvestigationPort`                         | `MonitoringEvent`                        | `InfraEvidence`                                                | Cloud Logging API / Terraform CLI / GitHub API |
| 5   | **AI調査**               | `AIInvestigationPort`（Gemini Adapter）          | `InvestigationContext`（証拠＋類似事例） | `InvestigationReport`（confidence付き）                        | Gemini API（gemini-2.0-flash）                 |
| 6   | **Alert更新・通知**      | `InvestigateAlertOnAlertClassifiedUnknown` → `InvestigateAlertUseCase` | `InvestigationReport`                    | Alert（`OPEN`）+ SSE push                                      | MongoDB + SSE                                  |
| 7   | **オペレーターレビュー** | `SubmitFeedbackCommandHandler` → `SubmitFeedbackUseCase` | `isCorrect`フラグ + note                 | Alert更新（`reviewStatus` = APPROVED/REJECTED）／正解時 `SimilarIncident.index()` | MongoDB                                        |
| 8   | **パターン自動昇格**     | `SubmitFeedbackUseCase`                          | `correctFeedbackCount >= N`（unknown＋report有） | `KnownErrorPattern` 新規登録（`isPromoted=true`）              | MongoDB                                        |
| 9   | **パターン手動昇格**     | `PromotePatternCommandHandler` → `PromotePatternUseCase` | `patternId`（Promoteボタン）             | 既存 `KnownErrorPattern` を昇格（`isPromoted=true`）           | MongoDB                                        |

---

### 8.3 Monitoring コンテキストのモジュール構造（論理型による整理：Bateson）

> **論理型（Bateson / Russell）で整理する。** ベイトソンの「フレーム」は額縁の比喩で、**ある前提・言語が通用する境界を画定し、その機能は「論理型を画定する（delimit a logical type）」こと**（_A Theory of Play and Fantasy_, 1955）。DDD の bounded context は「あるユビキタス言語が通用する境界」なので、**bounded context ＝ ベイトソンのフレーム**として読める。
>
> したがって **`Monitoring` がフレーム＝1つの bounded context**。その内側の `AlertAnalysis` / `AIInvestigation` / `AlertNotification` は、**同じユビキタス言語（`MonitoringEvent`）を共有する Module** であって、それぞれが別個のフレーム（＝別コンテキスト）ではない。フレームが画定する論理型は **1つ（＝「観測」）** で、各モジュールはその内側に閉じる object レベルの分割。
>
> **訂正メモ**: 本節は当初 `Monitoring` を「メタコンテキスト」、子を「コンテキスト」と呼んでいたが、これは論理型の取り違えだった。`Monitoring → AlertAnalysis` の関係は **全体–部分（合成）** であって、ベイトソンの **context of context（メタコミュニケーション＝一段高い論理型）** ではない。Russell の型理論では「クラスはそれ自身のメンバになれない」ので、**同名の "context" を入れ子にする**のは型交差になる。メタの階に名前を与えたいなら別語＝DDD の **Subdomain / Domain** を使う（"メタコンテキスト" とは呼ばない）。
> 経験的な裏づけ: `InvestigationReport` を **ACL も翻訳もなしの素の `import`** で `AIInvestigation → AlertAnalysis` へ移動できた。別コンテキストならこれはモデリング違反のはず。翻訳ゼロで通る＝両者は1つのユビキタス言語を共有する＝**同一コンテキストの Module**。

**`Monitoring`（フレーム＝bounded context）が画定する論理型＝「観測（observation）」**。EC専用ではない。EC ドメインイベント・CI の Trivy 脆弱性通知・インフラシグナルなど**異種の源**を、源固有の型を剥いで均質な観測に正規化する境界がフレームで、`category`（APPLICATION/INFRASTRUCTURE/SECURITY/CAPACITY）がその「EC専用でない」ことの証拠。

```
Monitoring（Bounded Context ＝ 観測フレームを画定する。フレーム内は単一の論理型「観測」）
│
│  ［境界の変換点］各源固有の型に触れるのはここだけ
│   ├─ CollectMonitoringEventSubscriber（EC DomainEvent → MonitoringEvent）
│   └─（将来）CI/infra ingest アダプタ（Trivy / インフラシグナル → MonitoringEvent）
│
├─ Shared/domain/MonitoringEvent  ← フレーム内で通用するユビキタス言語（共有カーネル）
│    ※ フレームそのものではなく、フレームの内側で話される共通語
│
├─ AlertAnalysis（Module）
│    「MonitoringEvent は既知パターンか」を分類する
│    集約: Alert / KnownErrorPattern
│
├─ AIInvestigation（Module）
│    「未知の MonitoringEvent の原因は何か」を調査する
│    InfraEvidence 収集 → Gemini推論 → InvestigationReport
│
└─ AlertNotification（Module）
     「Alert の状態変化をフロントに届ける」
     SSEAlertNotifier
```

| 単位                                      | 担当                                       | 画定するフレーム / 通用する前提                                                  |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| **Bounded Context = フレーム**（Monitoring） | 異種の源を均質な観測へ正規化する境界を画定 | 「ここから内側はすべて均質な観測（単一の論理型）として扱う」。源固有の型はモジュールに漏らさない |
| Module（AlertAnalysis）                   | 既知パターンと照合する                     | `MonitoringEvent`・`KnownErrorPattern`                                          |
| Module（AIInvestigation）                 | 証拠を集めてAIに渡す                       | `MonitoringEvent`・`InfraEvidence`・Gemini                                      |
| Module（AlertNotification）                | フロントへ配信する                         | SSE / Alert のプリミティブ                                                      |

> 各モジュールは `MonitoringEvent` という共通語だけで仕事し、源固有の型（EC / CI / infra）を直接 import しない。  
> これが「`Monitoring`（フレーム＝bounded context）が観測の論理型を画定し、各モジュールはそのフレームの内側で閉じる」という構造の実体。

> **参考（一次ソース）**:
>
> - G. Bateson, _A Theory of Play and Fantasy_ (1955) — 心理的フレーム（inclusive/exclusive・メタコミュニケーション・論理型の画定）
> - G. Bateson, _The Logical Categories of Learning and Communication_ — context / context of context（メタメッセージの階層＝論理型）

---
