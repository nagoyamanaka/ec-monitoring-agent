import "@testing-library/jest-dom/vitest";

// jsdom は ResizeObserver を持たない。tremor のチャート（DonutChart 等）が購読するため、
// 描画すると ReferenceError でサブツリーごと落ちる。レイアウトの実測はテストの関心事では
// ないので、購読だけ受けて何もしない実装を置く（jsdom の能力ギャップの穴埋め）。
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
