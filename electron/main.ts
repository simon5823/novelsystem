import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProject, openProject, type Session } from "./project.ts";
import { loadRecent, touchRecent } from "./store.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let win: BrowserWindow | null = null;
let session: Session | null = null;

async function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: "#241f1b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  void createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (session) session.pf.persistNow();
  if (process.platform !== "darwin") app.quit();
});

function need(): Session {
  if (!session) throw new Error("尚未開啟專案");
  return session;
}

ipcMain.handle("novel", async (_evt, cmd: string, args: Record<string, unknown> = {}) => {
  try {
    return await dispatch(cmd, args ?? {});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { __error: message };
  }
});

async function dispatch(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  switch (cmd) {
    case "recent":
      return loadRecent();
    case "pickFolder": {
      const res = await dialog.showOpenDialog(win!, {
        title: "選擇專案資料夾",
        properties: ["openDirectory", "createDirectory"],
      });
      if (res.canceled || !res.filePaths[0]) return null;
      return res.filePaths[0];
    }
    case "project.create": {
      const folder = String(args.folder);
      const name = String(args.name || path.basename(folder));
      session = await createProject(folder, name, Boolean(args.demo));
      return { path: session.folder, name: session.name, recent: touchRecent(session.name, session.folder) };
    }
    case "project.open": {
      session = await openProject(String(args.folder));
      return { path: session.folder, name: session.name, recent: touchRecent(session.name, session.folder) };
    }
    case "project.close":
      if (session) session.pf.persistNow();
      session = null;
      return true;
    case "project.backup": {
      const s = need();
      s.pf.persistNow();
      const res = await dialog.showOpenDialog(win!, {
        title: "選擇備份目的資料夾",
        properties: ["openDirectory", "createDirectory"],
      });
      if (res.canceled || !res.filePaths[0]) return null;
      const dest = path.join(res.filePaths[0], path.basename(s.folder) + "-backup");
      fs.cpSync(s.folder, dest, { recursive: true });
      return dest;
    }
    case "meta.get":
      return need().getMeta();
    case "meta.update":
      need().updateMeta(args as Record<string, string>);
      return need().getMeta();
    case "tree":
      return { tree: need().getTree(), book_word_count: need().bookWordCount(), folder: need().folder };
    case "part.create":
      return need().createPart(String(args.title || "新的一部"));
    case "part.update":
      need().updatePart(args as { id: string; title?: string; summary?: string });
      return true;
    case "part.delete":
      need().deletePart(String(args.id));
      return true;
    case "volume.create":
      return need().createVolume(String(args.title || "新分卷"), args.part_id ? String(args.part_id) : undefined);
    case "volume.update":
      need().updateVolume(args as { id: string; title?: string; summary?: string });
      return true;
    case "volume.delete":
      need().deleteVolume(String(args.id));
      return true;
    case "chapter.create":
      return need().createChapter(String(args.volume_id), String(args.title || "新章"));
    case "chapter.get":
      return need().getChapter(String(args.id));
    case "chapter.update":
      need().updateChapter(args as { id: string });
      return true;
    case "chapter.delete":
      need().deleteChapter(String(args.id));
      return true;
    case "chapter.deleted":
      return need().listDeletedChapters();
    case "chapter.restore":
      need().restoreChapter(String(args.id));
      return true;
    case "chapter.persist":
      return need().persistBody(String(args.id), String(args.body));
    case "chapter.save":
      return need().saveChapter({ id: String(args.id), snapshot: true });
    case "scene.save":
      return need().saveSceneBody(String(args.id), String(args.body), { snapshot: Boolean(args.snapshot) });
    case "scene.create":
      return need().createScene(String(args.chapter_id), args.after_id ? String(args.after_id) : undefined);
    case "scene.delete":
      return need().deleteScene(String(args.id));
    case "scene.reorder":
      need().reorderScenes(String(args.chapter_id), args.ids as string[]);
      return true;
    case "chapter.export": {
      const file = need().exportChapter(String(args.id));
      await shell.openPath(path.dirname(file));
      return file;
    }
    case "book.export": {
      const file = need().exportBook();
      await shell.openPath(path.dirname(file));
      return file;
    }
    case "scene.update":
      need().updateScene(args);
      return true;
    case "snapshots.list":
      return need().listSnapshots(String(args.chapter_id));
    case "snapshots.restore":
      return need().restoreSnapshot(String(args.id));
    case "snapshots.prune":
      return need().pruneSnapshots(String(args.chapter_id));
    case "time.list":
      return need().listTimePoints();
    case "time.timeline":
      return need().timelineView();
    case "time.create":
      return need().createTimePoint(args as { label: string; after_id?: string });
    case "time.update":
      need().updateTimePoint(args);
      return true;
    case "time.delete":
      need().deleteTimePoint(String(args.id));
      return true;
    case "time.reorder":
      need().reorderTimePoints(args.ids as string[]);
      return true;
    case "time.insertAt":
      return need().insertTimePointAt(String(args.label || "未命名時刻"), Number(args.index ?? 0));
    case "rel.list":
      return need().listAllRelationships();
    case "characters.list":
      return need().listCharacters();
    case "characters.get":
      return need().getCharacter(String(args.id));
    case "characters.create":
      return need().createCharacter(args);
    case "characters.update":
      need().updateCharacter(args);
      return true;
    case "characters.delete":
      need().deleteCharacter(String(args.id));
      return true;
    case "state.add":
      return need().addState(args);
    case "state.delete":
      need().deleteState(String(args.id));
      return true;
    case "event.add":
      return need().addEvent(args);
    case "event.delete":
      need().deleteEvent(String(args.id));
      return true;
    case "rel.add":
      return need().addRelationship(args);
    case "rel.delete":
      need().deleteRelationship(String(args.id));
      return true;
    case "facts.list":
      return need().listFacts();
    case "facts.create":
      return need().createFact(args);
    case "knowledge.add":
      return need().addKnowledge(args);
    case "knowledge.delete":
      need().deleteKnowledge(String(args.id));
      return true;
    case "factions.list":
      return need().listFactions();
    case "factions.create":
      return need().createFaction(args);
    case "factions.update":
      need().updateFaction(args);
      return true;
    case "factions.delete":
      need().deleteFaction(String(args.id));
      return true;
    case "locations.list":
      return need().listLocations();
    case "locations.create":
      return need().createLocation(args);
    case "locations.update":
      need().updateLocation(args);
      return true;
    case "locations.delete":
      need().deleteLocation(String(args.id));
      return true;
    case "etiquette.list":
      return need().listEtiquette();
    case "etiquette.create":
      return need().createEtiquette(args);
    case "etiquette.update":
      need().updateEtiquette(args);
      return true;
    case "etiquette.delete":
      need().deleteEtiquette(String(args.id));
      return true;
    case "livelihood.list":
      return need().listLivelihood();
    case "livelihood.create":
      return need().createLivelihood(args);
    case "livelihood.update":
      need().updateLivelihood(args);
      return true;
    case "livelihood.delete":
      need().deleteLivelihood(String(args.id));
      return true;
    case "rules.list":
      return need().listRuleSystems();
    case "rules.create":
      return need().createRuleSystem(args);
    case "rules.update":
      need().updateRuleSystem(args);
      return true;
    case "rules.delete":
      need().deleteRuleSystem(String(args.id));
      return true;
    case "ranks.add":
      return need().addRank(args);
    case "ranks.delete":
      need().deleteRank(String(args.id));
      return true;
    case "constraints.add":
      return need().addConstraint(args);
    case "constraints.delete":
      need().deleteConstraint(String(args.id));
      return true;
    case "entries.list":
      return need().listWorldEntries(args.category ? String(args.category) : undefined);
    case "entries.create":
      return need().createWorldEntry(args);
    case "entries.update":
      need().updateWorldEntry(args);
      return true;
    case "entries.delete":
      need().deleteWorldEntry(String(args.id));
      return true;
    case "threads.list":
      return need().listThreads();
    case "threads.create":
      return need().createThread(args);
    case "threads.update":
      need().updateThread(args);
      return true;
    case "threads.delete":
      need().deleteThread(String(args.id));
      return true;
    case "beats.add":
      return need().addBeat(args);
    case "beats.delete":
      need().deleteBeat(String(args.id));
      return true;
    case "termKinds.list":
      return need().listTermKinds();
    case "termKinds.create":
      return need().createTermKind(args as { name: string; color?: string });
    case "termKinds.update":
      need().updateTermKind(args as { id: string; name?: string; color?: string });
      return true;
    case "termKinds.delete":
      need().deleteTermKind(String(args.id));
      return true;
    case "termKinds.reorder":
      need().reorderTermKinds(args.ids as string[]);
      return true;
    case "terms.list":
      return need().listTerms();
    case "terms.create":
      return need().createTerm(args);
    case "terms.update":
      need().updateTerm(args);
      return true;
    case "terms.delete":
      need().deleteTerm(String(args.id));
      return true;
    case "address.list":
      return need().listAddressRules();
    case "address.create":
      return need().createAddressRule(args);
    case "address.delete":
      need().deleteAddressRule(String(args.id));
      return true;
    case "search":
      return need().search(String(args.q || ""));
    case "bible":
      return need().bibleBundle();
    default:
      throw new Error(`未知指令：${cmd}`);
  }
}
