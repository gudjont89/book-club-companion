# Book Club Companion

A spoiler-free reading tracker. Each book is a set of JSON data files served by an Express API to a React frontend, all running in Docker.

## Project Structure

- `client/` — Vite + React + TypeScript frontend
- `server/` — Express API serving book data from JSON files
- `data/<book-slug>/` — JSON data per book (meta, chunks, characters, locations, summaries)
- `tools/` — Python utilities (epub extraction, data validation)
- `docs/` — Architecture guides and pipeline documentation
- `.claude/prompts/` — Agent prompts for the book processing pipeline

## Running

```bash
docker-compose up
```

Frontend: http://localhost:5173 | API: http://localhost:3001/api/books

## Book Processing Pipeline

To generate data for a new book, use the agent prompts in `.claude/prompts/`. Each stage is a separate prompt file designed to be used in a Claude Code conversation.

### Pipeline Stages (in order)

**1. Extract chapters** (if starting from epub):
```bash
python tools/extract.py path/to/book.epub --output data/<book-slug>
```

**2. Stage 1 — Annotate** (`.claude/prompts/stage1-annotate.md`):
Read the full book and produce all data files. Use this prompt by referencing it:
```
@.claude/prompts/stage1-annotate.md — Process this book: [provide book text or chapters.json]
```
This creates: `meta.json`, `chunks.json`, `characters.json`, `locations.json`, `summaries.json`

**3. Validate structure**:
```bash
python tools/validate.py <book-slug>
```

**4. Stage 3a — Coverage check** (`.claude/prompts/stage3a-coverage.md`):
Compare summaries against the source text. Fix any gaps before proceeding.
```
@.claude/prompts/stage3a-coverage.md — Check summaries for data/<book-slug>/
```

**5. Stage 2 + 3b — Spoiler review + Continuity review** (can run in parallel):
```
@.claude/prompts/stage2-spoiler-review.md — Review data/<book-slug>/ for spoilers
@.claude/prompts/stage3b-continuity.md — Check continuity for data/<book-slug>/
```

**6. Human review** — Review flagged issues, apply fixes.

**7. Re-validate** after fixes:
```bash
python tools/validate.py <book-slug>
```

### Data File Formats

Each book lives in `data/<book-slug>/` with these files:

| File | Contents |
|------|----------|
| `meta.json` | Slug, title, author, section labels, theme colors |
| `chunks.json` | Ordered array of scenes with micro summaries and char/loc tags |
| `characters.json` | `{ meta: {...}, descriptions: {...} }` |
| `locations.json` | `{ meta: {...}, descriptions: {...} }` |
| `summaries.json` | Detailed scene summaries for the review pipeline |

### Key Principles

- **Cumulative knowledge**: Character/location descriptions reflect what the reader HAS LEARNED up to that point, not what is currently happening.
- **Spoiler-free roles**: The `role` field in character meta must be safe from the character's first appearance onward.
- **Micro summary visibility**: The micro summary for scene N+1 is visible to readers at position N (the "next" card). Don't put twists in the first sentence.
- **ID conventions**: SCREAMING_SNAKE_CASE for character/location IDs. Chunk IDs must sort in reading order.

### Reference Data

See `data/christmas-carol/` for a complete working example of all data file formats.
