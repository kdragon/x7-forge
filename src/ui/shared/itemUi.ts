import type { Item } from '../../shared/types';
import { BASE_ATTACK_BY_TIER, BASE_DEFENSE_BY_TIER } from '../../config/itemRules';

export const getGradeColor = (grade: Item['grade']): string => {
  switch (grade) {
    case '일반': return '#555';
    case '고급': return '#1b5e20';
    case '희귀': return '#0d47a1';
    case '고대': return '#4a148c';
    case '영웅': return '#e65100';
    case '유일': return '#f9a825';
    case '유물': return '#b71c1c';
    default: return '#333';
  }
};

export const formatBonusAttack = (item: Item): string => {
  const base = BASE_ATTACK_BY_TIER[item.tier] ?? item.tier * 100;
  const min = Math.ceil(base * 0.05);
  const max = Math.ceil(base * 0.10);
  const val = item.bonusAttack ?? 0;
  const isMax = val === max;
  return `${isMax ? '🔘' : ''}+${val} (${min}~${max})`;
};

export const formatBonusDefense = (item: Item): string => {
  const base = BASE_DEFENSE_BY_TIER[item.tier] ?? 90;
  const min = Math.ceil(base * 0.05);
  const max = Math.ceil(base * 0.10);
  const val = item.bonusDefense ?? 0;
  const isMax = val === max;
  return `${isMax ? '🔘' : ''}+${val} (${min}~${max})`;
};
