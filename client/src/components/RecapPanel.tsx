import type { Chunk } from "../types/book";

interface RecapPanelProps {
  chunks: Chunk[];
  sections: string[];
  position: number;
}

export default function RecapPanel({ chunks, sections, position }: RecapPanelProps) {
  const read = chunks.filter((_, i) => i <= position);

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Story So Far</div>
        <div className="section-subtitle">
          {position + 1} of {chunks.length} scenes read &mdash; {chunks[position].pct}% through
        </div>
      </div>
      <div className="recap-timeline">
        <div className="timeline-line" />
        {read.map((chunk, i) => {
          const partChanged = i === 0 || chunk.part !== chunks[i > 0 ? i - 1 : 0].part;
          return (
            <div key={chunk.id}>
              {partChanged && (
                <div className="recap-part-label">{sections[chunk.part]}</div>
              )}
              <div className="recap-item">
                <div className={`recap-dot ${i === position ? "current" : ""}`} />
                <div className="recap-ch-title">{chunk.title}</div>
                <div className="recap-micro">{chunk.micro}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
