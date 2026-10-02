import { describe, it, expect } from "vitest";
import {
  EvidenceSnapshotIntegrityError,
  captureEvidenceSnapshot,
  hashSnapshotContent,
  restoreForecastContext,
} from "./EvidenceSnapshot.js";
import { ForecastContext } from "./ForecastContext.js";
import { ForecastSignalKind } from "./ForecastSignal.js";

const context = (): ForecastContext => ({
  horizon: "今週末",
  signals: [
    {
      id: "plan-1",
      kind: ForecastSignalKind.FUTURE_CHANGE,
      subject: "db_connection_pool",
      when: "未適用",
      desc: "VM を e2-standard-2→e2-small に縮小",
      source: "terraform.plan#83",
      url: "https://github.com/nagoyamanaka/ec-monitoring-agent/pull/83",
    },
    {
      id: "sch-1",
      kind: ForecastSignalKind.SCHEDULE,
      subject: "checkout",
      when: "土 20:00-23:00",
      desc: "週末セール",
      source: "schedule.seed",
    },
  ],
});

const capturedAt = new Date("2026-09-26T00:00:00.000Z");

describe("EvidenceSnapshot", () => {
  it("同じ入力なら同じ snapshotId（capturedAt はハッシュに入れない）", () => {
    const a = captureEvidenceSnapshot(context(), capturedAt);
    const b = captureEvidenceSnapshot(context(), new Date("2026-09-27T00:00:00.000Z"));
    expect(a.snapshotId).toMatch(/^[0-9a-f]{64}$/);
    expect(b.snapshotId).toBe(a.snapshotId);
  });

  it("シグナルのキーの書き順・url の undefined は snapshotId を揺らさない", () => {
    const original = context();
    const reordered: ForecastContext = {
      signals: original.signals.map((s) => ({
        url: s.url,
        source: s.source,
        desc: s.desc,
        when: s.when,
        subject: s.subject,
        kind: s.kind,
        id: s.id,
      })),
      horizon: original.horizon,
    };
    expect(captureEvidenceSnapshot(reordered, capturedAt).snapshotId).toBe(
      captureEvidenceSnapshot(original, capturedAt).snapshotId,
    );
  });

  it("入力が1文字でも違えば別の snapshotId（並び順も入力の一部）", () => {
    const base = captureEvidenceSnapshot(context(), capturedAt).snapshotId;
    const changedDesc = context();
    changedDesc.signals[1] = { ...changedDesc.signals[1], desc: "週末セール!" };
    const swapped = context();
    swapped.signals.reverse();

    expect(captureEvidenceSnapshot(changedDesc, capturedAt).snapshotId).not.toBe(base);
    expect(captureEvidenceSnapshot(swapped, capturedAt).snapshotId).not.toBe(base);
  });

  it("復元すると予報器に渡した入力と同じものに戻る", () => {
    const snapshot = captureEvidenceSnapshot(context(), capturedAt);
    expect(restoreForecastContext(snapshot)).toEqual(context());
  });

  it("同じ snapshot を2回読むと、入力バイト列のハッシュが一致し snapshotId とも一致する", () => {
    const snapshot = captureEvidenceSnapshot(context(), capturedAt);
    const first = hashSnapshotContent(snapshot.content);
    const second = hashSnapshotContent(snapshot.content);
    expect(first).toBe(second);
    expect(first).toBe(snapshot.snapshotId);
  });

  it("保存後に内容が書き換わった snapshot は復元を拒む（黙って別の入力で再実行しない）", () => {
    const snapshot = captureEvidenceSnapshot(context(), capturedAt);
    const tampered = { ...snapshot, content: snapshot.content.replace("週末セール", "平日") };
    expect(() => restoreForecastContext(tampered)).toThrow(EvidenceSnapshotIntegrityError);
  });
});
