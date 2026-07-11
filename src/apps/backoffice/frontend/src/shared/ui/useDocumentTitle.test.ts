import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDocumentTitle } from "./useDocumentTitle";

describe("useDocumentTitle", () => {
  afterEach(() => {
    document.title = "";
  });

  it("`${page} · Kizashi` を document.title に設定する", () => {
    renderHook(() => useDocumentTitle("アラート"));
    expect(document.title).toBe("アラート · Kizashi");
  });

  it("page が空なら接尾辞だけ（空 page で「 · Kizashi」を出さない）", () => {
    renderHook(() => useDocumentTitle(""));
    expect(document.title).toBe("Kizashi");
  });
});
