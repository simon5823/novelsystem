import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, toastError } from "./api";
import { wordCount } from "../shared/text";
import { Ico, IconBtn } from "./ui";

type Scene = {
  id: string;
  title: string;
  summary: string;
  body: string;
  time_point_id: string | null;
  location_id: string | null;
  pov_character_id: string | null;
  word_count: number;
  presence: string[];
  threads: { thread_id: string; beat_id: string | null }[];
};

type Chapter = {
  id: string;
  title: string;
  summary: string;
  status: string;
  word_count: number;
  book_word_count?: number;
  scenes: Scene[];
};

type TreeChapter = {
  id: string;
  title: string;
  word_count: number;
  status: string;
  scenes: { id: string; title: string; word_count: number }[];
};
type TreeVolume = { id: string; title: string; word_count: number; chapters: TreeChapter[] };
type TreePart = { id: string; title: string; summary: string; word_count: number; volumes: TreeVolume[] };
type Tree = TreePart[];

export function WriteView({
  focus,
  chapterId,
  onChapterId,
  onStatus,
  onBookWc,
  onDirty,
}: {
  focus: boolean;
  chapterId: string | null;
  onChapterId: (id: string) => void;
  onStatus: (s: string) => void;
  onBookWc: (n: number) => void;
  onDirty: (d: boolean) => void;
}) {
  const [tree, setTree] = useState<Tree>([]);
  const [ch, setCh] = useState<Chapter | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setChStatus] = useState("draft");
  const [dirty, setDirty] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [binderOpen, setBinderOpen] = useState(true);
  const [cardView, setCardView] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState("");
  const [zoom, setZoom] = useState(19);
  const [dragId, setDragId] = useState<string | null>(null);
  const [focusPart, setFocusPart] = useState<string>("all");
  const [openParts, setOpenParts] = useState<Record<string, boolean>>({});
  const [openVols, setOpenVols] = useState<Record<string, boolean>>({});
  const [snapshots, setSnapshots] = useState<{ id: string; created_at: string; trigger: string; note: string; body: string }[]>([]);
  const [bible, setBible] = useState<{
    time_points: { id: string; label: string }[];
    characters: { id: string; name: string }[];
    locations: { id: string; name: string }[];
    threads: { id: string; name: string; type: string }[];
  }>({ time_points: [], characters: [], locations: [], threads: [] });
  const persistTimer = useRef<number | null>(null);
  const textRef = useRef("");
  const sceneIdRef = useRef<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const findRef = useRef<HTMLInputElement | null>(null);

  textRef.current = text;
  sceneIdRef.current = sceneId;
  const scene = ch?.scenes.find((s) => s.id === sceneId) ?? ch?.scenes[0] ?? null;
  const sceneIndex = ch ? Math.max(0, ch.scenes.findIndex((s) => s.id === sceneId)) : 0;
  const chapterWc = ch?.scenes.reduce((n, s) => n + wordCount(s.id === sceneId ? text : s.body || ""), 0) ?? 0;

  const markDirty = (d: boolean) => {
    setDirty(d);
    onDirty(d);
  };

  const loadTree = useCallback(async () => {
    const r = await invoke<{ tree: Tree; book_word_count: number }>("tree");
    setTree(r.tree);
    onBookWc(r.book_word_count);
    if (!chapterId) {
      const first = r.tree[0]?.volumes[0]?.chapters[0]?.id;
      if (first) onChapterId(first);
    }
  }, [chapterId, onBookWc, onChapterId]);

  const loadChapter = useCallback(
    async (id: string, keepScene?: string | null) => {
      const c = await invoke<Chapter>("chapter.get", { id });
      setCh(c);
      setTitle(c.title);
      setSummary(c.summary);
      setChStatus(c.status);
      const next = (keepScene && c.scenes.find((s) => s.id === keepScene)?.id) || c.scenes[0]?.id || null;
      setSceneId(next);
      const sc = c.scenes.find((s) => s.id === next);
      setText(sc?.body || "");
      markDirty(false);
      if (typeof c.book_word_count === "number") onBookWc(c.book_word_count);
    },
    [onBookWc],
  );

  const reloadMeta = useCallback(async () => {
    if (!chapterId) return;
    const c = await invoke<Chapter>("chapter.get", { id: chapterId });
    setCh(c);
    if (typeof c.book_word_count === "number") onBookWc(c.book_word_count);
  }, [chapterId, onBookWc]);

  useEffect(() => {
    void loadTree();
    invoke<typeof bible>("bible").then(setBible).catch(() => undefined);
  }, [loadTree]);

  useEffect(() => {
    if (chapterId) void loadChapter(chapterId);
  }, [chapterId, loadChapter]);

  function schedulePersist(next: string) {
    markDirty(true);
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      const sid = sceneIdRef.current;
      if (!sid) return;
      void invoke("scene.save", { id: sid, body: next }).then(async () => {
        onStatus("草稿已自動儲存");
        if (chapterId) {
          const c = await invoke<Chapter>("chapter.get", { id: chapterId });
          setCh(c);
          if (typeof c.book_word_count === "number") onBookWc(c.book_word_count);
        }
      });
    }, 900);
  }

  async function flush() {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    const sid = sceneIdRef.current;
    if (!sid) return;
    await invoke("scene.save", { id: sid, body: textRef.current });
  }

  async function switchScene(id: string) {
    if (id === sceneId) return;
    await flush();
    const sc = ch?.scenes.find((s) => s.id === id);
    setSceneId(id);
    setText(sc?.body || "");
    markDirty(false);
    setCardView(false);
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  async function save() {
    if (!chapterId) return;
    try {
      onStatus("儲存中…");
      await invoke("chapter.update", { id: chapterId, title, summary, status });
      await flush();
      const r = await invoke<{
        sync?: { presence: number; events: number; beats: number; locations: number };
      }>("chapter.save", { id: chapterId });
      markDirty(false);
      await loadTree();
      await loadChapter(chapterId, sceneIdRef.current);
      const s = r.sync;
      const bits: string[] = [];
      if (s?.presence) bits.push(`在場人物 +${s.presence}`);
      if (s?.events) bits.push(`經歷 +${s.events}`);
      if (s?.beats) bits.push(`線索節點 +${s.beats}`);
      if (s?.locations) bits.push(`地點 +${s.locations}`);
      onStatus(bits.length ? `已儲存，並同步：${bits.join("、")}` : "已儲存");
    } catch (e) {
      onStatus(toastError(e));
    }
  }

  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        void saveRef.current();
      }
      if (e.ctrlKey && (e.key === "f" || e.key === "F") && !e.shiftKey) {
        e.preventDefault();
        setFindOpen(true);
        requestAnimationFrame(() => findRef.current?.focus());
      }
      if (e.key === "Escape") {
        setFindOpen(false);
        setSnapOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function addScene() {
    if (!chapterId) return;
    await flush();
    const id = await invoke<string>("scene.create", { chapter_id: chapterId, after_id: sceneId });
    await loadTree();
    await loadChapter(chapterId, id);
    onStatus("已新增場景");
  }

  async function removeScene(id: string) {
    if (!ch) return;
    if (ch.scenes.length <= 1) {
      if (!window.confirm("這是本章唯一的場景，刪除會清空正文。確定嗎？")) return;
    } else if (!window.confirm("刪除這個場景？正文會一併移除。")) return;
    await flush();
    const r = await invoke<{ next_id?: string }>("scene.delete", { id });
    await loadTree();
    await loadChapter(chapterId!, r.next_id || undefined);
    onStatus("已刪除場景");
  }

  async function openSnaps() {
    if (!chapterId) return;
    const list = await invoke<typeof snapshots>("snapshots.list", { chapter_id: chapterId });
    setSnapshots(list);
    setSnapOpen(true);
  }

  function exec(cmd: "undo" | "redo") {
    editorRef.current?.focus();
    document.execCommand(cmd);
  }

  function findNext() {
    const el = editorRef.current;
    if (!el || !findQ) return;
    const start = el.selectionEnd || 0;
    const lower = text.toLowerCase();
    const q = findQ.toLowerCase();
    let i = lower.indexOf(q, start);
    if (i < 0) i = lower.indexOf(q, 0);
    if (i < 0) {
      onStatus("找不到符合文字");
      return;
    }
    el.focus();
    el.setSelectionRange(i, i + findQ.length);
  }

  async function dropScene(onId: string) {
    if (!ch || !dragId || dragId === onId || !chapterId) return;
    const ids = ch.scenes.map((s) => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(onId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    await flush();
    await invoke("scene.reorder", { chapter_id: chapterId, ids });
    setDragId(null);
    await loadChapter(chapterId, sceneId);
    await loadTree();
  }

  async function goScene(delta: number) {
    if (!ch) return;
    const i = sceneIndex + delta;
    if (i < 0 || i >= ch.scenes.length) return;
    await switchScene(ch.scenes[i].id);
  }

  const showBinder = binderOpen && !focus;

  return (
    <div className={`write-page ${focus ? "is-focus" : ""} ${metaOpen && !focus ? "has-meta" : ""} ${showBinder ? "" : "no-binder"}`}>
      <aside className="binder">
        <div className="pane-h">
          <span>系列目錄</span>
          <IconBtn
            icon={Ico.plus({})}
            tip="新增一部"
            onClick={() =>
              invoke("part.create", { title: `第${tree.length + 1}部` }).then(() => loadTree())
            }
          />
        </div>
        <div className="part-switch">
          <button className={focusPart === "all" ? "on" : ""} onClick={() => setFocusPart("all")}>
            全部
          </button>
          {tree.map((p) => (
            <button key={p.id} className={focusPart === p.id ? "on" : ""} onClick={() => setFocusPart(p.id)} title={`${p.title}　${p.word_count} 字`}>
              {p.title}
              <em>{p.word_count}</em>
            </button>
          ))}
        </div>
        <div className="tree">
          {(focusPart === "all" ? tree : tree.filter((p) => p.id === focusPart)).map((p) => {
            const partOpen = openParts[p.id] !== false;
            return (
              <div key={p.id} className="part-block">
                <div className="part-row">
                  <button className="twist" onClick={() => setOpenParts((s) => ({ ...s, [p.id]: !partOpen }))}>
                    {partOpen ? "▾" : "▸"}
                  </button>
                  <span className="tree-ico">{Ico.book({})}</span>
                  <span
                    className="tree-name"
                    onDoubleClick={() => {
                      const t = window.prompt("部名", p.title);
                      if (t) void invoke("part.update", { id: p.id, title: t }).then(loadTree);
                    }}
                  >
                    {p.title}
                  </span>
                  <span className="wc">{p.word_count}</span>
                  <span className="tree-ops">
                    <IconBtn
                      icon={Ico.plus({})}
                      tip="在此部新增分卷"
                      onClick={() => invoke("volume.create", { part_id: p.id, title: "新分卷" }).then(() => loadTree())}
                    />
                    <IconBtn
                      icon={Ico.trash({})}
                      tip="刪除此部"
                      danger
                      onClick={() => {
                        if (!window.confirm("刪除此部及其下的卷、章？章節會進回收筒。")) return;
                        void invoke("part.delete", { id: p.id }).then(loadTree);
                      }}
                    />
                  </span>
                </div>
                {partOpen &&
                  p.volumes.map((v) => {
                    const volOpen = openVols[v.id] !== false;
                    return (
                      <div key={v.id} className="vol-block">
                        <div className="vol">
                          <button className="twist" onClick={() => setOpenVols((s) => ({ ...s, [v.id]: !volOpen }))}>
                            {volOpen ? "▾" : "▸"}
                          </button>
                          <span className="tree-ico">{Ico.folder({})}</span>
                          <span
                            className="tree-name"
                            onDoubleClick={() => {
                              const t = window.prompt("分卷名稱", v.title);
                              if (t) void invoke("volume.update", { id: v.id, title: t }).then(loadTree);
                            }}
                          >
                            {v.title}
                          </span>
                          <span className="tree-ops">
                            <IconBtn
                              icon={Ico.plus({})}
                              tip="新增章節"
                              onClick={() =>
                                invoke("chapter.create", { volume_id: v.id }).then((id) => {
                                  onChapterId(String(id));
                                  return loadTree();
                                })
                              }
                            />
                            <IconBtn
                              icon={Ico.trash({})}
                              tip="刪除此分卷"
                              danger
                              onClick={() => {
                                if (!window.confirm("刪除此分卷及其章節？")) return;
                                void invoke("volume.delete", { id: v.id }).then(loadTree);
                              }}
                            />
                          </span>
                        </div>
                        {volOpen &&
                          v.chapters.map((c) => (
                            <div
                              key={c.id}
                              className={`ch ${c.id === chapterId ? "on" : ""}`}
                              onClick={() => onChapterId(c.id)}
                            >
                              <span className="tree-ico">{Ico.file({})}</span>
                              <span className="tree-name">
                                {c.title}
                                <span className="muted"> {c.scenes.length}場</span>
                              </span>
                              <span className="wc">{c.word_count}</span>
                            </div>
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </aside>

      <section className="write-main">
        {ch && (
          <>
            <div className="float-bar" role="toolbar" aria-label="寫作工具">
              <IconBtn icon={Ico.panel({})} tip={binderOpen ? "隱藏目錄" : "顯示目錄"} active={showBinder} onClick={() => setBinderOpen((v) => !v)} />
              <span className="bar-div" />
              <IconBtn icon={Ico.undo({})} tip="復原" onClick={() => exec("undo")} />
              <IconBtn icon={Ico.redo({})} tip="重做" onClick={() => exec("redo")} />
              <IconBtn icon={Ico.search({})} tip="尋找 Ctrl+F" active={findOpen} onClick={() => { setFindOpen((v) => !v); requestAnimationFrame(() => findRef.current?.focus()); }} />
              <span className="bar-div" />
              <IconBtn icon={Ico.chevronL({})} tip="上一個場景" disabled={sceneIndex <= 0} onClick={() => void goScene(-1)} />
              <IconBtn icon={Ico.chevronR({})} tip="下一個場景" disabled={!ch || sceneIndex >= ch.scenes.length - 1} onClick={() => void goScene(1)} />
              <IconBtn icon={Ico.plus({})} tip="新增場景" onClick={() => void addScene()} />
              <IconBtn icon={Ico.trash({})} tip="刪除這個場景" danger onClick={() => scene && void removeScene(scene.id)} />
              <span className="bar-div" />
              <IconBtn icon={Ico.cards({})} tip="卡片總覽" active={cardView} onClick={() => setCardView((v) => !v)} />
              <IconBtn icon={Ico.inspector({})} tip="場景資料" active={metaOpen} onClick={() => setMetaOpen((v) => !v)} />
              <IconBtn icon={Ico.history({})} tip="版本紀錄" active={snapOpen} onClick={() => void openSnaps()} />
              <IconBtn icon={Ico.export({})} tip="匯出本章 Markdown" onClick={() => chapterId && invoke("chapter.export", { id: chapterId })} />
              <span className="bar-grow" />
              <IconBtn icon={Ico.zoomOut({})} tip="縮小字級" onClick={() => setZoom((z) => Math.max(15, z - 1))} />
              <IconBtn icon={Ico.zoomIn({})} tip="放大字級" onClick={() => setZoom((z) => Math.min(26, z + 1))} />
              <select
                className="status-select"
                value={status}
                onChange={(e) => {
                  setChStatus(e.target.value);
                  markDirty(true);
                }}
                title="章狀態"
              >
                <option value="draft">草稿</option>
                <option value="final">定稿</option>
              </select>
              <IconBtn icon={Ico.save({})} tip="儲存 Ctrl+S" label="儲存" onClick={() => void save()} />
            </div>

            {findOpen && (
              <div className="find-bar">
                <span className="tree-ico">{Ico.search({})}</span>
                <input
                  ref={findRef}
                  value={findQ}
                  placeholder="在這個場景裡尋找…"
                  onChange={(e) => setFindQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") findNext();
                  }}
                />
                <IconBtn icon={Ico.chevronR({})} tip="下一個" onClick={findNext} />
                <IconBtn icon={Ico.close({})} tip="關閉" onClick={() => setFindOpen(false)} />
              </div>
            )}

            <div className="write-head">
              <div className="crumb">
                {(() => {
                  for (const p of tree) {
                    for (const v of p.volumes) {
                      if (v.chapters.some((c) => c.id === chapterId)) {
                        return (
                          <>
                            {p.title}
                            <span>／</span>
                            {v.title}
                          </>
                        );
                      }
                    }
                  }
                  return null;
                })()}
              </div>
              <input
                className="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty(true);
                }}
              />
            </div>

            <div className="scene-tabs" role="tablist">
              {ch.scenes.map((s, i) => (
                <button
                  key={s.id}
                  role="tab"
                  draggable
                  aria-selected={s.id === sceneId}
                  className={`scene-tab ${s.id === sceneId ? "on" : ""} ${dragId === s.id ? "dragging" : ""}`}
                  onClick={() => void switchScene(s.id)}
                  onDragStart={() => setDragId(s.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => void dropScene(s.id)}
                  onDragEnd={() => setDragId(null)}
                >
                  <span className="tab-ico">{Ico.file({})}</span>
                  <span className="tab-title">{s.title || `場景 ${i + 1}`}</span>
                  <span className="tab-wc">{s.id === sceneId ? wordCount(text) : s.word_count}</span>
                  <span
                    className="tab-x"
                    title="刪除場景"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeScene(s.id);
                    }}
                  >
                    {Ico.close({})}
                  </span>
                </button>
              ))}
              <IconBtn icon={Ico.plus({})} tip="在此後新增場景" onClick={() => void addScene()} />
            </div>

            {cardView ? (
              <div className="card-board">
                {ch.scenes.map((s, i) => (
                  <button
                    key={s.id}
                    className={`index-card ${s.id === sceneId ? "on" : ""}`}
                    draggable
                    onClick={() => void switchScene(s.id)}
                    onDragStart={() => setDragId(s.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => void dropScene(s.id)}
                    onDragEnd={() => setDragId(null)}
                  >
                    <div className="index-card-top">
                      <b>{s.title || `場景 ${i + 1}`}</b>
                      <span>{s.word_count} 字</span>
                    </div>
                    <p>{s.summary || (s.body || "").slice(0, 80) || "（尚無概要）"}</p>
                    <div className="index-card-meta">
                      {bible.time_points.find((t) => t.id === s.time_point_id)?.label || "尚未設定時間"}
                      {" · "}
                      {bible.locations.find((t) => t.id === s.location_id)?.name || "尚未設定地點"}
                    </div>
                  </button>
                ))}
                <button className="index-card add" onClick={() => void addScene()}>
                  {Ico.plus({})}
                  <span>新增場景</span>
                </button>
              </div>
            ) : (
              <div className="write-canvas">
                <div className="write-sheet">
                  <textarea
                    ref={editorRef}
                    className="scene-text solo"
                    style={{ fontSize: zoom }}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      schedulePersist(e.target.value);
                    }}
                    spellCheck={false}
                    placeholder="從這裡開始寫這個場景……"
                  />
                </div>
              </div>
            )}

            <div className="write-foot">
              <span>
                第 {sceneIndex + 1}/{ch.scenes.length} 個場景 · 本段 {wordCount(text)} 字 · 本章 {chapterWc} 字
                {dirty ? " · 尚未儲存" : ""}
              </span>
              {scene?.time_point_id && (
                <span className="foot-chip">{Ico.clock({})} {bible.time_points.find((t) => t.id === scene.time_point_id)?.label}</span>
              )}
              {scene?.location_id && (
                <span className="foot-chip">{Ico.pin({})} {bible.locations.find((t) => t.id === scene.location_id)?.name}</span>
              )}
            </div>
          </>
        )}
      </section>

      {metaOpen && scene && ch && (
        <aside className="inspector">
          <div className="pane-h">
            <span>這個場景</span>
            <IconBtn icon={Ico.close({})} tip="關閉場景資料" onClick={() => setMetaOpen(false)} />
          </div>
          <div className="ctx">
            <h3>場景標題</h3>
            <input
              defaultValue={scene.title}
              key={`t-${scene.id}`}
              onBlur={(e) => {
                void invoke("scene.update", { id: scene.id, title: e.target.value }).then(() => reloadMeta());
              }}
            />
            <h3>場景概要</h3>
            <textarea
              rows={3}
              defaultValue={scene.summary}
              key={`s-${scene.id}`}
              onBlur={(e) => {
                void invoke("scene.update", { id: scene.id, summary: e.target.value }).then(() => reloadMeta());
              }}
            />
            <h3>時間</h3>
            <select
              value={scene.time_point_id ?? ""}
              onChange={(e) =>
                invoke("scene.update", { id: scene.id, time_point_id: e.target.value || null }).then(() => reloadMeta())
              }
            >
              <option value="">尚未設定</option>
              {bible.time_points.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <h3>地點</h3>
            <select
              value={scene.location_id ?? ""}
              onChange={(e) =>
                invoke("scene.update", { id: scene.id, location_id: e.target.value || null }).then(() => reloadMeta())
              }
            >
              <option value="">尚未設定</option>
              {bible.locations.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <h3>視角</h3>
            <select
              value={scene.pov_character_id ?? ""}
              onChange={(e) =>
                invoke("scene.update", { id: scene.id, pov_character_id: e.target.value || null }).then(() => reloadMeta())
              }
            >
              <option value="">尚未指定</option>
              {bible.characters.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <h3>在場人物</h3>
            <div>
              {bible.characters.map((c) => {
                const on = scene.presence.includes(c.id);
                return (
                  <button
                    key={c.id}
                    className={`chip ${on ? "on" : ""}`}
                    onClick={() => {
                      const presence = on ? scene.presence.filter((x) => x !== c.id) : [...scene.presence, c.id];
                      void invoke("scene.update", { id: scene.id, presence }).then(() => reloadMeta());
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <h3>線索</h3>
            <div>
              {bible.threads.map((t) => {
                const on = scene.threads.some((x) => x.thread_id === t.id);
                return (
                  <button
                    key={t.id}
                    className={`chip ${on ? "on" : ""}`}
                    onClick={() => {
                      const threads = on
                        ? scene.threads.filter((x) => x.thread_id !== t.id)
                        : [...scene.threads, { thread_id: t.id, beat_id: null }];
                      void invoke("scene.update", { id: scene.id, threads }).then(() => reloadMeta());
                    }}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
            <h3>本章概要</h3>
            <textarea rows={4} value={summary} onChange={(e) => { setSummary(e.target.value); markDirty(true); }} />
            <h3>其他操作</h3>
            <IconBtn
              icon={Ico.trash({})}
              label="將此章節移入回收筒"
              danger
              onClick={() => {
                if (!chapterId) return;
                if (!window.confirm("要將此章節移入回收筒嗎？")) return;
                void invoke("chapter.delete", { id: chapterId }).then(() => {
                  onChapterId("");
                  return loadTree();
                });
              }}
            />
          </div>
        </aside>
      )}

      {snapOpen && (
        <div className="review">
          <h2>
            版本紀錄
            <IconBtn icon={Ico.close({})} tip="關閉" onClick={() => setSnapOpen(false)} />
          </h2>
          <div className="list-body">
            {snapshots.map((s) => (
              <div className="issue" key={s.id}>
                <div className="muted">
                  {new Date(s.created_at).toLocaleString()} · {s.trigger} · {wordCount(s.body)} 字
                </div>
                <pre style={{ whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>{s.body.slice(0, 400)}</pre>
                <IconBtn
                  icon={Ico.restore({})}
                  label="還原成此版本"
                  onClick={async () => {
                    await invoke("snapshots.restore", { id: s.id });
                    if (chapterId) await loadChapter(chapterId);
                    setSnapOpen(false);
                    onStatus("已還原成此版本");
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
