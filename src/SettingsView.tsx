import { useEffect, useState } from "react";
import { invoke, toastError } from "./api";
import { Ico, IconBtn } from "./ui";

export function SettingsView({ bookName }: { bookName: string }) {
  const [mode, setMode] = useState("no_space");
  const [msg, setMsg] = useState("");
  const [deleted, setDeleted] = useState<{ id: string; title: string; deleted_at: string }[]>([]);

  useEffect(() => {
    void invoke<{ word_count_mode: string }>("meta.get").then((m) => setMode(m.word_count_mode));
    void invoke<{ id: string; title: string; deleted_at: string }[]>("chapter.deleted").then(setDeleted);
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <span className="tree-ico">{Ico.gear({})}</span>
        <h1>設定</h1>
        <IconBtn icon={Ico.export({})} label="匯出全書" onClick={() => invoke("book.export")} />
      </div>
      <div className="panel fields" style={{ maxWidth: 560 }}>
        <p className="muted">
          全部資料只存在這台電腦的作品資料夾。語言校稿請自行使用網頁版 Grok；本軟體不會連線。
        </p>
        <label>
          字數規則
          <select
            value={mode}
            onChange={async (e) => {
              setMode(e.target.value);
              await invoke("meta.update", { word_count_mode: e.target.value });
            }}
          >
            <option value="no_space">不含空白、含標點</option>
            <option value="han_only">只計漢字</option>
            <option value="all">含空白總字元</option>
          </select>
        </label>
        <div className="inline">
          <IconBtn
            icon={Ico.folder({})}
            label="備份作品資料夾"
            onClick={async () => {
              try {
                const dest = await invoke<string | null>("project.backup");
                setMsg(dest ? `已備份到 ${dest}` : "已取消");
              } catch (e) {
                setMsg(toastError(e));
              }
            }}
          />
        </div>
        {msg && <div className="muted">{msg}</div>}
      </div>
      <h3>回收筒</h3>
      {deleted.length === 0 && <p className="muted">沒有已刪除的章節。</p>}
      {deleted.map((c) => (
        <div className="card inline" key={c.id}>
          {c.title}
          <span className="muted">{c.deleted_at}</span>
          <IconBtn
            icon={Ico.restore({})}
            label="還原"
            onClick={() =>
              invoke("chapter.restore", { id: c.id }).then(() =>
                invoke<typeof deleted>("chapter.deleted").then(setDeleted),
              )
            }
          />
        </div>
      ))}
      <p className="muted">作品名稱：{bookName}。地圖與行為推演尚未開放。</p>
    </div>
  );
}
