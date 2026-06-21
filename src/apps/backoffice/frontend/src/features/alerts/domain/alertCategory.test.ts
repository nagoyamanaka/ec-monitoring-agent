import { describe, expect, it } from "vitest";
import { categoryInfo } from "./alertCategory";

describe("categoryInfo", () => {
  it("カテゴリを人間語ラベル＋説明へ変換する", () => {
    expect(categoryInfo("APPLICATION").label).toBe("アプリ層");
    expect(categoryInfo("SECURITY").label).toBe("セキュリティ");
    expect(categoryInfo("INFRASTRUCTURE").description).toMatch(/基盤/);
  });
});
