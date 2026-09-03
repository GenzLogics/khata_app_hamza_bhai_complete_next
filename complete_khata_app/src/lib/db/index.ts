import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

let client: postgres.Sql | undefined;
let db: ReturnType<typeof drizzle> | undefined;

function fixConnectionString(url: string): string {
  const match = url.match(/^(.+:\/\/[^:]+:)([^@]+)(@.+)$/);
  if (!match) return url;
  const encodedPassword = encodeURIComponent(match[2]);
  return `${match[1]}${encodedPassword}${match[3]}`;
}

export function getDb() {
  if (!db) {
    const raw = process.env.DATABASE_URL;
    if (!raw) {
      throw new Error("DATABASE_URL is not set");
    }
    const connectionString = fixConnectionString(raw);
    client = postgres(connectionString, { max: 1, idle_timeout: 20 });
    db = drizzle(client);
  }
  return db;
}

export { db };
