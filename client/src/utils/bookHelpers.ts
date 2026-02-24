import type { Chunk, Description } from "../types/book";

export function ci(chunks: Chunk[], id: string): number {
  return chunks.findIndex((c) => c.id === id);
}

export function unlocked(chunks: Chunk[], introId: string, position: number): boolean {
  return ci(chunks, introId) <= position;
}

export function getDesc(
  descs: Description[] | undefined,
  chunks: Chunk[],
  position: number
): string {
  if (!descs || descs.length === 0) return "";
  let result = descs[0];
  for (const d of descs) {
    if (ci(chunks, d.from) <= position) result = d;
  }
  return result.desc;
}

export function countAppearances(
  chunks: Chunk[],
  field: "chars" | "locs",
  id: string,
  position: number
): number {
  return chunks.filter((c, i) => i <= position && c[field].includes(id)).length;
}
