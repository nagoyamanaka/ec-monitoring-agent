import { Router } from "express";
import { RebuildSimilarIncidentsUseCase } from "../../../../../Contexts/Monitoring/AlertAnalysis/application/RebuildSimilarIncidents/RebuildSimilarIncidentsUseCase.js";
import { SimilarIncidentsRebuildPostController } from "../controllers/admin/SimilarIncidentsRebuildPostController.js";

export type AdminDependencies = {
  rebuildSimilarIncidentsUseCase: RebuildSimilarIncidentsUseCase;
  ingestToken: string;
};

/**
 * 運用者向けの管理ルート群。demo と違い本番でも生きる（派生ストアの再構築など）ので、
 * demoGuard ではなく ingest と同じ x-ingest-token で守る。
 */
export function registerAdminRoutes(router: Router, deps: AdminDependencies): void {
  const rebuildController = new SimilarIncidentsRebuildPostController(
    deps.rebuildSimilarIncidentsUseCase,
    deps.ingestToken,
  );
  router.post(
    "/admin/similar-incidents/rebuild",
    rebuildController.run.bind(rebuildController),
  );
}
