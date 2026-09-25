import { createHash } from "node:crypto";
import { ForecastContext } from "./ForecastContext.js";
import { ForecastSignal, ForecastSignalKind } from "./ForecastSignal.js";

/**
 * 証拠スナップショット（T0-2）。予報器に渡した入力（ForecastContext＝horizon＋シグナル全量）を
 * 正準化した JSON 文字列として凍結し、その sha256 を snapshotId にする（内容アドレス）。
 * 保存済みの入力だけから予報を再実行できる＝予報器を1行直しても、過去の入力で新旧を比べられる。
 *
 * 正準化はキー順の固定と undefined の除去だけ。文字列の中身（Unicode 正規化・空白）には触らない
 * ＝予報器に実際に渡したものと同じ入力を再現するのが目的で、表記ゆれを畳むのは目的ではない。
 * シグナルの並び順と id は保つ（プロンプトの並びと citations の参照先そのものなので）。
 * capturedAt はハッシュに入れない＝同じ入力は何度来ても同じ snapshotId（最初に見た時刻を残す）。
 */
export const EVIDENCE_SNAPSHOT_SCHEMA = "forecast-context/v1";

export type EvidenceSnapshot = {
  readonly snapshotId: string; // sha256(content)
  readonly capturedAt: Date; // UTC。予報器を呼ぶ前に取る＝as-of の基準
  readonly content: string; // 正準化済み JSON（このバイト列がハッシュの入力）
};

export interface EvidenceSnapshotRepository {
  /** 保存する。同じ snapshotId が既にあれば何もしない（内容が同じなので上書きの必要が無い）。 */
  save(snapshot: EvidenceSnapshot): Promise<void>;
  findById(snapshotId: string): Promise<EvidenceSnapshot | null>;
}

export class EvidenceSnapshotIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceSnapshotIntegrityError";
  }
}

export function captureEvidenceSnapshot(
  context: ForecastContext,
  capturedAt: Date,
): EvidenceSnapshot {
  const content = canonicalize(context);
  return { snapshotId: sha256(content), capturedAt, content };
}

/**
 * 保存済みスナップショットから予報器の入力を復元する。内容のハッシュが snapshotId と
 * 一致しない（保存後に書き換わった）もの・形の崩れたものは例外で拒む＝黙って別の入力で再実行しない。
 */
export function restoreForecastContext(snapshot: EvidenceSnapshot): ForecastContext {
  const actual = sha256(snapshot.content);
  if (actual !== snapshot.snapshotId) {
    throw new EvidenceSnapshotIntegrityError(
      `snapshot の内容が snapshotId と一致しません: id=${snapshot.snapshotId}, sha256(content)=${actual}`,
    );
  }
  const parsed = JSON.parse(snapshot.content) as Record<string, unknown>;
  if (parsed["schema"] !== EVIDENCE_SNAPSHOT_SCHEMA) {
    throw new EvidenceSnapshotIntegrityError(
      `未知の snapshot スキーマです: ${String(parsed["schema"])}`,
    );
  }
  if (typeof parsed["horizon"] !== "string" || !Array.isArray(parsed["signals"])) {
    throw new EvidenceSnapshotIntegrityError("snapshot に horizon / signals がありません");
  }
  return {
    horizon: parsed["horizon"],
    signals: parsed["signals"].map(toSignal),
  };
}

/** 内容のバイト列の sha256（snapshotId と同じ計算）。読み戻しの一致確認に使う。 */
export function hashSnapshotContent(content: string): string {
  return sha256(content);
}

const SIGNAL_KINDS: ReadonlySet<string> = new Set(Object.values(ForecastSignalKind));

function toSignal(value: unknown): ForecastSignal {
  const o = (value ?? {}) as Record<string, unknown>;
  const fields = ["id", "kind", "subject", "when", "desc", "source"] as const;
  for (const field of fields) {
    if (typeof o[field] !== "string") {
      throw new EvidenceSnapshotIntegrityError(`snapshot のシグナルに ${field} がありません`);
    }
  }
  if (!SIGNAL_KINDS.has(o["kind"] as string)) {
    throw new EvidenceSnapshotIntegrityError(`未知のシグナル種別です: ${String(o["kind"])}`);
  }
  return {
    id: o["id"] as string,
    kind: o["kind"] as ForecastSignalKind,
    subject: o["subject"] as string,
    when: o["when"] as string,
    desc: o["desc"] as string,
    source: o["source"] as string,
    ...(typeof o["url"] === "string" ? { url: o["url"] } : {}),
  };
}

// キーはアルファベット順で組み立てる＝呼び出し側のキーの書き順でハッシュが揺れない。
function canonicalize(context: ForecastContext): string {
  return JSON.stringify({
    horizon: context.horizon,
    schema: EVIDENCE_SNAPSHOT_SCHEMA,
    signals: context.signals.map((signal) => ({
      desc: signal.desc,
      id: signal.id,
      kind: signal.kind,
      source: signal.source,
      subject: signal.subject,
      ...(signal.url !== undefined ? { url: signal.url } : {}),
      when: signal.when,
    })),
  });
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
