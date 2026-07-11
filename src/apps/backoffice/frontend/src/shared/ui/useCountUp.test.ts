import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCountUp } from "./useCountUp";

describe("useCountUp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("非ブラウザ相当（matchMedia 無し）では即・目標値を返す（テスト/SSR 安全弁）", () => {
    // jsdom 既定では window.matchMedia が未定義＝アニメーションせず最終値をそのまま出す。
    const { result } = renderHook(() => useCountUp(42));
    expect(result.current).toBe(42);
  });

  it("reduced-motion では即・目標値を返す", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true }) as unknown as typeof matchMedia,
    );
    const { result } = renderHook(() => useCountUp(7));
    expect(result.current).toBe(7);
  });

  it("アニメーション時は 0 から始まり、rAF 完了で目標値へ到達する", () => {
    vi.stubGlobal(
      "matchMedia",
      vi
        .fn()
        .mockReturnValue({ matches: false }) as unknown as typeof matchMedia,
    );
    // performance.now と requestAnimationFrame を制御して決定論的に進める。
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        callbacks.push(cb);
        return callbacks.length;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const { result } = renderHook(() => useCountUp(100, { durationMs: 700 }));
    // 初回レンダーはアニメーション開始値 0。
    expect(result.current).toBe(0);

    // duration を超えて時計を進め、キューされた rAF を順に処理する。
    act(() => {
      clock = 1000;
      while (callbacks.length > 0) {
        const cb = callbacks.shift()!;
        cb(clock);
      }
    });
    expect(result.current).toBe(100);
  });
});
