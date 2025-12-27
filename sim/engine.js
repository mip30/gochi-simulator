import { monthToYearMonth, clamp } from "./state.js";
import { applySchedule, applyBirthday, evolveRelation } from "./rules.js";

// 관계 프리셋(단방향)
const PRESETS = ["초면", "라이벌", "가족", "짝사랑"];

// MBTI 톤(짧은 로그)
const MBTI_VOICE = {
  INTJ: { a:"정리", b:"계획", line:"필요한 것만 하자." },
  INFP: { a:"감정", b:"의미", line:"내가 납득할 수 있어야 해." },
  ENFP: { a:"즉흥", b:"기세", line:"일단 해보자!" },
  ISTJ: { a:"규칙", b:"반복", line:"정해진 대로 하면 된다." },
  ISFP: { a:"감각", b:"집중", line:"지금 손에 잡히는 걸 하자." },
};

function voice(mbti) { return MBTI_VOICE[mbti] ?? { a:"차분", b:"기본", line:"알겠어." }; }

function logId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeEntry({ type, ym, title, text, dialogues=[], choices=[], meta={} }) {
  return {
    id: logId(type),
    type,
    ym,
    title,
    text,
    dialogues,
    choices,      // [{tag,label}]
    choiceMade: null,
    meta,
  };
}

// 선택지 효과(텍스트엔 수치 언급 금지)
export function applyChoice(state, entry, tag) {
  const meta = entry.meta || {};
  if (meta.kind === "event") {
    // 개인 이벤트: 스트레스/돈/도덕 등 내부 변화
    const cid = meta.charId;
    const c = state.characters.find(x => x.id === cid);
    if (!c) return;

    if (tag === "A") { c.stats.morality = clamp(c.stats.morality + 2, 0, 100); c.stats.stress = clamp(c.stats.stress + 1, 0, 100); }
    if (tag === "B") { c.stats.stress = clamp(c.stats.stress - 1, 0, 100); }
    if (tag === "C") { state.money = clamp(state.money + 20, 0, 999999); c.stats.stress = clamp(c.stats.stress + 2, 0, 100); }
  }

  if (meta.kind === "relation_change") {
    // 관계 변화 이벤트: 신뢰/호감/긴장/연정 내부 변화
    const key = meta.relKey;
    const rel = state.relations[key];
    if (!rel) return;
    if (tag === "A") { rel.trust = clamp(rel.trust + 3, 0, 100); rel.affinity = clamp(rel.affinity + 2, -100, 100); rel.tension = clamp(rel.tension - 1, 0, 100); }
    if (tag === "B") { rel.trust = clamp(rel.trust + 1, 0, 100); }
    if (tag === "C") { rel.tension = clamp(rel.tension + 3, 0, 100); rel.trust = clamp(rel.trust - 1, 0, 100); }
  }

  if (meta.kind === "tournament") {
    // 대회 선택(리스크/안전)
    if (tag === "A") state.money = clamp(state.money + 80, 0, 999999);
    if (tag === "B") state.money = clamp(state.money + 40, 0, 999999);
    if (tag === "C") state.money = clamp(state.money + 0, 0, 999999);
  }

  if (meta.kind === "zodiac_blessing") {
    const cid = meta.charId;
    const c = state.characters.find(x => x.id === cid);
    if (!c) return;
    if (tag === "A") c.flags.zodiacBlessing = meta.blessing; // 축복 확정(지속)
    if (tag === "B") c.stats.stress = clamp(c.stats.stress - 2, 0, 100);
    if (tag === "C") state.money = clamp(state.money + 10, 0, 999999);
  }
}

function scheduleLog(ym, c, scheduleId, ok) {
  const v = voice(c.mbti);
  const title = `${c.name} — ${labelSchedule(scheduleId)} (${ok ? "순항" : "삐끗"})`;
  const text = `이번 달은 ${v.a}/${v.b} 쪽으로 굴러갔다.\n일은 진행됐고, 남는 건 분위기와 기억이다.`;
  const dialogues = [{ speaker: c.name, line: v.line }];
  return makeEntry({ type:"행동", ym, title, text, dialogues, meta:{ kind:"action", charId:c.id, scheduleId, ok } });
}

function labelSchedule(id) {
  return ({ study:"공부", work:"노동", rest:"휴식", art:"예술", train:"훈련" }[id] ?? id);
}

// 생일 대사 MBTI별 변화
function birthdayEntry(ym, c, castNames) {
  const m = c.mbti.toUpperCase();
  const lines = {
    INTJ: "축하는 고맙다. 다음 계획으로 넘어가자.",
    INFP: "…기억해줘서 고마워. 오늘은 조금 괜찮다.",
    ENFP: "와! 오늘은 내가 주인공이지? 좋아!",
    ISTJ: "기록해둘 만한 하루다. 고맙다.",
    ISFP: "조용히 챙겨줘서 좋아. 편하다.",
  };
  const who = castNames.length ? castNames.join(", ") : "누군가";
  return makeEntry({
    type:"이벤트",
    ym,
    title:`생일 — ${c.name}`,
    text:"달력에 표시된 날. 분위기가 잠깐 바뀐다.",
    dialogues: [
      { speaker: who, line: "생일 축하해." },
      { speaker: c.name, line: lines[m] ?? "고마워." },
    ],
    choices: [
      { tag:"A", label:"같이 보낸다" },
      { tag:"B", label:"조용히 정리한다" },
      { tag:"C", label:"대충 넘긴다" },
    ],
    meta:{ kind:"event", charId:c.id, event:"birthday" },
  });
}

// 개인 이벤트(빈도 증가)
function randomPersonalEvent(ym, c) {
  const pool = [
    { title:"길에서 이상한 소문을 들었다", a:"파고든다", b:"넘긴다", c:"이용한다" },
    { title:"길가에서 누군가 도움을 청한다", a:"돕는다", b:"모른 척한다", c:"조건을 건다" },
    { title:"적을 마주쳤다", a:"피한다", b:"정면으로 간다", c:"협상한다" },
    { title:"상점에서 유혹이 강했다", a:"참는다", b:"조금 산다", c:"크게 산다" },
    { title:"사소한 오해가 생겼다", a:"바로 푼다", b:"시간을 둔다", c:"그냥 둔다" },
  ];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const v = voice(c.mbti);
  return makeEntry({
    type:"이벤트",
    ym,
    title:`${pick.title} (${c.name})`,
    text:`${v.a} 쪽으로 움직이면 좋을 수도, 아닐 수도 있다.\n선택은 즉시 결과로 돌아온다.`,
    dialogues:[{ speaker:c.name, line:"…어떻게 하지." }],
    choices:[
      { tag:"A", label:pick.a },
      { tag:"B", label:pick.b },
      { tag:"C", label:pick.c },
    ],
    meta:{ kind:"event", charId:c.id, event:"personal" }
  });
}

// 별자리 축복 이벤트
function zodiacBlessingEvent(ym, c) {
  const z = c.zodiac;
  const blessing = `${z} 신의 축복`;
  return makeEntry({
    type:"이벤트",
    ym,
    title:`${blessing} — ${c.name}`,
    text:`이상하게 운이 따르는 날.\n받아들일지, 흘릴지, 거래할지 선택할 수 있다.`,
    dialogues:[{ speaker:"내레이션", line:"눈에 보이지 않는 무언가가 등을 민다." }],
    choices:[
      { tag:"A", label:"축복을 받는다(지속)" },
      { tag:"B", label:"조용히 흘린다" },
      { tag:"C", label:"거래로 바꾼다" },
    ],
    meta:{ kind:"zodiac_blessing", charId:c.id, blessing }
  });
}

// 관계 변화 “단계 변경 시 반드시 이벤트”
function relationStageChangeEntry(ym, fromChar, toChar, relKey, prevStage, nextStage) {
  return makeEntry({
    type:"관계",
    ym,
    title:`관계 변화 — ${fromChar.name} → ${toChar.name}`,
    text:`관계가 "${prevStage}"에서 "${nextStage}"로 바뀌었다.\n이제 선택이 남는다.`,
    dialogues:[
      { speaker: fromChar.name, line:"…이제 예전처럼은 못 하겠어." },
      { speaker: toChar.name, line:"무슨 말을 하고 싶은 거야?" },
    ],
    choices:[
      { tag:"A", label:"솔직하게 말한다" },
      { tag:"B", label:"거리 유지" },
      { tag:"C", label:"상처 주는 말" },
    ],
    meta:{ kind:"relation_change", relKey }
  });
}

// 관계 이벤트(빈도 증가)
function randomRelationEvent(ym, fromChar, toChar, relKey, rel) {
  const pool = [
    { title:"같이 움직일 기회가 생겼다", a:"호흡 맞춘다", b:"각자 한다", c:"경쟁한다" },
    { title:"작은 말실수가 터졌다", a:"사과한다", b:"넘긴다", c:"맞받는다" },
    { title:"의외로 잘 맞는 부분을 봤다", a:"인정한다", b:"모른 척", c:"비꼰다" },
  ];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return makeEntry({
    type:"관계",
    ym,
    title:`${pick.title} — ${fromChar.name} → ${toChar.name}`,
    text:`현재 상태: ${rel.stage} / 프리셋: ${rel.preset}\n선택이 관계의 분위기를 바꾼다.`,
    dialogues:[
      { speaker: fromChar.name, line:"…네가 생각보다 괜찮을지도." },
      { speaker: toChar.name, line:"갑자기 왜 그래." },
    ],
    choices:[
      { tag:"A", label:pick.a },
      { tag:"B", label:pick.b },
      { tag:"C", label:pick.c },
    ],
    meta:{ kind:"relation_change", relKey }
  });
}

// 12월 대회
function tournamentEntry(ym, rosterNames) {
  return makeEntry({
    type:"대회",
    ym,
    title:`12월 대회 — 참가자: ${rosterNames.join(", ")}`,
    text:"연말. 분위기가 들끓는다.\n성과와 운, 그리고 선택이 겹친다.",
    dialogues:[
      { speaker:"사회자", line:"대회 시작!" },
      { speaker:"내레이션", line:"무대에는 엑스트라와 당신의 캐릭터들이 섞여 있다." },
    ],
    choices:[
      { tag:"A", label:"공격적으로 간다" },
      { tag:"B", label:"안전하게 간다" },
      { tag:"C", label:"상황을 본다" },
    ],
    meta:{ kind:"tournament" }
  });
}

export function runOneMonth(state, schedulesByCharId) {
  const ym = monthToYearMonth(state.monthIndex);
  const newLogEntries = [];

  // 1) 스케줄 처리 + 행동 로그
  for (const c of state.characters) {
    const scheduleId = schedulesByCharId[c.id] ?? "rest";
    const { ok } = applySchedule(state, c, scheduleId);
    newLogEntries.push(scheduleLog(ym, c, scheduleId, ok));
  }

  // 2) 생일 이벤트(해당 월과 생일 월이 같으면)
  for (const c of state.characters) {
    if (c.birthday.m === ym.month) {
      applyBirthday(state, c);
      const others = state.characters.filter(x => x.id !== c.id).map(x => x.name);
      newLogEntries.push(birthdayEntry(ym, c, others));
    }
  }

  // 3) 별자리 축복 이벤트(빈도)
  for (const c of state.characters) {
    // 월당 20% + 스트레스 높을 때 조금 상승
    const bonus = (c.stats.stress >= 70) ? 0.12 : 0.0;
    if (Math.random() < (0.20 + bonus)) {
      newLogEntries.push(zodiacBlessingEvent(ym, c));
    }
  }

  // 4) 개인 이벤트 빈도 증가(캐릭터당 1~2개)
  for (const c of state.characters) {
    newLogEntries.push(randomPersonalEvent(ym, c));
    if (Math.random() < 0.55) newLogEntries.push(randomPersonalEvent(ym, c));
  }

  // 5) 관계 드리프트 + 관계 이벤트(빈도 증가)
  // 단방향: from->to 각각 처리
  for (const from of state.characters) {
    for (const to of state.characters) {
      if (from.id === to.id) continue;
      const key = `${from.id}->${to.id}`;
      const rel = state.relations[key];

      // preset이 “가족”이면 stage는 가족으로 유지
      if (rel.preset === "가족") rel.stage = "가족";

      // 간단 드리프트(스트레스/랜덤)
      if (from.stats.stress >= 80) { rel.tension = clamp(rel.tension + 2, 0, 100); rel.trust = clamp(rel.trust - 1, 0, 100); }
      if (Math.random() < 0.35) { rel.affinity = clamp(rel.affinity + 1, -100, 100); }
      if (Math.random() < 0.25) { rel.trust = clamp(rel.trust + 1, 0, 100); }
      if (Math.random() < 0.20) { rel.tension = clamp(rel.tension + 1, 0, 100); }
      if (rel.preset === "짝사랑" && Math.random() < 0.35) { rel.romance = clamp(rel.romance + 2, 0, 100); }
      if (rel.preset === "라이벌" && Math.random() < 0.35) { rel.tension = clamp(rel.tension + 2, 0, 100); }

      const evo = evolveRelation(rel);
      if (evo.changed) {
        newLogEntries.push(relationStageChangeEntry(ym, from, to, key, evo.prev, evo.next));
      }

      // 관계 이벤트 빈도 증가 (월당 35% 정도)
      if (Math.random() < 0.35) {
        newLogEntries.push(randomRelationEvent(ym, from, to, key, rel));
      }
    }
  }

  // 6) 12월 대회(매년)
  if (ym.month === 12) {
    // 참가자: 플레이어 캐릭터 + 엑스트라
    const extras = ["레온", "미라", "카일", "하나", "세라"];
    const roster = [...state.characters.map(c => c.name)];
    while (roster.length < 6) roster.push(extras[Math.floor(Math.random() * extras.length)]);
    newLogEntries.push(tournamentEntry(ym, roster));

    // 승리 판정(내부): 가장 높은 “합” 기반으로 확률 가중
    const best = state.characters
      .map(c => ({ c, score: c.stats.intellect + c.stats.charm + c.stats.strength + c.stats.art + c.stats.morality - c.stats.stress }))
      .sort((a,b)=>b.score-a.score)[0];

    const winProb = Math.max(0.15, Math.min(0.75, 0.30 + (best.score - 200) / 300));
    if (Math.random() < winProb) {
      state.money = clamp(state.money + 120, 0, 999999);
      newLogEntries.push(makeEntry({
        type:"대회",
        ym,
        title:`대회 결과 — 승리`,
        text:"관중의 반응이 달라진다.\n연말이 조금 가벼워졌다.",
        dialogues:[{ speaker:"사회자", line:"우승!" }],
        meta:{ kind:"tournament_result", win:true }
      }));
    } else {
      newLogEntries.push(makeEntry({
        type:"대회",
        ym,
        title:`대회 결과 — 아쉽게도`,
        text:"결과는 결과다.\n다음 연말이 남아 있다.",
        dialogues:[{ speaker:"내레이션", line:"무대는 차갑다." }],
        meta:{ kind:"tournament_result", win:false }
      }));
    }
  }

  // 다음 달
  const nextMonthIndex = clamp(state.monthIndex + 1, 0, 120);
  return {
    newLogEntries,
    nextMonthIndex,
    nextMoney: state.money,
  };
}
