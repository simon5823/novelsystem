import { useEffect, useState, type ReactNode } from "react";
import { invoke } from "./api";
import { EmptyState, Ico, IconBtn, SearchField } from "./ui";

type Cat = "faction" | "location" | "etiquette" | "livelihood" | "rules" | "other";
type Rec = Record<string, unknown>;

const CATS: { id: Cat; name: string; hint: string }[] = [
  { id: "faction", name: "勢力", hint: "門派、朝廷、商幫、國家" },
  { id: "location", name: "地點", hint: "可有上下層級，稍後可釘在地圖上" },
  { id: "etiquette", name: "禮儀", hint: "場合、對象、應做與禁止" },
  { id: "livelihood", name: "民生", hint: "貨幣、物價、日常起居" },
  { id: "rules", name: "規則設定", hint: "境界、魔法代價、科技限制" },
  { id: "other", name: "其他", hint: "不便歸類的條目" },
];

export function WorldView() {
  const [cat, setCat] = useState<Cat>("faction");
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  async function refreshCounts() {
    const [f, l, e, v, r, o] = await Promise.all([
      invoke<Rec[]>("factions.list"),
      invoke<Rec[]>("locations.list"),
      invoke<Rec[]>("etiquette.list"),
      invoke<Rec[]>("livelihood.list"),
      invoke<Rec[]>("rules.list"),
      invoke<Rec[]>("entries.list", { category: "other" }),
    ]);
    setCounts({
      faction: f.length,
      location: l.length,
      etiquette: e.length,
      livelihood: v.length,
      rules: r.length,
      other: o.length,
    });
  }
  useEffect(() => {
    void refreshCounts();
  }, [cat]);

  return (
    <div className="page world-page">
      <div className="page-head">
        <span className="tree-ico">{Ico.globe({})}</span>
        <h1>世界觀</h1>
        <SearchField value={q} onChange={setQ} placeholder="搜尋這類條目…" />
      </div>
      <div className="world-split">
        <aside className="world-cats">
          {CATS.map((c) => (
            <button key={c.id} className={`world-cat ${cat === c.id ? "on" : ""}`} onClick={() => { setCat(c.id); setQ(""); }}>
              <b>{c.name}</b>
              <span>{counts[c.id] ?? 0}</span>
            </button>
          ))}
        </aside>
        <div className="world-main">
          <p className="muted">{CATS.find((c) => c.id === cat)?.hint}</p>
          {cat === "faction" && <FactionPane q={q} onChange={refreshCounts} />}
          {cat === "location" && <LocationPane q={q} onChange={refreshCounts} />}
          {cat === "etiquette" && <EtiquettePane q={q} onChange={refreshCounts} />}
          {cat === "livelihood" && <LivelihoodPane q={q} onChange={refreshCounts} />}
          {cat === "rules" && <RulesPane q={q} onChange={refreshCounts} />}
          {cat === "other" && <EntryPane q={q} onChange={refreshCounts} />}
        </div>
      </div>
    </div>
  );
}

function useList(cmd: string, args?: unknown) {
  const [list, setList] = useState<Rec[]>([]);
  const load = () => invoke<Rec[]>(cmd, args).then(setList);
  useEffect(() => {
    void load();
  }, [cmd]);
  return { list, load, setList };
}

function FactionPane({ q, onChange }: { q: string; onChange: () => void }) {
  const { list, load } = useList("factions.list");
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", summary: "", hierarchy_notes: "" });
  const filtered = list.filter((x) => String(x.name).includes(q) || String(x.summary).includes(q));
  const cur = list.find((x) => x.id === sel);

  useEffect(() => {
    if (cur) {
      setDraft({
        name: String(cur.name || ""),
        summary: String(cur.summary || ""),
        hierarchy_notes: String(cur.hierarchy_notes || ""),
      });
    }
  }, [sel, list]);

  return (
    <Split
      onCreate={async () => {
        const id = await invoke<string>("factions.create", { name: "未命名勢力" });
        await load();
        onChange();
        setSel(id);
      }}
      createLabel="新增勢力"
      emptyTitle="還沒有勢力"
      emptyHint="先建立門派、朝廷或商幫，之後可把人物與地點掛上去。"
      items={filtered.map((x) => (
        <button key={String(x.id)} className={`entity-card ${sel === x.id ? "on" : ""}`} onClick={() => setSel(String(x.id))}>
          <b>{String(x.name)}</b>
          <span className="muted">{String(x.summary || "尚無說明").slice(0, 48)}</span>
        </button>
      ))}
      detail={
        cur ? (
          <div className="fields">
            <label>
              名稱
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={() => invoke("factions.update", { id: cur.id, ...draft })} />
            </label>
            <label>
              簡介
              <textarea rows={4} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} onBlur={() => invoke("factions.update", { id: cur.id, ...draft })} />
            </label>
            <label>
              層級／職銜
              <textarea rows={3} value={draft.hierarchy_notes} onChange={(e) => setDraft({ ...draft, hierarchy_notes: e.target.value })} onBlur={() => invoke("factions.update", { id: cur.id, ...draft })} />
            </label>
            <IconBtn icon={Ico.trash({})} label="刪除這個勢力" danger onClick={() => invoke("factions.delete", { id: cur.id }).then(() => { setSel(null); load(); onChange(); })} />
          </div>
        ) : null
      }
    />
  );
}

function LocationPane({ q, onChange }: { q: string; onChange: () => void }) {
  const { list, load } = useList("locations.list");
  const [factions, setFactions] = useState<{ id: string; name: string }[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", summary: "", parent_id: "", controlling_faction_id: "" });
  useEffect(() => {
    void invoke<{ id: string; name: string }[]>("factions.list").then(setFactions);
  }, []);
  const filtered = list.filter((x) => String(x.name).includes(q) || String(x.summary).includes(q));
  const cur = list.find((x) => x.id === sel);
  useEffect(() => {
    if (cur) {
      setDraft({
        name: String(cur.name || ""),
        summary: String(cur.summary || ""),
        parent_id: String(cur.parent_id || ""),
        controlling_faction_id: String(cur.controlling_faction_id || ""),
      });
    }
  }, [sel, list]);
  const parentName = (id: unknown) => String(list.find((x) => x.id === id)?.name || "");

  return (
    <Split
      onCreate={async () => {
        const id = await invoke<string>("locations.create", { name: "未命名地點" });
        await load();
        onChange();
        setSel(id);
      }}
      createLabel="新增地點"
      emptyTitle="還沒有地點"
      emptyHint="先寫下故事發生的地方。地圖釘點稍後再做，資料會沿用。"
      items={filtered.map((x) => (
        <button key={String(x.id)} className={`entity-card ${sel === x.id ? "on" : ""}`} onClick={() => setSel(String(x.id))}>
          <b>{String(x.name)}</b>
          <span className="muted">{parentName(x.parent_id) ? `隸屬 ${parentName(x.parent_id)}` : "獨立地點"}</span>
        </button>
      ))}
      detail={
        cur ? (
          <div className="fields">
            <label>
              名稱
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={() => invoke("locations.update", { id: cur.id, ...draft, parent_id: draft.parent_id || null, controlling_faction_id: draft.controlling_faction_id || null })} />
            </label>
            <label>
              簡介
              <textarea rows={4} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} onBlur={() => invoke("locations.update", { id: cur.id, ...draft, parent_id: draft.parent_id || null, controlling_faction_id: draft.controlling_faction_id || null })} />
            </label>
            <label>
              上級地點
              <select value={draft.parent_id} onChange={(e) => { const v = e.target.value; setDraft({ ...draft, parent_id: v }); void invoke("locations.update", { id: cur.id, parent_id: v || null }); }}>
                <option value="">無</option>
                {list.filter((x) => x.id !== cur.id).map((x) => (
                  <option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>
                ))}
              </select>
            </label>
            <label>
              控制勢力
              <select value={draft.controlling_faction_id} onChange={(e) => { const v = e.target.value; setDraft({ ...draft, controlling_faction_id: v }); void invoke("locations.update", { id: cur.id, controlling_faction_id: v || null }); }}>
                <option value="">無</option>
                {factions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
            <IconBtn icon={Ico.trash({})} label="刪除這個地點" danger onClick={() => invoke("locations.delete", { id: cur.id }).then(() => { setSel(null); load(); onChange(); })} />
          </div>
        ) : null
      }
    />
  );
}

function EtiquettePane({ q, onChange }: { q: string; onChange: () => void }) {
  const { list, load } = useList("etiquette.list");
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", context: "", from_role: "", to_role: "", required: "", forbidden: "", consequence: "" });
  const filtered = list.filter((x) => String(x.name).includes(q) || String(x.context).includes(q));
  const cur = list.find((x) => x.id === sel);
  useEffect(() => {
    if (cur) {
      setDraft({
        name: String(cur.name || ""),
        context: String(cur.context || ""),
        from_role: String(cur.from_role || ""),
        to_role: String(cur.to_role || ""),
        required: String(cur.required || ""),
        forbidden: String(cur.forbidden || ""),
        consequence: String(cur.consequence || ""),
      });
    }
  }, [sel, list]);
  const save = () => cur && invoke("etiquette.update", { id: cur.id, ...draft });
  return (
    <Split
      onCreate={async () => {
        const id = await invoke<string>("etiquette.create", { name: "未命名禮儀" });
        await load();
        onChange();
        setSel(id);
      }}
      createLabel="新增禮儀"
      emptyTitle="還沒有禮儀規則"
      emptyHint="寫下場合、誰對誰、該怎麼做。儲存正文時會用來對照。"
      items={filtered.map((x) => (
        <button key={String(x.id)} className={`entity-card ${sel === x.id ? "on" : ""}`} onClick={() => setSel(String(x.id))}>
          <b>{String(x.name)}</b>
          <span className="muted">{String(x.context || "場合未填")} · {String(x.from_role || "?")}→{String(x.to_role || "?")}</span>
        </button>
      ))}
      detail={
        cur ? (
          <div className="fields">
            <label>名稱<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={save} /></label>
            <label>場合<input value={draft.context} onChange={(e) => setDraft({ ...draft, context: e.target.value })} onBlur={save} placeholder="朝會、私宴、師門…" /></label>
            <label>由誰<input value={draft.from_role} onChange={(e) => setDraft({ ...draft, from_role: e.target.value })} onBlur={save} /></label>
            <label>對誰<input value={draft.to_role} onChange={(e) => setDraft({ ...draft, to_role: e.target.value })} onBlur={save} /></label>
            <label>應做<textarea rows={2} value={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.value })} onBlur={save} /></label>
            <label>禁止<textarea rows={2} value={draft.forbidden} onChange={(e) => setDraft({ ...draft, forbidden: e.target.value })} onBlur={save} /></label>
            <label>違禮後果<textarea rows={2} value={draft.consequence} onChange={(e) => setDraft({ ...draft, consequence: e.target.value })} onBlur={save} /></label>
            <IconBtn icon={Ico.trash({})} label="刪除這則禮儀" danger onClick={() => invoke("etiquette.delete", { id: cur.id }).then(() => { setSel(null); load(); onChange(); })} />
          </div>
        ) : null
      }
    />
  );
}

function LivelihoodPane({ q, onChange }: { q: string; onChange: () => void }) {
  const { list, load } = useList("livelihood.list");
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const filtered = list.filter((x) => String(x.title).includes(q) || String(x.body).includes(q));
  const cur = list.find((x) => x.id === sel);
  useEffect(() => {
    if (cur) setDraft({ title: String(cur.title || ""), body: String(cur.body || "") });
  }, [sel, list]);
  return (
    <Split
      onCreate={async () => {
        const id = await invoke<string>("livelihood.create", { title: "未命名條目" });
        await load();
        onChange();
        setSel(id);
      }}
      createLabel="新增條目"
      emptyTitle="還沒有民生條目"
      emptyHint="記下貨幣、物價、衣食住行，寫作時比較不容易前後打架。"
      items={filtered.map((x) => (
        <button key={String(x.id)} className={`entity-card ${sel === x.id ? "on" : ""}`} onClick={() => setSel(String(x.id))}>
          <b>{String(x.title)}</b>
          <span className="muted">{String(x.body || "").slice(0, 40) || "尚無內文"}</span>
        </button>
      ))}
      detail={
        cur ? (
          <div className="fields">
            <label>標題<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onBlur={() => invoke("livelihood.update", { id: cur.id, ...draft })} /></label>
            <label>內容<textarea rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} onBlur={() => invoke("livelihood.update", { id: cur.id, ...draft })} /></label>
            <IconBtn icon={Ico.trash({})} label="刪除這則條目" danger onClick={() => invoke("livelihood.delete", { id: cur.id }).then(() => { setSel(null); load(); onChange(); })} />
          </div>
        ) : null
      }
    />
  );
}

function RulesPane({ q, onChange }: { q: string; onChange: () => void }) {
  const [list, setList] = useState<{ id: string; name: string; kind: string; summary: string; ranks: { id: string; name: string }[]; constraints: { id: string; statement: string }[] }[]>([]);
  const load = () => invoke<typeof list>("rules.list").then(setList);
  useEffect(() => { void load(); }, []);
  const [sel, setSel] = useState<string | null>(null);
  const [rankName, setRankName] = useState("");
  const [ruleText, setRuleText] = useState("");
  const filtered = list.filter((x) => x.name.includes(q) || x.summary.includes(q));
  const cur = list.find((x) => x.id === sel);
  return (
    <Split
      onCreate={async () => {
        const id = await invoke<string>("rules.create", { name: "未命名體系", kind: "cultivation" });
        await load();
        onChange();
        setSel(id);
      }}
      createLabel="新增體系"
      emptyTitle="還沒有規則設定"
      emptyHint="境界、魔法代價、科技限制都放這裡，儲存正文時可對照是否破格。"
      items={filtered.map((x) => (
        <button key={x.id} className={`entity-card ${sel === x.id ? "on" : ""}`} onClick={() => setSel(x.id)}>
          <b>{x.name}</b>
          <span className="muted">{x.ranks.map((r) => r.name).join(" → ") || "尚未設定境界"}</span>
        </button>
      ))}
      detail={
        cur ? (
          <div className="fields">
            <label>名稱<input defaultValue={cur.name} key={cur.id + "n"} onBlur={(e) => invoke("rules.update", { id: cur.id, name: e.target.value }).then(load)} /></label>
            <label>
              類型
              <select defaultValue={cur.kind} key={cur.id + "k"} onChange={(e) => invoke("rules.update", { id: cur.id, kind: e.target.value }).then(load)}>
                <option value="cultivation">修煉</option>
                <option value="magic">魔法</option>
                <option value="technology">科技</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label>說明<textarea rows={3} defaultValue={cur.summary} key={cur.id + "s"} onBlur={(e) => invoke("rules.update", { id: cur.id, summary: e.target.value }).then(load)} /></label>
            <h3>境界（由低到高）</h3>
            <div className="rank-line">{cur.ranks.map((r) => r.name).join(" → ") || "尚未設定"}</div>
            {cur.ranks.map((r) => (
              <div key={r.id} className="inline">
                {r.name}
                <IconBtn icon={Ico.trash({})} tip="刪除此境界" danger onClick={() => invoke("ranks.delete", { id: r.id }).then(load)} />
              </div>
            ))}
            <div className="inline">
              <input value={rankName} onChange={(e) => setRankName(e.target.value)} placeholder="境界名稱" />
              <IconBtn icon={Ico.plus({})} label="加入" onClick={async () => {
                if (!rankName.trim()) return;
                await invoke("ranks.add", { system_id: cur.id, name: rankName.trim() });
                setRankName("");
                await load();
              }} />
            </div>
            <h3>約束</h3>
            {cur.constraints.map((r) => (
              <div key={r.id} className="inline">
                {r.statement}
                <IconBtn icon={Ico.trash({})} tip="刪除這條約束" danger onClick={() => invoke("constraints.delete", { id: r.id }).then(load)} />
              </div>
            ))}
            <div className="inline">
              <input value={ruleText} onChange={(e) => setRuleText(e.target.value)} placeholder="例如：練氣期不得在凡人面前顯露劍光" />
              <IconBtn icon={Ico.plus({})} label="加入" onClick={async () => {
                if (!ruleText.trim()) return;
                await invoke("constraints.add", { system_id: cur.id, statement: ruleText.trim() });
                setRuleText("");
                await load();
              }} />
            </div>
            <IconBtn icon={Ico.trash({})} label="刪除這個體系" danger onClick={() => invoke("rules.delete", { id: cur.id }).then(() => { setSel(null); load(); onChange(); })} />
          </div>
        ) : null
      }
    />
  );
}

function EntryPane({ q, onChange }: { q: string; onChange: () => void }) {
  const { list, load } = useList("entries.list", { category: "other" });
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const filtered = list.filter((x) => String(x.title).includes(q) || String(x.body).includes(q));
  const cur = list.find((x) => x.id === sel);
  useEffect(() => {
    if (cur) setDraft({ title: String(cur.title || ""), body: String(cur.body || "") });
  }, [sel, list]);
  return (
    <Split
      onCreate={async () => {
        const id = await invoke<string>("entries.create", { category: "other", title: "未命名條目" });
        await load();
        onChange();
        setSel(id);
      }}
      createLabel="新增條目"
      emptyTitle="還沒有其他條目"
      emptyHint="不方便歸進勢力或禮儀的資料，可以放這裡。"
      items={filtered.map((x) => (
        <button key={String(x.id)} className={`entity-card ${sel === x.id ? "on" : ""}`} onClick={() => setSel(String(x.id))}>
          <b>{String(x.title)}</b>
        </button>
      ))}
      detail={
        cur ? (
          <div className="fields">
            <label>標題<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onBlur={() => invoke("entries.update", { id: cur.id, ...draft })} /></label>
            <label>內容<textarea rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} onBlur={() => invoke("entries.update", { id: cur.id, ...draft })} /></label>
            <IconBtn icon={Ico.trash({})} label="刪除這則條目" danger onClick={() => invoke("entries.delete", { id: cur.id }).then(() => { setSel(null); load(); onChange(); })} />
          </div>
        ) : null
      }
    />
  );
}

function Split({
  items,
  detail,
  onCreate,
  createLabel,
  emptyTitle,
  emptyHint,
}: {
  items: ReactNode[];
  detail: ReactNode;
  onCreate: () => void;
  createLabel: string;
  emptyTitle: string;
  emptyHint: string;
}) {
  return (
    <div className="entity-split">
      <div>
        <IconBtn icon={Ico.plus({})} label={createLabel} onClick={onCreate} />
        <div className="entity-list">
          {items.length ? items : <EmptyState title={emptyTitle} hint={emptyHint} />}
        </div>
      </div>
      <div className="entity-detail">{detail || <p className="muted">從左側點一則來看詳細內容。</p>}</div>
    </div>
  );
}
