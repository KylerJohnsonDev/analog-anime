import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { log } from '../utils/logger';

// Paths are relative to where the server is started: the project root for both `npm run dev` and `npm run preview`.
const DATABASE_PATH = resolve(process.env['DATABASE_PATH'] ?? 'data/anime.db');
const MIGRATIONS_FOLDER = resolve('drizzle');

function createDb() {
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  const sqlite = new Database(DATABASE_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  // Bring the schema up to date on first use, so a fresh checkout needs no separate migrate step.
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  log('info', 'Database initialized and migrations applied', { 'db.path': DATABASE_PATH });
  return db;
}

let db: ReturnType<typeof createDb> | undefined;

export function useDb() {
  return (db ??= createDb());
}
