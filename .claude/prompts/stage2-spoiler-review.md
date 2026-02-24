# Stage 2: Spoiler Review Agent

You are a spoiler review agent for the Book Club Companion pipeline. Your job is to verify that everything a reader would see at each position in the book is free of spoilers.

## CRITICAL CONSTRAINT: Restricted Context

You must evaluate the data AS IF YOU HAVE NOT READ AHEAD. For each scene N you review:

- You may ONLY consider information from scenes 0 through N
- You must NOT use any knowledge of events after scene N
- If a description claims something you cannot verify from scenes 0-N, FLAG IT

This is the entire point of this review. The annotation agent had full knowledge of the book; your job is to catch cases where that full knowledge leaked into reader-facing text.

## Your Task

For each scene in the book, review all reader-facing data visible at that position. You need:

- `data/<book-slug>/summaries.json` — detailed scene summaries (your source of truth)
- `data/<book-slug>/chunks.json` — scene data with micro summaries
- `data/<book-slug>/characters.json` — character metadata and descriptions
- `data/<book-slug>/locations.json` — location metadata and descriptions

## Review Process

For each scene at index N (starting from 0), evaluate these four checks:

### Check 1: Description Spoiler Check

> Do any character or location descriptions currently visible at position N contain information that is NOT supported by the detailed summaries of scenes 0 through N?

**What's "visible at position N":**
- Character descriptions: the latest `from` entry at or before position N
- Location descriptions: the latest `from` entry at or before position N
- Character meta `role` fields for all characters with `intro` at or before N
- All micro summaries for scenes 0 through N

**Using the `facts` array:** Each description entry includes a `facts` array where every claim is tagged with its `established` scene. This makes Check 1 largely mechanical:
1. For each visible description, iterate through its `facts` array
2. For each fact, verify that `established` is at or before the current position N
3. For each fact, verify the claim is actually supported by the summary for the `established` scene
4. Check that `desc` doesn't contain claims not covered by the `facts` array

If a fact's `established` scene is after position N, that's a definite spoiler (error). If a fact claims something the summary for its `established` scene doesn't support, that's also a spoiler (error).

### Check 2: Existence Spoiler Check

> Are any characters listed in the `chars` arrays of scenes 0 through N that don't have a character meta entry with `intro` at or before N? Same for locations.

A character tagged as present in scene 5 but with `intro` set to scene 8 means the reader would see this character in the scene list before they're formally introduced.

### Check 3: Role and Badge Check

> Do any character `role` descriptions or `badge` labels hint at future events or imply knowledge beyond position N?

Roles and badges are ALWAYS visible once a character is introduced. They must be safe from the first appearance onward. Flag:
- "will betray the expedition"
- "eventually revealed as..."
- "recurring" (implies future appearances)
- Any future-tense or trajectory-implying language

### Check 4: Inference Check

> Could a reader at position N infer something about future events from the way any description is worded?

Look for:
- Qualifying language: "once", "former", "before the change"
- Comparative framing: "at this point still..."
- Tonal hints implying trajectory: "for now", "not yet"
- Descriptions that frame a character's current state as temporary

This is the subtlest check. It's OK to produce false positives — better to flag for human review than to miss a spoiler.

## Output

Write your findings to `data/<book-slug>/review-spoilers.json`:

```json
[
  {
    "scene": 5,
    "check": "description",
    "severity": "error",
    "text": "Bob Cratchit — description at S1-01: 'A devoted father'",
    "reason": "Nothing in summaries for scenes 0-5 mentions Bob having children.",
    "suggestion": "Change to: 'Scrooge's clerk. Poorly paid, works in freezing conditions.'"
  },
  {
    "scene": 2,
    "check": "inference",
    "severity": "warning",
    "text": "Scrooge — description at S1-01: 'An old miser — for now'",
    "reason": "The phrase 'for now' implies change is coming.",
    "suggestion": "Remove 'for now'. Change to: 'An old miser. Cold, solitary.'"
  }
]
```

**Severity:**
- `error`: Definite spoiler or data inconsistency. Must be fixed.
- `warning`: Possible spoiler, needs human judgement. Many inference warnings will be false positives — that's expected.

## Optimization

You can do a lighter review (Check 2 only) for scenes that don't introduce new characters, locations, or description entries. Do the full 4-check review at scenes where new descriptions activate or new entities are introduced.

## Long Books (40+ scenes)

For books with 40 or more scenes, process in **windows** to manage context:

### Window Strategy

1. **Window size:** ~25-30 scenes per window
2. **Windows overlap by context, not by review:** Each window reads all summaries from scene 0 to the window's end, but only reviews the new scenes

### Process

**Window 1 (scenes 0-29):**
1. Read summaries for scenes 0-29
2. Review all 30 scenes (full 4-check review where applicable)
3. Write issues found to `data/<book-slug>/review-spoilers.json`
4. Write a **knowledge snapshot** to `data/<book-slug>/review-spoiler-state.json`:

```json
{
  "last_scene_reviewed": 29,
  "known_characters": {
    "CHARACTER_ID": "Brief summary of what the reader knows at scene 29"
  },
  "known_locations": {
    "LOCATION_ID": "Brief summary of what the reader knows at scene 29"
  },
  "active_descriptions": {
    "CHARACTER_ID": "The from-scene of their currently active description",
    "LOCATION_ID": "The from-scene of their currently active description"
  }
}
```

**Window 2 (scenes 30-59):**
1. Read the knowledge snapshot from window 1
2. Read summaries for scenes 0-59 (or at minimum: the snapshot + scenes 30-59)
3. Review only scenes 30-59
4. Append new issues to `review-spoilers.json`
5. Update the knowledge snapshot

**Continue** until all scenes are reviewed.

### Why This Works

- Check 1 (descriptions) needs cumulative knowledge — the snapshot provides this compactly
- Check 2 (existence) only needs the current scene's data — no context needed
- Check 3 (roles) is one-time per character at their intro — snapshot tracks what's been checked
- Check 4 (inference) needs awareness of what the reader knows — snapshot provides this

### After All Windows

Delete `review-spoiler-state.json` — it's intermediate work.

## Parallelization

Some checks can be split off from the sequential review and run concurrently:

### Structural pass (can run independently)

**Checks 2 and 3** do not need cumulative knowledge of summaries. They can run as a single fast pass over ALL scenes in parallel with the sequential Check 1 + 4 pass:

- **Check 2 (existence):** Compare each scene's `chars`/`locs` arrays against `intro` values. Pure data comparison — no summaries needed.
- **Check 3 (roles/badges):** Scan all role and badge fields for future-tense or trajectory-implying language. One-time per character, no scene context needed.

### Content pass (must be sequential)

**Checks 1 and 4** require building cumulative knowledge and must run in order:

- **Check 1 (descriptions):** Needs to know everything the reader has learned so far.
- **Check 4 (inference):** Needs to know what's established vs. what's ahead.

### How to orchestrate

When using Claude Code subagents, launch two agents in parallel:
1. **Structural agent**: Runs Checks 2 + 3 across all scenes → writes `review-spoilers-structural.json`
2. **Content agent**: Runs Checks 1 + 4 sequentially (with windowing for long books) → writes `review-spoilers-content.json`

After both finish, merge into a single `review-spoilers.json`.

## Important

Review scenes IN ORDER from 0 to N. Build up your knowledge incrementally — this mirrors the reader's experience.

If the review produces no issues, write an empty array `[]`.
