import {
  TerraformAttributeDelta,
  TerraformResourceAction,
  TerraformResourceChange,
} from "../../domain/InfraEvidence.js";
import { PendingPlan } from "../../infrastructure/infrainvestigation/TerraformGateway.js";

/**
 * CI（terraform.yml の plan ジョブ）から届く未適用 plan の正規化済みボディ。
 * CI 側（.github/scripts/tfplan-to-pending-plan.jq）が `terraform show -json` から
 *   - managed リソースの create/update/delete/replace のみ抽出（no-op/read を除外）
 *   - sensitive マスクに触れる属性値を "(sensitive)" へ置換（Secret Manager の secret_data 等）
 *   - 値の文字列化と長さ上限
 * まで整形してから1リクエストで送る。源固有の形を知るのはこの Translator だけ。
 */
export type TerraformPlanIngestBody = {
  readonly resourceChanges?: ReadonlyArray<{
    readonly address?: unknown;
    readonly action?: unknown;
    readonly attributeDeltas?: ReadonlyArray<{
      readonly key?: unknown;
      readonly before?: unknown;
      readonly after?: unknown;
    }>;
  }>;
  readonly plannedAt?: unknown;
  readonly summary?: unknown;
  readonly url?: unknown;
};

export class InvalidTerraformPlanError extends Error {}

// 外部入力（CI とはいえ HTTP 境界）なので上限は口側でも守る。CI 側 jq の上限と独立に効く。
const MAX_RESOURCE_CHANGES = 50;
const MAX_ATTRIBUTE_DELTAS = 20;
const MAX_VALUE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 300;

const ACTIONS: ReadonlySet<string> = new Set(["create", "update", "delete", "replace"]);

/**
 * CI の plan 差分を PendingInfraPlanStore が受ける PendingPlan へ正規化する ingest 境界。
 * デモ seed（ForecastPendingPlanSeed）が手書きで作るのと同じ型を、実 plan.json 由来で組み立てる
 * ＝「CI の plan パイプラインが同じ record 口へ積む」（seed コメントの想定）の実配線。
 * 構造不正は InvalidTerraformPlanError（コントローラが 400 にマップ）。
 */
export class TerraformPlanTranslator {
  static toPendingPlan(body: TerraformPlanIngestBody): PendingPlan {
    if (!Array.isArray(body.resourceChanges) || body.resourceChanges.length === 0) {
      throw new InvalidTerraformPlanError("resourceChanges must be a non-empty array");
    }

    const resourceChanges: TerraformResourceChange[] = body.resourceChanges
      .slice(0, MAX_RESOURCE_CHANGES)
      .map((change, index) => {
        if (typeof change?.address !== "string" || change.address.trim() === "") {
          throw new InvalidTerraformPlanError(
            `resourceChanges[${index}].address must be a non-empty string`,
          );
        }
        if (typeof change.action !== "string" || !ACTIONS.has(change.action)) {
          throw new InvalidTerraformPlanError(
            `resourceChanges[${index}].action must be one of create|update|delete|replace`,
          );
        }
        return {
          address: change.address,
          action: change.action as TerraformResourceAction,
          attributeDeltas: toAttributeDeltas(change.attributeDeltas),
        };
      });

    return {
      resourceChanges,
      plannedAt: toPlannedAt(body.plannedAt),
      summary: toSummary(body.summary, resourceChanges),
      ...(typeof body.url === "string" && /^https?:\/\//.test(body.url)
        ? { url: body.url }
        : {}),
    };
  }
}

function toAttributeDeltas(deltas: unknown): TerraformAttributeDelta[] {
  if (!Array.isArray(deltas)) {
    return [];
  }
  return deltas
    .filter(
      (delta): delta is { key: string; before?: unknown; after?: unknown } =>
        typeof delta?.key === "string" && delta.key !== "",
    )
    .slice(0, MAX_ATTRIBUTE_DELTAS)
    .map((delta) => ({
      key: delta.key,
      before: toDeltaValue(delta.before),
      after: toDeltaValue(delta.after),
    }));
}

// 機微値の漏洩を避けるため before/after は文字列化済みの要約値（InfraEvidence の設計）。
// 非文字列が来ても JSON 文字列化して収め、長さは上限で切る。
function toDeltaValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

// plannedAt は欠落/不正でも 400 にしない（差分本体が本旨・時刻は受領時刻で代用できる）。
function toPlannedAt(value: unknown): Date {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function toSummary(value: unknown, resourceChanges: TerraformResourceChange[]): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value.length > MAX_SUMMARY_LENGTH
      ? `${value.slice(0, MAX_SUMMARY_LENGTH)}…`
      : value;
  }
  const head = resourceChanges[0].address;
  const rest = resourceChanges.length > 1 ? " 他" : "";
  return `terraform plan: ${resourceChanges.length}件のリソース変更（${head}${rest}）・apply待ち`;
}
