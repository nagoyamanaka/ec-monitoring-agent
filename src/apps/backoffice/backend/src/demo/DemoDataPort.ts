// demo reset 用の破壊的操作を切り出した port。
// ドメインの AlertRepository / KnownErrorPatternRepository に deleteAll を生やしてポートを汚さないため、
// demo 専用の関心としてここに分離する。
export interface DemoDataPort {
  clearAlerts(): Promise<void>;
  clearPatterns(): Promise<void>;
}
