import { useState } from "react";
import { useParams } from "react-router-dom";
import { useBookData } from "../hooks/useBookData";
import Header from "../components/Header";
import TabBar, { type Tab } from "../components/TabBar";
import PositionPanel from "../components/PositionPanel";
import CharacterPanel from "../components/CharacterPanel";
import LocationPanel from "../components/LocationPanel";
import RecapPanel from "../components/RecapPanel";

export default function BookPage() {
  const { slug } = useParams<{ slug: string }>();
  const { book, loading, error } = useBookData(slug);
  const [position, setPosition] = useState(0);
  const [currentTab, setCurrentTab] = useState<Tab>("position");

  if (loading) return <div className="loading">Loading...</div>;
  if (error || !book) return <div className="error">{error ?? "Book not found"}</div>;

  const themeVars = {
    "--color-header-bg": book.theme.headerBg,
    "--color-header-gradient-end": book.theme.headerGradientEnd,
    "--color-accent": book.theme.accent,
    "--color-accent-light": book.theme.accentLight,
    "--color-text": book.theme.text,
    "--color-text-secondary": book.theme.textSecondary,
    "--color-card-bg": book.theme.cardBg,
    "--color-card-border": book.theme.cardBorder,
    "--color-background": book.theme.background,
    "--color-tab-inactive": book.theme.tabInactive,
  } as React.CSSProperties;

  return (
    <div className="app-shell" style={themeVars}>
      <Header
        title={book.title}
        author={book.author}
        chunks={book.chunks}
        position={position}
      />
      <div className="content">
        {currentTab === "position" && (
          <PositionPanel
            chunks={book.chunks}
            sections={book.sections}
            position={position}
            onPositionChange={setPosition}
          />
        )}
        {currentTab === "characters" && (
          <CharacterPanel
            chunks={book.chunks}
            position={position}
            meta={book.characters.meta}
            descriptions={book.characters.descriptions}
          />
        )}
        {currentTab === "locations" && (
          <LocationPanel
            chunks={book.chunks}
            position={position}
            meta={book.locations.meta}
            descriptions={book.locations.descriptions}
          />
        )}
        {currentTab === "recap" && (
          <RecapPanel
            chunks={book.chunks}
            sections={book.sections}
            position={position}
          />
        )}
      </div>
      <TabBar currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
}
