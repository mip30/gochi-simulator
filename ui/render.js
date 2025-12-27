import { MAX_CHARS, REL_PRESETS, relationKey, SCHEDULE_IDS } from "../sim/state.js";
import { SCHEDULES } from "../sim/rules.js";

export function renderAll(state, els, handlers) {
  renderTime(state, els);
  renderChars(state, els, handlers);
  renderRelations(state, els, handlers);
  renderSchedules(state, els, handlers);
  renderStats(state, els);
}

function renderTime(state, els) {
  const year = Math.floor(state.monthIndex / 12) + 1;
  const month = (state.monthIndex % 12) + 1;
  els.timeBox.innerHTML = `<div class="kv">
    <div class="muted">Year</div><div>${year} / 10</div>
    <div class="muted">Month</div><div>${month} / 12</div>
    <div class="muted">Turn</div><div>${state.monthIndex+1} / 120</div>
  </div>`;
  els.moneyBox.innerHTML = `<div class="kv">
    <div class="muted">Money</div><div>${state.money}</div>
  </div>`;
}

function renderChars(state, els, handlers) {
  const canAdd = state.characters.length < MAX_CHARS;
  els.btnAddChar.disabled = !canAdd;

  els.charList.innerHTML = state.characters.map(c => `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <div>
          <b>${c.name}</b>
          <span class="badge">${c.mbti}</span>
          <span class="badge">${c.zodiac}</span>
        </div>
        <div class="row">
          <button data-edit="${c.id}">Edit</button>
          <button data-del="${c.id}" ${state.characters.length===1 ? "disabled":""}>Remove</button>
        </div>
      </div>
      <div class="kv">
        <div class="muted">Birthday</div><div>${c.birthday.m}/${c.birthday.d}</div>
      </div>
    </div>
  `).join("");

  els.charList.querySelectorAll("button[data-edit]").forEach(b => {
    b.addEventListener("click", () => handlers.onEditChar(b.getAttribute("data-edit")));
  });
  els.charList.querySelectorAll("button[data-del]").forEach(b => {
    b.addEventListener("click", () => handlers.onRemoveChar(b.getAttribute("data-del")));
  });
}

function renderRelations(state, els, handlers) {
  if (state.characters.length < 2) {
    els.relBox.innerHTML = `<div class="muted">Add at least 1 more character to enable relationships.</div>`;
    return;
  }

  // show all pairs with preset selection
  const chars = state.characters;
  const rows = [];
  for (let i=0;i<chars.length;i++) {
    for (let j=i+1;j<chars.length;j++) {
      const a = chars[i], b = chars[j];
      const key = relationKey(a.id,b.id);
      const rel = state.relations[key] ?? { affinity:0, trust:10, tension:10, romance:0, stage:"strangers", meta:{} };
      rows.push({ a,b,key,rel });
    }
  }

  els.relBox.innerHTML = rows.map(r => `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <div><b>${r.a.name}</b> ↔ <b>${r.b.name}</b> <span class="badge">${r.rel.stage}</span></div>
        <div class="row">
          <select data-preset="${r.key}">
            ${REL_PRESETS.map(p => `<option value="${p.id}">${p.label}</option>`).join("")}
          </select>
          <select data-crushfrom="${r.key}" style="display:none;">
            <option value="${r.a.id}">Crush from: ${r.a.name}</option>
            <option value="${r.b.id}">Crush from: ${r.b.name}</option>
          </select>
          <button data-apply="${r.key}">Apply preset</button>
        </div>
      </div>
      <div class="kv">
        <div class="muted">affinity</div><div>${r.rel.affinity}</div>
        <div class="muted">trust</div><div>${r.rel.trust}</div>
        <div class="muted">tension</div><div>${r.rel.tension}</div>
        <div class="muted">romance</div><div>${r.rel.romance}</div>
      </div>
    </div>
  `).join("");

  rows.forEach(r => {
    const sel = els.relBox.querySelector(`select[data-preset="${r.key}"]`);
    if (sel) sel.value = (r.rel.stage === "rivals") ? "rivals"
                 : (r.rel.stage === "family") ? "family"
                 : (r.rel.stage === "crush") ? "crush"
                 : "strangers";

    const crushSel = els.relBox.querySelector(`select[data-crushfrom="${r.key}"]`);
    const refreshCrush = () => {
      const v = sel.value;
      crushSel.style.display = (v === "crush") ? "" : "none";
    };
    sel.addEventListener("change", refreshCrush);
    refreshCrush();

    els.relBox.querySelector(`button[data-apply="${r.key}"]`)
      .addEventListener("click", () => {
        handlers.onApplyPreset(r.key, sel.value, crushSel.value);
      });
  });
}

function renderSchedules(state, els, handlers) {
  els.scheduleBox.innerHTML = state.characters.map(c => `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <div><b>${c.name}</b></div>
        <div class="row">
          <select data-sel="${c.id}">
            ${SCHEDULE_IDS.map(id => `<option value="${id}">${SCHEDULES[id].label}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="muted small">
        Skill levels —
        study:${c.skills.study.level},
        work:${c.skills.work.level},
        rest:${c.skills.rest.level},
        art:${c.skills.art.level},
        train:${c.skills.train.level}
      </div>
    </div>
  `).join("");
}

function renderStats(state, els) {
  els.statsBox.innerHTML = state.characters.map(c => `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <div><b>${c.name}</b></div>
        <div class="muted small">stress: ${c.stats.stress}/100</div>
      </div>
      <div class="kv">
        <div class="muted">intellect</div><div>${c.stats.intellect}</div>
        <div class="muted">charm</div><div>${c.stats.charm}</div>
        <div class="muted">strength</div><div>${c.stats.strength}</div>
        <div class="muted">art</div><div>${c.stats.art}</div>
        <div class="muted">morality</div><div>${c.stats.morality}</div>
      </div>
    </div>
  `).join("");
}
