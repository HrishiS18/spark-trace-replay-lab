# Spark Trace Replay Lab

Spark Trace Replay Lab is a local-first research prototype for studying moments when an AI interaction redirects a person's thinking: a **spark**.

It records a focused desktop session, replays it locally, proposes moments worth reviewing, and lets the participant decide whether any moment was actually a spark. No video is uploaded by the tool.

## What participants do

1. Record a focused task session with Codex or another LLM.
2. Save the local WebM recording when the session ends.
3. Save the paired session-alignment manifest alongside the video.
4. Replay the video and review automatically proposed moments.
5. Confirm, edit, or dismiss each candidate; only confirmed items become spark annotations.
6. Export the annotations JSON and keep it next to the video.

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

- marked visual changes in the sampled screen video (including subtle chat/document changes, ranked relative to the recording);
- imported workflow events, including AI turns, source transitions, corrections, long gaps, rapid switching, and activity-boundary changes.

These are retrieval prompts only. The system does not claim that a cognitive spark occurred. When a video has no detectable visual change or workflow trace, the queue provides clearly labelled, evenly spaced **replay checkpoints** so participants can still navigate a long recording without watching every minute. Participants can review a candidate, adjust its timing, annotate it as a spark, or dismiss it. The export retains all candidate dispositions for later analysis.

## Optional workflow companion

Spark Trace directly supports the native nested `workflow.json` produced by the [Workflow Induction Toolkit](https://github.com/zorazrw/workflow-induction-toolkit). It extracts each high-level node, aggregates the timestamps of its descendant actions, retains its status and screenshot-path evidence, and places the resulting workflow steps on the video timeline.

The screen recording and computer-use trace are separate capture streams. The Toolkit uses absolute event timestamps; the browser video uses relative playback time. Spark Trace bridges them through a session-alignment manifest.

### Full paired capture

1. Start `crec` from the Toolkit on a dedicated, consented study desktop.
2. Start a Spark Trace recording. It stores the wall-clock start time locally.
3. Work normally, then stop the Spark Trace recording.
4. Save **both** `spark-trace-recording.webm` and **Save session alignment manifest**.
5. Process the Toolkit trace into its native `workflow.json` following the Toolkit instructions.
6. In Replay Lab, load the saved video, then **Load session alignment manifest**, then **Import workflow.json**.

The imported steps should appear in the right-hand workflow list at their matching video times. The candidate queue then derives evidence-backed prompts from those steps: AI interactions, source transitions, corrections, pauses, rapid switching, and workflow boundaries.

If the manifest and video do not belong to the same session, the interface refuses to place out-of-range steps rather than silently creating misleading markers.

### Fixture for integration testing

`fixtures/workflow-induction-workflow.json` has the real nested node shape expected from the Toolkit; `fixtures/spark-trace-session.json` supplies its matching video start time. With a test video at least 93 seconds long, importing both files places the three fixture steps at approximately `00:11`, `00:38–00:45`, and `01:24–01:32`.

For a self-contained browser smoke test of the adapter, serve this repository and open <http://127.0.0.1:5173/tests/workflow-integration.html>. It generates a synthetic three-second video locally, imports a native nested Toolkit fixture and matching manifest, checks the three aligned markers, and exercises candidate confirmation.

## Data handling

- Video stays in the browser until the participant clicks **Save captured recording**.
- Annotation export does not embed the video.
- Use a dedicated study workspace; do not record personal messages, credentials, or unrelated windows.
- Obtain consent and establish storage/de-identification procedures before collecting research data.
- The Workflow Induction Toolkit can pass event-linked screenshots to a configured LLM while inducing and summarizing workflows. Review its model, API, retention, and consent configuration before using it with participant data.

For a consulting-oriented study protocol and dataset ideas, see [consulting-extension.md](./consulting-extension.md).
