import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  AlertDetailSkeleton,
  AlertRowSkeleton,
  RiskCardSkeleton,
  SkeletonBar,
  StatusLineSkeleton,
} from "./Skeleton";

describe("Skeleton", () => {
  it("脈動は reduced-motion で止まる（motion-reduce:animate-none）", () => {
    const { container } = render(<SkeletonBar />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.className).toContain("animate-pulse");
    expect(bar.className).toContain("motion-reduce:animate-none");
  });

  it("骨格は視覚専用（aria-hidden）で読み上げから隠れる", () => {
    for (const node of [
      <RiskCardSkeleton key="risk" />,
      <AlertRowSkeleton key="row" />,
      <AlertDetailSkeleton key="detail" />,
      <StatusLineSkeleton key="status" />,
    ]) {
      const { container } = render(node);
      expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    }
  });

  it("到着レイアウトのシルエットを象る（のっぺり単一ブロックではない）", () => {
    // リスクカード＝見出し＋ミニフロー帯で複数のバーを持つ。
    const { container } = render(<RiskCardSkeleton />);
    expect(
      container.querySelectorAll(".animate-pulse").length,
    ).toBeGreaterThan(1);
  });
});
