import { KnownErrorPatternRepository } from "../KnownErrorPatternRepository.js";
import { AlertClassifier } from "./AlertClassifier.js";
import { ClassificationRule } from "./ClassificationRule.js";
import { ClassificationRuleSorter } from "./ClassificationRuleSorter.js";
import { PolicyBasedAlertClassifier } from "./PolicyBasedAlertClassifier.js";
import { ApplicationClassificationPolicy } from "./policies/ApplicationClassificationPolicy.js";
import { ExactMatchFallbackPolicy } from "./policies/ExactMatchFallbackPolicy.js";
import { KnownPatternRule } from "./rules/KnownPatternRule.js";

// 本番 composition root（BackofficeApp）とテストが同一の分類器構成を共有するための組み立て関数。
// 「専任 Policy（APPLICATION）→ 全 category 共通の完全一致フォールバック」という順序契約
// （first-match 前提・フォールバックは必ず最後）をここに閉じ込める。
// 過去に APPLICATION 専任 Policy しか積まれておらず、INFRASTRUCTURE/SECURITY のイベントが
// 昇格済みパターンに一致しても毎回「未知→AI調査」になる配線漏れがあった。その再発防止として
// 本番はこの関数経由で組み立て、同じ構成を buildAlertClassifier.test.ts が検証する。
export function buildAlertClassifier(params: {
  knownErrorPatternRepository: KnownErrorPatternRepository;
  // APPLICATION 専任 Policy に載せる Rule 群（完全一致＋設定時のみ類似度）。
  applicationRules: ClassificationRule[];
}): AlertClassifier {
  return new PolicyBasedAlertClassifier([
    new ApplicationClassificationPolicy(
      params.applicationRules,
      new ClassificationRuleSorter(),
    ),
    new ExactMatchFallbackPolicy(
      new KnownPatternRule(params.knownErrorPatternRepository),
    ),
  ]);
}
