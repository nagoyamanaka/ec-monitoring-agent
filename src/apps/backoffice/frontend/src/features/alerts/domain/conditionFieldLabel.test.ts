import { describe, expect, it } from "vitest";
import { describeConditionField } from "./conditionFieldLabel";

describe("describeConditionField", () => {
  it("eventName は「受信イベント名」＋生フィールド名の副表示", () => {
    expect(describeConditionField("eventName")).toEqual({
      label: "受信イベント名",
      raw: "eventName",
    });
  });

  it("similarity は「類似度スコア」", () => {
    expect(describeConditionField("similarity")).toEqual({
      label: "類似度スコア",
      raw: "similarity",
    });
  });

  it("payload.* はキー名を出す（受信ペイロードの条件一致）", () => {
    expect(describeConditionField("payload.errorCode")).toEqual({
      label: "受信ペイロード errorCode",
      raw: "payload.errorCode",
    });
  });

  it("未知フィールドは生の名前をそのまま主表示（副表示なし＝訳を捏造しない）", () => {
    expect(describeConditionField("mystery_field")).toEqual({
      label: "mystery_field",
    });
  });
});
