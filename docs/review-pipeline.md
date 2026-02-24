# Book Club Companion — Automated Review Pipeline

## Purpose

This document describes a three-stage agent pipeline for producing and validating the data that powers a Book Club Companion page. The goal is to automate as much of the extraction and review work as possible, with particular focus on preventing spoilers and continuity errors.

The pipeline takes a raw `.epub` file as input and produces validated, spoiler-checked JSON data ready to embed in the HTML template.

---

## The Core Problem

The annotation agent needs to have read the entire book to do its job — it must know that Silver is a pirate to correctly tag the apple-barrel scene, and it must know Tiny Tim survives to write Scrooge's final description accurately.

But the spoiler review needs to evaluate each piece of reader-facing text *as if the reviewer hasn't read ahead*. These are fundamentally different cognitive tasks. Asking one agent to do both simultaneously is where spoilers leak in — the annotator's full knowledge bleeds into descriptions and summaries intended for readers who haven't finished the book.

The solution is to separate the roles and, critically, to *restrict what the review agent can see*.

---

## Pipeline Overview

```
epub file
  │
  ├─ [code] Extract chapter text from XHTML
  │
  ├─ Stage 1: Annotation Agent
  │    Input:  full book text + data structure spec
  │    Output: complete data + detailed scene summaries
  │
  ├─ Stage 3a: Summary Coverage Pass
  │    Input:  full book text + detailed summaries
  │    Output: summary gaps → fix before Stage 2
  │
  ├─ Stage 2: Scene-by-Scene Spoiler Review
  │    Input:  for each scene N, detailed summaries and data visible at position N
  │    Output: list of flagged spoiler issues per scene
  │
  ├─ Stage 3b: Continuity Review
  │    Input:  detailed summaries + complete data
  │    Output: list of missing/incorrect entries
  │
  ├─ [human] Review flagged issues, make judgement calls
  │
  └─ Final validated data → embed in HTML template
```

Stage 3a runs before Stage 2 (because Stage 2 depends on summary completeness). Stages 2 and 3b can run in parallel. All stages produce issue lists that a human reviews before the data is finalised.

---

## The Intermediate Artefact: Detailed Scene Summaries

Stage 1 produces an additional output beyond the six data constants: a **detailed summary** for every scene. These are longer than the micro summaries (a full paragraph per scene, typically 100–250 words) and explicitly name every character present, every location used, every key event, and every piece of information revealed.

Stages 2 and 3b work from these summaries rather than from the raw book text. This has three advantages:

**It's cheaper.** A detailed summary is 100–250 words versus 2,000–4,000 words of raw prose per scene. For a 26-scene book, the cumulative input for Stage 2 drops from ~350,000 tokens to roughly 40,000–60,000.

**It's more reliable.** The review agent has less noise to parse. When checking whether a description is supported by what's happened so far, it's easier to cross-reference against 15 concise factual summaries than against 30,000 words of Victorian prose.

**It separates concerns cleanly.** The summaries surface all the factual content — who appears, what happens, what's revealed — without the literary texture that makes raw text harder for an agent to reason about precisely.

The risk is that a summary might omit something present in the source text. This is addressed by Stage 3a, which compares summaries against the full text before Stage 2 runs.

### What Makes a Good Detailed Summary

A detailed summary should be a factual account of everything that happens in the scene, written for an agent rather than a reader:

- Name every character who appears, speaks, or is discussed
- Name every location where action takes place
- State every event, reveal, decision, or change of status
- Note any new information learned about existing characters (backstory, relationships, motivations)
- Note any character or location introduced for the first time

Example (S3-03, Christmas Carol):

> The Ghost of Christmas Present takes Scrooge to the Cratchit home. Bob Cratchit arrives carrying Tiny Tim on his shoulder. Tiny Tim is small, disabled, and walks with a crutch — this is his first appearance. Mrs. Cratchit, Martha Cratchit, Peter Cratchit, and Belinda Cratchit are also present — all introduced here. The family prepares a modest Christmas dinner (goose, pudding) with enormous excitement despite their poverty. Bob's devotion to Tiny Tim is evident. Martha works at a milliner's and arrives late. Peter wears Bob's hand-me-down shirt collar. The scene establishes the Cratchit family's warmth, love, and poverty.

---

## Stage 1: Annotation Agent

### Role

Read the full book and produce all six data structures plus detailed scene summaries. This agent has unrestricted access and doesn't try to avoid spoilers — its job is accuracy and completeness.

### Input

- Full extracted chapter text (from the epub extraction step)
- The data structure specification (from the epub processing guide)
- Book-specific instructions (section naming conventions, any known character groupings, special badges)

### Prompt Design

The annotation agent works best as a single long-context call. The prompt should:

1. Provide the full book text
2. Provide the exact data structure format with field definitions
3. Ask the agent to read the entire text before producing any output
4. Request all six constants plus the detailed summaries in a single response
5. Include explicit instructions about the cumulative-knowledge principle for descriptions

Key instructions to include:

> Character and location descriptions must reflect cumulative knowledge — what a reader has learned about this entity up to this point — not what is happening in the current scene. Each description should read like a reference card that builds over time.

> For each scene, produce a detailed summary (100–250 words) that names every character present, every location, and every event or reveal. These summaries will be used by review agents who have not read the source text, so they must be factually complete.

### Output

- The six JavaScript constants: CHUNKS, CHAR_META, CHAR_DESCS, LOC_META, LOC_DESCS, and the section labels array
- A detailed_summaries array: one entry per chunk, containing the full factual summary

### Cost Estimate

One large API call. For a typical novel (60,000–100,000 words), the input is roughly 20,000–35,000 tokens of book text plus ~2,000 tokens of spec. Output is typically 5,000–12,000 tokens (larger than without summaries). At current pricing, roughly $0.15–$0.40 per book.

---

## Stage 3a: Summary Coverage Pass

### Role

Before Stage 2 can run, verify that the detailed summaries are complete. This is the only step that uses the full book text after Stage 1.

### Input

- Full book text
- Detailed summaries from Stage 1

### Review Question

> For each scene, compare the detailed summary against the raw chapter text. Does the summary mention every character who appears, speaks, or is discussed? Does it mention every location? Does it capture every significant event or reveal?

### Output

A list of **summary_gap** issues:

```json
{
  "scene": "S3-03",
  "type": "summary_gap",
  "detail": "The summary does not mention the two youngest Cratchit children who appear briefly during the dinner scene."
}
```

### What to Do With Gaps

Fix the detailed summaries before running Stage 2. This may mean re-running part of Stage 1 for specific scenes, or manually adding the missing content. The point is that Stage 2's restricted-context approach only works if the summaries contain all the facts.

### Cost Estimate

One large API call, comparable to Stage 1. Roughly $0.10–$0.30.

---

## Stage 2: Scene-by-Scene Spoiler Review

### Role

For each scene in the book, verify that everything a reader at that position would see is free of spoilers. The review agent operates under a strict information restriction: it only receives summaries and data up to and including the scene it's reviewing.

### Why Restricted Context Matters

If the review agent has access to the full book, it cannot reliably detect spoilers — it already knows what happens and will read descriptions as "accurate" rather than "premature." By restricting its context to scenes 0 through N, the agent can only evaluate claims against information available at position N. If something in the data can't be supported by the summaries the agent has seen, it flags it.

This mirrors the reader's experience exactly: the reader at position N has only read scenes 0 through N, and the app should show them nothing that requires knowledge beyond that.

### Input (per scene)

For scene at index N, the review agent receives:

**Detailed summaries** (truncated):
- Detailed summaries for scenes 0 through N only
- No summaries beyond N are included

**Data visible at position N:**
- All chunk entries from 0 to N (id, title, micro summary, chars, locs)
- All CHAR_META entries where `intro` is at or before position N
- For each visible character, the active CHAR_DESCS entry (the latest `from` at or before N)
- All LOC_META entries where `intro` is at or before position N
- For each visible location, the active LOC_DESCS entry

### Review Questions

The agent evaluates four specific questions for each scene:

**1. Description Spoiler Check**

> Do any character or location descriptions currently visible at position N contain information that is not supported by the detailed summaries of scenes 0 through N?

This catches the "devoted father" problem — a description that's factually correct but draws on information from later in the book. The review agent, having only seen summaries through scene N, will flag any claim it can't verify.

**2. Existence Spoiler Check**

> Are any characters listed in the `chars` arrays of scenes 0 through N that don't have a CHAR_META entry with `intro` at or before N? Same for locations.

This catches tagging errors where a character is marked as present in a scene before they're formally introduced.

**3. Role and Badge Check**

> Do any character `role` descriptions or `badge` labels hint at future events or imply knowledge beyond position N?

This catches things like a role that says "will betray the expedition" or a badge that says "eventually revealed as the villain." Roles and badges are always visible once the character is introduced, so they must be safe from the first appearance onward.

**4. Inference Check**

> Could a reader at position N infer something about future events from the way any description is worded? Look for qualifying language ("once," "former," "before the change"), comparative framing ("at this point still..."), or tonal hints that imply a trajectory.

This is the subtlest check and the most likely to produce false positives. It catches descriptions like "an old miser who will learn the error of his ways" (obvious) but also softer cases like "an old miser — for now" (the "for now" implies change is coming).

### Output (per scene)

A structured list of issues, each with:

- Scene index where the issue is visible
- The specific text that's problematic
- Which check flagged it (description, existence, role, or inference)
- Severity: **error** (definite spoiler or data inconsistency) or **warning** (possible spoiler, needs human judgement)
- Suggested fix (if applicable)

Example:

```json
{
  "scene": 5,
  "check": "description",
  "severity": "error",
  "text": "Bob Cratchit — CHAR_DESCS at S1-01: 'A devoted father'",
  "reason": "Nothing in summaries for scenes 0–5 mentions Bob having children.",
  "suggestion": "Change to: 'Scrooge's clerk. Poorly paid, works in freezing conditions.'"
}
```

### Execution

This stage runs N times, once per scene. Each call is independent, so they can run in parallel.

Because the agent works from detailed summaries rather than raw text, each call is lightweight. The first call (scene 0) contains one summary (~200 words) plus the data visible at position 0. The last call (scene 25) contains all 26 summaries (~5,000 words) plus all visible data. Total input across all 26 calls for a Christmas Carol-sized book is roughly 40,000–60,000 tokens. At current pricing, roughly $0.15–$0.30 for the full sweep.

### Optimisation

Not every scene needs a full review. You can reduce costs by only running the full four-question review at scenes where new descriptions activate:

- If scene N doesn't trigger any new CHAR_DESCS or LOC_DESCS entries and doesn't introduce new characters or locations, the only new reader-facing content is the micro summary. A lighter check (question 2 only — existence check) suffices.
- If scene N introduces new characters or locations, or activates new descriptions, run the full review.

This typically reduces the number of full reviews to roughly the number of description entries across all characters and locations — often 30–60% of N.

---

## Stage 3b: Continuity Review

### Role

Check for missing data, incorrect cross-references, and internal consistency. This agent works from the detailed summaries and complete data.

### Input

- Detailed summaries for all scenes
- Complete data from Stage 1 (all six constants)

### Review Questions

**1. Character Coverage**

> For each scene, does the `chars` array include every character mentioned in the detailed summary? Are any characters missing entirely from CHAR_META?

**2. Location Coverage**

> For each scene, does the `locs` array include every location mentioned in the detailed summary? Are any significant locations missing from LOC_META?

**3. Cross-Reference Integrity**

> Does every character ID used in any CHUNKS `chars` array exist in CHAR_META? Does every location ID in `locs` exist in LOC_META? Does every `intro` and `from` value reference a valid chunk ID?

**4. Description Continuity**

> For characters with multiple CHAR_DESCS entries, does each later entry preserve the information from earlier entries (cumulative knowledge)? Or does a later description accidentally drop something established earlier?

Example of a continuity error: At S1-01, Scrooge is described as "partner in Scrooge and Marley." At S2-06, the description says "an old miser who lost love to greed" but doesn't mention the partnership. The partnership fact should carry through.

**5. Completeness**

> Does every character in CHAR_META have at least one entry in CHAR_DESCS? Same for locations. Are there any characters who appear in 5+ scenes but have only one description entry (suggesting they might need description progression)?

**6. Structural Checks**

> Do percentage values increase monotonically? Does the `part` field in CHUNKS correctly index into the section labels array? Are chunk IDs unique and sortable in reading order?

### Output

A structured list of issues with continuity-specific categories:

- **missing_character**: Character in summary but not in `chars` or CHAR_META
- **missing_location**: Location in summary but not in `locs` or LOC_META
- **broken_reference**: ID used in CHUNKS doesn't exist in META
- **description_regression**: Later description drops facts from earlier description
- **incomplete_coverage**: Character/location has no description entries
- **structural_error**: Bad percentage values, invalid part indices, duplicate IDs

### Execution

One lightweight API call using summaries and data. Much cheaper than a full-text call — roughly $0.05–$0.15.

---

## Human Review

Stages 2 and 3b produce issue lists. A human reviews these and makes final decisions.

### What Requires Human Judgement

**Inference warnings from Stage 2.** The subtlest spoiler category — cases where a description doesn't state a future event but uses language that might prime a reader's expectations. The automated review will flag these as warnings, but many will be false positives. A human needs to decide: would a reader actually infer anything, or is the phrasing natural?

**Description tone.** A description that says "Scrooge's clerk" is safe but cold. One that says "Scrooge's long-suffering clerk" implies the reader should feel sympathy, which might colour their reading. Whether this is appropriate is a judgement call.

**Scene boundary decisions.** If Stage 3b flags that a chapter has two very different settings and might need splitting, a human should decide whether the narrative flow warrants separate chunks or a combined one.

### What the Pipeline Handles Automatically

- Cross-reference integrity (broken IDs, missing entries)
- Character/location coverage (missing tags)
- Summary completeness against source text
- Obvious spoilers in descriptions (referencing events that haven't occurred)
- Description continuity (dropped facts)
- Structural validation (percentages, indices, uniqueness)

For a typical novel, the automated pipeline should catch 80–90% of issues, leaving the human to focus on the 10–20% that require genuine literary judgement.

---

## Running the Pipeline

### Prerequisites

- An AI API with long-context support (100k+ tokens for Stage 1 on longer novels)
- The epub processing guide (provides the data structure spec for Stage 1's prompt)
- The epub already extracted to chapter text files

### Execution Order

1. Run Stage 1 (annotation). Produces raw data and detailed summaries.
2. Run Stage 3a (summary coverage against full text). Fix any summary gaps.
3. Run Stage 2 (spoiler review) and Stage 3b (continuity review) in parallel.
4. Merge issue lists from Stages 2 and 3b.
5. Human reviews issues, makes fixes.
6. Optionally re-run Stage 2 on any scenes where descriptions were changed, to verify fixes don't introduce new issues.
7. Embed finalised data in HTML template.

Running the summary coverage pass (step 2) before Stage 2 is important. If the summaries have gaps, Stage 2 can't reliably detect spoilers or missing tags in those scenes.

### Cost Summary

| Stage | Calls | Approximate Cost (typical novel) |
|-------|-------|----------------------------------|
| Extraction | 0 (code only) | Free |
| Stage 1: Annotation | 1 | $0.15 – $0.40 |
| Stage 3a: Summary Coverage | 1 (full-text) | $0.10 – $0.30 |
| Stage 2: Spoiler Review | N (one per scene, using summaries) | $0.15 – $0.30 |
| Stage 3b: Continuity Review | 1 (summary-based) | $0.05 – $0.15 |
| **Total** | **N + 3** | **$0.45 – $1.15** |

For a 30-scene novel at current API pricing. Significantly cheaper than the raw-text approach because Stages 2 and 3b work from summaries.

### Re-running After Fixes

If human review results in changes to descriptions or micro summaries, re-run Stage 2 only for the affected scenes (and any scenes after them where the changed data might be visible). This is typically 2–5 calls, not a full re-run.

---

## Limitations

### What This Pipeline Does Not Catch

**Subtle thematic foreshadowing.** A description that says "Scrooge's cold, dark chambers" is factually accurate at S1-03, but a literary reader might note the emphasis on darkness as foreshadowing the ghost visits. The pipeline can't reliably distinguish between atmospheric description and thematic spoiler.

**Cultural knowledge spoilers.** For extremely well-known books, the character names themselves are spoilers of a sort — everyone knows Tiny Tim is associated with a tragic storyline. The pipeline can't account for what readers already know from cultural osmosis.

**Adaptation spoilers.** If a reader has seen a film adaptation, certain character introductions might carry implicit spoilers. This is outside the pipeline's scope.

**Quality of writing.** The pipeline validates that descriptions are spoiler-free and consistent, but not that they're well-written, engaging, or at the right level of detail. Writing quality remains a human concern.

**Edge cases in chapterless books.** Identifying scene boundaries in books without chapter breaks requires narrative judgement that the extraction code can't automate. The human still needs to define chunk boundaries for these books, though the annotation and review stages work the same way once boundaries are set.

**Summary completeness.** The pipeline's ability to catch spoilers and tagging errors depends on the quality of the detailed summaries. Stage 3a exists to catch gaps, but if a summary omits a subtle detail (a character mentioned in passing, a location referenced but not visited), that gap may propagate. This is the main argument for running Stage 3a early and fixing gaps before Stage 2.

### False Positive Rate

Stage 2's inference check (question 4) will produce false positives. Roughly 30–40% of inference warnings are expected to be acceptable phrasing that wouldn't actually spoil anything for a reader. This is deliberate — the check is conservative. It's better to flag something for human review than to let a spoiler through.

The other three checks in Stage 2 and all checks in Stage 3b have very low false positive rates (under 5%), since they're checking factual claims against available summaries rather than making judgement calls about implication.
