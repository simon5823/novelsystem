import { useEffect, useState } from "react";
import { invoke } from "./api";
import { EmptyState, Ico, IconBtn, SearchField } from "./ui";

const TYPES: Record<string, string> = { main: "主線", overt: "明線", covert: "暗線", foreshadow: "伏筆" };
const STAT: Record<string, string> = { planted: "埋設", active: "進行", paid_off: "已回收", abandoned: "已放棄" };
const KIND: Record<string, string> = { plant: "埋設", progress: "推進", payoff: "回收", abandon: "放棄" };

type Beat = { id: string; kind: string; summary: string; time_point_id?: string | null; scene_id?: string | null };
type Thread = {
  id: string;
  name: string;
  summary: string;
  type: string;
  status: string;
  unpaid?: boolean;
  beats: Beat[];
};

export function ThreadsView() {
  const [list, setList] = useState<Thread[]>([]);
  const [times, setTimes] = useState<{ id: string; label: string }[]>([]);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"list" | "grid">("grid");
  const [sel, setSel] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", summary: "", type: "overt", status: "active" });
  const [cell, setCell] = useState<{ thread: string; time: string } | null>(null);
  const [beatDraft, setBeatDraft] = useState({ kind: "progress", summary: "" });

  const load = () => {
    void invoke<Thread[]>("threads.list").then(setList);
    void invoke<{ id: string; label: string }[]>("time.list").then(setTimes);
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = list.filter((t) => t.name.includes(q) || t.summary.includes(q));
  const unpaid = list.filter((t) => t.unpaid);
  const cur = list.find((t) => t.id === sel);

  async function createThread() {
    if (!draft.name.trim()) return;
    const id = await invoke<string>("threads.create", draft);
    setCreating(false);
    setDraft({ name: "", summary: "", type: "overt", status: "active" });
    load();
    setSel(id);
  }

  async function addBeat() {
    if (!cell || !beatDraft.summary.trim()) return;
    await invoke("beats.add", {
      thread_id: cell.thread,
      time_point_id: cell.time,
      kind: beatDraft.kind,
      summary: beatDraft.summary.trim(),
    });
    setCell(null);
    setBeatDraft({ kind: "progress", summary: "" });
    load();
  }

  return (
    <div className="page">
      <div className="page-head">
        <span className="tree-ico">{Ico.branch({})}</span>
        <h1>線索與伏筆</h1>
        <SearchField value={q} onChange={setQ} placeholder="搜尋線索名稱或概要…" />
        <IconBtn icon={Ico.cards({})} tip="情節表" active={mode === "grid"} onClick={() => setMode("grid")} />
        <IconBtn icon={Ico.file({})} tip="列表" active={mode === "list"} onClick={() => setMode("list")} />
        <IconBtn icon={Ico.plus({})} label="新增線索" active={creating} onClick={() => setCreating((v) => !v)} />
      </div>

      {unpaid.length > 0 && (
        <div className="banner">
          尚未回收的伏筆：{unpaid.map((t) => t.name).join("、")}
        </div>
      )}

      {creating && (
        <div className="card fields" style={{ maxWidth: 520, marginBottom: 14 }}>
          <label>名稱<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label>概要<textarea rows={2} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></label>
          <label>
            類型
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              {Object.entries(TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <div className="inline">
            <IconBtn icon={Ico.plus({})} label="建立" onClick={() => void createThread()} />
            <IconBtn icon={Ico.close({})} label="取消" onClick={() => setCreating(false)} />
          </div>
        </div>
      )}

      {mode === "grid" ? (
        times.length === 0 ? (
          <EmptyState title="還沒有時刻" hint="請先到「時間」建立時刻，情節表會以時刻當橫軸。" />
        ) : filtered.length === 0 ? (
          <EmptyState title="還沒有線索" hint="新增主線、暗線或伏筆後，即可在表上填節點。" />
        ) : (
          <div className="plot-wrap">
            <table className="plot-grid">
              <thead>
                <tr>
                  <th className="sticky">線索</th>
                  {times.map((t) => (
                    <th key={t.id}>{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((th) => (
                  <tr key={th.id}>
                    <th className="sticky">
                      <button className="linkish" onClick={() => { setSel(th.id); setMode("list"); }}>
                        {th.name}
                      </button>
                      <div className="muted">{TYPES[th.type]}{th.unpaid ? " · 未回收" : ""}</div>
                    </th>
                    {times.map((tp) => {
                      const beats = th.beats.filter((b) => b.time_point_id === tp.id);
                      return (
                        <td key={tp.id}>
                          {beats.map((b) => (
                            <div key={b.id} className={`plot-chip ${b.kind}`}>
                              <span>{KIND[b.kind]} · {b.summary}</span>
                              <button className="mini" onClick={() => invoke("beats.delete", { id: b.id }).then(load)}>×</button>
                            </div>
                          ))}
                          <button className="plot-add" onClick={() => { setCell({ thread: th.id, time: tp.id }); setBeatDraft({ kind: "progress", summary: "" }); }}>+</button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="entity-split">
          <div className="entity-list">
            {filtered.map((t) => (
              <button key={t.id} className={`entity-card ${sel === t.id ? "on" : ""}`} onClick={() => setSel(t.id)}>
                <b>{t.name}</b>
                <span className="muted">{TYPES[t.type]} · {STAT[t.status]}{t.unpaid ? " · 未回收" : ""}</span>
              </button>
            ))}
            {!filtered.length && <EmptyState title="沒有符合的線索" hint="換個關鍵字，或新增一條。" />}
          </div>
          <div className="entity-detail">
            {!cur ? (
              <p className="muted">從左側選一條線索。</p>
            ) : (
              <div className="fields">
                <label>名稱<input defaultValue={cur.name} key={cur.id + "n"} onBlur={(e) => invoke("threads.update", { id: cur.id, name: e.target.value }).then(load)} /></label>
                <label>概要<textarea rows={3} defaultValue={cur.summary} key={cur.id + "s"} onBlur={(e) => invoke("threads.update", { id: cur.id, summary: e.target.value }).then(load)} /></label>
                <label>
                  類型
                  <select defaultValue={cur.type} key={cur.id + "t"} onChange={(e) => invoke("threads.update", { id: cur.id, type: e.target.value }).then(load)}>
                    {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label>
                  狀態
                  <select defaultValue={cur.status} key={cur.id + "st"} onChange={(e) => invoke("threads.update", { id: cur.id, status: e.target.value }).then(load)}>
                    {Object.entries(STAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <h3>節點</h3>
                {cur.beats.map((b) => (
                  <div key={b.id} className="card inline">
                    {KIND[b.kind]} · {b.summary}
                    <IconBtn icon={Ico.trash({})} danger tip="刪除節點" onClick={() => invoke("beats.delete", { id: b.id }).then(load)} />
                  </div>
                ))}
                <IconBtn icon={Ico.cards({})} label="到情節表加節點" onClick={() => setMode("grid")} />
                <IconBtn icon={Ico.trash({})} label="刪除這條線索" danger onClick={() => invoke("threads.delete", { id: cur.id }).then(() => { setSel(null); load(); })} />
              </div>
            )}
          </div>
        </div>
      )}

      {cell && (
        <div className="modal-bg" onClick={() => setCell(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>新增節點</h3>
            <div className="fields">
              <label>
                種類
                <select value={beatDraft.kind} onChange={(e) => setBeatDraft({ ...beatDraft, kind: e.target.value })}>
                  {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>
                摘要
                <input value={beatDraft.summary} onChange={(e) => setBeatDraft({ ...beatDraft, summary: e.target.value })} placeholder="這一刻發生了什麼" />
              </label>
              <div className="inline">
                <IconBtn icon={Ico.plus({})} label="加入" onClick={() => void addBeat()} />
                <IconBtn icon={Ico.close({})} label="取消" onClick={() => setCell(null)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
