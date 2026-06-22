import { MonitoringEvent } from "../../../../Shared/domain/MonitoringEvent.js";
import {
  ClassificationConfidence,
  KnownAlertClassification,
  MatchedCondition,
} from "../../AlertClassification.js";
import { KnownErrorPatternRepository } from "../../KnownErrorPatternRepository.js";
import { ClassificationRule } from "../ClassificationRule.js";
import { ClassificationRuleKind } from "../ClassificationRuleKind.js";

// 既知エラーパターンとの完全一致（eventName + payloadConditions）で分類する Rule。
// パターンの取得元（repository）を自分で内包する。confidence は 1.0 固定。
export class KnownPatternRule implements ClassificationRule {
  readonly kind = ClassificationRuleKind.EXACT_MATCH;

  constructor(
    private readonly patternRepository: KnownErrorPatternRepository,
  ) {}

  async classify(
    monitoringEvent: MonitoringEvent,
  ): Promise<KnownAlertClassification | null> {
    const patterns = await this.patternRepository.findAll();

    for (const pattern of patterns) {
      if (pattern.eventNamePattern !== monitoringEvent.eventName) {
        continue;
      }

      // Array.prototype.everyはすべての条件が正の場合trueを返す
      // 【参考】Array.prototype.someは一つでも条件が正の場合はtrueを返す
      // このClassificationRuleは完全一致用途なのでeveryを採用
      const allPayloadConditionsMatch = pattern.payloadConditions.every(
        (condition) =>
          monitoringEvent.payload[condition.field] === condition.value,
      );
      if (!allPayloadConditionsMatch) {
        continue;
      }

      const matchedConditions: MatchedCondition[] = [
        {
          field: "eventName",
          expectedValue: pattern.eventNamePattern,
          actualValue: monitoringEvent.eventName,
        },
        ...pattern.payloadConditions.map((condition) => ({
          field: `payload.${condition.field}`,
          expectedValue: condition.value,
          actualValue: monitoringEvent.payload[condition.field],
        })),
      ];

      return {
        type: "known",
        source: this.kind,
        patternId: pattern.id,
        patternName: pattern.name,
        severity: pattern.severity,
        confidence: ClassificationConfidence.certain(),
        matchedConditions,
        unmatchedConditions: [],
      };
    }

    return null;
  }
}
