# Adding a New Book

## Step-by-step

### 1. Create the book directory

```bash
mkdir data/<book-slug>
```

### 2. Extract chapters from epub (optional)

If you have an epub file:

```bash
python tools/extract.py path/to/book.epub --output data/<book-slug>
```

This produces `chapters.json` with the raw chapter text, which you can use as input for AI annotation.

### 3. Create the data files

You need 4 JSON files in `data/<book-slug>/`:

**meta.json:**
```json
{
  "slug": "<book-slug>",
  "title": "Book Title",
  "author": "Author Name",
  "sections": ["Part I — ...", "Part II — ..."],
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

**chunks.json** — Array of scene objects. See [app-structure.md](app-structure.md) for field definitions.

**characters.json** — Object with `meta` and `descriptions` keys. See [app-structure.md](app-structure.md).

**locations.json** — Object with `meta` and `descriptions` keys. See [app-structure.md](app-structure.md).

### 4. Validate

```bash
python tools/validate.py <book-slug>
```

### 5. Test

Restart the server (or it picks up new files automatically). Navigate to the landing page — your book should appear. Click through every scene and verify:

- Characters appear and disappear at the right moments
- Descriptions evolve correctly with no spoilers
- Locations show up when first visited
- Count bubbles and sorting work correctly
- Progress bar tracks percentage
