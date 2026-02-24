import { Link } from "react-router-dom";
import { useBookList } from "../hooks/useBookData";
import type { BookMeta } from "../types/book";

function BookCard({ book }: { book: BookMeta }) {
  return (
    <Link to={`/books/${book.slug}`} className="book-card">
      <div className="book-card-accent" style={{ background: book.theme.accent }} />
      <div className="book-card-body">
        <div className="book-card-title">{book.title}</div>
        <div className="book-card-author">{book.author}</div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { books, loading, error } = useBookList();

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="home-page">
      <div className="home-header">
        <h1 className="home-title">Book Club Companion</h1>
        <p className="home-subtitle">Spoiler-free reading companions</p>
      </div>
      <div className="book-grid">
        {books.map((book) => (
          <BookCard key={book.slug} book={book} />
        ))}
      </div>
    </div>
  );
}
