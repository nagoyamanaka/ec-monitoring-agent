export type SimilarIncident = {
  readonly id: string;
  readonly eventName: string;
  readonly occurredOn: Date;
  readonly resolvedNote: string; // オペレーターのメモまたはAI分析summary
  readonly resolvedAt: Date;
};
