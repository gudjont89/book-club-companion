# Book Club Companion — App Structure Guide

## Overview

The Book Club Companion is a spoiler-free reading tracker for novels. It's a single-page app (one HTML file per book) that lets a reader set their current position in the story and then browse characters, locations, and a recap — all filtered so nothing beyond their position is revealed.

The app is entirely static. No server, no API, no database. All book data is embedded as JavaScript objects in the HTML file. The only interactive state is the reader's current position (an integer index into the chunks array).

See `christmas_carol_companion_v3.html` for a working example.

---

## Architecture

### One File Per Book

Each book is a self-contained `.html` file containing:

1. **CSS** — all styles inline in a `<style>` block
2. **HTML** — a fixed shell (header, content area, tab bar)
3. **JavaScript** — book data as constants, plus rendering functions

There is no build step. Open the file in a browser and it works.

### The Data Model

Six JavaScript constants hold all book data:

```
CHUNKS          — array of scene objects (the spine of the app)
CHAR_META       — character metadata keyed by ID
CHAR_DESCS      — position-aware character descriptions keyed by ID
LOC_META        — location metadata keyed by ID
LOC_DESCS       — position-aware location descriptions keyed by ID
STAVES / PARTS  — section labels (book-specific naming)
```

### The Single Piece of State

```javascript
let position = 0;  // index into CHUNKS array
```

Everything in the app derives from this one number. When the reader taps a scene card, `position` updates and the active tab re-renders. Characters, locations, descriptions, and the recap all filter against `position`.

---

## Data Structures

### CHUNKS (array)

The ordered sequence of scenes in the book. Each chunk is one scene or chapter subdivision.

```javascript
{
  id: "S1-01",           // unique ID: section-number
  stave: 1,              // chapter/stave/part number (display only)
  part: 0,               // index into the STAVES/PARTS label array
  title: "Scene Title",  // human-readable scene title
  micro: "One-paragraph summary of what happens in this scene.",
  chars: ["SCROOGE", "BOB"],  // character IDs present in this scene
  locs: ["COUNTING"],         // location IDs present in this scene
  pct: 0                      // percentage through the book (0–100)
}
```

**Key design decisions:**

- `chars` and `locs` use short string IDs (not full names) that match the keys in `CHAR_META` and `LOC_META`.
- `micro` is the text shown in the position finder and recap. It should be one paragraph, written in present tense, specific enough for a reader to recognise the scene.
- `pct` drives the progress bar. Set the first chunk to 0 and the last to something like 96 (not 100, since the reader hasn't finished until after the last chunk).
- `part` groups chunks under section headers. The position finder renders a part label whenever `part` changes between adjacent chunks.

### CHAR_META (object)

Static metadata for each character, keyed by ID.

```javascript
{
  SCROOGE: {
    name: "Ebenezer Scrooge",   // full canonical name
    short: "Scrooge",           // display name (used in lists)
    role: "Protagonist",        // one-line role label
    intro: "S1-01",             // chunk ID where first introduced
    color: "#3D405B",           // accent colour (used for active bubbles)
    badge: "spirit"             // optional: "spirit", "vision", or omit
  }
}
```

**Notes:**

- `role` should describe the character in a way that makes sense from their first appearance onward. Don't say "recurring" or hint at future appearances.
- `badge` is optional and book-specific. Christmas Carol uses "spirit" (for the three ghosts) and "vision" (for characters seen only in past/future visions). Other books might use "deceased", "flashback", or nothing at all.
- `color` is currently only used if you keep avatar-style display. The current v3 design uses count bubbles instead, but the colour is still used for the active-state bubble fill.

### CHAR_DESCS (object)

Position-aware descriptions keyed by character ID. Each entry is an array of `{from, desc}` objects ordered by position.

```javascript
{
  SCROOGE: [
    { from: "S1-01", desc: "An old miser. Cold, solitary, universally disliked." },
    { from: "S2-06", desc: "An old miser who was once a lonely boy, then a happy apprentice, then a young man who lost love to greed." },
    { from: "S5-02", desc: "Once a cold miser, now transformed. Was a lonely boy, a happy apprentice, lost love — and chose differently." }
  ]
}
```

**Critical principle: these are cumulative knowledge, not play-by-play.** Each description should reflect what the reader has *learned* about the character up to that point — their identity, backstory, and significance — not what the character is currently doing. Think of it as a reference card that builds over time.

The rendering function picks the latest `desc` whose `from` chunk is at or before the reader's position.

Not every scene needs a new description. Add a new entry only when something meaningfully changes what we *know* about the character (a backstory reveal, a major role change, a death, a transformation).

### LOC_META (object)

Static metadata for each location, keyed by ID.

```javascript
{
  COUNTING: {
    name: "Scrooge & Marley's",  // display name
    icon: "🏢",                   // emoji icon (currently unused in v3, but available)
    intro: "S1-01",              // chunk ID where first visited
    type: "office"               // category label
  }
}
```

### LOC_DESCS (object)

Position-aware location descriptions. Same structure and principle as `CHAR_DESCS`.

```javascript
{
  CRATCHIT: [
    { from: "S3-03", desc: "The Cratchit home. Modest but full of warmth, love, and the smell of goose." },
    { from: "S4-04", desc: "The Cratchit home. Once full of warmth. In the future vision, the family mourns. Tiny Tim's chair is empty." }
  ]
}
```

Locations update when their status, mood, or significance changes. A ship that's been captured, a fort that's changed hands, a house that's gone from celebration to mourning — these all warrant a new description entry.

### STAVES / PARTS (array)

Section labels displayed as headers in the position finder and recap.

```javascript
const STAVES = [
  "Stave I — Marley's Ghost",
  "Stave II — The First of the Three Spirits",
  // ...
];
```

The name of this constant is book-specific. Use whatever the book calls its divisions: "Part", "Book", "Chapter", "Stave", "Act", etc. For books without chapters (many Terry Pratchett novels, for example), the chunks themselves become the primary navigation — each chunk title serves as the scene identifier.

---

## UI Structure

### Fixed Shell

```html
<div class="header">        <!-- Book title, author, progress bar -->
<div class="content">        <!-- Scrollable area, holds all four panels -->
  <div class="panel" id="panel-position">     <!-- Position finder -->
  <div class="panel" id="panel-characters">   <!-- Character tracker -->
  <div class="panel" id="panel-locations">     <!-- Location tracker -->
  <div class="panel" id="panel-recap">         <!-- Story recap -->
</div>
<div class="tab-bar">        <!-- Four tab buttons -->
```

Only one panel is visible at a time (`.panel.active`). The tab bar toggles visibility.

### Position Finder Tab

A scrollable list of scene cards grouped by section (part/stave/chapter).

**Scene card states:**

| State | Condition | Appearance |
|-------|-----------|------------|
| Read | `i < position` | Check mark, full micro summary visible |
| Current | `i === position` | Highlighted border, check mark, centered on screen |
| Next | `i === position + 1` | Micro summary visible (slightly dimmed), tappable |
| Future | `i > position + 1` | Locked message, dimmed, disabled |

**Centering behaviour:** When the position tab renders, the current scene scrolls to the vertical center of the screen (not the top). This uses `requestAnimationFrame` to wait for layout, then calculates the offset:

```javascript
const offset = cur.offsetTop - container.offsetTop
             - (container.clientHeight / 2)
             + (cur.clientHeight / 2);
container.scrollTop = Math.max(0, offset);
```

**Showing the next scene:** The scene immediately after the reader's position shows its micro summary. This is a design trade-off — it helps the reader recognise when they've passed a scene boundary, but carries a small spoiler risk for the very next event. For most books this is acceptable because the reader is about to read it anyway. If a book has major twists at scene boundaries, you could hide the next scene's micro too.

### Character Tracker Tab

A sorted, expandable list of characters.

**Sorting:** Characters in the current scene appear first (pinned to top). After that, characters are sorted by total appearance count (descending). This means the most important characters are always near the top.

**Count bubbles:** Each character shows a circular bubble with their appearance count. The bubble is filled/coloured if the character is in the current scene, outlined/white if not.

**Expandable detail:** Tapping a character reveals their position-aware description, last seen scene, and total appearances.

**Badges:** Optional labels like "spirit" or "vision" that appear next to the character name. These are book-specific.

### Location Tracker Tab

Same structure as the character tracker: sorted by current-scene presence then appearance count, count bubbles, expandable detail with position-aware description and last seen scene.

### Recap Tab

A vertical timeline of all scenes the reader has completed, grouped by section. Each entry shows the scene title and micro summary. The current scene's timeline dot is highlighted.

---

## Rendering Approach

The app uses vanilla JavaScript with innerHTML rendering. Each tab has a `render` function that rebuilds the entire panel HTML from the data constants and current `position`. Event listeners are re-attached after each render.

This is simple and works well for the data sizes involved (up to ~30-40 chunks, ~25 characters, ~15 locations). For books with hundreds of chunks, you might want to virtualise the lists, but for most novels this approach is fine.

### Helper Functions

```javascript
ci(id)                    // chunk index: returns the array index for a chunk ID
unlocked(introId)         // true if the chunk is at or before the reader's position
getDesc(descs, position)  // returns the latest description at or before position
countAppearances(field, id)  // counts how many chunks (up to position) contain this ID
```

---

## Theming

The CSS uses a simple colour palette defined through hardcoded values (not CSS variables in the current prototype, but easily refactored). Each book should have its own colour scheme to match its mood:

| Element | Christmas Carol | Treasure Island |
|---------|----------------|-----------------|
| Header background | Deep navy `#1A1A2E` | Dark brown `#2C1810` |
| Accent colour | Purple `#7B68AE` | Warm gold `#9B7B5E` |
| Active bubble | Purple `#7B68AE` | Gold `#9B7B5E` |
| Progress bar | Purple gradient | Gold gradient |
| Card backgrounds | Light lavender `#F5F3FA` | Light cream `#FAF6F0` |

The typography uses Google Fonts: Playfair Display for headings and Source Serif 4 for body text. These are loaded via a `<link>` tag in the `<head>`.

---

## Adapting for a New Book

To create a companion for a new book:

1. **Process the epub** into a JSON file (see the separate processing guide)
2. **Create a new HTML file** by copying the template
3. **Replace the data constants** with the new book's data
4. **Adjust theming** — colours, section label naming, any book-specific badges
5. **Test** by tapping through all scenes and verifying that descriptions evolve correctly and no spoilers leak

The processing step is the most labour-intensive. The HTML template is almost entirely reusable.

---

## Scaling Considerations

**Books without chapters:** Use scene boundaries instead. Each chunk's `title` becomes the primary identifier. The `part` field can still group scenes into acts or sections if the book has any structure at all. For truly structureless books (some Pratchett), treat each scene break as a chunk and give each a descriptive title.

**Very long books (400+ pages):** The recap tab becomes a long scroll. Consider adding a collapsed/expanded toggle per section, or only showing micro summaries for the current section and one-line titles for earlier sections.

**Series:** Each book gets its own HTML file. You could add a landing page that links to each book's companion.

**Multiple formats:** The same data model works whether you're building a single HTML file, a React app, or a native mobile app. The data constants are the interface — the rendering is swappable.
