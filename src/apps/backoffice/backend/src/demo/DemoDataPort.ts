// demo reset 用の破壊的操作を切り出した port。
// ドメインの AlertRepository / KnownErrorPatternRepository に deleteAll を生やしてポートを汚さないため、
// demo 専用の関心としてここに分離する。
export interface DemoDataPort {
  clearAlerts(): Promise<void>;
  clearPatterns(): Promise<void>;
  // リメディエーション記録（起票結果）も demo reset で消す。
  // alert と独立したライフサイクルのため掃除し忘れると、古い skipped 記録が
  // alert 再 seed 後も残り続け、非対象アラートに自動修正パネルが出てしまう。
  clearRemediations(): Promise<void>;
}
