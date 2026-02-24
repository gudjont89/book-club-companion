import type { Chunk } from "../types/book";

interface HeaderProps {
  title: string;
  author: string;
  chunks: Chunk[];
  position: number;
}

export default function Header({ title, author, chunks, position }: HeaderProps) {
  const pct = chunks[position]?.pct ?? 0;

  return (
    <div className="header">
      <div className="header-title">{title}</div>
      <div className="header-author">{author}</div>
      <div className="progress-row">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-pct">{pct}%</span>
      </div>
    </div>
  );
}
