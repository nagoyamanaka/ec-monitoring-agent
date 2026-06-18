import { AlertSeverity } from "./AlertSeverity.js";

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
};

export class KnownErrorPattern {
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
  }) {
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
  }): KnownErrorPattern {
    return new KnownErrorPattern({
      ...params,
      isPromoted: false,
      promotedAt: null,
      createdAt: params.createdAt ?? new Date(),
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
    });
  }
}
