type Tab = "position" | "characters" | "locations" | "recap";

interface TabBarProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "position", icon: "\u{1F4D6}", label: "Position" },
  { id: "characters", icon: "\u{1F464}", label: "Characters" },
  { id: "locations", icon: "\u{1F5FA}\uFE0F", label: "Locations" },
  { id: "recap", icon: "\u{1F4DC}", label: "Recap" },
];

export default function TabBar({ currentTab, onTabChange }: TabBarProps) {
  return (
    <div className="tab-bar">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab-btn ${t.id === currentTab ? "active" : "inactive"}`}
          onClick={() => onTabChange(t.id)}
        >
          <span className="tab-icon">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export type { Tab };
