import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { RecentProject } from "../shared/types.ts";

function dir(): string {
  return app.getPath("userData");
}

function recentPath(): string {
  return path.join(dir(), "recent.json");
}

export function loadRecent(): RecentProject[] {
  try {
    const raw = JSON.parse(fs.readFileSync(recentPath(), "utf8")) as RecentProject[];
    return raw.filter((p) => p.path && fs.existsSync(path.join(p.path, "project.sqlite")));
  } catch {
    return [];
  }
}

export function touchRecent(name: string, folder: string): RecentProject[] {
  const now = new Date().toISOString();
  const list = loadRecent().filter((p) => p.path !== folder);
  list.unshift({ name, path: folder, opened_at: now });
  const clipped = list.slice(0, 12);
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(recentPath(), JSON.stringify(clipped, null, 2));
  return clipped;
}
