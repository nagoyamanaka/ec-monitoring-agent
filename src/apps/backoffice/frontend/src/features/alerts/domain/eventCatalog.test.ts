import { describe, expect, it } from "vitest";
import { eventInfo, eventTitle } from "./eventCatalog";

describe("eventCatalog", () => {
  it("登録済みは人間語タイトル＋説明を返す", () => {
    expect(eventTitle("ec.payment.timeout")).toBe("決済タイムアウト");
    expect(eventInfo("ec.payment.timeout")?.description).toMatch(/決済 API/);
  });

  it("未登録は eventInfo=null・eventTitle=eventName（フォールバック）", () => {
    expect(eventInfo("ec.unknown.thing")).toBeNull();
    expect(eventTitle("ec.unknown.thing")).toBe("ec.unknown.thing");
  });
});
