import { useState } from "react";
import type { Chunk, CharMeta, Description } from "../types/book";
import { unlocked, getDesc, countAppearances } from "../utils/bookHelpers";

interface CharacterPanelProps {
  chunks: Chunk[];
  position: number;
  meta: Record<string, CharMeta>;
  descriptions: Record<string, Description[]>;
}

export default function CharacterPanel({
  chunks,
  position,
  meta,
  descriptions,
}: CharacterPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const currentChars = chunks[position]?.chars ?? [];

  const entries = Object.entries(meta)
    .filter(([, c]) => unlocked(chunks, c.intro, position))
    .sort((a, b) => {
      const aIn = currentChars.includes(a[0]) ? 1 : 0;
      const bIn = currentChars.includes(b[0]) ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;
      return (
        countAppearances(chunks, "chars", b[0], position) -
        countAppearances(chunks, "chars", a[0], position)
      );
    });

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Characters</div>
        <div className="section-subtitle">
          {entries.length} character{entries.length !== 1 ? "s" : ""} met so far
        </div>
      </div>
      <div className="tracker-list">
        {entries.map(([id, char]) => {
          const isOpen = openId === id;
          const inScene = currentChars.includes(id);
          const count = countAppearances(chunks, "chars", id, position);
          const desc = getDesc(descriptions[id], chunks, position);
          const appearances = chunks.filter(
            (c, i) => i <= position && c.chars.includes(id)
          );
          const lastSeen = appearances.length
            ? appearances[appearances.length - 1]
            : null;

          return (
            <div key={id}>
              <button
                className={`tracker-card ${isOpen ? "open" : ""}`}
                onClick={() => setOpenId(isOpen ? null : id)}
              >
                <div className={`count-bubble ${inScene ? "active" : "inactive"}`}>
                  {count}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                    <span className="card-name">{char.short}</span>
                    {char.badge === "spirit" && (
                      <span className="badge badge-spirit">spirit</span>
                    )}
                    {char.badge === "vision" && (
                      <span className="badge badge-vision">vision</span>
                    )}
                  </div>
                  <div className="card-role">{char.role}</div>
                </div>
                <span className="chevron">&rsaquo;</span>
              </button>
              <div className={`card-detail ${isOpen ? "open" : ""}`}>
                {desc && <p>{desc}</p>}
                {lastSeen && (
                  <div className="meta">
                    <strong>Last seen:</strong> {lastSeen.title}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
