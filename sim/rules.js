import { clamp } from "./state.js";

// schedule base effects (code-fixed)
export const SCHEDULES = {
  study: { label: "Study",  base: { intellect: +3, stress: +2 }, money: 0 },
  work:  { label: "Work",   base: { stress: +3 }, money: +50 },
  rest:  { label: "Rest",   base: { stress: -4 }, money: 0 },
  art:   { label: "Art",    base: { art: +3, charm: +1, stress: +1 }, money: 0 },
  train: { label: "Train",  base: { strength: +3, stress: +2 }, money: 0 },
};

// skill leveling
export function expNeed(level) {
  return 6 + level * 2; // simple curve
}

export function skillBonus(level) {
  // bonus grows slowly: +1 at lv2, lv4, lv6...
  return Math.floor(level / 2);
}

// apply schedule effects with skill bonuses
export function applySchedule(state, char, scheduleId) {
  const s = SCHEDULES[scheduleId];
  if (!s) return;

  const skill = char.skills[scheduleId];
  const bonus = skillBonus(skill.level);

  // stats
  for (const [k, v] of Object.entries(s.base)) {
    if (k === "stress") {
      char.stats.stress = clamp(char.stats.stress + v, 0, 100);
    } else {
      char.stats[k] = clamp((char.stats[k] ?? 0) + v + (k !== "morality" ? bonus : 0), 0, 100);
    }
  }

  // money
  state.money = clamp(state.money + (s.money ?? 0) + (scheduleId === "work" ? bonus * 10 : 0), 0, 999999);

  // exp + level up
  skill.exp += 1;
  const need = expNeed(skill.level);
  if (skill.exp >= need) {
    skill.exp -= need;
    skill.level += 1;
  }
}

export function applyBirthday(state, char) {
  // small morale boost
  char.stats.stress = clamp(char.stats.stress - 6, 0, 100);
  // tiny charm bonus
  char.stats.charm = clamp(char.stats.charm + 1, 0, 100);
  // costs money (cake)
  state.money = clamp(state.money - 20, 0, 999999);
}

// relation evolution & updates
export function evolveRelation(rel) {
  // stage transitions (simple but expandable)
  if (rel.stage === "strangers" && rel.affinity >= 15 && rel.trust >= 25) rel.stage = "friends";
  if (rel.stage === "friends" && rel.affinity >= 35 && rel.trust >= 45 && rel.tension <= 50) rel.stage = "close";

  // crush -> dating needs event success; keep as is here.

  if ((rel.tension >= 85) || (rel.trust <= 10)) rel.stage = "broken";

  // rivals persist unless softened
  if (rel.stage === "rivals" && rel.tension <= 25 && rel.affinity >= 10) rel.stage = "friends";
}

export function monthlyRelationDrift(rel, context) {
  // context: { sameGroup, growthGap, anyHighStress, isRivals }
  if (context.sameGroup) { rel.trust += 2; rel.affinity += 1; }
  if (context.growthGap) { rel.tension += 2; }
  if (context.anyHighStress) { rel.tension += 2; rel.trust -= 1; }
  if (context.isRivals) { rel.tension += 1; rel.affinity -= 1; }
  // clamp
  rel.affinity = clamp(rel.affinity, -100, 100);
  rel.trust = clamp(rel.trust, 0, 100);
  rel.tension = clamp(rel.tension, 0, 100);
  rel.romance = clamp(rel.romance, 0, 100);
}
