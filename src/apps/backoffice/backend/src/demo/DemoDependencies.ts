import { EcDemoGateway } from "./EcDemoGateway.js";
import { TriggerDemoScenarioUseCase } from "./TriggerDemoScenarioUseCase.js";
import { DemoResetUseCase } from "./DemoResetUseCase.js";

// demo ルート群が必要とする依存をまとめて運ぶ束（registerRoutes の引数爆発を防ぐ）。
export type DemoDependencies = {
  ecDemoGateway: EcDemoGateway;
  triggerScenarioUseCase: TriggerDemoScenarioUseCase;
  demoResetUseCase: DemoResetUseCase;
};
