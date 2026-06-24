import { KnownErrorPattern } from "./KnownErrorPattern.js";

export interface KnownErrorPatternRepository {
  save(pattern: KnownErrorPattern): Promise<void>;
  findById(id: string): Promise<KnownErrorPattern | null>;
  findAll(): Promise<KnownErrorPattern[]>;
  // 指定 Alert から自動昇格したパターンを撤回する（sourceAlertId 一致を全削除）。
  // 承認のやり直し（承認→却下）で誤った結晶化を残さないために使う。該当なしは no-op。
  removeBySourceAlertId(sourceAlertId: string): Promise<void>;
}
