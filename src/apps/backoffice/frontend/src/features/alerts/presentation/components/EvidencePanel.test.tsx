import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EvidencePanel } from "./EvidencePanel";
import type { EvidenceApi } from "../../infrastructure/evidenceApi";
import type { EvidenceView } from "../../domain/EvidenceView";
import { makeAlert, makeReport } from "../../test-support/alertFixture";

const FULL_EVIDENCE: EvidenceView = {
  appLogs: [
    {
      timestamp: "2026-01-01T00:00:00.000Z",
      severity: "ERROR",
      message: "pool exhausted",
      resource: "ec-backend",
    },
  ],
  terraformDiff: {
    resourceChanges: [
      {
        address: "aws_db_instance.main",
        action: "update",
        attributeDeltas: [{ key: "max_connections", before: "100", after: "20" }],
      },
    ],
    appliedAt: "2026-01-01T00:00:00.000Z",
    commitSha: "deadbeefcafe1234",
    url: null,
    changedResources: ["aws_db_instance.main"],
    summary: "max_connections を縮小",
  },
  recentCommits: [
    {
      sha: "0123456789abcdef",
      shortSha: "0123456",
      message: "tune pool",
      author: "alice",
      committedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  metrics: [
    {
      metricType: "run.googleapis.com/container/cpu/utilizations",
      displayName: "CPU 使用率",
      unit: "ratio",
      latest: 0.42,
      max: 0.95,
      points: 3,
    },
  ],
  collectedAt: "2026-01-01T00:00:01.000Z",
};

function fakeApi(evidence: EvidenceView = FULL_EVIDENCE): EvidenceApi {
  return { getEvidence: vi.fn(async () => evidence) };
}

describe("EvidencePanel", () => {
  it("done（OPEN）で3ソースを積み上げ表示する", async () => {
    render(
      <EvidencePanel
        api={fakeApi()}
        alert={makeAlert({ id: "a-1", status: "OPEN" })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Cloud Logging")).toBeInTheDocument(),
    );
    expect(screen.getByText("Terraform")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Cloud Monitoring")).toBeInTheDocument();
    expect(screen.getByText("pool exhausted")).toBeInTheDocument();
    expect(screen.getByText("0123456")).toBeInTheDocument();
    expect(screen.getByText("aws_db_instance.main")).toBeInTheDocument();
    // リソース単位の before→after（原因分析の決定打）が表示される。
    expect(screen.getByText("max_connections:")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    // メトリクス: ratio は % 整形（latest 0.42 → 42.0%）
    expect(screen.getByText("CPU 使用率")).toBeInTheDocument();
    expect(screen.getByText("42.0%")).toBeInTheDocument();
  });

  it("ANALYZING 中は解析インジケータを出し、証拠は fetch しない", async () => {
    const api = fakeApi();
    render(
      <EvidencePanel
        api={api}
        alert={makeAlert({ id: "a-1", status: "ANALYZING" })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/AI が証拠を解析しています/)).toBeInTheDocument(),
    );
    expect(api.getEvidence).not.toHaveBeenCalled();
  });

  it("証拠が空なら引用された証拠が無い旨を出す", async () => {
    const empty: EvidenceView = {
      appLogs: [],
      terraformDiff: null,
      recentCommits: [],
      metrics: [],
      collectedAt: "2026-01-01T00:00:01.000Z",
    };
    render(
      <EvidencePanel
        api={fakeApi(empty)}
        alert={makeAlert({ id: "a-1", status: "OPEN" })}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          "原因の根拠として引用されたインフラ証拠（ログ・メトリクス・Terraform・コミット）はありませんでした。",
        ),
      ).toBeInTheDocument(),
    );
  });

  it("件数記録があれば台帳グリッドを出し、空でも文の言い訳に落ちない（C-3）", async () => {
    const empty: EvidenceView = {
      appLogs: [],
      terraformDiff: null,
      recentCommits: [],
      metrics: [],
      collectedAt: "2026-01-01T00:00:01.000Z",
    };
    render(
      <EvidencePanel
        api={fakeApi(empty)}
        alert={makeAlert({
          id: "a-1",
          status: "OPEN",
          report: makeReport({
            metrics: {
              elapsedMs: 92000,
              evidenceCounts: {
                logs: 0,
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

    await waitFor(() => expect(screen.getByText("過去事例")).toBeInTheDocument());
    // APPLICATION の調査対象（ログ・コミット・過去事例）が 0 のまま見えている
    // （探した結果ゼロ＝情報）。調査しないメトリクス/Terraform はセル自体を出さない。
    expect(screen.getAllByText("0")).toHaveLength(3);
    expect(screen.queryByText("メトリクス")).not.toBeInTheDocument();
    expect(
      screen.getByText("0 のカテゴリも調査済み（該当証拠なし）"),
    ).toBeInTheDocument();
    // 旧来の2文フォールバックはグリッドに置き換わる。
    expect(
      screen.queryByText(/引用されたインフラ証拠/),
    ).not.toBeInTheDocument();
  });

  it("グリッドの >0 セルはクリックで該当セクションへスクロールする", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <EvidencePanel
        api={fakeApi()}
        alert={makeAlert({
          id: "a-1",
          status: "OPEN",
          report: makeReport({
            metrics: {
              elapsedMs: 92000,
              evidenceCounts: {
                logs: 1,
                metrics: 1,
                terraformChanges: 1,
                commits: 1,
                similarIncidents: 0,
              },
            },
          }),
        })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Cloud Logging")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Terraform/ }));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("SECURITY は Trivy 件数をスキャンセルで台帳に載せ、クリックで CVE セクションへスクロールする", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const empty: EvidenceView = {
      appLogs: [],
      terraformDiff: null,
      recentCommits: [],
      metrics: [],
      collectedAt: "2026-01-01T00:00:01.000Z",
    };
    render(
      <EvidencePanel
        api={fakeApi(empty)}
        alert={makeAlert({
          id: "a-1",
          status: "OPEN",
          category: "SECURITY",
          securityFindings: [
            {
              cveId: "CVE-2021-3807",
              severity: "CRITICAL",
              package: "ansi-regex",
              version: "3.0.0",
              fixedVersion: "5.0.1",
              nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2021-3807",
            },
          ],
          report: makeReport({
            metrics: {
              elapsedMs: 92000,
              evidenceCounts: {
                logs: 0,
                metrics: 0,
                terraformChanges: 0,
                commits: 10,
                similarIncidents: 0,
              },
            },
          }),
        })}
      />,
    );
    await waitFor(() => expect(screen.getByText("スキャン")).toBeInTheDocument());
    // SECURITY で調査しないメトリクス/Terraform のセルは出さない。
    expect(screen.queryByText("メトリクス")).not.toBeInTheDocument();
    expect(screen.queryByText("Terraform")).not.toBeInTheDocument();
    // スキャンセルは検知 payload の CVE 実測件数を出し、クリックで実物へ飛べる。
    fireEvent.click(screen.getByRole("button", { name: /スキャン/ }));
    expect(scrollIntoView).toHaveBeenCalled();
    // コミット10件は収集済みだが引用ゼロ（CitedCommitFilter で実物なし）＝
    // グレー格下げ・クリック不可・引用規律の但し書きを出す。
    expect(
      screen.queryByRole("button", { name: /コミット/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("10")).toHaveClass("text-slate-400");
    expect(
      screen.getByText("収集しても原因に引用しなかった証拠は表示しません"),
    ).toBeInTheDocument();
  });

  it("過去事例は検索でヒットしても「過去の同型事例」節へ出ない（引用なし）ならグレー格下げ", async () => {
    const empty: EvidenceView = {
      appLogs: [],
      terraformDiff: null,
      recentCommits: [],
      metrics: [],
      collectedAt: "2026-01-01T00:00:01.000Z",
    };
    render(
      <EvidencePanel
        api={fakeApi(empty)}
        // 未知分類・corpus 空＝collectPastIncidentRefs が実物ゼロ。台帳の 1 は
        // 「類似事例DBを調べてヒットしたが原因へ引用しなかった」の実測として残す。
        alert={makeAlert({
          id: "a-1",
          status: "OPEN",
          report: makeReport({
            metrics: {
              elapsedMs: 92000,
              evidenceCounts: {
                logs: 0,
                metrics: 0,
                terraformChanges: 0,
                commits: 0,
                similarIncidents: 1,
              },
            },
          }),
        })}
        corpus={[]}
      />,
    );
    await waitFor(() => expect(screen.getByText("過去事例")).toBeInTheDocument());
    // 実物が本パネル外にも出ない＝コミットと同じ引用規律でグレー・クリック不可。
    expect(
      screen.queryByRole("button", { name: /過去事例/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1")).toHaveClass("text-slate-400");
    expect(
      screen.getByText("収集しても原因に引用しなかった証拠は表示しません"),
    ).toBeInTheDocument();
  });

  it("コミット証拠は既定3件に畳み、「残り N 件を表示」で全件展開する", async () => {
    const manyCommits: EvidenceView = {
      ...FULL_EVIDENCE,
      recentCommits: Array.from({ length: 5 }, (_, i) => ({
        sha: `sha-${i}`,
        shortSha: `sha-${i}`,
        message: `commit ${i}`,
        author: "alice",
        committedAt: "2026-01-01T00:00:00.000Z",
      })),
    };
    render(
      <EvidencePanel
        api={fakeApi(manyCommits)}
        alert={makeAlert({ id: "a-1", status: "OPEN" })}
      />,
    );
    await waitFor(() => expect(screen.getByText("GitHub")).toBeInTheDocument());
    expect(screen.getByText("commit 2")).toBeInTheDocument();
    expect(screen.queryByText("commit 3")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "残り 2 件のコミットを表示" }),
    );
    expect(screen.getByText("commit 3")).toBeInTheDocument();
    expect(screen.getByText("commit 4")).toBeInTheDocument();
  });

  it("SECURITY 検知の CVE を先頭セクションで出し、NVD への実在リンクを張る", async () => {
    const empty: EvidenceView = {
      appLogs: [],
      terraformDiff: null,
      recentCommits: [],
      metrics: [],
      collectedAt: "2026-01-01T00:00:01.000Z",
    };
    render(
      <EvidencePanel
        api={fakeApi(empty)}
        alert={makeAlert({
          id: "a-1",
          status: "OPEN",
          category: "SECURITY",
          securityFindings: [
            {
              cveId: "CVE-2021-3807",
              severity: "CRITICAL",
              package: "ansi-regex",
              version: "3.0.0",
              fixedVersion: "5.0.1",
              nvdUrl: "https://nvd.nist.gov/vuln/detail/CVE-2021-3807",
            },
          ],
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Trivy (CI スキャン)")).toBeInTheDocument(),
    );
    const link = screen.getByRole("link", { name: "CVE-2021-3807" });
    expect(link).toHaveAttribute(
      "href",
      "https://nvd.nist.gov/vuln/detail/CVE-2021-3807",
    );
    // インフラ証拠ゼロでも CVE があれば空表示にしない。
    expect(
      screen.queryByText(/引用されたインフラ証拠/),
    ).not.toBeInTheDocument();
  });

  it("terraform 証拠に由来 PR リンクがあれば「変更 PR を開く」を出す", async () => {
    const withUrl: EvidenceView = {
      ...FULL_EVIDENCE,
      terraformDiff: {
        ...FULL_EVIDENCE.terraformDiff!,
        url: "https://github.com/o/r/pull/30",
      },
    };
    render(
      <EvidencePanel
        api={fakeApi(withUrl)}
        alert={makeAlert({ id: "a-1", status: "OPEN" })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Terraform")).toBeInTheDocument(),
    );
    const link = screen.getByRole("link", { name: "変更 PR を開く →" });
    expect(link).toHaveAttribute("href", "https://github.com/o/r/pull/30");
  });

  it("由来 PR リンクが無い terraform 証拠は従来通り非リンク表示", async () => {
    render(
      <EvidencePanel
        api={fakeApi()}
        alert={makeAlert({ id: "a-1", status: "OPEN" })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Terraform")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("link", { name: "変更 PR を開く →" }),
    ).not.toBeInTheDocument();
  });

  it("取得失敗時はエラー表示する", async () => {
    const api: EvidenceApi = {
      getEvidence: vi.fn().mockRejectedValue(new Error("network")),
    };
    render(
      <EvidencePanel
        api={api}
        alert={makeAlert({ id: "a-1", status: "OPEN" })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/証拠の取得に失敗しました/)).toBeInTheDocument(),
    );
  });
});
