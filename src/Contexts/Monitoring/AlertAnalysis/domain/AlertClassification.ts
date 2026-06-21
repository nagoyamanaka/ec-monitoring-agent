import { DomainError } from "../../../Shared/domain/errors/DomainError.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import type {
  MatchedCondition,
  UnmatchedCondition,
  KnownAlertClassificationPrimitives,
  UnknownAlertClassificationPrimitives,
  AlertClassificationPrimitives,
} from "./contracts/AlertContract.js";

// シリアライズ契約・条件マッチ型は contracts に一元化（backend/frontend 共通の単一ソース）。
export type {
  MatchedCondition,
  UnmatchedCondition,
  KnownAlertClassificationPrimitives,
  UnknownAlertClassificationPrimitives,
  AlertClassificationPrimitives,
};

export class InvalidClassificationConfidenceError extends DomainError {
  readonly errorCode = "INVALID_CLASSIFICATION_CONFIDENCE";

  constructor(value: number) {
    super(
      `ClassificationConfidence must be between 0 and 1, got: ${value}`,
    );
  }
}

export class ClassificationConfidence {
  private constructor(readonly value: number) {}

  static of(value: number): ClassificationConfidence {
    if (value < 0 || value > 1) {
      throw new InvalidClassificationConfidenceError(value);
    }
    return new ClassificationConfidence(value);
  }

  static certain(): ClassificationConfidence {
    return new ClassificationConfidence(1.0);
  }

  isHighConfidence(threshold = 0.8): boolean {
    return this.value >= threshold;
  }

  toPrimitive(): number {
    return this.value;
  }
}

export type KnownAlertClassification = {
  readonly type: "known";
  readonly patternId: string;
  readonly patternName: string;
  // KnownErrorPattern.severity を Classifier 側で解決済み（Alert が KnownErrorPattern に直接依存しない）
  readonly severity: AlertSeverity;
  readonly confidence: ClassificationConfidence;
  readonly matchedConditions: MatchedCondition[];
  readonly unmatchedConditions: UnmatchedCondition[];
};

export type UnknownAlertClassification = {
  readonly type: "unknown";
  readonly confidence: null;
};

export type AlertClassification =
  | KnownAlertClassification
  | UnknownAlertClassification;

export function alertClassificationToPrimitives(
  classification: AlertClassification,
): AlertClassificationPrimitives {
  if (classification.type === "known") {
    return {
      type: "known",
      patternId: classification.patternId,
      patternName: classification.patternName,
      severity: classification.severity.value,
      confidence: classification.confidence.toPrimitive(),
      matchedConditions: classification.matchedConditions.map((c) => ({ ...c })),
      unmatchedConditions: classification.unmatchedConditions.map((c) => ({ ...c })),
    };
  }
  return { type: "unknown", confidence: null };
}

export function alertClassificationFromPrimitives(
  primitives: AlertClassificationPrimitives,
): AlertClassification {
  if (primitives.type === "known") {
    return {
      type: "known",
      patternId: primitives.patternId,
      patternName: primitives.patternName,
      severity: AlertSeverity.fromString(primitives.severity),
      confidence: ClassificationConfidence.of(primitives.confidence),
      matchedConditions: primitives.matchedConditions,
      unmatchedConditions: primitives.unmatchedConditions,
    };
  }
  return { type: "unknown", confidence: null };
}
