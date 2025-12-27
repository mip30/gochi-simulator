// sim/engine.js
import { monthToYearMonth, relationKey, isBirthdayMonth, clamp } from "./state.js";
import { applySchedule, applyBirthday, evolveRelation, monthlyRelationDrift } from "./rules.js";

// MBTI 톤(가볍게만)
const MBTI_TONE = {
  INTJ: ["차분한 결심", "정리된 사고"],
  INFP: ["부드러운 고집", "이상에 대한 믿음"],
  ENFP: ["밝은 추진력", "따뜻한 충동"],
  ISTJ: ["꾸준함", "성실한 반복"],
};

function toneFor(mbti) {
  return MBTI_TONE[mbti] ?? ["차분함", "기본기"];
}

function taskScriptCard(state, char, scheduleId) {
  const { year, month } = monthToYearMonth(state.monthIndex);
  const [t1, t2] = toneFor(char.mbti);

  const packs = {
    study: {
      title: "조용히 넘어가는 한 장",
      narr: `제 ${year}년 ${month}월.\n책상 위 조명이 낮게 울린다. ${char.name}은/는 ${t1}을 품고, ${t2}로 오늘을 쌓는다.`,
      dlg: [{ speaker: char.name, line: "지금 집중하면… 나중의 내가 덜 울겠지." }],
    },
    work: {
      title: "손이 기억하는 노동",
      narr: `제 ${year}년 ${month}월.\n하루는 노력과 맞바꿔 작은 보상을 준다. ${char.name}은/는 불평을 삼키고 몸을 움직인다.`,
      dlg: [{ speaker: char.name, line: "조금만 더… 이번 달은 버텨보자." }],
    },
    rest: {
      title: "제대로 쉬는 달",
      narr: `제 ${year}년 ${month}월.\n세상이 무너지는 건 아니다. ${char.name}은/는 숨을 고르고, 어깨의 힘을 풀어낸다.`,
      dlg: [{ speaker: char.name, line: "괜찮아. 쉬는 것도 진척이야." }],
    },
    art: {
      title: "감정이 형태가 되는 순간",
      narr: `제 ${year}년 ${month}월.\n선 하나가 기분을 만들고, 기분이 이야기가 된다. ${char.name}은/는 손끝으로 마음을 정리한다.`,
      dlg: [{ speaker: char.name, line: "말로 못 하면… 그림으로라도 남기자." }],
    },
    train: {
      title: "몸이 약속을 지킨다",
      narr: `제 ${year}년 ${month}월.\n호흡, 심장, 반복. ${char.name}은/는 조금씩—그러나 확실히—강해진다.`,
      dlg: [{ speaker: char.name, line: "한 번만 더. 딱 한 번만 더." }],
    },
  };

  const pack = packs[scheduleId] ?? packs.rest;

  return {
    id: `task_${char.id}_${state.monthIndex}`,
    type: "작업",
    title: `${pack.title} (${char.name} — ${scheduleId})`,
    narration: pack.narr,
    dialogues: pack.dlg,
    choices: [],
    meta: { charIds: [char.id], scheduleId }
  };
}

function birthdayCard(state, char, celebrants=[]) {
  const { year, month } = monthToYearMonth(state.monthIndex);
  const who = celebrants.length ? celebrants.join(", ") : "누군가";
  return {
    id: `bday_${char.id}_${state.monthIndex}`,
    type: "생일",
    title: `생일의 달 (${char.name})`,
    narration: `제 ${year}년 ${month}월.\n달력의 작은 표시가 눈에 걸린다. ${char.name}의 생일이 다가왔다.`,
    dialogues: [
      { speaker: who, line: "생일 축하해. 오늘만큼은 네가 우선이야." },
      { speaker: char.name, line: "…고마워. 나, 진짜 힘이 나." },
    ],
    choices: [
      { tag: "A", label: "축하를 받아들인다 (관계 +)" },
      { tag: "B", label: "조용히 넘긴다 (안정)" },
      { tag: "C", label: "밀어낸다 (긴장 +)" },
    ],
    meta: { charIds: [char.id], event: "birthday" }
  };
}

function relationEventCard(state, a, b, kind, rel) {
  const { year, month } = monthToYearMonth(state.monthIndex);
  const base = {
    bonding: {
      title: "작은 틈, 같은 방향",
      narr: `제 ${year}년 ${month}월.\n평범한 순간 속에서 ${a.name}과(와) ${b.name}은(는) 서로를 조금 더 이해하게 된다.`,
      dlg: [
        { speaker: a.name, line: "네가 그렇게 생각하는 줄 몰랐어." },
        { speaker: b.name, line: "…나도 말 안 했으니까." },
      ],
      choices: [
        { tag: "A", label: "솔직하게 말한다 (신뢰 +)" },
        { tag: "B", label: "농담으로 넘긴다 (안전)" },
        { tag: "C", label: "선을 긋는다 (긴장 +)" },
      ]
    },
    argument: {
      title: "날이 선 말들",
      narr: `제 ${year}년 ${month}월.\n피로와 스트레스가 목소리를 키운다. 사소한 말이 크게 번진다.`,
      dlg: [
        { speaker: a.name, line: "너는 항상… 그렇게 굴어." },
        { speaker: b.name, line: "그럼 너는? 너도 똑같아." },
      ],
      choices: [
        { tag: "A", label: "먼저 사과한다 (회복 +)" },
        { tag: "B", label: "잠깐 거리를 둔다 (완화)" },
        { tag: "C", label: "맞받아친다 (파국 +)" },
      ]
    },
    coop: {
      title: "둘이서 하면 더 빨라",
      narr: `제 ${year}년 ${month}월.\n${a.name}과(와) ${b.name}은(는) 함께 해보자고 합의한다. 잘 풀리면 습관이 되고, 아니면 흉터가 된다.`,
      dlg: [
        { speaker: b.name, line: "같이 하면 효율이 더 좋아질 거야." },
        { speaker: a.name, line: "…좋아. 이번만은 맞춰보자." },
      ],
      choices: [
        { tag: "A", label: "정리하고 맞춘다 (성공 +)" },
        { tag: "B", label: "흐름에 맡긴다 (혼합)" },
        { tag: "C", label: "협동 속 경쟁을 택한다 (경쟁 +)" },
      ]
    }
  }[kind];

  return {
    id: `rel_${a.id}_${b.id}_${state.monthIndex}_${kind}`,
    type: "관계",
    title: `${base.title} (${a.name} & ${b.name})`,
    narration: base.narr + `\n[관계 단계: ${rel.stage}]`,
    dialogues: base.dlg,
    choices: base.choices,
    meta: { charIds: [a.id, b.id], kind, relKey: relationKey(a.id,b.id) }
  };
}

function applyChoiceEffects(state, card, choiceTag) {
  if (!choiceTag) return;

  if (card.type === "생일") {
    const cid = card.meta.charIds[0];
    for (const other of state.characters) {
      if (other.id === cid) continue;
      const key = relationKey(cid, other.id);
      const rel = state.relations[key];
      if (!rel) continue;
      if (choiceTag === "A") { rel.affinity += 3; rel.trust += 2; rel.tension -= 1; }
      if (choiceTag === "B") { rel.affinity += 1; rel.trust += 1; }
      if (choiceTag === "C") { rel.tension += 4; rel.trust -= 1; }
      evolveRelation(rel);
    }
    return;
  }

  if (card.type === "관계") {
    const [aId, bId] = card.meta.charIds;
    const key = relationKey(aId, bId);
    const rel = state.relations[key];
    if (!rel) return;

    if (card.meta.kind === "bonding") {
      if (choiceTag === "A") { rel.trust += 4; rel.affinity += 3; rel.tension -= 1; }
      if (choiceTag === "B") { rel.trust += 2; rel.affinity += 1; }
      if (choiceTag === "C") { rel.tension += 3; }
    }

    if (card.meta.kind === "argument") {
      if (choiceTag === "A") { rel.trust += 3; rel.tension -= 2; rel.affinity += 1; }
      if (choiceTag === "B") { rel.tension -= 1; }
      if (choiceTag === "C") { rel.tension += 4; rel.trust -= 2; rel.affinity -= 2; }
    }

    if (card.meta.kind === "coop") {
      if (choiceTag === "A") { rel.trust += 3; rel.affinity += 1; }
      if (choiceTag === "B") { rel.trust += 1; }
      if (choiceTag === "C") { rel.tension += 2; }
    }

    // 로맨스 드리프트(가볍게)
    if (rel.stage !== "family" && rel.stage !== "broken") {
      if (rel.affinity >= 40 && rel.trust >= 50 && rel.tension <= 40) rel.romance += 2;
      if (rel.stage === "crush" && rel.romance >= 60 && rel.trust >= 55 && rel.affinity >= 45 && rel.tension <= 35) {
        if (Math.random() < 0.25) rel.stage = "dating";
      }
      if (rel.stage === "dating" && rel.romance >= 80 && rel.trust >= 70 && Math.random() < 0.15) rel.stage = "partners";
    }

    evolveRelation(rel);
  }
}

export function runOneMonth(state, schedulesByCharId) {
  const cards = [];
  const snapshotBefore = JSON.parse(JSON.stringify(state));

  // 1) 캐릭터별 작업 카드(항상)
  for (const c of state.characters) {
    const scheduleId = schedulesByCharId[c.id] ?? "rest";
    applySchedule(state, c, scheduleId);
    cards.push(taskScriptCard(state, c, scheduleId));
  }

  // 2) 생일 카드
  const bdays = state.characters.filter(c => isBirthdayMonth(state, c));
  for (const c of bdays) {
    applyBirthday(state, c);
    const celebrants = state.characters.filter(x => x.id !== c.id).map(x => x.name);
    cards.push(birthdayCard(state, c, celebrants));
  }

  // 3) 관계 변화 + 관계 이벤트 카드
  if (state.characters.length >= 2) {
    for (let i=0; i<state.characters.length; i++) {
      for (let j=i+1; j<state.characters.length; j++) {
        const a = state.characters[i], b = state.characters[j];
        const key = relationKey(a.id, b.id);
        if (!state.relations[key]) {
          state.relations[key] = { affinity: 0, trust: 10, tension: 10, romance: 0, stage: "strangers", meta:{} };
        }

        const rel = state.relations[key];
        const scheduleA = schedulesByCharId[a.id] ?? "rest";
        const scheduleB = schedulesByCharId[b.id] ?? "rest";
        const sameGroup = scheduleA === scheduleB && scheduleA !== "rest";
        const anyHighStress = (a.stats.stress >= 80) || (b.stats.stress >= 80);
        const isRivals = rel.stage === "rivals";

        const beforeA = snapshotBefore.characters.find(x=>x.id===a.id);
        const beforeB = snapshotBefore.characters.find(x=>x.id===b.id);
        const deltaA = sumStats(a.stats) - sumStats(beforeA.stats);
        const deltaB = sumStats(b.stats) - sumStats(beforeB.stats);
        const growthGap = Math.abs(deltaA - deltaB) >= 4;

        monthlyRelationDrift(rel, { sameGroup, anyHighStress, isRivals, growthGap });
        evolveRelation(rel);

        const p = Math.random();
        if (anyHighStress && p < 0.15) {
          cards.push(relationEventCard(state, a, b, "argument", rel));
        } else if (sameGroup && rel.trust >= 40 && p < 0.20) {
          cards.push(relationEventCard(state, a, b, "coop", rel));
        } else if (rel.affinity >= 20 && p < 0.12) {
          cards.push(relationEventCard(state, a, b, "bonding", rel));
        }
      }
    }
  }

  // 4) 하이라이트(제미나이 또는 템플릿)
  cards.push({
    id: `highlight_${state.monthIndex}`,
    type: "하이라이트_대기",
    title: "이달의 하이라이트",
    narration: "",
    dialogues: [],
    choices: [],
    meta: { monthIndex: state.monthIndex }
  });

  state.monthIndex = clamp(state.monthIndex + 1, 0, 120);
  state.lastRun = new Date().toISOString();
  return { state, cards };
}

function sumStats(stats) {
  return Object.values(stats).reduce((a,b)=>a+(Number(b)||0),0);
}

export function applyCardChoice(state, card, choiceTag) {
  applyChoiceEffects(state, card, choiceTag);
}
