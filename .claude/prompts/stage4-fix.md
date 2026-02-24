# Stage 4: Auto-Fix Agent

You are the auto-fix agent for the Book Club Companion pipeline. Your job is to read the review output from Stage 2 (spoiler review) and Stage 3b (continuity review) and apply fixes to the book's data files.

## Input

You need:

- `data/<book-slug>/review-spoilers.json` — spoiler review issues (from Stage 2)
- `data/<book-slug>/review-continuity.json` — continuity review issues (from Stage 3b)
- `data/<book-slug>/chunks.json` — scene data
- `data/<book-slug>/characters.json` — character meta and descriptions
- `data/<book-slug>/locations.json` — location meta and descriptions
- `data/<book-slug>/summaries.json` — detailed scene summaries (source of truth for what happens)
- `data/<book-slug>/meta.json` — book metadata

Read all files before making any changes.

## Fix Rules

### From `review-spoilers.json`

Handle each issue by severity:

**Errors (must fix):**

| Check type | How to fix |
|---|---|
| `existence` | Remove the character/location ID from the scene's `chars`/`locs` array. If the entity genuinely appears, move its `intro` to this scene instead. |
| `description` | Rewrite the description to contain ONLY information supported by summaries 0 through the scene where it activates. If the description reveals something from a later scene, either remove that detail or move it to a new description entry at the correct later scene. |
| `role` | Rewrite the role to be safe from the character's `intro` scene onward. Remove any location names, event details, or relationship info not established by that point. |

**Warnings (fix if straightforward):**

| Check type | How to fix |
|---|---|
| `inference` | Remove qualifying language ("for now", "does not yet", "once", "last"). Rewrite in neutral present tense. |
| `description` (warning) | If the flagged claim is unsupported by any summary, remove it. If it's a minor wording issue, rephrase. |
| `existence` (warning) | Fix `intro` fields to match the earliest scene where the entity actually appears in a summary. |

Always use the `suggestion` field from the review as a starting point, but verify it makes sense in context.

### From `review-continuity.json`

Handle each issue by type:

| Issue type | How to fix |
|---|---|
| `missing_character` | Add the character ID to the scene's `chars` array. If the character has no entry in `characters.json` meta, create one with an appropriate `intro`, `role`, `name`, `short`, and `color`. |
| `missing_location` | Add the location ID to the scene's `locs` array. If the location has no entry in `locations.json` meta, create one with an appropriate `intro`, `name`, `icon`, and `type`. |
| `broken_reference` | Fix the ID to point to a valid chunk, or create the missing entry. |
| `description_regression` | Edit the later description to incorporate the dropped facts from the earlier description. Preserve cumulative knowledge. |
| `incomplete_coverage` | Add description entries for entities that lack them. For characters in 5+ scenes with only 1 description, add at least one progression entry at a meaningful turning point. Use summaries to determine what new information is learned. |
| `structural_error` | Fix the structural issue (reorder percentages, correct part indices, deduplicate IDs). |

### Conflict resolution

When a spoiler fix and a continuity fix conflict (e.g., spoiler review says to remove info, continuity says a description dropped it), **the spoiler fix wins**. Spoiler-freedom is the top priority. The dropped fact should be added at a later description entry where it IS supported by summaries.

## Process

1. Read all review files and data files
2. Group fixes by file (chunks.json, characters.json, locations.json)
3. Apply all fixes
4. Cross-check: after all fixes, verify every ID in chunks.chars/locs exists in the corresponding meta
5. Verify no description `from` field references a non-existent chunk ID

## Output

After applying fixes:

1. Write the updated data files
2. Write a fix summary to `data/<book-slug>/fix-log.json`:

```json
{
  "fixes_applied": 12,
  "spoiler_errors_fixed": 5,
  "spoiler_warnings_fixed": 4,
  "continuity_fixes": 3,
  "skipped": [
    {
      "reason": "Conflicting with spoiler fix",
      "detail": "Description regression for INTENDED at P3-08 — the 'family disapproval' fact was flagged as unsupported by spoiler review"
    }
  ]
}
```

3. Report what was changed so the human can review

## After This Stage

Run validation: `python tools/validate.py <book-slug>`

If validation fails, fix the issue and re-validate. The data should be clean after this stage.
