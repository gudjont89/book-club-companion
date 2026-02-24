import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "..", "data");

router.get("/", (_req, res) => {
  try {
    const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
    const books = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const metaPath = path.join(DATA_DIR, e.name, "meta.json");
        if (!fs.existsSync(metaPath)) return null;
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        return meta;
      })
      .filter(Boolean);

    res.json(books);
  } catch (err) {
    console.error("Error listing books:", err);
    res.status(500).json({ error: "Failed to list books" });
  }
});

router.get("/:slug", (req, res) => {
  const { slug } = req.params;
  const bookDir = path.join(DATA_DIR, slug);

  if (!fs.existsSync(bookDir)) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  try {
    const meta = JSON.parse(fs.readFileSync(path.join(bookDir, "meta.json"), "utf-8"));
    const chunks = JSON.parse(fs.readFileSync(path.join(bookDir, "chunks.json"), "utf-8"));
    const characters = JSON.parse(fs.readFileSync(path.join(bookDir, "characters.json"), "utf-8"));
    const locations = JSON.parse(fs.readFileSync(path.join(bookDir, "locations.json"), "utf-8"));

    res.json({
      ...meta,
      chunks,
      characters,
      locations,
    });
  } catch (err) {
    console.error(`Error loading book ${slug}:`, err);
    res.status(500).json({ error: "Failed to load book data" });
  }
});

export { router as booksRouter };
