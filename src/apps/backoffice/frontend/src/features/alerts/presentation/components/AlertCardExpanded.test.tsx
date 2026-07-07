import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AlertCardExpanded } from "./AlertCardExpanded";
import { makeAlert, makeReport } from "../../test-support/alertFixture";

describe("AlertCardExpanded", () => {
  it("full は サマリ・調査ステップ・推奨アクションを表示する", () => {
    render(<AlertCardExpanded alert={makeAlert()} variant="full" />);
    expect(screen.getByText("AI 推定パターン")).toBeInTheDocument();
    expect(screen.getByText("未知のレイテンシ急増を検知")).toBeInTheDocument();
    expect(screen.getByText("ログ確認")).toBeInTheDocument();
    expect(screen.getByText("ロールバック")).toBeInTheDocument();
  });

  it("AI 推定パターン名が機械 ID（UPPER_SNAKE）なら見出しは人間語・生IDはメタ行に降格（A3）", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: makeReport({
            suggestedPatternName: "TERRAFORM_DB_MAX_CONNECTIONS_REDUCTION",
          }),
        })}
      />,
    );
    // 見出し行はスペース区切り小文字の人間語（snake_case を主表示に出さない）
    const heading = screen.getByText("terraform db max connections reduction");
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-slate-100");
    // 生IDは font-mono の従属メタ行（パターンID:）へ降格（ここには生IDが残ってよい）
    expect(screen.getByText("パターンID:")).toBeInTheDocument();
    const rawId = screen.getByText("TERRAFORM_DB_MAX_CONNECTIONS_REDUCTION");
    expect(rawId.tagName).toBe("CODE");
  });

  it("AI 推定パターン名が既に人間語なら変換せずそのまま出す（A3・誤変換しない）", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: makeReport({ suggestedPatternName: "決済APIタイムアウト" }),
        })}
      />,
    );
    expect(screen.getByText("決済APIタイムアウト")).toBeInTheDocument();
    // 人間語には従属メタ行を足さない
    expect(screen.queryByText("パターンID:")).not.toBeInTheDocument();
  });

  describe("発報内容（検知ソースの生情報）", () => {
    const detectionDetail = {
      summary: "ec-backend が severity=CRITICAL のログを記録",
      documentation: "対象サービス: ec-backend（action: demo_infra_fault）",
      policyName: "アプリ CRITICAL ログ検知",
      resourceName: "ec-monitoring-backbone",
      resourceType: "gce_instance",
      metricType: null,
      incidentUrl: null,
    };

    it("ドロワー（summary）・詳細ページ（full）の両 variant で表示する", () => {
      for (const variant of ["summary", "full"] as const) {
        const { unmount } = render(
          <AlertCardExpanded variant={variant} alert={makeAlert({ detectionDetail })} />,
        );
        expect(screen.getByText("発報内容")).toBeInTheDocument();
        // documentation の「ラベル: 値」行は定義リストへ構造化される
        expect(screen.getByText("対象サービス")).toBeInTheDocument();
        expect(
          screen.getByText("ec-backend（action: demo_infra_fault）"),
        ).toBeInTheDocument();
        expect(screen.getByText("ec-monitoring-backbone")).toBeInTheDocument();
        unmount();
      }
    });

    it("documentation の「検知ログ」行はログ引用として主役表示する", () => {
      render(
        <AlertCardExpanded
          alert={makeAlert({
            detectionDetail: {
              ...detectionDetail,
              documentation:
                "対象サービス: ec-backend（action: demo_infra_fault）\n検知ログ: デモ用インフラ障害を注入：意図的に CRITICAL ログを発生させる\n発火条件: severity>=CRITICAL ログ",
            },
          })}
        />,
      );
      expect(screen.getByText("検知ログ")).toBeInTheDocument();
      expect(
        screen.getByText(
          "デモ用インフラ障害を注入：意図的に CRITICAL ログを発生させる",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("発火条件")).toBeInTheDocument();
    });

    it("行構成でない documentation は生テキストのまま表示する（フォールバック）", () => {
      render(
        <AlertCardExpanded
          alert={makeAlert({
            detectionDetail: {
              ...detectionDetail,
              documentation: "自由文の説明。runbook 参照。",
            },
          })}
        />,
      );
      expect(screen.getByText("自由文の説明。runbook 参照。")).toBeInTheDocument();
    });

    it("CM 自動生成の英文 summary は documentation があれば原文 details へ降格する", () => {
      const autoSummary =
        "Log match condition with labels {action=demo_infra_fault,service=ec-backend} fired for VM Instance with {instance_id=1, zone=asia-northeast1-a}.";
      render(
        <AlertCardExpanded
          alert={makeAlert({
            detectionDetail: { ...detectionDetail, summary: autoSummary },
          })}
        />,
      );
      // リード文としては出さず、畳んだ原文（details）の中にだけ残る
      expect(
        screen.getByText("Cloud Monitoring 原文サマリ（自動生成の英文）"),
      ).toBeInTheDocument();
      expect(screen.getByText(autoSummary).closest("details")).not.toBeNull();
    });

    it("人間語 summary（合成 3b 等）はリード文のまま・原文 details は出さない", () => {
      render(<AlertCardExpanded alert={makeAlert({ detectionDetail })} />);
      const lead = screen.getByText(
        "ec-backend が severity=CRITICAL のログを記録",
      );
      expect(lead.closest("details")).toBeNull();
      expect(
        screen.queryByText("Cloud Monitoring 原文サマリ（自動生成の英文）"),
      ).not.toBeInTheDocument();
    });

    it("「Type labels {…}」形の resourceName は種別＋ラベルチップへ分解する", () => {
      render(
        <AlertCardExpanded
          alert={makeAlert({
            detectionDetail: {
              ...detectionDetail,
              resourceName:
                "VM Instance labels {instance_id=971418685088913937, project_id=ec-monitoring-agent-501600, zone=asia-northeast1-a}",
            },
          })}
        />,
      );
      expect(screen.getByText("VM Instance")).toBeInTheDocument();
      expect(
        screen.getByText("instance_id=971418685088913937"),
      ).toBeInTheDocument();
      expect(screen.getByText("zone=asia-northeast1-a")).toBeInTheDocument();
      // 生 blob はそのままの形では出さない
      expect(
        screen.queryByText(/^VM Instance labels \{/),
      ).not.toBeInTheDocument();
    });

    it("incidentUrl があれば CM インシデントへの外部リンクを出す（実発報のみ持つ）", () => {
      render(
        <AlertCardExpanded
          alert={makeAlert({
            detectionDetail: {
              ...detectionDetail,
              incidentUrl: "https://console.cloud.google.com/monitoring/alerting/incidents/0.abc",
            },
          })}
        />,
      );
      const link = screen.getByRole("link", {
        name: /Cloud Monitoring インシデントを開く/,
      });
      expect(link).toHaveAttribute(
        "href",
        "https://console.cloud.google.com/monitoring/alerting/incidents/0.abc",
      );
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("detectionDetail の無い Alert（EC 業務イベント等）ではセクションを出さない", () => {
      render(<AlertCardExpanded alert={makeAlert()} variant="full" />);
      expect(screen.queryByText("発報内容")).not.toBeInTheDocument();
    });
  });

  it("href 付き調査ステップは新規タブの外部リンクになる", () => {
    render(
      <AlertCardExpanded
        variant="full"
        alert={makeAlert({
          report: makeReport({
            investigationSteps: [
              {
                text: "ログを見る",
                href: "https://logs.example/q",
                kind: "log",
              },
            ],
          }),
        })}
      />,
    );

    const link = screen.getByRole("link", { name: /ログを見る/ });
    expect(link).toHaveAttribute("href", "https://logs.example/q");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("href の無いステップはプレーンテキストのまま（リンク化しない）", () => {
    render(
      <AlertCardExpanded
        variant="full"
        alert={makeAlert({
          report: makeReport({
            investigationSteps: [{ text: "素のステップ" }],
          }),
        })}
      />,
    );

    expect(screen.getByText("素のステップ")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /素のステップ/ }),
    ).not.toBeInTheDocument();
  });

  it("類似既知（SIMILARITY）の back-link はここには出さない（関連アラートパネルへ統合）", () => {
    render(
      <MemoryRouter>
        <AlertCardExpanded
          alert={makeAlert({
            report: null,
            classification: {
              type: "known",
              source: "SIMILARITY",
              patternId: "similar:inc-1",
              patternName: "類似既知: 在庫予約失敗",
              confidence: 0.87,
              matchedConditions: [],
              sourceAlertId: "alert-past-1",
            },
          })}
        />
      </MemoryRouter>,
    );

    // back-link は RelatedAlertsPanel（ドロワー/詳細でマウント）へ移設済み。
    expect(
      screen.queryByRole("link", { name: /過去の同型障害|詳細を開く/ }),
    ).not.toBeInTheDocument();
  });

  it("remediable=true のとき「コードで修正可能」バッジを出す（full）", () => {
    const { rerender } = render(
      <AlertCardExpanded
        variant="full"
        alert={makeAlert({ report: makeReport({ remediable: false }) })}
      />,
    );
    expect(screen.queryByText(/コードで修正可能/)).not.toBeInTheDocument();

    rerender(
      <AlertCardExpanded
        variant="full"
        alert={makeAlert({ report: makeReport({ remediable: true }) })}
      />,
    );
    expect(screen.getByText(/コードで修正可能/)).toBeInTheDocument();
  });

  it("既知パターンは該当パターン名と一致根拠を表示する", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: null,
          classification: {
            type: "known",
            source: "EXACT_MATCH",
            patternId: "p-1",
            patternName: "決済APIタイムアウト",
            confidence: 0.9,
            matchedConditions: [
              {
                field: "eventName",
                expectedValue: "ec.payment.timeout",
                actualValue: "ec.payment.timeout",
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("該当パターン（既知）")).toBeInTheDocument();
    expect(screen.getByText("決済APIタイムアウト")).toBeInTheDocument();
    expect(screen.getByText("一致した根拠")).toBeInTheDocument();
    expect(screen.getByText("eventName")).toBeInTheDocument();
  });

  it("類似既知は similarity をテーブルに混ぜず確定条件ゲートとして出し、一致値は1つに畳む", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: null,
          classification: {
            type: "known",
            source: "SIMILARITY",
            patternId: "similar:ri-1",
            patternName: "類似既知: ec.db.connection_pool_exhausted",
            confidence: 0.67,
            matchedConditions: [
              {
                field: "eventName",
                expectedValue: "ec.db.connection_pool_exhausted",
                actualValue: "ec.db.connection_pool_exhausted",
              },
              {
                field: "similarity",
                expectedValue: ">=0.6",
                actualValue: 0.67,
              },
            ],
          },
        })}
      />,
    );
    // 期待値=実値の一致は1つの値に畳む（重複表示なら getByText が複数一致で落ちる）
    expect(
      screen.getByText("ec.db.connection_pool_exhausted"),
    ).toBeInTheDocument();
    // similarity は「一致した根拠」の行ではなく、しきい値の確定条件として表示
    expect(screen.queryByText("類似度スコア")).not.toBeInTheDocument();
    expect(screen.getByText(/確定条件/)).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText(/しきい値 60%/)).toBeInTheDocument();
    expect(screen.getByText(/AI 調査へフォールバック/)).toBeInTheDocument();
  });

  it("類似既知に resolvedNote があれば「当時の対応メモ」を出す", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: null,
          classification: {
            type: "known",
            source: "SIMILARITY",
            patternId: "similar:ri-1",
            patternName: "類似既知: ec.db.connection_pool_exhausted",
            confidence: 0.67,
            matchedConditions: [],
            resolvedNote: "接続プール上限を拡張して復旧",
          },
        })}
      />,
    );
    expect(screen.getByText(/当時の対応メモ/)).toBeInTheDocument();
    expect(
      screen.getByText(/接続プール上限を拡張して復旧/),
    ).toBeInTheDocument();
  });

  it("resolvedNote が無い既知分類では「当時の対応メモ」を出さない", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: null,
          classification: {
            type: "known",
            source: "SIMILARITY",
            patternId: "similar:ri-1",
            patternName: "類似既知",
            confidence: 0.67,
            matchedConditions: [],
          },
        })}
      />,
    );
    expect(screen.queryByText(/当時の対応メモ/)).not.toBeInTheDocument();
  });

  it("既知パターンには「1秒未満・AI コストゼロ」の経済性対比 1 行を出す（タスク G1）", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: null,
          classification: {
            type: "known",
            source: "EXACT_MATCH",
            patternId: "p-1",
            patternName: "決済APIタイムアウト",
            confidence: 0.9,
            matchedConditions: [],
          },
        })}
      />,
    );
    expect(screen.getByText(/1秒未満・AI コストゼロ/)).toBeInTheDocument();
  });

  it("実測メトリクス付きレポートは冒頭に働きの明細 1 行を出す（タスク G1）", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: makeReport({
            metrics: {
              elapsedMs: 92_000,
              evidenceCounts: {
                logs: 12,
                metrics: 0,
                terraformChanges: 0,
                commits: 10,
                similarIncidents: 5,
              },
            },
          }),
        })}
      />,
    );
    expect(screen.getByText("92秒")).toBeInTheDocument();
    expect(
      screen.getByText(/Cloud Logging・GitHub・類似事例DB を横断し、/),
    ).toBeInTheDocument();
    expect(screen.getByText(/証拠 27 件/)).toBeInTheDocument();
  });

  // タスク E8: 証拠フローダイアグラム・調査タイムライン（報告用フルの視覚再設計）。
  describe("証拠フロー・タイムライン（タスク E8）", () => {
    const metricsReport = makeReport({
      confidence: 0.7,
      metrics: {
        elapsedMs: 143_000,
        evidenceCounts: {
          logs: 4,
          metrics: 0,
          terraformChanges: 0,
          commits: 6,
          similarIncidents: 5,
        },
      },
    });

    it("full＋実測メトリクスでは ⏱1行の代わりに証拠フローダイアグラムを出す", () => {
      render(
        <AlertCardExpanded
          variant="full"
          alert={makeAlert({ report: metricsReport })}
        />,
      );
      expect(screen.getByLabelText("証拠の流れ")).toBeInTheDocument();
      expect(screen.getByText("Cloud Logging")).toBeInTheDocument();
      expect(screen.getByText("類似事例DB")).toBeInTheDocument();
      // G1 の ⏱1行は図に吸収（同じ実測を二度出さない）
      expect(screen.queryByText(/を横断し、/)).not.toBeInTheDocument();
    });

    it("summary 射影では図を出さず ⏱1行のまま（射影境界ノータッチ）", () => {
      render(
        <AlertCardExpanded
          variant="summary"
          alert={makeAlert({ report: metricsReport })}
        />,
      );
      expect(screen.queryByLabelText("証拠の流れ")).not.toBeInTheDocument();
      expect(screen.getByText(/を横断し、/)).toBeInTheDocument();
    });

    it("調査ステップの生エージェント名はタイムラインで人間語化される（タスク E8-B）", () => {
      render(
        <AlertCardExpanded
          variant="full"
          alert={makeAlert({
            report: makeReport({
              investigationSteps: [
                { text: "root_cause_analystで根本原因を分析" },
              ],
            }),
          })}
        />,
      );
      expect(
        screen.getByText("RootCauseAnalystで根本原因を分析"),
      ).toBeInTheDocument();
    });
  });

  it("metrics 無し（旧データ）・fallback では働きの明細を出さない", () => {
    const { rerender } = render(
      <AlertCardExpanded alert={makeAlert({ report: makeReport() })} />,
    );
    expect(screen.queryByText(/を横断し、/)).not.toBeInTheDocument();

    rerender(
      <AlertCardExpanded
        alert={makeAlert({
          report: makeReport({
            isFallback: true,
            metrics: {
              elapsedMs: 60_000,
              evidenceCounts: {
                logs: 1,
                metrics: 0,
                terraformChanges: 0,
                commits: 0,
                similarIncidents: 0,
              },
            },
          }),
        })}
      />,
    );
    expect(screen.queryByText(/を横断し、/)).not.toBeInTheDocument();
  });

  it("fallback は調査ステップを「収集済みの証拠リンク」として summary 射影でも出す（タスク E3）", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({
          report: makeReport({
            isFallback: true,
            suggestedPatternName: "",
            summary: "自動調査に失敗しました。手動での確認が必要です。",
            investigationSteps: [
              {
                text: "コミット abc1234 を確認",
                href: "https://github.com/o/r/commit/abc1234",
                kind: "code",
              },
            ],
          }),
        })}
      />,
    );
    expect(screen.getByText("収集済みの証拠リンク")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /コミット abc1234 を確認/ }),
    ).toBeInTheDocument();
    // 通常レポートの見出し（調査ステップ）としては出さない
    expect(screen.queryByText("調査ステップ")).not.toBeInTheDocument();
  });

  // 分類レビュー（承認/却下/再調査）UI は AlertReviewPanel に分離した
  // （末尾配置の統一・AlertReviewPanel.test.tsx で網羅）。ここでは扱わない。
  it("調査中（ANALYZING かつ既存内容あり）はバナーを出す", () => {
    render(
      <AlertCardExpanded alert={makeAlert({ id: "a-9", status: "ANALYZING" })} />,
    );
    expect(screen.getByText(/調査中です/)).toBeInTheDocument();
  });

  it("レポート未到着（分析中）はプレースホルダを出す", () => {
    render(
      <AlertCardExpanded
        alert={makeAlert({ status: "ANALYZING", report: null })}
      />,
    );
    expect(screen.getByText(/調査中/)).toBeInTheDocument();
  });

  // タスク37: 同一 InvestigationReport を射影違いで出し分ける（要約 vs 報告用フル）。
  describe("射影（variant: summary / full）", () => {
    const fullReport = makeReport({
      impact: {
        fault: "external",
        scope: "決済導線の一部ユーザ",
        scale: "約1,200件・15分継続",
        affectedSubjects: ["payment-api", "checkout"],
        citations: ["log:err-503", "inc:past-42"],
      },
      escalation: {
        team: "external-vendor-liaison",
        owner: "oncall-vendor",
        contact: "#vendor-escalation",
        reason: "外部決済APIの 5xx 急増が根本原因",
        interimWorkaround: "リトライ間隔を延ばし二重課金を防ぐ",
        severityRationale: "売上直結のため high",
        evidenceBundle: ["log:err-503"],
      },
      remediationReview: {
        verdict: "concerns",
        concerns: ["テストが障害経路をカバーしていない"],
        pullRequestUrl: "https://github.com/acme/repo/pull/7",
        citations: ["diff:src/pay.ts"],
      },
    });

    it("summary は要約のみ（impact.scale は出すが調査ステップ/推奨アクション/escalation/review は出さない）", () => {
      render(
        <AlertCardExpanded
          variant="summary"
          alert={makeAlert({ report: fullReport })}
        />,
      );
      // 要約に出るもの: サマリ文＋障害規模
      expect(screen.getByText("未知のレイテンシ急増を検知")).toBeInTheDocument();
      expect(screen.getByText("約1,200件・15分継続")).toBeInTheDocument();
      // 重い証跡・報告用フルは出さない
      expect(screen.queryByText("調査ステップ")).not.toBeInTheDocument();
      expect(screen.queryByText("推奨アクション")).not.toBeInTheDocument();
      expect(screen.queryByText("影響評価")).not.toBeInTheDocument();
      expect(
        screen.queryByText("エスカレーション草案"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("修正PR 自動レビュー")).not.toBeInTheDocument();
    });

    it("full は報告用フル（impact 全項目・escalation・review を全表示）", () => {
      render(
        <AlertCardExpanded
          variant="full"
          alert={makeAlert({ report: fullReport })}
        />,
      );
      // impact 全項目（fault/scale はヒーロー行にも昇格＝2箇所・タスク E8-C）
      expect(screen.getByText("影響評価")).toBeInTheDocument();
      expect(screen.getAllByText(/他責/)).toHaveLength(2);
      expect(screen.getByText("決済導線の一部ユーザ")).toBeInTheDocument();
      expect(screen.getAllByText("約1,200件・15分継続")).toHaveLength(2);
      expect(screen.getByText("payment-api")).toBeInTheDocument();
      // escalation
      expect(screen.getByText("エスカレーション草案")).toBeInTheDocument();
      expect(screen.getByText("external-vendor-liaison")).toBeInTheDocument();
      // review
      expect(screen.getByText("修正PR 自動レビュー")).toBeInTheDocument();
      expect(screen.getByText(/concerns/)).toBeInTheDocument();
      expect(
        screen.getByText("テストが障害経路をカバーしていない"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /レビュー対象 PR/ }),
      ).toHaveAttribute("href", "https://github.com/acme/repo/pull/7");
    });

    it("引用は既定折りたたみ（件数のみ）・クリックで種別レーン展開（タスク E8-D）", async () => {
      render(
        <AlertCardExpanded
          variant="full"
          alert={makeAlert({ report: fullReport })}
        />,
      );
      // 折りたたみ中: 件数トグルは見えるが生引用チップは出さない
      const toggle = screen.getByRole("button", {
        name: /算定根拠（引用）.*2.*件/,
      });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("inc:past-42")).not.toBeInTheDocument();

      await userEvent.click(toggle);
      // 展開後: 種別レーン（過去事例）にグルーピングされて出る
      expect(screen.getByText("inc:past-42")).toBeInTheDocument();
      expect(screen.getByText("log:err-503")).toBeInTheDocument();
      expect(screen.getByText("過去事例")).toBeInTheDocument();
    });

    it("impact/escalation/review の無い旧 Alert でも両 variant で壊れない", () => {
      const plain = makeReport(); // impact 等を持たない既定レポート
      const { rerender } = render(
        <AlertCardExpanded variant="summary" alert={makeAlert({ report: plain })} />,
      );
      expect(screen.getByText("未知のレイテンシ急増を検知")).toBeInTheDocument();
      expect(screen.queryByText("障害規模")).not.toBeInTheDocument();
      expect(screen.queryByText("影響評価")).not.toBeInTheDocument();

      rerender(
        <AlertCardExpanded variant="full" alert={makeAlert({ report: plain })} />,
      );
      // full でも欠落フィールドのパネルは描画しない（調査ステップは出る）
      expect(screen.getByText("調査ステップ")).toBeInTheDocument();
      expect(screen.queryByText("影響評価")).not.toBeInTheDocument();
      expect(
        screen.queryByText("エスカレーション草案"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("修正PR 自動レビュー")).not.toBeInTheDocument();
    });
  });
});
