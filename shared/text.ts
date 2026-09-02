export type WordCountMode = "no_space" | "han_only" | "all";

const SCENE_BREAK = /(?:^|\r?\n)\s*---\s*(?:\r?\n|$)/;

export function splitScenes(body: string): string[] {
  const parts = body.split(SCENE_BREAK);
  if (parts.length === 0) return [""];
  return parts;
}

export function joinScenes(parts: string[]): string {
  return parts.join("\n\n---\n\n");
}

export function wordCount(text: string, mode: WordCountMode = "no_space"): number {
  if (mode === "all") return [...text].length;
  const noSpace = text.replace(/\s+/g, "");
  if (mode === "no_space") return [...noSpace].length;
  let n = 0;
  for (const ch of noSpace) {
    if (/\p{Script=Han}/u.test(ch)) n += 1;
  }
  return n;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function id(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function payloadHash(payload: unknown): string {
  const s = JSON.stringify(payload);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}
