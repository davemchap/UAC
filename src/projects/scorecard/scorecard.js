/**
 * Forecast Usability Scorecard — fetch + render only.
 * No business logic. All scoring computed server-side via /api/scorecard.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let allData = [];
let activeZoneSlug = null;
let activeTab = "readability";

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  switchTab(location.hash.replace("#", "") || "readability");
  loadData();
  wireTabButtons();
  wireZoneSelect();
  wireDrawerClose();
});

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadData() {
  showLoading(true);
  try {
    const res = await fetch("/api/scorecard");
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const json = await res.json();
    allData = json.data ?? [];
    populateZoneSelect(allData);
    renderAll(activeZoneSlug ? getZoneData(activeZoneSlug) : allData[0]);
  } catch (err) {
    showError(`Failed to load scorecard data: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

async function loadZone(slug) {
  showLoading(true);
  try {
    const res = await fetch(`/api/scorecard/${slug}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const json = await res.json();
    renderAll(json.data);
  } catch (err) {
    showError(`Failed to load zone: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

function getZoneData(slug) {
  return allData.find((d) => d.zoneSlug === slug) ?? allData[0];
}

// ---------------------------------------------------------------------------
// Zone select
// ---------------------------------------------------------------------------

function populateZoneSelect(data) {
  const sel = document.getElementById("zone-select");
  data.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.zoneSlug;
    opt.textContent = d.zoneName;
    sel.appendChild(opt);
  });
}

function wireZoneSelect() {
  document.getElementById("zone-select").addEventListener("change", (e) => {
    activeZoneSlug = e.target.value || null;
    if (activeZoneSlug) loadZone(activeZoneSlug);
    else renderAll(allData[0]);
  });
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

function wireTabButtons() {
  document.querySelectorAll(".sc-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  activeTab = tab;
  location.hash = tab;

  document.querySelectorAll(".sc-tab").forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });

  document.querySelectorAll(".sc-tab-panel").forEach((panel) => {
    const active = panel.id === `tab-${tab}`;
    panel.classList.toggle("active", active);
    panel.classList.toggle("hidden", !active);
  });
}

// ---------------------------------------------------------------------------
// Render dispatcher
// ---------------------------------------------------------------------------

function renderAll(data) {
  if (!data) return;
  renderReadability(data);
  renderJourney(data);
  renderCoach(data);
}

// ---------------------------------------------------------------------------
// Tab 1: Readability Lens
// ---------------------------------------------------------------------------

function renderReadability(data) {
  document.getElementById("readability-zone-title").textContent =
    `${data.zoneName} — ${formatDate(data.dateIssued)} — Danger: ${data.overallDangerRating}`;

  renderPersonaLegend("readability-legend", data.personas);
  renderPersonaScoreRow("readability-persona-scores", data.personas);
  renderPersonaSidebar("readability-cards", data.personas);
  renderAnnotatedForecast("readability-body", data);
}

function renderPersonaLegend(containerId, personas) {
  const el = document.getElementById(containerId);
  el.innerHTML = personas.map((p) =>
    `<span class="sc-legend-item">
      <span class="sc-legend-dot" style="background:${p.color}"></span>
      ${p.personaRole}
    </span>`
  ).join("");
}

function renderPersonaScoreRow(containerId, personas) {
  const el = document.getElementById(containerId);
  el.innerHTML = personas.map((p) =>
    `<div class="sc-metric-chip" style="border-color:${p.color}">
      <span class="sc-metric-dot" style="background:${p.color}"></span>
      <span class="sc-metric-name">${p.personaRole}</span>
      <span class="sc-metric-score" style="color:${p.color}">${p.overall}</span>
    </div>`
  ).join("");
}

function renderPersonaSidebar(containerId, personas) {
  const el = document.getElementById(containerId);
  el.innerHTML = personas.map((p) =>
    `<div class="sc-persona-card">
      <div class="sc-persona-card-header">
        <span class="sc-persona-avatar" style="background:${p.color}20;color:${p.color}">
          ${p.personaName[0]}
        </span>
        <div>
          <div class="sc-persona-card-name">${p.personaName}</div>
          <div class="sc-persona-card-role">${p.personaRole}</div>
        </div>
        <span class="sc-persona-card-score" style="color:${p.color}">${p.overall}</span>
      </div>
      <div class="sc-gauge-bar">
        <div class="sc-gauge-fill" style="width:${p.overall}%;background:${p.color}"></div>
      </div>
      <div class="sc-sub-scores">
        <span class="sc-sub-score">Clarity <b>${p.clarity}</b></span>
        <span class="sc-sub-score">Action <b>${p.actionability}</b></span>
        <span class="sc-sub-score">Jargon <b>${p.jargonLoad}</b></span>
      </div>
    </div>`
  ).join("");
}

function renderAnnotatedForecast(containerId, data) {
  const el = document.getElementById(containerId);

  const forecastText = getForecastDisplayText(data);
  if (!forecastText) {
    el.innerHTML = `<div class="sc-empty-state">
      <p class="sc-empty-title">No forecast text available for this zone.</p>
      <p class="sc-empty-hint">Forecast text will appear here once UAC publishes a forecast for this zone. Check back after the next ingestion cycle.</p>
    </div>`;
    return;
  }

  el.innerHTML = buildAnnotatedText(data, forecastText);

  // Wire hover tooltips
  el.querySelectorAll(".sc-highlight").forEach((span) => {
    span.addEventListener("click", () => openSuggestionDrawer(span.dataset));
  });
}

function buildAnnotatedText(data, forecastText) {
  // Collect all flags across all personas, keyed by start position
  const allFlags = data.personas.flatMap((p) => p.flags ?? []);
  if (allFlags.length === 0) {
    return `<p class="sc-forecast-clean">${escHtml(forecastText)}</p>
      <p class="sc-clean-note">No readability flags found — this forecast scores well across all personas.</p>`;
  }
  // Build highlighted HTML — apply highlights in reverse order to preserve indices
  const sorted = [...allFlags].sort((a, b) => b.startIndex - a.startIndex);
  let result = forecastText;
  for (const flag of sorted) {
    if (flag.startIndex >= result.length) continue;
    const persona = data.personas.find((p) => p.personaId === flag.personaId);
    const color = persona?.color ?? "#999";
    const before = result.slice(0, flag.startIndex);
    const match = result.slice(flag.startIndex, Math.min(flag.endIndex, result.length));
    const after = result.slice(Math.min(flag.endIndex, result.length));
    result = `${before}<mark class="sc-highlight" style="border-bottom:2px solid ${color};background:${color}15" data-persona-id="${flag.personaId}" data-reason="${escAttr(flag.reason)}" data-suggestion="${escAttr(flag.suggestion)}" data-phrase="${escAttr(match)}" tabindex="0" role="button" aria-label="Readability flag: ${escAttr(flag.reason)}">${escHtml(match)}</mark>${after}`;
  }

  return `<div class="sc-forecast-annotated">${result.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</div>`;
}

function getForecastDisplayText(data) {
  const parts = [data.bottomLine, data.currentConditions].filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

function openSuggestionDrawer(dataset) {
  const drawer = document.getElementById("suggestion-drawer");
  const content = document.getElementById("drawer-content");
  const persona = allData.flatMap((d) => d.personas).find((p) => p.personaId === dataset.personaId);

  content.innerHTML = `
    <div class="sc-drawer-persona" style="color:${persona?.color ?? "#666"}">
      ${persona?.personaRole ?? dataset.personaId}
    </div>
    <div class="sc-drawer-phrase">"${escHtml(dataset.phrase ?? "")}"</div>
    <div class="sc-drawer-reason">${escHtml(dataset.reason ?? "")}</div>
    <div class="sc-drawer-suggestion-label">Suggestion</div>
    <div class="sc-drawer-suggestion">${escHtml(dataset.suggestion ?? "")}</div>
    <button class="sc-copy-btn" onclick="copyToClipboard('${escAttr(dataset.suggestion ?? "")}')">
      Copy suggestion
    </button>
  `;
  drawer.classList.remove("hidden");
  drawer.focus();
}

// ---------------------------------------------------------------------------
// Tab 2: Persona Journey
// ---------------------------------------------------------------------------

function renderJourney(data) {
  document.getElementById("journey-zone-title").textContent =
    `${data.zoneName} — ${formatDate(data.dateIssued)}`;

  const map = document.getElementById("journey-map");
  if (!data.journeys?.length) {
    map.innerHTML = "<p class='sc-no-data'>No journey data available.</p>";
    return;
  }

  const sections = [...new Set(data.journeys.flatMap((j) => j.steps.map((s) => s.section)))];

  map.innerHTML = `
    <div class="sc-journey-grid" style="grid-template-columns: 160px repeat(${data.journeys.length}, 1fr)">
      <div class="sc-journey-corner"></div>
      ${data.journeys.map((j) => `
        <div class="sc-journey-persona-header" style="border-top:3px solid ${j.color}">
          <div class="sc-journey-persona-avatar" style="background:${j.color}20;color:${j.color}">${j.personaName[0]}</div>
          <div class="sc-journey-persona-name">${j.personaName}</div>
          <div class="sc-journey-decision sc-decision-${j.finalDecision}">
            ${decisionLabel(j.finalDecision)}
          </div>
          <div class="sc-journey-depth">Read ${j.attentionDepth}/4 sections</div>
        </div>`).join("")}

      ${sections.map((section) => `
        <div class="sc-journey-section-label">${sectionLabel(section)}</div>
        ${data.journeys.map((j) => {
          const step = j.steps.find((s) => s.section === section);
          if (!step) return `<div class="sc-journey-cell sc-cell-skipped">—</div>`;
          return `<div class="sc-journey-cell sc-cell-${step.state}"
              role="button" tabindex="0"
              data-journey-idx="${data.journeys.indexOf(j)}"
              data-section="${section}"
              data-interpretation="${escAttr(step.interpretation)}"
              data-reasoning="${escAttr(step.reasoning)}"
              data-persona-name="${escAttr(j.personaName)}"
              data-color="${j.color}"
              aria-label="${j.personaName}: ${step.state} at ${sectionLabel(section)}">
            ${stateIcon(step.state)}
          </div>`;
        }).join("")}`
      ).join("")}
    </div>
  `;

  map.querySelectorAll(".sc-journey-cell[role=button]").forEach((cell) => {
    cell.addEventListener("click", () => openJourneyDrawer(cell.dataset));
    cell.addEventListener("keydown", (e) => { if (e.key === "Enter") openJourneyDrawer(cell.dataset); });
  });
}

function openJourneyDrawer(dataset) {
  const drawer = document.getElementById("journey-drawer");
  const content = document.getElementById("journey-drawer-content");
  content.innerHTML = `
    <div class="sc-drawer-persona" style="color:${dataset.color}">${escHtml(dataset.personaName)}</div>
    <div class="sc-drawer-section-label">${sectionLabel(dataset.section)}</div>
    <div class="sc-drawer-interpretation">${escHtml(dataset.interpretation ?? "")}</div>
    <div class="sc-drawer-reasoning-label">Why</div>
    <div class="sc-drawer-reasoning">${escHtml(dataset.reasoning ?? "")}</div>
  `;
  drawer.classList.remove("hidden");
}

function decisionLabel(decision) {
  return { correct: "Correct call", wrong: "Wrong call", abandoned: "Abandoned" }[decision] ?? decision;
}

function sectionLabel(section) {
  return {
    danger_rating: "Danger Rating",
    avalanche_problems: "Avalanche Problems",
    bottom_line: "Bottom Line",
    conditions: "Current Conditions",
    travel_advice: "Travel Advice",
  }[section] ?? section;
}

function stateIcon(state) {
  return {
    correct: "✓",
    misunderstood: "⚠",
    skipped: "—",
    wrong_call: "✗",
  }[state] ?? "?";
}

// ---------------------------------------------------------------------------
// Tab 3: Forecaster Coach
// ---------------------------------------------------------------------------

function renderCoach(data) {
  renderCoachHero(data);
  renderCoachPersonaGrades(data);
  renderCoachSuggestions(data);
  renderCoachProgressBars(data);
}

function renderCoachHero(data) {
  const hero = document.getElementById("coach-hero");
  const avgScore = Math.round(data.personas.reduce((s, p) => s + p.overall, 0) / data.personas.length);
  const grade = scoreToGrade(avgScore);
  const gradeColor = gradeColor_(grade);
  const weakest = [...data.personas].sort((a, b) => a.overall - b.overall)[0];

  hero.innerHTML = `
    <div class="sc-coach-grade-card">
      <div class="sc-coach-grade" style="color:${gradeColor};border-color:${gradeColor}">${grade}</div>
      <div class="sc-coach-grade-detail">
        <div class="sc-coach-zone">${data.zoneName}</div>
        <div class="sc-coach-date">${formatDate(data.dateIssued)}</div>
        <div class="sc-coach-summary">
          ${grade === "A" || grade === "B"
            ? `Strong forecast — scores well across most personas.`
            : `Today's forecast loses <strong>${weakest?.personaRole}</strong> most (score: ${weakest?.overall}).`}
        </div>
      </div>
    </div>
    <div class="sc-coach-top3">
      <h3 class="sc-top3-title">Top suggestions</h3>
      ${(data.coaching ?? []).slice(0, 3).map((s, i) =>
        `<div class="sc-top3-item">
          <span class="sc-top3-num">${i + 1}</span>
          <span class="sc-top3-text">${escHtml(s.problem)}</span>
          <span class="sc-top3-impact">+${s.scoreImpact} pts</span>
        </div>`
      ).join("") || "<p class='sc-no-data'>No suggestions — forecast looks good!</p>"}
    </div>
  `;
}

function renderCoachPersonaGrades(data) {
  const el = document.getElementById("coach-persona-grades");
  el.innerHTML = data.personas.map((p) => {
    const grade = scoreToGrade(p.overall);
    const color = gradeColor_(grade);
    return `<div class="sc-coach-persona-tile" style="border-top:3px solid ${p.color}">
      <div class="sc-coach-tile-grade" style="background:${color}15;color:${color}">${grade}</div>
      <div class="sc-coach-tile-name">${p.personaRole}</div>
      <div class="sc-coach-tile-issue">${worstIssue(p)}</div>
    </div>`;
  }).join("");
}

function renderCoachSuggestions(data) {
  const list = document.getElementById("suggestions-list");
  const suggestions = data.coaching ?? [];
  if (!suggestions.length) {
    list.innerHTML = "<p class='sc-no-data'>No suggestions — this forecast scores well across all personas.</p>";
    return;
  }

  list.innerHTML = suggestions.map((s) => {
    const persona = data.personas.find((p) => p.personaId === s.personaId);
    return `<div class="sc-suggestion-card">
      <div class="sc-suggestion-header">
        <span class="sc-suggestion-persona" style="color:${persona?.color ?? '#666'}">${s.personaName}</span>
        <span class="sc-suggestion-section">${s.section}</span>
        <span class="sc-suggestion-impact">+${s.scoreImpact} pts</span>
      </div>
      <div class="sc-suggestion-problem">${escHtml(s.problem)}</div>
      ${s.originalText ? `<div class="sc-suggestion-original">"${escHtml(s.originalText)}"</div>` : ""}
      <div class="sc-suggestion-text">${escHtml(s.suggestion)}</div>
      <div class="sc-suggestion-actions">
        <button class="sc-copy-btn" onclick="copyToClipboard('${escAttr(s.suggestion)}')">Copy</button>
        <button class="sc-dismiss-btn" onclick="this.closest('.sc-suggestion-card').style.opacity='0.4'">Not helpful</button>
      </div>
    </div>`;
  }).join("");
}

function renderCoachProgressBars(data) {
  const el = document.getElementById("coach-progress-bars");
  el.innerHTML = data.personas.map((p) =>
    `<div class="sc-progress-row">
      <span class="sc-progress-label" style="color:${p.color}">${p.personaRole}</span>
      <div class="sc-progress-track">
        <div class="sc-progress-fill" style="width:${p.overall}%;background:${p.color}"></div>
      </div>
      <span class="sc-progress-val">${p.overall}</span>
    </div>`
  ).join("");
}

function worstIssue(persona) {
  const scores = { clarity: persona.clarity, actionability: persona.actionability, jargon: persona.jargonLoad };
  const worst = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
  return { clarity: "Clarity issues", actionability: "Buried action", jargon: "Jargon overload" }[worst[0]] ?? "Needs review";
}

function scoreToGrade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function gradeColor_(grade) {
  return { A: "#16A34A", B: "#CA8A04", C: "#EA580C", D: "#DC2626", F: "#991B1B" }[grade] ?? "#666";
}

// ---------------------------------------------------------------------------
// Drawer close
// ---------------------------------------------------------------------------

function wireDrawerClose() {
  document.getElementById("drawer-close").addEventListener("click", () =>
    document.getElementById("suggestion-drawer").classList.add("hidden"));
  document.getElementById("journey-drawer-close").addEventListener("click", () =>
    document.getElementById("journey-drawer").classList.add("hidden"));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.getElementById("suggestion-drawer").classList.add("hidden");
      document.getElementById("journey-drawer").classList.add("hidden");
    }
  });
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function showLoading(show) {
  document.getElementById("sc-loading").classList.toggle("hidden", !show);
}

function showError(msg) {
  const el = document.getElementById("sc-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try { return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return dateStr; }
}

function escHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}
