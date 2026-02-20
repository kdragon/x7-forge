import type { Item } from '../../shared/types';
import { BONUS_ATTACK_RANGES } from '../../config/itemRules';

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
  const [min, max] = BONUS_ATTACK_RANGES[item.tier] || [3, 6];
  const isMax = item.bonusAttack === max;
  return `${isMax ? '🔘' : ''}+${item.bonusAttack} (${min}~${max})`;
};
