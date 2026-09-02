import fs from "node:fs";
import path from "node:path";
import { id, nowIso, splitScenes, joinScenes, wordCount } from "../shared/text.ts";
import type { WordCountMode } from "../shared/text.ts";
import { openSqlite, type ProjectFile } from "./db.ts";
import { seedEmpty, seedDemo } from "./seed.ts";

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function decodeRow(row: Record<string, unknown>, jsonKeys: string[]): Record<string, unknown> {
  const out = { ...row };
  for (const k of jsonKeys) {
    if (k in out) out[k] = parseJson(out[k], []);
  }
  return out;
}

export class Session {
  pf: ProjectFile;

  constructor(pf: ProjectFile) {
    this.pf = pf;
    this.migrateSceneBodies();
    this.ensureTermKinds();
    this.ensureParts();
  }

  get folder(): string {
    return this.pf.folder;
  }

  get name(): string {
    return this.pf.meta("name") || path.basename(this.folder);
  }

  mode(): WordCountMode {
    return (this.pf.meta("word_count_mode") as WordCountMode) || "no_space";
  }

  getMeta() {
    return {
      id: this.pf.meta("id"),
      name: this.pf.meta("name"),
      created_at: this.pf.meta("created_at"),
      updated_at: this.pf.meta("updated_at"),
      timeline_mode: this.pf.meta("timeline_mode") || "relative",
      word_count_mode: this.mode(),
    };
  }

  updateMeta(patch: Record<string, string>) {
    for (const [k, v] of Object.entries(patch)) {
      if (["name", "timeline_mode", "word_count_mode"].includes(k)) this.pf.setMeta(k, v);
    }
    this.pf.setMeta("updated_at", nowIso());
    if (patch.word_count_mode) this.recalcAllWordCounts();
  }

  private recalcAllWordCounts() {
    const chapters = this.pf.all<{ id: string; body: string }>(
      "SELECT id, body FROM chapters WHERE deleted_at IS NULL",
    );
    for (const ch of chapters) {
      this.syncScenesFromText(ch.id, ch.body);
      this.rebuildChapterFromScenes(ch.id);
    }
  }

  ensureParts() {
    this.pf.db.run(`CREATE TABLE IF NOT EXISTS parts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    const info = this.pf.db.prepare("PRAGMA table_info(volumes)");
    let hasPart = false;
    while (info.step()) {
      if ((info.getAsObject() as { name: string }).name === "part_id") hasPart = true;
    }
    info.free();
    if (!hasPart) this.pf.db.run("ALTER TABLE volumes ADD COLUMN part_id TEXT");
    const n = this.pf.one<{ n: number }>("SELECT COUNT(*) AS n FROM parts")?.n ?? 0;
    if (n === 0) {
      const pid = id();
      const t = nowIso();
      this.pf.run(
        "INSERT INTO parts(id,title,sort_order,summary,created_at,updated_at) VALUES(?,?,0,'',?,?)",
        [pid, "第一部", t, t],
      );
      this.pf.run("UPDATE volumes SET part_id = ? WHERE part_id IS NULL OR part_id = ''", [pid]);
    } else {
      const first = this.pf.one<{ id: string }>("SELECT id FROM parts ORDER BY sort_order LIMIT 1");
      if (first) {
        this.pf.run("UPDATE volumes SET part_id = ? WHERE part_id IS NULL OR part_id = ''", [first.id]);
      }
    }
    this.pf.persistNow();
  }

  listParts() {
    return this.pf.all("SELECT * FROM parts ORDER BY sort_order");
  }

  createPart(title = "新的一部") {
    const order =
      (this.pf.one<{ n: number }>("SELECT COALESCE(MAX(sort_order),-1) AS n FROM parts")?.n ?? -1) + 1;
    const pid = id();
    const t = nowIso();
    this.pf.run("INSERT INTO parts(id,title,sort_order,summary,created_at,updated_at) VALUES(?,?,?,?,?,?)", [
      pid,
      title,
      order,
      "",
      t,
      t,
    ]);
    this.createVolume("第一卷", pid);
    this.pf.persistNow();
    return pid;
  }

  updatePart(args: { id: string; title?: string; summary?: string }) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM parts WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到部");
    this.pf.run("UPDATE parts SET title=?, summary=?, updated_at=? WHERE id=?", [
      args.title ?? row.title,
      args.summary ?? row.summary,
      nowIso(),
      args.id,
    ]);
  }

  deletePart(pid: string) {
    const vols = this.pf.all<{ id: string }>("SELECT id FROM volumes WHERE part_id = ?", [pid]);
    const t = nowIso();
    for (const v of vols) {
      this.pf.run("UPDATE chapters SET deleted_at = ? WHERE volume_id = ? AND deleted_at IS NULL", [t, v.id]);
      this.pf.run("DELETE FROM volumes WHERE id = ?", [v.id]);
    }
    this.pf.run("DELETE FROM parts WHERE id = ?", [pid]);
    this.pf.persistNow();
  }

  getTree() {
    const parts = this.pf.all<Record<string, unknown>>("SELECT * FROM parts ORDER BY sort_order");
    return parts.map((p) => {
      const volumes = this.pf.all<Record<string, unknown>>(
        "SELECT id, title, sort_order, summary, part_id FROM volumes WHERE part_id = ? ORDER BY sort_order",
        [p.id],
      );
      const mapped = volumes.map((v) => {
        const chapters = this.pf.all<Record<string, unknown>>(
          `SELECT id, title, sort_order, status, word_count FROM chapters
           WHERE volume_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
          [v.id],
        );
        const chaptersMapped = chapters.map((c) => ({
          ...c,
          scenes: this.pf.all(
            "SELECT id, title, word_count FROM scenes WHERE chapter_id = ? ORDER BY sort_order",
            [c.id],
          ),
        }));
        const wc = chapters.reduce((n, c) => n + Number(c.word_count || 0), 0);
        return { ...v, word_count: wc, chapters: chaptersMapped };
      });
      const wc = mapped.reduce((n, v) => n + Number(v.word_count || 0), 0);
      return { ...p, word_count: wc, volumes: mapped };
    });
  }

  bookWordCount(): number {
    const row = this.pf.one<{ n: number }>(
      "SELECT COALESCE(SUM(word_count),0) AS n FROM chapters WHERE deleted_at IS NULL",
    );
    return row?.n ?? 0;
  }

  createVolume(title = "新分卷", partId?: string) {
    const pid =
      partId ||
      this.pf.one<{ id: string }>("SELECT id FROM parts ORDER BY sort_order LIMIT 1")?.id;
    if (!pid) throw new Error("請先建立一部");
    const order =
      (this.pf.one<{ n: number }>(
        "SELECT COALESCE(MAX(sort_order),-1) AS n FROM volumes WHERE part_id = ?",
        [pid],
      )?.n ?? -1) + 1;
    const vid = id();
    const t = nowIso();
    this.pf.run(
      "INSERT INTO volumes(id,title,sort_order,summary,part_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      [vid, title, order, "", pid, t, t],
    );
    this.createChapter(vid, "新章節");
    return vid;
  }

  updateVolume(args: { id: string; title?: string; summary?: string }) {
    const row = this.pf.one("SELECT * FROM volumes WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到卷");
    this.pf.run("UPDATE volumes SET title=?, summary=?, updated_at=? WHERE id=?", [
      args.title ?? row.title,
      args.summary ?? row.summary,
      nowIso(),
      args.id,
    ]);
  }

  deleteVolume(vid: string) {
    const t = nowIso();
    this.pf.run("UPDATE chapters SET deleted_at = ? WHERE volume_id = ? AND deleted_at IS NULL", [t, vid]);
    this.pf.run("DELETE FROM volumes WHERE id = ?", [vid]);
  }

  createChapter(volumeId: string, title = "新章節") {
    const order =
      (this.pf.one<{ n: number }>(
        "SELECT COALESCE(MAX(sort_order),-1) AS n FROM chapters WHERE volume_id = ? AND deleted_at IS NULL",
        [volumeId],
      )?.n ?? -1) + 1;
    const cid = id();
    const t = nowIso();
    this.pf.run(
      `INSERT INTO chapters(id,volume_id,title,sort_order,summary,status,body,word_count,created_at,updated_at)
       VALUES(?,?,?,?,?,'draft','',0,?,?)`,
      [cid, volumeId, title, order, "", t, t],
    );
    const sid = id();
    this.pf.run(
      "INSERT INTO scenes(id,chapter_id,sort_order,title,summary,word_count,body) VALUES(?,?,0,'場景 1','',0,'')",
      [sid, cid],
    );
    return cid;
  }

  updateChapter(args: {
    id: string;
    title?: string;
    summary?: string;
    status?: string;
    volume_id?: string;
    sort_order?: number;
  }) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM chapters WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到章");
    this.pf.run(
      `UPDATE chapters SET title=?, summary=?, status=?, volume_id=?, sort_order=?, updated_at=? WHERE id=?`,
      [
        args.title ?? row.title,
        args.summary ?? row.summary,
        args.status ?? row.status,
        args.volume_id ?? row.volume_id,
        args.sort_order ?? row.sort_order,
        nowIso(),
        args.id,
      ],
    );
  }

  deleteChapter(cid: string) {
    this.pf.run("UPDATE chapters SET deleted_at = ?, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), cid]);
  }

  listDeletedChapters() {
    return this.pf.all(
      "SELECT id, title, volume_id, deleted_at, word_count FROM chapters WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
    );
  }

  restoreChapter(cid: string) {
    this.pf.run("UPDATE chapters SET deleted_at = NULL, updated_at = ? WHERE id = ?", [nowIso(), cid]);
  }

  getChapter(cid: string) {
    const ch = this.pf.one<Record<string, unknown>>("SELECT * FROM chapters WHERE id = ?", [cid]);
    if (!ch) throw new Error("找不到章");
    const scenes = this.listScenes(cid);
    const snapshots = this.pf.all(
      "SELECT id, created_at, trigger, note, length(body) AS bytes FROM snapshots WHERE chapter_id = ? ORDER BY created_at DESC",
      [cid],
    );
    return { ...ch, scenes, snapshots, book_word_count: this.bookWordCount() };
  }

  listScenes(cid: string) {
    const scenes = this.pf.all<Record<string, unknown>>(
      "SELECT * FROM scenes WHERE chapter_id = ? ORDER BY sort_order",
      [cid],
    );
    return scenes.map((s) => ({
      ...s,
      presence: this.pf.all<{ character_id: string }>(
        "SELECT character_id FROM scene_presence WHERE scene_id = ?",
        [s.id],
      ).map((p) => p.character_id),
      threads: this.pf.all(
        "SELECT thread_id, beat_id FROM scene_threads WHERE scene_id = ?",
        [s.id],
      ),
    }));
  }

  migrateSceneBodies() {
    const chapters = this.pf.all<{ id: string; body: string }>("SELECT id, body FROM chapters");
    for (const ch of chapters) {
      const scenes = this.pf.all<{ id: string; body: string }>(
        "SELECT id, body FROM scenes WHERE chapter_id = ? ORDER BY sort_order",
        [ch.id],
      );
      const empty = scenes.length === 0 || scenes.every((s) => !s.body);
      if (empty && ch.body) this.syncScenesFromText(ch.id, ch.body);
    }
  }

  private reindexScenes(chapterId: string, ids: string[]) {
    ids.forEach((sid, i) => {
      this.pf.run("UPDATE scenes SET sort_order = ? WHERE id = ?", [i, sid]);
    });
  }

  private rebuildChapterFromScenes(chapterId: string) {
    const scenes = this.pf.all<{ body: string }>(
      "SELECT body FROM scenes WHERE chapter_id = ? ORDER BY sort_order",
      [chapterId],
    );
    const body = joinScenes(scenes.map((s) => s.body || ""));
    const wc = wordCount(body, this.mode());
    this.pf.run("UPDATE chapters SET body = ?, word_count = ?, updated_at = ? WHERE id = ?", [
      body,
      wc,
      nowIso(),
      chapterId,
    ]);
    return { body, word_count: wc };
  }

  syncScenesFromText(chapterId: string, body: string) {
    const parts = splitScenes(body);
    const existing = this.pf.all<Record<string, unknown>>(
      "SELECT * FROM scenes WHERE chapter_id = ? ORDER BY sort_order",
      [chapterId],
    );
    const mode = this.mode();
    const keep = Math.min(existing.length, parts.length);
    for (let i = 0; i < keep; i++) {
      const wc = wordCount(parts[i], mode);
      this.pf.run("UPDATE scenes SET sort_order = ?, word_count = ?, body = ? WHERE id = ?", [
        i,
        wc,
        parts[i],
        existing[i].id,
      ]);
    }
    for (let i = keep; i < parts.length; i++) {
      const sid = id();
      const wc = wordCount(parts[i], mode);
      this.pf.run(
        "INSERT INTO scenes(id,chapter_id,sort_order,title,summary,word_count,body) VALUES(?,?,?,?, '',?,?)",
        [sid, chapterId, i, `場景 ${i + 1}`, wc, parts[i]],
      );
    }
    if (parts.length < existing.length) {
      for (let i = parts.length; i < existing.length; i++) {
        const sid = existing[i].id as string;
        this.pf.run("DELETE FROM scene_presence WHERE scene_id = ?", [sid]);
        this.pf.run("DELETE FROM scene_threads WHERE scene_id = ?", [sid]);
        this.pf.run("DELETE FROM scenes WHERE id = ?", [sid]);
      }
    }
  }

  persistBody(cid: string, body: string, opts: { snapshot?: boolean; trigger?: string; note?: string } = {}) {
    const row = this.pf.one<{ body: string }>("SELECT body FROM chapters WHERE id = ?", [cid]);
    if (!row) throw new Error("找不到章");
    this.syncScenesFromText(cid, body);
    const rebuilt = this.rebuildChapterFromScenes(cid);
    let snapshotId: string | null = null;
    if (opts.snapshot && row.body !== rebuilt.body) {
      snapshotId = id();
      this.pf.run(
        "INSERT INTO snapshots(id,chapter_id,created_at,body,trigger,note) VALUES(?,?,?,?,?,?)",
        [snapshotId, cid, nowIso(), rebuilt.body, opts.trigger || "save", opts.note || ""],
      );
    }
    this.pf.setMeta("updated_at", nowIso());
    this.pf.persistNow();
    return { word_count: rebuilt.word_count, snapshot_id: snapshotId };
  }

  saveSceneBody(sceneId: string, body: string, opts: { snapshot?: boolean } = {}) {
    const scene = this.pf.one<{ chapter_id: string }>("SELECT chapter_id FROM scenes WHERE id = ?", [sceneId]);
    if (!scene) throw new Error("找不到場景");
    const wc = wordCount(body, this.mode());
    this.pf.run("UPDATE scenes SET body = ?, word_count = ? WHERE id = ?", [body, wc, sceneId]);
    const prev = this.pf.one<{ body: string }>("SELECT body FROM chapters WHERE id = ?", [scene.chapter_id]);
    const rebuilt = this.rebuildChapterFromScenes(scene.chapter_id);
    if (opts.snapshot && prev && prev.body !== rebuilt.body) {
      this.pf.run(
        "INSERT INTO snapshots(id,chapter_id,created_at,body,trigger,note) VALUES(?,?,?,?, 'save','')",
        [id(), scene.chapter_id, nowIso(), rebuilt.body],
      );
    }
    this.pf.setMeta("updated_at", nowIso());
    this.pf.persistNow();
    return { word_count: rebuilt.word_count, scene_word_count: wc };
  }

  createScene(chapterId: string, afterId?: string) {
    const existing = this.pf.all<{ id: string }>(
      "SELECT id FROM scenes WHERE chapter_id = ? ORDER BY sort_order",
      [chapterId],
    );
    const sid = id();
    const idx = afterId ? existing.findIndex((s) => s.id === afterId) + 1 : existing.length;
    const insertAt = Math.max(0, idx);
    this.pf.run(
      "INSERT INTO scenes(id,chapter_id,sort_order,title,summary,word_count,body) VALUES(?,?,?,?, '',0,'')",
      [sid, chapterId, insertAt, `場景 ${existing.length + 1}`],
    );
    const ids = existing.map((s) => s.id);
    ids.splice(insertAt, 0, sid);
    this.reindexScenes(chapterId, ids);
    this.rebuildChapterFromScenes(chapterId);
    this.pf.persistNow();
    return sid;
  }

  deleteScene(sceneId: string) {
    const scene = this.pf.one<{ chapter_id: string }>("SELECT chapter_id FROM scenes WHERE id = ?", [sceneId]);
    if (!scene) throw new Error("找不到場景");
    const existing = this.pf.all<{ id: string }>(
      "SELECT id FROM scenes WHERE chapter_id = ? ORDER BY sort_order",
      [scene.chapter_id],
    );
    if (existing.length <= 1) {
      this.pf.run("UPDATE scenes SET body = '', word_count = 0, title = '場景 1', summary = '' WHERE id = ?", [sceneId]);
      this.rebuildChapterFromScenes(scene.chapter_id);
      this.pf.persistNow();
      return { cleared: true, chapter_id: scene.chapter_id };
    }
    this.pf.run("DELETE FROM scene_presence WHERE scene_id = ?", [sceneId]);
    this.pf.run("DELETE FROM scene_threads WHERE scene_id = ?", [sceneId]);
    this.pf.run("DELETE FROM scenes WHERE id = ?", [sceneId]);
    const ids = existing.map((s) => s.id).filter((x) => x !== sceneId);
    this.reindexScenes(scene.chapter_id, ids);
    this.rebuildChapterFromScenes(scene.chapter_id);
    this.pf.persistNow();
    const idx = existing.findIndex((s) => s.id === sceneId);
    const next = ids[Math.min(ids.length - 1, Math.max(0, idx - 1))];
    return { cleared: false, chapter_id: scene.chapter_id, next_id: next };
  }

  reorderScenes(chapterId: string, ids: string[]) {
    const existing = this.pf.all<{ id: string }>(
      "SELECT id FROM scenes WHERE chapter_id = ? ORDER BY sort_order",
      [chapterId],
    );
    if (existing.length !== ids.length || existing.some((s) => !ids.includes(s.id))) {
      throw new Error("場景順序不完整");
    }
    this.reindexScenes(chapterId, ids);
    this.rebuildChapterFromScenes(chapterId);
    this.pf.persistNow();
  }

  saveChapter(args: { id: string; snapshot?: boolean }) {
    const rebuilt = this.rebuildChapterFromScenes(args.id);
    let snapshotId: string | null = null;
    if (args.snapshot !== false) {
      const last = this.pf.one<{ body: string }>(
        "SELECT body FROM snapshots WHERE chapter_id = ? ORDER BY created_at DESC LIMIT 1",
        [args.id],
      );
      if (!last || last.body !== rebuilt.body) {
        snapshotId = id();
        this.pf.run(
          "INSERT INTO snapshots(id,chapter_id,created_at,body,trigger,note) VALUES(?,?,?,?, 'save','')",
          [snapshotId, args.id, nowIso(), rebuilt.body],
        );
      }
    }
    const sync = this.syncChapterLinks(args.id);
    this.pf.persistNow();
    return { word_count: rebuilt.word_count, snapshot_id: snapshotId, sync };
  }

  syncChapterLinks(chapterId: string) {
    const ch = this.pf.one<{ title: string }>("SELECT title FROM chapters WHERE id = ?", [chapterId]);
    if (!ch) throw new Error("找不到章節");
    const scenes = this.listScenes(chapterId) as {
      id: string;
      title: string;
      summary: string;
      body?: string;
      time_point_id: string | null;
      location_id: string | null;
      presence: string[];
      threads: { thread_id: string }[];
    }[];
    const characters = this.listCharacters() as { id: string; name: string; aliases: string[] }[];
    const locations = this.listLocations() as { id: string; name: string }[];
    const report = { presence: 0, events: 0, beats: 0, locations: 0 };

    for (const scene of scenes) {
      const blob = `${scene.title || ""}\n${scene.summary || ""}\n${scene.body || ""}`;
      const presence = new Set(scene.presence);

      for (const c of characters) {
        const names = [c.name, ...(c.aliases || [])].filter((n) => n && n.length >= 2);
        if (names.some((n) => blob.includes(n)) && !presence.has(c.id)) {
          this.pf.run("INSERT INTO scene_presence(scene_id, character_id) VALUES(?,?)", [scene.id, c.id]);
          presence.add(c.id);
          report.presence += 1;
        }
      }

      if (!scene.location_id) {
        const hit = locations.find((l) => l.name && l.name.length >= 2 && blob.includes(l.name));
        if (hit) {
          this.pf.run("UPDATE scenes SET location_id = ? WHERE id = ?", [hit.id, scene.id]);
          scene.location_id = hit.id;
          report.locations += 1;
        }
      }

      if (scene.time_point_id) {
        for (const cid of presence) {
          const exists = this.pf.one(
            "SELECT id FROM character_events WHERE character_id = ? AND scene_id = ?",
            [cid, scene.id],
          );
          if (!exists) {
            const sceneTitle = scene.title || "未命名場景";
            this.addEvent({
              character_id: cid,
              time_point_id: scene.time_point_id,
              scene_id: scene.id,
              summary: `登場於〈${ch.title}〉「${sceneTitle}」`,
            });
            report.events += 1;
          }
        }
        if (scene.location_id) {
          for (const cid of presence) {
            const st = this.pf.one<{ id: string }>(
              "SELECT id FROM character_states WHERE character_id = ? AND time_point_id = ?",
              [cid, scene.time_point_id],
            );
            if (st) {
              this.pf.run("UPDATE character_states SET location_id = ? WHERE id = ?", [scene.location_id, st.id]);
            }
          }
        }
      }

      for (const t of scene.threads) {
        const exists = this.pf.one(
          "SELECT id FROM thread_beats WHERE thread_id = ? AND scene_id = ?",
          [t.thread_id, scene.id],
        );
        if (!exists) {
          this.addBeat({
            thread_id: t.thread_id,
            kind: "progress",
            time_point_id: scene.time_point_id,
            scene_id: scene.id,
            summary: `於〈${ch.title}〉推進`,
          });
          report.beats += 1;
        }
      }
    }
    return report;
  }

  listAllRelationships() {
    return this.pf.all(
      `SELECT r.*, a.name AS from_name, b.name AS to_name, a.color AS from_color, b.color AS to_color
       FROM relationships r
       JOIN characters a ON a.id = r.from_id
       JOIN characters b ON b.id = r.to_id`,
    );
  }

  reorderTimePoints(ids: string[]) {
    const existing = this.pf.all<{ id: string }>("SELECT id FROM time_points");
    if (existing.length !== ids.length || existing.some((p) => !ids.includes(p.id))) {
      throw new Error("時刻順序不完整");
    }
    ids.forEach((tid, i) => {
      this.pf.run("UPDATE time_points SET sort_key = ? WHERE id = ?", [(i + 1) * 1000, tid]);
    });
    this.pf.persistNow();
  }

  insertTimePointAt(label: string, index: number) {
    const all = this.listTimePoints() as { id: string }[];
    const tid = this.createTimePoint({ label: label || "未命名時刻" });
    const ids = all.map((p) => p.id);
    const at = Math.max(0, Math.min(index, ids.length));
    ids.splice(at, 0, tid);
    this.reorderTimePoints(ids);
    return tid;
  }

  listSnapshots(cid: string) {
    return this.pf.all(
      "SELECT id, chapter_id, created_at, trigger, note, body FROM snapshots WHERE chapter_id = ? ORDER BY created_at DESC",
      [cid],
    );
  }

  restoreSnapshot(snapshotId: string) {
    const snap = this.pf.one<Record<string, unknown>>("SELECT * FROM snapshots WHERE id = ?", [snapshotId]);
    if (!snap) throw new Error("找不到快照");
    const cid = snap.chapter_id as string;
    const current = this.pf.one<{ body: string }>("SELECT body FROM chapters WHERE id = ?", [cid]);
    if (current && current.body !== snap.body) {
      this.pf.run(
        "INSERT INTO snapshots(id,chapter_id,created_at,body,trigger,note) VALUES(?,?,?,?, 'restore', '還原前')",
        [id(), cid, nowIso(), current.body],
      );
    }
    this.persistBody(cid, snap.body as string, { snapshot: false });
    return this.getChapter(cid);
  }

  pruneSnapshots(cid: string) {
    const rows = this.pf.all<{ id: string }>(
      "SELECT id FROM snapshots WHERE chapter_id = ? ORDER BY created_at",
      [cid],
    );
    if (rows.length <= 50) return { deleted: 0 };
    const keep = new Set<string>();
    keep.add(rows[0].id);
    keep.add(rows[rows.length - 1].id);
    for (const r of rows.slice(-20)) keep.add(r.id);
    let deleted = 0;
    for (const r of rows) {
      if (!keep.has(r.id)) {
        this.pf.run("DELETE FROM snapshots WHERE id = ?", [r.id]);
        deleted++;
      }
    }
    return { deleted };
  }

  updateScene(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM scenes WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到場景");
    this.pf.run(
      `UPDATE scenes SET title=?, summary=?, time_point_id=?, location_id=?, pov_character_id=? WHERE id=?`,
      [
        args.title ?? row.title,
        args.summary ?? row.summary,
        args.time_point_id === undefined ? row.time_point_id : args.time_point_id,
        args.location_id === undefined ? row.location_id : args.location_id,
        args.pov_character_id === undefined ? row.pov_character_id : args.pov_character_id,
        args.id,
      ],
    );
    if (Array.isArray(args.presence)) {
      this.pf.run("DELETE FROM scene_presence WHERE scene_id = ?", [args.id]);
      for (const cid of args.presence as string[]) {
        this.pf.run("INSERT INTO scene_presence(scene_id, character_id) VALUES(?,?)", [args.id, cid]);
      }
    }
    if (Array.isArray(args.threads)) {
      this.pf.run("DELETE FROM scene_threads WHERE scene_id = ?", [args.id]);
      for (const t of args.threads as { thread_id: string; beat_id?: string | null }[]) {
        this.pf.run("INSERT INTO scene_threads(scene_id, thread_id, beat_id) VALUES(?,?,?)", [
          args.id,
          t.thread_id,
          t.beat_id ?? null,
        ]);
      }
    }
  }

  // ---- time ----
  listTimePoints() {
    return this.pf.all("SELECT * FROM time_points ORDER BY sort_key");
  }

  createTimePoint(args: { label: string; after_id?: string; before_id?: string }) {
    const all = this.listTimePoints() as { id: string; sort_key: number }[];
    let sortKey = 1000;
    if (args.after_id && args.before_id) {
      const a = all.find((x) => x.id === args.after_id);
      const b = all.find((x) => x.id === args.before_id);
      sortKey = ((a?.sort_key ?? 0) + (b?.sort_key ?? 0)) / 2;
    } else if (args.after_id) {
      const a = all.find((x) => x.id === args.after_id);
      const idx = all.findIndex((x) => x.id === args.after_id);
      const next = all[idx + 1];
      sortKey = next ? (a!.sort_key + next.sort_key) / 2 : a!.sort_key + 1000;
    } else if (all.length) {
      sortKey = all[all.length - 1].sort_key + 1000;
    }
    const tid = id();
    this.pf.run(
      "INSERT INTO time_points(id,sort_key,label,notes) VALUES(?,?,?, '')",
      [tid, sortKey, args.label || "未名時點"],
    );
    return tid;
  }

  updateTimePoint(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM time_points WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到時間點");
    this.pf.run(
      `UPDATE time_points SET label=?, era=?, year=?, month=?, day=?, season=?, hour=?, notes=? WHERE id=?`,
      [
        args.label ?? row.label,
        args.era ?? row.era,
        args.year ?? row.year,
        args.month ?? row.month,
        args.day ?? row.day,
        args.season ?? row.season,
        args.hour ?? row.hour,
        args.notes ?? row.notes,
        args.id,
      ],
    );
  }

  deleteTimePoint(tid: string) {
    this.pf.run("UPDATE scenes SET time_point_id = NULL WHERE time_point_id = ?", [tid]);
    this.pf.run("DELETE FROM time_points WHERE id = ?", [tid]);
  }

  timelineView() {
    const points = this.listTimePoints() as { id: string }[];
    return points.map((p) => ({
      ...p,
      scenes: this.pf.all(
        `SELECT s.id, s.title, s.chapter_id, c.title AS chapter_title
         FROM scenes s JOIN chapters c ON c.id = s.chapter_id
         WHERE s.time_point_id = ? AND c.deleted_at IS NULL`,
        [p.id],
      ),
      events: this.pf.all(
        `SELECT e.id, e.summary, e.character_id, ch.name AS character_name
         FROM character_events e JOIN characters ch ON ch.id = e.character_id
         WHERE e.time_point_id = ?`,
        [p.id],
      ),
      beats: this.pf.all(
        `SELECT b.id, b.kind, b.summary, b.thread_id, t.name AS thread_name, t.type AS thread_type
         FROM thread_beats b JOIN threads t ON t.id = b.thread_id
         WHERE b.time_point_id = ?`,
        [p.id],
      ),
      states: this.pf.all(
        `SELECT st.id, st.character_id, st.status_title, st.age, ch.name AS character_name
         FROM character_states st JOIN characters ch ON ch.id = st.character_id
         WHERE st.time_point_id = ?`,
        [p.id],
      ),
    }));
  }

  // ---- characters ----
  listCharacters() {
    return this.pf.all("SELECT * FROM characters ORDER BY name").map((r) =>
      decodeRow(r as Record<string, unknown>, ["aliases"]),
    );
  }

  getCharacter(cid: string) {
    const c = this.pf.one<Record<string, unknown>>("SELECT * FROM characters WHERE id = ?", [cid]);
    if (!c) throw new Error("找不到角色");
    return {
      ...decodeRow(c, ["aliases"]),
      states: this.pf.all(
        "SELECT * FROM character_states WHERE character_id = ?",
        [cid],
      ),
      events: this.pf.all(
        "SELECT * FROM character_events WHERE character_id = ? ",
        [cid],
      ),
      relationships: this.pf.all(
        `SELECT r.*, a.name AS from_name, b.name AS to_name
         FROM relationships r
         JOIN characters a ON a.id = r.from_id
         JOIN characters b ON b.id = r.to_id
         WHERE r.from_id = ? OR r.to_id = ?`,
        [cid, cid],
      ),
      knowledge: this.pf.all(
        `SELECT k.*, f.statement, f.is_secret, f.true_in_canon
         FROM character_knowledge k JOIN facts f ON f.id = k.fact_id
         WHERE k.character_id = ?`,
        [cid],
      ),
    };
  }

  upsertTerm(surface: string, kind: string, entityType: string, entityId: string) {
    const existing = this.pf.one(
      "SELECT id FROM terms WHERE linked_entity_type = ? AND linked_entity_id = ? AND surface = ?",
      [entityType, entityId, surface],
    );
    if (existing) return;
    this.pf.run(
      `INSERT INTO terms(id,surface,normalized,kind,linked_entity_type,linked_entity_id,forbidden_variants,notes)
       VALUES(?,?,?,?,?,?, '[]','')`,
      [id(), surface, surface, kind, entityType, entityId],
    );
  }

  createCharacter(args: Record<string, unknown>) {
    const cid = id();
    const aliases = JSON.stringify(args.aliases ?? []);
    this.pf.run(
      `INSERT INTO characters(id,name,aliases,gender,appearance,personality,speech_pattern,goals,notes,color)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        cid,
        args.name || "未名",
        aliases,
        args.gender || "",
        args.appearance || "",
        args.personality || "",
        args.speech_pattern || "",
        args.goals || "",
        args.notes || "",
        args.color || "#9b2d1f",
      ],
    );
    this.upsertTerm(String(args.name || "未名"), "person", "character", cid);
    const firstTp = this.pf.one<{ id: string }>("SELECT id FROM time_points ORDER BY sort_key LIMIT 1");
    if (firstTp && (args.age || args.status_title || args.faction_id)) {
      this.pf.run(
        `INSERT INTO character_states(id,character_id,time_point_id,age,status_title,faction_id,location_id,rank_id,alive)
         VALUES(?,?,?,?,?,?,?,?,1)`,
        [
          id(),
          cid,
          firstTp.id,
          args.age || "",
          args.status_title || "",
          args.faction_id || null,
          args.location_id || null,
          args.rank_id || null,
        ],
      );
    }
    return cid;
  }

  updateCharacter(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM characters WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到角色");
    const aliases = args.aliases ? JSON.stringify(args.aliases) : row.aliases;
    this.pf.run(
      `UPDATE characters SET name=?, aliases=?, gender=?, appearance=?, personality=?, speech_pattern=?, goals=?, notes=?, color=? WHERE id=?`,
      [
        args.name ?? row.name,
        aliases,
        args.gender ?? row.gender,
        args.appearance ?? row.appearance,
        args.personality ?? row.personality,
        args.speech_pattern ?? row.speech_pattern,
        args.goals ?? row.goals,
        args.notes ?? row.notes,
        args.color ?? row.color,
        args.id,
      ],
    );
    this.upsertTerm(String(args.name ?? row.name), "person", "character", String(args.id));
  }

  deleteCharacter(cid: string) {
    this.pf.run("DELETE FROM character_states WHERE character_id = ?", [cid]);
    this.pf.run("DELETE FROM character_events WHERE character_id = ?", [cid]);
    this.pf.run("DELETE FROM relationships WHERE from_id = ? OR to_id = ?", [cid, cid]);
    this.pf.run("DELETE FROM character_knowledge WHERE character_id = ?", [cid]);
    this.pf.run("DELETE FROM scene_presence WHERE character_id = ?", [cid]);
    this.pf.run("DELETE FROM characters WHERE id = ?", [cid]);
  }

  addState(args: Record<string, unknown>) {
    const sid = id();
    this.pf.run(
      `INSERT INTO character_states(id,character_id,time_point_id,age,status_title,faction_id,location_id,rank_id,alive,appearance_override,notes)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [
        sid,
        args.character_id,
        args.time_point_id,
        args.age || "",
        args.status_title || "",
        args.faction_id || null,
        args.location_id || null,
        args.rank_id || null,
        args.alive === 0 || args.alive === false ? 0 : 1,
        args.appearance_override || "",
        args.notes || "",
      ],
    );
    return sid;
  }

  deleteState(sid: string) {
    this.pf.run("DELETE FROM character_states WHERE id = ?", [sid]);
  }

  addEvent(args: Record<string, unknown>) {
    const eid = id();
    this.pf.run(
      "INSERT INTO character_events(id,character_id,time_point_id,scene_id,summary) VALUES(?,?,?,?,?)",
      [eid, args.character_id, args.time_point_id, args.scene_id || null, args.summary || ""],
    );
    return eid;
  }

  deleteEvent(eid: string) {
    this.pf.run("DELETE FROM character_events WHERE id = ?", [eid]);
  }

  addRelationship(args: Record<string, unknown>) {
    const rid = id();
    this.pf.run(
      `INSERT INTO relationships(id,from_id,to_id,type,label,start_time_id,end_time_id,notes) VALUES(?,?,?,?,?,?,?,?)`,
      [
        rid,
        args.from_id,
        args.to_id,
        args.type || "other",
        args.label || "",
        args.start_time_id || null,
        args.end_time_id || null,
        args.notes || "",
      ],
    );
    return rid;
  }

  deleteRelationship(rid: string) {
    this.pf.run("DELETE FROM relationships WHERE id = ?", [rid]);
  }

  createFact(args: Record<string, unknown>) {
    const fid = id();
    this.pf.run(
      "INSERT INTO facts(id,statement,about_ids,is_secret,true_in_canon) VALUES(?,?,?,?,?)",
      [
        fid,
        args.statement || "",
        JSON.stringify(args.about_ids ?? []),
        args.is_secret ? 1 : 0,
        args.true_in_canon === 0 || args.true_in_canon === false ? 0 : 1,
      ],
    );
    return fid;
  }

  listFacts() {
    return this.pf.all("SELECT * FROM facts").map((r) => decodeRow(r as Record<string, unknown>, ["about_ids"]));
  }

  addKnowledge(args: Record<string, unknown>) {
    const kid = id();
    this.pf.run(
      `INSERT INTO character_knowledge(id,character_id,fact_id,learned_at_time_id,learned_in_scene_id,believed,forgotten)
       VALUES(?,?,?,?,?,?,?)`,
      [
        kid,
        args.character_id,
        args.fact_id,
        args.learned_at_time_id || null,
        args.learned_in_scene_id || null,
        args.believed === 0 || args.believed === false ? 0 : 1,
        args.forgotten ? 1 : 0,
      ],
    );
    return kid;
  }

  deleteKnowledge(kid: string) {
    this.pf.run("DELETE FROM character_knowledge WHERE id = ?", [kid]);
  }

  // ---- world ----
  listFactions() {
    return this.pf.all("SELECT * FROM factions ORDER BY name");
  }
  createFaction(args: Record<string, unknown>) {
    const fid = id();
    this.pf.run(
      `INSERT INTO factions(id,name,summary,hierarchy_notes,parent_faction_id,effective_from_time_id,effective_to_time_id)
       VALUES(?,?,?,?,?,?,?)`,
      [
        fid,
        args.name || "未名勢力",
        args.summary || "",
        args.hierarchy_notes || "",
        args.parent_faction_id || null,
        args.effective_from_time_id || null,
        args.effective_to_time_id || null,
      ],
    );
    this.upsertTerm(String(args.name || "未名勢力"), "faction", "faction", fid);
    return fid;
  }
  updateFaction(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM factions WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到勢力");
    this.pf.run(
      `UPDATE factions SET name=?, summary=?, hierarchy_notes=?, parent_faction_id=? WHERE id=?`,
      [
        args.name ?? row.name,
        args.summary ?? row.summary,
        args.hierarchy_notes ?? row.hierarchy_notes,
        args.parent_faction_id === undefined ? row.parent_faction_id : args.parent_faction_id,
        args.id,
      ],
    );
  }
  deleteFaction(fid: string) {
    this.pf.run("DELETE FROM factions WHERE id = ?", [fid]);
  }

  listLocations() {
    return this.pf.all("SELECT * FROM locations ORDER BY name");
  }
  createLocation(args: Record<string, unknown>) {
    const lid = id();
    this.pf.run(
      `INSERT INTO locations(id,name,parent_id,summary,controlling_faction_id,map_x,map_y,effective_from_time_id,effective_to_time_id)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [
        lid,
        args.name || "未名地",
        args.parent_id || null,
        args.summary || "",
        args.controlling_faction_id || null,
        args.map_x ?? null,
        args.map_y ?? null,
        args.effective_from_time_id || null,
        args.effective_to_time_id || null,
      ],
    );
    this.upsertTerm(String(args.name || "未名地"), "place", "location", lid);
    return lid;
  }
  updateLocation(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM locations WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到地點");
    this.pf.run(
      `UPDATE locations SET name=?, parent_id=?, summary=?, controlling_faction_id=? WHERE id=?`,
      [
        args.name ?? row.name,
        args.parent_id === undefined ? row.parent_id : args.parent_id,
        args.summary ?? row.summary,
        args.controlling_faction_id === undefined ? row.controlling_faction_id : args.controlling_faction_id,
        args.id,
      ],
    );
  }
  deleteLocation(lid: string) {
    this.pf.run("DELETE FROM locations WHERE id = ?", [lid]);
  }

  listEtiquette() {
    return this.pf.all("SELECT * FROM etiquette_rules ORDER BY name");
  }
  createEtiquette(args: Record<string, unknown>) {
    const eid = id();
    this.pf.run(
      `INSERT INTO etiquette_rules(id,name,context,from_role,to_role,required,forbidden,consequence,effective_from_time_id,effective_to_time_id)
       VALUES(?,?,?,?,?,?,?,?,?,?)`,
      [
        eid,
        args.name || "禮儀",
        args.context || "",
        args.from_role || "",
        args.to_role || "",
        args.required || "",
        args.forbidden || "",
        args.consequence || "",
        args.effective_from_time_id || null,
        args.effective_to_time_id || null,
      ],
    );
    return eid;
  }
  updateEtiquette(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM etiquette_rules WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到禮儀");
    this.pf.run(
      `UPDATE etiquette_rules SET name=?, context=?, from_role=?, to_role=?, required=?, forbidden=?, consequence=? WHERE id=?`,
      [
        args.name ?? row.name,
        args.context ?? row.context,
        args.from_role ?? row.from_role,
        args.to_role ?? row.to_role,
        args.required ?? row.required,
        args.forbidden ?? row.forbidden,
        args.consequence ?? row.consequence,
        args.id,
      ],
    );
  }
  deleteEtiquette(eid: string) {
    this.pf.run("DELETE FROM etiquette_rules WHERE id = ?", [eid]);
  }

  listLivelihood() {
    return this.pf.all("SELECT * FROM livelihood ORDER BY title");
  }
  createLivelihood(args: Record<string, unknown>) {
    const lid = id();
    this.pf.run("INSERT INTO livelihood(id,title,body,location_id,faction_id) VALUES(?,?,?,?,?)", [
      lid,
      args.title || "條目",
      args.body || "",
      args.location_id || null,
      args.faction_id || null,
    ]);
    return lid;
  }
  updateLivelihood(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM livelihood WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到民生條目");
    this.pf.run("UPDATE livelihood SET title=?, body=?, location_id=?, faction_id=? WHERE id=?", [
      args.title ?? row.title,
      args.body ?? row.body,
      args.location_id === undefined ? row.location_id : args.location_id,
      args.faction_id === undefined ? row.faction_id : args.faction_id,
      args.id,
    ]);
  }
  deleteLivelihood(lid: string) {
    this.pf.run("DELETE FROM livelihood WHERE id = ?", [lid]);
  }

  listRuleSystems() {
    const systems = this.pf.all("SELECT * FROM rule_systems ORDER BY name");
    return systems.map((s) => ({
      ...s,
      ranks: this.pf.all("SELECT * FROM rule_ranks WHERE system_id = ? ORDER BY sort_order", [s.id]),
      constraints: this.pf.all("SELECT * FROM rule_constraints WHERE system_id = ?", [s.id]),
    }));
  }
  createRuleSystem(args: Record<string, unknown>) {
    const sid = id();
    this.pf.run("INSERT INTO rule_systems(id,name,kind,summary) VALUES(?,?,?,?)", [
      sid,
      args.name || "規則",
      args.kind || "other",
      args.summary || "",
    ]);
    return sid;
  }
  updateRuleSystem(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM rule_systems WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到規則體系");
    this.pf.run("UPDATE rule_systems SET name=?, kind=?, summary=? WHERE id=?", [
      args.name ?? row.name,
      args.kind ?? row.kind,
      args.summary ?? row.summary,
      args.id,
    ]);
  }
  deleteRuleSystem(sid: string) {
    this.pf.run("DELETE FROM rule_ranks WHERE system_id = ?", [sid]);
    this.pf.run("DELETE FROM rule_constraints WHERE system_id = ?", [sid]);
    this.pf.run("DELETE FROM rule_systems WHERE id = ?", [sid]);
  }
  addRank(args: Record<string, unknown>) {
    const rid = id();
    const order =
      (this.pf.one<{ n: number }>(
        "SELECT COALESCE(MAX(sort_order),-1) AS n FROM rule_ranks WHERE system_id = ?",
        [args.system_id],
      )?.n ?? -1) + 1;
    this.pf.run("INSERT INTO rule_ranks(id,system_id,name,sort_order,notes) VALUES(?,?,?,?,?)", [
      rid,
      args.system_id,
      args.name || "境界",
      order,
      args.notes || "",
    ]);
    this.upsertTerm(String(args.name || "境界"), "title", "rank", rid);
    return rid;
  }
  deleteRank(rid: string) {
    this.pf.run("DELETE FROM rule_ranks WHERE id = ?", [rid]);
  }
  addConstraint(args: Record<string, unknown>) {
    const cid = id();
    this.pf.run(
      `INSERT INTO rule_constraints(id,system_id,statement,applies_to,violation_note,effective_from_time_id,effective_to_time_id)
       VALUES(?,?,?,?,?,?,?)`,
      [
        cid,
        args.system_id,
        args.statement || "",
        args.applies_to || "",
        args.violation_note || "",
        args.effective_from_time_id || null,
        args.effective_to_time_id || null,
      ],
    );
    return cid;
  }
  deleteConstraint(cid: string) {
    this.pf.run("DELETE FROM rule_constraints WHERE id = ?", [cid]);
  }

  listWorldEntries(category?: string) {
    if (category) return this.pf.all("SELECT * FROM world_entries WHERE category = ? ORDER BY title", [category]);
    return this.pf.all("SELECT * FROM world_entries ORDER BY category, title");
  }
  createWorldEntry(args: Record<string, unknown>) {
    const eid = id();
    this.pf.run("INSERT INTO world_entries(id,category,title,body) VALUES(?,?,?,?)", [
      eid,
      args.category || "other",
      args.title || "條目",
      args.body || "",
    ]);
    return eid;
  }
  updateWorldEntry(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM world_entries WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到條目");
    this.pf.run("UPDATE world_entries SET category=?, title=?, body=? WHERE id=?", [
      args.category ?? row.category,
      args.title ?? row.title,
      args.body ?? row.body,
      args.id,
    ]);
  }
  deleteWorldEntry(eid: string) {
    this.pf.run("DELETE FROM world_entries WHERE id = ?", [eid]);
  }

  listCategories() {
    return this.pf.all("SELECT * FROM world_categories ORDER BY sort_order");
  }

  // ---- threads ----
  listThreads() {
    const threads = this.pf.all("SELECT * FROM threads ORDER BY name");
    return threads.map((t) => ({
      ...t,
      beats: this.pf.all("SELECT * FROM thread_beats WHERE thread_id = ?", [t.id]),
      unpaid: t.type === "foreshadow" && t.status !== "paid_off" && t.status !== "abandoned",
    }));
  }
  createThread(args: Record<string, unknown>) {
    const tid = id();
    this.pf.run(
      "INSERT INTO threads(id,name,summary,type,status,parent_thread_id) VALUES(?,?,?,?,?,?)",
      [
        tid,
        args.name || "新線索",
        args.summary || "",
        args.type || "overt",
        args.status || "planted",
        args.parent_thread_id || null,
      ],
    );
    return tid;
  }
  updateThread(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM threads WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到線索");
    this.pf.run("UPDATE threads SET name=?, summary=?, type=?, status=?, parent_thread_id=? WHERE id=?", [
      args.name ?? row.name,
      args.summary ?? row.summary,
      args.type ?? row.type,
      args.status ?? row.status,
      args.parent_thread_id === undefined ? row.parent_thread_id : args.parent_thread_id,
      args.id,
    ]);
  }
  deleteThread(tid: string) {
    this.pf.run("DELETE FROM thread_beats WHERE thread_id = ?", [tid]);
    this.pf.run("DELETE FROM scene_threads WHERE thread_id = ?", [tid]);
    this.pf.run("DELETE FROM threads WHERE id = ?", [tid]);
  }
  addBeat(args: Record<string, unknown>) {
    const bid = id();
    this.pf.run(
      "INSERT INTO thread_beats(id,thread_id,kind,time_point_id,scene_id,summary) VALUES(?,?,?,?,?,?)",
      [
        bid,
        args.thread_id,
        args.kind || "progress",
        args.time_point_id || null,
        args.scene_id || null,
        args.summary || "",
      ],
    );
    if (args.kind === "payoff") {
      this.pf.run("UPDATE threads SET status = 'paid_off' WHERE id = ?", [args.thread_id]);
    }
    return bid;
  }
  deleteBeat(bid: string) {
    this.pf.run("DELETE FROM thread_beats WHERE id = ?", [bid]);
  }

  // ---- glossary ----
  ensureTermKinds() {
    this.pf.db.run(`CREATE TABLE IF NOT EXISTS term_kinds (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      builtin INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#8a8070',
      sort_order INTEGER NOT NULL
    )`);
    const n = this.pf.one<{ n: number }>("SELECT COUNT(*) AS n FROM term_kinds")?.n ?? 0;
    if (n > 0) return;
    const defaults: [string, string, string, number][] = [
      ["person", "人名", "#9b2d1f", 1],
      ["place", "地名", "#3d5c4a", 2],
      ["faction", "勢力", "#b0893e", 3],
      ["title", "稱謂／官職", "#6e1c14", 4],
      ["technique", "功法", "#5c4a3a", 5],
      ["item", "器物", "#4a5c52", 6],
      ["address", "稱呼", "#7d5a3a", 7],
      ["other", "其他", "#8a8070", 8],
    ];
    for (const [key, name, color, order] of defaults) {
      this.pf.run(
        "INSERT INTO term_kinds(id,key,name,builtin,color,sort_order) VALUES(?,?,?,1,?,?)",
        [id(), key, name, color, order],
      );
    }
    this.pf.persistNow();
  }

  listTermKinds() {
    this.ensureTermKinds();
    return this.pf.all("SELECT * FROM term_kinds ORDER BY sort_order, name");
  }

  createTermKind(args: { name: string; color?: string }) {
    const name = (args.name || "").trim();
    if (!name) throw new Error("請填種類名稱");
    const key = `custom_${id().slice(0, 8)}`;
    const order =
      (this.pf.one<{ n: number }>("SELECT COALESCE(MAX(sort_order),0) AS n FROM term_kinds")?.n ?? 0) + 1;
    const kid = id();
    const colors = ["#9b2d1f", "#3d5c4a", "#b0893e", "#4a5c6e", "#6b3a5a", "#3a5a6b"];
    const color = args.color || colors[order % colors.length];
    this.pf.run("INSERT INTO term_kinds(id,key,name,builtin,color,sort_order) VALUES(?,?,?,0,?,?)", [
      kid,
      key,
      name,
      color,
      order,
    ]);
    this.pf.persistNow();
    return { id: kid, key };
  }

  updateTermKind(args: { id: string; name?: string; color?: string }) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM term_kinds WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到種類");
    this.pf.run("UPDATE term_kinds SET name=?, color=? WHERE id=?", [
      args.name ?? row.name,
      args.color ?? row.color,
      args.id,
    ]);
    this.pf.persistNow();
  }

  deleteTermKind(kindId: string) {
    const row = this.pf.one<{ builtin: number; key: string }>("SELECT builtin, key FROM term_kinds WHERE id = ?", [
      kindId,
    ]);
    if (!row) throw new Error("找不到種類");
    if (row.builtin) throw new Error("內建種類不能刪除，可改名稱");
    this.pf.run("UPDATE terms SET kind = 'other' WHERE kind = ?", [row.key]);
    this.pf.run("DELETE FROM term_kinds WHERE id = ?", [kindId]);
    this.pf.persistNow();
  }

  reorderTermKinds(ids: string[]) {
    ids.forEach((kid, i) => {
      this.pf.run("UPDATE term_kinds SET sort_order = ? WHERE id = ?", [i + 1, kid]);
    });
    this.pf.persistNow();
  }

  listTerms() {
    return this.pf.all("SELECT * FROM terms ORDER BY kind, surface").map((r) =>
      decodeRow(r as Record<string, unknown>, ["forbidden_variants"]),
    );
  }
  createTerm(args: Record<string, unknown>) {
    const tid = id();
    this.pf.run(
      `INSERT INTO terms(id,surface,normalized,kind,linked_entity_type,linked_entity_id,forbidden_variants,notes)
       VALUES(?,?,?,?,?,?,?,?)`,
      [
        tid,
        args.surface || "",
        args.normalized || args.surface || "",
        args.kind || "other",
        args.linked_entity_type || null,
        args.linked_entity_id || null,
        JSON.stringify(args.forbidden_variants ?? []),
        args.notes || "",
      ],
    );
    return tid;
  }
  updateTerm(args: Record<string, unknown>) {
    const row = this.pf.one<Record<string, unknown>>("SELECT * FROM terms WHERE id = ?", [args.id]);
    if (!row) throw new Error("找不到詞條");
    this.pf.run(
      `UPDATE terms SET surface=?, normalized=?, kind=?, forbidden_variants=?, notes=? WHERE id=?`,
      [
        args.surface ?? row.surface,
        args.normalized ?? row.normalized,
        args.kind ?? row.kind,
        args.forbidden_variants ? JSON.stringify(args.forbidden_variants) : row.forbidden_variants,
        args.notes ?? row.notes,
        args.id,
      ],
    );
  }
  deleteTerm(tid: string) {
    this.pf.run("DELETE FROM terms WHERE id = ?", [tid]);
  }
  listAddressRules() {
    return this.pf.all("SELECT * FROM address_rules ORDER BY term");
  }
  createAddressRule(args: Record<string, unknown>) {
    const aid = id();
    this.pf.run(
      "INSERT INTO address_rules(id,speaker_spec,addressee_spec,term,formality,notes) VALUES(?,?,?,?,?,?)",
      [
        aid,
        args.speaker_spec || "",
        args.addressee_spec || "",
        args.term || "",
        args.formality || "neutral",
        args.notes || "",
      ],
    );
    return aid;
  }
  deleteAddressRule(aid: string) {
    this.pf.run("DELETE FROM address_rules WHERE id = ?", [aid]);
  }

  // ---- search / export ----
  search(q: string) {
    const like = `%${q}%`;
    const chapters = this.pf.all(
      `SELECT c.id, c.title,
              p.title AS part_title, v.title AS volume_title, 'chapter' AS kind
       FROM chapters c
       JOIN volumes v ON v.id = c.volume_id
       LEFT JOIN parts p ON p.id = v.part_id
       WHERE c.deleted_at IS NULL AND (c.title LIKE ? OR c.body LIKE ? OR c.summary LIKE ?)`,
      [like, like, like],
    );
    const characters = this.pf.all(
      `SELECT id, name AS title, 'character' AS kind FROM characters WHERE name LIKE ? OR personality LIKE ? OR notes LIKE ?`,
      [like, like, like],
    );
    const locations = this.pf.all(
      `SELECT id, name AS title, 'location' AS kind FROM locations WHERE name LIKE ? OR summary LIKE ?`,
      [like, like],
    );
    const threads = this.pf.all(
      `SELECT id, name AS title, 'thread' AS kind FROM threads WHERE name LIKE ? OR summary LIKE ?`,
      [like, like],
    );
    const terms = this.pf.all(
      `SELECT id, surface AS title, 'term' AS kind FROM terms WHERE surface LIKE ? OR normalized LIKE ?`,
      [like, like],
    );
    return { chapters, characters, locations, threads, terms };
  }

  exportChapter(cid: string) {
    const ch = this.pf.one<{ title: string; body: string; summary: string }>(
      "SELECT title, body, summary FROM chapters WHERE id = ?",
      [cid],
    );
    if (!ch) throw new Error("找不到章");
    const md = `# ${ch.title}\n\n${ch.summary ? `> ${ch.summary}\n\n` : ""}${ch.body}\n`;
    const file = path.join(this.folder, "exports", `${sanitize(ch.title)}.md`);
    fs.writeFileSync(file, md, "utf8");
    return file;
  }

  exportBook() {
    const tree = this.getTree() as unknown as {
      title: string;
      volumes: { title: string; chapters: { id: string; title: string }[] }[];
    }[];
    const parts: string[] = [`# ${this.name}\n`];
    for (const p of tree) {
      parts.push(`\n# ${p.title}\n`);
      for (const v of p.volumes) {
        parts.push(`\n## ${v.title}\n`);
        for (const c of v.chapters) {
          const ch = this.pf.one<{ title: string; body: string }>("SELECT title, body FROM chapters WHERE id = ?", [
            c.id,
          ]);
          if (ch) parts.push(`\n### ${ch.title}\n\n${ch.body}\n`);
        }
      }
    }
    const file = path.join(this.folder, "exports", `${sanitize(this.name)}.md`);
    fs.writeFileSync(file, parts.join(""), "utf8");
    return file;
  }

  bibleBundle() {
    return {
      time_points: this.listTimePoints(),
      characters: this.listCharacters(),
      factions: this.listFactions(),
      locations: this.listLocations(),
      etiquette: this.listEtiquette(),
      livelihood: this.listLivelihood(),
      rules: this.listRuleSystems(),
      threads: this.listThreads(),
      terms: this.listTerms(),
      address_rules: this.listAddressRules(),
      facts: this.listFacts(),
    };
  }
}


function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").slice(0, 80) || "export";
}

export async function createProject(folder: string, name: string, demo: boolean): Promise<Session> {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const sqlitePath = path.join(folder, "project.sqlite");
  if (fs.existsSync(sqlitePath)) throw new Error("此資料夾已有專案");
  const pf = await openSqlite(folder, true);
  const session = new Session(pf);
  if (demo) seedDemo(session);
  else seedEmpty(session, name);
  pf.persistNow();
  return session;
}

export async function openProject(folder: string): Promise<Session> {
  const sqlitePath = path.join(folder, "project.sqlite");
  if (!fs.existsSync(sqlitePath)) throw new Error("此資料夾沒有 project.sqlite");
  const pf = await openSqlite(folder, false);
  return new Session(pf);
}
