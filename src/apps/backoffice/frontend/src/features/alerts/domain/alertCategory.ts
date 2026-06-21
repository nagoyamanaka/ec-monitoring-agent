import categories from "../config/alertCategories.json";
import type { AlertCategory } from "./AlertView";

/**
 * 監視カテゴリ（APPLICATION/INFRASTRUCTURE/...）→ 人間語のラベル＋説明。
 * 生の英大文字だけでは作業者に伝わらないため、表示は必ずこの写像を通す。
 * 定義は config/alertCategories.json に外出し。未知は生値ラベルにフォールバック。
 */

export type CategoryInfo = {
  readonly label: string;
  readonly description: string;
};

const CATEGORIES: Record<string, CategoryInfo> = categories;

export function categoryInfo(category: AlertCategory): CategoryInfo {
  return CATEGORIES[category] ?? { label: category, description: "" };
}
