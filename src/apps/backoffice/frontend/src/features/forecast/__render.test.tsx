import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import type { CitationView, RiskCardView } from "./domain/ForecastView";
import { RiskCard } from "./presentation/components/RiskCard";

const cits: CitationView[] = [
  { id: "plan-1", kind: "FUTURE_CHANGE", kindLabel: "未来の変更", subject: "module_gce_backbone", when: "plan済み・未適用（apply され次第有効）", desc: "バックボーンVM（Mongo 同居）を e2-standard-2 → e2-small に縮小＝メモリ 8→2GB。", url: "https://example.com/pull/83" },
  { id: "pr-55", kind: "FUTURE_CHANGE", kindLabel: "未来の変更", subject: "cap_pool", when: "未マージ（merge され次第有効）", desc: "[draft] chore(db): cap Mongo connection pool (maxPoolSize 100→40)", url: "https://example.com/pull/55" },
  { id: "sch-1", kind: "SCHEDULE", kindLabel: "スケジュール", subject: "checkout", when: "土 20:00-23:00", desc: "checkout 負荷 x5（週末セール）" },
  { id: "inc-4", kind: "MEMORY", kindLabel: "過去の同型事例", subject: "backbone", when: "過去の解決済みインシデント", desc: "ec.db.connection_pool_exhausted → machine_type を戻して解消", alertId: "a1" },
  { id: "inc-3", kind: "MEMORY", kindLabel: "過去の同型事例", subject: "checkout", when: "過去の解決済みインシデント", desc: "ec.checkout.latency_degraded → セール時間帯のみプールを一時増強して回避", alertId: "a2" },
];
const base: RiskCardView = {
  window: "土 20:00-23:00",
  subject: "db_connection_pool",
  level: "HIGH",
  confidence: 0.9,
  reasoning: "バックボーンVMのメモリを縮小するインフラ変更（plan-1）でMongoが扱えるリソースが減少し、さらにDB接続プール上限も引き下げられる（pr-55）予定です。この状態で週末セールの高負荷（sch-1）によりDB接続要求が急増すると、縮小されたリソースでは要求を捌ききれず接続プールが枯渇します。",
  citations: cits,
  preventiveAction: "バックボーンVMを縮小するインフラ変更（plan-1）と、関連するDB接続プール上限の変更PR（pr-55）の適用を、週末セールの高負荷期間（sch-1）後へ延期することを推奨します。",
};
const G = "2026-08-05T01:27:46.458Z";

it("dump", () => {
  const out = [
    render(<MemoryRouter><RiskCard risk={base} generatedAt={G} /></MemoryRouter>).container.innerHTML,
    render(<MemoryRouter><RiskCard risk={{ ...base, level: "MEDIUM", subject: "valkey_cache_maxmemory" }} generatedAt={G} /></MemoryRouter>).container.innerHTML,
  ];
  writeFileSync(process.env.DUMP!, out.join("\n<!--SPLIT-->\n"));
});
