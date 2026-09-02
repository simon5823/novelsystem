import { useState } from "react";
import { invoke } from "./api";
import { Ico, IconBtn } from "./ui";

export function SearchView({ onOpenChapter }: { onOpenChapter: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{
    chapters: { id: string; title: string; kind: string; part_title?: string; volume_title?: string }[];
    characters: { id: string; title: string; kind: string }[];
    locations: { id: string; title: string; kind: string }[];
    threads: { id: string; title: string; kind: string }[];
    terms: { id: string; title: string; kind: string }[];
  } | null>(null);

  async function go() {
    if (!q.trim()) return;
    setRes(await invoke("search", { q }));
  }

  const groups = res
    ? [
        ["章節", res.chapters],
        ["人物", res.characters],
        ["地點", res.locations],
        ["線索", res.threads],
        ["詞", res.terms],
      ] as const
    : [];

  return (
    <div className="page">
      <div className="page-head">
        <span className="tree-ico">{Ico.search({})}</span>
        <h1>系列搜尋</h1>
      </div>
      <div className="search-box">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void go()}
          placeholder="搜尋正文、概要、人物、地點、線索、詞彙"
        />
        <IconBtn icon={Ico.search({})} label="搜" onClick={() => void go()} />
      </div>
      {res?.chapters.length ? (
        <div>
          {res.chapters.map((it) => (
            <div className="hit" key={it.id}>
              <span className="kind">章節</span>
              <button className="btn small light" onClick={() => onOpenChapter(it.id)}>
                {[it.part_title, it.volume_title, it.title].filter(Boolean).join("／")}
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {groups.map(([lab, items]) =>
        lab !== "章節" && items.length ? (
          <div key={lab}>
            {items.map((it) => (
              <div className="hit" key={it.id}>
                <span className="kind">{lab}</span>
                {it.title}
              </div>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}
