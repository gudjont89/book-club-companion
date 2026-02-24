export interface Chunk {
  id: string;
  stave: number | string;
  part: number;
  title: string;
  micro: string;
  chars: string[];
  locs: string[];
  pct: number;
}

export interface CharMeta {
  name: string;
  short: string;
  role: string;
  intro: string;
  color: string;
  badge?: "spirit" | "vision" | string;
}

export interface LocMeta {
  name: string;
  icon: string;
  intro: string;
  type: string;
}

export interface Description {
  from: string;
  desc: string;
}

export interface Theme {
  headerBg: string;
  headerGradientEnd: string;
  accent: string;
  accentLight: string;
  text: string;
  textSecondary: string;
  cardBg: string;
  cardBorder: string;
  background: string;
  tabInactive: string;
}

export interface BookMeta {
  slug: string;
  title: string;
  author: string;
  sections: string[];
  theme: Theme;
}

export interface BookData extends BookMeta {
  chunks: Chunk[];
  characters: {
    meta: Record<string, CharMeta>;
    descriptions: Record<string, Description[]>;
  };
  locations: {
    meta: Record<string, LocMeta>;
    descriptions: Record<string, Description[]>;
  };
}
