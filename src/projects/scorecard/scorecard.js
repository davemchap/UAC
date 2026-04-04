/**
 * Forecast Usability Scorecard — fetch + render only.
 * No business logic. All scoring computed server-side via /api/scorecard.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let allData = [];
let activeZoneSlug = null;
let activeForecaster = null;

// Dismissed suggestions: { [zoneSlug]: Set<string> } — persisted in sessionStorage
function getDismissed(zoneSlug) {
  try {
    const raw = sessionStorage.getItem(`sc-dismissed-${zoneSlug}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function addDismissed(zoneSlug, key) {
  const set = getDismissed(zoneSlug);
  set.add(key);
  try { sessionStorage.setItem(`sc-dismissed-${zoneSlug}`, JSON.stringify([...set])); } catch {}
}
function suggestionKey(s) { return `${s.personaId}:${s.section}`; }
let activeTab = "readability";

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  switchTab(location.hash.replace("#", "") || "readability");
  loadData();
  wireTabButtons();
  wireForecasterSelect();
  wireZoneSelect();
  wireDrawerClose();
  wireTrainerModal();
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
    populateForecasterSelect(allData);
    populateZoneSelect(getFilteredData());
    renderSummaryOrZone();
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

function getFilteredData() {
  if (!activeForecaster) return allData;
  return allData.filter((d) => d.forecasterName === activeForecaster);
}

// ---------------------------------------------------------------------------
// Forecaster select
// ---------------------------------------------------------------------------

function populateForecasterSelect(data) {
  const sel = document.getElementById("forecaster-select");
  const names = [...new Set(data.map((d) => d.forecasterName).filter(Boolean))].sort();
  // Reset to just the default option
  sel.innerHTML = '<option value="">All Forecasters</option>';
  if (names.length === 0) {
    console.warn("[scorecard] No forecasterName values found in API response");
  }
  names.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

function wireForecasterSelect() {
  document.getElementById("forecaster-select").addEventListener("change", (e) => {
    activeForecaster = e.target.value || null;
    activeZoneSlug = null;
    const filtered = getFilteredData();
    populateZoneSelect(filtered);
    document.getElementById("zone-select").value = "";
    updateActiveFilterPill();
    renderSummaryOrZone();
  });
}

function updateActiveFilterPill() {
  const existing = document.getElementById("sc-forecaster-pill");
  if (existing) existing.remove();
  if (!activeForecaster) return;
  const controls = document.querySelector(".sc-controls");
  const pill = document.createElement("span");
  pill.id = "sc-forecaster-pill";
  pill.className = "sc-active-filter";
  pill.innerHTML = `Viewing: ${escHtml(activeForecaster)} <span class="sc-active-filter-x" role="button" aria-label="Clear forecaster filter" tabindex="0">&times;</span>`;
  // Insert before the back link
  const backLink = controls.querySelector(".sc-back-link");
  controls.insertBefore(pill, backLink);
  const x = pill.querySelector(".sc-active-filter-x");
  const clearFilter = () => {
    activeForecaster = null;
    document.getElementById("forecaster-select").value = "";
    const filtered = getFilteredData();
    populateZoneSelect(filtered);
    document.getElementById("zone-select").value = "";
    updateActiveFilterPill();
    renderSummaryOrZone();
  };
  x.addEventListener("click", clearFilter);
  x.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clearFilter(); } });
}

// ---------------------------------------------------------------------------
// Zone select
// ---------------------------------------------------------------------------

function populateZoneSelect(data) {
  const sel = document.getElementById("zone-select");
  // Reset to just the default option
  sel.innerHTML = '<option value="">All Zones</option>';
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
    else renderSummaryOrZone();
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
// Summary / dispatch
// ---------------------------------------------------------------------------

function renderSummaryOrZone() {
  if (activeZoneSlug) { loadZone(activeZoneSlug); return; }
  const filtered = getFilteredData();
  if (!filtered.length) { renderAll(null); return; }
  renderSummary(filtered);
}

function renderSummary(zones) {
  const summaryEl = document.getElementById("sc-summary");
  const tabsEl = document.querySelector(".sc-tabs");
  // Hide tabs + tab panels, show summary
  tabsEl.classList.add("hidden");
  document.querySelectorAll(".sc-tab-panel").forEach((p) => p.classList.add("hidden"));
  summaryEl.classList.remove("hidden");
  const emptyEl = document.getElementById("sc-filter-empty");
  if (emptyEl) emptyEl.classList.add("hidden");

  // Derive persona columns from first zone
  const personas = zones[0]?.personas ?? [];
  const dangerColors = { Low: "#16a34a", Moderate: "#ca8a04", Considerable: "#ea580c", High: "#dc2626", Extreme: "#7c3aed", None: "#8a9bac" };

  summaryEl.innerHTML = `
    <div class="sc-summary-header">
      <h2 class="sc-summary-title">${activeForecaster ? `${escHtml(activeForecaster)}'s Zones` : "All Zones"} — Today's Scores</h2>
      <p class="sc-summary-hint">Select a zone for detailed analysis</p>
    </div>
    <div class="sc-summary-table-wrap">
      <table class="sc-summary-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Forecaster</th>
            <th>Danger</th>
            ${personas.map((p) => `<th style="color:${p.color}">${p.personaRole}</th>`).join("")}
            <th>Avg</th>
          </tr>
        </thead>
        <tbody>
          ${zones.map((z) => {
            const avg = Math.round(z.personas.reduce((s, p) => s + p.overall, 0) / z.personas.length);
            const avgColor = avg >= 80 ? "#16a34a" : avg >= 60 ? "#ca8a04" : "#dc2626";
            const danger = z.overallDangerRating ?? "—";
            const dColor = dangerColors[danger] ?? "#8a9bac";
            return `<tr class="sc-summary-row" data-slug="${escAttr(z.zoneSlug)}" tabindex="0" role="button" aria-label="View ${escHtml(z.zoneName)}">
              <td class="sc-summary-zone">${escHtml(z.zoneName)}</td>
              <td class="sc-summary-forecaster">${escHtml(z.forecasterName ?? "—")}</td>
              <td><span class="sc-summary-danger" style="color:${dColor}">${escHtml(danger)}</span></td>
              ${z.personas.map((p) => `<td><span class="sc-summary-score" style="color:${p.color}">${p.overall}</span></td>`).join("")}
              <td><span class="sc-summary-avg" style="color:${avgColor}">${avg}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  summaryEl.querySelectorAll(".sc-summary-row").forEach((row) => {
    const select = () => {
      activeZoneSlug = row.dataset.slug;
      document.getElementById("zone-select").value = activeZoneSlug;
      loadZone(activeZoneSlug);
    };
    row.addEventListener("click", select);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } });
  });
}

function hideSummary() {
  document.getElementById("sc-summary").classList.add("hidden");
  document.querySelector(".sc-tabs").classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Render dispatcher
// ---------------------------------------------------------------------------

function renderAll(data) {
  if (!data) {
    // Show empty state when filter produces no results
    const forecasterLabel = activeForecaster ? activeForecaster : null;
    if (forecasterLabel) {
      const main = document.querySelector(".sc-main");
      // Hide tab panels
      document.querySelectorAll(".sc-tab-panel").forEach((p) => p.classList.add("hidden"));
      // Show or update empty state
      let emptyEl = document.getElementById("sc-filter-empty");
      if (!emptyEl) {
        emptyEl = document.createElement("div");
        emptyEl.id = "sc-filter-empty";
        emptyEl.className = "sc-filter-empty";
        main.appendChild(emptyEl);
      }
      emptyEl.classList.remove("hidden");
      emptyEl.innerHTML = `<p class="sc-empty-title">No forecasts found for <strong>${escHtml(forecasterLabel)}</strong>.</p><p class="sc-empty-hint">Try selecting a different forecaster or zone.</p>`;
    }
    return;
  }
  hideSummary();
  // Clear empty state if present
  const emptyEl = document.getElementById("sc-filter-empty");
  if (emptyEl) emptyEl.classList.add("hidden");
  // Restore tab panels
  document.querySelectorAll(".sc-tab-panel").forEach((p) => {
    const tabId = p.id.replace("tab-", "");
    p.classList.toggle("hidden", tabId !== activeTab);
    p.classList.toggle("active", tabId === activeTab);
  });
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
  renderScoreDistribution(data);
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
    `<div class="sc-metric-chip" style="border-color:${p.color}"
        role="button" aria-pressed="true" tabindex="0"
        title="Click to hide ${escAttr(p.personaRole)} highlights"
        data-persona-id="${escAttr(p.personaId)}"
        data-persona-role="${escAttr(p.personaRole)}">
      <span class="sc-metric-dot" style="background:${p.color}"></span>
      <span class="sc-metric-name">${p.personaRole}</span>
      <span class="sc-metric-score" style="color:${p.color}">${p.overall}</span>
      <span class="sc-metric-eye" aria-hidden="true">●</span>
    </div>`
  ).join("");
  el.querySelectorAll(".sc-metric-chip").forEach((chip) => {
    const role = chip.dataset.personaRole;
    const toggle = () => {
      const active = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", active ? "false" : "true");
      chip.title = active ? `Click to show ${role} highlights` : `Click to hide ${role} highlights`;
      const id = chip.dataset.personaId;
      document.querySelectorAll(`.sc-highlight[data-persona-id="${id}"]`).forEach((m) => {
        m.classList.toggle("sc-highlight--hidden", active);
      });
    };
    chip.addEventListener("click", toggle);
    chip.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
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

function renderScoreDistribution(data) {
  const el = document.getElementById("readability-trend");
  if (!el) return;
  const dims = [
    { key: "clarity", label: "Clarity" },
    { key: "actionability", label: "Actionability" },
    { key: "jargonLoad", label: "Jargon-free" },
  ];
  el.innerHTML = dims.map((dim) =>
    `<div class="sc-dist-row">
      <span class="sc-dist-label">${dim.label}</span>
      <div class="sc-dist-bars">
        ${data.personas.map((p) =>
          `<div class="sc-dist-bar-wrap" title="${escAttr(p.personaRole)}: ${p[dim.key]}">
            <div class="sc-dist-bar" style="width:${p[dim.key]}%;background:${p.color}"></div>
          </div>`
        ).join("")}
      </div>
      <span class="sc-dist-avg">${Math.round(data.personas.reduce((s, p) => s + p[dim.key], 0) / data.personas.length)}</span>
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
  // Collect all flags across all personas
  const allFlags = data.personas.flatMap((p) => p.flags ?? []);
  if (allFlags.length === 0) {
    return `<p class="sc-forecast-clean">${escHtml(forecastText)}</p>
      <p class="sc-clean-note">No readability flags found — this forecast scores well across all personas.</p>`;
  }

  // Forward pass: sort ascending, skip overlapping flags, escape plain segments
  const sorted = [...allFlags]
    .filter((f) => f.startIndex >= 0 && f.startIndex < f.endIndex && f.endIndex <= forecastText.length)
    .sort((a, b) => a.startIndex - b.startIndex);

  let result = "";
  let pos = 0;
  for (const flag of sorted) {
    if (flag.startIndex < pos) continue; // skip overlapping
    const persona = data.personas.find((p) => p.personaId === flag.personaId);
    const color = persona?.color ?? "#999";
    const phrase = forecastText.slice(flag.startIndex, flag.endIndex);
    result += escHtml(forecastText.slice(pos, flag.startIndex));
    result += `<mark class="sc-highlight" style="border-bottom:2px solid ${color};background:${color}15" data-persona-id="${flag.personaId}" data-reason="${escAttr(flag.reason)}" data-suggestion="${escAttr(flag.suggestion)}" data-phrase="${escAttr(phrase)}" tabindex="0" role="button" aria-label="Readability flag: ${escAttr(flag.reason)}">${escHtml(phrase)}</mark>`;
    pos = flag.endIndex;
  }
  result += escHtml(forecastText.slice(pos));

  return `<div class="sc-forecast-annotated">${result.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>")}</div>`;
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
    <button class="sc-copy-btn" onclick="copyToClipboard(this,'${escAttr(dataset.suggestion ?? "")}')">
      Copy suggestion
    </button>
  `;
  drawer.classList.remove("hidden");
  drawer.focus();
}

// ---------------------------------------------------------------------------
// Tab 2: Persona Journey
// ---------------------------------------------------------------------------

function renderReportPreview(bodyId, data) {
  const el = document.getElementById(bodyId);
  if (!el) return;
  const text = getForecastDisplayText(data);
  if (!text) { el.textContent = "No report text available."; return; }
  el.innerHTML = escHtml(text).replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
}

function renderJourney(data) {
  document.getElementById("journey-zone-title").textContent =
    `${data.zoneName} — ${formatDate(data.dateIssued)}`;
  renderReportPreview("journey-report-body", data);

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
  renderReportPreview("coach-report-body", data);
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

  const zoneSlug = data.zoneSlug ?? "";
  const dismissed = getDismissed(zoneSlug);
  const visible = suggestions.filter((s) => !dismissed.has(suggestionKey(s)));
  const hiddenCount = suggestions.length - visible.length;

  if (!visible.length) {
    list.innerHTML = `<p class='sc-no-data'>No suggestions — ${hiddenCount ? `${hiddenCount} dismissed. ` : ""}This forecast scores well across all personas.</p>`;
    if (hiddenCount) {
      const restore = document.createElement("button");
      restore.className = "sc-restore-btn";
      restore.textContent = `Show ${hiddenCount} dismissed`;
      restore.onclick = () => { try { sessionStorage.removeItem(`sc-dismissed-${zoneSlug}`); } catch {} renderCoachSuggestions(data); };
      list.appendChild(restore);
    }
    return;
  }

  list.innerHTML = visible.map((s) => {
    const persona = data.personas.find((p) => p.personaId === s.personaId);
    const key = escAttr(suggestionKey(s));
    return `<div class="sc-suggestion-card" data-key="${key}">
      <div class="sc-suggestion-header">
        <span class="sc-suggestion-persona" style="color:${persona?.color ?? '#666'}">${s.personaName}</span>
        <span class="sc-suggestion-section">${escHtml(sectionLabel(s.section))}</span>
        <span class="sc-suggestion-impact">+${s.scoreImpact} pts</span>
      </div>
      <div class="sc-suggestion-problem">${escHtml(s.problem)}</div>
      ${s.originalText ? `<div class="sc-suggestion-original">"${escHtml(s.originalText)}"</div>` : ""}
      <div class="sc-suggestion-text">${escHtml(s.suggestion)}</div>
      <div class="sc-suggestion-actions">
        <button class="sc-copy-btn" onclick="copyToClipboard(this,'${escAttr(s.suggestion)}')">Copy</button>
        <button class="sc-dismiss-btn" data-zone="${escAttr(zoneSlug)}" data-key="${key}">Not helpful</button>
      </div>
    </div>`;
  }).join("");

  if (hiddenCount) {
    const restore = document.createElement("button");
    restore.className = "sc-restore-btn";
    restore.textContent = `Show ${hiddenCount} dismissed`;
    restore.onclick = () => { try { sessionStorage.removeItem(`sc-dismissed-${zoneSlug}`); } catch {} renderCoachSuggestions(data); };
    list.appendChild(restore);
  }

  list.querySelectorAll(".sc-dismiss-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      addDismissed(btn.dataset.zone, btn.dataset.key);
      renderCoachSuggestions(data);
    });
  });
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
  // UAC format: "Thursday, April 2, 2026 - 7:08am" — extract "Month D, YYYY"
  const match = dateStr.match(/(\w+ \d{1,2}, \d{4})/);
  const str = match ? match[1] : dateStr;
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function escHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function copyToClipboard(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
  }).catch(() => {
    const orig = btn.textContent;
    btn.textContent = "Failed";
    btn.style.background = "#dc2626";
    setTimeout(() => { btn.textContent = orig; btn.style.background = ""; btn.disabled = false; }, 2000);
  });
}

// ===========================================================================
// Trainer Modal
// ===========================================================================

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let trainerPersonas = [];
let trainerActiveKey = null;
let trainerUnsaved = {}; // { [key]: { parameters?: true, identity?: true } }
let trainerOriginals = {}; // { [key]: PersonaRecord } — snapshots for Reset

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function wireTrainerModal() {
  document.getElementById("train-personas-btn").addEventListener("click", openTrainerModal);
  document.getElementById("trainer-close-btn").addEventListener("click", closeTrainerModal);
  document.getElementById("trainer-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeTrainerModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("trainer-modal").hidden) closeTrainerModal();
  });
}

// ---------------------------------------------------------------------------
// Open / close
// ---------------------------------------------------------------------------

function openTrainerModal() {
  document.getElementById("trainer-modal").hidden = false;
  document.body.style.overflow = "hidden";
  loadPersonas();
}

function closeTrainerModal() {
  document.getElementById("trainer-modal").hidden = true;
  document.body.style.overflow = "";
  trainerActiveKey = null;
  trainerUnsaved = {};
}

// ---------------------------------------------------------------------------
// Load personas from API
// ---------------------------------------------------------------------------

async function loadPersonas() {
  try {
    const res = await fetch("/api/personas");
    if (!res.ok) throw new Error(`API error ${res.status}`);
    trainerPersonas = await res.json();
    // Snapshot originals for reset
    trainerOriginals = {};
    for (const p of trainerPersonas) {
      trainerOriginals[p.personaKey] = { ...p, unknownTerms: [...p.unknownTerms] };
    }
    renderRoster();
    // Auto-select first persona
    if (trainerPersonas.length > 0 && !trainerActiveKey) {
      selectPersona(trainerPersonas[0].personaKey);
    }
  } catch (err) {
    showTrainerToast(`Failed to load personas: ${err.message}`, true);
  }
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

function renderRoster() {
  const roster = document.getElementById("trainer-roster");
  roster.innerHTML = "";
  for (const p of trainerPersonas) {
    const card = document.createElement("div");
    card.className = "trainer-persona-card" +
      (p.personaKey === trainerActiveKey ? " active" : "") +
      (hasUnsaved(p.personaKey) ? " has-unsaved" : "");
    card.style.borderLeftColor = p.color;
    card.dataset.key = p.personaKey;
    card.innerHTML = `
      <div class="trainer-persona-card-name">${escHtml(p.name)}</div>
      <div class="trainer-persona-card-role">${escHtml(p.role)}</div>
      <div class="trainer-persona-card-literacy">${escHtml(p.literacyLevel)}</div>
      <div class="trainer-persona-unsaved"></div>
    `;
    card.addEventListener("click", () => selectPersona(p.personaKey));
    roster.appendChild(card);
  }
}

function hasUnsaved(key) {
  const u = trainerUnsaved[key];
  return u && (u.parameters || u.identity);
}

// ---------------------------------------------------------------------------
// Select persona
// ---------------------------------------------------------------------------

function selectPersona(key) {
  trainerActiveKey = key;
  const persona = trainerPersonas.find((p) => p.personaKey === key);
  if (!persona) return;

  // Update roster selection
  document.querySelectorAll(".trainer-persona-card").forEach((c) => {
    c.classList.toggle("active", c.dataset.key === key);
  });

  // Show detail panel
  document.getElementById("trainer-detail-empty").classList.add("hidden");
  document.getElementById("trainer-detail-panel").classList.remove("hidden");

  // Switch to first trainer tab
  switchTrainerTab("parameters");

  // Populate fields
  populateParametersTab(persona);
  populateIdentityTab(persona);
  clearInterrogateTab();

  wireDetailActions(key);
}

// ---------------------------------------------------------------------------
// Trainer tab switching
// ---------------------------------------------------------------------------

function switchTrainerTab(tabName) {
  document.querySelectorAll(".trainer-tab").forEach((btn) => {
    const active = btn.dataset.trainerTab === tabName;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".trainer-tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `trainer-panel-${tabName}`);
    panel.classList.toggle("hidden", panel.id !== `trainer-panel-${tabName}`);
  });
}

// Wire trainer tab buttons (called once after detail panel is shown)
function wireTrainerTabButtons() {
  document.querySelectorAll(".trainer-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTrainerTab(btn.dataset.trainerTab));
  });
}

// ---------------------------------------------------------------------------
// Parameters tab
// ---------------------------------------------------------------------------

function populateParametersTab(persona) {
  renderTags(persona.unknownTerms ?? []);
  document.getElementById("trainer-max-sentence").value = persona.maxSentenceLength;
  document.getElementById("trainer-max-grade").value = persona.maxGradeLevel;
  document.getElementById("trainer-success-criteria").value = persona.successCriteria;
}

function renderTags(terms) {
  const container = document.getElementById("trainer-tags");
  container.innerHTML = "";
  for (const term of terms) {
    const chip = document.createElement("span");
    chip.className = "trainer-tag";
    chip.innerHTML = `${escHtml(term)} <button class="trainer-tag-remove" aria-label="Remove ${escAttr(term)}">&times;</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      removeTag(term);
    });
    container.appendChild(chip);
  }
}

function getCurrentTags() {
  return [...document.querySelectorAll("#trainer-tags .trainer-tag")].map((c) =>
    c.textContent.trim().replace(/×$/, "").trim()
  );
}

function removeTag(term) {
  const persona = trainerPersonas.find((p) => p.personaKey === trainerActiveKey);
  if (!persona) return;
  persona.unknownTerms = (persona.unknownTerms ?? []).filter((t) => t !== term);
  renderTags(persona.unknownTerms);
  markUnsaved(trainerActiveKey, "parameters");
}

function wireTagInput() {
  const input = document.getElementById("trainer-tag-input");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value.trim().toLowerCase();
      if (!val) return;
      const persona = trainerPersonas.find((p) => p.personaKey === trainerActiveKey);
      if (!persona) return;
      if (!(persona.unknownTerms ?? []).includes(val)) {
        persona.unknownTerms = [...(persona.unknownTerms ?? []), val];
        renderTags(persona.unknownTerms);
        markUnsaved(trainerActiveKey, "parameters");
      }
      input.value = "";
    }
  });
}

// ---------------------------------------------------------------------------
// Identity tab
// ---------------------------------------------------------------------------

function buildBaselineProfile(persona) {
  const LITERACY_LABELS = {
    low: "Low literacy",
    high: "High literacy",
    expert: "Expert",
    forecaster: "Forecaster-tier",
  };
  const literacyLabel = LITERACY_LABELS[persona.literacyLevel] ?? persona.literacyLevel;
  const terms = persona.unknownTerms ?? [];
  const preview = terms.slice(0, 6);
  const remaining = terms.length - preview.length;

  const termChips = preview
    .map((t) => `<span class="trainer-baseline-term">${escHtml(t)}</span>`)
    .join("");
  const moreChip = remaining > 0
    ? `<span class="trainer-baseline-term-more">+${remaining} more</span>`
    : "";

  const jargonLine = terms.length > 0
    ? `Does not understand <strong>${terms.length} technical terms</strong>.`
    : "No jargon restrictions — reads all technical language.";

  return `
    <div class="trainer-baseline-header">
      <span class="trainer-baseline-label">Parameter Baseline</span>
      <span class="trainer-baseline-literacy">${escHtml(literacyLabel)}</span>
    </div>
    <div class="trainer-baseline-prose">
      ${escHtml(persona.name)} evaluates forecasts against a
      <strong>grade ${persona.maxGradeLevel} reading ceiling</strong> and a
      <strong>${persona.maxSentenceLength}-word sentence limit</strong>.
      ${jargonLine}
    </div>
    ${terms.length > 0 ? `<div class="trainer-baseline-terms">${termChips}${moreChip}</div>` : ""}
    <div class="trainer-baseline-success">
      <strong>Success looks like:</strong> ${escHtml(persona.successCriteria)}
    </div>`;
}

function populateIdentityTab(persona) {
  document.getElementById("trainer-baseline-profile").innerHTML = buildBaselineProfile(persona);
  const ctx = persona.behavioralContext ?? "";
  document.getElementById("trainer-behavioral-context").value = ctx;
  updateCharCount();
  renderInstructions(ctx);
}

function updateCharCount() {
  const val = document.getElementById("trainer-behavioral-context").value;
  document.getElementById("trainer-char-count").textContent = `${val.length} characters`;
}

function renderInstructions(behavioralContext) {
  const list = document.getElementById("trainer-instructions-list");
  if (!behavioralContext) {
    list.innerHTML = '<p class="trainer-instructions-empty">No instructions injected yet.</p>';
    return;
  }
  // Parse injected entries — separated by \n\n---\n\n
  const segments = behavioralContext.split("\n\n---\n\n").filter(Boolean);
  if (segments.length === 0) {
    list.innerHTML = '<p class="trainer-instructions-empty">No instructions injected yet.</p>';
    return;
  }
  list.innerHTML = "";
  // Newest first
  for (const seg of [...segments].reverse()) {
    const item = document.createElement("div");
    item.className = "trainer-instruction-item";
    item.innerHTML = `<span class="trainer-instruction-text">${escHtml(seg.trim())}</span>
      <button class="trainer-instruction-remove" aria-label="Remove instruction">&times;</button>`;
    item.querySelector("button").addEventListener("click", () => {
      removeInstruction(seg);
    });
    list.appendChild(item);
  }
}

function removeInstruction(seg) {
  const persona = trainerPersonas.find((p) => p.personaKey === trainerActiveKey);
  if (!persona) return;
  const segments = (persona.behavioralContext ?? "").split("\n\n---\n\n").filter(Boolean);
  const filtered = segments.filter((s) => s !== seg);
  persona.behavioralContext = filtered.join("\n\n---\n\n") || null;
  document.getElementById("trainer-behavioral-context").value = persona.behavioralContext ?? "";
  updateCharCount();
  renderInstructions(persona.behavioralContext ?? "");
  markUnsaved(trainerActiveKey, "identity");
}

// ---------------------------------------------------------------------------
// Interrogate tab
// ---------------------------------------------------------------------------

function clearInterrogateTab() {
  document.getElementById("trainer-question").value = "";
  document.getElementById("trainer-response-area").hidden = true;
  document.getElementById("trainer-response-area").innerHTML = "";
}

// ---------------------------------------------------------------------------
// Wire detail actions
// ---------------------------------------------------------------------------

function wireDetailActions(key) {
  wireTrainerTabButtons();
  wireTagInput();

  // Char count
  document.getElementById("trainer-behavioral-context").addEventListener("input", () => {
    updateCharCount();
    const persona = trainerPersonas.find((p) => p.personaKey === key);
    if (persona) persona.behavioralContext = document.getElementById("trainer-behavioral-context").value || null;
    markUnsaved(key, "identity");
  });

  // Parameters inputs → mark unsaved
  ["trainer-max-sentence", "trainer-max-grade", "trainer-success-criteria"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => markUnsaved(key, "parameters"));
  });

  // Save parameters
  document.getElementById("trainer-save-params").onclick = () => saveParameters(key);

  // Reset parameters
  document.getElementById("trainer-reset-params").onclick = () => resetParameters(key);

  // Save identity
  document.getElementById("trainer-save-identity").onclick = () => saveIdentity(key);

  // Inject
  document.getElementById("trainer-inject-btn").onclick = () => {
    const instruction = document.getElementById("trainer-inject-input").value.trim();
    if (!instruction) return;
    injectInstruction(key, instruction);
  };

  // Ask
  document.getElementById("trainer-ask-btn").onclick = () => {
    const question = document.getElementById("trainer-question").value.trim();
    if (!question) return;
    askPersona(key, question);
  };
}

// ---------------------------------------------------------------------------
// Unsaved tracking
// ---------------------------------------------------------------------------

function markUnsaved(key, section) {
  if (!trainerUnsaved[key]) trainerUnsaved[key] = {};
  trainerUnsaved[key][section] = true;
  renderRoster();
  // Mark tab
  document.querySelectorAll(".trainer-tab").forEach((btn) => {
    if (btn.dataset.trainerTab === section) btn.classList.add("has-unsaved");
  });
}

function clearUnsaved(key, section) {
  if (trainerUnsaved[key]) delete trainerUnsaved[key][section];
  renderRoster();
  document.querySelectorAll(".trainer-tab").forEach((btn) => {
    if (btn.dataset.trainerTab === section) btn.classList.remove("has-unsaved");
  });
}

// ---------------------------------------------------------------------------
// Save / reset
// ---------------------------------------------------------------------------

async function saveParameters(key) {
  const persona = trainerPersonas.find((p) => p.personaKey === key);
  if (!persona) return;

  const tags = getCurrentTags();
  const maxSentence = parseInt(document.getElementById("trainer-max-sentence").value, 10);
  const maxGrade = parseFloat(document.getElementById("trainer-max-grade").value);
  const successCriteria = document.getElementById("trainer-success-criteria").value.trim();

  if (!successCriteria) { showTrainerToast("Success criteria cannot be empty.", true); return; }

  try {
    const res = await fetch(`/api/personas/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unknownTerms: tags, maxSentenceLength: maxSentence, maxGradeLevel: maxGrade, successCriteria }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const updated = await res.json();
    Object.assign(persona, updated);
    trainerOriginals[key] = { ...updated, unknownTerms: [...updated.unknownTerms] };
    clearUnsaved(key, "parameters");
    showTrainerToast("Parameters saved.");
  } catch (err) {
    showTrainerToast(`Save failed: ${err.message}`, true);
  }
}

async function saveIdentity(key) {
  const persona = trainerPersonas.find((p) => p.personaKey === key);
  if (!persona) return;

  const behavioralContext = document.getElementById("trainer-behavioral-context").value.trim() || null;

  try {
    const res = await fetch(`/api/personas/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ behavioralContext }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const updated = await res.json();
    Object.assign(persona, updated);
    trainerOriginals[key] = { ...updated, unknownTerms: [...updated.unknownTerms] };
    clearUnsaved(key, "identity");
    renderInstructions(updated.behavioralContext ?? "");
    showTrainerToast("Identity saved.");
  } catch (err) {
    showTrainerToast(`Save failed: ${err.message}`, true);
  }
}

function resetParameters(key) {
  const original = trainerOriginals[key];
  if (!original) return;
  const persona = trainerPersonas.find((p) => p.personaKey === key);
  if (!persona) return;
  persona.unknownTerms = [...original.unknownTerms];
  persona.maxSentenceLength = original.maxSentenceLength;
  persona.maxGradeLevel = original.maxGradeLevel;
  persona.successCriteria = original.successCriteria;
  populateParametersTab(persona);
  clearUnsaved(key, "parameters");
}

// ---------------------------------------------------------------------------
// Inject instruction
// ---------------------------------------------------------------------------

async function injectInstruction(key, instruction) {
  try {
    const res = await fetch(`/api/personas/${key}/inject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const updated = await res.json();
    const persona = trainerPersonas.find((p) => p.personaKey === key);
    if (persona) Object.assign(persona, updated);
    document.getElementById("trainer-inject-input").value = "";
    document.getElementById("trainer-behavioral-context").value = updated.behavioralContext ?? "";
    updateCharCount();
    renderInstructions(updated.behavioralContext ?? "");
    showTrainerToast("Instruction injected.");
  } catch (err) {
    showTrainerToast(`Inject failed: ${err.message}`, true);
  }
}

// ---------------------------------------------------------------------------
// Ask persona (AI interrogation)
// ---------------------------------------------------------------------------

async function askPersona(key, question) {
  const area = document.getElementById("trainer-response-area");
  const persona = trainerPersonas.find((p) => p.personaKey === key);
  const btn = document.getElementById("trainer-ask-btn");

  area.hidden = false;
  area.innerHTML = `
    <div class="trainer-response-card">
      <div class="trainer-skeleton trainer-skeleton-line" style="width:40%"></div>
      <div class="trainer-skeleton trainer-skeleton-line"></div>
      <div class="trainer-skeleton trainer-skeleton-line"></div>
      <div class="trainer-skeleton trainer-skeleton-line"></div>
    </div>`;
  btn.disabled = true;

  try {
    const res = await fetch(`/api/personas/${key}/interrogate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    const instructionCount = countInstructions(persona?.behavioralContext ?? "");
    area.innerHTML = `
      <div class="trainer-response-card" style="border-left-color:${escAttr(persona?.color ?? "#3a7f9c")}">
        <div class="trainer-response-persona">
          <span class="trainer-response-dot" style="background:${escAttr(persona?.color ?? "#3a7f9c")}"></span>
          <span class="trainer-response-name">${escHtml(data.personaName)}</span>
        </div>
        <p class="trainer-response-text">${escHtml(data.response)}</p>
        <div class="trainer-response-footer">${instructionCount} active instruction${instructionCount !== 1 ? "s" : ""}</div>
      </div>`;
  } catch (err) {
    area.innerHTML = `<p style="color:#ef4444;font-size:0.85rem">Error: ${escHtml(err.message)}</p>`;
  } finally {
    btn.disabled = false;
  }
}

function countInstructions(behavioralContext) {
  if (!behavioralContext) return 0;
  return behavioralContext.split("\n\n---\n\n").filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

let _toastTimer = null;

function showTrainerToast(message, isError = false) {
  const toast = document.getElementById("trainer-toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.remove("hidden");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}
