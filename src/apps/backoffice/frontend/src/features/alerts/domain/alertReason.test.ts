import { describe, expect, it } from "vitest";
import { alertReason } from "./alertReason";
import { makeAlert, makeReport } from "../test-support/alertFixture";

describe("alertReason", () => {
  it("分析中は analyzing", () => {
    expect(
      alertReason(makeAlert({ status: "ANALYZING", report: null })),
    ).toEqual({ kind: "analyzing" });
  });

  it("既知パターンは classification の patternName", () => {
    const reason = alertReason(
      makeAlert({
        report: null,
        classification: {
          type: "known",
          source: "EXACT_MATCH",
          patternId: "p-1",
          patternName: "決済APIタイムアウト",
          confidence: 0.9,
          matchedConditions: [],
        },
      }),
    );
    expect(reason).toEqual({
      kind: "known",
      patternName: "決済APIタイムアウト",
      source: "EXACT_MATCH",
      crystallized: false,
    });
  });

  it("未知（report あり）は report の suggestedPatternName", () => {
    const reason = alertReason(
      makeAlert({ report: makeReport({ suggestedPatternName: "latency-spike" }) }),
    );
    expect(reason).toEqual({ kind: "ai", patternName: "latency-spike" });
  });

  it("非 fallback でパターン名が空（サルベージ回収の欠落等）は空欄でなく summary で語る", () => {
    const reason = alertReason(
      makeAlert({
        report: makeReport({
          suggestedPatternName: "",
          summary: "DB接続プールの枯渇が疑われる",
        }),
      }),
    );
    expect(reason).toEqual({
      kind: "ai",
      patternName: "DB接続プールの枯渇が疑われる",
    });
  });

  it("非 fallback でパターン名も summary も空なら「調査失敗・再調査可」に倒す（空 UI 禁止）", () => {
    const reason = alertReason(
      makeAlert({
        report: makeReport({ suggestedPatternName: "  ", summary: " " }),
      }),
    );
    expect(reason).toEqual({ kind: "ai", patternName: "調査失敗・再調査可" });
  });

  it("fallback レポートは空文字でなく「調査失敗・再調査可」の定型文（タスク E3）", () => {
    const reason = alertReason(
      makeAlert({
        report: makeReport({ isFallback: true, suggestedPatternName: "" }),
      }),
    );
    expect(reason).toEqual({ kind: "ai", patternName: "調査失敗・再調査可" });
  });

  it("昇格パターン（PROMOTED_）は crystallized＋eventCatalog の人間語へ写像し、生IDは rawPatternName へ降格", () => {
    const reason = alertReason(
      makeAlert({
        eventName: "ec.payment.timeout",
        report: null,
        classification: {
          type: "known",
          source: "EXACT_MATCH",
          patternId: "p-2",
          patternName: "PROMOTED_EC.PAYMENT.TIMEOUT",
          confidence: 1,
          matchedConditions: [],
        },
      }),
    );
    expect(reason).toEqual({
      kind: "known",
      patternName: "決済タイムアウト",
      source: "EXACT_MATCH",
      crystallized: true,
      rawPatternName: "PROMOTED_EC.PAYMENT.TIMEOUT",
    });
  });

  it("自動昇格（AUTO_PROMOTED_）も crystallized。カタログ未登録の eventName は生 eventName へフォールバック", () => {
    const reason = alertReason(
      makeAlert({
        eventName: "custom.unknown.event",
        report: null,
        classification: {
          type: "known",
          source: "EXACT_MATCH",
          patternId: "p-3",
          patternName: "AUTO_PROMOTED_CUSTOM.UNKNOWN.EVENT",
          confidence: 1,
          matchedConditions: [],
        },
      }),
    );
    expect(reason).toEqual({
      kind: "known",
      patternName: "custom.unknown.event",
      source: "EXACT_MATCH",
      crystallized: true,
      rawPatternName: "AUTO_PROMOTED_CUSTOM.UNKNOWN.EVENT",
    });
  });

  it("seed 既知パターンは辞書の原因要約を cause に載せる（G4b）", () => {
    const reason = alertReason(
      makeAlert({
        report: null,
        classification: {
          type: "known",
          source: "EXACT_MATCH",
          patternId: "p-1",
          patternName: "PAYMENT_TIMEOUT",
          confidence: 1,
          matchedConditions: [],
        },
      }),
    );
    expect(reason).toEqual({
      kind: "known",
      patternName: "PAYMENT_TIMEOUT",
      source: "EXACT_MATCH",
      crystallized: false,
      cause: "外部決済サービスへの接続不良の可能性",
    });
  });

  it("結晶化パターンは wire の patternDescription（承認時 AI summary）を cause に載せる（G4b）", () => {
    const reason = alertReason(
      makeAlert({
        eventName: "gcp.monitoring.critical_log_entries",
        report: null,
        classification: {
          type: "known",
          source: "EXACT_MATCH",
          patternId: "p-2",
          patternName: "PROMOTED_GCP.MONITORING.CRITICAL_LOG_ENTRIES",
          confidence: 1,
          matchedConditions: [],
          patternDescription:
            "Terraform 変更で DB の max_connections が縮小され接続が枯渇した",
        },
      }),
    );
    expect(reason).toEqual({
      kind: "known",
      patternName: "インフラ障害（CRITICAL ログ検知）",
      source: "EXACT_MATCH",
      crystallized: true,
      rawPatternName: "PROMOTED_GCP.MONITORING.CRITICAL_LOG_ENTRIES",
      cause: "Terraform 変更で DB の max_connections が縮小され接続が枯渇した",
    });
  });

  it("seed 類似既知（シナリオ2）は辞書の原因要約を cause に載せる（source=SIMILARITY で候補調）", () => {
    const reason = alertReason(
      makeAlert({
        report: null,
        classification: {
          type: "known",
          source: "SIMILARITY",
          patternId: "similar:inc-1",
          patternName: "類似既知: ec.payment.declined",
          confidence: 0.71,
          matchedConditions: [],
        },
      }),
    );
    expect(reason).toEqual({
      kind: "known",
      patternName: "類似既知: ec.payment.declined",
      source: "SIMILARITY",
      crystallized: false,
      cause: "決済プロバイダ側の障害の可能性（拒否が PROVIDER_UNAVAILABLE に集中）",
    });
  });

  it("patternDescription も辞書も無い既知は cause を載せない（従来表示に劣化）", () => {
    const reason = alertReason(
      makeAlert({
        report: null,
        classification: {
          type: "known",
          source: "SIMILARITY",
          patternId: "similar:inc-2",
          patternName: "類似既知: ec.unknown.event",
          confidence: 0.71,
          matchedConditions: [],
        },
      }),
    );
    expect(reason).toEqual({
      kind: "known",
      patternName: "類似既知: ec.unknown.event",
      source: "SIMILARITY",
      crystallized: false,
    });
  });
});
