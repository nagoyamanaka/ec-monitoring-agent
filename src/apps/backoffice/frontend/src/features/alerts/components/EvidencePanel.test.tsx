import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EvidencePanel } from "./EvidencePanel";
import type { EvidenceApi } from "../infrastructure/evidenceApi";
import type {
  EvidenceView,
  InvestigationStatus,
} from "../domain/EvidenceView";

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
  collectedAt: "2026-01-01T00:00:01.000Z",
};

function fakeApi(
  status: InvestigationStatus,
  evidence: EvidenceView = FULL_EVIDENCE,
): EvidenceApi {
  return {
    getInvestigationStatus: vi.fn(async (alertId: string) => ({
      alertId,
      status,
    })),
    getEvidence: vi.fn(async () => evidence),
  };
}

describe("EvidencePanel", () => {
  it("done で3ソース（Cloud Logging/Terraform/GitHub）を積み上げ表示する", async () => {
    render(<EvidencePanel api={fakeApi("done")} alertId="a-1" />);

    await waitFor(() =>
      expect(screen.getByText("Cloud Logging")).toBeInTheDocument(),
    );
    expect(screen.getByText("Terraform")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("pool exhausted")).toBeInTheDocument();
    expect(screen.getByText("0123456")).toBeInTheDocument();
    expect(screen.getByText("aws_db_instance.main")).toBeInTheDocument();
  });

  it("analyzing 中は収集インジケータを出し、証拠は出さない", async () => {
    const api = fakeApi("analyzing");
    render(<EvidencePanel api={api} alertId="a-1" pollIntervalMs={10_000} />);

    await waitFor(() =>
      expect(
        screen.getByText(/AI が証拠を解析しています/),
      ).toBeInTheDocument(),
    );
    expect(api.getEvidence).not.toHaveBeenCalled();
  });

  it("証拠が空なら見つからなかった旨を出す", async () => {
    const empty: EvidenceView = {
      appLogs: [],
      terraformDiff: null,
      recentCommits: [],
      collectedAt: "2026-01-01T00:00:01.000Z",
    };
    render(<EvidencePanel api={fakeApi("done", empty)} alertId="a-1" />);

    await waitFor(() =>
      expect(
        screen.getByText("証拠は見つかりませんでした。"),
      ).toBeInTheDocument(),
    );
  });

  it("取得失敗時はエラー表示する", async () => {
    const api: EvidenceApi = {
      getInvestigationStatus: vi.fn().mockRejectedValue(new Error("network")),
      getEvidence: vi.fn(),
    };
    render(<EvidencePanel api={api} alertId="a-1" />);

    await waitFor(() =>
      expect(screen.getByText(/証拠の取得に失敗しました/)).toBeInTheDocument(),
    );
  });
});
