const changeAxes = [
  ["Knowledge / search space", "What facts, methods, possibilities, or directions are available.", "#39856f", "#e9f6f1"],
  ["Connections", "A relationship to another domain, problem, or experience becomes usable.", "#3975b8", "#eaf2fe"],
  ["Representation", "The same problem becomes visible in a new form, encoding, or abstraction level.", "#7354c2", "#f0eaff"],
  ["Criteria / preferences", "The person’s quality bar, value judgment, or sense of fit changes.", "#bd6e64", "#fff0ee"],
  ["Goal", "What the person takes the work to be for changes.", "#4b82b0", "#edf5fb"],
  ["Self-understanding", "The person notices a habit, bias, capacity, or orientation in their own thinking.", "#9b6a9f", "#f9eef9"],
];

const triggerAxes = [
  ["New information", "A fact, method, source, or possibility enters the situation.", "#34826f", "#e9f7f1"],
  ["Analogy", "A structural transfer from another case or domain.", "#3975b8", "#eaf2fe"],
  ["Error", "A false, impossible, or malformed proposal becomes generative.", "#d17442", "#fff0e9"],
  ["Disagreement", "Intellectual friction prompts defense, revision, or abandonment.", "#b26f46", "#fff1e8"],
  ["Question", "An external question opens an unexamined dimension.", "#6f61b7", "#f0effc"],
  ["Constraint", "A restriction makes latent structure visible.", "#af752b", "#fff4df"],
  ["Unexpected example", "A concrete case, contrast, or alternative world changes the search.", "#b16391", "#fcecf5"],
];

const seedMessages = [
  { id: "ai-compact", who: "ai", time: "10:14", text: "What if “trajectories” are points in a <strong>constraint-defined space</strong>, and the local rule is a map on that space? You might avoid proving convergence sequence by sequence." },
  { id: "human-question", who: "user", time: "10:16", text: "Can you make the compactness claim precise without assuming a metric?" },
  { id: "ai-library", who: "ai", time: "10:17", text: "Possibly. The claim sounds closer to a product-topology argument: encode each trajectory as a compatible family, then use a <strong>finite-intersection</strong> condition. I’d check whether the library has a compactness result for inverse limits." },
];
const seedSparks = [
  { id: "s1", change: "Representation", triggers: ["New information"], time: "10:15", source: "AI suggestion · 10:14", description: "I stopped treating each trajectory as the object of proof. The whole compatible space may be the right object.", outcome: "Reframed the draft" },
  { id: "s2", change: "Knowledge / search space", triggers: ["New information"], time: "10:18", source: "AI suggestion · 10:17", description: "The inverse-limit library is a route I had not considered. Even if this particular claim fails, it gives me a concrete search direction.", outcome: "Opened a library search" },
];
const seedEvents = [
  { time: "10:09", kind: "human", label: "Drafted a starting frame", text: "Started from a sequence-level construction and an invisible invariant." },
  { time: "10:14", kind: "ai", label: "AI proposes a space-level encoding", text: "Recast trajectories as points in a constraint-defined space." },
  { time: "10:15", kind: "spark", label: "New-information → representation spark", text: "The object of proof shifts from individual sequences to a whole space." },
  { time: "10:16", kind: "human", label: "Tested the idea with a question", text: "Asked whether compactness can be made precise without metric assumptions." },
  { time: "10:17", kind: "ai", label: "AI surfaces an inverse-limit route", text: "Suggested product topology and an existing compactness result." },
  { time: "10:18", kind: "spark", label: "New-information → search-space spark", text: "A new library/search route becomes available." },
  { time: "10:20", kind: "human", label: "Revised the next proof move", text: "Shifted from construction to characterizing the compatible space." },
];

const legacyMap = {
  "Representational": ["Representation", ["New information"]], "Diagnostic": ["Knowledge / search space", ["Error"]],
  "Analogical": ["Connections", ["Analogy"]], "Question": ["Knowledge / search space", ["Question"]],
  "Counterfactual": ["Knowledge / search space", ["Unexpected example"]], "Constraint": ["Representation", ["Constraint"]],
  "Decomposition": ["Representation", ["New information"]], "Abstraction": ["Representation", ["New information"]],
  "Retrieval / reminding": ["Knowledge / search space", ["New information"]], "Evaluative / taste": ["Criteria / preferences", ["New information"]],
  "Goal-discovery": ["Goal", ["Question"]], "Metacognitive": ["Self-understanding", ["Question"]],
  "Procedural / tool": ["Knowledge / search space", ["New information"]], "Dissent / adversarial": ["Criteria / preferences", ["Disagreement"]],
  "Generative-error": ["Representation", ["Error"]],
};

const storageKey = "spark-trace-prototype-v1";
const state = JSON.parse(localStorage.getItem(storageKey) || "null") || {
  title: "Making proofs feel alive", draft: null, messages: seedMessages, sparks: seedSparks, events: seedEvents,
};
state.sparks = state.sparks.map((spark) => {
  if (spark.change) return spark;
  const match = legacyMap[spark.type] || ["Knowledge / search space", ["New information"]];
  return Object.assign({}, spark, { change: match[0], triggers: match[1] });
});

const $ = (selector) => document.querySelector(selector);
let selectedChange = "Representation";
let selectedTriggers = ["New information"];
let suggestionIndex = 0;

function save() { localStorage.setItem(storageKey, JSON.stringify(state)); $("#saveState").innerHTML = "<i></i> Saved locally"; }
function esc(value) { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }
function words(value) { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function now() { return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()); }
function details(axis, name) { return axis.find((entry) => entry[0] === name) || axis[0]; }
function label(spark) { return spark.triggers.map((item) => item.toLowerCase()).join(" + ") + " → " + spark.change.toLowerCase(); }
function notice(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.remove("hidden"); setTimeout(() => toast.classList.add("hidden"), 2600); }

function renderMessages() {
  $("#chatStream").innerHTML = state.messages.map((message) =>
    '<div class="message ' + message.who + '"><div class="identity">' + (message.who === "ai" ? "AI" : "YOU") + '</div><div><div class="bubble">' + message.text + '</div><div class="message-time">' + message.time + "</div></div></div>"
  ).join("");
  $("#chatStream").scrollTop = $("#chatStream").scrollHeight;
}
function renderCards() {
  $("#sparkCards").innerHTML = state.sparks.slice().reverse().slice(0, 2).map((spark) => {
    const value = details(changeAxes, spark.change);
    return '<article class="spark-card" style="--spark-color:' + value[2] + ";--chip-bg:" + value[3] + ";--chip-color:" + value[2] + '"><div class="spark-card-head"><span class="type-chip">' + label(spark) + '</span><time>' + spark.time + '</time></div><p>' + esc(spark.description) + "</p><footer>" + spark.source + " · " + spark.outcome + "</footer></article>";
  }).join("");
}
function renderTimeline() {
  $("#timeline").innerHTML = state.events.map((event) =>
    '<li class="timeline-item ' + event.kind + '"><time>' + event.time + '</time><div class="timeline-dot"></div><div class="timeline-content"><div class="timeline-label">' + event.label + "</div><p>" + event.text + "</p></div></li>"
  ).join("");
  $("#trajectoryInsights").innerHTML =
    '<div class="insight"><strong>' + state.sparks.length + ' captured shifts</strong><p>Each annotation distinguishes the reported change from the cue that set it in motion.</p></div>' +
    '<div class="insight"><strong>1 productive error route</strong><p>The inverse-limit cue is kept as a lead, not marked as a verified mathematical claim.</p></div>' +
    '<div class="insight"><strong>2 downstream human moves</strong><p>Read each spark alongside the next questions and revisions, not as a transcript-only label.</p></div>';
}
function card(entry, kind) {
  return '<article class="taxonomy-card"><span class="type-chip" style="--chip-color:' + entry[2] + ";--chip-bg:" + entry[3] + '">' + kind + "</span><h2>" + entry[0] + "</h2><p>" + entry[1] + "</p></article>";
}
function renderTaxonomy(filter) {
  const query = (filter || "").toLowerCase();
  const matching = (axis) => axis.filter((entry) => (entry[0] + " " + entry[1]).toLowerCase().includes(query));
  const changes = matching(changeAxes); const triggers = matching(triggerAxes);
  $("#taxonomyResult").textContent = changes.length + " changes · " + triggers.length + " triggers";
  $("#taxonomyGrid").innerHTML =
    '<section class="taxonomy-group"><div class="taxonomy-group-heading"><p class="eyebrow">WHAT CHANGED</p><h2>Dimension of change</h2><p>This is the participant’s reported shift.</p></div><div class="taxonomy-cards">' +
    changes.map((entry) => card(entry, "change")).join("") +
    '</div></section><section class="taxonomy-group"><div class="taxonomy-group-heading"><p class="eyebrow">WHAT TRIGGERED IT</p><h2>Kind of cue</h2><p>This is a property of the interaction, not the person.</p></div><div class="taxonomy-cards">' +
    triggers.map((entry) => card(entry, "trigger")).join("") + "</div></section>";
}
function renderCounts() { $("#sparkTotal").textContent = state.sparks.length; $("#turnTotal").textContent = state.events.length; $("#trajectoryCount").textContent = state.events.length; }
function render() {
  renderMessages(); renderCards(); renderTimeline(); renderTaxonomy(""); renderCounts();
  $("#sessionTitle").value = state.title; if (state.draft) $("#draft").value = state.draft;
  $("#wordCount").textContent = words($("#draft").value) + " words";
}
function picker(axis, name, chosen, kind) {
  const value = details(axis, name);
  return '<button type="button" class="type-option ' + (chosen ? "selected" : "") + '" style="--choice:' + value[2] + ";--choice-bg:" + value[3] + '" data-' + kind + '="' + name + '">' + name + "</button>";
}
function renderPickers() {
  $("#impactPicker").innerHTML = changeAxes.map((entry) => picker(changeAxes, entry[0], entry[0] === selectedChange, "change")).join("");
  $("#triggerPicker").innerHTML = triggerAxes.map((entry) => picker(triggerAxes, entry[0], selectedTriggers.includes(entry[0]), "trigger")).join("");
}
function show(view) {
  ["studio", "trajectory", "library"].forEach((name) => $("#" + name + "View").classList.toggle("hidden", name !== view));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function openModal() {
  $("#sourceMoment").innerHTML = state.messages.filter((message) => message.who === "ai").map((message) =>
    '<option value="' + message.id + '">AI suggestion · ' + message.time + " — " + message.text.replace(/<[^>]+>/g, "").slice(0, 72) + "…</option>"
  ).join("");
  $("#sparkDescription").value = ""; selectedChange = "Representation"; selectedTriggers = ["New information"]; renderPickers();
  $("#modalBackdrop").classList.remove("hidden"); $("#sparkDescription").focus();
}
function closeModal() { $("#modalBackdrop").classList.add("hidden"); }
function newSuggestion() {
  const options = [
    "Try the adversarial version: <strong>assume the compatible space is not compact.</strong> What minimal witness would its failure produce? That witness may tell you which local condition is doing the actual work.",
    "A different decomposition: separate <strong>existence of a compatible point</strong> from <strong>stability under the local rule</strong>. They may use different tools entirely.",
    "Possible analogy: this resembles a <strong>global-consistency</strong> problem. Local constraints do not automatically assemble into a global object; ask what makes them cohere.",
  ];
  const text = options[suggestionIndex++ % options.length]; const time = now();
  state.messages.push({ id: "ai-" + Date.now(), who: "ai", time, text });
  state.events.push({ time, kind: "ai", label: "AI offers an exploratory cue", text: text.replace(/<[^>]+>/g, "") });
  save(); renderMessages(); renderTimeline(); renderCounts(); notice("New cue added to the trace");
}
function exportTrace() {
  const trace = {
    schema: "spark-trace/v0.2", exportedAt: new Date().toISOString(), session: { title: state.title, draft: $("#draft").value },
    taxonomy: { changes: changeAxes.map((entry) => entry[0]), triggers: triggerAxes.map((entry) => entry[0]) },
    messages: state.messages, annotations: state.sparks, trajectory: state.events,
    researchNote: "Annotations distinguish a participant-reported cognitive change from one or more interaction triggers. They do not establish causal attribution or model correctness.",
  };
  const blob = new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" }); const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = "spark-trace-session.json"; link.click(); URL.revokeObjectURL(link.href); notice("Trace exported as JSON");
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => show(button.dataset.view)));
$("#draft").addEventListener("input", (event) => { state.draft = event.target.value; $("#wordCount").textContent = words(event.target.value) + " words"; $("#editState").textContent = "Editing now"; save(); });
$("#sessionTitle").addEventListener("input", (event) => { state.title = event.target.value; save(); });
$("#newSuggestion").addEventListener("click", newSuggestion);
$("#promptForm").addEventListener("submit", (event) => {
  event.preventDefault(); const input = $("#promptInput"); const value = input.value.trim(); if (!value) return;
  const time = now(); state.messages.push({ id: "human-" + Date.now(), who: "user", time, text: esc(value) });
  state.events.push({ time, kind: "human", label: "Asked an exploratory question", text: value }); input.value = "";
  save(); renderMessages(); renderTimeline(); renderCounts(); setTimeout(newSuggestion, 350);
});
$("#openAnnotation").addEventListener("click", openModal);
$("#closeAnnotation").addEventListener("click", closeModal);
$("#cancelAnnotation").addEventListener("click", closeModal);
$("#modalBackdrop").addEventListener("click", (event) => { if (event.target === $("#modalBackdrop")) closeModal(); });
$("#impactPicker").addEventListener("click", (event) => { if (event.target.dataset.change) { selectedChange = event.target.dataset.change; renderPickers(); } });
$("#triggerPicker").addEventListener("click", (event) => {
  const trigger = event.target.dataset.trigger; if (!trigger) return;
  selectedTriggers = selectedTriggers.includes(trigger) ? selectedTriggers.filter((item) => item !== trigger) : selectedTriggers.concat(trigger); renderPickers();
});
$("#annotationForm").addEventListener("submit", (event) => {
  event.preventDefault(); const source = state.messages.find((message) => message.id === $("#sourceMoment").value); const time = now();
  const spark = { id: "s-" + Date.now(), change: selectedChange, triggers: selectedTriggers.length ? selectedTriggers : ["Uncertain"], time, source: "AI suggestion · " + (source ? source.time : time), description: $("#sparkDescription").value.trim(), outcome: $("#sparkOutcome").value };
  state.sparks.push(spark); state.events.push({ time, kind: "spark", label: label(spark) + " spark", text: spark.description });
  save(); renderCards(); renderTimeline(); renderCounts(); closeModal(); notice("Two-layer spark captured in the trajectory");
});
$("#taxonomySearch").addEventListener("input", (event) => renderTaxonomy(event.target.value));
$("#exportButton").addEventListener("click", exportTrace);
$("#addCheckpoint").addEventListener("click", () => { const time = now(); state.events.push({ time, kind: "human", label: "Reflection checkpoint", text: "Participant marked a pause to review the trajectory." }); save(); renderTimeline(); renderCounts(); notice("Checkpoint added"); });
$("#resetDemo").addEventListener("click", () => { if (confirm("Reset this local session to the demo trace?")) { localStorage.removeItem(storageKey); location.reload(); } });
document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); $("#promptForm").requestSubmit(); } if (event.key === "Escape") closeModal(); });
render();
