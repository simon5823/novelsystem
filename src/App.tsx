import { useEffect, useState } from "react";
import { invoke, toastError } from "./api";
import { Welcome } from "./Welcome";
import { Workspace } from "./Workspace";
import type { RecentProject } from "../shared/types";

export function App() {
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [open, setOpen] = useState<{ path: string; name: string } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    invoke<RecentProject[]>("recent").then(setRecent).catch((e) => setErr(toastError(e)));
  }, []);

  async function afterOpen(r: { path: string; name: string; recent: RecentProject[] }) {
    setRecent(r.recent);
    setOpen({ path: r.path, name: r.name });
    setErr("");
  }

  if (!open) {
    return (
      <Welcome
        recent={recent}
        error={err}
        onError={setErr}
        onOpened={afterOpen}
      />
    );
  }

  return (
    <Workspace
      name={open.name}
      onClose={async () => {
        await invoke("project.close");
        setOpen(null);
        setRecent(await invoke("recent"));
      }}
    />
  );
}
