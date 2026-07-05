import { describe, expect, it } from "vitest";
import { classificationEvidence } from "./classificationEvidence";

describe("classificationEvidence", () => {
  it("等価一致は期待値と実値を1つの値に畳む（同じ文字列を2度出さない）", () => {
    const view = classificationEvidence([
      {
        field: "eventName",
        expectedValue: "ec.db.connection_pool_exhausted",
        actualValue: "ec.db.connection_pool_exhausted",
      },
    ]);
    expect(view.rows).toEqual([
      {
        label: "受信イベント名",
        raw: "eventName",
        value: "ec.db.connection_pool_exhausted",
      },
    ]);
    expect(view.similarityGate).toBeUndefined();
  });

  it("similarity の条件式（>=しきい値）は根拠テーブルでなくゲートとして分離し百分率で出す", () => {
    const view = classificationEvidence([
      {
        field: "eventName",
        expectedValue: "ec.db.connection_pool_exhausted",
        actualValue: "ec.db.connection_pool_exhausted",
      },
      { field: "similarity", expectedValue: ">=0.6", actualValue: 0.67 },
    ]);
    expect(view.rows).toHaveLength(1);
    expect(view.similarityGate).toEqual({
      raw: "similarity",
      actualLabel: "67%",
      thresholdLabel: "60%",
    });
  });

  it("類似分類で過去事例と今回の値が異なる場合だけ期待値を併記する（防御表示）", () => {
    const view = classificationEvidence([
      {
        field: "eventName",
        expectedValue: "ec.db.pool_exhausted",
        actualValue: "ec.db.connection_pool_exhausted",
      },
    ]);
    expect(view.rows).toEqual([
      {
        label: "受信イベント名",
        raw: "eventName",
        value: "ec.db.connection_pool_exhausted",
        expected: "ec.db.pool_exhausted",
      },
    ]);
  });

  it("payload.* は人間語ラベル＋生フィールド名、数値の非整数は2桁丸め", () => {
    const view = classificationEvidence([
      { field: "payload.errorRate", expectedValue: 0.5, actualValue: 0.5 },
    ]);
    expect(view.rows).toEqual([
      { label: "受信ペイロード errorRate", raw: "payload.errorRate", value: "0.50" },
    ]);
  });

  it("形が想定外の similarity は捏造せず通常行として出す（旧データ互換）", () => {
    const view = classificationEvidence([
      { field: "similarity", expectedValue: 0.6, actualValue: 0.67 },
    ]);
    expect(view.similarityGate).toBeUndefined();
    expect(view.rows).toEqual([
      {
        label: "類似度スコア",
        raw: "similarity",
        value: "0.67",
        expected: "0.60",
      },
    ]);
  });
});
