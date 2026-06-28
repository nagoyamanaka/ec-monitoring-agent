import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EvidencePanel } from "./EvidencePanel";
import type { EvidenceApi } from "../infrastructure/evidenceApi";
import type { EvidenceView } from "../domain/EvidenceView";
import { makeAlert } from "../test-support/alertFixture";

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

  it("証拠が空なら見つからなかった旨を出す", async () => {
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
        screen.getByText("証拠は見つかりませんでした。"),
      ).toBeInTheDocument(),
    );
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
