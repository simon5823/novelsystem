import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { invoke } from "./api";
import { EmptyState, Ico, IconBtn, SearchField } from "./ui";

type Char = { id: string; name: string; gender: string; color: string; aliases?: string[] };
type Rel = {
  id: string;
  from_id: string;
  to_id: string;
  type: string;
  label: string;
  from_name: string;
  to_name: string;
  from_color: string;
  to_color: string;
};

const REL_TYPE: Record<string, string> = {
  kin: "親族",
  master_disciple: "師徒",
  romantic: "情愛",
  friend: "友好",
  enemy: "敵對",
  lord_vassal: "主從",
  other: "其他",
};

const TABS = ["總覽", "基本資料", "身分沿革", "經歷", "關係", "所知", "關係圖"] as const;

export function CharactersView() {
  const [list, setList] = useState<Char[]>([]);
  const [cur, setCur] = useState<string | null>(null);
  const [card, setCard] = useState<Record<string, unknown> | null>(null);
  const [times, setTimes] = useState<{ id: string; label: string }[]>([]);
  const [factions, setFactions] = useState<{ id: string; name: string }[]>([]);
  const [facts, setFacts] = useState<{ id: string; statement: string }[]>([]);
  const [rels, setRels] = useState<Rel[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("總覽");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  async function loadList() {
    setList((await invoke<Char[]>("characters.list")) as Char[]);
    setTimes(await invoke("time.list"));
    setFactions(await invoke("factions.list"));
    setFacts(await invoke("facts.list"));
    setRels(await invoke<Rel[]>("rel.list"));
  }
  async function loadCard(id: string) {
    setCard(await invoke("characters.get", { id }));
  }
  useEffect(() => {
    void loadList();
  }, []);
  useEffect(() => {
    if (cur) void loadCard(cur);
  }, [cur]);

  const c = card as {
    id: string;
    name: string;
    aliases: string[];
    gender: string;
    appearance: string;
    personality: string;
    speech_pattern: string;
    goals: string;
    notes: string;
    color: string;
    states: Record<string, unknown>[];
    events: Record<string, unknown>[];
    relationships: Record<string, unknown>[];
    knowledge: Record<string, unknown>[];
  } | null;

  const latest = c?.states?.[c.states.length - 1];

  return (
    <div className="page">
      <div className="page-head">
        <span className="tree-ico">{Ico.person({})}</span>
        <h1>人物</h1>
        <SearchField value={q} onChange={setQ} placeholder="搜尋人物…" />
        <IconBtn icon={Ico.plus({})} label="新增人物" active={creating} onClick={() => setCreating((v) => !v)} />
      </div>
      {creating && (
        <div className="inline" style={{ marginBottom: 12 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="人物姓名" />
          <IconBtn
            icon={Ico.plus({})}
            label="建立"
            onClick={async () => {
              if (!newName.trim()) return;
              const id = await invoke<string>("characters.create", { name: newName.trim() });
              setNewName("");
              setCreating(false);
              await loadList();
              setCur(id);
              setTab("基本資料");
            }}
          />
        </div>
      )}
      <div className="grid char-layout">
        <div className="list">
          {list.filter((x) => x.name.includes(q) || (x.aliases || []).some((a) => a.includes(q))).map((x) => (
            <button key={x.id} className={`char-row ${cur === x.id ? "on" : ""}`} onClick={() => setCur(x.id)}>
              <span className="avatar" style={{ background: x.color || "#9b2d1f" }}>
                {x.name.slice(0, 1)}
              </span>
              <span className="char-row-txt">
                <b>{x.name}</b>
                <span className="muted">{x.gender || "性別未填"}</span>
              </span>
            </button>
          ))}
        </div>
        <div>
          {list.length === 0 ? (
            <EmptyState title="還沒有人物" hint="先新增一兩位，再補關係與所知，寫作儲存時才同步得起來。" />
          ) : !c ? (
            <p className="muted">請從左側選擇一位人物，或先新增。</p>
          ) : (
            <>
              <div className="profile-head">
                <span className="avatar lg" style={{ background: c.color || "#9b2d1f" }}>
                  {c.name.slice(0, 1)}
                </span>
                <div>
                  <h2 className="profile-name">{c.name}</h2>
                  <div className="alias-chips">
                    {c.gender && <span className="chip on">{c.gender}</span>}
                    {(c.aliases || []).map((a) => (
                      <span className="chip" key={a}>
                        {a}
                      </span>
                    ))}
                    {latest && (
                      <span className="chip">
                        {String(latest.age || "")} {String(latest.status_title || "")}
                      </span>
                    )}
                  </div>
                </div>
                <IconBtn
                  icon={Ico.trash({})}
                  tip="刪除這位人物"
                  danger
                  onClick={async () => {
                    if (!window.confirm("確定刪除這位人物？")) return;
                    await invoke("characters.delete", { id: c.id });
                    setCur(null);
                    setCard(null);
                    await loadList();
                  }}
                />
              </div>
              <div className="inline tab-row">
                {TABS.map((t) => (
                  <button key={t} className={`btn small ${tab === t ? "" : "light"}`} onClick={() => setTab(t)}>
                    {t}
                  </button>
                ))}
              </div>
              {tab === "總覽" && <Overview c={c} times={times} latest={latest} />}
              {tab === "基本資料" && <Basics c={c} setCard={setCard} />}
              {tab === "身分沿革" && <States c={c} times={times} factions={factions} reload={() => loadCard(c.id)} />}
              {tab === "經歷" && <Events c={c} times={times} reload={() => loadCard(c.id)} />}
              {tab === "關係" && (
                <Rels c={c} list={list} times={times} reload={() => { void loadCard(c.id); void loadList(); }} />
              )}
              {tab === "所知" && (
                <Know
                  c={c}
                  facts={facts}
                  times={times}
                  reload={() => {
                    void loadCard(c.id);
                    void loadList();
                  }}
                />
              )}
              {tab === "關係圖" && (
                <RelGraph
                  chars={list}
                  rels={rels}
                  current={c.id}
                  onSelect={(id) => {
                    setCur(id);
                    setTab("總覽");
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Overview({
  c,
  times,
  latest,
}: {
  c: {
    appearance: string;
    personality: string;
    speech_pattern: string;
    goals: string;
    notes: string;
    events: Record<string, unknown>[];
    relationships: Record<string, unknown>[];
    knowledge: Record<string, unknown>[];
  };
  times: { id: string; label: string }[];
  latest?: Record<string, unknown>;
}) {
  return (
    <div className="overview-grid">
      <div className="card">
        <h3>目前身分</h3>
        <p>{latest ? `${times.find((t) => t.id === latest.time_point_id)?.label || ""} · ${latest.age || ""} · ${latest.status_title || "尚未填寫"} · ${latest.alive ? "在世" : "已歿"}` : "尚未建立身分沿革。"}</p>
      </div>
      <div className="card">
        <h3>性格與口吻</h3>
        <p>{c.personality || "尚未填寫性格。"}</p>
        <p className="muted">{c.speech_pattern || "尚未填寫說話習慣。"}</p>
      </div>
      <div className="card">
        <h3>外貌</h3>
        <p>{c.appearance || "尚未描寫。"}</p>
      </div>
      <div className="card">
        <h3>動機</h3>
        <p>{c.goals || "尚未填寫。"}</p>
      </div>
      <div className="card">
        <h3>關係 {c.relationships.length} 則</h3>
        {c.relationships.slice(0, 6).map((r) => (
          <div key={String(r.id)} className="muted">
            {String(r.from_name)} → {String(r.to_name)} · {REL_TYPE[String(r.type)] || String(r.type)} {String(r.label)}
          </div>
        ))}
      </div>
      <div className="card">
        <h3>近期經歷</h3>
        {c.events.slice(-4).map((e) => (
          <div key={String(e.id)} className="muted">
            {times.find((t) => t.id === e.time_point_id)?.label} · {String(e.summary)}
          </div>
        ))}
        {!c.events.length && <p className="muted">尚無經歷。</p>}
      </div>
    </div>
  );
}

function Basics({
  c,
  setCard,
}: {
  c: Record<string, unknown> & { id: string; aliases: string[] };
  setCard: (v: Record<string, unknown>) => void;
}) {
  const fields = [
    ["name", "姓名"],
    ["gender", "性別"],
    ["appearance", "外貌"],
    ["personality", "性格"],
    ["speech_pattern", "說話習慣"],
    ["goals", "動機與目標"],
    ["notes", "備註"],
  ] as const;
  return (
    <div className="fields" style={{ marginTop: 12 }}>
      {fields.map(([k, lab]) => (
        <label key={k}>
          {lab}
          {k === "name" || k === "gender" ? (
            <input
              value={String(c[k] ?? "")}
              onChange={(e) => setCard({ ...c, [k]: e.target.value })}
              onBlur={() => invoke("characters.update", { id: c.id, [k]: c[k] })}
            />
          ) : (
            <textarea
              rows={3}
              value={String(c[k] ?? "")}
              onChange={(e) => setCard({ ...c, [k]: e.target.value })}
              onBlur={() => invoke("characters.update", { id: c.id, [k]: c[k] })}
            />
          )}
        </label>
      ))}
      <label>
        別名（以頓號或逗號分隔）
        <input
          value={(c.aliases || []).join("、")}
          onChange={(e) =>
            setCard({ ...c, aliases: e.target.value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean) })
          }
          onBlur={() => invoke("characters.update", { id: c.id, aliases: c.aliases })}
        />
      </label>
    </div>
  );
}

function States({
  c,
  times,
  factions,
  reload,
}: {
  c: { id: string; states: Record<string, unknown>[] };
  times: { id: string; label: string }[];
  factions: { id: string; name: string }[];
  reload: () => void;
}) {
  const [form, setForm] = useState({ time_point_id: times[0]?.id || "", age: "", status_title: "", faction_id: "", alive: "1" });
  return (
    <div>
      {c.states.map((s) => (
        <div className="card" key={String(s.id)}>
          {times.find((t) => t.id === s.time_point_id)?.label} · {String(s.age)} · {String(s.status_title)}{" "}
          {s.alive ? "在世" : "已歿"}
          <IconBtn icon={Ico.trash({})} tip="刪除這筆身分" danger onClick={() => invoke("state.delete", { id: s.id }).then(reload)} />
        </div>
      ))}
      <div className="fields">
        <label>
          時刻
          <select value={form.time_point_id} onChange={(e) => setForm({ ...form, time_point_id: e.target.value })}>
            {times.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          年齡
          <input value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        </label>
        <label>
          身分
          <input value={form.status_title} onChange={(e) => setForm({ ...form, status_title: e.target.value })} />
        </label>
        <label>
          所屬勢力
          <select value={form.faction_id} onChange={(e) => setForm({ ...form, faction_id: e.target.value })}>
            <option value="">（無）</option>
            {factions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <IconBtn
          icon={Ico.plus({})}
          label="新增一筆身分"
          onClick={async () => {
            await invoke("state.add", { ...form, character_id: c.id, alive: form.alive === "1" ? 1 : 0 });
            reload();
          }}
        />
      </div>
    </div>
  );
}

function Events({
  c,
  times,
  reload,
}: {
  c: { id: string; events: Record<string, unknown>[] };
  times: { id: string; label: string }[];
  reload: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [tp, setTp] = useState(times[0]?.id || "");
  return (
    <div>
      {c.events.map((e) => (
        <div className="card" key={String(e.id)}>
          {times.find((t) => t.id === e.time_point_id)?.label} · {String(e.summary)}
          <IconBtn icon={Ico.trash({})} tip="刪除這則經歷" danger onClick={() => invoke("event.delete", { id: e.id }).then(reload)} />
        </div>
      ))}
      <div className="fields">
        <select value={tp} onChange={(e) => setTp(e.target.value)}>
          {times.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="經歷摘要" />
        <IconBtn
          icon={Ico.plus({})}
          label="新增經歷"
          onClick={async () => {
            await invoke("event.add", { character_id: c.id, time_point_id: tp, summary });
            setSummary("");
            reload();
          }}
        />
      </div>
    </div>
  );
}

function Rels({
  c,
  list,
  times,
  reload,
}: {
  c: { id: string; relationships: Record<string, unknown>[] };
  list: Char[];
  times: { id: string; label: string }[];
  reload: () => void;
}) {
  const [to, setTo] = useState("");
  const [type, setType] = useState("other");
  const [label, setLabel] = useState("");
  return (
    <div>
      {c.relationships.map((r) => (
        <div className="card" key={String(r.id)}>
          {String(r.from_name)} → {String(r.to_name)} · {REL_TYPE[String(r.type)] || String(r.type)} {String(r.label)}
          <IconBtn icon={Ico.trash({})} tip="刪除這則關係" danger onClick={() => invoke("rel.delete", { id: r.id }).then(reload)} />
        </div>
      ))}
      <div className="fields">
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">關係對象</option>
          {list
            .filter((x) => x.id !== c.id)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(REL_TYPE).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例如：嫡兄、師尊、表面盟友" />
        <IconBtn
          icon={Ico.plus({})}
          label="新增人物關係"
          onClick={async () => {
            if (!to) return;
            await invoke("rel.add", { from_id: c.id, to_id: to, type, label, start_time_id: times[0]?.id });
            reload();
          }}
        />
      </div>
    </div>
  );
}

function Know({
  c,
  facts,
  times,
  reload,
}: {
  c: { id: string; knowledge: Record<string, unknown>[] };
  facts: { id: string; statement: string }[];
  times: { id: string; label: string }[];
  reload: () => void;
}) {
  const [statement, setStatement] = useState("");
  const [secret, setSecret] = useState(true);
  const [factId, setFactId] = useState("");
  return (
    <div>
      {c.knowledge.map((k) => (
        <div className="card" key={String(k.id)}>
          {k.is_secret ? <span className="badge">密</span> : null} {String(k.statement)}
          {k.believed ? " · 相信" : " · 不信"}
          <IconBtn icon={Ico.trash({})} tip="刪除這則所知" danger onClick={() => invoke("knowledge.delete", { id: k.id }).then(reload)} />
        </div>
      ))}
      <h3 className="muted">將既有資訊記到此人</h3>
      <div className="inline">
        <select value={factId} onChange={(e) => setFactId(e.target.value)}>
          <option value="">選擇一則資訊</option>
          {facts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.statement}
            </option>
          ))}
        </select>
        <IconBtn
          icon={Ico.plus({})}
          label="記為已知"
          onClick={async () => {
            if (!factId) return;
            await invoke("knowledge.add", { character_id: c.id, fact_id: factId, learned_at_time_id: times[0]?.id });
            reload();
          }}
        />
      </div>
      <h3 className="muted">新增一則資訊／秘密</h3>
      <div className="fields">
        <input value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="故事裡的一則可知資訊" />
        <label>
          <input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} /> 這是秘密
        </label>
        <IconBtn
          icon={Ico.plus({})}
          label="建立並記為已知"
          onClick={async () => {
            const fid = await invoke<string>("facts.create", { statement, is_secret: secret, about_ids: [c.id] });
            await invoke("knowledge.add", { character_id: c.id, fact_id: fid, learned_at_time_id: times[0]?.id });
            setStatement("");
            reload();
          }}
        />
      </div>
    </div>
  );
}

function RelGraph({
  chars,
  rels,
  current,
  onSelect,
}: {
  chars: Char[];
  rels: Rel[];
  current: string;
  onSelect: (id: string) => void;
}) {
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const [drag, setDrag] = useState<string | null>(null);
  const movedRef = useRef(false);
  const w = 560;
  const h = 420;

  const base = useMemo(() => {
    const n = Math.max(chars.length, 1);
    const R = 150;
    const cx = w / 2;
    const cy = h / 2;
    const next: Record<string, { x: number; y: number }> = {};
    chars.forEach((c, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      next[c.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    });
    return next;
  }, [chars]);
  const layout = { ...base, ...pos };

  function onMove(e: MouseEvent<SVGSVGElement>) {
    if (!drag) return;
    movedRef.current = true;
    const svg = e.currentTarget;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * w;
    const y = ((e.clientY - r.top) / r.height) * h;
    setPos((p) => ({ ...p, [drag]: { x, y } }));
  }

  return (
    <div>
      <p className="muted">可拖曳圓點調整位置；點選人物可開啟其總覽。線段表示已建立的關係。</p>
      <svg
        className="rel-graph"
        viewBox={`0 0 ${w} ${h}`}
        onMouseMove={onMove}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
      >
        {rels.map((r) => {
          const a = layout[r.from_id];
          const b = layout[r.to_id];
          if (!a || !b) return null;
          const enemy = r.type === "enemy";
          return (
            <g key={r.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={enemy ? "#9b2d1f" : "#b0893e"} strokeWidth="1.6" />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle" className="rel-label">
                {r.label || REL_TYPE[r.type] || r.type}
              </text>
            </g>
          );
        })}
        {chars.map((c) => {
          const p = layout[c.id];
          if (!p) return null;
          const on = c.id === current;
          return (
            <g
              key={c.id}
              style={{ cursor: "pointer" }}
              onMouseDown={() => {
                movedRef.current = false;
                setDrag(c.id);
              }}
              onClick={() => {
                if (!movedRef.current) onSelect(c.id);
              }}
            >
              <circle cx={p.x} cy={p.y} r={on ? 22 : 18} fill={c.color || "#9b2d1f"} stroke={on ? "#1c1612" : "#f3ead6"} strokeWidth={on ? 3 : 1.5} />
              <text x={p.x} y={p.y + 34} textAnchor="middle" className="rel-name">
                {c.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
