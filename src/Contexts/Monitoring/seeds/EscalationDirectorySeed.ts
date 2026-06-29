import { EscalationDirectoryEntry } from "../AIInvestigation/domain/escalation/EscalationDirectory.js";

/**
 * 組織体制のサンプル（タスク35）。EC ドメインに即した代表的なチーム編成。
 * 実機では社内の体制マスタ（Backstage / PagerDuty 等）から投影する想定の、デモ用ダミー。
 *
 * RunbookEscalationAgent が affectedSubjects（影響を受けた主体）と ownsSubjects を突合し、
 * 他責/運用案件のエスカレーション宛先を引き当てる。連絡先は実在しないデモ値。
 */
export const ESCALATION_DIRECTORY_SEED: EscalationDirectoryEntry[] = [
  {
    team: "payment-platform",
    owner: "決済基盤チーム オンコール",
    contact: "#oncall-payment (Slack) / payment-oncall@example.com",
    slaTier: "P1-15m",
    ownsSubjects: ["payment", "checkout", "billing", "決済"],
  },
  {
    team: "inventory-fulfillment",
    owner: "在庫・出荷チーム オンコール",
    contact: "#oncall-inventory (Slack) / inventory-oncall@example.com",
    slaTier: "P2-1h",
    ownsSubjects: ["inventory", "fulfillment", "warehouse", "在庫"],
  },
  {
    team: "platform-sre",
    owner: "プラットフォーム SRE",
    contact: "#oncall-sre (Slack) / sre-oncall@example.com",
    slaTier: "P1-15m",
    ownsSubjects: ["database", "network", "kubernetes", "cloud-sql", "infra", "インフラ"],
  },
  {
    team: "security-response",
    owner: "セキュリティ対応チーム",
    contact: "#oncall-security (Slack) / security-oncall@example.com",
    slaTier: "P1-15m",
    ownsSubjects: ["security", "vulnerability", "cve", "auth", "セキュリティ"],
  },
  {
    team: "external-vendor-liaison",
    owner: "外部ベンダー窓口",
    contact: "#vendor-liaison (Slack) / vendor-liaison@example.com",
    slaTier: "P3-next-business-day",
    ownsSubjects: ["external-api", "payment-gateway", "shipping-carrier", "外部API"],
  },
];
