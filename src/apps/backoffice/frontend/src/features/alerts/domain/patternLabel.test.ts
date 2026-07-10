import { describe, expect, it } from "vitest";
import { patternCause, patternLabel } from "./patternLabel";

describe("patternLabel", () => {
  it("seed 既知パターン ID を人間語へ写像する", () => {
    expect(patternLabel("PAYMENT_TIMEOUT")).toBe("決済タイムアウト");
    expect(patternLabel("INVENTORY_INSUFFICIENT")).toBe("在庫引当の不足");
  });

  it("デモシナリオの AI 推定パターン名（実測全数）を人間語へ写像する", () => {
    expect(patternLabel("PAYMENT_PROVIDER_OUTAGE")).toBe("決済プロバイダ障害");
    expect(patternLabel("DEPENDENCY_VULNERABILITY_DETECTED")).toBe(
      "依存ライブラリの既知脆弱性",
    );
    expect(patternLabel("DB_CONNECTION_POOL_EXHAUSTION")).toBe(
      "DB接続プールの枯渇",
    );
    expect(
      patternLabel("INFRA_CHANGE_INDUCED_DB_CONNECTION_EXHAUSTION"),
    ).toBe("インフラ変更起因のDB接続枯渇");
    expect(patternLabel("MEMORY_EXHAUSTION")).toBe("メモリ枯渇");
  });

  it("類似既知: <eventName> は eventName 部を eventCatalog の人間語タイトルへ写像する", () => {
    expect(patternLabel("類似既知: ec.payment.declined")).toBe(
      "類似既知: 決済プロバイダ拒否",
    );
    expect(patternLabel("類似既知: ec.db.connection_pool_exhausted")).toBe(
      "類似既知: DBコネクションプール枯渇",
    );
  });

  it("類似既知の eventName がカタログ未登録なら原文のまま（捏造しない）", () => {
    expect(patternLabel("類似既知: ec.unknown.event")).toBe(
      "類似既知: ec.unknown.event",
    );
  });

  it("辞書に無い UPPER_SNAKE_CASE はハウススタイル（空白区切り小文字）へ落とす", () => {
    expect(patternLabel("TERRAFORM_DB_MAX_CONNECTIONS_REDUCTION")).toBe(
      "terraform db max connections reduction",
    );
  });

  it("既に人間語の名前は変換せずそのまま返す（誤変換しない）", () => {
    expect(patternLabel("決済APIタイムアウト")).toBe("決済APIタイムアウト");
    expect(patternLabel("latency-spike-suspected")).toBe(
      "latency-spike-suspected",
    );
  });
});

describe("patternCause", () => {
  it("seed 既知パターンは要約辞書を最優先する（description の1文目はタイトル復唱のため）", () => {
    expect(
      patternCause(
        "PAYMENT_TIMEOUT",
        "決済処理がタイムアウトしました。外部決済サービスへの接続に問題がある可能性があります。",
      ),
    ).toBe("外部決済サービスへの接続不良の可能性");
    expect(patternCause("INVENTORY_INSUFFICIENT")).toBe(
      "在庫不足による商品引当の失敗",
    );
  });

  it("辞書に無いパターンは patternDescription（結晶化=承認時 AI summary）を返す", () => {
    expect(
      patternCause(
        "PROMOTED_GCP.MONITORING.CRITICAL_LOG_ENTRIES",
        "Terraform 変更で DB の max_connections が縮小され接続が枯渇した",
      ),
    ).toBe("Terraform 変更で DB の max_connections が縮小され接続が枯渇した");
  });

  it("seed 類似既知（シナリオ2）は resolvedNote の一次切り分けを凝縮した原因を返す", () => {
    expect(patternCause("類似既知: ec.payment.declined")).toBe(
      "決済プロバイダ側の障害の可能性（拒否が PROVIDER_UNAVAILABLE に集中）",
    );
  });

  it("辞書にも description にも無ければ undefined（呼び出し側は従来表示へ劣化）", () => {
    expect(patternCause("類似既知: ec.unknown.event")).toBeUndefined();
    expect(patternCause("UNKNOWN_PATTERN", "  ")).toBeUndefined();
  });
});
