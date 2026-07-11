import {
  ChartIcon,
  CodeIcon,
  HexagonIcon,
  LogLinesIcon,
  ShieldIcon,
  TargetIcon,
  type IconComponent,
} from "@shared/ui/icons";
import type { EvidenceLedgerKey } from "../../domain/evidenceLedger";

/**
 * 証拠源キー → SVG アイコン（L1: テキストグリフ置換）。
 * 呼称は evidenceFlow / EvidencePanel の SOURCE_META と統一し、
 * アイコンの割当は本表を単一ソースにする（domain は描画を持たない）。
 */
export const EVIDENCE_SOURCE_ICONS: Record<EvidenceLedgerKey, IconComponent> = {
  security: ShieldIcon,
  logs: LogLinesIcon,
  metrics: ChartIcon,
  terraformChanges: HexagonIcon,
  commits: CodeIcon,
  similarIncidents: TargetIcon,
};
