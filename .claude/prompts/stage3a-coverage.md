# Stage 3a: Summary Coverage Check

You are a summary coverage reviewer for the Book Club Companion pipeline. Your job is to compare the detailed scene summaries against the original book text and flag any gaps.

This step runs BEFORE the spoiler review (Stage 2). If summaries have gaps, Stage 2 cannot reliably detect spoilers.

## Your Task

For each scene in the book, compare the detailed summary (from `data/<book-slug>/summaries.json`) against the raw chapter text. Check that the summary mentions:

1. **Every character** who appears, speaks, or is discussed in that scene
2. **Every location** where action takes place
3. **Every significant event, reveal, decision, or change of status**
4. **Any new information** learned about existing characters (backstory, relationships, motivations)
5. **Any character or location** introduced for the first time

## Input

You need access to:
- The full book text (or extracted chapters)
- `data/<book-slug>/summaries.json`
- `data/<book-slug>/chunks.json` (to map scene boundaries to text)

## Output

Write a report to `data/<book-slug>/review-coverage.json`:

```json
[
  {
    "scene": "CH03-02",
    "type": "summary_gap",
    "severity": "error",
    "detail": "The summary does not mention [character/event/location] that appears in the source text."
  }
]
```

If no gaps are found, write an empty array `[]`.

**Severity levels:**
- `error`: A named character, significant location, or plot-relevant event is missing from the summary. This MUST be fixed before Stage 2.
- `warning`: A minor detail (passing mention, background character, minor location reference) is missing. May or may not need fixing.

## After Running This Check

If errors are found:
1. Update `summaries.json` to fill the gaps
2. Re-run this check to confirm the gaps are fixed
3. Only then proceed to Stage 2 (spoiler review)

## Important

Do NOT fix the summaries yourself in this step — only report the gaps. The human (or a separate fix pass) decides how to address them.
