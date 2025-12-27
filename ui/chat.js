export function renderChat(state, chatControlsEl, chatBoxEl, onSetPair) {
  const chars = state.characters || [];
  if (chars.length < 2) {
    chatControlsEl.innerHTML = `<span class="muted">캐릭터가 2명 이상일 때 표시됩니다.</span>`;
    chatBoxEl.innerHTML = "";
    return;
  }

  // 기본 페어 설정
  if (!state.ui?.chatPair) {
    state.ui.chatPair = { aId: chars[0].id, bId: chars[1].id };
  }
  const { aId, bId } = state.ui.chatPair;
  const a = chars.find(c => c.id === aId) || chars[0];
  const b = chars.find(c => c.id === bId) || chars[1];

  chatControlsEl.innerHTML = `
    <span class="muted">대상:</span>
    <select id="chatA">
      ${chars.map(c => `<option value="${c.id}" ${c.id===a.id ? "selected":""}>${escapeHtml(c.name)}</option>`).join("")}
    </select>
    <span class="muted">↔</span>
    <select id="chatB">
      ${chars.map(c => `<option value="${c.id}" ${c.id===b.id ? "selected":""}>${escapeHtml(c.name)}</option>`).join("")}
    </select>
  `;

  chatControlsEl.querySelector("#chatA").addEventListener("change", (e) => {
    const nextA = e.target.value;
    const nextB = (nextA === b.id) ? a.id : b.id;
    onSetPair(nextA, nextB);
  });
  chatControlsEl.querySelector("#chatB").addEventListener("change", (e) => {
    const nextB = e.target.value;
    const nextA = (nextB === a.id) ? b.id : a.id;
    onSetPair(nextA, nextB);
  });

  const set = new Set([a.id, b.id]);
  const nameById = Object.fromEntries(chars.map(c => [c.id, c.name]));

  // 로그에서 대사만 추출
  const lines = [];
  for (const e of (state.log.entries || [])) {
    const ds = e.dialogues || [];
    const picked = ds
      .map(d => ({ ...d, period: e.period }))
      .filter(d => set.has(d.speakerId) || set.has(d.speakerCid) || set.has(d._cid) || set.has(d.cid) || set.has(d.charId) || set.has(d.speakerCharId) || false); // (호환용)
    // 우리 프로젝트에서는 speaker가 이름만이므로, 이름으로 매칭도 추가
    const byName = ds
      .map(d => ({ ...d, period: e.period }))
      .filter(d => d.speaker === nameById[a.id] || d.speaker === nameById[b.id]);

    const use = byName.length ? byName : picked;
    for (const d of use) {
      lines.push({
        period: d.period,
        speaker: d.speaker,
        text: d.line,
      });
    }
  }

  // 렌더
  let html = "";
  let last = "";
  for (const l of lines) {
    const pk = periodKey(l.period);
    if (pk !== last) {
      last = pk;
      html += `<div class="chatMonth">${escapeHtml(periodLabel(l.period))}</div>`;
    }

    const isA = l.speaker === nameById[a.id];
    html += `
      <div class="bubbleRow ${isA ? "right" : "left"}">
        <div class="bubble">
          <div class="name">${escapeHtml(l.speaker)}</div>
          <div class="msg">${escapeHtml(l.text)}</div>
        </div>
      </div>
    `;
  }

  chatBoxEl.innerHTML = html || `<span class="muted">대사가 아직 없습니다.</span>`;
  chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
}

function periodKey(p) {
  if (!p) return "na";
  return `${p.start.year}-${p.start.month}-${p.end.year}-${p.end.month}`;
}
function periodLabel(p) {
  if (!p) return "";
  if (p.start.year === p.end.year) return `제 ${p.start.year}년 ${p.start.month}~${p.end.month}월`;
  return `제 ${p.start.year}년 ${p.start.month}월 ~ 제 ${p.end.year}년 ${p.end.month}월`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
