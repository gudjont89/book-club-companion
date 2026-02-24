# Book Club Companion — Epub Processing Guide

## Overview

This guide explains how to take a raw `.epub` file and produce the JSON data needed to populate a Book Club Companion page. The output is a set of JavaScript constants that get embedded directly in the HTML file, plus a set of detailed scene summaries used during the review process.

The process has three phases:

1. **Extraction** — get the raw text out of the epub and into a structured format
2. **Annotation** — add the metadata that powers the app (descriptions, character/location tagging, spoiler-aware progression) plus detailed scene summaries
3. **Review** — validate the data for spoilers and continuity errors

Extraction can be automated. Annotation requires human judgement (or a careful AI pass). Review can be largely automated using the agent pipeline described in the separate **Automated Review Pipeline** document — that pipeline uses the detailed summaries produced during annotation as its primary input.

---

## Phase 1: Extraction

### Step 1 — Unpack the Epub

An `.epub` file is a ZIP archive containing XHTML files. Extract it and identify the content files.

```bash
mkdir book_extracted
unzip book.epub -d book_extracted/
```

The content files are usually in `OEBPS/` or `text/` and listed in the `content.opf` manifest. They're typically one file per chapter.

### Step 2 — Extract Chapter Text

Parse each XHTML file to get clean text. Strip HTML tags, headers, footers, and metadata. Preserve paragraph breaks.

```python
from bs4 import BeautifulSoup
import json, os, glob

chapters = []
# Sort files by their order in the spine (check content.opf)
for filepath in sorted(glob.glob("book_extracted/OEBPS/*.xhtml")):
    with open(filepath) as f:
        soup = BeautifulSoup(f.read(), "html.parser")
    # Extract text, skip navigation/TOC pages
    text = soup.get_text(separator="\n").strip()
    if len(text) > 200:  # skip very short pages (title pages, etc.)
        chapters.append({
            "file": os.path.basename(filepath),
            "text": text
        })

with open("chapters.json", "w") as f:
    json.dump(chapters, f, indent=2)
```

**Watch out for:**

- Title pages, copyright pages, table of contents — skip these
- Epigraphs and dedications — usually skip, unless they're narratively significant
- Chapter numbering embedded in the text vs. in the filename — cross-reference with the spine order in `content.opf`
- Encoding issues — some epubs use non-standard encodings for special characters

### Step 3 — Identify Scene Boundaries

Each chapter may contain one or more "chunks" (scenes). A chunk is a unit of narrative that takes place in roughly one setting with one set of characters.

**For books with chapters:** Start with one chunk per chapter. Split further if a chapter contains a major scene change (different setting, time skip, narrator switch).

**For books without chapters:** Look for scene breaks marked by whitespace, ornamental dividers (often `* * *`), or shifts in setting/perspective. Each break becomes a chunk boundary.

**Practical guidance:**

- Aim for 15–40 chunks for a typical novel. Fewer than 15 makes the position finder too coarse; more than 40 makes it overwhelming to scroll.
- A Christmas Carol (28,000 words) has 26 chunks — roughly one per major scene.
- Treasure Island (62,000 words) has 32 chunks — roughly one per chapter, with the last three chapters combined.
- For a 400-page novel, 25–35 chunks is usually right.

### Output of Phase 1

A JSON file containing an ordered array of raw text chunks:

```json
[
  {
    "chapter": 1,
    "title": "Chapter Title (if available)",
    "text": "Full text of this chunk..."
  }
]
```

---

## Phase 2: Annotation

This is where the book data gets created. You'll produce seven artefacts: six data structures that map directly to the JavaScript constants in the HTML file, plus a set of detailed scene summaries used by the review pipeline.

### Step 0 — Create Detailed Scene Summaries

Before (or alongside) the reader-facing data, write a **detailed summary** for every scene. These are longer than the micro summaries (100–250 words per scene) and explicitly name every character present, every location used, every key event, and every piece of information revealed.

These summaries serve two purposes:

1. They're the primary input for the automated review pipeline (Stages 2 and 3), which uses them instead of raw book text for efficiency and reliability.
2. They act as a factual reference during the annotation process itself — when writing a CHAR_DESCS entry for scene 15, you can cross-reference the detailed summaries for scenes 1–15 to verify you're not including information the reader hasn't encountered.

A good detailed summary is written for an agent, not a reader:

- Name every character who appears, speaks, or is discussed
- Name every location where action takes place
- State every event, reveal, decision, or change of status
- Note any new information learned about existing characters
- Note any character or location introduced for the first time

Example (S3-03, Christmas Carol):

> The Ghost of Christmas Present takes Scrooge to the Cratchit home. Bob Cratchit arrives carrying Tiny Tim on his shoulder. Tiny Tim is small, disabled, and walks with a crutch — this is his first appearance. Mrs. Cratchit, Martha Cratchit, Peter Cratchit, and Belinda Cratchit are also present — all introduced here. The family prepares a modest Christmas dinner (goose, pudding) with enormous excitement despite their poverty. Bob's devotion to Tiny Tim is evident. Martha works at a milliner's and arrives late. Peter wears Bob's hand-me-down shirt collar.

### Step 1 — Create CHUNKS

For each text chunk, write:

| Field | What it is | How to write it |
|-------|-----------|----------------|
| `id` | Unique identifier | Use a pattern like `S1-01` (section-number) or `CH01` (chapter). Must be unique and sortable. |
| `stave` / `ch` | Chapter/section number | The number displayed to the reader. Can be a number or string (`"32–34"` for combined chapters). |
| `part` | Section group index | Integer starting at 0. Increments when the book enters a new major division (Part, Book, Stave, Act). |
| `title` | Scene title | A short, evocative title. Use the chapter title if the book has them. If not, write one that captures the scene without spoiling it for someone who hasn't read it yet. |
| `micro` | Micro summary | One paragraph (2–4 sentences) describing what happens. Written in present tense. Specific enough that a reader can recognise the scene, concise enough to scan quickly. |
| `chars` | Characters present | Array of character IDs (matching keys in CHAR_META). Include characters who appear, speak, or are significantly discussed in this scene. |
| `locs` | Locations present | Array of location IDs (matching keys in LOC_META). Include all settings where action takes place. |
| `pct` | Position percentage | Approximate percentage through the book (0–100). First chunk is 0, last chunk is ~96. Calculate from word count or just space them roughly evenly. |

**Writing good micro summaries:**

- Present tense: "Scrooge sees Marley's face in the knocker" not "Scrooge saw..."
- Specific: name characters, describe actions, note key reveals
- One paragraph only — this is what the reader scans in the position finder
- For the scene immediately *following* a major twist, be careful. The micro summary is visible to readers one scene behind (the "next" card). If a twist happens at the very start of a scene, consider whether the micro summary gives it away.

### Step 2 — Create CHAR_META

For each character who appears in the book, create an entry:

```javascript
{
  SCROOGE: {
    name: "Ebenezer Scrooge",  // full canonical name
    short: "Scrooge",          // name shown in lists
    role: "Protagonist",       // one-line role description
    intro: "S1-01",            // chunk ID of first appearance
    color: "#3D405B",          // hex colour for UI accents
    badge: "spirit"            // optional, book-specific
  }
}
```

**Guidelines:**

- **`role` must be safe from the first appearance onward.** Don't write "Scrooge's clerk who later gets a raise" — write "Scrooge's clerk." The role is always visible regardless of reader position.
- **Don't say "recurring"** or hint at future appearances.
- **Group minor characters** when they always appear together and individually don't matter much (e.g., "Charity Collectors" as one entry rather than two separate unnamed gentlemen).
- **`badge` is optional.** Use it to flag characters who belong to a special category (spirits, visions, flashback characters, etc.). The badge label appears in the UI next to the character name.

**How many characters to include:**

Include every character the reader might want to look up. For most novels this is 10–25. Skip unnamed background characters unless they're plot-relevant. When in doubt, include them — it costs nothing and helps the reader.

### Step 3 — Create CHAR_DESCS

For each character, write an array of position-aware descriptions:

```javascript
{
  SCROOGE: [
    { from: "S1-01", desc: "An old miser. Cold, solitary, universally disliked." },
    { from: "S2-06", desc: "An old miser who was once a lonely boy, then a happy apprentice, then a young man who lost love to greed." },
    { from: "S5-02", desc: "Once a cold miser, now transformed. Was a lonely boy, lost love — and chose differently." }
  ]
}
```

**The key principle: cumulative knowledge, not play-by-play.**

Each description answers: "What does the reader *know* about this character at this point?" It should read like a reference card, not a scene description. Don't say "is currently fighting pirates" — say "a brave boy who has twice saved the expedition through reckless solo action."

**When to add a new description entry:**

- A significant backstory reveal (we learn about their past)
- A major role change (ally becomes enemy, or vice versa)
- A transformation (character changes fundamentally)
- A death or disappearance (their status changes)
- A key relationship is revealed

**When NOT to add a new entry:**

- The character simply appears in a scene (that's what `chars` in CHUNKS is for)
- Something happens *to* them that doesn't change what we know *about* them
- Minor dialogue or interactions

Most minor characters need only one description. Major characters in a complex novel might need 4–8 entries.

### Step 4 — Create LOC_META

Same structure as CHAR_META:

```javascript
{
  COUNTING: {
    name: "Scrooge & Marley's",
    icon: "🏢",
    intro: "S1-01",
    type: "office"
  }
}
```

**`type` is a short category label** — "office", "ship", "house", "city", "vision", "future vision", etc. It's displayed as secondary text under the location name.

**How many locations to include:**

Include every named or significant setting. For most novels this is 8–20. Don't include every street corner — group minor locations (e.g., "London Streets" rather than separate entries for each street).

### Step 5 — Create LOC_DESCS

Position-aware location descriptions. Same principle as CHAR_DESCS: cumulative knowledge.

```javascript
{
  CRATCHIT: [
    { from: "S3-03", desc: "The Cratchit home. Modest but full of warmth, love, and the smell of goose." },
    { from: "S4-04", desc: "The Cratchit home. Once full of warmth. In the future vision, Tiny Tim's chair is empty." }
  ]
}
```

**When to add a new entry:**

- The location's status changes (captured, destroyed, transformed)
- Control changes (a ship or fort changes hands)
- The mood or significance shifts dramatically (a house goes from celebration to mourning)
- We learn something new about the place (it has a hidden cave, a buried treasure, a secret room)

### Step 6 — Create Section Labels

A simple array of section names:

```javascript
const STAVES = [
  "Stave I — Marley's Ghost",
  "Stave II — The First of the Three Spirits",
  // ...
];
```

Use whatever the book calls its divisions. The `part` field in each chunk indexes into this array.

**For books without formal divisions**, you can still create groupings. A Pratchett novel might use location-based groups ("Ankh-Morpork", "The Journey", "The Überwald") or thematic ones. Or just omit the section labels entirely — the position finder still works with individual scene cards.

---

## Using AI for Annotation

The annotation phase (Phase 2) can be done with an AI assistant. This is the approach used to create the Christmas Carol and Treasure Island examples. Here's how:

### Prompt Strategy

1. **Provide the full text** (or chapter-by-chapter) to the AI
2. **Ask it to read the entire text first** before producing any output
3. **Request the output in the exact data structure format** described above, including detailed scene summaries
4. **Instruct the AI** that detailed summaries must be factually complete — they'll be used by review agents who haven't read the source text
5. **Review every description** for the cumulative-knowledge principle — the AI tends to describe what characters are *doing* rather than what we *know* about them

### Automated Review

Once the AI produces the annotation output, run it through the **Automated Review Pipeline** (see separate document). The pipeline uses the detailed summaries to check for spoilers scene-by-scene, and verifies continuity and cross-reference integrity. This catches the majority of mechanical errors and spoiler leaks, leaving human review for the subtler judgement calls.

The pipeline depends on the detailed summaries being complete. If the summaries omit characters or events present in the source text, the pipeline has blind spots. The pipeline includes a summary coverage pass (Stage 3a) that checks summaries against the full text to catch these gaps.

### Common AI Mistakes to Watch For

| Mistake | Example | Fix |
|---------|---------|-----|
| Play-by-play descriptions | "Currently fighting pirates at the stockade" | "A brave boy. Has twice saved the expedition through reckless solo action." |
| Hinting at future events | "A character who will become important later" | "Silver's pub in Bristol." |
| Inconsistent IDs | Using "CRATCHIT" in CHUNKS but "BOB_CRATCHIT" in CHAR_META | Use a consistent ID scheme and verify all cross-references |
| Over-granular chunks | 60 chunks for a 200-page novel | Merge scenes that flow together naturally |
| Under-granular chunks | 8 chunks for a 400-page novel | Split chapters with major scene changes |
| Missing characters | Forgetting minor characters who appear once | Scan each chunk's text for named characters |
| Spoilery micro summaries | "Jim hides in the apple barrel and discovers Silver is a pirate" shown as the *next* scene card | Rewrite so the reveal isn't in the first sentence, or move the reveal into the *current* scene's summary |

### Verification Checklist

After generating the data, verify manually or via the automated review pipeline:

- [ ] Every character ID in CHUNKS.chars exists in CHAR_META
- [ ] Every location ID in CHUNKS.locs exists in LOC_META
- [ ] Every `intro` and `from` value is a valid chunk ID
- [ ] CHAR_DESCS has at least one entry for every character in CHAR_META
- [ ] LOC_DESCS has at least one entry for every location in LOC_META
- [ ] No description at position X references events after position X
- [ ] Section labels array length matches the number of distinct `part` values
- [ ] Chunks are ordered correctly (IDs sort in reading order)
- [ ] Percentage values increase monotonically
- [ ] Detailed summaries mention every character, location, and event in each scene's source text (critical — the review pipeline depends on summary completeness)
- [ ] Later descriptions preserve cumulative knowledge from earlier descriptions (no dropped facts)

---

## Assembling the Final HTML

Once you have all six data structures:

1. Open the HTML template (copy from the Christmas Carol or Treasure Island example)
2. Replace the data constants with your new book's data
3. Update the header (title, author)
4. Update the section label constant name if needed (e.g., `STAVES` → `PARTS` → `BOOKS`)
5. Adjust the colour scheme to match the book's mood
6. Search-and-replace any book-specific references in the rendering code (e.g., the recap uses `STAVES[chunk.part]` — make sure it references your label constant)
7. Test by tapping through every scene and checking:
   - Characters appear and disappear at the right moments
   - Descriptions evolve correctly
   - No spoilers leak through micro summaries or descriptions
   - Locations show up when first visited
   - Count bubbles and sorting work correctly

---

## Example: Processing a New Book

Say you want to process *The Hound of the Baskervilles*.

1. **Extract** — Unpack the epub, get 15 chapter files
2. **Chunk** — One chunk per chapter gives 15 chunks. Chapter 1 has two distinct scenes (the walking-stick deduction and Sir Henry's visit), so split it into two. You end up with ~20 chunks.
3. **Characters** — Holmes, Watson, Sir Henry, Barrymore, Mrs. Barrymore, Stapleton, Beryl, Sir Charles (deceased), Selden, Dr. Mortimer, Laura Lyons. About 11 characters.
4. **Locations** — Baker Street, Baskerville Hall, the moor, Grimpen Mire, Merripit House, Coombe Tracey, the Yew Alley. About 8-10 locations.
5. **Descriptions** — Holmes gets ~3 entries (absent for the middle section, then dramatically revealed on the moor). Watson gets ~3 (nervous in London, increasingly confident on the moor, relieved at the end). Stapleton gets ~3 (friendly naturalist, suspicious figure, revealed villain).
6. **Section labels** — The book doesn't have named parts, so either omit section headers or create thematic groups ("London", "Baskerville Hall", "The Moor", "The Resolution").

Total effort: 2–4 hours for a careful manual pass, or 30–60 minutes with AI annotation plus the automated review pipeline (see **Automated Review Pipeline** document). The pipeline adds ~$0.45–$1.15 in API costs but replaces most of the manual verification work.
