// @ts-nocheck
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AggregateRoot } from "../../../domain/AggregateRoot.js";

export abstract class DrizzleRepository<T extends AggregateRoot> {
  constructor(protected readonly db: NodePgDatabase) {}
}
