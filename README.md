# Book Club Companion

A spoiler-free reading tracker for novels. Set your current position in a book and browse characters, locations, and a recap — all filtered so nothing beyond your position is revealed.

## Quick Start

```bash
docker-compose up
```

- Frontend: http://localhost:5173
- API: http://localhost:3001/api/books

## Project Structure

```
├── client/          # Vite + React + TypeScript frontend
├── server/          # Express API backend
├── data/            # Book data (JSON files per book)
├── tools/           # Python epub processing tools
└── docs/            # Architecture and workflow documentation
```

## Development

### With Docker (recommended)

```bash
docker-compose up
```

Both services have volume mounts for hot-reloading during development.

### Without Docker

**Server:**
```bash
cd server
npm install
npm run dev
```

**Client:**
```bash
cd client
npm install
npm run dev
```

Note: without Docker, update `vite.config.ts` to proxy to `http://localhost:3001` instead of `http://server:3001`.

## Adding a New Book

See [docs/new-book-workflow.md](docs/new-book-workflow.md) for the full guide. In brief:

1. Create `data/<book-slug>/` with `meta.json`, `chunks.json`, `characters.json`, `locations.json`
2. Run validation: `python tools/validate.py <book-slug>`
3. Restart the server — the book appears on the landing page

## Data Format

Each book has 4 JSON files:

- **meta.json** — Title, author, theme colors, section labels
- **chunks.json** — Ordered array of scenes with summaries and character/location tags
- **characters.json** — Character metadata and position-aware descriptions
- **locations.json** — Location metadata and position-aware descriptions

See [docs/app-structure.md](docs/app-structure.md) for the full data model specification.

## Python Tools

```bash
pip install -r tools/requirements.txt

# Extract chapters from an epub
python tools/extract.py path/to/book.epub

# Validate book data
python tools/validate.py <book-slug>
```
