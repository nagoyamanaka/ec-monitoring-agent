import { MongoClient } from "mongodb";
import { BackofficeApp, BackofficeAppOverrides } from "../../src/BackofficeApp.js";
import { MongoClientFactory } from "../../../../../Contexts/Shared/infrastructure/persistence/mongo/MongoClientFactory.js";
import { Alert } from "../../../../../Contexts/Monitoring/AlertAnalysis/domain/Alert.js";
import { AlertId } from "../../../../../Contexts/Monitoring/AlertAnalysis/domain/AlertId.js";
import { AlertSeverity } from "../../../../../Contexts/Monitoring/Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../../../Contexts/Monitoring/Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../../../Contexts/Monitoring/Shared/domain/MonitoringEventCategory.js";

// 結合テスト共通の足場。各 route の *.int.test.ts はここを使い、
// 「app を build → supertest で httpApp を叩く → Mongo を実体で検証」を共有する。
// 外部（LLM/GitHub/EC/infra Gateway）は config（Stub）と overrides（vi.fn）で遮断する。

export const MONGO_URL =
  process.env.MONGO_URL ?? "mongodb://localhost:27017/monitoring_integration";
export const INGEST_TOKEN = process.env.INGEST_TOKEN ?? "it-token";

const COLLECTIONS = [
  "alerts",
  "remediations",
  "known_error_patterns",
  "applied_infra_changes",
];

// app.build() が "backoffice" 名で登録した同一 Mongo クライアントを再利用する。
export async function sharedMongoClient(): Promise<MongoClient> {
  return MongoClientFactory.createClient("backoffice", { url: MONGO_URL });
}

export async function clearCollections(mongo: MongoClient): Promise<void> {
  for (const name of COLLECTIONS) {
    await mongo.db().collection(name).deleteMany({});
  }
}

// build 済みの app と、seed 用の Mongo クライアントをまとめて返す。
export async function startApp(
  overrides: BackofficeAppOverrides = {},
): Promise<{ app: BackofficeApp; mongo: MongoClient }> {
  const app = new BackofficeApp(overrides);
  await app.build();
  const mongo = await sharedMongoClient();
  await clearCollections(mongo);
  return { app, mongo };
}

// SECURITY（脆弱性）アラート。remediation / ingest / evidence で使う。
export function makeSecurityAlert(id: string, payload: Record<string, unknown>): Alert {
  return Alert.createAsUnknown({
    id: new AlertId(id),
    monitoringEvent: new MonitoringEvent({
      eventId: `evt-${id}`,
      eventName: "security.vulnerability_detected",
      aggregateId: "CVE-2024-BBBB",
      occurredOn: new Date("2026-01-01T00:00:00.000Z"),
      payload,
      category: MonitoringEventCategory.security(),
      severity: AlertSeverity.critical(),
      source: "trivy",
    }),
  });
}

// APPLICATION（業務失敗）アラート。alert / analytics / evidence で使う汎用 seed。
export function makeAppAlert(id: string, eventName = "ec.payment.timeout"): Alert {
  return Alert.createAsUnknown({
    id: new AlertId(id),
    monitoringEvent: new MonitoringEvent({
      eventId: `evt-${id}`,
      eventName,
      aggregateId: `order-${id}`,
      occurredOn: new Date("2026-01-01T00:00:00.000Z"),
      payload: { orderId: `order-${id}` },
      category: MonitoringEventCategory.application(),
      severity: AlertSeverity.critical(),
      source: "ec-backend",
    }),
  });
}
