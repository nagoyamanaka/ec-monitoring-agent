import { describe, expect, it } from "vitest";
import {
  hasPullRequest,
  isRemediationPending,
  isRemediationUnstarted,
  toRemediationView,
  type RemediationResponsePrimitives,
} from "./RemediationView";

function makeWire(
  overrides: Partial<RemediationResponsePrimitives> = {},
): RemediationResponsePrimitives {
  return {
    alertId: "a-1",
    status: "none",
    pullRequestUrl: null,
    vulnerabilityCount: 0,
    reason: null,
    createdAt: null,
    ...overrides,
  };
}

describe("toRemediationView", () => {
  it("wire をそのまま View へ写像する", () => {
    const view = toRemediationView(
      makeWire({
        status: "drafted",
        pullRequestUrl: "https://github.com/x/y/pull/1",
        vulnerabilityCount: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(view).toMatchObject({
      status: "drafted",
      pullRequestUrl: "https://github.com/x/y/pull/1",
      vulnerabilityCount: 2,
    });
  });
});

describe("status 述語", () => {
  it("none は未起票", () => {
    expect(isRemediationUnstarted(toRemediationView(makeWire()))).toBe(true);
    expect(
      isRemediationUnstarted(
        toRemediationView(makeWire({ status: "drafted" })),
      ),
    ).toBe(false);
  });

  it("dispatched はポーリング対象", () => {
    expect(
      isRemediationPending(toRemediationView(makeWire({ status: "dispatched" }))),
    ).toBe(true);
    expect(
      isRemediationPending(toRemediationView(makeWire({ status: "drafted" }))),
    ).toBe(false);
  });

  it("PR リンクは drafted かつ URL ありのときだけ", () => {
    expect(
      hasPullRequest(
        toRemediationView(
          makeWire({ status: "drafted", pullRequestUrl: "https://x/pr/1" }),
        ),
      ),
    ).toBe(true);
    // drafted でも URL 無しなら false（保険）
    expect(
      hasPullRequest(toRemediationView(makeWire({ status: "drafted" }))),
    ).toBe(false);
    // dispatched は URL 無し
    expect(
      hasPullRequest(toRemediationView(makeWire({ status: "dispatched" }))),
    ).toBe(false);
  });
});
