import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { KnownAlertClassification } from "../AlertClassification.js";
import { ClassificationRuleKind } from "./ClassificationRuleKind.js";

// 分類の最小単位。各 Rule は判定に必要な依存（repository / port など）を自分で内包する。
// classify が null を返す = この Rule は発火しない（棄権）。
// kind は「証拠の性質」を表す属性。優先順位は ClassificationRuleSorter が kind を見て決める。
export interface ClassificationRule {
  readonly kind: ClassificationRuleKind;
  classify(
    monitoringEvent: MonitoringEvent,
  ): Promise<KnownAlertClassification | null>;
}
