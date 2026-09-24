# Spark Trace Replay Lab

A local-first research interface for replaying LLM-supported work and annotating moments that redirected a participant’s thinking (“sparks”). Participants review suggested moments, then confirm or edit them; the tool does not infer sparks automatically.

## Run the Replay Lab

```bash
cd spark-trace-replay-lab
python3 -m http.server 5174
```

Open <http://localhost:5174/replay.html>. Record a session, save the video and session manifest, review candidate moments, add confirmed spark annotations, and export the annotations JSON.

## Automatic workflow labels

For labels such as AI interaction, source transition, correction, or workflow boundary, pair the video with the [Workflow Induction Toolkit](https://github.com/zorazrw/workflow-induction-toolkit).

One-time setup:

```bash
cd /path/to/parent-directory
git clone https://github.com/zorazrw/workflow-induction-toolkit.git
cd workflow-induction-toolkit
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ./computer-recorder
python -m pip install -r workflow-induction/requirements.txt
```

Before a recording, start the local companion:

```bash
cd /path/to/spark-trace-replay-lab
python3 tools/toolkit_companion.py
```

When Replay Lab says **Toolkit companion: ready**, start screen recording as usual. After you approve screen sharing, the companion automatically starts the Toolkit trace; stopping the Replay Lab recording stops it too.

Afterward, generate and import workflow labels:

```bash
cd /path/to/workflow-induction-toolkit
source .venv/bin/activate
export OPENAI_API_KEY="your-api-key"
cd workflow-induction
python get_human_trajectory.py --data_dir /path/to/spark-trace-sessions/<session-id>
python segment.py --data_dir /path/to/spark-trace-sessions/<session-id>
python induce.py --data_dir /path/to/spark-trace-sessions/<session-id> --auto
```

Load the matching video, session manifest, and generated `workflow.json` into Replay Lab.

## Important notes

- Recording, replay, visual filmstrips, and raw Toolkit capture work locally without an API key.
- Semantic Toolkit labels require an `OPENAI_API_KEY` during post-recording induction.
- The Toolkit may send event-linked screenshots to its configured model during induction. Use a dedicated, consented workspace and avoid sensitive material.
- macOS requires Accessibility and Screen Recording permission for the process running the Toolkit companion.
