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

**既存の観測基盤の "検知" の上に乗り、アラート発火後の「調査 → 評価 → レビュー」という人手のワークフローを圧縮するAI調査エージェント。**

分類ツールではなく、複数ソース（Cloud Logging / Terraform差分 / GitHub）を**自律的に横断して証拠を積み上げ、根拠付きで原因を推定し、人間がレビュー・承認する**——この一連を1ループで体現する。

> **検知基盤は Cloud Monitoring を採用（Datadog ではない）**。理由は §2.5。Datadog は有料で本ハッカソンに乗せると物語が「使っていない」と矛盾する。Cloud Monitoring は **無料枠があり・Google 主催ハッカソンの GCP 活用要件に加点され・既に次フェーズ Gateway として設計済み**。「Alerting Policy が発火 → その上に乗る」が文字通り成立する。

---

## 2. 差別化（なぜSaaSと競合しないか）

| レイヤー              | 既存観測基盤（Cloud Monitoring / Datadog / NewRelic）          | 本プロダクト                                       |
| --------------------- | -------------------------------------------- | -------------------------------------------------- |
| 検知（detection）     | **支配領域**。メトリクス・ログ集約・閾値発火・dedup/相関 | やらない（Cloud Monitoring の上に乗る）。発火済みアラートを受ける |
| 調査（investigation） | 一部AI補助（Watchdog/Bits AI）               | **主戦場**。複数ソース横断の証拠収集を自律化       |
| 評価（evaluation）    | 手作業                                       | 類似インシデント照合＋AI原因推定（confidence付き） |
| レビュー（review）    | 手作業（ポストモーテム）                     | reviewStatus（承認/却下）＋修正PR起票まで          |

**Elasticのシナジー**: 運用履歴へのRAG。証拠が太る（logs + terraform diff + git）ほど類似検索の精度が上がり、ハルシネーションでなく**引用付きの仮説**が出る。

**設計の肝**: 「証拠収集（read-only）→ 事例照合（Elastic）→ AI推定（Gemini/ADK）→ 人間レビュー（＋修正PR）」の多層パイプライン。各層は別レイヤーでトレードオフでなくシナジー。

### 2.5 検知境界（detection boundary）と検知ソースの被り対策

「Datadog の上に乗る」と言いながら検知層を自分で持ってしまう、という**位置づけの矛盾**を解く節。要点は **検知（dedup/相関/grouping/閾値発火）を自分の境界の外に追い出す**こと。これで「実質 Datadog と同じことをしている」懸念も「障害時にアラートが大量に出る」懸念も**1手で同時に**解ける。

**(1) 検知ソースは peer な ingest アダプタ**。`MonitoringEvent` は「生の業務イベント」ではなく「**上流の検知ソースが発火した／検知済みの事象**」を表す（§8.3 のフレーム＝異種の源を均質な観測へ正規化する境界、と一致）。

| 検知ソース | ingest アダプタ | 位置づけ |
| --- | --- | --- |
| Cloud Monitoring（Alerting Policy 発火） | `CloudMonitoringAlertIngestController`（実装済み・`POST /ingest/cloud-monitoring`） | 「上に乗る」の本命。Datadog を使わず GCP・無料枠で成立 |
| CI / Trivy | `SecurityScanIngestController`（設計） | DevOps 半分（シナリオ5） |
| **EC 自前 DomainEvent** | `CollectMonitoringEventOnECEventPublished`（実装済み） | **自前検知ソース＝Datadog 不在のデモ stand-in**。嘘の検知ではなく正直な代役 |

> `AlertClassifier` ≠ Cloud Monitoring の monitor。前者は**発火済みアラート**を過去事例/既知パターンと突合し known/unknown に**トリアージ**する（入力＝発火済みアラート、出力＝分類）。後者はメトリクス閾値で**発火させる**（入力＝メトリクスストリーム、出力＝発火）。入力も出力も別レイヤー。

**(2) 被り対策は3層**（検知ソースが複数になり、どの単一上流も横断 dedup できないため、境界での最小の突き合わせは自分の責務になる。ただし correlation エンジンは作らない）。

| 層 | 機構 | 実装 |
| --- | --- | --- |
| (a) **category オーナーシップ**（主防御・コードゼロ） | APPLICATION（業務失敗）は EC 自前イベントが権威、INFRASTRUCTURE/CAPACITY（CPU/接続数/5xx 等の症状）は Cloud Monitoring が権威。**同じものを両者に監視させない**＝被りの大半を構造的に消す | 設計／設定（`category` 弁別子を検知主担当キーに流用） |
| (b) **dedupKey ＋ occurrenceCount**（唯一“実装”する被り対策） | `MonitoringEvent.dedupKey()`＝`source::category::eventName`（＋同一 eventName 内で症状が割れる場合は任意の `discriminator` を末尾に連結）。同一 dedupKey の未解決 Alert があれば新規作成・再分類・再調査せず**発生回数だけ加算**（UI は「×N」）。同一シグナルの嵐と文字通りの重複を1枚に畳む | 実装済み（`AnalyzeAlertUseCase` の classify 前・`AlertRepository.findOpenByDedupKey`） |
| (c) **異症状・同一根本原因の相関**（例: DB枯渇=infra と payment失敗=app） | dedupKey では捕まえない。**AI 調査が根本原因を突き止める過程で相関が浮く**＝検知層の dedup でなく investigation の副産物。エンジン化しない | ADR・将来（トーク） |

> **要点**: (b) は correlation エンジンではなく**冪等キー＋grouping lite**。aggregateId を dedupKey に含めない＝注文ごとに違う決済タイムアウトの嵐を1件（×N）に畳む。closed 通知（Cloud Monitoring 回復）は `severity=info` ＝ `isAlertable()=false` で観測のみ・分類/調査に乗せない。

### 2.6 実装で確定した補足（2026-06）

> §2.5 の境界設計を実機・デモで詰める過程で確定した4点。いずれも「検知は境界の外・dedup は境界での最小冪等点」という §2.5 の原則の具体化であって、原則の変更ではない。

**(1) dedupKey に症状 `discriminator` を追加（同一 eventName 内の別根本原因を畳まない）**

- `ec.inventory.reservation_failed` は **在庫不足（INSUFFICIENT_STOCK）と楽観ロック競合（CONCURRENT_CONFLICT）の2症状**を同じ eventName で持つ。dedupKey が `source::category::eventName` のみだと**別根本原因が1件に畳み込まれる**バグになっていた（在庫競合を注入しても在庫不足アラートの ×N に吸われ、独立アラートとして出ない＝「在庫競合は未seedで未知→AI調査を見せる」という学習ループ演出も壊れる）。
- 対策: `MonitoringEvent` に任意の `discriminator` を持たせ、`dedupKey()` に連結する（在庫イベントは `reason` を入れる）。決済タイムアウト等は discriminator 無し＝従来どおり注文跨ぎで storm 抑制。**aggregateId を入れない方針（storm 抑制）と、症状で割る方針（別原因を分離）の両立**がこの設計の肝。
- 併せて **seed と実イベントの `source` 命名を統一**（seed の `"ec-backend"` → 実経路と同じ `"payment"/"inventory"/"order"`）。揃えないと seed と実発火の dedupKey が食い違い、実発火が seed に畳み込まれない。

**(2) アラート流入は「経路A（業務イベント）」と「経路B（Cloud Monitoring）」の2系統で、デモでの発火条件が異なる**

- **経路A**: EC DomainEvent → RabbitMQ → `CollectMonitoringEventOnECEventPublished` → Alert。決済タイムアウト/在庫不足/在庫競合の各 fault injection はこの経路。**Cloud Monitoring を通らない**。
- **経路B**: アプリの **CRITICAL ログ / 5xx** → Cloud Monitoring Alerting Policy → webhook → `/ingest/cloud-monitoring` → Alert。シナリオ4（インフラ起因）と「アプリのエラーログ自動発報」がこの経路。
- 重要な含意: **業務失敗（在庫不足・決済タイムアウト）は "ハンドリング済みの正常系" で 4xx・WARN ログ**であり、5xx でも CRITICAL でもない＝**経路B では発火しない**（経路Aで拾うのが正しい）。よって**経路Bをデモで見せるにはインフラ級異常を意図的に注入するしかない**。

**(3) デモに「インフラ障害」注入を新設（経路B の発火源）**

- EC に `POST /demo/infra-fault`（CRITICAL ログ＋HTTP 500 を発生）を追加し、`TriggerDemoScenarioUseCase` の `infra-fault` シナリオから叩く。EC は **GCE backbone 上**なので発報の主経路は CRITICAL ログ → `ec_monitoring_critical_log` メトリクス（フィルタが gce_instance も対象）。5xx は `cloud_run_5xx`（Cloud Run edge 専用）なので EC の 500 は数えない点に注意。
- **ローカルには Cloud Monitoring が無い**ため、このボタンはローカルでは「500/CRITICAL ログが出るだけ・Alert 化しない」。Alert 化は GCP デプロイ環境でのみ成立（T9 の実機検証＝このボタンで踏める）。

**(4) ingest アダプタは locality で2メカニズム。CI は HTTP 側で Cloud Monitoring と同類**

- 流入アダプタは「**内部＝バス購読**（EC DomainEvent）」「**外部 push＝HTTP ingest controller**（Cloud Monitoring / CI・Trivy）」の2系統。全て `CollectMonitoringEventUseCase.run()` に合流済み＝**アーキ的には既に統一**。CI を `CollectMonitoringEventOnGithubAction` のような**バス購読**にするのは誤り（CI は外部ランナーで内部 RabbitMQ に publish できない＝HTTP が正）。
- 残る非対称は**翻訳ロジックの置き場**: Cloud Monitoring は `CloudMonitoringAlertTranslator` に分離済みだが、SecurityScan はコントローラ内インライン。**`SecurityScanTranslator` に抽出**して「薄い境界（auth+parse）→ Translator → UseCase」で3経路を揃えるのが統一の正体（未実施・次の cleanup 候補）。

**(5) デモ操作は「設定＋発火」を1ユースケースに閉じる（裸の PAYMENT MODE トグルは廃止）**

- フロントの PAYMENT MODE トグルは「EC のモードを設定するだけ」で**単独では発火トリガが無く**（常時トラフィック/ストアフロント UI が無い）、押しても何も起きない＝混乱の元だった。「モード設定＋注文投入」を1操作にした FAULT INJECTION（`TriggerDemoScenarioUseCase`）と機能が重複。
- 決定: **フロントの PAYMENT MODE トグルと backoffice の `/demo/payment-mode` を廃止**。モード設定はシナリオ注入が EC へ内部的に行う（EC の `/demo/payment-mode` は gateway 経由で残す）。原則は「**デモのコントロールは単体で目に見える効果を出す**」。storm（×N）は同じ fault ボタンの連打で再現でき、RANDOM モードは不要。

### 学習ループ：確度付き分類と知識の結晶化（差別化の中核）

既存SaaSは「**同じ障害が再発しても毎回ゼロから調べ直す**」。本プロダクトは **運用での確認を蓄積し、次に似た障害が来たら“確度付き”で先回りする**。肝は、学習が **0/1（未知→既知）の離散フリップではなく、確度の連続スペクトル**で進むこと。混同しやすいので**2段に分けて**捉える。

**① 連続的な確度（分類の確度・読み取り）＝学習の本体**

- 正解フィードバックは毎回 `SimilarIncident` として蓄積される（確度の母集団が太る）。
- `SimilarPatternRule`（kind=`SIMILARITY`・ES `multi_match` + fuzziness）がそれを読み、**完全一致でなくても「過去のDB枯渇に82%類似・確度 中」のような graded confidence で分類**する（✅ タスク17 実装済み）。
- `ClassificationConfidence`（0〜1・`isHighConfidence()`）で low/中/high バンドを表現。**この確度をレポートに出すこと自体が意思決定支援**＝「未知です」より圧倒的に価値が高い（差別化テーブルの「評価（confidence付き）」の実体）。

**② 離散的な結晶化（昇格・書き込み）＝高速パスの最適化**

- 何度も確認され頻出が確定したものだけを `KnownErrorPattern`（完全一致・confidence 1.0）に**焼き付ける**。
- 効果は**速度と決定性**（Elastic を介さず1秒で既知分類＝デモシナリオ3）。学習の質そのものは ① が担い、② はそのキャッシュ化。

**昇格（②）の2トリガー**（＝結晶化を誰が起こすか）:

| 観点 | 自動（`SubmitFeedback`）                       | 手動（`PromotePattern`）             |
| ---- | ---------------------------------------------- | ------------------------------------ |
| 起点 | 確認回数・確度がしきい値到達                   | 人間が「確実」と判断                 |
| 値   | 統計的合意による焼き付け（早とちりを防ぐゲート） | 即時・人間のオーバーライド           |

> **現状（✅ タスク17 完了済み）**: ① の本体（`SimilarPatternRule`）は**実装済み**。正解フィードバック蓄積 → `SimilarIncident.search()` graded confidence 分類が通るようになり、`SimilarIncident` は AI 調査の文脈強化＋分類段階の両方に接続された（`ELASTICSEARCH_URL` 設定時は ES `multi_match`・未設定時は InMemory Jaccard でフォールバック）。② の昇格ゲートを「回数固定 → 類似確度を取り込んだ加重」にするのが **タスク24/25**。confidence の出処が増えても `classification.confidence` / UI は不変（世代互換設計）。

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

### 検知ソースは Cloud Monitoring・検知境界は外（ADR種）

- 検知基盤に **Cloud Monitoring を採用**（Datadog は有料・物語と矛盾／Cloud Monitoring は無料枠・GCP 要件加点・設計済み）。
- 検知（dedup/相関/grouping/閾値発火）は**上流の責務＝境界の外**。`MonitoringEvent` は発火済みアラートを受ける。1 ingest = 1 Alert は「手抜き」でなく**境界を引いた結果として正しい**（§2.5）。
- 検知ソースは peer な ingest アダプタ（Cloud Monitoring / CI / EC 自前イベント）。EC 自前イベントは Datadog 不在の**デモ stand-in** と正直に位置づける。
- 被りは **(a) category オーナーシップ（主防御）＋ (b) dedupKey＋occurrenceCount（実装）＋ (c) 異症状・同一根本原因は AI 相関に委譲（エンジン化しない）** の3層。詳細は §2.5。

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
    ├─【既知（完全一致 or 類似一致）】───────┐
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
        │   ├ KnownPatternRule（eventName+payload 完全一致・confidence 1.0）│
        │   └ SimilarPatternRule（ES multi_match graded confidence・ELASTICSEARCH_URL 設定時）│
        └────────────────────────────────────────────┘
                             │
            matched: true    │    matched: false
         ┌───────────────────┴────────────────────┐
         ▼【既知（完全一致 or 類似一致）】           ▼【未知】
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

> **要点**: 「完全一致 or 類似一致（graded confidence） → 即終了」は `AnalyzeAlert`（上流）で完結し、コストのかかる AI 調査は未知時のみ。両者は EventBus（`InvestigateAlertDomainEvent`）で疎結合。受け口は `InvestigateAlertOnAlertClassifiedUnknown`（`DomainEventSubscriber`）が直接担い、Command/CommandHandler の二段ホップは挟まない。

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

## §10. リアルタイム配信の境界：SSE push（broadcast）と frontend pull の使い分け

> **決定（2026-06 確定）**: フロント↔backend のリアルタイム反映を「SSE か ポーリングか」で事象ごとにアドホックに決めず、**1本の軸**で割る。実装の根拠（コードベースでの確認）は step4-3/step4-4 に対応。

### 原則（一文）

> **小さくて全クライアント共通の "事実" は broadcast（SSE）／ 大きい・外部依存・特定ユーザーが見ている時だけ要る "詳細" は pull on-demand。**

### 適用

| 事象 | 手段 | 理由 |
| ---- | ---- | ---- |
| アラート集約のライフサイクル（生成・分析中・調査完了・dedup 更新） | **SSE push（既定イベント）** | 小さく・一覧の全員が関心・既に domain で emit 済み（`AnalyzeAlertUseCase`/`InvestigateAlertUseCase` の `SSEAlertNotifier.notify`） |
| リメディ確定（dispatched→drafted/failed・skipped） | **SSE push（名前付きイベント `remediation`）** | 小さい（status/PR URL/件数）。CI callback は非同期でクライアント操作が起点に無い＝push が最も素直。`RecordRemediationResultUseCase`/`DraftRemediationUseCase` が `SSEAlertNotifier.notifyRemediation` |
| インフラ証拠（Cloud Logging / Terraform / GitHub） | **pull on-demand**（ドロワーを開いた人が done になった時だけ GET /evidence） | 大きく・外部 API を毎回叩く重い収集。全クライアントへ broadcast すると「1アラート×N クライアント分の再収集」が走る事故。done 判定は **SSE で届く alert.status から導出**し、status 専用ポーリングは廃止（同じ事実を二重に持たない） |

### この決定で消えたもの / 足したもの

- **消えた**: `GET /alerts/:id/investigation/status` エンドポイント（＋ `GetInvestigationStatus` UseCase 一式）。証拠の done 判定は SSE で更新される alert.status から導出できるため、status を別エンドポイントでポーリングするのは冗長（二重ソース）だった。frontend は `useEvidence(api, alert)` が alert を受け取り status を読む。
- **足した**: SSE の**名前付きイベント**多重化（`EventEmitterSSEAlertNotifier` が `event: remediation` 行を出し分け、frontend `SSEAlertStream` が `addEventListener("remediation")`）。1本の EventSource 接続で alert と remediation の両ライフサイクルを配る。`RemediationResponsePrimitives` を契約の単一ソース（GET レスポンス＝SSE payload＝frontend View 入力）に統一。

### トレードオフと UX 保証

- **「アラートが出来たら即表示」は SSE push で無条件に保証**される（どのポーリング設計とも独立）。ポーリング/pull が効くのは証拠・リメディ確定＝**ドロワーを開いている時だけ問題になる二次情報**なので、ベースライン UX は崩れない。
- **負荷観点**: 社内オペレーションコンソールで同時オペレータ数が少ない＝同時に開くドロワー数が pull 負荷の上限。pull 負荷は誤差で、選択軸は「一貫性とレイテンシ」。
- **detail ページ（`/alerts/:id`）**: alert は `useAlert(api, id, stream)` で SSE ライブ化（証拠の done 判定が一覧ドロワーと同挙動）。リメディは現状ポーリングのフォールバック（`live=false`）＝主舞台のドロワーは push、deep-link の detail は poll、という許容した非対称（必要なら detail も `live` に寄せられる）。
- **スケールアウト時**: `EventEmitterSSEAlertNotifier`（in-process）は同 interface のまま `RedisSSEAlertNotifier` へ差し替え（複数プロセス間の fan-out）。

---

## §11. デプロイ・トポロジと IaC（2026-06 確定）

> **決定**: §4「デプロイ」を具体化する。検知ソース ingest（§2.5）・Cloud Run 配信エッジ・Valkey の役割・キャッシュ耐障害性・IaC 構成を1本化。実装は step4-3（backend 配線）/ `infra/terraform/`（IaC）に対応。

### 11.1 トポロジ：ハイブリッド（GCE=常駐の脳 / Cloud Run=ステートレス配信エッジ）

```
                       ┌─────────── Cloud Run（とどける・スケールする）───────────┐
ブラウザ ◀── SSE ──────│  backoffice query/SSE API（ステートレス・min=0〜N）        │
   ▲                   │   ・GET /alerts, /alerts/:id/evidence  → Valkey 読む       │
   │ TanStack          │   ・GET /alerts/stream (SSE)           → Valkey Sub 購読   │
   │                   └───────────────▲───────────────────────┬──────────────────┘
   │                                   │ Pub/Sub(deltas)         │ VPC connector
   │                                   │ + read-model(snapshot)  ▼
   │                   ┌───────────────┴──── GCE（常駐の脳）───────────────────────┐
Cloud Monitoring ──webhook──▶ /ingest/cloud-monitoring                              │
CI(Trivy) ─────────webhook──▶ /ingest/security-scan                                 │
                   │  RabbitMQ ・ MongoDB ・ Elasticsearch ・ Valkey ・ EDA worker  │
                   │                              （EC + Monitoring subs + AI調査） │
                   └───────────────────────────────────────────────────────────────┘
                                  Gemini / Vertex（API）
```

- **GCE（e2-standard-2 想定・無料クレジット充当）= ステートフル backbone**: RabbitMQ / MongoDB / **Elasticsearch（GCE 自前ホスト）** / Valkey / EDA worker（EC + Monitoring subscribers + AI調査）。RabbitMQ 常駐 Subscriber は Cloud Run の stateless/scale-to-zero と本質的に噛み合わないため、worker は GCE に置く。
- **Cloud Run = 配信エッジ（「とどける」見せ場・スケールする）**: backoffice の **クエリ API ＋ SSE** をステートレスに出す（min=0）。Valkey を VPC connector 越しに読む／購読する。
- **Elasticsearch は Elastic Cloud でなく GCE 同居に変更**（2026-06 決定）。無料クレジットで賄い外部課金を回避するため。`SimilarPatternRule`（Step2）用。メモリは ES heap を絞る（`-Xms512m -Xmx512m`）。8GB で逼迫するなら e2-standard-4 に上げる（クレジット内）。
- RabbitMQ は ADR どおり維持（Pub/Sub に替えない＝ローカル E2E 速度。Step5 ADR「なぜ Pub/Sub でなく RabbitMQ か」）。

> コスト感（無料クレジット充当前提）: GCE e2-standard-2 ~$50/月 ＋ Serverless VPC Access connector ~$10/月 ＋ Cloud Run/Gemini は無料枠内。ES の外部課金 $0。予算をさらに絞るなら「全部 GCE・Cloud Run 無し」も成立するが、Valkey + Cloud Run のスケール訴求を捨てるので非推奨。

### 11.2 検知ソース ingest：Cloud Monitoring → Webhook channel（Cloud Function を挟まない）

- Cloud Monitoring Alerting Policy 発火 → **Webhook 通知チャネル** → Cloud Run `POST /ingest/cloud-monitoring`（`x-ingest-token` 認証）→ `CloudMonitoringAlertIngestController`（§2.5）→ `CollectMonitoringEventUseCase.run()`。
- **Cloud Function は挟まない**（2026-06 決定）: Cloud Run が公開 HTTPS を提供するため、中継 Function はホップが増えるだけで旨味が薄い。Pub/Sub ＋ Function でのバッファリング/リトライは「本番 hardening」として ADR にのみ記載する。
- 経路の根拠は `CollectMonitoringEventSubscriber` のクラスコメント（EC 自前イベント＝バス購読 / 外部 push 源＝HTTP ingest コントローラの peer アダプタ）に一致。category オーナーシップ（INFRASTRUCTURE/CAPACITY = Cloud Monitoring 権威）で EC 自前イベントと被らない（§2.5）。

### 11.3 Valkey の2役と「SoT を in-memory に置かない」原則

Valkey は**同一インスタンスで2役**を兼ねる。だが**どちらも SoT ではない**——ここが耐障害性の肝。

| 役 | 用途 | 案 |
| --- | --- | --- |
| ① Pub/Sub（transport） | worker→Cloud Run の SSE delta fan-out。多インスタンス SSE の必然性そのもの | 案1（最優先） |
| ② read-model（projection） | `GET /alerts`・`/alerts/:id/evidence` のスナップショットを保持し、Cloud Run が Mongo を叩かず読む（CQRS read model in Redis） | あなたの案（①と同格） |

> AI 進捗（案2）は①の中身（思考 step 列を Valkey に置き、完了時のみ Mongo 永続化）。案4（外部API障害/Circuit Breaker）は時間が余れば着手（CB 状態のインスタンス間共有が Valkey 紐付け・既存シナリオ1と差別化）。案3（LLM rate limiter）はデモで不可視＝後回し（INCR/EXPIRE で安価に「本番考慮」として添える程度）。

**「Valkey が落ちたら終わり」への解（write-through を真実経路にしない）**:

懸念は正しいが、それは **Valkey を SoT にした場合**の話。本設計は **Mongo = SoT（耐久）、Valkey = 再構築可能な projection ＋ transport** に徹し、Valkey を真実の経路から外すことで構造的に解消する。

- **書き込み順序**: writer（EDA projector）は **まず SoT（Mongo）に書き**、その後 Valkey に projection を派生させる。「先に cache に書く write-through（cache を真実の前段にする）」は採らない。
- **読み取り経路（cache-aside fallback）**: Cloud Run は Valkey hit→返す、**miss/down→Mongo にフォールバックして再投入**。∴ **Valkey down = 性能劣化（Mongo 負荷増）であって障害ではない**。
- **projection は再構築可能**（§7.9 の ForecastMemory と同原則「projection は再構築可能であるべき」）。alert id をキーにした **冪等 upsert ＋ at-least-once のイベント配送**で、projector がクラッシュしても再投影で自己回復（結果整合）。
- **SSE delta は best-effort**: Valkey down 中の delta は失われるが、frontend は再接続時に現在状態を再フェッチ（TanStack invalidate）してギャップを埋める。correctness は reads（cache-aside）が担保し、SSE は liveness 層。
- 配線は §10 既述の interface 差し替え（`EventEmitterSSEAlertNotifier` → `RedisSSEAlertNotifier`）に一致。

> **要点**: 弊害は「SoT を in-memory に置くこと」そのものであって、in-memory を「**捨てても真実が残り自己回復する派生ビュー＋transport**」に限定すれば出ない。Valkey は SoT ではなく projection／transport の位置に置く。

### 11.4 フロント：SSR 不採用・TanStack Query 採用（依存は infrastructure に隔離）

- **SSR は採らない**: realtime dashboard は SSE が主で、SSR の初期描画は直後に SSE で上書きされ旨味が薄い。サーバ近接フェッチの利点は「Cloud Run API が Valkey を読む」で既に充足。docs の CSR 方針も維持。
- **TanStack Query は採る**: CSR で都度取得していた `/alerts/:id/evidence` 等を `staleTime` キャッシュ＋SSE 受信で `setQueryData`/`invalidateQueries`（push 更新）。二層キャッシュが合成される（**Valkey = Mongo オフロード / TanStack = Cloud Run API オフロード**）。
- **層の規律（必ず守る）**: TanStack はサーバ状態のクライアントキャッシュ＝**インフラの関心事**。`@tanstack/react-query` 依存は frontend の **infrastructure 層（API クライアント／フックアダプタ）に閉じ込め、domain/application 層に import しない**。ロジックは TanStack 非依存に保ち、フックは薄いアダプタにする。

### 11.5 IaC フォルダ構成（`infra/terraform/`・`src/` の外）

`src/` の外に `infra/` を切る（turbo/pnpm のビルド対象に混ぜない）。ハッカソン2週間スコープなので **modules ＋ prod 単一 env ＋ GCS remote state ＋ WIF（キーレス）** に絞る（multi-env は過剰）。

```
infra/terraform/
├── versions.tf            # provider pin (google, google-beta)
├── modules/
│   ├── bootstrap/         # API有効化(run,compute,monitoring,logging,aiplatform,secretmanager,vpcaccess) + Secret Manager(GEMINI_API_KEY,INGEST_TOKEN)
│   ├── networking/        # VPC, firewall, Serverless VPC Access connector
│   ├── gce-backbone/      # COS VM + startup-script で docker-compose.prod 起動（rabbitmq/mongo/es/valkey/worker）
│   ├── cloud-run/         # backoffice query/SSE service（VPC connector経由でValkey到達, min=0）
│   ├── monitoring/        # Alerting Policy + Notification Channel(webhook → /ingest/cloud-monitoring) + uptime check
│   ├── logging/           # log-based metrics, log sink
│   └── iam/               # service accounts + WIF(GitHub OIDC) + secret accessor
├── envs/prod/
│   ├── main.tf  variables.tf  terraform.tfvars  backend.tf(GCS)
└── README.md
```

- GitHub Actions に `terraform-plan`(PR時) / `terraform-apply`(main・手動承認) を追加。**WIF（Workload Identity Federation・GitHub OIDC）でキーレス認証**にし、長期 SA キーを排除（DevOps 面の加点）。
- Gemini は Terraform では「API 有効化＋SA(`aiplatform.user`)＋Secret Manager にキー」を作るのみ（モデルは provision 対象外）。
- Cloud Function module は初手では作らない（§11.2・§11.3 のとおり webhook 直結＋worker write-through で不要）。

### 11.6 ADR種（Step5・追加）

- ハイブリッド（GCE 常駐 worker ＋ Cloud Run 配信エッジ）にし、RabbitMQ 常駐 Subscriber を Cloud Run に載せない理由（EDA とステートレスのトレードオフ）
- Elasticsearch を Elastic Cloud でなく **GCE 自前ホスト**にする理由（無料クレジット充当・外部課金回避と、運用/メモリ負担とのトレードオフ）
- 検知 ingest を Cloud Monitoring **Webhook 直結**にし Cloud Function 中継を挟まない理由（Pub/Sub＋Function は本番 hardening として線引き）
- Valkey を SoT にせず「**再構築可能な read-model projection ＋ Pub/Sub transport**」に限定し、Mongo SoT＋cache-aside fallback で Valkey 障害を性能劣化に縮める理由（write-through を真実経路にしない判断）
- SSR を採らず TanStack Query でクライアントキャッシュする理由と、TanStack 依存を **infrastructure 層に隔離**する理由（domain/application を汚さない）
- IaC を **WIF キーレス・modules＋単一 prod env・GCS remote state** で構成する理由

---
