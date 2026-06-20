import { describe, it, expect, beforeEach, vi } from "vitest";
import { PromotePatternUseCase } from "./PromotePatternUseCase.js";
import { InMemoryKnownErrorPatternRepository } from "../../infrastructure/persistence/InMemoryKnownErrorPatternRepository.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { KnownErrorPattern } from "../../domain/KnownErrorPattern.js";
import { AlertSeverity } from "../../domain/AlertSeverity.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";

const PATTERN_ID = "pattern-1";

const makePattern = () =>
  KnownErrorPattern.create({
    id: PATTERN_ID,
    name: "PAYMENT_TIMEOUT",
    description: "決済タイムアウト",
    eventNamePattern: "ec.payment.timeout",
    payloadConditions: [],
    severity: AlertSeverity.critical(),
    suggestedAction: "決済状態を確認する",
  });

describe("PromotePatternUseCase", () => {
  let patternRepo: InMemoryKnownErrorPatternRepository;
  let logger: ConsoleLogger;
  let useCase: PromotePatternUseCase;

  beforeEach(() => {
    patternRepo = new InMemoryKnownErrorPatternRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new PromotePatternUseCase(patternRepo, logger);
  });

  it("パターンが存在しない場合は MonitoringResourceNotFoundError を投げる", async () => {
    await expect(
      useCase.run({ patternId: "missing" }),
    ).rejects.toBeInstanceOf(MonitoringResourceNotFoundError);
  });

  it("既存パターンを昇格して保存する", async () => {
    await patternRepo.save(makePattern());

    await useCase.run({ patternId: PATTERN_ID });

    const saved = await patternRepo.findById(PATTERN_ID);
    expect(saved?.isPromoted).toBe(true);
    expect(saved?.promotedAt).toBeInstanceOf(Date);
  });
});
