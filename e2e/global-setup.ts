import { MongoClient, ObjectId } from "mongodb";

const BASE_URL = process.env.EC_BASE_URL ?? "http://localhost:3000";
const BACKOFFICE_BASE_URL = process.env.BACKOFFICE_BASE_URL ?? "http://localhost:3001";
const MONGO_URL = process.env.MONGO_URL ?? "mongodb://localhost:27017/ec";

let mongo: MongoClient;

async function waitForHealth(name: string, baseUrl: string): Promise<void> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`${name} did not become healthy within ${maxAttempts * 2}s`);
}

// ProductId extends Uuid なので有効な UUID v4 を使う
export const PRODUCT_IN_STOCK    = "11111111-1111-4111-8111-111111111111";
export const PRODUCT_OUT_OF_STOCK = "22222222-2222-4222-8222-222222222222";

async function seedInventory(): Promise<void> {
  const db = mongo.db();
  await db.collection("inventory").deleteMany({});
  await db.collection("inventory").insertMany([
    { _id: PRODUCT_IN_STOCK as unknown as ObjectId,     stock: 100, version: 0, updatedAt: new Date() },
    { _id: PRODUCT_OUT_OF_STOCK as unknown as ObjectId, stock: 0,   version: 0, updatedAt: new Date() },
  ]);
}

export async function setup(): Promise<void> {
  await waitForHealth("EC backend", BASE_URL);
  await waitForHealth("Backoffice backend", BACKOFFICE_BASE_URL);

  mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  await seedInventory();

  await fetch(`${BASE_URL}/demo/payment-mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "SUCCESS" }),
  });
}

export async function teardown(): Promise<void> {
  await mongo?.close();
}
