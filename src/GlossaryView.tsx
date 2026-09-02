import { useEffect, useMemo, useState } from "react";
import { invoke } from "./api";
import { EmptyState, Ico, IconBtn, SearchField } from "./ui";

const FORMAL: { id: string; name: string }[] = [
  { id: "high", name: "敬稱" },
  { id: "neutral", name: "中性" },
  { id: "low", name: "輕慢" },
  { id: "intimate", name: "親暱" },
];

type Kind = { id: string; key: string; name: string; builtin: number; color: string; sort_order: number };
type Term = {
  id: string;
  surface: string;
  normalized: string;
  kind: string;
  forbidden_variants: string[];
  notes: string;
};
type TermDraft = {
  surface: string;
  normalized: string;
  kind: string;
  forbidden: string;
  notes: string;
};

const emptyTerm = (kind: string): TermDraft => ({
  surface: "",
  normalized: "",
  kind,
  forbidden: "",
  notes: "",
});

export function GlossaryView() {
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [addr, setAddr] = useState<Record<string, unknown>[]>([]);
  const [q, setQ] = useState("");
  const [selKind, setSelKind] = useState<string>("all");
  const [selTerm, setSelTerm] = useState<string | null>(null);
  const [draft, setDraft] = useState<TermDraft>(emptyTerm("other"));
  const [editing, setEditing] = useState(false);
  const [newKind, setNewKind] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrDraft, setAddrDraft] = useState({
    speaker_spec: "",
    addressee_spec: "",
    term: "",
    formality: "neutral",
    notes: "",
  });
  const [dragTerm, setDragTerm] = useState<string | null>(null);

  async function load() {
    const [k, t, a] = await Promise.all([
      invoke<Kind[]>("termKinds.list"),
      invoke<Term[]>("terms.list"),
      invoke<Record<string, unknown>[]>("address.list"),
    ]);
    setKinds(k);
    setTerms(t);
    setAddr(a);
  }
  useEffect(() => {
    void load();
  }, []);

  const kindByKey = useMemo(() => Object.fromEntries(kinds.map((k) => [k.key, k])), [kinds]);
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: terms.length };
    for (const k of kinds) m[k.key] = 0;
    for (const t of terms) m[t.kind] = (m[t.kind] || 0) + 1;
    return m;
  }, [kinds, terms]);

  const shown = terms.filter((t) => {
    if (selKind !== "all" && selKind !== "address" && t.kind !== selKind) return false;
    if (!q) return true;
    return t.surface.includes(q) || t.normalized.includes(q) || (t.notes || "").includes(q);
  });

  const grouped = useMemo(() => {
    if (selKind !== "all") return null;
    const map = new Map<string, Term[]>();
    for (const k of kinds) map.set(k.key, []);
    map.set("__unknown", []);
    for (const t of shown) {
      if (map.has(t.kind)) map.get(t.kind)!.push(t);
      else map.get("__unknown")!.push(t);
    }
    return map;
  }, [shown, kinds, selKind]);

  function openNew() {
    const kind = selKind === "all" || selKind === "address" ? "other" : selKind;
    setSelTerm(null);
    setDraft(emptyTerm(kind));
    setEditing(true);
  }

  function openTerm(t: Term) {
    setSelTerm(t.id);
    setDraft({
      surface: t.surface,
      normalized: t.normalized,
      kind: t.kind,
      forbidden: (t.forbidden_variants || []).join("、"),
      notes: t.notes || "",
    });
    setEditing(true);
  }

  async function saveTerm() {
    const surface = draft.surface.trim();
    if (!surface) return;
    const payload = {
      surface,
      normalized: draft.normalized.trim() || surface,
      kind: draft.kind,
      forbidden_variants: draft.forbidden.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
      notes: draft.notes,
    };
    if (selTerm) await invoke("terms.update", { id: selTerm, ...payload });
    else {
      const id = await invoke<string>("terms.create", payload);
      setSelTerm(id);
    }
    setEditing(false);
    await load();
  }

  async function addKind() {
    const name = newKind.trim();
    if (!name) return;
    const r = await invoke<{ key: string }>("termKinds.create", { name });
    setNewKind("");
    await load();
    setSelKind(r.key);
  }

  async function dropOnKind(key: string) {
    if (!dragTerm) return;
    await invoke("terms.update", { id: dragTerm, kind: key });
    setDragTerm(null);
    await load();
  }

  async function moveKind(index: number, dir: -1 | 1) {
    const ids = kinds.map((k) => k.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    const tmp = ids[index];
    ids[index] = ids[j];
    ids[j] = tmp;
    await invoke("termKinds.reorder", { ids });
    await load();
  }

  return (
    <div className="page glossary-page">
      <div className="page-head">
        <span className="tree-ico">{Ico.book({})}</span>
        <h1>詞彙與稱呼</h1>
        <SearchField value={q} onChange={setQ} placeholder="搜尋詞目、標準寫法、備註…" />
        <IconBtn icon={Ico.plus({})} label="新增詞條" onClick={openNew} />
      </div>

      <div className="gloss-split">
        <aside className="gloss-cats">
          <button className={`world-cat ${selKind === "all" ? "on" : ""}`} onClick={() => { setSelKind("all"); setEditing(false); }}>
            <b>全部</b>
            <span>{counts.all || 0}</span>
          </button>
          {kinds.map((k, i) => (
            <div
              key={k.id}
              className={`kind-row ${selKind === k.key ? "on" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void dropOnKind(k.key)}
            >
              <button className="kind-main" onClick={() => { setSelKind(k.key); setEditing(false); setSelTerm(null); }}>
                <span className="kind-dot" style={{ background: k.color }} />
                {renaming === k.id ? (
                  <input
                    autoFocus
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={async () => {
                      if (renameVal.trim()) await invoke("termKinds.update", { id: k.id, name: renameVal.trim() });
                      setRenaming(null);
                      await load();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                ) : (
                  <b>{k.name}</b>
                )}
                <span>{counts[k.key] || 0}</span>
              </button>
              <span className="kind-ops">
                <button className="mini" title="上移" onClick={() => void moveKind(i, -1)}>↑</button>
                <button className="mini" title="下移" onClick={() => void moveKind(i, 1)}>↓</button>
                <button
                  className="mini"
                  title="重新命名"
                  onClick={() => {
                    setRenaming(k.id);
                    setRenameVal(k.name);
                  }}
                >
                  改
                </button>
                {!k.builtin && (
                  <button
                    className="mini"
                    title="刪除種類（詞條會改歸「其他」）"
                    onClick={async () => {
                      if (!window.confirm(`刪除「${k.name}」？其中的詞條會改歸「其他」。`)) return;
                      await invoke("termKinds.delete", { id: k.id });
                      if (selKind === k.key) setSelKind("other");
                      await load();
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            </div>
          ))}
          <div className="kind-add">
            <input
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
              placeholder="自訂種類名稱"
              onKeyDown={(e) => {
                if (e.key === "Enter") void addKind();
              }}
            />
            <IconBtn icon={Ico.plus({})} tip="新增種類" onClick={() => void addKind()} />
          </div>
          <button
            className={`world-cat ${selKind === "address" ? "on" : ""}`}
            onClick={() => {
              setSelKind("address");
              setEditing(false);
            }}
          >
            <b>稱呼規則</b>
            <span>{addr.length}</span>
          </button>
        </aside>

        <div className="gloss-main">
          {selKind === "address" ? (
            <AddressPane addr={addr} addrOpen={addrOpen} setAddrOpen={setAddrOpen} addrDraft={addrDraft} setAddrDraft={setAddrDraft} onSave={async () => {
              if (!addrDraft.term.trim()) return;
              await invoke("address.create", addrDraft);
              setAddrDraft({ speaker_spec: "", addressee_spec: "", term: "", formality: "neutral", notes: "" });
              setAddrOpen(false);
              await load();
            }} onDelete={async (id) => { await invoke("address.delete", { id }); await load(); }} />
          ) : (
            <div className="entity-split">
              <div>
                <div className="inline" style={{ marginBottom: 8 }}>
                  <span className="muted">
                    {selKind === "all" ? "依種類分組" : kindByKey[selKind]?.name || "此種類"}
                    {" · "}
                    可把詞條拖到左側種類上歸類
                  </span>
                </div>
                <div className="entity-list">
                  {selKind === "all" && grouped
                    ? kinds.map((k) => {
                        const items = grouped.get(k.key) || [];
                        if (!items.length && q) return null;
                        return (
                          <div key={k.key} className="kind-group">
                            <div className="kind-group-h">
                              <span className="kind-dot" style={{ background: k.color }} />
                              {k.name}
                              <span className="muted">{items.length}</span>
                            </div>
                            {items.map((t) => (
                              <TermRow key={t.id} t={t} kind={k} active={selTerm === t.id} onOpen={openTerm} onDrag={setDragTerm} />
                            ))}
                            {!items.length && <p className="muted" style={{ paddingLeft: 18 }}>此種類尚無詞條</p>}
                          </div>
                        );
                      })
                    : shown.map((t) => (
                        <TermRow
                          key={t.id}
                          t={t}
                          kind={kindByKey[t.kind]}
                          active={selTerm === t.id}
                          onOpen={openTerm}
                          onDrag={setDragTerm}
                        />
                      ))}
                  {!shown.length && (
                    <EmptyState title="沒有符合的詞條" hint="換個關鍵字，或按右上角新增。" />
                  )}
                </div>
              </div>
              <div className="entity-detail">
                {editing ? (
                  <div className="fields">
                    <h3>{selTerm ? "編輯詞條" : "新增詞條"}</h3>
                    <label>
                      詞目
                      <input value={draft.surface} onChange={(e) => setDraft({ ...draft, surface: e.target.value })} placeholder="正文裡出現的寫法" />
                    </label>
                    <label>
                      標準寫法
                      <input value={draft.normalized} onChange={(e) => setDraft({ ...draft, normalized: e.target.value })} placeholder="若與詞目相同可留空" />
                    </label>
                    <label>
                      種類
                      <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                        {kinds.map((k) => (
                          <option key={k.key} value={k.key}>
                            {k.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      常見錯字（以頓號分隔）
                      <input value={draft.forbidden} onChange={(e) => setDraft({ ...draft, forbidden: e.target.value })} />
                    </label>
                    <label>
                      備註
                      <textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                    </label>
                    <div className="inline">
                      <IconBtn icon={Ico.plus({})} label={selTerm ? "儲存" : "建立詞條"} onClick={() => void saveTerm()} />
                      <IconBtn icon={Ico.close({})} label="取消" onClick={() => setEditing(false)} />
                      {selTerm && (
                        <IconBtn
                          icon={Ico.trash({})}
                          label="刪除"
                          danger
                          onClick={async () => {
                            if (!window.confirm("刪除這則詞條？")) return;
                            await invoke("terms.delete", { id: selTerm });
                            setSelTerm(null);
                            setEditing(false);
                            await load();
                          }}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState title="選一則詞條" hint="點左側詞目可編輯；也可拖到種類上重新歸類。" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TermRow({
  t,
  kind,
  active,
  onOpen,
  onDrag,
}: {
  t: Term;
  kind?: Kind;
  active: boolean;
  onOpen: (t: Term) => void;
  onDrag: (id: string) => void;
}) {
  return (
    <button
      draggable
      className={`entity-card ${active ? "on" : ""}`}
      onClick={() => onOpen(t)}
      onDragStart={() => onDrag(t.id)}
    >
      <b>{t.surface}</b>
      <span className="muted">
        {kind ? kind.name : t.kind}
        {t.normalized !== t.surface ? ` · 標準：${t.normalized}` : ""}
      </span>
    </button>
  );
}

function AddressPane({
  addr,
  addrOpen,
  setAddrOpen,
  addrDraft,
  setAddrDraft,
  onSave,
  onDelete,
}: {
  addr: Record<string, unknown>[];
  addrOpen: boolean;
  setAddrOpen: (v: boolean) => void;
  addrDraft: { speaker_spec: string; addressee_spec: string; term: string; formality: string; notes: string };
  setAddrDraft: (v: { speaker_spec: string; addressee_spec: string; term: string; formality: string; notes: string }) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="inline" style={{ marginBottom: 12 }}>
        <IconBtn icon={Ico.plus({})} label="新增稱呼" active={addrOpen} onClick={() => setAddrOpen(!addrOpen)} />
      </div>
      {addrOpen && (
        <div className="card fields" style={{ maxWidth: 560, marginBottom: 16 }}>
          <label>說話的人<input value={addrDraft.speaker_spec} onChange={(e) => setAddrDraft({ ...addrDraft, speaker_spec: e.target.value })} /></label>
          <label>對方<input value={addrDraft.addressee_spec} onChange={(e) => setAddrDraft({ ...addrDraft, addressee_spec: e.target.value })} /></label>
          <label>所用稱呼<input value={addrDraft.term} onChange={(e) => setAddrDraft({ ...addrDraft, term: e.target.value })} placeholder="例如：師尊、閣下、你" /></label>
          <label>
            語體
            <select value={addrDraft.formality} onChange={(e) => setAddrDraft({ ...addrDraft, formality: e.target.value })}>
              {FORMAL.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </label>
          <label>備註<input value={addrDraft.notes} onChange={(e) => setAddrDraft({ ...addrDraft, notes: e.target.value })} /></label>
          <div className="inline">
            <IconBtn icon={Ico.plus({})} label="建立稱呼" onClick={onSave} />
            <IconBtn icon={Ico.close({})} label="取消" onClick={() => setAddrOpen(false)} />
          </div>
        </div>
      )}
      {!addr.length && <EmptyState title="尚無稱呼規則" hint="例如弟子對師尊稱「師尊」，可在這裡列清楚。" />}
      {addr.map((a) => (
        <div className="card inline" key={String(a.id)}>
          {String(a.speaker_spec)} → {String(a.addressee_spec)} 稱「{String(a.term)}」
          <span className="muted"> {FORMAL.find((f) => f.id === a.formality)?.name || ""}</span>
          <IconBtn icon={Ico.trash({})} tip="刪除" danger onClick={() => onDelete(String(a.id))} />
        </div>
      ))}
    </div>
  );
}
