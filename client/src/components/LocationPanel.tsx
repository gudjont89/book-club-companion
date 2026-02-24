import { useState } from "react";
import type { Chunk, LocMeta, Description } from "../types/book";
import { unlocked, getDesc, countAppearances } from "../utils/bookHelpers";

interface LocationPanelProps {
  chunks: Chunk[];
  position: number;
  meta: Record<string, LocMeta>;
  descriptions: Record<string, Description[]>;
}

export default function LocationPanel({
  chunks,
  position,
  meta,
  descriptions,
}: LocationPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const currentLocs = chunks[position]?.locs ?? [];

  const entries = Object.entries(meta)
    .filter(([, l]) => unlocked(chunks, l.intro, position))
    .sort((a, b) => {
      const aIn = currentLocs.includes(a[0]) ? 1 : 0;
      const bIn = currentLocs.includes(b[0]) ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;
      return (
        countAppearances(chunks, "locs", b[0], position) -
        countAppearances(chunks, "locs", a[0], position)
      );
    });

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Locations</div>
        <div className="section-subtitle">
          {entries.length} location{entries.length !== 1 ? "s" : ""} visited so far
        </div>
      </div>
      <div className="tracker-list">
        {entries.map(([id, loc]) => {
          const isOpen = openId === id;
          const inScene = currentLocs.includes(id);
          const count = countAppearances(chunks, "locs", id, position);
          const desc = getDesc(descriptions[id], chunks, position);
          const appearances = chunks.filter(
            (c, i) => i <= position && c.locs.includes(id)
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
                  <div className="card-name">{loc.name}</div>
                  <div className="card-role">{loc.type}</div>
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
