import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("novel", {
  invoke: (cmd: string, args?: unknown) => ipcRenderer.invoke("novel", cmd, args) as Promise<unknown>,
});
