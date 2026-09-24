const changes = [
  ["Knowledge / search space", "#2d876e", "#e9f6f1"],
  ["Connections", "#3575b8", "#eaf2fe"],
  ["Representation", "#7354c2", "#f0eaff"],
  ["Criteria / preferences", "#bd6e64", "#fff0ee"],
  ["Goal", "#4b82b0", "#edf5fb"],
  ["Self-understanding", "#9b6a9f", "#f9eef9"],
];
const triggers = [
  ["New information", "#34826f", "#e9f7f1"], ["Analogy", "#3975b8", "#eaf2fe"],
  ["Error", "#d17442", "#fff0e9"], ["Disagreement", "#b26f46", "#fff1e8"],
  ["Question", "#6f61b7", "#f0effc"], ["Constraint", "#af752b", "#fff4df"],
  ["Unexpected example", "#b16391", "#fcecf5"],
];
const typeColors = { ai: "#7859bc", source: "#3c7db3", draft: "#c07158", calculate: "#b07a29", other: "#74818b" };
const $ = (selector) => document.querySelector(selector);
const video = $("#replayVideo");
const state = {
  frames: [], segments: [], candidates: [], sparks: [], duration: 0, objectUrl: null, videoName: "", activeFilter: "all", candidateReviewId: null,
  sessionStartEpochSeconds: null, sessionManifest: null, manifestObjectUrl: null, pendingWorkflow: null, workflowIntegration: null,
  workflowCapture: { status: "checking" }, workflowCaptureStart: null, workflowCaptureStop: null,
};
let recorder; let recordingStream; let recordedChunks = []; let recordingStartedAt; let recordTicker; let hardStop; let framesBuilding = false; let captureFinalized = false;
let selectedChange = "Representation"; let selectedTriggers = ["New information"];

function seconds(value) { return Math.max(0, Math.round(Number(value) || 0)); }
function clock(value) { const time = seconds(value); return String(Math.floor(time / 60)).padStart(2, "0") + ":" + String(time % 60).padStart(2, "0"); }
function notify(text) { const node = $("#toast"); node.textContent = text; node.classList.remove("hidden"); setTimeout(() => node.classList.add("hidden"), 3000); }
function setStatus(text, active) { const node = $("#recordStatus"); node.textContent = text; node.classList.toggle("recording", Boolean(active)); }
function renderWorkflowCaptureStatus() {
  const node = $("#workflowCompanionStatus"); if (!node) return;
  const capture = state.workflowCapture || {};
  const labels = {
    checking: "Toolkit companion: checking local connection…",
    unavailable: "Toolkit companion: not connected — video-only capture",
    ready: "Toolkit companion: ready — starts after screen-share approval",
    starting: "Toolkit companion: starting activity trace…",
    recording: "Toolkit companion: recording activity trace",
    stopping: "Toolkit companion: finalizing activity trace…",
    stopped: "Toolkit companion: trace saved alongside this session",
    error: "Toolkit companion: could not start — video-only capture",
  };
  node.textContent = labels[capture.status] || "Toolkit companion: " + capture.status;
  node.classList.toggle("active", capture.status === "recording");
}
function getAxis(list, name) { return list.find((entry) => entry[0] === name) || list[0]; }
function getRange() { return { start: Math.min(seconds($("#rangeStart").value), seconds($("#rangeEnd").value)), end: Math.max(seconds($("#rangeStart").value), seconds($("#rangeEnd").value)) }; }
function setRange(start, end) { $("#rangeStart").value = seconds(start); $("#rangeEnd").value = seconds(end == null ? start : end); }
function setVideoTime(time) { video.currentTime = Math.min(Math.max(0, Number(time)), state.duration || Number(time)); updatePlayhead(); }
function updatePlayhead() { $("#playhead").textContent = clock(video.currentTime); document.querySelectorAll(".frame").forEach((node) => node.classList.toggle("active", Math.abs(Number(node.dataset.time) - video.currentTime) < 3)); }

function resetWorkspace() {
  state.frames = []; state.segments = []; state.candidates = []; state.sparks = []; state.duration = 0; state.candidateReviewId = null; state.pendingWorkflow = null; state.workflowIntegration = null;
  $("#filmstrip").innerHTML = ""; renderSegments(); renderCandidates(); renderSparks(); updateCounts();
  setAlignmentStatus("Workflow alignment: waiting for an import");
}
function loadVideo(file, name) {
  if (!file) return;
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  resetWorkspace();
  state.objectUrl = URL.createObjectURL(file); state.videoName = name || file.name || "Screen recording";
  video.src = state.objectUrl; $("#workspace").classList.remove("hidden"); $("#videoLabel").textContent = state.videoName;
  $("#durationLabel").textContent = "Loading video metadata…";
  video.load();
}
function setupVideo() {
  state.duration = video.duration;
  $("#durationLabel").textContent = clock(state.duration) + " recording · choose a thumbnail to seek";
  $("#rangeStart").max = Math.floor(state.duration); $("#rangeEnd").max = Math.floor(state.duration);
  setRange(0, 0); updateSessionManifestDownload(); updateCounts(); buildFrames();
}
function updateCounts() {
  $("#frameCount").textContent = state.frames.length; $("#segmentCount").textContent = state.segments.length;
  $("#candidateCount").textContent = state.candidates.filter((candidate) => candidate.status === "proposed").length;
  $("#sparkCount").textContent = state.sparks.length;
}
function setAlignmentStatus(text, tone) {
  const node = $("#alignmentStatus"); node.textContent = text; node.classList.toggle("ready", tone === "ready"); node.classList.toggle("needs-attention", tone === "needs-attention");
}
function currentManifest() {
  return {
    schema: "spark-trace/session-manifest/v1",
    createdAt: new Date().toISOString(),
    recording: { videoName: state.videoName, startedAtEpochSeconds: state.sessionStartEpochSeconds, durationSeconds: state.duration || null },
    workflowCapture: state.workflowCapture && state.workflowCapture.sessionId ? {
      sessionId: state.workflowCapture.sessionId, sessionDir: state.workflowCapture.sessionDir || null,
      recordsDir: state.workflowCapture.recordsDir || null, startedAt: state.workflowCapture.startedAt || null,
      stoppedAt: state.workflowCapture.stoppedAt || null, status: state.workflowCapture.status,
    } : null,
    note: "Use this file with the matching video to align native Workflow Induction Toolkit timestamps during replay.",
  };
}
function updateSessionManifestDownload() {
  if (!state.sessionStartEpochSeconds) return;
  const manifest = currentManifest(); state.sessionManifest = manifest;
  if (state.manifestObjectUrl) URL.revokeObjectURL(state.manifestObjectUrl);
  state.manifestObjectUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }));
  const link = $("#manifestDownload"); link.href = state.manifestObjectUrl; link.download = "spark-trace-session.json"; link.classList.remove("hidden");
}
function loadSessionManifest(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const manifest = JSON.parse(String(reader.result)); const start = Number(manifest && manifest.recording && manifest.recording.startedAtEpochSeconds);
      if (!Number.isFinite(start) || start < 1000000000) throw new Error("Missing recording start time");
      state.sessionManifest = manifest; state.sessionStartEpochSeconds = start; updateSessionManifestDownload();
      setAlignmentStatus("Workflow alignment: session manifest loaded (video start " + new Date(start * 1000).toLocaleTimeString() + ")", "ready");
      if (state.pendingWorkflow) applyWorkflowImport(state.pendingWorkflow);
      notify("Session alignment manifest loaded.");
    } catch (error) {
      setAlignmentStatus("Workflow alignment: that file is not a Spark Trace session manifest", "needs-attention"); notify("Could not read a valid session alignment manifest.");
    }
  };
  reader.readAsText(file);
}

function supportedMime() {
  // Let the browser choose a codec first. In Firefox, forcing an audio codec
  // for a screen-only stream can make a recorder stop before its first chunk.
  const options = ["video/webm", "video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus"];
  return options.find((type) => window.MediaRecorder && MediaRecorder.isTypeSupported(type)) || "";
}
const companionUrl = "http://127.0.0.1:8787";
async function companionRequest(path, method, body) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(companionUrl + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Local companion request failed");
    return payload;
  } finally { clearTimeout(timeout); }
}
async function checkWorkflowCompanion() {
  try {
    const status = await companionRequest("/health", "GET");
    state.workflowCapture = status.ok ? { status: "ready" } : { status: "unavailable", detail: status.error };
  } catch (error) { state.workflowCapture = { status: "unavailable" }; }
  renderWorkflowCaptureStatus();
}
function captureSessionId() { return "spark-" + new Date().toISOString().replace(/[:.]/g, "-") + "-" + Math.random().toString(16).slice(2, 8); }
async function startWorkflowCapture(sessionId) {
  state.workflowCapture = { status: "starting", sessionId }; renderWorkflowCaptureStatus();
  try {
    const result = await companionRequest("/v1/captures/start", "POST", { sessionId, userName: "spark-trace-participant" });
    state.workflowCapture = { ...result.capture, status: "recording" }; updateSessionManifestDownload(); renderWorkflowCaptureStatus();
  } catch (error) {
    state.workflowCapture = { status: "error", sessionId, detail: error.message }; renderWorkflowCaptureStatus();
    notify("Video is recording, but the Toolkit trace did not start. Check the local companion terminal.");
  }
}
async function stopWorkflowCapture() {
  if (state.workflowCaptureStop) return state.workflowCaptureStop;
  state.workflowCaptureStop = (async () => {
    if (state.workflowCaptureStart) await state.workflowCaptureStart;
    if (state.workflowCapture.status !== "recording") return;
    state.workflowCapture.status = "stopping"; renderWorkflowCaptureStatus();
    try {
      const result = await companionRequest("/v1/captures/stop", "POST", {});
      state.workflowCapture = { ...result.capture, status: result.capture.status || "stopped" }; updateSessionManifestDownload();
    } catch (error) { state.workflowCapture.status = "error"; state.workflowCapture.detail = error.message; }
    renderWorkflowCaptureStatus();
  })();
  try { await state.workflowCaptureStop; } finally { state.workflowCaptureStop = null; }
}
function resetCaptureControls(status) {
  clearInterval(recordTicker); clearTimeout(hardStop);
  $("#recordButton").classList.remove("hidden");
  const stop = $("#stopButton"); stop.classList.add("hidden"); stop.disabled = false; stop.textContent = "■ Stop & prepare replay";
  setStatus(status || "Ready", false);
}
function failCapture(message) {
  if (captureFinalized) return;
  captureFinalized = true;
  stopWorkflowCapture();
  if (recordingStream) recordingStream.getTracks().forEach((track) => track.stop());
  resetCaptureControls("Capture ended");
  notify(message);
}
async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) {
    notify("This browser does not support screen capture. Import an existing video instead."); return;
  }
  try {
    recordingStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { max: 1280 }, height: { max: 720 }, frameRate: { ideal: 10, max: 15 } },
      audio: true,
    });
    recordedChunks = []; captureFinalized = false;
    const sessionId = captureSessionId(); state.workflowCaptureStop = null;
    state.workflowCaptureStart = startWorkflowCapture(sessionId);
    const mimeType = supportedMime();
    recorder = mimeType ? new MediaRecorder(recordingStream, { mimeType }) : new MediaRecorder(recordingStream);
    recorder.addEventListener("dataavailable", (event) => { if (event.data && event.data.size) recordedChunks.push(event.data); });
    recorder.addEventListener("stop", finishRecording);
    recorder.addEventListener("error", () => failCapture("The browser stopped this capture before a replay file could be made. Start again and share a screen or window."));
    const videoTrack = recordingStream.getVideoTracks()[0];
    if (videoTrack) videoTrack.addEventListener("ended", () => {
      if (recorder && recorder.state !== "inactive") stopRecording();
      else failCapture("Screen sharing ended before a replay file could be made. Start again and keep the shared surface open.");
    });
    recorder.start(4000); recordingStartedAt = Date.now(); state.sessionStartEpochSeconds = recordingStartedAt / 1000; state.sessionManifest = null;
    $("#manifestDownload").classList.add("hidden");
    $("#recordButton").classList.add("hidden"); $("#stopButton").classList.remove("hidden"); setStatus("Recording", true);
    recordTicker = setInterval(updateRecordTimer, 250); hardStop = setTimeout(() => stopRecording(), 30 * 60 * 1000);
    updateRecordTimer();
  } catch (error) {
    stopWorkflowCapture();
    notify("Screen capture was not started. You can import a recording instead.");
  }
}
function updateRecordTimer() {
  const elapsed = (Date.now() - recordingStartedAt) / 1000;
  $("#recordTimer").textContent = clock(elapsed) + " / 30:00";
}
function stopRecording() {
  if (!recorder || recorder.state === "inactive") {
    if (!recordedChunks.length) failCapture("No video was captured in this session. Please start a new recording.");
    return;
  }
  const stop = $("#stopButton"); stop.disabled = true; stop.textContent = "Finalizing video…";
  setStatus("Finalizing", false);
  stopWorkflowCapture();
  try { recorder.requestData(); recorder.stop(); }
  catch (error) { failCapture("The browser could not finalize this recording. Please start a new recording."); }
}
function finishRecording() {
  if (captureFinalized) return;
  captureFinalized = true;
  stopWorkflowCapture();
  clearInterval(recordTicker); clearTimeout(hardStop);
  if (recordingStream) recordingStream.getTracks().forEach((track) => track.stop());
  $("#recordButton").classList.remove("hidden"); $("#stopButton").classList.add("hidden"); setStatus("Preparing replay", false);
  if (!recordedChunks.length) {
    resetCaptureControls("Capture ended");
    notify("No video was received from the browser. Start again and share a screen or window.");
    return;
  }
  const type = recorder.mimeType || "video/webm"; const blob = new Blob(recordedChunks, { type });
  const ext = type.includes("mp4") ? "mp4" : "webm"; const file = new File([blob], "spark-trace-recording." + ext, { type });
  const download = $("#videoDownload"); download.href = URL.createObjectURL(blob); download.download = file.name; download.classList.remove("hidden");
  loadVideo(file, "Screen recording · " + new Date().toLocaleString());
  setStatus("Ready", false); notify("Recording is ready for replay. Build or inspect its timeline.");
}

function seekForFrame(time) {
  const target = Math.min(Math.max(0, time), Math.max(0, state.duration - 0.05));
  if (Math.abs(video.currentTime - target) < 0.01 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      resolve();
    };
    const fallback = setTimeout(done, 1800);
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = target;
  });
}
function visualChangeScore(context, previousPixels) {
  const pixels = context.getImageData(0, 0, context.canvas.width, context.canvas.height).data;
  if (!previousPixels) return { pixels, score: 0 };
  let difference = 0; let samples = 0;
  // Sample a grid rather than every pixel; we need a directional review cue, not vision recognition.
  for (let index = 0; index < pixels.length; index += 320) {
    difference += Math.abs(pixels[index] - previousPixels[index]) + Math.abs(pixels[index + 1] - previousPixels[index + 1]) + Math.abs(pixels[index + 2] - previousPixels[index + 2]);
    samples += 3;
  }
  return { pixels, score: samples ? Math.round((difference / (samples * 255)) * 100) : 0 };
}
async function buildFrames() {
  if (!Number.isFinite(video.duration) || video.duration <= 0 || framesBuilding) return;
  framesBuilding = true;
  const button = $("#buildFrames"); button.disabled = true; button.textContent = "Building…";
  const interval = Number($("#sampleInterval").value); const previousTime = video.currentTime; const frames = [];
  const times = [];
  for (let time = 0; time < state.duration; time += interval) times.push(time);
  if (times[times.length - 1] !== Math.floor(state.duration)) times.push(Math.floor(state.duration));
  const canvas = document.createElement("canvas"); const width = 320; canvas.width = width; canvas.height = Math.round(width * 9 / 16);
  const context = canvas.getContext("2d"); let previousPixels = null;
  try {
    for (let index = 0; index < times.length; index += 1) {
      await seekForFrame(times[index]);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const analysis = visualChangeScore(context, previousPixels); previousPixels = analysis.pixels;
      frames.push({ time: times[index], data: canvas.toDataURL("image/jpeg", 0.62), visualChange: analysis.score });
      button.textContent = "Building " + (index + 1) + "/" + times.length;
    }
    state.frames = frames; await seekForFrame(previousTime); renderFrames(); generateCandidates(true); updateCounts();
    notify("Built " + frames.length + " local change-point thumbnails.");
  } catch (error) {
    notify("Frame generation stopped. Try a different video format or a longer sample interval.");
  } finally {
    framesBuilding = false; button.disabled = false; button.textContent = "Rebuild frames";
  }
}
function renderFrames() {
  $("#filmstrip").innerHTML = state.frames.map((frame) =>
    '<button class="frame" data-time="' + frame.time + '"><img src="' + frame.data + '" alt="Screen at ' + clock(frame.time) + '"><i>↗</i><span>' + clock(frame.time) + "</span></button>"
  ).join("");
  document.querySelectorAll(".frame").forEach((node) => node.addEventListener("click", () => { setVideoTime(Number(node.dataset.time)); setRange(video.currentTime, video.currentTime); }));
}

function candidateKey(candidate) { return candidate.kind + ":" + Math.round(candidate.start / 5) * 5; }
function proposedCandidate(kind, start, end, title, rationale, source) {
  return { id: "candidate-" + Date.now() + "-" + Math.random().toString(16).slice(2), kind, start: seconds(start), end: seconds(end == null ? start : end), title, rationale, source, status: "proposed" };
}
function percentile(sortedValues, fraction) {
  if (!sortedValues.length) return 0;
  return sortedValues[Math.min(sortedValues.length - 1, Math.max(0, Math.floor((sortedValues.length - 1) * fraction)))];
}
function textForSegment(segment) { return (segment.label + " " + (segment.note || "") + " " + segment.kind).toLowerCase(); }
function classifyWorkflowCandidate(segment, previous) {
  const text = textForSegment(segment); const previousText = previous ? textForSegment(previous) : "";
  if (segment.kind === "ai" || /\b(codex|chatgpt|llm|ai response|prompt|assistant)\b/.test(text)) return proposedCandidate("AI turn", segment.start, segment.end, "AI interaction", "A recorded AI turn begins here. Review whether it redirected your next step.", "workflow");
  if (/\b(error|wrong|incorrect|correction|corrected|revise|revision|contradict|conflict|disagree)\b/.test(text)) return proposedCandidate("Correction", segment.start, segment.end, "Possible correction or disagreement", "This workflow note contains a correction, conflict, or revision cue.", "workflow");
  if ((segment.kind === "source" || /\b(source|document|filing|report|evidence|10-k|10-q)\b/.test(text)) && (!previous || previous.kind !== "source" || previousText !== text)) return proposedCandidate("Source switch", segment.start, segment.end, "Source or evidence transition", "A new source-oriented activity begins here.", "workflow");
  if (previous && (segment.kind !== previous.kind || segment.label !== previous.label)) return proposedCandidate("Workflow boundary", segment.start, segment.end, "Workflow activity changed", "The inferred workflow changes activity here; inspect the transition.", "workflow");
  return null;
}
function generateCandidates(silent) {
  if (!state.duration) { if (!silent) notify("Record or import a video first."); return; }
  const prior = new Map(state.candidates.map((candidate) => [candidateKey(candidate), candidate])); const proposed = [];
  const add = (candidate) => { if (!candidate) return; const key = candidateKey(candidate); if (proposed.some((item) => candidateKey(item) === key)) return; const old = prior.get(key); if (old) candidate.status = old.status; proposed.push(candidate); };

  state.segments.slice().sort((a, b) => a.start - b.start).forEach((segment, index, ordered) => {
    const previous = ordered[index - 1]; add(classifyWorkflowCandidate(segment, previous));
    if (previous && segment.start - previous.end >= 45) add(proposedCandidate("Long pause", previous.end, segment.start, "Long gap between activities", "No workflow activity was recorded for " + clock(segment.start - previous.end) + ". Review what was happening in this interval.", "workflow"));
    const recent = ordered.slice(Math.max(0, index - 3), index + 1);
    if (recent.length >= 3 && recent[recent.length - 1].start - recent[0].start <= 60 && new Set(recent.map((item) => item.kind)).size >= 3) add(proposedCandidate("Rapid switching", segment.start, segment.end, "Rapid context switching", "Several distinct activities occur within one minute.", "workflow"));
  });

  const scores = state.frames.map((frame) => frame.visualChange || 0).filter((score) => score > 0).sort((a, b) => a - b);
  // Chat, document, and spreadsheet work can change in a small region of an otherwise
  // static screen. The former fixed 8/100 cutoff silently produced no cues for those
  // sessions. Surface the top-quartile non-zero changes instead. They are explicitly
  // described as navigation prompts, not claims about a cognitive event.
  const visualThreshold = Math.max(0.35, percentile(scores, 0.75));
  state.frames.filter((frame) => frame.visualChange >= visualThreshold).sort((a, b) => b.visualChange - a.visualChange).slice(0, 8).forEach((frame) => {
    add(proposedCandidate("Visual change", Math.max(0, frame.time - Number($("#sampleInterval").value)), frame.time, "Visible context shift", "The screen changed more than usual in this interval (visual-change score " + frame.visualChange + "/100).", "video"));
  });

  // A static-looking recording can still contain a useful conversation. Provide a
  // transparent, evenly-spaced route through it rather than leaving the participant
  // with an empty review queue. These are coverage markers, not detected events.
  if (!proposed.length && state.duration >= 90) {
    const checkpoints = Math.min(6, Math.max(2, Math.floor(state.duration / 120)));
    for (let index = 1; index <= checkpoints; index += 1) {
      const time = (state.duration * index) / (checkpoints + 1);
      add(proposedCandidate("Timeline checkpoint", Math.max(0, time - 8), Math.min(state.duration, time + 8), "Replay checkpoint", "No strong visual or workflow change was detected here. This evenly-spaced checkpoint helps you scan the session without watching every minute.", "video"));
    }
  }

  state.candidates = proposed.sort((a, b) => a.start - b.start); renderCandidates(); updateCounts();
  if (!silent) notify(state.candidates.length ? "Prepared " + state.candidates.filter((candidate) => candidate.status === "proposed").length + " moments for review." : "No strong candidates yet. Import workflow.json or add markers to create richer suggestions.");
}
function candidateColor(kind) {
  return ({ "AI turn": "#7658bf", "Source switch": "#3975b8", "Correction": "#d17442", "Long pause": "#af752b", "Rapid switching": "#b16391", "Workflow boundary": "#597bb7", "Visual change": "#74818b", "Timeline checkpoint": "#74818b" })[kind] || "#597bb7";
}
function renderCandidates() {
  const visible = state.candidates.filter((candidate) => candidate.status !== "dismissed");
  $("#candidateList").innerHTML = visible.length ? visible.map((candidate) =>
    '<article class="candidate-card ' + (candidate.status === "confirmed" ? "confirmed" : "") + '" style="--candidate:' + candidateColor(candidate.kind) + '"><div class="candidate-top"><span class="candidate-time">' + clock(candidate.start) + (candidate.end > candidate.start ? "–" + clock(candidate.end) : "") + '</span><span class="candidate-status">' + candidate.status + '</span></div><h3>' + esc(candidate.title) + '</h3><p>' + esc(candidate.rationale) + '</p><footer><small>' + esc(candidate.kind) + " · " + esc(candidate.source) + '</small><div class="candidate-actions">' + (candidate.status === "confirmed" ? '<button class="text-button review-candidate" data-id="' + candidate.id + '">View</button>' : '<button class="text-button review-candidate" data-id="' + candidate.id + '">Review</button><button class="text-button dismiss-candidate" data-id="' + candidate.id + '">Dismiss</button>') + '</div></footer></article>'
  ).join("") : '<p class="empty">No candidate moments yet. Filmstrip changes and imported workflow markers will appear here as review prompts.</p>';
  document.querySelectorAll(".review-candidate").forEach((node) => node.addEventListener("click", () => reviewCandidate(node.dataset.id)));
  document.querySelectorAll(".dismiss-candidate").forEach((node) => node.addEventListener("click", () => { const candidate = state.candidates.find((item) => item.id === node.dataset.id); if (candidate) { candidate.status = "dismissed"; renderCandidates(); updateCounts(); notify("Candidate dismissed; it remains in the export trail."); } }));
}
function reviewCandidate(id) {
  const candidate = state.candidates.find((item) => item.id === id); if (!candidate) return;
  state.candidateReviewId = id; candidate.status = candidate.status === "confirmed" ? "confirmed" : "reviewing";
  setVideoTime(candidate.start); setRange(candidate.start, candidate.end); renderCandidates(); openSparkModal(candidate);
}
function releaseCandidateReview() {
  const candidate = state.candidates.find((item) => item.id === state.candidateReviewId);
  if (candidate && candidate.status === "reviewing") candidate.status = "proposed";
  state.candidateReviewId = null; renderCandidates(); updateCounts();
}

function inferKind(text) {
  const value = String(text || "").toLowerCase();
  if (value.includes("codex") || value.includes("ai") || value.includes("prompt") || value.includes("chat")) return "ai";
  if (value.includes("draft") || value.includes("recommend") || value.includes("note")) return "draft";
  if (value.includes("table") || value.includes("calc") || value.includes("spreadsheet") || value.includes("model")) return "calculate";
  return "source";
}
function renderSegments() {
  const query = $("#segmentSearch").value.toLowerCase();
  const matching = state.segments.filter((segment) => {
    const applies = state.activeFilter === "all" || segment.kind === state.activeFilter;
    return applies && (segment.label + " " + (segment.note || "")).toLowerCase().includes(query);
  });
  $("#segmentList").innerHTML = matching.length ? matching.sort((a, b) => a.start - b.start).map((segment) =>
    '<button class="segment" data-id="' + segment.id + '" style="--marker:' + (typeColors[segment.kind] || typeColors.other) + '"><span class="segment-head"><span>' + clock(segment.start) + "–" + clock(segment.end) + "</span><span>" + segment.kind + '</span></span><strong>' + esc(segment.label) + "</strong>" + (segment.note ? "<small>" + esc(segment.note) + "</small>" : "") + "</button>"
  ).join("") : '<p class="empty">No markers yet. Add one at the playhead, or import a companion workflow.json.</p>';
  document.querySelectorAll(".segment").forEach((node) => node.addEventListener("click", () => {
    const segment = state.segments.find((item) => item.id === node.dataset.id); if (!segment) return;
    setVideoTime(segment.start); setRange(segment.start, segment.end);
  }));
}
function esc(text) { const node = document.createElement("div"); node.textContent = text || ""; return node.innerHTML; }
function addSegment(segment) {
  state.segments.push(Object.assign({ id: "seg-" + Date.now(), note: "" }, segment)); renderSegments(); generateCandidates(true); updateCounts();
}
function parseTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.includes(":")) {
    const parts = value.split(":").map(Number); return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.reduce((total, part) => total * 60 + part, 0);
  }
  const numeric = Number(value); if (Number.isFinite(numeric)) return numeric;
  const parsedDate = Date.parse(value); return Number.isFinite(parsedDate) ? parsedDate / 1000 : null;
}
function normalizeEpoch(value) {
  const timestamp = parseTimestamp(value); if (!Number.isFinite(timestamp)) return null;
  return timestamp > 100000000000 ? timestamp / 1000 : timestamp;
}
function workflowNodeLeaves(node) {
  if (!node) return [];
  if (node.node_type === "action" || !Array.isArray(node.nodes)) return [node];
  return node.nodes.flatMap(workflowNodeLeaves);
}
function workflowNodeTimeRange(node) {
  const times = workflowNodeLeaves(node).flatMap((leaf) => [normalizeEpoch(leaf.time && leaf.time.before), normalizeEpoch(leaf.time && leaf.time.after)]).filter(Number.isFinite);
  return times.length ? { start: Math.min(...times), end: Math.max(...times) } : null;
}
function workflowNodeEvidence(node) {
  return workflowNodeLeaves(node).map((leaf) => leaf.state).filter(Boolean).map((state) => ({ before: state.before || null, after: state.after || null })).slice(0, 12);
}
function toolkitWorkflowSteps(root) {
  const nodes = root && root.node_type === "sequence" && Array.isArray(root.nodes) ? root.nodes : [root];
  return nodes.map((node, index) => {
    const leaves = workflowNodeLeaves(node); const range = workflowNodeTimeRange(node);
    const leafLabel = leaves.map((leaf) => leaf.goal || leaf.action).filter(Boolean).slice(0, 2).join("; ");
    const label = node.goal || leafLabel || "Workflow Induction step " + (index + 1);
    return { label, rawStart: range && range.start, rawEnd: range && range.end, kind: inferKind(label), note: "Workflow Induction Toolkit · " + (node.status || "unknown") + " · " + leaves.length + " actions", evidence: workflowNodeEvidence(node), sourceSchema: "workflow-induction-toolkit" };
  }).filter((step) => Number.isFinite(step.rawStart));
}
function flatWorkflowSteps(parsed) {
  const list = Array.isArray(parsed) ? parsed : (parsed.segments || parsed.workflow || parsed.steps || parsed.actions || []);
  if (!Array.isArray(list)) return [];
  return list.map((item, index) => {
    const label = item.description || item.label || item.name || item.step || item.goal || item.action || "Imported workflow step " + (index + 1);
    return { label, rawStart: normalizeEpoch(item.start || item.start_time || item.start_sec || item.timestamp || (item.time && item.time.before)), rawEnd: normalizeEpoch(item.end || item.end_time || item.end_sec || (item.time && item.time.after)), kind: item.kind || item.type || inferKind(label), note: item.note || item.details || "Imported workflow marker", evidence: item.evidence || [], sourceSchema: "flat-workflow" };
  }).filter((step) => Number.isFinite(step.rawStart));
}
function isAbsoluteWorkflowTime(value) { return Number.isFinite(value) && value > 1000000000; }
function applyWorkflowImport(workflow) {
  if (!state.duration) { notify("Load the matching recording before importing workflow data."); return; }
  const absolute = workflow.steps.some((step) => isAbsoluteWorkflowTime(step.rawStart));
  if (absolute && !state.sessionStartEpochSeconds) {
    state.pendingWorkflow = workflow; setAlignmentStatus("Workflow alignment: load the matching session manifest before this native Toolkit file can be placed on the video", "needs-attention");
    notify("This is native Workflow Induction output. Load the session alignment manifest saved with the recording."); return;
  }
  const mapped = []; let outOfRange = 0;
  workflow.steps.forEach((step, index) => {
    const start = absolute ? step.rawStart - state.sessionStartEpochSeconds : step.rawStart;
    const end = absolute ? (Number.isFinite(step.rawEnd) ? step.rawEnd : step.rawStart) - state.sessionStartEpochSeconds : (Number.isFinite(step.rawEnd) ? step.rawEnd : step.rawStart);
    if (end < -2 || start > state.duration + 2) { outOfRange += 1; return; }
    mapped.push({ id: "workflow-" + Date.now() + "-" + index, label: step.label, start: Math.max(0, start), end: Math.min(state.duration, Math.max(start, end)), kind: step.kind, note: step.note, evidence: step.evidence, sourceSchema: step.sourceSchema, rawStart: step.rawStart, rawEnd: step.rawEnd });
  });
  if (!mapped.length) {
    setAlignmentStatus("Workflow alignment: no imported steps overlap this recording; check that the manifest matches the video", "needs-attention"); notify("No workflow steps aligned to this video. Check that you selected the matching session manifest."); return;
  }
  state.segments = state.segments.filter((segment) => segment.sourceSchema !== "workflow-induction-toolkit" && segment.sourceSchema !== "flat-workflow").concat(mapped);
  state.pendingWorkflow = null; state.workflowIntegration = { sourceSchema: workflow.schema, alignment: absolute ? "epoch-to-video" : "relative", importedAt: new Date().toISOString(), omittedOutOfRangeSteps: outOfRange };
  renderSegments(); generateCandidates(true); updateCounts();
  setAlignmentStatus("Workflow alignment: " + mapped.length + " steps placed on the video" + (outOfRange ? "; " + outOfRange + " outside the recording" : ""), "ready");
  notify("Imported " + mapped.length + " aligned workflow steps and refreshed review prompts.");
}
function importWorkflow(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result)); const nativeToolkit = parsed && parsed.node_type === "sequence" && Array.isArray(parsed.nodes);
      const steps = nativeToolkit ? toolkitWorkflowSteps(parsed) : flatWorkflowSteps(parsed);
      if (!steps.length) throw new Error("No timestamped workflow steps");
      applyWorkflowImport({ schema: nativeToolkit ? "workflow-induction-toolkit/v1" : "flat-workflow/v1", steps });
    } catch (error) {
      setAlignmentStatus("Workflow alignment: unsupported workflow file", "needs-attention"); notify("Could not read timestamped workflow steps from that JSON file.");
    }
  };
  reader.readAsText(file);
}

function renderPickers() {
  const buttons = (list, selected, attr) => list.map((entry) =>
    '<button type="button" class="choice ' + (selected.includes(entry[0]) ? "selected" : "") + '" style="--color:' + entry[1] + ";--bg:" + entry[2] + '" data-' + attr + '="' + entry[0] + '">' + entry[0] + "</button>"
  ).join("");
  $("#changePicker").innerHTML = buttons(changes, [selectedChange], "change");
  $("#triggerPicker").innerHTML = buttons(triggers, selectedTriggers, "trigger");
}
function showModal(id) { $("#" + id).classList.remove("hidden"); }
function hideModal(id) { $("#" + id).classList.add("hidden"); }
function openSparkModal(candidate) {
  if (!state.duration) { notify("Record or import a video first."); return; }
  if (!candidate) state.candidateReviewId = null;
  const range = getRange(); $("#sparkMoment").textContent = range.start === range.end ? clock(range.start) : clock(range.start) + "–" + clock(range.end);
  $("#sparkModalTitle").textContent = candidate ? "Was this a spark for you?" : "Name the shift, then its trigger.";
  $("#cueNote").value = candidate ? candidate.title + ": " + candidate.rationale : ""; $("#sparkText").value = ""; selectedChange = "Representation"; selectedTriggers = ["New information"]; renderPickers(); showModal("sparkModal"); $("#cueNote").focus();
}
function renderSparks() {
  $("#sparkList").innerHTML = state.sparks.length ? state.sparks.slice().reverse().map((spark) => {
    const color = getAxis(changes, spark.change);
    return '<article class="spark-card" style="--spark:' + color[1] + '"><div class="spark-head"><span class="chip" style="background:' + color[2] + ";color:" + color[1] + '">' + spark.triggers.join(" + ").toUpperCase() + " → " + spark.change.toUpperCase() + '</span><button class="text-button jump-spark" data-start="' + spark.start + '">↗ ' + clock(spark.start) + "</button></div><p>" + esc(spark.text) + "</p><footer>" + esc(spark.cueType) + (spark.cueNote ? " · " + esc(spark.cueNote) : "") + " · " + esc(spark.outcome) + "</footer></article>";
  }).join("") : '<p class="empty">No sparks captured yet. Use the replay to locate a moment that redirected your thinking.</p>';
  document.querySelectorAll(".jump-spark").forEach((node) => node.addEventListener("click", () => { setVideoTime(Number(node.dataset.start)); setRange(Number(node.dataset.start), Number(node.dataset.start)); }));
}
function exportSession() {
  const data = {
    schema: "spark-trace-replay/v0.2", exportedAt: new Date().toISOString(),
    session: { name: $("#sessionName").value, videoName: state.videoName, durationSeconds: state.duration, videoStartEpochSeconds: state.sessionStartEpochSeconds, videoIncluded: false },
    workflowIntegration: state.workflowIntegration, workflowSegments: state.segments, candidateProposals: state.candidates, annotations: state.sparks,
    taxonomy: { changes: changes.map((entry) => entry[0]), triggers: triggers.map((entry) => entry[0]) },
    note: "The video is intentionally not embedded. Candidate proposals are review prompts from video/workflow heuristics, not spark labels. Keep the recording separately and associate it by filename and study ID.",
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = "spark-trace-replay.json"; link.click(); URL.revokeObjectURL(link.href); notify("Exported workflow markers and spark annotations.");
}

video.addEventListener("loadeddata", setupVideo);
video.addEventListener("timeupdate", updatePlayhead);
$("#recordButton").addEventListener("click", startRecording);
$("#stopButton").addEventListener("click", stopRecording);
$("#videoInput").addEventListener("change", (event) => loadVideo(event.target.files[0], event.target.files[0] && event.target.files[0].name));
$("#sessionManifestInput").addEventListener("change", (event) => { if (event.target.files[0]) loadSessionManifest(event.target.files[0]); });
$("#buildFrames").addEventListener("click", buildFrames);
$("#usePlayhead").addEventListener("click", () => setRange(video.currentTime, video.currentTime));
$("#openSparkButton").addEventListener("click", openSparkModal);
$("#openSegmentButton").addEventListener("click", () => { const range = getRange(); $("#segmentForm").reset(); $("#segmentStart").value = range.start; $("#segmentEnd").value = range.end; showModal("segmentModal"); $("#segmentLabel").focus(); });
$("#workflowInput").addEventListener("change", (event) => { if (event.target.files[0]) importWorkflow(event.target.files[0]); });
$("#generateCandidates").addEventListener("click", () => generateCandidates(false));
$("#segmentSearch").addEventListener("input", renderSegments);
$("#filters").addEventListener("click", (event) => { const filter = event.target.dataset.filter; if (!filter) return; state.activeFilter = filter; document.querySelectorAll(".filter").forEach((button) => button.classList.toggle("active", button.dataset.filter === filter)); renderSegments(); });
$("#changePicker").addEventListener("click", (event) => { if (event.target.dataset.change) { selectedChange = event.target.dataset.change; renderPickers(); } });
$("#triggerPicker").addEventListener("click", (event) => { const trigger = event.target.dataset.trigger; if (!trigger) return; selectedTriggers = selectedTriggers.includes(trigger) ? selectedTriggers.filter((item) => item !== trigger) : selectedTriggers.concat(trigger); renderPickers(); });
$("#sparkForm").addEventListener("submit", (event) => {
  event.preventDefault(); const range = getRange(); const reviewedCandidateId = state.candidateReviewId; state.sparks.push({
    id: "spark-" + Date.now(), start: range.start, end: range.end, cueType: $("#cueType").value, cueNote: $("#cueNote").value.trim(),
    change: selectedChange, triggers: selectedTriggers.length ? selectedTriggers : ["Uncertain"], text: $("#sparkText").value.trim(), confidence: $("#confidence").value, outcome: $("#outcome").value, candidateId: reviewedCandidateId || null,
  });
  const candidate = state.candidates.find((item) => item.id === reviewedCandidateId); if (candidate) candidate.status = "confirmed";
  state.candidateReviewId = null; renderSparks(); renderCandidates(); updateCounts(); hideModal("sparkModal"); notify("Spark linked to " + clock(range.start) + ".");
});
$("#segmentForm").addEventListener("submit", (event) => {
  event.preventDefault(); addSegment({ label: $("#segmentLabel").value.trim(), start: seconds($("#segmentStart").value), end: Math.max(seconds($("#segmentStart").value), seconds($("#segmentEnd").value)), kind: $("#segmentKind").value, note: $("#segmentNote").value.trim() });
  hideModal("segmentModal"); notify("Navigation marker saved.");
});
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.close === "sparkModal") releaseCandidateReview(); hideModal(button.dataset.close); }));
document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => { if (event.target === backdrop) { if (backdrop.id === "sparkModal") releaseCandidateReview(); backdrop.classList.add("hidden"); } }));
$("#exportButton").addEventListener("click", exportSession);
$("#jumpToCurrent").addEventListener("click", () => { setVideoTime(video.currentTime); window.scrollTo({ top: 0, behavior: "smooth" }); });
$("#sessionName").addEventListener("input", () => { document.title = $("#sessionName").value + " · Spark Trace Replay"; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { releaseCandidateReview(); document.querySelectorAll(".modal-backdrop").forEach((node) => node.classList.add("hidden")); } if (event.key.toLowerCase() === "m" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) { event.preventDefault(); setRange(video.currentTime, video.currentTime); openSparkModal(); } });
renderSegments(); renderCandidates(); renderSparks(); renderPickers(); updateCounts(); renderWorkflowCaptureStatus(); checkWorkflowCompanion();
