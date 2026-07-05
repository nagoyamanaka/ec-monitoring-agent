import { MonitoringEvent } from "../../../../Shared/domain/MonitoringEvent.js";
import { AlertClassificationResult } from "../AlertClassifier.js";
import { ClassificationPolicy } from "../ClassificationPolicy.js";
import { ClassificationRule } from "../ClassificationRule.js";

// 専任 Policy を持たない category（INFRASTRUCTURE / CAPACITY / SECURITY）の受け皿。
// supports() が常に true のため、PolicyBasedAlertClassifier（first-match ディスパッチ）の
// ポリシー配列では必ず最後に置くこと。先頭に置くと専任 Policy が一切呼ばれなくなる。
//
// 完全一致 Rule だけを載せる設計判断:
//   昇格（結晶化）した既知パターンの高速パス（即・無料・決定論）は category に依存する理由が
//   無いので全イベントに効かせる。一方、類似度などの graded な Rule は誤爆時の副作用
//   （severity 既定 WARNING への降格等）が category ごとに妥当か個別判断が要るため、
//   全 category 共通の受け皿には載せない（必要になったら専任 Policy を追加する）。
export class ExactMatchFallbackPolicy implements ClassificationPolicy {
  constructor(private readonly exactMatchRule: ClassificationRule) {}

  supports(_monitoringEvent: MonitoringEvent): boolean {
    return true;
  }

  async classify(
    monitoringEvent: MonitoringEvent,
  ): Promise<AlertClassificationResult> {
    const classification = await this.exactMatchRule.classify(monitoringEvent);
    if (classification === null) {
      return { matched: false };
    }
    return { matched: true, classification };
  }
}
