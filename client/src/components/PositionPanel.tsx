import { useEffect, useRef } from "react";
import type { Chunk } from "../types/book";

interface PositionPanelProps {
  chunks: Chunk[];
  sections: string[];
  position: number;
  onPositionChange: (idx: number) => void;
}

export default function PositionPanel({
  chunks,
  sections,
  position,
  onPositionChange,
}: PositionPanelProps) {
  const currentRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      const cur = currentRef.current;
      const container = containerRef.current;
      if (cur && container) {
        const offset =
          cur.offsetTop -
          container.offsetTop -
          container.clientHeight / 2 +
          cur.clientHeight / 2;
        container.scrollTop = Math.max(0, offset);
      }
    });
  }, [position]);

  return (
    <div ref={containerRef} style={{ height: "100%", overflowY: "auto" }}>
      <div className="section-head" style={{ borderBottom: "1px solid #E0E0EC", paddingBottom: 12 }}>
        <div className="section-title">Find Your Place</div>
        <div className="section-subtitle">
          Tap scenes you've read. Stop at the last one you finished.
        </div>
      </div>
      <div className="scene-list">
        {chunks.map((chunk, i) => {
          const isRead = i <= position;
          const isCurrent = i === position;
          const isNext = i === position + 1;
          const isFuture = i > position + 1;
          const partChanged = i === 0 || chunk.part !== chunks[i - 1].part;

          return (
            <div key={chunk.id}>
              {partChanged && (
                <div className={`part-label ${isRead || isNext ? "unlocked" : "locked"}`}>
                  {sections[chunk.part]}
                </div>
              )}
              <button
                ref={isCurrent ? currentRef : undefined}
                className={`scene-card ${isCurrent ? "current" : isFuture ? "future" : isNext ? "next-up" : ""}`}
                disabled={isFuture}
                onClick={() => !isFuture && onPositionChange(i)}
              >
                <div className="scene-card-head">
                  <div className={`check-circle ${isRead ? "read" : ""}`}>
                    {isRead ? "\u2713" : ""}
                  </div>
                  <span className="scene-card-title">{chunk.title}</span>
                </div>
                {(isRead || isNext) && (
                  <div className="scene-card-micro">{chunk.micro}</div>
                )}
                {isFuture && (
                  <div className="scene-card-locked">Keep reading to unlock\u2026</div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
