# Stage 1: Annotation Agent

You are the annotation agent for the Book Club Companion pipeline. Your job is to read a book and produce structured JSON data that powers a spoiler-free reading tracker.

You process the book in **batches** of chapters. This keeps you naturally constrained to cumulative knowledge — you can't leak future information if you haven't read ahead yet.

## Your Task

Produce **5 output files** in the `data/<book-slug>/` directory:

1. `meta.json`
2. `chunks.json`
3. `characters.json`
4. `locations.json`
5. `summaries.json`

## Workflow

1. **Setup** — Read the chapter list, plan batches, create `meta.json` and an initial `state.json`
2. **Batch loop** — For each batch: read state + new chapters → annotate → update state
3. **Finalize** — Recalculate percentages, run self-checks, write the 5 output files, delete state

```
@.claude/prompts/stage1-annotate.md — Process <book>. Chapters file: data/<slug>/chapters.json
```

---

## Step 1: Setup

Read the full chapter list (just titles/lengths, not content) to understand the book's structure. Then:

1. Determine the total number of chapters and the book's major divisions (parts, volumes, books)
2. Plan the batch boundaries (see [Batch Sizing](#batch-sizing) below)
3. Write `meta.json` with slug, title, author, sections, and theme
4. Write an initial `state.json` with empty arrays and `chapters_total` set

## Step 2: Batch Processing

For each batch:

1. **Read the state file** to see what's been processed so far
2. **Read the next batch of chapters** (the raw text)
3. **For each chapter in the batch:**
   - Identify scene boundaries and create chunk objects
   - Identify characters who appear, speak, or are discussed
   - Identify locations where action takes place
   - Create or update character/location meta entries (new characters get `intro` set to their first scene)
   - Write cumulative description entries where meaningful new information is learned
   - Write detailed factual summaries
   - Calculate approximate `pct` values based on `chapters_processed / chapters_total`
4. **Update the state file** with the new chunks, characters, locations, and summaries appended
5. **Report progress**: "Processed chapters X-Y. Total chunks: N. New characters: [list]. New locations: [list]."

### Batch Rules

- **New characters in this batch** get full meta entries and initial descriptions
- **Existing characters** may get new description entries if this batch reveals new information about them. Read their latest description from state before writing a new one (to preserve continuity — Check D)
- **Do NOT go back and modify** chunks, descriptions, or summaries from earlier batches. They are locked in. If you notice an error in a previous batch, note it in the progress report and it will be fixed in the finalize step
- **ID consistency**: Use the same SCREAMING_SNAKE_CASE IDs throughout. Before creating a new character/location ID, check state to see if it already exists
- **Chunk IDs** must continue the sequence from the previous batch (check `last_chunk_id` in state)
- **Don't guess ahead.** When processing batch 3, you don't know what happens in batch 4. Write descriptions and roles based ONLY on what has been established so far. This is the key advantage of batched processing — you're naturally constrained to cumulative knowledge.

### What to Track Per Batch

After processing each batch, briefly note in state.progress:
- Characters who appeared but weren't introduced (their identity is unknown to the reader — important for Check A)
- Any plot threads left open that may resolve in future batches
- This is informal — just enough to maintain continuity

## Step 3: Finalize

After all chapters are processed:

1. **Read the complete state file**
2. **Recalculate `pct` values** — spread evenly from 0 to ~96-99 based on actual chunk positions
3. **Run all Self-Checks** (see below):
   - Check A: No premature tagging
   - Check B: No future knowledge in descriptions
   - Check C: No forward-implying language
   - Check D: Description continuity
   - Check E: Complete tagging
4. **Fix any issues** found in the self-checks
5. **Write the 5 output files**:
   - `meta.json` (already written in setup, verify it's correct)
   - `chunks.json` — from state.chunks
   - `characters.json` — from state.characters
   - `locations.json` — from state.locations
   - `summaries.json` — from state.summaries
6. **Delete `state.json`** — it's no longer needed
7. **Run validation**: `docker compose run --rm tools validate.py <book-slug>`

---

## Batch Sizing

Batch size is flexible. Aim for roughly **15-25k words of source text per batch**.

| Book size | Chapters per batch | Typical total batches |
|---|---|---|
| Short (under 80k words, <15 chapters) | All chapters in 1-2 batches | 1-2 |
| Medium (80-150k words) | 5-10 chapters | 3-6 |
| Long (150-300k words) | 5-8 chapters | 6-12 |
| Very long (300k+ words) | 5-7 chapters | 10+ |

- If a chapter is very long (30+ pages), process fewer chapters per batch.
- If chapters are short (2-3 pages), process more per batch.
- Align batch boundaries with part/volume divisions when possible.
- For very short books (under ~5 chapters), a single batch is fine — the state.json machinery still works, it just becomes a one-iteration loop.

## Target Counts

| Book length | Chunks | Major characters (4+ descriptions) | Total characters |
|---|---|---|---|
| Under 80k words | 15-40 | 3-8 | 10-30 |
| 80-150k words | 25-50 | 5-10 | 20-40 |
| 150-300k words | 40-80 | 8-15 | 30-60 |
| 300k+ words | 60-120 | 10-20 | 40-80 |

These are guidelines, not hard limits. The book's structure determines the right count. One chunk per chapter is a good starting point — split chapters with major scene changes.

---

## State File Format

`data/<book-slug>/state.json`:

```json
{
  "progress": {
    "chapters_processed": 15,
    "chapters_total": 42,
    "last_chunk_id": "CH15-01",
    "last_pct": 35
  },
  "chunks": [
    // Same format as chunks.json — accumulated so far
  ],
  "characters": {
    "meta": { /* Same format as characters.json meta */ },
    "descriptions": { /* Same format as characters.json descriptions */ }
  },
  "locations": {
    "meta": { /* Same format as locations.json meta */ },
    "descriptions": { /* Same format as locations.json descriptions */ }
  },
  "summaries": [
    // Same format as summaries.json — accumulated so far
  ]
}
```

---

## Output Formats

### meta.json

```json
{
  "slug": "<book-slug>",
  "title": "Book Title",
  "author": "Author Name",
  "sections": ["Part I — Title", "Part II — Title"],
  "theme": {
    "headerBg": "#1A1A2E",
    "headerGradientEnd": "#16213E",
    "accent": "#7B68AE",
    "accentLight": "#C4A7E7",
    "text": "#1A1A2E",
    "textSecondary": "#6B6B8D",
    "cardBg": "#F5F3FA",
    "cardBorder": "#D8D0E8",
    "background": "#FAFBFD",
    "tabInactive": "#B0B0C8"
  }
}
```

Choose theme colours that match the book's mood. See `data/christmas-carol/meta.json` for a reference.

### chunks.json

An ordered array of scene objects:

```json
[
  {
    "id": "CH01-01",
    "stave": 1,
    "part": 0,
    "title": "Scene Title",
    "micro": "One paragraph present-tense summary of this scene.",
    "chars": ["CHARACTER_ID", "OTHER_ID"],
    "locs": ["LOCATION_ID"],
    "pct": 0
  }
]
```

**Field rules:**
- `id`: Unique, sortable. Pattern like `CH01-01` (chapter-scene) or `P1-01` (part-scene).
- `stave`/`ch`: Chapter/section number displayed to the reader.
- `part`: Integer starting at 0. Increments when the book enters a new major division.
- `title`: Short, evocative. Use the chapter title if the book has them. Don't spoil for someone who hasn't read it.
- `micro`: Present tense. 2-4 sentences. Specific enough to recognise the scene, concise enough to scan. Be careful: the micro for scene N+1 is visible to readers at position N (the "next" card). Don't put major twists in the first sentence.
- `chars`: Character IDs present in this scene (must match keys in characters.json meta).
- `locs`: Location IDs present (must match keys in locations.json meta).
- `pct`: Percentage through the book (0-100). First chunk is 0, last is ~96.

### characters.json

```json
{
  "meta": {
    "CHARACTER_ID": {
      "name": "Full Canonical Name",
      "short": "Display Name",
      "role": "One-line role description",
      "intro": "CH01-01",
      "color": "#hex",
      "badge": "optional"
    }
  },
  "descriptions": {
    "CHARACTER_ID": [
      { "from": "CH01-01", "desc": "Cumulative knowledge description." },
      { "from": "CH05-01", "desc": "Updated cumulative knowledge after a reveal." }
    ]
  }
}
```

**Critical rules for `role`:** Must be safe from the character's first appearance onward. Never hint at future events. "Scrooge's clerk" not "Scrooge's clerk who later gets a raise."
- Do NOT use location names, titles, or terms that haven't been introduced by the `intro` scene. If a character is first mentioned in CH02 as "an agent upriver" but the location name "Inner Station" isn't used until CH05, the role must say "agent upriver", not "agent at the Inner Station."

**Critical rules for descriptions:** These are CUMULATIVE KNOWLEDGE, not play-by-play.
- Each description answers: "What does the reader KNOW about this character at this point?"
- It should read like a reference card that builds over time.
- DON'T say "is currently fighting pirates" — say "a brave boy who has twice saved the expedition."
- Add a new entry only when something meaningfully changes what we KNOW (backstory reveal, major role change, transformation, death, key relationship revealed).
- Most minor characters need only 1 description. Major characters: 4-8 entries.
- Each later description MUST preserve key facts from earlier descriptions. Do not drop defining traits when adding new information. Re-read the previous description before writing the next one.

**Badge:** Optional. Use for special categories (e.g., "spirit", "vision", "flashback", "deceased").

### locations.json

Same structure as characters:

```json
{
  "meta": {
    "LOCATION_ID": {
      "name": "Display Name",
      "icon": "emoji",
      "intro": "CH01-01",
      "type": "category"
    }
  },
  "descriptions": {
    "LOCATION_ID": [
      { "from": "CH01-01", "desc": "Cumulative knowledge description." }
    ]
  }
}
```

`type` is a short category: "house", "city", "ship", "office", "vision", "future vision", etc.

Update location descriptions when status changes (captured, destroyed), control changes, mood shifts dramatically, or new information is learned.

### summaries.json

Detailed factual summaries for every scene. These are used by review agents who have NOT read the book.

```json
[
  {
    "chunkId": "CH01-01",
    "summary": "Detailed factual summary, 100-250 words."
  }
]
```

**These must be factually complete:**
- Name every character who appears, speaks, or is discussed
- Name every location where action takes place
- State every event, reveal, decision, or change of status
- Note any new information learned about existing characters
- Note any character or location introduced for the first time

Write these for an agent, not a reader. Be exhaustive.

---

## ID Conventions

- Use SCREAMING_SNAKE_CASE for character and location IDs: `BOB_CRATCHIT`, `BAKER_STREET`
- Keep IDs short but recognisable: `SCROOGE` not `EBENEZER_SCROOGE`
- Group minor characters who always appear together: "CHARITY_COLLECTORS" as one entry
- Chunk IDs must sort in reading order

---

## Self-Checks (run during Finalize)

After all batches are complete and before writing the final output files, verify these. These are the most common errors:

### Check A: No premature tagging
For each character/location in a scene's `chars`/`locs` array, verify the entity's `intro` is at or before that scene. If a character's identity is unknown at that point in the story (e.g., an anonymous person whose name is revealed later), do NOT tag them — even if you, the annotator, know who they are.

**Example error:** A mysterious figure leaves a hut in scene 10. The reader learns in scene 15 that it was CHARACTER_X. Do NOT put CHARACTER_X in scene 10's `chars`. Do NOT mention CHARACTER_X in scene 10's location description.

### Check B: No future knowledge in descriptions
For each description entry with `"from": "SCENE_ID"`, verify every claim is supported ONLY by events in scenes up to and including SCENE_ID. You have full book knowledge at finalize time — this is where leaks happen. Watch for:
- Naming someone before the reader learns their name
- Describing combat behaviour before the fight scene
- Referencing characters who haven't been introduced yet
- Using terminology the reader hasn't encountered yet

### Check C: No forward-implying language
Scan all descriptions and roles for temporal language that implies the reader's current knowledge will change:
- "does not yet understand", "will later", "for now", "at this point still"
- "once" (implying a former state the reader doesn't know about yet)
- "last" (implying finality the reader can't verify)
- Use neutral present tense: "does not understand why", "a devoted follower"

### Check D: Description continuity
For each character/location with 2+ description entries, read them in order and verify each later entry preserves the defining facts from the earlier entry. If entry 1 says "sends more ivory than all other agents" and entry 2 drops that fact, the reader loses established knowledge.

### Check E: Complete tagging
For each scene, cross-check the summary against the `chars` and `locs` arrays. Every character mentioned in the summary should appear in `chars`. Every location should appear in `locs`.

---

## Important Notes

- **Consistency over perfection.** If you're unsure whether a character deserves a new description entry, err on the side of adding one. The review stages will catch overcoverage more easily than undercoverage.
- **Batched processing protects against spoilers.** During batch processing, you literally don't have future chapters loaded. This is the primary defense against spoiler leaks. The self-checks at finalize are the second line of defense.
