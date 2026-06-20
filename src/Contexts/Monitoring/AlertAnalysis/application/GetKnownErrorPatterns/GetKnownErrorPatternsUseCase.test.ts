import { describe, it, expect, beforeEach } from "vitest";
import { GetKnownErrorPatternsUseCase } from "./GetKnownErrorPatternsUseCase.js";
import { InMemoryKnownErrorPatternRepository } from "../../infrastructure/persistence/InMemoryKnownErrorPatternRepository.js";
import { KnownErrorPattern } from "../../domain/KnownErrorPattern.js";
import { AlertSeverity } from "../../domain/AlertSeverity.js";

const makePattern = (id: string, name: string) =>
  KnownErrorPattern.create({
    id,
    name,
    description: "テスト用パターン",
    eventNamePattern: "ec.payment.timeout",
    payloadConditions: [],
    severity: AlertSeverity.critical(),
    suggestedAction: "決済状態を確認する",
  });

describe("GetKnownErrorPatternsUseCase", () => {
  let patternRepo: InMemoryKnownErrorPatternRepository;

  beforeEach(() => {
    patternRepo = new InMemoryKnownErrorPatternRepository();
  });

  it("パターンが無い場合は空の PatternResponse を返す", async () => {
    const useCase = new GetKnownErrorPatternsUseCase(patternRepo);

    const response = await useCase.run();

    expect(response.patterns).toHaveLength(0);
  });

  it("登録済みの全パターンを PatternResponse として返す", async () => {
    await patternRepo.save(makePattern("pattern-1", "PAYMENT_TIMEOUT"));
    await patternRepo.save(makePattern("pattern-2", "INVENTORY_SHORTAGE"));
    const useCase = new GetKnownErrorPatternsUseCase(patternRepo);

    const response = await useCase.run();

    expect(response.patterns).toHaveLength(2);
    expect(response.patterns.map((p) => p.name).sort()).toEqual([
      "INVENTORY_SHORTAGE",
      "PAYMENT_TIMEOUT",
    ]);
  });
});
