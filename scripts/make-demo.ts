import fs from "node:fs";
import path from "node:path";
import { createProject } from "../electron/project.ts";

const dir = path.resolve("examples/qingyun");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const s = await createProject(dir, "青雲殘卷（驗收示範）", true);
console.log("created", s.folder, "words", s.bookWordCount());
