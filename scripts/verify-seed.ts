import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createProject } from "../electron/project.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "novelsystem-"));
const session = await createProject(dir, "驗收", true);

const tree = session.getTree() as {
  title: string;
  volumes: { id: string; title: string; chapters: { id: string; title: string; word_count: number; scenes: { id: string }[] }[] }[];
}[];

assert.ok(tree.length >= 2, "應有兩部");
assert.equal(tree[0].title, "第一部");
const chapters = tree.flatMap((p) => p.volumes.flatMap((v) => v.chapters));
assert.equal(chapters.length, 3, "應有三章");
assert.equal(chapters[0].title, "山門夜雨");
assert.ok(chapters[0].scenes.length >= 2, "首章應有兩場");
assert.ok(chapters[0].word_count > 100, "首章應有正文");

const chId = chapters[0].id;
const loaded = session.getChapter(chId) as { scenes: { id: string; body: string }[] };
assert.ok((loaded.scenes[0].body || "").length > 10);

const before = loaded.scenes.length;
session.createScene(chId, loaded.scenes[0].id);
assert.equal(session.listScenes(chId).length, before + 1);
const last = (session.listScenes(chId) as { id: string }[])[1];
session.deleteScene(last.id);
assert.equal(session.listScenes(chId).length, before);

const chars = session.listCharacters() as { name: string }[];
assert.deepEqual(chars.map((c) => c.name).sort(), ["林三", "趙四"]);

session.pf.persistNow();
console.log("seed-ok", dir);
console.log("book", session.bookWordCount());
