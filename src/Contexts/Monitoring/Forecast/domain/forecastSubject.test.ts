import { describe, it, expect } from "vitest";
import {
  deriveForecastSubject,
  normalizeSubject,
  subjectsMatch,
} from "./forecastSubject.js";

describe("normalizeSubject", () => {
  it("小文字化し非英数字を _ に潰す", () => {
    expect(normalizeSubject("DB_CONNECTION_POOL")).toBe("db_connection_pool");
    expect(normalizeSubject("google_sql_database_instance.main")).toBe(
      "google_sql_database_instance_main",
    );
    expect(normalizeSubject("  db.connection pool  ")).toBe("db_connection_pool");
  });
});

describe("deriveForecastSubject", () => {
  it("terraform リソースがあれば最優先で使う（pending plan 側と同じ語彙になる）", () => {
    expect(
      deriveForecastSubject({
        suggestedPatternName: "DB_POOL_EXHAUSTION",
        category: "infrastructure",
        terraformResources: ["google_sql_database_instance.main"],
      }),
    ).toBe("google_sql_database_instance_main");
  });

  it("terraform リソースが無ければ suggestedPatternName を正規化して使う", () => {
    expect(
      deriveForecastSubject({
        suggestedPatternName: "DB_CONNECTION_POOL_EXHAUSTION",
        category: "application",
      }),
    ).toBe("db_connection_pool_exhaustion");
  });

  it("パターン名が空なら category にフォールバック（fallback レポートでも空にならない）", () => {
    expect(
      deriveForecastSubject({ suggestedPatternName: "  ", category: "application" }),
    ).toBe("application");
  });
});

describe("subjectsMatch", () => {
  it("2トークン以上の共有で一致（表記ゆれの吸収）", () => {
    expect(
      subjectsMatch("db.connection_pool", "db_connection_pool_exhaustion"),
    ).toBe(true);
  });

  it("単一トークン同士は完全一致のみ", () => {
    expect(subjectsMatch("checkout", "checkout")).toBe(true);
    expect(subjectsMatch("checkout", "payment")).toBe(false);
  });

  it("単一トークンは相手への包含で一致する", () => {
    expect(subjectsMatch("checkout", "checkout_load_spike")).toBe(true);
  });

  it("共有が1トークンだけの多トークン同士は一致しない（過剰一致の防止）", () => {
    expect(subjectsMatch("db.migration", "db_connection_pool_exhaustion")).toBe(
      false,
    );
  });

  it("空文字はどちら側でも一致しない", () => {
    expect(subjectsMatch("", "db_connection_pool")).toBe(false);
    expect(subjectsMatch("db_connection_pool", "")).toBe(false);
  });
});
