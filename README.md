# Spark Trace Replay Lab

Spark Trace Replay Lab is a local-first research prototype for studying moments when an AI interaction redirects a person's thinking: a **spark**.

It records a focused desktop session, replays it locally, proposes moments worth reviewing, and lets the participant decide whether any moment was actually a spark. No video is uploaded by the tool.

## What participants do

1. Record a focused task session with Codex or another LLM.
2. Save the local WebM recording when the session ends.
3. Replay the video and review automatically proposed moments.
4. Confirm, edit, or dismiss each candidate; only confirmed items become spark annotations.
5. Export the annotations JSON and keep it next to the video.

The interface separates:

- **What changed in thinking:** knowledge/search space, connections, representation, criteria/preferences, goal, or self-understanding.
- **What triggered it:** new information, analogy, error, disagreement, question, constraint, or unexpected example.

This permits annotations such as an *error-triggered representational spark* without treating the labels as one flat, mutually exclusive taxonomy.

## Run locally

This is a static HTML/CSS/JavaScript project; there is no install or build step.

```bash
cd spark-trace-replay-lab
python3 -m http.server 5173
```

Open <http://127.0.0.1:5173/replay.html>.

Use a local server rather than double-clicking the file: browser screen capture is more dependable from `localhost`.

## Review prompts are not labels

The replay page generates a **Candidate moments to consider** queue. It can propose moments from:

- marked visual changes in the sampled screen video;
- imported workflow events, including AI turns, source transitions, corrections, long gaps, rapid switching, and activity-boundary changes.

These are retrieval prompts only. The system does not claim that a cognitive spark occurred. Participants can review a candidate, adjust its timing, annotate it as a spark, or dismiss it. The export retains all candidate dispositions for later analysis.

## Optional workflow companion

The [Workflow Induction Toolkit](https://github.com/zorazrw/workflow-induction-toolkit) can produce a `workflow.json` from a separately captured, consented computer-use trace. Import that file in the right-hand **Workflow navigation** panel to create jump markers and richer review prompts.

The screen recording and computer-use trace are separate capture streams. Align them by starting both at the beginning of the task and keeping a session ID with the recording, workflow file, and annotation export.

## Data handling

- Video stays in the browser until the participant clicks **Save captured recording**.
- Annotation export does not embed the video.
- Use a dedicated study workspace; do not record personal messages, credentials, or unrelated windows.
- Obtain consent and establish storage/de-identification procedures before collecting research data.

For a consulting-oriented study protocol and dataset ideas, see [consulting-extension.md](./consulting-extension.md).
