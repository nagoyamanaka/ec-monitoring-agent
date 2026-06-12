// @ts-nocheck
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DrizzleConfig } from "./DrizzleConfig.js";

export class DrizzleClientFactory {
  static createClient(config: DrizzleConfig): NodePgDatabase {
    const pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });

    return drizzle(pool);
  }
}
