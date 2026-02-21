import type { Item } from '../shared/types';

export const GRADE_ORDER: Item['grade'][] = ['일반', '고급', '희귀', '고대', '영웅', '유일', '유물'];

export const TIER_MAX_GRADE: Record<number, Item['grade']> = {
  1: '고급',
  2: '희귀',
  3: '고대',
  4: '영웅',
  5: '유일',
  6: '유물',
  7: '유물',
};

export const BASE_ATTACK_BY_TIER: Record<number, number> = {
  1: 60,
  2: 80,
  3: 120,
  4: 180,
  5: 260,
  6: 360,
  7: 480,
};

export const GRADE_BONUS_BY_GRADE: Record<Item['grade'], number> = {
  '일반': 0,
  '고급': 20,
  '희귀': 40,
  '고대': 60,
  '영웅': 80,
  '유일': 100,
  '유물': 120,
};

export const ENHANCE_BONUS_PER_TIER: Record<number, number> = {
  1: 8,
  2: 10,
  3: 12,
  4: 14,
  5: 16,
  6: 18,
  7: 20,
};

export const BONUS_ATTACK_RANGES: Record<number, [number, number]> = {
  1: [3, 6],
  2: [4, 8],
  3: [6, 12],
  4: [9, 18],
  5: [13, 26],
  6: [18, 36],
  7: [24, 48],
};

export const BASE_DEFENSE_BY_TIER: Record<number, number> = {
  1: 90,
  2: 245,
  3: 460,
  4: 590,
  5: 800,
  6: 1000,
  7: 1270,
};

export const calculateDefense = (tier: number, grade: string, enhance: number): number => {
  const base = BASE_DEFENSE_BY_TIER[tier] ?? 90;
  const gradeBonus = GRADE_BONUS_BY_GRADE[grade as Item['grade']] ?? 0;
  const enhanceBonus = enhance * (ENHANCE_BONUS_PER_TIER[tier] ?? 10);
  return base + gradeBonus + enhanceBonus;
};

export const rollBonusDefense = (tier: number): number => {
  const base = BASE_DEFENSE_BY_TIER[tier] ?? 90;
  const min = Math.floor(base * 0.03);
  const max = Math.floor(base * 0.06);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const calculateSlots = (enhance: number): number => {
  if (enhance >= 9) return 4;
  if (enhance >= 7) return 3;
  if (enhance >= 5) return 2;
  if (enhance >= 3) return 1;
  return 0;
};

export const getMaxGradeForTier = (tier: number): Item['grade'] => {
  return TIER_MAX_GRADE[tier] ?? '일반';
};

export const calculateAttack = (tier: number, grade: string, enhance: number): number => {
  const base = BASE_ATTACK_BY_TIER[tier] ?? tier * 100;
  const gradeBonus = GRADE_BONUS_BY_GRADE[grade as Item['grade']] ?? 0;
  const enhanceBonus = enhance * (ENHANCE_BONUS_PER_TIER[tier] ?? 10);
  return base + gradeBonus + enhanceBonus;
};

export const rollBonusAttack = (tier: number): number => {
  const [min, max] = BONUS_ATTACK_RANGES[tier] ?? [3, 6];
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const determineGrade = (
  rareRate: number,
  highRate: number,
  heroRate: number = 0,
  maxGrade: Item['grade'] = '희귀',
  minGrade: Item['grade'] = '일반',
): Item['grade'] => {
  const roll = Math.random() * 100;

  if (minGrade === '고대') {
    if (maxGrade === '유일') {
      if (roll < heroRate) return '유일';
      return '고대';
    }
    if (maxGrade === '유물') {
      if (roll < heroRate) return '유물';
      return '고대';
    }
    return '고대';
  }

  if (minGrade === '희귀') {
    if (maxGrade === '고대') {
      if (roll < heroRate) return '고대';
      return '희귀';
    }
    if (maxGrade === '영웅') {
      if (roll < heroRate) return '영웅';
      return '희귀';
    }
    return '희귀';
  }

  if (minGrade === '고급') {
    if (maxGrade === '고대') {
      if (roll < heroRate) return '고대';
      if (roll < heroRate + rareRate) return '희귀';
      return '고급';
    }
    if (maxGrade === '희귀') {
      if (roll < rareRate) return '희귀';
      return '고급';
    }
    return '고급';
  }

  if (maxGrade === '희귀') {
    if (roll < rareRate) return '희귀';
    if (roll < rareRate + highRate) return '고급';
    return '일반';
  }
  if (maxGrade === '고급') {
    if (roll < highRate) return '고급';
    return '일반';
  }
  if (maxGrade === '영웅') {
    if (roll < heroRate) return '영웅';
    if (roll < heroRate + rareRate) return '희귀';
    if (roll < heroRate + rareRate + highRate) return '고급';
    return '일반';
  }
  if (maxGrade === '고대') {
    if (roll < heroRate) return '고대';
    if (roll < heroRate + rareRate) return '희귀';
    if (roll < heroRate + rareRate + highRate) return '고급';
    return '일반';
  }
  if (maxGrade === '유일') {
    if (roll < heroRate) return '유일';
    if (roll < heroRate + rareRate) return '희귀';
    if (roll < heroRate + rareRate + highRate) return '고급';
    return '일반';
  }
  if (maxGrade === '유물') {
    if (roll < heroRate) return '유물';
    if (roll < heroRate + rareRate) return '희귀';
    if (roll < heroRate + rareRate + highRate) return '고급';
    return '일반';
  }
  return '일반';
};
