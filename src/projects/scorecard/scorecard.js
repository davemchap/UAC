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
let activeCoachModeFilter = "all";

const TRAINING_LABELS = ['None', 'Awareness', 'AIARE 1', 'AIARE 2', 'Pro 1', 'Pro 2+'];

function trainingLabel(level) {
  return TRAINING_LABELS[Math.min(level ?? 0, 5)] ?? 'None';
}

const TRAVEL_MODE_META = {
  'human-powered': { icon: '🎿', label: 'Human-Powered', cls: 'human-powered' },
  'motorized':     { icon: '🛷', label: 'Motorized',     cls: 'motorized' },
  'out-of-bounds': { icon: '⛷', label: 'Out-of-Bounds', cls: 'out-of-bounds' },
};

function travelModeBadgeHtml(mode) {
  const meta = TRAVEL_MODE_META[mode] ?? TRAVEL_MODE_META['human-powered'];
  return `<div class="trainer-persona-travel-badge ${escAttr(meta.cls)}">${meta.icon} ${escHtml(meta.label)}</div>`;
}

function dimTooltipText(p) {
  if (!p.dimensions) return p.personaRole;
  const d = p.dimensions;
  const tl = trainingLabel(d.avalancheTrainingLevel);
  const tlLine = d.avalancheTrainingLevel === 0 ? 'No formal training' : `${tl} training`;
  return [
    `${p.personaName} — ${p.personaRole}`,
    `${tlLine} · ${d.backcountryDaysPerSeason} days/season · ${d.yearsOfMountainExperience} yrs`,
    `Terrain ${d.terrainAssessmentSkill}/5 · Weather ${d.weatherPatternRecognition}/5`,
  ].join('\n');
}

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
        <colgroup>
          <col class="col-zone" />
          <col class="col-forecaster" />
          <col class="col-danger" />
          ${personas.map(() => `<col class="col-persona" />`).join("")}
          <col class="col-avg" />
        </colgroup>
        <thead>
          <tr>
            <th>Zone</th>
            <th>Forecaster</th>
            <th>Danger</th>
            ${personas.map((p) => {
              const initials = p.personaName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              const mode = p.travelModeWeights?.mode ?? "human-powered";
              const tMeta = TRAVEL_MODE_META[mode] ?? TRAVEL_MODE_META["human-powered"];
              const firstName = escHtml(p.personaName.split(" ")[0]);
              const ttip = escAttr(`${p.personaName} — ${p.personaRole}\n${tMeta.label}`);
              return `<th class="col-persona-th" title="${ttip}">
                <div class="sc-col-persona-header">
                  <span class="sc-col-persona-chip" style="background:${p.color}">${initials}</span>
                  <span class="sc-col-persona-mode">${tMeta.icon}</span>
                  <span class="sc-col-persona-name" style="color:${p.color}">${firstName}</span>
                </div>
              </th>`;
            }).join("")}
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
              <td><span class="sc-summary-zone">${escHtml(z.zoneName)}</span></td>
              <td><span class="sc-summary-forecaster">${escHtml(z.forecasterName ?? "—")}</span></td>
              <td><span class="sc-summary-danger" style="color:${dColor}">${escHtml(danger)}</span></td>
              ${z.personas.map((p) => `<td class="col-score-td"><span class="sc-summary-score" style="color:${p.color}">${p.overall}</span></td>`).join("")}
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

function updateLensHint(chipsEl) {
  const hint = document.getElementById("readability-lens-hint");
  const zeroState = document.getElementById("readability-lens-zero");
  const allChips = [...chipsEl.querySelectorAll(".sc-metric-chip[role='button']")];
  const activeCount = allChips.filter((c) => c.getAttribute("aria-pressed") === "true").length;
  const total = allChips.length;

  if (zeroState) zeroState.hidden = activeCount > 0;

  if (!hint) return;
  if (total === 0) {
    hint.textContent = "";
    hint.className = "sc-lens-hint";
  } else if (activeCount === total) {
    hint.textContent = "Colored underlines show phrases each reader may find unclear — click a chip to toggle visibility";
    hint.className = "sc-lens-hint";
  } else if (activeCount === 0) {
    hint.textContent = "All flags hidden — click a chip to show readability highlights";
    hint.className = "sc-lens-hint sc-lens-hint--warn";
  } else {
    const hiddenNames = allChips
      .filter((c) => c.getAttribute("aria-pressed") === "false")
      .map((c) => c.dataset.personaRole)
      .join(", ");
    hint.textContent = `Showing ${activeCount} of ${total} readers — ${hiddenNames} hidden`;
    hint.className = "sc-lens-hint";
  }
}

function renderPersonaScoreRow(containerId, personas) {
  const el = document.getElementById(containerId);
  el.innerHTML = personas.map((p) => {
    const hasFlags = (p.flags ?? []).length > 0;
    const shortName = escHtml(p.personaName.split(" ")[0]);
    const tooltip = escAttr(`${p.personaName} — ${p.personaRole}\n${dimTooltipText(p)}`);
    const eyeIcon = hasFlags ? "●" : "✓";
    return `<div class="sc-metric-chip${hasFlags ? "" : " sc-metric-chip--clean"}" style="border-color:${p.color}"
        role="button" aria-pressed="${hasFlags ? "true" : "false"}" tabindex="0"
        data-has-flags="${hasFlags}"
        data-dim-tooltip="${tooltip}"
        data-persona-id="${escAttr(p.personaId)}"
        data-persona-role="${escAttr(p.personaRole)}">
      <span class="sc-metric-dot" style="background:${p.color}"></span>
      <span class="sc-metric-name">${shortName}</span>
      <span class="sc-metric-score" style="color:${p.color}">${p.overall}</span>
      <span class="sc-metric-eye" aria-hidden="true">${eyeIcon}</span>
    </div>`;
  }).join("");

  el.querySelectorAll(".sc-metric-chip").forEach((chip) => {
    chip.addEventListener("mouseenter", () => showChipTooltip(chip, chip.dataset.dimTooltip ?? ''));
    chip.addEventListener("mouseleave", hideChipTooltip);
    chip.addEventListener("focus", () => showChipTooltip(chip, chip.dataset.dimTooltip ?? ''));
    chip.addEventListener("blur", hideChipTooltip);
  });

  el.querySelectorAll(".sc-metric-chip[role='button']").forEach((chip) => {
    const toggle = () => {
      if (chip.dataset.hasFlags === "false") return; // no highlights to toggle
      const active = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", active ? "false" : "true");
      const id = chip.dataset.personaId;
      document.querySelectorAll(`.sc-highlight[data-persona-id="${id}"]`).forEach((m) => {
        m.classList.toggle("sc-highlight--hidden", active);
      });
      updateLensHint(el);
    };
    chip.addEventListener("click", toggle);
    chip.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });

  // Set initial hint text after chips are rendered
  updateLensHint(el);
}

function renderPersonaSidebar(containerId, personas) {
  const el = document.getElementById(containerId);
  el.innerHTML = personas.map((p) => {
    const d = p.dimensions;
    const dimRow = d
      ? `<div class="sc-persona-dim-row">
          <span>${d.avalancheTrainingLevel === 0 ? 'No training' : trainingLabel(d.avalancheTrainingLevel)}</span>
          <span>${d.backcountryDaysPerSeason} days/season</span>
          <span>Terrain ${d.terrainAssessmentSkill}/5</span>
        </div>`
      : '';
    return `<div class="sc-persona-card">
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
      ${dimRow}
    </div>`;
  }).join("");
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

  return `<div class="sc-forecast-annotated">${result.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>")}</div>
    <p class="sc-lens-zero-state" id="readability-lens-zero" hidden>All readability flags are hidden — click a chip above to show highlights.</p>`;
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
  const recPersonas = data.personas.filter((p) => (p.tags ?? []).includes("recreational"));
  const proPersonas = data.personas.filter((p) => !(p.tags ?? []).includes("recreational"));

  const avgOf = (arr) => arr.length ? Math.round(arr.reduce((s, p) => s + p.overall, 0) / arr.length) : null;
  const recScore = avgOf(recPersonas);
  const proScore = avgOf(proPersonas);

  // Primary grade is recreational — the audience with most to lose from a bad forecast
  const primaryScore = recScore ?? avgOf(data.personas);
  const primaryGrade = scoreToGrade(primaryScore);
  const primaryColor = gradeColor_(primaryGrade);
  const weakest = [...data.personas].sort((a, b) => a.overall - b.overall)[0];

  const splitRow = recScore !== null && proScore !== null ? `
    <div class="sc-grade-split-row">
      <div class="sc-grade-split-item">
        <span class="sc-grade-split-label">Recreational</span>
        <span class="sc-grade-split-score" style="color:${gradeColor_(scoreToGrade(recScore))}">${scoreToGrade(recScore)} <span class="sc-grade-split-num">${recScore}</span></span>
      </div>
      <div class="sc-grade-split-divider"></div>
      <div class="sc-grade-split-item">
        <span class="sc-grade-split-label">Professional</span>
        <span class="sc-grade-split-score" style="color:${gradeColor_(scoreToGrade(proScore))}">${scoreToGrade(proScore)} <span class="sc-grade-split-num">${proScore}</span></span>
      </div>
    </div>` : '';

  // Mode-aware summary: compare motorized vs human-powered average scores
  const motorizedPersonas = data.personas.filter((p) => (p.travelModeWeights?.mode ?? 'human-powered') === 'motorized');
  const humanPoweredPersonas = data.personas.filter((p) => (p.travelModeWeights?.mode ?? 'human-powered') === 'human-powered');
  const oobPersonas = data.personas.filter((p) => (p.travelModeWeights?.mode ?? 'human-powered') === 'out-of-bounds');
  const motorizedAvg = avgOf(motorizedPersonas);
  const humanPoweredAvg = avgOf(humanPoweredPersonas);
  const oobAvg = avgOf(oobPersonas);

  let modeSummary = '';
  const hasMixedModes = motorizedPersonas.length > 0 || oobPersonas.length > 0;
  if (hasMixedModes && humanPoweredAvg !== null) {
    if (motorizedAvg !== null && humanPoweredAvg - motorizedAvg >= 10) {
      modeSummary = ` Today's forecast serves human-powered users well but leaves motorized riders underserved in the Travel Advice section.`;
    } else if (oobAvg !== null && humanPoweredAvg - oobAvg >= 10) {
      modeSummary = ` Today's forecast serves human-powered users well but leaves out-of-bounds travelers underserved.`;
    }
  }

  const baseSummary = primaryGrade === "A" || primaryGrade === "B"
    ? `Strong forecast — scores well across most personas.`
    : `Today's forecast loses <strong>${weakest?.personaRole}</strong> most (score: ${weakest?.overall}).`;

  hero.innerHTML = `
    <div class="sc-coach-grade-card">
      <div class="sc-coach-grade" style="color:${primaryColor};border-color:${primaryColor}">${primaryGrade}</div>
      <div class="sc-coach-grade-detail">
        <div class="sc-coach-zone">${data.zoneName}</div>
        <div class="sc-coach-date">${formatDate(data.dateIssued)}</div>
        ${splitRow}
        <div class="sc-coach-summary">
          ${baseSummary}${modeSummary ? `<span class="sc-coach-summary-mode">${modeSummary}</span>` : ''}
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

function limitingDimension(p) {
  if (!p.dimensions) return null;
  const d = p.dimensions;
  const scores = { clarity: p.clarity, actionability: p.actionability, jargon: p.jargonLoad };
  const worst = Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0];
  if (worst === "jargon") return d.avalancheTrainingLevel < 2 ? "No avalanche training" : "Vocabulary gap";
  if (worst === "clarity") return `${d.yearsOfMountainExperience} yr${d.yearsOfMountainExperience !== 1 ? "s" : ""} experience`;
  return "Needs clearer action";
}

function renderCoachPersonaGrades(data) {
  const el = document.getElementById("coach-persona-grades");
  el.innerHTML = data.personas.map((p) => {
    const grade = scoreToGrade(p.overall);
    const color = gradeColor_(grade);
    const limDim = limitingDimension(p);
    return `<div class="sc-coach-persona-tile" style="border-top:3px solid ${p.color}">
      <div class="sc-coach-tile-grade" style="background:${color}15;color:${color}">${grade}</div>
      <div class="sc-coach-tile-name">${p.personaRole}</div>
      <div class="sc-coach-tile-issue">${worstIssue(p)}</div>
      ${limDim ? `<div class="sc-coach-tile-dim">▸ ${escHtml(limDim)}</div>` : ''}
    </div>`;
  }).join("");
}

function suggestionTravelMode(s, personas) {
  const persona = personas.find((p) => p.personaId === s.personaId);
  return persona?.travelModeWeights?.mode ?? 'human-powered';
}

function renderCoachModeFilterChips(data, containerEl) {
  const suggestions = data.coaching ?? [];
  const modesPresent = new Set(suggestions.map((s) => suggestionTravelMode(s, data.personas)));

  // Only render the chip row when more than one mode is present
  if (modesPresent.size <= 1) {
    containerEl.innerHTML = '';
    return;
  }

  const modes = [
    { key: 'all', label: 'All' },
    { key: 'human-powered', label: '🎿 Human-Powered' },
    { key: 'motorized', label: '🛷 Motorized' },
    { key: 'out-of-bounds', label: '⛷ Out-of-Bounds' },
  ].filter((m) => m.key === 'all' || modesPresent.has(m.key));

  containerEl.innerHTML = `<div class="sc-coach-mode-filter">${
    modes.map((m) =>
      `<button class="trainer-filter-chip${activeCoachModeFilter === m.key ? ' active' : ''}" data-coach-mode="${escAttr(m.key)}">${escHtml(m.label)}</button>`
    ).join('')
  }</div>`;

  containerEl.querySelectorAll('[data-coach-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCoachModeFilter = btn.dataset.coachMode;
      renderCoachSuggestions(data);
    });
  });
}

function renderCoachSuggestions(data) {
  const panel = document.getElementById("coach-suggestions");
  // Ensure filter chip container exists above the list
  let chipContainer = panel.querySelector('.sc-coach-mode-filter-wrap');
  if (!chipContainer) {
    chipContainer = document.createElement('div');
    chipContainer.className = 'sc-coach-mode-filter-wrap';
    const title = panel.querySelector('.sc-suggestions-title');
    title.after(chipContainer);
  }
  renderCoachModeFilterChips(data, chipContainer);

  const list = document.getElementById("suggestions-list");
  const suggestions = data.coaching ?? [];
  if (!suggestions.length) {
    list.innerHTML = "<p class='sc-no-data'>No suggestions — this forecast scores well across all personas.</p>";
    return;
  }

  const zoneSlug = data.zoneSlug ?? "";
  const dismissed = getDismissed(zoneSlug);

  // Determine which modes are present to decide if human-powered badge is meaningful
  const modesPresent = new Set(suggestions.map((s) => suggestionTravelMode(s, data.personas)));
  const hasMixedModes = modesPresent.size > 1;

  // Apply mode filter then dismissed filter
  const modeFiltered = activeCoachModeFilter === 'all'
    ? suggestions
    : suggestions.filter((s) => suggestionTravelMode(s, data.personas) === activeCoachModeFilter);
  const visible = modeFiltered.filter((s) => !dismissed.has(suggestionKey(s)));
  const hiddenCount = modeFiltered.length - visible.length;

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
    const dimBadge = s.drivingDimensionLabel
      ? `<span class="sc-dim-badge sc-dim-badge--${escAttr(s.drivingDimension)}">${escHtml(s.drivingDimensionLabel)}</span>`
      : '';

    // Travel mode badge — only show when there are mixed modes, and only badge
    // human-powered when there are also motorized/OOB personas for contrast
    const mode = suggestionTravelMode(s, data.personas);
    const showModeBadge = hasMixedModes && (mode !== 'human-powered' || modesPresent.has('motorized') || modesPresent.has('out-of-bounds'));
    const modeMeta = TRAVEL_MODE_META[mode] ?? TRAVEL_MODE_META['human-powered'];
    const modeBadge = showModeBadge
      ? `<span class="sc-dim-badge sc-dim-badge--${escAttr(modeMeta.cls)}">${modeMeta.icon} ${escHtml(modeMeta.label)}</span>`
      : '';

    return `<div class="sc-suggestion-card" data-key="${key}" data-mode="${escAttr(mode)}">
      <div class="sc-suggestion-header">
        <span class="sc-suggestion-persona" style="color:${persona?.color ?? '#666'}">${s.personaName}</span>
        ${dimBadge}
        ${modeBadge}
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

function progressBarHtml(p) {
  const limDim = limitingDimension(p);
  return `<div class="sc-progress-row">
    <span class="sc-progress-label" style="color:${p.color}">${p.personaRole}</span>
    <div class="sc-progress-track">
      <div class="sc-progress-fill" style="width:${p.overall}%;background:${p.color}"></div>
    </div>
    <span class="sc-progress-val">${p.overall}</span>
    ${limDim ? `<div class="sc-progress-dim">▸ ${escHtml(limDim)}</div>` : ''}
  </div>`;
}

function renderCoachProgressBars(data) {
  const el = document.getElementById("coach-progress-bars");

  const humanPowered = data.personas.filter((p) => (p.travelModeWeights?.mode ?? 'human-powered') === 'human-powered');
  const motorized = data.personas.filter((p) => (p.travelModeWeights?.mode ?? 'human-powered') === 'motorized');
  const oob = data.personas.filter((p) => (p.travelModeWeights?.mode ?? 'human-powered') === 'out-of-bounds');

  const hasMixedModes = motorized.length > 0 || oob.length > 0;

  if (!hasMixedModes) {
    el.innerHTML = data.personas.map(progressBarHtml).join("");
    return;
  }

  const sections = [
    { meta: TRAVEL_MODE_META['human-powered'], personas: humanPowered },
    { meta: TRAVEL_MODE_META['motorized'], personas: motorized },
    { meta: TRAVEL_MODE_META['out-of-bounds'], personas: oob },
  ].filter((g) => g.personas.length > 0);

  el.innerHTML = sections.map((g) =>
    `<div class="sc-progress-mode-label">${g.meta.icon} ${escHtml(g.meta.label)}</div>` +
    g.personas.map(progressBarHtml).join("")
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

function getOrCreateTooltip() {
  let tip = document.getElementById('sc-chip-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'sc-chip-tooltip';
    tip.className = 'sc-chip-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
  }
  return tip;
}

function showChipTooltip(chip, text) {
  const tip = getOrCreateTooltip();
  tip.textContent = text;
  tip.setAttribute('aria-hidden', 'false');
  tip.classList.add('visible');
  const rect = chip.getBoundingClientRect();
  tip.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
  tip.style.top = `${rect.top + window.scrollY - 8}px`;
}

function hideChipTooltip() {
  const tip = document.getElementById('sc-chip-tooltip');
  if (tip) { tip.classList.remove('visible'); tip.setAttribute('aria-hidden', 'true'); }
}

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
let trainerUnsaved = {}; // { [key]: { background?: true, voice?: true } }
let trainerOriginals = {}; // { [key]: PersonaRecord } — snapshots for Reset
let trainerSearchQuery = "";
let trainerTagFilter = "all"; // "all" | tag string

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
    if (e.key === "Escape" && !document.getElementById("trainer-modal").hidden) {
      const cloneModal = document.getElementById("trainer-clone-modal");
      if (!cloneModal.hidden) { closeCloneModal(); return; }
      closeTrainerModal();
    }
  });
  document.getElementById("trainer-clone-close").addEventListener("click", closeCloneModal);
  document.getElementById("trainer-clone-cancel").addEventListener("click", closeCloneModal);
  document.getElementById("trainer-clone-submit").addEventListener("click", submitClone);

  // Auto-generate key from name (only when key hasn't been manually edited)
  let cloneKeyManuallyEdited = false;
  const cloneNameInput = document.getElementById("trainer-clone-name");
  const cloneKeyInput = document.getElementById("trainer-clone-key");
  cloneNameInput.addEventListener("input", () => {
    if (!cloneKeyManuallyEdited) cloneKeyInput.value = slugify(cloneNameInput.value);
  });
  cloneKeyInput.addEventListener("input", () => { cloneKeyManuallyEdited = true; });
  // Reset flag when clone modal opens (handled in openCloneModal)
  document.getElementById("trainer-clone-modal")._resetKeyFlag = () => { cloneKeyManuallyEdited = false; };
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

  // Search + filter controls (shown when more than 4 personas)
  if (trainerPersonas.length > 4) {
    const searchEl = document.createElement("input");
    searchEl.type = "text";
    searchEl.className = "trainer-roster-search";
    searchEl.placeholder = "Search personas…";
    searchEl.value = trainerSearchQuery;
    searchEl.addEventListener("input", (e) => {
      trainerSearchQuery = e.target.value.toLowerCase();
      renderRoster();
    });
    roster.appendChild(searchEl);

    // Collect all unique tags
    const allTags = [...new Set(trainerPersonas.flatMap((p) => p.tags ?? []))].sort();
    if (allTags.length > 0) {
      const chipsEl = document.createElement("div");
      chipsEl.className = "trainer-filter-chips";
      const allChip = document.createElement("button");
      allChip.className = "trainer-filter-chip" + (trainerTagFilter === "all" ? " active" : "");
      allChip.textContent = "All";
      allChip.addEventListener("click", () => { trainerTagFilter = "all"; renderRoster(); });
      chipsEl.appendChild(allChip);
      for (const tag of allTags) {
        const chip = document.createElement("button");
        chip.className = "trainer-filter-chip" + (trainerTagFilter === tag ? " active" : "");
        chip.textContent = tag;
        chip.addEventListener("click", () => { trainerTagFilter = tag; renderRoster(); });
        chipsEl.appendChild(chip);
      }
      roster.appendChild(chipsEl);
    }
  }

  // Apply search + tag filter
  let visible = trainerPersonas;
  if (trainerSearchQuery) {
    visible = visible.filter((p) =>
      p.name.toLowerCase().includes(trainerSearchQuery) ||
      p.role.toLowerCase().includes(trainerSearchQuery)
    );
  }
  if (trainerTagFilter !== "all") {
    visible = visible.filter((p) => (p.tags ?? []).includes(trainerTagFilter));
  }

  for (const p of visible) {
    const card = document.createElement("div");
    card.className = "trainer-persona-card" +
      (p.personaKey === trainerActiveKey ? " active" : "") +
      (hasUnsaved(p.personaKey) ? " has-unsaved" : "") +
      (p.active === false ? " inactive" : "");
    card.style.borderLeftColor = p.color;
    card.dataset.key = p.personaKey;

    const tagsHtml = (p.tags ?? []).length > 0
      ? `<div class="trainer-persona-card-tags">${(p.tags).map((t) => `<span class="trainer-persona-tag">${escHtml(t)}</span>`).join("")}</div>`
      : "";
    const inactiveBadge = p.active === false ? `<span class="trainer-persona-inactive-badge">⊘</span>` : "";
    const deleteHintHtml = !p.isBuiltIn
      ? `<button class="trainer-card-delete-btn" data-key="${escAttr(p.personaKey)}" aria-label="Delete ${escHtml(p.name)}" title="Delete ${escHtml(p.name)}">🗑</button>`
      : "";

    card.innerHTML = `
      ${inactiveBadge}
      ${deleteHintHtml}
      <div class="trainer-persona-avatar-wrap">${renderAvatar(p, 36)}</div>
      <div class="trainer-persona-card-name">${escHtml(p.name)}</div>
      <div class="trainer-persona-card-role">${escHtml(p.role)}</div>
      <div class="trainer-persona-card-literacy">${escHtml(p.literacyLevel)}</div>
      ${travelModeBadgeHtml(p.travelMode)}
      ${tagsHtml}
      <div class="trainer-persona-unsaved"></div>
    `;
    card.addEventListener("click", () => selectPersona(p.personaKey));
    card.querySelector(".trainer-card-delete-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDeletePersona(p.personaKey);
    });
    roster.appendChild(card);
  }
}

function hasUnsaved(key) {
  const u = trainerUnsaved[key];
  return u && (u.background || u.voice);
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

  // Render detail header (avatar, name, active toggle, clone/delete)
  renderDetailHeader(persona);

  // Switch to first trainer tab
  switchTrainerTab("background");

  // Populate fields
  populateParametersTab(persona);
  renderProfileTab(persona);
  populateVoiceTab(persona);
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

function renderPersonaSnapshot(persona) {
  const LITERACY_LABELS = {
    low: "Low literacy", high: "High literacy", expert: "Expert", forecaster: "Forecaster-tier",
  };
  const literacyLabel = LITERACY_LABELS[persona.literacyLevel] ?? persona.literacyLevel;
  const terms = persona.unknownTerms ?? [];
  const preview = terms.slice(0, 6);
  const remaining = terms.length - preview.length;
  const termChips = preview.map((t) => `<span class="trainer-baseline-term">${escHtml(t)}</span>`).join("");
  const moreChip = remaining > 0 ? `<span class="trainer-baseline-term-more">+${remaining} more</span>` : "";
  const jargonLine = terms.length > 0
    ? `Does not understand <strong>${terms.length} technical terms</strong>.`
    : "No jargon restrictions — reads all technical language.";
  const travelMeta = TRAVEL_MODE_META[persona.travelMode] ?? TRAVEL_MODE_META['human-powered'];
  document.getElementById("trainer-persona-snapshot").innerHTML = `
    <div class="trainer-baseline-header">
      <span class="trainer-baseline-label">Persona Snapshot</span>
      <div style="display:flex;gap:6px;align-items:center;">
        <span class="trainer-baseline-literacy">${escHtml(literacyLabel)}</span>
        <span class="trainer-persona-travel-badge ${escAttr(travelMeta.cls)}">${travelMeta.icon} ${escHtml(travelMeta.label)}</span>
      </div>
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

function populateParametersTab(persona) {
  renderPersonaSnapshot(persona);
  // Set travel mode segmented control
  const travelMode = persona.travelMode ?? 'human-powered';
  document.querySelectorAll(".trainer-travel-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.travelMode === travelMode);
  });
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
  markUnsaved(trainerActiveKey, "background");
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
        markUnsaved(trainerActiveKey, "background");
      }
      input.value = "";
    }
  });
}

// ---------------------------------------------------------------------------
// Voice & Rules tab
// ---------------------------------------------------------------------------

function populateVoiceTab(persona) {
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
  const labelEl = document.getElementById("trainer-rules-label");
  const emptyHtml = '<p class="trainer-instructions-empty">No rules yet. Add one above to refine how this persona scores forecasts.</p>';

  if (!behavioralContext) {
    if (labelEl) labelEl.textContent = "Active rules";
    list.innerHTML = emptyHtml;
    return;
  }
  // Parse injected entries — separated by \n\n---\n\n
  const segments = behavioralContext.split("\n\n---\n\n").filter(Boolean);
  if (segments.length === 0) {
    if (labelEl) labelEl.textContent = "Active rules";
    list.innerHTML = emptyHtml;
    return;
  }
  if (labelEl) labelEl.textContent = `Active rules (${segments.length})`;
  list.innerHTML = "";
  // Newest first
  for (const seg of [...segments].reverse()) {
    const item = document.createElement("div");
    item.className = "trainer-instruction-item";
    item.innerHTML = `<span class="trainer-instruction-text">${escHtml(seg.trim())}</span>
      <button class="trainer-instruction-remove" aria-label="Remove rule">&times;</button>`;
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
  markUnsaved(trainerActiveKey, "voice");
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
    markUnsaved(key, "voice");
  });

  // Travel mode segmented control → update persona + mark unsaved
  document.querySelectorAll(".trainer-travel-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.travelMode;
      const persona = trainerPersonas.find((p) => p.personaKey === key);
      if (persona) persona.travelMode = mode;
      document.querySelectorAll(".trainer-travel-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.travelMode === mode);
      });
      markUnsaved(key, "background");
    });
  });

  // Parameters inputs → mark unsaved
  ["trainer-max-sentence", "trainer-max-grade", "trainer-success-criteria"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => markUnsaved(key, "background"));
  });

  // Save background (reading limits + dimension sliders combined)
  document.getElementById("trainer-save-background").onclick = () => saveBackground(key);

  // Reset reading limits
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
    clearUnsaved(key, "voice");
    renderInstructions(updated.behavioralContext ?? "");
    showTrainerToast("Behavior saved.");
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
    showTrainerToast("Rule added.");
  } catch (err) {
    showTrainerToast(`Failed to add rule: ${err.message}`, true);
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

// ===========================================================================
// Avatar helpers
// ===========================================================================

function getAvatarUrl(persona, size) {
  const seed = persona.avatarSeed || persona.personaKey;
  const style = persona.avatarStyle || "avataaars";
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

function renderAvatar(persona, size) {
  const url = getAvatarUrl(persona, size);
  const initials = persona.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return `<span class="persona-avatar persona-avatar-${size}" style="--avatar-accent:${escAttr(persona.color || "#3a7f9c")}">
    <img src="${url}" alt="${escHtml(persona.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
    <span class="persona-avatar-fallback" style="display:none">${escHtml(initials)}</span>
  </span>`;
}

// ===========================================================================
// Detail header
// ===========================================================================

function renderDetailHeader(persona) {
  const activePill = persona.active !== false
    ? `<button class="trainer-active-toggle active" data-key="${escAttr(persona.personaKey)}" title="Click to deactivate">&#8857; Active</button>`
    : `<button class="trainer-active-toggle inactive" data-key="${escAttr(persona.personaKey)}" title="Click to activate">&#8856; Inactive</button>`;

  const deleteBtn = !persona.isBuiltIn
    ? `<button class="trainer-delete-btn" data-key="${escAttr(persona.personaKey)}" title="Delete persona">Delete</button>`
    : "";

  document.getElementById("trainer-detail-header").innerHTML = `
    <div class="trainer-detail-header-inner">
      ${renderAvatar(persona, 64)}
      <div class="trainer-detail-header-info">
        <div class="trainer-detail-name">${escHtml(persona.name)}</div>
        <div class="trainer-detail-role">${escHtml(persona.role)}</div>
        <div class="trainer-detail-meta">
          ${(persona.tags ?? []).map((t) => `<span class="trainer-tag-chip">${escHtml(t)}</span>`).join("")}
        </div>
      </div>
      <div class="trainer-detail-header-actions">
        ${activePill}
        <button class="trainer-clone-btn" data-key="${escAttr(persona.personaKey)}">&#8853; Clone</button>
        ${deleteBtn}
      </div>
    </div>`;

  document.querySelector(".trainer-active-toggle")?.addEventListener("click", () =>
    togglePersonaActive(persona.personaKey)
  );
  document.querySelector(".trainer-clone-btn")?.addEventListener("click", () =>
    openCloneModal(persona.personaKey)
  );
  document.querySelector(".trainer-delete-btn")?.addEventListener("click", () =>
    confirmDeletePersona(persona.personaKey)
  );
}

// ===========================================================================
// Active toggle
// ===========================================================================

async function togglePersonaActive(key) {
  const persona = trainerPersonas.find((p) => p.personaKey === key);
  if (!persona) return;
  const newActive = persona.active === false ? true : false;
  try {
    const res = await fetch(`/api/personas/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: newActive }),
    });
    if (!res.ok) throw new Error("Save failed");
    persona.active = newActive;
    renderRoster();
    renderDetailHeader(persona);
    showTrainerToast(newActive ? `${persona.name} is now active` : `${persona.name} deactivated`);
  } catch (err) {
    showTrainerToast(`Failed to update: ${err.message}`, true);
  }
}

// ===========================================================================
// Clone flow
// ===========================================================================

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function openCloneModal(sourceKey) {
  const source = trainerPersonas.find((p) => p.personaKey === sourceKey);
  if (!source) return;

  // Reset manual-edit flag via stored function
  const modal = document.getElementById("trainer-clone-modal");
  if (typeof modal._resetKeyFlag === "function") modal._resetKeyFlag();

  document.getElementById("trainer-clone-source").textContent =
    `Cloning: ${source.name} (${source.role})`;
  document.getElementById("trainer-clone-name").value = `${source.name} — Copy`;
  document.getElementById("trainer-clone-role").value = source.role;
  document.getElementById("trainer-clone-key").value = slugify(`${source.name} copy`);
  document.getElementById("trainer-clone-key-error").textContent = "";
  document.getElementById("trainer-clone-key-error").classList.add("hidden");

  modal.dataset.sourceKey = sourceKey;
  modal.hidden = false;
  document.getElementById("trainer-clone-name").focus();
}

async function submitClone() {
  const modal = document.getElementById("trainer-clone-modal");
  const sourceKey = modal.dataset.sourceKey;
  const name = document.getElementById("trainer-clone-name").value.trim();
  const role = document.getElementById("trainer-clone-role").value.trim();
  const personaKey = document.getElementById("trainer-clone-key").value.trim();
  const errorEl = document.getElementById("trainer-clone-key-error");

  errorEl.classList.add("hidden");
  errorEl.textContent = "";

  if (!name) { showTrainerToast("Name is required.", true); return; }
  if (!personaKey) { showTrainerToast("Key is required.", true); return; }

  try {
    const res = await fetch(`/api/personas/${sourceKey}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role: role || undefined, personaKey }),
    });
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      errorEl.textContent = data.error ?? "A persona with that key already exists.";
      errorEl.classList.remove("hidden");
      return;
    }
    if (res.status === 400) {
      const data = await res.json().catch(() => ({}));
      errorEl.textContent = data.error ?? "Invalid input.";
      errorEl.classList.remove("hidden");
      return;
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const newPersona = await res.json();
    trainerPersonas.push(newPersona);
    trainerOriginals[newPersona.personaKey] = { ...newPersona, unknownTerms: [...(newPersona.unknownTerms ?? [])] };
    closeCloneModal();
    renderRoster();
    selectPersona(newPersona.personaKey);
    showTrainerToast(`Cloned as "${newPersona.name}"`);
  } catch (err) {
    showTrainerToast(`Clone failed: ${err.message}`, true);
  }
}

function closeCloneModal() {
  document.getElementById("trainer-clone-modal").hidden = true;
}

// ===========================================================================
// Delete
// ===========================================================================

function confirmDeletePersona(key) {
  const persona = trainerPersonas.find((p) => p.personaKey === key);
  if (!persona || persona.isBuiltIn) return;
  if (!confirm(`Delete "${persona.name}"? This cannot be undone.`)) return;
  deletePersona(key);
}

async function deletePersona(key) {
  try {
    const res = await fetch(`/api/personas/${key}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    trainerPersonas = trainerPersonas.filter((p) => p.personaKey !== key);
    trainerActiveKey = trainerPersonas[0]?.personaKey ?? null;
    renderRoster();
    if (trainerActiveKey) {
      selectPersona(trainerActiveKey);
    } else {
      document.getElementById("trainer-detail-empty").classList.remove("hidden");
      document.getElementById("trainer-detail-panel").classList.add("hidden");
    }
    showTrainerToast("Persona deleted");
  } catch (err) {
    showTrainerToast(`Failed to delete: ${err.message}`, true);
  }
}

// ===========================================================================
// Profile tab — domain dimension sliders
// ===========================================================================

const DOMAIN_DIMENSIONS = [
  {
    section: "Experience & Training",
    fields: [
      { key: "yearsOfMountainExperience", label: "Years of Mountain Experience", min: 0, max: 30, unit: "yrs", labels: null },
      { key: "avalancheTrainingLevel", label: "Avalanche Training", min: 0, max: 4, unit: null,
        labels: ["None", "Awareness", "AIARE 1", "AIARE 2", "Pro / Guide"] },
      { key: "backcountryDaysPerSeason", label: "Backcountry Days per Season", min: 0, max: 120, unit: "days", labels: null },
    ],
  },
  {
    section: "Technical Skills",
    fields: [
      { key: "weatherPatternRecognition", label: "Weather Reading Ability", min: 1, max: 5, unit: null,
        labels: ["None", "Minimal", "Developing", "Capable", "Expert"] },
      { key: "terrainAssessmentSkill", label: "Terrain Assessment Skill", min: 1, max: 5, unit: null,
        labels: ["None", "Minimal", "Developing", "Capable", "Expert"] },
    ],
  },
  {
    section: "Behavioral Tendencies",
    fields: [
      { key: "riskTolerance", label: "Risk Tolerance", min: 1, max: 5, unit: null,
        labels: ["Very Conservative", "Conservative", "Moderate", "Elevated", "Aggressive"] },
      { key: "groupDecisionTendency", label: "Group Influence", min: 1, max: 5, unit: null,
        labels: ["Independent", "Low", "Moderate", "Strong", "Group-Led"] },
      { key: "localTerrainFamiliarity", label: "Local Terrain Familiarity", min: 1, max: 5, unit: null,
        labels: ["Visitor", "New", "Occasional", "Familiar", "Native Expert"] },
    ],
  },
];

function getSliderValueLabel(dim, value) {
  if (dim.labels) {
    const idx = value - dim.min;
    return dim.labels[idx] ?? String(value);
  }
  return `${value}${dim.unit ? " " + dim.unit : ""}`;
}

function renderProfileTab(persona) {
  const panel = document.getElementById("trainer-profile-dims");
  let html = "";

  for (const group of DOMAIN_DIMENSIONS) {
    html += `<div class="dim-section-title">${escHtml(group.section)}</div>`;
    for (const dim of group.fields) {
      const rawVal = persona[dim.key];
      const value = rawVal != null ? rawVal : dim.min;
      const displayVal = getSliderValueLabel(dim, value);

      let scaleHtml = "";
      if (dim.labels) {
        scaleHtml = `<div class="dim-scale">${dim.labels.map((lbl, i) => {
          const isActive = (i + dim.min) === value;
          return `<span class="dim-scale-label${isActive ? " active" : ""}">${escHtml(lbl)}</span>`;
        }).join("")}</div>`;
      }

      html += `<div class="dim-field" data-dim-key="${escAttr(dim.key)}">
        <div class="dim-label-row">
          <span class="dim-label">${escHtml(dim.label)}</span>
          <span class="dim-value" data-dim-value="${escAttr(dim.key)}">${escHtml(displayVal)}</span>
        </div>
        <input type="range" class="dim-slider" min="${dim.min}" max="${dim.max}" step="1" value="${value}"
          data-dim-key="${escAttr(dim.key)}" />
        ${scaleHtml}
      </div>`;
    }
  }

  panel.innerHTML = html;

  // Wire slider input events
  panel.querySelectorAll(".dim-slider").forEach((slider) => {
    slider.addEventListener("input", () => {
      const dimKey = slider.dataset.dimKey;
      const dim = DOMAIN_DIMENSIONS.flatMap((g) => g.fields).find((f) => f.key === dimKey);
      if (!dim) return;
      const val = parseInt(slider.value, 10);
      // Update value callout
      const valueEl = panel.querySelector(`[data-dim-value="${dimKey}"]`);
      if (valueEl) valueEl.textContent = getSliderValueLabel(dim, val);
      // Update active scale label
      const fieldEl = panel.querySelector(`.dim-field[data-dim-key="${dimKey}"]`);
      if (fieldEl && dim.labels) {
        fieldEl.querySelectorAll(".dim-scale-label").forEach((lbl, i) => {
          lbl.classList.toggle("active", (i + dim.min) === val);
        });
      }
      markUnsaved(persona.personaKey, "background");
    });
  });
}

async function saveBackground(key) {
  const persona = trainerPersonas.find((p) => p.personaKey === key);
  if (!persona) return;

  const tags = getCurrentTags();
  const maxSentence = parseInt(document.getElementById("trainer-max-sentence").value, 10);
  const maxGrade = parseFloat(document.getElementById("trainer-max-grade").value);
  const successCriteria = document.getElementById("trainer-success-criteria").value.trim();
  if (!successCriteria) { showTrainerToast("Success criteria cannot be empty.", true); return; }

  const dimsPanel = document.getElementById("trainer-profile-dims");
  const dimUpdates = {};
  for (const dim of DOMAIN_DIMENSIONS.flatMap((g) => g.fields)) {
    const slider = dimsPanel.querySelector(`.dim-slider[data-dim-key="${dim.key}"]`);
    if (slider) dimUpdates[dim.key] = parseInt(slider.value, 10);
  }

  try {
    const res = await fetch(`/api/personas/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unknownTerms: tags, maxSentenceLength: maxSentence, maxGradeLevel: maxGrade, successCriteria, travelMode: persona.travelMode ?? 'human-powered', ...dimUpdates }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const updated = await res.json();
    Object.assign(persona, updated);
    trainerOriginals[key] = { ...updated, unknownTerms: [...(updated.unknownTerms ?? [])] };
    renderPersonaSnapshot(persona);
    clearUnsaved(key, "background");
    showTrainerToast("Background saved.");
  } catch (err) {
    showTrainerToast(`Save failed: ${err.message}`, true);
  }
}
