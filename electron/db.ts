import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { Database, SqlJsStatic } from "sql.js";
import { SCHEMA } from "./schema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js") as (opts: { locateFile: (f: string) => string }) => Promise<SqlJsStatic>;

let SQL: SqlJsStatic | null = null;

function findWasm(): string {
  const candidates = [
    path.join(path.dirname(require.resolve("sql.js")), "sql-wasm.wasm"),
    path.join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm"),
    path.join(__dirname, "../node_modules/sql.js/dist/sql-wasm.wasm"),
    path.join(__dirname, "sql-wasm.wasm"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error("找不到 sql-wasm.wasm，請確認已安裝 sql.js");
}

export async function getSql(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  SQL = await initSqlJs({ locateFile: () => findWasm() });
  return SQL;
}

export class ProjectFile {
  db: Database;
  sqlitePath: string;
  folder: string;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(db: Database, folder: string) {
    this.db = db;
    this.folder = folder;
    this.sqlitePath = path.join(folder, "project.sqlite");
  }

  persistSoon(): void {
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.persistNow(), 80);
  }

  persistNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const data = this.db.export();
    fs.writeFileSync(this.sqlitePath, Buffer.from(data));
    this.dirty = false;
  }

  run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params as never[]);
    this.persistSoon();
  }

  all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    if (params.length) stmt.bind(params as never[]);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  }

  one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
    const rows = this.all<T>(sql, params);
    return rows[0] ?? null;
  }

  meta(key: string): string | null {
    const row = this.one<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]);
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.run("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
      key,
      value,
    ]);
  }
}

export async function openSqlite(folder: string, create: boolean): Promise<ProjectFile> {
  const SQL = await getSql();
  fs.mkdirSync(folder, { recursive: true });
  fs.mkdirSync(path.join(folder, "media"), { recursive: true });
  fs.mkdirSync(path.join(folder, "exports"), { recursive: true });
  const sqlitePath = path.join(folder, "project.sqlite");
  let db: Database;
  if (create || !fs.existsSync(sqlitePath)) {
    db = new SQL.Database();
    db.exec(SCHEMA);
  } else {
    const buf = fs.readFileSync(sqlitePath);
    db = new SQL.Database(buf);
    db.exec(SCHEMA);
  }
  const pf = new ProjectFile(db, folder);
  ensureSceneBodyColumn(db);
  pf.persistNow();
  return pf;
}

function ensureSceneBodyColumn(db: Database): void {
  const stmt = db.prepare("PRAGMA table_info(scenes)");
  let has = false;
  while (stmt.step()) {
    const row = stmt.getAsObject() as { name: string };
    if (row.name === "body") has = true;
  }
  stmt.free();
  if (!has) db.run("ALTER TABLE scenes ADD COLUMN body TEXT NOT NULL DEFAULT ''");
}
