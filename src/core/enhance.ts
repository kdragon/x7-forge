import type { Item } from '../shared/types';

// 등급 인덱스 (낮은 등급일수록 작은 인덱스)
export const gradeOrder: Item['grade'][] = ['일반', '고급', '희귀', '고대', '영웅', '유일', '유물'];

export const gradeIndex = (g: string): number => gradeOrder.indexOf(g as Item['grade']);

// 분해 시 획득 숯돌 계산
export const getDisassembleStones = (
  tier: number,
  grade?: string,
): { type: 'low' | 'mid' | 'high'; amount: number; label: string } => {
  const stoneType: 'low' | 'mid' | 'high' = tier <= 2 ? 'low' : tier <= 4 ? 'mid' : 'high';

  const gradeRanges: Record<string, [number, number]> = {
    일반: [2, 4],
    고급: [4, 8],
    희귀: [20, 40],
    고대: [100, 200],
    영웅: [500, 1000],
    유일: [2500, 5000],
    유물: [12500, 20000],
  };

  const [min, max] = gradeRanges[grade || '일반'] || [2, 4];
  const amount = Math.floor(Math.random() * (max - min + 1)) + min;
  const stoneTypeLabel = stoneType === 'low' ? '하급숯돌' : stoneType === 'mid' ? '중급숯돌' : '상급숯돌';

  return { type: stoneType, amount, label: `${stoneTypeLabel} ${amount}` };
};

// 승급 비용 계산 (숯돌 기반)
export const getUpgradeCost = (
  grade: string,
  tier: number,
): { type: 'low' | 'mid' | 'high'; amount: number; label: string } | null => {
  const stoneType: 'low' | 'mid' | 'high' = tier <= 2 ? 'low' : tier <= 4 ? 'mid' : 'high';
  const stoneLabel = stoneType === 'low' ? '하급 숯돌' : stoneType === 'mid' ? '중급 숯돌' : '상급 숯돌';

  const upgradeCosts: Record<string, number> = {
    일반: 10,
    고급: 20,
    희귀: 100,
    고대: 500,
    영웅: 2500,
    유일: 12500,
  };

  const amount = upgradeCosts[grade];
  if (amount === undefined) return null;
  return { type: stoneType, amount, label: `${stoneLabel} ${amount}` };
};

// 다음 등급 반환
export const getNextGrade = (grade: string): Item['grade'] | null => {
  const idx = gradeOrder.indexOf(grade as Item['grade']);
  if (idx < 0 || idx >= gradeOrder.length - 1) return null;
  return gradeOrder[idx + 1];
};
