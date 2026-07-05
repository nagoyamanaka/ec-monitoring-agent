import { describe, it, expect } from "vitest";
import { buildAlertClassifier } from "./buildAlertClassifier.js";
import { ClassificationRule } from "./ClassificationRule.js";
import { ClassificationRuleKind } from "./ClassificationRuleKind.js";
import { KnownPatternRule } from "./rules/KnownPatternRule.js";
import {
  ClassificationConfidence,
  KnownAlertClassification,
} from "../AlertClassification.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { KnownErrorPattern } from "../KnownErrorPattern.js";
import { InMemoryKnownErrorPatternRepository } from "../../infrastructure/persistence/InMemoryKnownErrorPatternRepository.js";

// 本番（BackofficeApp）と同一の組み立てに対する配線契約テスト。
// 回帰の背景: かつて APPLICATION 専任 Policy しか無く、INFRASTRUCTURE/SECURITY イベントは
// 昇格済みパターンに一致しても常に未知→毎回 AI 調査になっていた（デモ 3/3b・4 で顕在化）。

const promotedInfraPattern = KnownErrorPattern.create({
  id: "pattern-infra-001",
  name: "PROMOTED_GCP.MONITORING.CRITICAL_LOG_ENTRIES",
  description: "",
  eventNamePattern: "gcp.monitoring.critical_log_entries",
  payloadConditions: [],
  severity: AlertSeverity.critical(),
  suggestedAction: "",
});

const knownAppPattern = KnownErrorPattern.create({
  id: "pattern-app-001",
  name: "PAYMENT_TIMEOUT",
  description: "",
  eventNamePattern: "ec.payment.timeout",
  payloadConditions: [],
  severity: AlertSeverity.critical(),
  suggestedAction: "",
});

// 類似度 Rule の代役: 呼ばれたら必ず一致する（＝どの Policy 経由で分類されたかの検出器）。
class AlwaysMatchSimilarityRule implements ClassificationRule {
  readonly kind = ClassificationRuleKind.SIMILARITY;
  async classify(): Promise<KnownAlertClassification> {
    return {
      type: "known",
      source: this.kind,
      patternId: "similar-001",
      patternName: "SIMILAR_MATCH",
      severity: AlertSeverity.warning(),
      confidence: ClassificationConfidence.of(0.67),
      matchedConditions: [],
      unmatchedConditions: [],
    };
  }
}

function makeEvent(params: {
  eventName: string;
  category: MonitoringEventCategory;
}): MonitoringEvent {
  return new MonitoringEvent({
    eventId: "evt-001",
    eventName: params.eventName,
    aggregateId: "agg-001",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: {},
    category: params.category,
    severity: AlertSeverity.critical(),
    source: "test",
  });
}

function buildClassifier(extraApplicationRules: ClassificationRule[] = []) {
  const repository = new InMemoryKnownErrorPatternRepository([
    promotedInfraPattern,
    knownAppPattern,
  ]);
  return buildAlertClassifier({
    knownErrorPatternRepository: repository,
    applicationRules: [
      new KnownPatternRule(repository),
      ...extraApplicationRules,
    ],
  });
}

describe("buildAlertClassifier（本番構成の配線契約）", () => {
  it("APPLICATION イベントは従来通り既知パターンに一致する", async () => {
    const result = await buildClassifier().classify(
      makeEvent({
        eventName: "ec.payment.timeout",
        category: MonitoringEventCategory.application(),
      }),
    );

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.classification.patternName).toBe("PAYMENT_TIMEOUT");
    }
  });

  it("INFRASTRUCTURE イベント（デモ3/3b）が昇格済みパターンに一致する＝再発は即・既知", async () => {
    const result = await buildClassifier().classify(
      makeEvent({
        eventName: "gcp.monitoring.critical_log_entries",
        category: MonitoringEventCategory.infrastructure(),
      }),
    );

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.classification.patternName).toBe(
        "PROMOTED_GCP.MONITORING.CRITICAL_LOG_ENTRIES",
      );
    }
  });

  it("SECURITY / CAPACITY イベントもフォールバックの完全一致が効く", async () => {
    for (const category of [
      MonitoringEventCategory.security(),
      MonitoringEventCategory.capacity(),
    ]) {
      const result = await buildClassifier().classify(
        makeEvent({
          eventName: "gcp.monitoring.critical_log_entries",
          category,
        }),
      );
      expect(result.matched).toBe(true);
    }
  });

  it("どのパターンにも一致しないイベントは category に依らず matched:false", async () => {
    const result = await buildClassifier().classify(
      makeEvent({
        eventName: "gcp.monitoring.unseen_condition",
        category: MonitoringEventCategory.infrastructure(),
      }),
    );

    expect(result.matched).toBe(false);
  });

  it("APPLICATION は専任 Policy が優先＝類似度 Rule が引き続き効く", async () => {
    const result = await buildClassifier([
      new AlwaysMatchSimilarityRule(),
    ]).classify(
      makeEvent({
        eventName: "ec.db.connection_pool_exhausted",
        category: MonitoringEventCategory.application(),
      }),
    );

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.classification.patternName).toBe("SIMILAR_MATCH");
    }
  });

  it("フォールバックは完全一致のみ＝APPLICATION 以外に類似度 Rule は効かせない", async () => {
    const result = await buildClassifier([
      new AlwaysMatchSimilarityRule(),
    ]).classify(
      makeEvent({
        eventName: "gcp.monitoring.unseen_condition",
        category: MonitoringEventCategory.infrastructure(),
      }),
    );

    expect(result.matched).toBe(false);
  });
});
