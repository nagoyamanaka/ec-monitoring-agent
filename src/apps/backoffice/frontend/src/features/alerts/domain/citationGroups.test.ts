import { describe, expect, it } from "vitest";
import { groupCitations } from "./citationGroups";

describe("groupCitations", () => {
  it("プレフィックスでソース種別に分類し、語り順（観測→変更→記憶→その他）で返す", () => {
    const groups = groupCitations([
      "inc:past-42",
      'appLogs: message: "Deadlock found"',
      "terraform: max_connections 100→40",
      "occurrenceCount: 4",
      "metrics: error_rate 12%",
    ]);

    expect(groups.map((g) => g.key)).toEqual([
      "observation",
      "change",
      "memory",
    ]);
    expect(groups[0].items).toEqual([
      'appLogs: message: "Deadlock found"',
      "occurrenceCount: 4",
      "metrics: error_rate 12%",
    ]);
    expect(groups[1].items).toEqual(["terraform: max_connections 100→40"]);
    expect(groups[2].items).toEqual(["inc:past-42"]);
  });

  it("未知プレフィックス・プレフィックス無しは「その他」へ（落とさない）", () => {
    const groups = groupCitations(["謎の引用そのまま", "custom: something"]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("other");
    expect(groups[0].items).toEqual(["謎の引用そのまま", "custom: something"]);
  });

  it("空配列は空のまま", () => {
    expect(groupCitations([])).toEqual([]);
  });
});
