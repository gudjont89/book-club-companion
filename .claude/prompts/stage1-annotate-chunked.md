# Stage 1 (Chunked): Annotation Agent for Long Books

You are the annotation agent for the Book Club Companion pipeline. This is the **chunked** variant for books too long to process in a single pass (roughly 80,000+ words or 300+ pages).

You have FULL ACCESS to the entire book. Accuracy and completeness are your goals.

## When to Use This Prompt

Use this instead of `stage1-annotate.md` when the extracted `chapters.json` is too large to read in one go. As a rule of thumb:
- Under 80k words: use the standard `stage1-annotate.md`
- Over 80k words: use this chunked variant

## Overview

You will process the book in **batches** of 5-10 chapters. After each batch, you write intermediate state to `data/<book-slug>/state.json`. This file accumulates all data and is your memory between batches.

The workflow:
1. **Setup** — Create `meta.json` and the initial empty state file
2. **Batch loop** — For each batch: read state + new chapters → update state
3. **Finalize** — Convert state into the 5 output files, run self-checks

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

## Step 1: Setup

Read the full chapter list (just titles/lengths, not content) to understand the book's structure. Then:

1. Determine the total number of chapters and the book's major divisions (parts, volumes, books)
2. Plan the batch boundaries — aim for 5-10 chapters per batch. Align with part/volume boundaries when possible
3. Write `meta.json` with slug, title, author, sections, and theme
4. Write an initial `state.json` with empty arrays and `chapters_total` set

```
@.claude/prompts/stage1-annotate-chunked.md — Process <book>. Chapters file: data/<slug>/chapters.json
```

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

### What to Track Per Batch

After processing each batch, briefly note in state.progress:
- Characters who appeared but weren't introduced (their identity is unknown to the reader — important for Check A)
- Any plot threads left open that may resolve in future batches
- This is informal — just enough to maintain continuity

## Step 3: Finalize

After all chapters are processed:

1. **Read the complete state file**
2. **Recalculate `pct` values** — spread evenly from 0 to ~96-99 based on actual chunk positions
3. **Run all Self-Checks** from the standard `stage1-annotate.md`:
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

## Output Formats

All output formats are identical to the standard `stage1-annotate.md`. See that file for the exact JSON schemas for each file.

## ID Conventions

Same as standard: SCREAMING_SNAKE_CASE for character/location IDs. Chunk IDs like `CH01-01` (chapter-scene) or `P1-01` (part-scene). Must sort in reading order.

## Target Counts

| Book length | Chunks | Major characters (4+ descriptions) | Total characters |
|---|---|---|---|
| 80-150k words | 25-50 | 5-10 | 20-40 |
| 150-300k words | 40-80 | 8-15 | 30-60 |
| 300k+ words | 60-120 | 10-20 | 40-80 |

These are guidelines, not hard limits. The book's structure determines the right count.

## Important Notes

- **Batch size is flexible.** If a chapter is very long (30+ pages), process fewer chapters per batch. If chapters are short (2-3 pages), process more per batch. Aim for roughly 15-25k words of source text per batch.
- **Don't guess ahead.** When processing batch 3, you don't know what happens in batch 4. Write descriptions and roles based ONLY on what has been established so far. This is actually an advantage of chunked processing — you're naturally constrained to cumulative knowledge.
- **Consistency over perfection.** If you're unsure whether a character deserves a new description entry, err on the side of adding one. The review stages will catch overcoverage more easily than undercoverage.
