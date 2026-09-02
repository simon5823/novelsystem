import { useEffect, useState } from "react";
import { invoke } from "./api";
import { EmptyState, Ico, IconBtn, SearchField } from "./ui";

type Point = {
  id: string;
  label: string;
  sort_key: number;
  era?: string;
  notes: string;
  scenes: { id: string; title: string; chapter_id: string; chapter_title: string }[];
  events: { id: string; summary: string; character_name: string }[];
  beats: { id: string; kind: string; summary: string; thread_name: string }[];
  states: { id: string; character_name: string; status_title: string; age: string }[];
};

export function TimelineView({ onOpenChapter }: { onOpenChapter?: (id: string) => void }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [label, setLabel] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "scenes" | "events" | "beats">("all");

  async function load() {
    setPoints(await invoke<Point[]>("time.timeline"));
  }
  useEffect(() => {
    void load();
  }, []);

  async function reorder(ids: string[]) {
    await invoke("time.reorder", { ids });
    await load();
  }

  async function dropAt(index: number) {
    if (dragId === "__new__") {
      const name = label.trim() || window.prompt("新時刻名稱", "未命名時刻");
      if (!name) {
        setDragId(null);
        setOver(null);
        return;
      }
      await invoke("time.insertAt", { label: name, index });
      setLabel("");
      setDragId(null);
      setOver(null);
      await load();
      return;
    }
    if (!dragId) return;
    const ids = points.map((p) => p.id);
    const from = ids.indexOf(dragId);
    if (from < 0) return;
    ids.splice(from, 1);
    const at = from < index ? index - 1 : index;
    ids.splice(Math.max(0, at), 0, dragId);
    setDragId(null);
    setOver(null);
    await reorder(ids);
  }

  return (
    <div className="page">
      <div className="page-head">
        <span className="tree-ico">{Ico.clock({})}</span>
        <h1>時間軸</h1>
        <SearchField value={q} onChange={setQ} placeholder="搜尋時刻、場景、人物…" />
      </div>
      <div className="inline" style={{ marginBottom: 12 }}>
        {([["all", "全部"], ["scenes", "場景"], ["events", "經歷"], ["beats", "線索"]] as const).map(([k, lab]) => (
          <button key={k} className={`btn small ${filter === k ? "" : "light"}`} onClick={() => setFilter(k)}>
            {lab}
          </button>
        ))}
      </div>
      <p className="muted">拖曳卡片調整先後；把底部「新時刻」拖到兩則之間即可插入。點場景可跳回寫作。</p>
      {points.length === 0 && <EmptyState title="時間軸還是空的" hint="在下方填名稱後按「加到最後」，或直接拖到軸上。" />}
      <div className="tl">
        <DropGutter active={over === 0} onEnter={() => setOver(0)} onDrop={() => void dropAt(0)} />
        {points.filter((p) => {
          const blob = [p.label, ...p.scenes.map((s) => s.title + s.chapter_title), ...p.events.map((e) => e.character_name + e.summary), ...p.beats.map((b) => b.thread_name + b.summary)].join(" ");
          return !q || blob.includes(q);
        }).map((p, i) => (
          <div key={p.id}>
            <div
              className={`tl-card ${dragId === p.id ? "dragging" : ""}`}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragEnd={() => {
                setDragId(null);
                setOver(null);
              }}
            >
              <span className="tl-handle" title="拖曳以調整順序">
                ⋮⋮
              </span>
              <div className="tl-body">
                {editing === p.id ? (
                  <input
                    autoFocus
                    defaultValue={p.label}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== p.label) void invoke("time.update", { id: p.id, label: v }).then(load);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                ) : (
                  <strong onDoubleClick={() => setEditing(p.id)} title="連按兩下以重新命名">
                    {p.label}
                  </strong>
                )}
                {(filter === "all" || filter === "scenes") && p.scenes.map((s) => (
                  <button key={s.id} className="tl-link" onClick={() => onOpenChapter?.(s.chapter_id)}>
                    場景 · {s.chapter_title}／{s.title || "未命名場景"}
                  </button>
                ))}
                {(filter === "all" || filter === "events") && p.events.map((e) => (
                  <div key={e.id}>
                    {e.character_name}：{e.summary}
                  </div>
                ))}
                {(filter === "all" || filter === "beats") && p.beats.map((b) => (
                  <div key={b.id} className="muted">
                    線索 · {b.thread_name}（{b.kind}）{b.summary}
                  </div>
                ))}
                {p.states.map((s) => (
                  <div key={s.id} className="muted">
                    身分 · {s.character_name} {s.age} {s.status_title}
                  </div>
                ))}
                {!p.scenes.length && !p.events.length && !p.beats.length && (
                  <div className="muted">{i === 0 ? "開篇書籤" : "空白時刻"}</div>
                )}
              </div>
              <IconBtn
                icon={Ico.trash({})}
                tip="刪除此時刻"
                danger
                onClick={async () => {
                  await invoke("time.delete", { id: p.id });
                  await load();
                }}
              />
            </div>
            <DropGutter active={over === i + 1} onEnter={() => setOver(i + 1)} onDrop={() => void dropAt(i + 1)} />
          </div>
        ))}
      </div>
      <div
        className="tl-new"
        draggable
        onDragStart={() => setDragId("__new__")}
        onDragEnd={() => {
          setDragId(null);
          setOver(null);
        }}
      >
        <span className="tree-ico">{Ico.plus({})}</span>
        <input
          placeholder="新時刻名稱（可先填再拖到軸上）"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        <IconBtn
          icon={Ico.plus({})}
          label="加到最後"
          onClick={async () => {
            if (!label.trim()) return;
            await invoke("time.create", { label });
            setLabel("");
            await load();
          }}
        />
      </div>
    </div>
  );
}

function DropGutter({
  active,
  onEnter,
  onDrop,
}: {
  active: boolean;
  onEnter: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      className={`tl-gutter ${active ? "on" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        onEnter();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      {active ? "放開以放到這裡" : ""}
    </div>
  );
}
