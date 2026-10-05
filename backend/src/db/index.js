import pg from "pg";
import { readFile } from "node:fs/promises";

/** The database is optional: it only backs accounts. Without DATABASE_URL there is no pool. */
export const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 })
  : null;

// An idle client losing its connection must not crash the server; queries will report the error.
pool?.on("error", (err) => console.error("Postgres connection error:", err.message));

export const query = (text, params) => {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  return pool.query(text, params);
};

/** Create tables if they don't exist yet. */
export async function migrate() {
  const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await query(sql);
}
