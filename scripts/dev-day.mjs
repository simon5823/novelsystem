import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = path.join(root, "docs");

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: root, encoding: "utf8" }).trim();
  } catch (err) {
    return (err.stdout || err.stderr || String(err)).trim();
  }
}

function latestLog() {
  if (!fs.existsSync(docs)) return null;
  const files = fs
    .readdirSync(docs)
    .filter((f) => f.startsWith("開發日誌-") && f.endsWith(".md"))
    .sort();
  return files.at(-1) ?? null;
}

const cmd = process.argv[2] || "start";

if (cmd === "start") {
  const log = latestLog();
  console.log("=== 開始今天作業 ===\n");
  console.log("最新開發日誌：", log ? `docs/${log}` : "（尚無）");
  const progress = path.join(docs, "進度.md");
  console.log("進度檔：", fs.existsSync(progress) ? "docs/進度.md" : "（尚無）");
  console.log("\n--- git log ---");
  console.log(git("log -5 --oneline") || "（尚無提交）");
  console.log("\n--- git status ---");
  console.log(git("status -sb"));
  console.log("\n請讀取上述檔案與 git 紀錄，用繁體中文向使用者摘要上次進度，並問今天要接哪一項。");
  process.exit(0);
}

if (cmd === "push") {
  const message = process.argv.slice(3).join(" ").trim();
  if (!message) {
    console.error("用法：node scripts/dev-day.mjs push <commit message>");
    process.exit(1);
  }
  git("add -A");
  const staged = git("diff --cached --stat");
  if (!staged) {
    console.log("沒有要提交的變更。");
    process.exit(0);
  }
  execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: root, stdio: "inherit" });
  execSync("git push origin HEAD", { cwd: root, stdio: "inherit" });
  console.log(git("log -1 --oneline"));
  console.log(git("rev-parse --abbrev-ref HEAD"));
  process.exit(0);
}

console.error("用法：node scripts/dev-day.mjs start | push <message>");
process.exit(1);
