import { describe, it, expect } from "vitest";
import { lexicalSimilarity } from "./lexicalSimilarity.js";

describe("lexicalSimilarity", () => {
  it("同一テキストは 1.0", () => {
    expect(lexicalSimilarity("ec.payment.timeout x=1", "ec.payment.timeout x=1")).toBe(1);
  });

  it("共通トークンが無ければ 0", () => {
    expect(lexicalSimilarity("alpha beta", "gamma delta")).toBe(0);
  });

  it("空文字は 0（ゼロ除算しない）", () => {
    expect(lexicalSimilarity("", "anything")).toBe(0);
    expect(lexicalSimilarity("x", "")).toBe(0);
  });

  it("部分一致は (0,1) の中間値", () => {
    // tokens {a,b,c} vs {b,c,d} → ∩=2, ∪=4 → 0.5
    const score = lexicalSimilarity("a b c", "b c d");
    expect(score).toBeCloseTo(0.5);
  });

  it("構成上 [0,1] に収まる（無界 BM25 と違い飽和しない）", () => {
    const score = lexicalSimilarity("a a a b b", "a b c d e f g");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("退行ケース: 名前空間だけ共有する別イベントは閾値(0.6)を大きく下回る", () => {
    // novel な APPLICATION イベント vs seed の無関係インシデント。共有は "ec" のみ＝低スコア。
    const event = "ec.pricing.subtotal_mismatch symptom=subtotal rounding mismatch httpStatus=500";
    const seeded = "ec.order.processing_failed 注文処理が UNKNOWN_GATEWAY_ERROR で失敗しました";
    expect(lexicalSimilarity(event, seeded)).toBeLessThan(0.6);
  });

  it("退行ケース: 和文プローズ同士でも共通文字は union に薄まり飽和しない（<0.6）", () => {
    // 以前の偽 KNOWN 再現データ。BM25 だと飽和したが Jaccard は低く出る。
    const event =
      "ec.checkout.subtotal_mismatch 一部の注文でチェックアウト小計が不整合 直近のアプリコード変更が疑わしい";
    const seeded =
      "ec.order.processing_failed 注文処理が失敗しました 直前の決済タイムアウトが連鎖した結果と推定されます";
    expect(lexicalSimilarity(event, seeded)).toBeLessThan(0.6);
  });

  // ── 和文分かち書き（CJK bigram）の効果 ───────────────────────────────────────
  it("同じ話題の和文は bigram の部分一致で「無関係な和文」より明確に高い", () => {
    const query = "在庫予約で同時アクセスによる競合が発生しました";
    const related = "在庫予約の同時アクセス競合エラー";
    const unrelated = "決済サービスへの接続がタイムアウトしました";
    const sRelated = lexicalSimilarity(query, related);
    const sUnrelated = lexicalSimilarity(query, unrelated);
    expect(sRelated).toBeGreaterThan(sUnrelated);
    // 丸ごと1トークン方式だと言い回し差で 0 になっていたが、bigram で実質的な一致が出る。
    expect(sRelated).toBeGreaterThan(0.2);
  });

  it("英数トークンは従来どおり（bigram 化しない）", () => {
    // 英語は語単位のまま＝既存スコアと互換（CJK だけ bigram 展開する）。
    expect(lexicalSimilarity("payment timeout retry", "payment timeout retry")).toBe(1);
  });
});
