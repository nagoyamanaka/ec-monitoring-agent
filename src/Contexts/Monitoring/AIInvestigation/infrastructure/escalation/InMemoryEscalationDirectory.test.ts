import { describe, it, expect } from "vitest";
import { InMemoryEscalationDirectory } from "./InMemoryEscalationDirectory.js";
import { EscalationDirectoryEntry } from "../../domain/escalation/EscalationDirectory.js";

const entries: EscalationDirectoryEntry[] = [
  {
    team: "payment-platform",
    owner: "決済基盤チーム オンコール",
    contact: "#oncall-payment",
    slaTier: "P1-15m",
    ownsSubjects: ["payment", "checkout", "決済"],
  },
  {
    team: "platform-sre",
    owner: "プラットフォーム SRE",
    contact: "#oncall-sre",
    slaTier: "P1-15m",
    ownsSubjects: ["database", "cloud-sql", "infra"],
  },
  {
    team: "external-vendor-liaison",
    owner: "外部ベンダー窓口",
    contact: "#vendor-liaison",
    slaTier: "P3-next-business-day",
    ownsSubjects: ["external-api", "payment-gateway"],
  },
];

describe("InMemoryEscalationDirectory", () => {
  const directory = new InMemoryEscalationDirectory(entries);

  it("affectedSubjects を所有するチームを引く", async () => {
    const found = await directory.findBySubjects(["checkout"]);
    expect(found.map((e) => e.team)).toEqual(["payment-platform"]);
  });

  it("大文字小文字を無視して突合する", async () => {
    const found = await directory.findBySubjects(["Cloud-SQL"]);
    expect(found.map((e) => e.team)).toEqual(["platform-sre"]);
  });

  it("部分一致でも引き当てる（payment は payment-gateway に含まれる）", async () => {
    const found = await directory.findBySubjects(["payment"]);
    // payment は payment-platform(ownsSubjects:payment) と external-vendor(payment-gateway) の両方に当たる
    expect(found.map((e) => e.team)).toEqual([
      "payment-platform",
      "external-vendor-liaison",
    ]);
  });

  it("複数主体は seed 宣言順で重複なく返す", async () => {
    const found = await directory.findBySubjects(["database", "checkout"]);
    expect(found.map((e) => e.team)).toEqual(["payment-platform", "platform-sre"]);
  });

  it("該当チームが無ければ空配列", async () => {
    expect(await directory.findBySubjects(["marketing"])).toEqual([]);
  });

  it("空・空白のみの主体は空配列（宛先不明）", async () => {
    expect(await directory.findBySubjects([])).toEqual([]);
    expect(await directory.findBySubjects(["", "  "])).toEqual([]);
  });
});
