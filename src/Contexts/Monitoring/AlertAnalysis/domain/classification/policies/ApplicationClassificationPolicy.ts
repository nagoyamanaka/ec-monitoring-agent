import { MonitoringEvent } from "../../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategories } from "../../../../Shared/domain/MonitoringEventCategory.js";
import { AlertClassificationResult } from "../AlertClassifier.js";
import { ClassificationPolicy } from "../ClassificationPolicy.js";
import { ClassificationRule } from "../ClassificationRule.js";
import { ClassificationRuleSorter } from "../ClassificationRuleSorter.js";

// APPLICATION 領域（EC障害イベント等）の分類戦略。
// 渡された Rule を Sorter で優先度順に並べ、最初に発火した Rule の結果を採用する（first-match）。
// 優先度は配列順ではなく kind 優先順位で確定する（Sorter が担保）。
export class ApplicationClassificationPolicy implements ClassificationPolicy {
  private readonly rules: ClassificationRule[];

  constructor(rules: ClassificationRule[], sorter: ClassificationRuleSorter) {
    this.rules = sorter.sort(rules);
  }

  supports(monitoringEvent: MonitoringEvent): boolean {
    return monitoringEvent.category.value === MonitoringEventCategories.APPLICATION;
  }

  async classify(monitoringEvent: MonitoringEvent): Promise<AlertClassificationResult> {
    for (const rule of this.rules) {
      const classification = await rule.classify(monitoringEvent);
      if (classification !== null) {
        return { matched: true, classification };
      }
    }
    return { matched: false };
  }
}
