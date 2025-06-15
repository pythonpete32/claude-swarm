import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

export async function runMigrations(databaseUrl: string): Promise<LibSQLDatabase> {
  const client = createClient({ url: databaseUrl });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: "./migrations" });
  console.log("✅ Database migrations completed");

  return db;
}

export async function runMigrationsWithDatabase<T extends Record<string, unknown>>(
  db: LibSQLDatabase<T>,
): Promise<void> {
  await migrate(db, { migrationsFolder: "./migrations" });
  console.log("✅ Database migrations completed");
}
