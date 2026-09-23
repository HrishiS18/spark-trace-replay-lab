# Spark Trace: consulting-domain extension

## Why this domain

The unit of study is not financial advice or investment performance. It is a **simulated, source-grounded consulting judgment**: a participant receives a small public-information case packet, explores it with their normal tools and an LLM, and writes a recommendation with evidence and caveats.

This creates a useful setting for sparks because the sources constrain factual claims, while the recommendation requires synthesis, prioritization, uncertainty management, and trade-offs. There is no single fully correct narrative.

**Example prompt**

> You are preparing a one-page diligence brief for a hypothetical client deciding which of two public companies merits deeper investigation. Recommend a priority, identify the two or three most decision-relevant signals, name one material uncertainty, and cite the supporting evidence. This is a research exercise, not investment advice.

Avoid live portfolios, personal financial information, personal accounts, and real clients. Use a time-bounded public corpus captured before the study.

## Dataset recommendation

Use the datasets as *evidence and task-construction resources*, not as the final “right answer” to the consulting task.

| Priority | Resource | What it contributes | Role in the study |
| --- | --- | --- | --- |
| 1 | [FinRank](https://github.com/datanxt/FinRank) | 1,185 manually authored records over recent 10-K/10-Q filings, gold passages, and curated confusable passages | Best seed for source comparison: hard negatives let you create realistic “this looks relevant but is not” moments |
| 2 | [FinanceBench](https://arxiv.org/abs/2311.11944) | Public 150-case evaluation set with expert-reviewed, page-level evidence; full collection is access-controlled | Best starter set for inspectable source packets and factual sub-questions |
| 3 | [Multi-Doc-2025](https://huggingface.co/datasets/Anonymous-Team-HC-RAG/Multi-Doc-2025) | 2,327 cross-company, cross-year, text/table questions from 179 10-Ks | Best source for comparative cases, temporal claims, and multi-document consultation |
| 4 | [TAT-QA](https://github.com/NExTplusplus/TAT-QA) and [FinQA](https://github.com/czyssrs/FinQA) | Text-plus-table and numerical reasoning examples | Use for a short calibration task, or to add a well-defined sub-analysis inside a broader recommendation case |
| 5 | Public [SEC EDGAR](https://www.sec.gov/search-filings) filings | Primary records, updated on a defined cutoff date | Use after the pilot to hand-author richer case packets and a rubric |

### Recommended first corpus: FinRank + FinanceBench

FinRank is especially attractive for a sparks study: it includes supporting passages and hard negatives that are confusable because they come from a different year, a similar company, or the same filing. Those are likely to produce observable *diagnostic*, *dissent*, and *error-triggered* moments. FinanceBench is a good complement because its open cases expose page-level evidence and expert answers, but its questions are intentionally clear-cut; do not mistake it for a consulting task itself.

### What to extract from a dataset record

Build each task packet from 6–12 short, immutable source items rather than giving participants unrestricted web access:

```text
case_id, company/companies, decision prompt, time cutoff
source_id, source type, company, fiscal period, URL/file hash, page/section
excerpt or table, evidence role (support | counterevidence | distractor | context)
known factual sub-question, answer, supporting source ids
rubric dimensions, task-author notes
```

The participant should see source identity, fiscal period, and page/section. The researcher keeps the evidence-role labels and factual keys hidden until analysis. That lets a study measure evidence use and misdirection without telling participants which source is “the answer.”

## 30-minute collection protocol

### 0. Prepare the sandbox

- Provide a browser profile containing only the case packet, a note editor, a calculator/spreadsheet, and one designated LLM.
- Freeze the source corpus and model/version. Log exact prompt/response text from the designated LLM.
- Obtain explicit consent for screen recording. Do not record notifications, other browser profiles, passwords, or personal accounts.

### 1. Brief (2 minutes)

Give the consulting decision, the deliverable, and a source-grounding norm: *every factual claim needs a cited source; recommendations may be uncertain.*

### 2. Work (25 minutes)

Participants research, calculate, compare, ask the LLM for help, and write a short recommendation. Capture the screen and the designated AI conversation.

### 3. Immediate review (3 minutes)

Ask the participant to mark one moment that “changed the direction of the work,” even if the cue was wrong. This reduces retrospective forgetting before the fuller replay.

### 4. Retrospective replay (10–15 minutes, separate from the 30-minute task)

Participants scroll a compressed timeline, inspect screenshots around selected moments, and create spark annotations. A spark can be tagged to a point or an interval.

## Making 30 minutes navigable

The [Workflow Induction Toolkit](https://github.com/zorazrw/workflow-induction-toolkit) provides a practical processing pattern: record raw computer-use events, merge duplicate actions, segment at state transitions, then semantically merge those segments into higher-level workflow steps. Its output should be used as a **navigation spine**, not as an automatic labeler of cognition.

### Timeline layers

| Layer | Shown to participant | Captured for analysis |
| --- | --- | --- |
| Filmstrip | Screenshot thumbnails at change points; expandable local context | Frame timestamps and redacted screenshot references |
| Workflow segments | “Compared FY23 vs FY24 revenue,” “Searched risk factors,” “Drafted recommendation” | Toolkit-generated segment boundaries, then researcher validation |
| Source activity | Company, filing period, page/section, table vs prose | Source open/search/scroll/highlight/copy events |
| AI activity | Prompt and response cards; “asked for source,” “asked for critique,” “asked for calculation” | Full designated-LLM turns and prompt-act tags |
| Draft activity | Claim created, revised, deleted; recommendation checkpoints | Draft revision diffs and claim-to-source links |
| Spark annotations | The two-layer annotation, free text, confidence, outcome | Source cue, point/interval, change, trigger(s), downstream moves |

### Fast filters and jump markers

Provide filters for **AI turns**, **source switches**, **new document**, **table/calculator use**, **draft claim revised**, **highlight/copy**, and **long pause**. Each workflow segment gets a short human-readable label and a confidence marker. Clicking one expands a 30–60 second local window instead of forcing someone to scrub the entire recording.

The UI should offer an “I remember a moment…” search that accepts participant language such as “when I realized the risk was from last year,” then searches segment labels, OCR text, source metadata, and AI turns. Results remain retrieval aids; the participant chooses whether a spark occurred.

## Annotation model

Every annotation joins three things:

```text
cue:       one or more AI turns, source views, or a time interval
change:    knowledge/search space | connections | representation |
           criteria/preferences | goal | self-understanding
trigger:   new information | analogy | error | disagreement |
           question | constraint | unexpected example
account:   participant’s own description of the shift
trace:     next source moves, AI turns, and draft changes
```

Example: a participant opens an FY2023 table after an LLM answer, notices the answer used a prior-year number, rewrites the claim, and marks **error → criteria/preferences**: “I stopped treating a fluent answer as evidence; fiscal period became a non-negotiable check.”

## What can be analyzed

Do not infer a spark solely from acceptance, cursor behavior, or screen content. The participant’s annotation is the construct measure; trace features make it inspectable.

Useful descriptive analyses include:

1. **Trigger–change combinations:** Which combinations recur by task phase? For example, are error-triggered criteria shifts concentrated during recommendation drafting?
2. **Downstream redirection:** Compare the next one to three human moves after a marked spark—new source, changed query, calculation, claim revision, or no visible change.
3. **Evidence discipline:** For each final claim, examine the source chain, whether it uses a gold/support passage or a confusable distractor, and whether counterevidence was consulted.
4. **Workflow topology:** Compare paths such as `source → AI → source → revision` with `AI → draft`, without treating either path as inherently better.
5. **Retrospective stability:** Compare immediate and replay annotations. A disappearing annotation is data about reflection and uncertainty, not necessarily an error.

Evaluate case outputs with a blinded rubric—source traceability, factual validity, calibration of uncertainty, treatment of counterevidence, and coherence of recommendation—not returns, trades, or real-world financial outcomes.

## Pilot recommendation

Start with 6–8 participants who can read financial reports but are not asked to act as licensed advisers. Use three hand-authored cases from two sectors; counterbalance case and LLM condition. Run one dry session with yourself first to validate that screenshots, AI logs, and source identifiers join correctly.

Success in the first pilot is not proving a taxonomy. It is determining whether participants can locate and articulate meaningful sparks in a 30-minute trace without excessive annotation burden.

## Critical implementation boundary

The toolkit’s recorder requires operating-system accessibility permissions. Do not enable a broad recorder on a participant’s normal desktop. Use a dedicated study machine/profile or a consented, scope-limited browser recorder, make the capture indicator visible, and offer a review/delete step before any research upload.
