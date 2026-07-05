import { describe, expect, it } from "vitest";
import {
  groupCitations,
  groupCitationRefs,
  countVerified,
  CITATION_KIND_LABEL,
} from "./citationGroups";
import type { CitationRefView } from "./InvestigationReportView";

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

describe("groupCitationRefs", () => {
  const refs: CitationRefView[] = [
    { value: "PROMOTED_EC.DB.CONNECTION_POOL_EXHAUSTED", kind: "pattern" },
    { value: "ec.db.connection_pool_exhausted", kind: "event" },
    {
      value: "e12b655",
      kind: "commit",
      href: "https://github.com/acme/ec/commit/e12b655",
    },
    { value: "appLogs: 謎のログ" },
  ];

  it("照合済み kind でレーン分けし、未照合は「その他」へ（プレフィックス推測は使わない）", () => {
    const groups = groupCitationRefs(refs);
    expect(groups.map((g) => g.key)).toEqual([
      "observation",
      "change",
      "memory",
      "other",
    ]);
    expect(groups[0].items.map((r) => r.value)).toEqual([
      "ec.db.connection_pool_exhausted",
    ]);
    expect(groups[1].items[0].href).toContain("/commit/e12b655");
    expect(groups[2].items.map((r) => r.kind)).toEqual(["pattern"]);
    expect(groups[3].items.map((r) => r.value)).toEqual(["appLogs: 謎のログ"]);
  });

  it("countVerified は kind 付き（実在照合済み）だけを数える", () => {
    expect(countVerified(refs)).toBe(3);
    expect(countVerified([])).toBe(0);
  });

  it("全種別に表示ラベルがある（何のパラメータかを常に言える）", () => {
    for (const label of Object.values(CITATION_KIND_LABEL)) {
      expect(label).not.toBe("");
    }
    expect(CITATION_KIND_LABEL.event).toBe("受信イベント名");
  });
});
