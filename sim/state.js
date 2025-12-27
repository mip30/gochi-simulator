export const MAX_CHARS = 4;

export const MBTI_LIST = [
  "INTJ","INTP","ENTJ","ENTP",
  "INFJ","INFP","ENFJ","ENFP",
  "ISTJ","ISFJ","ESTJ","ESFJ",
  "ISTP","ISFP","ESTP","ESFP",
];

export const SCHEDULE_IDS = ["study", "work", "rest", "art", "train"];

export function uid(prefix = "c") {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-4)}`;
}

export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export function monthToYearMonth(monthIndex) {
  const year = Math.floor(monthIndex / 12) + 1;  // 1..10
  const month = (monthIndex % 12) + 1;           // 1..12
  return { year, month };
}

export function zodiacOptions() {
  return [
    "양자리","황소자리","쌍둥이자리","게자리","사자자리","처녀자리",
    "천칭자리","전갈자리","사수자리","염소자리","물병자리","물고기자리",
  ];
}

// 날짜 기반 별자리(선택 강제 대신 자동 계산도 가능하지만, 이번 버전은 “설정에서 선택”)
export function newCharacter({ name="주인공", birthM=1, birthD=1, mbti="INTJ", zodiacBlessing=null } = {}) {
  const id = uid("c");
  return {
    id,
    name,
    birthday: { m: clamp(birthM, 1, 12), d: clamp(birthD, 1, 31) },
    mbti: mbti.toUpperCase(),
    zodiac: "쌍둥이자리",
    stats: {
      intellect: 10,
      charm: 10,
      strength: 10,
      art: 10,
      morality: 10,
      stress: 10,
    },
    skills: {
      study: { level: 0, exp: 0 },
      work:  { level: 0, exp: 0 },
      rest:  { level: 0, exp: 0 },
      art:   { level: 0, exp: 0 },
      train: { level: 0, exp: 0 },
    },
    flags: {
      zodiacBlessing, // 받은 축복 등
    },
  };
}

export function newGameState() {
  const c1 = newCharacter({ name: "주인공", mbti: "INTJ" });
  return {
    version: 3,
    setupUnlocked: true,
    monthIndex: 0,   // 0..119
    money: 100,

    characters: [c1],

    // 단방향 관계: "A->B": { preset, stage, affinity, trust, tension, romance }
    relations: {},

    settings: {
      useGemini: false,
      workerUrl: "",
    },

    log: {
      entries: [], // {id,type,ym,title,text,dialogues,choices,choiceMade,meta}
    },
  };
}
