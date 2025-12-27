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
  const year = Math.floor(monthIndex / 12) + 1;
  const month = (monthIndex % 12) + 1;
  return { year, month };
}

/**
 * ✅ 생일(월/일) 기반 별자리 자동 계산
 * 기준: 일반적인 서양 별자리 경계(대중적 기준)
 */
export function getZodiacFromBirthday(m, d) {
  const mm = clamp(Number(m) || 1, 1, 12);
  const dd = clamp(Number(d) || 1, 1, 31);

  // 경계일: 해당 날짜 "이후" 다음 별자리로 넘어감
  // (예: 물병 1/20 시작)
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
  return "염소자리"; // 12/22~1/19
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
    zodiac: getZodiacFromBirthday(bm, bd), // ✅ 자동
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
    version: 3,
    setupUnlocked: true,
    monthIndex: 0,
    money: 100,

    characters: [c1],

    relations: {},

    settings: {
      useGemini: false,
      workerUrl: "",
    },

    log: {
      entries: [],
    },
  };
}
