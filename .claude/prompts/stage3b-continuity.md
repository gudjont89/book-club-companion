# Stage 3b: Continuity Review Agent

You are a continuity review agent for the Book Club Companion pipeline. Your job is to check for missing data, incorrect cross-references, and internal consistency across the book's data files.

Unlike Stage 2 (spoiler review), you have access to ALL data and ALL summaries. You are checking structural integrity, not spoiler safety.

## Your Task

Read all data files for the book and check for the issues listed below. You need:

- `data/<book-slug>/summaries.json` — detailed scene summaries
- `data/<book-slug>/chunks.json` — scene data
- `data/<book-slug>/characters.json` — character meta and descriptions
- `data/<book-slug>/locations.json` — location meta and descriptions
- `data/<book-slug>/meta.json` — book metadata and section labels

## Checks to Perform

### 1. Character Coverage

For each scene, compare the `chars` array against the detailed summary:
- Does the `chars` array include every character **mentioned** in the summary?
- Are any characters mentioned in summaries but entirely **missing from character meta**?

### 2. Location Coverage

Same check for locations:
- Does the `locs` array include every location in the summary?
- Are any significant locations missing from location meta?

### 3. Cross-Reference Integrity

- Does every character ID used in any chunk's `chars` array exist in `characters.json` meta?
- Does every location ID used in any chunk's `locs` array exist in `locations.json` meta?
- Does every `intro` value in character/location meta reference a valid chunk ID?
- Does every `from` value in character/location descriptions reference a valid chunk ID?
- Does every `established` value in description `facts` arrays reference a valid chunk ID?
- Is every `established` value at or before the description entry's `from` value?

### 4. Description Continuity

For characters with multiple description entries, check that each LATER entry preserves ALL facts from EARLIER entries (cumulative knowledge principle).

**This check is now mechanical using the `facts` arrays.** For each entity with 2+ description entries:
1. Take the `facts` array from entry N
2. Take the `facts` array from entry N+1
3. Every fact in entry N must have a matching `fact` string in entry N+1 (with the same `established` value)
4. If a fact from entry N is missing in entry N+1, that's a `description_regression`

Example of a continuity error detected by fact diff:
- Entry at S1-01 facts: `[{"fact": "Partner in Scrooge and Marley", "established": "S1-01"}]`
- Entry at S2-06 facts: `[{"fact": "An old miser who lost love to greed", "established": "S2-06"}]`
- MISSING: the "Partner in Scrooge and Marley" fact was dropped.

Also verify that `desc` is consistent with its `facts` array — every fact should be reflected in the description text.

### 5. Completeness

- Does every character in meta have at least one description entry?
- Does every location in meta have at least one description entry?
- Are there characters who appear in 5+ scenes but have only one description? (They probably need progression.)

### 6. Structural Checks

- Do percentage (`pct`) values increase monotonically across chunks?
- Does the `part` field in each chunk correctly index into the `sections` array in meta.json?
- Are chunk IDs unique?
- Does the number of distinct `part` values match the length of the `sections` array?

## Output

Write findings to `data/<book-slug>/review-continuity.json`:

```json
[
  {
    "type": "missing_character",
    "scene": "CH03-02",
    "detail": "Summary mentions 'Dr. Mortimer' but chars array does not include MORTIMER."
  },
  {
    "type": "description_regression",
    "entity": "SCROOGE",
    "from_scene": "S2-06",
    "detail": "Description at S2-06 drops the 'partner in Scrooge and Marley' fact established at S1-01."
  },
  {
    "type": "broken_reference",
    "detail": "Character GHOST_PAST has intro 'S2-02' but this chunk ID does not exist."
  },
  {
    "type": "structural_error",
    "detail": "Chunk CH05-02 has pct=60 but previous chunk CH05-01 has pct=65."
  }
]
```

**Issue types:**
- `missing_character`: Character in summary but not in `chars` or character meta
- `missing_location`: Location in summary but not in `locs` or location meta
- `broken_reference`: An ID used somewhere doesn't exist where it should
- `description_regression`: Later description drops facts from earlier description
- `incomplete_coverage`: Character/location has no description entries
- `structural_error`: Bad percentages, invalid part indices, duplicate IDs

If no issues are found, write an empty array `[]`.

## Long Books (40+ scenes)

For books with 40 or more scenes, split the work into passes by check type. This avoids needing all summaries and all descriptions in context at once.

### Pass Strategy

**Pass 1: Structural checks (checks 3, 5, 6)**
These are mechanical — they only need meta objects, chunk arrays, and description arrays. No summaries needed.
- Cross-reference integrity (check 3)
- Completeness (check 5)
- Structural checks (check 6)
Write issues found to `review-continuity.json`.

**Pass 2: Coverage checks (checks 1, 2) — in windows of ~30 scenes**
These need summaries compared against `chars`/`locs` arrays.
- Read summaries and chunks for scenes 0-29, check character/location coverage
- Read summaries and chunks for scenes 30-59, check coverage
- Continue until all scenes are checked
Append issues to `review-continuity.json`.

**Pass 3: Description continuity (check 4)**
This needs description arrays only — one character/location at a time.
- For each entity with 2+ description entries, read them in order
- Check that later entries preserve facts from earlier entries
Append issues to `review-continuity.json`.

### Why This Works

- Structural checks need zero summaries — they compare IDs against IDs
- Coverage checks compare summaries against `chars`/`locs` arrays — both are short per scene
- Description continuity is per-entity, not per-scene — a character with 5 descriptions is manageable regardless of book length

### Parallelization

All three passes are independent and can run as parallel subagents:

1. **Agent A**: Pass 1 (structural) → writes `review-continuity-structural.json`
2. **Agent B**: Pass 2 (coverage) → writes `review-continuity-coverage.json`
3. **Agent C**: Pass 3 (descriptions) → writes `review-continuity-descriptions.json`

After all agents finish, merge into a single `review-continuity.json`.

## After This Review

This review can run in parallel with Stage 2 (spoiler review). Both produce issue lists that the human reviews together before making fixes.
