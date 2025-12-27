export const MAX_CHARS = 4;

export const START_AGE = 10;
export const END_AGE = 20;

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
  const year = Math.floor(monthIndex / 12) + 1;
  const month = (monthIndex % 12) + 1;
  return { year, month };
}

// ✅ 2개월 기간 라벨 (예: 1년 3~4월, 연도 넘어가면 1년 12월~2년 1월)
export function periodFromMonthIndex(monthIndex, span = 2) {
  const start = monthToYearMonth(monthIndex);
  const endIndex = monthIndex + (span - 1);
  const end = monthToYearMonth(endIndex);
  return { start, end, span };
}

export function ageFromMonthIndex(monthIndex) {
  const age = START_AGE + Math.floor(monthIndex / 12);
  return clamp(age, START_AGE, END_AGE);
}

export function getZodiacFromBirthday(m, d) {
  const mm = clamp(Number(m) || 1, 1, 12);
  const dd = clamp(Number(d) || 1, 1, 31);

  if ((mm === 1 && dd >= 20) || (mm === 2 && dd <= 18)) return "물병자리";
  if ((mm === 2 && dd >= 19) || (mm === 3 && dd <= 20)) return "물고기자리";
  if ((mm === 3 && dd >= 21) || (mm === 4 && dd <= 19)) return "양자리";
  if ((mm === 4 && dd >= 20) || (mm === 5 && dd <= 20)) return "황소자리";
  if ((mm === 5 && dd >= 21) || (mm === 6 && dd <= 21)) return "쌍둥이자리";
  if ((mm === 6 && dd >= 22) || (mm === 7 && dd <= 22)) return "게자리";
  if ((mm === 7 && dd >= 23) || (mm === 8 && dd <= 22)) return "사자자리";
  if ((mm === 8 && dd >= 23) || (mm === 9 && dd <= 22)) return "처녀자리";
  if ((mm === 9 && dd >= 23) || (mm === 10 && dd <= 22)) return "천칭자리";
  if ((mm === 10 && dd >= 23) || (mm === 11 && dd <= 22)) return "전갈자리";
  if ((mm === 11 && dd >= 23) || (mm === 12 && dd <= 21)) return "사수자리";
  return "염소자리";
}

export function newCharacter({ name="주인공", birthM=1, birthD=1, mbti="INTJ" } = {}) {
  const id = uid("c");
  const bm = clamp(birthM, 1, 12);
  const bd = clamp(birthD, 1, 31);

  return {
    id,
    name,
    birthday: { m: bm, d: bd },
    mbti: mbti.toUpperCase(),
    zodiac: getZodiacFromBirthday(bm, bd),
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
      zodiacBlessing: null,
    },
  };
}

export function newGameState() {
  const c1 = newCharacter({ name: "주인공", mbti: "INTJ", birthM: 1, birthD: 1 });
  return {
    version: 5,
    setupUnlocked: true,
    monthIndex: 0, // 실제 달 인덱스(0..119). 진행은 +2씩.
    money: 100,
    characters: [c1],
    relations: {},
    settings: {
      useGemini: false,
      workerUrl: "",
    },
    ui: {
      chatPair: null, // {aId,bId}
    },
    log: {
      entries: [],
    },
  };
}
