import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { AggregateRoot } from "../../../Shared/domain/AggregateRoot.js";

export type PayloadCondition = {
  readonly field: string;
  readonly value: unknown;
};

export type KnownErrorPatternPrimitives = {
  id: string;
  name: string;
  description: string;
  eventNamePattern: string;
  payloadConditions: { field: string; value: unknown }[];
  severity: string;
  suggestedAction: string;
  isPromoted: boolean;
  promotedAt: string | null;
  createdAt: string;
  // 自動昇格（結晶化）の由来 Alert。承認のやり直しで結晶化を撤回するための back-link。
  // 手動作成・シードのパターンには無い（optional）。
  sourceAlertId?: string;
};

export class KnownErrorPattern extends AggregateRoot {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly eventNamePattern: string;
  readonly payloadConditions: PayloadCondition[];
  readonly severity: AlertSeverity;
  readonly suggestedAction: string;
  readonly isPromoted: boolean;
  readonly promotedAt: Date | null;
  readonly createdAt: Date;
  // 自動昇格の由来 Alert（手動作成・シードは null）。承認撤回時の結晶化撤回に使う。
  readonly sourceAlertId: string | null;

  private constructor(params: {
    id: string;
    name: string;
    description: string;
    eventNamePattern: string;
    payloadConditions: PayloadCondition[];
    severity: AlertSeverity;
    suggestedAction: string;
    isPromoted: boolean;
    promotedAt: Date | null;
    createdAt: Date;
    sourceAlertId: string | null;
  }) {
    super();
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.eventNamePattern = params.eventNamePattern;
    this.payloadConditions = params.payloadConditions;
    this.severity = params.severity;
    this.suggestedAction = params.suggestedAction;
    this.isPromoted = params.isPromoted;
    this.promotedAt = params.promotedAt;
    this.createdAt = params.createdAt;
    this.sourceAlertId = params.sourceAlertId;
  }

  static create(params: {
    id: string;
    name: string;
    description: string;
    eventNamePattern: string;
    payloadConditions: PayloadCondition[];
    severity: AlertSeverity;
    suggestedAction: string;
    createdAt?: Date;
    sourceAlertId?: string;
  }): KnownErrorPattern {
    return new KnownErrorPattern({
      ...params,
      isPromoted: false,
      promotedAt: null,
      createdAt: params.createdAt ?? new Date(),
      sourceAlertId: params.sourceAlertId ?? null,
    });
  }

  promote(): KnownErrorPattern {
    return new KnownErrorPattern({
      id: this.id,
      name: this.name,
      description: this.description,
      eventNamePattern: this.eventNamePattern,
      payloadConditions: this.payloadConditions,
      severity: this.severity,
      suggestedAction: this.suggestedAction,
      isPromoted: true,
      promotedAt: new Date(),
      createdAt: this.createdAt,
      sourceAlertId: this.sourceAlertId,
    });
  }

  toPrimitives(): KnownErrorPatternPrimitives {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      eventNamePattern: this.eventNamePattern,
      payloadConditions: this.payloadConditions.map((c) => ({
        field: c.field,
        value: c.value,
      })),
      severity: this.severity.value,
      suggestedAction: this.suggestedAction,
      isPromoted: this.isPromoted,
      promotedAt: this.promotedAt?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
      ...(this.sourceAlertId ? { sourceAlertId: this.sourceAlertId } : {}),
    };
  }

  static fromPrimitives(
    primitives: KnownErrorPatternPrimitives,
  ): KnownErrorPattern {
    return new KnownErrorPattern({
      id: primitives.id,
      name: primitives.name,
      description: primitives.description,
      eventNamePattern: primitives.eventNamePattern,
      payloadConditions: primitives.payloadConditions,
      severity: AlertSeverity.fromString(primitives.severity),
      suggestedAction: primitives.suggestedAction,
      isPromoted: primitives.isPromoted,
      promotedAt: primitives.promotedAt
        ? new Date(primitives.promotedAt)
        : null,
      createdAt: new Date(primitives.createdAt),
      sourceAlertId: primitives.sourceAlertId ?? null,
    });
  }
}
