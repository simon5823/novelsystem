export async function invoke<T>(cmd: string, args?: unknown): Promise<T> {
  const r = (await window.novel.invoke(cmd, args)) as T | { __error: string };
  if (r && typeof r === "object" && "__error" in (r as object)) {
    throw new Error((r as { __error: string }).__error);
  }
  return r as T;
}

export function toastError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
