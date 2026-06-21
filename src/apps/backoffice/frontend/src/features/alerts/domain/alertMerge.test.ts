import { describe, expect, it } from "vitest";
import type { AlertView } from "./AlertView";
import { mergeAlert, mergeAlerts } from "./alertMerge";

/** テスト用の最小 AlertView ビルダ（マージ判定に効く id/status のみ可変）。 */
function alert(
  id: string,
  overrides: Partial<AlertView> = {},
): AlertView {
  return {
    id,
    status: "OPEN",
    severity: "WARNING",
    category: "APPLICATION",
    source: "ec-backend",
    eventName: "evt",
    occurredOn: "2026-06-21T00:00:00.000Z",
    classification: { type: "unknown", confidence: null },
    report: null,
    feedback: null,
    correctFeedbackCount: 0,
    createdAt: "2026-06-21T00:00:00.000Z",
    updatedAt: "2026-06-21T00:00:00.000Z",
    ...overrides,
  };
}

describe("mergeAlert", () => {
  it("未知の id は先頭に積む（最新が上）", () => {
    const list = [alert("a"), alert("b")];
    const result = mergeAlert(list, alert("c"));
    expect(result.map((a) => a.id)).toEqual(["c", "a", "b"]);
  });

  it("同一 id は位置を保ったまま差し替える（ANALYZING→OPEN 遷移）", () => {
    const list = [
      alert("a"),
      alert("b", { status: "ANALYZING" }),
      alert("c"),
    ];
    const result = mergeAlert(list, alert("b", { status: "OPEN" }));
    expect(result.map((a) => a.id)).toEqual(["a", "b", "c"]);
    expect(result[1].status).toBe("OPEN");
  });

  it("元の配列を破壊しない", () => {
    const list = [alert("a", { status: "ANALYZING" })];
    const snapshot = list[0];
    mergeAlert(list, alert("a", { status: "OPEN" }));
    expect(list[0]).toBe(snapshot);
    expect(list[0].status).toBe("ANALYZING");
  });

  it("空リストへは単純に追加する", () => {
    const result = mergeAlert([], alert("a"));
    expect(result.map((a) => a.id)).toEqual(["a"]);
  });
});

describe("mergeAlerts", () => {
  it("base を土台に stream 分を畳み込む（同 id は置換・新規は先頭）", () => {
    const base = [alert("a", { status: "ANALYZING" }), alert("b")];
    const streamed = [alert("a", { status: "OPEN" }), alert("c")];
    const result = mergeAlerts(base, streamed);

    // c は新規で先頭、a は置換され OPEN、b は据え置き
    expect(result.map((a) => a.id)).toEqual(["c", "a", "b"]);
    expect(result.find((a) => a.id === "a")?.status).toBe("OPEN");
  });

  it("stream が空なら base のコピーを返す", () => {
    const base = [alert("a"), alert("b")];
    const result = mergeAlerts(base, []);
    expect(result.map((a) => a.id)).toEqual(["a", "b"]);
    expect(result).not.toBe(base);
  });
});
