# ProtoPedia 提出内容 — Kizashi（兆し）

> Findy **DevOps × AI Agent Hackathon 2026**（Google Cloud 主催協賛）提出作品。
> 本ファイルは ProtoPedia 登録フォームの各欄にそのまま貼り付ける原稿。ProtoPedia はカジュアルな投稿サイトなので、**軽く・短く**を基調にする（審査観点の詳細な訴求は動画・アーキ図・リポジトリ側で行う）。
> 事実の正本は [README.md](../../README.md) と [docs/architecture.md](../architecture.md)（コード準拠）。数値はすべて実測（デモ環境）のみ。「本番運用中」等の実績の示唆はしない。

---

## タイトル

**Kizashi（兆し）— 起きる前に予報し、起きた後は自律調査する AI-SRE エージェント**

---

## 概要（100字以内・88字）

起きる前のリスクを根拠付きで予報し、起きた後の原因調査・報告はAIエージェントが肩代わり。人の承認で学習し、既知の障害は1秒で判定。既存監視の上に乗るAI-SREエージェント。

---

## システム構成

> ハッカソン提出ルール: 「**システムアーキテクチャ図」のアップロードが必須・文章は技術的な補足**。図の正本は [assets/architecture.png](assets/architecture.png)（3520×2060）＝これをアップロードする。図の元データは [assets/architecture-diagram.html](assets/architecture-diagram.html)（SVG 手組み・編集して headless Chrome で再レンダリング可）。
> 以下のテキストは補足としてそのまま Markdown で貼る。図中の①〜⑥と下記の節番号・ストーリー③の特徴 1〜4 が対応する。

---

### システム構成

```mermaid
flowchart LR
  subgraph cloudrun["Cloud Run"]
    FE["backoffice-frontend<br/>(React 配信)"]
    EDGE["backoffice-edge<br/>(公開エッジ / プロキシ)"]
  end

  subgraph gce["Compute Engine"]
    ECB["ec-backend"]
    BOB["backoffice-backend"]

    MQ["RabbitMQ"]
    DB["MongoDB"]
    ES["Elasticsearch"]
    VK["Valkey"]
  end

  subgraph gcp["GCP Managed"]
    CMON["Cloud Monitoring"]
    CLOG["Cloud Logging"]
    VAI["Vertex AI<br/>Gemini 2.5 Pro"]
  end

  GHA["GitHub Actions"]

  %% 通信
  %% EC アプリイベントの検知経路（peer ingest / RabbitMQ 購読）
  ECB -->|DomainEvent| MQ
  MQ -->|Subscribe| BOB

  %% Cloud Monitoring の閾値発火（webhook ingest）
  CMON -->|Webhook| EDGE
  EDGE --> BOB

  %% ログは検知ではなく AI 調査の read-only 証拠ソース
  ECB -->|ログ出力| CLOG
  BOB -->|ログ出力| CLOG
  BOB -.読み取り（証拠）.-> CLOG

  BOB --> VAI

  GHA -->|Deploy| FE
  GHA -->|Deploy| EDGE
  GHA -->|Restart| ECB
  GHA -->|Restart| BOB

  GHA -->|Security Scan| EDGE
```

※ Architecture.mdのデプロイ構成から流用

### システム全体の処理フロー

docs/protopedia/assets/architecture.png

作ったのは、既存の監視基盤の**上に構築した**「アラート発生後の対応を自動化するパイプライン」と、その手前でリスクを事前に知らせる「予報」機能です。障害の検知そのものは実装しておらず、そこは Cloud Monitoring など既存の監視基盤に委ねています。

---

## 開発素材（フォームは入力補完から数個選ぶ形式）

候補から拾えるものを選択（目安 8〜10 個）:

**Gemini / Vertex AI / Google Cloud / TypeScript / React / Express / MongoDB / RabbitMQ / Valkey / Terraform / GitHub Actions**

（補完に出ればプラスで: Google ADK・Elasticsearch・Cloud Run・Trivy）

---

## タグ（5個程度）

おすすめ: **findy_hackathon、AIエージェント、Gemini、GoogleCloud、DevOps、SRE**

（入れ替え候補: 障害対応・監視・マルチエージェント・ハッカソン2026）

---

## ストーリー

### ① 本作品で解決したい課題とその背景

障害対応で一番時間を食うのは「検知」ではなく、アラートが鳴った**後**です。ログ・コード履歴・インフラ変更を人手で行き来して原因を突き止め、影響を見積もり、報告を書く——しかも多くの現場では、同じ障害が再発しても毎回ゼロから調べ直しになります。この「調査・評価・報告」の後工程の負担を減らしたくて作りました。

### ② 想定する利用ユーザー

Web サービスを少人数で運用している SRE・オンコール担当・運用チーム。いまの監視基盤はそのままに、アラート後の調査だけ楽にしたい人（デモの監視対象は EC ですが、取り込み経路は汎用でドメインを問いません）。

### ③ プロダクトの特徴

**1. 起きる前に、根拠付きで予報する**
未マージ PR・未適用の Terraform plan・週末セールなどの負荷予定と、過去の障害の記憶を Gemini が突合し、「土 20:00、DB 接続枯渇 HIGH」のようにリスクを予報します。根拠の引用は実在するシグナルと照合して検証し、偽の引用は自動で落とします。

**2. 未知の障害だけ、8 エージェントが自律調査**
既知・類似は AI を呼ばず即確定。未知だけ Google ADK の 8 エージェント（証拠収集・原因分析・影響評価・相関の検証役など）が実ログ・実コミット diff・インフラ差分を read-only で横断し、根拠リンク付きのレポートを作ります。調査の実行過程は SSE でライブ中継され、「いま何を調べているか」が画面で見えます。

**3. 使うほど速く・安くなる学習ループ**
障害が人の承認によって学習され、同じ障害は次から類似・既知として即判定。頻出パターンは既知へ昇格し、以降は 1 秒・AI コストゼロ。却下すれば訂正の指摘つきで再調査させられます。

**4. 自分自身を監視するドッグフーディング**
このリポジトリ自身の CI（Trivy）が見つけた脆弱性を自分の検知パイプラインに流し、AI がコードを修正して draft PR を起票する自己修復ループを実装しました（自動マージなし・人間承認）。デモでは同じパイプラインが事前起票した実 draft PR を提示します。

---

**正直さの原則**: デモの合成入力は UI 上のバッジで明示（入口のみ合成・分類→AI 調査は実経路）。修正 PR はライブ起票でなく、同じ AI 修正パイプラインで事前に起票した**実 draft PR** を提示します（書き込みトークン運用と PR 増殖回避のため）。数値は実測のみ（ユニットテスト 1017 件全緑・既知分類は約 1 秒未満・未知の AI 調査は約 2 分前後）。
