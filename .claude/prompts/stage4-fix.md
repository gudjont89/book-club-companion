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
| `description` | Identify the offending fact(s) in the `facts` array where `established` is after the description's `from` scene, or where the claim is unsupported. Remove those facts from the array, regenerate `desc` from the remaining facts. If the removed fact is valid at a later scene, add it to a description entry at that later scene instead. |
| `role` | Rewrite the role to be safe from the character's `intro` scene onward. Remove any location names, event details, or relationship info not established by that point. |

**Warnings (fix if straightforward):**

| Check type | How to fix |
|---|---|
| `inference` | Remove qualifying language ("for now", "does not yet", "once", "last"). Rewrite in neutral present tense. |
| `description` (warning) | If the flagged fact is unsupported by any summary, remove it from `facts` and regenerate `desc`. If it's a `desc` wording issue (fact is valid but prose is misleading), rephrase `desc` only. |
| `existence` (warning) | Fix `intro` fields to match the earliest scene where the entity actually appears in a summary. |

Always use the `suggestion` field from the review as a starting point, but verify it makes sense in context.

### From `review-continuity.json`

Handle each issue by type:

| Issue type | How to fix |
|---|---|
| `missing_character` | Add the character ID to the scene's `chars` array. If the character has no entry in `characters.json` meta, create one with an appropriate `intro`, `role`, `name`, `short`, and `color`. |
| `missing_location` | Add the location ID to the scene's `locs` array. If the location has no entry in `locations.json` meta, create one with an appropriate `intro`, `name`, `icon`, and `type`. |
| `broken_reference` | Fix the ID to point to a valid chunk, or create the missing entry. |
| `description_regression` | Add the missing fact(s) back into the later description's `facts` array (copy from the earlier entry), then regenerate `desc` to include them. |
| `incomplete_coverage` | Add description entries for entities that lack them. Each new entry needs `from`, `desc`, and `facts`. For characters in 5+ scenes with only 1 description, add at least one progression entry at a meaningful turning point — use summaries to determine what new facts are learned. |
| `structural_error` | Fix the structural issue (reorder percentages, correct part indices, deduplicate IDs). |

### Conflict resolution

When a spoiler fix and a continuity fix conflict (e.g., spoiler review says to remove a fact, continuity says a description dropped it), **the spoiler fix wins**. Spoiler-freedom is the top priority. Remove the fact from the current description's `facts` array. Then find the earliest later description entry where the fact IS supported by summaries, and add it there. If no later entry exists, create one.

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

## Verify and Loop

After applying fixes, verify the data is clean. If not, loop.

### Iteration 1 (always runs)

1. Apply all fixes from review files (as described above)
2. Write updated data files and `fix-log.json`
3. Run validation: `docker compose run --rm tools validate.py <book-slug>`
4. If validation fails, fix the issue immediately
5. Re-run the spoiler review (Stage 2) and continuity review (Stage 3b) on the updated data
6. If both reviews produce empty arrays `[]`, **stop — the data is clean**
7. If new issues were found, proceed to iteration 2

### Iteration 2+ (only if issues remain)

1. Read the new review outputs
2. Apply fixes using the same rules above
3. Write updated data files, append to `fix-log.json`
4. Run validation
5. Re-run reviews
6. If clean, stop. Otherwise, continue.

### Iteration cap

**Stop after 3 iterations maximum.** If issues remain after 3 rounds:
1. Write the remaining issues to `data/<book-slug>/fix-remaining.json`
2. Note in `fix-log.json`: `"status": "incomplete"` and `"remaining_issues": N`
3. These will need human review

### Why loop?

Fixes can introduce new issues. For example:
- Adding a missing character to a scene's `chars` array may require creating a new meta entry, which needs an `intro` and description — if the description is wrong, the next review catches it
- Rewriting a description to remove a spoiler may drop a fact that the continuity review then flags as a regression
- Moving a detail to a later description entry may trigger a new existence check

Most books will be clean after iteration 1. The loop is a safety net.

### Re-review scope

On iterations 2+, you only need to re-review **the scenes and entities you touched** in the previous iteration. You don't need to re-review the entire book. Specifically:
- Run the spoiler review only on scenes where descriptions, roles, or `chars`/`locs` arrays were modified
- Run the continuity review only on entities whose descriptions were modified
- Always re-run structural validation on the full dataset (it's fast)
