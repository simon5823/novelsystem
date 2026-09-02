import { useState } from "react";
import { invoke, toastError } from "./api";
import { Ico, IconBtn, Modal } from "./ui";
import type { RecentProject } from "../shared/types";

export function Welcome({
  recent,
  error,
  onError,
  onOpened,
}: {
  recent: RecentProject[];
  error: string;
  onError: (s: string) => void;
  onOpened: (r: { path: string; name: string; recent: RecentProject[] }) => void;
}) {
  const [creating, setCreating] = useState<null | "blank" | "demo">(null);
  const [name, setName] = useState("未命名作品");
  const [busy, setBusy] = useState(false);

  async function pickAndCreate(demo: boolean, bookName: string) {
    try {
      setBusy(true);
      const folder = await invoke<string | null>("pickFolder");
      if (!folder) return;
      const r = await invoke<{ path: string; name: string; recent: RecentProject[] }>("project.create", {
        folder,
        name: bookName,
        demo,
      });
      onOpened(r);
    } catch (e) {
      onError(toastError(e));
    } finally {
      setBusy(false);
      setCreating(null);
    }
  }

  async function openFolder(folder?: string) {
    try {
      setBusy(true);
      const path = folder ?? (await invoke<string | null>("pickFolder"));
      if (!path) return;
      const r = await invoke<{ path: string; name: string; recent: RecentProject[] }>("project.open", {
        folder: path,
      });
      onOpened(r);
    } catch (e) {
      onError(toastError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-left">
        <div className="seal">卷</div>
        <h1>墨 卷</h1>
        <div className="sub">NOVELSYSTEM · 本機寫作</div>
        <div className="welcome-actions">
          <IconBtn large icon={Ico.plus({})} label="建立空白作品" disabled={busy} onClick={() => setCreating("blank")} />
          <IconBtn large icon={Ico.demo({})} label="建立示範作品" disabled={busy} onClick={() => setCreating("demo")} />
          <IconBtn large icon={Ico.open({})} label="開啟作品資料夾" disabled={busy} onClick={() => void openFolder()} />
        </div>
        {error && <div className="err">{error}</div>}
      </div>
      <div className="welcome-right">
        <h2>最近開啟</h2>
        {recent.length === 0 ? (
          <p className="empty-recent">還沒有作品。資料只會寫進你選擇的資料夾，不會上傳。</p>
        ) : (
          <div className="recent">
            {recent.map((p) => (
              <button key={p.path} className="row" onClick={() => void openFolder(p.path)}>
                {p.name}
                <span className="path">{p.path}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {creating && (
        <Modal title={creating === "demo" ? "建立示範作品" : "建立空白作品"} onClose={() => setCreating(null)}>
          <div className="fields">
            <label>
              作品名稱
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <p className="muted">接下來請選一個空的資料夾。系統會在裡面寫入書籍檔案。</p>
            {creating === "demo" && (
              <p className="muted">示範會填入青雲門短篇，方便走一遍主要功能。</p>
            )}
            <div className="inline">
              <button className="btn" disabled={busy} onClick={() => void pickAndCreate(creating === "demo", name)}>
                選擇資料夾並建立
              </button>
              <button className="btn light" onClick={() => setCreating(null)}>
                取消
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
