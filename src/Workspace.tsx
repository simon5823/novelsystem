import { useCallback, useEffect, useState } from "react";
import { invoke } from "./api";
import { WriteView } from "./WriteView";
import { TimelineView } from "./TimelineView";
import { CharactersView } from "./CharactersView";
import { WorldView } from "./WorldView";
import { ThreadsView } from "./ThreadsView";
import { GlossaryView } from "./GlossaryView";
import { SearchView } from "./SearchView";
import { SettingsView } from "./SettingsView";
import { Ico, IconBtn } from "./ui";
import type { ViewId } from "../shared/types";

const NAV: { id: ViewId; label: string; tip: string; icon: typeof Ico.pen }[] = [
  { id: "write", label: "寫作", tip: "正文與場景", icon: Ico.pen },
  { id: "timeline", label: "時間", tip: "全書時間軸", icon: Ico.clock },
  { id: "characters", label: "人物", tip: "人物設定與關係圖", icon: Ico.person },
  { id: "world", label: "世界", tip: "勢力、地點、禮儀、規則", icon: Ico.globe },
  { id: "threads", label: "線索", tip: "主線、暗線、伏筆", icon: Ico.branch },
  { id: "glossary", label: "詞彙", tip: "詞目與稱呼", icon: Ico.book },
  { id: "search", label: "搜尋", tip: "搜尋整個系列", icon: Ico.search },
  { id: "settings", label: "設定", tip: "字數規則、備份、回收筒", icon: Ico.gear },
];

export function Workspace({ name, onClose }: { name: string; onClose: () => void }) {
  const [view, setView] = useState<ViewId>("write");
  const [focus, setFocus] = useState(false);
  const [status, setStatus] = useState("就緒");
  const [bookWc, setBookWc] = useState(0);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const refreshTreeMeta = useCallback(async () => {
    const r = await invoke<{ book_word_count: number }>("tree");
    setBookWc(r.book_word_count);
  }, []);

  useEffect(() => {
    void refreshTreeMeta();
  }, [refreshTreeMeta, view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "F" || e.key === "f")) {
        e.preventDefault();
        setFocus((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`workspace ${focus ? "is-focus" : ""}`}>
      <aside className="rail" aria-label="模組">
        <div className="rail-brand" title="墨卷">
          卷
        </div>
        <nav className="rail-nav">
          {NAV.map((n) => (
            <IconBtn
              key={n.id}
              icon={n.icon({})}
              tip={n.tip}
              label={n.label}
              active={view === n.id}
              onClick={() => {
                setView(n.id);
                setFocus(false);
              }}
            />
          ))}
        </nav>
        <div className="rail-foot">
          <IconBtn icon={Ico.focus({})} tip="專注模式 Ctrl+Shift+F" active={focus} onClick={() => setFocus((v) => !v)} />
          <IconBtn icon={Ico.close({})} tip="關閉作品" onClick={onClose} />
        </div>
      </aside>
      <div className="workspace-main">
        <div className={`body ${view === "write" ? "write" : "page"}`}>
          {view === "write" && (
            <WriteView
              focus={focus}
              chapterId={chapterId}
              onChapterId={setChapterId}
              onStatus={setStatus}
              onBookWc={setBookWc}
              onDirty={setDirty}
            />
          )}
          {view === "timeline" && (
            <TimelineView
              onOpenChapter={(id) => {
                setChapterId(id);
                setView("write");
              }}
            />
          )}
          {view === "characters" && <CharactersView />}
          {view === "world" && <WorldView />}
          {view === "threads" && <ThreadsView />}
          {view === "glossary" && <GlossaryView />}
          {view === "search" && (
            <SearchView
              onOpenChapter={(id) => {
                setChapterId(id);
                setView("write");
              }}
            />
          )}
          {view === "settings" && <SettingsView bookName={name} />}
        </div>
        <footer className="status">
          <span className={`save-dot ${dirty ? "dirty" : "ok"}`} title={dirty ? "尚有未儲存的變更" : "已自動儲存"} />
          <span>
            《<b>{name}</b>》
          </span>
          <span>
            系列 <b>{bookWc}</b> 字
          </span>
          <span className={dirty ? "warn" : "ok"}>{status}</span>
        </footer>
      </div>
    </div>
  );
}
