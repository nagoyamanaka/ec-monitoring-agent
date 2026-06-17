# Step 4-4: backoffice/frontend 設計（React CSR・feature-sliced）

> **Step4 を4分割したうちの「backoffice/frontend」担当。**
> バックエンド（`step4-3`）のAPI/SSEを消費するReact CSR UIに責務を限定する。
> **本書は step1 のフロント節（layer-first）を feature-sliced に更新するもので、こちらを正とする。**
>
> 前提: `step4-3-backoffice-backend.md` のAPIが利用可能。

---

## アーキテクチャ判断：feature-sliced DDD（校正版）

レイヤーを feature 配下に切るが、**各レイヤーの粒度を校正する**（過剰設計回避）。

| レイヤー | 置くもの | 置かないもの |
| -------- | -------- | ------------ |
| `domain/` | **型＋純粋なview-logic**（`AlertView`型、severity→色、confidence整形） | 集約・ふるまい・`DomainService`（バックエンドの責務） |
| `application/` | 薄いユースケース（`submitFeedback` / `approveRemediation`） | 重いオーケストレーション。hooksに畳んでよい |
| `infrastructure/` | **APIクライアント＋SSE**（HttpClient依存、`AlertStream`実装） | — ここが最も価値ある抽象 |
| `presentation/` | pages / components / hooks | ビジネスロジック |

> **原則**: フロントの `domain` は「型＋純関数」。バックエンドの集約を複製しない。`UserDomainService` 相当はクライアント側に本物の不変条件がある時だけ（今回は無し）。

---

## ディレクトリ

```
src/apps/backoffice/frontend/src/
├── main.tsx
├── App.tsx                          # React Router ルーティング
│
├── features/
│   ├── alerts/                      # メイン機能
│   │   ├── domain/
│   │   │   ├── AlertView.ts         # 表示用型（classification.confidence / category 等）
│   │   │   ├── InvestigationReportView.ts  # investigationSteps / suggestedActions / reviewStatus
│   │   │   ├── EvidenceView.ts      # InfraEvidence の表示型（appLogs/terraformDiff/recentCommits）
│   │   │   ├── RemediationView.ts   # PR URL / ステータス
│   │   │   └── severity.ts          # 純関数: severity→バッジ色、confidence→%表記
│   │   ├── application/
│   │   │   ├── submitFeedback.ts    # 承認/却下 → PATCH /alerts/:id/feedback
│   │   │   └── approveRemediation.ts# 承認 → POST /alerts/:id/remediation/draft-pr
│   │   ├── infrastructure/
│   │   │   ├── alertsApi.ts         # GET /alerts, GET /alerts/:id, PATCH feedback（HttpClient依存）
│   │   │   ├── evidenceApi.ts       # GET /alerts/:id/evidence, /investigation/status
│   │   │   ├── remediationApi.ts    # POST draft-pr, GET remediation
│   │   │   ├── AlertStream.ts       # SSEストリーム interface（Mock差し替え可能）
│   │   │   └── SSEAlertStream.ts    # AlertStream の SSE 実装（/alerts/stream）
│   │   └── presentation/
│   │       ├── pages/
│   │       │   ├── AlertsPage.tsx        # /alerts（デモのメイン舞台）
│   │       │   └── AlertDetailPage.tsx   # /alerts/:id（フル詳細・調査プロセス全表示）
│   │       ├── components/
│   │       │   ├── AlertList.tsx
│   │       │   ├── AlertCard.tsx
│   │       │   ├── AlertCardExpanded.tsx # AI分析結果＋調査ステップ＋[✓承認][✗却下]
│   │       │   ├── EvidencePanel.tsx     # Cloud Logging/Terraform/GitHub 証拠の積み上げ可視化
│   │       │   └── RemediationPanel.tsx  # CVEレポート＋PRリンク＋承認ボタン（SECURITY）
│   │       └── hooks/
│   │           ├── useAlertStream.ts     # SSE接続（AlertStream interfaceを利用）
│   │           └── useAlerts.ts          # 一覧取得＋ストリームのマージ
│   │
│   ├── analytics/
│   │   ├── infrastructure/analyticsApi.ts
│   │   └── presentation/pages/AnalyticsPage.tsx
│   │
│   └── demo/                         # デモ系を完全に閉じ込める（プロダクションUI非侵食）
│       ├── infrastructure/demoApi.ts
│       └── presentation/
│           ├── DemoDrawer.tsx        # AlertsLayoutのみで参照
│           ├── ScenarioControls.tsx  # シナリオ1〜5実行ボタン
│           ├── PaymentModeToggle.tsx
│           ├── SystemStatus.tsx      # RabbitMQ接続・SSE接続数・インシデント数
│           └── hooks/useDemoControls.ts
│
└── shared/
    ├── api/
    │   ├── HttpClient.ts             # interface（プロトコル非依存）
    │   └── FetchHttpClient.ts        # fetch実装（baseURL・エラー・タイムアウト）。axios不使用
    ├── ui/
    │   └── SeverityBadge.tsx         # CRITICAL/WARNING/INFO
    └── layouts/
        ├── AlertsLayout.tsx          # /alerts 専用（DemoDrawerをここだけで参照）
        └── DefaultLayout.tsx         # /alerts/:id, /analytics（DemoDrawer非表示）
```

---

## 依存関係ルール

```
presentation → application, domain, infrastructure(interface)
application  → infrastructure(interface), domain
infrastructure → shared/api(HttpClient), domain
domain        → （依存なし。純粋）

features/* → shared/*（逆は不可）
features間の直接依存は禁止（共有は shared に上げる）
AlertsLayout → features/demo/DemoDrawer（ここだけ）。DefaultLayout は参照しない
```

---

## SSE の扱い（最重要）

SSEは **infrastructureの関心事**。interfaceで抽象化し、hookが消費する。

```typescript
// features/alerts/infrastructure/AlertStream.ts
interface AlertStream {
  subscribe(onAlert: (alert: AlertView) => void): () => void; // 戻り値はunsubscribe
}

// SSEAlertStream.ts … EventSource('/alerts/stream') 実装。再接続・heartbeat無視
// MockAlertStream … テスト/デモ用（差し替え可能にする価値が実在）
```

```
useAlertStream():
  1. AlertStream.subscribe() で購読
  2. 受信 alert を state にマージ（同一IDは置換）
     - 未知障害は最初 ANALYZING（「分析中」表示）→ 数秒後に OPEN ＋ 調査結果で再push
  3. unmount で unsubscribe
```

> **デモの核**: 「分析中 → 証拠が1つずつ積み上がる → AI推定が確信度付きで出る → 承認」がSSEでリアルタイムに動く様子。`EvidencePanel` は証拠到着ごとに行が増える演出にする。

---

## 画面と表示内容

| パス | 役割 | DemoDrawer |
| ---- | ---- | ---------- |
| `/alerts` | 一覧＋カード展開（AI分析・証拠パネル・承認をインライン） | **常時表示**（デモ舞台） |
| `/alerts/:id` | フル詳細（調査プロセス全表示・PR詳細） | 非表示 |
| `/analytics` | AI精度トラッキング | 非表示 |

`AlertCardExpanded` の表示要素:
- 原因仮説サマリー・確信度（confidence）・category バッジ
- 調査ステップ（AIが何を調べたか＝自律性の可視化）
- 推奨アクション
- 証拠パネル（`EvidencePanel`）: Cloud Logging / Terraform / GitHub の3ソース
- SECURITY時は `RemediationPanel`: CVE概要＋修正PRリンク＋[✓承認][✗却下]
- 操作: `PATCH /alerts/:id/feedback` に reviewStatus 送信

---

## HTTPクライアント方針（step1踏襲）

- `HttpClient` interface ＋ `FetchHttpClient` 実装（axios不使用＝サプライチェーンリスク回避）。
- `*Api.ts` は interface に依存しテスト時モック差し替え可能。
- REST は抽象化しない（プロトコル変更シナリオが非現実的）。SSEのみ `AlertStream` で抽象化。

---

## step1 との差分（要反映）

step1 のフロント節は layer-first（`pages/ components/ hooks/ infrastructure/`）。本書の feature-sliced が正。step1 側のフロント構成図は本構成に合わせて更新する（TODO: `step4-4-backoffice-frontend-todo.md` のタスクに含む）。
